import { describe, expect, it } from "vitest";
import { fileURLToPath } from "node:url";
import { ResourceMarketService } from "dsh-collab-resource-market";
import {
  DataFabricError,
  DataFabricService,
  type DataFabricActor,
  type DataFabricTables,
} from "dsh-collab-data-fabric";
import {
  OrderReadonlyConnector,
  type OrderReadonlyTransport,
  type OrderSourceBatch,
} from "./connector.js";
import {
  ORDER_CONNECTOR_MANIFEST,
  ORDER_DATASET_ID,
  ORDER_METRIC_IDS,
  ORDER_SEMANTIC_VERSION,
  ORDER_SKILL_ID,
  orderSourceConfigSchema,
  type OrderMigration,
  type OrderSourceConfig,
} from "./models.js";
import {
  OrderDataService,
  type OrderDataTables,
} from "./service.js";
import { McpOrderTransport, OrderMcpProvider } from "./mcp.js";

class MemoryTable<V> {
  private readonly values = new Map<string, V>();

  get(key: string): V | undefined {
    return this.values.get(key);
  }

  entries(): IterableIterator<[string, V]> {
    return this.values.entries();
  }

  async put(key: string, value: V): Promise<void> {
    this.values.set(key, value);
  }

  async delete(key: string): Promise<boolean> {
    return this.values.delete(key);
  }
}

const NOW = new Date("2026-10-30T02:00:00.000Z");
const TODAY_FROM = "2026-10-29T16:00:00.000Z";
const TODAY_TO = NOW.toISOString();

function harness(
  transport?: OrderReadonlyTransport,
  mcpProvider?: OrderMcpProvider,
) {
  const fabricTables: DataFabricTables = {
    connections: new MemoryTable(),
    datasets: new MemoryTable(),
    metrics: new MemoryTable(),
    policies: new MemoryTable(),
    queryRuns: new MemoryTable(),
    queryResults: new MemoryTable(),
    skills: new MemoryTable(),
  };
  const orderTables: OrderDataTables = {
    sourceConfigs: new MemoryTable<OrderSourceConfig>(),
    migrations: new MemoryTable<OrderMigration>(),
  };
  const fabric = new DataFabricService(fabricTables, { now: () => NOW });
  const orders = new OrderDataService(orderTables, fabric, () => NOW);
  fabric.registerCatalogProvider(async (workspaceId) => {
    await orders.ensureWorkspace(workspaceId);
  });
  fabric.registerConnector(
    new OrderReadonlyConnector(
      (workspaceId) => orders.config(workspaceId),
      transport,
      () => NOW,
      mcpProvider === undefined ? undefined : new McpOrderTransport(mcpProvider),
    ),
  );
  return { fabric, orders, fabricTables, orderTables };
}

const owner: DataFabricActor = {
  userId: "owner",
  name: "Owner",
  workspaceRole: "owner",
};

const member: DataFabricActor = {
  userId: "member",
  name: "Member",
  workspaceRole: "member",
};

function productionRows(): Record<string, unknown>[] {
  return [
    {
      order_id: "O-1",
      ordered_at: "2026-10-30T00:00:00.000Z",
      paid_at: "2026-10-30T00:05:00.000Z",
      order_status: "fulfilled",
      payment_status: "succeeded",
      region: "east",
      category: "fresh",
      payment_method: "wallet",
      channel: "app",
      merchant: "flagship",
      promised_fulfillment_at: "2026-10-30T01:00:00.000Z",
      actual_fulfillment_at: "2026-10-30T00:50:00.000Z",
      refund_status: "none",
      amount: 100,
    },
    {
      order_id: "O-2",
      ordered_at: "2026-10-30T00:10:00.000Z",
      paid_at: null,
      order_status: "payment_failed",
      payment_status: "failed",
      region: "east",
      category: "fresh",
      payment_method: "card",
      channel: "web",
      merchant: "flagship",
      promised_fulfillment_at: "2026-10-30T01:10:00.000Z",
      actual_fulfillment_at: null,
      refund_status: "none",
      amount: 120,
    },
    {
      order_id: "O-3",
      ordered_at: "2026-10-30T00:20:00.000Z",
      paid_at: "2026-10-30T00:25:00.000Z",
      order_status: "cancelled",
      payment_status: "succeeded",
      region: "south",
      category: "digital",
      payment_method: "wallet",
      channel: "app",
      merchant: "direct",
      promised_fulfillment_at: "2026-10-30T01:20:00.000Z",
      actual_fulfillment_at: null,
      refund_status: "none",
      amount: 200,
    },
    {
      order_id: "O-4",
      ordered_at: "2026-10-30T00:30:00.000Z",
      paid_at: "2026-10-30T00:35:00.000Z",
      order_status: "paid",
      payment_status: "succeeded",
      region: "north",
      category: "apparel",
      payment_method: "card",
      channel: "store",
      merchant: "marketplace",
      promised_fulfillment_at: "2026-10-30T01:30:00.000Z",
      actual_fulfillment_at: null,
      refund_status: "none",
      amount: 300,
    },
    {
      order_id: "O-5",
      ordered_at: "2026-10-30T00:40:00.000Z",
      paid_at: "2026-10-30T00:45:00.000Z",
      order_status: "refunded",
      payment_status: "succeeded",
      region: "south",
      category: "fresh",
      payment_method: "wallet",
      channel: "app",
      merchant: "flagship",
      promised_fulfillment_at: "2026-10-30T01:40:00.000Z",
      actual_fulfillment_at: "2026-10-30T01:30:00.000Z",
      refund_status: "refunded",
      amount: 400,
    },
    {
      order_id: "O-6",
      ordered_at: "2026-10-30T00:50:00.000Z",
      paid_at: null,
      order_status: "cancelled",
      payment_status: "failed",
      region: "east",
      category: "digital",
      payment_method: "transfer",
      channel: "web",
      merchant: "direct",
      promised_fulfillment_at: "2026-10-30T01:50:00.000Z",
      actual_fulfillment_at: null,
      refund_status: "none",
      amount: 500,
    },
  ];
}

const fakeTransport: OrderReadonlyTransport = {
  async query(): Promise<OrderSourceBatch> {
    return {
      records: productionRows(),
      scannedRows: 6,
      dataCutoffAt: "2026-10-30T01:55:00.000Z",
      freshness: "5 分钟",
    };
  },
};

async function useProduction(
  orders: OrderDataService,
  workspaceId = "ws-1",
): Promise<void> {
  await orders.ensureWorkspace(workspaceId);
  await orders.configure(workspaceId, "owner", {
    mode: "production",
    endpointRef: "env:ORDERS_READONLY_ENDPOINT",
    credentialRef: "env:ORDERS_READONLY_TOKEN",
  });
}

describe("order Data Fabric domain", () => {
  it("migrates the previous fixture source to the resource-market MCP asset", async () => {
    const { orders, orderTables } = harness();
    await orderTables.sourceConfigs.put(
      "ws-1",
      orderSourceConfigSchema.parse({
        workspaceId: "ws-1",
        mode: "demo",
        transport: "fixture",
        manifestVersion: "orders-manifest-v1",
        semanticVersion: ORDER_SEMANTIC_VERSION,
        fieldMapping: {
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
        },
        valueMappings: {
          orderStatus: {},
          paymentStatus: {},
          refundStatus: {},
          region: {},
          category: {},
          paymentMethod: {},
          channel: {},
          merchant: {},
        },
        revision: 1,
        updatedAt: NOW.toISOString(),
        updatedBy: "platform-demo-seed",
      }),
    );
    const migrated = await orders.ensureWorkspace("ws-1");
    expect(migrated).toMatchObject({
      mode: "demo",
      transport: "mcp",
      mcpAssetId: "mcp-orders-mock",
      mcpToolName: "orders_query",
      manifestVersion: "orders-manifest-v2",
    });
    expect(orders.migrations("ws-1")).toContainEqual(
      expect.objectContaining({
        fromVersion: "orders-manifest-v1",
        toVersion: "orders-manifest-v2",
      }),
    );
  });

  it("registers through the existing MCP catalog contract and calls Mock OMS tools", async () => {
    const provider = new OrderMcpProvider({
      assetId: "mcp-orders-mock",
      transport: "stdio",
      command: process.execPath,
      args: [
        fileURLToPath(
          new URL("../mock/order-mcp-server.mjs", import.meta.url),
        ),
      ],
      cwd: fileURLToPath(new URL("..", import.meta.url)),
      toolCallTimeoutMs: 15_000,
    });
    try {
      const off = await provider.list({ userId: "owner", role: "member" });
      expect(off).toHaveLength(1);
      expect(off[0]).toMatchObject({
        id: "mcp-orders-mock",
        status: "off",
        protocol: "MCP · stdio",
      });
      await expect(
        provider.connect({ userId: "owner", role: "member" }, "mcp-orders-mock"),
      ).resolves.toEqual({ status: "connected" });
      const connected = await provider.list({ userId: "owner", role: "member" });
      expect(connected[0]?.status).toBe("connected");
      const result = await provider.callTool({
        userId: "owner",
        mcpId: "mcp-orders-mock",
        toolName: "orders_query",
        arguments: {
          from: TODAY_FROM,
          to: TODAY_TO,
          filters: {},
          limit: 500,
        },
      });
      expect(result).toMatchObject({
        source: {
          system: "mock-order-management-system",
          transport: "mcp",
          demo: true,
        },
      });
      expect(Array.isArray(result.orders)).toBe(true);
    } finally {
      await provider.dispose();
    }
  });

  it("executes order metrics through the MCP transport without bypassing Data Fabric", async () => {
    const provider = new OrderMcpProvider({
      assetId: "mcp-orders-mock",
      transport: "stdio",
      command: process.execPath,
      args: [
        fileURLToPath(
          new URL("../mock/order-mcp-server.mjs", import.meta.url),
        ),
      ],
      cwd: fileURLToPath(new URL("..", import.meta.url)),
      toolCallTimeoutMs: 15_000,
    });
    const { fabric, orders } = harness(undefined, provider);
    try {
      await orders.ensureWorkspace("ws-1");
      const market = new ResourceMarketService(
        {
          installs: new MemoryTable(),
          customAssets: new MemoryTable(),
        },
        {
          workbench: () => undefined,
          mcpProvider: () => provider,
          now: () => NOW,
        },
      );
      const listed = await market.mcps(
        { userId: owner.userId, role: "member" },
        { query: "订单" },
      );
      expect(listed).toContainEqual(
        expect.objectContaining({
          id: "mcp-orders-mock",
          status: "off",
          connectionMode: "provider",
        }),
      );
      await expect(
        fabric.query(owner, "ws-1", {
          datasetId: ORDER_DATASET_ID,
          metricIds: [ORDER_METRIC_IDS.orderExceptionRate],
          timeRange: { from: TODAY_FROM, to: TODAY_TO },
          filters: {},
          groupBy: [],
          limit: 10,
        }),
      ).rejects.toMatchObject({ code: "unavailable" });
      await expect(
        market.connectMcp(
          { userId: owner.userId, role: "member" },
          "mcp-orders-mock",
        ),
      ).resolves.toMatchObject({ status: "connected" });
      const result = await fabric.query(owner, "ws-1", {
        datasetId: ORDER_DATASET_ID,
        metricIds: [
          ORDER_METRIC_IDS.orderCount,
          ORDER_METRIC_IDS.orderExceptionCount,
          ORDER_METRIC_IDS.orderExceptionRate,
        ],
        timeRange: { from: TODAY_FROM, to: new Date().toISOString() },
        filters: {},
        groupBy: [],
        limit: 10,
      });
      expect(result.run.status).toBe("succeeded");
      expect(result.result.rows[0]?.order_count).toBeGreaterThan(0);
      expect(result.result.evidence).toEqual(
        expect.arrayContaining(["transport:mcp", "demo:orders-demo-v1"]),
      );
    } finally {
      await provider.dispose();
    }
  });

  it("seeds an explicit demo catalog with all required fields and certified metrics", async () => {
    const { fabric, orders } = harness();
    await orders.ensureWorkspace("ws-1");
    const description = await fabric.describe(owner, "ws-1", ORDER_DATASET_ID);
    const catalog = await fabric.catalogSearch(owner, "ws-1", {
      query: "订单异常",
    });
    const skills = await fabric.skills(owner, "ws-1", {
      query: "今天有没有订单异常",
    });

    expect(description.dataset.isFixture).toBe(true);
    expect(description.dataset.description).toContain("非生产");
    expect(description.dataset.fields.map((field) => field.id)).toEqual(
      expect.arrayContaining([
        "order_id",
        "ordered_at",
        "paid_at",
        "order_status",
        "payment_status",
        "region",
        "category",
        "channel",
        "merchant",
        "promised_fulfillment_at",
        "actual_fulfillment_at",
        "refund_status",
        "amount",
        "payment_method",
      ]),
    );
    expect(ORDER_CONNECTOR_MANIFEST.supports).toMatchObject({
      rawSql: false,
      writes: false,
      dimensions: true,
      semanticMetrics: true,
    });
    expect(description.metrics.map((metric) => metric.id)).toEqual(
      expect.arrayContaining([
        ORDER_METRIC_IDS.orderCount,
        ORDER_METRIC_IDS.paidOrderCount,
        ORDER_METRIC_IDS.paymentFailureRate,
        ORDER_METRIC_IDS.cancelRate,
        ORDER_METRIC_IDS.fulfillmentTimeoutRate,
        ORDER_METRIC_IDS.orderExceptionCount,
        ORDER_METRIC_IDS.orderExceptionRate,
      ]),
    );
    expect(catalog).toHaveLength(1);
    expect(skills).toContainEqual(
      expect.objectContaining({ id: ORDER_SKILL_ID, version: "v1.0" }),
    );
    expect(orders.migrations("ws-1")).toHaveLength(1);
  });

  it("computes the certified order exception definitions and keeps refunds out", async () => {
    const { fabric, orders } = harness(fakeTransport);
    await useProduction(orders);
    const result = await fabric.query(
      owner,
      "ws-1",
      {
        datasetId: ORDER_DATASET_ID,
        metricIds: [
          ORDER_METRIC_IDS.orderCount,
          ORDER_METRIC_IDS.paidOrderCount,
          ORDER_METRIC_IDS.paymentFailureRate,
          ORDER_METRIC_IDS.cancelRate,
          ORDER_METRIC_IDS.fulfillmentTimeoutRate,
          ORDER_METRIC_IDS.orderExceptionCount,
          ORDER_METRIC_IDS.orderExceptionRate,
        ],
        timeRange: { from: TODAY_FROM, to: TODAY_TO },
        filters: {},
        groupBy: [],
        limit: 10,
      },
      { agentRunId: "agent-run-1", conversationId: "conv-1" },
    );

    expect(result.result.rows[0]).toMatchObject({
      order_count: 6,
      paid_order_count: 4,
      payment_failure_rate: 33.33,
      cancel_rate: 33.33,
      fulfillment_timeout_rate: 33.33,
      order_exception_count: 4,
      order_exception_rate: 66.67,
    });
    expect(result.result.evidence.join("\n")).toContain(
      "order_exception_rate@orders-metric-v1",
    );
    expect(result.result.evidence.join("\n")).not.toContain("demo:");
    expect(result.run.permissionSummary).toContain(
      "rowScope:workspace-authorized",
    );
  });

  it("applies partial region permission and visible coverage notes", async () => {
    const { fabric, orders } = harness(fakeTransport);
    await useProduction(orders);
    const result = await fabric.query(member, "ws-1", {
      datasetId: ORDER_DATASET_ID,
      metricIds: [
        ORDER_METRIC_IDS.orderCount,
        ORDER_METRIC_IDS.orderExceptionCount,
      ],
      timeRange: { from: TODAY_FROM, to: TODAY_TO },
      filters: {},
      groupBy: ["region"],
      limit: 10,
    });
    const north = await fabric.query(member, "ws-1", {
      datasetId: ORDER_DATASET_ID,
      metricIds: [ORDER_METRIC_IDS.orderCount],
      timeRange: { from: TODAY_FROM, to: TODAY_TO },
      filters: { region: ["华北"] },
      groupBy: ["region"],
      limit: 10,
    });

    expect(result.result.rows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ region: "east", order_count: 3 }),
        expect.objectContaining({ region: "south", order_count: 2 }),
      ]),
    );
    expect(result.result.rows.some((row) => row.region === "north")).toBe(false);
    expect(result.result.permissionSummary).toContain(
      "coverage:当前授权：华东、华南；未覆盖：华北、西南",
    );
    expect(north.result.rows).toEqual([]);
  });

  it("supports alias drill-down into east fresh orders", async () => {
    const { fabric, orders } = harness(fakeTransport);
    await useProduction(orders);
    const result = await fabric.query(owner, "ws-1", {
      datasetId: ORDER_DATASET_ID,
      metricIds: [
        ORDER_METRIC_IDS.orderCount,
        ORDER_METRIC_IDS.orderExceptionCount,
      ],
      timeRange: { from: TODAY_FROM, to: TODAY_TO },
      filters: { region: ["华东"], category: ["生鲜"] },
      groupBy: ["region", "category"],
      limit: 10,
    });

    expect(result.result.rows).toEqual([
      { region: "east", category: "fresh", order_count: 2, order_exception_count: 1 },
    ]);
  });

  it("returns no data without inventing zero production values", async () => {
    const { fabric, orders } = harness(fakeTransport);
    await useProduction(orders);
    const result = await fabric.query(owner, "ws-1", {
      datasetId: ORDER_DATASET_ID,
      metricIds: [ORDER_METRIC_IDS.orderCount],
      timeRange: {
        from: "2027-01-01T00:00:00.000Z",
        to: "2027-01-02T00:00:00.000Z",
      },
      filters: {},
      groupBy: [],
      limit: 10,
    });

    expect(result.result.rows).toEqual([]);
    expect(result.result.rowCount).toBe(0);
  });

  it("truncates grouped results and records the limit", async () => {
    const { fabric, orders } = harness(fakeTransport);
    await useProduction(orders);
    const result = await fabric.query(owner, "ws-1", {
      datasetId: ORDER_DATASET_ID,
      metricIds: [ORDER_METRIC_IDS.orderCount],
      timeRange: { from: TODAY_FROM, to: TODAY_TO },
      filters: {},
      groupBy: ["region"],
      limit: 1,
    });

    expect(result.result.rows).toHaveLength(1);
    expect(result.result.truncated).toBe(true);
    expect(result.run.truncated).toBe(true);
  });

  it("records connection failures and timeouts without returning guessed data", async () => {
    const failing = harness({
      async query() {
        throw new DataFabricError("unavailable", "orders upstream unavailable");
      },
    });
    const hanging = harness({
      query() {
        return new Promise<OrderSourceBatch>(() => undefined);
      },
    });
    await useProduction(failing.orders);
    await useProduction(hanging.orders);

    await expect(
      failing.fabric.query(owner, "ws-1", {
        datasetId: ORDER_DATASET_ID,
        metricIds: [ORDER_METRIC_IDS.orderCount],
        timeRange: { from: TODAY_FROM, to: TODAY_TO },
        filters: {},
        groupBy: [],
        limit: 10,
      }),
    ).rejects.toMatchObject({ code: "unavailable" });
    expect(failing.fabric.queryRuns(owner, "ws-1")[0]?.status).toBe("failed");

    await expect(
      hanging.fabric.query(
        { ...owner, queryTimeoutMs: 20 },
        "ws-1",
        {
          datasetId: ORDER_DATASET_ID,
          metricIds: [ORDER_METRIC_IDS.orderCount],
          timeRange: { from: TODAY_FROM, to: TODAY_TO },
          filters: {},
          groupBy: [],
          limit: 10,
        },
      ),
    ).rejects.toMatchObject({ code: "query_failed" });
    expect(hanging.fabric.queryRuns(owner, "ws-1")[0]?.status).toBe("timeout");
  });

  it("fails closed for guests and rejects production mode without references", async () => {
    const { fabric, orders } = harness();
    await expect(
      fabric.catalogSearch(
        { userId: "guest", workspaceRole: "guest" },
        "ws-1",
        {},
      ),
    ).rejects.toMatchObject({ code: "forbidden" });
    await expect(
      orders.configure("ws-1", "owner", { mode: "production" }),
    ).rejects.toBeDefined();
  });
});
