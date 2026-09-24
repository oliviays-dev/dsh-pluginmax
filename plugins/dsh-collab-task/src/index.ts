import { execFile } from "node:child_process";
import { createReadStream } from "node:fs";
import { mkdir, stat, writeFile } from "node:fs/promises";
import { basename, dirname, join } from "node:path";
import { pipeline } from "node:stream/promises";
import type { IncomingMessage, ServerResponse } from "node:http";
import { z } from "zod";
import {
  bearerToken,
  readJsonBody,
  resolveWithin,
  sameOrigin,
  sendJson,
} from "@pluginmax/shared";
import {
  TaskError,
  TaskService,
  taskDomainSpec,
  type KvTableLike,
  type TaskActor,
  type TaskAgentRun,
} from "./service.js";
import type { TaskRecord } from "./types.js";
import {
  attachmentDocuments,
  collectDocuments,
  mergeDocuments,
  mimeTypeFor,
  safeFileName,
  toRelativePath,
  uploadDirectory,
  windowsFromRuns,
  type TaskDocumentEntry,
} from "./documents.js";

export { TaskError, TaskService, taskDomainSpec };
export type { TaskActor, TaskRecord };

export const name = "dsh-collab-task";
export const inject = ["storageDomain", "webServer"];

interface WebRouteLike {
  readonly kind: "exact";
  readonly path: string;
  handler(
    request: IncomingMessage,
    response: ServerResponse,
  ): Promise<void> | void;
}

interface WorkspaceUserLike {
  readonly id: string;
  readonly name: string;
  readonly role: string;
}

interface WorkspaceMemberLike {
  readonly userId: string;
  readonly memberRole?: string;
}

interface TeamPrincipalLike {
  readonly userId: string;
  readonly role: "admin" | "owner" | "member" | "guest";
}

interface TeamServiceLike {
  resolveToken(token: string): TeamPrincipalLike | undefined;
  users(): readonly WorkspaceUserLike[];
  members(workspaceId: string): readonly WorkspaceMemberLike[];
}

interface WorkspaceLike {
  readonly id: string;
  readonly path: string;
}

interface WorkspaceRegistryLike {
  get(workspaceId: string): WorkspaceLike | undefined;
  list(): readonly WorkspaceLike[];
}

interface TeammateRuntimeActorLike {
  readonly userId: string;
  readonly name: string;
  readonly role: "admin" | "owner" | "member" | "guest";
}

interface TeammateRuntimeLike {
  assignable(
    actor: TeammateRuntimeActorLike,
  ): readonly {
    readonly id: string;
    readonly name: string;
    readonly ownerName: string;
    readonly source: "platform" | "personal";
    readonly avatar: string;
  }[];
  ensureRuntime(input: {
    readonly teammateId: string;
    readonly workspaceId: string;
    readonly actor: TeammateRuntimeActorLike;
  }): Promise<{
    readonly teammateId: string;
    readonly employeeId: string;
    readonly profileId: string;
    readonly personaId?: string | undefined;
  }>;
}

interface EmployeeLike {
  readonly id: string;
  readonly displayName: string;
  readonly kind: "human" | "digital";
  readonly status: string;
  readonly authUserId?: string | undefined;
  readonly personaId?: string | undefined;
  readonly managerEmployeeId?: string | undefined;
}

interface EmployeeServiceLike {
  list(): readonly EmployeeLike[];
  employeeWorkspaceTarget(
    employeeId: string,
    workspaceId: string,
  ):
    | {
        readonly employee: EmployeeLike;
        readonly assignment: unknown;
      }
    | undefined;
  workflowTarget(
    employeeId: string,
    workspaceId: string,
  ):
    | {
        readonly employee: EmployeeLike;
        readonly profile: {
          readonly name: string;
          readonly legacyAgentProfileId?: string | undefined;
          readonly budget?: { readonly maxMinutes?: number | undefined } | undefined;
        };
      }
    | undefined;
}

interface TaskAgentServiceLike {
  run?(runId: string):
    | {
        readonly payload?: {
          readonly context?: Record<string, string | number | boolean>;
        };
      }
    | undefined;
  dispatch(input: {
    readonly workspaceId: string;
    readonly workspacePath?: string | undefined;
    readonly profileId: string;
    readonly source: "task";
    readonly instanceId: string;
    readonly nodeId: string;
    readonly dispatchKey: string;
    readonly trigger: "manual-dispatch" | "auto-on-ready";
    readonly attempt: number;
    readonly runSeq: number;
    readonly maxAttempts: number;
    readonly timeoutMs: number;
    readonly personaId?: string | undefined;
    readonly employeeId?: string | undefined;
    readonly principalType?: "transitional-agent" | "digital-employee" | undefined;
    readonly payload: {
      readonly instanceTitle: string;
      readonly nodeName: string;
      readonly nodeDescription: string;
      readonly profileName: string;
      readonly responsibleId?: string | undefined;
      readonly deliverables: readonly {
        readonly key: string;
        readonly title: string;
        readonly type: "file" | "text" | "link";
        readonly required: boolean;
        readonly description: string;
        readonly minTextLength?: number | undefined;
      }[];
      readonly context: Record<string, string | number | boolean>;
    };
    readonly createdBy: string;
  }): Promise<TaskAgentRun>;
  bindTask(handler: {
    onSettled(run: TaskAgentRun): Promise<void> | void;
  }): void;
  runs?(filter: {
    readonly workspaceId?: string | undefined;
    readonly instanceId?: string | undefined;
  }): readonly TaskAgentRunSummary[];
}

interface TaskAgentRunSummary {
  readonly id: string;
  readonly status: string;
  readonly createdAt?: string | undefined;
  readonly startedAt?: string | undefined;
  readonly endedAt?: string | undefined;
  readonly payload?: { readonly profileName?: string | undefined } | undefined;
}

interface AssignmentSeatLike {
  readonly id: string;
  readonly label: string;
  readonly participantKind?: string | undefined;
  readonly personaId?: string | undefined;
}

interface AssignmentServiceLike {
  config(workspaceId: string): {
    readonly seats: readonly AssignmentSeatLike[];
  };
  seats?(workspaceId: string): readonly {
    readonly seatId: string;
    readonly assigneeKind: "user" | "agent";
    readonly assigneeId: string;
    readonly status: "claimed" | "assigned" | "released";
  }[];
}

interface TaskContext {
  storageDomain: {
    open(spec: typeof taskDomainSpec): Promise<{
      table(name: "tasks"): KvTableLike<TaskRecord>;
      close(): Promise<void>;
    }>;
  };
  effect(register: () => () => void): void;
  provide(key: "collabTasks", value: TaskService): unknown;
  webServer: { register(route: WebRouteLike): unknown };
  get(key: string): unknown;
  inject(
    keys: readonly ["collabTeam"],
    callback: (
      child: TaskContext & { readonly collabTeam: TeamServiceLike },
    ) => void,
  ): { dispose(): void };
  inject(
    keys: readonly ["collabAgent"],
    callback: (
      child: TaskContext & {
        readonly collabAgent: TaskAgentServiceLike;
      },
    ) => void,
  ): { dispose(): void };
}

const taskQuerySchema = z.object({
  taskId: z.string().min(1).max(160),
});

function principal(request: IncomingMessage, team: TeamServiceLike): TeamPrincipalLike {
  const token = bearerToken({
    get(name) {
      const value = request.headers[name.toLowerCase()];
      return Array.isArray(value) ? value[0] ?? null : value ?? null;
    },
  });
  if (token === undefined) throw new TaskError("unauthorized", "bearer token is required");
  const value = team.resolveToken(token);
  if (value === undefined) throw new TaskError("unauthorized", "invalid or expired token");
  return value;
}

function actor(principalValue: TeamPrincipalLike, team: TeamServiceLike): TaskActor {
  const user = team.users().find((candidate) => candidate.id === principalValue.userId);
  return {
    id: principalValue.userId,
    name: user?.name ?? principalValue.userId,
    kind: "human",
    role: principalValue.role,
  };
}

function query(request: IncomingMessage): URLSearchParams {
  return new URL(request.url ?? "/", "http://dsh.invalid").searchParams;
}

function canAccess(
  principalValue: TeamPrincipalLike,
  team: TeamServiceLike,
  workspaceId: string,
): boolean {
  return (
    principalValue.role === "admin" ||
    team.members(workspaceId).some((member) => member.userId === principalValue.userId)
  );
}

function requireAccess(
  request: IncomingMessage,
  team: TeamServiceLike,
  workspaceId: string,
): TaskActor {
  const principalValue = principal(request, team);
  if (!canAccess(principalValue, team, workspaceId)) {
    throw new TaskError("forbidden", "workspace membership is required");
  }
  return actor(principalValue, team);
}

function directory(
  team: TeamServiceLike,
  workspaceId: string,
  employees: EmployeeServiceLike | undefined,
  assignments: AssignmentServiceLike | undefined,
  teammates?: TeammateRuntimeLike,
  actor?: TeammateRuntimeActorLike,
): {
  humans: Array<{ id: string; name: string; role: string }>;
  agents: Array<{
    id: string;
    name: string;
    kind: "agent";
    ownerName?: string;
    ownerAuthUserId?: string;
    personaId?: string;
    source?: "platform" | "personal";
    avatar?: string;
  }>;
  roles: Array<{
    id: string;
    name: string;
    personaId?: string;
    assignedUserIds?: string[];
  }>;
} {
  const memberIds = new Set(
    team.members(workspaceId).map((member) => member.userId),
  );
  const humans = team
    .users()
    .filter((user) => memberIds.has(user.id))
    .map((user) => ({ id: user.id, name: user.name, role: user.role }));
  const employeeDirectory = employees?.list() ?? [];
  const employeeById = new Map(
    employeeDirectory.map((employee) => [employee.id, employee]),
  );
  const agents: Array<{
    id: string;
    name: string;
    kind: "agent";
    ownerName?: string;
    ownerAuthUserId?: string;
    personaId?: string;
    source?: "platform" | "personal";
    avatar?: string;
  }> = employeeDirectory
    .filter(
      (employee) =>
        employee.kind === "digital" &&
        employees?.employeeWorkspaceTarget(employee.id, workspaceId) !== undefined,
    )
    .map((employee) => {
      const owner =
        employee.managerEmployeeId === undefined
          ? undefined
          : employeeById.get(employee.managerEmployeeId);
      return {
        id: employee.id,
        name: employee.displayName,
        kind: "agent" as const,
        ...(owner?.displayName === undefined
          ? {}
          : { ownerName: owner.displayName }),
        ...(owner?.authUserId === undefined
          ? {}
          : { ownerAuthUserId: owner.authUserId }),
        ...(employee.personaId === undefined
          ? {}
          : { personaId: employee.personaId }),
        source: "platform" as const,
        avatar: "",
      };
    });
  if (teammates !== undefined && actor !== undefined) {
    for (const teammate of teammates.assignable(actor)) {
      agents.push({
        id: teammate.id,
        name: teammate.name,
        kind: "agent" as const,
        ownerName: teammate.ownerName,
        source: teammate.source,
        avatar: teammate.avatar,
      });
    }
  }
  let roles: Array<{
    id: string;
    name: string;
    personaId?: string;
    assignedUserIds?: string[];
  }> = [];
  try {
    const activeAssignments =
      assignments?.seats?.(workspaceId).filter(
        (assignment) => assignment.status !== "released",
      ) ?? [];
    roles =
      assignments?.config(workspaceId).seats.map((seat) => ({
        id: seat.id,
        name: seat.label,
        ...(seat.personaId === undefined ? {} : { personaId: seat.personaId }),
        assignedUserIds: activeAssignments
          .filter(
            (assignment) =>
              assignment.seatId === seat.id &&
              assignment.assigneeKind === "user",
          )
          .map((assignment) => assignment.assigneeId)
          .filter(
            (assigneeId, index, values) =>
              values.indexOf(assigneeId) === index,
          ),
      })) ?? [];
  } catch {
    roles = [];
  }
  return { humans, agents, roles };
}

function routeError(response: ServerResponse, cause: unknown): void {
  if (cause instanceof TaskError) {
    const status =
      cause.code === "invalid_input"
        ? 400
        : cause.code === "unauthorized"
          ? 401
          : cause.code === "forbidden"
            ? 403
            : cause.code === "not_found"
              ? 404
              : 409;
    sendJson(response, status, { ok: false, error: { code: cause.code, message: cause.message } });
    return;
  }
  sendJson(response, 500, {
    ok: false,
    error: { code: "internal_error", message: "task request failed" },
  });
}

function contextLine(value: string, limit = 800): string {
  const single = value.replace(/\s+/g, " ").trim();
  return single.length <= limit ? single : `${single.slice(0, limit)}…`;
}

function mentionNames(task: TaskRecord): readonly string[] {
  const names = new Set<string>();
  const receiver = task.receiverName?.trim();
  if (receiver !== undefined && receiver !== "") {
    names.add(receiver);
    const tail = receiver.split(/\s+/).filter(Boolean).at(-1);
    if (tail !== undefined) names.add(tail);
  }
  if (task.receiverId !== undefined) names.add(task.receiverId);
  return [...names];
}

/** 人类的这条消息是否 @ 了当前执行人；没有 @ 的讨论只进入上下文，不触发执行。 */
export function taskMessageMentionsReceiver(
  task: TaskRecord,
  content: string,
): boolean {
  return mentionNames(task).some(
    (name) => name !== "" && content.includes(`@${name}`),
  );
}

interface TaskContextOptions {
  readonly firstDelivery: boolean;
  readonly deliveredThroughMessageId?: string | undefined;
  readonly triggerContent?: string | undefined;
}

function buildTaskContext(
  task: TaskRecord,
  options: TaskContextOptions,
): string {
  const lines: string[] = [];
  if (options.firstDelivery) {
    lines.push(
      "# 任务",
      "",
      `- 编号：${task.id}`,
      `- 标题：${task.title}`,
      `- 类型：${task.type}`,
      `- 优先级：${task.priority}`,
      `- 项目：${task.workspaceId}`,
      `- 到期：${task.due ?? "不限"}`,
    );
    if (task.description.trim() !== "") {
      lines.push("", "## 描述", task.description.trim());
    }
    if (task.acceptance.length > 0) {
      lines.push(
        "",
        "## 验收标准",
        ...task.acceptance.map(
          (item, index) => `${String(index + 1)}. ${item}`,
        ),
      );
    }
    if (task.links.length > 0) {
      lines.push(
        "",
        "## 关联",
        ...task.links.map((link) => `- ${link.type}：${link.label}（${link.id}）`),
      );
    }
  }
  const startIndex =
    options.deliveredThroughMessageId === undefined
      ? 0
      : task.messages.findIndex(
          (message) => message.id === options.deliveredThroughMessageId,
        ) + 1;
  const fresh = task.messages
    .slice(startIndex)
    .filter((message) => message.kind !== "system")
    // 增量只投人类的新内容：Agent 自己的回复已经在会话历史里，
    // 再投一次既浪费 token，也会让它把自己的旧结论当成新要求。
    .filter((message) => options.firstDelivery || message.kind !== "agent");
  if (fresh.length > 0) {
    lines.push(
      "",
      options.firstDelivery ? "## 任务时间线" : "## 上次投递之后的新增讨论",
      ...fresh.map(
        (message) =>
          `- [${message.at}] ${message.authorName}（${message.kind === "human" ? "人类" : "Agent"}）：${contextLine(message.content)}`,
      ),
    );
  } else if (!options.firstDelivery) {
    lines.push("", "## 上次投递之后的新增讨论", "- 没有新增讨论。");
  }
  lines.push("", "## 本次需要你响应");
  if (options.triggerContent !== undefined && options.triggerContent.trim() !== "") {
    lines.push(
      "以下内容 @ 了你，请针对它行动（时间线里的其它内容只是背景）：",
      "",
      `> ${contextLine(options.triggerContent, 4_000)}`,
    );
  } else {
    lines.push(
      "按上面的任务描述与验收标准开始执行；信息不足时先列出缺失项再等补充。",
    );
  }
  lines.push(
    "",
    "## 边界",
    "- 时间线中的人类讨论是背景信息，只有「本次需要你响应」的内容需要你行动。",
    "- 不要重复处理已经完成的内容，也不要声称完成未提交的交付物。",
  );
  return lines.join("\n");
}

async function dispatchTaskInstruction(
  agent: TaskAgentServiceLike | undefined,
  employees: EmployeeServiceLike | undefined,
  workspaces: WorkspaceRegistryLike | undefined,
  teammates: TeammateRuntimeLike | undefined,
  task: TaskRecord,
  actor: TaskActor,
  trigger?: { readonly messageId?: string | undefined; readonly content: string },
): Promise<TaskAgentRun> {
  if (task.receiverType !== "agent" || task.receiverId === undefined) {
    throw new TaskError("invalid_input", "task receiver is not an agent");
  }
  if (agent === undefined) {
    throw new TaskError("conflict", "Agent 注册表不可用");
  }
  const employeeTarget = employees?.workflowTarget(
    task.receiverId,
    task.workspaceId,
  );
  const employeeProfileId = employeeTarget?.profile.legacyAgentProfileId;
  let target:
    | {
        readonly employeeId: string;
        readonly profileId: string;
        readonly profileName: string;
        readonly maxMinutes: number | undefined;
        readonly personaId: string | undefined;
        readonly employeeName: string;
      }
    | undefined;
  if (employeeTarget !== undefined && employeeProfileId !== undefined) {
    target = {
      employeeId: employeeTarget.employee.id,
      profileId: employeeProfileId,
      profileName: employeeTarget.profile.name,
      maxMinutes: employeeTarget.profile.budget?.maxMinutes,
      personaId: employeeTarget.employee.personaId,
      employeeName: employeeTarget.employee.displayName,
    };
  } else if (teammates !== undefined) {
    // AI Teammate 首次被指派时，按定义自动开通运行时身份。
    const ensured = await teammates.ensureRuntime({
      teammateId: task.receiverId,
      workspaceId: task.workspaceId,
      actor: {
        userId: actor.id,
        name: actor.name,
        role: actor.role ?? "member",
      },
    });
    target = {
      employeeId: ensured.employeeId,
      profileId: ensured.profileId,
      profileName: task.receiverName ?? ensured.teammateId,
      maxMinutes: undefined,
      personaId: ensured.personaId,
      employeeName: task.receiverName ?? ensured.teammateId,
    };
  }
  if (target === undefined) {
    throw new TaskError(
      "conflict",
      "该数字员工缺少可用的 Task Worker Profile",
    );
  }
  const sessionEpoch = task.sessionEpoch ?? 0;
  const previousRunId = [...task.agentRunIds].reverse().find((runId) => {
    const run = agent.run?.(runId);
    return (
      run?.payload?.context?.taskReceiverId === task.receiverId &&
      String(run?.payload?.context?.taskSessionEpoch ?? "0") ===
        String(sessionEpoch)
    );
  });
  const previousContext =
    previousRunId === undefined
      ? undefined
      : agent.run?.(previousRunId)?.payload?.context;
  const firstDelivery = previousContext === undefined;
  const deliveredThroughMessageId = firstDelivery
    ? undefined
    : (previousContext?.deliveredThroughMessageId as string | undefined);
  const deliveredThrough =
    deliveredThroughMessageId === undefined || deliveredThroughMessageId === ""
      ? undefined
      : deliveredThroughMessageId;
  const lastDeliveredMessageId = trigger?.messageId ?? task.messages.at(-1)?.id;
  const instruction = buildTaskContext(task, {
    firstDelivery,
    ...(deliveredThrough === undefined ? {} : { deliveredThroughMessageId: deliveredThrough }),
    ...(trigger === undefined ? {} : { triggerContent: trigger.content }),
  });
  const runSeq = task.agentRunIds.length + 1;
  const timeoutMinutes = target.maxMinutes ?? 30;
  const workspacePath = workspaces?.get(task.workspaceId)?.path;
  return agent.dispatch({
    workspaceId: task.workspaceId,
    ...(workspacePath === undefined ? {} : { workspacePath }),
    profileId: target.profileId,
    source: "task",
    instanceId: task.id,
    nodeId: "task",
    dispatchKey: `task:${task.id}:${runSeq}`,
    trigger: "manual-dispatch",
    attempt: 1,
    runSeq,
    maxAttempts: 1,
    timeoutMs: Math.min(
      3_600_000,
      Math.max(1_000, timeoutMinutes * 60_000),
    ),
    ...(target.personaId === undefined ? {} : { personaId: target.personaId }),
    employeeId: target.employeeId,
    principalType: "digital-employee",
    payload: {
      instanceTitle: task.title.slice(0, 160),
      nodeName: "任务执行",
      nodeDescription: task.description.slice(0, 2_000),
      profileName: target.profileName.slice(0, 120),
      responsibleId: actor.id,
      deliverables: [],
      context: {
        workspaceId: task.workspaceId,
        taskId: task.id,
        receiverId: target.employeeId,
        taskReceiverId: task.receiverId,
        taskSessionEpoch: String(sessionEpoch),
        employeeName: target.employeeName,
        instruction,
        firstDelivery: firstDelivery ? "true" : "false",
        triggerMessageId: trigger?.messageId ?? "",
        deliveredThroughMessageId: lastDeliveredMessageId ?? "",
        acceptance: task.acceptance.join("\n"),
      },
    },
    createdBy: actor.id,
  });
}

const uploadInputSchema = z.object({
  taskId: z.string().min(1).max(160),
  name: z.string().min(1).max(300),
  mimeType: z.string().max(200).optional(),
  contentBase64: z.string().min(1).max(32_000_000),
});

function safeResolve(root: string, relativePath: string): string {
  try {
    return resolveWithin(root, relativePath);
  } catch {
    throw new TaskError("forbidden", "路径不在工作区内");
  }
}

function decodeBase64(value: string): Buffer {
  const normalized =
    value.startsWith("data:") && value.includes(",")
      ? value.slice(value.indexOf(",") + 1)
      : value;
  const buffer = Buffer.from(normalized, "base64");
  if (buffer.byteLength === 0) {
    throw new TaskError("invalid_input", "上传内容为空");
  }
  return buffer;
}

function revealInFileManager(target: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const platform = process.platform;
    const command =
      platform === "darwin"
        ? "open"
        : platform === "win32"
          ? "explorer"
          : "xdg-open";
    const args =
      platform === "darwin"
        ? ["-R", target]
        : platform === "win32"
          ? [`/select,${target}`]
          : [dirname(target)];
    execFile(command, args, (error) => {
      if (error === null) resolve();
      else
        reject(
          new TaskError("conflict", `无法打开本地目录：${error.message}`),
        );
    });
  });
}

export function createTaskRoutes(
  service: TaskService,
  team: TeamServiceLike,
  employees?: EmployeeServiceLike,
  assignments?: AssignmentServiceLike,
  agent?: () => TaskAgentServiceLike | undefined,
  workspaces?: WorkspaceRegistryLike,
  teammates?: () => TeammateRuntimeLike | undefined,
): WebRouteLike[] {
  const workspaceRoot = (task: TaskRecord): string | undefined =>
    workspaces?.get(task.workspaceId)?.path;

  const agentDisplayName = (task: TaskRecord): string =>
    task.receiverName ?? task.receiverId ?? "Agent";

  const bootstrap = async (
    request: IncomingMessage,
    response: ServerResponse,
  ): Promise<void> => {
    try {
      assertSameOrigin(request);
      const workspaceId = query(request).get("workspaceId") ?? "";
      const currentActor = requireAccess(request, team, workspaceId);
      sendJson(response, 200, {
        ok: true,
        tasks: service.list(workspaceId),
        directory: directory(
          team,
          workspaceId,
          employees,
          assignments,
          teammates?.(),
          {
            userId: currentActor.id,
            name: currentActor.name,
            role: currentActor.role ?? "member",
          },
        ),
      });
    } catch (cause) {
      routeError(response, cause);
    }
  };

  const mutate = (
    handler: (
      request: IncomingMessage,
      actor: TaskActor,
      body: unknown,
    ) => Promise<unknown>,
  ) =>
    async (request: IncomingMessage, response: ServerResponse): Promise<void> => {
      try {
        assertSameOrigin(request);
        const body = await readJsonBody(request);
        let workspaceId =
          typeof body === "object" && body !== null && "workspaceId" in body
            ? String((body as { workspaceId?: unknown }).workspaceId ?? "")
            : query(request).get("workspaceId") ?? "";
        if (
          workspaceId === "" &&
          typeof body === "object" &&
          body !== null &&
          "taskId" in body
        ) {
          workspaceId = service.get(
            String((body as { taskId?: unknown }).taskId ?? ""),
          ).workspaceId;
        }
        if (
          workspaceId === "" ||
          (workspaces !== undefined && workspaces.get(workspaceId) === undefined)
        ) {
          throw new TaskError(
            "invalid_input",
            "任务必须归属到一个已存在的项目",
          );
        }
        const currentActor = requireAccess(request, team, workspaceId);
        const result = await handler(request, currentActor, body);
        sendJson(response, 200, { ok: true, ...(typeof result === "object" && result !== null ? result : { result }) });
      } catch (cause) {
        routeError(response, cause);
      }
    };

  const dispatchTask = async (
    task: TaskRecord,
    currentActor: TaskActor,
    trigger?: { readonly messageId?: string | undefined; readonly content: string },
  ): Promise<{ task: TaskRecord; execution: Record<string, string> }> => {
    try {
      const run = await dispatchTaskInstruction(
        agent?.(),
        employees,
        workspaces,
        teammates?.(),
        task,
        currentActor,
        ...(trigger === undefined ? [] : [trigger]),
      );
      return {
        task: await service.attachAgentRun(
          task.id,
          run,
          task.receiverName ?? task.receiverId ?? "Agent",
        ),
        execution: { runId: run.id, status: run.status },
      };
    } catch (cause) {
      const message =
        cause instanceof Error ? cause.message : "Agent 执行通道不可用";
      return {
        task: await service.failAgentDispatch(task.id, currentActor, message),
        execution: { error: message },
      };
    }
  };

  return [
    { kind: "exact", path: "/api/collab/tasks/bootstrap", handler: bootstrap },
    {
      kind: "exact",
      path: "/api/collab/tasks",
      handler: bootstrap,
    },
    {
      kind: "exact",
      path: "/api/collab/tasks/detail",
      handler: async (request, response) => {
        try {
          assertSameOrigin(request);
          const params = taskQuerySchema.parse({
            taskId: query(request).get("taskId") ?? "",
          });
          const task = service.get(params.taskId);
          requireAccess(request, team, task.workspaceId);
          sendJson(response, 200, { ok: true, task });
        } catch (cause) {
          routeError(response, cause);
        }
      },
    },
    {
      kind: "exact",
      path: "/api/collab/tasks/create",
      handler: mutate(async (_request, currentActor, body) => {
        const task = await service.create(currentActor, body);
        if (task.receiverType !== "agent" || task.receiverId === undefined) {
          return { task };
        }
        return dispatchTask(task, currentActor);
      }),
    },
    {
      kind: "exact",
      path: "/api/collab/tasks/update",
      handler: mutate(async (_request, currentActor, body) => ({
        task: await service.update(currentActor, body),
      })),
    },
    {
      kind: "exact",
      path: "/api/collab/tasks/assign",
      handler: mutate(async (_request, currentActor, body) => {
        const taskId = String(
          (body as { taskId?: unknown }).taskId ?? "",
        );
        const before = service.get(taskId);
        const task = await service.assign(currentActor, body);
        const changed =
          before.receiverType !== task.receiverType ||
          before.receiverId !== task.receiverId;
        if (
          !changed ||
          task.receiverType !== "agent" ||
          task.receiverId === undefined
        ) {
          return { task };
        }
        return dispatchTask(task, currentActor);
      }),
    },
    {
      kind: "exact",
      path: "/api/collab/tasks/claim",
      handler: mutate(async (_request, currentActor, body) => {
        return { task: await service.claim(currentActor, String((body as { taskId?: unknown }).taskId ?? "")) };
      }),
    },
    {
      kind: "exact",
      path: "/api/collab/tasks/status",
      handler: mutate(async (_request, currentActor, body) => ({
        task: await service.changeStatus(currentActor, body),
      })),
    },
    {
      kind: "exact",
      path: "/api/collab/tasks/action",
      handler: mutate(async (_request, currentActor, body) => {
        const parsedBody = body as {
          taskId?: unknown;
          action?: unknown;
        };
        const taskIdValue = String(parsedBody.taskId ?? "");
        const action = String(parsedBody.action ?? "");
        const actions: Record<string, () => Promise<TaskRecord>> = {
          start: () => service.start(currentActor, taskIdValue),
          submit: () => service.submit(currentActor, taskIdValue),
          approve: () => service.approve(currentActor, taskIdValue),
          reject: () => service.reject(currentActor, taskIdValue),
          nudge: () => service.nudge(currentActor, taskIdValue),
          archive: () => service.archive(currentActor, taskIdValue),
          restore: () => service.restore(currentActor, taskIdValue),
        };
        const run = actions[action];
        if (run === undefined) {
          throw new TaskError("invalid_input", "unknown task action");
        }
        return { task: await run() };
      }),
    },
    {
      kind: "exact",
      path: "/api/collab/tasks/message",
      handler: mutate(async (_request, currentActor, body) => {
        const saved = await service.addMessage(currentActor, body);
        if (saved.receiverType !== "agent" || saved.receiverId === undefined) {
          return { task: saved };
        }
        const last = saved.messages.at(-1);
        // 指令输入框发出的消息默认就是给执行人的指令，直接触发，不需要 @。
        return dispatchTask(
          saved,
          currentActor,
          last === undefined
            ? undefined
            : { messageId: last.id, content: last.content },
        );
      }),
    },
    {
      kind: "exact",
      path: "/api/collab/tasks/comment",
      handler: mutate(async (_request, currentActor, body) => {
        const task = await service.addComment(currentActor, body);
        if (task.receiverType !== "agent" || task.receiverId === undefined) {
          return { task };
        }
        const comment = task.comments.at(-1);
        // 评论区是讨论区：只有 @ 了执行人才触发执行。
        if (
          comment === undefined ||
          comment.kind !== "human" ||
          !taskMessageMentionsReceiver(task, comment.content)
        ) {
          return { task, dispatched: false };
        }
        return dispatchTask(task, currentActor, { content: comment.content });
      }),
    },
    {
      kind: "exact",
      path: "/api/collab/tasks/session/reset",
      handler: mutate(async (_request, currentActor, body) => ({
        task: await service.resetSession(currentActor, body),
      })),
    },
    {
      kind: "exact",
      path: "/api/collab/tasks/comment/reply",
      handler: mutate(async (_request, currentActor, body) => ({
        task: await service.replyComment(currentActor, body),
      })),
    },
    {
      kind: "exact",
      path: "/api/collab/tasks/step",
      handler: mutate(async (_request, currentActor, body) => ({
        task: await service.toggleStep(currentActor, body),
      })),
    },
    {
      kind: "exact",
      path: "/api/collab/tasks/documents",
      handler: async (request, response) => {
        try {
          assertSameOrigin(request);
          const params = taskQuerySchema.parse({
            taskId: query(request).get("taskId") ?? "",
          });
          const task = service.get(params.taskId);
          requireAccess(request, team, task.workspaceId);
          const root = workspaceRoot(task);
          const documents: TaskDocumentEntry[] =
            root === undefined
              ? []
              : await collectDocuments({
                  root,
                  windows: windowsFromRuns(
                    (agent?.()?.runs?.({
                      workspaceId: task.workspaceId,
                      instanceId: task.id,
                    }) ?? []).map((run) => ({
                      startedAt: run.startedAt,
                      endedAt: run.endedAt,
                      createdAt: run.createdAt,
                      actor: agentDisplayName(task),
                    })),
                    agentDisplayName(task),
                    Date.now(),
                  ),
                });
          sendJson(response, 200, {
            ok: true,
            documents: mergeDocuments([
              ...documents,
              ...attachmentDocuments(task, root !== undefined),
            ]),
            workspaceReady: root !== undefined,
          });
        } catch (cause) {
          routeError(response, cause);
        }
      },
    },
    {
      kind: "exact",
      path: "/api/collab/tasks/document/content",
      handler: async (request, response) => {
        try {
          assertSameOrigin(request);
          const params = query(request);
          const task = service.get(params.get("taskId") ?? "");
          requireAccess(request, team, task.workspaceId);
          const root = workspaceRoot(task);
          if (root === undefined) {
            throw new TaskError("conflict", "任务工作区不可用");
          }
          const absolute = safeResolve(root, params.get("path") ?? "");
          const info = await stat(absolute).catch(() => undefined);
          if (info === undefined || !info.isFile()) {
            throw new TaskError("not_found", "文件不存在");
          }
          const name = basename(absolute);
          response.writeHead(200, {
            "cache-control": "no-store",
            "content-type": mimeTypeFor(name),
            "content-length": String(info.size),
            "content-disposition": `attachment; filename*=UTF-8''${encodeURIComponent(name)}`,
            "x-content-type-options": "nosniff",
          });
          await pipeline(createReadStream(absolute), response);
        } catch (cause) {
          routeError(response, cause);
        }
      },
    },
    {
      kind: "exact",
      path: "/api/collab/tasks/document/reveal",
      handler: mutate(async (_request, _actor, body) => {
        const parsed = body as { taskId?: unknown; path?: unknown };
        const task = service.get(String(parsed.taskId ?? ""));
        const root = workspaceRoot(task);
        if (root === undefined) {
          throw new TaskError("conflict", "任务工作区不可用");
        }
        const relativePath = String(parsed.path ?? "");
        const target =
          relativePath === "" ? root : safeResolve(root, relativePath);
        await revealInFileManager(target);
        return { revealed: relativePath };
      }),
    },
    {
      kind: "exact",
      path: "/api/collab/tasks/document/upload",
      handler: async (request, response) => {
        try {
          assertSameOrigin(request);
          const parsed = uploadInputSchema.safeParse(
            await readJsonBody(request, 24 * 1024 * 1024),
          );
          if (!parsed.success) {
            throw new TaskError("invalid_input", "上传内容不合法");
          }
          const task = service.get(parsed.data.taskId);
          const currentActor = requireAccess(request, team, task.workspaceId);
          const root = workspaceRoot(task);
          if (root === undefined) {
            throw new TaskError("conflict", "任务工作区不可用");
          }
          const content = decodeBase64(parsed.data.contentBase64);
          const directory = uploadDirectory(root, task.id);
          await mkdir(directory, { recursive: true });
          const fileName = safeFileName(parsed.data.name);
          const absolute = join(directory, fileName);
          await writeFile(absolute, content);
          sendJson(response, 200, {
            ok: true,
            document: {
              name: fileName,
              relativePath: toRelativePath(root, absolute),
              size: content.byteLength,
              mimeType: parsed.data.mimeType ?? mimeTypeFor(fileName),
              uploadedBy: currentActor.name,
            },
          });
        } catch (cause) {
          routeError(response, cause);
        }
      },
    },
  ];
}

function assertSameOrigin(request: IncomingMessage): void {
  if (
    request.headers.origin !== undefined &&
    !sameOrigin(request.headers.origin, request.headers.host)
  ) {
    throw new TaskError("forbidden", "same-origin request is required");
  }
}

export async function apply(ctx: TaskContext): Promise<void> {
  const domain = await ctx.storageDomain.open(taskDomainSpec);
  const service = new TaskService({ tasks: domain.table("tasks") });
  ctx.provide("collabTasks", service);
  ctx.effect(() => () => void domain.close());
  ctx.inject(["collabTeam"], (child) => {
    const employees = child.get("collabEmployee") as EmployeeServiceLike | undefined;
    const assignments = child.get("collabAssignment") as AssignmentServiceLike | undefined;
    const workspaces = child.get("workspaceRegistry") as
      | WorkspaceRegistryLike
      | undefined;
    const disposers = createTaskRoutes(
      service,
      child.collabTeam,
      employees,
      assignments,
      () => child.get("collabAgent") as TaskAgentServiceLike | undefined,
      workspaces,
      () => child.get("collabTeammateRuntime") as TeammateRuntimeLike | undefined,
    ).map((route) => child.webServer.register(route) as () => void);
    child.effect(() => () => {
      for (const dispose of disposers) dispose();
    });
  });
  ctx.inject(["collabAgent"], (child) => {
    child.collabAgent.bindTask({
      onSettled: async (run) => {
        const task = service.get(run.instanceId);
        await service.attachAgentRun(
          task.id,
          run,
          task.receiverName ?? task.receiverId ?? "Agent",
        );
      },
    });
  });
}
