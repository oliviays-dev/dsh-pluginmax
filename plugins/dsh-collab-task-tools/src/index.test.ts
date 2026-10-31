import { describe, expect, it } from "vitest";
import { apply } from "./index.js";

interface RegisteredTool {
  readonly name: string;
  execute(
    args: unknown,
    exec: {
      readonly callId: string;
      readonly signal: AbortSignal;
      readonly agent?: { readonly session?: { readonly id?: string } };
    },
  ): Promise<string>;
}

function harness() {
  const tools: RegisteredTool[] = [];
  const routes: Array<{ path: string }> = [];
  const run = {
    id: "run-1",
    workspaceId: "workspace-1",
    source: "task" as const,
    instanceId: "task-1",
    profileId: "profile-1",
    principalId: "principal:agent-1",
    sessionId: "session-1",
    status: "running",
    createdBy: "olivia",
    payload: { profileName: "Worker Agent" },
  };
  const task = {
    id: "task-1",
    workspaceId: "workspace-1",
    title: "Check supplier risk",
    type: "任务",
    status: "progress",
    priority: "P1",
    description: "Review supplier risk.",
    acceptance: ["Risk list is complete"],
    createdBy: "olivia",
    createdByName: "Olivia",
    receiverType: "agent",
    receiverId: "agent-1",
    receiverPrincipalId: "principal:agent-1",
    receiverName: "Worker Agent",
    needsInput: false,
    progress: 20,
    updatedAt: "2026-10-30T00:00:00.000Z",
    messages: [],
  };
  const child = {
    tools: {
      register(definition: RegisteredTool) {
        tools.push(definition);
        return () => undefined;
      },
    },
    webServer: {
      register(route: { path: string }) {
        routes.push(route);
        return () => undefined;
      },
    },
    effect: () => undefined,
    get(key: string) {
      if (key === "collabAgent") {
        return {
          run: (id: string) => (id === run.id ? run : undefined),
          runs: () => [run],
        };
      }
      if (key === "collabTasks") {
        return {
          list: () => [task],
          get: (id: string) => {
            if (id !== task.id) throw new Error("not found");
            return task;
          },
        };
      }
      if (key === "collabTaskCapture") {
        return {
          prepare: async () => ({ session: {}, candidates: [] }),
          save: async () => ({ batch: {}, drafts: [] }),
          batch: () => ({ batch: {}, drafts: [] }),
          events: () => [],
          session: () => ({ session: { workspaceId: "workspace-1" } }),
        };
      }
      if (key === "collabTaskExecution") {
        return {
          reportProgress: async () => ({ ...task, progress: 55 }),
          requestInput: async () => ({ ...task, needsInput: true }),
          submitDeliverable: async () => ({ ...task, status: "review" }),
          addComment: async () => task,
        };
      }
      if (key === "collabTeam") {
        return {
          resolveToken: () => ({ userId: "olivia", role: "admin" }),
          users: () => [{ id: "olivia", name: "Olivia", role: "admin" }],
        };
      }
      return undefined;
    },
  };
  const ctx = {
    tools: child.tools,
    webServer: child.webServer,
    effect: child.effect,
    get: child.get,
    inject: (
      _keys: readonly string[],
      callback: (value: typeof child) => void,
    ) => callback(child),
  };
  return { ctx, tools, routes };
}

describe("task tools", () => {
  it("registers task capability packs and stable HTTP facade routes", async () => {
    const { ctx, tools, routes } = harness();
    await apply(ctx as never);
    expect(tools.map((tool) => tool.name)).toEqual([
      "task_query",
      "task_capture_prepare",
      "task_capture_save",
      "task_capture_batch",
      "task_capture_events",
      "task_report_progress",
      "task_request_input",
      "task_submit_deliverable",
      "task_comment",
    ]);
    expect(routes.map((route) => route.path)).toEqual([
      "/api/collab/task-tools/catalog",
      "/api/collab/task-tools/invoke",
      "/api/collab/task-tools/mcp",
    ]);
  });

  it("queries only tasks assigned to the current Agent run", async () => {
    const { ctx, tools } = harness();
    await apply(ctx as never);
    const query = tools.find((tool) => tool.name === "task_query");
    const result = JSON.parse(
      await query!.execute(
        { action: "list_mine" },
        {
          callId: "call-1",
          signal: new AbortController().signal,
          agent: { session: { id: "session-1" } },
        },
      ),
    );
    expect(result).toMatchObject({
      ok: true,
      tool: "task_query",
      data: [{ id: "task-1", status: "progress" }],
    });
  });

  it("reports progress through the execution port", async () => {
    const { ctx, tools } = harness();
    await apply(ctx as never);
    const report = tools.find((tool) => tool.name === "task_report_progress");
    const result = JSON.parse(
      await report!.execute(
        {
          taskId: "task-1",
          progress: 55,
          summary: "Evidence reviewed.",
          completedStepIds: [],
        },
        {
          callId: "call-2",
          signal: new AbortController().signal,
          agent: { session: { id: "session-1" } },
        },
      ),
    );
    expect(result).toMatchObject({
      ok: true,
      tool: "task_report_progress",
      data: { id: "task-1", progress: 55 },
    });
  });
});
