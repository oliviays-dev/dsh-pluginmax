import {
  createHash,
  randomBytes,
  scryptSync,
  timingSafeEqual,
} from "node:crypto";
import type { IncomingMessage, ServerResponse } from "node:http";
import { z } from "zod";
import { readJsonBody, sameOrigin, sendJson } from "@pluginmax/shared";

export const name = "dsh-collab-identity";
export const inject = ["storageDomain", "commands", "tools", "webServer"];

export const USER_ROLES = ["admin", "owner", "member", "guest"] as const;
export const MEMBER_ROLES = ["owner", "member", "guest"] as const;
export type UserRole = (typeof USER_ROLES)[number];
export type MemberRole = (typeof MEMBER_ROLES)[number];
export type Role = UserRole | MemberRole;

const SCRYPT_PARAMETERS = {
  cost: 16384,
  blockSize: 8,
  parallelization: 1,
  keyLength: 64,
} as const;

const idSchema = z
  .string()
  .trim()
  .min(1)
  .max(64)
  .regex(/^[a-zA-Z0-9][a-zA-Z0-9._-]*$/);
const nameSchema = z.string().trim().min(1).max(80);
const passwordSchema = z.string().min(8).max(256);
const isoTimeSchema = z.string().datetime({ precision: 3 });

const userRoleSchema = z.enum(USER_ROLES);
const memberRoleSchema = z.enum(MEMBER_ROLES);
const userRecordSchema = z.object({
  id: idSchema,
  name: nameSchema,
  role: userRoleSchema,
  passwordHash: z.string().min(1),
  createdAt: isoTimeSchema,
  updatedAt: isoTimeSchema,
});
const memberRecordSchema = z.object({
  workspaceId: idSchema,
  members: z.array(
    z.object({
      userId: idSchema,
      role: memberRoleSchema,
      addedAt: isoTimeSchema,
      addedBy: idSchema,
    }),
  ),
  updatedAt: isoTimeSchema,
});
const sessionRecordSchema = z.object({
  tokenHash: z.string().regex(/^[a-f0-9]{64}$/),
  userId: idSchema,
  createdAt: isoTimeSchema,
  expiresAt: isoTimeSchema,
});
const auditRecordSchema = z.object({
  id: z.string().min(1),
  at: isoTimeSchema,
  actorId: idSchema,
  actorRole: userRoleSchema,
  action: z
    .enum([
      "bootstrap",
      "register_user",
      "update_user",
      "login",
      "login_failed",
      "logout",
      "change_password",
      "member_add",
      "member_remove",
    ])
    .or(z.string().regex(/^[a-z0-9_.:-]{1,64}$/)),
  targetId: idSchema.optional(),
  workspaceId: idSchema.optional(),
  detail: z.record(z.string(), z.string().max(200)).default({}),
});

export type UserRecord = z.infer<typeof userRecordSchema>;
export type MemberRecord = z.infer<typeof memberRecordSchema>;
export type SessionRecord = z.infer<typeof sessionRecordSchema>;
export type AuditRecord = z.infer<typeof auditRecordSchema>;

export interface PublicUser {
  readonly id: string;
  readonly name: string;
  readonly role: UserRole;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface PublicMember {
  readonly userId: string;
  readonly name: string;
  readonly userRole: UserRole;
  readonly memberRole: MemberRole;
  readonly addedAt: string;
  readonly addedBy: string;
}

export interface Principal {
  readonly userId: string;
  readonly role: UserRole;
}

export interface LoginResult extends Principal {
  readonly token: string;
  readonly expiresAt: string;
}

export interface AuditFilter {
  readonly actorId?: string;
  readonly action?: string;
  readonly workspaceId?: string;
  readonly limit?: number;
}

export class IdentityError extends Error {
  constructor(
    readonly code:
      "invalid_input" | "unauthorized" | "forbidden" | "not_found" | "conflict",
    message: string,
  ) {
    super(message);
    this.name = "IdentityError";
  }
}

interface SchemaLike<V> {
  safeParse(value: unknown): { success: boolean; data?: V };
}

interface DomainSpecLike {
  readonly name: string;
  readonly version: number;
  readonly tables: Record<
    string,
    { readonly valueSchema: SchemaLike<unknown> }
  >;
}

interface KvTableLike<V> {
  get(key: string): V | undefined;
  entries(): IterableIterator<[string, V]>;
  keys(): IterableIterator<string>;
  values(): IterableIterator<V>;
  readonly size: number;
  put(key: string, value: V): Promise<void>;
  delete(key: string): Promise<boolean>;
}

export interface DomainLike {
  table(name: "users"): KvTableLike<UserRecord>;
  table(name: "workspace_members"): KvTableLike<MemberRecord>;
  table(name: "auth_sessions"): KvTableLike<SessionRecord>;
  table(name: "audit_log"): KvTableLike<AuditRecord>;
  close(): Promise<void>;
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

export interface IdentityContext {
  effect(register: () => () => void): void;
  provide(key: "collabTeam", value: TeamService): unknown;
  commands: {
    register(definition: {
      name: string;
      description: string;
      input: { hint: string; attachments: boolean };
      handler(invocation: { readonly rawInput: string }): CommandResultLike;
    }): unknown;
  };
  tools: {
    register(definition: {
      name: string;
      description: string;
      parameters: Record<string, unknown>;
      output: ToolOutputLike;
      execute(
        args: Record<string, never>,
        exec: { readonly signal: AbortSignal },
      ): Promise<string>;
    }): unknown;
  };
  webServer: { register(route: WebRouteLike): unknown };
  storageDomain: { open(spec: DomainSpecLike): Promise<DomainLike> };
}

export const teamDomainSpec: DomainSpecLike = {
  name: "collab_team",
  version: 1,
  tables: {
    users: { valueSchema: userRecordSchema as unknown as SchemaLike<unknown> },
    workspace_members: {
      valueSchema: memberRecordSchema as unknown as SchemaLike<unknown>,
    },
    auth_sessions: {
      valueSchema: sessionRecordSchema as unknown as SchemaLike<unknown>,
    },
    audit_log: {
      valueSchema: auditRecordSchema as unknown as SchemaLike<unknown>,
    },
  },
};

interface TeamTables {
  readonly users: KvTableLike<UserRecord>;
  readonly members: KvTableLike<MemberRecord>;
  readonly sessions: KvTableLike<SessionRecord>;
  readonly audit: KvTableLike<AuditRecord>;
}

export function hashPassword(password: string): string {
  const salt = randomBytes(16);
  const derived = scryptSync(password, salt, SCRYPT_PARAMETERS.keyLength, {
    N: SCRYPT_PARAMETERS.cost,
    r: SCRYPT_PARAMETERS.blockSize,
    p: SCRYPT_PARAMETERS.parallelization,
  });
  return [
    "scrypt",
    SCRYPT_PARAMETERS.cost,
    SCRYPT_PARAMETERS.blockSize,
    SCRYPT_PARAMETERS.parallelization,
    salt.toString("base64url"),
    derived.toString("base64url"),
  ].join("$");
}

export function verifyPassword(password: string, stored: string): boolean {
  const [scheme, rawCost, rawBlockSize, rawParallelization, rawSalt, rawHash] =
    stored.split("$");
  if (
    scheme !== "scrypt" ||
    rawCost === undefined ||
    rawBlockSize === undefined ||
    rawParallelization === undefined ||
    rawSalt === undefined ||
    rawHash === undefined
  ) {
    return false;
  }
  const cost = Number(rawCost);
  const blockSize = Number(rawBlockSize);
  const parallelization = Number(rawParallelization);
  if (
    !Number.isSafeInteger(cost) ||
    !Number.isSafeInteger(blockSize) ||
    !Number.isSafeInteger(parallelization) ||
    cost < 16384 ||
    cost > 2 ** 20 ||
    blockSize < 1 ||
    parallelization < 1 ||
    parallelization > 16
  ) {
    return false;
  }
  try {
    const expected = Buffer.from(rawHash, "base64url");
    const actual = scryptSync(
      password,
      Buffer.from(rawSalt, "base64url"),
      expected.length,
      {
        N: cost,
        r: blockSize,
        p: parallelization,
      },
    );
    return (
      expected.length === actual.length &&
      timingSafeEqual(new Uint8Array(expected), new Uint8Array(actual))
    );
  } catch {
    return false;
  }
}

function tokenFingerprint(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function parseOrInvalid<T>(
  schema: { safeParse(value: unknown): { success: boolean; data?: T } },
  value: unknown,
): T {
  const result = schema.safeParse(value);
  if (!result.success || result.data === undefined) {
    throw new IdentityError("invalid_input", "request input is invalid");
  }
  return result.data;
}

function publicUser(user: UserRecord): PublicUser {
  return {
    id: user.id,
    name: user.name,
    role: user.role,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

export interface TeamServiceOptions {
  readonly sessionTtlMs?: number;
  readonly now?: () => Date;
  readonly randomToken?: () => string;
}

export class TeamService {
  private readonly sessionTtlMs: number;
  private readonly now: () => Date;
  private readonly randomToken: () => string;
  private chain: Promise<void> = Promise.resolve();
  private auditSequence = 0;

  constructor(
    private readonly tables: TeamTables,
    options: TeamServiceOptions = {},
  ) {
    this.sessionTtlMs = options.sessionTtlMs ?? 30 * 24 * 60 * 60 * 1000;
    this.now = options.now ?? (() => new Date());
    this.randomToken =
      options.randomToken ?? (() => randomBytes(32).toString("base64url"));
  }

  private enqueue<T>(operation: () => Promise<T>): Promise<T> {
    const result = this.chain.then(operation);
    this.chain = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  }

  private time(): string {
    return this.now().toISOString();
  }

  private requireUser(id: string): UserRecord {
    const user = this.tables.users.get(id);
    if (user === undefined) {
      throw new IdentityError("not_found", `unknown user: ${id}`);
    }
    return user;
  }

  private requireAdmin(actorId: string): UserRecord {
    const actor = this.requireUser(actorId);
    if (actor.role !== "admin") {
      throw new IdentityError("forbidden", "admin role is required");
    }
    return actor;
  }

  private async appendAudit(
    actor: UserRecord,
    action: AuditRecord["action"],
    fields: {
      targetId?: string;
      workspaceId?: string;
      detail?: Record<string, string>;
    } = {},
  ): Promise<void> {
    const at = this.time();
    const sequence = String(++this.auditSequence).padStart(6, "0");
    await this.tables.audit.put(`${at}:${sequence}`, {
      id: `${at}:${sequence}`,
      at,
      actorId: actor.id,
      actorRole: actor.role,
      action,
      ...(fields.targetId === undefined ? {} : { targetId: fields.targetId }),
      ...(fields.workspaceId === undefined
        ? {}
        : { workspaceId: fields.workspaceId }),
      detail: fields.detail ?? {},
    });
  }

  private createUserRecord(
    input: z.infer<typeof userCreateSchema>,
    role: UserRole,
  ): UserRecord {
    const at = this.time();
    return {
      id: input.userId,
      name: input.name,
      role,
      passwordHash: hashPassword(input.password),
      createdAt: at,
      updatedAt: at,
    };
  }

  private async issueSession(user: UserRecord): Promise<LoginResult> {
    const token = this.randomToken();
    const now = this.now();
    await this.tables.sessions.put(tokenFingerprint(token), {
      tokenHash: tokenFingerprint(token),
      userId: user.id,
      createdAt: now.toISOString(),
      expiresAt: new Date(now.getTime() + this.sessionTtlMs).toISOString(),
    });
    return {
      token,
      userId: user.id,
      role: user.role,
      expiresAt: new Date(now.getTime() + this.sessionTtlMs).toISOString(),
    };
  }

  private adminCount(): number {
    return [...this.tables.users.values()].filter(
      (user) => user.role === "admin",
    ).length;
  }

  bootstrap(input: {
    userId: string;
    name: string;
    password: string;
  }): Promise<LoginResult> {
    const parsed = parseOrInvalid(userCreateSchema, input);
    return this.enqueue(async () => {
      if (this.tables.users.size > 0) {
        throw new IdentityError("conflict", "identity is already initialized");
      }
      const user = this.createUserRecord(parsed, "admin");
      await this.tables.users.put(user.id, user);
      const result = await this.issueSession(user);
      await this.appendAudit(user, "bootstrap", {
        targetId: user.id,
        detail: { firstAdmin: user.id },
      });
      return result;
    });
  }

  registerUser(
    actorId: string,
    input: {
      userId: string;
      name: string;
      password: string;
      role: UserRole;
    },
  ): Promise<PublicUser> {
    const actorInput = parseOrInvalid(idSchema, actorId);
    const parsed = parseOrInvalid(
      userCreateSchema.extend({
        role: userRoleSchema,
      }),
      input,
    );
    return this.enqueue(async () => {
      const actor = this.requireAdmin(actorInput);
      if (this.tables.users.get(parsed.userId) !== undefined) {
        throw new IdentityError("conflict", "user id already exists");
      }
      const user = this.createUserRecord(parsed, parsed.role);
      await this.tables.users.put(user.id, user);
      await this.appendAudit(actor, "register_user", {
        targetId: user.id,
        detail: { role: user.role },
      });
      return publicUser(user);
    });
  }

  updateUser(
    actorId: string,
    targetId: string,
    changes: { name?: string; role?: UserRole },
  ): Promise<PublicUser> {
    const parsedActor = parseOrInvalid(idSchema, actorId);
    const parsedTarget = parseOrInvalid(idSchema, targetId);
    const parsedChanges = parseOrInvalid(
      z.object({
        name: nameSchema.optional(),
        role: userRoleSchema.optional(),
      }),
      changes,
    );
    return this.enqueue(async () => {
      const actor = this.requireAdmin(parsedActor);
      const current = this.requireUser(parsedTarget);
      if (
        current.role === "admin" &&
        parsedChanges.role !== undefined &&
        parsedChanges.role !== "admin" &&
        this.adminCount() === 1
      ) {
        throw new IdentityError(
          "conflict",
          "the last admin role cannot be changed",
        );
      }
      const updated: UserRecord = {
        ...current,
        ...(parsedChanges.name === undefined
          ? {}
          : { name: parsedChanges.name }),
        ...(parsedChanges.role === undefined
          ? {}
          : { role: parsedChanges.role }),
        updatedAt: this.time(),
      };
      await this.tables.users.put(updated.id, updated);
      await this.appendAudit(actor, "update_user", {
        targetId: updated.id,
        detail: Object.fromEntries(
          Object.entries({
            ...(parsedChanges.name === undefined
              ? {}
              : { name: parsedChanges.name }),
            ...(parsedChanges.role === undefined
              ? {}
              : { role: parsedChanges.role }),
          }).map(([key, value]) => [key, String(value)] as const),
        ),
      });
      return publicUser(updated);
    });
  }

  login(input: { userId: string; password: string }): Promise<LoginResult> {
    const parsed = parseOrInvalid(userLoginSchema, input);
    return this.enqueue(async () => {
      const user = this.tables.users.get(parsed.userId);
      const anonymous: UserRecord = {
        id: parsed.userId,
        name: "unknown",
        role: "guest",
        passwordHash: "",
        createdAt: this.time(),
        updatedAt: this.time(),
      };
      if (
        user === undefined ||
        user.passwordHash === "" ||
        !verifyPassword(parsed.password, user.passwordHash)
      ) {
        await this.appendAudit(anonymous, "login_failed", {
          targetId: parsed.userId,
        });
        throw new IdentityError("unauthorized", "invalid user or password");
      }
      const result = await this.issueSession(user);
      await this.appendAudit(user, "login", { targetId: user.id });
      return result;
    });
  }

  resolveToken(token: string): Principal | undefined {
    if (token.length < 24 || token.length > 512) return undefined;
    const fingerprint = tokenFingerprint(token);
    const session = this.tables.sessions.get(fingerprint);
    if (session === undefined) return undefined;
    if (session.expiresAt <= this.time()) {
      void this.tables.sessions.delete(fingerprint);
      return undefined;
    }
    const user = this.tables.users.get(session.userId);
    if (user === undefined) return undefined;
    return { userId: user.id, role: user.role };
  }

  logout(token: string): Promise<boolean> {
    const parsedToken = parseOrInvalid(z.string().min(24).max(512), token);
    return this.enqueue(async () => {
      const fingerprint = tokenFingerprint(parsedToken);
      const session = this.tables.sessions.get(fingerprint);
      const deleted = await this.tables.sessions.delete(fingerprint);
      if (session !== undefined && deleted) {
        const user = this.tables.users.get(session.userId);
        if (user !== undefined) {
          await this.appendAudit(user, "logout", { targetId: user.id });
        }
      }
      return deleted;
    });
  }

  changePassword(input: {
    userId: string;
    currentPassword: string;
    newPassword: string;
    keepToken?: string;
  }): Promise<void> {
    const parsed = parseOrInvalid(changePasswordSchema, input);
    return this.enqueue(async () => {
      const user = this.requireUser(parsed.userId);
      if (
        user.passwordHash === "" ||
        !verifyPassword(parsed.currentPassword, user.passwordHash)
      ) {
        throw new IdentityError("unauthorized", "current password is invalid");
      }
      const updated: UserRecord = {
        ...user,
        passwordHash: hashPassword(parsed.newPassword),
        updatedAt: this.time(),
      };
      await this.tables.users.put(user.id, updated);
      const keepHash =
        parsed.keepToken === undefined
          ? undefined
          : tokenFingerprint(parsed.keepToken);
      await Promise.all(
        [...this.tables.sessions.entries()]
          .filter(
            ([hash, session]) =>
              session.userId === user.id && hash !== keepHash,
          )
          .map(([hash]) => this.tables.sessions.delete(hash)),
      );
      await this.appendAudit(user, "change_password", { targetId: user.id });
    });
  }

  getUser(id: string): PublicUser | undefined {
    const parsed = parseOrInvalid(idSchema, id);
    return this.tables.users.get(parsed) === undefined
      ? undefined
      : publicUser(this.tables.users.get(parsed) as UserRecord);
  }

  users(): readonly PublicUser[] {
    return [...this.tables.users.entries()]
      .map(([, user]) => publicUser(user))
      .sort((left, right) => left.id.localeCompare(right.id));
  }

  asAgent(agent: unknown): Principal | undefined {
    if (typeof agent !== "object" || agent === null) return undefined;
    const candidate = agent as { userId?: unknown; role?: unknown };
    if (candidate.userId === undefined) return undefined;
    const parsed = parseOrInvalid(idSchema, candidate.userId);
    const user = this.tables.users.get(parsed);
    if (user === undefined) return undefined;
    return { userId: user.id, role: user.role };
  }

  addMember(
    actorId: string,
    input: {
      workspaceId: string;
      userId: string;
      role: MemberRole;
    },
  ): Promise<readonly PublicMember[]> {
    const parsedActor = parseOrInvalid(idSchema, actorId);
    const parsed = parseOrInvalid(memberMutationSchema, input);
    return this.enqueue(async () => {
      const actor = this.requireAdmin(parsedActor);
      const user = this.requireUser(parsed.userId);
      const current = this.tables.members.get(parsed.workspaceId);
      const entry = {
        userId: user.id,
        role: parsed.role,
        addedAt: this.time(),
        addedBy: actor.id,
      };
      const record: MemberRecord =
        current === undefined
          ? {
              workspaceId: parsed.workspaceId,
              members: [entry],
              updatedAt: entry.addedAt,
            }
          : {
              ...current,
              members: [
                ...current.members.filter(
                  (member) => member.userId !== user.id,
                ),
                entry,
              ],
              updatedAt: entry.addedAt,
            };
      await this.tables.members.put(record.workspaceId, record);
      await this.appendAudit(actor, "member_add", {
        targetId: user.id,
        workspaceId: parsed.workspaceId,
        detail: { memberRole: parsed.role },
      });
      return this.members(parsed.workspaceId);
    });
  }

  removeMember(
    actorId: string,
    input: { workspaceId: string; userId: string },
  ): Promise<readonly PublicMember[]> {
    const parsedActor = parseOrInvalid(idSchema, actorId);
    const parsed = parseOrInvalid(
      z.object({ workspaceId: idSchema, userId: idSchema }),
      input,
    );
    return this.enqueue(async () => {
      const actor = this.requireAdmin(parsedActor);
      const current = this.tables.members.get(parsed.workspaceId);
      if (current !== undefined) {
        await this.tables.members.put(current.workspaceId, {
          ...current,
          members: current.members.filter(
            (member) => member.userId !== parsed.userId,
          ),
          updatedAt: this.time(),
        });
      }
      await this.appendAudit(actor, "member_remove", {
        targetId: parsed.userId,
        workspaceId: parsed.workspaceId,
      });
      return this.members(parsed.workspaceId);
    });
  }

  members(workspaceId: string): readonly PublicMember[] {
    const parsed = parseOrInvalid(idSchema, workspaceId);
    const record = this.tables.members.get(parsed);
    return record === undefined
      ? []
      : record.members.flatMap((member) => {
          const user = this.tables.users.get(member.userId);
          return user === undefined
            ? []
            : [
                {
                  userId: user.id,
                  name: user.name,
                  userRole: user.role,
                  memberRole: member.role,
                  addedAt: member.addedAt,
                  addedBy: member.addedBy,
                },
              ];
        });
  }

  audit(filter: AuditFilter = {}): readonly AuditRecord[] {
    const parsed = parseOrInvalid(auditFilterSchema, filter);
    return [...this.tables.audit.entries()]
      .filter(
        ([, event]) =>
          (parsed.actorId === undefined || event.actorId === parsed.actorId) &&
          (parsed.action === undefined || event.action === parsed.action) &&
          (parsed.workspaceId === undefined ||
            event.workspaceId === parsed.workspaceId),
      )
      .map(([, event]) => event)
      .sort((left, right) => right.id.localeCompare(left.id))
      .slice(0, parsed.limit ?? 100);
  }

  status(): { initialized: boolean; userCount: number; sessionCount: number } {
    return {
      initialized: this.tables.users.size > 0,
      userCount: this.tables.users.size,
      sessionCount: this.tables.sessions.size,
    };
  }
}

const userCreateSchema = z.object({
  userId: idSchema,
  name: nameSchema,
  password: passwordSchema,
});
const userLoginSchema = z.object({
  userId: idSchema,
  password: z.string().min(1).max(256),
});
const changePasswordSchema = z.object({
  userId: idSchema,
  currentPassword: z.string().min(1).max(256),
  newPassword: passwordSchema,
  keepToken: z.string().min(24).max(512).optional(),
});
const memberMutationSchema = z.object({
  workspaceId: idSchema,
  userId: idSchema,
  role: memberRoleSchema,
});
const memberRemoveSchema = z.object({
  workspaceId: idSchema,
  userId: idSchema,
});
const userUpdateSchema = z.object({
  userId: idSchema,
  name: nameSchema.optional(),
  role: userRoleSchema.optional(),
});
const auditFilterSchema = z.object({
  actorId: idSchema.optional(),
  action: z.string().min(1).max(64).optional(),
  workspaceId: idSchema.optional(),
  limit: z.coerce.number().int().min(1).max(500).optional(),
});

const identityToolOutput: ToolOutputLike = {
  schema: { type: "string" },
  render: (_args, value) => [{ type: "text", text: value }],
};

function requestHeader(
  request: IncomingMessage,
  key: string,
): string | undefined {
  const value = request.headers[key.toLowerCase()];
  if (Array.isArray(value)) return value[0];
  return value;
}

function assertSameOrigin(request: IncomingMessage): void {
  const origin = requestHeader(request, "origin");
  const host = requestHeader(request, "host");
  if (origin !== undefined && !sameOrigin(origin, host)) {
    throw new IdentityError("forbidden", "cross-origin request");
  }
  const fetchSite = requestHeader(request, "sec-fetch-site");
  if (
    fetchSite !== undefined &&
    fetchSite !== "same-origin" &&
    fetchSite !== "none"
  ) {
    throw new IdentityError("forbidden", "cross-site request");
  }
}

async function readBody<T>(
  request: IncomingMessage,
  schema: { safeParse(value: unknown): { success: boolean; data?: T } },
): Promise<T> {
  try {
    return parseOrInvalid(schema, await readJsonBody(request, 64 * 1024));
  } catch (error) {
    if (error instanceof IdentityError) throw error;
    throw new IdentityError("invalid_input", "request body is invalid");
  }
}

function requirePrincipal(
  request: IncomingMessage,
  service: TeamService,
): Principal & { token: string } {
  const authorization = requestHeader(request, "authorization");
  const token =
    authorization !== undefined && authorization.startsWith("Bearer ")
      ? authorization.slice("Bearer ".length).trim()
      : undefined;
  if (token === undefined) {
    throw new IdentityError("unauthorized", "bearer token is required");
  }
  const principal = service.resolveToken(token);
  if (principal === undefined) {
    throw new IdentityError("unauthorized", "invalid or expired token");
  }
  return { ...principal, token };
}

function requireAdmin(request: IncomingMessage, service: TeamService) {
  const principal = requirePrincipal(request, service);
  if (principal.role !== "admin") {
    throw new IdentityError("forbidden", "admin role is required");
  }
  return principal;
}

function query(request: IncomingMessage): URLSearchParams {
  const host = requestHeader(request, "host") ?? "localhost";
  return new URL(request.url ?? "/", `http://${host}`).searchParams;
}

function queryParam(params: URLSearchParams, key: string): string | undefined {
  const value = params.get(key);
  return value === null ? undefined : value;
}

function errorStatus(code: IdentityError["code"]): number {
  if (code === "unauthorized") return 401;
  if (code === "forbidden") return 403;
  if (code === "not_found") return 404;
  if (code === "conflict") return 409;
  return 400;
}

async function runHandler(
  handler: () => Promise<void> | void,
  response: ServerResponse,
): Promise<void> {
  try {
    await handler();
  } catch (error) {
    if (error instanceof IdentityError) {
      sendJson(response, errorStatus(error.code), {
        ok: false,
        error: { code: error.code, message: error.message },
      });
      return;
    }
    sendJson(response, 500, {
      ok: false,
      error: { code: "internal_error", message: "identity request failed" },
    });
  }
}

export function createIdentityRoutes(
  service: TeamService,
): readonly WebRouteLike[] {
  const routes: Array<{
    path: string;
    method: string;
    handler: (
      request: IncomingMessage,
      response: ServerResponse,
    ) => Promise<void> | void;
  }> = [
    {
      path: "/api/collab/auth/status",
      method: "GET",
      handler: (request, response) => {
        assertSameOrigin(request);
        sendJson(response, 200, { ok: true, ...service.status() });
      },
    },
    {
      path: "/api/collab/auth/bootstrap",
      method: "POST",
      handler: async (request, response) => {
        assertSameOrigin(request);
        const result = await service.bootstrap(
          await readBody(request, userCreateSchema),
        );
        sendJson(response, 201, {
          ok: true,
          token: result.token,
          expiresAt: result.expiresAt,
          user: service.getUser(result.userId),
        });
      },
    },
    {
      path: "/api/collab/auth/login",
      method: "POST",
      handler: async (request, response) => {
        assertSameOrigin(request);
        const result = await service.login(
          await readBody(request, userLoginSchema),
        );
        sendJson(response, 200, {
          ok: true,
          token: result.token,
          expiresAt: result.expiresAt,
          user: service.getUser(result.userId),
        });
      },
    },
    {
      path: "/api/collab/auth/logout",
      method: "POST",
      handler: async (request, response) => {
        assertSameOrigin(request);
        const principal = requirePrincipal(request, service);
        const loggedOut = await service.logout(principal.token);
        sendJson(response, 200, { ok: true, loggedOut });
      },
    },
    {
      path: "/api/collab/auth/me",
      method: "GET",
      handler: (request, response) => {
        assertSameOrigin(request);
        const principal = requirePrincipal(request, service);
        sendJson(response, 200, {
          ok: true,
          user: service.getUser(principal.userId),
        });
      },
    },
    {
      path: "/api/collab/auth/change-password",
      method: "POST",
      handler: async (request, response) => {
        assertSameOrigin(request);
        const principal = requirePrincipal(request, service);
        const input = await readBody(
          request,
          z.object({
            currentPassword: z.string().min(1).max(256),
            newPassword: passwordSchema,
          }),
        );
        await service.changePassword({
          ...input,
          userId: principal.userId,
          keepToken: principal.token,
        });
        sendJson(response, 200, { ok: true });
      },
    },
    {
      path: "/api/collab/team/users",
      method: "GET",
      handler: (request, response) => {
        assertSameOrigin(request);
        requireAdmin(request, service);
        sendJson(response, 200, { ok: true, users: service.users() });
      },
    },
    {
      path: "/api/collab/team/users/create",
      method: "POST",
      handler: async (request, response) => {
        assertSameOrigin(request);
        const actor = requireAdmin(request, service);
        const user = await service.registerUser(
          actor.userId,
          await readBody(
            request,
            userCreateSchema.extend({ role: userRoleSchema }),
          ),
        );
        sendJson(response, 201, { ok: true, user });
      },
    },
    {
      path: "/api/collab/team/users/update",
      method: "POST",
      handler: async (request, response) => {
        assertSameOrigin(request);
        const actor = requireAdmin(request, service);
        const input = await readBody(request, userUpdateSchema);
        const user = await service.updateUser(actor.userId, input.userId, {
          ...(input.name === undefined ? {} : { name: input.name }),
          ...(input.role === undefined ? {} : { role: input.role }),
        });
        sendJson(response, 200, { ok: true, user });
      },
    },
    {
      path: "/api/collab/team/members",
      method: "GET",
      handler: (request, response) => {
        assertSameOrigin(request);
        requireAdmin(request, service);
        const workspaceId = query(request).get("workspaceId") ?? "";
        sendJson(response, 200, {
          ok: true,
          members: service.members(workspaceId),
        });
      },
    },
    {
      path: "/api/collab/team/members/set",
      method: "PUT",
      handler: async (request, response) => {
        assertSameOrigin(request);
        const actor = requireAdmin(request, service);
        const members = await service.addMember(
          actor.userId,
          await readBody(request, memberMutationSchema),
        );
        sendJson(response, 200, { ok: true, members });
      },
    },
    {
      path: "/api/collab/team/members/remove",
      method: "POST",
      handler: async (request, response) => {
        assertSameOrigin(request);
        const actor = requireAdmin(request, service);
        const members = await service.removeMember(
          actor.userId,
          await readBody(request, memberRemoveSchema),
        );
        sendJson(response, 200, { ok: true, members });
      },
    },
    {
      path: "/api/collab/team/audit",
      method: "GET",
      handler: (request, response) => {
        assertSameOrigin(request);
        requireAdmin(request, service);
        const params = query(request);
        const limit = params.get("limit");
        const actorId = queryParam(params, "actorId");
        const action = queryParam(params, "action");
        const workspaceId = queryParam(params, "workspaceId");
        const parsedLimit = limit === null ? undefined : Number(limit);
        const events = service.audit({
          ...(actorId === undefined ? {} : { actorId }),
          ...(action === undefined ? {} : { action }),
          ...(workspaceId === undefined ? {} : { workspaceId }),
          ...(parsedLimit === undefined ? {} : { limit: parsedLimit }),
        });
        sendJson(response, 200, { ok: true, events });
      },
    },
  ];

  return routes.map((route) => ({
    kind: "exact" as const,
    path: route.path,
    handler: (request, response) =>
      runHandler(async () => {
        if (request.method !== route.method) {
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

function agentStatus(service: TeamService): string {
  const status = service.status();
  return status.initialized
    ? `identity ready: ${status.userCount} user(s), ${status.sessionCount} active session(s)`
    : "identity not initialized";
}

export async function apply(
  ctx: IdentityContext,
): Promise<void | (() => void)> {
  const domain = await ctx.storageDomain.open(teamDomainSpec);
  const service = new TeamService({
    users: domain.table("users"),
    members: domain.table("workspace_members"),
    sessions: domain.table("auth_sessions"),
    audit: domain.table("audit_log"),
  });
  ctx.provide("collabTeam", service);
  ctx.effect(() => () => void domain.close());

  ctx.commands.register({
    name: "identity",
    description: "show DSH Pluginmax identity status",
    input: { hint: "[status|users]", attachments: false },
    handler: (invocation) => {
      const input = invocation.rawInput.trim();
      if (input === "" || input === "status") {
        return { kind: "success", text: agentStatus(service) };
      }
      if (input === "users") {
        const users = service
          .users()
          .map((user) => `${user.id}\t${user.name}\t${user.role}`)
          .join("\n");
        return {
          kind: "success",
          text: users === "" ? "no users" : users,
        };
      }
      return { kind: "error", text: "usage: /identity [status|users]" };
    },
  });

  ctx.tools.register({
    name: "collab_identity",
    description: "Return sanitized DSH Pluginmax identity status.",
    parameters: {
      type: "object",
      properties: {},
      additionalProperties: false,
    },
    output: identityToolOutput,
    execute: async (_args, exec) => {
      exec.signal.throwIfAborted();
      return agentStatus(service);
    },
  });

  const disposers = createIdentityRoutes(service).map((route) =>
    ctx.webServer.register(route),
  ) as Array<() => void>;
  return () => {
    for (const dispose of disposers) dispose();
  };
}
