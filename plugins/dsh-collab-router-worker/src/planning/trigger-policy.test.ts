import { describe, expect, it } from "vitest";
import { automaticPlanningTrigger } from "./trigger-policy.js";

describe("automatic planning trigger", () => {
  it("maps Agent assignment and task spec changes to stable receipts", () => {
    const assigned = automaticPlanningTrigger({
      id: "task-1",
      title: "采购异常处置",
      description: "形成处置计划",
      acceptance: ["覆盖责任人和下一步"],
      priority: "P1",
      receiverType: "agent",
      receiverId: "agent-1",
      updatedAt: "2026-11-16T00:00:00.000Z",
      events: [{ kind: "assigned" }],
    });
    expect(assigned?.trigger).toEqual({
      kind: "agent-assigned",
      agentId: "agent-1",
    });
    expect(assigned?.eventKey).toContain("assigned");
    expect(assigned?.eventKey).toContain(assigned?.taskDefinitionDigest ?? "");

    const changed = automaticPlanningTrigger({
      id: "task-1",
      title: "采购异常处置",
      description: "形成处置计划并升级异常",
      acceptance: ["覆盖责任人和下一步"],
      priority: "P1",
      receiverType: "agent",
      receiverId: "agent-1",
      updatedAt: "2026-11-16T00:01:00.000Z",
      events: [{ kind: "updated" }],
    });
    expect(changed?.trigger).toEqual({
      kind: "task-spec-changed",
      field: "description",
    });
  });

  it("ignores human tasks, router-worker child tasks, and progress events", () => {
    const base = {
      id: "task-1",
      title: "任务",
      priority: "P2",
      receiverType: "human" as const,
      receiverId: "user-1",
      events: [{ kind: "assigned" }],
    };
    expect(automaticPlanningTrigger(base)).toBeUndefined();
    expect(
      automaticPlanningTrigger({
        ...base,
        receiverType: "agent",
        creationKey: "router-worker:plan:node:1",
      }),
    ).toBeUndefined();
    expect(
      automaticPlanningTrigger({
        ...base,
        receiverType: "agent",
        events: [{ kind: "message" }],
      }),
    ).toBeUndefined();
  });
});
