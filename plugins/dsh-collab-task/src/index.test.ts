import { mkdir, mkdtemp, utimes, writeFile } from "node:fs/promises";
import type { IncomingMessage, ServerResponse } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createTaskRoutes } from "./index.js";
import { TaskService, type KvTableLike } from "./service.js";
import type { TaskRecord } from "./types.js";
import {
  attachmentDocuments,
  collectDocuments,
  mergeDocuments,
  safeFileName,
  windowsFromRuns,
} from "./documents.js";

function memoryTable<V>(): KvTableLike<V> {
  const values = new Map<string, V>();
  return {
    get: (key) => values.get(key),
    entries: () => values.entries(),
    keys: () => values.keys(),
    get size() {
      return values.size;
    },
    async put(key, value) {
      values.set(key, value);
    },
    async delete(key) {
      return values.delete(key);
    },
  };
}

function service(): TaskService {
  return new TaskService({ tasks: memoryTable<TaskRecord>() });
}

const olivia = { id: "olivia", name: "Olivia", kind: "human" as const };

describe("dsh-collab-task service", () => {
  it("creates, assigns, claims, transitions, comments, and replies", async () => {
    const tasks = service();
    const created = await tasks.create(olivia, {
      workspaceId: "workspace-1",
      title: "Review task board",
      priority: "P2",
      receiverType: "role",
      receiverId: "review-guild",
      receiverName: "Review Guild",
      description: "Validate the task management demo.",
      acceptance: ["Board renders", "Role task can be claimed"],
      due: "2026-09-24",
    });
    expect(created.status).toBe("todo");
    expect(created.events).toHaveLength(1);

    const claimed = await tasks.claim(olivia, created.id);
    expect(claimed.receiverType).toBe("human");
    expect(claimed.receiverId).toBe("olivia");
    expect(claimed.status).toBe("progress");

    const review = await tasks.submit(olivia, created.id);
    expect(review.status).toBe("review");
    expect(review.progress).toBeGreaterThanOrEqual(86);

    const commented = await tasks.addComment(olivia, {
      taskId: created.id,
      content: "Please include the workflow link.",
    });
    const commentId = commented.comments[0]?.id;
    expect(commentId).toBeDefined();
    const replied = await tasks.replyComment(olivia, {
      taskId: created.id,
      commentId: commentId!,
      content: "Added.",
    });
    expect(replied.comments[0]?.replies[0]?.content).toBe("Added.");

    const done = await tasks.approve(olivia, created.id);
    expect(done.status).toBe("done");
    expect(done.progress).toBe(100);
  });

  it("rejects invalid create input", async () => {
    const tasks = service();
    await expect(
      tasks.create(olivia, {
        workspaceId: "workspace-1",
        title: "",
        priority: "P9",
        receiverType: "human",
        description: "",
        acceptance: [],
      }),
    ).rejects.toMatchObject({ code: "invalid_input" });
  });

  it("records queued and completed agent executions on the task", async () => {
    const tasks = service();
    const created = await tasks.create(olivia, {
      workspaceId: "workspace-1",
      title: "Delegate to an agent",
      priority: "P1",
      receiverType: "agent",
      receiverId: "agent-1",
      receiverName: "Backend DE",
      description: "Prepare a concise implementation note.",
      acceptance: ["Return a concise note"],
    });
    const queued = await tasks.attachAgentRun(
      created.id,
      {
        id: "run-1",
        instanceId: created.id,
        status: "queued",
      },
      "Backend DE",
    );
    expect(queued.status).toBe("progress");
    expect(queued.agentRunIds).toEqual(["run-1"]);
    expect(queued.messages[0]).toMatchObject({
      runId: "run-1",
      state: "queued",
      authorName: "Backend DE",
    });

    const completed = await tasks.attachAgentRun(
      created.id,
      {
        id: "run-1",
        instanceId: created.id,
        status: "succeeded",
        output: { summary: "Implementation note completed." },
      },
      "Backend DE",
    );
    expect(completed.messages).toHaveLength(1);
    expect(completed.messages[0]).toMatchObject({
      runId: "run-1",
      state: "succeeded",
      content: "Implementation note completed.",
    });
  });

  it("creates tasks in the requested initial status", async () => {
    const tasks = service();
    const created = await tasks.create(olivia, {
      workspaceId: "workspace-1",
      title: "Start in progress",
      priority: "P2",
      status: "progress",
      receiverType: "unassigned",
      description: "Created from a kanban column.",
      acceptance: ["Task is visible in the selected column"],
    });
    expect(created.status).toBe("progress");
  });

  it("auto-submits an agent task for review once the run succeeds", async () => {
    const tasks = service();
    const created = await tasks.create(olivia, {
      workspaceId: "workspace-1",
      title: "Auto submit on agent completion",
      priority: "P2",
      receiverType: "agent",
      receiverId: "agent-1",
      receiverName: "Backend DE",
      description: "Produce the release note.",
      acceptance: ["Release note is attached", "Risk list is present"],
    });
    expect(created.autoSubmitReview).toBe(true);

    await tasks.attachAgentRun(
      created.id,
      { id: "run-auto", instanceId: created.id, status: "running" },
      "Backend DE",
    );
    const completed = await tasks.attachAgentRun(
      created.id,
      {
        id: "run-auto",
        instanceId: created.id,
        status: "succeeded",
        output: { summary: "Release note ready." },
      },
      "Backend DE",
    );
    expect(completed.status).toBe("review");
    expect(completed.progress).toBeGreaterThanOrEqual(86);
    expect(completed.steps[0]?.done).toBe(true);
    expect(completed.events.at(-1)?.message).toContain("自动提交验收");
  });

  it("keeps an agent task in progress when auto submit is disabled", async () => {
    const tasks = service();
    const created = await tasks.create(olivia, {
      workspaceId: "workspace-1",
      title: "Manual review only",
      priority: "P2",
      receiverType: "agent",
      receiverId: "agent-1",
      receiverName: "Backend DE",
      description: "Stay in progress after completion.",
      acceptance: ["Manual hand-off"],
      autoSubmitReview: false,
    });
    expect(created.autoSubmitReview).toBe(false);

    const completed = await tasks.attachAgentRun(
      created.id,
      {
        id: "run-manual",
        instanceId: created.id,
        status: "succeeded",
        output: { summary: "Done, awaiting manual submit." },
      },
      "Backend DE",
    );
    expect(completed.status).toBe("progress");
    expect(completed.events.at(-1)?.message).toContain("返回了执行反馈");
  });

  it("does not auto-submit when the agent run fails", async () => {
    const tasks = service();
    const created = await tasks.create(olivia, {
      workspaceId: "workspace-1",
      title: "Failing agent run",
      priority: "P2",
      receiverType: "agent",
      receiverId: "agent-1",
      receiverName: "Backend DE",
      description: "Failure must not enter review.",
      acceptance: ["Failure stays in progress"],
    });

    await tasks.attachAgentRun(
      created.id,
      { id: "run-fail", instanceId: created.id, status: "running" },
      "Backend DE",
    );
    const failed = await tasks.attachAgentRun(
      created.id,
      {
        id: "run-fail",
        instanceId: created.id,
        status: "failed",
        error: "Tool crashed",
      },
      "Backend DE",
    );
    expect(failed.status).toBe("progress");
  });

  it("updates the auto submit flag from the task edit form", async () => {
    const tasks = service();
    const created = await tasks.create(olivia, {
      workspaceId: "workspace-1",
      title: "Toggle auto submit",
      priority: "P2",
      receiverType: "agent",
      receiverId: "agent-1",
      receiverName: "Backend DE",
      description: "Toggle the flag.",
      acceptance: ["Flag follows the checkbox"],
    });

    const off = await tasks.update(olivia, {
      taskId: created.id,
      title: created.title,
      priority: created.priority,
      description: created.description,
      acceptance: created.acceptance,
      autoSubmitReview: false,
    });
    expect(off.autoSubmitReview).toBe(false);
    const on = await tasks.update(olivia, {
      taskId: created.id,
      title: created.title,
      priority: created.priority,
      description: created.description,
      acceptance: created.acceptance,
      autoSubmitReview: true,
    });
    expect(on.autoSubmitReview).toBe(true);

    const untouched = await tasks.update(olivia, {
      taskId: created.id,
      title: created.title,
      priority: created.priority,
      description: created.description,
      acceptance: created.acceptance,
    });
    expect(untouched.autoSubmitReview).toBe(true);
  });

  it("archives and restores a task while keeping its history", async () => {
    const tasks = service();
    const created = await tasks.create(olivia, {
      workspaceId: "workspace-1",
      title: "Archive and restore",
      priority: "P3",
      receiverType: "unassigned",
      description: "Board cleanup candidate.",
      acceptance: ["Archive keeps history"],
    });
    expect(created.archivedAt).toBeUndefined();

    const archived = await tasks.archive(olivia, created.id);
    expect(archived.archivedAt).toBeTruthy();
    expect(archived.events.at(-1)).toMatchObject({
      kind: "archived",
      actorName: "Olivia",
    });
    expect(archived.steps).toHaveLength(1);

    const archivedAgain = await tasks.archive(olivia, created.id);
    expect(archivedAgain.events).toHaveLength(archived.events.length);

    const restored = await tasks.restore(olivia, created.id);
    expect(restored.archivedAt).toBeUndefined();
    expect(restored.events.at(-1)).toMatchObject({ kind: "restored" });
    expect(restored.events.map((event) => event.kind)).toEqual([
      "created",
      "archived",
      "restored",
    ]);

    const unchanged = await tasks.restore(olivia, created.id);
    expect(unchanged.events).toHaveLength(restored.events.length);
  });

  it("keeps archived tasks read-only until they are restored", async () => {
    const tasks = service();
    const created = await tasks.create(olivia, {
      workspaceId: "workspace-1",
      title: "Locked while archived",
      priority: "P2",
      receiverType: "unassigned",
      description: "Archived tasks must not be editable.",
      acceptance: ["Mutations are rejected"],
    });
    await tasks.archive(olivia, created.id);

    await expect(
      tasks.addMessage(olivia, { taskId: created.id, content: "补充指令" }),
    ).rejects.toMatchObject({ code: "conflict" });
    await expect(
      tasks.changeStatus(olivia, { taskId: created.id, status: "progress" }),
    ).rejects.toMatchObject({ code: "conflict" });
    await expect(
      tasks.assign(olivia, {
        taskId: created.id,
        receiverType: "human",
        receiverId: "olivia",
        receiverName: "Olivia",
      }),
    ).rejects.toMatchObject({ code: "conflict" });
    await expect(
      tasks.update(olivia, {
        taskId: created.id,
        title: "改过的标题",
        priority: "P1",
        description: "changed",
        acceptance: ["changed"],
      }),
    ).rejects.toMatchObject({ code: "conflict" });
    await expect(tasks.nudge(olivia, created.id)).rejects.toMatchObject({
      code: "conflict",
    });
    await expect(
      tasks.addComment(olivia, { taskId: created.id, content: "评论" }),
    ).rejects.toMatchObject({ code: "conflict" });

    await tasks.restore(olivia, created.id);
    const resumed = await tasks.addMessage(olivia, {
      taskId: created.id,
      content: "复原之后可以继续",
    });
    expect(resumed.messages).toHaveLength(1);
    expect(resumed.messages[0]?.content).toBe("复原之后可以继续");
  });

  it("lists workspace files produced during an agent run, newest first", async () => {
    const root = await mkdtemp(join(tmpdir(), "task-documents-"));
    const now = Date.now();
    const inside = new Date(now - 30_000);
    const outside = new Date(now - 3 * 60 * 60 * 1000);
    await writeFile(join(root, "产品PRD.md"), "# 需求\n", "utf8");
    await mkdir(join(root, "src"), { recursive: true });
    await writeFile(join(root, "src", "index.ts"), "export {};\n", "utf8");
    await mkdir(join(root, "node_modules", "left-pad"), { recursive: true });
    await writeFile(
      join(root, "node_modules", "left-pad", "index.js"),
      "",
      "utf8",
    );
    await utimes(join(root, "产品PRD.md"), inside, inside);
    await utimes(join(root, "src", "index.ts"), outside, outside);
    await utimes(
      join(root, "node_modules", "left-pad", "index.js"),
      inside,
      inside,
    );
    await writeFile(join(root, ".DS_Store"), "junk", "utf8");
    await utimes(join(root, ".DS_Store"), inside, inside);

    const windows = windowsFromRuns(
      [
        {
          startedAt: new Date(now - 120_000).toISOString(),
          endedAt: new Date(now).toISOString(),
          actor: "Pluginmax DE",
        },
      ],
      "Agent",
      now,
    );
    const documents = await collectDocuments({ root, windows });

    expect(documents.map((document) => document.relativePath)).toEqual([
      "产品PRD.md",
    ]);
    expect(documents[0]).toMatchObject({
      kind: "produced",
      name: "产品PRD.md",
      updatedBy: "Pluginmax DE",
      mimeType: "text/markdown; charset=utf-8",
      available: true,
    });
  });

  it("keeps files a subagent writes after the run settled", async () => {
    const root = await mkdtemp(join(tmpdir(), "task-documents-"));
    const now = Date.now();
    const afterSettle = new Date(now - 30_000);
    await writeFile(join(root, "五子棋PRD.md"), "# PRD\n", "utf8");
    await utimes(join(root, "五子棋PRD.md"), afterSettle, afterSettle);

    const windows = windowsFromRuns(
      [
        {
          startedAt: new Date(now - 10 * 60_000).toISOString(),
          endedAt: new Date(now - 8 * 60_000).toISOString(),
          actor: "DE 测小白",
        },
      ],
      "Agent",
      now,
    );
    const documents = await collectDocuments({ root, windows });
    expect(documents.map((document) => document.relativePath)).toEqual([
      "五子棋PRD.md",
    ]);
    expect(documents[0]?.updatedBy).toBe("DE 测小白");
  });

  it("ignores files touched outside every run window", async () => {
    const root = await mkdtemp(join(tmpdir(), "task-documents-"));
    const now = Date.now();
    const old = new Date(now - 6 * 60 * 60 * 1000);
    await writeFile(join(root, "notes.md"), "older\n", "utf8");
    await utimes(join(root, "notes.md"), old, old);

    const documents = await collectDocuments({
      root,
      windows: windowsFromRuns(
        [
          {
            startedAt: new Date(now - 60_000).toISOString(),
            endedAt: new Date(now).toISOString(),
            actor: "Pluginmax DE",
          },
        ],
        "Agent",
        now,
      ),
    });
    expect(documents).toEqual([]);
    expect(
      await collectDocuments({ root, windows: [] }),
    ).toEqual([]);
  });

  it("falls back to the task owner name and sanitizes upload names", () => {
    const now = Date.now();
    const [window] = windowsFromRuns(
      [{ createdAt: new Date(now).toISOString(), actor: "" }],
      "Pluginmax DE",
      now,
    );
    expect(window).toMatchObject({
      actor: "Pluginmax DE",
      from: now - 5_000,
      to: now,
    });
    expect(safeFileName("../../etc/passwd")).toBe("passwd");
    expect(safeFileName("a/b\\c:d.txt")).toBe("b_c_d.txt");
    expect(safeFileName("   ")).toBe("file");
  });

  it("lists stored uploads and keeps the newest copy of a file", () => {
    const uploaded = attachmentDocuments(
      {
        messages: [
          {
            id: "message-1",
            at: "2026-09-23T01:00:00.000Z",
            authorId: "admin",
            authorName: "Admin",
            kind: "human",
            content: "带附件的说明",
            attachments: [
              {
                name: "需求.md",
                size: 12,
                mimeType: "text/markdown",
                storedPath: ".pluginmax/task-uploads/TSK-1/需求.md",
              },
            ],
          },
          {
            id: "message-2",
            at: "2026-09-23T02:00:00.000Z",
            authorId: "admin",
            authorName: "Admin",
            kind: "human",
            content: "历史附件",
            attachments: [{ name: "旧附件.txt" }],
          },
        ],
      },
      true,
    );
    expect(uploaded).toHaveLength(2);
    expect(uploaded[0]).toMatchObject({
      kind: "uploaded",
      name: "需求.md",
      relativePath: ".pluginmax/task-uploads/TSK-1/需求.md",
      updatedBy: "Admin",
      updatedAt: "2026-09-23T01:00:00.000Z",
      available: true,
    });
    expect(uploaded[1]).toMatchObject({
      name: "旧附件.txt",
      relativePath: "",
      available: false,
    });

    const merged = mergeDocuments([
      {
        id: "produced:需求.md",
        kind: "produced",
        name: "需求.md",
        relativePath: "需求.md",
        size: 10,
        mimeType: "text/markdown; charset=utf-8",
        updatedBy: "Pluginmax DE",
        updatedAt: "2026-09-23T01:30:00.000Z",
        available: true,
      },
      {
        id: "produced:需求.md",
        kind: "produced",
        name: "需求.md",
        relativePath: "需求.md",
        size: 32,
        mimeType: "text/markdown; charset=utf-8",
        updatedBy: "Pluginmax DE",
        updatedAt: "2026-09-23T03:00:00.000Z",
        available: true,
      },
    ]);
    expect(merged).toHaveLength(1);
    expect(merged[0]?.size).toBe(32);
  });
});

function fakeRequest(options: {
  method: string;
  url: string;
  token?: string;
  body?: unknown;
}): IncomingMessage {
  const chunks =
    options.body === undefined
      ? []
      : [Buffer.from(JSON.stringify(options.body), "utf8")];
  return {
    method: options.method,
    url: options.url,
    headers: {
      host: "localhost:3210",
      origin: "http://localhost:3210",
      authorization: `Bearer ${options.token ?? "token"}`,
    },
    async *[Symbol.asyncIterator]() {
      for (const chunk of chunks) yield chunk;
    },
  } as unknown as IncomingMessage;
}

function fakeResponse(): {
  response: ServerResponse;
  read: () => { status: number; body: Record<string, unknown> | null };
} {
  let payload = "";
  const response: {
    statusCode: number;
    writeHead: (status: number) => void;
    setHeader: () => void;
    end: (chunk?: unknown) => void;
  } = {
    statusCode: 200,
    writeHead: (status) => {
      response.statusCode = status;
    },
    setHeader: () => undefined,
    end: (chunk?: unknown) => {
      payload += chunk === undefined ? "" : String(chunk);
    },
  };
  return {
    response: response as unknown as ServerResponse,
    read: () => ({
      status: response.statusCode,
      body:
        payload === ""
          ? null
          : (JSON.parse(payload) as Record<string, unknown>),
    }),
  };
}

describe("teammate task assignment", () => {
  it("lists AI Teammates as receivers and provisions the runtime on dispatch", async () => {
    const tasks = service();
    const dispatched: Array<Record<string, unknown>> = [];
    const ensured: Array<{ teammateId: string; workspaceId: string }> = [];
    const routes = createTaskRoutes(
      tasks,
      {
        resolveToken: (candidate) =>
          candidate === "token"
            ? { userId: "admin", role: "admin" }
            : undefined,
        users: () => [{ id: "admin", name: "Admin", role: "admin" }],
        members: () => [{ userId: "admin", memberRole: "owner" }],
      },
      undefined,
      undefined,
      () => ({
        bindTask: () => undefined,
        dispatch: async (input) => {
          dispatched.push(input as unknown as Record<string, unknown>);
          return {
            id: "run-1",
            instanceId: String(
              (input as unknown as { instanceId: string }).instanceId,
            ),
            status: "queued" as const,
          };
        },
      }),
      {
        get: () => ({ id: "workspace-1", path: "/tmp/workspace-1" }),
        list: () => [{ id: "workspace-1", path: "/tmp/workspace-1" }],
      },
      () => ({
        assignable: () => [
          {
            id: "tm-1",
            name: "测小白",
            ownerName: "平台",
            source: "platform" as const,
            avatar: "",
          },
        ],
        ensureRuntime: async (input) => {
          ensured.push({
            teammateId: input.teammateId,
            workspaceId: input.workspaceId,
          });
          return {
            teammateId: input.teammateId,
            employeeId: "digital-1",
            profileId: "agent-1",
            personaId: "persona-tm-1",
          };
        },
      }),
    );

    const bootstrap = routes.find(
      (route) => route.path === "/api/collab/tasks/bootstrap",
    );
    expect(bootstrap).toBeDefined();
    const listed = fakeResponse();
    await bootstrap?.handler(
      fakeRequest({
        method: "GET",
        url: "/api/collab/tasks/bootstrap?workspaceId=workspace-1",
      }),
      listed.response,
    );
    const listResult = listed.read();
    expect(listResult.status).toBe(200);
    const directory = listResult.body?.directory as {
      agents: Array<{ id: string; name: string }>;
    };
    expect(
      directory.agents.some(
        (agent) => agent.id === "tm-1" && agent.name === "测小白",
      ),
    ).toBe(true);

    const create = routes.find(
      (route) => route.path === "/api/collab/tasks/create",
    );
    expect(create).toBeDefined();
    const created = fakeResponse();
    await create?.handler(
      fakeRequest({
        method: "POST",
        url: "/api/collab/tasks/create",
        body: {
          workspaceId: "workspace-1",
          title: "交给测小白的任务",
          priority: "P2",
          receiverType: "agent",
          receiverId: "tm-1",
          receiverName: "测小白",
          description: "验证 teammate 派发链路",
          acceptance: ["可以派发"],
        },
      }),
      created.response,
    );
    const createResult = created.read();
    expect(createResult.status).toBe(200);
    expect(ensured).toEqual([
      { teammateId: "tm-1", workspaceId: "workspace-1" },
    ]);
    expect(dispatched).toHaveLength(1);
    expect(dispatched[0]).toMatchObject({
      profileId: "agent-1",
      employeeId: "digital-1",
      personaId: "persona-tm-1",
      source: "task",
    });
  });
});

interface CapturedRun {
  id: string;
  instanceId: string;
  status: "queued";
  payload: { context: Record<string, string> };
}

function contextHarness() {
  const tasks = service();
  const dispatched: Array<{
    profileId: string;
    payload: { context: Record<string, string> };
  }> = [];
  const runs = new Map<string, CapturedRun>();
  const routes = createTaskRoutes(
    tasks,
    {
      resolveToken: (candidate) =>
        candidate === "token" ? { userId: "admin", role: "admin" } : undefined,
      users: () => [{ id: "admin", name: "Admin", role: "admin" }],
      members: () => [{ userId: "admin", memberRole: "owner" }],
    },
    undefined,
    undefined,
    () => ({
      bindTask: () => undefined,
      dispatch: async (input) => {
        const id = `run-${String(runs.size + 1)}`;
        const run: CapturedRun = {
          id,
          instanceId: (input as unknown as { instanceId: string }).instanceId,
          status: "queued",
          payload: (input as unknown as { payload: { context: Record<string, string> } })
            .payload,
        };
        runs.set(id, run);
        dispatched.push({
          profileId: (input as unknown as { profileId: string }).profileId,
          payload: run.payload,
        });
        return run;
      },
      run: (runId: string) => runs.get(runId),
    }),
    {
      get: () => ({ id: "workspace-1", path: "/tmp/workspace-1" }),
      list: () => [{ id: "workspace-1", path: "/tmp/workspace-1" }],
    },
    () => ({
      assignable: () => [
        {
          id: "tm-1",
          name: "测小白",
          ownerName: "平台",
          source: "platform" as const,
          avatar: "",
        },
      ],
      ensureRuntime: async (input) => ({
        teammateId: input.teammateId,
        employeeId: "digital-1",
        profileId: "agent-1",
        personaId: "persona-tm-1",
      }),
    }),
  );
  const route = (path: string) => {
    const found = routes.find((candidate) => candidate.path === path);
    if (found === undefined) throw new Error(`missing route ${path}`);
    return found;
  };
  return { tasks, dispatched, runs, route };
}

describe("task context delivery", () => {
  it("delivers the full task context once, then only increments", async () => {
    const { tasks, route, dispatched } = contextHarness();
    const created = fakeResponse();
    await route("/api/collab/tasks/create").handler(
      fakeRequest({
        method: "POST",
        url: "/api/collab/tasks/create",
        body: {
          workspaceId: "workspace-1",
          title: "优化产品设计文档",
          priority: "P2",
          receiverType: "agent",
          receiverId: "tm-1",
          receiverName: "测小白",
          description: "把已生成的产品设计文档检查一遍并优化。",
          acceptance: ["文档结构完整", "补充风险章节"],
        },
      }),
      created.response,
    );
    const createResult = created.read();
    expect(createResult.status).toBe(200);
    const task = (createResult.body?.task ?? {}) as { id: string };
    expect(dispatched).toHaveLength(1);
    const first = dispatched[0]?.payload.context.instruction ?? "";
    expect(first).toContain("# 任务");
    expect(first).toContain("把已生成的产品设计文档检查一遍并优化。");
    expect(first).toContain("## 验收标准");
    expect(first).toContain("## 本次需要你响应");
    expect(dispatched[0]?.payload.context.firstDelivery).toBe("true");

    // 模拟 Agent 完成一轮：它的回复已经写进会话历史，增量不应再回灌
    await tasks.attachAgentRun(
      task.id,
      {
        id: "run-1",
        instanceId: task.id,
        status: "succeeded",
        output: { summary: "这是 Agent 的旧结论" },
      },
      "测小白",
    );

    // 评论区不 @ 执行人 = 讨论：只记录，不触发执行
    const discussion = fakeResponse();
    await route("/api/collab/tasks/comment").handler(
      fakeRequest({
        method: "POST",
        url: "/api/collab/tasks/comment",
        body: { taskId: task.id, content: "我们内部再确认一下风险章节的口径。" },
      }),
      discussion.response,
    );
    expect(discussion.read().body?.dispatched).toBe(false);
    expect(dispatched).toHaveLength(1);

    // 指令输入框：不 @ 也直接触发，且只投递增量
    const followUp = fakeResponse();
    await route("/api/collab/tasks/message").handler(
      fakeRequest({
        method: "POST",
        url: "/api/collab/tasks/message",
        body: { taskId: task.id, content: "请按确认后的口径更新风险章节。" },
      }),
      followUp.response,
    );
    expect(followUp.read().status).toBe(200);
    expect(dispatched).toHaveLength(2);
    const second = dispatched[1]?.payload.context.instruction ?? "";
    expect(second).not.toContain("# 任务");
    expect(second).toContain("## 上次投递之后的新增讨论");
    expect(second).not.toContain("这是 Agent 的旧结论");
    expect(second).toContain("请按确认后的口径更新风险章节。");
    expect(dispatched[1]?.payload.context.firstDelivery).toBe("false");
    expect(dispatched[1]?.payload.context.taskReceiverId).toBe("tm-1");

    // 评论里 @ 执行人：也触发一次
    const mention = fakeResponse();
    await route("/api/collab/tasks/comment").handler(
      fakeRequest({
        method: "POST",
        url: "/api/collab/tasks/comment",
        body: { taskId: task.id, content: "@测小白 风险章节还差一条指标说明。" },
      }),
      mention.response,
    );
    expect(mention.read().status).toBe(200);
    expect(dispatched).toHaveLength(3);
    expect(dispatched[2]?.payload.context.instruction).toContain(
      "@测小白 风险章节还差一条指标说明。",
    );

    // 重置执行会话：下一次执行换新会话，并重新注入完整上下文
    const reset = fakeResponse();
    await route("/api/collab/tasks/session/reset").handler(
      fakeRequest({
        method: "POST",
        url: "/api/collab/tasks/session/reset",
        body: { taskId: task.id },
      }),
      reset.response,
    );
    const resetResult = reset.read();
    expect(resetResult.status).toBe(200);
    expect(
      (resetResult.body?.task as { sessionEpoch?: number } | undefined)
        ?.sessionEpoch,
    ).toBe(1);
    const afterReset = fakeResponse();
    await route("/api/collab/tasks/message").handler(
      fakeRequest({
        method: "POST",
        url: "/api/collab/tasks/message",
        body: { taskId: task.id, content: "@测小白 按新会话重新开始。" },
      }),
      afterReset.response,
    );
    expect(dispatched).toHaveLength(4);
    expect(dispatched[3]?.payload.context.taskSessionEpoch).toBe("1");
    expect(dispatched[3]?.payload.context.firstDelivery).toBe("true");
    expect(dispatched[3]?.payload.context.instruction).toContain("# 任务");
  });
});
