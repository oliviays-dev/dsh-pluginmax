import { z } from "zod";

export const dataFabricIdSchema = z
  .string()
  .trim()
  .min(1)
  .max(180)
  .regex(/^[a-zA-Z0-9._:-]+$/);

const isoTimeSchema = z.string().datetime({ precision: 3 });

export const dataConnectionSchema = z.object({
  id: dataFabricIdSchema,
  workspaceId: dataFabricIdSchema,
  name: z.string().trim().min(1).max(160),
  connectorType: z.string().trim().min(1).max(120),
  status: z.enum(["active", "disabled", "error"]),
  readOnly: z.literal(true),
  maxRows: z.number().int().positive().max(100_000),
  timeoutMs: z.number().int().positive().max(300_000),
  description: z.string().trim().max(1_000).default(""),
  credentialRef: z.string().trim().min(1).max(500).optional(),
  configRef: z.string().trim().min(1).max(500).optional(),
  isFixture: z.boolean().default(false),
  createdAt: isoTimeSchema,
  updatedAt: isoTimeSchema,
});
export type DataConnection = z.infer<typeof dataConnectionSchema>;

export const datasetFieldSchema = z.object({
  id: dataFabricIdSchema,
  physicalName: z.string().trim().min(1).max(160),
  label: z.string().trim().min(1).max(160),
  dataType: z.enum(["string", "number", "boolean", "datetime"]),
  role: z.enum(["identifier", "measure", "dimension", "time"]),
  sensitivity: z
    .enum(["public", "internal", "sensitive", "restricted"])
    .default("internal"),
  description: z.string().trim().max(1_000).default(""),
});
export type DatasetField = z.infer<typeof datasetFieldSchema>;

export const datasetDimensionSchema = z.object({
  id: dataFabricIdSchema,
  fieldId: dataFabricIdSchema,
  label: z.string().trim().min(1).max(160),
});
export type DatasetDimension = z.infer<typeof datasetDimensionSchema>;

export const datasetSchema = z.object({
  id: dataFabricIdSchema,
  workspaceId: dataFabricIdSchema,
  projectIds: z.array(dataFabricIdSchema).max(100).default([]),
  connectionId: dataFabricIdSchema,
  name: z.string().trim().min(1).max(200),
  description: z.string().trim().max(2_000).default(""),
  physicalName: z.string().trim().min(1).max(300),
  timeField: dataFabricIdSchema,
  defaultGranularity: z.enum(["hour", "day", "week", "month"]),
  freshnessMinutes: z.number().int().nonnegative().max(10_000),
  fields: z.array(datasetFieldSchema).min(1).max(500),
  dimensions: z.array(datasetDimensionSchema).max(200).default([]),
  semanticModelVersion: z.string().trim().min(1).max(80),
  status: z.enum(["draft", "active", "disabled"]),
  isFixture: z.boolean().default(false),
  createdAt: isoTimeSchema,
  updatedAt: isoTimeSchema,
});
export type Dataset = z.infer<typeof datasetSchema>;

const rowFilterSchema = z
  .record(z.string(), z.array(z.string().trim().min(1).max(300)).max(100))
  .default({});

export const semanticMetricSchema = z.object({
  id: dataFabricIdSchema,
  workspaceId: dataFabricIdSchema,
  datasetId: dataFabricIdSchema,
  name: z.string().trim().min(1).max(160),
  synonyms: z.array(z.string().trim().min(1).max(120)).max(50).default([]),
  definition: z.string().trim().min(1).max(2_000),
  formulaVersion: z.string().trim().min(1).max(80),
  aggregation: z.enum(["count", "count-where", "sum", "rate"]),
  fieldId: dataFabricIdSchema.optional(),
  timeField: dataFabricIdSchema.optional(),
  unit: z.string().trim().max(40).default(""),
  filter: rowFilterSchema.optional(),
  numeratorFilter: rowFilterSchema.optional(),
  certified: z.boolean().default(false),
  status: z.enum(["draft", "active", "deprecated"]),
  createdAt: isoTimeSchema,
  updatedAt: isoTimeSchema,
});
export type SemanticMetric = z.infer<typeof semanticMetricSchema>;

export const dataPolicySchema = z.object({
  id: dataFabricIdSchema,
  workspaceId: dataFabricIdSchema,
  datasetId: dataFabricIdSchema,
  subjectType: z.enum(["user", "workspace-role"]),
  subjectId: z.string().trim().min(1).max(180),
  rowFilter: rowFilterSchema,
  deniedFields: z.array(dataFabricIdSchema).max(200).default([]),
  coverageNote: z.string().trim().max(1_000).optional(),
  maxRows: z.number().int().positive().max(100_000),
  timeoutMs: z.number().int().positive().max(300_000),
  version: z.string().trim().min(1).max(80),
  createdAt: isoTimeSchema,
  updatedAt: isoTimeSchema,
});
export type DataPolicy = z.infer<typeof dataPolicySchema>;

export const dataSkillSchema = z.object({
  id: dataFabricIdSchema,
  workspaceId: dataFabricIdSchema,
  datasetId: dataFabricIdSchema.optional(),
  name: z.string().trim().min(1).max(160),
  version: z.string().trim().min(1).max(80),
  triggers: z.array(z.string().trim().min(1).max(120)).max(100).default([]),
  instructions: z.string().trim().min(1).max(30_000),
  preferredMetricIds: z.array(dataFabricIdSchema).max(50).default([]),
  defaultTimeRange: z.enum(["today", "7d", "30d", "month"]).optional(),
  status: z.enum(["active", "disabled"]),
  createdAt: isoTimeSchema,
  updatedAt: isoTimeSchema,
});
export type DataSkill = z.infer<typeof dataSkillSchema>;

export const queryRunStatusSchema = z.enum([
  "planned",
  "running",
  "succeeded",
  "failed",
  "timeout",
  "cancelled",
]);
export type QueryRunStatus = z.infer<typeof queryRunStatusSchema>;

export const queryRunSchema = z.object({
  id: dataFabricIdSchema,
  workspaceId: dataFabricIdSchema,
  projectId: dataFabricIdSchema.optional(),
  actorUserId: z.string().trim().min(1).max(180),
  agentProfileId: z.string().trim().min(1).max(180).optional(),
  conversationId: z.string().trim().min(1).max(180).optional(),
  agentRunId: z.string().trim().min(1).max(180).optional(),
  intentSummary: z.string().trim().min(1).max(2_000),
  connectionId: dataFabricIdSchema,
  datasetId: dataFabricIdSchema,
  metricIds: z.array(dataFabricIdSchema).min(1).max(20),
  metricVersionSnapshot: z.record(z.string(), z.string()),
  normalizedQuery: z.record(z.string(), z.unknown()),
  policyVersionSnapshot: z.array(z.string()).max(50).default([]),
  status: queryRunStatusSchema,
  rowCount: z.number().int().nonnegative().optional(),
  scannedRows: z.number().int().nonnegative().optional(),
  truncated: z.boolean().optional(),
  dataCutoffAt: isoTimeSchema.optional(),
  permissionSummary: z.string().trim().max(2_000).optional(),
  durationMs: z.number().int().nonnegative().optional(),
  errorCode: z.string().trim().max(120).optional(),
  errorMessage: z.string().trim().max(2_000).optional(),
  createdAt: isoTimeSchema,
  endedAt: isoTimeSchema.optional(),
});
export type QueryRun = z.infer<typeof queryRunSchema>;

const scalarSchema = z.union([
  z.string(),
  z.number(),
  z.boolean(),
  z.null(),
]);

export const queryResultSchema = z.object({
  queryRunId: dataFabricIdSchema,
  columns: z.array(
    z.object({
      id: dataFabricIdSchema,
      label: z.string().trim().min(1).max(200),
      type: z.string().trim().min(1).max(40),
    }),
  ),
  rows: z.array(z.record(z.string(), scalarSchema)).max(100_000),
  rowCount: z.number().int().nonnegative(),
  scannedRows: z.number().int().nonnegative(),
  truncated: z.boolean(),
  dataCutoffAt: isoTimeSchema,
  freshness: z.string().trim().min(1).max(200),
  evidence: z.array(z.string().trim().min(1).max(2_000)).max(100),
  permissionSummary: z.string().trim().min(1).max(2_000),
  createdAt: isoTimeSchema,
});
export type QueryResult = z.infer<typeof queryResultSchema>;

export const queryTimeRangeSchema = z.object({
  from: z.string().datetime({ offset: true }),
  to: z.string().datetime({ offset: true }),
});
export type QueryTimeRange = z.infer<typeof queryTimeRangeSchema>;

const queryFilterValueSchema = z.union([
  z.string().trim().min(1).max(300),
  z.array(z.string().trim().min(1).max(300)).min(1).max(100),
]);

export const semanticQueryInputSchema = z.object({
  datasetId: dataFabricIdSchema,
  metricIds: z.array(dataFabricIdSchema).min(1).max(20),
  timeRange: queryTimeRangeSchema,
  filters: z
    .record(z.string(), queryFilterValueSchema)
    .default({}),
  groupBy: z.array(dataFabricIdSchema).max(20).default([]),
  limit: z.number().int().positive().max(100_000).default(500),
});
export type SemanticQueryInput = z.infer<typeof semanticQueryInputSchema>;

export const dataFabricDomainSpec = {
  name: "collab_data_fabric",
  version: 2,
  compatibleVersions: [1],
  tables: {
    connections: { valueSchema: dataConnectionSchema },
    datasets: { valueSchema: datasetSchema },
    metrics: { valueSchema: semanticMetricSchema },
    policies: { valueSchema: dataPolicySchema },
    query_runs: { valueSchema: queryRunSchema },
    query_results: { valueSchema: queryResultSchema },
    skills: { valueSchema: dataSkillSchema },
  },
} as const;

export const FIXTURE_CONNECTION_ID = "fixture-readonly";
export const FIXTURE_DATASET_ID = "fixture-operations-events";

export const FIXTURE_METRIC_IDS = {
  eventCount: "event_count",
  failureRate: "failure_rate",
  cancelledRate: "cancelled_rate",
  timeoutRate: "timeout_rate",
  anomalyCount: "anomaly_count",
  anomalyRate: "anomaly_rate",
  amountSum: "amount_sum",
} as const;
