import { z } from "zod";

const idSchema = z.string().trim().min(1).max(320);
const shortTextSchema = z.string().trim().min(1).max(4_000);
const longTextSchema = z.string().trim().min(1).max(100_000);
const isoTimeSchema = z.string().datetime({ precision: 3 });
const sha256Schema = z.string().regex(/^[a-f0-9]{64}$/);

export const planningModeSchema = z.enum(["quick", "standard", "deep"]);
export const planningStatusSchema = z.enum([
  "queued",
  "preparing",
  "understanding",
  "clarifying",
  "drafting",
  "critiquing",
  "validating",
  "review_required",
  "succeeded",
  "failed",
  "cancelled",
]);
export const planningTriggerSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("human-manual"),
    userId: idSchema,
  }),
  z.object({
    kind: z.literal("agent-assigned"),
    agentId: idSchema,
  }),
  z.object({
    kind: z.literal("task-spec-changed"),
    field: z.enum(["description", "acceptance", "due", "priority"]),
  }),
  z.object({
    kind: z.literal("agent-requested"),
    agentId: idSchema,
    reason: shortTextSchema,
  }),
  z.object({
    kind: z.literal("replan-requested"),
    userId: idSchema.optional(),
    agentId: idSchema.optional(),
  }),
]);

export const planningSourceRefSchema = z.object({
  type: z.enum([
    "task",
    "meeting",
    "minute-version",
    "workflow",
    "document",
    "chat",
    "task-comment",
    "human-edit",
    "workflow_node",
    "metric_card",
    "chart",
    "media",
    "text",
  ]),
  id: idSchema,
  version: z.string().trim().max(120).optional(),
  quote: z.string().max(4_000).optional(),
  href: z.string().trim().max(1_000).optional(),
});

export const clarificationQuestionSchema = z.object({
  id: idSchema,
  question: shortTextSchema,
  whyItMatters: z.enum([
    "changes_goal",
    "changes_acceptance",
    "changes_scope",
    "changes_dependency",
    "changes_owner",
    "changes_risk",
  ]),
  options: z.array(shortTextSchema).max(10).default([]),
  defaultAssumption: shortTextSchema.optional(),
  blocking: z.boolean().default(true),
});

export const requirementBriefSchema = z.object({
  id: idSchema,
  workspaceId: idSchema,
  planningRunId: idSchema,
  taskRevision: z.string().trim().min(1).max(80),
  version: z.number().int().positive(),
  originalRequest: longTextSchema,
  interpretedGoal: longTextSchema,
  deliverables: z
    .array(
      z.object({
        title: shortTextSchema,
        description: z.string().trim().max(20_000).optional(),
        acceptance: z.array(shortTextSchema).max(30).default([]),
      }),
    )
    .max(100)
    .default([]),
  inScope: z.array(shortTextSchema).max(100).default([]),
  outOfScope: z.array(shortTextSchema).max(100).default([]),
  constraints: z.array(shortTextSchema).max(100).default([]),
  acceptanceCriteria: z.array(shortTextSchema).max(100).default([]),
  requiredInputs: z.array(shortTextSchema).max(100).default([]),
  stakeholders: z
    .array(
      z.object({
        id: idSchema,
        name: z.string().trim().max(200).optional(),
        role: z.string().trim().max(120).optional(),
      }),
    )
    .max(100)
    .default([]),
  assumptions: z.array(shortTextSchema).max(100).default([]),
  openQuestions: z.array(clarificationQuestionSchema).max(3).default([]),
  sourceRefs: z.array(planningSourceRefSchema).max(200).default([]),
  confidence: z.enum(["high", "medium", "low"]).default("medium"),
  createdAt: isoTimeSchema,
});

export const factItemSchema = z.object({
  statement: shortTextSchema,
  sourceRef: planningSourceRefSchema.optional(),
  confidence: z.enum(["high", "medium", "low"]).default("medium"),
  impact: z.enum(["scope", "acceptance", "dependency", "owner", "risk"]),
});

export const factsLedgerSchema = z.object({
  id: idSchema,
  workspaceId: idSchema,
  planningRunId: idSchema,
  taskRevision: z.string().trim().min(1).max(80),
  version: z.number().int().positive(),
  verified: z.array(factItemSchema).max(200).default([]),
  toLookUp: z.array(factItemSchema).max(200).default([]),
  toDerive: z.array(factItemSchema).max(200).default([]),
  assumptions: z.array(factItemSchema).max(200).default([]),
  contradictions: z.array(factItemSchema).max(200).default([]),
  sourceRefs: z.array(planningSourceRefSchema).max(200).default([]),
  createdAt: isoTimeSchema,
});

export const planCriticIssueSchema = z.object({
  severity: z.enum(["info", "warning", "error"]),
  dimension: z.enum([
    "coverage",
    "executability",
    "dependency",
    "evidence",
    "sizing",
    "risk",
  ]),
  nodeId: z.string().trim().max(120).optional(),
  message: shortTextSchema,
  suggestedFix: z.string().trim().max(4_000).optional(),
});

export const planCriticReportSchema = z.object({
  id: idSchema,
  workspaceId: idSchema,
  planningRunId: idSchema,
  planId: idSchema.optional(),
  planVersionId: idSchema.optional(),
  version: z.number().int().positive(),
  verdict: z.enum(["pass", "revise", "ask_human", "reject"]),
  score: z.number().min(0).max(100),
  issues: z.array(planCriticIssueSchema).max(200).default([]),
  acceptanceCoverage: z
    .array(
      z.object({
        criterion: shortTextSchema,
        coveredByNodeIds: z.array(idSchema).max(100).default([]),
        evidenceRefs: z.array(planningSourceRefSchema).max(100).default([]),
      }),
    )
    .max(100)
    .default([]),
  sourceRefs: z.array(planningSourceRefSchema).max(200).default([]),
  createdAt: isoTimeSchema,
});

export const effectivePlanningSkillSchema = z.object({
  id: idSchema,
  name: z.string().trim().min(1).max(200),
  version: z.string().trim().min(1).max(80),
  bindingSource: z.enum(["platform", "user"]),
  mode: z.enum(["required", "default", "additive", "primary"]),
  scenes: z.array(z.string().trim().min(1).max(80)).max(20).default([]),
  instructions: longTextSchema,
  instructionsHash: sha256Schema,
  sourceRefs: z.array(planningSourceRefSchema).max(200).default([]),
});

export const planningSkillSnapshotSchema = z.object({
  id: idSchema,
  workspaceId: idSchema,
  planningRunId: idSchema,
  teammateId: idSchema.optional(),
  templateId: idSchema.optional(),
  scene: z.literal("task-planning"),
  policyVersion: z.string().trim().min(1).max(120),
  skills: z.array(effectivePlanningSkillSchema).max(20).default([]),
  excluded: z
    .array(
      z.object({
        skillId: idSchema,
        reason: z.string().trim().min(1).max(500),
      }),
    )
    .max(100)
    .default([]),
  createdAt: isoTimeSchema,
});

export const planningKnowledgeContributionSchema = z.object({
  id: idSchema,
  title: z.string().trim().min(1).max(300),
  text: longTextSchema,
  authority: z.enum(["policy", "reference"]),
  version: z.string().trim().min(1).max(120),
  sourceRefs: z.array(planningSourceRefSchema).max(200).default([]),
  processId: z.string().trim().max(200).optional(),
  confidence: z.enum(["high", "medium", "low"]).default("medium"),
});

export const planningKnowledgeReceiptSchema = z.object({
  id: idSchema,
  workspaceId: idSchema,
  planningRunId: idSchema,
  providerId: z.string().trim().min(1).max(200),
  contextPackId: z.string().trim().min(1).max(200).optional(),
  contributions: z
    .array(planningKnowledgeContributionSchema)
    .max(100)
    .default([]),
  excluded: z
    .array(
      z.object({
        id: idSchema,
        reason: z.string().trim().min(1).max(500),
      }),
    )
    .max(100)
    .default([]),
  createdAt: isoTimeSchema,
});

export const planningSettingsSchema = z.object({
  workspaceId: idSchema,
  enabled: z.boolean().default(false),
  defaultPlannerAgentId: idSchema.optional(),
  agentOwnerPolicy: z
    .object({
      autoPlanOnAssignment: z.boolean().default(true),
      autoPlanOnSpecChange: z.boolean().default(true),
      requirePlanBeforeExecution: z.boolean().default(true),
      mode: planningModeSchema.default("standard"),
      approval: z.enum(["manual", "risk-based", "auto"]).default("risk-based"),
    })
    .default({
      autoPlanOnAssignment: true,
      autoPlanOnSpecChange: true,
      requirePlanBeforeExecution: true,
      mode: "standard",
      approval: "risk-based",
    }),
  humanOwner: z
    .object({
      allowManualPlanning: z.boolean().default(true),
      defaultMode: planningModeSchema.default("standard"),
      alwaysRequireReview: z.boolean().default(true),
    })
    .default({
      allowManualPlanning: true,
      defaultMode: "standard",
      alwaysRequireReview: true,
    }),
  knowledgeProviderId: idSchema.optional(),
  revision: z.number().int().nonnegative().default(0),
  updatedBy: idSchema.default("system"),
  updatedAt: isoTimeSchema,
});

export const planningRunSchema = z.object({
  id: idSchema,
  workspaceId: idSchema,
  rootTaskId: idSchema,
  taskRevision: z.string().trim().min(1).max(80),
  trigger: planningTriggerSchema,
  eventKey: idSchema,
  receiptId: idSchema,
  mode: planningModeSchema,
  status: planningStatusSchema,
  plannerAgentId: idSchema.optional(),
  plannerTeammateId: idSchema.optional(),
  plannerProfileId: idSchema.optional(),
  plannerPrincipalId: idSchema.optional(),
  contextPackId: idSchema.optional(),
  contextReceiptId: idSchema.optional(),
  runId: idSchema.optional(),
  sessionId: idSchema.optional(),
  criticContextPackId: idSchema.optional(),
  criticContextReceiptId: idSchema.optional(),
  criticRunId: idSchema.optional(),
  criticSessionId: idSchema.optional(),
  planId: idSchema.optional(),
  planVersionId: idSchema.optional(),
  skillSnapshotId: idSchema.optional(),
  knowledgeReceiptId: idSchema.optional(),
  errorCode: z.string().trim().min(1).max(120).optional(),
  error: z.string().trim().max(4_000).optional(),
  cancelReason: z.string().trim().max(1_000).optional(),
  revision: z.number().int().nonnegative().default(0),
  createdAt: isoTimeSchema,
  updatedAt: isoTimeSchema,
  startedAt: isoTimeSchema.optional(),
  finishedAt: isoTimeSchema.optional(),
});

export const planningTriggerReceiptSchema = z.object({
  id: idSchema,
  workspaceId: idSchema,
  rootTaskId: idSchema,
  taskRevision: z.string().trim().min(1).max(80),
  eventKey: idSchema,
  triggerKey: z.string().trim().min(1).max(1_000),
  trigger: planningTriggerSchema,
  status: z.enum(["pending", "consumed", "discarded"]),
  consumedByRunId: idSchema.optional(),
  discardedReason: z.string().trim().max(1_000).optional(),
  createdAt: isoTimeSchema,
  updatedAt: isoTimeSchema,
});

export const planningEventSchema = z.object({
  id: idSchema,
  workspaceId: idSchema,
  rootTaskId: idSchema,
  planningRunId: idSchema.optional(),
  receiptId: idSchema.optional(),
  type: z.enum([
    "requested",
    "queued",
    "phase-changed",
    "receipt-merged",
    "receipt-discarded",
    "artifact-saved",
    "settings-updated",
    "review-required",
    "succeeded",
    "failed",
    "cancelled",
  ]),
  status: planningStatusSchema.optional(),
  message: z.string().trim().min(1).max(4_000),
  detail: z.record(z.string(), z.string()).default({}),
  createdAt: isoTimeSchema,
});

export const planningQualityMetricSchema = z.object({
  id: idSchema,
  workspaceId: idSchema,
  planningRunId: idSchema,
  dimension: z.enum([
    "requirement-recall",
    "requirement-precision",
    "acceptance-coverage",
    "dependency-accuracy",
    "executability",
    "right-sizing",
    "first-pass-approval",
    "latency",
    "cost",
  ]),
  score: z.number().nonnegative(),
  failureCodes: z.array(z.string().trim().min(1).max(120)).max(100).default([]),
  metadata: z.record(z.string(), z.string()).default({}),
  createdAt: isoTimeSchema,
});

export type PlanningMode = z.infer<typeof planningModeSchema>;
export type PlanningStatus = z.infer<typeof planningStatusSchema>;
export type PlanningTrigger = z.infer<typeof planningTriggerSchema>;
export type PlanningSourceRef = z.infer<typeof planningSourceRefSchema>;
export type ClarificationQuestion = z.infer<typeof clarificationQuestionSchema>;
export type RequirementBrief = z.infer<typeof requirementBriefSchema>;
export type FactsLedger = z.infer<typeof factsLedgerSchema>;
export type PlanCriticReport = z.infer<typeof planCriticReportSchema>;
export type PlanningSkillSnapshot = z.infer<typeof planningSkillSnapshotSchema>;
export type PlanningKnowledgeReceipt = z.infer<
  typeof planningKnowledgeReceiptSchema
>;
export type PlanningSettings = z.infer<typeof planningSettingsSchema>;
export type PlanningRun = z.infer<typeof planningRunSchema>;
export type PlanningTriggerReceipt = z.infer<
  typeof planningTriggerReceiptSchema
>;
export type PlanningEvent = z.infer<typeof planningEventSchema>;
export type PlanningQualityMetric = z.infer<typeof planningQualityMetricSchema>;

export const planningDomainSpec = {
  name: "collab_planning",
  version: 1,
  tables: {
    planning_settings: { valueSchema: planningSettingsSchema },
    planning_runs: { valueSchema: planningRunSchema },
    planning_trigger_receipts: {
      valueSchema: planningTriggerReceiptSchema,
    },
    requirement_briefs: { valueSchema: requirementBriefSchema },
    facts_ledgers: { valueSchema: factsLedgerSchema },
    plan_critic_reports: { valueSchema: planCriticReportSchema },
    planning_skill_snapshots: { valueSchema: planningSkillSnapshotSchema },
    planning_knowledge_receipts: {
      valueSchema: planningKnowledgeReceiptSchema,
    },
    planning_events: { valueSchema: planningEventSchema },
    planning_quality_metrics: { valueSchema: planningQualityMetricSchema },
  },
} as const;

export const ACTIVE_PLANNING_STATUSES: readonly PlanningStatus[] = [
  "queued",
  "preparing",
  "understanding",
  "clarifying",
  "drafting",
  "critiquing",
  "validating",
  "review_required",
];

export const TERMINAL_PLANNING_STATUSES: readonly PlanningStatus[] = [
  "succeeded",
  "failed",
  "cancelled",
];

export function isActivePlanningStatus(status: PlanningStatus): boolean {
  return ACTIVE_PLANNING_STATUSES.includes(status);
}

export function isTerminalPlanningStatus(status: PlanningStatus): boolean {
  return TERMINAL_PLANNING_STATUSES.includes(status);
}
