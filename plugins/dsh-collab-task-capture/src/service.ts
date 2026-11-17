import { randomUUID } from "node:crypto";
import {
  commitTaskDraftsInputSchema,
  createManualTaskDraftInputSchema,
  issueTaskDraftCommitConfirmationInputSchema,
  linkTaskDraftInputSchema,
  resolvedTaskCaptureSourceSchema,
  saveTaskDraftsInputSchema,
  taskCaptureActorSchema,
  taskCaptureCandidateSchema,
  taskCaptureEventSchema,
  taskCaptureSessionProjectionSchema,
  taskCaptureSessionSchema,
  taskCaptureSourceSnapshotSchema,
  taskDraftBatchProjectionSchema,
  taskDraftBatchSchema,
  taskDraftCommitConfirmationSchema,
  taskDraftCommitResultSchema,
  taskDraftConversionSchema,
  taskDraftForCreationSchema,
  taskDraftInboxProjectionSchema,
  taskDraftLibraryProjectionSchema,
  taskDraftSchema,
  taskOriginSchema,
  taskPrepareCaptureInputSchema,
  undoTaskDraftBatchInputSchema,
  updateTaskDraftInputSchema,
  type TaskCaptureActor,
  type TaskCaptureCandidate,
  type TaskCaptureEvent,
  type TaskCaptureSession,
  type TaskCaptureSessionProjection,
  type TaskCreationFromDraftResult,
  type TaskDraft,
  type TaskDraftBatch,
  type TaskDraftBatchProjection,
  type TaskDraftCommitConfirmation,
  type TaskDraftCommitResult,
  type TaskDraftConversion,
  type TaskDraftInboxProjection,
  type TaskDraftLibraryProjection,
  type TaskDraftForCreation,
  type TaskOrigin,
  type TaskExecutionPolicy,
  type UpdateTaskDraftInput,
} from "@pluginmax/contracts";
import { z } from "zod";
import {
  taskCaptureIdempotencySchema,
  type KvTableLike,
  taskCaptureAuditSchema,
  type TaskCaptureAudit,
  type TaskCaptureIdempotency,
} from "./models.js";
import type { TaskCaptureSourceRegistry } from "./source-registry.js";

export interface TaskCaptureTables {
  readonly captureSessions: KvTableLike<TaskCaptureSession>;
  readonly captureCandidates: KvTableLike<TaskCaptureCandidate>;
  readonly draftBatches: KvTableLike<TaskDraftBatch>;
  readonly drafts: KvTableLike<TaskDraft>;
  readonly commitConfirmations: KvTableLike<TaskDraftCommitConfirmation>;
  readonly conversions: KvTableLike<TaskDraftConversion>;
  readonly taskOrigins: KvTableLike<TaskOrigin>;
  readonly events: KvTableLike<TaskCaptureEvent>;
  readonly idempotency: KvTableLike<TaskCaptureIdempotency>;
  readonly audit: KvTableLike<TaskCaptureAudit>;
}

export interface TaskCreationPort {
  createFromDraft(
    actor: {
      readonly id: string;
      readonly name: string;
      readonly kind: "human" | "agent" | "system";
      readonly role?: "admin" | "owner" | "member" | "guest" | undefined;
      readonly principalId?: string | undefined;
    },
    input: {
      readonly draft: TaskDraftForCreation;
      readonly creationKey: string;
      readonly executionPolicy?: TaskExecutionPolicy | undefined;
      readonly autoSubmitReview?: boolean | undefined;
    },
  ): Promise<TaskCreationFromDraftResult>;
}

export interface TaskLookupPort {
  list(workspaceId: string): readonly {
    readonly id: string;
    readonly title: string;
    readonly status: string;
    readonly archivedAt?: string | undefined;
  }[];
}

export interface TaskDispatchPort {
  dispatch(
    actor: {
      readonly id: string;
      readonly name: string;
      readonly kind: "human" | "agent" | "system";
      readonly role?: "admin" | "owner" | "member" | "guest" | undefined;
      readonly principalId?: string | undefined;
    },
    taskId: string,
  ): Promise<unknown>;
}

export class TaskCaptureError extends Error {
  constructor(
    readonly code:
      | "invalid_input"
      | "unauthorized"
      | "forbidden"
      | "not_found"
      | "conflict"
      | "source_unavailable"
      | "duplicate_source"
      | "capability_unavailable",
    message: string,
  ) {
    super(message);
    this.name = "TaskCaptureError";
  }
}

function values<V>(table: KvTableLike<V>): V[] {
  return Array.from(table.entries(), ([, value]) => value);
}

function parse<T>(schema: z.ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);
  if (!result.success) {
    throw new TaskCaptureError("invalid_input", "request input is invalid");
  }
  return result.data;
}

function normalizedTitle(value: string): string {
  return value.replace(/\s+/g, " ").trim().toLowerCase();
}

function missingCandidateFields(input: {
  readonly description: string;
  readonly acceptance: readonly string[];
}): string[] {
  return [
    ...(input.description.trim() === "" ? ["description"] : []),
    ...(input.acceptance.length === 0 ? ["acceptance"] : []),
  ];
}

const DEFAULT_ACCEPTANCE = "按任务描述完成，并同步交付结果";

function defaultDescription(
  title: string,
  excerpt: string | undefined,
): string {
  const source = (excerpt ?? "").trim();
  if (source === "" || normalizedTitle(source) === normalizedTitle(title)) {
    return title;
  }
  return `围绕「${title}」完成以下事项：\n\n${source}`.slice(0, 20_000);
}

export class TaskCaptureService {
  constructor(
    private readonly tables: TaskCaptureTables,
    private readonly deps: {
      readonly sources: TaskCaptureSourceRegistry;
      readonly taskCreation: () => TaskCreationPort | undefined;
      readonly taskLookup: () => TaskLookupPort | undefined;
      readonly taskDispatch?: () => TaskDispatchPort | undefined;
      readonly onChange?: (event: {
        readonly type:
          | "task.draft-batch.created.v1"
          | "task.draft-batch.committed.v1"
          | "task.draft-batch.undone.v1";
        readonly workspaceId: string;
        readonly batchId: string;
        readonly taskId?: string | undefined;
      }) => void;
      readonly now?: () => Date;
      readonly id?: () => string;
    },
  ) {}

  private now(): string {
    return (this.deps.now?.() ?? new Date()).toISOString();
  }

  private id(prefix: string): string {
    return `${prefix}-${this.deps.id?.() ?? randomUUID()}`;
  }

  private actor(value: unknown): TaskCaptureActor {
    return parse(taskCaptureActorSchema, value);
  }

  private requireSession(sessionId: string): TaskCaptureSession {
    const session = this.tables.captureSessions.get(sessionId);
    if (session === undefined) {
      throw new TaskCaptureError("not_found", "task capture session not found");
    }
    return parse(taskCaptureSessionSchema, session);
  }

  private requireBatch(batchId: string): TaskDraftBatch {
    const batch = this.tables.draftBatches.get(batchId);
    if (batch === undefined) {
      throw new TaskCaptureError("not_found", "task draft batch not found");
    }
    return parse(taskDraftBatchSchema, batch);
  }

  private requireDraft(draftId: string): TaskDraft {
    const draft = this.tables.drafts.get(draftId);
    if (draft === undefined) {
      throw new TaskCaptureError("not_found", "task draft not found");
    }
    return parse(taskDraftSchema, draft);
  }

  private requireOwner(
    actor: TaskCaptureActor,
    value: { readonly ownerId: string },
  ): void {
    if (value.ownerId !== actor.id) {
      throw new TaskCaptureError("forbidden", "task draft owner is required");
    }
  }

  private canView(actor: TaskCaptureActor, batch: TaskDraftBatch): boolean {
    return (
      batch.ownerId === actor.id ||
      batch.visibility === "workspace" ||
      (batch.visibility === "source-participants" &&
        batch.source.participantIds.includes(actor.id))
    );
  }

  private async idempotent<T>(
    actor: TaskCaptureActor,
    commandId: string,
    operation: string,
    run: () => Promise<T>,
  ): Promise<T> {
    const key = `${actor.id}\u0000${commandId}`;
    const existing = this.tables.idempotency.get(key);
    if (existing !== undefined && existing.operation === operation) {
      return existing.result as T;
    }
    const result = await run();
    await this.tables.idempotency.put(
      key,
      taskCaptureIdempotencySchema.parse({
        key,
        actorId: actor.id,
        operation,
        commandId,
        result,
        createdAt: this.now(),
      }),
    );
    return result;
  }

  private async audit(input: {
    readonly actor: TaskCaptureActor;
    readonly action: string;
    readonly result: "ok" | "failed";
    readonly batchId?: string | undefined;
    readonly draftId?: string | undefined;
    readonly taskId?: string | undefined;
    readonly detail?: Readonly<Record<string, string>> | undefined;
  }): Promise<void> {
    const id = this.id("tc-audit");
    await this.tables.audit.put(
      id,
      parse(taskCaptureAuditSchema, {
        id,
        actorId: input.actor.id,
        action: input.action,
        ...(input.batchId === undefined ? {} : { batchId: input.batchId }),
        ...(input.draftId === undefined ? {} : { draftId: input.draftId }),
        ...(input.taskId === undefined ? {} : { taskId: input.taskId }),
        result: input.result,
        detail: input.detail ?? {},
        createdAt: this.now(),
      }),
    );
  }

  private async recordEvent(input: {
    readonly actor: TaskCaptureActor;
    readonly type: TaskCaptureEvent["type"];
    readonly workspaceId: string;
    readonly batchId: string;
    readonly taskId?: string | undefined;
  }): Promise<void> {
    const occurredAt = this.now();
    const eventId = this.id("tc-event");
    await this.tables.events.put(
      eventId,
      parse(taskCaptureEventSchema, {
        id: eventId,
        type: input.type,
        schemaVersion: 1,
        occurredAt,
        workspaceId: input.workspaceId,
        aggregateType: "task-draft-batch",
        aggregateId: input.batchId,
        ...(input.actor.principalId === undefined
          ? { actorPrincipalId: input.actor.id }
          : { actorPrincipalId: input.actor.principalId }),
        payload: {
          batchId: input.batchId,
          ...(input.taskId === undefined ? {} : { taskId: input.taskId }),
        },
      }),
    );
  }

  async prepare(
    rawActor: TaskCaptureActor,
    input: unknown,
  ): Promise<TaskCaptureSessionProjection> {
    const actor = this.actor(rawActor);
    const parsed = parse(taskPrepareCaptureInputSchema, input);
    return this.idempotent(actor, parsed.commandId, "prepare", async () => {
      const adapter = this.deps.sources.resolve(parsed.sourceRef);
      if (adapter === undefined) {
        throw new TaskCaptureError(
          "source_unavailable",
          `task capture source adapter is not registered: ${parsed.sourceRef.sourceType}`,
        );
      }
      let resolvedInput: unknown;
      try {
        resolvedInput = await adapter.resolve({
          actor,
          sourceRef: parsed.sourceRef,
          selection: parsed.selection,
        });
      } catch (cause) {
        throw new TaskCaptureError(
          "source_unavailable",
          cause instanceof Error
            ? cause.message
            : "task capture source is unavailable",
        );
      }
      const resolved = parse(resolvedTaskCaptureSourceSchema, resolvedInput);
      const source = parse(taskCaptureSourceSnapshotSchema, {
        ...resolved.source,
        ...(parsed.sourceRef.sourceTitle === undefined
          ? {}
          : { sourceTitle: parsed.sourceRef.sourceTitle }),
      });
      const now = this.now();
      const session = parse(taskCaptureSessionSchema, {
        id: this.id("tc-session"),
        schemaVersion: 1,
        workspaceId: source.workspaceId,
        ...(source.projectId === undefined
          ? {}
          : { projectId: source.projectId }),
        source,
        status: "active",
        revision: 1,
        createdByPrincipalId: actor.principalId ?? actor.id,
        createdById: actor.id,
        createdAt: now,
        updatedAt: now,
        expiresAt: new Date(
          new Date(now).getTime() + 24 * 60 * 60 * 1_000,
        ).toISOString(),
      });
      const seen = new Set<string>();
      const candidates = resolved.candidates.map((candidate) => {
        if (seen.has(candidate.sourceItemKey)) {
          throw new TaskCaptureError(
            "source_unavailable",
            "source adapter returned duplicate sourceItemKey",
          );
        }
        seen.add(candidate.sourceItemKey);
        return parse(taskCaptureCandidateSchema, {
          id: this.id("tc-candidate"),
          sessionId: session.id,
          ...candidate,
          missingFields: missingCandidateFields({
            description: candidate.description,
            acceptance: candidate.acceptanceHints,
          }),
          status: "proposed",
        });
      });
      await this.tables.captureSessions.put(session.id, session);
      try {
        for (const candidate of candidates) {
          await this.tables.captureCandidates.put(candidate.id, candidate);
        }
      } catch (cause) {
        await this.tables.captureSessions.delete(session.id);
        for (const candidate of candidates) {
          await this.tables.captureCandidates.delete(candidate.id);
        }
        throw cause;
      }
      await this.audit({
        actor,
        action: "task_capture.prepared",
        result: "ok",
        detail: {
          sessionId: session.id,
          sourceType: source.sourceType,
          candidateCount: String(candidates.length),
        },
      });
      return taskCaptureSessionProjectionSchema.parse({
        session,
        candidates,
      });
    });
  }

  session(
    rawActor: TaskCaptureActor,
    sessionId: string,
  ): TaskCaptureSessionProjection {
    const actor = this.actor(rawActor);
    const session = this.requireSession(sessionId);
    if (session.createdById !== actor.id) {
      throw new TaskCaptureError("forbidden", "task capture owner is required");
    }
    return taskCaptureSessionProjectionSchema.parse({
      session,
      candidates: values(this.tables.captureCandidates)
        .filter((candidate) => candidate.sessionId === session.id)
        .sort((left, right) => left.title.localeCompare(right.title)),
    });
  }

  private duplicateHint(
    workspaceId: string,
    title: string,
  ): TaskDraft["duplicate"] | undefined {
    const tasks = this.deps.taskLookup?.()?.list(workspaceId) ?? [];
    const match = tasks.find(
      (task) =>
        task.archivedAt === undefined &&
        task.status !== "cancelled" &&
        normalizedTitle(task.title) === normalizedTitle(title),
    );
    if (match === undefined) return undefined;
    return {
      kind: "title",
      candidateTaskId: match.id,
      message: `存在标题相同的任务 ${match.id}`,
    };
  }

  async save(
    rawActor: TaskCaptureActor,
    input: unknown,
  ): Promise<TaskDraftBatchProjection> {
    const actor = this.actor(rawActor);
    const parsed = parse(saveTaskDraftsInputSchema, input);
    return this.idempotent(actor, parsed.commandId, "save", async () => {
      const session = this.requireSession(parsed.sessionId);
      if (session.createdById !== actor.id) {
        throw new TaskCaptureError(
          "forbidden",
          "task capture owner is required",
        );
      }
      if (session.status !== "active") {
        throw new TaskCaptureError("conflict", "capture session is not active");
      }
      if (session.revision !== parsed.expectedRevision) {
        throw new TaskCaptureError(
          "conflict",
          "capture session revision changed",
        );
      }
      const ids = [...new Set(parsed.candidateIds)];
      if (ids.length !== parsed.candidateIds.length) {
        throw new TaskCaptureError(
          "invalid_input",
          "candidateIds contain duplicates",
        );
      }
      const candidates = ids.map((id) => {
        const candidate = this.tables.captureCandidates.get(id);
        if (
          candidate === undefined ||
          candidate.sessionId !== session.id ||
          candidate.status !== "proposed"
        ) {
          throw new TaskCaptureError(
            "invalid_input",
            "candidate does not belong to the active capture session",
          );
        }
        return parse(taskCaptureCandidateSchema, candidate);
      });
      const overrideMap = new Map(
        parsed.candidateOverrides.map((override) => {
          if (!ids.includes(override.candidateId)) {
            throw new TaskCaptureError(
              "invalid_input",
              "candidateOverrides 包含未选择的候选事项",
            );
          }
          return [override.candidateId, override] as const;
        }),
      );
      const sourceDrafts = values(this.tables.draftBatches)
        .filter(
          (batch) =>
            batch.source.sourceType === session.source.sourceType &&
            batch.source.sourceId === session.source.sourceId &&
            batch.status !== "archived" &&
            this.canView(actor, batch),
        )
        .flatMap((batch) =>
          values(this.tables.drafts)
            .filter(
              (draft) =>
                draft.batchId === batch.id &&
                draft.status !== "ignored" &&
                candidates.some(
                  (candidate) =>
                    candidate.sourceItemKey === draft.sourceItemKey,
                ),
            )
            .map((draft) => ({ batch, draft })),
        );
      if (sourceDrafts.length > 0) {
        const batchIds = new Set(sourceDrafts.map((entry) => entry.batch.id));
        if (sourceDrafts.length === candidates.length && batchIds.size === 1) {
          const existingBatch = sourceDrafts[0]!.batch;
          await this.tables.captureSessions.put(
            session.id,
            parse(taskCaptureSessionSchema, {
              ...session,
              status: "saved",
              revision: session.revision + 1,
              updatedAt: this.now(),
            }),
          );
          for (const candidate of candidates) {
            await this.tables.captureCandidates.put(
              candidate.id,
              parse(taskCaptureCandidateSchema, {
                ...candidate,
                status: "discarded",
              }),
            );
          }
          return taskDraftBatchProjectionSchema.parse({
            batch: existingBatch,
            drafts: values(this.tables.drafts)
              .filter((draft) => draft.batchId === existingBatch.id)
              .sort((left, right) =>
                left.createdAt.localeCompare(right.createdAt),
              ),
            canEdit:
              existingBatch.ownerId === actor.id &&
              existingBatch.status !== "archived",
          });
        }
        throw new TaskCaptureError(
          "duplicate_source",
          "部分来源事项已经保存为任务草稿，请打开已有草稿批次",
        );
      }
      const now = this.now();
      const batch = parse(taskDraftBatchSchema, {
        id: this.id("tc-batch"),
        schemaVersion: 1,
        captureSessionId: session.id,
        source: session.source,
        workspaceId: session.workspaceId,
        ...(session.projectId === undefined
          ? {}
          : { projectId: session.projectId }),
        visibility: session.source.visibility,
        ownerPrincipalId: actor.principalId ?? actor.id,
        ownerId: actor.id,
        status: "active",
        revision: 1,
        createdAt: now,
        updatedAt: now,
      });
      const drafts = candidates.map((candidate) => {
        const override = overrideMap.get(candidate.id);
        const title = override?.title ?? candidate.title;
        const description =
          (override?.description ?? candidate.description).trim() ||
          defaultDescription(title, candidate.sourceExcerpt);
        const acceptance =
          candidate.acceptanceHints.length > 0
            ? [...candidate.acceptanceHints]
            : [DEFAULT_ACCEPTANCE];
        const receiverHint =
          override === undefined
            ? candidate.receiverHint
            : override.receiverHint === null
              ? undefined
              : (override.receiverHint ?? candidate.receiverHint);
        const effectiveReceiver =
          receiverHint === undefined
            ? { kind: "human" as const, id: actor.id, name: actor.name }
            : receiverHint;
        const priority = override?.priority ?? candidate.priorityHint ?? "P2";
        const projectId = candidate.projectId ?? batch.projectId;
        const draft = {
          id: this.id("tc-draft"),
          schemaVersion: 1 as const,
          batchId: batch.id,
          workspaceId: batch.workspaceId,
          sourceItemKey: candidate.sourceItemKey,
          title,
          description,
          ...(projectId === undefined ? {} : { projectId }),
          receiverType: effectiveReceiver.kind,
          receiverId: effectiveReceiver.id,
          receiverName: effectiveReceiver.name,
          priority,
          ...(override?.due === null
            ? {}
            : override?.due === undefined
              ? candidate.dueHint === undefined
                ? {}
                : { due: candidate.dueHint }
              : { due: override.due }),
          acceptance,
          collaboratorHints: candidate.collaboratorHints,
          dependsOn: [],
          readiness: "ready" as const,
          missingFields: [],
          ...(this.duplicateHint(batch.workspaceId, title) === undefined
            ? {}
            : {
                duplicate: this.duplicateHint(batch.workspaceId, title),
              }),
          status: "active" as const,
          revision: 1,
          createdAt: now,
          updatedAt: now,
        };
        return parse(taskDraftSchema, draft);
      });
      await this.tables.draftBatches.put(batch.id, batch);
      try {
        for (const draft of drafts) {
          await this.tables.drafts.put(draft.id, draft);
        }
        for (const candidate of candidates) {
          await this.tables.captureCandidates.put(
            candidate.id,
            parse(taskCaptureCandidateSchema, {
              ...candidate,
              status: "saved",
            }),
          );
        }
        await this.tables.captureSessions.put(
          session.id,
          parse(taskCaptureSessionSchema, {
            ...session,
            status: "saved",
            revision: session.revision + 1,
            updatedAt: this.now(),
          }),
        );
      } catch (cause) {
        await this.tables.draftBatches.delete(batch.id);
        for (const draft of drafts) await this.tables.drafts.delete(draft.id);
        throw cause;
      }
      await this.audit({
        actor,
        action: "task_capture.saved",
        result: "ok",
        batchId: batch.id,
        detail: { draftCount: String(drafts.length) },
      });
      await this.recordEvent({
        actor,
        type: "task.draft-batch.created.v1",
        workspaceId: batch.workspaceId,
        batchId: batch.id,
      });
      this.deps.onChange?.({
        type: "task.draft-batch.created.v1",
        workspaceId: batch.workspaceId,
        batchId: batch.id,
      });
      return taskDraftBatchProjectionSchema.parse({
        batch,
        drafts,
        canEdit: true,
      });
    });
  }

  async createManualDraft(
    rawActor: TaskCaptureActor,
    input: unknown,
  ): Promise<TaskDraftBatchProjection> {
    const actor = this.actor(rawActor);
    const parsed = parse(createManualTaskDraftInputSchema, input);
    return this.idempotent(
      actor,
      parsed.commandId,
      "create-manual-draft",
      async () => {
        const now = this.now();
        const batchId = this.id("tc-batch");
        const draftId = this.id("tc-draft");
        const description = parsed.description.trim();
        const derivedTitle = description.split(/[。！？\n]/)[0]?.trim() ?? "";
        const title = (
          parsed.title ?? (derivedTitle === "" ? "手工任务草稿" : derivedTitle)
        ).slice(0, 120);
        const acceptance =
          parsed.acceptance !== undefined && parsed.acceptance.length > 0
            ? parsed.acceptance
            : [DEFAULT_ACCEPTANCE];
        const receiver =
          parsed.receiverType === "unassigned"
            ? undefined
            : parsed.receiverId === undefined
              ? { type: "human" as const, id: actor.id, name: actor.name }
              : {
                  type: parsed.receiverType,
                  id: parsed.receiverId,
                  name: parsed.receiverName ?? parsed.receiverId,
                };
        const source = parse(taskCaptureSourceSnapshotSchema, {
          sourceType: "manual",
          sourceId: `manual:${batchId}`,
          sourceTitle: "手工任务草稿",
          workspaceId: parsed.workspaceId,
          ...(parsed.projectId === undefined
            ? {}
            : { projectId: parsed.projectId }),
          visibility: "private",
          sourceVersion: now,
          excerpt: description,
          messageIds: [],
          actionItemIds: [],
          reportSectionIds: [],
          participantIds: [actor.id],
        });
        const batch = parse(taskDraftBatchSchema, {
          id: batchId,
          schemaVersion: 1,
          captureSessionId: this.id("tc-session-manual"),
          source,
          workspaceId: parsed.workspaceId,
          ...(parsed.projectId === undefined
            ? {}
            : { projectId: parsed.projectId }),
          visibility: "private",
          ownerPrincipalId: actor.principalId ?? actor.id,
          ownerId: actor.id,
          status: "active",
          revision: 1,
          createdAt: now,
          updatedAt: now,
        });
        const draft = parse(taskDraftSchema, {
          id: draftId,
          schemaVersion: 1,
          batchId,
          workspaceId: parsed.workspaceId,
          sourceItemKey: `manual:${draftId}`,
          title,
          description,
          ...(parsed.projectId === undefined
            ? {}
            : { projectId: parsed.projectId }),
          receiverType: receiver?.type ?? "unassigned",
          ...(receiver === undefined
            ? {}
            : { receiverId: receiver.id, receiverName: receiver.name }),
          priority: parsed.priority,
          ...(parsed.due === undefined ? {} : { due: parsed.due }),
          acceptance,
          collaboratorHints: parsed.collaboratorHints ?? [],
          dependsOn: parsed.dependsOn ?? [],
          readiness: "ready",
          missingFields: [],
          ...(this.duplicateHint(parsed.workspaceId, title) === undefined
            ? {}
            : {
                duplicate: this.duplicateHint(parsed.workspaceId, title),
              }),
          status: "active",
          revision: 1,
          createdAt: now,
          updatedAt: now,
        });
        await this.tables.draftBatches.put(batch.id, batch);
        try {
          await this.tables.drafts.put(draft.id, draft);
        } catch (cause) {
          await this.tables.draftBatches.delete(batch.id);
          throw cause;
        }
        await this.audit({
          actor,
          action: "task_capture.manual_created",
          result: "ok",
          batchId: batch.id,
          draftId: draft.id,
        });
        await this.recordEvent({
          actor,
          type: "task.draft-batch.created.v1",
          workspaceId: batch.workspaceId,
          batchId: batch.id,
        });
        this.deps.onChange?.({
          type: "task.draft-batch.created.v1",
          workspaceId: batch.workspaceId,
          batchId: batch.id,
        });
        return taskDraftBatchProjectionSchema.parse({
          batch,
          drafts: [draft],
          canEdit: true,
        });
      },
    );
  }

  batch(rawActor: TaskCaptureActor, batchId: string): TaskDraftBatchProjection {
    const actor = this.actor(rawActor);
    const batch = this.requireBatch(batchId);
    if (!this.canView(actor, batch)) {
      throw new TaskCaptureError("forbidden", "task draft access is required");
    }
    return taskDraftBatchProjectionSchema.parse({
      batch,
      drafts: values(this.tables.drafts)
        .filter((draft) => draft.batchId === batch.id)
        .sort((left, right) => left.createdAt.localeCompare(right.createdAt)),
      canEdit: batch.ownerId === actor.id && batch.status !== "archived",
    });
  }

  inbox(
    rawActor: TaskCaptureActor,
    workspaceId: string,
  ): TaskDraftInboxProjection {
    const actor = this.actor(rawActor);
    const allDrafts = values(this.tables.drafts);
    const items = values(this.tables.draftBatches)
      .filter(
        (batch) =>
          batch.workspaceId === workspaceId &&
          batch.status !== "archived" &&
          this.canView(actor, batch),
      )
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
      .map((batch) => {
        const drafts = allDrafts.filter((draft) => draft.batchId === batch.id);
        return {
          batch,
          draftCount: drafts.length,
          readyCount: drafts.filter(
            (draft) =>
              draft.status === "active" &&
              draft.readiness === "ready" &&
              draft.duplicate === undefined,
          ).length,
          needsInfoCount: drafts.filter(
            (draft) =>
              draft.status === "active" &&
              (draft.readiness === "needs-info" ||
                draft.duplicate !== undefined),
          ).length,
          convertedCount: drafts.filter((draft) => draft.status === "converted")
            .length,
          canEdit: batch.ownerId === actor.id,
        };
      });
    return taskDraftInboxProjectionSchema.parse({
      items,
      draftCount: items.reduce((sum, item) => sum + item.draftCount, 0),
      readyCount: items.reduce((sum, item) => sum + item.readyCount, 0),
      needsInfoCount: items.reduce((sum, item) => sum + item.needsInfoCount, 0),
    });
  }

  library(
    rawActor: TaskCaptureActor,
    workspaceId: string,
  ): TaskDraftLibraryProjection {
    const actor = this.actor(rawActor);
    const batches = new Map(
      values(this.tables.draftBatches)
        .filter(
          (batch) =>
            batch.workspaceId === workspaceId &&
            batch.status !== "archived" &&
            this.canView(actor, batch),
        )
        .map((batch) => [batch.id, batch]),
    );
    const origins = new Map(
      values(this.tables.taskOrigins).map((origin) => [origin.draftId, origin]),
    );
    const items = values(this.tables.drafts)
      .filter(
        (draft) =>
          draft.workspaceId === workspaceId &&
          draft.status !== "ignored" &&
          batches.has(draft.batchId),
      )
      .map((draft) => {
        const batch = batches.get(draft.batchId)!;
        const taskId =
          origins.get(draft.id)?.taskId ??
          (draft.status === "linked"
            ? draft.duplicate?.candidateTaskId
            : undefined);
        return {
          batch,
          draft,
          canEdit: batch.ownerId === actor.id,
          ...(taskId === undefined ? {} : { taskId }),
        };
      })
      .sort((left, right) =>
        right.draft.updatedAt.localeCompare(left.draft.updatedAt),
      );
    return taskDraftLibraryProjectionSchema.parse({
      items,
      activeCount: items.length,
      readyCount: items.filter(
        (item) =>
          item.draft.status === "active" &&
          item.draft.readiness === "ready" &&
          item.draft.duplicate === undefined,
      ).length,
      needsInfoCount: items.filter(
        (item) =>
          item.draft.status === "active" &&
          (item.draft.readiness === "needs-info" ||
            item.draft.duplicate !== undefined),
      ).length,
    });
  }

  async updateDraft(
    rawActor: TaskCaptureActor,
    input: unknown,
  ): Promise<TaskDraft> {
    const actor = this.actor(rawActor);
    const parsed = parse(updateTaskDraftInputSchema, input);
    return this.idempotent(
      actor,
      parsed.commandId,
      "update-draft",
      async () => {
        const current = this.requireDraft(parsed.draftId);
        const batch = this.requireBatch(current.batchId);
        this.requireOwner(actor, batch);
        if (batch.status === "archived") {
          throw new TaskCaptureError(
            "conflict",
            "task draft batch is archived",
          );
        }
        if (
          current.status === "converting" ||
          current.status === "converted" ||
          current.status === "linked"
        ) {
          throw new TaskCaptureError("conflict", "task draft is frozen");
        }
        if (current.revision !== parsed.expectedRevision) {
          throw new TaskCaptureError("conflict", "task draft revision changed");
        }
        const patch = parsed.patch;
        const nextBase = {
          ...current,
          ...(patch.title === undefined ? {} : { title: patch.title }),
          ...(patch.description === undefined
            ? {}
            : { description: patch.description }),
          ...(patch.projectId === null
            ? { projectId: undefined }
            : patch.projectId === undefined
              ? {}
              : { projectId: patch.projectId }),
          ...(patch.receiverType === undefined
            ? {}
            : { receiverType: patch.receiverType }),
          ...(patch.receiverId === null
            ? { receiverId: undefined }
            : patch.receiverId === undefined
              ? {}
              : { receiverId: patch.receiverId }),
          ...(patch.receiverName === null
            ? { receiverName: undefined }
            : patch.receiverName === undefined
              ? {}
              : { receiverName: patch.receiverName }),
          ...(patch.priority === undefined ? {} : { priority: patch.priority }),
          ...(patch.due === null
            ? { due: undefined }
            : patch.due === undefined
              ? {}
              : { due: patch.due }),
          ...(patch.acceptance === undefined
            ? {}
            : { acceptance: patch.acceptance }),
          ...(patch.collaboratorHints === undefined
            ? {}
            : { collaboratorHints: patch.collaboratorHints }),
          ...(patch.dependsOn === undefined
            ? {}
            : { dependsOn: patch.dependsOn }),
          status:
            current.status === "conversion-failed"
              ? ("conversion-failed" as const)
              : ("active" as const),
          revision: current.revision + 1,
          updatedAt: this.now(),
        };
        const missingFields = missingCandidateFields({
          description: nextBase.description,
          acceptance: nextBase.acceptance,
        });
        const next = parse(taskDraftSchema, {
          ...nextBase,
          readiness: missingFields.length === 0 ? "ready" : "needs-info",
          missingFields,
          ...(this.duplicateHint(nextBase.workspaceId, nextBase.title) ===
          undefined
            ? { duplicate: undefined }
            : {
                duplicate: this.duplicateHint(
                  nextBase.workspaceId,
                  nextBase.title,
                ),
              }),
        });
        await this.tables.drafts.put(next.id, next);
        await this.tables.draftBatches.put(
          batch.id,
          parse(taskDraftBatchSchema, {
            ...batch,
            revision: batch.revision + 1,
            updatedAt: this.now(),
          }),
        );
        return next;
      },
    );
  }

  async linkDraft(
    rawActor: TaskCaptureActor,
    input: unknown,
  ): Promise<TaskDraft> {
    const actor = this.actor(rawActor);
    const parsed = parse(linkTaskDraftInputSchema, input);
    return this.idempotent(actor, parsed.commandId, "link-draft", async () => {
      const current = this.requireDraft(parsed.draftId);
      const batch = this.requireBatch(current.batchId);
      this.requireOwner(actor, batch);
      if (
        current.status === "converting" ||
        current.status === "converted" ||
        current.status === "ignored"
      ) {
        throw new TaskCaptureError("conflict", "task draft is frozen");
      }
      if (current.revision !== parsed.expectedRevision) {
        throw new TaskCaptureError("conflict", "task draft revision changed");
      }
      const target = this.deps
        .taskLookup?.()
        ?.list(current.workspaceId)
        .find((task) => task.id === parsed.taskId);
      if (target === undefined || target.archivedAt !== undefined) {
        throw new TaskCaptureError("not_found", "linked task not found");
      }
      const next = parse(taskDraftSchema, {
        ...current,
        status: "linked",
        duplicate: {
          kind: current.duplicate?.kind ?? "title",
          candidateTaskId: parsed.taskId,
          message:
            current.duplicate?.message ?? `已关联到任务 ${parsed.taskId}`,
        },
        revision: current.revision + 1,
        updatedAt: this.now(),
      });
      await this.tables.drafts.put(next.id, next);
      const existingOrigin = values(this.tables.taskOrigins).find(
        (origin) => origin.taskId === parsed.taskId,
      );
      if (existingOrigin === undefined) {
        const origin = parse(taskOriginSchema, {
          id: this.id("tc-origin"),
          taskId: parsed.taskId,
          draftId: next.id,
          batchId: batch.id,
          sourceType: batch.source.sourceType,
          sourceId: batch.source.sourceId,
          sourceTitle: batch.source.sourceTitle,
          workspaceId: next.workspaceId,
          ...(next.projectId === undefined
            ? {}
            : { projectId: next.projectId }),
          sourceItemKeys: [next.sourceItemKey],
          contextSnapshot: batch.source,
          createdByPrincipalId: actor.principalId ?? actor.id,
          createdAt: this.now(),
        });
        await this.tables.taskOrigins.put(origin.id, origin);
      }
      return next;
    });
  }

  async ignoreDraft(
    rawActor: TaskCaptureActor,
    input: { readonly draftId: string; readonly commandId: string },
  ): Promise<TaskDraft> {
    const actor = this.actor(rawActor);
    return this.idempotent(actor, input.commandId, "ignore-draft", async () => {
      const current = this.requireDraft(input.draftId);
      const batch = this.requireBatch(current.batchId);
      this.requireOwner(actor, batch);
      if (
        current.status === "converted" ||
        current.status === "converting" ||
        current.status === "linked"
      ) {
        throw new TaskCaptureError("conflict", "task draft is frozen");
      }
      const next = parse(taskDraftSchema, {
        ...current,
        status: "ignored",
        revision: current.revision + 1,
        updatedAt: this.now(),
      });
      await this.tables.drafts.put(next.id, next);
      return next;
    });
  }

  async dismissBatch(
    rawActor: TaskCaptureActor,
    input: { readonly batchId: string; readonly commandId: string },
  ): Promise<void> {
    const actor = this.actor(rawActor);
    await this.idempotent(actor, input.commandId, "dismiss-batch", async () => {
      const batch = this.requireBatch(input.batchId);
      this.requireOwner(actor, batch);
      if (batch.status === "archived") return;
      for (const draft of values(this.tables.drafts)) {
        if (
          draft.batchId === batch.id &&
          draft.status !== "converted" &&
          draft.status !== "converting"
        ) {
          await this.tables.drafts.put(
            draft.id,
            parse(taskDraftSchema, {
              ...draft,
              status: "ignored",
              revision: draft.revision + 1,
              updatedAt: this.now(),
            }),
          );
        }
      }
      await this.tables.draftBatches.put(
        batch.id,
        parse(taskDraftBatchSchema, {
          ...batch,
          status: "archived",
          revision: batch.revision + 1,
          updatedAt: this.now(),
        }),
      );
      return undefined;
    });
  }

  async undoBatch(rawActor: TaskCaptureActor, input: unknown): Promise<void> {
    const actor = this.actor(rawActor);
    const parsed = parse(undoTaskDraftBatchInputSchema, input);
    await this.idempotent(actor, parsed.commandId, "undo-batch", async () => {
      const batch = this.requireBatch(parsed.batchId);
      this.requireOwner(actor, batch);
      const drafts = values(this.tables.drafts).filter(
        (draft) => draft.batchId === batch.id,
      );
      if (
        drafts.some(
          (draft) =>
            draft.status === "converted" || draft.status === "converting",
        )
      ) {
        throw new TaskCaptureError(
          "conflict",
          "至少有一条草稿已经创建任务，不能整批撤销",
        );
      }
      for (const draft of drafts) {
        await this.tables.drafts.put(
          draft.id,
          parse(taskDraftSchema, {
            ...draft,
            status: "ignored",
            revision: draft.revision + 1,
            updatedAt: this.now(),
          }),
        );
      }
      await this.tables.draftBatches.put(
        batch.id,
        parse(taskDraftBatchSchema, {
          ...batch,
          status: "archived",
          revision: batch.revision + 1,
          updatedAt: this.now(),
        }),
      );
      const session = this.requireSession(batch.captureSessionId);
      await this.tables.captureSessions.put(
        session.id,
        parse(taskCaptureSessionSchema, {
          ...session,
          status: "dismissed",
          revision: session.revision + 1,
          updatedAt: this.now(),
        }),
      );
      await this.recordEvent({
        actor,
        type: "task.draft-batch.undone.v1",
        workspaceId: batch.workspaceId,
        batchId: batch.id,
      });
      this.deps.onChange?.({
        type: "task.draft-batch.undone.v1",
        workspaceId: batch.workspaceId,
        batchId: batch.id,
      });
      return undefined;
    });
  }

  private batchStatus(drafts: readonly TaskDraft[]): TaskDraftBatch["status"] {
    const active = drafts.filter(
      (draft) =>
        draft.status === "active" ||
        draft.status === "converting" ||
        draft.status === "conversion-failed",
    );
    const converted = drafts.filter((draft) => draft.status === "converted");
    if (active.length > 0) {
      return converted.length > 0 ? "partially-converted" : "active";
    }
    return converted.length > 0 ? "converted" : "active";
  }

  async issueCommitConfirmation(
    rawActor: TaskCaptureActor,
    input: unknown,
  ): Promise<{ confirmationId: string; expiresAt: string }> {
    const actor = this.actor(rawActor);
    const parsed = parse(issueTaskDraftCommitConfirmationInputSchema, input);
    return this.idempotent(
      actor,
      parsed.commandId,
      "issue-commit-confirmation",
      async () => {
        const batch = this.requireBatch(parsed.batchId);
        this.requireOwner(actor, batch);
        const ids = [...new Set(parsed.draftIds)];
        if (ids.length !== parsed.draftIds.length) {
          throw new TaskCaptureError(
            "invalid_input",
            "draftIds contain duplicates",
          );
        }
        for (const draftId of ids) {
          const draft = this.requireDraft(draftId);
          if (draft.batchId !== batch.id) {
            throw new TaskCaptureError(
              "invalid_input",
              "draft does not belong to the batch",
            );
          }
          if (
            draft.status !== "converted" &&
            (draft.status !== "active" || draft.readiness !== "ready")
          ) {
            throw new TaskCaptureError(
              "conflict",
              "只有可创建或已创建的草稿可以派发",
            );
          }
        }
        const now = new Date();
        const confirmation = parse(taskDraftCommitConfirmationSchema, {
          id: this.id("tc-confirm"),
          batchId: batch.id,
          draftIds: ids,
          actorId: actor.id,
          expiresAt: new Date(now.getTime() + 5 * 60 * 1_000).toISOString(),
          createdAt: now.toISOString(),
        });
        await this.tables.commitConfirmations.put(
          confirmation.id,
          confirmation,
        );
        return {
          confirmationId: confirmation.id,
          expiresAt: confirmation.expiresAt,
        };
      },
    );
  }

  async commit(
    rawActor: TaskCaptureActor,
    input: unknown,
  ): Promise<TaskDraftCommitResult> {
    const actor = this.actor(rawActor);
    const parsed = parse(commitTaskDraftsInputSchema, input);
    return this.idempotent(actor, parsed.commandId, "commit", async () => {
      const creation = this.deps.taskCreation?.();
      if (creation === undefined) {
        throw new TaskCaptureError(
          "capability_unavailable",
          "task creation capability is unavailable",
        );
      }
      const batch = this.requireBatch(parsed.batchId);
      this.requireOwner(actor, batch);
      if (batch.status === "archived") {
        throw new TaskCaptureError("conflict", "task draft batch is archived");
      }
      if (batch.revision !== parsed.expectedRevision) {
        throw new TaskCaptureError(
          "conflict",
          "task draft batch revision changed",
        );
      }
      const ids = [...new Set(parsed.draftIds)];
      if (ids.length !== parsed.draftIds.length) {
        throw new TaskCaptureError(
          "invalid_input",
          "draftIds contain duplicates",
        );
      }
      const targets = ids.map((id) => {
        const draft = this.requireDraft(id);
        if (draft.batchId !== batch.id) {
          throw new TaskCaptureError(
            "invalid_input",
            "draft does not belong to the batch",
          );
        }
        return draft;
      });
      const duplicateAllowlist = new Set(parsed.allowDuplicateDraftIds);
      if (
        parsed.allowDuplicateDraftIds.some((draftId) => !ids.includes(draftId))
      ) {
        throw new TaskCaptureError(
          "invalid_input",
          "allowDuplicateDraftIds contains unselected drafts",
        );
      }
      let confirmation: TaskDraftCommitConfirmation | undefined;
      if (parsed.createMode === "create-and-dispatch") {
        if (parsed.confirmationId === undefined) {
          throw new TaskCaptureError("forbidden", "创建并派发需要用户确认");
        }
        const stored = this.tables.commitConfirmations.get(
          parsed.confirmationId,
        );
        if (stored === undefined) {
          throw new TaskCaptureError("forbidden", "派发确认不存在");
        }
        confirmation = parse(taskDraftCommitConfirmationSchema, stored);
        if (
          confirmation.actorId !== actor.id ||
          confirmation.batchId !== batch.id ||
          confirmation.usedAt !== undefined ||
          new Date(confirmation.expiresAt).getTime() < Date.now() ||
          confirmation.draftIds.length !== ids.length ||
          confirmation.draftIds.some((draftId) => !ids.includes(draftId))
        ) {
          throw new TaskCaptureError(
            "forbidden",
            "派发确认无效、已使用或已过期",
          );
        }
        await this.tables.commitConfirmations.put(
          confirmation.id,
          parse(taskDraftCommitConfirmationSchema, {
            ...confirmation,
            usedAt: this.now(),
          }),
        );
      }
      const dispatchPort =
        parsed.createMode === "create-and-dispatch"
          ? this.deps.taskDispatch?.()
          : undefined;
      const items: TaskDraftCommitResult["items"] = [];
      for (const draft of targets) {
        if (draft.status === "converted") {
          const origin = values(this.tables.taskOrigins).find(
            (candidate) => candidate.draftId === draft.id,
          );
          let dispatchStatus: "not-requested" | "dispatched" | "failed" =
            "not-requested";
          let dispatchError: string | undefined;
          if (
            parsed.createMode === "create-and-dispatch" &&
            origin !== undefined
          ) {
            if (dispatchPort === undefined) {
              dispatchStatus = "failed";
              dispatchError = "task dispatch capability is unavailable";
            } else {
              try {
                await dispatchPort.dispatch(actor, origin.taskId);
                dispatchStatus = "dispatched";
              } catch (cause) {
                dispatchStatus = "failed";
                dispatchError =
                  cause instanceof Error
                    ? cause.message
                    : "task dispatch failed";
              }
            }
          }
          items.push({
            draftId: draft.id,
            status: "deduplicated",
            ...(origin === undefined ? {} : { taskId: origin.taskId }),
            dispatchStatus,
            ...(dispatchError === undefined ? {} : { dispatchError }),
          });
          continue;
        }
        if (
          draft.status === "ignored" ||
          draft.status === "linked" ||
          draft.readiness !== "ready"
        ) {
          items.push({
            draftId: draft.id,
            status: "skipped",
            errorCode: "draft_not_ready",
            errorMessage:
              draft.status === "ignored"
                ? "task draft is ignored"
                : "task draft is not ready",
            dispatchStatus: "not-requested",
          });
          continue;
        }
        if (
          draft.duplicate !== undefined &&
          !duplicateAllowlist.has(draft.id)
        ) {
          items.push({
            draftId: draft.id,
            status: "skipped",
            errorCode: "duplicate_unresolved",
            errorMessage: "疑似重复草稿需要先确认关联已有任务或仍然创建",
            dispatchStatus: "not-requested",
          });
          continue;
        }
        if (draft.status === "converting") {
          items.push({
            draftId: draft.id,
            status: "skipped",
            errorCode: "conversion_in_progress",
            errorMessage: "task draft conversion is already in progress",
            dispatchStatus: "not-requested",
          });
          continue;
        }
        const creationKey = `task-capture:${draft.workspaceId}:${draft.id}`;
        const conversionId = this.id("tc-conversion");
        const attempt =
          values(this.tables.conversions).filter(
            (conversion) => conversion.draftId === draft.id,
          ).length + 1;
        const conversion = parse(taskDraftConversionSchema, {
          id: conversionId,
          commandId: parsed.commandId,
          draftId: draft.id,
          draftRevision: draft.revision,
          creationKey,
          status: "committing",
          attempt,
          createdAt: this.now(),
          updatedAt: this.now(),
        });
        await this.tables.conversions.put(conversion.id, conversion);
        await this.tables.drafts.put(
          draft.id,
          parse(taskDraftSchema, {
            ...draft,
            status: "converting",
            updatedAt: this.now(),
          }),
        );
        try {
          const taskDraft = parse(taskDraftForCreationSchema, {
            workspaceId: draft.workspaceId,
            title: draft.title,
            description: draft.description,
            priority: draft.priority,
            receiverType: draft.receiverType,
            ...(draft.receiverId === undefined
              ? {}
              : { receiverId: draft.receiverId }),
            ...(draft.receiverName === undefined
              ? {}
              : { receiverName: draft.receiverName }),
            ...(draft.due === undefined ? {} : { due: draft.due }),
            acceptance: draft.acceptance,
            ...(draft.projectId === undefined
              ? {}
              : { projectId: draft.projectId }),
            collaboratorHints: draft.collaboratorHints,
          });
          const created = await creation.createFromDraft(actor, {
            draft: taskDraft,
            creationKey,
            ...(parsed.executionPolicy === undefined
              ? {}
              : { executionPolicy: parsed.executionPolicy }),
            ...(parsed.autoSubmitReview === undefined
              ? {}
              : { autoSubmitReview: parsed.autoSubmitReview }),
          });
          const existingOrigin = values(this.tables.taskOrigins).find(
            (origin) => origin.draftId === draft.id,
          );
          if (existingOrigin === undefined) {
            const origin = parse(taskOriginSchema, {
              id: this.id("tc-origin"),
              taskId: created.taskId,
              draftId: draft.id,
              batchId: batch.id,
              sourceType: batch.source.sourceType,
              sourceId: batch.source.sourceId,
              sourceTitle: batch.source.sourceTitle,
              workspaceId: draft.workspaceId,
              ...(draft.projectId === undefined
                ? {}
                : { projectId: draft.projectId }),
              sourceItemKeys: [draft.sourceItemKey],
              contextSnapshot: batch.source,
              createdByPrincipalId: actor.principalId ?? actor.id,
              createdAt: this.now(),
            });
            await this.tables.taskOrigins.put(origin.id, origin);
          }
          await this.tables.drafts.put(
            draft.id,
            parse(taskDraftSchema, {
              ...draft,
              status: "converted",
              revision: draft.revision + 1,
              updatedAt: this.now(),
            }),
          );
          await this.tables.conversions.put(
            conversion.id,
            parse(taskDraftConversionSchema, {
              ...conversion,
              ...(created.taskId === undefined
                ? {}
                : { taskId: created.taskId }),
              status: "succeeded",
              updatedAt: this.now(),
            }),
          );
          let dispatchStatus: "not-requested" | "dispatched" | "failed" =
            "not-requested";
          let dispatchError: string | undefined;
          if (parsed.createMode === "create-and-dispatch") {
            if (dispatchPort === undefined) {
              dispatchStatus = "failed";
              dispatchError = "task dispatch capability is unavailable";
            } else {
              try {
                await dispatchPort.dispatch(actor, created.taskId);
                dispatchStatus = "dispatched";
              } catch (cause) {
                dispatchStatus = "failed";
                dispatchError =
                  cause instanceof Error
                    ? cause.message
                    : "task dispatch failed";
              }
            }
          }
          items.push({
            draftId: draft.id,
            status: created.deduplicated ? "deduplicated" : "created",
            taskId: created.taskId,
            dispatchStatus,
            ...(dispatchError === undefined ? {} : { dispatchError }),
          });
        } catch (cause) {
          const message =
            cause instanceof Error ? cause.message : "task conversion failed";
          await this.tables.drafts.put(
            draft.id,
            parse(taskDraftSchema, {
              ...draft,
              status: "conversion-failed",
              revision: draft.revision + 1,
              updatedAt: this.now(),
            }),
          );
          await this.tables.conversions.put(
            conversion.id,
            parse(taskDraftConversionSchema, {
              ...conversion,
              status: "failed",
              errorCode:
                typeof cause === "object" &&
                cause !== null &&
                "code" in cause &&
                typeof cause.code === "string"
                  ? cause.code
                  : "conversion_failed",
              errorMessage: message,
              updatedAt: this.now(),
            }),
          );
          items.push({
            draftId: draft.id,
            status: "failed",
            errorCode: "conversion_failed",
            errorMessage: message,
            dispatchStatus: "not-requested",
          });
        }
      }
      const drafts = values(this.tables.drafts)
        .filter((draft) => draft.batchId === batch.id)
        .sort((left, right) => left.createdAt.localeCompare(right.createdAt));
      const nextBatch = parse(taskDraftBatchSchema, {
        ...batch,
        status: this.batchStatus(drafts),
        revision: batch.revision + 1,
        updatedAt: this.now(),
      });
      await this.tables.draftBatches.put(batch.id, nextBatch);
      const result = taskDraftCommitResultSchema.parse({
        batchId: batch.id,
        items,
        summary: {
          created: items.filter((item) => item.status === "created").length,
          deduplicated: items.filter((item) => item.status === "deduplicated")
            .length,
          failed: items.filter((item) => item.status === "failed").length,
          skipped: items.filter((item) => item.status === "skipped").length,
          dispatched: items.filter(
            (item) => item.dispatchStatus === "dispatched",
          ).length,
          dispatchFailed: items.filter(
            (item) => item.dispatchStatus === "failed",
          ).length,
        },
        batch: nextBatch,
        drafts,
      });
      await this.audit({
        actor,
        action: "task_capture.committed",
        result: result.summary.failed > 0 ? "failed" : "ok",
        batchId: batch.id,
        detail: {
          created: String(result.summary.created),
          deduplicated: String(result.summary.deduplicated),
          failed: String(result.summary.failed),
          skipped: String(result.summary.skipped),
        },
      });
      await this.recordEvent({
        actor,
        type: "task.draft-batch.committed.v1",
        workspaceId: batch.workspaceId,
        batchId: batch.id,
        taskId: result.items.find((item) => item.taskId !== undefined)?.taskId,
      });
      this.deps.onChange?.({
        type: "task.draft-batch.committed.v1",
        workspaceId: batch.workspaceId,
        batchId: batch.id,
        taskId: result.items.find((item) => item.taskId !== undefined)?.taskId,
      });
      return result;
    });
  }

  async retryConversion(
    actor: TaskCaptureActor,
    input: unknown,
  ): Promise<TaskDraftCommitResult> {
    return this.commit(actor, input);
  }

  origin(rawActor: TaskCaptureActor, taskId: string): TaskOrigin | undefined {
    const actor = this.actor(rawActor);
    const origin = values(this.tables.taskOrigins).find(
      (candidate) => candidate.taskId === taskId,
    );
    if (origin === undefined) return undefined;
    const batch = this.requireBatch(origin.batchId);
    if (!this.canView(actor, batch)) {
      throw new TaskCaptureError("forbidden", "task origin access is required");
    }
    return origin;
  }

  events(
    rawActor: TaskCaptureActor,
    workspaceId: string,
    after?: string,
  ): readonly TaskCaptureEvent[] {
    const actor = this.actor(rawActor);
    return values(this.tables.events)
      .filter((event) => {
        if (event.workspaceId !== workspaceId) return false;
        if (after !== undefined && event.occurredAt <= after) return false;
        try {
          return this.canView(actor, this.requireBatch(event.aggregateId));
        } catch {
          return false;
        }
      })
      .sort((left, right) => left.occurredAt.localeCompare(right.occurredAt));
  }
}

export type {
  TaskCaptureActor,
  TaskCaptureSession,
  TaskCaptureSessionProjection,
  TaskDraft,
  TaskDraftBatch,
  TaskDraftBatchProjection,
  TaskDraftCommitResult,
  TaskDraftInboxProjection,
  TaskOrigin,
  UpdateTaskDraftInput,
};
