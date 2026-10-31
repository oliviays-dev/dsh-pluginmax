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

  it("keeps the legacy metrics, supply exceptions, and supplier risk bodies", () => {
    const source = readFileSync(CLIENT, "utf8");
    expect(source).toContain("LegacyMetricsBody");
    expect(source).toContain("LegacyControlBody");
    expect(source).toContain("LegacySupplierBody");
    expect(source).toContain("pmwb-metric-trend");
    expect(source).toContain("pmwb-metric-source");
    expect(source).toContain("data.sourceNote");
    expect(source).toContain("dataMode === \"unavailable\"");
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
    expect(source).toContain('task: "任务（个）"');
    expect(source).toContain("pmwb2-ai-load-runtime-trend");
    expect(source).toContain("runtimeTrend.percent");
    expect(source).toContain("minmax(48px,0.82fr)");
    expect(source).toContain("minmax(39px,0.62fr)");
    expect(source).toContain("minmax(80px,1fr) minmax(0,2.6fr)");
    expect(source).toContain("justify-self:end;text-align:right");
    expect(source).toContain("overflow:auto;background:var(--dsw-alias-bg-layer-2)");
    expect(source).toContain("pmwb2-ai-load-divider");
    expect(source).toContain("inactiveSorted");
    expect(source).toContain('item?.state !== "archived"');
    expect(source).not.toContain('item?.systemKey !== "data-agent"');
    expect(source).toContain('"AI伙伴时间范围"');
    expect(source).toContain("titleActions");
    expect(source).toContain('lastActivity: "最近运行时间"');
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
});
