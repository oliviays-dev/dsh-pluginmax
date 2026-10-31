import { createRequire } from "node:module";
import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";

const require = createRequire(import.meta.url);
const playwrightPath =
  process.env.PLAYWRIGHT_PATH ??
  "/Users/oliviayang/.codex/worktrees/batch20a-identity-hardening/pluginmax-platform/node_modules/.pnpm/playwright@1.58.0/node_modules/playwright";
const { chromium } = require(playwrightPath);
const launchUrl = process.env.TASK_DRAFT_GUI_URL;
if (launchUrl === undefined || launchUrl === "") {
  throw new Error("TASK_DRAFT_GUI_URL is required");
}

const evidenceDir = resolve(
  process.env.TASK_DRAFT_GUI_EVIDENCE ?? ".tmp/task-draft-gui-evidence",
);
await mkdir(evidenceDir, { recursive: true });

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
    throw new Error(
      `login failed for ${userId}: ${JSON.stringify(result.body)}`,
    );
  }
  await page.evaluate(
    ({ token, userId }) => {
      window.localStorage.setItem("pluginmax.collab.token", token);
      window.localStorage.setItem("pluginmax.collab.userId", userId);
    },
    { token: result.body.token, userId },
  );
}

async function createTask(input) {
  const result = await api("/api/collab/tasks/create", {
    method: "POST",
    body: JSON.stringify(input),
  });
  if (!result.ok) {
    throw new Error(`task creation failed: ${JSON.stringify(result.body)}`);
  }
  return result.body.task;
}

async function createDraft(input) {
  const result = await api("/api/collab/task-capture/manual", {
    method: "POST",
    body: JSON.stringify({
      priority: "P2",
      receiverType: "human",
      receiverId: "admin",
      receiverName: "Admin",
      commandId: `gui-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      ...input,
    }),
  });
  if (!result.ok) {
    throw new Error(`draft creation failed: ${JSON.stringify(result.body)}`);
  }
  return result.body.drafts[0];
}

async function dismissOverlays() {
  for (let attempt = 0; attempt < 6; attempt += 1) {
    let dismissed = false;
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
        dismissed = true;
        await page.waitForTimeout(250);
        break;
      }
    }
    const mask = page.locator('[class*="_mask_"]:visible').first();
    const maskVisible = await mask.isVisible().catch(() => false);
    if (!dismissed && !maskVisible) return;
    if (!dismissed) {
      await page.keyboard.press("Escape");
      await page.waitForTimeout(250);
    }
  }
}

await page.goto(launchUrl, { waitUntil: "domcontentloaded" });
await login("admin");
const workspaceResult = await api("/api/collab/team/workspaces");
const workspaceId = workspaceResult.body.workspaces?.[0]?.id;
if (typeof workspaceId !== "string" || workspaceId === "") {
  throw new Error("workspace is missing");
}
const suffix = Date.now().toString(36);
const duplicateTitle = `草稿风险关联验证 ${suffix}`;
await createTask({
  workspaceId,
  title: duplicateTitle,
  type: "任务",
  priority: "P2",
  status: "todo",
  receiverType: "human",
  receiverId: "admin",
  receiverName: "Admin",
  description: "用于验证草稿重复风险行。",
  acceptance: ["可以看到草稿箱中的重复提示"],
  executionPolicy: {
    schemaVersion: 1,
    runtime: {
      selection: "recommended",
      allowedRuntimeIds: [],
      requiredCapabilities: [],
    },
    sourcePolicy: {
      allow: ["workspace"],
      deny: ["private-local-data"],
      citation: "none",
      requirePublishedAt: false,
      requireAccessedAt: false,
    },
    toolPolicy: { allow: [], deny: [], requireApproval: [] },
    evidence: {
      requirePlan: true,
      requireToolEvents: false,
      requireCitations: false,
      requireStructuredSubagents: false,
    },
    humanGates: [],
    budget: {},
  },
  autoSubmitReview: true,
});
await createDraft({
  workspaceId,
  projectId: workspaceId,
  title: `整理供应商交期风险 ${suffix}`,
  description: "汇总本周交期风险并同步采购处理结论。",
  acceptance: ["风险清单已同步"],
});
await createDraft({
  workspaceId,
  projectId: workspaceId,
  title: duplicateTitle,
  description: "与已有任务标题相同，用于验证跨任务风险行。",
  acceptance: ["确认关联或仍然创建"],
});
const needs = await createDraft({
  workspaceId,
  projectId: workspaceId,
  title: `待完善草稿 ${suffix}`,
  description: "用户主动清空验收标准后进入待完善。",
  acceptance: ["临时验收项"],
});
const cleared = await api("/api/collab/task-capture/draft/update", {
  method: "POST",
  body: JSON.stringify({
    workspaceId,
    draftId: needs.id,
    expectedRevision: needs.revision,
    commandId: `clear-${suffix}`,
    patch: { acceptance: [] },
  }),
});
if (!cleared.ok) {
  throw new Error(`draft update failed: ${JSON.stringify(cleared.body)}`);
}
await createDraft({
  workspaceId,
  title: `未归属草稿 ${suffix}`,
  description: "没有项目归属的草稿应进入未归属项目。",
  acceptance: ["可见"],
});

await page.reload({ waitUntil: "domcontentloaded" });
await page.waitForTimeout(1_500);
await dismissOverlays();
await page.evaluate(() => {
  window.__pluginmaxShell?.setRoute?.("task");
});
await page.getByRole("button", { name: /^草稿箱/ }).click();
const inbox = page.locator('[data-page="task-drafts"]');
await page.waitForTimeout(1_000);
if ((await inbox.count()) === 0) {
  console.error(
    JSON.stringify(
      {
        consoleErrors,
        failedResponses,
        body: (await page.locator("body").innerText()).slice(0, 6_000),
      },
      null,
      2,
    ),
  );
  await page.screenshot({
    path: resolve(evidenceDir, "task-draft-inbox-open-failed.png"),
    fullPage: true,
  });
}
await inbox.waitFor({ state: "visible" });
await page.getByRole("heading", { name: /任务草稿箱/ }).waitFor();
await page.getByRole("button", { name: "返回任务管理" }).waitFor();
await page.getByText("未归属项目", { exact: true }).first().waitFor();
await inbox
  .getByRole("button", { name: /Pluginmax smoke/ })
  .first()
  .click();
await page
  .getByRole("button", { name: "关联已有任务", exact: true })
  .first()
  .waitFor();
await page
  .getByRole("button", { name: "仍然创建", exact: true })
  .first()
  .waitFor();
await page.getByText("待创建", { exact: true }).first().waitFor();
await page.getByText("待完善", { exact: true }).first().waitFor();
const inlineTitle = page.locator(".pmtd-title-input:not(:disabled)").first();
const originalInlineTitle = await inlineTitle.inputValue();
const titleUpdate = page.waitForResponse(
  (response) =>
    response.url().includes("/api/collab/task-capture/draft/update") &&
    response.status() === 200,
);
await inlineTitle.fill(`${originalInlineTitle} · 直接编辑`);
await inlineTitle.press("Enter");
await titleUpdate;

const actionMeasurements = await page
  .locator(".pmtd-row")
  .first()
  .locator(".pmtd-action")
  .evaluateAll((nodes) =>
    nodes.map((node) => {
      const style = getComputedStyle(node);
      return {
        width: node.getBoundingClientRect().width,
        fontSize: style.fontSize,
      };
    }),
  );
const headerMeasurements = await inbox.evaluate((node) => {
  const title = node.querySelector(".pmtd-title")?.getBoundingClientRect();
  const newButton = [...node.querySelectorAll(".pmtd-head-actions button")]
    .find((button) => button.textContent?.includes("新建草稿"))
    ?.getBoundingClientRect();
  const search = node.querySelector(".pmtd-search")?.getBoundingClientRect();
  return {
    title: title && { top: title.top, bottom: title.bottom, left: title.left },
    newButton: newButton && {
      top: newButton.top,
      bottom: newButton.bottom,
      left: newButton.left,
    },
    search: search && {
      top: search.top,
      bottom: search.bottom,
      left: search.left,
    },
  };
});
if (
  headerMeasurements.title === undefined ||
  headerMeasurements.newButton === undefined ||
  headerMeasurements.search === undefined ||
  Math.abs(headerMeasurements.title.top - headerMeasurements.search.top) > 24 ||
  headerMeasurements.newButton.left > headerMeasurements.search.left
) {
  throw new Error(
    `desktop header layout failed: ${JSON.stringify(headerMeasurements)}`,
  );
}
if (
  actionMeasurements.length !== 2 ||
  actionMeasurements[0].width !== actionMeasurements[1].width ||
  actionMeasurements[0].fontSize !== actionMeasurements[1].fontSize
) {
  throw new Error(
    `draft action columns are not aligned: ${JSON.stringify(actionMeasurements)}`,
  );
}
const overflow = await page.evaluate(() => ({
  width: window.innerWidth,
  scrollWidth: document.documentElement.scrollWidth,
}));
if (overflow.scrollWidth > overflow.width) {
  throw new Error(`desktop horizontal overflow: ${JSON.stringify(overflow)}`);
}
await page.screenshot({
  path: resolve(evidenceDir, "task-draft-inbox-desktop.png"),
  fullPage: true,
});

await page.getByRole("button", { name: "编辑", exact: true }).first().click();
const editor = page.getByRole("dialog", { name: "编辑任务草稿" });
await editor.waitFor();
for (const forbidden of [
  "Runtime",
  "模型",
  "推理强度",
  "执行策略",
  "自动提交 Review",
  "自动通过 Review",
  "初始状态",
  "任务类型",
]) {
  if ((await editor.getByText(forbidden, { exact: false }).count()) > 0) {
    throw new Error(`draft drawer contains forbidden field: ${forbidden}`);
  }
}
if ((await editor.locator("select[multiple]").count()) > 0) {
  throw new Error("draft drawer uses a native multiple select");
}
await page.screenshot({
  path: resolve(evidenceDir, "task-draft-editor-desktop.png"),
  fullPage: true,
});
await editor.getByRole("button", { name: "取消", exact: true }).click();

await page.getByRole("button", { name: /^批量创建任务/ }).click();
const creator = page.getByRole("dialog", { name: "批量创建任务" });
await creator.waitFor();
await creator.getByText("高级执行设置", { exact: true }).waitFor();
await creator.getByText("待处理", { exact: true }).waitFor();
if (
  (await creator.getByText("自动通过 Review", { exact: false }).count()) > 0
) {
  throw new Error("formal task drawer exposes workflow auto approval");
}
await page.screenshot({
  path: resolve(evidenceDir, "task-draft-creator-desktop.png"),
  fullPage: true,
});
await creator.getByRole("button", { name: /^创建 \d+ 条任务/ }).click();
await creator.waitFor({ state: "hidden", timeout: 20_000 });
await page.getByText(/已创建 \d+ 条正式任务/).waitFor();

await page.setViewportSize({ width: 390, height: 844 });
await page.waitForTimeout(300);
await inbox.evaluate((node) => {
  let parent = node.parentElement;
  while (parent !== null && parent.scrollHeight <= parent.clientHeight + 1) {
    parent = parent.parentElement;
  }
  if (parent !== null) parent.scrollTop = 0;
  window.scrollTo(0, 0);
});
const mobileOverflow = await page.evaluate(() => ({
  width: window.innerWidth,
  scrollWidth: document.documentElement.scrollWidth,
}));
if (mobileOverflow.scrollWidth > mobileOverflow.width) {
  throw new Error(
    `mobile horizontal overflow: ${JSON.stringify(mobileOverflow)}`,
  );
}
const mobileProjectTitle = await inbox
  .locator(".pmtd-detail-copy h2")
  .boundingBox();
if (mobileProjectTitle === null || mobileProjectTitle.width < 180) {
  throw new Error(
    `mobile project title is compressed: ${JSON.stringify(mobileProjectTitle)}`,
  );
}
await page.screenshot({
  path: resolve(evidenceDir, "task-draft-inbox-mobile.png"),
  fullPage: true,
});
await page.locator(".pmtd-action.edit:not(:disabled)").first().click();
const mobileEditor = page.getByRole("dialog", { name: "编辑任务草稿" });
await mobileEditor.waitFor();
const mobileDrawer = await mobileEditor.evaluate((node) => {
  const rect = node.getBoundingClientRect();
  const footer = node
    .querySelector(".pmtd-drawer-foot")
    ?.getBoundingClientRect();
  const body = node.querySelector(".pmtd-drawer-body");
  return {
    width: rect.width,
    viewportWidth: window.innerWidth,
    footerBottom: footer?.bottom ?? 0,
    viewportHeight: window.innerHeight,
    bodyScrollable: (body?.scrollHeight ?? 0) > (body?.clientHeight ?? 0),
  };
});
if (
  Math.round(mobileDrawer.width) !== mobileDrawer.viewportWidth ||
  mobileDrawer.footerBottom > mobileDrawer.viewportHeight + 1 ||
  mobileDrawer.bodyScrollable !== true
) {
  throw new Error(
    `mobile drawer contract failed: ${JSON.stringify(mobileDrawer)}`,
  );
}
await page.screenshot({
  path: resolve(evidenceDir, "task-draft-editor-mobile.png"),
  fullPage: true,
});
await mobileEditor.getByRole("button", { name: "取消", exact: true }).click();

const actionableConsoleErrors = consoleErrors.filter(
  (item) => !item.includes("status of 401 (Unauthorized)"),
);
if (actionableConsoleErrors.length > 0) {
  throw new Error(
    `browser console errors: ${actionableConsoleErrors.join(" | ")}`,
  );
}
const unexpectedFailures = failedResponses.filter(
  (item) => !item.startsWith("404 ") && !item.startsWith("401 "),
);
if (unexpectedFailures.length > 0) {
  throw new Error(
    `unexpected failed responses: ${unexpectedFailures.join(" | ")}`,
  );
}

console.log(
  JSON.stringify(
    {
      ok: true,
      workspaceId,
      evidenceDir,
      actionMeasurements,
      desktopOverflow: overflow,
      mobileOverflow,
    },
    null,
    2,
  ),
);
await browser.close();
