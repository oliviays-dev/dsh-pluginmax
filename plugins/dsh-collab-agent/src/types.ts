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
  execution: z.enum(["builtin", "external"]).optional(),
  externalRuntimeId: z.string().trim().regex(idPattern).optional(),
  runtimeKind: z.enum(["task-worker", "continuable-session", "connector"]),
  defaultModel: agentModelSelectionSchema.optional(),
  allowedTools: z.array(z.string().trim().min(1).max(120)).max(50).default([]),
  ownerUserId: z.string().min(1).max(160),
  visibility: z.enum(["workspace", "platform"]).optional(),
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
  workspacePath: z.string().max(500).optional(),
  agentProfileId: z.string().regex(idPattern),
  personaId: z.string().regex(idPattern).optional(),
  employeeId: z.string().regex(idPattern).optional(),
  principalType: z.enum(["transitional-agent", "digital-employee"]).optional(),
  ticketId: z.string().regex(idPattern).optional(),
  source: z.enum(["workflow", "task"]),
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
  sessionId: z.string().min(1).max(200).optional(),
  externalSessionId: z.string().min(1).max(200).optional(),
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

export const EXTERNAL_AGENT_PROVIDERS = [
  "codex",
  "workbuddy",
  "command",
] as const;
export const EXTERNAL_AGENT_PROTOCOLS = ["codex-jsonl", "plain-text"] as const;

const commandSchema = z
  .string()
  .trim()
  .min(1)
  .max(500)
  .refine((value) => value !== "/" && !value.includes("\0"), {
    message: "command is invalid",
  });

export const externalAgentRuntimeSchema = z.object({
  id: z.string().trim().regex(idPattern),
  workspaceId: z.string().min(1).max(160).optional(),
  name: z.string().trim().min(1).max(120),
  provider: z.enum(EXTERNAL_AGENT_PROVIDERS),
  protocol: z.enum(EXTERNAL_AGENT_PROTOCOLS),
  command: commandSchema,
  args: z.array(z.string().min(1).max(1_000)).max(50).default([]),
  status: z.enum(["active", "disabled", "archived"]).default("active"),
  visibility: z.enum(["workspace", "platform"]).default("platform"),
  ownerUserId: z.string().min(1).max(160),
  createdAt: z.string().datetime({ precision: 3 }),
  updatedAt: z.string().datetime({ precision: 3 }),
  lastProbeAt: z.string().datetime({ precision: 3 }).optional(),
  lastProbeOk: z.boolean().optional(),
  lastProbeMessage: z.string().max(500).optional(),
});

export type ExternalAgentProvider = z.infer<
  typeof externalAgentRuntimeSchema
>["provider"];
export type ExternalAgentProtocol = z.infer<
  typeof externalAgentRuntimeSchema
>["protocol"];
export type ExternalAgentRuntime = z.infer<typeof externalAgentRuntimeSchema>;
export type AgentDeliverableBrief = z.infer<typeof agentDeliverableBriefSchema>;
export type AgentRunPayload = z.infer<typeof agentRunPayloadSchema>;
export type AgentRunStatus = z.infer<typeof agentRunStatusSchema>;
export type AgentRun = z.infer<typeof agentRunSchema>;
