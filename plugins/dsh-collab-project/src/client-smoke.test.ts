import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { parseWorkflowMarkdown } from "../../dsh-collab-workflow/src/parser.ts";

const CLIENT_PATH = resolve(import.meta.dirname, "../client/index.js");
const BUSINESS_CHAIN_CONFIG_ROOT = resolve(
  import.meta.dirname,
  "../../../configs/business-chains",
);

interface SlotSpec {
  readonly id: string;
  readonly name: string;
  readonly order?: number;
}

interface RoleLike {
  id: string;
  name: string;
  code: string;
  category?: string;
  description?: string;
  permissions?: readonly string[];
}

interface ClientExports {
  inject?: readonly string[];
  apply?: (ctx: {
    slots: {
      inject: (name: string, run: () => void) => void;
      register: (spec: SlotSpec, component?: unknown) => () => void;
    };
    get?: (key: string) => unknown;
  }) => void;
  __test?: {
    statusTone(status: string): string;
    priorityLabel(priority: string): string;
    permissionLabels(permissions: readonly string[]): string;
    platformUserOptionLabel(
      member: {
        name: string;
        platformRole?: string;
        kindLabel?: string;
        ownerName?: string;
      },
      kind: "human" | "agent",
    ): string;
    memberScopeForRoles(
      roles: readonly {
        id: string;
        permissions?: readonly string[];
      }[],
      roleIds: readonly string[],
    ): string;
    groupMembersByProjectRole(
      roles: readonly { id: string; name: string }[],
      members: readonly {
        id: string;
        kind: string;
        roleIds?: readonly string[];
      }[],
    ): readonly {
      role: { id: string; name: string };
      members: readonly { id: string; kind: string }[];
    }[];
    workspaceRoleLabel(role?: string): string;
    resolveMemberPoolStuck(input: {
      current: boolean;
      sentinelTop: number;
      containerTop: number;
      poolBottom: number;
      atScrollEnd?: boolean;
    }): boolean;
    filterMemberDirectoryLocally(
      directory: {
        humans: readonly Record<string, unknown>[];
        agents: readonly Record<string, unknown>[];
      },
      members: readonly Record<string, unknown>[],
      keyword: string,
      limit?: number,
    ): {
      humans: readonly Record<string, unknown>[];
      agents: readonly Record<string, unknown>[];
    };
    isProjectOwner(
      member: {
        id: string;
        kind: "human" | "agent";
        workspaceRole?: string;
      },
      ownerId?: string,
    ): boolean;
    compactWorkspacePath(path?: string, segmentCount?: number): string;
    auditCategoryLabel(category: string): string;
    auditMatches(
      event: {
        summary?: string;
        actorName?: string;
        actorRole?: string;
        targetName?: string;
        action?: string;
        category?: string;
        detail?: Readonly<Record<string, string>>;
      },
      keyword: string,
      category: string,
    ): boolean;
    projectMatches(
      project: {
        name: string;
        code: string;
        ownerName: string;
        status: string;
        health: string;
      },
      keyword: string,
    ): boolean;
    sortProjectTasks(
      tasks: readonly {
        id: string;
        priority: string;
        createdAt: string;
      }[],
    ): readonly { id: string; priority: string; createdAt: string }[];
    preferredProgressWorkflow(
      workflows: readonly {
        id: string;
        status: string;
        updatedAt: string;
      }[],
    ): { id: string; status: string; updatedAt: string } | undefined;
    clampProgressZoom(value: number): number;
    nextProgressZoom(value: number, direction: number): number;
    progressNodeStatusLabel(status: string): string;
    progressNodeTone(status: string): string | undefined;
    progressNodeIsAnomaly(node: {
      status?: string;
      exceptionText?: string;
      isAnomaly?: boolean;
      alertCount?: number;
    }): boolean;
    progressTaskAnomaly(task: {
      status?: string;
      executionAnomaly?: { message: string };
      receiverState?: string;
      queueState?: string;
    }): boolean;
    normalizeBusinessChainBindings(
      value: readonly Record<string, any>[],
    ): readonly {
      nodeId: string;
      externalRefs: readonly {
        system: string;
        objectType: string;
        objectId: string;
        required: boolean;
      }[];
    }[];
    businessChainConfigToMarkdown(content: string): string;
    buildProgressChangeEvents(
      events: readonly {
        id?: string;
        at: string;
        kind: string;
        actorName?: string;
        message?: string;
        data?: Record<string, unknown>;
      }[],
    ): readonly {
      id: string;
      category: string;
      categoryLabel: string;
      at: string;
      time: string;
      description: string;
      source: string;
    }[];
    formatProgressChangeEvent(event: {
      time: string;
      categoryLabel: string;
      description: string;
      source: string;
    }): string;
    buildProgressOverview(input: {
      workflowDetail: Record<string, any>;
      tasks: readonly Record<string, any>[];
      memberNames?: Record<string, string>;
    }): {
      instance: Record<string, any> | null;
      nodes: readonly {
        id: string;
        code: string;
        name: string;
        status: string;
        statusLabel: string;
        owner: string;
        plannedLabel: string;
        revisedLabel: string;
        actualLabel: string;
        alertCount: number;
        taskCount: number;
        exceptionText: string;
        isAnomaly: boolean;
        taskIds: readonly string[];
        fields: readonly {
          key: string;
          label: string;
          value: string;
        }[];
      }[];
      alerts: readonly {
        id: string;
        nodeId: string;
        title: string;
        type: string;
        taskIds: readonly string[];
      }[];
      changeEvents: readonly {
        id: string;
        category: string;
        time: string;
        source: string;
      }[];
      tasksByNode: Record<string, readonly Record<string, any>[]>;
    };
    applyProgressDemoData(
      overview: Record<string, any>,
      config: Record<string, any>,
    ): {
      nodes: readonly (Record<string, any> & {
        id: string;
        status: string;
        exceptionText: string;
        isAnomaly: boolean;
      })[];
      changeEvents: readonly Record<string, any>[];
    };
    applyProjectRoleMembers(
      overview: Record<string, any>,
      roles: readonly Record<string, any>[],
      members: readonly Record<string, any>[],
    ): Record<string, any>;
    missingBusinessChainRoleMembers(
      nodes: readonly Record<string, any>[],
      roles: readonly Record<string, any>[],
    ): readonly Record<string, any>[];
    progressRevisedText(plannedLabel?: string, revisedLabel?: string): string;
    resolveProgressSelection(
      overview: Record<string, any>,
      nodeId: string,
      alertId?: string,
    ): {
      node: Record<string, any> | null;
      alerts: readonly Record<string, any>[];
      tasks: readonly Record<string, any>[];
      highlightedTaskIds: readonly string[];
      selectedAlert?: Record<string, any> | null;
    };
    projectReportProgress(
      reports: readonly {
        reportType?: string;
        date: string;
        generatedAt: string;
        createdAt?: string;
        generationMode?: string;
        skillId?: string;
        skillVersion?: string;
        content: string;
      }[],
    ): {
      latest: Record<string, any> | null;
      progress: readonly string[];
      attention: readonly string[];
    };
    formatProjectUpdatedAt(value?: string, reportDate?: string): string;
    outputMatches(
      item: {
        name: string;
        documentType: string;
        updatedAt: string;
        workflowNodeName?: string;
        workflowInstanceTitle?: string;
        sourceName: string;
        authorName: string;
      },
      keyword: string,
      type: string,
      fromDate: string,
      toDate: string,
    ): boolean;
    groupOutputsByDay(
      items: readonly {
        id: string;
        name: string;
        updatedAt: string;
      }[],
    ): readonly {
      date: string;
      items: readonly { id: string; name: string; updatedAt: string }[];
    }[];
    formatFileSize(value: number): string;
    outputLoadErrorMessage(cause: unknown): string;
    normalizeReportSchedule(value?: Record<string, unknown>): {
      enabled: boolean;
      frequency: string;
      time: string;
      timezone: string;
      weekday: number;
      dayOfMonth: number;
    };
    reportScheduleSummary(value?: Record<string, unknown>): string;
    normalizeReportMarkdown(content: string): string;
    parseReportBlocks(content: string): readonly {
      type: string;
      text?: string;
      items?: readonly string[];
    }[];
    roleCodeKey(role: { code?: string }): string;
    roleFieldsDiffer(left: RoleLike, right: RoleLike): boolean;
    computeRoleDiff(
      effective: readonly RoleLike[],
      draft: readonly RoleLike[],
    ): {
      added: readonly RoleLike[];
      updated: readonly RoleLike[];
      removed: readonly RoleLike[];
    };
    nextRoleCopyCode(
      baseCode: string,
      roles: readonly { code: string }[],
    ): string;
    openTask(taskId: string, workspaceId: string): void;
    openWorkflow(instanceId: string, workspaceId: string): void;
  };
}

function fakeWindow(): Record<string, any> {
  const events: Array<{ type: string; detail?: unknown }> = [];
  const windowStub: Record<string, any> = {
    __events: events,
    __ModuleLoader__: {
      load: (definition: {
        id: string;
        factory: (require: (id: string) => unknown) => unknown;
      }) => {
        loaded = definition.factory((id: string) => {
          if (id === "react") return fakeReact;
          throw new Error(`unexpected module: ${id}`);
        }) as ClientExports;
      },
    },
    localStorage: {
      getItem: () => null,
      setItem: () => undefined,
    },
    __pluginmaxShell: {
      setRoute: (route: string) => {
        windowStub.__route = route;
      },
    },
    dispatchEvent: (event: { type: string; detail?: unknown }) => {
      events.push({ type: event.type, detail: event.detail });
      return true;
    },
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    setTimeout: () => 1,
    clearTimeout: () => undefined,
    setInterval: () => 1,
    clearInterval: () => undefined,
    CustomEvent: class {
      constructor(
        readonly type: string,
        readonly options?: { detail?: unknown },
      ) {}
      get detail() {
        return this.options?.detail;
      }
    },
  };
  let loaded: ClientExports = {};
  windowStub.__loaded = () => loaded;
  return windowStub;
}

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

function loadClientExports(): {
  exports: ClientExports;
  window: Record<string, any>;
} {
  const windowStub = fakeWindow();
  const source = readFileSync(CLIENT_PATH, "utf8");
  const factory = new Function(
    "window",
    "module",
    "exports",
    "CustomEvent",
    source,
  ) as (
    window: unknown,
    module: { exports: unknown },
    exports: unknown,
    customEvent: unknown,
  ) => void;
  const module = { exports: {} };
  factory(windowStub, module, module.exports, windowStub.CustomEvent);
  return {
    exports: windowStub.__loaded() as ClientExports,
    window: windowStub,
  };
}

describe("project management client", () => {
  it("maps project and workflow states to the shared pill tones", () => {
    const { exports: client } = loadClientExports();
    const helpers = client.__test;
    expect(helpers?.statusTone("风险")).toBe("warn");
    expect(helpers?.statusTone("已完成")).toBe("done");
    expect(helpers?.statusTone("关注")).toBe("notice");
    expect(helpers?.statusTone("规划中")).toBe("notice");
    expect(helpers?.statusTone("进行中")).toBe("progress");
    expect(helpers?.statusTone("已取消")).toBe("cancelled");
    expect(helpers?.statusTone("已归档")).toBe("archived");
    expect(helpers?.priorityLabel("P1")).toBe("P0");
    expect(helpers?.priorityLabel("P2")).toBe("P1");
    expect(helpers?.priorityLabel("P3")).toBe("P2");
  });

  it("renders permission scopes instead of free text", () => {
    const { exports: client } = loadClientExports();
    expect(client.__test?.permissionLabels(["read", "write", "read"])).toBe(
      "查看、编辑",
    );
    expect(client.__test?.permissionLabels([])).toBe("未分配");
    expect(client.__test?.permissionLabels(["manage_members", "approve"])).toBe(
      "成员管理、审批",
    );
  });

  it("formats platform user options with human and AI platform roles", () => {
    const { exports: client } = loadClientExports();
    const label = client.__test?.platformUserOptionLabel;
    expect(
      label?.({ name: "QA Member", platformRole: "平台成员" }, "human"),
    ).toBe("QA Member（平台成员）");
    expect(
      label?.(
        {
          name: "会议 Facilitator",
          kindLabel: "平台 AI Teammate",
          ownerName: "Olivia",
        },
        "agent",
      ),
    ).toBe("会议 Facilitator·AI（by Olivia）");
  });

  it("summarizes authorization from effective project roles", () => {
    const { exports: client } = loadClientExports();
    expect(
      client.__test?.memberScopeForRoles(
        [
          { id: "project-custom", permissions: ["read", "approve"] },
          { id: "project-owner", permissions: ["manage_members"] },
        ],
        ["project-custom"],
      ),
    ).toBe("查看、审批");
  });

  it("groups project members by role while retaining empty roles", () => {
    const { exports: client } = loadClientExports();
    const groups = client.__test?.groupMembersByProjectRole(
      [
        { id: "role-pm", name: "项目经理" },
        { id: "role-dev", name: "开发" },
        { id: "role-qa", name: "测试" },
      ],
      [
        {
          id: "tm-project-ws-1",
          kind: "agent",
          roleIds: ["role-pm", "role-dev"],
        },
        { id: "peter", kind: "human", roleIds: ["role-dev"] },
        { id: "unassigned", kind: "human", roleIds: [] },
      ],
    );
    expect(groups?.map((group) => group.role.id)).toEqual([
      "role-pm",
      "role-dev",
      "role-qa",
    ]);
    expect(groups?.[0]?.members.map((member) => member.id)).toEqual([
      "tm-project-ws-1",
    ]);
    expect(groups?.[1]?.members.map((member) => member.id)).toEqual([
      "tm-project-ws-1",
      "peter",
    ]);
    expect(groups?.[2]?.members).toEqual([]);
  });

  it("keeps project members in the original row table with management actions", () => {
    const source = readFileSync(CLIENT_PATH, "utf8");
    const start = source.indexOf("const renderMembersTab = () => {");
    const end = source.indexOf("const renderProjectRoleEditor", start);
    const membersSource = source.slice(start, end);
    expect(membersSource).toContain('h("h3", null, "成员权限")');
    expect(membersSource).toContain('className: "pmproj-table"');
    expect(membersSource).toContain('className: "pmproj-row"');
    expect(membersSource).toContain('"项目角色"');
    expect(membersSource).toContain('"平台角色"');
    expect(membersSource).toContain('"授权范围"');
    expect(membersSource).toContain('"变更"');
    expect(membersSource).toContain('"移除"');
    expect(membersSource).toContain('"管理"');
    expect(membersSource).toContain('"角色指派"');
    expect(membersSource).toContain("renderMembersRoleAssignmentTab()");
    expect(membersSource).not.toContain("pmproj-member-card-grid");
    expect(membersSource).not.toContain("pmproj-role-view");
  });

  it("lets users collapse and expand the all-members pool", () => {
    const source = readFileSync(CLIENT_PATH, "utf8");
    expect(source).toContain("memberPoolCollapsed");
    expect(source).toContain("pmproj-member-pool-toggle");
    expect(source).toContain("收起全部成员");
    expect(source).toContain("展开全部成员");
    expect(source).toContain('"aria-controls": "pmproj-all-members-grid"');
  });

  it("labels workspace membership roles independently from platform roles", () => {
    const { exports: client } = loadClientExports();
    expect(client.__test?.workspaceRoleLabel("owner")).toBe("负责人");
    expect(client.__test?.workspaceRoleLabel("guest")).toBe("访客");
    expect(client.__test?.workspaceRoleLabel(undefined)).toBe("不适用");
  });

  it("uses hysteresis to keep the sticky member pool from flickering", () => {
    const { exports: client } = loadClientExports();
    const resolve = client.__test?.resolveMemberPoolStuck;
    expect(resolve).toBeTypeOf("function");

    expect(
      resolve?.({
        current: false,
        sentinelTop: 0.4,
        containerTop: 0,
        poolBottom: 137,
      }),
    ).toBe(true);
    expect(
      resolve?.({
        current: true,
        sentinelTop: 1,
        containerTop: 0,
        poolBottom: 105,
      }),
    ).toBe(true);
    expect(
      resolve?.({
        current: true,
        sentinelTop: 23.9,
        containerTop: 0,
        poolBottom: 105,
      }),
    ).toBe(true);
    expect(
      resolve?.({
        current: true,
        sentinelTop: 24.1,
        containerTop: 0,
        poolBottom: 105,
      }),
    ).toBe(false);
    expect(
      resolve?.({
        current: false,
        sentinelTop: 16,
        containerTop: 0,
        poolBottom: 137,
      }),
    ).toBe(false);
    expect(
      resolve?.({
        current: true,
        sentinelTop: 52,
        containerTop: 0,
        poolBottom: 278,
        atScrollEnd: true,
      }),
    ).toBe(true);
  });

  it("falls back to the loaded directory when member search is unavailable", () => {
    const { exports: client } = loadClientExports();
    const result = client.__test?.filterMemberDirectoryLocally(
      {
        humans: [
          {
            id: "mia",
            name: "Mia",
            principalId: "principal-human-mia",
            platformRole: "平台成员",
          },
        ],
        agents: [
          {
            id: "teammate-2",
            name: "小白PD",
            ownerName: "Olivia",
            ownerUserId: "olivia",
          },
          {
            id: "teammate-3",
            name: "计划助手",
            ownerName: "Mia",
          },
          {
            id: "system-data-agent",
            name: "Data Agent",
            ownerName: "Mia",
            systemKey: "data-agent",
          },
          {
            id: "legacy-facilitator",
            name: "Demo 会议Facilitator",
            ownerName: "Mia",
          },
        ],
      },
      [{ id: "olivia", name: "Olivia", kind: "human" }],
      "Olivia",
    );
    expect(result?.humans).toEqual([]);
    expect(result?.agents.map((item) => item.id)).toEqual(["teammate-2"]);
    for (const keyword of ["Data Agent", "Demo 会议Facilitator"]) {
      expect(
        client.__test?.filterMemberDirectoryLocally(
          {
            humans: [],
            agents: [
              {
                id: "system-data-agent",
                name: "Data Agent",
                ownerName: "Mia",
              },
              {
                id: "legacy-facilitator",
                name: "Demo 会议Facilitator",
                ownerName: "Mia",
              },
            ],
          },
          [],
          keyword,
        )?.agents,
      ).toEqual([]);
    }
    expect(
      client.__test
        ?.filterMemberDirectoryLocally(
          {
            humans: [],
            agents: [{ id: "teammate-3", name: "计划助手", ownerName: "Mia" }],
          },
          [],
          "计划",
        )
        ?.agents.map((item) => item.id),
    ).toEqual(["teammate-3"]);
  });

  it("marks the project owner from the owner id or workspace owner role", () => {
    const { exports: client } = loadClientExports();
    const isProjectOwner = client.__test?.isProjectOwner;
    const source = readFileSync(CLIENT_PATH, "utf8");
    expect(
      isProjectOwner?.(
        { id: "platform-admin", kind: "human" },
        "platform-admin",
      ),
    ).toBe(true);
    expect(
      isProjectOwner?.({ id: "other-member", kind: "human" }, "platform-admin"),
    ).toBe(false);
    expect(
      isProjectOwner?.(
        { id: "platform-admin", kind: "agent" },
        "platform-admin",
      ),
    ).toBe(false);
    expect(
      isProjectOwner?.(
        {
          id: "workspace-owner",
          kind: "human",
          workspaceRole: "owner",
        },
        "",
      ),
    ).toBe(true);
    expect(
      isProjectOwner?.(
        { id: "regular-member", kind: "human", workspaceRole: "member" },
        "",
      ),
    ).toBe(false);
    expect(source).toContain("isProjectOwner(member, selectedProject.ownerId)");
    expect(source).toContain('className: "pmproj-owner-tag"');
  });

  it("keeps member subtitles free of Principal labels", () => {
    const source = readFileSync(CLIENT_PATH, "utf8");
    const membersTabStart = source.indexOf("const renderMembersTab");
    const roleEditorStart = source.indexOf("const renderProjectRoleEditor");
    const membersTab = source.slice(membersTabStart, roleEditorStart);
    expect(membersTabStart).toBeGreaterThan(-1);
    expect(roleEditorStart).toBeGreaterThan(membersTabStart);
    expect(membersTab).not.toContain("Human Principal");
    expect(membersTab).not.toContain("AI Principal");
    expect(membersTab).not.toContain("member.kindLabel");
    expect(membersTab).not.toContain("工作区角色属于项目成员关系");
    expect(membersTab).not.toContain("工作区角色：");
    expect(membersTab).toContain("h(MemberSubtitle, { member })");
    expect(source).toContain("` · Owner ${member.ownerName}`");
    expect(source).toContain("`Human · 加入 ${new Date(");
    expect(source).toContain(
      ".pmproj-member-kind.agent{color:var(--dsw-alias-agent-primary",
    );
  });

  it("compacts long workspace paths while preserving copyable input", () => {
    const { exports: client } = loadClientExports();
    expect(
      client.__test?.compactWorkspacePath(
        "/Users/oliviayang/Deepseek Harness/projects/web-team-proj/1017-项目测试",
      ),
    ).toBe(".../projects/web-team-proj/1017-项目测试");
    expect(
      client.__test?.compactWorkspacePath(
        "C:\\Users\\olivia\\projects\\web-team-proj",
        2,
      ),
    ).toBe(".../projects/web-team-proj");
    expect(client.__test?.compactWorkspacePath("")).toBe("未知");
  });

  it("exposes workspace identity, membership role and leave controls", () => {
    const source = readFileSync(CLIENT_PATH, "utf8");
    expect(source).toContain("工作区 ID");
    expect(source).toContain("工作区路径");
    expect(source).toContain("pmproj-copy-icon");
    expect(source).toContain("复制工作区 ID");
    expect(source).toContain("复制工作区路径");
    expect(source).toContain("工作区角色");
    expect(source).toContain("加入时间");
    expect(source).toContain("pluginmax:follow-change");
    expect(source).toContain("__pluginmaxFollow");
    expect(source).toContain("退出项目");
    expect(source).toContain('"/api/collab/projects/leave"');
    expect(source).toContain("pmproj-avatar human");
    expect(source).toContain("pmproj-avatar-ring");
    expect(source).toContain("memberAvatarArt");
    expect(source).toContain("需改派");
    expect(source).toContain("reassignmentReason");
  });

  it("keeps the project directory text-only without decorative thumbnails", () => {
    const source = readFileSync(CLIENT_PATH, "utf8");
    const start = source.indexOf("const renderProjectList");
    const end = source.indexOf("const renderFacts", start);
    expect(start).toBeGreaterThan(-1);
    expect(end).toBeGreaterThan(start);
    expect(source.slice(start, end)).not.toContain("pmproj-list-mark");
    expect(source.slice(start, end)).toContain("项目列表");
    expect(source).toContain(
      ".pmproj-layout{display:grid;grid-template-columns:minmax(248px,292px) minmax(0,1fr);gap:12px;align-items:stretch;min-height:calc(100vh - 170px)",
    );
    expect(source).toContain(
      ".pmproj-directory{display:flex;flex-direction:column;gap:0;min-width:0;height:auto;min-height:0;align-self:stretch",
    );
    expect(source).toContain(
      ".pmproj-list{flex:1;min-height:0;display:grid;align-content:start;gap:4px",
    );
    expect(source).toContain("scrollbar-gutter:stable");
    expect(source).toContain(
      "font-size:12.5px;font-weight:650;line-height:1.4",
    );
  });

  it("uses the demo interaction feedback for search, rows and actions", () => {
    const source = readFileSync(CLIENT_PATH, "utf8");
    expect(source).toContain(".pmproj-search:focus-within");
    expect(source).toContain(".pmproj-list-item.active");
    expect(source).toContain(
      ".pmproj-chip{border:0.5px solid var(--dsw-alias-border-l3);border-radius:4px;padding:1px 6px;background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary)",
    );
    expect(source).not.toContain('member.kind === "agent" ? "agent" : ""');
    expect(source).toContain("var(--dsw-alias-accent-primary");
    expect(source).toContain(".pmproj-row:hover");
    expect(source).toContain(".pmproj-btn.secondary:not(:disabled):hover");
  });

  it("opens the shared task creation modal from the project task list", () => {
    const source = readFileSync(CLIENT_PATH, "utf8");
    const start = source.indexOf("const renderTasksTab");
    const end = source.indexOf("const renderWorkflowsTab", start);
    const tasksTab = source.slice(start, end);
    expect(tasksTab).toContain('"新建任务"');
    expect(tasksTab).toContain('"pluginmax:task-create-open"');
    expect(tasksTab).toContain("preserveCurrentView: true");
    expect(tasksTab).toContain("receiverId: viewer?.id");
    expect(source).toContain('"pluginmax:tasks-created"');
  });

  it("uses compact project details and role-setting hierarchy", () => {
    const source = readFileSync(CLIENT_PATH, "utf8");
    const roleEditorStart = source.indexOf("const renderProjectRoleEditor");
    const roleEditorEnd = source.indexOf(
      "const renderTasksTab",
      roleEditorStart,
    );
    const roleEditor = source.slice(roleEditorStart, roleEditorEnd);
    const titleIndex = roleEditor.indexOf("项目角色清单");
    const countIndex = roleEditor.indexOf("${draftRoles.length} 个角色");
    const templateButtonIndex = roleEditor.indexOf("从模版加载");

    expect(source).toContain("pmproj-follow-star");
    expect(source).toContain("pmproj-btn subtle");
    expect(source).toContain("pmproj-settings-basics");
    expect(roleEditor).toContain('"pmproj-head-actions pmproj-role-actions"');
    expect(source).toContain(
      ".pmproj-role-actions .pmproj-btn.small{height:30px;min-height:30px;",
    );
    expect(source).toContain(
      ".pmproj-detail{min-width:0;display:flex;flex-direction:column;gap:8px;}",
    );
    expect(titleIndex).toBeGreaterThan(-1);
    expect(countIndex).toBeGreaterThan(titleIndex);
    expect(templateButtonIndex).toBeGreaterThan(countIndex);
  });

  it("saves the current project roles and business chain as a named template", () => {
    const source = readFileSync(CLIENT_PATH, "utf8");
    expect(source).toContain("/api/collab/projects/templates/from-project");
    expect(source).toContain("保存为项目模版");
    expect(source).toContain("模版名称");
    expect(source).toContain("项目类型");
    expect(source).toContain("renderProjectTemplateSaveModal()");
    expect(source).toContain("pmproj-template-summary");
    expect(source).toContain("成员、任务与运行实例不会写入模版");
  });

  it("filters project audit events by category and searchable detail", () => {
    const { exports: client } = loadClientExports();
    const event = {
      summary: "更新项目设置（1 项）",
      actorName: "Admin",
      actorRole: "admin",
      targetName: "1017-项目测试",
      action: "project.settings.update",
      category: "project",
      detail: { 运行状态: "进行中 → 已完成" },
    };
    expect(client.__test?.auditCategoryLabel("template")).toBe("关联模版");
    expect(client.__test?.auditMatches(event, "已完成", "all")).toBe(true);
    expect(client.__test?.auditMatches(event, "已完成", "member")).toBe(false);
    expect(client.__test?.auditMatches(event, "admin", "project")).toBe(true);
  });

  it("filters projects by name, code, owner and status", () => {
    const { exports: client } = loadClientExports();
    const project = {
      name: "一切皆插件",
      code: "PRJ-001",
      ownerName: "Olivia",
      status: "进行中",
      health: "健康",
    };
    expect(client.__test?.projectMatches(project, "")).toBe(true);
    expect(client.__test?.projectMatches(project, "prj-001")).toBe(true);
    expect(client.__test?.projectMatches(project, "olivia")).toBe(true);
    expect(client.__test?.projectMatches(project, "风险")).toBe(false);
  });

  it("sorts active tasks by priority then recency", () => {
    const { exports: client } = loadClientExports();
    const sorted = client.__test?.sortProjectTasks([
      { id: "b", priority: "P2", createdAt: "2026-10-02T00:00:00.000Z" },
      { id: "a", priority: "P1", createdAt: "2026-10-01T00:00:00.000Z" },
      { id: "c", priority: "P1", createdAt: "2026-10-03T00:00:00.000Z" },
    ]);
    expect(sorted?.map((task) => task.id)).toEqual(["c", "a", "b"]);
  });

  it("maps planned, revised, actual and anomaly workflow facts", () => {
    const { exports: client } = loadClientExports();
    const overview = client.__test?.buildProgressOverview({
      workflowDetail: {
        instance: {
          id: "wf-1",
          workspaceId: "ws-1",
          title: "AI Server 交付",
          updatedAt: "2026-11-18T02:00:00.000Z",
          nodes: {
            design: {
              status: "completed",
              completedAt: "2026-11-12T16:40:00.000Z",
              progress: {
                planned: { quantity: 180, date: "2026-10-31" },
                revised: { quantity: 186, date: "2026-11-12" },
                actual: { quantity: 186, date: "2026-11-12" },
              },
            },
            supply: {
              status: "blocked",
              assignedTo: "xu",
              enteredAt: "2026-11-17T09:20:00.000Z",
              taskIds: ["TSK-1"],
              progress: {
                planned: { quantity: 200, date: "2026-11-25" },
                revised: { quantity: 180, date: "2026-11-30" },
                actual: { quantity: 152 },
              },
            },
          },
          assignmentBindings: {
            design: {
              primaryAssignee: { name: "林然" },
              source: { label: "产品" },
            },
          },
        },
        definition: {
          graph: {
            nodes: [
              {
                id: "design",
                name: "需求与方案",
                executor: { kind: "user", id: "lin" },
                businessChain: {
                  fields: [
                    {
                      key: "planned",
                      label: "原计划",
                      bindings: [
                        {
                          system: "APS",
                          objectId: "P1",
                          path: "planned.quantity",
                        },
                        { system: "APS", objectId: "P1", path: "planned.date" },
                      ],
                    },
                    {
                      key: "revised",
                      label: "变更后",
                      bindings: [
                        {
                          system: "APS",
                          objectId: "P1",
                          path: "revised.quantity",
                        },
                        { system: "APS", objectId: "P1", path: "revised.date" },
                      ],
                    },
                    {
                      key: "actual",
                      label: "实际完成",
                      bindings: [
                        {
                          system: "APS",
                          objectId: "P1",
                          path: "actual.quantity",
                        },
                        { system: "APS", objectId: "P1", path: "actual.date" },
                      ],
                    },
                  ],
                },
              },
              {
                id: "supply",
                name: "供应备货",
                executor: { kind: "user", id: "xu" },
                businessChain: {
                  fields: [
                    {
                      key: "planned",
                      label: "原计划",
                      bindings: [
                        {
                          system: "APS",
                          objectId: "P2",
                          path: "planned.quantity",
                        },
                        { system: "APS", objectId: "P2", path: "planned.date" },
                      ],
                    },
                    {
                      key: "revised",
                      label: "变更后",
                      bindings: [
                        {
                          system: "APS",
                          objectId: "P2",
                          path: "revised.quantity",
                        },
                        { system: "APS", objectId: "P2", path: "revised.date" },
                      ],
                    },
                    {
                      key: "actual",
                      label: "实际完成",
                      bindings: [
                        {
                          system: "APS",
                          objectId: "P2",
                          path: "actual.quantity",
                        },
                      ],
                    },
                  ],
                },
              },
            ],
            edges: [{ from: "design", to: "supply" }],
          },
        },
        events: [
          {
            id: "event-1",
            nodeId: "supply",
            kind: "agent.ticket_denied",
            message: "Action Ticket 越权被拒",
            at: "2026-11-18T01:00:00.000Z",
          },
        ],
      },
      tasks: [
        {
          id: "TSK-1",
          title: "重排供应计划",
          status: "progress",
          priority: "P1",
          receiverType: "human",
          receiverName: "许澄",
          updatedAt: "2026-11-18T01:10:00.000Z",
          executionAnomaly: {
            code: "GPU_GAP",
            message: "GPU 缺口 6 个",
            at: "2026-11-18T01:10:00.000Z",
          },
          workflow: {
            instanceId: "wf-1",
            nodeId: "supply",
            nodeName: "供应备货",
          },
        },
      ],
      memberNames: {
        lin: "林然",
        xu: "许澄",
      },
    });
    expect(overview?.nodes).toHaveLength(2);
    expect(overview?.nodes[0]).toMatchObject({
      code: "1",
      name: "需求与方案",
      owner: "林然",
      statusLabel: "已完成",
      plannedLabel: "180 · 2026-10-31",
      revisedLabel: "186 · 2026-11-12",
      actualLabel: "186 · 2026-11-12",
      fields: [
        { key: "planned", label: "原计划", value: "180 · 2026-10-31" },
        { key: "revised", label: "变更后", value: "186 · 2026-11-12" },
        { key: "actual", label: "实际完成", value: "186 · 2026-11-12" },
      ],
      isAnomaly: false,
    });
    expect(overview?.nodes[1]).toMatchObject({
      code: "2",
      name: "供应备货",
      owner: "许澄",
      statusLabel: "阻塞",
      plannedLabel: "200 · 2026-11-25",
      revisedLabel: "180 · 2026-11-30",
      actualLabel: "152 · 未完成",
      fields: [
        { key: "planned", label: "原计划", value: "200 · 2026-11-25" },
        { key: "revised", label: "变更后", value: "180 · 2026-11-30" },
        { key: "actual", label: "实际完成", value: "152" },
      ],
      alertCount: 2,
      taskCount: 1,
      isAnomaly: true,
    });
    expect(overview?.nodes[1]?.exceptionText).toContain(
      "供应备货 · 执行权限被拒",
    );
    expect(overview?.nodes[1]?.exceptionText).toContain("重排供应计划");
  });

  it("does not invent custom node fields when the business chain declares none", () => {
    const { exports: client } = loadClientExports();
    const overview = client.__test?.buildProgressOverview({
      workflowDetail: {
        instance: {
          id: "wf-1",
          workspaceId: "ws-1",
          title: "最小流程",
          updatedAt: "2026-11-18T02:00:00.000Z",
          nodes: {
            review: {
              status: "running",
              enteredAt: "2026-11-18T01:00:00.000Z",
            },
          },
        },
        definition: {
          graph: {
            nodes: [
              {
                id: "review",
                name: "评审",
                executor: { kind: "role", id: "role-review" },
              },
            ],
            edges: [],
          },
        },
        events: [],
      },
      tasks: [],
    });
    expect(overview?.nodes[0]).toMatchObject({
      owner: "role-review",
      plannedLabel: "数量未记录 · 日期未记录",
      revisedLabel: "数量未记录 · 日期未记录",
      actualLabel: "未完成",
      fields: [],
      exceptionText: "无",
    });
  });

  it("shows a weak placeholder when the revised plan did not change", () => {
    const { exports: client } = loadClientExports();
    const revisedText = client.__test?.progressRevisedText;
    expect(
      revisedText?.("数量未记录 · 日期未记录", "数量未记录 · 日期未记录"),
    ).toBe("--");
    expect(revisedText?.("186 · 2026-11-12", "186 · 2026-11-12")).toBe("--");
    expect(revisedText?.("186 · 2026-11-12", "180 · 2026-11-30")).toBe(
      "180 · 2026-11-30",
    );
  });

  it("links an alert to its tasks and highlights only the selected alert tasks", () => {
    const { exports: client } = loadClientExports();
    const overview = client.__test?.buildProgressOverview({
      workflowDetail: {
        instance: {
          id: "wf-1",
          workspaceId: "ws-1",
          title: "联调流程",
          updatedAt: "2026-11-18T02:00:00.000Z",
          nodes: {
            verify: {
              status: "blocked",
              enteredAt: "2026-11-18T01:00:00.000Z",
              taskIds: ["TSK-1", "TSK-2"],
            },
          },
          assignmentBindings: {},
        },
        definition: {
          graph: {
            nodes: [{ id: "verify", name: "联调验证" }],
            edges: [],
          },
        },
        events: [
          {
            id: "event-1",
            nodeId: "verify",
            kind: "agent.failed",
            message: "支付网关超时",
            at: "2026-11-18T01:30:00.000Z",
          },
        ],
      },
      tasks: [
        {
          id: "TSK-1",
          title: "追踪支付网关",
          status: "progress",
          priority: "P1",
          receiverType: "human",
          updatedAt: "2026-11-18T01:30:00.000Z",
          workflow: { instanceId: "wf-1", nodeId: "verify" },
        },
        {
          id: "TSK-2",
          title: "补充回归用例",
          status: "todo",
          priority: "P2",
          receiverType: "human",
          updatedAt: "2026-11-18T01:30:00.000Z",
          workflow: { instanceId: "wf-1", nodeId: "verify" },
        },
      ],
    });
    const alert = overview?.alerts[0];
    expect(alert?.taskIds).toEqual(["TSK-1", "TSK-2"]);
    const selection = client.__test?.resolveProgressSelection(
      overview!,
      "verify",
      alert?.id,
    );
    expect(selection?.node?.id).toBe("verify");
    expect(selection?.alerts).toHaveLength(1);
    expect(selection?.tasks.map((task) => task.id)).toEqual(["TSK-1", "TSK-2"]);
    expect(selection?.highlightedTaskIds).toEqual(["TSK-1", "TSK-2"]);
  });

  it("allows clearing the selected progress node", () => {
    const { exports: client } = loadClientExports();
    expect(
      client.__test?.resolveProgressSelection(
        { nodes: [{ id: "node-1" }], alerts: [], tasksByNode: {} },
        "",
        "",
      ),
    ).toEqual({
      node: null,
      alerts: [],
      tasks: [],
      highlightedTaskIds: [],
    });
    const source = readFileSync(CLIENT_PATH, "utf8");
    expect(source).toContain('current === nodeId ? "" : nodeId');
  });

  it("keeps change and external-impact events chronological with sources", () => {
    const { exports: client } = loadClientExports();
    const events = client.__test?.buildProgressChangeEvents([
      {
        id: "external",
        kind: "external.impact",
        at: "2026-11-17T09:20:00.000Z",
        actorName: "OMS同步更新",
        message: "华东仓库存回传延迟 2 天",
      },
      {
        id: "order",
        kind: "order.changed",
        at: "2026-10-28T09:00:00.000Z",
        actorName: "订单履约·张三",
        message: "客户追加 20 台 AI Server",
      },
      {
        id: "supply",
        kind: "supply.changed",
        at: "2026-11-03T14:30:00.000Z",
        actorName: "供应链计划·许澄",
        message: "GPU 供应量减少 20 个",
      },
      {
        id: "ignored",
        kind: "node.completed",
        at: "2026-11-04T09:00:00.000Z",
        message: "节点完成",
      },
    ]);
    expect(events?.map((event) => event.id)).toEqual([
      "order",
      "supply",
      "external",
    ]);
    expect(events?.[0]?.categoryLabel).toBe("订单变更");
    expect(
      events === undefined
        ? ""
        : client.__test?.formatProgressChangeEvent(events[0]!),
    ).toBe(
      "2026-10-28 09:00 【订单变更】客户追加 20 台 AI Server（来自：订单履约·张三）",
    );
    expect(events?.[2]?.source).toBe("OMS同步更新");
  });

  it("reuses the latest daily report for key progress and attention", () => {
    const { exports: client } = loadClientExports();
    const result = client.__test?.projectReportProgress([
      {
        reportType: "daily",
        date: "2026-11-17",
        generatedAt: "2026-11-17T08:00:00.000Z",
        createdAt: "2026-11-17T08:00:00.000Z",
        generationMode: "agent",
        content:
          "## 关键结果\n- 接口完成第 2 轮联调\n- 首批测试机到仓\n## 风险与异常\n- GPU 缺口 6 个\n",
      },
      {
        reportType: "daily",
        date: "2026-11-18",
        generatedAt: "2026-11-18T08:00:00.000Z",
        createdAt: "2026-11-18T08:00:00.000Z",
        generationMode: "agent",
        content:
          "## 关键结果\n- 替代供应方案已确认\n## 风险与异常\n- 库存回传超 SLA\n",
      },
      {
        reportType: "weekly",
        date: "2026-11-19",
        generatedAt: "2026-11-19T08:00:00.000Z",
        createdAt: "2026-11-19T08:00:00.000Z",
        generationMode: "deterministic_fallback",
        content: "## 关键结果\n- 周报结果",
      },
    ]);
    expect(result?.latest?.date).toBe("2026-11-18");
    expect(result?.progress).toEqual(["替代供应方案已确认"]);
    expect(result?.attention).toEqual(["库存回传超 SLA"]);
  });

  it("does not turn non-result report explanations into key progress", () => {
    const { exports: client } = loadClientExports();
    const result = client.__test?.projectReportProgress([
      {
        reportType: "daily",
        date: "2026-11-18",
        generatedAt: "2026-11-18T08:00:00.000Z",
        createdAt: "2026-11-18T08:00:00.000Z",
        generationMode: "agent",
        content:
          "## 关键结果\n- 报告日未捕获到已确认完成的任务结果。\n- 事实包中状态分布均为空，无可引用的结果明细。\n## 风险与异常\n- 数据缺口：任务与工作流记录均为 0 条。\n",
      },
    ]);
    expect(result?.progress).toEqual([]);
    expect(result?.attention).toEqual([]);
  });

  it("reads completed work from the latest progress report", () => {
    const { exports: client } = loadClientExports();
    const result = client.__test?.projectReportProgress([
      {
        reportType: "daily",
        date: "2026-11-19",
        generatedAt: "2026-11-19T01:21:24.633Z",
        createdAt: "2026-11-19T01:21:24.633Z",
        generationMode: "agent",
        skillVersion: "1.0.0",
        content: "## 关键结果\n- 日报结果",
      },
      {
        reportType: "progress",
        date: "2026-11-19",
        generatedAt: "2026-11-19T04:40:28.856Z",
        createdAt: "2026-11-19T04:40:28.856Z",
        generationMode: "agent",
        skillVersion: "1.0.0",
        content:
          "## 已完成\n- 进度汇报中的已完成结果\n## 正在推进\n- 正在推进的客户追加任务\n## 风险与依赖\n- 需要关注的风险\n",
      },
    ]);
    expect(result?.latest?.reportType).toBe("progress");
    expect(result?.progress).toEqual([
      "进度汇报中的已完成结果",
      "正在推进的客户追加任务",
    ]);
    expect(result?.attention).toEqual(["需要关注的风险"]);
  });

  it("formats the key-progress update time as yyyy-mm-dd hh:mm", () => {
    const { exports: client } = loadClientExports();
    expect(
      client.__test?.formatProjectUpdatedAt("2026-11-18T02:05:00.000Z"),
    ).toBe("2026-11-18 10:05");
    expect(
      client.__test?.formatProjectUpdatedAt("11-18 15:10", "2026-11-18"),
    ).toBe("2026-11-18 15:10");
    expect(client.__test?.formatProjectUpdatedAt("")).toBe("暂无");
    const source = readFileSync(CLIENT_PATH, "utf8");
    expect(source).toContain("pmproj-key-progress-updated");
    expect(source).toContain("progressFacts.latest?.date");
    expect(source).toContain("serverOverview?.keyProgress?.latestReportAt");
    expect(source).not.toContain("来源：项目汇报 Skill v");
    expect(source).toContain("@keyframes pmproj-progress-spin");
    expect(source).toContain('"aria-busy": busy === "report"');
  });

  it("applies uploaded local demo data over the progress overview", () => {
    const { exports: client } = loadClientExports();
    const overview = {
      nodes: [
        {
          id: "supply-prep",
          status: "waiting",
          statusLabel: "未开始",
          tone: "notice",
          owner: "原负责人",
          fields: [{ key: "actual", label: "到料", value: "未记录" }],
          exceptionText: "无",
          isAnomaly: false,
        },
      ],
      changeEvents: [],
    };
    const result = client.__test?.applyProgressDemoData(overview, {
      fileName: "demo.json",
      data: {
        nodes: {
          "supply-prep": {
            status: "blocked",
            owner: "采购负责人",
            exception: "GPU 到货延迟",
            fields: { actual: "184 套" },
          },
        },
        changeEvents: [
          {
            id: "demo-1",
            category: "supply",
            at: "2026-11-18T09:30:00+08:00",
            description: "关键物料延迟",
            source: "演示数据",
            linkedNodeIds: ["supply-prep"],
          },
        ],
      },
    });
    expect(result?.nodes[0]).toMatchObject({
      status: "blocked",
      statusLabel: "阻塞",
      owner: "采购负责人",
      exceptionText: "GPU 到货延迟",
      isAnomaly: true,
      fields: [{ key: "actual", value: "184 套" }],
    });
    expect(result?.changeEvents).toEqual([
      expect.objectContaining({
        id: "demo-1",
        categoryLabel: "供给变更",
        description: "关键物料延迟",
      }),
    ]);
  });

  it("shows current project role members on progress nodes", () => {
    const { exports: client } = loadClientExports();
    const result = client.__test?.applyProjectRoleMembers(
      {
        nodes: [
          {
            id: "supply-prep",
            owner: "Procurement",
          },
          {
            id: "integration-test",
            owner: "Quality",
          },
        ],
        definition: {
          graph: {
            nodes: [
              {
                id: "supply-prep",
                executor: { roleCode: "GSC_PROCUREMENT" },
              },
              {
                id: "integration-test",
                executor: { roleCode: "GSC_QUALITY" },
              },
            ],
          },
        },
      },
      [
        { id: "role-procurement", code: "GSC_PROCUREMENT" },
        { id: "role-quality", code: "GSC_QUALITY" },
      ],
      [
        {
          id: "tm-procurement",
          name: "采购专员 AI 伙伴",
          roleIds: ["role-procurement"],
        },
        {
          id: "admin",
          name: "平台Admin",
          roleIds: ["role-quality"],
        },
      ],
    );
    expect(result?.nodes).toEqual([
      expect.objectContaining({
        id: "supply-prep",
        owner: "采购专员 AI 伙伴",
      }),
      expect.objectContaining({
        id: "integration-test",
        owner: "平台Admin",
      }),
    ]);
  });

  it("binds zoom and workflow defaults within the supported range", () => {
    const { exports: client } = loadClientExports();
    expect(client.__test?.clampProgressZoom(0.2)).toBe(0.8);
    expect(client.__test?.clampProgressZoom(2)).toBe(1.4);
    expect(client.__test?.nextProgressZoom(1, 1)).toBe(1.1);
    expect(client.__test?.nextProgressZoom(0.8, -1)).toBe(0.8);
    expect(
      client.__test?.preferredProgressWorkflow([
        {
          id: "completed",
          status: "completed",
          updatedAt: "2026-11-18T02:00:00.000Z",
        },
        {
          id: "blocked",
          status: "blocked",
          updatedAt: "2026-11-17T02:00:00.000Z",
        },
      ])?.id,
    ).toBe("blocked");
  });

  it("keeps project overview before reports and lands there by default", () => {
    const source = readFileSync(CLIENT_PATH, "utf8");
    expect(source).toContain('react.useState("progress")');
    const progressTab = source.indexOf('label: "项目概览"');
    const reportsTab = source.indexOf('label: "项目日报"');
    expect(progressTab).toBeGreaterThan(-1);
    expect(reportsTab).toBeGreaterThan(progressTab);
    expect(source).toContain("pmproj-directory-count");
    expect(source).toContain("折叠项目列表");
    expect(source).toContain("展开项目列表");
    expect(source).toContain("pmproj-layout.collapsed");
    expect(source).toContain(
      ".pmproj-directory.collapsed .pmproj-directory-label",
    );
    expect(source).toContain(
      ".pmproj-directory.collapsed .pmproj-directory-count{min-width:30px;height:30px",
    );
    expect(source).toContain(".pmproj-directory-toggle{width:32px;height:32px");
    expect(source).toContain(
      ".pmproj-directory.collapsed .pmproj-directory-toggle{order:-1",
    );
    expect(source).toContain("全屏展示节点图");
    expect(source).toContain("退出全屏节点图");
    expect(source).toContain('event.key === "Escape"');
    expect(source).toContain("is-fullscreen");
    expect(source).toContain("data-alert-id");
    expect(source).toContain("data-task-id");
    expect(source).toContain("pmproj-flow-node-heading");
    const nodeHeading = source.indexOf('className: "pmproj-flow-node-heading"');
    const nodeTitle = source.indexOf(
      'className: "pmproj-flow-node-title"',
      nodeHeading,
    );
    expect(nodeHeading).toBeGreaterThan(-1);
    expect(nodeTitle).toBeGreaterThan(nodeHeading);
    const detailStart = source.indexOf("const renderDetail");
    const detailEnd = source.indexOf("const renderTemplateList", detailStart);
    const detailSource = source.slice(detailStart, detailEnd);
    expect(detailSource.indexOf("renderFacts()")).toBeLessThan(
      detailSource.indexOf("renderWorkspaceInfo()"),
    );
  });

  it("adds the business-chain settings tab and template policy controls", () => {
    const source = readFileSync(CLIENT_PATH, "utf8");
    const basics = source.indexOf('"基础信息"');
    const roles = source.indexOf('requestEditTab("roles")');
    const business = source.indexOf('requestEditTab("business-chain")');
    const other = source.indexOf('requestEditTab("other")');
    const businessEditor = source.indexOf("const renderBusinessChainEditor");
    const businessEditorEnd = source.indexOf(
      "const renderOutputsTab",
      businessEditor,
    );
    const projectBusinessChainEditor = source.slice(
      businessEditor,
      businessEditorEnd,
    );
    expect(basics).toBeGreaterThan(-1);
    expect(roles).toBeGreaterThan(basics);
    expect(business).toBeGreaterThan(roles);
    expect(other).toBeGreaterThan(business);
    expect(businessEditor).toBeGreaterThan(-1);
    expect(businessEditorEnd).toBeGreaterThan(businessEditor);
    expect(source).toContain("业务链路配置");
    expect(source).toContain("/api/collab/projects/business-chain?");
    expect(source).toContain("/api/collab/projects/business-chain/validate");
    expect(source).toContain("/api/collab/projects/business-chain/bind");
    expect(source).toContain("/api/collab/projects/business-chain/custom");
    expect(source).toContain("/api/collab/projects/business-chain/instance");
    expect(source).toContain("/api/collab/projects/progress-overview?");
    expect(source).toContain("上传配置");
    expect(projectBusinessChainEditor).toContain('"上传"');
    expect(projectBusinessChainEditor).not.toContain("上传项目链路配置");
    expect(source).toContain("业务链路图预览");
    expect(source).toContain("已有业务链路配置");
    expect(source).toContain("pmproj-business-chain-config-row");
    expect(source).toContain("pmproj-business-chain-policy-grid");
    expect(source).toContain("data-business-chain-preview-node");
    expect(source).toContain("businessChainConfigToMarkdown");
    expect(source).toContain('"业务链路"');
    expect(projectBusinessChainEditor).not.toContain('"当前业务链路"');
    expect(projectBusinessChainEditor).not.toContain('"来源项目模版"');
    expect(projectBusinessChainEditor).not.toContain('"节点与数据源"');
    expect(projectBusinessChainEditor).not.toContain('"添加来源"');
    expect(projectBusinessChainEditor).not.toContain('"字段配置"');
    expect(projectBusinessChainEditor).not.toContain('"来源绑定"');
    expect(projectBusinessChainEditor).not.toContain('"应用业务链路"');
    expect(projectBusinessChainEditor).not.toContain('"启动业务链路实例"');
    expect(projectBusinessChainEditor).toContain(
      'className: "pmproj-business-chain-toolbar"',
    );
    expect(projectBusinessChainEditor).toContain(
      '"pmproj-btn pmproj-business-chain-upload pmproj-business-chain-toolbar-action"',
    );
    expect(projectBusinessChainEditor).toContain(
      "businessChainUploadedFileName",
    );
    expect(projectBusinessChainEditor).not.toContain("已绑定");
    expect(projectBusinessChainEditor).toContain('"业务链路图预览"');
    expect(projectBusinessChainEditor).toContain('"数据源健康"');
    expect(projectBusinessChainEditor).toContain(
      'className: "pmproj-business-chain-source-row"',
    );
    expect(projectBusinessChainEditor).toContain('"链接探测"');
    expect(projectBusinessChainEditor).toContain(
      "businessChainValidationExpanded",
    );
    expect(projectBusinessChainEditor).toContain(
      '"aria-expanded": businessChainValidationExpanded',
    );
    expect(projectBusinessChainEditor).not.toContain("链接探测完成");
    expect(projectBusinessChainEditor).toContain('"校验"');
    expect(projectBusinessChainEditor).not.toContain('"校验绑定"');
    const editFooter = source.slice(
      source.indexOf("const renderEditFooter"),
      source.indexOf("const renderEditModal"),
    );
    expect(editFooter).toContain('"取消"');
    expect(editFooter).toContain('"启用"');
    expect(projectBusinessChainEditor).not.toContain(
      "已运行实例继续使用启动时的定义快照。",
    );
    expect(projectBusinessChainEditor).not.toContain(
      "项目自定义业务链路已应用",
    );
    expect(source).toContain(
      ".pmproj-node-links .pmproj-progress-task strong{",
    );
    expect(source).toContain(".pmproj-source-health strong{");
    expect(source).toContain(".pmproj-settings-sticky{");
    expect(source).not.toMatch(/\.pmproj-settings-sticky\{[^}]*border-bottom/);
    expect(source).toContain(
      ".pmproj-modal.wide{position:relative;width:min(960px,100%);height:min(760px,86vh);display:flex;flex-direction:column;overflow:hidden;}",
    );
    expect(source).toContain(
      ".pmproj-settings-body-scroll{flex:1;min-height:0;overflow:auto;",
    );
    expect(source).toContain('className: "pmproj-settings-body-scroll"');
    expect(source).toContain(".pmproj-settings-footer{");
    expect(source).toContain("renderEditFooter(),");
    expect(source).toContain("onFooterChange: setOtherSettingsFooter");
    expect(source).not.toContain("保存基础信息");
    expect(source).toContain(".pmproj-notice.pmproj-notice-error{");
    expect(source).toContain(
      ".pmproj-business-chain-toolbar-action{width:64px;height:28px;",
    );
    expect(source).toContain("放弃未应用修改");
    expect(source).toContain('"其它设置"');
    expect(source).toContain("pluginmax.project.settings.other");
    expect(source).toContain('"当前没有可配置的其它项目设置。"');
  });

  it("normalizes business-chain node bindings without inventing references", () => {
    const { exports: client } = loadClientExports();
    expect(
      client.__test?.normalizeBusinessChainBindings([
        {
          nodeId: "supply",
          externalRefs: [
            {
              system: "WMS",
              objectType: "project-kit",
              objectId: "INV-1",
              required: false,
            },
          ],
        },
        { nodeId: "order", externalRefs: [] },
      ]),
    ).toEqual([
      { nodeId: "order", externalRefs: [] },
      {
        nodeId: "supply",
        externalRefs: [
          {
            system: "WMS",
            objectType: "project-kit",
            objectId: "INV-1",
            required: false,
          },
        ],
      },
    ]);
  });

  it("imports a JSON business-chain configuration into workflow markdown", () => {
    const { exports: client } = loadClientExports();
    const source = client.__test?.businessChainConfigToMarkdown(
      JSON.stringify({
        businessChain: {
          templateId: "chain-upload",
          chainKey: "uploaded-chain",
          displayName: "上传链路",
          projectTypeCodes: ["研发类"],
          allowUnboundExternalNodes: true,
        },
        workflow: {
          key: "business-chain-uploaded",
          version: 2,
          name: "上传链路",
          nodes: [
            {
              id: "design",
              name: "方案设计",
              type: "task",
              executor: { kind: "user", id: "admin" },
              stageCode: "DESIGN",
              sequence: 1,
              summaryMetric: "design-status",
              externalRefs: [
                {
                  system: "CI-CD",
                  objectType: "pipeline",
                  objectId: "pipeline-01",
                  required: true,
                },
              ],
              fields: [
                {
                  key: "version",
                  label: "目标版本",
                  bindings: [
                    {
                      system: "CI-CD",
                      objectId: "pipeline-01",
                      path: "targetVersion",
                    },
                  ],
                },
              ],
            },
            {
              id: "release",
              name: "发布",
              type: "task",
              executor: "role:role-owner",
              stageCode: "RELEASE",
              sequence: 2,
              summaryMetric: "release-status",
              externalRefs: [],
              fields: [],
            },
          ],
          edges: [{ from: "design", to: "release" }],
        },
      }),
    );
    expect(source).toContain("- kind: business-chain");
    expect(source).toContain("- business-chain-template-id: chain-upload");
    expect(source).toContain(
      "- field: version|目标版本|CI-CD|pipeline-01|targetVersion",
    );
    expect(source).toContain("- design -> release");
    expect(source).toContain("### 方案设计");
  });

  it("keeps the bundled business-chain test configurations importable", () => {
    const { exports: client } = loadClientExports();
    const configs = [
      "supply-chain-ai-server-demo.json",
      "software-delivery-standard.json",
      "software-hotfix.json",
      "software-delivery-bugfix-loop.json",
    ];
    for (const fileName of configs) {
      const content = readFileSync(
        resolve(BUSINESS_CHAIN_CONFIG_ROOT, fileName),
        "utf8",
      );
      const sourceMd = fileName.endsWith(".json")
        ? client.__test?.businessChainConfigToMarkdown(content)
        : content;
      expect(sourceMd, fileName).toBeTypeOf("string");
      const parsed = parseWorkflowMarkdown(sourceMd!);
      expect(parsed.errors, fileName).toEqual([]);
      expect(parsed.warnings, fileName).toEqual([]);
    }

    const supplyDemo = readFileSync(
      resolve(BUSINESS_CHAIN_CONFIG_ROOT, "supply-chain-ai-server-demo.json"),
      "utf8",
    );
    const supplyMd =
      client.__test?.businessChainConfigToMarkdown(supplyDemo) ?? "";
    const supplyParsed = parseWorkflowMarkdown(supplyMd);
    expect(supplyMd).toContain("- owner-role-code: GSC_ORDER_FULFILLMENT");
    expect(supplyParsed.businessChain).toMatchObject({
      templateId: "chain-ai-server",
      chainKey: "ai-server-delivery",
      displayName: "AI Server 履约交付链路",
    });
    expect(supplyParsed.graph?.nodes.map((node) => node.id)).toEqual([
      "order-intake",
      "fulfillment-commitment",
      "supply-prep",
      "assembly",
      "finished-goods-shipment",
    ]);
    expect(supplyParsed.graph?.nodes.map((node) => node.name)).toEqual([
      "确认订单",
      "履约复期",
      "原材料采购",
      "生产制造",
      "成品发货",
    ]);
    expect(
      supplyParsed.graph?.nodes.map((node) => node.executor.roleCode),
    ).toEqual([
      "GSC_ORDER_FULFILLMENT",
      "GSC_PLANNING",
      "GSC_PROCUREMENT",
      "GSC_MANUFACTURING",
      "GSC_LOGISTICS",
    ]);
    expect(
      supplyParsed.graph?.nodes.find((node) => node.id === "order-intake")
        ?.businessChain?.fields,
    ).toEqual([
      expect.objectContaining({ key: "orderDate", label: "下单日期" }),
      expect.objectContaining({ key: "ordered", label: "订单数量" }),
      expect.objectContaining({ key: "planned", label: "交期要求" }),
    ]);
    expect(
      supplyParsed.graph?.nodes.find((node) => node.id === "assembly")
        ?.businessChain?.fields,
    ).toEqual([
      expect.objectContaining({ key: "kitProduction", label: "投产" }),
      expect.objectContaining({ key: "workInProgress", label: "在制品" }),
      expect.objectContaining({ key: "actualOutput", label: "产出" }),
    ]);
    expect(
      supplyParsed.graph?.nodes.find(
        (node) => node.id === "finished-goods-shipment",
      )?.businessChain?.fields,
    ).toEqual([
      expect.objectContaining({ key: "batch1Planned", label: "批次1 计划" }),
      expect.objectContaining({ key: "batch1Actual", label: "批次1 实际" }),
      expect.objectContaining({ key: "batch2Planned", label: "批次2 计划" }),
      expect.objectContaining({ key: "batch2Actual", label: "批次2 实际" }),
    ]);
    expect(
      supplyParsed.graph?.edges.map(({ from, to }) => ({ from, to })),
    ).toEqual([
      { from: "order-intake", to: "fulfillment-commitment" },
      { from: "fulfillment-commitment", to: "supply-prep" },
      { from: "supply-prep", to: "assembly" },
      { from: "assembly", to: "finished-goods-shipment" },
    ]);

    const bugfixDemo = readFileSync(
      resolve(BUSINESS_CHAIN_CONFIG_ROOT, "software-delivery-bugfix-loop.json"),
      "utf8",
    );
    expect(client.__test?.businessChainConfigToMarkdown(bugfixDemo)).toContain(
      "break: attempts >= 2",
    );
  });

  it("does not embed the wireframe demo facts in the production component", () => {
    const source = readFileSync(CLIENT_PATH, "utf8");
    for (const demoFact of [
      "GPU 供应量减少 20 个",
      "客户临时取消 14 台 AI Server",
      "供应商备货计划由 200 台调整为 180 台",
      "A-214",
      "TSK-1042",
    ]) {
      expect(source).not.toContain(demoFact);
    }
  });

  it("filters and groups project outputs by search, type and date", () => {
    const { exports: client } = loadClientExports();
    const helpers = client.__test;
    const item = {
      name: "设计评审报告.md",
      documentType: "markdown",
      updatedAt: "2026-10-17T12:00:00.000Z",
      workflowNodeName: "设计评审",
      workflowInstanceTitle: "发布流程",
      sourceName: "完善发布方案",
      authorName: "Research Avatar",
    };
    expect(helpers?.outputMatches(item, "设计评审", "all", "", "")).toBe(true);
    expect(helpers?.outputMatches(item, "发布流程", "all", "", "")).toBe(true);
    expect(helpers?.outputMatches(item, "完善发布方案", "all", "", "")).toBe(
      true,
    );
    expect(helpers?.outputMatches(item, "Research Avatar", "all", "", "")).toBe(
      true,
    );
    expect(
      helpers?.outputMatches(item, "", "markdown", "2026-10-17", "2026-10-17"),
    ).toBe(true);
    expect(
      helpers?.outputMatches(item, "", "pdf", "2026-10-17", "2026-10-17"),
    ).toBe(false);

    const groups = helpers?.groupOutputsByDay([
      { ...item, id: "a", updatedAt: "2026-10-17T08:00:00.000Z" },
      { ...item, id: "b", updatedAt: "2026-10-17T12:00:00.000Z" },
      { ...item, id: "c", updatedAt: "2026-10-16T12:00:00.000Z" },
    ]);
    expect(groups?.map((group) => group.date)).toEqual([
      "2026-10-17",
      "2026-10-16",
    ]);
    expect(groups?.[0]?.items.map((output) => output.id)).toEqual(["b", "a"]);
    expect(helpers?.formatFileSize(900)).toBe("900 B");
    expect(helpers?.formatFileSize(1_536)).toBe("1.5 KB");
    expect(
      helpers?.outputLoadErrorMessage(
        Object.assign(new Error("HTTP 404"), { status: 404 }),
      ),
    ).toBe("产出物服务未加载，请重启当前服务后重试。");
    expect(helpers?.outputLoadErrorMessage(new Error("网络异常"))).toBe(
      "网络异常",
    );
  });

  it("links every aggregated output source back to its origin", () => {
    const source = readFileSync(CLIENT_PATH, "utf8");
    expect(source).toContain("function openMeeting(");
    expect(source).toContain("function openDataAgent(");
    expect(source).toContain('"data-agent": "Data Agent"');
    expect(source).toContain("outputSourceLabel(item.sourceKind)");
    expect(source).toContain("item.dataAgentConversationId");
    expect(source).toContain("item.meetingId");
    expect(source).toContain('item.contentRole === "input"');
    expect(source).toContain('"输入"');
    expect(source).toContain('"产出"');
  });

  it("parses report markdown into headings, lists and paragraphs", () => {
    const { exports: client } = loadClientExports();
    const blocks = client.__test?.parseReportBlocks(
      "## 今日结论\n\n项目进度 72%。\n\n- 第一条\n- 第二条\n",
    );
    expect(blocks).toEqual([
      { type: "heading", text: "今日结论" },
      { type: "paragraph", text: "项目进度 72%。" },
      { type: "list", items: ["第一条", "第二条"] },
    ]);
  });

  it("replaces the legacy technical report heading without rewriting snapshots", () => {
    const { exports: client } = loadClientExports();
    expect(
      client.__test?.normalizeReportMarkdown(
        "## RAG 结论\n\n项目健康度判定为「关注」。",
      ),
    ).toBe("## 一句话结论\n\n项目健康度判定为「关注」。");
    expect(
      client.__test?.normalizeReportMarkdown(
        "## 指标快照\n\n- 当前未完成 3 项。",
      ),
    ).toBe("## 指标快照\n\n- 当前未完成 3 项。");
  });

  it("exposes daily, weekly and progress report generation", () => {
    const source = readFileSync(CLIENT_PATH, "utf8");
    expect(source).toContain("项目日报");
    expect(source).toContain("项目周报");
    expect(source).toContain("进度汇报");
    expect(source).toContain("reportType");
    expect(source).toContain('triggerSource: "button"');
    expect(source).toContain("PM Agent · Skill v");
    expect(source).toContain("模板回退");
    expect(source).toContain('latest.generationMode === "agent"');
  });

  it("lands on project overview and keeps report controls in task order", () => {
    const source = readFileSync(CLIENT_PATH, "utf8");
    const initialTab = source.indexOf('react.useState("progress")');
    const progressTab = source.indexOf('label: "项目概览"');
    const reportsTab = source.indexOf('{ key: "reports", label: "项目日报"');
    const membersTab = source.indexOf('label: "成员·角色"');
    const title = source.indexOf('h("h3", null, "项目日报")');
    const typeSelect = source.indexOf('"aria-label": "项目汇报类型"');
    const searchButton = source.indexOf('"搜索",');
    const updateButton = source.indexOf('"更新日报",');
    const setupButton = source.indexOf('"项目日报生成设置"');
    expect(initialTab).toBeGreaterThan(-1);
    expect(progressTab).toBeGreaterThan(-1);
    expect(reportsTab).toBeGreaterThan(progressTab);
    expect(reportsTab).toBeGreaterThan(-1);
    expect(reportsTab).toBeLessThan(membersTab);
    expect(title).toBeGreaterThan(-1);
    expect(typeSelect).toBeGreaterThan(title);
    expect(searchButton).toBeGreaterThan(typeSelect);
    expect(updateButton).toBeGreaterThan(searchButton);
    expect(setupButton).toBeGreaterThan(updateButton);
    expect(source).toContain("pmproj-report-setup");
    expect(source).toContain("margin-left:auto");
  });

  it("shows anomaly node count on overview without progress summary copy", () => {
    const source = readFileSync(CLIENT_PATH, "utf8");
    const progressTab = source.indexOf('label: "项目概览"');
    const reportsTab = source.indexOf('{ key: "reports", label: "项目日报"');
    const progressTabBlock = source.slice(progressTab, reportsTab);
    expect(progressTabBlock).toContain("count: progressAnomalyCount");
    expect(source).toContain("const progressAnomalyCount = (");
    expect(source).toContain("progressNodeIsAnomaly,");
    expect(source).toContain(").length;");
    expect(source).not.toContain(
      "`${progressFacts.progress.length} 项进展 · ${progressFacts.attention.length} 项关注`",
    );
    expect(source).not.toContain("进展刷新时间");
  });

  it("derives anomaly counts from the same visible node state", () => {
    const { exports: client } = loadClientExports();
    const isAnomaly = client.__test?.progressNodeIsAnomaly;
    expect(isAnomaly?.({ status: "blocked", exceptionText: "无" })).toBe(true);
    expect(
      isAnomaly?.({
        status: "running",
        exceptionText: "GPU 到货延迟，预计影响 6 台",
      }),
      "普通说明文案本身不能被当作异常",
    ).toBe(false);
    expect(
      isAnomaly?.({
        status: "running",
        exceptionText: "GPU 到货延迟，预计影响 6 台",
        alertCount: 1,
      }),
    ).toBe(true);
    expect(
      isAnomaly?.({
        status: "running",
        exceptionText: "无",
        isAnomaly: true,
        alertCount: 0,
      }),
      "已清除异常文案的节点不能被旧的 isAnomaly 标记继续计数",
    ).toBe(false);
  });

  it("clears a stale anomaly flag when demo data presents a normal node", () => {
    const { exports: client } = loadClientExports();
    const overview = client.__test?.applyProgressDemoData(
      {
        nodes: [
          {
            id: "supply",
            status: "blocked",
            tone: "warn",
            exceptionText: "GPU 到货延迟，预计影响 6 台",
            isAnomaly: true,
            fields: [],
          },
          {
            id: "assembly",
            status: "running",
            tone: "progress",
            exceptionText: "GPU 到货延迟，预计影响 6 台",
            isAnomaly: true,
            fields: [],
          },
        ],
        changeEvents: [],
      },
      {
        data: {
          nodes: {
            assembly: {
              status: "running",
              exception: "无",
            },
          },
        },
      },
    );
    const anomalous = (overview?.nodes ?? []).filter(
      (node) => client.__test?.progressNodeIsAnomaly(node) === true,
    );
    expect(anomalous.map((node) => node.id)).toEqual(["supply"]);
  });

  it("exposes project detail text to task capture and Data Agent selection", () => {
    const source = readFileSync(CLIENT_PATH, "utf8");
    expect(source).toContain('"data-data-agent-text-surface": "project"');
    expect(source).toContain(
      '"data-workspace-id": selectedProject?.workspaceId',
    );
    expect(source).toContain(
      "const anomalousNodes = overview.nodes.filter(progressNodeIsAnomaly);",
    );
    expect(source).toContain("progressNodeIsAnomaly,");
    expect(source).toContain(").length;");
  });

  it("keeps report settings discoverable for members as read-only", () => {
    const source = readFileSync(CLIENT_PATH, "utf8");
    const updateStart = source.indexOf("title: canManage");
    const setupStart = source.indexOf('"aria-label": "项目日报生成设置"');
    const modalStart = source.indexOf("const renderReportScheduleModal");
    const createModalStart = source.indexOf(
      "const renderCreateModal",
      modalStart,
    );
    expect(updateStart).toBeGreaterThan(-1);
    expect(setupStart).toBeGreaterThan(updateStart);
    expect(source.slice(updateStart, setupStart)).not.toContain(
      "canManage\n                ? h(",
    );
    const modal = source.slice(modalStart, createModalStart);
    expect(modal).toContain("disabled: !canManage");
    expect(modal).toContain("仅项目负责人或平台管理员可以修改生成设置");
    expect(modal).toContain('canManage ? "取消" : "关闭"');
  });

  it("normalizes the default report schedule and describes each frequency", () => {
    const { exports: client } = loadClientExports();
    const helpers = client.__test;
    expect(helpers?.normalizeReportSchedule()).toMatchObject({
      enabled: true,
      frequency: "daily",
      time: "08:00",
      timezone: "Asia/Shanghai",
    });
    expect(
      helpers?.reportScheduleSummary({
        enabled: true,
        frequency: "daily",
        time: "08:00",
      }),
    ).toBe("每天 08:00");
    expect(
      helpers?.reportScheduleSummary({
        enabled: true,
        frequency: "weekdays",
        time: "09:30",
      }),
    ).toBe("每个工作日 09:30");
    expect(
      helpers?.reportScheduleSummary({
        enabled: true,
        frequency: "weekly",
        weekday: 3,
        time: "10:15",
      }),
    ).toBe("每周三 10:15");
    expect(
      helpers?.reportScheduleSummary({
        enabled: false,
        frequency: "monthly",
        dayOfMonth: 8,
        time: "08:00",
      }),
    ).toBe("自动生成已停用");
  });

  it("computes project role draft diffs by code", () => {
    const { exports: client } = loadClientExports();
    const helpers = client.__test;
    const effective: RoleLike[] = [
      {
        id: "role-owner",
        name: "项目负责人",
        code: "PROJECT_OWNER",
        category: "管理",
        description: "",
        permissions: ["read", "write"],
      },
      {
        id: "role-dev",
        name: "开发实施",
        code: "IMPLEMENTER",
        category: "执行",
        description: "",
        permissions: ["read", "write"],
      },
    ];
    const draft = [
      {
        ...effective[0]!,
        name: "项目总负责人",
      },
      {
        id: "role-new",
        name: "现场协调",
        code: "SITE_COORDINATOR",
        category: "执行",
        description: "",
        permissions: ["read"],
      },
    ];
    const diff = helpers?.computeRoleDiff(effective, draft);
    expect(diff?.added.map((role) => role.code)).toEqual(["SITE_COORDINATOR"]);
    expect(diff?.updated.map((role) => role.code)).toEqual(["PROJECT_OWNER"]);
    expect(diff?.removed.map((role) => role.code)).toEqual(["IMPLEMENTER"]);
    expect(helpers?.roleCodeKey({ code: " implementer " })).toBe("IMPLEMENTER");
  });

  it("ignores name and permission ordering when nothing changed", () => {
    const { exports: client } = loadClientExports();
    const helpers = client.__test;
    const base = {
      id: "role-owner",
      name: "项目负责人",
      code: "PROJECT_OWNER",
      category: "管理",
      description: "",
      permissions: ["read", "write"],
    };
    const diff = helpers?.computeRoleDiff(
      [base],
      [{ ...base, permissions: ["write", "read"] }],
    );
    expect(diff?.added).toEqual([]);
    expect(diff?.updated).toEqual([]);
    expect(diff?.removed).toEqual([]);
    expect(
      helpers?.roleFieldsDiffer(base, { ...base, description: "变更说明" }),
    ).toBe(true);
  });

  it("generates a fresh code when copying a project role", () => {
    const { exports: client } = loadClientExports();
    const helpers = client.__test;
    expect(helpers?.nextRoleCopyCode("REQUIREMENT_OWNER", [])).toBe(
      "REQUIREMENT_OWNER_COPY",
    );
    expect(
      helpers?.nextRoleCopyCode("REQUIREMENT_OWNER", [
        { code: "REQUIREMENT_OWNER" },
        { code: "REQUIREMENT_OWNER_COPY" },
      ]),
    ).toBe("REQUIREMENT_OWNER_COPY_2");
  });

  it("keeps role definitions in project settings and member management inline", () => {
    const source = readFileSync(CLIENT_PATH, "utf8");
    const membersTabStart = source.indexOf("const renderMembersTab");
    const roleEditorStart = source.indexOf("const renderProjectRoleEditor");
    const tasksStart = source.indexOf("const renderTasksTab");
    const editModalStart = source.indexOf("const renderEditModal");
    const memberModalStart = source.indexOf("const renderMemberModal");

    expect(membersTabStart).toBeGreaterThan(-1);
    expect(roleEditorStart).toBeGreaterThan(-1);
    expect(roleEditorStart).toBeGreaterThan(membersTabStart);
    expect(tasksStart).toBeGreaterThan(roleEditorStart);
    expect(editModalStart).toBeGreaterThan(tasksStart);
    expect(memberModalStart).toBeGreaterThan(editModalStart);

    const membersTab = source.slice(membersTabStart, roleEditorStart);
    const roleEditor = source.slice(roleEditorStart, tasksStart);
    const editModal = source.slice(editModalStart, memberModalStart);

    expect(membersTab).toContain("memberManageMode");
    expect(membersTab).toContain('openMemberModal("add"');
    expect(membersTab).toContain("添加成员");
    expect(roleEditor).toContain("从模版加载");
    expect(roleEditor).toContain("复用其他项目");
    expect(roleEditor).toContain("添加角色");
    expect(editModal).toContain("renderProjectRoleEditor()");
    expect(editModal).toContain("项目设置");
    expect(editModal).toContain("基础信息");
    expect(editModal).toContain("项目角色");
    expect(editModal).not.toContain("编辑项目信息");
    expect(membersTab).not.toContain("openTemplateLoad");
    expect(membersTab).not.toContain("openRoleSources");
    expect(membersTab).not.toContain('openRoleModal("add"');
    expect(membersTab).not.toContain("confirmRoleDraft");
    expect(source).not.toContain("const renderMemberManagement");
  });

  it("searches addable humans and AI partners while adding a member", () => {
    const source = readFileSync(CLIENT_PATH, "utf8");
    expect(source).toContain("/api/collab/projects/members/search");
    expect(source).toContain("memberSearchQuery");
    expect(source).toContain("memberSearchOptions");
    expect(source).toContain('"aria-autocomplete": "list"');
    expect(source).toContain('event.key === "ArrowDown"');
    expect(source).toContain('event.key === "Enter"');
    expect(source).toContain("人类用户");
    expect(source).toContain("AI 伙伴");
    expect(source).toContain("AI 伙伴需要选择项目角色后才能加入项目");
  });

  it("clears project data and member edit state when the login token changes", () => {
    const source = readFileSync(CLIENT_PATH, "utf8");
    const listenerStart = source.indexOf(
      'window.addEventListener("pluginmax:collab-token", synchronize)',
    );
    const synchronizeStart = source.lastIndexOf(
      "const synchronize =",
      listenerStart,
    );
    const synchronizeEnd = source.indexOf(
      "}, [loadProjects, loadFollows]);",
      listenerStart,
    );
    expect(synchronizeStart).toBeGreaterThan(-1);
    expect(synchronizeEnd).toBeGreaterThan(synchronizeStart);
    const synchronize = source.slice(synchronizeStart, synchronizeEnd);
    expect(synchronize).toContain("setProjects([])");
    expect(synchronize).toContain("setDetail(null)");
    expect(synchronize).toContain("setMemberManageMode(false)");
    expect(synchronize).toContain("setMemberModal(null)");
  });

  it("deep-links tasks and workflows through the shell conventions", () => {
    const { exports: client, window: windowStub } = loadClientExports();
    client.__test?.openTask("TSK-1", "ws-1");
    expect(windowStub.__pluginmaxPendingTask).toEqual({
      taskId: "TSK-1",
      workspaceId: "ws-1",
    });
    expect(windowStub.__events).toEqual([
      {
        type: "pluginmax:navigate",
        detail: { route: "task" },
      },
    ]);
    windowStub.__events.length = 0;
    client.__test?.openWorkflow("wf-1", "ws-1");
    expect(windowStub.__route).toBe("workflow");
    expect(windowStub.__events).toEqual([
      {
        type: "pluginmax:collab-navigate",
        detail: {
          plugin: "workflow",
          instanceId: "wf-1",
          workspaceId: "ws-1",
          nodeId: undefined,
        },
      },
    ]);
  });

  it("collapses empty change events and hides a zero anomaly count", () => {
    const source = readFileSync(CLIENT_PATH, "utf8");
    const progressStart = source.indexOf("const renderProgressTab");
    const progressEnd = source.indexOf("const renderDetail", progressStart);
    const progressSource = source.slice(progressStart, progressEnd);
    expect(progressStart).toBeGreaterThan(-1);
    expect(progressEnd).toBeGreaterThan(progressStart);
    expect(progressSource).toContain("progressChangeEventsExpanded");
    expect(progressSource).toContain('"aria-expanded": changeEventsExpanded');
    expect(progressSource).toContain("anomalousNodes.length === 0");
    expect(progressSource).toContain('"关键变更与外部影响"');
    expect(progressSource).toContain('"上传演示数据配置"');
    expect(progressSource).not.toContain("业务链路已加载");
    expect(progressSource).not.toContain("部分来源暂不可用");
    expect(progressSource).not.toContain("进展刷新时间");
    expect(progressSource).toContain('generateReport("progress")');
    expect(progressSource).not.toContain('"刷新"');
    expect(progressSource).not.toContain(
      'h(Pill, { tone: "notice" }, "演示数据")',
    );
  });

  it("does not let derived-data refresh block report generation", () => {
    const source = readFileSync(CLIENT_PATH, "utf8");
    const start = source.indexOf("const generateReport = async");
    const end = source.indexOf("const openReportSchedule", start);
    const reportSource = source.slice(start, end);
    expect(start).toBeGreaterThan(-1);
    expect(end).toBeGreaterThan(start);
    expect(reportSource).toContain("timeoutMs: 120_000");
    expect(reportSource).not.toContain("await refreshProgressData();");
    expect(
      reportSource.indexOf('"/api/collab/projects/reports/generate"'),
    ).toBeLessThan(reportSource.indexOf("void refreshProgressData();"));
  });

  it("registers the projects page on the pluginmax.global slot", () => {
    const { exports: client } = loadClientExports();
    const specs: SlotSpec[] = [];
    expect(client.inject).toEqual(["slots"]);
    client.apply?.({
      slots: {
        inject: (_name, run) => run(),
        register: (spec, component) => {
          specs.push(spec);
          expect(typeof component).toBe("function");
          return () => undefined;
        },
      },
      get: () => undefined,
    });
    expect(specs).toEqual([
      {
        name: "pluginmax.global",
        id: "pluginmax-project",
        order: 32,
        children: {
          "pluginmax.project.settings.other": {
            kind: "single",
            scope: "root",
          },
        },
      },
    ]);
  });
});

it("allows business-chain roles without assigned project members", () => {
  const { exports: client } = loadClientExports();
  expect(
    client.__test?.missingBusinessChainRoleMembers(
      [
        {
          nodeId: "quality",
          name: "成品检验",
          executor: {
            label: "Quality",
            roleCode: "GSC_QUALITY",
          },
        },
        {
          nodeId: "planning",
          name: "履约复期",
          executor: {
            label: "Planning",
            roleCode: "GSC_PLANNING",
          },
        },
      ],
      [
        { code: "GSC_QUALITY", memberCount: 0 },
        { code: "GSC_PLANNING", memberCount: 2 },
      ],
    ),
  ).toEqual([
    {
      nodeName: "成品检验",
      roleName: "Quality",
      roleCode: "GSC_QUALITY",
    },
  ]);
});
