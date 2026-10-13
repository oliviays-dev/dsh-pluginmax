import { describe, expect, it } from "vitest";
import {
  TeammateService,
  TeammateTemplateService,
  canManageInstance,
  canManageTeammate,
  migrateTeammateTemplates,
  nextVersion,
  type KvTableLike,
  type TeammateTemplateTables,
  type TeammateTables,
} from "./service.js";
import type {
  Teammate,
  TeammateEvent,
  TeammateTemplate,
  ProfileTemplate,
} from "./models.js";
import { calculateTeammateActivity } from "./index.js";

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

function templateService(): TeammateTemplateService {
  return new TeammateTemplateService({
    tables: {
      templates: memoryTable<TeammateTemplate>(),
    } satisfies TeammateTemplateTables,
  });
}

function service(
  tables?: TeammateTables,
  templates = templateService(),
): TeammateService {
  return new TeammateService({
    tables: tables ?? {
      teammates: memoryTable<Teammate>(),
      events: memoryTable<TeammateEvent>(),
    },
    templates,
  });
}

function definition(
  id: string,
  source: Teammate["source"],
  state: Teammate["state"],
  name = id,
): Teammate {
  const at = new Date(0).toISOString();
  return {
    id,
    source,
    name,
    role: "",
    ownerUserId: "owner",
    ownerName: source === "platform" ? "平台" : "Owner",
    description: "",
    soul: "",
    scenarios: [],
    goals: [],
    avatar: "",
    state,
    version: "v1.0",
    createdBy: "test",
    createdAt: at,
    updatedAt: at,
  };
}

const olivia = { userId: "olivia", name: "Olivia", role: "member" as const };
const admin = { userId: "admin", name: "Admin", role: "admin" as const };
const peter = { userId: "peter", name: "Peter", role: "member" as const };

describe("dsh-collab-teammate service", () => {
  it("calculates the 24h task runtime and deduplicates meetings", () => {
    const now = new Date("2026-10-09T12:00:00.000Z");
    const iso = (hours: number) =>
      new Date(now.getTime() + hours * 3_600_000).toISOString();
    const teammate = { id: "tm-1", employeeId: "emp-1" };
    const agents = {
      runs: ({ instanceId }: { readonly instanceId?: string | undefined }) => {
        const all = [
          {
            id: "run-1",
            instanceId: "task-overlap",
            status: "succeeded",
            runSeq: 1,
            nodeId: "development",
            startedAt: iso(-25),
            endedAt: iso(-23),
            createdAt: iso(-25),
          },
          {
            id: "run-2",
            instanceId: "task-waiting",
            status: "waiting_input",
            runSeq: 1,
            nodeId: "development",
            startedAt: iso(-2),
            updatedAt: iso(-1),
            createdAt: iso(-2),
          },
        ];
        return instanceId === undefined
          ? all
          : all.filter((run) => run.instanceId === instanceId);
      },
    };
    const meetings = {
      list: (workspaceId: string) =>
        workspaceId === "main"
          ? [
              { id: "meeting-1", status: "active" },
              { id: "meeting-2", status: "active" },
            ]
          : [],
      participants: (meetingId: string) =>
        meetingId === "meeting-1"
          ? [
              {
                id: "p-1",
                meetingId,
                kind: "agent",
                refId: "worker",
                personaId: "persona-tm-1",
                status: "active",
                joinedAt: iso(-3),
                updatedAt: iso(-3),
              },
              {
                id: "p-2",
                meetingId,
                kind: "agent",
                refId: "worker",
                personaId: "persona-tm-1",
                status: "left",
                joinedAt: iso(-1),
                leftAt: iso(-0.5),
                updatedAt: iso(-0.5),
              },
            ]
          : [
              {
                id: "p-3",
                meetingId,
                kind: "agent",
                refId: "worker",
                personaId: "persona-other",
                status: "active",
                joinedAt: iso(-3),
                updatedAt: iso(-3),
              },
            ],
    };
    const activity = calculateTeammateActivity({
      teammates: [teammate],
      tasks: [
        {
          id: "task-overlap",
          workspaceId: "main",
          title: "Overlap",
          status: "review",
          receiverType: "agent",
          receiverId: "tm-1",
          createdAt: iso(-25),
          updatedAt: iso(-23),
        },
        {
          id: "task-waiting",
          workspaceId: "main",
          title: "Waiting",
          status: "progress",
          receiverType: "agent",
          receiverId: "emp-1",
          createdAt: iso(-2),
          updatedAt: iso(-1),
        },
      ],
      agents,
      meetings,
      workspaces: { list: () => [{ id: "main" }] },
      identities: new Map([["tm-1", { personaId: "persona-tm-1" }]]),
      now,
    });

    expect(activity).toEqual([
      {
        teammateId: "tm-1",
        instance: { runtimeHours: 2, meetingCount: 0, outputTokens: 0 },
        template: { runtimeHours: 2, meetingCount: 1, outputTokens: 0 },
        templateShared: false,
      },
    ]);
  });

  it("counts workflow runs through the teammate's bound Agent Profile", () => {
    const now = new Date("2026-10-09T12:00:00.000Z");
    const iso = (hours: number) =>
      new Date(now.getTime() + hours * 3_600_000).toISOString();
    const agents = {
      marker: "bound",
      runs({ instanceId }: { readonly instanceId?: string | undefined }) {
        expect(this.marker).toBe("bound");
        if (instanceId !== undefined && instanceId !== "wf-1") return [];
        return [
          {
            id: "run-1",
            instanceId: "wf-1",
            agentProfileId: "backend-agent",
            status: "succeeded",
            runSeq: 1,
            nodeId: "development",
            outputTokens: 120,
            startedAt: iso(-5),
            endedAt: iso(-4),
            createdAt: iso(-5),
          },
          {
            id: "run-2",
            instanceId: "wf-1",
            agentProfileId: "backend-agent",
            status: "succeeded",
            runSeq: 2,
            nodeId: "development",
            outputTokens: 80,
            startedAt: iso(-3),
            endedAt: iso(-2),
            createdAt: iso(-3),
          },
          {
            id: "run-other-node",
            instanceId: "wf-1",
            agentProfileId: "backend-agent",
            status: "succeeded",
            runSeq: 1,
            nodeId: "testing",
            outputTokens: 999,
            startedAt: iso(-2),
            endedAt: iso(-1),
            createdAt: iso(-2),
          },
        ];
      },
    };
    const activity = calculateTeammateActivity({
      teammates: [{ id: "tm-2", employeeId: "emp-2" }],
      tasks: [
        {
          id: "TSK-WORKFLOW-1",
          workspaceId: "main",
          title: "工作流开发任务",
          status: "progress",
          receiverType: "agent",
          receiverId: "backend-agent",
          workflow: { instanceId: "wf-1", nodeId: "development" },
          createdAt: iso(-6),
          updatedAt: iso(-1),
        },
        {
          id: "TSK-WORKFLOW-DUPLICATE",
          workspaceId: "main",
          title: "同一节点的重复任务投影",
          status: "progress",
          receiverType: "agent",
          receiverId: "backend-agent",
          workflow: { instanceId: "wf-1", nodeId: "development" },
          createdAt: iso(-6),
          updatedAt: iso(-1),
        },
      ],
      agents,
      workspaces: { list: () => [{ id: "main" }] },
      identities: new Map([
        ["tm-2", { profileId: "backend-agent", personaId: "persona-tm-2" }],
      ]),
      now,
    });

    // 运行态只认实例绑定（这些运行没有 employeeId，所以是 0）；
    // 定义态按模版汇总，包含该 profile 在窗口内的全部运行（含其他节点），
    // 但同一次运行不会因为重复的任务投影被重复计数。
    expect(activity).toEqual([
      {
        teammateId: "tm-2",
        instance: { runtimeHours: 0, meetingCount: 0, outputTokens: 0 },
        template: { runtimeHours: 3, meetingCount: 0, outputTokens: 1199 },
        templateShared: false,
      },
    ]);
  });

  it("splits runtime-instance stats from shared Agent template stats", () => {
    const now = new Date("2026-10-09T12:00:00.000Z");
    const iso = (hours: number) =>
      new Date(now.getTime() + hours * 3_600_000).toISOString();
    const agents = {
      runs() {
        return [
          {
            id: "run-template",
            instanceId: "wf-1",
            agentProfileId: "backend-agent",
            status: "succeeded",
            runSeq: 1,
            nodeId: "development",
            outputTokens: 1000,
            startedAt: iso(-3),
            endedAt: iso(-2),
            createdAt: iso(-3),
          },
          {
            id: "run-instance",
            instanceId: "TSK-1",
            agentProfileId: "backend-agent",
            employeeId: "emp-1",
            status: "succeeded",
            runSeq: 1,
            nodeId: "task",
            outputTokens: 300,
            startedAt: iso(-2),
            endedAt: iso(-1),
            createdAt: iso(-2),
          },
        ];
      },
    };
    const activity = calculateTeammateActivity({
      teammates: [
        { id: "tm-1", employeeId: "emp-1" },
        { id: "tm-2", employeeId: "emp-2" },
      ],
      tasks: [],
      agents,
      workspaces: { list: () => [{ id: "main" }] },
      identities: new Map([
        ["tm-1", { profileId: "backend-agent" }],
        ["tm-2", { profileId: "backend-agent" }],
      ]),
      now,
    });
    const [first, second] = activity;
    expect(first?.instance).toEqual({
      runtimeHours: 1,
      meetingCount: 0,
      outputTokens: 300,
    });
    expect(second?.instance).toEqual({
      runtimeHours: 0,
      meetingCount: 0,
      outputTokens: 0,
    });
    expect(first?.template).toEqual({
      runtimeHours: 2,
      meetingCount: 0,
      outputTokens: 1300,
    });
    expect(second?.template).toEqual({
      runtimeHours: 2,
      meetingCount: 0,
      outputTokens: 1300,
    });
    expect(first?.templateShared).toBe(true);
    expect(second?.templateShared).toBe(true);
  });

  it("creates instances from shared platform templates without copying ownership", async () => {
    const templates = templateService();
    const template = await templates.create(admin, {
      source: "platform",
      name: "Research Partner",
      role: "研究分析",
      description: "会前研究与结论总结",
      soul: "以证据优先，结论明确。",
      scenarios: ["会前提取分歧"],
      goals: ["减少研究时间"],
      tools: ["search", "notes"],
    });
    const teammates = new TeammateService({
      tables: {
        teammates: memoryTable<Teammate>(),
        events: memoryTable<TeammateEvent>(),
      },
      templates,
    });
    const created = await teammates.create(olivia, {
      templateId: template.id,
    });
    expect(created.templateId).toBe(template.id);
    expect(created.source).toBe("platform");
    expect(created.ownerUserId).toBe("olivia");
    expect(created.ownerName).toBe("Olivia");
    expect(created.state).toBe("inactive");
    expect(created.name).toBe("Research Partner");
    expect(canManageInstance(created, olivia)).toBe(true);
    expect(canManageInstance(created, peter)).toBe(false);
    expect(teammates.effectiveDefinitionOf(created)).toMatchObject({
      name: "Research Partner",
      role: "研究分析",
      soul: expect.stringContaining("证据优先"),
      scenarios: ["会前提取分歧"],
      source: "platform",
    });
    expect(teammates.viewOf(created)).toMatchObject({
      name: "Research Partner",
      role: "研究分析",
      soul: expect.stringContaining("证据优先"),
      source: "platform",
      ownerName: "Olivia",
      templateName: "Research Partner",
      templateSource: "platform",
    });
    const overridden = await teammates.updateInstanceProfile(olivia, {
      teammateId: created.id,
      name: "Olivia 的研究分身",
      description: "只属于这个实例的资料",
    });
    expect(teammates.viewOf(overridden)).toMatchObject({
      name: "Olivia 的研究分身",
      description: "只属于这个实例的资料",
      role: "研究分析",
      templateName: "Research Partner",
    });
    const active = await teammates.changeState(olivia, {
      teammateId: created.id,
      state: "active",
    });
    expect(active.state).toBe("active");
    await expect(
      teammates.changeState(peter, {
        teammateId: created.id,
        state: "paused",
      }),
    ).rejects.toMatchObject({ code: "forbidden" });
    const paused = await teammates.changeState(olivia, {
      teammateId: created.id,
      state: "paused",
    });
    expect(paused.state).toBe("paused");
    const archived = await teammates.changeState(olivia, {
      teammateId: created.id,
      state: "archived",
    });
    expect(archived.state).toBe("archived");
  });

  it("seeds the platform facilitator teammate once and keeps later edits", async () => {
    const tables = {
      teammates: memoryTable<Teammate>(),
      events: memoryTable<TeammateEvent>(),
    };
    const templates = templateService();
    const teammates = service(tables, templates);
    const seeded = await teammates.ensureSeededPlatformTeammate({
      id: "meeting-facilitator",
      name: "会议 Facilitator",
      role: "会议主持人",
      soul: "用中文收敛结论。",
    });
    expect(seeded).toMatchObject({
      id: "meeting-facilitator",
      source: "platform",
      state: "active",
      name: "会议 Facilitator",
    });
    expect(teammates.effectiveDefinitionOf(seeded)).toMatchObject({
      name: "会议 Facilitator",
      role: "会议主持人",
    });
    if (seeded.templateId === undefined) throw new Error("template not linked");

    // 管理员维护模版后再次 seed，不覆盖平台维护结果。
    await templates.update(admin, {
      templateId: seeded.templateId,
      name: "平台自定义 Facilitator",
    });
    await templates.changeState(admin, {
      templateId: seeded.templateId,
      state: "archived",
    });
    const again = await teammates.ensureSeededPlatformTeammate({
      id: "meeting-facilitator",
      name: "会议 Facilitator",
    });
    expect(again.id).toBe(seeded.id);
    expect(again.state).toBe("active");
    expect(templates.get(seeded.templateId)).toMatchObject({
      name: "平台自定义 Facilitator",
      state: "archived",
    });
  });

  it("switches an instance template reference without copying definition fields", async () => {
    const templates = templateService();
    const first = await templates.create(admin, {
      source: "platform",
      name: "Researcher",
      role: "研究",
      soul: "先查证再结论。",
    });
    const second = await templates.create(admin, {
      source: "platform",
      name: "Reviewer",
      role: "评审",
      soul: "先指出风险。",
    });
    const teammates = service(undefined, templates);
    const instance = await teammates.create(olivia, {
      templateId: first.id,
    });

    const switched = await teammates.switchTemplate(olivia, {
      teammateId: instance.id,
      templateId: second.id,
    });
    expect(switched).toMatchObject({
      templateId: second.id,
      role: "",
      soul: "",
    });
    expect(teammates.effectiveDefinitionOf(switched)).toMatchObject({
      role: "评审",
      soul: "先指出风险。",
      templateId: second.id,
    });
    await expect(
      teammates.switchTemplate(peter, {
        teammateId: instance.id,
        templateId: first.id,
      }),
    ).rejects.toMatchObject({ code: "forbidden" });
  });

  it("creates an inactive instance from a personal template and updates the template on save", async () => {
    const templates = templateService();
    const teammates = service(undefined, templates);
    const draft = await teammates.create(olivia, { source: "personal" });
    expect(draft.source).toBe("personal");
    expect(draft.ownerName).toBe("Olivia");
    expect(draft.state).toBe("inactive");
    expect(draft.version).toBe("v0.1");
    if (draft.templateId === undefined) throw new Error("template not linked");
    expect(templates.get(draft.templateId)?.state).toBe("active");

    const saved = await teammates.update(olivia, {
      teammateId: draft.id,
      name: "Research Avatar",
      role: "研究与会前分析",
      description: "会前资料整理",
      soul: "保留来源。",
      scenarios: ["会前研究：提取分歧"],
      goals: ["减少准备时间"],
      avatar: "berry",
    });
    expect(saved.state).toBe("inactive");
    expect(saved.version).toBe("v0.1");
    expect(templates.get(draft.templateId)).toMatchObject({
      role: "研究与会前分析",
      soul: "保留来源。",
      scenarios: ["会前研究：提取分歧"],
      goals: ["减少准备时间"],
      version: "v1.1",
    });

    const next = await teammates.update(olivia, {
      teammateId: draft.id,
      name: "Research Avatar",
    });
    expect(next.version).toBe("v0.1");
    expect(next.state).toBe("inactive");
    expect(templates.get(draft.templateId)?.version).toBe("v1.1");

    const events = teammates.events(draft.id);
    expect(events).toHaveLength(3);
    expect(events.map((event) => event.kind)).toEqual([
      "updated",
      "updated",
      "created",
    ]);
  });

  it("repairs historical duplicate names in the same template", async () => {
    const teammatesTable = memoryTable<Teammate>();
    const eventsTable = memoryTable<TeammateEvent>();
    const at = new Date(0).toISOString();
    const make = (
      id: string,
      state: Teammate["state"],
      profileTemplateId: string | undefined,
    ): Teammate => ({
      ...definition(id, "platform", state, "Backend Engineer"),
      createdAt: at,
      updatedAt: at,
      ...(profileTemplateId === undefined
        ? {}
        : { profileTemplateId }),
    });
    await teammatesTable.put("tm-first", make("tm-first", "active", "backend"));
    await teammatesTable.put("tm-second", make("tm-second", "active", "backend"));
    await teammatesTable.put("tm-third", make("tm-third", "paused", "backend"));
    await teammatesTable.put(
      "tm-archived",
      make("tm-archived", "archived", "backend"),
    );
    const teammates = service({
      teammates: teammatesTable,
      events: eventsTable,
    });

    // 任何入队操作都会先等待启动修复完成。
    await teammates.create(olivia, { source: "personal" });
    expect(
      ["tm-first", "tm-second", "tm-third"].map(
        (id) => teammatesTable.get(id)?.name,
      ),
    ).toEqual([
      "Backend Engineer",
      "Backend Engineer (2)",
      "Backend Engineer (3)",
    ]);
    expect(teammatesTable.get("tm-archived")?.name).toBe("Backend Engineer");
    expect(
      [...eventsTable.entries()]
        .map(([, event]) => event.message)
        .filter((message) => message.includes("修正历史重名")),
    ).toHaveLength(2);
  });

  it("materializes legacy templates idempotently and repairs owner projection", async () => {
    const teammatesTable = memoryTable<Teammate>();
    const templatesTable = memoryTable<TeammateTemplate>();
    const eventsTable = memoryTable<TeammateEvent>();
    const profilesTable = memoryTable<ProfileTemplate>();
    const make = (id: string, createdAt: string): Teammate => ({
      ...definition(id, "platform", "active", "Backend Engineer 01"),
      ownerUserId: "olivia",
      ownerName: "平台",
      personaId: "backend-soul",
      createdAt,
      updatedAt: createdAt,
    });
    await teammatesTable.put(
      "tm-legacy-later",
      make("tm-legacy-later", "2026-01-02T00:00:00.000Z"),
    );
    await teammatesTable.put(
      "tm-legacy-first",
      make("tm-legacy-first", "2026-01-01T00:00:00.000Z"),
    );
    await profilesTable.put("research-profile", {
      id: "research-profile",
      name: "Research Profile",
      role: "研究分析",
      description: "历史 Profile 资产",
      soul: "证据优先。",
      scenarios: ["资料研究"],
      goals: ["缩短研究时间"],
      tools: ["search"],
      state: "active",
      version: "v1.0",
      createdBy: "admin",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    });
    const options = {
      teammates: teammatesTable,
      templates: templatesTable,
      events: eventsTable,
      profileTemplates: profilesTable,
      users: [{ id: "olivia", name: "Olivia" }],
    } as const;

    await migrateTeammateTemplates(options);
    expect(templatesTable.get("backend-soul")).toMatchObject({
      source: "platform",
      name: "Backend Engineer 01",
      personaAlias: "backend-soul",
      state: "active",
    });
    expect(teammatesTable.get("tm-legacy-first")).toMatchObject({
      templateId: "backend-soul",
      ownerName: "Olivia",
    });
    expect(teammatesTable.get("tm-legacy-later")).toMatchObject({
      templateId: "backend-soul",
      ownerName: "Olivia",
    });
    expect(templatesTable.get("research-profile")).toMatchObject({
      source: "platform",
      name: "Research Profile",
      role: "研究分析",
      state: "active",
    });
    const eventCount = [...eventsTable.entries()].length;
    const templateCount = templatesTable.size;

    await migrateTeammateTemplates(options);
    expect(templatesTable.size).toBe(templateCount);
    expect([...eventsTable.entries()]).toHaveLength(eventCount);
  });

  it("allows same-named instances under one template and keeps them distinct by id", async () => {
    const templates = templateService();
    const template = await templates.create(admin, {
      source: "platform",
      name: "Backend Engineer",
    });
    const teammates = new TeammateService({
      tables: {
        teammates: memoryTable<Teammate>(),
        events: memoryTable<TeammateEvent>(),
      },
      templates,
    });
    const first = await teammates.create(olivia, {
      templateId: template.id,
    });
    const second = await teammates.create(peter, {
      templateId: template.id,
    });
    expect(first.id).not.toBe(second.id);
    expect(first.name).toBe(second.name);
    expect(first.ownerName).toBe("Olivia");
    expect(second.ownerName).toBe("Peter");
  });

  it("repairs legacy instances that share a persona template", async () => {
    const teammatesTable = memoryTable<Teammate>();
    const eventsTable = memoryTable<TeammateEvent>();
    const at = new Date(0).toISOString();
    const make = (id: string): Teammate => ({
      ...definition(id, "platform", "active", "Backend Engineer 01"),
      createdAt: at,
      updatedAt: at,
      personaId: "backend-soul",
    });
    await teammatesTable.put("tm-legacy-first", make("tm-legacy-first"));
    await teammatesTable.put("tm-legacy-second", make("tm-legacy-second"));
    const teammates = service({
      teammates: teammatesTable,
      events: eventsTable,
    });

    await teammates.create(olivia, { source: "personal" });
    expect(teammatesTable.get("tm-legacy-first")?.name).toBe(
      "Backend Engineer 01",
    );
    expect(teammatesTable.get("tm-legacy-second")?.name).toBe(
      "Backend Engineer 01 (2)",
    );
    // 自动同步不能因为同名而失败：顺延序号，否则一次同步失败会让整个列表接口 409。
    const imported = await teammates.importFromEmployee({
      employeeId: "backend-legacy-new",
      name: "backend engineer 01",
      role: "",
      state: "active",
      personaId: "backend-soul",
    });
    expect(imported.name).toBe("backend engineer 01 (3)");
  });

  it("resolves imported instance owners instead of hardcoding a user", async () => {
    const teammates = service();
    const owned = await teammates.importFromEmployee({
      employeeId: "emp-owned",
      name: "Imported Owned",
      role: "",
      state: "active",
      ownerUserId: "olivia",
    });
    expect(owned.ownerUserId).toBe("olivia");

    // 解析不到人类负责人时按平台托管处理，而不是落到某个具体账号。
    const unowned = await teammates.importFromEmployee({
      employeeId: "emp-unowned",
      name: "Imported Unowned",
      role: "",
      state: "active",
    });
    expect(unowned.ownerUserId).toBe("platform");
  });

  it("keeps the instance creator as owner when another admin edits it", async () => {
    const teammates = service();
    const secondAdmin = {
      userId: "admin-2",
      name: "Admin 2",
      role: "admin" as const,
    };
    const created = await teammates.create(admin, {
      source: "platform",
      name: "Platform DE",
    });
    // 草稿首次发布：发布者成为实例 owner。
    const published = await teammates.update(admin, {
      teammateId: created.id,
      name: "Platform DE",
    });
    expect(published.ownerUserId).toBe("admin");
    // 另一个管理员编辑：归属不转移。
    const edited = await teammates.update(secondAdmin, {
      teammateId: created.id,
      name: "Platform DE v2",
    });
    expect(edited.ownerUserId).toBe("admin");
  });

  it("maintains instance name and description without touching the persona", async () => {
    const teammates = service();
    const created = await teammates.create(admin, {
      source: "platform",
      name: "小白 PD (2)",
    });
    const published = await teammates.update(admin, {
      teammateId: created.id,
      name: "小白 PD (2)",
      role: "产品经理",
      soul: "保持人设内容不变",
    });
    const updated = await teammates.updateInstanceProfile(admin, {
      teammateId: created.id,
      name: "小白 PD · 供应链",
      description: "  负责供应链例外的预研与结论输出。  ",
    });
    expect(updated.name).toBe("小白 PD · 供应链");
    expect(updated.description).toBe("负责供应链例外的预研与结论输出。");
    // 人设内容、定义版本与状态都不受实例资料编辑影响。
    expect(updated.role).toBe(published.role);
    expect(updated.soul).toBe(published.soul);
    expect(updated.version).toBe(published.version);
    expect(updated.state).toBe(published.state);
    expect(teammates.events(created.id)[0]?.message).toBe(
      "将实例名称改为「小白 PD · 供应链」",
    );
    // 内容没变化时不写库、不记录事件。
    const same = await teammates.updateInstanceProfile(admin, {
      teammateId: created.id,
      name: " 小白 PD · 供应链 ",
      description: "负责供应链例外的预研与结论输出。",
    });
    expect(same.updatedAt).toBe(updated.updatedAt);
    expect(teammates.events(created.id)[0]?.message).toBe(
      "将实例名称改为「小白 PD · 供应链」",
    );
    await expect(
      teammates.updateInstanceProfile(admin, {
        teammateId: created.id,
        name: "   ",
        description: "",
      }),
    ).rejects.toMatchObject({ code: "invalid_input" });
    // 平台实例只有平台管理员可以维护资料。
    await expect(
      teammates.updateInstanceProfile(peter, {
        teammateId: created.id,
        name: "Hijack",
        description: "",
      }),
    ).rejects.toMatchObject({ code: "forbidden" });
  });

  it("lets the instance owner maintain a platform-sourced instance", async () => {
    // 模版的平台归属不代表实例归属：实例归创建人，owner 不是管理员也能维护实例资料。
    const teammatesTable = memoryTable<Teammate>();
    const imported: Teammate = {
      ...definition("tm-imported", "platform", "active", "导入的实例"),
      ownerUserId: "olivia",
      ownerName: "Olivia",
    };
    await teammatesTable.put(imported.id, imported);
    const teammates = service({
      teammates: teammatesTable,
      events: memoryTable<TeammateEvent>(),
    });
    const updated = await teammates.updateInstanceProfile(olivia, {
      teammateId: imported.id,
      name: "导入的实例（改）",
      description: "由实例 owner 维护",
    });
    expect(updated.name).toBe("导入的实例（改）");
    expect(updated.description).toBe("由实例 owner 维护");
    await expect(
      teammates.updateInstanceProfile(peter, {
        teammateId: imported.id,
        name: "Hijack",
        description: "",
      }),
    ).rejects.toMatchObject({ code: "forbidden" });
  });

  it("keeps personal definitions scoped to the owner", async () => {
    const teammates = service();
    const draft = await teammates.create(olivia, { source: "personal" });
    expect(canManageTeammate(draft, olivia)).toBe(true);
    expect(canManageTeammate(draft, peter)).toBe(false);
    await expect(
      teammates.update(peter, { teammateId: draft.id, name: "Hijack" }),
    ).rejects.toMatchObject({ code: "forbidden" });
    await expect(
      teammates.changeState(peter, {
        teammateId: draft.id,
        state: "archived",
      }),
    ).rejects.toMatchObject({ code: "forbidden" });
  });

  it("lets active users create instances from platform templates without gaining template edit rights", async () => {
    const templates = templateService();
    const platformTemplate = await templates.create(admin, {
      source: "platform",
      name: "Backend DE",
      role: "后端开发",
    });
    const teammates = service(undefined, templates);
    await expect(
      teammates.create(olivia, { source: "platform" }),
    ).rejects.toMatchObject({ code: "forbidden" });

    const platform = await teammates.create(olivia, {
      templateId: platformTemplate.id,
    });
    expect(platform.ownerName).toBe("Olivia");
    expect(canManageInstance(platform, olivia)).toBe(true);
    expect(canManageTeammate(platform, olivia)).toBe(false);
    await expect(
      teammates.update(olivia, {
        teammateId: platform.id,
        name: platform.name,
        role: "Hijack",
      }),
    ).rejects.toMatchObject({ code: "forbidden" });

    const saved = await teammates.update(admin, {
      teammateId: platform.id,
      name: platform.name,
      role: "后端开发",
    });
    expect(saved.state).toBe("inactive");
    expect(templates.get(platformTemplate.id)).toMatchObject({
      role: "后端开发",
      version: "v1.1",
    });
  });

  it("sorts definitions by source, state, then name", async () => {
    const teammatesTable = memoryTable<Teammate>();
    const teammates = service({
      teammates: teammatesTable,
      events: memoryTable<TeammateEvent>(),
    });
    const fixtures = [
      definition("platform-archived", "platform", "archived"),
      definition("platform-inactive", "platform", "inactive"),
      definition("platform-paused", "platform", "paused"),
      definition("platform-draft", "platform", "draft"),
      definition("platform-active-b", "platform", "active", "Beta"),
      definition("platform-active-a", "platform", "active", "Alpha"),
      definition("personal-archived", "personal", "archived"),
      definition("personal-active", "personal", "active"),
    ];
    for (const teammate of fixtures) {
      await teammatesTable.put(teammate.id, teammate);
    }

    expect(teammates.list().map((teammate) => teammate.id)).toEqual([
      "platform-active-a",
      "platform-active-b",
      "platform-draft",
      "platform-paused",
      "platform-inactive",
      "platform-archived",
      "personal-active",
      "personal-archived",
    ]);
  });

  it("enforces the instance state machine", async () => {
    const teammates = service();
    const draft = await teammates.create(olivia, { source: "personal" });
    expect(draft.state).toBe("inactive");

    await teammates.update(olivia, { teammateId: draft.id, name: "Ops" });
    const active = await teammates.changeState(olivia, {
      teammateId: draft.id,
      state: "active",
    });
    expect(active.state).toBe("active");

    const paused = await teammates.changeState(olivia, {
      teammateId: draft.id,
      state: "paused",
    });
    expect(paused.state).toBe("paused");

    const restarted = await teammates.changeState(olivia, {
      teammateId: draft.id,
      state: "active",
    });
    expect(restarted.state).toBe("active");

    const archived = await teammates.changeState(olivia, {
      teammateId: draft.id,
      state: "archived",
    });
    expect(archived.state).toBe("archived");

    await expect(
      teammates.changeState(olivia, { teammateId: draft.id, state: "active" }),
    ).rejects.toMatchObject({ code: "conflict" });
    expect(teammates.events(draft.id)[0]?.kind).toBe("archived");

    // 归档后可以「复原」成已失效，再正常生效
    const restored = await teammates.changeState(olivia, {
      teammateId: draft.id,
      state: "inactive",
    });
    expect(restored.state).toBe("inactive");
    expect(teammates.events(draft.id)[0]?.message).toContain("复原");
    const reactivated = await teammates.changeState(olivia, {
      teammateId: draft.id,
      state: "active",
    });
    expect(reactivated.state).toBe("active");
  });

  it("bumps definition versions predictably", () => {
    expect(nextVersion("v1.0")).toBe("v1.1");
    expect(nextVersion("v1.8")).toBe("v1.9");
    expect(nextVersion("v3.4")).toBe("v3.5");
    expect(nextVersion("unknown")).toBe("v1.0");
  });
});
