#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";

const dependencyRequire = createRequire(
  new URL("../../../plugins/dsh-collab-data-orders/package.json", import.meta.url),
);
const { McpServer } = await import(
  pathToFileURL(
    dependencyRequire.resolve("@modelcontextprotocol/sdk/server/mcp.js"),
  )
);
const { StdioServerTransport } = await import(
  pathToFileURL(
    dependencyRequire.resolve("@modelcontextprotocol/sdk/server/stdio.js"),
  )
);
const { z } = await import(
  pathToFileURL(dependencyRequire.resolve("zod"))
);

const fixturePath =
  process.env.ORDERS_DEMO_FIXTURE_PATH?.trim() ||
  fileURLToPath(new URL("./orders-fixture.json", import.meta.url));

function fail(message) {
  throw new Error(`[phone-tablet-demo-oms] ${message}`);
}

async function loadFixture() {
  let parsed;
  try {
    parsed = JSON.parse(await readFile(fixturePath, "utf8"));
  } catch (cause) {
    fail(
      `fixture cannot be loaded from ${fixturePath}: ${
        cause instanceof Error ? cause.message : String(cause)
      }`,
    );
  }
  if (
    parsed === null ||
    typeof parsed !== "object" ||
    !Array.isArray(parsed.orders)
  ) {
    fail("fixture must contain an orders array");
  }
  if (parsed.orders.length > 10_000) {
    fail("fixture exceeds the 10,000 order limit");
  }
  const required = [
    "order_id",
    "ordered_at",
    "order_status",
    "payment_status",
    "region",
    "category",
    "payment_method",
    "channel",
    "merchant",
    "promised_fulfillment_at",
    "amount",
  ];
  for (const [index, order] of parsed.orders.entries()) {
    if (order === null || typeof order !== "object") {
      fail(`orders[${index}] must be an object`);
    }
    for (const field of required) {
      if (!(field in order)) {
        fail(`orders[${index}] is missing ${field}`);
      }
    }
    if (!Number.isFinite(Date.parse(order.ordered_at))) {
      fail(`orders[${index}].ordered_at is invalid`);
    }
    if (!Number.isFinite(Date.parse(order.promised_fulfillment_at))) {
      fail(`orders[${index}].promised_fulfillment_at is invalid`);
    }
  }
  return parsed;
}

const fixture = await loadFixture();

function asFilterValues(value) {
  return Array.isArray(value) ? value : [value];
}

const server = new McpServer(
  { name: "phone-tablet-demo-oms", version: "1.0.0" },
  { capabilities: { tools: { listChanged: false } } },
);

server.registerTool(
  "orders_health",
  {
    title: "Phone and tablet demo OMS health",
    description:
      "Return the read-only mock OMS health, fixture identity, and demo isolation status.",
    inputSchema: {},
  },
  async () => {
    const body = {
      ok: true,
      system: "phone-tablet-demo-oms",
      mode: "demo",
      readOnly: true,
      fixtureId: fixture.fixtureId,
      fixtureVersion: fixture.fixtureVersion,
      snapshotAt: fixture.snapshotAt,
      tools: ["orders_query"],
    };
    return {
      content: [{ type: "text", text: JSON.stringify(body) }],
      structuredContent: body,
    };
  },
);

server.registerTool(
  "orders_query",
  {
    title: "Query phone and tablet demo orders",
    description:
      "Read a bounded order page by ordered time and canonical dimensions. This mock OMS is read-only and demo-only.",
    inputSchema: {
      from: z.string().datetime({ offset: true }),
      to: z.string().datetime({ offset: true }),
      filters: z
        .record(
          z.string(),
          z.union([z.string(), z.array(z.string()).max(100)]),
        )
        .optional(),
      limit: z.number().int().min(1).max(10_000).optional(),
    },
  },
  async ({ from, to, filters = {}, limit = 10_000 }) => {
    const fromMs = Date.parse(from);
    const toMs = Date.parse(to);
    if (
      !Number.isFinite(fromMs) ||
      !Number.isFinite(toMs) ||
      fromMs >= toMs
    ) {
      return {
        isError: true,
        content: [{ type: "text", text: "invalid order time range" }],
      };
    }
    const normalizedFilters = Object.fromEntries(
      Object.entries(filters).map(([key, value]) => [
        key,
        asFilterValues(value).map(String),
      ]),
    );
    const matched = fixture.orders
      .filter((row) => {
        const orderedAt = Date.parse(row.ordered_at);
        if (orderedAt < fromMs || orderedAt > toMs) return false;
        for (const [field, values] of Object.entries(normalizedFilters)) {
          if (!values.includes(String(row[field] ?? ""))) return false;
        }
        return true;
      })
      .slice(0, limit);
    const result = {
      orders: matched,
      dataCutoffAt: new Date().toISOString(),
      freshness: "mock fixture · phone-tablet demo",
      scannedRows: fixture.orders.length,
      truncated: matched.length >= limit,
      source: {
        system: "phone-tablet-demo-oms",
        transport: "mcp",
        demo: true,
        fixtureId: fixture.fixtureId,
      },
    };
    return {
      content: [{ type: "text", text: JSON.stringify(result) }],
      structuredContent: result,
    };
  },
);

const transport = new StdioServerTransport();
await server.connect(transport);
