#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { parse as parseYaml } from "yaml";
import { z } from "zod";

const pluginRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const configPath = join(pluginRoot, "config", "mock-mcp-assets.yaml");
const config = parseYaml(await readFile(configPath, "utf8"));

function readArgument(name) {
  const index = process.argv.indexOf(name);
  return index === -1 ? undefined : process.argv[index + 1];
}

const system = readArgument("--system");
if (system === undefined || system.trim() === "") {
  throw new Error("--system is required");
}

const asset = config.assets.find((candidate) => candidate.system === system);
if (asset === undefined) {
  throw new Error(`unknown mock system: ${system}`);
}

const markdown = await readFile(join(pluginRoot, asset.document), "utf8");
const snapshotMatch =
  /```json\s+mock-mcp-snapshot\s*\r?\n([\s\S]*?)\r?\n```/.exec(markdown);
if (snapshotMatch === null) {
  throw new Error(`${asset.document} does not contain a mock-mcp-snapshot block`);
}
const snapshot = JSON.parse(snapshotMatch[1]);
if (
  snapshot === null ||
  typeof snapshot !== "object" ||
  Array.isArray(snapshot)
) {
  throw new Error(`${asset.document} snapshot must be a JSON object`);
}
const data = snapshot.data;
if (data === null || typeof data !== "object" || Array.isArray(data)) {
  throw new Error(`${asset.document} snapshot.data must be a JSON object`);
}

const argumentShape = {
  projectCode: z.string().optional(),
  salesOrderId: z.string().optional(),
  materialCode: z.string().optional(),
  resourceId: z.string().optional(),
  customerId: z.string().optional(),
  quantity: z.number().int().positive().optional(),
  targetQuantity: z.number().int().positive().optional(),
  scenarioQuantity: z.number().int().positive().optional(),
  delayDays: z.number().int().min(1).max(30).optional(),
};

const server = new McpServer(
  {
    name: `mock-${system.toLowerCase()}-ai-server-120`,
    version: "1.0.0",
  },
  { capabilities: { tools: { listChanged: false } } },
);

for (const tool of asset.tools) {
  server.registerTool(
    tool.name,
    {
      title: tool.name,
      description: tool.description,
      inputSchema: argumentShape,
    },
    async (args) => {
      const selected = Object.fromEntries(
        tool.fields
          .filter((field) => Object.hasOwn(data, field))
          .map((field) => [field, data[field]]),
      );
      const result = {
        ok: true,
        source: {
          system,
          document: asset.document,
          documentId: snapshot.documentId,
          sourceRevision: snapshot.sourceRevision,
          observedAt: snapshot.observedAt,
          isMock: true,
          readOnly: true,
        },
        tool: tool.name,
        requestedArguments: args,
        data: selected,
      };
      return {
        content: [{ type: "text", text: JSON.stringify(result) }],
        structuredContent: result,
      };
    },
  );
}

await server.connect(new StdioServerTransport());
