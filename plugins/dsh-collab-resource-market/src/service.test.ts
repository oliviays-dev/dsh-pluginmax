import { describe, expect, it } from "vitest";
import {
  ResourceMarketService,
  resourceMarketDomainSpec,
  type InstallRecord,
  type KvTableLike,
} from "./service.js";

class FakeTable<V> implements KvTableLike<V> {
  readonly records = new Map<string, V>();
  get(key: string): V | undefined {
    return this.records.get(key);
  }
  entries(): IterableIterator<[string, V]> {
    return this.records.entries();
  }
  async put(key: string, value: V): Promise<void> {
    this.records.set(key, value);
  }
  async delete(key: string): Promise<boolean> {
    return this.records.delete(key);
  }
}

describe("ResourceMarketService", () => {
  it("declares a separate market domain", () => {
    expect(resourceMarketDomainSpec.name).toBe("collab_resource_market");
    expect(Object.keys(resourceMarketDomainSpec.tables)).toEqual(["installs"]);
  });

  it("distinguishes packaged plugins from user enablement", () => {
    const enabled = new Set<string>();
    const service = new ResourceMarketService(
      { installs: new FakeTable<InstallRecord>() },
      {
        workbench: () => ({
          entitlements: () => [...enabled],
          enablePlugin: async (_principal, pluginId) => {
            enabled.add(pluginId);
            return { pluginId };
          },
        }),
      },
    );
    expect(service.plugins({ userId: "alice" })[0]?.status).toBe(
      "not_enabled",
    );
    expect(service.runtimeStatus("pluginmax.daily-brief")).toBe("packaged");
  });

  it("publishes the legacy workbench as a normal template", () => {
    const service = new ResourceMarketService(
      { installs: new FakeTable<InstallRecord>() },
      {
        workbench: () => ({
          entitlements: () => [],
          enablePlugin: async () => undefined,
        }),
      },
    );
    const legacy = service.template("tpl-legacy", "1.0.0");
    expect(legacy?.name).toBe("经典工作台（旧版）");
    expect(legacy?.panelPlan.map((panel) => panel.pluginId)).toEqual([
      "pluginmax.kpi-overview",
      "pluginmax.daily-brief",
      "pluginmax.task-focus",
      "pluginmax.following",
      "pluginmax.meeting-insights",
      "pluginmax.supply-exceptions",
      "pluginmax.supplier-risk",
    ]);
  });

  it("keeps MCP connect as pending instead of faking a connected state", async () => {
    const service = new ResourceMarketService(
      { installs: new FakeTable<InstallRecord>() },
      {
        workbench: () => ({
          entitlements: () => [],
          enablePlugin: async () => undefined,
        }),
      },
    );
    const record = await service.connectMcp("alice", "mcp-wecom");
    expect(record.status).toBe("pending");
    expect(
      (await service.mcps({ userId: "alice" })).find(
        (item) => item.id === "mcp-wecom",
      )?.status,
    ).toBe("pending");
  });

  it("never reports a seed MCP as connected without a provider", async () => {
    const service = new ResourceMarketService(
      { installs: new FakeTable<InstallRecord>() },
      {
        workbench: () => ({
          entitlements: () => [],
          enablePlugin: async () => undefined,
        }),
      },
    );
    const mcps = await service.mcps({ userId: "alice" });
    expect(mcps.every((item) => item.status !== "connected")).toBe(true);
    expect(mcps.every((item) => item.source === "seed")).toBe(true);
    expect(
      mcps.every((item) => item.connectionMode === "request_only"),
    ).toBe(true);
  });

  it("accepts connected only from an MCP provider", async () => {
    const service = new ResourceMarketService(
      { installs: new FakeTable<InstallRecord>() },
      {
        workbench: () => ({
          entitlements: () => [],
          enablePlugin: async () => undefined,
        }),
        mcpProvider: () => ({
          id: "test-mcp-provider",
          list: async () => [
            {
              id: "mcp-provider",
              name: "真实 MCP",
              description: "provider supplied",
              protocol: "HTTP",
              toolCount: 1,
              publisher: {
                id: "provider",
                name: "Provider",
                verified: true,
                kind: "certified",
              },
              version: "1.0.0",
              icon: "store",
              permissions: ["只读"],
              initialStatus: "off",
              status: "connected",
            },
          ],
          connect: async () => ({ status: "connected" }),
        }),
      },
    );
    const mcps = await service.mcps({ userId: "alice" });
    expect(mcps[0]).toMatchObject({
      status: "connected",
      source: "provider",
      connectionMode: "provider",
    });
  });

  it("exposes real template titles, dependencies, and filters", () => {
    const service = new ResourceMarketService(
      { installs: new FakeTable<InstallRecord>() },
      {
        workbench: () => ({
          entitlements: () => [],
          enablePlugin: async () => undefined,
        }),
      },
    );
    const detail = service.templateDetail("alice", "tpl-legacy", "1.0.0");
    expect(detail?.panels.map((panel) => panel.title)).toContain("每日简报");
    expect(detail?.dependencies).toHaveLength(7);
    expect(
      detail?.dependencies.every((item) => item.status === "not_enabled"),
    ).toBe(true);
    expect(detail?.compatibility).toBe("compatible");

    const filtered = service.templateList("alice", {
      publisher: "official",
      compatibility: "compatible",
      sort: "name",
      page: 1,
      pageSize: 2,
    });
    expect(filtered.items).toHaveLength(2);
    expect(filtered.total).toBeGreaterThan(2);
    expect(filtered.pageCount).toBeGreaterThan(1);
    expect(filtered.items[0]?.publisher.kind).toBe("official");
  });
});
