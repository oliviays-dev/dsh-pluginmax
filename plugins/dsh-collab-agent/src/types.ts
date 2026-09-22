import { z } from "zod";

export const idPattern = /^[a-zA-Z][a-zA-Z0-9._-]*$/;

export const agentModelSelectionSchema = z.object({
  provider: z.string().trim().min(1).max(80),
  model: z.string().trim().min(1).max(160),
  reasoningEffort: z.string().trim().max(40).optional(),
});

export const agentProfileSchema = z.object({
  id: z.string().trim().regex(idPattern),
  workspaceId: z.string().min(1).max(160),
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(1_000).default(""),
  personaId: z.string().trim().regex(idPattern).optional(),
  runtimeKind: z.enum(["task-worker", "continuable-session", "connector"]),
  defaultModel: agentModelSelectionSchema.optional(),
  allowedTools: z.array(z.string().trim().min(1).max(120)).max(50).default([]),
  ownerUserId: z.string().min(1).max(160),
  status: z.enum(["active", "disabled"]).default("active"),
  createdAt: z.string().datetime({ precision: 3 }),
  updatedAt: z.string().datetime({ precision: 3 }),
});

export const agentDeliverableBriefSchema = z.object({
  key: z.string().regex(idPattern),
  title: z.string().min(1).max(160),
  type: z.enum(["file", "text", "link"]),
  required: z.boolean(),
  description: z.string().max(1_000).default(""),
  minTextLength: z.number().int().min(1).max(20_000).optional(),
});

export const agentRunPayloadSchema = z.object({
  instanceTitle: z.string().min(1).max(160),
  nodeName: z.string().min(1).max(160),
  nodeDescription: z.string().max(2_000).default(""),
  profileName: z.string().min(1).max(120),
  responsibleId: z.string().max(160).optional(),
  deliverables: z.array(agentDeliverableBriefSchema).max(20).default([]),
  context: z
    .record(z.string(), z.union([z.string(), z.number(), z.boolean()]))
    .default({}),
});

export const agentRunStatusSchema = z.enum([
  "queued",
  "running",
  "waiting_input",
  "succeeded",
  "failed",
  "timeout",
  "cancelled",
  "interrupted",
]);

export const agentRunSchema = z.object({
  id: z.string().min(1).max(180),
  workspaceId: z.string().min(1).max(160),
  agentProfileId: z.string().regex(idPattern),
  personaId: z.string().regex(idPattern).optional(),
  employeeId: z.string().regex(idPattern).optional(),
  principalType: z.enum(["transitional-agent", "digital-employee"]).optional(),
  ticketId: z.string().regex(idPattern).optional(),
  source: z.literal("workflow"),
  instanceId: z.string().min(1).max(160),
  nodeId: z.string().regex(idPattern),
  dispatchKey: z.string().min(1).max(400),
  trigger: z.enum(["manual-dispatch", "auto-on-ready"]),
  status: agentRunStatusSchema,
  attempt: z.number().int().positive(),
  runSeq: z.number().int().positive(),
  maxAttempts: z.number().int().min(1).max(5),
  timeoutMs: z.number().int().min(1_000).max(3_600_000),
  payload: agentRunPayloadSchema,
  promptSnapshot: z.string().max(60_000).optional(),
  output: z
    .object({
      summary: z.string().max(60_000),
      /** Original reply retained when the output contract triggered repair. */
      rawOutput: z.string().max(60_000).optional(),
      repairAttempt: z.number().int().positive().optional(),
      rawTranscriptRef: z.string().max(400).optional(),
      endedAt: z.string().datetime({ precision: 3 }).optional(),
      stopReason: z.string().max(120).optional(),
    })
    .optional(),
  error: z.string().max(1_000).optional(),
  startedAt: z.string().datetime({ precision: 3 }).optional(),
  endedAt: z.string().datetime({ precision: 3 }).optional(),
  createdBy: z.string().min(1).max(160),
  createdAt: z.string().datetime({ precision: 3 }),
  updatedAt: z.string().datetime({ precision: 3 }),
  settleDelivered: z.boolean().default(false),
});

export type AgentModelSelection = z.infer<typeof agentModelSelectionSchema>;
export type AgentProfile = z.infer<typeof agentProfileSchema>;
export type AgentDeliverableBrief = z.infer<typeof agentDeliverableBriefSchema>;
export type AgentRunPayload = z.infer<typeof agentRunPayloadSchema>;
export type AgentRunStatus = z.infer<typeof agentRunStatusSchema>;
export type AgentRun = z.infer<typeof agentRunSchema>;
