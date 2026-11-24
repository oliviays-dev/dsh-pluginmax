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
    runtimeDirectoryGroup(
      teammate: {
        name: string;
        ownerUserId: string;
        templateId?: string | undefined;
        systemKey?: string | undefined;
        protected?: unknown;
        projectBinding?: unknown;
      },
      templates?: readonly {
        id: string;
        source?: string | undefined;
        systemKey?: string | undefined;
        protected?: unknown;
      }[],
      currentUserId?: string | undefined,
    ): string;
    templateDirectoryGroup(template: {
      source: string;
      systemKey?: string | undefined;
      protected?: unknown;
    }): string;
    templatePickerGroups(
      items: readonly {
        id: string;
        name: string;
        source: string;
        systemKey?: string | undefined;
        protected?: unknown;
      }[],
    ): readonly {
      key: string;
      label: string;
      items: readonly { id: string; name: string }[];
    }[];
    runtimeDirectoryFilters(): readonly { key: string; label: string }[];
    matchesDirectoryFilter(group: string, filter: string): boolean;
    matchesDirectorySearch(
      item: {
        name?: string | undefined;
        role?: string | undefined;
        description?: string | undefined;
        ownerName?: string | undefined;
        templateName?: string | undefined;
        projectName?: string | undefined;
        source?: string | undefined;
        systemKey?: string | undefined;
        protected?: unknown;
        projectBinding?: { workspaceId?: string | undefined } | undefined;
      },
      query: string,
    ): boolean;
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
    externalRuntimeMatchesQuery(
      runtime: {
        name: string;
        provider: string;
        protocol: string;
        command?: string | undefined;
        supportedModels?: readonly string[] | undefined;
        supportedTools?: readonly string[] | undefined;
        defaultModel?: string | undefined;
      },
      query: string,
    ): boolean;
    externalRuntimeListStatus(runtime: {
      status: string;
      lastProbeOk?: boolean | undefined;
    }): { label: string; tone: string };
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
    parseExternalArgsText(value: string): {
      args: readonly string[];
      error: string;
    };
    formatExternalArgsText(args: readonly string[]): string;
    parseExternalRuntimeArgs(
      provider: string,
      args: readonly string[],
    ): {
      modelMode: string;
      model: string;
      supportedModels?: readonly string[] | undefined;
      defaultModel?: string | undefined;
      supportedTools?: readonly string[] | undefined;
      customArgs?: readonly string[] | undefined;
      customArgsText?: string | undefined;
      searchEnabled?: boolean | undefined;
      permissionMode?: string | undefined;
      maxTurns?: string | undefined;
      reasoningEffort?: string | undefined;
      ignoredOutputFormat: boolean;
      advancedArgs?:
        | readonly {
            kind: string;
            name: string;
            value: string;
          }[]
        | undefined;
    };
    compileExternalRuntimeArgs(form: {
      provider: string;
      modelMode: string;
      model: string;
      supportedModels?: readonly string[] | undefined;
      defaultModel?: string | undefined;
      supportedTools?: readonly string[] | undefined;
      searchEnabled: boolean;
      permissionMode: string;
      maxTurns: string;
      advancedArgs: readonly {
        kind: string;
        name: string;
        value: string;
      }[];
    }): readonly string[];
    externalRuntimeFormError(form: {
      provider: string;
      modelMode: string;
      model: string;
      supportedModels?: readonly string[] | undefined;
      defaultModel?: string | undefined;
      reasoningEffort?: string | undefined;
      maxTurns: string;
      contextWindowTokens?: string | undefined;
      customArgsText?: string | undefined;
      advancedArgs?:
        | readonly {
            kind: string;
            name: string;
            value: string;
          }[]
        | undefined;
    }): string;
    runtimeConfigurationLabels(runtime: {
      provider: string;
      args: readonly string[];
      supportedModels?: readonly string[] | undefined;
      defaultModel?: string | undefined;
      reasoningEffort?: string | undefined;
      supportedTools?: readonly string[] | undefined;
      customArgs?: readonly string[] | undefined;
      contextWindowTokens?: number | undefined;
      sandboxMode?: string | undefined;
      networkAccess?: boolean | undefined;
    }): readonly string[];
    externalCommandPreview(form: {
      provider: string;
      protocol: string;
      command: string;
      modelMode: string;
      model: string;
      supportedModels?: readonly string[] | undefined;
      defaultModel?: string | undefined;
      reasoningEffort?: string | undefined;
      supportedTools?: readonly string[] | undefined;
      customArgsText?: string | undefined;
      searchEnabled?: boolean | undefined;
      permissionMode?: string | undefined;
      maxTurns?: string | undefined;
      contextWindowTokens?: string | undefined;
      advancedArgs?:
        | readonly {
            kind: string;
            name: string;
            value: string;
          }[]
        | undefined;
      sandboxMode?: string | undefined;
      networkAccess?: boolean | undefined;
    }): string;
    externalRuntimeToForm(runtime: {
      id: string;
      name: string;
      provider: string;
      protocol: string;
      command: string;
      args?: readonly string[] | undefined;
      supportedModels?: readonly string[] | undefined;
      supportedTools?: readonly string[] | undefined;
      defaultModel?: string | undefined;
      reasoningEffort?: string | undefined;
      contextWindowTokens?: number | undefined;
      sandboxMode?: string | undefined;
      networkAccess?: boolean | undefined;
      customArgs?: readonly string[] | undefined;
    }): {
      [key: string]: unknown;
      runtimeId: string;
      defaultModel: string;
      reasoningEffort: string;
      contextWindowTokens: string;
      supportedTools: readonly string[];
      supportedModels: readonly string[];
    };
    externalRuntimeDirtyCount(
      form: Readonly<Record<string, unknown>> | null,
      runtime?: Readonly<Record<string, unknown>> | null | undefined,
    ): number;
    formatContextWindowInput(value: string | number): string;
    runtimeHoursText(value: number): string;
    runtimeProbeText(runtime: Readonly<Record<string, unknown>>): string;
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
  it("keeps the desktop directory scrollable with a sticky group header", () => {
    const source = readFileSync(CLIENT_PATH, "utf8");
    expect(source).toContain(".pmtm-directory-scroll{flex:1;min-height:0;");
    expect(source).toContain("overflow-y:auto");
    expect(source).toContain("scrollbar-gutter:stable");
    expect(source).toContain("position:sticky;top:0");
    expect(source).toContain(".pmtm-editor{min-height:0;overflow:auto;}");
  });

  it("labels project-managed instances in the AI partner list", () => {
    const source = readFileSync(CLIENT_PATH, "utf8");
    expect(source).toContain("pmtm-item-status-row");
    expect(source).toContain('"项目托管"');
    expect(source).toContain('"内置"');
    expect(source).toContain("justify-content:flex-start");
    expect(source).toContain("item.projectBinding !== undefined");
    expect(source).toContain("项目 ${item.projectName");
  });

  it("classifies runtime AI partners and templates for directory filters", () => {
    const exported = loadClientExports();
    const test = exported.__test;
    const builtInTemplate = {
      id: "sys-project-manager",
      source: "platform",
      systemKey: "project-manager",
    };
    expect(
      test?.runtimeDirectoryGroup(
        {
          name: "PM_采购韧性",
          ownerUserId: "olivia",
          templateId: "sys-project-manager",
          systemKey: "project-manager",
          projectBinding: { workspaceId: "ws-1" },
        },
        [builtInTemplate],
        "olivia",
      ),
    ).toBe("project");
    expect(
      test?.runtimeDirectoryGroup(
        { name: "PM_旧数据", ownerUserId: "olivia" },
        [],
        "olivia",
      ),
    ).toBe("project");
    expect(
      test?.runtimeDirectoryGroup(
        {
          name: "项目经理",
          ownerUserId: "olivia",
          templateId: "sys-project-manager",
        },
        [builtInTemplate],
        "olivia",
      ),
    ).toBe("builtin");
    expect(
      test?.runtimeDirectoryGroup(
        { name: "我的伙伴", ownerUserId: "olivia" },
        [],
        "olivia",
      ),
    ).toBe("mine");
    expect(
      test?.runtimeDirectoryGroup(
        { name: "他人伙伴", ownerUserId: "peter" },
        [],
        "olivia",
      ),
    ).toBe("other");
    expect(
      test?.templateDirectoryGroup({
        source: "platform",
        protected: { deletable: false },
      }),
    ).toBe("builtin");
    expect(test?.templateDirectoryGroup({ source: "platform" })).toBe(
      "platform",
    );
    expect(test?.templateDirectoryGroup({ source: "personal" })).toBe(
      "personal",
    );
    expect(test?.matchesDirectoryFilter("mine", "all")).toBe(true);
    expect(test?.matchesDirectoryFilter("mine", "builtin")).toBe(false);
  });

  it("renders default-all directory filters for both AI partner tabs", () => {
    const source = readFileSync(CLIENT_PATH, "utf8");
    const exported = loadClientExports();
    expect(source).toContain('"AI伙伴类型筛选"');
    expect(source).toContain('"智能体定义筛选"');
    expect(source).toMatch(
      /runtimeDirectoryFilter[\s\S]{0,100}?react\.useState\("all"\)/,
    );
    expect(source).toMatch(
      /templateDirectoryFilter[\s\S]{0,100}?react\.useState\("all"\)/,
    );
    expect(source).toContain('{ key: "builtin", label: "内置" }');
    expect(source).toContain('{ key: "project", label: "项目托管" }');
    expect(source).toContain('{ key: "mine", label: "我的" }');
    expect(source).toContain('{ key: "builtin", label: "通用模版" }');
    expect(source).toContain('{ key: "platform", label: "角色模版" }');
    expect(source).toContain('{ key: "personal", label: "个人模版" }');
    expect(
      exported.__test
        ?.runtimeDirectoryFilters()
        .map((item: { label: string }) => item.label),
    ).toEqual(["全部", "我的", "内置", "项目托管"]);
    expect(source).toContain(
      "flex-wrap:nowrap;gap:6px;padding:0 0 2px;overflow-x:auto",
    );
  });

  it("uses role template terminology across definition flows", () => {
    const source = readFileSync(CLIENT_PATH, "utf8");
    expect(source).toContain("保存角色模版");
    expect(source).toContain("角色模版预装 Skills");
    expect(source).not.toContain('"平台模版"');
    expect(source).not.toContain('"平台内置"');
  });

  it("keeps contextual create actions beside directory search and filters", () => {
    const source = readFileSync(CLIENT_PATH, "utf8");
    expect(source).toContain("pmtm-directory-search");
    expect(source).toContain("pmtm-directory-search-btn");
    expect(source).toContain("搜索 AI伙伴、角色、Owner、项目");
    expect(source).toContain("搜索角色模版、角色、创建人");
    expect(source).toContain("directorySearchRef.current?.focus()");
    expect(source).toContain("const createActions =");
    expect(source).toContain("const createInstanceAction =");
    expect(source).toContain("const templateCreateActions =");
    expect(source).toContain('"新建 AI伙伴"');
    expect(source).toContain('"新建个人模版"');
    expect(source).toContain('"新建角色模版"');
    expect(source).toContain(
      '"/api/collab/teammates/create-with-employee"',
    );
    expect(source).toContain('"/api/collab/teammate-templates/create"');
  });

  it("groups template picker options by ownership without type suffixes", () => {
    const exported = loadClientExports();
    const groups = exported.__test?.templatePickerGroups([
      { id: "role-1", name: "采购专员", source: "platform" },
      {
        id: "builtin-1",
        name: "Data Agent",
        source: "platform",
        systemKey: "data-agent",
      },
      { id: "personal-1", name: "小白 PD 应届生", source: "personal" },
    ]);
    expect(groups?.map((group) => group.label)).toEqual([
      "个人模版",
      "角色模版",
      "通用模版",
    ]);
    expect(
      groups?.map((group) => group.items.map((item) => item.name)),
    ).toEqual([["小白 PD 应届生"], ["采购专员"], ["Data Agent"]]);

    const source = readFileSync(CLIENT_PATH, "utf8");
    expect(source).toContain('className: "pmtm-template-picker-menu"');
    expect(source).toContain('role: "listbox"');
    expect(source).toContain("pmtm-template-picker-option-name");
    expect(source).toContain("item.name,");
  });

  it("searches directory entries by identity, owner, type, and project", () => {
    const exported = loadClientExports();
    const item = {
      name: "采购韧性伙伴",
      role: "供应商风险分析",
      ownerName: "Olivia",
      source: "platform",
      projectName: "供应链交付",
      projectBinding: { workspaceId: "ws-supply-chain" },
    };
    expect(exported.__test?.matchesDirectorySearch(item, "采购")).toBe(true);
    expect(exported.__test?.matchesDirectorySearch(item, "olivia")).toBe(true);
    expect(exported.__test?.matchesDirectorySearch(item, "角色模版")).toBe(
      true,
    );
    expect(
      exported.__test?.matchesDirectorySearch(
        { name: "任务规划伙伴", systemKey: "project-manager" },
        "通用模版",
      ),
    ).toBe(true);
    expect(exported.__test?.matchesDirectorySearch(item, "项目托管")).toBe(
      true,
    );
    expect(exported.__test?.matchesDirectorySearch(item, "供应链交付")).toBe(
      true,
    );
    expect(
      exported.__test?.matchesDirectorySearch(item, "不存在的关键词"),
    ).toBe(false);
  });

  it("keeps the saved definition selected and returns to its detail view", () => {
    const source = readFileSync(CLIENT_PATH, "utf8");
    const saveStart = source.indexOf("const saveEdit = async () =>");
    const runtimeBranch = source.indexOf(
      "if (selected === null || form === null) return;",
      saveStart,
    );
    const definitionSave = source.slice(saveStart, runtimeBranch);
    expect(definitionSave).toContain(
      "const savedTemplate = result.template ?? selectedTemplate",
    );
    expect(definitionSave).toContain(
      "setDefinitionTemplateId(savedTemplate.id)",
    );
    expect(definitionSave).toContain("setTeammateTemplates((current)");
    expect(definitionSave).toContain("setEditing(false)");
    expect(definitionSave).toContain("setForm(null)");
    expect(definitionSave).not.toContain("loadList(");
    expect(definitionSave).not.toContain("loadDetail(");
  });

  it("pins edit actions to an equal-size footer for both editors", () => {
    const source = readFileSync(CLIENT_PATH, "utf8");
    expect(source).toContain(
      'editing || instanceEditing ? " pmtm-editor-editing" : ""',
    );
    expect(
      source.match(/className: "pmtm-edit-footer"/g)?.length ?? 0,
    ).toBeGreaterThanOrEqual(3);
    expect(source).toContain(".pmtm-edit-footer{display:flex;flex:none");
    expect(source).toContain(
      ".pmtm-edit-footer .pmtm-btn{width:104px;height:34px",
    );
  });

  it("uses a consistent type scale across both edit pages", () => {
    const source = readFileSync(CLIENT_PATH, "utf8");
    expect(source).toContain(
      ".pmtm-edit-body .pmtm-editor-head h2{font-size:17px",
    );
    expect(source).toContain(
      ".pmtm-edit-body .pmtm-field > .label{color:var(--dsw-alias-label-secondary);font-size:11px",
    );
    expect(source).toContain(
      ".pmtm-edit-body .pmtm-input,.pmtm-edit-body .pmtm-select,.pmtm-edit-body .pmtm-area{font-size:12.5px",
    );
    expect(source).toContain(".pmtm-edit-body .pmtm-area.tools");
    expect(source).toContain("pmtm-edit-section-label");
  });

  it("declares the fixed runtime tabs in product order", () => {
    const exported = loadClientExports();
    const tabs = exported.__test?.runtimeTabs();
    expect(tabs?.map((tab) => tab.label)).toEqual([
      "当前工作",
      "工作计划",
      "工作日报",
      "Skills",
      "角色权限",
      "历史记录",
    ]);
    expect(tabs?.map((tab) => tab.key)).toEqual([
      "current",
      "plan",
      "report",
      "skills",
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

  it("does not resubmit unchanged Skill bindings when renaming a template", () => {
    const source = readFileSync(CLIENT_PATH, "utf8");
    expect(source).toContain("const skillBindingsChanged =");
    expect(source).toContain(
      "...(skillBindingsChanged ? { skillBindings } : {})",
    );
  });

  it("lets platform admins edit protected templates without lifecycle actions", () => {
    const source = readFileSync(CLIENT_PATH, "utf8");
    expect(source).toMatch(
      /if \(protectedSystem\) \{\s*return h\(\s*"div",\s*\{ className: "pmtm-actions" \},\s*protectedBadge,\s*h\(\s*"button",[\s\S]{0,500}?"编辑模版"/,
    );
  });

  it("shows edit, enable, and archive actions for managed disabled templates", () => {
    const source = readFileSync(CLIENT_PATH, "utf8");
    expect(source).toContain(
      "canManagePlatform || selectedTemplate.ownerUserId === currentUser?.id",
    );
    const renderActions = source.slice(
      source.indexOf("const renderActions ="),
      source.indexOf("const renderEditor ="),
    );
    expect(renderActions).toContain('"编辑模版"');
    expect(renderActions).toContain('key: "activate"');
    expect(renderActions).toContain('key: "archive"');
    expect(renderActions).toContain('"启用"');
  });

  it("keeps a teammate deep link until the instance list is ready", () => {
    const source = readFileSync(CLIENT_PATH, "utf8");
    expect(source).toContain("pendingTeammateIdRef");
    expect(source).toContain(
      "pendingTeammateIdRef.current = pending.teammateId",
    );
    expect(source).toContain("if (teammates.length === 0) return;");
  });

  it("filters the definition list by the archived view", () => {
    const source = readFileSync(CLIENT_PATH, "utf8");
    expect(source).toMatch(
      /archivedOnly\s*\?\s*item\.state === "archived"\s*:\s*item\.state !== "archived"/,
    );
  });

  it("marks protected platform definitions in the definition list", () => {
    const source = readFileSync(CLIENT_PATH, "utf8");
    expect(source).toMatch(
      /className: "pmtm-item-status-row"[\s\S]{0,400}?tab === "definition" &&\s*\(item\.systemKey !== undefined \|\|\s*item\.protected !== undefined\)[\s\S]{0,200}?className: "pmtm-built-in-chip"[\s\S]{0,100}?"通用模版"/,
    );
  });

  it("mounts Data Agent settings as a read-only summary with a config dialog", () => {
    const source = readFileSync(CLIENT_PATH, "utf8");
    expect(source).toContain('"pluginmax.teammate.data-agent-settings"');
    expect(source).toContain('selectedTemplate.systemKey === "data-agent"');
    expect(source).toContain('mode: "summary"');
    expect(source).toContain('mode: "full"');
    expect(source).toContain("onEdit: () => setDataAgentConfigOpen(true)");
    expect(source).toContain("dataAgentConfigOpen");
    expect(source).toContain(
      'identity?.workspaceId ?? workspaces[0]?.id ?? ""',
    );
  });

  it("places Data Agent summary and Skills immediately before template instances", () => {
    const source = readFileSync(CLIENT_PATH, "utf8");
    const soul = source.indexOf('"SOUL.md（生效人格）"');
    const dataAgent = source.indexOf('mode: "summary"');
    const skills = source.indexOf('"Skills · 角色模版预装清单"');
    const instances = source.indexOf('"使用该模版的 AI伙伴"');
    expect(soul).toBeGreaterThan(-1);
    expect(dataAgent).toBeGreaterThan(soul);
    expect(skills).toBeGreaterThan(dataAgent);
    expect(instances).toBeGreaterThan(skills);
    expect(source).not.toContain("继承给使用该定义的 AI伙伴");
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

  it("builds the runtime directory with search, status filters, and an add action", () => {
    const exported = loadClientExports();
    const test = exported.__test;
    const runtime = {
      name: "Codex CLI · 研发本机",
      provider: "codex",
      protocol: "codex-jsonl",
      command: "codex",
      supportedModels: ["gpt-5.2"],
      supportedTools: ["web_search", "run_command"],
      defaultModel: "gpt-5.2",
    };
    expect(test?.externalRuntimeMatchesQuery(runtime, "研发")).toBe(true);
    expect(test?.externalRuntimeMatchesQuery(runtime, "Codex")).toBe(true);
    expect(test?.externalRuntimeMatchesQuery(runtime, "gpt-5.2")).toBe(true);
    expect(test?.externalRuntimeMatchesQuery(runtime, "网页搜索")).toBe(true);
    expect(test?.externalRuntimeMatchesQuery(runtime, "不存在的运行时")).toBe(
      false,
    );
    expect(test?.externalRuntimeListStatus({ status: "active" })).toEqual({
      label: "待探测",
      tone: "pending",
    });
    expect(
      test?.externalRuntimeListStatus({
        status: "active",
        lastProbeOk: false,
      }),
    ).toEqual({ label: "探测失败", tone: "error" });

    const source = readFileSync(CLIENT_PATH, "utf8");
    expect(source).toContain('placeholder: "搜索运行时、Provider 或模型"');
    expect(source).toContain('"aria-label": "运行时状态筛选"');
    expect(source).toContain('"aria-label": "注册运行时"');
    expect(source).toContain("pmtm-runtime-archive");
    expect(source).toContain("pmtm-runtime-list-scroll");
    expect(source).toContain("本机与工作区");
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
    expect(source).toContain("const selectExternalRuntime = (runtime)");
    expect(source).toMatch(
      /const startExternalEdit = \(runtime\) => \{[\s\S]{0,160}?setExternalEditing\(true\)/,
    );
    expect(source).toMatch(
      /const selectExternalRuntime = \(runtime\) => \{[\s\S]{0,160}?setExternalEditing\(false\)/,
    );
    expect(source).toContain("已更新外部 Agent");
    expect(source).toContain("/api/collab/agent/external-runtimes/update");
    expect(source).toContain("运行时名称");
    expect(source).toContain("基础信息");
    expect(source).toContain("能力与模型");
    expect(source).toContain("运行边界");
    expect(source).toContain("命令与高级配置");
    expect(source).toContain("支持的常用工具");
    expect(source).toContain("visibleTools.length === 0");
    expect(source).toContain("网页搜索");
    expect(source).toContain("执行命令");
    expect(source).toContain("MCP");
    expect(source).toContain("支持的模型池");
    expect(source).toContain("modelChoices.length === 0");
    expect(source).toContain(".pmrt-chip-empty");
    expect(source).toContain("默认模型");
    expect(source).toContain('className: "pmrt-chip pmrt-model-add"');
    expect(source).toContain("思考强度");
    expect(source).toContain("文件修改权限");
    expect(source).toContain("可写任务工作区");
    expect(source).toContain("允许公开网络");
    expect(source).toContain("sandboxMode: form.sandboxMode");
    expect(source).toContain("networkAccess: form.networkAccess !== false");
    expect(source).toContain("supportedModels: form.supportedModels");
    expect(source).toContain("supportedTools: form.supportedTools");
    expect(source).toContain("启动命令预览");
    expect(source).toContain("高级启动参数");
    expect(source).toContain(
      ".pmrt-advanced-head{display:flex;align-items:center;justify-content:flex-start",
    );
    expect(source).toMatch(
      /placeholder: externalEditing\s*\?\s*'例如：--verbose --include-directory "\.\/docs"'\s*:\s*undefined/,
    );
    expect(source).toContain("最大上下文窗口");
    expect(source).toContain("DEFAULT_CONTEXT_WINDOW_TOKENS");
    expect(source).toContain("DEFAULT_CONTEXT_WINDOW_TOKENS = 128_000");
    expect(source).toContain("align-items:start;gap:9px;margin-top:14px");
    expect(source).toContain(".pmtm-input,.pmtm-select{height:34px");
    expect(source).not.toContain("恢复推荐配置");
    expect(source).not.toContain("管理员声明");
    expect(source).not.toContain("字段提示");
    expect(source).toContain("pmrt-savebar");
    expect(source).toContain("showForm && externalEditing");
    const runtimePageActionsSource = source.slice(
      source.indexOf("const runtimePageActions ="),
      source.indexOf("return h(", source.indexOf("const runtimePageActions =")),
    );
    expect(runtimePageActionsSource).not.toContain("toggleExternalArchiveView");
    expect(runtimePageActionsSource).toContain("pmrt-page-button primary");
    expect(source).toContain("有 ${dirtyCount} 项未保存更改");
    expect(source).not.toContain("参数格式有效");
    expect(source).not.toContain("平台托管参数");
    expect(source).not.toContain("status: externalForm.active");
    expect(source).not.toContain("value: externalForm.active");
    expect(source).not.toContain("添加参数");
    expect(source).not.toContain("固定参数（每个 argv token 单独一行）");
    expect(source).toContain(".pmtm-instance-exec .pmtm-select{height:34px");
    expect(source).toContain('className: "pmtm-meta secondary"');
    expect(source).toContain('ROLE_PLACEHOLDER = "角色待定"');
    expect(source).toContain("result.pausedTeammateIds?.length");
    expect(source).toContain("个绑定的 AI伙伴已暂停");
    expect(source).toContain("const openDefinitionForTeammate = (teammate)");
    expect(source).toContain(
      "onClick: () => openDefinitionForTeammate(teammate)",
    );
  });

  it("moves runtime settings out of the AI teammate tabs into its own route", () => {
    const source = readFileSync(CLIENT_PATH, "utf8");
    expect(source).toContain(
      'if (route !== "teammates" && route !== "runtime-settings") return null;',
    );
    expect(source).toContain('runtimeSettings: route === "runtime-settings"');
    expect(source).toContain('runtimeSettings ? "external" : "runtime"');
    expect(source).toContain('runtimeSettings ? "运行时" : "AI伙伴"');
    expect(source).not.toContain("管理本机外部 Agent 执行通道、模型与权限");
    expect(source).not.toContain('pmtm-tab${tab === "external"');
    expect(source).not.toContain('setTab("external")');
  });

  it("renders the selected runtime as an inline editable detail page", () => {
    const source = readFileSync(CLIENT_PATH, "utf8");
    expect(source).toContain("pmrt-identity");
    expect(source).toContain("runtimeHeaderActions");
    expect(source).toContain('"探测"');
    expect(source).toContain('"停用"');
    expect(source).toContain("pmrt-button-danger");
    expect(source).toContain('runtime.status === "disabled"');
    const runtimeHeaderSource = source.slice(
      source.indexOf("const runtimeHeaderActions ="),
      source.indexOf("const runtimeDirectory ="),
    );
    expect(runtimeHeaderSource).not.toContain('title: "归档运行时"');
    expect(runtimeHeaderSource).not.toContain("M14.5 4.5");
    expect(source).toContain("pmrt-detail-scroll");
    expect(source).toContain("pmrt-savebar");
    expect(source).not.toContain("runtimeDetailActions");
    expect(source).not.toContain('"更多操作"');
    expect(source).not.toContain("可见范围");
  });

  it("matches the runtime settings v2 form and save-bar contract", () => {
    const exported = loadClientExports();
    const test = exported.__test;
    const runtime = {
      id: "ext-v2",
      name: "Codex CLI · 研发本机",
      provider: "codex",
      protocol: "codex-jsonl",
      command: "codex",
      args: ["--model", "gpt-5.2"],
      supportedModels: ["gpt-5.2", "gpt-5.1", "gpt-5", "o3"],
      defaultModel: "gpt-5.2",
      reasoningEffort: "high",
      supportedTools: ["web_search", "read_file"],
      contextWindowTokens: 128_000,
      sandboxMode: "workspace-write",
      networkAccess: true,
      customArgs: [],
    };
    const form = test?.externalRuntimeToForm(runtime);
    expect(form).toMatchObject({
      runtimeId: "ext-v2",
      defaultModel: "gpt-5.2",
      reasoningEffort: "high",
      contextWindowTokens: "128,000",
    });
    expect(test?.formatContextWindowInput("128000")).toBe("128,000");
    expect(
      test?.externalRuntimeDirtyCount(
        form === undefined ? null : { ...form, name: "Codex CLI · 只读分析" },
        runtime,
      ),
    ).toBe(1);
    expect(
      test?.externalRuntimeDirtyCount(
        form === undefined ? null : form,
        runtime,
      ),
    ).toBe(0);
    expect(
      test?.externalRuntimeDirtyCount(
        form === undefined ? null : { ...form, runtimeId: undefined },
        null,
      ),
    ).toBeGreaterThan(0);
    expect(test?.runtimeProbeText({})).toBe("尚未探测");

    const source = readFileSync(CLIENT_PATH, "utf8");
    const runtimeSource = source.slice(
      source.indexOf("const renderExternalManager ="),
      source.indexOf("const renderTemplateEditor ="),
    );
    expect(source).toMatch(
      /codex:\s*\[[\s\S]*?"gpt-5\.2"[\s\S]*?"gpt-5\.1"[\s\S]*?"gpt-5"[\s\S]*?"o3"/,
    );
    expect(source).toContain(".pmrt-archive-filter{margin-left:auto");
    expect(source).toContain('className: "pmrt-field pmrt-wide"');
    expect(source).toContain("pmrt-model-add");
    expect(source).toContain('form.provider === "workbuddy"');
    expect(source).toContain("const visibleTools = externalEditing");
    expect(source).toContain("pmrt-chip-readonly");
    expect(source).toContain("pmrt-model-chip-readonly");
    expect(source).toContain(".pmrt-detail.readonly .pmrt-select-icon");
    expect(source).toContain("最大执行回合");
    expect(source).toContain("formatContextWindowInput(event.target.value)");
    expect(source).toContain("已自定义 ${customArgsCount} 项");
    expect(source).toContain('"重置"');
    expect(runtimeSource).not.toContain("最近同步");
    expect(runtimeSource).not.toContain("恢复推荐配置");
    expect(runtimeSource).not.toContain("管理员声明");
    expect(runtimeSource).not.toContain("可见范围");
  });

  it("converts runtime args to structured readable configuration", () => {
    const exported = loadClientExports();
    const test = exported.__test;
    const parsed = test?.parseExternalRuntimeArgs("workbuddy", [
      "/tmp/workbuddy.mjs",
      "--print",
      "--model",
      "hy4",
      "--permission-mode",
      "acceptEdits",
      "--max-turns",
      "8",
      "--output-format",
      "text",
      "--include-directory",
      "docs",
      "extra-token",
    ]);
    expect(parsed).toMatchObject({
      modelMode: "custom",
      model: "hy4",
      permissionMode: "acceptEdits",
      maxTurns: "8",
      ignoredOutputFormat: true,
    });
    expect(parsed?.advancedArgs).toMatchObject([
      { kind: "positional", value: "/tmp/workbuddy.mjs" },
      { kind: "keyValue", name: "--include-directory", value: "docs" },
      { kind: "positional", value: "extra-token" },
    ]);
    const compiled = test?.compileExternalRuntimeArgs({
      provider: "workbuddy",
      modelMode: "custom",
      model: "hy4",
      supportedModels: ["hy4"],
      defaultModel: "hy4",
      supportedTools: ["web_search"],
      searchEnabled: true,
      permissionMode: "acceptEdits",
      maxTurns: "8",
      advancedArgs: parsed?.advancedArgs ?? [],
    });
    expect(compiled).toEqual([
      "/tmp/workbuddy.mjs",
      "--include-directory",
      "docs",
      "extra-token",
      "--model",
      "hy4",
      "--permission-mode",
      "acceptEdits",
      "--max-turns",
      "8",
    ]);
    expect(
      test?.runtimeConfigurationLabels({
        provider: "workbuddy",
        args: compiled ?? [],
        supportedModels: ["hy4"],
        defaultModel: "hy4",
        supportedTools: ["web_search"],
        contextWindowTokens: 128_000,
      }),
    ).toEqual([
      "模型池：1 个",
      "默认模型：hy4",
      "思考强度：CLI 默认",
      "工具：网页搜索",
      "上下文窗口：128K token",
      "权限：自动接受文件修改",
      "回合上限：8",
      "额外参数：3 项",
    ]);
    expect(
      test?.externalCommandPreview({
        provider: "codex",
        protocol: "codex-jsonl",
        command: "codex",
        modelMode: "default",
        model: "",
        supportedModels: ["gpt-5.2"],
        defaultModel: "gpt-5.2",
        reasoningEffort: "high",
        contextWindowTokens: "128000",
        supportedTools: ["web_search"],
        sandboxMode: "workspace-write",
        networkAccess: true,
        customArgsText: "",
        advancedArgs: [],
      }),
    ).toContain(
      'codex --model gpt-5.2 --search -c model_reasoning_effort="high" exec --json',
    );
    expect(
      test?.runtimeConfigurationLabels({
        provider: "codex",
        args: ["--search"],
        supportedModels: ["deepseek-flash"],
        defaultModel: "deepseek-flash",
        supportedTools: ["web_search"],
        contextWindowTokens: 128_000,
        sandboxMode: "workspace-write",
        networkAccess: true,
      }),
    ).toEqual(expect.arrayContaining(["沙箱：可写工作区", "网络：开启"]));
  });

  it("validates structured runtime configuration before save", () => {
    const exported = loadClientExports();
    const test = exported.__test;
    expect(
      test?.externalRuntimeFormError({
        provider: "codex",
        modelMode: "custom",
        model: "",
        supportedModels: ["gpt-5"],
        defaultModel: "gpt-5.2",
        maxTurns: "",
        advancedArgs: [],
      }),
    ).toContain("默认模型必须来自模型池");
    expect(
      test?.externalRuntimeFormError({
        provider: "workbuddy",
        modelMode: "default",
        model: "",
        maxTurns: "1.5",
        advancedArgs: [],
      }),
    ).toContain("1 到 100");
    expect(
      test?.externalRuntimeFormError({
        provider: "command",
        modelMode: "default",
        model: "",
        maxTurns: "",
        customArgsText: "docs | report",
      }),
    ).toContain("不支持 shell 操作符");
    expect(
      test?.externalRuntimeFormError({
        provider: "workbuddy",
        modelMode: "default",
        model: "",
        maxTurns: "",
        customArgsText: "--effort high",
      }),
    ).toContain("推理强度请在任务执行时选择");
    expect(
      test?.externalRuntimeFormError({
        provider: "workbuddy",
        modelMode: "default",
        model: "",
        maxTurns: "",
        customArgsText: "--print",
      }),
    ).toContain("由平台托管");
    expect(
      test?.externalRuntimeFormError({
        provider: "codex",
        modelMode: "default",
        model: "",
        maxTurns: "",
        contextWindowTokens: "999",
        customArgsText: "",
      }),
    ).toContain("最大上下文窗口");
  });

  it("parses pasted extra argv and generates an executable preview", () => {
    const exported = loadClientExports();
    const test = exported.__test;
    const parsed = test?.parseExternalArgsText(
      '--add-dir "./docs and specs" --verbose',
    );
    expect(parsed).toEqual({
      args: ["--add-dir", "./docs and specs", "--verbose"],
      error: "",
    });
    expect(test?.formatExternalArgsText(parsed?.args ?? [])).toBe(
      '--add-dir "./docs and specs" --verbose',
    );
    const form = {
      provider: "workbuddy",
      protocol: "plain-text",
      command: "codebuddy",
      modelMode: "default",
      model: "",
      supportedModels: ["hy3"],
      defaultModel: "hy3",
      supportedTools: ["web_search"],
      customArgsText: '--add-dir "./docs and specs"',
      searchEnabled: false,
      permissionMode: "default",
      maxTurns: "6",
    };
    expect(test?.externalCommandPreview(form)).toBe(
      'codebuddy --add-dir "./docs and specs" --model hy3 --max-turns 6 --print --output-format stream-json',
    );
    expect(
      test?.externalCommandPreview({
        ...form,
        customArgsText: "--effort high",
      }),
    ).toBe(
      "codebuddy --model hy3 --max-turns 6 --print --output-format stream-json",
    );
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

  it("omits conversation counts from AI partner workload metrics", () => {
    const source = readFileSync(CLIENT_PATH, "utf8");
    expect(source).not.toContain("参会次数");
    expect(source).not.toContain('className: "meetings"');
    expect(source).not.toContain("stats.meetingCount ?? 0");
  });

  it("matches workbench runtime formatting below one hour", () => {
    const exported = loadClientExports();
    expect(exported.__test?.runtimeHoursText(0)).toBe("0.0h");
    expect(exported.__test?.runtimeHoursText(0.0005)).toBe("1.8s");
    expect(exported.__test?.runtimeHoursText(0.5)).toBe("30m");
    expect(exported.__test?.runtimeHoursText(1)).toBe("1.0h");
  });

  it("saves instance profile edits through the instance endpoint", () => {
    const source = readFileSync(CLIENT_PATH, "utf8");
    expect(source).toMatch(
      /const saveInstanceProfileEdit[\s\S]{0,1500}?\/api\/collab\/teammates\/profile/,
    );
  });

  it("loads project roles from AI teammate assignments without an employee record", () => {
    const source = readFileSync(CLIENT_PATH, "utf8");
    expect(source).toContain("/api/collab/teammates/project-roles?teammateId=");
    expect(source).not.toContain("/api/collab/employee/roles?employeeId=");
    expect(source).not.toContain("还没有绑定员工档案");
  });

  it("presents one skill inventory across definitions and instances", () => {
    const source = readFileSync(CLIENT_PATH, "utf8");
    expect(source).toContain("/api/collab/resources/skills/installed");
    expect(source).toContain("/api/collab/teammates/skills?teammateId=");
    expect(source).not.toContain("已加载 Skills");
    expect(source).not.toContain("角色模版由平台管理员维护");
    expect(source).toContain("预装 Skills");
    expect(source).toContain("Skills · 角色模版预装清单");
    expect(source).toContain("不含实例扩展");
    expect(source).toContain("角色模版预装 Skills");
    expect(source).toContain("个人模版 Skills");
    expect(source).toContain("从资源库添加");
    expect(source).toContain("pmtm-drawer");
    expect(source).toContain("我的资源库");
    expect(source).not.toContain("只显示已安装到账号资源库");
    expect(source).toContain("配置企业 Skill：");
    expect(source).toContain("企业强制");
    expect(source).toContain('selectedTemplate.source === "platform"');
    expect(source).toContain("适用能力");
    expect(source).toContain("由 Skill 包定义");
    expect(source).not.toContain("生效场景");
    expect(source).not.toContain("场景用于告诉运行时何时加载该 Skill");
    expect(source).toContain("skillBindingDraft");
    expect(source).toContain("用户扩展策略");
    expect(source).toContain("允许用户自行安装扩展 Skill");
    expect(source).toContain("安装扩展 Skill");
    expect(source).toContain("/api/collab/teammates/skills/extend");
    expect(source).toContain('className: "pmtm-skill-group-actions"');
    expect(source).not.toContain("禁止替换主 Skill 的场景");
    expect(source).not.toContain("允许用户停用默认 Skill");
    expect(source).not.toContain("允许用户在指定场景选择主处理器");
    expect(source).toContain("平台预装");
    expect(source).toContain("暂无预装SKILL");
    expect(source).toContain("自定义扩展");
    expect(source).not.toContain("可添加的 Skills");
    expect(source).toContain("当前实例还没有扩展 Skill");
    expect(source).not.toContain("pmtm-skill-art");
    expect(source).toContain('"data-skill-tag": "version"');
    expect(source).toContain('"data-skill-tag": "category"');
    expect(source).toContain('"data-skill-tag": "usage"');
    expect(source).toContain('"data-skill-tag": "developer"');
    expect(source).not.toContain('h("strong", null, "版本")');
    expect(source).not.toContain('h("strong", null, "使用量")');
    expect(source).toContain("-webkit-line-clamp:3");
    expect(source).toMatch(/\.pmtm-skill-card\{[^}]*min-height:0/);
    expect(source).toContain('className: "pmtm-skill-actions"');
    expect(source).toContain("onClick: onDetails");
    expect(source).toContain("event.stopPropagation()");
    expect(source).toContain("renderSkillDetailDialog");
    expect(source).toContain("const cleanSkillName =");
    expect(source).toContain("平台基线|我的扩展");
    expect(source).not.toContain('className: "pmtm-skill-source');
    expect(source).not.toContain('className: "pmtm-skill-scenes"');
    expect(source).toContain("data-skill-source");
    expect(source).not.toContain("蓝色为智能体定义继承的企业能力");
    expect(source).not.toContain('"Skill 清单"');
  });

  it("requires an explicit action to create or save", () => {
    const source = readFileSync(CLIENT_PATH, "utf8");
    // 输入框不再用回车隐式提交：中文输入法确认候选词时按 Enter 会误触发。
    expect(source).not.toContain('event.key === "Enter"');
  });

  it("creates a task inside the assign dialog for the selected teammate", () => {
    const source = readFileSync(CLIENT_PATH, "utf8");
    expect(source).toContain('"/api/collab/tasks/create"');
    expect(source).toContain("新建任务并安排给");
    expect(source).toContain("创建并派发");
    expect(source).toContain("receiverId: selected.id");
  });
});
