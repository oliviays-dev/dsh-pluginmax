# 任务草稿侧栏与会议候选任务技术方案

日期：2026-10-31

状态：方案已确认，分阶段实施中。

当前已落地：

- 统一 Side Panel Service 和 tab 类型注册。
- Facilitator 结构化候选契约、平台工具和只读消费端口。
- 自定义会议 Agent 绑定字段与统一 Runtime 派发路径。
- 交互稿对应的任务草稿侧栏、保存草稿和批量创建任务。

后续待补：

- Facilitator 候选产物的持久化和版本迁移表。
- 会议设置中选择自定义会议 Agent 的完整 GUI。
- 结构化 Facilitator 结果稳定后下线文本规则 fallback。

参考交互：

- `../任务草稿插件-交互设计稿.html`
- 仅参考其中“侧边栏 - 任务草稿”部分。其他页面、会议主区和演示数据不作为实现依据。

## 1. 目标

本方案解决三类问题：

1. 会议待办候选由平台注册的会议 Facilitator Agent 生成，不由任务草稿插件自行总结会议内容。
2. 任务管理负责任务草稿领域能力，包括接收会议候选、划词创建草稿、手工创建草稿、保存草稿和批量创建正式任务。
3. 右侧边栏由统一技术底座管理，沟通、数据洞察、任务草稿只注册 tab 类型和渲染能力，不各自维护一套侧栏状态机。

最终产品能力：

- 用户在沟通、会议或数据洞察中确认待办后，可以在统一右侧边栏中查看任务草稿。
- 任务草稿侧栏遵循交互稿：列表行、行内标题编辑、来源展开、编辑抽屉、手动添加、底部“保存到草稿箱”和“批量创建任务”。
- 会议候选的内容提炼和结构化由 Facilitator Agent 完成。
- 用户可以划线选中沟通内容，直接交由任务管理创建草稿。
- 未来可将默认会议 Facilitator 替换为用户自定义的会议 Agent，前提是遵循同一输出契约和平台 Agent 框架。

## 2. 架构结论

采用四条明确边界：

### 2.1 Facilitator Agent 负责“理解会议并产出候选待办”

会议 Facilitator 必须使用平台已有能力实现：

- 平台 Agent 定义
- AI 伙伴和 Persona 配置
- `TeammateRuntime.ensureRuntime`
- `MeetingMinutesAgentServiceLike.dispatch`
- 平台 Runtime、工具白名单、权限上下文、Run 审计

不得新增另一套 Agent 定义、Runtime 或 AI 伙伴体系。

Facilitator 的职责：

1. 读取会议对话、文件和上下文。
2. 生成会议纪要。
3. 输出结构化候选待办列表。
4. 保留 Agent Run、Agent 定义、Persona、来源消息等证据。

任务草稿插件不得调用模型总结会议，也不得通过正则或局部规则替代 Facilitator 的内容理解。

### 2.2 任务管理负责“任务草稿领域”

任务管理和 `dsh-collab-task-capture` 的职责：

- 接收 Facilitator 已生成的候选待办。
- 将候选转换为任务草稿。
- 提供划词创建任务草稿能力。
- 提供手工添加草稿能力。
- 保存到草稿箱。
- 编辑草稿字段。
- 批量创建正式任务。
- 记录任务来源和反向追溯。

任务管理不负责会议总结，也不决定会议中有哪些行动项。

### 2.3 统一 Side Panel Service 负责“侧栏容器和 tab 生命周期”

侧栏服务属于平台 UI 基础能力，负责：

- 打开、关闭、折叠、展开侧栏。
- tab 注册、创建、激活、关闭、排序、滚动到可视区域。
- tab 类型约束，例如任务草稿是否单例。
- tab 标题更新和会话绑定。
- 持久状态、键盘操作、拖拽排序和无障碍语义。

Side Panel Service 不负责：

- 沟通业务数据。
- 数据洞察会话和报告。
- 任务草稿领域数据。
- 任何 Agent 调用。

### 2.4 插件负责“注册自己的 tab 和渲染内容”

三个内置 tab：

| Tab 类型 | 注册方 | 多实例 | 默认标题 | 业务状态归属 |
| --- | --- | --- | --- | --- |
| `communication` | `dsh-collab-meeting` | 是 | 沟通 | meeting/ai-chat 服务 |
| `data-agent` | `dsh-collab-data-agent` | 是 | 数据洞察 | Data Agent 服务 |
| `task-drafts` | `dsh-collab-task-capture` | 否，单例 | 任务草稿 | task-capture/task 服务 |

## 3. 目标架构

```text
会议对话 / 会议文件 / 会议上下文
            |
            v
平台注册的会议 Facilitator Agent
  - Agent Definition
  - AI 伙伴 / Persona
  - Platform Runtime
  - Agent Run
            |
            | Structured Action Items
            v
Facilitator Candidate Store / Query Port
            |
            | 只读候选
            v
MeetingTaskCaptureSourceAdapter
            |
            v
dsh-collab-task-capture
  - task-capture session
  - draft batch
  - draft editing
  - save / commit
            |
            v
dsh-collab-task
  - formal task
  - task origin

用户划词 / 手工输入
            |
            v
Task Capture Manual API
            |
            v
Task Draft

Right Side Panel Service
  - registry
  - lifecycle
  - active tabs
  - layout state
        ^
        | register tab type + render slot
        |
communication / data-agent / task-drafts
```

## 4. 统一 Side Panel Service

### 4.1 服务位置

建议将当前位于 `dsh-collab-meeting/client/index.js` 的
`window.__pluginmaxSidePanel` 状态机迁移为平台级客户端服务。

推荐目录：

```text
plugins/dsh-collab-side-panel/
  package.json
  cordis.patch.yml
  client/index.js
  src/index.ts
```

如果暂不新增插件包，第一阶段可把纯客户端服务放入
`dsh-collab-shell/client/index.js`，但最终不应继续保留业务插件中的侧栏状态机副本。

### 4.2 客户端注册契约

```ts
interface SidePanelTabRegistration {
  type: string;
  defaultTitle: string;
  singleton?: boolean;
  closable?: boolean;
  draggable?: boolean;
  order?: number;
  newTabTitle?: (ordinal: number) => string;
  describe?: (tab: SidePanelTab) => SidePanelTabDescriptor;
}

interface SidePanelService {
  registerType(registration: SidePanelTabRegistration): () => void;
  getRegistry(): SidePanelTabRegistration[];

  getSnapshot(): SidePanelSnapshot;
  subscribe(listener: () => void): () => void;

  openType(type: string): string;
  openTab(tabId: string): void;
  openWorkspace(types: string[], activeType?: string): void;
  updateTab(tabId: string, patch: Partial<SidePanelTabMeta>): void;

  activate(tabId: string): void;
  closeTab(tabId: string): void;
  closeAll(): void;

  reorderTab(sourceTabId: string, targetTabId: string): void;
  setExpanded(expanded: boolean): void;
  toggleExpanded(): void;
}
```

约束：

- 业务插件只注册类型，不直接改全局数组。
- `task-drafts` 的 `singleton: true` 在服务层强制执行。
- tab 关闭后的邻近选择和键盘焦点由服务层统一处理。
- 关闭侧栏保留 `openTabs` 和 `activeTab`，重新打开时恢复。
- tab 渲染仍由所属插件通过 slot 提供，Side Panel Service 不包含业务组件。

### 4.3 注册示例

```ts
sidePanel.registerType({
  type: "task-drafts",
  defaultTitle: "任务草稿",
  singleton: true,
  closable: true,
  draggable: true,
});
```

```ts
sidePanel.registerType({
  type: "communication",
  defaultTitle: "沟通",
  newTabTitle: (n) => `新沟通 ${n}`,
  singleton: false,
  closable: true,
  draggable: true,
});
```

```ts
sidePanel.registerType({
  type: "data-agent",
  defaultTitle: "数据洞察",
  newTabTitle: (n) => `新数据洞察 ${n}`,
  singleton: false,
  closable: true,
  draggable: true,
});
```

### 4.4 状态归属

| 状态 | 归属 |
| --- | --- |
| tab 顺序、选中、折叠、展开 | Side Panel Service |
| tab 类型、单例规则、默认标题 | Side Panel Registry |
| 沟通会议 ID、会议详情 | meeting |
| Data Agent 会话 ID、报告 | data-agent |
| 草稿候选、草稿批次、编辑状态 | task-capture |
| 正式任务、任务来源 | task |

## 5. Facilitator Agent 候选待办契约

### 5.1 Agent 身份

默认实现继续使用平台已有会议 Facilitator：

- AI 伙伴 ID：`meeting-facilitator`
- Persona ID：`persona-meeting-facilitator`
- Runtime：`TeammateRuntime.ensureRuntime`
- Agent 派发：`MeetingMinutesAgentServiceLike.dispatch`

未来用户自定义会议 Agent 时，只替换会议绑定和 Agent 定义：

- Agent Definition 仍属于平台 Agent 定义体系。
- Persona 仍属于 AI 伙伴配置体系。
- Runtime 仍走平台 Runtime。
- 输出仍需满足候选待办契约。

不得为自定义会议 Agent 新建一套特殊 Agent 表或独立执行器。

### 5.2 结构化输出

建议新增 Facilitator 产物模型，而不是让任务插件解析 Markdown 纪要：

```ts
interface FacilitatorActionItem {
  id: string;
  meetingId: string;
  agentRunId: string;
  agentDefinitionId: string;
  personaId?: string;

  sourceItemKey: string;
  sourceMessageIds: string[];
  sourceExcerpt: string;

  title: string;
  description: string;
  receiverHint?: TaskParticipantHint;
  dueHint?: string;
  priorityHint?: "P1" | "P2" | "P3";
  acceptanceHints: string[];
  collaboratorHints: TaskParticipantHint[];
  evidenceRefs: string[];

  confidence: "high" | "medium" | "low";
  revision: number;
  generatedAt: string;
}
```

最低要求：

- `sourceItemKey` 稳定，可幂等。
- 保留来源消息 ID 和摘录。
- 保留来源 Agent Run 和 Agent 定义。
- 由 Facilitator 返回，不由 task-capture 拼装。

### 5.3 产出方式

推荐使用平台结构化输出或 Agent 工具调用：

1. Facilitator Run 输出会议纪要正文。
2. 同一次 Run 返回 `actionItems` 或调用平台注册的“提交会议候选待办”工具。
3. 平台保存候选待办及 Run 证据。
4. 任务草稿插件只调用只读 Candidate Query Port。

建议事件：

```text
meeting.facilitator.action-items.generated.v1
```

建议只读端口：

```ts
interface FacilitatorCandidateReader {
  list(input: {
    meetingId: string;
    sourceMessageIds?: string[];
    revision?: number;
  }): Promise<FacilitatorActionItem[]>;
}
```

### 5.4 替换自定义会议 Agent

会议配置中绑定“会议 Agent”：

```ts
interface MeetingAgentBinding {
  teammateId: string;
  agentDefinitionId: string;
  personaId?: string;
}
```

默认值指向平台 `meeting-facilitator`。用户切换会议 Agent 时：

- 不改变 task-capture 契约。
- 不改变任务草稿 UI。
- 不改变正式任务创建流程。
- 只改变 Facilitator Run 使用的 Agent 定义、Persona 和 Runtime。

## 6. 会议到任务草稿的链路

### 6.1 自动候选

```text
用户打开会议任务草稿
  -> task-capture 请求 MeetingTaskCaptureSourceAdapter
  -> adapter 查询当前会议 Facilitator 最新候选版本
  -> 返回 Facilitator 已结构化的候选
  -> task-capture 创建 capture session
  -> 侧栏展示任务列表
```

边界：

- task-capture 不调用 LLM。
- task-capture 不解析纪要 Markdown。
- task-capture 不从纯文本重新推导行动项。
- adapter 可以按用户选择的 messageIds 过滤候选，但不能重新总结。

### 6.2 划线创建

```text
用户在沟通/会议中划词
  -> 点击“创建对应任务”
  -> task-capture 接收 selection.text 和来源
  -> 创建一条手工候选草稿
  -> 自动切换到任务草稿 tab
```

划线创建属于任务管理能力。划线文本直接作为来源摘录和草稿初始内容，不做会议总结。

### 6.3 手工添加

```text
用户点击“手动添加一条待办”
  -> 本地新增未命名待办
  -> 用户直接改标题或打开编辑抽屉
  -> 保存到草稿箱
```

手工草稿不依赖会议候选，来源类型为 `manual`。

## 7. 任务草稿侧栏数据和交互

## 7.1 页面结构

严格对应交互稿的任务草稿部分：

1. 顶部只保留统一 Side Panel tabs。
2. 内容区是任务列表，不增加说明性头部。
3. 每行包含：
   - 选择框
   - 行内可编辑标题
   - 负责人、截止日期、优先级、来源
   - 编辑按钮
   - 展开后的来源摘录和建议字段
4. 列表底部有“手动添加一条待办”。
5. 底部固定操作区：
   - 已选中 N 项
   - 保存到草稿箱
   - 批量创建任务
6. 编辑按钮打开右侧抽屉：
   - 标题
   - 描述
   - 负责人
   - 截止日期
   - 优先级
   - 验收标准
   - 来源摘录

### 7.2 保存和创建

两者必须显式区分：

| 操作 | 结果 | 是否正式任务 | 是否派发 Agent |
| --- | --- | --- | --- |
| 保存到草稿箱 | 创建 task draft batch | 否 | 否 |
| 批量创建任务 | 调用 `commit(createMode=create-only)` | 是 | 否 |

批量创建前：

- 先保存草稿。
- 再补齐本地抽屉中的描述和验收标准。
- 调用 `draft/update` 更新每条草稿。
- 读取最新 batch revision。
- 调用 commit。

任务服务负责正式任务创建。task-tools 负责 Agent 能力适配。Agent 不得绕过用户确认自审或自动派发。

### 7.3 状态

前端状态只保存 UI 编排态：

- 当前选中的 candidate IDs。
- 已保存 draft 映射。
- 已创建 task ID 映射。
- 编辑抽屉草稿。
- 来源展开状态。

权威数据仍在 task-capture 服务：

- capture session
- candidate
- draft batch
- draft
- commit result

## 8. 模块职责

| 模块 | 负责 | 不负责 |
| --- | --- | --- |
| `dsh-collab-side-panel` 或 shell 平台服务 | tab 注册、生命周期、布局、快捷键、拖拽 | 业务数据、模型调用、草稿保存 |
| `dsh-collab-meeting` | 会议数据、Facilitator Run 协调、自定义会议 Agent 绑定 | 任务草稿 CRUD、正式任务创建 |
| 会议 Facilitator Agent | 总结会议、生成候选待办、保留证据 | 保存草稿、创建正式任务、侧栏管理 |
| `dsh-collab-teammate` / Agent Runtime | Agent 定义、Persona、Runtime、Run | 会议待办业务规则 |
| `dsh-collab-task-capture` | 接候选、划词/手工建草稿、草稿编辑、保存草稿、commit 编排 | 会议总结、LLM 生成待办、侧栏全局状态 |
| `dsh-collab-task` | 正式任务、任务状态、任务来源、任务管理 | 会议分析、侧栏生命周期 |
| `dsh-collab-data-agent` | 数据洞察会话和报告 | 任务草稿 |
| 沟通模块 | 对话、消息载体、划词来源 | 任务草稿领域逻辑 |

## 9. 当前实现差距

### 9.1 已具备

- 独立 `dsh-collab-task-capture` 服务。
- `TaskCaptureSourceRegistry`。
- task draft batch、draft update、save、commit、origin。
- meeting source adapter 已注册到 task-capture source registry。
- 现有 Agent Runtime 和会议 Facilitator 派发链路。
- 侧栏任务草稿 UI 已开始向交互稿收敛。

### 9.2 必须调整

1. 当前共享侧栏状态机仍在 meeting client 内，应迁移为平台服务。
2. 当前 `meetingCaptureTitle` 和文本切分仍是 meeting 插件内规则逻辑，不等同于 Facilitator Agent 产出，只能作为迁移期 fallback。
3. task-capture 不能继续将文本规则当作最终候选生成方案。
4. 需要定义 Facilitator structured action items 契约和保存位置。
5. 需要给会议绑定“会议 Agent”，默认指向平台 Facilitator，支持自定义 Agent 替换。
6. 侧栏 task-drafts UI 需继续严格对齐交互稿，不复用其他区域交互。

## 10. 迁移方案

### Phase 0：契约冻结

- 冻结 Side Panel tab registration 契约。
- 冻结 FacilitatorActionItem 契约。
- 冻结划线创建和手工添加 API 语义。
- 明确保存草稿与批量创建任务的区别。

### Phase 1：统一 Side Panel Service

- 从 meeting client 提取侧栏状态机。
- 建立 tab type registry。
- meeting、data-agent、task-capture 注册各自类型。
- 保留旧 API 兼容层，避免一次性改动全部调用方。

### Phase 2：Facilitator 结构化输出

- 扩展 Facilitator 平台 Agent 输出或工具。
- 保存 `FacilitatorActionItem[]` 和 Run 证据。
- meeting source adapter 只读取结构化候选。
- 文本规则仅作为显式 feature flag fallback，不与 Agent 结果混用。

### Phase 3：任务草稿侧栏

- 严格按交互稿实现任务行、编辑抽屉、手动添加、底部双动作。
- 保存草稿和批量创建任务分别走 task-capture 自有服务。
- 移除旧说明头部和无关底栏。

### Phase 4：自定义会议 Agent

- 会议配置支持选择会议 Agent。
- 默认绑定平台 `meeting-facilitator`。
- 自定义 Agent 使用同一 Runtime、Agent 定义、Persona 和结构输出契约。

## 11. 验收标准

### 11.1 架构验收

- task-capture 代码中不存在会议总结 Prompt 或模型调用。
- task-capture 不解析纪要 Markdown 生成待办。
- 会议候选包含 `agentRunId`、`agentDefinitionId`、来源消息。
- 切换自定义会议 Agent 后，task-capture API 和 UI 不变。
- 三个 tab 都由统一侧栏服务注册，不直接修改全局 tab 数组。
- 任务草稿 tab 单例约束由服务层执行。

### 11.2 功能验收

- Facilitator 生成候选后，任务草稿侧栏展示同一批候选。
- 划线后点击“创建对应任务”，直接打开任务草稿 tab。
- 手工添加可新增一条未命名待办。
- 行内标题可编辑。
- 编辑抽屉可修改完整字段。
- 保存到草稿箱后不创建正式任务。
- 批量创建任务后生成正式任务，未自动派发。
- 任务详情可追溯会议和原始消息。

### 11.3 GUI 验收

- 只参考交互稿任务草稿侧栏。
- 验证列表行、来源展开、编辑抽屉、手动添加、底部双按钮。
- 验证三个 tab 的打开、关闭、切换、拖拽、折叠、展开。
- 验证 1440 和 390 视口。
- Console 错误为 0。

## 12. 不在本期范围

- 不新增独立 Agent 执行器。
- 不让 Side Panel Service 承载会议或任务业务数据。
- 不让任务草稿插件自行总结会议。
- 不让任务插件直接驱动 Agent 派发。
- 不把自定义会议 Agent 做成与平台 AI 伙伴平行的第二套体系。

