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
import { ManualPlanningCoordinator } from "./manual-planning.js";
import { PlanningService, type PlanningTable } from "./service.js";

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
}

function setup(
  input: {
    readonly knowledge?: import("./knowledge-provider.js").PlanningKnowledgeProvider;
  } = {},
) {
  let tick = Date.parse("2026-11-16T00:00:00.000Z");
  const planning = new PlanningService(
    {
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
    },
    { now: () => new Date((tick += 1_000)) },
  );
  let dispatched: Record<string, unknown> | undefined;
  let agentRunStatus = "queued";
  const coordinator = new ManualPlanningCoordinator({
    planning,
    team: {
      members: () => [{ userId: "user-1", memberRole: "member" }],
      users: () => [{ id: "user-1", name: "用户一" }],
    },
    tasks: {
      get: (taskId) => ({
        id: taskId,
        workspaceId: "ws-1",
        title: "采购异常处置",
        description: "整理异常并形成处置计划",
        acceptance: ["覆盖责任人和下一步"],
        priority: "P1",
        receiverType: "human",
        receiverId: "user-1",
        createdBy: "user-1",
        createdByName: "用户一",
        updatedAt: "2026-11-16T00:00:00.000Z",
      }),
    },
    teammates: () => ({
      ensureWorkspaceSystemAgent: async () => ({
        id: "planner-1",
        name: "任务规划伙伴",
        systemKey: "task-planner",
        workspaceBinding: { workspaceId: "ws-1", roleKey: "task-planner" },
      }),
      ensureRuntime: async () => ({
        teammateId: "planner-1",
        profileId: "profile-1",
        principalId: "principal-1",
      }),
      assignable: () => [
        {
          id: "agent-worker",
          name: "执行 Agent",
          ownerName: "用户一",
        },
      ],
    }),
    teammateService: () => ({
      get: () => ({
        id: "planner-1",
        name: "任务规划伙伴",
        systemKey: "task-planner",
        workspaceBinding: { workspaceId: "ws-1", roleKey: "task-planner" },
      }),
      workspaceAgentFor: () => undefined,
    }),
    teammateSkills: () => ({
      resolveForScene: async () => ({
        teammateId: "planner-1",
        templateId: "sys-task-planner",
        policyVersion: "v1",
        excluded: [],
        effective: [
          {
            id: "skill-task-planning-core",
            name: "任务规划核心方法",
            version: "1.0.0",
            bindingSource: "platform",
            mode: "required",
            scenes: ["task-planning"],
            instructions: "# 任务规划核心方法",
            instructionsHash:
              "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
          },
        ],
      }),
    }),
    context: () => ({
      prepare: async () => ({
        id: "pack-1",
        sessionBindingId: "task:task-1:planner:principal-1:g0",
        rendered: {
          systemText: "[platform-policy]\nplatform",
          userText: "planning task",
          flattenedPrompt: "prompt",
        },
        sections: [
          { type: "platform-policy", text: "platform" },
          { type: "mode-policy", text: "# 任务规划核心方法" },
          { type: "current-input", text: "理解并规划任务" },
        ],
      }),
      session: () => ({ sessionId: "de-planning-session" }),
      recordRuntime: async () => undefined,
    }),
    principalRuntime: () => undefined,
    agent: () => ({
      dispatch: async (input) => {
        dispatched = input as unknown as Record<string, unknown>;
        return { id: "run-1", status: "queued" };
      },
      run: () => ({ id: "run-1", status: agentRunStatus }),
      profile: () => ({
        id: "profile-1",
        name: "任务规划伙伴",
        status: "active",
      }),
    }),
    workspaces: () => ({
      get: () => ({ path: "/tmp/workspace" }),
    }),
    plans: {
      detail: () => ({
        plan: { id: "plan-1" },
        version: { id: "plan-1:1", graph: { nodes: [] } },
        nodeStates: [],
      }),
    },
    knowledge: () => input.knowledge,
  });
  return {
    planning,
    coordinator,
    dispatched: () => dispatched,
    setAgentRunStatus: (status: string) => {
      agentRunStatus = status;
    },
  };
}

describe("manual planning coordinator", () => {
  it("creates, contextualizes, and dispatches a workspace planner run", async () => {
    const harness = setup();
    await harness.planning.updateSettings("ws-1", "user-1", {
      enabled: true,
      defaultPlannerAgentId: "planner-1",
    });
    const result = await harness.coordinator.start({
      actor: {
        id: "user-1",
        name: "用户一",
        kind: "human",
        role: "member",
      },
      workspaceId: "ws-1",
      rootTaskId: "task-1",
      expectedTaskRevision: "2026-11-16T00:00:00.000Z",
      mode: "standard",
    });
    expect(result.run).toMatchObject({
      status: "understanding",
      plannerTeammateId: "planner-1",
      plannerProfileId: "profile-1",
      plannerPrincipalId: "principal-1",
      runId: "run-1",
      sessionId: "de-planning-session",
      contextPackId: "pack-1",
    });
    expect(
      harness.planning.skillSnapshot(result.run.id)?.skills[0],
    ).toMatchObject({
      id: "skill-task-planning-core",
      mode: "required",
    });
    expect(harness.dispatched()).toMatchObject({
      contextPackId: "pack-1",
      sessionId: "de-planning-session",
      payload: {
        context: {
          systemText: expect.stringContaining("[mode-policy]"),
          instruction: expect.stringContaining("[current-input]"),
          planningRunId: result.run.id,
        },
      },
    });
  });

  it("loads optional enterprise knowledge into an auditable receipt", async () => {
    const harness = setup({
      knowledge: {
        retrieve: async () => ({
          contributions: [
            {
              id: "policy-1",
              title: "采购审批规则",
              text: "金额超限必须人工审批",
              authority: "policy",
              version: "2",
              sourceRefs: [
                {
                  type: "document",
                  id: "sop-1",
                  version: "2",
                },
              ],
              confidence: "high",
            },
          ],
          excluded: [{ id: "private", reason: "permission" }],
        }),
      },
    });
    await harness.planning.updateSettings("ws-1", "user-1", {
      enabled: true,
      knowledgeProviderId: "kb-1",
    });
    const result = await harness.coordinator.start({
      actor: {
        id: "user-1",
        name: "用户一",
        kind: "human",
        role: "member",
      },
      workspaceId: "ws-1",
      rootTaskId: "task-1",
      expectedTaskRevision: "2026-11-16T00:00:00.000Z",
      mode: "standard",
    });
    expect(result.run.knowledgeReceiptId).toBeDefined();
    expect(harness.planning.knowledgeReceipts(result.run.id)[0]).toMatchObject({
      providerId: "kb-1",
      contributions: [{ id: "policy-1", authority: "policy" }],
      excluded: [{ id: "private", reason: "permission" }],
    });
  });

  it("fails an active run when the Planner Agent ends without submitting a plan", async () => {
    const harness = setup();
    await harness.planning.updateSettings("ws-1", "user-1", {
      enabled: true,
    });
    const started = await harness.coordinator.start({
      actor: {
        id: "user-1",
        name: "用户一",
        kind: "human",
        role: "member",
      },
      workspaceId: "ws-1",
      rootTaskId: "task-1",
      expectedTaskRevision: "2026-11-16T00:00:00.000Z",
      mode: "quick",
    });
    harness.setAgentRunStatus("failed");
    const refreshed = await harness.coordinator.refresh(started.run.id);
    expect(refreshed.run).toMatchObject({
      status: "failed",
      errorCode: "planner_run_finished",
    });
  });

  it("starts an independent Critic run after a Plan Draft is saved", async () => {
    const harness = setup();
    await harness.planning.updateSettings("ws-1", "user-1", {
      enabled: true,
    });
    const actor = {
      id: "user-1",
      name: "用户一",
      kind: "human" as const,
      role: "member" as const,
    };
    const started = await harness.coordinator.start({
      actor,
      workspaceId: "ws-1",
      rootTaskId: "task-1",
      expectedTaskRevision: "2026-11-16T00:00:00.000Z",
      mode: "standard",
    });
    await harness.planning.transition(started.run.id, "drafting", {
      expectedRevision: started.run.revision,
    });
    await harness.planning.saveRequirementBrief(started.run.id, {
      originalRequest: "形成处置计划",
      interpretedGoal: "形成可验收的处置计划",
    });
    await harness.planning.saveFactsLedger(started.run.id, {
      verified: [],
    });
    const drafting = harness.planning.getRun(started.run.id);
    await harness.planning.transition(started.run.id, "critiquing", {
      expectedRevision: drafting.revision,
      patch: {
        planId: "plan-1",
        planVersionId: "plan-1:1",
      },
    });
    const critiquing = harness.planning.getRun(started.run.id);
    const withCritic = await harness.coordinator.startCritic(
      started.run.id,
      actor,
    );
    expect(withCritic).toMatchObject({
      status: "critiquing",
      criticContextPackId: "pack-1",
      criticRunId: "run-1",
    });
    expect(withCritic.revision).toBeGreaterThan(critiquing.revision);
  });
});
