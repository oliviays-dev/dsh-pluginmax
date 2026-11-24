import { randomUUID } from "node:crypto";
import {
  routerCycleSchema,
  routerAgentRegistrationSchema,
  type PlanGraph,
  type PlanRecord,
  type RouterAgentRegistration,
  type RouterCycle,
} from "./models.js";
import {
  RouterWorkerError,
  type PlanActor,
  type RootTaskLike,
  type RouterWorkerTable,
} from "./service.js";
import {
  buildRouterCyclePrompt,
  type RouterCandidate,
} from "./router-prompt.js";

export interface RouterAgentDispatchInput {
  readonly workspaceId: string;
  readonly workspacePath?: string | undefined;
  readonly profileId: string;
  readonly source: "task";
  readonly instanceId: string;
  readonly nodeId: string;
  readonly dispatchKey: string;
  readonly trigger: "manual-dispatch";
  readonly attempt: number;
  readonly runSeq: number;
  readonly maxAttempts: number;
  readonly timeoutMs: number;
  readonly personaId?: string | undefined;
  readonly employeeId?: string | undefined;
  readonly principalId?: string | undefined;
  readonly principalType?:
    "transitional-agent" | "digital-employee" | "principal-runtime" | undefined;
  readonly ticketId?: string | undefined;
  readonly contextPackId?: string | undefined;
  readonly sessionBindingId?: string | undefined;
  readonly sessionId?: string | undefined;
  readonly payload: {
    readonly instanceTitle: string;
    readonly nodeName: string;
    readonly nodeDescription: string;
    readonly profileName: string;
    readonly responsibleId: string;
    readonly deliverables: readonly unknown[];
    readonly context: Readonly<Record<string, string | number | boolean>>;
  };
  readonly createdBy: string;
}

export interface RouterCycleDeps {
  readonly team: {
    members(workspaceId: string): readonly {
      readonly userId: string;
      readonly memberRole?: string | undefined;
    }[];
    users(): readonly {
      readonly id: string;
      readonly name: string;
    }[];
  };
  readonly tasks: () => {
    get(taskId: string): RootTaskLike;
  };
  readonly agent: () => {
    dispatch(input: RouterAgentDispatchInput): Promise<{
      readonly id: string;
      readonly status: string;
      readonly sessionId?: string | undefined;
    }>;
    cancel?(runId: string): Promise<unknown>;
    run(runId: string):
      | {
          readonly id: string;
          readonly status: string;
          readonly sessionId?: string | undefined;
          readonly error?: string | undefined;
        }
      | undefined;
    preflightForProfile?(input: {
      readonly workspaceId: string;
      readonly taskId: string;
      readonly profileId: string;
      readonly principalId: string;
      readonly teammateId?: string | undefined;
      readonly ticketId?: string | undefined;
    }):
      | {
          readonly gaps: readonly {
            readonly necessity: "required" | "recommended";
            readonly message: string;
          }[];
        }
      | undefined;
    profile(
      workspaceId: string,
      profileId: string,
    ):
      | {
          readonly id: string;
          readonly name: string;
          readonly description: string;
          readonly ownerUserId: string;
          readonly execution?: "builtin" | "external" | undefined;
          readonly status: "active" | "disabled";
        }
      | undefined;
    updateRuntimeProfile?(
      actor: {
        readonly kind: "user";
        readonly id: string;
        readonly name?: string | undefined;
        readonly globalRole?:
          "admin" | "owner" | "member" | "guest" | undefined;
        readonly workspaceRole?: "owner" | "member" | "guest" | undefined;
        readonly workspaceId?: string | undefined;
      },
      input: {
        readonly workspaceId: string;
        readonly profileId: string;
        readonly allowedTools?: readonly string[] | undefined;
      },
    ): Promise<unknown>;
  };
  readonly teammates: () =>
    | {
        list(): readonly {
          readonly id: string;
          readonly name: string;
          readonly ownerUserId: string;
          readonly state: string;
          readonly templateId?: string | undefined;
          readonly employeeId?: string | undefined;
          readonly principalId?: string | undefined;
        }[];
        assignable(
          actor: {
            readonly userId: string;
            readonly name: string;
            readonly role: "admin" | "owner" | "member" | "guest";
          },
          workspaceId?: string,
        ): readonly {
          readonly id: string;
          readonly name: string;
          readonly ownerName: string;
          readonly employeeId?: string | undefined;
          readonly execution?: "builtin" | "external" | undefined;
        }[];
        ensureRuntime(input: {
          readonly teammateId: string;
          readonly workspaceId: string;
          readonly actor: {
            readonly userId: string;
            readonly name: string;
            readonly role: "admin" | "owner" | "member" | "guest";
          };
          readonly workspaceRole?: "owner" | "member" | "guest" | undefined;
          readonly employee?: {
            readonly employeeId?: string | undefined;
            readonly displayName?: string | undefined;
            readonly department?: string | undefined;
            readonly title?: string | undefined;
            readonly tags?: readonly string[] | undefined;
            readonly managerEmployeeId?: string | undefined;
          };
        }): Promise<{
          readonly teammateId: string;
          readonly employeeId?: string | undefined;
          readonly principalId?: string | undefined;
          readonly profileId: string;
          readonly personaId?: string | undefined;
        }>;
      }
    | undefined;
  readonly teammateService: () =>
    | {
        list(): readonly {
          readonly id: string;
          readonly name: string;
          readonly ownerUserId: string;
          readonly state: string;
          readonly templateId?: string | undefined;
          readonly employeeId?: string | undefined;
          readonly principalId?: string | undefined;
        }[];
        create(
          actor: {
            readonly userId: string;
            readonly name: string;
            readonly role: "admin" | "owner" | "member" | "guest";
          },
          input: {
            readonly templateId: string;
            readonly name?: string | undefined;
            readonly execution?: "builtin" | "external" | undefined;
          },
        ): Promise<{
          readonly id: string;
          readonly name: string;
          readonly ownerUserId: string;
          readonly state: string;
          readonly templateId?: string | undefined;
          readonly employeeId?: string | undefined;
          readonly principalId?: string | undefined;
        }>;
      }
    | undefined;
  readonly teammateTemplates: () =>
    | {
        get(templateId: string):
          | {
              readonly id: string;
              readonly name: string;
              readonly source: "personal" | "platform";
              readonly state: "active" | "disabled" | "archived";
              readonly tools: readonly string[];
            }
          | undefined;
        findOrCreate(
          actor: {
            readonly userId: string;
            readonly name: string;
            readonly role: "admin" | "owner" | "member" | "guest";
          },
          input: {
            readonly source: "personal" | "platform";
            readonly name: string;
            readonly role?: string | undefined;
            readonly description?: string | undefined;
            readonly soul?: string | undefined;
            readonly scenarios?: readonly string[] | undefined;
            readonly goals?: readonly string[] | undefined;
            readonly tools?: readonly string[] | undefined;
            readonly active?: boolean | undefined;
          },
        ): Promise<{
          readonly id: string;
          readonly name: string;
          readonly source: "personal" | "platform";
          readonly state: string;
        }>;
        update?(
          actor: {
            readonly userId: string;
            readonly name: string;
            readonly role: "admin" | "owner" | "member" | "guest";
          },
          input: {
            readonly templateId: string;
            readonly name: string;
            readonly role?: string | undefined;
            readonly description?: string | undefined;
            readonly soul?: string | undefined;
            readonly scenarios?: readonly string[] | undefined;
            readonly goals?: readonly string[] | undefined;
            readonly tools?: readonly string[] | undefined;
          },
        ): Promise<{
          readonly id: string;
          readonly name: string;
          readonly source: "personal" | "platform";
          readonly state: string;
        }>;
      }
    | undefined;
  readonly principalRuntime: () =>
    | {
        profile(
          principalId: string,
          workspaceId: string,
        ): { readonly id: string } | undefined;
        issueTicket(input: {
          readonly principalId: string;
          readonly workspaceId: string;
          readonly contextType: "task";
          readonly contextId: string;
          readonly requestedActions: readonly string[];
          readonly resourceScopes?: readonly string[];
          readonly durationMinutes?: number;
          readonly issuedByUserId: string;
        }): Promise<{ readonly id: string }>;
      }
    | undefined;
  readonly workspaces: () =>
    | {
        get(
          workspaceId: string,
        ): { readonly path?: string | undefined } | undefined;
      }
    | undefined;
  readonly enabled: (workspaceId: string) => boolean;
  readonly defaultRouterAgentId: (workspaceId: string) => string | undefined;
}

export interface RouterCycleStartInput {
  readonly actor: PlanActor;
  readonly rootTaskId: string;
  readonly planner: "plan" | "final";
  readonly routerAgentId?: string | undefined;
  readonly trigger: RouterCycle["trigger"];
  readonly allowSourceReplacement?: boolean | undefined;
  readonly plan?:
    | {
        readonly plan: PlanRecord;
        readonly graph: PlanGraph;
        readonly nodeStates: readonly {
          readonly nodeId: string;
          readonly status: string;
          readonly taskId?: string | undefined;
          readonly lastError?: string | undefined;
          readonly resultSummary?: string | undefined;
        }[];
      }
    | undefined;
}

function nowIso(): string {
  return new Date().toISOString();
}

const ROUTER_AGENT_NAME = "通用任务 Router";
const ROUTER_AGENT_DESCRIPTION =
  "Router 类型 Agent，仅负责生成执行计划、有限重规划和最终草稿。";
const ROUTER_REQUIRED_TOOLS = [
  "router_worker_submit_plan",
  "router_worker_submit_final_draft",
] as const;
const ROUTER_TEMPLATE_TOOLS = ["read_file", ...ROUTER_REQUIRED_TOOLS] as const;
const ROUTER_TEMPLATE_SOUL = [
  "# Router Agent",
  "",
  "你是任务规划类型的 Router Agent。你的职责是理解主任务、识别依赖关系并提交",
  "结构化执行计划；不要等待用户确认，直接基于任务上下文做出合理假设。你不能代签",
  "人工审批，不能扩大权限，也不能直接完成主任务。",
  "",
  "使用 router_worker_submit_plan 提交规划草稿。",
  "使用 router_worker_submit_final_draft 提交最终交付草稿。",
].join("\n");

function runtimeActor(actor: PlanActor) {
  return {
    userId: actor.id,
    name: actor.name,
    role: actor.role ?? ("member" as const),
  };
}

function workspaceRoleFor(actor: PlanActor): "owner" | "member" | "guest" {
  return actor.role === "owner"
    ? "owner"
    : actor.role === "guest"
      ? "guest"
      : "member";
}

function routerEmployeeId(workspaceId: string): string {
  const suffix = workspaceId.replace(/[^a-zA-Z0-9._-]/g, "-").slice(0, 96);
  return `router-${suffix}`;
}

export class RouterCycleService {
  private readonly provisioning = new Map<
    string,
    Promise<RouterAgentRegistration>
  >();

  constructor(
    private readonly cycles: RouterWorkerTable<RouterCycle>,
    private readonly routerAgents: RouterWorkerTable<RouterAgentRegistration>,
    private readonly deps: RouterCycleDeps,
  ) {}

  private requireEnabled(workspaceId: string): void {
    if (!this.deps.enabled(workspaceId)) {
      throw new RouterWorkerError("gate_closed", "Router / Worker 扩展未启用");
    }
  }

  private activeForRoot(rootTaskId: string): RouterCycle | undefined {
    return [...this.cycles.entries()]
      .map(([, cycle]) => routerCycleSchema.parse(cycle))
      .filter(
        (cycle) =>
          cycle.rootTaskId === rootTaskId &&
          ["queued", "running"].includes(cycle.status),
      )
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt))[0];
  }

  private registrations(workspaceId: string): RouterAgentRegistration[] {
    return [...this.routerAgents.entries()]
      .map(([, value]) => routerAgentRegistrationSchema.parse(value))
      .filter(
        (registration) =>
          registration.workspaceId === workspaceId &&
          registration.status === "active" &&
          registration.agentType === "router" &&
          registration.teammateId !== undefined &&
          registration.templateId !== undefined &&
          this.isRouterTemplate(registration.templateId) &&
          this.deps.agent().profile(workspaceId, registration.profileId)
            ?.status === "active",
      );
  }

  private isRouterTemplate(templateId: string): boolean {
    const template = this.deps.teammateTemplates()?.get(templateId);
    return (
      template !== undefined &&
      template.state === "active" &&
      ROUTER_REQUIRED_TOOLS.every((tool) => template.tools.includes(tool))
    );
  }

  private teammate(teammateId: string) {
    return this.deps
      .teammateService()
      ?.list()
      .find((candidate) => candidate.id === teammateId);
  }

  private async activateRegistration(
    actor: PlanActor,
    registration: RouterAgentRegistration,
  ): Promise<RouterAgentRegistration> {
    if (registration.teammateId === undefined) {
      throw new RouterWorkerError(
        "forbidden",
        "Router Agent 必须绑定 AI伙伴实例，普通 Agent Profile 不可用",
      );
    }
    const teammate = this.teammate(registration.teammateId);
    if (teammate === undefined) {
      throw new RouterWorkerError("not_found", "Router AI伙伴不存在");
    }
    if (
      teammate.templateId === undefined ||
      !this.isRouterTemplate(teammate.templateId)
    ) {
      throw new RouterWorkerError("forbidden", "该 AI伙伴不是 Router 类型");
    }
    const runtime = await this.deps.teammates()?.ensureRuntime({
      teammateId: registration.teammateId,
      workspaceId: registration.workspaceId,
      actor: runtimeActor(actor),
      workspaceRole: workspaceRoleFor(actor),
    });
    if (runtime === undefined) {
      throw new RouterWorkerError("conflict", "AI伙伴运行时服务不可用");
    }
    if (runtime.principalId === undefined) {
      throw new RouterWorkerError(
        "conflict",
        "Router AI伙伴缺少可执行 Principal，不能启动",
      );
    }
    const profile = this.deps
      .agent()
      .profile(registration.workspaceId, runtime.profileId);
    if (profile === undefined || profile.status !== "active") {
      throw new RouterWorkerError(
        "conflict",
        "Router AI伙伴的 Agent Profile 不可用",
      );
    }
    const next = routerAgentRegistrationSchema.parse({
      ...registration,
      templateId: teammate.templateId,
      profileId: runtime.profileId,
      ...(runtime.employeeId === undefined
        ? {}
        : { employeeId: runtime.employeeId }),
      principalId: runtime.principalId,
      name: teammate.name,
      updatedAt: nowIso(),
    });
    await this.routerAgents.put(next.id, next);
    return next;
  }

  async ensureDefaultRouterAgent(
    actor: PlanActor,
    workspaceId: string,
  ): Promise<RouterAgentRegistration> {
    const existing = this.registrations(workspaceId)[0];
    if (existing !== undefined) {
      return this.activateRegistration(actor, existing);
    }
    const inFlight = this.provisioning.get(workspaceId);
    if (inFlight !== undefined) {
      return inFlight;
    }
    const pending = (async () => {
      const teammateService = this.deps.teammateService();
      const teammateTemplates = this.deps.teammateTemplates();
      const teammateRuntime = this.deps.teammates();
      if (
        teammateService === undefined ||
        teammateTemplates === undefined ||
        teammateRuntime === undefined
      ) {
        throw new RouterWorkerError(
          "conflict",
          "AI伙伴服务不可用，无法创建 Router Agent",
        );
      }
      const actorInput = runtimeActor(actor);
      let template = await teammateTemplates.findOrCreate(actorInput, {
        source: actor.role === "admin" ? "platform" : "personal",
        name: "Router Agent",
        role: "任务规划 Router",
        description: ROUTER_AGENT_DESCRIPTION,
        soul: ROUTER_TEMPLATE_SOUL,
        scenarios: [
          "把复杂主任务解析为包含串并行依赖的执行计划",
          "在节点失败或需要澄清时做有限重规划",
          "汇总 required 节点并生成非绑定交付草稿",
        ],
        goals: [
          "只提交结构化计划草稿，不代签人工审批",
          "不读取、不提交、不扩大节点权限快照",
        ],
        tools: [...ROUTER_TEMPLATE_TOOLS],
        active: true,
      });
      const currentTemplate = teammateTemplates.get(template.id);
      if (
        currentTemplate !== undefined &&
        (!ROUTER_REQUIRED_TOOLS.every((tool) =>
          currentTemplate.tools.includes(tool),
        ) ||
          currentTemplate.tools.includes("ask_user_question"))
      ) {
        try {
          template =
            (await teammateTemplates.update?.(actorInput, {
              templateId: template.id,
              name: template.name,
              role: "任务规划 Router",
              description: ROUTER_AGENT_DESCRIPTION,
              soul: ROUTER_TEMPLATE_SOUL,
              scenarios: [
                "把复杂主任务解析为包含串并行依赖的执行计划",
                "在节点失败或需要澄清时做有限重规划",
                "汇总 required 节点并生成非绑定交付草稿",
              ],
              goals: [
                "只提交结构化计划草稿，不代签人工审批",
                "不读取、不提交、不扩大节点权限快照",
              ],
              tools: [...ROUTER_TEMPLATE_TOOLS],
            })) ?? template;
        } catch {
          // The dispatch-time profile guard below still removes the unsafe
          // interactive tool when the template is not editable by this actor.
        }
      }
      if (template.state !== "active") {
        throw new RouterWorkerError("conflict", "Router Agent 模版未启用");
      }
      const teammate =
        teammateService
          .list()
          .find(
            (candidate) =>
              candidate.templateId === template.id &&
              candidate.name === ROUTER_AGENT_NAME &&
              candidate.state === "active",
          ) ??
        (await teammateService.create(actorInput, {
          templateId: template.id,
          name: ROUTER_AGENT_NAME,
          execution: "builtin",
        }));
      const runtime = await teammateRuntime.ensureRuntime({
        teammateId: teammate.id,
        workspaceId,
        actor: actorInput,
        workspaceRole: workspaceRoleFor(actor),
        employee: {
          employeeId: routerEmployeeId(workspaceId),
          displayName: ROUTER_AGENT_NAME,
          title: "任务规划 Router",
          tags: ["router", "task-planning"],
        },
      });
      if (runtime.principalId === undefined) {
        throw new RouterWorkerError(
          "conflict",
          "Router AI伙伴缺少可执行 Principal，不能启动",
        );
      }
      const profile = this.deps.agent().profile(workspaceId, runtime.profileId);
      if (profile === undefined || profile.status !== "active") {
        throw new RouterWorkerError(
          "conflict",
          "Router AI伙伴的 Agent Profile 未启用",
        );
      }
      const at = nowIso();
      const registration = routerAgentRegistrationSchema.parse({
        id: `${workspaceId}:${profile.id}`,
        workspaceId,
        agentType: "router",
        teammateId: teammate.id,
        templateId: template.id,
        profileId: profile.id,
        ...(runtime.employeeId === undefined
          ? {}
          : { employeeId: runtime.employeeId }),
        principalId: runtime.principalId,
        name: ROUTER_AGENT_NAME,
        domain: "general",
        status: "active",
        createdAt: at,
        updatedAt: at,
      });
      await this.routerAgents.put(registration.id, registration);
      return registration;
    })();
    this.provisioning.set(workspaceId, pending);
    try {
      return await pending;
    } finally {
      this.provisioning.delete(workspaceId);
    }
  }

  async registerRouterAgent(
    actor: PlanActor,
    workspaceId: string,
    profileId: string,
    domain = "general",
  ): Promise<RouterAgentRegistration> {
    const profile = this.deps.agent().profile(workspaceId, profileId);
    if (profile === undefined) {
      throw new RouterWorkerError("not_found", "Agent Profile 不存在");
    }
    if (profile.status !== "active") {
      throw new RouterWorkerError("conflict", "Agent Profile 未启用");
    }
    const teammateRuntime = this.deps.teammates();
    const teammateService = this.deps.teammateService();
    if (teammateRuntime === undefined || teammateService === undefined) {
      throw new RouterWorkerError("conflict", "AI伙伴运行时服务不可用");
    }
    for (const teammate of teammateService.list()) {
      if (
        teammate.templateId === undefined ||
        !this.isRouterTemplate(teammate.templateId)
      ) {
        continue;
      }
      const identity = await teammateRuntime.ensureRuntime({
        teammateId: teammate.id,
        workspaceId,
        actor: runtimeActor(actor),
        workspaceRole: workspaceRoleFor(actor),
      });
      if (identity.profileId !== profile.id) {
        continue;
      }
      const at = nowIso();
      const registration = routerAgentRegistrationSchema.parse({
        id: `${workspaceId}:${profile.id}`,
        workspaceId,
        agentType: "router",
        teammateId: teammate.id,
        templateId: teammate.templateId,
        profileId: profile.id,
        ...(identity.employeeId === undefined
          ? {}
          : { employeeId: identity.employeeId }),
        ...(identity.principalId === undefined
          ? {}
          : { principalId: identity.principalId }),
        name: teammate.name,
        domain,
        status: "active",
        createdAt: at,
        updatedAt: at,
      });
      return this.activateRegistration(actor, registration);
    }
    throw new RouterWorkerError(
      "forbidden",
      "只能登记 Router 类型的 AI伙伴，普通 Agent Profile 不可登记",
    );
  }

  async candidateRouterAgents(
    actor: PlanActor,
    workspaceId: string,
  ): Promise<
    readonly {
      readonly id: string;
      readonly name: string;
      readonly ownerUserId: string;
      readonly agentType: "router";
      readonly teammateId?: string | undefined;
      readonly domain: string;
      readonly execution?: "builtin" | "external" | undefined;
      readonly isDefault: boolean;
    }[]
  > {
    await this.ensureDefaultRouterAgent(actor, workspaceId);
    const defaultId = this.deps.defaultRouterAgentId(workspaceId);
    const candidates = [];
    for (const stored of this.registrations(workspaceId)) {
      const registration = await this.activateRegistration(actor, stored);
      const profile = this.deps
        .agent()
        .profile(workspaceId, registration.profileId)!;
      const id = registration.teammateId ?? registration.profileId;
      candidates.push({
        id,
        name: registration.name,
        ownerUserId: profile.ownerUserId,
        agentType: "router" as const,
        ...(registration.teammateId === undefined
          ? {}
          : { teammateId: registration.teammateId }),
        domain: registration.domain,
        ...(profile.execution === undefined
          ? {}
          : { execution: profile.execution }),
        isDefault: id === defaultId || registration.profileId === defaultId,
      });
    }
    return candidates;
  }

  async start(input: RouterCycleStartInput): Promise<RouterCycle> {
    const root = this.deps.tasks().get(input.rootTaskId);
    this.requireEnabled(root.workspaceId);
    const provisionedDefault = await this.ensureDefaultRouterAgent(
      input.actor,
      root.workspaceId,
    );
    const registrations = this.registrations(root.workspaceId);
    const boundRouterAgentId = input.plan?.plan.routerAgentId;
    const registrationFor = (ref: string | undefined) =>
      ref === undefined
        ? undefined
        : registrations.find(
            (registration) =>
              registration.teammateId === ref || registration.profileId === ref,
          );
    const boundRegistration = registrationFor(boundRouterAgentId);
    const requestedRegistration = registrationFor(input.routerAgentId);
    const boundLegacyTeammate =
      input.plan !== undefined && boundRouterAgentId !== undefined
        ? this.teammate(boundRouterAgentId)
        : undefined;
    const requestedIsBoundLegacy =
      input.routerAgentId !== undefined &&
      input.routerAgentId === boundRouterAgentId &&
      boundLegacyTeammate !== undefined;
    if (
      input.routerAgentId !== undefined &&
      requestedRegistration === undefined &&
      !requestedIsBoundLegacy
    ) {
      throw new RouterWorkerError(
        "forbidden",
        "指定 Agent 不是已登记的 Router 类型",
      );
    }
    if (
      boundRegistration !== undefined &&
      requestedRegistration !== undefined &&
      boundRegistration.teammateId !== requestedRegistration.teammateId
    ) {
      throw new RouterWorkerError(
        "conflict",
        "已有计划已固化 Router Agent，不能临时切换",
      );
    }
    const routerAgentId =
      boundRouterAgentId ??
      input.routerAgentId ??
      this.deps.defaultRouterAgentId(root.workspaceId) ??
      provisionedDefault.teammateId ??
      provisionedDefault.profileId;
    if (routerAgentId === undefined || routerAgentId === "") {
      throw new RouterWorkerError(
        "conflict",
        "当前 Workspace 尚未配置默认 Router Agent",
      );
    }
    const registration =
      registrationFor(routerAgentId) ??
      (input.plan === undefined
        ? undefined
        : registrationFor(boundRouterAgentId));
    const legacyRouter =
      registration === undefined &&
      input.plan !== undefined &&
      boundRouterAgentId === routerAgentId
        ? this.teammate(routerAgentId)
        : undefined;
    if (registration === undefined && legacyRouter === undefined) {
      throw new RouterWorkerError(
        "forbidden",
        "指定 Agent 不是已登记的 Router 类型",
      );
    }
    const canonicalRouterAgentId =
      registration?.teammateId ??
      registration?.profileId ??
      legacyRouter?.id ??
      routerAgentId;
    const routerName =
      registration?.name ?? legacyRouter?.name ?? routerAgentId;
    const registeredProfile =
      registration === undefined
        ? undefined
        : this.deps.agent().profile(root.workspaceId, registration.profileId);
    if (
      registration !== undefined &&
      (registeredProfile === undefined || registeredProfile.status !== "active")
    ) {
      throw new RouterWorkerError(
        "conflict",
        "Router Agent 的 Agent Profile 不可用",
      );
    }
    const existing = this.activeForRoot(root.id);
    let forceFreshSession = false;
    if (existing !== undefined) {
      if (
        existing.routerAgentId === canonicalRouterAgentId ||
        existing.routerAgentId === registration?.profileId
      ) {
        const existingRun =
          existing.runId === undefined
            ? undefined
            : this.deps.agent().run(existing.runId);
        if (
          existingRun !== undefined &&
          ["queued", "running"].includes(existingRun.status)
        ) {
          return existing;
        }
        if (existingRun?.status === "waiting_input") {
          const cancel = this.deps.agent().cancel;
          if (cancel === undefined) {
            throw new RouterWorkerError(
              "conflict",
              "Router 正在等待补充信息，当前运行无法自动重试",
            );
          }
          await cancel.call(this.deps.agent(), existing.runId!);
        }
        const failed = routerCycleSchema.parse({
          ...existing,
          status: "failed",
          error:
            existingRun === undefined
              ? "Router 运行记录已丢失，已终止旧 Cycle，请重新解析"
              : existingRun.status === "waiting_input"
                ? "Router 请求了交互式确认，已终止该等待运行，请重新解析"
                : existingRun.error?.trim() ||
                  `Router Run 已结束（${existingRun.status}），请重新解析`,
          updatedAt: nowIso(),
        });
        await this.cycles.put(failed.id, failed);
        forceFreshSession = true;
      } else {
        throw new RouterWorkerError(
          "conflict",
          "当前主任务已有运行中的 Router Cycle，不能临时切换 Router",
        );
      }
    }
    const teammates = this.deps.teammates();
    if (teammates === undefined) {
      throw new RouterWorkerError("conflict", "AI伙伴运行时服务不可用");
    }
    const ensured = await teammates.ensureRuntime({
      teammateId: canonicalRouterAgentId,
      workspaceId: root.workspaceId,
      actor: runtimeActor(input.actor),
      workspaceRole: workspaceRoleFor(input.actor),
    });
    if (ensured.principalId === undefined) {
      throw new RouterWorkerError(
        "conflict",
        "Router AI伙伴缺少可执行 Principal，不能启动",
      );
    }
    const profileId = ensured.profileId;
    const agent = this.deps.agent();
    const routerProfile = agent.profile(root.workspaceId, profileId);
    if (routerProfile === undefined || routerProfile.status !== "active") {
      throw new RouterWorkerError(
        "conflict",
        "Router Agent 的 Agent Profile 不可用",
      );
    }
    await agent.updateRuntimeProfile?.(
      {
        kind: "user",
        id: input.actor.id,
        name: input.actor.name,
        globalRole: input.actor.role,
        workspaceRole: workspaceRoleFor(input.actor),
        workspaceId: root.workspaceId,
      },
      {
        workspaceId: root.workspaceId,
        profileId,
        allowedTools: [...ROUTER_TEMPLATE_TOOLS],
      },
    );
    const principalRuntime = this.deps.principalRuntime();
    const ticket =
      principalRuntime !== undefined &&
      principalRuntime.profile(ensured.principalId, root.workspaceId) !==
        undefined
        ? await principalRuntime.issueTicket({
            principalId: ensured.principalId,
            workspaceId: root.workspaceId,
            contextType: "task",
            contextId: root.id,
            requestedActions: ["read"],
            resourceScopes: [`task/${root.id}`, `router-worker/${root.id}`],
            durationMinutes: 60,
            issuedByUserId: input.actor.id,
          })
        : undefined;
    const preflight = agent.preflightForProfile?.({
      workspaceId: root.workspaceId,
      taskId: root.id,
      profileId,
      principalId: ensured.principalId,
      teammateId: canonicalRouterAgentId,
      ...(ticket === undefined ? {} : { ticketId: ticket.id }),
    });
    const blockingGaps =
      preflight?.gaps.filter((gap) => gap.necessity === "required") ?? [];
    if (blockingGaps.length > 0) {
      throw new RouterWorkerError(
        "conflict",
        blockingGaps.map((gap) => gap.message).join("；"),
      );
    }
    const actorInput = runtimeActor(input.actor);
    const routerWorkerIds = new Set(
      registrations.flatMap((candidate) => [
        ...(candidate.teammateId === undefined ? [] : [candidate.teammateId]),
        candidate.profileId,
        ...(candidate.employeeId === undefined ? [] : [candidate.employeeId]),
      ]),
    );
    routerWorkerIds.add(canonicalRouterAgentId);
    routerWorkerIds.add(profileId);
    if (ensured.employeeId !== undefined) {
      routerWorkerIds.add(ensured.employeeId);
    }
    for (const candidate of this.deps.teammateService()?.list() ?? []) {
      if (
        candidate.templateId !== undefined &&
        this.isRouterTemplate(candidate.templateId)
      ) {
        routerWorkerIds.add(candidate.id);
      }
    }
    const candidateWorkers: RouterCandidate[] = [
      ...this.deps.team.members(root.workspaceId).map((member) => {
        const user = this.deps.team
          .users()
          .find((candidate) => candidate.id === member.userId);
        return {
          id: member.userId,
          name: user?.name ?? member.userId,
          kind: "human" as const,
          ...(member.memberRole === undefined
            ? {}
            : { role: member.memberRole }),
          available: true,
        };
      }),
      ...teammates
        .assignable(actorInput, root.workspaceId)
        .filter((candidate) => !routerWorkerIds.has(candidate.id))
        .map((candidate) => ({
          id: candidate.id,
          name: candidate.name,
          kind: "agent" as const,
          ownerName: candidate.ownerName,
          available: true,
        })),
    ];
    const at = nowIso();
    const requestKey = [
      "router-worker-cycle",
      root.id,
      input.planner === "final" ? "final" : "plan",
      input.trigger,
      input.plan?.plan.currentVersion ?? "new",
    ].join(":");
    const cycleId = `rw-cycle-${randomUUID()}`;
    const baseRouterSessionId =
      `de-router-${root.id}-${ensured.employeeId ?? profileId}`
        .replace(/[^a-zA-Z0-9._-]/g, "-")
        .slice(0, 200);
    const routerSessionId = forceFreshSession
      ? `${baseRouterSessionId.slice(0, 180)}-retry-${cycleId.slice(-8)}`
      : baseRouterSessionId;
    const cycle = routerCycleSchema.parse({
      id: cycleId,
      workspaceId: root.workspaceId,
      rootTaskId: root.id,
      ...(input.plan === undefined ? {} : { planId: input.plan.plan.id }),
      routerAgentId: canonicalRouterAgentId,
      kind:
        input.planner === "final"
          ? "finalize"
          : input.plan === undefined
            ? "plan"
            : "replan",
      trigger: input.trigger,
      allowSourceReplacement: input.allowSourceReplacement === true,
      requestKey,
      createdBy: input.actor.id,
      status: "queued",
      sessionId: routerSessionId,
      createdAt: at,
      updatedAt: at,
    });
    await this.cycles.put(cycle.id, cycle);
    try {
      const promptPlan =
        input.plan === undefined
          ? undefined
          : {
              ...input.plan,
              nodeStates: input.plan.nodeStates.map((state) => {
                if (
                  state.taskId === undefined ||
                  state.resultSummary !== undefined
                ) {
                  return state;
                }
                const task = this.deps.tasks().get(state.taskId);
                const messages = task.messages ?? [];
                const result = [...messages]
                  .reverse()
                  .find(
                    (message) =>
                      (message.kind === "agent" || message.kind === "human") &&
                      message.content.trim() !== "",
                  );
                return {
                  ...state,
                  ...(result === undefined
                    ? {}
                    : {
                        resultSummary: result.content.trim().slice(0, 4_000),
                      }),
                };
              }),
            };
      const prompt = buildRouterCyclePrompt({
        rootTask: root,
        kind: input.planner === "final" ? "finalize" : cycle.kind,
        trigger: input.trigger,
        routerAgentName: routerName,
        candidates: candidateWorkers,
        ...(promptPlan === undefined ? {} : { currentPlan: promptPlan }),
        constraints: {
          maxNodes: 20,
          maxDepth: 8,
          maxFanOut: 8,
          maxConcurrency: input.plan?.plan.settings.maxConcurrency ?? 3,
        },
      });
      const workspacePath = this.deps
        .workspaces?.()
        ?.get(root.workspaceId)?.path;
      const run = await agent.dispatch({
        workspaceId: root.workspaceId,
        ...(workspacePath === undefined ? {} : { workspacePath }),
        profileId,
        source: "task",
        instanceId: root.id,
        nodeId: input.planner === "final" ? "router-finalize" : "router-plan",
        dispatchKey: cycle.id,
        trigger: "manual-dispatch",
        attempt: 1,
        runSeq: 1,
        maxAttempts: 1,
        timeoutMs: 10 * 60_000,
        ...(ensured.personaId === undefined
          ? {}
          : { personaId: ensured.personaId }),
        ...(ensured.employeeId === undefined
          ? {}
          : { employeeId: ensured.employeeId }),
        principalId: ensured.principalId,
        ...(ensured.employeeId === undefined
          ? { principalType: "principal-runtime" as const }
          : { principalType: "digital-employee" as const }),
        ...(ticket === undefined ? {} : { ticketId: ticket.id }),
        sessionId: routerSessionId,
        createdBy: input.actor.id,
        payload: {
          instanceTitle: root.title.slice(0, 160),
          nodeName:
            input.planner === "final" ? "Router 最终草稿" : "Router 任务规划",
          nodeDescription: root.description?.slice(0, 2_000) ?? "",
          profileName: routerName.slice(0, 120),
          responsibleId: input.actor.id,
          deliverables: [],
          context: {
            workspaceId: root.workspaceId,
            taskId: root.id,
            taskReceiverId: canonicalRouterAgentId,
            taskReceiverName: routerName,
            taskRunRole: "fyi",
            taskSessionEpoch: "0",
            employeeName: routerName,
            principalId: ensured.principalId,
            ...(ticket === undefined ? {} : { ticketId: ticket.id }),
            instruction: prompt,
            routerCycleId: cycle.id,
            routerCycleKind: cycle.kind,
          },
        },
      });
      const running = routerCycleSchema.parse({
        ...cycle,
        status:
          run.status === "queued"
            ? "queued"
            : run.status === "running"
              ? "running"
              : "running",
        runId: run.id,
        ...(run.sessionId === undefined ? {} : { sessionId: run.sessionId }),
        updatedAt: nowIso(),
      });
      await this.cycles.put(running.id, running);
      return running;
    } catch (cause) {
      const failed = routerCycleSchema.parse({
        ...cycle,
        status: "failed",
        error: cause instanceof Error ? cause.message : "Router Cycle 启动失败",
        updatedAt: nowIso(),
      });
      await this.cycles.put(failed.id, failed);
      throw cause;
    }
  }

  get(cycleId: string): RouterCycle {
    const cycle = this.cycles.get(cycleId);
    if (cycle === undefined) {
      throw new RouterWorkerError("not_found", "Router Cycle 不存在");
    }
    this.requireEnabled(cycle.workspaceId);
    return routerCycleSchema.parse(cycle);
  }

  findByRunId(runId: string): RouterCycle | undefined {
    const cycle = [...this.cycles.entries()]
      .map(([, value]) => routerCycleSchema.parse(value))
      .find((value) => value.runId === runId);
    return cycle === undefined ? undefined : routerCycleSchema.parse(cycle);
  }

  findBySessionId(sessionId: string): RouterCycle | undefined {
    return [...this.cycles.entries()]
      .map(([, value]) => routerCycleSchema.parse(value))
      .filter(
        (value) =>
          value.sessionId === sessionId &&
          ["queued", "running"].includes(value.status),
      )
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt))[0];
  }

  async refresh(cycleId: string): Promise<RouterCycle> {
    const cycle = this.get(cycleId);
    if (cycle.runId === undefined || cycle.status === "submitted") return cycle;
    const run = this.deps.agent().run?.(cycle.runId);
    if (run === undefined) return cycle;
    const nextStatus =
      run.status === "queued"
        ? "queued"
        : run.status === "running" || run.status === "waiting_input"
          ? "running"
          : run.status === "succeeded"
            ? "failed"
            : "failed";
    const next = routerCycleSchema.parse({
      ...cycle,
      status: nextStatus,
      ...(nextStatus === "failed" && run.status === "succeeded"
        ? {
            error:
              "Router Run 已结束，但没有提交结构化结果；请重试或检查 Router Prompt/工具绑定。",
          }
        : nextStatus === "failed" && run.error !== undefined
          ? { error: run.error }
          : {}),
      updatedAt: nowIso(),
    });
    await this.cycles.put(next.id, next);
    return next;
  }

  async markSubmitted(
    cycleId: string,
    sessionId?: string | undefined,
  ): Promise<RouterCycle> {
    const cycle = this.get(cycleId);
    const submitted = routerCycleSchema.parse({
      ...cycle,
      status: "submitted",
      ...(sessionId === undefined ? {} : { sessionId }),
      updatedAt: nowIso(),
    });
    await this.cycles.put(submitted.id, submitted);
    return submitted;
  }
}
