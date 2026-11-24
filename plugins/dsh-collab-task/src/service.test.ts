import { describe, expect, it } from "vitest";
import { TaskService, type KvTableLike } from "./service.js";
import type { TaskRecord } from "./types.js";

function memoryTable(): KvTableLike<TaskRecord> {
  const values = new Map<string, TaskRecord>();
  return {
    get: (key) => values.get(key),
    entries: () => values.entries(),
    keys: () => values.keys(),
    get size() {
      return values.size;
    },
    async put(key, value) {
      values.set(key, value);
    },
    async delete(key) {
      return values.delete(key);
    },
  };
}

const actor = { id: "admin", name: "Admin", kind: "human" } as const;

function storedTask(overrides: Record<string, unknown> = {}): TaskRecord {
  return {
    id: "TSK-legacy",
    workspaceId: "workspace-1",
    title: "Product design",
    type: "工作流",
    status: "progress",
    priority: "P2",
    receiverType: "human",
    receiverId: "admin",
    receiverName: "Admin",
    createdBy: "admin",
    createdByName: "Admin",
    description: "Submit the deliverable.",
    acceptance: ["PRD"],
    links: [],
    progress: 0,
    sessionEpoch: 0,
    autoSubmitReview: true,
    steps: [{ id: "step-1", label: "PRD", done: false }],
    agentRunIds: [],
    messages: [],
    comments: [],
    events: [],
    queueState: "idle",
    dependsOn: [],
    autoRunEligible: true,
    needsInput: false,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  } as unknown as TaskRecord;
}

describe("agent run delivery", () => {
  it("compacts inline document bodies before writing a task message", async () => {
    const table = memoryTable();
    await table.put(
      "TSK-agent",
      storedTask({
        id: "TSK-agent",
        receiverType: "agent",
        receiverId: "tm-report",
        receiverName: "报告伙伴",
      }),
    );
    const tasks = new TaskService({ tasks: table });
    const document = `<html>${"x".repeat(25_000)}</html>`;
    const updated = await tasks.attachAgentRun(
      "TSK-agent",
      {
        id: "run-report",
        instanceId: "TSK-agent",
        status: "succeeded",
        output: {
          summary: [
            "一页式简报已完成。",
            "<!-- pluginmax-document: report.html -->",
            document,
            "<!-- /pluginmax-document -->",
          ].join("\n"),
        },
      },
      "报告伙伴",
    );
    const message = updated.messages.find(
      (item) => item.runId === "run-report",
    );
    expect(message?.state).toBe("succeeded");
    expect(message?.content).toContain("一页式简报已完成");
    expect(message?.content).toContain("产出文档：report.html");
    expect(message?.content).not.toContain("<html>");
    expect(message?.content.length).toBeLessThanOrEqual(20_000);
  });
});

describe("task message lifecycle", () => {
  it("lets only one workflow candidate atomically claim a task", async () => {
    const tasks = new TaskService({ tasks: memoryTable() });
    const claimed: string[] = [];
    const rejected: string[] = [];
    tasks.bindWorkflowActions({
      assign: () => undefined,
      claimed: (task) => {
        claimed.push(task.id);
      },
      claimRejected: (_task, claimedActor, reason) => {
        rejected.push(`${claimedActor.id}:${reason}`);
      },
      decide: () => undefined,
      submit: () => undefined,
    });
    const created = await tasks.create(actor, {
      workspaceId: "workspace-1",
      title: "Candidate claim",
      priority: "P2",
      status: "todo",
      receiverType: "role",
      receiverId: "reviewer",
      receiverName: "Reviewer",
      description: "Claim from an explicit workflow candidate pool.",
      acceptance: ["Claimed once"],
      workflow: {
        instanceId: "workflow-1",
        nodeId: "review",
        instanceTitle: "Review",
        nodeName: "Review",
        dispatchMode: "claim",
        candidatePool: [
          { kind: "user", id: "olivia", name: "Olivia" },
          { kind: "user", id: "bob", name: "Bob" },
        ],
      },
    });

    await expect(
      tasks.claim(
        { id: "outsider", name: "Outsider", kind: "human" },
        created.id,
      ),
    ).rejects.toMatchObject({ code: "forbidden" });
    expect(rejected).toEqual(["outsider:当前用户不在任务候选池中"]);

    const results = await Promise.allSettled([
      tasks.claim({ id: "olivia", name: "Olivia", kind: "human" }, created.id),
      tasks.claim({ id: "bob", name: "Bob", kind: "human" }, created.id),
    ]);

    expect(
      results.filter((result) => result.status === "fulfilled"),
    ).toHaveLength(1);
    expect(
      results.filter((result) => result.status === "rejected"),
    ).toHaveLength(1);
    expect(
      results.find((result) => result.status === "rejected")?.reason?.message,
    ).toContain("任务已被其他候选人领取");
    expect(claimed).toEqual([created.id]);
    expect(tasks.get(created.id)).toMatchObject({
      receiverType: "human",
      status: "progress",
    });
  });

  it("records idempotent plan activity events", async () => {
    const tasks = new TaskService({ tasks: memoryTable() });
    const created = await tasks.create(actor, {
      workspaceId: "workspace-1",
      title: "Plan activity",
      priority: "P2",
      receiverType: "human",
      receiverId: "admin",
      receiverName: "Admin",
      description: "Track plan operations.",
      acceptance: ["Activity recorded"],
    });
    const first = await tasks.recordActivity(actor, {
      taskId: created.id,
      eventId: "plan:created:v1",
      message: "Admin 创建任务规划 v1",
    });
    const second = await tasks.recordActivity(actor, {
      taskId: created.id,
      eventId: "plan:created:v1",
      message: "Admin 派发任务规划 v1：",
      taskRefs: [
        {
          taskId: "TSK-child-1",
          title: "执行计划节点",
        },
      ],
    });
    expect(first.events.at(-1)).toMatchObject({
      id: "plan:created:v1",
      kind: "plan",
      message: "Admin 创建任务规划 v1",
    });
    expect(
      second.events.filter((event) => event.id === "plan:created:v1"),
    ).toHaveLength(1);
    expect(second.events.at(-1)).toMatchObject({
      message: "Admin 派发任务规划 v1：",
      taskRefs: [
        {
          taskId: "TSK-child-1",
          title: "执行计划节点",
        },
      ],
    });
  });

  it("starts a todo task when a human sends an instruction", async () => {
    const tasks = new TaskService({ tasks: memoryTable() });
    const created = await tasks.create(actor, {
      workspaceId: "workspace-1",
      title: "Start from message",
      priority: "P2",
      receiverType: "human",
      receiverId: "admin",
      receiverName: "Admin",
      description: "Proceed when instructed.",
      acceptance: ["Instruction handled"],
    });
    expect(created.status).toBe("todo");

    const updated = await tasks.addMessage(actor, {
      taskId: created.id,
      content: "现在开始执行",
    });

    expect(updated.status).toBe("progress");
    expect(updated.messages.at(-1)?.content).toBe("现在开始执行");
    expect(updated.events.at(-1)?.message).toContain(
      "发送指令，任务进入进行中",
    );
  });
});

describe("effective permission gate", () => {
  it("blocks human execution when the shared permission scope denies it", async () => {
    const table = memoryTable();
    await table.put(
      "TSK-scope",
      storedTask({
        id: "TSK-scope",
        status: "todo",
        receiverPrincipalId: "principal-human-admin",
      }),
    );
    const tasks = new TaskService(
      { tasks: table },
      {
        permissions: () => ({
          resolve: () => ({
            allowed: false,
            reasons: ["项目权限与负责人权限交集为空"],
          }),
        }),
      },
    );

    await expect(
      tasks.start(
        {
          ...actor,
          principalId: "principal-human-admin",
        },
        "TSK-scope",
      ),
    ).rejects.toThrow("项目权限与负责人权限交集为空");
  });

  it("keeps the legacy path working when no permission service is configured", async () => {
    const table = memoryTable();
    await table.put(
      "TSK-legacy-scope",
      storedTask({ id: "TSK-legacy-scope", status: "todo" }),
    );
    const tasks = new TaskService({ tasks: table });

    await expect(tasks.start(actor, "TSK-legacy-scope")).resolves.toMatchObject(
      {
        status: "progress",
      },
    );
  });
});

describe("task execution policy", () => {
  it("stores and updates the phase-one execution policy", async () => {
    const tasks = new TaskService({ tasks: memoryTable() });
    const executionPolicy = {
      schemaVersion: 1 as const,
      runtime: {
        selection: "recommended" as const,
        allowedRuntimeIds: [],
        requiredCapabilities: [
          { key: "search" as const, necessity: "required" as const },
        ],
      },
      sourcePolicy: {
        allow: ["workspace", "public-web"] as const,
        deny: ["private-local-data"] as const,
        citation: "required-for-factual-claims" as const,
        requirePublishedAt: true,
        requireAccessedAt: true,
      },
      toolPolicy: {
        allow: [],
        deny: [],
        requireApproval: ["fs.write"],
      },
      evidence: {
        requirePlan: true,
        requireToolEvents: true,
        requireCitations: true,
        requireStructuredSubagents: false,
      },
      humanGates: [],
      budget: {},
    };
    const created = await tasks.create(actor, {
      workspaceId: "workspace-1",
      title: "Research with sources",
      priority: "P2",
      receiverType: "human",
      receiverId: "admin",
      receiverName: "Admin",
      description: "Research the market.",
      acceptance: ["Report with citations"],
      executionPolicy,
    });
    expect(created.executionPolicy).toEqual(executionPolicy);

    const updated = await tasks.update(actor, {
      taskId: created.id,
      title: created.title,
      priority: created.priority,
      description: created.description,
      acceptance: created.acceptance,
      executionPolicy: {
        ...executionPolicy,
        evidence: {
          ...executionPolicy.evidence,
          requireToolEvents: false,
        },
      },
    });
    expect(updated.executionPolicy?.evidence.requireToolEvents).toBe(false);
  });

  it("applies draft creation policy without enabling review for human owners", async () => {
    const table = memoryTable();
    const tasks = new TaskService({ tasks: table });
    const executionPolicy = {
      schemaVersion: 1 as const,
      runtime: {
        selection: "recommended" as const,
        allowedRuntimeIds: [],
        requiredCapabilities: [],
      },
      sourcePolicy: {
        allow: ["workspace"] as const,
        deny: ["private-local-data"] as const,
        citation: "none" as const,
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
    };
    const result = await tasks.createFromDraft(actor, {
      draft: {
        workspaceId: "workspace-1",
        title: "Human draft task",
        description: "Created without opening the editor.",
        priority: "P2",
        receiverType: "human",
        receiverId: "admin",
        receiverName: "Admin",
        acceptance: ["Done"],
        collaboratorHints: [],
      },
      creationKey: "draft-human-1",
      executionPolicy,
      autoSubmitReview: true,
    });
    const task = tasks.get(result.taskId);
    expect(task).toMatchObject({
      status: "todo",
      autoSubmitReview: false,
      executionPolicy,
    });
  });

  it("keeps auto-submit review for draft tasks owned by an AI partner", async () => {
    const tasks = new TaskService({ tasks: memoryTable() });
    const result = await tasks.createFromDraft(actor, {
      draft: {
        workspaceId: "workspace-1",
        title: "Agent draft task",
        description: "Created without opening the editor.",
        priority: "P2",
        receiverType: "agent",
        receiverId: "agent-1",
        receiverName: "Data Agent",
        acceptance: ["Done"],
        collaboratorHints: [],
      },
      creationKey: "draft-agent-1",
      autoSubmitReview: true,
    });
    expect(tasks.get(result.taskId).autoSubmitReview).toBe(true);
    expect(tasks.get(result.taskId).autoApproveReview).toBe(false);
  });

  it("applies plan-authored task type, status, and review settings from a draft", async () => {
    const tasks = new TaskService({ tasks: memoryTable() });
    const result = await tasks.createFromDraft(actor, {
      draft: {
        workspaceId: "workspace-1",
        title: "Plan-authored defect",
        description: "Created from a confirmed Router plan.",
        priority: "P1",
        receiverType: "agent",
        receiverId: "agent-1",
        receiverName: "Data Agent",
        acceptance: ["Defect is reproduced"],
        collaboratorHints: [],
      },
      creationKey: "router-plan-node-1",
      type: "缺陷",
      status: "progress",
      autoSubmitReview: false,
      autoApproveReview: true,
    });
    expect(tasks.get(result.taskId)).toMatchObject({
      type: "缺陷",
      status: "progress",
      autoSubmitReview: false,
      autoApproveReview: true,
    });
  });
});

describe("legacy task compatibility", () => {
  it("accepts canonical Principal receivers and keeps compatibility aliases", async () => {
    const table = memoryTable();
    const tasks = new TaskService(
      { tasks: table },
      {
        principals: () => ({
          resolveReference: (reference) => {
            if (reference === "principal:principal-ai-backend") {
              return {
                id: "principal-ai-backend",
                kind: "ai",
                status: "active",
              };
            }
            if (reference === "principal:principal-human-alice") {
              return {
                id: "principal-human-alice",
                kind: "human",
                status: "active",
              };
            }
            return undefined;
          },
          resolveSubject: (subjectType, subjectId) => {
            if (subjectType === "auth-user" && subjectId === "alice") {
              return {
                id: "principal-human-alice",
                kind: "human",
                status: "active",
              };
            }
            return undefined;
          },
          preferredSubjectId: (principalId) =>
            principalId === "principal-ai-backend"
              ? "teammate-backend"
              : principalId === "principal-human-alice"
                ? "alice"
                : undefined,
        }),
      },
    );

    const created = await tasks.create(actor, {
      workspaceId: "workspace-1",
      title: "Principal assignment",
      priority: "P2",
      receiverType: "agent",
      receiverId: "principal:principal-ai-backend",
      receiverName: "Backend AI",
      description: "Handle the implementation.",
      acceptance: ["Done"],
    });
    expect(created).toMatchObject({
      receiverType: "agent",
      receiverId: "teammate-backend",
      receiverPrincipalId: "principal-ai-backend",
    });
    expect(created.events.at(-1)?.actorPrincipalId).toBeUndefined();

    const reassigned = await tasks.assign(
      { id: "alice", name: "Alice", kind: "human" },
      {
        taskId: created.id,
        receiverType: "human",
        receiverId: "principal:principal-human-alice",
        receiverName: "Alice",
      },
    );
    expect(reassigned).toMatchObject({
      receiverType: "human",
      receiverId: "alice",
      receiverPrincipalId: "principal-human-alice",
    });
    expect(reassigned.events.at(-1)?.actorPrincipalId).toBe(
      "principal-human-alice",
    );
  });

  it("treats old human workflow tasks as auto-approved", async () => {
    const table = memoryTable();
    const tasks = new TaskService({ tasks: table });
    const { autoApproveReview: _ignored, ...legacy } = storedTask({
      workflow: {
        instanceId: "wf-1",
        nodeId: "design",
        instanceTitle: "Delivery",
        nodeName: "Design",
        reviewRequired: true,
      },
    });
    await table.put(legacy.id, legacy as TaskRecord);

    expect(tasks.get(legacy.id).autoApproveReview).toBe(true);
    const submitted = await tasks.submit(actor, legacy.id);
    expect(submitted.status).toBe("done");
    expect(submitted.progress).toBe(100);
  });

  it("keeps explicit opt-out and approval tasks on manual review", async () => {
    const table = memoryTable();
    const tasks = new TaskService({ tasks: table });
    const optOut = storedTask({
      id: "TSK-opt-out",
      autoApproveReview: false,
      workflow: {
        instanceId: "wf-2",
        nodeId: "design",
        instanceTitle: "Delivery",
        nodeName: "Design",
        reviewRequired: true,
      },
    });
    const approval = storedTask({
      id: "TSK-approval",
      receiverId: "manager",
      workflow: {
        instanceId: "wf-3",
        nodeId: "approval",
        instanceTitle: "Delivery",
        nodeName: "Approval",
        approvalPolicy: "all",
        reviewRequired: false,
      },
    });
    await table.put(optOut.id, optOut as TaskRecord);
    await table.put(approval.id, approval as TaskRecord);

    expect(tasks.get(optOut.id).autoApproveReview).toBe(false);
    expect(tasks.get(approval.id).autoApproveReview).toBe(false);
  });

  it("syncs approvers only on approval tasks and skips unchanged writes", async () => {
    const table = memoryTable();
    const tasks = new TaskService({ tasks: table });
    const approval = storedTask({
      id: "TSK-sync-approval",
      receiverId: "manager",
      status: "review",
      workflow: {
        instanceId: "wf-4",
        nodeId: "approval",
        instanceTitle: "Delivery",
        nodeName: "Approval",
        approvalPolicy: "all",
        reviewRequired: false,
      },
    });
    const delivery = storedTask({
      id: "TSK-sync-delivery",
      workflow: {
        instanceId: "wf-5",
        nodeId: "delivery",
        instanceTitle: "Delivery",
        nodeName: "Delivery",
        reviewRequired: true,
      },
    });
    await table.put(approval.id, approval);
    await table.put(delivery.id, delivery);
    const system = { id: "workflow", name: "工作流", kind: "system" } as const;

    const synced = await tasks.projectApprovalApprovers(system, {
      taskId: approval.id,
      approverIds: ["admin", "manager", "admin", ""],
    });
    expect(synced.workflow?.approverIds).toEqual(["admin", "manager"]);
    expect(synced.events.at(-1)?.message).toBe("工作流同步审批人");

    const unchanged = await tasks.projectApprovalApprovers(system, {
      taskId: approval.id,
      approverIds: ["admin", "manager"],
    });
    expect(unchanged.id).toBe(approval.id);
    expect(unchanged.events).toStrictEqual(synced.events);

    await expect(
      tasks.projectApprovalApprovers(system, {
        taskId: delivery.id,
        approverIds: ["admin"],
      }),
    ).rejects.toMatchObject({ code: "conflict" });
  });
});

describe("project role removal", () => {
  it("marks active role tasks as needing reassignment", async () => {
    const table = memoryTable();
    const tasks = new TaskService({ tasks: table });
    const open = storedTask({
      id: "TSK-role-open",
      status: "progress",
      receiverType: "role",
      receiverId: "role-reviewer",
      receiverName: "评审组",
    });
    const done = storedTask({
      id: "TSK-role-done",
      status: "done",
      receiverType: "role",
      receiverId: "role-reviewer",
      receiverName: "评审组",
    });
    await table.put(open.id, open);
    await table.put(done.id, done);

    const marked = await tasks.markRoleUnavailable(
      "workspace-1",
      new Map([["role-reviewer", "评审组"]]),
    );
    expect(marked).toBe(1);
    const updated = tasks.get(open.id);
    expect(updated).toMatchObject({
      receiverType: "unassigned",
      receiverState: "needs_reassignment",
      reassignmentReason: "项目角色「评审组」已下线",
      previousReceiver: {
        type: "role",
        id: "role-reviewer",
        name: "评审组",
      },
    });
    expect(updated.receiverId).toBeUndefined();
    expect(updated.receiverName).toBeUndefined();
    expect(updated.events.at(-1)?.message).toContain("需改派");
    // 已完成任务保留历史角色快照。
    expect(tasks.get(done.id).receiverState).toBe("active");
    expect(tasks.get(done.id).receiverId).toBe("role-reviewer");

    // 重新指派会清除“需改派”标记。
    const assigned = await tasks.assign(actor, {
      taskId: open.id,
      receiverType: "human",
      receiverId: "flow-member",
      receiverName: "Flow Member",
    });
    expect(assigned.receiverState).toBe("active");
    expect(assigned.reassignmentReason).toBeUndefined();
    expect(assigned.receiverType).toBe("human");
    expect(assigned.receiverId).toBe("flow-member");
  });
});

describe("task hierarchy", () => {
  it("creates child tasks with a parent reference", async () => {
    const tasks = new TaskService({ tasks: memoryTable() });
    const parent = await tasks.create(actor, {
      workspaceId: "workspace-1",
      title: "主任务",
      priority: "P1",
      receiverType: "human",
      receiverId: "admin",
      receiverName: "Admin",
      description: "负责最终交付。",
      acceptance: ["最终结果通过验收"],
    });
    const child = await tasks.create(actor, {
      workspaceId: "workspace-1",
      parentTaskId: parent.id,
      title: "子任务",
      priority: "P2",
      receiverType: "human",
      receiverId: "admin",
      receiverName: "Admin",
      description: "完成局部工作。",
      acceptance: ["局部结果完成"],
    });

    expect(tasks.get(child.id).parentTaskId).toBe(parent.id);
    await expect(
      tasks.create(actor, {
        workspaceId: "workspace-1",
        parentTaskId: child.id,
        title: "三级任务",
        priority: "P2",
        receiverType: "human",
        receiverId: "admin",
        receiverName: "Admin",
        description: "子任务不能继续关联子任务。",
        acceptance: ["不应创建"],
      }),
    ).rejects.toMatchObject({ code: "invalid_input" });
  });

  it("unlinks an archived child task without changing its status", async () => {
    const tasks = new TaskService({ tasks: memoryTable() });
    const parent = await tasks.create(actor, {
      workspaceId: "workspace-1",
      title: "主任务",
      priority: "P1",
      receiverType: "human",
      receiverId: "admin",
      receiverName: "Admin",
      description: "负责最终交付。",
      acceptance: ["最终结果通过验收"],
    });
    const child = await tasks.create(actor, {
      workspaceId: "workspace-1",
      title: "待关联任务",
      priority: "P2",
      receiverType: "human",
      receiverId: "admin",
      receiverName: "Admin",
      description: "先独立创建，再关联主任务。",
      acceptance: ["局部结果完成"],
    });
    await tasks.changeStatus(actor, { taskId: child.id, status: "progress" });

    const linked = await tasks.setChildRelation(actor, {
      action: "link",
      parentTaskId: parent.id,
      childTaskId: child.id,
    });
    expect(linked).toMatchObject({
      parentTaskId: parent.id,
      status: "progress",
    });
    const archived = await tasks.archive(actor, child.id);
    expect(archived.archivedAt).toBeDefined();

    const unlinked = await tasks.setChildRelation(actor, {
      action: "unlink",
      parentTaskId: parent.id,
      childTaskId: child.id,
    });
    expect(unlinked.parentTaskId).toBeUndefined();
    expect(unlinked.status).toBe("progress");
    expect(unlinked.archivedAt).toBe(archived.archivedAt);
  });
});

describe("assignee project membership", () => {
  const memberDirectory = {
    humans: [{ id: "admin" }],
    agents: [{ id: "tm-member", employeeId: "employee-member" }],
    roles: [{ id: "role-member" }],
  };

  it("rejects creating a task with a receiver outside the project", async () => {
    const tasks = new TaskService(
      { tasks: memoryTable() },
      { memberDirectory: () => memberDirectory },
    );
    await expect(
      tasks.create(actor, {
        workspaceId: "workspace-1",
        title: "跨项目负责人",
        priority: "P2",
        receiverType: "agent",
        receiverId: "tm-other-project",
        receiverName: "其他项目伙伴",
        description: "不应创建。",
        acceptance: ["拒绝跨项目负责人"],
      }),
    ).rejects.toMatchObject({
      code: "invalid_input",
      message: "任务负责人必须是当前项目成员",
    });
  });

  it("accepts project members and rejects cross-project reassignment", async () => {
    const tasks = new TaskService(
      { tasks: memoryTable() },
      { memberDirectory: () => memberDirectory },
    );
    const created = await tasks.create(actor, {
      workspaceId: "workspace-1",
      title: "项目成员任务",
      priority: "P2",
      receiverType: "human",
      receiverId: "admin",
      receiverName: "Admin",
      description: "创建时负责人是项目成员。",
      acceptance: ["可以创建"],
    });
    const assigned = await tasks.assign(actor, {
      taskId: created.id,
      receiverType: "agent",
      receiverId: "employee-member",
      receiverName: "项目伙伴",
    });
    expect(assigned.receiverId).toBe("employee-member");
    await expect(
      tasks.assign(actor, {
        taskId: created.id,
        receiverType: "human",
        receiverId: "outsider",
        receiverName: "外部成员",
      }),
    ).rejects.toMatchObject({
      code: "invalid_input",
      message: "任务负责人必须是当前项目成员",
    });
  });
});

describe("task queue activity copy", () => {
  it("uses a concise pause message when pausing execution", async () => {
    const tasks = new TaskService({ tasks: memoryTable() });
    const task = await tasks.create(actor, {
      workspaceId: "workspace-1",
      title: "暂停执行文案",
      priority: "P2",
      receiverType: "human",
      receiverId: "admin",
      receiverName: "Admin",
      description: "验证队列事件文案。",
      acceptance: ["文案正确"],
    });
    await tasks.attachAgentRun(
      task.id,
      {
        id: "run-paused-copy",
        instanceId: task.id,
        status: "running",
      },
      "测试 Agent",
    );
    const paused = await tasks.updateQueueItem(actor, {
      taskId: task.id,
      queueState: "paused",
    });
    expect(paused.queueState).toBe("paused");
    expect(paused.events.at(-1)?.message).toBe("Admin 暂停执行");
    expect(paused.messages.at(-1)).toMatchObject({
      runId: "run-paused-copy",
      state: "cancelled",
      content: "执行已暂停。",
    });
  });
});
