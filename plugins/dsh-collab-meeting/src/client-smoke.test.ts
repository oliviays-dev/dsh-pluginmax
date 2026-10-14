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

interface ClientHarnessOptions {
  readonly react?: unknown;
  /** 模拟另一个模块已经切到「平台全量」，验证新挂载页面会沿用该选择。 */
  readonly scopeAll?: boolean;
  readonly fetchImpl?: (
    input: string,
    init?: unknown,
  ) => Promise<{ ok: boolean; status?: number; json: () => Promise<unknown> }>;
}

function createScopeStore(initial = false) {
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

type ScopeStore = ReturnType<typeof createScopeStore>;

interface MeetingWindowStub {
  __pluginmaxScope: ScopeStore;
  __pluginmaxPendingMeeting?: {
    meetingId: string;
    workspaceId: string;
  } | null;
}

/** Executes the bundle with the smallest window/React stand-ins it needs. */
function loadClientExports(options: ClientHarnessOptions = {}): {
  exports: ClientExports;
  scope: ScopeStore;
  window: MeetingWindowStub;
} {
  let exports: ClientExports = {};
  const fakeReact = options.react ?? {
    useState: (initial: unknown) => [initial, () => undefined],
    useEffect: () => undefined,
    useRef: (value: unknown) => ({ current: value }),
  };
  const fakeJsx = {
    jsx: (type: unknown, props: unknown) => ({ type, props }),
    jsxs: (type: unknown, props: unknown) => ({ type, props }),
  };
  const fakeFetch =
    options.fetchImpl ??
    (async () => ({ ok: true, status: 200, json: async () => ({}) }));
  // 预先放进 window，模拟其他模块已经加载并设置过范围偏好。
  const scope = createScopeStore(options.scopeAll === true);
  const windowStub = {
    __pluginmaxScope: scope,
    __ModuleLoader__: {
      load: (definition: {
        id: string;
        factory: (require: (id: string) => unknown) => unknown;
      }) => {
        exports = definition.factory((id: string) => {
          if (id === "react") return fakeReact;
          if (id === "react/jsx-runtime") return fakeJsx;
          throw new Error(`unexpected module: ${id}`);
        }) as ClientExports;
      },
    },
    localStorage: { getItem: () => null, setItem: () => undefined },
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    setInterval: () => 1,
    clearInterval: () => undefined,
    setTimeout: () => 1,
    clearTimeout: () => undefined,
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
  return { exports, scope, window: windowStub };
}

interface TreeNode {
  readonly type?: unknown;
  readonly props?: Record<string, unknown>;
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

function findAll(
  root: unknown,
  predicate: (node: TreeNode) => boolean,
): TreeNode[] {
  const found: TreeNode[] = [];
  const stack: unknown[] = [root];
  while (stack.length > 0) {
    const node = stack.pop();
    if (Array.isArray(node)) {
      for (const child of node) stack.push(child);
      continue;
    }
    if (node === null || typeof node !== "object") continue;
    const candidate = node as TreeNode;
    if (predicate(candidate)) found.push(candidate);
    const children = candidate.props?.children;
    if (children !== undefined) stack.push(children);
  }
  return found;
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

/**
 * Minimal hook runtime good enough to render the meetings page: enough to run
 * its `useState`/`useRef`/`useEffect` graph, flush the async data loaders, and
 * inspect the resulting element tree without pulling React itself into tests.
 */
interface HookSlots {
  states: unknown[];
  depList: Array<readonly unknown[] | undefined>;
  cleanups: Array<(() => void) | undefined>;
  refs: Array<{ current: unknown }>;
  cursor: number;
}

function createReactRuntime() {
  const stores = new WeakMap<object, HookSlots>();
  let current: HookSlots | undefined;
  let pending: Array<() => void> = [];

  const slotsFor = (component: object): HookSlots => {
    let slots = stores.get(component);
    if (slots === undefined) {
      slots = { states: [], depList: [], cleanups: [], refs: [], cursor: 0 };
      stores.set(component, slots);
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

  const react = {
    useState(initial: unknown) {
      const slots = current as HookSlots;
      const index = slots.cursor;
      slots.cursor += 1;
      if (!(index in slots.states)) {
        slots.states[index] =
          typeof initial === "function"
            ? (initial as () => unknown)()
            : initial;
      }
      const setState = (value: unknown): void => {
        slots.states[index] =
          typeof value === "function"
            ? (value as (previous: unknown) => unknown)(slots.states[index])
            : value;
      };
      return [slots.states[index], setState];
    },
    useRef(initial: unknown) {
      const slots = current as HookSlots;
      const index = slots.cursor;
      slots.cursor += 1;
      if (!(index in slots.refs)) slots.refs[index] = { current: initial };
      return slots.refs[index];
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

/** Expands function components into their rendered host-element subtree. */
function renderTree(node: unknown, runtime: Runtime): unknown {
  if (Array.isArray(node)) {
    return node.map((child) => renderTree(child, runtime));
  }
  if (node === null || typeof node !== "object") return node;
  const element = node as { type?: unknown; props?: Record<string, unknown> };
  if (typeof element.type === "function") {
    runtime.beginRender(element.type as object);
    return renderTree(
      (element.type as (props: unknown) => unknown)(element.props ?? {}),
      runtime,
    );
  }
  if (element.props && "children" in element.props) {
    return {
      ...element,
      props: {
        ...element.props,
        children: renderTree(element.props.children, runtime),
      },
    };
  }
  return node;
}

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("meeting client", () => {
  it("registers the meetings page and the meeting overlay", () => {
    const { exports: exported } = loadClientExports();
    expect(exported.inject).toEqual(["slots"]);
    const specs: SlotSpec[] = [];
    const ctx = {
      slots: {
        inject: (_name: string, run: () => void) => {
          run();
        },
        register: (spec: SlotSpec) => {
          specs.push(spec);
          return () => undefined;
        },
      },
    };
    exported.apply?.(ctx);
    expect(specs.map((spec) => spec.id).sort()).toEqual([
      "pluginmax-meeting-panel",
      "pluginmax-meetings",
    ]);
    expect(specs.map((spec) => spec.name).sort()).toEqual([
      "pluginmax.global",
      "shell.overlay",
    ]);
  });

  it("shows an admin's own meetings and allows creating one without joined projects", async () => {
    const runtime = createReactRuntime();
    const payload = (body: unknown) => ({
      ok: true,
      status: 200,
      json: async () => body,
    });
    const fetchImpl = async (input: string) => {
      if (input.startsWith("/api/collab/team/workspaces")) {
        return payload({
          workspaces: [
            { id: "ws-1", title: "项目一", path: "/p1", isMember: false },
            { id: "ws-2", title: "项目二", path: "/p2", isMember: false },
          ],
        });
      }
      if (input.startsWith("/api/collab/auth/me")) {
        return payload({ user: { id: "admin", name: "Admin", role: "admin" } });
      }
      if (input.startsWith("/api/collab/teammates")) {
        return payload({ teammates: [] });
      }
      if (input.startsWith("/api/collab/meetings")) {
        const workspaceId = new URL(`http://x${input}`).searchParams.get(
          "workspaceId",
        );
        if (workspaceId === "ws-1") {
          return payload({
            meetings: [
              {
                id: "m-mine",
                workspaceId: "ws-1",
                title: "我的历史会议",
                status: "active",
                createdBy: "admin",
                updatedAt: "2026-03-02T00:00:00.000Z",
              },
              {
                id: "m-other",
                workspaceId: "ws-1",
                title: "别人的会议",
                status: "active",
                createdBy: "someone-else",
                updatedAt: "2026-03-01T00:00:00.000Z",
              },
            ],
          });
        }
        if (workspaceId === "ws-2") {
          return payload({
            meetings: [
              {
                id: "m-platform",
                workspaceId: "ws-2",
                title: "平台会议",
                status: "active",
                createdBy: "other",
                updatedAt: "2026-02-01T00:00:00.000Z",
              },
            ],
          });
        }
        return payload({ meetings: [] });
      }
      return payload({});
    };

    const { exports: exported, scope } = loadClientExports({
      react: runtime.react,
      fetchImpl,
    });
    let Meetings: ((props: Record<string, unknown>) => unknown) | undefined;
    const ctx = {
      slots: {
        inject: (_name: string, run: () => void) => run(),
        register: (spec: SlotSpec, component?: unknown) => {
          if (spec.id === "pluginmax-meetings") {
            Meetings = component as (props: Record<string, unknown>) => unknown;
          }
          return () => undefined;
        },
      },
    };
    exported.apply?.(ctx);
    expect(Meetings).toBeDefined();

    const props = {
      useShellRoute: (select: (state: unknown) => unknown) =>
        select({ route: "meetings" }),
    };
    const root = { type: Meetings, props };
    const settle = async (passes = 4) => {
      let next: unknown;
      for (let pass = 0; pass < passes; pass += 1) {
        next = renderTree(root, runtime);
        runtime.runEffects();
        await tick();
      }
      return next;
    };
    let tree = await settle();

    // 首屏默认「仅看已加入」，但要带上自己在未加入项目里创建的会议。
    expect(
      findNode(tree, (node) => node.props?.children === "我的历史会议"),
      "默认视图应包含自己创建的会议",
    ).toBeDefined();
    expect(
      findNode(tree, (node) => node.props?.children === "别人的会议"),
      "默认视图不应包含别人创建的会议",
    ).toBeUndefined();
    expect(
      findNode(tree, (node) => node.props?.children === "平台会议"),
      "默认视图不应包含其他项目的会议",
    ).toBeUndefined();
    expect(
      findNode(
        tree,
        (node) =>
          node.type === "button" && node.props?.children === "仅看已加入",
      )?.props?.["aria-pressed"],
      "默认仍停留在「仅看已加入」",
    ).toBe(true);
    expect(
      findNode(
        tree,
        (node) => node.type === "button" && node.props?.children === "平台全量",
      )?.props?.["aria-pressed"],
    ).toBe(false);

    // 切换后写入跨模块共享 store，并立即按全量刷新当前列表。
    (
      findNode(
        tree,
        (node) => node.type === "button" && node.props?.children === "平台全量",
      )?.props?.onClick as (() => void) | undefined
    )?.();
    tree = await settle();
    expect(scope.getSnapshot(), "平台全量应写入共享范围 store").toBe(true);
    expect(
      findNode(
        tree,
        (node) => node.type === "button" && node.props?.children === "平台全量",
      )?.props?.["aria-pressed"],
    ).toBe(true);
    expect(
      findNode(tree, (node) => node.props?.children === "平台会议"),
      "全量视图应包含其他项目的会议",
    ).toBeDefined();

    const createButton = findNode(
      tree,
      (node) => node.type === "button" && node.props?.children === "新建会议",
    );
    expect(createButton, "新建会议 按钮应渲染").toBeDefined();
    // 平台管理员对全部项目都有建会权限，未加入项目时按钮也必须可用。
    expect(createButton?.props?.disabled).toBe(false);

    // 打开弹窗后，项目下拉应列出全部项目（而不只是“已加入”的项目）。
    (createButton?.props?.onClick as (() => void) | undefined)?.();
    tree = renderTree(root, runtime);
    runtime.runEffects();

    const projectSelect = findNode(
      tree,
      (node) => node.props?.["aria-label"] === "新建会议所属项目",
    );
    expect(projectSelect, "新建会议弹窗应有项目下拉").toBeDefined();
    const projectChildren = projectSelect?.props?.children;
    const options = (
      Array.isArray(projectChildren) ? projectChildren : [projectChildren]
    ).filter(Boolean) as TreeNode[];
    expect(options.map((option) => option.props?.children)).toEqual([
      "项目一",
      "项目二",
    ]);
  });

  it("keeps the shared project scope when the module mounts from a cross-module jump", async () => {
    const runtime = createReactRuntime();
    const payload = (body: unknown) => ({
      ok: true,
      status: 200,
      json: async () => body,
    });
    const fetchImpl = async (input: string) => {
      if (input.startsWith("/api/collab/team/workspaces")) {
        return payload({
          workspaces: [
            { id: "ws-1", title: "项目一", path: "/p1", isMember: false },
          ],
        });
      }
      if (input.startsWith("/api/collab/auth/me")) {
        return payload({ user: { id: "admin", name: "Admin", role: "admin" } });
      }
      if (input.startsWith("/api/collab/teammates")) {
        return payload({ teammates: [] });
      }
      if (input.startsWith("/api/collab/meetings")) {
        return payload({
          meetings: [
            {
              id: "m-platform",
              workspaceId: "ws-1",
              title: "平台会议",
              status: "active",
              createdBy: "other",
              updatedAt: "2026-03-02T00:00:00.000Z",
            },
          ],
        });
      }
      return payload({});
    };

    // 模拟任务/工作流模块已经把范围切成「平台全量」，再跳转打开会议模块。
    const harness = loadClientExports({
      react: runtime.react,
      fetchImpl,
      scopeAll: true,
    });
    let Meetings: ((props: Record<string, unknown>) => unknown) | undefined;
    const ctx = {
      slots: {
        inject: (_name: string, run: () => void) => run(),
        register: (spec: SlotSpec, component?: unknown) => {
          if (spec.id === "pluginmax-meetings") {
            Meetings = component as (props: Record<string, unknown>) => unknown;
          }
          return () => undefined;
        },
      },
    };
    harness.exports.apply?.(ctx);
    expect(
      harness.window.__pluginmaxScope,
      "会议模块应复用其他模块已创建的共享范围 store",
    ).toBe(harness.scope);

    const root = {
      type: Meetings,
      props: {
        useShellRoute: (select: (state: unknown) => unknown) =>
          select({ route: "meetings" }),
      },
    };
    let tree: unknown;
    for (let pass = 0; pass < 4; pass += 1) {
      tree = renderTree(root, runtime);
      runtime.runEffects();
      await tick();
    }

    expect(
      findNode(
        tree,
        (node) => node.type === "button" && node.props?.children === "平台全量",
      )?.props?.["aria-pressed"],
      "新挂载的会议页应直接处于平台全量",
    ).toBe(true);
    expect(
      findNode(
        tree,
        (node) =>
          node.type === "button" && node.props?.children === "仅看已加入",
      )?.props?.["aria-pressed"],
    ).toBe(false);
    expect(
      findNode(tree, (node) => node.props?.children === "平台会议"),
    ).toBeDefined();
  });

  it("opens the target meeting from a workbench pending deep link", async () => {
    const runtime = createReactRuntime();
    const requests: string[] = [];
    const payload = (body: unknown) => ({
      ok: true,
      status: 200,
      json: async () => body,
    });
    const fetchImpl = async (input: string) => {
      requests.push(input);
      if (input.startsWith("/api/collab/team/workspaces")) {
        return payload({
          workspaces: [
            { id: "ws-1", title: "项目一", path: "/p1", isMember: true },
            { id: "ws-2", title: "项目二", path: "/p2", isMember: false },
          ],
        });
      }
      if (input.startsWith("/api/collab/auth/me")) {
        return payload({ user: { id: "admin", name: "Admin", role: "admin" } });
      }
      if (input.startsWith("/api/collab/teammates")) {
        return payload({ teammates: [] });
      }
      if (input.startsWith("/api/collab/meetings?")) {
        const workspaceId = new URL(`http://x${input}`).searchParams.get(
          "workspaceId",
        );
        return payload({
          meetings:
            workspaceId === "ws-2"
              ? [
                  {
                    id: "m-target",
                    workspaceId: "ws-2",
                    title: "待打开会议",
                    status: "closed",
                    createdBy: "admin",
                    updatedAt: "2026-03-02T00:00:00.000Z",
                  },
                ]
              : [],
        });
      }
      if (input.startsWith("/api/collab/meeting?")) {
        return payload({
          meeting: {
            id: "m-target",
            workspaceId: "ws-2",
            title: "待打开会议",
            status: "closed",
            participants: [],
            transcript: [],
          },
          participants: [],
          transcript: [],
        });
      }
      if (input.startsWith("/api/collab/meeting/minutes")) {
        return payload({ versions: [], current: null });
      }
      if (input.startsWith("/api/collab/meeting/delegates")) {
        return payload({ delegates: [] });
      }
      if (input.startsWith("/api/collab/meeting/tasks")) {
        return payload({ tasks: [] });
      }
      return payload({});
    };

    const harness = loadClientExports({
      react: runtime.react,
      fetchImpl,
    });
    harness.window.__pluginmaxPendingMeeting = {
      meetingId: "m-target",
      workspaceId: "ws-2",
    };
    let Meetings: ((props: Record<string, unknown>) => unknown) | undefined;
    const ctx = {
      slots: {
        inject: (_name: string, run: () => void) => run(),
        register: (spec: SlotSpec, component?: unknown) => {
          if (spec.id === "pluginmax-meetings") {
            Meetings = component as (props: Record<string, unknown>) => unknown;
          }
          return () => undefined;
        },
      },
    };
    harness.exports.apply?.(ctx);

    const root = {
      type: Meetings,
      props: {
        useShellRoute: (select: (state: unknown) => unknown) =>
          select({ route: "meetings" }),
      },
    };
    let tree: unknown;
    for (let pass = 0; pass < 6; pass += 1) {
      tree = renderTree(root, runtime);
      runtime.runEffects();
      await tick();
    }

    expect(harness.window.__pluginmaxPendingMeeting).toBeNull();
    expect(requests).toContain("/api/collab/meetings?workspaceId=ws-2");
    expect(requests).toContain("/api/collab/meeting?meetingId=m-target");
    expect(
      findNode(tree, (node) => node.props?.children === "待打开会议"),
    ).toBeDefined();
  });

  it("invite picker defaults to 5 visible rows with in-box fuzzy search and multi-select", async () => {
    const runtime = createReactRuntime();
    const names = ["Alice", "Bob", "Carol", "Dave", "Erin", "Frank"];
    const payload = (body: unknown) => ({
      ok: true,
      status: 200,
      json: async () => body,
    });
    const fetchImpl = async (input: string) => {
      if (input.startsWith("/api/collab/team/workspaces")) {
        return payload({
          workspaces: [
            { id: "ws-1", title: "项目一", path: "/p1", isMember: true },
          ],
        });
      }
      if (input.startsWith("/api/collab/auth/me")) {
        return payload({
          user: { id: "admin", name: "Admin", role: "member" },
        });
      }
      if (input.startsWith("/api/collab/teammates")) {
        // 一条 AI 候选：验证「名字（AI）」的表达与同一个控件里的多选。
        return payload({
          teammates: [{ id: "tm-1", name: "小助手", state: "active" }],
        });
      }
      if (input.startsWith("/api/collab/meeting/people")) {
        return payload({
          people: names.map((name, index) => ({
            id: `u-${index}`,
            name,
            role: "member",
          })),
        });
      }
      if (input.startsWith("/api/collab/meeting?")) {
        return payload({
          meeting: {
            id: "m-1",
            workspaceId: "ws-1",
            title: "评审会",
            status: "active",
          },
          participants: [
            {
              id: "p-1",
              meetingId: "m-1",
              kind: "human",
              refId: "admin",
              displayName: "用户-admin",
              status: "active",
            },
          ],
          transcript: [],
          actorId: "admin",
          canInvite: true,
          canRemove: true,
        });
      }
      if (input.startsWith("/api/collab/meetings")) {
        return payload({
          meetings: [
            {
              id: "m-1",
              workspaceId: "ws-1",
              title: "评审会",
              status: "active",
              createdBy: "admin",
              updatedAt: "2026-03-02T00:00:00.000Z",
            },
          ],
        });
      }
      return payload({});
    };

    const { exports: exported } = loadClientExports({
      react: runtime.react,
      fetchImpl,
    });
    let Meetings: ((props: Record<string, unknown>) => unknown) | undefined;
    const ctx = {
      slots: {
        inject: (_name: string, run: () => void) => run(),
        register: (spec: SlotSpec, component?: unknown) => {
          if (spec.id === "pluginmax-meetings") {
            Meetings = component as (props: Record<string, unknown>) => unknown;
          }
          return () => undefined;
        },
      },
    };
    exported.apply?.(ctx);

    const props = {
      useShellRoute: (select: (state: unknown) => unknown) =>
        select({ route: "meetings" }),
    };
    const root = { type: Meetings, props };
    const settle = async (passes = 4) => {
      let next: unknown;
      for (let pass = 0; pass < passes; pass += 1) {
        next = renderTree(root, runtime);
        runtime.runEffects();
        await tick();
      }
      return next;
    };

    let tree = await settle();
    // 选中列表里的会议 -> 打开「邀请成员」弹窗。
    const meetingItem = findNode(
      tree,
      (node) =>
        node.type === "button" &&
        typeof node.props?.onMouseDown === "function" &&
        containsText(node.props?.children, "评审会"),
    );
    expect(meetingItem, "会议列表应有可点选的会议项").toBeDefined();
    (meetingItem?.props?.onMouseDown as (() => void) | undefined)?.();
    (meetingItem?.props?.onClick as (() => void) | undefined)?.();
    tree = await settle();
    const inviteButton = findNode(
      tree,
      (node) => node.type === "button" && node.props?.children === "邀请成员",
    );
    const buttonLabels = findAll(tree, (node) => node.type === "button")
      .map((node) => node.props?.children)
      .filter((children) => typeof children === "string");
    expect(
      inviteButton,
      `应能打开邀请成员弹窗（当前按钮：${buttonLabels.join(" | ")}）`,
    ).toBeDefined();
    (inviteButton?.props?.onClick as (() => void) | undefined)?.();
    tree = await settle();

    // 默认展开：直接可搜索。
    expect(
      findNode(tree, (node) => node.props?.["aria-label"] === "搜索邀请成员"),
      "下拉框内应有搜索输入",
    ).toBeDefined();
    // 默认可见 10 行：列表容器限高 + 滚动。
    const listBox = findNode(tree, (node) => {
      const style = node.props?.style as
        { maxHeight?: unknown; overflowY?: unknown } | undefined;
      return style?.maxHeight === 338 && style?.overflowY === "auto";
    });
    expect(listBox, "成员列表应限高 10 行并滚动").toBeDefined();

    const options = () =>
      findAll(
        tree,
        (node) =>
          node.type === "button" &&
          typeof node.props?.["aria-pressed"] === "boolean",
      );
    // 人类候选 + 一条 AI 候选在同一个控件里。
    expect(options()).toHaveLength(names.length + 1);
    expect(
      findNode(tree, (node) => node.props?.children === "小助手（AI）"),
      "agent 参会方应显示为「名字（AI）」",
    ).toBeDefined();

    // 多选：勾选两个后都应保持选中。
    (options()[0]?.props?.onClick as (() => void) | undefined)?.();
    tree = await settle(1);
    (options()[1]?.props?.onClick as (() => void) | undefined)?.();
    tree = await settle(1);
    const selectedStates = options().map(
      (option) => option.props?.["aria-pressed"],
    );
    expect(selectedStates[0]).toBe(true);
    expect(selectedStates[1]).toBe(true);
    expect(selectedStates[2]).toBe(false);

    // 框内模糊搜索：输入片段后只剩匹配项。
    const searchInput = findNode(
      tree,
      (node) => node.props?.["aria-label"] === "搜索邀请成员",
    );
    (searchInput?.props?.onChange as ((event: unknown) => void) | undefined)?.({
      target: { value: "Er" },
    });
    tree = await settle(1);
    expect(options()).toHaveLength(1);
  });

  it("refreshes the invite list after inviting so the member shows as already in the meeting", async () => {
    const runtime = createReactRuntime();
    let invited = false;
    const payload = (body: unknown) => ({
      ok: true,
      status: 200,
      json: async () => body,
    });
    const fetchImpl = async (input: string) => {
      if (input.startsWith("/api/collab/team/workspaces")) {
        return payload({
          workspaces: [
            { id: "ws-1", title: "项目一", path: "/p1", isMember: true },
          ],
        });
      }
      if (input.startsWith("/api/collab/auth/me")) {
        return payload({
          user: { id: "admin", name: "Admin", role: "member" },
        });
      }
      if (input.startsWith("/api/collab/teammates")) {
        return payload({ teammates: [] });
      }
      if (input.startsWith("/api/collab/meeting/participants/invite")) {
        invited = true;
        return payload({ ok: true });
      }
      if (input.startsWith("/api/collab/meeting/people")) {
        return payload({
          people: [
            {
              id: "demo-admin",
              name: "Demo管理员",
              role: "owner",
              ...(invited ? { state: "active" } : {}),
            },
          ],
        });
      }
      if (input.startsWith("/api/collab/meeting?")) {
        return payload({
          meeting: {
            id: "m-1",
            workspaceId: "ws-1",
            title: "评审会",
            status: "active",
          },
          participants: [
            {
              id: "p-1",
              meetingId: "m-1",
              kind: "human",
              refId: "admin",
              displayName: "用户-admin",
              status: "active",
            },
          ],
          transcript: [],
          actorId: "admin",
          canInvite: true,
          canRemove: true,
        });
      }
      if (input.startsWith("/api/collab/meetings")) {
        return payload({
          meetings: [
            {
              id: "m-1",
              workspaceId: "ws-1",
              title: "评审会",
              status: "active",
              createdBy: "admin",
              updatedAt: "2026-03-02T00:00:00.000Z",
            },
          ],
        });
      }
      return payload({});
    };

    const { exports: exported } = loadClientExports({
      react: runtime.react,
      fetchImpl,
    });
    let Meetings: ((props: Record<string, unknown>) => unknown) | undefined;
    exported.apply?.({
      slots: {
        inject: (_name: string, run: () => void) => run(),
        register: (spec: SlotSpec, component?: unknown) => {
          if (spec.id === "pluginmax-meetings") {
            Meetings = component as (props: Record<string, unknown>) => unknown;
          }
          return () => undefined;
        },
      },
    });
    const props = {
      useShellRoute: (select: (state: unknown) => unknown) =>
        select({ route: "meetings" }),
    };
    const root = { type: Meetings, props };
    const settle = async (passes = 4) => {
      let next: unknown;
      for (let pass = 0; pass < passes; pass += 1) {
        next = renderTree(root, runtime);
        runtime.runEffects();
        await tick();
      }
      return next;
    };
    const openInvite = async (tree: unknown) => {
      const button = findNode(
        tree,
        (node) => node.type === "button" && node.props?.children === "邀请成员",
      );
      (button?.props?.onClick as (() => void) | undefined)?.();
    };

    let tree = await settle();
    const meetingItem = findNode(
      tree,
      (node) => node.type === "button" && node.props?.key === "m-1",
    );
    expect(meetingItem, "会议列表应有可点选的会议项").toBeDefined();
    (meetingItem?.props?.onMouseDown as (() => void) | undefined)?.();
    (meetingItem?.props?.onClick as (() => void) | undefined)?.();
    tree = await settle();
    const texts = findAll(
      tree,
      (node) => typeof node.props?.children === "string",
    )
      .map((node) => node.props?.children)
      .slice(0, 40);
    expect(
      findNode(
        tree,
        (node) => node.type === "button" && node.props?.children === "邀请成员",
      ),
      `会议详情应加载出邀请成员按钮（当前文本：${texts.join(" | ")}）`,
    ).toBeDefined();
    await openInvite(tree);
    tree = await settle();

    expect(
      findNode(tree, (node) => node.props?.["aria-label"] === "搜索邀请成员"),
      "邀请弹窗应打开",
    ).toBeDefined();
    // 邀请前：候选成员可勾选，未标记「已在会议中」。
    expect(
      findNode(tree, (node) => node.props?.children === "已在会议中"),
    ).toBeUndefined();
    const demoOption = findNode(
      tree,
      (node) => node.type === "button" && node.props?.key === "demo-admin",
    );
    expect(demoOption, "应能选中 Demo管理员").toBeDefined();
    (demoOption?.props?.onClick as (() => void) | undefined)?.();
    tree = await settle(1);

    // 提交邀请（表单 onSubmit）。
    const form = findNode(
      tree,
      (node) =>
        node.type === "form" && typeof node.props?.onSubmit === "function",
    );
    await (
      form?.props?.onSubmit as ((event: unknown) => Promise<void>) | undefined
    )?.({ preventDefault: () => undefined });
    tree = await settle();

    // 再次打开邀请弹窗：刚邀请的成员应显示为「已在会议中」（禁用）。
    tree = await settle(1);
    await openInvite(tree);
    tree = await settle();
    expect(
      findNode(tree, (node) => node.props?.children === "已在会议中"),
      "重新打开后应加载到刚刚邀请的成员",
    ).toBeDefined();
  });
});
