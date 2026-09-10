import { randomUUID } from "node:crypto";
import type { IncomingMessage, ServerResponse } from "node:http";
import { z } from "zod";
import {
  bearerToken,
  readJsonBody,
  sameOrigin,
  sendJson,
} from "@pluginmax/shared";

export const name = "dsh-collab-meeting";
export const inject = [
  "storageDomain",
  "commands",
  "tools",
  "webServer",
  "agents",
  "agentDefaultModel",
];

const idSchema = z
  .string()
  .trim()
  .min(1)
  .max(128)
  .regex(/^[a-zA-Z0-9][a-zA-Z0-9._:-]*$/);
const titleSchema = z.string().trim().min(1).max(160);
const textSchema = z.string().trim().max(20_000);
const displayNameSchema = z.string().trim().min(1).max(80);
const isoTimeSchema = z.string().datetime({ precision: 3 });

const meetingSchema = z.object({
  id: z.string().min(1).max(160),
  workspaceId: idSchema,
  title: titleSchema,
  agenda: z.string().trim().max(20_000).default(""),
  status: z.enum(["active", "closed"]),
  createdBy: idSchema,
  parentSessionId: idSchema.optional(),
  createdAt: isoTimeSchema,
  updatedAt: isoTimeSchema,
  closedAt: isoTimeSchema.optional(),
  closedBy: idSchema.optional(),
  summary: textSchema.optional(),
});

const participantSchema = z.object({
  id: z.string().min(1).max(160),
  meetingId: z.string().min(1).max(160),
  kind: z.enum(["human", "agent"]),
  refId: idSchema,
  displayName: displayNameSchema,
  seatId: idSchema.optional(),
  personaId: idSchema.optional(),
  ownerId: idSchema.optional(),
  ownerName: displayNameSchema.optional(),
  autoSpeak: z.enum(["all", "mentions", "manual"]).optional(),
  initialGreeting: z.boolean().optional(),
  leader: z.boolean().default(false),
  status: z.enum(["pending", "active", "left"]),
  source: z.enum(["direct", "seat", "spawned"]),
  hint: z.string().trim().max(500).optional(),
  joinedAt: isoTimeSchema.optional(),
  leftAt: isoTimeSchema.optional(),
  updatedAt: isoTimeSchema,
});

const deliverySchema = z.object({
  participantId: z.string().min(1).max(160),
  targetId: idSchema,
  status: z.enum(["pending", "delivered", "failed"]),
  at: isoTimeSchema.optional(),
  error: z.string().trim().max(500).optional(),
});

const messageSchema = z.object({
  id: z.string().min(1).max(160),
  sequence: z.number().int().positive(),
  meetingId: z.string().min(1).max(160),
  senderKind: z.enum(["human", "agent", "system"]),
  senderId: idSchema,
  senderName: displayNameSchema,
  content: textSchema,
  mentions: z.array(idSchema).default([]),
  deliveries: z.array(deliverySchema).default([]),
  createdAt: isoTimeSchema,
});

const actorSchema = z.object({
  kind: z.enum(["user", "agent"]),
  id: idSchema,
  sessionId: idSchema.optional(),
  globalRole: z.enum(["admin", "owner", "member", "guest"]).optional(),
  workspaceRole: z.enum(["owner", "member", "guest"]).optional(),
});

export type Meeting = z.infer<typeof meetingSchema>;
export type MeetingParticipant = z.infer<typeof participantSchema>;
export type MeetingMessage = z.infer<typeof messageSchema>;
export type MeetingDelivery = z.infer<typeof deliverySchema>;
export type MeetingActor = z.infer<typeof actorSchema>;
export type MeetingTranscriptItem = MeetingMessage;

export class MeetingError extends Error {
  constructor(
    readonly code:
      "invalid_input" | "unauthorized" | "forbidden" | "not_found" | "conflict",
    message: string,
  ) {
    super(message);
    this.name = "MeetingError";
  }
}

export function parseOrInvalid<T>(schema: z.ZodType<T>, input: unknown): T {
  const result = schema.safeParse(input);
  if (!result.success) {
    throw new MeetingError(
      "invalid_input",
      result.error.issues
        .map((issue) => `${issue.path.join(".") || "input"} is invalid`)
        .join("; "),
    );
  }
  return result.data;
}

function nowIso(now: () => Date): string {
  return now().toISOString();
}

function tableValues<V>(table: KvTableLike<V>): V[] {
  return [...table.entries()].map(([, value]) => value);
}

function parseMeeting(value: Meeting): Meeting {
  return parseOrInvalid(meetingSchema, value);
}

function parseParticipant(value: MeetingParticipant): MeetingParticipant {
  return parseOrInvalid(participantSchema, value);
}

function parseMessage(value: MeetingMessage): MeetingMessage {
  return parseOrInvalid(messageSchema, value);
}

/**
 * The message DSH raises for a target that can never resume.
 *
 * Kept narrow on purpose: an unrelated `… is unavailable` failure must not
 * retire a participant that is merely busy or briefly unreachable.
 */
const RETIRED_TARGET_PATTERN = /subagent\s+"[^"]*"\s+is unavailable/i;

/**
 * Reports whether a delivery failure means the target agent can never resume.
 *
 * DSH rejects a follow-up to a retired dispatch with a typed
 * `code: "NOT_RESUMABLE"` error. A recorded delivery keeps only the message
 * text, so the message shape is the fallback for evidence replayed from the
 * transcript.
 */
function isUnavailableTargetFailure(cause: unknown): boolean {
  if (cause instanceof Error) {
    if ((cause as { readonly code?: unknown }).code === "NOT_RESUMABLE")
      return true;
    return RETIRED_TARGET_PATTERN.test(cause.message);
  }
  return typeof cause === "string" && RETIRED_TARGET_PATTERN.test(cause);
}

/**
 * Participant ids a meeting already knows are dead.
 *
 * A dispatch-backed participant keeps its `dispatch-…` refId after the agent
 * that owned it retires, and nothing removes the row, so it stays `active` and
 * every later `post` re-selects it as a delivery target. Its own recorded
 * failed deliveries are the evidence that lets a later `post` skip it before
 * selecting targets instead of queueing another doomed delivery.
 */
function unavailableDeliveryParticipants(
  transcript: readonly MeetingMessage[],
): Set<string> {
  const unavailable = new Set<string>();
  for (const message of transcript) {
    for (const delivery of message.deliveries) {
      if (delivery.status === "failed" && isUnavailableTargetFailure(delivery.error)) {
        unavailable.add(delivery.participantId);
      }
    }
  }
  return unavailable;
}

/**
 * Retires every dispatch-backed participant at mount.
 *
 * A `direct` participant joined by a dispatched agent carries a `dispatch-…`
 * refId, and no dispatch outlives the process that owned it, so every such row
 * is dead as soon as a restart begins. Legacy spawned rows are also continuable
 * child ids; only rows with the runtime-owned `worker:` identity survive restart.
 */
export async function reapRestartedDispatchParticipants(
  participants: KvTableLike<MeetingParticipant>,
  now: () => Date,
): Promise<number> {
  const timestamp = nowIso(now);
  let reaped = 0;
  for (const participant of tableValues(participants)) {
    if (
      participant.status === "active" &&
      ((participant.source === "direct" &&
        participant.refId.startsWith("dispatch-")) ||
        (participant.source === "spawned" &&
          !participant.refId.startsWith("worker:")))
    ) {
      await participants.put(participant.id, {
        ...participant,
        status: "left",
        leftAt: timestamp,
        updatedAt: timestamp,
      });
      reaped += 1;
    }
  }
  return reaped;
}

/**
 * Collapses duplicate seat participants onto one canonical row per meeting and
 * seat, keeping the active row when one exists and otherwise the oldest.
 */
export async function collapseDuplicateSeatParticipants(
  participants: KvTableLike<MeetingParticipant>,
): Promise<number> {
  const seatGroups = new Map<string, Array<[string, MeetingParticipant]>>();
  for (const participant of tableValues(participants)) {
    if (participant.source === "seat" && participant.seatId !== undefined) {
      const key = `${participant.meetingId}:${participant.seatId}`;
      seatGroups.set(key, [
        ...(seatGroups.get(key) ?? []),
        [participant.id, participant],
      ]);
    }
  }
  let removed = 0;
  for (const group of seatGroups.values()) {
    if (group.length <= 1) continue;
    const canonical =
      group.find(([, participant]) => participant.status === "active") ??
      [...group].sort(
        ([, left], [, right]) =>
          (left.joinedAt ?? left.updatedAt).localeCompare(
            right.joinedAt ?? right.updatedAt,
          ) || left.id.localeCompare(right.id),
      )[0]!;
    for (const [id] of group) {
      if (id === canonical[0]) continue;
      await participants.delete(id);
      removed += 1;
    }
  }
  return removed;
}

function managerActor(actor: MeetingActor): boolean {
  return (
    actor.kind === "user" &&
    (actor.globalRole === "admin" || actor.workspaceRole === "owner")
  );
}

export interface KvTableLike<V> {
  get(key: string): V | undefined;
  entries(): IterableIterator<[string, V]>;
  keys(): IterableIterator<string>;
  get size(): number;
  put(key: string, value: V): Promise<void>;
  delete(key: string): Promise<boolean>;
}

export interface SchemaLike {
  readonly type: "object";
  readonly properties: Record<string, unknown>;
  readonly required?: readonly string[];
}

export interface DomainSpecLike {
  readonly name: string;
  readonly version: number;
  readonly tables: Record<
    string,
    { readonly valueSchema: z.ZodType<unknown> }
  >;
}

export interface MeetingDomainLike {
  table(name: "meetings"): KvTableLike<Meeting>;
  table(name: "participants"): KvTableLike<MeetingParticipant>;
  table(name: "messages"): KvTableLike<MeetingMessage>;
  close(): Promise<void>;
}

export const meetingDomainSpec = {
  name: "collab_meeting",
  version: 1,
  tables: {
    meetings: {
      valueSchema: meetingSchema as unknown as z.ZodType<unknown>,
    },
    participants: {
      valueSchema: participantSchema as unknown as z.ZodType<unknown>,
    },
    messages: {
      valueSchema: messageSchema as unknown as z.ZodType<unknown>,
    },
  },
} as const satisfies DomainSpecLike;

export interface AssignmentViewLike {
  readonly seatId: string;
  readonly seatLabel: string;
  readonly participantKind: "human" | "agent" | "any";
  readonly assigneeKind: "user" | "agent";
  readonly assigneeId: string;
  readonly personaId?: string;
  readonly leader: boolean;
  readonly status: "claimed" | "assigned" | "released";
}

export interface RoleConfigViewLike {
  readonly workspaceId: string;
  readonly typeId: string;
  readonly typeName: string;
  readonly seats: readonly {
    readonly id: string;
    readonly label: string;
    readonly participantKind: "human" | "agent" | "any";
    readonly personaId?: string;
  }[];
}

export interface AssignmentServiceLike {
  config(workspaceId: string): RoleConfigViewLike;
  seats(workspaceId: string): readonly AssignmentViewLike[];
}

export interface PersonaServiceLike {
  get(id: string): Promise<{
    readonly id: string;
    readonly name: string;
    readonly description: string;
  }>;
  preset(id: string, context: string): Promise<string>;
}

export interface AgentLike {
  readonly id: string;
  readonly session?: { readonly id?: string };
}

export interface SubagentContentLike {
  readonly type: "text";
  readonly text: string;
}

export interface MeetingWorkerResultLike {
  readonly output: readonly SubagentContentLike[];
  readonly stopReason: string;
  readonly diagnostic?: string;
}

export interface MeetingWorkerRunLike {
  readonly id: string;
  readonly result: Promise<MeetingWorkerResultLike>;
  dispose(): Promise<void>;
}

export interface SubagentStartLike {
  readonly provider: string;
  readonly label: string;
  readonly request: {
    readonly prompt: readonly SubagentContentLike[];
    readonly parent: AgentLike;
    readonly persona?: string;
    readonly toolFilter?: { readonly allow: readonly string[] };
  };
  readonly signal: AbortSignal;
}

export interface MeetingWorkerStartLike {
  readonly label?: string;
  readonly prompt: readonly SubagentContentLike[];
  readonly parent: AgentLike;
  readonly signal: AbortSignal;
  readonly persona?: string;
  readonly toolFilter?: { readonly allow: readonly string[] };
}

export interface SubagentsRuntimeLike {
  start(name: string, spec: MeetingWorkerStartLike): Promise<MeetingWorkerRunLike>;
}

export interface AgentHandleLike {
  readonly agent: AgentLike;
  dispose(): Promise<void>;
}

export interface AgentRegistryLike extends AgentsServiceLike {
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

function agentActor(sessionId: string | undefined): MeetingActor {
  return {
    kind: "agent",
    id: sessionId ?? "agent",
    workspaceRole: "member",
    ...(sessionId === undefined ? {} : { sessionId }),
  };
}

function actorKind(actor: MeetingActor): "human" | "agent" {
  return actor.kind === "user" ? "human" : "agent";
}

function nameTaken(
  participants: readonly MeetingParticipant[],
  displayName: string,
): boolean {
  const normalized = displayName.trim().toLowerCase();
  return participants.some(
    (participant) =>
      participant.displayName.trim().toLowerCase() === normalized &&
      participant.status !== "pending",
  );
}

function uniqueAgentName(
  participants: readonly MeetingParticipant[],
  baseName: string,
  ownerName: string | undefined,
): string {
  const candidates = [
    baseName,
    `${baseName} · ${ownerName ?? "Agent"}`,
    ...Array.from({ length: 20 }, (_, index) =>
      `${baseName} · ${ownerName ?? "Agent"} (${index + 2})`,
    ),
  ];
  const used = new Set(
    participants
      .filter((participant) => participant.status !== "pending")
      .map((participant) => participant.displayName.trim().toLowerCase()),
  );
  return (
    candidates.find((candidate) => !used.has(candidate.trim().toLowerCase())) ??
    `${baseName} · ${randomUUID().slice(0, 6)}`
  );
}

function displayNameForAssignment(assignment: AssignmentViewLike): string {
  return `${assignment.seatLabel}:${assignment.assigneeId}`;
}

function pendingSeatName(label: string): string {
  return `[待认领] ${label}`;
}

function personaPrompt(
  persona: Awaited<ReturnType<PersonaServiceLike["get"]>> | undefined,
  preset: string | undefined,
): string {
  if (preset !== undefined) return preset;
  if (persona === undefined) return "未指定人设；保持克制、具体、如实反馈。";
  return `# ${persona.name} SOUL\n\n${persona.description}`;
}

function workerParticipant(participant: MeetingParticipant): MeetingParticipant {
  return {
    ...participant,
    kind: "agent" as const,
    status: "active" as const,
    refId: `worker:${randomUUID()}`,
    source: participant.source === "seat" ? "seat" : "spawned",
  };
}

function workerText(result: MeetingWorkerResultLike): string {
  return result.output
    .map((block) => (block.type === "text" ? block.text : ""))
    .join("")
    .trim();
}

function workerFailure(result: MeetingWorkerResultLike): string {
  return result.diagnostic === undefined
    ? `worker ended with ${result.stopReason}`
    : `${result.stopReason}: ${result.diagnostic}`;
}

export interface MeetingWorkerDeps {
  readonly meetings: MeetingService;
  readonly subagents: () => SubagentsRuntimeLike | undefined;
  readonly agents: () => AgentRegistryLike | undefined;
  readonly defaultModel?: () => AgentDefaultModelLike | undefined;
  readonly personas?: () => PersonaServiceLike | undefined;
  readonly provider?: () => string;
  readonly now?: () => Date;
}

export interface AgentDefaultModelLike {
  currentSelection(): {
    readonly provider: string;
    readonly model: string;
    readonly reasoningEffort?: string;
  };
}

export interface MeetingDeliveryEnvelope {
  readonly meetingId: string;
  readonly messageId: string;
  readonly participant: MeetingParticipant;
}

const MAX_ACTIVE_WORKERS = 4;
const TRANSCRIPT_WINDOW = 20;

/**
 * Owns short-lived meeting worker execution.
 *
 * A worker is deliberately not a continuable subagent: its final output is the
 * only thing returned to this runtime, and this runtime is the only component
 * that writes it back into the scoped meeting transcript.
 */
export class MeetingRuntime {
  private readonly queues = new Map<string, Promise<void>>();
  private readonly tasks = new Set<{
    readonly meetingId: string;
    readonly participantId: string;
    readonly controller: AbortController;
  }>();
  private host: Promise<AgentHandleLike> | undefined;
  private activeWorkers = 0;
  private readonly waiting: Array<() => void> = [];

  constructor(private readonly deps: MeetingWorkerDeps) {}

  dispatch(message: MeetingMessage, targets: readonly MeetingParticipant[]): void {
    for (const participant of targets) {
      this.enqueue(participant.id, () =>
        this.executeDelivery({
          meetingId: message.meetingId,
          messageId: message.id,
          participant,
        }),
      );
    }
  }

  greet(participant: MeetingParticipant): void {
    this.enqueue(participant.id, () => this.executePrompt(
      participant,
      "派遣完成。请用一句话自我介绍，并说明你当前被配置的发言策略。",
    ));
  }

  trigger(participant: MeetingParticipant, instruction: string): void {
    this.enqueue(participant.id, () => this.executePrompt(participant, instruction));
  }

  /** Test and graceful-shutdown seam for draining every participant queue. */
  async waitIdle(): Promise<void> {
    while (this.queues.size > 0) {
      await Promise.allSettled(this.queues.values());
    }
  }

  cancelParticipant(participantId: string): void {
    for (const task of this.tasks) {
      if (task.participantId === participantId) task.controller.abort("participant left");
    }
  }

  cancelMeeting(meetingId: string): void {
    for (const task of this.tasks) {
      if (task.meetingId === meetingId) task.controller.abort("meeting closed");
    }
  }

  async dispose(): Promise<void> {
    for (const task of this.tasks) task.controller.abort("meeting runtime disposed");
    const currentHost = this.host;
    this.host = undefined;
    if (currentHost !== undefined) {
      try {
        const handle = await currentHost;
        await handle.dispose();
      } catch {
        // The host is private to this runtime; startup failure needs no cleanup.
      }
    }
  }

  private enqueue(participantId: string, operation: () => Promise<void>): void {
    const previous = this.queues.get(participantId) ?? Promise.resolve();
    const next = previous
      .catch(() => undefined)
      .then(operation)
      .finally(() => {
        if (this.queues.get(participantId) === next) this.queues.delete(participantId);
      });
    this.queues.set(participantId, next);
  }

  private async acquire(): Promise<void> {
    if (this.activeWorkers < MAX_ACTIVE_WORKERS) {
      this.activeWorkers += 1;
      return;
    }
    await new Promise<void>((resolve) => this.waiting.push(resolve));
    this.activeWorkers += 1;
  }

  private release(): void {
    this.activeWorkers = Math.max(0, this.activeWorkers - 1);
    this.waiting.shift()?.();
  }

  private async hostAgent(): Promise<AgentLike> {
    if (this.host === undefined) {
      const agents = this.deps.agents();
      if (agents === undefined)
        throw new MeetingError("not_found", "agent registry is unavailable");
      const model = this.deps.defaultModel?.()?.currentSelection();
      const current = agents.create({
        sessionId: randomUUID(),
        meta: { cwd: process.cwd() },
        ...(model === undefined ? {} : { agentOptions: model }),
      }).catch((cause) => {
        if (this.host === current) this.host = undefined;
        throw cause;
      });
      this.host = current;
    }
    return (await this.host).agent;
  }

  private personaIdFor(participant: MeetingParticipant): string | undefined {
    return participant.personaId;
  }

  private async buildPrompt(
    participant: MeetingParticipant,
    instruction: string,
  ): Promise<string> {
    const meeting = this.deps.meetings.get(participant.meetingId);
    const personaService = this.deps.personas?.();
    let persona;
    let preset;
    if (participant.personaId !== undefined && personaService !== undefined) {
      persona = await personaService.get(participant.personaId);
      preset = await personaService.preset(
        participant.personaId,
        `会议：${meeting.title}\n工作区：${meeting.workspaceId}`,
      );
    }
    const participants = this.deps.meetings
      .participants(meeting.id)
      .map((candidate) => {
        const owner = candidate.ownerName === undefined
          ? ""
          : ` · ${candidate.ownerName}的分身`;
        return `- ${candidate.displayName}${owner} (${candidate.kind}/${candidate.status})`;
      });
    const transcript = this.deps.meetings
      .transcript(meeting.id)
      .slice(-TRANSCRIPT_WINDOW)
      .map((message) => `${message.senderName}: ${message.content}`);
    const strategy = participant.autoSpeak === "all"
      ? "所有会议消息都会转发给你。"
      : participant.autoSpeak === "mentions"
        ? "只有定向 @ 你的消息才会转发给你。"
        : "只有主人显式触发时才会运行你。";
    return [
      "# DSH Pluginmax 会议 worker",
      "",
      personaPrompt(persona, preset),
      "",
      `这是为「${meeting.title}」运行的一次性会议任务。会议结束后这个 worker 不保留状态。`,
      participant.ownerName === undefined ? "" : `主人：${participant.ownerName}`,
      `工作区：${meeting.workspaceId}`,
      `发言策略：${strategy}`,
      "",
      "当前参与者：",
      ...participants,
      "",
      "最近会议记录：",
      ...(transcript.length === 0 ? ["（暂无）"] : transcript),
      "",
      "任务：",
      instruction,
      "",
      "输出边界：",
      "- 你的最终回复就是写入会议的唯一发言；不要调用任何工具。",
      "- 只处理本次会议范围内的内容；不要向任何父会话、主人主对话框或外部渠道汇报。",
      "- 保持简短、具体；如果信息不足，明确说明缺失的信息。",
    ].filter((line) => line !== "").join("\n");
  }

  private async executeDelivery(envelope: MeetingDeliveryEnvelope): Promise<void> {
    const current = this.deps.meetings
      .participants(envelope.meetingId)
      .find((participant) => participant.id === envelope.participant.id);
    if (current === undefined || current.status !== "active") return;
    const message = this.deps.meetings
      .transcript(envelope.meetingId)
      .find((candidate) => candidate.id === envelope.messageId);
    if (message === undefined) return;
    const mentionNames = message.mentions
      .map((participantId) =>
        this.deps.meetings
          .participants(envelope.meetingId)
          .find((participant) => participant.id === participantId)?.displayName
          ?? participantId,
      );
    const instruction = [
      message.senderKind === "system" ? "请回应以下系统事项。" : "请回应以下消息。",
      message.mentions.includes(envelope.participant.id)
        ? `这条消息定向 @ ${envelope.participant.displayName}。`
        : message.mentions.length > 0
          ? `这条消息定向给 ${mentionNames.join("、")}，你可以看到它，但不是要求你回复。`
          : "这条消息是群发。",
      "",
      `发送者：${message.senderName}`,
      `内容：${message.content}`,
    ].join("\n");
    await this.runWorker(envelope.meetingId, current, message.id, instruction);
  }

  private async executePrompt(
    participant: MeetingParticipant,
    instruction: string,
  ): Promise<void> {
    await this.runWorker(participant.meetingId, participant, undefined, instruction);
  }

  private async runWorker(
    meetingId: string,
    participant: MeetingParticipant,
    messageId: string | undefined,
    instruction: string,
  ): Promise<void> {
    if (this.deps.meetings.get(meetingId).status !== "active") return;
    const current = this.deps.meetings
      .participants(meetingId)
      .find((candidate) => candidate.id === participant.id);
    if (current === undefined || current.status !== "active") return;
    const subagents = this.deps.subagents();
    if (subagents === undefined)
      throw new MeetingError("not_found", "meeting worker runtime is unavailable");
    const controller = new AbortController();
    const task = {
      meetingId,
      participantId: current.id,
      controller,
    };
    this.tasks.add(task);
    await this.acquire();
    let started: MeetingWorkerRunLike | undefined;
    try {
      const prompt = await this.buildPrompt(current, instruction);
      const provider = this.deps.provider?.() ?? "spawn";
      started = await subagents.start(provider, {
        label: `meeting-worker:${current.displayName}`,
        prompt: [{ type: "text", text: prompt }],
        parent: await this.hostAgent(),
        ...(this.personaIdFor(current) === undefined
          ? {}
          : { persona: this.personaIdFor(current)! }),
        toolFilter: { allow: [] },
        signal: controller.signal,
      });
      const result = await started.result;
      if (controller.signal.aborted) return;
      const reply = workerText(result);
      if (result.stopReason !== "completed")
        throw new MeetingError("conflict", workerFailure(result));
      if (reply !== "") await this.deps.meetings.postWorkerReply(current.id, reply);
      if (messageId !== undefined) {
        await this.deps.meetings.markDelivery(
          messageId,
          current.id,
          "delivered",
        );
      }
    } catch (cause) {
      if (messageId !== undefined) {
        await this.deps.meetings.markDelivery(
          messageId,
          current.id,
          "failed",
          cause instanceof Error ? cause.message : "meeting worker failed",
        );
      }
    } finally {
      this.tasks.delete(task);
      this.release();
      if (this.tasks.size === 0) {
        const currentHost = this.host;
        this.host = undefined;
        if (currentHost !== undefined) {
          try {
            await (await currentHost).dispose();
          } catch {
            // Worker output has already settled; host cleanup is best effort.
          }
        }
      }
      if (started !== undefined) {
        try {
          await started.dispose();
        } catch {
          // A worker whose result already settled may race its own cleanup.
        }
      }
    }
  }
}
export class MeetingService {
  constructor(
    private readonly tables: {
      readonly meetings: KvTableLike<Meeting>;
      readonly participants: KvTableLike<MeetingParticipant>;
      readonly messages: KvTableLike<MeetingMessage>;
    },
    private readonly options: { readonly now: () => Date } = {
      now: () => new Date(),
    },
  ) {}

  async create(
    actor: MeetingActor,
    input: {
      readonly workspaceId: string;
      readonly title: string;
      readonly agenda?: string | undefined;
      readonly parentSessionId?: string | undefined;
    },
  ): Promise<Meeting> {
    const parsedActor = parseOrInvalid(actorSchema, actor);
    const parsed = parseOrInvalid(
      z.object({
        workspaceId: idSchema,
        title: titleSchema,
        agenda: textSchema.optional(),
        parentSessionId: idSchema.optional(),
      }),
      input,
    );
    const timestamp = nowIso(this.options.now);
    const meeting = {
      id: randomUUID(),
      workspaceId: parsed.workspaceId,
      title: parsed.title,
      agenda: parsed.agenda ?? "",
      status: "active" as const,
      createdBy: parsedActor.id,
      ...(parsed.parentSessionId === undefined
        ? {}
        : { parentSessionId: parsed.parentSessionId }),
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    await this.tables.meetings.put(meeting.id, meeting);
    return meeting;
  }

  list(workspaceId: string): Meeting[] {
    const parsed = parseOrInvalid(idSchema, workspaceId);
    return tableValues(this.tables.meetings)
      .map(parseMeeting)
      .filter((meeting) => meeting.workspaceId === parsed)
      .sort(
        (left, right) =>
          left.createdAt.localeCompare(right.createdAt) ||
          left.id.localeCompare(right.id),
      );
  }

  get(meetingId: string): Meeting {
    const parsed = parseOrInvalid(z.string().min(1).max(160), meetingId);
    const meeting = this.tables.meetings.get(parsed);
    if (meeting === undefined)
      throw new MeetingError("not_found", "meeting not found");
    return parseMeeting(meeting);
  }

  participants(meetingId: string): MeetingParticipant[] {
    const meeting = this.get(meetingId);
    return tableValues(this.tables.participants)
      .map(parseParticipant)
      .filter((participant) => participant.meetingId === meeting.id)
      .sort(
        (left, right) =>
          left.displayName.localeCompare(right.displayName) ||
          left.id.localeCompare(right.id),
      );
  }

  transcript(meetingId: string): MeetingMessage[] {
    const meeting = this.get(meetingId);
    return tableValues(this.tables.messages)
      .map(parseMessage)
      .filter((message) => message.meetingId === meeting.id)
      .sort((left, right) => left.sequence - right.sequence);
  }

  /**
   * Retires participants whose own recorded deliveries already reported the
   * target unavailable, so target selection stops picking a dead row.
   */
  private async reapUnavailableParticipants(
    meetingId: string,
    transcript: readonly MeetingMessage[],
  ): Promise<void> {
    const unavailable = unavailableDeliveryParticipants(transcript);
    if (unavailable.size === 0) return;
    for (const participant of this.participants(meetingId)) {
      if (!unavailable.has(participant.id)) continue;
      await this.markParticipantLeft(participant.id);
    }
  }

  /** Retires one participant row so later target selection skips it. */
  private async markParticipantLeft(participantId: string): Promise<void> {
    const current = this.tables.participants.get(participantId);
    if (current === undefined) return;
    const participant = parseParticipant(current);
    if (participant.status === "left") return;
    const timestamp = nowIso(this.options.now);
    await this.tables.participants.put(participant.id, {
      ...participant,
      status: "left",
      leftAt: timestamp,
      updatedAt: timestamp,
    });
  }

  async join(
    actor: MeetingActor,
    meetingId: string,
    displayName: string,
  ): Promise<MeetingParticipant> {
    const parsedActor = parseOrInvalid(actorSchema, actor);
    const meeting = this.get(meetingId);
    if (meeting.status !== "active")
      throw new MeetingError("conflict", "meeting is closed");
    const parsedName = parseOrInvalid(displayNameSchema, displayName);
    const participants = this.participants(meeting.id);
    const existing = participants.find(
      (participant) =>
        participant.kind === actorKind(parsedActor) &&
        participant.refId === parsedActor.id,
    );
    if (existing !== undefined && existing.status === "active")
      throw new MeetingError("conflict", "participant already joined");
    const others =
      existing === undefined
        ? participants
        : participants.filter((candidate) => candidate.id !== existing.id);
    const uniqueName = nameTaken(others, parsedName)
      ? uniqueAgentName(others, parsedName, undefined)
      : parsedName;
    const timestamp = nowIso(this.options.now);
    if (existing !== undefined) {
      const reactivated: MeetingParticipant = {
        ...existing,
        displayName: uniqueName,
        status: "active",
        joinedAt: timestamp,
        leftAt: undefined,
        updatedAt: timestamp,
      };
      await this.tables.participants.put(reactivated.id, reactivated);
      return reactivated;
    }
    const participant = {
      id: randomUUID(),
      meetingId: meeting.id,
      kind: actorKind(parsedActor),
      refId: parsedActor.id,
      displayName: uniqueName,
      leader: participants.every(
        (candidate) => candidate.status !== "active" || !candidate.leader,
      ),
      status: "active" as const,
      source: "direct" as const,
      joinedAt: timestamp,
      updatedAt: timestamp,
    };
    await this.tables.participants.put(participant.id, participant);
    return participant;
  }

  async pullSeats(
    actor: MeetingActor,
    meetingId: string,
    assignments: AssignmentServiceLike,
    seatFilter?: readonly string[],
  ): Promise<MeetingParticipant[]> {
    parseOrInvalid(actorSchema, actor);
    const meeting = this.get(meetingId);
    if (meeting.status !== "active")
      throw new MeetingError("conflict", "meeting is closed");
    const seatParticipants = this.participants(meeting.id).filter(
      (participant) => participant.source === "seat" && participant.seatId !== undefined,
    );
    const seatGroups = new Map<string, MeetingParticipant[]>();
    for (const participant of seatParticipants) {
      const group = seatGroups.get(participant.seatId!) ?? [];
      group.push(participant);
      seatGroups.set(participant.seatId!, group);
    }
    for (const [seatId, group] of seatGroups) {
      if (group.length <= 1) continue;
      const canonical =
        group.find((participant) => participant.status === "active") ??
        [...group].sort((left, right) =>
          (left.joinedAt ?? left.updatedAt).localeCompare(
            right.joinedAt ?? right.updatedAt,
          ) || left.id.localeCompare(right.id),
        )[0]!;
      for (const participant of group) {
        if (participant.id !== canonical.id) {
          await this.tables.participants.delete(participant.id);
        }
      }
      seatGroups.set(seatId, [canonical]);
    }
    const config = assignments.config(meeting.workspaceId);
    const selected = seatFilter === undefined ? undefined : new Set(seatFilter);
    const occupied = new Map(
      assignments.seats(meeting.workspaceId).map((seat) => [seat.seatId, seat]),
    );
    const timestamp = nowIso(this.options.now);
    for (const seat of config.seats) {
      if (selected !== undefined && !selected.has(seat.id)) continue;
      const current = this.participants(meeting.id).find(
        (candidate) =>
          candidate.source === "seat" && candidate.seatId === seat.id,
      );
      if (current?.status === "left") continue;
      const assignment = occupied.get(seat.id);
      if (assignment !== undefined && assignment.status !== "released") {
        const kind =
          assignment.assigneeKind === "user"
            ? ("human" as const)
            : ("agent" as const);
        const displayName = displayNameForAssignment(assignment);
        if (
          current?.status === "active" &&
          (current.displayName !== displayName ||
            current.refId !== assignment.assigneeId)
        ) {
          throw new MeetingError(
            "conflict",
            `seat ${seat.id} changed occupant; leave the old meeting seat first`,
          );
        }
        const participant = {
          id: current?.id ?? randomUUID(),
          meetingId: meeting.id,
          kind,
          refId: assignment.assigneeId,
          displayName,
          seatId: seat.id,
          ...(assignment.personaId === undefined && seat.personaId === undefined
            ? {}
            : {
                personaId: assignment.personaId ?? seat.personaId,
              }),
          leader: assignment.leader,
          status: "active" as const,
          source: "seat" as const,
          joinedAt: current?.joinedAt ?? timestamp,
          updatedAt: timestamp,
        };
        await this.tables.participants.put(participant.id, participant);
        continue;
      }
      if (current !== undefined && current.status === "active") {
        await this.tables.participants.put(current.id, {
          ...current,
          status: "pending",
          refId: `seat:${seat.id}`,
          displayName: pendingSeatName(seat.label),
          leader: false,
          hint: `/assignment claim ${meeting.workspaceId} ${seat.id}`,
          updatedAt: timestamp,
        });
        continue;
      }
      const currentPending = this.participants(meeting.id).find(
        (candidate) =>
          candidate.source === "seat" &&
          candidate.seatId === seat.id &&
          candidate.status === "pending",
      );
      const participant = {
        id: currentPending?.id ?? randomUUID(),
        meetingId: meeting.id,
        kind:
          seat.participantKind === "agent"
            ? ("agent" as const)
            : ("human" as const),
        refId: `seat:${seat.id}`,
        displayName: pendingSeatName(seat.label),
        seatId: seat.id,
        ...(seat.personaId === undefined ? {} : { personaId: seat.personaId }),
        leader: false,
        status: "pending" as const,
        source: "seat" as const,
        hint: `/assignment claim ${meeting.workspaceId} ${seat.id}`,
        joinedAt: currentPending?.joinedAt ?? timestamp,
        updatedAt: timestamp,
      };
      await this.tables.participants.put(participant.id, participant);
    }
    return this.participants(meeting.id).filter(
      (participant) => participant.seatId !== undefined,
    );
  }

  async leave(
    actor: MeetingActor,
    meetingId: string,
  ): Promise<MeetingParticipant> {
    const parsedActor = parseOrInvalid(actorSchema, actor);
    const meeting = this.get(meetingId);
    if (meeting.status !== "active")
      throw new MeetingError("conflict", "meeting is closed");
    const participants = this.participants(meeting.id);
    const participant = participants.find(
      (candidate) =>
        candidate.status === "active" &&
        candidate.kind === actorKind(parsedActor) &&
        candidate.refId === parsedActor.id,
    );
    if (participant === undefined)
      throw new MeetingError(
        "not_found",
        "active meeting participant not found",
      );
    const left = {
      ...participant,
      status: "left" as const,
      leftAt: nowIso(this.options.now),
      updatedAt: nowIso(this.options.now),
    };
    await this.tables.participants.put(left.id, left);
    return left;
  }

  async spawnAgent(
    actor: MeetingActor,
    input: {
      readonly meetingId: string;
      readonly seatId?: string;
      readonly personaId?: string;
      readonly displayName?: string;
      readonly provider?: string;
    },
    personas: PersonaServiceLike | undefined,
  ): Promise<MeetingParticipant> {
    const parsedActor = parseOrInvalid(actorSchema, actor);
    if (parsedActor.kind !== "agent")
      throw new MeetingError(
        "forbidden",
        "an exact live Agent must spawn a meeting Agent",
      );
    const parsed = parseOrInvalid(
      z.object({
        meetingId: z.string().min(1).max(160),
        seatId: idSchema.optional(),
        personaId: idSchema.optional(),
        displayName: displayNameSchema.optional(),
        provider: z.string().trim().min(1).max(80).default("spawn"),
      }),
      input,
    );
    const meeting = this.get(parsed.meetingId);
    if (meeting.status !== "active")
      throw new MeetingError("conflict", "meeting is closed");
    const participants = this.participants(meeting.id);
    const seat = participants.find(
      (candidate) =>
        candidate.source === "seat" && candidate.seatId === parsed.seatId,
    );
    const personaId = parsed.personaId ?? seat?.personaId;
    let persona: Awaited<ReturnType<PersonaServiceLike["get"]>> | undefined;
    if (personas !== undefined && personaId !== undefined) {
      persona = await personas.get(personaId);
    }
    const displayName =
      parsed.displayName ??
      (seat !== undefined
        ? seat.displayName.replace(/^\[待认领\]\s*/, "")
        : (persona?.name ?? `Agent-${randomUUID().slice(0, 8)}`));
    if (
      participants.some(
        (candidate) =>
          candidate.status !== "pending" &&
          candidate.displayName.trim().toLowerCase() ===
            displayName.trim().toLowerCase(),
      )
    )
      throw new MeetingError("conflict", "participant name is already used");
    const timestamp = nowIso(this.options.now);
    const participant = workerParticipant({
      id: seat?.id ?? randomUUID(),
      meetingId: meeting.id,
      kind: "agent",
      refId: "worker",
      displayName,
      ...(parsed.seatId === undefined ? {} : { seatId: parsed.seatId }),
      ...(personaId === undefined ? {} : { personaId }),
      leader: seat?.leader ?? false,
      status: "active",
      source: seat === undefined ? "spawned" : "seat",
      joinedAt: seat?.joinedAt,
      updatedAt: timestamp,
    });
    await this.tables.participants.put(participant.id, participant);
    return participant;
  }

  async spawnAgentForUser(
    actor: MeetingActor,
    input: {
      readonly meetingId: string;
      readonly personaId: string;
      readonly displayName?: string;
      readonly provider?: string;
      readonly autoSpeak: "all" | "mentions" | "manual";
      readonly initialGreeting: boolean;
      readonly ownerName: string;
    },
    personas: PersonaServiceLike,
  ): Promise<MeetingParticipant> {
    const parsedActor = parseOrInvalid(actorSchema, actor);
    if (parsedActor.kind !== "user")
      throw new MeetingError("forbidden", "only humans can dispatch meeting agents");
    const parsed = parseOrInvalid(
      z.object({
        meetingId: z.string().min(1).max(160),
        personaId: idSchema,
        displayName: displayNameSchema.optional(),
        provider: z.string().trim().min(1).max(80).default("spawn"),
        autoSpeak: z.enum(["all", "mentions", "manual"]),
        initialGreeting: z.boolean(),
        ownerName: displayNameSchema,
      }),
      input,
    );
    const meeting = this.get(parsed.meetingId);
    if (meeting.status !== "active")
      throw new MeetingError("conflict", "meeting is closed");
    const requester = this.participants(meeting.id).find(
      (participant) =>
        participant.kind === "human" &&
        participant.refId === parsedActor.id &&
        participant.status === "active",
    );
    if (requester === undefined)
      throw new MeetingError("forbidden", "join the meeting before dispatching an agent");
    const persona = await personas.get(parsed.personaId);
    const displayName = uniqueAgentName(
      this.participants(meeting.id),
      parsed.displayName ?? persona.name,
      parsed.ownerName,
    );
    const timestamp = nowIso(this.options.now);
    const participant = workerParticipant({
      id: randomUUID(),
      meetingId: meeting.id,
      kind: "agent",
      refId: "worker",
      displayName,
      personaId: persona.id,
      ownerId: parsedActor.id,
      ownerName: parsed.ownerName,
      autoSpeak: parsed.autoSpeak,
      initialGreeting: parsed.initialGreeting,
      leader: false,
      status: "active",
      source: "spawned",
      joinedAt: timestamp,
      updatedAt: timestamp,
    });
    await this.tables.participants.put(participant.id, participant);
    return participant;
  }

  async attachParent(
    meetingId: string,
    parentSessionId: string,
  ): Promise<Meeting> {
    const parsedParent = parseOrInvalid(idSchema, parentSessionId);
    const meeting = this.get(meetingId);
    if (meeting.status !== "active")
      throw new MeetingError("conflict", "meeting is closed");
    if (meeting.parentSessionId !== undefined) return meeting;
    const attached = {
      ...meeting,
      parentSessionId: parsedParent,
      updatedAt: nowIso(this.options.now),
    };
    await this.tables.meetings.put(attached.id, attached);
    return attached;
  }

  async post(
    actor: MeetingActor,
    meetingId: string,
    content: string,
    options: {
      readonly mentions?: readonly string[];
    } = {},
  ): Promise<MeetingMessage> {
    const parsedActor = parseOrInvalid(actorSchema, actor);
    const meeting = this.get(meetingId);
    if (meeting.status !== "active")
      throw new MeetingError("conflict", "meeting is closed");
    const parsedContent = parseOrInvalid(textSchema, content);
    const mentionedIds = new Set(options.mentions ?? []);
    const participants = this.participants(meeting.id);
    if (![...mentionedIds].every((participantId) =>
      participants.some((participant) => participant.id === participantId),
    )) {
      throw new MeetingError("invalid_input", "mention targets must be meeting participants");
    }
    const sender = participants.find(
      (participant) =>
        participant.status === "active" &&
        participant.kind === actorKind(parsedActor) &&
        participant.refId === parsedActor.id,
    );
    if (sender === undefined)
      throw new MeetingError(
        "forbidden",
        "meeting participant role is required",
      );
    const transcript = this.transcript(meeting.id);
    const sequence = transcript.at(-1)?.sequence ?? 0;
    const timestamp = nowIso(this.options.now);
    // Reap before selecting targets: a participant whose own recorded delivery
    // already reported its agent unavailable can never resume, and reselecting
    // it would queue another doomed delivery on every later message.
    await this.reapUnavailableParticipants(meeting.id, transcript);
    const targets = this.participants(meeting.id).filter(
      (participant) =>
        participant.status === "active" &&
        participant.kind === "agent" &&
        participant.refId !== sender.refId &&
        (mentionedIds.size === 0 ||
          mentionedIds.has(participant.id)) &&
        (participant.autoSpeak ?? "all") !== "manual" &&
        (mentionedIds.size > 0 || (participant.autoSpeak ?? "all") === "all"),
    );
    const message = {
      id: randomUUID(),
      sequence: sequence + 1,
      meetingId: meeting.id,
      senderKind: actorKind(parsedActor),
      senderId: parsedActor.id,
      senderName: sender.displayName,
      content: parsedContent,
      mentions: [...mentionedIds],
      deliveries: targets.map((participant) => ({
        participantId: participant.id,
        targetId: participant.refId,
        status: "pending" as const,
      })),
      createdAt: timestamp,
    };
    await this.tables.messages.put(message.id, parseMessage(message));
    return this.transcript(meeting.id).at(-1) ?? message;
  }

  /** Writes a runtime-produced reply under the exact meeting participant scope. */
  async postWorkerReply(
    participantId: string,
    content: string,
  ): Promise<MeetingMessage> {
    const participant = this.tables.participants.get(participantId);
    if (participant === undefined)
      throw new MeetingError("not_found", "meeting participant not found");
    const current = parseParticipant(participant);
    const meeting = this.get(current.meetingId);
    if (meeting.status !== "active")
      throw new MeetingError("conflict", "meeting is closed");
    if (current.kind !== "agent" || current.status !== "active")
      throw new MeetingError("forbidden", "active meeting agent is required");
    const parsedContent = parseOrInvalid(textSchema, content);
    const timestamp = nowIso(this.options.now);
    const message = {
      id: randomUUID(),
      sequence: (this.transcript(meeting.id).at(-1)?.sequence ?? 0) + 1,
      meetingId: meeting.id,
      senderKind: "agent" as const,
      senderId: current.refId,
      senderName: current.displayName,
      content: parsedContent,
      mentions: [],
      deliveries: [],
      createdAt: timestamp,
    };
    await this.tables.messages.put(message.id, parseMessage(message));
    return message;
  }

  async markDelivery(
    messageId: string,
    participantId: string,
    status: "delivered" | "failed",
    error?: string,
  ): Promise<void> {
    const current = this.tables.messages.get(messageId);
    if (current === undefined) return;
    const message = parseMessage(current);
    const deliveries = message.deliveries.map((delivery) =>
      delivery.participantId === participantId
        ? {
            ...delivery,
            status,
            at: nowIso(this.options.now),
            ...(error === undefined ? {} : { error: error.slice(0, 500) }),
          }
        : delivery,
    );
    await this.tables.messages.put(message.id, parseMessage({ ...message, deliveries }));
  }

  async close(
    actor: MeetingActor,
    meetingId: string,
    summary: string,
  ): Promise<Meeting> {
    const parsedActor = parseOrInvalid(actorSchema, actor);
    const meeting = this.get(meetingId);
    if (meeting.status !== "active")
      throw new MeetingError("conflict", "meeting is closed");
    const parsedSummary = parseOrInvalid(textSchema, summary);
    const participants = this.participants(meeting.id);
    const caller = participants.find(
      (participant) =>
        participant.status === "active" &&
        participant.kind === actorKind(parsedActor) &&
        participant.refId === parsedActor.id,
    );
    if (
      caller === undefined ||
      !(
        meeting.createdBy === parsedActor.id ||
        caller.leader ||
        managerActor(parsedActor)
      )
    )
      throw new MeetingError(
        "forbidden",
        "meeting creator, leader, or workspace owner role is required",
      );
    const timestamp = nowIso(this.options.now);
    const closed = {
      ...meeting,
      status: "closed" as const,
      closedAt: timestamp,
      closedBy: parsedActor.id,
      summary: parsedSummary,
      updatedAt: timestamp,
    };
    await this.tables.meetings.put(closed.id, closed);
    const systemMessage = {
      id: randomUUID(),
      sequence: (this.transcript(meeting.id).at(-1)?.sequence ?? 0) + 1,
      meetingId: closed.id,
      senderKind: "system" as const,
      senderId: "system",
      senderName: "系统",
      content: `会议关闭。\n${parsedSummary}`,
      mentions: [],
      deliveries: [],
      createdAt: timestamp,
    };
    await this.tables.messages.put(systemMessage.id, systemMessage);
    for (const participant of participants) {
      if (participant.status !== "active") continue;
      await this.tables.participants.put(participant.id, {
        ...participant,
        status: "left",
        leftAt: timestamp,
        updatedAt: timestamp,
      });
    }
    return closed;
  }
}

interface CommandResultLike {
  readonly kind: "success" | "error";
  readonly text: string;
}

interface ToolOutputLike {
  readonly schema: { readonly type: "string" };
  render(
    args: Record<string, never>,
    value: string,
  ): Array<{ type: "text"; text: string }>;
}

export interface WebRouteLike {
  readonly kind: "exact";
  readonly path: string;
  handler(
    request: IncomingMessage,
    response: ServerResponse,
  ): Promise<void> | void;
}

interface TeamServiceLike {
  resolveToken(token: string): { userId: string; role: string } | undefined;
  members(workspaceId: string): Array<{
    userId: string;
    memberRole: string;
    name?: string;
  }>;
}

interface AgentsServiceLike {
  get(id: string): AgentLike | undefined;
}

interface ToolExecLike {
  readonly signal: AbortSignal;
  readonly callId?: unknown;
  readonly agent?: AgentLike;
}

interface ToolDefinitionLike {
  readonly name: string;
  readonly description: string;
  readonly parameters: Record<string, unknown>;
  readonly output: ToolOutputLike;
  execute(args: unknown, exec: ToolExecLike): Promise<string>;
}

export interface MeetingContext {
  effect(register: () => () => void): void;
  provide(key: "collabMeeting", value: MeetingService): unknown;
  commands: {
    register(definition: {
      name: string;
      description: string;
      input: { hint: string; attachments: boolean };
      handler(invocation: { readonly rawInput: string }): CommandResultLike;
    }): unknown;
  };
  tools: { register(definition: ToolDefinitionLike): unknown };
  webServer: { register(route: WebRouteLike): unknown };
  storageDomain: {
    open(spec: typeof meetingDomainSpec): Promise<MeetingDomainLike>;
  };
  collabTeam?: TeamServiceLike;
  collabAssignment?: AssignmentServiceLike;
  collabPersonas?: PersonaServiceLike;
  agents?: AgentRegistryLike;
  agentDefaultModel?: AgentDefaultModelLike;
  subagents?: SubagentsRuntimeLike;
  get(key: "collabAssignment"): AssignmentServiceLike | undefined;
  get(key: "collabPersonas"): PersonaServiceLike | undefined;
  get(key: "agents"): AgentsServiceLike | undefined;
  get(key: "subagents"): SubagentsRuntimeLike | undefined;
  inject(
    keys: readonly ["collabTeam"],
    callback: (
      child: MeetingContext & { readonly collabTeam: TeamServiceLike },
    ) => void,
  ): { dispose(): void };
}

function browserActor(
  team: TeamServiceLike,
  request: IncomingMessage,
  workspaceId: string,
): MeetingActor {
  const headers = request.headers;
  if (
    headers.origin !== undefined &&
    !sameOrigin(headers.origin, headers.host)
  ) {
    throw new MeetingError("forbidden", "same-origin requests are required");
  }
  const token = bearerToken({
    get: (name) =>
      name === "authorization" ? (headers.authorization ?? null) : null,
  });
  if (token === undefined)
    throw new MeetingError("unauthorized", "bearer token is required");
  const principal = team.resolveToken(token);
  if (principal === undefined)
    throw new MeetingError("unauthorized", "invalid bearer token");
  const member = team
    .members(workspaceId)
    .find((candidate) => candidate.userId === principal.userId);
  if (member === undefined && principal.role !== "admin")
    throw new MeetingError("forbidden", "workspace member role is required");
  return {
    kind: "user",
    id: principal.userId,
    globalRole: principal.role as MeetingActor["globalRole"],
    ...(member === undefined
      ? {}
      : { workspaceRole: member.memberRole as MeetingActor["workspaceRole"] }),
  };
}

function errorStatus(code: MeetingError["code"]): number {
  if (code === "invalid_input") return 400;
  if (code === "unauthorized") return 401;
  if (code === "forbidden") return 403;
  if (code === "not_found") return 404;
  return 409;
}

async function runHandler(
  operation: () => Promise<void>,
  response: ServerResponse,
): Promise<void> {
  try {
    await operation();
  } catch (cause) {
    if (cause instanceof MeetingError) {
      sendJson(response, errorStatus(cause.code), {
        ok: false,
        error: { code: cause.code, message: cause.message },
      });
      return;
    }
    sendJson(response, 500, {
      ok: false,
      error: { code: "internal_error", message: "meeting operation failed" },
    });
  }
}

async function readBody(request: IncomingMessage): Promise<unknown> {
  try {
    return await readJsonBody(request);
  } catch {
    throw new MeetingError("invalid_input", "valid JSON body is required");
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

function requireQuery(request: IncomingMessage, name: string): string {
  const value = queryParam(request, name);
  if (value === undefined || value === "")
    throw new MeetingError("invalid_input", `${name} is required`);
  return value;
}

export function createMeetingRoutes(
  meetings: MeetingService,
  team: TeamServiceLike,
  dependencies: {
    readonly assignments?: () => AssignmentServiceLike | undefined;
    readonly agents?: () => AgentsServiceLike | undefined;
    readonly personas?: () => PersonaServiceLike | undefined;
    readonly subagents?: () => SubagentsRuntimeLike | undefined;
    readonly runtime?: () => MeetingRuntime | undefined;
  } = {},
): WebRouteLike[] {
  const memberNames = (workspaceId: string) =>
    new Map(
      team
        .members(workspaceId)
        .map((member) => [member.userId, member.name ?? member.userId]),
    );
  const readableParticipants = (
    workspaceId: string,
    participants: readonly MeetingParticipant[],
  ) => {
    const names = memberNames(workspaceId);
    return participants.map((participant) => {
      if (
        participant.source !== "seat" ||
        participant.refId.startsWith("seat:")
      )
        return participant;
      const name = names.get(participant.refId);
      if (
        name === undefined ||
        name === participant.refId ||
        !participant.displayName.endsWith(`:${participant.refId}`)
      )
        return participant;
      return {
        ...participant,
        displayName:
          participant.displayName.slice(
            0,
            participant.displayName.length - participant.refId.length,
          ) + name,
      };
    });
  };
  const routes = [
    {
      method: "GET",
      path: "/api/collab/meetings",
      handler: (request: IncomingMessage, response: ServerResponse) => {
        const workspaceId = requireQuery(request, "workspaceId");
        const actor = browserActor(team, request, workspaceId);
        sendJson(response, 200, {
          ok: true,
          meetings: meetings.list(workspaceId),
          actorId: actor.id,
        });
      },
    },
    {
      method: "POST",
      path: "/api/collab/meetings",
      handler: async (request: IncomingMessage, response: ServerResponse) => {
        const body = parseOrInvalid(
          z.object({
            workspaceId: idSchema,
            title: titleSchema,
            agenda: textSchema.optional(),
            parentSessionId: idSchema.optional(),
          }),
          await readBody(request),
        );
        const actor = browserActor(team, request, body.workspaceId);
        sendJson(response, 201, {
          ok: true,
          meeting: await meetings.create(actor, body),
        });
      },
    },
    {
      method: "GET",
      path: "/api/collab/meeting",
      handler: (request: IncomingMessage, response: ServerResponse) => {
        const meetingId = requireQuery(request, "meetingId");
        const meeting = meetings.get(meetingId);
        const actor = browserActor(team, request, meeting.workspaceId);
        sendJson(response, 200, {
          ok: true,
          meeting,
          participants: readableParticipants(
            meeting.workspaceId,
            meetings.participants(meeting.id),
          ),
          transcript: meetings.transcript(meeting.id),
          actorId: actor.id,
        });
      },
    },
    {
      method: "POST",
      path: "/api/collab/meeting/join",
      handler: async (request: IncomingMessage, response: ServerResponse) => {
        const body = parseOrInvalid(
          z.object({
            meetingId: z.string().min(1).max(160),
            displayName: displayNameSchema,
          }),
          await readBody(request),
        );
        const meeting = meetings.get(body.meetingId);
        const actor = browserActor(team, request, meeting.workspaceId);
        sendJson(response, 201, {
          ok: true,
          participant: await meetings.join(actor, meeting.id, body.displayName),
        });
      },
    },
    {
      method: "GET",
      path: "/api/collab/meeting/seats",
      handler: (request: IncomingMessage, response: ServerResponse) => {
        const meetingId = requireQuery(request, "meetingId");
        const meeting = meetings.get(meetingId);
        browserActor(team, request, meeting.workspaceId);
        const assignments = dependencies.assignments?.();
        if (assignments === undefined)
          throw new MeetingError("not_found", "roles service is unavailable");
        const names = memberNames(meeting.workspaceId);
        const assignmentsBySeat = new Map(
          assignments
            .seats(meeting.workspaceId)
            .map((seat) => [seat.seatId, seat]),
        );
        const currentBySeat = new Map(
          meetings
            .participants(meeting.id)
            .filter((participant) => participant.source === "seat")
            .flatMap((participant) =>
              participant.seatId === undefined
                ? []
                : [[participant.seatId, participant] as const],
            ),
        );
        const seats = assignments
          .config(meeting.workspaceId)
          .seats.map((seat) => {
            const assignment = assignmentsBySeat.get(seat.id);
            const current = currentBySeat.get(seat.id);
            const assigned =
              assignment !== undefined && assignment.status !== "released";
            const assigneeId = assignment?.assigneeId;
            return {
              seatId: seat.id,
              label: seat.label,
              participantKind: seat.participantKind,
              personaId: assignment?.personaId ?? seat.personaId,
              availability:
                current?.status === "active"
                  ? "joined"
                  : current?.status === "left"
                    ? "left"
                    : "selectable",
              occupancy:
                current?.status === "pending"
                  ? "pending"
                  : assigned
                    ? "filled"
                    : "open",
              assigneeId,
              assigneeName:
                assigneeId === undefined
                  ? undefined
                  : (names.get(assigneeId) ?? assigneeId),
              leader: assignment?.leader === true,
              hint:
                assigned || current?.status === "left"
                  ? undefined
                  : `/assignment claim ${meeting.workspaceId} ${seat.id}`,
            };
          });
        sendJson(response, 200, { ok: true, seats });
      },
    },
    {
      method: "POST",
      path: "/api/collab/meeting/seats/pull",
      handler: async (request: IncomingMessage, response: ServerResponse) => {
        const body = parseOrInvalid(
          z.object({
            meetingId: z.string().min(1).max(160),
            seatIds: z
              .array(z.string().trim().min(1).max(160))
              .min(1)
              .max(100)
              .optional(),
          }),
          await readBody(request),
        );
        const meeting = meetings.get(body.meetingId);
        const actor = browserActor(team, request, meeting.workspaceId);
        const assignments = dependencies.assignments?.();
        if (assignments === undefined)
          throw new MeetingError("not_found", "roles service is unavailable");
        sendJson(response, 200, {
          ok: true,
          participants: await meetings.pullSeats(
            actor,
            meeting.id,
            assignments,
            body.seatIds,
          ),
        });
      },
    },
    {
      method: "POST",
      path: "/api/collab/meeting/message",
      handler: async (request: IncomingMessage, response: ServerResponse) => {
        const body = parseOrInvalid(
          z.object({
            meetingId: z.string().min(1).max(160),
            content: textSchema,
            mentions: z.array(z.string().min(1).max(160)).max(100).optional(),
          }),
          await readBody(request),
        );
        const meeting = meetings.get(body.meetingId);
        const actor = browserActor(team, request, meeting.workspaceId);
        const message = await meetings.post(
          actor,
          meeting.id,
          body.content,
          body.mentions === undefined ? {} : { mentions: body.mentions },
        );
        const runtime = dependencies.runtime?.();
        if (message.deliveries.length > 0 && runtime !== undefined) {
          runtime.dispatch(
            message,
            meetings.participants(meeting.id).filter((participant) =>
              message.deliveries.some(
                (delivery) => delivery.participantId === participant.id,
              ),
            ),
          );
        }
        sendJson(response, 201, { ok: true, message });
      },
    },
    {
      method: "POST",
      path: "/api/collab/meeting/leave",
      handler: async (request: IncomingMessage, response: ServerResponse) => {
        const body = parseOrInvalid(
          z.object({ meetingId: z.string().min(1).max(160) }),
          await readBody(request),
        );
        const meeting = meetings.get(body.meetingId);
        const actor = browserActor(team, request, meeting.workspaceId);
        const participant = meetings
          .participants(meeting.id)
          .find((candidate) =>
            candidate.kind === actorKind(actor) &&
            candidate.refId === actor.id,
          );
        const runtime = dependencies.runtime?.();
        if (runtime !== undefined) runtime.cancelParticipant(participant?.id ?? "");
        sendJson(response, 200, {
          ok: true,
          participant: await meetings.leave(actor, meeting.id),
        });
      },
    },
    {
      method: "POST",
      path: "/api/collab/meeting/close",
      handler: async (request: IncomingMessage, response: ServerResponse) => {
        const body = parseOrInvalid(
          z.object({
            meetingId: z.string().min(1).max(160),
            summary: textSchema,
          }),
          await readBody(request),
        );
        const meeting = meetings.get(body.meetingId);
        const actor = browserActor(team, request, meeting.workspaceId);
        const runtime = dependencies.runtime?.();
        if (runtime !== undefined) runtime.cancelMeeting(meeting.id);
        sendJson(response, 200, {
          ok: true,
          meeting: await meetings.close(actor, meeting.id, body.summary),
        });
      },
    },
    {
      method: "POST",
      path: "/api/collab/meeting/agent/dispatch",
      handler: async (request: IncomingMessage, response: ServerResponse) => {
        const body = parseOrInvalid(
          z.object({
            meetingId: z.string().min(1).max(160),
            personaId: idSchema,
            parentSessionId: idSchema.optional(),
            displayName: displayNameSchema.optional(),
            autoSpeak: z.enum(["all", "mentions", "manual"]).default("mentions"),
            initialGreeting: z.boolean().default(true),
          }),
          await readBody(request),
        );
        const meeting = meetings.get(body.meetingId);
        const actor = browserActor(team, request, meeting.workspaceId);
        if (actor.kind !== "user")
          throw new MeetingError("forbidden", "only humans can dispatch agents");
        const participants = meetings.participants(meeting.id);
        const requester = participants.find(
          (participant) =>
            participant.kind === "human" &&
            participant.refId === actor.id &&
            participant.status === "active",
        );
        if (requester === undefined)
          throw new MeetingError(
            "forbidden",
            "join the meeting before dispatching an agent",
          );
        const runtime = dependencies.runtime?.();
        const personas = dependencies.personas?.();
        if (dependencies.subagents?.() === undefined)
          throw new MeetingError("not_found", "meeting worker runtime is unavailable");
        if (runtime === undefined)
          throw new MeetingError("not_found", "meeting runtime is unavailable");
        if (personas === undefined)
          throw new MeetingError("not_found", "roles persona service is unavailable");
        const participant = await meetings.spawnAgentForUser(
          actor,
          {
            meetingId: meeting.id,
            personaId: body.personaId,
            ...(body.displayName === undefined
              ? {}
              : { displayName: body.displayName }),
            autoSpeak: body.autoSpeak,
            initialGreeting: body.initialGreeting,
            ownerName:
              memberNames(meeting.workspaceId).get(actor.id) ?? requester.displayName,
          },
          personas,
        );
        if (body.initialGreeting) runtime.greet(participant);
        sendJson(response, 201, {
          ok: true,
          participant,
        });
      },
    },
    {
      method: "POST",
      path: "/api/collab/meeting/agent/trigger",
      handler: async (request: IncomingMessage, response: ServerResponse) => {
        const body = parseOrInvalid(
          z.object({
            meetingId: z.string().min(1).max(160),
            participantId: z.string().min(1).max(160),
          }),
          await readBody(request),
        );
        const meeting = meetings.get(body.meetingId);
        const actor = browserActor(team, request, meeting.workspaceId);
        const participant = meetings
          .participants(meeting.id)
          .find((candidate) => candidate.id === body.participantId);
        if (
          participant === undefined ||
          participant.status !== "active" ||
          participant.ownerId !== actor.id
        )
          throw new MeetingError("forbidden", "only the owner can trigger this agent");
        const runtime = dependencies.runtime?.();
        if (runtime === undefined)
          throw new MeetingError("not_found", "meeting runtime is unavailable");
        runtime.trigger(
          participant,
          "主人显式触发。请基于最近会议记录给出当前最有用的回应。",
        );
        sendJson(response, 202, { ok: true, participant });
      },
    },
  ];
  return [...new Set(routes.map((route) => route.path))].map((path) => ({
    kind: "exact" as const,
    path,
    handler: (request: IncomingMessage, response: ServerResponse) =>
      runHandler(async () => {
        const route = routes.find(
          (candidate) =>
            candidate.path === path && candidate.method === request.method,
        );
        if (route === undefined) {
          sendJson(response, 405, {
            ok: false,
            error: {
              code: "method_not_allowed",
              message: "method not allowed",
            },
          });
          return;
        }
        await route.handler(request, response);
      }, response),
  }));
}

const stringToolOutput: ToolOutputLike = {
  schema: { type: "string" },
  render: (_args, value) => [{ type: "text", text: value }],
};

function agentFromExec(exec: ToolExecLike): AgentLike | undefined {
  return exec.agent;
}

function actorFromExec(exec: ToolExecLike): MeetingActor {
  const agent = agentFromExec(exec);
  return agentActor(agent?.session?.id ?? agent?.id);
}

function commandOperation(
  meetings: MeetingService,
  assignments: AssignmentServiceLike | undefined,
  rawInput: string,
): CommandResultLike {
  const parts = rawInput.trim().split(/\s+/).filter(Boolean);
  const [operation, second, ...rest] = parts;
  const actor = agentActor("agent-command");
  try {
    if (operation === undefined || operation === "list") {
      const workspaceId = second ?? "main";
      return {
        kind: "success",
        text:
          meetings
            .list(workspaceId)
            .map(
              (meeting) => `${meeting.id}\t${meeting.status}\t${meeting.title}`,
            )
            .join("\n") || "no meetings",
      };
    }
    if (operation === "create" && second !== undefined && rest.length > 0) {
      const title = rest.join(" ");
      void meetings
        .create(actor, { workspaceId: second, title })
        .catch(() => undefined);
      return { kind: "success", text: "meeting creation accepted" };
    }
    if (operation === "join" && second !== undefined && rest.length > 0) {
      void meetings.join(actor, second, rest.join(" ")).catch(() => undefined);
      return { kind: "success", text: "meeting join accepted" };
    }
    if (operation === "seats" && second !== undefined) {
      if (assignments === undefined)
        return { kind: "error", text: "roles service is unavailable" };
      void meetings
        .pullSeats(actor, second, assignments)
        .catch(() => undefined);
      return { kind: "success", text: "seat sync accepted" };
    }
    if (operation === "read" && second !== undefined) {
      const meeting = meetings.get(second);
      return {
        kind: "success",
        text: JSON.stringify({
          meetingId: meeting.id,
          title: meeting.title,
          status: meeting.status,
          messages: meetings.transcript(second),
        }),
      };
    }
    if (operation === "say" && second !== undefined && rest.length > 0) {
      void meetings.post(actor, second, rest.join(" ")).catch(() => undefined);
      return { kind: "success", text: "meeting message accepted" };
    }
    if (operation === "leave" && second !== undefined) {
      void meetings.leave(actor, second).catch(() => undefined);
      return { kind: "success", text: "meeting leave accepted" };
    }
    if (operation === "close" && second !== undefined && rest.length > 0) {
      void meetings.close(actor, second, rest.join(" ")).catch(() => undefined);
      return { kind: "success", text: "meeting close accepted" };
    }
  } catch (cause) {
    return {
      kind: "error",
      text: cause instanceof Error ? cause.message : String(cause),
    };
  }
  return {
    kind: "error",
    text: "usage: /meeting [list <workspace>] | create <workspace> <title> | join <meeting> <name> | seats <meeting> | read <meeting> | say <meeting> <text> | leave <meeting> | close <meeting> <summary>",
  };
}

function registerMeetingInterfaces(
  ctx: MeetingContext,
  meetings: MeetingService,
): void {
  ctx.commands.register({
    name: "meeting",
    description: "manage DSH Pluginmax meetings",
    input: {
      hint: "list [workspace] | create <workspace> <title> | join <meeting> <name> | seats <meeting> | read <meeting> | say <meeting> <text> | leave <meeting> | close <meeting> <summary>",
      attachments: false,
    },
    handler: (invocation) =>
      commandOperation(
        meetings,
        ctx.get("collabAssignment"),
        invocation.rawInput,
      ),
  });
  ctx.tools.register({
    name: "collab_meeting",
    description:
      "Create or inspect meetings, join a seat, speak, leave, or spawn a bounded meeting Agent.",
    parameters: {
      type: "object",
      additionalProperties: false,
      properties: {
        operation: {
          type: "string",
          enum: [
            "list",
            "create",
            "join",
            "seats",
            "read",
            "say",
            "leave",
            "close",
            "spawn",
          ],
        },
        workspaceId: { type: "string" },
        meetingId: { type: "string" },
        title: { type: "string" },
        displayName: { type: "string" },
        content: { type: "string" },
        summary: { type: "string" },
        seatId: { type: "string" },
        personaId: { type: "string" },
        provider: { type: "string" },
      },
      required: ["operation"],
    },
    output: stringToolOutput,
    execute: async (args, exec) => {
      exec.signal.throwIfAborted();
      const parsed = parseOrInvalid(
        z.object({
          operation: z.enum([
            "list",
            "create",
            "join",
            "seats",
            "read",
            "say",
            "leave",
            "close",
            "spawn",
          ]),
          workspaceId: idSchema.optional(),
          meetingId: z.string().min(1).max(160).optional(),
          title: titleSchema.optional(),
          displayName: displayNameSchema.optional(),
          content: textSchema.optional(),
          summary: textSchema.optional(),
          seatId: idSchema.optional(),
          personaId: idSchema.optional(),
          provider: z.string().trim().min(1).max(80).optional(),
        }),
        args,
      );
      const actor = actorFromExec(exec);
      if (parsed.operation === "list") {
        if (parsed.workspaceId === undefined)
          throw new MeetingError("invalid_input", "workspaceId is required");
        return meetings
          .list(parsed.workspaceId)
          .map(
            (meeting) => `${meeting.id}\t${meeting.status}\t${meeting.title}`,
          )
          .join("\n");
      }
      if (parsed.meetingId === undefined)
        throw new MeetingError("invalid_input", "meetingId is required");
      if (parsed.operation === "create") {
        if (parsed.workspaceId === undefined || parsed.title === undefined)
          throw new MeetingError(
            "invalid_input",
            "workspaceId and title are required",
          );
        const agent = agentFromExec(exec);
        const meeting = await meetings.create(actor, {
          workspaceId: parsed.workspaceId,
          title: parsed.title,
          ...(agent === undefined ? {} : { parentSessionId: agent.id }),
        });
        return `created meeting ${meeting.id}: ${meeting.title}`;
      }
      if (parsed.operation === "join") {
        if (parsed.displayName === undefined)
          throw new MeetingError("invalid_input", "displayName is required");
        const participant = await meetings.join(
          actor,
          parsed.meetingId,
          parsed.displayName,
        );
        return `joined ${participant.meetingId} as ${participant.displayName}`;
      }
      if (parsed.operation === "seats") {
        const assignments = ctx.get("collabAssignment");
        if (assignments === undefined)
          throw new MeetingError("not_found", "roles service is unavailable");
        const participants = await meetings.pullSeats(
          actor,
          parsed.meetingId,
          assignments,
        );
        return participants
          .map(
            (participant) =>
              `${participant.seatId}\t${participant.status}\t${participant.displayName}${participant.hint === undefined ? "" : `\t${participant.hint}`}`,
          )
          .join("\n");
      }
      if (parsed.operation === "read") {
        const meeting = meetings.get(parsed.meetingId);
        return JSON.stringify({
          meetingId: meeting.id,
          title: meeting.title,
          status: meeting.status,
          messages: meetings.transcript(parsed.meetingId),
        });
      }
      if (parsed.operation === "say") {
        if (parsed.content === undefined)
          throw new MeetingError("invalid_input", "content is required");
        const message = await meetings.post(
          actor,
          parsed.meetingId,
          parsed.content,
        );
        return `message ${message.sequence} recorded`;
      }
      if (parsed.operation === "leave") {
        const participant = await meetings.leave(actor, parsed.meetingId);
        return `left ${participant.meetingId}; display name is retained`;
      }
      if (parsed.operation === "close") {
        const summary = parsed.summary ?? "";
        const meeting = await meetings.close(actor, parsed.meetingId, summary);
        return `closed ${meeting.id}`;
      }
      const participant = await meetings.spawnAgent(
        actor,
        {
          meetingId: parsed.meetingId,
          ...(parsed.seatId === undefined ? {} : { seatId: parsed.seatId }),
          ...(parsed.personaId === undefined
            ? {}
            : { personaId: parsed.personaId }),
          ...(parsed.displayName === undefined
            ? {}
            : { displayName: parsed.displayName }),
          ...(parsed.provider === undefined
            ? {}
            : { provider: parsed.provider }),
        },
        ctx.get("collabPersonas"),
      );
      return `spawned ${participant.displayName} (${participant.id})`;
    },
  });
}

export async function apply(ctx: MeetingContext): Promise<void | (() => void)> {
  const domain = await ctx.storageDomain.open(meetingDomainSpec);
  // Mount is the one moment no dispatch can still be live, so the restart sweep
  // retires every dispatch-backed row at once; runtime delivery reaps the rest.
  await reapRestartedDispatchParticipants(domain.table("participants"), () => new Date());
  await collapseDuplicateSeatParticipants(domain.table("participants"));
  const meetings = new MeetingService({
    meetings: domain.table("meetings"),
    participants: domain.table("participants"),
    messages: domain.table("messages"),
  });
  const runtime = new MeetingRuntime({
    meetings,
    agents: () => ctx.agents,
    defaultModel: () => ctx.agentDefaultModel,
    personas: () => ctx.get("collabPersonas"),
    subagents: () => ctx.get("subagents"),
  });
  ctx.provide("collabMeeting", meetings);
  ctx.effect(() => () => void domain.close());
  ctx.effect(() => () => void runtime.dispose());
  registerMeetingInterfaces(ctx, meetings);
  let routeDisposers: Array<() => void> = [];
  const identityFiber = ctx.inject(["collabTeam"], (child) => {
    routeDisposers = createMeetingRoutes(meetings, child.collabTeam, {
      assignments: () => ctx.get("collabAssignment"),
      agents: () => ctx.get("agents"),
      personas: () => ctx.get("collabPersonas"),
      subagents: () => ctx.get("subagents"),
      runtime: () => runtime,
    }).map((route) => ctx.webServer.register(route)) as Array<() => void>;
  });
  return () => {
    identityFiber.dispose();
    for (const dispose of routeDisposers) dispose();
  };
}
