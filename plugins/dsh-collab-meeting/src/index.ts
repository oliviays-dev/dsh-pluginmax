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
export const inject = ["storageDomain", "commands", "tools", "webServer"];

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
    { readonly key: z.ZodType<string>; readonly value: z.ZodType<unknown> }
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
      key: z.string(),
      value: meetingSchema as unknown as z.ZodType<unknown>,
    },
    participants: {
      key: z.string(),
      value: participantSchema as unknown as z.ZodType<unknown>,
    },
    messages: {
      key: z.string(),
      value: messageSchema as unknown as z.ZodType<unknown>,
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

export interface SubagentsRuntimeLike {
  startContinuable(spec: SubagentStartLike): Promise<{
    readonly childId: string;
    readonly messageId: string;
  }>;
  sendMessage(
    sender: AgentLike,
    targetId: string,
    content: readonly SubagentContentLike[],
    options: { readonly signal: AbortSignal },
  ): Promise<string>;
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
    if (existing?.status === "left")
      throw new MeetingError(
        "conflict",
        "this participant identity has left and cannot rejoin",
      );
    if (existing !== undefined)
      throw new MeetingError("conflict", "participant already joined");
    if (nameTaken(participants, parsedName))
      throw new MeetingError("conflict", "participant name is already used");
    const timestamp = nowIso(this.options.now);
    const participant = {
      id: randomUUID(),
      meetingId: meeting.id,
      kind: actorKind(parsedActor),
      refId: parsedActor.id,
      displayName: parsedName,
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
  ): Promise<MeetingParticipant[]> {
    parseOrInvalid(actorSchema, actor);
    const meeting = this.get(meetingId);
    if (meeting.status !== "active")
      throw new MeetingError("conflict", "meeting is closed");
    const config = assignments.config(meeting.workspaceId);
    const occupied = new Map(
      assignments.seats(meeting.workspaceId).map((seat) => [seat.seatId, seat]),
    );
    const timestamp = nowIso(this.options.now);
    for (const seat of config.seats) {
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
      const participant = {
        id: randomUUID(),
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
    parent: AgentLike,
    subagents: SubagentsRuntimeLike,
    personas: PersonaServiceLike | undefined,
    signal: AbortSignal,
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
    let preset: string | undefined;
    if (personas !== undefined && personaId !== undefined) {
      persona = await personas.get(personaId);
      preset = await personas.preset(
        personaId,
        `会议：${meeting.title}\n工作区：${meeting.workspaceId}`,
      );
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
    const prompt = [
      "# DSH Pluginmax 会议分身",
      "",
      personaPrompt(persona, preset),
      "",
      `会议：${meeting.title}`,
      meeting.agenda === "" ? "议程：未填写" : `议程：\n${meeting.agenda}`,
      `工作区：${meeting.workspaceId}`,
      "",
      "当前参与者：",
      ...participants.map(
        (participant) =>
          `- ${participant.displayName} (${participant.kind}/${participant.status})`,
      ),
      "",
      "工具边界：",
      "- 本分身只允许调用 collab_meeting。",
      "- 发言必须调用 operation=say，不得虚构未记录的发言。",
      "- 退出必须调用 operation=leave。",
      "- 不要请求或使用其他工具。",
    ].join("\n");
    signal.throwIfAborted();
    const started = await subagents.startContinuable({
      provider: parsed.provider,
      label: `meeting:${meeting.title}`,
      request: {
        prompt: [{ type: "text", text: prompt }],
        parent,
        toolFilter: { allow: ["collab_meeting"] },
      },
      signal,
    });
    const timestamp = nowIso(this.options.now);
    const participant = {
      id: seat?.id ?? randomUUID(),
      meetingId: meeting.id,
      kind: "agent" as const,
      refId: started.childId,
      displayName,
      ...(parsed.seatId === undefined ? {} : { seatId: parsed.seatId }),
      ...(personaId === undefined ? {} : { personaId }),
      leader: seat?.leader ?? false,
      status: "active" as const,
      source: seat === undefined ? ("spawned" as const) : ("seat" as const),
      joinedAt: seat?.joinedAt ?? timestamp,
      updatedAt: timestamp,
    };
    await this.tables.participants.put(participant.id, participant);
    return participant;
  }

  async post(
    actor: MeetingActor,
    meetingId: string,
    content: string,
    options: {
      readonly subagents?: SubagentsRuntimeLike;
      readonly parent?: AgentLike;
      readonly signal?: AbortSignal;
    } = {},
  ): Promise<MeetingMessage> {
    const parsedActor = parseOrInvalid(actorSchema, actor);
    const meeting = this.get(meetingId);
    if (meeting.status !== "active")
      throw new MeetingError("conflict", "meeting is closed");
    const parsedContent = parseOrInvalid(textSchema, content);
    const participants = this.participants(meeting.id);
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
    const sequence = this.transcript(meeting.id).at(-1)?.sequence ?? 0;
    const timestamp = nowIso(this.options.now);
    const targets = participants.filter(
      (participant) =>
        participant.status === "active" &&
        participant.kind === "agent" &&
        participant.refId !== sender.refId,
    );
    const message = {
      id: randomUUID(),
      sequence: sequence + 1,
      meetingId: meeting.id,
      senderKind: actorKind(parsedActor),
      senderId: parsedActor.id,
      senderName: sender.displayName,
      content: parsedContent,
      deliveries: targets.map((participant) => ({
        participantId: participant.id,
        targetId: participant.refId,
        status: "pending" as const,
      })),
      createdAt: timestamp,
    };
    await this.tables.messages.put(message.id, parseMessage(message));
    if (
      options.subagents === undefined ||
      options.parent === undefined ||
      options.signal === undefined
    ) {
      return this.transcript(meeting.id).at(-1) ?? message;
    }
    const updated: MeetingMessage = {
      ...message,
      deliveries: [...message.deliveries],
    };
    for (const [index, participant] of targets.entries()) {
      try {
        await options.subagents.sendMessage(
          options.parent,
          participant.refId,
          [
            {
              type: "text",
              text: `${sender.displayName}: ${parsedContent}`,
            },
          ],
          { signal: options.signal },
        );
        updated.deliveries[index] = {
          participantId: participant.id,
          targetId: participant.refId,
          status: "delivered",
          at: nowIso(this.options.now),
        };
      } catch (cause) {
        updated.deliveries[index] = {
          participantId: participant.id,
          targetId: participant.refId,
          status: "failed",
          at: nowIso(this.options.now),
          error:
            cause instanceof Error
              ? cause.message.slice(0, 500)
              : "delivery failed",
        };
      }
    }
    await this.tables.messages.put(message.id, parseMessage(updated));
    return updated;
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
  members(workspaceId: string): Array<{ userId: string; memberRole: string }>;
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
  agents?: AgentsServiceLike;
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

function resolveParent(
  parentSessionId: string | undefined,
  agents: AgentsServiceLike | undefined,
): AgentLike | undefined {
  if (parentSessionId === undefined) return undefined;
  if (agents === undefined) return undefined;
  return agents.get(parentSessionId);
}

export function createMeetingRoutes(
  meetings: MeetingService,
  team: TeamServiceLike,
  dependencies: {
    readonly assignments?: () => AssignmentServiceLike | undefined;
    readonly agents?: () => AgentsServiceLike | undefined;
    readonly subagents?: () => SubagentsRuntimeLike | undefined;
  } = {},
): WebRouteLike[] {
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
        if (body.parentSessionId !== undefined) {
          const agents = dependencies.agents?.();
          if (agents?.get(body.parentSessionId) === undefined) {
            throw new MeetingError(
              "invalid_input",
              "parentSessionId must identify a live Agent",
            );
          }
        }
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
          participants: meetings.participants(meeting.id),
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
      method: "POST",
      path: "/api/collab/meeting/seats/pull",
      handler: async (request: IncomingMessage, response: ServerResponse) => {
        const body = parseOrInvalid(
          z.object({ meetingId: z.string().min(1).max(160) }),
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
          }),
          await readBody(request),
        );
        const meeting = meetings.get(body.meetingId);
        const actor = browserActor(team, request, meeting.workspaceId);
        const agents = dependencies.agents?.();
        const subagents = dependencies.subagents?.();
        const parent = resolveParent(meeting.parentSessionId, agents);
        const forward =
          subagents === undefined || parent === undefined
            ? undefined
            : {
                subagents,
                parent,
                signal: AbortSignal.timeout(10_000),
              };
        const message = await meetings.post(
          actor,
          meeting.id,
          body.content,
          forward,
        );
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
        sendJson(response, 200, {
          ok: true,
          meeting: await meetings.close(actor, meeting.id, body.summary),
        });
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
    text: "usage: /meeting [list <workspace>] | create <workspace> <title> | join <meeting> <name> | seats <meeting> | say <meeting> <text> | leave <meeting> | close <meeting> <summary>",
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
      hint: "list [workspace] | create <workspace> <title> | join <meeting> <name> | seats <meeting> | say <meeting> <text> | leave <meeting> | close <meeting> <summary>",
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
      const parent = agentFromExec(exec);
      const subagents = ctx.get("subagents");
      if (parent === undefined || subagents === undefined)
        throw new MeetingError(
          "forbidden",
          "a live Agent and subagents service are required",
        );
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
        parent,
        subagents,
        ctx.get("collabPersonas"),
        exec.signal,
      );
      return `spawned ${participant.displayName} (${participant.refId})`;
    },
  });
}

export async function apply(ctx: MeetingContext): Promise<void | (() => void)> {
  const domain = await ctx.storageDomain.open(meetingDomainSpec);
  const meetings = new MeetingService({
    meetings: domain.table("meetings"),
    participants: domain.table("participants"),
    messages: domain.table("messages"),
  });
  ctx.provide("collabMeeting", meetings);
  ctx.effect(() => () => void domain.close());
  registerMeetingInterfaces(ctx, meetings);
  let routeDisposers: Array<() => void> = [];
  const identityFiber = ctx.inject(["collabTeam"], (child) => {
    routeDisposers = createMeetingRoutes(meetings, child.collabTeam, {
      assignments: () => ctx.get("collabAssignment"),
      agents: () => ctx.get("agents"),
      subagents: () => ctx.get("subagents"),
    }).map((route) => ctx.webServer.register(route)) as Array<() => void>;
  });
  return () => {
    identityFiber.dispose();
    for (const dispose of routeDisposers) dispose();
  };
}
