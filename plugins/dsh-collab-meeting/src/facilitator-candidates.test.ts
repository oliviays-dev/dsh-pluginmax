import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  createFacilitatorCandidateReader,
  registerFacilitatorCandidateTool,
} from "./index.js";

const generatedAt = "2026-10-31T02:00:00.000Z";

describe("Facilitator candidate reader", () => {
  it("keeps candidate generation in the Facilitator source boundary", () => {
    const source = readFileSync(
      resolve(import.meta.dirname, "./index.ts"),
      "utf8",
    );
    expect(source).toContain(
      "meeting.meetingAgentId ?? MEETING_FACILITATOR_TEAMMATE_ID",
    );
    expect(source).toContain("facilitatorBundle?.items.map");
    expect(source).toContain(
      "Structured Facilitator action items take priority",
    );
    expect(source).toContain('name: "meeting_action_items"');
  });

  it("reads structured action items from the latest successful Agent Run", async () => {
    const reader = createFacilitatorCandidateReader({
      meetings: {
        get: () => ({
          id: "meeting-1",
          workspaceId: "workspace-1",
        }),
      } as never,
      agents: () =>
        ({
          runs: () => [
            {
              id: "run-1",
              dispatchKey: "meeting-1:minutes:1",
              status: "succeeded",
              agentProfileId: "profile-facilitator",
              personaId: "persona-meeting-facilitator",
              endedAt: generatedAt,
              output: {
                summary: "minutes",
                actionItems: [
                  {
                    id: "item-1",
                    sourceItemKey: "message-1",
                    sourceMessageIds: ["message-1"],
                    title: "补齐发布风险清单",
                    description: "补齐风险负责人和关闭时间。",
                    priorityHint: "P1",
                    acceptanceHints: ["每条风险都有负责人"],
                    collaboratorHints: [],
                    evidenceRefs: ["message:1"],
                    confidence: "high",
                    sourceExcerpt: "周五前补齐风险清单",
                  },
                ],
              },
            },
          ],
        }) as never,
    });

    const result = await reader.latest({
      meetingId: "meeting-1",
      sourceMessageIds: ["message-1"],
    });

    expect(result).toMatchObject({
      meetingId: "meeting-1",
      agentRunId: "run-1",
      agentDefinitionId: "profile-facilitator",
      personaId: "persona-meeting-facilitator",
    });
    expect(result?.items).toHaveLength(1);
    expect(result?.items[0]).toMatchObject({
      title: "补齐发布风险清单",
      sourceItemKey: "message-1",
      priorityHint: "P1",
    });
  });

  it("publishes candidates through the platform meeting Agent tool", async () => {
    const bundles = new Map();
    const store = {
      get: (meetingId: string) => bundles.get(meetingId),
      put: (bundle: { meetingId: string }) =>
        bundles.set(bundle.meetingId, bundle),
    };
    let definition: {
      execute(
        args: unknown,
        exec: {
          signal: AbortSignal;
          callId: string;
          agent: { id: string };
        },
      ): Promise<string>;
    } | null = null;
    registerFacilitatorCandidateTool(
      {
        tools: {
          register: (value: unknown) => {
            definition = value as never;
            return value;
          },
        },
      } as never,
      {
        meetings: {
          get: () => ({
            id: "meeting-1",
            workspaceId: "workspace-1",
            title: "Q4 发布准备会",
          }),
        } as never,
        agents: () => undefined,
        store: store as never,
      },
    );
    expect(definition).not.toBeNull();
    const controller = new AbortController();
    const result = await definition!.execute(
      {
        meetingId: "meeting-1",
        items: [
          {
            sourceItemKey: "message-1",
            sourceMessageIds: ["message-1"],
            title: "补齐发布风险清单",
            description: "补齐风险负责人和关闭时间。",
            acceptanceHints: ["每条风险都有负责人"],
            collaboratorHints: [],
            evidenceRefs: ["message:1"],
            confidence: "high",
          },
        ],
      },
      {
        signal: controller.signal,
        callId: "call-1",
        agent: { id: "profile-facilitator" },
      },
    );
    expect(result).toContain("published 1 meeting action items");
    expect(store.get("meeting-1")).toMatchObject({
      meetingId: "meeting-1",
      agentRunId: "tool:call-1",
      agentDefinitionId: "profile-facilitator",
    });
  });

  it("returns no candidate when selection does not match the Agent output", async () => {
    const reader = createFacilitatorCandidateReader({
      meetings: {
        get: () => ({
          id: "meeting-1",
          workspaceId: "workspace-1",
        }),
      } as never,
      agents: () =>
        ({
          runs: () => [
            {
              id: "run-1",
              dispatchKey: "meeting-1:minutes:1",
              status: "succeeded",
              agentProfileId: "profile-facilitator",
              endedAt: generatedAt,
              output: {
                summary: "minutes",
                actionItems: [
                  {
                    id: "item-1",
                    sourceItemKey: "message-1",
                    sourceMessageIds: ["message-1"],
                    title: "补齐发布风险清单",
                    description: "补齐风险负责人和关闭时间。",
                    acceptanceHints: ["每条风险都有负责人"],
                    collaboratorHints: [],
                    evidenceRefs: [],
                    confidence: "high",
                  },
                ],
              },
            },
          ],
        }) as never,
    });

    await expect(
      reader.latest({
        meetingId: "meeting-1",
        sourceMessageIds: ["message-2"],
      }),
    ).resolves.toBeUndefined();
  });
});
