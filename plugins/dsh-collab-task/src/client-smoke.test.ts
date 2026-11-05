import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const CLIENT_PATH = resolve(import.meta.dirname, "../client/index.js");

interface SlotSpec {
  readonly id: string;
  readonly name: string;
  readonly order?: number;
}

interface ClientExports {
  inject?: readonly string[];
  apply?: (ctx: {
    slots: {
      inject: (name: string, run: () => void) => void;
      register: (spec: SlotSpec, component?: unknown) => () => void;
    };
  }) => void;
}

interface ScopeStore {
  getSnapshot: () => boolean;
  setAll: (next: boolean) => void;
  subscribe: (listener: () => void) => () => void;
}

interface ClientHarnessOptions {
  /** 模拟其他模块已经把范围切成「平台全量」，验证共享 store 会被沿用。 */
  readonly scopeAll?: boolean;
  /** DSH 会话控制器替身：验证「打开会话」入口真的切到了那条会话。 */
  readonly sessions?: { open: (sessionId: string) => void };
  readonly fetchImpl?: (
    input: string,
    init?: unknown,
  ) => Promise<{ ok: boolean; status?: number; json: () => Promise<unknown> }>;
  readonly renderSlot?: (name: string, props: Record<string, unknown>) => unknown;
}

function createScopeStore(initial = false): ScopeStore {
  let all = initial;
  const listeners = new Set<() => void>();
  return {
    getSnapshot: () => all,
    setAll: (next: boolean) => {
      const value = next === true;
      if (value === all) return;
      all = value;
      for (const listener of listeners) listener();
    },
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

/**
 * Minimal hook runtime: enough to run the task page's useState/useRef/
 * useEffect/useCallback/useSyncExternalStore graph, flush its async data
 * loaders, and inspect the rendered element tree without React itself.
 *
 * Hook slots are keyed by component identity *and* render occurrence, so a
 * component rendered several times (e.g. the filter drop-downs or task cards)
 * keeps independent state per instance.
 */
interface HookSlots {
  states: unknown[];
  depList: Array<readonly unknown[] | undefined>;
  cleanups: Array<(() => void) | undefined>;
  refs: Array<{ current: unknown }>;
  callbacks: Array<unknown>;
  callbackDeps: Array<readonly unknown[] | undefined>;
  cursor: number;
}

function createReactRuntime() {
  const stores = new Map<string, HookSlots>();
  const componentIds = new WeakMap<object, number>();
  let nextComponentId = 0;
  let passCounters = new Map<string, number>();
  let current: HookSlots | undefined;
  let pending: Array<() => void> = [];

  const idFor = (component: object): string => {
    let id = componentIds.get(component);
    if (id === undefined) {
      nextComponentId += 1;
      id = nextComponentId;
      componentIds.set(component, id);
    }
    const occurrence = passCounters.get(String(id)) ?? 0;
    passCounters.set(String(id), occurrence + 1);
    return `${id}#${occurrence}`;
  };

  const slotsFor = (component: object): HookSlots => {
    const key = idFor(component);
    let slots = stores.get(key);
    if (slots === undefined) {
      slots = {
        states: [],
        depList: [],
        cleanups: [],
        refs: [],
        callbacks: [],
        callbackDeps: [],
        cursor: 0,
      };
      stores.set(key, slots);
    }
    return slots;
  };

  const sameDeps = (
    previous: readonly unknown[] | undefined,
    next: readonly unknown[] | undefined,
  ): boolean =>
    Array.isArray(previous) &&
    Array.isArray(next) &&
    previous.length === next.length &&
    previous.every((value, index) => Object.is(value, next[index]));

  const readState = (slots: HookSlots, index: number, initial: unknown) => {
    if (!(index in slots.states)) {
      slots.states[index] =
        typeof initial === "function" ? (initial as () => unknown)() : initial;
    }
    return slots.states[index];
  };

  const writeState = (
    slots: HookSlots,
    index: number,
    value: unknown,
  ): void => {
    slots.states[index] =
      typeof value === "function"
        ? (value as (previous: unknown) => unknown)(slots.states[index])
        : value;
  };

  const Fragment = "react.fragment";
  const react = {
    Fragment,
    createElement(
      type: unknown,
      props?: Record<string, unknown> | null,
      ...children: unknown[]
    ) {
      const nextProps: Record<string, unknown> = Object.assign({}, props);
      if (children.length === 1) nextProps.children = children[0];
      else if (children.length > 1) nextProps.children = children;
      return { type, props: nextProps };
    },
    useState(initial: unknown) {
      const slots = current as HookSlots;
      const index = slots.cursor;
      slots.cursor += 1;
      const value = readState(slots, index, initial);
      return [
        value,
        (next: unknown) => writeState(slots, index, next),
      ] as const;
    },
    useRef(initial: unknown) {
      const slots = current as HookSlots;
      const index = slots.cursor;
      slots.cursor += 1;
      if (!(index in slots.refs)) slots.refs[index] = { current: initial };
      return slots.refs[index];
    },
    useCallback(callback: unknown, next?: readonly unknown[]) {
      const slots = current as HookSlots;
      const index = slots.cursor;
      slots.cursor += 1;
      if (sameDeps(slots.callbackDeps[index], next)) {
        return slots.callbacks[index];
      }
      slots.callbacks[index] = callback;
      slots.callbackDeps[index] = next;
      return callback;
    },
    useEffect(effect: () => unknown, next?: readonly unknown[]) {
      const slots = current as HookSlots;
      const index = slots.cursor;
      slots.cursor += 1;
      if (sameDeps(slots.depList[index], next)) return;
      slots.depList[index] = next;
      pending.push(() => {
        slots.cleanups[index]?.();
        const result = effect();
        slots.cleanups[index] =
          typeof result === "function" ? (result as () => void) : undefined;
      });
    },
    useSyncExternalStore(
      subscribe: (listener: () => void) => () => void,
      getSnapshot: () => unknown,
    ) {
      const slots = current as HookSlots;
      const index = slots.cursor;
      slots.cursor += 1;
      if (!(index in slots.states)) {
        slots.states[index] = getSnapshot();
        slots.cleanups[index] = subscribe(() => {
          slots.states[index] = getSnapshot();
        });
      }
      return slots.states[index];
    },
  };

  return {
    react,
    beginPass(): void {
      passCounters = new Map();
    },
    beginRender(component: object): void {
      current = slotsFor(component);
      current.cursor = 0;
    },
    runEffects(): void {
      const queue = pending;
      pending = [];
      for (const run of queue) run();
    },
  };
}

type Runtime = ReturnType<typeof createReactRuntime>;

interface TreeNode {
  readonly type?: unknown;
  readonly props?: Record<string, unknown>;
}

function expand(node: unknown, runtime: Runtime): unknown {
  if (Array.isArray(node)) return node.map((child) => expand(child, runtime));
  if (node === null || typeof node !== "object") return node;
  const element = node as { type?: unknown; props?: Record<string, unknown> };
  if (typeof element.type === "function") {
    runtime.beginRender(element.type as object);
    return expand(
      (element.type as (props: unknown) => unknown)(element.props ?? {}),
      runtime,
    );
  }
  if (element.props && "children" in element.props) {
    return {
      ...element,
      props: {
        ...element.props,
        children: expand(element.props.children, runtime),
      },
    };
  }
  return node;
}

function renderTree(node: unknown, runtime: Runtime): unknown {
  runtime.beginPass();
  return expand(node, runtime);
}

function findNode(
  root: unknown,
  predicate: (node: TreeNode) => boolean,
): TreeNode | undefined {
  const stack: unknown[] = [root];
  while (stack.length > 0) {
    const node = stack.pop();
    if (Array.isArray(node)) {
      for (const child of node) stack.push(child);
      continue;
    }
    if (node === null || typeof node !== "object") continue;
    const candidate = node as TreeNode;
    if (predicate(candidate)) return candidate;
    const children = candidate.props?.children;
    if (children !== undefined) stack.push(children);
  }
  return undefined;
}

function findNodes(
  root: unknown,
  predicate: (node: TreeNode) => boolean,
): TreeNode[] {
  const matches: TreeNode[] = [];
  const visit = (value: unknown): void => {
    if (Array.isArray(value)) {
      for (const child of value) visit(child);
      return;
    }
    if (value === null || typeof value !== "object") return;
    const candidate = value as TreeNode;
    if (predicate(candidate)) matches.push(candidate);
    visit(candidate.props?.children);
  };
  visit(root);
  return matches;
}

function containsText(value: unknown, text: string): boolean {
  if (typeof value === "string") return value.includes(text);
  if (Array.isArray(value))
    return value.some((item) => containsText(item, text));
  if (value !== null && typeof value === "object") {
    return containsText((value as TreeNode).props?.children, text);
  }
  return false;
}

function loadClientExports(options: ClientHarnessOptions = {}) {
  let exports: ClientExports = {};
  const runtime = createReactRuntime();
  const scope = createScopeStore(options.scopeAll === true);
  const shellRoutes: string[] = [];
  const windowListeners = new Map<
    string,
    Set<(event: { type: string; detail?: unknown }) => void>
  >();
  const fakeFetch =
    options.fetchImpl ??
    (async () => ({ ok: true, status: 200, json: async () => ({}) }));
  const windowStub: Record<string, unknown> = {
    __pluginmaxScope: scope,
    __pluginmaxShell: {
      setRoute: (route: string) => {
        shellRoutes.push(route);
      },
    },
    __ModuleLoader__: {
      load: (definition: {
        id: string;
        factory: (require: (id: string) => unknown) => unknown;
      }) => {
        exports = definition.factory((id: string) => {
          if (id === "react") return runtime.react;
          throw new Error(`unexpected module: ${id}`);
        }) as ClientExports;
      },
    },
    localStorage: { getItem: () => "token", setItem: () => undefined },
    addEventListener: (
      name: string,
      listener: (event: { type: string; detail?: unknown }) => void,
    ) => {
      const listeners = windowListeners.get(name) ?? new Set();
      listeners.add(listener);
      windowListeners.set(name, listeners);
    },
    removeEventListener: (
      name: string,
      listener: (event: { type: string; detail?: unknown }) => void,
    ) => {
      windowListeners.get(name)?.delete(listener);
    },
    dispatchEvent: (event: { type: string; detail?: unknown }) => {
      for (const listener of windowListeners.get(event.type) ?? []) {
        listener(event);
      }
      return true;
    },
    // 详情页打开后会起轮询与滚动定位，这里给最朴素的替身。
    setInterval: () => 0,
    clearInterval: () => undefined,
    setTimeout: () => 0,
    clearTimeout: () => undefined,
    requestAnimationFrame: () => 0,
    cancelAnimationFrame: () => undefined,
    document: {
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      querySelector: () => null,
      createElement: () => ({ style: {}, click: () => undefined }),
      body: { appendChild: () => undefined, removeChild: () => undefined },
    },
    fetch: fakeFetch,
  };
  const source = readFileSync(CLIENT_PATH, "utf8");
  const factory = new Function(
    "window",
    "module",
    "exports",
    "fetch",
    source,
  ) as (
    window: unknown,
    module: { exports: unknown },
    exports: unknown,
    fetch: unknown,
  ) => void;
  const module = { exports: {} };
  factory(windowStub, module, module.exports, fakeFetch);
  return {
    exports,
    scope,
    runtime,
    shellRoutes,
    window: windowStub,
    sessions: options.sessions,
    ...(options.renderSlot === undefined
      ? {}
      : { renderSlot: options.renderSlot }),
  };
}

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

const payload = (body: unknown) => ({
  ok: true,
  status: 200,
  json: async () => body,
});

/** 任务记录的后端形状：详情页会读 agentRunIds / steps / messages 等字段。 */
function makeTask(overrides: Record<string, unknown>) {
  return {
    id: "TSK-1",
    title: "任务标题",
    type: "任务",
    description: "任务描述",
    acceptance: ["验收标准"],
    links: [],
    progress: 0,
    sessionEpoch: 0,
    autoSubmitReview: true,
    steps: [{ id: "s-1", label: "执行", done: false }],
    agentRunIds: [],
    messages: [],
    comments: [],
    events: [],
    dependsOn: [],
    queueState: "idle",
    autoRunEligible: true,
    needsInput: false,
    createdByName: "Admin",
    createdAt: "2026-03-01T00:00:00.000Z",
    ...overrides,
  };
}

async function settle(
  root: unknown,
  runtime: Runtime,
  passes = 5,
): Promise<unknown> {
  let tree: unknown;
  for (let pass = 0; pass < passes; pass += 1) {
    tree = renderTree(root, runtime);
    runtime.runEffects();
    await tick();
  }
  return tree;
}

/** 平台管理员不是任何项目的成员，但任务分布在未加入项目里。 */
function adminFetch(input: string) {
  if (input.startsWith("/api/collab/auth/me")) {
    return Promise.resolve(
      payload({ user: { id: "admin", name: "Admin", role: "admin" } }),
    );
  }
  if (input.startsWith("/api/collab/team/workspaces")) {
    return Promise.resolve(
      payload({
        workspaces: [
          { id: "ws-1", title: "项目一", path: "/p1", isMember: false },
          { id: "ws-2", title: "项目二", path: "/p2", isMember: true },
        ],
      }),
    );
  }
  if (input.startsWith("/api/collab/tasks/bootstrap")) {
    const workspaceId = new URL(`http://x${input}`).searchParams.get(
      "workspaceId",
    );
    // 目录里带上我自己的分身：既让「责任人=我」的口径可验证，
    // 也让“派我的分身执行”这类快捷动作有可渲染的前提。
    const directory = {
      humans: [],
      agents: [
        {
          id: "tm-admin",
          name: "小白 PD",
          kind: "agent",
          ownerName: "平台 Admin",
          ownerAuthUserId: "admin",
          source: "personal",
          avatar: "",
        },
      ],
      roles: [],
    };
    if (workspaceId === "ws-1") {
      return Promise.resolve(
        payload({
          tasks: [
            makeTask({
              id: "t-mine",
              workspaceId: "ws-1",
              title: "我的任务",
              status: "todo",
              priority: "P2",
              receiverType: "human",
              receiverId: "admin",
              receiverName: "Admin",
              createdBy: "someone",
              updatedAt: "2026-03-02T00:00:00.000Z",
            }),
            makeTask({
              id: "t-others",
              workspaceId: "ws-1",
              title: "别人的任务",
              status: "todo",
              priority: "P2",
              receiverType: "human",
              receiverId: "someone",
              receiverName: "Someone",
              createdBy: "someone",
              updatedAt: "2026-03-01T00:00:00.000Z",
            }),
          ],
          directory,
        }),
      );
    }
    if (workspaceId === "ws-2") {
      return Promise.resolve(
        payload({
          tasks: [
            makeTask({
              id: "t-joined",
              workspaceId: "ws-2",
              title: "同项目别人的任务",
              status: "todo",
              priority: "P2",
              receiverType: "human",
              receiverId: "someone",
              receiverName: "Someone",
              createdBy: "someone",
              updatedAt: "2026-02-01T00:00:00.000Z",
            }),
          ],
          directory,
        }),
      );
    }
    return Promise.resolve(payload({ tasks: [], directory }));
  }
  return Promise.resolve(payload({}));
}

function mountTaskPage(harness: {
  exports: ClientExports;
  runtime: Runtime;
  sessions?: { open: (sessionId: string) => void } | undefined;
  renderSlot?: (name: string, props: Record<string, unknown>) => unknown;
  renderActions?: () => unknown;
}): unknown {
  let Task: ((props: Record<string, unknown>) => unknown) | undefined;
  const ctx = {
    get: (key: string) => (key === "sessions" ? harness.sessions : undefined),
    slots: {
      inject: (_name: string, run: () => void) => run(),
      register: (spec: SlotSpec, component?: unknown) => {
        if (spec.id === "pluginmax-task") {
          Task = component as (props: Record<string, unknown>) => unknown;
        }
        return () => undefined;
      },
    },
  };
  harness.exports.apply?.(ctx);
  expect(Task, "任务管理页应注册到 pluginmax.global").toBeDefined();
  return {
    type: Task,
    props: {
      renderSlot: harness.renderSlot,
      renderActions: harness.renderActions,
      useShellRoute: (select: (state: unknown) => unknown) =>
        select({ route: "task" }),
    },
  };
}

function titleNode(tree: unknown, title: string): TreeNode | undefined {
  return findNode(
    tree,
    (node) =>
      node.type === "div" &&
      node.props?.className === "pmtask-title" &&
      node.props?.children === title,
  );
}

describe("task client", () => {
  it("maps execution status to the six process tags", () => {
    const source = readFileSync(CLIENT_PATH, "utf8");
    expect(source).toContain('return { label: "排队中", tone: "queued" };');
    expect(source).toContain('return { label: "执行中", tone: "running" };');
    expect(source).toContain('return { label: "待补充", tone: "waiting" };');
    expect(source).toContain('return { label: "已完成", tone: "success" };');
    expect(source).toContain(
      'return { label: "失败 / 超时", tone: "failed" };',
    );
    expect(source).toContain(
      'status === "failed" || status === "timeout"',
    );
    expect(source).toContain(
      'return { label: "已中断", tone: "interrupted" };',
    );
    expect(source).toContain(
      'return { label: "已取消", tone: "cancelled" };',
    );
  });

  it("labels an interrupted agent run as abnormal text", async () => {
    const task = makeTask({
      id: "TSK-INTERRUPTED-LABEL",
      workspaceId: "ws-1",
      title: "中断任务状态",
      status: "progress",
      priority: "P1",
      receiverType: "agent",
      receiverId: "agent-a",
      receiverName: "执行分身 A",
      createdBy: "admin",
      agentRunIds: ["run-interrupted"],
      messages: [
        {
          id: "run-interrupted",
          at: "2026-11-04T08:00:00.000Z",
          authorId: "agent-a",
          authorName: "执行分身 A",
          kind: "agent",
          content: "执行已中断。",
          attachments: [],
          mentions: [],
          runId: "run-interrupted",
          runRole: "owner",
          state: "interrupted",
        },
      ],
      updatedAt: "2026-11-04T08:00:00.000Z",
    });
    const fetchImpl = (input: string) => {
      if (input.startsWith("/api/collab/auth/me")) {
        return Promise.resolve(
          payload({ user: { id: "admin", name: "平台 Admin", role: "admin" } }),
        );
      }
      if (input.startsWith("/api/collab/team/workspaces")) {
        return Promise.resolve(
          payload({
            workspaces: [
              { id: "ws-1", title: "项目一", path: "/p1", isMember: true },
            ],
          }),
        );
      }
      if (input.startsWith("/api/collab/tasks/bootstrap")) {
        return Promise.resolve(
          payload({
            tasks: [task],
            directory: {
              humans: [],
              agents: [
                {
                  id: "agent-a",
                  name: "执行分身 A",
                  kind: "agent",
                  ownerAuthUserId: "admin",
                },
              ],
              roles: [],
            },
          }),
        );
      }
      return Promise.resolve(payload({}));
    };
    const harness = loadClientExports({ fetchImpl });
    const root = mountTaskPage(harness);
    const tree = await settle(root, harness.runtime);
    const indicator = findNode(
      tree,
      (node) =>
        node.props?.className === "pmtask-run-state-text interrupted",
    );
    expect(indicator?.props?.children).toBe("异常");
    expect(indicator?.props?.title).toBe("Agent 执行已中断");
  });

  it("opens a programmatic task navigation without dropping through the board", async () => {
    const harness = loadClientExports({ fetchImpl: adminFetch });
    const root = mountTaskPage(harness);
    let tree = await settle(root, harness.runtime);
    const mine = findNode(
      tree,
      (node) => node.props?.["data-task-id"] === "t-mine",
    );
    (mine?.props?.onClick as (() => void) | undefined)?.();
    tree = await settle(root, harness.runtime, 10);
    expect(
      findNode(
        tree,
        (node) =>
          node.props?.className === "pmtask-detail-page" &&
          containsText(node.props?.children, "我的任务"),
      ),
    ).toBeDefined();

    harness.window.__pluginmaxPendingTask = {
      taskId: "t-joined",
      workspaceId: "ws-2",
    };
    (
      harness.window.dispatchEvent as (
        event: { type: string; detail?: unknown },
      ) => boolean
    )({
      type: "pluginmax:route-select",
      detail: { route: "task" },
    });
    tree = await settle(root, harness.runtime, 10);
    expect(
      findNode(
        tree,
        (node) =>
          node.props?.className === "pmtask-detail-page" &&
          containsText(node.props?.children, "同项目别人的任务"),
      ),
      "程序化任务导航应直接打开目标详情",
    ).toBeDefined();
  });

  it("opens task cards in detail without Data Agent selection", () => {
    const source = readFileSync(
      resolve(import.meta.dirname, "../client/index.js"),
      "utf8",
    );
    expect(source).toContain('"data-task-id": task.id');
    expect(source).toContain('"data-data-agent-exclude": "true"');
    expect(source).toContain("onClick: () => onOpen(task.id),");
    expect(source).toContain('"aria-label": `查看任务 ${task.id} 详情`');
    expect(source).toContain("event.stopPropagation();");
  });

  it("moves the sidebar action into the detail bar and drops the page header", async () => {
    const harness = loadClientExports({ fetchImpl: adminFetch });
    const root = mountTaskPage({
      ...harness,
      renderActions: () => ({
        type: "button",
        props: {
          type: "button",
          "data-test-action": "sidebar",
          children: "打开侧边栏",
        },
      }),
    });
    let tree = await settle(root, harness.runtime);

    expect(
      findNode(tree, (node) => node.props?.className === "pmtask-head"),
      "看板应继续展示页面级工具栏",
    ).toBeDefined();

    (
      findNode(tree, (node) => node.props?.["data-task-id"] === "t-mine")?.props
        ?.onClick as (() => void) | undefined
    )?.();
    tree = await settle(root, harness.runtime);

    expect(
      findNode(tree, (node) => node.props?.className === "pmtask-head"),
      "任务详情不应再保留顶部整条工具栏",
    ).toBeUndefined();
    const detailActions = findNode(
      tree,
      (node) => node.props?.className === "pmtask-detail-top-actions",
    );
    expect(detailActions, "侧栏开关应移到详情顶栏").toBeDefined();
    expect(
      findNode(
        detailActions,
        (node) => node.props?.["data-test-action"] === "sidebar",
      ),
    ).toBeDefined();
  });

  it("renders a visible task detail extension only when the slot has content", async () => {
    const task = makeTask({
      id: "TSK-UI-EXTENSION",
      workspaceId: "ws-1",
      title: "扩展区可见性",
      status: "progress",
      priority: "P2",
      receiverType: "human",
      receiverId: "admin",
      receiverName: "Admin",
      createdBy: "admin",
      updatedAt: "2026-03-08T01:00:00.000Z",
    });
    const taskId = "TSK-UI-EXTENSION";
    const fetchImpl = (input: string) => {
      if (input.startsWith("/api/collab/auth/me")) {
        return Promise.resolve(
          payload({ user: { id: "admin", name: "Admin", role: "admin" } }),
        );
      }
      if (input.startsWith("/api/collab/team/workspaces")) {
        return Promise.resolve(
          payload({
            workspaces: [
              { id: "ws-1", title: "项目一", path: "/p1", isMember: true },
            ],
          }),
        );
      }
      if (input.startsWith("/api/collab/tasks/bootstrap")) {
        return Promise.resolve(
          payload({
            tasks: [task],
            directory: { humans: [], agents: [], roles: [] },
          }),
        );
      }
      return Promise.resolve(payload({}));
    };

    const emptyHarness = loadClientExports({ fetchImpl });
    const emptyRoot = mountTaskPage(emptyHarness);
    let tree = await settle(emptyRoot, emptyHarness.runtime);
    (
      findNode(
        tree,
        (node) => node.props?.["data-task-id"] === taskId,
      )?.props?.onClick as (() => void) | undefined
    )?.();
    tree = await settle(emptyRoot, emptyHarness.runtime);
    expect(
      findNode(
        tree,
        (node) =>
          node.props?.["data-task-detail-slot"] ===
          "pluginmax.task.detail.extension",
      ),
      "空 slot 不应创建占位容器",
    ).toBeUndefined();

    const filledHarness = loadClientExports({
      fetchImpl,
      renderSlot: (name, props) =>
        name === "pluginmax.task.detail.extension"
          ? {
              type: "section",
              props: { children: `扩展卡 ${String(props.taskId)}` },
            }
          : null,
    });
    const filledRoot = mountTaskPage(filledHarness);
    tree = await settle(filledRoot, filledHarness.runtime);
    (
      findNode(
        tree,
        (node) => node.props?.["data-task-id"] === taskId,
      )?.props?.onClick as (() => void) | undefined
    )?.();
    tree = await settle(filledRoot, filledHarness.runtime);
    const extension = findNode(
      tree,
      (node) =>
        node.props?.["data-task-detail-slot"] ===
        "pluginmax.task.detail.extension",
    );
    expect(extension?.props?.hidden).not.toBe(true);
    expect(containsText(extension?.props?.children, "扩展卡")).toBe(true);
  });

  it("clears task data and edit state when the login token changes", () => {
    const source = readFileSync(CLIENT_PATH, "utf8");
    const listenerStart = source.indexOf(
      'window.addEventListener("pluginmax:collab-token", synchronize)',
    );
    const synchronizeStart = source.lastIndexOf(
      "const synchronize =",
      listenerStart,
    );
    const synchronizeEnd = source.indexOf("}, [load]);", listenerStart);
    expect(synchronizeStart).toBeGreaterThan(-1);
    expect(synchronizeEnd).toBeGreaterThan(synchronizeStart);
    const synchronize = source.slice(synchronizeStart, synchronizeEnd);
    expect(synchronize).toContain("setTasks([])");
    expect(synchronize).toContain("setCurrentUser(null)");
    expect(synchronize).toContain('setOwnership("all")');
    expect(synchronize).toContain('setReceiver("me")');
    expect(synchronize).toContain('setPriority("")');
    expect(synchronize).toContain('setSource("")');
    expect(synchronize).toContain('setSearch("")');
    expect(synchronize).toContain("setCreateOpen(false)");
    expect(synchronize).toContain("setAssignOpen(false)");
  });

  it("uses server-projected review authority instead of assignment alone", () => {
    const source = readFileSync(CLIENT_PATH, "utf8");
    expect(source).toContain("reviewableTaskIds");
    expect(source).toContain(
      "const canReview = reviewableTaskIds.includes(task.id)",
    );
    expect(source).toContain("canReview &&");
  });

  it("announces when an instruction starts a todo task", () => {
    const source = readFileSync(CLIENT_PATH, "utf8");
    expect(source).toContain(
      'task.status === "todo"\n              ? "指令已发送，任务进入进行中"',
    );
    expect(source).not.toContain("const reopensTask =");
  });

  it("renders mixed built-in/external runtimes, human reassignment and round instructions", async () => {
    const primaryExecution = {
      provider: "custom",
      model: "deepseek-flash",
      runtime: "Codex CLI",
      runtimeVersion: "0.163.0-alpha.10.2",
      authMode: "api-key",
      sandbox: "read-only / network restricted",
    };
    const collaboratorExecution = {
      provider: "workbuddy",
      model: "hunyuan-code",
      runtime: "WorkBuddy CLI",
      runtimeVersion: "2.161.0",
      authMode: "cli-login",
      sandbox: "accept-edits",
    };
    const secondaryExternalExecution = {
      provider: "workbuddy",
      model: "hy4-reasoning",
      runtime: "CodeBuddy CLI · hy4 标准",
      runtimeVersion: "3.0.1",
      authMode: "cli-login",
      sandbox: "workspace-write",
    };
    const task = makeTask({
      id: "TSK-RUN-META-1",
      workspaceId: "ws-1",
      title: "运行信息展示",
      status: "progress",
      priority: "P1",
      receiverType: "human",
      receiverId: "admin",
      receiverName: "Admin",
      createdBy: "admin",
      updatedAt: "2026-10-23T03:00:00.000Z",
      agentRunIds: ["run-meta-1", "run-meta-2", "run-meta-3"],
      messages: [
        {
          id: "ask-meta-1",
          at: "2026-10-23T02:59:00.000Z",
          authorId: "admin",
          authorName: "Admin",
          kind: "human",
          content: "先使用内置运行时梳理初稿。",
          attachments: [],
          mentions: [],
        },
        {
          id: "run-meta-1",
          at: "2026-10-23T03:00:00.000Z",
          authorId: "tm-1",
          authorName: "Codex 调研架构师",
          kind: "agent",
          content: "调研已完成。",
          attachments: [],
          mentions: [],
          runId: "run-meta-1",
          runRole: "owner",
          state: "succeeded",
          execution: primaryExecution,
        },
        {
          id: "ask-meta-2",
          at: "2026-10-23T03:00:30.000Z",
          authorId: "admin",
          authorName: "Admin",
          kind: "human",
          content: "改派给 WorkBuddy 复核供应链风险。",
          attachments: [],
          mentions: [],
        },
        {
          id: "run-meta-2",
          at: "2026-10-23T03:01:00.000Z",
          authorId: "tm-2",
          authorName: "WorkBuddy 风险官",
          kind: "agent",
          content: "风险意见已补充。",
          attachments: [],
          mentions: [],
          runId: "run-meta-2",
          runRole: "assist",
          state: "succeeded",
          execution: collaboratorExecution,
        },
        {
          id: "run-meta-3",
          at: "2026-10-23T03:02:00.000Z",
          authorId: "tm-3",
          authorName: "CodeBuddy 总结员",
          kind: "agent",
          content:
            "最终结论已汇总。\n\n已更新 [summary.md](</tmp/outputs/run-meta-3/summary.md:1>)。\n\n产出文档：summary.md",
          attachments: [],
          mentions: [],
          runId: "run-meta-3",
          runRole: "owner",
          state: "succeeded",
          execution: secondaryExternalExecution,
        },
      ],
      events: [
        {
          id: "assignment-human-1",
          at: "2026-10-23T03:00:15.000Z",
          actorId: "admin",
          actorName: "Admin",
          kind: "assignment",
          message: "Admin 调整责任人为 人类审核员甲",
        },
        {
          id: "assignment-human-2",
          at: "2026-10-23T03:01:15.000Z",
          actorId: "admin",
          actorName: "Admin",
          kind: "assignment",
          message: "Admin 调整责任人为 人类审核员乙",
        },
        {
          id: "assignment-agent-3",
          at: "2026-10-23T03:01:50.000Z",
          actorId: "admin",
          actorName: "Admin",
          kind: "assignment",
          message: "Admin 调整责任人为 CodeBuddy 总结员",
        },
      ],
    });
    const fetchImpl = (input: string) => {
      if (input.startsWith("/api/collab/auth/me")) {
        return Promise.resolve(
          payload({ user: { id: "admin", name: "Admin", role: "admin" } }),
        );
      }
      if (input.startsWith("/api/collab/team/workspaces")) {
        return Promise.resolve(
          payload({
            workspaces: [
              { id: "ws-1", title: "项目一", path: "/p1", isMember: true },
            ],
          }),
        );
      }
      if (input.startsWith("/api/collab/tasks/bootstrap")) {
        return Promise.resolve(
          payload({
            tasks: [task],
            directory: {
              humans: [],
              agents: [
                {
                  id: "tm-1",
                  name: "Codex 调研架构师",
                  source: "platform",
                },
              ],
              roles: [],
            },
          }),
        );
      }
      if (input.startsWith("/api/collab/agent/runs?")) {
        return Promise.resolve(
          payload({
            runs: [
              {
                id: "run-meta-1",
                status: "succeeded",
                createdAt: "2026-10-23T03:00:00.000Z",
                execution: primaryExecution,
                payload: {
                  profileName: "Codex 调研架构师",
                  context: {
                    taskRunRole: "owner",
                    triggerMessageId: "ask-meta-1",
                  },
                },
              },
              {
                id: "run-meta-2",
                status: "succeeded",
                createdAt: "2026-10-23T03:01:00.000Z",
                execution: collaboratorExecution,
                payload: {
                  profileName: "WorkBuddy 风险官",
                  context: {
                    taskRunRole: "owner",
                    triggerMessageId: "ask-meta-2",
                  },
                },
              },
              {
                id: "run-meta-3",
                status: "succeeded",
                createdAt: "2026-10-23T03:02:00.000Z",
                execution: secondaryExternalExecution,
                payload: {
                  profileName: "CodeBuddy 总结员",
                  context: {
                    taskRunRole: "owner",
                  },
                },
              },
            ],
          }),
        );
      }
      if (input.startsWith("/api/collab/agent/runs/detail")) {
        const runId = new URL(`http://x${input}`).searchParams.get("runId");
        const executions = new Map([
          ["run-meta-1", primaryExecution],
          ["run-meta-2", collaboratorExecution],
          ["run-meta-3", secondaryExternalExecution],
        ]);
        const selected = {
          id: runId ?? "run-meta-3",
          status: "succeeded",
          execution: executions.get(runId ?? "") ?? secondaryExternalExecution,
        };
        return Promise.resolve(
          payload({
            run: selected,
            progress: null,
          }),
        );
      }
      if (input.startsWith("/api/collab/agent/execution/detail")) {
        const selectedRunId =
          new URL(`http://x${input}`).searchParams.get("runId") ?? "run-meta-3";
        const snapshots = new Map([
          [
            "run-meta-1",
            {
              provider: "custom",
              model: "deepseek-flash",
              runtimeName: "Codex CLI",
              runtimeVersion: "0.163.0-alpha.10.2",
              authMode: "api-key",
              sandbox: "read-only / network restricted",
              searchEnabled: false,
              networkAccess: "restricted",
              searchUsed: false,
              planVisibility: "summary",
            },
          ],
          [
            "run-meta-2",
            {
              provider: "workbuddy",
              model: "hunyuan-code",
              runtimeName: "WorkBuddy CLI",
              runtimeVersion: "2.161.0",
              authMode: "cli-login",
              sandbox: "accept-edits",
              searchEnabled: false,
              networkAccess: "unknown",
              searchUsed: null,
              planVisibility: "summary",
            },
          ],
          [
            "run-meta-3",
            {
              provider: "workbuddy",
              model: "hy4-reasoning",
              runtimeName: "CodeBuddy CLI · hy4 标准",
              runtimeVersion: "3.0.1",
              authMode: "cli-login",
              sandbox: "workspace-write",
              searchEnabled: true,
              networkAccess: "restricted",
              searchUsed: true,
              reasoningEffort: "high",
              planVisibility: "structured",
              gateEnforcement: "observe-only",
            },
          ],
        ]);
        return Promise.resolve(
          payload({
            execution: {
              runId: selectedRunId,
              plan: {
                id: "plan-1",
                runId: "run-meta-3",
                workspaceId: "ws-1",
                source: "explicit",
                visibility: "structured",
                revision: 2,
                status: "active",
                summary: "先检索来源，再汇总报告",
                steps: [
                  {
                    id: "step-1",
                    ordinal: 0,
                    title: "检索公开来源",
                    status: "completed",
                    evidenceRefs: [],
                  },
                  {
                    id: "step-2",
                    ordinal: 1,
                    title: "汇总最终结论",
                    status: "active",
                    evidenceRefs: [],
                  },
                ],
                subagents: [],
                lastEventSeq: 2,
                createdAt: "2026-10-23T03:02:00.000Z",
                updatedAt: "2026-10-23T03:03:00.000Z",
              },
              events: [
                {
                  id: "event-1",
                  runId: "run-meta-3",
                  seq: 1,
                  type: "tool.call",
                  source: "external-trace",
                  visibility: "public",
                  summary: "调用工具：web_search",
                  createdAt: "2026-10-23T03:02:10.000Z",
                },
                {
                  id: "event-2",
                  runId: "run-meta-3",
                  seq: 2,
                  type: "tool.call",
                  source: "external-trace",
                  visibility: "public",
                  summary: "调用工具：exec_command",
                  data: { toolName: "exec_command" },
                  createdAt: "2026-10-23T03:02:11.000Z",
                },
                {
                  id: "event-3",
                  runId: "run-meta-3",
                  seq: 3,
                  type: "tool.call",
                  source: "external-trace",
                  visibility: "public",
                  summary: "调用工具：exec_command",
                  data: { toolName: "exec_command" },
                  createdAt: "2026-10-23T03:02:12.000Z",
                },
              ],
              gates: [
                {
                  id: "gate-1",
                  runId: "run-meta-3",
                  taskId: "TSK-RUN-META-1",
                  workspaceId: "ws-1",
                  kind: "tool-approval",
                  status: "pending",
                  reason: "请求写入最终报告文件",
                  requestedScope: ["write"],
                  enforcement: "blocking",
                  requestedAt: "2026-10-23T03:02:20.000Z",
                },
              ],
              snapshot: {
                runId: selectedRunId,
                ...(snapshots.get(selectedRunId) ??
                  snapshots.get("run-meta-3")),
              },
            },
          }),
        );
      }
      if (input.startsWith("/api/collab/tasks/documents")) {
        return Promise.resolve(
          payload({
            workspaceReady: true,
            documents: [
              {
                id: "doc-meta-1",
                runId: "run-meta-3",
                runIds: ["run-meta-1", "run-meta-3"],
                kind: "produced",
                name: "primary.md",
                relativePath: "outputs/run-meta-1/primary.md",
                size: 10,
                mimeType: "text/markdown",
                updatedBy: "Codex 调研架构师",
                updatedAt: "2026-10-23T03:02:30.000Z",
                available: true,
              },
              {
                id: "doc-meta-2",
                runId: "run-meta-2",
                kind: "produced",
                name: "collaborator.md",
                relativePath: "outputs/run-meta-2/collaborator.md",
                size: 10,
                mimeType: "text/markdown",
                updatedBy: "WorkBuddy 风险官",
                updatedAt: "2026-10-23T03:01:00.000Z",
                available: true,
              },
              {
                id: "doc-meta-3",
                runId: "run-meta-3",
                kind: "produced",
                name: "summary.md",
                relativePath: "outputs/run-meta-3/summary.md",
                size: 10,
                mimeType: "text/markdown",
                updatedBy: "CodeBuddy 总结员",
                updatedAt: "2026-10-23T03:02:00.000Z",
                available: true,
              },
            ],
          }),
        );
      }
      return Promise.resolve(payload({}));
    };

    const harness = loadClientExports({ fetchImpl });
    const root = mountTaskPage(harness);
    let tree = await settle(root, harness.runtime);
    const card = findNode(
      tree,
      (node) => node.props?.["data-task-id"] === "TSK-RUN-META-1",
    );
    (card?.props?.onClick as (() => void) | undefined)?.();
    tree = await settle(root, harness.runtime);

    for (const [label, value] of [
      ["执行运行时", "CodeBuddy CLI · hy4 标准"],
      ["模型 / 推理强度", "Hy4 Reasoning（默认） · 高（默认）"],
    ] as const) {
      expect(
        findNode(
          tree,
          (node) =>
            node.props?.className === "pmtask-detail-info" &&
            containsText(node.props?.children, label) &&
            containsText(node.props?.children, value),
        ),
        `基础信息应优先展示当前 Run 的 ${label}`,
      ).toBeDefined();
    }

    expect(
      findNodes(
        tree,
        (node) => node.props?.className === "pmtask-run-meta",
      ),
      "Agent 回复下不再重复展示运行信息",
    ).toHaveLength(0);
    const documentLink = findNode(
      tree,
      (node) =>
        node.type === "button" &&
        node.props?.className === "pmtask-md-doc-link" &&
        node.props?.children === "summary.md",
    );
    expect(
      documentLink,
      "消息中的产出文档名称应支持点击下载",
    ).toBeDefined();
    expect(documentLink?.props?.title).toBe("下载 summary.md");
    expect(
      findNodes(
        tree,
        (node) =>
          node.type === "button" &&
          node.props?.className === "pmtask-md-doc-link" &&
          node.props?.children === "summary.md",
      ),
      "显式文件路径和产出文档名称都应收敛为下载入口",
    ).toHaveLength(2);

    const executionTab = findNode(
      tree,
      (node) =>
        node.type === "button" &&
        node.props?.children === "AI执行记录",
    );
    expect(executionTab, "详情应固定提供 AI执行记录页签").toBeDefined();
    (executionTab?.props?.onClick as (() => void) | undefined)?.();
    tree = await settle(root, harness.runtime);

    const executionRecord = findNode(
      tree,
      (node) =>
        node.props?.className === "pmtask-side-section pmtask-execution-record",
    );
    expect(executionRecord, "轮次与二级内容应统一收在执行记录中").toBeDefined();
    expect(containsText(executionRecord?.props?.children, "AI执行记录")).toBe(
      true,
    );
    expect(
      findNode(
        executionRecord,
        (node) => node.type === "h4" && node.props?.children === "AI伙伴",
      ),
      "执行记录内不再重复展示 AI伙伴区块",
    ).toBeUndefined();
    expect(containsText(executionRecord?.props?.children, "产出物")).toBe(true);
    expect(containsText(executionRecord?.props?.children, "执行过程")).toBe(
      true,
    );
    expect(containsText(executionRecord?.props?.children, "执行活动")).toBe(
      false,
    );
    expect(
      findNode(
        executionRecord,
        (node) => node.props?.className === "pmtask-live-output",
      ),
      "重复的执行过程正文模块应移除",
    ).toBeUndefined();
    expect(
      findNode(
        executionRecord,
        (node) =>
          String(node.props?.className ?? "")
            .split(/\s+/)
            .includes("pmtask-execution-status-tag") &&
          node.props?.children === "已完成",
      ),
      "执行过程标题右侧应使用状态标签",
    ).toBeDefined();
    expect(
      containsText(executionRecord?.props?.children, "根据事件整理"),
      "执行计划标题不展示摘要来源标签",
    ).toBe(false);
    expect(
      containsText(executionRecord?.props?.children, "先检索来源，再汇总报告"),
      "执行计划不再重复展示过程摘要文案",
    ).toBe(false);
    expect(containsText(executionRecord?.props?.children, "检索公开来源")).toBe(
      true,
    );
    expect(
      findNode(
        executionRecord,
        (node) =>
          String(node.props?.className ?? "")
            .split(/\s+/)
            .includes("pmtask-agent-activity") &&
          containsText(node.props?.children, "搜索资料"),
      ),
      "工具调用应转换为可读的关键执行活动",
    ).toBeDefined();
    const groupedCommand = findNode(
      executionRecord,
      (node) =>
        String(node.props?.className ?? "")
          .split(/\s+/)
          .includes("pmtask-agent-activity") &&
        containsText(node.props?.children, "运行命令"),
    );
    expect(
      groupedCommand,
      "连续相同工具调用应合并计数",
    ).toBeDefined();
    expect(containsText(groupedCommand?.props?.children, "× 2")).toBe(true);
    const activityList = findNode(
      executionRecord,
      (node) => node.props?.["aria-label"] === "Agent 执行过程",
    );
    expect(activityList, "执行过程应使用独立滚动容器").toBeDefined();
    expect(typeof activityList?.props?.onScroll).toBe("function");
    const rawEvents = findNode(
      executionRecord,
      (node) => node.props?.className === "pmtask-execution-raw",
    );
    expect(rawEvents, "原始事件应默认折叠").toBeDefined();
    expect(rawEvents?.props?.open).not.toBe(true);
    expect(
      containsText(executionRecord?.props?.children, "调用工具：web_search"),
    ).toBe(true);
    expect(containsText(executionRecord?.props?.children, "运行信息")).toBe(
      true,
    );
    expect(containsText(executionRecord?.props?.children, "认证方式")).toBe(
      true,
    );
    expect(containsText(executionRecord?.props?.children, "搜索工具调用")).toBe(
      true,
    );
    const searchUsageRow = findNode(
      executionRecord,
      (node) =>
        node.props?.className === "pmtask-run-summary-row" &&
        containsText(node.props?.children, "搜索工具调用"),
    );
    expect(containsText(searchUsageRow?.props?.children, "是")).toBe(true);
    expect(containsText(executionRecord?.props?.children, "等待执行授权")).toBe(
      true,
    );
    expect(
      containsText(executionRecord?.props?.children, "请求写入最终报告文件"),
    ).toBe(true);
    expect(
      containsText(
        executionRecord?.props?.children,
        "仅执行后观察：Runtime 只能记录已执行动作，无法事前阻断。",
      ),
      "执行过程区域不再展示技术能力说明",
    ).toBe(false);
    expect(
      findNode(
        executionRecord,
        (node) =>
          String(node.props?.className ?? "")
            .split(/\s+/)
            .includes("observe-only"),
      ),
      "observe-only 说明不应使用高亮框",
    ).toBeUndefined();

    const executionRuns = findNode(
      executionRecord,
      (node) => node.props?.className === "pmtask-execution-runs",
    );
    expect(executionRuns, "轮次选择应位于执行记录顶部").toBeDefined();

    const roundTrigger = findNode(
      executionRuns,
      (node) =>
        node.type === "button" &&
        node.props?.className === "pmtask-execution-round-trigger",
    );
    expect(roundTrigger, "轮次应通过紧凑下拉框切换").toBeDefined();
    expect(roundTrigger?.props?.["aria-expanded"]).toBe(false);
    const collapsedRoundLabel = findNode(
      roundTrigger,
      (node) =>
        typeof node.props?.children === "string" &&
        /^第 \d+ 轮 · .+ · .+$/.test(node.props.children),
    )?.props?.children;
    expect(collapsedRoundLabel, "收起态只展示轮次、伙伴和状态").toMatch(
      /^第 \d+ 轮 · .+ · .+$/,
    );
    const collapsedRoundTime = findNode(
      roundTrigger,
      (node) =>
        node.type === "time" &&
        node.props?.className === "pmtask-execution-round-trigger-time",
    );
    expect(
      collapsedRoundTime?.props?.dateTime,
      "收起态右侧应展示当前轮的指令发送时间",
    ).toBe("2026-10-23T03:02:00.000Z");
    expect(
      containsText(
        roundTrigger?.props?.children,
        "调整责任人为 CodeBuddy 总结员",
      ),
      "收起态只展示轮次、伙伴和状态，不拼接指令",
    ).toBe(false);
    const selectedRoundInstruction = findNode(
      executionRuns,
      (node) =>
        typeof node.props?.className === "string" &&
        node.props.className.includes("pmtask-selected-round-instruction"),
    );
    expect(
      selectedRoundInstruction,
      "下拉框收起时应在触发器下方展示当前轮指令卡",
    ).toBeDefined();
    expect(
      containsText(
        selectedRoundInstruction?.props?.children,
        "调整责任人为 CodeBuddy 总结员",
      ),
    ).toBe(true);
    const selectedInstructionToggle = findNode(
      selectedRoundInstruction,
      (node) =>
        node.type === "button" &&
        node.props?.className === "pmtask-round-instruction-toggle",
    );
    expect(
      containsText(selectedInstructionToggle?.props?.children, "展开完整指令"),
    ).toBe(true);
    (
      selectedInstructionToggle?.props?.onClick as
        ((event: { stopPropagation: () => void }) => void) | undefined
    )?.({
      stopPropagation: () => undefined,
    });
    tree = await settle(root, harness.runtime);
    let refreshedExecutionRuns = findNode(
      tree,
      (node) => node.props?.className === "pmtask-execution-runs",
    );
    expect(
      findNode(
        refreshedExecutionRuns,
        (node) =>
          typeof node.props?.className === "string" &&
          node.props.className.includes("pmtask-selected-round-instruction") &&
          node.props.className.includes("expanded"),
      ),
      "固定指令卡应复用三行指令的展开交互",
    ).toBeDefined();

    const refreshedRoundTrigger = findNode(
      refreshedExecutionRuns,
      (node) =>
        node.type === "button" &&
        node.props?.className === "pmtask-execution-round-trigger",
    );
    (refreshedRoundTrigger?.props?.onClick as (() => void) | undefined)?.();
    tree = await settle(root, harness.runtime);
    let refreshedExecutionRecord = findNode(
      tree,
      (node) =>
        node.props?.className === "pmtask-side-section pmtask-execution-record",
    );
    refreshedExecutionRuns = findNode(
      refreshedExecutionRecord,
      (node) => node.props?.className === "pmtask-execution-runs",
    );
    expect(
      findNode(
        refreshedExecutionRuns,
        (node) =>
          typeof node.props?.className === "string" &&
          node.props.className.includes("pmtask-selected-round-instruction"),
      ),
      "展开下拉框后应隐藏固定指令卡，避免与各轮指令重复",
    ).toBeUndefined();
    const openMenu = findNode(
      refreshedExecutionRecord,
      (node) => node.props?.className === "pmtask-execution-round-menu",
    );
    expect(openMenu, "展开后应展示全部轮次").toBeDefined();
    const orderedRoundOptions = findNodes(
      openMenu,
      (node) =>
        typeof node.props?.className === "string" &&
        node.props.className
          .split(/\s+/)
          .includes("pmtask-execution-round-option"),
    );
    expect(
      orderedRoundOptions.map((option) =>
        ["第 3 轮", "第 2 轮", "第 1 轮"].find((label) =>
          containsText(option.props?.children, label),
        ),
      ),
      "轮次卡片应按最新在前排列",
    ).toEqual(["第 3 轮", "第 2 轮", "第 1 轮"]);
    expect(
      orderedRoundOptions.map(
        (option) =>
          findNode(
            option,
            (node) =>
              node.type === "time" &&
              node.props?.className === "pmtask-execution-round-option-time",
          )?.props?.dateTime,
      ),
      "卡片右侧应展示 Agent Run 实际创建/投递时间",
    ).toEqual([
      "2026-10-23T03:02:00.000Z",
      "2026-10-23T03:01:00.000Z",
      "2026-10-23T03:00:00.000Z",
    ]);
    const roundInstructions = findNodes(
      openMenu,
      (node) =>
        typeof node.props?.className === "string" &&
        node.props.className
          .split(/\s+/)
          .includes("pmtask-round-instruction"),
    );
    expect(roundInstructions).toHaveLength(3);
    expect(
      containsText(roundInstructions, "先使用内置运行时梳理初稿"),
    ).toBe(true);
    const executionSource = readFileSync(CLIENT_PATH, "utf8");
    expect(executionSource).toContain("-webkit-line-clamp:3");
    expect(executionSource).toContain('"未记录本轮指令"');
    expect(executionSource).toContain(
      'return text === "" || text === "unknown" ? "未识别" : text;',
    );
    const firstRoundOption = orderedRoundOptions.find((option) =>
      containsText(option.props?.children, "第 1 轮"),
    );
    const firstRoundInstruction = findNode(
      firstRoundOption,
      (node) => node.props?.className === "pmtask-round-instruction",
    );
    const expandInstruction = findNode(
      firstRoundInstruction,
      (node) =>
        node.type === "button" &&
        node.props?.className === "pmtask-round-instruction-toggle",
    );
    expect(containsText(expandInstruction?.props?.children, "展开完整指令")).toBe(
      true,
    );
    (expandInstruction?.props?.onClick as
      | ((event: { stopPropagation: () => void }) => void)
      | undefined)?.({ stopPropagation: () => undefined });
    tree = await settle(root, harness.runtime);
    const expandedMenu = findNode(
      tree,
      (node) => node.props?.className === "pmtask-execution-round-menu",
    );
    expect(
      findNode(
        expandedMenu,
        (node) => node.props?.className === "pmtask-round-instruction expanded",
      ),
      "轮次指令应支持展开",
    ).toBeDefined();
    const initialSummary = findNode(
      tree,
      (node) => node.props?.className === "pmtask-run-summary",
    );
    expect(initialSummary, "默认应展示最新一轮运行信息").toBeDefined();
    expect(containsText(initialSummary?.props?.children, "workbuddy")).toBe(
      true,
    );
    expect(containsText(initialSummary?.props?.children, "hy4-reasoning")).toBe(
      true,
    );
    expect(containsText(initialSummary?.props?.children, "CodeBuddy CLI")).toBe(
      true,
    );
    expect(
      containsText(initialSummary?.props?.children, "workspace-write"),
    ).toBe(true);
    expect(
      findNode(
        executionRecord,
        (node) => node.props?.className === "pmtask-participant-list",
      ),
    ).toBeUndefined();
    const initialDocuments = findNode(
      executionRecord,
      (node) => node.props?.className === "pmtask-doc-list",
    );
    expect(containsText(initialDocuments?.props?.children, "summary.md")).toBe(
      true,
    );
    expect(containsText(initialDocuments?.props?.children, "primary.md")).toBe(
      true,
    );
    expect(containsText(initialDocuments?.props?.children, "本轮更新")).toBe(
      true,
    );
    expect(
      containsText(initialDocuments?.props?.children, "collaborator.md"),
    ).toBe(false);
    expect(containsText(tree, "调整责任人为 人类审核员甲")).toBe(true);
    expect(containsText(tree, "调整责任人为 人类审核员乙")).toBe(true);

    const externalOption = findNode(
      refreshedExecutionRecord,
      (node) =>
        node.props?.className === "pmtask-execution-round-option" &&
        containsText(node.props?.children, "第 2 轮"),
    );
    expect(externalOption, "应能定位整张轮次卡片").toBeDefined();
    (externalOption?.props?.onClick as (() => void) | undefined)?.();
    tree = await settle(root, harness.runtime);
    refreshedExecutionRecord = findNode(
      tree,
      (node) =>
        node.props?.className === "pmtask-side-section pmtask-execution-record",
    );
    const externalSummary = findNode(
      refreshedExecutionRecord,
      (node) => node.props?.className === "pmtask-run-summary",
    );
    expect(containsText(externalSummary?.props?.children, "hunyuan-code")).toBe(
      true,
    );
    expect(
      containsText(externalSummary?.props?.children, "WorkBuddy CLI"),
    ).toBe(true);
    expect(containsText(externalSummary?.props?.children, "cli-login")).toBe(
      true,
    );
    expect(containsText(externalSummary?.props?.children, "accept-edits")).toBe(
      true,
    );
    expect(
      containsText(
        externalSummary?.props?.children,
        "未记录到结构化搜索调用",
      ),
    ).toBe(true);
    expect(
      findNode(
        refreshedExecutionRecord,
        (node) => node.props?.className === "pmtask-execution-round-menu",
      ),
      "选择轮次后下拉框应收起，不再展示指令详情",
    ).toBeUndefined();
    const externalTrigger = findNode(
      refreshedExecutionRecord,
      (node) =>
        node.type === "button" &&
        node.props?.className === "pmtask-execution-round-trigger",
    );
    expect(
      containsText(
        externalTrigger?.props?.children,
        "第 2 轮 · WorkBuddy 风险官 · 已完成",
      ),
    ).toBe(true);
    expect(
      findNode(
        externalTrigger,
        (node) =>
          node.type === "time" &&
          node.props?.className === "pmtask-execution-round-trigger-time",
      )?.props?.dateTime,
      "切换轮次后收起态时间应同步更新",
    ).toBe("2026-10-23T03:01:00.000Z");
    expect(
      containsText(
        externalTrigger?.props?.children,
        "改派给 WorkBuddy 复核供应链风险",
      ),
    ).toBe(false);
    const externalSelectedInstruction = findNode(
      refreshedExecutionRecord,
      (node) =>
        typeof node.props?.className === "string" &&
        node.props.className.includes("pmtask-selected-round-instruction"),
    );
    expect(
      containsText(
        externalSelectedInstruction?.props?.children,
        "改派给 WorkBuddy 复核供应链风险",
      ),
      "切换轮次后固定指令卡应同步为新轮次指令",
    ).toBe(true);
    const externalDocuments = findNode(
      refreshedExecutionRecord,
      (node) => node.props?.className === "pmtask-doc-list",
    );
    expect(
      containsText(externalDocuments?.props?.children, "collaborator.md"),
    ).toBe(true);
    expect(containsText(externalDocuments?.props?.children, "summary.md")).toBe(
      false,
    );

    (externalTrigger?.props?.onClick as (() => void) | undefined)?.();
    tree = await settle(root, harness.runtime);
    refreshedExecutionRecord = findNode(
      tree,
      (node) =>
        node.props?.className === "pmtask-side-section pmtask-execution-record",
    );
    const reopenedMenu = findNode(
      refreshedExecutionRecord,
      (node) => node.props?.className === "pmtask-execution-round-menu",
    );
    const openRun1Button = findNode(
      reopenedMenu,
      (node) =>
        node.type === "button" && node.props?.["data-run-id"] === "run-meta-1",
    );
    (
      openRun1Button?.props?.onClick as
        ((event: { stopPropagation: () => void }) => void) | undefined
    )?.({
      stopPropagation: () => undefined,
    });
    tree = await settle(root, harness.runtime);
    refreshedExecutionRecord = findNode(
      tree,
      (node) =>
        node.props?.className === "pmtask-side-section pmtask-execution-record",
    );
    const selectedSummary = findNode(
      refreshedExecutionRecord,
      (node) => node.props?.className === "pmtask-run-summary",
    );
    expect(
      containsText(selectedSummary?.props?.children, "deepseek-flash"),
    ).toBe(true);
    expect(containsText(selectedSummary?.props?.children, "Codex CLI")).toBe(
      true,
    );
    expect(containsText(selectedSummary?.props?.children, "api-key")).toBe(
      true,
    );
    expect(
      containsText(
        selectedSummary?.props?.children,
        "read-only / network restricted",
      ),
    ).toBe(true);

    expect(
      findNode(
        refreshedExecutionRecord,
        (node) => node.props?.className === "pmtask-participant-list",
      ),
    ).toBeUndefined();
    const refreshedDocuments = findNode(
      refreshedExecutionRecord,
      (node) => node.props?.className === "pmtask-doc-list",
    );
    expect(
      containsText(refreshedDocuments?.props?.children, "primary.md"),
    ).toBe(true);
    expect(
      containsText(refreshedDocuments?.props?.children, "后续已更新"),
    ).toBe(true);
    expect(
      containsText(
        refreshedDocuments?.props?.children,
        "该文档已在后续轮次更新",
      ),
      "查看早期轮次时应说明文档已被后续更新且当前展示最新版",
    ).toBe(true);
    expect(
      containsText(
        refreshedDocuments?.props?.children,
        "当前展示工作区最新版",
      ),
    ).toBe(true);
    expect(
      containsText(
        refreshedDocuments?.props?.children,
        "不是第 1 轮的历史快照",
      ),
    ).toBe(true);
    expect(
      containsText(refreshedDocuments?.props?.children, "collaborator.md"),
    ).toBe(false);
    const builtinTrigger = findNode(
      refreshedExecutionRecord,
      (node) =>
        node.type === "button" &&
        node.props?.className === "pmtask-execution-round-trigger",
    );
    expect(
      containsText(
        builtinTrigger?.props?.children,
        "第 1 轮 · Codex 调研架构师 · 已完成",
      ),
    ).toBe(true);
    expect(
      containsText(builtinTrigger?.props?.children, "先使用内置运行时梳理初稿"),
    ).toBe(false);
    expect(
      findNode(
        refreshedExecutionRecord,
        (node) => node.props?.className === "pmtask-execution-round-menu",
      ),
    ).toBeUndefined();
  });

  it("distinguishes loading from missing legacy run metadata", async () => {
    const task = makeTask({
      id: "TSK-RUN-META-MISSING-1",
      workspaceId: "ws-1",
      title: "历史运行信息缺失",
      status: "progress",
      priority: "P1",
      receiverType: "human",
      receiverId: "admin",
      receiverName: "平台 Admin",
      createdBy: "admin",
      updatedAt: "2026-03-07T00:00:00.000Z",
      agentRunIds: ["run-meta-missing-1"],
      messages: [
        {
          id: "run-meta-missing-1",
          at: "2026-03-07T00:01:00.000Z",
          authorId: "tm-legacy",
          authorName: "历史 AI伙伴",
          kind: "agent",
          content: "历史执行结果",
          attachments: [],
          mentions: [],
          runId: "run-meta-missing-1",
          state: "succeeded",
        },
      ],
    });
    let resolveDetail:
      | ((response: {
          ok: boolean;
          status?: number;
          json: () => Promise<unknown>;
        }) => void)
      | undefined;
    const fetchImpl = (
      input: string,
    ): Promise<{
      ok: boolean;
      status?: number;
      json: () => Promise<unknown>;
    }> => {
      if (input.startsWith("/api/collab/auth/me")) {
        return Promise.resolve(
          payload({ user: { id: "admin", name: "平台 Admin", role: "admin" } }),
        );
      }
      if (input.startsWith("/api/collab/team/workspaces")) {
        return Promise.resolve(
          payload({
            workspaces: [
              { id: "ws-1", title: "项目一", path: "/p1", isMember: true },
            ],
          }),
        );
      }
      if (input.startsWith("/api/collab/tasks/bootstrap")) {
        return Promise.resolve(
          payload({
            tasks: [task],
            directory: {
              humans: [
                { id: "admin", name: "平台 Admin", kind: "human" },
                { id: "reviewer", name: "人类审核员", kind: "human" },
              ],
              agents: [
                {
                  id: "agent-1",
                  name: "执行分身",
                  kind: "agent",
                  execution: "builtin",
                },
              ],
              roles: [
                {
                  id: "role-1",
                  name: "项目执行角色",
                  kind: "role",
                  assignedUserIds: ["admin"],
                },
              ],
            },
          }),
        );
      }
      if (input.startsWith("/api/collab/agent/runs?")) {
        return Promise.resolve(
          payload({
            runs: [
              {
                id: "run-meta-missing-1",
                status: "succeeded",
                createdAt: "2026-03-07T00:01:00.000Z",
                payload: { profileName: "历史 AI伙伴" },
              },
            ],
          }),
        );
      }
      if (input.startsWith("/api/collab/agent/runs/detail")) {
        return new Promise((resolve) => {
          resolveDetail = resolve;
        });
      }
      if (input.startsWith("/api/collab/tasks/documents")) {
        return Promise.resolve(
          payload({ workspaceReady: true, documents: [] }),
        );
      }
      return Promise.resolve(payload({}));
    };

    const harness = loadClientExports({ fetchImpl });
    const root = mountTaskPage(harness);
    let tree = await settle(root, harness.runtime);
    const card = findNode(
      tree,
      (node) => node.props?.["data-task-id"] === "TSK-RUN-META-MISSING-1",
    );
    (card?.props?.onClick as (() => void) | undefined)?.();
    tree = await settle(root, harness.runtime);

    const executionTab = findNode(
      tree,
      (node) =>
        node.type === "button" &&
        node.props?.children === "AI执行记录",
    );
    (executionTab?.props?.onClick as (() => void) | undefined)?.();
    tree = await settle(root, harness.runtime);

    expect(
      findNode(
        tree,
        (node) =>
          node.props?.className === "pmtask-run-summary-empty" &&
          containsText(node.props?.children, "正在读取运行信息"),
      ),
      "Run 详情返回前应显示加载状态",
    ).toBeDefined();

    resolveDetail?.(
      payload({
        run: {
          id: "run-meta-missing-1",
          status: "succeeded",
          createdAt: "2026-03-07T00:01:00.000Z",
        },
        progress: null,
      }),
    );
    tree = await settle(root, harness.runtime);
    const unavailable = findNode(
      tree,
      (node) => node.props?.className === "pmtask-run-summary-unavailable",
    );
    expect(
      containsText(unavailable?.props?.children, "该轮未记录运行元数据"),
    ).toBe(true);
    expect(
      containsText(
        unavailable?.props?.children,
        "关联的 Agent Run 不存在，或该轮执行早于运行信息采集",
      ),
    ).toBe(true);
    expect(containsText(tree, "暂无运行信息")).toBe(false);
  });

  it("renders acceptance criteria as checkable items in task detail", async () => {
    const stepCalls: Array<{ path: string; body: unknown }> = [];
    const task = makeTask({
      id: "TSK-ACCEPTANCE-1",
      workspaceId: "ws-1",
      title: "验收项交互",
      status: "progress",
      priority: "P1",
      receiverType: "human",
      receiverId: "admin",
      receiverName: "平台 Admin",
      createdBy: "admin",
      updatedAt: "2026-03-07T00:00:00.000Z",
      steps: [
        { id: "step-scope", label: "完成范围核对", done: false },
        { id: "step-risk", label: "记录风险", done: true },
      ],
    });
    const fetchImpl = (
      input: string,
      init?: unknown,
    ): Promise<{
      ok: boolean;
      status?: number;
      json: () => Promise<unknown>;
    }> => {
      if (input.startsWith("/api/collab/auth/me")) {
        return Promise.resolve(
          payload({ user: { id: "admin", name: "平台 Admin", role: "admin" } }),
        );
      }
      if (input.startsWith("/api/collab/team/workspaces")) {
        return Promise.resolve(
          payload({
            workspaces: [
              { id: "ws-1", title: "项目一", path: "/p1", isMember: true },
            ],
          }),
        );
      }
      if (input.startsWith("/api/collab/tasks/bootstrap")) {
        return Promise.resolve(
          payload({
            tasks: [task],
            directory: { humans: [], agents: [], roles: [] },
          }),
        );
      }
      if (input.startsWith("/api/collab/tasks/step")) {
        stepCalls.push({
          path: input,
          body: JSON.parse(String((init as { body?: unknown })?.body ?? "{}")),
        });
        return Promise.resolve(
          payload({
            task: {
              ...task,
              steps: [
                { id: "step-scope", label: "完成范围核对", done: true },
                { id: "step-risk", label: "记录风险", done: true },
              ],
            },
          }),
        );
      }
      return Promise.resolve(payload({}));
    };

    const harness = loadClientExports({ fetchImpl });
    const root = mountTaskPage(harness);
    let tree = await settle(root, harness.runtime);
    const card = findNode(
      tree,
      (node) => node.props?.["data-task-id"] === "TSK-ACCEPTANCE-1",
    );
    (card?.props?.onClick as (() => void) | undefined)?.();
    tree = await settle(root, harness.runtime);

    const acceptance = findNode(
      tree,
      (node) => node.props?.className === "pmtask-acceptance",
    );
    expect(acceptance, "任务详情应展示验收标准").toBeDefined();
    expect(containsText(acceptance?.props?.children, "完成范围核对")).toBe(
      true,
    );
    expect(containsText(acceptance?.props?.children, "记录风险")).toBe(true);

    const firstStep = findNode(
      acceptance,
      (node) =>
        node.type === "input" &&
        node.props?.type === "checkbox" &&
        node.props?.checked === false,
    );
    (firstStep?.props?.onChange as ((event: unknown) => void) | undefined)?.({
      target: { checked: true },
    });
    await settle(root, harness.runtime);

    expect(stepCalls).toHaveLength(1);
    expect(stepCalls[0]?.path).toBe("/api/collab/tasks/step");
    expect(stepCalls[0]?.body).toEqual({
      taskId: "TSK-ACCEPTANCE-1",
      stepId: "step-scope",
      done: true,
    });
  });

  it("confirms acceptance items in a dialog before submitting review", async () => {
    const actionCalls: Array<{ path: string; body: unknown }> = [];
    const task = makeTask({
      id: "TSK-SUBMIT-ACCEPTANCE",
      workspaceId: "ws-1",
      title: "提交验收确认",
      status: "progress",
      priority: "P1",
      receiverType: "human",
      receiverId: "admin",
      receiverName: "平台 Admin",
      createdBy: "admin",
      updatedAt: "2026-03-07T00:00:00.000Z",
      steps: [
        { id: "step-a", label: "核对订单范围", done: false },
        { id: "step-b", label: "确认风险清单", done: false },
      ],
    });
    const fetchImpl = (input: string, init?: unknown) => {
      if (input.startsWith("/api/collab/auth/me")) {
        return Promise.resolve(
          payload({ user: { id: "admin", name: "平台 Admin", role: "admin" } }),
        );
      }
      if (input.startsWith("/api/collab/team/workspaces")) {
        return Promise.resolve(
          payload({
            workspaces: [
              { id: "ws-1", title: "项目一", path: "/p1", isMember: true },
            ],
          }),
        );
      }
      if (input.startsWith("/api/collab/tasks/bootstrap")) {
        return Promise.resolve(
          payload({
            tasks: [task],
            directory: { humans: [], agents: [], roles: [] },
          }),
        );
      }
      if (input.startsWith("/api/collab/tasks/action")) {
        actionCalls.push({
          path: input,
          body: JSON.parse(String((init as { body?: string })?.body ?? "{}")),
        });
        return Promise.resolve(
          payload({
            task: {
              ...task,
              status: "review",
              steps: task.steps.map((step) => ({
                ...step,
                done: step.id === "step-a",
              })),
            },
          }),
        );
      }
      return Promise.resolve(payload({}));
    };
    const harness = loadClientExports({ fetchImpl });
    const root = mountTaskPage(harness);
    let tree = await settle(root, harness.runtime);
    const card = findNode(
      tree,
      (node) => node.props?.["data-task-id"] === task.id,
    );
    (card?.props?.onClick as (() => void) | undefined)?.();
    tree = await settle(root, harness.runtime);
    const submit = findNode(
      tree,
      (node) => node.type === "button" && node.props?.children === "提交验收",
    );
    (submit?.props?.onClick as (() => void) | undefined)?.();
    tree = await settle(root, harness.runtime);
    const dialog = findNode(
      tree,
      (node) =>
        node.type === "form" &&
        node.props?.["aria-label"] === "确认验收标准并提交",
    );
    expect(dialog).toBeDefined();
    let confirm = findNode(
      dialog,
      (node) =>
        node.type === "button" && node.props?.children === "确认并提交",
    );
    expect(confirm?.props?.disabled).toBe(true);
    const firstStep = findNode(
      dialog,
      (node) =>
        node.type === "input" &&
        node.props?.type === "checkbox" &&
        node.props?.checked === false,
    );
    (firstStep?.props?.onChange as ((event: unknown) => void) | undefined)?.({
      target: { checked: true },
    });
    tree = await settle(root, harness.runtime);
    const refreshedDialog = findNode(
      tree,
      (node) =>
        node.type === "form" &&
        node.props?.["aria-label"] === "确认验收标准并提交",
    );
    confirm = findNode(
      refreshedDialog,
      (node) =>
        node.type === "button" && node.props?.children === "确认并提交",
    );
    expect(confirm?.props?.disabled).not.toBe(true);
    (
      refreshedDialog?.props?.onSubmit as
        | ((event: { preventDefault: () => void }) => void)
        | undefined
    )?.({ preventDefault: () => undefined });
    await settle(root, harness.runtime);
    expect(actionCalls[0]?.body).toMatchObject({
      taskId: task.id,
      action: "submit",
    });
    expect(
      (actionCalls[0]?.body as { completedStepIds?: unknown[] } | undefined)
        ?.completedStepIds,
    ).toHaveLength(1);
  });

  it("requires a rejection note before submitting a return", async () => {
    const actionCalls: Array<{ path: string; body: unknown }> = [];
    const task = makeTask({
      id: "TSK-REJECT-1",
      workspaceId: "ws-1",
      title: "退回必须填写说明",
      status: "review",
      priority: "P1",
      receiverType: "human",
      receiverId: "admin",
      receiverName: "平台 Admin",
      createdBy: "admin",
      updatedAt: "2026-03-07T00:00:00.000Z",
    });
    const fetchImpl = (
      input: string,
      init?: unknown,
    ): Promise<{
      ok: boolean;
      status?: number;
      json: () => Promise<unknown>;
    }> => {
      if (input.startsWith("/api/collab/auth/me")) {
        return Promise.resolve(
          payload({ user: { id: "admin", name: "平台 Admin", role: "admin" } }),
        );
      }
      if (input.startsWith("/api/collab/team/workspaces")) {
        return Promise.resolve(
          payload({
            workspaces: [
              { id: "ws-1", title: "项目一", path: "/p1", isMember: true },
            ],
          }),
        );
      }
      if (input.startsWith("/api/collab/tasks/bootstrap")) {
        return Promise.resolve(
          payload({
            tasks: [task],
            reviewableTaskIds: ["TSK-REJECT-1"],
            directory: { humans: [], agents: [], roles: [] },
          }),
        );
      }
      if (input.startsWith("/api/collab/tasks/action")) {
        actionCalls.push({
          path: input,
          body: JSON.parse(String((init as { body?: unknown })?.body ?? "{}")),
        });
        return Promise.resolve(
          payload({ task: { ...task, status: "progress" } }),
        );
      }
      return Promise.resolve(payload({}));
    };

    const harness = loadClientExports({ fetchImpl });
    const root = mountTaskPage(harness);
    let tree = await settle(root, harness.runtime);
    const card = findNode(
      tree,
      (node) => node.props?.["data-task-id"] === "TSK-REJECT-1",
    );
    (card?.props?.onClick as (() => void) | undefined)?.();
    tree = await settle(root, harness.runtime);
    const rejectButton = findNode(
      tree,
      (node) => node.type === "button" && node.props?.children === "退回",
    );
    (rejectButton?.props?.onClick as (() => void) | undefined)?.();
    tree = await settle(root, harness.runtime);

    const dialog = findNode(
      tree,
      (node) =>
        node.type === "form" &&
        node.props?.role === "dialog" &&
        node.props?.["aria-label"] === "退回任务",
    );
    expect(dialog, "点击退回应打开说明输入框").toBeDefined();
    const noteInput = findNode(
      dialog,
      (node) =>
        node.type === "textarea" && node.props?.["aria-label"] === "退回说明",
    );
    expect(noteInput).toBeDefined();
    const confirmButton = () =>
      findNode(
        tree,
        (node) => node.type === "button" && node.props?.children === "确认退回",
      );
    expect(confirmButton()?.props?.disabled).toBe(true);

    (noteInput?.props?.onChange as ((event: unknown) => void) | undefined)?.({
      target: { value: "缺少风险项，请补充影响范围" },
    });
    tree = await settle(root, harness.runtime);
    expect(confirmButton()?.props?.disabled).toBe(false);
    const updatedDialog = findNode(
      tree,
      (node) =>
        node.type === "form" &&
        node.props?.role === "dialog" &&
        node.props?.["aria-label"] === "退回任务",
    );
    (
      updatedDialog?.props?.onSubmit as
        ((event: { preventDefault: () => void }) => void) | undefined
    )?.({ preventDefault: () => undefined });
    await settle(root, harness.runtime);

    expect(actionCalls).toEqual([
      {
        path: "/api/collab/tasks/action",
        body: {
          taskId: "TSK-REJECT-1",
          action: "reject",
          note: "缺少风险项，请补充影响范围",
        },
      },
    ]);
  });

  it("registers the task page into the global slot", () => {
    const { exports: exported } = loadClientExports();
    expect(exported.inject).toEqual(["slots"]);
    const specs: SlotSpec[] = [];
    const ctx = {
      slots: {
        inject: (_name: string, run: () => void) => run(),
        register: (spec: SlotSpec) => {
          specs.push(spec);
          return () => undefined;
        },
      },
    };
    exported.apply?.(ctx);
    expect(specs.map((spec) => spec.id)).toEqual(["pluginmax-task"]);
    expect(specs.map((spec) => spec.name)).toEqual(["pluginmax.global"]);
  });

  it("keeps my own tasks from projects I have not joined in the default scope", async () => {
    const harness = loadClientExports({ fetchImpl: adminFetch });
    const root = mountTaskPage(harness);
    let tree = await settle(root, harness.runtime);

    // 默认「责任人=我」：只应看到指派给我的任务，即使它在我未加入的项目里。
    expect(
      titleNode(tree, "我的任务"),
      "默认视图应包含我负责的任务",
    ).toBeDefined();
    expect(titleNode(tree, "别人的任务")).toBeUndefined();
    expect(titleNode(tree, "同项目别人的任务")).toBeUndefined();
    expect(
      findNode(
        tree,
        (node) =>
          node.type === "button" && node.props?.children === "仅看已加入",
      )?.props?.["aria-pressed"],
      "默认停留在「仅看已加入」",
    ).toBe(true);

    // 把责任人切到「全部」，暴露范围裁剪：已加入项目全看，未加入项目只看我的。
    const receiverTrigger = findNode(
      tree,
      (node) => node.props?.["aria-label"] === "按责任人筛选任务",
    );
    expect(receiverTrigger, "责任人下拉应渲染").toBeDefined();
    (receiverTrigger?.props?.onClick as (() => void) | undefined)?.();
    tree = renderTree(root, harness.runtime);
    harness.runtime.runEffects();

    const allReceiverOption = findNode(
      tree,
      (node) =>
        node.type === "button" &&
        node.props?.role === "option" &&
        containsText(node.props?.children, "查看所有责任人的任务"),
    );
    expect(allReceiverOption, "「全部责任人」选项应渲染").toBeDefined();
    (allReceiverOption?.props?.onClick as (() => void) | undefined)?.();
    tree = await settle(root, harness.runtime);

    expect(
      titleNode(tree, "我的任务"),
      "未加入项目里我负责的任务仍在",
    ).toBeDefined();
    expect(
      titleNode(tree, "同项目别人的任务"),
      "已加入项目照常展示",
    ).toBeDefined();
    expect(
      titleNode(tree, "别人的任务"),
      "未加入项目里别人的任务不应出现在默认范围",
    ).toBeUndefined();

    // 切到「平台全量」后，未加入项目里别人的任务也应出现。
    const platformButton = findNode(
      tree,
      (node) => node.type === "button" && node.props?.children === "平台全量",
    );
    expect(platformButton, "平台全量切换应渲染").toBeDefined();
    (platformButton?.props?.onClick as (() => void) | undefined)?.();
    tree = await settle(root, harness.runtime);

    expect(
      titleNode(tree, "别人的任务"),
      "平台全量应包含全部项目",
    ).toBeDefined();
    expect(harness.scope.getSnapshot(), "切换应写回共享范围 store").toBe(true);
  });

  it("shows human- and AI-submitted tasks awaiting my review", async () => {
    const humanTask = makeTask({
      id: "t-review-human",
      workspaceId: "ws-1",
      title: "李工提交后等待周宁验收",
      status: "review",
      priority: "P2",
      receiverType: "human",
      receiverId: "ligong",
      receiverName: "李工",
      createdBy: "zhouning",
      createdByName: "周宁",
      updatedAt: "2026-03-08T00:00:00.000Z",
    });
    const aiTask = makeTask({
      id: "t-review-ai",
      workspaceId: "ws-1",
      title: "履约 AI 提交后等待周宁验收",
      status: "review",
      priority: "P2",
      receiverType: "agent",
      receiverId: "fulfillment-ai",
      receiverName: "履约 AI 伙伴",
      createdBy: "zhouning",
      createdByName: "周宁",
      updatedAt: "2026-03-08T00:00:01.000Z",
    });
    const fetchImpl = (input: string) => {
      if (input.startsWith("/api/collab/auth/me")) {
        return Promise.resolve(
          payload({
            user: { id: "zhouning", name: "周宁", role: "member" },
          }),
        );
      }
      if (input.startsWith("/api/collab/team/workspaces")) {
        return Promise.resolve(
          payload({
            workspaces: [
              { id: "ws-1", title: "项目一", path: "/p1", isMember: true },
            ],
          }),
        );
      }
      if (input.startsWith("/api/collab/tasks/bootstrap")) {
        return Promise.resolve(
          payload({
            tasks: [humanTask, aiTask],
            reviewableTaskIds: [humanTask.id, aiTask.id],
            directory: {
              humans: [
                { id: "zhouning", name: "周宁" },
                { id: "ligong", name: "李工" },
              ],
              agents: [
                {
                  id: "fulfillment-ai",
                  name: "履约 AI 伙伴",
                  kind: "agent",
                  ownerAuthUserId: "zhouning",
                },
              ],
              roles: [],
            },
          }),
        );
      }
      return Promise.resolve(payload({}));
    };
    const harness = loadClientExports({ fetchImpl });
    const root = mountTaskPage(harness);
    const tree = await settle(root, harness.runtime);
    expect(titleNode(tree, humanTask.title)).toBeDefined();
    expect(titleNode(tree, aiTask.title)).toBeDefined();
    const reviewColumn = findNode(
      tree,
      (node) =>
        node.type === "section" &&
        String(node.props?.className ?? "").startsWith("pmtask-column ") &&
        containsText(node.props?.children, "待验收"),
    );
    expect(reviewColumn).toBeDefined();
    expect(
      findNode(
        reviewColumn,
        (node) => node.props?.["data-task-id"] === humanTask.id,
      ),
    ).toBeDefined();
    expect(
      findNode(
        reviewColumn,
        (node) => node.props?.["data-task-id"] === aiTask.id,
      ),
    ).toBeDefined();
  });

  it("adopts the platform-wide scope chosen by another module", async () => {
    const harness = loadClientExports({
      fetchImpl: adminFetch,
      scopeAll: true,
    });
    const root = mountTaskPage(harness);
    const tree = await settle(root, harness.runtime);
    expect(
      findNode(
        tree,
        (node) => node.type === "button" && node.props?.children === "平台全量",
      )?.props?.["aria-pressed"],
      "新挂载的任务页应直接处于平台全量",
    ).toBe(true);
  });

  it("labels an avatar-assigned task with its owner so it is clear whose it is", async () => {
    // 平台管理员自己的分身（ownerAuthUserId === admin）承接了任务，工作区已加入。
    const fetchImpl = (input: string) => {
      if (input.startsWith("/api/collab/auth/me")) {
        return Promise.resolve(
          payload({ user: { id: "admin", name: "平台 Admin", role: "admin" } }),
        );
      }
      if (input.startsWith("/api/collab/team/workspaces")) {
        return Promise.resolve(
          payload({
            workspaces: [
              { id: "ws-1", title: "项目一", path: "/p1", isMember: true },
            ],
          }),
        );
      }
      if (input.startsWith("/api/collab/tasks/bootstrap")) {
        return Promise.resolve(
          payload({
            tasks: [
              makeTask({
                id: "TSK-AVATAR-1",
                workspaceId: "ws-1",
                title: "给出一个一句话的联调确认结论",
                status: "review",
                priority: "P2",
                receiverType: "agent",
                receiverId: "tm-x",
                receiverName: "小白 PD",
                createdBy: "admin",
                updatedAt: "2026-03-02T00:00:00.000Z",
              }),
            ],
            directory: {
              humans: [],
              agents: [
                {
                  id: "tm-x",
                  name: "小白 PD",
                  kind: "agent",
                  ownerName: "平台 Admin",
                  ownerAuthUserId: "admin",
                  source: "personal",
                  avatar: "",
                },
              ],
              roles: [],
            },
          }),
        );
      }
      return Promise.resolve(payload({}));
    };
    const harness = loadClientExports({ fetchImpl });
    const root = mountTaskPage(harness);
    const tree = await settle(root, harness.runtime);

    expect(
      titleNode(tree, "给出一个一句话的联调确认结论"),
      "我的分身承接的任务应出现在默认视图",
    ).toBeDefined();
    const assigneeName = findNode(
      tree,
      (node) =>
        node.type === "span" &&
        node.props?.className === "pmtask-assignee-name",
    );
    expect(
      assigneeName?.props?.children,
      "看板卡片应像详情页一样带上分身归属，避免看起来像别人的任务",
    ).toBe("小白 PD（平台 Admin）");
  });

  it("no longer offers the dispatch-to-my-avatar shortcut, reassign stays", async () => {
    const harness = loadClientExports({ fetchImpl: adminFetch });
    const root = mountTaskPage(harness);
    let tree = await settle(root, harness.runtime);

    const card = findNode(
      tree,
      (node) => node.props?.["data-task-id"] === "t-mine",
    );
    expect(card, "看板卡片应可打开详情").toBeDefined();
    (card?.props?.onClick as (() => void) | undefined)?.();
    tree = await settle(root, harness.runtime);

    expect(
      findNode(
        tree,
        (node) =>
          node.type === "button" && node.props?.children === "派我的分身执行",
      ),
      "「派我的分身执行」快捷按钮应已下线",
    ).toBeUndefined();
    expect(
      findNode(tree, (node) => node.props?.title === "调整责任人"),
      "改派入口应保留，用户通过它选择分身",
    ).toBeDefined();
  });

  it("shows the owner for a platform avatar matched by employee id", async () => {
    // 「Pluginmax DE」是平台型 teammate 实例，任务里存的还是员工身份 id
    // （pluginmax-de）。它挂在当前用户名下，所以「责任人=我」会命中它，
    // 卡片必须把归属写出来，否则看起来像别人的任务。
    const fetchImpl = (input: string) => {
      if (input.startsWith("/api/collab/auth/me")) {
        return Promise.resolve(
          payload({ user: { id: "admin", name: "平台 Admin", role: "admin" } }),
        );
      }
      if (input.startsWith("/api/collab/team/workspaces")) {
        return Promise.resolve(
          payload({
            workspaces: [
              { id: "ws-1", title: "项目一", path: "/p1", isMember: true },
            ],
          }),
        );
      }
      if (input.startsWith("/api/collab/tasks/bootstrap")) {
        return Promise.resolve(
          payload({
            tasks: [
              makeTask({
                id: "TSK-MUC9XLQ-7B6A",
                workspaceId: "ws-1",
                title: "subagent 会话终验",
                status: "progress",
                priority: "P1",
                receiverType: "agent",
                receiverId: "pluginmax-de",
                receiverName: "Pluginmax DE",
                createdBy: "admin",
                updatedAt: "2026-03-03T00:00:00.000Z",
              }),
            ],
            directory: {
              humans: [],
              agents: [
                {
                  id: "tm-842b0fc6-c4b3-43c2-a32f-24dd2d8d6bc5",
                  name: "Pluginmax DE",
                  kind: "agent",
                  employeeId: "pluginmax-de",
                  ownerName: "平台 Admin",
                  ownerAuthUserId: "admin",
                  source: "platform",
                  avatar: "",
                },
              ],
              roles: [],
            },
          }),
        );
      }
      return Promise.resolve(payload({}));
    };
    const harness = loadClientExports({ fetchImpl });
    const root = mountTaskPage(harness);
    const tree = await settle(root, harness.runtime);

    expect(
      titleNode(tree, "subagent 会话终验"),
      "我名下平台的执行身份承接的任务，默认视图应能看到",
    ).toBeDefined();
    const assigneeName = findNode(
      tree,
      (node) =>
        node.type === "span" &&
        node.props?.className === "pmtask-assignee-name",
    );
    expect(
      assigneeName?.props?.children,
      "平台型分身也要写出归属，列表才不会看起来混进了别人的任务",
    ).toBe("Pluginmax DE（平台 Admin）");
  });

  it("splits the receiver filter into 我（本人） and 我 + 我的分身", async () => {
    const fetchImpl = (input: string) => {
      if (input.startsWith("/api/collab/auth/me")) {
        return Promise.resolve(
          payload({ user: { id: "admin", name: "平台 Admin", role: "admin" } }),
        );
      }
      if (input.startsWith("/api/collab/team/workspaces")) {
        return Promise.resolve(
          payload({
            workspaces: [
              { id: "ws-1", title: "项目一", path: "/p1", isMember: true },
            ],
          }),
        );
      }
      if (input.startsWith("/api/collab/tasks/bootstrap")) {
        return Promise.resolve(
          payload({
            tasks: [
              makeTask({
                id: "TSK-MINE",
                workspaceId: "ws-1",
                title: "直接指派给我的任务",
                status: "todo",
                priority: "P2",
                receiverType: "human",
                receiverId: "admin",
                receiverName: "平台 Admin",
                createdBy: "someone",
                updatedAt: "2026-03-04T00:00:00.000Z",
              }),
              makeTask({
                id: "TSK-AVATAR",
                workspaceId: "ws-1",
                title: "我分身承接的任务",
                status: "todo",
                priority: "P2",
                receiverType: "agent",
                receiverId: "pluginmax-de",
                receiverName: "Pluginmax DE",
                createdBy: "admin",
                updatedAt: "2026-03-03T00:00:00.000Z",
              }),
            ],
            directory: {
              humans: [],
              agents: [
                {
                  id: "tm-842b0fc6-c4b3-43c2-a32f-24dd2d8d6bc5",
                  name: "Pluginmax DE",
                  kind: "agent",
                  employeeId: "pluginmax-de",
                  ownerName: "平台 Admin",
                  ownerAuthUserId: "admin",
                  source: "platform",
                  avatar: "",
                },
              ],
              roles: [],
            },
          }),
        );
      }
      return Promise.resolve(payload({}));
    };
    const harness = loadClientExports({ fetchImpl });
    const root = mountTaskPage(harness);
    let tree = await settle(root, harness.runtime);

    // 默认口径 = 我 + 我的分身：两条都在。
    expect(titleNode(tree, "直接指派给我的任务")).toBeDefined();
    expect(titleNode(tree, "我分身承接的任务")).toBeDefined();

    // 切到「我（本人）」：分身承接的那条必须消失。
    const receiverTrigger = findNode(
      tree,
      (node) => node.props?.["aria-label"] === "按责任人筛选任务",
    );
    (receiverTrigger?.props?.onClick as (() => void) | undefined)?.();
    tree = renderTree(root, harness.runtime);
    harness.runtime.runEffects();

    const selfOption = findNode(
      tree,
      (node) =>
        node.type === "button" &&
        node.props?.role === "option" &&
        containsText(node.props?.children, "我（本人）"),
    );
    expect(selfOption, "「我（本人）」选项应渲染").toBeDefined();
    (selfOption?.props?.onClick as (() => void) | undefined)?.();
    tree = await settle(root, harness.runtime);

    expect(titleNode(tree, "直接指派给我的任务")).toBeDefined();
    expect(
      titleNode(tree, "我分身承接的任务"),
      "「我（本人）」不应包含我分身承接的任务",
    ).toBeUndefined();
    expect(
      containsText(
        findNode(
          tree,
          (node) => node.props?.["aria-label"] === "按责任人筛选任务",
        )?.props?.children,
        "我（本人）",
      ),
      "筛选器应停在「我（本人）」",
    ).toBe(true);
    expect(
      findNode(
        tree,
        (node) =>
          typeof node.props?.children === "string" &&
          node.props.children.includes("另有 1 条由我的分身"),
      ),
      "本人口径下要提示还有分身承接的任务，避免验收列表看起来凭空消失",
    ).toBeDefined();
  });

  it("opens the task's agent session from the detail", async () => {
    const opened: string[] = [];
    const fetchImpl = (input: string) => {
      if (input.startsWith("/api/collab/auth/me")) {
        return Promise.resolve(
          payload({ user: { id: "admin", name: "平台 Admin", role: "admin" } }),
        );
      }
      if (input.startsWith("/api/collab/team/workspaces")) {
        return Promise.resolve(
          payload({
            workspaces: [
              { id: "ws-1", title: "项目一", path: "/p1", isMember: true },
            ],
          }),
        );
      }
      if (input.startsWith("/api/collab/tasks/bootstrap")) {
        return Promise.resolve(
          payload({
            tasks: [
              makeTask({
                id: "TSK-SESSION-1",
                workspaceId: "ws-1",
                title: "需要跳到执行会话的任务",
                status: "progress",
                priority: "P2",
                receiverType: "agent",
                receiverId: "pluginmax-de",
                receiverName: "Pluginmax DE",
                createdBy: "admin",
                updatedAt: "2026-03-05T00:00:00.000Z",
              }),
            ],
            directory: {
              humans: [],
              agents: [
                {
                  id: "tm-842b0fc6-c4b3-43c2-a32f-24dd2d8d6bc5",
                  name: "Pluginmax DE",
                  kind: "agent",
                  employeeId: "pluginmax-de",
                  ownerName: "平台 Admin",
                  ownerAuthUserId: "admin",
                  source: "platform",
                  avatar: "",
                },
              ],
              roles: [],
            },
          }),
        );
      }
      if (input.startsWith("/api/collab/tasks/session")) {
        return Promise.resolve(
          payload({ sessionId: "de-task-TSK-SESSION-1-pluginmax-de" }),
        );
      }
      return Promise.resolve(payload({}));
    };
    const harness = loadClientExports({
      fetchImpl,
      sessions: { open: (sessionId) => opened.push(sessionId) },
    });
    const root = mountTaskPage(harness);
    let tree = await settle(root, harness.runtime);

    const card = findNode(
      tree,
      (node) => node.props?.["data-task-id"] === "TSK-SESSION-1",
    );
    expect(card, "看板卡片应可打开详情").toBeDefined();
    (card?.props?.onClick as (() => void) | undefined)?.();
    tree = await settle(root, harness.runtime);

    const openButton = findNode(
      tree,
      (node) => node.type === "button" && node.props?.children === "打开会话",
    );
    expect(openButton, "详情页应提供打开执行会话的入口").toBeDefined();
    expect(
      openButton?.props?.className,
      "打开会话应为弱化文本入口",
    ).toBe("pmtask-detail-session-link");
    expect(
      findNode(
        openButton?.props?.children,
        (node) => node.type === "svg",
      ),
      "打开会话入口不应带图标",
    ).toBeUndefined();
    (openButton?.props?.onClick as (() => void) | undefined)?.();
    await settle(root, harness.runtime);

    expect(opened, "应切到任务对应的那条 Agent 会话").toEqual([
      "de-task-TSK-SESSION-1-pluginmax-de",
    ]);
    expect(harness.shellRoutes, "shell 应切到会话视图").toContain("session");
  });

  it("keeps the execution session reachable after handoff to the owner", async () => {
    const opened: string[] = [];
    const fetchImpl = (input: string) => {
      if (input.startsWith("/api/collab/auth/me")) {
        return Promise.resolve(
          payload({ user: { id: "admin", name: "平台 Admin", role: "admin" } }),
        );
      }
      if (input.startsWith("/api/collab/team/workspaces")) {
        return Promise.resolve(
          payload({
            workspaces: [
              { id: "ws-1", title: "项目一", path: "/p1", isMember: true },
            ],
          }),
        );
      }
      if (input.startsWith("/api/collab/tasks/bootstrap")) {
        return Promise.resolve(
          payload({
            tasks: [
              makeTask({
                id: "TSK-SESSION-HANDOFF",
                workspaceId: "ws-1",
                title: "Agent 完成后交回 owner",
                status: "review",
                priority: "P2",
                receiverType: "human",
                receiverId: "admin",
                receiverName: "平台 Admin",
                createdBy: "admin",
                agentRunIds: ["run-handoff"],
                updatedAt: "2026-03-05T00:00:00.000Z",
              }),
            ],
            directory: { humans: [], agents: [], roles: [] },
          }),
        );
      }
      if (input.startsWith("/api/collab/tasks/session")) {
        return Promise.resolve(
          payload({ sessionId: "de-task-TSK-SESSION-HANDOFF-agent" }),
        );
      }
      return Promise.resolve(payload({}));
    };
    const harness = loadClientExports({
      fetchImpl,
      sessions: { open: (sessionId) => opened.push(sessionId) },
    });
    const root = mountTaskPage(harness);
    let tree = await settle(root, harness.runtime);
    const card = findNode(
      tree,
      (node) => node.props?.["data-task-id"] === "TSK-SESSION-HANDOFF",
    );
    (card?.props?.onClick as (() => void) | undefined)?.();
    tree = await settle(root, harness.runtime);

    const openButton = findNode(
      tree,
      (node) => node.type === "button" && node.props?.children === "打开会话",
    );
    expect(
      openButton,
      "任务交回 owner 后仍应能打开产生过的 Agent 会话",
    ).toBeDefined();
    (openButton?.props?.onClick as (() => void) | undefined)?.();
    await settle(root, harness.runtime);
    expect(opened).toEqual(["de-task-TSK-SESSION-HANDOFF-agent"]);
  });

  it("requires claiming a role task before showing the start action", async () => {
    const claimedPaths: string[] = [];
    const fetchImpl = (input: string) => {
      if (input.startsWith("/api/collab/auth/me")) {
        return Promise.resolve(
          payload({
            user: { id: "member", name: "平台 Member", role: "member" },
          }),
        );
      }
      if (input.startsWith("/api/collab/team/workspaces")) {
        return Promise.resolve(
          payload({
            workspaces: [
              { id: "ws-1", title: "项目一", path: "/p1", isMember: true },
            ],
          }),
        );
      }
      if (input.startsWith("/api/collab/tasks/bootstrap")) {
        return Promise.resolve(
          payload({
            tasks: [
              makeTask({
                id: "TSK-ROLE-1",
                workspaceId: "ws-1",
                title: "角色待认领任务",
                status: "todo",
                priority: "P1",
                receiverType: "role",
                receiverId: "builder",
                receiverName: "Builder",
                createdBy: "admin",
                updatedAt: "2026-03-07T00:00:00.000Z",
              }),
            ],
            directory: {
              humans: [],
              agents: [],
              roles: [
                {
                  id: "builder",
                  name: "Builder",
                  assignedUserIds: ["member"],
                },
              ],
            },
          }),
        );
      }
      if (input.startsWith("/api/collab/tasks/claim")) {
        claimedPaths.push(input);
        return Promise.resolve(
          payload({
            task: makeTask({
              id: "TSK-ROLE-1",
              workspaceId: "ws-1",
              title: "角色待认领任务",
              status: "progress",
              priority: "P1",
              receiverType: "human",
              receiverId: "member",
              receiverName: "平台 Member",
              createdBy: "admin",
              updatedAt: "2026-03-07T00:01:00.000Z",
            }),
          }),
        );
      }
      return Promise.resolve(payload({}));
    };
    const harness = loadClientExports({ fetchImpl });
    const root = mountTaskPage(harness);
    let tree = await settle(root, harness.runtime);
    const card = findNode(
      tree,
      (node) => node.props?.["data-task-id"] === "TSK-ROLE-1",
    );
    (card?.props?.onClick as (() => void) | undefined)?.();
    tree = await settle(root, harness.runtime);

    const button = (label: string) =>
      findNode(
        tree,
        (node) => node.type === "button" && node.props?.children === label,
      );
    expect(button("认领"), "角色成员应能认领任务").toBeDefined();
    expect(
      button("开始"),
      "角色任务认领前不应提供绕过认领的开始入口",
    ).toBeUndefined();
    (button("认领")?.props?.onClick as (() => void) | undefined)?.();
    await settle(root, harness.runtime);
    expect(claimedPaths).toEqual(["/api/collab/tasks/claim"]);
  });

  it("explains comment semantics while scoping 催办 and session actions", async () => {
    const directory = {
      humans: [],
      agents: [
        {
          id: "tm-842b0fc6-c4b3-43c2-a32f-24dd2d8d6bc5",
          name: "Pluginmax DE",
          kind: "agent",
          employeeId: "pluginmax-de",
          ownerName: "平台 Admin",
          ownerAuthUserId: "admin",
          source: "platform",
          avatar: "",
        },
      ],
      roles: [],
    };
    const renderDetail = async (task: Record<string, unknown>) => {
      const fetchImpl = (input: string) => {
        if (input.startsWith("/api/collab/auth/me")) {
          return Promise.resolve(
            payload({
              user: { id: "admin", name: "平台 Admin", role: "admin" },
            }),
          );
        }
        if (input.startsWith("/api/collab/team/workspaces")) {
          return Promise.resolve(
            payload({
              workspaces: [
                { id: "ws-1", title: "项目一", path: "/p1", isMember: true },
              ],
            }),
          );
        }
        if (input.startsWith("/api/collab/tasks/bootstrap")) {
          return Promise.resolve(
            payload({ tasks: [makeTask(task)], directory }),
          );
        }
        return Promise.resolve(payload({}));
      };
      const harness = loadClientExports({ fetchImpl });
      const root = mountTaskPage(harness);
      const tree = await settle(root, harness.runtime);
      const card = findNode(
        tree,
        (node) => node.props?.["data-task-id"] === task.id,
      );
      (card?.props?.onClick as (() => void) | undefined)?.();
      return await settle(root, harness.runtime);
    };
    const button = (tree: unknown, label: string) =>
      findNode(
        tree,
        (node) => node.type === "button" && node.props?.children === label,
      );
    const commentPlaceholder = (tree: unknown) =>
      findNode(
        tree,
        (node) =>
          node.type === "input" &&
          String(node.props?.placeholder ?? "").startsWith("未 @ AI 伙伴"),
      )?.props?.placeholder;

    const humanTree = await renderDetail({
      id: "TSK-HUMAN-1",
      workspaceId: "ws-1",
      title: "指派给人的任务",
      status: "todo",
      priority: "P2",
      receiverType: "human",
      receiverId: "admin",
      receiverName: "平台 Admin",
      createdBy: "admin",
      updatedAt: "2026-03-07T00:00:00.000Z",
    });
    expect(button(humanTree, "催办"), "指派给人类的任务应有催办").toBeDefined();
    expect(button(humanTree, "重置会话"), "重置会话入口先隐藏").toBeUndefined();
    expect(commentPlaceholder(humanTree)).toBe(
      "未 @ AI 伙伴时仅记录；@ AI 伙伴会发起协作执行",
    );

    const agentTree = await renderDetail({
      id: "TSK-AGENT-1",
      workspaceId: "ws-1",
      title: "交给分身执行的任务",
      status: "progress",
      priority: "P2",
      receiverType: "agent",
      receiverId: "pluginmax-de",
      receiverName: "Pluginmax DE",
      createdBy: "admin",
      updatedAt: "2026-03-07T00:00:00.000Z",
      comments: [
        {
          id: "comment-1",
          at: "2026-03-07T00:00:00.000Z",
          authorId: "admin",
          authorName: "平台 Admin",
          kind: "human",
          content: "先记录一条讨论",
          replies: [],
        },
      ],
    });
    expect(
      button(agentTree, "催办"),
      "Agent 承接的任务不应有催办",
    ).toBeUndefined();
    expect(button(agentTree, "重置会话")).toBeUndefined();
    // 「人工回复」已下线：用户直接在下方输入框录入即可，避免按钮语义误解。
    expect(
      button(agentTree, "人工回复"),
      "人工回复按钮应已下线",
    ).toBeUndefined();
    expect(
      findNode(agentTree, (node) => node.type === "textarea"),
      "下方指令输入框应保留",
    ).toBeDefined();
    expect(
      button(agentTree, "发送"),
      "合并输入区应提供发送按钮",
    ).toBeDefined();
    expect(
      findNode(
        agentTree,
        (node) =>
          String(node.props?.className ?? "").includes(
            "pmtask-detail-intent active",
          ) && containsText(node.props?.children, "指令"),
      ),
      "AI 进行中任务默认选择指令",
    ).toBeDefined();
    expect(
      findNode(
        agentTree,
        (node) =>
          node.props?.className === "pmtask-detail-effect" &&
          containsText(
            node.props?.children,
            "将触发一次 Agent Run，并同步之前关键共识",
          ),
      ),
      "发送前应说明执行后果",
    ).toBeDefined();
    expect(commentPlaceholder(agentTree)).toBe(
      "未 @ AI 伙伴时仅记录；@ AI 伙伴会发起协作执行",
    );
    expect(
      findNode(
        agentTree,
        (node) =>
          node.props?.className ===
          "pmtask-reply-form pmtask-detail-inline-reply",
      ),
      "会话流中不应常驻评论回复输入框",
    ).toBeUndefined();

    const workflowTree = await renderDetail({
      id: "TSK-WORKFLOW-1",
      workspaceId: "ws-1",
      title: "工作流任务",
      status: "review",
      priority: "P2",
      receiverType: "human",
      receiverId: "admin",
      receiverName: "平台 Admin",
      createdBy: "admin",
      updatedAt: "2026-03-07T00:00:00.000Z",
      workflow: {
        instanceId: "wf-1",
        nodeId: "node-1",
        instanceTitle: "发布流程",
        nodeName: "人工发布",
      },
    });
    expect(commentPlaceholder(workflowTree)).toBe(
      "未 @ AI 伙伴时仅记录；@ AI 伙伴会发起协作执行",
    );
    const workflowIntentGroup = findNode(
      workflowTree,
      (node) =>
        node.props?.className === "pmtask-detail-intent-group workflow",
    );
    expect(workflowIntentGroup, "工作流任务使用独立讨论样式").toBeDefined();
    expect(
      findNodes(
        workflowIntentGroup,
        (node) =>
          node.type === "button" &&
          String(node.props?.className ?? "").includes(
            "pmtask-detail-intent",
          ),
      ).map((node) => {
        const children = Array.isArray(node.props?.children)
          ? node.props.children
          : [node.props?.children];
        return children.at(-1);
      }),
      "工作流任务只提供讨论，不出现指令切换",
    ).toEqual(["讨论"]);
    expect(
      findNode(
        workflowTree,
        (node) =>
          node.props?.className === "pmtask-detail-effect workflow" &&
          containsText(
            node.props?.children,
            "可讨论分析、准备材料；节点推进与提交请前往工作流节点。",
          ),
      ),
      "工作流讨论应说明分析边界和操作去向",
    ).toBeDefined();
    expect(
      findNode(
        workflowTree,
        (node) =>
          node.props?.className ===
            "pmtask-detail-message-badge workflow-task" &&
          node.props?.children === "工作流 · 节点任务",
      ),
      "工作流节点初始消息应使用工作流标签",
    ).toBeDefined();

    const workflowAgentTree = await renderDetail({
      id: "TSK-WORKFLOW-AGENT-1",
      workspaceId: "ws-1",
      title: "工作流 Agent 审批节点",
      status: "review",
      priority: "P2",
      receiverType: "agent",
      receiverId: "tm-842b0fc6-c4b3-43c2-a32f-24dd2d8d6bc5",
      receiverName: "Pluginmax DE",
      createdBy: "admin",
      updatedAt: "2026-03-07T00:00:00.000Z",
      workflow: {
        instanceId: "wf-1",
        nodeId: "node-approval",
        instanceTitle: "发布流程",
        nodeName: "人工审批",
        approvalPolicy: "any",
      },
    });
    expect(
      findNode(
        workflowAgentTree,
        (node) =>
          node.props?.className === "pmtask-detail-effect workflow" &&
          containsText(
            node.props?.children,
            "可分析方案、准备材料；审批与提交请前往工作流节点。",
          ),
      ),
      "审批节点讨论应明确审批和提交入口",
    ).toBeDefined();
  });

  it("records a key consensus tag without triggering task execution", async () => {
    const commentCalls: Array<{ path: string; body: unknown }> = [];
    const task = makeTask({
      id: "TSK-CONSENSUS-1",
      workspaceId: "ws-1",
      title: "关键共识录入",
      status: "progress",
      priority: "P2",
      receiverType: "human",
      receiverId: "admin",
      receiverName: "平台 Admin",
      createdBy: "admin",
      updatedAt: "2026-03-07T00:00:00.000Z",
    });
    const fetchImpl = (
      input: string,
      init?: unknown,
    ): Promise<{
      ok: boolean;
      status?: number;
      json: () => Promise<unknown>;
    }> => {
      if (input.startsWith("/api/collab/auth/me")) {
        return Promise.resolve(
          payload({ user: { id: "admin", name: "平台 Admin", role: "admin" } }),
        );
      }
      if (input.startsWith("/api/collab/team/workspaces")) {
        return Promise.resolve(
          payload({
            workspaces: [
              { id: "ws-1", title: "项目一", path: "/p1", isMember: true },
            ],
          }),
        );
      }
      if (input.startsWith("/api/collab/tasks/bootstrap")) {
        return Promise.resolve(
          payload({
            tasks: [task],
            directory: { humans: [], agents: [], roles: [] },
          }),
        );
      }
      if (input.startsWith("/api/collab/tasks/comment")) {
        const body = JSON.parse(
          String((init as { body?: unknown })?.body ?? "{}"),
        ) as { content: string; isKeyConsensus: boolean };
        commentCalls.push({ path: input, body });
        return Promise.resolve(
          payload({
            task: {
              ...task,
              comments: [
                {
                  id: "comment-consensus-1",
                  at: "2026-03-07T00:01:00.000Z",
                  authorId: "admin",
                  authorName: "平台 Admin",
                  kind: "human",
                  content: body.content,
                  isKeyConsensus: body.isKeyConsensus,
                  replies: [],
                },
              ],
              updatedAt: "2026-03-07T00:01:00.000Z",
            },
          }),
        );
      }
      return Promise.resolve(payload({}));
    };

    const harness = loadClientExports({ fetchImpl });
    const root = mountTaskPage(harness);
    let tree = await settle(root, harness.runtime);
    const card = findNode(
      tree,
      (node) => node.props?.["data-task-id"] === "TSK-CONSENSUS-1",
    );
    (card?.props?.onClick as (() => void) | undefined)?.();
    tree = await settle(root, harness.runtime);

    expect(
      containsText(tree, "将在下次向 Agent 发送执行反馈时作为背景增量同步"),
      "评论区应说明关键共识的增量同步时机",
    ).toBe(true);
    const consensusCheckbox = findNode(
      tree,
      (node) =>
        node.type === "input" &&
        node.props?.["aria-label"] === "标记为关键共识",
    );
    expect(consensusCheckbox).toBeDefined();
    const consensusCopy = findNode(
      tree,
      (node) => node.props?.className === "pmtask-comment-consensus-copy",
    );
    expect(
      findNode(
        consensusCopy,
        (node) =>
          node.type === "em" &&
          String(node.props?.children ?? "").startsWith("仅标记已经确认"),
      ),
      "关键共识说明应与标题在同一行布局容器中",
    ).toBeDefined();
    expect(
      readFileSync(CLIENT_PATH, "utf8"),
      "同一行说明使用可换行的 flex 布局",
    ).toContain(".pmtask-comment-consensus>span{display:flex;");
    expect(
      readFileSync(CLIENT_PATH, "utf8"),
      "说明占据标题后的剩余宽度并在本行内折行",
    ).toContain("flex:1 1 140px;");
    (
      consensusCheckbox?.props?.onChange as
        ((event: unknown) => void) | undefined
    )?.({
      target: { checked: true },
    });
    tree = await settle(root, harness.runtime);

    const commentInput = findNode(
      tree,
      (node) =>
        node.type === "input" &&
        String(node.props?.placeholder ?? "").startsWith("未 @ AI 伙伴"),
    );
    (commentInput?.props?.onChange as ((event: unknown) => void) | undefined)?.(
      {
        target: { value: "正文控制在 1000 字以内。" },
      },
    );
    tree = await settle(root, harness.runtime);

    const form = findNode(
      tree,
      (node) =>
        node.type === "form" &&
        String(node.props?.className ?? "").includes("pmtask-comment-form"),
    );
    expect(
      findNodes(
        form,
        (node) =>
          (node.type === "input" &&
            String(node.props?.placeholder ?? "").startsWith("未 @ AI 伙伴")) ||
          node.props?.className === "pmtask-check pmtask-comment-consensus",
      ).map((node) =>
        node.type === "input" ? "comment-input" : "key-consensus",
      ),
      "评论输入应在关键共识选项之前",
    ).toEqual(["comment-input", "key-consensus"]);
    (
      form?.props?.onSubmit as
        ((event: { preventDefault: () => void }) => void) | undefined
    )?.({ preventDefault: () => undefined });
    tree = await settle(root, harness.runtime);

    expect(commentCalls).toEqual([
      {
        path: "/api/collab/tasks/comment",
        body: {
          taskId: "TSK-CONSENSUS-1",
          content: "正文控制在 1000 字以内。",
          isKeyConsensus: true,
        },
      },
    ]);
    expect(
      findNode(
        tree,
        (node) =>
          node.type === "span" &&
          node.props?.className === "pmtask-pill consensus" &&
          node.props?.children === "关键共识",
      ),
      "关键共识评论应显示标签",
    ).toBeDefined();
    expect(
      findNode(
        tree,
        (node) =>
          node.type === "input" &&
          node.props?.["aria-label"] === "标记为关键共识",
      )?.props?.checked,
      "提交后应重置关键共识复选框",
    ).toBe(false);
  });

  it("folds cancelled tasks into the done column and drops the cancelled column", async () => {
    const fetchImpl = (input: string) => {
      if (input.startsWith("/api/collab/auth/me")) {
        return Promise.resolve(
          payload({ user: { id: "admin", name: "平台 Admin", role: "admin" } }),
        );
      }
      if (input.startsWith("/api/collab/team/workspaces")) {
        return Promise.resolve(
          payload({
            workspaces: [
              { id: "ws-1", title: "项目一", path: "/p1", isMember: true },
            ],
          }),
        );
      }
      if (input.startsWith("/api/collab/tasks/bootstrap")) {
        return Promise.resolve(
          payload({
            tasks: [
              makeTask({
                id: "TSK-DONE-1",
                workspaceId: "ws-1",
                title: "已完成的任务",
                status: "done",
                priority: "P2",
                receiverType: "human",
                receiverId: "admin",
                receiverName: "平台 Admin",
                createdBy: "admin",
                updatedAt: "2026-03-08T00:00:00.000Z",
              }),
              makeTask({
                id: "TSK-CANCELLED-1",
                workspaceId: "ws-1",
                title: "已取消的任务",
                status: "cancelled",
                priority: "P2",
                receiverType: "human",
                receiverId: "admin",
                receiverName: "平台 Admin",
                createdBy: "admin",
                updatedAt: "2026-03-07T00:00:00.000Z",
              }),
            ],
            directory: { humans: [], agents: [], roles: [] },
          }),
        );
      }
      return Promise.resolve(payload({}));
    };
    const harness = loadClientExports({ fetchImpl });
    const root = mountTaskPage(harness);
    const tree = await settle(root, harness.runtime);

    const doneColumn = findNode(
      tree,
      (node) =>
        node.type === "section" &&
        String(node.props?.className ?? "").includes("pmtask-column") &&
        containsText(node.props?.children, "已完成") &&
        containsText(node.props?.children, "已完成的任务") &&
        containsText(node.props?.children, "已取消的任务"),
    );
    expect(doneColumn, "已取消的历史任务应并入「已完成」列").toBeDefined();
    expect(
      findNode(
        tree,
        (node) => node.type === "strong" && node.props?.children === "已取消",
      ),
      "不应再有「已取消」状态列",
    ).toBeUndefined();
    expect(
      findNode(
        tree,
        (node) =>
          node.type === "span" &&
          node.props?.className === "pmtask-pill cancelled",
      ),
      "已取消任务卡片应有标记",
    ).toBeDefined();
  });

  it("allows cancelled workflow tasks to be archived while keeping other actions locked", async () => {
    const actionCalls: Array<{ path: string; body: unknown }> = [];
    const task = makeTask({
      id: "TSK-CANCELLED-WORKFLOW-1",
      workspaceId: "ws-1",
      title: "工作流取消的任务",
      status: "cancelled",
      priority: "P2",
      receiverType: "human",
      receiverId: "admin",
      receiverName: "平台 Admin",
      createdBy: "admin",
      updatedAt: "2026-03-07T00:00:00.000Z",
      workflow: {
        instanceId: "wf-1",
        nodeId: "node-1",
        instanceTitle: "发布流程",
        nodeName: "人工发布",
        outcome: "cancelled",
      },
    });
    const fetchImpl = (
      input: string,
      init?: unknown,
    ): Promise<{
      ok: boolean;
      status?: number;
      json: () => Promise<unknown>;
    }> => {
      if (input.startsWith("/api/collab/auth/me")) {
        return Promise.resolve(
          payload({ user: { id: "admin", name: "平台 Admin", role: "admin" } }),
        );
      }
      if (input.startsWith("/api/collab/team/workspaces")) {
        return Promise.resolve(
          payload({
            workspaces: [
              { id: "ws-1", title: "项目一", path: "/p1", isMember: true },
            ],
          }),
        );
      }
      if (input.startsWith("/api/collab/tasks/bootstrap")) {
        return Promise.resolve(
          payload({
            tasks: [task],
            directory: { humans: [], agents: [], roles: [] },
          }),
        );
      }
      if (input.startsWith("/api/collab/tasks/action")) {
        actionCalls.push({
          path: input,
          body: JSON.parse(String((init as { body?: unknown })?.body ?? "{}")),
        });
        return Promise.resolve(
          payload({
            task: {
              ...task,
              archivedAt: "2026-03-07T01:00:00.000Z",
              updatedAt: "2026-03-07T01:00:00.000Z",
            },
          }),
        );
      }
      return Promise.resolve(payload({}));
    };

    const harness = loadClientExports({ fetchImpl });
    const root = mountTaskPage(harness);
    let tree = await settle(root, harness.runtime);
    const card = findNode(
      tree,
      (node) => node.props?.["data-task-id"] === "TSK-CANCELLED-WORKFLOW-1",
    );
    (card?.props?.onClick as (() => void) | undefined)?.();
    tree = await settle(root, harness.runtime);

    const archiveButton = findNode(
      tree,
      (node) => node.type === "button" && node.props?.children === "归档",
    );
    expect(archiveButton, "已取消的工作流任务应提供归档入口").toBeDefined();
    expect(archiveButton?.props?.disabled).not.toBe(true);
    expect(
      findNode(
        tree,
        (node) =>
          node.type === "input" &&
          node.props?.placeholder === "任务已取消，评论已锁定",
      )?.props?.disabled,
      "取消态仍应锁定评论等其他写操作",
    ).toBe(true);

    (archiveButton?.props?.onClick as (() => void) | undefined)?.();
    tree = await settle(root, harness.runtime);
    const confirmButton = findNode(
      tree,
      (node) => node.type === "button" && node.props?.children === "确认归档",
    );
    expect(confirmButton, "归档前应要求确认").toBeDefined();
    (confirmButton?.props?.onClick as (() => void) | undefined)?.();
    await settle(root, harness.runtime);

    expect(actionCalls).toEqual([
      {
        path: "/api/collab/tasks/action",
        body: {
          taskId: "TSK-CANCELLED-WORKFLOW-1",
          action: "archive",
        },
      },
    ]);
  });

  it("keeps all four board columns inside the desktop pane", () => {
    // 宽屏下四列必须等分可用宽度；只有窄于最小可读宽度时，
    // 才切换成固定列宽并交给看板自身横向滚动。
    const source = readFileSync(CLIENT_PATH, "utf8");
    expect(source).toContain("container-type:inline-size");
    expect(source).toContain("grid-template-columns:repeat(4,minmax(0,1fr))");
    expect(source).toContain("@container (max-width:900px)");
    expect(source).toContain("grid-template-columns:repeat(4,220px)");
    expect(source).not.toContain("grid-auto-columns:260px");
  });

  it("keeps the draft and create actions on shared header button styles", () => {
    const source = readFileSync(CLIENT_PATH, "utf8");
    expect(source).toContain('className: "pmtask-btn pmtask-create-task"');
    expect(source).toContain('"aria-label": "新建任务"');
    expect(source).toContain(".pmtask-btn.secondary:hover");
    expect(source).toContain(
      ".pmtask-btn-count{min-width:18px;height:18px;",
    );
  });

  it("lets users define the phase-one execution policy when creating a task", () => {
    const source = readFileSync(CLIENT_PATH, "utf8");
    expect(source).toContain("允许公开网页与监管文件");
    expect(source).toContain("写文件、执行命令和外部发布前需要人工确认");
    expect(source).toContain("executionPolicy: buildExecutionPolicy(form)");
    expect(source).toContain("本轮模型");
    expect(source).toContain("推理强度");
    expect(source).toContain("沿用 Runtime 默认模型");
    expect(source).toContain("supportedModels");
    expect(source).toContain("reasoningEffort");
    expect(source).toContain("/api/collab/agent/external-runtimes");
    expect(source).toContain("执行运行时");
    expect(source).toContain('"aria-readonly": "true"');
    expect(source).not.toContain("value: form.runtimeId");
    expect(source).not.toContain("沿用责任人运行时 / 平台推荐");
    expect(source).toContain("requiredCapabilities: []");
    expect(source).not.toContain(
      'requiredCapabilities: allowPublicWeb ? [{ key: "search"',
    );
    expect(source).toContain("searchEnabled");
    expect(source).toContain("searchUsed");
  });

  it("keeps newly created agent tasks visible after review handoff", () => {
    const source = readFileSync(CLIENT_PATH, "utf8");
    expect(source).toContain('setOwnership("sent");');
    expect(source).toContain('setReceiver("all");');
    expect(source).not.toContain("receiverFilterKey(task)");
  });

  it("summarizes execution activity without technical preamble", () => {
    const source = readFileSync(CLIENT_PATH, "utf8");
    expect(source).toContain('structured: "结构化"');
    expect(source).toContain('summary: "摘要"');
    expect(source).not.toContain("planSourceLabel");
    expect(source).not.toContain("selectedPlan.summary");
    expect(source).not.toContain("pmtask-gate observe-only");
    expect(source).toContain('"observe-only": "仅执行后观察"');
    expect(source).toContain("function groupedExecutionActivities");
    expect(source).toContain("查看原始事件（");
    expect(source).toContain(
      "max-height:165px;overflow-y:auto;overscroll-behavior:contain;",
    );
    expect(source).toContain("executionControl.events.slice(-200)");
    expect(source).not.toContain(
      "仅执行后观察：Runtime 只能记录已执行动作，无法事前阻断。",
    );
    expect(source).not.toContain("不能把它展示为已成功拦截");
  });

  it("shows the owning project and never offers to change it", async () => {
    const fetchImpl = (input: string) => {
      if (input.startsWith("/api/collab/auth/me")) {
        return Promise.resolve(
          payload({ user: { id: "admin", name: "平台 Admin", role: "admin" } }),
        );
      }
      if (input.startsWith("/api/collab/team/workspaces")) {
        return Promise.resolve(
          payload({
            workspaces: [
              { id: "ws-1", title: "项目一", path: "/p1", isMember: true },
            ],
          }),
        );
      }
      if (input.startsWith("/api/collab/tasks/bootstrap")) {
        return Promise.resolve(
          payload({
            tasks: [
              makeTask({
                id: "TSK-PROJECT-1",
                workspaceId: "ws-1",
                title: "归属项目只读展示",
                status: "todo",
                priority: "P2",
                receiverType: "human",
                receiverId: "admin",
                receiverName: "平台 Admin",
                createdBy: "admin",
                executionPolicy: {
                  runtime: {
                    selection: "recommended",
                    allowedRuntimeIds: [],
                    model: "deepseek-flash",
                    reasoningEffort: "high",
                  },
                },
                updatedAt: "2026-03-06T00:00:00.000Z",
              }),
            ],
            directory: { humans: [], agents: [], roles: [] },
          }),
        );
      }
      return Promise.resolve(payload({}));
    };
    const harness = loadClientExports({ fetchImpl });
    const root = mountTaskPage(harness);
    let tree = await settle(root, harness.runtime);

    const card = findNode(
      tree,
      (node) => node.props?.["data-task-id"] === "TSK-PROJECT-1",
    );
    (card?.props?.onClick as (() => void) | undefined)?.();
    tree = await settle(root, harness.runtime);

    // 详情页展示归属项目（用项目标题，不是 id）。
    expect(
      findNode(
        tree,
        (node) =>
          node.type === "div" &&
          node.props?.className === "pmtask-detail-info" &&
          containsText(node.props?.children, "归属项目") &&
          containsText(node.props?.children, "项目一"),
      ),
      "详情页应展示任务归属的项目",
    ).toBeDefined();
    const readOnlyBasicBody = findNode(
      tree,
      (node) =>
        node.props?.["data-detail-tab"] === "basic" &&
        node.props?.className === "pmtask-detail-tab-body",
    );
    const readOnlyBasicChildren = Array.isArray(
      readOnlyBasicBody?.props?.children,
    )
      ? readOnlyBasicBody.props.children
      : [readOnlyBasicBody?.props?.children];
    expect(
      (readOnlyBasicChildren.at(-1) as TreeNode | undefined)?.props?.className,
      "基础信息编辑入口应位于内容区右下方",
    ).toBe("pmtask-detail-basic-toolbar");

    // 顶部编辑只覆盖标题和描述，左栏会话与下方页签不会参与这次编辑。
    const editButton = findNode(
      tree,
      (node) =>
        node.type === "button" &&
        node.props?.["aria-label"] === "编辑任务名称和描述",
    );
    expect(editButton, "详情页顶部应有内容编辑入口").toBeDefined();
    (editButton?.props?.onClick as (() => void) | undefined)?.();
    tree = await settle(root, harness.runtime);

    const contentEditor = findNode(
      tree,
      (node) =>
        node.type === "form" &&
        node.props?.className === "pmtask-content-editor",
    );
    expect(contentEditor, "顶部编辑应替换右侧信息面板").toBeDefined();
    expect(
      findNode(
        contentEditor?.props?.children,
        (node) =>
          node.type === "label" &&
          containsText(node.props?.children, "标题"),
      ),
      "顶部编辑应包含标题",
    ).toBeDefined();
    expect(
      findNode(
        contentEditor?.props?.children,
        (node) =>
          node.type === "label" &&
          containsText(node.props?.children, "描述"),
      ),
      "顶部编辑应包含描述",
    ).toBeDefined();
    for (const hiddenField of ["归属项目", "优先级", "验收标准", "执行策略"]) {
      expect(
        containsText(contentEditor?.props?.children, hiddenField),
        `顶部编辑不应包含下方基础信息字段：${hiddenField}`,
      ).toBe(false);
    }
    expect(
      findNode(
        tree,
        (node) => node.props?.className === "pmtask-detail-tabs",
      ),
      "顶部编辑时应隐藏下方页签",
    ).toBeUndefined();
    expect(
      findNode(
        tree,
        (node) =>
          node.props?.className ===
          "pmtask-detail-section pmtask-detail-conversation",
      ),
      "顶部编辑不应替换左栏任务会话",
    ).toBeDefined();

    const cancelContentEdit = findNode(
      contentEditor?.props?.children,
      (node) => node.type === "button" && node.props?.children === "取消",
    );
    (cancelContentEdit?.props?.onClick as (() => void) | undefined)?.();
    tree = await settle(root, harness.runtime);

    // 基础信息页签拥有独立编辑入口，负责人也只在这里切换。
    expect(
      findNode(
        tree,
        (node) =>
          node.type === "select" && node.props?.value === "human:admin",
      ),
      "只读基础信息不应提供负责人切换",
    ).toBeUndefined();
    const basicEditButton = findNode(
      tree,
      (node) =>
        node.type === "button" &&
        node.props?.children === "编辑" &&
        String(node.props?.className ?? "") === "",
    );
    expect(basicEditButton, "基础信息页签应有编辑入口").toBeDefined();
    (basicEditButton?.props?.onClick as (() => void) | undefined)?.();
    tree = await settle(root, harness.runtime);

    const basicEditor = findNode(
      tree,
      (node) =>
        node.type === "form" && node.props?.className === "pmtask-basic-editor",
    );
    expect(basicEditor, "基础信息应切换为独立编辑态").toBeDefined();
    const basicEditorGrid = findNode(
      basicEditor,
      (node) => node.props?.className === "pmtask-basic-edit-grid",
    );
    const basicEditorFields = Array.isArray(basicEditorGrid?.props?.children)
      ? (basicEditorGrid?.props?.children as unknown[])
      : [];
    const basicFieldPosition = (text: string) =>
      basicEditorFields.findIndex((field) => containsText(field, text));
    expect(basicFieldPosition("优先级")).toBe(
      basicFieldPosition("负责人") + 1,
    );
    expect(
      findNode(
        basicEditorFields[basicFieldPosition("负责人")],
        (node) =>
          node.type === "label" &&
          node.props?.className === "pmtask-field" &&
          containsText(node.props?.children, "负责人"),
      ),
      "负责人字段应占半宽并位于优先级左侧",
    ).toBeDefined();
    expect(
      findNode(
        basicEditor,
        (node) =>
          node.props?.className ===
            "pmtask-field pmtask-basic-edit-wide" &&
          containsText(node.props?.children, "执行策略"),
      ),
      "人类负责人不应展示执行策略配置",
    ).toBeUndefined();
    expect(
      findNode(
        basicEditor?.props?.children,
        (node) => node.type === "button" && node.props?.children === "保存",
      ),
      "基础信息保存按钮文案应为“保存”",
    ).toBeDefined();
    const reviewSettings = findNode(
      basicEditor?.props?.children,
      (node) =>
        node.props?.className === "pmtask-field pmtask-basic-edit-wide" &&
        containsText(node.props?.children, "Review 设置"),
    );
    expect(reviewSettings, "两项 Review 配置应有统一分组标题").toBeDefined();
    expect(
      containsText(reviewSettings?.props?.children, "完成后自动提交 Review"),
    ).toBe(true);
    expect(
      containsText(reviewSettings?.props?.children, "Review 自动通过"),
    ).toBe(true);
    expect(
      containsText(
        reviewSettings?.props?.children,
        "关闭后，执行完成仍保留在进行中。",
      ),
      "完成后自动提交 Review 不再展示副说明",
    ).toBe(false);
    expect(
      containsText(
        reviewSettings?.props?.children,
        "（仅普通工作流执行任务可配置；审批任务须人工结论）",
      ),
      "Review 自动通过的说明应与标题同行",
    ).toBe(true);
    expect(
      findNode(
        basicEditor?.props?.children,
        (node) => node.props?.className === "pmtask-execution-overrides",
      ),
      "责任人不是 AI伙伴时不应展示运行时设置",
    ).toBeUndefined();
    expect(
      findNode(
        basicEditor?.props?.children,
        (node) =>
          String(node.props?.className ?? "")
            .split(/\s+/)
            .includes("pmtask-field") &&
          containsText(node.props?.children, "任务状态"),
      ),
      "基础信息编辑态也不重复展示任务状态",
    ).toBeUndefined();
    expect(
      findNodes(
        basicEditor?.props?.children,
        (node) => node.type === "select",
      ).map((node) => node.props?.value),
      "人类责任人的基础信息编辑不应出现模型和推理强度",
    ).toEqual(["human:admin", "P2"]);
    const ownerSelect = findNode(
      basicEditor?.props?.children,
      (node) =>
        node.type === "select" &&
        node.props?.value === "human:admin",
    );
    expect(ownerSelect, "负责人选择器只在基础信息编辑态出现").toBeDefined();
    expect(
      findNode(
        tree,
        (node) => node.props?.className === "pmtask-detail-tabs",
      ),
      "基础信息编辑不应影响其他页签",
    ).toBeDefined();
    expect(
      findNode(
        tree,
        (node) =>
          node.props?.className === "pmtask-readonly-value" &&
          containsText(node.props?.children, "不可变更") &&
          containsText(node.props?.children, "项目一"),
      ),
      "基础信息编辑态应只读展示归属项目并说明不可变更",
    ).toBeDefined();
    expect(
      findNode(
        basicEditor?.props?.children,
        (node) =>
          node.type === "select" &&
          containsText(node.props?.children, "项目一"),
      ),
      "基础信息编辑表单里不应出现可切换的项目选项",
    ).toBeUndefined();
  });

  it("opens the task modal with seeded selection content", async () => {
    const fetchImpl = (input: string) => {
      if (input.startsWith("/api/collab/auth/me")) {
        return Promise.resolve(
          payload({ user: { id: "admin", name: "平台 Admin", role: "admin" } }),
        );
      }
      if (input.startsWith("/api/collab/team/workspaces")) {
        return Promise.resolve(
          payload({
            workspaces: [
              { id: "ws-1", title: "项目一", path: "/p1", isMember: true },
            ],
          }),
        );
      }
      if (input.startsWith("/api/collab/tasks/bootstrap")) {
        return Promise.resolve(
          payload({
            tasks: [],
            directory: {
              humans: [
                {
                  id: "admin",
                  name: "平台 Admin",
                  kind: "human",
                  avatar: "",
                },
              ],
              agents: [],
              roles: [],
            },
          }),
        );
      }
      return Promise.resolve(payload({}));
    };
    const harness = loadClientExports({ fetchImpl });
    const root = mountTaskPage(harness);
    let tree = await settle(root, harness.runtime);
    (
      harness.window.dispatchEvent as (
        event: { type: string; detail?: unknown },
      ) => boolean
    )({
      type: "pluginmax:task-create-open",
      detail: {
        workspaceId: "ws-1",
        title: "核查支付失败原因",
        description: "按渠道拆解支付失败、取消和履约超时的订单。",
        priority: "P2",
      },
    });
    tree = await settle(root, harness.runtime);
    const modal = findNode(
      tree,
      (node) => node.type === "form" && node.props?.className === "pmtask-modal",
    );
    expect(modal, "选文创建任务应直接打开正式任务弹窗").toBeDefined();
    expect(
      findNode(
        modal,
        (node) =>
          node.type === "input" && node.props?.value === "核查支付失败原因",
      ),
    ).toBeDefined();
    expect(
      findNode(
        modal,
        (node) =>
          node.type === "textarea" &&
          node.props?.value === "按渠道拆解支付失败、取消和履约超时的订单。",
      ),
    ).toBeDefined();
    const upload = findNode(
      modal,
      (node) =>
        node.type === "input" &&
        node.props?.type === "file" &&
        node.props?.["aria-label"] === "上传任务描述附件",
    );
    expect(upload, "任务描述应支持附件上传").toBeDefined();
    const file = {
      name: "需求资料.md",
      size: 128,
      type: "text/markdown",
      lastModified: 1,
    };
    (upload?.props?.onChange as ((event: unknown) => void) | undefined)?.({
      target: { files: [file], value: "" },
    });
    tree = await settle(root, harness.runtime);
    expect(containsText(tree, "需求资料.md")).toBe(true);
    const source = readFileSync(CLIENT_PATH, "utf8");
    expect(source).toContain(".pmtask-mask{position:absolute;inset:0;");
    expect(source).toContain(".pmtask-modal{position:fixed;left:50%;top:50%;");
    expect(source).toContain("max-height:min(720px,calc(100dvh - 24px))");
    expect(source).toContain("contentBase64: await readFileAsBase64(file)");
  });

  it("searches one prerequisite task by title, id, or receiver", async () => {
    const createBodies: Array<Record<string, unknown>> = [];
    const prerequisite = makeTask({
      id: "TSK-BLOCKER-1",
      workspaceId: "ws-1",
      title: "确认供应商交期",
      status: "progress",
      priority: "P2",
      receiverType: "human",
      receiverId: "worker-b",
      receiverName: "负责人乙",
      createdBy: "admin",
      updatedAt: "2026-03-08T00:00:00.000Z",
    });
    const fetchImpl = (input: string, init?: unknown) => {
      if (input.startsWith("/api/collab/auth/me")) {
        return Promise.resolve(
          payload({ user: { id: "admin", name: "平台 Admin", role: "admin" } }),
        );
      }
      if (input.startsWith("/api/collab/team/workspaces")) {
        return Promise.resolve(
          payload({
            workspaces: [
              { id: "ws-1", title: "项目一", path: "/p1", isMember: true },
            ],
          }),
        );
      }
      if (input.startsWith("/api/collab/tasks/bootstrap")) {
        return Promise.resolve(
          payload({
            tasks: [prerequisite],
            directory: {
              humans: [
                {
                  id: "admin",
                  name: "平台 Admin",
                  kind: "human",
                  avatar: "",
                },
              ],
              agents: [],
              roles: [],
            },
          }),
        );
      }
      if (input.startsWith("/api/collab/tasks/create")) {
        const body = JSON.parse(
          String((init as { body?: string } | undefined)?.body ?? "{}"),
        ) as Record<string, unknown>;
        createBodies.push(body);
        return Promise.resolve(
          payload({
            task: makeTask({
              id: "TSK-DEPENDENT",
              workspaceId: "ws-1",
              title: body.title,
              status: "todo",
              priority: body.priority,
              receiverType: body.receiverType,
              receiverId: body.receiverId,
              receiverName: body.receiverName,
              description: body.description,
              createdBy: "admin",
              dependsOn: body.dependsOn,
              updatedAt: "2026-03-08T00:00:00.000Z",
            }),
          }),
        );
      }
      return Promise.resolve(payload({}));
    };
    const harness = loadClientExports({ fetchImpl });
    const root = mountTaskPage(harness);
    let tree = await settle(root, harness.runtime);
    const createButton = findNode(
      tree,
      (node) =>
        node.type === "button" && node.props?.["aria-label"] === "新建任务",
    );
    (createButton?.props?.onClick as (() => void) | undefined)?.();
    tree = await settle(root, harness.runtime);
    const search = findNode(
      tree,
      (node) =>
        node.type === "input" &&
        node.props?.["aria-label"] === "搜索前置任务",
    );
    (
      search?.props?.onChange as
        | ((event: { target: { value: string } }) => void)
        | undefined
    )?.({ target: { value: "负责人乙" } });
    tree = await settle(root, harness.runtime);
    const option = findNode(
      tree,
      (node) =>
        node.type === "button" &&
        node.props?.className === "pmtask-dependency-option" &&
        containsText(node.props?.children, "TSK-BLOCKER-1"),
    );
    expect(option).toBeDefined();
    (option?.props?.onClick as (() => void) | undefined)?.();
    tree = await settle(root, harness.runtime);
    expect(
      findNode(
        tree,
        (node) =>
          node.props?.className === "pmtask-dependency-selected" &&
          containsText(node.props?.children, "确认供应商交期"),
      ),
    ).toBeDefined();
    const modal = findNode(
      tree,
      (node) => node.type === "form" && node.props?.className === "pmtask-modal",
    );
    const titleInput = findNode(
      modal,
      (node) => node.type === "input" && node.props?.required === true,
    );
    (
      titleInput?.props?.onChange as
        | ((event: { target: { value: string } }) => void)
        | undefined
    )?.({ target: { value: "创建后续任务" } });
    const description = findNode(
      modal,
      (node) => node.type === "textarea" && node.props?.required === true,
    );
    (
      description?.props?.onChange as
        | ((event: { target: { value: string } }) => void)
        | undefined
    )?.({ target: { value: "前置任务完成后开始执行" } });
    tree = await settle(root, harness.runtime);
    const refreshedModal = findNode(
      tree,
      (node) => node.type === "form" && node.props?.className === "pmtask-modal",
    );
    await (
      refreshedModal?.props?.onSubmit as
        | ((event: unknown) => Promise<void>)
        | undefined
    )?.({ preventDefault: () => undefined });
    expect(createBodies[0]?.dependsOn).toEqual(["TSK-BLOCKER-1"]);
  });

  it("shows runtime overrides only for AI teammates in the create dialog", async () => {
    const directory = {
      humans: [
        {
          id: "human-1",
          name: "平台 Admin",
          kind: "human",
          authUserId: "admin",
        },
      ],
      agents: [
        {
          id: "agent-builtin",
          name: "内置执行伙伴",
          kind: "agent",
          execution: "builtin",
          ownerName: "平台 Admin",
          ownerAuthUserId: "admin",
        },
        {
          id: "agent-external",
          name: "外部执行伙伴",
          kind: "agent",
          execution: "external",
          externalRuntimeId: "runtime-codex",
          ownerName: "平台 Admin",
          ownerAuthUserId: "admin",
        },
      ],
      roles: [],
    };
    const fetchImpl = (input: string) => {
      if (input.startsWith("/api/collab/auth/me")) {
        return Promise.resolve(
          payload({ user: { id: "admin", name: "平台 Admin", role: "admin" } }),
        );
      }
      if (input.startsWith("/api/collab/team/workspaces")) {
        return Promise.resolve(
          payload({
            workspaces: [
              { id: "ws-1", title: "项目一", path: "/p1", isMember: true },
            ],
          }),
        );
      }
      if (input.startsWith("/api/collab/tasks/bootstrap")) {
        return Promise.resolve(payload({ tasks: [], directory }));
      }
      if (input.startsWith("/api/collab/agent/external-runtimes")) {
        return Promise.resolve(
          payload({
            runtimes: [
              {
                id: "runtime-codex",
                name: "Codex CLI",
                provider: "codex",
                status: "active",
                supportedModels: [
                  "deepseek-v4-flash",
                  "deepseek-v4-pro",
                  "deepseek-flash",
                ],
                defaultModel: "deepseek-v4-flash",
              },
            ],
            defaultModel: {
              provider: "deepseek-official",
              model: "deepseek-v4-flash",
              reasoningEffort: "medium",
            },
          }),
        );
      }
      return Promise.resolve(payload({}));
    };
    const harness = loadClientExports({ fetchImpl });
    const root = mountTaskPage(harness);
    let tree = await settle(root, harness.runtime);
    const createButton = findNode(
      tree,
      (node) =>
        node.type === "button" && node.props?.["aria-label"] === "新建任务",
    );
    (createButton?.props?.onClick as (() => void) | undefined)?.();
    tree = await settle(root, harness.runtime);

    let modal = findNode(
      tree,
      (node) => node.type === "form" && node.props?.className === "pmtask-modal",
    );
    expect(
      findNode(
        modal,
        (node) => node.props?.className === "pmtask-execution-overrides",
      ),
      "人类责任人不应展示运行时设置",
    ).toBeUndefined();
    const receiverField = findNode(
      modal,
      (node) =>
        node.type === "label" &&
        Array.isArray(node.props?.children) &&
        node.props.children[0] === "责任人",
    );
    const receiverSelect = findNode(
      receiverField,
      (node) => node.type === "select",
    );
    (
      receiverSelect?.props?.onChange as
        | ((event: { target: { value: string } }) => void)
        | undefined
    )?.({ target: { value: "agent:agent-builtin" } });
    tree = await settle(root, harness.runtime);
    modal = findNode(
      tree,
      (node) => node.type === "form" && node.props?.className === "pmtask-modal",
    );

    const modalGrid = findNode(
      modal,
      (node) => node.props?.className === "pmtask-modal-grid",
    );
    const flattenFields = (value: unknown): unknown[] => {
      if (Array.isArray(value)) return value.flatMap(flattenFields);
      if (
        value !== null &&
        typeof value === "object" &&
        (value as TreeNode).type === "react.fragment"
      ) {
        return flattenFields((value as TreeNode).props?.children);
      }
      return [value];
    };
    const modalFields = flattenFields(modalGrid?.props?.children);
    const fieldPosition = (text: string) =>
      modalFields.findIndex((field) => containsText(field, text));
    expect(fieldPosition("到期时间")).toBeLessThan(
      fieldPosition("责任人"),
    );
    expect(fieldPosition("前置任务")).toBeGreaterThan(
      fieldPosition("责任人"),
    );
    expect(fieldPosition("执行运行时")).toBeGreaterThan(
      fieldPosition("前置任务"),
    );
    expect(fieldPosition("Review 设置")).toBeGreaterThan(
      fieldPosition("执行运行时"),
    );
    expect(fieldPosition("执行策略")).toBeGreaterThan(
      fieldPosition("Review 设置"),
    );
    const reviewSettings = findNode(
      modal,
      (node) =>
        node.props?.className === "pmtask-field pmtask-span-2" &&
        containsText(node.props?.children, "Review 设置"),
    );
    expect(
      containsText(reviewSettings?.props?.children, "完成后自动提交 Review"),
    ).toBe(true);
    expect(
      containsText(reviewSettings?.props?.children, "Review 自动通过"),
    ).toBe(true);

    const builtinRuntime = findNode(
      modal,
      (node) => node.props?.className === "pmtask-execution-overrides",
    );
    expect(containsText(builtinRuntime, "内置执行")).toBe(true);
    const builtinModel = findNode(
      builtinRuntime,
      (node) =>
        node.type === "select" && node.props?.["aria-label"] === "本轮模型",
    );
    const builtinReasoning = findNode(
      builtinRuntime,
      (node) =>
        node.type === "select" && node.props?.["aria-label"] === "推理强度",
    );
    expect(builtinModel?.props?.value).toBe("");
    expect(
      containsText(builtinModel?.props?.children, "DeepSeek V4 Flash（默认）"),
    ).toBe(true);
    expect(builtinReasoning?.props?.disabled).not.toBe(true);
    for (const hint of [
      "来自 AI伙伴定义",
      "该 Runtime 尚未声明模型池",
      "只有外部 Runtime 任务可以指定推理强度",
      "将映射为 Codex",
    ]) {
      expect(containsText(modal, hint), `运行时说明文案应移除：${hint}`).toBe(
        false,
      );
    }

    const currentReceiverSelect = findNode(
      findNode(
        modal,
        (node) =>
          node.type === "label" &&
          Array.isArray(node.props?.children) &&
          node.props.children[0] === "责任人",
      ),
      (node) => node.type === "select",
    );
    (
      currentReceiverSelect?.props?.onChange as
        | ((event: { target: { value: string } }) => void)
        | undefined
    )?.({ target: { value: "agent:agent-external" } });
    tree = await settle(root, harness.runtime);
    modal = findNode(
      tree,
      (node) => node.type === "form" && node.props?.className === "pmtask-modal",
    );
    const externalRuntime = findNode(
      modal,
      (node) => node.props?.className === "pmtask-execution-overrides",
    );
    expect(containsText(externalRuntime, "Codex CLI")).toBe(true);
    const externalModel = findNode(
      externalRuntime,
      (node) =>
        node.type === "select" && node.props?.["aria-label"] === "本轮模型",
    );
    expect(externalModel?.props?.disabled).not.toBe(true);
    for (const model of [
      "DeepSeek V4 Flash（默认）",
      "DeepSeek V4 Pro",
      "DeepSeek Flash",
    ]) {
      expect(containsText(externalModel, model)).toBe(true);
    }
  });

  it("places editable runtime overrides directly after an AI teammate owner", async () => {
    const updateBodies: Record<string, unknown>[] = [];
    const directory = {
      humans: [],
      agents: [
        {
          id: "agent-builtin",
          name: "内置执行伙伴",
          kind: "agent",
          execution: "builtin",
          ownerName: "平台 Admin",
          ownerAuthUserId: "admin",
        },
      ],
      roles: [],
    };
    const fetchImpl = (input: string, init?: unknown) => {
      if (input.startsWith("/api/collab/auth/me")) {
        return Promise.resolve(
          payload({ user: { id: "admin", name: "平台 Admin", role: "admin" } }),
        );
      }
      if (input.startsWith("/api/collab/team/workspaces")) {
        return Promise.resolve(
          payload({
            workspaces: [
              { id: "ws-1", title: "项目一", path: "/p1", isMember: true },
            ],
          }),
        );
      }
      if (input.startsWith("/api/collab/tasks/bootstrap")) {
        return Promise.resolve(
          payload({
            tasks: [
              makeTask({
                id: "TSK-AGENT-RUNTIME",
                workspaceId: "ws-1",
                title: "AI伙伴运行时编辑",
                status: "progress",
                priority: "P2",
                receiverType: "agent",
                receiverId: "agent-builtin",
                receiverName: "内置执行伙伴",
                createdBy: "admin",
                executionPolicy: {
                  runtime: {
                    selection: "recommended",
                    allowedRuntimeIds: [],
                    model: "deepseek-flash",
                    reasoningEffort: "high",
                  },
                },
                updatedAt: "2026-03-08T00:00:00.000Z",
              }),
            ],
            directory,
          }),
        );
      }
      if (input.startsWith("/api/collab/tasks/update")) {
        const body = (init as { body?: string } | undefined)?.body;
        updateBodies.push(
          JSON.parse(body ?? "{}") as Record<string, unknown>,
        );
        return Promise.resolve(payload({}));
      }
      return Promise.resolve(payload({}));
    };
    const harness = loadClientExports({ fetchImpl });
    const root = mountTaskPage(harness);
    let tree = await settle(root, harness.runtime);
    const card = findNode(
      tree,
      (node) => node.props?.["data-task-id"] === "TSK-AGENT-RUNTIME",
    );
    (card?.props?.onClick as (() => void) | undefined)?.();
    tree = await settle(root, harness.runtime);
    const basicTab = findNode(
      tree,
      (node) => node.type === "button" && node.props?.children === "基础信息",
    );
    (basicTab?.props?.onClick as (() => void) | undefined)?.();
    tree = await settle(root, harness.runtime);
    const editButton = findNode(
      tree,
      (node) =>
        node.type === "button" &&
        node.props?.children === "编辑" &&
        String(node.props?.className ?? "") === "",
    );
    (editButton?.props?.onClick as (() => void) | undefined)?.();
    tree = await settle(root, harness.runtime);

    const basicEditor = findNode(
      tree,
      (node) =>
        node.type === "form" && node.props?.className === "pmtask-basic-editor",
    );
    const editorGrid = findNode(
      basicEditor,
      (node) => node.props?.className === "pmtask-basic-edit-grid",
    );
    const editorFields = Array.isArray(editorGrid?.props?.children)
      ? (editorGrid?.props?.children as unknown[])
      : [];
    const fieldPosition = (text: string) =>
      editorFields.findIndex((field) => containsText(field, text));
    expect(fieldPosition("优先级")).toBe(
      fieldPosition("负责人") + 1,
    );
    expect(fieldPosition("执行运行时")).toBeGreaterThan(
      fieldPosition("优先级"),
    );
    expect(fieldPosition("执行策略")).toBeGreaterThan(
      fieldPosition("执行运行时"),
    );
    const runtimeFields = findNode(
      basicEditor,
      (node) => node.props?.className === "pmtask-execution-overrides",
    );
    const modelEditor = findNode(
      runtimeFields,
      (node) =>
        node.type === "input" && node.props?.["aria-label"] === "本轮模型",
    );
    const reasoningEditor = findNode(
      runtimeFields,
      (node) =>
        node.type === "select" && node.props?.["aria-label"] === "推理强度",
    );
    expect(modelEditor?.props?.value).toBe("deepseek-flash");
    expect(modelEditor?.props?.disabled).not.toBe(true);
    expect(reasoningEditor?.props?.value).toBe("high");
    expect(reasoningEditor?.props?.disabled).not.toBe(true);

    (modelEditor?.props?.onChange as ((event: unknown) => void) | undefined)?.({
      target: { value: "model-next" },
    });
    (
      reasoningEditor?.props?.onChange as
        | ((event: unknown) => void)
        | undefined
    )?.({ target: { value: "medium" } });
    tree = await settle(root, harness.runtime);
    const editedBasicEditor = findNode(
      tree,
      (node) =>
        node.type === "form" && node.props?.className === "pmtask-basic-editor",
    );
    await (
      editedBasicEditor?.props?.onSubmit as
        | ((event: unknown) => Promise<void>)
        | undefined
    )?.({ preventDefault: () => undefined });
    expect(updateBodies).toHaveLength(1);
    expect(updateBodies[0]).toMatchObject({
      taskId: "TSK-AGENT-RUNTIME",
      executionPolicy: {
        runtime: {
          model: "model-next",
          reasoningEffort: "medium",
        },
      },
    });
  });

  it("defaults detail tabs and status actions by receiver type", async () => {
    const directory = {
      humans: [],
      agents: [
        {
          id: "agent-1",
          name: "执行分身",
          kind: "agent",
          ownerName: "平台 Admin",
          ownerAuthUserId: "admin",
          source: "personal",
          avatar: "",
        },
      ],
      roles: [
        {
          id: "role-1",
          name: "项目执行角色",
          kind: "role",
          assignedUserIds: ["admin"],
        },
      ],
    };
    const tasks = [
      makeTask({
        id: "TSK-UI-HUMAN",
        workspaceId: "ws-1",
        title: "人类待处理",
        status: "todo",
        priority: "P2",
        receiverType: "human",
        receiverId: "admin",
        receiverName: "平台 Admin",
        createdBy: "someone",
        updatedAt: "2026-03-08T00:00:00.000Z",
      }),
      makeTask({
        id: "TSK-UI-AGENT",
        workspaceId: "ws-1",
        title: "AI 待处理",
        status: "todo",
        priority: "P2",
        receiverType: "agent",
        receiverId: "agent-1",
        receiverName: "执行分身",
        createdBy: "admin",
        updatedAt: "2026-03-08T00:00:01.000Z",
      }),
      makeTask({
        id: "TSK-UI-ROLE",
        workspaceId: "ws-1",
        title: "角色待认领",
        status: "todo",
        priority: "P2",
        receiverType: "role",
        receiverId: "role-1",
        receiverName: "项目执行角色",
        createdBy: "someone",
        updatedAt: "2026-03-08T00:00:02.000Z",
      }),
      makeTask({
        id: "TSK-UI-WORKFLOW",
        workspaceId: "ws-1",
        title: "工作流审批",
        status: "review",
        priority: "P2",
        receiverType: "human",
        receiverId: "admin",
        receiverName: "平台 Admin",
        createdBy: "someone",
        workflow: {
          instanceId: "wf-1",
          nodeId: "node-1",
          instanceTitle: "审批流",
          nodeName: "人工审批",
          approvalPolicy: "any",
        },
        links: [
          {
            type: "workflow",
            id: "wf-1",
            label: "审批流",
          },
        ],
        updatedAt: "2026-03-08T00:00:03.000Z",
      }),
      makeTask({
        id: "TSK-UI-PROGRESS",
        workspaceId: "ws-1",
        title: "进行中任务",
        status: "progress",
        priority: "P2",
        receiverType: "human",
        receiverId: "admin",
        receiverName: "平台 Admin",
        createdBy: "admin",
        updatedAt: "2026-03-08T00:00:04.000Z",
      }),
      makeTask({
        id: "TSK-UI-REVIEW",
        workspaceId: "ws-1",
        title: "待验收任务",
        status: "review",
        priority: "P2",
        receiverType: "human",
        receiverId: "admin",
        receiverName: "平台 Admin",
        createdBy: "admin",
        updatedAt: "2026-03-08T00:00:05.000Z",
      }),
      makeTask({
        id: "TSK-UI-DONE",
        workspaceId: "ws-1",
        title: "已完成任务",
        status: "done",
        priority: "P2",
        receiverType: "human",
        receiverId: "admin",
        receiverName: "平台 Admin",
        createdBy: "admin",
        updatedAt: "2026-03-08T00:00:06.000Z",
      }),
      makeTask({
        id: "TSK-UI-CANCELLED",
        workspaceId: "ws-1",
        title: "已取消任务",
        status: "cancelled",
        priority: "P2",
        receiverType: "human",
        receiverId: "admin",
        receiverName: "平台 Admin",
        createdBy: "admin",
        updatedAt: "2026-03-08T00:00:07.000Z",
      }),
    ];
    const fetchImpl = (input: string) => {
      if (input.startsWith("/api/collab/auth/me")) {
        return Promise.resolve(
          payload({ user: { id: "admin", name: "平台 Admin", role: "admin" } }),
        );
      }
      if (input.startsWith("/api/collab/team/workspaces")) {
        return Promise.resolve(
          payload({
            workspaces: [
              { id: "ws-1", title: "项目一", path: "/p1", isMember: true },
            ],
          }),
        );
      }
      if (input.startsWith("/api/collab/tasks/bootstrap")) {
        return Promise.resolve(
          payload({
            tasks,
            directory,
            reviewableTaskIds: ["TSK-UI-WORKFLOW", "TSK-UI-REVIEW"],
          }),
        );
      }
      return Promise.resolve(payload({}));
    };
    const actionNode = (tree: unknown, label: string) =>
      findNode(
        tree,
        (node) =>
          node.type === "button" &&
          String(node.props?.className ?? "").startsWith(
            "pmtask-detail-action ",
          ) &&
          containsText(node.props?.children, label),
      );
    const selectedTab = (tree: unknown) =>
      findNode(
        tree,
        (node) =>
          node.type === "button" &&
          node.props?.role === "tab" &&
          node.props?.["aria-selected"] === true,
      )?.props?.children;
    const renderDetail = async (taskId: string) => {
      const harness = loadClientExports({ fetchImpl });
      const root = mountTaskPage(harness);
      let tree = await settle(root, harness.runtime);
      const card = findNode(
        tree,
        (node) => node.props?.["data-task-id"] === taskId,
      );
      (card?.props?.onClick as (() => void) | undefined)?.();
      tree = await settle(root, harness.runtime);
      return tree;
    };

    const human = await renderDetail("TSK-UI-HUMAN");
    expect(selectedTab(human)).toBe("基础信息");
    const startAction = actionNode(human, "开始");
    expect(startAction).toBeDefined();
    expect(
      findNode(startAction?.props?.children, (node) => node.type === "svg"),
      "详情状态操作仅展示文本，不带图标",
    ).toBeUndefined();
    expect(actionNode(human, "认领")).toBeUndefined();

    const agent = await renderDetail("TSK-UI-AGENT");
    expect(selectedTab(agent)).toBe("AI执行记录");
    expect(actionNode(agent, "开始")).toBeUndefined();

    const role = await renderDetail("TSK-UI-ROLE");
    expect(selectedTab(role)).toBe("基础信息");
    expect(actionNode(role, "认领")).toBeDefined();

    const workflow = await renderDetail("TSK-UI-WORKFLOW");
    expect(selectedTab(workflow)).toBe("基础信息");
    expect(actionNode(workflow, "打开工作流节点")).toBeDefined();
    expect(actionNode(workflow, "通过审批")).toBeDefined();
    expect(actionNode(workflow, "退回审批")).toBeDefined();

    const progress = await renderDetail("TSK-UI-PROGRESS");
    expect(actionNode(progress, "提交验收")).toBeDefined();
    expect(actionNode(progress, "取消任务")).toBeDefined();

    const review = await renderDetail("TSK-UI-REVIEW");
    expect(actionNode(review, "通过")).toBeDefined();
    expect(actionNode(review, "退回")).toBeDefined();
    expect(actionNode(review, "取消任务")).toBeDefined();

    const done = await renderDetail("TSK-UI-DONE");
    expect(actionNode(done, "归档")).toBeDefined();
    expect(actionNode(done, "取消任务")).toBeUndefined();
    const doneComposer = findNode(
      done,
      (node) => node.props?.className === "pmtask-composer disabled",
    );
    expect(doneComposer, "已完成任务应保留但禁用对话框").toBeDefined();
    expect(doneComposer?.props?.["aria-disabled"]).toBe(true);
    expect(
      findNode(
        doneComposer,
        (node) => node.props?.className === "pmtask-composer-input",
      )?.props,
    ).toMatchObject({ disabled: true, readOnly: true });

    const cancelled = await renderDetail("TSK-UI-CANCELLED");
    const cancelledComposer = findNode(
      cancelled,
      (node) => node.props?.className === "pmtask-composer disabled",
    );
    expect(cancelledComposer, "已取消任务应保留但禁用对话框").toBeDefined();
    expect(
      findNode(
        cancelledComposer,
        (node) => node.props?.className === "pmtask-composer-input",
      )?.props?.disabled,
    ).toBe(true);
    const source = readFileSync(CLIENT_PATH, "utf8");
    expect(source).toContain(
      "const composerLocked = archived || isSettledStatus(task.status);",
    );
  });

  it("aligns the current user's messages right and labels them 我", async () => {
    const task = makeTask({
      id: "TSK-UI-CHAT",
      workspaceId: "ws-1",
      title: "会话对齐",
      status: "progress",
      priority: "P2",
      receiverType: "human",
      receiverId: "admin",
      receiverName: "平台 Admin",
      createdBy: "admin",
      description: "请按客户确认口径完成本轮复核。",
      messages: [
        {
          id: "msg-mine",
          at: "2026-03-08T01:00:00.000Z",
          authorId: "admin",
          authorName: "平台 Admin",
          kind: "human",
          content: "我的消息",
          attachments: [],
          mentions: [],
        },
        {
          id: "msg-other",
          at: "2026-03-08T01:01:00.000Z",
          authorId: "other",
          authorName: "其他成员",
          kind: "human",
          content: "他人的消息",
          attachments: [],
          mentions: [],
        },
        {
          id: "msg-agent",
          at: "2026-03-08T01:02:00.000Z",
          authorId: "agent-1",
          authorName: "执行分身",
          kind: "agent",
          content: "Agent 消息",
          attachments: [],
          mentions: [],
        },
      ],
      updatedAt: "2026-03-08T01:02:00.000Z",
    });
    const fetchImpl = (input: string) => {
      if (input.startsWith("/api/collab/auth/me")) {
        return Promise.resolve(
          payload({ user: { id: "admin", name: "平台 Admin", role: "admin" } }),
        );
      }
      if (input.startsWith("/api/collab/team/workspaces")) {
        return Promise.resolve(
          payload({
            workspaces: [
              { id: "ws-1", title: "项目一", path: "/p1", isMember: true },
            ],
          }),
        );
      }
      if (input.startsWith("/api/collab/tasks/bootstrap")) {
        return Promise.resolve(payload({ tasks: [task], directory: {
          humans: [],
          agents: [],
          roles: [],
        } }));
      }
      return Promise.resolve(payload({}));
    };
    const harness = loadClientExports({ fetchImpl });
    const root = mountTaskPage(harness);
    let tree = await settle(root, harness.runtime);
    const card = findNode(
      tree,
      (node) => node.props?.["data-task-id"] === "TSK-UI-CHAT",
    );
    (card?.props?.onClick as (() => void) | undefined)?.();
    tree = await settle(root, harness.runtime);

    const mine = findNode(
      tree,
      (node) =>
        String(node.props?.className ?? "").includes(
          "pmtask-history-message is-mine",
        ) &&
        containsText(node.props?.children, "我的消息"),
    );
    expect(mine, "当前用户消息应靠右").toBeDefined();
    expect(containsText(mine?.props?.children, "我")).toBe(true);
    const initialRequest = findNode(
      tree,
      (node) =>
        String(node.props?.className ?? "").includes(
          "pmtask-history-message is-mine",
        ) &&
        containsText(
          node.props?.children,
          "请按客户确认口径完成本轮复核。",
        ),
    );
    expect(
      initialRequest,
      "任务要求应作为创建人的普通首条消息展示",
    ).toBeDefined();
    expect(
      findNode(
        tree,
        (node) =>
          node.props?.className === "pmtask-intro" &&
          node.props?.hidden === true,
      ),
      "任务要求不应再渲染为独立卡片",
    ).toBeDefined();
    expect(
      findNode(
        tree,
        (node) =>
          String(node.props?.className ?? "").includes(
            "pmtask-history-message is-mine",
          ) &&
          containsText(node.props?.children, "他人的消息"),
      ),
      "他人消息不应靠右",
    ).toBeUndefined();
  });

  it("deduplicates output documents by name and keeps the latest run", async () => {
    const task = makeTask({
      id: "TSK-UI-DOC",
      workspaceId: "ws-1",
      title: "产出文档",
      status: "progress",
      priority: "P2",
      receiverType: "human",
      receiverId: "admin",
      receiverName: "平台 Admin",
      createdBy: "admin",
      agentRunIds: ["run-1", "run-2"],
      updatedAt: "2026-03-08T02:00:00.000Z",
    });
    const fetchImpl = (input: string) => {
      if (input.startsWith("/api/collab/auth/me")) {
        return Promise.resolve(
          payload({ user: { id: "admin", name: "平台 Admin", role: "admin" } }),
        );
      }
      if (input.startsWith("/api/collab/team/workspaces")) {
        return Promise.resolve(
          payload({
            workspaces: [
              { id: "ws-1", title: "项目一", path: "/p1", isMember: true },
            ],
          }),
        );
      }
      if (input.startsWith("/api/collab/tasks/bootstrap")) {
        return Promise.resolve(payload({ tasks: [task], directory: {
          humans: [],
          agents: [],
          roles: [],
        } }));
      }
      if (input.startsWith("/api/collab/agent/runs?")) {
        return Promise.resolve(
          payload({
            runs: [
              {
                id: "run-1",
                status: "succeeded",
                createdAt: "2026-03-08T01:00:00.000Z",
                payload: { profileName: "旧产出" },
              },
              {
                id: "run-2",
                status: "succeeded",
                createdAt: "2026-03-08T01:30:00.000Z",
                payload: { profileName: "新产出" },
              },
            ],
          }),
        );
      }
      if (
        input.startsWith("/api/collab/agent/runs/detail") ||
        input.startsWith("/api/collab/agent/execution/detail")
      ) {
        return Promise.resolve(payload({ run: null, execution: null }));
      }
      if (input.startsWith("/api/collab/tasks/documents")) {
        return Promise.resolve(
          payload({
            workspaceReady: true,
            documents: [
              {
                id: "doc-old",
                runId: "run-1",
                kind: "produced",
                name: "report.md",
                relativePath: "outputs/run-1/report.md",
                updatedBy: "旧产出",
                updatedAt: "2026-03-08T01:00:00.000Z",
                available: true,
              },
              {
                id: "doc-new",
                runId: "run-2",
                kind: "produced",
                name: "report.md",
                relativePath: "outputs/run-2/report.md",
                updatedBy: "新产出",
                updatedAt: "2026-03-08T01:30:00.000Z",
                available: true,
              },
              {
                id: "doc-upload",
                runId: "run-1",
                kind: "uploaded",
                name: "案例原文.pdf",
                relativePath: "uploads/案例原文.pdf",
                updatedBy: "周宁",
                updatedAt: "2026-03-08T00:30:00.000Z",
                available: true,
              },
            ],
          }),
        );
      }
      return Promise.resolve(payload({}));
    };
    const harness = loadClientExports({ fetchImpl });
    const root = mountTaskPage(harness);
    let tree = await settle(root, harness.runtime);
    const card = findNode(
      tree,
      (node) => node.props?.["data-task-id"] === "TSK-UI-DOC",
    );
    (card?.props?.onClick as (() => void) | undefined)?.();
    tree = await settle(root, harness.runtime);
    const documentsTab = findNode(
      tree,
      (node) =>
        node.type === "button" &&
        node.props?.children === "产出文档",
    );
    (documentsTab?.props?.onClick as (() => void) | undefined)?.();
    tree = await settle(root, harness.runtime);

    const docs = findNodes(
      tree,
      (node) => node.props?.className === "pmtask-detail-doc",
    );
    expect(docs).toHaveLength(2);
    const producedDoc = findNode(
      docs,
      (node) => containsText(node.props?.children, "report.md"),
    );
    expect(containsText(producedDoc?.props?.children, "新产出")).toBe(true);
    expect(containsText(producedDoc?.props?.children, "第 2 轮")).toBe(true);
    expect(containsText(producedDoc?.props?.children, "run-2")).toBe(true);
    expect(containsText(producedDoc?.props?.children, "v2")).toBe(true);
    expect(
      findNode(
        producedDoc,
        (node) => node.props?.className === "pmtask-doc-kind",
      ),
      "文件标题旁只保留版本标签，不显示产出或上传标记",
    ).toBeUndefined();
    expect(containsText(tree, "产出文档")).toBe(true);
    expect(containsText(tree, "上传附件")).toBe(true);
    expect(containsText(tree, "案例原文.pdf")).toBe(true);
    expect(containsText(tree, "第 1 轮")).toBe(true);
    expect(containsText(tree, "run-1")).toBe(true);
    expect(containsText(tree, "已合并 2 个旧版本")).toBe(false);
  });

  it("keeps mention intent local and sends follow-up answers through the existing message chain", async () => {
    const requests: Array<{ url: string; body: Record<string, unknown> }> = [];
    const task = makeTask({
      id: "TSK-UI-FOLLOW",
      workspaceId: "ws-1",
      title: "Follow-up",
      status: "progress",
      priority: "P2",
      receiverType: "agent",
      receiverId: "agent-1",
      receiverName: "执行分身",
      createdBy: "admin",
      needsInput: true,
      messages: [
        {
          id: "msg-waiting",
          at: "2026-03-08T03:00:00.000Z",
          authorId: "agent-1",
          authorName: "执行分身",
          kind: "agent",
          content: "请确认使用哪个供应商？",
          attachments: [],
          mentions: [],
          state: "waiting_input",
        },
      ],
      updatedAt: "2026-03-08T03:00:00.000Z",
    });
    const fetchImpl = (
      input: string,
      init?: unknown,
    ): Promise<{ ok: boolean; status?: number; json: () => Promise<unknown> }> => {
      if (input.startsWith("/api/collab/auth/me")) {
        return Promise.resolve(
          payload({ user: { id: "admin", name: "平台 Admin", role: "admin" } }),
        );
      }
      if (input.startsWith("/api/collab/team/workspaces")) {
        return Promise.resolve(
          payload({
            workspaces: [
              { id: "ws-1", title: "项目一", path: "/p1", isMember: true },
            ],
          }),
        );
      }
      if (input.startsWith("/api/collab/tasks/bootstrap")) {
        return Promise.resolve(payload({
          tasks: [task],
          directory: {
            humans: [
              {
                id: "other",
                name: "其他成员",
                kind: "human",
                avatar: "",
              },
            ],
            agents: [
              {
                id: "agent-1",
                name: "执行分身",
                kind: "agent",
                ownerName: "平台 Admin",
                ownerAuthUserId: "admin",
                source: "personal",
                avatar: "",
              },
            ],
            roles: [],
          },
        }));
      }
      if (input.startsWith("/api/collab/tasks/message")) {
        const requestInit = init as { body?: string } | undefined;
        requests.push({
          url: input,
          body: JSON.parse(String(requestInit?.body ?? "{}")) as Record<
            string,
            unknown
          >,
        });
      }
      return Promise.resolve(payload({}));
    };
    const harness = loadClientExports({ fetchImpl });
    const root = mountTaskPage(harness);
    let tree = await settle(root, harness.runtime);
    const receiverFilter = findNode(
      tree,
      (node) =>
        node.type === "button" &&
        node.props?.["aria-label"] === "按责任人筛选任务",
    );
    (receiverFilter?.props?.onClick as (() => void) | undefined)?.();
    tree = await settle(root, harness.runtime);
    const allReceivers = findNode(
      tree,
      (node) =>
        node.type === "button" &&
        node.props?.className === "pmtask-filter-option" &&
        containsText(node.props?.children, "全部"),
    );
    (allReceivers?.props?.onClick as (() => void) | undefined)?.();
    tree = await settle(root, harness.runtime);
    const card = findNode(
      tree,
      (node) => node.props?.["data-task-id"] === "TSK-UI-FOLLOW",
    );
    (card?.props?.onClick as (() => void) | undefined)?.();
    tree = await settle(root, harness.runtime);

    const mentionButton = findNode(
      tree,
      (node) =>
        node.type === "button" &&
        node.props?.className === "pmtask-tool-btn" &&
        node.props?.children === "@",
    );
    (mentionButton?.props?.onClick as (() => void) | undefined)?.();
    tree = await settle(root, harness.runtime);
    expect(
      findNode(
        tree,
        (node) =>
          node.type === "button" &&
          node.props?.className === "pmtask-mention-item" &&
          containsText(node.props?.children, "执行分身"),
      ),
      "任务责任 AI 伙伴应可提及",
    ).toBeDefined();
    const mentionItem = findNode(
      tree,
      (node) =>
        node.type === "button" &&
        node.props?.className === "pmtask-mention-item" &&
        containsText(node.props?.children, "其他成员"),
    );
    (mentionItem?.props?.onClick as (() => void) | undefined)?.();
    tree = await settle(root, harness.runtime);

    expect(
      findNode(
        tree,
        (node) =>
          node.props?.className === "pmtask-detail-sync-chip" &&
          containsText(node.props?.children, "其他成员"),
      ),
      "提及目标应进入同步区域",
    ).toBeDefined();
    const sendButton = findNode(
      tree,
      (node) => node.type === "button" && node.props?.children === "发送",
    );
    (sendButton?.props?.onClick as (() => void) | undefined)?.();
    tree = await settle(root, harness.runtime);

    expect(requests).toHaveLength(1);
    expect(requests[0]?.body.content).toContain("@其他成员");
    const mentions = requests[0]?.body.mentions as Array<
      Record<string, unknown>
    >;
    expect(mentions[0]).toMatchObject({
      kind: "human",
      id: "other",
      name: "其他成员",
    });
    expect(mentions[0]).not.toHaveProperty("intent");
  });

  it("only enables instruction mode for the human task receiver", async () => {
    const task = makeTask({
      id: "TSK-COMMAND-HUMAN",
      workspaceId: "ws-1",
      title: "人类任务指挥权限",
      status: "progress",
      priority: "P2",
      receiverType: "human",
      receiverId: "worker",
      receiverName: "任务负责人",
      createdBy: "admin",
      updatedAt: "2026-03-08T03:00:00.000Z",
    });
    const treeFor = async (userId: string, userName: string) => {
      const fetchImpl = (input: string) => {
        if (input.startsWith("/api/collab/auth/me")) {
          return Promise.resolve(
            payload({ user: { id: userId, name: userName, role: "member" } }),
          );
        }
        if (input.startsWith("/api/collab/team/workspaces")) {
          return Promise.resolve(
            payload({
              workspaces: [
                { id: "ws-1", title: "项目一", path: "/p1", isMember: true },
              ],
            }),
          );
        }
        if (input.startsWith("/api/collab/tasks/bootstrap")) {
          return Promise.resolve(
            payload({
              tasks: [task],
              directory: {
                humans: [
                  {
                    id: "worker",
                    name: "任务负责人",
                    kind: "human",
                    avatar: "",
                  },
                ],
                agents: [],
                roles: [],
              },
            }),
          );
        }
        return Promise.resolve(payload({}));
      };
      const harness = loadClientExports({ fetchImpl });
      const root = mountTaskPage(harness);
      let tree = await settle(root, harness.runtime);
      const receiverFilter = findNode(
        tree,
        (node) =>
          node.type === "button" &&
          node.props?.["aria-label"] === "按责任人筛选任务",
      );
      (receiverFilter?.props?.onClick as (() => void) | undefined)?.();
      tree = await settle(root, harness.runtime);
      const allReceivers = findNode(
        tree,
        (node) =>
          node.type === "button" &&
          node.props?.className === "pmtask-filter-option" &&
          containsText(node.props?.children, "全部"),
      );
      (allReceivers?.props?.onClick as (() => void) | undefined)?.();
      tree = await settle(root, harness.runtime);
      const card = findNode(
        tree,
        (node) => node.props?.["data-task-id"] === task.id,
      );
      (card?.props?.onClick as (() => void) | undefined)?.();
      return settle(root, harness.runtime);
    };

    const outsiderTree = await treeFor("admin", "平台 Admin");
    const outsiderInstruction = findNode(
      outsiderTree,
      (node) =>
        node.type === "button" &&
        String(node.props?.className ?? "")
          .split(/\s+/)
          .includes("pmtask-detail-intent") &&
        containsText(node.props?.children, "指令"),
    );
    expect(outsiderInstruction?.props?.disabled).toBe(true);
    expect(outsiderInstruction?.props?.title).toBe(
      "只有任务负责人可以发起指令",
    );
    expect(
      findNode(
        outsiderTree,
        (node) =>
          node.type === "button" &&
          String(node.props?.className ?? "").includes("active") &&
          containsText(node.props?.children, "讨论"),
      ),
      "非负责人应默认且只能使用讨论模式",
    ).toBeDefined();

    const receiverTree = await treeFor("worker", "任务负责人");
    const receiverInstruction = findNode(
      receiverTree,
      (node) =>
        node.type === "button" &&
        String(node.props?.className ?? "")
          .split(/\s+/)
          .includes("pmtask-detail-intent") &&
        containsText(node.props?.children, "指令"),
    );
    expect(receiverInstruction?.props?.disabled).not.toBe(true);
  });

  it("keeps general instructions owner-only while explicit mentions can drive another AI", async () => {
    const requests: Array<{ url: string; body: Record<string, unknown> }> = [];
    const task = makeTask({
      id: "TSK-COMMAND-AI",
      workspaceId: "ws-1",
      title: "AI任务指挥权限",
      status: "progress",
      priority: "P2",
      receiverType: "agent",
      receiverId: "tm-responsible",
      receiverName: "责任 AI",
      createdBy: "admin",
      updatedAt: "2026-03-08T03:00:00.000Z",
    });
    const treeFor = async (userId: string, userName: string) => {
      const fetchImpl = (input: string, init?: unknown) => {
        if (input.startsWith("/api/collab/auth/me")) {
          return Promise.resolve(
            payload({ user: { id: userId, name: userName, role: "member" } }),
          );
        }
        if (input.startsWith("/api/collab/team/workspaces")) {
          return Promise.resolve(
            payload({
              workspaces: [
                { id: "ws-1", title: "项目一", path: "/p1", isMember: true },
              ],
            }),
          );
        }
        if (input.startsWith("/api/collab/tasks/bootstrap")) {
          return Promise.resolve(
            payload({
              tasks: [task],
              directory: {
                humans: [],
                agents: [
                  {
                    id: "tm-responsible",
                    name: "责任 AI",
                    kind: "agent",
                    ownerName: "负责人",
                    ownerAuthUserId: "worker",
                    source: "personal",
                    avatar: "",
                  },
                  {
                    id: "tm-other",
                    name: "其他 AI",
                    kind: "agent",
                    ownerName: "其他人",
                    ownerAuthUserId: "other",
                    source: "personal",
                    avatar: "",
                  },
                ],
                roles: [],
              },
            }),
          );
        }
        if (input.startsWith("/api/collab/tasks/comment")) {
          const requestInit = init as { body?: string } | undefined;
          requests.push({
            url: input,
            body: JSON.parse(String(requestInit?.body ?? "{}")) as Record<
              string,
              unknown
            >,
          });
        }
        return Promise.resolve(payload({}));
      };
      const harness = loadClientExports({ fetchImpl });
      const root = mountTaskPage(harness);
      let tree = await settle(root, harness.runtime);
      const receiverFilter = findNode(
        tree,
        (node) =>
          node.type === "button" &&
          node.props?.["aria-label"] === "按责任人筛选任务",
      );
      (receiverFilter?.props?.onClick as (() => void) | undefined)?.();
      tree = await settle(root, harness.runtime);
      const allReceivers = findNode(
        tree,
        (node) =>
          node.type === "button" &&
          node.props?.className === "pmtask-filter-option" &&
          containsText(node.props?.children, "全部"),
      );
      (allReceivers?.props?.onClick as (() => void) | undefined)?.();
      tree = await settle(root, harness.runtime);
      const card = findNode(
        tree,
        (node) => node.props?.["data-task-id"] === task.id,
      );
      (card?.props?.onClick as (() => void) | undefined)?.();
      tree = await settle(root, harness.runtime);
      const mentionButton = findNode(
        tree,
        (node) =>
          node.type === "button" &&
          node.props?.className === "pmtask-tool-btn" &&
          node.props?.children === "@",
      );
      (mentionButton?.props?.onClick as (() => void) | undefined)?.();
      return {
        tree: await settle(root, harness.runtime),
        root,
        runtime: harness.runtime,
      };
    };

    const outsider = await treeFor("admin", "平台 Admin");
    const outsiderTree = outsider.tree;
    const outsiderInstruction = findNode(
      outsiderTree,
      (node) =>
        node.type === "button" &&
        String(node.props?.className ?? "")
          .split(/\s+/)
          .includes("pmtask-detail-intent") &&
        containsText(node.props?.children, "指令"),
    );
    expect(outsiderInstruction?.props?.disabled).toBe(true);
    expect(containsText(outsiderTree, "其他 AI")).toBe(true);
    const otherMention = findNode(
      outsiderTree,
      (node) =>
        node.type === "button" &&
        node.props?.className === "pmtask-mention-item" &&
        containsText(node.props?.children, "其他 AI"),
    );
    (otherMention?.props?.onClick as (() => void) | undefined)?.();
    let discussed = await settle(outsider.root, outsider.runtime);
    const send = findNode(
      discussed,
      (node) => node.type === "button" && node.props?.children === "发送",
    );
    (send?.props?.onClick as (() => void) | undefined)?.();
    discussed = await settle(outsider.root, outsider.runtime);
    expect(requests).toHaveLength(1);
    expect(requests[0]?.url).toContain("/api/collab/tasks/comment");
    expect(requests[0]?.body.mentions).toEqual([
      { kind: "agent", id: "tm-other", name: "其他 AI" },
    ]);

    const owner = await treeFor("worker", "负责人");
    const ownerTree = owner.tree;
    const ownerInstruction = findNode(
      ownerTree,
      (node) =>
        node.type === "button" &&
        String(node.props?.className ?? "")
          .split(/\s+/)
          .includes("pmtask-detail-intent") &&
        containsText(node.props?.children, "指令"),
    );
    expect(ownerInstruction?.props?.disabled).not.toBe(true);
    expect(containsText(ownerTree, "责任 AI")).toBe(true);
    expect(containsText(ownerTree, "其他 AI")).toBe(true);
  });

  it("stops every active agent run from the task execution detail", async () => {
    const stopRequests: Array<Record<string, unknown>> = [];
    let stopped = false;
    const runningMessages = [
      {
        id: "run-a",
        at: "2026-03-08T03:00:00.000Z",
        authorId: "agent-a",
        authorName: "执行分身 A",
        kind: "agent",
        content: "正在执行 A",
        attachments: [],
        mentions: [],
        runId: "run-a",
        runRole: "owner",
        state: "running",
      },
      {
        id: "run-b",
        at: "2026-03-08T03:01:00.000Z",
        authorId: "agent-b",
        authorName: "执行分身 B",
        kind: "agent",
        content: "正在执行 B",
        attachments: [],
        mentions: [],
        runId: "run-b",
        runRole: "assist",
        state: "running",
      },
    ];
    const task = makeTask({
      id: "TSK-STOP-ALL",
      workspaceId: "ws-1",
      title: "停止全部 Agent",
      status: "progress",
      priority: "P1",
      receiverType: "agent",
      receiverId: "agent-a",
      receiverName: "执行分身 A",
      createdBy: "admin",
      agentRunIds: ["run-a", "run-b"],
      messages: runningMessages,
      updatedAt: "2026-03-08T03:01:00.000Z",
    });
    const fetchImpl = (input: string, init?: unknown) => {
      if (input.startsWith("/api/collab/auth/me")) {
        return Promise.resolve(
          payload({ user: { id: "admin", name: "平台 Admin", role: "admin" } }),
        );
      }
      if (input.startsWith("/api/collab/team/workspaces")) {
        return Promise.resolve(
          payload({
            workspaces: [
              { id: "ws-1", title: "项目一", path: "/p1", isMember: true },
            ],
          }),
        );
      }
      if (input.startsWith("/api/collab/tasks/bootstrap")) {
        return Promise.resolve(
          payload({
            tasks: [task],
            directory: {
              humans: [],
              agents: [
                {
                  id: "agent-a",
                  name: "执行分身 A",
                  kind: "agent",
                  ownerAuthUserId: "admin",
                  avatar: "",
                },
              ],
              roles: [],
            },
          }),
        );
      }
      if (input.startsWith("/api/collab/agent/runs?")) {
        return Promise.resolve(
          payload({
            runs: [
              {
                id: "run-a",
                instanceId: "TSK-STOP-ALL",
                status: stopped ? "cancelled" : "running",
                createdAt: "2026-03-08T03:00:00.000Z",
              },
              {
                id: "run-b",
                instanceId: "TSK-STOP-ALL",
                status: stopped ? "cancelled" : "running",
                execution: { runtime: "Codex CLI" },
                createdAt: "2026-03-08T03:01:00.000Z",
              },
            ],
          }),
        );
      }
      if (input.startsWith("/api/collab/agent/runs/detail")) {
        return Promise.resolve(
          payload({
            run: {
              id: "run-a",
              instanceId: "TSK-STOP-ALL",
              status: stopped ? "cancelled" : "running",
            },
            progress: { text: "正在执行" },
          }),
        );
      }
      if (input.startsWith("/api/collab/agent/execution/detail")) {
        return Promise.resolve(payload({ execution: null }));
      }
      if (input.startsWith("/api/collab/tasks/execution/stop")) {
        stopped = true;
        stopRequests.push(
          JSON.parse(
            String((init as { body?: string } | undefined)?.body ?? "{}"),
          ) as Record<string, unknown>,
        );
        return Promise.resolve(
          payload({
            task: {
              ...task,
              messages: runningMessages.map((message) => ({
                ...message,
                state: "cancelled",
              })),
            },
            cancelledRunIds: ["run-a", "run-b"],
          }),
        );
      }
      return Promise.resolve(payload({}));
    };
    const harness = loadClientExports({ fetchImpl });
    const root = mountTaskPage(harness);
    let tree = await settle(root, harness.runtime);
    const card = findNode(
      tree,
      (node) => node.props?.["data-task-id"] === task.id,
    );
    (card?.props?.onClick as (() => void) | undefined)?.();
    tree = await settle(root, harness.runtime);
    expect(
      findNode(
        tree,
        (node) =>
          node.type === "button" &&
          String(node.props?.className ?? "").startsWith(
            "pmtask-detail-action ",
          ) &&
          containsText(node.props?.children, "停止执行"),
      ),
      "停止执行入口不应放在任务详情顶部",
    ).toBeUndefined();
    const composer = findNode(
      tree,
      (node) => node.props?.className === "pmtask-composer",
    );
    const stop = findNode(
      composer,
      (node) =>
        node.type === "button" &&
        node.props?.className === "pmtask-composer-stop",
    );
    expect(stop, "运行中的任务应在对话框操作区提供停止入口").toBeDefined();
    expect(stop?.props?.title).toContain("2 个正在运行");
    expect(stop?.props?.["aria-label"]).toBe("停止执行");
    expect(
      findNode(
        tree,
        (node) =>
          node.type === "button" &&
          node.props?.className === "pmtask-execution-stop",
      ),
      "AI 执行记录侧栏不应重复显示停止入口",
    ).toBeUndefined();
    const typingStrip = findNode(
      tree,
      (node) => node.props?.className === "pmtask-typing-strip",
    );
    expect(
      typingStrip,
      "运行中的 AI 伙伴应显示正在输入动效",
    ).toBeDefined();
    expect(
      findNode(
        typingStrip,
        (node) =>
          String(node.props?.className ?? "").includes("pmtask-avatar") ||
          String(node.props?.className ?? "").includes("pmtask-ring"),
      ),
      "正在输入状态不应显示头像",
    ).toBeUndefined();
    const typingChildren = typingStrip?.props?.children as
      | TreeNode[]
      | undefined;
    expect(typingChildren?.[0]?.props?.children).toContain("正在输入");
    expect(typingChildren?.[1]?.props?.className).toBe("pmtask-typing-dots");
    expect(containsText(tree, "正在输入")).toBe(true);
    (stop?.props?.onClick as (() => void) | undefined)?.();
    tree = await settle(root, harness.runtime);
    expect(stopRequests).toEqual([{ taskId: task.id }]);
    expect(
      findNode(
        tree,
        (node) =>
          node.type === "button" &&
          node.props?.className === "pmtask-composer-stop",
      ),
      "所有执行停止后对话框不再显示停止按钮",
    ).toBeUndefined();
    expect(
      findNodes(
        tree,
        (node) => node.props?.className === "pmtask-typing-strip",
      ),
      "停止后应移除正在输入动效",
    ).toHaveLength(0);
    expect(
      findNodes(
        tree,
        (node) =>
          String(node.props?.className ?? "").includes(
            "pmtask-message-run-state cancelled",
          ),
      ),
      "停止后对话中应显示已停止反馈",
    ).toHaveLength(2);
    expect(containsText(tree, "已停止执行")).toBe(true);
    const source = readFileSync(CLIENT_PATH, "utf8");
    expect(source).toContain(
      ".pmtask-typing-strip{order:3;flex:none;display:flex;align-items:center;gap:8px;min-height:26px;padding:3px 8px;border:0;background:transparent;",
    );
    expect(source).toContain(".pmtask-composer-stop{height:30px;");
  });

  it("uses one composer for discussion and instruction while keeping data routes separate", async () => {
    const requests: Array<{ url: string; body: Record<string, unknown> }> = [];
    const task = makeTask({
      id: "TSK-UI-MERGED-COMPOSER",
      workspaceId: "ws-1",
      title: "合并输入区",
      description: "请完成发布风险复核。",
      status: "progress",
      priority: "P1",
      receiverType: "human",
      receiverId: "admin",
      receiverName: "平台 Admin",
      createdBy: "admin",
      messages: [
        {
          id: "agent-feedback",
          at: "2026-03-09T01:00:00.000Z",
          authorId: "agent-1",
          authorName: "执行分身",
          kind: "agent",
          content: "风险清单已经整理完成。",
          attachments: [],
          mentions: [],
          state: "succeeded",
        },
      ],
      comments: [
        {
          id: "comment-discussion",
          at: "2026-03-09T01:02:00.000Z",
          authorId: "other",
          authorName: "其他成员",
          kind: "human",
          content: "建议补充客户侧确认记录。",
          isKeyConsensus: false,
          replies: [],
        },
      ],
      events: [
        {
          id: "comment-event",
          at: "2026-03-09T01:02:00.000Z",
          actorId: "other",
          actorName: "其他成员",
          kind: "comment",
          message: "其他成员添加了评论",
        },
      ],
      autoSubmitReview: false,
      autoApproveReview: true,
      executionPolicy: {
        sourcePolicy: {
          allow: ["workspace", "public-web"],
        },
        toolPolicy: {
          requireApproval: ["fs.write"],
        },
        evidence: {
          requireToolEvents: true,
        },
      },
      updatedAt: "2026-03-09T01:02:00.000Z",
    });
    const fetchImpl = (
      input: string,
      init?: unknown,
    ): Promise<{ ok: boolean; status?: number; json: () => Promise<unknown> }> => {
      if (input.startsWith("/api/collab/auth/me")) {
        return Promise.resolve(
          payload({ user: { id: "admin", name: "平台 Admin", role: "admin" } }),
        );
      }
      if (input.startsWith("/api/collab/team/workspaces")) {
        return Promise.resolve(
          payload({
            workspaces: [
              { id: "ws-1", title: "项目一", path: "/p1", isMember: true },
            ],
          }),
        );
      }
      if (input.startsWith("/api/collab/tasks/bootstrap")) {
        return Promise.resolve(
          payload({
            tasks: [task],
            directory: { humans: [], agents: [], roles: [] },
          }),
        );
      }
      if (input.startsWith("/api/collab/tasks/comment")) {
        const requestInit = init as { body?: string } | undefined;
        requests.push({
          url: input,
          body: JSON.parse(String(requestInit?.body ?? "{}")) as Record<
            string,
            unknown
          >,
        });
      }
      return Promise.resolve(payload({}));
    };
    const harness = loadClientExports({ fetchImpl });
    const root = mountTaskPage(harness);
    let tree = await settle(root, harness.runtime);
    const card = findNode(
      tree,
      (node) =>
        node.props?.["data-task-id"] === "TSK-UI-MERGED-COMPOSER",
    );
    (card?.props?.onClick as (() => void) | undefined)?.();
    tree = await settle(root, harness.runtime);

    expect(
      findNode(
        tree,
        (node) =>
          node.props?.className === "pmtask-detail-project-chip" &&
          containsText(node.props?.children, "项目 · 项目一"),
      ),
      "详情顶部应展示项目上下文",
    ).toBeDefined();
    expect(
      findNode(
        tree,
        (node) => node.props?.className === "pmtask-detail-runtime",
      ),
      "详情左栏不再展示 Runtime 区",
    ).toBeUndefined();
    expect(
      findNodes(
        tree,
        (node) =>
          node.props?.className ===
          "pmtask-detail-message-badge instruction",
      ).length,
      "任务派发消息应标记为指令",
    ).toBeGreaterThan(0);
    expect(
      findNode(
        tree,
        (node) =>
          node.props?.className ===
            "pmtask-detail-message-badge feedback" &&
          containsText(node.props?.children, "执行反馈"),
      ),
      "Agent 回复应标记为执行反馈",
    ).toBeDefined();
    expect(
      findNode(
        tree,
        (node) =>
          node.props?.className ===
            "pmtask-detail-message-badge discussion" &&
          containsText(node.props?.children, "讨论 · 仅记录"),
      ),
      "评论应标记为讨论",
    ).toBeDefined();
    expect(
      containsText(tree, "其他成员添加了评论"),
      "评论内容已在会话中展示，不再重复渲染评论事件",
    ).toBe(false);
    expect(
      findNode(
        tree,
        (node) =>
          node.props?.className === "pmtask-detail-info" &&
          containsText(node.props?.children, "负责人"),
      ),
      "负责人字段应占半宽",
    ).toBeDefined();
    expect(
      findNode(
        tree,
        (node) =>
          node.props?.className === "pmtask-detail-info" &&
          containsText(node.props?.children, "归属项目"),
      ),
      "归属项目应与负责人并排占半宽",
    ).toBeDefined();
    const basicInfoRows: Array<[string, string | null]> = [
      ["完成后自动提交 Review", "关闭"],
      ["Review 自动通过", "开启"],
      ["执行运行时", "未采集"],
      ["模型 / 推理强度", "未采集"],
      ["公开网页 允许", null],
      ["工具确认 开启", null],
      ["工具事件 记录", null],
    ];
    for (const [label, value] of basicInfoRows) {
      expect(
        findNode(
          tree,
          (node) =>
            String(node.props?.className ?? "").includes(
              "pmtask-detail-info",
            ) &&
            containsText(node.props?.children, label) &&
            (value === null ||
              containsText(node.props?.children, value)),
        ),
        `基础信息应展示 ${label}`,
      ).toBeDefined();
    }
    expect(
      findNode(
        tree,
        (node) =>
          node.props?.className === "pmtask-detail-info" &&
          containsText(node.props?.children, "任务状态"),
      ),
      "任务状态已在顶部展示，基础信息不再重复显示",
    ).toBeUndefined();
    const basicInfoGrid = findNode(
      tree,
      (node) => node.props?.className === "pmtask-detail-info-grid",
    );
    const wideBasicInfoLabels = findNodes(
      basicInfoGrid,
      (node) =>
        node.props?.className === "pmtask-detail-info wide",
    ).map((node) => {
      const children = Array.isArray(node.props?.children)
        ? node.props?.children
        : [node.props?.children];
      return (children?.[0] as TreeNode | undefined)?.props?.children;
    });
    expect(
      wideBasicInfoLabels,
      "基础信息只应让执行策略跨两列，其他字段成对铺满",
    ).toEqual(["执行策略"]);

    const discussionIntent = findNode(
      tree,
      (node) =>
        node.type === "button" &&
        String(node.props?.className ?? "")
          .split(/\s+/)
          .includes("pmtask-detail-intent") &&
        containsText(node.props?.children, "讨论"),
    );
    (discussionIntent?.props?.onClick as (() => void) | undefined)?.();
    tree = await settle(root, harness.runtime);
    expect(
      findNode(
        tree,
        (node) =>
          node.props?.className === "pmtask-detail-effect" &&
          containsText(
            node.props?.children,
            "仅记录讨论，不进入本次执行上下文",
          ),
      ),
      "选择讨论后应展示不触发执行的后果",
    ).toBeDefined();

    const input = findNode(
      tree,
      (node) => node.props?.className === "pmtask-composer-input",
    );
    (
      input?.props?.onChange as
        | ((event: { target: { value: string } }) => void)
        | undefined
    )?.({ target: { value: "补充一条讨论记录" } });
    tree = await settle(root, harness.runtime);
    const send = findNode(
      tree,
      (node) => node.type === "button" && node.props?.children === "发送",
    );
    (send?.props?.onClick as (() => void) | undefined)?.();
    await settle(root, harness.runtime);

    expect(requests).toHaveLength(1);
    expect(requests[0]?.url).toContain("/api/collab/tasks/comment");
    expect(requests[0]?.body).toMatchObject({
      taskId: "TSK-UI-MERGED-COMPOSER",
      content: "补充一条讨论记录",
      isKeyConsensus: false,
    });
  });

  it("scopes detail styles to the refactor and preserves scroll on tab switches", () => {
    const source = readFileSync(CLIENT_PATH, "utf8");
    expect(source).toContain(".pmtask-detail-page .pmtask-detail-layout");
    expect(source).toContain("max-width:min(72%,620px)");
    expect(source).toContain("max-width:82%");
    expect(source).toContain("node.scrollTop = node.scrollHeight");
    expect(source).not.toContain("h(TaskDetailRuntimeDock");
    expect(source).toContain("pmtask-detail-tab");
    expect(source).toContain("height:calc(100dvh - 100px)");
    expect(source).toContain("pmtask-detail-side-scroll");
    expect(source).not.toContain(
      'className: "pmtask-execution-runs-label"',
    );
    expect(source).toContain("overflow-y:auto");
    expect(source).toContain("pmtask-content-editor");
    expect(source).toContain("pmtask-basic-editor");
    expect(source).toContain("padding:12px 16px 18px");
    expect(source).toContain("justify-content:flex-end;margin-top:10px");
    expect(source).toContain('label: "人员"');
    expect(source).toContain('label: "AI伙伴"');
    expect(source).toContain('label: "角色"');
    expect(source).not.toContain(
      'window.document.addEventListener("pointerdown", closeOnOutside)',
    );
    expect(source).toContain('label: "AI伙伴"');
    expect(source).toContain("pmtask-detail-session-link");
    expect(source).toContain(
      ".pmtask-composer .pmtask-mention-menu{left:72px;top:auto;bottom:calc(100% + 6px);",
    );
    expect(source).not.toContain("left:72px;top:38px;bottom:auto;");
    expect(source).toContain("/api/collab/tasks/status");
    expect(source).not.toContain("mode-toggle");
  });
});
