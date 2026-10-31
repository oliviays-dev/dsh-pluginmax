import type { IncomingMessage, ServerResponse } from "node:http";
import {
  bearerToken,
  readJsonBody,
  sameOrigin,
  sendJson,
} from "@pluginmax/shared";
import { z } from "zod";
import {
  dataFabricDomainSpec,
  semanticQueryInputSchema,
  type DataConnection,
  type DataPolicy,
  type DataSkill,
  type Dataset,
  type QueryResult,
  type QueryRun,
  type SemanticMetric,
} from "./models.js";
import {
  DataFabricError,
  DataFabricService,
  type CompileContext,
  type ConnectorQueryResult,
  type DataCatalogRegistration,
  type DataFabricActor,
  type DataFabricTables,
  type DataConnector,
  type DataSkillMatch,
  type KvTableLike,
} from "./service.js";

export const name = "dsh-collab-data-fabric";
export const inject = ["storageDomain", "webServer", "collabTeam"];

export {
  DataFabricError,
  DataFabricService,
  dataFabricDomainSpec,
  semanticQueryInputSchema,
};
export type {
  CompileContext,
  ConnectorQueryResult,
  DataCatalogRegistration,
  DataConnector,
  DataFabricActor,
  DataFabricTables,
  DataConnection,
  DataPolicy,
  DataSkill,
  DataSkillMatch,
  Dataset,
  KvTableLike,
  QueryResult,
  QueryRun,
  SemanticMetric,
};

interface WebRouteLike {
  readonly kind: "exact";
  readonly path: string;
  handler(
    request: IncomingMessage,
    response: ServerResponse,
  ): Promise<void> | void;
}

interface TeamMemberLike {
  readonly userId: string;
  readonly memberRole?: "owner" | "member" | "guest" | undefined;
}

interface TeamServiceLike {
  resolveToken(token: string):
    | {
        readonly userId: string;
        readonly role?: "admin" | "owner" | "member" | "guest" | undefined;
      }
    | undefined;
  users(): readonly { readonly id: string; readonly name: string }[];
  members(workspaceId: string): readonly TeamMemberLike[];
}

interface DomainLike {
  table(
    name:
      | "connections"
      | "datasets"
      | "metrics"
      | "policies"
      | "query_runs"
      | "query_results"
      | "skills",
  ): KvTableLike<unknown>;
  close(): Promise<void>;
}

export interface DataFabricContext {
  storageDomain: {
    open(spec: typeof dataFabricDomainSpec): Promise<DomainLike>;
  };
  webServer: {
    register(route: WebRouteLike): unknown;
  };
  collabTeam: TeamServiceLike;
  provide(key: "collabDataFabric", service: DataFabricService): void;
  effect(operation: () => () => void): void;
}

function actorFor(
  request: IncomingMessage,
  team: TeamServiceLike,
  workspaceId: string,
  projectId?: string,
): DataFabricActor {
  const origin = request.headers.origin;
  const host = request.headers.host;
  if (typeof origin === "string") {
    const expectedHost = Array.isArray(host) ? host[0] : host;
    if (!sameOrigin(origin, expectedHost)) {
      throw new DataFabricError("forbidden", "same-origin request is required");
    }
  }
  const token = bearerToken({
    get(headerName) {
      return headerName === "authorization"
        ? (request.headers.authorization ?? null)
        : null;
    },
  });
  if (token === undefined) {
    throw new DataFabricError("forbidden", "bearer token is required");
  }
  const principal = team.resolveToken(token);
  if (principal === undefined) {
    throw new DataFabricError("forbidden", "invalid or expired token");
  }
  const member = team
    .members(workspaceId)
    .find((item) => item.userId === principal.userId);
  const user = team.users().find((item) => item.id === principal.userId);
  return {
    userId: principal.userId,
    name: user?.name ?? principal.userId,
    workspaceRole: member?.memberRole ?? "guest",
    ...(projectId === undefined ? {} : { projectId }),
  };
}

function queryParam(request: IncomingMessage, key: string): string | undefined {
  const value = new URL(request.url ?? "/", "http://dsh.invalid").searchParams.get(
    key,
  );
  return value?.trim() === "" ? undefined : (value ?? undefined);
}

function errorResponse(response: ServerResponse, cause: unknown): void {
  if (cause instanceof z.ZodError) {
    sendJson(response, 400, {
      ok: false,
      error: {
        code: "invalid_input",
        message: cause.issues[0]?.message ?? "request input is invalid",
      },
    });
    return;
  }
  if (cause instanceof DataFabricError) {
    const status =
      cause.code === "invalid_input"
        ? 400
        : cause.code === "forbidden"
          ? 403
          : cause.code === "not_found"
            ? 404
            : cause.code === "conflict"
              ? 409
              : cause.code === "unavailable"
                ? 503
                : 500;
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
      message: cause instanceof Error ? cause.message : "Data Fabric 请求失败",
    },
  });
}

const queryBodySchema = z
  .object({
    workspaceId: z.string().trim().min(1).max(180),
    projectId: z.string().trim().min(1).max(180).optional(),
    intentSummary: z.string().trim().min(1).max(2_000).optional(),
  })
  .and(semanticQueryInputSchema);

export function createDataFabricRoutes(
  service: DataFabricService,
  team: () => TeamServiceLike,
): readonly WebRouteLike[] {
  const route = (
    path: string,
    handler: WebRouteLike["handler"],
  ): WebRouteLike => ({
    kind: "exact",
    path,
    handler: async (request, response) => {
      try {
        await handler(request, response);
      } catch (cause) {
        errorResponse(response, cause);
      }
    },
  });
  return [
    route("/api/collab/data-fabric/bootstrap", async (request, response) => {
      if (request.method !== "GET") {
        throw new DataFabricError("invalid_input", "method not allowed");
      }
      const workspaceId = queryParam(request, "workspaceId");
      if (workspaceId === undefined) {
        throw new DataFabricError("invalid_input", "workspaceId is required");
      }
      const identity = team();
      const actor = actorFor(request, identity, workspaceId);
      await service.ensureWorkspaceFixture(workspaceId);
      const catalog = await service.catalogSearch(actor, workspaceId, {
        limit: 50,
      });
      sendJson(response, 200, {
        ok: true,
        capabilities: await service.capabilities(actor, workspaceId),
        catalog,
        queryRuns: service.queryRuns(actor, workspaceId, 20),
      });
    }),
    route("/api/collab/data-fabric/catalog", async (request, response) => {
      if (request.method !== "GET") {
        throw new DataFabricError("invalid_input", "method not allowed");
      }
      const workspaceId = queryParam(request, "workspaceId");
      if (workspaceId === undefined) {
        throw new DataFabricError("invalid_input", "workspaceId is required");
      }
      const actor = actorFor(request, team(), workspaceId);
      sendJson(response, 200, {
        ok: true,
        datasets: await service.catalogSearch(actor, workspaceId, {
          query: queryParam(request, "q"),
          projectId: queryParam(request, "projectId"),
          limit: Number(queryParam(request, "limit") ?? 20),
        }),
      });
    }),
    route("/api/collab/data-fabric/dataset", async (request, response) => {
      if (request.method !== "GET") {
        throw new DataFabricError("invalid_input", "method not allowed");
      }
      const workspaceId = queryParam(request, "workspaceId");
      const datasetId = queryParam(request, "datasetId");
      if (workspaceId === undefined || datasetId === undefined) {
        throw new DataFabricError(
          "invalid_input",
          "workspaceId and datasetId are required",
        );
      }
      const actor = actorFor(request, team(), workspaceId);
      sendJson(response, 200, {
        ok: true,
        ...(await service.describe(actor, workspaceId, datasetId)),
      });
    }),
    route("/api/collab/data-fabric/query-runs", async (request, response) => {
      if (request.method !== "GET") {
        throw new DataFabricError("invalid_input", "method not allowed");
      }
      const workspaceId = queryParam(request, "workspaceId");
      if (workspaceId === undefined) {
        throw new DataFabricError("invalid_input", "workspaceId is required");
      }
      const actor = actorFor(request, team(), workspaceId);
      sendJson(response, 200, {
        ok: true,
        runs: service.queryRuns(actor, workspaceId),
      });
    }),
    route("/api/collab/data-fabric/query/explain", async (request, response) => {
      if (request.method !== "POST") {
        throw new DataFabricError("invalid_input", "method not allowed");
      }
      const input = queryBodySchema.parse(await readJsonBody(request));
      const actor = actorFor(
        request,
        team(),
        input.workspaceId,
        input.projectId,
      );
      sendJson(response, 200, {
        ok: true,
        explanation: await service.explain(actor, input.workspaceId, input),
      });
    }),
    route("/api/collab/data-fabric/query", async (request, response) => {
      if (request.method !== "POST") {
        throw new DataFabricError("invalid_input", "method not allowed");
      }
      const input = queryBodySchema.parse(await readJsonBody(request));
      const actor = actorFor(
        request,
        team(),
        input.workspaceId,
        input.projectId,
      );
      sendJson(
        response,
        200,
        await service.query(actor, input.workspaceId, input, {
          projectId: input.projectId,
          intentSummary: input.intentSummary,
        }),
      );
    }),
  ];
}

export async function apply(ctx: DataFabricContext): Promise<void> {
  const domain = await ctx.storageDomain.open(dataFabricDomainSpec);
  const service = new DataFabricService({
    connections: domain.table("connections") as KvTableLike<DataConnection>,
    datasets: domain.table("datasets") as KvTableLike<Dataset>,
    metrics: domain.table("metrics") as KvTableLike<SemanticMetric>,
    policies: domain.table("policies") as KvTableLike<DataPolicy>,
    queryRuns: domain.table("query_runs") as KvTableLike<QueryRun>,
    queryResults: domain.table("query_results") as KvTableLike<QueryResult>,
    skills: domain.table("skills") as KvTableLike<DataSkill>,
  });
  ctx.provide("collabDataFabric", service);
  ctx.effect(() => () => {
    void domain.close();
  });
  for (const route of createDataFabricRoutes(service, () => ctx.collabTeam)) {
    ctx.webServer.register(route);
  }
}
