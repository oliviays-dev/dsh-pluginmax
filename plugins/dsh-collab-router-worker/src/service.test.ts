import { describe, expect, it } from "vitest";
import {
  RouterWorkerPlanService,
  type PlanActor,
  type RouterWorkerTable,
  type TaskCreationLike,
} from "./service.js";
import type {
  DispatchBinding,
  FinalDraft,
  NodeState,
  PlanRecord,
  PlanVersion,
} from "./models.js";

class Table<V> implements RouterWorkerTable<V> {
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
}

const actor: PlanActor = {
  id: "alice",
  name: "Alice",
  kind: "human",
  role: "member",
};

function setup(
  options: {
    enabled?: boolean;
    dispatchAgentNodes?: boolean;
    rootReceiverType?: "human" | "agent";
    rootReceiverId?: string;
    rootCreatedBy?: string;
  } = {},
) {
  const plans = new Table<PlanRecord>();
  const versions = new Table<PlanVersion>();
  const nodes = new Table<NodeState>();
  const bindings = new Table<DispatchBinding>();
  const drafts = new Table<FinalDraft>();
  const created = new Map<string, string>();
  const taskStatuses = new Map<
    string,
    "todo" | "progress" | "review" | "done"
  >();
  const taskMessages: Array<{ taskId: string; content: string }> = [];
  const taskActivities: Array<{
    taskId: string;
    eventId: string;
    message: string;
    taskRefs?: readonly { taskId: string; title: string }[];
  }> = [];
  const statusChanges: Array<{ taskId: string; status: string }> = [];
  const dispatchCalls: Array<{ taskId: string; actorId: string }> = [];
  const creationInputs: Array<{
    actorId: string;
    actorName: string;
    type?: string;
    status?: string;
    autoSubmitReview?: boolean;
    autoApproveReview?: boolean;
    executionPolicy?: unknown;
  }> = [];
  const creation: TaskCreationLike = {
    createFromDraft: async (creationActor, input) => {
      creationInputs.push({
        actorId: creationActor.id,
        actorName: creationActor.name,
        ...(input.type === undefined ? {} : { type: input.type }),
        ...(input.status === undefined ? {} : { status: input.status }),
        ...(input.autoSubmitReview === undefined
          ? {}
          : { autoSubmitReview: input.autoSubmitReview }),
        ...(input.autoApproveReview === undefined
          ? {}
          : { autoApproveReview: input.autoApproveReview }),
        ...(input.executionPolicy === undefined
          ? {}
          : { executionPolicy: input.executionPolicy }),
      });
      const existing = created.get(input.creationKey);
      const taskId = existing ?? `task-${created.size + 1}`;
      created.set(input.creationKey, taskId);
      return {
        taskId,
        workspaceId: input.draft.workspaceId,
        title: input.draft.title,
        status: "todo",
        creationKey: input.creationKey,
        deduplicated: existing !== undefined,
        updatedAt: "2026-11-06T00:00:00.000Z",
      };
    },
  };
  const service = new RouterWorkerPlanService(
    { plans, versions, nodes, bindings, drafts },
    {
      tasks: () => ({
        get: (taskId) => ({
          id: taskId,
          workspaceId: "workspace-1",
          title: "Root task",
          priority: "P2",
          receiverType: options.rootReceiverType ?? "human",
          receiverId:
            options.rootReceiverType === "agent"
              ? "agent-owner"
              : (options.rootReceiverId ?? "alice"),
          ...(options.rootCreatedBy === undefined
            ? {}
            : { createdBy: options.rootCreatedBy }),
          createdByName: "Alice",
          status: taskStatuses.get(taskId) ?? "todo",
        }),
        addMessage: async (_actor, input) => {
          taskMessages.push({
            taskId: input.taskId,
            content: input.content,
          });
        },
        changeStatus: async (_actor, input) => {
          statusChanges.push({ taskId: input.taskId, status: input.status });
          taskStatuses.set(
            input.taskId,
            input.status === "review" ? "review" : input.status,
          );
        },
        recordActivity: async (_actor, input) => {
          if (
            !taskActivities.some(
              (activity) =>
                activity.taskId === input.taskId &&
                activity.eventId === input.eventId,
            )
          ) {
            taskActivities.push({
              taskId: input.taskId,
              eventId: input.eventId,
              message: input.message,
              ...(input.taskRefs === undefined
                ? {}
                : { taskRefs: input.taskRefs }),
            });
          }
        },
      }),
      taskCreation: () => creation,
      taskDispatch: () =>
        options.dispatchAgentNodes
          ? {
              dispatch: async (task, dispatchedBy) => {
                dispatchCalls.push({
                  taskId: task.id,
                  actorId: dispatchedBy.id,
                });
                return { execution: { runId: "run-agent-1" } };
              },
            }
          : undefined,
      permission: () => undefined,
      enabled: () => options.enabled ?? true,
    },
  );
  return {
    service,
    plans,
    versions,
    nodes,
    bindings,
    drafts,
    created,
    taskStatuses,
    taskMessages,
    statusChanges,
    taskActivities,
    dispatchCalls,
    creationInputs,
  };
}

const graph = {
  nodes: [
    {
      id: "research",
      title: "Research",
      description: "Collect evidence.",
      type: "task",
      receiverType: "human",
      receiverId: "alice",
      priority: "P2",
      acceptance: ["Evidence collected"],
      dependencies: [],
      reviewMode: "human",
      maxAttempts: 2,
      timeoutSeconds: 86_400,
    },
  ],
};

describe("Router / Worker plan service", () => {
  it("defaults to closed and rejects plan creation", async () => {
    const { service } = setup({ enabled: false });
    await expect(
      service.saveCreate(actor, {
        workspaceId: "workspace-1",
        rootTaskId: "root-1",
        graph,
      }),
    ).rejects.toMatchObject({ code: "gate_closed" });
  });

  it("rejects cyclic plans", async () => {
    const { service } = setup();
    await expect(
      service.saveCreate(actor, {
        workspaceId: "workspace-1",
        rootTaskId: "root-1",
        graph: {
          nodes: [
            { ...graph.nodes[0], id: "a", dependencies: ["b"] },
            { ...graph.nodes[0], id: "b", dependencies: ["a"] },
          ],
        },
      }),
    ).rejects.toThrow("循环依赖");
  });

  it("keeps a pending plan in the root task review queue until execution starts", async () => {
    const { service, taskStatuses, statusChanges, taskActivities } = setup();
    const result = await service.saveCreate(actor, {
      workspaceId: "workspace-1",
      rootTaskId: "root-1",
      source: "router",
      routerAgentId: "router-agent",
      graph,
    });

    expect(result.plan.status).toBe("draft");
    expect(taskStatuses.get("root-1")).toBe("review");
    expect(statusChanges).toEqual([{ taskId: "root-1", status: "review" }]);
    expect(
      taskActivities.some((item) => item.message.includes("创建任务规划 v1")),
    ).toBe(true);

    taskStatuses.set("root-1", "todo");
    statusChanges.length = 0;
    await service.ensurePendingReview(result.plan.id, actor);
    expect(taskStatuses.get("root-1")).toBe("review");
    expect(statusChanges).toEqual([{ taskId: "root-1", status: "review" }]);

    const approved = await service.approve(actor, {
      planId: result.plan.id,
      expectedRevision: result.plan.revision,
    });
    expect(taskStatuses.get("root-1")).toBe("review");

    await service.materialize(actor, approved.id);
    expect(taskStatuses.get("root-1")).toBe("progress");
    expect(statusChanges).toEqual([
      { taskId: "root-1", status: "review" },
      { taskId: "root-1", status: "progress" },
    ]);
    expect(
      taskActivities.some((item) => item.message.includes("确认任务规划 v1")),
    ).toBe(true);
    expect(
      taskActivities.some((item) => item.message.includes("派发任务规划 v1")),
    ).toBe(true);
    expect(
      taskActivities.find((item) => item.message.includes("派发任务规划 v1"))
        ?.taskRefs,
    ).toEqual([
      {
        taskId: "task-1",
        title: "Root task",
      },
    ]);
  });

  it("returns a replanned root task to review for plan confirmation", async () => {
    const { service, taskStatuses, statusChanges, taskActivities } = setup();
    const result = await service.saveCreate(actor, {
      workspaceId: "workspace-1",
      rootTaskId: "root-1",
      source: "router",
      routerAgentId: "router-agent",
      graph,
    });
    taskStatuses.set("root-1", "progress");
    statusChanges.length = 0;

    const replanned = await service.saveVersion(actor, {
      planId: result.plan.id,
      expectedRevision: result.plan.revision,
      graph,
      reason: "重新规划",
    });

    expect(replanned.plan.status).toBe("proposed");
    expect(taskStatuses.get("root-1")).toBe("review");
    expect(statusChanges).toEqual([{ taskId: "root-1", status: "review" }]);
    expect(
      taskActivities.some((item) => item.message.includes("更新任务规划至 v2")),
    ).toBe(true);
  });

  it("lets the human owner of the root task manage and save the plan", async () => {
    const { service } = setup({ rootReceiverId: "zhouning" });
    const creator: PlanActor = {
      ...actor,
      role: "owner",
    };
    const created = await service.saveCreate(creator, {
      workspaceId: "workspace-1",
      rootTaskId: "root-1",
      graph,
    });
    const taskOwner: PlanActor = {
      id: "zhouning",
      name: "周宁",
      kind: "human",
      role: "member",
    };
    const outsider: PlanActor = {
      id: "outsider",
      name: "Outsider",
      kind: "human",
      role: "member",
    };
    expect(service.canManage(created.plan, creator)).toBe(true);
    expect(service.canManage(created.plan, taskOwner)).toBe(true);
    expect(service.canManage(created.plan, outsider)).toBe(false);
    const saved = await service.saveVersion(taskOwner, {
      planId: created.plan.id,
      expectedRevision: created.plan.revision,
      graph: {
        ...graph,
        nodes: graph.nodes.map((node) => ({
          ...node,
          title: "任务负责人调整后的节点",
        })),
      },
      reason: "主任务负责人调整计划",
    });
    expect(saved.plan.createdBy).toBe(creator.id);
    expect(saved.plan.status).toBe("proposed");
    expect(saved.version.graph.nodes[0]?.title).toBe("任务负责人调整后的节点");
  });

  it("materializes ordinary tasks idempotently after approval", async () => {
    const { service, bindings, created } = setup();
    const result = await service.saveCreate(actor, {
      workspaceId: "workspace-1",
      rootTaskId: "root-1",
      graph,
    });
    const approved = await service.approve(actor, {
      planId: result.plan.id,
      expectedRevision: result.plan.revision,
    });
    const first = await service.materialize(actor, approved.id);
    const second = await service.materialize(actor, approved.id);

    expect(first.createdTaskIds).toEqual(["task-1"]);
    expect(second.createdTaskIds).toEqual(["task-1"]);
    expect(created.size).toBe(1);
    expect(bindings.records.size).toBe(1);
  });

  it("reuses a lazily created node task when dispatching", async () => {
    const { service, bindings, dispatchCalls } = setup({
      dispatchAgentNodes: true,
    });
    const result = await service.saveCreate(actor, {
      workspaceId: "workspace-1",
      rootTaskId: "root-1",
      graph: {
        nodes: [
          {
            ...graph.nodes[0],
            receiverType: "agent",
            receiverId: "agent-1",
          },
        ],
      },
    });
    const ensured = await service.ensureNodeTask(actor, {
      planId: result.plan.id,
      nodeId: "research",
    });
    expect(bindings.records.size).toBe(1);
    const approved = await service.approve(actor, {
      planId: result.plan.id,
      expectedRevision: result.plan.revision,
    });
    const dispatched = await service.materialize(actor, approved.id);
    expect(dispatched.createdTaskIds).toEqual([ensured.taskId]);
    expect(bindings.records.size).toBe(1);
    expect(dispatchCalls).toEqual([
      { taskId: ensured.taskId, actorId: actor.id },
    ]);
  });

  it("passes plan-authored task fields into materialized tasks", async () => {
    const { service, creationInputs } = setup();
    const executionPolicy = {
      schemaVersion: 1,
      runtime: {
        selection: "recommended",
        allowedRuntimeIds: [],
        requiredCapabilities: [],
        model: "deepseek-chat",
        reasoningEffort: "high",
      },
      sourcePolicy: {
        allow: ["workspace"],
        deny: ["private-local-data"],
        citation: "none",
        requirePublishedAt: false,
        requireAccessedAt: false,
      },
      toolPolicy: {
        allow: [],
        deny: [],
        requireApproval: ["fs.write"],
      },
      evidence: {
        requirePlan: true,
        requireToolEvents: true,
        requireCitations: false,
        requireStructuredSubagents: false,
      },
      humanGates: [],
      budget: {},
    } as const;
    const result = await service.saveCreate(actor, {
      workspaceId: "workspace-1",
      rootTaskId: "root-1",
      graph: {
        nodes: [
          {
            ...graph.nodes[0],
            taskType: "缺陷",
            initialStatus: "progress",
            autoSubmitReview: false,
            autoApproveReview: true,
            executionPolicy,
          },
        ],
      },
    });
    const approved = await service.approve(actor, {
      planId: result.plan.id,
      expectedRevision: result.plan.revision,
    });
    await service.materialize(actor, approved.id);
    expect(creationInputs[0]).toMatchObject({
      actorId: actor.id,
      type: "缺陷",
      status: "progress",
      autoSubmitReview: false,
      autoApproveReview: true,
      executionPolicy,
    });
  });

  it("lets the master task owner create a plan for another user's task", async () => {
    const { service } = setup({
      rootCreatedBy: "alice",
      rootReceiverId: "bob",
    });
    const owner: PlanActor = {
      id: "bob",
      name: "Bob",
      kind: "human",
      role: "member",
    };
    const result = await service.saveCreate(owner, {
      workspaceId: "workspace-1",
      rootTaskId: "root-1",
      graph,
    });
    expect(result.plan.createdBy).toBe("bob");
  });

  it("does not grant plan management to the master task creator", async () => {
    const { service } = setup({
      rootCreatedBy: "alice",
      rootReceiverId: "bob",
    });
    const owner: PlanActor = {
      id: "bob",
      name: "Bob",
      kind: "human",
      role: "member",
    };
    await expect(
      service.saveCreate(actor, {
        workspaceId: "workspace-1",
        rootTaskId: "root-1",
        graph,
      }),
    ).rejects.toThrow("只有主任务负责人、Agent 主任务创建人或项目负责人");
    const result = await service.saveCreate(owner, {
      workspaceId: "workspace-1",
      rootTaskId: "root-1",
      graph,
    });
    expect(service.canManage(result.plan, actor)).toBe(false);
  });

  it("uses the plan confirmer as the creator of materialized tasks", async () => {
    const { service, creationInputs } = setup();
    const confirmer: PlanActor = {
      id: "bob",
      name: "Bob",
      kind: "human",
      role: "owner",
    };
    const materializer: PlanActor = {
      id: "carol",
      name: "Carol",
      kind: "human",
      role: "admin",
    };
    const result = await service.saveCreate(actor, {
      workspaceId: "workspace-1",
      rootTaskId: "root-1",
      source: "router",
      routerAgentId: "router-agent",
      graph,
    });
    const approved = await service.approve(confirmer, {
      planId: result.plan.id,
      expectedRevision: result.plan.revision,
    });
    expect(approved).toMatchObject({
      confirmedBy: "bob",
      confirmedByName: "Bob",
      confirmedByRole: "owner",
    });

    await service.materialize(materializer, approved.id);
    expect(creationInputs[0]).toMatchObject({
      actorId: "bob",
      actorName: "Bob",
    });
  });

  it("replaces an existing plan source when regeneration explicitly allows it", async () => {
    const { service } = setup();
    const created = await service.saveCreate(actor, {
      workspaceId: "workspace-1",
      rootTaskId: "root-1",
      graph,
    });
    const regenerated = await service.saveVersion(actor, {
      planId: created.plan.id,
      expectedRevision: created.plan.revision,
      graph,
      source: "router",
      settings: { routerAgentId: "router-agent" },
      replaceExisting: true,
      reason: "Router 重新生成",
    });
    expect(regenerated.plan).toMatchObject({
      source: "router",
      routerAgentId: "router-agent",
      status: "proposed",
      currentVersion: 2,
    });
  });

  it("dispatches agent nodes with the materialized task before the actor", async () => {
    const { service, dispatchCalls, nodes } = setup({
      dispatchAgentNodes: true,
    });
    const result = await service.saveCreate(actor, {
      workspaceId: "workspace-1",
      rootTaskId: "root-1",
      graph: {
        nodes: [
          {
            ...graph.nodes[0],
            receiverType: "agent",
            receiverId: "agent-1",
          },
        ],
      },
    });
    const approved = await service.approve(actor, {
      planId: result.plan.id,
      expectedRevision: result.plan.revision,
    });

    await service.materialize(actor, approved.id);

    expect(dispatchCalls).toEqual([{ taskId: "task-1", actorId: actor.id }]);
    expect(nodes.records.get(`${approved.id}:research`)).toMatchObject({
      status: "dispatching",
      taskId: "task-1",
      runId: "run-agent-1",
    });
  });

  it("dispatches unlocked dependent agent tasks with the task before the actor", async () => {
    const { service, dispatchCalls, nodes } = setup({
      dispatchAgentNodes: true,
    });
    const result = await service.saveCreate(actor, {
      workspaceId: "workspace-1",
      rootTaskId: "root-1",
      graph: {
        nodes: [
          graph.nodes[0],
          {
            ...graph.nodes[0],
            id: "agent-work",
            receiverType: "agent",
            receiverId: "agent-1",
            dependencies: ["research"],
          },
        ],
      },
    });
    const approved = await service.approve(actor, {
      planId: result.plan.id,
      expectedRevision: result.plan.revision,
    });
    await service.materialize(actor, approved.id);
    dispatchCalls.length = 0;
    const first = nodes.records.get(`${approved.id}:research`)!;
    await nodes.put(first.id, {
      ...first,
      status: "accepted",
    });

    await service.reconcile(approved.id);

    expect(dispatchCalls).toEqual([{ taskId: "task-2", actorId: actor.id }]);
    expect(nodes.records.get(`${approved.id}:agent-work`)).toMatchObject({
      status: "dispatching",
      taskId: "task-2",
      runId: "run-agent-1",
    });
  });

  it("pauses on disable and requires an explicit resume", async () => {
    const { service } = setup();
    const result = await service.saveCreate(actor, {
      workspaceId: "workspace-1",
      rootTaskId: "root-1",
      graph,
    });
    const approved = await service.approve(actor, {
      planId: result.plan.id,
      expectedRevision: result.plan.revision,
    });
    await service.materialize(actor, approved.id);
    await service.pauseWorkspace("workspace-1");
    expect(service.detail(approved.id).plan.status).toBe("resume_required");
    expect(service.activePlans()).toHaveLength(0);
    await expect(service.resume(actor, approved.id)).resolves.toMatchObject({
      status: "active",
    });
  });

  it("creates a handoff draft without moving a human-owned root task", async () => {
    const { service, taskStatuses, taskMessages, statusChanges } = setup();
    const twoNodeGraph = {
      nodes: [
        ...graph.nodes,
        {
          ...graph.nodes[0],
          id: "review",
          title: "Review",
          dependencies: ["research"],
        },
      ],
    };
    const result = await service.saveCreate(actor, {
      workspaceId: "workspace-1",
      rootTaskId: "root-1",
      source: "router",
      routerAgentId: "router-agent",
      graph: twoNodeGraph,
    });
    const approved = await service.approve(actor, {
      planId: result.plan.id,
      expectedRevision: result.plan.revision,
    });
    await service.materialize(actor, approved.id);
    taskStatuses.set("task-1", "done");
    taskStatuses.set("task-2", "done");
    const finalizing = await service.reconcile(approved.id);

    expect(finalizing.status).toBe("finalizing");
    expect(statusChanges).toEqual([
      { taskId: "root-1", status: "review" },
      { taskId: "root-1", status: "progress" },
    ]);
    const completed = await service.saveFinalDraft(actor, {
      planId: approved.id,
      routerAgentId: "router-agent",
      draft: {
        summary:
          "基于 rw-plan-60fef3f5-83cf-4d87-aa40-52e933c4dc64，两份节点结果已整理，等待负责人确认。",
        deliverables: [],
        risks: ["尚未确认最终业务口径"],
        openQuestions: ["是否接受当前交付？"],
        acceptance: [
          {
            criterion: "Evidence collected",
            status: "covered",
            evidence: "task-1",
          },
        ],
      },
    });
    expect(completed.plan.status).toBe("completed");
    expect(completed.finalDraft.summary).toContain("root-1");
    expect(completed.finalDraft.summary).not.toContain("rw-plan-");
    expect(taskMessages.at(-1)?.taskId).toBe("root-1");
    expect(taskMessages.at(-1)?.content).toContain("交付草稿");
    expect(statusChanges).toEqual([
      { taskId: "root-1", status: "review" },
      { taskId: "root-1", status: "progress" },
    ]);
  });

  it("submits an agent-owned root task to review after the final draft", async () => {
    const { service, taskStatuses, statusChanges } = setup({
      rootReceiverType: "agent",
      rootCreatedBy: "alice",
    });
    const result = await service.saveCreate(actor, {
      workspaceId: "workspace-1",
      rootTaskId: "root-1",
      source: "router",
      routerAgentId: "router-agent",
      graph,
    });
    const approved = await service.approve(actor, {
      planId: result.plan.id,
      expectedRevision: result.plan.revision,
    });
    await service.materialize(actor, approved.id);
    taskStatuses.set("task-1", "done");
    await service.reconcile(approved.id);

    const completed = await service.saveFinalDraft(actor, {
      planId: approved.id,
      routerAgentId: "router-agent",
      draft: {
        summary: "最终交付结果已整理。",
        deliverables: [],
        risks: [],
        openQuestions: [],
        acceptance: [],
      },
    });

    expect(completed.plan.finalizationMode).toBe("router_managed");
    expect(completed.plan.status).toBe("completed");
    expect(statusChanges).toContainEqual({
      taskId: "root-1",
      status: "review",
    });
    expect(statusChanges).not.toContainEqual({
      taskId: "root-1",
      status: "done",
    });
  });
});
