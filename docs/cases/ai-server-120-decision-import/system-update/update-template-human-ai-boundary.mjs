#!/usr/bin/env node
import { copyFile, readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const defaultHome = resolve(here, "../../../../.tmp/dsh-home");
const dshHome = process.env.DSH_HOME?.trim() || defaultHome;
const teammatePath = join(dshHome, "storages", "collab_teammate.json");
const apply = process.argv.includes("--apply");
const templateIds = [
  "tpl-e119b5da-743b-4b81-8b14-97ee8467d4fa",
  "tpl-d4662f6c-1edf-4aaf-8db5-3daad01f9744",
  "tpl-2b809479-4ca8-4c1e-89c4-10cc858a70d0",
  "tpl-5d99d6ed-ee1b-48c5-ae53-dca24b43c0f7",
  "tpl-68c4cd13-0175-43f0-8995-90bcd6b91def",
];
const marker = "## 人机协作与外部沟通";
const section = `${marker}

- 你可以作为人类岗位伙伴执行 MCP 数据查询、校验、模拟、内部分析和草稿。
- 对外客户、供应商、承运商、合作方沟通，以及正式报价、交期、合同、赔偿、退款和交付承诺，必须由人类发起或明确确认。
- 不得直接发送外部消息、创建具有外部副作用的单据或代替人类审批。
- 可以在任务评论和会议中回复内部结论，但必须明确“内部建议”“草稿”或“待人工确认”。
- AI 可以主动帮助人类准备沟通材料，但不能冒充人类完成外部沟通。`;

const store = JSON.parse(await readFile(teammatePath, "utf8"));
const changes = [];
for (const templateId of templateIds) {
  const template = store.tables?.teammate_templates?.[templateId];
  if (template === undefined) {
    throw new Error(`找不到 AI伙伴模版: ${templateId}`);
  }
  if (template.soul.includes(marker)) continue;
  changes.push({
    templateId,
    name: template.name,
    version: template.version,
  });
}

console.log(
  JSON.stringify(
    {
      mode: apply ? "apply" : "dry-run",
      dshHome,
      changes,
    },
    null,
    2,
  ),
);

if (!apply || changes.length === 0) process.exit(0);

await copyFile(
  teammatePath,
  `${teammatePath}.bak-human-ai-boundary-${Date.now()}`,
);
const now = new Date().toISOString();
for (const change of changes) {
  const template = store.tables.teammate_templates[change.templateId];
  template.soul = `${template.soul.trim()}\n\n${section}\n`;
  const [major, minor] = template.version.slice(1).split(".").map(Number);
  template.version = `v${major}.${minor + 1}`;
  template.updatedAt = now;
}
await writeFile(
  teammatePath,
  `${JSON.stringify(store, null, 2)}\n`,
  "utf8",
);
console.log(`已更新 ${changes.length} 个通用岗位模版`);
