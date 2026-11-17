# Data Agent 上下文组装统一设计

| 项目 | 内容 |
| --- | --- |
| 文档版本 | v0.1 |
| 日期 | 2026-10-29 |
| 状态 | 设计方案，未实施 |
| 上游依据 | `docs/data-agent-prd.md` v1.3、`docs/task-comment-consensus-context-design.md`、`docs/agent-task-home-session-design.md` |
| 调研对象 | 当前 dsh-pluginmax 实现、DeepSeek Harness ContextPack、Multica 开源实现、Codex 侧边对话交互原则 |
| 本轮边界 | 只做分析和方案设计，不修改业务代码 |

## 1. 结论摘要

当前问题不是“模型没有理解”，而是系统提供给 Data Agent 的上下文本身不完整：

1. Data Agent 的 SOUL 没有稳定进入运行时系统上下文。
2. 用户分享业务卡片后，前端只提交了标题和可见摘要，没有把卡片背后的标准对象、ID、版本、历史索引和能力边界交给服务端。
3. Data Agent 没有复用平台已有的 `ContextPack`、`ContextReceipt`、任务上下文适配器和记忆链路，而是自行拼接了一个扁平 Prompt。
4. 当前工具白名单里存在 `entity.read` 等名称，但仓库内没有找到对应的可调用数据工具实现；它们目前更像策略标签，而不是 Agent 真能执行的读取能力。

建议采用统一的分层上下文模型：

```text
稳定身份层
  Agent SOUL + 角色 + 平台安全策略 + 场景输出策略

会话层
  历史对话摘要 + 当前请求 + 用户澄清 +
  已分享对象引用

对象层
  标准对象身份 + 当前版本 + 权限范围 +
  卡片摘要 + 历史索引 + 相关片段

按需检索层
  entity.read / entity.search / entity.expand 等工具 +
  ContextReceipt + 审计
```

核心原则是：

- **用户分享业务卡片，等于授权 Data Agent 读取该对象及其受控关联信息，而不是只复制卡片上的几行字。**
- **初始 Prompt 只放“对象清单 + 身份 + 摘要 + 历史索引 + 必要片段”，完整历史通过工具渐进式读取。**
- **SOUL 属于稳定系统上下文，不重复写进每轮用户消息。**
- **普通对话和报告生成共用同一个 ContextPack；报告只是输出模式，不是第二套上下文系统。**
- **所有对象文本都按“证据”处理，不把卡片或历史消息中的内容提升为系统指令。**

## 2. 当前问题与证据

### 2.1 现象

截图中用户分享了完整的“切西瓜-产品 PRD 设计 · Agent Run 被中断”任务卡片，但 Data Agent 回复中没有任务 ID、Run ID、失败阶段、错误码、执行历史或关联产出物，只能基于“Agent Run 被中断”这行摘要推测原因。

这不是合理的上下文边界，而是对象引用丢失。

### 2.2 根因

#### 根因 A：SOUL 未进入运行时

当前 Data Agent 的创建链路会从 Teammate Runtime 得到 `personaId`，但 `plugins/dsh-collab-data-agent/src/index.ts` 派发 Agent Run 时没有把这个 `personaId` 继续传入 `agents.dispatch`，也没有把 Persona/Identity 作为系统上下文注入。

同时，Data Agent 当前自行构造 Prompt，没有使用 `plugins/dsh-collab-context` 的 IdentityResolver。该 Resolver 已经会从受保护模板读取 `soul`、`goals`、`scenarios`、模板版本并生成稳定的 `AgentIdentitySnapshot`。

结果：

- 用户看到的是 Data Agent 的通用 Prompt；
- Data Agent 看不到自己的 SOUL；
- 报告/对话行为容易退回模型默认习惯；
- 审计中也没有可追溯的 Soul Hash 和模板版本。

#### 根因 B：选区只提交“可见快照”

当前 `DataAgentSelectionContext` 能携带 `entityType`、`entityId` 和有限的 `snapshot`，但实际拼装 Prompt 时只使用了：

- 标题；
- 可见摘要；
- 来源页；
- 工作区；
- 可选的 entityId。

`snapshot.values`、对象版本、权限范围、历史索引、Run ID 和关联对象没有进入上下文。

#### 根因 C：通用卡片可能没有标准实体 ID

工作台有些卡片目前可能走通用 `workbench_card` 适配器，只产生标题和摘要，没有产生 `taskId`。一旦对象身份不成立，后续就无法调用任务服务、Run 服务或历史检索。

这类内容只能按“文本/页面片段”处理，不能假装用户分享了完整任务。

#### 根因 D：没有复用 ContextPack

平台已经具备：

- 稳定身份快照；
- 系统上下文与用户上下文分离；
- `mandatory / instruction / evidence` 权威级别；
- ContextPack；
- ContextReceipt；
- 预算裁剪；
- 来源引用；
- 项目记忆和 Agent 私有记忆。

`task` 适配器也已经能返回完整任务定义、结构化字段、时间线和关键共识。

但 Data Agent 没有调用这套能力，因此无法享受这些治理属性。

#### 根因 E：工具能力只存在于白名单名称中

当前 Data Agent 模版包含：

- `entity.read`
- `metric.query`
- `dataset.query.readonly`
- `ask_user_question`
- `report.render`
- `artifact.write`

但仓库内未发现 `entity.read`、`metric.query` 等实际可调用的 Provider 实现。仅写入白名单并不能让模型读取任务、历史或数据源。

### 2.3 不能接受的补救方式

以下方案不应采用：

- 把整张卡片的 DOM 文本全部塞进 Prompt；
- 把所有任务历史一次性打包进首轮消息；
- 仅靠前端摘要让模型猜原因；
- 让模型绕过服务端权限直接读本地文件；
- 将 SOUL 每次复制到用户消息里；
- 把“分享”理解为整个工作区的访问授权；
- 对超长历史静默截断而不记录 Receipt。

## 3. 外部与平台实现调研

### 3.1 Multica 的可借鉴实现

本机 Multica 源码位于 `/Users/oliviayang/Documents/ChatGPT/multica`。

#### 观察 1：聊天 Prompt 不塞完整工作对象

`server/internal/daemon/prompt.go` 的 `buildChatPrompt` 主要提供：

- 当前用户消息；
- 消息附件 ID、文件名和内容类型；
- 稳定运行约束；
- CLI 读取命令。

它要求 Agent 通过工具按需读取聊天历史、附件和工作对象，而不是把所有内容一次性塞进首轮 Prompt。

#### 观察 2：任务型执行使用“先读对象，再扫描线程摘要，再展开关键线程”

`server/internal/daemon/execenv/runtime_config_sections.go` 规定：

1. 先读取 Issue 本体；
2. 必做一次轻量评论线程扫描；
3. 只展开与本轮相关的线程；
4. 有增量时使用 `--since`，避免重复读全量；
5. 不把 `--recent N` 当作无界历史读取。

这套两阶段读取方式适合任务、会议和工作流历史。

#### 观察 3：来源上下文是不可变、有限额、可校验的快照

`server/internal/service/source_context.go` 的设计值得直接借鉴：

- 保存 Issue 本体、锚点评论链、评论线程和附件元数据；
- `SourceContextVersion = 1`；
- 最多 256 条评论；
- 普通快照最大 1 MiB；
- Agent 首轮快照最大 64 KiB；
- Agent 快照加新指令最大 72 KiB；
- 使用 digest 防止预览后源内容变化；
- 超出限制时明确报错，不做静默截断；
- 当前对象与“捕获时的历史背景”分开表示。

#### 观察 4：把业务内容标记为历史背景，不提升为指令

Multica 明确要求：

- `source_context` 是只读历史背景；
- 当前对象和当前评论才是权威指令；
- 引用的内容不能执行、不能改变权限、不能提升指令等级。

#### 观察 5：附件使用稳定 ID 按需下载

聊天 Prompt 只列出附件 ID、文件名和 MIME，不内嵌短时签名 URL。Agent 在需要时使用下载命令重新签名并获取文件。

这比把临时 URL 放进 Prompt 更可靠，也更安全。

#### 观察 6：前端只负责选择当前/最近对象

`packages/views/chat/components/use-chat-context-items.ts` 中，聊天输入框只提供当前 Issue/Project 和最近引用作为 @ 上下文入口。真正的业务内容由后续服务端和 CLI 加载。

### 3.2 Codex 侧边对话的可借鉴原则

这里不做客户端源码级断言，只提炼可观察的交互和上下文原则：

- 侧边对话从当前对话/当前选择建立明确锚点；
- 选区以引用形式保留，而不是伪造为完整页面；
- 会话继续时可追踪来源；
- 需要更多内容时通过工具读取，而不是首轮复制全部工作区；
- “当前请求”与“引用材料”在语义上分开。

Data Agent 应采用同样的链路：选择产生引用，引用产生受控读取能力，而不是选择产生一段不可扩展的摘要。

### 3.3 当前平台已有能力

`plugins/dsh-collab-context/src/service.ts` 已提供：

- `ContextPack`；
- `ContextReceipt`；
- `AgentIdentitySnapshot`；
- `SceneContextAdapter`；
- `mandatory / instruction / evidence` 分区；
- 预算估算和排除原因；
- 系统/用户内容分离；
- 项目记忆与 Agent 私有记忆；
- 来源 Ref 和权限投影。

`plugins/dsh-collab-task/src/index.ts` 的 Task Context Adapter 已提供：

- 任务 ID；
- 标题、类型、状态、优先级；
- 描述、验收标准、责任人、截止时间；
- 关联对象；
- 任务执行策略；
- 完整时间线；
- 关键共识 Contribution；
- 结构化 `historyText`。

结论：不需要设计第二套上下文系统，应该让 Data Agent 接入这套系统。

## 4. 设计目标与非目标

### 4.1 目标

1. Data Agent 每次运行都能看到稳定的 SOUL、角色、模板版本和安全策略。
2. 用户分享业务卡片后，Agent 至少能知道标准对象类型、ID、版本和可读取范围。
3. Agent 能获取卡片背后的受控摘要、历史索引和相关片段。
4. Agent 能在需要时按对象 ID 继续读取完整详情、线程、附件和关联对象。
5. 普通对话与报告生成共享同一个上下文快照。
6. 不同工作区、项目、私有会话之间严格隔离。
7. 每次运行都有 ContextReceipt、预算结果、来源引用和审计。
8. 超出上下文预算时不静默丢对象 ID 或伪造摘要。

### 4.2 非目标

- 不默认把完整数据库行或整个工作区注入 Prompt；
- 不默认把页面整页截图作为卡片上下文；
- 不允许 Prompt 中的业务文本改变平台安全策略；
- 不复制第二套 SOUL/权限/Runtime 体系；
- 不要求 Agent 在不知道对象 ID 时仍声称已读取完整对象；
- 不在 v1 引入复杂的向量数据库作为前置依赖。

## 5. 统一上下文模型

### 5.1 五层模型

| 层级 | 内容 | 权威级别 | 是否首轮全部发送 |
| --- | --- | --- | --- |
| L0 稳定身份 | SOUL、角色、目标、场景、模板版本、平台安全策略 | mandatory | 是 |
| L1 会话状态 | 当前请求、最近对话摘要、澄清状态、未完成输入 | instruction | 是，按预算 |
| L2 对象清单 | 共享对象引用、对象 ID、版本、标题、状态、权限状态 | mandatory | 是 |
| L3 对象摘要与索引 | 卡片摘要、关键字段、历史统计、最近/相关片段 | evidence | 是，按预算压缩 |
| L4 按需详情 | 完整时间线、评论线程、附件、Run、关联对象 | evidence | 否，通过工具读取 |

### 5.2 对象分享语义

用户分享对象时，系统应建立一个 `ReferenceGrant`，而不是只保存一条展示卡片。

`ReferenceGrant` 表示：

- 本次 Data Agent 会话可以引用该对象；
- 可以读取该对象本体；
- 可以读取平台为该对象定义的受控关联信息；
- 仍然只能使用当前用户和 Agent 共同拥有的权限；
- 不能扩展到同工作区的其他任意对象；
- 不能跨工作区；
- 对象删除或权限撤销后立即失效。

不同选择类型的默认范围：

| 选择类型 | 默认授权范围 |
| --- | --- |
| 任务卡片 | 任务本体、描述/验收、消息、评论线程、Run 元数据、附件、显式关联对象 |
| 工作流卡片 | 工作流定义/实例、节点、任务、执行记录、显式关联文档 |
| 工作流节点 | 节点、节点任务、Run、交付物、所属工作流摘要 |
| 会议卡片 | 会议概要、参与者、对话、纪要版本、附件 |
| 指标卡 | 指标 ID、口径、时间范围、数值快照、趋势数据、数据源引用 |
| 选中文本 | 仅选中文本和来源锚点，不自动扩大到整张卡片 |
| 图片/图表 | 媒体资源或数据快照，不自动扩大到整个页面 |

### 5.3 “对象卡片”与“通用卡片”必须区分

- `resolved object card`：有标准实体类型和 ID，可以建立 ReferenceGrant。
- `generic component card`：没有标准对象 ID，只能作为文本/组件快照，不能进入对象详情工具。

如果 UI 上看起来是业务卡片但适配器没有解析出 ID，Data Agent 应显示为“页面片段”，而不是静默当作完整业务对象。

聚合视图（工作台每日简报、重点关注、会议纪要等）里的卡片不能直接按组件处理。若条目包含
`deepLink.route + deepLink.refId`、`sourceDomain + sourceId` 或 `condition.refId`，前端必须先还原为
对应的标准实体标记：

- `task` → `data-task-id=<refId>`
- `workflow` → `data-workflow-id=<refId>`
- `meeting` → `data-data-agent-entity=meeting` + `data-data-agent-id=<refId>`

只有不存在任何标准引用时才降级为 `workbench_card`。例如每日简报
“切西瓜-产品PRD设计 · Agent Run 被中断”虽然展示为聚合卡片，但其 deep link 指向
`TSK-MV91RFMO-0492`，必须按 task 组装任务本体、两条 Agent Run、准确 runId 和错误信息，
不能只传“Agent Run 被中断”这行终态文案。

## 6. 选区上下文契约 v2

前端提交的上下文引用建议升级为：

```ts
type DataAgentContextReference = {
  schemaVersion: "data-agent-context-ref/2";
  kind: "component" | "metric" | "text" | "chart" | "media" | "record";
  entityType?:
    | "task"
    | "workflow"
    | "workflow_node"
    | "meeting"
    | "metric_card";
  entityId?: string;
  source: {
    workspaceId: string;
    projectId?: string;
    page: "workbench" | "task" | "meeting" | "project" | "workflow";
    entityRef?: string;
    timeRange?: { from: string; to: string };
  };
  preview: {
    title: string;
    excerpt: string;
    visibleFields?: Record<string, unknown>;
    imageRef?: string;
    componentSchemaVersion: string;
  };
  objectVersion?: {
    revision?: string;
    updatedAt?: string;
    capturedDigest?: string;
  };
};
```

约束：

1. 前端只提交渲染所需信息和对象引用。
2. 前端不能声明“已解析权限”；权限由服务端重新计算。
3. `entityType + entityId` 至少同时存在，才允许进入对象详情链路。
4. 缺 ID 的卡片只能进入文本/组件链路。
5. `preview` 是可丢失的展示快照，标准对象字段必须从服务端读取。
6. `objectVersion` 用于检测过期和增量，不作为权限凭证。

## 7. 共享对象上下文 Provider

### 7.1 为什么需要新的 Provider

现有 `SceneContextAdapter` 以场景为中心，适合任务执行、会议等固定场景；Data Agent 是“一个会话中携带多个业务对象”的跨场景 Agent，需要按 `SourceRef` 聚合多个对象。

建议在 `dsh-collab-context` 增加统一的 `SharedObjectContextProvider`，或将其作为现有 Adapter 的内部能力暴露出来。

### 7.2 建议接口

```ts
interface SharedObjectContextProvider {
  sourceType: SourceRef["type"];

  resolve(input: {
    ref: SourceRef;
    workspaceId: string;
    actorPrincipalId: string;
    agentPrincipalId: string;
  }): Promise<ObjectContextEnvelope>;

  loadSummary(input: {
    ref: SourceRef;
    asOf: string;
    budgetTokens: number;
  }): Promise<ObjectContextSummary>;

  loadHistoryIndex(input: {
    ref: SourceRef;
    asOf: string;
  }): Promise<ObjectHistoryIndex>;

  read(input: {
    ref: SourceRef;
    section: string;
    cursor?: string;
  }): Promise<ObjectContextChunk[]>;

  search(input: {
    ref: SourceRef;
    query: string;
    scope: "all" | "body" | "messages" | "comments" | "events" | "attachments";
    limit: number;
  }): Promise<ObjectContextChunk[]>;
}
```

### 7.3 标准返回

每个对象至少返回：

```ts
type ObjectContextEnvelope = {
  sourceRef: SourceRef;
  objectType: string;
  objectId: string;
  workspaceId: string;
  projectId?: string;
  title: string;
  status?: string;
  owner?: { type: string; id: string; name: string };
  revision?: string;
  updatedAt?: string;
  access: {
    allowed: boolean;
    reason?: string;
    canReadDetails: boolean;
    canReadHistory: boolean;
    canReadAttachments: boolean;
  };
  history: {
    messageCount: number;
    commentCount: number;
    runCount?: number;
    attachmentCount: number;
    lastActivityAt?: string;
    unresolvedThreadCount?: number;
  };
  linkedRefs: SourceRef[];
  retrievalHints: string[];
};
```

## 8. Data Agent 上下文组装流水线

### 8.1 运行前

1. 校验当前用户、工作区、项目、会话归属。
2. 将前端 selection 解析为标准 `SourceRef`。
3. 对每个对象执行服务端 resolve：
   - 是否存在；
   - 是否属于当前工作区；
   - 用户与 Agent 的权限交集；
   - 当前 revision。
4. 生成/更新 `ReferenceGrant`。
5. 根据当前问题判断模式：`chat` 或 `report`。

### 8.2 ContextPack 准备

`DataAgent` 应以如下参数调用 `collabContext.prepare`：

```text
scene: chat
chatCarrier: data-agent
objectId: dataAgentConversationId
agentPrincipalId: ensuredRuntime.principalId
teammateId: data-agent
actorPrincipalId: currentUserId
explicitRefs: 当前消息与历史有效对象引用
input: 当前问题
runtimeCapabilities: 当前 Runtime 的上下文窗口和是否无状态
```

ContextPack 应包含：

1. `agent-identity`：
   - SOUL；
   - name、role、goals、scenarios；
   - 模板版本；
   - Soul Hash。
2. `platform-policy` 与 `scene-policy`：
   - 只读；
   - 最小权限；
   - 写操作必须走票据；
   - 普通对话/报告模式规则。
3. `scene-facts`：
   - 当前 Data Agent 会话摘要；
   - 最近对话；
   - 当前未完成事项。
4. `shared-object-context`：
   - 对象清单；
   - 对象摘要；
   - 历史索引；
   - 相关片段。
5. `project-memory`：
   - 项目真值、决策、约束和交接。
6. `references`：
   - 所有 SourceRef 和版本。
7. `current-input`：
   - 用户本轮问题；
   - 模式要求。

### 8.3 Runtime 派发

Data Agent 应：

- 将 `ensured.personaId` 传给 Agent Run；
- 将 `contextPackId` 和 `sessionBindingId` 传给 Agent Run；
- 使用 ContextPack 的 `rendered.systemText` 作为稳定系统上下文；
- 使用 `rendered.userText` 作为本轮输入；
- 将对象读取工具绑定到当前 ContextPack 的 ReferenceGrant；
- 运行后调用 `recordRuntime` 写 ContextReceipt。

### 8.4 运行后

记录：

- ContextPack ID；
- ContextReceipt ID；
- Agent 模板版本和 Soul Hash；
- 本轮请求；
- 实际加载的对象和版本；
- 每次对象检索、读取、搜索的 SourceRef；
- 被预算排除的 section 及原因；
- 输出模式和最终报告/普通消息引用。

## 9. 渐进式加载策略

### 9.1 L0：引用清单，永远完整

不占大量 token，但绝不能被预算裁掉：

```text
- task:TSK-...
  title: ...
  status: ...
  revision: r17
  access: readable
  history: 42 messages / 8 threads / 6 runs
```

对象 ID、类型、工作区、权限状态和 version 是不可裁剪字段。

### 9.2 L1：对象摘要

每个对象生成 300–1,500 tokens 的可读摘要：

- 任务：描述、验收、当前状态、责任人、截止时间；
- 工作流：实例状态、当前节点、阻塞项；
- 会议：议题、结论、待办、纪要版本；
- 指标：定义、时间范围、当前值、对比、维度。

摘要必须包含 canonical ID。

### 9.3 L2：历史索引

不直接加载所有历史，而是先加载索引：

```text
历史索引：
- task messages: 38
- comments: 9 threads / 27 replies
- agent runs: 4
- attachments: 6
- last activity: ...
- unresolved: 1 blocked node, 1 waiting_input run
```

### 9.4 L3：相关片段

v1 使用确定性选择：

- 最近 N 条；
- 当前未解决消息；
- 与查询关键词匹配的消息；
- 与 Run 中断相关的失败/Run 事件；
- 用户明确引用/锚定的线程。

v2 可增加 BM25、关键词扩展或 embedding 检索，但不能替代 SourceRef。

### 9.5 L4：按需工具读取

推荐工具：

| 工具 | 作用 |
| --- | --- |
| `entity.read`（Runtime 暴露名 `entity_read`） | 按对象 ID 读取标准字段 |
| `entity.history`（Runtime 暴露名 `entity_history`） | 分页读取时间线/线程索引 |
| `entity.expand`（Runtime 暴露名 `entity_expand`） | 展开评论线程、Run、附件或关联对象 |
| `entity.search`（Runtime 暴露名 `entity_search`） | 在单个对象范围内检索 |
| `metric.query` | 按指标 ID 和口径读取数据 |
| `dataset.query.readonly` | 只读数据查询 |
| `ask_user_question` | 上下文确实不足时向用户澄清 |

工具必须绑定当前 ContextPack 和 ReferenceGrant，不能仅凭任意对象 ID 读取。

> Runtime Profile 与 PRD 继续使用点号命名的产品级工具名；内置模型 Runtime 在注册和下发前统一把点号替换为下划线。原因是 Provider 要求 function name 匹配 `^[a-zA-Z0-9_-]+$`，例如 `entity.read` 会使首轮请求返回 400。

## 10. 上下文预算与压缩

### 10.1 预算顺序

ContextPack 使用运行时的真实窗口能力，不使用固定字符数硬编码。建议按以下顺序分配：

1. 身份、平台策略、场景策略：mandatory，不可裁；
2. 当前用户请求：完整保留；
3. 对象清单和 SourceRef：完整保留；
4. 对象摘要：按优先级压缩；
5. 历史索引：压缩到结构化计数和未解决项；
6. 相关片段：按 token 预算截取；
7. 记忆：按相关性和置信度加载；
8. 详情历史：不预加载，交给工具。

### 10.2 压缩等级

```text
full      完整结构
extracted 保留 ID、类型、时间、状态、关键字段和引用
referenced 只保留对象清单与读取入口
```

任何压缩都不能丢失：

- 对象 ID；
- 对象类型；
- workspace ID；
- 权限状态；
- 源版本；
- `SourceRef`。

### 10.3 超限处理

- `mandatory` 超过预算：fail closed，返回 `identity_over_budget`。
- 对象摘要超过预算：降级为 `extracted` 或 `referenced`。
- 历史片段超过预算：只保留索引和检索工具。
- 附件超过预算：只保留附件 ID/文件名/MIME。
- 任何排除都要进入 ContextPack `excluded` 和 ContextReceipt。

### 10.4 摘要缓存

允许服务端生成摘要，但必须：

- 使用对象 revision + provider 版本 + 摘要器版本作为缓存键；
- 原文变化后失效；
- 摘要不能替代 SourceRef；
- 摘要失败时回退到确定性提取；
- 摘要不保存未经脱敏的敏感字段；
- 审计记录摘要版本。

## 11. 任务对象上下文规范

这是 MVP 最高优先级适配器，也是当前截图问题的直接修复对象。

### 11.1 首轮必须包含

- `taskId`；
- 标题、类型、状态、优先级；
- 项目/工作区；
- 创建人、当前责任人；
- 创建时间、截止时间、最近更新时间；
- 描述；
- 验收标准；
- 关联对象（工作流、会议、文档）；
- 时间线计数；
- 评论线程计数；
- Agent Run 计数；
- 最近一次相关 Run 的状态、时间和错误摘要；
- 当前未解决问题。

### 11.2 历史读取分层

任务历史不建议一次性注入全部内容，分为：

1. `task.messages`：执行反馈、人类指令、Agent 输出；
2. `task.comments`：讨论线程；
3. `task.events`：状态变化、升级、阻塞；
4. `task.runs`：Agent Run 摘要、失败原因、执行元数据；
5. `task.attachments`：附件 ID 和下载入口。

对于“分析 Agent Run 被中断原因”，首轮上下文应至少包含：

- 相关 `agentRunId`；
- Run status；
- 错误/失败原因；
- 开始和结束时间；
- 执行 Runtime/Profile；
- 最近任务时间线；
- 关联输出或交付物；
- 未成功完成的消息或节点。

如果详细失败原因需要完整日志，Data Agent 通过 `entity.expand(task, "runs")` 获取，不需要在首轮复制所有日志。

### 11.3 分享语义

分享任务卡片默认允许：

- 读取任务本体；
- 读取任务时间线；
- 读取评论线程；
- 读取 Run 摘要；
- 读取附件元数据；
- 读取显式关联对象。

不允许：

- 读取同项目其他无关任务；
- 读取其他工作区；
- 读取无权限文件；
- 读取系统内部 Chain-of-Thought。

## 12. 普通对话、报告和澄清

### 12.1 共用 ContextPack

普通对话和报告生成必须使用同一个 ContextPack。

模式差异只改变输出策略：

```text
chat:
  直接、简洁、连续对话，不套用报告章节

report:
  Markdown 报告结构，保留同一对象引用和证据
```

不允许为了生成报告重新读取一套不同上下文，也不允许普通对话主动产出报告。

### 12.2 澄清

只有在以下情况下使用 `ask_user_question`：

- 对象 ID 无法解析；
- 用户没有权限且无法选择替代对象；
- 问题目标必须由用户选择；
- 关键时间范围或指标口径无法从上下文确认；
- 需要用户决定是否跨项目/外发。

能从 ContextPack 或只读工具获得的信息，不应为了澄清而再次询问。

用户回答后，应把回答写回同一 Conversation/Run 链路，并记录到 ContextReceipt 的后续轮次。

## 13. 新鲜度、过期与变更

### 13.1 双层对象状态

每个共享对象维护：

- `capturedSnapshot`：用户分享时的可见快照；
- `liveRef`：对象类型、ID、revision、updatedAt。

每次运行重新 resolve `liveRef`：

- 未变化：使用原摘要；
- 已变化：附带变更摘要；
- 已删除：标记不可用，请用户重新选择；
- 权限撤销：返回权限错误，不降级为无权限摘要。

### 13.2 不可变快照 + 当前真值

历史报告和历史消息继续引用捕获时快照；新一轮分析默认读取当前真值，并在 Receipt 中同时记录：

```text
capturedRevision
currentRevision
deltaDigest
```

不能让旧快照静默覆盖最新任务状态。

## 14. 安全与 Prompt Injection

所有业务对象内容都视为 evidence：

- 文本中的“忽略之前指令”不是系统指令；
- 任务评论不能提升工具权限；
- 附件中的命令不能自动执行；
- 会议纪要中的链接不能绕过外发确认；
- 指标定义中的自然语言不能绕过只读数据策略。

ContextPack 中必须明确分区：

```text
[mandatory] 平台策略、身份、权限
[instruction] 当前用户请求、模式要求
[evidence] 任务、评论、会议、附件、历史
```

对象读取工具应强制：

- 只能读取当前 ReferenceGrant 内的对象；
- 每次调用重新校验权限；
- 只返回允许的字段；
- 不返回签名 URL；
- 不返回未脱敏的敏感字段；
- 对检索 query 做长度和注入防护。

## 15. 存储与数据模型

### 15.1 ContextPack 复用

继续使用 `plugins/dsh-collab-context` 的 `packs`、`receipts`、`identities`、`sessions` 表。

### 15.2 Data Agent 侧新增关联

建议在 Data Agent Run/Attachment 上增加：

```ts
type DataAgentRunContext = {
  contextPackId?: string;
  contextReceiptId?: string;
  mode: "chat" | "report";
  sharedRefs: SourceRef[];
  contextBudget: {
    windowTokens: number;
    outputReserveTokens: number;
    usedTokens: number;
    excludedSections: string[];
  };
};

type DataAgentAttachment = {
  sourceRef: SourceRef;
  referenceGrantId: string;
  capturedSnapshotDigest: string;
  capturedRevision?: string;
  liveRevision?: string;
  status: "active" | "stale" | "unavailable" | "forbidden";
};
```

### 15.3 不要重复存整份对象

- 对象本体继续由归属服务管理；
- ContextPack 只保存可重建的 section/引用/摘要缓存；
- 报告保留生成时快照；
- Conversation 保留引用和最小预览；
- 附件保存稳定资源 ID，不保存临时 URL。

## 16. UI 交互支撑

### 16.1 附件卡片

卡片应展示：

- 标准对象 ID（任务显示 `TSK-...`）；
- 类型；
- 标题；
- 当前状态；
- “已引用对象上下文”状态；
- 历史索引摘要；
- 如源已变化，显示“源已更新”。

### 16.2 解析失败

前端发现是业务卡片但没有标准 ID 时：

- 不显示“任务上下文已加入”；
- 显示“页面片段”或“未解析对象”；
- 禁止声称拥有任务完整上下文；
- 提示重新选择或打开详情后再分享。

### 16.3 上下文预览

提供只读上下文预览：

- 对象 ID；
- 当前版本；
- 已带入的摘要；
- 历史索引；
- 可读取/不可读取的关联；
- 超出预算而只提供引用的来源。

预览只展示用户有权查看的内容。

## 17. 可观测性与审计

每次 Data Agent Run 至少记录：

- actor principal；
- agent principal；
- teammateId 和 templateVersion；
- soulHash；
- contextPackId；
- contextReceiptId；
- 当前模式和当前请求；
- 选中对象及 SourceRef；
- 对象 revision；
- 初始加载的 section；
- 预算排除原因；
- 工具调用对象和返回行数；
- 权限拒绝记录；
- 报告或普通消息引用。

关键指标：

- 选区解析成功率；
- 分享对象可解析 ID 比率；
- 首轮上下文平均 token；
- 预算排除率；
- 工具追加读取率；
- 因对象失效重新选择率；
- 选任务后成功引用任务 ID 的比例；
- 跨工作区拒绝次数；
- 普通对话被误判为报告的比例。

## 18. 失败策略

| 场景 | 处理 |
| --- | --- |
| 对象 ID 缺失 | 降级为页面片段，不声称完整对象 |
| 对象已删除 | 标记 unavailable，要求重新选择 |
| 用户无权限 | 返回 forbidden，不返回摘要 |
| Agent 无权限 | 提示权限不足，不窃取用户权限 |
| 历史超预算 | 只放历史索引 + 工具入口 |
| ContextPack 服务不可用 | 明确降级为“仅当前摘要”，UI 和 Receipt 标记 degraded |
| SOUL 缺失 | fail closed，不发起 Run |
| ContextReceipt 写入失败 | Run 可完成，但标记审计不完整，并告警 |
| 摘要生成失败 | 回退确定性提取 |

## 19. 测试策略

### 19.1 单元测试

- 选区适配器：task/workflow/workflow_node/meeting/metric 必须产生标准 ID；
- 通用卡片：不得伪造标准实体；
- SOUL 快照：templateVersion、soulHash 正确进入 Identity；
- 对象 Provider：resolve、summary、history index、search、expand；
- 权限：工作区不匹配、对象不存在、权限撤销；
- 预算：mandatory 不裁剪、对象清单不裁剪、超限有 excluded；
- 增量：同一对象 revision 未变不重复注入；
- stale：源内容变化时产生 delta 或 stale 标记；
- 摘要缓存：revision 或 adapter version 变化后失效。

### 19.2 Contract 测试

- Data Agent Run 必须带 `contextPackId`；
- ContextReceipt 必须包含 identity.soulHash；
- 任务分享上下文必须出现 taskId；
- 普通对话不得出现报告输出契约；
- 报告请求只能改变输出策略，不改变对象引用；
- 选中文本不能自动扩大成任务对象；
- 未注册卡片不能产生 entity 工具权限。

### 19.3 集成测试

1. 从工作台选择任务卡片。
2. 服务端解析 taskId、workspaceId、revision。
3. ContextPack 中同时出现任务定义、历史索引和 Object ID。
4. 用户追问“Agent Run 为什么被中断”。
5. Agent 调用 `entity.expand(task, runs)` 获取失败 Run。
6. 回答中包含 Run ID 和失败原因，不声称已读取未授权日志。

### 19.4 GUI 测试

- 任务卡片附件显示任务 ID 和“上下文已解析”；
- 通用卡片显示“页面片段”；
- 源更新后显示 stale；
- 普通对话不生成报告；
- 报告模式沿用相同上下文；
- 澄清问题出现后回答并继续；
- 切换工作区后旧对象引用失效。

## 20. 分阶段落地

### Phase 1：修复身份和对象清单

- Data Agent 接入 `collabContext.prepare`；
- 传入 `ensured.personaId`；
- 新增 `data-agent` chat carrier；
- 选区 v2 契约；
- 任务 Provider 的 resolve、summary、history index；
- ContextPack 和 ContextReceipt 落库；
- 任务分享必须带 taskId。

### Phase 2：工具化渐进读取

- 实现 `entity.read`；
- 实现 `entity.history` / `entity.expand` / `entity.search`；
- 接入任务、工作流、会议、指标对象 Provider；
- 附件 ID 化；
- 权限和审计绑定 ContextPack。

### Phase 3：摘要与记忆

- 历史摘要缓存；
- BM25/embedding 辅助相关性排序；
- ContextReceipt 增量；
- 项目记忆和 Agent 私有记忆；
- stale/delta 展示。

### Phase 4：体验与治理

- 上下文预览面板；
- 预算可视化；
- 对象变更提醒；
- 运行回放；
- 跨页面对象引用质量指标。

## 21. 关键设计决策

| 编号 | 决策 | 备选 | 选择理由 |
| --- | --- | --- | --- |
| D1 | 复用现有 ContextService | 新建 Data Agent 专用 Prompt | 已有 SOUL、权限、预算和 Receipt 能力 |
| D2 | 对象分享建立 ReferenceGrant | 仅传递 DOM 摘要 | 满足用户对业务卡片的真实预期 |
| D3 | 摘要 + 历史索引 + 按需工具 | 全量注入 | 既保留上下文完整性，又控制窗口 |
| D4 | SOUL 放稳定 system section | 每轮拼进 user message | 可缓存、可审计、不会漂移 |
| D5 | 捕获快照与实时对象分离 | 只存快照或只读实时 | 历史报告可复现，新分析可更新 |
| D6 | 超限时降级为引用而非静默截断 | 继续丢字 | 保留可发现性和可追溯性 |
| D7 | 普通对话和报告共用 ContextPack | 两套上下文 | 避免证据和行为分叉 |

## 22. 风险与待确认

### 风险

- 业务对象的“所有相关信息”边界仍需按实体类型治理，不能等同于整个工作区。
- 历史摘要可能引入二次失真，必须保留原文引用和工具回读。
- 任务、会议、工作流的数据量差异大，统一预算策略需要实际运行数据校准。
- 外部 Runtime 可能是无状态进程，增量 ContextReceipt 需要重新水合摘要。
- 现有 `entity.read` 等工具还没有实现，必须先补齐能力，不能只更新文档。

### 待确认

1. 任务分享默认是否包含所有评论线程，还是只包含已确认关键共识？建议：允许读取索引，默认只预载关键共识和最新相关线程。
2. Agent 是否可以读取 Run 的完整原始日志？建议只开放结构化任务相关日志，不开放内部推理。
3. 指标卡的完整数据行权限如何按用户行级权限过滤？建议由数据连接层返回权限后的聚合，不把原始行直接注入。
4. 外部 Runtime 不支持 system/user 分区时，是否需要把稳定上下文摘要压到首条 user message？建议有兼容降级，但 Receipt 标记。
5. 摘要是否需要专用模型？建议第一阶段使用确定性提取，第二阶段再引入可审计摘要模型。

## 23. 与 PRD 的对应关系

| PRD 内容 | 本设计对应 |
| --- | --- |
| 7.9 最小上下文契约 | 升级为 `DataAgentContextReference v2` |
| 10.1 数据与对象范围 | ReferenceGrant 与对象 Provider |
| 10.2 分析上下文优先级 | 五层上下文模型与预算顺序 |
| 10.3 工具与副作用 | 只读对象工具、人工确认边界 |
| 10.4 安全与审计 | ContextReceipt、SourceRef、权限复核 |
| 18 归档与归属 | ContextPack/Receipt 与 Data Agent Run 关联 |
| 19.3 实体选择适配器 | SharedObjectContextProvider |

## 24. 参考实现与资料

### 本地平台

- `plugins/dsh-collab-context/src/service.ts`
- `plugins/dsh-collab-context/src/models.ts`
- `plugins/dsh-collab-task/src/index.ts`
- `plugins/dsh-collab-data-agent/src/index.ts`
- `plugins/dsh-collab-data-agent/src/models.ts`
- `plugins/dsh-collab-teammate/src/runtime.ts`
- `docs/task-comment-consensus-context-design.md`
- `docs/agent-task-home-session-design.md`

### Multica 本地源码

- `/Users/oliviayang/Documents/ChatGPT/multica/server/internal/daemon/prompt.go`
- `/Users/oliviayang/Documents/ChatGPT/multica/server/internal/daemon/execenv/runtime_config_sections.go`
- `/Users/oliviayang/Documents/ChatGPT/multica/server/internal/service/source_context.go`
- `/Users/oliviayang/Documents/ChatGPT/multica/packages/views/chat/components/use-chat-context-items.ts`
- `/Users/oliviayang/Documents/ChatGPT/multica/apps/web/content/use-cases/auto-data-analysis.zh.mdx`

### 外部资料

- Multica 自动数据分析用例：https://multica.ai/usecases/auto-data-analysis

## 25. 验收标准

- Data Agent 运行上下文中能看到当前模板 SOUL、模板版本和 Soul Hash。
- 分享任务卡片后，首轮上下文包含标准 taskId、workspaceId、revision 和历史索引。
- Agent 能通过工具读取任务时间线、Run 摘要和评论线程，不需要用户重复描述。
- 首轮上下文不会无界加载所有历史。
- 普通对话和报告使用同一个对象上下文快照。
- 跨工作区对象、未授权附件、未解析卡片均有明确失败或降级状态。
- 每次运行可追溯到 ContextPack 和 ContextReceipt。
- 用户可在界面上看到“引用了哪个对象、哪些历史只提供了索引、哪些来源因预算未展开”。

