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
    expect(source).toContain('window.__pluginmaxSidePanel?.openTab("data-agent")');
    expect(source).toContain('window.__pluginmaxDataAgentEntityRegistry');
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
  });

  it("keeps tab state and only derives HTML on explicit action", () => {
    const source = readFileSync(CLIENT, "utf8");
    expect(source).toContain("reportScroll");
    expect(source).toContain("setPendingSelections");
    expect(source).toContain("setDraft");
    expect(source).toContain("生成 HTML 版");
    expect(source).toContain("`${API}/render-html`");
    expect(source).toContain("Markdown + ${report.images?.length ?? 0} 张图");
    expect(source).not.toContain("report.html ?? `<");
  });
});
