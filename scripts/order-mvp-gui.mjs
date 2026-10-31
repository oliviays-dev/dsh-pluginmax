import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const playwrightPath =
  process.env.PLAYWRIGHT_PATH ??
  "/Users/oliviayang/.codex/worktrees/batch20a-identity-hardening/pluginmax-platform/node_modules/.pnpm/playwright@1.58.0/node_modules/playwright";
const { chromium } = require(playwrightPath);
const launchToken = process.env.DA_LAUNCH_TOKEN;
const baseUrl = process.env.DA_BASE_URL ?? "http://127.0.0.1:33125";
if (launchToken === undefined || launchToken === "") {
  throw new Error("DA_LAUNCH_TOKEN is required");
}

const evidenceUrl = fileURLToPath(new URL("../.tmp", import.meta.url));
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 960 } });
const consoleErrors = [];
const failedResponses = [];
page.on("console", (message) => {
  if (message.type() === "error") consoleErrors.push(message.text());
});
page.on("pageerror", (error) => consoleErrors.push(error.message));
page.on("response", (response) => {
  if (response.status() >= 400) {
    failedResponses.push(`${response.status()} ${response.url()}`);
  }
});

async function api(path, options = {}) {
  return page.evaluate(
    async ({ path, options }) => {
      const token = window.localStorage.getItem("pluginmax.collab.token") ?? "";
      const response = await fetch(path, {
        ...options,
        headers: {
          ...(options.body === undefined
            ? {}
            : { "content-type": "application/json" }),
          ...(token === "" ? {} : { authorization: `Bearer ${token}` }),
          ...(options.headers ?? {}),
        },
      });
      const body = await response.json().catch(() => ({}));
      return { status: response.status, ok: response.ok, body };
    },
    { path, options },
  );
}

async function login(userId, password = "password-123") {
  const result = await api("/api/collab/auth/login", {
    method: "POST",
    body: JSON.stringify({ userId, password }),
  });
  if (!result.ok) {
    throw new Error(`login failed for ${userId}: ${JSON.stringify(result.body)}`);
  }
  await page.evaluate(
    ({ token, userId }) => {
      window.localStorage.setItem("pluginmax.collab.token", token);
      window.localStorage.setItem("pluginmax.collab.userId", userId);
    },
    { token: result.body.token, userId },
  );
}

async function waitForAssistant(before) {
  const assistant = page.locator(".pmda-message:not(.user)").nth(before);
  await assistant.waitFor({ state: "visible", timeout: 150_000 });
  return (await assistant.innerText()).trim();
}

async function sendMessage(text) {
  const before = await page.locator(".pmda-message:not(.user)").count();
  await page.getByLabel("向 Data Agent 提问").fill(text);
  await page.getByRole("button", { name: "发送", exact: true }).click();
  return waitForAssistant(before);
}

async function openDataAgent() {
  await page.evaluate(() => {
    const button = [...document.querySelectorAll("button")].find(
      (candidate) => candidate.textContent?.trim() === "Continue",
    );
    button?.click();
  });
  await page.waitForTimeout(300);
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const mask = page.locator('[class*="_mask_"]:visible').first();
    if (!(await mask.isVisible().catch(() => false))) break;
    await page.keyboard.press("Escape");
    await page.waitForTimeout(250);
  }
  for (const label of [
    "Continue",
    "Configure later",
    "跳过",
    "稍后",
    "关闭",
    "取消",
  ]) {
    const button = page.getByRole("button", { name: label, exact: true });
    if (await button.isVisible().catch(() => false)) {
      await button.click();
      await page.waitForTimeout(200);
    }
  }
  await page
    .locator('.pmda-action[aria-label="打开 Data Agent"]:visible')
    .first()
    .click();
  await page.getByRole("button", { name: "新会话", exact: true }).click();
}

async function queryRuns() {
  const workspaces = await api("/api/collab/team/workspaces");
  const workspaceId = workspaces.body.workspaces?.[0]?.id;
  if (typeof workspaceId !== "string" || workspaceId === "") {
    throw new Error("workspace is missing");
  }
  const result = await api(
    `/api/collab/data-fabric/query-runs?workspaceId=${encodeURIComponent(workspaceId)}`,
  );
  if (!result.ok) {
    throw new Error(`query run read failed: ${JSON.stringify(result.body)}`);
  }
  return { workspaceId, runs: result.body.runs ?? [] };
}

async function connectOrderMcp() {
  const catalog = await api("/api/collab/resources/mcps?query=%E8%AE%A2%E5%8D%95");
  if (!catalog.ok) {
    throw new Error(`MCP catalog failed: ${JSON.stringify(catalog.body)}`);
  }
  const asset = (catalog.body.mcps ?? []).find(
    (item) => item.id === "mcp-orders-mock",
  );
  if (asset === undefined) {
    throw new Error("Mock OMS MCP is not registered in the resource market");
  }
  const connected = await api("/api/collab/resources/mcps/connect", {
    method: "POST",
    body: JSON.stringify({ mcpId: asset.id }),
  });
  if (!connected.ok || connected.body.install?.status !== "connected") {
    throw new Error(
      `Mock OMS MCP connection failed: ${JSON.stringify(connected.body)}`,
    );
  }
}

try {
  await page.goto(`${baseUrl}/?token=${encodeURIComponent(launchToken)}`, {
    waitUntil: "domcontentloaded",
  });
  const status = await api("/api/collab/auth/status");
  if (status.body.initialized !== true) {
    const bootstrapped = await api("/api/collab/auth/bootstrap", {
      method: "POST",
      body: JSON.stringify({
        userId: "admin",
        name: "Admin",
        password: "password-123",
      }),
    });
    if (!bootstrapped.ok) {
      throw new Error(`identity bootstrap failed: ${JSON.stringify(bootstrapped.body)}`);
    }
  }
  await login("admin");
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.locator('nav[aria-label="全局功能"]').waitFor({ timeout: 20_000 });

  const workspaces = await api("/api/collab/team/workspaces");
  const workspaceId = workspaces.body.workspaces?.[0]?.id;
  if (typeof workspaceId !== "string" || workspaceId === "") {
    throw new Error("isolated workspace was not registered");
  }
  const createMember = await api("/api/collab/team/users/create", {
    method: "POST",
    body: JSON.stringify({
      userId: "order-member",
      name: "Order Member",
      password: "password-123",
      role: "member",
    }),
  });
  if (!createMember.ok && createMember.status !== 409) {
    throw new Error(`member creation failed: ${JSON.stringify(createMember.body)}`);
  }
  const setAdmin = await api("/api/collab/team/members/set", {
    method: "PUT",
    body: JSON.stringify({
      workspaceId,
      userId: "admin",
      role: "owner",
    }),
  });
  if (!setAdmin.ok) {
    throw new Error(`admin membership failed: ${JSON.stringify(setAdmin.body)}`);
  }
  const setMember = await api("/api/collab/team/members/set", {
    method: "PUT",
    body: JSON.stringify({
      workspaceId,
      userId: "order-member",
      role: "member",
    }),
  });
  if (!setMember.ok) {
    throw new Error(`member assignment failed: ${JSON.stringify(setMember.body)}`);
  }
  await connectOrderMcp();
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.locator('nav[aria-label="全局功能"]').waitFor({ timeout: 20_000 });

  await page.waitForTimeout(1_500);
  consoleErrors.length = 0;
  failedResponses.length = 0;

  await page.locator(".pmwb-metric-source").first().waitFor({
    state: "visible",
    timeout: 30_000,
  });
  const metricSource = await page.locator(".pmwb-metric-source").first().innerText();
  const metricCards = await page.locator(".pmwb-metric").allInnerTexts();
  const orderMetric =
    metricCards.find((text) => text.includes("订单准时履约率")) ?? "";
  await page.screenshot({
    path: `${evidenceUrl}/order-workbench-metric.png`,
    fullPage: true,
  });
  if (orderMetric === "") {
    throw new Error(
      `order workbench metric is not visible; source=${metricSource}; cards=${JSON.stringify(metricCards)}`,
    );
  }

  await page
    .locator('nav[aria-label="全局功能"] button')
    .filter({ hasText: "资源市场" })
    .click();
  await page.getByRole("tab", { name: "MCP", exact: true }).click();
  await page.getByText("Mock 订单管理系统", { exact: true }).waitFor({
    state: "visible",
    timeout: 20_000,
  });
  const resourceMarketText = await page.locator(".pmrm-content").innerText();
  if (
    !resourceMarketText.includes("Mock 订单管理系统") ||
    !resourceMarketText.includes("已连接")
  ) {
    throw new Error(
      `Mock OMS MCP is not visible as connected in the resource market: ${resourceMarketText}`,
    );
  }
  await page.screenshot({
    path: `${evidenceUrl}/order-resource-market-mcp.png`,
    fullPage: true,
  });
  await page
    .locator('nav[aria-label="全局功能"] button')
    .filter({ hasText: "工作台" })
    .click();
  await page.locator(".pmwb-metric-source").first().waitFor({
    state: "visible",
    timeout: 20_000,
  });

  await openDataAgent();
  const brief = await sendMessage(
    "今天有没有订单异常？不要选卡片，直接搜索授权订单数据集并查询。请按订单异常 MVP 口径给简短 brief，必须包含范围、认证指标版本、数据截止时间、权限覆盖、QueryRun 证据和不确定性。不要生成报告。",
  );
  if (!/订单异常/.test(brief) || !/QueryRun/.test(brief) || !/数据截止/.test(brief)) {
    throw new Error(`order brief is incomplete: ${brief}`);
  }
  if (!/演示|非生产/.test(brief)) {
    throw new Error(`order brief does not identify demo data: ${brief}`);
  }
  const firstRunSnapshot = await queryRuns();
  const firstConversationRuns = firstRunSnapshot.runs.filter(
    (run) =>
      run.datasetId === "orders-facts" &&
      run.status === "succeeded" &&
      run.conversationId !== undefined,
  );
  if (firstConversationRuns.length === 0) {
    throw new Error("no order QueryRun was recorded");
  }
  await page.screenshot({
    path: `${evidenceUrl}/order-brief-desktop.png`,
    fullPage: true,
  });

  const drilldown = await sendMessage(
    "查看华东生鲜。沿用刚才的时间和异常口径，直接查询并给出下钻 brief。",
  );
  if (!/华东|east/.test(drilldown) || !/生鲜|fresh/.test(drilldown)) {
    throw new Error(`drill-down did not preserve region/category scope: ${drilldown}`);
  }
  if (!/QueryRun/.test(drilldown)) {
    throw new Error(`drill-down is missing QueryRun evidence: ${drilldown}`);
  }
  await page.screenshot({
    path: `${evidenceUrl}/order-brief-drilldown.png`,
    fullPage: true,
  });

  const beforeReportRuns = (await queryRuns()).runs.filter(
    (run) =>
      run.datasetId === "orders-facts" &&
      run.status === "succeeded" &&
      run.conversationId !== undefined,
  );
  const reportBeforeCount = await page.locator(".pmda-report-card").count();
  await page.getByLabel("向 Data Agent 提问").fill(
    "生成一份正式订单异常分析报告。必须复用当前会话已有的 QueryRun 和 QueryResult，不要重新查询；报告要包含范围、口径版本、数据截止、权限覆盖和不确定性。",
  );
  await page.getByRole("button", { name: "发送", exact: true }).click();
  const reportCard = page.locator(".pmda-report-card").nth(reportBeforeCount);
  await reportCard.waitFor({ state: "visible", timeout: 150_000 });
  const reportText = await reportCard.innerText();
  const afterReportRuns = (await queryRuns()).runs.filter(
    (run) =>
      run.datasetId === "orders-facts" &&
      run.status === "succeeded" &&
      run.conversationId !== undefined,
  );
  if (afterReportRuns.length !== beforeReportRuns.length) {
    throw new Error(
      `formal report created a new QueryRun: ${beforeReportRuns.length} -> ${afterReportRuns.length}`,
    );
  }
  const reusedQueryRunId = beforeReportRuns[0]?.id;
  await reportCard.getByRole("button", { name: "浏览报告", exact: true }).click();
  const reportDoc = await page.locator(".pmda-report-doc").innerText();
  if (
    reusedQueryRunId !== undefined &&
    !reportDoc.includes(reusedQueryRunId)
  ) {
    throw new Error(`report does not reference reused QueryRun ${reusedQueryRunId}`);
  }
  await page.screenshot({
    path: `${evidenceUrl}/order-formal-report.png`,
    fullPage: true,
  });
  await page.getByRole("button", { name: "返回对话", exact: true }).click();

  const beforeHtmlRuns = (await queryRuns()).runs.length;
  await page.getByLabel("向 Data Agent 提问").fill("生成 HTML 版");
  await page.getByRole("button", { name: "发送", exact: true }).click();
  await page.getByRole("button", { name: "下载 HTML", exact: true }).last().waitFor({
    state: "visible",
    timeout: 60_000,
  });
  const afterHtmlRuns = (await queryRuns()).runs.length;
  if (afterHtmlRuns !== beforeHtmlRuns) {
    throw new Error("HTML derivation created a new QueryRun");
  }
  await page.screenshot({
    path: `${evidenceUrl}/order-html-derivative.png`,
    fullPage: true,
  });

  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(300);
  const mobileOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
  if (mobileOverflow > 0) {
    throw new Error(`mobile layout overflows by ${mobileOverflow}px`);
  }
  await page.screenshot({
    path: `${evidenceUrl}/order-mobile.png`,
    fullPage: true,
  });

  await login("order-member");
  await connectOrderMcp();
  await page.setViewportSize({ width: 1440, height: 960 });
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.locator('nav[aria-label="全局功能"]').waitFor({ timeout: 20_000 });
  await openDataAgent();
  const partial = await sendMessage(
    "今天全国有没有订单异常？请明确说明我的权限覆盖范围，未覆盖区域不要当作零。",
  );
  if (!/华东/.test(partial) || !/华南/.test(partial)) {
    throw new Error(`partial permission coverage is missing: ${partial}`);
  }
  if (!/未覆盖|授权|权限/.test(partial)) {
    throw new Error(`partial permission warning is missing: ${partial}`);
  }
  const memberRuns = await queryRuns();
  const memberOrderRuns = memberRuns.runs.filter(
    (run) => run.datasetId === "orders-facts" && run.status === "succeeded",
  );
  if (
    memberOrderRuns.length === 0 ||
    !memberOrderRuns[0]?.permissionSummary?.includes("华东")
  ) {
    throw new Error("member QueryRun is missing permission coverage evidence");
  }
  await page.screenshot({
    path: `${evidenceUrl}/order-partial-permission.png`,
    fullPage: true,
  });

  const report = {
    ok: true,
    workspaceId,
    metricSource,
    orderMetric,
    resourceMarketText,
    firstQueryRunId: firstConversationRuns[0]?.id,
    reportSummary: reportText,
    reusedQueryRunId,
    partialBrief: partial,
    consoleErrors,
    failedResponses,
  };
  console.log(JSON.stringify(report, null, 2));
  if (consoleErrors.length > 0 || failedResponses.length > 0) {
    throw new Error(
      `browser errors: ${JSON.stringify({ consoleErrors, failedResponses })}`,
    );
  }
} finally {
  await browser.close();
}
