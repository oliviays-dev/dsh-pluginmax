import { z } from "zod";

export const taskCapabilityPackSchema = z.enum([
  "task.read.v1",
  "task.capture.v1",
  "task.execute.v1",
  "task.govern.v1",
]);
export type TaskCapabilityPack = z.infer<typeof taskCapabilityPackSchema>;

export const taskToolNameSchema = z.enum([
  "task_query",
  "task_capture_prepare",
  "task_capture_save",
  "task_capture_batch",
  "task_capture_events",
  "task_report_progress",
  "task_request_input",
  "task_submit_deliverable",
  "task_comment",
]);
export type TaskToolName = z.infer<typeof taskToolNameSchema>;

export const taskToolDescriptorSchema = z.object({
  name: taskToolNameSchema,
  capability: taskCapabilityPackSchema,
  description: z.string().trim().min(1).max(1_000),
  sideEffect: z.enum(["none", "draft-write", "task-write"]),
  requiresRun: z.literal(true).default(true),
});
export type TaskToolDescriptor = z.infer<typeof taskToolDescriptorSchema>;

export const taskToolCatalogSchema = z.object({
  protocol: z.literal("pluginmax-task-tools-v1"),
  tools: z.array(taskToolDescriptorSchema),
});
export type TaskToolCatalog = z.infer<typeof taskToolCatalogSchema>;

export const taskToolResultSchema = z.object({
  ok: z.boolean(),
  tool: taskToolNameSchema,
  data: z.unknown().optional(),
  error: z
    .object({
      code: z.string().trim().min(1).max(120),
      message: z.string().trim().min(1).max(4_000),
    })
    .optional(),
});
export type TaskToolResult = z.infer<typeof taskToolResultSchema>;
