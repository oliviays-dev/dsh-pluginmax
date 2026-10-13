import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const CLIENT_PATH = resolve(import.meta.dirname, "../client/index.js");

/**
 * 客户端 bundle 没有类型检查兜底：调用一个不存在的 state setter 会让整个
 * slot 在渲染期抛 ReferenceError，页面直接空白。这里用静态扫描挡住这一类
 * 低级错误（本轮工作流跳转空白即由 `setStatusFilter` 拼写错误引起）。
 */
const ALLOWED_EXTERNAL_SETTERS = new Set([
  "setTimeout",
  "setInterval",
  "setRoute",
  "setState",
  "setValue",
]);

function declaredSetterNames(source: string): Set<string> {
  const declared = new Set<string>();
  const patterns = [
    /const\s*\[\s*[A-Za-z0-9_$]+\s*,\s*([A-Za-z0-9_$]+)\s*\]\s*=\s*react\.use(?:State|Reducer)/g,
    /(?:const|let|var)\s+([A-Za-z0-9_$]+)\s*=\s*(?:async\s*)?(?:\([^)]*\)|[A-Za-z0-9_$]+)\s*=>/g,
    /(?:async\s+)?function\s+([A-Za-z0-9_$]+)\s*\(/g,
  ];
  for (const pattern of patterns) {
    for (const match of source.matchAll(pattern)) {
      if (match[1] !== undefined) declared.add(match[1]);
    }
  }
  return declared;
}

function calledSetterNames(source: string): Set<string> {
  const called = new Set<string>();
  for (const match of source.matchAll(
    /(?<![A-Za-z0-9_$.])set[A-Z][A-Za-z0-9_$]*\s*\(/g,
  )) {
    called.add(match[0].replace(/\s*\($/, ""));
  }
  return called;
}

describe("workflow client state setters", () => {
  it("only calls declared or external state setters", () => {
    const source = readFileSync(CLIENT_PATH, "utf8");
    const declared = declaredSetterNames(source);
    const missing = [...calledSetterNames(source)].filter(
      (name) => !declared.has(name) && !ALLOWED_EXTERNAL_SETTERS.has(name),
    );
    expect(missing).toEqual([]);
  });
});
