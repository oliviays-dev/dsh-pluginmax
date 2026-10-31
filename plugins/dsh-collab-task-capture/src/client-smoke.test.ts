import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

interface SlotSpec {
  readonly name: string;
  readonly id: string;
  readonly order?: number;
}

interface ClientExports {
  inject?: readonly string[];
  apply?: (ctx: {
    slots: {
      inject: (name: string, run: () => void) => void;
      register: (spec: SlotSpec, component: unknown) => () => void;
    };
  }) => void;
}

function loadClientExports(): ClientExports {
  let exports: ClientExports = {};
  const react = {
    createElement: () => null,
    Fragment: "fragment",
    useState: (value: unknown) => [value, () => undefined],
    useEffect: () => undefined,
    useRef: (value: unknown) => ({ current: value }),
    useCallback: (value: unknown) => value,
  };
  const windowStub = {
    __ModuleLoader__: {
      load(definition: {
        factory: (require: (id: string) => unknown) => unknown;
      }) {
        exports = definition.factory((id) => {
          if (id === "react") return react;
          throw new Error(`unexpected module: ${id}`);
        }) as ClientExports;
      },
    },
  };
  const previousWindow = globalThis.window;
  globalThis.window = windowStub as never;
  try {
    const source = readFileSync(
      resolve(import.meta.dirname, "../client/index.js"),
      "utf8",
    );
    new Function("window", source)(windowStub);
  } finally {
    globalThis.window = previousWindow;
  }
  return exports;
}

describe("task capture client", () => {
  it("registers the capture, inbox, and origin slots", () => {
    const exported = loadClientExports();
    expect(exported.inject).toEqual(["slots"]);
    const specs: SlotSpec[] = [];
    exported.apply?.({
      slots: {
        inject: (_name, run) => run(),
        register: (spec) => {
          specs.push(spec);
          return () => undefined;
        },
      },
    });
    expect(specs.map((spec) => spec.name)).toEqual([
      "pluginmax.communication.rail.task-capture",
      "pluginmax.communication.context.task-capture",
      "pluginmax.data-agent.task-capture",
      "shell.overlay",
      "pluginmax.task.capture-launcher",
      "pluginmax.task.draft-inbox",
      "pluginmax.task.detail.capture-origin",
    ]);
    const source = readFileSync(
      resolve(import.meta.dirname, "../client/index.js"),
      "utf8",
    );
    expect(source).toContain("window.__pluginmaxSidePanel?.registerType?.({");
    expect(source).toContain('type: "task-drafts"');
  });

  it("states that saving drafts never creates or dispatches tasks", () => {
    const source = readFileSync(
      resolve(import.meta.dirname, "../client/index.js"),
      "utf8",
    );
    expect(source).toContain("草稿没有创建正式任务，也不会派发 Agent。");
    expect(source).toContain('createMode: "create-only"');
    expect(source).toContain("/api/collab/task-capture/batch/undo");
    expect(source).toContain("/api/collab/task-capture/commit/confirmation");
    expect(source).toContain('createMode: "create-and-dispatch"');
    expect(source).toContain("忽略草稿");
    expect(source).toContain("协作方");
  });

  it("renders one compact todo row per candidate with only light edits", () => {
    const source = readFileSync(
      resolve(import.meta.dirname, "../client/index.js"),
      "utf8",
    );
    expect(source).toContain("className: `pmtc-cap-row");
    expect(source).toContain("pmtc-cap-title");
    expect(source).toContain("pmtc-cap-source-detail");
    expect(source).toContain("手动添加一条待办");
    expect(source).toContain("保存到草稿箱");
    expect(source).toContain("批量创建任务");
    expect(source).toContain("完善任务草稿");
    expect(source).toContain("saveSideSelection(false)");
    expect(source).toContain("saveSideSelection(true)");
    expect(source).toContain("updatedResponse?.draft ?? updatedResponse");
    expect(source).not.toContain("meetingCaptureTitle");
    expect(source).not.toContain("更多设置");
    expect(source).toContain('props.mode !== "side"');
    expect(source).toContain('selectionReady && props.mode !== "side"');
    expect(source).toContain(" pmtc-foot-actions");
  });

  it("requires explicit message selection before preparing task drafts", () => {
    const source = readFileSync(
      resolve(import.meta.dirname, "../client/index.js"),
      "utf8",
    );
    expect(source).toContain("选择用于生成任务的对话");
    expect(source).toContain("pickedMessageIds");
    expect(source).toContain("toggleAllMessages");
    expect(source).toContain('"生成任务"');
    expect(source).toContain("text: incomingSelectionText");
  });

  it("renders task drafts as a sibling side-panel tab", () => {
    const source = readFileSync(
      resolve(import.meta.dirname, "../client/index.js"),
      "utf8",
    );
    expect(source).toContain('"task-drafts": "task"');
    expect(source).toContain("TaskDraftSidePanel");
    expect(source).toContain('id: "pluginmax-task-draft-side-panel"');
    expect(source).toContain("pluginmax:task-draft-open");
    expect(source).toContain("openNewTab(type)");
    expect(source).toContain("新建侧栏标签");
    expect(source).toContain("reorderTab?.(source, tab)");
    expect(source).toContain("draggable: true");
    expect(source).toContain('className: "pmtc-side-tab-actions"');
    expect(source).toContain(
      "height:49px;min-height:49px;padding:6px 8px 0 6px",
    );
    expect(source).toContain(
      ".pmtc-side-tab-panel{width:32px;height:32px;transform:translateY(.5px);}",
    );
    expect(source).toContain('"aria-label": "关闭侧边栏"');
    expect(source).toContain('"还原侧边栏" : "展开侧边栏"');
    expect(source).toContain("activeTabRef.current?.scrollIntoView?.(");
    expect(source).toContain('"ArrowLeft", "ArrowRight", "Home", "End"');
    expect(source).toContain("closeOnOutsidePointer");
    expect(source).toContain('sidePanelIcon("panel")');
    expect(source).toContain("flex:0 0 100px");
    expect(source).toContain("width:100%;height:100%");
    expect(source).toContain('["data-agent", "数据洞察"]');
    expect(source).not.toContain("--pmtc-tab-accent");
    expect(source).toContain("sidePanelIcon(labels[type])");
    expect(source).toContain("font-size:11px;line-height:1.4;cursor:pointer");
    expect(source).toContain(
      ".pmtc-side-tab.is-active .pmtc-side-tab-indicator",
    );
    expect(source).toContain('"data-tab-indicator": "true"');
  });

  it("offers manual draft creation from the empty task-drafts panel", () => {
    const source = readFileSync(
      resolve(import.meta.dirname, "../client/index.js"),
      "utf8",
    );
    expect(source).toContain("manualOnly: source === null");
    expect(source).toContain("手动添加一条待办");
    expect(source).toContain("保存到草稿箱");
    expect(source).toContain("批量创建任务");
    expect(source).toContain("/api/collab/task-capture/manual");
    expect(source).toContain("saveManualDraft");
  });

  it("renders the task draft inbox as a task-page child slot", () => {
    const source = readFileSync(
      resolve(import.meta.dirname, "../client/index.js"),
      "utf8",
    );
    expect(source).toContain('"pluginmax.task.draft-inbox"');
    expect(source).toContain("TaskDraftInboxPage");
    expect(source).toContain("返回任务管理");
    expect(source).toContain("任务草稿箱");
    expect(source).toContain("未归属项目");
    expect(source).toContain("关联已有任务");
    expect(source).toContain("仍然创建");
    expect(source).toContain("高级执行设置");
    expect(source).toContain("DraftEditorDrawer");
    expect(source).toContain("CreateTasksDrawer");
    expect(source).toContain('captureIcon("refresh", 14)');
    expect(source).toContain("执行策略");
    expect(source).toContain("只创建，不派发");
    expect(source).toContain("负责人不可用");
    expect(source).toContain("项目无权限");
  });

  it("uses the task header's shared button sizing for the draft inbox", () => {
    const source = readFileSync(
      resolve(import.meta.dirname, "../client/index.js"),
      "utf8",
    );
    expect(source).toContain(
      'className: "pmtask-btn secondary pmtc-launcher"',
    );
    expect(source).toContain('className: "pmtask-btn-count"');
    expect(source).toContain("查看任务草稿箱");
    expect(source).toContain("height:34px;padding:0 12px");
    expect(source).toContain("border-radius:6px");
    expect(source).toContain("font-size:12.5px;font-weight:400");
  });
});
