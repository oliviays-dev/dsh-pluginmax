import { randomUUID } from "node:crypto";
import {
  profileTemplateSchema,
  teammateEventSchema,
  teammateSchema,
  type Teammate,
  type TeammateEvent,
  type TeammateSource,
  type TeammateState,
  type ProfileTemplate,
  type ProfileTemplateState,
} from "./models.js";

export interface KvTableLike<V> {
  get(key: string): V | undefined;
  entries(): IterableIterator<[string, V]>;
  readonly size: number;
  put(key: string, value: V): Promise<void>;
  delete?(key: string): Promise<boolean>;
}

export interface TeammateTables {
  readonly teammates: KvTableLike<Teammate>;
  readonly events: KvTableLike<TeammateEvent>;
}

export interface ProfileTemplateTables {
  readonly templates: KvTableLike<ProfileTemplate>;
}

export interface TeammateActor {
  readonly userId: string;
  readonly name: string;
  readonly role: "admin" | "owner" | "member" | "guest";
}

export interface TeammateServiceOptions {
  readonly now?: () => Date;
}

export class TeammateError extends Error {
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
    this.name = "TeammateError";
  }
}

export interface CreateTeammateInput {
  readonly source: TeammateSource;
  readonly name?: string | undefined;
  readonly role?: string | undefined;
  readonly profileTemplateId?: string | undefined;
}

export interface CreateProfileTemplateInput {
  readonly name: string;
  readonly role?: string | undefined;
  readonly description?: string | undefined;
  readonly soul?: string | undefined;
  readonly scenarios?: readonly string[] | undefined;
  readonly goals?: readonly string[] | undefined;
  readonly tools?: readonly string[] | undefined;
  readonly active?: boolean | undefined;
}

export interface UpdateProfileTemplateInput {
  readonly templateId: string;
  readonly name: string;
  readonly role?: string | undefined;
  readonly description?: string | undefined;
  readonly soul?: string | undefined;
  readonly scenarios?: readonly string[] | undefined;
  readonly goals?: readonly string[] | undefined;
  readonly tools?: readonly string[] | undefined;
}

export interface UpdateTeammateInput {
  readonly teammateId: string;
  readonly name: string;
  readonly source?: TeammateSource | undefined;
  readonly role?: string | undefined;
  readonly description?: string | undefined;
  readonly soul?: string | undefined;
  readonly scenarios?: readonly string[] | undefined;
  readonly goals?: readonly string[] | undefined;
  readonly avatar?: string | undefined;
}

export interface ChangeTeammateStateInput {
  readonly teammateId: string;
  readonly state: TeammateState;
}

/**
 * 状态流转与 demo 一致：草稿保存后进入「已失效」，再按归属分别生效、暂停或归档。
 * 归档为终态，需要重新启用时由管理员另建定义。
 */
const STATUS_TRANSITIONS: Record<TeammateState, readonly TeammateState[]> = {
  draft: ["inactive", "archived"],
  active: ["paused", "inactive", "archived"],
  paused: ["active", "inactive", "archived"],
  inactive: ["active", "archived"],
  // 归档后允许「复原」回已失效，再按常规流程生效。
  archived: ["inactive"],
};

const STATE_LABELS: Record<TeammateState, string> = {
  draft: "草稿",
  active: "生效",
  paused: "暂停",
  inactive: "失效",
  archived: "归档",
};

const STATE_ORDER: Record<TeammateState, number> = {
  active: 0,
  draft: 1,
  paused: 2,
  inactive: 3,
  archived: 4,
};

const DEFAULT_NAME = "未命名 AI Teammate";
const DEFAULT_ROLE = "待定义";
const DEFAULT_SOUL =
  "定义这名 AI Teammate 是谁、如何判断、遇到什么情况需要升级给本人。";

function randomId(): string {
  return `tm-${randomUUID()}`;
}

function profileId(): string {
  return `pt-${randomUUID()}`;
}

const PROFILE_STATE_TRANSITIONS: Record<
  ProfileTemplateState,
  readonly ProfileTemplateState[]
> = {
  active: ["disabled", "archived"],
  disabled: ["active", "archived"],
  archived: [],
};

export class ProfileTemplateService {
  private queue: Promise<void> = Promise.resolve();

  constructor(private readonly options: {
    readonly tables: ProfileTemplateTables;
    readonly now?: () => Date;
  }) {}

  private enqueue<T>(operation: () => Promise<T>): Promise<T> {
    const result = this.queue.then(operation);
    this.queue = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  }

  private timestamp(): string {
    return (this.options.now?.() ?? new Date()).toISOString();
  }

  private values(): ProfileTemplate[] {
    return [...this.options.tables.templates.entries()].map(
      ([, value]) => value,
    );
  }

  private require(templateId: string): ProfileTemplate {
    const profile = this.options.tables.templates.get(templateId);
    if (profile === undefined) {
      throw new TeammateError("not_found", "Profile 模版不存在");
    }
    return profile;
  }

  list(actor: TeammateActor): ProfileTemplate[] {
    return this.values()
      .filter((profile) =>
        actor.role === "admin" ? true : profile.state === "active",
      )
      .sort(
        (left, right) =>
          Number(right.state === "active") -
            Number(left.state === "active") ||
          right.updatedAt.localeCompare(left.updatedAt) ||
          left.name.localeCompare(right.name, "zh-Hans-CN"),
      );
  }

  get(templateId: string): ProfileTemplate | undefined {
    return this.options.tables.templates.get(templateId);
  }

  create(
    actor: TeammateActor,
    input: CreateProfileTemplateInput,
  ): Promise<ProfileTemplate> {
    return this.enqueue(async () => {
      if (actor.role !== "admin") {
        throw new TeammateError("forbidden", "平台管理员可以维护 Profile 模版");
      }
      const timestamp = this.timestamp();
      const profile = profileTemplateSchema.parse({
        id: profileId(),
        name: input.name.trim(),
        role: input.role?.trim() ?? "",
        description: input.description?.trim() ?? "",
        soul: input.soul ?? "",
        scenarios: input.scenarios ?? [],
        goals: input.goals ?? [],
        tools: input.tools ?? [],
        state: input.active === false ? "disabled" : "active",
        version: "v1.0",
        createdBy: actor.userId,
        createdAt: timestamp,
        updatedAt: timestamp,
      });
      await this.options.tables.templates.put(profile.id, profile);
      return profile;
    });
  }

  update(
    actor: TeammateActor,
    input: UpdateProfileTemplateInput,
  ): Promise<ProfileTemplate> {
    return this.enqueue(async () => {
      if (actor.role !== "admin") {
        throw new TeammateError("forbidden", "平台管理员可以维护 Profile 模版");
      }
      const current = this.require(input.templateId);
      if (current.state === "archived") {
        throw new TeammateError("conflict", "归档的 Profile 模版不能编辑");
      }
      const next = profileTemplateSchema.parse({
        ...current,
        name: input.name.trim(),
        role: input.role?.trim() ?? current.role,
        description: input.description?.trim() ?? current.description,
        soul: input.soul ?? current.soul,
        scenarios: input.scenarios ?? current.scenarios,
        goals: input.goals ?? current.goals,
        tools: input.tools ?? current.tools,
        version: nextVersion(current.version),
        updatedAt: this.timestamp(),
      });
      await this.options.tables.templates.put(next.id, next);
      return next;
    });
  }

  changeState(
    actor: TeammateActor,
    input: { templateId: string; state: ProfileTemplateState },
  ): Promise<ProfileTemplate> {
    return this.enqueue(async () => {
      if (actor.role !== "admin") {
        throw new TeammateError("forbidden", "平台管理员可以维护 Profile 模版");
      }
      const current = this.require(input.templateId);
      if (
        !PROFILE_STATE_TRANSITIONS[current.state].includes(input.state)
      ) {
        throw new TeammateError(
          "conflict",
          `Profile 模版不能从 ${current.state} 改为 ${input.state}`,
        );
      }
      const next = profileTemplateSchema.parse({
        ...current,
        state: input.state,
        updatedAt: this.timestamp(),
      });
      await this.options.tables.templates.put(next.id, next);
      return next;
    });
  }
}

export function nextVersion(current: string): string {
  const match = /^v(\d+)\.(\d+)$/.exec(current.trim());
  if (match === null) return "v1.0";
  const major = Number(match[1]);
  const minor = Number(match[2]);
  return `v${major}.${minor + 1}`;
}

export function canManageTeammate(
  teammate: Teammate,
  actor: TeammateActor,
): boolean {
  return teammate.source === "personal"
    ? teammate.ownerUserId === actor.userId
    : actor.role === "admin";
}

export class TeammateService {
  private readonly profiles: ProfileTemplateService | undefined;
  private queue: Promise<void> = Promise.resolve();

  constructor(private readonly options: {
    readonly tables: TeammateTables;
    readonly now?: () => Date;
    readonly profiles?: ProfileTemplateService;
  }) {
    this.profiles = options.profiles;
  }

  private enqueue<T>(operation: () => Promise<T>): Promise<T> {
    const result = this.queue.then(operation);
    this.queue = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  }

  private now(): Date {
    return this.options.now?.() ?? new Date();
  }

  private timestamp(): string {
    return this.now().toISOString();
  }

  private values<V>(table: KvTableLike<V>): V[] {
    return [...table.entries()].map(([, value]) => value);
  }

  private requireTeammate(teammateId: string): Teammate {
    const teammate = this.options.tables.teammates.get(teammateId);
    if (teammate === undefined) {
      throw new TeammateError("not_found", "AI Teammate 不存在");
    }
    return teammate;
  }

  private assertCanManage(teammate: Teammate, actor: TeammateActor): void {
    if (canManageTeammate(teammate, actor)) return;
    throw new TeammateError(
      "forbidden",
      teammate.source === "platform"
        ? "平台归属定义只有平台管理员可以维护"
        : "个人归属定义只有本人可以维护",
    );
  }

  private async record(
    teammate: Teammate,
    actor: TeammateActor,
    kind: TeammateEvent["kind"],
    message: string,
  ): Promise<TeammateEvent> {
    const event = teammateEventSchema.parse({
      id: `evt-${randomUUID()}`,
      teammateId: teammate.id,
      seq: this.options.tables.events.size,
      at: this.timestamp(),
      actorUserId: actor.userId,
      actorName: actor.name,
      kind,
      message,
    });
    await this.options.tables.events.put(event.id, event);
    return event;
  }

  private async profileSeed(
    templateId: string | undefined,
  ): Promise<ProfileTemplate | undefined> {
    if (templateId === undefined) return undefined;
    const profile = await this.profiles?.get(templateId);
    if (profile === undefined) {
      throw new TeammateError("not_found", "Profile 模版不存在");
    }
    if (profile.state !== "active") {
      throw new TeammateError("invalid_input", "Profile 模版不可用");
    }
    return profile;
  }

  list(): readonly Teammate[] {
    return this.values(this.options.tables.teammates).sort((left, right) => {
      if (left.source !== right.source) {
        return left.source === "platform" ? -1 : 1;
      }
      const stateOrder = STATE_ORDER[left.state] - STATE_ORDER[right.state];
      if (stateOrder !== 0) return stateOrder;
      return left.name.localeCompare(right.name, "zh-Hans-CN");
    });
  }

  get(teammateId: string): Teammate {
    return this.requireTeammate(teammateId);
  }

  events(teammateId: string): readonly TeammateEvent[] {
    return this.values(this.options.tables.events)
      .filter((event) => event.teammateId === teammateId)
      .sort((left, right) => right.seq - left.seq);
  }

  create(actor: TeammateActor, input: CreateTeammateInput): Promise<Teammate> {
    return this.enqueue(async () => {
      if (input.source === "platform" && actor.role !== "admin") {
        throw new TeammateError(
          "forbidden",
          "平台归属定义只有平台管理员可以创建",
        );
      }
      const timestamp = this.timestamp();
      const profile = await this.profileSeed(input.profileTemplateId);
      const teammate = teammateSchema.parse({
        id: randomId(),
        source: input.source,
        name: input.name?.trim() || profile?.name || DEFAULT_NAME,
        role: input.role?.trim() || profile?.role || DEFAULT_ROLE,
        ownerUserId: actor.userId,
        ownerName: input.source === "platform" ? "平台" : actor.name,
        description: profile?.description ?? "",
        soul: profile?.soul || DEFAULT_SOUL,
        scenarios: profile?.scenarios ?? ["补充第一个工作场景"],
        goals: profile?.goals ?? ["补充第一个明确目标"],
        avatar: "",
        state: "draft",
        version: "v0.1",
        ...(profile === undefined ? {} : { profileTemplateId: profile.id }),
        createdBy: actor.userId,
        createdAt: timestamp,
        updatedAt: timestamp,
      });
      await this.options.tables.teammates.put(teammate.id, teammate);
      await this.record(
        teammate,
        actor,
        "created",
        `创建了${input.source === "platform" ? "平台归属" : "个人归属"}定义草稿${
          profile === undefined ? "" : `，已应用 ${profile.name}`
        }`,
      );
      return teammate;
    });
  }

  async applyProfile(
    actor: TeammateActor,
    input: { teammateId: string; templateId: string },
  ): Promise<Teammate> {
    const profile = await this.profiles?.get(input.templateId);
    if (profile === undefined) {
      throw new TeammateError("not_found", "Profile 模版不存在");
    }
    if (profile.state !== "active") {
      throw new TeammateError("invalid_input", "Profile 模版不可用");
    }
    return this.enqueue(async () => {
      const current = this.requireTeammate(input.teammateId);
      this.assertCanManage(current, actor);
      const next = teammateSchema.parse({
        ...current,
        profileTemplateId: profile.id,
        role: profile.role || current.role,
        description: profile.description || current.description,
        soul: profile.soul || current.soul,
        scenarios:
          profile.scenarios.length > 0 ? profile.scenarios : current.scenarios,
        goals: profile.goals.length > 0 ? profile.goals : current.goals,
        version: nextVersion(current.version),
        updatedAt: this.timestamp(),
      });
      await this.options.tables.teammates.put(next.id, next);
      await this.record(
        next,
        actor,
        "updated",
        `应用 Profile 模版：${profile.name}`,
      );
      return next;
    });
  }

  update(actor: TeammateActor, input: UpdateTeammateInput): Promise<Teammate> {
    return this.enqueue(async () => {
      const current = this.requireTeammate(input.teammateId);
      this.assertCanManage(current, actor);
      const wasDraft = current.state === "draft";
      const nextSource = wasDraft ? (input.source ?? current.source) : current.source;
      if (nextSource !== current.source && nextSource === "platform" && actor.role !== "admin") {
        throw new TeammateError(
          "forbidden",
          "平台归属定义只有平台管理员可以创建",
        );
      }
      const teammate = teammateSchema.parse({
        ...current,
        source: nextSource,
        ownerUserId: nextSource === "platform" ? actor.userId : current.ownerUserId,
        ownerName:
          nextSource === "platform"
            ? "平台"
            : current.source === "personal"
              ? current.ownerName
              : actor.name,
        name: input.name.trim() || DEFAULT_NAME,
        role: input.role?.trim() || DEFAULT_ROLE,
        description: input.description?.trim() ?? current.description,
        soul: input.soul ?? current.soul,
        scenarios: input.scenarios ?? current.scenarios,
        goals: input.goals ?? current.goals,
        avatar: input.avatar ?? current.avatar,
        state: wasDraft ? "inactive" : current.state,
        version: wasDraft ? "v1.0" : nextVersion(current.version),
        updatedAt: this.timestamp(),
      });
      await this.options.tables.teammates.put(teammate.id, teammate);
      await this.record(
        teammate,
        actor,
        "updated",
        wasDraft
          ? "保存定义并发布 v1.0"
          : `更新定义至 ${teammate.version}`,
      );
      return teammate;
    });
  }

  changeState(
    actor: TeammateActor,
    input: ChangeTeammateStateInput,
  ): Promise<Teammate> {
    return this.enqueue(async () => {
      const current = this.requireTeammate(input.teammateId);
      this.assertCanManage(current, actor);
      if (input.state === current.state) {
        throw new TeammateError("conflict", "定义已处于该状态");
      }
      if (!STATUS_TRANSITIONS[current.state].includes(input.state)) {
        throw new TeammateError(
          "conflict",
          `不允许从「${STATE_LABELS[current.state]}」变更为「${STATE_LABELS[input.state]}」`,
        );
      }
      const teammate = teammateSchema.parse({
        ...current,
        state: input.state,
        updatedAt: this.timestamp(),
      });
      await this.options.tables.teammates.put(teammate.id, teammate);
      await this.record(
        teammate,
        actor,
        input.state === "archived" ? "archived" : "state",
        current.state === "archived" && input.state === "inactive"
          ? `${actor.name} 复原了该定义`
          : `${actor.name} 将定义设为「${STATE_LABELS[input.state]}」`,
      );
      return teammate;
    });
  }

  /** 记录自动开通出来的运行时身份，后续派发复用同一个数字员工。 */
  bindEmployee(
    actor: TeammateActor,
    teammateId: string,
    employeeId: string,
  ): Promise<Teammate> {
    return this.enqueue(async () => {
      const current = this.requireTeammate(teammateId);
      this.assertCanManage(current, actor);
      if (current.employeeId === employeeId) return current;
      const teammate = teammateSchema.parse({
        ...current,
        employeeId,
        updatedAt: this.timestamp(),
      });
      await this.options.tables.teammates.put(teammate.id, teammate);
      await this.record(
        teammate,
        actor,
        "updated",
        `绑定执行身份 ${employeeId}`,
      );
      return teammate;
    });
  }

  /**
   * 把员工平台里已存在的数字员工等价成平台归属定义（系统同步，不做权限校验）。
   * 只在该 employeeId 还没有 teammate 记录时调用，保证幂等。
   */
  importFromEmployee(input: {
    readonly employeeId: string;
    readonly name: string;
    readonly role: string;
    readonly state: TeammateState;
    readonly soul?: string | undefined;
    readonly personaId?: string | undefined;
    readonly avatar?: string | undefined;
  }): Promise<Teammate> {
    return this.enqueue(async () => {
      const existing = this.values(this.options.tables.teammates).find(
        (teammate) => teammate.employeeId === input.employeeId,
      );
      if (existing !== undefined) return existing;
      const teammate = teammateSchema.parse({
        id: randomId(),
        source: "platform",
        name: input.name,
        role: input.role,
        ownerUserId: "admin",
        ownerName: "平台",
        description: "",
        soul: input.soul ?? "",
        scenarios: [],
        goals: [],
        avatar: input.avatar ?? "",
        state: input.state,
        version: "v1.0",
        ...(input.personaId === undefined
          ? {}
          : { personaId: input.personaId }),
        employeeId: input.employeeId,
        createdBy: "system",
        createdAt: this.timestamp(),
        updatedAt: this.timestamp(),
      });
      await this.options.tables.teammates.put(teammate.id, teammate);
      await this.record(
        teammate,
        { userId: "system", name: "系统", role: "admin" },
        "created",
        `从员工平台的数字员工 ${input.employeeId} 同步为平台归属定义`,
      );
      return teammate;
    });
  }
}
