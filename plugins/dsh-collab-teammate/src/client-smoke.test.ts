import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const CLIENT_PATH = resolve(import.meta.dirname, "../client/index.js");

interface ClientExports {
  inject?: readonly string[];
  apply?: unknown;
  __test?: {
    runtimeTabs(): readonly { key: string; label: string }[];
    sortPlanTasks(
      tasks: readonly {
        id: string;
        priority: string;
        createdAt: string;
      }[],
    ): readonly { id: string; priority: string; createdAt: string }[];
    planStoragePriority(display: string): string;
    groupTeammateTemplates(
      items: readonly {
        id: string;
        personaId?: string | undefined;
        profileTemplateId?: string | undefined;
        createdAt: string;
      }[],
    ): readonly {
      item: { id: string };
      instanceIds: readonly string[];
    }[];
    markdownTableCells(line: string): readonly string[];
    isMarkdownTableSeparator(line: string): boolean;
  };
}

/** 用最小 window/React 替身执行 bundle，取出导出给测试的纯函数。 */
function loadClientExports(): ClientExports {
  let exports: ClientExports = {};
  const fakeReact = {
    createElement: (type: unknown, props: unknown, ...children: unknown[]) => ({
      type,
      props: props ?? {},
      children,
    }),
    useState: (initial: unknown) => [initial, () => undefined],
    useEffect: () => undefined,
    useCallback: (callback: unknown) => callback,
    useMemo: (callback: () => unknown) => callback(),
    useRef: (value: unknown) => ({ current: value }),
    Fragment: "Fragment",
  };
  const windowStub = {
    __ModuleLoader__: {
      load: (definition: {
        id: string;
        factory: (require: (id: string) => unknown) => unknown;
      }) => {
        exports = definition.factory((id: string) => {
          if (id === "react") return fakeReact;
          throw new Error(`unexpected module: ${id}`);
        }) as ClientExports;
      },
    },
    localStorage: {
      getItem: () => null,
      setItem: () => undefined,
    },
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    setInterval: () => 1,
    clearInterval: () => undefined,
    setTimeout: () => 1,
    clearTimeout: () => undefined,
    document: {
      querySelectorAll: () => [],
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    },
  };
  const source = readFileSync(CLIENT_PATH, "utf8");
  const factory = new Function(
    "window",
    "module",
    "exports",
    source,
  ) as (
    window: unknown,
    module: { exports: unknown },
    exports: unknown,
  ) => void;
  const module = { exports: {} };
  factory(windowStub, module, module.exports);
  return exports;
}

describe("AI Teammate runtime client", () => {
  it("declares the fixed runtime tabs in product order", () => {
    const exported = loadClientExports();
    const tabs = exported.__test?.runtimeTabs();
    expect(tabs?.map((tab) => tab.label)).toEqual([
      "当前工作",
      "工作计划",
      "工作日报",
      "角色权限",
      "历史记录",
    ]);
    expect(tabs?.map((tab) => tab.key)).toEqual([
      "current",
      "plan",
      "report",
      "roles",
      "audit",
    ]);
  });

  it("sorts planned tasks by priority then creation time", () => {
    const exported = loadClientExports();
    const sorted = exported.__test?.sortPlanTasks([
      { id: "later", priority: "P3", createdAt: "2026-10-10T02:00:00.000Z" },
      { id: "high", priority: "P1", createdAt: "2026-10-10T03:00:00.000Z" },
      { id: "earlier", priority: "P3", createdAt: "2026-10-10T01:00:00.000Z" },
    ]);
    expect(sorted?.map((task) => task.id)).toEqual([
      "high",
      "earlier",
      "later",
    ]);
    expect(exported.__test?.planStoragePriority("P0")).toBe("P1");
    expect(exported.__test?.planStoragePriority("P2")).toBe("P3");
  });

  it("groups definition rows by agent template", () => {
    const exported = loadClientExports();
    const grouped = exported.__test?.groupTeammateTemplates([
      {
        id: "tm-2",
        personaId: "backend-soul",
        createdAt: "2026-10-10T01:30:00.000Z",
      },
      {
        id: "tm-1",
        personaId: "backend-soul",
        createdAt: "2026-09-24T01:09:00.000Z",
      },
      {
        id: "tm-3",
        profileTemplateId: "profile-pd",
        createdAt: "2026-09-23T12:08:00.000Z",
      },
      // 没有模版归属的实例各自成组
      { id: "tm-4", createdAt: "2026-10-09T13:58:00.000Z" },
    ]);
    expect(grouped?.map((entry) => entry.item.id)).toEqual([
      "tm-1",
      "tm-3",
      "tm-4",
    ]);
    expect(grouped?.[0]?.instanceIds).toEqual(["tm-2", "tm-1"]);
  });

  it("parses GFM tables inside work report markdown", () => {
    const exported = loadClientExports();
    expect(exported.__test?.isMarkdownTableSeparator("| --- | :---: |")).toBe(
      true,
    );
    expect(exported.__test?.isMarkdownTableSeparator("| 任务 | 状态 |")).toBe(
      false,
    );
    expect(
      exported.__test?.markdownTableCells("| TSK-1 | 已完成 |"),
    ).toEqual(["TSK-1", "已完成"]);
  });
});
