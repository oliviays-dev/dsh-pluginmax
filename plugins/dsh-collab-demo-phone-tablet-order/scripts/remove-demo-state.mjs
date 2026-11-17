#!/usr/bin/env node
import { readFile, rename, unlink, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";

const WORKSPACE_TITLE = "手机平板订单履约演示";
const MCP_IDS = new Set([
  "mcp-orders-phone-tablet-demo",
  "mcp-wms-phone-tablet-demo",
]);
const PROFILE_ITEM_PREFIX = "phone-tablet-order-v1:";
const AI_PARTNER_ID = "fulfillment-ai";
const AI_PARTNER_NAME = "履约 AI 伙伴";
const APPLY = process.argv.includes("--apply");
const DSH_HOME = resolve(
  process.env.DSH_HOME?.trim() ||
    join(process.cwd(), ".tmp", "dsh-home"),
);
const STORAGE_ROOT = join(DSH_HOME, "storages");
const RUNTIME_ROOT =
  process.env.PLUGINMAX_DEMO_RUNTIME_DIR?.trim() ||
  join(process.cwd(), ".tmp", "dsh-phone-tablet-demo");

const report = [];

async function readStorage(file) {
  try {
    return JSON.parse(await readFile(join(STORAGE_ROOT, file), "utf8"));
  } catch (cause) {
    if (cause?.code === "ENOENT") return undefined;
    throw new Error(`cannot read ${file}: ${cause.message}`, { cause });
  }
}

async function writeStorage(file, value) {
  const path = join(STORAGE_ROOT, file);
  const temporary = `${path}.demo-cleanup.tmp`;
  await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  await rename(temporary, path);
}

function table(storage, name) {
  const value = storage?.tables?.[name];
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value
    : undefined;
}

function removeWhere(record, predicate, label) {
  if (record === undefined) return 0;
  let count = 0;
  for (const [key, value] of Object.entries(record)) {
    if (!predicate(value, key)) continue;
    delete record[key];
    count += 1;
  }
  if (count > 0) report.push(`${label}: ${count}`);
  return count;
}

async function saveIfChanged(file, storage, changed) {
  if (!APPLY || changed === 0) return;
  await writeStorage(file, storage);
}

const workspaceStorage = await readStorage("workspace.json");
const workspaces = table(workspaceStorage, "workspaces") ?? {};
const demoWorkspaceIds = new Set(
  Object.entries(workspaces)
    .filter(([, workspace]) => workspace?.title?.trim() === WORKSPACE_TITLE)
    .map(([id]) => id),
);

const marketStorage = await readStorage("collab_resource_market.json");
const installs = table(marketStorage, "installs");
const installChanges = removeWhere(
  installs,
  (record) => MCP_IDS.has(record?.assetId),
  "Demo MCP install records",
);
await saveIfChanged(
  "collab_resource_market.json",
  marketStorage,
  installChanges,
);

const taskStorage = await readStorage("collab_task.json");
const tasks = table(taskStorage, "tasks");
const removedTaskIds = new Set(
  Object.entries(tasks ?? {})
    .filter(
      ([, task]) =>
        demoWorkspaceIds.has(task?.workspaceId),
    )
    .map(([id]) => id),
);
const taskChanges = removeWhere(
  tasks,
  (task) => demoWorkspaceIds.has(task?.workspaceId),
  "Demo workspace tasks",
);
await saveIfChanged("collab_task.json", taskStorage, taskChanges);

const teammateStorage = await readStorage("collab_teammate.json");
const teammates = table(teammateStorage, "teammates");
const teammateChanges = removeWhere(
  teammates,
  (teammate, key) =>
    key === AI_PARTNER_ID &&
    teammate?.source === "personal" &&
    teammate?.name === AI_PARTNER_NAME,
  "Demo fulfillment AI partner",
);
await saveIfChanged(
  "collab_teammate.json",
  teammateStorage,
  teammateChanges,
);

const orderStorage = await readStorage("collab_data_orders.json");
let orderChanges = 0;
for (const name of ["source_configs", "migrations"]) {
  orderChanges += removeWhere(
    table(orderStorage, name),
    (record) => demoWorkspaceIds.has(record?.workspaceId),
    `Demo order ${name}`,
  );
}
await saveIfChanged("collab_data_orders.json", orderStorage, orderChanges);

const fabricStorage = await readStorage("collab_data_fabric.json");
const queryRunIds = new Set(
  Object.entries(table(fabricStorage, "queryRuns") ?? {})
    .filter(([, run]) => demoWorkspaceIds.has(run?.workspaceId))
    .map(([id]) => id),
);
let fabricChanges = 0;
for (const name of ["connections", "datasets", "metrics", "policies", "skills"]) {
  fabricChanges += removeWhere(
    table(fabricStorage, name),
    (record) => demoWorkspaceIds.has(record?.workspaceId),
    `Demo data fabric ${name}`,
  );
}
fabricChanges += removeWhere(
  table(fabricStorage, "queryRuns"),
  (record) => demoWorkspaceIds.has(record?.workspaceId),
  "Demo query runs",
);
fabricChanges += removeWhere(
  table(fabricStorage, "queryResults"),
  (record) => queryRunIds.has(record?.queryRunId),
  "Demo query results",
);
await saveIfChanged("collab_data_fabric.json", fabricStorage, fabricChanges);

const workbenchStorage = await readStorage("collab_workbench.json");
const briefChanges = removeWhere(
  table(workbenchStorage, "brief_items"),
  (record, key) =>
    record?.itemId?.startsWith(PROFILE_ITEM_PREFIX) ||
    demoWorkspaceIds.has(record?.workspaceId) ||
    key.includes(PROFILE_ITEM_PREFIX),
  "Demo workbench profile brief items",
);
await saveIfChanged(
  "collab_workbench.json",
  workbenchStorage,
  briefChanges,
);

const demoReceiptPath = join(
  STORAGE_ROOT,
  "collab_demo_phone_tablet_order.json",
);
const runtimeFixturePaths = [
  join(RUNTIME_ROOT, "orders-fixture-runtime.json"),
  join(process.cwd(), ".tmp", "dsh-phone-tablet-demo-wms-state.json"),
];

if (APPLY) {
  for (const path of [demoReceiptPath, ...runtimeFixturePaths]) {
    await unlink(path).catch((cause) => {
      if (cause?.code !== "ENOENT") throw cause;
    });
  }
  report.push("Demo receipts, runtime fixture, and WMS state removed");
}

console.log(
  JSON.stringify(
    {
      mode: APPLY ? "apply" : "preview",
      dshHome: DSH_HOME,
      demoWorkspaceIds: [...demoWorkspaceIds],
      removedTaskIds: [...removedTaskIds],
      changes: report,
      next:
        APPLY
          ? [
              "remove dsh-collab-demo-phone-tablet-order from the profile",
              "unset PLUGINMAX_ENABLE_PHONE_TABLET_DEMO",
              "restart the host",
            ]
          : ["rerun with --apply to remove the listed Demo state"],
    },
    null,
    2,
  ),
);
