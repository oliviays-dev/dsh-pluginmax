import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { McpProviderRegistry } from "dsh-collab-resource-market";
import {
  DemoPhoneTabletMcpProvider,
  loadDemoDraft,
} from "./demo-mcp-provider.js";
import { DemoTaskActionService } from "./demo-task-action.js";
import {
  DEMO_WMS_MCP_ID,
  DEMO_WORK_ORDER_ID,
  type DemoTaskReceipt,
} from "./models.js";

let directory = "";
let provider: DemoPhoneTabletMcpProvider | undefined;

beforeEach(async () => {
  directory = await mkdtemp(join(tmpdir(), "pluginmax-demo-action-"));
  process.env.DEMO_WMS_STATE_PATH = join(directory, "wms-state.json");
  process.env.DEMO_ACTION_TICKET_SECRET = "action-test-secret";
});

afterEach(async () => {
  await provider?.dispose();
  provider = undefined;
  delete process.env.DEMO_WMS_STATE_PATH;
  delete process.env.DEMO_ACTION_TICKET_SECRET;
  await rm(directory, { recursive: true, force: true });
});

describe("phone/tablet demo task action", () => {
  it("requires 周宁, then creates via MCP and restores the task receipt", async () => {
    provider = new DemoPhoneTabletMcpProvider();
    const registry = new McpProviderRegistry();
    registry.register(provider);
    await provider.connect({ userId: "zhouning" }, DEMO_WMS_MCP_ID);
    const receipts = new Map<string, DemoTaskReceipt>();
    const service = new DemoTaskActionService({
      registry: () => registry,
      tasks: () => ({
        get: (taskId) => ({
          id: taskId,
          workspaceId: "workspace-demo",
          title: "[PT-ORD-001-B] 生成成品仓订单再平衡工单",
        }),
      }),
      workspaces: () => ({
        get: () => ({
          id: "workspace-demo",
          path: "/tmp/phone-tablet-order",
          title: "手机平板订单履约演示",
        }),
      }),
      workspaceMembers: () => [
        { userId: "linlan" },
        { userId: "zhouning" },
      ],
      receipts: {
        get: (key) => receipts.get(key),
        put: async (key, value) => {
          receipts.set(key, value);
        },
      },
      draft: await loadDemoDraft(),
    });
    await expect(
      service.confirm(
        { userId: "linlan", name: "林岚" },
        "task-ai",
      ),
    ).rejects.toMatchObject({ code: "forbidden" });
    const created = await service.confirm(
      { userId: "zhouning", name: "周宁" },
      "task-ai",
    );
    expect(created).toMatchObject({
      idempotent: false,
      receipt: {
        workOrderId: DEMO_WORK_ORDER_ID,
        actionTicketId: "AT-PT-ORD-001-B",
        confirmedByName: "周宁",
        source: "mcp",
        production: false,
      },
    });
    const state = await service.getState(
      { userId: "zhouning" },
      "task-ai",
    );
    expect(state.receipt?.workOrderId).toBe(DEMO_WORK_ORDER_ID);
    expect(state.wms).toMatchObject({
      status: "recovered",
      workOrder: {
        workOrderId: DEMO_WORK_ORDER_ID,
        mock: true,
        production: false,
      },
    });
    const repeated = await service.confirm(
      { userId: "zhouning", name: "周宁" },
      "task-ai",
    );
    expect(repeated.idempotent).toBe(true);
    await registry.dispose();
    provider = undefined;
  });
});
