import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const CLIENT = resolve(import.meta.dirname, "../client/index.js");

describe("Workbench V2 client contract", () => {
  it("declares and renders the keyed panel slot", () => {
    const source = readFileSync(CLIENT, "utf8");
    expect(source).toContain('"workbench.canvas.panel"');
    expect(source).toContain("kind: \"keyed\"");
    expect(source).toContain("entryKey: panel.pluginId");
    expect(source).toContain('route === "workbench-new"');
  });

  it("uses a compact primary page header", () => {
    const source = readFileSync(CLIENT, "utf8");
    expect(source).toContain("padding:10px 20px 8px");
    expect(source).toContain(
      ".pmwb2-head h1{margin:0;overflow:hidden;text-overflow:ellipsis;font-size:20px;line-height:1.25;white-space:nowrap;}",
    );
  });

  it("keeps old workbench state and routes out of the client", () => {
    const source = readFileSync(CLIENT, "utf8");
    expect(source).not.toContain("dsh-workbench-layouts-v1");
    expect(source).not.toContain('route !== "workbench"');
    expect(source).toContain("window.__pluginmaxWorkbenchV2Guard");
  });

  it("merges legacy actions and supports draggable card sizing", () => {
    const source = readFileSync(CLIENT, "utf8");
    expect(source).toContain("pmwb2-title-trigger");
    expect(source).toContain("编辑工作台");
    expect(source).toContain("pmwb2-scope");
    expect(source).toContain("pmwb2-resize-width");
    expect(source).toContain("pmwb2-resize-height");
    expect(source).toContain("onRuntime");
    expect(source).toContain("配置面板");
    expect(source).toContain("删除面板");
    expect(source).toContain("panelSettings.title");
    expect(source).not.toContain("${panel.span}/6");
    expect(source).toContain("meta?.titleActions ?? null");
    expect(source).not.toContain("pmwb2-card-status");
    expect(source).toContain("布局/设置更新");
    expect(source).toContain("更新人");
    expect(source).toContain("复制来源");
    expect(source).toContain(
      "preference?.defaultWorkbenchId === workbench.id",
    );
    expect(source).not.toContain("取消常用工作台");
    expect(source).toContain("data-workbench-switcher");
    expect(source).toContain("closeOnOutside");
    expect(source).not.toContain("pmwb2-switcher-head");
    expect(source).not.toContain("pmwb2-switcher-foot");
    expect(source).toContain("PluginPreview");
    expect(source).toContain("示例预览");
    expect(source).toContain("添加面板");
    expect(source).toContain("启用并添加面板");
    expect(source).toContain("const resetDraft = () =>");
    expect(source).toContain("setDraftPanels(clone(active.panels))");
    expect(source).toContain("已重置到最近保存版本");
    expect(source).not.toContain('"重做"');
    expect(source).toContain("AI_LOAD_COLUMN_OPTIONS");
    expect(source).toContain("AI_LOAD_METRIC_OPTIONS");
    expect(source).toContain("normalizeAiLoadSettings");
    expect(source).toContain('["task", "任务（个）"]');
    expect(source).not.toContain('["communication", "沟通（次）"]');
    expect(source).not.toContain('["trend", "趋势"]');
    expect(source).toContain("显示列与顺序");
    expect(source).toContain("主指标");
    expect(source).toContain("pluginmax.team-load");
    expect(source).toContain(
      "aiLoad: normalizeAiLoadSettings(panelSettings.aiLoad)",
    );
  });
});
