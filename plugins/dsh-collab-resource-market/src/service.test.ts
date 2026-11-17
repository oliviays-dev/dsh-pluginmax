import { describe, expect, it } from "vitest";
import {
  ResourceMarketService,
  resourceMarketDomainSpec,
  type CustomResourceRecord,
  type InstallRecord,
  type KvTableLike,
  type ResourceLifecycleAudit,
  type ResourceLifecycleRecord,
} from "./service.js";
import { McpProviderRegistry, type McpToolProvider } from "./mcp-registry.js";

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
    lifecycle: new FakeTable<ResourceLifecycleRecord>(),
    lifecycleAudit: new FakeTable<ResourceLifecycleAudit>(),
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
    expect(
      (await registry.list({ userId: "alice" })).map((item) => item.id),
    ).toEqual(["mcp-a", "mcp-b"]);
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
    expect(
      (await registry.list({ userId: "alice" })).map((item) => item.id),
    ).toEqual(["mcp-b"]);
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
      "resource_lifecycle",
      "resource_lifecycle_audit",
    ]);
  });

  it("distinguishes packaged plugins from user enablement", () => {
    const enabled = new Set<string>();
    const service = new ResourceMarketService(tables(), {
      workbench: () => ({
        entitlements: () => [...enabled],
        enablePlugin: async (_principal, pluginId) => {
          enabled.add(pluginId);
          return { pluginId };
        },
      }),
    });
    expect(service.plugins({ userId: "alice" })[0]?.status).toBe("not_enabled");
    expect(service.runtimeStatus("pluginmax.daily-brief")).toBe("packaged");
  });

  it("publishes the legacy workbench as a normal template", () => {
    const service = new ResourceMarketService(tables(), {
      workbench: () => ({
        entitlements: () => [],
        enablePlugin: async () => undefined,
      }),
    });
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
    const service = new ResourceMarketService(tables(), {
      workbench: () => ({
        entitlements: () => [],
        enablePlugin: async () => undefined,
      }),
    });
    const record = await service.connectMcp("alice", "mcp-wecom");
    expect(record.status).toBe("pending");
    expect(
      (await service.mcps({ userId: "alice" })).find(
        (item) => item.id === "mcp-wecom",
      )?.status,
    ).toBe("pending");
  });

  it("never reports a seed MCP as connected without a provider", async () => {
    const service = new ResourceMarketService(tables(), {
      workbench: () => ({
        entitlements: () => [],
        enablePlugin: async () => undefined,
      }),
    });
    const mcps = await service.mcps({ userId: "alice" });
    expect(mcps.every((item) => item.status !== "connected")).toBe(true);
    expect(mcps.every((item) => item.source === "seed")).toBe(true);
    expect(mcps.every((item) => item.connectionMode === "request_only")).toBe(
      true,
    );
  });

  it("accepts connected only from an MCP provider", async () => {
    const service = new ResourceMarketService(tables(), {
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
    });
    const mcps = await service.mcps({ userId: "alice" });
    expect(mcps[0]).toMatchObject({
      status: "connected",
      source: "provider",
      connectionMode: "provider",
    });
  });

  it("disconnects a provider MCP and clears the stored connection", async () => {
    const connected = new Set<string>();
    const store = tables();
    const service = new ResourceMarketService(store, {
      workbench: () => ({
        entitlements: () => [],
        enablePlugin: async () => undefined,
      }),
      mcpProvider: () => ({
        id: "test-mcp-provider",
        list: async (principal) => [
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
              kind: "certified" as const,
            },
            version: "1.0.0",
            icon: "store",
            permissions: ["只读"],
            initialStatus: "off" as const,
            status: connected.has(principal.userId)
              ? ("connected" as const)
              : ("off" as const),
          },
        ],
        connect: async (principal) => {
          connected.add(principal.userId);
          return { status: "connected" as const };
        },
        disconnect: async (principal) => {
          connected.delete(principal.userId);
        },
      }),
    });

    await expect(
      service.connectMcp("alice", "mcp-provider"),
    ).resolves.toMatchObject({ status: "connected" });
    expect((await service.mcps({ userId: "alice" }))[0]?.status).toBe(
      "connected",
    );

    await service.disconnectMcp("alice", "mcp-provider");
    expect((await service.mcps({ userId: "alice" }))[0]?.status).toBe("off");
    expect([...store.installs.entries()]).toHaveLength(0);
  });

  it("restores a stored MCP connection after the provider runtime resets", async () => {
    const connected = new Set<string>();
    const store = tables();
    const provider = () => ({
      id: "test-mcp-provider",
      list: async (principal: { userId: string }) => [
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
            kind: "certified" as const,
          },
          version: "1.0.0",
          icon: "store",
          permissions: ["只读"],
          initialStatus: "off" as const,
          status: connected.has(principal.userId)
            ? ("connected" as const)
            : ("off" as const),
        },
      ],
      connect: async (principal: { userId: string }) => {
        connected.add(principal.userId);
        return { status: "connected" as const };
      },
    });
    const options = {
      workbench: () => ({
        entitlements: () => [],
        enablePlugin: async () => undefined,
      }),
      mcpProvider: provider,
    };
    const first = new ResourceMarketService(store, options);
    await first.connectMcp("linlan", "mcp-provider");

    connected.clear();
    const restarted = new ResourceMarketService(store, options);
    const mcps = await restarted.mcps({ userId: "linlan" });

    expect(mcps[0]?.status).toBe("connected");
    expect(connected.has("linlan")).toBe(true);
  });

  it("exposes real template titles, dependencies, and filters", () => {
    const service = new ResourceMarketService(tables(), {
      workbench: () => ({
        entitlements: () => [],
        enablePlugin: async () => undefined,
      }),
    });
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
    const service = new ResourceMarketService(tables(), {
      workbench: () => ({
        entitlements: () => [],
        enablePlugin: async () => undefined,
      }),
    });
    const created = await service.registerCustomResource("alice", {
      type: "skill",
      name: "我的采购助手",
      description: "内部试点能力",
      version: "0.1.0",
      publisherName: "Alice",
      permissions: ["采购摘要只读"],
      manifest: {
        schemaVersion: 1,
        instructions: "# 采购摘要\n只输出可核实的采购结论。",
        triggers: ["procurement-review"],
      },
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
        { userId: "admin", role: "admin" },
        created.id,
      ),
    ).rejects.toMatchObject({ code: "not_found" });
    await service.removeCustomResource(
      { userId: "alice", role: "member" },
      created.id,
    );
    expect(service.customResources("alice")).toHaveLength(0);
  });

  it("lets owners and admins edit shared custom resources in place", async () => {
    const service = new ResourceMarketService(tables(), {
      workbench: () => ({
        entitlements: () => [],
        enablePlugin: async () => undefined,
      }),
    });
    const created = await service.registerCustomResource("alice", {
      type: "skill",
      name: "项目汇报草稿",
      description: "仅自己可见",
      version: "1.0.0",
      publisherName: "Alice",
      manifest: {
        instructions: "# 项目汇报\n先给结论。",
        triggers: ["project-report"],
      },
    });
    expect(created.actions.canEdit).toBe(true);

    const updated = await service.updateCustomResource(
      { userId: "alice", role: "member" },
      created.id,
      {
        name: "项目汇报生成",
        description: "项目成员共享",
        version: "1.1.0",
        publisherName: "Pluginmax 官方",
        permissions: ["project:read"],
        sharingScope: "platform",
        manifest: {
          instructions: "# 项目汇报生成\n先结论，后证据。",
          triggers: ["project-report", "weekly-report"],
        },
      },
    );
    expect(updated).toMatchObject({
      id: created.id,
      ownerId: "alice",
      name: "项目汇报生成",
      version: "1.1.0",
      sharingScope: "platform",
      publicationStatus: "published",
      actions: { canEdit: true },
    });
    expect(
      service
        .customResources({ userId: "bob", role: "member" }, { type: "skill" })
        .some((resource) => resource.id === created.id),
    ).toBe(true);
    await expect(
      service.updateCustomResource(
        { userId: "bob", role: "member" },
        created.id,
        {
          name: "越权修改",
          sharingScope: "platform",
        },
      ),
    ).rejects.toMatchObject({ code: "forbidden" });

    const adminView = service
      .customResources({ userId: "admin", role: "admin" }, { type: "skill" })
      .find((resource) => resource.id === created.id);
    expect(adminView?.actions.canEdit).toBe(true);
    const adminUpdated = await service.updateCustomResource(
      { userId: "admin", role: "admin" },
      created.id,
      {
        name: "项目汇报生成",
        description: "平台管理员修订",
        permissions: ["project:read", "project:report"],
      },
    );
    expect(adminUpdated.description).toBe("平台管理员修订");
    await expect(
      service.updateCustomResource(
        { userId: "alice", role: "member" },
        created.id,
        {
          name: "项目汇报生成",
          sharingScope: "private",
        },
      ),
    ).rejects.toMatchObject({ code: "conflict" });
  });

  it("installs custom skills and resolves their versioned instructions", async () => {
    const service = new ResourceMarketService(tables(), {
      workbench: () => ({
        entitlements: () => [],
        enablePlugin: async () => undefined,
      }),
    });
    const created = await service.registerCustomResource("alice", {
      type: "skill",
      name: "工作日报",
      description: "主管可读的短日报",
      version: "1.0.0",
      publisherName: "Alice",
      permissions: ["task:read", "run:read"],
      manifest: {
        schemaVersion: 1,
        instructions: "# 工作日报\n先结论，后证据。",
        triggers: ["work-report"],
      },
    });

    await service.installSkill("alice", created.id);
    const installed = await service.installedSkills("alice");
    expect(installed).toEqual([
      expect.objectContaining({
        id: created.id,
        name: "工作日报",
        source: "user",
        status: "enabled",
        instructions: expect.stringContaining("先结论"),
        triggers: ["work-report"],
      }),
    ]);
    await expect(service.resolveSkills("alice", [created.id])).resolves.toEqual(
      [expect.objectContaining({ id: created.id, version: "1.0.0" })],
    );
    await expect(service.installedSkills("bob")).resolves.toEqual([]);
    await service.uninstallSkill("alice", created.id);
    await expect(service.installedSkills("alice")).resolves.toEqual([]);
    await expect(
      service.uninstallSkill("alice", created.id),
    ).rejects.toMatchObject({
      code: "not_found",
    });
    await service.removeCustomResource("alice", created.id);
    await expect(service.installedSkills("alice")).resolves.toEqual([]);
  });

  it("binds component-scoped skills and switches the active skill per target", async () => {
    const service = new ResourceMarketService(tables(), {
      workbench: () => ({
        entitlements: () => [],
        enablePlugin: async () => undefined,
      }),
    });
    const targetId = "workbench.panel.pluginmax.daily-brief#project-summary";
    await service.installSkill("alice", "skill-daily-brief-project-digest", {
      targetIds: [targetId],
      activeTargetId: targetId,
    });
    const custom = await service.registerCustomResource("alice", {
      type: "skill",
      name: "自定义项目概览",
      version: "1.0.0",
      manifest: {
        instructions: "生成三行项目概览。",
        mountTargets: [
          {
            type: "component-slot",
            targetId,
            componentId: "pluginmax.daily-brief",
            componentLabel: "每日简报",
            slotId: "project-summary",
            slotLabel: "项目关键进展概览",
          },
        ],
      },
    });
    await service.installSkill("alice", custom.id, {
      targetIds: [targetId],
      activeTargetId: targetId,
    });
    const installed = await service.installedSkills("alice");
    expect(
      installed.find((skill) => skill.id === "skill-daily-brief-project-digest")
        ?.bindings,
    ).toEqual([expect.objectContaining({ targetId, active: false })]);
    expect(installed.find((skill) => skill.id === custom.id)?.bindings).toEqual(
      [expect.objectContaining({ targetId, active: true })],
    );

    await service.setSkillTargetActive(
      "alice",
      "skill-daily-brief-project-digest",
      targetId,
    );
    const switched = await service.installedSkills("alice");
    expect(
      switched.find((skill) => skill.id === "skill-daily-brief-project-digest")
        ?.bindings,
    ).toEqual([expect.objectContaining({ targetId, active: true })]);
    expect(switched.find((skill) => skill.id === custom.id)?.bindings).toEqual([
      expect.objectContaining({ targetId, active: false }),
    ]);
    await expect(service.skillsForTarget("alice", targetId)).resolves.toEqual({
      targetId,
      activeSkillId: "skill-daily-brief-project-digest",
      skills: expect.arrayContaining([
        expect.objectContaining({
          id: "skill-daily-brief-project-digest",
          instructions: expect.stringContaining("必须严格输出三行"),
          bindings: [expect.objectContaining({ active: true })],
        }),
      ]),
    });
  });

  it("lets a member delist only their own shared resource", async () => {
    const store = tables();
    const service = new ResourceMarketService(store, {
      workbench: () => ({
        entitlements: () => [],
        enablePlugin: async () => undefined,
      }),
    });
    const created = await service.registerCustomResource(
      { userId: "alice", role: "member" },
      {
        type: "skill",
        name: "共享采购助手",
        version: "1.0.0",
        sharingScope: "platform",
        manifest: {
          instructions: "# 共享采购助手\n只输出已核实结论。",
          triggers: ["procurement-review"],
        },
      },
    );
    expect(created).toMatchObject({
      sharingScope: "platform",
      publicationStatus: "published",
      actions: { canDelist: true },
    });
    expect(
      (await service.skills({ userId: "bob", role: "member" })).some(
        (skill) => skill.id === created.id,
      ),
    ).toBe(true);

    await service.installSkill({ userId: "bob", role: "member" }, created.id);
    await expect(
      service.delistResource(
        { userId: "bob", role: "member" },
        {
          resourceType: "skill",
          resourceId: created.id,
          expectedRevision: 1,
        },
      ),
    ).rejects.toMatchObject({ code: "forbidden" });

    await expect(
      service.delistResource(
        { userId: "alice", role: "member" },
        {
          resourceType: "skill",
          resourceId: created.id,
          reasonCode: "owner_withdraw",
          expectedRevision: 1,
        },
      ),
    ).resolves.toMatchObject({
      resource: {
        publicationStatus: "delisted",
        revision: 2,
      },
    });
    expect(
      (await service.skills({ userId: "bob", role: "member" })).some(
        (skill) => skill.id === created.id,
      ),
    ).toBe(false);
    expect(
      (
        await service.skills(
          { userId: "bob", role: "member" },
          { publicationStatus: "delisted" },
        )
      ).some((skill) => skill.id === created.id),
    ).toBe(false);
    expect(
      (
        await service.skills(
          { userId: "alice", role: "member" },
          { publicationStatus: "delisted" },
        )
      ).some((skill) => skill.id === created.id),
    ).toBe(true);
    expect(
      (await service.installedSkills({ userId: "bob", role: "member" })).find(
        (skill) => skill.id === created.id,
      ),
    ).toMatchObject({
      status: "enabled",
      publicationStatus: "delisted",
    });
    await expect(
      service.resolveSkills({ userId: "bob", role: "member" }, [created.id]),
    ).resolves.toEqual([
      expect.objectContaining({
        id: created.id,
        publicationStatus: "delisted",
      }),
    ]);
    await expect(
      service.installSkill({ userId: "charlie", role: "member" }, created.id),
    ).rejects.toMatchObject({ code: "conflict" });

    await expect(
      service.relistResource(
        { userId: "alice", role: "member" },
        {
          resourceType: "skill",
          resourceId: created.id,
          expectedRevision: 2,
        },
      ),
    ).resolves.toMatchObject({
      resource: {
        publicationStatus: "published",
        revision: 3,
      },
    });
    expect([...store.lifecycleAudit.entries()]).toHaveLength(2);
  });

  it("keeps platform delisting admin-only and locks admin-forced user delists", async () => {
    const store = tables();
    const service = new ResourceMarketService(store, {
      workbench: () => ({
        entitlements: () => [],
        enablePlugin: async () => undefined,
      }),
    });
    await expect(
      service.delistResource(
        { userId: "alice", role: "member" },
        {
          resourceType: "skill",
          resourceId: "skill-project-reporting",
          expectedRevision: 1,
        },
      ),
    ).rejects.toMatchObject({ code: "forbidden" });
    await expect(
      service.delistResource(
        { userId: "admin", role: "admin" },
        {
          resourceType: "skill",
          resourceId: "skill-project-reporting",
          reasonCode: "platform_governance",
          expectedRevision: 1,
        },
      ),
    ).resolves.toMatchObject({
      resource: {
        origin: "platform",
        publicationStatus: "delisted",
        revision: 2,
      },
    });
    expect(
      (await service.skills({ userId: "alice", role: "member" })).some(
        (skill) => skill.id === "skill-project-reporting",
      ),
    ).toBe(false);
    await expect(
      service.installSkill(
        { userId: "alice", role: "member" },
        "skill-project-reporting",
      ),
    ).rejects.toMatchObject({ code: "conflict" });

    const shared = await service.registerCustomResource(
      { userId: "alice", role: "member" },
      {
        type: "skill",
        name: "管理员可治理的共享 Skill",
        sharingScope: "platform",
        manifest: { instructions: "# Shared\n只使用授权数据。" },
      },
    );
    await service.delistResource(
      { userId: "admin", role: "admin" },
      {
        resourceType: "skill",
        resourceId: shared.id,
        reasonCode: "security_risk",
        expectedRevision: 1,
      },
    );
    await expect(
      service.relistResource(
        { userId: "alice", role: "member" },
        {
          resourceType: "skill",
          resourceId: shared.id,
          expectedRevision: 2,
        },
      ),
    ).rejects.toMatchObject({ code: "forbidden" });
    await expect(
      service.relistResource(
        { userId: "admin", role: "admin" },
        {
          resourceType: "skill",
          resourceId: shared.id,
          expectedRevision: 2,
        },
      ),
    ).resolves.toMatchObject({
      resource: {
        publicationStatus: "published",
        adminLocked: false,
        revision: 3,
      },
    });
  });

  it("hides delisted templates and plugins and blocks new enablement", async () => {
    const service = new ResourceMarketService(tables(), {
      workbench: () => ({
        entitlements: () => [],
        enablePlugin: async () => undefined,
      }),
    });
    await service.delistResource(
      { userId: "admin", role: "admin" },
      {
        resourceType: "workbench-template",
        resourceId: "tpl-legacy",
        expectedRevision: 1,
      },
    );
    expect(
      service
        .templateList("alice", {})
        .items.some((template) => template.id === "tpl-legacy"),
    ).toBe(false);
    expect(service.templateDetail("alice", "tpl-legacy")).toBeUndefined();
    expect(
      service.templateDetail("admin", "tpl-legacy", undefined, {
        includeDelisted: true,
      })?.publicationStatus,
    ).toBe("delisted");

    await service.delistResource(
      { userId: "admin", role: "admin" },
      {
        resourceType: "panel-plugin",
        resourceId: "pluginmax.daily-brief",
        expectedRevision: 1,
      },
    );
    expect(
      service
        .pluginList("alice", {})
        .items.some((plugin) => plugin.id === "pluginmax.daily-brief"),
    ).toBe(false);
    await expect(
      service.enablePlugin("alice", "pluginmax.daily-brief"),
    ).resolves.toMatchObject({ status: "disabled" });
  });

  it("blocks delisted MCPs from new connections", async () => {
    const service = new ResourceMarketService(tables(), {
      workbench: () => ({
        entitlements: () => [],
        enablePlugin: async () => undefined,
      }),
    });
    await service.delistResource(
      { userId: "admin", role: "admin" },
      {
        resourceType: "mcp",
        resourceId: "mcp-wecom",
        expectedRevision: 1,
      },
    );
    expect(
      (await service.mcps({ userId: "alice", role: "member" })).some(
        (mcp) => mcp.id === "mcp-wecom",
      ),
    ).toBe(false);
    await expect(
      service.connectMcp({ userId: "alice", role: "member" }, "mcp-wecom"),
    ).rejects.toMatchObject({ code: "conflict" });
  });

  it("lets only platform admins publish the official project reporting skill", async () => {
    const service = new ResourceMarketService(tables(), {
      workbench: () => undefined,
    });
    await expect(
      service.saveOfficialSkill(
        { userId: "alice", role: "member" },
        {
          id: "skill-project-reporting",
          name: "项目汇报生成",
          description: "生成项目日报、周报和进度汇报",
          instructions: "# 项目汇报生成\n先结论，后证据。",
        },
      ),
    ).rejects.toMatchObject({ code: "forbidden" });

    const saved = await service.saveOfficialSkill(
      { userId: "admin", role: "admin" },
      {
        id: "skill-project-reporting",
        name: "项目汇报生成",
        description: "生成项目日报、周报和进度汇报",
        version: "1.1.0",
        permissions: ["project:read"],
        instructions: "# 项目汇报生成\n先结论，后证据。",
        triggers: ["project-report", "weekly-report"],
      },
    );
    expect(saved).toMatchObject({
      id: "skill-project-reporting",
      ownerId: "platform",
      version: "1.1.0",
    });
    const listed = await service.skills({ userId: "alice", role: "member" });
    expect(listed).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "skill-project-reporting",
          name: "项目汇报生成",
          version: "1.1.0",
          instructions: expect.stringContaining("先结论"),
        }),
      ]),
    );
    await service.installSkill("alice", "skill-project-reporting");
    await expect(
      service.resolveSkills("alice", ["skill-project-reporting"]),
    ).resolves.toEqual([
      expect.objectContaining({
        id: "skill-project-reporting",
        version: "1.1.0",
      }),
    ]);
  });
});
