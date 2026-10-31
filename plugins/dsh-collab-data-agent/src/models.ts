import { z } from "zod";

export const DATA_AGENT_ID = "data-agent" as const;
export const DATA_AGENT_TEMPLATE_ID = "sys-data-agent" as const;
export const DATA_AGENT_API_PREFIX = "/api/collab/data-agent";

export const idSchema = z.string().trim().min(1).max(200);
export const isoTimeSchema = z.string().datetime({ precision: 3 });
export const jsonObjectSchema = z.record(z.string(), z.unknown());

export const registeredEntityTypeSchema = z.enum([
  "task",
  "workflow",
  "workflow_node",
  "meeting",
  "metric_card",
]);

export const selectionKindSchema = z.enum([
  "component",
  "metric",
  "text",
  "chart",
  "media",
  "record",
]);

export const dataAgentSelectionContextSchema = z.object({
  kind: selectionKindSchema,
  entityType: registeredEntityTypeSchema.optional(),
  entityId: idSchema.optional(),
  title: z.string().trim().min(1).max(240),
  excerpt: z.string().trim().max(4_000),
  source: z.object({
    workspaceId: idSchema,
    projectId: idSchema.optional(),
    page: z.enum(["workbench", "task", "meeting", "project", "workflow"]),
    entityRef: z.string().trim().max(500).optional(),
    timeRange: z
      .object({
        from: isoTimeSchema,
        to: isoTimeSchema,
      })
      .optional(),
  }),
  snapshot: z
    .object({
      text: z.string().max(8_000).optional(),
      imageRef: z.string().max(1_000).optional(),
      componentSchemaVersion: z.string().trim().max(80).optional(),
      values: jsonObjectSchema.optional(),
    })
    .optional(),
});

export const timeRangeSchema = z.enum(["today", "7d", "30d", "month"]);

export const workspaceConfigSchema = z.object({
  workspaceId: idSchema,
  teammateId: z.literal(DATA_AGENT_ID),
  dataConnectionIds: z.array(idSchema).max(50).default([]),
  defaultProjectId: idSchema.optional(),
  defaultTimeRange: timeRangeSchema.default("7d"),
  timezone: z.string().trim().min(1).max(80).default("Asia/Shanghai"),
  clarificationMode: z
    .enum(["hybrid", "always-ask", "default-first"])
    .default("hybrid"),
  maxRowsPerQuery: z.number().int().min(1).max(100_000).default(500),
  queryTimeoutMs: z.number().int().min(1_000).max(300_000).default(15_000),
  preferredMetricIds: z.array(idSchema).max(50).default([]),
  insightSubscriptions: z.array(jsonObjectSchema).max(20).default([]),
  reportSubscriptions: z.array(jsonObjectSchema).max(20).default([]),
  externalRuntimeId: idSchema.optional(),
  revision: z.number().int().min(1),
  updatedAt: isoTimeSchema,
  updatedBy: idSchema,
});

export const conversationVisibilitySchema = z.enum([
  "private",
  "project",
  "workspace",
  "meeting",
]);
export const archiveOwnerTypeSchema = z.enum([
  "user",
  "project",
  "workspace",
  "meeting",
]);

export const conversationSchema = z.object({
  id: idSchema,
  ownerType: archiveOwnerTypeSchema,
  ownerId: idSchema,
  ownerUserId: idSchema,
  workspaceId: idSchema,
  projectId: idSchema.optional(),
  meetingId: idSchema.optional(),
  agentId: z.literal(DATA_AGENT_ID),
  title: z.string().trim().min(1).max(200),
  visibility: conversationVisibilitySchema,
  sourcePage: z.enum(["workbench", "task", "meeting", "project", "workflow"]),
  timeRange: z
    .object({
      from: isoTimeSchema,
      to: isoTimeSchema,
    })
    .optional(),
  createdAt: isoTimeSchema,
  updatedAt: isoTimeSchema,
  archivedAt: isoTimeSchema.optional(),
});

export const attachmentSchema = z.object({
  id: idSchema,
  conversationId: idSchema,
  messageId: idSchema.optional(),
  kind: selectionKindSchema,
  entityType: registeredEntityTypeSchema.optional(),
  entityId: idSchema.optional(),
  title: z.string().trim().min(1).max(240),
  excerpt: z.string().max(8_000),
  sourcePage: z.enum(["workbench", "task", "meeting", "project", "workflow"]),
  sourceWorkspaceId: idSchema,
  sourceProjectId: idSchema.optional(),
  deepLink: z.string().max(1_000).optional(),
  snapshot: jsonObjectSchema,
  createdAt: isoTimeSchema,
});

export const messageSchema = z.object({
  id: idSchema,
  conversationId: idSchema,
  senderType: z.enum(["user", "ai-partner", "system"]),
  senderId: idSchema,
  content: z.string().max(120_000),
  contextAttachmentIds: z.array(idSchema).max(20).default([]),
  runId: idSchema.optional(),
  reportId: idSchema.optional(),
  createdAt: isoTimeSchema,
});

export const runStatusSchema = z.enum([
  "queued",
  "running",
  "waiting_input",
  "succeeded",
  "failed",
  "timeout",
  "cancelled",
  "interrupted",
]);

export const runModeSchema = z.enum(["chat", "report"]);

export const queryEvidenceSchema = z.object({
  queryRunId: idSchema,
  datasetId: idSchema,
  metricIds: z.array(idSchema).max(20),
  metricVersionSnapshot: z.record(z.string(), z.string()),
  status: z.enum([
    "planned",
    "running",
    "succeeded",
    "failed",
    "timeout",
    "cancelled",
  ]),
  rowCount: z.number().int().nonnegative().optional(),
  scannedRows: z.number().int().nonnegative().optional(),
  truncated: z.boolean().optional(),
  dataCutoffAt: isoTimeSchema.optional(),
  permissionSummary: z.string().trim().max(2_000).optional(),
});
export type DataAgentQueryEvidence = z.infer<typeof queryEvidenceSchema>;

export const runSchema = z.object({
  id: idSchema,
  conversationId: idSchema,
  workspaceId: idSchema,
  projectId: idSchema.optional(),
  agentRunId: idSchema.optional(),
  runtimeSessionId: idSchema.optional(),
  contextPackId: idSchema.optional(),
  contextReceiptId: idSchema.optional(),
  runtimeProfileId: idSchema.optional(),
  runtimeProfileRevision: z.string().trim().max(200).optional(),
  mode: runModeSchema.default("report"),
  status: runStatusSchema,
  prompt: z.string().max(120_000),
  title: z.string().trim().min(1).max(240),
  error: z.string().max(4_000).optional(),
  output: z.string().max(120_000).optional(),
  usedTools: z.array(z.string().max(120)).max(100).default([]),
  queryEvidence: z.array(queryEvidenceSchema).max(50).default([]),
  dataCutoffAt: isoTimeSchema.optional(),
  startedAt: isoTimeSchema.optional(),
  endedAt: isoTimeSchema.optional(),
  createdAt: isoTimeSchema,
  updatedAt: isoTimeSchema,
});

export const reportImageSchema = z.object({
  name: z.string().trim().min(1).max(160),
  mediaType: z.literal("image/svg+xml"),
  content: z.string().max(500_000),
  alt: z.string().trim().max(240),
});

export const reportSchema = z.object({
  id: idSchema,
  conversationId: idSchema,
  runId: idSchema,
  version: z.number().int().min(1),
  title: z.string().trim().min(1).max(240),
  summary: z.string().max(2_000),
  markdown: z.string().max(400_000),
  images: z.array(reportImageSchema).max(12).default([]),
  ownerType: archiveOwnerTypeSchema,
  ownerId: idSchema,
  visibility: conversationVisibilitySchema,
  dataCutoffAt: isoTimeSchema,
  metricDefinition: z.string().max(4_000),
  queryEvidence: z.array(queryEvidenceSchema).max(50).default([]),
  sourceRefs: z.array(z.string().max(1_000)).max(100).default([]),
  createdAt: isoTimeSchema,
});

export const htmlArtifactSchema = z.object({
  id: idSchema,
  reportId: idSchema,
  reportVersion: z.number().int().min(1),
  content: z.string().max(2_000_000),
  createdBy: idSchema,
  createdAt: isoTimeSchema,
});

export const auditEventSchema = z.object({
  id: idSchema,
  workspaceId: idSchema.optional(),
  actorUserId: idSchema,
  action: z.string().trim().min(1).max(120),
  result: z.enum(["ok", "failed"]),
  conversationId: idSchema.optional(),
  runId: idSchema.optional(),
  reportId: idSchema.optional(),
  detail: z.record(z.string(), z.string()).default({}),
  createdAt: isoTimeSchema,
});

export const dataAgentDomainSpec = {
  name: "collab_data_agent",
  version: 1,
  tables: {
    workspace_configs: { valueSchema: workspaceConfigSchema },
    conversations: { valueSchema: conversationSchema },
    messages: { valueSchema: messageSchema },
    attachments: { valueSchema: attachmentSchema },
    runs: { valueSchema: runSchema },
    reports: { valueSchema: reportSchema },
    html_artifacts: { valueSchema: htmlArtifactSchema },
    audit: { valueSchema: auditEventSchema },
  },
} as const;

export type RegisteredEntityType = z.infer<typeof registeredEntityTypeSchema>;
export type DataAgentSelectionContext = z.infer<
  typeof dataAgentSelectionContextSchema
>;
export type DataAgentWorkspaceConfig = z.infer<typeof workspaceConfigSchema>;
export type DataAgentConversation = z.infer<typeof conversationSchema>;
export type DataAgentAttachment = z.infer<typeof attachmentSchema>;
export type DataAgentMessage = z.infer<typeof messageSchema>;
export type DataAgentRun = z.infer<typeof runSchema>;
export type DataAgentReport = z.infer<typeof reportSchema>;
export type DataAgentReportImage = z.infer<typeof reportImageSchema>;
export type DataAgentHtmlArtifact = z.infer<typeof htmlArtifactSchema>;
export type DataAgentAuditEvent = z.infer<typeof auditEventSchema>;
