import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";

export const DEMO_PLUGIN_ID = "dsh-collab-demo-phone-tablet-order";
export const DEMO_FEATURE_FLAG = "PLUGINMAX_ENABLE_PHONE_TABLET_DEMO";
export const DEMO_PROFILE_ID = "phone-tablet-order-v1";
export const DEMO_WORKSPACE_TITLE = "手机平板订单履约演示";
export const DEMO_OMS_MCP_ID = "mcp-orders-phone-tablet-demo";
export const DEMO_WMS_MCP_ID = "mcp-wms-phone-tablet-demo";
export const DEMO_ACTION_TICKET_ID = "AT-PT-ORD-001-B";
export const DEMO_IDEMPOTENCY_KEY = "PT-ORD-001-B";
export const DEMO_WORK_ORDER_ID = "WO-RB-DEMO-1030-017";
export const DEMO_APPROVER_USER_ID = "zhouning";
export const DEMO_APPROVER_NAME = "周宁";
export const DEMO_CONSUMER_ID = "fulfillment-ai";

export const demoActionTicketClaimsSchema = z.object({
  id: z.string().trim().min(1).max(160),
  workspaceId: z.string().trim().min(1).max(200),
  taskId: z.string().trim().min(1).max(200),
  mcpId: z.string().trim().min(1).max(200),
  toolName: z.string().trim().min(1).max(200),
  consumerId: z.string().trim().min(1).max(160),
  confirmedByUserId: z.string().trim().min(1).max(160),
  confirmedByName: z.string().trim().min(1).max(160),
  issuedAt: z.string().datetime({ offset: true }),
  expiresAt: z.string().datetime({ offset: true }),
});

export type DemoActionTicketClaims = z.infer<
  typeof demoActionTicketClaimsSchema
>;

export const demoTaskReceiptSchema = z.object({
  taskId: z.string().trim().min(1).max(200),
  workspaceId: z.string().trim().min(1).max(200),
  workOrderId: z.string().trim().min(1).max(160),
  actionTicketId: z.string().trim().min(1).max(160),
  idempotencyKey: z.string().trim().min(1).max(160),
  confirmedByName: z.string().trim().min(1).max(160),
  operatorName: z.string().trim().min(1).max(160),
  createdAt: z.string().datetime({ offset: true }),
  source: z.literal("mcp"),
  production: z.literal(false),
});

export type DemoTaskReceipt = z.infer<typeof demoTaskReceiptSchema>;

export const demoDomainSpec = {
  name: "collab_demo_phone_tablet_order",
  version: 1,
  tables: {
    task_receipts: { valueSchema: demoTaskReceiptSchema },
  },
} as const;

export function actionTicketSecret(
  env: NodeJS.ProcessEnv = process.env,
): string {
  return (
    env.DEMO_ACTION_TICKET_SECRET?.trim() ||
    "pluginmax-phone-tablet-demo-action-ticket-v1"
  );
}

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(canonicalJson).join(",")}]`;
  }
  if (value !== null && typeof value === "object") {
    return `{${Object.entries(value)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(
        ([key, item]) =>
          `${JSON.stringify(key)}:${canonicalJson(item)}`,
      )
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

export function signActionTicket(
  claims: DemoActionTicketClaims,
  secret = actionTicketSecret(),
): string {
  return createHmac("sha256", secret)
    .update(canonicalJson(demoActionTicketClaimsSchema.parse(claims)))
    .digest("hex");
}

export function verifyActionTicket(
  claims: DemoActionTicketClaims,
  signature: string,
  secret = actionTicketSecret(),
  now = new Date(),
): boolean {
  const parsed = demoActionTicketClaimsSchema.safeParse(claims);
  if (!parsed.success) return false;
  if (Date.parse(parsed.data.expiresAt) <= now.getTime()) return false;
  const expected = Buffer.from(signActionTicket(parsed.data, secret), "hex");
  const actual = Buffer.from(signature, "hex");
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}
