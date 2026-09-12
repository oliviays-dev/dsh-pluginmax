import { z } from "zod";

export const idPattern = /^[a-zA-Z][a-zA-Z0-9._-]*$/;

export const executorSchema = z.object({
  kind: z.enum(["system", "user", "agent"]),
  id: z.string().trim().min(1).max(120),
  label: z.string().trim().max(120).optional(),
});

export const approverSchema = z.object({
  kind: z.enum(["user", "agent"]),
  id: z.string().trim().min(1).max(120),
  name: z.string().trim().min(1).max(120),
});

export const actorRefSchema = z.object({
  kind: z.enum(["user", "agent"]),
  id: z.string().trim().min(1).max(120),
  label: z.string().trim().max(120).optional(),
});

export const deliverableRequirementSchema = z.object({
  key: z.string().trim().regex(idPattern),
  title: z.string().trim().min(1).max(160),
  type: z.enum(["file", "text", "link"]),
  required: z.boolean().default(false),
  description: z.string().trim().max(1_000).default(""),
  accept: z
    .array(
      z
        .string()
        .trim()
        .regex(/^\.[a-zA-Z0-9]{1,16}$/),
    )
    .default([]),
  minTextLength: z.number().int().min(1).max(20_000).optional(),
  maxFiles: z.number().int().min(1).max(10).default(1),
});

export const deliverableStateSchema = z.object({
  requirementKey: z.string().regex(idPattern),
  latestSubmissionId: z.string().min(1).max(180).optional(),
  status: z.enum(["pending", "submitted", "rejected"]),
  submittedAt: z.string().datetime({ precision: 3 }).optional(),
  submittedBy: z.string().min(1).max(160).optional(),
  onBehalfOf: z.string().min(1).max(160).optional(),
});

export const workflowArtifactSchema = z.object({
  id: z.string().min(1).max(180),
  fileName: z.string().min(1).max(255),
  mimeType: z.string().min(1).max(160),
  size: z
    .number()
    .int()
    .nonnegative()
    .max(20 * 1024 * 1024),
  checksum: z.string().regex(/^[a-f0-9]{64}$/),
  storagePath: z.string().min(1).max(1_024),
});

export const workflowNodeSchema = z.object({
  id: z.string().trim().regex(idPattern),
  name: z.string().trim().min(1).max(160),
  type: z.enum(["task", "service", "approval", "decision", "subworkflow"]),
  description: z.string().trim().max(2_000).default(""),
  executor: executorSchema,
  responsible: actorRefSchema.optional(),
  deliverables: z.array(deliverableRequirementSchema).default([]),
  approvers: z.array(approverSchema).default([]),
  approvalPolicy: z.enum(["all", "any"]).default("all"),
  metricExpression: z.string().trim().max(500).optional(),
  subworkflowKey: z.string().trim().regex(idPattern).optional(),
  subworkflowVersion: z.number().int().positive().optional(),
});

export const workflowEdgeSchema = z.object({
  id: z.string().trim().regex(idPattern),
  from: z.string().trim().regex(idPattern),
  to: z.string().trim().regex(idPattern),
  condition: z.string().trim().max(500).optional(),
  result: z.enum(["approved", "rejected"]).optional(),
  default: z.boolean().default(false),
  breakCondition: z.string().trim().max(500).optional(),
  label: z.string().trim().max(160).optional(),
});

export const variableSchema = z.object({
  name: z.string().trim().regex(idPattern),
  value: z.union([z.string(), z.number(), z.boolean()]),
});

export const workflowGraphSchema = z.object({
  key: z.string().trim().regex(idPattern),
  version: z.number().int().positive(),
  name: z.string().trim().min(1).max(160),
  description: z.string().trim().max(2_000).default(""),
  variables: z.array(variableSchema).default([]),
  nodes: z.array(workflowNodeSchema).min(1),
  edges: z.array(workflowEdgeSchema).default([]),
  startNodeIds: z.array(z.string().trim().regex(idPattern)).default([]),
  warnings: z.array(z.string()).default([]),
});

export const nodeStateSchema = z.object({
  nodeId: z.string(),
  status: z.enum([
    "waiting",
    "ready",
    "running",
    "blocked",
    "completed",
    "skipped",
    "failed",
  ]),
  attempts: z.number().int().positive().default(1),
  assignedTo: z.string().trim().max(160).optional(),
  note: z.string().trim().max(2_000).optional(),
  approvals: z
    .record(
      z.string(),
      z.object({
        approver: approverSchema,
        status: z.enum(["pending", "approved", "rejected", "delegated"]),
        at: z.string().optional(),
        note: z.string().max(500).optional(),
      }),
    )
    .default({}),
  deliverables: z.record(z.string(), deliverableStateSchema).default({}),
  enteredAt: z.string().optional(),
  completedAt: z.string().optional(),
  childInstanceId: z.string().optional(),
});

export const workflowDefinitionSchema = z.object({
  id: z.string().min(1).max(160),
  workspaceId: z.string().min(1).max(160),
  key: z.string().regex(idPattern),
  version: z.number().int().positive(),
  name: z.string().min(1).max(160),
  description: z.string().max(2_000).default(""),
  sourceMd: z.string().min(1).max(200_000),
  graph: workflowGraphSchema,
  status: z.enum(["active", "archived"]),
  createdBy: z.string().min(1).max(160),
  createdAt: z.string().datetime({ precision: 3 }),
  updatedAt: z.string().datetime({ precision: 3 }),
});

export const workflowInstanceSchema = z.object({
  id: z.string().min(1).max(160),
  workspaceId: z.string().min(1).max(160),
  definitionId: z.string().min(1).max(160),
  definitionKey: z.string().regex(idPattern),
  definitionVersion: z.number().int().positive(),
  title: z.string().min(1).max(160),
  status: z.enum([
    "running",
    "waiting",
    "blocked",
    "completed",
    "cancelled",
    "failed",
  ]),
  sessionId: z.string().min(1).max(160).optional(),
  relatedSessionIds: z.array(z.string().min(1).max(160)).default([]),
  context: z
    .record(z.string(), z.union([z.string(), z.number(), z.boolean()]))
    .default({}),
  nodes: z.record(z.string(), nodeStateSchema),
  parentInstanceId: z.string().min(1).max(160).optional(),
  parentNodeId: z.string().min(1).max(160).optional(),
  createdBy: z.string().min(1).max(160),
  createdAt: z.string().datetime({ precision: 3 }),
  updatedAt: z.string().datetime({ precision: 3 }),
});

export const workflowEventSchema = z.object({
  id: z.string().min(1).max(180),
  workspaceId: z.string().min(1).max(160),
  instanceId: z.string().min(1).max(160),
  nodeId: z.string().regex(idPattern).optional(),
  kind: z.string().min(1).max(80),
  actorId: z.string().min(1).max(160),
  actorKind: z.enum(["user", "agent", "system"]),
  actorName: z.string().min(1).max(160),
  message: z.string().max(1_000),
  data: z.record(z.string(), z.unknown()).default({}),
  at: z.string().datetime({ precision: 3 }),
});

export type Executor = z.infer<typeof executorSchema>;
export type ActorRef = z.infer<typeof actorRefSchema>;
export type DeliverableRequirement = z.infer<
  typeof deliverableRequirementSchema
>;
export type DeliverableState = z.infer<typeof deliverableStateSchema>;
export type WorkflowArtifact = z.infer<typeof workflowArtifactSchema>;
export type Approver = z.infer<typeof approverSchema>;
export type WorkflowNode = z.infer<typeof workflowNodeSchema>;
export type WorkflowEdge = z.infer<typeof workflowEdgeSchema>;
export type WorkflowVariable = z.infer<typeof variableSchema>;
export type WorkflowGraph = z.infer<typeof workflowGraphSchema>;
export type WorkflowNodeState = z.infer<typeof nodeStateSchema>;
export type WorkflowDefinition = z.infer<typeof workflowDefinitionSchema>;
export type WorkflowInstance = z.infer<typeof workflowInstanceSchema>;
export type WorkflowEvent = z.infer<typeof workflowEventSchema>;

export const workflowSubmissionSchema = z.object({
  id: z.string().min(1).max(180),
  workspaceId: z.string().min(1).max(160),
  instanceId: z.string().min(1).max(160),
  nodeId: z.string().regex(idPattern),
  requirementKey: z.string().regex(idPattern),
  requirementTitle: z.string().min(1).max(160),
  type: z.enum(["file", "text", "link"]),
  value: z.string().max(100_000).default(""),
  artifacts: z.array(workflowArtifactSchema).max(10).default([]),
  submittedBy: z.string().min(1).max(160),
  submittedByName: z.string().max(160),
  onBehalfOf: z.string().min(1).max(160).optional(),
  submittedAt: z.string().datetime({ precision: 3 }),
  status: z.enum(["submitted", "rejected"]),
  note: z.string().max(500).optional(),
});

export type WorkflowSubmission = z.infer<typeof workflowSubmissionSchema>;
