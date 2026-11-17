import { describe, expect, it } from "vitest";
import { buildPlanningContextPack } from "./context-builder.js";

describe("planning context builder", () => {
  it("uses the task scene, planner participant binding, and mode-policy skill sections", async () => {
    let prepared: Record<string, unknown> | undefined;
    const result = await buildPlanningContextPack({
      context: {
        prepare: async (input) => {
          prepared = input;
          return {
            id: "pack-planning",
            sessionBindingId: "task:task-1:planner:principal-1:g0",
            rendered: {
              systemText: "[platform-policy]\nplatform rules",
              userText: "task user context",
              flattenedPrompt: "prompt",
            },
            sections: [
              {
                type: "platform-policy",
                text: "platform rules",
              },
              {
                type: "mode-policy",
                text: "# 任务规划核心方法",
              },
              {
                type: "current-input",
                text: "understand the task",
              },
            ],
          };
        },
      },
      task: {
        id: "task-1",
        workspaceId: "ws-1",
        title: "采购异常处置",
        description: "整理异常并形成处置计划",
        acceptance: ["覆盖责任人和下一步"],
        priority: "P1",
        receiverType: "human",
        receiverId: "user-1",
        createdBy: "user-1",
      },
      runId: "planning-run-1",
      plannerPrincipalId: "principal-1",
      plannerProfileId: "profile-1",
      plannerTeammateId: "planner-1",
      actorPrincipalId: "user-1",
      mode: "standard",
      candidates: [
        {
          id: "user-2",
          name: "Ops",
          kind: "human",
          role: "owner",
          available: true,
        },
      ],
      skills: {
        teammateId: "planner-1",
        templateId: "sys-task-planner",
        policyVersion: "v1",
        effective: [
          {
            id: "skill-task-planning-core",
            name: "任务规划核心方法",
            version: "1.0.0",
            bindingSource: "platform",
            mode: "required",
            scenes: ["task-planning"],
            instructions: "# 任务规划核心方法",
            instructionsHash:
              "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
          },
        ],
        excluded: [],
      },
    });
    expect(prepared).toMatchObject({
      requestId: "planning:planning-run-1:understanding",
      scene: "task",
      objectId: "task-1",
      participantBindingId: "planner:principal-1",
      input: { type: "system-trigger" },
    });
    expect(
      (
        prepared?.supplementalSections as
          readonly { readonly type: string }[] | undefined
      )?.[0]?.type,
    ).toBe("mode-policy");
    expect(result.systemText).toContain("[mode-policy]");
    expect(result.systemText).toContain("任务规划核心方法");
    expect(result.instruction).not.toContain("[mode-policy]");
    expect(result.instruction).toContain("[current-input]");
  });
});
