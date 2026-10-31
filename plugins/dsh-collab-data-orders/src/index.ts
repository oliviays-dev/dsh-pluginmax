import type { IncomingMessage, ServerResponse } from "node:http";
import {
  bearerToken,
  readJsonBody,
  sameOrigin,
  sendJson,
} from "@pluginmax/shared";
import {
  DataFabricService,
  type DataFabricActor,
  type KvTableLike,
} from "dsh-collab-data-fabric";
import type { McpProviderRegistry } from "dsh-collab-resource-market";
import { z } from "zod";
import {
  HttpJsonOrderTransport,
  OrderReadonlyConnector,
} from "./connector.js";
import {
  ORDER_CONNECTOR_MANIFEST,
  ORDER_MCP_ASSET_ID,
  dataOrdersDomainSpec,
  orderFieldMappingSchema,
  orderValueMappingsSchema,
  type OrderMigration,
  type OrderSourceConfig,
} from "./models.js";
import { McpOrderTransport, OrderMcpProvider } from "./mcp.js";
import {
  ORDER_WORKBENCH_DISPLAY_CONFIG,
  OrderDataService,
} from "./service.js";

export const name = "dsh-collab-data-orders";
export const inject = [
  "storageDomain",
  "webServer",
  "collabDataFabric",
  "collabTeam",
];

export {
  HttpJsonOrderTransport,
  OrderReadonlyConnector,
} from "./connector.js";
export {
  ORDER_CONNECTOR_MANIFEST,
  ORDER_CONNECTOR_TYPE,
  ORDER_CONNECTION_ID,
  ORDER_DATASET_ID,
  ORDER_MCP_ASSET_ID,
  ORDER_METRIC_IDS,
  ORDER_SEMANTIC_VERSION,
  ORDER_SKILL_ID,
  dataOrdersDomainSpec,
} from "./models.js";
export {
  McpOrderTransport,
  OrderMcpProvider,
} from "./mcp.js";
export type {
  OrderMcpPrincipal,
  OrderMcpProviderConfig,
} from "./mcp.js";
export {
  ORDER_WORKBENCH_DISPLAY_CONFIG,
  OrderDataService,
  createOrderWorkbenchMetricProvider,
} from "./service.js";
export type {
  OrderDataFabricQuery,
  OrderDataTables,
  OrderWorkbenchMetric,
} from "./service.js";
export type {
  OrderMigration,
  OrderSourceConfig,
} from "./models.js";

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
    name: "source_configs" | "migrations",
  ): KvTableLike<unknown>;
  close(): Promise<void>;
}

interface ProviderRegistryContext {
  get?(key: string, strict?: boolean): unknown;
  root?: { get(key: string, strict?: boolean): unknown };
}

export interface OrderDataContext {
  storageDomain: {
    open(spec: typeof dataOrdersDomainSpec): Promise<DomainLike>;
  };
  webServer: {
    register(route: WebRouteLike): unknown;
  };
  collabDataFabric: DataFabricService;
  collabTeam: TeamServiceLike;
  provide(key: string, value: unknown): void;
  effect(operation: () => () => void): void;
  inject?(
    keys: readonly string[],
    callback: (child: OrderDataContext) => void,
  ): { dispose(): void };
  get?(key: string, strict?: boolean): unknown;
  root?: { get(key: string, strict?: boolean): unknown };
}

function lookupRegistry<T>(
  ctx: ProviderRegistryContext,
  key: string,
): T | undefined {
  const direct = ctx.get?.(key, false);
  return (direct ?? ctx.root?.get(key, false)) as T | undefined;
}

function queryParam(request: IncomingMessage, key: string): string | undefined {
  const value = new URL(request.url ?? "/", "http://dsh.invalid").searchParams.get(
    key,
  );
  return value === null || value.trim() === "" ? undefined : value;
}

function principalFor(
  request: IncomingMessage,
  team: TeamServiceLike,
  workspaceId: string,
): {
  readonly userId: string;
  readonly memberRole: "owner" | "member" | "guest";
  readonly platformRole?: "admin" | "owner" | "member" | "guest" | undefined;
} {
  const origin = request.headers.origin;
  const host = request.headers.host;
  if (typeof origin === "string") {
    const expectedHost = Array.isArray(host) ? host[0] : host;
    if (!sameOrigin(origin, expectedHost)) {
      throw new Error("same-origin request is required");
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
    throw new Error("bearer token is required");
  }
  const principal = team.resolveToken(token);
  if (principal === undefined) {
    throw new Error("invalid or expired token");
  }
  const member = team
    .members(workspaceId)
    .find((candidate) => candidate.userId === principal.userId);
  return {
    userId: principal.userId,
    memberRole: member?.memberRole ?? "guest",
    ...(principal.role === undefined ? {} : { platformRole: principal.role }),
  };
}

function errorResponse(response: ServerResponse, cause: unknown): void {
  if (cause instanceof z.ZodError) {
    sendJson(response, 400, {
      ok: false,
      error: {
        code: "invalid_input",
        message: cause.issues[0]?.message ?? "invalid order source config",
      },
    });
    return;
  }
  const message =
    cause instanceof Error ? cause.message : "order source request failed";
  const status =
    message.includes("bearer") || message.includes("token")
      ? 401
      : message.includes("same-origin") || message.includes("permission")
        ? 403
        : 400;
  sendJson(response, status, {
    ok: false,
    error: { code: status === 401 ? "unauthorized" : "invalid_input", message },
  });
}

const configInputSchema = z.object({
  workspaceId: z.string().trim().min(1).max(180),
  mode: z.enum(["demo", "production"]),
  transport: z.enum(["fixture", "http-json", "mcp"]).optional(),
  endpointRef: z.string().trim().min(1).max(500).optional(),
  credentialRef: z.string().trim().min(1).max(500).optional(),
  mcpAssetId: z.string().trim().min(1).max(180).optional(),
  mcpToolName: z.string().trim().min(1).max(120).optional(),
  fieldMapping: orderFieldMappingSchema.partial().optional(),
  valueMappings: orderValueMappingsSchema.partial().optional(),
});

export function createOrderDataRoutes(input: {
  readonly service: OrderDataService;
  readonly team: () => TeamServiceLike;
}): readonly WebRouteLike[] {
  return [
    {
      kind: "exact",
      path: "/api/collab/data-orders/bootstrap",
      handler: async (request, response) => {
        try {
          if (request.method !== "GET") {
            throw new Error("method not allowed");
          }
          const workspaceId = queryParam(request, "workspaceId");
          if (workspaceId === undefined) {
            throw new Error("workspaceId is required");
          }
          const principal = principalFor(request, input.team(), workspaceId);
          if (
            principal.memberRole !== "owner" &&
            principal.memberRole !== "member" &&
            principal.platformRole !== "admin"
          ) {
            throw new Error("workspace data permission is required");
          }
          await input.service.ensureWorkspace(workspaceId);
          sendJson(response, 200, {
            ok: true,
            status: input.service.status(workspaceId),
            display: ORDER_WORKBENCH_DISPLAY_CONFIG,
            contract: {
              exceptionDefinition:
                "payment failure + cancellation + fulfillment timeout",
              refundExcludedFromDefaultException: true,
              readOnly: true,
              freeSql: false,
            },
          });
        } catch (cause) {
          errorResponse(response, cause);
        }
      },
    },
    {
      kind: "exact",
      path: "/api/collab/data-orders/config",
      handler: async (request, response) => {
        try {
          if (request.method !== "POST") {
            throw new Error("method not allowed");
          }
          const parsed = configInputSchema.parse(await readJsonBody(request));
          const principal = principalFor(
            request,
            input.team(),
            parsed.workspaceId,
          );
          if (
            principal.memberRole !== "owner" &&
            principal.platformRole !== "admin"
          ) {
            throw new Error("workspace owner permission is required");
          }
          const config = await input.service.configure(
            parsed.workspaceId,
            principal.userId,
            {
              mode: parsed.mode,
              ...(parsed.transport === undefined
                ? {}
                : { transport: parsed.transport }),
              ...(parsed.endpointRef === undefined
                ? {}
                : { endpointRef: parsed.endpointRef }),
              ...(parsed.credentialRef === undefined
                ? {}
                : { credentialRef: parsed.credentialRef }),
              ...(parsed.mcpAssetId === undefined
                ? {}
                : { mcpAssetId: parsed.mcpAssetId }),
              ...(parsed.mcpToolName === undefined
                ? {}
                : { mcpToolName: parsed.mcpToolName }),
              ...(parsed.fieldMapping === undefined
                ? {}
                : { fieldMapping: parsed.fieldMapping }),
              ...(parsed.valueMappings === undefined
                ? {}
                : { valueMappings: parsed.valueMappings }),
            },
          );
          sendJson(response, 200, {
            ok: true,
            status: input.service.status(parsed.workspaceId),
            config: {
              mode: config.mode,
              transport: config.transport,
              revision: config.revision,
            },
          });
        } catch (cause) {
          errorResponse(response, cause);
        }
      },
    },
  ];
}

export async function apply(ctx: OrderDataContext): Promise<void> {
  const domain = await ctx.storageDomain.open(dataOrdersDomainSpec);
  const service = new OrderDataService(
    {
      sourceConfigs: domain.table(
        "source_configs",
      ) as KvTableLike<OrderSourceConfig>,
      migrations: domain.table(
        "migrations",
      ) as KvTableLike<OrderMigration>,
    },
    ctx.collabDataFabric,
  );
  const mcpProvider = new OrderMcpProvider();
  let disposeRegistryProvider: (() => void) | undefined;
  const registryFiber = ctx.inject?.(
    ["collabMcpProviderRegistry"],
    (child) => {
      const registry = lookupRegistry<McpProviderRegistry>(
        child,
        "collabMcpProviderRegistry",
      );
      if (registry === undefined) return;
      disposeRegistryProvider = registry.register(mcpProvider);
    },
  );
  const disposeConnector = ctx.collabDataFabric.registerConnector(
    new OrderReadonlyConnector(
      (workspaceId) => service.config(workspaceId),
      new HttpJsonOrderTransport(),
      () => new Date(),
      new McpOrderTransport({
        callTool: async (input) => {
          const registry = lookupRegistry<McpProviderRegistry>(
            ctx,
            "collabMcpProviderRegistry",
          );
          if (registry !== undefined && registry.size > 0) {
            return registry.callTool(input);
          }
          return mcpProvider.callTool(input);
        },
      }),
    ),
  );
  const disposeProvider = ctx.collabDataFabric.registerCatalogProvider(
    async (workspaceId) => {
      await service.ensureWorkspace(workspaceId);
    },
  );
  ctx.provide("collabDataOrders", service);
  ctx.provide("collabMcpCatalog", mcpProvider);
  ctx.provide("collabOrderMetrics", {
    async workbenchMetric(input: {
      readonly workspaceId: string;
      readonly actor: DataFabricActor;
    }) {
      return service.workbenchMetric(input);
    },
    display: ORDER_WORKBENCH_DISPLAY_CONFIG,
    manifest: ORDER_CONNECTOR_MANIFEST,
    mcpAssetId: ORDER_MCP_ASSET_ID,
  });
  ctx.effect(() => () => {
    disposeRegistryProvider?.();
    registryFiber?.dispose();
    disposeProvider();
    disposeConnector();
    void mcpProvider.dispose();
  });
  ctx.effect(() => () => {
    void domain.close();
  });
  for (const route of createOrderDataRoutes({
    service,
    team: () => ctx.collabTeam,
  })) {
    ctx.webServer.register(route);
  }
}
