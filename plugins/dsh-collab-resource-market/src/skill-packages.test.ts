import { readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = resolve(import.meta.dirname, "../../..");
const SKILLS_ROOT = resolve(ROOT, "docs/skills");

const packages = [
  {
    key: "work-report",
    name: "工作日报",
    trigger: "work-report",
  },
  {
    key: "competitive-analysis",
    name: "竞品分析",
    trigger: "competitive-analysis",
  },
] as const;

describe("manual skill packages", () => {
  for (const item of packages) {
    it(`${item.name} has valid source files and an install package`, () => {
      const directory = resolve(SKILLS_ROOT, item.key);
      const manifest = JSON.parse(
        readFileSync(resolve(directory, "skill.json"), "utf8"),
      ) as {
        schemaVersion: number;
        kind: string;
        name: string;
        version: string;
        publisherName: string;
        triggers: string[];
        permissions: string[];
        instructions: string;
      };
      const markdown = readFileSync(resolve(directory, "SKILL.md"), "utf8");
      const archive = resolve(
        SKILLS_ROOT,
        "packages",
        `${item.key}.skill.zip`,
      );

      expect(manifest).toMatchObject({
        schemaVersion: 1,
        kind: "agent-skill",
        name: item.name,
        version: "1.0.0",
        publisherName: "平台",
      });
      expect(manifest.triggers).toContain(item.trigger);
      expect(manifest.instructions).toContain(`# ${item.name}`);
      expect(markdown).toContain(`name: ${item.name}`);
      expect(markdown).toContain(`# ${item.name}`);
      expect(statSync(archive).size).toBeGreaterThan(0);
    });
  }
});
