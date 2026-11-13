import { randomUUID } from "node:crypto";
import type { IncomingMessage, ServerResponse } from "node:http";
import { z } from "zod";
import {
  bearerToken,
  readJsonBody,
  sameOrigin,
  sendJson,
} from "@pluginmax/shared";
import {
  RouterWorkerError,
  RouterWorkerPlanService,
  type PermissionLike,
  type PlanActor,
  type RootTaskLike,
  type TaskCreationLike,
  type TaskDispatchLike,
} from "./service.js";
import {
  routerWorkerDomainSpec,
  type AuditEvent,
  type FinalDraft,
  type PlanRecord,
  type RouterCycle,
  type WorkspaceSettings,
} from "./models.js";
import { PlanReconciler } from "./reconciler.js";
import {
  RouterCycleService,
  type RouterCycleDeps,
  type RouterAgentDispatchInput,
} from "./router-cycle.js";

export const name = "dsh-collab-router-worker";
export const inject = ["storageDomain", "webServer", "tools"];

const routerPlanGraphToolSchema = {
  type: "object",
  properties: {
    nodes: {
      type: "array",
      minItems: 1,
      maxItems: 100,
      items: {
        type: "object",
        properties: {
          id: { type: "string" },
          title: { type: "string" },
          description: { type: "string" },
          type: {
            type: "string",
            enum: ["task", "approval", "router"],
          },
          receiverType: {
            type: "string",
            enum: ["unassigned", "human", "agent", "role"],
          },
          receiverId: { type: "string" },
          receiverPrincipalId: { type: "string" },
          receiverName: { type: "string" },
          priority: { type: "string", enum: ["P1", "P2", "P3"] },
          due: { type: "string" },
          acceptance: {
            type: "array",
            minItems: 1,
            maxItems: 30,
            items: { type: "string" },
          },
          dependencies: {
            type: "array",
            maxItems: 100,
            items: { type: "string" },
          },
          reviewMode: {
            type: "string",
            enum: ["none", "agent", "human"],
          },
          maxAttempts: { type: "integer", minimum: 1, maximum: 10 },
          timeoutSeconds: {
            type: "integer",
            minimum: 1,
            maximum: 604800,
          },
        },
        required: [
          "id",
          "title",
          "description",
          "receiverType",
          "priority",
          "acceptance",
          "dependencies",
        ],
        additionalProperties: false,
      },
    },
    startNodeIds: {
      type: "array",
      maxItems: 100,
      items: { type: "string" },
    },
    warnings: {
      type: "array",
      maxItems: 100,
      items: { type: "string" },
    },
  },
  required: ["nodes"],
  additionalProperties: false,
} as const;

const finalDraftToolSchema = {
  type: "object",
  properties: {
    summary: { type: "string" },
    deliverables: {
      type: "array",
      maxItems: 100,
      items: {
        type: "object",
        properties: {
          title: { type: "string" },
          reference: { type: "string" },
        },
        required: ["title"],
        additionalProperties: false,
      },
    },
    risks: {
      type: "array",
      maxItems: 100,
      items: { type: "string" },
    },
    openQuestions: {
      type: "array",
      maxItems: 100,
      items: { type: "string" },
    },
    acceptance: {
      type: "array",
      maxItems: 100,
      items: {
        type: "object",
        properties: {
          criterion: { type: "string" },
          status: {
            type: "string",
            enum: ["covered", "partial", "missing"],
          },
          evidence: { type: "string" },
        },
        required: ["criterion", "status"],
        additionalProperties: false,
      },
    },
  },
  required: ["summary"],
  additionalProperties: false,
} as const;

interface KvTableLike<V> {
  get(key: string): V | undefined;
  entries(): IterableIterator<[string, V]>;
  put(key: string, value: V): Promise<void>;
}

interface RouterWorkerContext {
  storageDomain: {
    open(spec: typeof routerWorkerDomainSpec): Promise<{
      table(name: "workspace_settings"): KvTableLike<WorkspaceSettings>;
      table(name: "audit_events"): KvTableLike<AuditEvent>;
      table(name: "plans"): KvTableLike<import("./models.js").PlanRecord>;
      table(
        name: "plan_versions",
      ): KvTableLike<import("./models.js").PlanVersion>;
      table(name: "node_states"): KvTableLike<import("./models.js").NodeState>;
      table(
        name: "dispatch_bindings",
      ): KvTableLike<import("./models.js").DispatchBinding>;
      table(name: "router_cycles"): KvTableLike<RouterCycle>;
      table(
        name: "router_agents",
      ): KvTableLike<import("./models.js").RouterAgentRegistration>;
      table(name: "final_drafts"): KvTableLike<FinalDraft>;
      close(): Promise<void>;
    }>;
  };
  webServer: {
    register(route: {
      readonly kind: "exact";
      readonly path: string;
      handler(
        request: IncomingMessage,
        response: ServerResponse,
      ): Promise<void> | void;
    }): unknown;
  };
  effect(register: () => () => void): void;
  get(key: string): unknown;
  tools: {
    register(definition: {
      readonly name: string;
      readonly description: string;
      readonly parameters: Record<string, unknown>;
      readonly output: {
        readonly schema: { readonly type: "string" };
        render(
          args: Record<string, unknown>,
          value: string,
        ): Array<{ readonly type: "text"; readonly text: string }>;
      };
      execute(
        args: unknown,
        exec: {
          readonly signal: AbortSignal;
          readonly agent?: {
            readonly session?: { readonly id?: string | undefined };
          };
        },
      ): Promise<string>;
    }): unknown;
  };
  inject(
    keys: readonly ["collabTeam"],
    callback: (
      child: RouterWorkerContext & {
        readonly collabTeam: {
          resolveToken(token: string):
            | {
                readonly userId: string;
                readonly role: "admin" | "owner" | "member" | "guest";
              }
            | undefined;
          members(workspaceId: string): readonly {
            readonly userId: string;
            readonly memberRole?: string;
          }[];
          users(): readonly {
            readonly id: string;
            readonly name: string;
          }[];
        };
      },
    ) => void,
  ): { dispose(): void } | void;
  inject(
    keys: readonly [
      "collabTeam",
      "collabTasks",
      "collabTaskCreation",
      "collabTaskDispatch",
      "collabAgent",
    ],
    callback: (
      child: RouterWorkerContext & {
        readonly collabTeam: {
          resolveToken(token: string):
            | {
                readonly userId: string;
                readonly role: "admin" | "owner" | "member" | "guest";
              }
            | undefined;
          members(workspaceId: string): readonly {
            readonly userId: string;
            readonly memberRole?: string;
          }[];
          users(): readonly { readonly id: string; readonly name: string }[];
        };
        readonly collabTasks: {
          get(taskId: string): RootTaskLike;
          addMessage(
            actor: PlanActor,
            input: {
              readonly taskId: string;
              readonly content: string;
              readonly mentions?: readonly unknown[];
            },
          ): Promise<unknown>;
          recordActivity(
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
        readonly collabTaskCreation: TaskCreationLike;
        readonly collabTaskDispatch: TaskDispatchLike;
        readonly collabAgent: {
        dispatch(input: RouterAgentDispatchInput): Promise<{
          readonly id: string;
          readonly status: string;
          readonly sessionId?: string | undefined;
        }>;
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
        createRuntimeProfile(
          actor: {
            readonly kind: "user";
            readonly id: string;
            readonly name?: string | undefined;
            readonly globalRole?:
              | "admin"
              | "owner"
              | "member"
              | "guest"
              | undefined;
            readonly workspaceRole?:
              | "owner"
              | "member"
              | "guest"
              | undefined;
            readonly workspaceId?: string | undefined;
          },
          input: {
            readonly workspaceId: string;
            readonly id?: string | undefined;
            readonly name: string;
            readonly description?: string | undefined;
            readonly personaId?: string | undefined;
            readonly execution?: "builtin" | "external" | undefined;
            readonly externalRuntimeId?: string | undefined;
            readonly runtimeKind?:
              | "task-worker"
              | "continuable-session"
              | "connector"
              | undefined;
            readonly defaultModel?:
              | {
                  readonly provider: string;
                  readonly model: string;
                  readonly reasoningEffort?: string | undefined;
                }
              | undefined;
            readonly allowedTools?: readonly string[] | undefined;
            readonly visibility?: "workspace" | "platform" | undefined;
          },
        ): Promise<{
          readonly id: string;
          readonly name: string;
          readonly description: string;
          readonly ownerUserId: string;
          readonly execution?: "builtin" | "external" | undefined;
          readonly status: "active" | "disabled";
        }>;
        run(runId: string):
          | {
              readonly id: string;
              readonly instanceId: string;
              readonly status: string;
              readonly sessionId?: string | undefined;
              readonly createdBy: string;
            }
          | undefined;
        runs(): readonly {
          readonly id: string;
          readonly instanceId: string;
          readonly sessionId?: string | undefined;
          readonly createdBy: string;
          readonly status: string;
        }[];
      };
      },
    ) => void,
  ): { dispose(): void } | void;
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
  team: {
    resolveToken(token: string):
      | {
          readonly userId: string;
          readonly role: "admin" | "owner" | "member" | "guest";
        }
      | undefined;
    members(workspaceId: string): readonly {
      readonly userId: string;
      readonly memberRole?: string;
    }[];
    users(): readonly { readonly id: string; readonly name: string }[];
  },
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
    role: principal.role,
  };
}

function workflowActorForRequest(
  team: Parameters<typeof actorForRequest>[0],
  request: IncomingMessage,
  workspaceId: string,
) {
  const actor = actorForRequest(team, request, workspaceId);
  const member = team
    .members(workspaceId)
    .find((candidate) => candidate.userId === actor.id);
  return {
    kind: "user" as const,
    id: actor.id,
    name: actor.name,
    globalRole: actor.role,
    ...(member?.memberRole === undefined
      ? {}
      : { workspaceRole: member.memberRole }),
  };
}

function settingsFor(
  workspaceId: string,
  record: WorkspaceSettings | undefined,
): WorkspaceSettings {
  return (
    record ?? {
      workspaceId,
      enabled: false,
      revision: 0,
      updatedAt: "1970-01-01T00:00:00.000Z",
      updatedBy: "system",
    }
  );
}

function planGraphFromWorkflow(definition: {
  readonly graph: {
    readonly nodes: readonly {
      readonly id: string;
      readonly name: string;
      readonly description?: string;
      readonly executor: {
        readonly kind: "system" | "user" | "agent" | "employee" | "role";
        readonly id: string;
        readonly label?: string;
      };
      readonly deliverables?: readonly { readonly title: string }[];
      readonly timeoutMs?: number;
    }[];
    readonly edges: readonly {
      readonly from: string;
      readonly to: string;
    }[];
  };
}): unknown {
  return {
    nodes: definition.graph.nodes.map((node) => ({
      id: node.id,
      title: node.name,
      description: node.description?.trim() || `执行工作流节点：${node.name}`,
      type: "task",
      receiverType:
        node.executor.kind === "user"
          ? "human"
          : node.executor.kind === "agent" || node.executor.kind === "employee"
            ? "agent"
            : node.executor.kind === "role"
              ? "role"
              : "unassigned",
      ...(node.executor.kind === "system"
        ? {}
        : {
            receiverId: node.executor.id,
            ...(node.executor.label === undefined
              ? {}
              : { receiverName: node.executor.label }),
          }),
      priority: "P2",
      acceptance:
        node.deliverables?.map((item) => item.title).filter(Boolean) ?? [
          `完成：${node.name}`,
        ],
      dependencies: definition.graph.edges
        .filter((edge) => edge.to === node.id)
        .map((edge) => edge.from),
      reviewMode: "human",
      maxAttempts: 2,
      timeoutSeconds: Math.max(
        1,
        Math.ceil((node.timeoutMs ?? 86_400_000) / 1_000),
      ),
    })),
  };
}

export async function apply(ctx: RouterWorkerContext): Promise<void> {
  const domain = await ctx.storageDomain.open(routerWorkerDomainSpec);
  const settings = domain.table("workspace_settings");
  const audit = domain.table("audit_events");
  let stopReconciler: (() => void) | undefined;
  let pauseWorkspacePlans:
    | ((workspaceId: string) => Promise<void>)
    | undefined;
  ctx.effect(() => () => void domain.close());
  ctx.effect(() => () => stopReconciler?.());

  ctx.inject(["collabTeam"], (child) => {
    const actorFor = (request: IncomingMessage, workspaceId: string) => {
      sameOriginRequest(request);
      const principal = child.collabTeam.resolveToken(bearer(request));
      if (principal === undefined) throw new Error("invalid bearer token");
      const member = child.collabTeam
        .members(workspaceId)
        .find((candidate) => candidate.userId === principal.userId);
      if (member === undefined && principal.role !== "admin") {
        throw new Error("workspace member is required");
      }
      return {
        userId: principal.userId,
        name:
          child.collabTeam.users().find((user) => user.id === principal.userId)
            ?.name ?? principal.userId,
        role: principal.role,
      };
    };

    const getSettings = (
      request: IncomingMessage,
      response: ServerResponse,
    ) => {
      try {
        const workspaceId = queryWorkspace(request);
        actorFor(request, workspaceId);
        sendJson(response, 200, {
          ok: true,
          settings: settingsFor(workspaceId, settings.get(workspaceId)),
        });
      } catch (cause) {
        sendJson(response, 400, {
          ok: false,
          error: cause instanceof Error ? cause.message : "settings failed",
        });
      }
    };

    child.webServer.register({
      kind: "exact",
      path: "/api/collab/router-worker/settings",
      handler: getSettings,
    });
    child.webServer.register({
      kind: "exact",
      path: "/api/collab/router-worker/settings/update",
      handler: async (request, response) => {
        try {
          sameOriginRequest(request);
          const parsed = z
            .object({
              workspaceId: z.string().trim().min(1).max(200),
              enabled: z.boolean(),
              defaultRouterAgentId: z
                .string()
                .trim()
                .min(1)
                .max(240)
                .nullable()
                .optional(),
              expectedRevision: z.number().int().nonnegative().optional(),
            })
            .parse(await readJsonBody(request));
          const actor = actorFor(request, parsed.workspaceId);
          const current = settingsFor(
            parsed.workspaceId,
            settings.get(parsed.workspaceId),
          );
          if (
            parsed.expectedRevision !== undefined &&
            parsed.expectedRevision !== current.revision
          ) {
            sendJson(response, 409, {
              ok: false,
              error: "settings revision conflict",
              settings: current,
            });
            return;
          }
          const at = new Date().toISOString();
          const defaultRouterAgentId =
            parsed.defaultRouterAgentId === undefined
              ? current.defaultRouterAgentId
              : (parsed.defaultRouterAgentId ?? undefined);
          const next: WorkspaceSettings = {
            workspaceId: parsed.workspaceId,
            enabled: parsed.enabled,
            ...(defaultRouterAgentId === undefined
              ? {}
              : { defaultRouterAgentId }),
            revision: current.revision + 1,
            updatedAt: at,
            updatedBy: actor.userId,
          };
          await settings.put(next.workspaceId, next);
          if (!next.enabled) {
            stopReconciler?.();
            await pauseWorkspacePlans?.(next.workspaceId);
          }
          const auditId = `${at}:${randomUUID()}`;
          await audit.put(auditId, {
            id: auditId,
            workspaceId: next.workspaceId,
            action: "router_worker.settings.updated",
            actorId: actor.userId,
            revision: next.revision,
            at,
            detail: {
              enabled: String(next.enabled),
              defaultRouterAgentId: next.defaultRouterAgentId ?? "",
            },
          });
          sendJson(response, 200, { ok: true, settings: next });
        } catch (cause) {
          sendJson(response, 400, {
            ok: false,
            error:
              cause instanceof Error ? cause.message : "settings update failed",
          });
        }
      },
    });
  });

  ctx.inject(
    [
      "collabTeam",
      "collabTasks",
      "collabTaskCreation",
      "collabTaskDispatch",
      "collabAgent",
    ],
    (child) => {
      const plans = new RouterWorkerPlanService(
        {
          plans: domain.table("plans"),
          versions: domain.table("plan_versions"),
          nodes: domain.table("node_states"),
          bindings: domain.table("dispatch_bindings"),
          drafts: domain.table("final_drafts"),
        },
        {
          tasks: () => child.collabTasks,
          taskCreation: () => child.collabTaskCreation,
          taskDispatch: () => child.collabTaskDispatch,
          permission: () =>
            child.get("collabPermission") as PermissionLike | undefined,
          enabled: (workspaceId) =>
            settingsFor(workspaceId, settings.get(workspaceId)).enabled,
        },
      );
      const cycles = new RouterCycleService(
        domain.table("router_cycles"),
        domain.table("router_agents"),
        {
        team: child.collabTeam,
        tasks: () => child.collabTasks,
        agent: () => child.collabAgent,
        teammates: () =>
          child.get("collabTeammateRuntime") as ReturnType<
            RouterCycleDeps["teammates"]
          >,
        teammateService: () =>
          child.get("collabTeammates") as ReturnType<
            RouterCycleDeps["teammateService"]
          >,
        teammateTemplates: () =>
          child.get("collabTeammateTemplates") as ReturnType<
            RouterCycleDeps["teammateTemplates"]
          >,
        principalRuntime: () =>
          child.get("collabPrincipalRuntime") as ReturnType<
            RouterCycleDeps["principalRuntime"]
          >,
        workspaces: () =>
          child.get("workspaceRegistry") as
            | {
                get(
                  workspaceId: string,
                ): { readonly path?: string | undefined } | undefined;
              }
            | undefined,
        enabled: (workspaceId) =>
          settingsFor(workspaceId, settings.get(workspaceId)).enabled,
        defaultRouterAgentId: (workspaceId) =>
          settingsFor(workspaceId, settings.get(workspaceId))
            .defaultRouterAgentId,
        },
      );
      const ensureFinalization = async (plan: PlanRecord) => {
        if (plan.finalDraftId !== undefined) return;
        const detail = plans.detail(plan.id);
        try {
          await cycles.start({
            actor: {
              id: plan.createdBy,
              name: plan.createdBy,
              kind: "human",
              role: "member",
            },
            rootTaskId: plan.rootTaskId,
            planner: "final",
            trigger: "all_required_accepted",
            plan: {
              plan: detail.plan,
              graph: detail.version.graph,
              nodeStates: detail.nodeStates,
            },
          });
        } catch (cause) {
          if (
            !(cause instanceof RouterWorkerError) ||
            cause.code !== "conflict"
          ) {
            throw cause;
          }
        }
      };
      const reconciler = new PlanReconciler(
        plans,
        15_000,
        ensureFinalization,
      );
      stopReconciler = () => reconciler.stop();
      pauseWorkspacePlans = (workspaceId) => plans.pauseWorkspace(workspaceId);

      const actorForUser = (
        userId: string,
        workspaceId: string,
      ): PlanActor => {
        const user = child.collabTeam
          .users()
          .find((candidate) => candidate.id === userId);
        const member = child.collabTeam
          .members(workspaceId)
          .find((candidate) => candidate.userId === userId);
        const globalRole = (
          user as { readonly role?: string } | undefined
        )?.role;
        return {
          id: userId,
          name: user?.name ?? userId,
          kind: "human",
          role:
            globalRole === "admin" || globalRole === "owner"
              ? globalRole
              : member?.memberRole === "owner"
                ? "owner"
                : member?.memberRole === "guest"
                  ? "guest"
                  : "member",
        };
      };

      child.tools.register({
        name: "router_worker_submit_plan",
        description:
          "Submit a structured Router Plan Draft for the current Router task. This tool only saves a draft; it cannot approve, dispatch, or complete tasks.",
        parameters: {
          type: "object",
          properties: {
            graph: routerPlanGraphToolSchema,
            rationale: { type: "string" },
          },
          required: ["graph"],
          additionalProperties: false,
        },
        output: {
          schema: { type: "string" },
          render: (_args, value) => [{ type: "text", text: value }],
        },
        execute: async (args, exec) => {
          const parsed = z
            .object({
              graph: z.unknown(),
              rationale: z.string().trim().max(2_000).optional(),
            })
            .parse(args);
          const sessionId = exec.agent?.session?.id;
          if (sessionId === undefined) {
            throw new RouterWorkerError(
              "forbidden",
              "Router tool requires an active Agent session",
            );
          }
          const cycle = cycles.findBySessionId(sessionId);
          if (
            cycle === undefined ||
            !["plan", "replan"].includes(cycle.kind)
          ) {
            throw new RouterWorkerError(
              "forbidden",
              "当前会话不是已登记的 Router 规划 Cycle",
            );
          }
          let stage = "resolve-actor";
          try {
            const planActor = actorForUser(
              cycle.createdBy,
              cycle.workspaceId,
            );
            stage = "find-existing-plan";
            const existing = plans.findByRoot(
              cycle.workspaceId,
              cycle.rootTaskId,
            );
            if (existing === undefined) {
              stage = "save-create";
              const created = await plans.saveCreate(planActor, {
                workspaceId: cycle.workspaceId,
                rootTaskId: cycle.rootTaskId,
                source: "router",
                routerAgentId: cycle.routerAgentId,
                settings: { routerAgentId: cycle.routerAgentId },
                graph: parsed.graph,
              });
              stage = "mark-submitted";
              await cycles.markSubmitted(cycle.id, sessionId);
              return `Plan Draft ${created.plan.rootTaskId} v${created.version.version} saved.`;
            }
            if (
              existing.source !== "router" &&
              cycle.allowSourceReplacement !== true
            ) {
              throw new RouterWorkerError(
                "conflict",
                "当前主任务已有非 Router 计划，不能由 Router 覆盖",
              );
            }
            stage = "save-version";
            const saved = await plans.saveVersion(planActor, {
              planId: existing.id,
              expectedRevision: existing.revision,
              graph: parsed.graph,
              settings: {
                ...existing.settings,
                routerAgentId: cycle.routerAgentId,
              },
              source: "router",
              replaceExisting: cycle.allowSourceReplacement === true,
              reason: parsed.rationale ?? "Router 重新规划",
            });
            stage = "mark-submitted";
            await cycles.markSubmitted(cycle.id, sessionId);
            return `Plan Draft ${saved.plan.rootTaskId} v${saved.version.version} saved.`;
          } catch (cause) {
            const detail =
              cause instanceof Error ? cause.message : String(cause);
            throw new RouterWorkerError(
              "invalid_input",
              `Router Plan 提交在 ${stage} 阶段失败：${detail}`,
            );
          }
        },
      });

      child.tools.register({
        name: "router_worker_submit_final_draft",
        description:
          "Submit the structured final delivery draft for the current Router finalization cycle. This tool cannot approve reviews or complete the master task.",
        parameters: {
          type: "object",
          properties: {
            draft: finalDraftToolSchema,
          },
          required: ["draft"],
          additionalProperties: false,
        },
        output: {
          schema: { type: "string" },
          render: (_args, value) => [{ type: "text", text: value }],
        },
        execute: async (args, exec) => {
          const parsed = z
            .object({
              draft: z.unknown(),
            })
            .parse(args);
          const sessionId = exec.agent?.session?.id;
          if (sessionId === undefined) {
            throw new RouterWorkerError(
              "forbidden",
              "Router finalization requires an active Agent session",
            );
          }
          const cycle = cycles.findBySessionId(sessionId);
          if (
            cycle === undefined ||
            cycle.kind !== "finalize" ||
            cycle.planId === undefined
          ) {
            throw new RouterWorkerError(
              "forbidden",
              "当前会话不是已登记的 Router 最终汇总 Cycle",
            );
          }
          const actor = actorForUser(cycle.createdBy, cycle.workspaceId);
          const result = await plans.saveFinalDraft(actor, {
            planId: cycle.planId,
            routerAgentId: cycle.routerAgentId,
            draft: parsed.draft,
          });
          await cycles.markSubmitted(cycle.id, sessionId);
          return `Final draft ${result.finalDraft.id} saved for ${result.plan.rootTaskId}.`;
        },
      });

      const respond = async (
        request: IncomingMessage,
        response: ServerResponse,
        operation: () => Promise<unknown> | unknown,
      ) => {
        try {
          sendJson(response, 200, { ok: true, result: await operation() });
        } catch (cause) {
          const error =
            cause instanceof Error ? cause.message : "request failed";
          const status =
            cause instanceof RouterWorkerError
              ? cause.code === "gate_closed"
                ? 409
                : cause.code === "forbidden"
                  ? 403
                  : cause.code === "not_found"
                    ? 404
                    : cause.code === "conflict"
                      ? 409
                      : 400
              : 400;
          sendJson(response, status, { ok: false, error });
        }
      };

      child.webServer.register({
        kind: "exact",
        path: "/api/collab/router-worker/router-agents",
        handler: async (request, response) => {
          await respond(request, response, async () => {
            const workspaceId = queryWorkspace(request);
            const actor = actorForRequest(
              child.collabTeam,
              request,
              workspaceId,
            );
            const current = settingsFor(
              workspaceId,
              settings.get(workspaceId),
            );
            const agents = await cycles.candidateRouterAgents(
              actor,
              workspaceId,
            );
            const defaultRouterAgentId = agents.some(
              (agent) => agent.id === current.defaultRouterAgentId,
            )
              ? current.defaultRouterAgentId
              : agents[0]?.id;
            if (
              defaultRouterAgentId !== undefined &&
              defaultRouterAgentId !== current.defaultRouterAgentId
            ) {
              const at = new Date().toISOString();
              await settings.put(workspaceId, {
                ...current,
                defaultRouterAgentId,
                revision: current.revision + 1,
                updatedAt: at,
                updatedBy: actor.id,
              });
            }
            return {
              defaultRouterAgentId: defaultRouterAgentId ?? null,
              agents: agents.map((agent) => ({
                ...agent,
                isDefault: agent.id === defaultRouterAgentId,
              })),
            };
          });
        },
      });

      child.webServer.register({
        kind: "exact",
        path: "/api/collab/router-worker/router-agents/register",
        handler: async (request, response) => {
          await respond(request, response, async () => {
            const body = z
              .object({
                workspaceId: z.string().trim().min(1).max(200),
                profileId: z.string().trim().min(1).max(160),
                domain: z.string().trim().min(1).max(80).default("general"),
              })
              .parse(await readJsonBody(request));
            const actor = actorForRequest(
              child.collabTeam,
              request,
              body.workspaceId,
            );
            const member = child.collabTeam
              .members(body.workspaceId)
              .find((candidate) => candidate.userId === actor.id);
            if (
              actor.role !== "admin" &&
              actor.role !== "owner" &&
              member?.memberRole !== "owner"
            ) {
              throw new RouterWorkerError(
                "forbidden",
                "只有 Workspace 管理员或项目负责人可以登记 Router Agent",
              );
            }
            return cycles.registerRouterAgent(
              actor,
              body.workspaceId,
              body.profileId,
              body.domain,
            );
          });
        },
      });

      child.webServer.register({
        kind: "exact",
        path: "/api/collab/router-worker/plans/router/start",
        handler: async (request, response) => {
          await respond(request, response, async () => {
            const body = z
              .object({
                workspaceId: z.string().trim().min(1).max(200),
                rootTaskId: z.string().trim().min(1).max(200),
                routerAgentId: z.string().trim().min(1).max(240).optional(),
              })
              .parse(await readJsonBody(request));
            const actor = actorForRequest(
              child.collabTeam,
              request,
              body.workspaceId,
            );
            const task = child.collabTasks.get(body.rootTaskId);
            if (task.workspaceId !== body.workspaceId) {
              throw new RouterWorkerError(
                "forbidden",
                "主任务不属于当前项目",
              );
            }
            if (plans.findByRoot(body.workspaceId, body.rootTaskId) !== undefined) {
              throw new RouterWorkerError("conflict", "该任务已有执行计划");
            }
            return cycles.start({
              actor,
              rootTaskId: body.rootTaskId,
              planner: "plan",
              ...(!body.routerAgentId
                ? {}
                : { routerAgentId: body.routerAgentId }),
              trigger: "manual",
            });
          });
        },
      });

      child.webServer.register({
        kind: "exact",
        path: "/api/collab/router-worker/plans/router/status",
        handler: async (request, response) => {
          await respond(request, response, async () => {
            const cycleId = new URL(
              request.url ?? "/",
              "http://dsh.invalid",
            ).searchParams.get("cycleId");
            if (cycleId === null || cycleId === "") {
              throw new RouterWorkerError(
                "invalid_input",
                "cycleId is required",
              );
            }
            const current = cycles.get(cycleId);
            actorForRequest(child.collabTeam, request, current.workspaceId);
            const cycle = await cycles.refresh(cycleId);
            const runStatus =
              cycle.runId === undefined
                ? undefined
                : child.collabAgent.run(cycle.runId)?.status;
            return {
              ...cycle,
              ...(runStatus === undefined ? {} : { runStatus }),
            };
          });
        },
      });

      child.webServer.register({
        kind: "exact",
        path: "/api/collab/router-worker/plans/from-template",
        handler: async (request, response) => {
          await respond(request, response, async () => {
            const body = z
              .object({
                workspaceId: z.string().trim().min(1).max(200),
                rootTaskId: z.string().trim().min(1).max(200),
                definitionId: z.string().trim().min(1).max(200),
                title: z.string().trim().min(1).max(160).optional(),
              })
              .parse(await readJsonBody(request));
            const actor = actorForRequest(
              child.collabTeam,
              request,
              body.workspaceId,
            );
            const workflowActor = workflowActorForRequest(
              child.collabTeam,
              request,
              body.workspaceId,
            );
            const workflow = child.get("collabWorkflow") as
              | {
                  definition(id: string):
                    | {
                        readonly graph: {
                          readonly nodes: readonly unknown[];
                          readonly edges: readonly unknown[];
                        };
                      }
                    | undefined;
                  startInstance(
                    actor: ReturnType<typeof workflowActorForRequest>,
                    input: {
                      readonly workspaceId: string;
                      readonly definitionId: string;
                      readonly title: string;
                    },
                  ): Promise<{ readonly id: string }>;
                }
              | undefined;
            if (workflow === undefined) {
              throw new RouterWorkerError(
                "conflict",
                "Workflow 服务不可用",
              );
            }
            const definition = workflow.definition(body.definitionId);
            if (definition === undefined) {
              throw new RouterWorkerError("not_found", "工作流模板不存在");
            }
            const instance = await workflow.startInstance(workflowActor, {
              workspaceId: body.workspaceId,
              definitionId: body.definitionId,
              title: body.title ?? "执行计划模板实例",
            });
            return plans.saveCreate(actor, {
              workspaceId: body.workspaceId,
              rootTaskId: body.rootTaskId,
              source: "template",
              templateInstanceId: instance.id,
              graph: planGraphFromWorkflow(
                definition as Parameters<typeof planGraphFromWorkflow>[0],
              ),
            });
          });
        },
      });

      child.webServer.register({
        kind: "exact",
        path: "/api/collab/router-worker/plans/regenerate/template",
        handler: async (request, response) => {
          await respond(request, response, async () => {
            const body = z
              .object({
                workspaceId: z.string().trim().min(1).max(200),
                rootTaskId: z.string().trim().min(1).max(200),
                definitionId: z.string().trim().min(1).max(200),
              })
              .parse(await readJsonBody(request));
            const actor = actorForRequest(
              child.collabTeam,
              request,
              body.workspaceId,
            );
            const workflowActor = workflowActorForRequest(
              child.collabTeam,
              request,
              body.workspaceId,
            );
            const existing = plans.findByRoot(
              body.workspaceId,
              body.rootTaskId,
            );
            if (existing === undefined) {
              throw new RouterWorkerError(
                "not_found",
                "当前任务尚无任务规划，不能执行重新生成",
              );
            }
            const workflow = child.get("collabWorkflow") as
              | {
                  definition(id: string):
                    | {
                        readonly graph: {
                          readonly nodes: readonly unknown[];
                          readonly edges: readonly unknown[];
                        };
                      }
                    | undefined;
                  startInstance(
                    actor: ReturnType<typeof workflowActorForRequest>,
                    input: {
                      readonly workspaceId: string;
                      readonly definitionId: string;
                      readonly title: string;
                    },
                  ): Promise<{ readonly id: string }>;
                }
              | undefined;
            if (workflow === undefined) {
              throw new RouterWorkerError("conflict", "Workflow 服务不可用");
            }
            const definition = workflow.definition(body.definitionId);
            if (definition === undefined) {
              throw new RouterWorkerError("not_found", "工作流模板不存在");
            }
            const instance = await workflow.startInstance(workflowActor, {
              workspaceId: body.workspaceId,
              definitionId: body.definitionId,
              title: `${existing.title} · 重新生成`,
            });
            return plans.saveVersion(actor, {
              planId: existing.id,
              expectedRevision: existing.revision,
              graph: planGraphFromWorkflow(
                definition as Parameters<typeof planGraphFromWorkflow>[0],
              ),
              source: "template",
              templateInstanceId: instance.id,
              replaceExisting: true,
              reason: "按工作流模板重新生成任务规划",
            });
          });
        },
      });

      child.webServer.register({
        kind: "exact",
        path: "/api/collab/router-worker/plans/regenerate/router",
        handler: async (request, response) => {
          await respond(request, response, async () => {
            const body = z
              .object({
                workspaceId: z.string().trim().min(1).max(200),
                rootTaskId: z.string().trim().min(1).max(200),
                routerAgentId: z.string().trim().min(1).max(240).optional(),
              })
              .parse(await readJsonBody(request));
            const actor = actorForRequest(
              child.collabTeam,
              request,
              body.workspaceId,
            );
            const existing = plans.findByRoot(
              body.workspaceId,
              body.rootTaskId,
            );
            if (existing === undefined) {
              throw new RouterWorkerError(
                "not_found",
                "当前任务尚无任务规划，不能执行重新生成",
              );
            }
            const detail = plans.detail(existing.id);
            return cycles.start({
              actor,
              rootTaskId: body.rootTaskId,
              planner: "plan",
              ...(body.routerAgentId === undefined
                ? {}
                : { routerAgentId: body.routerAgentId }),
              trigger: "replan",
              allowSourceReplacement: true,
              plan: {
                plan: detail.plan,
                graph: detail.version.graph,
                nodeStates: detail.nodeStates.map((state) => ({
                  nodeId: state.nodeId,
                  status: state.status,
                  ...(state.taskId === undefined
                    ? {}
                    : { taskId: state.taskId }),
                  ...(state.lastError === undefined
                    ? {}
                    : { lastError: state.lastError }),
                })),
              },
            });
          });
        },
      });

      child.webServer.register({
        kind: "exact",
        path: "/api/collab/router-worker/plans/root",
        handler: async (request, response) => {
          await respond(request, response, async () => {
            const params = new URL(request.url ?? "/", "http://dsh.invalid")
              .searchParams;
            const workspaceId = z
              .string()
              .trim()
              .min(1)
              .max(200)
              .parse(params.get("workspaceId"));
            const rootTaskId = z
              .string()
              .trim()
              .min(1)
              .max(200)
              .parse(params.get("rootTaskId"));
            const actor = actorForRequest(
              child.collabTeam,
              request,
              workspaceId,
            );
            const plan = plans.findByRoot(workspaceId, rootTaskId);
            if (plan === undefined) {
              return {
                plan: null,
                version: null,
                nodeStates: [],
                bindings: [],
              };
            }
            // Heal draft plans created before pending-review tracking existed.
            await plans.ensurePendingReview(
              plan.id,
              actorForUser(plan.createdBy, plan.workspaceId),
            );
            await plans.syncDispatchActivity(
              plan.id,
              actorForUser(plan.createdBy, plan.workspaceId),
            );
            const detail = plans.detail(plan.id);
            return {
              ...detail,
              permissions: {
                canManage: plans.canManage(detail.plan, actor),
              },
            };
          });
        },
      });

      child.webServer.register({
        kind: "exact",
        path: "/api/collab/router-worker/plans/detail",
        handler: async (request, response) => {
          await respond(request, response, async () => {
            const planId = new URL(
              request.url ?? "/",
              "http://dsh.invalid",
            ).searchParams.get("planId");
            if (planId === null || planId === "") {
              throw new RouterWorkerError(
                "invalid_input",
                "planId is required",
              );
            }
            const detail = plans.detail(planId);
            const actor = actorForRequest(
              child.collabTeam,
              request,
              detail.plan.workspaceId,
            );
            await plans.ensurePendingReview(
              detail.plan.id,
              actorForUser(detail.plan.createdBy, detail.plan.workspaceId),
            );
            await plans.syncDispatchActivity(
              detail.plan.id,
              actorForUser(detail.plan.createdBy, detail.plan.workspaceId),
            );
            return {
              ...detail,
              permissions: {
                canManage: plans.canManage(detail.plan, actor),
              },
            };
          });
        },
      });

      child.webServer.register({
        kind: "exact",
        path: "/api/collab/router-worker/plans/create",
        handler: async (request, response) => {
          await respond(request, response, async () => {
            const body = z
              .object({
                workspaceId: z.string().trim().min(1).max(200),
                rootTaskId: z.string().trim().min(1).max(200),
                source: z.enum(["manual", "router", "template"]).optional(),
                routerAgentId: z.string().trim().min(1).max(240).optional(),
                graph: z.unknown(),
                settings: z.unknown().optional(),
              })
              .parse(await readJsonBody(request));
            const actor = actorForRequest(
              child.collabTeam,
              request,
              body.workspaceId,
            );
            const result = await plans.saveCreate(actor, body);
            await audit.put(`${result.plan.id}:created`, {
              id: `${result.plan.id}:created`,
              workspaceId: body.workspaceId,
              planId: result.plan.id,
              action: "router_worker.plan.created",
              actorId: actor.id,
              revision: result.plan.revision,
              at: result.plan.createdAt,
              detail: { version: String(result.version.version) },
            });
            return result;
          });
        },
      });

      child.webServer.register({
        kind: "exact",
        path: "/api/collab/router-worker/plans/save",
        handler: async (request, response) => {
          await respond(request, response, async () => {
            const body = z
              .object({
                planId: z.string().trim().min(1).max(200),
                expectedRevision: z.number().int().nonnegative(),
                graph: z.unknown(),
                settings: z.unknown().optional(),
                reason: z.string().trim().max(2_000).optional(),
              })
              .parse(await readJsonBody(request));
            const detail = plans.detail(body.planId);
            const actor = actorForRequest(
              child.collabTeam,
              request,
              detail.plan.workspaceId,
            );
            return plans.saveVersion(actor, body);
          });
        },
      });

      child.webServer.register({
        kind: "exact",
        path: "/api/collab/router-worker/plans/validate",
        handler: async (request, response) => {
          await respond(request, response, async () => {
            const body = z
              .object({ planId: z.string().trim().min(1).max(200) })
              .parse(await readJsonBody(request));
            const detail = plans.detail(body.planId);
            actorForRequest(child.collabTeam, request, detail.plan.workspaceId);
            return plans.validate(body.planId);
          });
        },
      });

      child.webServer.register({
        kind: "exact",
        path: "/api/collab/router-worker/plans/approve",
        handler: async (request, response) => {
          await respond(request, response, async () => {
            const body = z
              .object({
                planId: z.string().trim().min(1).max(200),
                expectedRevision: z.number().int().nonnegative(),
              })
              .parse(await readJsonBody(request));
            const detail = plans.detail(body.planId);
            const actor = actorForRequest(
              child.collabTeam,
              request,
              detail.plan.workspaceId,
            );
            return plans.approve(actor, body);
          });
        },
      });

      child.webServer.register({
        kind: "exact",
        path: "/api/collab/router-worker/plans/materialize",
        handler: async (request, response) => {
          await respond(request, response, async () => {
            const body = z
              .object({ planId: z.string().trim().min(1).max(200) })
              .parse(await readJsonBody(request));
            const detail = plans.detail(body.planId);
            const actor = actorForRequest(
              child.collabTeam,
              request,
              detail.plan.workspaceId,
            );
            const result = await plans.materialize(actor, body.planId);
            reconciler.start();
            return result;
          });
        },
      });

      child.webServer.register({
        kind: "exact",
        path: "/api/collab/router-worker/plans/nodes/ensure-task",
        handler: async (request, response) => {
          await respond(request, response, async () => {
            const body = z
              .object({
                planId: z.string().trim().min(1).max(200),
                nodeId: z.string().trim().min(1).max(120),
              })
              .parse(await readJsonBody(request));
            const detail = plans.detail(body.planId);
            const actor = actorForRequest(
              child.collabTeam,
              request,
              detail.plan.workspaceId,
            );
            return plans.ensureNodeTask(actor, body);
          });
        },
      });

      child.webServer.register({
        kind: "exact",
        path: "/api/collab/router-worker/plans/pause",
        handler: async (request, response) => {
          await respond(request, response, async () => {
            const body = z
              .object({ planId: z.string().trim().min(1).max(200) })
              .parse(await readJsonBody(request));
            const detail = plans.detail(body.planId);
            const actor = actorForRequest(
              child.collabTeam,
              request,
              detail.plan.workspaceId,
            );
            return plans.pause(actor, body.planId);
          });
        },
      });

      child.webServer.register({
        kind: "exact",
        path: "/api/collab/router-worker/plans/resume",
        handler: async (request, response) => {
          await respond(request, response, async () => {
            const body = z
              .object({ planId: z.string().trim().min(1).max(200) })
              .parse(await readJsonBody(request));
            const detail = plans.detail(body.planId);
            const actor = actorForRequest(
              child.collabTeam,
              request,
              detail.plan.workspaceId,
            );
            const plan = await plans.resume(actor, body.planId);
            reconciler.start();
            return plan;
          });
        },
      });

      child.webServer.register({
        kind: "exact",
        path: "/api/collab/router-worker/plans/cancel",
        handler: async (request, response) => {
          await respond(request, response, async () => {
            const body = z
              .object({ planId: z.string().trim().min(1).max(200) })
              .parse(await readJsonBody(request));
            const detail = plans.detail(body.planId);
            const actor = actorForRequest(
              child.collabTeam,
              request,
              detail.plan.workspaceId,
            );
            const plan = await plans.cancel(actor, body.planId);
            if (plans.activePlans().length === 0) reconciler.stop();
            return plan;
          });
        },
      });
    },
  );
}
