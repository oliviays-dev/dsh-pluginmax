import type { ServerResponse } from "node:http";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  apply,
  collapseDuplicateSeatParticipants,
  createMeetingRoutes,
  inject,
  meetingDomainSpec,
  MeetingService,
  MeetingRuntime,
  reapRestartedDispatchParticipants,
  type AssignmentServiceLike,
  type Meeting,
  type MeetingContext,
  type MeetingDomainLike,
  type MeetingMessage,
  type MeetingParticipant,
  type PersonaServiceLike,
  type MeetingWorkerStartLike,
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
  starts: MeetingWorkerStartLike[],
  replies: string[] = [],
  failures: unknown[] = [],
): SubagentsRuntimeLike {
  return {
    start: async (_name, spec) => {
      starts.push(spec);
      const failure = failures.shift();
      const reply = failure === undefined ? (replies.shift() ?? `回复 ${starts.length}`) : undefined;
      return {
        id: `worker-run-${starts.length}`,
        result:
          failure === undefined
            ? Promise.resolve({
                output: [{ type: "text", text: reply! }],
                stopReason: "completed",
              })
            : Promise.resolve({
                output: [],
                stopReason: "error",
                diagnostic: String(failure),
              }),
        dispose: async () => undefined,
      };
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
    expect(inject).toEqual([
      "storageDomain",
      "commands",
      "tools",
      "webServer",
      "agents",
      "agentDefaultModel",
    ]);
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

    const repulled = await service.pullSeats(
      { kind: "user", id: "admin", globalRole: "admin" },
      meeting.id,
      roles(false),
    );
    expect(
      repulled.find((participant) => participant.seatId === "builder")?.id,
    ).toBe(participants.find((participant) => participant.seatId === "builder")?.id);
    expect(
      repulled.filter((participant) => participant.seatId === "builder"),
    ).toHaveLength(1);

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
    const renamed = await service.join(
      { kind: "user", id: "carol", workspaceRole: "member" },
      meeting.id,
      "Alice",
    );
    expect(renamed.displayName).toBe("Alice · Agent");
    await expect(
      service.close(
        { kind: "user", id: "alice", workspaceRole: "member" },
        meeting.id,
        "Alice left and cannot close.",
      ),
    ).rejects.toMatchObject({ code: "forbidden" });
    const returned = await service.join(
      { kind: "user", id: "alice", workspaceRole: "member" },
      meeting.id,
      "Alice",
    );
    expect(returned).toMatchObject({ id: alice.id, status: "active" });
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

  it("pulls only the selected seats and exposes readable seat choices", async () => {
    const meeting = await service.create(
      { kind: "user", id: "admin", globalRole: "admin" },
      { workspaceId: "main", title: " selective seats" },
    );
    await service.pullSeats(
      { kind: "user", id: "admin", globalRole: "admin" },
      meeting.id,
      roles(true),
      ["owner"],
    );
    const pulledParticipants = service.participants(meeting.id);
    expect(pulledParticipants.map((participant) => participant.seatId)).toEqual([
      "owner",
    ]);
    expect(pulledParticipants[0]).toMatchObject({
      displayName: "负责人:alice",
      status: "active",
    });

    const team = {
      resolveToken: (token: string) =>
        token === "member-token"
          ? { userId: "alice", role: "member" }
          : undefined,
      members: () => [
        { userId: "alice", name: "Alice", memberRole: "member" },
      ],
    };
    const routes = createMeetingRoutes(service, team, {
      assignments: () => roles(true),
    });
    const seatsRoute = findRoute(routes, "/api/collab/meeting/seats");
    const seatsResponse = await call(
      seatsRoute,
      fakeRequest("GET", `/api/collab/meeting/seats?meetingId=${meeting.id}`, {
        token: "member-token",
        origin: "http://127.0.0.1:33117",
      }),
    );
    expect(seatsResponse.status).toBe(200);
    const seats = (
      seatsResponse.json() as {
        seats: Array<{
          seatId: string;
          availability: string;
          occupancy: string;
          assigneeName?: string;
          leader?: boolean;
        }>;
      }
    ).seats;
    expect(seats).toHaveLength(2);
    expect(seats.find((seat: { seatId: string }) => seat.seatId === "owner"))
      .toMatchObject({
        availability: "joined",
        occupancy: "filled",
        assigneeName: "Alice",
        leader: true,
      });
    expect(seats.find((seat: { seatId: string }) => seat.seatId === "builder"))
      .toMatchObject({
        availability: "selectable",
        occupancy: "open",
      });

    const pullRoute = findRoute(routes, "/api/collab/meeting/seats/pull");
    const pullResponse = await call(
      pullRoute,
      fakeRequest("POST", "/api/collab/meeting/seats/pull", {
        token: "member-token",
        origin: "http://127.0.0.1:33117",
        body: { meetingId: meeting.id, seatIds: ["builder"] },
      }),
    );
    expect(pullResponse.status).toBe(200);
    const selectedPullParticipants = (
      pullResponse.json() as {
        participants: Array<{
          seatId?: string;
          status: string;
          displayName: string;
        }>;
      }
    ).participants;
    expect(selectedPullParticipants).toHaveLength(2);
    expect(
      selectedPullParticipants.find((participant) => participant.seatId === "builder"),
    ).toMatchObject({
      seatId: "builder",
      status: "pending",
      displayName: "[待认领] 执行者",
    });
  });

  it("invites workspace members directly and lets people change their own seat", async () => {
    const meeting = await service.create(
      { kind: "user", id: "admin", globalRole: "admin" },
      { workspaceId: "main", title: "直邀评审" },
    );
    await service.join(
      { kind: "user", id: "alice", workspaceRole: "member" },
      meeting.id,
      "Alice",
    );

    const invited = await service.inviteParticipant(
      { kind: "user", id: "alice", workspaceRole: "member" },
      meeting.id,
      { targetId: "bob", displayName: "Bob", seatLabel: "后端" },
    );
    expect(invited).toMatchObject({
      kind: "human",
      refId: "bob",
      displayName: "Bob",
      seatLabel: "后端",
      status: "active",
      source: "direct",
      leader: false,
    });
    await expect(
      service.inviteParticipant(
        { kind: "user", id: "alice", workspaceRole: "member" },
        meeting.id,
        { targetId: "bob", displayName: "Bob" },
      ),
    ).rejects.toMatchObject({ code: "conflict" });

    const changedSeat = await service.changeOwnSeat(
      { kind: "user", id: "alice", workspaceRole: "member" },
      meeting.id,
      "主持人",
    );
    expect(changedSeat).toMatchObject({ refId: "alice", seatLabel: "主持人" });
    await service.changeOwnSeat(
      { kind: "user", id: "bob", workspaceRole: "member" },
      meeting.id,
      "评审",
    );
    expect(
      service
        .participants(meeting.id)
        .find((participant) => participant.refId === "alice")?.seatLabel,
    ).toBe("主持人");
    expect(service.transcript(meeting.id).at(-1)).toMatchObject({
      senderKind: "system",
      content: "Alice 已邀请 Bob 入会。",
    });

    const team = {
      resolveToken: (token: string) =>
        token === "alice-token"
          ? { userId: "alice", role: "member" }
          : token === "bob-token"
            ? { userId: "bob", role: "member" }
            : token === "outsider-token"
              ? { userId: "outsider", role: "member" }
              : undefined,
      members: () => [
        { userId: "alice", name: "Alice", memberRole: "member" },
        { userId: "bob", name: "Bob", memberRole: "member" },
      ],
    };
    const routes = createMeetingRoutes(service, team);
    const peopleResponse = await call(
      findRoute(routes, "/api/collab/meeting/people"),
      fakeRequest("GET", `/api/collab/meeting/people?meetingId=${meeting.id}`, {
        token: "alice-token",
        origin: "http://127.0.0.1:33117",
      }),
    );
    expect(peopleResponse.status).toBe(200);
    expect(
      (peopleResponse.json() as { people: Array<{ id: string; state?: string }> })
        .people,
    ).toMatchObject([
      { id: "alice", state: "active" },
      { id: "bob", state: "active" },
    ]);

    const outsiderResponse = await call(
      findRoute(routes, "/api/collab/meeting/participants/invite"),
      fakeRequest("POST", "/api/collab/meeting/participants/invite", {
        token: "alice-token",
        origin: "http://127.0.0.1:33117",
        body: {
          meetingId: meeting.id,
          people: [{ targetId: "outsider", seatLabel: "外部" }],
        },
      }),
    );
    expect(outsiderResponse.status).toBe(400);
    expect(
      service
        .participants(meeting.id)
        .some((participant) => participant.refId === "outsider"),
    ).toBe(false);

    const seatResponse = await call(
      findRoute(routes, "/api/collab/meeting/participant/change-seat"),
      fakeRequest("POST", "/api/collab/meeting/participant/change-seat", {
        token: "bob-token",
        origin: "http://127.0.0.1:33117",
        body: { meetingId: meeting.id, seatLabel: "前端" },
      }),
    );
    expect(seatResponse.status).toBe(200);
    expect(
      (seatResponse.json() as { participant: { seatLabel?: string } }).participant,
    ).toMatchObject({ refId: "bob", seatLabel: "前端" });
  });

  it("lets leaders manage meeting seats and clears assignments on delete", async () => {
    const meeting = await service.create(
      { kind: "user", id: "admin", globalRole: "admin" },
      { workspaceId: "main", title: "会议席位" },
    );
    await service.join(
      { kind: "user", id: "alice", workspaceRole: "member" },
      meeting.id,
      "Alice",
    );
    await service.join(
      { kind: "user", id: "bob", workspaceRole: "member" },
      meeting.id,
      "Bob",
    );

    await expect(
      service.addSeat(
        { kind: "user", id: "bob", workspaceRole: "member" },
        meeting.id,
        "后端",
      ),
    ).rejects.toMatchObject({ code: "forbidden" });

    const withSeat = await service.addSeat(
      { kind: "user", id: "alice", workspaceRole: "member" },
      meeting.id,
      "后端",
    );
    expect(withSeat.seats).toHaveLength(1);
    expect(withSeat.seats[0]).toMatchObject({ label: "后端" });
    const seat = withSeat.seats[0]!;
    await expect(
      service.addSeat(
        { kind: "user", id: "alice", workspaceRole: "member" },
        meeting.id,
        "后端",
      ),
    ).rejects.toMatchObject({ code: "conflict" });

    const bob = await service.changeOwnSeat(
      { kind: "user", id: "bob", workspaceRole: "member" },
      meeting.id,
      undefined,
      seat.id,
    );
    expect(bob).toMatchObject({ seatId: seat.id, seatLabel: "后端" });
    await expect(
      service.inviteParticipant(
        { kind: "user", id: "alice", workspaceRole: "member" },
        meeting.id,
        {
          targetId: "carol",
          displayName: "Carol",
          seatId: seat.id,
          seatLabel: seat.label,
        },
      ),
    ).rejects.toMatchObject({ code: "conflict" });

    const renamed = await service.renameSeat(
      { kind: "user", id: "alice", workspaceRole: "member" },
      meeting.id,
      seat.id,
      "后端 Owner",
    );
    expect(renamed.seats).toMatchObject([{ id: seat.id, label: "后端 Owner" }]);
    expect(
      service.participants(meeting.id).find((participant) => participant.id === bob.id),
    ).toMatchObject({ seatLabel: "后端 Owner" });

    const cleared = await service.removeSeat(
      { kind: "user", id: "alice", workspaceRole: "member" },
      meeting.id,
      seat.id,
    );
    expect(cleared.seats).toEqual([]);
    expect(
      service.participants(meeting.id).find((participant) => participant.id === bob.id),
    ).toMatchObject({ status: "active", seatId: undefined, seatLabel: undefined });
  });

  it("lets the meeting leader and avatar owner change an avatar's seat", async () => {
    const meeting = await service.create(
      { kind: "user", id: "alice", workspaceRole: "member" },
      { workspaceId: "main", title: "席位权限" },
    );
    await service.join(
      { kind: "user", id: "alice", workspaceRole: "member" },
      meeting.id,
      "Alice",
    );
    const withSeat = await service.addSeat(
      { kind: "user", id: "alice", workspaceRole: "member" },
      meeting.id,
      "评审",
    );
    const seat = withSeat.seats[0]!;
    const avatar = await service.spawnAgentForUser(
      { kind: "user", id: "alice", workspaceRole: "member" },
      {
        meetingId: meeting.id,
        personaId: "architect",
        displayName: "Alice 的分身",
        provider: "spawn",
        autoSpeak: "mentions",
        initialGreeting: false,
        ownerName: "Alice",
      },
      personas(),
    );
    expect(avatar.ownerId).toBe("alice");

    const byOwner = await service.changeParticipantSeat(
      { kind: "user", id: "alice", workspaceRole: "member" },
      meeting.id,
      avatar.id,
      undefined,
      seat.id,
    );
    expect(byOwner).toMatchObject({ seatId: seat.id, seatLabel: "评审" });

    await expect(
      service.changeParticipantSeat(
        { kind: "user", id: "bob", workspaceRole: "member" },
        meeting.id,
        avatar.id,
        undefined,
        seat.id,
      ),
    ).rejects.toMatchObject({ code: "forbidden" });
  });

  it("lets authorized participants remove users and avatars", async () => {
    const reports: Array<{
      delegationId: string;
      finalize: boolean | undefined;
    }> = [];
    service.setDelegationReporter({
      generateDelegationReport: async (delegationId, _transcript, options) => {
        reports.push({ delegationId, finalize: options.finalize });
      },
    });
    const meeting = await service.create(
      { kind: "user", id: "admin", globalRole: "admin" },
      { workspaceId: "main", title: "移出参会者" },
    );
    const alice = await service.join(
      { kind: "user", id: "alice", workspaceRole: "member" },
      meeting.id,
      "Alice",
    );
    const bob = await service.join(
      { kind: "user", id: "bob", workspaceRole: "member" },
      meeting.id,
      "Bob",
    );
    const avatar = await service.spawnAgentForUser(
      { kind: "user", id: "alice", workspaceRole: "member" },
      {
        meetingId: meeting.id,
        personaId: "architect",
        displayName: "Alice 的分身",
        ownerName: "Alice",
        autoSpeak: "manual",
        initialGreeting: false,
        delegationId: "delegation-01",
      },
      personas(),
    );

    await expect(
      service.removeParticipant(
        { kind: "user", id: "bob", workspaceRole: "member" },
        meeting.id,
        avatar.id,
      ),
    ).rejects.toMatchObject({ code: "forbidden" });
    await expect(
      service.removeParticipant(
        { kind: "user", id: "alice", workspaceRole: "member" },
        meeting.id,
        alice.id,
      ),
    ).rejects.toMatchObject({ code: "conflict" });

    const removedBob = await service.removeParticipant(
      { kind: "user", id: "alice", workspaceRole: "member" },
      meeting.id,
      bob.id,
    );
    const removedAvatar = await service.removeParticipant(
      { kind: "user", id: "alice", workspaceRole: "member" },
      meeting.id,
      avatar.id,
    );

    expect(removedBob).toMatchObject({ id: bob.id, status: "left" });
    expect(removedAvatar).toMatchObject({ id: avatar.id, status: "left" });
    expect(
      service
        .participants(meeting.id)
        .filter((participant) => participant.status === "active")
        .map((participant) => participant.id),
    ).toEqual([alice.id]);
    expect(
      service
        .transcript(meeting.id)
        .filter((message) => message.senderKind === "system")
        .map((message) => message.content),
    ).toEqual([
      "Bob 已被 Alice 移出会议。",
      "Alice 的分身 已被 Alice 移出会议。",
    ]);
    expect(reports).toEqual([
      { delegationId: avatar.delegationId, finalize: false },
    ]);
  });

  it("creates durable worker-backed participants without binding to an Agent", async () => {
    const meeting = await service.create(
      { kind: "agent", id: "root-agent", workspaceRole: "member" },
      { workspaceId: "main", title: "架构评审" },
    );
    await service.pullSeats(
      { kind: "agent", id: "root-agent", workspaceRole: "member" },
      meeting.id,
      roles(false),
    );
    const starts: MeetingWorkerStartLike[] = [];
    const participant = await service.spawnAgent(
      { kind: "agent", id: "root-agent", workspaceRole: "member" },
      { meetingId: meeting.id, seatId: "builder" },
      personas(),
    );
    expect(participant).toMatchObject({
      kind: "agent",
      refId: expect.stringMatching(/^worker:[\da-f-]{36}$/),
      personaId: "builder",
      status: "active",
    });
    expect(starts).toHaveLength(0);
  });

  it("runs one-shot workers and writes their final output only to the meeting", async () => {
    const meeting = await service.create(
      { kind: "agent", id: "root-agent", workspaceRole: "member" },
      { workspaceId: "main", title: "协作会" },
    );
    await service.join(
      { kind: "user", id: "alice", workspaceRole: "member" },
      meeting.id,
      "Alice",
    );
    const starts: MeetingWorkerStartLike[] = [];
    const disposed: string[] = [];
    const runtime = new MeetingRuntime({
      meetings: service,
      agents: () => ({
        get: () => undefined,
        create: async (options) => ({
          agent: { id: options.sessionId },
          dispose: async () => void disposed.push(options.sessionId),
        }),
      }),
      personas: () => personas(),
      subagents: () => subagents(starts, ["边界如下"]),
    });
    await service.spawnAgent(
      { kind: "agent", id: "root-agent", workspaceRole: "member" },
      { meetingId: meeting.id, personaId: "architect", displayName: "架构师" },
      personas(),
    );
    const participant = service
      .participants(meeting.id)
      .find((candidate) => candidate.kind === "agent")!;
    const message = await service.post(
      { kind: "user", id: "alice", workspaceRole: "member" },
      meeting.id,
      "请给出边界建议。",
    );
    runtime.dispatch(message, service.participants(meeting.id).filter((candidate) =>
      message.deliveries.some((delivery) => delivery.participantId === candidate.id),
    ));
    await runtime.waitIdle();
    expect(starts).toHaveLength(1);
    expect(starts[0]?.parent.id).toMatch(/^[\da-f-]{36}$/i);
    expect(starts[0]?.toolFilter).toEqual({ allow: [] });
    expect(starts[0]?.prompt[0]?.text).toContain("# architect SOUL");
    expect(starts[0]?.prompt[0]?.text).toContain("请给出边界建议。");
    expect(
      service
        .transcript(meeting.id)
        .find((candidate) => candidate.id === message.id)?.deliveries,
    ).toMatchObject([{ participantId: participant.id, status: "delivered" }]);
    expect(service.transcript(meeting.id).at(-1)).toMatchObject({
      senderKind: "agent",
      senderName: "架构师",
      content: "边界如下",
    });

    const recovered = new MeetingService(current, {
      now: () => new Date(timestamp),
    });
    expect(recovered.list("main")).toHaveLength(1);
    expect(recovered.transcript(meeting.id)).toHaveLength(2);
    expect(
      recovered
      .participants(meeting.id)
      .map((participant) => participant.refId),
    ).toContain(participant.refId);
  });

  it("composes base soul and role overlay when both personas are present", async () => {
    const meeting = await service.create(
      { kind: "agent", id: "root-agent", workspaceRole: "member" },
      { workspaceId: "main", title: "角色叠加会议" },
    );
    await service.join(
      { kind: "user", id: "alice", workspaceRole: "member" },
      meeting.id,
      "Alice",
    );
    const starts: MeetingWorkerStartLike[] = [];
    const runtime = new MeetingRuntime({
      meetings: service,
      agents: () => ({
        get: () => undefined,
        create: async (options) => ({
          agent: { id: options.sessionId },
          dispose: async () => undefined,
        }),
      }),
      personas: () => personas(),
      subagents: () => subagents(starts, ["好的"]),
    });
    await service.spawnAgent(
      { kind: "agent", id: "root-agent", workspaceRole: "member" },
      {
        meetingId: meeting.id,
        personaId: "architect",
        basePersonaId: "builder",
        displayName: "双重人设",
      },
      personas(),
    );
    const participant = service
      .participants(meeting.id)
      .find((candidate) => candidate.kind === "agent")!;
    const message = await service.post(
      { kind: "user", id: "alice", workspaceRole: "member" },
      meeting.id,
      "请回复。",
    );
    runtime.dispatch(
      message,
      service.participants(meeting.id).filter((candidate) =>
        message.deliveries.some((delivery) => delivery.participantId === candidate.id),
      ),
    );
    await runtime.waitIdle();
    expect(starts).toHaveLength(1);
    const prompt = starts[0]?.prompt[0]?.text ?? "";
    expect(prompt).toContain("# builder SOUL");
    expect(prompt).toContain("## 会议角色上下文");
    expect(prompt).toContain("架构师");
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

    await service.join(
      { kind: "user", id: "alice", workspaceRole: "member" },
      meeting.id,
      "Alice",
    );
    const all = await service.spawnAgentForUser(
      { kind: "user", id: "alice", workspaceRole: "member" },
      {
        meetingId: meeting.id,
        personaId: "architect",
        autoSpeak: "mentions",
        initialGreeting: true,
        ownerName: "Alice",
      },
      personas(),
    );
    const manual = await service.spawnAgentForUser(
      { kind: "user", id: "alice", workspaceRole: "member" },
      {
        meetingId: meeting.id,
        personaId: "builder",
        autoSpeak: "manual",
        initialGreeting: false,
        ownerName: "Alice",
      },
      personas(),
    );
    expect(all).toMatchObject({
      kind: "agent",
      ownerId: "alice",
      ownerName: "Alice",
      autoSpeak: "mentions",
      initialGreeting: true,
    });
    expect(manual.displayName).not.toBe(all.displayName);

    const group = await service.post(
      { kind: "user", id: "alice", workspaceRole: "member" },
      meeting.id,
      "群发消息",
    );
    expect(group.deliveries).toEqual([]);

    const direct = await service.post(
      { kind: "user", id: "alice", workspaceRole: "member" },
      meeting.id,
      "定向消息",
      {
        mentions: [all.id],
      },
    );
    expect(direct.mentions).toEqual([all.id]);
    expect(direct.deliveries).toMatchObject([
      { participantId: all.id, targetId: all.refId, status: "pending" },
    ]);

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

  function participantRow(
    overrides: Partial<MeetingParticipant> &
      Pick<MeetingParticipant, "id" | "meetingId" | "refId">,
  ): MeetingParticipant {
    return {
      kind: "agent",
      displayName: "Agent",
      leader: false,
      status: "active",
      source: "spawned",
      joinedAt: timestamp,
      updatedAt: timestamp,
      ...overrides,
    };
  }

  async function meetingWithAlice(): Promise<Meeting> {
    const meeting = await service.create(
      { kind: "user", id: "admin", globalRole: "admin" },
      { workspaceId: "main", title: "需求讨论" },
    );
    await service.join(
      { kind: "user", id: "alice", workspaceRole: "member" },
      meeting.id,
      "Alice",
    );
    return meeting;
  }

  it("keeps mentions targeted while group messages remain visible context", async () => {
    const meeting = await meetingWithAlice();
    const all = await service.spawnAgentForUser(
      { kind: "user", id: "alice", workspaceRole: "member" },
      {
        meetingId: meeting.id,
        personaId: "architect",
        displayName: "架构师",
        autoSpeak: "mentions",
        initialGreeting: false,
        ownerName: "Alice",
      },
      personas(),
    );
    await service.spawnAgentForUser(
      { kind: "user", id: "alice", workspaceRole: "member" },
      {
        meetingId: meeting.id,
        personaId: "builder",
        displayName: "执行者",
        autoSpeak: "manual",
        initialGreeting: false,
        ownerName: "Alice",
      },
      personas(),
    );

    const direct = await service.post(
      { kind: "user", id: "alice", workspaceRole: "member" },
      meeting.id,
      "请架构师判断边界",
      { mentions: [all.id] },
    );
    expect(direct.deliveries).toEqual([
      {
        participantId: all.id,
        targetId: all.refId,
        status: "pending",
      },
    ]);

    const group = await service.post(
      { kind: "user", id: "alice", workspaceRole: "member" },
      meeting.id,
      "这条只是同步",
    );
    expect(group.deliveries).toEqual([]);
  });

  it("records worker failures without retiring the durable participant", async () => {
    const meeting = await meetingWithAlice();
    const starts: MeetingWorkerStartLike[] = [];
    const runtime = new MeetingRuntime({
      meetings: service,
      agents: () => ({
        get: () => undefined,
        create: async (options) => ({
          agent: { id: options.sessionId },
          dispose: async () => undefined,
        }),
      }),
      subagents: () => subagents(starts, [], ["model overloaded"]),
    });
    const participant = await service.spawnAgentForUser(
      { kind: "user", id: "alice", workspaceRole: "member" },
      {
        meetingId: meeting.id,
        personaId: "architect",
        autoSpeak: "all",
        initialGreeting: false,
        ownerName: "Alice",
      },
      personas(),
    );
    const message = await service.post(
      { kind: "user", id: "alice", workspaceRole: "member" },
      meeting.id,
      "开始吧",
    );
    runtime.dispatch(message, [participant]);
    await runtime.waitIdle();
    expect(message.deliveries).toMatchObject([{ status: "pending" }]);
    expect(service.transcript(meeting.id).at(-1)?.deliveries).toMatchObject([
      { status: "failed", error: "error: model overloaded" },
    ]);
    expect(
      service.participants(meeting.id).find(({ id }) => id === participant.id)
        ?.status,
    ).toBe("active");
  });

  it("marks expired meeting avatars and blocks their worker replies", async () => {
    const meeting = await meetingWithAlice();
    service.setDelegationReporter({
      generateDelegationReport: async () => undefined,
      getDelegationStatus: () => ({
        status: "active",
        expiresAt: "2025-12-31T23:59:59.000Z",
      }),
    });
    const avatar = await service.spawnAgentForUser(
      { kind: "user", id: "alice", workspaceRole: "member" },
      {
        meetingId: meeting.id,
        personaId: "architect",
        displayName: "过期分身",
        autoSpeak: "mentions",
        initialGreeting: false,
        ownerName: "Alice",
        delegationId: "delegation-expired",
      },
      personas(),
    );

    await expect(
      service.postWorkerReply(avatar.id, "我还能回复"),
    ).rejects.toThrow("delegation is expired");
    expect(service.transcript(meeting.id).at(-1)).toMatchObject({
      senderKind: "system",
      content: expect.stringContaining("的委托已到期"),
    });
  });

  it("isolates same-persona participants across meetings", async () => {
    const first = await meetingWithAlice();
    const second = await service.create(
      { kind: "user", id: "admin", globalRole: "admin" },
      { workspaceId: "main", title: "另一个会议" },
    );
    await service.join(
      { kind: "user", id: "bob", workspaceRole: "member" },
      second.id,
      "Bob",
    );
    const starts: MeetingWorkerStartLike[] = [];
    const runtime = new MeetingRuntime({
      meetings: service,
      agents: () => ({
        get: () => undefined,
        create: async (options) => ({
          agent: { id: options.sessionId },
          dispose: async () => undefined,
        }),
      }),
      subagents: () => subagents(starts, ["隔离回复", "隔离回复"]),
    });
    const left = await service.spawnAgentForUser(
      { kind: "user", id: "alice", workspaceRole: "member" },
      {
        meetingId: first.id,
        personaId: "architect",
        displayName: "架构师",
        autoSpeak: "all",
        initialGreeting: false,
        ownerName: "Alice",
      },
      personas(),
    );
    const right = await service.spawnAgentForUser(
      { kind: "user", id: "bob", workspaceRole: "member" },
      {
        meetingId: second.id,
        personaId: "architect",
        displayName: "架构师",
        autoSpeak: "all",
        initialGreeting: false,
        ownerName: "Bob",
      },
      personas(),
    );
    const leftMessage = await service.post(
      { kind: "user", id: "alice", workspaceRole: "member" },
      first.id,
      "第一场问题",
    );
    const rightMessage = await service.post(
      { kind: "user", id: "bob", workspaceRole: "member" },
      second.id,
      "第二场问题",
    );
    runtime.dispatch(leftMessage, [left]);
    runtime.dispatch(rightMessage, [right]);
    await runtime.waitIdle();
    expect(left.id).not.toBe(right.id);
    expect(service.transcript(first.id).at(-1)?.content).toBe("隔离回复");
    expect(service.transcript(second.id).at(-1)?.content).toBe("隔离回复");
    expect(starts.map((start) => start.prompt[0]?.text))
      .toEqual([
        expect.stringContaining("第一场问题"),
        expect.stringContaining("第二场问题"),
      ]);
  });

  it("rejects unscoped reply writes", async () => {
    const meeting = await meetingWithAlice();
    const participant = await service.spawnAgentForUser(
      { kind: "user", id: "alice", workspaceRole: "member" },
      {
        meetingId: meeting.id,
        personaId: "architect",
        autoSpeak: "manual",
        initialGreeting: false,
        ownerName: "Alice",
      },
      personas(),
    );
    current.participants.records.set(participant.id, {
      ...participant,
      status: "left",
      leftAt: timestamp,
      updatedAt: timestamp,
    });
    await expect(
      service.postWorkerReply(participant.id, "太迟了"),
    ).rejects.toMatchObject({ code: "forbidden" });
  });

  it("retires only dispatch-backed rows on the restart sweep", async () => {
    const table = new FakeTable<MeetingParticipant>();
    const base = { meetingId: "meeting-1", updatedAt: timestamp };
    await table.put(
      "dead",
      participantRow({ ...base, id: "dead", refId: "dispatch-1", source: "direct" }),
    );
    await table.put(
      "spawned-child",
      participantRow({ ...base, id: "spawned-child", refId: "child-1" }),
    );
    await table.put(
      "seat-child",
      participantRow({
        ...base,
        id: "seat-child",
        refId: "child-2",
        source: "seat",
        seatId: "builder",
      }),
    );
    await table.put(
      "already-gone",
      participantRow({
        ...base,
        id: "already-gone",
        refId: "dispatch-2",
        source: "direct",
        status: "left",
      }),
    );

    const reaped = await reapRestartedDispatchParticipants(
      table,
      () => new Date(timestamp),
    );
    expect(reaped).toBe(2);
    expect(table.get("dead")?.status).toBe("left");
    expect(table.get("dead")?.leftAt).toBe(timestamp);
    expect(table.get("spawned-child")?.status).toBe("left");
    expect(table.get("seat-child")?.status).toBe("active");
    expect(table.get("already-gone")?.status).toBe("left");
  });

  it("collapses duplicate seat participants onto the active row", async () => {
    const table = new FakeTable<MeetingParticipant>();
    const base = {
      meetingId: "meeting-1",
      source: "seat" as const,
      seatId: "builder",
      updatedAt: timestamp,
    };
    await table.put(
      "seat-a",
      participantRow({
        ...base,
        id: "seat-a",
        refId: "child-a",
        status: "left",
        joinedAt: "2025-12-31T00:00:00.000Z",
      }),
    );
    await table.put(
      "seat-b",
      participantRow({ ...base, id: "seat-b", refId: "child-b" }),
    );
    await table.put(
      "seat-c",
      participantRow({ ...base, id: "seat-c", refId: "child-c" }),
    );

    const removed = await collapseDuplicateSeatParticipants(table);
    expect(removed).toBe(2);
    expect([...table.keys()]).toEqual(["seat-b"]);
    expect(table.get("seat-b")?.status).toBe("active");
  });
});
