# Pluginmax 演示场景准备通用 SOP

> 文档版本：v1.0  
> 适用范围：需要录制视频或现场演示的产品场景  
> 适用平台：DSH Pluginmax、Data Agent、任务、工作台、AI 伙伴、资源市场 MCP  
> 参考案例：[手机/平板成品供应链订单异常 Demo](./phone-tablet-order-exception-demo-script.md)

## 1. 目的

这份 SOP 用于把一个新的业务故事，稳定地转换为可录制的产品 Demo。

每次准备 Demo 都应回答并落实以下问题：

1. 主故事是什么，观众看完只记住哪一条闭环？
2. 复用了哪些正式产品能力，哪些内容只属于 Demo？
3. Demo 数据是否确定、可重建、与页面数字一致？
4. 外部系统是否通过标准 MCP 注册和调用？
5. AI 能做什么、不能做什么，哪些动作必须人工确认？
6. Demo 代码能否通过一个 feature flag 安装，并通过删除独立插件整体拆卸？
7. 录制步骤、预期结果和讲解文案是否已经固化？
8. 录完后能否清理数据，不影响正式功能和日常开发环境？

## 2. 不可妥协的原则

### 2.1 Demo 与正式功能隔离

- Demo 代码必须放在独立插件或独立目录。
- 推荐插件名：`dsh-collab-demo-<scenario-id>`。
- 推荐环境开关：`PLUGINMAX_ENABLE_<SCENARIO>_DEMO=1`。
- 正式插件不得 import Demo 包，不得引用 Demo 常量、路由、CSS、fixture 或 MCP 资产。
- 正式代码可以增加通用扩展点，但扩展点中不得出现 Demo 名称、业务故事、固定工单号或 fixture ID。
- 卸载 Demo 后，正式应用必须正常启动，相关 UI slot 为空，资源市场不再显示 Demo MCP。

允许为 Demo 增加的正式能力只能是通用能力，例如：

- 多 MCP provider 注册与按 asset ID 路由；
- 通用 UI extension slot；
- 可选 profile / feature flag 安装机制；
- 通用 demo display profile。

### 2.2 外部系统必须走标准 MCP

- Mock 系统可以实现为进程内或 stdio MCP Server，但协议必须正常。
- 必须通过资源市场现有的 `McpCatalogProvider` 体系注册。
- 必须正常执行 `initialize`、`tools/list`、`tools/call`。
- 连接状态必须来自 provider，不能用静态 seed 冒充“已连接”。
- 不得增加 Demo 专用 REST 接口绕过 MCP。
- MCP 连接失败、工具缺失或响应不合约时必须 fail closed。

### 2.3 数据必须确定且可解释

- 优先复用正式数据集、认证指标和现有 Connector。
- 只为 Demo 增加独立 fixture，不复制整套业务域。
- 页面展示的每个数字必须能追溯到数据、指标或明确的人工回执。
- 未覆盖权限不能按 0 处理。
- 演示数据必须显式标记 `demo` 和“非生产”。
- 录制当天可重新生成数据，避免“今天”范围失效。

### 2.4 AI 权限必须清楚

- 数据评估类 Agent 默认只读。
- 写业务系统必须经过人工确认、Action Ticket 和幂等控制。
- 写工具只授予明确承接该动作的 AI 伙伴。
- 报告类任务完成后进入“待确认”，不能自动代表人类提交或外发。
- 不允许用自然语言输出冒充真实工具调用。

### 2.5 故事必须收敛

- 一个 Demo 只讲一个主异常、一个主任务闭环。
- 最多保留一个人工执行角色和一个 AI 执行角色作为三级任务。
- 业务动作只选一个，例如创建再平衡工单、补货单或审批单。
- 其余支线只作为数据维度或背景，不展开第二套故事。
- Demo 的结尾必须回到管理视图或任务闭环，显示明确结果。

## 3. 角色与职责

| 角色 | 主要职责 | 产出 |
| --- | --- | --- |
| 场景负责人 | 定义业务问题、目标观众和故事主线 | Story、Scope、成功标准 |
| 解决方案架构师 | 判断复用边界、MCP 注册和系统动作 | 架构说明、开发 Prompt |
| 数据负责人 | 确定数据集、指标、权限、fixture | 数据配置、预期数字 |
| Demo 开发 | 实现独立插件、Mock MCP、扩展 UI | 可运行 Demo |
| AI/Prompt 负责人 | 编排 Data Agent 和 AI 伙伴 | 提示词、预期输出 |
| 录制负责人 | 准备账号、环境、操作顺序和讲解 | Storyboard、录制脚本 |
| 评审人 | 审查业务专业性、权限、可拆卸和画面 | 验收记录 |

小团队可以合并角色，但“场景设计”和“可拆卸验收”不能省。

## 4. 标准流程

### 阶段 0：场景立项

目标：把业务想法收敛成一条可演示的闭环。

必须完成：

- 目标观众；
- 业务角色；
- 主异常或主决策；
- 数据问题；
- AI 建议；
- 人工任务；
- AI 任务；
- 业务动作；
- 收尾报告；
- 明确不做什么。

阶段门禁：

- 能用 3 句话讲清故事；
- 只保留一个主异常；
- 明确 Demo 与正式产品的关系；
- 明确需要 Mock 的外部系统。

### 阶段 1：能力复用与边界设计

目标：先决定复用，再决定新增。

操作：

1. 列出可以复用的正式能力，例如 Data Agent、QueryRun、任务、AI 伙伴、Action Ticket、MCP。
2. 列出必须新增的 Demo 资产，例如 fixture、Mock MCP、UI profile、业务文案。
3. 标记哪些改动属于正式通用能力。
4. 设计独立 Demo 插件和 feature flag。
5. 写出拆卸路径。

阶段门禁：

- 没有 Demo 专用逻辑进入正式插件；
- 外部系统都是 MCP；
- 写操作有权限和确认；
- 能说明“卸载什么、清理什么、正式功能怎么回归”。

### 阶段 2：数据与指标设计

目标：让所有页面数字可控且一致。

操作：

1. 选择主数据集和认证指标。
2. 确定时间范围、时区、权限范围和演示模式。
3. 设计 fixture 数量和异常构成。
4. 计算所有需要展示的派生数字。
5. 设计权限缺口和无数据时的表现。
6. 验证报表冷启动、重复查询和数据截止时间。

阶段门禁：

- 同一数字在所有页面一致；
- fixture 能按录制日期重建；
- 订单/任务/工单数量可对账；
- 权限范围明确；
- 演示数据标记清楚。

### 阶段 3：MCP 与业务动作设计

目标：让 Mock 外部系统像真实系统一样接入。

操作：

1. 定义 MCP asset ID、provider、transport、tools、permissions。
2. 实现标准 MCP Server。
3. 对接资源市场 `McpCatalogProvider`。
4. 验证 `tools/list`。
5. 验证只读工具。
6. 验证写工具的 Action Ticket、人工确认和幂等。
7. 验证失败、超时、未知工具和未连接状态。

阶段门禁：

- 资源市场可见且状态来自 provider；
- Data Agent 看不到写工具；
- 只有目标 AI 伙伴能调用写工具；
- 重复调用不会重复建单；
- 失败不回退到正式数据或伪造成功。

### 阶段 4：UI 与演示环境

目标：让画面只出现与场景一致的信息。

操作：

1. 创建独立 workspace / project。
2. 准备演示账号和角色。
3. 配置 demo display profile。
4. 隐藏或替换冲突的 seed 卡片。
5. 确认工作台、任务、AI 伙伴和资源市场的视觉路径。
6. 准备主题、窗口尺寸、缩放和多账号窗口。

阶段门禁：

- 无跨行业内容；
- 无生产错误提示；
- 首屏能看到主异常；
- 所有按钮和页面标签与脚本文案一致；
- 不依赖开发者临时改数据库。

### 阶段 5：Prompt 与输出基准

目标：让 Agent 输出可控、可验收。

每个 Agent 至少准备：

- 使用场景；
- 明确输入；
- 必须遵守的边界；
- 预期输出结构；
- 不允许的行为；
- 关键事实和数字；
- 失败时的再提示；
- 正式报告复用规则。

阶段门禁：

- Data Agent 回答包含范围、口径、截止时间、权限和证据；
- AI 伙伴输出包含草稿、待确认事项和下一步；
- 报告不允许重新查询；
- Agent 输出不会声称未经工具调用的业务写操作。

### 阶段 6：Storyboard 与预演

目标：把界面操作变成可重复的录制脚本。

每个场景必须写清楚：

- 建议时长；
- 当前登录账号；
- 页面；
- 前置状态；
- 鼠标操作；
- 预期效果；
- 讲解文案；
- 可以剪辑的等待；
- 不能伪造的证据点。

阶段门禁：

- 从干净环境完整跑通；
- 所有动态结果都实际出现；
- 关键金额、数量、状态一致；
- 账号切换不阻塞；
- Agent 等待时间可接受或有预演产物。

### 阶段 7：录制与验收

目标：产出一条可发布的 Demo 视频。

操作：

1. 录制前重新生成 fixture。
2. 检查 feature flag、MCP 连接、账号和 Agent 状态。
3. 先录主闭环，再补近景和讲解。
4. 等待过程可剪辑，结果状态必须真实。
5. 录制结束后检查证据链和画面一致性。

阶段门禁：

- 主闭环无断点；
- 业务数字可追溯；
- 人工确认可见；
- MCP 调用结果可见；
- 报告进入待确认；
- 最终任务完成；
- 画面不出现冲突业务或正式功能回归提示。

### 阶段 8：拆卸与归档

目标：Demo 完成后不污染正式环境。

操作：

1. 关闭 Demo feature flag。
2. 卸载独立 Demo 插件。
3. 清理 Demo workspace、任务、AI 伙伴和 MCP 连接。
4. 删除临时 fixture、截图、日志和工作副本。
5. 保留可复用文档、配置、提示词和 Mock Server。
6. 运行一次未启用 Demo 的 smoke。

阶段门禁：

- 正式功能正常；
- Demo 资产不再可发现；
- 正式数据无残留；
- 文档中的录制结论不依赖已删除的运行数据。

## 5. 推荐目录结构

```text
docs/demos/
├── <scenario-id>-demo-script.md
└── <scenario-id>-demo/
    ├── scenario.yaml
    ├── data-agent-prompts.md
    ├── fulfillment-partner-prompt.md
    ├── task-message-copy.md
    ├── report-draft.md
    ├── workbench-profile.yaml
    ├── mock-mcp-assets.yaml
    ├── mock-oms-mcp-server.mjs
    ├── mock-wms-mcp-server.mjs
    ├── rebalance-work-order.json
    └── generate-fixture.mjs
```

可选的独立 Demo 插件：

```text
plugins/dsh-collab-demo-<scenario-id>/
├── package.json
├── tsdown.config.ts
├── tsconfig.json
├── cordis.patch.yml
├── src/
├── mock/
├── config/
├── data/
└── prompts/
```

文档可以留在 `docs/demos/`，运行代码和配置进入插件包。

## 6. 命名规范

| 类型 | 建议格式 | 示例 |
| --- | --- | --- |
| 场景 ID | `<domain>-<business-flow>-v<version>` | `phone-tablet-order-v1` |
| Demo 插件 | `dsh-collab-demo-<scenario-id>` | `dsh-collab-demo-phone-tablet-order` |
| Feature flag | `PLUGINMAX_ENABLE_<SCENARIO>_DEMO` | `PLUGINMAX_ENABLE_PHONE_TABLET_DEMO` |
| 主任务 | `<SCENARIO>-<FLOW>` | `PT-ORD-001` |
| 人工任务 | `<parent>-A` | `PT-ORD-001-A` |
| AI 任务 | `<parent>-B` | `PT-ORD-001-B` |
| 夜间报告 | `<parent>-C` | `PT-ORD-001-C` |
| MCP asset | `mcp-<system>-<scenario>-demo` | `mcp-wms-phone-tablet-demo` |
| 业务单据 | `<TYPE>-DEMO-<date>-<seq>` | `WO-RB-DEMO-1030-017` |

所有 Demo 标识都必须带 `demo`、`DEMO` 或独立 feature flag，避免与生产数据混淆。

## 7. 数据准备模板

`scenario.yaml` 至少包含：

```yaml
demoId:
title:
businessContext:
  industry:
  supplyChainModel:
  included:
  excluded:
demoIsolation:
  pluginId:
  featureFlag:
  detachable:
  productionDependency:
dataSource:
  datasetId:
  connector:
  mode:
  permissions:
expectedMetrics:
accounts:
workspace:
aiPartners:
tasks:
outcome:
assets:
```

数据验收必须列出：

- 总订单/记录数；
- 异常数；
- 各异常类型数量；
- 金额；
- 时间范围；
- 权限覆盖；
- 业务动作数量；
- 报告最终数量。

## 8. MCP 配置模板

```yaml
pluginId:
providerId:
featureFlag:
registrationMode: "McpCatalogProvider"
productionEnabled: false
detachable: true

assets:
  - id:
    name:
    protocol: "MCP · stdio"
    permissions:
    tools:
    consumers:

registration:
  resourceMarket:
    visible: true
  providerLifecycle:
    connect:
      - "initialize"
      - "tools/list"
  failurePolicy: "fail_closed"

removal:
  residualProductionData: "none"
```

写工具必须额外声明：

```yaml
access: "write"
humanConfirmationRequired: true
actionTicketRequired: true
idempotencyField: "idempotencyKey"
allowedConsumers:
  - "<specific-ai-partner>"
deniedConsumers:
  - "data-agent"
```

## 9. Storyboard 模板

每个镜头使用以下结构：

### 场景 N：名称

**建议时长**

**登录账号**

**前置条件**

**画面**

**操作**

1. …
2. …

**预期效果**

```text
关键数字或状态
```

**说明文案**

> 可直接录制的讲解词

**剪辑说明**

**不可伪造的证据点**

## 10. 录制前检查清单

### 数据

- [ ] fixture 已按录制日期重新生成。
- [ ] 主指标数字已核对。
- [ ] 金额和任务数量一致。
- [ ] 演示标记、非生产标识可见。
- [ ] 权限未覆盖范围没有按 0 处理。

### MCP

- [ ] 所有 Mock MCP 已出现在资源市场。
- [ ] 连接状态来自 provider。
- [ ] `tools/list` 成功。
- [ ] 只读和写工具权限隔离。
- [ ] 写工具要求人工确认和 Action Ticket。
- [ ] 幂等测试通过。

### UI

- [ ] 工作台没有冲突行业的 seed。
- [ ] 账号、项目、成员关系正确。
- [ ] 任务表单字段和脚本文案一致。
- [ ] AI 伙伴状态为生效。
- [ ] 页面缩放和窗口尺寸适合录制。

### Agent

- [ ] Data Agent 预演通过。
- [ ] 正式报告复用已有 QueryRun。
- [ ] AI 伙伴任务输出符合验收基准。
- [ ] 夜间计划可进入待确认。

### 录制

- [ ] 登录账号顺序确定。
- [ ] 每一步有预期效果。
- [ ] 关键证据点不能通过剪辑伪造。
- [ ] 有失败时的备用镜头或重新录制方案。

## 11. 录制后检查清单

- [ ] 开场能在 10 秒内说明业务问题。
- [ ] 主异常只出现一次，不被支线打断。
- [ ] Data Agent 显示范围、口径、截止时间和证据。
- [ ] 人工任务和 AI 任务职责清楚。
- [ ] 人工确认和业务写结果都在画面中出现。
- [ ] 报告处于待确认，由人类验收。
- [ ] 结尾回到管理视图或任务闭环。
- [ ] 视频中没有生产和 Demo 混淆的表述。

## 12. 拆卸检查清单

- [ ] 关闭 Demo feature flag。
- [ ] 移除独立 Demo 插件。
- [ ] 资源市场不再显示 Demo MCP。
- [ ] Demo workspace 和任务已清理。
- [ ] Demo AI 伙伴和工作计划已清理。
- [ ] Demo fixture、日志、截图和临时文件已清理。
- [ ] 正式数据没有 Demo 标记或工单。
- [ ] 不启用 Demo 的 smoke 通过。
- [ ] 正式插件没有 Demo import。
- [ ] 正式代码没有 Demo 字符串。

## 13. 常见反模式

| 反模式 | 问题 | 正确做法 |
| --- | --- | --- |
| 把 Demo fixture 直接写进正式 mock | 正式功能携带 Demo 逻辑 | 独立 Demo MCP Server |
| 增加 Demo REST 写接口 | 绕过资源市场、权限和审计 | 标准 MCP `tools/call` |
| 用静态卡片冒充 MCP 已连接 | 演示无法验证真实链路 | provider 返回连接状态 |
| Data Agent 直接写业务系统 | 权限和审计边界错误 | 只读评估，AI 伙伴受控执行 |
| 一个 Demo 讲三个业务域 | 观众抓不住主线 | 一个异常、一条闭环 |
| 数字写死在讲解里 | 与现场结果不一致 | fixture + 预期指标 + 预演校验 |
| 正式工作台保留无关 seed | 业务专业性受损 | 独立 display profile 或隐藏模块 |
| Agent 输出未生成就说已完成 | 演示失真 | 真实运行或明确标为草稿 |
| 录完后不清理 | 污染正式 workspace | 独立 DSH_HOME + 拆卸清单 |

## 14. 新场景启动模板

复制以下内容作为新 Demo 的第一版设计：

```text
场景名称：
目标观众：
业务角色：

一句话故事：

主异常：
数据问题：
Data Agent 判断：
人工任务：
AI 任务：
业务动作：
夜间收尾：
次日验收：

复用能力：
新增 Demo 资产：
Mock 外部系统：
MCP assets：
受控写工具：
Action Ticket：
幂等键：

主数据集：
时间范围：
权限范围：
预期记录数：
预期异常数：
预期业务动作数：

Demo 插件：
Feature flag：
工作台 profile：
拆卸步骤：

必须展示的证据：
不能声称的内容：
```

## 15. 完成定义

只有同时满足以下条件，Demo 才算准备完成：

1. 一条故事线可以从干净环境完整跑通；
2. 所有数字有 fixture、指标或人工回执来源；
3. 外部系统通过标准 MCP 注册和调用；
4. 写操作有人类确认、Action Ticket 和幂等；
5. Demo 插件、数据、Mock 和 UI profile 可整体拆卸；
6. 录制脚本包含操作、预期效果和讲解文案；
7. 录制后能清理，不影响正式产品；
8. 文档、配置、数据和 Mock Server 都能被后续人员复用。
