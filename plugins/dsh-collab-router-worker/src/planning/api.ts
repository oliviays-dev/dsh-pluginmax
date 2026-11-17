import type { IncomingMessage, ServerResponse } from "node:http";
import {
  bearerToken,
  readJsonBody,
  sameOrigin,
  sendJson,
} from "@pluginmax/shared";
import { z } from "zod";
import type { PlanActor, RootTaskLike } from "../service.js";
import { ManualPlanningCoordinator } from "./manual-planning.js";
import {
  planningModeSchema,
  type PlanningSettings,
  type PlanningStatus,
} from "./models.js";
import { PlanningError, type PlanningService } from "./service.js";

interface PlanningTeamLike {
  resolveToken(token: string):
    | {
        readonly userId: string;
        readonly role: "admin" | "owner" | "member" | "guest";
      }
    | undefined;
  members(workspaceId: string): readonly {
    readonly userId: string;
    readonly memberRole?: string | undefined;
  }[];
  users(): readonly { readonly id: string; readonly name: string }[];
}

export interface PlanningWebRouteLike {
  readonly kind: "exact";
  readonly path: string;
  handler(
    request: IncomingMessage,
    response: ServerResponse,
  ): Promise<void> | void;
}

function bearer(request: IncomingMessage): string {
  const token = bearerToken({
    get(name) {
      const value = request.headers[name.toLowerCase()];
      return Array.isArray(value) ? (value[0] ?? null) : (value ?? null);
    },
  });
  if (token === undefined) throw new Error("bearer token is required");
  return token;
}

function sameOriginRequest(request: IncomingMessage): void {
  if (
    request.headers.origin !== undefined &&
    !sameOrigin(request.headers.origin, request.headers.host)
  ) {
    throw new Error("same-origin request is required");
  }
}

function queryWorkspace(request: IncomingMessage): string {
  const value = new URL(
    request.url ?? "/",
    "http://dsh.invalid",
  ).searchParams.get("workspaceId");
  return z.string().trim().min(1).max(200).parse(value);
}

function actorForRequest(
  team: PlanningTeamLike,
  request: IncomingMessage,
  workspaceId: string,
): PlanActor {
  sameOriginRequest(request);
  const principal = team.resolveToken(bearer(request));
  if (principal === undefined) throw new Error("invalid bearer token");
  const member = team
    .members(workspaceId)
    .find((candidate) => candidate.userId === principal.userId);
  if (member === undefined && principal.role !== "admin") {
    throw new Error("workspace member is required");
  }
  return {
    id: principal.userId,
    name:
      team.users().find((user) => user.id === principal.userId)?.name ??
      principal.userId,
    kind: "human",
    role:
      principal.role === "owner"
        ? "owner"
        : member?.memberRole === "owner"
          ? "owner"
          : principal.role,
  };
}

function errorStatus(cause: unknown): number {
  if (cause instanceof PlanningError) {
    if (cause.code === "forbidden") return 403;
    if (cause.code === "not_found") return 404;
    if (
      cause.code === "conflict" ||
      cause.code === "planning_disabled" ||
      cause.code === "revision_conflict" ||
      cause.code === "no_active_run"
    ) {
      return 409;
    }
    return 400;
  }
  return 400;
}

const planningSettingsUpdateSchema = z.object({
  workspaceId: z.string().trim().min(1).max(200),
  expectedRevision: z.number().int().nonnegative().optional(),
  enabled: z.boolean().optional(),
  defaultPlannerAgentId: z
    .string()
    .trim()
    .min(1)
    .max(240)
    .nullable()
    .optional(),
  agentOwnerPolicy: z
    .object({
      autoPlanOnAssignment: z.boolean().optional(),
      autoPlanOnSpecChange: z.boolean().optional(),
      requirePlanBeforeExecution: z.boolean().optional(),
      mode: planningModeSchema.optional(),
      approval: z.enum(["manual", "risk-based", "auto"]).optional(),
    })
    .optional(),
  humanOwner: z
    .object({
      allowManualPlanning: z.boolean().optional(),
      defaultMode: planningModeSchema.optional(),
      alwaysRequireReview: z.boolean().optional(),
    })
    .optional(),
  knowledgeProviderId: z.string().trim().min(1).max(200).nullable().optional(),
});

function settingsView(settings: PlanningSettings) {
  return {
    workspaceId: settings.workspaceId,
    enabled: settings.enabled,
    defaultPlannerAgentId: settings.defaultPlannerAgentId ?? null,
    agentOwnerPolicy: settings.agentOwnerPolicy,
    humanOwner: settings.humanOwner,
    knowledgeProviderId: settings.knowledgeProviderId ?? null,
    revision: settings.revision,
    updatedAt: settings.updatedAt,
    updatedBy: settings.updatedBy,
  };
}

function canStartPlanning(task: RootTaskLike, actor: PlanActor): boolean {
  if (actor.role === "admin" || actor.role === "owner") return true;
  if (task.createdBy === actor.id) return true;
  return task.receiverType === "human" && task.receiverId === actor.id;
}

export function createPlanningRoutes(input: {
  readonly planning: PlanningService;
  readonly coordinator: ManualPlanningCoordinator;
  readonly team: PlanningTeamLike;
  readonly tasks: { get(taskId: string): RootTaskLike };
  readonly scope?: "all" | "settings" | "runtime" | undefined;
  readonly onSettingsChanged?:
    ((settings: PlanningSettings) => Promise<void> | void) | undefined;
}): PlanningWebRouteLike[] {
  const respond = async (
    response: ServerResponse,
    operation: () => Promise<unknown> | unknown,
  ) => {
    try {
      sendJson(response, 200, { ok: true, result: await operation() });
    } catch (cause) {
      sendJson(response, errorStatus(cause), {
        ok: false,
        error:
          cause instanceof Error ? cause.message : "planning request failed",
      });
    }
  };

  const routes: PlanningWebRouteLike[] = [
    {
      kind: "exact",
      path: "/api/collab/router-worker/planning/settings",
      handler: async (request, response) => {
        await respond(response, () => {
          const workspaceId = queryWorkspace(request);
          actorForRequest(input.team, request, workspaceId);
          return {
            settings: settingsView(input.planning.settings(workspaceId)),
          };
        });
      },
    },
    {
      kind: "exact",
      path: "/api/collab/router-worker/planning/settings/update",
      handler: async (request, response) => {
        await respond(response, async () => {
          const body = planningSettingsUpdateSchema.parse(
            await readJsonBody(request),
          );
          const actor = actorForRequest(input.team, request, body.workspaceId);
          const settings = await input.planning.updateSettings(
            body.workspaceId,
            actor.id,
            body,
          );
          await input.onSettingsChanged?.(settings);
          return { settings: settingsView(settings) };
        });
      },
    },
    {
      kind: "exact",
      path: "/api/collab/router-worker/planning/start",
      handler: async (request, response) => {
        await respond(response, async () => {
          const body = z
            .object({
              workspaceId: z.string().trim().min(1).max(200),
              rootTaskId: z.string().trim().min(1).max(200),
              expectedTaskRevision: z.string().trim().min(1).max(80),
              mode: planningModeSchema,
              plannerAgentId: z.string().trim().min(1).max(240).optional(),
            })
            .parse(await readJsonBody(request));
          const actor = actorForRequest(input.team, request, body.workspaceId);
          const task = input.tasks.get(body.rootTaskId);
          if (task.workspaceId !== body.workspaceId) {
            throw new PlanningError("forbidden", "主任务不属于当前工作区");
          }
          if (!canStartPlanning(task, actor)) {
            throw new PlanningError(
              "forbidden",
              "只有主任务负责人、任务创建人或工作区负责人可以发起 AI 规划",
            );
          }
          return input.coordinator.start({
            actor,
            workspaceId: body.workspaceId,
            rootTaskId: body.rootTaskId,
            expectedTaskRevision: body.expectedTaskRevision,
            mode: body.mode,
            ...(body.plannerAgentId === undefined
              ? {}
              : { plannerAgentId: body.plannerAgentId }),
          });
        });
      },
    },
    {
      kind: "exact",
      path: "/api/collab/router-worker/planning/status",
      handler: async (request, response) => {
        await respond(response, async () => {
          const runId = z
            .string()
            .trim()
            .min(1)
            .max(320)
            .parse(
              new URL(
                request.url ?? "/",
                "http://dsh.invalid",
              ).searchParams.get("runId"),
            );
          const run = input.planning.getRun(runId);
          actorForRequest(input.team, request, run.workspaceId);
          return input.coordinator.refresh(runId);
        });
      },
    },
    {
      kind: "exact",
      path: "/api/collab/router-worker/planning/basis",
      handler: async (request, response) => {
        await respond(response, () => {
          const runId = z
            .string()
            .trim()
            .min(1)
            .max(320)
            .parse(
              new URL(
                request.url ?? "/",
                "http://dsh.invalid",
              ).searchParams.get("runId"),
            );
          const run = input.planning.getRun(runId);
          actorForRequest(input.team, request, run.workspaceId);
          return input.planning.basis(runId);
        });
      },
    },
    {
      kind: "exact",
      path: "/api/collab/router-worker/planning/cancel",
      handler: async (request, response) => {
        await respond(response, async () => {
          const body = z
            .object({
              runId: z.string().trim().min(1).max(320),
              reason: z.string().trim().min(1).max(1_000).default("用户取消"),
            })
            .parse(await readJsonBody(request));
          const run = input.planning.getRun(body.runId);
          const actor = actorForRequest(input.team, request, run.workspaceId);
          if (actor.role !== "admin" && run.trigger.kind === "human-manual") {
            if (run.trigger.userId !== actor.id) {
              throw new PlanningError(
                "forbidden",
                "只有发起人或工作区管理员可以取消该规划",
              );
            }
          }
          return {
            run: await input.coordinator.cancel(body.runId, body.reason),
          };
        });
      },
    },
  ];
  if (input.scope === "settings") return routes.slice(0, 2);
  if (input.scope === "runtime") return routes.slice(2);
  return routes;
}

export function planningStatusLabel(status: PlanningStatus): string {
  if (status === "queued") return "排队中";
  if (status === "preparing") return "准备上下文";
  if (status === "understanding") return "理解需求";
  if (status === "clarifying") return "等待澄清";
  if (status === "drafting") return "生成计划";
  if (status === "critiquing") return "评审计划";
  if (status === "validating") return "校验计划";
  if (status === "review_required") return "等待人工审核";
  if (status === "succeeded") return "已完成";
  if (status === "failed") return "规划失败";
  return "已取消";
}
