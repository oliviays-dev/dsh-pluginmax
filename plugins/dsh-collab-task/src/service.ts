import { randomUUID } from "node:crypto";
import { z } from "zod";
import {
  taskCommentSchema,
  taskEventSchema,
  taskRecordSchema,
  taskReplySchema,
  taskMessageSchema,
  taskStepSchema,
  taskStatusSchema,
  type TaskRecord,
  type TaskStatus,
} from "./types.js";

export interface KvTableLike<V> {
  get(key: string): V | undefined;
  entries(): IterableIterator<[string, V]>;
  keys(): IterableIterator<string>;
  get size(): number;
  put(key: string, value: V): Promise<void>;
  delete(key: string): Promise<boolean>;
}

export interface TaskTables {
  readonly tasks: KvTableLike<TaskRecord>;
}

export interface TaskActor {
  readonly id: string;
  readonly name: string;
  readonly kind: "human" | "agent" | "system";
  readonly role?: "admin" | "owner" | "member" | "guest" | undefined;
}

export interface TaskAgentRun {
  readonly id: string;
  readonly instanceId: string;
  readonly status:
    | "queued"
    | "running"
    | "waiting_input"
    | "succeeded"
    | "failed"
    | "timeout"
    | "cancelled"
    | "interrupted";
  readonly output?: { readonly summary: string } | undefined;
  readonly error?: string | undefined;
}

export class TaskError extends Error {
  constructor(
    readonly code:
      | "invalid_input"
      | "unauthorized"
      | "forbidden"
      | "not_found"
      | "conflict",
    message: string,
  ) {
    super(message);
    this.name = "TaskError";
  }
}

const createInputSchema = z.object({
  workspaceId: z.string().min(1).max(200),
  title: z.string().min(1).max(500),
  type: z.string().min(1).max(80).default("任务"),
  priority: z.enum(["P1", "P2", "P3"]),
  status: taskStatusSchema.default("todo"),
  receiverType: z.enum(["unassigned", "human", "agent", "role"]),
  receiverId: z.string().max(160).optional(),
  receiverName: z.string().max(200).optional(),
  description: z.string().min(1).max(20000),
  acceptance: z.array(z.string().min(1).max(500)).min(1).max(30),
  due: z.string().max(40).optional(),
  links: z
    .array(
      z.object({
        type: z.enum(["meeting", "workflow"]),
        id: z.string().min(1).max(200),
        label: z.string().min(1).max(300),
      }),
    )
    .default([]),
  autoSubmitReview: z.boolean().default(true),
});

const updateInputSchema = z.object({
  taskId: z.string().min(1).max(160),
  title: z.string().min(1).max(500),
  priority: z.enum(["P1", "P2", "P3"]),
  description: z.string().min(1).max(20000),
  acceptance: z.array(z.string().min(1).max(500)).min(1).max(30),
  due: z.string().max(40).optional(),
  autoSubmitReview: z.boolean().optional(),
});

const assignInputSchema = z.object({
  taskId: z.string().min(1).max(160),
  receiverType: z.enum(["unassigned", "human", "agent", "role"]),
  receiverId: z.string().max(160).optional(),
  receiverName: z.string().max(200).optional(),
});

const statusInputSchema = z.object({
  taskId: z.string().min(1).max(160),
  status: taskStatusSchema,
});

const messageInputSchema = z.object({
  taskId: z.string().min(1).max(160),
  content: z.string().min(1).max(20000),
  attachments: z
    .array(
      z.object({
        name: z.string().min(1).max(300),
        size: z.number().int().nonnegative().optional(),
        mimeType: z.string().min(1).max(200).optional(),
        storedPath: z.string().min(1).max(500).optional(),
      }),
    )
    .default([]),
});

const sessionResetInputSchema = z.object({
  taskId: z.string().min(1).max(160),
});

const commentInputSchema = z.object({
  taskId: z.string().min(1).max(160),
  content: z.string().min(1).max(8000),
});

const replyInputSchema = z.object({
  taskId: z.string().min(1).max(160),
  commentId: z.string().min(1).max(160),
  content: z.string().min(1).max(8000),
});

const stepInputSchema = z.object({
  taskId: z.string().min(1).max(160),
  stepId: z.string().min(1).max(160),
  done: z.boolean(),
});

function parse<T>(schema: z.ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);
  if (!result.success) {
    throw new TaskError("invalid_input", "request input is invalid");
  }
  return result.data;
}

function tableValues<V>(table: KvTableLike<V>): V[] {
  return Array.from(table.entries(), ([, value]) => value);
}

function nowIso(now: () => Date): string {
  return now().toISOString();
}

function taskId(): string {
  return `TSK-${Date.now().toString(36).toUpperCase()}-${randomUUID().slice(0, 4).toUpperCase()}`;
}

function parseTask(value: unknown): TaskRecord {
  const result = taskRecordSchema.safeParse(value);
  if (!result.success) {
    throw new TaskError("invalid_input", "stored task is invalid");
  }
  return result.data;
}

function progressForSteps(steps: TaskRecord["steps"]): number {
  if (steps.length === 0) return 0;
  return Math.round((steps.filter((step) => step.done).length / steps.length) * 100);
}

export class TaskService {
  constructor(
    private readonly tables: TaskTables,
    private readonly options: { readonly now?: () => Date } = {},
  ) {}

  private now(): string {
    return nowIso(this.options.now ?? (() => new Date()));
  }

  private require(taskIdValue: string): TaskRecord {
    const task = this.tables.tasks.get(taskIdValue);
    if (task === undefined) throw new TaskError("not_found", "task not found");
    return parseTask(task);
  }

  /** Archived tasks are read-only until they are restored. */
  private requireActive(task: TaskRecord): TaskRecord {
    if (task.archivedAt !== undefined) {
      throw new TaskError("conflict", "任务已归档，请先复原后再操作");
    }
    return task;
  }

  private async put(task: TaskRecord): Promise<TaskRecord> {
    const parsed = parseTask(task);
    await this.tables.tasks.put(parsed.id, parsed);
    return parsed;
  }

  private event(
    task: TaskRecord,
    actor: TaskActor,
    kind: TaskRecord["events"][number]["kind"],
    message: string,
  ): TaskRecord {
    const event = taskEventSchema.parse({
      id: randomUUID(),
      at: this.now(),
      actorId: actor.id,
      actorName: actor.name,
      kind,
      message,
    });
    return { ...task, events: [...task.events, event] };
  }

  list(workspaceId: string): TaskRecord[] {
    return tableValues(this.tables.tasks)
      .map(parseTask)
      .filter((task) => task.workspaceId === workspaceId)
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
  }

  get(taskIdValue: string): TaskRecord {
    return this.require(taskIdValue);
  }

  async create(
    actor: TaskActor,
    input: unknown,
  ): Promise<TaskRecord> {
    const parsed = parse(createInputSchema, input);
    const at = this.now();
    const steps = parsed.acceptance.map((label) =>
      taskStepSchema.parse({ id: randomUUID(), label, done: false }),
    );
    const task = taskRecordSchema.parse({
      id: taskId(),
      workspaceId: parsed.workspaceId,
      title: parsed.title,
      type: parsed.type,
      status: parsed.status,
      priority: parsed.priority,
      receiverType: parsed.receiverType,
      ...(parsed.receiverId === undefined ? {} : { receiverId: parsed.receiverId }),
      ...(parsed.receiverName === undefined
        ? {}
        : { receiverName: parsed.receiverName }),
      createdBy: actor.id,
      createdByName: actor.name,
      description: parsed.description,
      acceptance: parsed.acceptance,
      ...(parsed.due === undefined ? {} : { due: parsed.due }),
      links: parsed.links,
      autoSubmitReview: parsed.autoSubmitReview,
      progress: 0,
      steps,
      messages: [],
      comments: [],
      events: [],
      createdAt: at,
      updatedAt: at,
    });
    const withEvent = this.event(
      task,
      actor,
      "created",
      `${actor.name} 创建并派发任务`,
    );
    return this.put(withEvent);
  }

  async update(
    actor: TaskActor,
    input: unknown,
  ): Promise<TaskRecord> {
    const parsed = parse(updateInputSchema, input);
    const task = this.requireActive(this.require(parsed.taskId));
    const steps = parsed.acceptance.map((label, index) =>
      taskStepSchema.parse({
        id: task.steps[index]?.id ?? randomUUID(),
        label,
        done: task.steps[index]?.done ?? false,
      }),
    );
    const updated = this.event(
      {
        ...task,
        title: parsed.title,
        priority: parsed.priority,
        description: parsed.description,
        acceptance: parsed.acceptance,
        steps,
        progress: progressForSteps(steps),
        ...(parsed.due === undefined ? { due: undefined } : { due: parsed.due }),
        ...(parsed.autoSubmitReview === undefined
          ? {}
          : { autoSubmitReview: parsed.autoSubmitReview }),
        updatedAt: this.now(),
      },
      actor,
      "updated",
      `${actor.name} 更新了任务内容`,
    );
    return this.put(updated);
  }

  async assign(
    actor: TaskActor,
    input: unknown,
  ): Promise<TaskRecord> {
    const parsed = parse(assignInputSchema, input);
    const task = this.requireActive(this.require(parsed.taskId));
    const receiver =
      parsed.receiverType === "unassigned"
        ? "待指派"
        : parsed.receiverName?.trim() || parsed.receiverId || "未知接收方";
    const updated = this.event(
      {
        ...task,
        receiverType: parsed.receiverType,
        receiverId:
          parsed.receiverType === "unassigned" ? undefined : parsed.receiverId,
        receiverName:
          parsed.receiverType === "unassigned" ? undefined : parsed.receiverName,
        status: parsed.receiverType === "unassigned" ? "todo" : task.status,
        updatedAt: this.now(),
      },
      actor,
      "assigned",
      `${actor.name} 调整接收方为 ${receiver}`,
    );
    return this.put(updated);
  }

  async claim(actor: TaskActor, taskIdValue: string): Promise<TaskRecord> {
    const task = this.requireActive(this.require(taskIdValue));
    if (task.receiverType !== "role") {
      throw new TaskError("conflict", "only role tasks can be claimed");
    }
    const updated = this.event(
      {
        ...task,
        receiverType: "human",
        receiverId: actor.id,
        receiverName: actor.name,
        status: "progress",
        updatedAt: this.now(),
      },
      actor,
      "claimed",
      `${actor.name} 认领了角色任务`,
    );
    return this.put(updated);
  }

  async changeStatus(
    actor: TaskActor,
    input: unknown,
  ): Promise<TaskRecord> {
    const parsed = parse(statusInputSchema, input);
    const task = this.require(parsed.taskId);
    return this.setStatus(actor, task, parsed.status, "状态已更新");
  }

  async start(actor: TaskActor, taskIdValue: string): Promise<TaskRecord> {
    return this.setStatus(actor, this.require(taskIdValue), "progress", "开始处理");
  }

  async submit(actor: TaskActor, taskIdValue: string): Promise<TaskRecord> {
    const task = this.require(taskIdValue);
    const updatedSteps = task.steps.map((step, index) =>
      index === 0 ? { ...step, done: true } : step,
    );
    const progressed = {
      ...task,
      steps: updatedSteps,
      progress: Math.max(86, progressForSteps(updatedSteps)),
    };
    return this.setStatus(actor, progressed, "review", "提交验收");
  }

  async approve(actor: TaskActor, taskIdValue: string): Promise<TaskRecord> {
    const task = this.require(taskIdValue);
    return this.setStatus(
      actor,
      {
        ...task,
        steps: task.steps.map((step) => ({ ...step, done: true })),
        progress: 100,
      },
      "done",
      "验收通过",
    );
  }

  async reject(actor: TaskActor, taskIdValue: string): Promise<TaskRecord> {
    return this.setStatus(actor, this.require(taskIdValue), "progress", "退回并补充意见");
  }

  private async setStatus(
    actor: TaskActor,
    task: TaskRecord,
    status: TaskStatus,
    action: string,
  ): Promise<TaskRecord> {
    this.requireActive(task);
    const progress =
      status === "done"
        ? 100
        : status === "review"
          ? Math.max(86, task.progress)
          : status === "todo"
            ? Math.min(5, task.progress)
            : Math.max(task.progress, progressForSteps(task.steps));
    const updated = this.event(
      { ...task, status, progress, updatedAt: this.now() },
      actor,
      status === "done" ? "closed" : "status",
      `${actor.name} ${action}：${task.status} → ${status}`,
    );
    return this.put(updated);
  }

  async toggleStep(
    actor: TaskActor,
    input: unknown,
  ): Promise<TaskRecord> {
    const parsed = parse(stepInputSchema, input);
    const task = this.requireActive(this.require(parsed.taskId));
    const steps = task.steps.map((step) =>
      step.id === parsed.stepId ? { ...step, done: parsed.done } : step,
    );
    const updated = this.event(
      {
        ...task,
        steps,
        progress:
          task.status === "done"
            ? 100
            : Math.min(92, Math.max(task.progress, progressForSteps(steps))),
        updatedAt: this.now(),
      },
      actor,
      "step",
      `${actor.name} 更新了验收项`,
    );
    return this.put(updated);
  }

  async addMessage(
    actor: TaskActor,
    input: unknown,
  ): Promise<TaskRecord> {
    const parsed = parse(messageInputSchema, input);
    const task = this.requireActive(this.require(parsed.taskId));
    const message = taskMessageSchema.parse({
      id: randomUUID(),
      at: this.now(),
      authorId: actor.id,
      authorName: actor.name,
      kind: actor.kind,
      content: parsed.content,
      attachments: parsed.attachments,
    });
    const status =
      actor.kind === "agent" && task.status === "todo" ? "progress" : task.status;
    const updated = this.event(
      {
        ...task,
        status,
        messages: [...task.messages, message],
        updatedAt: this.now(),
      },
      actor,
      "message",
      `${actor.name} 添加了执行消息`,
    );
    return this.put(updated);
  }

  /** 重置执行会话：下一次执行换新会话，并重新注入完整上下文。 */
  async resetSession(actor: TaskActor, input: unknown): Promise<TaskRecord> {
    const parsed = parse(sessionResetInputSchema, input);
    const task = this.requireActive(this.require(parsed.taskId));
    const updated = this.event(
      {
        ...task,
        sessionEpoch: (task.sessionEpoch ?? 0) + 1,
        updatedAt: this.now(),
      },
      actor,
      "updated",
      "重置了执行会话，下一次执行会重新注入完整上下文",
    );
    return this.put(updated);
  }

  async attachAgentRun(
    taskIdValue: string,
    run: TaskAgentRun,
    receiverName: string,
  ): Promise<TaskRecord> {
    const task = this.require(taskIdValue);
    const existing = task.messages.find((message) => message.runId === run.id);
    const message = taskMessageSchema.parse({
      id: existing?.id ?? run.id,
      at: existing?.at ?? this.now(),
      authorId: task.receiverId ?? "agent",
      authorName: receiverName,
      kind: "agent",
      content:
        run.status === "succeeded"
          ? run.output?.summary?.trim() || "执行完成，但没有返回文本结果。"
          : run.status === "failed" ||
              run.status === "timeout" ||
              run.status === "cancelled" ||
              run.status === "interrupted"
            ? run.error?.trim() || "Agent 执行未完成。"
            : "已接收指令，正在执行…",
      attachments: [],
      runId: run.id,
      state: run.status,
    });
    const messages =
      existing === undefined
        ? [...task.messages, message]
        : task.messages.map((item) => (item.runId === run.id ? message : item));
    const actor: TaskActor = {
      id: task.receiverId ?? "agent",
      name: receiverName,
      kind: "agent",
    };
    // 仅当任务指派给 Agent、开关开启且当前仍在推进中时，产出物完成才自动进入待验收。
    const autoSubmit =
      run.status === "succeeded" &&
      task.receiverType === "agent" &&
      task.archivedAt === undefined &&
      task.autoSubmitReview &&
      (task.status === "todo" || task.status === "progress");
    const steps = autoSubmit
      ? task.steps.map((step, index) =>
          index === 0 ? { ...step, done: true } : step,
        )
      : task.steps;
    const withRun = this.event(
      {
        ...task,
        agentRunIds:
          task.agentRunIds.includes(run.id)
            ? task.agentRunIds
            : [...task.agentRunIds, run.id],
        messages,
        steps,
        progress: autoSubmit
          ? Math.max(86, progressForSteps(steps))
          : task.progress,
        status: autoSubmit
          ? "review"
          : task.status === "todo"
            ? "progress"
            : task.status,
        updatedAt: this.now(),
      },
      actor,
      "message",
      run.status === "succeeded"
        ? `${receiverName} 返回了执行反馈`
        : ["failed", "timeout", "cancelled", "interrupted"].includes(run.status)
          ? `${receiverName} 执行未完成`
          : `${receiverName} 开始执行任务`,
    );
    if (!autoSubmit) return this.put(withRun);
    return this.put(
      this.event(
        withRun,
        actor,
        "status",
        `${receiverName} 完成产出物，自动提交验收`,
      ),
    );
  }

  async failAgentDispatch(
    taskIdValue: string,
    actor: TaskActor,
    error: string,
  ): Promise<TaskRecord> {
    const task = this.require(taskIdValue);
    const message = taskMessageSchema.parse({
      id: randomUUID(),
      at: this.now(),
      authorId: "system",
      authorName: "系统",
      kind: "system",
      content: `无法启动执行：${error}`,
      attachments: [],
      state: "failed",
    });
    const updated = this.event(
      {
        ...task,
        messages: [...task.messages, message],
        updatedAt: this.now(),
      },
      actor,
      "message",
      `${actor.name} 发送指令，但 Agent 启动失败`,
    );
    return this.put(updated);
  }

  async addComment(
    actor: TaskActor,
    input: unknown,
  ): Promise<TaskRecord> {
    const parsed = parse(commentInputSchema, input);
    const task = this.requireActive(this.require(parsed.taskId));
    const comment = taskCommentSchema.parse({
      id: randomUUID(),
      at: this.now(),
      authorId: actor.id,
      authorName: actor.name,
      kind: actor.kind,
      content: parsed.content,
      replies: [],
    });
    const updated = this.event(
      {
        ...task,
        comments: [...task.comments, comment],
        updatedAt: this.now(),
      },
      actor,
      "comment",
      `${actor.name} 添加了评论`,
    );
    return this.put(updated);
  }

  async replyComment(
    actor: TaskActor,
    input: unknown,
  ): Promise<TaskRecord> {
    const parsed = parse(replyInputSchema, input);
    const task = this.requireActive(this.require(parsed.taskId));
    if (!task.comments.some((comment) => comment.id === parsed.commentId)) {
      throw new TaskError("not_found", "comment not found");
    }
    const reply = taskReplySchema.parse({
      id: randomUUID(),
      at: this.now(),
      authorId: actor.id,
      authorName: actor.name,
      kind: actor.kind,
      content: parsed.content,
    });
    const comments = task.comments.map((comment) =>
      comment.id === parsed.commentId
        ? { ...comment, replies: [...comment.replies, reply] }
        : comment,
    );
    const updated = this.event(
      { ...task, comments, updatedAt: this.now() },
      actor,
      "reply",
      `${actor.name} 回复了评论`,
    );
    return this.put(updated);
  }

  async nudge(actor: TaskActor, taskIdValue: string): Promise<TaskRecord> {
    const task = this.requireActive(this.require(taskIdValue));
    return this.put(
      this.event(
        { ...task, updatedAt: this.now() },
        actor,
        "nudge",
        `${actor.name} 发送了催办提醒`,
      ),
    );
  }

  async archive(actor: TaskActor, taskIdValue: string): Promise<TaskRecord> {
    const task = this.require(taskIdValue);
    if (task.archivedAt !== undefined) return task;
    const at = this.now();
    const updated = this.event(
      { ...task, archivedAt: at, updatedAt: at },
      actor,
      "archived",
      `${actor.name} 归档了任务`,
    );
    return this.put(updated);
  }

  async restore(actor: TaskActor, taskIdValue: string): Promise<TaskRecord> {
    const task = this.require(taskIdValue);
    if (task.archivedAt === undefined) return task;
    const restored: TaskRecord = { ...task, updatedAt: this.now() };
    delete restored.archivedAt;
    const updated = this.event(
      restored,
      actor,
      "restored",
      `${actor.name} 将任务从归档中复原`,
    );
    return this.put(updated);
  }
}

export const taskDomainSpec = {
  name: "collab_task",
  version: 1,
  tables: {
    tasks: { valueSchema: taskRecordSchema as unknown as z.ZodType<unknown> },
  },
};
