import type { IncomingMessage, ServerResponse } from "node:http";
import {
  bearerToken,
  readJsonBody,
  sameOrigin,
  sendJson,
} from "@pluginmax/shared";
import { z } from "zod";
import {
  DATA_AGENT_API_PREFIX,
  DATA_AGENT_ID,
  dataAgentDomainSpec,
  dataAgentSelectionContextSchema,
  type DataAgentAttachment,
  type DataAgentAuditEvent,
  type DataAgentConversation,
  type DataAgentHtmlArtifact,
  type DataAgentMessage,
  type DataAgentReport,
  type DataAgentRun,
  type DataAgentSelectionContext,
  type DataAgentWorkspaceConfig,
} from "./models.js";
import {
  DataAgentError,
  DataAgentService,
  dataAgentErrorStatus,
  type DataAgentActor,
  type KvTableLike,
} from "./service.js";

export const name = "dsh-collab-data-agent";
export const inject = [
  "storageDomain",
  "webServer",
  "collabTeammates",
  "collabTeammateRuntime",
  "collabAgent",
];

export {
  DATA_AGENT_API_PREFIX,
  DATA_AGENT_ID,
  DataAgentError,
  DataAgentService,
  dataAgentDomainSpec,
};

interface WebRouteLike {
  readonly kind: "exact";
  readonly path: string;
  handler(
    request: IncomingMessage,
    response: ServerResponse,
  ): Promise<void> | void;
}

interface TeamMemberLike {
  readonly userId: string;
  readonly memberRole?: "owner" | "member" | "guest" | undefined;
}

interface TeamServiceLike {
  resolveToken(token: string):
    | {
        readonly userId: string;
        readonly role?: "admin" | "owner" | "member" | "guest" | undefined;
      }
    | undefined;
  users(): readonly { readonly id: string; readonly name: string }[];
  members(workspaceId: string): readonly TeamMemberLike[];
}

interface WorkspaceLike {
  readonly id: string;
  readonly title?: string | undefined;
  readonly path?: string | undefined;
  readonly isMember?: boolean | undefined;
}

interface WorkspaceRegistryLike {
  list(): readonly WorkspaceLike[];
}

interface TaskLike {
  readonly id: string;
  readonly workspaceId: string;
  readonly title: string;
  readonly status?: string | undefined;
  readonly receiverName?: string | undefined;
}

interface TaskServiceLike {
  list(workspaceId: string): readonly TaskLike[];
}

interface WorkflowLike {
  readonly id: string;
  readonly workspaceId: string;
  readonly title?: string | undefined;
  readonly status?: string | undefined;
}

interface WorkflowServiceLike {
  instance(instanceId: string): WorkflowLike | undefined;
}

interface MeetingLike {
  readonly id: string;
  readonly workspaceId: string;
  readonly title: string;
  readonly status?: string | undefined;
}

interface MeetingServiceLike {
  list(workspaceId: string): readonly MeetingLike[];
}

interface TeammateViewLike {
  readonly id: string;
  readonly name: string;
  readonly status?: string | undefined;
  readonly state?: string | undefined;
  readonly source?: string | undefined;
  readonly protected?: {
    readonly deletable: false;
    readonly archivable: false;
    readonly templateSwitchable: false;
  };
  readonly systemKey?: string | undefined;
}

interface TeammateServiceLike {
  get(teammateId: string): {
    readonly id: string;
    readonly name: string;
    readonly state: string;
    readonly execution?: "builtin" | "external" | undefined;
    readonly externalRuntimeId?: string | undefined;
  };
  viewOf(teammate: unknown): TeammateViewLike;
  configureSystemAgentRuntime(
    actor: DataAgentActor,
    input: {
      readonly teammateId: string;
      readonly execution: "builtin" | "external";
      readonly externalRuntimeId?: string | undefined;
    },
  ): Promise<unknown>;
}

interface TeammateRuntimeLike {
  ensureRuntime(input: {
    readonly teammateId: string;
    readonly workspaceId: string;
    readonly actor: DataAgentActor;
    readonly workspaceRole?: "owner" | "member" | "guest" | undefined;
  }): Promise<{
    readonly profileId: string;
    readonly principalId?: string | undefined;
    readonly externalRuntimeId?: string | null | undefined;
    readonly execution?: "builtin" | "external" | undefined;
  }>;
}

interface AgentProfileLike {
  readonly id: string;
  readonly name: string;
  readonly execution?: "builtin" | "external" | undefined;
  readonly externalRuntimeId?: string | undefined;
  readonly allowedTools: readonly string[];
}

interface AgentRunLike {
  readonly id: string;
  readonly status:
    | "queued"
    | "running"
    | "waiting_input"
    | "succeeded"
    | "failed"
    | "timeout"
    | "cancelled"
    | "interrupted";
  readonly output?: { readonly summary?: string | undefined } | undefined;
  readonly error?: string | undefined;
  readonly execution?:
    | {
        readonly runtime?: string | undefined;
      }
    | undefined;
}

interface AgentServiceLike {
  profiles(workspaceId: string): readonly AgentProfileLike[];
  runs(input: {
    readonly workspaceId: string;
    readonly instanceId?: string | undefined;
  }): readonly AgentRunLike[];
  dispatch(input: {
    readonly workspaceId: string;
    readonly workspacePath?: string | undefined;
    readonly profileId: string;
    readonly source: "chat";
    readonly instanceId: string;
    readonly nodeId: string;
    readonly dispatchKey: string;
    readonly trigger: "manual-dispatch";
    readonly attempt: number;
    readonly runSeq: number;
    readonly maxAttempts: number;
    readonly timeoutMs: number;
    readonly personaId?: string | undefined;
    readonly principalId?: string | undefined;
    readonly principalType?: "principal-runtime" | undefined;
    readonly ticketId?: string | undefined;
    readonly contextPackId?: string | undefined;
    readonly sessionBindingId?: string | undefined;
    readonly payload: {
      readonly instanceTitle: string;
      readonly nodeName: string;
      readonly nodeDescription: string;
      readonly profileName: string;
      readonly deliverables: readonly [];
      readonly context: Readonly<
        Record<string, string | number | boolean>
      >;
    };
    readonly createdBy: string;
  }): Promise<AgentRunLike>;
}

interface DataAgentContext {
  storageDomain: {
    open(spec: typeof dataAgentDomainSpec): Promise<{
      table(
        name:
          | "workspace_configs"
          | "conversations"
          | "messages"
          | "attachments"
          | "runs"
          | "reports"
          | "html_artifacts"
          | "audit",
      ): KvTableLike<unknown>;
      close(): Promise<void>;
    }>;
  };
  webServer: { register(route: WebRouteLike): unknown };
  get(key: string, strict?: boolean): unknown;
  root?: { get(key: string, strict?: boolean): unknown };
  effect(operation: () => () => void): void;
}

function lookup<T>(ctx: DataAgentContext, key: string): T | undefined {
  return (ctx.get(key, false) ?? ctx.root?.get(key, false)) as T | undefined;
}

function query(request: IncomingMessage): URLSearchParams {
  return new URL(request.url ?? "/", "http://dsh.invalid").searchParams;
}

function header(
  request: IncomingMessage,
  name: string,
): string | undefined {
  const value = request.headers[name.toLowerCase()];
  return Array.isArray(value) ? value[0] : value;
}

function requireTeam(
  request: IncomingMessage,
  team: () => TeamServiceLike | undefined,
): { actor: DataAgentActor; team: TeamServiceLike } {
  const origin = header(request, "origin");
  const host = header(request, "host");
  if (origin !== undefined && !sameOrigin(origin, host)) {
    throw new DataAgentError("forbidden", "same-origin request is required");
  }
  const token = bearerToken({
    get(name) {
      return name === "authorization"
        ? (request.headers.authorization ?? null)
        : null;
    },
  });
  if (token === undefined) {
    throw new DataAgentError("unauthorized", "bearer token is required");
  }
  const service = team();
  if (service === undefined) {
    throw new DataAgentError("unavailable", "协作身份服务不可用");
  }
  const principal = service.resolveToken(token);
  if (principal === undefined) {
    throw new DataAgentError("unauthorized", "invalid or expired token");
  }
  const user = service.users().find((item) => item.id === principal.userId);
  return {
    actor: {
      userId: principal.userId,
      name: user?.name ?? principal.userId,
      role: principal.role ?? "member",
    },
    team: service,
  };
}

function workspaceAccess(
  team: TeamServiceLike,
  actor: DataAgentActor,
  workspaceId: string,
): {
  readonly canRead: boolean;
  readonly canManage: boolean;
  readonly memberRole?: "owner" | "member" | "guest" | undefined;
} {
  if (actor.role === "admin") {
    return { canRead: true, canManage: true, memberRole: "owner" };
  }
  const member = team
    .members(workspaceId)
    .find((item) => item.userId === actor.userId);
  const memberRole = member?.memberRole ?? "guest";
  return {
    canRead: member !== undefined && memberRole !== "guest",
    canManage: memberRole === "owner",
    memberRole,
  };
}

function requireWorkspace(
  team: TeamServiceLike,
  actor: DataAgentActor,
  workspaceId: string,
): {
  readonly canRead: boolean;
  readonly canManage: boolean;
  readonly memberRole?: "owner" | "member" | "guest" | undefined;
} {
  const access = workspaceAccess(team, actor, workspaceId);
  if (!access.canRead) {
    throw new DataAgentError("forbidden", "无权访问该工作区");
  }
  return access;
}

function method(request: IncomingMessage, expected: string): void {
  if (request.method !== expected) {
    throw new DataAgentError("invalid_input", "method not allowed");
  }
}

async function body<T>(request: IncomingMessage, schema: z.ZodType<T>): Promise<T> {
  let value: unknown;
  try {
    value = await readJsonBody(request);
  } catch {
    throw new DataAgentError("invalid_input", "valid JSON body is required");
  }
  const parsed = schema.safeParse(value);
  if (!parsed.success) {
    throw new DataAgentError("invalid_input", "request input is invalid");
  }
  return parsed.data;
}

function routeError(response: ServerResponse, cause: unknown): void {
  if (cause instanceof DataAgentError) {
    sendJson(response, dataAgentErrorStatus(cause.code), {
      ok: false,
      error: { code: cause.code, message: cause.message },
    });
    return;
  }
  const message = cause instanceof Error ? cause.message : "Data Agent 请求失败";
  sendJson(response, 500, {
    ok: false,
    error: { code: "internal_error", message },
  });
}

function writeText(
  response: ServerResponse,
  input: {
    readonly status?: number | undefined;
    readonly contentType: string;
    readonly content: string;
    readonly fileName?: string | undefined;
  },
): void {
  response.writeHead(input.status ?? 200, {
    "content-type": `${input.contentType}; charset=utf-8`,
    "cache-control": "no-store",
    ...(input.fileName === undefined
      ? {}
      : {
          "content-disposition": `attachment; filename*=UTF-8''${encodeURIComponent(input.fileName)}`,
        }),
  });
  response.end(input.content);
}

const configBodySchema = z.object({
  workspaceId: z.string().trim().min(1).max(200),
  dataConnectionIds: z.array(z.string().trim().min(1).max(200)).max(50).optional(),
  defaultProjectId: z.string().trim().min(1).max(200).nullable().optional(),
  defaultTimeRange: z.enum(["today", "7d", "30d", "month"]).optional(),
  timezone: z.string().trim().min(1).max(80).optional(),
  preferredMetricIds: z.array(z.string().trim().min(1).max(200)).max(50).optional(),
  externalRuntimeId: z.string().trim().min(1).max(200).nullable().optional(),
});

const selectionResolveBodySchema = z.object({
  workspaceId: z.string().trim().min(1).max(200),
  selection: dataAgentSelectionContextSchema,
});

const queryBodySchema = z.object({
  workspaceId: z.string().trim().min(1).max(200),
  conversationId: z.string().trim().min(1).max(200).optional(),
  projectId: z.string().trim().min(1).max(200).optional(),
  meetingId: z.string().trim().min(1).max(200).optional(),
  page: z.enum(["workbench", "task", "meeting", "project", "workflow"]),
  prompt: z.string().max(20_000).default(""),
  selections: z.array(dataAgentSelectionContextSchema).max(10).default([]),
  timeRange: z
    .object({
      from: z.string().datetime({ precision: 3 }),
      to: z.string().datetime({ precision: 3 }),
    })
    .optional(),
});

function selectionPrompt(
  conversation: DataAgentConversation,
  message: DataAgentMessage,
  attachments: readonly DataAgentAttachment[],
  history: readonly DataAgentMessage[],
): string {
  const transcript = history
    .slice(-12)
    .map(
      (item) =>
        `${item.senderType === "user" ? "用户" : "Data Agent"}：${item.content}`,
    )
    .join("\n\n");
  const context = attachments
    .map(
      (attachment, index) =>
        [
          `### 上下文 ${index + 1}：${attachment.title}`,
          `- 类型：${attachment.entityType ?? attachment.kind}`,
          `- 来源页：${attachment.sourcePage}`,
          `- 工作区：${attachment.sourceWorkspaceId}`,
          attachment.sourceProjectId === undefined
            ? ""
            : `- 项目：${attachment.sourceProjectId}`,
          attachment.entityId === undefined ? "" : `- 对象：${attachment.entityId}`,
          `- 快照：${attachment.excerpt}`,
        ]
          .filter(Boolean)
          .join("\n"),
    )
    .join("\n\n");
  return [
    "你是平台内置 Data Agent。请基于当前会话、选区快照与授权上下文完成分析。",
    "默认只读。不得编造数据；不得跨工作区读取；写操作、外发和指派只能提出人工确认建议。",
    "输出中文 Markdown 报告。必须明确区分事实、推断和建议，并包含：",
    "1. 结论与业务影响；2. 指标口径与时间范围；3. 主要证据；4. 不确定性和数据缺口；5. 建议下一步。",
    "默认不要生成 HTML。HTML 版本只能由用户显式请求。",
    "",
    `当前页面：${conversation.sourcePage}`,
    `工作区：${conversation.workspaceId}`,
    conversation.projectId === undefined ? "" : `项目：${conversation.projectId}`,
    conversation.meetingId === undefined ? "" : `会议：${conversation.meetingId}`,
    "",
    "## 最近对话",
    transcript || "（新会话）",
    "",
    "## 当前用户请求",
    message.content,
    "",
    "## 已选上下文附件",
    context || "（用户未选择页面内容）",
    "",
    "## 输出约束",
    "- 只引用上方上下文和你能通过只读工具实际读取的数据。",
    "- 如果关键字段缺失，请在报告中明确标出并给出治理建议。",
    "- 不要输出工具过程、推理过程或客套话。",
  ]
    .filter(Boolean)
    .join("\n");
}

function validateEntitySelection(
  services: {
    readonly tasks?: TaskServiceLike | undefined;
    readonly workflows?: WorkflowServiceLike | undefined;
    readonly meetings?: MeetingServiceLike | undefined;
  },
  selection: DataAgentSelectionContext,
): void {
  if (selection.entityType === undefined || selection.entityId === undefined) {
    return;
  }
  if (selection.entityType === "task") {
    const task = services.tasks
      ?.list(selection.source.workspaceId)
      .find((item) => item.id === selection.entityId);
    if (task === undefined) {
      throw new DataAgentError("not_found", "选中的任务不存在或不可访问");
    }
  }
  if (
    selection.entityType === "workflow" ||
    selection.entityType === "workflow_node"
  ) {
    const workflow = services.workflows?.instance(selection.entityId);
    if (
      workflow === undefined ||
      workflow.workspaceId !== selection.source.workspaceId
    ) {
      throw new DataAgentError("not_found", "选中的工作流不存在或不可访问");
    }
  }
  if (selection.entityType === "meeting") {
    const meeting = services.meetings
      ?.list(selection.source.workspaceId)
      .find((item) => item.id === selection.entityId);
    if (meeting === undefined) {
      throw new DataAgentError("not_found", "选中的会议不存在或不可访问");
    }
  }
}

function monitorDelay(): Promise<void> {
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, 1_500);
    timer.unref?.();
  });
}

function monitorRun(input: {
  readonly agent: AgentServiceLike;
  readonly service: DataAgentService;
  readonly actor: DataAgentActor;
  readonly dataRunId: string;
  readonly conversation: DataAgentConversation;
}): void {
  void (async () => {
    const deadline = Date.now() + 15 * 60_000;
    while (Date.now() < deadline) {
      const dataRun = input.service.run(input.dataRunId);
      if (
        ["succeeded", "failed", "timeout", "cancelled", "interrupted"].includes(
          dataRun.status,
        )
      ) {
        return;
      }
      if (dataRun.agentRunId === undefined) {
        await input.service.updateRun(dataRun.id, {
          status: "failed",
          error: "Agent Run 未创建",
          endedAt: new Date().toISOString(),
        });
        return;
      }
      const agentRun = input.agent.runs({
        workspaceId: dataRun.workspaceId,
        instanceId: input.conversation.id,
      }).find((run) => run.id === dataRun.agentRunId);
      if (agentRun === undefined) {
        await monitorDelay();
        continue;
      }
      if (agentRun.status === "succeeded") {
        const output = agentRun.output?.summary?.trim() ?? "";
        if (output === "") {
          await input.service.updateRun(dataRun.id, {
            status: "failed",
            error: "Data Agent 未返回可用的 Markdown 报告",
            endedAt: new Date().toISOString(),
          });
        } else {
          await input.service.completeRun({
            actor: input.actor,
            runId: dataRun.id,
            rawOutput: output,
            dataCutoffAt: new Date().toISOString(),
            usedTools: [],
          });
        }
        return;
      }
      if (agentRun.status === "running" || agentRun.status === "queued") {
        await input.service.updateRun(dataRun.id, {
          status: agentRun.status,
          ...(dataRun.startedAt === undefined
            ? { startedAt: new Date().toISOString() }
            : {}),
        });
      } else if (
        ["failed", "timeout", "cancelled", "interrupted"].includes(
          agentRun.status,
        )
      ) {
        await input.service.updateRun(dataRun.id, {
          status: agentRun.status,
          error:
            agentRun.error ??
            `Agent Run ${agentRun.status}：请检查运行时配置后重试`,
          endedAt: new Date().toISOString(),
        });
        return;
      }
      await monitorDelay();
    }
    await input.service.updateRun(input.dataRunId, {
      status: "timeout",
      error: "Data Agent 运行超过 15 分钟，已结束跟踪",
      endedAt: new Date().toISOString(),
    });
  })().catch(async (cause) => {
    await input.service
      .updateRun(input.dataRunId, {
        status: "failed",
        error: cause instanceof Error ? cause.message : "Data Agent 后台运行失败",
        endedAt: new Date().toISOString(),
      })
      .catch(() => undefined);
  });
}

function conversationPayload(
  service: DataAgentService,
  conversation: DataAgentConversation,
) {
  const reports = service.reportsForConversation(conversation.id);
  return {
    conversation,
    messages: service.messages(conversation.id),
    attachments: service.attachments(conversation.id),
    runs: service.pendingRuns().filter(
      (run) => run.conversationId === conversation.id,
    ),
    reports: reports.map((report) => ({
      ...report,
      html: service.htmlForReport(report.id) ?? null,
    })),
  };
}

export function createDataAgentRoutes(
  service: DataAgentService,
  lookupService: <T>(key: string) => T | undefined,
  runQuery: (input: {
    readonly actor: DataAgentActor;
    readonly conversation: DataAgentConversation;
    readonly prompt: string;
    readonly selections: readonly DataAgentSelectionContext[];
    readonly workspacePath?: string | undefined;
  }) => Promise<{
    readonly run: DataAgentRun;
    readonly agentRunId: string;
    readonly profileId: string;
  }>,
): WebRouteLike[] {
  const team = () =>
    lookupService<TeamServiceLike>("collabTeam");
  const requireActor = (request: IncomingMessage) =>
    requireTeam(request, team);
  const tasks = () => lookupService<TaskServiceLike>("collabTasks");
  const workflows = () => lookupService<WorkflowServiceLike>("collabWorkflow");
  const meetings = () => lookupService<MeetingServiceLike>("collabMeeting");
  const registry = () =>
    lookupService<WorkspaceRegistryLike>("workspaceRegistry");

  return [
    {
      kind: "exact",
      path: DATA_AGENT_API_PREFIX,
      handler: (request, response) =>
        (async () => {
          method(request, "GET");
          const { actor, team: identity } = requireActor(request);
          const workspaceId = query(request).get("workspaceId") ?? "";
          if (workspaceId === "") {
            throw new DataAgentError("invalid_input", "workspaceId is required");
          }
          const access = requireWorkspace(identity, actor, workspaceId);
          const teammateService =
            lookupService<TeammateServiceLike>("collabTeammates");
          const teammate = teammateService?.get(DATA_AGENT_ID);
          sendJson(response, 200, {
            ok: true,
            identity: {
              id: DATA_AGENT_ID,
              name: "Data Agent",
              roleLabel: "数据分析师 · 平台内置",
              systemKey: "data-agent",
              protected: {
                deletable: false,
                archivable: false,
                templateSwitchable: false,
              },
              state: teammate?.state ?? "active",
            },
            workspaceConfig: service.config(workspaceId),
            access,
            capabilities: {
              readOnlyByDefault: true,
              markdownReport: true,
              htmlOnDemand: true,
              entityTypes: [
                "task",
                "workflow",
                "workflow_node",
                "meeting",
                "metric_card",
              ],
            },
          });
        })().catch((cause) => routeError(response, cause)),
    },
    {
      kind: "exact",
      path: `${DATA_AGENT_API_PREFIX}/config`,
      handler: (request, response) =>
        (async () => {
          method(request, "POST");
          const { actor, team: identity } = requireActor(request);
          const input = await body(request, configBodySchema);
          const access = requireWorkspace(identity, actor, input.workspaceId);
          if (!access.canManage) {
            throw new DataAgentError(
              "forbidden",
              "只有平台管理员或工作区负责人可以配置 Data Agent",
            );
          }
          const config = await service.saveConfig(actor, input);
          const teammateService =
            lookupService<TeammateServiceLike>("collabTeammates");
          if (input.externalRuntimeId !== undefined) {
            await teammateService?.configureSystemAgentRuntime(
              { ...actor, role: "owner" },
              {
                teammateId: DATA_AGENT_ID,
                execution:
                  input.externalRuntimeId === null ? "builtin" : "external",
                ...(input.externalRuntimeId === null
                  ? {}
                  : { externalRuntimeId: input.externalRuntimeId }),
              },
            );
          }
          sendJson(response, 200, { ok: true, workspaceConfig: config });
        })().catch((cause) => routeError(response, cause)),
    },
    {
      kind: "exact",
      path: `${DATA_AGENT_API_PREFIX}/reset`,
      handler: (request, response) =>
        (async () => {
          method(request, "POST");
          const { actor, team: identity } = requireActor(request);
          const input = await body(
            request,
            z.object({
              workspaceId: z.string().trim().min(1).max(200),
            }),
          );
          const access = requireWorkspace(identity, actor, input.workspaceId);
          if (!access.canManage) {
            throw new DataAgentError(
              "forbidden",
              "只有平台管理员或工作区负责人可以恢复默认",
            );
          }
          const config = await service.resetConfig(actor, input.workspaceId);
          sendJson(response, 200, {
            ok: true,
            workspaceConfig: config,
            summary: {
              reset: [
                "补充指令与默认偏好",
                "项目、指标与数据源优先级",
                "洞察阈值与通知偏好",
                "缓存的分析记忆",
              ],
              preserved: [
                "数据连接与授权",
                "历史报告与 Agent Run",
                "已创建任务和文件",
                "工作区指标 Skill 版本",
              ],
            },
          });
        })().catch((cause) => routeError(response, cause)),
    },
    {
      kind: "exact",
      path: `${DATA_AGENT_API_PREFIX}/delete`,
      handler: (request, response) =>
        (async () => {
          method(request, "POST");
          requireActor(request);
          throw new DataAgentError(
            "system_agent_protected",
            "Data Agent 是平台固定系统身份，不能删除、归档或卸载",
          );
        })().catch((cause) => routeError(response, cause)),
    },
    {
      kind: "exact",
      path: `${DATA_AGENT_API_PREFIX}/selection/resolve`,
      handler: (request, response) =>
        (async () => {
          method(request, "POST");
          const { actor, team: identity } = requireActor(request);
          const input = await body(request, selectionResolveBodySchema);
          requireWorkspace(identity, actor, input.workspaceId);
          if (input.selection.source.workspaceId !== input.workspaceId) {
            throw new DataAgentError(
              "forbidden",
              "选区工作区与当前上下文不一致",
            );
          }
          validateEntitySelection(
            {
              tasks: tasks(),
              workflows: workflows(),
              meetings: meetings(),
            },
            input.selection,
          );
          sendJson(response, 200, {
            ok: true,
            selection: input.selection,
            snapshotRef: `selection:${randomId()}`,
          });
        })().catch((cause) => routeError(response, cause)),
    },
    {
      kind: "exact",
      path: `${DATA_AGENT_API_PREFIX}/conversations`,
      handler: (request, response) =>
        (async () => {
          method(request, "GET");
          const { actor, team: identity } = requireActor(request);
          const workspaceId = query(request).get("workspaceId") ?? undefined;
          if (workspaceId !== undefined) {
            requireWorkspace(identity, actor, workspaceId);
          }
          sendJson(response, 200, {
            ok: true,
            conversations: service.listConversations(actor, {
              ...(workspaceId === undefined ? {} : { workspaceId }),
              ...(query(request).get("projectId") === null
                ? {}
                : { projectId: query(request).get("projectId") ?? undefined }),
              includeArchived: query(request).get("includeArchived") === "1",
            }),
          });
        })().catch((cause) => routeError(response, cause)),
    },
    {
      kind: "exact",
      path: `${DATA_AGENT_API_PREFIX}/conversation`,
      handler: (request, response) =>
        (async () => {
          method(request, "GET");
          const { actor, team: identity } = requireActor(request);
          const id = query(request).get("id") ?? "";
          const conversation = service.requireConversationOwner(actor, id);
          requireWorkspace(identity, actor, conversation.workspaceId);
          sendJson(response, 200, {
            ok: true,
            ...conversationPayload(service, conversation),
          });
        })().catch((cause) => routeError(response, cause)),
    },
    {
      kind: "exact",
      path: `${DATA_AGENT_API_PREFIX}/archive`,
      handler: (request, response) =>
        (async () => {
          method(request, "POST");
          const { actor } = requireActor(request);
          const input = await body(
            request,
            z.object({
              conversationId: z.string().trim().min(1).max(200),
            }),
          );
          const conversation = await service.archiveConversation(
            actor,
            input.conversationId,
          );
          sendJson(response, 200, { ok: true, conversation });
        })().catch((cause) => routeError(response, cause)),
    },
    {
      kind: "exact",
      path: `${DATA_AGENT_API_PREFIX}/query`,
      handler: (request, response) =>
        (async () => {
          method(request, "POST");
          const { actor, team: identity } = requireActor(request);
          const input = await body(request, queryBodySchema);
          const access = requireWorkspace(identity, actor, input.workspaceId);
          for (const selection of input.selections) {
            validateEntitySelection(
              {
                tasks: tasks(),
                workflows: workflows(),
                meetings: meetings(),
              },
              selection,
            );
          }
          const conversation =
            input.conversationId === undefined
              ? await service.createConversation(actor, {
                  workspaceId: input.workspaceId,
                  ...(input.projectId === undefined
                    ? {}
                    : { projectId: input.projectId }),
                  ...(input.meetingId === undefined
                    ? {}
                    : { meetingId: input.meetingId }),
                  page: input.page,
                  ...(input.timeRange === undefined
                    ? {}
                    : { timeRange: input.timeRange }),
                  title: input.prompt.trim().slice(0, 80) || "Data Agent 会话",
                })
              : service.requireConversationOwner(actor, input.conversationId);
          if (conversation.workspaceId !== input.workspaceId) {
            throw new DataAgentError("forbidden", "会话与当前工作区不一致");
          }
          const appended = await service.appendUserMessage(actor, {
            conversationId: conversation.id,
            content: input.prompt,
            selections: input.selections,
          });
          const history = service.messages(conversation.id);
          const prompt = selectionPrompt(
            conversation,
            appended.message,
            appended.attachments,
            history,
          );
          const workspace = registry()
            ?.list()
            .find((item) => item.id === conversation.workspaceId);
          const sent = await runQuery({
            actor,
            conversation,
            prompt,
            selections: input.selections,
            ...(workspace?.path === undefined
              ? {}
              : { workspacePath: workspace.path }),
          });
          const run = await service.updateRun(sent.run.id, {
            agentRunId: sent.agentRunId,
            runtimeProfileId: sent.profileId,
            status: "queued",
          });
          sendJson(response, 200, {
            ok: true,
            conversation,
            run,
            message: appended.message,
            attachments: appended.attachments,
            access,
          });
        })().catch((cause) => routeError(response, cause)),
    },
    {
      kind: "exact",
      path: `${DATA_AGENT_API_PREFIX}/run`,
      handler: (request, response) =>
        (async () => {
          method(request, "GET");
          const { actor } = requireActor(request);
          const run = service.run(query(request).get("id") ?? "");
          const conversation = service.requireConversationOwner(
            actor,
            run.conversationId,
          );
          const reports = service
            .reportsForConversation(conversation.id)
            .filter((report) => report.runId === run.id);
          sendJson(response, 200, {
            ok: true,
            run,
            conversation,
            reports: reports.map((report) => ({
              ...report,
              html: service.htmlForReport(report.id) ?? null,
            })),
          });
        })().catch((cause) => routeError(response, cause)),
    },
    {
      kind: "exact",
      path: `${DATA_AGENT_API_PREFIX}/report`,
      handler: (request, response) =>
        (async () => {
          method(request, "GET");
          const { actor } = requireActor(request);
          const report = service.report(query(request).get("id") ?? "");
          const conversation = service.requireConversationOwner(
            actor,
            report.conversationId,
          );
          sendJson(response, 200, {
            ok: true,
            report,
            conversation,
            html: service.htmlForReport(report.id) ?? null,
          });
        })().catch((cause) => routeError(response, cause)),
    },
    {
      kind: "exact",
      path: `${DATA_AGENT_API_PREFIX}/render-html`,
      handler: (request, response) =>
        (async () => {
          method(request, "POST");
          const { actor } = requireActor(request);
          const input = await body(
            request,
            z.object({
              reportId: z.string().trim().min(1).max(200),
              reportVersion: z.number().int().min(1),
            }),
          );
          const report = service.report(input.reportId);
          service.requireConversationOwner(actor, report.conversationId);
          if (report.version !== input.reportVersion) {
            throw new DataAgentError(
              "conflict",
              "报告版本已更新，请基于最新 Markdown 版本重新生成 HTML",
            );
          }
          const artifact = await service.renderHtml(actor, report.id);
          sendJson(response, 200, { ok: true, html: artifact });
        })().catch((cause) => routeError(response, cause)),
    },
    {
      kind: "exact",
      path: `${DATA_AGENT_API_PREFIX}/download`,
      handler: (request, response) =>
        (async () => {
          method(request, "GET");
          const { actor } = requireActor(request);
          const report = service.report(query(request).get("reportId") ?? "");
          service.requireConversationOwner(actor, report.conversationId);
          const format = query(request).get("format") ?? "md";
          if (format === "html") {
            const artifact = service.htmlForReport(report.id);
            if (artifact === undefined) {
              throw new DataAgentError(
                "not_found",
                "尚未生成当前报告版本的 HTML",
              );
            }
            writeText(response, {
              contentType: "text/html",
              content: artifact.content,
              fileName: `${report.title}.html`,
            });
            return;
          }
          if (format === "zip") {
            throw new DataAgentError(
              "invalid_input",
              "当前运行时未配置 ZIP 打包器，请分别下载 Markdown 与图片资产",
            );
          }
          writeText(response, {
            contentType: "text/markdown",
            content: report.markdown,
            fileName: `${report.title}.md`,
          });
        })().catch((cause) => routeError(response, cause)),
    },
    {
      kind: "exact",
      path: `${DATA_AGENT_API_PREFIX}/asset`,
      handler: (request, response) =>
        (async () => {
          method(request, "GET");
          const { actor } = requireActor(request);
          const report = service.report(query(request).get("reportId") ?? "");
          service.requireConversationOwner(actor, report.conversationId);
          const image = report.images.find(
            (item) => item.name === (query(request).get("name") ?? ""),
          );
          if (image === undefined) {
            throw new DataAgentError("not_found", "报告图片资产不存在");
          }
          writeText(response, {
            contentType: image.mediaType,
            content: image.content,
          });
        })().catch((cause) => routeError(response, cause)),
    },
    {
      kind: "exact",
      path: `${DATA_AGENT_API_PREFIX}/share`,
      handler: (request, response) =>
        (async () => {
          method(request, "POST");
          const { actor, team: identity } = requireActor(request);
          const input = await body(
            request,
            z.object({
              reportId: z.string().trim().min(1).max(200),
              ownerType: z.enum(["project", "workspace", "meeting"]),
              ownerId: z.string().trim().min(1).max(200),
            }),
          );
          const report = service.report(input.reportId);
          const conversation = service.requireConversationOwner(
            actor,
            report.conversationId,
          );
          const workspaceId =
            input.ownerType === "project"
              ? input.ownerId
              : conversation.workspaceId;
          const access = requireWorkspace(identity, actor, workspaceId);
          if (!access.canManage) {
            throw new DataAgentError(
              "forbidden",
              "只有平台管理员或目标工作区负责人可以共享报告",
            );
          }
          sendJson(response, 200, {
            ok: true,
            report: await service.shareReport(actor, input),
          });
        })().catch((cause) => routeError(response, cause)),
    },
  ];
}

function randomId(): string {
  return Math.random().toString(36).slice(2, 12);
}

export async function apply(ctx: DataAgentContext): Promise<void> {
  const domain = await ctx.storageDomain.open(dataAgentDomainSpec);
  const service = new DataAgentService({
    workspaceConfigs: domain.table(
      "workspace_configs",
    ) as KvTableLike<DataAgentWorkspaceConfig>,
    conversations: domain.table(
      "conversations",
    ) as KvTableLike<DataAgentConversation>,
    messages: domain.table("messages") as KvTableLike<DataAgentMessage>,
    attachments: domain.table(
      "attachments",
    ) as KvTableLike<DataAgentAttachment>,
    runs: domain.table("runs") as KvTableLike<DataAgentRun>,
    reports: domain.table("reports") as KvTableLike<DataAgentReport>,
    htmlArtifacts: domain.table(
      "html_artifacts",
    ) as KvTableLike<DataAgentHtmlArtifact>,
    audit: domain.table("audit") as KvTableLike<DataAgentAuditEvent>,
  });
  const runQuery = async (input: {
    readonly actor: DataAgentActor;
    readonly conversation: DataAgentConversation;
    readonly prompt: string;
    readonly selections: readonly DataAgentSelectionContext[];
    readonly workspacePath?: string | undefined;
  }) => {
    const teammates = lookup<TeammateServiceLike>(ctx, "collabTeammates");
    const runtime = lookup<TeammateRuntimeLike>(
      ctx,
      "collabTeammateRuntime",
    );
    const agents = lookup<AgentServiceLike>(ctx, "collabAgent");
    const team = lookup<TeamServiceLike>(ctx, "collabTeam");
    if (
      teammates === undefined ||
      runtime === undefined ||
      agents === undefined ||
      team === undefined
    ) {
      throw new DataAgentError(
        "unavailable",
        "Data Agent 运行时链路不可用，请检查 AI伙伴、Agent 与身份服务",
      );
    }
    const access = requireWorkspace(team, input.actor, input.conversation.workspaceId);
    const ensured = await runtime.ensureRuntime({
      teammateId: DATA_AGENT_ID,
      workspaceId: input.conversation.workspaceId,
      actor: input.actor,
      ...(access.memberRole === undefined
        ? {}
        : { workspaceRole: access.memberRole }),
    });
    const profile = agents
      .profiles(input.conversation.workspaceId)
      .find((item) => item.id === ensured.profileId);
    if (profile === undefined) {
      throw new DataAgentError(
        "unavailable",
        "Data Agent Runtime Profile 未生成",
      );
    }
    const dataRun = await service.createRun(input.actor, {
      conversationId: input.conversation.id,
      prompt: input.prompt,
      title:
        input.selections[0]?.title ??
        input.conversation.title ??
        "Data Agent 分析",
      runtimeProfileId: ensured.profileId,
    });
    const agentRun = await agents.dispatch({
      workspaceId: input.conversation.workspaceId,
      ...(input.workspacePath === undefined
        ? {}
        : { workspacePath: input.workspacePath }),
      profileId: profile.id,
      source: "chat",
      instanceId: input.conversation.id,
      nodeId: "data-agent-analysis",
      dispatchKey: `data-agent:${dataRun.id}`,
      trigger: "manual-dispatch",
      attempt: 1,
      runSeq: 1,
      maxAttempts: 1,
      timeoutMs: 15 * 60_000,
      ...(ensured.principalId === undefined
        ? {}
        : {
            principalId: ensured.principalId,
            principalType: "principal-runtime" as const,
          }),
      payload: {
        instanceTitle: input.conversation.title,
        nodeName: "Data Agent 分析",
        nodeDescription: input.prompt,
        profileName: profile.name,
        deliverables: [],
        context: {
          instruction: input.prompt,
          transcript: "",
          workspaceId: input.conversation.workspaceId,
          projectId: input.conversation.projectId ?? "",
        },
      },
      createdBy: input.actor.userId,
    });
    monitorRun({
      agent: agents,
      service,
      actor: input.actor,
      dataRunId: dataRun.id,
      conversation: input.conversation,
    });
    return {
      run: dataRun,
      agentRunId: agentRun.id,
      profileId: profile.id,
    };
  };
  for (const route of createDataAgentRoutes(service, (key) => lookup(ctx, key), runQuery)) {
    ctx.webServer.register(route);
  }
  ctx.effect(() => () => {
    void domain.close();
  });
}

export const __test = {
  selectionPrompt,
  validateEntitySelection,
};
