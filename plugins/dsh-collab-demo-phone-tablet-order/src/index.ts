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
import { parse as parseYaml } from "yaml";
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
  DEMO_WMS_MCP_ID,
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
  ): readonly {
    readonly userId: string;
    readonly memberRole?: "owner" | "member" | "guest" | undefined;
  }[];
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

export function isDemoWorkspace(workspace: WorkspaceLike): boolean {
  return workspace.title?.trim().endsWith(DEMO_WORKSPACE_TITLE) === true;
}

const workbenchProfileSchema = z.object({
  metrics: z.object({
    selected: z.array(z.string().trim().min(1)).min(1),
  }),
});

export async function loadDemoWorkbenchMetricIds(): Promise<
  readonly string[]
> {
  const source = await readFile(
    new URL("../config/workbench-profile.yaml", import.meta.url),
    "utf8",
  );
  return workbenchProfileSchema.parse(parseYaml(source)).metrics.selected;
}

interface TaskLike {
  readonly id: string;
  readonly workspaceId: string;
  readonly title: string;
}

interface TaskServiceLike {
  get(taskId: string): TaskLike;
  list(workspaceId: string): readonly TaskLike[];
  create(
    actor: {
      readonly id: string;
      readonly name: string;
      readonly kind: "human";
      readonly role?: "admin" | "owner" | "member" | "guest" | undefined;
    },
    input: {
      readonly workspaceId: string;
      readonly title: string;
      readonly type: string;
      readonly priority: "P1" | "P2" | "P3";
      readonly status: "todo";
      readonly receiverType: "human";
      readonly receiverId: string;
      readonly receiverName: string;
      readonly description: string;
      readonly acceptance: readonly string[];
      readonly due?: string | undefined;
      readonly links: readonly never[];
      readonly autoSubmitReview: boolean;
    },
  ): Promise<TaskLike>;
}

interface DemoOrderExceptionSummary {
  readonly orderCount: number;
  readonly exceptionCount: number;
  readonly exceptionRate: number;
  readonly paymentFailureCount: number;
  readonly cancelledCount: number;
  readonly fulfillmentTimeoutCount: number;
  readonly snapshotAt: string;
}

export async function loadDemoOrderExceptionSummary(
  fixturePath: string,
): Promise<DemoOrderExceptionSummary> {
  const fixture = JSON.parse(await readFile(fixturePath, "utf8")) as {
    readonly snapshotAt?: unknown;
    readonly expected?: Record<string, unknown>;
  };
  const expected = fixture.expected ?? {};
  const number = (key: string): number => {
    const value = Number(expected[key]);
    if (!Number.isFinite(value)) {
      throw new Error(`Demo order fixture is missing expected.${key}`);
    }
    return value;
  };
  return {
    orderCount: number("orderCount"),
    exceptionCount: number("exceptionCount"),
    exceptionRate: number("exceptionRate"),
    paymentFailureCount: number("paymentFailureCount"),
    cancelledCount: number("cancelledCount"),
    fulfillmentTimeoutCount: number("fulfillmentTimeoutCount"),
    snapshotAt:
      typeof fixture.snapshotAt === "string"
        ? fixture.snapshotAt
        : new Date(0).toISOString(),
  };
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

interface ResourceMarketServiceLike {
  mcps(principal: { readonly userId: string }): Promise<unknown>;
  connectMcp(principal: string, mcpId: string): Promise<unknown>;
}

interface WorkbenchV2PanelLike {
  readonly id: string;
  readonly pluginId: string;
  readonly pluginVersion: string;
  readonly title?: string | undefined;
  readonly span: 1 | 2 | 3 | 4 | 5 | 6;
  readonly order: number;
  readonly height?: number | null | undefined;
  readonly config: Readonly<Record<string, unknown>>;
  readonly visibilityCondition?: Readonly<{
    readonly workspaceIds?: readonly string[] | undefined;
    readonly projectIds?: readonly string[] | undefined;
    readonly roles?: readonly string[] | undefined;
  }>;
}

interface WorkbenchV2RecordLike {
  readonly id: string;
  readonly revision: number;
  readonly panels: readonly WorkbenchV2PanelLike[];
}

interface WorkbenchV2ServiceLike {
  list(principal: {
    readonly userId: string;
    readonly role?: "admin" | "owner" | "member" | "guest" | undefined;
  }): Promise<{
    readonly workbenches: readonly WorkbenchV2RecordLike[];
    readonly preference: {
      readonly activeWorkbenchId?: string | undefined;
    };
  }>;
  saveDraft(
    principal: {
      readonly userId: string;
      readonly role?: "admin" | "owner" | "member" | "guest" | undefined;
    },
    input: {
      readonly workbenchId: string;
      readonly expectedRevision: number;
      readonly panels: readonly WorkbenchV2PanelLike[];
    },
  ): Promise<unknown>;
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

export async function configureDemoWorkspace(ctx: DemoContext): Promise<void> {
  const workspaces = lookup<WorkspaceRegistryLike>(ctx, "workspaceRegistry");
  const orders = lookup<OrderDataServiceLike>(ctx, "collabDataOrders");
  if (workspaces === undefined || orders === undefined) {
    throw new DemoActionError(
      "unavailable",
      "工作区或订单服务尚未就绪",
    );
  }
  const workspace = workspaces.list().find(isDemoWorkspace);
  if (workspace === undefined) return;
  const status = orders.status(workspace.id);
  if (
    status.config.mcpAssetId !== DEMO_OMS_MCP_ID ||
    status.config.mcpToolName !== "orders_query"
  ) {
    await orders.configure(workspace.id, DEMO_PLUGIN_ID, {
      mode: "demo",
      transport: "mcp",
      mcpAssetId: DEMO_OMS_MCP_ID,
      mcpToolName: "orders_query",
    });
  }
  await connectDemoMcpsForWorkspaceMembers(ctx, workspace.id);
}

/**
 * Demo MCPs are project-scoped resources. Resource Market connections are
 * tracked per user, so every demo workspace member must receive the same pair.
 */
export async function connectDemoMcpsForWorkspaceMembers(
  ctx: DemoContext,
  workspaceId: string,
): Promise<void> {
  const market = lookup<ResourceMarketServiceLike>(
    ctx,
    "collabResourceMarket",
  );
  const team = lookup<TeamServiceLike>(ctx, "collabTeam");
  if (market === undefined || team === undefined) return;
  const members = team.members(workspaceId).filter((member) => {
    const role = member.memberRole;
    return role === "owner" || role === "member";
  });
  const results = await Promise.allSettled(
    members.flatMap((member) =>
      [DEMO_OMS_MCP_ID, DEMO_WMS_MCP_ID].map((mcpId) =>
        market.connectMcp(member.userId, mcpId),
      ),
    ),
  );
  for (const result of results) {
    if (result.status === "rejected") {
      console.warn(`${name}: could not connect demo MCP`, result.reason);
    }
  }
}

const WORKBENCH_V2_DEMO_PANELS = [
  { pluginId: "pluginmax.daily-brief", span: 4 },
  { pluginId: "pluginmax.task-focus", span: 2 },
  { pluginId: "pluginmax.kpi-overview", span: 3 },
  { pluginId: "pluginmax.following", span: 3 },
] as const;

export async function configureDemoWorkbenchV2(
  ctx: DemoContext,
): Promise<void> {
  const service = lookup<WorkbenchV2ServiceLike>(ctx, "collabWorkbenchV2");
  const team = lookup<TeamServiceLike>(ctx, "collabTeam");
  const workspaces = lookup<WorkspaceRegistryLike>(ctx, "workspaceRegistry");
  if (service === undefined || team === undefined || workspaces === undefined) {
    return;
  }
  const workspace = workspaces.list().find(isDemoWorkspace);
  if (workspace === undefined) return;
  const members = team.members(workspace.id).filter(
    (member) =>
      member.memberRole === "owner" || member.memberRole === "member",
  );
  const results = await Promise.allSettled(
    members.map(async (member) => {
      const principal = {
        userId: member.userId,
        ...(member.memberRole === undefined
          ? {}
          : { role: member.memberRole }),
      };
      const listing = await service.list(principal);
      const active =
        listing.workbenches.find(
          (workbench) => workbench.id === listing.preference.activeWorkbenchId,
        ) ?? listing.workbenches[0];
      if (active === undefined) return;
      // Demo 只负责空工作台的初始脚手架。已有面板代表用户自己的布局，
      // 不能在指标刷新、profile prepare 或插件热更新时被固定模板覆盖。
      if (active.panels.length > 0) return;
      const panels = WORKBENCH_V2_DEMO_PANELS.map(
        ({ pluginId, span }, order) => {
          const existing = active.panels.find(
            (panel) => panel.pluginId === pluginId,
          );
          return {
            ...(existing ?? {
              id: `demo-${member.userId}-${pluginId}`,
              pluginId,
              pluginVersion: "1.0.0",
              config: {},
            }),
            span,
            order,
          } satisfies WorkbenchV2PanelLike;
        },
      );
      if (JSON.stringify(active.panels) === JSON.stringify(panels)) return;
      await service.saveDraft(principal, {
        workbenchId: active.id,
        expectedRevision: active.revision,
        panels,
      });
    }),
  );
  for (const result of results) {
    if (result.status === "rejected") {
      console.warn(`${name}: could not configure Demo workbench V2`, result.reason);
    }
  }
}

function displayProfile(
  ctx: DemoContext,
  snapshotAt: Date,
  metricIds: readonly string[],
  orderSummary: DemoOrderExceptionSummary,
): WorkbenchDisplayProfile {
  return {
    id: DEMO_PROFILE_ID,
    title: "手机/平板订单履约",
    matches: isDemoWorkspace,
    visibleModules: [
      "metrics",
      "brief",
      "todo",
      "focus",
    ] satisfies ModuleId[],
    metrics: metricIds,
    metric: async (input) => {
      const orders = lookup<OrderDataServiceLike>(ctx, "collabDataOrders");
      if (orders === undefined) {
        throw new DemoActionError("unavailable", "订单服务不可用");
      }
      await configureDemoWorkspace(ctx);
      const market = lookup<ResourceMarketServiceLike>(
        ctx,
        "collabResourceMarket",
      );
      await market?.mcps({ userId: input.actor.userId });
      const metric = await orders.workbenchMetric({
        ...input,
        asOf: snapshotAt,
      });
      return metric;
    },
    prepare: async () => {
      await configureDemoWorkspace(ctx);
    },
    brief: async ({ workspace, principal }) => {
      const tasks = lookup<TaskServiceLike>(ctx, "collabTasks");
      let parent = tasks
        ?.list(workspace.id)
        .find((task) => task.title.includes("[PT-ORD-001]"));
      if (parent === undefined && tasks !== undefined) {
        try {
          parent = await tasks.create(
            {
              id: principal.userId,
              name: principal.name ?? principal.userId,
              kind: "human",
              role: principal.role,
            },
            {
              workspaceId: workspace.id,
              title: "[PT-ORD-001] 华东手机/平板订单异常处置",
              type: "任务",
              priority: "P1",
              status: "todo",
              receiverType: "human",
              receiverId: principal.userId,
              receiverName: principal.name ?? principal.userId,
              description:
                "周宁，今天华东手机/平板订单异常率到了 7.6%，这块你来牵头处理。先让 Data Agent 把异常规模和主要构成看清楚，再找李工核实成品仓和履约条件。适合支付恢复、成品仓再平衡或订单改派的尽快推进；需要退款、取消或改约的，也要逐单给出明确结论。处理完把复盘报告放到这个任务里，我来 Review。",
              acceptance: [
                `${orderSummary.exceptionCount} 单全部形成明确处置结论`,
                "完成成品仓 SKU、IMEI/SN、库存与出库能力核实",
                "人工确认后通过 MCP 创建成品仓订单再平衡工单",
                "上传并核对订单问题排查和处理报告 HTML",
              ],
              due: "今天 18:00",
              links: [],
              autoSubmitReview: false,
            },
          );
        } catch {
          // Keep the brief available without fabricating a task target.
        }
      }
      const paymentRate =
        (orderSummary.paymentFailureCount / orderSummary.exceptionCount) * 100;
      const cancelRate =
        (orderSummary.cancelledCount / orderSummary.exceptionCount) * 100;
      const timeoutRate =
        (orderSummary.fulfillmentTimeoutCount / orderSummary.exceptionCount) *
        100;
      return {
        title: "每日简报",
        summary: `华东手机/平板订单异常率 ${orderSummary.exceptionRate.toFixed(1)}%，异常 ${orderSummary.exceptionCount} 单。请 Data Agent 基于 Mock OMS 订单快照完成初步判断。`,
        items: [
          {
            id: "east-phone-tablet-order-exception",
            title: "华东手机/平板订单异常",
            body: `支付失败 ${orderSummary.paymentFailureCount} 单（${paymentRate.toFixed(1)}%）、履约超时 ${orderSummary.fulfillmentTimeoutCount} 单（${timeoutRate.toFixed(1)}%）、取消 ${orderSummary.cancelledCount} 单（${cancelRate.toFixed(1)}%）。数据来自 Mock OMS 订单快照 ${orderSummary.snapshotAt}，共 ${orderSummary.orderCount} 单。`,
            statusLabel: "演示数据 · 待评估",
            actionLabel: "分析原因",
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
            body: `需要先核实 ${orderSummary.fulfillmentTimeoutCount} 单履约超时涉及的 SKU、IMEI/SN、库存归属和跨仓交接约束。`,
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
  const orderExceptionSummary = await loadDemoOrderExceptionSummary(
    runtimeFixture.path,
  );
  const workbenchMetricIds = await loadDemoWorkbenchMetricIds();
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
            displayProfile(
              ctx,
              runtimeFixture.snapshotAt,
              workbenchMetricIds,
              orderExceptionSummary,
            ),
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
  const workbenchV2Fiber = ctx.inject?.(
    ["collabWorkbenchV2", "collabTeam", "workspaceRegistry"],
    () => {
      void configureDemoWorkbenchV2(ctx).catch((cause) => {
        console.warn(`${name}: could not configure demo workbench`, cause);
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
    workbenchV2Fiber?.dispose();
    void mcpProvider.dispose();
    void domain.close();
  });
}
