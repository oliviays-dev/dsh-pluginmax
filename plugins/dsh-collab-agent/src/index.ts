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

export interface AgentsRegistryLike {
  create(options: {
    readonly sessionId: string;
    readonly meta?: { readonly cwd?: string };
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
  readonly profileId: string;
  readonly source: "workflow";
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
  private host: Promise<AgentHandleLike> | undefined;
  private activeWorkers = 0;
  private readonly waiting: Array<() => void> = [];
  private readonly cancelledRunIds = new Set<string>();

  constructor(private readonly deps: AgentRuntimeDeps) {}

  now(): Date {
    return this.deps.now?.() ?? new Date();
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
    const currentHost = this.host;
    this.host = undefined;
    if (currentHost !== undefined) {
      try {
        await (await currentHost).dispose();
      } catch {
        // Host startup failures need no cleanup.
      }
    }
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

  private async hostAgent(): Promise<unknown> {
    if (this.host === undefined) {
      const agents = this.deps.agents();
      if (agents === undefined)
        throw new AgentError("not_found", "agent registry is unavailable");
      const model = this.deps.defaultModel?.()?.currentSelection();
      const current = agents
        .create({
          sessionId: randomUUID(),
          meta: { cwd: process.cwd() },
          ...(model === undefined ? {} : { agentOptions: model }),
        })
        .catch((cause: unknown) => {
          if (this.host === current) this.host = undefined;
          throw cause;
        });
      this.host = current;
    }
    return (await this.host).agent;
  }

  private async saveRun(run: AgentRun): Promise<AgentRun> {
    const next = agentRunSchema.parse({
      ...run,
      updatedAt: iso(this.now()),
    });
    await this.deps.tables.runs.put(next.id, next);
    return next;
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
    const timer = setTimeout(() => {
      task.timedOut = true;
      task.controller.abort("timeout");
    }, current.timeoutMs);
    let started: SubagentRunLike | undefined;
    try {
      await this.acquire(current.workspaceId);
      started = await subagents.start(this.deps.provider?.() ?? "spawn", {
        label: `workflow-worker:${profile.name}`,
        prompt: [{ type: "text", text: prompt }],
        parent: await this.hostAgent(),
        ...(current.personaId === undefined
          ? {}
          : { persona: current.personaId }),
        toolFilter: { allow: profile.allowedTools },
        signal: task.controller.signal,
      });
      const signal = task.controller.signal;
      let result = await awaitSubagentResult(started!, signal);
      const rawOutput = subagentOutputText(result);
      const outputIssues =
        result.stopReason === "completed" && rawOutput.trim() !== ""
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
              parent: await this.hostAgent(),
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
        const finalIssues = deliveryReportIssues(finalOutput, current.payload);
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
        const currentHost = this.host;
        this.host = undefined;
        if (currentHost !== undefined) {
          try {
            await (await currentHost).dispose();
          } catch {
            // Worker output already settled; cleanup is best effort.
          }
        }
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

  private deliverSettle(run: AgentRun): void {
    if (run.source !== "workflow") {
      void this.markSettleDelivered(run.id);
      return;
    }
    this.pendingSettles.add(run.id);
    // Never await workflow callbacks: cancellation may originate while the
    // workflow service already holds its own operation lock.
    void this.flushSettles();
  }

  private async flushSettles(): Promise<void> {
    const handler = this.workflowHandler;
    if (handler === undefined) return;
    if (this.flushingSettles) return;
    this.flushingSettles = true;
    try {
      for (const runId of Array.from(this.pendingSettles)) {
        const run = this.tables.runs.get(runId);
        if (run === undefined || run.settleDelivered) {
          this.pendingSettles.delete(runId);
          continue;
        }
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
  get(key: "collabTeam"): TeamServiceLike | undefined;
  get(key: "collabPersonas"): PersonaServiceLike | undefined;
  get(key: "agents"): AgentsRegistryLike | undefined;
  get(key: "subagents"): SubagentsRuntimeLike | undefined;
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
    onSettled: (run) => service.onRuntimeSettled(run),
  });
  service.attachRuntime(runtime);
  ctx.provide("collabAgent", service);
  // Let sibling runtime plugins finish mounting before replaying persisted runs.
  const restoreTimer = setTimeout(() => service.restore(), 0);
  ctx.effect(() => () => {
    clearTimeout(restoreTimer);
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
