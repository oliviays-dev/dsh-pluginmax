import { createHash } from "node:crypto";
import {
  planningTriggerReceiptSchema,
  type PlanningTrigger,
  type PlanningTriggerReceipt,
} from "./models.js";
import { triggerEventKey, triggerIdentity } from "./trigger-policy.js";

export interface PlanningReceiptTable {
  get(key: string): PlanningTriggerReceipt | undefined;
  entries(): IterableIterator<[string, PlanningTriggerReceipt]>;
  put(key: string, value: PlanningTriggerReceipt): Promise<void>;
}

export interface CreatePlanningReceiptInput {
  readonly workspaceId: string;
  readonly rootTaskId: string;
  readonly taskRevision: string;
  readonly trigger: PlanningTrigger;
  readonly eventKey?: string | undefined;
  readonly taskDefinitionDigest?: string | undefined;
}

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export class PlanningReceiptStore {
  constructor(
    private readonly table: PlanningReceiptTable,
    private readonly now: () => string,
  ) {}

  private values(): PlanningTriggerReceipt[] {
    return [...this.table.entries()].map(([, receipt]) =>
      planningTriggerReceiptSchema.parse(receipt),
    );
  }

  idFor(input: CreatePlanningReceiptInput): string {
    const triggerKey = triggerIdentity(input.trigger);
    return `planning-receipt-${sha256(
      [
        input.workspaceId,
        input.rootTaskId,
        input.taskRevision,
        triggerKey,
        input.eventKey ?? input.taskDefinitionDigest ?? "",
      ].join(":"),
    ).slice(0, 32)}`;
  }

  get(receiptId: string): PlanningTriggerReceipt | undefined {
    const receipt = this.table.get(receiptId);
    return receipt === undefined
      ? undefined
      : planningTriggerReceiptSchema.parse(receipt);
  }

  async createOrGet(input: CreatePlanningReceiptInput): Promise<{
    readonly receipt: PlanningTriggerReceipt;
    readonly created: boolean;
  }> {
    const id = this.idFor(input);
    const existing = this.table.get(id);
    if (existing !== undefined) {
      return {
        receipt: planningTriggerReceiptSchema.parse(existing),
        created: false,
      };
    }
    const eventKey =
      input.eventKey ??
      triggerEventKey({
        trigger: input.trigger,
        taskRevision: input.taskRevision,
        ...(input.taskDefinitionDigest === undefined
          ? {}
          : { taskDefinitionDigest: input.taskDefinitionDigest }),
      });
    const at = this.now();
    const receipt = planningTriggerReceiptSchema.parse({
      id,
      workspaceId: input.workspaceId,
      rootTaskId: input.rootTaskId,
      taskRevision: input.taskRevision,
      eventKey,
      triggerKey: triggerIdentity(input.trigger),
      trigger: input.trigger,
      status: "pending",
      createdAt: at,
      updatedAt: at,
    });
    await this.table.put(receipt.id, receipt);
    return { receipt, created: true };
  }

  pendingForRoot(
    workspaceId: string,
    rootTaskId: string,
  ): PlanningTriggerReceipt[] {
    return this.values()
      .filter(
        (receipt) =>
          receipt.workspaceId === workspaceId &&
          receipt.rootTaskId === rootTaskId &&
          receipt.status === "pending",
      )
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  }

  latestDiscardedForRoot(
    workspaceId: string,
    rootTaskId: string,
  ): PlanningTriggerReceipt | undefined {
    return this.values()
      .filter(
        (receipt) =>
          receipt.workspaceId === workspaceId &&
          receipt.rootTaskId === rootTaskId &&
          receipt.status === "discarded",
      )
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))[0];
  }

  async consume(
    receiptId: string,
    runId: string,
  ): Promise<PlanningTriggerReceipt> {
    const receipt = this.get(receiptId);
    if (receipt === undefined) {
      throw new Error(`planning receipt not found: ${receiptId}`);
    }
    if (receipt.status === "consumed") {
      return receipt;
    }
    const next = planningTriggerReceiptSchema.parse({
      ...receipt,
      status: "consumed",
      consumedByRunId: runId,
      discardedReason: undefined,
      updatedAt: this.now(),
    });
    await this.table.put(next.id, next);
    return next;
  }

  async discard(
    receiptId: string,
    reason: string,
  ): Promise<PlanningTriggerReceipt> {
    const receipt = this.get(receiptId);
    if (receipt === undefined) {
      throw new Error(`planning receipt not found: ${receiptId}`);
    }
    if (receipt.status === "consumed") return receipt;
    const next = planningTriggerReceiptSchema.parse({
      ...receipt,
      status: "discarded",
      discardedReason: reason,
      updatedAt: this.now(),
    });
    await this.table.put(next.id, next);
    return next;
  }
}
