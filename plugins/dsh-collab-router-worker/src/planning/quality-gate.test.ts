import { describe, expect, it } from "vitest";
import { evaluatePlanningQuality } from "./quality-gate.js";

const graph = {
  nodes: [
    {
      id: "delivery",
      title: "完成交付",
      acceptance: ["覆盖责任人和下一步"],
      risk: "low" as const,
      humanGate: "none" as const,
      evidenceRequirements: ["交付文档"],
    },
  ],
};

const critic = {
  verdict: "pass" as const,
  score: 92,
  issues: [],
  acceptanceCoverage: [
    {
      criterion: "覆盖责任人和下一步",
      coveredByNodeIds: ["delivery"],
      evidenceRefs: [],
    },
  ],
};

describe("planning quality gate", () => {
  it("auto-approves only Agent-triggered low-risk plans that pass all gates", () => {
    expect(
      evaluatePlanningQuality({
        rootAcceptance: ["覆盖责任人和下一步"],
        graph,
        validatorErrors: [],
        critic,
        approval: "risk-based",
        triggerKind: "agent-assigned",
      }),
    ).toMatchObject({
      decision: "auto-approve",
      risk: "low",
      coverage: 1,
      reasons: [],
    });
  });

  it("requires review for manual, high-risk, incomplete, or unsafe plans", () => {
    expect(
      evaluatePlanningQuality({
        rootAcceptance: ["覆盖责任人和下一步"],
        graph,
        validatorErrors: [],
        critic,
        approval: "risk-based",
        triggerKind: "human-manual",
      }).decision,
    ).toBe("review-required");
    expect(
      evaluatePlanningQuality({
        rootAcceptance: ["覆盖责任人和下一步"],
        graph: {
          nodes: [{ ...graph.nodes[0]!, risk: "high" }],
        },
        validatorErrors: [],
        critic,
        approval: "auto",
        triggerKind: "agent-assigned",
      }).decision,
    ).toBe("review-required");
    expect(
      evaluatePlanningQuality({
        rootAcceptance: ["缺失的验收"],
        graph,
        validatorErrors: [],
        critic,
        approval: "auto",
        triggerKind: "agent-assigned",
      }).decision,
    ).toBe("review-required");
    expect(
      evaluatePlanningQuality({
        rootAcceptance: ["覆盖责任人和下一步"],
        graph: {
          nodes: [{ ...graph.nodes[0]!, evidenceRequirements: [] }],
        },
        validatorErrors: [],
        critic,
        approval: "auto",
        triggerKind: "agent-assigned",
      }).decision,
    ).toBe("review-required");
  });
});
