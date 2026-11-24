import type { IncomingMessage, ServerResponse } from "node:http";
import {
  bearerToken,
  readJsonBody,
  sameOrigin,
  sendJson,
} from "@pluginmax/shared";
import { z } from "zod";
import {
  rankCandidates,
  type DispatchCandidate,
  type DispatchSkillLike,
  type DispatchTaskLike,
  type DispatchTeammateProfile,
} from "./service.js";

export const name = "dsh-collab-task-dispatch";
export const inject = ["webServer"];

interface WebRouteLike {
  readonly kind: "exact";
  readonly path: string;
  handler(
    request: IncomingMessage,
    response: ServerResponse,
  ): Promise<void> | void;
}

type UserRole = "admin" | "owner" | "member" | "guest";

interface TeamPrincipal {
  readonly userId: string;
  readonly role?: UserRole | undefined;
}

interface TeamServiceLike {
  resolveToken(token: string): TeamPrincipal | undefined;
  users(): readonly {
    readonly id: string;
    readonly name: string;
    readonly role?: UserRole | undefined;
    readonly status?: string | undefined;
  }[];
  members(workspaceId: string): readonly {
    readonly userId: string;
    readonly memberRole?: string | undefined;
  }[];
}

interface WorkspaceRegistryLike {
  list(): readonly {
    readonly id: string;
    readonly title?: string | undefined;
  }[];
}

interface TaskActorLike {
  readonly id: string;
  readonly name: string;
  readonly kind: "human";
  readonly role?: UserRole | undefined;
}

interface TaskServiceLike {
  get(taskId: string): DispatchTaskLike;
  list(workspaceId: string): readonly DispatchTaskLike[];
  assign(actor: TaskActorLike, input: unknown): Promise<DispatchTaskLike>;
  changeStatus(actor: TaskActorLike, input: unknown): Promise<DispatchTaskLike>;
}

interface TeammateViewLike {
  readonly id: string;
  readonly name: string;
  readonly role: string;
  readonly ownerName: string;
  readonly ownerUserId: string;
  readonly avatar?: string | undefined;
  readonly source?: "personal" | "platform" | undefined;
  readonly state?: string | undefined;
  readonly employeeId?: string | undefined;
  readonly systemKey?: string | undefined;
  readonly projectBinding?: { readonly workspaceId: string } | undefined;
  readonly workspaceBinding?:
    | {
        readonly workspaceId: string;
        readonly roleKey?: string | undefined;
      }
    | undefined;
  readonly skillBindings?: readonly {
    readonly skillId: string;
    readonly enabled?: boolean | undefined;
  }[];
}

interface TeammateServiceLike {
  get(teammateId: string): unknown;
  viewOf?(teammate: unknown): TeammateViewLike;
  listInstances(
    actor: {
      readonly userId: string;
      readonly name: string;
      readonly role: UserRole;
    },
    options?: {
      readonly scope?: "mine" | "all" | undefined;
      readonly visibleWorkspaceIds?: ReadonlySet<string> | undefined;
    },
  ): readonly TeammateViewLike[];
}

interface AssignableTeammateLike {
  readonly id: string;
  readonly name: string;
  readonly ownerUserId: string;
  readonly ownerName: string;
  readonly employeeId?: string | undefined;
}

interface TeammateRuntimeLike {
  assignable(
    actor: {
      readonly userId: string;
      readonly name: string;
      readonly role: UserRole;
    },
    workspaceId: string,
  ): readonly AssignableTeammateLike[];
  availabilityOf(
    teammateId: string,
    workspaceId: string,
  ): {
    readonly available: boolean;
    readonly reason?: string | undefined;
  };
}

interface AssignmentServiceLike {
  seats(workspaceId: string): readonly {
    readonly assigneeKind: "user" | "agent";
    readonly assigneeId: string;
    readonly status: "claimed" | "assigned" | "released";
    readonly seatId?: string | undefined;
    readonly seatLabel?: string | undefined;
  }[];
}

interface ResourceMarketLike {
  resolveSkills(
    principal: string | { readonly userId: string; readonly role?: UserRole },
    skillIds: readonly string[],
    options?: { readonly requireInstallation?: boolean | undefined },
  ): Promise<readonly DispatchSkillLike[]>;
}

interface DispatchContext {
  webServer: { register(route: WebRouteLike): unknown };
  inject(
    keys: readonly [
      "collabTeam",
      "collabTasks",
      "collabTeammates",
      "collabTeammateRuntime",
      "collabResourceMarket",
    ],
    callback: (
      child: DispatchContext & {
        readonly collabTeam: TeamServiceLike;
        readonly collabTasks: TaskServiceLike;
        readonly collabTeammates: TeammateServiceLike;
        readonly collabTeammateRuntime: TeammateRuntimeLike;
        readonly collabResourceMarket: ResourceMarketLike;
      },
    ) => void,
  ): { dispose(): void };
  get(key: "workspaceRegistry"): WorkspaceRegistryLike | undefined;
  get(key: "collabAssignment"): AssignmentServiceLike | undefined;
}

class DispatchError extends Error {
  constructor(
    readonly code:
      | "invalid_input"
      | "unauthorized"
      | "forbidden"
      | "not_found"
      | "conflict"
      | "unavailable",
    message: string,
  ) {
    super(message);
    this.name = "DispatchError";
  }
}

const candidatesSchema = z.object({
  workspaceId: z.string().trim().min(1).max(200),
  taskId: z.string().trim().min(1).max(160),
});

const assigneesSchema = z.object({
  workspaceId: z.string().trim().min(1).max(200),
});

const queueAssignSchema = z.object({
  workspaceId: z.string().trim().min(1).max(200),
  taskId: z.string().trim().min(1).max(160),
  receiverType: z.enum(["unassigned", "human", "agent"]),
  receiverId: z.string().trim().max(240).optional(),
  receiverName: z.string().trim().max(200).optional(),
});

const commitSchema = z.object({
  workspaceId: z.string().trim().min(1).max(200),
  items: z
    .array(
      z.object({
        taskId: z.string().trim().min(1).max(160),
        teammateId: z.string().trim().min(1).max(160),
      }),
    )
    .min(1)
    .max(50),
});

const validateSchema = commitSchema;

function method(request: IncomingMessage, expected: string): void {
  if (request.method !== expected) {
    throw new DispatchError("invalid_input", "method not allowed");
  }
}

function assertSameOrigin(request: IncomingMessage): void {
  if (
    request.headers.origin !== undefined &&
    !sameOrigin(request.headers.origin, request.headers.host)
  ) {
    throw new DispatchError("forbidden", "same-origin request is required");
  }
}

function tokenFor(request: IncomingMessage): string {
  const token = bearerToken({
    get(name) {
      const value = request.headers[name.toLowerCase()];
      return Array.isArray(value) ? (value[0] ?? null) : (value ?? null);
    },
  });
  if (token === undefined || token === "") {
    throw new DispatchError("unauthorized", "bearer token is required");
  }
  return token;
}

function actorFor(
  request: IncomingMessage,
  team: TeamServiceLike,
): {
  readonly actor: TaskActorLike;
  readonly teammateActor: {
    readonly userId: string;
    readonly name: string;
    readonly role: UserRole;
  };
} {
  const principal = team.resolveToken(tokenFor(request));
  if (principal === undefined) {
    throw new DispatchError("unauthorized", "invalid token");
  }
  const user = team
    .users()
    .find((candidate) => candidate.id === principal.userId);
  const role = principal.role ?? user?.role ?? "member";
  const name = user?.name ?? principal.userId;
  return {
    actor: { id: principal.userId, name, kind: "human", role },
    teammateActor: { userId: principal.userId, name, role },
  };
}

function assertWorkspaceAccess(
  team: TeamServiceLike,
  actor: TaskActorLike,
  workspaceId: string,
): void {
  if (actor.role === "admin") return;
  if (!team.members(workspaceId).some((member) => member.userId === actor.id)) {
    throw new DispatchError("forbidden", "没有权限访问该项目");
  }
}

function assertDispatchAdmin(actor: TaskActorLike): void {
  if (actor.role !== "admin") {
    throw new DispatchError("forbidden", "任务调度当前仅对平台管理员开放");
  }
}

function routeError(response: ServerResponse, cause: unknown): void {
  if (cause instanceof z.ZodError) {
    sendJson(response, 400, {
      ok: false,
      error: { code: "invalid_input", message: "请求参数不完整或格式错误" },
    });
    return;
  }
  if (cause instanceof DispatchError) {
    const status =
      cause.code === "invalid_input"
        ? 400
        : cause.code === "unauthorized"
          ? 401
          : cause.code === "forbidden"
            ? 403
            : cause.code === "not_found"
              ? 404
              : cause.code === "conflict"
                ? 409
                : 503;
    sendJson(response, status, {
      ok: false,
      error: { code: cause.code, message: cause.message },
    });
    return;
  }
  sendJson(response, 500, {
    ok: false,
    error: {
      code: "internal_error",
      message: cause instanceof Error ? cause.message : "任务调度失败",
    },
  });
}

function taskSummary(task: DispatchTaskLike): DispatchTaskLike {
  return {
    id: task.id,
    workspaceId: task.workspaceId,
    title: task.title,
    ...(task.type === undefined ? {} : { type: task.type }),
    ...(task.description === undefined
      ? {}
      : { description: task.description }),
    ...(task.acceptance === undefined ? {} : { acceptance: task.acceptance }),
    status: task.status,
    priority: task.priority,
    receiverType: task.receiverType,
    ...(task.receiverId === undefined ? {} : { receiverId: task.receiverId }),
    ...(task.queueState === undefined ? {} : { queueState: task.queueState }),
    ...(task.workflow === undefined ? {} : { workflow: task.workflow }),
    ...(task.executionPolicy === undefined
      ? {}
      : { executionPolicy: task.executionPolicy }),
    ...(task.updatedAt === undefined ? {} : { updatedAt: task.updatedAt }),
  };
}

function teammateTasks(
  tasks: readonly DispatchTaskLike[],
  teammateId: string,
  employeeId?: string,
): readonly DispatchTaskLike[] {
  return tasks.filter(
    (task) =>
      task.receiverType === "agent" &&
      (task.receiverId === teammateId ||
        (employeeId !== undefined && task.receiverId === employeeId)),
  );
}

function queueSignals(
  tasks: readonly DispatchTaskLike[],
  teammateId: string,
  employeeId?: string,
): DispatchTeammateProfile["queue"] {
  return queueForTasks(teammateTasks(tasks, teammateId, employeeId));
}

function queueForTasks(
  owned: readonly DispatchTaskLike[],
): DispatchTeammateProfile["queue"] {
  const active = owned.filter((task) => task.archivedAt === undefined);
  return {
    planned: active.filter((task) => task.status === "todo").length,
    running: active.filter(
      (task) => task.status === "progress" || task.status === "abnormal",
    ).length,
    review: active.filter((task) => task.status === "review").length,
    blocked: active.filter(
      (task) => task.queueState === "blocked" || task.queueState === "paused",
    ).length,
    needsInput: active.filter((task) => task.needsInput).length,
  };
}

function successRate(
  tasks: readonly DispatchTaskLike[],
  teammateId: string,
  employeeId?: string,
): number | undefined {
  return successRateForTasks(teammateTasks(tasks, teammateId, employeeId));
}

function successRateForTasks(
  tasks: readonly DispatchTaskLike[],
): number | undefined {
  const owned = tasks.filter(
    (task) => task.status === "done" || task.status === "cancelled",
  );
  if (owned.length === 0) return undefined;
  return Math.round(
    (owned.filter((task) => task.status === "done").length / owned.length) *
      100,
  );
}

function isTaskServiceAgent(view: TeammateViewLike): boolean {
  const name = String(view.name ?? "")
    .replace(/\s+/g, "")
    .toLocaleLowerCase("zh-Hans-CN");
  const role = String(view.role ?? "")
    .replace(/\s+/g, "")
    .toLocaleLowerCase("zh-Hans-CN");
  return (
    view.systemKey === "meeting-facilitator" ||
    view.systemKey === "task-planner" ||
    view.workspaceBinding?.roleKey === "task-planner" ||
    role.includes("会议facilitator") ||
    role.includes("meetingfacilitator") ||
    role.includes("任务规划") ||
    role.includes("taskplanner") ||
    role.includes("taskrouter") ||
    name.includes("会议facilitator") ||
    name.includes("meetingfacilitator") ||
    name.includes("任务规划伙伴") ||
    name.includes("任务规划") ||
    name.includes("taskplanner") ||
    name.includes("taskrouter")
  );
}

async function buildProfiles(input: {
  readonly team: TeamServiceLike;
  readonly taskService: TaskServiceLike;
  readonly teammateService: TeammateServiceLike;
  readonly teammateRuntime: TeammateRuntimeLike;
  readonly resourceMarket: ResourceMarketLike;
  readonly assignmentService: AssignmentServiceLike | undefined;
  readonly workspaceId: string;
  readonly teammateActor: {
    readonly userId: string;
    readonly name: string;
    readonly role: UserRole;
  };
}): Promise<readonly DispatchTeammateProfile[]> {
  const workspaceTasks = input.taskService.list(input.workspaceId);
  const activeAssignments = (
    input.assignmentService?.seats(input.workspaceId) ?? []
  ).filter((assignment) => assignment.status !== "released");
  const assignedAgentIds = new Set(
    activeAssignments
      .filter((assignment) => assignment.assigneeKind === "agent")
      .map((assignment) => assignment.assigneeId),
  );
  const users = new Map(input.team.users().map((user) => [user.id, user]));
  const memberRoleLabels: Record<string, string> = {
    owner: "项目负责人",
    member: "项目成员",
    guest: "项目访客",
  };
  const humanProfiles = input.team
    .members(input.workspaceId)
    .filter((member) => member.memberRole !== "guest")
    .flatMap((member) => {
      const user = users.get(member.userId);
      if (user === undefined || user.status === "disabled") return [];
      const userAssignments = activeAssignments.filter(
        (assignment) =>
          assignment.assigneeKind === "user" &&
          assignment.assigneeId === member.userId,
      );
      const roleLabels = [
        ...new Set(
          userAssignments
            .map((assignment) => assignment.seatLabel?.trim() ?? "")
            .filter(Boolean),
        ),
      ];
      const seatIds = new Set(
        userAssignments
          .map((assignment) => assignment.seatId)
          .filter((seatId): seatId is string => seatId !== undefined),
      );
      const ownedTasks = workspaceTasks.filter(
        (task) =>
          (task.receiverType === "human" &&
            task.receiverId === member.userId) ||
          (task.receiverType === "role" &&
            task.receiverId !== undefined &&
            seatIds.has(task.receiverId)),
      );
      const role = [
        memberRoleLabels[member.memberRole ?? "member"] ?? "项目成员",
        ...roleLabels,
      ].join(" / ");
      const roleGroup =
        roleLabels[0] ??
        memberRoleLabels[member.memberRole ?? "member"] ??
        "未分组角色";
      return [
        {
          id: user.id,
          kind: "human" as const,
          name: user.name,
          role,
          roleGroup,
          ownerName: user.name,
          ownerUserId: user.id,
          roleSeatIds: [...seatIds],
          projectBound: true,
          available: true,
          skills: [
            ...roleLabels.map((label, index) => ({
              id: `human-role:${user.id}:${index}`,
              name: label,
            })),
            {
              id: `human-name:${user.id}`,
              name: user.name,
            },
          ],
          queue: queueForTasks(ownedTasks),
          successRate: successRateForTasks(ownedTasks),
          experienceCount: ownedTasks.filter((task) => task.status === "done")
            .length,
        } satisfies DispatchTeammateProfile,
      ];
    });
  const assignable = input.teammateRuntime.assignable(
    input.teammateActor,
    input.workspaceId,
  );
  const assignableIds = new Set(assignable.map((teammate) => teammate.id));
  const views = input.teammateService.listInstances(input.teammateActor, {
    scope: "all",
    visibleWorkspaceIds: new Set([input.workspaceId]),
  });

  const profiles = await Promise.all(
    views
      .filter(
        (view) =>
          view.state !== "archived" &&
          !isTaskServiceAgent(view) &&
          (assignableIds.has(view.id) ||
            assignedAgentIds.has(view.id) ||
            (view.employeeId !== undefined &&
              assignedAgentIds.has(view.employeeId))),
      )
      .map(async (view) => {
        const teammate = input.teammateService.get(view.id);
        const resolvedView = input.teammateService.viewOf?.(teammate) ?? view;
        const bindings = (resolvedView.skillBindings ?? [])
          .filter((binding) => binding.enabled !== false)
          .map((binding) => binding.skillId);
        let skills: readonly DispatchSkillLike[] = [];
        if (bindings.length > 0) {
          try {
            skills = await input.resourceMarket.resolveSkills(
              {
                userId: resolvedView.ownerUserId,
                role: input.teammateActor.role,
              },
              bindings,
              { requireInstallation: false },
            );
          } catch {
            skills = [];
          }
        }
        const availability = input.teammateRuntime.availabilityOf(
          resolvedView.id,
          input.workspaceId,
        );
        const projectBound =
          resolvedView.projectBinding?.workspaceId === input.workspaceId ||
          resolvedView.workspaceBinding?.workspaceId === input.workspaceId ||
          assignedAgentIds.has(resolvedView.id) ||
          (resolvedView.employeeId !== undefined &&
            assignedAgentIds.has(resolvedView.employeeId));
        const agentAssignments = activeAssignments.filter(
          (assignment) =>
            assignment.assigneeKind === "agent" &&
            (assignment.assigneeId === resolvedView.id ||
              (resolvedView.employeeId !== undefined &&
                assignment.assigneeId === resolvedView.employeeId)),
        );
        const roleGroup =
          agentAssignments
            .map((assignment) => assignment.seatLabel?.trim() ?? "")
            .find(Boolean) ??
          resolvedView.role.split("/")[0]?.trim() ??
          "未分组角色";
        return {
          id: resolvedView.id,
          kind: "agent",
          name: resolvedView.name,
          role: resolvedView.role,
          roleGroup,
          ownerName: resolvedView.ownerName,
          ownerUserId: resolvedView.ownerUserId,
          ...(resolvedView.avatar === undefined || resolvedView.avatar === ""
            ? {}
            : { avatar: resolvedView.avatar }),
          ...(resolvedView.source === undefined
            ? {}
            : { source: resolvedView.source }),
          ...(resolvedView.employeeId === undefined
            ? {}
            : { employeeId: resolvedView.employeeId }),
          projectBound,
          available: availability.available,
          ...(availability.reason === undefined
            ? {}
            : { availabilityReason: availability.reason }),
          skills,
          queue: queueSignals(
            workspaceTasks,
            resolvedView.id,
            resolvedView.employeeId,
          ),
          successRate: successRate(
            workspaceTasks,
            resolvedView.id,
            resolvedView.employeeId,
          ),
          experienceCount: teammateTasks(
            workspaceTasks,
            resolvedView.id,
            resolvedView.employeeId,
          ).filter((task) => task.status === "done").length,
        } satisfies DispatchTeammateProfile;
      }),
  );
  return [...humanProfiles, ...profiles];
}

async function candidatesForTask(input: {
  readonly team: TeamServiceLike;
  readonly task: DispatchTaskLike;
  readonly taskService: TaskServiceLike;
  readonly teammateService: TeammateServiceLike;
  readonly teammateRuntime: TeammateRuntimeLike;
  readonly resourceMarket: ResourceMarketLike;
  readonly assignmentService: AssignmentServiceLike | undefined;
  readonly teammateActor: {
    readonly userId: string;
    readonly name: string;
    readonly role: UserRole;
  };
}): Promise<readonly DispatchCandidate[]> {
  const profiles = await buildProfiles({
    team: input.team,
    taskService: input.taskService,
    teammateService: input.teammateService,
    teammateRuntime: input.teammateRuntime,
    resourceMarket: input.resourceMarket,
    assignmentService: input.assignmentService,
    workspaceId: input.task.workspaceId,
    teammateActor: input.teammateActor,
  });
  return rankVisibleCandidates(input.task, profiles);
}

function rankVisibleCandidates(
  task: DispatchTaskLike,
  profiles: readonly DispatchTeammateProfile[],
): readonly DispatchCandidate[] {
  return rankCandidates(task, profiles).filter(hasProjectWork);
}

function hasProjectWork(candidate: DispatchCandidate): boolean {
  return (
    candidate.signals.projectBound ||
    candidate.signals.planned +
      candidate.signals.running +
      candidate.signals.review +
      candidate.signals.blocked >
      0
  );
}

function assigneeCandidate(
  profile: DispatchTeammateProfile,
): DispatchCandidate {
  return {
    teammateId: profile.id,
    kind: profile.kind,
    name: profile.name,
    role: profile.role,
    ...(profile.roleGroup === undefined
      ? {}
      : { roleGroup: profile.roleGroup }),
    ownerName: profile.ownerName,
    ...(profile.employeeId === undefined
      ? {}
      : { employeeId: profile.employeeId }),
    ...(profile.avatar === undefined ? {} : { avatar: profile.avatar }),
    ...(profile.source === undefined ? {} : { source: profile.source }),
    ...(profile.roleSeatIds === undefined
      ? {}
      : { roleSeatIds: profile.roleSeatIds }),
    score: 0,
    status: profile.available ? "ready" : "blocker",
    blockers: profile.available
      ? []
      : [profile.availabilityReason ?? "成员当前不可执行"],
    risks: [],
    matchedSkills: [],
    signals: {
      projectBound: profile.projectBound,
      available: profile.available,
      skillEvidence:
        profile.kind === "human" ? "not_applicable" : "insufficient",
      planned: profile.queue.planned,
      running: profile.queue.running,
      review: profile.queue.review,
      blocked: profile.queue.blocked,
      needsInput: profile.queue.needsInput,
      ...(profile.successRate === undefined
        ? {}
        : { successRate: profile.successRate }),
      ...(profile.experienceCount === undefined
        ? {}
        : { experienceCount: profile.experienceCount }),
    },
  };
}

function visibleAssignees(
  profiles: readonly DispatchTeammateProfile[],
): readonly DispatchCandidate[] {
  return profiles
    .map(assigneeCandidate)
    .filter(hasProjectWork)
    .sort((left, right) => {
      const leftGroup =
        left.roleGroup?.trim() ||
        left.role.split("/")[0]?.trim() ||
        "未分组角色";
      const rightGroup =
        right.roleGroup?.trim() ||
        right.role.split("/")[0]?.trim() ||
        "未分组角色";
      return (
        leftGroup.localeCompare(rightGroup, "zh-Hans-CN") ||
        (left.kind === right.kind ? 0 : left.kind === "human" ? -1 : 1) ||
        left.name.localeCompare(right.name, "zh-Hans-CN")
      );
    });
}

function registerRoutes(
  context: DispatchContext & {
    readonly collabTeam: TeamServiceLike;
    readonly collabTasks: TaskServiceLike;
    readonly collabTeammates: TeammateServiceLike;
    readonly collabTeammateRuntime: TeammateRuntimeLike;
    readonly collabResourceMarket: ResourceMarketLike;
  },
): void {
  const assignments = context.get("collabAssignment");
  const registry = context.get("workspaceRegistry");
  const route = (path: string, handler: WebRouteLike["handler"]): void => {
    context.webServer.register({ kind: "exact", path, handler });
  };

  route(
    "/api/collab/tasks/dispatch/capabilities",
    async (request, response) => {
      try {
        method(request, "GET");
        const { actor } = actorFor(request, context.collabTeam);
        assertDispatchAdmin(actor);
        sendJson(response, 200, {
          ok: true,
          capacityModel: "queue-depth",
          visibleTo: "admin",
          workspaces: registry?.list() ?? [],
        });
      } catch (cause) {
        routeError(response, cause);
      }
    },
  );

  route("/api/collab/tasks/dispatch/assignees", async (request, response) => {
    try {
      method(request, "POST");
      assertSameOrigin(request);
      const { actor, teammateActor } = actorFor(request, context.collabTeam);
      assertDispatchAdmin(actor);
      const body = assigneesSchema.parse(await readJsonBody(request));
      assertWorkspaceAccess(context.collabTeam, actor, body.workspaceId);
      const profiles = await buildProfiles({
        team: context.collabTeam,
        taskService: context.collabTasks,
        teammateService: context.collabTeammates,
        teammateRuntime: context.collabTeammateRuntime,
        resourceMarket: context.collabResourceMarket,
        assignmentService: assignments,
        workspaceId: body.workspaceId,
        teammateActor,
      });
      const assignees = visibleAssignees(profiles);
      sendJson(response, 200, { ok: true, assignees });
    } catch (cause) {
      routeError(response, cause);
    }
  });

  route("/api/collab/tasks/dispatch/candidates", async (request, response) => {
    try {
      method(request, "POST");
      assertSameOrigin(request);
      const { actor, teammateActor } = actorFor(request, context.collabTeam);
      assertDispatchAdmin(actor);
      const body = candidatesSchema.parse(await readJsonBody(request));
      assertWorkspaceAccess(context.collabTeam, actor, body.workspaceId);
      const task = context.collabTasks.get(body.taskId);
      if (task.workspaceId !== body.workspaceId) {
        throw new DispatchError("not_found", "任务不属于当前项目");
      }
      const profiles = await buildProfiles({
        team: context.collabTeam,
        taskService: context.collabTasks,
        teammateService: context.collabTeammates,
        teammateRuntime: context.collabTeammateRuntime,
        resourceMarket: context.collabResourceMarket,
        assignmentService: assignments,
        workspaceId: task.workspaceId,
        teammateActor,
      });
      const candidates = rankVisibleCandidates(task, profiles);
      const assignees = visibleAssignees(profiles);
      sendJson(response, 200, {
        ok: true,
        task: taskSummary(task),
        candidates,
        assignees,
      });
    } catch (cause) {
      routeError(response, cause);
    }
  });

  route("/api/collab/tasks/dispatch/reassign", async (request, response) => {
    try {
      method(request, "POST");
      assertSameOrigin(request);
      const { actor, teammateActor } = actorFor(request, context.collabTeam);
      assertDispatchAdmin(actor);
      const body = queueAssignSchema.parse(await readJsonBody(request));
      assertWorkspaceAccess(context.collabTeam, actor, body.workspaceId);
      const task = context.collabTasks.get(body.taskId);
      if (task.workspaceId !== body.workspaceId) {
        throw new DispatchError("not_found", "任务不属于当前项目");
      }
      if (body.receiverType !== "unassigned" && body.receiverId === undefined) {
        throw new DispatchError("invalid_input", "请选择承接成员");
      }
      if (body.receiverType !== "unassigned") {
        const profiles = await buildProfiles({
          team: context.collabTeam,
          taskService: context.collabTasks,
          teammateService: context.collabTeammates,
          teammateRuntime: context.collabTeammateRuntime,
          resourceMarket: context.collabResourceMarket,
          assignmentService: assignments,
          workspaceId: body.workspaceId,
          teammateActor,
        });
        const profile = profiles.find(
          (entry) =>
            entry.id === body.receiverId && entry.kind === body.receiverType,
        );
        if (profile === undefined) {
          throw new DispatchError("not_found", "承接成员不可用于当前项目");
        }
        if (!profile.available) {
          throw new DispatchError(
            "conflict",
            profile.availabilityReason ?? "承接成员当前不可执行",
          );
        }
      }
      let updated = await context.collabTasks.assign(actor, {
        taskId: body.taskId,
        receiverType: body.receiverType,
        ...(body.receiverId === undefined
          ? {}
          : { receiverId: body.receiverId }),
        ...(body.receiverName === undefined
          ? {}
          : { receiverName: body.receiverName }),
      });
      if (updated.workflow === undefined && updated.status !== "todo") {
        updated = await context.collabTasks.changeStatus(actor, {
          taskId: body.taskId,
          status: "todo",
        });
      }
      sendJson(response, 200, { ok: true, task: updated });
    } catch (cause) {
      routeError(response, cause);
    }
  });

  route("/api/collab/tasks/dispatch/commit", async (request, response) => {
    try {
      method(request, "POST");
      assertSameOrigin(request);
      const { actor, teammateActor } = actorFor(request, context.collabTeam);
      assertDispatchAdmin(actor);
      const body = commitSchema.parse(await readJsonBody(request));
      assertWorkspaceAccess(context.collabTeam, actor, body.workspaceId);
      const profiles = await buildProfiles({
        team: context.collabTeam,
        taskService: context.collabTasks,
        teammateService: context.collabTeammates,
        teammateRuntime: context.collabTeammateRuntime,
        resourceMarket: context.collabResourceMarket,
        assignmentService: assignments,
        workspaceId: body.workspaceId,
        teammateActor,
      });
      const profileById = new Map(
        profiles.map((profile) => [profile.id, profile]),
      );
      const validated = body.items.map((item) => {
        const task = context.collabTasks.get(item.taskId);
        if (task.workspaceId !== body.workspaceId) {
          throw new DispatchError(
            "not_found",
            `任务 ${item.taskId} 不属于当前项目`,
          );
        }
        const profile = profileById.get(item.teammateId);
        if (profile === undefined) {
          throw new DispatchError(
            "not_found",
            `承接成员 ${item.teammateId} 不可用于当前项目`,
          );
        }
        const candidate = rankCandidates(task, [profile])[0];
        if (candidate === undefined || candidate.status === "blocker") {
          throw new DispatchError(
            "conflict",
            candidate?.blockers.join("；") || "派发方案未通过校验",
          );
        }
        return { task, profile, candidate };
      });

      const results: Array<{
        taskId: string;
        teammateId: string;
        ok: boolean;
        task?: DispatchTaskLike;
        error?: string;
      }> = [];
      for (const item of validated) {
        try {
          const task = await context.collabTasks.assign(actor, {
            taskId: item.task.id,
            receiverType: item.profile.kind,
            receiverId: item.profile.id,
            receiverName: item.profile.name,
          });
          results.push({
            taskId: item.task.id,
            teammateId: item.profile.id,
            ok: true,
            task,
          });
        } catch (cause) {
          results.push({
            taskId: item.task.id,
            teammateId: item.profile.id,
            ok: false,
            error: cause instanceof Error ? cause.message : "入队失败",
          });
        }
      }
      sendJson(response, 200, {
        ok: true,
        queued: results.filter((result) => result.ok).length,
        failed: results.filter((result) => !result.ok).length,
        results,
      });
    } catch (cause) {
      routeError(response, cause);
    }
  });

  route("/api/collab/tasks/dispatch/validate", async (request, response) => {
    try {
      method(request, "POST");
      assertSameOrigin(request);
      const { actor, teammateActor } = actorFor(request, context.collabTeam);
      assertDispatchAdmin(actor);
      const body = validateSchema.parse(await readJsonBody(request));
      assertWorkspaceAccess(context.collabTeam, actor, body.workspaceId);
      const profiles = await buildProfiles({
        team: context.collabTeam,
        taskService: context.collabTasks,
        teammateService: context.collabTeammates,
        teammateRuntime: context.collabTeammateRuntime,
        resourceMarket: context.collabResourceMarket,
        assignmentService: assignments,
        workspaceId: body.workspaceId,
        teammateActor,
      });
      const items = await Promise.all(
        body.items.map(async (item) => {
          const task = context.collabTasks.get(item.taskId);
          if (task.workspaceId !== body.workspaceId) {
            throw new DispatchError(
              "not_found",
              `任务 ${item.taskId} 不属于当前项目`,
            );
          }
          const candidates = rankVisibleCandidates(task, profiles);
          const profile = profiles.find(
            (entry) => entry.id === item.teammateId,
          );
          const candidate =
            candidates.find((entry) => entry.teammateId === item.teammateId) ??
            (profile === undefined
              ? undefined
              : rankCandidates(task, [profile])[0]);
          if (candidate === undefined) {
            throw new DispatchError(
              "not_found",
              `承接成员 ${item.teammateId} 不可用于当前项目`,
            );
          }
          return {
            task: taskSummary(task),
            teammateId: item.teammateId,
            candidate,
            alternatives: candidates
              .filter(
                (entry) =>
                  entry.teammateId !== item.teammateId &&
                  entry.status === "ready",
              )
              .slice(0, 3),
          };
        }),
      );
      const blockers = items.filter(
        (item) => item.candidate.status === "blocker",
      ).length;
      const risks = items.filter(
        (item) => item.candidate.status === "risk",
      ).length;
      sendJson(response, 200, {
        ok: true,
        summary: {
          total: items.length,
          blockers,
          risks,
          ready: items.length - blockers - risks,
        },
        items,
      });
    } catch (cause) {
      routeError(response, cause);
    }
  });
}

export function apply(context: DispatchContext): void {
  context.inject(
    [
      "collabTeam",
      "collabTasks",
      "collabTeammates",
      "collabTeammateRuntime",
      "collabResourceMarket",
    ],
    (child) => registerRoutes(child),
  );
}
