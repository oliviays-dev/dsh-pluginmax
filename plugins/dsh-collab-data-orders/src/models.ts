import { z } from "zod";

const idSchema = z
  .string()
  .trim()
  .min(1)
  .max(180)
  .regex(/^[a-zA-Z0-9._:-]+$/);

const isoTimeSchema = z.string().datetime({ precision: 3 });

export const ORDER_CONNECTOR_TYPE = "orders-readonly";
export const ORDER_MCP_ASSET_ID = "mcp-orders-mock";
export const ORDER_CONNECTION_ID = "orders-readonly-source";
export const ORDER_DATASET_ID = "orders-facts";
export const ORDER_MANIFEST_VERSION = "orders-manifest-v2";
export const ORDER_SEMANTIC_VERSION = "orders-semantic-v1";
export const ORDER_SKILL_ID = "skill.order-exception-analysis";
export const ORDER_DEMO_SOURCE_ID = "orders-demo-v1";

export const ORDER_METRIC_IDS = {
  orderCount: "order_count",
  paidOrderCount: "paid_order_count",
  paymentFailureRate: "payment_failure_rate",
  cancelRate: "cancel_rate",
  fulfillmentTimeoutRate: "fulfillment_timeout_rate",
  orderExceptionCount: "order_exception_count",
  orderExceptionRate: "order_exception_rate",
  fulfillmentOnTimeRate: "fulfillment_on_time_rate",
  orderAmountSum: "order_amount_sum",
} as const;

export const orderFieldMappingSchema = z.object({
  orderId: z.string().trim().min(1).max(200),
  orderedAt: z.string().trim().min(1).max(200),
  paidAt: z.string().trim().min(1).max(200),
  orderStatus: z.string().trim().min(1).max(200),
  paymentStatus: z.string().trim().min(1).max(200),
  region: z.string().trim().min(1).max(200),
  category: z.string().trim().min(1).max(200),
  paymentMethod: z.string().trim().min(1).max(200),
  channel: z.string().trim().min(1).max(200),
  merchant: z.string().trim().min(1).max(200),
  promisedFulfillmentAt: z.string().trim().min(1).max(200),
  actualFulfillmentAt: z.string().trim().min(1).max(200),
  refundStatus: z.string().trim().min(1).max(200),
  amount: z.string().trim().min(1).max(200),
});
export type OrderFieldMapping = z.infer<typeof orderFieldMappingSchema>;

export const DEFAULT_ORDER_FIELD_MAPPING: OrderFieldMapping = {
  orderId: "order_id",
  orderedAt: "ordered_at",
  paidAt: "paid_at",
  orderStatus: "order_status",
  paymentStatus: "payment_status",
  region: "region",
  category: "category",
  paymentMethod: "payment_method",
  channel: "channel",
  merchant: "merchant",
  promisedFulfillmentAt: "promised_fulfillment_at",
  actualFulfillmentAt: "actual_fulfillment_at",
  refundStatus: "refund_status",
  amount: "amount",
};

const valueMapSchema = z
  .record(z.string().trim().min(1).max(120), z.string().trim().max(120))
  .default({});

export const orderValueMappingsSchema = z.object({
  orderStatus: valueMapSchema,
  paymentStatus: valueMapSchema,
  refundStatus: valueMapSchema,
  region: valueMapSchema,
  category: valueMapSchema,
  paymentMethod: valueMapSchema,
  channel: valueMapSchema,
  merchant: valueMapSchema,
});
export type OrderValueMappings = z.infer<typeof orderValueMappingsSchema>;

export const DEFAULT_ORDER_VALUE_MAPPINGS: OrderValueMappings = {
  orderStatus: {},
  paymentStatus: {},
  refundStatus: {},
  region: {},
  category: {},
  paymentMethod: {},
  channel: {},
  merchant: {},
};

export const orderSourceConfigSchema = z
  .object({
    workspaceId: idSchema,
    mode: z.enum(["demo", "production"]),
    transport: z.enum(["fixture", "http-json", "mcp"]),
    manifestVersion: z.string().trim().min(1).max(80),
    semanticVersion: z.string().trim().min(1).max(80),
    fieldMapping: orderFieldMappingSchema,
    valueMappings: orderValueMappingsSchema,
    endpointRef: z.string().trim().min(1).max(500).optional(),
    credentialRef: z.string().trim().min(1).max(500).optional(),
    mcpAssetId: z.string().trim().min(1).max(180).optional(),
    mcpToolName: z.string().trim().min(1).max(120).optional(),
    disabledReason: z.string().trim().max(1_000).optional(),
    revision: z.number().int().min(1),
    updatedAt: isoTimeSchema,
    updatedBy: z.string().trim().min(1).max(180),
  })
  .superRefine((value, ctx) => {
    if (
      value.mode === "demo" &&
      value.transport !== "fixture" &&
      value.transport !== "mcp"
    ) {
      ctx.addIssue({
        code: "custom",
        message: "demo mode must use the fixture or mcp transport",
        path: ["transport"],
      });
    }
    if (
      value.mode === "production" &&
      value.transport !== "http-json" &&
      value.transport !== "mcp"
    ) {
      ctx.addIssue({
        code: "custom",
        message: "production mode must use the http-json or mcp transport",
        path: ["transport"],
      });
    }
    if (
      value.mode === "production" &&
      value.transport === "http-json" &&
      (value.endpointRef === undefined || value.credentialRef === undefined)
    ) {
      ctx.addIssue({
        code: "custom",
        message: "production mode requires endpointRef and credentialRef",
        path: ["endpointRef"],
      });
    }
    if (
      value.transport === "mcp" &&
      (value.mcpAssetId === undefined || value.mcpToolName === undefined)
    ) {
      ctx.addIssue({
        code: "custom",
        message: "mcp transport requires mcpAssetId and mcpToolName",
        path: ["mcpAssetId"],
      });
    }
  });
export type OrderSourceConfig = z.infer<typeof orderSourceConfigSchema>;

export const orderMigrationSchema = z.object({
  id: idSchema,
  workspaceId: idSchema,
  fromVersion: z.string().trim().min(1).max(80),
  toVersion: z.string().trim().min(1).max(80),
  appliedAt: isoTimeSchema,
});
export type OrderMigration = z.infer<typeof orderMigrationSchema>;

export const orderConnectorManifestSchema = z.object({
  id: z.literal("orders-readonly"),
  version: z.literal(ORDER_MANIFEST_VERSION),
  connectorType: z.literal(ORDER_CONNECTOR_TYPE),
  readOnly: z.literal(true),
  transports: z.array(z.enum(["fixture", "http-json", "mcp"])).min(1),
  fields: z.array(
    z.object({
      id: idSchema,
      required: z.boolean(),
      type: z.enum(["string", "number", "datetime"]),
    }),
  ),
  supports: z.object({
    dimensions: z.boolean(),
    semanticMetrics: z.boolean(),
    rawSql: z.literal(false),
    writes: z.literal(false),
  }),
});
export type OrderConnectorManifest = z.infer<
  typeof orderConnectorManifestSchema
>;

export const ORDER_CONNECTOR_MANIFEST: OrderConnectorManifest =
  orderConnectorManifestSchema.parse({
    id: "orders-readonly",
    version: ORDER_MANIFEST_VERSION,
    connectorType: ORDER_CONNECTOR_TYPE,
    readOnly: true,
    transports: ["fixture", "http-json", "mcp"],
    fields: [
      { id: "order_id", required: true, type: "string" },
      { id: "ordered_at", required: true, type: "datetime" },
      { id: "paid_at", required: false, type: "datetime" },
      { id: "order_status", required: true, type: "string" },
      { id: "payment_status", required: true, type: "string" },
      { id: "region", required: true, type: "string" },
      { id: "category", required: true, type: "string" },
      { id: "payment_method", required: true, type: "string" },
      { id: "channel", required: true, type: "string" },
      { id: "merchant", required: true, type: "string" },
      { id: "promised_fulfillment_at", required: true, type: "datetime" },
      {
        id: "actual_fulfillment_at",
        required: false,
        type: "datetime",
      },
      { id: "refund_status", required: true, type: "string" },
      { id: "amount", required: true, type: "number" },
    ],
    supports: {
      dimensions: true,
      semanticMetrics: true,
      rawSql: false,
      writes: false,
    },
  });

export const dataOrdersDomainSpec = {
  name: "collab_data_orders",
  version: 1,
  tables: {
    source_configs: { valueSchema: orderSourceConfigSchema },
    migrations: { valueSchema: orderMigrationSchema },
  },
} as const;
