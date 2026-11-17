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
page.on("console", (message) => {
  if (message.type() === "error") consoleErrors.push(message.text());
});
page.on("pageerror", (error) => consoleErrors.push(error.message));

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
        },
      });
      return {
        status: response.status,
        ok: response.ok,
        body: await response.json().catch(() => ({})),
      };
    },
    { path, options },
  );
}

async function dismissOverlays() {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const configureLater = page.getByRole("button", {
      name: "Configure later",
      exact: true,
    });
    if (await configureLater.isVisible().catch(() => false)) {
      await configureLater.click();
      await page.waitForTimeout(200);
    }
    const continueButton = page.getByRole("button", {
      name: "Continue",
      exact: true,
    });
    if (await continueButton.isVisible().catch(() => false)) {
      await continueButton.click();
      await page.waitForTimeout(200);
    }
  }
}

await page.goto(launchUrl, { waitUntil: "domcontentloaded" });
const login = await api("/api/collab/auth/login", {
  method: "POST",
  body: JSON.stringify({ userId: "admin", password: "password-123" }),
});
if (!login.ok) {
  throw new Error(`login failed: ${JSON.stringify(login.body)}`);
}
await page.evaluate((token) => {
  window.localStorage.setItem("pluginmax.collab.token", token);
  window.localStorage.setItem("pluginmax.collab.userId", "admin");
}, login.body.token);
await page.reload({ waitUntil: "domcontentloaded" });
await page.waitForTimeout(3_000);
await dismissOverlays();
await page.evaluate(() => window.__pluginmaxShell?.setRoute?.("task"));
await page.waitForTimeout(1_000);
await page.evaluate(() =>
  window.__pluginmaxSidePanel?.openNewTab?.("task-drafts"),
);

const sidePanel = page.locator("section.pmtc-side-panel:visible").first();
await sidePanel.waitFor();
const createEmptyDraft = sidePanel.getByRole("button", {
  name: "新建一条任务",
  exact: true,
});
await createEmptyDraft.waitFor();
if (
  (await sidePanel.getByText("本次待办已处理", { exact: true }).count()) > 0 ||
  (await sidePanel
    .getByRole("button", { name: "手动添加一条待办", exact: true })
    .count()) > 0
) {
  throw new Error(
    "manual draft empty state still renders legacy empty controls",
  );
}
await page.screenshot({
  path: resolve(evidenceDir, "task-draft-side-empty-desktop.png"),
  fullPage: true,
});
await createEmptyDraft.click();

const drawer = page.getByRole("dialog", { name: "完善任务草稿" });
await drawer.waitFor();
const drawerGeometry = await page.evaluate(() => {
  const tabs = document
    .querySelector(".pmtc-side-tabs")
    ?.getBoundingClientRect();
  const drawerHead = document
    .querySelector(".pmtc-cap-drawer-head")
    ?.getBoundingClientRect();
  const drawer = document
    .querySelector(".pmtc-cap-drawer")
    ?.getBoundingClientRect();
  const body = document
    .querySelector(".pmtc-side-body")
    ?.getBoundingClientRect();
  const mask = document
    .querySelector(".pmtc-cap-drawer-mask")
    ?.getBoundingClientRect();
  return {
    tabsBottom: tabs?.bottom ?? 0,
    drawerHeadTop: drawerHead?.top ?? 0,
    drawerTop: drawer?.top ?? 0,
    drawerBottom: drawer?.bottom ?? 0,
    drawerLeft: drawer?.left ?? 0,
    drawerRight: drawer?.right ?? 0,
    bodyLeft: body?.left ?? 0,
    bodyRight: body?.right ?? 0,
    maskLeft: mask?.left ?? 0,
    maskRight: mask?.right ?? 0,
    viewportHeight: window.innerHeight,
  };
});
if (
  drawerGeometry.drawerHeadTop < drawerGeometry.tabsBottom - 1 ||
  drawerGeometry.drawerTop < drawerGeometry.tabsBottom - 1 ||
  drawerGeometry.drawerBottom > drawerGeometry.viewportHeight + 1 ||
  drawerGeometry.drawerLeft < drawerGeometry.bodyLeft - 1 ||
  drawerGeometry.drawerRight > drawerGeometry.bodyRight + 1 ||
  drawerGeometry.drawerLeft < drawerGeometry.maskLeft - 1 ||
  drawerGeometry.drawerRight > drawerGeometry.maskRight + 1
) {
  throw new Error(
    `draft drawer overlaps side tabs: ${JSON.stringify(drawerGeometry)}`,
  );
}
const savedTitle = `保存修改验证 ${Date.now().toString(36)}`;
await drawer.getByLabel("草稿标题").fill(savedTitle);
await drawer.getByRole("button", { name: "保存修改", exact: true }).click();
await drawer.waitFor({ state: "hidden" });
await sidePanel
  .getByRole("button", { name: "编辑待办", exact: true })
  .last()
  .click();
await drawer.waitFor();
if ((await drawer.getByLabel("草稿标题").inputValue()) !== savedTitle) {
  throw new Error("save changes did not persist the edited draft title");
}
const receiver = drawer.getByLabel("选择草稿负责人");
await receiver.waitFor();
if (await receiver.isDisabled()) {
  throw new Error("receiver select is disabled after directory loading");
}
const receiverSummary = await receiver.evaluate((select) => ({
  groups: [...select.querySelectorAll("optgroup")].map((group) => ({
    label: group.label,
    count: group.querySelectorAll("option").length,
    names: [...group.querySelectorAll("option")].map((option) =>
      option.textContent?.trim(),
    ),
  })),
  options: [...select.options].map((option) => ({
    value: option.value,
    label: option.textContent?.trim(),
  })),
}));
const humans = receiverSummary.groups.find((group) => group.label === "人员");
const agents = receiverSummary.groups.find((group) => group.label === "AI伙伴");
if ((humans?.count ?? 0) < 3 || (agents?.count ?? 0) < 2) {
  throw new Error(
    `receiver directory is incomplete: ${JSON.stringify(receiverSummary)}`,
  );
}

const agent = receiverSummary.options.find((option) =>
  option.value.startsWith("agent:"),
);
if (agent === undefined) {
  throw new Error("AI partner option is missing");
}
await receiver.selectOption(agent.value);
const due = drawer.getByLabel("草稿截止日期，格式为 yyyy-mm-dd");
if (
  (await due.getAttribute("type")) !== "text" ||
  (await due.getAttribute("placeholder")) !== "yyyy-mm-dd"
) {
  throw new Error("due field does not use yyyy-mm-dd text format");
}
await due.pressSequentially("2026-13-40");
await drawer.getByRole("button", { name: "保存修改", exact: true }).click();
await drawer
  .getByRole("alert")
  .getByText("截止日期请使用 yyyy-mm-dd 格式", { exact: true })
  .waitFor();
if (
  (await sidePanel
    .locator(".pmtc-cap-scroll .pmtc-cap-error")
    .filter({ hasText: "截止日期请使用 yyyy-mm-dd 格式" })
    .count()) > 0
) {
  throw new Error("draft validation error leaked outside the editor drawer");
}
await page.screenshot({
  path: resolve(evidenceDir, "task-draft-side-editor-error-desktop.png"),
  fullPage: true,
});
await due.fill("2026-11-15");
await drawer.getByRole("alert").waitFor({ state: "hidden" });
if ((await due.inputValue()) !== "2026-11-15") {
  throw new Error("due input did not accept yyyy-mm-dd");
}
await page.screenshot({
  path: resolve(evidenceDir, "task-draft-side-receiver-desktop.png"),
  fullPage: true,
});
await drawer.getByRole("button", { name: "保存修改", exact: true }).click();
await drawer.waitFor({ state: "hidden" });
await sidePanel
  .getByRole("button", { name: "保存到草稿箱", exact: true })
  .click();
await sidePanel.getByText(/已保存 \d+ 条任务草稿/).waitFor();

const workspaceResult = await api("/api/collab/team/workspaces");
const workspaceId = workspaceResult.body.workspaces?.[0]?.id;
const inbox = await api(
  `/api/collab/task-capture/inbox?workspaceId=${encodeURIComponent(workspaceId)}`,
);
const latest = inbox.body.items?.[0];
if (latest === undefined) {
  throw new Error("saved draft batch is missing");
}
const batch = await api(
  `/api/collab/task-capture/batch?workspaceId=${encodeURIComponent(workspaceId)}&batchId=${encodeURIComponent(latest.batch.id)}`,
);
const savedDraft = batch.body.drafts?.at(-1);
if (
  savedDraft?.receiverType !== "agent" ||
  savedDraft?.receiverId !== agent.value.slice("agent:".length) ||
  savedDraft?.due !== "2026-11-15"
) {
  throw new Error(
    `saved draft receiver/date mismatch: ${JSON.stringify(savedDraft)}`,
  );
}

const actionableErrors = consoleErrors.filter(
  (item) =>
    !item.includes("status of 401 (Unauthorized)") &&
    !item.includes("syncing inspect providers failed"),
);
if (actionableErrors.length > 0) {
  throw new Error(`browser console errors: ${actionableErrors.join(" | ")}`);
}

console.log(
  JSON.stringify(
    {
      ok: true,
      receiverGroups: receiverSummary.groups.map((group) => ({
        label: group.label,
        count: group.count,
      })),
      selectedAgent: agent.label,
      due: savedDraft.due,
      evidence: resolve(evidenceDir, "task-draft-side-receiver-desktop.png"),
    },
    null,
    2,
  ),
);
await browser.close();
