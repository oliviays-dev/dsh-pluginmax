import { describe, expect, it } from "vitest";
import {
  TeammateService,
  canManageTeammate,
  nextVersion,
  type KvTableLike,
  type TeammateTables,
} from "./service.js";
import type { Teammate, TeammateEvent } from "./models.js";

function memoryTable<V>(): KvTableLike<V> {
  const values = new Map<string, V>();
  return {
    get: (key) => values.get(key),
    entries: () => values.entries(),
    get size() {
      return values.size;
    },
    async put(key, value) {
      values.set(key, value);
    },
    async delete(key) {
      return values.delete(key);
    },
  };
}

function service(tables?: TeammateTables): TeammateService {
  return new TeammateService({
    tables:
      tables ??
      {
        teammates: memoryTable<Teammate>(),
        events: memoryTable<TeammateEvent>(),
      },
  });
}

function definition(
  id: string,
  source: Teammate["source"],
  state: Teammate["state"],
  name = id,
): Teammate {
  const at = new Date(0).toISOString();
  return {
    id,
    source,
    name,
    role: "",
    ownerUserId: "owner",
    ownerName: source === "platform" ? "平台" : "Owner",
    description: "",
    soul: "",
    scenarios: [],
    goals: [],
    avatar: "",
    state,
    version: "v1.0",
    createdBy: "test",
    createdAt: at,
    updatedAt: at,
  };
}

const olivia = { userId: "olivia", name: "Olivia", role: "member" as const };
const admin = { userId: "admin", name: "Admin", role: "admin" as const };
const peter = { userId: "peter", name: "Peter", role: "member" as const };

describe("dsh-collab-teammate service", () => {
  it("creates a personal draft and promotes it on first save", async () => {
    const teammates = service();
    const draft = await teammates.create(olivia, { source: "personal" });
    expect(draft.source).toBe("personal");
    expect(draft.ownerName).toBe("Olivia");
    expect(draft.state).toBe("draft");
    expect(draft.version).toBe("v0.1");

    const saved = await teammates.update(olivia, {
      teammateId: draft.id,
      name: "Research Avatar",
      role: "研究与会前分析",
      description: "会前资料整理",
      soul: "保留来源。",
      scenarios: ["会前研究：提取分歧"],
      goals: ["减少准备时间"],
      avatar: "berry",
    });
    expect(saved.state).toBe("inactive");
    expect(saved.version).toBe("v1.0");

    const next = await teammates.update(olivia, {
      teammateId: draft.id,
      name: "Research Avatar",
    });
    expect(next.version).toBe("v1.1");
    expect(next.state).toBe("inactive");

    const events = teammates.events(draft.id);
    expect(events).toHaveLength(3);
    expect(events.map((event) => event.kind)).toEqual([
      "updated",
      "updated",
      "created",
    ]);
  });

  it("keeps personal definitions scoped to the owner", async () => {
    const teammates = service();
    const draft = await teammates.create(olivia, { source: "personal" });
    expect(canManageTeammate(draft, olivia)).toBe(true);
    expect(canManageTeammate(draft, peter)).toBe(false);
    await expect(
      teammates.update(peter, { teammateId: draft.id, name: "Hijack" }),
    ).rejects.toMatchObject({ code: "forbidden" });
    await expect(
      teammates.changeState(peter, {
        teammateId: draft.id,
        state: "archived",
      }),
    ).rejects.toMatchObject({ code: "forbidden" });
  });

  it("restricts platform definitions to administrators", async () => {
    const teammates = service();
    await expect(
      teammates.create(olivia, { source: "platform" }),
    ).rejects.toMatchObject({ code: "forbidden" });

    const platform = await teammates.create(admin, { source: "platform" });
    expect(platform.ownerName).toBe("平台");
    expect(canManageTeammate(platform, admin)).toBe(true);
    expect(canManageTeammate(platform, olivia)).toBe(false);
    await expect(
      teammates.update(olivia, { teammateId: platform.id, name: "Hijack" }),
    ).rejects.toMatchObject({ code: "forbidden" });

    const saved = await teammates.update(admin, {
      teammateId: platform.id,
      name: "Backend DE 01",
      role: "后端开发",
    });
    expect(saved.state).toBe("inactive");
    expect(saved.version).toBe("v1.0");
  });

  it("sorts definitions by source, state, then name", async () => {
    const teammatesTable = memoryTable<Teammate>();
    const teammates = service({
      teammates: teammatesTable,
      events: memoryTable<TeammateEvent>(),
    });
    const fixtures = [
      definition("platform-archived", "platform", "archived"),
      definition("platform-inactive", "platform", "inactive"),
      definition("platform-paused", "platform", "paused"),
      definition("platform-draft", "platform", "draft"),
      definition("platform-active-b", "platform", "active", "Beta"),
      definition("platform-active-a", "platform", "active", "Alpha"),
      definition("personal-archived", "personal", "archived"),
      definition("personal-active", "personal", "active"),
    ];
    for (const teammate of fixtures) {
      await teammatesTable.put(teammate.id, teammate);
    }

    expect(teammates.list().map((teammate) => teammate.id)).toEqual([
      "platform-active-a",
      "platform-active-b",
      "platform-draft",
      "platform-paused",
      "platform-inactive",
      "platform-archived",
      "personal-active",
      "personal-archived",
    ]);
  });

  it("enforces the definition state machine", async () => {
    const teammates = service();
    const draft = await teammates.create(olivia, { source: "personal" });
    await expect(
      teammates.changeState(olivia, { teammateId: draft.id, state: "active" }),
    ).rejects.toMatchObject({ code: "conflict" });

    await teammates.update(olivia, { teammateId: draft.id, name: "Ops" });
    const active = await teammates.changeState(olivia, {
      teammateId: draft.id,
      state: "active",
    });
    expect(active.state).toBe("active");

    const paused = await teammates.changeState(olivia, {
      teammateId: draft.id,
      state: "paused",
    });
    expect(paused.state).toBe("paused");

    const restarted = await teammates.changeState(olivia, {
      teammateId: draft.id,
      state: "active",
    });
    expect(restarted.state).toBe("active");

    const archived = await teammates.changeState(olivia, {
      teammateId: draft.id,
      state: "archived",
    });
    expect(archived.state).toBe("archived");

    await expect(
      teammates.changeState(olivia, { teammateId: draft.id, state: "active" }),
    ).rejects.toMatchObject({ code: "conflict" });
    expect(teammates.events(draft.id)[0]?.kind).toBe("archived");

    // 归档后可以「复原」成已失效，再正常生效
    const restored = await teammates.changeState(olivia, {
      teammateId: draft.id,
      state: "inactive",
    });
    expect(restored.state).toBe("inactive");
    expect(teammates.events(draft.id)[0]?.message).toContain("复原");
    const reactivated = await teammates.changeState(olivia, {
      teammateId: draft.id,
      state: "active",
    });
    expect(reactivated.state).toBe("active");
  });

  it("bumps definition versions predictably", () => {
    expect(nextVersion("v1.0")).toBe("v1.1");
    expect(nextVersion("v1.8")).toBe("v1.9");
    expect(nextVersion("v3.4")).toBe("v3.5");
    expect(nextVersion("unknown")).toBe("v1.0");
  });
});
