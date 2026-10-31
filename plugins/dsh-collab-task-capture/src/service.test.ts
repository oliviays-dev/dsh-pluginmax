import { describe, expect, it } from "vitest";
import type {
  TaskCaptureActor,
  TaskCaptureCandidate,
  TaskCaptureEvent,
  TaskCaptureSession,
  TaskCreationFromDraftResult,
  TaskDraft,
  TaskDraftBatch,
  TaskDraftCommitConfirmation,
  TaskDraftConversion,
  TaskOrigin,
} from "@pluginmax/contracts";
import type {
  KvTableLike,
  TaskCaptureIdempotency,
  TaskCaptureAudit,
} from "./models.js";
import { taskCaptureIdempotencySchema } from "./models.js";
import {
  TaskCaptureService,
  type TaskCaptureTables,
  type TaskCreationPort,
} from "./service.js";
import { TaskCaptureSourceRegistry } from "./source-registry.js";

function memoryTable<V>(): KvTableLike<V> {
  const values = new Map<string, V>();
  return {
    get: (key) => values.get(key),
    entries: () => values.entries(),
    keys: () => values.keys(),
    get size() {
      return values.size;
    },
    async put(key, value) {
      values.set(key, value);
    },
    async delete(key) {
      return values.delete(key);
    },
  };
}

function tables(): TaskCaptureTables {
  return {
    captureSessions: memoryTable<TaskCaptureSession>(),
    captureCandidates: memoryTable<TaskCaptureCandidate>(),
    draftBatches: memoryTable<TaskDraftBatch>(),
    drafts: memoryTable<TaskDraft>(),
    commitConfirmations: memoryTable<TaskDraftCommitConfirmation>(),
    conversions: memoryTable<TaskDraftConversion>(),
    taskOrigins: memoryTable<TaskOrigin>(),
    events: memoryTable<TaskCaptureEvent>(),
    idempotency: memoryTable<TaskCaptureIdempotency>(),
    audit: memoryTable<TaskCaptureAudit>(),
  };
}

const actor: TaskCaptureActor = {
  id: "olivia",
  principalId: "principal:olivia",
  name: "Olivia",
  kind: "human",
  role: "member",
};

function harness(
  options: {
    readonly failFirst?: boolean;
    readonly ready?: boolean;
    readonly taskTitles?: readonly string[];
  } = {},
) {
  const store = tables();
  const sources = new TaskCaptureSourceRegistry();
  sources.register({
    sourceType: "meeting",
    version: "1",
    async resolve() {
      return {
        source: {
          sourceType: "meeting",
          sourceId: "meeting-1",
          sourceTitle: "供应链协同会",
          workspaceId: "workspace-1",
          projectId: "workspace-1",
          visibility: "source-participants",
          sourceVersion: "v1",
          excerpt: "确认返工窗口和补数方案",
          messageIds: ["m1", "m2"],
          actionItemIds: [],
          reportSectionIds: [],
          participantIds: ["alice"],
        },
        candidates: [
          {
            sourceItemKey: "m1",
            title: "确认返工恢复计划",
            description: "输出恢复排期和影响订单。",
            priorityHint: "P1",
            dueHint: "2026-11-01",
            acceptanceHints: options.ready === false ? [] : ["恢复排期已确认"],
            collaboratorHints: [],
            evidenceRefs: ["meeting-message:meeting-1:m1"],
            confidence: "high",
          },
          {
            sourceItemKey: "m2",
            title: "补齐行业字段",
            description: "确认字段来源和补数方案。",
            priorityHint: "P2",
            acceptanceHints: [],
            collaboratorHints: [],
            evidenceRefs: ["meeting-message:meeting-1:m2"],
            confidence: "medium",
          },
        ],
      };
    },
  });
  let createCalls = 0;
  let dispatchCalls = 0;
  const creationInputs: Array<
    Parameters<TaskCreationPort["createFromDraft"]>[1]
  > = [];
  const creation: TaskCreationPort = {
    async createFromDraft(_actor, input) {
      createCalls += 1;
      creationInputs.push(input);
      if (options.failFirst === true && createCalls === 1) {
        throw new Error("task write failed");
      }
      return {
        taskId: `TSK-${createCalls}`,
        workspaceId: input.draft.workspaceId,
        title: input.draft.title,
        status: "todo",
        creationKey: input.creationKey,
        deduplicated: false,
        updatedAt: "2026-10-30T10:00:00.000Z",
      } satisfies TaskCreationFromDraftResult;
    },
  };
  const service = new TaskCaptureService(store, {
    sources,
    taskCreation: () => creation,
    taskLookup: () => ({
      list: () =>
        (options.taskTitles ?? []).map((title, index) => ({
          id: `TSK-existing-${index + 1}`,
          title,
          status: "todo",
        })),
    }),
    taskDispatch: () => ({
      async dispatch() {
        dispatchCalls += 1;
        return { ok: true };
      },
    }),
    now: () => new Date("2026-10-30T10:00:00.000Z"),
    id: (() => {
      let index = 0;
      return () => `id-${++index}`;
    })(),
  });
  return {
    service,
    store,
    createCalls: () => createCalls,
    dispatchCalls: () => dispatchCalls,
    creationInputs,
  };
}

async function prepareAndSave(service: TaskCaptureService, ready = true) {
  const prepared = await service.prepare(actor, {
    sourceRef: {
      sourceType: "meeting",
      sourceId: "meeting-1",
    },
    selection: {
      messageIds: ["m1", "m2"],
    },
    commandId: "prepare-1",
  });
  const selected = ready
    ? prepared.candidates.map((candidate) => candidate.id)
    : [prepared.candidates[0]!.id];
  const saved = await service.save(actor, {
    sessionId: prepared.session.id,
    candidateIds: selected,
    commandId: "save-1",
    expectedRevision: prepared.session.revision,
  });
  return { prepared, saved };
}

describe("TaskCaptureService", () => {
  it("saves only selected drafts and does not create formal tasks", async () => {
    const { service, createCalls } = harness();
    const { saved } = await prepareAndSave(service);
    expect(saved.drafts).toHaveLength(2);
    expect(saved.drafts[0]).toMatchObject({
      title: "确认返工恢复计划",
      readiness: "ready",
    });
    expect(saved.drafts[1]).toMatchObject({
      title: "补齐行业字段",
      readiness: "ready",
      missingFields: [],
      receiverType: "human",
      receiverId: "olivia",
      projectId: "workspace-1",
      acceptance: ["按任务描述完成，并同步交付结果"],
    });
    expect(createCalls()).toBe(0);
    expect(service.inbox(actor, "workspace-1")).toMatchObject({
      draftCount: 2,
      readyCount: 2,
      needsInfoCount: 0,
    });
    expect(service.events(actor, "workspace-1")).toMatchObject([
      { type: "task.draft-batch.created.v1" },
    ]);
  });

  it("updates readiness, commits ready drafts, and records origin", async () => {
    const { service, createCalls } = harness();
    const { saved } = await prepareAndSave(service);
    const needsInfo = saved.drafts[1]!;
    const updated = await service.updateDraft(actor, {
      draftId: needsInfo.id,
      expectedRevision: needsInfo.revision,
      commandId: "update-1",
      patch: {
        acceptance: ["字段来源已确认"],
      },
    });
    expect(updated.readiness).toBe("ready");
    const batch = service.batch(actor, saved.batch.id);
    const result = await service.commit(actor, {
      batchId: batch.batch.id,
      draftIds: batch.drafts.map((draft) => draft.id),
      commandId: "commit-1",
      expectedRevision: batch.batch.revision,
      createMode: "create-only",
    });
    expect(result.summary.created).toBe(2);
    expect(createCalls()).toBe(2);
    expect(service.origin(actor, "TSK-1")).toMatchObject({
      sourceType: "meeting",
      sourceId: "meeting-1",
    });
    expect(service.batch(actor, saved.batch.id).batch.status).toBe("converted");
    expect(
      service.events(actor, "workspace-1").map((event) => event.type),
    ).toEqual(["task.draft-batch.created.v1", "task.draft-batch.committed.v1"]);
  });

  it("applies light edits from the capture panel before saving drafts", async () => {
    const { service } = harness();
    const prepared = await service.prepare(actor, {
      sourceRef: {
        sourceType: "meeting",
        sourceId: "meeting-1",
      },
      selection: { messageIds: ["m1", "m2"] },
      commandId: "prepare-edits",
    });
    const candidate = prepared.candidates[0]!;
    const saved = await service.save(actor, {
      sessionId: prepared.session.id,
      candidateIds: [candidate.id],
      expectedRevision: prepared.session.revision,
      commandId: "save-edits",
      candidateOverrides: [
        {
          candidateId: candidate.id,
          title: "确认修订后的恢复计划",
          description: "确认修订后的恢复计划，并同步影响订单。",
          priority: "P2",
          due: "2026-11-02",
          receiverHint: {
            kind: "human",
            id: "olivia",
            name: "Olivia",
          },
        },
      ],
    });
    expect(saved.drafts[0]).toMatchObject({
      title: "确认修订后的恢复计划",
      description: "确认修订后的恢复计划，并同步影响订单。",
      priority: "P2",
      due: "2026-11-02",
      receiverType: "human",
      receiverId: "olivia",
    });
  });

  it("returns the same result for the same commit command", async () => {
    const { service, createCalls } = harness();
    const { saved } = await prepareAndSave(service);
    const batch = service.batch(actor, saved.batch.id);
    const ready = batch.drafts
      .filter((draft) => draft.readiness === "ready")
      .slice(0, 1)
      .map((draft) => draft.id);
    const input = {
      batchId: batch.batch.id,
      draftIds: ready,
      commandId: "commit-idempotent",
      expectedRevision: batch.batch.revision,
      createMode: "create-only" as const,
    };
    const first = await service.commit(actor, input);
    const second = await service.commit(actor, input);
    expect(second).toEqual(first);
    expect(createCalls()).toBe(1);
  });

  it("keeps failed drafts retryable without losing successful items", async () => {
    const { service } = harness({ failFirst: true });
    const { saved } = await prepareAndSave(service);
    const ready = saved.drafts.filter((draft) => draft.readiness === "ready");
    const failed = await service.commit(actor, {
      batchId: saved.batch.id,
      draftIds: [ready[0]!.id],
      commandId: "commit-fail",
      expectedRevision: saved.batch.revision,
      createMode: "create-only",
    });
    expect(failed.summary.failed).toBe(1);
    const failedDraft = service
      .batch(actor, saved.batch.id)
      .drafts.find((draft) => draft.id === ready[0]!.id);
    expect(failedDraft?.status).toBe("conversion-failed");
    const retry = await service.commit(actor, {
      batchId: saved.batch.id,
      draftIds: [ready[0]!.id],
      commandId: "commit-retry",
      expectedRevision: failed.batch.revision,
      createMode: "create-only",
    });
    expect(retry.summary.created).toBe(1);
  });

  it("requires a user confirmation before creating and dispatching tasks", async () => {
    const { service, dispatchCalls } = harness();
    const { saved } = await prepareAndSave(service);
    const ready = saved.drafts
      .filter((draft) => draft.readiness === "ready")
      .slice(0, 1)
      .map((draft) => draft.id);
    await expect(
      service.commit(actor, {
        batchId: saved.batch.id,
        draftIds: ready,
        commandId: "commit-dispatch-no-confirmation",
        expectedRevision: saved.batch.revision,
        createMode: "create-and-dispatch",
      }),
    ).rejects.toMatchObject({ code: "forbidden" });
    const confirmation = await service.issueCommitConfirmation(actor, {
      batchId: saved.batch.id,
      draftIds: ready,
      commandId: "confirm-dispatch",
    });
    const result = await service.commit(actor, {
      batchId: saved.batch.id,
      draftIds: ready,
      commandId: "commit-dispatch",
      expectedRevision: saved.batch.revision,
      createMode: "create-and-dispatch",
      confirmationId: confirmation.confirmationId,
    });
    expect(result.summary.created).toBe(1);
    expect(result.summary.dispatched).toBe(1);
    expect(dispatchCalls()).toBe(1);
  });

  it("does not commit a draft before it has a description and acceptance", async () => {
    const { service, createCalls } = harness({ ready: false });
    const { saved } = await prepareAndSave(service);
    const current = service.batch(actor, saved.batch.id).drafts[0]!;
    const cleared = await service.updateDraft(actor, {
      draftId: current.id,
      expectedRevision: current.revision,
      commandId: "clear-acceptance",
      patch: { acceptance: [] },
    });
    expect(cleared.readiness).toBe("needs-info");
    const result = await service.commit(actor, {
      batchId: saved.batch.id,
      draftIds: [cleared.id],
      commandId: "commit-not-ready",
      expectedRevision: service.batch(actor, saved.batch.id).batch.revision,
      createMode: "create-only",
    });
    expect(result.summary.skipped).toBe(1);
    expect(createCalls()).toBe(0);
  });

  it("returns the existing batch when the same source items are saved again", async () => {
    const { service } = harness();
    const { saved } = await prepareAndSave(service);
    const preparedAgain = await service.prepare(actor, {
      sourceRef: {
        sourceType: "meeting",
        sourceId: "meeting-1",
      },
      selection: {
        messageIds: ["m1", "m2"],
      },
      commandId: "prepare-2",
    });
    const savedAgain = await service.save(actor, {
      sessionId: preparedAgain.session.id,
      candidateIds: preparedAgain.candidates.map((candidate) => candidate.id),
      commandId: "save-2",
      expectedRevision: preparedAgain.session.revision,
    });
    expect(savedAgain.batch.id).toBe(saved.batch.id);
    expect(service.inbox(actor, "workspace-1").draftCount).toBe(2);
  });

  it("undoes a whole batch before any draft becomes a formal task", async () => {
    const { service } = harness();
    const { saved } = await prepareAndSave(service);
    await service.undoBatch(actor, {
      batchId: saved.batch.id,
      commandId: "undo-1",
    });
    expect(service.inbox(actor, "workspace-1").draftCount).toBe(0);
    expect(service.batch(actor, saved.batch.id).batch.status).toBe("archived");
  });

  it("creates an editable manual draft without a conversation source", async () => {
    const { service } = harness();
    const input = {
      workspaceId: "workspace-1",
      description: "人工创建：补齐供应商季度复盘。",
      priority: "P1" as const,
      commandId: "manual-draft-1",
    };
    const first = await service.createManualDraft(actor, input);
    const second = await service.createManualDraft(actor, input);
    expect(second.batch.id).toBe(first.batch.id);
    expect(first.batch).toMatchObject({
      status: "active",
      visibility: "private",
      source: {
        sourceType: "manual",
        sourceTitle: "手工任务草稿",
      },
    });
    expect(first.drafts[0]).toMatchObject({
      title: "人工创建：补齐供应商季度复盘",
      priority: "P1",
      status: "active",
      readiness: "ready",
      receiverType: "human",
      receiverId: "olivia",
      acceptance: ["按任务描述完成，并同步交付结果"],
    });
    expect(service.inbox(actor, "workspace-1").draftCount).toBe(1);
  });

  it("rejects draft edits from a non-owner", async () => {
    const { service } = harness();
    const { saved } = await prepareAndSave(service);
    await expect(
      service.updateDraft(
        { ...actor, id: "other", principalId: "principal:other" },
        {
          draftId: saved.drafts[0]!.id,
          expectedRevision: saved.drafts[0]!.revision,
          commandId: "update-other",
          patch: { title: "越权修改" },
        },
      ),
    ).rejects.toMatchObject({ code: "forbidden" });
  });

  it("counts duplicates as needs-info and requires explicit creation consent", async () => {
    const { service, createCalls } = harness({
      taskTitles: ["确认返工恢复计划"],
    });
    const { saved } = await prepareAndSave(service);
    const duplicate = saved.drafts.find(
      (draft) => draft.title === "确认返工恢复计划",
    )!;
    expect(duplicate.duplicate?.candidateTaskId).toBe("TSK-existing-1");
    expect(service.inbox(actor, "workspace-1")).toMatchObject({
      readyCount: 1,
      needsInfoCount: 1,
    });
    const first = await service.commit(actor, {
      batchId: saved.batch.id,
      draftIds: [duplicate.id],
      commandId: "commit-duplicate-blocked",
      expectedRevision: saved.batch.revision,
      createMode: "create-only",
    });
    expect(first.summary.skipped).toBe(1);
    expect(first.items[0]).toMatchObject({
      errorCode: "duplicate_unresolved",
    });
    expect(createCalls()).toBe(0);
    const currentBatch = service.batch(actor, saved.batch.id).batch;
    const second = await service.commit(actor, {
      batchId: saved.batch.id,
      draftIds: [duplicate.id],
      commandId: "commit-duplicate-allowed",
      expectedRevision: currentBatch.revision,
      createMode: "create-only",
      allowDuplicateDraftIds: [duplicate.id],
    });
    expect(second.summary.created).toBe(1);
  });

  it("links a duplicate draft to an existing task without creating a task", async () => {
    const { service, createCalls } = harness({
      taskTitles: ["确认返工恢复计划"],
    });
    const { saved } = await prepareAndSave(service);
    const duplicate = saved.drafts.find(
      (draft) => draft.title === "确认返工恢复计划",
    )!;
    const linked = await service.linkDraft(actor, {
      draftId: duplicate.id,
      taskId: "TSK-existing-1",
      expectedRevision: duplicate.revision,
      commandId: "link-existing",
    });
    expect(linked.status).toBe("linked");
    expect(createCalls()).toBe(0);
    expect(
      service
        .library(actor, "workspace-1")
        .items.find((item) => item.draft.id === duplicate.id),
    ).toMatchObject({
      taskId: "TSK-existing-1",
      draft: { status: "linked" },
    });
  });

  it("passes creation-only execution settings to the formal task port", async () => {
    const { service, creationInputs } = harness();
    const { saved } = await prepareAndSave(service);
    const input = {
      schemaVersion: 1,
      runtime: {
        selection: "recommended",
        allowedRuntimeIds: [],
        requiredCapabilities: [{ key: "search", necessity: "required" }],
      },
      sourcePolicy: {
        allow: ["workspace", "public-web"],
        deny: ["private-local-data"],
        citation: "required-for-factual-claims",
        requirePublishedAt: true,
        requireAccessedAt: true,
      },
      toolPolicy: {
        allow: [],
        deny: [],
        requireApproval: ["fs.write", "shell.execute", "external.publish"],
      },
      evidence: {
        requirePlan: true,
        requireToolEvents: true,
        requireCitations: true,
        requireStructuredSubagents: false,
      },
      humanGates: [],
      budget: {},
    };
    const batch = service.batch(actor, saved.batch.id);
    const result = await service.commit(actor, {
      batchId: saved.batch.id,
      draftIds: [batch.drafts[0]!.id],
      commandId: "commit-policy",
      expectedRevision: batch.batch.revision,
      createMode: "create-only",
      executionPolicy: input,
      autoSubmitReview: false,
    });
    expect(result.summary.created).toBe(1);
    expect(creationInputs[0]).toMatchObject({
      executionPolicy: input,
      autoSubmitReview: false,
    });
    expect(
      service.library(actor, "workspace-1").items[0]?.draft,
    ).not.toHaveProperty("executionPolicy");
  });

  it("loads legacy idempotency records whose void result was omitted", () => {
    expect(
      taskCaptureIdempotencySchema.parse({
        key: "olivia\u0000undo-1",
        actorId: "olivia",
        operation: "undo-batch",
        commandId: "undo-1",
        createdAt: "2026-10-30T00:00:00.000Z",
      }).result,
    ).toBeUndefined();
  });
});
