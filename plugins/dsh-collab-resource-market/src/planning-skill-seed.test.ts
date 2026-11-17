import { describe, expect, it } from "vitest";
import {
  SKILLS,
  TASK_PLANNING_INSTRUCTIONS,
  type SkillAsset,
} from "./catalog.js";

describe("platform task planning skill seed", () => {
  it("publishes the required task-planning scene contract", () => {
    const skill = SKILLS.find(
      (candidate) => candidate.id === "skill-task-planning-core",
    ) as SkillAsset | undefined;
    expect(skill).toMatchObject({
      id: "skill-task-planning-core",
      name: "任务规划核心方法",
      version: "1.0.0",
      publisher: {
        id: "pluginmax",
        verified: true,
        kind: "official",
      },
      triggers: ["task-planning"],
    });
    expect(skill?.instructions).toBe(TASK_PLANNING_INSTRUCTIONS);
    expect(skill?.instructions).toContain("Requirement Brief");
    expect(skill?.instructions).toContain("Facts Ledger");
    expect(skill?.instructions).toContain("人工 Gate");
    expect(skill?.instructions).toContain("不能改变权限");
  });
});
