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
import { parse as parseYaml } from "yaml";
import { z } from "zod";
import { PROVIDER_ID } from "./models.js";

const MCP_OBJECT = z.record(z.string(), z.unknown());
const MCP_TOOLS = z.object({
  tools: z.array(z.object({ name: z.string().min(1) }).passthrough()),
});

const toolDefinitionSchema = z.object({
  name: z.string().min(1),
  description: z.string().min(1),
  fields: z.array(z.string().min(1)).min(1),
});

const assetDefinitionSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string().min(1),
  category: z.string().min(1),
  icon: z.string().min(1),
  permissions: z.array(z.string().min(1)).min(1),
  document: z.string().min(1),
  system: z.string().min(1),
  tools: z.array(toolDefinitionSchema).min(1),
});

const configSchema = z.object({
  schemaVersion: z.string().min(1),
  pluginId: z.string().min(1),
  providerId: z.string().min(1),
  fixtureRevision: z.string().min(1),
  assets: z.array(assetDefinitionSchema).length(6),
});

type AssetDefinition = z.infer<typeof assetDefinitionSchema>;

interface ConnectedClient {
  readonly client: Client;
  readonly transport: Transport;
}

const PLUGIN_ROOT = fileURLToPath(new URL("..", import.meta.url));
const SERVER_PATH = join(PLUGIN_ROOT, "mock", "mock-system-mcp-server.mjs");
const CONFIG_PATH = join(PLUGIN_ROOT, "config", "mock-mcp-assets.yaml");

function processEnv(): Record<string, string> {
  return Object.fromEntries(
    Object.entries(process.env).filter(
      (entry): entry is [string, string] => entry[1] !== undefined,
    ),
  );
}

export class AiServer120McpProvider implements McpToolProvider {
  readonly id = PROVIDER_ID;

  private readonly clients = new Map<string, ConnectedClient>();
  private readonly connected = new Map<string, Set<string>>();

  private constructor(private readonly assets: readonly AssetDefinition[]) {}

  static async create(): Promise<AiServer120McpProvider> {
    const config = configSchema.parse(
      parseYaml(await readFile(CONFIG_PATH, "utf8")),
    );
    return new AiServer120McpProvider(config.assets);
  }

  async list(principal: {
    readonly userId: string;
  }): Promise<readonly McpProviderAsset[]> {
    const connected = this.connected.get(principal.userId) ?? new Set<string>();
    return this.assets.map((asset) => ({
      id: asset.id,
      name: asset.name,
      description: asset.description,
      category: asset.category,
      protocol: "MCP · stdio",
      toolCount: asset.tools.length,
      publisher: {
        id: "ai-server-120-demo",
        name: "AI Server 120 Demo",
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

  async disconnect(
    principal: { readonly userId: string },
    mcpId: string,
  ): Promise<void> {
    const connected = this.connected.get(principal.userId);
    connected?.delete(mcpId);
    if (connected?.size === 0) {
      this.connected.delete(principal.userId);
    }
    const cacheKey = `${principal.userId}\u0000${mcpId}`;
    const connection = this.clients.get(cacheKey);
    if (connection === undefined) return;
    this.clients.delete(cacheKey);
    await connection.client.close().catch(() => undefined);
    await connection.transport.close().catch(() => undefined);
  }

  async callTool(input: McpToolCallInput): Promise<Record<string, unknown>> {
    const asset = this.asset(input.mcpId);
    if (!asset.tools.some((tool) => tool.name === input.toolName)) {
      throw new Error(`${input.toolName} is not declared by ${input.mcpId}`);
    }
    if (!this.connected.get(input.userId)?.has(input.mcpId)) {
      throw new Error(`${input.mcpId} is not connected in the resource market`);
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
      throw new Error(this.textContent(result) || "mock MCP tool failed");
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
      // Fall through to the explicit contract error.
    }
    throw new Error("mock MCP tool must return structured JSON");
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

  private asset(mcpId: string): AssetDefinition {
    const asset = this.assets.find((candidate) => candidate.id === mcpId);
    if (asset === undefined) {
      throw new Error(`unknown AI Server 120 mock MCP asset: ${mcpId}`);
    }
    return asset;
  }

  private async ensureConnected(
    userId: string,
    mcpId: string,
  ): Promise<ConnectedClient> {
    const cacheKey = `${userId}\u0000${mcpId}`;
    const cached = this.clients.get(cacheKey);
    if (cached !== undefined) return cached;
    const asset = this.asset(mcpId);
    const transport = new StdioClientTransport({
      command: process.execPath,
      args: [SERVER_PATH, "--system", asset.system],
      cwd: PLUGIN_ROOT,
      env: processEnv(),
    });
    const client = new Client(
      { name: "pluginmax-ai-server-120-mock", version: "0.1.0" },
      { capabilities: {} },
    );
    try {
      await client.connect(transport);
      const listed = MCP_TOOLS.parse(
        await client.request({ method: "tools/list", params: {} }, MCP_TOOLS, {
          timeout: 15_000,
        }),
      );
      const names = new Set(listed.tools.map((tool) => tool.name));
      const missing = asset.tools
        .map((tool) => tool.name)
        .filter((name) => !names.has(name));
      if (missing.length > 0) {
        throw new Error(`${mcpId} is missing tools: ${missing.join(", ")}`);
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
