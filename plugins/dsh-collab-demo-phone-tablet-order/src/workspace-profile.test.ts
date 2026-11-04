import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  configureDemoWorkspace,
  configureDemoWorkbenchV2,
  isDemoWorkspace,
  loadDemoOrderExceptionSummary,
  loadDemoWorkbenchMetricIds,
} from "./index.js";
import {
  DEMO_OMS_MCP_ID,
  DEMO_WMS_MCP_ID,
} from "./models.js";

function workspaceContext(input: {
  readonly title: string;
  readonly initialWorkbenchPanels?: readonly string[] | undefined;
  readonly members: readonly {
    readonly userId: string;
    readonly memberRole: "owner" | "member" | "guest";
  }[];
}) {
  const connections: Array<
    readonly [userId: string, mcpId: string]
  > = [];
  const configured: string[] = [];
  const workbenchDrafts: Array<{
    readonly userId: string;
    readonly pluginIds: readonly string[];
  }> = [];
  let workbenchPanels = (
    input.initialWorkbenchPanels ?? [
      "pluginmax.daily-brief",
      "pluginmax.task-focus",
      "pluginmax.kpi-overview",
      "pluginmax.following",
      "pluginmax.meeting-insights",
      "pluginmax.supply-exceptions",
      "pluginmax.supplier-risk",
      "pluginmax.workflow-runs",
      "pluginmax.team-load",
    ]
  ).map((pluginId, order) => ({
    id: `panel-${pluginId}`,
    pluginId,
    pluginVersion: "1.0.0",
    span: 3,
    order,
    config: {},
  }));
  const ctx = {
    get(key: string) {
      if (key === "workspaceRegistry") {
        return {
          list: () => [
            {
              id: "workspace-demo",
              path: "/workspace-demo",
              title: input.title,
            },
          ],
        };
      }
      if (key === "collabDataOrders") {
        return {
          status: () => ({ config: {} }),
          configure: async (workspaceId: string) => {
            configured.push(workspaceId);
          },
        };
      }
      if (key === "collabResourceMarket") {
        return {
          connectMcp: async (userId: string, mcpId: string) => {
            connections.push([userId, mcpId]);
            return { status: "connected" };
          },
        };
      }
      if (key === "collabTeam") {
        return {
          members: () => input.members,
        };
      }
      if (key === "collabWorkbenchV2") {
        return {
          list: async () => ({
            workbenches: [
              {
                id: "workbench-demo",
                revision: workbenchDrafts.length + 1,
                panels: workbenchPanels,
              },
            ],
            preference: { activeWorkbenchId: "workbench-demo" },
          }),
          saveDraft: async (
            principal: { readonly userId: string },
            draft: {
              readonly panels: typeof workbenchPanels;
            },
          ) => {
            workbenchPanels = draft.panels;
            workbenchDrafts.push({
              userId: principal.userId,
              pluginIds: draft.panels.map((panel) => panel.pluginId),
            });
          },
        };
      }
      return undefined;
    },
  };
  return { ctx, connections, configured, workbenchDrafts };
}

describe("phone/tablet demo workspace profile", () => {
  it("reads the selected workbench metrics from the Demo profile config", async () => {
    await expect(loadDemoWorkbenchMetricIds()).resolves.toEqual([
      "otif",
      "inventory-turn",
      "supplier-otd",
      "price-achievement",
    ]);
  });

  it("reads the brief facts from the generated order fixture", async () => {
    await expect(
      loadDemoOrderExceptionSummary(
        fileURLToPath(
          new URL("../data/orders-fixture.json", import.meta.url),
        ),
      ),
    ).resolves.toMatchObject({
      orderCount: 1658,
      exceptionCount: 126,
      exceptionRate: 7.6,
      paymentFailureCount: 52,
      cancelledCount: 31,
      fulfillmentTimeoutCount: 43,
    });
  });

  it("uses the reason-analysis label for the order exception brief action", () => {
    const source = readFileSync(new URL("./index.ts", import.meta.url), "utf8");
    const config = readFileSync(
      new URL("../config/workbench-profile.yaml", import.meta.url),
      "utf8",
    );
    expect(source).toContain('actionLabel: "分析原因"');
    expect(config).toContain('actionLabel: "分析原因"');
    expect(source).not.toContain('actionLabel: "询问 Data Agent"');
  });

  it("matches the demo workspace with or without a project number prefix", () => {
    expect(
      isDemoWorkspace({
        id: "workspace-demo",
        path: "/workspace-demo",
        title: "手机平板订单履约演示",
      }),
    ).toBe(true);
    expect(
      isDemoWorkspace({
        id: "workspace-demo",
        path: "/workspace-demo",
        title: "1102-手机平板订单履约演示",
      }),
    ).toBe(true);
  });

  it("does not apply the demo profile to unrelated workspaces", () => {
    expect(
      isDemoWorkspace({
        id: "workspace-other",
        path: "/workspace-other",
        title: "1001-外接 Agent 测试",
      }),
    ).toBe(false);
  });

  it("connects both Demo MCPs for owner and member in a prefixed workspace", async () => {
    const { ctx, connections, configured } = workspaceContext({
      title: "1102-手机平板订单履约演示",
      members: [
        { userId: "linlan", memberRole: "owner" },
        { userId: "zhouning", memberRole: "member" },
        { userId: "guest", memberRole: "guest" },
      ],
    });

    await configureDemoWorkspace(ctx as never);

    expect(configured).toEqual(["workspace-demo"]);
    expect(connections).toEqual([
      ["linlan", DEMO_OMS_MCP_ID],
      ["linlan", DEMO_WMS_MCP_ID],
      ["zhouning", DEMO_OMS_MCP_ID],
      ["zhouning", DEMO_WMS_MCP_ID],
    ]);
  });

  it("does not connect MCPs for an unrelated workspace", async () => {
    const { ctx, connections, configured } = workspaceContext({
      title: "1001-外接 Agent 测试",
      members: [{ userId: "linlan", memberRole: "owner" }],
    });

    await configureDemoWorkspace(ctx as never);

    expect(configured).toEqual([]);
    expect(connections).toEqual([]);
  });

  it("does not overwrite an existing personalized Demo workbench", async () => {
    const { ctx, workbenchDrafts } = workspaceContext({
      title: "1102-手机平板订单履约演示",
      members: [
        { userId: "linlan", memberRole: "owner" },
        { userId: "zhouning", memberRole: "member" },
        { userId: "guest", memberRole: "guest" },
      ],
    });

    await configureDemoWorkbenchV2(ctx as never);

    expect(workbenchDrafts).toEqual([]);
  });

  it("seeds the order-relevant scaffolding only for an empty Demo workbench", async () => {
    const { ctx, workbenchDrafts } = workspaceContext({
      title: "1102-手机平板订单履约演示",
      initialWorkbenchPanels: [],
      members: [
        { userId: "linlan", memberRole: "owner" },
        { userId: "zhouning", memberRole: "member" },
        { userId: "guest", memberRole: "guest" },
      ],
    });

    await configureDemoWorkbenchV2(ctx as never);

    expect(workbenchDrafts).toEqual([
      {
        userId: "linlan",
        pluginIds: [
          "pluginmax.daily-brief",
          "pluginmax.task-focus",
          "pluginmax.kpi-overview",
          "pluginmax.following",
        ],
      },
      {
        userId: "zhouning",
        pluginIds: [
          "pluginmax.daily-brief",
          "pluginmax.task-focus",
          "pluginmax.kpi-overview",
          "pluginmax.following",
        ],
      },
    ]);
  });
});
