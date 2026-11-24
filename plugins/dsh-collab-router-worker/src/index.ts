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
import {
  planningDomainSpec,
  type FactsLedger,
  type PlanCriticReport,
  type PlanningEvent,
  type PlanningKnowledgeReceipt,
  type PlanningQualityMetric,
  type PlanningRun,
  type PlanningSettings,
  type PlanningSkillSnapshot,
  type PlanningTriggerReceipt,
  type RequirementBrief,
} from "./planning/models.js";
import { PlanningService } from "./planning/service.js";
import {
  ManualPlanningCoordinator,
  type ManualPlanningCoordinatorDeps,
} from "./planning/manual-planning.js";
import { createPlanningRoutes } from "./planning/api.js";
import {
  planningRequirementBriefInputSchema,
  planningUnderstandingToolInputSchema,
} from "./planning/requirement-brief.js";
import { planningFactsLedgerInputSchema } from "./planning/facts-ledger.js";
import { PlanningDispatchReadinessGate } from "./planning/readiness-gate.js";
import { automaticPlanningTrigger } from "./planning/trigger-policy.js";
import { planningPlanCriticInputSchema } from "./planning/plan-critic.js";
import { evaluatePlanningQuality } from "./planning/quality-gate.js";

export const name = "dsh-collab-router-worker";
export const inject = ["storageDomain", "webServer", "tools"];
export type {
  PlanningKnowledgeContribution,
  PlanningKnowledgeProvider,
} from "./planning/knowledge-provider.js";
export type {
  PlanningRun,
  PlanningSettings,
  PlanningStatus,
  PlanningTrigger,
} from "./planning/models.js";

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
          risk: {
            type: "string",
            enum: ["low", "medium", "high", "irreversible"],
          },
          humanGate: {
            type: "string",
            enum: ["none", "before_start", "before_complete"],
          },
          evidenceRequirements: {
            type: "array",
            items: { type: "string" },
          },
          rationale: { type: "string" },
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

const planningSourceRefToolSchema = {
  type: "object",
  properties: {
    type: {
      type: "string",
      enum: [
        "task",
        "meeting",
        "minute-version",
        "workflow",
        "document",
        "chat",
        "task-comment",
        "human-edit",
        "workflow_node",
        "metric_card",
        "chart",
        "media",
        "text",
      ],
    },
    id: { type: "string" },
    version: { type: "string" },
    quote: { type: "string" },
    href: { type: "string" },
  },
  required: ["type", "id"],
  additionalProperties: false,
} as const;

const planningBriefToolSchema = {
  type: "object",
  properties: {
    originalRequest: { type: "string" },
    interpretedGoal: { type: "string" },
    deliverables: {
      type: "array",
      items: {
        type: "object",
        properties: {
          title: { type: "string" },
          description: { type: "string" },
          acceptance: { type: "array", items: { type: "string" } },
        },
        required: ["title"],
        additionalProperties: false,
      },
    },
    inScope: { type: "array", items: { type: "string" } },
    outOfScope: { type: "array", items: { type: "string" } },
    constraints: { type: "array", items: { type: "string" } },
    acceptanceCriteria: { type: "array", items: { type: "string" } },
    requiredInputs: { type: "array", items: { type: "string" } },
    stakeholders: {
      type: "array",
      items: {
        type: "object",
        properties: {
          id: { type: "string" },
          name: { type: "string" },
          role: { type: "string" },
        },
        required: ["id"],
        additionalProperties: false,
      },
    },
    assumptions: { type: "array", items: { type: "string" } },
    openQuestions: {
      type: "array",
      maxItems: 3,
      items: {
        type: "object",
        properties: {
          id: { type: "string" },
          question: { type: "string" },
          whyItMatters: {
            type: "string",
            enum: [
              "changes_goal",
              "changes_acceptance",
              "changes_scope",
              "changes_dependency",
              "changes_owner",
              "changes_risk",
            ],
          },
          options: { type: "array", items: { type: "string" } },
          defaultAssumption: { type: "string" },
          blocking: { type: "boolean" },
        },
        required: ["id", "question", "whyItMatters"],
        additionalProperties: false,
      },
    },
    sourceRefs: {
      type: "array",
      items: planningSourceRefToolSchema,
    },
    confidence: { type: "string", enum: ["high", "medium", "low"] },
  },
  required: ["originalRequest", "interpretedGoal"],
  additionalProperties: false,
} as const;

const planningFactListToolSchema = {
  type: "array",
  items: {
    type: "object",
    properties: {
      statement: { type: "string" },
      sourceRef: planningSourceRefToolSchema,
      confidence: { type: "string", enum: ["high", "medium", "low"] },
      impact: {
        type: "string",
        enum: ["scope", "acceptance", "dependency", "owner", "risk"],
      },
    },
    required: ["statement", "impact"],
    additionalProperties: false,
  },
} as const;

const planningFactsToolSchema = {
  type: "object",
  properties: {
    verified: planningFactListToolSchema,
    toLookUp: planningFactListToolSchema,
    toDerive: planningFactListToolSchema,
    assumptions: planningFactListToolSchema,
    contradictions: planningFactListToolSchema,
    sourceRefs: {
      type: "array",
      items: planningSourceRefToolSchema,
    },
  },
  additionalProperties: false,
} as const;

const planningCriticReportToolSchema = {
  type: "object",
  properties: {
    verdict: {
      type: "string",
      enum: ["pass", "revise", "ask_human", "reject"],
    },
    score: { type: "number", minimum: 0, maximum: 100 },
    issues: {
      type: "array",
      items: {
        type: "object",
        properties: {
          severity: {
            type: "string",
            enum: ["info", "warning", "error"],
          },
          dimension: {
            type: "string",
            enum: [
              "coverage",
              "executability",
              "dependency",
              "evidence",
              "sizing",
              "risk",
            ],
          },
          nodeId: { type: "string" },
          message: { type: "string" },
          suggestedFix: { type: "string" },
        },
        required: ["severity", "dimension", "message"],
        additionalProperties: false,
      },
    },
    acceptanceCoverage: {
      type: "array",
      items: {
        type: "object",
        properties: {
          criterion: { type: "string" },
          coveredByNodeIds: { type: "array", items: { type: "string" } },
          evidenceRefs: {
            type: "array",
            items: planningSourceRefToolSchema,
          },
        },
        required: ["criterion", "coveredByNodeIds"],
        additionalProperties: false,
      },
    },
    planId: { type: "string" },
    planVersionId: { type: "string" },
    sourceRefs: {
      type: "array",
      items: planningSourceRefToolSchema,
    },
  },
  required: ["verdict", "score"],
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
    open(spec: typeof planningDomainSpec): Promise<{
      table(name: "planning_settings"): KvTableLike<PlanningSettings>;
      table(name: "planning_runs"): KvTableLike<PlanningRun>;
      table(
        name: "planning_trigger_receipts",
      ): KvTableLike<PlanningTriggerReceipt>;
      table(name: "requirement_briefs"): KvTableLike<RequirementBrief>;
      table(name: "facts_ledgers"): KvTableLike<FactsLedger>;
      table(name: "plan_critic_reports"): KvTableLike<PlanCriticReport>;
      table(
        name: "planning_skill_snapshots",
      ): KvTableLike<PlanningSkillSnapshot>;
      table(
        name: "planning_knowledge_receipts",
      ): KvTableLike<PlanningKnowledgeReceipt>;
      table(name: "planning_events"): KvTableLike<PlanningEvent>;
      table(
        name: "planning_quality_metrics",
      ): KvTableLike<PlanningQualityMetric>;
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
  provide(key: "collabPlanning", value: PlanningService): () => void;
  provide(
    key: "collabTaskDispatchReadiness",
    value: PlanningDispatchReadinessGate,
  ): () => void;
  on(
    event: "collab/task-changed",
    listener: (payload: {
      readonly taskId: string;
      readonly workspaceId: string;
      readonly status: string;
    }) => void | Promise<void>,
  ): () => void;
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
                "admin" | "owner" | "member" | "guest" | undefined;
              readonly workspaceRole?: "owner" | "member" | "guest" | undefined;
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
                "task-worker" | "continuable-session" | "connector" | undefined;
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
      acceptance: node.deliverables
        ?.map((item) => item.title)
        .filter(Boolean) ?? [`完成：${node.name}`],
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
  const planningDomain = await ctx.storageDomain.open(planningDomainSpec);
  const settings = domain.table("workspace_settings");
  const audit = domain.table("audit_events");
  const planning = new PlanningService({
    settings: planningDomain.table("planning_settings"),
    runs: planningDomain.table("planning_runs"),
    receipts: planningDomain.table("planning_trigger_receipts"),
    requirementBriefs: planningDomain.table("requirement_briefs"),
    factsLedgers: planningDomain.table("facts_ledgers"),
    criticReports: planningDomain.table("plan_critic_reports"),
    skillSnapshots: planningDomain.table("planning_skill_snapshots"),
    knowledgeReceipts: planningDomain.table("planning_knowledge_receipts"),
    events: planningDomain.table("planning_events"),
    qualityMetrics: planningDomain.table("planning_quality_metrics"),
  });
  ctx.provide("collabPlanning", planning);
  let stopReconciler: (() => void) | undefined;
  let pauseWorkspacePlans: ((workspaceId: string) => Promise<void>) | undefined;
  ctx.effect(() => () => void domain.close());
  ctx.effect(() => () => void planningDomain.close());
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
      const reconciler = new PlanReconciler(plans, 15_000, ensureFinalization);
      stopReconciler = () => reconciler.stop();
      pauseWorkspacePlans = (workspaceId) => plans.pauseWorkspace(workspaceId);

      const actorForUser = (userId: string, workspaceId: string): PlanActor => {
        const user = child.collabTeam
          .users()
          .find((candidate) => candidate.id === userId);
        const member = child.collabTeam
          .members(workspaceId)
          .find((candidate) => candidate.userId === userId);
        const globalRole = (user as { readonly role?: string } | undefined)
          ?.role;
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
      const planningCoordinator = new ManualPlanningCoordinator({
        planning,
        team: child.collabTeam,
        tasks: child.collabTasks,
        teammates: () =>
          child.get("collabTeammateRuntime") as ReturnType<
            ManualPlanningCoordinatorDeps["teammates"]
          >,
        teammateService: () =>
          child.get("collabTeammates") as ReturnType<
            ManualPlanningCoordinatorDeps["teammateService"]
          >,
        teammateSkills: () =>
          child.get("collabTeammateSkills") as ReturnType<
            ManualPlanningCoordinatorDeps["teammateSkills"]
          >,
        context: () =>
          child.get("collabContext") as ReturnType<
            ManualPlanningCoordinatorDeps["context"]
          >,
        principalRuntime: () =>
          child.get("collabPrincipalRuntime") as ReturnType<
            ManualPlanningCoordinatorDeps["principalRuntime"]
          >,
        agent: () => child.collabAgent,
        workspaces: () =>
          child.get("workspaceRegistry") as ReturnType<
            ManualPlanningCoordinatorDeps["workspaces"]
          >,
        plans,
        knowledge: () =>
          child.get("collabPlanningKnowledge") as ReturnType<
            ManualPlanningCoordinatorDeps["knowledge"]
          >,
      });
      let planningRuntimeDisposers: Array<() => void> = [];
      let readinessDispose: (() => void) | undefined;
      let taskChangedDispose: (() => void) | undefined;
      const hasEnabledPlanningWorkspace = (): boolean =>
        [...planningDomain.table("planning_settings").entries()].some(
          ([, value]) => value.enabled,
        );
      const disposePlanningRuntime = (): void => {
        readinessDispose?.();
        readinessDispose = undefined;
        taskChangedDispose?.();
        taskChangedDispose = undefined;
        for (const dispose of planningRuntimeDisposers) dispose();
        planningRuntimeDisposers = [];
      };
      const handleTaskChanged = async (payload: {
        readonly taskId: string;
        readonly workspaceId: string;
      }): Promise<void> => {
        try {
          const settings = planning.settings(payload.workspaceId);
          if (!settings.enabled) return;
          const task = child.collabTasks.get(payload.taskId);
          const automatic = automaticPlanningTrigger(task);
          if (automatic === undefined) return;
          if (plans.findByRoot(payload.workspaceId, task.id) !== undefined) {
            return;
          }
          const members = child.collabTeam.members(payload.workspaceId);
          const fallbackUserId =
            members.find((member) => member.memberRole === "owner")?.userId ??
            child.collabTeam
              .users()
              .find(
                (user) => (user as { readonly role?: string }).role === "admin",
              )?.id;
          const actorUserId = task.createdBy ?? fallbackUserId;
          if (actorUserId === undefined) return;
          const actor = actorForUser(actorUserId, payload.workspaceId);
          await planningCoordinator.start({
            actor,
            workspaceId: payload.workspaceId,
            rootTaskId: task.id,
            expectedTaskRevision: task.updatedAt ?? "",
            mode: settings.agentOwnerPolicy.mode,
            trigger: automatic.trigger,
            eventKey: automatic.eventKey,
            taskDefinitionDigest: automatic.taskDefinitionDigest,
          });
        } catch {
          // Task dispatch readiness remains fail-closed for auto planning;
          // users can retry explicitly from task detail.
        }
      };
      const syncPlanningRuntime = async (): Promise<void> => {
        const enabledWorkspaceIds = [
          ...planningDomain.table("planning_settings").entries(),
        ]
          .filter(([, value]) => value.enabled)
          .map(([workspaceId]) => workspaceId);
        if (enabledWorkspaceIds.length === 0) {
          disposePlanningRuntime();
          return;
        }
        const teammateService = child.get("collabTeammates") as
          | {
              ensureWorkspaceSystemAgent(input: {
                readonly workspaceId: string;
                readonly systemKey: "task-planner";
                readonly actor: {
                  readonly userId: string;
                  readonly name: string;
                  readonly role: "admin";
                };
              }): Promise<unknown>;
            }
          | undefined;
        if (teammateService !== undefined) {
          for (const workspaceId of enabledWorkspaceIds) {
            await teammateService
              .ensureWorkspaceSystemAgent({
                workspaceId,
                systemKey: "task-planner",
                actor: {
                  userId: "system",
                  name: "系统",
                  role: "admin",
                },
              })
              .catch(() => undefined);
          }
        }
        if (readinessDispose === undefined) {
          readinessDispose = child.provide(
            "collabTaskDispatchReadiness",
            new PlanningDispatchReadinessGate({
              settings: (workspaceId) => planning.settings(workspaceId),
              planning,
              plans,
            }),
          );
        }
        if (taskChangedDispose === undefined) {
          taskChangedDispose = child.on("collab/task-changed", (payload) => {
            void handleTaskChanged(payload);
          });
        }
        if (planningRuntimeDisposers.length > 0) return;
        planningRuntimeDisposers = createPlanningRoutes({
          planning,
          coordinator: planningCoordinator,
          team: child.collabTeam,
          tasks: child.collabTasks,
          scope: "runtime",
        }).map((route) => child.webServer.register(route) as () => void);
      };
      child.effect(() => () => disposePlanningRuntime());
      for (const route of createPlanningRoutes({
        planning,
        coordinator: planningCoordinator,
        team: child.collabTeam,
        tasks: child.collabTasks,
        scope: "settings",
        onSettingsChanged: () => syncPlanningRuntime(),
      })) {
        const dispose = child.webServer.register(route) as () => void;
        child.effect(() => () => dispose());
      }
      void syncPlanningRuntime();

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
          if (cycle === undefined || !["plan", "replan"].includes(cycle.kind)) {
            throw new RouterWorkerError(
              "forbidden",
              "当前会话不是已登记的 Router 规划 Cycle",
            );
          }
          let stage = "resolve-actor";
          try {
            const planActor = actorForUser(cycle.createdBy, cycle.workspaceId);
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
        name: "planning_submit_understanding",
        description:
          "Submit the structured Requirement Brief and Facts Ledger for the active task-planning run. This tool cannot approve or execute the plan.",
        parameters: {
          type: "object",
          properties: {
            brief: planningBriefToolSchema,
            facts: planningFactsToolSchema,
          },
          required: ["brief", "facts"],
          additionalProperties: false,
        },
        output: {
          schema: { type: "string" },
          render: (_args, value) => [{ type: "text", text: value }],
        },
        execute: async (args, exec) => {
          const sessionId = exec.agent?.session?.id;
          if (sessionId === undefined) {
            throw new RouterWorkerError(
              "forbidden",
              "Planning understanding requires an active Agent session",
            );
          }
          const run = planning.findBySessionId(sessionId);
          if (run === undefined) {
            throw new RouterWorkerError(
              "forbidden",
              "当前会话不是活动的 Planning Run",
            );
          }
          if (run.status === "drafting") {
            return "Requirement Brief and Facts Ledger were already accepted.";
          }
          if (run.status !== "understanding") {
            throw new RouterWorkerError(
              "conflict",
              `当前 Planning Run 不在 understanding 阶段：${run.status}`,
            );
          }
          const parsed = planningUnderstandingToolInputSchema.parse(args);
          await planning.saveRequirementBrief(
            run.id,
            planningRequirementBriefInputSchema.parse(parsed.brief),
          );
          await planning.saveFactsLedger(
            run.id,
            planningFactsLedgerInputSchema.parse(parsed.facts),
          );
          await planning.transition(run.id, "drafting", {
            expectedRevision: run.revision,
          });
          return "Understanding accepted. Submit the Plan Graph with planning_submit_plan next.";
        },
      });

      child.tools.register({
        name: "planning_submit_plan",
        description:
          "Submit the structured Plan Graph for the active task-planning run. The plan is stored as an editable proposed version; this tool cannot approve, dispatch, or complete tasks.",
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
              rationale: z.string().trim().max(4_000).optional(),
            })
            .parse(args);
          const sessionId = exec.agent?.session?.id;
          if (sessionId === undefined) {
            throw new RouterWorkerError(
              "forbidden",
              "Planning plan submission requires an active Agent session",
            );
          }
          const run = planning.findBySessionId(sessionId);
          if (run === undefined) {
            throw new RouterWorkerError(
              "forbidden",
              "当前会话不是活动的 Planning Run",
            );
          }
          if (run.planId !== undefined) {
            throw new RouterWorkerError(
              "conflict",
              "当前 Planning Run 已提交计划",
            );
          }
          if (run.status !== "drafting") {
            throw new RouterWorkerError(
              "conflict",
              `当前 Planning Run 不在 drafting 阶段：${run.status}`,
            );
          }
          const rootTask = child.collabTasks.get(run.rootTaskId);
          const existing = plans.findByRoot(run.workspaceId, run.rootTaskId);
          if (existing !== undefined) {
            throw new RouterWorkerError("conflict", "该任务已有执行计划");
          }
          const routerAgentId = run.plannerTeammateId ?? run.plannerAgentId;
          if (routerAgentId === undefined) {
            throw new RouterWorkerError(
              "conflict",
              "Planning Run 缺少 Planner 身份",
            );
          }
          const planUserId =
            run.trigger.kind === "human-manual"
              ? run.trigger.userId
              : (rootTask.createdBy ?? run.plannerPrincipalId);
          if (planUserId === undefined) {
            throw new RouterWorkerError(
              "conflict",
              "无法确定 Plan Store 操作人",
            );
          }
          const planActor = actorForUser(planUserId, run.workspaceId);
          const created = await plans.saveCreate(planActor, {
            workspaceId: run.workspaceId,
            rootTaskId: run.rootTaskId,
            source: "router",
            routerAgentId,
            initialStatus: "proposed",
            settings: { routerAgentId },
            graph: parsed.graph,
          });
          await planning.transition(run.id, "critiquing", {
            expectedRevision: run.revision,
            patch: {
              planId: created.plan.id,
              planVersionId: created.version.id,
            },
          });
          await planningCoordinator.startCritic(run.id, planActor);
          return `Plan Draft ${created.plan.rootTaskId} v${created.version.version} saved. Plan Critic started.`;
        },
      });

      child.tools.register({
        name: "planning_submit_critique",
        description:
          "Submit the independent Plan Critic report for the active planning run. The platform applies deterministic validation, quality and risk gates; this tool cannot bypass human review.",
        parameters: {
          type: "object",
          properties: {
            report: planningCriticReportToolSchema,
          },
          required: ["report"],
          additionalProperties: false,
        },
        output: {
          schema: { type: "string" },
          render: (_args, value) => [{ type: "text", text: value }],
        },
        execute: async (args, exec) => {
          const parsed = z.object({ report: z.unknown() }).parse(args);
          const sessionId = exec.agent?.session?.id;
          if (sessionId === undefined) {
            throw new RouterWorkerError(
              "forbidden",
              "Plan Critic submission requires an active Agent session",
            );
          }
          const run = planning.findBySessionId(sessionId);
          if (run === undefined || run.status !== "critiquing") {
            throw new RouterWorkerError(
              "conflict",
              "当前会话不是等待评审的 Planning Run",
            );
          }
          if (run.planId === undefined) {
            throw new RouterWorkerError(
              "conflict",
              "Planning Run 缺少 Plan Draft",
            );
          }
          const criticInput = planningPlanCriticInputSchema.parse({
            ...(typeof parsed.report === "object" &&
            parsed.report !== null &&
            !Array.isArray(parsed.report)
              ? parsed.report
              : {}),
            planId: run.planId,
            ...(run.planVersionId === undefined
              ? {}
              : { planVersionId: run.planVersionId }),
          });
          const detail = plans.detail(run.planId);
          const report = await planning.saveCriticReport(run.id, criticInput);
          const settings = planning.settings(run.workspaceId);
          const validatorErrors = plans
            .validate(run.planId)
            .filter((issue) => issue.level === "error")
            .map((issue) => issue.message);
          const quality = evaluatePlanningQuality({
            rootAcceptance:
              child.collabTasks.get(run.rootTaskId).acceptance ?? [],
            graph: detail.version.graph,
            validatorErrors,
            critic: report,
            approval: settings.agentOwnerPolicy.approval,
            triggerKind: run.trigger.kind,
          });
          await planning.recordQualityMetric(run.id, {
            dimension: "acceptance-coverage",
            score: quality.score,
            failureCodes: [...quality.reasons],
            metadata: {
              coverage: String(quality.coverage),
              risk: quality.risk,
              decision: quality.decision,
            },
          });
          await planning.recordQualityMetric(run.id, {
            dimension: "latency",
            score: Math.max(0, Date.now() - Date.parse(run.createdAt)),
            failureCodes: [],
            metadata: { unit: "ms" },
          });
          const validated = await planning.transition(run.id, "validating", {
            expectedRevision: run.revision,
          });
          if (quality.decision === "auto-approve") {
            const rootTask = child.collabTasks.get(run.rootTaskId);
            const actorId = rootTask.createdBy ?? run.plannerPrincipalId;
            if (actorId === undefined) {
              throw new RouterWorkerError(
                "conflict",
                "无法确定平台策略审批主体",
              );
            }
            const policyActor = actorForUser(actorId, run.workspaceId);
            const approved = await plans.approveByPolicy(policyActor, {
              planId: run.planId,
              expectedRevision: detail.plan.revision,
              policy:
                settings.agentOwnerPolicy.approval === "auto"
                  ? "auto"
                  : "risk-based",
              reason: `质量分 ${quality.score}，风险 ${quality.risk}`,
            });
            await plans.materialize(policyActor, approved.id);
            reconciler.start();
            await planning.transition(run.id, "succeeded", {
              expectedRevision: validated.run.revision,
            });
            return `Plan Critic passed with score ${quality.score}; the low-risk plan was policy-approved and materialized.`;
          }
          await planning.transition(run.id, "review_required", {
            expectedRevision: validated.run.revision,
          });
          return `Plan Critic score ${quality.score}; human review is required: ${quality.reasons.join("；") || "manual approval policy"}`;
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
            const current = settingsFor(workspaceId, settings.get(workspaceId));
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
              throw new RouterWorkerError("forbidden", "主任务不属于当前项目");
            }
            if (
              plans.findByRoot(body.workspaceId, body.rootTaskId) !== undefined
            ) {
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
              throw new RouterWorkerError("conflict", "Workflow 服务不可用");
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
            const approved = await plans.approve(actor, body);
            const planningRun = planning.latestRun(
              approved.workspaceId,
              approved.rootTaskId,
            );
            if (
              planningRun?.status === "review_required" &&
              planningRun.planId === approved.id
            ) {
              await planning
                .completeRun(planningRun.id, {
                  expectedRevision: planningRun.revision,
                })
                .catch(() => undefined);
            }
            return approved;
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
