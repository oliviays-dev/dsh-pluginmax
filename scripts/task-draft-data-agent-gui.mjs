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
      await page.waitForTimeout(150);
    }
    const continueButton = page.getByRole("button", {
      name: "Continue",
      exact: true,
    });
    if (await continueButton.isVisible().catch(() => false)) {
      await continueButton.click();
      await page.waitForTimeout(150);
    }
  }
}

await page.goto(launchUrl, { waitUntil: "domcontentloaded" });
const login = await api("/api/collab/auth/login", {
  method: "POST",
  body: JSON.stringify({ userId: "admin", password: "password-123" }),
});
if (!login.ok) throw new Error(`login failed: ${JSON.stringify(login.body)}`);
await page.evaluate((token) => {
  window.localStorage.setItem("pluginmax.collab.token", token);
  window.localStorage.setItem("pluginmax.collab.userId", "admin");
}, login.body.token);
await page.reload({ waitUntil: "domcontentloaded" });
await page.waitForTimeout(2_500);
await dismissOverlays();

const workspaces = await api("/api/collab/team/workspaces");
const workspaceId = workspaces.body.workspaces?.[0]?.id;
if (typeof workspaceId !== "string" || workspaceId === "") {
  throw new Error("workspace is missing");
}

const prompt = `草稿自动保存切页验证 ${Date.now().toString(36)}`;
await page.evaluate(
  async ({ workspaceId, prompt }) => {
    const token = window.localStorage.getItem("pluginmax.collab.token");
    try {
      await fetch("/api/collab/data-agent/query", {
        method: "POST",
        headers: {
          authorization: `Bearer ${token}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          workspaceId,
          projectId: workspaceId,
          page: "task",
          prompt,
          selections: [],
        }),
        signal: AbortSignal.timeout(1_500),
      });
    } catch {
      // The conversation and user message are committed before the Agent run.
    }
  },
  { workspaceId, prompt },
);
await page.waitForTimeout(1_000);
const conversations = await api(
  `/api/collab/data-agent/conversations?workspaceId=${encodeURIComponent(workspaceId)}&limit=100&offset=0`,
);
const conversation = conversations.body.conversations?.find(
  (item) => item.title === prompt,
);
if (conversation === undefined) {
  throw new Error("Data Agent conversation was not created");
}
const detail = await api(
  `/api/collab/data-agent/conversation?id=${encodeURIComponent(conversation.id)}&workspaceId=${encodeURIComponent(workspaceId)}`,
);
const message = detail.body.messages?.find(
  (item) => item.content === prompt,
);
if (message === undefined) {
  throw new Error("Data Agent message was not created");
}

await page.evaluate(() =>
  window.__pluginmaxSidePanel?.openTab?.("data-agent"),
);
await page.waitForTimeout(500);
await page.evaluate(
  ({ conversation, message, workspaceId }) => {
    window.dispatchEvent(
      new CustomEvent("pluginmax:task-capture-selection", {
        detail: {
          sourceType: "data-agent",
          sourceId: conversation.id,
          sourceTitle: conversation.title,
          workspaceId,
          messageId: message.id,
          text: message.content,
        },
      }),
    );
  },
  { conversation, message, workspaceId },
);

const sidePanel = page.locator("section.pmtc-side-panel:visible").first();
await sidePanel.waitFor();
await sidePanel.locator(".pmtc-cap-autosave.saved").waitFor({
  timeout: 20_000,
});
if (
  (await sidePanel
    .getByRole("button", { name: "保存到草稿箱", exact: true })
    .count()) > 0
) {
  throw new Error("Data Agent draft still requires a manual save");
}

async function matchingLibraryItem() {
  const library = await api(
    `/api/collab/task-capture/library?workspaceId=${encodeURIComponent(workspaceId)}`,
  );
  return library.body.items?.find(
    (item) =>
      item.batch.source.sourceId === conversation.id &&
      item.draft.sourceItemKey === message.id,
  );
}

const first = await matchingLibraryItem();
if (first === undefined) {
  throw new Error("auto-saved Data Agent draft is missing from library");
}

await page.evaluate(() =>
  window.__pluginmaxSidePanel?.openTab?.("data-agent"),
);
await page.waitForTimeout(400);
await page.evaluate(() =>
  window.__pluginmaxSidePanel?.openTab?.("task-drafts"),
);
await sidePanel.locator(".pmtc-cap-autosave.saved").waitFor({
  timeout: 20_000,
});
const restored = await matchingLibraryItem();
if (
  restored === undefined ||
  restored.draft.id !== first.draft.id ||
  restored.draft.title !== first.draft.title
) {
  throw new Error(
    `Data Agent draft was not restored: ${JSON.stringify({ first, restored })}`,
  );
}
await sidePanel.getByText("已存草稿", { exact: true }).waitFor();

await page.screenshot({
  path: resolve(evidenceDir, "task-draft-data-agent-restored-desktop.png"),
  fullPage: true,
});

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
      conversationId: conversation.id,
      messageId: message.id,
      draftId: first.draft.id,
      title: first.draft.title,
      evidence: resolve(
        evidenceDir,
        "task-draft-data-agent-restored-desktop.png",
      ),
    },
    null,
    2,
  ),
);
await browser.close();
