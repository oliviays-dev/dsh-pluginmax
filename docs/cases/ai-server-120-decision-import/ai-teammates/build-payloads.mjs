import { readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(import.meta.url));
const spec = JSON.parse(await readFile(join(root, "templates.json"), "utf8"));

if (!Array.isArray(spec.templates) || spec.templates.length !== 5) {
  throw new Error("templates.json 必须包含五个 AI 岗位模版");
}

const requiredFields = [
  "source",
  "name",
  "role",
  "description",
  "scenarios",
  "goals",
  "tools",
  "skillBindings",
  "extensionPolicy",
  "active",
];

const keys = new Set();
const templates = [];

for (const template of spec.templates) {
  if (!template.key || keys.has(template.key)) {
    throw new Error(`模版 key 缺失或重复: ${template.key ?? "<empty>"}`);
  }
  keys.add(template.key);

  for (const field of requiredFields) {
    if (!(field in template.body)) {
      throw new Error(`${template.key} 缺少字段: ${field}`);
    }
  }

  for (const field of ["scenarios", "goals", "tools"]) {
    const values = template.body[field];
    if (!Array.isArray(values) || values.length === 0) {
      throw new Error(`${template.key}.${field} 必须是非空数组`);
    }
    if (values.some((value) => typeof value !== "string" || !value.trim())) {
      throw new Error(`${template.key}.${field} 必须只包含非空字符串`);
    }
  }

  const soul = await readFile(join(root, template.soulFile), "utf8");
  if (!soul.trim()) {
    throw new Error(`${template.soulFile} 不能为空`);
  }

  templates.push({
    key: template.key,
    soulFile: template.soulFile,
    body: {
      ...template.body,
      soul,
    },
  });
}

await writeFile(
  join(root, "payloads.json"),
  `${JSON.stringify(
    {
      version: spec.version,
      domain: spec.domain,
      note: "body 可直接作为 AI 伙伴模版创建请求体。",
      templates,
    },
    null,
    2,
  )}\n`,
  "utf8",
);

console.log(`已生成 ${templates.length} 个 AI 伙伴模版请求体`);
