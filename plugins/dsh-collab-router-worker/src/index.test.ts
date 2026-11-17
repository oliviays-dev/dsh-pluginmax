import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { routerWorkerDomainSpec } from "./models.js";

describe("Router / Worker add-on skeleton", () => {
  it("declares only plugin-owned tables", () => {
    expect(routerWorkerDomainSpec).toMatchObject({
      name: "collab_router_worker",
      version: 1,
      tables: {
        workspace_settings: expect.anything(),
        audit_events: expect.anything(),
        router_agents: expect.anything(),
        plans: expect.anything(),
        plan_versions: expect.anything(),
        node_states: expect.anything(),
        dispatch_bindings: expect.anything(),
        router_cycles: expect.anything(),
        final_drafts: expect.anything(),
      },
    });
    expect(Object.keys(routerWorkerDomainSpec.tables)).toHaveLength(9);
  });

  it("keeps timers and task listeners behind the gated runtime", () => {
    const source = readFileSync(
      resolve(import.meta.dirname, "index.ts"),
      "utf8",
    );
    expect(source).not.toContain("setInterval(");
    expect(source).not.toContain("setTimeout(");
    expect(source).not.toContain('ctx.on("collab/task-changed"');
    expect(source).toContain('child.on("collab/task-changed"');
    expect(source).toContain("syncPlanningRuntime()");
    expect(source).not.toContain("new PlanReconciler(plans).start()");
  });

  it("exposes Router draft submission without approval side effects", () => {
    const source = readFileSync(
      resolve(import.meta.dirname, "index.ts"),
      "utf8",
    );
    expect(source).toContain('name: "router_worker_submit_plan"');
    expect(source).toContain('name: "router_worker_submit_final_draft"');
    expect(source).toContain("plans.saveVersion(planActor");
    expect(source).toContain("plans.saveCreate(planActor");
    expect(source).toContain(
      "return cycles.start({",
    );
    expect(source).not.toContain(
      'Router 回合要求主任务负责人是 AI 伙伴',
    );
    expect(source).not.toContain("approve(planActor");
    expect(source).not.toContain("materialize(planActor");
  });

  it("keeps planning settings always available and runtime APIs gated", () => {
    const source = readFileSync(
      resolve(import.meta.dirname, "index.ts"),
      "utf8",
    );
    expect(source).toContain('name: "planning_submit_understanding"');
    expect(source).toContain('name: "planning_submit_plan"');
    expect(source).toContain('name: "planning_submit_critique"');
    expect(source).toContain('scope: "settings"');
    expect(source).toContain('scope: "runtime"');
    expect(source).toContain("enabledWorkspaceIds.length === 0");
    expect(source).toContain("ensureWorkspaceSystemAgent");
    expect(source).toContain('ctx.provide("collabPlanning", planning)');
    expect(source).not.toContain("planning.approve(");
    expect(source).not.toContain("planning.materialize(");
    expect(source).toContain("plans.approveByPolicy(");
  });
});
