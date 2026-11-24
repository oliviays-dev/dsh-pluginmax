import { randomUUID } from "node:crypto";
import type {
  TaskCreationFromDraftResult,
  TaskDraftForCreation,
} from "@pluginmax/contracts";
import {
  dispatchBindingSchema,
  finalDraftSchema,
  nodeStateSchema,
  planGraphSchema,
  planRecordSchema,
  planSettingsSchema,
  planVersionSchema,
  type DispatchBinding,
  type FinalDraft,
  type NodeState,
  type PlanGraph,
  type PlanRecord,
  type PlanVersion,
} from "./models.js";
import { validatePlanGraph, type PlanValidationIssue } from "./validator.js";

export interface RouterWorkerTable<V> {
  get(key: string): V | undefined;
  entries(): IterableIterator<[string, V]>;
  put(key: string, value: V): Promise<void>;
}

export interface PlanActor {
  readonly id: string;
  readonly name: string;
  readonly kind: "human";
  readonly role?: "admin" | "owner" | "member" | "guest" | undefined;
}

export interface RootTaskLike {
  readonly id: string;
  readonly workspaceId: string;
  readonly creationKey?: string | undefined;
  readonly parentTaskId?: string | undefined;
  readonly title: string;
  readonly priority: "P1" | "P2" | "P3";
  readonly createdBy?: string | undefined;
  readonly description?: string | undefined;
  readonly acceptance?: readonly string[] | undefined;
  readonly receiverType?: "unassigned" | "human" | "agent" | "role" | undefined;
  readonly receiverId?: string | undefined;
  readonly receiverPrincipalId?: string | undefined;
  readonly due?: string | undefined;
  readonly receiverName?: string | undefined;
  readonly links?: readonly {
    readonly type: "meeting" | "workflow" | "document";
    readonly id: string;
  }[];
  readonly dependsOn?: readonly string[] | undefined;
  readonly createdByName?: string | undefined;
  readonly messages?: readonly {
    readonly kind: string;
    readonly authorName?: string | undefined;
    readonly content: string;
    readonly at?: string | undefined;
    readonly state?: string | undefined;
  }[];
  readonly events?: readonly {
    readonly kind: string;
    readonly actorPrincipalId?: string | undefined;
  }[];
  readonly status?:
    | "todo"
    | "progress"
    | "abnormal"
    | "review"
    | "done"
    | "cancelled"
    | undefined;
  readonly updatedAt?: string | undefined;
}

export interface TaskCreationLike {
  createFromDraft(
    actor: PlanActor,
    input: {
      readonly draft: TaskDraftForCreation;
      readonly creationKey: string;
      readonly parentTaskId?: string | undefined;
      readonly type?: string | undefined;
      readonly status?:
        "todo" | "progress" | "abnormal" | "review" | "done" | undefined;
      readonly executionPolicy?: unknown;
      readonly autoSubmitReview?: boolean | undefined;
      readonly autoApproveReview?: boolean | undefined;
    },
  ): Promise<TaskCreationFromDraftResult>;
}

export interface TaskDispatchLike {
  dispatch(task: RootTaskLike, actor: PlanActor): Promise<unknown>;
}

export interface PermissionLike {
  resolve(input: {
    readonly workspaceId: string;
    readonly principalId: string;
    readonly requestedActions: readonly string[];
    readonly requestedResources?: readonly string[];
  }):
    | {
        readonly allowed: boolean;
        readonly reasons: readonly string[];
      }
    | Promise<{
        readonly allowed: boolean;
        readonly reasons: readonly string[];
      }>;
}

export class RouterWorkerError extends Error {
  constructor(
    readonly code:
      "invalid_input" | "forbidden" | "not_found" | "conflict" | "gate_closed",
    message: string,
  ) {
    super(message);
    this.name = "RouterWorkerError";
  }
}

interface PlanTables {
  readonly plans: RouterWorkerTable<PlanRecord>;
  readonly versions: RouterWorkerTable<PlanVersion>;
  readonly nodes: RouterWorkerTable<NodeState>;
  readonly bindings: RouterWorkerTable<DispatchBinding>;
  readonly drafts: RouterWorkerTable<FinalDraft>;
}

function nowIso(): string {
  return new Date().toISOString();
}

function readyState(input: {
  plan: PlanRecord;
  nodeId: string;
  graph: PlanGraph;
  version: number;
  at: string;
}): NodeState {
  const node = input.graph.nodes.find((item) => item.id === input.nodeId)!;
  return nodeStateSchema.parse({
    id: `${input.plan.id}:${input.nodeId}`,
    planId: input.plan.id,
    workspaceId: input.plan.workspaceId,
    version: input.version,
    nodeId: input.nodeId,
    status: node.dependencies.length === 0 ? "ready" : "waiting",
    attempt: 0,
    updatedAt: input.at,
  });
}

export class RouterWorkerPlanService {
  constructor(
    private readonly tables: PlanTables,
    private readonly deps: {
      readonly tasks: () => {
        get(taskId: string): RootTaskLike;
        addMessage?(
          actor: PlanActor,
          input: {
            readonly taskId: string;
            readonly content: string;
            readonly mentions?: readonly unknown[];
          },
        ): Promise<unknown>;
        changeStatus?(
          actor: PlanActor,
          input: {
            readonly taskId: string;
            readonly status: "todo" | "progress" | "review";
          },
        ): Promise<unknown>;
        recordActivity?(
          actor: PlanActor,
          input: {
            readonly taskId: string;
            readonly eventId: string;
            readonly message: string;
            readonly taskRefs?:
              | readonly {
                  readonly taskId: string;
                  readonly title: string;
                }[]
              | undefined;
          },
        ): Promise<unknown>;
      };
      readonly taskCreation: () => TaskCreationLike | undefined;
      readonly taskDispatch: () => TaskDispatchLike | undefined;
      readonly permission: () => PermissionLike | undefined;
      readonly enabled: (workspaceId: string) => boolean;
    },
  ) {}

  private requireEnabled(workspaceId: string): void {
    if (!this.deps.enabled(workspaceId)) {
      throw new RouterWorkerError("gate_closed", "Router / Worker 扩展未启用");
    }
  }

  private requirePlan(planId: string): PlanRecord {
    const plan = this.tables.plans.get(planId);
    if (plan === undefined) {
      throw new RouterWorkerError("not_found", "执行计划不存在");
    }
    this.requireEnabled(plan.workspaceId);
    return planRecordSchema.parse(plan);
  }

  private currentVersion(plan: PlanRecord): PlanVersion {
    const version = this.tables.versions.get(
      `${plan.id}:${plan.currentVersion}`,
    );
    if (version === undefined) {
      throw new RouterWorkerError("not_found", "计划版本不存在");
    }
    return planVersionSchema.parse(version);
  }

  private async recordPlanActivity(
    actor: PlanActor,
    plan: PlanRecord,
    action: string,
    message: string,
    taskRefs?:
      | readonly {
          readonly taskId: string;
          readonly title: string;
        }[]
      | undefined,
  ): Promise<void> {
    try {
      await this.deps.tasks().recordActivity?.(actor, {
        taskId: plan.rootTaskId,
        eventId: `${plan.id}:${action}`,
        message: `${actor.name} ${message}`,
        ...(taskRefs === undefined ? {} : { taskRefs }),
      });
    } catch {
      // Plan activity is useful history, but must not roll back a completed action.
    }
  }

  canManage(plan: PlanRecord, actor: PlanActor): boolean {
    if (
      actor.role === "admin" ||
      actor.role === "owner" ||
      actor.id === plan.createdBy
    ) {
      return true;
    }
    try {
      const rootTask = this.deps.tasks().get(plan.rootTaskId);
      if (
        rootTask.receiverType === "human" &&
        rootTask.receiverId === actor.id
      ) {
        return true;
      }
    } catch {
      // A missing root task must not grant plan-management access.
    }
    return false;
  }

  private requireManager(plan: PlanRecord, actor: PlanActor): void {
    if (this.canManage(plan, actor)) return;
    throw new RouterWorkerError(
      "forbidden",
      "只有计划创建人、主任务负责人或项目负责人可以操作",
    );
  }

  create(
    actor: PlanActor,
    input: {
      readonly workspaceId: string;
      readonly rootTaskId: string;
      readonly source?: "manual" | "router" | "template" | undefined;
      readonly templateInstanceId?: string | undefined;
      readonly routerAgentId?: string | undefined;
      readonly graph: unknown;
      readonly settings?: unknown;
      readonly initialStatus?: "draft" | "proposed" | undefined;
    },
  ): { readonly plan: PlanRecord; readonly version: PlanVersion } {
    this.requireEnabled(input.workspaceId);
    const root = this.deps.tasks().get(input.rootTaskId);
    if (
      root === undefined ||
      (root as { readonly workspaceId?: unknown }).workspaceId === undefined
    ) {
      throw new RouterWorkerError(
        "not_found",
        `主任务 ${input.rootTaskId} 不存在或不可读取`,
      );
    }
    if (root.workspaceId !== input.workspaceId) {
      throw new RouterWorkerError("forbidden", "主任务不属于当前项目");
    }
    const rootReceiverCanManage =
      root.receiverType === "human" && root.receiverId === actor.id;
    const rootCreatorCanBootstrap =
      root.receiverType !== "human" &&
      root.createdBy !== undefined &&
      root.createdBy === actor.id;
    if (
      !rootReceiverCanManage &&
      !rootCreatorCanBootstrap &&
      actor.role !== "admin" &&
      actor.role !== "owner"
    ) {
      throw new RouterWorkerError(
        "forbidden",
        "只有主任务负责人、Agent 主任务创建人或项目负责人可以创建执行计划",
      );
    }
    const graph = planGraphSchema.parse(input.graph);
    const settings = planSettingsSchema.parse(input.settings ?? {});
    const routerAgentId = input.routerAgentId ?? settings.routerAgentId;
    if (
      (input.source ?? "manual") === "router" &&
      routerAgentId === undefined
    ) {
      throw new RouterWorkerError(
        "invalid_input",
        "Router 生成的计划必须绑定 routerAgentId",
      );
    }
    if (
      routerAgentId !== undefined &&
      settings.routerAgentId !== undefined &&
      settings.routerAgentId !== routerAgentId
    ) {
      throw new RouterWorkerError(
        "invalid_input",
        "计划 Router 与计划设置中的 Router 不一致",
      );
    }
    const normalizedSettings =
      routerAgentId === undefined
        ? settings
        : planSettingsSchema.parse({
            ...settings,
            routerAgentId,
          });
    const issues = validatePlanGraph(graph, settings);
    const errors = issues.filter((issue) => issue.level === "error");
    if (errors.length > 0) {
      throw new RouterWorkerError(
        "invalid_input",
        errors.map((issue) => issue.message).join("；"),
      );
    }
    const at = nowIso();
    const plan = planRecordSchema.parse({
      id: `rw-plan-${randomUUID()}`,
      workspaceId: input.workspaceId,
      rootTaskId: input.rootTaskId,
      title: root.title,
      priority: root.priority,
      ...(root.due === undefined ? {} : { due: root.due }),
      ...(root.receiverName === undefined ? {} : { owner: root.receiverName }),
      ...(root.createdByName === undefined
        ? {}
        : { reviewer: root.createdByName }),
      source: input.source ?? "manual",
      ...(input.templateInstanceId === undefined
        ? {}
        : { templateInstanceId: input.templateInstanceId }),
      ...(routerAgentId === undefined ? {} : { routerAgentId }),
      finalizationMode:
        root.receiverType === "agent" ? "router_managed" : "owner_handoff",
      status: input.initialStatus ?? "draft",
      currentVersion: 1,
      settings: normalizedSettings,
      revision: 0,
      createdBy: actor.id,
      createdAt: at,
      updatedAt: at,
    });
    const version = planVersionSchema.parse({
      id: `${plan.id}:1`,
      planId: plan.id,
      workspaceId: plan.workspaceId,
      version: 1,
      status: input.initialStatus ?? "draft",
      graph,
      reason: "初始计划",
      createdBy: actor.id,
      createdAt: at,
    });
    return {
      plan,
      version,
    };
  }

  async saveCreate(
    actor: PlanActor,
    input: Parameters<RouterWorkerPlanService["create"]>[1],
  ): Promise<{ readonly plan: PlanRecord; readonly version: PlanVersion }> {
    const existing = this.findByRoot(input.workspaceId, input.rootTaskId);
    if (existing !== undefined) {
      return {
        plan: existing,
        version: this.currentVersion(existing),
      };
    }
    const result = this.create(actor, input);
    await this.tables.plans.put(result.plan.id, result.plan);
    await this.tables.versions.put(result.version.id, result.version);
    for (const node of result.version.graph.nodes) {
      const state = readyState({
        plan: result.plan,
        nodeId: node.id,
        graph: result.version.graph,
        version: result.version.version,
        at: result.version.createdAt,
      });
      await this.tables.nodes.put(state.id, state);
    }
    await this.recordPlanActivity(
      actor,
      result.plan,
      "created:v1",
      `创建任务规划 v1：共 ${result.version.graph.nodes.length} 个节点`,
    );
    return result;
  }

  async syncDispatchActivity(planId: string, actor: PlanActor): Promise<void> {
    const plan = this.requirePlan(planId);
    if (
      ![
        "active",
        "paused",
        "resume_required",
        "finalizing",
        "completed",
        "cancelled",
      ].includes(plan.status)
    ) {
      return;
    }
    const version = this.currentVersion(plan);
    const taskRefs = [...this.tables.bindings.entries()]
      .map(([, binding]) => binding)
      .filter(
        (binding) =>
          binding.planId === plan.id && binding.version === plan.currentVersion,
      )
      .map((binding) => {
        try {
          const task = this.deps.tasks().get(binding.taskId);
          return { taskId: binding.taskId, title: task.title };
        } catch {
          return { taskId: binding.taskId, title: binding.taskId };
        }
      });
    if (taskRefs.length === 0) return;
    await this.recordPlanActivity(
      actor,
      plan,
      `dispatched:v${version.version}`,
      `派发任务规划 v${version.version}：`,
      taskRefs,
    );
  }

  detail(planId: string): {
    readonly plan: PlanRecord;
    readonly version: PlanVersion;
    readonly nodeStates: readonly NodeState[];
    readonly bindings: readonly DispatchBinding[];
    readonly finalDraft: FinalDraft | null;
  } {
    const plan = this.requirePlan(planId);
    const version = this.currentVersion(plan);
    const bindings = [...this.tables.bindings.entries()]
      .map(([, binding]) => binding)
      .filter(
        (binding) =>
          binding.planId === plan.id && binding.version === plan.currentVersion,
      );
    const bindingByNode = new Map(
      bindings.map((binding) => [binding.nodeId, binding]),
    );
    const nodeByTaskId = new Map(
      bindings.map((binding) => [binding.taskId, binding.nodeId]),
    );
    const projectedGraph = planGraphSchema.parse({
      ...version.graph,
      nodes: version.graph.nodes.map((node) => {
        const binding = bindingByNode.get(node.id);
        if (binding === undefined) return node;
        let task: RootTaskLike;
        try {
          task = this.deps.tasks().get(binding.taskId);
        } catch {
          return node;
        }
        return {
          ...node,
          title: task.title,
          ...(task.description === undefined
            ? {}
            : { description: task.description }),
          priority: task.priority,
          ...(task.receiverType === undefined
            ? {}
            : { receiverType: task.receiverType }),
          ...(task.receiverId === undefined
            ? { receiverId: undefined }
            : { receiverId: task.receiverId }),
          ...(task.receiverPrincipalId === undefined
            ? {}
            : { receiverPrincipalId: task.receiverPrincipalId }),
          ...(task.receiverName === undefined
            ? { receiverName: undefined }
            : { receiverName: task.receiverName }),
          ...(task.acceptance === undefined
            ? {}
            : { acceptance: task.acceptance }),
          ...(task.due === undefined ? { due: undefined } : { due: task.due }),
          ...(task.dependsOn === undefined
            ? {}
            : {
                dependencies: task.dependsOn
                  .map((taskId) => nodeByTaskId.get(taskId))
                  .filter((nodeId): nodeId is string => nodeId !== undefined),
              }),
        };
      }),
    });
    return {
      plan,
      version: planVersionSchema.parse({
        ...version,
        graph: projectedGraph,
      }),
      nodeStates: [...this.tables.nodes.entries()]
        .map(([, state]) => state)
        .filter((state) => state.planId === plan.id),
      bindings,
      finalDraft:
        plan.finalDraftId === undefined
          ? null
          : (() => {
              const draft = this.tables.drafts.get(plan.finalDraftId);
              return draft === undefined ? null : finalDraftSchema.parse(draft);
            })(),
    };
  }

  findByRoot(workspaceId: string, rootTaskId: string): PlanRecord | undefined {
    this.requireEnabled(workspaceId);
    return [...this.tables.plans.entries()]
      .map(([, plan]) => plan)
      .filter(
        (plan) =>
          plan.workspaceId === workspaceId && plan.rootTaskId === rootTaskId,
      )
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))[0];
  }

  activePlans(): readonly PlanRecord[] {
    return [...this.tables.plans.entries()]
      .map(([, plan]) => planRecordSchema.parse(plan))
      .filter(
        (plan) =>
          ["active", "finalizing"].includes(plan.status) &&
          this.deps.enabled(plan.workspaceId),
      );
  }

  async pauseWorkspace(workspaceId: string): Promise<void> {
    const at = nowIso();
    for (const [key, plan] of this.tables.plans.entries()) {
      if (
        plan.workspaceId !== workspaceId ||
        !["active", "finalizing", "approved", "paused"].includes(plan.status)
      ) {
        continue;
      }
      await this.tables.plans.put(
        key,
        planRecordSchema.parse({
          ...plan,
          status: "resume_required",
          revision: plan.revision + 1,
          updatedAt: at,
        }),
      );
    }
  }

  async pause(actor: PlanActor, planId: string): Promise<PlanRecord> {
    const plan = this.requirePlan(planId);
    this.requireManager(plan, actor);
    if (!["active", "finalizing", "approved"].includes(plan.status)) {
      throw new RouterWorkerError("conflict", "当前计划不能暂停");
    }
    const next = planRecordSchema.parse({
      ...plan,
      status: "paused",
      revision: plan.revision + 1,
      updatedAt: nowIso(),
    });
    await this.tables.plans.put(next.id, next);
    await this.recordPlanActivity(
      actor,
      next,
      `paused:${next.revision}`,
      `暂停任务规划 v${next.currentVersion}`,
    );
    return next;
  }

  async resume(actor: PlanActor, planId: string): Promise<PlanRecord> {
    const plan = this.requirePlan(planId);
    this.requireManager(plan, actor);
    if (!["paused", "resume_required"].includes(plan.status)) {
      throw new RouterWorkerError("conflict", "当前计划不需要恢复");
    }
    const next = planRecordSchema.parse({
      ...plan,
      status: "active",
      revision: plan.revision + 1,
      updatedAt: nowIso(),
    });
    await this.tables.plans.put(next.id, next);
    await this.recordPlanActivity(
      actor,
      next,
      `resumed:${next.revision}`,
      `恢复任务规划 v${next.currentVersion}`,
    );
    return next;
  }

  async cancel(actor: PlanActor, planId: string): Promise<PlanRecord> {
    const plan = this.requirePlan(planId);
    this.requireManager(plan, actor);
    if (["completed", "cancelled"].includes(plan.status)) return plan;
    const next = planRecordSchema.parse({
      ...plan,
      status: "cancelled",
      revision: plan.revision + 1,
      updatedAt: nowIso(),
    });
    await this.tables.plans.put(next.id, next);
    await this.recordPlanActivity(
      actor,
      next,
      `cancelled:${next.revision}`,
      `取消任务规划 v${next.currentVersion}`,
    );
    for (const [key, state] of this.tables.nodes.entries()) {
      if (state.planId !== plan.id || state.status === "accepted") continue;
      await this.tables.nodes.put(
        key,
        nodeStateSchema.parse({
          ...state,
          status: "cancelled",
          updatedAt: nowIso(),
        }),
      );
    }
    return next;
  }

  validate(planId: string): readonly PlanValidationIssue[] {
    const plan = this.requirePlan(planId);
    return validatePlanGraph(this.currentVersion(plan).graph, plan.settings);
  }

  async saveVersion(
    actor: PlanActor,
    input: {
      readonly planId: string;
      readonly expectedRevision: number;
      readonly graph: unknown;
      readonly settings?: unknown;
      readonly reason?: string | undefined;
      readonly source?: "manual" | "router" | "template" | undefined;
      readonly templateInstanceId?: string | undefined;
      readonly replaceExisting?: boolean | undefined;
    },
  ): Promise<{ readonly plan: PlanRecord; readonly version: PlanVersion }> {
    const plan = this.requirePlan(input.planId);
    this.requireManager(plan, actor);
    if (plan.revision !== input.expectedRevision) {
      throw new RouterWorkerError("conflict", "计划版本已变化，请刷新后重试");
    }
    if (
      ["cancelled", "completed"].includes(plan.status) ||
      (plan.status === "active" && input.replaceExisting !== true)
    ) {
      throw new RouterWorkerError("conflict", "当前计划状态不能修改");
    }
    const graph = planGraphSchema.parse(input.graph);
    const {
      routerAgentId: _currentRouterAgentId,
      ...planSettingsWithoutRouter
    } = plan.settings;
    const settings = planSettingsSchema.parse(
      input.source === "template"
        ? (input.settings ?? planSettingsWithoutRouter)
        : (input.settings ?? plan.settings),
    );
    if (
      input.replaceExisting !== true &&
      plan.routerAgentId !== undefined &&
      settings.routerAgentId !== plan.routerAgentId
    ) {
      throw new RouterWorkerError(
        "conflict",
        "计划已固化 Router Agent，不能在编辑计划时临时切换",
      );
    }
    const source = input.source ?? plan.source;
    if (source === "router" && settings.routerAgentId === undefined) {
      throw new RouterWorkerError(
        "invalid_input",
        "Router 重新生成必须绑定 Router Agent",
      );
    }
    const errors = validatePlanGraph(graph, settings).filter(
      (issue) => issue.level === "error",
    );
    if (errors.length > 0) {
      throw new RouterWorkerError(
        "invalid_input",
        errors.map((issue) => issue.message).join("；"),
      );
    }
    const at = nowIso();
    const nextVersionNumber = plan.currentVersion + 1;
    const current = this.currentVersion(plan);
    if (current.status !== "superseded") {
      await this.tables.versions.put(
        current.id,
        planVersionSchema.parse({ ...current, status: "superseded" }),
      );
    }
    const version = planVersionSchema.parse({
      id: `${plan.id}:${nextVersionNumber}`,
      planId: plan.id,
      workspaceId: plan.workspaceId,
      version: nextVersionNumber,
      status: "proposed",
      graph,
      reason: input.reason ?? "计划调整",
      createdBy: actor.id,
      createdAt: at,
    });
    const {
      routerAgentId: _previousRouterAgentId,
      templateInstanceId: _previousTemplateInstanceId,
      ...planBase
    } = plan;
    const nextPlan = planRecordSchema.parse({
      ...planBase,
      currentVersion: nextVersionNumber,
      status: "proposed",
      source,
      ...(source === "router" && settings.routerAgentId !== undefined
        ? { routerAgentId: settings.routerAgentId }
        : {}),
      ...(source === "template" && input.templateInstanceId !== undefined
        ? { templateInstanceId: input.templateInstanceId }
        : {}),
      settings,
      revision: plan.revision + 1,
      updatedAt: at,
    });
    await this.tables.plans.put(nextPlan.id, nextPlan);
    await this.tables.versions.put(version.id, version);
    for (const node of graph.nodes) {
      const state = readyState({
        plan: nextPlan,
        nodeId: node.id,
        graph,
        version: nextVersionNumber,
        at,
      });
      await this.tables.nodes.put(state.id, state);
    }
    await this.recordPlanActivity(
      actor,
      nextPlan,
      `updated:v${version.version}`,
      `更新任务规划至 v${version.version}：共 ${graph.nodes.length} 个节点`,
    );
    return { plan: nextPlan, version };
  }

  async approve(
    actor: PlanActor,
    input: { readonly planId: string; readonly expectedRevision: number },
  ): Promise<PlanRecord> {
    const plan = this.requirePlan(input.planId);
    this.requireManager(plan, actor);
    if (plan.revision !== input.expectedRevision) {
      throw new RouterWorkerError("conflict", "计划版本已变化，请刷新后重试");
    }
    const version = this.currentVersion(plan);
    const issues = validatePlanGraph(version.graph, plan.settings).filter(
      (issue) => issue.level === "error",
    );
    if (issues.length > 0) {
      throw new RouterWorkerError(
        "invalid_input",
        issues.map((issue) => issue.message).join("；"),
      );
    }
    const permission = this.deps.permission?.();
    if (permission !== undefined) {
      for (const node of version.graph.nodes) {
        if (
          node.receiverType !== "agent" ||
          node.receiverPrincipalId === undefined
        ) {
          continue;
        }
        const decision = await permission.resolve({
          workspaceId: plan.workspaceId,
          principalId: node.receiverPrincipalId,
          requestedActions: ["read", "write"],
          requestedResources: [`router-worker/${plan.id}/${node.id}`],
        });
        if (!decision.allowed) {
          throw new RouterWorkerError(
            "forbidden",
            `节点「${node.title}」权限交集不足：${decision.reasons.join("；")}`,
          );
        }
      }
    }
    const at = nowIso();
    const approvedVersion = planVersionSchema.parse({
      ...version,
      status: "approved",
    });
    const approvedPlan = planRecordSchema.parse({
      ...plan,
      status: "approved",
      confirmedBy: actor.id,
      confirmedByName: actor.name,
      ...(actor.role === undefined ? {} : { confirmedByRole: actor.role }),
      confirmedAt: at,
      revision: plan.revision + 1,
      updatedAt: at,
    });
    await this.tables.versions.put(approvedVersion.id, approvedVersion);
    await this.tables.plans.put(approvedPlan.id, approvedPlan);
    await this.recordPlanActivity(
      actor,
      approvedPlan,
      `approved:v${version.version}`,
      `确认任务规划 v${version.version}`,
    );
    return approvedPlan;
  }

  async approveByPolicy(
    actor: PlanActor,
    input: {
      readonly planId: string;
      readonly expectedRevision: number;
      readonly policy: "risk-based" | "auto";
      readonly reason: string;
    },
  ): Promise<PlanRecord> {
    const plan = this.requirePlan(input.planId);
    if (plan.revision !== input.expectedRevision) {
      throw new RouterWorkerError("conflict", "计划版本已变化，请刷新后重试");
    }
    if (!["draft", "proposed"].includes(plan.status)) {
      throw new RouterWorkerError("conflict", "当前计划不能自动批准");
    }
    const version = this.currentVersion(plan);
    const issues = validatePlanGraph(version.graph, plan.settings).filter(
      (issue) => issue.level === "error",
    );
    if (issues.length > 0) {
      throw new RouterWorkerError(
        "invalid_input",
        issues.map((issue) => issue.message).join("；"),
      );
    }
    const permission = this.deps.permission?.();
    if (permission !== undefined) {
      for (const node of version.graph.nodes) {
        if (
          node.receiverType !== "agent" ||
          node.receiverPrincipalId === undefined
        ) {
          continue;
        }
        const decision = await permission.resolve({
          workspaceId: plan.workspaceId,
          principalId: node.receiverPrincipalId,
          requestedActions: ["read", "write"],
          requestedResources: [`router-worker/${plan.id}/${node.id}`],
        });
        if (!decision.allowed) {
          throw new RouterWorkerError(
            "forbidden",
            `节点「${node.title}」权限交集不足：${decision.reasons.join("；")}`,
          );
        }
      }
    }
    const at = nowIso();
    const approvedVersion = planVersionSchema.parse({
      ...version,
      status: "approved",
    });
    const approvedPlan = planRecordSchema.parse({
      ...plan,
      status: "approved",
      approvedByPolicy: true,
      approvalPolicy: input.policy,
      confirmedBy: actor.id,
      confirmedByName: "Planning Service",
      ...(actor.role === undefined ? {} : { confirmedByRole: actor.role }),
      confirmedAt: at,
      revision: plan.revision + 1,
      updatedAt: at,
    });
    await this.tables.versions.put(approvedVersion.id, approvedVersion);
    await this.tables.plans.put(approvedPlan.id, approvedPlan);
    await this.recordPlanActivity(
      actor,
      approvedPlan,
      `policy-approved:v${version.version}`,
      `按 ${input.policy} 策略自动批准任务规划 v${version.version}：${input.reason}`,
    );
    return approvedPlan;
  }

  private taskCreatorFor(plan: PlanRecord): PlanActor {
    return {
      id: plan.confirmedBy ?? plan.createdBy,
      name: plan.confirmedByName ?? plan.confirmedBy ?? plan.createdBy,
      kind: "human",
      role: plan.confirmedByRole ?? "member",
    };
  }

  async ensureNodeTask(
    actor: PlanActor,
    input: { readonly planId: string; readonly nodeId: string },
  ): Promise<{ readonly plan: PlanRecord; readonly taskId: string }> {
    const plan = this.requirePlan(input.planId);
    this.requireManager(plan, actor);
    if (["cancelled", "completed"].includes(plan.status)) {
      throw new RouterWorkerError("conflict", "当前计划状态不能创建子任务");
    }
    const version = this.currentVersion(plan);
    const node = version.graph.nodes.find(
      (candidate) => candidate.id === input.nodeId,
    );
    if (node === undefined) {
      throw new RouterWorkerError("not_found", "计划节点不存在");
    }
    if (node.receiverType === "unassigned" || node.receiverId === undefined) {
      throw new RouterWorkerError("conflict", "计划节点尚未指派负责人");
    }
    const dispatchKey = `router-worker:${plan.id}:v${version.version}:${node.id}:1`;
    const existing = [...this.tables.bindings.entries()]
      .map(([, binding]) => binding)
      .find((binding) => binding.dispatchKey === dispatchKey);
    if (existing !== undefined) {
      return { plan, taskId: existing.taskId };
    }
    const creation = this.deps.taskCreation();
    if (creation === undefined) {
      throw new RouterWorkerError("conflict", "任务创建服务不可用");
    }
    const taskCreator = this.taskCreatorFor(plan);
    const root = this.deps.tasks().get(plan.rootTaskId);
    const result = await creation.createFromDraft(taskCreator, {
      creationKey: dispatchKey,
      ...(root.parentTaskId === undefined
        ? { parentTaskId: plan.rootTaskId }
        : {}),
      type: node.taskType ?? "任务",
      status: node.initialStatus ?? "todo",
      autoSubmitReview: node.autoSubmitReview ?? true,
      autoApproveReview: node.autoApproveReview ?? false,
      ...(node.executionPolicy === undefined
        ? {}
        : { executionPolicy: node.executionPolicy }),
      draft: {
        workspaceId: plan.workspaceId,
        title: node.title,
        description: node.description,
        priority: node.priority,
        receiverType: node.receiverType,
        receiverId: node.receiverId,
        ...(node.receiverName === undefined
          ? {}
          : { receiverName: node.receiverName }),
        ...(node.due === undefined ? {} : { due: node.due }),
        acceptance: node.acceptance,
        projectId: plan.workspaceId,
        collaboratorHints: [],
      },
    });
    const at = nowIso();
    const binding = dispatchBindingSchema.parse({
      id: dispatchKey,
      dispatchKey,
      planId: plan.id,
      workspaceId: plan.workspaceId,
      version: version.version,
      nodeId: node.id,
      attempt: 1,
      taskId: result.taskId,
      status: "created",
      createdAt: at,
      updatedAt: at,
    });
    await this.tables.bindings.put(binding.id, binding);
    const state = this.tables.nodes.get(`${plan.id}:${node.id}`);
    if (state !== undefined) {
      await this.tables.nodes.put(
        state.id,
        nodeStateSchema.parse({
          ...state,
          taskId: result.taskId,
          updatedAt: at,
        }),
      );
    }
    return { plan, taskId: result.taskId };
  }

  async materialize(
    actor: PlanActor,
    planId: string,
  ): Promise<{
    readonly plan: PlanRecord;
    readonly createdTaskIds: readonly string[];
  }> {
    const plan = this.requirePlan(planId);
    this.requireManager(plan, actor);
    if (plan.status !== "approved" && plan.status !== "active") {
      throw new RouterWorkerError("conflict", "计划尚未确认");
    }
    const creation = this.deps.taskCreation();
    if (creation === undefined) {
      throw new RouterWorkerError("conflict", "任务创建服务不可用");
    }
    const version = this.currentVersion(plan);
    const taskCreator = this.taskCreatorFor(plan);
    const root = this.deps.tasks().get(plan.rootTaskId);
    const relationParentTaskId =
      root.parentTaskId === undefined ? plan.rootTaskId : undefined;
    const created: string[] = [];
    const bindings = [...this.tables.bindings.entries()].map(
      ([, value]) => value,
    );
    for (const node of version.graph.nodes) {
      const dispatchKey = `router-worker:${plan.id}:v${version.version}:${node.id}:1`;
      const existing = bindings.find(
        (binding) => binding.dispatchKey === dispatchKey,
      );
      const at = nowIso();
      let binding = existing;
      let taskId = existing?.taskId;
      if (binding === undefined) {
        if (
          node.receiverType === "unassigned" ||
          node.receiverId === undefined
        ) {
          continue;
        }
        const result = await creation.createFromDraft(taskCreator, {
          creationKey: dispatchKey,
          ...(relationParentTaskId === undefined
            ? {}
            : { parentTaskId: relationParentTaskId }),
          type: node.taskType ?? "任务",
          status: node.initialStatus ?? "todo",
          autoSubmitReview: node.autoSubmitReview ?? true,
          autoApproveReview: node.autoApproveReview ?? false,
          ...(node.executionPolicy === undefined
            ? {}
            : { executionPolicy: node.executionPolicy }),
          draft: {
            workspaceId: plan.workspaceId,
            title: node.title,
            description: node.description,
            priority: node.priority,
            receiverType: node.receiverType,
            receiverId: node.receiverId,
            ...(node.receiverName === undefined
              ? {}
              : { receiverName: node.receiverName }),
            ...(node.due === undefined ? {} : { due: node.due }),
            acceptance: node.acceptance,
            projectId: plan.workspaceId,
            collaboratorHints: [],
          },
        });
        taskId = result.taskId;
        binding = dispatchBindingSchema.parse({
          id: dispatchKey,
          dispatchKey,
          planId: plan.id,
          workspaceId: plan.workspaceId,
          version: version.version,
          nodeId: node.id,
          attempt: 1,
          taskId,
          status: "created",
          createdAt: at,
          updatedAt: at,
        });
        await this.tables.bindings.put(binding.id, binding);
      }
      if (taskId === undefined) continue;
      const state = this.tables.nodes.get(`${plan.id}:${node.id}`);
      let runId: string | undefined;
      let nextStatus: NodeState["status"] =
        state?.status ?? (node.dependencies.length === 0 ? "ready" : "waiting");
      const alreadyDispatched =
        binding.status === "dispatched" || state?.runId !== undefined;
      if (
        !alreadyDispatched &&
        node.dependencies.length === 0 &&
        node.receiverType === "agent"
      ) {
        const dispatcher = this.deps.taskDispatch();
        if (dispatcher !== undefined) {
          nextStatus = "dispatching";
          const outcome = await dispatcher.dispatch(
            this.deps.tasks().get(taskId),
            taskCreator,
          );
          const execution =
            typeof outcome === "object" && outcome !== null
              ? (outcome as { readonly execution?: unknown }).execution
              : undefined;
          if (
            typeof execution === "object" &&
            execution !== null &&
            typeof (execution as { readonly runId?: unknown }).runId ===
              "string"
          ) {
            runId = (execution as { readonly runId: string }).runId;
          }
          binding = dispatchBindingSchema.parse({
            ...binding,
            ...(runId === undefined ? {} : { runId }),
            status: "dispatched",
            updatedAt: nowIso(),
          });
          await this.tables.bindings.put(binding.id, binding);
        }
      }
      if (state !== undefined) {
        await this.tables.nodes.put(
          state.id,
          nodeStateSchema.parse({
            ...state,
            status: nextStatus,
            attempt: 1,
            taskId,
            ...(runId === undefined ? {} : { runId }),
            updatedAt: at,
          }),
        );
      }
      created.push(taskId);
    }
    if (root.status === "todo" || root.status === "review") {
      await this.deps.tasks().changeStatus?.(actor, {
        taskId: plan.rootTaskId,
        status: "progress",
      });
    }
    const activePlan = planRecordSchema.parse({
      ...plan,
      status: "active",
      revision: plan.revision + 1,
      updatedAt: nowIso(),
    });
    await this.tables.plans.put(activePlan.id, activePlan);
    await this.recordPlanActivity(
      actor,
      activePlan,
      `dispatched:v${version.version}`,
      `派发任务规划 v${version.version}：`,
      created.map((taskId) => {
        try {
          return {
            taskId,
            title: this.deps.tasks().get(taskId).title,
          };
        } catch {
          return { taskId, title: taskId };
        }
      }),
    );
    return { plan: activePlan, createdTaskIds: created };
  }

  async reconcile(planId: string): Promise<PlanRecord> {
    const plan = this.requirePlan(planId);
    if (
      !["active", "approved", "paused", "resume_required"].includes(plan.status)
    ) {
      return plan;
    }
    const version = this.currentVersion(plan);
    const states = [...this.tables.nodes.entries()]
      .map(([, state]) => state)
      .filter((state) => state.planId === plan.id);
    const byNode = new Map(states.map((state) => [state.nodeId, state]));
    for (const node of version.graph.nodes) {
      const state = byNode.get(node.id);
      if (state?.taskId === undefined || state.status === "accepted") continue;
      const task = this.deps.tasks().get(state.taskId);
      const next: NodeState["status"] =
        task.status === "done"
          ? "accepted"
          : task.status === "review"
            ? "review"
            : task.status === "progress"
              ? "running"
              : state.status;
      if (next !== state.status) {
        const updated = nodeStateSchema.parse({
          ...state,
          status: next,
          updatedAt: nowIso(),
        });
        await this.tables.nodes.put(updated.id, updated);
        byNode.set(node.id, updated);
      }
    }
    for (const node of version.graph.nodes) {
      const state = byNode.get(node.id);
      if (state?.status !== "waiting") continue;
      if (
        node.dependencies.every(
          (dependency) => byNode.get(dependency)?.status === "accepted",
        )
      ) {
        let updated = nodeStateSchema.parse({
          ...state,
          status: "ready",
          updatedAt: nowIso(),
        });
        if (
          node.receiverType === "agent" &&
          updated.taskId !== undefined &&
          this.deps.taskDispatch() !== undefined
        ) {
          try {
            const outcome = await this.deps
              .taskDispatch()!
              .dispatch(this.deps.tasks().get(updated.taskId), {
                id: plan.createdBy,
                name: plan.createdBy,
                kind: "human",
                role: "member",
              });
            const execution =
              typeof outcome === "object" && outcome !== null
                ? (outcome as { readonly execution?: unknown }).execution
                : undefined;
            updated = nodeStateSchema.parse({
              ...updated,
              status: "dispatching",
              ...(typeof execution === "object" &&
              execution !== null &&
              typeof (execution as { readonly runId?: unknown }).runId ===
                "string"
                ? {
                    runId: (execution as { readonly runId: string }).runId,
                  }
                : {}),
              updatedAt: nowIso(),
            });
          } catch (cause) {
            updated = nodeStateSchema.parse({
              ...updated,
              status: "blocked",
              lastError:
                cause instanceof Error ? cause.message : "节点派发失败",
              updatedAt: nowIso(),
            });
          }
        }
        await this.tables.nodes.put(updated.id, updated);
        byNode.set(node.id, updated);
      }
    }
    if (
      version.graph.nodes.every(
        (node) => byNode.get(node.id)?.status === "accepted",
      )
    ) {
      if (plan.source !== "router" && plan.routerAgentId === undefined) {
        const completed = planRecordSchema.parse({
          ...plan,
          status: "completed",
          revision: plan.revision + 1,
          updatedAt: nowIso(),
        });
        await this.tables.plans.put(completed.id, completed);
        return completed;
      }
      const finalizing = planRecordSchema.parse({
        ...plan,
        status: "finalizing",
        revision: plan.revision + 1,
        updatedAt: nowIso(),
      });
      await this.tables.plans.put(finalizing.id, finalizing);
      return finalizing;
    }
    return plan;
  }

  private requireAcceptedGraph(plan: PlanRecord): PlanVersion {
    const version = this.currentVersion(plan);
    const accepted = new Set(
      [...this.tables.nodes.entries()]
        .map(([, state]) => state)
        .filter(
          (state) => state.planId === plan.id && state.status === "accepted",
        )
        .map((state) => state.nodeId),
    );
    const missing = version.graph.nodes.filter(
      (node) => !accepted.has(node.id),
    );
    if (missing.length > 0) {
      throw new RouterWorkerError(
        "conflict",
        `仍有未完成节点：${missing.map((node) => node.title).join("、")}`,
      );
    }
    return version;
  }

  requiresFinalization(planId: string): boolean {
    const plan = this.requirePlan(planId);
    return plan.status === "finalizing" && plan.finalDraftId === undefined;
  }

  async saveFinalDraft(
    actor: PlanActor,
    input: {
      readonly planId: string;
      readonly routerAgentId: string;
      readonly draft: unknown;
    },
  ): Promise<{
    readonly plan: PlanRecord;
    readonly finalDraft: FinalDraft;
  }> {
    const plan = this.requirePlan(input.planId);
    if (plan.status !== "finalizing") {
      throw new RouterWorkerError("conflict", "当前计划不在最终汇总阶段");
    }
    if (
      plan.routerAgentId !== undefined &&
      plan.routerAgentId !== input.routerAgentId
    ) {
      throw new RouterWorkerError(
        "forbidden",
        "最终汇总必须由计划绑定的 Router 提交",
      );
    }
    if (plan.finalDraftId !== undefined) {
      const existing = this.tables.drafts.get(plan.finalDraftId);
      if (existing !== undefined) {
        return {
          plan,
          finalDraft: finalDraftSchema.parse(existing),
        };
      }
    }
    this.requireAcceptedGraph(plan);
    const parsed = finalDraftSchema
      .omit({
        id: true,
        workspaceId: true,
        planId: true,
        rootTaskId: true,
        routerAgentId: true,
        createdBy: true,
        createdAt: true,
      })
      .parse(input.draft);
    const publicText = (value: string): string =>
      value
        .replace(/\brw-plan-[0-9a-f-]+\b/gi, plan.rootTaskId)
        .replace(/\brw-cycle-[0-9a-f-]+\b/gi, "Router Cycle")
        .replace(/\brw-draft-[0-9a-f-]+\b/gi, "交付草稿");
    const at = nowIso();
    const finalDraft = finalDraftSchema.parse({
      ...parsed,
      summary: publicText(parsed.summary),
      deliverables: parsed.deliverables.map((item) => ({
        ...item,
        title: publicText(item.title),
        ...(item.reference === undefined
          ? {}
          : { reference: publicText(item.reference) }),
      })),
      risks: parsed.risks.map(publicText),
      openQuestions: parsed.openQuestions.map(publicText),
      acceptance: parsed.acceptance.map((item) => ({
        ...item,
        criterion: publicText(item.criterion),
        ...(item.evidence === undefined
          ? {}
          : { evidence: publicText(item.evidence) }),
      })),
      id: `rw-draft-${randomUUID()}`,
      workspaceId: plan.workspaceId,
      planId: plan.id,
      rootTaskId: plan.rootTaskId,
      routerAgentId: input.routerAgentId,
      createdBy: actor.id,
      createdAt: at,
    });
    await this.tables.drafts.put(finalDraft.id, finalDraft);
    const root = this.deps.tasks().get(plan.rootTaskId);
    const finalizationMode =
      root.receiverType === "agent"
        ? ("router_managed" as const)
        : ("owner_handoff" as const);
    const completed = planRecordSchema.parse({
      ...plan,
      status: "completed",
      finalizationMode,
      finalDraftId: finalDraft.id,
      revision: plan.revision + 1,
      updatedAt: at,
    });
    await this.tables.plans.put(completed.id, completed);
    const summary = [
      completed.finalizationMode === "router_managed"
        ? "Router 已生成最终交付汇总，并提交主任务人工验收。"
        : "Router 已生成交付草稿，等待主任务负责人确认处理。",
      "",
      finalDraft.summary,
      ...(finalDraft.risks.length === 0
        ? []
        : ["", "## 风险", ...finalDraft.risks.map((risk) => `- ${risk}`)]),
      ...(finalDraft.openQuestions.length === 0
        ? []
        : [
            "",
            "## 待确认",
            ...finalDraft.openQuestions.map((question) => `- ${question}`),
          ]),
    ].join("\n");
    await this.deps.tasks().addMessage?.(actor, {
      taskId: completed.rootTaskId,
      content: summary,
      mentions: [],
    });
    if (completed.finalizationMode === "router_managed") {
      await this.deps.tasks().changeStatus?.(actor, {
        taskId: completed.rootTaskId,
        status: "review",
      });
    }
    return { plan: completed, finalDraft };
  }
}
