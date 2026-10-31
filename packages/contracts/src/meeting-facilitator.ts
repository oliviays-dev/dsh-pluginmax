import { z } from "zod";
import {
  taskCaptureCandidateDraftSchema,
  taskCaptureIdSchema,
} from "./task-capture.js";

export const facilitatorActionItemSchema =
  taskCaptureCandidateDraftSchema.extend({
    id: taskCaptureIdSchema,
    meetingId: taskCaptureIdSchema,
    agentRunId: taskCaptureIdSchema,
    agentDefinitionId: taskCaptureIdSchema,
    personaId: taskCaptureIdSchema.optional(),
    sourceMessageIds: z.array(taskCaptureIdSchema).max(200).default([]),
    generatedAt: z.string().datetime({ precision: 3 }),
    revision: z.number().int().positive(),
  });

export type FacilitatorActionItem = z.infer<
  typeof facilitatorActionItemSchema
>;

export const facilitatorCandidateBundleSchema = z.object({
  meetingId: taskCaptureIdSchema,
  agentRunId: taskCaptureIdSchema,
  agentDefinitionId: taskCaptureIdSchema,
  personaId: taskCaptureIdSchema.optional(),
  revision: z.number().int().positive(),
  generatedAt: z.string().datetime({ precision: 3 }),
  items: z.array(facilitatorActionItemSchema).max(100),
});

export type FacilitatorCandidateBundle = z.infer<
  typeof facilitatorCandidateBundleSchema
>;

export interface FacilitatorCandidateReader {
  latest(input: {
    meetingId: string;
    sourceMessageIds?: readonly string[];
  }): Promise<FacilitatorCandidateBundle | undefined>;
}
