import { describe, expect, it } from "vitest";
import { __test } from "./index.js";

const conversation = {
  id: "conversation-1",
  ownerType: "user" as const,
  ownerId: "user-1",
  ownerUserId: "user-1",
  workspaceId: "workspace-1",
  agentId: "data-agent" as const,
  title: "Data Agent 会话",
  visibility: "private" as const,
  sourcePage: "workbench" as const,
  createdAt: "2026-10-29T02:00:00.000Z",
  updatedAt: "2026-10-29T02:00:00.000Z",
};

const message = {
  id: "message-1",
  conversationId: conversation.id,
  senderType: "user" as const,
  senderId: "user-1",
  content: "分析原因",
  contextAttachmentIds: [],
  createdAt: "2026-10-29T02:00:00.000Z",
};

describe("Data Agent runtime intent", () => {
  it("keeps ordinary questions in chat mode", () => {
    expect(__test.requestsReport("分析一下原因")).toBe(false);
    expect(__test.requestsReport("这个指标为什么下降？")).toBe(false);
    expect(__test.requestsReport("不要生成报告，直接回答")).toBe(false);
  });

  it("enters report mode only for an explicit report request", () => {
    expect(__test.requestsReport("生成一份分析报告")).toBe(true);
    expect(__test.requestsReport("生成本周工作简报")).toBe(true);
    expect(__test.requestsReport("write a report about this")).toBe(true);
    expect(
      __test.requestsReport(
        "生成一份正式订单异常分析报告。不要重新查询；报告要包含 QueryRun 证据。",
      ),
    ).toBe(true);
  });

  it("uses the native clarification path in ordinary conversation", () => {
    const prompt = __test.selectionPrompt(conversation, message, [], [], "chat");
    expect(prompt).toContain("当前请求按常规对话处理，不要生成报告");
    expect(prompt).toContain("ask_user_question");
    expect(prompt).not.toContain("输出中文 Markdown 报告");
  });

  it("uses the report contract only in report mode", () => {
    const prompt = __test.selectionPrompt(
      conversation,
      { ...message, content: "生成分析报告" },
      [],
      [],
      "report",
    );
    expect(prompt).toContain("当前请求明确要求生成报告");
    expect(prompt).toContain("输出中文 Markdown 报告");
    expect(prompt).toContain("HTML 版本只能由用户后续显式请求");
  });

  it("materializes shared task identity, history index, and run evidence", async () => {
    const sections = await __test.sharedObjectSections({
      workspaceId: "workspace-1",
      actor: { userId: "user-1", name: "Olivia", role: "member" },
      query: "为什么 Agent Run 被中断",
      selections: [
        {
          kind: "record",
          entityType: "task",
          entityId: "TSK-1",
          title: "切西瓜 PRD",
          excerpt: "Agent Run 被中断",
          source: {
            workspaceId: "workspace-1",
            page: "workbench",
            entityRef: "/task/TSK-1",
          },
        },
      ],
      tasks: {
        list: () => [
          {
            id: "TSK-1",
            workspaceId: "workspace-1",
            title: "切西瓜 PRD",
            type: "任务",
            status: "todo",
            priority: "P1",
            description: "输出产品 PRD 与验收文档",
            acceptance: ["包含交付说明"],
            createdByName: "Olivia",
            updatedAt: "2026-10-29T12:00:00.000Z",
            receiverName: "Data Agent",
            agentRunIds: ["run-1"],
            links: [],
            messages: [
              {
                id: "message-1",
                at: "2026-10-29T12:01:00.000Z",
                authorName: "Data Agent",
                kind: "agent",
                state: "interrupted",
                content: "Agent Run 被中断",
              },
            ],
            comments: [
              {
                id: "comment-1",
                at: "2026-10-29T12:02:00.000Z",
                authorName: "Olivia",
                content: "需要定位中断阶段",
                isKeyConsensus: true,
                replies: [],
              },
            ],
          },
        ],
      },
      agents: {
        profiles: () => [],
        dispatch: async () => {
          throw new Error("not used");
        },
        runs: () => [
          {
            id: "run-1",
            status: "interrupted",
            error: "worker aborted",
            execution: { runtime: "codex" },
          },
        ],
      },
    });

    expect(sections).toHaveLength(1);
    expect(sections[0]?.text).toContain("taskId：TSK-1");
    expect(sections[0]?.text).toContain("messages：1");
    expect(sections[0]?.text).toContain("run-1 · interrupted · worker aborted");
    expect(sections[0]?.text).toContain("需要定位中断阶段");
    expect(sections[0]?.sourceRefs).toContainEqual({
      type: "task",
      id: "TSK-1",
      version: "2026-10-29T12:00:00.000Z",
    });
  });

  it("keeps text selections as text and resolves workflow nodes by workflow id", async () => {
    expect(
      __test.selectionSourceRef({
        kind: "text",
        title: "选中文本",
        excerpt: "一段文字",
        source: { workspaceId: "workspace-1", page: "workbench" },
        snapshot: { text: "一段文字" },
      }),
    ).toBeUndefined();

    expect(
      __test.selectionSourceRef({
        kind: "record",
        entityType: "workflow_node",
        entityId: "development",
        title: "开发",
        excerpt: "执行中",
        source: { workspaceId: "workspace-1", page: "workflow" },
        snapshot: {
          values: { workflowId: "workflow-1", nodeId: "development" },
        },
      }),
    ).toMatchObject({
      type: "workflow_node",
      id: "workflow-1:development",
    });
  });

  it("materializes workflow, workflow node, meeting, and metric card contexts", async () => {
    const workflow = {
      id: "workflow-1",
      workspaceId: "workspace-1",
      title: "发布流程",
      status: "running",
      currentNodeId: "development",
      updatedAt: "2026-10-29T12:00:00.000Z",
      nodes: {
        development: {
          status: "running",
          taskIds: ["TSK-1"],
          note: "等待开发交付",
        },
      },
    };
    const sections = await __test.sharedObjectSections({
      workspaceId: "workspace-1",
      actor: { userId: "user-1", name: "Olivia", role: "member" },
      query: "",
      selections: [
        {
          kind: "record",
          entityType: "workflow",
          entityId: "workflow-1",
          title: "发布流程",
          excerpt: "running",
          source: { workspaceId: "workspace-1", page: "workflow" },
        },
        {
          kind: "record",
          entityType: "workflow_node",
          entityId: "development",
          title: "开发",
          excerpt: "等待开发交付",
          source: { workspaceId: "workspace-1", page: "workflow" },
          snapshot: {
            values: {
              workflowId: "workflow-1",
              nodeId: "development",
            },
          },
        },
        {
          kind: "record",
          entityType: "meeting",
          entityId: "meeting-1",
          title: "周会",
          excerpt: "确认发布计划",
          source: { workspaceId: "workspace-1", page: "meeting" },
        },
        {
          kind: "metric",
          entityType: "metric_card",
          entityId: "otif",
          title: "OTIF",
          excerpt: "94.2%",
          source: { workspaceId: "workspace-1", page: "workbench" },
        },
      ],
      workflows: { instance: (id) => (id === "workflow-1" ? workflow : undefined) },
      meetings: {
        list: () => [
          {
            id: "meeting-1",
            workspaceId: "workspace-1",
            title: "周会",
            status: "closed",
            agenda: "确认发布计划",
            summary: "按计划发布",
            updatedAt: "2026-10-29T12:00:00.000Z",
          },
        ],
        transcript: () => [
          {
            id: "meeting-message-1",
            senderName: "Olivia",
            content: "先确认联调结果",
            createdAt: "2026-10-29T11:00:00.000Z",
          },
        ],
      },
      meetingMinutes: {
        activeVersion: () => ({
          id: "minutes-1",
          version: 2,
          content: "联调完成后再发布。",
          status: "confirmed",
        }),
      },
      workbench: {
        metricsModule: () => ({
          data: {
            items: [
              {
                id: "otif",
                label: "OTIF",
                value: "94.2",
                unit: "%",
                target: "95%",
                trend: "-0.8pt",
                source: "工作台指标快照",
              },
            ],
          },
        }),
      },
    });

    expect(sections).toHaveLength(4);
    expect(sections.map((item) => item.text).join("\n")).toContain(
      "### 节点索引",
    );
    expect(sections.map((item) => item.text).join("\n")).toContain("周会");
    expect(sections.map((item) => item.text).join("\n")).toContain(
      "metricId：otif",
    );
    expect(sections.map((item) => item.text).join("\n")).toContain(
      "### 当前分享节点：development",
    );
  });
});
