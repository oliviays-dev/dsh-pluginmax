# Data Agent Runtime Profile 配置说明

> 文档版本：v1.0  
> 状态：设计评审稿  
> 层级：Runtime / 执行能力层  
> 上级文档：[data-agent-general-query-technical-design.md](./data-agent-general-query-technical-design.md)

---

## 1. 层职责

Runtime Profile 回答：

> Data Agent 用什么执行通道、什么模型、调用哪些工具、受什么资源范围和预算限制。

Runtime Profile 不负责：

- Data Agent 的 SOUL 和业务口径；
- 具体数据集的字段和指标公式；
- 用户可访问哪些订单；
- AI伙伴实例的默认项目、时区或订阅；
- 报告正文和澄清问题文案。

## 2. 当前平台模型

当前 Runtime 由以下对象组成：

| 对象 | 作用 |
| --- | --- |
| AI Principal / teammate runtime identity | 系统 Agent 的稳定执行身份 |
| Agent Profile | 绑定 persona、执行方式、模型/工具白名单 |
| External Agent Runtime | Codex / Codebuddy / 通用命令执行通道 |
| Runtime Profile | 工作区视角下的运行配置和工具策略 |
| Agent Run | 一次实际执行及工具、事件、结果和审计 |

当前已实现字段以 `dsh-collab-teammate`、`dsh-collab-agent` 为准：

- `workspaceId`
- `name`
- `personaId`
- `execution: "builtin" | "external"`
- `externalRuntimeId`
- `runtimeKind`
- `allowedTools`
- `status`

以下为 Data Fabric 需要增加的 Runtime 能力字段，属于技术设计目标，不代表当前已实现：

- `resourceScopes`
- `dataConnectionScopes`
- `maxRows`
- `maxScannedBytes`
- `maxTurns`
- `maxMinutes`
- `resultTokenBudget`

## 3. 执行方式

### 3.1 平台内置 Runtime

适用：

- 默认工作区；
- 无外部 CLI 依赖；
- 平台统一升级和审计；
- 先完成订单域闭环。

要求：

- 工具仍通过平台 Tool Registry 注册；
- 不能因为使用内置模型而绕过 Data Fabric；
- SOUL、ContextPack 和工具结果仍进入同一 ContextReceipt。

### 3.2 外部 Runtime：Codex

适用：

- 需要用户本机或专用执行节点；
- 需要外部 CLI 的规划、代码或文件能力；
- 工作区已经配置 Codex Runtime。

必须固定：

- `provider=codex`
- 协议
- 命令
- 工作区根目录
- 支持工具
- 支持模型
- 安全沙箱和网络策略

Data Agent 使用外部 Runtime 时仍不能获得 OS 用户之外的数据权限；数据查询必须走 Data Fabric 工具。

### 3.3 外部 Runtime：Codebuddy

复用与 Codex 相同的结构，只替换：

- `provider=codebuddy`
- 启动命令和参数
- 事件协议适配
- 模型与工具能力声明

不允许为 Codebuddy 复制第二套 Agent Run、ContextPack 或权限逻辑。

## 4. 工具配置

### 4.1 Data Agent 工具集合

产品级工具名：

| 工具 | 是否查询数据 | 说明 |
| --- | --- | --- |
| `entity.read` | 否 | 读取显式分享的 task/workflow/meeting |
| `data.catalog.search` | 否 | 搜索授权数据集和指标 |
| `dataset.describe` | 否 | 读取字段、维度、时间和限额 |
| `query.explain` | 否 | 预检范围、成本和权限 |
| `metric.query` | 是 | 查询认证指标 |
| `dataset.query.readonly` | 是 | 参数化只读聚合 |
| `report.render` | 否 | 基于已有结果生成报告 |
| `artifact.write` | 写 Artifact | 只写平台报告资产，不写业务库 |
| `ask_user_question` | 否 | 结构化澄清 |

Provider 实际名称示例：

- `data_catalog_search`
- `dataset_describe`
- `metric_query`
- `dataset_query_readonly`
- `query_explain`

### 4.2 工具白名单原则

1. `allowedTools` 只能表达 Runtime 能力上限；
2. 模版只能声明所需工具，不能扩展 Runtime 上限；
3. AI伙伴实例不能新增 Runtime 未支持的工具；
4. Data Fabric 可以因连接器不可用而临时不暴露查询工具；
5. 不存在的工具不能仅通过白名单“伪造可用”。

### 4.3 禁止工具

默认拒绝：

- `database.write`
- `database.ddl`
- `task.assign`
- `workflow.complete`
- `permission.grant`
- `external.send`
- 任意 shell 网络访问工具，除非 Runtime 有独立治理

## 5. 资源和预算

### 5.1 当前可配置

- 允许工具；
- builtin / external；
- external runtime id；
- 模型与推理强度（由 Agent model selection 提供时）。

### 5.2 目标配置

| 字段 | 默认 | 说明 |
| --- | --- | --- |
| `resourceScopes` | `workspace:<current>` | 工作区、项目、dataset authorized |
| `dataConnectionScopes` | 空 = 动态授权 | 只允许指定连接 |
| `maxRows` | 500 | 单次查询返回上限 |
| `maxScannedBytes` | 按连接器 | 防止大范围扫描 |
| `maxTurns` | 24 | 单次 Agent Run 回合 |
| `maxMinutes` | 15 | 单次 Agent Run 时长 |
| `resultTokenBudget` | 8k | QueryResult 摘要和样本预算 |

这些字段需要 data-fabric 和 agent-runtime 代码实现，不是仅修改模版文本。

## 6. 推荐配置

```yaml
runtimeProfile:
  id: drp-data-agent-default
  workspaceId: ws-supply
  name: Data Agent 默认分析运行时
  execution: builtin
  model:
    provider: platform-default
    reasoningEffort: medium
  allowedTools:
    - entity.read
    - data.catalog.search
    - dataset.describe
    - query.explain
    - metric.query
    - dataset.query.readonly
    - report.render
    - artifact.write
    - ask_user_question
  deniedTools:
    - database.write
    - database.ddl
    - task.assign
    - workflow.complete
    - permission.grant
  resourceScopes:
    - workspace:ws-supply
    - project:project-supply
    - dataset:authorized
  budget:
    maxRows: 500
    maxScannedBytes: 1000000000
    maxTurns: 24
    maxMinutes: 15
    resultTokenBudget: 8000
  status: active
```

外部 Runtime 示例：

```yaml
externalRuntime:
  id: ext-data-agent-codex
  provider: codex
  protocol: codex-jsonl
  command: codex
  workspaceMode: project
  supportedTools:
    - entity.read
    - data.catalog.search
    - dataset.describe
    - metric.query
    - dataset.query.readonly
    - report.render
    - artifact.write
  supportedModels:
    - platform-approved-model-a
  status: active
```

## 7. 配置校验

保存 Runtime Profile 时必须校验：

1. workspace 存在；
2. external runtime 存在且 active；
3. 工具名能映射到已知 Provider；
4. 模版声明的工具没有被 Runtime 裁剪后完全缺失；
5. resource scope 没有超出工作区；
6. budget 不超过平台上限；
7. 禁止工具不能被允许工具覆盖。

警告而非阻断：

- `data.catalog.search` 存在但 query 工具不存在：只能完成数据发现，不能查询；
- external runtime 支持工具但当前未挂载 Data Fabric：查询能力不可用；
- dataset scope 为空：按动态数据授权解析，不代表拒绝全部数据。

## 8. 配置与代码边界

### 配置

- execution；
- model / reasoning；
- allowed / denied tools；
- resource scope；
- budget；
- external runtime binding；
- status。

### 代码

- Tool Provider；
- external runtime adapter；
- 工具限制和审批；
- resource scope enforcement；
- data-fabric request forwarding；
- ContextReceipt 记录；
- Agent Run 终止和审计。

## 9. Reset 与版本

- 修改 Runtime Profile 不修改 Data Agent 模版 SOUL；
- 修改 Runtime Profile 不删除历史 Run；
- Reset 工作区时恢复默认 Runtime 配置；
- 历史 Agent Run 保留当时 profile 快照；
- 外部 Runtime 归档后：
  - 不再接受新 Run；
  - 历史 Run 可读；
  - Data Agent 实例回退策略由工作区配置决定，不静默窃取其他 Runtime。

## 10. 两步实施中的 Runtime

### 第一步：产品模块能力建设

- 接入通用 catalog / describe / explain / query 工具；
- 增加 data resource scope 和查询预算 enforcement；
- 实现 builtin / external Runtime 的能力发现；
- 配置校验只依赖通用 Dataset 和 Connector 契约；
- 使用 Fixture Dataset 验证工具和权限。

### 第二步：订单 MVP

- 原则上只新增订单 Connector 绑定、连接限额和模型偏好；
- 不新增订单专用 Runtime 执行器；
- 不新增订单专用 Agent Run 或审计；
- 如订单数据需要单独 scope，通过配置 `dataset:orders` 等 scope 表达，不修改 Runtime 核心协议。
