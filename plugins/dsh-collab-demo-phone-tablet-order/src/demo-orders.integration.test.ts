import { execFile } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  DataFabricService,
  type DataFabricActor,
  type DataFabricTables,
} from "dsh-collab-data-fabric";
import {
  McpOrderTransport,
  OrderDataService,
  OrderReadonlyConnector,
  ORDER_DATASET_ID,
  ORDER_METRIC_IDS,
  type OrderDataTables,
  type OrderMigration,
  type OrderSourceConfig,
} from "dsh-collab-data-orders";
import { DemoPhoneTabletMcpProvider } from "./demo-mcp-provider.js";
import { DEMO_OMS_MCP_ID } from "./models.js";

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

const actor: DataFabricActor = {
  userId: "zhouning",
  name: "周宁",
  workspaceRole: "owner",
};

const execFileAsync = promisify(execFile);

let directory = "";
let provider: DemoPhoneTabletMcpProvider | undefined;

beforeEach(async () => {
  directory = await mkdtemp(join(tmpdir(), "pluginmax-demo-orders-"));
  process.env.DEMO_WMS_STATE_PATH = join(directory, "wms-state.json");
});

afterEach(async () => {
  await provider?.dispose();
  provider = undefined;
  delete process.env.DEMO_WMS_STATE_PATH;
  await rm(directory, { recursive: true, force: true });
});

describe("phone/tablet demo order data fabric", () => {
  it("returns the recorded east/digital exception metrics through MCP", async () => {
    const fixturePath = join(directory, "orders-fixture.json");
    await execFileAsync(process.execPath, [
      fileURLToPath(
        new URL("../scripts/generate-orders-fixture.mjs", import.meta.url),
      ),
      "--out",
      fixturePath,
      "--now",
      "2026-10-30T02:05:00.000Z",
    ]);
    provider = new DemoPhoneTabletMcpProvider(fixturePath);
    await provider.connect({ userId: "zhouning" }, DEMO_OMS_MCP_ID);
    const tables: DataFabricTables = {
      connections: new MemoryTable(),
      datasets: new MemoryTable(),
      metrics: new MemoryTable(),
      policies: new MemoryTable(),
      queryRuns: new MemoryTable(),
      queryResults: new MemoryTable(),
      skills: new MemoryTable(),
    };
    const fabric = new DataFabricService(tables, {
      now: () => new Date("2026-10-30T10:12:00.000Z"),
    });
    const orderTables = {
        sourceConfigs: new MemoryTable<OrderSourceConfig>(),
        migrations: new MemoryTable<OrderMigration>(),
      } satisfies OrderDataTables;
    const orders = new OrderDataService(
      orderTables,
      fabric,
      () => new Date("2026-10-30T10:12:00.000Z"),
    );
    fabric.registerCatalogProvider(async (workspaceId) => {
      await orders.ensureWorkspace(workspaceId);
    });
    fabric.registerConnector(
      new OrderReadonlyConnector(
        (workspaceId) => orders.config(workspaceId),
        undefined,
        () => new Date("2026-10-30T10:12:00.000Z"),
        new McpOrderTransport(provider),
      ),
    );
    await orders.configure("workspace-demo", "platform", {
      mode: "demo",
      transport: "mcp",
      mcpAssetId: DEMO_OMS_MCP_ID,
      mcpToolName: "orders_query",
    });
    const result = await fabric.query(actor, "workspace-demo", {
      datasetId: ORDER_DATASET_ID,
      metricIds: [
        ORDER_METRIC_IDS.orderCount,
        ORDER_METRIC_IDS.orderExceptionCount,
        ORDER_METRIC_IDS.orderExceptionRate,
        ORDER_METRIC_IDS.paymentFailureRate,
        ORDER_METRIC_IDS.cancelRate,
        ORDER_METRIC_IDS.fulfillmentTimeoutRate,
        ORDER_METRIC_IDS.orderAmountSum,
      ],
      timeRange: {
        from: "2026-10-29T16:00:00.000Z",
        to: "2026-10-30T02:05:00.000Z",
      },
      filters: {
        region: ["华东"],
        category: ["数码"],
      },
      groupBy: [],
      limit: 10,
    });
    expect(result.run.status).toBe("succeeded");
    expect(result.result.rows[0]).toMatchObject({
      order_count: 1658,
      order_exception_count: 126,
      order_exception_rate: 7.6,
      order_amount_sum: 8420218,
    });
    expect(result.result.rows[0]?.payment_failure_rate).toBeGreaterThan(0);
    expect(result.result.rows[0]?.cancel_rate).toBeGreaterThan(0);
    expect(result.result.rows[0]?.fulfillment_timeout_rate).toBeGreaterThan(0);
    expect(result.result.evidence).toEqual(
      expect.arrayContaining(["transport:mcp"]),
    );
    const workbenchMetric = await orders.workbenchMetric({
      workspaceId: "workspace-demo",
      actor,
      asOf: new Date("2026-10-30T02:05:00.000Z"),
    });
    expect(workbenchMetric).toMatchObject({
      id: "otif",
      value: "94.1",
      trend: "-1.8pt",
      trendClass: "down",
      dataMode: "demo",
    });
    const memberMetric = await orders.workbenchMetric({
      workspaceId: "workspace-demo",
      actor: { ...actor, workspaceRole: "member" },
      asOf: new Date("2026-10-30T02:05:00.000Z"),
    });
    expect(memberMetric).toMatchObject({
      value: "94.1",
      trend: "-1.8pt",
    });
  }, 15_000);
});
