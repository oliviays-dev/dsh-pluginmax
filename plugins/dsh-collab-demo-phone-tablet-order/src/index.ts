import type { IncomingMessage, ServerResponse } from "node:http";
import { execFile } from "node:child_process";
import { mkdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import {
  bearerToken,
  readJsonBody,
  sameOrigin,
  sendJson,
} from "@pluginmax/shared";
import type {
  McpProviderRegistry,
  McpToolProvider,
} from "dsh-collab-resource-market";
import type {
  ModuleId,
  WorkbenchDataMetricProvider,
  WorkbenchDisplayProfile,
  WorkbenchService,
} from "dsh-collab-workbench";
import { z } from "zod";
import {
  DemoPhoneTabletMcpProvider,
  loadDemoDraft,
} from "./demo-mcp-provider.js";
import {
  DemoActionError,
  DemoTaskActionService,
} from "./demo-task-action.js";
import {
  DEMO_FEATURE_FLAG,
  DEMO_OMS_MCP_ID,
  DEMO_PLUGIN_ID,
  DEMO_PROFILE_ID,
  DEMO_WORKSPACE_TITLE,
  demoDomainSpec,
  type DemoTaskReceipt,
} from "./models.js";

const execFileAsync = promisify(execFile);

export const name = DEMO_PLUGIN_ID;
export const inject = ["storageDomain", "webServer"];

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
  readonly role?: "admin" | "owner" | "member" | "guest" | undefined;
}

interface TeamServiceLike {
  resolveToken(token: string): TeamPrincipalLike | undefined;
  users(): readonly { readonly id: string; readonly name: string }[];
  members(
    workspaceId: string,
  ): readonly { readonly userId: string; readonly role?: string }[];
}

interface WorkspaceLike {
  readonly id: string;
  readonly path: string;
  readonly title?: string | undefined;
}

interface WorkspaceRegistryLike {
  get(workspaceId: string): WorkspaceLike | undefined;
  list(): readonly WorkspaceLike[];
}

interface TaskLike {
  readonly id: string;
  readonly workspaceId: string;
  readonly title: string;
}

interface TaskServiceLike {
  get(taskId: string): TaskLike;
  list(workspaceId: string): readonly TaskLike[];
}

interface OrderDataServiceLike {
  configure(
    workspaceId: string,
    actorUserId: string,
    input: {
      readonly mode: "demo";
      readonly transport: "mcp";
      readonly mcpAssetId: string;
      readonly mcpToolName: string;
    },
  ): Promise<unknown>;
  status(workspaceId: string): {
    readonly config: {
      readonly mcpAssetId?: string | undefined;
      readonly mcpToolName?: string | undefined;
    };
  };
  workbenchMetric(input: {
    readonly workspaceId: string;
    readonly actor: {
      readonly userId: string;
      readonly name?: string | undefined;
      readonly workspaceRole: "owner" | "member" | "guest";
    };
    readonly asOf?: Date | undefined;
  }): ReturnType<WorkbenchDataMetricProvider["workbenchMetric"]>;
}

interface DemoContext {
  storageDomain: {
    open(spec: typeof demoDomainSpec): Promise<{
      table(name: "task_receipts"): {
        get(key: string): DemoTaskReceipt | undefined;
        put(key: string, value: DemoTaskReceipt): Promise<void>;
      };
      close(): Promise<void>;
    }>;
  };
  webServer: { register(route: WebRouteLike): unknown };
  effect(operation: () => () => void): void;
  provide(key: string, value: unknown): void;
  get?(key: string, strict?: boolean): unknown;
  root?: { get(key: string, strict?: boolean): unknown };
  inject?(
    keys: readonly string[],
    callback: (child: DemoContext) => void,
  ): { dispose(): void };
}

function lookup<T>(ctx: DemoContext, key: string): T | undefined {
  const direct = ctx.get?.(key, false);
  return (direct ?? ctx.root?.get(key, false)) as T | undefined;
}

function query(request: IncomingMessage): URLSearchParams {
  return new URL(request.url ?? "/", "http://dsh.invalid").searchParams;
}

function principalFor(
  request: IncomingMessage,
  team: TeamServiceLike,
): { readonly userId: string; readonly name: string } {
  if (
    request.headers.origin !== undefined &&
    !sameOrigin(request.headers.origin, request.headers.host)
  ) {
    throw new DemoActionError("forbidden", "same-origin request is required");
  }
  const token = bearerToken({
    get(name) {
      const value = request.headers[name.toLowerCase()];
      return Array.isArray(value) ? (value[0] ?? null) : (value ?? null);
    },
  });
  if (token === undefined) {
    throw new DemoActionError("forbidden", "bearer token is required");
  }
  const principal = team.resolveToken(token);
  if (principal === undefined) {
    throw new DemoActionError("forbidden", "invalid or expired token");
  }
  const user = team.users().find((candidate) => candidate.id === principal.userId);
  return {
    userId: principal.userId,
    name: user?.name ?? principal.userId,
  };
}

function routeError(response: ServerResponse, cause: unknown): void {
  if (cause instanceof DemoActionError) {
    const status =
      cause.code === "invalid_input"
        ? 400
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
      message: cause instanceof Error ? cause.message : "Demo 操作失败",
    },
  });
}

function createRoutes(
  service: DemoTaskActionService,
  ctx: DemoContext,
): readonly WebRouteLike[] {
  const team = (): TeamServiceLike => {
    const value = lookup<TeamServiceLike>(ctx, "collabTeam");
    if (value === undefined) {
      throw new DemoActionError("unavailable", "协作身份服务不可用");
    }
    return value;
  };
  return [
    {
      kind: "exact",
      path: "/api/collab/demo-phone-tablet-order/task-action",
      handler: async (request, response) => {
        try {
          if (request.method !== "GET") {
            throw new DemoActionError("invalid_input", "method not allowed");
          }
          const actor = principalFor(request, team());
          const taskId = query(request).get("taskId") ?? "";
          const state = await service.getState(actor, taskId);
          sendJson(response, 200, { ok: true, ...state });
        } catch (cause) {
          routeError(response, cause);
        }
      },
    },
    {
      kind: "exact",
      path: "/api/collab/demo-phone-tablet-order/task-action/confirm",
      handler: async (request, response) => {
        try {
          if (request.method !== "POST") {
            throw new DemoActionError("invalid_input", "method not allowed");
          }
          const actor = principalFor(request, team());
          const parsed = z
            .object({ taskId: z.string().trim().min(1).max(200) })
            .safeParse(await readJsonBody(request));
          if (!parsed.success) {
            throw new DemoActionError("invalid_input", "taskId is required");
          }
          const result = await service.confirm(actor, parsed.data.taskId);
          sendJson(response, 200, { ok: true, ...result });
        } catch (cause) {
          routeError(response, cause);
        }
      },
    },
  ];
}

async function configureDemoWorkspace(ctx: DemoContext): Promise<void> {
  const workspaces = lookup<WorkspaceRegistryLike>(ctx, "workspaceRegistry");
  const orders = lookup<OrderDataServiceLike>(ctx, "collabDataOrders");
  if (workspaces === undefined || orders === undefined) return;
  const workspace = workspaces
    .list()
    .find((item) => item.title?.trim() === DEMO_WORKSPACE_TITLE);
  if (workspace === undefined) return;
  const status = orders.status(workspace.id);
  if (
    status.config.mcpAssetId === DEMO_OMS_MCP_ID &&
    status.config.mcpToolName === "orders_query"
  ) {
    return;
  }
  await orders.configure(workspace.id, DEMO_PLUGIN_ID, {
    mode: "demo",
    transport: "mcp",
    mcpAssetId: DEMO_OMS_MCP_ID,
    mcpToolName: "orders_query",
  });
}

function displayProfile(
  ctx: DemoContext,
  snapshotAt: Date,
): WorkbenchDisplayProfile {
  return {
    id: DEMO_PROFILE_ID,
    title: "手机/平板订单履约",
    matches: (workspace) =>
      workspace.title?.trim() === DEMO_WORKSPACE_TITLE,
    visibleModules: [
      "metrics",
      "brief",
      "todo",
      "focus",
    ] satisfies ModuleId[],
    metrics: [
      "otif",
      "inventory-turn",
      "supplier-otd",
      "price-achievement",
    ],
    metric: async (input) => {
      const orders = lookup<OrderDataServiceLike>(ctx, "collabDataOrders");
      if (orders === undefined) {
        throw new DemoActionError("unavailable", "订单服务不可用");
      }
      const metric = await orders.workbenchMetric({
        ...input,
        asOf: snapshotAt,
      });
      return metric;
    },
    prepare: async () => {
      await configureDemoWorkspace(ctx);
    },
    brief: async ({ workspace }) => {
      const tasks = lookup<TaskServiceLike>(ctx, "collabTasks");
      const parent = tasks
        ?.list(workspace.id)
        .find((task) => task.title.includes("[PT-ORD-001]"));
      return {
        title: "每日简报",
        summary:
          "华东手机/平板订单异常率升至 7.6%，异常 126 单，预计影响金额约 64.3 万元。请 Data Agent 完成初步判断，并由订单履约计划员跟进支付失败、取消和履约超时。",
        items: [
          {
            id: "east-phone-tablet-order-exception",
            title: "华东手机/平板订单异常",
            body: "支付失败 52 单、取消 31 单、履约超时 43 单；异常集中在数码成品订单。",
            statusLabel: "待评估",
            actionLabel: "询问 Data Agent",
            ...(parent === undefined
              ? {}
              : {
                  deepLink: {
                    route: "task" as const,
                    refId: parent.id,
                    workspaceId: workspace.id,
                    label: parent.title,
                  },
                }),
          },
          {
            id: "finished-goods-rebalance-decision",
            title: "是否需要创建成品仓订单再平衡工单",
            body: "需要先核实 SKU、IMEI/SN、库存归属和跨仓交接约束。",
            statusLabel: "待确认",
            actionLabel: "查看任务",
            ...(parent === undefined
              ? {}
              : {
                  deepLink: {
                    route: "task" as const,
                    refId: parent.id,
                    workspaceId: workspace.id,
                    label: parent.title,
                  },
                }),
          },
        ],
      };
    },
  };
}

function demoSnapshotNow(): Date {
  const configured = process.env.DEMO_ORDERS_AS_OF?.trim();
  if (configured !== undefined && configured !== "") {
    const parsed = new Date(configured);
    if (!Number.isFinite(parsed.getTime())) {
      throw new Error("DEMO_ORDERS_AS_OF must be an ISO-8601 datetime");
    }
    return parsed;
  }
  const china = new Date(Date.now() + 8 * 60 * 60 * 1000);
  return new Date(
    Date.UTC(
      china.getUTCFullYear(),
      china.getUTCMonth(),
      china.getUTCDate(),
      2,
      5,
    ),
  );
}

async function generateRuntimeFixture(): Promise<{
  readonly path: string;
  readonly snapshotAt: Date;
}> {
  const directory =
    process.env.DEMO_ORDERS_RUNTIME_DIR?.trim() ||
    join(process.cwd(), ".tmp", "dsh-phone-tablet-demo");
  await mkdir(directory, { recursive: true });
  const output = join(directory, "orders-fixture-runtime.json");
  const snapshotAt = demoSnapshotNow();
  const generator = fileURLToPath(
    new URL("../scripts/generate-orders-fixture.mjs", import.meta.url),
  );
  await execFileAsync(
    process.execPath,
    [generator, "--out", output, "--now", snapshotAt.toISOString()],
    { timeout: 15_000 },
  );
  const fixture = JSON.parse(await readFile(output, "utf8")) as {
    readonly snapshotAt?: unknown;
  };
  return {
    path: output,
    snapshotAt:
      typeof fixture.snapshotAt === "string" &&
      Number.isFinite(Date.parse(fixture.snapshotAt))
        ? new Date(fixture.snapshotAt)
        : snapshotAt,
  };
}

export async function apply(ctx: DemoContext): Promise<void> {
  if (process.env[DEMO_FEATURE_FLAG] !== "1") {
    console.info(`${name}: skipped because ${DEMO_FEATURE_FLAG} is not 1`);
    return;
  }
  const domain = await ctx.storageDomain.open(demoDomainSpec);
  const receiptTable = domain.table("task_receipts");
  const runtimeFixture = await generateRuntimeFixture();
  const mcpProvider = new DemoPhoneTabletMcpProvider(runtimeFixture.path);
  let disposeRegistryProvider: (() => void) | undefined;
  let disposeDisplayProfile: (() => void) | undefined;
  const registryFiber = ctx.inject?.(
    ["collabMcpProviderRegistry"],
    (child) => {
      const registry = lookup<McpProviderRegistry>(
        child,
        "collabMcpProviderRegistry",
      );
      if (registry === undefined) return;
      disposeRegistryProvider = registry.register(
        mcpProvider as McpToolProvider,
      );
    },
  );
  const requestedProfile =
    process.env.PLUGINMAX_WORKBENCH_DEMO_PROFILE?.trim() ?? "";
  const workbenchFiber =
    requestedProfile !== "" && requestedProfile !== DEMO_PROFILE_ID
      ? undefined
      : ctx.inject?.(["collabWorkbench"], (child) => {
          const workbench = lookup<WorkbenchService>(child, "collabWorkbench");
          if (workbench === undefined) return;
          disposeDisplayProfile = workbench.registerDisplayProfile(
            displayProfile(ctx, runtimeFixture.snapshotAt),
          );
        });
  const dataOrdersFiber = ctx.inject?.(
    ["collabDataOrders", "workspaceRegistry"],
    () => {
      void configureDemoWorkspace(ctx).catch((cause) => {
        console.warn(`${name}: could not configure demo orders`, cause);
      });
    },
  );
  const draft = await loadDemoDraft();
  const action = new DemoTaskActionService({
    registry: () =>
      lookup<McpProviderRegistry>(ctx, "collabMcpProviderRegistry"),
    tasks: () => {
      const tasks = lookup<TaskServiceLike>(ctx, "collabTasks");
      if (tasks === undefined) {
        throw new DemoActionError("unavailable", "任务服务不可用");
      }
      return tasks;
    },
    workspaces: () => {
      const workspaces = lookup<WorkspaceRegistryLike>(
        ctx,
        "workspaceRegistry",
      );
      if (workspaces === undefined) {
        throw new DemoActionError("unavailable", "工作区服务不可用");
      }
      return workspaces;
    },
    workspaceMembers: (workspaceId) => {
      const team = lookup<TeamServiceLike>(ctx, "collabTeam");
      if (team === undefined) {
        throw new DemoActionError("unavailable", "协作身份服务不可用");
      }
      return team.members(workspaceId);
    },
    receipts: receiptTable,
    draft,
  });
  ctx.provide("collabDemoPhoneTabletOrder", action);
  ctx.effect(() => {
    const disposers = createRoutes(action, ctx).map(
      (route) => ctx.webServer.register(route) as () => void,
    );
    return () => {
      for (const dispose of disposers) dispose();
    };
  });
  ctx.effect(() => () => {
    disposeDisplayProfile?.();
    workbenchFiber?.dispose();
    disposeRegistryProvider?.();
    registryFiber?.dispose();
    dataOrdersFiber?.dispose();
    void mcpProvider.dispose();
    void domain.close();
  });
}
