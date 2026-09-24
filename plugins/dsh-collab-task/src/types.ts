import { z } from "zod";

export const taskIdSchema = z.string().min(1).max(160);
export const taskStatusSchema = z.enum(["todo", "progress", "review", "done"]);
export const taskPrioritySchema = z.enum(["P1", "P2", "P3"]);
export const taskReceiverTypeSchema = z.enum([
  "unassigned",
  "human",
  "agent",
  "role",
]);
export const taskActorKindSchema = z.enum(["human", "agent", "system"]);

export const taskLinkSchema = z.object({
  type: z.enum(["meeting", "workflow"]),
  id: z.string().min(1).max(200),
  label: z.string().min(1).max(300),
});

export const taskStepSchema = z.object({
  id: z.string().min(1).max(160),
  label: z.string().min(1).max(500),
  done: z.boolean(),
});

export const taskEventSchema = z.object({
  id: z.string().min(1).max(160),
  at: z.string().min(1),
  actorId: z.string().min(1).max(160),
  actorName: z.string().min(1).max(200),
  kind: z.enum([
    "created",
    "updated",
    "assigned",
    "claimed",
    "status",
    "step",
    "message",
    "comment",
    "reply",
    "nudge",
    "closed",
    "archived",
    "restored",
  ]),
  message: z.string().min(1).max(2000),
});

export const taskAttachmentSchema = z.object({
  name: z.string().min(1).max(300),
  size: z.number().int().nonnegative().optional(),
  mimeType: z.string().min(1).max(200).optional(),
  /** Workspace-relative path once the uploaded bytes are stored on disk. */
  storedPath: z.string().min(1).max(500).optional(),
});

export const taskMessageSchema = z.object({
  id: z.string().min(1).max(160),
  at: z.string().min(1),
  authorId: z.string().min(1).max(160),
  authorName: z.string().min(1).max(200),
  kind: taskActorKindSchema,
  content: z.string().min(1).max(20000),
  attachments: z.array(taskAttachmentSchema).default([]),
  runId: z.string().min(1).max(180).optional(),
  state: z
    .enum([
      "queued",
      "running",
      "succeeded",
      "failed",
      "timeout",
      "cancelled",
      "interrupted",
    ])
    .optional(),
});

export const taskReplySchema = z.object({
  id: z.string().min(1).max(160),
  at: z.string().min(1),
  authorId: z.string().min(1).max(160),
  authorName: z.string().min(1).max(200),
  kind: taskActorKindSchema,
  content: z.string().min(1).max(8000),
});

export const taskCommentSchema = z.object({
  id: z.string().min(1).max(160),
  at: z.string().min(1),
  authorId: z.string().min(1).max(160),
  authorName: z.string().min(1).max(200),
  kind: taskActorKindSchema,
  content: z.string().min(1).max(8000),
  replies: z.array(taskReplySchema).default([]),
});

export const taskRecordSchema = z.object({
  id: taskIdSchema,
  workspaceId: z.string().min(1).max(200),
  title: z.string().min(1).max(500),
  type: z.string().min(1).max(80).default("任务"),
  status: taskStatusSchema,
  priority: taskPrioritySchema,
  receiverType: taskReceiverTypeSchema,
  receiverId: z.string().min(1).max(160).optional(),
  receiverName: z.string().min(1).max(200).optional(),
  createdBy: z.string().min(1).max(160),
  createdByName: z.string().min(1).max(200),
  description: z.string().min(1).max(20000),
  acceptance: z.array(z.string().min(1).max(500)).min(1).max(30),
  due: z.string().max(40).optional(),
  links: z.array(taskLinkSchema).default([]),
  progress: z.number().int().min(0).max(100),
  /** 执行会话代数：重置会话后 +1，下一次执行换一条全新会话。 */
  sessionEpoch: z.number().int().nonnegative().default(0),
  /** Agent 完成指定产出物后，是否自动把任务推进到「待验收」。 */
  autoSubmitReview: z.boolean().default(true),
  steps: z.array(taskStepSchema).min(1).max(30),
  agentRunIds: z.array(z.string().min(1).max(180)).default([]),
  messages: z.array(taskMessageSchema).default([]),
  comments: z.array(taskCommentSchema).default([]),
  events: z.array(taskEventSchema).default([]),
  archivedAt: z.string().min(1).max(40).optional(),
  // Reserved hook for the recycle bin: a soft-deleted task keeps `deletedAt`
  // set until it is restored or purged. Nothing writes it yet.
  deletedAt: z.string().min(1).max(40).optional(),
  createdAt: z.string().min(1),
  updatedAt: z.string().min(1),
});

export type TaskRecord = z.infer<typeof taskRecordSchema>;
export type TaskEvent = z.infer<typeof taskEventSchema>;
export type TaskMessage = z.infer<typeof taskMessageSchema>;
export type TaskComment = z.infer<typeof taskCommentSchema>;
export type TaskStep = z.infer<typeof taskStepSchema>;
export type TaskLink = z.infer<typeof taskLinkSchema>;
export type TaskStatus = z.infer<typeof taskStatusSchema>;
export type TaskPriority = z.infer<typeof taskPrioritySchema>;
export type TaskReceiverType = z.infer<typeof taskReceiverTypeSchema>;
