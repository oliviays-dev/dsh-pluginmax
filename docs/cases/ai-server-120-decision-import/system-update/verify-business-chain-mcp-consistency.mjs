#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const pluginRoot = resolve(here, "../../../..");
const dshHome =
  process.env.DSH_HOME?.trim() || join(pluginRoot, ".tmp", "dsh-home");
const workspaceId = "706e06a4-0cd4-4bdc-bbde-f9a5484e6e15";
const definitionId = "e1148087-8b34-4032-a643-7a171c555588";
const instanceId = "6bf6d595-d0ba-4e8b-8292-69437ed3d520";
const chain = JSON.parse(
  await readFile(
    join(pluginRoot, "configs", "business-chains", "supply-chain-ai-server-demo.json"),
    "utf8",
  ),
);
const demo = JSON.parse(
  await readFile(
    join(pluginRoot, "configs", "demo-data", "supply-chain-ai-server-demo-data.json"),
    "utf8",
  ),
);
const projectStore = JSON.parse(
  await readFile(join(dshHome, "storages", "collab_project.json"), "utf8"),
);
const workflowStore = JSON.parse(
  await readFile(join(dshHome, "storages", "collab_workflow.json"), "utf8"),
);

const sources = {
  OMS: {
    file: "docs/cases/ai-server-120-decision-import/mcp/01-oms-mock-mcp.md",
    objectId: "SO-AIS-120-20261119",
  },
  SRM: {
    file: "docs/cases/ai-server-120-decision-import/mcp/02-srm-mock-mcp.md",
    objectId: "GPU-MODULE-H",
  },
  "APS-PLANNING": {
    file: "docs/cases/ai-server-120-decision-import/mcp/03-aps-planning-mock-mcp.md",
    objectId: "SO-AIS-120",
  },
  MES: {
    file: "docs/cases/ai-server-120-decision-import/mcp/04-mes-mock-mcp.md",
    objectIds: ["LINE-AI-02", "BENCH-TEST-03"],
  },
  WMS: {
    file: "docs/cases/ai-server-120-decision-import/mcp/05-wms-logistics-mock-mcp.md",
    objectId: "OUT-AIS120-01",
  },
  QMS: {
    file: "docs/cases/ai-server-120-decision-import/mcp/06-qms-mock-mcp.md",
    objectId: "BENCH-TEST-03",
  },
};

function valueAt(source, path) {
  let current = source;
  for (const segment of path.split(".")) {
    if (Array.isArray(current)) {
      current = current[Number(segment)];
      continue;
    }
    if (current === null || typeof current !== "object") return undefined;
    current = current[segment];
  }
  return current;
}

const snapshots = {};
for (const [system, source] of Object.entries(sources)) {
  const markdown = await readFile(join(pluginRoot, source.file), "utf8");
  const match = /```json mock-mcp-snapshot\n([\s\S]*?)\n```/.exec(markdown);
  if (match === null) throw new Error(`${source.file} 缺少 mock-mcp-snapshot`);
  snapshots[system] = JSON.parse(match[1]).data;
}

const errors = [];
for (const node of chain.workflow.nodes) {
  const demoFields = demo.nodes[node.id]?.fields;
  if (demoFields === undefined) {
    errors.push(`${node.id}: demoData 缺少节点`);
    continue;
  }
  const expectedKeys = new Set(node.fields.map((field) => field.key));
  for (const field of node.fields) {
    if (!(field.key in demoFields)) {
      errors.push(`${node.id}.${field.key}: demoData 缺少字段`);
    }
    for (const binding of field.bindings) {
      const source = sources[binding.system];
      if (source === undefined) {
        errors.push(`${node.id}.${field.key}: 未注册来源 ${binding.system}`);
        continue;
      }
      const expectedObjectIds = source.objectIds ?? [source.objectId];
      if (!expectedObjectIds.includes(binding.objectId)) {
        errors.push(
          `${node.id}.${field.key}: objectId ${binding.objectId} 不在 ${expectedObjectIds.join(", ")}`,
        );
      }
      const value = valueAt(snapshots[binding.system], binding.path);
      if (value === undefined) {
        errors.push(
          `${node.id}.${field.key}: ${binding.system}.${binding.path} 在 MCP 快照中不存在`,
        );
      }
    }
  }
  for (const key of Object.keys(demoFields)) {
    if (!expectedKeys.has(key)) {
      errors.push(`${node.id}.${key}: demoData 存在链路未声明的字段`);
    }
  }
}

const project = projectStore.tables?.projects?.[workspaceId];
const definition = workflowStore.tables?.definitions?.[definitionId];
const instance = workflowStore.tables?.instances?.[instanceId];
if (project === undefined || definition === undefined || instance === undefined) {
  errors.push("系统存储中缺少项目、业务链路定义或实例");
} else {
  if (project.businessChainBinding?.workflowDefinitionVersion !== chain.workflow.version) {
    errors.push("项目绑定的业务链路版本未同步");
  }
  if (definition.version !== chain.workflow.version) {
    errors.push("工作流定义版本未同步");
  }
  if (Object.keys(instance.nodes ?? {}).length !== chain.workflow.nodes.length) {
    errors.push("工作流实例节点数与业务链路配置不一致");
  }
  if (JSON.stringify(project.demoDataConfig?.data) !== JSON.stringify(demo)) {
    errors.push("项目 demoData 配置与演示数据文件不一致");
  }
  for (const node of chain.workflow.nodes) {
    const storedNode = definition.graph?.nodes?.find(
      (candidate) => candidate.id === node.id,
    );
    if (storedNode === undefined) {
      errors.push(`系统链路缺少节点 ${node.id}`);
      continue;
    }
    const expectedFields = node.fields
      .map((field) => ({
        key: field.key,
        bindings: field.bindings.map((binding) => ({
          system: binding.system,
          objectId: binding.objectId,
          path: binding.path,
        })),
      }))
      .sort((left, right) => left.key.localeCompare(right.key));
    const storedFields = (storedNode.businessChain?.fields ?? [])
      .map((field) => ({
        key: field.key,
        bindings: field.bindings.map((binding) => ({
          system: binding.system,
          objectId: binding.objectId,
          path: binding.path,
        })),
      }))
      .sort((left, right) => left.key.localeCompare(right.key));
    if (JSON.stringify(storedFields) !== JSON.stringify(expectedFields)) {
      errors.push(`系统链路节点 ${node.id} 的字段绑定未同步`);
    }
  }
}

if (errors.length > 0) {
  console.error(errors.join("\n"));
  process.exit(1);
}
console.log(
  JSON.stringify(
    {
      ok: true,
      workflowVersion: chain.workflow.version,
      nodes: chain.workflow.nodes.map((node) => ({
        nodeId: node.id,
        fields: node.fields.map((field) => field.key),
        systems: [
          ...new Set(
            node.fields.flatMap((field) =>
              field.bindings.map((binding) => binding.system),
            ),
          ),
        ],
      })),
    },
    null,
    2,
  ),
);
