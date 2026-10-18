import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const CLIENT_PATH = resolve(import.meta.dirname, "../client/index.js");

function readNavItems() {
  const source = readFileSync(CLIENT_PATH, "utf8");
  const block = source.match(/const navItems = \[([\s\S]*?)\n    \];/)?.[1];
  if (block === undefined) throw new Error("missing navItems");
  return [...block.matchAll(/\{ key: "([^"]+)", label: "([^"]+)"/g)].map(
    (match) => ({ key: match[1], label: match[2] }),
  );
}

describe("shell client navigation", () => {
  it("keeps the global menu order and the AI伙伴 label", () => {
    expect(readNavItems()).toEqual([
      { key: "workbench", label: "工作台" },
      { key: "projects", label: "项目" },
      { key: "task", label: "任务" },
      { key: "workflow", label: "工作流" },
      { key: "meetings", label: "会议" },
      { key: "teammates", label: "AI伙伴" },
    ]);
  });

  it("localizes disabled-account login failures in both auth entry points", () => {
    const source = readFileSync(CLIENT_PATH, "utf8");
    expect(source).toContain('message === "account is disabled"');
    expect(source).toContain("该账号已停用，请联系管理员启用。");
    expect(
      source.match(/setAuthError\(friendlyAuthError\(cause\)\)/g),
    ).toHaveLength(1);
    expect(
      source.match(/setError\(friendlyAuthError\(cause\)\)/g),
    ).toHaveLength(1);
  });

  it("turns the settings dialog into a single-column layout on phones", () => {
    const source = readFileSync(CLIENT_PATH, "utf8");
    expect(source).toContain("@media (max-width:600px)");
    expect(source).toContain(
      'div[role="presentation"] > div[role="dialog"]:has(> nav)',
    );
    expect(source).toContain("flex-direction:column !important");
  });
});
