import { z } from "zod";
import { taskExecutionPolicySchema } from "./task-execution.js";

export const taskCaptureIdSchema = z.string().trim().min(1).max(240);
export const taskCaptureIsoSchema = z.string().datetime({ precision: 3 });

export const taskCaptureActorSchema = z.object({
  id: taskCaptureIdSchema,
  principalId: taskCaptureIdSchema.optional(),
  name: z.string().trim().min(1).max(200),
  kind: z.enum(["human", "agent", "system"]),
  role: z.enum(["admin", "owner", "member", "guest"]).optional(),
});
export type TaskCaptureActor = z.infer<typeof taskCaptureActorSchema>;

export const taskCaptureVisibilitySchema = z.enum([
  "private",
  "source-participants",
  "workspace",
]);
export type TaskCaptureVisibility = z.infer<typeof taskCaptureVisibilitySchema>;

export const taskCaptureSourceRefSchema = z.object({
  sourceType: z.string().trim().min(1).max(80),
  sourceId: taskCaptureIdSchema,
  sourceTitle: z.string().trim().max(300).optional(),
});
export type TaskCaptureSourceRef = z.infer<typeof taskCaptureSourceRefSchema>;

export const taskCaptureSelectionSchema = z.object({
  messageIds: z.array(taskCaptureIdSchema).max(200).default([]),
  actionItemIds: z.array(taskCaptureIdSchema).max(200).default([]),
  reportSectionIds: z.array(taskCaptureIdSchema).max(200).default([]),
  participantIds: z.array(taskCaptureIdSchema).max(500).default([]),
  text: z.string().trim().min(1).max(8_000).optional(),
  timeRange: z
    .object({
      from: taskCaptureIsoSchema.optional(),
      to: taskCaptureIsoSchema.optional(),
    })
    .optional(),
});
export type TaskCaptureSelection = z.infer<typeof taskCaptureSelectionSchema>;

export const taskParticipantHintSchema = z.object({
  kind: z.enum(["human", "agent", "role"]),
  id: taskCaptureIdSchema,
  name: z.string().trim().min(1).max(200),
});
export type TaskParticipantHint = z.infer<typeof taskParticipantHintSchema>;

export const taskCaptureSourceSnapshotSchema = z.object({
  sourceType: z.string().trim().min(1).max(80),
  sourceId: taskCaptureIdSchema,
  sourceTitle: z.string().trim().min(1).max(300),
  workspaceId: taskCaptureIdSchema,
  projectId: taskCaptureIdSchema.optional(),
  visibility: taskCaptureVisibilitySchema,
  sourceVersion: z.string().trim().min(1).max(160),
  deepLink: z.string().trim().max(1_000).optional(),
  excerpt: z.string().trim().max(8_000).default(""),
  messageIds: z.array(taskCaptureIdSchema).max(200).default([]),
  actionItemIds: z.array(taskCaptureIdSchema).max(200).default([]),
  reportSectionIds: z.array(taskCaptureIdSchema).max(200).default([]),
  participantIds: z.array(taskCaptureIdSchema).max(500).default([]),
  timeRange: z
    .object({
      from: taskCaptureIsoSchema.optional(),
      to: taskCaptureIsoSchema.optional(),
    })
    .optional(),
});
export type TaskCaptureSourceSnapshot = z.infer<
  typeof taskCaptureSourceSnapshotSchema
>;

export const taskCaptureCandidateDraftSchema = z.object({
  sourceItemKey: z.string().trim().min(1).max(300),
  title: z.string().trim().min(1).max(500),
  description: z.string().trim().max(20_000).default(""),
  projectId: taskCaptureIdSchema.optional(),
  receiverHint: taskParticipantHintSchema.optional(),
  priorityHint: z.enum(["P1", "P2", "P3"]).optional(),
  dueHint: z.string().trim().max(40).optional(),
  acceptanceHints: z
    .array(z.string().trim().min(1).max(500))
    .max(30)
    .default([]),
  collaboratorHints: z.array(taskParticipantHintSchema).max(50).default([]),
  evidenceRefs: z
    .array(z.string().trim().min(1).max(1_000))
    .max(100)
    .default([]),
  confidence: z.enum(["high", "medium", "low"]).default("medium"),
  sourceExcerpt: z.string().trim().max(2_000).optional(),
});
export type TaskCaptureCandidateDraft = z.infer<
  typeof taskCaptureCandidateDraftSchema
>;

export const resolvedTaskCaptureSourceSchema = z.object({
  source: taskCaptureSourceSnapshotSchema,
  candidates: z.array(taskCaptureCandidateDraftSchema).min(1).max(100),
});
export type ResolvedTaskCaptureSource = z.infer<
  typeof resolvedTaskCaptureSourceSchema
>;

export const taskCaptureSessionStatusSchema = z.enum([
  "active",
  "saved",
  "dismissed",
  "expired",
]);
export type TaskCaptureSessionStatus = z.infer<
  typeof taskCaptureSessionStatusSchema
>;

export const taskCaptureCandidateSchema = z.object({
  id: taskCaptureIdSchema,
  sessionId: taskCaptureIdSchema,
  sourceItemKey: z.string().trim().min(1).max(300),
  title: z.string().trim().min(1).max(500),
  description: z.string().trim().max(20_000).default(""),
  projectId: taskCaptureIdSchema.optional(),
  receiverHint: taskParticipantHintSchema.optional(),
  priorityHint: z.enum(["P1", "P2", "P3"]).optional(),
  dueHint: z.string().trim().max(40).optional(),
  acceptanceHints: z
    .array(z.string().trim().min(1).max(500))
    .max(30)
    .default([]),
  collaboratorHints: z.array(taskParticipantHintSchema).max(50).default([]),
  evidenceRefs: z
    .array(z.string().trim().min(1).max(1_000))
    .max(100)
    .default([]),
  confidence: z.enum(["high", "medium", "low"]).default("medium"),
  sourceExcerpt: z.string().trim().max(2_000).optional(),
  missingFields: z.array(z.string().trim().min(1).max(120)).max(30).default([]),
  status: z.enum(["proposed", "saved", "discarded"]).default("proposed"),
});
export type TaskCaptureCandidate = z.infer<typeof taskCaptureCandidateSchema>;

export const taskCaptureSessionSchema = z.object({
  id: taskCaptureIdSchema,
  schemaVersion: z.literal(1).default(1),
  workspaceId: taskCaptureIdSchema,
  projectId: taskCaptureIdSchema.optional(),
  source: taskCaptureSourceSnapshotSchema,
  status: taskCaptureSessionStatusSchema,
  revision: z.number().int().positive(),
  createdByPrincipalId: taskCaptureIdSchema,
  createdById: taskCaptureIdSchema,
  createdAt: taskCaptureIsoSchema,
  updatedAt: taskCaptureIsoSchema,
  expiresAt: taskCaptureIsoSchema,
});
export type TaskCaptureSession = z.infer<typeof taskCaptureSessionSchema>;

export const taskDraftReadinessSchema = z.enum(["needs-info", "ready"]);
export const taskDraftStatusSchema = z.enum([
  "active",
  "converting",
  "converted",
  "conversion-failed",
  "linked",
  "ignored",
]);

export const taskDuplicateHintSchema = z.object({
  kind: z.enum(["source", "title"]),
  candidateTaskId: taskCaptureIdSchema.optional(),
  message: z.string().trim().min(1).max(500),
});
export type TaskDuplicateHint = z.infer<typeof taskDuplicateHintSchema>;

export const taskDraftSchema = z.object({
  id: taskCaptureIdSchema,
  schemaVersion: z.literal(1).default(1),
  batchId: taskCaptureIdSchema,
  workspaceId: taskCaptureIdSchema,
  sourceItemKey: z.string().trim().min(1).max(300),
  title: z.string().trim().min(1).max(500),
  description: z.string().trim().max(20_000).default(""),
  projectId: taskCaptureIdSchema.optional(),
  receiverType: z
    .enum(["unassigned", "human", "agent", "role"])
    .default("unassigned"),
  receiverId: taskCaptureIdSchema.optional(),
  receiverName: z.string().trim().max(200).optional(),
  priority: z.enum(["P1", "P2", "P3"]).default("P2"),
  due: z.string().trim().max(40).optional(),
  acceptance: z.array(z.string().trim().min(1).max(500)).max(30).default([]),
  collaboratorHints: z.array(taskParticipantHintSchema).max(50).default([]),
  dependsOn: z.array(taskCaptureIdSchema).max(50).default([]),
  readiness: taskDraftReadinessSchema,
  missingFields: z.array(z.string().trim().min(1).max(120)).max(30).default([]),
  duplicate: taskDuplicateHintSchema.optional(),
  status: taskDraftStatusSchema,
  revision: z.number().int().positive(),
  createdAt: taskCaptureIsoSchema,
  updatedAt: taskCaptureIsoSchema,
});
export type TaskDraft = z.infer<typeof taskDraftSchema>;

export const taskDraftBatchStatusSchema = z.enum([
  "active",
  "partially-converted",
  "converted",
  "archived",
]);

export const taskDraftBatchSchema = z.object({
  id: taskCaptureIdSchema,
  schemaVersion: z.literal(1).default(1),
  captureSessionId: taskCaptureIdSchema,
  source: taskCaptureSourceSnapshotSchema,
  workspaceId: taskCaptureIdSchema,
  projectId: taskCaptureIdSchema.optional(),
  visibility: taskCaptureVisibilitySchema,
  ownerPrincipalId: taskCaptureIdSchema,
  ownerId: taskCaptureIdSchema,
  status: taskDraftBatchStatusSchema,
  revision: z.number().int().positive(),
  createdAt: taskCaptureIsoSchema,
  updatedAt: taskCaptureIsoSchema,
});
export type TaskDraftBatch = z.infer<typeof taskDraftBatchSchema>;

export const taskOriginSchema = z.object({
  id: taskCaptureIdSchema,
  taskId: taskCaptureIdSchema,
  draftId: taskCaptureIdSchema,
  batchId: taskCaptureIdSchema,
  sourceType: z.string().trim().min(1).max(80),
  sourceId: taskCaptureIdSchema,
  sourceTitle: z.string().trim().min(1).max(300),
  workspaceId: taskCaptureIdSchema,
  projectId: taskCaptureIdSchema.optional(),
  sourceItemKeys: z.array(z.string().trim().min(1).max(300)).min(1).max(100),
  contextSnapshot: taskCaptureSourceSnapshotSchema,
  createdByPrincipalId: taskCaptureIdSchema,
  createdAt: taskCaptureIsoSchema,
});
export type TaskOrigin = z.infer<typeof taskOriginSchema>;

export const taskDraftConversionSchema = z.object({
  id: taskCaptureIdSchema,
  commandId: z.string().trim().min(1).max(240),
  draftId: taskCaptureIdSchema,
  draftRevision: z.number().int().positive(),
  creationKey: z.string().trim().min(1).max(500),
  taskId: taskCaptureIdSchema.optional(),
  status: z.enum(["committing", "succeeded", "failed"]),
  errorCode: z.string().trim().max(120).optional(),
  errorMessage: z.string().trim().max(2_000).optional(),
  attempt: z.number().int().positive(),
  createdAt: taskCaptureIsoSchema,
  updatedAt: taskCaptureIsoSchema,
});
export type TaskDraftConversion = z.infer<typeof taskDraftConversionSchema>;

export const taskPrepareCaptureInputSchema = z.object({
  sourceRef: taskCaptureSourceRefSchema,
  selection: taskCaptureSelectionSchema,
  commandId: z.string().trim().min(1).max(240),
});
export type TaskPrepareCaptureInput = z.infer<
  typeof taskPrepareCaptureInputSchema
>;

export const saveTaskDraftsInputSchema = z.object({
  sessionId: taskCaptureIdSchema,
  candidateIds: z.array(taskCaptureIdSchema).min(1).max(100),
  commandId: z.string().trim().min(1).max(240),
  expectedRevision: z.number().int().positive(),
  candidateOverrides: z
    .array(
      z.object({
        candidateId: taskCaptureIdSchema,
        title: z.string().trim().min(1).max(500).optional(),
        description: z.string().trim().max(20_000).optional(),
        priority: z.enum(["P1", "P2", "P3"]).optional(),
        due: z.string().trim().max(40).nullable().optional(),
        receiverHint: taskParticipantHintSchema.nullable().optional(),
      }),
    )
    .max(100)
    .default([]),
});
export type SaveTaskDraftsInput = z.infer<typeof saveTaskDraftsInputSchema>;

export const createManualTaskDraftInputSchema = z.object({
  workspaceId: taskCaptureIdSchema,
  title: z.string().trim().min(1).max(500).optional(),
  description: z.string().trim().min(1).max(20_000),
  projectId: taskCaptureIdSchema.optional(),
  receiverType: z
    .enum(["unassigned", "human", "agent", "role"])
    .default("human"),
  receiverId: taskCaptureIdSchema.optional(),
  receiverName: z.string().trim().max(200).optional(),
  priority: z.enum(["P1", "P2", "P3"]).default("P2"),
  due: z.string().trim().max(40).optional(),
  acceptance: z.array(z.string().trim().min(1).max(500)).max(30).optional(),
  collaboratorHints: z.array(taskParticipantHintSchema).max(50).optional(),
  dependsOn: z.array(taskCaptureIdSchema).max(50).optional(),
  commandId: z.string().trim().min(1).max(240),
});
export type CreateManualTaskDraftInput = z.infer<
  typeof createManualTaskDraftInputSchema
>;

export const undoTaskDraftBatchInputSchema = z.object({
  batchId: taskCaptureIdSchema,
  commandId: z.string().trim().min(1).max(240),
});
export type UndoTaskDraftBatchInput = z.infer<
  typeof undoTaskDraftBatchInputSchema
>;

export const updateTaskDraftInputSchema = z.object({
  draftId: taskCaptureIdSchema,
  expectedRevision: z.number().int().positive(),
  commandId: z.string().trim().min(1).max(240),
  patch: z.object({
    title: z.string().trim().min(1).max(500).optional(),
    description: z.string().trim().max(20_000).optional(),
    projectId: taskCaptureIdSchema.nullable().optional(),
    receiverType: z.enum(["unassigned", "human", "agent", "role"]).optional(),
    receiverId: taskCaptureIdSchema.nullable().optional(),
    receiverName: z.string().trim().max(200).nullable().optional(),
    priority: z.enum(["P1", "P2", "P3"]).optional(),
    due: z.string().trim().max(40).nullable().optional(),
    acceptance: z.array(z.string().trim().min(1).max(500)).max(30).optional(),
    collaboratorHints: z.array(taskParticipantHintSchema).max(50).optional(),
    dependsOn: z.array(taskCaptureIdSchema).max(50).optional(),
  }),
});
export type UpdateTaskDraftInput = z.infer<typeof updateTaskDraftInputSchema>;

export const linkTaskDraftInputSchema = z.object({
  draftId: taskCaptureIdSchema,
  taskId: taskCaptureIdSchema,
  expectedRevision: z.number().int().positive(),
  commandId: z.string().trim().min(1).max(240),
});
export type LinkTaskDraftInput = z.infer<typeof linkTaskDraftInputSchema>;

export const commitTaskDraftsInputSchema = z.object({
  batchId: taskCaptureIdSchema,
  draftIds: z.array(taskCaptureIdSchema).min(1).max(100),
  commandId: z.string().trim().min(1).max(240),
  expectedRevision: z.number().int().positive(),
  createMode: z
    .enum(["create-only", "create-and-dispatch"])
    .default("create-only"),
  confirmationId: taskCaptureIdSchema.optional(),
  allowDuplicateDraftIds: z.array(taskCaptureIdSchema).max(100).default([]),
  executionPolicy: taskExecutionPolicySchema.optional(),
  autoSubmitReview: z.boolean().optional(),
});
export type CommitTaskDraftsInput = z.infer<typeof commitTaskDraftsInputSchema>;

export const taskDraftCommitConfirmationSchema = z.object({
  id: taskCaptureIdSchema,
  batchId: taskCaptureIdSchema,
  draftIds: z.array(taskCaptureIdSchema).min(1).max(100),
  actorId: taskCaptureIdSchema,
  expiresAt: taskCaptureIsoSchema,
  usedAt: taskCaptureIsoSchema.optional(),
  createdAt: taskCaptureIsoSchema,
});
export type TaskDraftCommitConfirmation = z.infer<
  typeof taskDraftCommitConfirmationSchema
>;

export const issueTaskDraftCommitConfirmationInputSchema = z.object({
  batchId: taskCaptureIdSchema,
  draftIds: z.array(taskCaptureIdSchema).min(1).max(100),
  commandId: z.string().trim().min(1).max(240),
});
export type IssueTaskDraftCommitConfirmationInput = z.infer<
  typeof issueTaskDraftCommitConfirmationInputSchema
>;

export const taskDraftCommitItemSchema = z.object({
  draftId: taskCaptureIdSchema,
  status: z.enum(["created", "deduplicated", "failed", "skipped"]),
  taskId: taskCaptureIdSchema.optional(),
  errorCode: z.string().trim().max(120).optional(),
  errorMessage: z.string().trim().max(2_000).optional(),
  dispatchStatus: z
    .enum(["not-requested", "dispatched", "failed"])
    .default("not-requested"),
  dispatchError: z.string().trim().max(2_000).optional(),
});
export type TaskDraftCommitItem = z.infer<typeof taskDraftCommitItemSchema>;

export const taskDraftCommitResultSchema = z.object({
  batchId: taskCaptureIdSchema,
  items: z.array(taskDraftCommitItemSchema).max(100),
  summary: z.object({
    created: z.number().int().nonnegative(),
    deduplicated: z.number().int().nonnegative(),
    failed: z.number().int().nonnegative(),
    skipped: z.number().int().nonnegative(),
    dispatched: z.number().int().nonnegative().default(0),
    dispatchFailed: z.number().int().nonnegative().default(0),
  }),
  batch: taskDraftBatchSchema,
  drafts: z.array(taskDraftSchema).max(100),
});
export type TaskDraftCommitResult = z.infer<typeof taskDraftCommitResultSchema>;

export const taskCaptureSessionProjectionSchema = z.object({
  session: taskCaptureSessionSchema,
  candidates: z.array(taskCaptureCandidateSchema).max(100),
});
export type TaskCaptureSessionProjection = z.infer<
  typeof taskCaptureSessionProjectionSchema
>;

export const taskDraftBatchProjectionSchema = z.object({
  batch: taskDraftBatchSchema,
  drafts: z.array(taskDraftSchema).max(100),
  canEdit: z.boolean(),
});
export type TaskDraftBatchProjection = z.infer<
  typeof taskDraftBatchProjectionSchema
>;

export const taskDraftInboxItemSchema = z.object({
  batch: taskDraftBatchSchema,
  draftCount: z.number().int().nonnegative(),
  readyCount: z.number().int().nonnegative(),
  needsInfoCount: z.number().int().nonnegative(),
  convertedCount: z.number().int().nonnegative(),
  canEdit: z.boolean(),
});
export type TaskDraftInboxItem = z.infer<typeof taskDraftInboxItemSchema>;

export const taskDraftInboxProjectionSchema = z.object({
  items: z.array(taskDraftInboxItemSchema),
  draftCount: z.number().int().nonnegative(),
  readyCount: z.number().int().nonnegative(),
  needsInfoCount: z.number().int().nonnegative(),
});
export type TaskDraftInboxProjection = z.infer<
  typeof taskDraftInboxProjectionSchema
>;

export const taskDraftLibraryItemSchema = z.object({
  batch: taskDraftBatchSchema,
  draft: taskDraftSchema,
  canEdit: z.boolean(),
  taskId: taskCaptureIdSchema.optional(),
});
export type TaskDraftLibraryItem = z.infer<typeof taskDraftLibraryItemSchema>;

export const taskDraftLibraryProjectionSchema = z.object({
  items: z.array(taskDraftLibraryItemSchema).max(500),
  activeCount: z.number().int().nonnegative(),
  readyCount: z.number().int().nonnegative(),
  needsInfoCount: z.number().int().nonnegative(),
});
export type TaskDraftLibraryProjection = z.infer<
  typeof taskDraftLibraryProjectionSchema
>;

export const taskCaptureEventSchema = z.object({
  id: taskCaptureIdSchema,
  type: z.enum([
    "task.draft-batch.created.v1",
    "task.draft-batch.committed.v1",
    "task.draft-batch.undone.v1",
  ]),
  schemaVersion: z.literal(1).default(1),
  occurredAt: taskCaptureIsoSchema,
  workspaceId: taskCaptureIdSchema,
  aggregateType: z.literal("task-draft-batch"),
  aggregateId: taskCaptureIdSchema,
  actorPrincipalId: taskCaptureIdSchema.optional(),
  payload: z.object({
    batchId: taskCaptureIdSchema,
    taskId: taskCaptureIdSchema.optional(),
  }),
});
export type TaskCaptureEvent = z.infer<typeof taskCaptureEventSchema>;

export const taskDraftForCreationSchema = z.object({
  workspaceId: taskCaptureIdSchema,
  title: z.string().trim().min(1).max(500),
  description: z.string().trim().min(1).max(20_000),
  priority: z.enum(["P1", "P2", "P3"]),
  receiverType: z.enum(["unassigned", "human", "agent", "role"]),
  receiverId: taskCaptureIdSchema.optional(),
  receiverName: z.string().trim().max(200).optional(),
  due: z.string().trim().max(40).optional(),
  acceptance: z.array(z.string().trim().min(1).max(500)).min(1).max(30),
  projectId: taskCaptureIdSchema.optional(),
  collaboratorHints: z.array(taskParticipantHintSchema).max(50).default([]),
});
export type TaskDraftForCreation = z.infer<typeof taskDraftForCreationSchema>;

export const taskCreationFromDraftResultSchema = z.object({
  taskId: taskCaptureIdSchema,
  workspaceId: taskCaptureIdSchema,
  title: z.string().trim().min(1).max(500),
  status: z.enum(["todo", "progress", "review", "done", "cancelled"]),
  creationKey: z.string().trim().min(1).max(500),
  deduplicated: z.boolean(),
  updatedAt: taskCaptureIsoSchema,
});
export type TaskCreationFromDraftResult = z.infer<
  typeof taskCreationFromDraftResultSchema
>;

export interface TaskCaptureSourceAdapter {
  readonly sourceType: string;
  readonly version: string;
  resolve(input: {
    readonly actor: TaskCaptureActor;
    readonly sourceRef: TaskCaptureSourceRef;
    readonly selection: TaskCaptureSelection;
  }): Promise<ResolvedTaskCaptureSource>;
}
