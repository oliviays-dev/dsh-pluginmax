import { randomUUID } from "node:crypto";
import {
  mkdir,
  readFile,
  readdir,
  rename,
  rm,
  writeFile,
} from "node:fs/promises";
import type { IncomingMessage, ServerResponse } from "node:http";
import { dirname, isAbsolute, join } from "node:path";
import process from "node:process";
import { z } from "zod";
import {
  bearerToken,
  readJsonBody,
  resolveWithin,
  sameOrigin,
  sendJson,
} from "@pluginmax/shared";

export const name = "dsh-collab-roles";
export const inject = ["storageDomain", "commands", "tools", "webServer"];

export const PARTICIPANT_KINDS = ["human", "agent", "any"] as const;
export const ROLE_PERMISSIONS = [
  "read",
  "write",
  "approve",
  "manage_members",
  "manage_roles",
] as const;

export type ParticipantKind = (typeof PARTICIPANT_KINDS)[number];
export type RolePermission = (typeof ROLE_PERMISSIONS)[number];

const idSchema = z
  .string()
  .trim()
  .min(1)
  .max(64)
  .regex(/^[a-zA-Z0-9][a-zA-Z0-9._-]*$/);
const nameSchema = z.string().trim().min(1).max(80);
const descriptionSchema = z.string().trim().max(2000).default("");
const isoTimeSchema = z.string().datetime({ precision: 3 });
const permissionSchema = z.array(z.enum(ROLE_PERMISSIONS)).min(1).max(5);

const personaSchema = z.object({
  id: idSchema,
  name: nameSchema,
  description: descriptionSchema,
  tags: z.array(z.string().trim().min(1).max(32)).max(16).default([]),
  createdAt: isoTimeSchema,
  updatedAt: isoTimeSchema,
});

const seatSchema = z.object({
  id: idSchema,
  label: nameSchema,
  participantKind: z.enum(PARTICIPANT_KINDS),
  personaId: idSchema.optional(),
  permissions: permissionSchema,
});

const workspaceTypeSchema = z.object({
  id: idSchema,
  name: nameSchema,
  description: descriptionSchema,
  seats: z.array(seatSchema).min(1).max(32),
  createdAt: isoTimeSchema,
  updatedAt: isoTimeSchema,
});

const workspaceConfigSchema = z.object({
  workspaceId: idSchema,
  typeId: idSchema,
  typeName: nameSchema,
  seats: z.array(seatSchema).min(1).max(32),
  materializedAt: isoTimeSchema,
  materializedBy: idSchema,
});

const assignmentSchema = z.object({
  id: z.string().min(1).max(160),
  workspaceId: idSchema,
  seatId: idSchema,
  seatLabel: nameSchema,
  participantKind: z.enum(["human", "agent"]),
  assigneeKind: z.enum(["user", "agent"]),
  assigneeId: idSchema,
  sessionId: idSchema.optional(),
  personaId: idSchema.optional(),
  permissions: permissionSchema,
  leader: z.boolean(),
  status: z.enum(["claimed", "assigned", "released"]),
  claimedAt: isoTimeSchema.optional(),
  claimedBy: idSchema.optional(),
  updatedAt: isoTimeSchema,
});

const actorSchema = z.object({
  kind: z.enum(["user", "agent"]),
  id: idSchema,
  sessionId: idSchema.optional(),
  globalRole: z.enum(["admin", "owner", "member", "guest"]).optional(),
  workspaceRole: z.enum(["owner", "member", "guest"]).optional(),
});

export type Persona = z.infer<typeof personaSchema>;
export type RoleSeat = z.infer<typeof seatSchema>;
export type WorkspaceType = z.infer<typeof workspaceTypeSchema>;
export type WorkspaceRoleConfig = z.infer<typeof workspaceConfigSchema>;
export type Assignment = z.infer<typeof assignmentSchema>;
export type RoleActor = z.infer<typeof actorSchema>;

export class RolesError extends Error {
  constructor(
    readonly code:
      "invalid_input" | "unauthorized" | "forbidden" | "not_found" | "conflict",
    message: string,
  ) {
    super(message);
    this.name = "RolesError";
  }
}

interface SchemaLike<V> {
  safeParse(value: unknown): { success: boolean; data?: V };
}

interface KvTableLike<V> {
  get(key: string): V | undefined;
  entries(): IterableIterator<[string, V]>;
  keys(): IterableIterator<string>;
  readonly size: number;
  put(key: string, value: V): Promise<void>;
  delete(key: string): Promise<boolean>;
}

interface DomainSpecLike {
  readonly name: string;
  readonly version: number;
  readonly tables: Record<
    string,
    { readonly valueSchema: SchemaLike<unknown> }
  >;
}

export interface AssignmentDomainLike {
  table(name: "workspaces"): KvTableLike<WorkspaceRoleConfig>;
  table(name: "assignments"): KvTableLike<Assignment>;
  close(): Promise<void>;
}

function parseOrInvalid<V>(schema: SchemaLike<V>, value: unknown): V {
  const result = schema.safeParse(value);
  if (!result.success) {
    throw new RolesError("invalid_input", "invalid role payload");
  }
  return result.data as V;
}

function tableValues<V>(table: KvTableLike<V>): V[] {
  return Array.from(table.entries(), ([, value]) => value);
}

function nowIso(now: () => Date): string {
  return now().toISOString();
}

async function atomicWrite(path: string, content: string): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  const temporary = `${path}.${randomUUID()}.tmp`;
  await writeFile(temporary, content, "utf8");
  await rename(temporary, path);
}

async function readJsonFile(path: string): Promise<unknown> {
  try {
    return JSON.parse(await readFile(path, "utf8")) as unknown;
  } catch {
    throw new RolesError("not_found", "role asset is unreadable");
  }
}

function safeId(id: string): string {
  return parseOrInvalid(idSchema, id);
}

export class PersonaService {
  constructor(
    private readonly root: string,
    private readonly options: { readonly now: () => Date } = {
      now: () => new Date(),
    },
  ) {}

  async list(): Promise<Persona[]> {
    await mkdir(this.root, { recursive: true });
    const entries = await readdir(this.root, { withFileTypes: true });
    const personas: Persona[] = [];
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const persona = parseOrInvalid(
        personaSchema,
        await readJsonFile(
          resolveWithin(this.root, join(entry.name, "persona.json")),
        ),
      );
      personas.push(persona);
    }
    return personas.sort((left, right) => left.id.localeCompare(right.id));
  }

  async get(id: string): Promise<Persona & { readonly soul: string }> {
    const safe = safeId(id);
    const base = resolveWithin(this.root, safe);
    const persona = parseOrInvalid(
      personaSchema,
      await readJsonFile(join(base, "persona.json")),
    );
    try {
      return {
        ...persona,
        soul: await readFile(join(base, "SOUL.md"), "utf8"),
      };
    } catch {
      throw new RolesError("not_found", "persona SOUL is unreadable");
    }
  }

  async create(input: {
    readonly id: string;
    readonly name: string;
    readonly description?: string;
    readonly tags?: string[];
    readonly soul?: string;
  }): Promise<Persona & { readonly soul: string }> {
    const timestamp = nowIso(this.options.now);
    const parsed = parseOrInvalid(personaSchema, {
      description: "",
      tags: [],
      ...input,
      createdAt: timestamp,
      updatedAt: timestamp,
    });
    const soul = parseOrInvalid(z.string().max(200_000), input.soul ?? "");
    const base = resolveWithin(this.root, parsed.id);
    await mkdir(base, { recursive: true });
    await atomicWrite(
      join(base, "persona.json"),
      `${JSON.stringify(parsed, null, 2)}\n`,
    );
    await atomicWrite(join(base, "SOUL.md"), soul);
    return { ...parsed, soul };
  }

  async updateSoul(id: string, soul: string): Promise<string> {
    await this.get(id);
    const parsed = parseOrInvalid(z.string().max(200_000), soul);
    await atomicWrite(
      join(resolveWithin(this.root, safeId(id)), "SOUL.md"),
      parsed,
    );
    return parsed;
  }

  async preset(id: string, context = ""): Promise<string> {
    const persona = await this.get(id);
    const parsedContext = parseOrInvalid(z.string().max(4000), context);
    return [
      `# ${persona.name} SOUL`,
      persona.description === ""
        ? ""
        : `## Description\n${persona.description}`,
      `## Identity\n- Persona ID: ${persona.id}`,
      persona.tags.length === 0 ? "" : `- Tags: ${persona.tags.join(", ")}`,
      parsedContext === "" ? "" : `## Runtime context\n${parsedContext}`,
      "## Operating rules\n- Execute only the permissions granted by the current role seat.\n- Record decisions through Pluginmax collaboration tools.\n- Ask a human when required authority is missing.",
      "```markdown",
      persona.soul,
      "```",
    ]
      .filter((part) => part !== "")
      .join("\n\n");
  }
}

export class WorkspaceTypeService {
  constructor(
    private readonly root: string,
    private readonly options: { readonly now: () => Date } = {
      now: () => new Date(),
    },
  ) {}

  async list(): Promise<WorkspaceType[]> {
    await mkdir(this.root, { recursive: true });
    const entries = await readdir(this.root, { withFileTypes: true });
    const types: WorkspaceType[] = [];
    for (const entry of entries) {
      if (!entry.isFile() || !entry.name.endsWith(".json")) continue;
      types.push(
        parseOrInvalid(
          workspaceTypeSchema,
          await readJsonFile(resolveWithin(this.root, entry.name)),
        ),
      );
    }
    return types.sort((left, right) => left.id.localeCompare(right.id));
  }

  async get(id: string): Promise<WorkspaceType> {
    return parseOrInvalid(
      workspaceTypeSchema,
      await readJsonFile(resolveWithin(this.root, `${safeId(id)}.json`)),
    );
  }

  async create(
    input: z.input<typeof workspaceTypeSchema>,
  ): Promise<WorkspaceType> {
    const parsed = parseOrInvalid(workspaceTypeSchema, input);
    const seatIds = new Set(parsed.seats.map((seat) => seat.id));
    if (seatIds.size !== parsed.seats.length) {
      throw new RolesError("invalid_input", "seat ids must be unique");
    }
    const path = resolveWithin(this.root, `${parsed.id}.json`);
    await atomicWrite(path, `${JSON.stringify(parsed, null, 2)}\n`);
    return parsed;
  }

  async remove(id: string): Promise<void> {
    await this.get(id);
    await rm(resolveWithin(this.root, `${safeId(id)}.json`), { force: true });
  }
}

function isManager(actor: RoleActor): boolean {
  return (
    actor.kind === "user" &&
    (actor.globalRole === "admin" || actor.workspaceRole === "owner")
  );
}

function assignmentKey(workspaceId: string, seatId: string): string {
  return `${workspaceId}:${seatId}`;
}

export class AssignmentService {
  constructor(
    private readonly tables: {
      readonly workspaces: KvTableLike<WorkspaceRoleConfig>;
      readonly assignments: KvTableLike<Assignment>;
    },
    private readonly options: { readonly now: () => Date } = {
      now: () => new Date(),
    },
  ) {}

  config(workspaceId: string): WorkspaceRoleConfig {
    const config = this.tables.workspaces.get(safeId(workspaceId));
    if (config === undefined) {
      throw new RolesError("not_found", "workspace roles are not materialized");
    }
    return config;
  }

  async materialize(
    actor: RoleActor,
    workspaceId: string,
    type: WorkspaceType,
  ): Promise<WorkspaceRoleConfig> {
    if (!isManager(actor)) {
      throw new RolesError("forbidden", "workspace owner role is required");
    }
    const seatIds = new Set(type.seats.map((seat) => seat.id));
    if (seatIds.size !== type.seats.length) {
      throw new RolesError("invalid_input", "seat ids must be unique");
    }
    const timestamp = nowIso(this.options.now);
    const config = {
      workspaceId,
      typeId: type.id,
      typeName: type.name,
      seats: type.seats,
      materializedAt: timestamp,
      materializedBy: actor.id,
    };
    await this.tables.workspaces.put(workspaceId, config);
    for (const key of this.tables.assignments.keys()) {
      const assignment = this.tables.assignments.get(key);
      if (assignment?.workspaceId !== workspaceId) continue;
      if (!seatIds.has(assignment.seatId))
        await this.tables.assignments.delete(key);
    }
    return config;
  }

  seats(workspaceId: string): Assignment[] {
    this.config(workspaceId);
    return tableValues(this.tables.assignments)
      .filter((assignment) => assignment.workspaceId === workspaceId)
      .sort((left, right) => left.seatId.localeCompare(right.seatId));
  }

  async claim(
    actor: RoleActor,
    workspaceId: string,
    seatId: string,
    personaId?: string,
  ): Promise<Assignment> {
    const config = this.config(workspaceId);
    const seat = config.seats.find((candidate) => candidate.id === seatId);
    if (seat === undefined)
      throw new RolesError("not_found", "role seat not found");
    if (
      seat.participantKind !== "any" &&
      seat.participantKind !== (actor.kind === "user" ? "human" : "agent")
    ) {
      throw new RolesError(
        "invalid_input",
        "participant kind does not match seat",
      );
    }
    const key = assignmentKey(workspaceId, seatId);
    const existing = this.tables.assignments.get(key);
    if (existing !== undefined && existing.status !== "released") {
      const same =
        existing.assigneeKind === (actor.kind === "user" ? "user" : "agent") &&
        existing.assigneeId === actor.id &&
        (actor.kind === "agent"
          ? existing.sessionId === (actor.sessionId ?? actor.id)
          : existing.sessionId === undefined);
      if (!same)
        throw new RolesError("conflict", "role seat is already occupied");
      return existing;
    }
    const leader = this.seats(workspaceId).every(
      (assignment) => assignment.status === "released" || !assignment.leader,
    );
    const timestamp = nowIso(this.options.now);
    const assignment: Assignment = {
      id: randomUUID(),
      workspaceId,
      seatId,
      seatLabel: seat.label,
      participantKind: actor.kind === "user" ? "human" : "agent",
      assigneeKind: actor.kind === "user" ? "user" : "agent",
      assigneeId: actor.id,
      ...(actor.kind === "agent"
        ? { sessionId: actor.sessionId ?? actor.id }
        : {}),
      personaId: personaId ?? seat.personaId,
      permissions: seat.permissions,
      leader,
      status: "claimed",
      claimedAt: timestamp,
      claimedBy: actor.id,
      updatedAt: timestamp,
    };
    await this.tables.assignments.put(key, assignment);
    return assignment;
  }

  async assign(
    actor: RoleActor,
    input: {
      readonly workspaceId: string;
      readonly seatId: string;
      readonly assigneeKind: "user" | "agent";
      readonly assigneeId: string;
      readonly personaId?: string;
    },
  ): Promise<Assignment> {
    if (!isManager(actor)) {
      throw new RolesError("forbidden", "workspace owner role is required");
    }
    const config = this.config(input.workspaceId);
    const seat = config.seats.find(
      (candidate) => candidate.id === input.seatId,
    );
    if (seat === undefined)
      throw new RolesError("not_found", "role seat not found");
    if (
      seat.participantKind !== "any" &&
      seat.participantKind !==
        (input.assigneeKind === "user" ? "human" : "agent")
    ) {
      throw new RolesError(
        "invalid_input",
        "participant kind does not match seat",
      );
    }
    const key = assignmentKey(input.workspaceId, input.seatId);
    const existing = this.tables.assignments.get(key);
    if (existing !== undefined && existing.status !== "released") {
      throw new RolesError("conflict", "role seat is already occupied");
    }
    const timestamp = nowIso(this.options.now);
    const leader = this.seats(input.workspaceId).every(
      (assignment) => assignment.status === "released" || !assignment.leader,
    );
    const assignment: Assignment = {
      id: randomUUID(),
      workspaceId: input.workspaceId,
      seatId: seat.id,
      seatLabel: seat.label,
      participantKind: input.assigneeKind === "user" ? "human" : "agent",
      assigneeKind: input.assigneeKind,
      assigneeId: input.assigneeId,
      personaId: input.personaId ?? seat.personaId,
      permissions: seat.permissions,
      leader,
      status: "assigned",
      updatedAt: timestamp,
    };
    await this.tables.assignments.put(key, assignment);
    return assignment;
  }

  async release(
    actor: RoleActor,
    workspaceId: string,
    seatId: string,
  ): Promise<Assignment> {
    this.config(workspaceId);
    const key = assignmentKey(workspaceId, seatId);
    const assignment = this.tables.assignments.get(key);
    if (assignment === undefined || assignment.status === "released") {
      throw new RolesError("not_found", "active role seat not found");
    }
    const own =
      assignment.assigneeKind === (actor.kind === "user" ? "user" : "agent") &&
      assignment.assigneeId === actor.id;
    if (!own && !isManager(actor)) {
      throw new RolesError(
        "forbidden",
        "seat owner or workspace owner role is required",
      );
    }
    const released: Assignment = {
      ...assignment,
      status: "released",
      updatedAt: nowIso(this.options.now),
    };
    await this.tables.assignments.put(key, released);
    return released;
  }
}

export const assignmentDomainSpec: DomainSpecLike = {
  name: "collab_assignment",
  version: 1,
  tables: {
    workspaces: {
      valueSchema: workspaceConfigSchema as unknown as SchemaLike<unknown>,
    },
    assignments: {
      valueSchema: assignmentSchema as unknown as SchemaLike<unknown>,
    },
  },
};

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

export interface RolesContext {
  effect(register: () => () => void): void;
  provide(key: "collabPersonas", value: PersonaService): unknown;
  provide(key: "collabWorkspaceType", value: WorkspaceTypeService): unknown;
  provide(key: "collabAssignment", value: AssignmentService): unknown;
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
        args: unknown,
        exec: { readonly signal: AbortSignal },
      ): Promise<string>;
    }): unknown;
  };
  webServer: { register(route: WebRouteLike): unknown };
  storageDomain: { open(spec: DomainSpecLike): Promise<AssignmentDomainLike> };
  collabTeam?: TeamServiceLike;
  inject(
    keys: readonly ["collabTeam"],
    callback: (
      child: RolesContext & { readonly collabTeam: TeamServiceLike },
    ) => void,
  ): { dispose(): void };
}

function agentActor(sessionId: string | undefined): RoleActor {
  return {
    kind: "agent",
    id: sessionId ?? "agent",
    ...(sessionId === undefined ? {} : { sessionId }),
    workspaceRole: "member",
  };
}

function browserActor(
  team: TeamServiceLike,
  request: IncomingMessage,
  workspaceId: string,
  options: { readonly requireWorkspaceMember?: boolean } = {},
): RoleActor {
  const headers = request.headers;
  if (
    headers.origin !== undefined &&
    !sameOrigin(headers.origin, headers.host)
  ) {
    throw new RolesError("forbidden", "same-origin requests are required");
  }
  const token = bearerToken({
    get: (name) =>
      name === "authorization" ? (headers.authorization ?? null) : null,
  });
  if (token === undefined)
    throw new RolesError("unauthorized", "bearer token is required");
  const principal = team.resolveToken(token);
  if (principal === undefined)
    throw new RolesError("unauthorized", "invalid bearer token");
  const member = team
    .members(workspaceId)
    .find((candidate) => candidate.userId === principal.userId);
  if (
    options.requireWorkspaceMember === true &&
    member === undefined &&
    principal.role !== "admin"
  ) {
    throw new RolesError("forbidden", "workspace member role is required");
  }
  return {
    kind: "user",
    id: principal.userId,
    globalRole: principal.role as RoleActor["globalRole"],
    ...(member === undefined
      ? {}
      : { workspaceRole: member.memberRole as RoleActor["workspaceRole"] }),
  };
}

function errorStatus(code: RolesError["code"]): number {
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
    if (cause instanceof RolesError) {
      sendJson(response, errorStatus(cause.code), {
        ok: false,
        error: { code: cause.code, message: cause.message },
      });
      return;
    }
    sendJson(response, 500, {
      ok: false,
      error: { code: "internal_error", message: "roles operation failed" },
    });
  }
}

export function createRolesRoutes(
  personas: PersonaService,
  types: WorkspaceTypeService,
  assignments: AssignmentService,
  team: TeamServiceLike,
): WebRouteLike[] {
  const routes = [
    {
      method: "GET",
      path: "/api/collab/roles/personas",
      handler: async (request: IncomingMessage, response: ServerResponse) => {
        browserActor(team, request, "global");
        sendJson(response, 200, { ok: true, personas: await personas.list() });
      },
    },
    {
      method: "POST",
      path: "/api/collab/roles/personas",
      handler: async (request: IncomingMessage, response: ServerResponse) => {
        browserActor(team, request, "global");
        const body = parseOrInvalid(
          z.object({
            id: idSchema,
            name: nameSchema,
            description: descriptionSchema,
            tags: z.array(z.string().trim().min(1).max(32)).max(16).default([]),
            soul: z.string().max(200_000).default(""),
          }),
          await readJsonBody(request),
        );
        sendJson(response, 201, {
          ok: true,
          persona: await personas.create(body),
        });
      },
    },
    {
      method: "GET",
      path: "/api/collab/roles/types",
      handler: async (request: IncomingMessage, response: ServerResponse) => {
        browserActor(team, request, "global");
        sendJson(response, 200, { ok: true, types: await types.list() });
      },
    },
    {
      method: "POST",
      path: "/api/collab/roles/types",
      handler: async (request: IncomingMessage, response: ServerResponse) => {
        const actor = browserActor(team, request, "global");
        if (actor.globalRole !== "admin") {
          throw new RolesError(
            "forbidden",
            "admin role is required for type creation",
          );
        }
        const body = parseOrInvalid(
          z.object({
            id: idSchema,
            name: nameSchema,
            description: descriptionSchema,
            seats: z.array(seatSchema).min(1).max(32),
          }),
          await readJsonBody(request),
        );
        const timestamp = nowIso(() => new Date());
        sendJson(response, 201, {
          ok: true,
          type: await types.create({
            ...body,
            createdAt: timestamp,
            updatedAt: timestamp,
          }),
        });
      },
    },
    {
      method: "POST",
      path: "/api/collab/roles/materialize",
      handler: async (request: IncomingMessage, response: ServerResponse) => {
        const body = parseOrInvalid(
          z.object({ workspaceId: idSchema, typeId: idSchema }),
          await readJsonBody(request),
        );
        const actor = browserActor(team, request, body.workspaceId, {
          requireWorkspaceMember: true,
        });
        sendJson(response, 201, {
          ok: true,
          config: await assignments.materialize(
            actor,
            body.workspaceId,
            await types.get(body.typeId),
          ),
        });
      },
    },
    {
      method: "GET",
      path: "/api/collab/roles/seats",
      handler: async (request: IncomingMessage, response: ServerResponse) => {
        const workspaceId = new URL(
          request.url ?? "/",
          "http://localhost",
        ).searchParams.get("workspaceId");
        if (workspaceId === null)
          throw new RolesError("invalid_input", "workspaceId is required");
        browserActor(team, request, workspaceId, {
          requireWorkspaceMember: true,
        });
        sendJson(response, 200, {
          ok: true,
          config: assignments.config(workspaceId),
          seats: assignments.seats(workspaceId),
        });
      },
    },
    {
      method: "POST",
      path: "/api/collab/roles/seats/claim",
      handler: async (request: IncomingMessage, response: ServerResponse) => {
        const body = parseOrInvalid(
          z.object({
            workspaceId: idSchema,
            seatId: idSchema,
            personaId: idSchema.optional(),
          }),
          await readJsonBody(request),
        );
        const actor = browserActor(team, request, body.workspaceId, {
          requireWorkspaceMember: true,
        });
        sendJson(response, 201, {
          ok: true,
          seat: await assignments.claim(
            actor,
            body.workspaceId,
            body.seatId,
            body.personaId,
          ),
        });
      },
    },
    {
      method: "POST",
      path: "/api/collab/roles/seats/assign",
      handler: async (request: IncomingMessage, response: ServerResponse) => {
        const body = parseOrInvalid(
          z.object({
            workspaceId: idSchema,
            seatId: idSchema,
            assigneeKind: z.enum(["user", "agent"]),
            assigneeId: idSchema,
            personaId: idSchema.optional(),
          }),
          await readJsonBody(request),
        );
        const actor = browserActor(team, request, body.workspaceId, {
          requireWorkspaceMember: true,
        });
        sendJson(response, 201, {
          ok: true,
          seat: await assignments.assign(actor, {
            workspaceId: body.workspaceId,
            seatId: body.seatId,
            assigneeKind: body.assigneeKind,
            assigneeId: body.assigneeId,
            ...(body.personaId === undefined
              ? {}
              : { personaId: body.personaId }),
          }),
        });
      },
    },
    {
      method: "POST",
      path: "/api/collab/roles/seats/release",
      handler: async (request: IncomingMessage, response: ServerResponse) => {
        const body = parseOrInvalid(
          z.object({ workspaceId: idSchema, seatId: idSchema }),
          await readJsonBody(request),
        );
        const actor = browserActor(team, request, body.workspaceId, {
          requireWorkspaceMember: true,
        });
        sendJson(response, 200, {
          ok: true,
          seat: await assignments.release(actor, body.workspaceId, body.seatId),
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

export async function apply(ctx: RolesContext): Promise<void | (() => void)> {
  const domain = await ctx.storageDomain.open(assignmentDomainSpec);
  const home = process.env.DSH_HOME;
  if (home === undefined || !isAbsolute(home)) {
    await domain.close();
    throw new Error("DSH_HOME must be set to an absolute directory");
  }
  const personas = new PersonaService(join(home, "pluginmax", "personas"));
  const types = new WorkspaceTypeService(
    join(home, "pluginmax", "workspace-types"),
  );
  const assignments = new AssignmentService({
    workspaces: domain.table("workspaces"),
    assignments: domain.table("assignments"),
  });
  ctx.provide("collabPersonas", personas);
  ctx.provide("collabWorkspaceType", types);
  ctx.provide("collabAssignment", assignments);
  ctx.effect(() => () => void domain.close());
  ctx.commands.register({
    name: "assignment",
    description: "manage DSH Pluginmax role seats",
    input: {
      hint: "list <workspace> | claim <workspace> <seat> [persona] | release <workspace> <seat>",
      attachments: false,
    },
    handler: (invocation) => {
      const [operation, workspaceId, seatId, personaId] = invocation.rawInput
        .trim()
        .split(/\s+/);
      try {
        if (operation === "list" && workspaceId !== undefined) {
          const seats = assignments.seats(workspaceId);
          return {
            kind: "success",
            text:
              seats
                .map(
                  (seat) =>
                    `${seat.seatId}\t${seat.status}\t${seat.assigneeKind}/${seat.assigneeId}${seat.leader ? "\tleader" : ""}`,
                )
                .join("\n") || "no occupied seats",
          };
        }
        if (
          operation === "claim" &&
          workspaceId !== undefined &&
          seatId !== undefined
        ) {
          const promise = assignments.claim(
            agentActor("agent-command"),
            workspaceId,
            seatId,
            personaId,
          );
          void promise.catch(() => undefined);
          return {
            kind: "success",
            text: `claim accepted: ${workspaceId}/${seatId}`,
          };
        }
        if (
          operation === "release" &&
          workspaceId !== undefined &&
          seatId !== undefined
        ) {
          const promise = assignments.release(
            agentActor("agent-command"),
            workspaceId,
            seatId,
          );
          void promise.catch(() => undefined);
          return {
            kind: "success",
            text: `release accepted: ${workspaceId}/${seatId}`,
          };
        }
      } catch (cause) {
        return {
          kind: "error",
          text: cause instanceof Error ? cause.message : String(cause),
        };
      }
      return {
        kind: "error",
        text: "usage: /assignment list <workspace> | claim <workspace> <seat> [persona] | release <workspace> <seat>",
      };
    },
  });
  ctx.tools.register({
    name: "collab_roles",
    description: "Inspect materialized role seats or claim an available seat.",
    parameters: {
      type: "object",
      additionalProperties: false,
      properties: {
        operation: { type: "string", enum: ["list", "claim"] },
        workspaceId: { type: "string" },
        seatId: { type: "string" },
        personaId: { type: "string" },
      },
      required: ["operation", "workspaceId"],
    },
    output: stringToolOutput,
    execute: async (args, exec) => {
      exec.signal.throwIfAborted();
      const parsed = parseOrInvalid(
        z.object({
          operation: z.enum(["list", "claim"]),
          workspaceId: idSchema,
          seatId: idSchema.optional(),
          personaId: idSchema.optional(),
        }),
        args,
      );
      if (parsed.operation === "list") {
        return assignments
          .seats(parsed.workspaceId)
          .map((seat) => `${seat.seatId}\t${seat.status}\t${seat.assigneeId}`)
          .join("\n");
      }
      if (parsed.seatId === undefined) {
        throw new RolesError("invalid_input", "seatId is required for claim");
      }
      const seat = await assignments.claim(
        agentActor("collab-roles-tool"),
        parsed.workspaceId,
        parsed.seatId,
        parsed.personaId,
      );
      return `${seat.seatLabel} claimed by ${seat.assigneeId}${seat.leader ? " as leader" : ""}`;
    },
  });
  let routeDisposers: Array<() => void> = [];
  const identityFiber = ctx.inject(["collabTeam"], (child) => {
    routeDisposers = createRolesRoutes(
      personas,
      types,
      assignments,
      child.collabTeam,
    ).map((route) => child.webServer.register(route)) as Array<() => void>;
  });
  return () => {
    identityFiber.dispose();
    for (const dispose of routeDisposers) dispose();
  };
}
