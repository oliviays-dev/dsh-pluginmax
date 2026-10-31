#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const DAY_MS = 24 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;

function iso(value) {
  return new Date(value).toISOString();
}

function round(value, precision = 2) {
  const factor = 10 ** precision;
  return Math.round(value * factor) / factor;
}

function demoOrders(now = Date.now()) {
  const regions = ["east", "south", "north"];
  const categories = ["fresh", "digital", "apparel"];
  const channels = ["web", "app", "store"];
  const merchants = ["flagship", "marketplace", "direct"];
  const paymentMethods = ["wallet", "card", "transfer"];
  const rows = [];
  let sequence = 0;
  for (let day = 0; day < 21; day += 1) {
    for (let regionIndex = 0; regionIndex < regions.length; regionIndex += 1) {
      for (
        let categoryIndex = 0;
        categoryIndex < categories.length;
        categoryIndex += 1
      ) {
        for (
          let channelIndex = 0;
          channelIndex < channels.length;
          channelIndex += 1
        ) {
          const variant =
            (day + regionIndex + categoryIndex + channelIndex) % 8;
          const orderedAt =
            now -
            day * DAY_MS -
            (15 + ((sequence * 17) % (18 * 60))) * 60_000;
          const promisedFulfillmentAt =
            orderedAt + ((variant % 3) + 1) * 2 * HOUR_MS;
          const actualFulfillmentAt =
            variant === 0
              ? promisedFulfillmentAt - 20 * 60_000
              : variant === 1 || variant === 6
                ? promisedFulfillmentAt + 90 * 60_000
                : variant === 2
                  ? null
                  : promisedFulfillmentAt - 15 * 60_000;
          const orderStatus =
            variant === 3
              ? "cancelled"
              : variant === 4
                ? "payment_failed"
                : variant === 7
                  ? "pending_payment"
                  : actualFulfillmentAt === null
                    ? "paid"
                    : "fulfilled";
          const paymentStatus =
            variant === 4
              ? "failed"
              : variant === 7
                ? "pending"
                : "succeeded";
          rows.push({
            order_id: `MCP-DEMO-${String(sequence + 1).padStart(6, "0")}`,
            ordered_at: iso(orderedAt),
            paid_at:
              paymentStatus === "succeeded"
                ? iso(orderedAt + 8 * 60_000)
                : null,
            order_status: orderStatus,
            payment_status: paymentStatus,
            region: regions[regionIndex],
            category: categories[categoryIndex],
            payment_method: paymentMethods[(sequence + channelIndex) % 3],
            channel: channels[channelIndex],
            merchant: merchants[(sequence + regionIndex) % 3],
            promised_fulfillment_at: iso(promisedFulfillmentAt),
            actual_fulfillment_at:
              actualFulfillmentAt === null ? null : iso(actualFulfillmentAt),
            refund_status: variant === 6 ? "refunded" : "none",
            amount: round(69 + ((sequence * 37) % 1_900) / 10),
            demo: true,
          });
          sequence += 1;
        }
      }
    }
  }
  return rows;
}

const server = new McpServer(
  { name: "mock-order-management-system", version: "1.0.0" },
  { capabilities: { tools: { listChanged: false } } },
);

server.registerTool(
  "orders_health",
  {
    title: "Order system health",
    description: "Return the read-only mock OMS health and data contract.",
    inputSchema: {},
  },
  async () => ({
    content: [
      {
        type: "text",
        text: JSON.stringify({
          ok: true,
          system: "mock-order-management-system",
          mode: "demo",
          readOnly: true,
          tools: ["orders_query"],
        }),
      },
    ],
    structuredContent: {
      ok: true,
      system: "mock-order-management-system",
      mode: "demo",
      readOnly: true,
      tools: ["orders_query"],
    },
  }),
);

server.registerTool(
  "orders_query",
  {
    title: "Query orders",
    description:
      "Read a bounded order page by ordered time and canonical dimensions. This mock OMS is read-only.",
    inputSchema: {
      from: z.string().datetime({ offset: true }),
      to: z.string().datetime({ offset: true }),
      filters: z
        .record(
          z.string(),
          z.union([
            z.string(),
            z.array(z.string()).max(100),
          ]),
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
        Array.isArray(value) ? value : [value],
      ]),
    );
    const matched = demoOrders()
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
      freshness: "mock MCP · generated on demand",
      scannedRows: demoOrders().length,
      truncated: matched.length >= limit,
      source: {
        system: "mock-order-management-system",
        transport: "mcp",
        demo: true,
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
