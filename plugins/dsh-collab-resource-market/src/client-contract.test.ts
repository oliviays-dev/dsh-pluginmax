import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const CLIENT = resolve(import.meta.dirname, "../client/index.js");

describe("resource market client contract", () => {
  it("renders the three platform tabs and the two workbench market tabs", () => {
    const source = readFileSync(CLIENT, "utf8");
    for (const label of ["Skill", "MCP", "工作台市场", "工作台方案", "功能插件"]) {
      expect(source).toContain(label);
    }
    expect(source).toContain('route !== "resource-market"');
  });

  it("does not implement a second panel loader", () => {
    const source = readFileSync(CLIENT, "utf8");
    expect(source).not.toContain("PanelRegistry");
    expect(source).not.toContain("__pluginmaxPanelRegistry");
  });

  it("uses one resource card contract and exposes market filters", () => {
    const source = readFileSync(CLIENT, "utf8");
    expect(source).toContain("function ResourceAssetCard");
    expect(source).toContain('kind: "skill"');
    expect(source).toContain('kind: "mcp"');
    expect(source).toContain('params.set("publisher"');
    expect(source).toContain('params.set("compatibility"');
    expect(source).toContain("登记连接请求");
    expect(source).toContain("不会伪造已连接状态");
  });

  it("keeps the resource market platform-level and supports preview and custom registration", () => {
    const source = readFileSync(CLIENT, "utf8");
    expect(source).toContain('"AI办公"');
    expect(source).toContain('"自定义"');
    expect(source).toContain("基于当前账号可访问的数据生成只读预览");
    expect(source).toContain("应用到我的工作台");
    expect(source).toContain("注册自定义资源");
    expect(source).toContain("/api/collab/resources/custom");
    expect(source).toContain("props?.renderActions?.()");
    expect(source).not.toContain('"关闭资源市场"');
  });

  it("renders the shared global action slot in the page header", () => {
    const source = readFileSync(CLIENT, "utf8");
    expect(source).toContain('className: "pmrm-global-actions"');
  });
});
