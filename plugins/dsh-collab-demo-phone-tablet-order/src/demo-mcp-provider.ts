import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import type { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import type {
  McpProviderAsset,
  McpToolCallInput,
  McpToolProvider,
} from "dsh-collab-resource-market";
import { z } from "zod";
import {
  DEMO_OMS_MCP_ID,
  DEMO_WMS_MCP_ID,
  actionTicketSecret,
} from "./models.js";

const MCP_OBJECT = z.record(z.string(), z.unknown());
const MCP_TOOLS = z.object({
  tools: z.array(z.object({ name: z.string().min(1) }).passthrough()),
});

interface ConnectedClient {
  readonly client: Client;
  readonly transport: Transport;
}

interface AssetDefinition {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly category: string;
  readonly icon: string;
  readonly permissions: readonly string[];
  readonly tools: readonly string[];
  readonly serverPath: string;
}

const MOCK_ROOT = fileURLToPath(new URL("../mock", import.meta.url));
const DATA_ROOT = fileURLToPath(new URL("../data", import.meta.url));

const ASSETS: readonly AssetDefinition[] = [
  {
    id: DEMO_OMS_MCP_ID,
    name: "Mock 手机平板订单管理系统",
    description:
      "独立手机/平板成品供应链 Demo 的只读 OMS，通过标准 MCP 返回订单事实。",
    category: "履约",
    icon: "database",
    permissions: ["orders.read", "payments.read", "fulfillment.read"],
    tools: ["orders_health", "orders_query"],
    serverPath: join(MOCK_ROOT, "mock-oms-mcp-server.mjs"),
  },
  {
    id: DEMO_WMS_MCP_ID,
    name: "Mock 手机平板成品仓 WMS",
    description:
      "Demo 成品仓 Mock WMS；受 Action Ticket 与人工确认保护的标准 MCP 写工具。",
    category: "仓配",
    icon: "warehouse",
    permissions: [
      "inventory.read",
      "fulfillment.read",
      "business_document.write",
    ],
    tools: [
      "wms_health",
      "wms_rebalance_work_order_get",
      "wms_rebalance_work_order_create",
    ],
    serverPath: join(MOCK_ROOT, "mock-wms-mcp-server.mjs"),
  },
];

function processEnv(extra: Record<string, string>): Record<string, string> {
  return {
    ...Object.fromEntries(
      Object.entries(process.env).filter(
        (entry): entry is [string, string] => entry[1] !== undefined,
      ),
    ),
    ...extra,
  };
}

export class DemoPhoneTabletMcpProvider implements McpToolProvider {
  readonly id = "phone-tablet-demo-mcp-provider";

  private readonly clients = new Map<string, ConnectedClient>();
  private readonly connected = new Map<string, Set<string>>();

  constructor(private readonly fixturePath?: string | undefined) {}

  async list(
    principal: { readonly userId: string },
  ): Promise<readonly McpProviderAsset[]> {
    const connected = this.connected.get(principal.userId) ?? new Set<string>();
    return ASSETS.map((asset) => ({
      id: asset.id,
      name: asset.name,
      description: asset.description,
      category: asset.category,
      protocol: "MCP · stdio",
      toolCount: asset.tools.length,
      publisher: {
        id: "phone-tablet-demo",
        name: "Phone Tablet Demo",
        verified: false,
        kind: "community",
      },
      version: "1.0.0",
      icon: asset.icon,
      permissions: [...asset.permissions],
      initialStatus: "off",
      status: connected.has(asset.id) ? "connected" : "off",
    }));
  }

  async connect(
    principal: { readonly userId: string },
    mcpId: string,
  ): Promise<{ status: "connected" }> {
    await this.ensureConnected(principal.userId, mcpId);
    const connected = this.connected.get(principal.userId) ?? new Set<string>();
    connected.add(mcpId);
    this.connected.set(principal.userId, connected);
    return { status: "connected" };
  }

  async callTool(
    input: McpToolCallInput,
  ): Promise<Record<string, unknown>> {
    const asset = ASSETS.find((candidate) => candidate.id === input.mcpId);
    if (asset === undefined) {
      throw new Error(`unknown demo MCP asset: ${input.mcpId}`);
    }
    if (!asset.tools.includes(input.toolName)) {
      throw new Error(
        `tool ${input.toolName} is not declared by ${input.mcpId}`,
      );
    }
    if (!this.connected.get(input.userId)?.has(input.mcpId)) {
      throw new Error(
        `${input.mcpId} is not connected in the resource market`,
      );
    }
    const connection = await this.ensureConnected(input.userId, input.mcpId);
    const result = await connection.client.request(
      {
        method: "tools/call",
        params: {
          name: input.toolName,
          arguments: input.arguments,
        },
      },
      MCP_OBJECT,
      { timeout: 15_000 },
    );
    if (result.isError === true) {
      throw new Error(this.textContent(result) || "demo MCP tool failed");
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
      if (
        parsed !== null &&
        typeof parsed === "object" &&
        !Array.isArray(parsed)
      ) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      // Fall through to the explicit response contract error.
    }
    throw new Error("demo MCP tool must return structured JSON");
  }

  async dispose(): Promise<void> {
    const connections = [...this.clients.values()];
    this.clients.clear();
    this.connected.clear();
    await Promise.all(
      connections.map(async ({ client, transport }) => {
        await client.close().catch(() => undefined);
        await transport.close().catch(() => undefined);
      }),
    );
  }

  private async ensureConnected(
    userId: string,
    mcpId: string,
  ): Promise<ConnectedClient> {
    const cacheKey = `${userId}\u0000${mcpId}`;
    const cached = this.clients.get(cacheKey);
    if (cached !== undefined) return cached;
    const asset = ASSETS.find((candidate) => candidate.id === mcpId);
    if (asset === undefined) {
      throw new Error(`unknown demo MCP asset: ${mcpId}`);
    }
    const env = processEnv({
      ORDERS_DEMO_FIXTURE_PATH:
        this.fixturePath ??
        process.env.DEMO_ORDERS_FIXTURE_PATH?.trim() ??
        join(DATA_ROOT, "orders-fixture.json"),
      DEMO_WMS_STATE_PATH:
        process.env.DEMO_WMS_STATE_PATH?.trim() ||
        join(process.cwd(), ".tmp", "dsh-phone-tablet-demo-wms-state.json"),
      DEMO_ACTION_TICKET_SECRET: actionTicketSecret(),
    });
    const transport = new StdioClientTransport({
      command: process.execPath,
      args: [asset.serverPath],
      cwd: fileURLToPath(new URL("..", import.meta.url)),
      env,
    });
    const client = new Client(
      { name: "pluginmax-phone-tablet-demo", version: "0.1.0" },
      { capabilities: {} },
    );
    try {
      await client.connect(transport);
      const listed = MCP_TOOLS.parse(
        await client.request(
          { method: "tools/list", params: {} },
          MCP_TOOLS,
          { timeout: 15_000 },
        ),
      );
      const names = new Set(listed.tools.map((tool) => tool.name));
      const missing = asset.tools.filter((tool) => !names.has(tool));
      if (missing.length > 0) {
        throw new Error(
          `${mcpId} is missing MCP tools: ${missing.join(", ")}`,
        );
      }
    } catch (cause) {
      await client.close().catch(() => undefined);
      await transport.close().catch(() => undefined);
      throw new Error(
        cause instanceof Error
          ? `${mcpId} connection failed: ${cause.message}`
          : `${mcpId} connection failed`,
      );
    }
    const connection = { client, transport };
    this.clients.set(cacheKey, connection);
    return connection;
  }

  private textContent(result: Record<string, unknown>): string {
    if (!Array.isArray(result.content)) return "";
    return result.content
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

export async function loadDemoDraft(): Promise<Record<string, unknown>> {
  const value = JSON.parse(
    await readFile(join(DATA_ROOT, "rebalance-work-order.json"), "utf8"),
  ) as unknown;
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("demo rebalance draft must be a JSON object");
  }
  return value as Record<string, unknown>;
}
