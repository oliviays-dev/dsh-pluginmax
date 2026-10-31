import type { IncomingMessage, ServerResponse } from "node:http";
import {
  bearerToken,
  readJsonBody,
  sameOrigin,
  sendJson,
} from "@pluginmax/shared";
import {
  commitTaskDraftsInputSchema,
  createManualTaskDraftInputSchema,
  issueTaskDraftCommitConfirmationInputSchema,
  linkTaskDraftInputSchema,
  saveTaskDraftsInputSchema,
  taskCaptureActorSchema,
  taskDraftCommitResultSchema,
  taskDraftSchema,
  taskOriginSchema,
  taskPrepareCaptureInputSchema,
  undoTaskDraftBatchInputSchema,
  updateTaskDraftInputSchema,
  type TaskCaptureActor,
} from "@pluginmax/contracts";
import { z } from "zod";
import { taskCaptureDomainSpec, type KvTableLike } from "./models.js";
import {
  TaskCaptureError,
  TaskCaptureService,
  type TaskCreationPort,
  type TaskLookupPort,
} from "./service.js";
import { TaskCaptureSourceRegistry } from "./source-registry.js";

export const name = "dsh-collab-task-capture";
export const inject = ["storageDomain", "webServer"];

export { TaskCaptureError, TaskCaptureService, TaskCaptureSourceRegistry };
export { taskCaptureDomainSpec };

interface WebRouteLike {
  readonly kind: "exact";
  readonly path: string;
  handler(
    request: IncomingMessage,
    response: ServerResponse,
  ): Promise<void> | void;
}

interface TeamPrincipalLike {
  readonly userId: string;
  readonly role?: "admin" | "owner" | "member" | "guest" | undefined;
}

interface TeamServiceLike {
  resolveToken(token: string): TeamPrincipalLike | undefined;
  users(): readonly { readonly id: string; readonly name: string }[];
  members(workspaceId: string): readonly {
    readonly userId: string;
    readonly memberRole?: "owner" | "member" | "guest" | undefined;
  }[];
}

interface CaptureDomainLike {
  table(name: keyof typeof taskCaptureDomainSpec.tables): KvTableLike<unknown>;
  close(): Promise<void>;
}

interface TaskCaptureContext {
  storageDomain: {
    open(spec: typeof taskCaptureDomainSpec): Promise<CaptureDomainLike>;
  };
  effect(register: () => () => void): void;
  emit?(event: string, payload?: unknown): void;
  provide(key: string, value: unknown): unknown;
  get(key: string): unknown;
  webServer: { register(route: WebRouteLike): unknown };
  inject(
    keys: readonly string[],
    callback: (child: TaskCaptureContext) => Promise<void> | void,
  ): { dispose(): void };
}

function query(request: IncomingMessage, key: string): string {
  return (
    new URL(request.url ?? "/", "http://dsh.invalid").searchParams.get(key) ??
    ""
  );
}

function routeError(response: ServerResponse, cause: unknown): void {
  if (cause instanceof TaskCaptureError) {
    const status =
      cause.code === "invalid_input"
        ? 400
        : cause.code === "unauthorized"
          ? 401
          : cause.code === "forbidden"
            ? 403
            : cause.code === "not_found"
              ? 404
              : cause.code === "capability_unavailable"
                ? 503
                : 409;
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
      message: cause instanceof Error ? cause.message : "task capture failed",
    },
  });
}

function requireSameOrigin(request: IncomingMessage): void {
  if (
    request.headers.origin !== undefined &&
    !sameOrigin(request.headers.origin, request.headers.host)
  ) {
    throw new TaskCaptureError("forbidden", "same-origin request is required");
  }
}

function browserActor(
  request: IncomingMessage,
  team: TeamServiceLike,
  workspaceId?: string,
): TaskCaptureActor {
  requireSameOrigin(request);
  const token = bearerToken({
    get: (header) =>
      header === "authorization"
        ? (request.headers.authorization ?? null)
        : null,
  });
  if (token === undefined) {
    throw new TaskCaptureError("unauthorized", "bearer token is required");
  }
  const principal = team.resolveToken(token);
  if (principal === undefined) {
    throw new TaskCaptureError("unauthorized", "invalid or expired token");
  }
  if (
    workspaceId !== undefined &&
    principal.role !== "admin" &&
    !team
      .members(workspaceId)
      .some((member) => member.userId === principal.userId)
  ) {
    throw new TaskCaptureError("forbidden", "workspace membership is required");
  }
  const user = team
    .users()
    .find((candidate) => candidate.id === principal.userId);
  return taskCaptureActorSchema.parse({
    id: principal.userId,
    name: user?.name ?? principal.userId,
    kind: "human",
    ...(principal.role === undefined ? {} : { role: principal.role }),
  });
}

function workspaceAccess(
  request: IncomingMessage,
  team: TeamServiceLike,
  workspaceId: string,
): TaskCaptureActor {
  if (workspaceId.trim() === "") {
    throw new TaskCaptureError("invalid_input", "workspaceId is required");
  }
  return browserActor(request, team, workspaceId);
}

function createRoutes(
  service: TaskCaptureService,
  team: TeamServiceLike,
): WebRouteLike[] {
  const mutate =
    (
      schema: z.ZodType<unknown>,
      handler: (
        request: IncomingMessage,
        actor: TaskCaptureActor,
        body: Record<string, unknown>,
      ) => Promise<unknown>,
    ) =>
    async (
      request: IncomingMessage,
      response: ServerResponse,
    ): Promise<void> => {
      try {
        requireSameOrigin(request);
        const raw = await readJsonBody(request);
        const body = schema.parse(raw) as Record<string, unknown>;
        const workspaceId = String(
          body.workspaceId ?? query(request, "workspaceId"),
        );
        const actor = workspaceAccess(request, team, workspaceId);
        const result = await handler(request, actor, body);
        sendJson(response, 200, {
          ok: true,
          ...(typeof result === "object" && result !== null
            ? result
            : { result }),
        });
      } catch (cause) {
        routeError(response, cause);
      }
    };

  return [
    {
      kind: "exact",
      path: "/api/collab/task-capture/prepare",
      handler: async (request, response) => {
        try {
          requireSameOrigin(request);
          const actor = browserActor(request, team);
          const body = taskPrepareCaptureInputSchema.parse(
            await readJsonBody(request),
          );
          const result = await service.prepare(actor, body);
          browserActor(request, team, result.session.workspaceId);
          sendJson(response, 200, { ok: true, ...result });
        } catch (cause) {
          routeError(response, cause);
        }
      },
    },
    {
      kind: "exact",
      path: "/api/collab/task-capture/session",
      handler: (request, response) => {
        try {
          const sessionId = query(request, "sessionId");
          const workspaceId = query(request, "workspaceId");
          const actor = workspaceAccess(request, team, workspaceId);
          const result = service.session(actor, sessionId);
          if (result.session.workspaceId !== workspaceId) {
            throw new TaskCaptureError("forbidden", "workspace mismatch");
          }
          sendJson(response, 200, { ok: true, ...result });
        } catch (cause) {
          routeError(response, cause);
        }
      },
    },
    {
      kind: "exact",
      path: "/api/collab/task-capture/save",
      handler: mutate(
        saveTaskDraftsInputSchema.extend({ workspaceId: z.string().min(1) }),
        async (_request, actor, body) => service.save(actor, body),
      ),
    },
    {
      kind: "exact",
      path: "/api/collab/task-capture/manual",
      handler: mutate(
        createManualTaskDraftInputSchema,
        async (_request, actor, body) => service.createManualDraft(actor, body),
      ),
    },
    {
      kind: "exact",
      path: "/api/collab/task-capture/inbox",
      handler: (request, response) => {
        try {
          const workspaceId = query(request, "workspaceId");
          const actor = workspaceAccess(request, team, workspaceId);
          const result = service.inbox(actor, workspaceId);
          sendJson(response, 200, { ok: true, ...result });
        } catch (cause) {
          routeError(response, cause);
        }
      },
    },
    {
      kind: "exact",
      path: "/api/collab/task-capture/library",
      handler: (request, response) => {
        try {
          const workspaceId = query(request, "workspaceId");
          const actor = workspaceAccess(request, team, workspaceId);
          const result = service.library(actor, workspaceId);
          sendJson(response, 200, { ok: true, ...result });
        } catch (cause) {
          routeError(response, cause);
        }
      },
    },
    {
      kind: "exact",
      path: "/api/collab/task-capture/batch",
      handler: (request, response) => {
        try {
          const workspaceId = query(request, "workspaceId");
          const actor = workspaceAccess(request, team, workspaceId);
          const result = service.batch(actor, query(request, "batchId"));
          if (result.batch.workspaceId !== workspaceId) {
            throw new TaskCaptureError("forbidden", "workspace mismatch");
          }
          sendJson(response, 200, { ok: true, ...result });
        } catch (cause) {
          routeError(response, cause);
        }
      },
    },
    {
      kind: "exact",
      path: "/api/collab/task-capture/draft/update",
      handler: mutate(
        updateTaskDraftInputSchema.extend({ workspaceId: z.string().min(1) }),
        async (_request, actor, body) => ({
          draft: taskDraftSchema.parse(await service.updateDraft(actor, body)),
        }),
      ),
    },
    {
      kind: "exact",
      path: "/api/collab/task-capture/draft/ignore",
      handler: mutate(
        z.object({
          workspaceId: z.string().min(1),
          draftId: z.string().min(1),
          commandId: z.string().min(1),
        }),
        async (_request, actor, body) => ({
          draft: await service.ignoreDraft(actor, {
            draftId: String(body.draftId),
            commandId: String(body.commandId),
          }),
        }),
      ),
    },
    {
      kind: "exact",
      path: "/api/collab/task-capture/batch/dismiss",
      handler: mutate(
        z.object({
          workspaceId: z.string().min(1),
          batchId: z.string().min(1),
          commandId: z.string().min(1),
        }),
        async (_request, actor, body) => {
          await service.dismissBatch(actor, {
            batchId: String(body.batchId),
            commandId: String(body.commandId),
          });
          return { dismissed: true };
        },
      ),
    },
    {
      kind: "exact",
      path: "/api/collab/task-capture/batch/undo",
      handler: mutate(
        undoTaskDraftBatchInputSchema.extend({
          workspaceId: z.string().min(1),
        }),
        async (_request, actor, body) => {
          await service.undoBatch(actor, body);
          return { undone: true };
        },
      ),
    },
    {
      kind: "exact",
      path: "/api/collab/task-capture/commit",
      handler: mutate(
        commitTaskDraftsInputSchema.extend({ workspaceId: z.string().min(1) }),
        async (_request, actor, body) =>
          taskDraftCommitResultSchema.parse(await service.commit(actor, body)),
      ),
    },
    {
      kind: "exact",
      path: "/api/collab/task-capture/commit/confirmation",
      handler: mutate(
        issueTaskDraftCommitConfirmationInputSchema.extend({
          workspaceId: z.string().min(1),
        }),
        async (_request, actor, body) =>
          service.issueCommitConfirmation(actor, body),
      ),
    },
    {
      kind: "exact",
      path: "/api/collab/task-capture/conversion/retry",
      handler: mutate(
        commitTaskDraftsInputSchema.extend({ workspaceId: z.string().min(1) }),
        async (_request, actor, body) =>
          taskDraftCommitResultSchema.parse(
            await service.retryConversion(actor, body),
          ),
      ),
    },
    {
      kind: "exact",
      path: "/api/collab/task-capture/origin",
      handler: (request, response) => {
        try {
          const workspaceId = query(request, "workspaceId");
          const actor = workspaceAccess(request, team, workspaceId);
          const origin = service.origin(actor, query(request, "taskId"));
          if (origin !== undefined && origin.workspaceId !== workspaceId) {
            throw new TaskCaptureError("forbidden", "workspace mismatch");
          }
          sendJson(response, 200, {
            ok: true,
            ...(origin === undefined
              ? {}
              : { origin: taskOriginSchema.parse(origin) }),
          });
        } catch (cause) {
          routeError(response, cause);
        }
      },
    },
    {
      kind: "exact",
      path: "/api/collab/task-capture/draft/link",
      handler: mutate(
        linkTaskDraftInputSchema.extend({ workspaceId: z.string().min(1) }),
        async (_request, actor, body) => ({
          draft: await service.linkDraft(actor, body),
        }),
      ),
    },
    {
      kind: "exact",
      path: "/api/collab/task-capture/events",
      handler: (request, response) => {
        try {
          const workspaceId = query(request, "workspaceId");
          const actor = workspaceAccess(request, team, workspaceId);
          const events = service.events(
            actor,
            workspaceId,
            query(request, "after") || undefined,
          );
          sendJson(response, 200, { ok: true, events });
        } catch (cause) {
          routeError(response, cause);
        }
      },
    },
    {
      kind: "exact",
      path: "/api/collab/task-capture/summary",
      handler: (request, response) => {
        try {
          const workspaceId = query(request, "workspaceId");
          const actor = workspaceAccess(request, team, workspaceId);
          const inbox = service.inbox(actor, workspaceId);
          sendJson(response, 200, {
            ok: true,
            draftCount: inbox.draftCount,
            readyCount: inbox.readyCount,
            needsInfoCount: inbox.needsInfoCount,
          });
        } catch (cause) {
          routeError(response, cause);
        }
      },
    },
  ];
}

export async function apply(ctx: TaskCaptureContext): Promise<void> {
  ctx.inject(
    ["collabTaskCreation", "collabTaskExecution", "collabTeam"],
    async (child) => {
      const taskCreation = child.get("collabTaskCreation") as
        TaskCreationPort | undefined;
      const team = child.get("collabTeam") as TeamServiceLike | undefined;
      if (taskCreation === undefined || team === undefined) return;
      try {
        const domain = await child.storageDomain.open(taskCaptureDomainSpec);
        const sources = new TaskCaptureSourceRegistry();
        const service = new TaskCaptureService(
          {
            captureSessions: domain.table("capture_sessions") as never,
            captureCandidates: domain.table("capture_candidates") as never,
            draftBatches: domain.table("draft_batches") as never,
            drafts: domain.table("drafts") as never,
            commitConfirmations: domain.table("commit_confirmations") as never,
            conversions: domain.table("conversions") as never,
            taskOrigins: domain.table("task_origins") as never,
            events: domain.table("events") as never,
            idempotency: domain.table("idempotency") as never,
            audit: domain.table("audit") as never,
          },
          {
            sources,
            taskCreation: () =>
              child.get("collabTaskCreation") as TaskCreationPort | undefined,
            taskLookup: () =>
              child.get("collabTasks") as TaskLookupPort | undefined,
            taskDispatch: () =>
              child.get("collabTaskExecution") as
                import("./service.js").TaskDispatchPort | undefined,
            onChange: (event) => {
              try {
                child.emit?.("collab/task-capture-changed", event);
              } catch {
                // Domain events are best-effort and must not break writes.
              }
            },
          },
        );
        ctx.provide("collabTaskCapture", service);
        ctx.provide("collabTaskCaptureSources", sources);
        const routes = createRoutes(service, team);
        const disposers = routes.map(
          (route) => ctx.webServer.register(route) as () => void,
        );
        ctx.effect(() => () => {
          for (const dispose of disposers) dispose();
          void domain.close();
        });
      } catch (cause) {
        console.error("task-capture startup failed", cause);
      }
    },
  );
}
