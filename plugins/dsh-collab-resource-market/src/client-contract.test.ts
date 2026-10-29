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
});
