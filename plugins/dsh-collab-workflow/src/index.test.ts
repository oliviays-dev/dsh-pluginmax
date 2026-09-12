import { readFile } from "node:fs/promises";
import type { ServerResponse } from "node:http";
import { beforeEach, describe, expect, it } from "vitest";
import {
  apply,
  createWorkflowRoutes,
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
    const warning = 'node "development" has an agent executor without responsible; workspace owner/admin will handle it';
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
    const instance = await service.startInstance(member, {
      workspaceId: "main",
      definitionId: second.id,
      title: "订单导出",
      sessionId: "session-a",
    });
    expect(instance.status).toBe("waiting");
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
    expect(routes).toHaveLength(18);
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
