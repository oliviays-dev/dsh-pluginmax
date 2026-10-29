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
    expect(source).toContain("pmwb-control-item");
    expect(source).toContain("pmwb-coverage-track");
  });

  it("renders AI partner workload with 24/72 hour windows and blockers", () => {
    const source = readFileSync(CLIENT, "utf8");
    expect(source).toContain("AI伙伴负载");
    expect(source).toContain("过去 24 小时");
    expect(source).toContain("过去 72 小时");
    expect(source).toContain("hasRunIn72h");
    expect(source).toContain("blockers");
    expect(source).toContain("过去 72 小时无运行记录");
  });
});
