import { randomUUID } from "node:crypto";
import type { IncomingMessage, ServerResponse } from "node:http";
import {
  bearerToken,
  sameOrigin,
  sendJson,
  readJsonBody,
} from "@pluginmax/shared";
import { z } from "zod";
import {
  agentProfileSchema,
  agentRunSchema,
  type AgentProfile,
  type AgentRun,
  type AgentRunStatus,
} from "./types.js";

export type { AgentProfile, AgentRun };

export const name = "dsh-collab-agent";
export const inject = ["storageDomain", "webServer", "agentDefaultModel"];

export interface KvTableLike<V> {
  get(key: string): V | undefined;
  entries(): IterableIterator<[string, V]>;
  keys(): IterableIterator<string>;
  get size(): number;
  put(key: string, value: V): Promise<void>;
  delete(key: string): Promise<boolean>;
}

export interface DomainSpecLike {
  readonly name: string;
  readonly version: number;
  readonly compatibleVersions?: readonly number[];
  readonly tables: Record<string, { readonly valueSchema: z.ZodType<unknown> }>;
}

export interface AgentDomainLike {
  table(name: "profiles"): KvTableLike<AgentProfile>;
  table(name: "runs"): KvTableLike<AgentRun>;
  close(): Promise<void>;
}

export interface WebRouteLike {
  readonly kind: "exact";
  readonly path: string;
  handler(
    request: IncomingMessage,
    response: ServerResponse,
  ): Promise<void> | void;
}

export interface TeamMemberLike {
  readonly userId: string;
  readonly name?: string;
  readonly memberRole?: "owner" | "member" | "guest";
}

export interface TeamServiceLike {
  resolveToken(token: string):
    | {
        readonly userId: string;
        readonly role: "admin" | "owner" | "member" | "guest";
      }
    | undefined;
  members(workspaceId: string): readonly TeamMemberLike[];
}

export interface PersonaServiceLike {
  get(personaId: string): Promise<unknown>;
}

export interface AgentHandleLike {
  readonly agent: unknown;
  dispose(): Promise<void>;
}

export interface AgentSetupContextLike {
  readonly tools?: {
    restrict(filter: { readonly allow: readonly string[] }): void;
    get(name: string): unknown;
  };
  get?(key: "agentPresets"): {
    mount(agentCtx: AgentSetupContextLike, presetId: string): Promise<void>;
  } | undefined;
}

export interface AgentsRegistryLike {
  get?(sessionId: string): unknown;
  create(options: {
    readonly sessionId: string;
    readonly meta?: { readonly cwd?: string };
    readonly setup?: (agentCtx: AgentSetupContextLike) => Promise<void> | void;
    readonly agentOptions?: {
      readonly provider: string;
      readonly model: string;
      readonly reasoningEffort?: string;
    };
  }): Promise<AgentHandleLike>;
  resume?(options: {
    readonly resumeSessionId: string;
    readonly setup?: (agentCtx: AgentSetupContextLike) => Promise<void> | void;
    readonly agentOptions?: {
      readonly provider: string;
      readonly model: string;
      readonly reasoningEffort?: string;
    };
  }): Promise<AgentHandleLike>;
}

export interface AgentDefaultModelLike {
  currentSelection(): {
    readonly provider: string;
    readonly model: string;
    readonly reasoningEffort?: string;
  };
}

export interface AgentSessionLike {
  readonly id: string;
  snapshotEvents(): readonly AgentSessionEventLike[];
}

export interface AgentSessionEventLike {
  readonly type: string;
  readonly data?: unknown;
}

export interface AgentRunProgress {
  readonly text: string;
  readonly updatedAt: string;
}

export interface AgentRunProgress {
  readonly text: string;
  readonly updatedAt: string;
}

export interface AgentSessionsLike {
  get(sessionId: string): AgentSessionLike | undefined;
}

export interface AgentSessionPersistenceLike {
  stat(sessionId: string): Promise<unknown | undefined>;
}

export interface AgentLike {
  readonly session: AgentSessionLike;
  followup(message: unknown): void;
  whenIdle(): Promise<void>;
  cancel?(reason: unknown): void;
}

export interface AgentSessionTitleLike {
  get?(session: AgentSessionLike): { readonly title: string } | undefined;
  rename(session: AgentSessionLike, title: string): unknown;
}

export interface WorkspaceLike {
  readonly path: string;
  attachSession(sessionId: string): Promise<void>;
}

export interface WorkspaceRegistryLike {
  create(path: string, title?: string): Promise<WorkspaceLike>;
}

export interface SubagentRunLike {
  readonly id: string;
  readonly result: Promise<SubagentResultLike>;
  dispose(): Promise<void>;
}

export interface SubagentResultLike {
  readonly output?: ReadonlyArray<unknown>;
  readonly stopReason: string;
  readonly diagnostic?: string;
}

function subagentOutputText(result: SubagentResultLike): string {
  if (!Array.isArray(result.output)) return "";
  return result.output
    .filter(
      (block): block is { readonly text: string } =>
        typeof block === "object" &&
        block !== null &&
        "text" in block &&
        typeof block.text === "string",
    )
    .map((block) => block.text)
    .join("\n");
}

function taskSessionId(run: AgentRun): string {
  // 一个「任务 + AI Teammate」对应左侧一条独立会话，重跑同一任务复用同一条。
  // 任务重置执行会话后代数 +1，下一次执行换一条全新会话。
  const epoch = run.payload.context.taskSessionEpoch;
  const generation =
    typeof epoch === "string" && epoch !== "" && epoch !== "0"
      ? `-r${epoch}`
      : "";
  return `de-task-${run.instanceId}-${run.employeeId ?? run.agentProfileId}${generation}`
    .replace(/[^a-zA-Z0-9._-]/g, "-")
    .slice(0, 200);
}

function taskUserMessage(text: string): unknown {
  return {
    id: randomUUID(),
    role: "user",
    content: [{ type: "text", text }],
    source: { kind: "user" },
  };
}

function lastAssistantText(session: AgentSessionLike, since = 0): string {
  for (const event of session.snapshotEvents().slice(since).reverse()) {
    if (event.type !== "assistant/message") continue;
    const data = event.data as
      | {
          readonly message?: {
            readonly content?: readonly unknown[];
          };
        }
      | undefined;
    const content = data?.message?.content;
    if (!Array.isArray(content)) continue;
    const text = content
      .flatMap((block) => {
        if (
          typeof block !== "object" ||
          block === null ||
          !("type" in block) ||
          !("text" in block) ||
          block.type !== "text" ||
          typeof block.text !== "string"
        ) {
          return [];
        }
        return [block.text];
      })
      .join("\n")
      .trim();
    if (text !== "") return text;
  }
  return "";
}

export function deliveryReportIssues(
  output: string,
  payload: AgentRun["payload"],
): string[] {
  const issues: string[] = [];
  if (!/^#\s*交付报告\s*$/m.test(output)) {
    issues.push("缺少一级标题「# 交付报告」");
  }
  const match = /^##\s*交付说明\s*$/m.exec(output);
  if (match === null) {
    issues.push("缺少二级标题「## 交付说明」");
  } else {
    const body = output.slice(match.index + match[0].length).trim();
    if (body === "") {
      issues.push("「交付说明」不能为空");
    } else {
      const required = payload.deliverables.find(
        (item) => item.required && item.type === "text",
      );
      if (
        required?.minTextLength !== undefined &&
        body.length < required.minTextLength
      ) {
        issues.push(
          `「交付说明」不足 ${required.minTextLength} 字（当前 ${body.length} 字）`,
        );
      }
    }
  }
  return issues;
}

function buildRepairPrompt(
  run: AgentRun,
  rawOutput: string,
  issues: readonly string[],
): string {
  return [
    "# Task Worker 输出修复",
    "",
    "你上一次最终回复没有满足工作流交付契约。请重新处理同一个任务，",
    "不要解释修复过程，直接输出符合格式的最终交付报告。",
    "",
    "## 缺陷",
    ...issues.map((issue, index) => `${index + 1}. ${issue}`),
    "",
    "## 输出格式",
    "# 交付报告",
    "",
    "## 交付说明",
    "<完整交付正文；不要省略标题，不要把正文放在代码块中>",
    "",
    "## 上一次输出",
    "<delimiters>",
    rawOutput.slice(0, 40_000),
    "</delimiters>",
  ].join("\n");
}

export interface SubagentsRuntimeLike {
  start(
    name: string,
    spec: {
      readonly label?: string;
      readonly prompt: ReadonlyArray<{ type: "text"; text: string }>;
      readonly parent: unknown;
      readonly persona?: string;
      readonly toolFilter?: { readonly allow: readonly string[] };
      readonly signal: AbortSignal;
    },
  ): Promise<SubagentRunLike>;
}

async function awaitSubagentResult(
  started: SubagentRunLike,
  signal: AbortSignal,
): Promise<SubagentResultLike> {
  return await new Promise<Awaited<SubagentRunLike["result"]>>(
    (resolve, reject) => {
      let finished = false;
      const onAbort = () => {
        if (finished) return;
        finished = true;
        reject(new Error("worker aborted"));
      };
      if (signal.aborted) {
        onAbort();
        return;
      }
      signal.addEventListener("abort", onAbort, { once: true });
      started.result
        .then((value) => {
          if (!finished) {
            finished = true;
            resolve(value);
          }
        })
        .catch((cause: unknown) => {
          if (!finished) {
            finished = true;
            reject(cause instanceof Error ? cause : new Error(String(cause)));
          }
        })
        .finally(() => signal.removeEventListener("abort", onAbort));
    },
  );
}

export interface AgentActor {
  readonly kind: "user";
  readonly id: string;
  readonly name?: string | undefined;
  readonly globalRole?: "admin" | "owner" | "member" | "guest" | undefined;
  readonly workspaceRole?: "owner" | "member" | "guest" | undefined;
}

export class AgentError extends Error {
  constructor(
    readonly code:
      | "invalid_input"
      | "unauthorized"
      | "forbidden"
      | "not_found"
      | "conflict"
      | "method_not_allowed",
    message: string,
  ) {
    super(message);
    this.name = "AgentError";
  }
}

export interface AgentDispatchInput {
  readonly workspaceId: string;
  readonly workspacePath?: string | undefined;
  readonly profileId: string;
  readonly source: "workflow" | "task";
  readonly instanceId: string;
  readonly nodeId: string;
  readonly dispatchKey: string;
  readonly trigger: "manual-dispatch" | "auto-on-ready";
  readonly attempt: number;
  readonly runSeq: number;
  readonly maxAttempts: number;
  readonly timeoutMs: number;
  readonly personaId?: string | undefined;
  readonly employeeId?: string | undefined;
  readonly principalType?: "transitional-agent" | "digital-employee" | undefined;
  readonly ticketId?: string | undefined;
  readonly payload: AgentRun["payload"];
  readonly createdBy: string;
}

export interface AgentWorkflowHandler {
  onSettled(run: AgentRun): Promise<void> | void;
}

export interface AgentTaskHandler {
  onSettled(run: AgentRun): Promise<void> | void;
}

const ACTIVE_RUN_STATUSES: readonly AgentRunStatus[] = [
  "queued",
  "running",
  "waiting_input",
];
const TERMINAL_RUN_STATUSES: readonly AgentRunStatus[] = [
  "succeeded",
  "failed",
  "timeout",
  "cancelled",
  "interrupted",
];

function iso(date: Date): string {
  return date.toISOString();
}

function parseOrInvalid<T>(schema: z.ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);
  if (!result.success) {
    throw new AgentError("invalid_input", "invalid request payload");
  }
  return result.data;
}

function isManager(actor: AgentActor): boolean {
  return actor.globalRole === "admin" || actor.workspaceRole === "owner";
}

function values<V>(table: KvTableLike<V>): V[] {
  return [...table.entries()].map(([, value]) => value);
}

export const agentDomainSpec = {
  name: "collab_agent",
  version: 1,
  tables: {
    profiles: {
      valueSchema: agentProfileSchema as unknown as z.ZodType<unknown>,
    },
    runs: {
      valueSchema: agentRunSchema as unknown as z.ZodType<unknown>,
    },
  },
} as const;

function buildPrompt(run: AgentRun, profile: AgentProfile): string {
  const payload = run.payload;
  const contextLines = Object.entries(payload.context).map(
    ([key, value]) => `- ${key} = ${String(value)}`,
  );
  const deliverableLines = payload.deliverables.map((item, index) => {
    const flags = [
      item.required ? "必交" : "选交",
      item.type,
      item.minTextLength === undefined
        ? undefined
        : `最少 ${item.minTextLength} 字`,
    ]
      .filter(Boolean)
      .join(" · ");
    const description = item.description === "" ? "" : `：${item.description}`;
    return `${index + 1}. ${item.title}（${flags}）${description}`;
  });
  const hasRequiredText = payload.deliverables.some(
    (item) => item.required && item.type === "text",
  );
  if (run.source === "task") {
    const instruction =
      typeof payload.context.instruction === "string"
        ? payload.context.instruction.trim()
        : "";
    const acceptance =
      typeof payload.context.acceptance === "string"
        ? payload.context.acceptance
            .split("\n")
            .map((item) => item.trim())
            .filter(Boolean)
        : [];
    if (instruction !== "") return instruction;
    return [
      payload.nodeDescription.trim() || payload.instanceTitle,
      ...(acceptance.length === 0
        ? []
        : [
            "",
            "验收标准：",
            ...acceptance.map((item, index) => `${index + 1}. ${item}`),
          ]),
    ].join("\n");
  }
  return [
    "# DSH Pluginmax 工作流 Task Worker",
    "",
    "你是一次性任务执行者：只处理本次任务，不进入会议，不与主会话对话。",
    "",
    "## 任务",
    `完成节点「${payload.nodeName}」的工作并输出可审核的结果。`,
    ...(payload.nodeDescription === "" ? [] : ["", payload.nodeDescription]),
    "",
    "## 上下文",
    `- 工作流实例：${payload.instanceTitle}`,
    `- 节点：${payload.nodeName}`,
    ...(payload.responsibleId === undefined
      ? []
      : [`- 责任人：${payload.responsibleId}`]),
    ...(contextLines.length === 0 ? [] : ["- 上下文变量：", ...contextLines]),
    "",
    ...(deliverableLines.length === 0
      ? []
      : ["## 交付要求", ...deliverableLines, ""]),
    ...(hasRequiredText
      ? [
          "## 输出格式",
          "最终回复必须直接从「# 交付报告」开始；不要先输出计划、推理、检查步骤或工具调用。",
          "如果上下文不足，也要立刻交付报告，并在交付说明中列出缺失信息。",
          "",
          "## 交付说明",
          "<针对必交文本交付物的正文，满足最少字数要求；说明结果、覆盖范围、验证方式和风险>",
          "",
        ]
      : []),
    "## 工具",
    profile.allowedTools.length === 0
      ? "本任务没有可用工具。不要调用工具，也不要输出工具调用语法；直接生成交付报告。"
      : `只能使用这些工具：${profile.allowedTools.join("、")}。完成后仍必须直接输出交付报告。`,
    "## 边界",
    "1. 只处理当前节点的内容。",
    "2. 不要修改工作流定义或系统代码。",
    "3. 不要声称完成未提交的交付物。",
    "4. 你的最终回复会写入交付物记录，请保持结构化、可直接审核。",
    "5. 如果信息不足，在交付说明中明确列出缺失项，不要编造。",
  ].join("\n");
}

export interface AgentTaskTables {
  readonly profiles: KvTableLike<AgentProfile>;
  readonly runs: KvTableLike<AgentRun>;
}

export interface AgentRuntimeDeps {
  readonly tables: AgentTaskTables;
  readonly subagents: () => SubagentsRuntimeLike | undefined;
  readonly agents: () => AgentsRegistryLike | undefined;
  readonly defaultModel?: () => AgentDefaultModelLike | undefined;
  readonly workspaces?: () => WorkspaceRegistryLike | undefined;
  readonly sessions?: () => AgentSessionsLike | undefined;
  readonly sessionPersistence?: () => AgentSessionPersistenceLike | undefined;
  readonly sessionTitle?: () => AgentSessionTitleLike | undefined;
  readonly provider?: () => string;
  readonly now?: () => Date;
  readonly onSettled?: (run: AgentRun) => Promise<void> | void;
}

interface AgentTask {
  readonly runId: string;
  readonly workspaceId: string;
  readonly controller: AbortController;
  cancelReason: "cancelled" | undefined;
  timedOut: boolean;
}

const MAX_GLOBAL_WORKERS = 4;
const MAX_WORKSPACE_WORKERS = 2;

/**
 * Owns one-shot task-worker execution for workflow agent nodes.
 *
 * Workers are deliberately short-lived: the final reply is the only output,
 * and this runtime is the only component allowed to write it into AgentRun.
 */
export class AgentTaskRuntime {
  private readonly queues = new Map<string, Promise<void>>();
  private readonly tasks = new Set<AgentTask>();
  private readonly hosts = new Map<string, Promise<AgentHandleLike>>();
  private readonly homeHandles = new Map<string, Promise<AgentHandleLike>>();
  private readonly homeQueues = new Map<string, Promise<void>>();
  private readonly progressBySession = new Map<string, AgentRunProgress>();
  private activeWorkers = 0;
  private readonly waiting: Array<() => void> = [];
  private readonly cancelledRunIds = new Set<string>();

  constructor(private readonly deps: AgentRuntimeDeps) {}

  now(): Date {
    return this.deps.now?.() ?? new Date();
  }

  recordStream(sessionId: string, frame: unknown): void {
    const current = this.progressBySession.get(sessionId);
    let text = current?.text ?? "";
    let changed = false;
    if (
      typeof frame === "object" &&
      frame !== null &&
      "type" in frame &&
      frame.type === "chunk" &&
      "chunk" in frame &&
      typeof frame.chunk === "object" &&
      frame.chunk !== null &&
      "type" in frame.chunk &&
      frame.chunk.type === "text-delta" &&
      "text" in frame.chunk &&
      typeof frame.chunk.text === "string"
    ) {
      text += frame.chunk.text;
      changed = true;
    }
    if (!changed && current !== undefined) return;
    this.progressBySession.set(sessionId, {
      text,
      updatedAt: iso(this.now()),
    });
  }

  progress(sessionId: string): AgentRunProgress | undefined {
    return this.progressBySession.get(sessionId);
  }

  private enqueueHome<T>(
    sessionId: string,
    operation: () => Promise<T>,
  ): Promise<T> {
    const previous = this.homeQueues.get(sessionId) ?? Promise.resolve();
    const result = previous.catch(() => undefined).then(operation);
    const tail = result.then(
      () => undefined,
      () => undefined,
    );
    this.homeQueues.set(sessionId, tail);
    void tail.finally(() => {
      if (this.homeQueues.get(sessionId) === tail) {
        this.homeQueues.delete(sessionId);
      }
    });
    return result;
  }

  enqueue(run: AgentRun): void {
    const key = `${run.instanceId}:${run.nodeId}`;
    const previous = this.queues.get(key) ?? Promise.resolve();
    const next = previous
      .catch(() => undefined)
      .then(() => this.execute(run.id))
      .finally(() => {
        if (this.queues.get(key) === next) this.queues.delete(key);
      });
    this.queues.set(key, next);
  }

  cancel(runId: string): void {
    this.cancelledRunIds.add(runId);
    for (const task of this.tasks) {
      if (task.runId !== runId) continue;
      task.cancelReason = "cancelled";
      task.controller.abort("cancelled");
    }
  }

  async dispose(): Promise<void> {
    for (const task of this.tasks) {
      task.cancelReason = "cancelled";
      task.controller.abort("runtime disposed");
    }
    this.tasks.clear();
    await this.disposeHosts();
    await this.disposeHomeHandles();
  }

  async waitIdle(): Promise<void> {
    while (this.queues.size > 0) {
      await Promise.allSettled(this.queues.values());
    }
  }

  private async acquire(workspaceId: string): Promise<void> {
    const workspaceActive = () =>
      [...this.tasks].filter((task) => task.workspaceId === workspaceId).length;
    while (
      this.activeWorkers >= MAX_GLOBAL_WORKERS ||
      workspaceActive() >= MAX_WORKSPACE_WORKERS
    ) {
      await new Promise<void>((resolve) => this.waiting.push(resolve));
    }
    this.activeWorkers += 1;
  }

  private release(): void {
    this.activeWorkers = Math.max(0, this.activeWorkers - 1);
    this.waiting.shift()?.();
  }

  private async disposeHosts(): Promise<void> {
    const hosts = [...this.hosts.values()];
    this.hosts.clear();
    await Promise.allSettled(
      hosts.map(async (host) => {
        try {
          await (await host).dispose();
        } catch {
          // Host startup failures need no cleanup.
        }
      }),
    );
  }

  private async disposeHomeHandles(): Promise<void> {
    const handles = [...this.homeHandles.values()];
    this.homeHandles.clear();
    await Promise.allSettled(
      handles.map(async (pending) => {
        try {
          const handle = await pending;
          await handle.dispose();
        } catch {
          // Persisted Session logs remain available after handle disposal.
        }
      }),
    );
  }

  private async hostAgent(workspacePath: string): Promise<unknown> {
    let current = this.hosts.get(workspacePath);
    if (current === undefined) {
      const agents = this.deps.agents();
      if (agents === undefined)
        throw new AgentError("not_found", "agent registry is unavailable");
      const model = this.deps.defaultModel?.()?.currentSelection();
      current = agents
        .create({
          sessionId: randomUUID(),
          meta: { cwd: workspacePath },
          ...(model === undefined ? {} : { agentOptions: model }),
        })
        .catch((cause: unknown) => {
          if (this.hosts.get(workspacePath) === current) {
            this.hosts.delete(workspacePath);
          }
          throw cause;
        });
      this.hosts.set(workspacePath, current);
    }
    return (await current).agent;
  }

  private async executeHomeSession(
    run: AgentRun,
    profile: AgentProfile,
    prompt: string,
    signal: AbortSignal,
  ): Promise<SubagentResultLike> {
    if (run.workspacePath === undefined) {
      throw new AgentError("invalid_input", "task run is missing workspace path");
    }
    const workspacePath = run.workspacePath;
    const agents = this.deps.agents();
    if (agents === undefined) {
      throw new AgentError("not_found", "agent registry is unavailable");
    }
    const sessionId = taskSessionId(run);
    const model = this.deps.defaultModel?.()?.currentSelection();
    const setup = async (agentCtx: AgentSetupContextLike): Promise<void> => {
      await agentCtx.get?.("agentPresets")?.mount(agentCtx, "standard");
      const tools = agentCtx.tools;
      if (tools !== undefined) {
        const allow = [...new Set(profile.allowedTools)]
          .filter((name) => tools.get(name) !== undefined);
        tools.restrict({ allow });
      }
    };
    let pending = this.homeHandles.get(sessionId);
    if (pending === undefined) {
      pending = (async () => {
        const adoptLive = (): AgentHandleLike | undefined => {
          const live = agents.get?.(sessionId);
          return live === undefined
            ? undefined
            : { agent: live, dispose: async () => undefined };
        };
        const live = adoptLive();
        if (live !== undefined) return live;
        const persisted = await this.deps.sessionPersistence?.()?.stat(sessionId);
        try {
          if (persisted !== undefined) {
            if (agents.resume === undefined) {
              throw new AgentError(
                "conflict",
                `persisted task session cannot be resumed: ${sessionId}`,
              );
            }
            return await agents.resume({
              resumeSessionId: sessionId,
              setup,
              ...(model === undefined ? {} : { agentOptions: model }),
            });
          }
          return await agents.create({
            sessionId,
            meta: { cwd: workspacePath },
            setup,
            ...(model === undefined ? {} : { agentOptions: model }),
          });
        } catch (cause) {
          // 会话可能已被本进程内另一个活跃 handle 占用（例如重复启动或热重载）：
          // 能拿到现存活句柄就复用，避免任务因为写句柄冲突直接失败。
          const adopted = adoptLive();
          if (adopted !== undefined) return adopted;
          throw cause;
        }
      })();
      this.homeHandles.set(sessionId, pending);
      void pending.catch(() => {
        if (this.homeHandles.get(sessionId) === pending) {
          this.homeHandles.delete(sessionId);
        }
      });
    }
    const handle = await pending;
    const agent = handle.agent as AgentLike;
    return await this.enqueueHome(sessionId, async () => {
      this.progressBySession.set(sessionId, {
        text: "",
        updatedAt: iso(this.now()),
      });
      await this.attachSession(run, sessionId);
      if (signal.aborted) {
        agent.cancel?.({ kind: "user" });
        throw new Error("worker aborted");
      }
      const start = agent.session.snapshotEvents().length;
      const onAbort = (): void => {
        agent.cancel?.({ kind: "user" });
      };
      signal.addEventListener("abort", onAbort, { once: true });
      try {
        agent.followup(taskUserMessage(prompt));
        await agent.whenIdle();
      } finally {
        signal.removeEventListener("abort", onAbort);
      }
      if (signal.aborted) throw new Error("worker aborted");
      const output = lastAssistantText(agent.session, start);
      return {
        output: output === "" ? [] : [{ type: "text", text: output }],
        stopReason: "completed",
      };
    });
  }

  private async saveRun(run: AgentRun): Promise<AgentRun> {
    const next = agentRunSchema.parse({
      ...run,
      updatedAt: iso(this.now()),
    });
    await this.deps.tables.runs.put(next.id, next);
    return next;
  }

  private async attachSession(run: AgentRun, sessionId: string): Promise<AgentRun> {
    const saved = await this.saveRun({ ...run, sessionId });
    try {
      const workspaces = this.deps.workspaces?.();
      if (workspaces !== undefined && run.workspacePath !== undefined) {
        const workspace = await workspaces.create(run.workspacePath);
        await workspace.attachSession(sessionId);
      }
      const session = this.deps.sessions?.()?.get(sessionId);
      const title = this.deps.sessionTitle?.();
      if (session !== undefined && title !== undefined) {
        const runs = [...this.deps.tables.runs.entries()]
          .map(([, item]) => item)
          .filter((item) => item.sessionId === sessionId)
          .sort((left, right) => left.createdAt.localeCompare(right.createdAt));
        const first = runs[0] ?? run;
        const employeeName =
          typeof first.payload.context.employeeName === "string" &&
          first.payload.context.employeeName.trim() !== ""
            ? first.payload.context.employeeName.trim()
            : first.payload.profileName.replace(/\s+runtime$/i, "");
        // Session 名称：TSK-任务名称-任务号后4位-执行人（去掉空白字符）。
        const compact = (value: string): string => value.replace(/\s+/g, "");
        const taskKey = first.instanceId.split("-").at(-1) ?? first.id;
        const desired = [
          "TSK",
          compact(first.payload.instanceTitle),
          taskKey.slice(-4),
          compact(employeeName),
        ]
          .filter((part) => part !== "")
          .join("-")
          .slice(0, 120);
        // 只有新命名（de-task-*）的任务会话才套用新标题；
        // 旧的家会话（de-home-*）保留原有名字，避免「新标题 + 旧 id」。
        if (sessionId.startsWith("de-task-")) {
          const current = title.get?.(session)?.title?.trim();
          const systemGenerated =
            current === undefined ||
            current.startsWith("TSK-") ||
            current.includes(" · ");
          if (systemGenerated) title.rename(session, desired);
        }
      }
    } catch {
      // Session publication is observability; task execution remains authoritative.
    }
    return saved;
  }

  private async settle(
    run: AgentRun,
    patch: Partial<Pick<AgentRun, "status" | "output" | "error" | "endedAt">>,
  ): Promise<void> {
    const latest = this.deps.tables.runs.get(run.id);
    if (latest !== undefined && TERMINAL_RUN_STATUSES.includes(latest.status)) {
      return;
    }
    await this.saveRun({ ...(latest ?? run), ...patch });
    const saved = this.deps.tables.runs.get(run.id);
    if (saved === undefined) return;
    await this.deps.onSettled?.(saved);
  }

  private async execute(runId: string): Promise<void> {
    const claimed = this.deps.tables.runs.get(runId);
    if (claimed === undefined || claimed.status !== "queued") return;
    if (this.cancelledRunIds.has(runId)) return;
    const profile = this.deps.tables.profiles.get(claimed.agentProfileId);
    if (profile === undefined || profile.status !== "active") {
      await this.settle(claimed, {
        status: "failed",
        error: "Agent Profile 不存在或已停用",
        endedAt: iso(this.now()),
      });
      return;
    }
    const subagents = this.deps.subagents();
    if (subagents === undefined) {
      await this.settle(claimed, {
        status: "failed",
        error: "Agent 运行时不可用，可转人工代交",
        endedAt: iso(this.now()),
      });
      return;
    }
    const task: AgentTask = {
      runId,
      workspaceId: claimed.workspaceId,
      controller: new AbortController(),
      cancelReason: undefined,
      timedOut: false,
    };
    this.tasks.add(task);
    const claimedRun = this.deps.tables.runs.get(runId);
    if (
      claimedRun !== undefined &&
      TERMINAL_RUN_STATUSES.includes(claimedRun.status)
    ) {
      this.tasks.delete(task);
      return;
    }
    if (this.cancelledRunIds.has(runId)) {
      this.tasks.delete(task);
      return;
    }
    const prompt = buildPrompt(claimed, profile);
    await this.saveRun({
      ...claimed,
      status: "running",
      startedAt: iso(this.now()),
      promptSnapshot: prompt,
    });
    const current = this.deps.tables.runs.get(runId)!;
    const workspacePath = current.workspacePath ?? process.cwd();
    const timer = setTimeout(() => {
      task.timedOut = true;
      task.controller.abort("timeout");
    }, current.timeoutMs);
    let started: SubagentRunLike | undefined;
    try {
      await this.acquire(current.workspaceId);
      const signal = task.controller.signal;
      let result: SubagentResultLike;
      if (
        current.source === "task" &&
        current.employeeId !== undefined &&
        current.workspacePath !== undefined
      ) {
        result = await this.executeHomeSession(current, profile, prompt, signal);
      } else {
        started = await subagents.start(this.deps.provider?.() ?? "spawn", {
          label: `workflow-worker:${profile.name}`,
          prompt: [{ type: "text", text: prompt }],
          parent: await this.hostAgent(workspacePath),
          ...(current.personaId === undefined
            ? {}
            : { persona: current.personaId }),
          toolFilter: { allow: profile.allowedTools },
          signal,
        });
        result = await awaitSubagentResult(started, signal);
      }
      const rawOutput = subagentOutputText(result);
      const outputIssues =
        current.source === "workflow" &&
        result.stopReason === "completed" &&
        rawOutput.trim() !== ""
          ? deliveryReportIssues(rawOutput, current.payload)
          : [];
      if (outputIssues.length > 0 && !this.cancelledRunIds.has(runId)) {
        // Keep the first reply as evidence even if the repaired reply is lost.
        const latest = this.deps.tables.runs.get(runId) ?? current;
        await this.saveRun({
          ...latest,
          output: {
            summary: rawOutput,
            rawOutput,
            repairAttempt: 1,
          },
        });
        if (current.runSeq + 1 <= current.maxAttempts) {
          const repaired = await subagents.start(
            this.deps.provider?.() ?? "spawn",
            {
              label: `workflow-worker-repair:${profile.name}`,
              prompt: [
                {
                  type: "text",
                  text: buildRepairPrompt(current, rawOutput, outputIssues),
                },
              ],
              parent: await this.hostAgent(workspacePath),
              ...(current.personaId === undefined
                ? {}
                : { persona: current.personaId }),
              toolFilter: { allow: profile.allowedTools },
              signal,
            },
          );
          result = await awaitSubagentResult(repaired, signal);
        }
      }
      if (this.cancelledRunIds.has(runId)) return;
      if (task.cancelReason === "cancelled") {
        await this.settle(current, {
          status: "cancelled",
          endedAt: iso(this.now()),
        });
      } else if (task.timedOut) {
        await this.settle(current, {
          status: "timeout",
          error: "运行超时，已中止",
          endedAt: iso(this.now()),
        });
      } else if (result.stopReason !== "completed") {
        await this.settle(current, {
          status: "failed",
          error:
            result.diagnostic === undefined
              ? `worker ended with ${result.stopReason}`
              : `${result.stopReason}: ${result.diagnostic}`,
          endedAt: iso(this.now()),
        });
      } else if (subagentOutputText(result).trim() === "") {
        await this.settle(current, {
          status: "failed",
          error: "Agent 未返回可用的文本输出",
          endedAt: iso(this.now()),
        });
      } else {
        const finalOutput = subagentOutputText(result);
        const finalIssues =
          current.source === "workflow"
            ? deliveryReportIssues(finalOutput, current.payload)
            : [];
        if (finalIssues.length > 0) {
          const evidence = this.deps.tables.runs.get(runId)?.output;
          await this.settle(current, {
            status: "failed",
            error: `交付报告格式不合格：${finalIssues.join("；")}`,
            output: {
              summary: finalOutput,
              ...(evidence?.rawOutput === undefined
                ? {}
                : { rawOutput: evidence.rawOutput }),
              ...(evidence?.repairAttempt === undefined
                ? {}
                : { repairAttempt: evidence.repairAttempt }),
            },
            endedAt: iso(this.now()),
          });
          return;
        }
        const repairEvidence = this.deps.tables.runs.get(runId)?.output;
        await this.settle(current, {
          status: "succeeded",
          output: {
            summary: finalOutput,
            ...(repairEvidence?.rawOutput === undefined
              ? {}
              : { rawOutput: repairEvidence.rawOutput }),
            ...(repairEvidence?.repairAttempt === undefined
              ? {}
              : { repairAttempt: repairEvidence.repairAttempt }),
            ...(result.diagnostic === undefined
              ? {}
              : { stopReason: result.stopReason }),
            endedAt: iso(this.now()),
          },
          endedAt: iso(this.now()),
        });
      }
    } catch (cause) {
      if (task.cancelReason === "cancelled") {
        await this.settle(this.deps.tables.runs.get(runId) ?? current, {
          status: "cancelled",
          endedAt: iso(this.now()),
        });
      } else if (task.timedOut) {
        await this.settle(this.deps.tables.runs.get(runId) ?? current, {
          status: "timeout",
          error: "运行超时，已中止",
          endedAt: iso(this.now()),
        });
      } else {
        const message =
          cause instanceof Error ? cause.message : "task worker failed";
        await this.settle(this.deps.tables.runs.get(runId) ?? current, {
          status: "failed",
          error: message.slice(0, 1_000),
          endedAt: iso(this.now()),
        });
      }
    } finally {
      clearTimeout(timer);
      this.cancelledRunIds.delete(runId);
      this.tasks.delete(task);
      this.release();
      if (this.tasks.size === 0) {
        await this.disposeHosts();
      }
      if (started !== undefined) {
        try {
          await started.dispose();
        } catch {
          // A settled worker may race its own cleanup.
        }
      }
    }
  }
}

export interface AgentServiceDeps {
  readonly now?: () => Date;
}

export class AgentRegistryService {
  private queue: Promise<unknown> = Promise.resolve();
  private workflowHandler: AgentWorkflowHandler | undefined;
  private taskHandler: AgentTaskHandler | undefined;
  private readonly pendingSettles = new Set<string>();
  private flushingSettles = false;
  private runtime: AgentTaskRuntime | undefined;

  constructor(
    private readonly tables: AgentTaskTables,
    private readonly deps: AgentServiceDeps = {},
  ) {}

  private enqueue<T>(operation: () => Promise<T>): Promise<T> {
    const next = this.queue.then(operation, operation);
    this.queue = next.catch(() => undefined);
    return next;
  }

  private now(): Date {
    return this.deps.now?.() ?? new Date();
  }

  attachRuntime(runtime: AgentTaskRuntime): void {
    this.runtime = runtime;
  }

  private requireManager(actor: AgentActor): void {
    if (!isManager(actor))
      throw new AgentError("forbidden", "workspace owner or admin is required");
  }

  /** Runtime hands finished runs over; workflow replay goes through flush. */
  async onRuntimeSettled(run: AgentRun): Promise<void> {
    await this.deliverSettle(run);
  }

  profiles(workspaceId: string): AgentProfile[] {
    return values(this.tables.profiles)
      .filter((profile) => profile.workspaceId === workspaceId)
      .sort(
        (left, right) =>
          left.name.localeCompare(right.name) ||
          left.id.localeCompare(right.id),
      );
  }

  profile(workspaceId: string, profileId: string): AgentProfile | undefined {
    const profile = this.tables.profiles.get(profileId);
    return profile === undefined || profile.workspaceId !== workspaceId
      ? undefined
      : profile;
  }

  createProfile(
    actor: AgentActor,
    input: {
      workspaceId: string;
      id?: string | undefined;
      name: string;
      description?: string | undefined;
      personaId?: string | undefined;
      runtimeKind?: AgentProfile["runtimeKind"] | undefined;
      defaultModel?: AgentProfile["defaultModel"] | undefined;
      allowedTools?: readonly string[] | undefined;
    },
  ): Promise<AgentProfile> {
    this.requireManager(actor);
    return this.enqueue(async () => {
      const timestamp = iso(this.now());
      const id = input.id?.trim() || `agent-${randomUUID().slice(0, 8)}`;
      const existing = this.tables.profiles.get(id);
      if (existing !== undefined)
        throw new AgentError("conflict", `agent profile already exists: ${id}`);
      const record = parseOrInvalid(agentProfileSchema, {
        id,
        workspaceId: input.workspaceId,
        name: input.name,
        description: input.description ?? "",
        ...(input.personaId === undefined
          ? {}
          : { personaId: input.personaId }),
        runtimeKind: input.runtimeKind ?? "task-worker",
        ...(input.defaultModel === undefined
          ? {}
          : { defaultModel: input.defaultModel }),
        allowedTools: input.allowedTools ?? [],
        ownerUserId: actor.id,
        status: "active",
        createdAt: timestamp,
        updatedAt: timestamp,
      });
      await this.tables.profiles.put(record.id, record);
      return record;
    });
  }

  updateProfile(
    actor: AgentActor,
    input: {
      workspaceId: string;
      profileId: string;
      name?: string | undefined;
      description?: string | undefined;
      personaId?: string | null | undefined;
      allowedTools?: readonly string[] | undefined;
      status?: AgentProfile["status"] | undefined;
    },
  ): Promise<AgentProfile> {
    this.requireManager(actor);
    return this.enqueue(async () => {
      const profile = this.profile(input.workspaceId, input.profileId);
      if (profile === undefined)
        throw new AgentError("not_found", "agent profile not found");
      const next = parseOrInvalid(agentProfileSchema, {
        ...profile,
        name: input.name ?? profile.name,
        description: input.description ?? profile.description,
        personaId:
          input.personaId === null
            ? undefined
            : (input.personaId ?? profile.personaId),
        allowedTools: input.allowedTools ?? profile.allowedTools,
        status: input.status ?? profile.status,
        updatedAt: iso(this.now()),
      });
      await this.tables.profiles.put(next.id, next);
      return next;
    });
  }

  runs(
    filter:
      | string
      | {
          workspaceId?: string | undefined;
          instanceId?: string | undefined;
          nodeId?: string | undefined;
          statuses?: readonly AgentRunStatus[] | undefined;
        },
  ): AgentRun[] {
    const criteria =
      typeof filter === "string" ? { instanceId: filter } : filter;
    return values(this.tables.runs)
      .filter(
        (run) =>
          (criteria.workspaceId === undefined ||
            run.workspaceId === criteria.workspaceId) &&
          (criteria.instanceId === undefined ||
            run.instanceId === criteria.instanceId) &&
          (criteria.nodeId === undefined || run.nodeId === criteria.nodeId) &&
          (criteria.statuses === undefined ||
            criteria.statuses.includes(run.status)),
      )
      .sort(
        (left, right) =>
          right.createdAt.localeCompare(left.createdAt) ||
          right.runSeq - left.runSeq,
      );
  }

  run(runId: string): AgentRun | undefined {
    return this.tables.runs.get(runId);
  }

  progress(runId: string): AgentRunProgress | undefined {
    const run = this.run(runId);
    return run?.sessionId === undefined
      ? undefined
      : this.runtime?.progress(run.sessionId);
  }

  dispatch(input: AgentDispatchInput): Promise<AgentRun> {
    return this.enqueue(async () => {
      const active = values(this.tables.runs).find(
        (run) =>
          run.dispatchKey === input.dispatchKey &&
          ACTIVE_RUN_STATUSES.includes(run.status),
      );
      if (active !== undefined) return active;
      const timestamp = iso(this.now());
      const run = parseOrInvalid(agentRunSchema, {
        id: `run-${randomUUID()}`,
        workspaceId: input.workspaceId,
        ...(input.workspacePath === undefined
          ? {}
          : { workspacePath: input.workspacePath }),
        agentProfileId: input.profileId,
        ...(input.personaId === undefined
          ? {}
          : { personaId: input.personaId }),
        ...(input.employeeId === undefined
          ? {}
          : { employeeId: input.employeeId }),
        ...(input.principalType === undefined
          ? {}
          : { principalType: input.principalType }),
        ...(input.ticketId === undefined ? {} : { ticketId: input.ticketId }),
        source: input.source,
        instanceId: input.instanceId,
        nodeId: input.nodeId,
        dispatchKey: input.dispatchKey,
        trigger: input.trigger,
        status: "queued",
        attempt: input.attempt,
        runSeq: input.runSeq,
        maxAttempts: input.maxAttempts,
        timeoutMs: input.timeoutMs,
        payload: input.payload,
        createdBy: input.createdBy,
        createdAt: timestamp,
        updatedAt: timestamp,
        settleDelivered: false,
      });
      await this.tables.runs.put(run.id, run);
      this.runtime?.enqueue(run);
      return run;
    });
  }

  cancel(runId: string): Promise<AgentRun> {
    return this.enqueue(async () => {
      const run = this.tables.runs.get(runId);
      if (run === undefined)
        throw new AgentError("not_found", "agent run not found");
      if (TERMINAL_RUN_STATUSES.includes(run.status)) {
        throw new AgentError(
          "conflict",
          run.status === "succeeded"
            ? "Agent 运行已完成，无法取消"
            : "Agent 运行已结束，无法取消",
        );
      }
      this.runtime?.cancel(runId);
      await this.tables.runs.put(
        runId,
        agentRunSchema.parse({
          ...run,
          status: "cancelled",
          endedAt: iso(this.now()),
          updatedAt: iso(this.now()),
        }),
      );
      const saved = this.tables.runs.get(runId)!;
      await this.deliverSettle(saved);
      return saved;
    });
  }

  /** Re-enqueue queued runs and retire orphaned running runs after restart. */
  restore(): void {
    for (const run of values(this.tables.runs)) {
      if (run.status === "queued") {
        this.runtime?.enqueue(run);
      } else if (run.status === "running") {
        void this.enqueue(async () => {
          await this.tables.runs.put(
            run.id,
            agentRunSchema.parse({
              ...run,
              status: "interrupted",
              error: "服务重启导致运行中断，可重试或转人工",
              endedAt: iso(this.now()),
              updatedAt: iso(this.now()),
            }),
          );
          const saved = this.tables.runs.get(run.id);
          if (saved !== undefined) await this.deliverSettle(saved);
        });
      }
    }
  }

  bindWorkflow(handler: AgentWorkflowHandler): void {
    this.workflowHandler = handler;
    for (const run of values(this.tables.runs)) {
      if (
        run.source === "workflow" &&
        !run.settleDelivered &&
        TERMINAL_RUN_STATUSES.includes(run.status)
      ) {
        this.pendingSettles.add(run.id);
      }
    }
    void this.flushSettles();
  }

  bindTask(handler: AgentTaskHandler): void {
    this.taskHandler = handler;
    for (const run of values(this.tables.runs)) {
      if (
        run.source === "task" &&
        !run.settleDelivered &&
        TERMINAL_RUN_STATUSES.includes(run.status)
      ) {
        this.pendingSettles.add(run.id);
      }
    }
    void this.flushSettles();
  }

  private deliverSettle(run: AgentRun): void {
    this.pendingSettles.add(run.id);
    // Never await callbacks: cancellation may originate while the owning
    // service already holds its own operation lock.
    void this.flushSettles();
  }

  private async flushSettles(): Promise<void> {
    if (this.workflowHandler === undefined && this.taskHandler === undefined) {
      return;
    }
    if (this.flushingSettles) return;
    this.flushingSettles = true;
    try {
      for (const runId of Array.from(this.pendingSettles)) {
        const run = this.tables.runs.get(runId);
        if (run === undefined || run.settleDelivered) {
          this.pendingSettles.delete(runId);
          continue;
        }
        const handler =
          run.source === "workflow"
            ? this.workflowHandler
            : this.taskHandler;
        if (handler === undefined) continue;
        try {
          await handler.onSettled(run);
          await this.markSettleDelivered(runId);
          this.pendingSettles.delete(runId);
        } catch {
          // Keep pending; replay on next bind.
        }
      }
    } finally {
      this.flushingSettles = false;
    }
  }

  private async markSettleDelivered(runId: string): Promise<void> {
    const run = this.tables.runs.get(runId);
    if (run === undefined || run.settleDelivered) return;
    await this.tables.runs.put(
      runId,
      agentRunSchema.parse({ ...run, settleDelivered: true }),
    );
  }
}

function errorStatus(code: AgentError["code"]): number {
  if (code === "invalid_input") return 400;
  if (code === "unauthorized") return 401;
  if (code === "forbidden") return 403;
  if (code === "not_found") return 404;
  if (code === "method_not_allowed") return 405;
  return 409;
}

async function runHandler(
  operation: () => Promise<void>,
  response: ServerResponse,
): Promise<void> {
  try {
    await operation();
  } catch (cause) {
    if (cause instanceof AgentError) {
      sendJson(response, errorStatus(cause.code), {
        ok: false,
        error: { code: cause.code, message: cause.message },
      });
      return;
    }
    sendJson(response, 500, {
      ok: false,
      error: { code: "internal_error", message: "agent operation failed" },
    });
  }
}

function browserActor(
  team: TeamServiceLike,
  request: IncomingMessage,
  workspaceId: string,
): AgentActor {
  const headers = request.headers;
  if (
    headers.origin !== undefined &&
    !sameOrigin(headers.origin, headers.host)
  ) {
    throw new AgentError("forbidden", "same-origin requests are required");
  }
  const token = bearerToken({
    get: (header) =>
      header === "authorization" ? (headers.authorization ?? null) : null,
  });
  if (token === undefined)
    throw new AgentError("unauthorized", "bearer token is required");
  const principal = team.resolveToken(token);
  if (principal === undefined)
    throw new AgentError("unauthorized", "invalid bearer token");
  const member = team
    .members(workspaceId)
    .find((candidate) => candidate.userId === principal.userId);
  if (member === undefined && principal.role !== "admin")
    throw new AgentError("forbidden", "workspace member role is required");
  return {
    kind: "user",
    id: principal.userId,
    globalRole: principal.role,
    ...(member === undefined
      ? {}
      : { workspaceRole: member.memberRole as AgentActor["workspaceRole"] }),
  };
}

async function readBody(request: IncomingMessage): Promise<unknown> {
  try {
    return await readJsonBody(request);
  } catch {
    throw new AgentError("invalid_input", "valid JSON body is required");
  }
}

function queryParam(
  request: IncomingMessage,
  name: string,
): string | undefined {
  return (
    new URL(request.url ?? "/", "http://localhost").searchParams.get(name) ??
    undefined
  );
}

function assertMethod(
  request: IncomingMessage,
  response: ServerResponse,
  method: "GET" | "POST",
): void {
  if (request.method !== method) {
    throw new AgentError("method_not_allowed", "method not allowed");
  }
}

export function createAgentRoutes(
  service: AgentRegistryService,
  team: () => TeamServiceLike | undefined,
  personas?: () => PersonaServiceLike | undefined,
): WebRouteLike[] {
  const requireTeam = (): TeamServiceLike => {
    const value = team();
    if (value === undefined)
      throw new AgentError("not_found", "identity service is unavailable");
    return value;
  };
  return [
    {
      kind: "exact",
      path: "/api/collab/agent/profiles",
      handler: (request, response) => {
        void runHandler(async () => {
          assertMethod(request, response, "GET");
          const workspaceId = queryParam(request, "workspaceId") ?? "";
          if (workspaceId === "")
            throw new AgentError("invalid_input", "workspaceId is required");
          browserActor(requireTeam(), request, workspaceId);
          sendJson(response, 200, {
            ok: true,
            profiles: service.profiles(workspaceId),
          });
        }, response);
      },
    },
    {
      kind: "exact",
      path: "/api/collab/agent/profiles/create",
      handler: (request, response) => {
        void runHandler(async () => {
          assertMethod(request, response, "POST");
          const body = z
            .object({
              workspaceId: z.string().min(1),
              id: z
                .string()
                .trim()
                .regex(/^[a-zA-Z][a-zA-Z0-9._-]*$/)
                .optional(),
              name: z.string().trim().min(1).max(120),
              description: z.string().trim().max(1_000).optional(),
              personaId: z.string().trim().optional(),
              runtimeKind: z
                .enum(["task-worker", "continuable-session", "connector"])
                .optional(),
              allowedTools: z
                .array(z.string().trim().min(1))
                .max(50)
                .optional(),
            })
            .parse(await readBody(request));
          const actor = browserActor(requireTeam(), request, body.workspaceId);
          if (body.personaId !== undefined) {
            const personaRegistry = personas?.();
            if (personaRegistry !== undefined) {
              try {
                await personaRegistry.get(body.personaId);
              } catch {
                throw new AgentError(
                  "invalid_input",
                  `persona does not exist: ${body.personaId}`,
                );
              }
            }
          }
          const profile = await service.createProfile(actor, body);
          sendJson(response, 201, { ok: true, profile });
        }, response);
      },
    },
    {
      kind: "exact",
      path: "/api/collab/agent/profiles/update",
      handler: (request, response) => {
        void runHandler(async () => {
          assertMethod(request, response, "POST");
          const body = z
            .object({
              workspaceId: z.string().min(1),
              profileId: z.string().min(1),
              name: z.string().trim().min(1).max(120).optional(),
              description: z.string().trim().max(1_000).optional(),
              personaId: z.string().trim().nullable().optional(),
              allowedTools: z
                .array(z.string().trim().min(1))
                .max(50)
                .optional(),
              status: z.enum(["active", "disabled"]).optional(),
            })
            .parse(await readBody(request));
          const actor = browserActor(requireTeam(), request, body.workspaceId);
          if (body.personaId !== undefined && body.personaId !== null) {
            const personaRegistry = personas?.();
            if (personaRegistry !== undefined) {
              try {
                await personaRegistry.get(body.personaId);
              } catch {
                throw new AgentError(
                  "invalid_input",
                  `persona does not exist: ${body.personaId}`,
                );
              }
            }
          }
          const profile = await service.updateProfile(actor, body);
          sendJson(response, 200, { ok: true, profile });
        }, response);
      },
    },
    {
      kind: "exact",
      path: "/api/collab/agent/runs",
      handler: (request, response) => {
        void runHandler(async () => {
          assertMethod(request, response, "GET");
          const workspaceId = queryParam(request, "workspaceId");
          if (workspaceId === undefined || workspaceId === "")
            throw new AgentError("invalid_input", "workspaceId is required");
          browserActor(requireTeam(), request, workspaceId);
          const instanceId = queryParam(request, "instanceId");
          const nodeId = queryParam(request, "nodeId");
          sendJson(response, 200, {
            ok: true,
            runs: service.runs({
              workspaceId,
              ...(instanceId === undefined ? {} : { instanceId }),
              ...(nodeId === undefined ? {} : { nodeId }),
            }),
          });
        }, response);
      },
    },
    {
      kind: "exact",
      path: "/api/collab/agent/runs/detail",
      handler: (request, response) => {
        void runHandler(async () => {
          assertMethod(request, response, "GET");
          const workspaceId = queryParam(request, "workspaceId");
          const runId = queryParam(request, "runId");
          if (workspaceId === undefined || workspaceId === "")
            throw new AgentError("invalid_input", "workspaceId is required");
          if (runId === undefined || runId === "")
            throw new AgentError("invalid_input", "runId is required");
          browserActor(requireTeam(), request, workspaceId);
          const run = service.run(runId);
          if (run === undefined || run.workspaceId !== workspaceId)
            throw new AgentError("not_found", "agent run not found");
          sendJson(response, 200, {
            ok: true,
            run,
            progress: service.progress(runId) ?? null,
          });
        }, response);
      },
    },
    {
      kind: "exact",
      path: "/api/collab/agent/runs/cancel",
      handler: (request, response) => {
        void runHandler(async () => {
          assertMethod(request, response, "POST");
          const body = z
            .object({
              workspaceId: z.string().min(1),
              runId: z.string().min(1),
            })
            .parse(await readBody(request));
          const actor = browserActor(requireTeam(), request, body.workspaceId);
          const run = service.run(body.runId);
          if (run === undefined || run.workspaceId !== body.workspaceId)
            throw new AgentError("not_found", "agent run not found");
          if (!isManager(actor))
            throw new AgentError(
              "forbidden",
              "workspace owner or admin is required",
            );
          const saved = await service.cancel(body.runId);
          sendJson(response, 200, { ok: true, run: saved });
        }, response);
      },
    },
  ];
}

export interface AgentContext {
  storageDomain: {
    open(spec: typeof agentDomainSpec): Promise<AgentDomainLike>;
  };
  webServer: { register(route: WebRouteLike): unknown };
  provide(key: "collabAgent", service: AgentRegistryService): void;
  effect(operation: () => () => void): void;
  collabTeam?: TeamServiceLike;
  collabPersonas?: PersonaServiceLike;
  agents?: AgentsRegistryLike;
  agentDefaultModel?: AgentDefaultModelLike;
  subagents?: SubagentsRuntimeLike;
  workspaceRegistry?: WorkspaceRegistryLike;
  sessions?: AgentSessionsLike;
  sessionTitle?: AgentSessionTitleLike;
  get(key: "collabTeam"): TeamServiceLike | undefined;
  get(key: "collabPersonas"): PersonaServiceLike | undefined;
  get(key: "agents"): AgentsRegistryLike | undefined;
  get(key: "subagents"): SubagentsRuntimeLike | undefined;
  get(key: "workspaceRegistry"): WorkspaceRegistryLike | undefined;
  get(key: "sessions"): AgentSessionsLike | undefined;
  get(key: "sessionPersistence"): AgentSessionPersistenceLike | undefined;
  get(key: "sessionTitle"): AgentSessionTitleLike | undefined;
  on?(
    event: "agent/assistant-stream",
    listener: (payload: unknown) => void,
  ): () => void;
  inject(
    keys: readonly ["collabTeam"],
    callback: (
      child: AgentContext & { readonly collabTeam: TeamServiceLike },
    ) => void,
  ): { dispose(): void } | void;
}

export async function apply(ctx: AgentContext): Promise<void | (() => void)> {
  const domain = await ctx.storageDomain.open(agentDomainSpec);
  const service = new AgentRegistryService({
    profiles: domain.table("profiles"),
    runs: domain.table("runs"),
  });
  const runtime = new AgentTaskRuntime({
    tables: {
      profiles: domain.table("profiles"),
      runs: domain.table("runs"),
    },
    subagents: () => ctx.get("subagents"),
    agents: () => ctx.get("agents"),
    defaultModel: () => ctx.agentDefaultModel,
    workspaces: () => ctx.get("workspaceRegistry"),
    sessions: () => ctx.get("sessions"),
    sessionPersistence: () => ctx.get("sessionPersistence"),
    sessionTitle: () => ctx.get("sessionTitle"),
    onSettled: (run) => service.onRuntimeSettled(run),
  });
  service.attachRuntime(runtime);
  const streamDisposer = ctx.on?.("agent/assistant-stream", (payload) => {
    const value = payload as
      | {
          readonly agent?: { readonly session?: { readonly id?: string } };
          readonly frame?: unknown;
        }
      | undefined;
    const sessionId = value?.agent?.session?.id;
    if (sessionId !== undefined) runtime.recordStream(sessionId, value?.frame);
  });
  ctx.provide("collabAgent", service);
  // Let sibling runtime plugins finish mounting before replaying persisted runs.
  const restoreTimer = setTimeout(() => service.restore(), 0);
  ctx.effect(() => () => {
    clearTimeout(restoreTimer);
    streamDisposer?.();
    void runtime.dispose();
    void domain.close();
  });
  const identityFiber = ctx.inject(["collabTeam"], (child) => {
    for (const route of createAgentRoutes(
      service,
      () => child.collabTeam,
      () => ctx.get("collabPersonas"),
    )) {
      ctx.webServer.register(route);
    }
  });
  return () => {
    identityFiber?.dispose();
  };
}
