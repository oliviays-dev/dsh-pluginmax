import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const CLIENT = resolve(import.meta.dirname, "../client/index.js");

describe("Data Agent client contract", () => {
  it("registers the global action, selection layer, and shared side panel", () => {
    const source = readFileSync(CLIENT, "utf8");
    expect(source).toContain('ctx.slots.inject("pluginmax.global.actions"');
    expect(source).toContain('id: "pluginmax-data-agent-selection"');
    expect(source).toContain('id: "pluginmax-data-agent-panel"');
    expect(source).toContain(
      'window.__pluginmaxSidePanel?.openTab("data-agent")',
    );
    expect(source).toContain("window.__pluginmaxDataAgentEntityRegistry");
    expect(source).toContain('window.__pluginmaxSidePanel?.registerType?.({');
    expect(source).toContain('type: "data-agent"');
  });

  it("ships adapters for every MVP registered entity", () => {
    const source = readFileSync(CLIENT, "utf8");
    for (const entity of [
      "task",
      "workflow",
      "workflow_node",
      "meeting",
      "metric_card",
    ]) {
      expect(source).toContain(`entityType: "${entity}"`);
    }
    expect(source).toContain('selector: "[data-task-id]"');
    expect(source).toContain('selector: "[data-workflow-id]"');
    expect(source).toContain('selector: "[data-workflow-node-id]"');
    expect(source).toContain('selector: "[data-metric-id]"');
    expect(source).toContain('entityType: "workbench_card"');
    expect(source).toContain('selector: "[data-data-agent-card]"');
    expect(source).toContain("data-data-agent-select");
    expect(source).toContain("[data-data-agent-exclude]");
    expect(source).toContain("left.depth - right.depth");
  });

  it("keeps tab state and only derives HTML on explicit action", () => {
    const source = readFileSync(CLIENT, "utf8");
    expect(source).toContain("reportScroll");
    expect(source).toContain("setPendingSelections");
    expect(source).toContain(
      "from the previous workspace's authorization scope",
    );
    expect(source).toContain("setDraft");
    expect(source).not.toContain('"生成 HTML 版"');
    expect(source).toContain("`${API}/render-html`");
    expect(source).toContain("Markdown + ${report.images?.length ?? 0} 张图");
    expect(source).not.toContain("report.html ?? `<");
  });

  it("renders assistant chat messages as Markdown", () => {
    const source = readFileSync(CLIENT, "utf8");
    expect(source).toContain("function renderMarkdownDocument(");
    expect(source).toContain("function renderChatMarkdown(markdown)");
    expect(source).toContain("renderChatMarkdown(message.content)");
    expect(source).toContain('className: "pmda-chat-md"');
    expect(source).toContain(".pmda-chat-md table");
    expect(source).toContain(".pmda-chat-md strong");
  });

  it("expands the shared panel without collapsing its content width", () => {
    const source = readFileSync(CLIENT, "utf8");
    expect(source).toContain(
      'className: `pmda-panel-root${sidePanel.expanded ? " expanded" : ""}`',
    );
    expect(source).toContain(
      ".pmda-panel{position:relative;width:100%;min-width:0",
    );
    expect(source).not.toContain("width:min(500px,100%)");
    expect(source).toContain(
      ".pmda-panel-root.expanded .pmda-panel{width:100%",
    );
    expect(source).toContain(
      "const becameActive = active && !activeRef.current",
    );
    expect(source).toContain("focusOnOpenRef.current = true");
    expect(source).toContain("inputRef.current?.focus()");
    expect(source).toContain("const newConversationRef = react.useRef(false)");
    expect(source).toContain("if (newConversationRef.current)");
  });

  it("binds the Agent Run before monitoring starts", () => {
    const source = readFileSync(
      resolve(import.meta.dirname, "../src/index.ts"),
      "utf8",
    );
    const bind = source.indexOf("const queuedRun = await service.updateRun");
    const monitor = source.indexOf("monitorRun({", bind);
    expect(bind).toBeGreaterThan(0);
    expect(monitor).toBeGreaterThan(bind);
    expect(source).toContain("run: sent.run");
    expect(source).not.toContain(
      "const run = await service.updateRun(sent.run.id",
    );
    expect(source).toContain("void reconcilePendingRuns({");
    expect(source).toContain("function usedToolsForRun");
    expect(source).toContain('event.type !== "tool.call"');
  });

  it("registers provider-safe executable tool names", () => {
    const source = readFileSync(
      resolve(import.meta.dirname, "../src/index.ts"),
      "utf8",
    );
    expect(source).toContain('name: "entity_read"');
    expect(source).not.toContain('name: "entity.read"');
    expect(source).toContain("使用 entity_read");
    expect(source).toContain("systemText: contextPack.rendered.systemText");
    expect(source).toContain('name: "data_catalog_search"');
    expect(source).toContain('name: "dataset_describe"');
    expect(source).toContain('name: "query_explain"');
    expect(source).toContain('name: "metric_query"');
    expect(source).toContain('name: "dataset_query_readonly"');
    expect(source).toContain('id: "data-capability"');
  });

  it("injects versioned domain skills and persists QueryRun evidence", () => {
    const source = readFileSync(
      resolve(import.meta.dirname, "../src/index.ts"),
      "utf8",
    );
    const service = readFileSync(
      resolve(import.meta.dirname, "../src/service.ts"),
      "utf8",
    );
    expect(source).toContain("dataFabric.skills(");
    expect(source).toContain("Versioned Data Domain Skills");
    expect(source).toContain("queryRunsForAgentRun");
    expect(source).toContain("queryEvidenceFromRuns");
    expect(service).toContain("## 数据范围与查询证据");
    expect(service).toContain("QueryRun");
    expect(service).toContain("permissionSummary");
    expect(service).toContain(
      "queryEvidence: [...(input.queryEvidence ?? [])]",
    );
  });

  it("resolves page selection workspace before the last Data Agent preference", () => {
    const source = readFileSync(CLIENT, "utf8");
    const resolver = source.slice(
      source.indexOf("function workspaceIdFor"),
      source.indexOf(
        "function titleOf",
        source.indexOf("function workspaceIdFor"),
      ),
    );
    const context = resolver.indexOf(
      "window.__pluginmaxSelectionContext?.workspaceId",
    );
    const ambient = resolver.indexOf("window.__pluginmaxDataAgentWorkspaceId");
    const preference = resolver.indexOf(
      "window.localStorage.getItem(WORKSPACE_KEY)",
    );
    expect(context).toBeGreaterThan(0);
    expect(ambient).toBeGreaterThan(context);
    expect(preference).toBeGreaterThan(ambient);
  });

  it("uses one persistent side-panel action for the shared workspace", () => {
    const source = readFileSync(CLIENT, "utf8");
    expect(source).not.toContain('className: "pmda-head"');
    expect(source).toContain('h("span", null, "会话：")');
    expect(source).toContain("justify-content:flex-end");
    expect(source).not.toContain("more: icon");
    expect(source).not.toContain('h("span", null, "工作区")');
    expect(source).toContain("grid-template-columns:minmax(70px,1fr)");
    expect(source).toContain('{ className: "pmda-tab-actions" }');
    expect(source).toContain(
      "height:49px;min-height:49px;padding:6px 8px 0 6px",
    );
    expect(source).toContain(
      ".pmda-tab-panel{width:32px;height:32px;transform:translateY(.5px);}",
    );
    expect(source).toContain(
      ".pmda-tab-panel svg{width:15px;height:15px;}",
    );
    expect(source).toContain(
      'title: snapshot.expanded ? "还原侧边栏" : "展开侧边栏"',
    );
    expect(source).toContain(
      "snapshot.expanded ? ICONS.collapse : ICONS.expand",
    );
    expect(source).toContain(
      'panel: icon(["M4 4h16v16H4Z", "M10 4v16"], 14)',
    );
    expect(source).toContain("activeTabRef.current?.scrollIntoView?.(");
    expect(source).toContain('"ArrowLeft", "ArrowRight", "Home", "End"');
    expect(source).toContain('"aria-haspopup": "menu"');
    expect(source).toContain(
      "font-size:11px;line-height:1.4;cursor:pointer",
    );
    expect(source).toContain("ICONS[labels[type]]");
    expect(source).toContain("closeOnOutsidePointer");
    expect(source).toContain(
      'const tabs = ["communication", "data-agent", "task-drafts"]',
    );
    expect(source).toContain('panel.openWorkspace(tabs, "communication")');
    expect(source).toContain("if (active) return null");
    expect(source).toContain('"aria-label": "打开侧边栏"');
    expect(source).toContain("window.__pluginmaxSidePanel?.closeAll()");
    expect(source).toContain("ICONS.panel");
    expect(source).toContain("margin-right:-12px");
    expect(source).not.toContain("--pmda-tab-accent");
    expect(source).toContain("--pmda-tab-width:100px");
    expect(source).toContain("flex:0 0 var(--pmda-tab-width)");
    expect(source).toContain(
      ".pmda-tab.active{color:var(--dsw-alias-label-primary)",
    );
    expect(source).toContain(
      ".pmda-tab.active .pmda-tab-indicator{background:var(--dsw-alias-label-primary);}",
    );
    expect(source).toContain('"data-tab-indicator": "true"');
    expect(source).toContain('["data-agent", "数据洞察"]');
    expect(source).toContain(
      "overflow:hidden;color:var(--dsw-alias-label-secondary);cursor:grab",
    );
    expect(source).toContain(
      ".pmda-tab-main span{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}",
    );
    expect(source).toContain('"data-tab": tab');
    expect(source).toContain("clarificationMode");
    expect(source).toContain("maxRowsPerQuery");
  });

  it("moves Data Agent configuration out of the side panel into AI partner settings", () => {
    const source = readFileSync(CLIENT, "utf8");
    expect(source).not.toContain('"aria-label": "Data Agent 设置"');
    expect(source).not.toContain("setSettingsOpen");
    expect(source).toContain("function DataAgentTeammateSettings");
    expect(source).toContain('"pluginmax.teammate.data-agent-settings"');
    expect(source).toContain('"智能体配置"');
    expect(source).toContain("在 AI伙伴资料编辑中切换");
  });

  it("supports native runtime clarification without a fixed HTML action", () => {
    const source = readFileSync(CLIENT, "utf8");
    expect(source).toContain("useSessionPendingInteraction");
    expect(source).toContain("pending.answer({");
    expect(source).toContain("runtimeSessionId");
    expect(source).not.toContain('"生成 HTML 版"');
    expect(source).toContain("`${API}/render-html`");
  });

  it("shows canonical object identity and marks unresolved cards as page fragments", () => {
    const source = readFileSync(CLIENT, "utf8");
    expect(source).toContain("attachment.entityId");
    expect(source).toContain('"页面片段"');
    expect(source).toContain("data-data-agent-entity");
    expect(source).toContain("data-data-agent-card");
  });

  it("offers task creation beside Data Agent for selected meeting text", () => {
    const source = readFileSync(CLIENT, "utf8");
    expect(source).toContain("pmda-selection-actions");
    expect(source).toContain("创建对应任务");
    expect(source).toContain("pluginmax:task-capture-selection");
    expect(source).toContain("[data-meeting-message-id]");
    expect(source).toContain("selection.taskCapture");
    expect(source).toContain(
      "[data-data-agent-panel='true'], textarea, input, button",
    );
  });

  it("opens captured tasks in the shared task-drafts side panel", () => {
    const source = readFileSync(CLIENT, "utf8");
    expect(source).toContain('"task-drafts": "task"');
    expect(source).toContain('openTab("task-drafts")');
    expect(source).toContain("pluginmax:task-draft-open");
    expect(source).toContain("openNewTab(type)");
    expect(source).toContain("新建侧栏标签");
    expect(source).toContain("reorderTab?.(source, tab)");
    expect(source).toContain("draggable: true");
  });

  it("uses 数据洞察 as the default label and a conversation title when bound", () => {
    const source = readFileSync(CLIENT, "utf8");
    expect(source).toContain('["data-agent", "数据洞察"]');
    expect(source).toContain("result.conversation.title?.trim()");
    expect(source).toContain('"数据洞察会话"');
    expect(source).toContain('title: "新数据洞察"');
  });
});
