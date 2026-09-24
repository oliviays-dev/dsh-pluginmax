import type { IncomingMessage, ServerResponse } from "node:http";
import {
  bearerToken,
  readJsonBody,
  sameOrigin,
  sendJson,
} from "@pluginmax/shared";
import { z } from "zod";
import {
  teammateEventSchema,
  teammateSchema,
  teammateSourceSchema,
  teammateStateSchema,
  type Teammate,
  type TeammateEvent,
} from "./models.js";
import {
  canManageTeammate,
  TeammateError,
  TeammateService,
  type KvTableLike,
  type TeammateActor,
} from "./service.js";
import {
  TeammateRuntime,
  type AgentServiceLike,
  type EmployeeServiceLike,
  type PersonaServiceLike,
} from "./runtime.js";

export { TeammateError, TeammateService, canManageTeammate, nextVersion } from "./service.js";
export type { Teammate, TeammateEvent } from "./models.js";
export type { TeammateActor, TeammateTables } from "./service.js";
export { TeammateRuntime } from "./runtime.js";
export type {
  EnsuredRuntime,
  EnsureRuntimeInput,
  TeammateRuntimeDeps,
} from "./runtime.js";

export const name = "dsh-collab-teammate";
export const inject = ["storageDomain", "webServer"];

type TeammateStorageTableName = "teammates" | "events";

interface DomainSpecLike {
  readonly name: string;
  readonly version: number;
  readonly compatibleVersions?: readonly number[];
  readonly tables: Record<string, { readonly valueSchema: z.ZodType<unknown> }>;
}

export interface WebRouteLike {
  readonly kind: "exact";
  readonly path: string;
  handler(
    request: IncomingMessage,
    response: ServerResponse,
  ): Promise<void> | void;
}

export const teammateDomainSpec: DomainSpecLike = {
  name: "collab_teammate",
  version: 1,
  tables: {
    teammates: { valueSchema: teammateSchema as unknown as z.ZodType<unknown> },
    events: {
      valueSchema: teammateEventSchema as unknown as z.ZodType<unknown>,
    },
  },
};

interface TeamMemberLike {
  readonly userId: string;
  readonly memberRole?: "owner" | "member" | "guest";
}

interface TeamServiceLike {
  resolveToken(token: string): TeammateActor | undefined;
  users(): readonly { readonly id: string; readonly name: string }[];
  members(workspaceId: string): readonly TeamMemberLike[];
}

interface TaskRecordLike {
  readonly id: string;
  readonly workspaceId: string;
  readonly title: string;
  readonly status: string;
  readonly receiverType: string;
  readonly receiverId?: string | undefined;
  readonly receiverName?: string | undefined;
  readonly description?: string | undefined;
  readonly archivedAt?: string | undefined;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly messages?: readonly TaskMessageLike[] | undefined;
}

interface TaskMessageLike {
  readonly content: string;
  readonly runId?: string | undefined;
  readonly state?: string | undefined;
}

const ACTIVE_RUN_STATES = new Set(["queued", "running", "waiting_input"]);

/**
 * 只有「最近一次 run 仍在进行」才算运行中。
 * 历史里旧的 running 消息、或看板列停留在「进行中」，都不代表 Agent 还在跑。
 */
export function isTaskRunning(task: {
  readonly messages?: readonly TaskMessageLike[] | undefined;
}): boolean {
  const messages = task.messages ?? [];
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (message?.runId !== undefined && message.state !== undefined) {
      return ACTIVE_RUN_STATES.has(message.state);
    }
  }
  return false;
}

interface TaskServiceLike {
  list(workspaceId: string): readonly TaskRecordLike[];
}

interface WorkspaceRegistryLike {
  list(): readonly { readonly id: string }[];
}

function requestHeader(
  request: IncomingMessage,
  key: string,
): string | undefined {
  const value = request.headers[key.toLowerCase()];
  return Array.isArray(value) ? value[0] : value;
}

function requirePrincipal(
  request: IncomingMessage,
  team: TeamServiceLike,
): TeammateActor & { readonly token: string } {
  const origin = requestHeader(request, "origin");
  const host = requestHeader(request, "host");
  if (origin !== undefined && !sameOrigin(origin, host)) {
    throw new TeammateError("forbidden", "same-origin requests are required");
  }
  const token = bearerToken({
    get: (name) =>
      name === "authorization" ? (request.headers.authorization ?? null) : null,
  });
  if (token === undefined) {
    throw new TeammateError("unauthorized", "bearer token is required");
  }
  const principal = team.resolveToken(token);
  if (principal === undefined) {
    throw new TeammateError("unauthorized", "invalid or expired token");
  }
  const user = team.users().find((item) => item.id === principal.userId);
  return {
    ...principal,
    name: user?.name ?? principal.userId,
    token,
  };
}

function query(request: IncomingMessage): URLSearchParams {
  return new URL(request.url ?? "/", "http://localhost").searchParams;
}

async function readBody(request: IncomingMessage): Promise<unknown> {
  try {
    return await readJsonBody(request, 1024 * 1024);
  } catch {
    throw new TeammateError("invalid_input", "valid JSON body is required");
  }
}

function parseOrInvalid<T>(schema: z.ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);
  if (!result.success) {
    throw new TeammateError("invalid_input", "request input is invalid");
  }
  return result.data;
}

function errorStatus(code: TeammateError["code"]): number {
  if (code === "unauthorized") return 401;
  if (code === "forbidden") return 403;
  if (code === "not_found") return 404;
  if (code === "conflict") return 409;
  return 400;
}

async function runHandler(
  operation: () => Promise<void> | void,
  response: ServerResponse,
): Promise<void> {
  try {
    await operation();
  } catch (cause) {
    if (cause instanceof TeammateError) {
      sendJson(response, errorStatus(cause.code), {
        ok: false,
        error: { code: cause.code, message: cause.message },
      });
      return;
    }
    sendJson(response, 500, {
      ok: false,
      error: { code: "internal_error", message: "teammate request failed" },
    });
  }
}

const createBodySchema = z.object({
  source: teammateSourceSchema,
  name: z.string().trim().min(1).max(120).optional(),
  role: z.string().trim().max(120).optional(),
});

const updateBodySchema = z.object({
  teammateId: z.string().trim().min(1).max(160),
  name: z.string().trim().min(1).max(120),
  source: teammateSourceSchema.optional(),
  role: z.string().trim().max(120).optional(),
  description: z.string().max(4_000).optional(),
  soul: z.string().max(200_000).optional(),
  scenarios: z.array(z.string().trim().min(1).max(500)).max(50).optional(),
  goals: z.array(z.string().trim().min(1).max(500)).max(50).optional(),
  avatar: z.string().max(400_000).optional(),
});

const stateBodySchema = z.object({
  teammateId: z.string().trim().min(1).max(160),
  state: teammateStateSchema,
});

interface RuntimeTask {
  readonly id: string;
  readonly title: string;
  readonly workspaceId: string;
  readonly status: string;
  readonly updatedAt: string;
  readonly latestProgress: string;
  readonly running: boolean;
  readonly archived: boolean;
  readonly runs: readonly {
    readonly id: string;
    readonly status: string;
    readonly runSeq: number;
    readonly error?: string | undefined;
    readonly summary?: string | undefined;
    readonly startedAt?: string | undefined;
    readonly endedAt?: string | undefined;
    readonly createdAt: string;
  }[];
}

function latestProgress(task: TaskRecordLike): string {
  const messages = task.messages ?? [];
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (message !== undefined && message.content.trim() !== "") {
      return normalizeTaskProgress(message.content);
    }
  }
  return task.description?.trim() || "暂无最新进展";
}

export function normalizeTaskProgress(content: string): string {
  const prefix = "无法启动执行：";
  if (!content.startsWith(prefix)) return content;
  const detail = content.slice(prefix.length).trim();
  try {
    const issues = JSON.parse(detail) as Array<{ message?: unknown }>;
    if (Array.isArray(issues)) {
      const messages = issues
        .map((issue) =>
          typeof issue?.message === "string" ? issue.message.trim() : "",
        )
        .filter(Boolean);
      if (messages.length > 0) return `${prefix}${messages.join("；")}`;
    }
  } catch {
    // Keep the original text when the stored error is not a JSON issue list.
  }
  return content;
}

function runtimeTask(task: TaskRecordLike): Omit<RuntimeTask, "runs"> {
  return {
    id: task.id,
    title: task.title,
    workspaceId: task.workspaceId,
    status: task.status,
    updatedAt: task.updatedAt,
    latestProgress: latestProgress(task),
    running: isTaskRunning(task),
    archived: task.archivedAt !== undefined,
  };
}

/** 收集调用者能看到的全部任务（管理员可见全部工作区）。 */
function collectAccessibleTasks(input: {
  readonly team: TeamServiceLike;
  readonly actor: TeammateActor;
  readonly tasks: TaskServiceLike | undefined;
  readonly workspaces: WorkspaceRegistryLike | undefined;
}): readonly TaskRecordLike[] {
  const taskService = input.tasks;
  const registry = input.workspaces;
  if (taskService === undefined || registry === undefined) return [];
  const collected: TaskRecordLike[] = [];
  for (const workspace of registry.list()) {
    const isMember =
      input.actor.role === "admin" ||
      input.team
        .members(workspace.id)
        .some((member) => member.userId === input.actor.userId);
    if (!isMember) continue;
    for (const task of taskService.list(workspace.id)) collected.push(task);
  }
  return collected;
}

/** 至少有一个任务在运行的 teammate id（兼容通过 employeeId 派发的老任务）。 */
export function runningTeammateIds(input: {
  readonly teammates: readonly {
    readonly id: string;
    readonly employeeId?: string | undefined;
  }[];
  readonly tasks: readonly {
    readonly receiverType: string;
    readonly receiverId?: string | undefined;
    readonly messages?: readonly TaskMessageLike[] | undefined;
  }[];
}): readonly string[] {
  const runningReceivers = new Set(
    input.tasks
      .filter(
        (task) =>
          task.receiverType === "agent" &&
          task.receiverId !== undefined &&
          isTaskRunning(task),
      )
      .map((task) => task.receiverId as string),
  );
  return input.teammates
    .filter(
      (teammate) =>
        runningReceivers.has(teammate.id) ||
        (teammate.employeeId !== undefined &&
          runningReceivers.has(teammate.employeeId)),
    )
    .map((teammate) => teammate.id);
}

export function createTeammateRoutes(
  service: TeammateService,
  team: () => TeamServiceLike | undefined,
  tasks: () => TaskServiceLike | undefined,
  workspaces: () => WorkspaceRegistryLike | undefined,
  beforeList?: () => Promise<void>,
  teammateRuntime?: TeammateRuntime,
  agentRuns?: () => AgentServiceLike | undefined,
): WebRouteLike[] {
  const requireTeam = (): TeamServiceLike => {
    const value = team();
    if (value === undefined) {
      throw new TeammateError("not_found", "identity service is unavailable");
    }
    return value;
  };
  const methods = (allowed: string, request: IncomingMessage): void => {
    if (request.method !== allowed) {
      throw new TeammateError("invalid_input", "method not allowed");
    }
  };
  const mutate = (
    handler: (
      actor: TeammateActor,
      body: unknown,
    ) => Promise<unknown> | unknown,
  ) =>
    async (request: IncomingMessage, response: ServerResponse): Promise<void> => {
      await runHandler(async () => {
        const actor = requirePrincipal(request, requireTeam());
        const body = await readBody(request);
        const result = await handler(actor, body);
        sendJson(response, 200, {
          ok: true,
          ...(typeof result === "object" && result !== null
            ? result
            : { result }),
        });
      }, response);
    };

  return [
    {
      kind: "exact",
      path: "/api/collab/teammates",
      handler: (request, response) =>
        runHandler(async () => {
          methods("GET", request);
          const actor = requirePrincipal(request, requireTeam());
          if (beforeList !== undefined) await beforeList();
          const teammates = service.list();
          const identity = requireTeam();
          sendJson(response, 200, {
            ok: true,
            teammates,
            canManagePlatform: actor.role === "admin",
            runningTeammateIds: runningTeammateIds({
              teammates,
              tasks: collectAccessibleTasks({
                team: identity,
                actor,
                tasks: tasks(),
                workspaces: workspaces(),
              }),
            }),
          });
        }, response),
    },
    {
      kind: "exact",
      path: "/api/collab/teammates/detail",
      handler: (request, response) =>
        runHandler(async () => {
          methods("GET", request);
          requirePrincipal(request, requireTeam());
          const teammateId = query(request).get("teammateId") ?? "";
          const teammate = service.get(teammateId);
          sendJson(response, 200, {
            ok: true,
            teammate,
            events: service.events(teammate.id),
          });
        }, response),
    },
    {
      kind: "exact",
      path: "/api/collab/teammates/create",
      handler: mutate((actor, body) => {
        const input = parseOrInvalid(createBodySchema, body);
        return service.create(actor, input).then((teammate) => ({ teammate }));
      }),
    },
    {
      kind: "exact",
      path: "/api/collab/teammates/update",
      handler: mutate((actor, body) => {
        const input = parseOrInvalid(updateBodySchema, body);
        return service.update(actor, input).then((teammate) => ({ teammate }));
      }),
    },
    {
      kind: "exact",
      path: "/api/collab/teammates/state",
      handler: mutate((actor, body) => {
        const input = parseOrInvalid(stateBodySchema, body);
        return service.changeState(actor, input).then((teammate) => ({ teammate }));
      }),
    },
    {
      kind: "exact",
      path: "/api/collab/teammates/identity",
      handler: (request, response) =>
        runHandler(async () => {
          methods("GET", request);
          requirePrincipal(request, requireTeam());
          const teammateId = query(request).get("teammateId") ?? "";
          const identity =
            teammateRuntime === undefined
              ? undefined
              : await teammateRuntime.identityOf(teammateId);
          sendJson(response, 200, { ok: true, identity: identity ?? null });
        }, response),
    },
    {
      kind: "exact",
      path: "/api/collab/teammates/identity/status",
      handler: mutate(async (actor, body) => {
        const input = parseOrInvalid(
          z.object({
            teammateId: z.string().trim().min(1).max(160),
            status: z.enum(["active", "disabled"]),
          }),
          body,
        );
        const teammate = service.get(input.teammateId);
        if (!canManageTeammate(teammate, actor)) {
          throw new TeammateError(
            "forbidden",
            "没有权限管理该 AI Teammate 的执行身份",
          );
        }
        const identity =
          teammateRuntime === undefined
            ? undefined
            : await teammateRuntime.setIdentityStatus({
                teammateId: input.teammateId,
                status: input.status,
                actor,
              });
        return {
          teammate: service.get(input.teammateId),
          identity: identity ?? null,
        };
      }),
    },
    {
      kind: "exact",
      path: "/api/collab/teammates/runtime",
      handler: (request, response) =>
        runHandler(async () => {
          methods("GET", request);
          const actor = requirePrincipal(request, requireTeam());
          const teammate = service.get(
            query(request).get("teammateId") ?? "",
          );
          const collected = collectAccessibleTasks({
            team: requireTeam(),
            actor,
            tasks: tasks(),
            workspaces: workspaces(),
          })
            .filter(
              (task) =>
                task.receiverType === "agent" &&
                (task.receiverId === teammate.id ||
                  (teammate.employeeId !== undefined &&
                    task.receiverId === teammate.employeeId)),
            )
            .map((task) => {
              const agent = agentRuns?.();
              return {
                ...runtimeTask(task),
                runs: (
                  agent?.runs?.({
                    workspaceId: task.workspaceId,
                    instanceId: task.id,
                  }) ?? []
                ).map((run) => ({
                  id: run.id,
                  status: run.status,
                  runSeq: run.runSeq,
                  ...(run.error === undefined ? {} : { error: run.error }),
                  ...(run.output?.summary === undefined
                    ? {}
                    : { summary: run.output.summary }),
                  ...(run.startedAt === undefined
                    ? {}
                    : { startedAt: run.startedAt }),
                  ...(run.endedAt === undefined
                    ? {}
                    : { endedAt: run.endedAt }),
                  createdAt: run.createdAt,
                })),
              };
            });
          collected.sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
          sendJson(response, 200, { ok: true, tasks: collected });
        }, response),
    },
  ];
}

export interface TeammateContext {
  storageDomain: {
    open(spec: typeof teammateDomainSpec): Promise<{
      table<T>(name: TeammateStorageTableName): KvTableLike<T>;
      close(): Promise<void>;
    }>;
  };
  webServer: { register(route: WebRouteLike): unknown };
  provide(key: "collabTeammates", value: TeammateService): unknown;
  provide(key: "collabTeammateRuntime", value: TeammateRuntime): unknown;
  effect(operation: () => () => void): void;
  collabTeam?: TeamServiceLike;
  collabTasks?: TaskServiceLike;
  workspaceRegistry?: WorkspaceRegistryLike;
  get(key: "collabTasks"): TaskServiceLike | undefined;
  get(key: "workspaceRegistry"): WorkspaceRegistryLike | undefined;
  get(key: "collabPersonas"): PersonaServiceLike | undefined;
  get(key: "collabEmployee"): EmployeeServiceLike | undefined;
  get(key: "collabAgent"): AgentServiceLike | undefined;
  inject(
    keys: readonly ["collabTeam"],
    callback: (
      child: TeammateContext & { readonly collabTeam: TeamServiceLike },
    ) => void,
  ): { dispose(): void } | void;
}

export async function apply(ctx: TeammateContext): Promise<void> {
  const domain = await ctx.storageDomain.open(teammateDomainSpec);
  const service = new TeammateService({
    tables: {
      teammates: domain.table<Teammate>("teammates"),
      events: domain.table<TeammateEvent>("events"),
    },
  });
  ctx.provide("collabTeammates", service);
  const runtimeService = new TeammateRuntime({
    teammates: service,
    personas: () => ctx.get("collabPersonas"),
    employees: () => ctx.get("collabEmployee"),
    agents: () => ctx.get("collabAgent"),
  });
  ctx.provide("collabTeammateRuntime", runtimeService);
  const identityFiber = ctx.inject(["collabTeam"], (child) => {
    const routes = createTeammateRoutes(
      service,
      () => child.collabTeam,
      () => ctx.get("collabTasks"),
      () => ctx.get("workspaceRegistry"),
      () => runtimeService.syncFromEmployees(),
      runtimeService,
      () => ctx.get("collabAgent"),
    );
    for (const route of routes) ctx.webServer.register(route);
  });
  ctx.effect(() => () => {
    identityFiber?.dispose();
    void domain.close();
  });
}
