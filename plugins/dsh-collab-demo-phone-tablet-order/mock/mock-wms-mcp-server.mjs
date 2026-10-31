#!/usr/bin/env node
import {
  createHmac,
  timingSafeEqual,
} from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const MCP_ID = "mcp-wms-phone-tablet-demo";
const TOOL = "wms_rebalance_work_order_create";
const CONSUMER_ID = "fulfillment-ai";
const WORK_ORDER_ID = "WO-RB-DEMO-1030-017";
const SECRET =
  process.env.DEMO_ACTION_TICKET_SECRET?.trim() ||
  "pluginmax-phone-tablet-demo-action-ticket-v1";
const STATE_PATH = resolve(
  process.env.DEMO_WMS_STATE_PATH?.trim() ||
    ".tmp/dsh-phone-tablet-demo-wms-state.json",
);

const actionTicketSchema = z.object({
  id: z.string().min(1).max(160),
  workspaceId: z.string().min(1).max(200),
  taskId: z.string().min(1).max(200),
  mcpId: z.literal(MCP_ID),
  toolName: z.literal(TOOL),
  consumerId: z.string().min(1).max(160),
  confirmedByUserId: z.string().min(1).max(160),
  confirmedByName: z.string().min(1).max(160),
  issuedAt: z.string().datetime({ offset: true }),
  expiresAt: z.string().datetime({ offset: true }),
});

function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value !== null && typeof value === "object") {
    return `{${Object.entries(value)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(
        ([key, item]) => `${JSON.stringify(key)}:${canonicalJson(item)}`,
      )
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function signatureFor(claims) {
  return createHmac("sha256", SECRET)
    .update(canonicalJson(claims))
    .digest("hex");
}

function verifyTicket(input) {
  const parsed = actionTicketSchema.safeParse(input.actionTicket);
  if (!parsed.success) {
    return "a valid actionTicket is required";
  }
  const claims = parsed.data;
  if (input.actionTicketId !== claims.id) {
    return "actionTicketId does not match the signed ticket";
  }
  if (input.taskId !== claims.taskId) {
    return "taskId is outside the action ticket scope";
  }
  if (input.workspaceId !== claims.workspaceId) {
    return "workspaceId is outside the action ticket scope";
  }
  if (claims.consumerId !== CONSUMER_ID || input.consumerId !== CONSUMER_ID) {
    return "only the fulfillment AI partner may create this work order";
  }
  if (claims.consumerId === "data-agent" || input.consumerId === "data-agent") {
    return "Data Agent is denied write access";
  }
  if (input.humanConfirmed !== true) {
    return "human confirmation is required";
  }
  if (
    input.confirmedBy !== claims.confirmedByName ||
    input.confirmedByUserId !== claims.confirmedByUserId
  ) {
    return "human confirmation does not match the signed ticket";
  }
  if (Date.parse(claims.expiresAt) <= Date.now()) {
    return "action ticket has expired";
  }
  const expected = Buffer.from(signatureFor(claims), "hex");
  const actual = Buffer.from(input.actionTicketSignature, "hex");
  if (
    expected.length !== actual.length ||
    !timingSafeEqual(expected, actual)
  ) {
    return "action ticket signature is invalid";
  }
  return null;
}

async function loadState() {
  try {
    const parsed = JSON.parse(await readFile(STATE_PATH, "utf8"));
    if (
      parsed === null ||
      typeof parsed !== "object" ||
      parsed.version !== 1 ||
      parsed.workOrders === null ||
      typeof parsed.workOrders !== "object" ||
      Array.isArray(parsed.workOrders)
    ) {
      throw new Error("state contract is invalid");
    }
    return parsed;
  } catch (cause) {
    if (cause?.code === "ENOENT") {
      return { version: 1, workOrders: {} };
    }
    throw new Error(
      `[phone-tablet-demo-wms] state cannot be loaded from ${STATE_PATH}: ${
        cause instanceof Error ? cause.message : String(cause)
      }`,
    );
  }
}

const state = await loadState();
const byKey = new Map();
const byId = new Map();
for (const workOrder of Object.values(state.workOrders)) {
  if (workOrder?.idempotencyKey) byKey.set(workOrder.idempotencyKey, workOrder);
  if (workOrder?.workOrderId) byId.set(workOrder.workOrderId, workOrder);
}

async function persist() {
  await mkdir(dirname(STATE_PATH), { recursive: true });
  const temporary = `${STATE_PATH}.tmp`;
  await writeFile(
    temporary,
    `${JSON.stringify(
      {
        version: 1,
        workOrders: Object.fromEntries(
          [...byId.entries()].map(([id, workOrder]) => [id, workOrder]),
        ),
      },
      null,
      2,
    )}\n`,
    "utf8",
  );
  await rename(temporary, STATE_PATH);
}

function createdPayload(workOrder) {
  return {
    ...workOrder,
    mock: true,
    mode: "demo",
    production: false,
  };
}

function errorResult(message) {
  return {
    isError: true,
    content: [{ type: "text", text: message }],
  };
}

const server = new McpServer(
  { name: "phone-tablet-demo-wms", version: "1.0.0" },
  { capabilities: { tools: { listChanged: false } } },
);

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
      state: "persistent",
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
    description:
      "Get a previously created mock finished-goods rebalance work order by ID.",
    inputSchema: {
      workOrderId: z.string().min(1).max(120),
    },
  },
  async ({ workOrderId }) => {
    const workOrder = byId.get(workOrderId);
    if (workOrder === undefined) {
      return errorResult(`mock rebalance work order not found: ${workOrderId}`);
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
      "Create a demo-only finished-goods inventory rebalance work order after signed human confirmation. Idempotent by idempotencyKey.",
    inputSchema: {
      idempotencyKey: z.string().min(1).max(160),
      actionTicketId: z.string().min(1).max(160),
      actionTicket: actionTicketSchema,
      actionTicketSignature: z.string().regex(/^[a-f0-9]{64}$/),
      humanConfirmed: z.literal(true),
      confirmedBy: z.string().min(1).max(160),
      confirmedByUserId: z.string().min(1).max(160),
      consumerId: z.string().min(1).max(160),
      taskId: z.string().min(1).max(160),
      workspaceId: z.string().min(1).max(160),
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
    const ticketError = verifyTicket(input);
    if (ticketError !== null) return errorResult(ticketError);
    const existing = byKey.get(input.idempotencyKey);
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
      return errorResult("orderIds must not contain duplicate order IDs");
    }
    if (byId.has(WORK_ORDER_ID)) {
      return errorResult(
        "the fixed demo work order id already exists for a different idempotency key",
      );
    }
    const workOrder = {
      workOrderId: WORK_ORDER_ID,
      status: "created",
      statusLabel: "已创建",
      businessSystem: "Mock WMS · 成品仓履约",
      createdAt: new Date().toISOString(),
      createdBy: {
        type: "ai-teammate",
        id: CONSUMER_ID,
        name: "履约 AI 伙伴",
      },
      confirmedBy: {
        type: "human",
        id: input.confirmedByUserId,
        name: input.confirmedBy,
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
    byKey.set(input.idempotencyKey, workOrder);
    byId.set(workOrder.workOrderId, workOrder);
    await persist();
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
