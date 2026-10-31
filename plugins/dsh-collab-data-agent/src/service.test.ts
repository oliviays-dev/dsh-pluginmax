import { describe, expect, it } from "vitest";
import { DataAgentService, type KvTableLike, type DataAgentTables } from "./service.js";
import type {
  DataAgentAttachment,
  DataAgentAuditEvent,
  DataAgentConversation,
  DataAgentHtmlArtifact,
  DataAgentMessage,
  DataAgentReport,
  DataAgentRun,
  DataAgentWorkspaceConfig,
} from "./models.js";

function memoryTable<V>(): KvTableLike<V> {
  const values = new Map<string, V>();
  return {
    get: (key) => values.get(key),
    entries: () => values.entries(),
    get size() {
      return values.size;
    },
    async put(key, value) {
      values.set(key, value);
    },
    async delete(key) {
      return values.delete(key);
    },
  };
}

let sequence = 0;

function tables(): DataAgentTables {
  return {
    workspaceConfigs: memoryTable<DataAgentWorkspaceConfig>(),
    conversations: memoryTable<DataAgentConversation>(),
    messages: memoryTable<DataAgentMessage>(),
    attachments: memoryTable<DataAgentAttachment>(),
    runs: memoryTable<DataAgentRun>(),
    reports: memoryTable<DataAgentReport>(),
    htmlArtifacts: memoryTable<DataAgentHtmlArtifact>(),
    audit: memoryTable<DataAgentAuditEvent>(),
  };
}

function service() {
  sequence = 0;
  return new DataAgentService(tables(), {
    now: () => new Date("2026-10-29T02:00:00.000Z"),
    id: () => `test-${++sequence}`,
  });
}

const actor = {
  userId: "olivia",
  name: "Olivia",
  role: "member" as const,
};

describe("DataAgentService", () => {
  it("completes a regular chat run without creating a report", async () => {
    const dataAgent = service();
    const conversation = await dataAgent.createConversation(actor, {
      workspaceId: "ws-main",
      page: "workbench",
      title: "指标原因",
    });
    await dataAgent.appendUserMessage(actor, {
      conversationId: conversation.id,
      content: "这个指标为什么下降？",
      selections: [],
    });
    const run = await dataAgent.createRun(actor, {
      conversationId: conversation.id,
      prompt: "这个指标为什么下降？",
      title: "指标原因",
      mode: "chat",
    });

    const completed = await dataAgent.completeChatRun({
      actor,
      runId: run.id,
      rawOutput: "因为交付延迟和库存结构变化共同影响了本期指标。",
    });

    expect(completed.run.status).toBe("succeeded");
    expect(completed.message).toMatchObject({
      senderType: "ai-partner",
      content: "因为交付延迟和库存结构变化共同影响了本期指标。",
    });
    expect(completed.message.reportId).toBeUndefined();
    expect(dataAgent.reportsForConversation(conversation.id)).toEqual([]);
  });

  it("persists selection snapshots and creates a Markdown report with images", async () => {
    const dataAgent = service();
    const conversation = await dataAgent.createConversation(actor, {
      workspaceId: "ws-main",
      projectId: "ws-main",
      page: "workbench",
      title: "OTIF 异常分析",
    });
    const appended = await dataAgent.appendUserMessage(actor, {
      conversationId: conversation.id,
      content: "请解释 OTIF 下降并给出证据。",
      selections: [
        {
          kind: "metric",
          entityType: "metric_card",
          entityId: "otif",
          title: "OTIF 93.7%",
          excerpt: "OTIF 环比下降 3.1pp",
          source: {
            workspaceId: "ws-main",
            projectId: "ws-main",
            page: "workbench",
            timeRange: {
              from: "2026-10-20T00:00:00.000Z",
              to: "2026-10-26T23:59:59.000Z",
            },
          },
          snapshot: {
            text: "OTIF 93.7%，环比 -3.1pp",
            componentSchemaVersion: "metric-card-v1",
          },
        },
      ],
    });
    expect(appended.attachments).toHaveLength(1);
    expect(appended.message.contextAttachmentIds).toEqual([
      appended.attachments[0]!.id,
    ]);

    const run = await dataAgent.createRun(actor, {
      conversationId: conversation.id,
      prompt: "分析",
      title: "OTIF 异常分析",
      runtimeProfileId: "drp-test",
    });
    const completed = await dataAgent.completeRun({
      actor,
      runId: run.id,
      rawOutput: [
        "# OTIF 异常归因",
        "",
        "OTIF 下降主要来自两个已授权的交付事件。",
        "",
        "| 对象 | 影响 |",
        "| --- | --- |",
        "| 供应商 G | -1.6pp |",
        "| 供应商 H | -1.1pp |",
      ].join("\n"),
      dataCutoffAt: "2026-10-29T02:00:00.000Z",
    });

    expect(completed.run.status).toBe("succeeded");
    expect(completed.report.images).toHaveLength(2);
    expect(completed.report.markdown).toContain(
      "![分析范围与证据覆盖](./assets/scope-and-evidence.svg)",
    );
    expect(completed.report.markdown).toContain("## 数据准备度");
    expect(completed.report.visibility).toBe("private");
    expect(completed.report.ownerType).toBe("user");
    expect(dataAgent.htmlForReport(completed.report.id)).toBeUndefined();
  });

  it("creates HTML only on explicit request and keeps report-version linkage", async () => {
    const dataAgent = service();
    const conversation = await dataAgent.createConversation(actor, {
      workspaceId: "ws-main",
      page: "task",
    });
    await dataAgent.appendUserMessage(actor, {
      conversationId: conversation.id,
      content: "分析",
      selections: [
        {
          kind: "record",
          entityType: "task",
          entityId: "task-1",
          title: "任务一",
          excerpt: "任务状态：进行中",
          source: { workspaceId: "ws-main", page: "task" },
        },
      ],
    });
    const run = await dataAgent.createRun(actor, {
      conversationId: conversation.id,
      prompt: "分析",
      title: "任务分析",
    });
    const completed = await dataAgent.completeRun({
      actor,
      runId: run.id,
      rawOutput: "# 报告\n\n结论内容",
      dataCutoffAt: "2026-10-29T02:00:00.000Z",
    });
    const html = await dataAgent.renderHtml(actor, completed.report.id);
    expect(html.reportVersion).toBe(completed.report.version);
    expect(html.content).toContain("<!doctype html>");
    expect(html.content).toContain("data:image/svg+xml;base64,");
    expect(dataAgent.htmlForReport(completed.report.id)?.id).toBe(html.id);
  });

  it("persists QueryRun evidence in chat and reports and derives HTML from the report snapshot", async () => {
    const dataAgent = service();
    const conversation = await dataAgent.createConversation(actor, {
      workspaceId: "ws-main",
      page: "workbench",
    });
    await dataAgent.appendUserMessage(actor, {
      conversationId: conversation.id,
      content: "今天有没有订单异常？",
      selections: [],
    });
    const evidence = [
      {
        queryRunId: "query-order-1",
        datasetId: "orders-facts",
        metricIds: ["order_exception_rate", "order_exception_count"],
        metricVersionSnapshot: {
          order_exception_rate: "orders-metric-v1",
          order_exception_count: "orders-metric-v1",
        },
        status: "succeeded" as const,
        rowCount: 1,
        scannedRows: 540,
        truncated: false,
        dataCutoffAt: "2026-10-29T01:55:00.000Z",
        permissionSummary:
          "workspaceRole:member · rowScope:region=east|south · policy:orders-policy-v1 · coverage:当前授权：华东、华南",
      },
    ];
    const chat = await dataAgent.createRun(actor, {
      conversationId: conversation.id,
      prompt: "今天有没有订单异常？",
      title: "订单异常",
      mode: "chat",
    });
    const chatResult = await dataAgent.completeChatRun({
      actor,
      runId: chat.id,
      rawOutput: "今天有订单异常。",
      queryEvidence: evidence,
    });
    expect(chatResult.message.content).toContain("QueryRun");
    expect(chatResult.message.content).toContain("query-order-1");
    expect(chatResult.message.content).toContain("当前授权");
    expect(chatResult.run.queryEvidence).toEqual(evidence);

    const reportRun = await dataAgent.createRun(actor, {
      conversationId: conversation.id,
      prompt: "生成订单异常正式报告",
      title: "订单异常报告",
      mode: "report",
    });
    const report = await dataAgent.completeRun({
      actor,
      runId: reportRun.id,
      rawOutput: "# 订单异常报告\n\n异常来自支付失败和履约超时。",
      dataCutoffAt: "2026-10-29T01:55:00.000Z",
      queryEvidence: evidence,
    });
    expect(report.report.queryEvidence).toEqual(evidence);
    expect(report.report.markdown).toContain("query-order-1");
    expect(report.report.markdown).toContain("orders-metric-v1");

    const html = await dataAgent.renderHtml(actor, report.report.id);
    expect(html.reportVersion).toBe(report.report.version);
    expect(html.content).toContain("query-order-1");
    expect(html.content).toContain("orders-metric-v1");
  });

  it("reset keeps connections and history while restoring defaults", async () => {
    const dataAgent = service();
    await dataAgent.saveConfig(actor, {
      workspaceId: "ws-main",
      dataConnectionIds: ["conn-readonly"],
      defaultProjectId: "ws-main",
      defaultTimeRange: "30d",
      preferredMetricIds: ["otif"],
      externalRuntimeId: "ext-codex",
    });
    const reset = await dataAgent.resetConfig(actor, "ws-main");
    expect(reset).toMatchObject({
      dataConnectionIds: ["conn-readonly"],
      externalRuntimeId: "ext-codex",
      defaultTimeRange: "7d",
      preferredMetricIds: [],
      revision: 3,
    });
    expect(
      [...(dataAgent as unknown as { tables: DataAgentTables }).tables.audit.entries()].some(
        ([, event]) => event.action === "data_agent.config.reset",
      ),
    ).toBe(true);
  });

  it("rejects cross-workspace attachments and keeps archives owner-scoped", async () => {
    const dataAgent = service();
    const conversation = await dataAgent.createConversation(actor, {
      workspaceId: "ws-main",
      page: "workbench",
    });
    await expect(
      dataAgent.appendUserMessage(actor, {
        conversationId: conversation.id,
        content: "分析",
        selections: [
          {
            kind: "text",
            title: "另一个工作区的文本",
            excerpt: "不可访问",
            source: { workspaceId: "ws-other", page: "workbench" },
          },
        ],
      }),
    ).rejects.toMatchObject({ code: "forbidden" });

    await expect(
      dataAgent.archiveConversation(
        { userId: "peter", name: "Peter", role: "member" },
        conversation.id,
      ),
    ).rejects.toMatchObject({ code: "forbidden" });
    const archived = await dataAgent.archiveConversation(actor, conversation.id);
    expect(archived.archivedAt).toBe("2026-10-29T02:00:00.000Z");
    expect(
      dataAgent.listConversations(actor, {
        workspaceId: "ws-main",
      }),
    ).toHaveLength(0);
  });
});
