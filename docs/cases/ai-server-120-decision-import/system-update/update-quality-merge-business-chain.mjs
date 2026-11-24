#!/usr/bin/env node
import { copyFile, readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const pluginRoot = resolve(here, "../../../..");
const dshHome =
  process.env.DSH_HOME?.trim() || join(pluginRoot, ".tmp", "dsh-home");
const workspaceId = "706e06a4-0cd4-4bdc-bbde-f9a5484e6e15";
const definitionId = "e1148087-8b34-4032-a643-7a171c555588";
const instanceId = "6bf6d595-d0ba-4e8b-8292-69437ed3d520";
const apply = process.argv.includes("--apply");

const chainPath = join(
  pluginRoot,
  "configs",
  "business-chains",
  "supply-chain-ai-server-demo.json",
);
const demoDataPath = join(
  pluginRoot,
  "configs",
  "demo-data",
  "supply-chain-ai-server-demo-data.json",
);
const workflowPath = join(dshHome, "storages", "collab_workflow.json");
const projectPath = join(dshHome, "storages", "collab_project.json");
const assignmentPath = join(dshHome, "storages", "collab_assignment.json");
const { parseDefinitionFixture } = await import(
  pathToFileURL(
    join(pluginRoot, "plugins", "dsh-collab-workflow", "lib", "index.js"),
  ).href
);

const chain = JSON.parse(await readFile(chainPath, "utf8"));
const demoData = JSON.parse(await readFile(demoDataPath, "utf8"));
const workflowStore = JSON.parse(await readFile(workflowPath, "utf8"));
const projectStore = JSON.parse(await readFile(projectPath, "utf8"));
const assignmentStore = JSON.parse(await readFile(assignmentPath, "utf8"));

function sourceMarkdown(config) {
  const businessChain = config.businessChain;
  const workflow = config.workflow;
  const lines = [
    `# 工作流：${workflow.name}`,
    "",
    "## 元信息",
    "",
    `- key: ${workflow.key}`,
    `- version: ${workflow.version}`,
    "- kind: business-chain",
    `- business-chain-template-id: ${businessChain.templateId}`,
    `- business-chain-key: ${businessChain.chainKey}`,
    `- business-chain-name: ${businessChain.displayName}`,
    `- project-type-codes: ${businessChain.projectTypeCodes.join(",")}`,
    `- business-chain-snapshot-policy: ${businessChain.snapshotPolicy}`,
    `- business-chain-allow-unbound: ${businessChain.allowUnboundExternalNodes}`,
    `- description: ${workflow.description}`,
    "",
    "## 节点",
    "",
  ];
  for (const node of workflow.nodes) {
    lines.push(
      `### ${node.name}`,
      "",
      `- id: ${node.id}`,
      `- type: ${node.type}`,
      "- executor: role:role-owner",
      `- stage-code: ${node.stageCode}`,
      `- sequence: ${node.sequence}`,
      `- summary-metric: ${node.summaryMetric}`,
      `- owner-role: ${node.ownerRole}`,
      `- owner-role-code: ${node.ownerRoleCode}`,
    );
    if (node.id === "assembly") {
      lines.push(
        "- description: 生产、成品检验和质量放行合并为同一业务节点。",
        "- approver: 角色:role-mwm6edxf",
        "- policy: any",
      );
    }
    const refs = new Map();
    for (const field of node.fields) {
      for (const binding of field.bindings) {
        refs.set(`${binding.system}|${binding.objectId}`, binding.system);
      }
    }
    for (const [key, system] of refs) {
      const [, objectId] = key.split("|");
      lines.push(`- external-ref: ${system}|object|${objectId}|true`);
    }
    for (const field of node.fields) {
      const first = field.bindings[0];
      lines.push(
        `- field: ${field.key}|${field.label}|${first.system}|${first.objectId}|${field.bindings
          .map((binding) => binding.path)
          .join(",")}`,
      );
    }
    lines.push("");
  }
  lines.push("## 连接", "");
  for (const edge of workflow.edges) {
    lines.push(`- ${edge.from} -> ${edge.to}`);
  }
  return lines.join("\n");
}

const sourceMd = sourceMarkdown(chain);
const parsed = parseDefinitionFixture(sourceMd);
if (parsed.errors.length > 0 || parsed.graph === undefined) {
  throw new Error(`业务链路解析失败: ${parsed.errors.join("; ")}`);
}

const existingDefinition = workflowStore.tables?.definitions?.[definitionId];
const existingInstance = workflowStore.tables?.instances?.[instanceId];
const project = projectStore.tables?.projects?.[workspaceId];
if (
  existingDefinition === undefined ||
  existingInstance === undefined ||
  project === undefined
) {
  throw new Error("找不到目标项目、工作流定义或工作流实例");
}

const assembly = parsed.graph.nodes.find((node) => node.id === "assembly");
if (assembly === undefined) throw new Error("合并后的 assembly 节点不存在");
assembly.approvers = [
  {
    kind: "role",
    id: "role-mwm6edxf",
    name: "Quality",
    roleCode: "GSC_QUALITY",
  },
];
assembly.reviewRequired = true;
assembly.approvalPolicy = "any";

const changedNodes = parsed.graph.nodes.map((node) => node.id);
const removedNodes = ["integration-test"].filter(
  (nodeId) => !changedNodes.includes(nodeId),
);
const alreadyMerged =
  existingDefinition.version === chain.workflow.version &&
  existingDefinition.graph?.nodes?.length === changedNodes.length &&
  !existingDefinition.graph.nodes.some(
    (node) => node.id === "integration-test",
  ) &&
  project.businessChainBinding?.workflowDefinitionVersion ===
    chain.workflow.version &&
  JSON.stringify(project.demoDataConfig?.data) === JSON.stringify(demoData);

const preview = {
  mode: apply ? "apply" : "dry-run",
  definitionId,
  fromVersion: existingDefinition.version,
  toVersion: chain.workflow.version,
  nodes: changedNodes,
  removedNodes,
  expectedNodeCount: changedNodes.length,
  qualityMergedInto: "assembly",
  alreadyMerged,
};
console.log(JSON.stringify(preview, null, 2));

if (!apply || alreadyMerged) process.exit(0);

const now = new Date().toISOString();
const stamp = `quality-merge-${Date.now()}`;
for (const path of [workflowPath, projectPath, assignmentPath]) {
  await copyFile(path, `${path}.bak-${stamp}`);
}

const definition = {
  ...existingDefinition,
  version: chain.workflow.version,
  name: parsed.graph.name,
  description: parsed.graph.description,
  businessChain: parsed.businessChain,
  sourceMd,
  graph: parsed.graph,
  status: "active",
  updatedAt: now,
};
workflowStore.tables.definitions[definitionId] = definition;

const instanceNodes = Object.fromEntries(
  parsed.graph.nodes.map((node) => [
    node.id,
    existingInstance.nodes[node.id] ?? {
      nodeId: node.id,
      status: "waiting",
      attempts: 0,
      assignedTo: node.executor.label ?? node.executor.id,
      approvals: {},
      deliverables: {},
      enteredAt: now,
      taskIds: [],
    },
  ]),
);
const assignmentBindings = Object.fromEntries(
  Object.entries(existingInstance.assignmentBindings ?? {}).filter(([nodeId]) =>
    changedNodes.includes(nodeId),
  ),
);
const assemblyCandidates =
  assignmentBindings.assembly?.candidatePool ??
  [
    {
      kind: "agent",
      id: "tm-b3993e32-8a70-4c6c-8468-ba407c6e1363",
      name: "制造专员 AI 伙伴",
    },
  ];
if (assignmentBindings.assembly !== undefined) {
  assignmentBindings.assembly.candidatePool = assemblyCandidates;
}

const roleSnapshot = existingInstance.roleSnapshot ?? {};
for (const [roleId, member] of [
  [
    "role-mwlknjee",
    { kind: "user", id: "admin" },
  ],
  [
    "role-mwlkpn4n",
    { kind: "user", id: "admin" },
  ],
]) {
  const role = roleSnapshot[roleId];
  if (role === undefined) continue;
  if (
    !role.members.some(
      (candidate) => candidate.kind === "user" && candidate.id === "admin",
    )
  ) {
    role.members.push(member);
  }
}

const approvalBindings = {
  ...(existingInstance.approvalBindings ?? {}),
  assembly: {
    nodeId: "assembly",
    source: [
      {
        kind: "role",
        id: "role-mwm6edxf",
        name: "Quality",
        roleCode: "GSC_QUALITY",
      },
    ],
    status: "resolved",
    approvers: [{ kind: "user", id: "admin", name: "平台Admin" }],
    resolvedBy: "admin",
    resolvedAt: now,
  },
};

workflowStore.tables.instances[instanceId] = {
  ...existingInstance,
  definitionVersion: chain.workflow.version,
  nodes: instanceNodes,
  assignmentBindings,
  approvalBindings,
  roleSnapshot,
  updatedAt: now,
};

const nextBinding = {
  ...project.businessChainBinding,
  workflowDefinitionVersion: chain.workflow.version,
  nodeBindings: parsed.graph.nodes.map((node) => ({
    nodeId: node.id,
    externalRefs: node.businessChain?.externalRefs ?? [],
  })),
  boundAt: now,
  boundBy: "admin",
};

projectStore.tables.projects[workspaceId] = {
  ...project,
  businessChainBinding: nextBinding,
  businessChainRevision: project.businessChainRevision + 1,
  businessChainValidatedAt: now,
  demoDataConfig: {
    ...(project.demoDataConfig ?? {}),
    fileName: "supply-chain-ai-server-demo-data.json",
    uploadedAt: now,
    uploadedBy: "admin",
    data: demoData,
  },
  updatedAt: now,
};

await writeFile(
  workflowPath,
  `${JSON.stringify(workflowStore, null, 2)}\n`,
  "utf8",
);
await writeFile(
  projectPath,
  `${JSON.stringify(projectStore, null, 2)}\n`,
  "utf8",
);

// Re-read the persisted records to catch accidental corruption before exit.
for (const path of [workflowPath, projectPath, assignmentPath]) {
  JSON.parse(await readFile(path, "utf8"));
}
console.log("已合并制造与质量节点，并更新项目业务链路和演示数据");
