import { fileURLToPath } from "node:url";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import type { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import { DataFabricError } from "dsh-collab-data-fabric";
import type { McpToolProvider } from "dsh-collab-resource-market";
import { z } from "zod";
import type {
  OrderReadonlyTransport,
  OrderSourceBatch,
  OrderTransportRequest,
} from "./connector.js";

const MCP_CALL_RESULT = z.record(z.string(), z.unknown());

export interface OrderMcpPrincipal {
  readonly userId: string;
  readonly role?: "admin" | "owner" | "member" | "guest" | undefined;
}

interface OrderMcpProviderAsset {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly category: string;
  readonly protocol: string;
  readonly toolCount: number;
  readonly publisher: {
    readonly id: string;
    readonly name: string;
    readonly verified: boolean;
    readonly kind: "official" | "certified" | "community";
  };
  readonly version: string;
  readonly icon: string;
  readonly permissions: string[];
  readonly initialStatus: "pending" | "off";
  readonly status: "connected" | "pending" | "off";
}

export interface OrderMcpProviderConfig {
  readonly assetId: string;
  readonly transport: "stdio" | "streamable-http";
  readonly command?: string | undefined;
  readonly args?: readonly string[] | undefined;
  readonly cwd?: string | undefined;
  readonly url?: string | undefined;
  readonly headers?: Readonly<Record<string, string>> | undefined;
  readonly toolCallTimeoutMs?: number | undefined;
}

interface ConnectedClient {
  readonly client: Client;
  readonly transport: Transport;
}

const MOCK_SERVER_PATH = fileURLToPath(
  new URL("../mock/order-mcp-server.mjs", import.meta.url),
);

function defaultConfig(): OrderMcpProviderConfig {
  const url = process.env.ORDERS_MCP_URL?.trim();
  if (url !== undefined && url !== "") {
    const token = process.env.ORDERS_MCP_TOKEN?.trim();
    return {
      assetId: "mcp-orders-mock",
      transport: "streamable-http",
      url,
      headers: token === undefined || token === "" ? {} : {
        authorization: `Bearer ${token}`,
      },
      toolCallTimeoutMs: 15_000,
    };
  }
  return {
    assetId: "mcp-orders-mock",
    transport: "stdio",
    command: process.execPath,
    args: [MOCK_SERVER_PATH],
    cwd: fileURLToPath(new URL("..", import.meta.url)),
    toolCallTimeoutMs: 15_000,
  };
}

export class OrderMcpProvider implements McpToolProvider {
  readonly id = "order-mcp-provider";

  private readonly clients = new Map<string, ConnectedClient>();
  private readonly connectedUsers = new Set<string>();

  constructor(
    private readonly config: OrderMcpProviderConfig = defaultConfig(),
  ) {}

  async list(
    principal: OrderMcpPrincipal,
  ): Promise<readonly OrderMcpProviderAsset[]> {
    return [
      {
        id: this.config.assetId,
        name: "Mock 订单管理系统",
        description:
          "第三方订单管理系统的 MCP 模拟实现，只读提供订单、支付与履约事实。",
        category: "履约",
        protocol: `MCP · ${this.config.transport}`,
        toolCount: 2,
        publisher: {
          id: "third-party-order-system",
          name: "Third-party OMS",
          verified: true,
          kind: "certified",
        },
        version: "1.0.0",
        icon: "database",
        permissions: [
          "orders.read",
          "payments.read",
          "fulfillment.read",
        ],
        initialStatus: "off",
        status: this.connectedUsers.has(principal.userId)
          ? "connected"
          : "off",
      },
    ];
  }

  async connect(
    principal: OrderMcpPrincipal,
    mcpId: string,
  ): Promise<{ status: "pending" | "connected" }> {
    if (mcpId !== this.config.assetId) {
      throw new DataFabricError("not_found", "order MCP asset not found");
    }
    await this.ensureConnected(principal.userId);
    this.connectedUsers.add(principal.userId);
    return { status: "connected" };
  }

  async callTool(input: {
    readonly userId: string;
    readonly mcpId: string;
    readonly toolName: string;
    readonly arguments: Readonly<Record<string, unknown>>;
  }): Promise<Record<string, unknown>> {
    if (input.mcpId !== this.config.assetId) {
      throw new DataFabricError(
        "not_found",
        "order MCP asset is not registered for this workspace",
      );
    }
    if (!this.connectedUsers.has(input.userId)) {
      throw new DataFabricError(
        "unavailable",
        "order MCP is not connected in the resource market",
      );
    }
    const connection = await this.ensureConnected(input.userId);
    try {
      const result = await connection.client.request(
        {
          method: "tools/call",
          params: {
            name: input.toolName,
            arguments: input.arguments,
          },
        },
        MCP_CALL_RESULT,
        {
          timeout: this.config.toolCallTimeoutMs ?? 15_000,
        },
      );
      if (result.isError === true) {
        throw new DataFabricError(
          "query_failed",
          this.textContent(result) || "order MCP tool returned an error",
        );
      }
      const structured = result.structuredContent;
      if (
        structured !== null &&
        typeof structured === "object" &&
        !Array.isArray(structured)
      ) {
        return structured as Record<string, unknown>;
      }
      const text = this.textContent(result);
      try {
        const parsed = JSON.parse(text) as unknown;
        if (parsed !== null && typeof parsed === "object" && !Array.isArray(parsed)) {
          return parsed as Record<string, unknown>;
        }
      } catch {
        // Fall through to an explicit contract error.
      }
      throw new DataFabricError(
        "query_failed",
        "order MCP tool must return a JSON object",
      );
    } catch (cause) {
      if (cause instanceof DataFabricError) throw cause;
      throw new DataFabricError(
        "unavailable",
        cause instanceof Error
          ? `order MCP tool unavailable: ${cause.message}`
          : "order MCP tool unavailable",
      );
    }
  }

  async dispose(): Promise<void> {
    const connections = [...this.clients.values()];
    this.clients.clear();
    this.connectedUsers.clear();
    await Promise.all(
      connections.map(async ({ client, transport }) => {
        await client.close().catch(() => undefined);
        await transport.close().catch(() => undefined);
      }),
    );
  }

  private async ensureConnected(userId: string): Promise<ConnectedClient> {
    const current = this.clients.get(userId);
    if (current !== undefined) return current;
    const transport = this.transport();
    const client = new Client(
      { name: "pluginmax-order-data-connector", version: "0.1.0" },
      { capabilities: {} },
    );
    try {
      await client.connect(transport);
      await client.request(
        { method: "tools/list", params: {} },
        MCP_CALL_RESULT,
        { timeout: this.config.toolCallTimeoutMs ?? 15_000 },
      );
    } catch (cause) {
      await client.close().catch(() => undefined);
      await transport.close().catch(() => undefined);
      throw new DataFabricError(
        "unavailable",
        cause instanceof Error
          ? `order MCP connection failed: ${cause.message}`
          : "order MCP connection failed",
      );
    }
    const connected = { client, transport };
    this.clients.set(userId, connected);
    return connected;
  }

  private transport(): Transport {
    if (this.config.transport === "streamable-http") {
      if (this.config.url === undefined) {
        throw new DataFabricError("unavailable", "order MCP URL is missing");
      }
      return new StreamableHTTPClientTransport(new URL(this.config.url), {
        requestInit: {
          headers: { ...this.config.headers },
        },
      }) as Transport;
    }
    if (this.config.command === undefined) {
      throw new DataFabricError(
        "unavailable",
        "order MCP command is missing",
      );
    }
    return new StdioClientTransport({
      command: this.config.command,
      args: [...(this.config.args ?? [])],
      env: {},
      ...(this.config.cwd === undefined ? {} : { cwd: this.config.cwd }),
    });
  }

  private textContent(result: Record<string, unknown>): string {
    const content = result.content;
    if (!Array.isArray(content)) return "";
    return content
      .flatMap((item) => {
        if (item === null || typeof item !== "object") return [];
        const record = item as Record<string, unknown>;
        return record.type === "text" && typeof record.text === "string"
          ? [record.text]
          : [];
      })
      .join("\n")
      .trim();
  }
}

const ORDER_MCP_RESULT = z.object({
  orders: z.array(z.record(z.string(), z.unknown())).max(100_000),
  dataCutoffAt: z.string().datetime({ offset: true }),
  freshness: z.string().trim().min(1).max(200),
  scannedRows: z.number().int().nonnegative().optional(),
});

export class McpOrderTransport implements OrderReadonlyTransport {
  constructor(
    private readonly provider: Pick<McpToolProvider, "callTool">,
  ) {}

  async query(request: OrderTransportRequest): Promise<OrderSourceBatch> {
    if (
      request.config.mcpAssetId === undefined ||
      request.config.mcpToolName === undefined
    ) {
      throw new DataFabricError(
        "unavailable",
        "order MCP asset and tool must be configured",
      );
    }
    const result = await this.provider.callTool({
      userId: request.userId,
      mcpId: request.config.mcpAssetId,
      toolName: request.config.mcpToolName,
      arguments: {
        from: request.from,
        to: request.to,
        filters: request.filters,
        limit: request.limit,
      },
    });
    const parsed = ORDER_MCP_RESULT.parse(result);
    return {
      records: parsed.orders,
      scannedRows: parsed.scannedRows ?? parsed.orders.length,
      dataCutoffAt: new Date(parsed.dataCutoffAt).toISOString(),
      freshness: parsed.freshness,
    };
  }
}
