import { describe, expect, it } from "vitest";
import {
  rankCandidates,
  type DispatchTaskLike,
  type DispatchTeammateProfile,
} from "./service.js";

function task(overrides: Partial<DispatchTaskLike> = {}): DispatchTaskLike {
  return {
    id: "TSK-1",
    workspaceId: "SO0101",
    title: "供应商复期方案",
    type: "供应链分析",
    description: "核对供应商交期并给出风险判断",
    acceptance: ["给出交期结论"],
    status: "todo",
    priority: "P1",
    receiverType: "unassigned",
    queueState: "idle",
    ...overrides,
  };
}

function profile(
  overrides: Partial<DispatchTeammateProfile> = {},
): DispatchTeammateProfile {
  return {
    id: "agent-a2",
    kind: "agent",
    name: "供应链分析",
    role: "采购与履约",
    ownerName: "平台 Admin",
    ownerUserId: "admin",
    projectBound: true,
    available: true,
    skills: [
      {
        id: "skill-supplier-risk",
        name: "供应商交期风险评估",
        triggers: ["供应商", "交期"],
      },
    ],
    queue: { planned: 1, running: 0, review: 0, blocked: 0, needsInput: 0 },
    successRate: 96,
    ...overrides,
  };
}

describe("task dispatch candidate evaluation", () => {
  it("recommends an available project teammate with matching skill evidence", () => {
    const [candidate] = rankCandidates(task(), [profile()]);
    expect(candidate?.status).toBe("ready");
    expect(candidate?.score).toBeGreaterThan(60);
    expect(candidate?.matchedSkills).toContain("供应商交期风险评估");
    expect(candidate?.blockers).toEqual([]);
  });

  it("does not require skill evidence for human assignees", () => {
    const [candidate] = rankCandidates(task(), [
      profile({
        id: "user-zhangsan",
        kind: "human",
        name: "张三",
        role: "项目负责人 / 供应链分析",
        ownerName: "张三",
        skills: [],
      }),
    ]);
    expect(candidate?.kind).toBe("human");
    expect(candidate?.status).toBe("ready");
    expect(candidate?.risks).not.toContain("缺少可直接验证的 Skill 证据");
    expect(candidate?.matchedSkills).toEqual([]);
    expect(candidate?.signals.skillEvidence).toBe("not_applicable");
  });

  it("treats missing skill evidence as a risk rather than a hard blocker", () => {
    const [candidate] = rankCandidates(task(), [
      profile({
        skills: [{ id: "skill-report", name: "财务月报" }],
      }),
    ]);
    expect(candidate?.status).toBe("risk");
    expect(candidate?.risks).toContain("缺少可直接验证的 Skill 证据");
  });

  it("blocks candidates whose execution identity is unavailable", () => {
    const [candidate] = rankCandidates(task(), [
      profile({
        available: false,
        availabilityReason: "AI伙伴当前为「已暂停」",
      }),
    ]);
    expect(candidate?.status).toBe("blocker");
    expect(candidate?.blockers).toContain("AI伙伴当前为「已暂停」");
  });

  it("ranks lower queue load above a busier candidate", () => {
    const ranked = rankCandidates(task(), [
      profile({
        id: "busy",
        name: "忙碌伙伴",
        queue: { planned: 4, running: 1, review: 0, blocked: 1, needsInput: 0 },
      }),
      profile({
        id: "idle",
        name: "空闲伙伴",
        queue: { planned: 0, running: 0, review: 0, blocked: 0, needsInput: 0 },
      }),
    ]);
    expect(ranked[0]?.teammateId).toBe("idle");
  });

  it("blocks workflow tasks from direct queue dispatch", () => {
    const [candidate] = rankCandidates(task({ workflow: { id: "wf-1" } }), [
      profile(),
    ]);
    expect(candidate?.status).toBe("blocker");
    expect(candidate?.blockers).toContain("工作流任务由节点链路派发");
  });
});
