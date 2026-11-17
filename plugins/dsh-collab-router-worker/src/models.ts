import { z } from "zod";
import { taskExecutionPolicySchema } from "@pluginmax/contracts";

const idSchema = z.string().trim().min(1).max(200);
const isoTimeSchema = z.string().datetime({ precision: 3 });

export const workspaceSettingsSchema = z.object({
  workspaceId: idSchema,
  enabled: z.boolean(),
  defaultRouterAgentId: z.string().trim().min(1).max(240).optional(),
  revision: z.number().int().nonnegative(),
  updatedAt: isoTimeSchema,
  updatedBy: idSchema,
});

export const auditEventSchema = z.object({
  id: idSchema,
  workspaceId: idSchema,
  planId: z.string().trim().min(1).max(200).optional(),
  nodeId: z.string().trim().min(1).max(160).optional(),
  action: z.string().trim().min(1).max(120),
  actorId: idSchema,
  revision: z.number().int().nonnegative(),
  at: isoTimeSchema,
  detail: z.record(z.string(), z.string()).default({}),
});

export const routerAgentRegistrationSchema = z.object({
  id: idSchema,
  workspaceId: idSchema,
  agentType: z.literal("router").default("router"),
  teammateId: z.string().trim().min(1).max(180).optional(),
  templateId: z.string().trim().min(1).max(180).optional(),
  profileId: idSchema,
  employeeId: z.string().trim().min(1).max(180).optional(),
  principalId: z.string().trim().min(1).max(180).optional(),
  name: z.string().trim().min(1).max(120),
  domain: z.string().trim().min(1).max(80).default("general"),
  status: z.enum(["active", "disabled"]).default("active"),
  createdAt: isoTimeSchema,
  updatedAt: isoTimeSchema,
});

export const planNodeSchema = z.object({
  id: z.string().trim().min(1).max(120),
  title: z.string().trim().min(1).max(500),
  description: z.string().trim().min(1).max(20_000),
  taskType: z.string().trim().min(1).max(80).optional(),
  initialStatus: z
    .enum(["todo", "progress", "abnormal", "review", "done"])
    .optional(),
  type: z.enum(["task", "approval", "router"]).default("task"),
  receiverType: z.enum(["unassigned", "human", "agent", "role"]),
  receiverId: z.string().trim().min(1).max(240).optional(),
  receiverPrincipalId: z.string().trim().min(1).max(180).optional(),
  receiverName: z.string().trim().max(200).optional(),
  priority: z.enum(["P1", "P2", "P3"]).default("P2"),
  due: z.string().trim().max(40).optional(),
  acceptance: z.array(z.string().trim().min(1).max(500)).min(1).max(30),
  dependencies: z.array(z.string().trim().min(1).max(120)).max(100).default([]),
  reviewMode: z.enum(["none", "agent", "human"]).default("human"),
  risk: z.enum(["low", "medium", "high", "irreversible"]).optional(),
  humanGate: z.enum(["none", "before_start", "before_complete"]).optional(),
  evidenceRequirements: z
    .array(z.string().trim().min(1).max(500))
    .max(30)
    .optional(),
  rationale: z.string().trim().max(4_000).optional(),
  autoSubmitReview: z.boolean().optional(),
  autoApproveReview: z.boolean().optional(),
  executionPolicy: taskExecutionPolicySchema.optional(),
  maxAttempts: z.number().int().min(1).max(10).default(2),
  timeoutSeconds: z.number().int().min(1).max(604_800).default(86_400),
});

export const planGraphSchema = z.object({
  nodes: z.array(planNodeSchema).min(1).max(100),
  startNodeIds: z.array(z.string().trim().min(1).max(120)).max(100).default([]),
  warnings: z.array(z.string().trim().max(500)).max(100).default([]),
});

export const planSettingsSchema = z.object({
  advanceMode: z.enum(["auto", "manual"]).default("auto"),
  maxConcurrency: z.number().int().min(1).max(20).default(3),
  timeoutSeconds: z.number().int().min(1).max(604_800).default(86_400),
  failurePolicy: z.enum(["pause", "retry", "block"]).default("pause"),
  retryLimit: z.number().int().min(0).max(10).default(2),
  finalReview: z.boolean().default(true),
  pauseOnInput: z.boolean().default(true),
  routerAgentId: z.string().trim().min(1).max(200).optional(),
  allowedWorkers: z
    .array(z.enum(["human", "agent", "role"]))
    .min(1)
    .default(["human", "agent", "role"]),
});

export const planFinalizationModeSchema = z.enum([
  "owner_handoff",
  "router_managed",
]);

export const planRecordSchema = z.object({
  id: idSchema,
  workspaceId: idSchema,
  rootTaskId: idSchema,
  title: z.string().trim().min(1).max(500),
  priority: z.enum(["P1", "P2", "P3"]),
  due: z.string().trim().max(40).optional(),
  owner: z.string().trim().max(200).optional(),
  reviewer: z.string().trim().max(200).optional(),
  source: z.enum(["manual", "router", "template"]),
  templateInstanceId: z.string().trim().min(1).max(200).optional(),
  routerAgentId: z.string().trim().min(1).max(240).optional(),
  finalizationMode: planFinalizationModeSchema.default("owner_handoff"),
  finalDraftId: z.string().trim().min(1).max(200).optional(),
  status: z.enum([
    "draft",
    "proposed",
    "approved",
    "active",
    "finalizing",
    "paused",
    "resume_required",
    "completed",
    "cancelled",
    "failed",
  ]),
  currentVersion: z.number().int().positive().default(1),
  settings: planSettingsSchema,
  revision: z.number().int().nonnegative().default(0),
  createdBy: idSchema,
  confirmedBy: idSchema.optional(),
  confirmedByName: z.string().trim().min(1).max(200).optional(),
  confirmedByRole: z.enum(["admin", "owner", "member", "guest"]).optional(),
  confirmedAt: isoTimeSchema.optional(),
  approvedByPolicy: z.boolean().optional(),
  approvalPolicy: z.string().trim().max(200).optional(),
  createdAt: isoTimeSchema,
  updatedAt: isoTimeSchema,
});

export const planVersionSchema = z.object({
  id: idSchema,
  planId: idSchema,
  workspaceId: idSchema,
  version: z.number().int().positive(),
  status: z.enum(["draft", "proposed", "approved", "superseded", "rejected"]),
  graph: planGraphSchema,
  reason: z.string().trim().max(2_000).default(""),
  createdBy: idSchema,
  createdAt: isoTimeSchema,
});

export const nodeStateSchema = z.object({
  id: idSchema,
  planId: idSchema,
  workspaceId: idSchema,
  version: z.number().int().positive(),
  nodeId: z.string().trim().min(1).max(120),
  status: z.enum([
    "waiting",
    "ready",
    "dispatching",
    "running",
    "submitted",
    "review",
    "accepted",
    "needs_input",
    "blocked",
    "failed",
    "cancelled",
  ]),
  attempt: z.number().int().nonnegative().default(0),
  taskId: z.string().trim().min(1).max(180).optional(),
  runId: z.string().trim().min(1).max(180).optional(),
  lastError: z.string().trim().max(2_000).optional(),
  updatedAt: isoTimeSchema,
});

export const dispatchBindingSchema = z.object({
  id: idSchema,
  dispatchKey: idSchema,
  planId: idSchema,
  workspaceId: idSchema,
  version: z.number().int().positive(),
  nodeId: z.string().trim().min(1).max(120),
  attempt: z.number().int().positive(),
  taskId: z.string().trim().min(1).max(180),
  runId: z.string().trim().min(1).max(180).optional(),
  status: z.enum(["created", "dispatched", "failed"]),
  createdAt: isoTimeSchema,
  updatedAt: isoTimeSchema,
});

export const routerCycleSchema = z.object({
  id: idSchema,
  workspaceId: idSchema,
  rootTaskId: idSchema,
  planId: z.string().trim().min(1).max(200).optional(),
  routerAgentId: idSchema,
  kind: z.enum(["plan", "replan", "finalize"]),
  trigger: z.enum([
    "manual",
    "node_failed",
    "node_needs_input",
    "all_required_accepted",
    "replan",
  ]),
  allowSourceReplacement: z.boolean().default(false),
  requestKey: idSchema,
  createdBy: idSchema.default("system"),
  status: z.enum(["queued", "running", "submitted", "failed", "cancelled"]),
  runId: z.string().trim().min(1).max(180).optional(),
  sessionId: z.string().trim().min(1).max(200).optional(),
  error: z.string().trim().max(2_000).optional(),
  createdAt: isoTimeSchema,
  updatedAt: isoTimeSchema,
});

export const finalDraftSchema = z.object({
  id: idSchema,
  workspaceId: idSchema,
  planId: idSchema,
  rootTaskId: idSchema,
  routerAgentId: idSchema,
  summary: z.string().trim().min(1).max(60_000),
  deliverables: z
    .array(
      z.object({
        title: z.string().trim().min(1).max(300),
        reference: z.string().trim().max(1_000).optional(),
      }),
    )
    .max(100)
    .default([]),
  risks: z.array(z.string().trim().min(1).max(1_000)).max(100).default([]),
  openQuestions: z
    .array(z.string().trim().min(1).max(1_000))
    .max(100)
    .default([]),
  acceptance: z
    .array(
      z.object({
        criterion: z.string().trim().min(1).max(1_000),
        status: z.enum(["covered", "partial", "missing"]),
        evidence: z.string().trim().max(2_000).optional(),
      }),
    )
    .max(100)
    .default([]),
  createdBy: idSchema,
  createdAt: isoTimeSchema,
});

export type PlanNode = z.infer<typeof planNodeSchema>;
export type PlanGraph = z.infer<typeof planGraphSchema>;
export type PlanSettings = z.infer<typeof planSettingsSchema>;
export type PlanRecord = z.infer<typeof planRecordSchema>;
export type PlanVersion = z.infer<typeof planVersionSchema>;
export type NodeState = z.infer<typeof nodeStateSchema>;
export type DispatchBinding = z.infer<typeof dispatchBindingSchema>;
export type RouterAgentRegistration = z.infer<
  typeof routerAgentRegistrationSchema
>;
export type RouterCycle = z.infer<typeof routerCycleSchema>;
export type FinalDraft = z.infer<typeof finalDraftSchema>;
export type WorkspaceSettings = z.infer<typeof workspaceSettingsSchema>;
export type AuditEvent = z.infer<typeof auditEventSchema>;

export const routerWorkerDomainSpec = {
  name: "collab_router_worker",
  version: 1,
  tables: {
    workspace_settings: { valueSchema: workspaceSettingsSchema },
    audit_events: { valueSchema: auditEventSchema },
    router_agents: { valueSchema: routerAgentRegistrationSchema },
    plans: { valueSchema: planRecordSchema },
    plan_versions: { valueSchema: planVersionSchema },
    node_states: { valueSchema: nodeStateSchema },
    dispatch_bindings: { valueSchema: dispatchBindingSchema },
    router_cycles: { valueSchema: routerCycleSchema },
    final_drafts: { valueSchema: finalDraftSchema },
  },
} as const;
