# 技术设计：沟通中创建任务草稿（P0/P1）

> 文档版本：v1.0  
> 日期：2026-10-30  
> 状态：P0/P1 技术基线，可进入开发评审  
> 产品依据：[产品PRD-沟通中创建任务草稿-P0P1.md](../../产品PRD-沟通中创建任务草稿-P0P1.md)  
> 总体架构依据：[技术设计：Agent 任务控制与动态 AI 团队总体架构](./technical-design-agent-task-control-overall.md)  
> 现有任务依据：[产品设计：任务管理作为 Agent Runtime 的超级遥控器](../../产品设计-任务管理作为Agent运行时超级遥控器.md)

---

## 0. 结论

1. 新增独立插件 `dsh-collab-task-capture`，拥有采集会话、草稿批次、草稿、来源和转换记录。
2. 现有 `dsh-collab-task` 继续只拥有正式任务、状态、负责人、Review、派发和归档。
3. 任务草稿不复用 `TaskRecord.status`，避免污染现有任务状态机。
4. 沟通、会议和 Data Agent 通过来源适配器注册采集来源，不拥有草稿存储。
5. 任务草稿确认通过正式任务创建端口完成，P0 固定 `dispatch=false`。
6. 跨存储转换通过稳定 `creationKey` 和转换记录实现幂等，不依赖进程内事件是否送达。
7. UI 通过版本化 Slot 组合：沟通模块声明承载位置，任务采集插件注册草稿面板，任务插件声明任务详情来源扩展。
8. P1 通过 `Task Tools Facade` 将公开能力适配为 MCP Tools；MCP 不直接访问任务存储，也不成为任务产品本身。

---

## 1. 当前现状与约束

### 1.1 现有任务模型

`dsh-collab-task` 当前具备：

- `TaskRecord` 状态：`todo / progress / review / done / cancelled`；
- 必填验收标准 `acceptance`；
- 负责人可为 `human / agent / role / unassigned`；
- 创建、更新、确认、消息、评论、文档、Review 和派发；
- `collabTasks` 服务与 `/api/collab/tasks/*` 路由；
- `collabTaskDispatch` 派发服务；
- `links` 当前仅支持 `meeting / workflow`；
- 任务只以 `workspaceId` 为范围，没有正式 `projectId`；
- `/api/collab/tasks/create` 在负责人为 Agent 时会立即派发。

### 1.2 直接复用 Task 的问题

不能把草稿建模为 `TaskRecord.status = "draft"`：

1. 现有看板、计数、Review、派发和复盘都默认 `Task` 是正式业务承诺；
2. `TaskRecord` 要求至少一条验收标准，草稿阶段可能尚未形成；
3. 创建接口可能自动派发 Agent，违反“保存草稿不执行”；
4. 草稿需要候选来源、缺失字段和转换状态，不属于正式任务契约；
5. 后续任务管理独立产品化时，草稿和正式任务的生命周期不同。

### 1.3 现有 UI Slot 约束

当前客户端通过 `ctx.slots.register()` 贡献 UI，组件不能直接获得插件上下文，跨模块 UI 不能互相导入组件。

因此本方案要求：

- 沟通模块负责声明承载 Slot；
- 任务采集插件负责注册草稿面板；
- 任务插件负责声明任务详情扩展 Slot；
- 不通过全局 DOM、`window.__pluginmax*` 或直接 import 客户端组件传递草稿业务状态。

---

## 2. 目标架构

```text
┌─────────────────────────────────────────────────────────┐
│ AI 对话 / 群聊 / 会议 / Data Agent                       │
│ 来源 UI、候选事项、承载 Slot、TaskCaptureSourceAdapter    │
└───────────────────────┬─────────────────────────────────┘
                        │ sourceRef + selection
                        ▼
┌─────────────────────────────────────────────────────────┐
│ dsh-collab-task-capture                                  │
│ Capture Session / Draft Batch / Draft / Origin / Commit  │
│ TaskCapturePort                                          │
└───────────────┬───────────────────────────┬─────────────┘
                │ createFromDraft           │ P1 events
                ▼                           ▼
┌──────────────────────────────┐   ┌──────────────────────┐
│ dsh-collab-task              │   │ AI 伙伴 / 来源会话    │
│ 正式 Task / Review / Dispatch│   │ 事件消费与状态回显     │
└───────────────┬──────────────┘   └──────────────────────┘
                │ P1 tools
                ▼
┌──────────────────────────────┐
│ Task Tools Facade / MCP      │
│ task.read / capture / execute│
└──────────────────────────────┘
```

依赖方向：

```text
contracts
   ↑
identity → task
              ↑
task-capture ─┘
   ↑
source adapters / task capture UI

task-tools
   ↓
task + task-capture
```

- `task` 不依赖 `task-capture`。
- `task-capture` 依赖正式任务创建端口。
- 来源模块只依赖采集端口和 Slot，不访问草稿存储。
- P1 Task Tools 只调用公开端口，不直接打开其他插件 storage domain。

---

## 3. 模块边界

| 模块 | P0 职责 | P1 职责 | 不负责 |
| --- | --- | --- | --- |
| `dsh-collab-task` | 正式任务创建/查询/Review/派发；提供 `TaskCreationPort`；声明任务详情扩展 Slot | 提供稳定查询与执行投影 | 解析沟通、生成候选事项、保存草稿 |
| `dsh-collab-task-capture` | 采集会话、来源、草稿、去重、就绪度、转换、来源映射；提供 `TaskCapturePort` | 提供 Agent 草稿接口和事件 | Agent Runtime、正式任务状态机 |
| `dsh-collab-meeting` | 会议来源适配器；右侧沟通栏和沟通中心承载 Slot；候选事项卡 | 订阅任务事件，在会议中回显任务状态 | 草稿存储、草稿箱 |
| `dsh-collab-data-agent` | Data Agent 来源适配器；候选事项卡 | 任务查询与事件回显 | 自动创建正式任务 |
| AI 对话客户端 | AI 对话来源适配器；候选事项卡 | 消费任务工具结果与事件 | 保存任务状态副本 |
| `dsh-collab-shell` | 导航、Slot 声明基础设施、跨页面跳转 | 独立任务产品入口组合 | 草稿或任务业务数据 |
| `@pluginmax/contracts` | 草稿、来源、命令、结果、事件 DTO | Tool capability DTO | 存储、业务实现 |
| `dsh-collab-task-tools`（P1 新增） | — | API / MCP / Tool schema 适配 | 任务状态权威、权限规则重写 |

### 3.1 正式任务插件的最小扩展

`dsh-collab-task` 只增加以下公共能力：

```ts
interface TaskCreationPort {
  createFromDraft(input: {
    actor: TaskPrincipalActor;
    draft: TaskDraftForCreation;
    creationKey: string;
    commandId: string;
  }): Promise<TaskCreationResult>;
}
```

职责：

- 校验正式任务必填契约；
- 按 `creationKey` 去重；
- 创建 `status=todo` 的正式任务；
- P0 不派发；
- 返回 `created` 或 `deduplicated`。

不把来源快照、草稿状态和转换失败记录塞进 `TaskRecord`。

### 3.2 任务采集插件的职责

- 注册 `TaskCaptureSourceAdapter` 注册表；
- 解析来源并验证访问权限；
- 创建 `TaskCaptureSession`；
- 保存 `TaskDraftBatch / TaskDraft`；
- 计算就绪度和缺失字段；
- 提供去重结果；
- 调用 `TaskCreationPort` 转换；
- 记录 `TaskOrigin` 和转换操作；
- 声明能力 `task.capture.v1`；
- P1 对外提供事件和 Agent 可调用服务。

---

## 4. 领域模型

### 4.1 TaskCaptureSession

一次“从某段沟通整理任务草稿”的采集会话。

```ts
interface TaskCaptureSession {
  id: string;
  schemaVersion: 1;
  workspaceId: string;
  projectId?: string;
  source: TaskCaptureSourceSnapshot;
  status: "active" | "saved" | "dismissed" | "expired";
  revision: number;
  createdByPrincipalId: string;
  createdAt: string;
  updatedAt: string;
  expiresAt: string;
}
```

规则：

- 由来源适配器在服务端解析，客户端不能伪造来源可见性。
- 默认有效期 24 小时；过期只影响未保存候选，不影响已保存草稿。
- `saved` 表示该会话已形成草稿批次。
- 关闭面板不等于放弃，只有显式“放弃”才进入 `dismissed`。

### 4.2 TaskCaptureCandidate

来源模块提供给用户选择的候选事项。

```ts
interface TaskCaptureCandidate {
  id: string;
  sessionId: string;
  sourceItemKey: string;
  title: string;
  description: string;
  projectId?: string;
  receiverHint?: TaskReceiverHint;
  priorityHint?: "P1" | "P2" | "P3";
  dueHint?: string;
  acceptanceHints: string[];
  collaboratorHints?: TaskParticipantHint[];
  evidenceRefs: string[];
  confidence: "high" | "medium" | "low";
  missingFields: string[];
  status: "proposed" | "saved" | "discarded";
}
```

`sourceItemKey` 必须稳定：

- 会议行动项 ID；
- 消息 ID 与事项序号；
- Data Agent 报告片段 ID；
- 来源模块提供的稳定事项 ID。

### 4.3 TaskDraftBatch

用户一次保存形成的一组任务草稿。

```ts
interface TaskDraftBatch {
  id: string;
  schemaVersion: 1;
  captureSessionId: string;
  source: TaskCaptureSourceSnapshot;
  workspaceId: string;
  projectId?: string;
  visibility: "private" | "source-participants" | "workspace";
  ownerPrincipalId: string;
  status:
    | "active"
    | "partially-converted"
    | "converted"
    | "archived";
  revision: number;
  createdAt: string;
  updatedAt: string;
}
```

### 4.4 TaskDraft

正式任务之前的可编辑对象。

```ts
interface TaskDraft {
  id: string;
  schemaVersion: 1;
  batchId: string;
  workspaceId: string;
  sourceItemKey: string;
  title: string;
  description: string;
  projectId?: string;
  receiverType: "unassigned" | "human" | "agent" | "role";
  receiverId?: string;
  receiverName?: string;
  priority: "P1" | "P2" | "P3";
  due?: string;
  acceptance: string[];
  collaboratorHints?: TaskParticipantHint[];
  dependsOn?: string[];
  readiness: "needs-info" | "ready";
  missingFields: string[];
  duplicate?: TaskDuplicateHint;
  status:
    | "active"
    | "converting"
    | "converted"
    | "conversion-failed"
    | "ignored";
  revision: number;
  createdAt: string;
  updatedAt: string;
}
```

就绪度由服务端计算：

```text
ready =
  title.trim() != ""
  && description.trim() != ""
  && workspaceId != ""
  && acceptance.length >= 1
```

负责人、截止日期和项目不阻塞 P0 就绪度。

### 4.5 TaskOrigin

正式任务回到来源的稳定引用。

```ts
interface TaskOrigin {
  id: string;
  taskId: string;
  draftId: string;
  batchId: string;
  sourceType: string;
  sourceId: string;
  sourceTitle: string;
  workspaceId: string;
  projectId?: string;
  sourceItemKeys: string[];
  contextSnapshot: {
    excerpt: string;
    messageIds?: string[];
    actionItemIds?: string[];
    reportSectionIds?: string[];
    timeRange?: { from?: string; to?: string };
  };
  visibility: "private" | "source-participants" | "workspace";
  sourceVersion: string;
  deepLink?: string;
  createdByPrincipalId: string;
  createdAt: string;
}
```

约束：

- 只保存选中事项和必要摘录，不保存完整 transcript。
- 来源失联时保留 `sourceTitle` 与 `sourceVersion`，显式显示不可访问。
- P0 一个草稿最多对应一个正式任务；`taskId` 在 origin 表中唯一。

### 4.6 TaskDraftConversion

记录跨存储转换过程，保证重试不重复建任务。

```ts
interface TaskDraftConversion {
  id: string;
  commandId: string;
  draftId: string;
  draftRevision: number;
  creationKey: string;
  taskId?: string;
  status: "committing" | "succeeded" | "failed";
  errorCode?: string;
  errorMessage?: string;
  attempt: number;
  createdAt: string;
  updatedAt: string;
}
```

---

## 5. 状态机

### 5.1 采集会话

```text
active → saved
active → dismissed
active → expired
```

### 5.2 草稿

```text
active(needs-info) ⇄ active(ready)
active → ignored
active → converting → converted
active → converting → conversion-failed → converting
```

### 5.3 批次

```text
active
  → partially-converted
  → converted
  → archived
```

批次状态由草稿聚合结果推导，不要求客户端自行维护。

### 5.4 并发规则

- 草稿更新使用 `revision` 乐观并发控制。
- 更新时 revision 不一致返回 `conflict`。
- 转换开始后草稿冻结，不能继续编辑。
- 转换失败后允许按原 revision 重试；若用户编辑，生成新 revision。

---

## 6. 跨插件契约

### 6.1 契约文件

新增：

```text
packages/contracts/src/task-capture.ts
packages/contracts/src/task-tools.ts        # P1
```

规则：

- 只依赖 Zod 和纯类型；
- DTO 带 `schemaVersion`；
- 破坏性变更创建新版本文件或能力名；
- 不在 contracts 中引用 Storage、Cordis 或 React。

### 6.2 TaskCaptureSourceAdapter

来源模块注册适配器，任务采集插件不直接读取其他插件的存储。

```ts
interface TaskCaptureSourceAdapter {
  readonly sourceType: string;
  readonly version: string;

  resolve(input: {
    actor: TaskPrincipalActor;
    sourceRef: TaskCaptureSourceRef;
    selection: TaskCaptureSelection;
  }): Promise<ResolvedTaskCaptureSource>;
}

interface ResolvedTaskCaptureSource {
  workspaceId: string;
  projectId?: string;
  source: TaskCaptureSourceSnapshot;
  candidates: TaskCaptureCandidateDraft[];
}
```

来源适配器负责：

- 校验当前 Principal 是否有来源访问权；
- 解析稳定事项 ID 和来源摘录；
- 返回来源可见范围；
- 限制快照大小；
- 不创建草稿，不创建任务。

没有适配器时，来源模块可以提供“手工新建任务草稿”，但不得伪装成自动提炼。

#### 注册方式

`dsh-collab-task-capture` 提供来源适配器注册表：

```ts
interface TaskCaptureSourceRegistry {
  register(adapter: TaskCaptureSourceAdapter): () => void;
  resolve(sourceType: string): TaskCaptureSourceAdapter | undefined;
}
```

来源插件在自身 `apply` 中：

1. 通过能力探测获取 `collabTaskCaptureSources`；
2. 注册自己的适配器；
3. 用 `ctx.effect()` 管理注销；
4. 采集插件缺失时不显示自动提炼入口。

约束：

- 注册表只保存适配器，不保存来源业务数据；
- 适配器实现留在来源插件；
- 同一 `sourceType` 只能有一个活跃适配器；
- 重复注册或版本不兼容时返回能力降级，不静默覆盖。

### 6.3 TaskCapturePort

```ts
interface TaskCapturePort {
  prepare(input: PrepareTaskCaptureInput): Promise<TaskCaptureSessionProjection>;
  session(input: { sessionId: string }): Promise<TaskCaptureSessionProjection>;
  save(input: SaveTaskDraftsInput): Promise<TaskDraftBatchProjection>;
  inbox(input: TaskDraftInboxQuery): Promise<TaskDraftInboxProjection>;
  batch(input: { batchId: string }): Promise<TaskDraftBatchProjection>;
  updateDraft(input: UpdateTaskDraftInput): Promise<TaskDraftProjection>;
  ignoreDraft(input: IgnoreTaskDraftInput): Promise<TaskDraftProjection>;
  dismissBatch(input: DismissTaskDraftBatchInput): Promise<void>;
  commit(input: CommitTaskDraftsInput): Promise<TaskDraftCommitResult>;
  retryConversion(input: RetryTaskDraftConversionInput): Promise<TaskDraftCommitResult>;
  origin(input: { taskId: string }): Promise<TaskOrigin | undefined>;
}
```

### 6.4 命令信封

所有写命令统一使用：

```ts
interface TaskCaptureCommandMeta {
  commandId: string;
  correlationId?: string;
  causationId?: string;
  expectedRevision?: number;
}
```

规则：

- `commandId` 必须稳定；
- 服务端对 `commandId` 去重；
- 返回结果包含实际对象 ID、revision 和是否命中幂等；
- 客户端超时重试必须复用原 `commandId`。

### 6.5 核心命令输入

```ts
interface PrepareTaskCaptureInput {
  sourceRef: {
    sourceType: string;
    sourceId: string;
    sourceTitle?: string;
  };
  selection: {
    messageIds?: string[];
    actionItemIds?: string[];
    reportSectionIds?: string[];
    timeRange?: { from?: string; to?: string };
  };
  commandId: string;
}

interface SaveTaskDraftsInput {
  sessionId: string;
  candidateIds: string[];
  commandId: string;
  expectedRevision: number;
}

interface CommitTaskDraftsInput {
  batchId: string;
  draftIds: string[];
  commandId: string;
  expectedRevision: number;
  createMode: "create-only"; // P0 固定；P1 增加 create-and-dispatch
}

interface TaskDraftCommitResult {
  batchId: string;
  items: Array<{
    draftId: string;
    status: "created" | "deduplicated" | "failed" | "skipped";
    taskId?: string;
    errorCode?: string;
    errorMessage?: string;
  }>;
  summary: {
    created: number;
    deduplicated: number;
    failed: number;
    skipped: number;
  };
}
```

P1 新增 `create-and-dispatch` 时，必须引入独立 `confirmationId` 和 `dispatchKey`，不能只修改 `createMode` 后默认执行。

---

## 7. 存储设计

### 7.1 Storage Domain

新增独立 domain：

```text
collab_task_capture
```

不得通过 `dsh-collab-task` 的 storage domain 保存草稿。

### 7.2 表与索引

| 表 | 主键 | 关键索引 / 唯一性 |
| --- | --- | --- |
| `capture_sessions` | `sessionId` | `workspaceId + createdBy + createdAt` |
| `capture_candidates` | `candidateId` | `sessionId + sourceItemKey` 唯一 |
| `draft_batches` | `batchId` | `captureSessionId` 唯一；`owner + status` |
| `drafts` | `draftId` | `batchId + sourceItemKey` 唯一 |
| `conversions` | `conversionId` | `commandId` 唯一；`draftId` |
| `task_origins` | `originId` | `taskId` 唯一；`draftId` 唯一 |
| `outbox`（P1） | `eventId` | `aggregateId + seq` |

如果后续迁移到事务型数据库：

- 批次和草稿保存使用单事务；
- `commandId`、`creationKey`、`sourceItemKey` 使用数据库唯一约束；
- 不再依赖应用层扫描。

### 7.3 数据保留

- 未保存采集会话 24 小时过期；
- 已保存草稿默认长期保留；
- 忽略 / 归档草稿保留来源引用和审计；
- 不保存完整会话 transcript；
- 清理任务只删除过期候选，不删除真实来源。

---

## 8. HTTP API

### 8.1 P0 路由

统一前缀：

```text
/api/collab/task-capture/*
```

| 方法 | 路径 | 用途 |
| --- | --- | --- |
| `POST` | `/prepare` | 解析来源并创建采集会话 |
| `GET` | `/session` | 读取采集会话和候选事项 |
| `POST` | `/save` | 将选中候选保存为草稿批次 |
| `GET` | `/inbox` | 查询草稿箱 |
| `GET` | `/batch` | 查询批次和草稿 |
| `POST` | `/draft/update` | 更新草稿 |
| `POST` | `/draft/ignore` | 忽略草稿 |
| `POST` | `/batch/dismiss` | 归档整批草稿 |
| `POST` | `/commit` | 确认创建正式任务 |
| `POST` | `/conversion/retry` | 重试失败项 |
| `GET` | `/origin` | 按任务 ID 查询来源 |
| `GET` | `/summary` | 获取看板草稿数量等轻量摘要 |

所有写接口必须：

- 校验 same-origin；
- 校验 token 和 workspace access；
- 校验 Principal；
- 使用 schema 解析请求；
- 记录审计事件；
- 使用稳定错误码。

### 8.2 错误码

```text
invalid_input
unauthorized
forbidden
not_found
conflict
source_unavailable
source_changed
duplicate_source
capability_unavailable
conversion_partial_failure
```

### 8.3 正式 Task 创建

不要复用 `/api/collab/tasks/create` 作为草稿转换入口，因为该接口可能对 Agent 负责人立即派发。

草稿转换由 `TaskCapturePort.commit()` 内部调用 `TaskCreationPort.createFromDraft()`：

- 固定 `dispatch=false`；
- 创建 `todo` 任务；
- 返回既有任务或新建任务。

P1 的“创建并派发”在该步骤成功后单独调用现有 `collabTaskDispatch`。

---

## 9. UI Slot 设计

### 9.1 槽位

建议新增以下 Slot key：

```text
pluginmax.communication.rail.task-capture
pluginmax.communication.context.task-capture
pluginmax.data-agent.task-capture
pluginmax.task.capture-launcher
pluginmax.task.detail.capture-origin
```

| Slot | 所有者 | 注册者 | 用途 |
| --- | --- | --- | --- |
| `pluginmax.communication.rail.task-capture` | 沟通 / 会议侧栏 | `dsh-collab-task-capture` | 右侧栏草稿确认和已保存状态 |
| `pluginmax.communication.context.task-capture` | 沟通中心 | `dsh-collab-task-capture` | 上下文列草稿确认和已保存状态 |
| `pluginmax.data-agent.task-capture` | Data Agent 面板 | `dsh-collab-task-capture` | Data Agent 对话中的草稿确认 |
| `pluginmax.task.capture-launcher` | 任务页头 | `dsh-collab-task-capture` | 草稿数量、草稿箱和确认创建入口 |
| `pluginmax.task.detail.capture-origin` | 任务详情 | `dsh-collab-task-capture` | 任务来源、来源跳转和来源失效状态 |

### 9.2 Host Props

```ts
interface TaskCaptureHostProps {
  mode: "rail" | "context";
  sessionId: string;
  onClose(): void;
  onOpenInbox(batchId: string): void;
}
```

约束：

- `sessionId` 由来源模块在服务端 `prepare` 后获得；
- 任务采集组件自行调用 `session/save/summary`；
- 来源模块不传递草稿数组或来源可见性；
- host 只管理打开/关闭和承载位置；
- 组件关闭时不得清空来源输入草稿或聊天滚动位置。

### 9.3 降级

- 任务采集插件不存在：沟通页不显示“整理任务”入口。
- 来源适配器未注册：不显示“自动提炼”入口；可提供手工草稿。
- 任务插件不存在：任务采集插件不激活，避免孤立草稿数据。
- 任务详情扩展不存在：任务本体仍可用。

### 9.4 通信方式

- 跨插件 UI 使用 Slot owner props 和公开服务。
- 不使用全局 DOM 查询定位草稿面板。
- 不使用 `window.__pluginmaxTaskCapture` 作为数据桥。
- 不使用“页面能打开”冒充能力可用，必须通过公开能力探测。

---

## 10. 草稿保存与正式任务转换

### 10.1 保存草稿

流程：

1. 校验 `sessionId`、处理人和 revision；
2. 校验勾选候选属于该会话；
3. 校验每个候选的 `sourceItemKey` 唯一；
4. 在一个 capture domain 事务 / 原子批次内创建 batch + drafts；
5. 将候选标记为已保存；
6. 返回批次投影和摘要；
7. P0 可以快速 emit `collab/task-capture-changed` 供 UI 刷新，但正确性以重新查询为准。

保存失败时不留下 batch、draft 或部分候选状态。

### 10.2 creationKey

每个草稿使用稳定 key：

```text
task-capture:<workspaceId>:<draftId>
```

规则：

- 同一草稿只允许转换一次；
- 正式任务重复提交时返回既有任务；
- P1 派发使用独立 `dispatchKey`，不把创建和派发混成一个幂等操作。

### 10.3 TaskRecord 兼容扩展

建议在 `TaskRecord` 增加可选字段：

```ts
creationKey?: string;
```

兼容策略：

- 旧任务无该字段，正常解析；
- 新任务创建时写入；
- 创建前先按 `workspaceId + creationKey` 查重；
- 如存储支持唯一索引，增加唯一约束；
- 后续任务数据迁移可懒补索引，不批量重写。

如果暂不修改 `TaskRecord`，必须在任务插件内新增独立的 `task_creation_keys` 幂等表；不得依赖 capture 插件单方面去重。

### 10.4 转换流程

```text
用户确认
  → 校验 draft.ready 和 revision
  → 生成 commandId
  → 写 conversion=committing
  → 将 draft 置为 converting
  → 调 TaskCreationPort.createFromDraft
  → 成功：写 TaskOrigin、draft=converted、conversion=succeeded
  → 失败：draft=conversion-failed、conversion=failed
  → 返回逐条结果
```

若进程在调用任务创建后崩溃：

- 重试沿用同一 `creationKey`；
- 任务插件返回既有任务；
- capture 插件补齐 origin 和 conversion；
- 不产生第二条正式任务。

### 10.5 部分失败

- 批量提交按条返回结果；
- 成功项冻结；
- 失败项保留并显示错误；
- 不因一条失败回滚已成功正式任务；
- 返回批次级汇总 `created / failed / skipped / deduplicated`。

### 10.6 P1 创建并派发

只有用户在 UI 上显式选择“创建并派发”才允许：

1. 创建正式任务成功；
2. 重新校验负责人、Runtime、工具授权和预算；
3. 调用现有派发端口；
4. 派发失败不删除任务，记录独立派发错误；
5. 派发有独立 `dispatchKey`，可单独重试。

---

## 11. 权限与安全

### 11.1 Principal

所有命令必须绑定当前 `Principal`：

- 人类账号；
- AI 伙伴实例；
- 系统 Actor 只能执行系统任务，不替代用户确认。

### 11.2 权限检查

| 操作 | 校验 |
| --- | --- |
| prepare | 来源访问权、workspace access |
| save | 会话处理人、候选归属、workspace access |
| view inbox | workspace access、批次可见性 |
| update draft | 批次处理人 |
| commit | 工作区任务创建权、目标负责人可指派权 |
| view origin | 任务查看权 + 来源查看权 |
| dismiss batch | 处理人或管理员 |

### 11.3 数据边界

- 来源快照只接收来源适配器服务端解析结果。
- 不信任客户端自报的 visibility。
- 私有对话草稿不能通过修改 request body 变成 workspace 可见。
- 正式任务创建时重新校验权限。
- 不把完整聊天记录、文件正文或凭据写入 origin。
- Agent 创建草稿时不能自动扩大来源可见范围。

---

## 12. P1 领域事件

P0 可使用进程内事件加速 UI 刷新，但真相以持久状态查询为准。

P1 引入 durable outbox 后发布：

```text
task.capture-session.created.v1
task.draft-batch.created.v1
task.draft.updated.v1
task.draft.converted.v1
task.origin.linked.v1
task.progress.reported.v1
task.input.required.v1
task.deliverable.submitted.v1
task.review.approved.v1
task.review.rejected.v1
```

事件信封沿用总体架构建议：

```ts
interface CollabDomainEvent<T> {
  id: string;
  type: string;
  version: 1;
  occurredAt: string;
  workspaceId: string;
  aggregateType: string;
  aggregateId: string;
  actorPrincipalId?: string;
  correlationId?: string;
  causationId?: string;
  payload: T;
}
```

规则：

- 消费者按事件 ID 去重；
- 事件丢失后可以通过对象 ID 回源；
- 任务状态以任务插件查询结果为准；
- 来源会话不能通过事件反向修改任务契约。

---

## 13. P1 Agent / MCP 能力面

### 13.1 Task Tools Facade

新增独立适配层，命名暂定：

```text
dsh-collab-task-tools
```

职责：

- 将任务和任务采集的公开端口投影为 Agent 工具；
- 提供 API / MCP transport；
- 管理 tool schema、错误映射和调用审计；
- 不直接读写任务或草稿 storage。

### 13.2 能力包

| 能力包 | 建议工具 | 默认授权 |
| --- | --- | --- |
| `task.read.v1` | `task_search`、`task_get`、`task_list_mine`、`task_list_attention` | 工作区成员 |
| `task.capture.v1` | `task_prepare_capture`、`task_save_drafts`、`task_get_draft_batch` | 有来源访问权 |
| `task.execute.v1` | `task_report_progress`、`task_request_input`、`task_submit_deliverable`、`task_comment` | 当前任务执行者 / 协作方 |
| `task.govern.v1` | `task_commit_drafts`、`task_assign`、`task_review`、`task_cancel` | 人类；Reviewer Agent 需显式配置 |

### 13.3 工具语义

- 不暴露通用 `updateTask` 或 `updateStatus`。
- 状态变化通过业务命令进入任务状态机。
- `task_prepare_capture` 返回 `sessionId`、`humanUrl` 和 `awaiting_human_selection`。
- `task_commit_drafts` 必须携带用户确认产生的 `confirmationId`。
- Agent 不能自行生成 `confirmationId`。
- Agent 不能验收自己提交的任务。
- 长任务工具返回 accepted + taskId，不阻塞等待完成。

### 13.4 认证与授权

复用平台 Principal、workspace access 和 action ticket：

- MCP Tool 调用必须绑定 Principal；
- 执行类能力绑定任务和有效期；
- 只读能力不能自动升级为写入；
- 目标对象变化后重新校验；
- 未来独立部署时用 OAuth / API Token 替换内部 token，但不改变工具语义。

### 13.5 MCP 与 API 的关系

- Public API 是能力权威契约；
- MCP 是 Agent 适配面；
- 内部插件优先调用类型化 Port；
- 外部产品和 MCP 调用公开 HTTP API；
- 三种入口共享同一业务 schema 和权限规则。

---

## 14. 迁移与兼容策略

### 14.1 新增内容

1. 新增 `dsh-collab-task-capture` 插件、client bundle 和 storage domain。
2. 新增 `task-capture.ts` 契约。
3. 新增 `TaskCreationPort`。
4. 新增来源适配器注册能力。
5. 新增通信侧和任务详情扩展 Slot。
6. 可选新增 `TaskRecord.creationKey`。

建议目录：

```text
plugins/dsh-collab-task-capture/
  package.json
  cordis.patch.yml
  README.md
  src/
    index.ts
    models.ts
    service.ts
    routes.ts
    source-registry.ts
    readiness.ts
    conversion.ts
    index.test.ts
    service.test.ts
    contract.test.ts
  client/
    index.js
```

依赖原则：

- 服务端只依赖 `@pluginmax/contracts`、Zod 和公开 `collabTasks` / `collabTaskDispatch` 端口；
- 不 import `dsh-collab-task/src/*`；
- 不 import `dsh-collab-meeting/src/*` 或 Data Agent 内部实现；
- client 不 import 其他插件的 client bundle；
- 插件卸载后，已创建正式任务和来源链接仍可独立读取。

### 14.2 不修改的内容

- 现有任务状态枚举；
- 现有看板和正式任务查询；
- 现有 `/api/collab/tasks/create` 行为；
- 现有 Review、派发和 Run 链路；
- 现有会议的 AI 参会运行任务；
- 现有工作流 Task 语义。

### 14.3 兼容旧任务

- 旧任务没有 `creationKey`，仍按普通任务读取；
- 旧任务没有 origin，任务详情不显示来源扩展；
- 来源失效不能阻止任务继续使用；
- 任务采集插件卸载后，正式任务和旧任务不受影响。

### 14.4 渐进启用

1. 先上线任务采集插件和契约，不显示入口。
2. 接入 AI 对话右侧栏。
3. 接入会议右侧栏。
4. 接入沟通中心上下文列。
5. 接入 Data Agent。
6. 上线任务详情来源扩展。
7. P1 再上线 Agent tools 和 MCP。

---

## 15. 测试设计

### 15.1 契约测试

- 来源适配器输入输出；
- Session / Batch / Draft / Origin schema；
- `TaskCreationPort` 兼容；
- P1 Tool schemas 与 Public API 一致；
- 版本兼容和未知字段处理。

### 15.2 服务测试

- prepare 权限和来源解析；
- save 原子性与 sourceItemKey 去重；
- readiness 计算；
- revision 冲突；
- 批量部分转换失败；
- creationKey 重试去重；
- origin 写入和来源失效；
- 过期采集会话清理。

### 15.3 跨插件集成测试

- 会议来源适配器 → 采集 → 草稿箱 → 正式任务；
- AI 对话来源适配器 → 私有草稿；
- Data Agent 来源适配器 → 证据引用；
- 任务插件缺失时 capture 插件不激活；
- capture 插件缺失时沟通功能正常；
- task tools 缺失时任务页面正常。

### 15.4 GUI / E2E

1. 任务页 + 右侧沟通栏打开草稿面板。
2. 沟通中心 + 上下文列打开草稿面板。
3. 取消勾选后保存数量正确。
4. 保存后任务看板不变、草稿数增加。
5. 刷新后草稿恢复。
6. 编辑不完整草稿并转为可创建。
7. 批量确认创建正式任务。
8. 确认创建后不产生 Agent Run。
9. 来源跳转和来源失效。
10. 部分失败后重试不重复创建。
11. 窄屏和侧栏同时打开时布局不崩。
12. 输入草稿、聊天滚动位置和上下文选择不丢失。

### 15.5 P1 安全测试

- Agent 不能静默确认创建；
- Agent 不能验收自己的任务；
- Agent 不能更新未分派给自己的任务；
- 工具调用不能绕过 workspace / project 权限；
- MCP 断开不影响人工任务；
- 事件丢失后仍能通过查询恢复状态。

---

## 16. 技术验收标准

1. 草稿数据和正式任务数据分别属于不同 storage domain。
2. 来源模块不直接修改草稿表，任务插件不直接解析沟通内容。
3. 保存草稿不创建 Task、不产生 Run、不触发 Agent。
4. 草稿转换在重试和进程中断后不重复创建正式任务。
5. P0 的 create from draft 固定不派发。
6. 两种沟通布局使用同一个采集服务、同一套 schema、同一个草稿组件。
7. 任务采集插件缺失时，沟通、会议和任务核心能力均可独立运行。
8. Slot 注册可释放，卸载插件后不留下孤儿 UI。
9. 来源快照不包含完整 transcript，不因来源存在而自动进入 Agent 上下文。
10. P1 MCP 不直接打开 capture 或 task storage domain。
11. 所有公开工具使用业务命令，不暴露通用状态修改 CRUD。
12. 文档中的对象、状态和权限与 PRD 一致。

---

## 17. 后续演进

1. 增加正式任务 `projectId` 和通用 `TaskExternalRef` 时，重新评审权限、筛选和统计。
2. 将 `TaskCaptureSourceAdapter` 扩展到邮件、文档、外部工单和会议录音。
3. 将草稿箱拆成独立 Task Inbox 子产品时，继续复用 `TaskCapturePort`。
4. 任务管理独立部署时，用 Public API + MCP + Webhook 替代部分内部 Port。
5. AI 伙伴独立部署时，只保存任务 ID、订阅游标和上下文引用，不保存任务状态副本。
6. 未来可将任务产品与 AI 伙伴产品分别售卖、部署和升级，但共享 Principal、权限、来源 ID 和版本化能力契约。

---

## 18. P0 / P1 实现状态

### 18.1 P0：已完成

已实现：

- `dsh-collab-task-capture` 独立插件与 `collab_task_capture` storage domain；
- AI 对话、会议、Data Agent 来源适配器；
- 右侧沟通栏、沟通中心上下文列、Data Agent 面板三种草稿承载入口；
- 任务草稿批次、草稿编辑、负责人/协作方、优先级、截止日期和验收标准；
- 任务页草稿箱、来源回溯、来源级去重和命令幂等；
- 保存后整批撤销、单条忽略、整批归档；
- 部分转换失败重试；
- 确认创建正式任务且不自动派发；
- 真实 DSH 页面和会议来源端到端烟测。

### 18.2 P1：核心基线已实现

已实现：

- `collabTaskExecution` 正式任务执行端口；
- 执行者权限校验、进展上报、请求补充、交付物提交和评论；
- `dsh-collab-task-tools` Agent 工具插件；
- `task.read.v1`、`task.capture.v1`、`task.execute.v1` 能力分组；
- Task Tools HTTP catalog / invoke API；
- 最小 MCP JSON-RPC endpoint：`initialize`、`tools/list`、`tools/call`；
- 用户确认后的“创建并派发”，以及派发失败独立重试；
- 草稿批次 created / committed / undone 事件日志和轮询接口；
- 重复命令、任务 `creationKey`、派发确认 ID 和来源幂等。

### 18.3 P1 后续生产化项

以下不阻塞当前 P1 基线，但正式多产品部署前应继续完善：

1. MCP 增加 Streamable HTTP / SSE 会话恢复、MCP Session 和更完整的协议兼容。
2. Task 状态事件进入统一 durable outbox，与草稿事件合并为跨产品事件总线。
3. 工具调用使用更细粒度 Action Ticket，替代当前 Agent Run + Task Principal 绑定。
4. 增加工具级调用审计、速率限制、预算和跨租户隔离。
5. 将 Task Tools Public API 与 MCP Adapter 拆成独立部署单元，供外部 AI 伙伴产品接入。
