import type { ServerResponse } from "node:http";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  apply,
  buildProjectReportContent,
  createProjectRoutes,
  generateProjectReportContent,
  hydrateOverviewAlerts,
  inject,
  isProjectReportScheduleDue,
  projectReportScheduleClock,
  ProjectError,
  ProjectService,
  ProjectProgressOverviewService,
  MockScenarioSourceRegistry,
  projectDomainSpec,
  runScheduledProjectReports,
  type ProjectAuditRecord,
  type ProjectAlertRecord,
  type ProjectDependencies,
  type ProjectRecord,
  type ProjectReportRecord,
  type ProjectRoleRecord,
  type ProjectTemplateRecord,
} from "./index.ts";
import type { KvTableLike } from "./service.ts";

class FakeTable<V> implements KvTableLike<V> {
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

  json(): Record<string, any> {
    return JSON.parse(this.body) as Record<string, any>;
  }
}

function fakeRequest(
  method: string,
  url: string,
  options: { readonly body?: unknown; readonly token?: string } = {},
) {
  const body = options.body === undefined ? "" : JSON.stringify(options.body);
  return {
    method,
    url,
    headers: {
      host: "127.0.0.1:33117",
      origin: "http://127.0.0.1:33117",
      ...(options.token === undefined
        ? {}
        : { authorization: `Bearer ${options.token}` }),
      ...(body === "" ? {} : { "content-type": "application/json" }),
    },
    async *[Symbol.asyncIterator]() {
      if (body !== "") yield Buffer.from(body);
    },
  };
}

type Route = ReturnType<typeof createProjectRoutes>[number];

function findRoute(routes: readonly Route[], path: string): Route {
  const route = routes.find((candidate) => candidate.path === path);
  if (route === undefined) throw new Error(`route not found: ${path}`);
  return route;
}

async function call(route: Route, request: unknown): Promise<FakeResponse> {
  const response = new FakeResponse();
  await route.handler(request as never, response as unknown as ServerResponse);
  return response;
}

const BUSINESS_CHAIN_DEFINITION = {
  id: "definition-chain-ai-server",
  scope: "platform" as const,
  workspaceId: "platform",
  key: "business-chain-ai-server",
  version: 3,
  kind: "business-chain" as const,
  name: "AI Server 交付链路",
  description: "供应链交付示例链路",
  status: "active",
  updatedAt: "2026-11-18T12:00:00.000Z",
  businessChain: {
    enabled: true,
    templateId: "chain-ai-server",
    chainKey: "ai-server-delivery",
    displayName: "AI Server 交付链路",
    projectTypeCodes: ["采购类"],
    stageCodePolicy: "stable" as const,
    snapshotPolicy: "pin-at-project-create" as const,
    allowUnboundExternalNodes: false,
  },
  graph: {
    nodes: [
      {
        id: "order-intake",
        name: "订单接入",
        type: "task",
        executor: { kind: "user", id: "olivia", label: "Olivia" },
        approvers: [],
        businessChain: {
          sequence: 1,
          stageCode: "ORDER_INTAKE",
          summaryMetric: "order-quantity",
          externalRefs: [
            {
              system: "OMS",
              objectType: "sales-order-line",
              objectId: "SO-2026-1018-01",
              required: true,
            },
            {
              system: "APS-PLANNING",
              objectType: "plan-node",
              objectId: "PLN-SO0101-M01",
              required: true,
            },
          ],
          fields: [
            {
              key: "planned",
              label: "原计划",
              bindings: [
                {
                  system: "APS-PLANNING",
                  objectId: "PLN-SO0101-M01",
                  path: "baseline.quantity",
                },
                {
                  system: "APS-PLANNING",
                  objectId: "PLN-SO0101-M01",
                  path: "baseline.finishDate",
                },
              ],
            },
          ],
        },
      },
      {
        id: "supply-prep",
        name: "供应备货",
        type: "task",
        executor: { kind: "user", id: "peter", label: "Peter" },
        approvers: [],
        businessChain: {
          sequence: 2,
          stageCode: "SUPPLY_PREP",
          summaryMetric: "kit-readiness",
          externalRefs: [
            {
              system: "WMS",
              objectType: "project-kit",
              objectId: "INV-SO0101-KIT",
              required: true,
            },
            {
              system: "APS-PLANNING",
              objectType: "plan-node",
              objectId: "PLN-SO0101-M03",
              required: true,
            },
          ],
          fields: [
            {
              key: "planned",
              label: "原计划",
              bindings: [
                {
                  system: "APS-PLANNING",
                  objectId: "PLN-SO0101-M03",
                  path: "baseline.quantity",
                },
                {
                  system: "APS-PLANNING",
                  objectId: "PLN-SO0101-M03",
                  path: "baseline.finishDate",
                },
              ],
            },
            {
              key: "revised",
              label: "变更后",
              bindings: [
                {
                  system: "APS-PLANNING",
                  objectId: "PLN-SO0101-M03",
                  path: "confirmed.quantity",
                },
                {
                  system: "APS-PLANNING",
                  objectId: "PLN-SO0101-M03",
                  path: "confirmed.finishDate",
                },
              ],
            },
            {
              key: "actual",
              label: "实际完成",
              bindings: [
                {
                  system: "WMS",
                  objectId: "INV-SO0101-KIT",
                  path: "components.0.availableQuantity",
                },
              ],
            },
          ],
        },
      },
      {
        id: "integration-test",
        name: "联调验证",
        type: "task",
        executor: { kind: "user", id: "peter", label: "Peter" },
        approvers: [],
        businessChain: {
          sequence: 3,
          stageCode: "INTEGRATION_TEST",
          summaryMetric: "actual-output",
          externalRefs: [
            {
              system: "MES",
              objectType: "resource",
              objectId: "BENCH-TEST-03",
              required: true,
            },
          ],
          fields: [
            {
              key: "actual",
              label: "实际完成",
              bindings: [
                {
                  system: "MES",
                  objectId: "BENCH-TEST-03",
                  path: "nodeExecution.1.actualCompletedQuantity",
                },
              ],
            },
          ],
        },
      },
    ],
    edges: [
      { from: "order-intake", to: "supply-prep" },
      { from: "supply-prep", to: "integration-test" },
    ],
  },
};

function businessChainWorkflowService(
  harness: ReturnType<typeof createHarness>,
) {
  const instances = [
    {
      id: "wf-chain-1",
      workspaceId: "ws-1",
      definitionId: BUSINESS_CHAIN_DEFINITION.id,
      definitionKey: BUSINESS_CHAIN_DEFINITION.key,
      definitionVersion: 3,
      title: "AI Server 交付",
      status: "blocked",
      updatedAt: "2026-11-18T12:00:00.000Z",
      nodes: {
        "order-intake": {
          status: "completed",
          completedAt: "2026-11-12T16:40:00.000Z",
          taskIds: [],
        },
        "supply-prep": {
          status: "blocked",
          enteredAt: "2026-11-17T09:20:00.000Z",
          taskIds: ["TSK-CHAIN-1"],
        },
        "integration-test": {
          status: "running",
          enteredAt: "2026-11-17T09:00:00.000Z",
          taskIds: [],
        },
      },
      assignmentBindings: {
        "order-intake": {
          primaryAssignee: { id: "olivia", name: "Olivia" },
        },
        "supply-prep": {
          primaryAssignee: { id: "peter", name: "Peter" },
        },
        "integration-test": {
          primaryAssignee: { id: "peter", name: "Peter" },
        },
      },
    },
  ];
  const chainTask = {
    id: "TSK-CHAIN-1",
    title: "补齐 GPU 在途批次",
    status: "abnormal",
    priority: "P1",
    receiverType: "human",
    receiverName: "Peter",
    createdAt: "2026-11-17T09:20:00.000Z",
    updatedAt: "2026-11-18T02:00:00.000Z",
    workflow: {
      instanceId: "wf-chain-1",
      nodeId: "supply-prep",
    },
    executionAnomaly: {
      code: "GPU_GAP",
      message: "GPU 到货时间缺口需要处理",
      at: "2026-11-18T02:00:00.000Z",
    },
  };
  harness.dependencies.workflows = () => ({
    instances: (workspaceId: string) =>
      workspaceId === "ws-1" ? instances : [],
    instance: (instanceId: string) =>
      instances.find((instance) => instance.id === instanceId),
    sharedDefinitions: () => [
      BUSINESS_CHAIN_DEFINITION,
      {
        id: "definition-plain",
        scope: "project" as const,
        workspaceId: "ws-1",
        key: "plain-workflow",
        version: 1,
        kind: "workflow" as const,
        name: "普通执行流程",
        description: "",
        status: "active",
        updatedAt: "2026-11-18T12:00:00.000Z",
        graph: { nodes: [], edges: [] },
      },
    ],
    definition: (definitionId: string) =>
      definitionId === BUSINESS_CHAIN_DEFINITION.id
        ? BUSINESS_CHAIN_DEFINITION
        : undefined,
    events: (instanceId: string) =>
      instanceId === "wf-chain-1"
        ? [
            {
              id: "event-chain-1",
              nodeId: "supply-prep",
              kind: "agent.dispatch_failed",
              message: "供应计划同步失败",
              at: "2026-11-18T02:10:00.000Z",
            },
          ]
        : [],
    submissions: () => [],
  });
  harness.dependencies.tasks = () => ({
    list: (workspaceId: string) => (workspaceId === "ws-1" ? [chainTask] : []),
    markRoleUnavailable: async () => 0,
  });
  return { instances, chainTask };
}

interface Seat {
  readonly id: string;
  readonly label: string;
  readonly participantKind: string;
  readonly permissions: readonly string[];
}

interface Assignment {
  id: string;
  workspaceId: string;
  seatId: string;
  seatLabel: string;
  assigneeKind: "user" | "agent";
  assigneeId: string;
  status: "assigned" | "released";
  permissions: readonly string[];
}

/** 最小角色指派服务：语义与 dsh-collab-roles 的席位集合一致。 */
class FakeAssignments {
  private sequence = 0;
  private readonly configs = new Map<
    string,
    { workspaceId: string; typeId: string; typeName: string; seats: Seat[] }
  >();
  private readonly assignments: Assignment[] = [];

  config(workspaceId: string) {
    const config = this.configs.get(workspaceId);
    if (config === undefined)
      throw new Error("workspace roles not materialized");
    return config;
  }

  async materialize(
    _actor: unknown,
    workspaceId: string,
    type: {
      id: string;
      name: string;
      seats: readonly Seat[];
    },
  ) {
    const seats = type.seats.map((seat) => ({ ...seat }));
    this.configs.set(workspaceId, {
      workspaceId,
      typeId: type.id,
      typeName: type.name,
      seats,
    });
    const seatIds = new Set(seats.map((seat) => seat.id));
    for (let index = this.assignments.length - 1; index >= 0; index -= 1) {
      const assignment = this.assignments[index];
      if (
        assignment?.workspaceId === workspaceId &&
        !seatIds.has(assignment.seatId)
      ) {
        this.assignments.splice(index, 1);
      }
    }
    const config = this.configs.get(workspaceId);
    if (config === undefined) throw new Error("materialize failed");
    return config;
  }

  seats(workspaceId: string) {
    // 与 dsh-collab-roles 一致：工作区未物化角色时读取席位会抛 not_found。
    this.config(workspaceId);
    return this.assignments
      .filter((assignment) => assignment.workspaceId === workspaceId)
      .map((assignment) => ({ ...assignment }));
  }

  async assign(
    _actor: unknown,
    input: {
      workspaceId: string;
      seatId: string;
      assigneeKind: "user" | "agent";
      assigneeId: string;
    },
  ) {
    const config = this.config(input.workspaceId);
    const seat = config.seats.find(
      (candidate) => candidate.id === input.seatId,
    );
    if (seat === undefined) throw new Error("role seat not found");
    const existing = this.assignments.find(
      (assignment) =>
        assignment.workspaceId === input.workspaceId &&
        assignment.seatId === input.seatId &&
        assignment.assigneeKind === input.assigneeKind &&
        assignment.assigneeId === input.assigneeId &&
        assignment.status === "assigned",
    );
    if (existing !== undefined) return existing;
    this.sequence += 1;
    const assignment: Assignment = {
      id: `assignment-${this.sequence}`,
      workspaceId: input.workspaceId,
      seatId: seat.id,
      seatLabel: seat.label,
      assigneeKind: input.assigneeKind,
      assigneeId: input.assigneeId,
      status: "assigned",
      permissions: seat.permissions,
    };
    this.assignments.push(assignment);
    return assignment;
  }

  async release(
    _actor: unknown,
    workspaceId: string,
    seatId: string,
    target: { assigneeKind: "user" | "agent"; assigneeId: string },
  ) {
    const assignment = this.assignments.find(
      (candidate) =>
        candidate.workspaceId === workspaceId &&
        candidate.seatId === seatId &&
        candidate.assigneeKind === target.assigneeKind &&
        candidate.assigneeId === target.assigneeId &&
        candidate.status === "assigned",
    );
    if (assignment === undefined) throw new Error("active role seat not found");
    assignment.status = "released";
    return assignment;
  }
}

interface HarnessOptions {
  /** 追加一个有成员、但还没有物化项目角色的工作区，用于覆盖降级读路径。 */
  readonly extraWorkspace?: boolean;
  /** 追加一个引用 role-owner 的已启用工作流模版，用于覆盖角色下线阻塞。 */
  readonly roleWorkflow?: boolean;
  /** 为项目产出物聚合测试提供任务文档和工作流提交。 */
  readonly outputs?: boolean;
  /** 追加一个与 TSK-1 产出同名、同大小、同日期但来源不同的任务。 */
  readonly outputCollision?: boolean;
}

function createHarness(options: HarnessOptions = {}) {
  const now = new Date("2026-10-16T02:00:00.000Z");
  const tables = {
    projects: new FakeTable<ProjectRecord>(),
    templates: new FakeTable<ProjectTemplateRecord>(),
    roles: new FakeTable<ProjectRoleRecord>(),
    reports: new FakeTable<ProjectReportRecord>(),
    audit: new FakeTable<ProjectAuditRecord>(),
    alerts: new FakeTable<ProjectAlertRecord>(),
  };
  const service = new ProjectService(tables, { now: () => now });
  const workspace = {
    id: "ws-1",
    title: "一切皆插件",
    path: "/tmp/ws-1",
    async setTitle(title: string) {
      workspace.title = title;
    },
  };
  const members: Array<{
    userId: string;
    name: string;
    memberRole: "owner" | "member" | "guest";
    addedAt?: string;
  }> = [
    {
      userId: "olivia",
      name: "Olivia",
      memberRole: "owner",
      addedAt: "2026-10-01T00:00:00.000Z",
    },
    {
      userId: "peter",
      name: "Peter",
      memberRole: "member",
      addedAt: "2026-10-02T00:00:00.000Z",
    },
  ];
  const users = [
    { id: "olivia", name: "Olivia", role: "admin" },
    { id: "peter", name: "Peter", role: "member" },
    { id: "mia", name: "Mia", role: "member" },
  ];
  const addedMembers: Array<{ userId: string; role: string }> = [];
  const allowWorkspaceOwnerCalls: string[] = [];
  const selfOwnerBootstrapCalls: string[] = [];
  const identityAudit: Array<{
    id: string;
    at: string;
    actorId: string;
    actorRole: string;
    action: string;
    targetId?: string;
    workspaceId?: string;
    detail: Record<string, string>;
  }> = [];
  const taskMarks: Array<{
    roles: Map<string, string>;
    skip: string[];
  }> = [];
  const team = {
    resolveToken: (token: string) => {
      if (token === "admin-token")
        return { userId: "olivia", role: "admin" as const };
      if (token === "owner-token")
        return { userId: "peter", role: "member" as const };
      if (token === "member-token")
        return { userId: "mia", role: "member" as const };
      return undefined;
    },
    users: () => users,
    members: (workspaceId: string) => (workspaceId === "ws-2" ? [] : members),
    async addMember(
      _actorId: string,
      input: {
        workspaceId: string;
        userId: string;
        role: "owner" | "member" | "guest";
      },
      options?: {
        readonly allowWorkspaceOwner?: boolean;
        readonly allowSelfOwnerBootstrap?: boolean;
      },
    ) {
      if (options?.allowWorkspaceOwner === true) {
        allowWorkspaceOwnerCalls.push(input.userId);
      }
      if (options?.allowSelfOwnerBootstrap === true) {
        selfOwnerBootstrapCalls.push(input.userId);
      }
      addedMembers.push({ userId: input.userId, role: input.role });
      const next = {
        userId: input.userId,
        name: input.userId,
        memberRole: input.role,
        addedAt: now.toISOString(),
      };
      const existing = members.findIndex(
        (member) => member.userId === input.userId,
      );
      if (existing < 0) members.push(next);
      else members[existing] = next;
      return members;
    },
    async removeMember(
      _actorId: string,
      input: { workspaceId: string; userId: string },
    ) {
      const index = members.findIndex(
        (member) => member.userId === input.userId,
      );
      if (index >= 0) members.splice(index, 1);
      return members;
    },
    async leaveWorkspace(_actorId: string, workspaceId: string) {
      if (workspaceId !== "ws-1") return [];
      const index = members.findIndex((member) => member.userId === "peter");
      if (index >= 0) members.splice(index, 1);
      return members;
    },
    audit: () => identityAudit,
  };
  const workspaces = {
    get: (id: string) =>
      id === workspace.id
        ? workspace
        : options.extraWorkspace === true && id === "ws-2"
          ? {
              id: "ws-2",
              title: "员工平台",
              path: "/tmp/ws-2",
            }
          : undefined,
    list: () =>
      options.extraWorkspace === true
        ? [workspace, { id: "ws-2", title: "员工平台", path: "/tmp/ws-2" }]
        : [workspace],
    create: async (path: string, title?: string) => ({
      id: "ws-2",
      title: title ?? path,
      path,
      setTitle: async () => undefined,
    }),
  };
  const assignments = new FakeAssignments();
  assignments.materialize(null, "ws-1", {
    id: "tpl-plugin-dev",
    name: "插件 / 平台研发",
    seats: [
      {
        id: "role-owner",
        label: "项目负责人",
        participantKind: "any",
        permissions: ["read", "write", "approve"],
      },
      {
        id: "role-dev",
        label: "开发实施",
        participantKind: "any",
        permissions: ["read", "write"],
      },
    ],
  });
  const tasks = [
    {
      id: "TSK-1",
      title: "补全项目视角",
      status: "progress",
      priority: "P1",
      receiverType: "human",
      receiverName: "Peter",
      due: "2026-10-10",
      createdAt: "2026-10-16T01:00:00.000Z",
      updatedAt: "2026-10-16T01:30:00.000Z",
      workspaceId: "ws-1",
      workflow: {
        instanceId: "wf-1",
        instanceTitle: "GUI 回归",
        nodeId: "design",
        nodeName: "设计",
      },
    },
    {
      id: "TSK-0",
      title: "历史归档任务",
      status: "done",
      priority: "P3",
      receiverType: "unassigned",
      archivedAt: "2026-10-01T00:00:00.000Z",
      createdAt: "2026-09-01T00:00:00.000Z",
      updatedAt: "2026-09-02T00:00:00.000Z",
      workspaceId: "ws-1",
    },
    ...(options.outputCollision === true
      ? [
          {
            id: "TSK-2",
            title: "补全运营视角",
            status: "progress",
            priority: "P1",
            receiverType: "human" as const,
            receiverName: "Mia",
            due: "2026-10-10",
            createdAt: "2026-10-16T01:00:00.000Z",
            updatedAt: "2026-10-16T01:30:00.000Z",
            workspaceId: "ws-1",
          },
        ]
      : []),
  ];
  const workflows = [
    {
      id: "wf-1",
      definitionId: "definition-1",
      definitionKey: "gui-from-zero",
      definitionVersion: 1,
      title: "GUI 回归",
      status: "blocked",
      updatedAt: "2026-10-15T08:00:00.000Z",
      workspaceId: "ws-1",
    },
  ];
  const taskDocuments =
    options.outputs === true
      ? {
          async list(taskId: string) {
            return taskId === "TSK-1" ||
              (options.outputCollision === true && taskId === "TSK-2")
              ? {
                  workspaceReady: true,
                  documents: [
                    {
                      id: "produced:deliverables/design.md",
                      kind: "produced" as const,
                      name: "design.md",
                      relativePath: "deliverables/design.md",
                      size: 2_048,
                      mimeType: "text/markdown; charset=utf-8",
                      updatedBy: "Research Avatar",
                      updatedAt: "2026-10-16T01:10:00.000Z",
                      available: true,
                    },
                    {
                      id: "uploaded:input.pdf",
                      kind: "uploaded" as const,
                      name: "input.pdf",
                      relativePath: "input.pdf",
                      size: 1_024,
                      mimeType: "application/pdf",
                      updatedBy: "Peter",
                      updatedAt: "2026-10-15T01:10:00.000Z",
                      available: true,
                    },
                  ],
                }
              : { workspaceReady: true, documents: [] };
          },
        }
      : undefined;
  const submissions =
    options.outputs === true
      ? [
          {
            id: "submission-old",
            instanceId: "wf-1",
            nodeId: "review",
            requirementKey: "review-report",
            requirementTitle: "评审报告",
            type: "file" as const,
            artifacts: [
              {
                id: "artifact-old",
                fileName: "review-old.pdf",
                mimeType: "application/pdf",
                size: 2_000,
              },
            ],
            submittedByName: "Olivia",
            submittedAt: "2026-10-15T07:00:00.000Z",
            status: "submitted" as const,
          },
          {
            id: "submission-new",
            instanceId: "wf-1",
            nodeId: "review",
            requirementKey: "review-report",
            requirementTitle: "评审报告",
            type: "file" as const,
            artifacts: [
              {
                id: "artifact-new",
                fileName: "review-final.pdf",
                mimeType: "application/pdf",
                size: 3_000,
              },
            ],
            submittedByName: "Olivia",
            submittedAt: "2026-10-16T02:00:00.000Z",
            status: "submitted" as const,
          },
          {
            id: "submission-rejected",
            instanceId: "wf-1",
            nodeId: "review",
            requirementKey: "review-report",
            requirementTitle: "评审报告",
            type: "file" as const,
            artifacts: [
              {
                id: "artifact-rejected",
                fileName: "review-rejected.pdf",
                mimeType: "application/pdf",
                size: 1_000,
              },
            ],
            submittedByName: "Olivia",
            submittedAt: "2026-10-16T03:00:00.000Z",
            status: "rejected" as const,
          },
        ]
      : [];
  const projectManagers = new Map<
    string,
    {
      id: string;
      name: string;
      ownerUserId: string;
      ownerName: string;
      source: "platform";
      avatar: string;
    }
  >();
  const teammates = {
    assignable: (actor?: { userId: string }, workspaceId?: string) =>
      [
        ...(workspaceId === undefined ||
        projectManagers.get(workspaceId) === undefined
          ? []
          : [projectManagers.get(workspaceId)!]),
        {
          id: "teammate-1",
          name: "Research Avatar",
          ownerUserId: "olivia",
          ownerName: "Olivia",
          source: "personal" as const,
          avatar: "",
        },
        {
          id: "teammate-2",
          name: "小白PD",
          ownerUserId: "olivia",
          ownerName: "Olivia",
          source: "personal" as const,
          avatar: "",
        },
        {
          id: "teammate-3",
          name: "计划助手",
          ownerUserId: "mia",
          ownerName: "Mia",
          source: "personal" as const,
          avatar: "",
        },
        {
          id: "teammate-4",
          name: "Data Agent",
          ownerUserId: "mia",
          ownerName: "Mia",
          source: "platform" as const,
          avatar: "",
        },
        {
          id: "teammate-5",
          name: "会议 Facilitator",
          ownerUserId: "olivia",
          ownerName: "Olivia",
          source: "platform" as const,
          avatar: "",
        },
      ].filter(
        (teammate) =>
          actor === undefined ||
          teammate.ownerUserId === actor.userId ||
          teammate.id === projectManagers.get(workspaceId ?? "")?.id,
      ),
    isSystemAgent: (ref: string) =>
      ref === "teammate-4" ||
      ref === "principal-ai-teammate-4" ||
      ref === "teammate-5" ||
      ref === "principal-ai-teammate-5" ||
      [...projectManagers.values()].some((teammate) => teammate.id === ref),
    isProjectManagedAgent: (ref: string) =>
      [...projectManagers.values()].some((teammate) => teammate.id === ref),
    ensureProjectManagerAgent: async (input: {
      workspaceId: string;
      projectName: string;
      actor: {
        userId: string;
        name: string;
        role: "admin" | "owner" | "member" | "guest";
      };
    }) => {
      const existing = projectManagers.get(input.workspaceId);
      if (existing !== undefined) return existing;
      const created = {
        id: `tm-project-${input.workspaceId}`,
        name: `PM_${input.projectName}`,
        ownerUserId: "platform",
        ownerName: "平台",
        source: "platform" as const,
        avatar: "",
      };
      projectManagers.set(input.workspaceId, created);
      return created;
    },
    projectManagerFor: (workspaceId: string) =>
      projectManagers.get(workspaceId),
    ensureRuntime: async (input: {
      workspaceId: string;
      teammateId: string;
    }) => ({
      teammateId: input.teammateId,
      principalId: `principal-ai-${input.teammateId}`,
      profileId: `profile-${input.workspaceId}-${input.teammateId}`,
      personaId: `persona-${input.teammateId}`,
      execution: "builtin" as const,
    }),
  };
  const meetingOutputs =
    options.outputs === true
      ? [
          {
            id: "meeting-1",
            workspaceId: "ws-1",
            title: "订单异常复盘",
            status: "closed",
            createdBy: "olivia",
            updatedAt: "2026-10-16T03:00:00.000Z",
          },
        ]
      : [];
  const meetingFileOutputs =
    options.outputs === true
      ? [
          {
            id: "meeting-file-1",
            meetingId: "meeting-1",
            name: "meeting-notes.md",
            mime: "text/markdown",
            size: 512,
            uploadedBy: "peter",
            createdAt: "2026-10-16T02:30:00.000Z",
          },
        ]
      : [];
  const meetingMinutesOutput =
    options.outputs === true
      ? {
          id: "minute-version-1",
          meetingId: "meeting-1",
          version: 1,
          content: "# 订单异常复盘\n\n确认履约异常原因。",
          status: "confirmed",
          requestedBy: "olivia",
          confirmedBy: "olivia",
          updatedAt: "2026-10-16T03:00:00.000Z",
        }
      : undefined;
  const dataAgentReports =
    options.outputs === true
      ? [
          {
            conversation: {
              id: "data-agent-conversation-1",
              title: "订单异常分析",
              workspaceId: "ws-1",
              ownerUserId: "mia",
            },
            report: {
              id: "data-agent-report-1",
              conversationId: "data-agent-conversation-1",
              title: "订单异常分析报告",
              markdown: "# 订单异常分析\n\n支付失败集中在数码品类。",
              version: 1,
              createdAt: "2026-10-16T04:00:00.000Z",
            },
          },
        ]
      : [];
  const principals = {
    resolveReference(reference: string) {
      const value = reference.startsWith("principal:")
        ? reference.slice("principal:".length)
        : reference.includes(":")
          ? ""
          : `principal-human-${reference}`;
      if (value === "") return undefined;
      const user = users.find(
        (candidate) => `principal-human-${candidate.id}` === value,
      );
      if (user !== undefined) {
        return {
          id: value,
          kind: "human" as const,
          displayName: user.name,
          status: "active" as const,
        };
      }
      const teammate = teammates
        .assignable()
        .find((candidate) => `principal-ai-${candidate.id}` === value);
      return teammate === undefined
        ? undefined
        : {
            id: value,
            kind: "ai" as const,
            displayName: teammate.name,
            status: "active" as const,
          };
    },
    resolveSubject(
      subjectType: "auth-user" | "employee" | "teammate",
      subjectId: string,
    ) {
      if (subjectType === "auth-user") {
        return this.resolveReference(`principal:principal-human-${subjectId}`);
      }
      if (subjectType === "teammate") {
        return this.resolveReference(`principal:principal-ai-${subjectId}`);
      }
      return undefined;
    },
    bindings(principalId: string) {
      if (principalId.startsWith("principal-human-")) {
        return [
          {
            subjectType: "auth-user" as const,
            subjectId: principalId.slice("principal-human-".length),
          },
        ];
      }
      if (principalId.startsWith("principal-ai-")) {
        return [
          {
            subjectType: "teammate" as const,
            subjectId: principalId.slice("principal-ai-".length),
          },
        ];
      }
      return [];
    },
    preferredSubjectId(
      principalId: string,
      subjectTypes: readonly ("auth-user" | "employee" | "teammate" | "hrm")[],
    ) {
      return this.bindings(principalId).find((binding) =>
        subjectTypes.includes(binding.subjectType),
      )?.subjectId;
    },
    syncExclusiveGrant: async () => undefined,
    revokeMatchingGrants: async () => undefined,
  };
  const dependencies: {
    -readonly [Key in keyof ProjectDependencies]: ProjectDependencies[Key];
  } = {
    team,
    workspaces,
    assignments: () => assignments,
    employees: () => undefined,
    teammates: () => teammates,
    tasks: () => ({
      list: (workspaceId: string) => (workspaceId === "ws-2" ? [] : tasks),
      markRoleUnavailable: async (
        _workspaceId: string,
        roles: ReadonlyMap<string, string>,
        skip?: ReadonlySet<string>,
      ) => {
        taskMarks.push({ roles: new Map(roles), skip: [...(skip ?? [])] });
        return 0;
      },
    }),
    taskDocuments: () => taskDocuments,
    workflows: () => ({
      instances: (workspaceId: string) =>
        workspaceId === "ws-2" ? [] : workflows,
      submissions: (instanceId: string) =>
        instanceId === "wf-1" ? submissions : [],
      sharedDefinitions: () => [
        {
          id: "definition-1",
          key: "gui-from-zero",
          version: 1,
          name: "GUI 回归",
          description: "",
          status: "active",
          workspaceId: "ws-1",
          graph: {
            nodes: [
              {
                id: "design",
                name: "设计",
                executor: { kind: "user", id: "olivia" },
                approvers: [],
              },
              {
                id: "review",
                name: "评审",
                executor: { kind: "user", id: "olivia" },
                approvers: [],
              },
            ],
          },
        },
        ...(options.roleWorkflow === true
          ? [
              {
                id: "definition-role",
                key: "role-flow",
                version: 1,
                name: "角色流程",
                description: "",
                status: "active",
                workspaceId: "ws-1",
                graph: {
                  nodes: [
                    {
                      id: "review",
                      name: "评审",
                      executor: { kind: "role", id: "role-owner" },
                      approvers: [],
                    },
                  ],
                },
              },
            ]
          : []),
      ],
    }),
    meetings: () => ({
      list: (workspaceId: string) =>
        workspaceId === "ws-1" ? meetingOutputs : [],
      get: (meetingId: string) => {
        const meeting = meetingOutputs.find((item) => item.id === meetingId);
        if (meeting === undefined) throw new Error("meeting not found");
        return meeting;
      },
    }),
    meetingFiles: () => ({
      list: (meetingId: string) =>
        meetingFileOutputs.filter((file) => file.meetingId === meetingId),
    }),
    meetingMinutes: () => ({
      activeVersion: (meetingId: string) =>
        meetingMinutesOutput?.meetingId === meetingId
          ? meetingMinutesOutput
          : undefined,
    }),
    dataAgent: () => ({
      projectReports: (workspaceId: string) =>
        dataAgentReports.filter(
          ({ conversation }) => conversation.workspaceId === workspaceId,
        ),
      conversation: (conversationId: string) => {
        const item = dataAgentReports.find(
          ({ conversation }) => conversation.id === conversationId,
        );
        if (item === undefined) throw new Error("conversation not found");
        return item.conversation;
      },
      report: (reportId: string) => {
        const item = dataAgentReports.find(
          ({ report }) => report.id === reportId,
        );
        if (item === undefined) throw new Error("report not found");
        return item.report;
      },
    }),
    principals: () => principals,
    progressSources: () => undefined,
    now: () => now,
  };
  const routes = createProjectRoutes(service, dependencies);
  return {
    now,
    tables,
    service,
    workspace,
    members,
    users,
    addedMembers,
    allowWorkspaceOwnerCalls,
    selfOwnerBootstrapCalls,
    identityAudit,
    taskMarks,
    team,
    teammates,
    workspaces,
    assignments,
    dependencies,
    routes,
  };
}

describe("project service", () => {
  it("seeds the built-in role library and project templates once", async () => {
    const harness = createHarness();
    await harness.service.seedDefaults();
    await harness.service.seedDefaults();
    expect(harness.service.roles()).toHaveLength(14);
    expect(harness.service.templates()).toHaveLength(3);
    expect(harness.service.role("role-owner")?.name).toBe("项目负责人");
    expect(harness.service.template("tpl-plugin-dev")?.roleIds).toContain(
      "role-review",
    );
  });

  it("rejects duplicate role codes and protects referenced roles", async () => {
    const harness = createHarness();
    await harness.service.seedDefaults();
    await expect(
      harness.service.saveRole({
        id: "role-copy",
        name: "复制角色",
        code: "PROJECT_OWNER",
        category: "管理",
      }),
    ).rejects.toBeInstanceOf(ProjectError);
    await expect(
      harness.service.removeRole("role-owner"),
    ).rejects.toMatchObject({ code: "conflict" });
    await harness.service.saveRole({
      id: "role-extra",
      name: "临时角色",
      code: "TEMP_ROLE",
      category: "支持",
    });
    await harness.service.removeRole("role-extra");
    expect(harness.service.role("role-extra")).toBeUndefined();
  });

  it("keeps project codes unique per project", async () => {
    const harness = createHarness();
    const first = await harness.service.upsertProject({ workspaceId: "ws-1" });
    expect(first.code).toBe("PRJ000001");
    const second = await harness.service.upsertProject({ workspaceId: "ws-2" });
    expect(second.code).toBe("PRJ000002");
  });

  it("stores and removes project role mapping presets", async () => {
    const harness = createHarness();
    await harness.service.upsertProject({
      workspaceId: "ws-1",
      projectRoles: [
        {
          id: "role-reviewer",
          name: "评审组",
          code: "REVIEWER",
          category: "评审",
          description: "",
          permissions: ["read", "write"],
        },
      ],
    });
    const saved = await harness.service.saveRoleMappingPreset({
      workspaceId: "ws-1",
      roleId: "role-reviewer",
      assignees: [
        { kind: "user", id: "olivia", name: "Olivia" },
        { kind: "agent", id: "tm-reviewer", name: "评审伙伴" },
      ],
      updatedBy: "olivia",
    });
    expect(saved.roleMappingPresets["role-reviewer"]).toMatchObject({
      roleId: "role-reviewer",
      assignees: [
        { kind: "user", id: "olivia", name: "Olivia" },
        { kind: "agent", id: "tm-reviewer", name: "评审伙伴" },
      ],
    });
    const removed = await harness.service.removeRoleMappingPreset({
      workspaceId: "ws-1",
      roleId: "role-reviewer",
    });
    expect(removed.roleMappingPresets["role-reviewer"]).toBeUndefined();
  });

  it("assigns stable PRJ codes when auto-provisioning projects", async () => {
    const harness = createHarness();
    const created = await harness.service.ensureProject({
      workspaceId: "ws-1",
      ownerId: "olivia",
      ownerName: "Olivia",
    });
    expect(created.code).toBe("PRJ000001");
    const again = await harness.service.ensureProject({ workspaceId: "ws-1" });
    expect(again.code).toBe(created.code);
    expect(again.ownerName).toBe("Olivia");
    expect(harness.service.projects()).toHaveLength(1);

    const second = await harness.service.ensureProject({ workspaceId: "ws-2" });
    expect(second.code).toBe("PRJ000002");
  });

  it("continues numbering from legacy PRJ-### codes", async () => {
    const harness = createHarness();
    await harness.service.upsertProject({
      workspaceId: "ws-legacy",
      code: "PRJ-007",
    });
    const next = await harness.service.ensureProject({ workspaceId: "ws-new" });
    expect(next.code).toBe("PRJ000008");
  });

  it("stores a project business-chain snapshot and never overwrites it on template updates", async () => {
    const harness = createHarness();
    await harness.service.saveTemplate({
      id: "tpl-chain",
      name: "AI Server 交付模版",
      code: "TPL-CHAIN",
      type: "采购类",
      status: "启用",
      roleIds: [],
      workflowTemplateIds: [],
      businessChainMode: "required",
      allowedBusinessChainTemplateIds: ["chain-ai-server"],
      defaultBusinessChainTemplateId: "chain-ai-server",
      versionPolicy: "pin-at-project-create",
    });
    await harness.service.upsertProject({
      workspaceId: "ws-1",
      code: "SO0101",
      templateId: "tpl-chain",
    });
    const project = await harness.service.saveBusinessChainBinding({
      workspaceId: "ws-1",
      expectedRevision: 1,
      binding: {
        projectTemplateId: "tpl-chain",
        businessChainTemplateId: "chain-ai-server",
        workflowDefinitionId: BUSINESS_CHAIN_DEFINITION.id,
        workflowDefinitionVersion: 3,
        chainKey: "ai-server-delivery",
        bindingMode: "template-default",
        sourceTemplateRevision: 1,
        nodeBindings: [],
        boundBy: "olivia",
      },
    });
    expect(project.businessChainBinding).toMatchObject({
      workflowDefinitionId: BUSINESS_CHAIN_DEFINITION.id,
      workflowDefinitionVersion: 3,
      projectTemplateId: "tpl-chain",
      sourceTemplateRevision: 1,
    });
    expect(project.businessChainRevision).toBe(2);

    const template = harness.service.template("tpl-chain")!;
    await harness.service.saveTemplate({
      ...template,
      name: "AI Server 交付模版 v2",
      allowedBusinessChainTemplateIds: ["chain-ai-server"],
      defaultBusinessChainTemplateId: "chain-ai-server",
    });
    expect(harness.service.template("tpl-chain")?.revision).toBe(2);
    expect(harness.service.project("ws-1")?.businessChainBinding).toMatchObject(
      {
        workflowDefinitionVersion: 3,
        sourceTemplateRevision: 1,
      },
    );
    await expect(
      harness.service.saveBusinessChainBinding({
        workspaceId: "ws-1",
        expectedRevision: 1,
        binding: {
          projectTemplateId: "tpl-chain",
          businessChainTemplateId: "chain-ai-server",
          workflowDefinitionId: BUSINESS_CHAIN_DEFINITION.id,
          workflowDefinitionVersion: 3,
          chainKey: "ai-server-delivery",
          bindingMode: "template-default",
          sourceTemplateRevision: 2,
          nodeBindings: [],
          boundBy: "olivia",
        },
      }),
    ).rejects.toMatchObject({ code: "revision_conflict" });
  });

  it("validates project template business-chain defaults and compatibility defaults", async () => {
    const harness = createHarness();
    await expect(
      harness.service.saveTemplate({
        id: "tpl-invalid-chain",
        name: "无效业务链路模版",
        code: "TPL-INVALID-CHAIN",
        type: "采购类",
        status: "启用",
        businessChainMode: "required",
        allowedBusinessChainTemplateIds: ["chain-a"],
        defaultBusinessChainTemplateId: "chain-b",
      }),
    ).rejects.toMatchObject({ code: "invalid_input" });
    await harness.service.saveTemplate({
      id: "tpl-legacy",
      name: "历史模版",
      code: "TPL-LEGACY",
      type: "研发类",
      status: "启用",
    });
    expect(harness.service.template("tpl-legacy")).toMatchObject({
      businessChainMode: "none",
      allowedBusinessChainTemplateIds: [],
      versionPolicy: "pin-at-project-create",
      revision: 1,
    });
  });

  it("keeps one stable alert identity across lifecycle transitions and stale sources", async () => {
    const harness = createHarness();
    const candidate = {
      conditionKey: "WMS:WH-EAST-01:sync-sla",
      sourceSystem: "WMS",
      sourceObjectId: "WH-EAST-01",
      sourceRevision: "INV-R4",
      alertType: "source_sync",
      severity: "P1" as const,
      title: "库存回传超过 SLA",
      description: "华东仓库存回传延迟",
      lifecycle: "open" as const,
      linkedTaskIds: ["TSK-1", "TSK-2"],
    };
    const first = await harness.service.upsertProjectAlerts(
      "ws-1",
      [candidate],
      { observedAt: "2026-11-18T04:00:00.000Z" },
    );
    const alertId = first[0]!.alertId;
    expect(alertId).toMatch(/^project-alert:/);
    const acknowledged = await harness.service.transitionProjectAlert({
      workspaceId: "ws-1",
      alertId,
      action: "acknowledge",
      actorPrincipalId: "principal-human-olivia",
    });
    expect(acknowledged.lifecycle).toBe("acknowledged");
    expect(acknowledged.alertId).toBe(alertId);
    const inProgress = await harness.service.transitionProjectAlert({
      workspaceId: "ws-1",
      alertId,
      action: "start",
      actorPrincipalId: "principal-human-olivia",
    });
    expect(inProgress.lifecycle).toBe("in_progress");
    const resolved = await harness.service.transitionProjectAlert({
      workspaceId: "ws-1",
      alertId,
      action: "resolve",
    });
    expect(resolved.lifecycle).toBe("resolved");
    expect(harness.service.alerts("ws-1")).toHaveLength(1);
    const reopened = await harness.service.upsertProjectAlerts(
      "ws-1",
      [{ ...candidate, title: "库存回传仍然超过 SLA" }],
      {
        observedAt: "2026-11-19T04:00:00.000Z",
        staleConditionKeys: new Set([candidate.conditionKey]),
      },
    );
    expect(reopened[0]).toMatchObject({
      alertId,
      lifecycle: "stale",
      title: "库存回传仍然超过 SLA",
      firstSeenAt: "2026-11-18T04:00:00.000Z",
    });
    const stillStale = await harness.service.upsertProjectAlerts("ws-1", [], {
      observedAt: "2026-11-20T04:00:00.000Z",
      sourceStatuses: { WMS: "stale" },
    });
    expect(stillStale[0]).toMatchObject({
      alertId,
      lifecycle: "stale",
      lastSeenAt: "2026-11-20T04:00:00.000Z",
    });
  });
});

describe("project routes", () => {
  it("lists projects with membership and notes", async () => {
    const harness = createHarness();
    await harness.service.seedDefaults();
    const route = findRoute(harness.routes, "/api/collab/projects");
    const response = await call(
      route,
      fakeRequest("GET", "/api/collab/projects", { token: "admin-token" }),
    );
    expect(response.status).toBe(200);
    const body = response.json();
    expect(body.projects).toHaveLength(1);
    expect(body.projects[0]).toMatchObject({
      workspaceId: "ws-1",
      name: "一切皆插件",
      ownerName: "Olivia",
      isMember: true,
      counts: {
        members: 2,
        humans: 2,
        aiPartners: 0,
        tasks: 1,
        workflows: 1,
      },
    });
    expect(body.projects[0].notes.tasks).toBe("今日新增 1 项");
    expect(body.projects[0].notes.workflows).toBe("1 个阻塞");
  });

  it("backfills a missing project owner from the workspace owner on read", async () => {
    const harness = createHarness();
    await harness.service.seedDefaults();
    const route = findRoute(harness.routes, "/api/collab/projects");
    await call(
      route,
      fakeRequest("GET", "/api/collab/projects", { token: "admin-token" }),
    );
    const project = harness.tables.projects.get("ws-1");
    expect(project).toBeDefined();
    await harness.tables.projects.put("ws-1", {
      ...project!,
      ownerId: undefined,
      ownerName: "",
    });
    const response = await call(
      route,
      fakeRequest("GET", "/api/collab/projects", { token: "admin-token" }),
    );
    expect(response.status).toBe(200);
    expect(response.json().projects[0]).toMatchObject({
      ownerId: "olivia",
      ownerName: "Olivia",
    });
  });

  it("lists all projects to platform admins and only joined projects to members", async () => {
    const harness = createHarness({ extraWorkspace: true });
    await harness.service.seedDefaults();
    const route = findRoute(harness.routes, "/api/collab/projects");
    const adminResponse = await call(
      route,
      fakeRequest("GET", "/api/collab/projects", { token: "admin-token" }),
    );
    expect(adminResponse.status).toBe(200);
    expect(adminResponse.json().projects).toHaveLength(2);

    const memberResponse = await call(
      route,
      fakeRequest("GET", "/api/collab/projects", { token: "owner-token" }),
    );
    expect(memberResponse.status).toBe(200);
    expect(
      memberResponse
        .json()
        .projects.map(
          (project: { workspaceId: string }) => project.workspaceId,
        ),
    ).toEqual(["ws-1"]);
  });

  it("denies non-members and reports unknown projects", async () => {
    const harness = createHarness();
    const route = findRoute(harness.routes, "/api/collab/projects/detail");
    const denied = await call(
      route,
      fakeRequest("GET", "/api/collab/projects/detail?workspaceId=ws-1", {
        token: "member-token",
      }),
    );
    expect(denied.status).toBe(403);
    const missing = await call(
      route,
      fakeRequest("GET", "/api/collab/projects/detail?workspaceId=ws-404", {
        token: "admin-token",
      }),
    );
    expect(missing.status).toBe(404);
  });

  it("aggregates current task outputs and latest workflow file deliverables", async () => {
    const harness = createHarness({ outputs: true });
    const route = findRoute(harness.routes, "/api/collab/projects/outputs");
    const response = await call(
      route,
      fakeRequest("GET", "/api/collab/projects/outputs?workspaceId=ws-1", {
        token: "owner-token",
      }),
    );
    expect(response.status).toBe(200);
    const body = response.json();
    expect(body.outputs.map((output: { name: string }) => output.name)).toEqual(
      [
        "订单异常分析报告.md",
        "订单异常复盘 · 会议纪要.md",
        "meeting-notes.md",
        "review-final.pdf",
        "design.md",
        "input.pdf",
      ],
    );
    const workflowOutput = body.outputs.find(
      (output: { sourceKind: string }) => output.sourceKind === "workflow",
    );
    expect(workflowOutput).toMatchObject({
      sourceKind: "workflow",
      sourceName: "GUI 回归",
      workflowNodeName: "评审",
      documentType: "pdf",
      contentRole: "output",
      submissionId: "submission-new",
      artifactId: "artifact-new",
    });
    expect(
      body.outputs.find(
        (output: { name: string; sourceKind: string }) =>
          output.name === "design.md" && output.sourceKind === "task",
      ),
    ).toMatchObject({
      sourceKind: "task",
      sourceName: "补全项目视角",
      workflowNodeName: "设计",
      documentType: "markdown",
      contentRole: "output",
      taskId: "TSK-1",
    });
    expect(
      body.outputs.find(
        (output: { name: string }) => output.name === "input.pdf",
      ),
    ).toMatchObject({
      sourceKind: "task",
      authorName: "Peter",
      contentRole: "input",
    });
    expect(
      body.outputs.find(
        (output: { name: string }) => output.name === "meeting-notes.md",
      ),
    ).toMatchObject({
      sourceKind: "meeting",
      sourceName: "订单异常复盘",
      meetingId: "meeting-1",
      authorName: "Peter",
      contentRole: "input",
    });
    expect(
      body.outputs.find(
        (output: { minuteVersionId?: string }) =>
          output.minuteVersionId === "minute-version-1",
      ),
    ).toMatchObject({
      sourceKind: "meeting",
      contentRole: "output",
    });
    expect(
      body.outputs.find(
        (output: { sourceKind: string }) => output.sourceKind === "data-agent",
      ),
    ).toMatchObject({
      sourceKind: "data-agent",
      sourceName: "订单异常分析",
      dataAgentConversationId: "data-agent-conversation-1",
      dataAgentReportId: "data-agent-report-1",
      authorName: "Mia",
      contentRole: "output",
    });
    expect(
      body.outputs.some(
        (output: { name: string }) =>
          output.name === "review-old.pdf" ||
          output.name === "review-rejected.pdf",
      ),
    ).toBe(false);
    expect(workflowOutput.downloadUrl).toContain(
      "/api/collab/workflow/deliverables/download",
    );
    expect(
      body.outputs.find(
        (output: { name: string; sourceKind: string }) =>
          output.name === "design.md" && output.sourceKind === "task",
      ).downloadUrl,
    ).toContain("/api/collab/tasks/document/content");

    const downloadRoute = findRoute(
      harness.routes,
      "/api/collab/projects/outputs/download",
    );
    const minuteDownload = await call(
      downloadRoute,
      fakeRequest(
        "GET",
        "/api/collab/projects/outputs/download?workspaceId=ws-1&sourceKind=meeting-minutes&meetingId=meeting-1&versionId=minute-version-1",
        { token: "owner-token" },
      ),
    );
    expect(minuteDownload.status).toBe(200);
    expect(Buffer.from(minuteDownload.body).toString("utf8")).toContain(
      "确认履约异常原因",
    );
    const reportDownload = await call(
      downloadRoute,
      fakeRequest(
        "GET",
        "/api/collab/projects/outputs/download?workspaceId=ws-1&sourceKind=data-agent-report&reportId=data-agent-report-1",
        { token: "owner-token" },
      ),
    );
    expect(reportDownload.status).toBe(200);
    expect(Buffer.from(reportDownload.body).toString("utf8")).toContain(
      "支付失败集中在数码品类",
    );
  });

  it("does not deduplicate identical task files from different tasks", async () => {
    const harness = createHarness({ outputs: true, outputCollision: true });
    const route = findRoute(harness.routes, "/api/collab/projects/outputs");
    const response = await call(
      route,
      fakeRequest("GET", "/api/collab/projects/outputs?workspaceId=ws-1", {
        token: "owner-token",
      }),
    );
    expect(response.status).toBe(200);
    const designOutputs = response
      .json()
      .outputs.filter(
        (output: { name: string }) => output.name === "design.md",
      );
    expect(designOutputs).toHaveLength(2);
    expect(
      designOutputs.map((output: { sourceName: string }) => output.sourceName),
    ).toEqual(["补全项目视角", "补全运营视角"]);
  });

  it("degrades gracefully when a workspace has no materialized project roles", async () => {
    const harness = createHarness({ extraWorkspace: true });
    await harness.service.seedDefaults();
    const listRoute = findRoute(harness.routes, "/api/collab/projects");
    const listed = await call(
      listRoute,
      fakeRequest("GET", "/api/collab/projects", { token: "admin-token" }),
    );
    expect(listed.status).toBe(200);
    const body = listed.json();
    expect(
      body.projects.map(
        (project: { workspaceId: string }) => project.workspaceId,
      ),
    ).toEqual(["ws-1", "ws-2"]);
    expect(
      body.projects.map((project: { code: string }) => project.code),
    ).toEqual(["PRJ000001", "PRJ000002"]);
    expect(
      body.projects.find(
        (project: { workspaceId: string }) => project.workspaceId === "ws-2",
      ),
    ).toMatchObject({
      name: "员工平台",
      counts: {
        members: 0,
        humans: 0,
        aiPartners: 0,
        tasks: 0,
        workflows: 0,
      },
    });

    const detailRoute = findRoute(
      harness.routes,
      "/api/collab/projects/detail",
    );
    const detail = await call(
      detailRoute,
      fakeRequest("GET", "/api/collab/projects/detail?workspaceId=ws-2", {
        token: "admin-token",
      }),
    );
    expect(detail.status).toBe(200);
    expect(
      detail
        .json()
        .roles.filter((role: { system?: boolean }) => role.system !== true),
    ).toEqual([]);
    expect(detail.json().members).toEqual([
      expect.objectContaining({
        id: "tm-project-ws-2",
        kind: "agent",
        name: "PM_员工平台",
      }),
    ]);
    expect(detail.json().viewer.canManage).toBe(true);
  });

  it("returns members, project roles and AI teammates in detail", async () => {
    const harness = createHarness();
    await harness.service.seedDefaults();
    harness.assignments.assign(null, {
      workspaceId: "ws-1",
      seatId: "role-dev",
      assigneeKind: "user",
      assigneeId: "peter",
    });
    harness.assignments.assign(null, {
      workspaceId: "ws-1",
      seatId: "role-owner",
      assigneeKind: "agent",
      assigneeId: "teammate-1",
    });
    const route = findRoute(harness.routes, "/api/collab/projects/detail");
    const response = await call(
      route,
      fakeRequest("GET", "/api/collab/projects/detail?workspaceId=ws-1", {
        token: "admin-token",
      }),
    );
    expect(response.status).toBe(200);
    const body = response.json();
    expect(body.project.counts).toMatchObject({
      members: 4,
      humans: 2,
      aiPartners: 2,
    });
    const peter = body.members.find((member: any) => member.id === "peter");
    expect(peter).toMatchObject({
      principalId: "principal-human-peter",
      kind: "human",
      platformRole: "平台成员",
      workspaceRole: "member",
      joinedAt: "2026-10-02T00:00:00.000Z",
      roleNames: ["开发实施"],
      scope: "查看、编辑",
    });
    const avatar = body.members.find(
      (member: any) => member.id === "teammate-1",
    );
    expect(avatar).toMatchObject({
      principalId: "principal-ai-teammate-1",
      kind: "agent",
      name: "Research Avatar",
      platformRole: "未分配",
      avatar: "",
      source: "personal",
      roleNames: ["项目负责人"],
    });
    expect(
      body.members.find(
        (member: { id: string }) => member.id === "tm-project-ws-1",
      ),
    ).toMatchObject({
      kind: "agent",
      name: "PM_一切皆插件",
      roleNames: ["项目经理"],
    });
    expect(body.directory.humans).toEqual([
      {
        id: "mia",
        principalId: "principal-human-mia",
        name: "Mia",
        platformRole: "平台成员",
      },
    ]);
    expect(body.directory.agents).toEqual([
      {
        id: "teammate-2",
        principalId: "principal-ai-teammate-2",
        name: "小白PD",
        kindLabel: "个人分身 · Olivia",
        platformRole: "未分配",
        ownerUserId: "olivia",
        ownerName: "Olivia",
      },
      {
        id: "teammate-3",
        principalId: "principal-ai-teammate-3",
        name: "计划助手",
        kindLabel: "个人分身 · Mia",
        platformRole: "未分配",
        ownerUserId: "mia",
        ownerName: "Mia",
      },
    ]);
    expect(body.roles.map((role: any) => role.id)).toEqual([
      "role-pm",
      "role-owner",
      "role-dev",
    ]);
    expect(body.viewer.canManage).toBe(true);
  });

  it("searches addable members and includes the matched human's AI partners", async () => {
    const harness = createHarness();
    await harness.service.seedDefaults();
    harness.assignments.assign(null, {
      workspaceId: "ws-1",
      seatId: "role-owner",
      assigneeKind: "agent",
      assigneeId: "teammate-1",
    });
    const route = findRoute(
      harness.routes,
      "/api/collab/projects/members/search",
    );
    const humanSearch = await call(
      route,
      fakeRequest(
        "GET",
        "/api/collab/projects/members/search?workspaceId=ws-1&q=mia",
        { token: "admin-token" },
      ),
    );
    expect(humanSearch.status).toBe(200);
    expect(humanSearch.json().humans).toEqual([
      {
        id: "mia",
        principalId: "principal-human-mia",
        name: "Mia",
        platformRole: "平台成员",
      },
    ]);
    expect(humanSearch.json().agents).toMatchObject([
      {
        id: "teammate-3",
        name: "计划助手",
        ownerUserId: "mia",
        ownerName: "Mia",
      },
    ]);

    const ownerSearch = await call(
      route,
      fakeRequest(
        "GET",
        "/api/collab/projects/members/search?workspaceId=ws-1&q=olivia",
        { token: "admin-token" },
      ),
    );
    expect(ownerSearch.status).toBe(200);
    expect(ownerSearch.json().humans).toEqual([]);
    expect(ownerSearch.json().agents).toMatchObject([
      {
        id: "teammate-2",
        name: "小白PD",
        ownerUserId: "olivia",
        ownerName: "Olivia",
      },
    ]);

    const aiSearch = await call(
      route,
      fakeRequest(
        "GET",
        `/api/collab/projects/members/search?workspaceId=ws-1&q=${encodeURIComponent("小白")}`,
        { token: "admin-token" },
      ),
    );
    expect(aiSearch.status).toBe(200);
    expect(aiSearch.json().agents.map((item: any) => item.id)).toEqual([
      "teammate-2",
    ]);

    for (const keyword of ["Data Agent", "会议 Facilitator"]) {
      const systemSearch = await call(
        route,
        fakeRequest(
          "GET",
          `/api/collab/projects/members/search?workspaceId=ws-1&q=${encodeURIComponent(keyword)}`,
          { token: "admin-token" },
        ),
      );
      expect(systemSearch.status).toBe(200);
      expect(systemSearch.json().agents).toEqual([]);
    }

    const denied = await call(
      route,
      fakeRequest(
        "GET",
        "/api/collab/projects/members/search?workspaceId=ws-1&q=mia",
        { token: "member-token" },
      ),
    );
    expect(denied.status).toBe(403);

    const saveRoute = findRoute(
      harness.routes,
      "/api/collab/projects/members/save",
    );
    const crossOwnerAgent = await call(
      saveRoute,
      fakeRequest("POST", "/api/collab/projects/members/save", {
        token: "admin-token",
        body: {
          workspaceId: "ws-1",
          memberKind: "agent",
          memberId: "principal:principal-ai-teammate-3",
          roleIds: ["role-dev"],
        },
      }),
    );
    expect(crossOwnerAgent.status, JSON.stringify(crossOwnerAgent.json())).toBe(
      200,
    );
    expect(
      harness.assignments
        .seats("ws-1")
        .find(
          (assignment) =>
            assignment.assigneeKind === "agent" &&
            assignment.assigneeId === "teammate-3",
        ),
    ).toMatchObject({ seatId: "role-dev", status: "assigned" });

    const unassignedAgent = await call(
      saveRoute,
      fakeRequest("POST", "/api/collab/projects/members/save", {
        token: "admin-token",
        body: {
          workspaceId: "ws-1",
          memberKind: "agent",
          memberId: "principal:principal-ai-teammate-2",
          roleIds: [],
        },
      }),
    );
    expect(unassignedAgent.status).toBe(400);
    expect(unassignedAgent.json().error.message).toBe(
      "请为该 AI伙伴选择一个项目角色",
    );

    const systemAgent = await call(
      saveRoute,
      fakeRequest("POST", "/api/collab/projects/members/save", {
        token: "admin-token",
        body: {
          workspaceId: "ws-1",
          memberKind: "agent",
          memberId: "principal:principal-ai-teammate-4",
          roleIds: [],
        },
      }),
    );
    expect(systemAgent.status).toBe(400);
    expect(systemAgent.json().error.message).toBe(
      "平台内置 AI 伙伴不能作为项目成员",
    );
  });

  it("records project settings and merges collaboration identity audit history", async () => {
    const harness = createHarness();
    await harness.service.seedDefaults();
    const updateRoute = findRoute(
      harness.routes,
      "/api/collab/projects/update",
    );
    const updated = await call(
      updateRoute,
      fakeRequest("POST", "/api/collab/projects/update", {
        token: "admin-token",
        body: {
          workspaceId: "ws-1",
          status: "已完成",
          health: "关注",
          progress: 80,
        },
      }),
    );
    expect(updated.status).toBe(200);

    const memberSaveRoute = findRoute(
      harness.routes,
      "/api/collab/projects/members/save",
    );
    const memberSaved = await call(
      memberSaveRoute,
      fakeRequest("POST", "/api/collab/projects/members/save", {
        token: "admin-token",
        body: {
          workspaceId: "ws-1",
          memberKind: "human",
          memberId: "principal:principal-human-mia",
          roleIds: ["role-dev"],
          workspaceRole: "guest",
        },
      }),
    );
    expect(memberSaved.status).toBe(200);
    expect(harness.team.members("ws-1")).toContainEqual(
      expect.objectContaining({
        userId: "mia",
        memberRole: "guest",
      }),
    );

    harness.identityAudit.push({
      id: "identity-audit-1",
      at: "2026-10-16T02:00:01.000Z",
      actorId: "olivia",
      actorRole: "admin",
      action: "update_user",
      targetId: "mia",
      detail: { role: "member" },
    });

    const historyRoute = findRoute(
      harness.routes,
      "/api/collab/projects/history",
    );
    const historyResponse = await call(
      historyRoute,
      fakeRequest(
        "GET",
        "/api/collab/projects/history?workspaceId=ws-1&limit=100",
        { token: "admin-token" },
      ),
    );
    expect(historyResponse.status).toBe(200);
    const events = historyResponse.json().events as Array<Record<string, any>>;
    expect(
      events.some(
        (event) =>
          event.action === "project.settings.update" &&
          event.detail["运行状态"] === "进行中 → 已完成",
      ),
    ).toBe(true);
    expect(
      events.some(
        (event) =>
          event.action === "member.add" &&
          event.targetId === "mia" &&
          event.detail["项目角色"] === "开发实施" &&
          event.detail["工作区角色"] === "未加入 → guest",
      ),
    ).toBe(true);
    expect(
      events.some(
        (event) =>
          event.source === "identity" &&
          event.action === "identity.update.user" &&
          event.targetName === "Mia",
      ),
    ).toBe(true);

    const forbidden = await call(
      historyRoute,
      fakeRequest("GET", "/api/collab/projects/history?workspaceId=ws-1", {
        token: "member-token",
      }),
    );
    expect(forbidden.status).toBe(403);

    await harness.assignments.assign(null, {
      workspaceId: "ws-1",
      seatId: "role-owner",
      assigneeKind: "user",
      assigneeId: "peter",
    });
    const rolePermissionDoesNotGrantAudit = await call(
      historyRoute,
      fakeRequest("GET", "/api/collab/projects/history?workspaceId=ws-1", {
        token: "owner-token",
      }),
    );
    expect(rolePermissionDoesNotGrantAudit.status).toBe(403);
  });

  it("updates workspace member roles and lets a member leave the project", async () => {
    const harness = createHarness();
    await harness.service.seedDefaults();
    await harness.assignments.assign(null, {
      workspaceId: "ws-1",
      seatId: "role-dev",
      assigneeKind: "user",
      assigneeId: "peter",
    });
    const saveRoute = findRoute(
      harness.routes,
      "/api/collab/projects/members/save",
    );
    const saved = await call(
      saveRoute,
      fakeRequest("POST", "/api/collab/projects/members/save", {
        token: "admin-token",
        body: {
          workspaceId: "ws-1",
          memberKind: "human",
          memberId: "peter",
          roleIds: ["role-dev"],
          workspaceRole: "guest",
        },
      }),
    );
    expect(saved.status).toBe(200);
    expect(harness.team.members("ws-1")).toContainEqual(
      expect.objectContaining({ userId: "peter", memberRole: "guest" }),
    );

    const leaveRoute = findRoute(harness.routes, "/api/collab/projects/leave");
    const left = await call(
      leaveRoute,
      fakeRequest("POST", "/api/collab/projects/leave", {
        token: "owner-token",
        body: { workspaceId: "ws-1" },
      }),
    );
    expect(left.status).toBe(200);
    expect(
      harness.team.members("ws-1").some((member) => member.userId === "peter"),
    ).toBe(false);
    expect(
      harness.assignments
        .seats("ws-1")
        .some(
          (assignment) =>
            assignment.assigneeKind === "user" &&
            assignment.assigneeId === "peter" &&
            assignment.status === "assigned",
        ),
    ).toBe(false);
    expect(
      harness.service
        .audits("ws-1")
        .some(
          (event) =>
            event.action === "member.update" &&
            event.detail["工作区角色"] === "member → guest",
        ),
    ).toBe(true);
    expect(
      harness.service
        .audits("ws-1")
        .some(
          (event) =>
            event.action === "member.leave" && event.targetId === "peter",
        ),
    ).toBe(true);
    expect(harness.allowWorkspaceOwnerCalls).toContain("peter");
  });

  it("requires a project manager for edits and validates the owner", async () => {
    const harness = createHarness();
    const route = findRoute(harness.routes, "/api/collab/projects/update");
    const denied = await call(
      route,
      fakeRequest("POST", "/api/collab/projects/update", {
        token: "member-token",
        body: { workspaceId: "ws-1", status: "进行中" },
      }),
    );
    expect(denied.status).toBe(403);
    const invalidOwner = await call(
      route,
      fakeRequest("POST", "/api/collab/projects/update", {
        token: "admin-token",
        body: { workspaceId: "ws-1", ownerId: "mia" },
      }),
    );
    expect(invalidOwner.status).toBe(400);
    const saved = await call(
      route,
      fakeRequest("POST", "/api/collab/projects/update", {
        token: "admin-token",
        body: {
          workspaceId: "ws-1",
          ownerId: "olivia",
          status: "风险",
          health: "关注",
          progress: 72,
          startDate: "2026-09-12",
          targetDate: "2026-10-31",
          description: "统一协作体验",
        },
      }),
    );
    expect(saved.status).toBe(200);
    expect(saved.json().project).toMatchObject({
      workspaceId: "ws-1",
      ownerId: "olivia",
      ownerName: "Olivia",
      status: "风险",
      progress: 72,
    });
  });

  it("adds human members without touching platform roles", async () => {
    const harness = createHarness();
    await harness.service.seedDefaults();
    const route = findRoute(
      harness.routes,
      "/api/collab/projects/members/save",
    );
    const response = await call(
      route,
      fakeRequest("POST", "/api/collab/projects/members/save", {
        token: "admin-token",
        body: {
          workspaceId: "ws-1",
          memberKind: "human",
          memberId: "mia",
          roleIds: ["role-dev"],
        },
      }),
    );
    expect(response.status).toBe(200);
    expect(harness.addedMembers).toEqual([{ userId: "mia", role: "member" }]);
    expect(
      harness.assignments
        .seats("ws-1")
        .filter((assignment) => assignment.status === "assigned"),
    ).toMatchObject([
      { seatId: "role-dev", assigneeKind: "user", assigneeId: "mia" },
    ]);
    // 平台级账号角色未被修改：users 表保持在原样。
    expect(harness.users.find((user) => user.id === "mia")?.role).toBe(
      "member",
    );
    expect(
      harness.service
        .audits("ws-1")
        .find((event) => event.action === "member.add"),
    ).toMatchObject({
      actorPrincipalId: "principal-human-olivia",
    });
  });

  it("releases removed roles and rejects unknown project roles", async () => {
    const harness = createHarness();
    await harness.service.seedDefaults();
    const route = findRoute(
      harness.routes,
      "/api/collab/projects/members/save",
    );
    await call(
      route,
      fakeRequest("POST", "/api/collab/projects/members/save", {
        token: "admin-token",
        body: {
          workspaceId: "ws-1",
          memberKind: "human",
          memberId: "mia",
          roleIds: ["role-dev", "role-owner"],
        },
      }),
    );
    await call(
      route,
      fakeRequest("POST", "/api/collab/projects/members/save", {
        token: "admin-token",
        body: {
          workspaceId: "ws-1",
          memberKind: "human",
          memberId: "mia",
          roleIds: ["role-dev"],
        },
      }),
    );
    const active = harness.assignments
      .seats("ws-1")
      .filter((assignment) => assignment.status === "assigned");
    expect(active).toHaveLength(1);
    expect(active[0]).toMatchObject({ seatId: "role-dev" });
    const invalid = await call(
      route,
      fakeRequest("POST", "/api/collab/projects/members/save", {
        token: "admin-token",
        body: {
          workspaceId: "ws-1",
          memberKind: "human",
          memberId: "mia",
          roleIds: ["role-missing"],
        },
      }),
    );
    expect(invalid.status).toBe(400);
  });

  it("applies a project template through the assignment service", async () => {
    const harness = createHarness();
    await harness.service.seedDefaults();
    const route = findRoute(
      harness.routes,
      "/api/collab/projects/templates/apply",
    );
    const denied = await call(
      route,
      fakeRequest("POST", "/api/collab/projects/templates/apply", {
        token: "member-token",
        body: { workspaceId: "ws-1", templateId: "tpl-procurement" },
      }),
    );
    expect(denied.status).toBe(403);
    const applied = await call(
      route,
      fakeRequest("POST", "/api/collab/projects/templates/apply", {
        token: "admin-token",
        body: { workspaceId: "ws-1", templateId: "tpl-procurement" },
      }),
    );
    expect(applied.status).toBe(200);
    expect(
      harness.assignments.config("ws-1").seats.map((seat) => seat.id),
    ).toEqual([
      "role-owner",
      "role-pm",
      "role-plan",
      "role-sourcing",
      "role-contract",
      "role-follow",
      "role-escalate",
    ]);
    expect(harness.service.project("ws-1")?.templateId).toBe("tpl-procurement");
    expect(
      harness.service
        .audits("ws-1")
        .some(
          (event) =>
            event.action === "template.apply" &&
            event.targetName === "供应链采购",
        ),
    ).toBe(true);
  });

  it("copies template roles into each project and lets projects diverge", async () => {
    const harness = createHarness({ extraWorkspace: true });
    await harness.service.seedDefaults();
    const applyRoute = findRoute(
      harness.routes,
      "/api/collab/projects/templates/apply",
    );
    for (const workspaceId of ["ws-1", "ws-2"]) {
      const applied = await call(
        applyRoute,
        fakeRequest("POST", "/api/collab/projects/templates/apply", {
          token: "admin-token",
          body: { workspaceId, templateId: "tpl-plugin-dev" },
        }),
      );
      expect(applied.status).toBe(200);
    }
    const templateRoleIds = [
      "role-owner",
      "role-pm",
      "role-req",
      "role-dev",
      "role-review",
      "role-qa",
      "role-research",
    ];
    expect(
      harness.service.project("ws-1")?.projectRoles.map((role) => role.id),
    ).toEqual(templateRoleIds);
    expect(
      harness.service.project("ws-2")?.projectRoles.map((role) => role.id),
    ).toEqual(templateRoleIds);

    const saveRoute = findRoute(
      harness.routes,
      "/api/collab/projects/role/save",
    );
    const saved = await call(
      saveRoute,
      fakeRequest("POST", "/api/collab/projects/role/save", {
        token: "admin-token",
        body: {
          workspaceId: "ws-1",
          role: {
            id: "role-owner",
            name: "项目总负责人",
            code: "PROJECT_OWNER",
            category: "管理",
            description: "本项目自定义",
            permissions: ["read", "write", "approve"],
          },
        },
      }),
    );
    expect(saved.status).toBe(200);
    expect(
      harness.service
        .project("ws-1")
        ?.projectRoles.find((role) => role.id === "role-owner")?.name,
    ).toBe("项目总负责人");
    expect(
      harness.service
        .project("ws-2")
        ?.projectRoles.find((role) => role.id === "role-owner")?.name,
    ).toBe("项目负责人");
    // 模版与全局角色库不受项目内修改影响。
    expect(harness.service.role("role-owner")?.name).toBe("项目负责人");
    expect(
      harness.service
        .template("tpl-plugin-dev")
        ?.roleIds.includes("role-owner"),
    ).toBe(true);
    // 席位跟着项目副本走，两个项目互不影响。
    expect(
      harness.assignments
        .config("ws-1")
        .seats.find((seat) => seat.id === "role-owner")?.label,
    ).toBe("项目总负责人");
    expect(
      harness.assignments
        .config("ws-2")
        .seats.find((seat) => seat.id === "role-owner")?.label,
    ).toBe("项目负责人");
  });

  it("adds and removes project-scoped roles together with seats", async () => {
    const harness = createHarness();
    await harness.service.seedDefaults();
    const saveRoute = findRoute(
      harness.routes,
      "/api/collab/projects/role/save",
    );
    const saved = await call(
      saveRoute,
      fakeRequest("POST", "/api/collab/projects/role/save", {
        token: "admin-token",
        body: {
          workspaceId: "ws-1",
          role: {
            id: "role-custom",
            name: "现场协调",
            code: "SITE_COORDINATOR",
            category: "执行",
            description: "本项目专属角色",
            permissions: ["read", "write"],
          },
        },
      }),
    );
    expect(saved.status).toBe(200);
    expect(
      harness.assignments.config("ws-1").seats.map((seat) => seat.id),
    ).toContain("role-custom");

    const memberRoute = findRoute(
      harness.routes,
      "/api/collab/projects/members/save",
    );
    const assigned = await call(
      memberRoute,
      fakeRequest("POST", "/api/collab/projects/members/save", {
        token: "admin-token",
        body: {
          workspaceId: "ws-1",
          memberKind: "human",
          memberId: "peter",
          roleIds: ["role-custom"],
        },
      }),
    );
    expect(assigned.status).toBe(200);
    expect(
      harness.assignments
        .seats("ws-1")
        .some(
          (assignment) =>
            assignment.seatId === "role-custom" &&
            assignment.assigneeId === "peter" &&
            assignment.status === "assigned",
        ),
    ).toBe(true);

    const removeRoute = findRoute(
      harness.routes,
      "/api/collab/projects/role/remove",
    );
    const removed = await call(
      removeRoute,
      fakeRequest("POST", "/api/collab/projects/role/remove", {
        token: "admin-token",
        body: { workspaceId: "ws-1", roleId: "role-custom" },
      }),
    );
    expect(removed.status).toBe(200);
    expect(
      harness.service
        .project("ws-1")
        ?.projectRoles.some((role) => role.id === "role-custom"),
    ).toBe(false);
    expect(
      harness.assignments
        .config("ws-1")
        .seats.some((seat) => seat.id === "role-custom"),
    ).toBe(false);
    expect(
      harness.assignments
        .seats("ws-1")
        .some(
          (assignment) =>
            assignment.seatId === "role-custom" &&
            assignment.status === "assigned",
        ),
    ).toBe(false);
  });

  it("lists reusable role sources from projects the viewer can access", async () => {
    const harness = createHarness({ extraWorkspace: true });
    await harness.service.seedDefaults();
    const applyRoute = findRoute(
      harness.routes,
      "/api/collab/projects/templates/apply",
    );
    await call(
      applyRoute,
      fakeRequest("POST", "/api/collab/projects/templates/apply", {
        token: "admin-token",
        body: { workspaceId: "ws-1", templateId: "tpl-plugin-dev" },
      }),
    );
    await call(
      applyRoute,
      fakeRequest("POST", "/api/collab/projects/templates/apply", {
        token: "admin-token",
        body: { workspaceId: "ws-2", templateId: "tpl-employee-platform" },
      }),
    );
    const route = findRoute(
      harness.routes,
      "/api/collab/projects/role-sources",
    );
    const asAdmin = await call(
      route,
      fakeRequest("GET", "/api/collab/projects/role-sources?workspaceId=ws-1", {
        token: "admin-token",
      }),
    );
    expect(asAdmin.status).toBe(200);
    const sources = asAdmin.json().sources;
    expect(
      sources.map((source: { workspaceId: string }) => source.workspaceId),
    ).toEqual(["ws-2"]);
    expect(sources[0].roles).toHaveLength(5);

    // peter 是 ws-1 的成员，但不是 ws-2 的成员：不能把 ws-2 当复用来源。
    const asOwner = await call(
      route,
      fakeRequest("GET", "/api/collab/projects/role-sources?workspaceId=ws-1", {
        token: "owner-token",
      }),
    );
    expect(asOwner.status).toBe(200);
    expect(asOwner.json().sources).toEqual([]);
  });

  it("imports selected roles from another project without touching the source", async () => {
    const harness = createHarness({ extraWorkspace: true });
    await harness.service.seedDefaults();
    const applyRoute = findRoute(
      harness.routes,
      "/api/collab/projects/templates/apply",
    );
    for (const [workspaceId, templateId] of [
      ["ws-1", "tpl-plugin-dev"],
      ["ws-2", "tpl-procurement"],
    ] as const) {
      await call(
        applyRoute,
        fakeRequest("POST", "/api/collab/projects/templates/apply", {
          token: "admin-token",
          body: { workspaceId, templateId },
        }),
      );
    }
    const sourceBefore = harness.service
      .project("ws-2")
      ?.projectRoles.map((role) => `${role.id}:${role.name}`);
    const importRoute = findRoute(
      harness.routes,
      "/api/collab/projects/role/import",
    );
    const imported = await call(
      importRoute,
      fakeRequest("POST", "/api/collab/projects/role/import", {
        token: "admin-token",
        body: {
          workspaceId: "ws-1",
          sourceWorkspaceId: "ws-2",
          roleIds: ["role-owner", "role-plan", "role-sourcing"],
        },
      }),
    );
    expect(imported.status).toBe(200);
    expect(imported.json()).toMatchObject({ imported: 2, skipped: 1 });
    const targetRoles = harness.service
      .project("ws-1")
      ?.projectRoles.map((role) => role.id);
    expect(targetRoles).toContain("role-plan");
    expect(targetRoles).toContain("role-sourcing");
    expect(targetRoles).toContain("role-owner");
    expect(
      harness.assignments.config("ws-1").seats.map((seat) => seat.id),
    ).toContain("role-plan");
    // 来源项目、模版与角色库保持不变。
    expect(
      harness.service
        .project("ws-2")
        ?.projectRoles.map((role) => `${role.id}:${role.name}`),
    ).toEqual(sourceBefore);
    expect(
      harness.service
        .template("tpl-procurement")
        ?.roleIds.includes("role-plan"),
    ).toBe(true);
  });

  it("confirms an overwritten role set after acknowledging member impact", async () => {
    const harness = createHarness();
    await harness.service.seedDefaults();
    const applyRoute = findRoute(
      harness.routes,
      "/api/collab/projects/templates/apply",
    );
    await call(
      applyRoute,
      fakeRequest("POST", "/api/collab/projects/templates/apply", {
        token: "admin-token",
        body: { workspaceId: "ws-1", templateId: "tpl-plugin-dev" },
      }),
    );
    harness.assignments.assign(null, {
      workspaceId: "ws-1",
      seatId: "role-dev",
      assigneeKind: "user",
      assigneeId: "peter",
    });
    const current = harness.service.project("ws-1")!;
    const nextRoles = current.projectRoles.filter(
      (role) => role.code !== "IMPLEMENTER",
    );
    const confirmRoute = findRoute(
      harness.routes,
      "/api/collab/projects/roles/confirm",
    );
    const blocked = await call(
      confirmRoute,
      fakeRequest("POST", "/api/collab/projects/roles/confirm", {
        token: "admin-token",
        body: {
          workspaceId: "ws-1",
          expectedRevision: current.rolesRevision,
          roles: nextRoles,
        },
      }),
    );
    expect(blocked.status).toBe(409);
    expect(blocked.json().error).toMatchObject({
      code: "member_impact",
    });
    expect(blocked.json().error.impacts).toEqual([
      {
        memberKind: "human",
        memberId: "peter",
        memberName: "Peter",
        roles: [
          {
            roleId: "role-dev",
            roleCode: "IMPLEMENTER",
            roleName: "开发实施",
          },
        ],
      },
    ]);
    // 未确认前不落库。
    expect(
      harness.service
        .project("ws-1")
        ?.projectRoles.some((role) => role.code === "IMPLEMENTER"),
    ).toBe(true);

    const confirmed = await call(
      confirmRoute,
      fakeRequest("POST", "/api/collab/projects/roles/confirm", {
        token: "admin-token",
        body: {
          workspaceId: "ws-1",
          expectedRevision: current.rolesRevision,
          roles: nextRoles,
          ackMemberLoss: true,
        },
      }),
    );
    expect(confirmed.status).toBe(200);
    const payload = confirmed.json();
    expect(payload.revision).toBe(current.rolesRevision + 1);
    expect(payload.diff.removed).toEqual(["IMPLEMENTER"]);
    expect(
      harness.service
        .project("ws-1")
        ?.projectRoles.some((role) => role.code === "IMPLEMENTER"),
    ).toBe(false);
    expect(
      harness.service
        .audits("ws-1")
        .some((event) => event.action === "roles.confirm"),
    ).toBe(true);
    expect(
      harness.assignments
        .config("ws-1")
        .seats.some((seat) => seat.id === "role-dev"),
    ).toBe(false);
    expect(
      harness.assignments
        .seats("ws-1")
        .some(
          (assignment) =>
            assignment.seatId === "role-dev" &&
            assignment.status === "assigned",
        ),
    ).toBe(false);
    expect(harness.taskMarks).toHaveLength(1);
    expect(harness.taskMarks[0]?.roles.get("role-dev")).toBe("开发实施");
  });

  it("blocks removing a role referenced by a loaded workflow template", async () => {
    const harness = createHarness({ roleWorkflow: true });
    await harness.service.seedDefaults();
    const template = harness.service.template("tpl-plugin-dev")!;
    await harness.service.saveTemplate({
      ...template,
      workflowTemplateIds: ["definition-role"],
    });
    const applyRoute = findRoute(
      harness.routes,
      "/api/collab/projects/templates/apply",
    );
    await call(
      applyRoute,
      fakeRequest("POST", "/api/collab/projects/templates/apply", {
        token: "admin-token",
        body: { workspaceId: "ws-1", templateId: "tpl-plugin-dev" },
      }),
    );
    const current = harness.service.project("ws-1")!;
    const nextRoles = current.projectRoles.filter(
      (role) => role.code !== "PROJECT_OWNER",
    );
    const confirmRoute = findRoute(
      harness.routes,
      "/api/collab/projects/roles/confirm",
    );
    const blocked = await call(
      confirmRoute,
      fakeRequest("POST", "/api/collab/projects/roles/confirm", {
        token: "admin-token",
        body: {
          workspaceId: "ws-1",
          expectedRevision: current.rolesRevision,
          roles: nextRoles,
          ackMemberLoss: true,
        },
      }),
    );
    expect(blocked.status).toBe(409);
    expect(blocked.json().error).toMatchObject({
      code: "workflow_template_blocked",
      templates: [
        expect.objectContaining({
          templateId: "definition-role",
          nodeId: "review",
          roleCode: "PROJECT_OWNER",
        }),
      ],
    });
    expect(harness.service.project("ws-1")?.rolesRevision).toBe(1);
    expect(
      harness.service
        .project("ws-1")
        ?.projectRoles.some((role) => role.code === "PROJECT_OWNER"),
    ).toBe(true);
  });

  it("rejects stale revisions and keeps role ids stable when renaming", async () => {
    const harness = createHarness();
    await harness.service.seedDefaults();
    const applyRoute = findRoute(
      harness.routes,
      "/api/collab/projects/templates/apply",
    );
    await call(
      applyRoute,
      fakeRequest("POST", "/api/collab/projects/templates/apply", {
        token: "admin-token",
        body: { workspaceId: "ws-1", templateId: "tpl-plugin-dev" },
      }),
    );
    const current = harness.service.project("ws-1")!;
    const confirmRoute = findRoute(
      harness.routes,
      "/api/collab/projects/roles/confirm",
    );
    const conflict = await call(
      confirmRoute,
      fakeRequest("POST", "/api/collab/projects/roles/confirm", {
        token: "admin-token",
        body: {
          workspaceId: "ws-1",
          expectedRevision: 99,
          roles: current.projectRoles,
        },
      }),
    );
    expect(conflict.status).toBe(409);
    expect(conflict.json().error.code).toBe("revision_conflict");

    const renamed = current.projectRoles.map((role) =>
      role.code === "PROJECT_OWNER" ? { ...role, name: "项目总负责人" } : role,
    );
    const saved = await call(
      confirmRoute,
      fakeRequest("POST", "/api/collab/projects/roles/confirm", {
        token: "admin-token",
        body: {
          workspaceId: "ws-1",
          expectedRevision: current.rolesRevision,
          roles: renamed,
        },
      }),
    );
    expect(saved.status).toBe(200);
    const owner = harness.service
      .project("ws-1")
      ?.projectRoles.find((role) => role.code === "PROJECT_OWNER");
    expect(owner?.name).toBe("项目总负责人");
    expect(owner?.id).toBe("role-owner");
    expect(
      harness.assignments
        .config("ws-1")
        .seats.find((seat) => seat.id === "role-owner")?.label,
    ).toBe("项目总负责人");
  });

  it("does not resurrect roles after a project clears its role list", async () => {
    const harness = createHarness();
    await harness.service.seedDefaults();
    const applyRoute = findRoute(
      harness.routes,
      "/api/collab/projects/templates/apply",
    );
    await call(
      applyRoute,
      fakeRequest("POST", "/api/collab/projects/templates/apply", {
        token: "admin-token",
        body: { workspaceId: "ws-1", templateId: "tpl-plugin-dev" },
      }),
    );
    const roleIds =
      harness.service.project("ws-1")?.projectRoles.map((role) => role.id) ??
      [];
    const removeRoute = findRoute(
      harness.routes,
      "/api/collab/projects/role/remove",
    );
    for (const roleId of roleIds) {
      await call(
        removeRoute,
        fakeRequest("POST", "/api/collab/projects/role/remove", {
          token: "admin-token",
          body: { workspaceId: "ws-1", roleId },
        }),
      );
    }
    expect(
      harness.service.project("ws-1")?.projectRoles.map((role) => role.id),
    ).toEqual(["role-pm"]);
    const detailRoute = findRoute(
      harness.routes,
      "/api/collab/projects/detail",
    );
    const detail = await call(
      detailRoute,
      fakeRequest("GET", "/api/collab/projects/detail?workspaceId=ws-1", {
        token: "admin-token",
      }),
    );
    expect(detail.status).toBe(200);
    expect(
      detail
        .json()
        .roles.filter((role: { system?: boolean }) => role.system !== true),
    ).toEqual([]);
    expect(
      harness.service.project("ws-1")?.projectRoles.map((role) => role.id),
    ).toEqual(["role-pm"]);
  });

  it("saves role mapping presets for project managers and validates members", async () => {
    const harness = createHarness();
    await harness.service.seedDefaults();
    const applyRoute = findRoute(
      harness.routes,
      "/api/collab/projects/templates/apply",
    );
    await call(
      applyRoute,
      fakeRequest("POST", "/api/collab/projects/templates/apply", {
        token: "admin-token",
        body: { workspaceId: "ws-1", templateId: "tpl-plugin-dev" },
      }),
    );
    const saveRoute = findRoute(
      harness.routes,
      "/api/collab/projects/role-mappings/save",
    );
    const saved = await call(
      saveRoute,
      fakeRequest("POST", "/api/collab/projects/role-mappings/save", {
        token: "admin-token",
        body: {
          workspaceId: "ws-1",
          roleId: "role-owner",
          assignees: [{ kind: "user", id: "olivia", name: "Olivia" }],
        },
      }),
    );
    expect(saved.status).toBe(200);
    expect(
      harness.service.project("ws-1")?.roleMappingPresets["role-owner"],
    ).toMatchObject({
      assignees: [{ kind: "user", id: "olivia", name: "Olivia" }],
    });

    const outsider = await call(
      saveRoute,
      fakeRequest("POST", "/api/collab/projects/role-mappings/save", {
        token: "admin-token",
        body: {
          workspaceId: "ws-1",
          roleId: "role-owner",
          assignees: [{ kind: "user", id: "outsider", name: "Outsider" }],
        },
      }),
    );
    expect(outsider.status).toBe(400);

    const removeRoute = findRoute(
      harness.routes,
      "/api/collab/projects/role-mappings/remove",
    );
    const removed = await call(
      removeRoute,
      fakeRequest("POST", "/api/collab/projects/role-mappings/remove", {
        token: "admin-token",
        body: { workspaceId: "ws-1", roleId: "role-owner" },
      }),
    );
    expect(removed.status).toBe(200);
    expect(
      harness.service.project("ws-1")?.roleMappingPresets["role-owner"],
    ).toBeUndefined();
  });

  it("keeps template and role library writes behind the platform admin", async () => {
    const harness = createHarness();
    await harness.service.seedDefaults();
    const saveRoute = findRoute(
      harness.routes,
      "/api/collab/projects/templates/save",
    );
    const denied = await call(
      saveRoute,
      fakeRequest("POST", "/api/collab/projects/templates/save", {
        token: "owner-token",
        body: {
          id: "tpl-custom",
          name: "自定义模版",
          code: "TPL-CUSTOM",
          type: "研发类",
          status: "启用",
        },
      }),
    );
    expect(denied.status).toBe(403);
    const saved = await call(
      saveRoute,
      fakeRequest("POST", "/api/collab/projects/templates/save", {
        token: "admin-token",
        body: {
          id: "tpl-custom",
          name: "自定义模版",
          code: "TPL-CUSTOM",
          type: "研发类",
          status: "启用",
          roleIds: ["role-owner", "role-dev"],
        },
      }),
    );
    expect(saved.status).toBe(200);
    expect(saved.json().template.roleIds).toEqual(["role-owner", "role-dev"]);
    const listRoute = findRoute(
      harness.routes,
      "/api/collab/projects/templates",
    );
    const listed = await call(
      listRoute,
      fakeRequest("GET", "/api/collab/projects/templates", {
        token: "owner-token",
      }),
    );
    expect(listed.status).toBe(200);
    expect(listed.json().workflowTemplates).toHaveLength(1);
  });

  it("saves the current project roles and business chain as a reusable template", async () => {
    const harness = createHarness({ extraWorkspace: true });
    await harness.service.seedDefaults();
    businessChainWorkflowService(harness);
    const saveTemplate = findRoute(
      harness.routes,
      "/api/collab/projects/templates/save",
    );
    const created = await call(
      saveTemplate,
      fakeRequest("POST", "/api/collab/projects/templates/save", {
        token: "admin-token",
        body: {
          id: "tpl-source",
          name: "供应链项目源模版",
          code: "TPL-SOURCE",
          type: "采购类",
          status: "启用",
          roleIds: ["role-owner"],
          workflowTemplateIds: [],
          businessChainMode: "required",
          allowedBusinessChainTemplateIds: ["chain-ai-server"],
          defaultBusinessChainTemplateId: "chain-ai-server",
          versionPolicy: "latest-active",
        },
      }),
    );
    expect(created.status, JSON.stringify(created.json())).toBe(200);
    const apply = findRoute(
      harness.routes,
      "/api/collab/projects/templates/apply",
    );
    const applied = await call(
      apply,
      fakeRequest("POST", "/api/collab/projects/templates/apply", {
        token: "admin-token",
        body: { workspaceId: "ws-1", templateId: "tpl-source" },
      }),
    );
    expect(applied.status, JSON.stringify(applied.json())).toBe(200);

    const fromProject = findRoute(
      harness.routes,
      "/api/collab/projects/templates/from-project",
    );
    const denied = await call(
      fromProject,
      fakeRequest("POST", "/api/collab/projects/templates/from-project", {
        token: "owner-token",
        body: {
          workspaceId: "ws-1",
          name: "供应链交付快照",
          type: "采购类",
        },
      }),
    );
    expect(denied.status).toBe(403);

    const saved = await call(
      fromProject,
      fakeRequest("POST", "/api/collab/projects/templates/from-project", {
        token: "admin-token",
        body: {
          workspaceId: "ws-1",
          name: "供应链交付快照",
          type: "采购类",
        },
      }),
    );
    expect(saved.status, JSON.stringify(saved.json())).toBe(201);
    const template = saved.json().template as ProjectTemplateRecord;
    expect(template).toMatchObject({
      name: "供应链交付快照",
      type: "采购类",
      status: "启用",
      businessChainMode: "required",
      allowedBusinessChainTemplateIds: ["chain-ai-server"],
      defaultBusinessChainTemplateId: "chain-ai-server",
      versionPolicy: "latest-active",
    });
    expect(template.roleIds).toHaveLength(1);
    const copiedRoleId = template.roleIds[0]!;
    expect(copiedRoleId).not.toBe("role-owner");
    expect(harness.service.role(copiedRoleId)).toMatchObject({
      name: harness.service.role("role-owner")?.name,
      category: harness.service.role("role-owner")?.category,
      permissions: harness.service.role("role-owner")?.permissions,
    });

    const reused = await call(
      apply,
      fakeRequest("POST", "/api/collab/projects/templates/apply", {
        token: "admin-token",
        body: { workspaceId: "ws-2", templateId: template.id },
      }),
    );
    expect(reused.status, JSON.stringify(reused.json())).toBe(200);
    expect(harness.service.project("ws-2")).toMatchObject({
      templateId: template.id,
      businessChainBinding: {
        businessChainTemplateId: "chain-ai-server",
        projectTemplateId: template.id,
      },
    });
    expect(
      harness.service
        .project("ws-2")
        ?.projectRoles.some((role) => role.id === copiedRoleId),
    ).toBe(true);
  });

  it("only exposes template-authorized business chains and enforces revision on apply", async () => {
    const harness = createHarness();
    await harness.service.seedDefaults();
    businessChainWorkflowService(harness);
    harness.dependencies.progressSources = () => ({
      read: async () => [
        {
          system: "APS-PLANNING",
          document: "01-planning-system-mcp.md",
          status: "fresh",
          observedAt: "2026-11-18T12:00:00+08:00",
          data: {},
          isMock: true,
        },
        {
          system: "OMS",
          document: "02-order-management-system-mcp.md",
          status: "fresh",
          observedAt: "2026-11-18T12:00:00+08:00",
          data: {},
          isMock: true,
        },
        {
          system: "WMS",
          document: "03-inventory-system-mcp.md",
          status: "fresh",
          observedAt: "2026-11-18T12:00:00+08:00",
          data: {},
          isMock: true,
        },
        {
          system: "MES",
          document: "04-capacity-system-mcp.md",
          status: "fresh",
          observedAt: "2026-11-18T12:00:00+08:00",
          data: {},
          isMock: true,
        },
      ],
    });
    const saveTemplateRoute = findRoute(
      harness.routes,
      "/api/collab/projects/templates/save",
    );
    const saved = await call(
      saveTemplateRoute,
      fakeRequest("POST", "/api/collab/projects/templates/save", {
        token: "admin-token",
        body: {
          id: "tpl-chain",
          name: "AI Server 交付模版",
          code: "TPL-CHAIN",
          type: "采购类",
          status: "启用",
          roleIds: ["role-owner"],
          workflowTemplateIds: [],
          businessChainMode: "required",
          allowedBusinessChainTemplateIds: ["chain-ai-server"],
          defaultBusinessChainTemplateId: "chain-ai-server",
          versionPolicy: "pin-at-project-create",
        },
      }),
    );
    expect(saved.status).toBe(200);
    harness.members.find((member) => member.userId === "peter")!.memberRole =
      "owner";
    const applyTemplate = findRoute(
      harness.routes,
      "/api/collab/projects/templates/apply",
    );
    const applied = await call(
      applyTemplate,
      fakeRequest("POST", "/api/collab/projects/templates/apply", {
        token: "owner-token",
        body: { workspaceId: "ws-1", templateId: "tpl-chain" },
      }),
    );
    expect(applied.status, JSON.stringify(applied.json())).toBe(200);
    expect(harness.service.project("ws-1")?.businessChainBinding).toMatchObject(
      {
        businessChainTemplateId: "chain-ai-server",
        workflowDefinitionId: BUSINESS_CHAIN_DEFINITION.id,
        workflowDefinitionVersion: 3,
        bindingMode: "template-default",
      },
    );

    const candidatesRoute = findRoute(
      harness.routes,
      "/api/collab/projects/business-chain/candidates",
    );
    const candidates = await call(
      candidatesRoute,
      fakeRequest(
        "GET",
        "/api/collab/projects/business-chain/candidates?workspaceId=ws-1",
        { token: "owner-token" },
      ),
    );
    expect(candidates.status).toBe(200);
    expect(candidates.json().candidates).toEqual([
      expect.objectContaining({
        id: "chain-ai-server",
        definitionId: BUSINESS_CHAIN_DEFINITION.id,
      }),
    ]);
    expect(
      candidates
        .json()
        .candidates.some(
          (candidate: { definitionId: string }) =>
            candidate.definitionId === "definition-plain",
        ),
    ).toBe(false);

    const denied = await call(
      candidatesRoute,
      fakeRequest(
        "GET",
        "/api/collab/projects/business-chain/candidates?workspaceId=ws-1",
        { token: "member-token" },
      ),
    );
    expect(denied.status).toBe(403);

    const validateRoute = findRoute(
      harness.routes,
      "/api/collab/projects/business-chain/validate",
    );
    const validated = await call(
      validateRoute,
      fakeRequest("POST", "/api/collab/projects/business-chain/validate", {
        token: "owner-token",
        body: {
          workspaceId: "ws-1",
          definitionId: BUSINESS_CHAIN_DEFINITION.id,
          nodeBindings: [],
        },
      }),
    );
    expect(validated.status).toBe(200);
    expect(validated.json().blocking).toEqual([]);
    const bindRoute = findRoute(
      harness.routes,
      "/api/collab/projects/business-chain/bind",
    );
    const current = harness.service.project("ws-1")!;
    const rebound = await call(
      bindRoute,
      fakeRequest("POST", "/api/collab/projects/business-chain/bind", {
        token: "owner-token",
        body: {
          workspaceId: "ws-1",
          definitionId: BUSINESS_CHAIN_DEFINITION.id,
          nodeBindings: [],
          revision: current.businessChainRevision,
          validationDigest: validated.json().digest,
        },
      }),
    );
    expect(rebound.status, JSON.stringify(rebound.json())).toBe(200);
    const conflict = await call(
      bindRoute,
      fakeRequest("POST", "/api/collab/projects/business-chain/bind", {
        token: "owner-token",
        body: {
          workspaceId: "ws-1",
          definitionId: BUSINESS_CHAIN_DEFINITION.id,
          nodeBindings: [],
          revision: current.businessChainRevision,
          validationDigest: validated.json().digest,
        },
      }),
    );
    expect(conflict.status).toBe(409);
    expect(conflict.json().error.code).toBe("revision_conflict");

    const nonBusiness = await call(
      bindRoute,
      fakeRequest("POST", "/api/collab/projects/business-chain/bind", {
        token: "owner-token",
        body: {
          workspaceId: "ws-1",
          definitionId: "definition-plain",
          nodeBindings: [],
          revision: harness.service.project("ws-1")!.businessChainRevision,
          validationDigest: "sha256:plain",
        },
      }),
    );
    expect(nonBusiness.status).toBe(400);
  });

  it("returns a partial progress read model instead of 500 when a source times out", async () => {
    const harness = createHarness();
    await harness.service.seedDefaults();
    businessChainWorkflowService(harness);
    await harness.service.saveTemplate({
      id: "tpl-chain",
      name: "AI Server 交付模版",
      code: "TPL-CHAIN",
      type: "采购类",
      status: "启用",
      roleIds: ["role-owner"],
      workflowTemplateIds: [],
      businessChainMode: "required",
      allowedBusinessChainTemplateIds: ["chain-ai-server"],
      defaultBusinessChainTemplateId: "chain-ai-server",
      versionPolicy: "pin-at-project-create",
    });
    await harness.service.upsertProject({
      workspaceId: "ws-1",
      code: "SO0101",
      templateId: "tpl-chain",
    });
    await harness.service.saveBusinessChainBinding({
      workspaceId: "ws-1",
      expectedRevision: 1,
      binding: {
        projectTemplateId: "tpl-chain",
        businessChainTemplateId: "chain-ai-server",
        workflowDefinitionId: BUSINESS_CHAIN_DEFINITION.id,
        workflowDefinitionVersion: 3,
        workflowInstanceId: "wf-chain-1",
        chainKey: "ai-server-delivery",
        bindingMode: "template-default",
        sourceTemplateRevision: 1,
        nodeBindings: [],
        boundBy: "olivia",
      },
    });
    harness.dependencies.progressSources = () => ({
      read: async () => {
        throw new Error("source timeout");
      },
    });
    const route = findRoute(
      harness.routes,
      "/api/collab/projects/progress-overview",
    );
    const response = await call(
      route,
      fakeRequest(
        "GET",
        "/api/collab/projects/progress-overview?workspaceId=ws-1",
        { token: "owner-token" },
      ),
    );
    expect(response.status).toBe(200);
    expect(response.json().overview.coverage.status).toBe("partial");
    expect(response.json().overview.nodes.length).toBeGreaterThan(0);
  });

  it("uploads project demo data and overlays progress node fields", async () => {
    const harness = createHarness();
    await harness.service.seedDefaults();
    businessChainWorkflowService(harness);
    await harness.service.saveTemplate({
      id: "tpl-chain",
      name: "AI Server 交付模版",
      code: "TPL-CHAIN",
      type: "采购类",
      status: "启用",
      roleIds: ["role-owner"],
      workflowTemplateIds: [],
      businessChainMode: "required",
      allowedBusinessChainTemplateIds: ["chain-ai-server"],
      defaultBusinessChainTemplateId: "chain-ai-server",
      versionPolicy: "pin-at-project-create",
    });
    await harness.service.upsertProject({
      workspaceId: "ws-1",
      code: "SO0101",
      templateId: "tpl-chain",
    });
    await harness.service.saveBusinessChainBinding({
      workspaceId: "ws-1",
      expectedRevision: 1,
      binding: {
        projectTemplateId: "tpl-chain",
        businessChainTemplateId: "chain-ai-server",
        workflowDefinitionId: BUSINESS_CHAIN_DEFINITION.id,
        workflowDefinitionVersion: 3,
        workflowInstanceId: "wf-chain-1",
        chainKey: "ai-server-delivery",
        bindingMode: "template-default",
        sourceTemplateRevision: 1,
        nodeBindings: [],
        boundBy: "olivia",
      },
    });
    harness.dependencies.progressSources = () => ({
      read: async () => [],
    });
    const upload = await call(
      findRoute(harness.routes, "/api/collab/projects/demo-data/upload"),
      fakeRequest("POST", "/api/collab/projects/demo-data/upload", {
        token: "admin-token",
        body: {
          workspaceId: "ws-1",
          fileName: "demo-data.json",
          data: {
            schemaVersion: "project-demo-data-v1",
            nodes: {
              "order-intake": {
                status: "completed",
                owner: "演示负责人",
                fields: {
                  planned: "999 台 · 2026-12-31",
                },
              },
              "supply-prep": {
                status: "blocked",
                owner: "采购演示负责人",
                exception: "GPU 到货延迟",
                fields: {
                  actual: "184 套",
                },
              },
            },
            changeEvents: [
              {
                id: "demo-1",
                category: "order",
                at: "2026-11-18T09:30:00+08:00",
                description: "客户确认新的交付窗口",
                source: "演示数据",
                linkedNodeIds: ["order-intake"],
              },
            ],
          },
        },
      }),
    );
    expect(upload.status, JSON.stringify(upload.json())).toBe(200);
    expect(harness.service.project("ws-1")?.demoDataConfig).toMatchObject({
      fileName: "demo-data.json",
    });

    const overview = await call(
      findRoute(harness.routes, "/api/collab/projects/progress-overview"),
      fakeRequest(
        "GET",
        "/api/collab/projects/progress-overview?workspaceId=ws-1",
        { token: "admin-token" },
      ),
    );
    expect(overview.status).toBe(200);
    const orderNode = overview
      .json()
      .overview.nodes.find(
        (node: { id: string }) => node.id === "order-intake",
      );
    expect(orderNode).toMatchObject({
      owner: "演示负责人",
      status: "completed",
      fields: [
        {
          key: "planned",
          label: "原计划",
          value: "999 台 · 2026-12-31",
        },
      ],
    });
    expect(
      overview
        .json()
        .overview.nodes.find(
          (node: { id: string }) => node.id === "supply-prep",
        ),
    ).toMatchObject({
      status: "blocked",
      exceptionText: "GPU 到货延迟",
    });
    expect(overview.json().overview.changeEvents).toEqual([
      expect.objectContaining({
        id: "demo-1",
        description: "客户确认新的交付窗口",
        linkedNodeIds: ["order-intake"],
      }),
    ]);
  });

  it("keeps business-chain instances and projected tasks out of project views", async () => {
    const harness = createHarness();
    await harness.service.seedDefaults();
    const { chainTask } = businessChainWorkflowService(harness);
    await harness.service.upsertProject({
      workspaceId: "ws-1",
      code: "SO0101",
    });
    const manualTask = {
      ...chainTask,
      id: "TSK-MANUAL",
      title: "手工任务",
      workflow: undefined,
      executionAnomaly: undefined,
      status: "todo",
    };
    harness.dependencies.tasks = () => ({
      list: () => [chainTask, manualTask],
      markRoleUnavailable: async () => 0,
    });
    const response = await call(
      findRoute(harness.routes, "/api/collab/projects/detail"),
      fakeRequest("GET", "/api/collab/projects/detail?workspaceId=ws-1", {
        token: "owner-token",
      }),
    );
    expect(response.status).toBe(200);
    expect(response.json().workflows).toEqual([]);
    expect(
      response.json().tasks.map((task: { id: string }) => task.id),
    ).toEqual(["TSK-MANUAL"]);
  });

  it("binds a project-uploaded custom business chain without a template whitelist", async () => {
    const harness = createHarness();
    businessChainWorkflowService(harness);
    harness.dependencies.progressSources = () => ({
      read: async () => [
        {
          system: "APS-PLANNING",
          document: "01-planning-system-mcp.md",
          status: "fresh",
          data: {},
          isMock: true,
        },
        {
          system: "OMS",
          document: "02-order-management-system-mcp.md",
          status: "fresh",
          data: {},
          isMock: true,
        },
        {
          system: "WMS",
          document: "03-inventory-system-mcp.md",
          status: "fresh",
          data: {},
          isMock: true,
        },
        {
          system: "MES",
          document: "04-capacity-system-mcp.md",
          status: "fresh",
          data: {},
          isMock: true,
        },
      ],
    });
    const route = findRoute(
      harness.routes,
      "/api/collab/projects/business-chain/custom",
    );
    const response = await call(
      route,
      fakeRequest("POST", "/api/collab/projects/business-chain/custom", {
        token: "admin-token",
        body: {
          workspaceId: "ws-1",
          definitionId: BUSINESS_CHAIN_DEFINITION.id,
          nodeBindings: [],
          revision: 1,
        },
      }),
    );
    expect(response.status, JSON.stringify(response.json())).toBe(200);
    expect(harness.service.project("ws-1")?.businessChainBinding).toMatchObject(
      {
        bindingMode: "project-custom",
        workflowDefinitionId: BUSINESS_CHAIN_DEFINITION.id,
        projectTemplateId: "project-custom",
      },
    );
    const config = await call(
      findRoute(harness.routes, "/api/collab/projects/business-chain"),
      fakeRequest(
        "GET",
        "/api/collab/projects/business-chain?workspaceId=ws-1",
        { token: "admin-token" },
      ),
    );
    expect(config.json().businessChain).toMatchObject({
      configured: true,
      sourceState: "fresh",
      current: { bindingMode: "project-custom" },
    });
    const validation = await call(
      findRoute(harness.routes, "/api/collab/projects/business-chain/validate"),
      fakeRequest("POST", "/api/collab/projects/business-chain/validate", {
        token: "admin-token",
        body: {
          workspaceId: "ws-1",
          definitionId: BUSINESS_CHAIN_DEFINITION.id,
          nodeBindings: [],
        },
      }),
    );
    expect(validation.status).toBe(200);
    expect(validation.json().blocking).toEqual([]);
    expect(
      validation
        .json()
        .blocking.some(
          (issue: { code: string }) => issue.code === "template_missing",
        ),
    ).toBe(false);
    const rebound = await call(
      findRoute(harness.routes, "/api/collab/projects/business-chain/bind"),
      fakeRequest("POST", "/api/collab/projects/business-chain/bind", {
        token: "admin-token",
        body: {
          workspaceId: "ws-1",
          definitionId: BUSINESS_CHAIN_DEFINITION.id,
          nodeBindings: [],
          revision: harness.service.project("ws-1")!.businessChainRevision,
          validationDigest: validation.json().digest,
        },
      }),
    );
    expect(rebound.status, JSON.stringify(rebound.json())).toBe(200);
    expect(rebound.json().businessChain.current.bindingMode).toBe(
      "project-custom",
    );
    const attached = await call(
      findRoute(harness.routes, "/api/collab/projects/business-chain/instance"),
      fakeRequest("POST", "/api/collab/projects/business-chain/instance", {
        token: "admin-token",
        body: {
          workspaceId: "ws-1",
          instanceId: "wf-chain-1",
          revision: harness.service.project("ws-1")!.businessChainRevision,
        },
      }),
    );
    expect(attached.status, JSON.stringify(attached.json())).toBe(200);
    expect(attached.json().businessChain.current.workflowInstanceId).toBe(
      "wf-chain-1",
    );
  });

  it("builds a sourced progress read model and upserts stable alerts idempotently", async () => {
    const harness = createHarness();
    const { instances, chainTask } = businessChainWorkflowService(harness);
    await harness.service.seedDefaults();
    await harness.service.saveTemplate({
      id: "tpl-chain",
      name: "AI Server 交付模版",
      code: "TPL-CHAIN",
      type: "采购类",
      status: "启用",
      roleIds: ["role-owner"],
      workflowTemplateIds: [],
      businessChainMode: "required",
      allowedBusinessChainTemplateIds: ["chain-ai-server"],
      defaultBusinessChainTemplateId: "chain-ai-server",
      versionPolicy: "pin-at-project-create",
    });
    await harness.service.upsertProject({
      workspaceId: "ws-1",
      code: "SO0101",
      templateId: "tpl-chain",
    });
    const project = await harness.service.saveBusinessChainBinding({
      workspaceId: "ws-1",
      expectedRevision: 1,
      binding: {
        projectTemplateId: "tpl-chain",
        businessChainTemplateId: "chain-ai-server",
        workflowDefinitionId: BUSINESS_CHAIN_DEFINITION.id,
        workflowDefinitionVersion: 3,
        workflowInstanceId: "wf-chain-1",
        chainKey: "ai-server-delivery",
        bindingMode: "template-default",
        sourceTemplateRevision: 1,
        nodeBindings: [],
        boundBy: "olivia",
      },
    });
    const builder = new ProjectProgressOverviewService({
      sources: new MockScenarioSourceRegistry({
        docsRoot: resolve(
          import.meta.dirname,
          "../../../docs/project-progress-overview",
        ),
      }),
      now: () => new Date("2026-11-18T04:30:00.000Z"),
    });
    const detailed = await builder.buildDetailed({
      project,
      template: harness.service.template("tpl-chain"),
      definition: BUSINESS_CHAIN_DEFINITION,
      instance: instances[0],
      tasks: [chainTask],
      reports: [],
      events: [
        {
          id: "event-chain-1",
          nodeId: "supply-prep",
          kind: "agent.dispatch_failed",
          message: "供应计划同步失败",
          at: "2026-11-18T02:10:00.000Z",
        },
      ],
    });
    expect(detailed.overview.businessChain).toMatchObject({
      definitionId: BUSINESS_CHAIN_DEFINITION.id,
      definitionVersion: 3,
      instanceId: "wf-chain-1",
    });
    expect(detailed.overview.coverage.status).toBe("stale");
    const supply = detailed.overview.nodes.find(
      (node) => node.id === "supply-prep",
    );
    expect(supply).toMatchObject({
      stageCode: "SUPPLY_PREP",
      plannedLabel: "200 · 2026-11-25",
      revisedLabel: "186 · 2026-11-30",
      owner: "Peter",
      statusLabel: "阻塞",
    });
    expect(supply?.fields).toEqual([
      { key: "planned", label: "原计划", value: "200 · 2026-11-25" },
      { key: "revised", label: "变更后", value: "186 · 2026-11-30" },
      { key: "actual", label: "实际完成", value: "96" },
    ]);
    expect(detailed.overview.changeEvents.length).toBeGreaterThan(4);
    expect(detailed.overview.changeEvents.map((event) => event.at)).toEqual(
      [...detailed.overview.changeEvents]
        .map((event) => event.at)
        .sort((left, right) => left.localeCompare(right)),
    );
    expect(
      detailed.alertCandidates.some(
        (alert) => alert.conditionKey === "WMS:GPU-MODULE-H:timing-gap",
      ),
    ).toBe(true);

    const first = await harness.service.upsertProjectAlerts(
      "ws-1",
      detailed.alertCandidates,
      {
        observedAt: detailed.overview.generatedAt,
        staleConditionKeys: detailed.staleConditionKeys,
      },
    );
    const idsByCondition = Object.fromEntries(
      first.map((alert) => [alert.conditionKey, alert.alertId]),
    );
    expect(
      first.find(
        (alert) => alert.conditionKey === "WMS:GPU-MODULE-H:timing-gap",
      )?.lifecycle,
    ).toBe("stale");
    const second = await harness.service.upsertProjectAlerts(
      "ws-1",
      detailed.alertCandidates,
      {
        observedAt: "2026-11-18T05:00:00.000Z",
        staleConditionKeys: detailed.staleConditionKeys,
      },
    );
    expect(
      Object.fromEntries(
        second.map((alert) => [alert.conditionKey, alert.alertId]),
      ),
    ).toEqual(idsByCondition);

    const hydrated = hydrateOverviewAlerts(detailed.overview, second);
    expect(hydrated.alerts.length).toBeGreaterThan(0);
    expect(
      hydrated.nodes.find((node) => node.id === "supply-prep")?.alerts.length,
    ).toBeGreaterThan(0);
  });

  it("generates a deterministic daily report and lists it", async () => {
    const harness = createHarness();
    await harness.service.seedDefaults();
    await harness.service.upsertProject({
      workspaceId: "ws-1",
      ownerId: "olivia",
      ownerName: "Olivia",
      progress: 72,
      status: "风险",
      health: "关注",
      targetDate: "2026-10-31",
    });
    harness.dependencies.skillCatalog = () => ({
      resolveSkills: async () => [
        {
          id: "skill-project-reporting",
          name: "项目汇报生成",
          version: "2.4.1",
          instructions: "- 使用资源市场当前发布的项目汇报指令。",
        },
      ],
    });
    const generate = findRoute(
      harness.routes,
      "/api/collab/projects/reports/generate",
    );
    const response = await call(
      generate,
      fakeRequest("POST", "/api/collab/projects/reports/generate", {
        token: "admin-token",
        body: { workspaceId: "ws-1" },
      }),
    );
    expect(response.status).toBe(200);
    const report = response.json().report;
    expect(report.date).toBe("2026-10-16");
    expect(report.generatedAt).toBe("2026-10-16T02:00:00.000Z");
    expect(report.generatedBy).toBe("PM_一切皆插件");
    expect(report.generatedByTeammateId).toBe("tm-project-ws-1");
    expect(report.skillVersion).toBe("2.4.1");
    expect(report.content).toContain("## 一句话结论");
    expect(report.content).toContain("综合健康度判定为「风险」");
    expect(report.content).toContain("## 项目健康度与计划偏差");
    expect(report.content).toContain("## 关键结果");
    expect(report.content).toContain("## 业务数据异常");
    expect(report.content).toContain("## 推进异常");
    expect(report.content).toContain("## 待确认与下一步");
    expect(report.content).toContain("工作流「GUI 回归」当前阻塞");
    expect(report.content).toContain("P1 任务 `TSK-1`");
    expect(report.content).toContain("`TSK-1`");
    expect(
      harness.service
        .audits("ws-1")
        .some(
          (event) =>
            event.action === "report.generate" &&
            event.targetId === "2026-10-16",
        ),
    ).toBe(true);

    const weekly = await call(
      generate,
      fakeRequest("POST", "/api/collab/projects/reports/generate", {
        token: "admin-token",
        body: {
          workspaceId: "ws-1",
          reportType: "weekly",
          triggerSource: "chat",
        },
      }),
    );
    expect(weekly.status).toBe(200);
    expect(weekly.json().report).toMatchObject({
      reportType: "weekly",
      triggerSource: "chat",
      skillId: "skill-project-reporting",
      skillVersion: "2.4.1",
    });
    expect(weekly.json().report.content).toContain("## 本周结论");
    expect(weekly.json().report.content).toContain("## 下周计划");
    expect(weekly.json().report.sourceRefs).toContain("task:TSK-1");

    const list = findRoute(harness.routes, "/api/collab/projects/reports");
    const listed = await call(
      list,
      fakeRequest("GET", "/api/collab/projects/reports?workspaceId=ws-1", {
        token: "owner-token",
      }),
    );
    expect(listed.status).toBe(200);
    expect(listed.json().reports).toHaveLength(2);

    const denied = await call(
      generate,
      fakeRequest("POST", "/api/collab/projects/reports/generate", {
        token: "member-token",
        body: { workspaceId: "ws-1" },
      }),
    );
    expect(denied.status).toBe(403);
  });

  it("persists project report schedules and generates due reports once", async () => {
    const harness = createHarness();
    await harness.service.seedDefaults();
    await harness.service.upsertProject({
      workspaceId: "ws-1",
      ownerId: "olivia",
      ownerName: "Olivia",
    });
    harness.dependencies.skillCatalog = () => ({
      resolveSkills: async () => [
        {
          id: "skill-project-reporting",
          name: "项目汇报生成",
          version: "2.5.0",
          instructions: "- 定时日报使用资源市场当前发布指令。",
        },
      ],
    });

    const scheduleRoute = findRoute(
      harness.routes,
      "/api/collab/projects/reports/schedule",
    );
    const saved = await call(
      scheduleRoute,
      fakeRequest("POST", "/api/collab/projects/reports/schedule", {
        token: "admin-token",
        body: {
          workspaceId: "ws-1",
          schedule: {
            enabled: true,
            frequency: "weekdays",
            time: "08:30",
            timezone: "Asia/Shanghai",
            weekday: 1,
            dayOfMonth: 1,
          },
        },
      }),
    );
    expect(saved.status).toBe(200);
    expect(saved.json().reportSchedule).toMatchObject({
      enabled: true,
      frequency: "weekdays",
      time: "08:30",
      timezone: "Asia/Shanghai",
    });
    expect(harness.service.project("ws-1")?.reportSchedule.time).toBe("08:30");
    expect(
      harness.service
        .audits("ws-1")
        .some((event) => event.action === "report.schedule.update"),
    ).toBe(true);

    const first = await runScheduledProjectReports(
      harness.service,
      harness.dependencies,
    );
    expect(first.generated).toBe(1);
    const reports = harness.service.reports("ws-1");
    expect(reports).toHaveLength(1);
    expect(reports[0]).toMatchObject({
      date: "2026-10-16",
      generatedAt: "2026-10-16T02:00:00.000Z",
      reportType: "daily",
      triggerSource: "schedule",
      skillId: "skill-project-reporting",
      skillVersion: "2.5.0",
    });
    const second = await runScheduledProjectReports(
      harness.service,
      harness.dependencies,
    );
    expect(second).toMatchObject({ generated: 0, skipped: 1 });
    expect(harness.service.reports("ws-1")).toHaveLength(1);
  });

  it("evaluates daily, weekday, weekly and monthly report schedules", () => {
    const monday = projectReportScheduleClock(
      new Date("2026-11-16T00:30:00.000Z"),
      "Asia/Shanghai",
    );
    const schedule = {
      enabled: true,
      frequency: "weekly" as const,
      time: "08:00",
      timezone: "Asia/Shanghai",
      weekday: 1,
      dayOfMonth: 16,
    };
    expect(monday).toMatchObject({
      date: "2026-11-16",
      time: "08:30",
      weekday: 1,
      dayOfMonth: 16,
    });
    expect(isProjectReportScheduleDue(schedule, monday)).toBe(true);
    expect(
      isProjectReportScheduleDue({ ...schedule, frequency: "daily" }, monday),
    ).toBe(true);
    expect(
      isProjectReportScheduleDue(
        { ...schedule, frequency: "weekdays" },
        monday,
      ),
    ).toBe(true);
    expect(
      isProjectReportScheduleDue({ ...schedule, frequency: "monthly" }, monday),
    ).toBe(true);
    expect(
      isProjectReportScheduleDue(
        { ...schedule, frequency: "weekly", weekday: 2 },
        monday,
      ),
    ).toBe(false);
    expect(
      isProjectReportScheduleDue(
        { ...schedule, frequency: "daily", time: "09:00" },
        monday,
      ),
    ).toBe(false);
    expect(
      isProjectReportScheduleDue({ ...schedule, enabled: false }, monday),
    ).toBe(false);
  });

  it("uses the project manager agent when its report passes fact validation", async () => {
    const harness = createHarness();
    await harness.service.seedDefaults();
    const project = await harness.service.upsertProject({
      workspaceId: "ws-1",
      ownerId: "olivia",
      ownerName: "Olivia",
      progress: 40,
      startDate: "2026-10-01",
      targetDate: "2026-10-31",
    });
    const projectManager = await harness.teammates.ensureProjectManagerAgent({
      workspaceId: "ws-1",
      projectName: "一切皆插件",
      actor: {
        userId: "olivia",
        name: "Olivia",
        role: "admin",
      },
    });
    const baseline = buildProjectReportContent({
      project,
      workspace: harness.workspace,
      tasks: [],
      workflows: [],
      today: "2026-10-16",
      reportType: "daily",
    });
    const run = {
      id: "run-project-report",
      workspaceId: "ws-1",
      source: "chat" as const,
      instanceId: "project-report-ws-1",
      createdBy: "olivia",
      status: "succeeded",
      output: { summary: baseline },
    };
    let dispatchedInstruction = "";
    const skillCatalog: NonNullable<
      ProjectDependencies["skillCatalog"]
    > = () => ({
      resolveSkills: async () => [
        {
          id: "skill-project-reporting",
          name: "项目汇报生成",
          version: "1.3.0",
          instructions:
            "- 使用资源市场版本的项目汇报结构。\n- 先写结论，再写证据。",
        },
      ],
    });
    const agent: NonNullable<ProjectDependencies["agent"]> = () => ({
      run: () => run,
      runs: () => [run],
      dispatch: async (input) => {
        dispatchedInstruction = String(input.payload.context.instruction);
        return run;
      },
    });
    const dependencies = {
      ...harness.dependencies,
      skillCatalog,
      agent,
    };
    const generated = await generateProjectReportContent({
      dependencies,
      workspace: harness.workspace,
      project,
      projectManager,
      current: { userId: "olivia", role: "admin" },
      tasks: [],
      workflows: [],
      date: "2026-10-16",
      reportType: "daily",
    });
    expect(generated).toMatchObject({
      generationMode: "agent",
      skillId: "skill-project-reporting",
      skillVersion: "1.3.0",
      agentRunId: "run-project-report",
      content: baseline,
    });
    expect(dispatchedInstruction).toContain("## 场景 Skill 指令");
    expect(dispatchedInstruction).toContain("使用资源市场版本的项目汇报结构");
    expect(dispatchedInstruction).toContain("项目健康度与计划偏差");
    expect(dispatchedInstruction).toContain("业务数据异常");
    expect(dispatchedInstruction).toContain("推进异常");
    expect(dispatchedInstruction).toContain("## 项目事实包");
    expect(generated.generationError).toBeUndefined();
  });

  it("falls back when the project manager agent adds unsupported numbers", async () => {
    const harness = createHarness();
    await harness.service.seedDefaults();
    const project = await harness.service.upsertProject({
      workspaceId: "ws-1",
      ownerId: "olivia",
      ownerName: "Olivia",
      progress: 40,
    });
    const projectManager = await harness.teammates.ensureProjectManagerAgent({
      workspaceId: "ws-1",
      projectName: "一切皆插件",
      actor: {
        userId: "olivia",
        name: "Olivia",
        role: "admin",
      },
    });
    const baseline = buildProjectReportContent({
      project,
      workspace: harness.workspace,
      tasks: [],
      workflows: [],
      today: "2026-10-16",
      reportType: "daily",
    });
    const run = {
      id: "run-invalid-report",
      workspaceId: "ws-1",
      source: "chat" as const,
      instanceId: "project-report-ws-1",
      createdBy: "olivia",
      status: "succeeded",
      output: { summary: `${baseline}\n- 新增未支持数字 999。` },
    };
    const generated = await generateProjectReportContent({
      dependencies: {
        ...harness.dependencies,
        skillCatalog: () => ({
          resolveSkills: async () => [
            {
              id: "skill-project-reporting",
              version: "1.0.0",
              instructions: "- 使用项目汇报结构。",
            },
          ],
        }),
        agent: () => ({
          run: () => run,
          runs: () => [run],
          dispatch: async () => run,
        }),
      },
      workspace: harness.workspace,
      project,
      projectManager,
      current: { userId: "olivia", role: "admin" },
      tasks: [],
      workflows: [],
      date: "2026-10-16",
      reportType: "daily",
    });
    expect(generated).toMatchObject({
      generationMode: "deterministic_fallback",
      agentRunId: "run-invalid-report",
      content: baseline,
    });
    expect(generated.generationError).toContain("事实包之外的数字");
  });

  it("registers directories as projects and claims the creator as owner", async () => {
    const harness = createHarness({ extraWorkspace: true });
    await harness.service.seedDefaults();
    const route = findRoute(harness.routes, "/api/collab/projects/create");
    const response = await call(
      route,
      fakeRequest("POST", "/api/collab/projects/create", {
        token: "owner-token",
        body: {
          path: "/tmp/new-project",
          name: "新项目",
          templateId: "tpl-plugin-dev",
        },
      }),
    );
    expect(response.status).toBe(201);
    expect(response.json().workspaceId).toBe("ws-2");
    expect(response.json().projectManager).toMatchObject({
      id: "tm-project-ws-2",
      name: "PM_新项目",
      source: "platform",
    });
    expect(harness.service.project("ws-2")).toMatchObject({
      ownerId: "peter",
      ownerName: "Peter",
      templateId: "tpl-plugin-dev",
    });
    expect(
      harness.service
        .project("ws-2")
        ?.projectRoles.some((role) => role.id === "role-pm"),
    ).toBe(true);
    expect(
      harness.assignments
        .seats("ws-2")
        .some(
          (seat) =>
            seat.seatId === "role-pm" &&
            seat.assigneeKind === "agent" &&
            seat.assigneeId === "tm-project-ws-2" &&
            seat.status !== "released",
        ),
    ).toBe(true);
    const detail = await call(
      findRoute(harness.routes, "/api/collab/projects/detail"),
      fakeRequest("GET", "/api/collab/projects/detail?workspaceId=ws-2", {
        token: "admin-token",
      }),
    );
    expect(detail.json().project.counts).toMatchObject({
      aiPartners: 1,
    });
    expect(harness.selfOwnerBootstrapCalls).toContain("peter");
  });
});

describe("report content", () => {
  it("summarises tasks, workflows and risk items", () => {
    const content = buildProjectReportContent({
      project: {
        workspaceId: "ws-1",
        code: "PRJ-001",
        ownerId: "olivia",
        ownerName: "Olivia",
        status: "进行中",
        health: "健康",
        progress: 40,
        startDate: "2026-10-01",
        targetDate: "2026-10-31",
        description: "",
        projectRoles: [],
        roleMappingPresets: {},
        rolesInitialized: true,
        rolesRevision: 1,
        businessChainRevision: 1,
        reportSchedule: {
          enabled: true,
          frequency: "daily",
          time: "08:00",
          timezone: "Asia/Shanghai",
          weekday: 1,
          dayOfMonth: 1,
        },
        createdAt: "2026-10-01T00:00:00.000Z",
        updatedAt: "2026-10-01T00:00:00.000Z",
      },
      workspace: { id: "ws-1", title: "一切皆插件", path: "/tmp/ws-1" },
      tasks: [
        {
          id: "TSK-9",
          title: "逾期任务",
          status: "progress",
          priority: "P1",
          receiverType: "unassigned",
          due: "2026-10-10",
          createdAt: "2026-10-01T00:00:00.000Z",
          updatedAt: "2026-10-02T00:00:00.000Z",
        },
        {
          id: "TSK-8",
          title: "替代供应商交期确认",
          status: "done",
          priority: "P2",
          receiverType: "human",
          receiverName: "Olivia",
          createdAt: "2026-10-15T00:00:00.000Z",
          updatedAt: "2026-10-16T02:00:00.000Z",
          comments: [
            {
              id: "comment-1",
              at: "2026-10-16T02:00:00.000Z",
              authorName: "Olivia",
              content: "替代供应商交期 12 天，可覆盖受影响订单 29 张。",
              isKeyConsensus: true,
            },
          ],
        },
      ],
      workflows: [],
      today: "2026-10-16",
    });
    expect(content).toContain("实际 40%");
    expect(content).toContain("计划 50%，偏差 -10 个百分点");
    expect(content).toContain("已超过截止日期 2026-10-10");
    expect(content).toContain("替代供应商交期 12 天");
    expect(content).not.toContain("- 最近更新的任务：");
    const healthy = buildProjectReportContent({
      project: {
        workspaceId: "ws-1",
        code: "PRJ-001",
        ownerId: "olivia",
        ownerName: "Olivia",
        status: "进行中",
        health: "健康",
        progress: 60,
        startDate: "",
        targetDate: "",
        description: "",
        projectRoles: [],
        roleMappingPresets: {},
        rolesInitialized: true,
        rolesRevision: 1,
        businessChainRevision: 1,
        reportSchedule: {
          enabled: true,
          frequency: "daily",
          time: "08:00",
          timezone: "Asia/Shanghai",
          weekday: 1,
          dayOfMonth: 1,
        },
        createdAt: "2026-10-01T00:00:00.000Z",
        updatedAt: "2026-10-01T00:00:00.000Z",
      },
      workspace: { id: "ws-1", title: "一切皆插件", path: "/tmp/ws-1" },
      tasks: [],
      workflows: [],
      today: "2026-10-16",
    });
    expect(healthy).toContain("综合健康度判定为「健康」");
    expect(healthy).toContain("未捕获到已确认的任务或工作流结果");
    expect(healthy).toContain("无法计算计划进度与偏差");
  });

  it("flags schedule variance, stalled nodes and pending approvals", () => {
    const content = buildProjectReportContent({
      project: {
        workspaceId: "ws-1",
        code: "PRJ-001",
        ownerId: "olivia",
        ownerName: "Olivia",
        status: "进行中",
        health: "健康",
        progress: 40,
        startDate: "2026-10-01",
        targetDate: "2026-10-31",
        description: "",
        projectRoles: [],
        roleMappingPresets: {},
        rolesInitialized: true,
        rolesRevision: 1,
        businessChainRevision: 1,
        reportSchedule: {
          enabled: true,
          frequency: "daily",
          time: "08:00",
          timezone: "Asia/Shanghai",
          weekday: 1,
          dayOfMonth: 1,
        },
        createdAt: "2026-10-01T00:00:00.000Z",
        updatedAt: "2026-10-01T00:00:00.000Z",
      },
      workspace: { id: "ws-1", title: "一切皆插件", path: "/tmp/ws-1" },
      tasks: [],
      workflows: [
        {
          id: "wf-stalled",
          definitionKey: "approval-flow",
          definitionVersion: 1,
          title: "交付审批",
          status: "running",
          updatedAt: "2026-10-16T00:00:00.000Z",
          nodes: {
            approval: {
              status: "running",
              enteredAt: "2026-10-10T00:00:00.000Z",
              approvals: {
                owner: { status: "pending" },
              },
            },
          },
        },
      ],
      today: "2026-10-16",
    });
    expect(content).toContain("综合健康度判定为「风险」");
    expect(content).toContain("实际进度 40% 落后计划 10 个百分点");
    expect(content).toContain("节点“approval”已停留 6 天");
    expect(content).toContain("有 1 个待审批项");
  });
});

describe("plugin registration", () => {
  interface ApplyHarness {
    readonly ctx: Record<string, unknown>;
    readonly provided: string[];
    readonly registered: string[];
    readonly tools: string[];
    readonly isDisposed: () => boolean;
  }

  function createApplyHarness(
    harness: ReturnType<typeof createHarness>,
    extraGet: (key: string) => unknown = () => undefined,
  ): ApplyHarness {
    const provided: string[] = [];
    const registered: string[] = [];
    const tools: string[] = [];
    let disposed = false;
    const ctx: Record<string, any> = {
      effect: () => undefined,
      provide: (key: string) => {
        provided.push(key);
      },
      webServer: {
        register: (route: { path: string }) => {
          registered.push(route.path);
          return () => undefined;
        },
      },
      tools: {
        get: () => undefined,
        register: (definition: { name: string }) => {
          tools.push(definition.name);
          return () => undefined;
        },
      },
      get: (key: string) => {
        const extra = extraGet(key);
        if (extra !== undefined) return extra;
        if (key === "workspaceRegistry") return harness.workspaces;
        if (key === "collabAssignment") return harness.assignments;
        if (key === "collabTeammateRuntime") return harness.teammates;
        if (key === "collabTasks") return { list: () => [] };
        if (key === "collabWorkflow") return { instances: () => [] };
        return undefined;
      },
      storageDomain: {
        open: async () => ({
          table: (name: string) =>
            harness.tables[name as keyof typeof harness.tables],
          close: async () => {
            disposed = true;
          },
        }),
      },
      inject: (
        _keys: readonly string[],
        callback: (child: unknown) => void,
      ) => {
        callback({
          collabTeam: harness.team,
          get: ctx.get,
          webServer: ctx.webServer,
          tools: ctx.tools,
          effect: (register: () => () => void) => register(),
        });
        return { dispose: () => undefined };
      },
    };
    return {
      ctx,
      provided,
      registered,
      tools,
      isDisposed: () => disposed,
    };
  }

  it("provides the project service and registers routes in the team fiber", async () => {
    const harness = createHarness();
    const applyHarness = createApplyHarness(harness);
    await apply(applyHarness.ctx as never);
    expect(inject).toEqual(["storageDomain", "webServer"]);
    expect(applyHarness.provided).toEqual(["collabProjects"]);
    expect(applyHarness.registered).toContain("/api/collab/projects");
    expect(applyHarness.registered).toContain(
      "/api/collab/projects/members/save",
    );
    expect(applyHarness.registered).toContain(
      "/api/collab/projects/role-mappings/save",
    );
    expect(applyHarness.tools).toContain("project_report_generate");
    expect(projectDomainSpec.name).toBe("collab_project");
    expect(applyHarness.isDisposed()).toBe(false);
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(harness.teammates.projectManagerFor("ws-1")).toMatchObject({
      id: "tm-project-ws-1",
      name: "PM_一切皆插件",
    });
    expect(
      harness.assignments
        .seats("ws-1")
        .some(
          (seat) =>
            seat.seatId === "role-pm" &&
            seat.assigneeId === "tm-project-ws-1" &&
            seat.status !== "released",
        ),
    ).toBe(true);
  });

  it("assigns PRJ codes when the workspace stream reports a new project", async () => {
    const harness = createHarness({ extraWorkspace: true });
    async function* follow() {
      yield { type: "baseline", value: { items: [{ workspaceId: "ws-1" }] } };
      yield { type: "upsert", workspace: { workspaceId: "ws-2" } };
    }
    const applyHarness = createApplyHarness(harness, (key) =>
      key === "workspaceController" ? { follow } : undefined,
    );
    await apply(applyHarness.ctx as never);
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(harness.service.project("ws-1")?.code).toBe("PRJ000001");
    expect(harness.service.project("ws-2")?.code).toBe("PRJ000002");
  });
});
