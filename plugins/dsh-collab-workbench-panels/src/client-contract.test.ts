import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const CLIENT = resolve(import.meta.dirname, "../client/index.js");

describe("built-in workbench panel providers", () => {
  it("registers every built-in plugin as a unique keyed slot entry", () => {
    const source = readFileSync(CLIENT, "utf8");
    expect(source).toContain('ctx.slots.inject("workbench.canvas.panel"');
    expect(source).toContain("key: pluginId");
    const ids = [
      "pluginmax.daily-brief",
      "pluginmax.task-focus",
      "pluginmax.kpi-overview",
      "pluginmax.following",
      "pluginmax.meeting-insights",
      "pluginmax.supply-exceptions",
      "pluginmax.supplier-risk",
      "pluginmax.workflow-runs",
      "pluginmax.team-load",
      "pluginmax.industry-radar",
      "pluginmax.data-agent",
    ];
    for (const id of ids) expect(source).toContain(`"${id}"`);
  });

  it("keeps the legacy task, focus, and meeting interactions", () => {
    const source = readFileSync(CLIENT, "utf8");
    expect(source).toContain("dsh-workbench-read-state-v1");
    expect(source).toContain("focusItemFollowed");
    expect(source).toContain("renderOwnerRow");
    expect(source).toContain("renderMeetingRows");
    expect(source).toContain(
      'navigateTo({ ...item.deepLink, tab: "minutes" })',
    );
    expect(source).toContain('const tab = link.tab === "minutes"');
    expect(source).toContain(
      '...(tab === undefined ? {} : { tab })',
    );
    expect(source).toContain("pmwb-item-focus");
    expect(source).toContain("pmwb-minutes-badge");
    expect(source).toContain('type: "meeting"');
    expect(source).not.toContain("window.__pluginmaxFollow");
    expect(source).not.toContain("标为已读");
    expect(source).not.toContain('"已读"');
    expect(source).toContain(
      "h(FollowButton, {\n            type: item.kind ?? \"task\"",
    );
  });

  it("switches task scope between me and my AI partners", () => {
    const source = readFileSync(CLIENT, "utf8");
    expect(source).toContain("dsh-workbench-todo-scope-v1");
    expect(source).toContain("设置待办范围");
    expect(source).toContain("待办范围");
    expect(source).toContain(`"我和我的 AI 伙伴"`);
    expect(source).toContain("&todoScope=");
    expect(source).toContain('"aria-pressed": todoScope === "me"');
    expect(source).toContain('"aria-pressed": todoScope === "me_and_ai"');
  });

  it("keeps the legacy metrics, supply exceptions, and supplier risk bodies", () => {
    const source = readFileSync(CLIENT, "utf8");
    expect(source).toContain("LegacyMetricsBody");
    expect(source).toContain("LegacyControlBody");
    expect(source).toContain("LegacySupplierBody");
    expect(source).toContain("pmwb-metric-trend");
    expect(source).toContain("pmwb2-kpi-panel");
    expect(source).toContain("pmwb2-kpi-card");
    expect(source).toContain("min-height:174px");
    expect(source).toContain("new ResizeObserver(resize)");
    expect(source).toContain("--pmwb2-kpi-value-size");
    expect(source).toContain(
      '[data-plugin-id="pluginmax.kpi-overview"] .pmwb2-card-body',
    );
    expect(source).toContain(
      '.pmwb2-card.has-height[data-plugin-id="pluginmax.kpi-overview"] .pmwb2-kpi-grid',
    );
    expect(source).toContain(
      '[data-plugin-id="pluginmax.kpi-overview"] .pmwb2-card-body .pmwb2-panel',
    );
    expect(source).toContain("const cardWidth =");
    expect(source).not.toContain("const cardHeight =");
    expect(source).not.toContain("const heightScale =");
    expect(source).toContain("new MutationObserver(resize)");
    expect(source).toContain("window.setTimeout(resize, 120)");
    expect(source).not.toContain("container-type:size");
    expect(source).not.toContain("cqh");
    expect(source).toContain("Math.max(0.68, Math.min(1, widthScale))");
    expect(source).toContain("justify-content:flex-start");
    expect(source).toContain(
      ".pmwb2-kpi-card .pmwb-spark{flex:1 1 auto",
    );
    expect(source).toContain(
      ".pmwb2-kpi-card .pmwb-metric-label,.pmwb2-kpi-card .pmwb-metric-value,.pmwb2-kpi-card .pmwb-metric-target{flex:0 0 auto",
    );
    expect(source).toContain(
      ".pmwb2-kpi-card .pmwb-spark{flex:1 1 auto;height:auto;min-height:var(--pmwb2-kpi-spark-height)",
    );
    expect(source).not.toContain("min(8cqw,10cqh)");
    expect(source).toContain(".pmwb2-kpi-card.no-spark");
    expect(source).toContain("spark.length > 0");
    expect(source).not.toContain(
      ".pmwb2-kpi-card{display:flex;flex-direction:column;justify-content:space-between",
    );
    expect(source).not.toContain("Math.sqrt(widthScale * heightScale)");
    expect(source).toContain(
      'grid-template-columns:repeat(auto-fit,minmax(180px,1fr))',
    );
    expect(source).not.toContain("pmwb2-kpi-source");
    expect(source).not.toContain("data.sourceNote");
    expect(source).toContain(
      'className: "pmwb2-kpi-panel no-source"',
    );
    expect(source).toContain("height:auto;min-height:0");
    expect(source).toContain(".pmwb2-kpi-panel.no-source");
    expect(source).toContain("pmwb-control-item");
    expect(source).toContain("pmwb-coverage-track");
  });

  it("renders AI partner workload with 24/72 hour windows and blockers", () => {
    const source = readFileSync(CLIENT, "utf8");
    expect(source).toContain("AI伙伴负载");
    expect(source).toContain('last24h: { label: "24 小时"');
    expect(source).toContain('last72h: { label: "72 小时"');
    expect(source).toContain("AI_LOAD_COLUMN_LABELS");
    expect(source).toContain("AI_LOAD_METRIC_LABELS");
    expect(source).toContain("primaryMetric");
    expect(source).toContain("pmwb2-ai-load-head");
    expect(source).toContain('task: "任务数"');
    expect(source).toContain("pmwb2-ai-load-runtime-trend");
    expect(source).toContain("runtimeTrend.percent");
    expect(source).toContain("minmax(52px,0.82fr)");
    expect(source).toContain("minmax(44px,0.62fr)");
    expect(source).toContain("minmax(80px,1fr) minmax(0,2.6fr)");
    expect(source).toContain(
      "font-size:11px;line-height:1.5;font-variant-numeric:tabular-nums",
    );
    expect(source).toContain("font-size:12px;line-height:1.5");
    expect(source).toContain("justify-self:end;text-align:right");
    expect(source).toContain("overflow:auto;background:var(--dsw-alias-bg-layer-2)");
    expect(source).toContain("pmwb2-ai-load-divider");
    expect(source).toContain("inactiveSorted");
    expect(source).toContain('item?.state !== "archived"');
    expect(source).not.toContain('item?.systemKey !== "data-agent"');
    expect(source).toContain('"AI伙伴时间范围"');
    expect(source).toContain("titleActions");
    expect(source).toContain('lastActivity: "最近运行"');
    expect(source).toContain("AiPartnerAvatar");
    expect(source).toContain("__pluginmaxPendingTeammate");
    expect(source).toContain('detail: { route: "teammates" }');
    expect(source).toContain('"data-data-agent-card": "true"');
    expect(source).toContain('"aria-label": `打开 ${item.name ?? "AI伙伴"} 详情`');
    expect(source).toContain("openTeammate(item)");
    expect(source).toContain("hasRunIn72h");
    expect(source).toContain("blockers");
    expect(source).not.toContain("相对领跑");
    expect(source).not.toContain("位参与");
    expect(source).not.toContain("pmwb2-ai-load-track");
    expect(source).not.toContain('trend: "趋势"');
    expect(source).not.toContain("communication");
    expect(source).not.toContain("沟通（次）");
    expect(source).not.toContain("观察窗口");
    expect(source).not.toContain("pmwb2-ai-load-inactive");
    expect(source).not.toContain("pmwb2-ai-load-head-action");
    expect(source).not.toContain("pmwb2-ai-load-open");
    expect(source).not.toContain('"操作"');
    expect(source).toMatch(
      /const target = event\?\.detail\?\.instanceId;\s*if \(target === undefined \|\| target === props\.instanceId\) void load\(\);/,
    );
  });

  it("keeps detail navigation on the whole AI partner row", () => {
    const source = readFileSync(CLIENT, "utf8");
    expect(source).toContain("...dataAgentEntityAttributes(item)");
    expect(source).toContain(
      '...dataAgentEntityAttributes({ ...item, kind: "meeting" })',
    );
    expect(source).toContain('"data-data-agent-card": "true"');
    expect(source).toContain("onClick: () => openTeammate(item)");
    expect(source).toContain('"aria-label": `打开 ${item.name ?? "AI伙伴"} 详情`');
    expect(source).not.toContain("pmwb2-ai-load-open");
    expect(source).not.toContain('"操作"');
  });

  it("resolves brief deep links before falling back to page fragments", () => {
    const source = readFileSync(CLIENT, "utf8");
    expect(source).toContain("function dataAgentBriefAttributes(item)");
    expect(source).toContain('route === "task"');
    expect(source).toContain("dataAgentEntityAttributes({");
    expect(source).toContain("summary: item.conclusion ?? item.statusLabel");
    expect(source).toContain("...dataAgentBriefAttributes(item)");
  });

  it("opens brief analysis actions in Data Agent instead of navigating away", () => {
    const source = readFileSync(CLIENT, "utf8");
    expect(source).toContain("briefDataAgentSelection");
    expect(source).toContain(
      'window.__pluginmaxSidePanel?.openTab("data-agent")',
    );
    expect(source).toContain(
      'new CustomEvent("pluginmax:data-agent-selection"',
    );
    expect(source).toContain('prompt: item?.actionLabel ?? "分析原因"');
    expect(source).toContain("item.actionLabel.includes(\"分析\")");
    expect(source).toContain("onAnalyze(item)");
    expect(source).toContain("const ICONS = {");
  });

  it("supports marking item-level cards as unread", () => {
    const source = readFileSync(CLIENT, "utf8");
    expect(source).toContain("const markUnread = react.useCallback");
    expect(source).toContain('"已标记为未读"');
    expect(source).toContain('"标为未读"');
    expect(source).toContain("/api/collab/workbench/brief/unread");
    expect(source).toContain("ctx.showUnreadAction === true && read");
    expect(source).not.toContain("markRead: onRead");
    expect(source).not.toContain("markUnread: onUnread");
    expect(source).toContain("const readStateStore = {");
    expect(source).toContain("readStateStore.commit(next)");
    expect(source).toContain("const current = readStateStore.getSnapshot()");
    expect(source).toContain("isRead,");
    expect(source).toContain(
      "window.setTimeout(() => navigateTo(item.deepLink), 0);",
    );
    expect(source).toContain("react.useSyncExternalStore(");
    expect(source).toContain(
      "react.useState(readCurrentUserId)",
    );
    expect(source).toContain(
      'view === "all" && item.readState === "read"',
    );
    expect(source).toContain("showUnreadAction: view === \"all\"");
  });

  it("renders todo cards with id, title, description and metadata layout", () => {
    const source = readFileSync(CLIENT, "utf8");
    expect(source).toContain(".pmwb-item.pmwb-item-todo");
    expect(source).toContain("pmwb-todo-actions-main");
    expect(source).toContain("pmwb-todo-name");
    expect(source).toContain("pmwb-todo-description");
    expect(source).toContain("pmwb-todo-meta");
    expect(source).toContain("@container (max-width:280px)");
    expect(source).toContain(
      "font-size:14px;font-weight:650;line-height:1.3",
    );
    expect(source).toContain(
      "font-size:13px;line-height:1.6",
    );
    expect(source).toContain(
      "font-size:12px;line-height:1.5",
    );
    expect(source).toContain("no-description");
    expect(source).not.toContain("暂无任务描述");
    expect(source).toContain("item.receiverOwnerName");
    expect(source).toContain("item.due ? formatDate(item.due) : \"不限\"");
  });
});
