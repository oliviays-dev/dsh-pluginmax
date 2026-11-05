import type { McpProviderRegistry } from "dsh-collab-resource-market";
import {
  DEMO_ACTION_TICKET_ID,
  DEMO_APPROVER_NAME,
  DEMO_APPROVER_USER_ID,
  DEMO_CONSUMER_ID,
  DEMO_IDEMPOTENCY_KEY,
  DEMO_WMS_MCP_ID,
  DEMO_WORK_ORDER_ID,
  DEMO_WORKSPACE_TITLE,
  demoActionTicketClaimsSchema,
  signActionTicket,
  type DemoActionTicketClaims,
  type DemoTaskReceipt,
} from "./models.js";

export interface DemoTaskRecordLike {
  readonly id: string;
  readonly workspaceId: string;
  readonly title: string;
  readonly description?: string | undefined;
}

export interface DemoWorkspaceLike {
  readonly id: string;
  readonly path: string;
  readonly title?: string | undefined;
}

export interface DemoActionDeps {
  readonly registry: () => McpProviderRegistry | undefined;
  readonly tasks: () => {
    get(taskId: string): DemoTaskRecordLike;
  };
  readonly workspaces: () => {
    get(workspaceId: string): DemoWorkspaceLike | undefined;
  };
  readonly workspaceMembers: (
    workspaceId: string,
  ) => readonly { readonly userId: string }[];
  readonly receipts: {
    get(key: string): DemoTaskReceipt | undefined;
    put(key: string, value: DemoTaskReceipt): Promise<void>;
  };
  readonly now?: () => Date;
  readonly draft: Record<string, unknown>;
}

export type DemoActionErrorCode =
  | "invalid_input"
  | "forbidden"
  | "not_found"
  | "unavailable";

export class DemoActionError extends Error {
  constructor(
    readonly code: DemoActionErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "DemoActionError";
  }
}

function record(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

export class DemoTaskActionService {
  constructor(private readonly deps: DemoActionDeps) {}

  private now(): Date {
    return this.deps.now?.() ?? new Date();
  }

  private receiptKey(taskId: string): string {
    return `task\u0000${taskId}`;
  }

  private taskContext(taskId: string): {
    readonly task: DemoTaskRecordLike;
    readonly workspace: DemoWorkspaceLike;
  } {
    let task: DemoTaskRecordLike;
    try {
      task = this.deps.tasks().get(taskId);
    } catch {
      throw new DemoActionError("not_found", "任务不存在");
    }
    if (!task.title.includes("[PT-ORD-001-B]")) {
      throw new DemoActionError("not_found", "当前任务没有 Demo 业务动作");
    }
    const workspace = this.deps.workspaces().get(task.workspaceId);
    if (
      workspace === undefined ||
      workspace.title?.trim() !== DEMO_WORKSPACE_TITLE
    ) {
      throw new DemoActionError(
        "forbidden",
        "Demo 业务动作只允许在指定工作区执行",
      );
    }
    return { task, workspace };
  }

  private draftView(): Record<string, unknown> {
    const draft = record(this.deps.draft.draft) ?? {};
    const scope = record(draft.scope) ?? {};
    const change = record(draft.fulfillmentChange) ?? {};
    const delivery = record(draft.deliveryConstraints) ?? {};
    return {
      title: typeof draft.title === "string" ? draft.title : "成品仓订单再平衡",
      status: "draft",
      statusLabel: "草稿",
      orderCount:
        typeof scope.orderCount === "number" ? scope.orderCount : 0,
      orderAmount:
        typeof scope.orderAmount === "number" ? scope.orderAmount : 0,
      orderIds: stringArray(scope.orderIds),
      sourceWarehouse:
        typeof change.sourceWarehouse === "string" ? change.sourceWarehouse : "",
      targetWarehouse:
        typeof change.targetWarehouse === "string" ? change.targetWarehouse : "",
      cutoff: typeof change.cutoff === "string" ? change.cutoff : "",
      skuScope: stringArray(change.skuScope),
      serialBindingRequired: change.serialBindingRequired !== false,
      inventoryOwnershipChangeRequired:
        change.inventoryOwnershipChangeRequired !== false,
      insuredTransport: delivery.insuredTransport !== false,
      identityVerifiedSignature: delivery.identityVerifiedSignature !== false,
      approval: record(draft.approval) ?? {},
    };
  }

  private assertWorkspaceMember(userId: string, workspaceId: string): void {
    if (
      !this.deps
        .workspaceMembers(workspaceId)
        .some((member) => member.userId === userId)
    ) {
      throw new DemoActionError("forbidden", "当前用户不在该工作区");
    }
  }

  async getState(
    actor: { readonly userId: string },
    taskId: string,
  ): Promise<{
    readonly action: Record<string, unknown>;
    readonly receipt: DemoTaskReceipt | null;
    readonly wms: Record<string, unknown>;
  }> {
    const { task, workspace } = this.taskContext(taskId);
    this.assertWorkspaceMember(actor.userId, workspace.id);
    const receipt = this.deps.receipts.get(this.receiptKey(task.id)) ?? null;
    let wms: Record<string, unknown> = {
      status: "unknown",
      message: "Mock WMS 尚未连接",
    };
    if (receipt !== null) {
      try {
        const registry = this.requireRegistry();
        const workOrder = await registry.callTool({
          userId: actor.userId,
          mcpId: DEMO_WMS_MCP_ID,
          toolName: "wms_rebalance_work_order_get",
          arguments: { workOrderId: receipt.workOrderId },
        });
        wms = {
          status: "recovered",
          workOrder,
        };
      } catch (cause) {
        wms = {
          status: "unavailable",
          message:
            cause instanceof Error
              ? cause.message
              : "Mock WMS 工单暂时不可读取",
        };
      }
    }
    return {
      action: {
        ...this.draftView(),
        actionTicketId: DEMO_ACTION_TICKET_ID,
        approverUserId: DEMO_APPROVER_USER_ID,
        approverName: DEMO_APPROVER_NAME,
        taskId: task.id,
        workspaceId: task.workspaceId,
      },
      receipt,
      wms,
    };
  }

  async confirm(
    actor: {
      readonly userId: string;
      readonly name: string;
    },
    taskId: string,
  ): Promise<{
    readonly receipt: DemoTaskReceipt;
    readonly workOrder: Record<string, unknown>;
    readonly idempotent: boolean;
  }> {
    if (actor.userId !== DEMO_APPROVER_USER_ID) {
      throw new DemoActionError(
        "forbidden",
        `仅 ${DEMO_APPROVER_NAME} 可以确认并创建业务工单`,
      );
    }
    const { task, workspace } = this.taskContext(taskId);
    this.assertWorkspaceMember(actor.userId, workspace.id);
    const existing = this.deps.receipts.get(this.receiptKey(task.id));
    if (existing !== undefined) {
      return {
        receipt: existing,
        workOrder: {
          workOrderId: existing.workOrderId,
          status: "created",
          source: "task_receipt",
        },
        idempotent: true,
      };
    }
    const now = this.now();
    const claims: DemoActionTicketClaims = demoActionTicketClaimsSchema.parse({
      id: DEMO_ACTION_TICKET_ID,
      workspaceId: workspace.id,
      taskId: task.id,
      mcpId: DEMO_WMS_MCP_ID,
      toolName: "wms_rebalance_work_order_create",
      consumerId: DEMO_CONSUMER_ID,
      confirmedByUserId: actor.userId,
      confirmedByName: actor.name,
      issuedAt: now.toISOString(),
      expiresAt: new Date(now.getTime() + 5 * 60_000).toISOString(),
    });
    const signature = signActionTicket(claims);
    const draft = this.draftView();
    const registry = this.requireRegistry();
    let workOrder: Record<string, unknown>;
    try {
      workOrder = await registry.callTool({
        userId: actor.userId,
        mcpId: DEMO_WMS_MCP_ID,
        toolName: "wms_rebalance_work_order_create",
        arguments: {
          idempotencyKey: DEMO_IDEMPOTENCY_KEY,
          actionTicketId: claims.id,
          actionTicket: claims,
          actionTicketSignature: signature,
          humanConfirmed: true,
          confirmedBy: actor.name,
          confirmedByUserId: actor.userId,
          consumerId: DEMO_CONSUMER_ID,
          taskId: task.id,
          workspaceId: workspace.id,
          orderIds: draft.orderIds,
          sourceWarehouse: draft.sourceWarehouse,
          targetWarehouse: draft.targetWarehouse,
          cutoff: draft.cutoff,
          skuScope: draft.skuScope,
          serialBindingRequired: draft.serialBindingRequired,
          inventoryOwnershipChangeRequired:
            draft.inventoryOwnershipChangeRequired,
          insuredTransport: draft.insuredTransport,
          identityVerifiedSignature: draft.identityVerifiedSignature,
        },
      });
    } catch (cause) {
      throw new DemoActionError(
        "unavailable",
        cause instanceof Error ? cause.message : "Mock WMS MCP 调用失败",
      );
    }
    if (workOrder.workOrderId !== DEMO_WORK_ORDER_ID) {
      throw new DemoActionError(
        "unavailable",
        "Mock WMS 返回了不符合 Demo 契约的工单号",
      );
    }
    const receipt: DemoTaskReceipt = {
      taskId: task.id,
      workspaceId: workspace.id,
      workOrderId: DEMO_WORK_ORDER_ID,
      actionTicketId: claims.id,
      idempotencyKey: DEMO_IDEMPOTENCY_KEY,
      confirmedByName: actor.name,
      operatorName: "履约 AI 伙伴",
      createdAt: now.toISOString(),
      source: "mcp",
      production: false,
    };
    await this.deps.receipts.put(this.receiptKey(task.id), receipt);
    return { receipt, workOrder, idempotent: false };
  }

  private requireRegistry(): McpProviderRegistry {
    const registry = this.deps.registry();
    if (registry === undefined) {
      throw new DemoActionError("unavailable", "MCP Provider 注册表不可用");
    }
    return registry;
  }
}
