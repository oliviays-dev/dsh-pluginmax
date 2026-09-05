import type { ServerResponse } from "node:http";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  apply,
  createMeetingRoutes,
  inject,
  meetingDomainSpec,
  MeetingService,
  type AgentLike,
  type AssignmentServiceLike,
  type Meeting,
  type MeetingContext,
  type MeetingDomainLike,
  type MeetingMessage,
  type MeetingParticipant,
  type PersonaServiceLike,
  type SubagentStartLike,
  type SubagentsRuntimeLike,
  type WebRouteLike,
} from "./index.ts";

class FakeTable<V> {
  readonly records = new Map<string, V>();

  get(key: string): V | undefined {
    return this.records.get(key);
  }

  entries(): IterableIterator<[string, V]> {
    return this.records.entries();
  }

  keys(): IterableIterator<string> {
    return this.records.keys();
  }

  get size(): number {
    return this.records.size;
  }

  async put(key: string, value: V): Promise<void> {
    this.records.set(key, value);
  }

  async delete(key: string): Promise<boolean> {
    return this.records.delete(key);
  }
}

function tables() {
  return {
    meetings: new FakeTable<Meeting>(),
    participants: new FakeTable<MeetingParticipant>(),
    messages: new FakeTable<MeetingMessage>(),
  };
}

function fakeDomain(current: ReturnType<typeof tables>): MeetingDomainLike {
  return {
    table: ((name: string) =>
      current[
        name === "meetings"
          ? "meetings"
          : name === "participants"
            ? "participants"
            : "messages"
      ]) as unknown as MeetingDomainLike["table"],
    close: async () => undefined,
  };
}

const timestamp = "2026-01-01T00:00:00.000Z";

function roles(active = true): AssignmentServiceLike {
  return {
    config: () => ({
      workspaceId: "main",
      typeId: "team",
      typeName: "团队",
      seats: [
        {
          id: "owner",
          label: "负责人",
          participantKind: "human",
          personaId: "architect",
        },
        {
          id: "builder",
          label: "执行者",
          participantKind: "agent",
          personaId: "builder",
        },
      ],
    }),
    seats: () =>
      active
        ? [
            {
              seatId: "owner",
              seatLabel: "负责人",
              participantKind: "human",
              assigneeKind: "user",
              assigneeId: "alice",
              personaId: "architect",
              leader: true,
              status: "claimed" as const,
            },
          ]
        : [],
  };
}

function personas(): PersonaServiceLike {
  return {
    get: async (id) => ({
      id,
      name: id === "architect" ? "架构师" : "执行者",
      description: "保持工程判断。",
    }),
    preset: async (id, context) => `# ${id} SOUL\n${context}\n保持工程判断。`,
  };
}

function subagents(
  starts: SubagentStartLike[],
  sends: Array<{ sender: AgentLike; targetId: string; text: string }>,
): SubagentsRuntimeLike {
  return {
    startContinuable: async (spec) => {
      starts.push(spec);
      return {
        childId: `child-${starts.length}`,
        messageId: `message-${starts.length}`,
      };
    },
    sendMessage: async (sender, targetId, content) => {
      sends.push({
        sender,
        targetId,
        text: content.map((item) => item.text).join("\n"),
      });
      return `sent-${sends.length}`;
    },
  };
}

class FakeResponse {
  status = 0;
  body = "";

  writeHead(status: number): ServerResponse {
    this.status = status;
    return this as unknown as ServerResponse;
  }

  end(body?: string): ServerResponse {
    if (body !== undefined) this.body = body;
    return this as unknown as ServerResponse;
  }

  json(): unknown {
    return JSON.parse(this.body) as unknown;
  }
}

function fakeRequest(
  method: string,
  url: string,
  options: { body?: unknown; token?: string; origin?: string } = {},
) {
  const body = options.body === undefined ? "" : JSON.stringify(options.body);
  return {
    method,
    url,
    headers: {
      host: "127.0.0.1:33117",
      ...(options.origin === undefined ? {} : { origin: options.origin }),
      ...(options.token === undefined
        ? {}
        : { authorization: `Bearer ${options.token}` }),
      ...(body === "" ? {} : { "content-type": "application/json" }),
    },
    async *[Symbol.asyncIterator]() {
      if (body !== "") yield Buffer.from(body);
    },
  };
}

async function call(route: WebRouteLike, request: unknown) {
  const response = new FakeResponse();
  await route.handler(
    request as Parameters<typeof route.handler>[0],
    response as unknown as ServerResponse,
  );
  return response;
}

function findRoute(routes: readonly WebRouteLike[], path: string) {
  const found = routes.find((route) => route.path === path);
  if (found === undefined) throw new Error(`missing route: ${path}`);
  return found;
}

describe("dsh-collab-meeting", () => {
  let current: ReturnType<typeof tables>;
  let service: MeetingService;

  beforeEach(() => {
    current = tables();
    service = new MeetingService(current, {
      now: () => new Date(timestamp),
    });
  });

  afterEach(() => {
    expect(current.meetings.size).toBeGreaterThanOrEqual(0);
  });

  it("declares services and the meeting storage domain", () => {
    expect(inject).toEqual(["storageDomain", "commands", "tools", "webServer"]);
    expect(meetingDomainSpec).toMatchObject({
      name: "collab_meeting",
      version: 1,
    });
    expect(Object.keys(meetingDomainSpec.tables)).toEqual([
      "meetings",
      "participants",
      "messages",
    ]);
  });

  it("pulls occupied and pending role seats with persona fallback", async () => {
    const meeting = await service.create(
      { kind: "user", id: "admin", globalRole: "admin" },
      { workspaceId: "main", title: "产品评审" },
    );
    const participants = await service.pullSeats(
      { kind: "user", id: "admin", globalRole: "admin" },
      meeting.id,
      roles(false),
    );
    expect(participants).toHaveLength(2);
    expect(
      participants.map((participant) => participant.seatId).sort(),
    ).toEqual(["builder", "owner"]);
    expect(
      participants.find((participant) => participant.seatId === "owner"),
    ).toMatchObject({
      status: "pending",
      personaId: "architect",
      displayName: "[待认领] 负责人",
      hint: "/assignment claim main owner",
    });
    expect(
      participants.find((participant) => participant.seatId === "builder"),
    ).toMatchObject({
      status: "pending",
      personaId: "builder",
      displayName: "[待认领] 执行者",
      hint: "/assignment claim main builder",
    });

    const occupied = await service.pullSeats(
      { kind: "user", id: "admin", globalRole: "admin" },
      meeting.id,
      roles(true),
    );
    expect(
      occupied.find((participant) => participant.seatId === "owner"),
    ).toMatchObject({
      status: "active",
      refId: "alice",
      displayName: "负责人:alice",
      leader: true,
    });
    expect(
      occupied.find((participant) => participant.seatId === "builder")?.status,
    ).toBe("pending");
  });

  it("elects a leader, records transcript, and keeps left names unused", async () => {
    const meeting = await service.create(
      { kind: "user", id: "admin", globalRole: "admin" },
      { workspaceId: "main", title: "周会" },
    );
    const alice = await service.join(
      { kind: "user", id: "alice", workspaceRole: "member" },
      meeting.id,
      "Alice",
    );
    expect(alice.leader).toBe(true);
    await service.join(
      { kind: "user", id: "bob", workspaceRole: "owner" },
      meeting.id,
      "Bob",
    );
    await expect(
      service.post(
        { kind: "user", id: "carol", workspaceRole: "member" },
        meeting.id,
        "not a participant",
      ),
    ).rejects.toMatchObject({ code: "forbidden" });
    const message = await service.post(
      { kind: "user", id: "alice", workspaceRole: "member" },
      meeting.id,
      "先确认本周目标。",
    );
    expect(message).toMatchObject({ sequence: 1, senderName: "Alice" });
    await service.leave(
      { kind: "user", id: "alice", workspaceRole: "member" },
      meeting.id,
    );
    await expect(
      service.join(
        { kind: "user", id: "carol", workspaceRole: "member" },
        meeting.id,
        "Alice",
      ),
    ).rejects.toMatchObject({ code: "conflict" });
    await expect(
      service.join(
        { kind: "user", id: "alice", workspaceRole: "member" },
        meeting.id,
        "Alice Returns",
      ),
    ).rejects.toMatchObject({ code: "conflict" });
    await expect(
      service.close(
        { kind: "user", id: "alice", workspaceRole: "member" },
        meeting.id,
        "Alice left and cannot close.",
      ),
    ).rejects.toMatchObject({ code: "forbidden" });
    const closed = await service.close(
      { kind: "user", id: "bob", workspaceRole: "owner" },
      meeting.id,
      "目标已确认。",
    );
    expect(closed).toMatchObject({ status: "closed", summary: "目标已确认。" });
    expect(service.transcript(meeting.id).at(-1)?.senderKind).toBe("system");
    expect(
      service
        .participants(meeting.id)
        .every((participant) => participant.status === "left"),
    ).toBe(true);
  });

  it("spawns through startContinuable with SOUL and a tool boundary", async () => {
    const meeting = await service.create(
      { kind: "agent", id: "root-agent", workspaceRole: "member" },
      { workspaceId: "main", title: "架构评审" },
    );
    await service.pullSeats(
      { kind: "agent", id: "root-agent", workspaceRole: "member" },
      meeting.id,
      roles(false),
    );
    const starts: SubagentStartLike[] = [];
    const participant = await service.spawnAgent(
      { kind: "agent", id: "root-agent", workspaceRole: "member" },
      { meetingId: meeting.id, seatId: "builder" },
      { id: "root-agent" },
      subagents(starts, []),
      personas(),
      AbortSignal.timeout(1000),
    );
    expect(participant).toMatchObject({
      kind: "agent",
      refId: "child-1",
      personaId: "builder",
      status: "active",
    });
    expect(starts).toHaveLength(1);
    expect(starts[0]).toMatchObject({
      provider: "spawn",
      label: "meeting:架构评审",
      request: {
        parent: { id: "root-agent" },
        toolFilter: { allow: ["collab_meeting"] },
      },
    });
    const prompt = starts[0]?.request.prompt[0]?.text;
    expect(prompt).toContain("# builder SOUL");
    expect(prompt).toContain("会议：架构评审");
    expect(prompt).toContain("只允许调用 collab_meeting");
  });

  it("forwards human messages to direct meeting Agents and survives restart", async () => {
    const meeting = await service.create(
      { kind: "agent", id: "root-agent", workspaceRole: "member" },
      { workspaceId: "main", title: "协作会" },
    );
    await service.join(
      { kind: "user", id: "alice", workspaceRole: "member" },
      meeting.id,
      "Alice",
    );
    const starts: SubagentStartLike[] = [];
    const sends: Array<{ sender: AgentLike; targetId: string; text: string }> =
      [];
    const runtime = subagents(starts, sends);
    await service.spawnAgent(
      { kind: "agent", id: "root-agent", workspaceRole: "member" },
      { meetingId: meeting.id, personaId: "architect", displayName: "架构师" },
      { id: "root-agent" },
      runtime,
      personas(),
      AbortSignal.timeout(1000),
    );
    const message = await service.post(
      { kind: "user", id: "alice", workspaceRole: "member" },
      meeting.id,
      "请给出边界建议。",
      {
        subagents: runtime,
        parent: { id: "root-agent" },
        signal: AbortSignal.timeout(1000),
      },
    );
    expect(message.deliveries).toMatchObject([
      { targetId: "child-1", status: "delivered" },
    ]);
    expect(sends).toMatchObject([
      {
        sender: { id: "root-agent" },
        targetId: "child-1",
        text: "Alice: 请给出边界建议。",
      },
    ]);

    const recovered = new MeetingService(current, {
      now: () => new Date(timestamp),
    });
    expect(recovered.list("main")).toHaveLength(1);
    expect(recovered.transcript(meeting.id)).toHaveLength(1);
    expect(
      recovered
        .participants(meeting.id)
        .map((participant) => participant.refId),
    ).toContain("child-1");
  });

  it("protects browser routes with same-origin, bearer, and workspace checks", async () => {
    const meeting = await service.create(
      { kind: "user", id: "admin", globalRole: "admin" },
      { workspaceId: "main", title: "安全评审" },
    );
    const team = {
      resolveToken: (token: string) =>
        token === "member-token"
          ? { userId: "alice", role: "member" }
          : token === "outsider-token"
            ? { userId: "outsider", role: "member" }
            : undefined,
      members: () => [{ userId: "alice", memberRole: "member" }],
    };
    const assignmentResolver = {
      service: undefined as AssignmentServiceLike | undefined,
    };
    const routes = createMeetingRoutes(service, team, {
      assignments: () => assignmentResolver.service,
    });
    const list = findRoute(routes, "/api/collab/meetings");
    const crossOrigin = await call(
      list,
      fakeRequest("GET", "/api/collab/meetings?workspaceId=main", {
        token: "member-token",
        origin: "https://evil.example",
      }),
    );
    expect(crossOrigin.status).toBe(403);
    const badToken = await call(
      list,
      fakeRequest("GET", "/api/collab/meetings?workspaceId=main", {
        token: "invalid",
        origin: "http://127.0.0.1:33117",
      }),
    );
    expect(badToken.status).toBe(401);
    const outsider = await call(
      list,
      fakeRequest("GET", "/api/collab/meetings?workspaceId=main", {
        token: "outsider-token",
        origin: "http://127.0.0.1:33117",
      }),
    );
    expect(outsider.status).toBe(403);
    const member = await call(
      list,
      fakeRequest("GET", "/api/collab/meetings?workspaceId=main", {
        token: "member-token",
        origin: "http://127.0.0.1:33117",
      }),
    );
    expect(member.status).toBe(200);
    expect(member.json()).toMatchObject({ ok: true, meetings: [meeting] });

    const seatPull = findRoute(routes, "/api/collab/meeting/seats/pull");
    const unavailable = await call(
      seatPull,
      fakeRequest("POST", "/api/collab/meeting/seats/pull", {
        token: "member-token",
        origin: "http://127.0.0.1:33117",
        body: { meetingId: meeting.id },
      }),
    );
    expect(unavailable.status).toBe(404);
    assignmentResolver.service = roles(false);
    const available = await call(
      seatPull,
      fakeRequest("POST", "/api/collab/meeting/seats/pull", {
        token: "member-token",
        origin: "http://127.0.0.1:33117",
        body: { meetingId: meeting.id },
      }),
    );
    expect(available.status).toBe(200);
    expect(available.json()).toMatchObject({ ok: true });
  });

  it("registers Agent surfaces and only installs browser routes in identity fiber", async () => {
    const provided: string[] = [];
    const commands: unknown[] = [];
    const tools: unknown[] = [];
    const routes: WebRouteLike[] = [];
    const disposers: Array<() => void> = [];
    const ctx: MeetingContext = {
      effect: (register) => disposers.push(register()),
      provide: (key) => provided.push(key),
      commands: { register: (definition) => commands.push(definition) },
      tools: { register: (definition) => tools.push(definition) },
      webServer: { register: (route) => routes.push(route) },
      storageDomain: { open: async () => fakeDomain(current) },
      get: () => undefined,
      inject: (_keys, callback) => {
        callback(
          ctx as MeetingContext & {
            readonly collabTeam: {
              resolveToken: () => undefined;
              members: () => [];
            };
          },
        );
        return { dispose: () => undefined };
      },
    };
    const dispose = await apply(ctx);
    expect(provided).toEqual(["collabMeeting"]);
    expect(commands).toHaveLength(1);
    expect(tools).toHaveLength(1);
    expect(routes.map((route) => route.path)).toContain("/api/collab/meetings");
    expect(typeof dispose).toBe("function");
  });
});
