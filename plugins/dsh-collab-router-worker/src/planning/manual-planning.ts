import type { RouterAgentDispatchInput } from "../router-cycle.js";
import type { PlanActor, RootTaskLike } from "../service.js";
import {
  buildPlanningCriticContextPack,
  buildPlanningContextPack,
  type PlanningContextServiceLike,
  type PlanningTaskLike,
  type PlanningWorkerCandidate,
} from "./context-builder.js";
import type { PlanningMode, PlanningRun, PlanningTrigger } from "./models.js";
import type { PlanningService } from "./service.js";
import {
  planningSkillSnapshotInput,
  type PlanningSkillResolutionLike,
} from "./skill-context.js";
import {
  planningKnowledgeReceiptInput,
  planningKnowledgeSections,
  type PlanningKnowledgeContribution,
  type PlanningKnowledgeProvider,
} from "./knowledge-provider.js";

export interface PlanningTeamLike {
  members(workspaceId: string): readonly {
    readonly userId: string;
    readonly memberRole?: string | undefined;
  }[];
  users(): readonly { readonly id: string; readonly name: string }[];
}

export interface PlanningTeammateLike {
  readonly id: string;
  readonly name: string;
  readonly ownerUserId?: string | undefined;
  readonly systemKey?: string | undefined;
  readonly workspaceBinding?: {
    readonly workspaceId: string;
    readonly roleKey: string;
  };
}

export interface PlanningTeammateServiceLike {
  get(teammateId: string): PlanningTeammateLike;
  workspaceAgentFor(workspaceId: string): PlanningTeammateLike | undefined;
}

export interface PlanningTeammateRuntimeLike {
  ensureWorkspaceSystemAgent(input: {
    readonly workspaceId: string;
    readonly systemKey: "task-planner";
    readonly actor: {
      readonly userId: string;
      readonly name: string;
      readonly role: "admin" | "owner" | "member" | "guest";
    };
  }): Promise<PlanningTeammateLike>;
  ensureRuntime(input: {
    readonly teammateId: string;
    readonly workspaceId: string;
    readonly actor: {
      readonly userId: string;
      readonly name: string;
      readonly role: "admin" | "owner" | "member" | "guest";
    };
    readonly workspaceRole?: "owner" | "member" | "guest" | undefined;
  }): Promise<{
    readonly teammateId: string;
    readonly employeeId?: string | undefined;
    readonly principalId?: string | undefined;
    readonly profileId: string;
    readonly personaId?: string | undefined;
  }>;
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
    readonly execution?: "builtin" | "external" | undefined;
  }[];
}

export interface PlanningSkillServiceLike {
  resolveForScene(input: {
    readonly teammateId: string;
    readonly scene: string;
    readonly principalId: string;
  }): Promise<PlanningSkillResolutionLike>;
}

export interface PlanningPrincipalRuntimeLike {
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

export interface PlanningAgentLike {
  dispatch(input: RouterAgentDispatchInput): Promise<{
    readonly id: string;
    readonly status: string;
    readonly sessionId?: string | undefined;
  }>;
  run(runId: string):
    | {
        readonly id: string;
        readonly status: string;
        readonly sessionId?: string | undefined;
        readonly error?: string | undefined;
      }
    | undefined;
  cancel?(runId: string): Promise<unknown>;
  profile(
    workspaceId: string,
    profileId: string,
  ):
    | {
        readonly id: string;
        readonly name: string;
        readonly status: "active" | "disabled";
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
}

export interface PlanningWorkspaceRegistryLike {
  get(workspaceId: string): { readonly path?: string | undefined } | undefined;
}

export interface ManualPlanningCoordinatorDeps {
  readonly planning: PlanningService;
  readonly team: PlanningTeamLike;
  readonly tasks: {
    get(taskId: string): RootTaskLike;
  };
  readonly teammates: () => PlanningTeammateRuntimeLike | undefined;
  readonly teammateService: () => PlanningTeammateServiceLike | undefined;
  readonly teammateSkills: () => PlanningSkillServiceLike | undefined;
  readonly context: () => PlanningContextServiceLike | undefined;
  readonly principalRuntime: () => PlanningPrincipalRuntimeLike | undefined;
  readonly agent: () => PlanningAgentLike;
  readonly workspaces: () => PlanningWorkspaceRegistryLike | undefined;
  readonly plans: {
    detail(planId: string): {
      readonly plan: { readonly id: string };
      readonly version: { readonly id: string; readonly graph: unknown };
      readonly nodeStates: readonly unknown[];
    };
  };
  readonly knowledge: () => PlanningKnowledgeProvider | undefined;
}

export class ManualPlanningCoordinator {
  constructor(private readonly deps: ManualPlanningCoordinatorDeps) {}

  async start(input: {
    readonly actor: PlanActor;
    readonly workspaceId: string;
    readonly rootTaskId: string;
    readonly expectedTaskRevision: string;
    readonly mode: PlanningMode;
    readonly plannerAgentId?: string | undefined;
    readonly trigger?: PlanningTrigger | undefined;
    readonly eventKey?: string | undefined;
    readonly taskDefinitionDigest?: string | undefined;
  }): Promise<{
    readonly run: PlanningRun;
    readonly joinedActive: boolean;
    readonly createdRun: boolean;
  }> {
    const loadedTask = this.deps.tasks.get(input.rootTaskId);
    if (loadedTask.workspaceId !== input.workspaceId) {
      throw new Error("主任务不属于当前工作区");
    }
    if (loadedTask.updatedAt !== input.expectedTaskRevision) {
      throw new Error("任务内容已变化，请刷新后重新发起规划");
    }
    const task: PlanningTaskLike = {
      ...loadedTask,
      description: loadedTask.description ?? "",
      acceptance: loadedTask.acceptance ?? [],
      receiverType: loadedTask.receiverType ?? "unassigned",
      links: (loadedTask.links ?? []).map((link) => ({
        type: link.type,
        id: link.id,
      })),
    };
    const requested = await this.deps.planning.requestPlanningTrigger({
      workspaceId: input.workspaceId,
      rootTaskId: input.rootTaskId,
      taskRevision: input.expectedTaskRevision,
      trigger: input.trigger ?? {
        kind: "human-manual",
        userId: input.actor.id,
      },
      mode: input.mode,
      ...(input.plannerAgentId === undefined
        ? {}
        : { plannerAgentId: input.plannerAgentId }),
      eventKey: input.eventKey ?? `manual:${input.actor.id}`,
      ...(input.taskDefinitionDigest === undefined
        ? {}
        : { taskDefinitionDigest: input.taskDefinitionDigest }),
    });
    if (requested.joinedActive || !requested.createdRun) {
      return {
        run: requested.run,
        joinedActive: requested.joinedActive,
        createdRun: requested.createdRun,
      };
    }
    let run = requested.run;
    try {
      const preparing = await this.deps.planning.transition(
        run.id,
        "preparing",
        { expectedRevision: run.revision },
      );
      run = preparing.run;
      const resolved = await this.resolvePlanner(input);
      const skillResolution = await this.resolveSkills(
        resolved.teammate.id,
        input.actor.id,
      );
      const snapshot = await this.deps.planning.saveSkillSnapshot(run.id, {
        ...planningSkillSnapshotInput(skillResolution),
      });
      run = this.deps.planning.getRun(run.id);
      const context = this.deps.context();
      if (context === undefined) {
        throw new Error("ContextCenter 不可用，无法构建规划上下文");
      }
      const knowledge = await this.retrieveKnowledge(
        run,
        task,
        skillResolution,
      );
      const contextPack = await buildPlanningContextPack({
        context,
        task,
        runId: run.id,
        plannerPrincipalId: resolved.principalId,
        plannerProfileId: resolved.profileId,
        plannerTeammateId: resolved.teammate.id,
        actorPrincipalId: input.actor.id,
        mode: input.mode,
        candidates: this.candidates(input.workspaceId, input.actor, resolved),
        skills: skillResolution,
        knowledgeSections: planningKnowledgeSections(
          knowledge.contributions,
        ).slice(
          0,
          Math.max(
            0,
            20 -
              skillResolution.effective.filter(
                (skill) => skill.instructions.trim() !== "",
              ).length,
          ),
        ),
      });
      const knowledgeReceipt =
        knowledge.providerId === undefined
          ? undefined
          : await this.deps.planning.saveKnowledgeReceipt(
              run.id,
              planningKnowledgeReceiptInput({
                providerId: knowledge.providerId,
                contextPackId: contextPack.pack.id,
                contributions: knowledge.contributions,
                excluded: knowledge.excluded,
              }),
            );
      if (knowledgeReceipt !== undefined) {
        run = this.deps.planning.getRun(run.id);
      }
      const ticket = await this.issueTicket({
        actor: input.actor,
        task,
        principalId: resolved.principalId,
        runId: run.id,
      });
      this.assertPreflight({
        workspaceId: input.workspaceId,
        taskId: task.id,
        profileId: resolved.profileId,
        principalId: resolved.principalId,
        teammateId: resolved.teammate.id,
        ...(ticket === undefined ? {} : { ticketId: ticket.id }),
      });
      const plannerSessionId =
        context.session?.(contextPack.pack.sessionBindingId)?.sessionId ??
        `de-planning-${run.id}-${resolved.profileId}`
          .replace(/[^a-zA-Z0-9._-]/g, "-")
          .slice(0, 200);
      run = await this.deps.planning.updateRun(
        run.id,
        {
          contextPackId: contextPack.pack.id,
          plannerTeammateId: resolved.teammate.id,
          plannerProfileId: resolved.profileId,
          plannerPrincipalId: resolved.principalId,
          skillSnapshotId: snapshot.id,
          sessionId: plannerSessionId,
          ...(knowledgeReceipt === undefined
            ? {}
            : { knowledgeReceiptId: knowledgeReceipt.id }),
        },
        run.revision,
      );
      const understanding = await this.deps.planning.transition(
        run.id,
        "understanding",
        { expectedRevision: run.revision },
      );
      run = understanding.run;
      const workspacePath = this.deps
        .workspaces?.()
        ?.get(input.workspaceId)?.path;
      const agentRun = await this.deps.agent().dispatch({
        workspaceId: input.workspaceId,
        ...(workspacePath === undefined ? {} : { workspacePath }),
        profileId: resolved.profileId,
        source: "task",
        instanceId: task.id,
        nodeId: "task-planning",
        dispatchKey: `planning:${run.id}`,
        trigger: "manual-dispatch",
        attempt: 1,
        runSeq: 1,
        maxAttempts: 1,
        timeoutMs: 15 * 60_000,
        ...(resolved.personaId === undefined
          ? {}
          : { personaId: resolved.personaId }),
        ...(resolved.employeeId === undefined
          ? {}
          : { employeeId: resolved.employeeId }),
        principalId: resolved.principalId,
        principalType:
          resolved.employeeId === undefined
            ? "principal-runtime"
            : "digital-employee",
        ...(ticket === undefined ? {} : { ticketId: ticket.id }),
        contextPackId: contextPack.pack.id,
        sessionBindingId: contextPack.pack.sessionBindingId,
        sessionId: plannerSessionId,
        payload: {
          instanceTitle: task.title.slice(0, 160),
          nodeName: "任务规划",
          nodeDescription: task.description.slice(0, 2_000),
          profileName:
            this.deps.agent().profile(input.workspaceId, resolved.profileId)
              ?.name ?? resolved.teammate.name,
          responsibleId: input.actor.id,
          deliverables: [],
          context: {
            workspaceId: input.workspaceId,
            taskId: task.id,
            taskReceiverId: resolved.teammate.id,
            taskReceiverName: resolved.teammate.name,
            taskRunRole: "fyi",
            taskSessionEpoch: "0",
            employeeName: resolved.teammate.name,
            principalId: resolved.principalId,
            ...(ticket === undefined ? {} : { ticketId: ticket.id }),
            systemText: contextPack.systemText,
            instruction: contextPack.instruction,
            planningRunId: run.id,
            planningMode: input.mode,
            contextPackId: contextPack.pack.id,
          },
        },
        createdBy: input.actor.id,
      });
      run = await this.deps.planning.updateRun(
        run.id,
        {
          runId: agentRun.id,
          ...(agentRun.sessionId === undefined
            ? {}
            : { sessionId: agentRun.sessionId }),
        },
        run.revision,
      );
      await this.deps.context()?.recordRuntime?.({
        runId: agentRun.id,
        contextPackId: contextPack.pack.id,
        runtime: {
          kind: "builtin",
        },
      });
      return {
        run,
        joinedActive: false,
        createdRun: true,
      };
    } catch (cause) {
      const message =
        cause instanceof Error ? cause.message : "Planning Run 启动失败";
      await this.deps.planning
        .failRun(run.id, "planning_start_failed", message)
        .catch(() => undefined);
      throw cause;
    }
  }

  async refresh(runId: string): Promise<{
    readonly run: PlanningRun;
    readonly runStatus?: string | undefined;
  }> {
    let run = this.deps.planning.getRun(runId);
    const activeAgentRunId =
      run.status === "critiquing" ? run.criticRunId : run.runId;
    const agentRun =
      activeAgentRunId === undefined
        ? undefined
        : this.deps.agent().run(activeAgentRunId);
    if (
      run.status === "critiquing" &&
      agentRun !== undefined &&
      ["succeeded", "failed", "timeout", "cancelled", "interrupted"].includes(
        agentRun.status,
      ) &&
      this.deps.planning.criticReports(run.id).length === 0
    ) {
      const failed = await this.deps.planning.failRun(
        run.id,
        "critic_run_finished",
        agentRun.error?.trim() ||
          `Plan Critic Run 已结束（${agentRun.status}），但没有提交结构化报告`,
      );
      run = failed.run;
      return { run, runStatus: agentRun.status };
    }
    if (
      agentRun !== undefined &&
      run.planId === undefined &&
      ["succeeded", "failed", "timeout", "cancelled", "interrupted"].includes(
        agentRun.status,
      ) &&
      !["review_required", "succeeded", "failed", "cancelled"].includes(
        run.status,
      )
    ) {
      const failed = await this.deps.planning.failRun(
        run.id,
        "planner_run_finished",
        agentRun.error?.trim() ||
          `Planner Run 已结束（${agentRun.status}），但没有提交 Plan Draft`,
      );
      run = failed.run;
    }
    return {
      run,
      ...(agentRun === undefined ? {} : { runStatus: agentRun.status }),
    };
  }

  async startCritic(runId: string, actor: PlanActor): Promise<PlanningRun> {
    let run = this.deps.planning.getRun(runId);
    if (run.status !== "critiquing" || run.planId === undefined) {
      throw new Error("Planning Run 不在 Critic 阶段");
    }
    if (run.criticRunId !== undefined) return run;
    try {
      const task = this.deps.tasks.get(run.rootTaskId);
      const teammateId = run.plannerTeammateId;
      if (teammateId === undefined) {
        throw new Error("Planning Run 缺少 Planner 身份");
      }
      const resolved = await this.resolvePlanner({
        actor,
        workspaceId: run.workspaceId,
        plannerAgentId: teammateId,
      });
      const context = this.deps.context();
      if (context === undefined) {
        throw new Error("ContextCenter 不可用，无法构建 Critic 上下文");
      }
      const snapshot = this.deps.planning.skillSnapshot(run.id);
      if (snapshot === undefined) {
        throw new Error("Planning Skill Snapshot 缺失");
      }
      const brief = this.deps.planning.briefs(run.id).at(-1);
      const facts = this.deps.planning.facts(run.id).at(-1);
      if (brief === undefined || facts === undefined) {
        throw new Error("Requirement Brief 或 Facts Ledger 缺失");
      }
      const detail = this.deps.plans.detail(run.planId);
      const criticPack = await buildPlanningCriticContextPack({
        context,
        task: {
          ...task,
          description: task.description ?? "",
          acceptance: task.acceptance ?? [],
          receiverType: task.receiverType ?? "unassigned",
          links: (task.links ?? []).map((link) => ({
            type: link.type,
            id: link.id,
          })),
        },
        runId: run.id,
        plannerPrincipalId: resolved.principalId,
        plannerProfileId: resolved.profileId,
        plannerTeammateId: resolved.teammate.id,
        actorPrincipalId: actor.id,
        brief,
        facts,
        plan: detail,
        skills: {
          teammateId: snapshot.teammateId ?? resolved.teammate.id,
          ...(snapshot.templateId === undefined
            ? {}
            : { templateId: snapshot.templateId }),
          policyVersion: snapshot.policyVersion,
          effective: snapshot.skills.map((skill) => ({
            id: skill.id,
            name: skill.name,
            version: skill.version,
            bindingSource: skill.bindingSource,
            mode: skill.mode,
            scenes: skill.scenes,
            instructions: skill.instructions,
            instructionsHash: skill.instructionsHash,
          })),
          excluded: snapshot.excluded,
        },
      });
      const sessionId =
        context.session?.(criticPack.pack.sessionBindingId)?.sessionId ??
        `de-planning-critic-${run.id}-${resolved.profileId}`
          .replace(/[^a-zA-Z0-9._-]/g, "-")
          .slice(0, 200);
      const ticket = await this.issueTicket({
        actor,
        task,
        principalId: resolved.principalId,
        runId: run.id,
      });
      this.assertPreflight({
        workspaceId: run.workspaceId,
        taskId: task.id,
        profileId: resolved.profileId,
        principalId: resolved.principalId,
        teammateId: resolved.teammate.id,
        ...(ticket === undefined ? {} : { ticketId: ticket.id }),
      });
      run = await this.deps.planning.updateRun(
        run.id,
        {
          criticContextPackId: criticPack.pack.id,
          criticSessionId: sessionId,
        },
        run.revision,
      );
      const workspacePath = this.deps
        .workspaces?.()
        ?.get(run.workspaceId)?.path;
      const criticRun = await this.deps.agent().dispatch({
        workspaceId: run.workspaceId,
        ...(workspacePath === undefined ? {} : { workspacePath }),
        profileId: resolved.profileId,
        source: "task",
        instanceId: task.id,
        nodeId: "task-planning-critic",
        dispatchKey: `planning:critic:${run.id}`,
        trigger: "manual-dispatch",
        attempt: 1,
        runSeq: 1,
        maxAttempts: 1,
        timeoutMs: 10 * 60_000,
        ...(resolved.personaId === undefined
          ? {}
          : { personaId: resolved.personaId }),
        ...(resolved.employeeId === undefined
          ? {}
          : { employeeId: resolved.employeeId }),
        principalId: resolved.principalId,
        principalType:
          resolved.employeeId === undefined
            ? "principal-runtime"
            : "digital-employee",
        ...(ticket === undefined ? {} : { ticketId: ticket.id }),
        contextPackId: criticPack.pack.id,
        sessionBindingId: criticPack.pack.sessionBindingId,
        sessionId,
        payload: {
          instanceTitle: task.title.slice(0, 160),
          nodeName: "任务规划 Critic",
          nodeDescription: task.description?.slice(0, 2_000) ?? "",
          profileName: resolved.teammate.name,
          responsibleId: actor.id,
          deliverables: [],
          context: {
            workspaceId: run.workspaceId,
            taskId: task.id,
            taskReceiverId: resolved.teammate.id,
            taskReceiverName: resolved.teammate.name,
            taskRunRole: "fyi",
            taskSessionEpoch: "0",
            employeeName: resolved.teammate.name,
            principalId: resolved.principalId,
            ...(ticket === undefined ? {} : { ticketId: ticket.id }),
            systemText: criticPack.systemText,
            instruction: criticPack.instruction,
            planningRunId: run.id,
            planningMode: run.mode,
            contextPackId: criticPack.pack.id,
          },
        },
        createdBy: actor.id,
      });
      run = await this.deps.planning.updateRun(
        run.id,
        {
          criticRunId: criticRun.id,
          ...(criticRun.sessionId === undefined
            ? {}
            : { criticSessionId: criticRun.sessionId }),
        },
        run.revision,
      );
      await this.deps.context()?.recordRuntime?.({
        runId: criticRun.id,
        contextPackId: criticPack.pack.id,
        runtime: { kind: "builtin" },
      });
      return run;
    } catch (cause) {
      const message =
        cause instanceof Error ? cause.message : "Plan Critic 启动失败";
      await this.deps.planning
        .failRun(run.id, "plan_critic_start_failed", message)
        .catch(() => undefined);
      throw cause;
    }
  }

  async cancel(runId: string, reason: string): Promise<PlanningRun> {
    const run = this.deps.planning.getRun(runId);
    if (run.runId !== undefined) {
      await this.deps
        .agent()
        .cancel?.(run.runId)
        .catch(() => undefined);
    }
    if (run.criticRunId !== undefined && run.criticRunId !== run.runId) {
      await this.deps
        .agent()
        .cancel?.(run.criticRunId)
        .catch(() => undefined);
    }
    const cancelled = await this.deps.planning.cancelRun(runId, reason);
    return cancelled.run;
  }

  private async resolvePlanner(input: {
    readonly actor: PlanActor;
    readonly workspaceId: string;
    readonly plannerAgentId?: string | undefined;
  }): Promise<{
    readonly teammate: PlanningTeammateLike;
    readonly profileId: string;
    readonly principalId: string;
    readonly employeeId?: string | undefined;
    readonly personaId?: string | undefined;
  }> {
    const runtime = this.deps.teammates();
    const teammates = this.deps.teammateService();
    if (runtime === undefined || teammates === undefined) {
      throw new Error("AI伙伴服务不可用，无法解析任务规划伙伴");
    }
    const runtimeActor = this.runtimeActor(input.actor);
    const requested =
      input.plannerAgentId === undefined
        ? undefined
        : (() => {
            try {
              return teammates.get(input.plannerAgentId);
            } catch {
              return teammates.workspaceAgentFor(input.workspaceId);
            }
          })();
    if (
      requested !== undefined &&
      (requested.systemKey !== "task-planner" ||
        requested.workspaceBinding?.workspaceId !== input.workspaceId)
    ) {
      throw new Error("指定 Agent 不是当前工作区的任务规划伙伴");
    }
    const teammate =
      requested ??
      (await runtime.ensureWorkspaceSystemAgent({
        workspaceId: input.workspaceId,
        systemKey: "task-planner",
        actor: runtimeActor,
      }));
    const ensured = await runtime.ensureRuntime({
      teammateId: teammate.id,
      workspaceId: input.workspaceId,
      actor: runtimeActor,
      workspaceRole: this.workspaceRole(input.actor),
    });
    if (ensured.principalId === undefined) {
      throw new Error("任务规划伙伴缺少可执行 Principal");
    }
    const profile = this.deps
      .agent()
      .profile(input.workspaceId, ensured.profileId);
    if (profile === undefined || profile.status !== "active") {
      throw new Error("任务规划伙伴的 Agent Profile 不可用");
    }
    return {
      teammate,
      profileId: ensured.profileId,
      principalId: ensured.principalId,
      ...(ensured.employeeId === undefined
        ? {}
        : { employeeId: ensured.employeeId }),
      ...(ensured.personaId === undefined
        ? {}
        : { personaId: ensured.personaId }),
    };
  }

  private async resolveSkills(
    teammateId: string,
    principalId: string,
  ): Promise<PlanningSkillResolutionLike> {
    const skills = this.deps.teammateSkills();
    if (skills === undefined) {
      throw new Error("AI伙伴 Skill 解析服务不可用");
    }
    return skills.resolveForScene({
      teammateId,
      scene: "task-planning",
      principalId,
    });
  }

  private async retrieveKnowledge(
    run: PlanningRun,
    task: PlanningTaskLike,
    skills: PlanningSkillResolutionLike,
  ): Promise<{
    readonly providerId?: string | undefined;
    readonly contributions: readonly PlanningKnowledgeContribution[];
    readonly excluded: readonly {
      readonly id: string;
      readonly reason: string;
    }[];
  }> {
    const provider = this.deps.knowledge();
    if (provider === undefined) {
      return { contributions: [], excluded: [] };
    }
    const settings = this.deps.planning.settings(run.workspaceId);
    let result: Awaited<ReturnType<PlanningKnowledgeProvider["retrieve"]>>;
    try {
      result = await provider.retrieve({
        workspaceId: run.workspaceId,
        taskId: task.id,
        taskRevision: run.taskRevision,
        scene: "task-planning",
        query: `${task.title}\n${task.description}`.slice(0, 8_000),
        domainTags: [
          ...new Set(
            skills.effective.flatMap((skill) => skill.scenes.slice(0, 5)),
          ),
        ].slice(0, 20),
        limit: 20,
      });
    } catch {
      result = {
        contributions: [],
        excluded: [{ id: "knowledge-provider", reason: "unavailable" }],
      };
    }
    return {
      providerId: settings.knowledgeProviderId ?? "collabPlanningKnowledge",
      contributions: result.contributions.slice(0, 20),
      excluded: result.excluded.slice(0, 100),
    };
  }

  private candidates(
    workspaceId: string,
    actor: PlanActor,
    planner: { readonly teammate: PlanningTeammateLike },
  ): PlanningWorkerCandidate[] {
    const runtime = this.deps.teammates();
    if (runtime === undefined) return [];
    const runtimeActor = this.runtimeActor(actor);
    return [
      ...this.deps.team.members(workspaceId).map((member) => ({
        id: member.userId,
        name:
          this.deps.team.users().find((user) => user.id === member.userId)
            ?.name ?? member.userId,
        kind: "human" as const,
        ...(member.memberRole === undefined ? {} : { role: member.memberRole }),
        available: true,
      })),
      ...runtime
        .assignable(runtimeActor, workspaceId)
        .filter((candidate) => candidate.id !== planner.teammate.id)
        .map((candidate) => ({
          id: candidate.id,
          name: candidate.name,
          kind: "agent" as const,
          ownerName: candidate.ownerName,
          available: true,
        })),
    ];
  }

  private async issueTicket(input: {
    readonly actor: PlanActor;
    readonly task: RootTaskLike;
    readonly principalId: string;
    readonly runId: string;
  }): Promise<{ readonly id: string } | undefined> {
    const runtime = this.deps.principalRuntime();
    if (
      runtime === undefined ||
      runtime.profile(input.principalId, input.task.workspaceId) === undefined
    ) {
      return undefined;
    }
    return runtime.issueTicket({
      principalId: input.principalId,
      workspaceId: input.task.workspaceId,
      contextType: "task",
      contextId: input.task.id,
      requestedActions: ["read"],
      resourceScopes: [`task/${input.task.id}`, `planning/${input.runId}`],
      durationMinutes: 60,
      issuedByUserId: input.actor.id,
    });
  }

  private assertPreflight(input: {
    readonly workspaceId: string;
    readonly taskId: string;
    readonly profileId: string;
    readonly principalId: string;
    readonly teammateId: string;
    readonly ticketId?: string | undefined;
  }): void {
    const gaps =
      this.deps
        .agent()
        .preflightForProfile?.(input)
        ?.gaps.filter((gap) => gap.necessity === "required") ?? [];
    if (gaps.length > 0) {
      throw new Error(gaps.map((gap) => gap.message).join("；"));
    }
  }

  private runtimeActor(actor: PlanActor) {
    return {
      userId: actor.id,
      name: actor.name,
      role: actor.role ?? ("member" as const),
    };
  }

  private workspaceRole(
    actor: PlanActor,
  ): "owner" | "member" | "guest" | undefined {
    return actor.role === "owner"
      ? "owner"
      : actor.role === "guest"
        ? "guest"
        : "member";
  }
}
