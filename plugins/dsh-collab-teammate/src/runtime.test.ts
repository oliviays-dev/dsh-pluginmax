import { describe, expect, it } from "vitest";
import {
  isTaskRunning,
  normalizeTaskProgress,
  runningTeammateIds,
} from "./index.js";
import type { Teammate, TeammateEvent } from "./models.js";
import { TeammateRuntime } from "./runtime.js";
import { TeammateService, type KvTableLike } from "./service.js";

function memoryTable<V>(): KvTableLike<V> {
  const values = new Map<string, V>();
  return {
    get: (key) => values.get(key),
    entries: () => values.entries(),
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

const admin = { userId: "admin", name: "Admin", role: "admin" as const };
const olivia = { userId: "olivia", name: "Olivia", role: "member" as const };

describe("teammate task projection", () => {
  it("normalizes stored validation issue lists into readable progress", () => {
    expect(
      normalizeTaskProgress(
        '无法启动执行：[{"path":["tags",1],"message":"Too big: expected string to have <=32 characters"}]',
      ),
    ).toBe(
      "无法启动执行：Too big: expected string to have <=32 characters",
    );
    expect(normalizeTaskProgress("普通执行消息")).toBe("普通执行消息");
  });
});

interface FakeEmployee {
  id: string;
  kind: string;
  status: string;
  tags?: readonly string[];
  personaId?: string;
  displayName: string;
  managerEmployeeId: string;
}

function setup() {
  const teammates = new TeammateService({
    tables: {
      teammates: memoryTable<Teammate>(),
      events: memoryTable<TeammateEvent>(),
    },
  });
  const personas = new Map<string, unknown>();
  const employees = new Map<string, FakeEmployee>();
  const managers = new Map<string, FakeEmployee>([
    [
      "admin",
      {
        id: "human-admin",
        kind: "human",
        status: "active",
        displayName: "Admin",
        managerEmployeeId: "",
      },
    ],
    [
      "olivia",
      {
        id: "human-olivia",
        kind: "human",
        status: "active",
        displayName: "Olivia",
        managerEmployeeId: "",
      },
    ],
  ]);
  const roles: Array<{ employeeId: string; workspaceId: string; role: string }> = [];
  const runtimes: Array<{
    employeeId: string;
    workspaceId: string;
    legacyAgentProfileId?: string | undefined;
  }> = [];
  const agentProfiles: Array<{ id: string; personaId?: string }> = [];

  const runtime = new TeammateRuntime({
    teammates,
    personas: () => ({
      get: async (personaId) => {
        if (!personas.has(personaId)) throw new Error("persona not found");
        return personas.get(personaId);
      },
      create: async (input) => {
        personas.set(input.id, input);
        return input;
      },
    }),
    employees: () => ({
      getByAuthUserId: (authUserId) => managers.get(authUserId),
      createDigital: async (_actor, input) => {
        const id = `digital-${String(employees.size + 1)}`;
        employees.set(id, {
          id,
          kind: "digital",
          status: "draft",
          tags: input.tags ?? [],
          displayName: input.displayName,
          managerEmployeeId: input.managerEmployeeId,
          ...(input.personaId === undefined ? {} : { personaId: input.personaId }),
        });
        return { id };
      },
      changeStatus: async (_actor, employeeId, status) => {
        const employee = employees.get(employeeId);
        if (employee === undefined) throw new Error("employee not found");
        employee.status = status;
        return employee;
      },
      assignRole: async (_actor, input) => {
        roles.push({
          employeeId: input.employeeId,
          workspaceId: input.workspaceId,
          role: input.role,
        });
        return input;
      },
      upsertRuntimeProfile: async (_actor, input) => {
        const record = {
          id: `runtime-${String(runtimes.length + 1)}`,
          ...input,
        };
        runtimes.push(record);
        return record;
      },
      workflowTarget: (employeeId, workspaceId) => {
        const employee = employees.get(employeeId);
        const profile = runtimes.find(
          (item) =>
            item.employeeId === employeeId && item.workspaceId === workspaceId,
        );
        if (
          employee === undefined ||
          employee.status !== "active" ||
          profile === undefined ||
          profile.legacyAgentProfileId === undefined
        ) {
          return undefined;
        }
        return { employee, profile };
      },
    }),
    agents: () => ({
      createProfile: async (_actor, input) => {
        const record = {
          id: `agent-${String(agentProfiles.length + 1)}`,
          ...(input.personaId === undefined ? {} : { personaId: input.personaId }),
        };
        agentProfiles.push(record);
        return record;
      },
    }),
  });
  return { teammates, runtime, personas, employees, roles, runtimes, agentProfiles };
}

async function activeTeammate(
  teammates: TeammateService,
  source: "platform" | "personal",
): Promise<Teammate> {
  const actor = source === "platform" ? admin : olivia;
  const draft = await teammates.create(actor, { source, name: "测小白" });
  await teammates.update(actor, {
    teammateId: draft.id,
    name: "测小白",
    role: "测试",
    soul: "只做验证。",
  });
  return teammates.changeState(actor, {
    teammateId: draft.id,
    state: "active",
  });
}

describe("teammate runtime provisioning", () => {
  it("only exposes active teammates that the actor may use", async () => {
    const { teammates, runtime } = setup();
    const platform = await activeTeammate(teammates, "platform");
    const personal = await activeTeammate(teammates, "personal");
    const draft = await teammates.create(admin, { source: "platform" });
    expect(runtime.assignable(admin).map((item) => item.id)).toEqual([
      platform.id,
    ]);
    expect(runtime.assignable(olivia).map((item) => item.id).sort()).toEqual(
      [platform.id, personal.id].sort(),
    );
    expect(runtime.assignable(admin).some((item) => item.id === draft.id)).toBe(
      false,
    );
    const otherPersonal = await teammates.create(
      { userId: "peter", name: "Peter", role: "member" },
      { source: "personal" },
    );
    await teammates.update(
      { userId: "peter", name: "Peter", role: "member" },
      { teammateId: otherPersonal.id, name: "Peter 分身" },
    );
    await teammates.changeState(
      { userId: "peter", name: "Peter", role: "member" },
      { teammateId: otherPersonal.id, state: "active" },
    );
    expect(
      runtime.assignable(olivia).some((item) => item.id === otherPersonal.id),
    ).toBe(false);
  });

  it("refuses to dispatch a teammate that is not active", async () => {
    const { teammates, runtime } = setup();
    const draft = await teammates.create(admin, { source: "platform" });
    await expect(
      runtime.ensureRuntime({
        teammateId: draft.id,
        workspaceId: "workspace-1",
        actor: admin,
      }),
    ).rejects.toMatchObject({ code: "conflict" });
  });

  it("provisions one runtime identity and reuses it for later tasks", async () => {
    const { teammates, runtime, personas, employees, roles, runtimes, agentProfiles } =
      setup();
    const platform = await activeTeammate(teammates, "platform");
    const ensured = await runtime.ensureRuntime({
      teammateId: platform.id,
      workspaceId: "workspace-1",
      actor: admin,
    });
    expect(ensured.employeeId).toBe("digital-1");
    expect(ensured.profileId).toBe("agent-1");
    expect(personas.has(`persona-${platform.id}`)).toBe(true);
    expect(agentProfiles).toHaveLength(1);
    expect(employees.size).toBe(1);
    const employee = employees.get("digital-1");
    expect(employee?.tags).toEqual([
      "ai-teammate",
      expect.stringMatching(/^ai-teammate:/),
    ]);
    expect(employee?.tags?.every((tag) => tag.length <= 32)).toBe(true);
    expect(roles).toEqual([
      { employeeId: "digital-1", workspaceId: "workspace-1", role: "member" },
    ]);
    expect(runtimes).toHaveLength(1);
    expect(teammates.get(platform.id).employeeId).toBe("digital-1");

    const again = await runtime.ensureRuntime({
      teammateId: platform.id,
      workspaceId: "workspace-1",
      actor: admin,
    });
    expect(again).toEqual(ensured);
    expect(agentProfiles).toHaveLength(1);
    expect(employees.size).toBe(1);
    expect(runtimes).toHaveLength(1);
  });

  it("uses the owner as manager for personal avatars", async () => {
    const { teammates, runtime, employees } = setup();
    const personal = await activeTeammate(teammates, "personal");
    const ensured = await runtime.ensureRuntime({
      teammateId: personal.id,
      workspaceId: "workspace-1",
      actor: olivia,
    });
    expect(employees.get(ensured.employeeId)?.managerEmployeeId).toBe(
     "human-olivia",
    );
  });
});

describe("task running state", () => {
  it("only reports running while the latest run is still active", () => {
    expect(
      isTaskRunning({
        messages: [
          { content: "已接收指令，正在执行…", runId: "r1", state: "running" },
          { content: "运行超时，已中止", runId: "r1", state: "timeout" },
        ],
      }),
    ).toBe(false);
    expect(
      isTaskRunning({
        messages: [
          { content: "上一轮完成", runId: "r1", state: "succeeded" },
          { content: "新一轮已接收", runId: "r2", state: "queued" },
        ],
      }),
    ).toBe(true);
    expect(
      isTaskRunning({
        messages: [{ content: "只是讨论", state: "failed" }],
      }),
    ).toBe(false);
    expect(isTaskRunning({ messages: [] })).toBe(false);
    expect(isTaskRunning({})).toBe(false);
  });

  it("marks teammates that own at least one running task", () => {
    expect(
      runningTeammateIds({
        teammates: [
          { id: "tm-1" },
          { id: "tm-2" },
          { id: "tm-3", employeeId: "digital-9" },
        ],
        tasks: [
          {
            receiverType: "agent",
            receiverId: "tm-1",
            messages: [
              { content: "已接收指令，正在执行…", runId: "r1", state: "running" },
            ],
          },
          {
            receiverType: "agent",
            receiverId: "tm-2",
            messages: [
              { content: "运行超时，已中止", runId: "r2", state: "cancelled" },
            ],
          },
          {
            receiverType: "agent",
            receiverId: "digital-9",
            messages: [{ content: "排队中", runId: "r3", state: "queued" }],
          },
          {
            receiverType: "human",
            receiverId: "tm-1",
            messages: [
              { content: "人类任务", runId: "r4", state: "running" },
            ],
          },
        ],
      }),
    ).toEqual(["tm-1", "tm-3"]);
  });
});
