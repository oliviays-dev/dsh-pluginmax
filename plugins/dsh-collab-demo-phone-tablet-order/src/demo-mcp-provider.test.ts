import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { DemoPhoneTabletMcpProvider } from "./demo-mcp-provider.js";
import {
  DEMO_ACTION_TICKET_ID,
  DEMO_IDEMPOTENCY_KEY,
  DEMO_OMS_MCP_ID,
  DEMO_WMS_MCP_ID,
  DEMO_WORK_ORDER_ID,
  signActionTicket,
  type DemoActionTicketClaims,
} from "./models.js";

let directory = "";

beforeEach(async () => {
  directory = await mkdtemp(join(tmpdir(), "pluginmax-phone-tablet-demo-"));
  process.env.DEMO_WMS_STATE_PATH = join(directory, "wms-state.json");
  process.env.DEMO_ACTION_TICKET_SECRET = "test-action-ticket-secret";
});

afterEach(async () => {
  delete process.env.DEMO_WMS_STATE_PATH;
  delete process.env.DEMO_ACTION_TICKET_SECRET;
  await rm(directory, { recursive: true, force: true });
});

function ticket(input: {
  taskId: string;
  workspaceId: string;
  consumerId?: string;
}): { claims: DemoActionTicketClaims; signature: string } {
  const now = new Date();
  const claims: DemoActionTicketClaims = {
    id: DEMO_ACTION_TICKET_ID,
    workspaceId: input.workspaceId,
    taskId: input.taskId,
    mcpId: DEMO_WMS_MCP_ID,
    toolName: "wms_rebalance_work_order_create",
    consumerId: input.consumerId ?? "fulfillment-ai",
    confirmedByUserId: "zhouning",
    confirmedByName: "周宁",
    issuedAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + 5 * 60_000).toISOString(),
  };
  return {
    claims,
    signature: signActionTicket(claims, "test-action-ticket-secret"),
  };
}

function createArguments(input?: {
  taskId?: string;
  workspaceId?: string;
  consumerId?: string;
}) {
  const taskId = input?.taskId ?? "task-ai";
  const workspaceId = input?.workspaceId ?? "workspace-demo";
  const signed = ticket({
    taskId,
    workspaceId,
    ...(input?.consumerId === undefined
      ? {}
      : { consumerId: input.consumerId }),
  });
  return {
    idempotencyKey: DEMO_IDEMPOTENCY_KEY,
    actionTicketId: signed.claims.id,
    actionTicket: signed.claims,
    actionTicketSignature: signed.signature,
    humanConfirmed: true,
    confirmedBy: "周宁",
    confirmedByUserId: "zhouning",
    consumerId: input?.consumerId ?? "fulfillment-ai",
    taskId,
    workspaceId,
    orderIds: ["PT-DEMO-0006594", "PT-DEMO-0006595"],
    sourceWarehouse: "华东备用成品仓",
    targetWarehouse: "华东履约仓",
    cutoff: "当日 17:00",
    skuScope: ["手机 SKU", "平板 SKU"],
    serialBindingRequired: true,
    inventoryOwnershipChangeRequired: true,
    insuredTransport: true,
    identityVerifiedSignature: true,
  };
}

describe("phone/tablet demo MCP provider", () => {
  it("connects only after tools/list and returns the isolated OMS fixture", async () => {
    const provider = new DemoPhoneTabletMcpProvider();
    try {
      const before = await provider.list({ userId: "zhouning" });
      expect(before.map((asset) => asset.id)).toEqual([
        DEMO_OMS_MCP_ID,
        DEMO_WMS_MCP_ID,
      ]);
      expect(before.every((asset) => asset.status === "off")).toBe(true);
      await provider.connect({ userId: "zhouning" }, DEMO_OMS_MCP_ID);
      const after = await provider.list({ userId: "zhouning" });
      expect(
        after.find((asset) => asset.id === DEMO_OMS_MCP_ID)?.status,
      ).toBe("connected");
      const result = await provider.callTool({
        userId: "zhouning",
        mcpId: DEMO_OMS_MCP_ID,
        toolName: "orders_query",
        arguments: {
          from: "2026-10-29T16:00:00.000Z",
          to: "2026-10-30T02:00:00.000Z",
          filters: { region: ["east"], category: ["digital"] },
          limit: 10_000,
        },
      });
      expect(result).toMatchObject({
        demo: true,
        fixtureId: expect.stringMatching(/phone-tablet/),
        scannedRows: 8358,
      });
      expect(Array.isArray(result.orders)).toBe(true);
      const rows = result.orders as Array<Record<string, unknown>>;
      const paymentFailed = rows.filter(
        (row) =>
          row.payment_status === "failed" ||
          row.order_status === "payment_failed",
      );
      const cancelled = rows.filter(
        (row) => row.order_status === "cancelled",
      );
      const timedOut = rows.filter((row) => {
        if (
          row.order_status === "cancelled" ||
          row.payment_status === "failed" ||
          row.order_status === "payment_failed"
        ) {
          return false;
        }
        const promised = Date.parse(String(row.promised_fulfillment_at));
        if (promised > Date.parse("2026-10-30T02:00:00.000Z")) return false;
        if (row.actual_fulfillment_at === null) return true;
        const actual = Date.parse(String(row.actual_fulfillment_at));
        return !Number.isFinite(actual) || actual > promised;
      });
      expect(rows).toHaveLength(1658);
      expect(paymentFailed).toHaveLength(52);
      expect(cancelled).toHaveLength(31);
      expect(timedOut).toHaveLength(43);
      expect(paymentFailed.length + cancelled.length + timedOut.length).toBe(
        126,
      );
    } finally {
      await provider.dispose();
    }
  });

  it("rejects unsigned writes and denies the Data Agent consumer", async () => {
    const provider = new DemoPhoneTabletMcpProvider();
    try {
      await provider.connect({ userId: "zhouning" }, DEMO_WMS_MCP_ID);
      await expect(
        provider.callTool({
          userId: "zhouning",
          mcpId: DEMO_WMS_MCP_ID,
          toolName: "wms_rebalance_work_order_create",
          arguments: {
            idempotencyKey: DEMO_IDEMPOTENCY_KEY,
            orderIds: ["PT-DEMO-0006594"],
          },
        }),
      ).rejects.toThrow();
      await expect(
        provider.callTool({
          userId: "zhouning",
          mcpId: DEMO_WMS_MCP_ID,
          toolName: "wms_rebalance_work_order_create",
          arguments: createArguments({ consumerId: "data-agent" }),
        }),
      ).rejects.toThrow(/fulfillment AI/);
    } finally {
      await provider.dispose();
    }
  });

  it("persists idempotent work orders across provider restarts", async () => {
    const first = new DemoPhoneTabletMcpProvider();
    try {
      await first.connect({ userId: "zhouning" }, DEMO_WMS_MCP_ID);
      const created = await first.callTool({
        userId: "zhouning",
        mcpId: DEMO_WMS_MCP_ID,
        toolName: "wms_rebalance_work_order_create",
        arguments: createArguments(),
      });
      expect(created.workOrderId).toBe(DEMO_WORK_ORDER_ID);
      const repeated = await first.callTool({
        userId: "zhouning",
        mcpId: DEMO_WMS_MCP_ID,
        toolName: "wms_rebalance_work_order_create",
        arguments: createArguments(),
      });
      expect(repeated.workOrderId).toBe(created.workOrderId);
    } finally {
      await first.dispose();
    }
    const persisted = JSON.parse(
      await readFile(process.env.DEMO_WMS_STATE_PATH!, "utf8"),
    ) as {
      workOrders: Record<string, { workOrderId: string }>;
    };
    expect(persisted.workOrders[DEMO_WORK_ORDER_ID]?.workOrderId).toBe(
      DEMO_WORK_ORDER_ID,
    );

    const restarted = new DemoPhoneTabletMcpProvider();
    try {
      await restarted.connect({ userId: "zhouning" }, DEMO_WMS_MCP_ID);
      const recovered = await restarted.callTool({
        userId: "zhouning",
        mcpId: DEMO_WMS_MCP_ID,
        toolName: "wms_rebalance_work_order_get",
        arguments: { workOrderId: DEMO_WORK_ORDER_ID },
      });
      expect(recovered).toMatchObject({
        workOrderId: DEMO_WORK_ORDER_ID,
        actionTicketId: DEMO_ACTION_TICKET_ID,
        idempotencyKey: DEMO_IDEMPOTENCY_KEY,
        production: false,
      });
    } finally {
      await restarted.dispose();
    }
  });
});
