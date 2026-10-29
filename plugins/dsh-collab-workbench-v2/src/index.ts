import type { IncomingMessage, ServerResponse } from "node:http";
import {
  bearerToken,
  readJsonBody,
  sameOrigin,
  sendJson,
} from "@pluginmax/shared";
import { z } from "zod";
import {
  idSchema,
  panelInstanceSchema,
  spanSchema,
  workbenchV2DomainSpec,
} from "./models.js";
import {
  WorkbenchV2Error,
  WorkbenchV2Service,
  type KvTableLike,
  type WorkbenchPrincipal,
  type WorkbenchTemplatePlan,
} from "./service.js";

export const name = "dsh-collab-workbench-v2";
export const inject = ["storageDomain", "webServer"];

export { WorkbenchV2Error, WorkbenchV2Service, workbenchV2DomainSpec };

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
  users(): readonly { readonly id: string; readonly name: string }[];
  members(workspaceId: string): readonly { userId: string }[];
}

interface MarketServiceLike {
  template(id: string, version?: string): WorkbenchTemplatePlan | undefined;
  templateDetail(
    principal: WorkbenchPrincipal,
    id: string,
    version?: string,
  ):
    | (WorkbenchTemplatePlan & {
        compatibility: "compatible" | "incompatible";
        dependencies: readonly {
          id: string;
          status:
            | "enabled"
            | "not_enabled"
            | "not_packaged"
            | "disabled"
            | "incompatible"
            | "missing";
        }[];
      })
    | undefined;
  enablePlugin(
    userId: string,
    pluginId: string,
  ): Promise<{ status: "enabled" | "not_packaged" | "disabled" }>;
  plugin(id: string):
    | {
        id: string;
        version: string;
        compatibility: "compatible" | "incompatible";
        enabledFor(userId: string): boolean;
      }
    | undefined;
  runtimeStatus(id: string): string;
}

interface WorkbenchContext {
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

function lookup<T>(ctx: WorkbenchContext, key: string): T | undefined {
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
    throw new WorkbenchV2Error("forbidden", "same-origin request is required");
  }
}

function principalFor(
  request: IncomingMessage,
  team: TeamServiceLike,
): WorkbenchPrincipal {
  const token = bearerToken({
    get(name) {
      const value = request.headers[name.toLowerCase()];
      return Array.isArray(value) ? (value[0] ?? null) : (value ?? null);
    },
  });
  if (token === undefined) {
    throw new WorkbenchV2Error("unauthorized", "bearer token is required");
  }
  const principal = team.resolveToken(token);
  if (principal === undefined) {
    throw new WorkbenchV2Error("unauthorized", "invalid or expired token");
  }
  const user = team.users().find((candidate) => candidate.id === principal.userId);
  return {
    userId: principal.userId,
    ...(user?.name === undefined ? {} : { name: user.name }),
    ...(principal.role === undefined ? {} : { role: principal.role }),
  };
}

function method(
  request: IncomingMessage,
  expected: string,
): void {
  if (request.method !== expected) {
    throw new WorkbenchV2Error("invalid_input", "method not allowed");
  }
}

function routeError(response: ServerResponse, cause: unknown): void {
  if (cause instanceof WorkbenchV2Error) {
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
      message: cause instanceof Error ? cause.message : "工作台操作失败",
    },
  });
}

const createSchema = z.object({
  name: z.string().trim().min(1).max(40).optional(),
  description: z.string().trim().max(400).optional(),
  icon: z.string().trim().min(1).max(80).optional(),
  color: z.string().trim().max(40).optional(),
  visibility: z.enum(["private", "team"]).optional(),
  sharedWorkspaceIds: z.array(idSchema).max(20).optional(),
});

const updateSchema = z.object({
  workbenchId: idSchema,
  name: z.string().trim().min(1).max(40).optional(),
  description: z.string().trim().max(400).optional(),
  icon: z.string().trim().min(1).max(80).optional(),
  color: z.string().trim().max(40).optional(),
  visibility: z.enum(["private", "team"]).optional(),
  sharedWorkspaceIds: z.array(idSchema).max(20).optional(),
});

const draftSchema = z.object({
  workbenchId: idSchema,
  expectedRevision: z.number().int().min(1),
  panels: z.array(panelInstanceSchema).max(100),
  name: z.string().trim().min(1).max(40).optional(),
  description: z.string().trim().max(400).optional(),
});

const preferenceSchema = z.object({
  activeWorkbenchId: idSchema.optional(),
  defaultWorkbenchId: idSchema.optional(),
  favoriteIds: z.array(idSchema).max(5).optional(),
  order: z.array(idSchema).max(100).optional(),
});

const duplicateSchema = z.object({
  workbenchId: idSchema,
  name: z.string().trim().min(1).max(40).optional(),
});

const removeSchema = z.object({ workbenchId: idSchema });

const templateInstallSchema = z.object({
  templateId: idSchema,
  version: z.string().trim().min(1).max(80).optional(),
  name: z.string().trim().min(1).max(40).optional(),
});

const addPanelSchema = z.object({
  workbenchId: idSchema.optional(),
  pluginId: idSchema,
  pluginVersion: z.string().trim().min(1).max(80).optional(),
  title: z.string().trim().max(120).optional(),
  span: spanSchema.optional(),
  config: z.record(z.string(), z.unknown()).optional(),
  expectedRevision: z.number().int().min(1).optional(),
});

const bootstrapSchema = z.object({
  layouts: z
    .array(
      z.object({
        id: z.string().optional(),
        name: z.string().max(80).optional(),
        order: z.array(z.string()).max(100),
        modules: z.record(
          z.string(),
          z
            .object({
              cols: z.number().optional(),
              height: z.number().nullable().optional(),
            })
            .optional(),
        ),
      }),
    )
    .max(20),
});

async function requireBody<T>(
  request: IncomingMessage,
  schema: z.ZodType<T>,
): Promise<T> {
  const parsed = schema.safeParse(await readJsonBody(request));
  if (!parsed.success) {
    throw new WorkbenchV2Error("invalid_input", "请求内容不合法");
  }
  return parsed.data;
}

function idempotencyKey(request: IncomingMessage): string | undefined {
  const value = request.headers["idempotency-key"];
  const key = Array.isArray(value) ? value[0] : value;
  if (key === undefined || key.trim() === "") return undefined;
  if (key.trim().length > 200) {
    throw new WorkbenchV2Error("invalid_input", "Idempotency-Key 过长");
  }
  return key.trim();
}

export function createWorkbenchV2Routes(
  service: WorkbenchV2Service,
  lookupService: <T>(key: string) => T | undefined,
): WebRouteLike[] {
  const requireTeam = (): TeamServiceLike => {
    const team = lookupService<TeamServiceLike>("collabTeam");
    if (team === undefined) {
      throw new WorkbenchV2Error("unavailable", "协作身份服务不可用");
    }
    return team;
  };
  const requireMarket = (): MarketServiceLike => {
    const market = lookupService<MarketServiceLike>("collabResourceMarket");
    if (market === undefined) {
      throw new WorkbenchV2Error("unavailable", "资源市场服务不可用");
    }
    return market;
  };
  const principal = (request: IncomingMessage): WorkbenchPrincipal =>
    principalFor(request, requireTeam());

  return [
    {
      kind: "exact",
      path: "/api/collab/workbenches",
      handler: async (request, response) => {
        try {
          assertSameOrigin(request);
          const user = principal(request);
          if (request.method === "GET") {
            sendJson(response, 200, { ok: true, ...(await service.list(user)) });
            return;
          }
          method(request, "POST");
          const input = await requireBody(request, createSchema);
          const workbench = await service.create(user, input);
          sendJson(response, 201, { ok: true, workbench });
        } catch (cause) {
          routeError(response, cause);
        }
      },
    },
    {
      kind: "exact",
      path: "/api/collab/workbenches/detail",
      handler: async (request, response) => {
        try {
          assertSameOrigin(request);
          method(request, "GET");
          const user = principal(request);
          const id = query(request).get("id") ?? "";
          const workbench = await service.detail(user, id);
          sendJson(response, 200, { ok: true, workbench });
        } catch (cause) {
          routeError(response, cause);
        }
      },
    },
    {
      kind: "exact",
      path: "/api/collab/workbenches/update",
      handler: async (request, response) => {
        try {
          assertSameOrigin(request);
          method(request, "PATCH");
          const user = principal(request);
          const input = await requireBody(request, updateSchema);
          const workbench = await service.update(
            user,
            input.workbenchId,
            input,
          );
          sendJson(response, 200, { ok: true, workbench });
        } catch (cause) {
          routeError(response, cause);
        }
      },
    },
    {
      kind: "exact",
      path: "/api/collab/workbenches/draft",
      handler: async (request, response) => {
        try {
          assertSameOrigin(request);
          method(request, "PUT");
          const user = principal(request);
          const input = await requireBody(request, draftSchema);
          const workbench = await service.saveDraft(user, input);
          sendJson(response, 200, { ok: true, workbench });
        } catch (cause) {
          routeError(response, cause);
        }
      },
    },
    {
      kind: "exact",
      path: "/api/collab/workbenches/duplicate",
      handler: async (request, response) => {
        try {
          assertSameOrigin(request);
          method(request, "POST");
          const user = principal(request);
          const input = await requireBody(request, duplicateSchema);
          const workbench = await service.duplicate(
            user,
            input.workbenchId,
            input.name,
          );
          sendJson(response, 201, { ok: true, workbench });
        } catch (cause) {
          routeError(response, cause);
        }
      },
    },
    {
      kind: "exact",
      path: "/api/collab/workbenches/delete",
      handler: async (request, response) => {
        try {
          assertSameOrigin(request);
          method(request, "POST");
          const user = principal(request);
          const input = await requireBody(request, removeSchema);
          sendJson(response, 200, {
            ok: true,
            ...(await service.remove(user, input.workbenchId)),
          });
        } catch (cause) {
          routeError(response, cause);
        }
      },
    },
    {
      kind: "exact",
      path: "/api/collab/workbenches/preference",
      handler: async (request, response) => {
        try {
          assertSameOrigin(request);
          method(request, "PUT");
          const user = principal(request);
          const input = await requireBody(request, preferenceSchema);
          const preference = await service.preferenceUpdate(user, input);
          sendJson(response, 200, { ok: true, preference });
        } catch (cause) {
          routeError(response, cause);
        }
      },
    },
    {
      kind: "exact",
      path: "/api/collab/workbenches/bootstrap",
      handler: async (request, response) => {
        try {
          assertSameOrigin(request);
          method(request, "POST");
          const user = principal(request);
          const input = await requireBody(request, bootstrapSchema);
          const workbenches = await service.bootstrap(user, input);
          sendJson(response, 200, { ok: true, workbenches });
        } catch (cause) {
          routeError(response, cause);
        }
      },
    },
    {
      kind: "exact",
      path: "/api/collab/workbenches/panels",
      handler: async (request, response) => {
        try {
          assertSameOrigin(request);
          method(request, "POST");
          const user = principal(request);
          const input = await requireBody(request, addPanelSchema);
          const market = requireMarket();
          const plugin = market.plugin(input.pluginId);
          if (plugin === undefined) {
            throw new WorkbenchV2Error("not_found", "面板插件不存在");
          }
          const runtimeStatus = market.runtimeStatus(plugin.id);
          if (runtimeStatus === "not_packaged") {
            throw new WorkbenchV2Error(
              "unavailable",
              "面板插件尚未装配到当前 DSH",
            );
          }
          if (runtimeStatus === "disabled") {
            throw new WorkbenchV2Error("forbidden", "面板插件已被管理员禁用");
          }
          if (plugin.compatibility === "incompatible") {
            throw new WorkbenchV2Error("conflict", "面板插件与当前宿主不兼容");
          }
          const listing = await service.list(user);
          const workbenchId =
            input.workbenchId ?? listing.preference.activeWorkbenchId;
          if (workbenchId === undefined) {
            throw new WorkbenchV2Error("not_found", "没有当前工作台");
          }
          const current = await service.detail(user, workbenchId);
          if (current.ownerId !== user.userId) {
            throw new WorkbenchV2Error(
              "forbidden",
              "只读工作台不能添加面板，请先复制",
            );
          }
          const result = await service.idempotent(
            user,
            "panel_add",
            idempotencyKey(request),
            async () => {
              let entitlementEnabled = false;
              if (!plugin.enabledFor(user.userId)) {
                const enabled = await market.enablePlugin(
                  user.userId,
                  plugin.id,
                );
                if (enabled.status !== "enabled") {
                  throw new WorkbenchV2Error(
                    "unavailable",
                    "面板能力未能启用",
                  );
                }
                entitlementEnabled = true;
              }
              return {
                workbench: await service.addPanel(user, {
                  ...input,
                  workbenchId,
                }),
                entitlementEnabled,
              };
            },
          );
          sendJson(response, 200, { ok: true, ...result });
        } catch (cause) {
          routeError(response, cause);
        }
      },
    },
    {
      kind: "exact",
      path: "/api/collab/workbench-market/templates/install",
      handler: async (request, response) => {
        try {
          assertSameOrigin(request);
          method(request, "POST");
          const user = principal(request);
          const input = await requireBody(request, templateInstallSchema);
          const market = requireMarket();
          const template = market.templateDetail(
            user,
            input.templateId,
            input.version,
          );
          if (template === undefined) {
            throw new WorkbenchV2Error("not_found", "工作台方案不存在");
          }
          const blockers = template.dependencies.filter((dependency) =>
            [
              "missing",
              "not_packaged",
              "disabled",
              "incompatible",
            ].includes(dependency.status),
          );
          if (blockers.length > 0) {
            throw new WorkbenchV2Error(
              "conflict",
              `方案依赖不可用：${blockers.map((item) => item.id).join(", ")}`,
            );
          }
          const result = await service.idempotent(
            user,
            "template_install",
            idempotencyKey(request),
            async () => {
              const listing = await service.list(user);
              if (
                listing.workbenches.filter(
                  (workbench) => workbench.ownerId === user.userId,
                ).length >= 20
              ) {
                throw new WorkbenchV2Error(
                  "invalid_input",
                  "最多创建 20 个工作台",
                );
              }
              const disabled = template.dependencies
                .filter((dependency) => dependency.status === "not_enabled")
                .map((dependency) => dependency.id);
              await service.enablePlugins(user, disabled);
              const workbench = await service.installTemplate(
                user,
                template,
                input.name,
              );
              return { workbench, enabledPlugins: disabled };
            },
          );
          sendJson(response, 201, {
            ok: true,
            ...result,
            missingPlugins: [],
          });
        } catch (cause) {
          routeError(response, cause);
        }
      },
    },
    {
      kind: "exact",
      path: "/api/collab/workbench-v2/panel",
      handler: async (request, response) => {
        try {
          assertSameOrigin(request);
          method(request, "GET");
          const user = principal(request);
          const pluginId = query(request).get("pluginId") ?? "";
          const panel = await service.panelData(user, pluginId);
          sendJson(response, 200, { ok: true, panel });
        } catch (cause) {
          routeError(response, cause);
        }
      },
    },
  ];
}

export async function apply(ctx: WorkbenchContext): Promise<void> {
  const domain = await ctx.storageDomain.open(workbenchV2DomainSpec);
  const service = new WorkbenchV2Service(
    {
      workbenches: domain.table("workbenches") as KvTableLike<
        import("./models.js").WorkbenchRecord
      >,
      preferences: domain.table("preferences") as KvTableLike<
        import("./models.js").WorkbenchPreference
      >,
      panelEntitlements: domain.table("panel_entitlements") as KvTableLike<
        import("./models.js").PanelEntitlement
      >,
      idempotency: domain.table("idempotency") as KvTableLike<{
        key: string;
        userId: string;
        operation: string;
        result: unknown;
        createdAt: string;
      }>,
      audit: domain.table("audit") as KvTableLike<
        import("./models.js").WorkbenchAudit
      >,
    },
    {
      team: () => lookup<TeamServiceLike>(ctx, "collabTeam"),
      teammateWorkload: () =>
        lookup<{ snapshot(principal: WorkbenchPrincipal): Promise<unknown> }>(
          ctx,
          "collabTeammateWorkload",
        ),
    },
  );
  ctx.provide("collabWorkbenchV2", service);
  ctx.effect(() => () => void domain.close());
  ctx.effect(() => {
    const disposers = createWorkbenchV2Routes(service, (key) =>
      lookup(ctx, key),
    ).map((route) => ctx.webServer.register(route) as () => void);
    return () => {
      for (const dispose of disposers) dispose();
    };
  });
}
