#!/usr/bin/env node
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";

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

const workOrderByKey = new Map();
const workOrderById = new Map();

const server = new McpServer(
  { name: "phone-tablet-demo-wms", version: "1.0.0" },
  { capabilities: { tools: { listChanged: false } } },
);

function createdPayload(workOrder) {
  return {
    ...workOrder,
    mock: true,
    mode: "demo",
    production: false,
  };
}

server.registerTool(
  "wms_health",
  {
    title: "Phone and tablet demo WMS health",
    description:
      "Return mock WMS health and explicitly identify the service as non-production.",
    inputSchema: {},
  },
  async () => {
    const body = {
      ok: true,
      system: "phone-tablet-demo-wms",
      mode: "demo",
      production: false,
      tools: [
        "wms_rebalance_work_order_get",
        "wms_rebalance_work_order_create",
      ],
    };
    return {
      content: [{ type: "text", text: JSON.stringify(body) }],
      structuredContent: body,
    };
  },
);

server.registerTool(
  "wms_rebalance_work_order_get",
  {
    title: "Get a mock rebalance work order",
    description: "Get a previously created mock finished-goods rebalance work order by ID.",
    inputSchema: {
      workOrderId: z.string().min(1).max(120),
    },
  },
  async ({ workOrderId }) => {
    const workOrder = workOrderById.get(workOrderId);
    if (workOrder === undefined) {
      return {
        isError: true,
        content: [
          {
            type: "text",
            text: `mock rebalance work order not found: ${workOrderId}`,
          },
        ],
      };
    }
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(createdPayload(workOrder)),
        },
      ],
      structuredContent: createdPayload(workOrder),
    };
  },
);

server.registerTool(
  "wms_rebalance_work_order_create",
  {
    title: "Create a mock finished-goods rebalance work order",
    description:
      "Create a demo-only finished-goods inventory rebalance work order after human confirmation. Idempotent by idempotencyKey.",
    inputSchema: {
      idempotencyKey: z.string().min(1).max(160),
      actionTicketId: z.string().min(1).max(160),
      confirmedBy: z.string().min(1).max(160),
      taskId: z.string().min(1).max(160),
      orderIds: z.array(z.string().min(1).max(160)).min(1).max(500),
      sourceWarehouse: z.string().min(1).max(200),
      targetWarehouse: z.string().min(1).max(200),
      cutoff: z.string().min(1).max(120),
      skuScope: z.array(z.string().min(1).max(200)).max(100).default([]),
      serialBindingRequired: z.boolean().default(true),
      inventoryOwnershipChangeRequired: z.boolean().default(true),
      insuredTransport: z.boolean().default(true),
      identityVerifiedSignature: z.boolean().default(true),
    },
  },
  async (input) => {
    const existing = workOrderByKey.get(input.idempotencyKey);
    if (existing !== undefined) {
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(createdPayload(existing)),
          },
        ],
        structuredContent: createdPayload(existing),
      };
    }
    if (new Set(input.orderIds).size !== input.orderIds.length) {
      return {
        isError: true,
        content: [
          {
            type: "text",
            text: "orderIds must not contain duplicate order IDs",
          },
        ],
      };
    }
    const workOrder = {
      workOrderId: "WO-RB-DEMO-1030-017",
      status: "created",
      statusLabel: "已创建",
      businessSystem: "Mock WMS · 成品仓履约",
      createdAt: new Date().toISOString(),
      createdBy: {
        type: "ai-teammate",
        id: "fulfillment-ai",
        name: "履约 AI 伙伴",
      },
      confirmedBy: {
        type: "human",
        id: input.confirmedBy,
        name: "周宁",
      },
      actionTicketId: input.actionTicketId,
      idempotencyKey: input.idempotencyKey,
      taskId: input.taskId,
      scope: {
        orderCount: input.orderIds.length,
        orderIds: input.orderIds,
        sourceWarehouse: input.sourceWarehouse,
        targetWarehouse: input.targetWarehouse,
        cutoff: input.cutoff,
        skuScope: input.skuScope,
      },
      constraints: {
        serialBindingRequired: input.serialBindingRequired,
        inventoryOwnershipChangeRequired:
          input.inventoryOwnershipChangeRequired,
        insuredTransport: input.insuredTransport,
        identityVerifiedSignature: input.identityVerifiedSignature,
      },
    };
    workOrderByKey.set(input.idempotencyKey, workOrder);
    workOrderById.set(workOrder.workOrderId, workOrder);
    return {
      content: [
        { type: "text", text: JSON.stringify(createdPayload(workOrder)) },
      ],
      structuredContent: createdPayload(workOrder),
    };
  },
);

const transport = new StdioServerTransport();
await server.connect(transport);
