import { describe, expect, it } from "vitest";
import {
  EmployeeService,
  createEmployeeRoutes,
  type WebRouteLike,
} from "./index.js";
import type {
  ActionTicket,
  AuditEvent,
  Delegation,
  DelegationReport,
  Employee,
  RoleAssignment,
  RuntimeProfile,
} from "./models.js";

class Table<V> {
  readonly records = new Map<string, V>();
  get(key: string): V | undefined {
    return this.records.get(key);
  }
  entries(): IterableIterator<[string, V]> {
    return this.records.entries();
  }
  get size(): number {
    return this.records.size;
  }
  async put(key: string, value: V): Promise<void> {
    this.records.set(key, value);
  }
}

interface Tables {
  employees: Table<Employee>;
  roleAssignments: Table<RoleAssignment>;
  runtimeProfiles: Table<RuntimeProfile>;
  delegations: Table<Delegation>;
  delegationReports: Table<DelegationReport>;
  actionTickets: Table<ActionTicket>;
  auditEvents: Table<AuditEvent>;
}

const now = () => new Date("2026-09-12T01:02:03.456Z");

function tables(): Tables {
  return {
    employees: new Table(),
    roleAssignments: new Table(),
    runtimeProfiles: new Table(),
    delegations: new Table(),
    delegationReports: new Table(),
    actionTickets: new Table(),
    auditEvents: new Table(),
  };
}

function team(users: Array<[string, string]> = [["gui-owner", "Olivia Yang"]]) {
  return {
    users: () => users.map(([id, name]) => ({ id, name })),
    resolveToken: (token: string) =>
      token === "admin"
        ? { userId: "gui-owner", role: "admin" as const }
        : token === "member"
          ? { userId: "gui-member", role: "member" as const }
          : undefined,
    members: (workspaceId: string) =>
      workspaceId === "ws-core"
        ? [{ userId: "gui-owner", memberRole: "owner" as const }]
        : [],
  };
}

function personaRegistry(ids: readonly string[] = [
  "backend-engineer",
  "arch-reviewer",
]) {
  const known = new Set(ids);
  return {
    get: async (personaId: string) => {
      if (!known.has(personaId)) throw new Error("persona is unreadable");
      return { id: personaId, name: personaId };
    },
  };
}

function service(users?: Array<[string, string]>) {
  const storage = tables();
  const personas = personaRegistry();
  const employeeService = new EmployeeService(storage, {
    now,
    personas: () => personas,
  });
  return { employeeService, personas, storage, team: team(users) };
}

async function createBackend(
  employeeService: EmployeeService,
  options: { status?: "active" } = {},
) {
  await employeeService.syncIdentityUsers(team().users());
  const digital = await employeeService.createDigital("gui-owner", {
    employeeId: "backend-01",
    displayName: "Backend Engineer 01",
    personaId: "backend-engineer",
    managerEmployeeId: "gui-owner",
  });
  if (options.status === "active") {
    return employeeService.changeStatus("gui-owner", digital.id, "active");
  }
  return digital;
}

async function response(
  route: WebRouteLike,
  init: { method: string; token?: string; body?: unknown },
) {
  const payload = {
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
  await route.handler(
    {
      method: init.method,
      ...(init.body === undefined
        ? {}
        : {
            [Symbol.asyncIterator]: async function* () {
              yield Buffer.from(JSON.stringify(init.body), "utf8");
            },
          }),
      url: "/",
      headers: {
        host: "127.0.0.1:33117",
        origin: "http://127.0.0.1:33117",
        ...(init.token === undefined
          ? {}
          : { authorization: `Bearer ${init.token}` }),
      },
    } as unknown as Parameters<WebRouteLike["handler"]>[0],
    payload as unknown as Parameters<WebRouteLike["handler"]>[1],
  );
  return {
    status: payload.status,
    body: payload.body === "" ? null : JSON.parse(payload.body),
  };
}

describe("digital employee lifecycle", () => {
  it("maps login accounts and creates a Digital Employee without login capability", async () => {
    const { employeeService, team } = service([
      ["gui-owner", "Olivia Yang"],
      ["gui-member", "Lee Gong"],
    ]);
    await employeeService.syncIdentityUsers(team.users());
    await employeeService.syncIdentityUsers([
      { id: "gui-owner", name: "Olivia" },
    ]);
    expect(employeeService.getByAuthUserId("gui-owner")).toMatchObject({
      id: "gui-owner",
      kind: "human",
      authUserId: "gui-owner",
      displayName: "Olivia",
    });
    const digital = await createBackend(employeeService, { status: "active" });
    expect(digital).toMatchObject({
      id: "backend-01",
      kind: "digital",
      status: "active",
    });
    expect(digital.authUserId).toBeUndefined();
    expect(team.users().some((user) => user.id === digital.id)).toBe(false);
  });

  it("requires Digital Employee personas to exist", async () => {
    const { employeeService } = service();
    await employeeService.syncIdentityUsers(team().users());
    await expect(
      employeeService.createDigital("gui-owner", {
        employeeId: "invalid-persona",
        displayName: "Invalid Persona",
        personaId: "missing-persona",
        managerEmployeeId: "gui-owner",
      }),
    ).rejects.toThrow("persona does not exist: missing-persona");
    expect(employeeService.list().find((item) => item.id === "invalid-persona"))
      .toBeUndefined();
  });

  it("enforces lifecycle transitions and blocks archived dispatch", async () => {
    const { employeeService } = service();
    const digital = await createBackend(employeeService);
    await expect(
      employeeService.changeStatus("gui-owner", digital.id, "active"),
    ).resolves.toMatchObject({ status: "active" });
    await employeeService.assignRole("gui-owner", {
      employeeId: digital.id,
      workspaceId: "ws-core",
      role: "member",
    });
    await employeeService.upsertRuntimeProfile("gui-owner", {
      employeeId: digital.id,
      workspaceId: "ws-core",
      name: "backend runtime",
    });
    expect(() =>
      employeeService.assertDispatchable(digital.id, "ws-core"),
    ).not.toThrow();
    await employeeService.changeStatus("gui-owner", digital.id, "suspended");
    expect(
      employeeService.workflowDispatchBlockReason(digital.id, "ws-core"),
    ).toBe("Digital Employee「Backend Engineer 01」已暂停，不能派发");
    await expect(
      employeeService.changeStatus("gui-owner", digital.id, "active"),
    ).resolves.toMatchObject({ status: "active" });
    await employeeService.changeStatus("gui-owner", digital.id, "archived");
    await expect(
      employeeService.changeStatus("gui-owner", digital.id, "active"),
    ).rejects.toThrow("cannot change employee from archived to active");
    expect(() =>
      employeeService.assertDispatchable(digital.id, "ws-core"),
    ).toThrow("employee is archived; dispatch is blocked");
  });
});

describe("runtime authorization", () => {
  it("intersects role, runtime, and requested actions; deny wins and tickets stay scoped", async () => {
    const { employeeService } = service();
    await employeeService.syncIdentityUsers(team().users());
    const digital = await createBackend(employeeService, { status: "active" });
    await employeeService.assignRole("gui-owner", {
      employeeId: digital.id,
      workspaceId: "ws-core",
      role: "member",
      permissions: ["read", "write", "tool:read", "tool:danger"],
    });
    await employeeService.upsertRuntimeProfile("gui-owner", {
      employeeId: digital.id,
      workspaceId: "ws-core",
      name: "scoped backend",
      allowedTools: ["tool:read"],
      deniedTools: ["tool:danger"],
      resourceScopes: ["repo/alpha"],
      maxMinutes: 30,
    });
    const ticket = await employeeService.issueRuntimeTicket("gui-owner", {
      employeeId: digital.id,
      workspaceId: "ws-core",
      contextType: "task",
      contextId: "task-01",
      requestedActions: [
        "read",
        "write",
        "approve",
        "tool:read",
        "tool:danger",
      ],
      resourceScopes: ["repo/alpha/src", "repo/beta"],
    });
    expect(ticket.allowedActions).toEqual(["read", "write", "tool:read"]);
    expect(ticket.deniedActions).toEqual(["tool:danger"]);
    expect(ticket.resourceScopes).toEqual(["repo/alpha/src"]);
    await expect(
      employeeService.authorizeTicket({
        ticketId: ticket.id,
        action: "read",
        workspaceId: "ws-core",
        contextType: "task",
        contextId: "task-01",
      }),
    ).resolves.toMatchObject({ employeeId: digital.id, source: "runtime" });
    await expect(
      employeeService.authorizeTicket({
        ticketId: ticket.id,
        action: "tool:danger",
        workspaceId: "ws-core",
        contextType: "task",
        contextId: "task-01",
      }),
    ).rejects.toThrow("action is explicitly denied");
    await expect(
      employeeService.authorizeTicket({
        ticketId: ticket.id,
        action: "read",
        workspaceId: "ws-other",
        contextType: "task",
        contextId: "task-01",
      }),
    ).rejects.toThrow("ticket is revoked, expired, or outside this context");
    await expect(
      employeeService.authorizeTicket({
        ticketId: ticket.id,
        action: "read",
        workspaceId: "ws-core",
        contextType: "review",
        contextId: "task-01",
      }),
    ).rejects.toThrow("ticket is revoked, expired, or outside this context");
  });

  it("requires an explicit active Runtime Profile and disables the old active profile", async () => {
    const { employeeService } = service();
    const digital = await createBackend(employeeService, { status: "active" });
    await employeeService.assignRole("gui-owner", {
      employeeId: digital.id,
      workspaceId: "ws-core",
      role: "member",
    });
    expect(() =>
      employeeService.assertDispatchable(digital.id, "ws-core"),
    ).toThrow("active Runtime Profile is required");
    const first = await employeeService.upsertRuntimeProfile("gui-owner", {
      employeeId: digital.id,
      workspaceId: "ws-core",
      name: "first",
    });
    const second = await employeeService.upsertRuntimeProfile("gui-owner", {
      employeeId: digital.id,
      workspaceId: "ws-core",
      name: "second",
    });
    expect(
      employeeService
        .listProfiles({ employeeId: digital.id })
        .find((profile) => profile.id === first.id)?.status,
    ).toBe("disabled");
    expect(
      employeeService
        .listProfiles({ employeeId: digital.id })
        .find((profile) => profile.id === second.id)?.status,
    ).toBe("active");
  });
});

describe("human avatar delegation", () => {
  it("accepts a verified meeting workspace role without a duplicate employee assignment", async () => {
    const { employeeService } = service();
    await employeeService.syncIdentityUsers(team().users());
    await expect(
      employeeService.createDelegation("gui-owner", {
        workspaceId: "ws-core",
        contextType: "meeting",
        contextId: "meeting-verified-role",
        objective: "验证会议成员身份可以直接派遣",
        allowedActions: ["meeting.read", "meeting.speak"],
        speakPolicy: "mentions",
        approvalPolicy: "never",
      }),
    ).rejects.toThrow("owner must have an active workspace role");

    const delegation = await employeeService.createDelegation("gui-owner", {
      workspaceId: "ws-core",
      ownerWorkspaceRole: "member",
      contextType: "meeting",
      contextId: "meeting-verified-role",
      objective: "验证会议成员身份可以直接派遣",
      allowedActions: ["meeting.read", "meeting.speak"],
      speakPolicy: "mentions",
      approvalPolicy: "never",
    });
    expect(delegation).toMatchObject({
      ownerId: "gui-owner",
      workspaceId: "ws-core",
      status: "active",
    });
  });

  it("creates a restricted delegation, denies final approval, and blocks paused use", async () => {
    const { employeeService } = service();
    const digital = await createBackend(employeeService);
    await employeeService.changeStatus("gui-owner", digital.id, "active");
    await employeeService.assignRole("gui-owner", {
      employeeId: "gui-owner",
      workspaceId: "ws-core",
      role: "member",
      permissions: ["meeting.read", "meeting.speak", "approval.final"],
    });
    await employeeService.upsertRuntimeProfile("gui-owner", {
      employeeId: digital.id,
      workspaceId: "ws-core",
      name: "unused",
      status: "disabled",
    });
    const delegation = await employeeService.createDelegation("gui-owner", {
      displayName: "Olivia · Reviewer",
      workspaceId: "ws-core",
      contextType: "meeting",
      contextId: "meeting-01",
      objective: "核对新链路的审批边界",
      stance: "先补齐审计，再扩大导出范围",
      watchItems: ["跨工作区导出"],
      allowedActions: ["meeting.read", "meeting.speak", "approval.final"],
      speakPolicy: "mentions",
      approvalPolicy: "never",
    });
    expect(delegation.status).toBe("active");
    expect(delegation.deniedActions).toContain("approval.final");
    const ticket = await employeeService.issueDelegationTicket("gui-owner", {
      delegationId: delegation.id,
      requestedActions: ["meeting.read", "meeting.speak", "approval.final"],
    });
    expect(ticket.allowedActions).toEqual(["meeting.read", "meeting.speak"]);
    await expect(
      employeeService.authorizeTicket({
        ticketId: ticket.id,
        action: "meeting.speak",
        workspaceId: "ws-core",
        contextType: "meeting",
        contextId: "meeting-01",
      }),
    ).resolves.toMatchObject({
      source: "delegation",
      delegationId: delegation.id,
    });
    await expect(
      employeeService.authorizeTicket({
        ticketId: ticket.id,
        action: "approval.final",
        workspaceId: "ws-core",
        contextType: "meeting",
        contextId: "meeting-01",
      }),
    ).rejects.toThrow("action is explicitly denied");
    await employeeService.changeDelegationStatus(
      "gui-owner",
      delegation.id,
      "paused",
    );
    await expect(
      employeeService.issueDelegationTicket("gui-owner", {
        delegationId: delegation.id,
        requestedActions: ["meeting.speak"],
      }),
    ).rejects.toThrow("delegation or owner is unavailable");
  });

  it("does not fake a failed report and can retry with transcript", async () => {
    const { employeeService } = service();
    await employeeService.syncIdentityUsers(team().users());
    await employeeService.assignRole("gui-owner", {
      employeeId: "gui-owner",
      workspaceId: "ws-core",
      role: "member",
      permissions: ["meeting.read", "meeting.speak"],
    });
    const delegation = await employeeService.createDelegation("gui-owner", {
      workspaceId: "ws-core",
      contextType: "meeting",
      contextId: "meeting-01",
      objective: "汇总风险",
      allowedActions: ["meeting.read", "meeting.speak"],
      speakPolicy: "manual",
      approvalPolicy: "never",
    });
    const failed = await employeeService.generateDelegationReport(
      delegation.id,
      "",
    );
    expect(failed.status).toBe("failed");
    expect(failed.error).toBe("缺少会议记录，不能生成分身报告");
    const report = await employeeService.generateDelegationReport(
      delegation.id,
      "Olivia: 请补审计字段\nLee: 同意",
      { finalize: true },
    );
    expect(report.status).toBe("generated");
    expect(report.report).toContain("# 分身会议报告");
    expect(employeeService.getDelegation(delegation.id).status).toBe(
      "completed",
    );
  });
});

describe("employee HTTP surface", () => {
  it("keeps directory admin-only and Digital Employees non-login", async () => {
    const { employeeService, team } = service([
      ["gui-owner", "Olivia Yang"],
      ["gui-member", "Lee Gong"],
    ]);
    await employeeService.syncIdentityUsers(team.users());
    const routes = createEmployeeRoutes(employeeService, () => team);
    const create = routes.find(
      (route) => route.path === "/api/collab/employee/digital",
    )!;
    const denied = await response(create, {
      method: "POST",
      token: "member",
      body: {},
    });
    expect(denied.status).toBe(403);
    const created = await response(create, {
      method: "POST",
      token: "admin",
      body: {
        employeeId: "arch-reviewer",
        displayName: "Architecture Reviewer",
        personaId: "arch-reviewer",
        managerEmployeeId: "gui-owner",
      },
    });
    expect(created.status).toBe(201);
    expect(created.body.employee.authUserId).toBeUndefined();
    const status = routes.find(
      (route) => route.path === "/api/collab/employee/status",
    )!;
    const activated = await response(status, {
      method: "POST",
      token: "admin",
      body: { employeeId: "arch-reviewer", status: "active" },
    });
    expect(activated.status).toBe(200);
    expect(activated.body.employee.status).toBe("active");
    const directory = routes.find(
      (route) => route.path === "/api/collab/employee",
    )!;
    const forbidden = await response(directory, {
      method: "GET",
      token: "member",
    });
    const allowed = await response(directory, {
      method: "GET",
      token: "admin",
    });
    expect(forbidden.status).toBe(403);
    expect(allowed.body.employees.map((item: Employee) => item.id)).toContain(
      "arch-reviewer",
    );
  });

  it("allows only the delegation owner or admin to issue and close tickets", async () => {
    const { employeeService, team } = service([
      ["gui-owner", "Olivia Yang"],
      ["gui-member", "Lee Gong"],
    ]);
    await employeeService.syncIdentityUsers(team.users());
    await employeeService.assignRole("gui-owner", {
      employeeId: "gui-owner",
      workspaceId: "ws-core",
      role: "member",
      permissions: ["meeting.read", "meeting.speak"],
    });
    const delegation = await employeeService.createDelegation("gui-owner", {
      workspaceId: "ws-core",
      contextType: "meeting",
      contextId: "meeting-guard",
      objective: "验证委托权限边界",
      allowedActions: ["meeting.read", "meeting.speak"],
      speakPolicy: "manual",
      approvalPolicy: "never",
    });
    const routes = createEmployeeRoutes(employeeService, () => team);
    const issue = routes.find(
      (route) => route.path === "/api/collab/delegation/ticket",
    )!;
    const forbidden = await response(issue, {
      method: "POST",
      token: "member",
      body: {
        delegationId: delegation.id,
        requestedActions: ["meeting.speak"],
      },
    });
    expect(forbidden.status).toBe(403);
    const allowed = await response(issue, {
      method: "POST",
      token: "admin",
      body: {
        delegationId: delegation.id,
        requestedActions: ["meeting.speak"],
      },
    });
    expect(allowed.status).toBe(201);
    await expect(
      employeeService.extendDelegation("gui-owner", delegation.id, 30),
    ).resolves.toMatchObject({ status: "active" });
    await expect(
      employeeService.extendDelegation("gui-member", delegation.id, 30),
    ).rejects.toThrow("only the delegation owner or admin can extend it");
    const status = routes.find(
      (route) => route.path === "/api/collab/delegation/status",
    )!;
    const revoked = await response(status, {
      method: "POST",
      token: "admin",
      body: { delegationId: delegation.id, status: "revoked" },
    });
    expect(revoked.status).toBe(200);
    expect(employeeService.getDelegation(delegation.id).status).toBe("revoked");
  });

  it("aggregates governance data for admins only", async () => {
    const { employeeService, team } = service();
    await employeeService.syncIdentityUsers(team.users());
    const digital = await createBackend(employeeService, { status: "active" });
    await employeeService.assignRole("gui-owner", {
      employeeId: digital.id,
      workspaceId: "ws-core",
      role: "member",
      permissions: ["read", "write"],
    });
    const profile = await employeeService.upsertRuntimeProfile("gui-owner", {
      employeeId: digital.id,
      workspaceId: "ws-core",
      name: "task runtime",
      legacyAgentProfileId: "backend-agent",
    });
    await employeeService.issueRuntimeTicket("gui-owner", {
      employeeId: digital.id,
      workspaceId: "ws-core",
      contextType: "workflow",
      contextId: "instance-01",
      requestedActions: ["read", "write"],
    });
    const routes = createEmployeeRoutes(employeeService, () => team);
    const route = routes.find(
      (item) => item.path === "/api/collab/employee/governance",
    )!;
    const denied = await response(route, { method: "GET", token: "member" });
    const allowed = await response(route, { method: "GET", token: "admin" });
    expect(denied.status).toBe(403);
    expect(allowed.status).toBe(200);
    expect(allowed.body.employees.map((item: Employee) => item.id)).toContain(
      digital.id,
    );
    expect(
      allowed.body.profiles.map((item: RuntimeProfile) => item.id),
    ).toContain(profile.id);
    expect(allowed.body.tickets).toHaveLength(1);
    expect(allowed.body.audit.length).toBeGreaterThan(0);
  });

  it("expires delegations and tickets when their validity ends", async () => {
    let current = new Date("2026-09-12T01:00:00.000Z");
    const storage = tables();
    const employeeService = new EmployeeService(storage, {
      now: () => current,
    });
    await employeeService.syncIdentityUsers(team().users());
    await employeeService.assignRole("gui-owner", {
      employeeId: "gui-owner",
      workspaceId: "ws-core",
      role: "member",
      permissions: ["meeting.read", "meeting.speak"],
    });
    const delegation = await employeeService.createDelegation("gui-owner", {
      workspaceId: "ws-core",
      contextType: "meeting",
      contextId: "meeting-expiry",
      objective: "验证到期收敛",
      allowedActions: ["meeting.read", "meeting.speak"],
      speakPolicy: "manual",
      approvalPolicy: "never",
      durationMinutes: 1,
    });
    const ticket = await employeeService.issueDelegationTicket("gui-owner", {
      delegationId: delegation.id,
      requestedActions: ["meeting.speak"],
    });
    current = new Date("2026-09-12T01:02:00.000Z");
    const result = await employeeService.sweepExpired();
    expect(result).toEqual({ delegations: 1, tickets: 1 });
    expect(employeeService.getDelegation(delegation.id).status).toBe("expired");
    expect(storage.actionTickets.get(ticket.id)?.status).toBe("expired");
    expect(employeeService.listDelegationExpiryNotices("gui-owner")).toMatchObject([
      {
        delegationId: delegation.id,
        contextType: "meeting",
        contextId: "meeting-expiry",
        impact: "该会议中的自动发言和跟进已暂停。",
        suggestedActions: ["extend", "resume", "reassign"],
      },
    ]);
  });
});
