import { describe, expect, it } from "vitest";
import {
  WorkbenchV2Service,
  type KvTableLike,
  type WorkbenchV2Tables,
} from "./service.js";
import type {
  PanelEntitlement,
  PanelInstance,
  WorkbenchAudit,
  WorkbenchPreference,
  WorkbenchRecord,
} from "./models.js";
import { workbenchV2DomainSpec } from "./models.js";

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

function setup(
  teammateWorkload?: {
    snapshot(principal: { userId: string }): Promise<unknown>;
  },
) {
  let sequence = 0;
  const tables: WorkbenchV2Tables = {
    workbenches: new FakeTable<WorkbenchRecord>(),
    preferences: new FakeTable<WorkbenchPreference>(),
    panelEntitlements: new FakeTable<PanelEntitlement>(),
    idempotency: new FakeTable<{
      key: string;
      userId: string;
      operation: string;
      result: unknown;
      createdAt: string;
    }>(),
    audit: new FakeTable<WorkbenchAudit>(),
  };
  const service = new WorkbenchV2Service(tables, {
    team: () => ({
      users: () => [
        { id: "alice", name: "Alice" },
        { id: "bob", name: "Bob" },
      ],
      members: (workspaceId: string) =>
        workspaceId === "ws-team"
          ? [{ userId: "alice" }, { userId: "bob" }]
          : [],
    }),
    now: () => new Date("2026-10-28T00:00:00.000Z"),
    id: () => String(++sequence),
    ...(teammateWorkload === undefined
      ? {}
      : { teammateWorkload: () => teammateWorkload }),
  });
  return { service, tables };
}

describe("WorkbenchV2Service", () => {
  it("declares an isolated storage domain", () => {
    expect(workbenchV2DomainSpec.name).toBe("collab_workbench_v2");
    expect(Object.keys(workbenchV2DomainSpec.tables)).toEqual([
      "workbenches",
      "preferences",
      "panel_entitlements",
      "idempotency",
      "audit",
    ]);
  });

  it("creates independent workbench instances and persists the active one", async () => {
    const { service } = setup();
    const first = await service.create(
      { userId: "alice" },
      { name: "供应链作战台" },
    );
    const second = await service.create(
      { userId: "alice" },
      { name: "本周复盘" },
    );
    const listing = await service.list({ userId: "alice" });
    expect(listing.workbenches.map((item) => item.name)).toEqual([
      "供应链作战台",
      "本周复盘",
    ]);
    expect(listing.preference.activeWorkbenchId).toBe(second.id);

    const panel: PanelInstance = {
      id: "panel-1",
      pluginId: "pluginmax.task-focus",
      pluginVersion: "1.0.0",
      span: 2,
      order: 0,
      config: {},
    };
    const saved = await service.saveDraft(
      { userId: "alice", name: "Alice" },
      {
        workbenchId: second.id,
        expectedRevision: second.revision,
        panels: [panel],
      },
    );
    expect(saved.panels).toEqual([panel]);
    expect(saved.updatedByName).toBe("Alice");
    const unchanged = await service.detail({ userId: "alice" }, first.id);
    expect(unchanged.panels).not.toEqual([panel]);
  });

  it("records who last changed the layout or settings", async () => {
    const { service } = setup();
    const workbench = await service.create(
      { userId: "alice", name: "Alice" },
      { name: "可审计工作台" },
    );
    const updated = await service.update(
      { userId: "alice", name: "Alice" },
      workbench.id,
      { name: "新名称" },
    );
    expect(updated.updatedBy).toBe("alice");
    expect(updated.updatedByName).toBe("Alice");
    expect(updated.updatedAt).toBe("2026-10-28T00:00:00.000Z");
  });

  it("creates a genuinely empty workbench for the blank starter", async () => {
    const { service } = setup();
    const workbench = await service.create(
      { userId: "alice", name: "Alice" },
      { name: "空白工作台" },
    );
    expect(workbench.panels).toEqual([]);
  });

  it("enforces revision, ownership, and team visibility", async () => {
    const { service } = setup();
    const workbench = await service.create(
      { userId: "alice" },
      {
        name: "团队发布台",
        visibility: "team",
        sharedWorkspaceIds: ["ws-team"],
      },
    );
    await expect(
      service.saveDraft(
        { userId: "alice" },
        {
          workbenchId: workbench.id,
          expectedRevision: workbench.revision + 1,
          panels: workbench.panels,
        },
      ),
    ).rejects.toMatchObject({
      code: "conflict",
    });
    await expect(
      service.update({ userId: "bob" }, workbench.id, { name: "越权修改" }),
    ).rejects.toMatchObject({ code: "forbidden" });
    await expect(
      service.detail({ userId: "bob" }, workbench.id),
    ).resolves.toMatchObject({ id: workbench.id });
    await expect(
      service.detail({ userId: "mallory" }, workbench.id),
    ).rejects.toMatchObject({ code: "not_found" });
  });

  it("duplicates layouts with new panel instance ids", async () => {
    const { service } = setup();
    const source = await service.create(
      { userId: "alice" },
      {
        name: "源工作台",
        panels: [
          {
            pluginId: "pluginmax.task-focus",
            pluginVersion: "1.0.0",
            span: 2,
            order: 0,
            config: {},
          },
        ],
      },
    );
    const copy = await service.duplicate(
      { userId: "alice" },
      source.id,
      "副本",
    );
    expect(copy.name).toBe("副本");
    expect(copy.id).not.toBe(source.id);
    expect(copy.panels.map((panel) => panel.id)).not.toEqual(
      source.panels.map((panel) => panel.id),
    );
    expect(copy.revision).toBe(1);
  });

  it("enables panels and adds multiple instances of the same plugin", async () => {
    const { service } = setup();
    const workbench = await service.create(
      { userId: "alice" },
      { name: "执行台" },
    );
    await service.enablePlugin({ userId: "alice" }, "pluginmax.team-load");
    const first = await service.addPanel(
      { userId: "alice" },
      {
        workbenchId: workbench.id,
        pluginId: "pluginmax.team-load",
        span: 3,
      },
    );
    const second = await service.addPanel(
      { userId: "alice" },
      {
        workbenchId: first.id,
        pluginId: "pluginmax.team-load",
        span: 3,
      },
    );
    const instances = second.panels.filter(
      (panel) => panel.pluginId === "pluginmax.team-load",
    );
    expect(instances).toHaveLength(2);
    expect(instances[0]?.id).not.toBe(instances[1]?.id);
  });

  it("replays idempotent writes and rejects stale panel additions", async () => {
    const { service } = setup();
    const workbench = await service.create(
      { userId: "alice" },
      { name: "幂等工作台" },
    );
    let calls = 0;
    const first = await service.idempotent(
      { userId: "alice" },
      "panel_add",
      "same-request",
      async () => {
        calls += 1;
        return { value: calls };
      },
    );
    const second = await service.idempotent(
      { userId: "alice" },
      "panel_add",
      "same-request",
      async () => {
        calls += 1;
        return { value: calls };
      },
    );
    expect(first).toEqual({ value: 1 });
    expect(second).toEqual(first);
    expect(calls).toBe(1);

    await service.enablePlugins(
      { userId: "alice" },
      ["pluginmax.team-load"],
    );
    await expect(
      service.addPanel(
        { userId: "alice" },
        {
          workbenchId: workbench.id,
          expectedRevision: workbench.revision + 1,
          pluginId: "pluginmax.team-load",
        },
      ),
    ).rejects.toMatchObject({ code: "conflict" });
  });

  it("reads AI partner workload from the teammate activity port", async () => {
    const { service } = setup({
      snapshot: async (principal) => ({
        generatedAt: "2026-10-28T00:00:00.000Z",
        activeCount: 1,
        inactiveCount: 2,
        owner: principal.userId,
        items: [],
      }),
    });
    const panel = await service.panelData(
      { userId: "alice" },
      "pluginmax.team-load",
    );
    expect(panel).toMatchObject({
      title: "AI伙伴负载",
      source: "live",
      data: {
        activeCount: 1,
        inactiveCount: 2,
        owner: "alice",
      },
    });
  });
});
