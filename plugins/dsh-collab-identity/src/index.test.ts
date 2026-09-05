import { describe, expect, it } from "vitest";
import type { ServerResponse } from "node:http";
import {
  apply,
  createIdentityRoutes,
  hashPassword,
  inject,
  teamDomainSpec,
  TeamService,
  verifyPassword,
  type AuditRecord,
  type DomainLike,
  type IdentityContext,
  type MemberRecord,
  type SessionRecord,
  type UserRecord,
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

  values(): IterableIterator<V> {
    return this.records.values();
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

interface Tables {
  users: FakeTable<UserRecord>;
  members: FakeTable<MemberRecord>;
  sessions: FakeTable<SessionRecord>;
  audit: FakeTable<AuditRecord>;
}

function tables(): Tables {
  return {
    users: new FakeTable<UserRecord>(),
    members: new FakeTable<MemberRecord>(),
    sessions: new FakeTable<SessionRecord>(),
    audit: new FakeTable<AuditRecord>(),
  };
}

function service(
  currentTables: Tables = tables(),
  now: () => Date = () => new Date("2026-01-01T00:00:00.000Z"),
) {
  return {
    tables: currentTables,
    service: new TeamService(currentTables, {
      now,
      sessionTtlMs: 1000,
      randomToken: (() => {
        let sequence = 0;
        return () => `token-${String(++sequence).padStart(32, "0")}`;
      })(),
    }),
  };
}

function fakeDomain(currentTables: Tables): DomainLike {
  return {
    table: (name: string) => {
      const key =
        name === "workspace_members"
          ? "members"
          : name === "auth_sessions"
            ? "sessions"
            : name === "audit_log"
              ? "audit"
              : name;
      return currentTables[key as keyof Tables];
    },
    close: async () => undefined,
  } as unknown as DomainLike;
}

async function setupPlugin() {
  const currentTables = tables();
  const disposers: Array<() => void> = [];
  const provided: unknown[] = [];
  const commands: unknown[] = [];
  const tools: unknown[] = [];
  const routes: WebRouteLike[] = [];
  const ctx: IdentityContext = {
    effect: (register) => disposers.push(register()),
    provide: (_key, value) => provided.push(value),
    commands: { register: (definition) => commands.push(definition) },
    tools: { register: (definition) => tools.push(definition) },
    webServer: { register: (route) => routes.push(route) },
    storageDomain: {
      open: async (spec) => {
        expect(spec.name).toBe("collab_team");
        return fakeDomain(currentTables);
      },
    },
  };
  await apply(ctx);
  return {
    currentTables,
    disposers,
    provided,
    commands,
    tools,
    routes,
  };
}

class FakeResponse {
  status = 0;
  body = "";
  headers: Record<string, string | number> = {};

  writeHead(
    status: number,
    headers: Record<string, string | number>,
  ): ServerResponse {
    this.status = status;
    this.headers = headers;
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
  options: {
    body?: unknown;
    origin?: string;
    authorization?: string;
    host?: string;
    fetchSite?: string;
  } = {},
) {
  const body = options.body === undefined ? "" : JSON.stringify(options.body);
  const headers: Record<string, string> = {
    host: options.host ?? "127.0.0.1:33117",
    ...(options.origin === undefined ? {} : { origin: options.origin }),
    ...(options.authorization === undefined
      ? {}
      : { authorization: options.authorization }),
    ...(options.fetchSite === undefined
      ? {}
      : { "sec-fetch-site": options.fetchSite }),
    ...(body === "" ? {} : { "content-type": "application/json" }),
  };
  const request = {
    method,
    url,
    headers,
    async *[Symbol.asyncIterator]() {
      if (body !== "") yield Buffer.from(body);
    },
  };
  return request;
}

async function call(
  route: WebRouteLike,
  request: unknown,
): Promise<FakeResponse> {
  const response = new FakeResponse();
  await route.handler(
    request as Parameters<typeof route.handler>[0],
    response as unknown as ServerResponse,
  );
  return response;
}

function route(routes: readonly WebRouteLike[], path: string): WebRouteLike {
  const found = routes.find((candidate) => candidate.path === path);
  if (found === undefined) throw new Error(`missing route: ${path}`);
  return found;
}

describe("dsh-collab-identity", () => {
  it("declares the domain, service dependencies, and host extensions", () => {
    expect(teamDomainSpec).toMatchObject({
      name: "collab_team",
      version: 1,
    });
    expect(Object.keys(teamDomainSpec.tables)).toEqual([
      "users",
      "workspace_members",
      "auth_sessions",
      "audit_log",
    ]);
    expect(inject).toEqual(["storageDomain", "commands", "tools", "webServer"]);
  });

  it("hashes passwords with salted scrypt and rejects bad hashes", () => {
    const first = hashPassword("correct horse battery");
    const second = hashPassword("correct horse battery");
    expect(first).not.toBe(second);
    expect(verifyPassword("correct horse battery", first)).toBe(true);
    expect(verifyPassword("wrong", first)).toBe(false);
    expect(verifyPassword("x", "not-a-hash")).toBe(false);
  });

  it("bootstraps one admin, issues hashed sessions, and audits bootstrap", async () => {
    const { tables: current, service: team } = service();
    const result = await team.bootstrap({
      userId: "admin",
      name: "Admin",
      password: "password-123",
    });

    expect(result.role).toBe("admin");
    expect(result.token).not.toContain("$");
    expect([...current.sessions.entries()][0]?.[0]).toMatch(/^[a-f0-9]{64}$/);
    expect(current.users.get("admin")?.passwordHash).not.toBe("password-123");
    expect([...current.audit.entries()].map(([, event]) => event)).toEqual([
      expect.objectContaining({ action: "bootstrap", actorId: "admin" }),
    ]);
    await expect(
      team.bootstrap({
        userId: "other",
        name: "Other",
        password: "password-456",
      }),
    ).rejects.toMatchObject({ code: "conflict" });
    expect(current.users.size).toBe(1);
  });

  it("rejects duplicate bootstrap even when calls race", async () => {
    const { tables: current, service: team } = service();
    const results = await Promise.allSettled([
      team.bootstrap({ userId: "a", name: "A", password: "password-1" }),
      team.bootstrap({ userId: "b", name: "B", password: "password-2" }),
    ]);
    expect(
      results.filter((result) => result.status === "fulfilled"),
    ).toHaveLength(1);
    expect(current.users.size).toBe(1);
    expect(current.audit.size).toBe(1);
  });

  it("rejects invalid input before writing records", async () => {
    const { tables: current, service: team } = service();
    await expect(async () =>
      team.bootstrap({
        userId: "../escape",
        name: "Bad",
        password: "short",
      }),
    ).rejects.toMatchObject({ code: "invalid_input" });
    expect(current.users.size).toBe(0);
    expect(current.audit.size).toBe(0);
    expect(() => team.members("bad/id")).toThrow("request input is invalid");
  });

  it("expires, logs out, and rotates sessions on password change", async () => {
    let milliseconds = 0;
    const { tables: current, service: team } = service(
      tables(),
      () => new Date(Date.parse("2026-01-01T00:00:00.000Z") + milliseconds),
    );
    await team.bootstrap({
      userId: "admin",
      name: "Admin",
      password: "password-123",
    });
    const second = await team.login({
      userId: "admin",
      password: "password-123",
    });

    milliseconds = 1001;
    expect(team.resolveToken(second.token)).toBeUndefined();

    milliseconds = 0;
    const keptSession = await team.login({
      userId: "admin",
      password: "password-123",
    });
    await team.changePassword({
      userId: "admin",
      currentPassword: "password-123",
      newPassword: "password-456",
      keepToken: keptSession.token,
    });
    expect(team.resolveToken(keptSession.token)?.userId).toBe("admin");
    expect(current.sessions.size).toBe(1);
    await team.logout(keptSession.token);
    expect(team.resolveToken(keptSession.token)).toBeUndefined();
    expect(current.sessions.size).toBe(0);
  });

  it("manages users and workspace members with admin checks", async () => {
    const { tables: current, service: team } = service();
    const admin = await team.bootstrap({
      userId: "admin",
      name: "Admin",
      password: "password-123",
    });
    const member = await team.registerUser(admin.userId, {
      userId: "member",
      name: "Member",
      password: "password-456",
      role: "member",
    });
    const memberLogin = await team.login({
      userId: "member",
      password: "password-456",
    });
    expect(member.role).toBe("member");
    await expect(
      team.registerUser(memberLogin.userId, {
        userId: "guest",
        name: "Guest",
        password: "password-789",
        role: "guest",
      }),
    ).rejects.toMatchObject({ code: "forbidden" });

    await team.addMember(admin.userId, {
      workspaceId: "main",
      userId: "member",
      role: "owner",
    });
    expect(team.members("main")).toMatchObject([
      { userId: "member", memberRole: "owner" },
    ]);
    await team.removeMember(admin.userId, {
      workspaceId: "main",
      userId: "member",
    });
    expect(team.members("main")).toEqual([]);
    expect(
      team.audit({ workspaceId: "main" }).map((event) => event.action),
    ).toEqual(["member_remove", "member_add"]);
    await expect(
      team.updateUser(admin.userId, "admin", { role: "member" }),
    ).rejects.toMatchObject({ code: "conflict" });
    expect(current.users.get("admin")?.role).toBe("admin");
  });

  it("registers a flat service, command, tool, and HTTP routes", async () => {
    const plugin = await setupPlugin();
    expect(plugin.provided).toHaveLength(1);
    expect(plugin.provided[0]).toBeInstanceOf(TeamService);
    expect(plugin.commands).toHaveLength(1);
    expect(plugin.tools).toHaveLength(1);
    expect(plugin.routes.map((item) => item.path)).toContain(
      "/api/collab/auth/login",
    );
    expect(new Set(plugin.routes.map((item) => item.path)).size).toBe(
      plugin.routes.length,
    );

    const tool = plugin.tools[0] as {
      output: { schema: unknown; render(): unknown };
      execute(
        args: Record<string, never>,
        exec: { signal: AbortSignal },
      ): Promise<string>;
    };
    expect(tool.output.schema).toEqual({ type: "string" });
    await expect(
      tool.execute({}, { signal: new AbortController().signal }),
    ).resolves.toContain("identity not initialized");

    plugin.disposers.forEach((dispose) => dispose());
  });

  it("protects browser routes with origin, bearer, and admin checks", async () => {
    const currentTables = tables();
    const team = new TeamService(currentTables, {
      sessionTtlMs: 1000,
      randomToken: (() => {
        let sequence = 0;
        return () => `${String(++sequence).padStart(20, "0")}-fixed-token`;
      })(),
    });
    const routes = createIdentityRoutes(team);
    const bootstrap = route(routes, "/api/collab/auth/bootstrap");
    const me = route(routes, "/api/collab/auth/me");
    const users = route(routes, "/api/collab/team/users");

    const crossOrigin = await call(
      bootstrap,
      fakeRequest("POST", "/api/collab/auth/bootstrap", {
        body: { userId: "admin", name: "Admin", password: "password-123" },
        origin: "https://evil.example",
      }),
    );
    expect(crossOrigin.status).toBe(403);
    expect(currentTables.users.size).toBe(0);

    const badToken = await call(
      me,
      fakeRequest("GET", "/api/collab/auth/me", {
        authorization: "Bearer wrong",
      }),
    );
    expect(badToken.status).toBe(401);

    const created = await call(
      bootstrap,
      fakeRequest("POST", "/api/collab/auth/bootstrap", {
        body: { userId: "admin", name: "Admin", password: "password-123" },
      }),
    );
    expect(created.status).toBe(201);
    const token = (created.json() as { token: string }).token;

    const member = await team.registerUser("admin", {
      userId: "member",
      name: "Member",
      password: "password-456",
      role: "member",
    });
    const memberSession = await team.login({
      userId: member.id,
      password: "password-456",
    });
    const memberResponse = await call(
      users,
      fakeRequest("GET", "/api/collab/team/users", {
        authorization: `Bearer ${memberSession.token}`,
      }),
    );
    expect(memberResponse.status).toBe(403);

    const adminResponse = await call(
      users,
      fakeRequest("GET", "/api/collab/team/users", {
        authorization: `Bearer ${token}`,
      }),
    );
    expect(adminResponse.status).toBe(200);
    expect((adminResponse.json() as { users: unknown[] }).users).toHaveLength(
      2,
    );
  });

  it("does not expose passwords or raw token hashes in audit records", async () => {
    const { tables: current, service: team } = service();
    await team.bootstrap({
      userId: "admin",
      name: "Admin",
      password: "secret-password",
    });
    await expect(
      team.login({ userId: "admin", password: "wrong" }),
    ).rejects.toMatchObject({ code: "unauthorized" });
    const serialized = JSON.stringify(
      [...current.audit.entries()].map(([, event]) => event),
    );
    expect(serialized).not.toContain("secret-password");
    expect(serialized).not.toContain("token-");
  });
});
