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
