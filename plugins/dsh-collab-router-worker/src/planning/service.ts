import { randomUUID } from "node:crypto";
import { z } from "zod";
import {
  factsLedgerSchema,
  isActivePlanningStatus,
  isTerminalPlanningStatus,
  planCriticReportSchema,
  planningEventSchema,
  planningKnowledgeReceiptSchema,
  planningModeSchema,
  planningQualityMetricSchema,
  planningRunSchema,
  planningSettingsSchema,
  planningSkillSnapshotSchema,
  planningTriggerSchema,
  requirementBriefSchema,
  type FactsLedger,
  type PlanCriticReport,
  type PlanningEvent,
  type PlanningKnowledgeReceipt,
  type PlanningMode,
  type PlanningQualityMetric,
  type PlanningRun,
  type PlanningSettings,
  type PlanningSkillSnapshot,
  type PlanningStatus,
  type PlanningTriggerReceipt,
  type RequirementBrief,
} from "./models.js";
import {
  PlanningReceiptStore,
  type PlanningReceiptTable,
} from "./receipt-store.js";

export interface PlanningTable<V> {
  get(key: string): V | undefined;
  entries(): IterableIterator<[string, V]>;
  put(key: string, value: V): Promise<void>;
}

export interface PlanningTables {
  readonly settings: PlanningTable<PlanningSettings>;
  readonly runs: PlanningTable<PlanningRun>;
  readonly receipts: PlanningReceiptTable;
  readonly requirementBriefs: PlanningTable<RequirementBrief>;
  readonly factsLedgers: PlanningTable<FactsLedger>;
  readonly criticReports: PlanningTable<PlanCriticReport>;
  readonly skillSnapshots: PlanningTable<PlanningSkillSnapshot>;
  readonly knowledgeReceipts: PlanningTable<PlanningKnowledgeReceipt>;
  readonly events: PlanningTable<PlanningEvent>;
  readonly qualityMetrics: PlanningTable<PlanningQualityMetric>;
}

export class PlanningError extends Error {
  constructor(
    readonly code:
      | "invalid_input"
      | "forbidden"
      | "not_found"
      | "conflict"
      | "planning_disabled"
      | "invalid_transition"
      | "revision_conflict"
      | "no_active_run",
    message: string,
  ) {
    super(message);
    this.name = "PlanningError";
  }
}

const PLANNING_TRANSITIONS: Record<PlanningStatus, readonly PlanningStatus[]> =
  {
    queued: ["preparing", "failed", "cancelled"],
    preparing: ["understanding", "failed", "cancelled"],
    understanding: ["clarifying", "drafting", "failed", "cancelled"],
    clarifying: ["preparing", "failed", "cancelled"],
    drafting: ["critiquing", "failed", "cancelled"],
    critiquing: ["drafting", "validating", "failed", "cancelled"],
    validating: [
      "drafting",
      "review_required",
      "succeeded",
      "failed",
      "cancelled",
    ],
    review_required: ["succeeded", "failed", "cancelled"],
    succeeded: [],
    failed: [],
    cancelled: [],
  };

const planningRequestInputSchema = z.object({
  workspaceId: z.string().trim().min(1).max(200),
  rootTaskId: z.string().trim().min(1).max(200),
  taskRevision: z.string().trim().min(1).max(80),
  trigger: planningTriggerSchema,
  mode: planningModeSchema.optional(),
  plannerAgentId: z.string().trim().min(1).max(240).optional(),
  eventKey: z.string().trim().min(1).max(500).optional(),
  taskDefinitionDigest: z.string().trim().min(1).max(500).optional(),
});

type PlanningRequestInput = z.infer<typeof planningRequestInputSchema>;

const requirementBriefInputSchema = requirementBriefSchema.omit({
  id: true,
  workspaceId: true,
  planningRunId: true,
  taskRevision: true,
  version: true,
  createdAt: true,
});
const factsLedgerInputSchema = factsLedgerSchema.omit({
  id: true,
  workspaceId: true,
  planningRunId: true,
  taskRevision: true,
  version: true,
  createdAt: true,
});
const planCriticInputSchema = planCriticReportSchema.omit({
  id: true,
  workspaceId: true,
  planningRunId: true,
  version: true,
  createdAt: true,
});
const skillSnapshotInputSchema = planningSkillSnapshotSchema.omit({
  id: true,
  workspaceId: true,
  planningRunId: true,
  createdAt: true,
});
const knowledgeReceiptInputSchema = planningKnowledgeReceiptSchema.omit({
  id: true,
  workspaceId: true,
  planningRunId: true,
  createdAt: true,
});
const qualityMetricInputSchema = planningQualityMetricSchema.omit({
  id: true,
  workspaceId: true,
  planningRunId: true,
  createdAt: true,
});

function nowIso(now: () => Date): string {
  return now().toISOString();
}

function parseOrInvalid<T>(schema: z.ZodType<T>, value: unknown): T {
  const parsed = schema.safeParse(value);
  if (!parsed.success) {
    throw new PlanningError("invalid_input", "planning input is invalid");
  }
  return parsed.data;
}

function terminalEventType(
  status: PlanningStatus,
): PlanningEvent["type"] | undefined {
  if (status === "succeeded") return "succeeded";
  if (status === "failed") return "failed";
  if (status === "cancelled") return "cancelled";
  if (status === "review_required") return "review-required";
  return undefined;
}

export interface PlanningTransitionOptions {
  readonly expectedRevision?: number | undefined;
  readonly expectedStatus?: PlanningStatus | undefined;
  readonly errorCode?: string | undefined;
  readonly error?: string | undefined;
  readonly cancelReason?: string | undefined;
  readonly patch?: PlanningRunPatch | undefined;
}

export interface PlanningRunPatch {
  readonly plannerTeammateId?: string | undefined;
  readonly plannerProfileId?: string | undefined;
  readonly plannerPrincipalId?: string | undefined;
  readonly contextPackId?: string | undefined;
  readonly contextReceiptId?: string | undefined;
  readonly runId?: string | undefined;
  readonly sessionId?: string | undefined;
  readonly criticContextPackId?: string | undefined;
  readonly criticContextReceiptId?: string | undefined;
  readonly criticRunId?: string | undefined;
  readonly criticSessionId?: string | undefined;
  readonly planId?: string | undefined;
  readonly planVersionId?: string | undefined;
  readonly skillSnapshotId?: string | undefined;
  readonly knowledgeReceiptId?: string | undefined;
}

export interface PlanningTransitionResult {
  readonly run: PlanningRun;
  readonly nextRun?: PlanningRun | undefined;
}

function mergeRunPatch(
  run: PlanningRun,
  patch: PlanningRunPatch | undefined,
): PlanningRun {
  if (patch === undefined) return run;
  return {
    ...run,
    ...(patch.plannerTeammateId === undefined
      ? {}
      : { plannerTeammateId: patch.plannerTeammateId }),
    ...(patch.plannerProfileId === undefined
      ? {}
      : { plannerProfileId: patch.plannerProfileId }),
    ...(patch.plannerPrincipalId === undefined
      ? {}
      : { plannerPrincipalId: patch.plannerPrincipalId }),
    ...(patch.contextPackId === undefined
      ? {}
      : { contextPackId: patch.contextPackId }),
    ...(patch.contextReceiptId === undefined
      ? {}
      : { contextReceiptId: patch.contextReceiptId }),
    ...(patch.runId === undefined ? {} : { runId: patch.runId }),
    ...(patch.sessionId === undefined ? {} : { sessionId: patch.sessionId }),
    ...(patch.criticContextPackId === undefined
      ? {}
      : { criticContextPackId: patch.criticContextPackId }),
    ...(patch.criticContextReceiptId === undefined
      ? {}
      : { criticContextReceiptId: patch.criticContextReceiptId }),
    ...(patch.criticRunId === undefined
      ? {}
      : { criticRunId: patch.criticRunId }),
    ...(patch.criticSessionId === undefined
      ? {}
      : { criticSessionId: patch.criticSessionId }),
    ...(patch.planId === undefined ? {} : { planId: patch.planId }),
    ...(patch.planVersionId === undefined
      ? {}
      : { planVersionId: patch.planVersionId }),
    ...(patch.skillSnapshotId === undefined
      ? {}
      : { skillSnapshotId: patch.skillSnapshotId }),
    ...(patch.knowledgeReceiptId === undefined
      ? {}
      : { knowledgeReceiptId: patch.knowledgeReceiptId }),
  };
}

export class PlanningService {
  private queue: Promise<void> = Promise.resolve();
  private readonly receipts: PlanningReceiptStore;

  constructor(
    private readonly tables: PlanningTables,
    private readonly options: {
      readonly now?: () => Date;
    } = {},
  ) {
    this.receipts = new PlanningReceiptStore(tables.receipts, () => this.now());
  }

  private enqueue<T>(operation: () => Promise<T>): Promise<T> {
    const result = this.queue.then(operation);
    this.queue = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  }

  private now(): string {
    return nowIso(this.options.now ?? (() => new Date()));
  }

  private values<V>(table: PlanningTable<V>): V[] {
    return [...table.entries()].map(([, value]) => value);
  }

  private defaultSettings(workspaceId: string): PlanningSettings {
    return planningSettingsSchema.parse({
      workspaceId,
      enabled: false,
      revision: 0,
      updatedBy: "system",
      updatedAt: "1970-01-01T00:00:00.000Z",
    });
  }

  settings(workspaceId: string): PlanningSettings {
    const stored = this.tables.settings.get(workspaceId);
    return stored === undefined
      ? this.defaultSettings(workspaceId)
      : planningSettingsSchema.parse(stored);
  }

  updateSettings(
    workspaceId: string,
    actorId: string,
    input: {
      readonly expectedRevision?: number | undefined;
      readonly enabled?: boolean | undefined;
      readonly defaultPlannerAgentId?: string | null | undefined;
      readonly agentOwnerPolicy?:
        | {
            readonly autoPlanOnAssignment?: boolean | undefined;
            readonly autoPlanOnSpecChange?: boolean | undefined;
            readonly requirePlanBeforeExecution?: boolean | undefined;
            readonly mode?: PlanningMode | undefined;
            readonly approval?: "manual" | "risk-based" | "auto" | undefined;
          }
        | undefined;
      readonly humanOwner?:
        | {
            readonly allowManualPlanning?: boolean | undefined;
            readonly defaultMode?: PlanningMode | undefined;
            readonly alwaysRequireReview?: boolean | undefined;
          }
        | undefined;
      readonly knowledgeProviderId?: string | null | undefined;
    },
  ): Promise<PlanningSettings> {
    return this.enqueue(async () => {
      const current = this.settings(workspaceId);
      if (
        input.expectedRevision !== undefined &&
        current.revision !== input.expectedRevision
      ) {
        throw new PlanningError(
          "revision_conflict",
          "planning settings revision changed",
        );
      }
      const defaultPlannerAgentId =
        input.defaultPlannerAgentId === undefined
          ? current.defaultPlannerAgentId
          : (input.defaultPlannerAgentId ?? undefined);
      const knowledgeProviderId =
        input.knowledgeProviderId === undefined
          ? current.knowledgeProviderId
          : (input.knowledgeProviderId ?? undefined);
      const next = planningSettingsSchema.parse({
        ...current,
        ...(input.enabled === undefined ? {} : { enabled: input.enabled }),
        ...(defaultPlannerAgentId === undefined
          ? {}
          : { defaultPlannerAgentId }),
        ...(knowledgeProviderId === undefined ? {} : { knowledgeProviderId }),
        agentOwnerPolicy: {
          ...current.agentOwnerPolicy,
          ...input.agentOwnerPolicy,
        },
        humanOwner: {
          ...current.humanOwner,
          ...input.humanOwner,
        },
        revision: current.revision + 1,
        updatedBy: actorId,
        updatedAt: this.now(),
      });
      await this.tables.settings.put(next.workspaceId, next);
      await this.appendEvent({
        workspaceId,
        rootTaskId: "*",
        type: "settings-updated",
        message: next.enabled
          ? "Planning Service 已启用"
          : "Planning Service 已关闭",
        detail: {
          enabled: String(next.enabled),
          revision: String(next.revision),
        },
      });
      return next;
    });
  }

  getRun(runId: string): PlanningRun {
    const run = this.tables.runs.get(runId);
    if (run === undefined) {
      throw new PlanningError("not_found", "Planning Run 不存在");
    }
    return planningRunSchema.parse(run);
  }

  findBySessionId(sessionId: string): PlanningRun | undefined {
    return this.values(this.tables.runs)
      .map((run) => planningRunSchema.parse(run))
      .filter(
        (run) =>
          (run.sessionId === sessionId || run.criticSessionId === sessionId) &&
          isActivePlanningStatus(run.status),
      )
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt))[0];
  }

  listRuns(input: {
    readonly workspaceId: string;
    readonly rootTaskId?: string | undefined;
    readonly limit?: number | undefined;
  }): PlanningRun[] {
    return this.values(this.tables.runs)
      .map((run) => planningRunSchema.parse(run))
      .filter(
        (run) =>
          run.workspaceId === input.workspaceId &&
          (input.rootTaskId === undefined ||
            run.rootTaskId === input.rootTaskId),
      )
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
      .slice(0, Math.max(1, Math.min(input.limit ?? 100, 500)));
  }

  activeRun(workspaceId: string, rootTaskId: string): PlanningRun | undefined {
    return this.values(this.tables.runs)
      .map((run) => planningRunSchema.parse(run))
      .filter(
        (run) =>
          run.workspaceId === workspaceId &&
          run.rootTaskId === rootTaskId &&
          isActivePlanningStatus(run.status),
      )
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt))[0];
  }

  latestRun(workspaceId: string, rootTaskId: string): PlanningRun | undefined {
    return this.listRuns({ workspaceId, rootTaskId, limit: 1 })[0];
  }

  receipt(receiptId: string): PlanningTriggerReceipt | undefined {
    return this.receipts.get(receiptId);
  }

  pendingReceipts(
    workspaceId: string,
    rootTaskId: string,
  ): PlanningTriggerReceipt[] {
    return this.receipts.pendingForRoot(workspaceId, rootTaskId);
  }

  async requestPlanningTrigger(input: PlanningRequestInput): Promise<{
    readonly run: PlanningRun;
    readonly receipt: PlanningTriggerReceipt;
    readonly joinedActive: boolean;
    readonly createdRun: boolean;
  }> {
    const parsed = parseOrInvalid(planningRequestInputSchema, input);
    return this.enqueue(async () => {
      const settings = this.settings(parsed.workspaceId);
      if (!settings.enabled) {
        throw new PlanningError(
          "planning_disabled",
          "Planning Service 当前未启用",
        );
      }
      if (
        parsed.trigger.kind === "human-manual" &&
        !settings.humanOwner.allowManualPlanning
      ) {
        throw new PlanningError(
          "planning_disabled",
          "当前 Workspace 不允许人工触发任务规划",
        );
      }
      const { receipt, created } = await this.receipts.createOrGet({
        workspaceId: parsed.workspaceId,
        rootTaskId: parsed.rootTaskId,
        taskRevision: parsed.taskRevision,
        trigger: parsed.trigger,
        ...(parsed.eventKey === undefined ? {} : { eventKey: parsed.eventKey }),
        ...(parsed.taskDefinitionDigest === undefined
          ? {}
          : { taskDefinitionDigest: parsed.taskDefinitionDigest }),
      });
      if (
        receipt.status === "consumed" &&
        receipt.consumedByRunId !== undefined
      ) {
        const existing = this.getRun(receipt.consumedByRunId);
        return {
          run: existing,
          receipt,
          joinedActive: isActivePlanningStatus(existing.status),
          createdRun: false,
        };
      }
      if (receipt.status === "discarded") {
        throw new PlanningError(
          "conflict",
          receipt.discardedReason === undefined
            ? "该 Planning trigger 已丢弃"
            : `该 Planning trigger 已丢弃：${receipt.discardedReason}`,
        );
      }
      const active = this.activeRun(parsed.workspaceId, parsed.rootTaskId);
      if (active !== undefined) {
        if (created) {
          await this.appendEvent({
            workspaceId: parsed.workspaceId,
            rootTaskId: parsed.rootTaskId,
            planningRunId: active.id,
            receiptId: receipt.id,
            type: "receipt-merged",
            message: "新的 Planning trigger 已合并到活动 Run",
            detail: { taskRevision: parsed.taskRevision },
          });
        }
        return {
          run: active,
          receipt,
          joinedActive: true,
          createdRun: false,
        };
      }
      const run = await this.createRunFromReceipt(receipt, settings, {
        ...(parsed.mode === undefined ? {} : { mode: parsed.mode }),
        ...(parsed.plannerAgentId === undefined
          ? {}
          : { plannerAgentId: parsed.plannerAgentId }),
      });
      return {
        run,
        receipt: this.receipts.get(receipt.id) ?? receipt,
        joinedActive: false,
        createdRun: true,
      };
    });
  }

  private async createRunFromReceipt(
    receipt: PlanningTriggerReceipt,
    settings: PlanningSettings,
    input: {
      readonly mode?: PlanningMode | undefined;
      readonly plannerAgentId?: string | undefined;
    },
  ): Promise<PlanningRun> {
    const at = this.now();
    const mode =
      input.mode ??
      (receipt.trigger.kind === "human-manual"
        ? settings.humanOwner.defaultMode
        : settings.agentOwnerPolicy.mode);
    const plannerAgentId =
      input.plannerAgentId ?? settings.defaultPlannerAgentId;
    const run = planningRunSchema.parse({
      id: `planning-run-${randomUUID()}`,
      workspaceId: receipt.workspaceId,
      rootTaskId: receipt.rootTaskId,
      taskRevision: receipt.taskRevision,
      trigger: receipt.trigger,
      eventKey: receipt.eventKey,
      receiptId: receipt.id,
      mode,
      status: "queued",
      ...(plannerAgentId === undefined ? {} : { plannerAgentId }),
      revision: 0,
      createdAt: at,
      updatedAt: at,
    });
    await this.tables.runs.put(run.id, run);
    await this.receipts.consume(receipt.id, run.id);
    await this.appendEvent({
      workspaceId: run.workspaceId,
      rootTaskId: run.rootTaskId,
      planningRunId: run.id,
      receiptId: receipt.id,
      type: "requested",
      status: run.status,
      message: "Planning Run 已创建",
      detail: {
        trigger: receipt.trigger.kind,
        mode,
        taskRevision: receipt.taskRevision,
      },
    });
    return run;
  }

  transition(
    runId: string,
    status: PlanningStatus,
    options: PlanningTransitionOptions = {},
  ): Promise<PlanningTransitionResult> {
    return this.enqueue(async () => {
      const current = this.getRun(runId);
      if (
        options.expectedRevision !== undefined &&
        current.revision !== options.expectedRevision
      ) {
        throw new PlanningError(
          "revision_conflict",
          "Planning Run revision changed",
        );
      }
      if (
        options.expectedStatus !== undefined &&
        current.status !== options.expectedStatus
      ) {
        throw new PlanningError(
          "conflict",
          `Planning Run 当前状态为 ${current.status}`,
        );
      }
      if (current.status === status) {
        return { run: current };
      }
      if (!PLANNING_TRANSITIONS[current.status].includes(status)) {
        throw new PlanningError(
          "invalid_transition",
          `Planning Run 不能从 ${current.status} 变更为 ${status}`,
        );
      }
      const at = this.now();
      const terminal = isTerminalPlanningStatus(status);
      const next = planningRunSchema.parse({
        ...mergeRunPatch(current, options.patch),
        status,
        revision: current.revision + 1,
        startedAt:
          current.startedAt ??
          (status === "preparing" || status === "understanding"
            ? at
            : current.startedAt),
        ...(terminal ? { finishedAt: at } : {}),
        ...(options.errorCode === undefined
          ? { errorCode: undefined }
          : { errorCode: options.errorCode }),
        ...(options.error === undefined ? {} : { error: options.error }),
        ...(options.cancelReason === undefined
          ? {}
          : { cancelReason: options.cancelReason }),
        updatedAt: at,
      });
      await this.tables.runs.put(next.id, next);
      const eventType = terminalEventType(status);
      await this.appendEvent({
        workspaceId: next.workspaceId,
        rootTaskId: next.rootTaskId,
        planningRunId: next.id,
        receiptId: next.receiptId,
        type: eventType ?? "phase-changed",
        status,
        message:
          eventType === undefined
            ? `Planning Run 进入 ${status}`
            : `Planning Run ${status}`,
        detail: {
          from: current.status,
          ...(next.errorCode === undefined
            ? {}
            : { errorCode: next.errorCode }),
        },
      });
      const nextRun = terminal
        ? await this.releasePendingReceipt(next)
        : undefined;
      return {
        run: next,
        ...(nextRun === undefined ? {} : { nextRun }),
      };
    });
  }

  async requireReview(
    runId: string,
    options: Omit<PlanningTransitionOptions, "error" | "errorCode"> = {},
  ): Promise<PlanningTransitionResult> {
    return this.transition(runId, "review_required", options);
  }

  async completeRun(
    runId: string,
    options: Omit<PlanningTransitionOptions, "error" | "errorCode"> = {},
  ): Promise<PlanningTransitionResult> {
    return this.transition(runId, "succeeded", options);
  }

  async failRun(
    runId: string,
    errorCode: string,
    error: string,
  ): Promise<PlanningTransitionResult> {
    const current = this.getRun(runId);
    if (current.status === "failed") return { run: current };
    if (isTerminalPlanningStatus(current.status)) {
      throw new PlanningError(
        "conflict",
        "Planning Run 已结束，不能再标记失败",
      );
    }
    return this.transition(runId, "failed", {
      expectedRevision: current.revision,
      errorCode,
      error,
    });
  }

  async cancelRun(
    runId: string,
    reason: string,
  ): Promise<PlanningTransitionResult> {
    const current = this.getRun(runId);
    if (current.status === "cancelled") return { run: current };
    if (isTerminalPlanningStatus(current.status)) {
      throw new PlanningError("conflict", "Planning Run 已结束，不能取消");
    }
    const result = await this.transition(runId, "cancelled", {
      expectedRevision: current.revision,
      cancelReason: reason,
    });
    for (const receipt of this.receipts.pendingForRoot(
      current.workspaceId,
      current.rootTaskId,
    )) {
      await this.receipts.discard(receipt.id, "Planning Run cancelled");
      await this.appendEvent({
        workspaceId: receipt.workspaceId,
        rootTaskId: receipt.rootTaskId,
        planningRunId: runId,
        receiptId: receipt.id,
        type: "receipt-discarded",
        message: "Planning Run 取消后丢弃待消费 trigger",
      });
    }
    return result;
  }

  private async releasePendingReceipt(
    finishedRun: PlanningRun,
  ): Promise<PlanningRun | undefined> {
    const pending = this.receipts.pendingForRoot(
      finishedRun.workspaceId,
      finishedRun.rootTaskId,
    );
    if (pending.length === 0) return undefined;
    const settings = this.settings(finishedRun.workspaceId);
    if (!settings.enabled || finishedRun.status === "cancelled") {
      for (const receipt of pending) {
        await this.receipts.discard(
          receipt.id,
          !settings.enabled
            ? "Planning Service disabled"
            : "Planning Run cancelled",
        );
        await this.appendEvent({
          workspaceId: receipt.workspaceId,
          rootTaskId: receipt.rootTaskId,
          planningRunId: finishedRun.id,
          receiptId: receipt.id,
          type: "receipt-discarded",
          message: "待消费 Planning trigger 已丢弃",
        });
      }
      return undefined;
    }
    const [latest, ...older] = pending;
    for (const receipt of older) {
      await this.receipts.discard(
        receipt.id,
        "A newer Planning trigger superseded this receipt",
      );
      await this.appendEvent({
        workspaceId: receipt.workspaceId,
        rootTaskId: receipt.rootTaskId,
        planningRunId: finishedRun.id,
        receiptId: receipt.id,
        type: "receipt-discarded",
        message: "较旧的 Planning trigger 已被新 receipt 合并",
      });
    }
    if (latest === undefined) return undefined;
    return this.createRunFromReceipt(latest, settings, {});
  }

  assertTaskRevision(runId: string, taskRevision: string): PlanningRun {
    const run = this.getRun(runId);
    if (run.taskRevision !== taskRevision) {
      throw new PlanningError(
        "revision_conflict",
        "任务内容已变化，规划输入 revision 已过期",
      );
    }
    return run;
  }

  updateRun(
    runId: string,
    patch: PlanningRunPatch,
    expectedRevision?: number | undefined,
  ): Promise<PlanningRun> {
    return this.enqueue(async () => {
      const current = this.getRun(runId);
      if (
        expectedRevision !== undefined &&
        current.revision !== expectedRevision
      ) {
        throw new PlanningError(
          "revision_conflict",
          "Planning Run revision changed",
        );
      }
      if (isTerminalPlanningStatus(current.status)) {
        throw new PlanningError(
          "conflict",
          "Planning Run 已结束，不能再更新运行信息",
        );
      }
      const next = planningRunSchema.parse({
        ...mergeRunPatch(current, patch),
        revision: current.revision + 1,
        updatedAt: this.now(),
      });
      await this.tables.runs.put(next.id, next);
      return next;
    });
  }

  saveRequirementBrief(
    runId: string,
    input: z.input<typeof requirementBriefInputSchema>,
  ): Promise<RequirementBrief> {
    return this.enqueue(async () => {
      const run = this.requireWritableRun(runId);
      const parsed = parseOrInvalid(requirementBriefInputSchema, input);
      const version = this.nextVersion(
        this.values(this.tables.requirementBriefs).filter(
          (brief) => brief.planningRunId === runId,
        ),
      );
      const at = this.now();
      const brief = requirementBriefSchema.parse({
        ...parsed,
        id: `planning-brief-${runId}-${version}`,
        workspaceId: run.workspaceId,
        planningRunId: runId,
        taskRevision: run.taskRevision,
        version,
        createdAt: at,
      });
      await this.tables.requirementBriefs.put(brief.id, brief);
      await this.appendArtifactEvent(run, "requirement-brief", brief.id);
      return brief;
    });
  }

  saveFactsLedger(
    runId: string,
    input: z.input<typeof factsLedgerInputSchema>,
  ): Promise<FactsLedger> {
    return this.enqueue(async () => {
      const run = this.requireWritableRun(runId);
      const parsed = parseOrInvalid(factsLedgerInputSchema, input);
      const version = this.nextVersion(
        this.values(this.tables.factsLedgers).filter(
          (ledger) => ledger.planningRunId === runId,
        ),
      );
      const at = this.now();
      const ledger = factsLedgerSchema.parse({
        ...parsed,
        id: `planning-facts-${runId}-${version}`,
        workspaceId: run.workspaceId,
        planningRunId: runId,
        taskRevision: run.taskRevision,
        version,
        createdAt: at,
      });
      await this.tables.factsLedgers.put(ledger.id, ledger);
      await this.appendArtifactEvent(run, "facts-ledger", ledger.id);
      return ledger;
    });
  }

  saveCriticReport(
    runId: string,
    input: z.input<typeof planCriticInputSchema>,
  ): Promise<PlanCriticReport> {
    return this.enqueue(async () => {
      const run = this.requireWritableRun(runId);
      const parsed = parseOrInvalid(planCriticInputSchema, input);
      const version = this.nextVersion(
        this.values(this.tables.criticReports).filter(
          (report) => report.planningRunId === runId,
        ),
      );
      const report = planCriticReportSchema.parse({
        ...parsed,
        id: `planning-critic-${runId}-${version}`,
        workspaceId: run.workspaceId,
        planningRunId: runId,
        version,
        createdAt: this.now(),
      });
      await this.tables.criticReports.put(report.id, report);
      await this.appendArtifactEvent(run, "plan-critic-report", report.id);
      return report;
    });
  }

  saveSkillSnapshot(
    runId: string,
    input: z.input<typeof skillSnapshotInputSchema>,
  ): Promise<PlanningSkillSnapshot> {
    return this.enqueue(async () => {
      const run = this.requireWritableRun(runId);
      const id = `planning-skills-${runId}`;
      const existing = this.tables.skillSnapshots.get(id);
      if (existing !== undefined) {
        return planningSkillSnapshotSchema.parse(existing);
      }
      const parsed = parseOrInvalid(skillSnapshotInputSchema, input);
      const snapshot = planningSkillSnapshotSchema.parse({
        ...parsed,
        id,
        workspaceId: run.workspaceId,
        planningRunId: runId,
        createdAt: this.now(),
      });
      await this.tables.skillSnapshots.put(snapshot.id, snapshot);
      const updated = planningRunSchema.parse({
        ...run,
        skillSnapshotId: snapshot.id,
        revision: run.revision + 1,
        updatedAt: this.now(),
      });
      await this.tables.runs.put(updated.id, updated);
      await this.appendArtifactEvent(
        run,
        "planning-skill-snapshot",
        snapshot.id,
      );
      return snapshot;
    });
  }

  saveKnowledgeReceipt(
    runId: string,
    input: z.input<typeof knowledgeReceiptInputSchema>,
  ): Promise<PlanningKnowledgeReceipt> {
    return this.enqueue(async () => {
      const run = this.requireWritableRun(runId);
      const parsed = parseOrInvalid(knowledgeReceiptInputSchema, input);
      const receipt = planningKnowledgeReceiptSchema.parse({
        ...parsed,
        id: `planning-knowledge-${randomUUID()}`,
        workspaceId: run.workspaceId,
        planningRunId: runId,
        createdAt: this.now(),
      });
      await this.tables.knowledgeReceipts.put(receipt.id, receipt);
      const updated = planningRunSchema.parse({
        ...run,
        knowledgeReceiptId: receipt.id,
        revision: run.revision + 1,
        updatedAt: this.now(),
      });
      await this.tables.runs.put(updated.id, updated);
      await this.appendArtifactEvent(
        run,
        "planning-knowledge-receipt",
        receipt.id,
      );
      return receipt;
    });
  }

  recordQualityMetric(
    runId: string,
    input: z.input<typeof qualityMetricInputSchema>,
  ): Promise<PlanningQualityMetric> {
    return this.enqueue(async () => {
      const run = this.getRun(runId);
      const parsed = parseOrInvalid(qualityMetricInputSchema, input);
      const metric = planningQualityMetricSchema.parse({
        ...parsed,
        id: `planning-metric-${randomUUID()}`,
        workspaceId: run.workspaceId,
        planningRunId: runId,
        createdAt: this.now(),
      });
      await this.tables.qualityMetrics.put(metric.id, metric);
      return metric;
    });
  }

  recordEvent(input: {
    readonly workspaceId: string;
    readonly rootTaskId: string;
    readonly planningRunId?: string | undefined;
    readonly receiptId?: string | undefined;
    readonly type: PlanningEvent["type"];
    readonly status?: PlanningStatus | undefined;
    readonly message: string;
    readonly detail?: Readonly<Record<string, string>> | undefined;
  }): Promise<PlanningEvent> {
    return this.enqueue(() => this.appendEvent(input));
  }

  briefs(runId: string): RequirementBrief[] {
    return this.values(this.tables.requirementBriefs)
      .filter((brief) => brief.planningRunId === runId)
      .sort((left, right) => left.version - right.version);
  }

  facts(runId: string): FactsLedger[] {
    return this.values(this.tables.factsLedgers)
      .filter((ledger) => ledger.planningRunId === runId)
      .sort((left, right) => left.version - right.version);
  }

  criticReports(runId: string): PlanCriticReport[] {
    return this.values(this.tables.criticReports)
      .filter((report) => report.planningRunId === runId)
      .sort((left, right) => left.version - right.version);
  }

  skillSnapshot(runId: string): PlanningSkillSnapshot | undefined {
    return this.values(this.tables.skillSnapshots)
      .filter((snapshot) => snapshot.planningRunId === runId)
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt))[0];
  }

  knowledgeReceipts(runId: string): PlanningKnowledgeReceipt[] {
    return this.values(this.tables.knowledgeReceipts)
      .filter((receipt) => receipt.planningRunId === runId)
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  }

  events(runId: string): PlanningEvent[] {
    return this.values(this.tables.events)
      .filter((event) => event.planningRunId === runId)
      .sort((left, right) => left.createdAt.localeCompare(right.createdAt));
  }

  qualityMetrics(runId: string): PlanningQualityMetric[] {
    return this.values(this.tables.qualityMetrics)
      .filter((metric) => metric.planningRunId === runId)
      .sort((left, right) => left.createdAt.localeCompare(right.createdAt));
  }

  basis(runId: string): {
    readonly run: PlanningRun;
    readonly briefs: readonly RequirementBrief[];
    readonly facts: readonly FactsLedger[];
    readonly criticReports: readonly PlanCriticReport[];
    readonly skillSnapshot?: PlanningSkillSnapshot | undefined;
    readonly knowledgeReceipts: readonly PlanningKnowledgeReceipt[];
    readonly events: readonly PlanningEvent[];
    readonly qualityMetrics: readonly PlanningQualityMetric[];
  } {
    const run = this.getRun(runId);
    return {
      run,
      briefs: this.briefs(runId),
      facts: this.facts(runId),
      criticReports: this.criticReports(runId),
      skillSnapshot: this.skillSnapshot(runId),
      knowledgeReceipts: this.knowledgeReceipts(runId),
      events: this.events(runId),
      qualityMetrics: this.qualityMetrics(runId),
    };
  }

  private requireWritableRun(runId: string): PlanningRun {
    const run = this.getRun(runId);
    if (isTerminalPlanningStatus(run.status)) {
      throw new PlanningError(
        "conflict",
        "Planning Run 已结束，不能再写入规划产物",
      );
    }
    return run;
  }

  private nextVersion(values: readonly { readonly version: number }[]): number {
    return values.reduce((max, value) => Math.max(max, value.version), 0) + 1;
  }

  private async appendArtifactEvent(
    run: PlanningRun,
    artifactType: string,
    artifactId: string,
  ): Promise<void> {
    await this.appendEvent({
      workspaceId: run.workspaceId,
      rootTaskId: run.rootTaskId,
      planningRunId: run.id,
      receiptId: run.receiptId,
      type: "artifact-saved",
      status: run.status,
      message: `Planning artifact saved: ${artifactType}`,
      detail: { artifactId },
    });
  }

  private async appendEvent(input: {
    readonly workspaceId: string;
    readonly rootTaskId: string;
    readonly planningRunId?: string | undefined;
    readonly receiptId?: string | undefined;
    readonly type: PlanningEvent["type"];
    readonly status?: PlanningStatus | undefined;
    readonly message: string;
    readonly detail?: Readonly<Record<string, string>> | undefined;
  }): Promise<PlanningEvent> {
    const event = planningEventSchema.parse({
      id: `planning-event-${randomUUID()}`,
      workspaceId: input.workspaceId,
      rootTaskId: input.rootTaskId,
      ...(input.planningRunId === undefined
        ? {}
        : { planningRunId: input.planningRunId }),
      ...(input.receiptId === undefined ? {} : { receiptId: input.receiptId }),
      type: input.type,
      ...(input.status === undefined ? {} : { status: input.status }),
      message: input.message,
      detail: input.detail === undefined ? {} : { ...input.detail },
      createdAt: this.now(),
    });
    await this.tables.events.put(event.id, event);
    return event;
  }
}
