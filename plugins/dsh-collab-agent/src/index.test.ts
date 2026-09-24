import { describe, expect, it, vi } from "vitest";
import {
  AgentRegistryService,
  AgentTaskRuntime,
  createAgentRoutes,
  deliveryReportIssues,
  type AgentActor,
  type AgentProfile,
  type AgentRun,
  type AgentSessionsLike,
  type AgentSessionTitleLike,
  type AgentWorkflowHandler,
  type AgentsRegistryLike,
  type SubagentsRuntimeLike,
  type WebRouteLike,
  type WorkspaceRegistryLike,
} from "./index.js";

class FakeTable<V> {
  readonly records = new Map<string, V>();
  get(key: string): V | undefined {
    return this.records.get(key);
  }
  entries(): IterableIterator<[string, V]> {
    return this.records.entries();
  }
  keys(): IterableIterator<string> {
    return this.records.keys();
  }
  get size(): number {
    return this.records.size;
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
    profiles: new FakeTable<AgentProfile>(),
    runs: new FakeTable<AgentRun>(),
  };
}

const owner: AgentActor = {
  kind: "user",
  id: "ws-owner",
  workspaceRole: "owner",
};
const admin: AgentActor = { kind: "user", id: "root", globalRole: "admin" };
const member: AgentActor = {
  kind: "user",
  id: "ws-member",
  workspaceRole: "member",
};

interface FakeSubagentRun {
  readonly spec: {
    label?: string;
    prompt: ReadonlyArray<{ type: "text"; text: string }>;
    signal: AbortSignal;
    persona?: string;
    toolFilter?: { allow: readonly string[] };
  };
  outcome?: {
    output?: ReadonlyArray<unknown>;
    stopReason: string;
    diagnostic?: string;
  };
  resolve(): void;
}

function fakeSubagents() {
  const runs: FakeSubagentRun[] = [];
  const runtime: SubagentsRuntimeLike = {
    async start(_name, spec) {
      const run: FakeSubagentRun = {
        spec,
        resolve: () => undefined,
      };
      const promise = new Promise((resolve) => {
        run.resolve = () => resolve(undefined);
      });
      runs.push(run);
      return {
        id: `sub-${runs.length}`,
        result: promise.then(
          () => run.outcome ?? { output: [], stopReason: "completed" },
        ),
        dispose: async () => undefined,
      };
    },
  };
  return { runs, runtime };
}

function fakeAgents() {
  return {
    create: async ({ sessionId }: { sessionId: string }) => {
      const events: Array<{ type: string; data?: unknown }> = [];
      return {
        agent: {
          session: {
            id: sessionId,
            snapshotEvents: () => events,
          },
          followup: () => {
            events.push({
              type: "assistant/message",
              data: {
                message: {
                  content: [{ type: "text", text: "home session response" }],
                },
              },
            });
          },
          whenIdle: async () => undefined,
          cancel: () => undefined,
        },
        dispose: async () => undefined,
      };
    },
  };
}

function dispatchInput(overrides: Record<string, unknown> = {}) {
  return {
    workspaceId: "main",
    profileId: "backend-agent",
    source: "workflow" as const,
    instanceId: "inst-1",
    nodeId: "development",
    dispatchKey: "main:inst-1:development:a1:t0#1",
    trigger: "manual-dispatch" as const,
    attempt: 1,
    runSeq: 1,
    maxAttempts: 2,
    timeoutMs: 1_800_000,
    payload: {
      instanceTitle: "订单导出",
      nodeName: "开发",
      nodeDescription: "",
      profileName: "Backend Agent",
      deliverables: [
        {
          key: "report",
          title: "实现说明",
          type: "text" as const,
          required: true,
          description: "",
          minTextLength: 10,
        },
      ],
      context: {},
    },
    createdBy: "ws-owner",
    ...overrides,
  };
}

interface Harness {
  service: AgentRegistryService;
  runtime: AgentTaskRuntime;
  subagents: ReturnType<typeof fakeSubagents>;
  settled: AgentRun[];
}

function harness(
  options: {
    now?: () => Date;
    workspaces?: WorkspaceRegistryLike;
    sessions?: AgentSessionsLike;
    sessionTitle?: AgentSessionTitleLike;
    agents?: () => AgentsRegistryLike;
  } = {},
): Harness {
  const current = tables();
  const service = new AgentRegistryService(current, options);
  const subagents = fakeSubagents();
  const settled: AgentRun[] = [];
  const runtime = new AgentTaskRuntime({
    tables: current,
    subagents: () => subagents.runtime,
    agents: options.agents ?? fakeAgents,
    ...(options.workspaces === undefined
      ? {}
      : { workspaces: () => options.workspaces }),
    ...(options.sessions === undefined
      ? {}
      : { sessions: () => options.sessions }),
    ...(options.sessionTitle === undefined
      ? {}
      : { sessionTitle: () => options.sessionTitle }),
    onSettled: (run) => {
      settled.push(run);
      return service.onRuntimeSettled(run);
    },
    ...(options.now === undefined ? {} : { now: options.now }),
  });
  service.attachRuntime(runtime);
  return { service, runtime, subagents, settled };
}

const now = () => new Date("2026-09-12T00:00:00.000Z");

async function createProfile(
  service: AgentRegistryService,
  overrides: Record<string, unknown> = {},
): Promise<AgentProfile> {
  return service.createProfile(owner, {
    workspaceId: "main",
    id: "backend-agent",
    name: "Backend Agent",
    ...overrides,
  });
}

describe("agent profile registry", () => {
  it("creates and updates profiles with permission checks", async () => {
    const { service } = harness();
    expect(() =>
      service.createProfile(member, {
        workspaceId: "main",
        id: "backend-agent",
        name: "Backend Agent",
      }),
    ).toThrow("workspace owner or admin is required");
    const profile = await createProfile(service);
    expect(profile.runtimeKind).toBe("task-worker");
    expect(profile.allowedTools).toEqual([]);
    await expect(
      createProfile(service, { id: "backend-agent", name: "Other" }),
    ).rejects.toThrow("already exists");
    const disabled = await service.updateProfile(admin, {
      workspaceId: "main",
      profileId: "backend-agent",
      status: "disabled",
    });
    expect(disabled.status).toBe("disabled");
  });

  it("rejects cross-workspace profile access", async () => {
    const { service } = harness();
    await createProfile(service);
    expect(service.profile("other", "backend-agent")).toBeUndefined();
    expect(service.profiles("other")).toEqual([]);
  });
});

describe("agent task runtime", () => {
  it("delivers task runs to the task handler with a task-specific prompt", async () => {
    const { service, runtime, subagents } = harness({ now });
    const settled: AgentRun[] = [];
    service.bindTask({
      onSettled: (run) => {
        settled.push(run);
      },
    });
    await createProfile(service);
    const run = await service.dispatch(
      dispatchInput({
        source: "task",
        instanceId: "TSK-1",
        nodeId: "task",
        dispatchKey: "task:TSK-1:1",
        payload: {
          instanceTitle: "处理客户反馈",
          nodeName: "任务执行",
          nodeDescription: "整理风险，并给出下一步建议。",
          profileName: "Backend Agent",
          deliverables: [],
          context: { taskId: "TSK-1" },
        },
      }),
    );
    await vi.waitFor(() => expect(subagents.runs.length).toBe(1));
    expect(subagents.runs[0]!.spec.prompt[0]!.text).toContain(
      "整理风险，并给出下一步建议。",
    );
    subagents.runs[0]!.outcome = {
      output: [{ type: "text", text: "已整理风险，并给出下一步建议。" }],
      stopReason: "completed",
    };
    subagents.runs[0]!.resolve();
    await runtime.waitIdle();
    await vi.waitFor(() => expect(settled).toHaveLength(1));
    expect(settled[0]).toMatchObject({
      id: run.id,
      source: "task",
      instanceId: "TSK-1",
      status: "succeeded",
    });
    expect(service.run(run.id)!.settleDelivered).toBe(true);
  });

  it("attaches live task-worker sessions to the target workspace", async () => {
    const attached: string[] = [];
    const renamed: Array<{ id: string; title: string }> = [];
    const workspaces: WorkspaceRegistryLike = {
      create: async (path) => ({
        path,
        attachSession: async (sessionId) => {
          attached.push(sessionId);
        },
      }),
    };
    const sessions: AgentSessionsLike = {
      get: (sessionId) => ({
        id: sessionId,
        snapshotEvents: () => [],
      }),
    };
    const sessionTitle: AgentSessionTitleLike = {
      rename: (session, title) => {
        renamed.push({ id: session.id, title });
      },
    };
    const { service, runtime, subagents } = harness({
      now,
      workspaces,
      sessions,
      sessionTitle,
    });
    await createProfile(service);
    const run = await service.dispatch(
      dispatchInput({
        source: "task",
        employeeId: "pluginmax-de",
        workspacePath: "/tmp/pluginmax-workspace",
        instanceId: "TSK-2",
        nodeId: "task",
        dispatchKey: "task:TSK-2:1",
      }),
    );
    const sessionId = "de-task-TSK-2-pluginmax-de";
    await vi.waitFor(() => expect(attached).toEqual([sessionId]));
    expect(subagents.runs).toHaveLength(0);
    expect(service.run(run.id)?.sessionId).toBe(sessionId);
    expect(renamed).toEqual([
      {
        id: sessionId,
        title: "TSK-订单导出-2-BackendAgent",
      },
    ]);
    await runtime.waitIdle();
    expect(service.run(run.id)?.output?.summary).toBe("home session response");
  });

  it("gives every task its own session for the same DE", async () => {
    const attached: string[] = [];
    const renamed: Array<{ id: string; title: string }> = [];
    const workspaces: WorkspaceRegistryLike = {
      create: async (path) => ({
        path,
        attachSession: async (sessionId) => {
          attached.push(sessionId);
        },
      }),
    };
    const sessions: AgentSessionsLike = {
      get: (sessionId) => ({
        id: sessionId,
        snapshotEvents: () => [],
      }),
    };
    const sessionTitle: AgentSessionTitleLike = {
      rename: (session, title) => {
        renamed.push({ id: session.id, title });
      },
    };
    const { service, runtime, subagents } = harness({
      now,
      workspaces,
      sessions,
      sessionTitle,
    });
    await createProfile(service);
    const first = await service.dispatch(
      dispatchInput({
        source: "task",
        employeeId: "pluginmax-de",
        workspacePath: "/tmp/pluginmax-workspace",
        instanceId: "TSK-A",
        nodeId: "task",
        dispatchKey: "task:TSK-A:1",
      }),
    );
    const second = await service.dispatch(
      dispatchInput({
        source: "task",
        employeeId: "pluginmax-de",
        workspacePath: "/tmp/pluginmax-workspace",
        instanceId: "TSK-B",
        nodeId: "task",
        dispatchKey: "task:TSK-B:1",
      }),
    );
    await runtime.waitIdle();
    await vi.waitFor(() => expect(attached).toHaveLength(2));
    const firstSession = service.run(first.id)?.sessionId;
    const secondSession = service.run(second.id)?.sessionId;
    expect(firstSession).toBe("de-task-TSK-A-pluginmax-de");
    expect(secondSession).toBe("de-task-TSK-B-pluginmax-de");
    expect(firstSession).not.toBe(secondSession);
    expect(subagents.runs).toHaveLength(0);
    expect(renamed.map((item) => item.title).sort()).toEqual([
      "TSK-订单导出-A-BackendAgent",
      "TSK-订单导出-B-BackendAgent",
    ]);
  });

  it("routes follow-up instructions to the session of their own task", async () => {
    const attached: string[] = [];
    const workspaces: WorkspaceRegistryLike = {
      create: async (path) => ({
        path,
        attachSession: async (sessionId) => {
          attached.push(sessionId);
        },
      }),
    };
    const sessions: AgentSessionsLike = {
      get: (sessionId) => ({
        id: sessionId,
        snapshotEvents: () => [],
      }),
    };
    const { service, runtime } = harness({
      now,
      workspaces,
      sessions,
      sessionTitle: { rename: () => undefined },
    });
    await createProfile(service);
    const dispatchFor = (taskId: string, runSeq: number) =>
      service.dispatch(
        dispatchInput({
          source: "task",
          employeeId: "pluginmax-de",
          workspacePath: "/tmp/pluginmax-workspace",
          instanceId: taskId,
          nodeId: "task",
          attempt: 1,
          runSeq,
          maxAttempts: 1,
          dispatchKey: `task:${taskId}:${String(runSeq)}`,
        }),
      );
    const taskAFirst = await dispatchFor("TSK-A", 1);
    const taskASecond = await dispatchFor("TSK-A", 2);
    const taskBFirst = await dispatchFor("TSK-B", 1);
    await runtime.waitIdle();
    await vi.waitFor(() => expect(attached).toHaveLength(3));
    const sessionsOf = [taskAFirst, taskASecond, taskBFirst].map(
      (run) => service.run(run.id)?.sessionId,
    );
    expect(sessionsOf[0]).toBe("de-task-TSK-A-pluginmax-de");
    expect(sessionsOf[1]).toBe("de-task-TSK-A-pluginmax-de");
    expect(sessionsOf[2]).toBe("de-task-TSK-B-pluginmax-de");
    expect(new Set(sessionsOf).size).toBe(2);
  });

  it("reuses the live handle when the session is already owned", async () => {
    const events: Array<{ type: string; data?: unknown }> = [];
    const liveAgent = {
      session: { id: "session", snapshotEvents: () => events },
      followup: () => {
        events.push({
          type: "assistant/message",
          data: {
            message: {
              content: [{ type: "text", text: "adopted response" }],
            },
          },
        });
      },
      whenIdle: async () => undefined,
      cancel: () => undefined,
    };
    let lookups = 0;
    const agents: AgentsRegistryLike = {
      get: () => {
        lookups += 1;
        return lookups >= 2 ? liveAgent : undefined;
      },
      create: async () => {
        throw new Error(
          'session "de-task-TSK-C-pluginmax-de" is already owned by an active write handle',
        );
      },
    };
    const { service, runtime } = harness({
      now,
      agents: () => agents,
      workspaces: {
        create: async (path) => ({
          path,
          attachSession: async () => undefined,
        }),
      },
      sessions: {
        get: (sessionId) => ({ id: sessionId, snapshotEvents: () => [] }),
      },
      sessionTitle: { rename: () => undefined },
    });
    await createProfile(service);
    const run = await service.dispatch(
      dispatchInput({
        source: "task",
        employeeId: "pluginmax-de",
        workspacePath: "/tmp/pluginmax-workspace",
        instanceId: "TSK-C",
        nodeId: "task",
        dispatchKey: "task:TSK-C:1",
      }),
    );
    await runtime.waitIdle();
    await vi.waitFor(() =>
      expect(service.run(run.id)?.output?.summary).toBe("adopted response"),
    );
    expect(service.run(run.id)?.status).toBe("succeeded");
  });

  it("starts a fresh session after the task session is reset", async () => {
    const attached: string[] = [];
    const workspaces: WorkspaceRegistryLike = {
      create: async (path) => ({
        path,
        attachSession: async (sessionId) => {
          attached.push(sessionId);
        },
      }),
    };
    const sessions: AgentSessionsLike = {
      get: (sessionId) => ({ id: sessionId, snapshotEvents: () => [] }),
    };
    const { service, runtime } = harness({
      now,
      workspaces,
      sessions,
      sessionTitle: { rename: () => undefined },
    });
    await createProfile(service);
    const base = dispatchInput({
      source: "task",
      employeeId: "pluginmax-de",
      workspacePath: "/tmp/pluginmax-workspace",
      instanceId: "TSK-R",
      nodeId: "task",
      dispatchKey: "task:TSK-R:1",
    });
    const first = await service.dispatch(base);
    const second = await service.dispatch({
      ...base,
      runSeq: 2,
      dispatchKey: "task:TSK-R:2",
      payload: { ...base.payload, context: { taskSessionEpoch: "1" } },
    });
    await runtime.waitIdle();
    await vi.waitFor(() => expect(attached).toHaveLength(2));
    expect(service.run(first.id)?.sessionId).toBe("de-task-TSK-R-pluginmax-de");
    expect(service.run(second.id)?.sessionId).toBe(
      "de-task-TSK-R-pluginmax-de-r1",
    );
  });

  it("names the task session as TSK-任务名称-任务号后4位-执行人", async () => {
    const renamed: Array<{ id: string; title: string }> = [];
    const workspaces: WorkspaceRegistryLike = {
      create: async (path) => ({
        path,
        attachSession: async () => undefined,
      }),
    };
    const sessions: AgentSessionsLike = {
      get: (sessionId) => ({ id: sessionId, snapshotEvents: () => [] }),
    };
    const { service, runtime } = harness({
      now,
      workspaces,
      sessions,
      sessionTitle: {
        rename: (session, title) => {
          renamed.push({ id: session.id, title });
        },
      },
    });
    await createProfile(service);
    const base = dispatchInput({
      source: "task",
      employeeId: "pluginmax-de",
      workspacePath: "/tmp/pluginmax-workspace",
      instanceId: "TSK-MUDUHMTX-0089",
      nodeId: "task",
      dispatchKey: "task:TSK-MUDUHMTX-0089:1",
    });
    await service.dispatch({
      ...base,
      payload: {
        ...base.payload,
        instanceTitle: "正在测试 05",
        context: { employeeName: "DE 测小白" },
      },
    });
    await runtime.waitIdle();
    await vi.waitFor(() => expect(renamed).toHaveLength(1));
    expect(renamed[0]?.title).toBe("TSK-正在测试05-0089-DE测小白");
  });

  it("is idempotent per dispatch key and records successful output", async () => {
    const { service, runtime, subagents, settled } = harness({ now });
    const handler: AgentWorkflowHandler = { onSettled: () => undefined };
    const onSettled = vi.spyOn(handler, "onSettled");
    service.bindWorkflow(handler);
    await createProfile(service);
    const first = await service.dispatch(
      dispatchInput({
        employeeId: "backend-01",
        principalType: "digital-employee",
        ticketId: "ticket-1",
      }),
    );
    const duplicate = await service.dispatch(dispatchInput());
    expect(duplicate.id).toBe(first.id);
    expect(first.status).toBe("queued");
    expect(first).toMatchObject({
      employeeId: "backend-01",
      principalType: "digital-employee",
      ticketId: "ticket-1",
    });
    await vi.waitFor(() => expect(subagents.runs.length).toBe(1));
    expect(subagents.runs[0]!.spec.prompt[0]!.text).toContain("Task Worker");
    expect(subagents.runs[0]!.spec.prompt[0]!.text).toContain("# 交付报告");
    expect(subagents.runs[0]!.spec.prompt[0]!.text).toContain(
      "不要先输出计划、推理、检查步骤或工具调用",
    );
    expect(subagents.runs[0]!.spec.prompt[0]!.text).toContain(
      "本任务没有可用工具",
    );
    subagents.runs[0]!.outcome = {
      output: [
        {
          type: "text",
          text: "# 交付报告\n\n## 交付说明\n\n这是实现说明的正文内容，足够长。",
        },
      ],
      stopReason: "completed",
    };
    subagents.runs[0]!.resolve();
    await runtime.waitIdle();
    const saved = service.run(first.id)!;
    expect(saved.status).toBe("succeeded");
    expect(saved.output?.summary).toContain("实现说明");
    expect(saved.settleDelivered).toBe(true);
    expect(onSettled).toHaveBeenCalledTimes(1);
    expect(settled.map((run) => run.status)).toEqual(["succeeded"]);
  });

  it("marks failed workers and keeps settle pending until bound", async () => {
    const { service, runtime, subagents } = harness({ now });
    await createProfile(service);
    const run = await service.dispatch(dispatchInput());
    await vi.waitFor(() => expect(subagents.runs.length).toBe(1));
    subagents.runs[0]!.outcome = {
      output: [{ type: "text", text: "failed output" }],
      stopReason: "error",
      diagnostic: "model crashed",
    };
    subagents.runs[0]!.resolve();
    await runtime.waitIdle();
    const saved = service.run(run.id)!;
    expect(saved.status).toBe("failed");
    expect(saved.error).toContain("model crashed");
    expect(saved.settleDelivered).toBe(false);
    const handler: AgentWorkflowHandler = { onSettled: () => undefined };
    const onSettled = vi.spyOn(handler, "onSettled");
    service.bindWorkflow(handler);
    await vi.waitFor(() => expect(onSettled).toHaveBeenCalledTimes(1));
    expect(service.run(run.id)!.settleDelivered).toBe(true);
  });

  it("reports a clear failure when a completed worker omits text", async () => {
    const { service, runtime, subagents } = harness({ now });
    await createProfile(service);
    const run = await service.dispatch(dispatchInput());
    await vi.waitFor(() => expect(subagents.runs.length).toBe(1));
    subagents.runs[0]!.outcome = { output: [], stopReason: "completed" };
    subagents.runs[0]!.resolve();
    await runtime.waitIdle();
    const saved = service.run(run.id)!;
    expect(saved.status).toBe("failed");
    expect(saved.error).toBe("Agent 未返回可用的文本输出");
  });

  it("repairs one invalid delivery report and preserves the original output", async () => {
    const { service, runtime, subagents } = harness({ now });
    await createProfile(service);
    const run = await service.dispatch(dispatchInput());
    await vi.waitFor(() => expect(subagents.runs.length).toBe(1));
    subagents.runs[0]!.outcome = {
      output: [{ type: "text", text: "我完成了实现，但没有使用交付报告。" }],
      stopReason: "completed",
    };
    subagents.runs[0]!.resolve();
    await vi.waitFor(() => expect(subagents.runs.length).toBe(2));
    expect(subagents.runs[1]!.spec.prompt[0]!.text).toContain(
      "Task Worker 输出修复",
    );
    expect(subagents.runs[1]!.spec.prompt[0]!.text).toContain(
      "缺少一级标题「# 交付报告」",
    );
    subagents.runs[1]!.outcome = {
      output: [
        {
          type: "text",
          text: "# 交付报告\n\n## 交付说明\n\n修复后的实现说明，内容完整。",
        },
      ],
      stopReason: "completed",
    };
    subagents.runs[1]!.resolve();
    await runtime.waitIdle();
    const saved = service.run(run.id)!;
    expect(saved.status).toBe("succeeded");
    expect(saved.output?.summary).toContain("修复后的实现说明");
    expect(saved.output?.rawOutput).toContain("没有使用交付报告");
    expect(saved.output?.repairAttempt).toBe(1);
  });

  it("fails without an extra repair when the attempt budget is exhausted", async () => {
    const { service, runtime, subagents } = harness({ now });
    await createProfile(service);
    const run = await service.dispatch(
      dispatchInput({ runSeq: 2, maxAttempts: 2 }),
    );
    await vi.waitFor(() => expect(subagents.runs.length).toBe(1));
    subagents.runs[0]!.outcome = {
      output: [{ type: "text", text: "缺少契约标题的原始输出。" }],
      stopReason: "completed",
    };
    subagents.runs[0]!.resolve();
    await runtime.waitIdle();
    expect(subagents.runs).toHaveLength(1);
    const saved = service.run(run.id)!;
    expect(saved.status).toBe("failed");
    expect(saved.error).toContain("交付报告格式不合格");
    expect(saved.output?.rawOutput).toContain("缺少契约标题");
  });

  it("validates required delivery length before accepting the report", () => {
    const payload = dispatchInput().payload;
    expect(
      deliveryReportIssues("# 交付报告\n\n## 交付说明\n\n太短", payload),
    ).toContain("「交付说明」不足 10 字（当前 2 字）");
  });

  it("supports workflow-compatible filtering by instance id", async () => {
    const { service } = harness({ now });
    await createProfile(service);
    await service.dispatch(dispatchInput());
    await service.dispatch(
      dispatchInput({
        instanceId: "other-instance",
        nodeId: "review",
        dispatchKey: "other-key",
      }),
    );
    expect(service.runs("inst-1").map((run) => run.instanceId)).toEqual([
      "inst-1",
    ]);
  });

  it("cancels a running worker via abort", async () => {
    const { service, runtime, subagents } = harness({ now });
    await createProfile(service);
    const run = await service.dispatch(dispatchInput());
    await vi.waitFor(() => expect(subagents.runs.length).toBe(1));
    const cancelled = await service.cancel(run.id);
    expect(cancelled.status).toBe("cancelled");
    await runtime.waitIdle();
    expect(service.run(run.id)!.status).toBe("cancelled");
  });

  it("rejects cancellation after a worker reaches a terminal state", async () => {
    const { service, runtime, subagents } = harness({ now });
    await createProfile(service);
    const run = await service.dispatch(dispatchInput());
    await vi.waitFor(() => expect(subagents.runs.length).toBe(1));
    subagents.runs[0]!.outcome = {
      output: [
        {
          type: "text",
          text: "# 交付报告\n\n## 交付说明\n\n实现已经完成，并通过了本地回归验证。",
        },
      ],
      stopReason: "completed",
    };
    subagents.runs[0]!.resolve();
    await runtime.waitIdle();
    expect(service.run(run.id)!.status).toBe("succeeded");
    await expect(service.cancel(run.id)).rejects.toMatchObject({
      code: "conflict",
      message: "Agent 运行已完成，无法取消",
    });
  });

  it("delivers cancellation without waiting behind the caller's operation lock", async () => {
    const { service, subagents } = harness({ now });
    let releaseWorkflowLock: () => void = () => undefined;
    const workflowLock = new Promise<void>((resolve) => {
      releaseWorkflowLock = resolve;
    });
    const settled: AgentRun[] = [];
    service.bindWorkflow({
      onSettled: (run) => {
        settled.push(run);
        return workflowLock;
      },
    });
    await createProfile(service);
    const run = await service.dispatch(dispatchInput());
    await vi.waitFor(() => expect(subagents.runs.length).toBe(1));

    const cancellation = service.cancel(run.id);
    void cancellation.finally(() => releaseWorkflowLock());
    await cancellation;
    await vi.waitFor(() => expect(settled).toHaveLength(1));
    releaseWorkflowLock();
    await vi.waitFor(() =>
      expect(service.run(run.id)!.settleDelivered).toBe(true),
    );
  });

  it("times out stuck workers", async () => {
    vi.useFakeTimers();
    try {
      const { service, runtime, subagents } = harness({
        now,
      });
      await createProfile(service);
      const run = await service.dispatch(dispatchInput({ timeoutMs: 1_000 }));
      let started = false;
      for (let index = 0; index < 50 && !started; index += 1) {
        await vi.advanceTimersByTimeAsync(10);
        started = subagents.runs.length > 0;
      }
      expect(started).toBe(true);
      const settledPromise = runtime.waitIdle();
      await vi.advanceTimersByTimeAsync(1_500);
      await settledPromise;
      expect(service.run(run.id)!.status).toBe("timeout");
    } finally {
      vi.useRealTimers();
    }
  });

  it("restores queued runs and retires running runs after restart", async () => {
    const current = tables();
    const before = new AgentRegistryService(current, { now });
    const beforeRuntime = new AgentTaskRuntime({
      tables: current,
      subagents: () => fakeSubagents().runtime,
      agents: fakeAgents,
      now,
    });
    before.attachRuntime(beforeRuntime);
    await createProfile(before);
    await before.dispatch(dispatchInput({ dispatchKey: "k1", runSeq: 1 }));
    await before.dispatch(dispatchInput({ dispatchKey: "k2", runSeq: 2 }));
    // simulate crash: one queued, one running
    const [first, second] = [...current.runs.records.values()].sort(
      (left, right) => left.dispatchKey.localeCompare(right.dispatchKey),
    );
    await current.runs.put(first!.id, {
      ...first,
      status: "running",
    } as AgentRun);
    await current.runs.put(second!.id, {
      ...second,
      status: "running",
    } as AgentRun);
    await current.runs.put(second!.id, {
      ...second,
      status: "queued",
    } as AgentRun);
    const settled: AgentRun[] = [];
    const after = new AgentRegistryService(current, { now });
    const afterSubagents = fakeSubagents();
    const afterRuntime = new AgentTaskRuntime({
      tables: current,
      subagents: () => afterSubagents.runtime,
      agents: fakeAgents,
      onSettled: (run) => {
        settled.push(run);
        return after.onRuntimeSettled(run);
      },
      now,
    });
    after.attachRuntime(afterRuntime);
    after.restore();
    await vi.waitFor(() => expect(afterSubagents.runs.length).toBe(1));
    afterSubagents.runs[0]!.outcome = {
      output: [
        {
          type: "text",
          text: "# 交付报告\n\n## 交付说明\n\n重启后的重放输出完整有效。",
        },
      ],
      stopReason: "completed",
    };
    afterSubagents.runs[0]!.resolve();
    await vi.waitFor(() =>
      expect(
        [...current.runs.records.values()].every(
          (run) => ["queued", "running"].includes(run.status) === false,
        ),
      ).toBe(true),
    );
    const statuses = [...current.runs.records.values()].map(
      (run) => run.status,
    );
    expect(statuses).toContain("interrupted");
    expect(statuses).toContain("succeeded");
  });
});

describe("agent routes", () => {
  it("requires workspace membership for profile listing", async () => {
    const current = tables();
    const service = new AgentRegistryService(current, { now });
    const members = [{ userId: "ws-owner", memberRole: "owner" as const }];
    const routes = createAgentRoutes(service, () => ({
      resolveToken: (token) =>
        token === "owner"
          ? { userId: "ws-owner", role: "member" as const }
          : token === "stranger"
            ? { userId: "stranger", role: "member" as const }
            : undefined,
      members: () => members,
    }));
    const listRoute = routes.find(
      (route) => route.path === "/api/collab/agent/profiles",
    )!;
    const request = {
      method: "GET",
      url: "/api/collab/agent/profiles?workspaceId=main",
      headers: {
        host: "127.0.0.1:33117",
        origin: "http://127.0.0.1:33117",
        authorization: "Bearer stranger",
      },
    };
    const response = {
      status: 0,
      body: "",
      writeHead(status: number) {
        this.status = status;
        return this;
      },
      end(body?: string) {
        if (body !== undefined) this.body = body;
        return this;
      },
    };
    await listRoute.handler(
      request as unknown as Parameters<WebRouteLike["handler"]>[0],
      response as unknown as Parameters<WebRouteLike["handler"]>[1],
    );
    expect(response.status).toBe(403);
  });
});
