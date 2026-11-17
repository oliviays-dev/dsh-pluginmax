import { describe, expect, it } from "vitest";
import { createTaskDispatcher } from "./index.js";
import type { TaskDispatchReadiness } from "./readiness-gate.js";
import type { TaskService } from "./service.js";
import type { TaskRecord } from "./types.js";

const actor = {
  id: "user-1",
  name: "用户一",
  kind: "human" as const,
  role: "member" as const,
};

function task(overrides: Partial<TaskRecord> = {}): TaskRecord {
  return {
    id: "TSK-planning",
    workspaceId: "workspace-1",
    title: "采购异常处置",
    type: "任务",
    status: "todo",
    priority: "P1",
    receiverType: "agent",
    receiverId: "agent-1",
    receiverName: "执行 Agent",
    createdBy: "user-1",
    createdByName: "用户一",
    description: "整理异常并形成处置计划",
    acceptance: ["覆盖责任人和下一步"],
    links: [],
    progress: 0,
    sessionEpoch: 0,
    autoSubmitReview: true,
    steps: [{ id: "step-1", label: "覆盖责任人和下一步", done: false }],
    agentRunIds: [],
    messages: [],
    comments: [],
    events: [],
    queueState: "idle",
    dependsOn: [],
    autoRunEligible: true,
    needsInput: false,
    createdAt: "2026-11-16T00:00:00.000Z",
    updatedAt: "2026-11-16T00:00:00.000Z",
    ...overrides,
  } as TaskRecord;
}

function dispatcher(readiness: TaskDispatchReadiness) {
  let failures = 0;
  const service = {
    attachAgentRun: async () => task(),
    failAgentDispatch: async () => {
      failures += 1;
      return task();
    },
  } as unknown as TaskService;
  return {
    dispatch: createTaskDispatcher({
      service,
      readiness: () => readiness,
    }),
    failures: () => failures,
  };
}

describe("task dispatch readiness gate", () => {
  it("returns deferred without mutating the task when planning blocks dispatch", async () => {
    const current = task();
    let seenRequestedBy = "";
    const harness = dispatcher({
      inspect: async (input) => {
        seenRequestedBy = input.requestedBy;
        return {
          ready: false,
          code: "planning-review-required",
          message: "计划等待人工审核",
          retryToken: "planning-run-1",
        };
      },
    });
    const result = await harness.dispatch(
      current,
      actor,
      undefined,
      undefined,
      "assignment",
    );
    expect(result.task).toBe(current);
    expect(result.execution).toEqual({
      status: "deferred",
      reason: "planning-review-required",
      message: "计划等待人工审核",
      retryToken: "planning-run-1",
    });
    expect(seenRequestedBy).toBe("assignment");
    expect(harness.failures()).toBe(0);
  });

  it("fails open to the existing dispatch path when the readiness hook throws", async () => {
    const harness = dispatcher({
      inspect: async () => {
        throw new Error("readiness unavailable");
      },
    });
    const result = await harness.dispatch(task(), actor);
    expect(result.execution).not.toMatchObject({ status: "deferred" });
    expect(harness.failures()).toBe(1);
  });
});
