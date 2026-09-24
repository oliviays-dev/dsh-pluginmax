import { randomUUID } from "node:crypto";
import {
  teammateEventSchema,
  teammateSchema,
  type Teammate,
  type TeammateEvent,
  type TeammateSource,
  type TeammateState,
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
  private queue: Promise<void> = Promise.resolve();

  constructor(private readonly options: {
    readonly tables: TeammateTables;
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
      const teammate = teammateSchema.parse({
        id: randomId(),
        source: input.source,
        name: input.name?.trim() || DEFAULT_NAME,
        role: input.role?.trim() || DEFAULT_ROLE,
        ownerUserId: actor.userId,
        ownerName: input.source === "platform" ? "平台" : actor.name,
        description: "",
        soul: DEFAULT_SOUL,
        scenarios: ["补充第一个工作场景"],
        goals: ["补充第一个明确目标"],
        avatar: "",
        state: "draft",
        version: "v0.1",
        createdBy: actor.userId,
        createdAt: timestamp,
        updatedAt: timestamp,
      });
      await this.options.tables.teammates.put(teammate.id, teammate);
      await this.record(
        teammate,
        actor,
        "created",
        `创建了${input.source === "platform" ? "平台归属" : "个人归属"}定义草稿`,
      );
      return teammate;
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
