import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const CLIENT_PATH = resolve(import.meta.dirname, "../client/index.js");

function readNavItems() {
  const source = readFileSync(CLIENT_PATH, "utf8");
  const block = source.match(/const navItems = \[([\s\S]*?)\n    \];/)?.[1];
  if (block === undefined) throw new Error("missing navItems");
  return [...block.matchAll(/\{ key: "([^"]+)",\s*label: "([^"]+)"/g)].map(
    (match) => ({ key: match[1], label: match[2] }),
  );
}

describe("shell client navigation", () => {
  function loadProjectScopeController() {
    const source = readFileSync(CLIENT_PATH, "utf8");
    const start = source.indexOf(
      "function createProjectScopeController(sessions, workspaces)",
    );
    const end = source.indexOf("\n    function friendlyAuthError", start);
    if (start < 0 || end < 0)
      throw new Error("missing project scope controller");
    return new Function(
      "window",
      "fetch",
      `${source.slice(start, end)}
      return createProjectScopeController;`,
    ) as (
      window: unknown,
      fetchImpl: typeof globalThis.fetch,
    ) => (
      sessions: {
        search(query: string, signal: AbortSignal): Promise<unknown>;
      },
      workspaces: unknown,
    ) => {
      refresh(): Promise<void>;
      dispose(): void;
    };
  }

  it("merges the workbench entries and keeps the global menu order", () => {
    expect(readNavItems()).toEqual([
      { key: "workbench-new", label: "工作台" },
      { key: "projects", label: "项目" },
      { key: "task", label: "任务" },
      { key: "workflow", label: "工作流" },
      { key: "meetings", label: "沟通" },
      { key: "teammates", label: "AI伙伴" },
      { key: "resource-market", label: "资源市场" },
    ]);
  });

  it("guards New workbench navigation without changing the legacy route", () => {
    const source = readFileSync(CLIENT_PATH, "utf8");
    expect(source).toContain("window.__pluginmaxWorkbenchV2Guard");
    expect(source).toContain('route: "workbench-new"');
    expect(source).toContain('key: "workbench-new"');
    expect(source).not.toContain('key: "workbench", label: "工作台"');
    expect(source).not.toContain("pmx-workbench-switch");
  });

  it("localizes disabled-account login failures in both auth entry points", () => {
    const source = readFileSync(CLIENT_PATH, "utf8");
    expect(source).toContain('message === "account is disabled"');
    expect(source).toContain("该账号已停用，请联系管理员启用。");
    expect(
      source.match(/setAuthError\(friendlyAuthError\(cause\)\)/g),
    ).toHaveLength(1);
    expect(
      source.match(/setError\(friendlyAuthError\(cause\)\)/g),
    ).toHaveLength(1);
  });

  it("turns the settings dialog into a single-column layout on phones", () => {
    const source = readFileSync(CLIENT_PATH, "utf8");
    expect(source).toContain("@media (max-width:600px)");
    expect(source).toContain(
      'div[role="presentation"] > div[role="dialog"]:has(> nav)',
    );
    expect(source).toContain("flex-direction:column !important");
  });

  it("collapses the desktop rail so global task pages stay usable on phones", () => {
    const source = readFileSync(CLIENT_PATH, "utf8");
    expect(source).toContain(
      ".pmx-shell[data-global-route]:not([data-meeting-open])",
    );
    expect(source).toContain(
      "grid-template-columns:72px minmax(0,1fr) 0 0 !important",
    );
  });

  it("registers the root frame synchronously to avoid boot-order races", () => {
    const source = readFileSync(CLIENT_PATH, "utf8");
    const applyStart = source.indexOf("exports.apply = (ctx) =>");
    const registerStart = source.indexOf("ctx.slots.register(", applyStart);
    const registerEnd = source.indexOf("ctx.effect(() =>", registerStart);
    const registration = source.slice(registerStart, registerEnd);
    expect(registration).toContain('name: "root"');
    expect(registration).not.toContain("ctx.effect(");
  });

  it("scopes both workspace navigation and session rows to joined projects", () => {
    const source = readFileSync(CLIENT_PATH, "utf8");
    expect(source).toContain("createProjectScopeController");
    expect(source).toContain(
      'exports.inject = ["slots", "theme", "sessions", "workspaces"]',
    );
    expect(source).toContain('fetch("/api/collab/projects"');
    expect(source).toContain(
      "workspaceSource.getSnapshot = filteredWorkspaces",
    );
    expect(source).toContain("sessionSource.getSnapshot = filteredSessions");
    expect(source).toContain("sessions.search = async (query, signal)");
    expect(source).toContain(".filter((project) => project.isMember === true)");
    expect(source).toContain(
      'window.addEventListener("pluginmax:collab-token", refreshProjectScope)',
    );
  });

  it("refreshes the sidebar project scope when project membership changes", () => {
    const project = readFileSync(
      resolve(import.meta.dirname, "../../dsh-collab-project/client/index.js"),
      "utf8",
    );
    expect(project).toContain(
      'new CustomEvent("pluginmax:project-scope-refresh")',
    );
  });

  it("fails closed and filters workspace, session, current, and search rows", async () => {
    const workspaceSnapshot = {
      items: [
        {
          workspaceId: "allowed",
          title: "1102-手机平板订单履约演示",
          sessionIds: ["allowed-session"],
        },
        {
          workspaceId: "excluded",
          title: "Pluginmax smoke",
          sessionIds: ["excluded-session"],
        },
      ],
      archivedSessionIds: [],
      state: "idle",
      phase: "ready",
      error: null,
    };
    const sessionSnapshot = {
      ids: ["allowed-session", "excluded-session", "loose-session"],
      byId: {
        "allowed-session": { id: "allowed-session", displayTitle: "Allowed" },
        "excluded-session": {
          id: "excluded-session",
          displayTitle: "Excluded",
        },
        "loose-session": { id: "loose-session", displayTitle: "Loose" },
      },
      current: "excluded-session",
      phase: "ready",
      subagentsByParent: {
        "allowed-session": { state: "ready" },
        "excluded-session": { state: "ready" },
      },
      jobsBySession: {
        "allowed-session": [{ id: "allowed-job" }],
        "excluded-session": [{ id: "excluded-job" }],
      },
      currentAddress: { parentSessionId: "excluded-session" },
    };
    const workspaceSource = {
      getSnapshot: () => workspaceSnapshot,
      subscribe: () => () => undefined,
    };
    const sessionSource = {
      getSnapshot: () => sessionSnapshot,
      subscribe: () => () => undefined,
    };
    const sessions = {
      list: sessionSource,
      search: async (_query: string, _signal: AbortSignal) => ({
        ok: true,
        value: {
          items: [
            { sessionId: "allowed-session", snippet: "allowed" },
            { sessionId: "excluded-session", snippet: "excluded" },
          ],
          hasMore: false,
        },
      }),
    };
    const workspaces = { list: workspaceSource };
    const localStorage = new Map([["pluginmax.collab.token", "linlan-token"]]);
    const window = {
      localStorage: {
        getItem: (key: string) => localStorage.get(key) ?? null,
      },
    };
    const fetchStub = (async () => ({
      ok: true,
      json: async () => ({
        projects: [
          { workspaceId: "allowed", isMember: true },
          { workspaceId: "excluded", isMember: false },
        ],
      }),
    })) as unknown as typeof fetch;
    const createController = loadProjectScopeController();
    const controller = createController(window, fetchStub)(
      sessions,
      workspaces,
    );

    expect(workspaceSource.getSnapshot()).toMatchObject({ items: [] });
    expect(sessionSource.getSnapshot()).toMatchObject({
      ids: [],
      byId: {},
      current: undefined,
    });

    await controller.refresh();

    const filteredWorkspaces =
      workspaceSource.getSnapshot() as typeof workspaceSnapshot;
    expect(filteredWorkspaces.items.map((item) => item.workspaceId)).toEqual([
      "allowed",
    ]);
    const filteredSessions =
      sessionSource.getSnapshot() as typeof sessionSnapshot;
    expect(filteredSessions.ids).toEqual(["allowed-session"]);
    expect(Object.keys(filteredSessions.byId)).toEqual(["allowed-session"]);
    expect(filteredSessions.current).toBeUndefined();
    expect(filteredSessions.subagentsByParent).toEqual({
      "allowed-session": { state: "ready" },
    });
    expect(filteredSessions.jobsBySession).toEqual({
      "allowed-session": [{ id: "allowed-job" }],
    });
    expect(filteredSessions.currentAddress).toBeUndefined();
    await expect(
      sessions.search("query", new AbortController().signal),
    ).resolves.toMatchObject({
      ok: true,
      value: {
        items: [{ sessionId: "allowed-session" }],
      },
    });
    controller.dispose();
  });

  it("owns the shared Data Agent / communication side-panel state", () => {
    const source = readFileSync(CLIENT_PATH, "utf8");
    const applyStart = source.indexOf("exports.apply = (ctx) =>");
    const registerStart = source.indexOf("ctx.slots.register(", applyStart);
    const registerEnd = source.indexOf("ctx.effect(() =>", registerStart);
    const registration = source.slice(registerStart, registerEnd);
    expect(source).toContain("window.__pluginmaxSidePanel");
    expect(source).toContain('openTab(tab)');
    expect(source).toContain('closeTab(tab)');
    expect(source).toContain("toggleExpanded()");
    expect(registration).toContain('"pluginmax.global.actions": {');
    expect(source).toContain("renderActions: () =>");
    expect(source).toContain('"data-side-panel-expanded"');
  });

  it("uses three quarters of the previous shared side-panel width", () => {
    const source = readFileSync(CLIENT_PATH, "utf8");
    expect(source).toContain("meetingWidth: 375");
    expect(source).not.toContain("meetingWidth: 500");
  });

  it("resizes the side panel without a width floor larger than its default", () => {
    const source = readFileSync(CLIENT_PATH, "utf8");
    expect(source).toContain(
      "const minimum = window.innerWidth <= 900 ? 280 : 320",
    );
    expect(source).toContain(
      "const minimumMainWidth = window.innerWidth <= 900 ? 280 : 360",
    );
    expect(source).toContain(
      "window.innerWidth - sidebarWidth - detailsWidth - minimumMainWidth",
    );
    expect(source).not.toContain("transition:grid-template-columns");
    expect(source).toContain('"aria-label": "调整侧边栏宽度"');
    expect(source).toContain(
      ".pmx-shell[data-meeting-open] .pmx-meeting-resize{display:none;}",
    );
  });

  it("uses the full viewport for an open side panel on mobile", () => {
    const source = readFileSync(CLIENT_PATH, "utf8");
    expect(source).toContain(".pmx-shell[data-meeting-open]{");
    expect(source).toContain("grid-template-columns:0 0 0 0 !important");
    expect(source).toContain(
      ".pmx-shell[data-meeting-open] > .pmx-overlay-track{",
    );
    expect(source).toContain("shell.meetingOpen && !sidePanelExpanded");
  });
});
