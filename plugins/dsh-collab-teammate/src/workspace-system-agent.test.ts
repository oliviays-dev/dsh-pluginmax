import { describe, expect, it } from "vitest";
import type { Teammate, TeammateEvent, TeammateTemplate } from "./models.js";
import { personaIdFor, TeammateRuntime } from "./runtime.js";
import {
  TeammateService,
  TeammateTemplateService,
  type KvTableLike,
} from "./service.js";

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

const admin = {
  userId: "admin",
  name: "Admin",
  role: "admin" as const,
};
const member = {
  userId: "member",
  name: "Member",
  role: "member" as const,
};

async function setup() {
  const templates = new TeammateTemplateService({
    tables: { templates: memoryTable<TeammateTemplate>() },
  });
  const teammates = new TeammateService({
    tables: {
      teammates: memoryTable<Teammate>(),
      events: memoryTable<TeammateEvent>(),
    },
    templates,
  });
  await teammates.ensureSeededPlatformTemplate({
    templateId: "sys-task-planner",
    systemKey: "task-planner",
    name: "任务规划伙伴",
    role: "需求理解与任务拆解",
    tools: [],
    skillBindings: [
      {
        skillId: "skill-task-planning-core",
        versionConstraint: "^1",
        mode: "required",
        scenes: ["task-planning"],
        enabled: true,
      },
    ],
  });
  const runtime = new TeammateRuntime({
    teammates,
    templates: () => templates,
    personas: () => undefined,
    employees: () => undefined,
    agents: () => undefined,
    team: () => ({
      members: (workspaceId) =>
        workspaceId === "ws-1"
          ? [{ userId: "member" }, { userId: "admin" }]
          : [],
    }),
  });
  return { teammates, templates, runtime };
}

describe("workspace task planner", () => {
  it("creates one protected workspace-bound platform planner", async () => {
    const { teammates, templates } = await setup();
    const first = await teammates.ensureWorkspaceSystemAgent({
      workspaceId: "ws-1",
      systemKey: "task-planner",
      actor: admin,
    });
    expect(first).toMatchObject({
      id: "tm-workspace-task-planner-ws-1",
      source: "platform",
      ownerUserId: "platform",
      systemKey: "task-planner",
      templateId: "sys-task-planner",
      workspaceBinding: {
        workspaceId: "ws-1",
        roleKey: "task-planner",
        managedBy: "platform",
        visibility: "workspace",
      },
      protected: {
        deletable: false,
        archivable: false,
        templateSwitchable: false,
      },
    });
    const personaId = personaIdFor(first.id);
    expect(personaId.length).toBeLessThanOrEqual(64);
    expect(personaId).toMatch(/^[a-zA-Z0-9][a-zA-Z0-9._-]*$/);
    const again = await teammates.ensureWorkspaceSystemAgent({
      workspaceId: "ws-1",
      systemKey: "task-planner",
      actor: admin,
    });
    expect(again.id).toBe(first.id);
    expect(teammates.workspaceAgentFor("ws-1")?.id).toBe(first.id);
    expect(teammates.projectManagerFor("ws-1")).toBeUndefined();
    expect(templates.get("sys-task-planner")?.systemKey).toBe("task-planner");
    await expect(
      teammates.ensureWorkspaceSystemAgent({
        workspaceId: "ws-1",
        systemKey: "task-planner",
        actor: { ...member, role: "guest" },
      }),
    ).rejects.toMatchObject({ code: "forbidden" });
  });

  it("makes workspace planners visible and assignable only in their workspace", async () => {
    const { teammates, runtime } = await setup();
    const planner = await teammates.ensureWorkspaceSystemAgent({
      workspaceId: "ws-1",
      systemKey: "task-planner",
      actor: admin,
    });
    const visible = teammates.listInstances(member, {
      visibleWorkspaceIds: new Set(["ws-1"]),
    });
    expect(visible.map((item) => item.id)).toContain(planner.id);
    expect(
      teammates
        .listInstances(member, {
          visibleWorkspaceIds: new Set(["ws-2"]),
        })
        .map((item) => item.id),
    ).not.toContain(planner.id);
    expect(runtime.assignable(member, "ws-1").map((item) => item.id)).toContain(
      planner.id,
    );
    expect(
      runtime.assignable(member, "ws-2").map((item) => item.id),
    ).not.toContain(planner.id);
    expect(runtime.isWorkspaceManagedAgent(planner.id, "ws-1")).toBe(true);
    expect(runtime.isWorkspaceManagedAgent(planner.id, "ws-2")).toBe(false);
    await expect(
      teammates.bindPrincipal(member, planner.id, "principal-planner", {
        allowProjectMember: true,
        projectWorkspaceId: "ws-1",
      }),
    ).resolves.toMatchObject({
      id: planner.id,
      principalId: "principal-planner",
    });
    await expect(
      teammates.bindPrincipal(member, planner.id, "principal-wrong", {
        allowProjectMember: true,
        projectWorkspaceId: "ws-2",
      }),
    ).rejects.toMatchObject({ code: "forbidden" });
  });
});
