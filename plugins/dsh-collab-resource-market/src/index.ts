import type { IncomingMessage, ServerResponse } from "node:http";
import {
  bearerToken,
  readJsonBody,
  sameOrigin,
  sendJson,
} from "@pluginmax/shared";
import { z } from "zod";
import {
  ResourceMarketError,
  ResourceMarketService,
  customResourceTypeSchema,
  resourceMarketDomainSpec,
  type KvTableLike,
  type InstallRecord,
  type CustomResourceRecord,
  type MarketListInput,
  type McpCatalogProvider,
  type SkillCatalogProvider,
  type WorkbenchV2Port,
} from "./service.js";
import { McpProviderRegistry } from "./mcp-registry.js";

export const name = "dsh-collab-resource-market";
export const inject = ["storageDomain", "webServer"];

export {
  ResourceMarketError,
  ResourceMarketService,
  resourceMarketDomainSpec,
};
export type {
  MarketPrincipal,
  McpCatalogProvider,
  McpProviderAsset,
} from "./service.js";
export {
  McpProviderRegistry,
  McpRegistryError,
} from "./mcp-registry.js";
export type {
  McpToolCallInput,
  McpToolProvider,
} from "./mcp-registry.js";

interface WebRouteLike {
  readonly kind: "exact";
  readonly path: string;
  handler(
    request: IncomingMessage,
    response: ServerResponse,
  ): Promise<void> | void;
}

interface TeamPrincipalLike {
  readonly userId: string;
  readonly role?: "admin" | "owner" | "member" | "guest";
}

interface TeamServiceLike {
  resolveToken(token: string): TeamPrincipalLike | undefined;
}

interface MarketContext {
  storageDomain: {
    open(spec: unknown): Promise<{
      table(name: string): unknown;
      close(): Promise<void>;
    }>;
  };
  webServer: { register(route: WebRouteLike): unknown };
  provide(key: string, value: unknown): void;
  effect(operation: () => () => void): void;
  get(key: string, strict?: boolean): unknown;
  root?: { get(key: string, strict?: boolean): unknown };
}

function lookup<T>(ctx: MarketContext, key: string): T | undefined {
  const direct = ctx.get(key, false);
  return (direct ?? ctx.root?.get(key, false)) as T | undefined;
}

function query(request: IncomingMessage): URLSearchParams {
  return new URL(request.url ?? "/", "http://dsh.invalid").searchParams;
}

function assertSameOrigin(request: IncomingMessage): void {
  if (
    request.headers.origin !== undefined &&
    !sameOrigin(request.headers.origin, request.headers.host)
  ) {
    throw new ResourceMarketError(
      "forbidden",
      "same-origin request is required",
    );
  }
}

function principalFor(
  request: IncomingMessage,
  team: TeamServiceLike,
): TeamPrincipalLike {
  const token = bearerToken({
    get(name) {
      const value = request.headers[name.toLowerCase()];
      return Array.isArray(value) ? (value[0] ?? null) : (value ?? null);
    },
  });
  if (token === undefined) {
    throw new ResourceMarketError("unauthorized", "bearer token is required");
  }
  const principal = team.resolveToken(token);
  if (principal === undefined) {
    throw new ResourceMarketError("unauthorized", "invalid or expired token");
  }
  return principal;
}

function routeError(response: ServerResponse, cause: unknown): void {
  if (cause instanceof ResourceMarketError) {
    const status =
      cause.code === "invalid_input"
        ? 400
        : cause.code === "unauthorized"
          ? 401
          : cause.code === "forbidden"
            ? 403
            : cause.code === "not_found"
              ? 404
              : 503;
    sendJson(response, status, {
      ok: false,
      error: { code: cause.code, message: cause.message },
    });
    return;
  }
  sendJson(response, 500, {
    ok: false,
    error: {
      code: "internal_error",
      message: cause instanceof Error ? cause.message : "资源市场操作失败",
    },
  });
}

const pluginInstallSchema = z.object({ pluginId: z.string().min(1).max(200) });
const skillInstallSchema = z.object({ skillId: z.string().min(1).max(200) });
const mcpInputSchema = z.object({ mcpId: z.string().min(1).max(200) });
const customResourceInputSchema = z.object({
  type: customResourceTypeSchema,
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(1000).optional(),
  version: z.string().trim().min(1).max(80).optional(),
  publisherName: z.string().trim().min(1).max(120).optional(),
  permissions: z.array(z.string().trim().min(1).max(300)).max(20).optional(),
  manifest: z.record(z.string(), z.unknown()).optional(),
});
const publisherSchema = z.enum(["official", "certified", "community"]);
const compatibilitySchema = z.enum(["compatible", "incompatible"]);
const sortSchema = z.enum(["recommended", "updated", "name"]);

function enumParam<T extends string>(
  schema: z.ZodType<T>,
  value: string | null,
): T | undefined {
  if (value === null || value === "") return undefined;
  const parsed = schema.safeParse(value);
  if (!parsed.success) {
    throw new ResourceMarketError("invalid_input", "筛选参数不合法");
  }
  return parsed.data;
}

function integerParam(
  value: string | null,
  fallback: number,
): number {
  if (value === null || value === "") return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new ResourceMarketError("invalid_input", "分页参数不合法");
  }
  return parsed;
}

function marketInput(params: URLSearchParams): MarketListInput {
  const publisher = enumParam(publisherSchema, params.get("publisher"));
  const compatibility = enumParam(
    compatibilitySchema,
    params.get("compatibility"),
  );
  const sort = enumParam(sortSchema, params.get("sort"));
  return {
    ...(params.get("q") === null ? {} : { query: params.get("q") ?? "" }),
    ...(params.get("category") === null
      ? {}
      : { category: params.get("category") ?? "" }),
    ...(publisher === undefined ? {} : { publisher }),
    ...(compatibility === undefined ? {} : { compatibility }),
    ...(sort === undefined ? {} : { sort }),
    page: integerParam(params.get("page"), 1),
    pageSize: integerParam(params.get("pageSize"), 24),
  };
}

async function body<T>(
  request: IncomingMessage,
  schema: z.ZodType<T>,
): Promise<T> {
  const parsed = schema.safeParse(await readJsonBody(request));
  if (!parsed.success) {
    throw new ResourceMarketError("invalid_input", "请求内容不合法");
  }
  return parsed.data;
}

export function createResourceMarketRoutes(
  service: ResourceMarketService,
  lookupService: <T>(key: string) => T | undefined,
): WebRouteLike[] {
  const requireTeam = (): TeamServiceLike => {
    const team = lookupService<TeamServiceLike>("collabTeam");
    if (team === undefined) {
      throw new ResourceMarketError("unavailable", "协作身份服务不可用");
    }
    return team;
  };
  const principal = (request: IncomingMessage): TeamPrincipalLike =>
    principalFor(request, requireTeam());

  return [
    {
      kind: "exact",
      path: "/api/collab/workbench-market/templates",
      handler: (request, response) => {
        try {
          assertSameOrigin(request);
          if (request.method !== "GET") {
            throw new ResourceMarketError("invalid_input", "method not allowed");
          }
          const user = principal(request);
          const result = service.templateList(user, marketInput(query(request)));
          sendJson(response, 200, {
            ok: true,
            templates: result.items,
            total: result.total,
            page: result.page,
            pageSize: result.pageSize,
            pageCount: result.pageCount,
          });
        } catch (cause) {
          routeError(response, cause);
        }
      },
    },
    {
      kind: "exact",
      path: "/api/collab/workbench-market/templates/detail",
      handler: (request, response) => {
        try {
          assertSameOrigin(request);
          if (request.method !== "GET") {
            throw new ResourceMarketError("invalid_input", "method not allowed");
          }
          const user = principal(request);
          const params = query(request);
          const template = service.templateDetail(
            user,
            params.get("id") ?? "",
            params.get("version") ?? undefined,
          );
          if (template === undefined) {
            throw new ResourceMarketError("not_found", "工作台方案不存在");
          }
          sendJson(response, 200, { ok: true, template });
        } catch (cause) {
          routeError(response, cause);
        }
      },
    },
    {
      kind: "exact",
      path: "/api/collab/workbench-market/plugins",
      handler: (request, response) => {
        try {
          assertSameOrigin(request);
          if (request.method !== "GET") {
            throw new ResourceMarketError("invalid_input", "method not allowed");
          }
          const user = principal(request);
          const result = service.pluginList(user, marketInput(query(request)));
          sendJson(response, 200, {
            ok: true,
            plugins: result.items,
            total: result.total,
            page: result.page,
            pageSize: result.pageSize,
            pageCount: result.pageCount,
          });
        } catch (cause) {
          routeError(response, cause);
        }
      },
    },
    {
      kind: "exact",
      path: "/api/collab/workbench-market/plugins/install",
      handler: async (request, response) => {
        try {
          assertSameOrigin(request);
          if (request.method !== "POST") {
            throw new ResourceMarketError("invalid_input", "method not allowed");
          }
          const user = principal(request);
          const input = await body(request, pluginInstallSchema);
          sendJson(
            response,
            200,
            await service.enablePlugin(user.userId, input.pluginId),
          );
        } catch (cause) {
          routeError(response, cause);
        }
      },
    },
    {
      kind: "exact",
      path: "/api/collab/resources/skills",
      handler: async (request, response) => {
        try {
          assertSameOrigin(request);
          const user = principal(request);
          if (request.method === "GET") {
            const params = query(request);
            sendJson(response, 200, {
              ok: true,
              skills: await service.skills(user, {
                ...(params.get("q") === null
                  ? {}
                  : { query: params.get("q") ?? "" }),
                ...(params.get("category") === null
                  ? {}
                  : { category: params.get("category") ?? "" }),
              }),
            });
            return;
          }
          if (request.method !== "POST") {
            throw new ResourceMarketError("invalid_input", "method not allowed");
          }
          const input = await body(request, skillInstallSchema);
          sendJson(response, 200, {
            ok: true,
            install: await service.installSkill(user.userId, input.skillId),
          });
        } catch (cause) {
          routeError(response, cause);
        }
      },
    },
    {
      kind: "exact",
      path: "/api/collab/resources/mcps",
      handler: async (request, response) => {
        try {
          assertSameOrigin(request);
          const user = principal(request);
          if (request.method !== "GET") {
            throw new ResourceMarketError("invalid_input", "method not allowed");
          }
          const params = query(request);
          const queryValue = params.get("q");
          const categoryValue = params.get("category");
          const input: { query?: string } = {};
          if (queryValue !== null) input.query = queryValue;
          sendJson(response, 200, {
            ok: true,
            mcps: await service.mcps(user, {
              ...input,
              ...(categoryValue === null
                ? {}
                : { category: categoryValue }),
            }),
          });
        } catch (cause) {
          routeError(response, cause);
        }
      },
    },
    {
      kind: "exact",
      path: "/api/collab/resources/mcps/connect",
      handler: async (request, response) => {
        try {
          assertSameOrigin(request);
          if (request.method !== "POST") {
            throw new ResourceMarketError("invalid_input", "method not allowed");
          }
          const user = principal(request);
          const input = await body(request, mcpInputSchema);
          sendJson(response, 200, {
            ok: true,
            install: await service.connectMcp(user.userId, input.mcpId),
          });
        } catch (cause) {
          routeError(response, cause);
        }
      },
    },
    {
      kind: "exact",
      path: "/api/collab/resources/custom",
      handler: async (request, response) => {
        try {
          assertSameOrigin(request);
          const user = principal(request);
          if (request.method === "GET") {
            const params = query(request);
            const type = enumParam(
              customResourceTypeSchema,
              params.get("type"),
            );
            sendJson(response, 200, {
              ok: true,
              resources: service.customResources(user, {
                ...(type === undefined ? {} : { type }),
                ...(params.get("q") === null
                  ? {}
                  : { query: params.get("q") ?? "" }),
                ...(params.get("category") === null
                  ? {}
                  : { category: params.get("category") ?? "" }),
              }),
            });
            return;
          }
          if (request.method === "DELETE") {
            const id = query(request).get("id") ?? "";
            await service.removeCustomResource(user, id);
            sendJson(response, 200, { ok: true });
            return;
          }
          if (request.method !== "POST") {
            throw new ResourceMarketError("invalid_input", "method not allowed");
          }
          const input = await body(request, customResourceInputSchema);
          sendJson(response, 201, {
            ok: true,
            resource: await service.registerCustomResource(user, input),
          });
        } catch (cause) {
          routeError(response, cause);
        }
      },
    },
  ];
}

export async function apply(ctx: MarketContext): Promise<void> {
  const domain = await ctx.storageDomain.open(resourceMarketDomainSpec);
  const mcpRegistry = new McpProviderRegistry();
  const service = new ResourceMarketService(
    {
      installs: domain.table("installs") as KvTableLike<InstallRecord>,
      customAssets: domain.table("custom_assets") as KvTableLike<
        CustomResourceRecord
      >,
    },
    {
      workbench: () => lookup<WorkbenchV2Port>(ctx, "collabWorkbenchV2"),
      skillProvider: () =>
        lookup<SkillCatalogProvider>(ctx, "collabSkillCatalog"),
      mcpProvider: () => lookup<McpCatalogProvider>(ctx, "collabMcpCatalog"),
      mcpRegistry: () =>
        lookup<McpProviderRegistry>(ctx, "collabMcpProviderRegistry"),
    },
  );
  ctx.provide("collabResourceMarket", service);
  ctx.provide("collabMcpProviderRegistry", mcpRegistry);
  ctx.effect(() => () => void domain.close());
  ctx.effect(() => () => void mcpRegistry.dispose());
  ctx.effect(() => {
    const disposers = createResourceMarketRoutes(service, (key) =>
      lookup(ctx, key),
    ).map((route) => ctx.webServer.register(route) as () => void);
    return () => {
      for (const dispose of disposers) dispose();
    };
  });
}
