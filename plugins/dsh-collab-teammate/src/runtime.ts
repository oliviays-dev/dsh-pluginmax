import type { Teammate } from "./models.js";
import { TeammateError, TeammateService, type TeammateActor } from "./service.js";

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
    readonly personaId?: string | undefined;
  }[];
  getByAuthUserId(
    authUserId: string,
  ): { readonly id: string; readonly kind: string; readonly status: string } | undefined;
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
      readonly employeeId: string;
      readonly workspaceId: string;
      readonly name: string;
      readonly status?: "active" | "disabled" | undefined;
      readonly legacyAgentProfileId?: string | undefined;
    },
  ): Promise<{ readonly id: string; readonly legacyAgentProfileId?: string | undefined }>;
  listProfiles?(input: {
    readonly employeeId: string;
  }): readonly {
    readonly id: string;
    readonly workspaceId: string;
    readonly name: string;
    readonly status: string;
    readonly legacyAgentProfileId?: string | undefined;
  }[];
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
        readonly profile: { readonly legacyAgentProfileId?: string | undefined };
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
      readonly runtimeKind?: "task-worker" | "continuable-session" | "connector" | undefined;
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
    },
  ): Promise<{ readonly id: string; readonly status: string }>;
  runs?(input: {
    readonly workspaceId: string;
    readonly instanceId?: string | undefined;
  }): readonly {
    readonly id: string;
    readonly instanceId: string;
    readonly status: string;
    readonly runSeq: number;
    readonly nodeId: string;
    readonly error?: string | undefined;
    readonly output?: { readonly summary?: string | undefined } | undefined;
    readonly startedAt?: string | undefined;
    readonly endedAt?: string | undefined;
    readonly createdAt: string;
  }[];
}

export interface TeammateRuntimeDeps {
  readonly teammates: TeammateService;
  readonly personas: () => PersonaServiceLike | undefined;
  readonly employees: () => EmployeeServiceLike | undefined;
  readonly agents: () => AgentServiceLike | undefined;
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
  readonly allowedTools: readonly string[];
  readonly agentStatus: string;
  readonly runtimeStatus: string;
}

const STATE_LABELS: Record<Teammate["state"], string> = {
  draft: "草稿",
  active: "已生效",
  paused: "已暂停",
  inactive: "已失效",
  archived: "已归档",
};

function personaIdFor(teammateId: string): string {
  return `persona-${teammateId.replace(/[^a-zA-Z0-9._-]/g, "-")}`.slice(0, 120);
}

function teammateTagFor(teammateId: string): string {
  const stableId = teammateId.startsWith("tm-")
    ? teammateId.slice(3)
    : teammateId;
  return `ai-teammate:${stableId.slice(0, 16)}`;
}

/**
 * AI Teammate 的运行时开通：teammate 是定义，数字员工 + Agent Profile +
 * 工作区角色 + Runtime Profile 才是可执行身份。同一个 teammate 只开通一次，
 * 之后所有任务复用同一个执行身份。
 */
export class TeammateRuntime {
  constructor(private readonly deps: TeammateRuntimeDeps) {}

  /**
   * 员工平台里的数字员工等价于平台归属 AI Teammate：
   * 每次读取列表时把还没有对应定义的数字员工补齐（幂等）。
   */
  async syncFromEmployees(): Promise<void> {
    const employees = this.deps.employees();
    if (employees?.list === undefined) return;
    const known = new Set(
      this.deps.teammates
        .list()
        .map((teammate) => teammate.employeeId)
        .filter((value): value is string => value !== undefined),
    );
    const personas = this.deps.personas();
    for (const employee of employees.list()) {
      if (employee.kind !== "digital" || known.has(employee.id)) continue;
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
      });
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
        allowedTools: profile.allowedTools,
        agentStatus: profile.status,
        runtimeStatus: runtime.status,
      };
    }
    return undefined;
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

  /** 可被指派的 teammate：平台归属全员可用，个人归属仅本人可用。 */
  assignable(actor: TeammateActor): readonly Teammate[] {
    return this.deps.teammates
      .list()
      .filter(
        (teammate) =>
          teammate.state === "active" &&
          (teammate.source === "platform" ||
            teammate.ownerUserId === actor.userId),
      );
  }

  async ensureRuntime(input: EnsureRuntimeInput): Promise<EnsuredRuntime> {
    const teammate = this.deps.teammates.get(input.teammateId);
    if (teammate.state !== "active") {
      throw new TeammateError(
        "conflict",
        `AI Teammate「${teammate.name}」当前为「${STATE_LABELS[teammate.state]}」，请先生效后再派发`,
      );
    }
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
      throw new TeammateError("conflict", "Agent 注册表不可用，无法开通执行身份");
    }

    // 个人归属：owner 是 manager；平台归属：先用当前管理员，后续再独立汇报线。
    const managerAuthUserId =
      teammate.source === "personal" ? teammate.ownerUserId : input.actor.userId;
    const manager = employees.getByAuthUserId(managerAuthUserId);
    if (
      manager === undefined ||
      manager.kind !== "human" ||
      manager.status !== "active"
    ) {
      throw new TeammateError(
        "conflict",
        teammate.source === "personal"
          ? "该分身的 Owner 没有可用的员工档案，无法开通执行身份"
          : "当前管理员没有可用的员工档案，无法开通执行身份",
      );
    }

    const personaId = teammate.personaId ?? personaIdFor(teammate.id);
    try {
      await personas.get(personaId);
    } catch {
      await personas.create({
        id: personaId,
        name: teammate.name,
        description: teammate.description,
        tags: [],
        soul: teammate.soul,
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
        name: teammate.name,
        description: teammate.description,
        personaId,
        runtimeKind: "task-worker",
      },
    );
    const employee = await employees.createDigital(managerAuthUserId, {
      displayName: teammate.name,
      title: teammate.role,
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
      name: teammate.name,
      legacyAgentProfileId: profile.id,
    });
    await this.deps.teammates.bindEmployee(input.actor, teammate.id, employee.id);
    return {
      teammateId: teammate.id,
      employeeId: employee.id,
      profileId: runtime.legacyAgentProfileId ?? profile.id,
      personaId,
    };
  }
}
