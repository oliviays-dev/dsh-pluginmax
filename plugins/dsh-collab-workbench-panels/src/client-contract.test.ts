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
      'grid-template-areas:"name actions" "context context" "meta meta" "sub sub" "owner owner"',
    );
    expect(source).toContain('className: "pmwb-meeting-project"');
    expect(source).toContain("pmwb-meeting-actions");
    expect(source).toContain('className: "pmwb-meeting-context"');
    expect(source).toContain('className: "pmwb-meeting-time"');
    expect(source).toContain('className: "pmwb-meeting-title"');
    expect(source).toContain(
      'navigateTo({ ...item.deepLink, tab: "minutes" })',
    );
    expect(source).toContain('const tab = link.tab === "minutes"');
    expect(source).toContain("...(tab === undefined ? {} : { tab })");
    expect(source).toContain("pmwb-item-focus");
    expect(source).toContain("pmwb-minutes-badge");
    expect(source).toContain('type: "meeting"');
    expect(source).not.toContain("window.__pluginmaxFollow");
    expect(source).not.toContain("标为已读");
    expect(source).not.toContain('"已读"');
    expect(source).toContain(
      'h(FollowButton, {\n            type: item.kind ?? "task"',
    );
    const meetingFollowIndex = source.indexOf(
      'h(FollowButton, { type: "meeting"',
    );
    expect(meetingFollowIndex).toBeGreaterThan(-1);
    expect(source.indexOf('"详情"', meetingFollowIndex)).toBeGreaterThan(
      meetingFollowIndex,
    );
    expect(source).toContain(
      ".pmwb-btn.pmwb2-card-action{height:24px;min-height:24px;padding:1px 8px;border-radius:5px;background:var(--dsw-alias-bg-layer-1);font-size:10px",
    );
    expect(
      (source.match(/pmwb2-card-action/g) ?? []).length,
    ).toBeGreaterThanOrEqual(7);
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
    expect(source).toContain(
      ".pmwb2-kpi-card:only-child{width:100%;max-width:360px",
    );
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
    expect(source).toContain("justify-content:space-between");
    expect(source).toContain(".pmwb2-kpi-card .pmwb-spark{flex:1 1 0");
    expect(source).toContain(
      ".pmwb2-kpi-card .pmwb-metric-label,.pmwb2-kpi-card .pmwb-metric-value,.pmwb2-kpi-card .pmwb-metric-target{flex:0 0 auto",
    );
    expect(source).toContain(
      ".pmwb2-kpi-card .pmwb-spark{flex:1 1 0;height:auto;min-height:6px;max-height:var(--pmwb2-kpi-spark-height)",
    );
    expect(source).toContain(
      "min-height:var(--pmwb2-kpi-card-min-height);overflow:hidden",
    );
    expect(source).not.toContain("min(8cqw,10cqh)");
    expect(source).toContain(".pmwb2-kpi-card.no-spark");
    expect(source).toContain("spark.length > 0");
    expect(source).not.toContain("Math.sqrt(widthScale * heightScale)");
    expect(source).toContain(
      "grid-template-columns:repeat(auto-fit,minmax(180px,1fr))",
    );
    expect(source).not.toContain("pmwb2-kpi-source");
    expect(source).not.toContain("data.sourceNote");
    expect(source).toContain('className: "pmwb2-kpi-panel no-source"');
    expect(source).toContain("height:auto;min-height:0");
    expect(source).toContain(".pmwb2-kpi-panel.no-source");
    expect(source).toContain("pmwb-control-item");
    expect(source).toContain("pmwb-coverage-track");
  });

  it("renders AI partner workload with 24/72 hour windows", () => {
    const source = readFileSync(CLIENT, "utf8");
    expect(source).toContain("AI伙伴负载");
    expect(source).toContain('last24h: { label: "24 小时"');
    expect(source).toContain('last72h: { label: "72 小时"');
    expect(source).toContain("AI_LOAD_COLUMN_LABELS");
    expect(source).toContain('runtime: "时长"');
    expect(source).toContain("AI_LOAD_METRIC_LABELS");
    expect(source).toContain("primaryMetric");
    expect(source).toContain("pmwb2-ai-load-head");
    expect(source).toContain('task: "任务数"');
    expect(source).toContain("pmwb2-ai-load-runtime-trend");
    expect(source).toContain(
      "flex-direction:column;align-items:flex-end;gap:0;overflow:hidden",
    );
    expect(source).toContain("line-height:1.5;text-align:right;font-variant");
    expect(source).toContain("runtimeTrend.percent");
    expect(source).toContain("minmax(46px,0.72fr)");
    expect(source).toContain("minmax(44px,0.62fr)");
    expect(source).toContain(
      "width:100%;min-width:378px;display:grid;grid-template-columns:20px minmax(110px,1.22fr) minmax(220px,2fr)",
    );
    expect(source).toContain(".pmwb2-ai-load-cell.token{min-width:52px");
    expect(source).toContain(
      "font-size:11px;line-height:1.5;text-align:right;font-variant-numeric:tabular-nums",
    );
    expect(source).toContain("font-size:12px;line-height:1.5");
    expect(source).toContain("justify-self:end;text-align:right");
    expect(source).toContain(
      "overflow:auto;background:var(--dsw-alias-bg-layer-2)",
    );
    expect(source).toContain("@container (max-width:380px)");
    expect(source).toContain(
      "min-width:340px;grid-template-columns:16px minmax(92px,1fr) minmax(212px,1.8fr)",
    );
    expect(source).toContain("pmwb2-ai-load-divider");
    expect(source).toContain("inactiveSorted");
    expect(source).toContain('item?.state !== "archived"');
    expect(source).not.toContain('item?.systemKey !== "data-agent"');
    expect(source).toContain('"AI伙伴时间范围"');
    expect(source).toContain("titleActions");
    expect(source).toContain('lastActivity: "最近"');
    expect(source).toContain("dateTimeParts(item.lastActivityAt)");
    expect(source).toContain("AiPartnerAvatar");
    expect(source).toContain("__pluginmaxPendingTeammate");
    expect(source).toContain('detail: { route: "teammates" }');
    expect(source).toContain('"data-data-agent-card": "true"');
    expect(source).toContain(
      '"aria-label": `打开 ${item.name ?? "AI伙伴"} 详情`',
    );
    expect(source).toContain("openTeammate(item)");
    expect(source).toContain("hasRunIn72h");
    expect(source).toContain('className: "pmwb2-ai-load-person-name"');
    expect(source).not.toContain("pmwb2-ai-load-warning");
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
    expect(source).toContain(
      '"aria-label": `打开 ${item.name ?? "AI伙伴"} 详情`',
    );
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
    expect(source).toContain('item.actionLabel.includes("分析")');
    expect(source).toContain("onAnalyze(item)");
    expect(source).toContain("const ICONS = {");
  });

  it("renders Data Agent sessions with project context and AI previews", () => {
    const source = readFileSync(CLIENT, "utf8");
    expect(source).toContain('request("/api/collab/data-agent/conversations")');
    expect(source).toContain("latestAiMessage?.content");
    expect(source).toContain("briefPlainText(");
    expect(source).toContain("const fallbackPreviews = new Map(");
    expect(source).toContain(".slice(0, 12)");
    expect(source).toContain('message.senderType === "ai-partner"');
    expect(source).toContain('className: "pmwb2-data-agent-sessions"');
    expect(source).toContain('className: "pmwb2-data-agent-session"');
    expect(source).toContain("text-overflow:ellipsis;white-space:nowrap");
    expect(source).not.toContain("DATA_AGENT_TITLE_MAX_CHARS");
    expect(source).not.toContain("`项目：${session.projectName");
    expect(source).toContain("-webkit-line-clamp:2");
    expect(source).toContain(
      'type: "data-agent",\n                    id: session.id',
    );
    expect(source).toContain('"data-data-agent-exclude": "true"');
    expect(source).toContain(
      "window.__pluginmaxPendingDataAgentConversation = pending",
    );
    expect(source).toContain(
      'new CustomEvent("pluginmax:data-agent-open-conversation"',
    );
    expect(source).not.toContain('"只读分析"');
    expect(source).not.toContain('"打开 Data Agent"');
  });

  it("renders the concise daily brief and opens details in a side drawer", () => {
    const source = readFileSync(CLIENT, "utf8");
    expect(source).toContain("groupBriefItems");
    expect(source).toContain(
      ".pmwb2-brief-row{width:100%;display:grid;grid-template-columns:minmax(0,1fr) auto;",
    );
    expect(source).toContain(".pmwb2-brief-drawer{");
    expect(source).toContain('className: "pmwb2-brief-detail-action"');
    expect(source).toContain("openDetail(item);");
    expect(source).not.toContain("onClick: () => openDetail(item)");
    expect(source).toContain("function briefFollowTarget(item)");
    expect(source).toContain(
      'if (item?.sourceDomain === "task" || route === "task") {\n        return { type: "brief", id: item.itemId };',
    );
    expect(source).toContain(
      'if (item?.sourceDomain === "workflow" || route === "workflow") {\n        return { type: "brief", id: item.itemId };',
    );
    expect(source).toContain('className: "pmwb2-brief-detail-row"');
    expect(source).toContain("h(FollowButton, {");
    expect(source).toContain('"详情"');
    expect(source).not.toContain('className: "pmwb2-brief-row-time"');
    expect(source.indexOf('className: "pmwb2-brief-detail-row"')).toBeLessThan(
      source.indexOf('className: "pmwb2-brief-row-meta"'),
    );
    expect(source).toContain("onDetail: async (item)");
    expect(source).not.toContain('"本期总结"');
    expect(source).toContain('"项目关键进展"');
    expect(source).toContain('"异常提醒"');
    expect(source).toContain('"待你处理"');
    expect(source).toContain("const PROJECT_NAME_MAX_CHARS = 8");
    expect(source).toContain("function briefProjectCards(");
    expect(source).toContain("function BriefProjectCard(");
    expect(source).toContain("function BriefProjectDrawer(");
    expect(source).toContain("function BriefProjectDetailRow(");
    expect(source).toContain("BRIEF_PROJECT_STATE_FALLBACK");
    expect(source).toContain('className: "pmwb2-brief-project-title"');
    expect(source).toContain('className: "pmwb2-brief-project-state"');
    expect(source).toContain('className: "pmwb2-brief-project-actions"');
    expect(source).toContain('type: "project"');
    expect(source).toContain('subjectLabel: "项目"');
    expect(source).toContain('className: "pmwb-btn pmwb2-card-action"');
    expect(source).not.toContain("AI 概览");
    expect(source).toContain("-webkit-line-clamp:3");
    expect(source).not.toContain("展开项目详情");
    expect(source).toContain("setDetailProject(project)");
    expect(source).toContain("onClick: () => onDetail(project)");
    expect(source).toContain("h(BriefProjectDrawer, {");
    expect(source).not.toContain("pmwb2-brief-row-project");
    expect(source).toContain("const briefCoverageSuffix =");
    expect(source).toContain("metaSuffix: briefCoverageSuffix");
    expect(source).toContain(
      "`覆盖 ${formatTime(legacyPayload.data.awayWindow.from)} - ${formatTime(legacyPayload.data.awayWindow.to)}`",
    );
    expect(source).not.toContain("pmwb2-brief-footer");
    expect(source).not.toContain("覆盖 ${formatTime(data.awayWindow?.from)}");
  });

  it("tags task and workflow anomalies after the brief title", () => {
    const source = readFileSync(CLIENT, "utf8");
    expect(source).toContain("function briefSourceTag(item)");
    expect(source).toContain('return { label: "任务", kind: "task" }');
    expect(source).toContain('return { label: "工作流", kind: "workflow" }');
    expect(source).toContain('item?.deepLink?.route === "task"');
    expect(source).toContain('item?.deepLink?.route === "workflow"');
    expect(source).toContain(
      'kind === "anomaly" ? briefSourceTag(item) : null',
    );
    expect(source).toContain("pmwb2-brief-row-source");
    expect(source.indexOf('className: "pmwb2-brief-row-title"')).toBeLessThan(
      source.indexOf("className: `pmwb2-brief-row-source"),
    );
  });

  it("filters daily brief items by a default-all project selector", () => {
    const source = readFileSync(CLIENT, "utf8");
    expect(source).toContain("function BriefProjectFilter");
    expect(source).toContain("const [briefSelectedProjects");
    expect(source).toContain("const briefProjects = isBrief");
    expect(source).toContain("const effectiveBriefProjects =");
    expect(source).toContain("const filterBriefItems = (items) =>");
    expect(source).toContain(
      "views: {\n                unread: briefUnreadItems",
    );
    expect(source).toContain("pmwb-project-filter-trigger${open");
    expect(source).toContain('type: "checkbox"');
    expect(source).toContain('allSelected ? "清空" : "全选"');
    expect(source).toContain("projects: briefProjects");
    expect(source).toContain("projectCatalog");
    expect(source).toContain(
      "briefProjectNames(\n            legacyPayload.data?.projectCatalog ?? [],\n            legacyPayload.data?.views?.all ?? [],\n          )",
    );
  });

  it("expands the first task evidence row and loads its basics once", () => {
    const source = readFileSync(CLIENT, "utf8");
    expect(source).toContain("function BriefTaskBasicInfo({ taskId })");
    expect(source).toContain("const [open, setOpen] = react.useState(true)");
    expect(source).toContain("const autoLoaded = react.useRef(false)");
    expect(source).toContain("autoLoaded.current = true;");
    expect(source).toContain("void load();");
    expect(source).toContain(
      "if (next && task === null && !loading) void load();",
    );
    expect(source).toContain(
      "/api/collab/tasks/detail?taskId=${encodeURIComponent(taskId)}",
    );
    expect(source).toContain('detailItem.deepLink?.route === "task"');
    expect(source).toContain("taskStateSummary(task).join");
    expect(source).toContain("TASK_PRIORITY_LABELS[task.priority]");
    expect(source).toContain(".slice(0, 3)");
    expect(source).toContain("任务信息加载失败：${error}");
  });

  it("supports marking item-level cards as unread", () => {
    const source = readFileSync(CLIENT, "utf8");
    expect(source).toContain("const markUnread = react.useCallback");
    expect(source).toContain('"已标记为未读"');
    expect(source).toContain('"标为未读"');
    expect(source).toContain("/api/collab/workbench/brief/unread");
    expect(source).toContain('className: "pmwb2-brief-read-action"');
    expect(source.indexOf('className: "pmwb2-brief-read-action"')).toBeLessThan(
      source.indexOf('className: "pmwb2-brief-detail-action"'),
    );
    expect(source).toContain('view === "all" && item.readState === "read"');
    expect(source).toContain("void onUnread(item)");
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
    expect(source).toContain("react.useState(readCurrentUserId)");
    expect(source).toContain(
      'view === "all" && detailItem.readState === "read"',
    );
    expect(source).toContain('showUnreadAction: view === "all"');
  });

  it("renders todo cards with the shared workbench type scale", () => {
    const source = readFileSync(CLIENT, "utf8");
    expect(source).toContain(
      "--pmwb2-text-title:12.5px;--pmwb2-text-body:11.5px;--pmwb2-text-meta:11px;--pmwb2-text-caption:10px",
    );
    expect(source).toContain(".pmwb-item.pmwb-item-todo");
    expect(source).toContain(
      'grid-template-areas:"name actions" "project project" "desc desc" "meta meta"',
    );
    expect(source).toContain("pmwb-todo-actions-main");
    expect(source).toContain("pmwb-todo-name");
    expect(source).toContain("pmwb-todo-project");
    expect(source).toContain("pmwb-todo-description");
    expect(source).toContain("pmwb-todo-meta");
    expect(source).not.toContain('className: "pmwb-todo-id"');
    expect(source.indexOf('className: "pmwb-todo-name"')).toBeLessThan(
      source.indexOf('className: "pmwb-todo-actions"'),
    );
    expect(source).toContain("@container (max-width:280px)");
    expect(source).toContain(
      ".pmwb-todo-name{grid-area:name;color:var(--dsw-alias-label-primary);font-size:var(--pmwb2-text-title);font-weight:650;line-height:var(--pmwb2-title-line)",
    );
    expect(source).toContain(
      ".pmwb-todo-description{grid-area:desc;display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:3;overflow:hidden;color:var(--dsw-alias-label-secondary);font-size:var(--pmwb2-text-body);line-height:var(--pmwb2-body-line)",
    );
    expect(source).toContain(
      ".pmwb-todo-meta{grid-area:meta;display:flex;align-items:center;gap:7px;flex-wrap:wrap;color:var(--dsw-alias-label-secondary);font-size:var(--pmwb2-text-meta);line-height:1.5",
    );
    expect(source).not.toContain(
      "font-size:14px;font-weight:650;line-height:1.3",
    );
    expect(source).not.toContain(
      ".pmwb-todo-description{grid-area:desc;display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:3;overflow:hidden;color:var(--dsw-alias-label-secondary);font-size:13px",
    );
    expect(source).toContain("no-description");
    expect(source).not.toContain("暂无任务描述");
    expect(source).toContain("item.receiverOwnerName");
    expect(source).toContain('item.due ? formatDate(item.due) : "不限"');
  });
});
