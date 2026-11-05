import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const CLIENT = resolve(import.meta.dirname, "../client/index.js");

describe("resource market client contract", () => {
  it("renders the three platform tabs and the two workbench market tabs", () => {
    const source = readFileSync(CLIENT, "utf8");
    for (const label of [
      "Skill",
      "MCP",
      "工作台市场",
      "工作台方案",
      "功能插件",
    ]) {
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
    expect(source).toContain("function SkillMarketCard");
    expect(source).toContain('kind: "skill"');
    expect(source).toContain('kind: "mcp"');
    expect(source).toContain('params.set("publisher"');
    expect(source).toContain('params.set("compatibility"');
    expect(source).toContain("不会伪造已连接状态");
    expect(source).toContain("pmrm-resource-title");
    expect(source).toContain("pmrm-resource-actions");
    expect(source).toContain("断开连接");
    expect(source).toContain("/api/collab/resources/mcps/disconnect");
  });

  it("uses the shared three-column skill card inventory", () => {
    const source = readFileSync(CLIENT, "utf8");
    expect(source).toContain("pmrm-skill-grid");
    expect(source).toContain("pmrm-skill-card");
    expect(source).not.toContain("pmrm-skill-art");
    expect(source).toContain('"data-skill-tag": "version"');
    expect(source).toContain('"data-skill-tag": "category"');
    expect(source).toContain('"data-skill-tag": "usage"');
    expect(source).toContain('"data-skill-tag": "developer"');
    expect(source).not.toContain('h("strong", null, "版本")');
    expect(source).not.toContain('h("strong", null, "使用量")');
    expect(source).toContain("-webkit-line-clamp:3");
    expect(source).toMatch(/\.pmrm-skill-card\{[^}]*min-height:0/);
    expect(source).toContain("onClick: () => onOpen?.(item)");
    expect(source).toContain("event.stopPropagation()");
    expect(source).toContain("function cleanSkillName");
    expect(source).toContain("平台基线|我的扩展");
    expect(source).toContain("onInstall");
    expect(source).toContain("已安装");
    expect(source).toContain("readSkillZip");
    expect(source).toContain('DecompressionStream("deflate-raw")');
    expect(source).toContain("上传 Skill ZIP");
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

  it("uploads and installs custom skills with instructions", () => {
    const source = readFileSync(CLIENT, "utf8");
    expect(source).toContain("上传 Skill ZIP、SKILL.md 或 .skill.json");
    expect(source).toContain("kind: \"agent-skill\"");
    expect(source).toContain("instructions: markdown");
    expect(source).toContain("openInstallDialog");
    expect(source).toContain("confirmInstall");
    expect(source).toContain("/api/collab/resources/skills");
    expect(source).toContain('registerForm.publisherName.trim() === ""');
  });

  it("installs to the library and optionally batch-adds managed AI partners", () => {
    const source = readFileSync(CLIENT, "utf8");
    expect(source).toContain("同时添加到 AI 伙伴（可选）");
    expect(source).toContain("仅安装到资源库");
    expect(source).toContain("/api/collab/teammates/skills/extend");
    expect(source).toContain("installAgentIds.map");
    expect(source).toContain("item.ownerUserId === userId");
    expect(source).toContain("Promise.allSettled");
  });

  it("supports safe skill uninstall with instance cleanup", () => {
    const source = readFileSync(CLIENT, "utf8");
    expect(source).toContain("openUninstallDialog");
    expect(source).toContain("confirmUninstall");
    expect(source).toContain('"卸载 Skill"');
    expect(source).toContain("/api/collab/resources/skills?id=");
    expect(source).toContain("当前没有 AI 伙伴使用该 Skill");
    expect(source).toContain("确认卸载");
  });
});
