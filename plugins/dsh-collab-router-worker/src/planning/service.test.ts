import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import type {
  FactsLedger,
  PlanCriticReport,
  PlanningEvent,
  PlanningKnowledgeReceipt,
  PlanningQualityMetric,
  PlanningRun,
  PlanningSettings,
  PlanningSkillSnapshot,
  PlanningTriggerReceipt,
  RequirementBrief,
} from "./models.js";
import { PlanningError, PlanningService } from "./service.js";
import type { PlanningTable } from "./service.js";

class MemoryTable<V> implements PlanningTable<V> {
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

  size(): number {
    return this.values.size;
  }
}

function setup() {
  let tick = Date.parse("2026-11-16T00:00:00.000Z");
  const tables = {
    settings: new MemoryTable<PlanningSettings>(),
    runs: new MemoryTable<PlanningRun>(),
    receipts: new MemoryTable<PlanningTriggerReceipt>(),
    requirementBriefs: new MemoryTable<RequirementBrief>(),
    factsLedgers: new MemoryTable<FactsLedger>(),
    criticReports: new MemoryTable<PlanCriticReport>(),
    skillSnapshots: new MemoryTable<PlanningSkillSnapshot>(),
    knowledgeReceipts: new MemoryTable<PlanningKnowledgeReceipt>(),
    events: new MemoryTable<PlanningEvent>(),
    qualityMetrics: new MemoryTable<PlanningQualityMetric>(),
  };
  const service = new PlanningService(tables, {
    now: () => new Date((tick += 1_000)),
  });
  return { service, tables };
}

async function enablePlanning(service: PlanningService) {
  return service.updateSettings("workspace-1", "user-1", {
    enabled: true,
    defaultPlannerAgentId: "planner-1",
  });
}

describe("Planning service settings and triggers", () => {
  it("is disabled by default and enforces settings CAS", async () => {
    const { service } = setup();
    const initial = service.settings("workspace-1");
    expect(initial).toMatchObject({
      enabled: false,
      revision: 0,
      humanOwner: { allowManualPlanning: true },
      agentOwnerPolicy: { requirePlanBeforeExecution: true },
    });
    await expect(
      service.requestPlanningTrigger({
        workspaceId: "workspace-1",
        rootTaskId: "task-1",
        taskRevision: "rev-1",
        trigger: { kind: "human-manual", userId: "user-1" },
      }),
    ).rejects.toMatchObject({ code: "planning_disabled" });

    const enabled = await enablePlanning(service);
    expect(enabled).toMatchObject({
      enabled: true,
      revision: 1,
      defaultPlannerAgentId: "planner-1",
    });
    await expect(
      service.updateSettings("workspace-1", "user-1", {
        expectedRevision: 0,
        enabled: false,
      }),
    ).rejects.toMatchObject({ code: "revision_conflict" });

    await service.updateSettings("workspace-1", "user-1", {
      expectedRevision: 1,
      humanOwner: { allowManualPlanning: false },
    });
    await expect(
      service.requestPlanningTrigger({
        workspaceId: "workspace-1",
        rootTaskId: "task-1",
        taskRevision: "rev-1",
        trigger: { kind: "human-manual", userId: "user-1" },
      }),
    ).rejects.toMatchObject({ code: "planning_disabled" });
  });

  it("creates receipts idempotently and joins the active run", async () => {
    const { service } = setup();
    await enablePlanning(service);
    const first = await service.requestPlanningTrigger({
      workspaceId: "workspace-1",
      rootTaskId: "task-1",
      taskRevision: "rev-1",
      trigger: { kind: "human-manual", userId: "user-1" },
      mode: "standard",
      eventKey: "manual-1",
    });
    expect(first).toMatchObject({
      joinedActive: false,
      createdRun: true,
      run: {
        status: "queued",
        taskRevision: "rev-1",
        mode: "standard",
        plannerAgentId: "planner-1",
      },
    });

    const duplicate = await service.requestPlanningTrigger({
      workspaceId: "workspace-1",
      rootTaskId: "task-1",
      taskRevision: "rev-1",
      trigger: { kind: "human-manual", userId: "user-1" },
      mode: "standard",
      eventKey: "manual-1",
    });
    expect(duplicate.run.id).toBe(first.run.id);
    expect(duplicate.receipt.id).toBe(first.receipt.id);
    expect(duplicate.createdRun).toBe(false);
    expect(service.listRuns({ workspaceId: "workspace-1" })).toHaveLength(1);

    const merged = await service.requestPlanningTrigger({
      workspaceId: "workspace-1",
      rootTaskId: "task-1",
      taskRevision: "rev-2",
      trigger: {
        kind: "task-spec-changed",
        field: "acceptance",
      },
      eventKey: "changed-2",
    });
    expect(merged.joinedActive).toBe(true);
    expect(merged.run.id).toBe(first.run.id);
    expect(merged.receipt.status).toBe("pending");
    expect(service.pendingReceipts("workspace-1", "task-1")).toHaveLength(1);
  });

  it("consumes only the newest pending receipt after a run finishes", async () => {
    const { service } = setup();
    await enablePlanning(service);
    const first = await service.requestPlanningTrigger({
      workspaceId: "workspace-1",
      rootTaskId: "task-1",
      taskRevision: "rev-1",
      trigger: { kind: "human-manual", userId: "user-1" },
      eventKey: "manual-1",
    });
    await service.requestPlanningTrigger({
      workspaceId: "workspace-1",
      rootTaskId: "task-1",
      taskRevision: "rev-2",
      trigger: { kind: "task-spec-changed", field: "description" },
      eventKey: "changed-2",
    });
    const newest = await service.requestPlanningTrigger({
      workspaceId: "workspace-1",
      rootTaskId: "task-1",
      taskRevision: "rev-3",
      trigger: { kind: "task-spec-changed", field: "acceptance" },
      eventKey: "changed-3",
    });

    await service.transition(first.run.id, "preparing");
    await service.transition(first.run.id, "understanding");
    await service.transition(first.run.id, "drafting");
    await service.transition(first.run.id, "critiquing");
    await service.transition(first.run.id, "validating");
    const completed = await service.completeRun(first.run.id);
    expect(completed.run.status).toBe("succeeded");
    expect(completed.nextRun).toMatchObject({
      status: "queued",
      taskRevision: "rev-3",
      trigger: { kind: "task-spec-changed", field: "acceptance" },
    });
    expect(completed.nextRun?.id).not.toBe(first.run.id);
    expect(service.pendingReceipts("workspace-1", "task-1")).toHaveLength(0);
    expect(service.activeRun("workspace-1", "task-1")?.id).toBe(
      completed.nextRun?.id,
    );
    expect(service.receipt(newest.receipt.id)?.status).toBe("consumed");
  });
});

describe("Planning service state and artifacts", () => {
  it("rejects invalid transitions and stale run revisions", async () => {
    const { service } = setup();
    await enablePlanning(service);
    const requested = await service.requestPlanningTrigger({
      workspaceId: "workspace-1",
      rootTaskId: "task-1",
      taskRevision: "rev-1",
      trigger: { kind: "human-manual", userId: "user-1" },
    });
    await expect(
      service.transition(requested.run.id, "succeeded"),
    ).rejects.toMatchObject({ code: "invalid_transition" });
    await service.transition(requested.run.id, "preparing");
    await expect(
      service.transition(requested.run.id, "understanding", {
        expectedRevision: requested.run.revision,
      }),
    ).rejects.toMatchObject({ code: "revision_conflict" });
  });

  it("does not delete artifacts when a run fails and records an audit event", async () => {
    const { service } = setup();
    await enablePlanning(service);
    const requested = await service.requestPlanningTrigger({
      workspaceId: "workspace-1",
      rootTaskId: "task-1",
      taskRevision: "rev-1",
      trigger: { kind: "human-manual", userId: "user-1" },
    });
    await service.transition(requested.run.id, "preparing");
    await service.transition(requested.run.id, "understanding");
    const brief = await service.saveRequirementBrief(requested.run.id, {
      originalRequest: "整理采购异常并形成处置计划",
      interpretedGoal: "形成可验收的采购异常处置计划",
      deliverables: [{ title: "处置计划" }],
      acceptanceCriteria: ["覆盖异常、责任人和下一步"],
      confidence: "high",
    });
    await service.saveFactsLedger(requested.run.id, {
      verified: [
        {
          statement: "任务要求形成处置计划",
          sourceRef: { type: "task", id: "task-1" },
          confidence: "high",
          impact: "scope",
        },
      ],
    });
    const failed = await service.failRun(
      requested.run.id,
      "planner_unavailable",
      "Planner runtime is unavailable",
    );
    expect(failed.run).toMatchObject({
      status: "failed",
      errorCode: "planner_unavailable",
    });
    expect(service.briefs(requested.run.id)[0]?.id).toBe(brief.id);
    expect(service.facts(requested.run.id)).toHaveLength(1);
    expect(
      service.events(requested.run.id).some((event) => event.type === "failed"),
    ).toBe(true);
    await expect(
      service.saveRequirementBrief(requested.run.id, {
        originalRequest: "changed",
        interpretedGoal: "changed",
      }),
    ).rejects.toMatchObject({ code: "conflict" });
    await expect(
      service.failRun(requested.run.id, "again", "again"),
    ).resolves.toMatchObject({ run: { status: "failed" } });
  });

  it("cancels idempotently and discards merged triggers", async () => {
    const { service } = setup();
    await enablePlanning(service);
    const first = await service.requestPlanningTrigger({
      workspaceId: "workspace-1",
      rootTaskId: "task-1",
      taskRevision: "rev-1",
      trigger: { kind: "human-manual", userId: "user-1" },
    });
    const merged = await service.requestPlanningTrigger({
      workspaceId: "workspace-1",
      rootTaskId: "task-1",
      taskRevision: "rev-2",
      trigger: { kind: "agent-assigned", agentId: "agent-1" },
    });
    const cancelled = await service.cancelRun(first.run.id, "user cancelled");
    expect(cancelled.run).toMatchObject({
      status: "cancelled",
      cancelReason: "user cancelled",
    });
    expect(service.receipt(merged.receipt.id)?.status).toBe("discarded");
    await expect(
      service.cancelRun(first.run.id, "again"),
    ).resolves.toMatchObject({ run: { status: "cancelled" } });
  });

  it("stores versioned planning artifacts and snapshots without hot swapping skills", async () => {
    const { service } = setup();
    await enablePlanning(service);
    const requested = await service.requestPlanningTrigger({
      workspaceId: "workspace-1",
      rootTaskId: "task-1",
      taskRevision: "rev-1",
      trigger: { kind: "human-manual", userId: "user-1" },
    });
    await service.transition(requested.run.id, "preparing");
    await service.transition(requested.run.id, "understanding");
    const firstBrief = await service.saveRequirementBrief(requested.run.id, {
      originalRequest: "v1",
      interpretedGoal: "v1",
    });
    const secondBrief = await service.saveRequirementBrief(requested.run.id, {
      originalRequest: "v2",
      interpretedGoal: "v2",
    });
    expect([firstBrief.version, secondBrief.version]).toEqual([1, 2]);

    const hash = createHash("sha256").update("# planning core").digest("hex");
    const snapshot = await service.saveSkillSnapshot(requested.run.id, {
      teammateId: "planner-1",
      templateId: "sys-task-planner",
      scene: "task-planning",
      policyVersion: "planning-skill-v1",
      skills: [
        {
          id: "skill-task-planning-core",
          name: "任务规划核心方法",
          version: "1.0.0",
          bindingSource: "platform",
          mode: "required",
          scenes: ["task-planning"],
          instructions: "# planning core",
          instructionsHash: hash,
          sourceRefs: [
            {
              type: "text",
              id: "skill-task-planning-core",
              version: "1.0.0",
            },
          ],
        },
      ],
    });
    const again = await service.saveSkillSnapshot(requested.run.id, {
      scene: "task-planning",
      policyVersion: "different",
      skills: [],
    });
    expect(again.id).toBe(snapshot.id);
    expect(again.skills[0]?.instructionsHash).toBe(hash);
    expect(service.basis(requested.run.id)).toMatchObject({
      run: { id: requested.run.id },
      briefs: [{ version: 1 }, { version: 2 }],
      skillSnapshot: { id: snapshot.id },
    });
  });

  it("uses stable error codes", () => {
    const error = new PlanningError("revision_conflict", "stale");
    expect(error).toMatchObject({
      name: "PlanningError",
      code: "revision_conflict",
      message: "stale",
    });
  });
});
