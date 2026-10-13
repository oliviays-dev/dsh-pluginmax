import type { Teammate } from "./models.js";
import {
  canManageInstance,
  TeammateError,
  TeammateService,
  TeammateTemplateService,
  type TeammateActor,
} from "./service.js";

export interface PersonaServiceLike {
  get(personaId: string): Promise<unknown>;
  create(input: {
    readonly id: string;
    readonly name: string;
    readonly description?: string | undefined;
    readonly tags?: readonly string[] | undefined;
    readonly soul?: string | undefined;
  }): Promise<unknown>;
}

export interface EmployeeServiceLike {
  list?(): readonly {
    readonly id: string;
    readonly kind: string;
    readonly displayName: string;
    readonly title?: string | undefined;
    readonly status: string;
    readonly authUserId?: string | undefined;
    readonly personaId?: string | undefined;
    readonly managerEmployeeId?: string | undefined;
  }[];
  getByAuthUserId(
    authUserId: string,
  ):
    | { readonly id: string; readonly kind: string; readonly status: string }
    | undefined;
  createDigital(
    actorAuthUserId: string,
    input: {
      readonly employeeId?: string | undefined;
      readonly displayName: string;
      readonly title?: string | undefined;
      readonly tags?: readonly string[] | undefined;
      readonly personaId: string;
      readonly managerEmployeeId: string;
    },
  ): Promise<{ readonly id: string }>;
  changeStatus(
    actorAuthUserId: string,
    employeeId: string,
    status: "draft" | "active" | "suspended" | "archived",
  ): Promise<unknown>;
  assignRole(
    actorAuthUserId: string,
    input: {
      readonly employeeId: string;
      readonly workspaceId: string;
      readonly role: "viewer" | "member" | "owner";
      readonly permissions?: readonly string[] | undefined;
    },
  ): Promise<unknown>;
  upsertRuntimeProfile(
    actorAuthUserId: string,
    input: {
      readonly id?: string | undefined;
      readonly employeeId: string;
      readonly workspaceId: string;
      readonly name: string;
      readonly status?: "active" | "disabled" | undefined;
      readonly legacyAgentProfileId?: string | undefined;
    },
  ): Promise<{
    readonly id: string;
    readonly legacyAgentProfileId?: string | undefined;
  }>;
  listProfiles?(input: { readonly employeeId: string }): readonly {
    readonly id: string;
    readonly workspaceId: string;
    readonly name: string;
    readonly status: string;
    readonly createdBy: string;
    readonly legacyAgentProfileId?: string | undefined;
  }[];
  /** 工作区角色授权：实例所在项目与角色/权限定义。 */
  listRoles?(input?: {
    readonly employeeId?: string | undefined;
    readonly workspaceId?: string | undefined;
  }): readonly {
    readonly id: string;
    readonly employeeId: string;
    readonly workspaceId: string;
    readonly role: string;
    readonly permissions: readonly string[];
    readonly status: string;
    readonly expiresAt?: string | undefined;
  }[];
  revokeRole?(actorAuthUserId: string, assignmentId: string): Promise<unknown>;
  workflowTarget(
    employeeId: string,
    workspaceId: string,
  ):
    | {
        readonly employee: {
          readonly id: string;
          readonly displayName: string;
          readonly personaId?: string | undefined;
        };
        readonly profile: {
          readonly legacyAgentProfileId?: string | undefined;
        };
      }
    | undefined;
}

export interface AgentServiceLike {
  createProfile(
    actor: {
      readonly kind: "user";
      readonly id: string;
      readonly name?: string | undefined;
      readonly globalRole?: "admin" | "owner" | "member" | "guest" | undefined;
    },
    input: {
      readonly workspaceId: string;
      readonly name: string;
      readonly description?: string | undefined;
      readonly personaId?: string | undefined;
      readonly execution?: "builtin" | "external" | undefined;
      readonly externalRuntimeId?: string | undefined;
      readonly runtimeKind?:
        "task-worker" | "continuable-session" | "connector" | undefined;
      readonly visibility?: "workspace" | "platform" | undefined;
    },
  ): Promise<{ readonly id: string }>;
  profiles?(workspaceId: string): readonly {
    readonly id: string;
    readonly workspaceId: string;
    readonly name: string;
    readonly runtimeKind: string;
    readonly status: string;
    readonly allowedTools: readonly string[];
    readonly personaId?: string | undefined;
    readonly execution?: "builtin" | "external" | undefined;
    readonly externalRuntimeId?: string | undefined;
  }[];
  updateProfile?(
    actor: {
      readonly kind: "user";
      readonly id: string;
      readonly name?: string | undefined;
      readonly globalRole?: "admin" | "owner" | "member" | "guest" | undefined;
    },
    input: {
      readonly workspaceId: string;
      readonly profileId: string;
      readonly status?: "active" | "disabled" | undefined;
      readonly execution?: "builtin" | "external" | undefined;
      readonly externalRuntimeId?: string | null | undefined;
    },
  ): Promise<{ readonly id: string; readonly status: string }>;
  runs?(input: {
    readonly workspaceId: string;
    readonly instanceId?: string | undefined;
  }): readonly {
    readonly id: string;
    readonly instanceId: string;
    readonly agentProfileId?: string | undefined;
    readonly employeeId?: string | undefined;
    readonly status: string;
    readonly runSeq: number;
    readonly nodeId: string;
    readonly error?: string | undefined;
    readonly output?: { readonly summary?: string | undefined } | undefined;
    readonly outputTokens?: number | undefined;
    readonly startedAt?: string | undefined;
    readonly endedAt?: string | undefined;
    readonly createdAt: string;
  }[];
}

export interface TeammateRuntimeDeps {
  readonly teammates: TeammateService;
  readonly templates?: () => TeammateTemplateService | undefined;
  readonly personas: () => PersonaServiceLike | undefined;
  readonly employees: () => EmployeeServiceLike | undefined;
  readonly agents: () => AgentServiceLike | undefined;
  readonly users?: () => readonly {
    readonly id: string;
    readonly name: string;
  }[];
}

export interface EnsureRuntimeInput {
  readonly teammateId: string;
  readonly workspaceId: string;
  readonly actor: TeammateActor;
}

export interface EnsuredRuntime {
  readonly teammateId: string;
  readonly employeeId: string;
  readonly profileId: string;
  readonly personaId?: string | undefined;
}

export interface TeammateIdentity {
  readonly teammateId: string;
  readonly employeeId: string;
  readonly workspaceId: string;
  readonly runtimeProfileId: string;
  readonly profileId: string;
  readonly profileName: string;
  readonly runtimeKind: string;
  readonly personaId?: string | undefined;
  readonly execution?: "builtin" | "external" | undefined;
  readonly externalRuntimeId?: string | undefined;
  readonly allowedTools: readonly string[];
  readonly agentStatus: string;
  readonly runtimeStatus: string;
}

export interface TeammateArchiveTask {
  readonly id: string;
  readonly status: string;
  readonly receiverType: string;
  readonly receiverId?: string | undefined;
  readonly archivedAt?: string | undefined;
  readonly messages?:
    | readonly {
        readonly runId?: string | undefined;
        readonly state?: string | undefined;
      }[]
    | undefined;
}

export interface TeammateArchiveResult {
  readonly teammate: Teammate;
  readonly transferredTaskIds: readonly string[];
}

export interface TeammateLeaveTask {
  readonly id: string;
  readonly workspaceId: string;
  readonly status: string;
  readonly receiverType: string;
  readonly receiverId?: string | undefined;
  readonly archivedAt?: string | undefined;
}

export interface TeammateLeaveResult {
  readonly revokedAssignments: readonly {
    readonly id: string;
    readonly role: string;
  }[];
  readonly reassignedTaskIds: readonly string[];
  readonly receiver?: { readonly id: string; readonly name: string } | undefined;
}

export interface TeammateLiveInstanceCounts {
  readonly liveCount: number;
  readonly ownCount: number;
}

const STATE_LABELS: Record<Teammate["state"], string> = {
  draft: "草稿",
  active: "已生效",
  paused: "已暂停",
  inactive: "已失效",
  archived: "已归档",
};

const ACTIVE_AGENT_RUN_STATES = new Set(["queued", "running", "waiting_input"]);

function personaIdFor(teammateId: string): string {
  return `persona-${teammateId.replace(/[^a-zA-Z0-9._-]/g, "-")}`.slice(0, 120);
}

function teammateTagFor(teammateId: string): string {
  const stableId = teammateId.startsWith("tm-")
    ? teammateId.slice(3)
    : teammateId;
  return `ai-teammate:${stableId.slice(0, 16)}`;
}

function isLatestRunActive(
  messages:
    | readonly {
        readonly runId?: string | undefined;
        readonly state?: string | undefined;
      }[]
    | undefined,
): boolean {
  const items = messages ?? [];
  for (let index = items.length - 1; index >= 0; index -= 1) {
    const message = items[index];
    if (message?.runId !== undefined && message.state !== undefined) {
      return ACTIVE_AGENT_RUN_STATES.has(message.state);
    }
  }
  return false;
}

/**
 * AI Teammate 的运行时开通：teammate 是定义，数字员工 + Agent Profile +
 * 工作区角色 + Runtime Profile 才是可执行身份。同一个 teammate 只开通一次，
 * 之后所有任务复用同一个执行身份。
 */
export class TeammateRuntime {
  constructor(private readonly deps: TeammateRuntimeDeps) {}

  private sourceOf(
    teammate: Pick<Teammate, "source" | "templateId">,
  ): Teammate["source"] {
    const templateId = teammate.templateId;
    const templates = this.deps.templates?.();
    const template =
      templateId === undefined || templates === undefined
        ? undefined
        : templates.get(templateId);
    return template?.source ?? teammate.source;
  }

  private templateActive(
    teammate: Pick<Teammate, "source" | "templateId">,
  ): boolean {
    const templateId = teammate.templateId;
    const templates = this.deps.templates?.();
    const template =
      templateId === undefined || templates === undefined
        ? undefined
        : templates.get(templateId);
    return template === undefined || template.state === "active";
  }

  private ownerDisplayName(
    teammate: Pick<Teammate, "ownerUserId" | "ownerName">,
  ): string {
    if (teammate.ownerUserId === "platform") return teammate.ownerName;
    return (
      this.deps.users?.().find((user) => user.id === teammate.ownerUserId)
        ?.name ?? teammate.ownerName
    );
  }

  /**
   * 员工平台里的数字员工等价于平台归属 AI Teammate：
   * 每次读取列表时把还没有对应定义的数字员工补齐（幂等）。
   */
  async syncFromEmployees(): Promise<void> {
    const employees = this.deps.employees();
    if (employees?.list === undefined) return;
    const roster = employees.list();
    const known = new Set(
      this.deps.teammates
        .list()
        .map((teammate) => teammate.employeeId)
        .filter((value): value is string => value !== undefined),
    );
    const personas = this.deps.personas();
    for (const employee of roster) {
      if (employee.kind !== "digital" || known.has(employee.id)) continue;
      // 实例 owner = 创建人：同步进来的实例归属到该数字员工的负责人（人类账号），
      // 解析不到就按平台托管处理，绝不写死具体用户。
      const manager =
        employee.managerEmployeeId === undefined
          ? undefined
          : roster.find((item) => item.id === employee.managerEmployeeId);
      const ownerUserId = manager?.authUserId;
      let soul: string | undefined;
      if (personas !== undefined && employee.personaId !== undefined) {
        try {
          const persona = (await personas.get(employee.personaId)) as {
            readonly soul?: unknown;
          } | null;
          if (
            persona !== null &&
            typeof persona === "object" &&
            typeof persona.soul === "string"
          ) {
            soul = persona.soul;
          }
        } catch {
          soul = undefined;
        }
      }
      try {
        await this.deps.teammates.importFromEmployee({
          employeeId: employee.id,
          name: employee.displayName,
          role: employee.title ?? "",
          state:
            employee.status === "active"
              ? "active"
              : employee.status === "suspended"
                ? "paused"
                : employee.status === "archived"
                  ? "archived"
                  : "draft",
          ...(soul === undefined ? {} : { soul }),
          ...(employee.personaId === undefined
            ? {}
            : { personaId: employee.personaId }),
          ...(ownerUserId === undefined ? {} : { ownerUserId }),
          ...(manager?.displayName === undefined
            ? {}
            : { ownerName: manager.displayName }),
        });
      } catch {
        // 单个数字员工同步失败不应影响其它员工，也不应让列表接口整体不可用。
      }
    }
  }

  /** 解析 teammate 当前绑定的执行身份（Agent Profile + Runtime Profile）。 */
  async identityOf(teammateId: string): Promise<TeammateIdentity | undefined> {
    const teammate = this.deps.teammates.get(teammateId);
    if (teammate.employeeId === undefined) return undefined;
    const employees = this.deps.employees();
    const agents = this.deps.agents();
    if (
      employees?.listProfiles === undefined ||
      agents?.profiles === undefined
    ) {
      return undefined;
    }
    for (const runtime of employees.listProfiles({
      employeeId: teammate.employeeId,
    })) {
      if (runtime.legacyAgentProfileId === undefined) continue;
      const profile = agents
        .profiles(runtime.workspaceId)
        .find((item) => item.id === runtime.legacyAgentProfileId);
      if (profile === undefined) continue;
      return {
        teammateId: teammate.id,
        employeeId: teammate.employeeId,
        workspaceId: runtime.workspaceId,
        runtimeProfileId: runtime.id,
        profileId: profile.id,
        profileName: profile.name,
        runtimeKind: profile.runtimeKind,
        ...(profile.personaId === undefined
          ? {}
          : { personaId: profile.personaId }),
        ...(profile.execution === undefined
          ? {}
          : { execution: profile.execution }),
        ...(profile.externalRuntimeId === undefined
          ? {}
          : { externalRuntimeId: profile.externalRuntimeId }),
        allowedTools: profile.allowedTools,
        agentStatus: profile.status,
        runtimeStatus: runtime.status,
      };
    }
    return undefined;
  }

  /**
   * Live instance requires every execution layer to be active; one workspace
   * contributes at most one live runtime even if legacy data has duplicates.
   */
  async liveInstanceCounts(
    actorUserId: string,
  ): Promise<Map<string, TeammateLiveInstanceCounts>> {
    const result = new Map<string, TeammateLiveInstanceCounts>();
    const employees = this.deps.employees();
    const agents = this.deps.agents();
    if (
      employees?.listProfiles === undefined ||
      agents?.profiles === undefined
    ) {
      for (const teammate of this.deps.teammates.list()) {
        result.set(teammate.id, { liveCount: 0, ownCount: 0 });
      }
      return result;
    }

    const activeEmployeeIds = new Set(
      (employees.list?.() ?? [])
        .filter((employee) => employee.status === "active")
        .map((employee) => employee.id),
    );
    const actorEmployeeId = employees
      .list?.()
      .find((employee) => employee.authUserId === actorUserId)?.id;

    for (const teammate of this.deps.teammates.list()) {
      const counts = { liveCount: 0, ownCount: 0 };
      if (
        teammate.state === "active" &&
        teammate.employeeId !== undefined &&
        (activeEmployeeIds.size === 0 ||
          activeEmployeeIds.has(teammate.employeeId))
      ) {
        const liveWorkspaces = new Set<string>();
        for (const runtime of employees.listProfiles({
          employeeId: teammate.employeeId,
        })) {
          if (
            runtime.status !== "active" ||
            runtime.legacyAgentProfileId === undefined ||
            liveWorkspaces.has(runtime.workspaceId)
          ) {
            continue;
          }
          const profile = agents
            .profiles(runtime.workspaceId)
            .find((item) => item.id === runtime.legacyAgentProfileId);
          if (profile?.status !== "active") continue;
          liveWorkspaces.add(runtime.workspaceId);
          counts.liveCount += 1;
          if (
            actorEmployeeId !== undefined &&
            runtime.createdBy === actorEmployeeId
          ) {
            counts.ownCount += 1;
          }
        }
      }
      result.set(teammate.id, counts);
    }
    return result;
  }

  /** 切换执行身份状态，并让 teammate 状态与之联动。 */
  async setIdentityStatus(input: {
    readonly teammateId: string;
    readonly status: "active" | "disabled";
    readonly actor: TeammateActor;
  }): Promise<TeammateIdentity | undefined> {
    const teammate = this.deps.teammates.get(input.teammateId);
    const identity = await this.identityOf(input.teammateId);
    if (identity === undefined) return undefined;
    await this.deps.agents?.()?.updateProfile?.(
      {
        kind: "user",
        id: input.actor.userId,
        name: input.actor.name,
        globalRole: input.actor.role,
      },
      {
        workspaceId: identity.workspaceId,
        profileId: identity.profileId,
        status: input.status,
      },
    );
    await this.deps.employees?.()?.upsertRuntimeProfile?.(input.actor.userId, {
      id: identity.runtimeProfileId,
      employeeId: identity.employeeId,
      workspaceId: identity.workspaceId,
      name: identity.profileName,
      status: input.status,
      legacyAgentProfileId: identity.profileId,
    });
    const nextState = input.status === "active" ? "active" : "paused";
    if (teammate.state !== nextState) {
      try {
        await this.deps.teammates.changeState(input.actor, {
          teammateId: teammate.id,
          state: nextState,
        });
      } catch {
        // 状态机不允许时忽略，避免身份切换被阻断。
      }
    }
    return this.identityOf(input.teammateId);
  }

  /**
   * 归档运行态实例：先把仍在进行中的工作转给 Owner，再停用执行身份。
   * 已完成或已取消的任务保留原责任人，作为历史归属记录。
   */
  async archiveInstance(input: {
    readonly teammateId: string;
    readonly actor: TeammateActor;
    readonly tasks: readonly TeammateArchiveTask[];
    readonly ownerName?: string | undefined;
    readonly assignTask: (input: {
      readonly taskId: string;
      readonly receiverType: "human";
      readonly receiverId: string;
      readonly receiverName: string;
    }) => Promise<unknown>;
  }): Promise<TeammateArchiveResult> {
    const teammate = this.deps.teammates.get(input.teammateId);
    // 归档的是实例：实例 owner 或平台管理员都可以，不看模版的平台归属。
    if (!canManageInstance(teammate, input.actor)) {
      throw new TeammateError("forbidden", "没有权限归档该 AI Teammate");
    }
    if (teammate.state === "archived") {
      return { teammate, transferredTaskIds: [] };
    }

    const identity = await this.identityOf(teammate.id);
    const runningReceivers = new Set(
      input.tasks
        .filter(
          (task) =>
            task.receiverType === "agent" &&
            task.archivedAt === undefined &&
            isLatestRunActive(task.messages),
        )
        .map((task) => task.receiverId),
    );
    const agentRuns =
      identity === undefined
        ? []
        : (this.deps
            .agents?.()
            ?.runs?.({ workspaceId: identity.workspaceId }) ?? []);
    const hasActiveRun =
      identity !== undefined &&
      (agentRuns ?? []).some(
        (run) =>
          run.employeeId === identity.employeeId &&
          ACTIVE_AGENT_RUN_STATES.has(run.status),
      );
    if (
      hasActiveRun ||
      runningReceivers.has(teammate.id) ||
      (teammate.employeeId !== undefined &&
        runningReceivers.has(teammate.employeeId))
    ) {
      throw new TeammateError(
        "conflict",
        `AI Teammate「${teammate.name}」仍在运行中，请等任务结束或先处理等待输入的任务`,
      );
    }

    const receiverId = teammate.ownerUserId;
    const receiverName =
      input.ownerName?.trim() || this.ownerDisplayName(teammate);
    const transferIds: string[] = [];
    for (const task of input.tasks) {
      const ownedByInstance =
        task.receiverType === "agent" &&
        task.archivedAt === undefined &&
        task.status !== "done" &&
        task.status !== "cancelled" &&
        (task.receiverId === teammate.id ||
          (teammate.employeeId !== undefined &&
            task.receiverId === teammate.employeeId));
      if (!ownedByInstance) continue;
      await input.assignTask({
        taskId: task.id,
        receiverType: "human",
        receiverId,
        receiverName,
      });
      transferIds.push(task.id);
    }

    const employees = this.deps.employees();
    const agents = this.deps.agents();
    if (
      identity !== undefined &&
      agents?.profiles !== undefined &&
      agents.updateProfile !== undefined &&
      employees?.listProfiles !== undefined &&
      employees.upsertRuntimeProfile !== undefined
    ) {
      const actor = {
        kind: "user" as const,
        id: input.actor.userId,
        name: input.actor.name,
        globalRole: input.actor.role,
      };
      for (const runtime of employees.listProfiles({
        employeeId: identity.employeeId,
      })) {
        if (runtime.legacyAgentProfileId === undefined) continue;
        const profile = agents
          .profiles(runtime.workspaceId)
          .find((item) => item.id === runtime.legacyAgentProfileId);
        if (profile === undefined) continue;
        await agents.updateProfile(actor, {
          workspaceId: runtime.workspaceId,
          profileId: profile.id,
          status: "disabled",
        });
        await employees.upsertRuntimeProfile(input.actor.userId, {
          id: runtime.id,
          employeeId: identity.employeeId,
          workspaceId: runtime.workspaceId,
          name: identity.profileName,
          status: "disabled",
          legacyAgentProfileId: profile.id,
        });
      }
    }

    const archived = await this.deps.teammates.archiveInstanceRecord(
      input.actor,
      teammate.id,
    );
    return { teammate: archived, transferredTaskIds: transferIds };
  }

  /**
   * 让实例退出项目或项目里的某个角色：撤销员工档案上的工作区角色授权。
   * 退出整个项目时，该项目里尚未完成且指派给该实例的任务会改派给指定的人
   * （默认是实例 owner，实例 owner 不是项目成员时由调用方换成项目 owner）。
   */
  async leaveWorkspace(input: {
    readonly teammateId: string;
    readonly workspaceId: string;
    readonly actor: TeammateActor;
    /** 工作区 owner 或平台管理员，可以代替实例 owner 操作。 */
    readonly canManageWorkspace: boolean;
    /** 传入表示只退出这一条角色授权，否则退出该项目下全部生效授权。 */
    readonly assignmentId?: string | undefined;
    /** 未完成任务的改派目标；缺省表示本次不改派任务。 */
    readonly reassignTo?: { readonly id: string; readonly name: string } | undefined;
    readonly tasks: readonly TeammateLeaveTask[];
    readonly assignTask: (input: {
      readonly taskId: string;
      readonly receiverType: "human";
      readonly receiverId: string;
      readonly receiverName: string;
    }) => Promise<unknown>;
  }): Promise<TeammateLeaveResult> {
    const teammate = this.deps.teammates.get(input.teammateId);
    // 实例归创建人所有，模版的平台归属不参与这里的判定。
    if (!canManageInstance(teammate, input.actor) && !input.canManageWorkspace) {
      throw new TeammateError(
        "forbidden",
        "只有实例 owner、项目 owner 或平台管理员可以让它退出项目",
      );
    }
    const employees = this.deps.employees();
    const employeeId = teammate.employeeId;
    if (
      employeeId === undefined ||
      employees?.listRoles === undefined ||
      employees.revokeRole === undefined
    ) {
      throw new TeammateError(
        "invalid_input",
        "该实例还没有绑定员工档案，无法维护项目角色",
      );
    }
    const nowMs = Date.now();
    const active = employees
      .listRoles({ employeeId, workspaceId: input.workspaceId })
      .filter(
        (assignment) =>
          assignment.status === "active" &&
          (assignment.expiresAt === undefined ||
            (Number.isFinite(Date.parse(assignment.expiresAt)) &&
              Date.parse(assignment.expiresAt) > nowMs)),
      );
    const targets =
      input.assignmentId === undefined
        ? active
        : active.filter((assignment) => assignment.id === input.assignmentId);
    if (targets.length === 0) {
      throw new TeammateError(
        "not_found",
        "该项目下没有可退出的生效角色授权",
      );
    }
    const revoked: { id: string; role: string }[] = [];
    for (const assignment of targets) {
      await employees.revokeRole(input.actor.userId, assignment.id);
      revoked.push({ id: assignment.id, role: assignment.role });
    }

    const reassignedTaskIds: string[] = [];
    const receiver = input.reassignTo;
    if (receiver !== undefined) {
      for (const task of input.tasks) {
        const ownedByInstance =
          task.workspaceId === input.workspaceId &&
          task.receiverType === "agent" &&
          task.archivedAt === undefined &&
          task.status !== "done" &&
          task.status !== "cancelled" &&
          (task.receiverId === teammate.id ||
            (teammate.employeeId !== undefined &&
              task.receiverId === teammate.employeeId));
        if (!ownedByInstance) continue;
        await input.assignTask({
          taskId: task.id,
          receiverType: "human",
          receiverId: receiver.id,
          receiverName: receiver.name,
        });
        reassignedTaskIds.push(task.id);
      }
    }
    return {
      revokedAssignments: revoked,
      reassignedTaskIds,
      ...(receiver === undefined ? {} : { receiver }),
    };
  }

  /**
   * 可被指派的实例投影。归属看模版；ownerName 永远表示实例创建人。
   * 字段集是 task / workflow 的跨插件契约，不在投影外暴露模版对象。
   */
  assignable(actor: TeammateActor): readonly {
    readonly id: string;
    readonly name: string;
    readonly ownerUserId: string;
    readonly ownerName: string;
    readonly source: Teammate["source"];
    readonly avatar: string;
    readonly employeeId?: string | undefined;
  }[] {
    return this.deps.teammates
      .list()
      .filter((teammate) => this.templateActive(teammate))
      .filter(
        (teammate) =>
          teammate.state === "active" &&
          (this.sourceOf(teammate) === "platform" ||
            teammate.ownerUserId === actor.userId),
      )
      .map((teammate) => ({
        id: teammate.id,
        name: teammate.name,
        ownerUserId: teammate.ownerUserId,
        ownerName: this.ownerDisplayName(teammate),
        source: this.sourceOf(teammate),
        avatar: teammate.avatar,
        ...(teammate.employeeId === undefined
          ? {}
          : { employeeId: teammate.employeeId }),
      }));
  }

  /**
   * 任务回写用：按 teammate 实例 id 或员工身份 id 解析该实例的 owner（实例创建人）。
   * 模版的平台归属不代表实例归属，实例归属始终看实例创建人。
   */
  ownerOf(ref: string): { readonly userId: string; readonly name: string } | undefined {
    const teammate = this.deps.teammates
      .list()
      .find((item) => item.id === ref || item.employeeId === ref);
    if (teammate === undefined) return undefined;
    const userId = teammate.ownerUserId.trim();
    if (userId === "" || userId === "platform" || userId === "system") {
      return undefined;
    }
    return { userId, name: this.ownerDisplayName(teammate) };
  }

  async ensureRuntime(input: EnsureRuntimeInput): Promise<EnsuredRuntime> {
    const teammate = this.deps.teammates.get(input.teammateId);
    if (teammate.state !== "active") {
      throw new TeammateError(
        "conflict",
        `AI Teammate「${teammate.name}」当前为「${STATE_LABELS[teammate.state]}」，请先生效后再派发`,
      );
    }
    if (!this.templateActive(teammate)) {
      throw new TeammateError(
        "conflict",
        `AI Teammate「${teammate.name}」使用的模版已停用，不能发起新的派发`,
      );
    }
    const definition = this.deps.teammates.effectiveDefinitionOf(teammate);
    const employees = this.deps.employees();
    if (employees === undefined) {
      throw new TeammateError("conflict", "员工服务不可用，无法派发任务");
    }
    if (teammate.employeeId !== undefined) {
      const existing = employees.workflowTarget(
        teammate.employeeId,
        input.workspaceId,
      );
      const profileId = existing?.profile.legacyAgentProfileId;
      if (existing !== undefined && profileId !== undefined) {
        const agents = this.deps.agents();
        const profile = agents
          ?.profiles?.(input.workspaceId)
          .find((item) => item.id === profileId);
        const execution = teammate.execution ?? "builtin";
        const externalRuntimeId =
          execution === "external" ? teammate.externalRuntimeId : undefined;
        if (
          agents?.updateProfile !== undefined &&
          (profile?.execution !== execution ||
            profile?.externalRuntimeId !== externalRuntimeId)
        ) {
          await agents.updateProfile(
            {
              kind: "user",
              id: input.actor.userId,
              name: input.actor.name,
              globalRole: input.actor.role,
            },
            {
              workspaceId: input.workspaceId,
              profileId,
              execution,
              ...(externalRuntimeId === undefined
                ? { externalRuntimeId: null }
                : { externalRuntimeId }),
            },
          );
        }
        return {
          teammateId: teammate.id,
          employeeId: teammate.employeeId,
          profileId,
          ...(existing.employee.personaId === undefined
            ? {}
            : { personaId: existing.employee.personaId }),
        };
      }
    }

    const personas = this.deps.personas();
    const agents = this.deps.agents();
    if (personas === undefined) {
      throw new TeammateError("conflict", "人设服务不可用，无法开通执行身份");
    }
    if (agents === undefined) {
      throw new TeammateError(
        "conflict",
        "Agent 注册表不可用，无法开通执行身份",
      );
    }

    // 实例归创建人所有：执行身份的 manager 一律取实例 owner；历史平台托管数据
    // 没有人类 owner 时，才回退到当前操作者。
    const instanceSource = definition.source;
    const managerAuthUserId =
      teammate.ownerUserId === "platform" || teammate.ownerUserId === "system"
        ? input.actor.userId
        : teammate.ownerUserId;
    const manager = employees.getByAuthUserId(managerAuthUserId);
    if (
      manager === undefined ||
      manager.kind !== "human" ||
      manager.status !== "active"
    ) {
      throw new TeammateError(
        "conflict",
        teammate.ownerUserId === "platform" || teammate.ownerUserId === "system"
          ? "当前操作者没有可用的员工档案，无法开通执行身份"
          : "该实例 Owner 没有可用的员工档案，无法开通执行身份",
      );
    }

    const personaId =
      teammate.personaId ?? definition.personaAlias ?? personaIdFor(teammate.id);
    try {
      await personas.get(personaId);
    } catch {
      await personas.create({
        id: personaId,
        name: definition.name,
        description: definition.description,
        tags: [],
        soul: definition.soul,
      });
    }

    const profile = await agents.createProfile(
      {
        kind: "user",
        id: managerAuthUserId,
        name: input.actor.name,
        globalRole: input.actor.role,
      },
      {
        workspaceId: input.workspaceId,
        name: definition.name,
        description: definition.description,
        personaId,
        ...(teammate.execution === undefined
          ? {}
          : { execution: teammate.execution }),
        ...(teammate.externalRuntimeId === undefined
          ? {}
          : { externalRuntimeId: teammate.externalRuntimeId }),
        runtimeKind: "task-worker",
        visibility: instanceSource === "platform" ? "platform" : "workspace",
      },
    );
    const employee = await employees.createDigital(managerAuthUserId, {
      displayName: definition.name,
      title: definition.role,
      // 标记这条数字员工是 AI Teammate 的运行时身份，员工平台据此区分展示。
      tags: ["ai-teammate", teammateTagFor(teammate.id)],
      personaId,
      managerEmployeeId: manager.id,
    });
    await employees.changeStatus(managerAuthUserId, employee.id, "active");
    await employees.assignRole(managerAuthUserId, {
      employeeId: employee.id,
      workspaceId: input.workspaceId,
      role: "member",
    });
    const runtime = await employees.upsertRuntimeProfile(managerAuthUserId, {
      employeeId: employee.id,
      workspaceId: input.workspaceId,
      name: definition.name,
      legacyAgentProfileId: profile.id,
    });
    await this.deps.teammates.bindEmployee(
      input.actor,
      teammate.id,
      employee.id,
    );
    return {
      teammateId: teammate.id,
      employeeId: employee.id,
      profileId: runtime.legacyAgentProfileId ?? profile.id,
      personaId,
    };
  }
}
