import { readFile } from "node:fs/promises";
import type { ServerResponse } from "node:http";
import { beforeEach, describe, expect, it } from "vitest";
import {
  apply,
  createWorkflowRoutes,
  extractAgentDeliverableText,
  inject,
  parseDefinitionFixture,
  workflowDomainSpec,
  WorkflowService,
  type TeamServiceLike,
  type WebRouteLike,
  type WorkflowActor,
  type WorkflowDefinition,
  type WorkflowDomainLike,
  type WorkflowEvent,
  type WorkflowInstance,
  type WorkflowSubmission,
} from "./index.js";
import type {
  AgentRunView,
  AgentServiceLike,
  EmployeeServiceLike,
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
    definitions: new FakeTable<WorkflowDefinition>(),
    instances: new FakeTable<WorkflowInstance>(),
    events: new FakeTable<WorkflowEvent>(),
    submissions: new FakeTable<WorkflowSubmission>(),
  };
}

function fakeDomain(current: ReturnType<typeof tables>): WorkflowDomainLike {
  return {
    table: ((name: "definitions" | "instances" | "events") =>
      current[name]) as unknown as WorkflowDomainLike["table"],
    close: async () => undefined,
  };
}

class FakeResponse {
  status = 0;
  body = "";
  writeHead(status: number): ServerResponse {
    this.status = status;
    return this as unknown as ServerResponse;
  }
  end(body?: string): ServerResponse {
    if (body !== undefined) this.body = body;
    return this as unknown as ServerResponse;
  }
  json(): unknown {
    return JSON.parse(this.body) as unknown;
  }
}

function fakeRequest(
  method: string,
  url: string,
  options: { body?: unknown; token?: string; origin?: string } = {},
) {
  const body = options.body === undefined ? "" : JSON.stringify(options.body);
  return {
    method,
    url,
    headers: {
      host: "127.0.0.1:33117",
      ...(options.origin === undefined ? {} : { origin: options.origin }),
      ...(options.token === undefined
        ? {}
        : { authorization: `Bearer ${options.token}` }),
    },
    async *[Symbol.asyncIterator]() {
      if (body !== "") yield Buffer.from(body);
    },
  };
}

async function call(route: WebRouteLike, request: unknown) {
  const response = new FakeResponse();
  await route.handler(
    request as Parameters<typeof route.handler>[0],
    response as unknown as ServerResponse,
  );
  return response;
}

const timestamp = "2026-01-01T00:00:00.000Z";
const owner: WorkflowActor = {
  kind: "user",
  id: "workflow-owner",
  name: "Owner",
  workspaceRole: "owner",
};
const member: WorkflowActor = {
  kind: "user",
  id: "workflow-member",
  name: "Member",
  workspaceRole: "member",
};
function team(): TeamServiceLike {
  return {
    resolveToken: (token) =>
      token === "owner"
        ? { userId: "workflow-owner", role: "member" }
        : token === "member"
          ? { userId: "workflow-member", role: "member" }
          : undefined,
    members: (workspaceId) =>
      workspaceId === "main"
        ? [
            { userId: "workflow-admin", name: "Admin", memberRole: "member" },
            { userId: "workflow-owner", name: "Owner", memberRole: "owner" },
            { userId: "workflow-member", name: "Member", memberRole: "member" },
          ]
        : [],
  };
}

async function importedFixture(
  service: WorkflowService,
  name: string,
  actor = owner,
) {
  const sourceMd = await readFile(
    new URL(`../../../docs/fixtures/workflow/${name}`, import.meta.url),
    "utf8",
  );
  return service.importDefinition(actor, { workspaceId: "main", sourceMd });
}

class FakeAgentService implements AgentServiceLike {
  readonly dispatchInputs: Array<Parameters<AgentServiceLike["dispatch"]>[0]> =
    [];
  private readonly records = new Map<string, AgentRunView>();

  constructor(private readonly hasProfile = true) {}

  profile(workspaceId: string, profileId: string) {
    if (!this.hasProfile || workspaceId !== "main") return undefined;
    return {
      id: profileId,
      name: "Backend Agent",
      runtimeKind: "task-worker",
      status: "active",
    };
  }

  runs(instanceId: string, nodeId?: string): AgentRunView[] {
    return [...this.records.values()]
      .filter(
        (run) =>
          run.instanceId === instanceId &&
          (nodeId === undefined || run.nodeId === nodeId),
      )
      .sort((left, right) => left.runSeq - right.runSeq);
  }

  run(runId: string): AgentRunView | undefined {
    return this.records.get(runId);
  }

  async dispatch(
    input: Parameters<AgentServiceLike["dispatch"]>[0],
  ): Promise<AgentRunView> {
    this.dispatchInputs.push(input);
    const run: AgentRunView = {
      id: `agent-run-${this.dispatchInputs.length}`,
      workspaceId: input.workspaceId,
      agentProfileId: input.profileId,
      instanceId: input.instanceId,
      nodeId: input.nodeId,
      dispatchKey: input.dispatchKey,
      trigger: input.trigger,
      status: "queued",
      attempt: input.attempt,
      runSeq: input.runSeq,
      maxAttempts: input.maxAttempts,
      timeoutMs: input.timeoutMs,
      ...(input.employeeId === undefined
        ? {}
        : { employeeId: input.employeeId }),
      ...(input.principalType === undefined
        ? {}
        : { principalType: input.principalType }),
      ...(input.ticketId === undefined ? {} : { ticketId: input.ticketId }),
      payload: input.payload,
      createdBy: input.createdBy,
      createdAt: timestamp,
    };
    this.records.set(run.id, run);
    return run;
  }

  async cancel(runId: string): Promise<AgentRunView> {
    const run = this.records.get(runId);
    if (run === undefined) throw new Error("run not found");
    if (!["queued", "running", "waiting_input"].includes(run.status)) {
      throw Object.assign(
        new Error(
          run.status === "succeeded"
            ? "Agent 运行已完成，无法取消"
            : "Agent 运行已结束，无法取消",
        ),
        { code: "conflict" },
      );
    }
    const cancelled = { ...run, status: "cancelled" } as const;
    this.records.set(runId, cancelled);
    return cancelled;
  }

  bindWorkflow(): void {}

  settle(runId: string, patch: Partial<AgentRunView>): void {
    const run = this.records.get(runId);
    if (run === undefined) throw new Error("run not found");
    this.records.set(runId, { ...run, ...patch } as AgentRunView);
  }
}

class FakeEmployeeService implements EmployeeServiceLike {
  readonly tickets: Array<{ id: string; input: unknown }> = [];
  readonly authorized: string[] = [];
  private ticketAttempts = 0;

  constructor(
    private readonly failTickets = false,
    private readonly failWriteAuthorization = false,
    private readonly workflowBlockReason?: string,
  ) {}

  employeeWorkspaceTarget() {
    return {
      employee: {
        id: "backend-01",
        displayName: "Backend Engineer 01",
        status: "active",
      },
      assignment: { role: "member" as const, permissions: ["read", "write"] },
    };
  }

  workflowTarget() {
    return {
      employee: {
        id: "backend-01",
        displayName: "Backend Engineer 01",
        status: "active",
      },
      assignment: { role: "member" as const, permissions: ["read", "write"] },
      profile: {
        id: "runtime-backend-01",
        name: "Backend runtime",
        legacyAgentProfileId: "backend-agent",
      },
    };
  }

  workflowDispatchBlockReason() {
    return this.workflowBlockReason;
  }

  employeeApprovalTarget() {
    return undefined;
  }

  async issueRuntimeTicket(
    actorAuthUserId: string,
    input: Parameters<EmployeeServiceLike["issueRuntimeTicket"]>[1],
  ) {
    this.ticketAttempts += 1;
    if (this.failTickets && this.ticketAttempts === 1) {
      throw new Error("active Human Employee is required");
    }
    const ticket = {
      id: `ticket-${this.tickets.length + 1}`,
      actorAuthUserId,
      input,
    };
    this.tickets.push(ticket);
    return ticket;
  }

  async authorizeTicket(
    input: Parameters<EmployeeServiceLike["authorizeTicket"]>[0],
  ) {
    if (this.failWriteAuthorization && input.ticketId === "ticket-1") {
      throw new Error("action is explicitly denied");
    }
    this.authorized.push(input.ticketId);
    return { employeeId: "backend-01" };
  }
}

const guest: WorkflowActor = {
  kind: "user",
  id: "workflow-guest",
  name: "Guest",
  workspaceRole: "guest",
};

describe("workflow parser", () => {
  it("parses parallel branches, approvals, and controlled cycles", async () => {
    const result = parseDefinitionFixture(
      await readFile(
        new URL(
          "../../../docs/fixtures/workflow/product-delivery.md",
          import.meta.url,
        ),
        "utf8",
      ),
    );
    expect(result.errors).toEqual([]);
    expect(result.warnings.join(" ")).toContain(
      'node "development" has an agent executor without responsible',
    );
    expect(result.graph?.nodes).toHaveLength(5);
    expect(result.graph?.edges).toHaveLength(5);
    expect(result.graph?.startNodeIds).toEqual(["requirement-review"]);
    expect(
      result.graph?.nodes.find((node) => node.id === "release-approval")
        ?.approvers,
    ).toHaveLength(2);
    const enhanced = parseDefinitionFixture(
      await readFile(
        new URL(
          "../../../docs/fixtures/workflow/product-delivery-v2.md",
          import.meta.url,
        ),
        "utf8",
      ),
    );
    expect(enhanced.errors).toEqual([]);
    expect(
      enhanced.graph?.nodes.find((node) => node.id === "development")
        ?.deliverables,
    ).toHaveLength(2);
    expect(
      enhanced.graph?.nodes.find((node) => node.id === "development")
        ?.responsible,
    ).toMatchObject({ kind: "user", id: "workflow-member" });
    expect(
      enhanced.graph?.nodes.find((node) => node.id === "development"),
    ).toMatchObject({
      execution: "task-worker",
      trigger: "manual-dispatch",
      maxAttempts: 2,
      timeoutMs: 1_800_000,
      agentProfileId: "backend-agent",
    });
    expect(enhanced.warnings).toEqual([]);
  });

  it("rejects an uncontrolled cycle", async () => {
    const result = parseDefinitionFixture(
      await readFile(
        new URL(
          "../../../docs/fixtures/workflow/invalid-cycle.md",
          import.meta.url,
        ),
        "utf8",
      ),
    );
    expect(result.graph).toBeUndefined();
    expect(result.errors.join(" ")).toContain(
      "cycle requires a break condition",
    );
  });

  it("parses Agent execution and runtime limits", async () => {
    const result = parseDefinitionFixture(
      await readFile(
        new URL(
          "../../../docs/fixtures/workflow/agent-node.md",
          import.meta.url,
        ),
        "utf8",
      ),
    );
    expect(result.errors).toEqual([]);
    const node = result.graph?.nodes.find((item) => item.id === "development");
    expect(node).toMatchObject({
      executor: { kind: "agent", id: "backend-agent" },
      execution: "task-worker",
      trigger: "auto-on-ready",
      maxAttempts: 2,
      timeoutMs: 1_800_000,
      responsible: { kind: "user", id: "workflow-member" },
    });
    expect(node?.agentProfileId).toBeUndefined();

    const timeoutResult = parseDefinitionFixture(
      await readFile(
        new URL(
          "../../../docs/fixtures/workflow/agent-node-timeout.md",
          import.meta.url,
        ),
        "utf8",
      ),
    );
    const timeoutNode = timeoutResult.graph?.nodes.find(
      (item) => item.id === "development",
    );
    expect(timeoutNode).toMatchObject({ timeoutMs: 1_000 });
  });
});

describe("workflow service", () => {
  let current: ReturnType<typeof tables>;
  let service: WorkflowService;

  beforeEach(() => {
    current = tables();
    service = new WorkflowService(current, {
      now: () => new Date(timestamp),
      team,
    });
  });

  it("declares services and storage tables", () => {
    expect(inject).toEqual(["storageDomain", "commands", "tools", "webServer"]);
    expect(workflowDomainSpec).toMatchObject({
      name: "collab_workflow",
      version: 1,
    });
    expect(Object.keys(workflowDomainSpec.tables)).toEqual([
      "definitions",
      "instances",
      "events",
      "submissions",
    ]);
  });

  it("reports the same validation warning only once", async () => {
    const sourceMd = await readFile(
      new URL(
        "../../../docs/fixtures/workflow/product-delivery.md",
        import.meta.url,
      ),
      "utf8",
    );
    const result = service.validate(sourceMd, "main");
    const warning =
      'node "development" has an agent executor without responsible; workspace owner/admin will handle it';
    expect(
      result.issues.filter((issue) => issue.message === warning),
    ).toHaveLength(1);
  });

  it("imports, archives previous versions, and starts an instance", async () => {
    const first = await importedFixture(service, "product-delivery.md");
    const changed = (
      await readFile(
        new URL(
          "../../../docs/fixtures/workflow/product-delivery.md",
          import.meta.url,
        ),
        "utf8",
      )
    ).replace("version: 1", "version: 2");
    const second = await service.importDefinition(owner, {
      workspaceId: "main",
      sourceMd: changed,
    });
    expect(
      service.definitions("main").find((item) => item.id === first.id)?.status,
    ).toBe("archived");
    expect(second.status).toBe("active");
    const agentDefinition = await importedFixture(service, "agent-node.md");
    await current.definitions.put(first.id, {
      ...first,
      updatedAt: "2026-01-02T00:00:00.000Z",
    });
    await current.definitions.put(second.id, {
      ...second,
      updatedAt: "2026-01-03T00:00:00.000Z",
    });
    await current.definitions.put(agentDefinition.id, {
      ...agentDefinition,
      updatedAt: "2026-01-01T00:00:00.000Z",
    });
    expect(service.definitions("main").map((item) => item.id)).toEqual([
      second.id,
      first.id,
      agentDefinition.id,
    ]);
    const instance = await service.startInstance(member, {
      workspaceId: "main",
      definitionId: second.id,
      title: "订单导出",
      sessionId: "session-a",
    });
    expect(instance.status).toBe("running");
    expect(instance.nodes["requirement-review"]?.status).toBe("ready");
    expect(instance.relatedSessionIds).toEqual(["session-a"]);
    await expect(
      service.completeNode(member, {
        instanceId: instance.id,
        nodeId: "release",
      }),
    ).rejects.toMatchObject({
      code: "conflict",
      message: "node is waiting for upstream nodes",
    });
    await current.instances.put(instance.id, {
      ...instance,
      nodes: {
        ...instance.nodes,
        release: {
          ...instance.nodes.release!,
          status: "completed",
          completedAt: timestamp,
        },
      },
    });
    expect(service.instanceView(instance.id)?.status).toBe("blocked");
    expect(service.instances("main")[0]?.status).toBe("blocked");
  });

  it("runs parallel nodes through a join and approval", async () => {
    const definition = await importedFixture(service, "product-delivery-v2.md");
    const instance = await service.startInstance(member, {
      workspaceId: "main",
      definitionId: definition.id,
      title: "订单导出",
    });
    await service.decideApproval(member, {
      instanceId: instance.id,
      nodeId: "requirement-review",
      decision: "approved",
    });
    const progressed = service.instance(instance.id)!;
    expect(progressed.status).toBe("running");
    expect(progressed.nodes.development?.status).toBe("ready");
    expect(progressed.nodes["test-preparation"]?.status).toBe("ready");
    expect(progressed.nodes["release-approval"]?.status).toBe("waiting");
    await expect(
      service.completeNode(member, {
        instanceId: instance.id,
        nodeId: "development",
      }),
    ).rejects.toMatchObject({ code: "missing_deliverables" });
    const submission = await service.submitDeliverable(member, {
      instanceId: instance.id,
      nodeId: "development",
      requirementKey: "implementation-report",
      type: "text",
      value:
        "完成订单导出接口与数据结构，覆盖权限、并发导出和空结果场景，记录已知风险。",
    });
    expect(submission.onBehalfOf).toBe("backend-agent");
    await service.completeNode(member, {
      instanceId: instance.id,
      nodeId: "development",
    });
    expect(
      service.instance(instance.id)!.nodes["release-approval"]?.status,
    ).toBe("waiting");
    await service.completeNode(member, {
      instanceId: instance.id,
      nodeId: "test-preparation",
    });
    const ready = service.instance(instance.id)!;
    expect(ready.nodes["release-approval"]?.status).toBe("ready");
    expect(ready.nodes.release?.status).toBe("waiting");
  });

  it("allows the second approver to act after the node enters partial-approval waiting", async () => {
    const definition = await importedFixture(service, "product-delivery-v2.md");
    const instance = await service.startInstance(member, {
      workspaceId: "main",
      definitionId: definition.id,
      title: "多审批人部分等待",
    });
    await service.decideApproval(member, {
      instanceId: instance.id,
      nodeId: "requirement-review",
      decision: "approved",
    });
    await service.submitDeliverable(member, {
      instanceId: instance.id,
      nodeId: "development",
      requirementKey: "implementation-report",
      type: "text",
      value: "完成订单导出接口与数据结构，覆盖权限、并发导出和空结果场景。",
    });
    await service.completeNode(member, {
      instanceId: instance.id,
      nodeId: "development",
    });
    await service.completeNode(member, {
      instanceId: instance.id,
      nodeId: "test-preparation",
    });
    const ready = service.instance(instance.id)!;
    expect(ready.nodes["release-approval"]?.status).toBe("ready");
    expect(ready.nodes["release-approval"]?.enteredAt).toBeDefined();

    await service.decideApproval(owner, {
      instanceId: instance.id,
      nodeId: "release-approval",
      decision: "approved",
      note: "owner 通过",
    });
    const partial = service.instance(instance.id)!;
    expect(partial.nodes["release-approval"]?.status).toBe("waiting");
    expect(partial.nodes["release-approval"]?.enteredAt).toBeDefined();

    await service.decideApproval(member, {
      instanceId: instance.id,
      nodeId: "release-approval",
      decision: "approved",
      note: "member 通过",
    });
    const completed = service.instance(instance.id)!;
    expect(completed.nodes["release-approval"]?.status).toBe("completed");
    expect(completed.nodes.release?.status).toBe("ready");
  });

  it("rejects decisions on a future approval node that is still waiting", async () => {
    const definition = await importedFixture(service, "product-delivery-v2.md");
    const instance = await service.startInstance(member, {
      workspaceId: "main",
      definitionId: definition.id,
      title: "未来审批防护",
    });
    expect(instance.nodes["release-approval"]?.status).toBe("waiting");
    for (const actor of [owner, member]) {
      await expect(
        service.decideApproval(actor, {
          instanceId: instance.id,
          nodeId: "release-approval",
          decision: "approved",
        }),
      ).rejects.toMatchObject({
        code: "conflict",
        message: expect.stringContaining("waiting for upstream"),
      });
      await expect(
        service.decideApproval(actor, {
          instanceId: instance.id,
          nodeId: "release-approval",
          decision: "rejected",
          note: "不该被记录",
        }),
      ).rejects.toMatchObject({
        code: "conflict",
        message: expect.stringContaining("waiting for upstream"),
      });
    }
    const unchanged = service.instance(instance.id)!;
    expect(unchanged.nodes["release-approval"]?.status).toBe("waiting");
    expect(
      Object.values(unchanged.nodes["release-approval"]!.approvals).every(
        (item) => item.status === "pending",
      ),
    ).toBe(true);
    expect(
      service.events(instance.id).some(
        (event) =>
          event.nodeId === "release-approval" &&
          event.kind.startsWith("approval."),
      ),
    ).toBe(false);
  });

  it("rejects a deliverable and requires a new submission", async () => {
    const definition = await importedFixture(service, "product-delivery-v2.md");
    const instance = await service.startInstance(member, {
      workspaceId: "main",
      definitionId: definition.id,
      title: "交付物退回",
    });
    await service.decideApproval(member, {
      instanceId: instance.id,
      nodeId: "requirement-review",
      decision: "approved",
    });
    const submission = await service.submitDeliverable(member, {
      instanceId: instance.id,
      nodeId: "development",
      requirementKey: "implementation-report",
      type: "text",
      value: "初版说明已补充接口与测试范围，但还缺少风险、覆盖范围和结论。",
    });
    const rejected = await service.rejectSubmission(owner, {
      submissionId: submission.id,
      note: "缺少回归范围",
    });
    expect(rejected.status).toBe("rejected");
    await expect(
      service.completeNode(member, {
        instanceId: instance.id,
        nodeId: "development",
      }),
    ).rejects.toMatchObject({ code: "missing_deliverables" });
    await service.submitDeliverable(member, {
      instanceId: instance.id,
      nodeId: "development",
      requirementKey: "implementation-report",
      type: "text",
      value:
        "完成订单导出接口与数据结构，覆盖权限、并发导出和空结果场景，记录已知风险。",
    });
    expect(
      service.instance(instance.id)?.nodes.development?.deliverables[
        "implementation-report"
      ]?.status,
    ).toBe("submitted");
    await expect(
      service.completeNode(member, {
        instanceId: instance.id,
        nodeId: "development",
      }),
    ).resolves.toBeDefined();
  });

  it("supports delegation and countersign", async () => {
    const definition = await importedFixture(service, "product-delivery.md");
    const instance = await service.startInstance(owner, {
      workspaceId: "main",
      definitionId: definition.id,
      title: "审批链",
    });
    await expect(
      service.countersignApproval(member, {
        instanceId: instance.id,
        nodeId: "requirement-review",
        toId: "missing-user",
        toName: "Missing User",
      }),
    ).rejects.toMatchObject({ code: "invalid_input" });
    const delegated = await service.delegateApproval(member, {
      instanceId: instance.id,
      nodeId: "requirement-review",
      toId: "workflow-owner",
      toName: "Owner",
    });
    expect(delegated.nodes["requirement-review"]?.approvals).toMatchObject({
      "requirement-review:workflow-owner": { status: "pending" },
    });
    const countersigned = await service.countersignApproval(owner, {
      instanceId: instance.id,
      nodeId: "requirement-review",
      toId: "workflow-admin",
      toName: "Admin",
    });
    expect(
      Object.values(countersigned.nodes["requirement-review"]!.approvals),
    ).toHaveLength(3);
    await expect(
      service.countersignApproval(member, {
        instanceId: instance.id,
        nodeId: "requirement-review",
        toId: "auditor-2",
        toName: "Auditor 2",
      }),
    ).rejects.toMatchObject({ code: "forbidden" });
  });

  it("rejects workflow users outside the workspace", async () => {
    const sourceMd = await readFile(
      new URL(
        "../../../docs/fixtures/workflow/product-delivery.md",
        import.meta.url,
      ),
      "utf8",
    );
    await expect(
      service.importDefinition(owner, {
        workspaceId: "other",
        sourceMd,
      }),
    ).rejects.toMatchObject({
      code: "invalid_input",
      message: expect.stringContaining("不是当前工作区成员"),
    });
  });

  it("blocks a controlled loop when break becomes true", async () => {
    const definition = await importedFixture(service, "controlled-loop.md");
    const instance = await service.startInstance(member, {
      workspaceId: "main",
      definitionId: definition.id,
      title: "返工流程",
      context: { attempts: 3 },
    });
    await service.completeNode(owner, {
      instanceId: instance.id,
      nodeId: "confirm",
    });
    await service.completeNode(owner, {
      instanceId: instance.id,
      nodeId: "development",
    });
    await service.decideApproval(member, {
      instanceId: instance.id,
      nodeId: "testing",
      decision: "rejected",
    });
    const blocked = service.instance(instance.id)!;
    expect(blocked.status).toBe("blocked");
    expect(blocked.nodes.development?.status).toBe("blocked");
    expect(blocked.nodes.development?.note).toContain("已触发 break");
  });

  it("reactivates a completed node after a controlled rejection", async () => {
    const definition = await importedFixture(service, "controlled-loop.md");
    const instance = await service.startInstance(member, {
      workspaceId: "main",
      definitionId: definition.id,
      title: "首次返工",
    });
    await service.completeNode(owner, {
      instanceId: instance.id,
      nodeId: "confirm",
    });
    await service.completeNode(owner, {
      instanceId: instance.id,
      nodeId: "development",
    });
    const reworked = await service.decideApproval(member, {
      instanceId: instance.id,
      nodeId: "testing",
      decision: "rejected",
    });
    expect(reworked.nodes.development?.status).toBe("ready");
    expect(reworked.nodes.development?.attempts).toBe(2);
    expect(reworked.context.attempts).toBe(2);
    expect(reworked.nodes.testing?.status).toBe("completed");
    expect(reworked.status).toBe("running");
    await service.completeNode(owner, {
      instanceId: instance.id,
      nodeId: "development",
    });
    await service.decideApproval(member, {
      instanceId: instance.id,
      nodeId: "testing",
      decision: "rejected",
    });
    const secondRework = service.instance(instance.id)!;
    expect(secondRework.nodes.development?.status).toBe("ready");
    expect(secondRework.context.attempts).toBe(3);
    await service.completeNode(owner, {
      instanceId: instance.id,
      nodeId: "development",
    });
    await service.decideApproval(member, {
      instanceId: instance.id,
      nodeId: "testing",
      decision: "rejected",
    });
    const blocked = service.instance(instance.id)!;
    expect(blocked.status).toBe("blocked");
    expect(blocked.nodes.development?.status).toBe("blocked");
    expect(blocked.nodes.development?.note).toContain("已触发 break");
  });

  it("starts and completes a sub-workflow", async () => {
    await importedFixture(service, "sub-process.md");
    const parentDefinition = await importedFixture(service, "parent-child.md");
    const parent = await service.startInstance(owner, {
      workspaceId: "main",
      definitionId: parentDefinition.id,
      title: "父流程",
    });
    const withChild = await service.resolveDecision(owner, {
      instanceId: parent.id,
      nodeId: "complexity",
      values: { complexity: 8 },
    });
    const parentNode = withChild.nodes["complex-review"]!;
    expect(parentNode.status).toBe("running");
    expect(parentNode.childInstanceId).toBeDefined();
    const child = service.instance(parentNode.childInstanceId!)!;
    expect(child.definitionKey).toBe("complex-review");
    await service.decideApproval(owner, {
      instanceId: child.id,
      nodeId: "architecture",
      decision: "approved",
    });
    const childAfterFirst = service.instance(child.id)!;
    expect(childAfterFirst.nodes.security?.status).toBe("ready");
    await service.decideApproval(member, {
      instanceId: child.id,
      nodeId: "security",
      decision: "approved",
    });
    const completedChild = service.instance(child.id)!;
    expect(completedChild.status).toBe("completed");
    const completedParent = service.instance(parent.id)!;
    expect(completedParent.nodes["complex-review"]?.status).toBe("completed");
    expect(completedParent.nodes.archive?.status).toBe("ready");
    await service.completeNode(owner, {
      instanceId: parent.id,
      nodeId: "archive",
    });
    const archivedParent = service.instance(parent.id)!;
    expect(archivedParent.nodes.archive?.status).toBe("completed");
    expect(archivedParent.status).toBe("completed");
    const low = await service.startInstance(owner, {
      workspaceId: "main",
      definitionId: parentDefinition.id,
      title: "标准方案实例",
    });
    const lowRouted = await service.resolveDecision(owner, {
      instanceId: low.id,
      nodeId: "complexity",
      values: { complexity: 3 },
    });
    expect(lowRouted.nodes["complex-review"]?.status).toBe("skipped");
    expect(lowRouted.nodes["standard-development"]?.status).toBe("ready");
    await expect(
      service.completeNode(member, {
        instanceId: low.id,
        nodeId: "standard-development",
      }),
    ).rejects.toMatchObject({ code: "forbidden" });
    await service.completeNode(owner, {
      instanceId: low.id,
      nodeId: "standard-development",
    });
    await service.completeNode(owner, {
      instanceId: low.id,
      nodeId: "archive",
    });
    const archivedLow = service.instance(low.id)!;
    expect(archivedLow.nodes.archive?.status).toBe("completed");
    expect(archivedLow.status).toBe("completed");
  });
});

describe("workflow agent nodes", () => {
  async function agentHarness(hasProfile = true) {
    const current = tables();
    const agent = new FakeAgentService(hasProfile);
    const service = new WorkflowService(current, {
      now: () => new Date(timestamp),
      team,
      agent: () => agent,
    });
    return { agent, current, service };
  }

  async function employeeHarness(
    hasProfile = true,
    failTickets = false,
    failWriteAuthorization = false,
    workflowBlockReason?: string,
  ) {
    const current = tables();
    const agent = new FakeAgentService(hasProfile);
    const employee = new FakeEmployeeService(
      failTickets,
      failWriteAuthorization,
      workflowBlockReason,
    );
    const service = new WorkflowService(current, {
      now: () => new Date(timestamp),
      team,
      agent: () => agent,
      employee: () => employee,
    });
    return { agent, current, employee, service };
  }

  it("rejects import when the referenced Agent Profile is unavailable", async () => {
    const { service } = await agentHarness(false);
    await expect(
      importedFixture(service, "agent-node.md"),
    ).rejects.toMatchObject({
      code: "invalid_input",
      message: expect.stringContaining("Agent Profile「backend-agent」不存在"),
    });
  });

  it("auto-dispatches a ready Agent node and maps output to the delivery gate", async () => {
    const { agent, service } = await agentHarness();
    const definition = await importedFixture(service, "agent-node.md");
    const instance = await service.startInstance(member, {
      workspaceId: "main",
      definitionId: definition.id,
      title: "Agent 自动执行",
    });
    expect(instance.nodes.development?.status).toBe("running");
    expect(instance.nodes.development?.assignedTo).toBe("Backend Agent");
    expect(agent.dispatchInputs).toHaveLength(1);
    expect(agent.dispatchInputs[0]).toMatchObject({
      profileId: "backend-agent",
      trigger: "auto-on-ready",
      attempt: 1,
      runSeq: 1,
      maxAttempts: 2,
      timeoutMs: 1_800_000,
      payload: { responsibleId: "workflow-member" },
    });
    const run = agent.runs(instance.id, "development")[0]!;
    agent.settle(run.id, {
      ...run,
      status: "succeeded",
      output: {
        summary: "## 交付说明\n\n已完成 Agent 执行说明，覆盖接口与风险检查。",
        stopReason: "completed",
      },
    });
    await expect(service.cancelAgentRun(member, run.id)).rejects.toMatchObject({
      code: "conflict",
      message: "Agent 运行已完成，无法取消",
    });
    await service.handleAgentSettle(agent.run(run.id)!);
    const settled = service.instance(instance.id)!;
    expect(settled.nodes.development?.status).toBe("completed");
    expect(settled.nodes.development?.note).toContain("Agent 自动完成");
    const submissions = service.submissions(instance.id, {
      nodeId: "development",
    });
    expect(submissions).toHaveLength(1);
    expect(submissions[0]).toMatchObject({
      requirementKey: "implementation-report",
      submittedBy: "agent:backend-agent",
      onBehalfOf: "backend-agent",
      note: `agent-run:${run.id}`,
    });
    expect(settled.status).toBe("completed");
  });

  it("dispatches employee nodes through mapped runtime and preserves the principal", async () => {
    const { agent, employee, service } = await employeeHarness();
    const definition = await importedFixture(service, "employee-node.md");
    const instance = await service.startInstance(member, {
      workspaceId: "main",
      definitionId: definition.id,
      title: "Digital Employee 自动执行",
    });
    expect(instance.nodes.development?.assignedTo).toBe("Backend Engineer 01");
    expect(employee.tickets).toHaveLength(1);
    expect(agent.dispatchInputs[0]).toMatchObject({
      profileId: "backend-agent",
      employeeId: "backend-01",
      principalType: "digital-employee",
      ticketId: "ticket-1",
      payload: { employeeName: "Backend Engineer 01" },
    });
    const run = agent.runs(instance.id, "development")[0]!;
    agent.settle(run.id, {
      ...run,
      status: "succeeded",
      output: {
        summary: "## 交付说明\n\n已完成 Digital Employee 交付说明与风险检查。",
        stopReason: "completed",
      },
    });
    await service.handleAgentSettle(agent.run(run.id)!);
    expect(employee.authorized).toEqual(["ticket-1"]);
    const settled = service.instance(instance.id)!;
    const submissions = service.submissions(instance.id, {
      nodeId: "development",
    });
    expect(submissions[0]).toMatchObject({
      submittedBy: "employee:backend-01",
      submittedByName: "Backend Engineer 01",
      onBehalfOf: "backend-01",
    });
    expect(settled.status).toBe("completed");
  });

  it("recovers an employee node after an automatic ticket failure", async () => {
    const { agent, employee, service } = await employeeHarness(true, true);
    const definition = await importedFixture(service, "employee-node.md");
    const failed = await service.startInstance(owner, {
      workspaceId: "main",
      definitionId: definition.id,
      title: "Digital Employee 票据失败恢复",
    });
    expect(failed.nodes.development).toMatchObject({
      status: "blocked",
    });
    expect(failed.nodes.development?.note).toContain(
      "Digital Employee 运行票据签发失败",
    );

    const recovered = await service.dispatchAgentNode(owner, {
      instanceId: failed.id,
      nodeId: "development",
      trigger: "manual-dispatch",
    });
    expect(recovered.nodes.development?.status).toBe("running");
    expect(employee.tickets).toHaveLength(1);
    expect(agent.dispatchInputs[0]).toMatchObject({
      principalType: "digital-employee",
      ticketId: "ticket-1",
    });
  });

  it("recovers an employee run whose output was denied by its ticket", async () => {
    const { agent, employee, service } = await employeeHarness(true, false, true);
    const definition = await importedFixture(service, "employee-node.md");
    const instance = await service.startInstance(member, {
      workspaceId: "main",
      definitionId: definition.id,
      title: "Digital Employee 票据拒绝恢复",
    });
    const run = agent.runs(instance.id, "development")[0]!;
    agent.settle(run.id, {
      ...run,
      status: "succeeded",
      output: {
        summary: "## 交付说明\n\n已完成 Digital Employee 交付说明与风险检查。",
        stopReason: "completed",
      },
    });
    await service.handleAgentSettle(agent.run(run.id)!);
    const blocked = service.instance(instance.id)!;
    expect(blocked.nodes.development).toMatchObject({
      status: "blocked",
      note: expect.stringContaining("action is explicitly denied"),
    });
    expect(employee.authorized).toEqual([]);
    expect(
      service.submissions(instance.id, { nodeId: "development" }),
    ).toHaveLength(0);

    const retried = await service.retryAgentRun(owner, run.id);
    const secondRun = agent.runs(instance.id, "development")[1]!;
    expect(secondRun.ticketId).toBe("ticket-2");
    expect(retried.nodes.development).toMatchObject({
      status: "running",
      note: "Digital Employee 运行中 · 第 2 次",
    });

    agent.settle(secondRun.id, {
      ...secondRun,
      status: "succeeded",
      output: {
        summary: "## 交付说明\n\n调整 Runtime 后完成交付说明与风险检查。",
        stopReason: "completed",
      },
    });
    await service.handleAgentSettle(agent.run(secondRun.id)!);
    expect(service.instance(instance.id)!.nodes.development?.status).toBe(
      "completed",
    );
    expect(employee.authorized).toEqual(["ticket-2"]);
  });

  it("reports a suspended employee as the manual dispatch blocker", async () => {
    const { agent, service } = await employeeHarness(
      true,
      false,
      false,
      "Digital Employee「Backend Engineer 01」已暂停，不能派发",
    );
    const definition = await importedFixture(
      service,
      "employee-node-manual.md",
    );
    const instance = await service.startInstance(member, {
      workspaceId: "main",
      definitionId: definition.id,
      title: "Digital Employee 暂停原因",
    });
    expect(instance.nodes.development?.status).toBe("ready");
    await expect(
      service.dispatchAgentNode(member, {
        instanceId: instance.id,
        nodeId: "development",
        trigger: "manual-dispatch",
      }),
    ).rejects.toMatchObject({
      code: "forbidden",
      message: "Digital Employee「Backend Engineer 01」已暂停，不能派发",
    });
    expect(agent.dispatchInputs).toHaveLength(0);
  });

  it("does not accept an agent reply without the required delivery section", async () => {
    const { agent, service } = await agentHarness();
    const definition = await importedFixture(service, "agent-node.md");
    const instance = await service.startInstance(member, {
      workspaceId: "main",
      definitionId: definition.id,
      title: "Agent 输出格式校验",
    });
    const run = agent.runs(instance.id, "development")[0]!;
    agent.settle(run.id, {
      ...run,
      status: "succeeded",
      output: {
        summary:
          "Let me inspect the workspace before writing the delivery note.",
        stopReason: "completed",
      },
    });
    await service.handleAgentSettle(agent.run(run.id)!);
    expect(extractAgentDeliverableText("没有约定章节")).toBe("");
    const settled = service.instance(instance.id)!;
    expect(settled.nodes.development).toMatchObject({
      status: "blocked",
      note: expect.stringContaining("未按约定输出「交付说明」"),
    });
    expect(
      service.submissions(instance.id, { nodeId: "development" }),
    ).toHaveLength(0);
    const retried = await service.retryAgentRun(member, run.id);
    expect(agent.runs(instance.id, "development")).toHaveLength(2);
    expect(retried.nodes.development).toMatchObject({
      status: "running",
      note: "Agent 运行中 · 第 2 次",
    });
  });

  it("allows the responsible user to recover a timed-out agent node manually", async () => {
    const { agent, service } = await agentHarness();
    const definition = await importedFixture(service, "agent-node.md");
    const instance = await service.startInstance(member, {
      workspaceId: "main",
      definitionId: definition.id,
      title: "Agent 超时转人工",
    });
    const run = agent.runs(instance.id, "development")[0]!;
    agent.settle(run.id, {
      ...run,
      status: "timeout",
      error: "运行超时，已中止",
    });
    await service.handleAgentSettle(agent.run(run.id)!);
    expect(service.instance(instance.id)!.nodes.development?.status).toBe(
      "blocked",
    );
    const submission = await service.submitDeliverable(member, {
      instanceId: instance.id,
      nodeId: "development",
      requirementKey: "implementation-report",
      type: "text",
      value:
        "人工接管完成开发说明：覆盖接口结果、验证范围和上线风险，避免流程停滞。",
    });
    expect(submission.onBehalfOf).toBe("backend-agent");
    const recovered = service.instance(instance.id)!;
    expect(recovered.nodes.development?.status).toBe("ready");
    expect(recovered.nodes.development?.note).toContain("人工代交");
    const completed = await service.completeNode(member, {
      instanceId: instance.id,
      nodeId: "development",
    });
    expect(completed.nodes.development?.status).toBe("completed");
  });

  it("supports manual dispatch, cancellation, retry, permissions, and attempt cap", async () => {
    const { agent, service } = await agentHarness();
    const sourceMd = (
      await readFile(
        new URL(
          "../../../docs/fixtures/workflow/agent-node.md",
          import.meta.url,
        ),
        "utf8",
      )
    )
      .replace("version: 2", "version: 3")
      .replace("trigger: auto-on-ready", "trigger: manual-dispatch");
    const definition = await service.importDefinition(owner, {
      workspaceId: "main",
      sourceMd,
    });
    const instance = await service.startInstance(member, {
      workspaceId: "main",
      definitionId: definition.id,
      title: "Agent 手动执行",
    });
    expect(instance.nodes.development?.status).toBe("ready");
    await expect(
      service.dispatchAgentNode(guest, {
        instanceId: instance.id,
        nodeId: "development",
        trigger: "manual-dispatch",
      }),
    ).rejects.toMatchObject({ code: "forbidden" });
    await service.dispatchAgentNode(member, {
      instanceId: instance.id,
      nodeId: "development",
      trigger: "manual-dispatch",
    });
    const firstRun = agent.runs(instance.id)[0]!;
    await service.cancelAgentRun(member, firstRun.id);
    await service.handleAgentSettle(agent.run(firstRun.id)!);
    expect(service.instance(instance.id)!.nodes.development?.status).toBe(
      "ready",
    );
    await service.retryAgentRun(member, firstRun.id);
    const secondRun = agent.runs(instance.id)[1]!;
    agent.settle(secondRun.id, { status: "failed", error: "worker stopped" });
    expect(secondRun.runSeq).toBe(2);
    await service.handleAgentSettle({
      ...secondRun,
      status: "failed",
      error: "worker stopped",
    });
    expect(service.instance(instance.id)!.nodes.development).toMatchObject({
      status: "blocked",
      note: "Agent 运行未完成：worker stopped",
    });
    await expect(
      service.retryAgentRun(member, secondRun.id),
    ).rejects.toMatchObject({ code: "forbidden" });
    await service.retryAgentRun(owner, secondRun.id);
    expect(agent.runs(instance.id)).toHaveLength(3);
  });
});

describe("workflow routes", () => {
  let current: ReturnType<typeof tables>;
  let service: WorkflowService;
  let routes: WebRouteLike[];

  beforeEach(async () => {
    current = tables();
    service = new WorkflowService(current, {
      now: () => new Date(timestamp),
      team,
    });
    routes = createWorkflowRoutes(service, team);
  });

  function route(path: string): WebRouteLike {
    const found = routes.find((item) => item.path === path);
    if (found === undefined) throw new Error(`missing route ${path}`);
    return found;
  }

  it("requires same origin and a valid bearer token", async () => {
    const cross = await call(
      route("/api/collab/workflow/instances"),
      fakeRequest("GET", "/api/collab/workflow/instances?workspaceId=main", {
        token: "owner",
        origin: "https://evil.example",
      }),
    );
    expect(cross.status).toBe(403);
    const unauthorized = await call(
      route("/api/collab/workflow/instances"),
      fakeRequest("GET", "/api/collab/workflow/instances?workspaceId=main", {
        token: "bad",
        origin: "http://127.0.0.1:33117",
      }),
    );
    expect(unauthorized.status).toBe(401);
  });

  it("rejects a member of another workspace", async () => {
    const response = await call(
      route("/api/collab/workflow/instances"),
      fakeRequest("GET", "/api/collab/workflow/instances?workspaceId=other", {
        token: "owner",
        origin: "http://127.0.0.1:33117",
      }),
    );
    expect(response.status).toBe(403);
  });

  it("lists instances only inside the requested workspace", async () => {
    const definition = await importedFixture(service, "product-delivery.md");
    await service.startInstance(owner, {
      workspaceId: "main",
      definitionId: definition.id,
      title: "A",
      sessionId: "s-a",
    });
    await service.startInstance(owner, {
      workspaceId: "main",
      definitionId: definition.id,
      title: "B",
      sessionId: "s-b",
    });
    const response = await call(
      route("/api/collab/workflow/instances"),
      fakeRequest(
        "GET",
        "/api/collab/workflow/instances?workspaceId=main&sessionId=s-a",
        { token: "owner", origin: "http://127.0.0.1:33117" },
      ),
    );
    expect(response.status).toBe(200);
    const payload = response.json() as { instances: WorkflowInstance[] };
    expect(payload.instances).toHaveLength(1);
    expect(payload.instances[0]!.title).toBe("A");
  });

  it("blocks non-manager import", async () => {
    const sourceMd = await readFile(
      new URL(
        "../../../docs/fixtures/workflow/product-delivery.md",
        import.meta.url,
      ),
      "utf8",
    );
    const response = await call(
      route("/api/collab/workflow/definitions/import"),
      fakeRequest("POST", "/api/collab/workflow/definitions/import", {
        token: "member",
        origin: "http://127.0.0.1:33117",
        body: { workspaceId: "main", sourceMd },
      }),
    );
    expect(response.status).toBe(403);
    expect(current.definitions.size).toBe(0);
  });
});

describe("workflow apply", () => {
  it("registers routes, command, and tool", async () => {
    const current = tables();
    const routes: WebRouteLike[] = [];
    const registered: unknown[] = [];
    const provided: string[] = [];
    const ctx = {
      storageDomain: { open: async () => fakeDomain(current) },
      commands: {
        register: (definition: unknown) => registered.push(definition),
      },
      tools: { register: (definition: unknown) => registered.push(definition) },
      webServer: { register: (route: WebRouteLike) => routes.push(route) },
      provide: (key: string) => provided.push(key),
      effect: (operation: () => () => void) => operation()(),
      inject: (
        _keys: readonly string[],
        callback: (value: unknown) => void,
      ) => {
        callback({ collabTeam: team() });
      },
      get: () => team(),
    };
    await apply(ctx as unknown as Parameters<typeof apply>[0]);
    expect(provided).toEqual(["collabWorkflow"]);
    expect(routes).toHaveLength(21);
    expect(registered).toHaveLength(2);
    const tool = registered.find(
      (item) => (item as { name?: string }).name === "collab_workflow",
    ) as
      | {
          output: {
            schema: { type: string };
            render(
              args: unknown,
              value: string,
            ): Array<{ type: "text"; text: string }>;
          };
        }
      | undefined;
    expect(tool?.output).toMatchObject({ schema: { type: "string" } });
    expect(tool?.output.render({}, "ok")).toEqual([
      { type: "text", text: "ok" },
    ]);
  });
});
