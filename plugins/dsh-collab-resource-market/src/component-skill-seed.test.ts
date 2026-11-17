import { describe, expect, it } from "vitest";
import { PROJECT_BRIEF_DIGEST_INSTRUCTIONS, SKILLS } from "./catalog.js";

describe("component-scoped skill seed", () => {
  it("declares the daily brief project-summary mount target", () => {
    const skill = SKILLS.find(
      (candidate) => candidate.id === "skill-daily-brief-project-digest",
    );
    expect(skill).toMatchObject({
      name: "每日简报项目概览",
      category: "AI办公",
      instructions: PROJECT_BRIEF_DIGEST_INSTRUCTIONS,
      mountTargets: [
        {
          type: "component-slot",
          componentId: "pluginmax.daily-brief",
          slotId: "project-summary",
        },
      ],
    });
    expect(skill?.instructions).toContain("必须严格输出三行");
    expect(skill?.instructions).toContain("阻断 > 未解除异常");
  });
});
