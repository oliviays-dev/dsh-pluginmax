#!/usr/bin/env node
import { copyFile, readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";

const here = dirname(fileURLToPath(import.meta.url));
const defaultHome = resolve(here, "../../../../.tmp/dsh-home");
const dshHome = process.env.DSH_HOME?.trim() || defaultHome;
const storageRoot = join(dshHome, "storages");
const teammatePath = join(storageRoot, "collab_teammate.json");
const assignmentPath = join(storageRoot, "collab_assignment.json");
const workspaceId = "706e06a4-0cd4-4bdc-bbde-f9a5484e6e15";
const apply = process.argv.includes("--apply");

const roles = {
  "Order Fulfillment": "01-order-fulfillment-instance-SOUL.md",
  Planning: "02-planning-instance-SOUL.md",
  Procurement: "03-procurement-instance-SOUL.md",
  Manufacturing: "04-manufacturing-instance-SOUL.md",
  Logistics: "05-logistics-instance-SOUL.md",
};

const teammateStore = JSON.parse(await readFile(teammatePath, "utf8"));
const assignmentStore = JSON.parse(await readFile(assignmentPath, "utf8"));

const assignments = Object.values(assignmentStore.tables?.assignments ?? {});
const selected = new Map();
for (const assignment of assignments) {
  if (
    assignment.workspaceId !== workspaceId ||
    assignment.participantKind !== "agent" ||
    assignment.assigneeKind !== "agent" ||
    assignment.status !== "assigned" ||
    !Object.hasOwn(roles, assignment.seatLabel)
  ) {
    continue;
  }
  selected.set(assignment.seatLabel, assignment.assigneeId);
}

for (const role of Object.keys(roles)) {
  if (!selected.has(role)) {
    throw new Error(`找不到项目 ${workspaceId} 的 ${role} AI伙伴实例`);
  }
}

const changes = [];
for (const [role, teammateId] of selected) {
  const teammate = teammateStore.tables?.teammates?.[teammateId];
  if (teammate === undefined) {
    throw new Error(`${role} 实例不存在: ${teammateId}`);
  }
  const soul = (
    await readFile(join(here, "instance-souls", roles[role]), "utf8")
  ).trim();
  if (teammate.instanceSoul === soul) continue;
  changes.push({
    role,
    teammateId,
    name: teammate.name,
    beforeLength: teammate.instanceSoul?.length ?? 0,
    afterLength: soul.length,
    soul,
  });
}

const humanRoleAssignments = {};
for (const [key, assignment] of Object.entries(
  assignmentStore.tables?.assignments ?? {},
)) {
  if (
    assignment.workspaceId === workspaceId &&
    assignment.participantKind === "human" &&
    assignment.assigneeKind === "user" &&
    assignment.assigneeId === "admin" &&
    assignment.status !== "assigned" &&
    (assignment.seatLabel === "Procurement" ||
      assignment.seatLabel === "Logistics")
  ) {
    humanRoleAssignments[assignment.seatLabel] = {
      key,
      before: assignment.status,
      after: "assigned",
    };
  }
}

console.log(
  JSON.stringify(
    {
      mode: apply ? "apply" : "dry-run",
      dshHome,
      workspaceId,
      selected: Object.fromEntries(selected),
      changes: changes.map(({ soul: _soul, ...change }) => change),
      humanRoleAssignments,
    },
    null,
    2,
  ),
);

if (
  !apply ||
  (changes.length === 0 &&
    Object.keys(humanRoleAssignments).length === 0)
) {
  process.exit(0);
}

const timestamp = `ai-server-120-instance-soul-${Date.now()}`;
await copyFile(teammatePath, `${teammatePath}.bak-${timestamp}`);
await copyFile(assignmentPath, `${assignmentPath}.bak-${timestamp}`);

let eventSequence = Object.keys(teammateStore.tables?.events ?? {}).length;
const now = new Date().toISOString();
for (const change of changes) {
  const teammate = teammateStore.tables.teammates[change.teammateId];
  const currentMinor = Number(teammate.version.split(".")[1] ?? "0");
  teammate.instanceSoul = change.soul;
  teammate.version = `v${teammate.version.split(".")[0].slice(1)}.${currentMinor + 1}`;
  teammate.updatedAt = now;
  const event = {
    id: `evt-${randomUUID()}`,
    teammateId: teammate.id,
    seq: eventSequence,
    at: now,
    actorUserId: "admin",
    actorName: "平台Admin",
    kind: "updated",
    message: `更新 SO0101 实例 SOUL：${change.role}`,
  };
  teammateStore.tables.events[event.id] = event;
  eventSequence += 1;
}

for (const assignment of Object.values(humanRoleAssignments)) {
  assignmentStore.tables.assignments[assignment.key].status = "assigned";
  assignmentStore.tables.assignments[assignment.key].updatedAt = now;
}

await writeFile(
  teammatePath,
  `${JSON.stringify(teammateStore, null, 2)}\n`,
  "utf8",
);
await writeFile(
  assignmentPath,
  `${JSON.stringify(assignmentStore, null, 2)}\n`,
  "utf8",
);
console.log(
  `已更新 ${changes.length} 个现有 AI伙伴实例，并确认 ${Object.keys(humanRoleAssignments).length} 个人工角色席位`,
);
