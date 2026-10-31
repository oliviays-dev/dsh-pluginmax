import { describe, expect, it } from "vitest";
import {
  TeammateService,
  TeammateTemplateService,
  canManageInstance,
  canManageTeammate,
  migrateTeammateTemplates,
  nextVersion,
  type KvTableLike,
  type TeammateActor,
  type TeammateTemplateTables,
  type TeammateTables,
} from "./service.js";
import type {
  Teammate,
  TeammateEvent,
  TeammateTemplate,
  ProfileTemplate,
} from "./models.js";
import {
  calculateInstanceLastUsedAt,
  calculateTeammateActivity,
  calculateTeammateWorkload,
  isInstanceOwnedPersona,
  taskIdsExecutedByPersona,
} from "./index.js";

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
        instance: { runtimeHours: 2, meetingCount: 1, outputTokens: 0 },
        template: { runtimeHours: 2, meetingCount: 1, outputTokens: 0 },
        templateShared: false,
      },
    ]);
  });

  it("keeps AI activity after a reviewed task is reassigned to a human", () => {
    const now = new Date("2026-10-09T12:00:00.000Z");
    const iso = (hours: number) =>
      new Date(now.getTime() + hours * 3_600_000).toISOString();
    const activity = calculateTeammateActivity({
      teammates: [
        {
          id: "tm-1",
          principalId: "principal-ai-tm-1",
        },
      ],
      tasks: [
        {
          id: "task-review",
          workspaceId: "main",
          title: "Review",
          status: "review",
          receiverType: "human",
          receiverId: "owner",
          receiverPrincipalId: "principal-ai-tm-1",
          createdAt: iso(-2),
          updatedAt: iso(-0.5),
        },
      ],
      agents: {
        runs: () => [
          {
            id: "run-1",
            instanceId: "task-review",
            agentProfileId: "agent-1",
            status: "succeeded",
            runSeq: 1,
            nodeId: "task",
            outputTokens: 321,
            startedAt: iso(-1),
            endedAt: iso(-0.5),
            createdAt: iso(-1),
          },
        ],
      },
      workspaces: { list: () => [{ id: "main" }] },
      identities: new Map([["tm-1", { profileId: "agent-1" }]]),
      now,
    });
    expect(activity[0]?.instance).toEqual({
      runtimeHours: 0.5,
      meetingCount: 0,
      outputTokens: 321,
    });
  });

  it("counts ai_teammate participants by their teammate instance id", () => {
    const now = () => new Date("2026-10-14T12:00:00.000Z");
    const meetings = {
      list: () => [{ id: "m-1", status: "active" }],
      participants: () => [
        {
          id: "p-1",
          meetingId: "m-1",
          kind: "ai_teammate",
          refId: "tm-1",
          teammateInstanceId: "tm-1",
          status: "active",
          joinedAt: "2026-10-14T10:00:00.000Z",
          updatedAt: "2026-10-14T10:00:00.000Z",
        },
      ],
    };
    const activity = calculateTeammateActivity({
      teammates: [{ id: "tm-1" }],
      tasks: [],
      meetings,
      workspaces: { list: () => [{ id: "main" }] },
      now: now(),
    });
    expect(activity[0]?.instance.meetingCount).toBe(1);
  });

  it("counts 1:1 AI chat runs and meetings from the default workspace", () => {
    const now = new Date("2026-10-29T12:00:00.000Z");
    const iso = (hours: number) =>
      new Date(now.getTime() + hours * 3_600_000).toISOString();
    const activity = calculateTeammateActivity({
      teammates: [
        {
          id: "tm-chat",
          principalId: "principal-ai-chat",
        },
        {
          id: "tm-sibling",
          employeeId: "employee-shared",
          principalId: "principal-ai-chat",
        },
      ],
      tasks: [],
      agents: {
        runs: ({ workspaceId }) =>
          workspaceId === "system.default"
            ? [
                {
                  id: "run-chat",
                  instanceId: "meeting-ai-chat",
                  principalId: "principal-ai-chat",
                  status: "succeeded",
                  nodeId: "meeting-ai-chat",
                  runSeq: 1,
                  outputTokens: 240,
                  payload: {
                    context: { teammateId: "tm-chat" },
                  },
                  startedAt: iso(-1),
                  endedAt: iso(-0.99),
                  createdAt: iso(-1),
                },
              ]
            : [],
      },
      meetings: {
        list: (workspaceId) =>
          workspaceId === "system.default"
            ? [
                { id: "meeting-ai-chat", status: "active" },
                { id: "meeting-sibling", status: "active" },
              ]
            : [],
        participants: (meetingId) => {
          if (meetingId === "meeting-sibling") {
            return [
              {
                id: "participant-sibling",
                meetingId,
                kind: "ai_teammate",
                refId: "tm-sibling",
                teammateInstanceId: "tm-sibling",
                personaId: "persona-chat",
                status: "active",
                joinedAt: iso(-1),
                updatedAt: iso(-0.99),
              },
            ];
          }
          return meetingId === "meeting-ai-chat"
            ? [
                {
                  id: "participant-ai",
                  meetingId,
                  kind: "ai_teammate",
                  refId: "tm-chat",
                  teammateInstanceId: "tm-chat",
                  status: "active",
                  joinedAt: iso(-1),
                  updatedAt: iso(-0.99),
                },
              ]
            : [];
        },
      },
      workspaces: { list: () => [{ id: "main" }] },
      identities: new Map([["tm-chat", { personaId: "persona-chat" }]]),
      now,
    });

    expect(activity[0]?.instance).toMatchObject({
      meetingCount: 1,
      outputTokens: 240,
    });
    expect(activity[0]?.instance.runtimeHours).toBeGreaterThan(0);
    expect(activity[1]?.instance).toMatchObject({
      meetingCount: 1,
      outputTokens: 0,
      runtimeHours: 0,
    });
  });

  it("does not activate sibling instances that share a runtime identity", () => {
    const now = new Date("2026-10-29T12:00:00.000Z");
    const iso = (hours: number) =>
      new Date(now.getTime() + hours * 3_600_000).toISOString();
    const primary = {
      ...definition("tm-primary", "personal", "active", "小白 PD"),
      employeeId: "employee-shared",
      principalId: "principal-ai-shared",
    };
    const sibling = {
      ...definition("tm-sibling", "platform", "active", "小白 PD (2)"),
      employeeId: "employee-shared",
      principalId: "principal-ai-shared",
    };
    const snapshot = calculateTeammateWorkload({
      teammates: [primary, sibling],
      tasks: [],
      agents: {
        runs: ({ workspaceId }) =>
          workspaceId === "system.default"
            ? [
                {
                  id: "run-chat",
                  instanceId: "meeting-chat",
                  employeeId: "employee-shared",
                  principalId: "principal-ai-shared",
                  status: "succeeded",
                  nodeId: "meeting-ai-chat",
                  runSeq: 1,
                  payload: {
                    context: { teammateId: primary.id },
                  },
                  startedAt: iso(-1),
                  endedAt: iso(-0.99),
                  createdAt: iso(-1),
                },
              ]
            : [],
      },
      meetings: {
        list: (workspaceId) =>
          workspaceId === "system.default"
            ? [{ id: "meeting-chat", status: "active" }]
            : [],
        participants: () => [
          {
            id: "participant-primary",
            meetingId: "meeting-chat",
            kind: "ai_teammate",
            refId: primary.id,
            teammateInstanceId: primary.id,
            status: "active",
            joinedAt: iso(-1),
            updatedAt: iso(-0.99),
          },
        ],
      },
      workspaces: { list: () => [{ id: "main" }] },
      identities: new Map([
        [primary.id, { profileId: "agent-primary" }],
        [sibling.id, { profileId: "agent-primary" }],
      ]),
      now,
    });
    const primaryItem = snapshot.items.find(
      (item) => item.teammateId === primary.id,
    );
    const siblingItem = snapshot.items.find(
      (item) => item.teammateId === sibling.id,
    );
    expect(primaryItem).toMatchObject({
      hasRunIn72h: true,
      last24h: { meetingCount: 1, taskCount: 0 },
    });
    expect(siblingItem).toMatchObject({
      hasRunIn72h: false,
      last24h: { meetingCount: 0, taskCount: 0 },
    });
  });

  it("sorts inactive AI partners by their latest meeting activity", () => {
    const now = new Date("2026-10-29T12:00:00.000Z");
    const iso = (hours: number) =>
      new Date(now.getTime() + hours * 3_600_000).toISOString();
    const idleOld = definition("tm-idle-old", "personal", "active", "旧伙伴");
    const idleRecent = definition(
      "tm-idle-new",
      "personal",
      "active",
      "新伙伴",
    );
    const snapshot = calculateTeammateWorkload({
      teammates: [idleOld, idleRecent],
      tasks: [],
      agents: { runs: () => [] },
      meetings: {
        list: (workspaceId) =>
          workspaceId === "system.default"
            ? [
                { id: "meeting-old", status: "active" },
                { id: "meeting-new", status: "active" },
              ]
            : [],
        participants: (meetingId) => [
          {
            id: `participant-${meetingId}`,
            meetingId,
            kind: "ai_teammate",
            refId:
              meetingId === "meeting-old" ? idleOld.id : idleRecent.id,
            teammateInstanceId:
              meetingId === "meeting-old" ? idleOld.id : idleRecent.id,
            status: "active",
            joinedAt: iso(meetingId === "meeting-old" ? -50 : -30),
            updatedAt: iso(meetingId === "meeting-old" ? -50 : -30),
          },
        ],
      },
      workspaces: { list: () => [{ id: "main" }] },
      now,
    });

    expect(snapshot.items.map((item) => item.teammateId)).toEqual([
      idleRecent.id,
      idleOld.id,
    ]);
    expect(snapshot.items[0]?.hasRunIn72h).toBe(false);
    expect(snapshot.items[0]?.lastActivityAt).toBe(iso(-30));
  });

  it("counts the facilitator seat as meeting attendance", () => {
    const meetings = {
      list: () => [{ id: "m-1", status: "active" }],
      participants: () => [],
      facilitators: () => [
        {
          teammateId: "meeting-facilitator",
          status: "active",
          createdAt: "2026-10-14T11:58:00.000Z",
          updatedAt: "2026-10-14T11:58:00.000Z",
        },
      ],
    };
    const activity = calculateTeammateActivity({
      teammates: [{ id: "meeting-facilitator" }],
      tasks: [],
      meetings,
      workspaces: { list: () => [{ id: "main" }] },
      now: new Date("2026-10-14T12:00:00.000Z"),
    });
    expect(activity[0]?.instance.meetingCount).toBe(1);
  });

  it("builds 24/72 hour AI partner workload with blockers", () => {
    const now = new Date("2026-10-14T12:00:00.000Z");
    const iso = (hours: number) =>
      new Date(now.getTime() + hours * 3_600_000).toISOString();
    const snapshot = calculateTeammateWorkload({
      teammates: [
        {
          ...definition("tm-active", "personal", "active", "研究伙伴"),
          role: "研究员",
          employeeId: "emp-active",
        },
        {
          ...definition("tm-idle", "personal", "active", "复盘伙伴"),
          role: "复盘",
          employeeId: "emp-idle",
        },
      ],
      tasks: [
        {
          id: "task-1",
          workspaceId: "main",
          title: "竞品分析",
          status: "progress",
          receiverType: "agent",
          receiverId: "tm-active",
          needsInput: true,
          createdAt: iso(-60),
          updatedAt: iso(-10),
          messages: [
            {
              content: "等待补充数据",
              runId: "run-24",
              state: "waiting_input",
            },
          ],
        },
      ],
      agents: {
        runs: () => [
          {
            id: "run-24",
            instanceId: "task-1",
            employeeId: "emp-active",
            status: "waiting_input",
            runSeq: 1,
            nodeId: "task",
            outputTokens: 100,
            startedAt: iso(-12),
            endedAt: iso(-11),
            createdAt: iso(-12),
          },
          {
            id: "run-72",
            instanceId: "task-1",
            employeeId: "emp-active",
            status: "succeeded",
            runSeq: 2,
            nodeId: "task",
            outputTokens: 200,
            startedAt: iso(-48),
            endedAt: iso(-47),
            createdAt: iso(-48),
          },
          {
            id: "run-old",
            instanceId: "old",
            employeeId: "emp-idle",
            status: "succeeded",
            runSeq: 1,
            nodeId: "task",
            outputTokens: 50,
            startedAt: iso(-80),
            endedAt: iso(-79),
            createdAt: iso(-80),
          },
        ],
      },
      workspaces: { list: () => [{ id: "main" }] },
      now,
    });
    const active = snapshot.items.find((item) => item.teammateId === "tm-active");
    const idle = snapshot.items.find((item) => item.teammateId === "tm-idle");
    expect(active?.hasRunIn72h).toBe(true);
    expect(active?.last24h).toMatchObject({
      taskCount: 1,
      outputTokens: 100,
      blockedTaskCount: 1,
    });
    expect(active?.last72h).toMatchObject({
      taskCount: 1,
      outputTokens: 300,
    });
    expect(active?.blockers[0]).toMatchObject({
      taskId: "task-1",
      reason: "等待补充信息",
    });
    expect(idle?.hasRunIn72h).toBe(false);
    expect(snapshot.activeCount).toBe(1);
    expect(snapshot.inactiveCount).toBe(1);
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
    // 新建实例默认生效。
    expect(created.state).toBe("active");
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
    // 新建实例默认生效，这里不再需要额外切一次状态。
    expect(overridden.state).toBe("active");
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

  it("seeds data-agent as an idempotent protected system identity", async () => {
    const tables = {
      teammates: memoryTable<Teammate>(),
      events: memoryTable<TeammateEvent>(),
    };
    const templates = templateService();
    const teammates = service(tables, templates);
    const legacySeed = {
      id: "data-agent",
      templateId: "sys-data-agent",
      systemKey: "data-agent" as const,
      name: "Data Agent",
      role: "高级数据分析师",
      tools: ["read_file", "mcp"],
    };
    const first = await teammates.ensureSeededPlatformTeammate(legacySeed);
    const chatFirstSoul =
      "# Data Agent SOUL\n\n普通问题直接回答；只有明确要求时生成报告。";
    const second = await teammates.ensureSeededPlatformTeammate({
      ...legacySeed,
      soul: chatFirstSoul,
      tools: [
        "entity.read",
        "data.catalog.search",
        "dataset.describe",
        "query.explain",
        "metric.query",
        "dataset.query.readonly",
        "ask_user_question",
        "report.render",
        "artifact.write",
      ],
    });

    expect(second.id).toBe(first.id);
    expect(first).toMatchObject({
      id: "data-agent",
      templateId: "sys-data-agent",
      systemKey: "data-agent",
      protected: {
        deletable: false,
        archivable: false,
        templateSwitchable: false,
      },
      state: "active",
    });
    expect(templates.get("sys-data-agent")).toMatchObject({
      systemKey: "data-agent",
      state: "active",
      tools: [
        "entity.read",
        "data.catalog.search",
        "dataset.describe",
        "query.explain",
        "metric.query",
        "dataset.query.readonly",
        "ask_user_question",
        "report.render",
        "artifact.write",
      ],
      soul: chatFirstSoul,
      version: "v1.1",
    });
    expect(teammates.listInstances(admin)[0]?.id).toBe("data-agent");
    await expect(
      teammates.archiveInstanceRecord(admin, "data-agent"),
    ).rejects.toMatchObject({ code: "system_agent_protected" });
    await expect(
      teammates.changeState(admin, {
        teammateId: "data-agent",
        state: "paused",
      }),
    ).rejects.toMatchObject({ code: "system_agent_protected" });
    await expect(
      teammates.updateInstanceProfile(admin, {
        teammateId: "data-agent",
        name: "Renamed",
        description: "",
      }),
    ).rejects.toMatchObject({ code: "system_agent_protected" });
    await expect(
      teammates.switchTemplate(admin, {
        teammateId: "data-agent",
        templateId: "sys-data-agent",
      }),
    ).rejects.toMatchObject({ code: "system_agent_protected" });
    await expect(
      templates.update(olivia, {
        templateId: "sys-data-agent",
        name: "Changed",
      }),
    ).rejects.toMatchObject({ code: "system_agent_protected" });
    const beforeAdminEdit = templates.get("sys-data-agent");
    if (beforeAdminEdit === undefined) {
      throw new Error("seeded template not found");
    }
    const changed = await templates.update(admin, {
      templateId: "sys-data-agent",
      name: "Changed",
      role: "平台数据分析师",
      soul: "仅平台管理员可维护。",
    });
    expect(changed).toMatchObject({
      id: "sys-data-agent",
      name: "Changed",
      role: "平台数据分析师",
      soul: "仅平台管理员可维护。",
      systemKey: "data-agent",
      state: "active",
      version: nextVersion(beforeAdminEdit.version),
    });
    await expect(
      templates.changeState(admin, {
        templateId: "sys-data-agent",
        state: "archived",
      }),
    ).rejects.toMatchObject({ code: "system_agent_protected" });
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

  it("creates an active instance from a personal template and updates the template on save", async () => {
    const templates = templateService();
    const teammates = service(undefined, templates);
    const draft = await teammates.create(olivia, { source: "personal" });
    expect(draft.source).toBe("personal");
    expect(draft.ownerName).toBe("Olivia");
    expect(draft.state).toBe("active");
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
    expect(saved.state).toBe("active");
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
    expect(next.state).toBe("active");
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
      ...(profileTemplateId === undefined ? {} : { profileTemplateId }),
    });
    await teammatesTable.put("tm-first", make("tm-first", "active", "backend"));
    await teammatesTable.put(
      "tm-second",
      make("tm-second", "active", "backend"),
    );
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
      "将 AI伙伴名称改为「小白 PD · 供应链」",
    );
    // 内容没变化时不写库、不记录事件。
    const same = await teammates.updateInstanceProfile(admin, {
      teammateId: created.id,
      name: " 小白 PD · 供应链 ",
      description: "负责供应链例外的预研与结论输出。",
    });
    expect(same.updatedAt).toBe(updated.updatedAt);
    expect(teammates.events(created.id)[0]?.message).toBe(
      "将 AI伙伴名称改为「小白 PD · 供应链」",
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

  it("pauses active teammates when their bound external runtime becomes unavailable", async () => {
    const teammates = service();
    const affected = await teammates.create(admin, {
      source: "platform",
      name: "Runtime A Agent",
      execution: "external",
      externalRuntimeId: "runtime-a",
    });
    const unaffected = await teammates.create(admin, {
      source: "platform",
      name: "Runtime B Agent",
      execution: "external",
      externalRuntimeId: "runtime-b",
    });

    const paused = await teammates.pauseForExternalRuntime({
      runtimeId: "runtime-a",
      runtimeName: "Codex CLI 本机",
      runtimeStatus: "disabled",
      actor: admin,
    });

    expect(paused.map((item) => item.id)).toEqual([affected.id]);
    expect(teammates.get(affected.id).state).toBe("paused");
    expect(teammates.get(unaffected.id).state).toBe("active");
    expect(teammates.events(affected.id)[0]?.message).toContain(
      "外部 Agent 运行时「Codex CLI 本机」已停用，自动暂停该 AI伙伴",
    );

    await expect(
      teammates.pauseForExternalRuntime({
        runtimeId: "runtime-a",
        runtimeName: "Codex CLI 本机",
        runtimeStatus: "archived",
        actor: admin,
      }),
    ).resolves.toEqual([]);
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
    expect(saved.state).toBe("active");
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
    // 新建即生效：不用再手动切一次 active。
    expect(draft.state).toBe("active");

    await teammates.update(olivia, { teammateId: draft.id, name: "Ops" });
    await expect(
      teammates.changeState(olivia, { teammateId: draft.id, state: "active" }),
    ).rejects.toMatchObject({ code: "conflict" });

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

describe("teammate runtime task visibility", () => {
  it("collects tasks executed by a teammate persona even when the receiver is human", () => {
    const ids = taskIdsExecutedByPersona(
      [
        { instanceId: "TSK-1", personaId: "persona-tm-1" },
        { instanceId: "TSK-2", personaId: "persona-other" },
        { instanceId: "TSK-3" },
      ],
      "persona-tm-1",
    );
    expect([...ids]).toEqual(["TSK-1"]);
  });

  it("only trusts instance-owned personas for task attribution", () => {
    expect(isInstanceOwnedPersona("tm-1", "persona-tm-1")).toBe(true);
    // 平台模版共享 persona：多个实例共用，不能据此把历史任务算给新实例。
    expect(isInstanceOwnedPersona("tm-1", "architect")).toBe(false);
    expect(isInstanceOwnedPersona("tm-1", undefined)).toBe(false);
  });
});

describe("实例列表可见性", () => {
  it("运行态列表先按状态排序，同状态按最近使用倒序", async () => {
    const tables = {
      teammates: memoryTable<Teammate>(),
      events: memoryTable<TeammateEvent>(),
    };
    const teammates = service(tables);
    const make = (id: string, state: Teammate["state"], updatedAt: string) => ({
      ...definition(id, "platform", state, id),
      ownerUserId: "olivia",
      ownerName: "Olivia",
      updatedAt,
    });
    for (const item of [
      make("tm-active-old", "active", "2026-01-01T00:00:00.000Z"),
      make("tm-active-new", "active", "2026-03-01T00:00:00.000Z"),
      make("tm-draft", "draft", "2026-05-01T00:00:00.000Z"),
      make("tm-paused", "paused", "2026-06-01T00:00:00.000Z"),
    ]) {
      await tables.teammates.put(item.id, item);
    }
    expect(teammates.listInstances(olivia).map((item) => item.id)).toEqual([
      "tm-active-new",
      "tm-active-old",
      "tm-draft",
      "tm-paused",
    ]);
  });

  it("同状态内按真实最近使用时间排序，可覆盖记录更新时间", async () => {
    const tables = {
      teammates: memoryTable<Teammate>(),
      events: memoryTable<TeammateEvent>(),
    };
    const teammates = service(tables);
    const make = (id: string, state: Teammate["state"], updatedAt: string) => ({
      ...definition(id, "platform", state, id),
      ownerUserId: "olivia",
      ownerName: "Olivia",
      updatedAt,
    });
    for (const item of [
      make("tm-active-old", "active", "2026-01-01T00:00:00.000Z"),
      make("tm-active-new", "active", "2026-03-01T00:00:00.000Z"),
    ]) {
      await tables.teammates.put(item.id, item);
    }
    // 记录更新时间更早、但最近实际被使用过的实例，应排在同状态最前。
    expect(
      teammates
        .listInstances(olivia, {
          lastUsedAt: new Map([["tm-active-old", "2026-07-01T00:00:00.000Z"]]),
        })
        .map((item) => item.id),
    ).toEqual(["tm-active-old", "tm-active-new"]);
    // 未提供最近使用时间时，回退到记录更新时间。
    expect(teammates.listInstances(olivia).map((item) => item.id)).toEqual([
      "tm-active-new",
      "tm-active-old",
    ]);
  });

  it("非管理员看不到他人的个人实例，管理员可见全部", async () => {
    const tables = {
      teammates: memoryTable<Teammate>(),
      events: memoryTable<TeammateEvent>(),
    };
    const teammates = service(tables);
    const mine = {
      ...definition("tm-mine", "personal", "active", "我的实例"),
      ownerUserId: "olivia",
      ownerName: "Olivia",
    };
    const othersPersonal = {
      ...definition("tm-others-personal", "personal", "active", "他人个人实例"),
      ownerUserId: "owner",
      ownerName: "Owner",
    };
    const othersPlatform = {
      ...definition("tm-others-platform", "platform", "active", "团队平台实例"),
      ownerUserId: "owner",
      ownerName: "Owner",
    };
    await tables.teammates.put(mine.id, mine);
    await tables.teammates.put(othersPersonal.id, othersPersonal);
    await tables.teammates.put(othersPlatform.id, othersPlatform);

    const idsFor = (actor: TeammateActor) =>
      teammates
        .listInstances(actor)
        .map((item) => item.id)
        .sort();

    expect(idsFor(olivia)).toEqual(["tm-mine", "tm-others-platform"].sort());
    // 方案 B：管理员普通视图同样只看"自己的 + 平台"，全量需要显式 scope。
    expect(idsFor(admin)).toEqual(["tm-others-platform"]);
    expect(
      teammates
        .listInstances(admin, { scope: "all" })
        .map((item) => item.id)
        .sort(),
    ).toEqual(["tm-mine", "tm-others-personal", "tm-others-platform"].sort());
    // 非管理员即使传 scope=all 也不能拿到全量。
    expect(
      teammates
        .listInstances(olivia, { scope: "all" })
        .map((item) => item.id)
        .sort(),
    ).toEqual(["tm-mine", "tm-others-platform"].sort());
  });
});

describe("运行态最近使用时间", () => {
  it("取实例编辑、绑定运行与参会记录中的最大时间", () => {
    const now = new Date("2026-10-09T12:00:00.000Z");
    const iso = (hours: number) =>
      new Date(now.getTime() + hours * 3_600_000).toISOString();
    const runs = [
      {
        id: "run-task",
        instanceId: "task-1",
        nodeId: "development",
        employeeId: "emp-1",
        status: "succeeded",
        runSeq: 1,
        startedAt: iso(-100),
        endedAt: iso(-90),
        updatedAt: iso(-90),
        createdAt: iso(-100),
      },
      {
        id: "run-free",
        instanceId: "manual",
        nodeId: "manual",
        employeeId: "emp-1",
        status: "succeeded",
        runSeq: 2,
        startedAt: iso(-20),
        endedAt: iso(-10),
        updatedAt: iso(-10),
        createdAt: iso(-20),
      },
      {
        id: "run-other",
        instanceId: "task-2",
        nodeId: "development",
        employeeId: "emp-other",
        status: "succeeded",
        runSeq: 1,
        startedAt: iso(-1),
        endedAt: iso(-0.5),
        updatedAt: iso(-0.5),
        createdAt: iso(-1),
      },
    ];
    const result = calculateInstanceLastUsedAt({
      teammates: [
        { id: "tm-1", employeeId: "emp-1", updatedAt: iso(-200) },
        { id: "tm-2", employeeId: "emp-2", updatedAt: iso(-5) },
      ],
      tasks: [
        {
          id: "task-1",
          workspaceId: "main",
          title: "任务",
          status: "done",
          receiverType: "agent",
          receiverId: "tm-1",
          createdAt: iso(-100),
          updatedAt: iso(-90),
          workflow: { instanceId: "task-1", nodeId: "development" },
        },
      ],
      agents: {
        runs: ({
          workspaceId,
        }: {
          readonly workspaceId?: string | undefined;
        }) => (workspaceId === "main" ? runs : []),
      },
      meetings: {
        list: (workspaceId: string) =>
          workspaceId === "main" ? [{ id: "meeting-1", status: "active" }] : [],
        participants: () => [
          {
            id: "p-1",
            meetingId: "meeting-1",
            kind: "agent",
            refId: "emp-1",
            status: "left",
            joinedAt: iso(-40),
            leftAt: iso(-30),
            updatedAt: iso(-30),
          },
        ],
      },
      workspaces: { list: () => [{ id: "main" }] },
    });
    // tm-1：运行最近 -10、会议 -30、编辑 -200 → 取运行时间。
    expect(result.get("tm-1")).toBe(iso(-10));
    // tm-2：没有运行/会议记录，回退到实例编辑时间。
    expect(result.get("tm-2")).toBe(iso(-5));
    // 其他实例的运行不参与。
    expect(result.has("tm-other")).toBe(false);
  });
});
