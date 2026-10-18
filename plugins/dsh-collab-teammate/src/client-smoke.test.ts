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
    runtimeDetailEditPolicy(editing: boolean): {
      showMetrics: boolean;
      panelsClass: string;
    };
    externalRuntimeStatusLabel(status: string): string;
    splitExternalRuntimes(
      runtimes: readonly { id: string; status: string }[],
    ): {
      active: readonly { id: string; status: string }[];
      archived: readonly { id: string; status: string }[];
      defaultView: readonly { id: string; status: string }[];
    };
    teammateExecutionPill(
      teammate: { execution?: string; externalRuntimeId?: string },
      runtimes: readonly { id: string; name: string; status: string }[],
    ): { text: string; tone: string };
    externalRuntimeOptions(
      runtimes: readonly {
        id: string;
        name: string;
        provider: string;
        status: string;
      }[],
      boundId?: string,
    ): readonly {
      props: { value: string; disabled?: boolean };
    }[];
    unavailableBoundRuntime(
      runtimes: readonly { id: string; status: string }[],
      boundId?: string,
    ): { id: string; status: string } | undefined;
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
  const factory = new Function("window", "module", "exports", source) as (
    window: unknown,
    module: { exports: unknown },
    exports: unknown,
  ) => void;
  const module = { exports: {} };
  factory(windowStub, module, module.exports);
  return exports;
}

describe("AI Teammate runtime client", () => {
  it("creates AI companions with a project through the bundled runtime route", () => {
    const source = readFileSync(CLIENT_PATH, "utf8");
    expect(source).toContain('"/api/collab/teammates/create-with-employee"');
    expect(source).toContain("关联项目");
    expect(source).toContain("createInstanceWorkspaceId");
  });

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
    expect(exported.__test?.markdownTableCells("| TSK-1 | 已完成 |")).toEqual([
      "TSK-1",
      "已完成",
    ]);
  });

  it("locks runtime detail panels while editing base info", () => {
    const exported = loadClientExports();
    expect(exported.__test?.runtimeDetailEditPolicy(false)).toEqual({
      showMetrics: true,
      panelsClass: "pmtm-runtime-panels",
    });
    expect(exported.__test?.runtimeDetailEditPolicy(true)).toEqual({
      showMetrics: false,
      panelsClass: "pmtm-runtime-panels editing",
    });
  });

  it("hides runtime tab actions in the editing state", () => {
    const source = readFileSync(CLIENT_PATH, "utf8");
    expect(source).toContain(
      ".pmtm-runtime-panels.editing .pmtm-btn{display:none;}",
    );
  });

  it("auto-dismisses the top status notice after 3s", () => {
    const source = readFileSync(CLIENT_PATH, "utf8");
    expect(source).toMatch(/setNotice\(""\),\s*3_000\)/);
  });

  it("keeps work-report history unfiltered by default", () => {
    const source = readFileSync(CLIENT_PATH, "utf8");
    expect(source).toMatch(
      /function defaultReportRange\(\)[\s\S]{0,260}?return \{ from: "", to: "" \};/,
    );
  });

  it("renders task progress through the markdown renderer", () => {
    const source = readFileSync(CLIENT_PATH, "utf8");
    expect(source).toMatch(
      /function LatestProgressText[\s\S]{0,1200}?renderMarkdown\(task\.latestProgress/,
    );
    expect(source).toMatch(
      /const latestOf = \(task, fallback\) =>[\s\S]{0,600}?renderMarkdown\(/,
    );
    expect(source).toMatch(
      /run\.summary === undefined[\s\S]{0,700}?renderMarkdown\(run\.summary\)/,
    );
  });

  it("edits teammate definitions through SOUL only", () => {
    const source = readFileSync(CLIENT_PATH, "utf8");
    // 场景行为 / 工作目标已并入 SOUL.md，编辑表单不再有独立输入框。
    expect(source).not.toContain("场景行为（每行一项");
    expect(source).not.toContain("工作目标（每行一项");
    // 编辑态直接用生效人格全文，保存时清空旧字段。
    expect(source).toMatch(/soul: effectiveSoulText\(selected\)/);
    expect(source).toContain("scenarios: [],");
    expect(source).toContain("goals: [],");
  });

  it("filters the definition list by the archived view", () => {
    const source = readFileSync(CLIENT_PATH, "utf8");
    expect(source).toMatch(
      /archivedOnly\s*\?\s*item\.state === "archived"\s*:\s*item\.state !== "archived"/,
    );
  });

  it("labels external runtime status and splits the archived view", () => {
    const exported = loadClientExports();
    const test = exported.__test;
    expect(test?.externalRuntimeStatusLabel("active")).toBe("启用中");
    expect(test?.externalRuntimeStatusLabel("disabled")).toBe("已停用");
    expect(test?.externalRuntimeStatusLabel("archived")).toBe("已归档");
    const groups = test?.splitExternalRuntimes([
      { id: "ext-1", status: "active" },
      { id: "ext-2", status: "disabled" },
      { id: "ext-3", status: "archived" },
    ]);
    expect(groups?.defaultView.map((item) => item.id)).toEqual([
      "ext-1",
      "ext-2",
    ]);
    expect(groups?.archived.map((item) => item.id)).toEqual(["ext-3"]);
    expect(groups?.active.map((item) => item.id)).toEqual(["ext-1"]);
  });

  it("flags teammate bindings whose external runtime is unavailable", () => {
    const exported = loadClientExports();
    const test = exported.__test;
    const runtimes = [
      { id: "ext-1", name: "Codex 本机", status: "active" },
      { id: "ext-2", name: "WorkBuddy CLI", status: "disabled" },
      { id: "ext-3", name: "旧运行时", status: "archived" },
    ];
    expect(
      test?.teammateExecutionPill({ execution: "builtin" }, runtimes),
    ).toEqual({ text: "内置执行", tone: "builtin" });
    expect(
      test?.teammateExecutionPill(
        { execution: "external", externalRuntimeId: "ext-1" },
        runtimes,
      ),
    ).toEqual({ text: "外部 Agent · Codex 本机", tone: "external" });
    expect(
      test?.teammateExecutionPill(
        { execution: "external", externalRuntimeId: "ext-2" },
        runtimes,
      ),
    ).toEqual({
      text: "外部 Agent · WorkBuddy CLI（已停用）",
      tone: "external warn",
    });
    expect(
      test?.teammateExecutionPill(
        { execution: "external", externalRuntimeId: "ext-3" },
        runtimes,
      ).tone,
    ).toBe("external warn");
    expect(
      test?.teammateExecutionPill({ execution: "external" }, runtimes),
    ).toEqual({ text: "外部 Agent · 未选择", tone: "external warn" });
    expect(
      test?.teammateExecutionPill(
        { execution: "external", externalRuntimeId: "ext-missing" },
        runtimes,
      ),
    ).toEqual({
      text: "外部 Agent · ext-missing（运行时不存在）",
      tone: "external warn",
    });
  });

  it("keeps the bound runtime visible as a disabled option when it is unavailable", () => {
    const exported = loadClientExports();
    const test = exported.__test;
    const runtimes = [
      { id: "ext-1", name: "Codex 本机", provider: "codex", status: "active" },
      {
        id: "ext-2",
        name: "WorkBuddy CLI",
        provider: "workbuddy",
        status: "disabled",
      },
      {
        id: "ext-3",
        name: "旧运行时",
        provider: "command",
        status: "archived",
      },
    ];
    const options = test?.externalRuntimeOptions(runtimes, "ext-3");
    expect(options?.map((item) => item.props.value)).toEqual([
      "",
      "ext-1",
      "ext-3",
    ]);
    expect(options?.[1]?.props.disabled).toBeUndefined();
    expect(options?.[2]?.props.disabled).toBe(true);
    expect(test?.unavailableBoundRuntime(runtimes, "ext-1")).toBeUndefined();
    expect(test?.unavailableBoundRuntime(runtimes, "ext-2")).toMatchObject({
      id: "ext-2",
      status: "disabled",
    });
  });

  it("supports editing external runtime definitions", () => {
    const source = readFileSync(CLIENT_PATH, "utf8");
    expect(source).toContain("const startExternalEdit = (runtime)");
    expect(source).toContain("已更新外部 Agent");
    expect(source).toContain("/api/collab/agent/external-runtimes/update");
  });

  it("archives external runtimes through the shared archive view", () => {
    const source = readFileSync(CLIENT_PATH, "utf8");
    expect(source).toContain("/api/collab/agent/external-runtimes/archive");
    expect(source).toContain("/api/collab/agent/external-runtimes/restore");
    expect(source).toContain("includeArchived=1");
    expect(source).toMatch(
      /externalArchivedOnly\s*\?\s*runtimeGroups\.archived\s*:\s*runtimeGroups\.defaultView/,
    );
  });

  it("requires an explicit action to create or save", () => {
    const source = readFileSync(CLIENT_PATH, "utf8");
    // 输入框不再用回车隐式提交：中文输入法确认候选词时按 Enter 会误触发。
    expect(source).not.toContain('event.key === "Enter"');
  });
});
