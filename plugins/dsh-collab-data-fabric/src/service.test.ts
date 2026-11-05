import { describe, expect, it } from "vitest";
import {
  FIXTURE_DATASET_ID,
  FIXTURE_METRIC_IDS,
  dataPolicySchema,
  dataSkillSchema,
  dataFabricDomainSpec,
} from "./models.js";
import {
  DataFabricError,
  DataFabricService,
  type DataFabricActor,
  type DataFabricTables,
} from "./service.js";

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

function harness() {
  const tables: DataFabricTables = {
    connections: new MemoryTable(),
    datasets: new MemoryTable(),
    metrics: new MemoryTable(),
    policies: new MemoryTable(),
    queryRuns: new MemoryTable(),
    queryResults: new MemoryTable(),
    skills: new MemoryTable(),
  };
  const service = new DataFabricService(tables, {
    now: () => new Date("2026-10-30T02:00:00.000Z"),
  });
  return { service, tables };
}

const owner: DataFabricActor = {
  userId: "owner",
  name: "Owner",
  workspaceRole: "owner",
};

const member: DataFabricActor = {
  userId: "alice",
  name: "Alice",
  workspaceRole: "member",
};

describe("DataFabricService", () => {
  it("publishes a backward-compatible v2 domain with authorized skills", async () => {
    const { service, tables } = harness();
    await service.ensureWorkspaceFixture("ws-1");
    const now = "2026-10-30T02:00:00.000Z";
    await tables.skills.put(
      "ws-1:skill-fixture",
      dataSkillSchema.parse({
        id: "skill-fixture",
        workspaceId: "ws-1",
        datasetId: FIXTURE_DATASET_ID,
        name: "Fixture Skill",
        version: "v1.0",
        triggers: ["异常"],
        instructions: "固定测试口径。",
        preferredMetricIds: [FIXTURE_METRIC_IDS.anomalyRate],
        defaultTimeRange: "today",
        status: "active",
        createdAt: now,
        updatedAt: now,
      }),
    );

    expect(dataFabricDomainSpec).toMatchObject({
      version: 2,
      compatibleVersions: [1],
    });
    await expect(
      service.skills(member, "ws-1", { query: "今天有没有异常" }),
    ).resolves.toEqual([
      expect.objectContaining({
        id: "skill-fixture",
        version: "v1.0",
        instructions: "固定测试口径。",
      }),
    ]);
  });

  it("seeds a generic fixture catalog per workspace", async () => {
    const { service } = harness();
    await service.ensureWorkspaceFixture("ws-1");
    const capabilities = await service.capabilities(owner, "ws-1");
    const catalog = await service.catalogSearch(owner, "ws-1", {
      query: "异常",
    });

    expect(capabilities).toMatchObject({
      dataQueryAvailable: true,
      connectionCount: 1,
      datasetCount: 1,
      metricCount: 7,
      fixtureOnly: true,
    });
    expect(catalog).toHaveLength(1);
    expect(catalog[0]?.datasetId).toBe(FIXTURE_DATASET_ID);
    expect(catalog[0]?.metrics.map((metric) => metric.id)).toContain(
      FIXTURE_METRIC_IDS.anomalyRate,
    );
  });

  it("hides denied fields and applies row policy", async () => {
    const { service, tables } = harness();
    await service.ensureWorkspaceFixture("ws-1");
    const now = "2026-10-30T02:00:00.000Z";
    await tables.policies.put(
      "ws-1:policy-alice",
      dataPolicySchema.parse({
        id: "policy-alice",
        workspaceId: "ws-1",
        datasetId: FIXTURE_DATASET_ID,
        subjectType: "user",
        subjectId: "alice",
        rowFilter: { region: ["east"] },
        deniedFields: ["amount"],
        maxRows: 20,
        timeoutMs: 5_000,
        version: "policy-v1",
        createdAt: now,
        updatedAt: now,
      }),
    );

    const description = await service.describe(
      member,
      "ws-1",
      FIXTURE_DATASET_ID,
    );
    expect(description.dataset.fields.map((field) => field.id)).not.toContain(
      "amount",
    );
    expect(description.permissionSummary).toContain("rowScope:region=east");

    const result = await service.query(member, "ws-1", {
      datasetId: FIXTURE_DATASET_ID,
      metricIds: [
        FIXTURE_METRIC_IDS.eventCount,
        FIXTURE_METRIC_IDS.anomalyCount,
      ],
      timeRange: {
        from: "2026-10-29T00:00:00.000Z",
        to: "2026-10-30T02:00:00.000Z",
      },
      filters: {},
      groupBy: ["region"],
      limit: 20,
    });

    expect(result.result.rows).toEqual([
      {
        region: "east",
        event_count: 24,
        anomaly_count: 18,
      },
    ]);
    expect(result.run).toMatchObject({
      status: "succeeded",
      datasetId: FIXTURE_DATASET_ID,
      policyVersionSnapshot: ["policy-v1"],
    });
    expect(service.queryRuns(member, "ws-1")).toHaveLength(1);
  });

  it("returns rate metrics and applies connection limits", async () => {
    const { service } = harness();
    await service.ensureWorkspaceFixture("ws-1");
    const result = await service.query(owner, "ws-1", {
      datasetId: FIXTURE_DATASET_ID,
      metricIds: [FIXTURE_METRIC_IDS.anomalyRate],
      timeRange: {
        from: "2026-10-29T00:00:00.000Z",
        to: "2026-10-30T02:00:00.000Z",
      },
      filters: {},
      groupBy: [],
      limit: 1,
    });
    expect(result.result.rows[0]?.anomaly_rate).toBe(75);
    expect(result.result.truncated).toBe(false);
    expect(result.result.evidence.join("\n")).toContain("fixture-v1");
  });

  it("denies project-scoped datasets without matching project context", async () => {
    const { service, tables } = harness();
    await service.ensureWorkspaceFixture("ws-1");
    const dataset = [
      ...tables.datasets.entries(),
    ][0]?.[1];
    expect(dataset).toBeDefined();
    if (dataset === undefined) return;
    await tables.datasets.put(`${dataset.workspaceId}:${dataset.id}`, {
      ...dataset,
      projectIds: ["project-a"],
    });

    await expect(
      service.query(
        { ...owner, projectId: "project-b" },
        "ws-1",
        {
          datasetId: FIXTURE_DATASET_ID,
          metricIds: [FIXTURE_METRIC_IDS.eventCount],
          timeRange: {
            from: "2026-10-29T00:00:00.000Z",
            to: "2026-10-30T02:00:00.000Z",
          },
          filters: {},
          groupBy: [],
          limit: 10,
        },
      ),
    ).rejects.toMatchObject({
      code: "forbidden",
    } satisfies Partial<DataFabricError>);
  });

  it("fails closed for guests", async () => {
    const { service } = harness();
    await expect(
      service.catalogSearch(
        { userId: "guest", workspaceRole: "guest" },
        "ws-1",
        {},
      ),
    ).rejects.toMatchObject({ code: "forbidden" });
  });
});
