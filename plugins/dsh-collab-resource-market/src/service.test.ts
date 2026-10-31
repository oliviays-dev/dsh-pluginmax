import { describe, expect, it } from "vitest";
import {
  ResourceMarketService,
  resourceMarketDomainSpec,
  type CustomResourceRecord,
  type InstallRecord,
  type KvTableLike,
} from "./service.js";
import {
  McpProviderRegistry,
  type McpToolProvider,
} from "./mcp-registry.js";

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

function tables() {
  return {
    installs: new FakeTable<InstallRecord>(),
    customAssets: new FakeTable<CustomResourceRecord>(),
  };
}

describe("ResourceMarketService", () => {
  it("routes MCP assets through multiple providers and unloads cleanly", async () => {
    const registry = new McpProviderRegistry();
    let disposed = 0;
    const provider = (id: string, assetId: string): McpToolProvider => ({
      id,
      list: async () => [
        {
          id: assetId,
          name: assetId,
          description: "",
          category: "履约",
          protocol: "MCP · stdio",
          toolCount: 1,
          publisher: {
            id,
            name: id,
            verified: false,
            kind: "community",
          },
          version: "1.0.0",
          icon: "store",
          permissions: ["read"],
          initialStatus: "off",
          status: "off",
        },
      ],
      connect: async () => ({ status: "connected" }),
      callTool: async (input) => ({
        provider: id,
        tool: input.toolName,
      }),
      dispose: async () => {
        disposed += 1;
      },
    });
    const first = provider("provider-a", "mcp-a");
    const second = provider("provider-b", "mcp-b");
    const disposeFirst = registry.register(first);
    registry.register(second);
    expect((await registry.list({ userId: "alice" })).map((item) => item.id))
      .toEqual(["mcp-a", "mcp-b"]);
    await expect(
      registry.callTool({
        userId: "alice",
        mcpId: "mcp-b",
        toolName: "read_asset",
        arguments: {},
      }),
    ).resolves.toEqual({ provider: "provider-b", tool: "read_asset" });
    disposeFirst();
    await Promise.resolve();
    expect(disposed).toBe(1);
    expect((await registry.list({ userId: "alice" })).map((item) => item.id))
      .toEqual(["mcp-b"]);
    await expect(
      registry.callTool({
        userId: "alice",
        mcpId: "mcp-missing",
        toolName: "read_asset",
        arguments: {},
      }),
    ).rejects.toMatchObject({ code: "not_found" });
    await registry.dispose();
    expect(disposed).toBe(2);
  });

  it("fails closed when two providers publish the same MCP asset", async () => {
    const registry = new McpProviderRegistry();
    const provider = (id: string) => ({
      id,
      list: async () => [
        {
          id: "mcp-duplicate",
          name: id,
          description: "",
          category: "履约",
          protocol: "MCP · stdio",
          toolCount: 1,
          publisher: {
            id,
            name: id,
            verified: false,
            kind: "community" as const,
          },
          version: "1.0.0",
          icon: "store",
          permissions: ["read"],
          initialStatus: "off" as const,
          status: "off" as const,
        },
      ],
    });
    registry.register(provider("provider-a"));
    registry.register(provider("provider-b"));
    await expect(registry.list({ userId: "alice" })).rejects.toMatchObject({
      code: "conflict",
    });
    await registry.dispose();
  });

  it("declares a separate market domain", () => {
    expect(resourceMarketDomainSpec.name).toBe("collab_resource_market");
    expect(Object.keys(resourceMarketDomainSpec.tables)).toEqual([
      "installs",
      "custom_assets",
    ]);
  });

  it("distinguishes packaged plugins from user enablement", () => {
    const enabled = new Set<string>();
    const service = new ResourceMarketService(
      tables(),
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
      tables(),
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
      tables(),
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
      tables(),
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
      tables(),
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
              category: "采购",
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
      tables(),
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

  it("registers private custom resources without executing manifests", async () => {
    const service = new ResourceMarketService(
      tables(),
      {
        workbench: () => ({
          entitlements: () => [],
          enablePlugin: async () => undefined,
        }),
      },
    );
    const created = await service.registerCustomResource("alice", {
      type: "skill",
      name: "我的采购助手",
      description: "内部试点能力",
      version: "0.1.0",
      publisherName: "Alice",
      permissions: ["采购摘要只读"],
      manifest: { schemaVersion: 1 },
    });
    expect(created).toMatchObject({
      ownerId: "alice",
      category: "自定义",
      source: "user",
    });
    expect(
      service.customResources("alice", {
        type: "skill",
        category: "自定义",
      }),
    ).toHaveLength(1);
    expect(
      service.customResources("bob", {
        type: "skill",
        category: "自定义",
      }),
    ).toHaveLength(0);
    await expect(
      service.removeCustomResource(
        { userId: "bob", role: "member" },
        created.id,
      ),
    ).rejects.toMatchObject({ code: "not_found" });
    await service.removeCustomResource(
      { userId: "admin", role: "admin" },
      created.id,
    );
    expect(service.customResources("alice")).toHaveLength(0);
  });
});
