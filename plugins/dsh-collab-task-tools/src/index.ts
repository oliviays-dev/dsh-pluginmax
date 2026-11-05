import { randomUUID } from "node:crypto";
import type { IncomingMessage, ServerResponse } from "node:http";
import {
  taskToolCatalogSchema,
  taskToolResultSchema,
  type TaskCaptureActor,
  type TaskCaptureSessionProjection,
  type TaskDraftBatchProjection,
  type TaskToolCatalog,
  type TaskToolName,
  type TaskToolResult,
} from "@pluginmax/contracts";
import {
  bearerToken,
  readJsonBody,
  sameOrigin,
  sendJson,
} from "@pluginmax/shared";
import { z } from "zod";

export const name = "dsh-collab-task-tools";
export const inject = ["tools", "webServer"];

interface ToolExecLike {
  readonly callId?: string;
  readonly signal: AbortSignal;
  readonly agent?: {
    readonly session?: { readonly id?: string };
  };
}

interface ToolDefinitionLike {
  readonly name: string;
  readonly description: string;
  readonly parameters: Record<string, unknown>;
  readonly output: {
    readonly schema: { readonly type: "string" };
    render(
      args: unknown,
      value: string,
    ): Array<{ readonly type: "text"; readonly text: string }>;
  };
  execute(args: unknown, exec: ToolExecLike): Promise<string>;
}

interface AgentRunLike {
  readonly id: string;
  readonly workspaceId: string;
  readonly source: "workflow" | "task" | "meeting" | "chat";
  readonly instanceId: string;
  readonly profileId: string;
  readonly principalId?: string | undefined;
  readonly sessionId?: string | undefined;
  readonly status: string;
  readonly createdBy: string;
  readonly payload: {
    readonly profileName: string;
  };
}

interface AgentServiceLike {
  run(runId: string): AgentRunLike | undefined;
  runs(filter?: {
    readonly workspaceId?: string | undefined;
    readonly instanceId?: string | undefined;
  }): readonly AgentRunLike[];
}

interface TaskLike {
  readonly id: string;
  readonly workspaceId: string;
  readonly title: string;
  readonly type: string;
  readonly status: string;
  readonly priority: string;
  readonly description: string;
  readonly acceptance: readonly string[];
  readonly due?: string | undefined;
  readonly createdBy: string;
  readonly createdByName: string;
  readonly receiverType: string;
  readonly receiverId?: string | undefined;
  readonly receiverPrincipalId?: string | undefined;
  readonly receiverName?: string | undefined;
  readonly needsInput: boolean;
  readonly progress: number;
  readonly updatedAt: string;
  readonly messages: readonly {
    readonly authorName: string;
    readonly content: string;
    readonly at: string;
    readonly state?: string | undefined;
  }[];
}

interface TaskServiceLike {
  list(workspaceId: string): readonly TaskLike[];
  get(taskId: string): TaskLike;
}

interface CaptureServiceLike {
  prepare(
    actor: TaskCaptureActor,
    input: unknown,
  ): Promise<TaskCaptureSessionProjection>;
  save(
    actor: TaskCaptureActor,
    input: unknown,
  ): Promise<TaskDraftBatchProjection>;
  batch(actor: TaskCaptureActor, batchId: string): TaskDraftBatchProjection;
  events(
    actor: TaskCaptureActor,
    workspaceId: string,
    after?: string,
  ): readonly unknown[];
}

interface TaskExecutionServiceLike {
  reportProgress(actor: unknown, input: unknown): Promise<TaskLike>;
  requestInput(actor: unknown, input: unknown): Promise<TaskLike>;
  submitDeliverable(actor: unknown, input: unknown): Promise<TaskLike>;
  addComment(actor: unknown, input: unknown): Promise<TaskLike>;
}

interface TeamServiceLike {
  resolveToken(
    token: string,
  ): { readonly userId: string; readonly role?: string } | undefined;
  users(): readonly {
    readonly id: string;
    readonly name: string;
    readonly role?: string;
  }[];
}

interface WebRouteLike {
  readonly kind: "exact";
  readonly path: string;
  handler(
    request: IncomingMessage,
    response: ServerResponse,
  ): Promise<void> | void;
}

interface TaskToolsContext {
  tools: { register(definition: ToolDefinitionLike): () => void };
  webServer: { register(route: WebRouteLike): unknown };
  effect(operation: () => () => void): void;
  get(key: string): unknown;
  inject(
    keys: readonly string[],
    callback: (child: TaskToolsContext) => void,
  ): { dispose(): void };
}

const taskQueryArgsSchema = z.object({
  action: z.enum(["search", "get", "list_mine", "list_attention"]),
  taskId: z.string().trim().min(1).max(160).optional(),
  query: z.string().trim().max(1_000).optional(),
  limit: z.number().int().min(1).max(100).default(20),
});

const capturePrepareArgsSchema = z.object({
  sourceType: z.string().trim().min(1).max(80),
  sourceId: z.string().trim().min(1).max(240),
  sourceTitle: z.string().trim().max(300).optional(),
  messageIds: z.array(z.string().min(1).max(240)).max(200).default([]),
  actionItemIds: z.array(z.string().min(1).max(240)).max(200).default([]),
  reportSectionIds: z.array(z.string().min(1).max(240)).max(200).default([]),
  commandId: z.string().trim().min(1).max(240).optional(),
});

const captureSaveArgsSchema = z.object({
  sessionId: z.string().min(1).max(240),
  candidateIds: z.array(z.string().min(1).max(240)).min(1).max(100),
  expectedRevision: z.number().int().positive(),
  commandId: z.string().trim().min(1).max(240).optional(),
});

const captureBatchArgsSchema = z.object({
  batchId: z.string().min(1).max(240),
});

const captureEventsArgsSchema = z.object({
  after: z.string().datetime({ precision: 3 }).optional(),
});

const reportProgressArgsSchema = z.object({
  taskId: z.string().min(1).max(160),
  progress: z.number().int().min(0).max(100),
  summary: z.string().trim().min(1).max(20_000),
  completedStepIds: z.array(z.string().min(1).max(160)).max(30).default([]),
});

const requestInputArgsSchema = z.object({
  taskId: z.string().min(1).max(160),
  question: z.string().trim().min(1).max(20_000),
});

const submitDeliverableArgsSchema = z.object({
  taskId: z.string().min(1).max(160),
  summary: z.string().trim().min(1).max(20_000),
  completedStepIds: z.array(z.string().min(1).max(160)).max(30).default([]),
  attachments: z
    .array(
      z.object({
        name: z.string().min(1).max(300),
        size: z.number().int().nonnegative().optional(),
        mimeType: z.string().max(200).optional(),
        storedPath: z.string().max(500).optional(),
      }),
    )
    .max(50)
    .default([]),
});

const commentArgsSchema = z.object({
  taskId: z.string().min(1).max(160),
  content: z.string().trim().min(1).max(8_000),
  isKeyConsensus: z.boolean().default(false),
});

const stringOutput = {
  schema: { type: "string" as const },
  render: (_args: unknown, value: string) => [
    { type: "text" as const, text: value },
  ],
};

const catalog: TaskToolCatalog = taskToolCatalogSchema.parse({
  protocol: "pluginmax-task-tools-v1",
  tools: [
    {
      name: "task_query",
      capability: "task.read.v1",
      description:
        "Search, get, or list tasks visible in the current run context.",
      sideEffect: "none",
    },
    {
      name: "task_capture_prepare",
      capability: "task.capture.v1",
      description:
        "Prepare task draft candidates from an authorized source conversation.",
      sideEffect: "draft-write",
    },
    {
      name: "task_capture_save",
      capability: "task.capture.v1",
      description:
        "Save selected candidates as task drafts without creating formal tasks.",
      sideEffect: "draft-write",
    },
    {
      name: "task_capture_batch",
      capability: "task.capture.v1",
      description: "Read a task draft batch and its drafts.",
      sideEffect: "none",
    },
    {
      name: "task_capture_events",
      capability: "task.capture.v1",
      description:
        "Read task draft events after a timestamp for source reconciliation.",
      sideEffect: "none",
    },
    {
      name: "task_report_progress",
      capability: "task.execute.v1",
      description:
        "Report structured execution progress for a task assigned to this Agent.",
      sideEffect: "task-write",
    },
    {
      name: "task_request_input",
      capability: "task.execute.v1",
      description: "Ask the task owner for missing information.",
      sideEffect: "task-write",
    },
    {
      name: "task_submit_deliverable",
      capability: "task.execute.v1",
      description:
        "Submit a deliverable and completed acceptance items for review.",
      sideEffect: "task-write",
    },
    {
      name: "task_comment",
      capability: "task.execute.v1",
      description:
        "Add a collaboration comment or explicitly mark key consensus.",
      sideEffect: "task-write",
    },
  ],
});

function taskProjection(task: TaskLike) {
  return {
    id: task.id,
    workspaceId: task.workspaceId,
    title: task.title,
    type: task.type,
    status: task.status,
    priority: task.priority,
    description: task.description,
    acceptance: task.acceptance,
    due: task.due ?? null,
    createdBy: task.createdBy,
    createdByName: task.createdByName,
    receiver: {
      type: task.receiverType,
      id: task.receiverId ?? null,
      principalId: task.receiverPrincipalId ?? null,
      name: task.receiverName ?? null,
    },
    needsInput: task.needsInput,
    progress: task.progress,
    updatedAt: task.updatedAt,
    latestMessage: task.messages.length === 0 ? null : task.messages.at(-1),
  };
}

function matchesExecutor(
  task: TaskLike,
  actor: { readonly id: string; readonly principalId?: string | undefined },
): boolean {
  return (
    (task.receiverPrincipalId !== undefined &&
      actor.principalId === task.receiverPrincipalId) ||
    (task.receiverId !== undefined &&
      (actor.id === task.receiverId ||
        (actor.principalId !== undefined &&
          task.receiverId === actor.principalId)))
  );
}

function resolveRun(
  agent: AgentServiceLike,
  exec?: ToolExecLike,
  runId?: string,
): AgentRunLike | undefined {
  if (runId !== undefined) return agent.run(runId);
  const sessionId = exec?.agent?.session?.id;
  if (sessionId === undefined) return undefined;
  return agent
    .runs()
    .find(
      (run) =>
        run.sessionId === sessionId &&
        run.status !== "succeeded" &&
        run.status !== "failed" &&
        run.status !== "cancelled",
    );
}

function userActor(run: AgentRunLike, team: TeamServiceLike): TaskCaptureActor {
  const user = team.users().find((candidate) => candidate.id === run.createdBy);
  return {
    id: run.createdBy,
    name: user?.name ?? run.createdBy,
    kind: "human",
    ...(user?.role === "admin" ||
    user?.role === "owner" ||
    user?.role === "member" ||
    user?.role === "guest"
      ? { role: user.role }
      : {}),
  };
}

function agentActor(run: AgentRunLike) {
  return {
    id: run.principalId ?? run.profileId,
    name: run.payload.profileName,
    kind: "agent" as const,
    ...(run.principalId === undefined ? {} : { principalId: run.principalId }),
  };
}

function jsonResult(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

async function executeTool(input: {
  readonly tool: TaskToolName;
  readonly args: unknown;
  readonly run: AgentRunLike;
  readonly tasks: TaskServiceLike;
  readonly capture: CaptureServiceLike;
  readonly execution: TaskExecutionServiceLike;
  readonly team: TeamServiceLike;
  readonly commandId: string;
}): Promise<TaskToolResult> {
  const user = userActor(input.run, input.team);
  const agent = agentActor(input.run);
  try {
    switch (input.tool) {
      case "task_query": {
        const args = taskQueryArgsSchema.parse(input.args);
        const tasks = input.tasks.list(input.run.workspaceId);
        const visible = tasks.filter(
          (task) =>
            matchesExecutor(task, agent) ||
            (input.run.source === "task" && input.run.instanceId === task.id),
        );
        let selected: readonly TaskLike[];
        if (args.action === "get") {
          if (args.taskId === undefined) {
            throw new Error("taskId is required");
          }
          const task = input.tasks.get(args.taskId);
          if (
            task.workspaceId !== input.run.workspaceId ||
            (!matchesExecutor(task, agent) &&
              !(
                input.run.source === "task" && input.run.instanceId === task.id
              ))
          ) {
            throw new Error("task access is required");
          }
          selected = [task];
        } else if (args.action === "list_mine") {
          selected = visible;
        } else if (args.action === "list_attention") {
          selected = visible.filter(
            (task) =>
              task.needsInput ||
              task.status === "progress" ||
              task.status === "review",
          );
        } else {
          const query = (args.query ?? "").toLowerCase();
          selected = visible.filter((task) =>
            [task.title, task.id, task.description]
              .join(" ")
              .toLowerCase()
              .includes(query),
          );
        }
        return taskToolResultSchema.parse({
          ok: true,
          tool: input.tool,
          data: selected.slice(0, args.limit).map(taskProjection),
        });
      }
      case "task_capture_prepare": {
        const args = capturePrepareArgsSchema.parse(input.args);
        const result = await input.capture.prepare(user, {
          sourceRef: {
            sourceType: args.sourceType,
            sourceId: args.sourceId,
            ...(args.sourceTitle === undefined
              ? {}
              : { sourceTitle: args.sourceTitle }),
          },
          selection: {
            messageIds: args.messageIds,
            actionItemIds: args.actionItemIds,
            reportSectionIds: args.reportSectionIds,
          },
          commandId: args.commandId ?? input.commandId,
        });
        return taskToolResultSchema.parse({
          ok: true,
          tool: input.tool,
          data: result,
        });
      }
      case "task_capture_save": {
        const args = captureSaveArgsSchema.parse(input.args);
        const session = (
          input.capture as CaptureServiceLike & {
            session?(
              actor: TaskCaptureActor,
              sessionId: string,
            ): TaskCaptureSessionProjection;
          }
        ).session?.(user, args.sessionId);
        if (session === undefined) {
          throw new Error("capture session is unavailable");
        }
        const result = await input.capture.save(user, {
          sessionId: args.sessionId,
          candidateIds: args.candidateIds,
          expectedRevision: args.expectedRevision,
          commandId: args.commandId ?? input.commandId,
          workspaceId: session.session.workspaceId,
        });
        return taskToolResultSchema.parse({
          ok: true,
          tool: input.tool,
          data: result,
        });
      }
      case "task_capture_batch": {
        const args = captureBatchArgsSchema.parse(input.args);
        return taskToolResultSchema.parse({
          ok: true,
          tool: input.tool,
          data: input.capture.batch(user, args.batchId),
        });
      }
      case "task_capture_events": {
        const args = captureEventsArgsSchema.parse(input.args);
        return taskToolResultSchema.parse({
          ok: true,
          tool: input.tool,
          data: input.capture.events(user, input.run.workspaceId, args.after),
        });
      }
      case "task_report_progress": {
        const args = reportProgressArgsSchema.parse(input.args);
        const task = await input.execution.reportProgress(agent, args);
        return taskToolResultSchema.parse({
          ok: true,
          tool: input.tool,
          data: taskProjection(task),
        });
      }
      case "task_request_input": {
        const args = requestInputArgsSchema.parse(input.args);
        const task = await input.execution.requestInput(agent, args);
        return taskToolResultSchema.parse({
          ok: true,
          tool: input.tool,
          data: taskProjection(task),
        });
      }
      case "task_submit_deliverable": {
        const args = submitDeliverableArgsSchema.parse(input.args);
        const task = await input.execution.submitDeliverable(agent, args);
        return taskToolResultSchema.parse({
          ok: true,
          tool: input.tool,
          data: taskProjection(task),
        });
      }
      case "task_comment": {
        const args = commentArgsSchema.parse(input.args);
        const task = await input.execution.addComment(agent, args);
        return taskToolResultSchema.parse({
          ok: true,
          tool: input.tool,
          data: taskProjection(task),
        });
      }
    }
  } catch (cause) {
    return taskToolResultSchema.parse({
      ok: false,
      tool: input.tool,
      error: {
        code:
          typeof cause === "object" &&
          cause !== null &&
          "code" in cause &&
          typeof cause.code === "string"
            ? cause.code
            : "tool_failed",
        message:
          cause instanceof Error
            ? cause.message
            : "task tool invocation failed",
      },
    });
  }
}

function toolDefinition(input: {
  readonly name: TaskToolName;
  readonly description: string;
  readonly parameters: Record<string, unknown>;
  readonly getRun: (
    exec: ToolExecLike,
    runId?: string,
  ) => AgentRunLike | undefined;
  readonly tasks: TaskServiceLike;
  readonly capture: CaptureServiceLike;
  readonly execution: TaskExecutionServiceLike;
  readonly team: TeamServiceLike;
}): ToolDefinitionLike {
  return {
    name: input.name,
    description: input.description,
    parameters: input.parameters,
    output: stringOutput,
    async execute(args, exec) {
      exec.signal.throwIfAborted();
      const run = input.getRun(exec);
      if (run === undefined) {
        throw new Error("当前工具调用没有可用的 Agent Run 上下文");
      }
      const result = await executeTool({
        tool: input.name,
        args,
        run,
        tasks: input.tasks,
        capture: input.capture,
        execution: input.execution,
        team: input.team,
        commandId: exec.callId ?? `${run.id}:${input.name}:${randomUUID()}`,
      });
      return jsonResult(result);
    },
  };
}

function toolParameters(name: TaskToolName): Record<string, unknown> {
  const common = {
    type: "object",
    additionalProperties: false,
  };
  if (name === "task_query") {
    return {
      ...common,
      properties: {
        action: {
          type: "string",
          enum: ["search", "get", "list_mine", "list_attention"],
        },
        taskId: { type: "string" },
        query: { type: "string" },
        limit: { type: "integer", minimum: 1, maximum: 100 },
      },
      required: ["action"],
    };
  }
  if (name === "task_capture_prepare") {
    return {
      ...common,
      properties: {
        sourceType: { type: "string" },
        sourceId: { type: "string" },
        sourceTitle: { type: "string" },
        messageIds: { type: "array", items: { type: "string" } },
        actionItemIds: { type: "array", items: { type: "string" } },
        reportSectionIds: { type: "array", items: { type: "string" } },
        commandId: { type: "string" },
      },
      required: ["sourceType", "sourceId"],
    };
  }
  if (name === "task_capture_save") {
    return {
      ...common,
      properties: {
        sessionId: { type: "string" },
        candidateIds: { type: "array", items: { type: "string" } },
        expectedRevision: { type: "integer", minimum: 1 },
        commandId: { type: "string" },
      },
      required: ["sessionId", "candidateIds", "expectedRevision"],
    };
  }
  if (name === "task_capture_batch") {
    return {
      ...common,
      properties: { batchId: { type: "string" } },
      required: ["batchId"],
    };
  }
  if (name === "task_capture_events") {
    return {
      ...common,
      properties: { after: { type: "string", format: "date-time" } },
      required: [],
    };
  }
  if (name === "task_report_progress") {
    return {
      ...common,
      properties: {
        taskId: { type: "string" },
        progress: { type: "integer", minimum: 0, maximum: 100 },
        summary: { type: "string" },
        completedStepIds: { type: "array", items: { type: "string" } },
      },
      required: ["taskId", "progress", "summary"],
    };
  }
  if (name === "task_request_input") {
    return {
      ...common,
      properties: {
        taskId: { type: "string" },
        question: { type: "string" },
      },
      required: ["taskId", "question"],
    };
  }
  if (name === "task_submit_deliverable") {
    return {
      ...common,
      properties: {
        taskId: { type: "string" },
        summary: { type: "string" },
        completedStepIds: { type: "array", items: { type: "string" } },
        attachments: {
          type: "array",
          items: {
            type: "object",
            properties: {
              name: { type: "string" },
              size: { type: "integer" },
              mimeType: { type: "string" },
              storedPath: { type: "string" },
            },
            required: ["name"],
          },
        },
      },
      required: ["taskId", "summary"],
    };
  }
  return {
    ...common,
    properties: {
      taskId: { type: "string" },
      content: { type: "string" },
      isKeyConsensus: { type: "boolean" },
    },
    required: ["taskId", "content"],
  };
}

function routeError(response: ServerResponse, cause: unknown): void {
  sendJson(response, 400, {
    ok: false,
    error: {
      code: "tool_failed",
      message: cause instanceof Error ? cause.message : "task tool failed",
    },
  });
}

export async function apply(ctx: TaskToolsContext): Promise<void> {
  ctx.inject(
    [
      "collabAgent",
      "collabTasks",
      "collabTaskCapture",
      "collabTaskExecution",
      "collabTeam",
    ],
    (child) => {
      const agent = child.get("collabAgent") as AgentServiceLike | undefined;
      const tasks = child.get("collabTasks") as TaskServiceLike | undefined;
      const capture = child.get("collabTaskCapture") as
        CaptureServiceLike | undefined;
      const execution = child.get("collabTaskExecution") as
        TaskExecutionServiceLike | undefined;
      const team = child.get("collabTeam") as TeamServiceLike | undefined;
      if (
        agent === undefined ||
        tasks === undefined ||
        capture === undefined ||
        execution === undefined ||
        team === undefined
      ) {
        return;
      }
      const getRun = (exec: ToolExecLike, runId?: string) =>
        resolveRun(agent, exec, runId);
      const disposeTools = catalog.tools.map((descriptor) =>
        ctx.tools.register(
          toolDefinition({
            name: descriptor.name,
            description: descriptor.description,
            parameters: toolParameters(descriptor.name),
            getRun,
            tasks,
            capture,
            execution,
            team,
          }),
        ),
      );
      ctx.effect(() => () => {
        for (const dispose of disposeTools) dispose();
      });

      ctx.webServer.register({
        kind: "exact",
        path: "/api/collab/task-tools/catalog",
        handler: (request, response) => {
          try {
            if (
              request.headers.origin !== undefined &&
              !sameOrigin(request.headers.origin, request.headers.host)
            ) {
              throw new Error("same-origin request is required");
            }
            const token = bearerToken({
              get: (name) =>
                name === "authorization"
                  ? (request.headers.authorization ?? null)
                  : null,
            });
            if (token === undefined || team.resolveToken(token) === undefined) {
              throw new Error("bearer token is required");
            }
            sendJson(response, 200, { ok: true, ...catalog });
          } catch (cause) {
            routeError(response, cause);
          }
        },
      });

      ctx.webServer.register({
        kind: "exact",
        path: "/api/collab/task-tools/invoke",
        handler: async (request, response) => {
          try {
            if (
              request.headers.origin !== undefined &&
              !sameOrigin(request.headers.origin, request.headers.host)
            ) {
              throw new Error("same-origin request is required");
            }
            const token = bearerToken({
              get: (name) =>
                name === "authorization"
                  ? (request.headers.authorization ?? null)
                  : null,
            });
            const principal =
              token === undefined ? undefined : team.resolveToken(token);
            if (principal === undefined) {
              throw new Error("bearer token is required");
            }
            const body = z
              .object({
                runId: z.string().min(1).max(200),
                tool: z.enum([
                  "task_query",
                  "task_capture_prepare",
                  "task_capture_save",
                  "task_capture_batch",
                  "task_capture_events",
                  "task_report_progress",
                  "task_request_input",
                  "task_submit_deliverable",
                  "task_comment",
                ]),
                arguments: z.unknown(),
                commandId: z.string().min(1).max(240).optional(),
              })
              .parse(await readJsonBody(request));
            const run = agent.run(body.runId);
            if (
              run === undefined ||
              (run.createdBy !== principal.userId && principal.role !== "admin")
            ) {
              throw new Error("run access is required");
            }
            const result = await executeTool({
              tool: body.tool,
              args: body.arguments,
              run,
              tasks,
              capture,
              execution,
              team,
              commandId:
                body.commandId ?? `${body.runId}:${body.tool}:${randomUUID()}`,
            });
            sendJson(response, 200, result);
          } catch (cause) {
            routeError(response, cause);
          }
        },
      });

      ctx.webServer.register({
        kind: "exact",
        path: "/api/collab/task-tools/mcp",
        handler: async (request, response) => {
          let requestId: string | number | undefined;
          try {
            const token = bearerToken({
              get: (name) =>
                name === "authorization"
                  ? (request.headers.authorization ?? null)
                  : null,
            });
            const principal =
              token === undefined ? undefined : team.resolveToken(token);
            if (principal === undefined) {
              throw new Error("bearer token is required");
            }
            const body = z
              .object({
                jsonrpc: z.literal("2.0"),
                id: z.union([z.string(), z.number()]).optional(),
                method: z.string().min(1).max(120),
                params: z.unknown().optional(),
              })
              .parse(await readJsonBody(request));
            requestId = body.id;
            if (body.method === "initialize") {
              sendJson(response, 200, {
                jsonrpc: "2.0",
                id: body.id ?? null,
                result: {
                  protocolVersion: "2025-03-26",
                  capabilities: { tools: {} },
                  serverInfo: {
                    name: "pluginmax-task-tools",
                    version: "0.1.0",
                  },
                },
              });
              return;
            }
            if (body.method === "tools/list") {
              sendJson(response, 200, {
                jsonrpc: "2.0",
                id: body.id ?? null,
                result: {
                  tools: catalog.tools.map((tool) => ({
                    name: tool.name,
                    description: tool.description,
                    inputSchema: toolParameters(tool.name),
                  })),
                },
              });
              return;
            }
            if (body.method !== "tools/call") {
              throw new Error(`unsupported MCP method: ${body.method}`);
            }
            const params = z
              .object({
                name: z.enum([
                  "task_query",
                  "task_capture_prepare",
                  "task_capture_save",
                  "task_capture_batch",
                  "task_capture_events",
                  "task_report_progress",
                  "task_request_input",
                  "task_submit_deliverable",
                  "task_comment",
                ]),
                arguments: z.unknown(),
                _meta: z
                  .object({
                    runId: z.string().min(1).max(200),
                    commandId: z.string().min(1).max(240).optional(),
                  })
                  .optional(),
              })
              .parse(body.params ?? {});
            if (params._meta === undefined) {
              throw new Error("tools/call requires _meta.runId");
            }
            const run = agent.run(params._meta.runId);
            if (
              run === undefined ||
              (run.createdBy !== principal.userId && principal.role !== "admin")
            ) {
              throw new Error("run access is required");
            }
            const result = await executeTool({
              tool: params.name,
              args: params.arguments,
              run,
              tasks,
              capture,
              execution,
              team,
              commandId:
                params._meta.commandId ??
                `${run.id}:${params.name}:${randomUUID()}`,
            });
            sendJson(response, 200, {
              jsonrpc: "2.0",
              id: body.id ?? null,
              result: {
                isError: !result.ok,
                content: [
                  {
                    type: "text",
                    text: jsonResult(result),
                  },
                ],
              },
            });
          } catch (cause) {
            sendJson(response, 200, {
              jsonrpc: "2.0",
              id: requestId ?? null,
              error: {
                code: -32000,
                message:
                  cause instanceof Error ? cause.message : "MCP tool failed",
              },
            });
          }
        },
      });
    },
  );
}
