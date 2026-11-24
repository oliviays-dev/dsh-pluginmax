import { z } from "zod";
import {
  taskCaptureCandidateSchema,
  taskCaptureEventSchema,
  taskCaptureSessionSchema,
  taskDraftBatchSchema,
  taskDraftCommitConfirmationSchema,
  taskDraftConversionSchema,
  taskDraftSchema,
  taskOriginSchema,
} from "@pluginmax/contracts";

export interface KvTableLike<V> {
  get(key: string): V | undefined;
  entries(): IterableIterator<[string, V]>;
  keys(): IterableIterator<string>;
  get size(): number;
  put(key: string, value: V): Promise<void>;
  delete(key: string): Promise<boolean>;
}

export const taskCaptureIdempotencySchema = z.object({
  key: z.string().min(1).max(700),
  actorId: z.string().trim().min(1).max(200),
  operation: z.string().trim().min(1).max(120),
  commandId: z.string().trim().min(1).max(240),
  // Void commands omit `result` when persisted as JSON. Keep old records readable.
  result: z.unknown().optional(),
  createdAt: z.string().datetime({ precision: 3 }),
});
export type TaskCaptureIdempotency = z.infer<
  typeof taskCaptureIdempotencySchema
>;

export const taskCaptureAuditSchema = z.object({
  id: z.string().trim().min(1).max(240),
  actorId: z.string().trim().min(1).max(200),
  action: z.string().trim().min(1).max(120),
  batchId: z.string().trim().min(1).max(240).optional(),
  draftId: z.string().trim().min(1).max(240).optional(),
  taskId: z.string().trim().min(1).max(240).optional(),
  result: z.enum(["ok", "failed"]),
  detail: z.record(z.string(), z.string()).default({}),
  createdAt: z.string().datetime({ precision: 3 }),
});
export type TaskCaptureAudit = z.infer<typeof taskCaptureAuditSchema>;

export const taskCaptureDomainSpec = {
  name: "collab_task_capture",
  version: 1,
  tables: {
    capture_sessions: { valueSchema: taskCaptureSessionSchema },
    capture_candidates: { valueSchema: taskCaptureCandidateSchema },
    draft_batches: { valueSchema: taskDraftBatchSchema },
    drafts: { valueSchema: taskDraftSchema },
    commit_confirmations: {
      valueSchema: taskDraftCommitConfirmationSchema,
    },
    conversions: { valueSchema: taskDraftConversionSchema },
    task_origins: { valueSchema: taskOriginSchema },
    events: { valueSchema: taskCaptureEventSchema },
    idempotency: { valueSchema: taskCaptureIdempotencySchema },
    audit: { valueSchema: taskCaptureAuditSchema },
  },
} as const;
