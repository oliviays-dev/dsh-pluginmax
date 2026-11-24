import { describe, expect, it } from "vitest";
import { buildRouterCyclePrompt } from "./router-prompt.js";

const rootTask = {
  id: "TSK-1",
  workspaceId: "workspace-1",
  title: "复杂交付任务",
  description: "完成方案、技术设计和验收材料。",
  acceptance: ["方案完整", "技术设计可执行"],
  priority: "P1" as const,
  receiverType: "human" as const,
  receiverId: "alice",
  receiverName: "Alice",
};

const base = {
  rootTask,
  kind: "plan" as const,
  trigger: "manual",
  routerAgentName: "通用任务 Router",
  candidates: [
    {
      id: "alice",
      name: "Alice",
      kind: "human" as const,
      available: true,
    },
    {
      id: "worker-1",
      name: "方案 Worker",
      kind: "agent" as const,
      available: true,
    },
  ],
  constraints: {
    maxNodes: 20,
    maxDepth: 8,
    maxFanOut: 8,
    maxConcurrency: 3,
  },
};

describe("Router cycle prompt", () => {
  it("contains the structured planning tool contract and worker catalog", () => {
    const prompt = buildRouterCyclePrompt(base);

    expect(prompt).toContain("router_worker_submit_plan");
    expect(prompt).toContain("所有节点必须属于同一个弱连通 DAG");
    expect(prompt).toContain("禁止孤立节点、独立决策门");
    expect(prompt).toContain("worker-1");
    expect(prompt).toContain('"dependencies"');
    expect(prompt).toContain("项目权限范围 ∩ 任务负责人权限范围");
    expect(prompt).toContain("主任务负责人不是 AI Agent");
  });

  it("uses owner handoff language for a final human-owned draft", () => {
    const prompt = buildRouterCyclePrompt({
      ...base,
      kind: "finalize",
    });

    expect(prompt).toContain("router_worker_submit_final_draft");
    expect(prompt).toContain("非约束性的交付草稿");
    expect(prompt).toContain("不要自动提交 Review");
    expect(prompt).not.toContain("主任务已提交最终人工验收");
  });

  it("allows Router-managed review submission for an agent owner", () => {
    const prompt = buildRouterCyclePrompt({
      ...base,
      rootTask: {
        ...rootTask,
        receiverType: "agent",
        receiverId: "agent-owner",
        receiverName: "Owner Agent",
      },
      kind: "finalize",
    });

    expect(prompt).toContain("主任务负责人是 AI Agent");
    expect(prompt).toContain("提交主任务人工 Review");
    expect(prompt).toContain("不能代替人类通过 Review");
  });
});
