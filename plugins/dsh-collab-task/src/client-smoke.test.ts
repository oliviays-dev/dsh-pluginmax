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
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
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
  return { exports, scope, runtime, shellRoutes, sessions: options.sessions };
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
    (openButton?.props?.onClick as (() => void) | undefined)?.();
    await settle(root, harness.runtime);

    expect(opened, "应切到任务对应的那条 Agent 会话").toEqual([
      "de-task-TSK-SESSION-1-pluginmax-de",
    ]);
    expect(harness.shellRoutes, "shell 应切到会话视图").toContain("session");
  });

  it("offers 催办 only for human receivers and hides 重置会话", async () => {
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
    expect(button(agentTree, "发送"), "发送按钮应保留").toBeDefined();
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
          node.props?.className === "pmtask-field" &&
          containsText(node.props?.children, "归属项目") &&
          containsText(node.props?.children, "项目一"),
      ),
      "详情页应展示任务归属的项目",
    ).toBeDefined();

    // 进入编辑态：项目只读展示，且没有任何项目选择控件可以被改。
    const editButton = findNode(
      tree,
      (node) =>
        node.type === "button" &&
        node.props?.["aria-label"] === "编辑标题、优先级和描述",
    );
    expect(editButton, "详情页应有编辑入口").toBeDefined();
    (editButton?.props?.onClick as (() => void) | undefined)?.();
    tree = await settle(root, harness.runtime);

    expect(
      findNode(
        tree,
        (node) =>
          node.type === "div" &&
          node.props?.className === "pmtask-field pmtask-edit-locked" &&
          containsText(node.props?.children, "创建后不可变更") &&
          containsText(node.props?.children, "项目一"),
      ),
      "编辑态应只读展示归属项目并说明不可变更",
    ).toBeDefined();
    const editForm = findNode(
      tree,
      (node) =>
        node.type === "form" &&
        String(node.props?.className ?? "").includes("pmtask-edit-form"),
    );
    expect(editForm, "编辑表单应渲染").toBeDefined();
    expect(
      findNode(
        editForm?.props?.children,
        (node) =>
          node.type === "select" &&
          containsText(node.props?.children, "项目一"),
      ),
      "编辑表单里不应出现可切换的项目选项",
    ).toBeUndefined();
  });
});
