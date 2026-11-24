import { describe, expect, it } from "vitest";
import {
  planRecordSchema,
  type RouterAgentRegistration,
  type RouterCycle,
} from "./models.js";
import {
  RouterCycleService,
  type RouterAgentDispatchInput,
} from "./router-cycle.js";
import type { PlanActor, RouterWorkerTable } from "./service.js";

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

type TeammateRecord = {
  id: string;
  name: string;
  ownerUserId: string;
  state: string;
  templateId?: string | undefined;
  employeeId?: string | undefined;
  principalId?: string | undefined;
};

type Identity = {
  teammateId: string;
  workspaceId: string;
  profileId: string;
  employeeId?: string | undefined;
  principalId?: string | undefined;
  personaId?: string | undefined;
};

function setup(
  options: {
    readonly provisionRouter?: boolean | undefined;
    readonly missingPrincipal?: boolean | undefined;
  } = {},
) {
  const cycles = new Table<RouterCycle>();
  const routerAgents = new Table<RouterAgentRegistration>();
  const dispatches: RouterAgentDispatchInput[] = [];
  const cancelledRuns: string[] = [];
  const profileUpdates: Array<{
    workspaceId: string;
    profileId: string;
    allowedTools?: readonly string[] | undefined;
  }> = [];
  const runStatus = { value: "running" };
  const runError: { value: string | undefined } = { value: undefined };
  const templates = new Map([
    [
      "template-router",
      {
        id: "template-router",
        name: "Router Agent",
        source: "personal" as const,
        state: "active" as const,
        tools: [
          "read_file",
          "router_worker_submit_plan",
          "router_worker_submit_final_draft",
        ],
      },
    ],
    [
      "template-data",
      {
        id: "template-data",
        name: "Data Agent",
        source: "platform" as const,
        state: "active" as const,
        tools: ["read_file", "query_data"],
      },
    ],
  ]);
  const teammateRecords: TeammateRecord[] = [
    {
      id: "worker-research",
      name: "研究 Worker",
      ownerUserId: "alice",
      state: "active",
      templateId: "template-data",
    },
    {
      id: "worker-data",
      name: "Data Agent",
      ownerUserId: "alice",
      state: "active",
      templateId: "template-data",
    },
    {
      id: "router-software",
      name: "软件研发 Router",
      ownerUserId: "alice",
      state: "active",
      templateId: "template-router",
      employeeId: "employee-router-software",
      principalId: "principal-router-software",
    },
  ];
  const identities = new Map<string, Identity>([
    [
      "worker-research",
      {
        teammateId: "worker-research",
        workspaceId: "workspace-1",
        profileId: "worker-research",
        principalId: "principal-worker-research",
      },
    ],
    [
      "worker-data",
      {
        teammateId: "worker-data",
        workspaceId: "workspace-1",
        profileId: "worker-data",
        principalId: "principal-worker-data",
      },
    ],
    [
      "router-software",
      {
        teammateId: "router-software",
        workspaceId: "workspace-1",
        profileId: "agent-router-workspace-1-secondary",
        employeeId: "employee-router-software",
        principalId: "principal-router-software",
      },
    ],
  ]);
  if (options.provisionRouter !== false) {
    teammateRecords.unshift({
      id: "router-general",
      name: "通用任务 Router",
      ownerUserId: "alice",
      state: "active",
      templateId: "template-router",
      employeeId: "employee-router",
      principalId: "principal-router",
    });
    identities.set("router-general", {
      teammateId: "router-general",
      workspaceId: "workspace-1",
      profileId: "agent-router-workspace-1",
      employeeId: "employee-router",
      principalId: "principal-router",
      personaId: "persona-router",
    });
  }

  const teammateService = {
    list: () => teammateRecords,
    create: async (
      _actor: {
        userId: string;
        name: string;
        role: "admin" | "owner" | "member" | "guest";
      },
      input: { templateId: string; name?: string | undefined },
    ) => {
      const teammate: TeammateRecord = {
        id: "router-created",
        name: input.name ?? "Router Agent",
        ownerUserId: "alice",
        state: "active",
        templateId: input.templateId,
        employeeId: "employee-router-created",
        principalId: "principal-router-created",
      };
      teammateRecords.push(teammate);
      identities.set(teammate.id, {
        teammateId: teammate.id,
        workspaceId: "workspace-1",
        profileId: "agent-router-created",
        employeeId: "employee-router-created",
        principalId: "principal-router-created",
      });
      return teammate;
    },
  };
  const teammateRuntime = {
    list: () => teammateRecords,
    assignable: () =>
      teammateRecords
        .filter((teammate) => teammate.state === "active")
        .map((teammate) => ({
          id: teammate.id,
          name: teammate.name,
          ownerName: "Alice",
          execution: "builtin" as const,
        })),
    ensureRuntime: async ({
      teammateId,
    }: {
      teammateId: string;
      workspaceId: string;
      actor: {
        userId: string;
        name: string;
        role: "admin" | "owner" | "member" | "guest";
      };
      workspaceRole?: "owner" | "member" | "guest" | undefined;
      employee?: unknown;
    }) => {
      const identity = identities.get(teammateId);
      if (identity === undefined) {
        throw new Error("teammate runtime missing");
      }
      return {
        ...identity,
        ...(options.missingPrincipal ? { principalId: undefined } : {}),
      };
    },
  };

  const service = new RouterCycleService(cycles, routerAgents, {
    team: {
      members: () => [
        { userId: "alice", memberRole: "member" },
        { userId: "bob", memberRole: "member" },
      ],
      users: () => [
        { id: "alice", name: "Alice" },
        { id: "bob", name: "Bob" },
      ],
    },
    tasks: () => ({
      get: (taskId) => ({
        id: taskId,
        workspaceId: "workspace-1",
        title: "复杂交付任务",
        description: "完成产品方案、技术设计和验收材料。",
        acceptance: ["方案完整", "风险清晰"],
        priority: "P2",
        receiverType: "human",
        receiverId: "alice",
        receiverName: "Alice",
        createdBy: "alice",
      }),
    }),
    agent: () => ({
      dispatch: async (input) => {
        dispatches.push(input);
        return {
          id: "run-router-1",
          status: "queued",
          sessionId: "session-router-1",
        };
      },
      run: () => ({
        id: "run-router-1",
        status: runStatus.value,
        ...(runError.value === undefined ? {} : { error: runError.value }),
      }),
      cancel: async (runId: string) => {
        cancelledRuns.push(runId);
        runStatus.value = "cancelled";
        return { id: runId, status: "cancelled" };
      },
      updateRuntimeProfile: async (
        _actor,
        input: {
          workspaceId: string;
          profileId: string;
          allowedTools?: readonly string[] | undefined;
        },
      ) => {
        profileUpdates.push(input);
        return { id: input.profileId };
      },
      profile: (workspaceId, profileId) => {
        const identity = [...identities.values()].find(
          (candidate) =>
            candidate.workspaceId === workspaceId &&
            candidate.profileId === profileId,
        );
        if (identity === undefined) return undefined;
        return {
          id: profileId,
          name:
            teammateRecords.find(
              (candidate) => candidate.id === identity.teammateId,
            )?.name ?? "Agent",
          description: "Agent profile",
          ownerUserId: "alice",
          execution: "builtin",
          status: "active",
        };
      },
    }),
    teammates: () => teammateRuntime,
    teammateService: () => teammateService,
    teammateTemplates: () => ({
      get: (templateId: string) => templates.get(templateId),
      findOrCreate: async (
        _actor: {
          userId: string;
          name: string;
          role: "admin" | "owner" | "member" | "guest";
        },
        input: {
          source: "personal" | "platform";
          name: string;
          role?: string;
          description?: string;
          soul?: string;
          scenarios?: readonly string[];
          goals?: readonly string[];
          tools?: readonly string[];
          active?: boolean;
        },
      ) => {
        const existing = templates.get("template-router");
        if (existing !== undefined) return existing;
        const created = {
          id: "template-router",
          name: input.name,
          source: input.source,
          state: "active" as const,
          tools: [...(input.tools ?? [])],
        };
        templates.set(created.id, created);
        return created;
      },
    }),
    principalRuntime: () => ({
      profile: () => ({ id: "principal-router" }),
      issueTicket: async () => ({ id: "ticket-router" }),
    }),
    workspaces: () => ({
      get: () => ({ path: "/workspace" }),
    }),
    enabled: () => true,
    defaultRouterAgentId: () =>
      options.provisionRouter === false
        ? undefined
        : "agent-router-workspace-1",
  });
  return {
    service,
    cycles,
    routerAgents,
    dispatches,
    cancelledRuns,
    profileUpdates,
    runStatus,
    runError,
    teammateRecords,
  };
}

describe("Router cycle service", () => {
  it("provisions a Router teammate with a Principal before the first dispatch", async () => {
    const { service, dispatches, profileUpdates, teammateRecords } = setup({
      provisionRouter: false,
    });

    const cycle = await service.start({
      actor,
      rootTaskId: "TSK-1",
      planner: "plan",
      trigger: "manual",
    });

    expect(teammateRecords).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "router-created",
          name: "通用任务 Router",
          templateId: "template-router",
        }),
      ]),
    );
    expect(cycle.routerAgentId).toBe("router-created");
    expect(dispatches).toHaveLength(1);
    expect(dispatches[0]).toMatchObject({
      profileId: "agent-router-created",
      principalId: "principal-router-created",
      employeeId: "employee-router-created",
      source: "task",
      instanceId: "TSK-1",
      nodeId: "router-plan",
      payload: {
        context: {
          taskReceiverId: "router-created",
          principalId: "principal-router-created",
          taskRunRole: "fyi",
          routerCycleKind: "plan",
        },
      },
    });
    expect(String(dispatches[0]?.payload.context.instruction)).toContain(
      "router_worker_submit_plan",
    );
    expect(String(dispatches[0]?.payload.context.instruction)).toContain(
      "Data Agent",
    );
    expect(String(dispatches[0]?.payload.context.instruction)).not.toContain(
      "软件研发 Router",
    );
    expect(profileUpdates.at(-1)?.allowedTools).toEqual([
      "read_file",
      "router_worker_submit_plan",
      "router_worker_submit_final_draft",
    ]);
  });

  it("lists only Router-type teammates", async () => {
    const { service } = setup();

    const candidates = await service.candidateRouterAgents(
      actor,
      "workspace-1",
    );

    expect(candidates).toEqual([
      {
        id: "router-general",
        name: "通用任务 Router",
        ownerUserId: "alice",
        agentType: "router",
        teammateId: "router-general",
        domain: "general",
        execution: "builtin",
        isDefault: true,
      },
    ]);
    expect(
      candidates.some(
        (candidate) =>
          candidate.id === "worker-data" ||
          candidate.name === "Data Agent" ||
          candidate.name === "研究 Worker",
      ),
    ).toBe(false);
  });

  it("rejects an active Agent Profile that is not registered as Router", async () => {
    const { service, dispatches } = setup();

    await expect(
      service.start({
        actor,
        rootTaskId: "TSK-1",
        planner: "plan",
        routerAgentId: "worker-data",
        trigger: "manual",
      }),
    ).rejects.toThrow("不是已登记的 Router 类型");
    expect(dispatches).toHaveLength(0);
  });

  it("rejects a normal AI teammate as a Router type", async () => {
    const { service } = setup();

    await expect(
      service.registerRouterAgent(
        actor,
        "workspace-1",
        "worker-data",
        "data",
      ),
    ).rejects.toThrow("只能登记 Router 类型的 AI伙伴");
  });

  it("does not allow an active cycle to switch Router mid-plan", async () => {
    const { service } = setup();
    await service.registerRouterAgent(
      actor,
      "workspace-1",
      "agent-router-workspace-1",
      "general",
    );
    await service.registerRouterAgent(
      actor,
      "workspace-1",
      "agent-router-workspace-1-secondary",
      "software",
    );
    await service.start({
      actor,
      rootTaskId: "TSK-1",
      planner: "plan",
      trigger: "manual",
    });

    await expect(
      service.start({
        actor,
        rootTaskId: "TSK-1",
        planner: "plan",
        routerAgentId: "router-software",
        trigger: "replan",
      }),
    ).rejects.toThrow("不能临时切换 Router");
  });

  it("marks a finished run without a submitted result as failed", async () => {
    const { service, runStatus } = setup();
    const cycle = await service.start({
      actor,
      rootTaskId: "TSK-1",
      planner: "plan",
      trigger: "manual",
    });
    runStatus.value = "succeeded";

    await expect(service.refresh(cycle.id)).resolves.toMatchObject({
      status: "failed",
    });
  });

  it("preserves the Agent Run failure on the Router Cycle", async () => {
    const { service, runStatus, runError } = setup();
    const cycle = await service.start({
      actor,
      rootTaskId: "TSK-1",
      planner: "plan",
      trigger: "manual",
    });
    runStatus.value = "failed";
    runError.value = "principalId must not be empty";

    await expect(service.refresh(cycle.id)).resolves.toMatchObject({
      status: "failed",
      error: "principalId must not be empty",
    });
  });

  it("cancels a waiting Router run before retrying", async () => {
    const { service, cycles, dispatches, cancelledRuns, runStatus } = setup();
    const first = await service.start({
      actor,
      rootTaskId: "TSK-1",
      planner: "plan",
      trigger: "manual",
    });
    runStatus.value = "waiting_input";

    const second = await service.start({
      actor,
      rootTaskId: "TSK-1",
      planner: "plan",
      trigger: "manual",
    });

    expect(cancelledRuns).toEqual(["run-router-1"]);
    expect(cycles.get(first.id)?.status).toBe("failed");
    expect(second.id).not.toBe(first.id);
    expect(dispatches).toHaveLength(2);
  });

  it("replaces a stale interrupted Cycle instead of returning it", async () => {
    const { service, cycles, dispatches, runStatus, runError } = setup();
    const first = await service.start({
      actor,
      rootTaskId: "TSK-1",
      planner: "plan",
      trigger: "manual",
    });
    runStatus.value = "interrupted";
    runError.value = "服务重启导致运行中断";

    const second = await service.start({
      actor,
      rootTaskId: "TSK-1",
      planner: "plan",
      trigger: "manual",
    });

    expect(cycles.get(first.id)).toMatchObject({
      status: "failed",
      error: "服务重启导致运行中断",
    });
    expect(second.id).not.toBe(first.id);
    expect(second.status).toBe("queued");
    expect(dispatches[1]?.sessionId).not.toBe(dispatches[0]?.sessionId);
    expect(dispatches[1]?.sessionId).toContain("-retry-");
    expect(dispatches).toHaveLength(2);
  });

  it("keeps a plan bound to its original Router", async () => {
    const { service } = setup();
    await service.registerRouterAgent(
      actor,
      "workspace-1",
      "agent-router-workspace-1",
      "general",
    );
    await service.registerRouterAgent(
      actor,
      "workspace-1",
      "agent-router-workspace-1-secondary",
      "software",
    );
    const plan = planRecordSchema.parse({
      id: "rw-plan-1",
      workspaceId: "workspace-1",
      rootTaskId: "TSK-1",
      title: "复杂交付任务",
      priority: "P2",
      source: "router",
      routerAgentId: "agent-router-workspace-1",
      finalizationMode: "owner_handoff",
      status: "finalizing",
      currentVersion: 1,
      settings: { routerAgentId: "agent-router-workspace-1" },
      revision: 2,
      createdBy: "alice",
      createdAt: "2026-11-06T00:00:00.000Z",
      updatedAt: "2026-11-06T00:00:00.000Z",
    });

    await expect(
      service.start({
        actor,
        rootTaskId: "TSK-1",
        planner: "final",
        routerAgentId: "router-software",
        trigger: "all_required_accepted",
        plan: {
          plan,
          graph: {
            nodes: [
              {
                id: "work",
                title: "完成工作",
                description: "完成主任务交付。",
                type: "task",
                receiverType: "human",
                receiverId: "alice",
                priority: "P2",
                acceptance: ["提交结果"],
                dependencies: [],
                reviewMode: "human",
                maxAttempts: 2,
                timeoutSeconds: 86_400,
              },
            ],
            startNodeIds: ["work"],
            warnings: [],
          },
          nodeStates: [{ nodeId: "work", status: "accepted" }],
        },
      }),
    ).rejects.toThrow("已固化 Router Agent");
  });

  it("continues a historical plan bound to a legacy teammate Router", async () => {
    const { service, dispatches } = setup();
    const plan = planRecordSchema.parse({
      id: "rw-plan-legacy",
      workspaceId: "workspace-1",
      rootTaskId: "TSK-1",
      title: "复杂交付任务",
      priority: "P2",
      source: "router",
      routerAgentId: "worker-research",
      finalizationMode: "owner_handoff",
      status: "finalizing",
      currentVersion: 1,
      settings: { routerAgentId: "worker-research" },
      revision: 2,
      createdBy: "alice",
      createdAt: "2026-11-06T00:00:00.000Z",
      updatedAt: "2026-11-06T00:00:00.000Z",
    });

    const cycle = await service.start({
      actor,
      rootTaskId: "TSK-1",
      planner: "final",
      trigger: "all_required_accepted",
      plan: {
        plan,
        graph: {
          nodes: [
            {
              id: "work",
              title: "完成工作",
              description: "完成主任务交付。",
              type: "task",
              receiverType: "human",
              receiverId: "alice",
              priority: "P2",
              acceptance: ["提交结果"],
              dependencies: [],
              reviewMode: "human",
              maxAttempts: 2,
              timeoutSeconds: 86_400,
            },
          ],
          startNodeIds: ["work"],
          warnings: [],
        },
        nodeStates: [{ nodeId: "work", status: "accepted" }],
      },
    });

    expect(cycle.routerAgentId).toBe("worker-research");
    expect(dispatches[0]).toMatchObject({
      profileId: "worker-research",
      principalId: "principal-worker-research",
      payload: {
        context: {
          taskReceiverId: "worker-research",
          taskReceiverName: "研究 Worker",
        },
      },
    });
  });

  it("blocks dispatch when the Router teammate has no Principal", async () => {
    const { service, dispatches } = setup({ missingPrincipal: true });

    await expect(
      service.start({
        actor,
        rootTaskId: "TSK-1",
        planner: "plan",
        trigger: "manual",
      }),
    ).rejects.toThrow("缺少可执行 Principal");
    expect(dispatches).toHaveLength(0);
  });

  it("resolves the newest active cycle when a Router session is reused", async () => {
    const { service } = setup();
    const first = await service.start({
      actor,
      rootTaskId: "TSK-1",
      planner: "plan",
      trigger: "manual",
    });
    await service.markSubmitted(first.id, first.sessionId);
    const second = await service.start({
      actor,
      rootTaskId: "TSK-1",
      planner: "plan",
      trigger: "replan",
    });

    expect(second.sessionId).toBe(first.sessionId);
    expect(service.findBySessionId(second.sessionId ?? "")?.id).toBe(
      second.id,
    );
  });
});
