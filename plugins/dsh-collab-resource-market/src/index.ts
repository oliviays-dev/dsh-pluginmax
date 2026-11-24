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
  type CustomResourceUpdateInput,
  type LifecycleMutationInput,
  type MarketListInput,
  type McpCatalogProvider,
  type ResourceLifecycleAudit,
  type ResourceLifecycleRecord,
  type SkillCatalogProvider,
  type WorkbenchV2Port,
} from "./service.js";
import { McpProviderRegistry } from "./mcp-registry.js";

export const name = "dsh-collab-resource-market";
export const inject = ["storageDomain", "webServer"];

export { ResourceMarketError, ResourceMarketService, resourceMarketDomainSpec };
export type {
  LifecycleMutationInput,
  MarketPrincipal,
  McpCatalogProvider,
  McpProviderAsset,
  ResourceActions,
  ResourceLifecycleAudit,
  ResourceLifecycleRecord,
} from "./service.js";
export { McpProviderRegistry, McpRegistryError } from "./mcp-registry.js";
export type { McpToolCallInput, McpToolProvider } from "./mcp-registry.js";

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
              : cause.code === "conflict"
                ? 409
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
const skillInstallSchema = z.object({
  skillId: z.string().min(1).max(200),
  targetIds: z.array(z.string().min(1).max(200)).max(20).optional(),
  activeTargetId: z.string().min(1).max(200).optional(),
});
const skillBindingInputSchema = z.object({
  skillId: z.string().min(1).max(200),
  targetId: z.string().min(1).max(200),
});
const officialSkillSaveSchema = z.object({
  id: z.string().trim().min(1).max(200),
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().min(1).max(1_000),
  category: z.string().trim().min(1).max(40).optional(),
  version: z.string().trim().min(1).max(80).optional(),
  permissions: z.array(z.string().trim().min(1).max(300)).max(20).optional(),
  instructions: z.string().trim().min(1).max(200_000),
  triggers: z.array(z.string().trim().min(1).max(80)).max(30).optional(),
  mountTargets: z
    .array(
      z.object({
        type: z.literal("component-slot"),
        targetId: z.string().trim().min(1).max(200),
        componentId: z.string().trim().min(1).max(200),
        componentLabel: z.string().trim().min(1).max(120),
        slotId: z.string().trim().min(1).max(120),
        slotLabel: z.string().trim().min(1).max(120),
      }),
    )
    .max(20)
    .optional(),
});
const mcpInputSchema = z.object({ mcpId: z.string().min(1).max(200) });
const customResourceInputSchema = z.object({
  type: customResourceTypeSchema,
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(1000).optional(),
  version: z.string().trim().min(1).max(80).optional(),
  publisherName: z.string().trim().min(1).max(120).optional(),
  permissions: z.array(z.string().trim().min(1).max(300)).max(20).optional(),
  sharingScope: z.enum(["private", "platform"]).optional(),
  manifest: z.record(z.string(), z.unknown()).optional(),
});
const customResourceUpdateSchema = z.object({
  id: z.string().trim().min(1).max(200),
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(1000).optional(),
  version: z.string().trim().min(1).max(80).optional(),
  publisherName: z.string().trim().min(1).max(120).optional(),
  permissions: z.array(z.string().trim().min(1).max(300)).max(20).optional(),
  sharingScope: z.enum(["private", "platform"]).optional(),
  manifest: z.record(z.string(), z.unknown()).optional(),
});
const lifecycleMutationSchema = z.object({
  resourceType: customResourceTypeSchema,
  resourceId: z.string().trim().min(1).max(200),
  reasonCode: z.string().trim().min(1).max(80).optional(),
  note: z.string().trim().max(1000).optional(),
  expectedRevision: z.number().int().positive(),
});
const publisherSchema = z.enum(["official", "certified", "community"]);
const compatibilitySchema = z.enum(["compatible", "incompatible"]);
const sortSchema = z.enum(["recommended", "updated", "name"]);
const publicationStatusSchema = z.enum(["published", "delisted"]);

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

function integerParam(value: string | null, fallback: number): number {
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
  const publicationStatus = enumParam(
    publicationStatusSchema,
    params.get("publicationStatus"),
  );
  return {
    ...(params.get("q") === null ? {} : { query: params.get("q") ?? "" }),
    ...(params.get("category") === null
      ? {}
      : { category: params.get("category") ?? "" }),
    ...(publisher === undefined ? {} : { publisher }),
    ...(compatibility === undefined ? {} : { compatibility }),
    ...(sort === undefined ? {} : { sort }),
    ...(publicationStatus === undefined ? {} : { publicationStatus }),
    ...(params.get("includeDelisted") === "true"
      ? { includeDelisted: true }
      : {}),
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
            throw new ResourceMarketError(
              "invalid_input",
              "method not allowed",
            );
          }
          const user = principal(request);
          const result = service.templateList(
            user,
            marketInput(query(request)),
          );
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
            throw new ResourceMarketError(
              "invalid_input",
              "method not allowed",
            );
          }
          const user = principal(request);
          const params = query(request);
          const template = service.templateDetail(
            user,
            params.get("id") ?? "",
            params.get("version") ?? undefined,
            {
              includeDelisted: params.get("includeDelisted") === "true",
            },
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
            throw new ResourceMarketError(
              "invalid_input",
              "method not allowed",
            );
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
            throw new ResourceMarketError(
              "invalid_input",
              "method not allowed",
            );
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
            const market = marketInput(params);
            sendJson(response, 200, {
              ok: true,
              canManage: user.role === "admin",
              skills: await service.skills(user, {
                query: market.query ?? "",
                category: market.category ?? "",
                ...(market.includeDelisted === undefined
                  ? {}
                  : { includeDelisted: market.includeDelisted }),
                ...(market.publicationStatus === undefined
                  ? {}
                  : { publicationStatus: market.publicationStatus }),
              }),
            });
            return;
          }
          if (request.method === "DELETE") {
            const skillId = query(request).get("id") ?? "";
            if (skillId === "") {
              throw new ResourceMarketError(
                "invalid_input",
                "skill id is required",
              );
            }
            await service.uninstallSkill(user, skillId);
            sendJson(response, 200, { ok: true });
            return;
          }
          if (request.method !== "POST") {
            throw new ResourceMarketError(
              "invalid_input",
              "method not allowed",
            );
          }
          const input = await body(request, skillInstallSchema);
          sendJson(response, 200, {
            ok: true,
            install: await service.installSkill(user.userId, input.skillId, {
              ...(input.targetIds === undefined
                ? {}
                : { targetIds: input.targetIds }),
              ...(input.activeTargetId === undefined
                ? {}
                : { activeTargetId: input.activeTargetId }),
            }),
          });
        } catch (cause) {
          routeError(response, cause);
        }
      },
    },
    {
      kind: "exact",
      path: "/api/collab/resources/skills/binding",
      handler: async (request, response) => {
        try {
          assertSameOrigin(request);
          const user = principal(request);
          if (request.method === "GET") {
            const targetId = query(request).get("targetId") ?? "";
            if (targetId === "") {
              throw new ResourceMarketError(
                "invalid_input",
                "targetId is required",
              );
            }
            sendJson(
              response,
              200,
              await service.skillsForTarget(user, targetId),
            );
            return;
          }
          if (request.method !== "POST") {
            throw new ResourceMarketError(
              "invalid_input",
              "method not allowed",
            );
          }
          const input = await body(request, skillBindingInputSchema);
          sendJson(response, 200, {
            ok: true,
            install: await service.setSkillTargetActive(
              user,
              input.skillId,
              input.targetId,
            ),
          });
        } catch (cause) {
          routeError(response, cause);
        }
      },
    },
    {
      kind: "exact",
      path: "/api/collab/resources/skills/official/save",
      handler: async (request, response) => {
        try {
          assertSameOrigin(request);
          if (request.method !== "POST") {
            throw new ResourceMarketError(
              "invalid_input",
              "method not allowed",
            );
          }
          const user = principal(request);
          const input = await body(request, officialSkillSaveSchema);
          const saved = await service.saveOfficialSkill(user, input);
          const resource = (await service.skills(user, {})).find(
            (skill) => skill.id === saved.id,
          );
          sendJson(response, 200, {
            ok: true,
            resource: resource ?? saved,
          });
        } catch (cause) {
          routeError(response, cause);
        }
      },
    },
    {
      kind: "exact",
      path: "/api/collab/resources/skills/installed",
      handler: async (request, response) => {
        try {
          assertSameOrigin(request);
          if (request.method !== "GET") {
            throw new ResourceMarketError(
              "invalid_input",
              "method not allowed",
            );
          }
          const user = principal(request);
          sendJson(response, 200, {
            ok: true,
            skills: await service.installedSkills(user),
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
            throw new ResourceMarketError(
              "invalid_input",
              "method not allowed",
            );
          }
          const params = query(request);
          const market = marketInput(params);
          sendJson(response, 200, {
            ok: true,
            mcps: await service.mcps(user, {
              query: market.query ?? "",
              category: market.category ?? "",
              ...(market.includeDelisted === undefined
                ? {}
                : { includeDelisted: market.includeDelisted }),
              ...(market.publicationStatus === undefined
                ? {}
                : { publicationStatus: market.publicationStatus }),
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
            throw new ResourceMarketError(
              "invalid_input",
              "method not allowed",
            );
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
      path: "/api/collab/resources/mcps/disconnect",
      handler: async (request, response) => {
        try {
          assertSameOrigin(request);
          if (request.method !== "POST") {
            throw new ResourceMarketError(
              "invalid_input",
              "method not allowed",
            );
          }
          const user = principal(request);
          const input = await body(request, mcpInputSchema);
          await service.disconnectMcp(user.userId, input.mcpId);
          sendJson(response, 200, { ok: true });
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
            const market = marketInput(params);
            sendJson(response, 200, {
              ok: true,
              resources: service.customResources(user, {
                ...(type === undefined ? {} : { type }),
                query: market.query ?? "",
                category: market.category ?? "",
                ...(market.includeDelisted === undefined
                  ? {}
                  : { includeDelisted: market.includeDelisted }),
                ...(market.publicationStatus === undefined
                  ? {}
                  : { publicationStatus: market.publicationStatus }),
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
          if (request.method === "PATCH") {
            const { id, ...input } = await body(
              request,
              customResourceUpdateSchema,
            );
            sendJson(response, 200, {
              ok: true,
              resource: await service.updateCustomResource(
                user,
                id,
                input satisfies CustomResourceUpdateInput,
              ),
            });
            return;
          }
          if (request.method !== "POST") {
            throw new ResourceMarketError(
              "invalid_input",
              "method not allowed",
            );
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
    {
      kind: "exact",
      path: "/api/collab/resources/lifecycle/delist",
      handler: async (request, response) => {
        try {
          assertSameOrigin(request);
          if (request.method !== "POST") {
            throw new ResourceMarketError(
              "invalid_input",
              "method not allowed",
            );
          }
          const user = principal(request);
          const input = (await body(
            request,
            lifecycleMutationSchema,
          )) as LifecycleMutationInput;
          sendJson(response, 200, {
            ok: true,
            ...(await service.delistResource(user, input)),
          });
        } catch (cause) {
          routeError(response, cause);
        }
      },
    },
    {
      kind: "exact",
      path: "/api/collab/resources/lifecycle/relist",
      handler: async (request, response) => {
        try {
          assertSameOrigin(request);
          if (request.method !== "POST") {
            throw new ResourceMarketError(
              "invalid_input",
              "method not allowed",
            );
          }
          const user = principal(request);
          const input = (await body(
            request,
            lifecycleMutationSchema,
          )) as LifecycleMutationInput;
          sendJson(response, 200, {
            ok: true,
            ...(await service.relistResource(user, input)),
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
      customAssets: domain.table(
        "custom_assets",
      ) as KvTableLike<CustomResourceRecord>,
      lifecycle: domain.table(
        "resource_lifecycle",
      ) as KvTableLike<ResourceLifecycleRecord>,
      lifecycleAudit: domain.table(
        "resource_lifecycle_audit",
      ) as KvTableLike<ResourceLifecycleAudit>,
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
