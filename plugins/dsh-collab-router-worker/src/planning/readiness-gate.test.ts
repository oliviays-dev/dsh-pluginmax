import { describe, expect, it } from "vitest";
import type { PlanningRun, PlanningSettings } from "./models.js";
import { PlanningDispatchReadinessGate } from "./readiness-gate.js";
import type { PlanningService } from "./service.js";

function settings(enabled = true): PlanningSettings {
  return {
    workspaceId: "ws-1",
    enabled,
    agentOwnerPolicy: {
      autoPlanOnAssignment: true,
      autoPlanOnSpecChange: true,
      requirePlanBeforeExecution: true,
      mode: "standard",
      approval: "risk-based",
    },
    humanOwner: {
      allowManualPlanning: true,
      defaultMode: "standard",
      alwaysRequireReview: true,
    },
    revision: 1,
    updatedBy: "admin",
    updatedAt: "2026-11-16T00:00:00.000Z",
  };
}

function run(status: PlanningRun["status"]): PlanningRun {
  return {
    id: "planning-run-1",
    workspaceId: "ws-1",
    rootTaskId: "task-1",
    taskRevision: "rev-1",
    trigger: { kind: "agent-assigned", agentId: "agent-1" },
    eventKey: "event-1",
    receiptId: "receipt-1",
    mode: "standard",
    status,
    revision: 1,
    createdAt: "2026-11-16T00:00:00.000Z",
    updatedAt: "2026-11-16T00:00:00.000Z",
  };
}

function gate(input: {
  readonly planStatus?:
    "proposed" | "approved" | "active" | "completed" | undefined;
  readonly activeRun?: PlanningRun | undefined;
  readonly enabled?: boolean | undefined;
}) {
  return new PlanningDispatchReadinessGate({
    settings: () => settings(input.enabled ?? true),
    planning: {
      activeRun: () => input.activeRun,
    } as unknown as PlanningService,
    plans: {
      findByRoot: () =>
        input.planStatus === undefined
          ? undefined
          : ({ status: input.planStatus } as never),
    },
  });
}

const task = {
  id: "task-1",
  workspaceId: "ws-1",
  title: "Agent 任务",
  priority: "P2" as const,
  receiverType: "agent" as const,
  receiverId: "agent-1",
};

describe("planning dispatch readiness", () => {
  it("blocks agent roots until a reviewable or approved plan exists", () => {
    expect(
      gate({}).inspect({
        task,
        workspaceId: "ws-1",
        requestedBy: "assignment",
      }),
    ).toMatchObject({ ready: false, code: "planning-required" });
    expect(
      gate({ activeRun: run("understanding") }).inspect({
        task,
        workspaceId: "ws-1",
        requestedBy: "manual",
      }),
    ).toMatchObject({ ready: false, code: "planning-running" });
    expect(
      gate({ planStatus: "proposed" }).inspect({
        task,
        workspaceId: "ws-1",
        requestedBy: "manual",
      }),
    ).toMatchObject({
      ready: false,
      code: "planning-review-required",
    });
    expect(
      gate({ planStatus: "approved" }).inspect({
        task,
        workspaceId: "ws-1",
        requestedBy: "queue",
      }),
    ).toEqual({ ready: true });
  });

  it("does not block human owners, planning-disabled workspaces, or materialized child tasks", () => {
    expect(
      gate({ enabled: false }).inspect({
        task,
        workspaceId: "ws-1",
        requestedBy: "assignment",
      }),
    ).toEqual({ ready: true });
    expect(
      gate({}).inspect({
        task: { ...task, receiverType: "human", receiverId: "user-1" },
        workspaceId: "ws-1",
        requestedBy: "assignment",
      }),
    ).toEqual({ ready: true });
    expect(
      gate({}).inspect({
        task: { ...task, creationKey: "router-worker:plan:node:1" },
        workspaceId: "ws-1",
        requestedBy: "manual",
      }),
    ).toEqual({ ready: true });
  });
});
