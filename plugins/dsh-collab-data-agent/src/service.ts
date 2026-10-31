import { randomUUID } from "node:crypto";
import {
  attachmentSchema,
  auditEventSchema,
  conversationSchema,
  DATA_AGENT_ID,
  dataAgentSelectionContextSchema,
  htmlArtifactSchema,
  messageSchema,
  reportSchema,
  runSchema,
  workspaceConfigSchema,
  type DataAgentAttachment,
  type DataAgentAuditEvent,
  type DataAgentConversation,
  type DataAgentHtmlArtifact,
  type DataAgentMessage,
  type DataAgentQueryEvidence,
  type DataAgentReport,
  type DataAgentReportImage,
  type DataAgentRun,
  type DataAgentSelectionContext,
  type DataAgentWorkspaceConfig,
} from "./models.js";

export interface KvTableLike<V> {
  get(key: string): V | undefined;
  entries(): IterableIterator<[string, V]>;
  readonly size: number;
  put(key: string, value: V): Promise<void>;
  delete?(key: string): Promise<boolean>;
}

export interface DataAgentTables {
  readonly workspaceConfigs: KvTableLike<DataAgentWorkspaceConfig>;
  readonly conversations: KvTableLike<DataAgentConversation>;
  readonly messages: KvTableLike<DataAgentMessage>;
  readonly attachments: KvTableLike<DataAgentAttachment>;
  readonly runs: KvTableLike<DataAgentRun>;
  readonly reports: KvTableLike<DataAgentReport>;
  readonly htmlArtifacts: KvTableLike<DataAgentHtmlArtifact>;
  readonly audit: KvTableLike<DataAgentAuditEvent>;
}

export interface DataAgentActor {
  readonly userId: string;
  readonly name: string;
  readonly role: "admin" | "owner" | "member" | "guest";
}

export interface DataAgentAccess {
  readonly canReadWorkspace: boolean;
  readonly canManageWorkspace: boolean;
}

export class DataAgentError extends Error {
  constructor(
    readonly code:
      | "invalid_input"
      | "unauthorized"
      | "forbidden"
      | "system_agent_protected"
      | "not_found"
      | "conflict"
      | "unavailable",
    message: string,
  ) {
    super(message);
    this.name = "DataAgentError";
  }
}

function values<V>(table: KvTableLike<V>): V[] {
  return [...table.entries()].map(([, value]) => value);
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function svgText(value: string, max = 74): string {
  const normalized = value.replace(/\s+/g, " ").trim();
  return escapeHtml(
    normalized.length <= max ? normalized : `${normalized.slice(0, max - 1)}…`,
  );
}

function wrapSvg(body: string, height = 240): string {
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="960" height="${height}" viewBox="0 0 960 ${height}" role="img">`,
    `<rect width="960" height="${height}" rx="12" fill="#f5f7fb"/>`,
    body,
    "</svg>",
  ].join("");
}

function scopeEvidenceSvg(input: {
  readonly title: string;
  readonly page: string;
  readonly workspaceId: string;
  readonly cutoffAt: string;
  readonly attachmentCount: number;
  readonly sourceRefs: readonly string[];
}): string {
  const sources = input.sourceRefs.slice(0, 4);
  return wrapSvg(
    [
      `<text x="32" y="46" fill="#1e293b" font-family="PingFang SC, sans-serif" font-size="22" font-weight="700">${svgText(input.title, 52)}</text>`,
      `<text x="32" y="78" fill="#64748b" font-family="PingFang SC, sans-serif" font-size="13">页面 ${svgText(input.page, 24)} · 工作区 ${svgText(input.workspaceId, 32)} · 数据截止 ${svgText(input.cutoffAt, 32)}</text>`,
      `<rect x="32" y="108" width="214" height="92" rx="8" fill="#ffffff" stroke="#dbe3ef"/>`,
      `<text x="50" y="138" fill="#64748b" font-family="PingFang SC, sans-serif" font-size="12">上下文附件</text>`,
      `<text x="50" y="178" fill="#1e293b" font-family="PingFang SC, sans-serif" font-size="30" font-weight="700">${input.attachmentCount}</text>`,
      `<rect x="262" y="108" width="666" height="92" rx="8" fill="#ffffff" stroke="#dbe3ef"/>`,
      `<text x="280" y="136" fill="#64748b" font-family="PingFang SC, sans-serif" font-size="12">证据来源</text>`,
      ...sources.map(
        (source, index) =>
          `<text x="280" y="${160 + index * 18}" fill="#334155" font-family="PingFang SC, sans-serif" font-size="12">• ${svgText(source, 72)}</text>`,
      ),
    ].join(""),
  );
}

function evidenceMapSvg(input: {
  readonly title: string;
  readonly attachmentCount: number;
  readonly entityTypes: readonly string[];
  readonly textLength: number;
}): string {
  const types =
    input.entityTypes.length === 0 ? ["页面选区"] : input.entityTypes.slice(0, 5);
  return wrapSvg(
    [
      `<text x="32" y="46" fill="#1e293b" font-family="PingFang SC, sans-serif" font-size="20" font-weight="700">证据覆盖</text>`,
      `<text x="32" y="72" fill="#64748b" font-family="PingFang SC, sans-serif" font-size="12">${svgText(input.title, 64)}</text>`,
      ...types.map((type, index) => {
        const y = 108 + index * 30;
        const width = Math.max(80, Math.min(520, 160 + type.length * 18));
        return [
          `<rect x="32" y="${y}" width="${width}" height="20" rx="5" fill="${index % 2 === 0 ? "#dbeafe" : "#ede9fe"}"/>`,
          `<text x="44" y="${y + 15}" fill="#334155" font-family="PingFang SC, sans-serif" font-size="11">${svgText(type, 32)}</text>`,
        ].join("");
      }),
      `<text x="620" y="128" fill="#64748b" font-family="PingFang SC, sans-serif" font-size="12">附件 ${input.attachmentCount} 项</text>`,
      `<text x="620" y="154" fill="#64748b" font-family="PingFang SC, sans-serif" font-size="12">文本快照 ${input.textLength} 字</text>`,
      `<text x="620" y="180" fill="#64748b" font-family="PingFang SC, sans-serif" font-size="12">仅含授权范围快照</text>`,
    ].join(""),
  );
}

function reportTitle(markdown: string, fallback: string): string {
  const heading = /^#\s+(.+)$/m.exec(markdown);
  return heading?.[1]?.trim().slice(0, 200) || fallback.slice(0, 200);
}

function reportSummary(markdown: string): string {
  const paragraphs = markdown
    .split(/\n{2,}/)
    .map((item) => item.replace(/^#{1,6}\s+/gm, "").trim())
    .filter((item) => item !== "" && !item.startsWith("!["));
  return (paragraphs[0] ?? "报告已生成，请浏览正文与证据链。").slice(0, 600);
}

function dataEvidenceMarkdown(
  evidence: readonly DataAgentQueryEvidence[],
): string[] {
  if (evidence.length === 0) return [];
  return [
    "## 数据范围与查询证据",
    ...evidence.map((item) =>
      [
        `- QueryRun：\`${item.queryRunId}\``,
        `  - 数据集：\`${item.datasetId}\``,
        `  - 指标与版本：${item.metricIds
          .map(
            (metricId) =>
              `\`${metricId}@${item.metricVersionSnapshot[metricId] ?? "unknown"}\``,
          )
          .join("、")}`,
        `  - 数据截止：${item.dataCutoffAt ?? "未返回"}`,
        `  - 权限覆盖：${item.permissionSummary ?? "未返回"}`,
        `  - 结果：${item.status} · ${item.rowCount ?? 0} 行返回 · ${item.scannedRows ?? 0} 行扫描${item.truncated === true ? " · 已截断" : ""}`,
      ].join("\n"),
    ),
  ];
}

function contractMarkdown(input: {
  readonly title: string;
  readonly markdown: string;
  readonly context: readonly DataAgentSelectionContext[];
  readonly cutoffAt: string;
  readonly reportId: string;
  readonly queryEvidence?: readonly DataAgentQueryEvidence[] | undefined;
}): string {
  const refs = input.context.map((item, index) => {
    const entity =
      item.entityType === undefined || item.entityId === undefined
        ? item.kind
        : `${item.entityType}:${item.entityId}`;
    return `${index + 1}. ${item.title} · ${entity}`;
  });
  const modelBody = input.markdown.trim();
  return [
    `# ${input.title}`,
    "",
    `> 数据截止：${input.cutoffAt} · 报告版本：${input.reportId}`,
    "",
    "## 结论",
    reportSummary(modelBody),
    "",
    "## 分析范围与口径",
    `- 工作区：${input.context[0]?.source.workspaceId ?? "当前工作区"}`,
    `- 页面：${input.context[0]?.source.page ?? "workbench"}`,
    `- 项目：${input.context[0]?.source.projectId ?? "未指定"}`,
    "- 口径：以当前选区和已授权数据源返回的口径为准；未返回的口径不会自行补造。",
    ...dataEvidenceMarkdown(input.queryEvidence ?? []),
    "",
    "## 主要证据",
    ...(refs.length === 0 ? ["- 当前请求未附带结构化选区。"] : refs.map((ref) => `- ${ref}`)),
    "",
    `![分析范围与证据覆盖](./assets/scope-and-evidence.svg)`,
    "",
    `![证据覆盖](./assets/evidence-map.svg)`,
    "",
    "## 分析正文",
    modelBody,
    "",
    "## 不确定性",
    "- 本报告只使用当前账号、工作区和项目范围内可见的数据与选区快照。",
    "- 数据源缺失、超时或字段不可用时，结论仅覆盖成功读取的部分。",
    "",
    "## 数据准备度",
    "- 当前选区与 Runtime Profile 允许的数据连接构成本次分析范围；未接入的字段不会补造。",
    "- 如出现字段缺失、事件未埋点或数据过期，请将本段转为数据治理任务并人工确认责任人。",
    "",
    "## 建议下一步",
    "- 对关键结论复核业务口径与数据截止时间。",
    "- 如需写入、外发或指派，请通过动作票据或人工确认流程发起。",
  ].join("\n");
}

function markdownToSafeHtml(
  markdown: string,
  images: readonly DataAgentReportImage[],
): string {
  const imageMap = new Map(
    images.map((image) => [
      `./assets/${image.name}`,
      `data:${image.mediaType};base64,${Buffer.from(image.content).toString("base64")}`,
    ]),
  );
  const lines = markdown.replace(/\r/g, "").split("\n");
  const html: string[] = [];
  let list: "ul" | "ol" | undefined;
  let code: string[] | undefined;
  const closeList = (): void => {
    if (list !== undefined) html.push(`</${list}>`);
    list = undefined;
  };
  const inline = (source: string): string =>
    escapeHtml(source)
      .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (_match, alt, src) => {
        const value = imageMap.get(String(src));
        return value === undefined
          ? `<span>${escapeHtml(String(alt))}</span>`
          : `<img src="${value}" alt="${escapeHtml(String(alt))}" style="max-width:100%;height:auto;border:1px solid #dbe3ef;border-radius:8px"/>`;
      })
      .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
      .replace(/`([^`]+)`/g, "<code>$1</code>");
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] ?? "";
    if (line.trim().startsWith("```")) {
      closeList();
      if (code === undefined) {
        code = [];
      } else {
        html.push(`<pre><code>${escapeHtml(code.join("\n"))}</code></pre>`);
        code = undefined;
      }
      continue;
    }
    if (code !== undefined) {
      code.push(line);
      continue;
    }
    const heading = /^(#{1,6})\s+(.*)$/.exec(line);
    if (heading !== null) {
      closeList();
      const level = heading[1]!.length;
      html.push(`<h${level}>${inline(heading[2] ?? "")}</h${level}>`);
      continue;
    }
    const unordered = /^\s*[-*+]\s+(.*)$/.exec(line);
    if (unordered !== null) {
      if (list !== "ul") {
        closeList();
        html.push("<ul>");
        list = "ul";
      }
      html.push(`<li>${inline(unordered[1] ?? "")}</li>`);
      continue;
    }
    const ordered = /^\s*\d+[.)]\s+(.*)$/.exec(line);
    if (ordered !== null) {
      if (list !== "ol") {
        closeList();
        html.push("<ol>");
        list = "ol";
      }
      html.push(`<li>${inline(ordered[1] ?? "")}</li>`);
      continue;
    }
    if (/^\s*\|/.test(line) && /^\s*\|?\s*:?-{2,}/.test(lines[index + 1] ?? "")) {
      closeList();
      const cells = (value: string) =>
        value
          .trim()
          .replace(/^\|/, "")
          .replace(/\|$/, "")
          .split("|")
          .map((cell) => cell.trim());
      const header = cells(line);
      html.push("<table><thead><tr>");
      for (const cell of header) html.push(`<th>${inline(cell)}</th>`);
      html.push("</tr></thead><tbody>");
      index += 2;
      while (index < lines.length && /^\s*\|/.test(lines[index] ?? "")) {
        html.push("<tr>");
        for (const cell of cells(lines[index] ?? "")) {
          html.push(`<td>${inline(cell)}</td>`);
        }
        html.push("</tr>");
        index += 1;
      }
      index -= 1;
      html.push("</tbody></table>");
      continue;
    }
    if (line.trim() === "") {
      closeList();
      continue;
    }
    closeList();
    html.push(`<p>${inline(line)}</p>`);
  }
  closeList();
  if (code !== undefined) {
    html.push(`<pre><code>${escapeHtml(code.join("\n"))}</code></pre>`);
  }
  return html.join("\n");
}

export class DataAgentService {
  constructor(
    private readonly tables: DataAgentTables,
    private readonly options: {
      readonly now?: () => Date;
      readonly id?: () => string;
    } = {},
  ) {}

  private now(): string {
    return (this.options.now?.() ?? new Date()).toISOString();
  }

  private id(prefix: string): string {
    return `${prefix}-${this.options.id?.() ?? randomUUID()}`;
  }

  private async audit(input: {
    readonly actor: DataAgentActor;
    readonly action: string;
    readonly workspaceId?: string | undefined;
    readonly conversationId?: string | undefined;
    readonly runId?: string | undefined;
    readonly reportId?: string | undefined;
    readonly result?: "ok" | "failed" | undefined;
    readonly detail?: Record<string, string> | undefined;
  }): Promise<void> {
    const event = auditEventSchema.parse({
      id: this.id("da-audit"),
      actorUserId: input.actor.userId,
      action: input.action,
      result: input.result ?? "ok",
      ...(input.workspaceId === undefined
        ? {}
        : { workspaceId: input.workspaceId }),
      ...(input.conversationId === undefined
        ? {}
        : { conversationId: input.conversationId }),
      ...(input.runId === undefined ? {} : { runId: input.runId }),
      ...(input.reportId === undefined ? {} : { reportId: input.reportId }),
      detail: input.detail ?? {},
      createdAt: this.now(),
    });
    await this.tables.audit.put(event.id, event);
  }

  config(workspaceId: string): DataAgentWorkspaceConfig {
    return (
      this.tables.workspaceConfigs.get(workspaceId) ??
      workspaceConfigSchema.parse({
        workspaceId,
        teammateId: DATA_AGENT_ID,
        dataConnectionIds: [],
        defaultTimeRange: "7d",
        timezone: "Asia/Shanghai",
        clarificationMode: "hybrid",
        maxRowsPerQuery: 500,
        queryTimeoutMs: 15_000,
        preferredMetricIds: [],
        insightSubscriptions: [],
        reportSubscriptions: [],
        revision: 1,
        updatedAt: this.now(),
        updatedBy: "platform",
      })
    );
  }

  async saveConfig(
    actor: DataAgentActor,
    input: {
      readonly workspaceId: string;
      readonly dataConnectionIds?: readonly string[] | undefined;
      readonly defaultProjectId?: string | null | undefined;
      readonly defaultTimeRange?:
        | "today"
        | "7d"
        | "30d"
        | "month"
        | undefined;
      readonly timezone?: string | undefined;
      readonly clarificationMode?:
        | "hybrid"
        | "always-ask"
        | "default-first"
        | undefined;
      readonly maxRowsPerQuery?: number | undefined;
      readonly queryTimeoutMs?: number | undefined;
      readonly preferredMetricIds?: readonly string[] | undefined;
      readonly externalRuntimeId?: string | null | undefined;
    },
  ): Promise<DataAgentWorkspaceConfig> {
    const current = this.config(input.workspaceId);
    const next = workspaceConfigSchema.parse({
      ...current,
      dataConnectionIds:
        input.dataConnectionIds === undefined
          ? current.dataConnectionIds
          : [...new Set(input.dataConnectionIds)],
      ...(input.defaultProjectId === null
        ? { defaultProjectId: undefined }
        : input.defaultProjectId === undefined
          ? current.defaultProjectId === undefined
            ? {}
            : { defaultProjectId: current.defaultProjectId }
          : { defaultProjectId: input.defaultProjectId }),
      defaultTimeRange: input.defaultTimeRange ?? current.defaultTimeRange,
      timezone: input.timezone?.trim() || current.timezone,
      clarificationMode:
        input.clarificationMode ?? current.clarificationMode,
      maxRowsPerQuery:
        input.maxRowsPerQuery ?? current.maxRowsPerQuery,
      queryTimeoutMs: input.queryTimeoutMs ?? current.queryTimeoutMs,
      preferredMetricIds:
        input.preferredMetricIds === undefined
          ? current.preferredMetricIds
          : [...new Set(input.preferredMetricIds)],
      ...(input.externalRuntimeId === null
        ? { externalRuntimeId: undefined }
        : input.externalRuntimeId === undefined
          ? current.externalRuntimeId === undefined
            ? {}
            : { externalRuntimeId: current.externalRuntimeId }
          : { externalRuntimeId: input.externalRuntimeId }),
      revision: current.revision + 1,
      updatedAt: this.now(),
      updatedBy: actor.userId,
    });
    await this.tables.workspaceConfigs.put(input.workspaceId, next);
    await this.audit({
      actor,
      action: "data_agent.config.updated",
      workspaceId: input.workspaceId,
      detail: { revision: String(next.revision) },
    });
    return next;
  }

  async resetConfig(
    actor: DataAgentActor,
    workspaceId: string,
  ): Promise<DataAgentWorkspaceConfig> {
    const current = this.config(workspaceId);
    const next = workspaceConfigSchema.parse({
      workspaceId,
      teammateId: DATA_AGENT_ID,
      dataConnectionIds: current.dataConnectionIds,
      defaultTimeRange: "7d",
      timezone: "Asia/Shanghai",
      clarificationMode: "hybrid",
      maxRowsPerQuery: 500,
      queryTimeoutMs: 15_000,
      preferredMetricIds: [],
      insightSubscriptions: [],
      reportSubscriptions: [],
      ...(current.externalRuntimeId === undefined
        ? {}
        : { externalRuntimeId: current.externalRuntimeId }),
      revision: current.revision + 1,
      updatedAt: this.now(),
      updatedBy: actor.userId,
    });
    await this.tables.workspaceConfigs.put(workspaceId, next);
    await this.audit({
      actor,
      action: "data_agent.config.reset",
      workspaceId,
      detail: {
        preservedConnections: String(current.dataConnectionIds.length),
        revision: String(next.revision),
      },
    });
    return next;
  }

  async createConversation(
    actor: DataAgentActor,
    input: {
      readonly workspaceId: string;
      readonly projectId?: string | undefined;
      readonly meetingId?: string | undefined;
      readonly page: "workbench" | "task" | "meeting" | "project" | "workflow";
      readonly title?: string | undefined;
      readonly visibility?: "private" | "project" | "meeting" | undefined;
      readonly timeRange?: { from: string; to: string } | undefined;
    },
  ): Promise<DataAgentConversation> {
    const timestamp = this.now();
    const visibility =
      input.visibility ??
      (input.meetingId === undefined
        ? input.projectId === undefined
          ? "private"
          : "private"
        : "private");
    const conversation = conversationSchema.parse({
      id: this.id("da-conv"),
      ownerType: "user",
      ownerId: actor.userId,
      ownerUserId: actor.userId,
      workspaceId: input.workspaceId,
      ...(input.projectId === undefined ? {} : { projectId: input.projectId }),
      ...(input.meetingId === undefined ? {} : { meetingId: input.meetingId }),
      agentId: DATA_AGENT_ID,
      title: input.title?.trim() || "Data Agent 会话",
      visibility,
      sourcePage: input.page,
      ...(input.timeRange === undefined ? {} : { timeRange: input.timeRange }),
      createdAt: timestamp,
      updatedAt: timestamp,
    });
    await this.tables.conversations.put(conversation.id, conversation);
    await this.audit({
      actor,
      action: "data_agent.conversation.created",
      workspaceId: input.workspaceId,
      conversationId: conversation.id,
      detail: { visibility, ownerType: conversation.ownerType },
    });
    return conversation;
  }

  conversation(id: string): DataAgentConversation {
    const conversation = this.tables.conversations.get(id);
    if (conversation === undefined) {
      throw new DataAgentError("not_found", "Data Agent 会话不存在");
    }
    return conversation;
  }

  requireConversationOwner(
    actor: DataAgentActor,
    conversationId: string,
  ): DataAgentConversation {
    const conversation = this.conversation(conversationId);
    if (
      conversation.ownerUserId !== actor.userId &&
      actor.role !== "admin"
    ) {
      throw new DataAgentError("forbidden", "无权访问该 Data Agent 会话");
    }
    return conversation;
  }

  listConversations(
    actor: DataAgentActor,
    input: {
      readonly workspaceId?: string | undefined;
      readonly projectId?: string | undefined;
      readonly includeArchived?: boolean | undefined;
    } = {},
  ): DataAgentConversation[] {
    return values(this.tables.conversations)
      .filter((conversation) => {
        if (conversation.ownerUserId !== actor.userId && actor.role !== "admin") {
          return false;
        }
        if (
          input.workspaceId !== undefined &&
          conversation.workspaceId !== input.workspaceId
        ) {
          return false;
        }
        if (
          input.projectId !== undefined &&
          conversation.projectId !== input.projectId
        ) {
          return false;
        }
        return input.includeArchived === true || conversation.archivedAt === undefined;
      })
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
  }

  messages(conversationId: string): DataAgentMessage[] {
    return values(this.tables.messages)
      .filter((message) => message.conversationId === conversationId)
      .sort((left, right) => left.createdAt.localeCompare(right.createdAt));
  }

  attachments(conversationId: string): DataAgentAttachment[] {
    return values(this.tables.attachments)
      .filter((attachment) => attachment.conversationId === conversationId)
      .sort((left, right) => left.createdAt.localeCompare(right.createdAt));
  }

  async appendUserMessage(
    actor: DataAgentActor,
    input: {
      readonly conversationId: string;
      readonly content: string;
      readonly selections: readonly DataAgentSelectionContext[];
    },
  ): Promise<{
    readonly message: DataAgentMessage;
    readonly attachments: readonly DataAgentAttachment[];
  }> {
    const conversation = this.requireConversationOwner(
      actor,
      input.conversationId,
    );
    if (input.content.trim() === "" && input.selections.length === 0) {
      throw new DataAgentError(
        "invalid_input",
        "请输入问题或选择一个页面内容",
      );
    }
    const timestamp = this.now();
    const messageId = this.id("da-msg");
    const attachments: DataAgentAttachment[] = [];
    for (const raw of input.selections) {
      const selection = dataAgentSelectionContextSchema.parse(raw);
      if (selection.source.workspaceId !== conversation.workspaceId) {
        throw new DataAgentError(
          "forbidden",
          "选区不属于当前会话工作区，请重新选择",
        );
      }
      const attachment = attachmentSchema.parse({
        id: this.id("da-att"),
        conversationId: conversation.id,
        messageId,
        kind: selection.kind,
        ...(selection.entityType === undefined
          ? {}
          : { entityType: selection.entityType }),
        ...(selection.entityId === undefined
          ? {}
          : { entityId: selection.entityId }),
        title: selection.title,
        excerpt: selection.excerpt,
        sourcePage: selection.source.page,
        sourceWorkspaceId: selection.source.workspaceId,
        ...(selection.source.projectId === undefined
          ? {}
          : { sourceProjectId: selection.source.projectId }),
        ...(selection.source.entityRef === undefined
          ? {}
          : { deepLink: selection.source.entityRef }),
        snapshot: {
          kind: selection.kind,
          ...(selection.snapshot === undefined ? {} : selection.snapshot),
        },
        createdAt: timestamp,
      });
      await this.tables.attachments.put(attachment.id, attachment);
      attachments.push(attachment);
    }
    const message = messageSchema.parse({
      id: messageId,
      conversationId: conversation.id,
      senderType: "user",
      senderId: actor.userId,
      content:
        input.content.trim() ||
        "请分析我已选中的内容，并说明口径、证据与下一步。",
      contextAttachmentIds: attachments.map((attachment) => attachment.id),
      createdAt: timestamp,
    });
    await this.tables.messages.put(message.id, message);
    await this.tables.conversations.put(
      conversation.id,
      conversationSchema.parse({
        ...conversation,
        updatedAt: timestamp,
        title:
          conversation.title === "Data Agent 会话"
            ? message.content.slice(0, 80)
            : conversation.title,
      }),
    );
    return { message, attachments };
  }

  async createRun(
    actor: DataAgentActor,
    input: {
      readonly conversationId: string;
      readonly prompt: string;
      readonly title: string;
      readonly mode?: "chat" | "report" | undefined;
      readonly contextPackId?: string | undefined;
      readonly runtimeProfileId?: string | undefined;
    },
  ): Promise<DataAgentRun> {
    const conversation = this.requireConversationOwner(
      actor,
      input.conversationId,
    );
    const timestamp = this.now();
    const run = runSchema.parse({
      id: this.id("da-run"),
      conversationId: conversation.id,
      workspaceId: conversation.workspaceId,
      ...(conversation.projectId === undefined
        ? {}
        : { projectId: conversation.projectId }),
      ...(input.runtimeProfileId === undefined
        ? {}
        : { runtimeProfileId: input.runtimeProfileId }),
      ...(input.contextPackId === undefined
        ? {}
        : { contextPackId: input.contextPackId }),
      mode: input.mode ?? "report",
      status: "queued",
      prompt: input.prompt,
      title: input.title,
      usedTools: [],
      createdAt: timestamp,
      updatedAt: timestamp,
    });
    await this.tables.runs.put(run.id, run);
    return run;
  }

  run(id: string): DataAgentRun {
    const run = this.tables.runs.get(id);
    if (run === undefined) {
      throw new DataAgentError("not_found", "Data Agent Run 不存在");
    }
    return run;
  }

  runByRuntimeSessionId(sessionId: string): DataAgentRun | undefined {
    if (sessionId === "") return undefined;
    return values(this.tables.runs)
      .filter((run) => run.runtimeSessionId === sessionId)
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))[0];
  }

  runForAgentSession(sessionId: string): DataAgentRun | undefined {
    const exact = this.runByRuntimeSessionId(sessionId);
    if (exact !== undefined) return exact;
    // The tool can run before the monitor has copied AgentRun.sessionId onto
    // the Data Agent Run. Session ids contain the conversation id, so pending
    // runs remain resolvable during that short window.
    return values(this.tables.runs)
      .filter(
        (run) =>
          ["queued", "running", "waiting_input"].includes(run.status) &&
          sessionId.includes(run.conversationId),
      )
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))[0];
  }

  async updateRun(
    runId: string,
    patch: Partial<
      Pick<
        DataAgentRun,
        | "agentRunId"
        | "runtimeSessionId"
        | "contextPackId"
        | "contextReceiptId"
        | "runtimeProfileId"
        | "runtimeProfileRevision"
        | "status"
        | "error"
        | "output"
        | "usedTools"
        | "queryEvidence"
        | "dataCutoffAt"
        | "startedAt"
        | "endedAt"
      >
    >,
  ): Promise<DataAgentRun> {
    const current = this.run(runId);
    const next = runSchema.parse({
      ...current,
      ...patch,
      updatedAt: this.now(),
    });
    await this.tables.runs.put(next.id, next);
    return next;
  }

  pendingRuns(): DataAgentRun[] {
    return values(this.tables.runs).filter((run) =>
      ["queued", "running", "waiting_input"].includes(run.status),
    );
  }

  reportsForConversation(conversationId: string): DataAgentReport[] {
    return values(this.tables.reports)
      .filter((report) => report.conversationId === conversationId)
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  }

  async completeChatRun(input: {
    readonly actor: DataAgentActor;
    readonly runId: string;
    readonly rawOutput: string;
    readonly usedTools?: readonly string[] | undefined;
    readonly queryEvidence?: readonly DataAgentQueryEvidence[] | undefined;
  }): Promise<{
    readonly run: DataAgentRun;
    readonly message: DataAgentMessage;
  }> {
    const current = this.run(input.runId);
    const conversation = this.conversation(current.conversationId);
    const timestamp = this.now();
    const content = [
      input.rawOutput.trim(),
      ...(input.queryEvidence === undefined
        ? []
        : dataEvidenceMarkdown(input.queryEvidence)),
    ]
      .filter((item) => item.trim() !== "")
      .join("\n\n");
    const message = messageSchema.parse({
      id: this.id("da-msg"),
      conversationId: conversation.id,
      senderType: "ai-partner",
      senderId: DATA_AGENT_ID,
      content,
      contextAttachmentIds: [],
      runId: current.id,
      createdAt: timestamp,
    });
    await this.tables.messages.put(message.id, message);
    const run = await this.updateRun(current.id, {
      status: "succeeded",
      output: content,
      usedTools: [...new Set(input.usedTools ?? [])],
      queryEvidence: [...(input.queryEvidence ?? [])],
      endedAt: timestamp,
    });
    await this.tables.conversations.put(
      conversation.id,
      conversationSchema.parse({ ...conversation, updatedAt: timestamp }),
    );
    await this.audit({
      actor: input.actor,
      action: "data_agent.chat.completed",
      workspaceId: conversation.workspaceId,
      conversationId: conversation.id,
      runId: current.id,
      detail: { mode: "chat" },
    });
    return { run, message };
  }

  report(id: string): DataAgentReport {
    const report = this.tables.reports.get(id);
    if (report === undefined) {
      throw new DataAgentError("not_found", "报告不存在");
    }
    return report;
  }

  async completeRun(input: {
    readonly actor: DataAgentActor;
    readonly runId: string;
    readonly rawOutput: string;
    readonly dataCutoffAt: string;
    readonly usedTools?: readonly string[] | undefined;
    readonly queryEvidence?: readonly DataAgentQueryEvidence[] | undefined;
  }): Promise<{
    readonly run: DataAgentRun;
    readonly report: DataAgentReport;
    readonly message: DataAgentMessage;
  }> {
    const current = this.run(input.runId);
    const conversation = this.conversation(current.conversationId);
    const attachments = this.attachments(conversation.id);
    const contexts = attachments.map((attachment) =>
      dataAgentSelectionContextSchema.parse({
        kind:
          attachment.kind === "record"
            ? "record"
            : attachment.kind === "metric"
              ? "metric"
              : attachment.kind,
        ...(attachment.entityType === undefined
          ? {}
          : { entityType: attachment.entityType }),
        ...(attachment.entityId === undefined
          ? {}
          : { entityId: attachment.entityId }),
        title: attachment.title,
        excerpt: attachment.excerpt,
        source: {
          workspaceId: attachment.sourceWorkspaceId,
          ...(attachment.sourceProjectId === undefined
            ? {}
            : { projectId: attachment.sourceProjectId }),
          page: attachment.sourcePage,
          ...(attachment.deepLink === undefined
            ? {}
            : { entityRef: attachment.deepLink }),
        },
        snapshot: attachment.snapshot,
      }),
    );
    const reportId = this.id("da-report");
    const title = reportTitle(
      input.rawOutput,
      current.title || "Data Agent 分析报告",
    );
    const markdown = contractMarkdown({
      title,
      markdown: input.rawOutput,
      context: contexts,
      cutoffAt: input.dataCutoffAt,
      reportId,
      queryEvidence: input.queryEvidence,
    });
    const entityTypes = [
      ...new Set(
        contexts
          .map((item) => item.entityType)
          .filter((value): value is NonNullable<typeof value> => value !== undefined),
      ),
    ];
    const images: DataAgentReportImage[] = [
      {
        name: "scope-and-evidence.svg",
        mediaType: "image/svg+xml",
        content: scopeEvidenceSvg({
          title,
          page: conversation.sourcePage,
          workspaceId: conversation.workspaceId,
          cutoffAt: input.dataCutoffAt,
          attachmentCount: attachments.length,
          sourceRefs: contexts.map((item) => item.title),
        }),
        alt: "分析范围与证据覆盖",
      },
      {
        name: "evidence-map.svg",
        mediaType: "image/svg+xml",
        content: evidenceMapSvg({
          title,
          attachmentCount: attachments.length,
          entityTypes,
          textLength: contexts.reduce(
            (total, item) => total + item.excerpt.length,
            0,
          ),
        }),
        alt: "证据覆盖",
      },
    ];
    const timestamp = this.now();
    const previous = values(this.tables.reports).filter(
      (report) => report.conversationId === conversation.id,
    );
    const report = reportSchema.parse({
      id: reportId,
      conversationId: conversation.id,
      runId: current.id,
      version: previous.length + 1,
      title,
      summary: reportSummary(input.rawOutput),
      markdown,
      images,
      ownerType: conversation.ownerType,
      ownerId: conversation.ownerId,
      visibility: conversation.visibility,
      dataCutoffAt: input.dataCutoffAt,
      metricDefinition:
        "使用当前选区快照和 Runtime Profile 授权范围内的数据口径；未返回的口径不补造。",
      queryEvidence: [...(input.queryEvidence ?? [])],
      sourceRefs: contexts.map((item) => item.source.entityRef ?? item.title),
      createdAt: timestamp,
    });
    await this.tables.reports.put(report.id, report);
    const message = messageSchema.parse({
      id: this.id("da-msg"),
      conversationId: conversation.id,
      senderType: "ai-partner",
      senderId: DATA_AGENT_ID,
      content: report.summary,
      contextAttachmentIds: [],
      runId: current.id,
      reportId: report.id,
      createdAt: timestamp,
    });
    await this.tables.messages.put(message.id, message);
    const run = await this.updateRun(current.id, {
      status: "succeeded",
      output: input.rawOutput,
      usedTools: [...new Set(input.usedTools ?? [])],
      queryEvidence: [...(input.queryEvidence ?? [])],
      dataCutoffAt: input.dataCutoffAt,
      endedAt: timestamp,
    });
    await this.tables.conversations.put(
      conversation.id,
      conversationSchema.parse({ ...conversation, updatedAt: timestamp }),
    );
    await this.audit({
      actor: input.actor,
      action: "data_agent.report.created",
      workspaceId: conversation.workspaceId,
      conversationId: conversation.id,
      runId: current.id,
      reportId: report.id,
      detail: { format: "markdown", images: String(images.length) },
    });
    return { run, report, message };
  }

  async renderHtml(
    actor: DataAgentActor,
    reportId: string,
  ): Promise<DataAgentHtmlArtifact> {
    const report = this.report(reportId);
    const existing = values(this.tables.htmlArtifacts).find(
      (artifact) =>
        artifact.reportId === report.id &&
        artifact.reportVersion === report.version,
    );
    if (existing !== undefined) return existing;
    const body = markdownToSafeHtml(report.markdown, report.images);
    const content = [
      "<!doctype html>",
      '<html lang="zh-CN"><head><meta charset="utf-8"/>',
      '<meta name="viewport" content="width=device-width,initial-scale=1"/>',
      `<title>${escapeHtml(report.title)}</title>`,
      "<style>",
      "body{margin:0;background:#f5f7fb;color:#1e293b;font:14px/1.65 -apple-system,BlinkMacSystemFont,'PingFang SC',sans-serif}",
      "main{max-width:960px;margin:0 auto;padding:40px 28px 64px}",
      "h1{font-size:30px}h2{font-size:20px;margin-top:30px}h3{font-size:16px}",
      "p,li{color:#475569}code{background:#eef2f7;border-radius:4px;padding:1px 4px}",
      "pre{overflow:auto;padding:12px;border-radius:8px;background:#eef2f7}",
      "table{border-collapse:collapse;width:100%;background:#fff}th,td{border:1px solid #dbe3ef;padding:7px 9px;text-align:left}",
      "img{max-width:100%;height:auto;margin:12px 0;border:1px solid #dbe3ef;border-radius:8px}",
      ".meta{margin:18px 0;padding:12px;border:1px solid #dbe3ef;border-radius:8px;background:#fff;color:#64748b}",
      "</style></head><body><main>",
      body,
      `<div class="meta">报告版本 ${report.version} · 数据截止 ${escapeHtml(report.dataCutoffAt)} · 由 Data Agent 生成 · 只读权限快照</div>`,
      "</main></body></html>",
    ].join("");
    const artifact = htmlArtifactSchema.parse({
      id: this.id("da-html"),
      reportId: report.id,
      reportVersion: report.version,
      content,
      createdBy: actor.userId,
      createdAt: this.now(),
    });
    await this.tables.htmlArtifacts.put(artifact.id, artifact);
    await this.audit({
      actor,
      action: "data_agent.report.html_rendered",
      reportId: report.id,
      detail: { reportVersion: String(report.version) },
    });
    return artifact;
  }

  htmlForReport(reportId: string): DataAgentHtmlArtifact | undefined {
    const report = this.report(reportId);
    return values(this.tables.htmlArtifacts)
      .filter(
        (artifact) =>
          artifact.reportId === report.id &&
          artifact.reportVersion === report.version,
      )
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt))[0];
  }

  async archiveConversation(
    actor: DataAgentActor,
    conversationId: string,
  ): Promise<DataAgentConversation> {
    const current = this.requireConversationOwner(actor, conversationId);
    const archived = conversationSchema.parse({
      ...current,
      archivedAt: current.archivedAt ?? this.now(),
      updatedAt: this.now(),
    });
    await this.tables.conversations.put(archived.id, archived);
    await this.audit({
      actor,
      action: "data_agent.conversation.archived",
      workspaceId: archived.workspaceId,
      conversationId: archived.id,
    });
    return archived;
  }

  async shareReport(
    actor: DataAgentActor,
    input: {
      readonly reportId: string;
      readonly ownerType: "project" | "workspace" | "meeting";
      readonly ownerId: string;
    },
  ): Promise<DataAgentReport> {
    const current = this.report(input.reportId);
    const conversation = this.requireConversationOwner(
      actor,
      current.conversationId,
    );
    const next = reportSchema.parse({
      ...current,
      ownerType: input.ownerType,
      ownerId: input.ownerId,
      visibility: input.ownerType,
      sourceRefs: [...current.sourceRefs, `shared:${input.ownerType}:${input.ownerId}`],
    });
    await this.tables.reports.put(next.id, next);
    await this.audit({
      actor,
      action: "data_agent.report.shared",
      workspaceId: conversation.workspaceId,
      conversationId: conversation.id,
      reportId: current.id,
      detail: {
        ownerType: input.ownerType,
        ownerId: input.ownerId,
      },
    });
    return next;
  }
}

export function dataAgentErrorStatus(code: DataAgentError["code"]): number {
  if (code === "unauthorized") return 401;
  if (code === "forbidden" || code === "system_agent_protected") return 403;
  if (code === "not_found") return 404;
  if (code === "conflict") return 409;
  if (code === "unavailable") return 503;
  return 400;
}

export const __test = {
  contractMarkdown,
  evidenceMapSvg,
  markdownToSafeHtml,
  scopeEvidenceSvg,
};
