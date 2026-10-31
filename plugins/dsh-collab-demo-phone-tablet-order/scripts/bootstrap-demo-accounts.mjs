#!/usr/bin/env node
const baseUrl = process.env.DEMO_BASE_URL?.replace(/\/$/, "");
const launchToken = process.env.DEMO_LAUNCH_TOKEN?.trim();
const workspaceId =
  process.env.DEMO_WORKSPACE_ID?.trim() || "phone-tablet-order-demo";

if (baseUrl === undefined || launchToken === undefined) {
  throw new Error("DEMO_BASE_URL and DEMO_LAUNCH_TOKEN are required");
}

const launch = await fetch(
  `${baseUrl}/?token=${encodeURIComponent(launchToken)}`,
  { redirect: "manual" },
);
const cookies =
  typeof launch.headers.getSetCookie === "function"
    ? launch.headers.getSetCookie()
    : [launch.headers.get("set-cookie") ?? ""];
const cookie = cookies
  .map((value) => value.split(";", 1)[0])
  .filter(Boolean)
  .join("; ");
if (![302, 303].includes(launch.status) || cookie === "") {
  throw new Error(`could not exchange launch token: HTTP ${launch.status}`);
}

async function request(path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: {
      origin: baseUrl,
      cookie,
      ...(options.body === undefined
        ? {}
        : { "content-type": "application/json" }),
      ...(options.token === undefined
        ? {}
        : { authorization: `Bearer ${options.token}` }),
      ...options.headers,
    },
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(`${options.label ?? path}: ${JSON.stringify(payload)}`);
  }
  return payload;
}

const status = await request("/api/collab/auth/status");
if (status.initialized !== true) {
  await request("/api/collab/auth/bootstrap", {
    method: "POST",
    label: "bootstrap linlan",
    body: JSON.stringify({
      userId: "linlan",
      name: "林岚",
      password: "password-123",
    }),
  });
}

async function login(userId, password = "password-123") {
  const payload = await request("/api/collab/auth/login", {
    method: "POST",
    label: `login ${userId}`,
    body: JSON.stringify({ userId, password }),
  });
  if (typeof payload.token !== "string") {
    throw new Error(`login ${userId} did not return a token`);
  }
  return payload.token;
}

const ownerToken = await login("linlan");
for (const user of [
  { userId: "zhouning", name: "周宁", role: "member" },
  { userId: "wangong", name: "王工", role: "member" },
]) {
  try {
    await request("/api/collab/team/users/create", {
      method: "POST",
      token: ownerToken,
      label: `create ${user.userId}`,
      body: JSON.stringify({
        ...user,
        password: "password-123",
      }),
    });
  } catch (cause) {
    if (!String(cause).includes("already exists")) throw cause;
  }
}
const workerToken = await login("zhouning");

for (const member of [
  { userId: "linlan", role: "owner" },
  { userId: "zhouning", role: "member" },
  { userId: "wangong", role: "member" },
]) {
  await request("/api/collab/team/members/set", {
    method: "PUT",
    token: ownerToken,
    label: `member ${member.userId}`,
    body: JSON.stringify({ workspaceId, ...member }),
  });
}

for (const userId of ["linlan", "zhouning", "wangong"]) {
  const token = await login(userId);
  for (const mcpId of [
    "mcp-orders-phone-tablet-demo",
    "mcp-wms-phone-tablet-demo",
  ]) {
    await request("/api/collab/resources/mcps/connect", {
      method: "POST",
      token,
      label: `connect ${mcpId} for ${userId}`,
      body: JSON.stringify({ mcpId }),
    });
  }
}

const teammateList = await request(
  `/api/collab/teammates?scope=all&workspaceId=${encodeURIComponent(workspaceId)}`,
  { token: ownerToken, label: "list AI partners" },
);
let fulfillmentPartner = (teammateList.teammates ?? []).find(
  (teammate) =>
    teammate.name === "履约 AI 伙伴" &&
    teammate.ownerUserId === "zhouning",
);
if (fulfillmentPartner === undefined) {
  const created = await request("/api/collab/teammates/create", {
    method: "POST",
    token: workerToken,
    label: "create fulfillment AI partner",
    body: JSON.stringify({
      source: "personal",
      name: "履约 AI 伙伴",
      role: "订单履约执行",
    }),
  });
  fulfillmentPartner = created.teammate;
}

const taskList = await request(
  `/api/collab/tasks?workspaceId=${encodeURIComponent(workspaceId)}`,
  { token: ownerToken, label: "list tasks" },
);
const existingTitles = new Set(
  (taskList.tasks ?? []).map((task) => task.title),
);
const tasks = [
  {
    title: "[PT-ORD-001] 华东手机/平板订单异常处置",
    priority: "P1",
    status: "todo",
    receiverType: "human",
    receiverId: "zhouning",
    receiverName: "周宁",
    due: "今天 18:00",
    description:
      "管理驾驶舱发现华东手机/平板订单异常率升至 7.6%。请基于 Data Agent 的订单异常 brief 完成处置，聚焦支付失败、取消和履约超时。",
    acceptance: [
      "126 单全部形成明确处置结论",
      "完成成品仓 SKU、IMEI/SN、库存与出库能力核实",
      "人工确认后通过 MCP 创建成品仓订单再平衡工单",
      "输出异常处置复盘与剩余风险",
    ],
  },
  {
    title: "[PT-ORD-001-A] 核实成品仓 SKU/序列号与跨仓履约",
    priority: "P1",
    status: "todo",
    receiverType: "human",
    receiverId: "wangong",
    receiverName: "王工",
    due: "今天 15:30",
    description:
      "核实华东受影响手机/平板订单对应 SKU 的可分配库存、IMEI/SN 状态、出库能力、跨仓库存归属变更、高货值运输交接和签收要求。",
    acceptance: [
      "确认可立即出库、需跨仓调拨和不可履约的订单数量",
      "确认序列号扫描及库存归属变更要求",
      "确认高货值运输交接、保价和签收约束",
    ],
  },
  {
    title: "[PT-ORD-001-B] 生成成品仓订单再平衡工单",
    priority: "P1",
    status: "review",
    receiverType: "agent",
    receiverId: fulfillmentPartner.id,
    receiverName: fulfillmentPartner.name,
    due: "今天 16:30",
    description:
      "结合订单异常范围和成品仓人工核实结果，生成 37 单成品仓订单再平衡工单草稿。提交周宁确认后才可创建业务单据。",
    acceptance: [
      "输出 37 单可再平衡订单范围",
      "预计影响金额 ¥194,125",
      "人工确认后通过 Mock WMS MCP 返回 WO-RB-DEMO-1030-017",
    ],
    autoSubmitReview: false,
  },
  {
    title: "[PT-ORD-001-C] 完成华东手机/平板订单异常处置复盘",
    priority: "P2",
    status: "todo",
    receiverType: "agent",
    receiverId: fulfillmentPartner.id,
    receiverName: fulfillmentPartner.name,
    due: "明天 08:30",
    description:
      "基于 Data Agent QueryRun、任务回执和再平衡工单状态完成正式复盘报告初稿，提交周宁待确认。",
    acceptance: [
      "报告包含数据口径、截止时间、异常构成和证据链",
      "报告包含 126 单处置结果与工单状态",
      "明确剩余风险和待人工确认事项",
    ],
    autoSubmitReview: false,
  },
];
for (const task of tasks) {
  const title = task.title;
  if (existingTitles.has(title)) continue;
  await request("/api/collab/tasks/create", {
    method: "POST",
    token: ownerToken,
    label: `create task ${title}`,
    body: JSON.stringify({
      workspaceId,
      type: "任务",
      links: [],
      autoSubmitReview: true,
      ...task,
    }),
  });
}

console.log(
  JSON.stringify(
    {
      ok: true,
      baseUrl,
      workspaceId,
      users: [
        { userId: "linlan", name: "林岚", role: "owner" },
        { userId: "zhouning", name: "周宁", role: "member" },
        { userId: "wangong", name: "王工", role: "member" },
      ],
      password: "password-123",
      connectedMcps: [
        "mcp-orders-phone-tablet-demo",
        "mcp-wms-phone-tablet-demo",
      ],
      fulfillmentPartnerId: fulfillmentPartner.id,
      taskTitles: tasks.map((task) => task.title),
    },
    null,
    2,
  ),
);
