import { describe, expect, it } from "vitest";
import { planningDomainSpec } from "./models.js";

describe("Planning domain", () => {
  it("uses an isolated versioned domain for planning-owned records", () => {
    expect(planningDomainSpec).toMatchObject({
      name: "collab_planning",
      version: 1,
      tables: {
        planning_settings: expect.anything(),
        planning_runs: expect.anything(),
        planning_trigger_receipts: expect.anything(),
        requirement_briefs: expect.anything(),
        facts_ledgers: expect.anything(),
        plan_critic_reports: expect.anything(),
        planning_skill_snapshots: expect.anything(),
        planning_knowledge_receipts: expect.anything(),
        planning_events: expect.anything(),
        planning_quality_metrics: expect.anything(),
      },
    });
    expect(Object.keys(planningDomainSpec.tables)).toHaveLength(10);
  });
});
