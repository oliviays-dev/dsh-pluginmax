# Data Agent 平台内置 AI 伙伴、全局入口与侧边协作 PRD

> 文档版本：v1.3  
> 日期：2026-10-29  
> 状态：产品方案评审稿  
> 适用范围：`dsh-pluginmax` AI 伙伴、工作台、任务、资源市场  
> 交互修订：全局恒驻入口 + 跨页面选择 + Data Agent / 沟通共享页签  
> 报告修订：默认 Markdown + 图片，HTML 仅在用户指定后生成  
> 关联交互：[data-agent-workbench-demo.html](./demos/data-agent-workbench-demo.html)  
> 关联设计：[AI Teammate 模版 / 实例模型](./teammate-template-instance-split-design.md)、[工作台 2.0 PRD](./workbench-plugin-market-prd.md)、[平台交互与视觉设计规范](./platform-interaction-design-guide.md)

---

## 0. 一页结论

`dsh-pluginmax` 新增一个平台预定义的 Data Agent。它不是每个用户自行创建、可以随意删除的普通 AI伙伴，而是与“会议 Facilitator”同一治理模式的内置角色：

- 定义归平台，使用归工作区与用户；
- 在所有工作台、AI伙伴列表和允许的数据场景中稳定存在；
- 用户不能删除、归档或卸载这个系统 Agent；
- 工作区管理员可以恢复默认配置，但不能改变它的系统身份；
- 它沿用现有 AI伙伴的模版、实例归属、运行时、权限和审计链路，不另造一个聊天机器人体系。

所有一级页面采用“全局入口 + 内容选择 + 右侧页签”的交互：

1. **Global Entry，全局入口**：页面右上角、“沟通”图标左侧显示恒驻 Data Agent 图标，点击直接打开右侧 Data Agent 页签。
2. **Selection Layer，上下文入口**：卡片、指标、任务、文字、图表和其他可引用内容可被选择；选中后，选区上方出现「让DataAgent分析」。
3. **Shared Side Panel，右侧工作区**：Data Agent 与沟通共用右侧容器；同时开启时以页签切换，各自保留会话和输入状态。
4. **Report Viewer，结果入口**：Data Agent 默认返回 Markdown + 图片穿插的报告；用户按需点击生成 HTML 版本后再浏览或下载。
5. **Expanded View，浏览模式**：右侧工作区可以扩展到“除左侧导航外的全部页面区域”。
6. **Data Agent Panel，可选辅入口**：资源市场中的可安装面板，承载最近洞察、报告和运行，可被移除，但不改变全局入口与系统 Agent 身份。

核心产品判断是：**Data Agent 是一个跨一级页面可随时调用的分析能力；页面选择为它补充上下文，而不是唯一入口。**

---

## 1. 对标结论与本地化

### 1.1 参考材料的关键能力

Multica 的自动数据分析用例把 Data Agent 描述为工作区里的常驻高级数据分析师，核心不是“问答”，而是完整的数据工作闭环：

| 参考能力            | 用户价值                                 | 对 dsh-pluginmax 的启示                             |
| ------------------- | ---------------------------------------- | --------------------------------------------------- |
| Agent 是工作区成员  | 可以被分配任务、被 @、拥有工作记录       | Data Agent 必须复用 AI伙伴身份与任务运行时          |
| 共享口径与 Skill    | 每人不需要重复解释 DAU、OTIF、库存等定义 | 数据口径、查询路由和交付规范应成为平台级 Skill      |
| 只读分析环境        | 查询不影响生产，降低越权写入风险         | Data Agent 默认只读；写入必须转为明确动作或人工确认 |
| 即时分析 + 定时报告 | 从临时问题延展到固定经营节奏             | 工作台同时支持随问随答、订阅洞察和定期报告          |
| 主动开跟进任务      | 缺埋点、缺字段时不假装完成               | 遇到数据缺口时产出一条可追踪的治理事项              |
| 报告交付物          | 结论能进入团队共享上下文                 | 默认 Markdown + 图片，HTML 作为用户指定的导出格式   |

### 1.2 不直接照搬的部分

- 不把 Data Agent 设计成独立于 AI伙伴框架的“BI 机器人”；
- 不允许它在首版直接写业务数据库；
- 不让它通过任意 SQL 绕过工作区、项目、行级权限；
- 不要求用户先打开空白聊天页才能获得数据能力；
- 不让每个工作台复制一份新的 Data Agent 定义；
- 不让系统 Agent 与用户自建 AI伙伴共用同一套删除、归档、换模版操作。

### 1.3 与会议 Facilitator 的治理对齐

| 属性             | 会议 Facilitator         | Data Agent                                   |
| ---------------- | ------------------------ | -------------------------------------------- |
| 定义来源         | 平台内置                 | 平台内置                                     |
| 稳定系统身份     | `meeting-facilitator`    | `data-agent`                                 |
| 出现方式         | 会议中的专属服务席位     | 内容选择动作、AI伙伴列表、业务上下文         |
| 是否按工作区运行 | 是                       | 是                                           |
| 是否可删除       | 否                       | 否                                           |
| 用户可改范围     | 会议内启用状态等运行配置 | 数据接入、默认时间范围、报告偏好等工作区配置 |
| 平台维护范围     | 主持人定义与纪要行为     | 人设、分析原则、查询 Skill、安全策略         |
| 恢复能力         | 关闭后重新启用           | 恢复默认工作区配置                           |

---

## 2. 背景与问题

### 2.1 当前状态

`dsh-pluginmax` 已经具备以下基础：

- AI Teammate Template / Instance 模型；
- Agent Profile、Runtime Profile、Principal Action Ticket 和 Agent Run；
- 任务指派、会议席位、工作流执行、工作台插件槽位；
- 任务、项目、会议、工作流与文件共享上下文；
- 资源市场中的 Skill、MCP 与工作台面板。

但现有 AI伙伴主要解决“某个持续角色如何承接任务”，还没有解决以下问题：

1. 用户不理解该创建什么数据分析 Agent，也不掌握提示词与数据口径；
2. 数据问题通常从工作台现象开始，却要求用户跳转到会话页重新描述上下文；
3. 临时问答、监控、定期报告和数据治理散落在不同入口；
4. 普通用户创建的 Agent 质量不稳定，容易产生重复定义和口径漂移；
5. 分析结论难以回到任务、项目和会议中成为可追踪的工作结果。

### 2.2 核心用户问题

| 问题                               | 典型表现                                     | 业务后果                 |
| ---------------------------------- | -------------------------------------------- | ------------------------ |
| 从看到指标到理解指标要经过多次跳转 | 看到 OTIF 下降，再打开会话或 BI 工具手动描述 | 决策延迟，分析上下文丢失 |
| 数据口径依赖个人经验               | 每个人对“准时交付”“风险库存”的定义不同       | 同一问题得到不同结论     |
| 数据问题不可持续追踪               | 缺埋点、缺字段时只得到一句“无法分析”         | 同类问题反复出现         |
| 定期报告靠人催                     | 周报、月报需要分析师重复整理                 | 例行工作占用高价值时间   |
| Agent 能力配置门槛高               | 普通用户不知道该给 Agent 什么工具和上下文    | 创建后低使用或结果不可用 |

### 2.3 机会判断

数据是工作台最通用的横切能力。与其让每个用户从零创建一个“数据分析 AI伙伴”，不如由平台提供一套稳定、可恢复、与工作上下文相连的默认能力，再允许用户配置自己的数据和偏好。

---

## 3. 产品目标与非目标

### 3.1 产品目标

1. 用户选中任意页面内容后，经过一次操作即可在右侧聊天中获得带口径、时间范围和来源的结论。
2. 平台内置 Data Agent 在所有已登录用户的工作台稳定可见，不受工作台布局是否为空影响。
3. Data Agent 复用 AI伙伴身份、运行时、任务与审计链路，不形成第二套 Agent 体系。
4. 用户不能删除系统 Agent；工作区管理员可以安全恢复默认配置。
5. Data Agent 能承接四类高频任务：即时查数、异常诊断、定期报告、数据准备度治理。
6. 每个分析结果都能继续落到报告、任务、会议或项目上下文中。
7. 所有数据访问遵守工作区、项目、数据集和行级权限，默认只读。

### 3.2 成功指标

以下为 MVP 灰度的观测目标，基线在接入真实数据源后补齐：

| 指标                                                   | 目标   |
| ------------------------------------------------------ | ------ |
| 工作台周活用户使用内容选择并唤起 Data Agent 的比例     | ≥ 30%  |
| 选中内容后点击「让DataAgent分析」的转化率              | ≥ 35%  |
| 数据问题首次响应成功率                                 | ≥ 85%  |
| 带完整口径、时间范围和来源的响应比例                   | ≥ 95%  |
| 分析结果二次行动率（生成报告 / 创建任务 / 打开证据链） | ≥ 25%  |
| 定期报告按期成功率                                     | ≥ 98%  |
| 无权限数据泄露事件                                     | 0      |
| Data Agent 重置后恢复成功率                            | 100%   |
| 因 Agent 不可用导致整张工作台不可用的比例              | < 0.1% |

### 3.3 非目标

MVP 不做：

- 通用 BI 建模平台；
- 任意用户编写并执行任意 SQL；
- Data Agent 自动修改生产业务数据；
- 自动改变指标口径或删除历史报告；
- 跨工作区拼接数据；
- 以 Data Agent 替代项目、任务、会议和工作流的详情页；
- 允许用户将平台内置 Data Agent 删除、归档、导出为个人模版；
- 在首版实现复杂的自主多 Agent 数据分析团队。

---

## 4. 用户与权限

### 4.1 用户角色

| 角色         | 主要目标                           | Data Agent 权限                          |
| ------------ | ---------------------------------- | ---------------------------------------- |
| 业务成员     | 快速查数、理解异常、生成自己的分析 | 使用已授权数据；创建个人报告草稿         |
| 项目负责人   | 追踪项目指标与数据缺口             | 查看项目范围结果；将结论转为任务         |
| 工作区管理员 | 配置工作区数据源、默认口径和订阅   | 管理本地配置；执行恢复默认；暂停自动任务 |
| 数据管理员   | 维护数据连接、指标定义和质量       | 配置只读连接、指标 Skill、数据质量规则   |
| 平台管理员   | 维护平台内置定义                   | 发布 Data Agent 版本；重置平台默认定义   |
| Data Agent   | 查询、解释、报告与治理建议         | 只能通过受限工具读取授权数据             |

### 4.2 权限原则

- Agent 的有效权限 = 请求人的有效权限 ∩ 工作区授权 ∩ Runtime Profile ∩ 数据连接策略。
- “能看见 Data Agent”不代表“能查询所有数据”。
- 平台管理员身份不自动获得业务数据权限。
- 行级权限、列级脱敏和项目隔离由服务端执行，前端不作为安全边界。
- 只读查询与写入动作必须使用不同工具、不同票据和不同审计事件。
- 报告引用数据时保留生成时快照；查看原数据仍执行当前权限校验。

---

## 5. Data Agent 定义

### 5.1 产品定位

**名称**：Data Agent  
**副标题**：平台内置数据分析师  
**一句话职责**：把工作上下文中的业务问题转化为可追溯的数据结论、图表、报告和下一步行动。

它更像一位长期在线的数据分析同事，而不是一个“查询按钮”。它需要：

- 理解当前工作台、项目和时间范围；
- 知道指标定义和优先数据源；
- 能选择查询、对比、归因和可视化；
- 能说明证据、置信度与限制；
- 在数据不足时把问题转成可执行的数据治理事项。

### 5.2 人设边界

Data Agent 的默认 SOUL 应明确以下原则：

1. 先确认指标口径、时间范围和业务范围，再做判断；
2. 明确区分“数据事实”“推断原因”“建议动作”；
3. 不编造数据，不用示例值替代真实结果；
4. 查询失败时说明失败位置和可执行的下一步；
5. 结论优先给业务影响，证据链放在可展开区域；
6. 不在未经确认时执行写操作；
7. 报告中必须包含数据截止时间、口径和来源。

### 5.3 主要任务类型

| 任务类型   | 用户表达                   | Agent 产物                             | 典型入口                  |
| ---------- | -------------------------- | -------------------------------------- | ------------------------- |
| 即时查数   | “华东上周 OTIF 多少？”     | 指标值、趋势、对比、口径和数据时间     | 指标卡、业务面板选区      |
| 异常诊断   | “为什么本周延迟订单变多？” | 异常幅度、主要驱动、证据链、待验证假设 | 指标卡、供应风险行选区    |
| 定期报告   | “每周一生成供应链周报”     | 报告草稿、图表、订阅与投递记录         | 报告选区、Data Agent 面板 |
| 数据准备度 | “这个字段为什么查不到？”   | 缺失原因、影响范围、治理任务草稿       | Data Agent 面板、任务详情 |

MVP 支持以上四类。预测、情景模拟、跨组织数据市场分析放入后续阶段。

### 5.4 关键使用场景

#### 场景 A：从工作台发现异常

用户看到 OTIF 比上周下降，点击 OTIF 指标卡，再点击“让DataAgent分析”。

预期：

1. 右侧对话打开，OTIF 指标快照自动成为上下文附件；
2. Data Agent 识别当前指标为 OTIF，并展示口径；
3. 用户补充“解释一下下降原因”后发送；
4. Agent 返回带总变化、主要贡献维度和证据链的报告；
5. 用户可以浏览 Markdown + 图片报告、下载 Markdown，或按需生成 HTML 版；
6. 整个过程不离开工作台。

#### 场景 B：无明确分析问题

用户选中“Data Agent 洞察”卡片，并补充“今天有什么值得关注的数据变化？”

预期：

1. Data Agent 使用工作区订阅的洞察主题；
2. 最多返回三条按业务影响排序的异常；
3. 每条包含变化幅度、影响对象和建议动作；
4. 没有达到阈值的波动不制造“伪异常”。

#### 场景 C：定期报告

工作区管理员选中周报卡片或报告面板，补充“按这个模板每周一生成供应链简报并设置投递”。

预期：

1. 首次生成预览，用户确认版式和范围；
2. 系统展示将使用的数据源、指标和收件范围；
3. 到点后生成报告并投递到指定工作台、任务或会话；
4. 报告失败时保留排障记录并通知责任人；
5. 修改口径 Skill 后，下一次报告使用新版本，历史报告仍引用旧版本。

#### 场景 D：数据缺口

用户追问“按客户行业拆一下延迟订单”，但字段不存在。

预期：

1. Data Agent 不伪造维度；
2. 说明缺失字段、影响的订单范围和当前可替代口径；
3. 提供“创建数据治理任务”按钮；
4. 任务草稿包含字段、用途、影响对象和建议责任人；
5. 用户确认后才创建任务。

---

## 6. 系统 Agent 定义模式

### 6.1 双层对象

沿用 AI伙伴模版 / 实例拆分：

```text
Platform Data Agent Template
  id: sys-data-agent
  source: platform
  systemKey: data-agent
  protected: true
  editableBy: platform-admin
          │
          ▼
Workspace-bound Data Agent Instance
  teammateId: data-agent
  source: platform
  owner: system
  protected:
    deletable: false
    archivable: false
    templateSwitchable: false
  runtime: workspace-scoped
```

产品界面只展示一个稳定的 Data Agent，不为每个工作区生成重名卡片。工作区差异体现在运行配置、数据连接、记忆和报告中。

### 6.2 平台内置约束

| 操作                  | 普通用户             | 工作区管理员 | 平台管理员 |
| --------------------- | -------------------- | ------------ | ---------- |
| 查看身份与说明        | 允许                 | 允许         | 允许       |
| 使用                  | 允许，受数据权限约束 | 允许         | 允许       |
| 修改名称、头像        | 禁止                 | 禁止         | 禁止       |
| 修改平台 SOUL / Skill | 禁止                 | 禁止         | 允许       |
| 删除                  | 禁止                 | 禁止         | 禁止       |
| 归档                  | 禁止                 | 禁止         | 禁止       |
| 切换模版              | 禁止                 | 禁止         | 禁止       |
| 配置工作区数据源      | 只读查看             | 允许         | 允许       |
| 恢复工作区默认配置    | 禁止                 | 允许         | 允许       |
| 暂停个人订阅          | 允许                 | 允许         | 允许       |
| 暂停工作区自动报告    | 仅自己的报告         | 允许         | 允许       |

“禁止删除”同时落实为：

- 界面不展示删除、归档、换模版入口；
- API 对受保护 Agent 返回 `system_agent_protected`；
- 数据迁移与清理任务不得移除固定系统身份；
- 资源市场中不存在“卸载 Data Agent”动作；
- 工作台编辑器只能移除 Data Agent 面板，不能移除内容选择能力与对话槽位。

### 6.3 恢复默认 Reset

恢复默认作用于当前工作区的运行配置，并恢复系统 Agent 的用户可编辑层：

**会重置**

- 自定义补充指令；
- 默认时间范围、时区和展示偏好；
- 默认项目与指标优先级；
- 数据源优先级；
- 主动洞察阈值与通知偏好；
- 本地缓存的语义记忆和查询计划偏好。

**不会删除或重置**

- 数据连接及授权；
- 已生成报告和报告快照；
- Agent Run、任务、会话和审计记录；
- 用户已创建的任务；
- 已投递到项目或会议中的文件；
- 工作区拥有的指标 Skill 版本。

**默认状态**

- 自动报告订阅改为“保持，但暂停下一次触发”，用户可在确认弹层中取消该选项；
- 恢复完成后生成审计事件并展示摘要；
- 重复执行 Reset 必须幂等。

### 6.4 与现有 AI伙伴列表的关系

Data Agent 出现在 AI伙伴列表中，但使用固定前置位置与专属标记：

```text
AI伙伴
  Data Agent               平台内置
  会议 Facilitator         平台内置
  Olivia 的研究伙伴        个人
  交付协调员               个人
```

详情页展示：

- 平台内置标识；
- 稳定系统身份；
- 职责、任务类型与当前版本；
- 当前工作区连接状态；
- 最近运行；
- 不可删除说明；
- 恢复默认入口。

普通 AI伙伴的编辑、归档、换模版操作不应用于 Data Agent。

---

## 7. 全局入口、内容选择与侧边页签

### 7.1 方案结论

工作台不设置横向 Data Agent 卡片，也不设置常驻聊天输入框。Data Agent 通过两类入口进入：

1. **全局恒驻入口**：在所有一级页面右上角、“沟通”图标左侧显示 Data Agent 图标；
2. **内容选择入口**：用户选中页面中的卡片、文本、图表或媒体后，在选区上方出现「让DataAgent分析」。

两种入口最终打开同一个右侧工作区。右侧工作区与“沟通”共用侧边容器，同时开启时使用页签切换：

```text
┌──────────────────────────────────────────────┐
│ [ Data Agent × ] [ 沟通 × ]                  │
├──────────────────────────────────────────────┤
│ 当前页签的标题、上下文和操作                 │
├──────────────────────────────────────────────┤
│ 对话 / 报告 / 沟通记录                       │
│                                              │
│ 输入区                                       │
└──────────────────────────────────────────────┘
```

核心产品判断是：**Data Agent 是全局可调用的分析能力，页面选择是它的上下文来源，不是唯一入口。**

### 7.2 全局恒驻入口

位置：

- 一级页面右上角；
- 位于“沟通”图标左侧；
- 与“沟通”使用相同的图标按钮尺寸和间距；
- 不随页面内容滚动；
- 移动端仍保留，可由右上角溢出区收纳，但不能被业务页面隐藏。

默认状态：

- 使用 Data Agent 专属图标与紫色强调；
- 不显示无意义的红点；
- 存在待确认洞察时，可使用小计数或状态点；
- 点击后打开右侧 Data Agent 页签并聚焦输入框。

覆盖范围：

- 工作台；
- 项目列表与项目详情；
- 任务列表与任务详情；
- 工作流列表、工作流详情和节点详情；
- 沟通与会议；
- AI伙伴；
- 资源市场；
- 后续新增的一级页面必须复用同一全局槽位。

Data Agent 图标不是页面级插件，不受工作台布局、面板安装或页面编辑模式影响。

### 7.3 内容选择

Data Agent 支持在所有业务页面选择内容，不局限于工作台。

通用可选内容：

- 文本；
- 图表和图片；
- 文件预览；
- 表格中的单元格、行或列；
- 页面内其他可引用的多媒体。

结构化实体选择：

- 任务；
- 工作流；
- 工作流节点；
- 会议；
- 指标卡；
- 后续由平台注册的实体类型。

结构化实体只允许从平台实体注册表中选择。未注册的卡片、装饰元素和纯展示模块不进入实体选择范围。

交互规则：

1. 悬停可分析内容时，显示轻微描边或选择反馈；
2. 单击已注册实体，选中完整实体；
3. 拖选文本，选中局部文本，不用先选中整个实体；
4. 选中后显示蓝色外轮廓；
5. 选区正上方显示唯一浮动操作「让DataAgent分析」；
6. 同一时间只保留一个活动选区；
7. 点击页面空白位置或按 `Esc` 取消选择；
8. 点击操作后浮动提示消失，选区快照和实体引用进入右侧 Data Agent 页签。

可选择区域不能包含破坏性控件。用户点击按钮、输入框、复选框、链接时，不触发内容选择。

### 7.4 右侧工作区与页签

Data Agent 与“沟通”共用右侧工作区，不各自创建一套互不兼容的抽屉。

规则：

1. 点击右上角 Data Agent 图标，打开或激活 Data Agent 页签；
2. 点击右上角沟通图标，打开或激活沟通页签；
3. 两个页签可以同时存在；
4. 切换页签不丢失对话、报告阅读位置、输入草稿或沟通滚动位置；
5. 每个页签可单独关闭；
6. 关闭当前页签后自动激活相邻页签；
7. 全部页签关闭后收起右侧工作区；
8. 顶部关闭按钮收起整个右侧工作区，再次点击全局图标恢复最近页签。

页签视觉：

- 页签栏位于右侧工作区最上方；
- 高度 36–40px；
- 当前页签使用下划线或高对比背景；
- 标签分别为“Data Agent”和“沟通”；
- 每个页签保留关闭按钮；
- 不将报告、会话、设置做成页签，它们属于 Data Agent 页签内部状态。

### 7.5 Data Agent 页签

直接点击全局图标进入时：

- 不要求先选择内容；
- 显示 Data Agent 欢迎态和输入框；
- 页面上下文默认带入当前项目、页面和时间范围；
- 可直接提问，也可以继续选择页面内容补充附件。

通过选区操作进入时：

- 选中内容已经作为上下文附件加载到输入区；
- 附件展示类型、标题、摘要和来源；
- 输入框为空，用户可以补充问题，也可以直接发送；
- 提供 3 个与选区相关的建议问法；
- 用户尚未点击发送时，不自动发起分析。

附件类型：

| 类型          | 附件内容                           | 附加来源               |
| ------------- | ---------------------------------- | ---------------------- |
| 指标 / 卡片   | 渲染快照、标题、关键数值、对象引用 | 工作台、项目、时间范围 |
| 选中文本      | 文本原文、所在组件、字符范围       | 页面标题、项目         |
| 图表 / 图片   | 可视快照、媒体引用、替代文本       | 数据源、生成时间       |
| 任务 / 风险行 | 标题、状态、时间、责任人摘要       | 业务对象深链           |

交互：

- 未点击发送前，用户可删除上下文附件；
- 用输入框补充分析目标、时间范围或关注指标；
- 消息发送后，附件与补充文案共同组成用户消息；
- Data Agent 以流式进度展示数据权限校验、查询和报告生成步骤；
- 页面主区保持可见，不使用全屏遮罩；
- 用户可以用 `Esc` 或页签关闭按钮退出。

### 7.6 报告结果

Data Agent 的默认交付物是 **Markdown + 图片穿插的报告**，不是默认生成 HTML。

一次默认报告生成至少包含：

- `report.md`：结论、指标、表格、证据链和建议；
- 多张图片资产：趋势图、对比图、分布图等；
- 图片在 Markdown 中使用相对资源引用或稳定附件引用；
- 报告清单：标题、数据截止时间、口径版本、审计信息和图片资产列表；
- 不自动创建 HTML 文件。

对话中的报告结果卡展示：

- 报告标题；
- 一句结论；
- 关键指标；
- 报告格式：`Markdown + 3 张图`；
- “浏览报告”；
- “下载 Markdown”；
- “生成 HTML 版”；
- 数据截止时间、口径和证据链摘要。

点击“浏览报告”后，在 Data Agent 页签内部切换到报告阅读态：

- 顶部提供“返回对话”；
- 正文按 Markdown 渲染，图片在对应章节内穿插展示；
- 正文包含摘要、指标、趋势、主要发现、证据链和建议；
- 报告内容不进入可编辑状态；
- 用户可继续下载或展开阅读；
- 切到沟通页签再返回时，报告阅读位置不丢失。

HTML 生成规则：

1. 用户在报告卡或报告阅读态点击“生成 HTML 版”；
2. 系统以当前 Markdown 版本和图片资产为输入，不再重新查询数据；
3. 生成独立 HTML Artifact，并保留与 Markdown 版本的关联；
4. 生成完成后，入口变为“浏览 HTML”和“下载 HTML”；
5. 用户可以继续选择下载 Markdown；
6. HTML 生成失败不影响 Markdown 报告的使用；
7. 用户重新分析产生新报告版本后，旧 HTML 不得自动冒充新版本，必须显示“版本已过期”并提供重新生成。

用户也可以在对话中明确输入“生成 HTML 版报告”，效果与点击“生成 HTML 版”一致。

下载规则：

- 默认下载 Markdown 源文件；
- 图片可随 Markdown 打包为 ZIP，或在支持附件引用的环境中按资源链接下载；
- 用户点击“下载 HTML”时，只下载已经生成的 HTML 版本；
- HTML 版本内嵌图片或引用同一报告资产包；
- 报告仅包含当前账号有权访问的数据快照；
- 下载动作记录审计事件；
- 报告内容中的链接不携带临时访问令牌。

### 7.7 展开模式

右侧工作区支持展开：

- 默认：480–520px；
- 展开：占用“页面区域减去左侧导航”的全部空间；
- 左侧导航保持可见；
- 页签栏固定在顶部；
- Data Agent 页签展示报告宽画布；
- 沟通页签保持消息列表和输入区；
- 移动端展开即占满视口。

### 7.8 Data Agent Panel：可选辅入口

`pluginmax.data-agent` 是可安装面板插件，建议默认宽度 6/6，最小高度 320px。

承载内容：

1. 最近洞察；
2. 最近报告；
3. 运行状态；
4. 打开 Data Agent 页签的入口；
5. 最近一次分析。

该面板可以：

- 被安装到任意工作台；
- 按工作台单独移除；
- 有多实例时分别配置项目、指标和时间范围；
- 不改变 Data Agent 的全局入口、身份和权限。

### 7.9 最小上下文契约

```ts
type DataAgentSelectionContext = {
  kind: "component" | "metric" | "text" | "chart" | "media" | "record";
  entityType?: RegisteredEntityType;
  entityId?: string;
  title: string;
  excerpt: string;
  source: {
    workspaceId: string;
    projectId?: string;
    page: "workbench" | "task" | "meeting" | "project" | "workflow";
    entityRef?: string;
    timeRange?: { from: string; to: string };
  };
  snapshot?: {
    text?: string;
    imageRef?: string;
    componentSchemaVersion?: string;
  };
};
```

前端只提交必要的渲染快照和对象引用，不提交完整 DOM、隐藏字段、浏览器存储或无权限内容。服务端在创建 Run 前重新校验对象与数据权限。

### 7.10 视觉原则

- 全局 Data Agent 图标使用 Agent 紫色，沟通保持蓝色；
- 选择外框使用蓝色，唤起操作使用 Agent 紫色；
- 页签栏保持紧凑，不使用大卡片或重复标题；
- 报告中成功、风险、关注分别使用绿、红、黄；
- 附件展示当前内容，不把整张页面截图塞进输入框；
- 报告中优先使用指标、表格和趋势图，不用长段落替代结论。

---

## 8. 完整交互流程

### 8.1 从全局图标唤起

1. 用户在一级页面右上角点击 Data Agent 图标；
2. 右侧工作区打开，并激活 Data Agent 页签；
3. 默认带入当前页面、项目、时间范围和最近活动；
4. 用户可以直接输入问题；
5. 工作台不出现横向 Data Agent 卡片，也不出现常驻输入条。

### 8.2 从页面内容唤起

1. 用户在任一支持选择的一级页面或详情页中浏览指标、卡片或文本；
2. 用户点击卡片，或拖选一段文字 / 图表区域；
3. 选区出现蓝色外轮廓，上方出现「让DataAgent分析」；
4. 用户点击操作；
5. 右侧 Data Agent 页签打开，选中内容以附件形式出现在输入区；
6. 页面主区仍保持可见，并保留原滚动位置。

### 8.3 补充问题并发送

1. 输入框自动聚焦；
2. 用户补充业务问题，例如“找出主要原因并对比上一周期”；
3. 用户也可以不补充，直接发送；
4. 系统将选中内容附件与补充文案组成一条用户消息；
5. 对话区展示数据权限校验、查询、归因和报告生成进度；
6. 分析失败时保留附件与用户问题，可直接重试。

### 8.4 浏览与下载报告

1. Data Agent 返回报告结果卡；
2. 默认报告以 Markdown + 图片穿插形式生成；
3. 用户点击“浏览报告”；
4. 对话页签切换到报告阅读态；
5. 用户查看摘要、指标、趋势、证据链和建议；
6. 用户可下载 Markdown；
7. 用户点击“生成 HTML 版”后，系统基于同一报告快照生成 HTML；
8. 生成完成后可浏览或下载 HTML；
9. 用户可返回对话继续追问，已选上下文仍然保留。

### 8.5 与沟通页签并行

1. 用户先打开 Data Agent 页签；
2. 用户点击右上角沟通图标；
3. 沟通加入同一个右侧工作区，作为第二个页签；
4. 两个页签来回切换时，保留 Data Agent 草稿、报告位置和沟通滚动位置；
5. 用户单独关闭任一页签，另一个页签继续保留；
6. 关闭最后一个页签后，右侧工作区收起。

### 8.6 展开对话

1. 用户点击右侧工作区标题栏展开按钮；
2. 对话抽屉从右侧扩展到左侧导航以外的整个页面；
3. 左侧导航保持可见；
4. 报告在更宽的画布中展示；
5. 用户点击还原按钮回到侧边抽屉；
6. 关闭后恢复原工作台及滚动位置。

### 8.7 数据缺口

1. 分析发现字段缺失、事件未埋点或数据过期；
2. Data Agent 在报告中展示缺失项、影响范围和可替代口径；
3. 用户可以把缺口转为数据治理任务；
4. 创建任务前展示预填标题、责任人、优先级和验收标准；
5. 用户确认后进入现有任务系统；
6. Data Agent 不自行指派外部人员，不绕过任务权限。

---

## 9. 页面与组件规范

### 9.1 可选择态

- 可选择的顶层对象包括业务面板、指标卡、列表行、洞察卡、图表和媒体；
- 悬停时只增强边框，不移动布局；
- 选中时使用 2px 蓝色外轮廓和低透明度蓝色光晕；
- 选中状态不改变组件内部交互；
- 文本选择优先于组件选择；
- 同一页面同时只保留一个选区。

### 9.2 浮动操作

固定文案：`让DataAgent分析`。

- 高度 28–32px；
- 悬浮于选区上沿，不覆盖选中数据主体；
- 左侧图标表达“选择并分析”；
- 操作只有一个，不并列“追问”“生成报告”等多个按钮；
- 键盘用户也可通过 `Enter` 触发；
- `Esc`、点击空白处或重新选择内容时消失。

### 9.3 侧边对话

建议宽度：桌面 480–520px，移动端全屏。

顶部：

- Data Agent / 沟通共享页签栏；
- Data Agent 头像与平台内置标识；
- 当前项目或页面的简短上下文；
- 设置、展开、关闭操作。

正文：

- 初始上下文提示；
- 用户消息；
- Agent 进度；
- 报告结果卡；
- 继续追问。

输入区：

- 选中内容附件；
- 建议问法；
- 多行输入框；
- 发送按钮；
- 只读查询与权限说明。

通过右上角全局图标直接打开时，显示欢迎态和输入框，不要求先选择内容；通过选区打开时，附件已经载入。两种情况都不使用全屏遮罩挡住工作台。

### 9.4 上下文附件

- 显示内容类型、标题、摘要和来源；
- 卡片附件不复制整张页面截图，使用组件快照和对象引用；
- 文本附件显示选中原文；
- 图表和媒体附件显示缩略预览和替代文本；
- 支持在发送前移除；
- 需要区分“事实快照”和用户补充文案；
- 附件内容在服务端再次校验权限。

### 9.5 报告卡与报告阅读态

对话中的报告卡至少包含：

1. 报告标题；
2. 一句结论；
3. 三个关键指标或发现摘要；
4. 数据范围与生成时间；
5. 报告格式与图片数量；
6. “浏览报告”；
7. “下载 Markdown”；
8. “生成 HTML 版”。

报告阅读态至少包含：

- 返回对话；
- 摘要；
- 关键指标；
- 趋势或对比图；
- Markdown 正文与图片穿插展示；
- 主要发现；
- 证据链；
- 建议下一步；
- 口径、截止时间和权限说明；
- Markdown 下载入口；
- 按需生成 / 下载 HTML 入口。

报告默认不生成 HTML。HTML 是独立派生产物，必须由用户明确点击或明确输入生成指令后创建。

### 9.6 展开态

- 桌面端 `left = 左侧导航宽度`；
- 移动端 `left = 0`；
- 顶部工具栏保持固定；
- 正文独立滚动；
- 报告最大内容宽度 860–960px；
- 展开和还原不重置报告滚动位置；
- 关闭后返回原工作台位置。

### 9.7 文案规范

- 操作名固定为“让DataAgent分析”；
- 使用“选中内容”“补充问题”“浏览报告”“下载 Markdown”“生成 HTML 版”；
- 区分“事实”“推断”“建议”；
- 失败时说明具体数据源或工具，不只写“请求失败”；
- 时间范围采用业务可读格式，例如“10 月 20 日–10 月 26 日”；
- 平台内置身份统一写“平台内置”。

---

## 10. 数据、上下文与安全

### 10.1 数据接入

MVP 支持通过现有 MCP / Connector 接入：

- 业务数据库只读副本；
- 指标服务；
- 数仓查询服务；
- 文件与表格数据集；
- 任务、项目、会议中的业务上下文。

每个连接声明：

- 连接类型与版本；
- 可用工具；
- 数据范围；
- 最大查询行数与超时；
- 是否允许导出；
- 敏感字段策略；
- 最近健康检查。

### 10.2 分析上下文

Data Agent 的上下文按优先级装配：

1. 当前用户选中内容的快照与对象引用；
2. 当前请求与用户补充问题；
3. 当前工作台 / 项目上下文；
4. 平台指标口径 Skill；
5. 工作区数据源说明；
6. 最近相关报告与任务；
7. 场景记忆。

不同工作区、项目和私有会话之间不得串用数据。用户切换项目或页面后，新选区必须使用新的上下文，不得静默复用上一次选中的卡片。

### 10.3 工具与副作用

| 动作             | 默认权限       | 确认要求               |
| ---------------- | -------------- | ---------------------- |
| 查询只读数据     | 允许           | 无                     |
| 保存个人报告草稿 | 允许           | 无                     |
| 发布报告到项目   | 工作区配置决定 | 首次与高风险范围需确认 |
| 创建任务草稿     | 允许           | 创建前确认             |
| 指派任务给他人   | 需要动作票据   | 明确确认               |
| 修改指标定义     | 禁止           | 走数据管理员流程       |
| 写业务数据库     | 不支持         | 不提供工具             |

### 10.4 安全与审计

每次 Run 至少记录：

- 请求人、工作区和项目；
- Agent 版本与 Skill 版本；
- 请求内容与上下文摘要；
- 使用的数据连接和工具；
- 查询起止时间、命中行数和受限原因；
- 输出摘要、报告引用和后续动作；
- 失败、重试、取消和超时。

敏感数据不得出现在前端遥测、错误日志或未授权分享中。

---

## 11. 产品对象与接口建议

### 11.1 新增字段

在现有模版或系统 Agent 元数据中增加：

```ts
type SystemAgentMeta = {
  systemKey: "data-agent" | "meeting-facilitator" | string;
  protected: {
    deletable: false;
    archivable: false;
    templateSwitchable: false;
  };
  resettableScopes: Array<
    "workspace-config" | "memory" | "platform-definition"
  >;
};
```

工作区绑定配置：

```ts
type DataAgentWorkspaceConfig = {
  workspaceId: string;
  teammateId: "data-agent";
  dataConnectionIds: string[];
  defaultProjectId?: string;
  defaultTimeRange: "today" | "7d" | "30d" | "month";
  timezone: string;
  preferredMetricIds: string[];
  insightSubscriptions: InsightSubscription[];
  reportSubscriptions: ReportSubscription[];
  revision: number;
  updatedAt: string;
};
```

### 11.2 建议接口

| 方法 | 路径                                             | 说明                                 |
| ---- | ------------------------------------------------ | ------------------------------------ |
| GET  | `/api/collab/data-agent`                         | 获取身份、状态、连接和工作区配置     |
| POST | `/api/collab/data-agent/selection/resolve`       | 校验选区对象并生成短期上下文引用     |
| POST | `/api/collab/data-agent/query`                   | 创建分析 Run，返回流式进度与结果引用 |
| GET  | `/api/collab/data-agent/runs/:id`                | 获取 Run、证据链和错误               |
| POST | `/api/collab/data-agent/report`                  | 从分析结果生成 Markdown + 图片报告   |
| GET  | `/api/collab/data-agent/reports/:id`             | 获取报告清单、Markdown 和图片资产    |
| POST | `/api/collab/data-agent/reports/:id/render-html` | 用户指定生成 HTML 派生版本           |
| GET  | `/api/collab/data-agent/reports/:id/html`        | 获取已生成的 HTML 版本               |
| GET  | `/api/collab/data-agent/reports/:id/download`    | 按 `format=md\|html\|zip` 下载       |
| POST | `/api/collab/data-agent/subscriptions`           | 创建或修改定期报告                   |
| POST | `/api/collab/data-agent/reset`                   | 恢复当前工作区默认配置               |
| GET  | `/api/collab/data-agent/insights`                | 获取主动洞察                         |
| POST | `/api/collab/data-agent/insights/:id/action`     | 已了解、继续分析或转任务             |
| GET  | `/api/collab/data-agent/panel-data`              | 供工作台面板读取摘要                 |

所有接口经过现有身份、Principal Action Ticket 与审计链路。

### 11.3 工作台槽位

建议新增平台保留槽位：

```text
platform.global-action.data-agent
platform.side-panel.tabs
platform.selection.data-agent
```

`global-action.data-agent` 负责所有一级页面右上角的恒驻入口；`side-panel.tabs` 统一承载 Data Agent 与沟通页签；`selection.data-agent` 承载已注册实体的选择适配。三者都与普通面板槽位分离。面板插件继续通过：

```text
workbench.canvas.panel: pluginmax.data-agent
```

注册可选 Data Agent Panel。

---

## 12. 异常、空态与恢复

| 场景                   | 策略                                       |
| ---------------------- | ------------------------------------------ |
| 工作台尚无数据源       | 选中操作仍可出现，对话中展示配置引导       |
| 当前项目无权访问       | 提示切换有权限项目；不自动降级到其他项目   |
| 某数据源超时           | 返回已完成部分并明确未覆盖范围             |
| 指标口径冲突           | 展示多个候选口径，要求用户确认，不自行选择 |
| 选中内容已失效         | 要求重新选择，不复用旧快照                 |
| 报告生成失败           | 保留附件和用户问题，可直接重试             |
| Agent 运行时不可用     | 对话保留输入和附件，标注暂不可分析         |
| 用户 Reset 失败        | 保持原配置，展示未完成步骤，可重试         |
| 系统升级导致配置不兼容 | 保留旧配置备份并进入“需重新确认”状态       |

---

## 13. 分阶段实施

### Phase 1：全局入口、选择式对话与共享页签可用

- 新增 `data-agent` 平台种子与保护规则；
- AI伙伴列表展示平台内置身份；
- 所有一级页面右上角新增 Data Agent 恒驻图标，位于沟通图标左侧；
- 指标卡、任务、工作流、工作流节点、会议和文本进入可选择态；
- 实现「让DataAgent分析」浮动操作和右侧对话抽屉；
- Data Agent 与沟通共享右侧页签栏；
- 选中内容作为上下文附件进入对话；
- 默认生成 Markdown + 图片报告，支持浏览与下载 Markdown；
- 用户点击“生成 HTML 版”后创建派生 HTML Artifact；
- 支持对话和报告扩展到左栏以外区域；
- 支持工作区 Admin 恢复默认；
- 复用现有只读查询工具。

验收：全局图标可在所有一级页面打开 Data Agent；两个页签可同时存在且状态互不丢失；选择后可完成对话、报告浏览、下载与展开；不可删除；Reset 不丢报告历史。

### Phase 2：任务闭环与可选面板

- 新增 `pluginmax.data-agent` 面板；
- 支持异常诊断和主动洞察；
- 支持创建数据治理任务；
- 支持从指标、供应风险、任务详情与会议纪要中的选区带入上下文；
- 报告草稿可保存到项目或任务。

验收：分析结果可进入现有任务和文件链路；面板可移除以验证不影响 Agent 本身。

### Phase 3：定期报告与治理

- 订阅、报告版本与投递失败通知；
- 指标口径 Skill 版本化；
- 数据准备度监控；
- 平台管理员的 Agent 版本发布与平台级 Reset；
- 更多数据源与模板。

验收：定期报告按期率和数据缺口闭环达到目标。

---

## 14. 验收标准

### 14.1 系统身份

- [ ] Data Agent 固定身份在所有工作区可见，不因首次进入而重复创建。
- [ ] AI伙伴列表、全局入口和设置页显示一致的“平台内置”身份。
- [ ] 普通用户与管理员界面均不存在删除、归档、卸载、换模版入口。
- [ ] 受保护对象 API 拒绝删除并记录审计。
- [ ] 用户无法通过复制或导出生成冒充系统身份的 Agent。

### 14.2 恢复默认

- [ ] 工作区管理员可以预览 Reset 影响范围。
- [ ] Reset 后补充指令、偏好和缓存恢复默认。
- [ ] 数据连接、报告、Run、任务和文件仍存在。
- [ ] Reset 有审计记录和完成摘要。
- [ ] 重复 Reset 不产生重复对象或错误。

### 14.3 工作台

- [ ] 工作台不出现横向 Data Agent 卡片或常驻输入条。
- [ ] 所有一级页面右上角在沟通左侧显示 Data Agent 图标。
- [ ] 点击全局图标可以直接打开 Data Agent 页签。
- [ ] 任意可分析卡片、指标、文本和图表均可被选中。
- [ ] 选中后，操作悬浮在选区上方并显示“让DataAgent分析”。
- [ ] 点击操作后，选区内容作为附件进入对话输入区。
- [ ] Data Agent 与沟通可同时打开，并通过独立页签切换和关闭。
- [ ] 切换页签后，Data Agent 草稿与沟通输入不丢失。
- [ ] 编辑布局时无法移除全局入口、选择能力和侧边页签容器。
- [ ] Data Agent Panel 可以单独移除，不影响选择能力。
- [ ] 打开、展开和关闭对话后，工作台滚动位置不丢失。
- [ ] 桌面和移动端均无文字或操作控件重叠。

### 14.4 分析

- [ ] 用户可在发送前补充问题，也可直接发送。
- [ ] 每个报告包含时间范围、口径、来源和截止时间。
- [ ] 无权限数据不会出现在结果、图表、导出或错误信息中。
- [ ] 查询失败时不展示猜测值。
- [ ] 数据缺口可以转为预填任务草稿。
- [ ] 默认报告为 Markdown + 图片穿插格式。
- [ ] 报告卡支持“浏览报告”“下载 Markdown”“生成 HTML 版”。
- [ ] 用户未点击生成时，系统不创建 HTML Artifact。
- [ ] 点击“生成 HTML 版”不会重新查询数据，使用同一报告快照。
- [ ] Markdown 新版本产生后，旧 HTML 显示过期状态。
- [ ] 报告可以保存并重新打开，保留生成时快照。
- [ ] 对话和报告展开后只占用左侧导航以外的页面区域。

---

## 15. 测试场景

1. 用户在工作台看不到横向 Data Agent 卡片，但在右上角沟通图标左侧看到恒驻 Data Agent 图标。
2. 用户点击 Data Agent 图标，右侧打开 Data Agent 页签并可以直接输入问题。
3. 用户点击 OTIF 指标卡，选区上方出现“让DataAgent分析”，点击后右侧对话打开并加载指标附件。
4. 用户拖选一段风险描述，只有文本被加载为附件，所在卡片的其他内容不进入上下文。
5. 用户选择图表后，附件显示图表缩略和替代文本。
6. 用户补充“找出主要原因并对比上一周期”后发送，报告包含该问题与选中内容。
7. 用户先打开 Data Agent，再点击沟通图标，两个页签同时存在；来回切换时输入草稿不丢失。
8. 用户关闭沟通页签，Data Agent 页签保持打开；关闭最后一个页签后右侧工作区收起。
9. 普通成员选中含行级权限的指标，查询结果只覆盖有权区域。
10. 用户切换到无数据权限项目，旧选区失效并要求重新选择。
11. 管理员删除 Data Agent，API 返回受保护错误。
12. 管理员执行 Reset，确认报告与 Run 未删除。
13. 用户生成报告后默认得到 Markdown + 图片；未点击生成时不存在 HTML 文件。
14. 用户点击“生成 HTML 版”后得到同一快照的 HTML，下载内容与 Markdown 版本一致。
15. 用户展开侧边栏，左栏仍可见，Data Agent 和沟通页签覆盖其余页面。
16. 数据源超时，Agent 返回部分结果并标记缺失范围。
17. 定时报告投递失败，责任人收到通知，历史版本不受影响。
18. 移动端选中内容、切换页签、展开和下载均不出现横向溢出。

---

## 16. 待评审问题

1. Data Agent 首版是否对普通成员开放“创建跟进任务”，还是仅允许保存草稿供负责人确认？
2. 工作区默认数据源应由工作区管理员配置，还是由平台管理员统一下发？
3. 选区操作是否需要按角色提供不同的默认分析问题？
4. Data Agent 是否允许在任务评论中被 `@` 后直接创建子 Run，还是复用任务主会话？
5. 定期报告的首发渠道优先级：工作台、项目任务、会议纪要还是文件共享？
6. 平台内置 Agent 的 Reset 是否支持按用户与工作区两级完全分离？
7. 选区是否支持多选并拼装为一个上下文包，还是首版只允许单个活动选区？

---

## 17. Data Agent 三层配置信息

本节只作为产品评审用的配置基线，不在 Demo 中实现。

### 17.1 三层职责

Data Agent 由三层配置共同组成，不能用一份 Prompt 同时表达：

| 层级                           | 回答的问题                         | 归属              | 可复用性                  |
| ------------------------------ | ---------------------------------- | ----------------- | ------------------------- |
| 运行时设置 Runtime Profile     | 用什么运行、能访问什么工具和环境   | 工作区 / 平台     | 可被多个 Agent 共用       |
| 智能体定义 Agent Definition    | Agent 如何思考、分析、输出和拒绝   | 平台              | 可绑定到多个 AI伙伴实例   |
| AI伙伴定义 Teammate Definition | 它是谁、归谁、在哪出现、是否受保护 | 平台 + 工作区绑定 | 对应用户看到的 Data Agent |

解析优先级：

```text
系统安全策略
  > 平台 Data Agent 定义
  > 工作区可恢复配置
  > 用户会话补充指令
```

下层配置不能覆盖上层的删除保护、只读约束、数据权限和系统身份。

### 17.2 运行时设置

运行时层沿用当前 AI伙伴的“外部运行时 + Runtime Profile”模型。外部运行时只描述执行通道和可用能力，Runtime Profile 负责工作区内的模型、工具、资源范围和预算。

以 Codex 为示例；Codebuddy 复用同一结构，只替换 `provider`、启动命令和适配字段。

#### 外部运行时

| 字段              | 建议值                       | 说明                                             |
| ----------------- | ---------------------------- | ------------------------------------------------ |
| `name`            | `Data Agent · Codex 本机`    | 运行时显示名                                     |
| `provider`        | `codex` / `codebuddy`        | 执行适配器                                       |
| `protocol`        | `stream-json` 或平台对应协议 | 事件和结果读取协议                               |
| `command`         | `codex` / `codebuddy`        | 启动命令                                         |
| `cwd`             | `{workspaceRoot}`            | 使用项目工作区作为根目录                         |
| `supportedTools`  | 只读分析与报告工具           | 运行时能力上限                                   |
| `supportedModels` | 平台允许的模型池             | 不在运行时写死唯一模型                           |
| `defaultModel`    | 空或平台默认                 | 具体任务可从模型池选择                           |
| `customArgs`      | 空数组                       | 不通过在额外参数中固定模型或推理强度绕过平台设置 |
| `status`          | `active`                     | 停用或归档后不能再派发新 Run                     |

#### Runtime Profile

| 字段                | 建议值                                                                                     | 说明                       |
| ------------------- | ------------------------------------------------------------------------------------------ | -------------------------- |
| `id`                | `drp-data-agent-default`                                                                   | Runtime Profile 唯一标识   |
| `principalId`       | `data-agent` 对应 Principal                                                                | Principal-first 运行时身份 |
| `employeeId`        | 兼容旧数据时可选                                                                           | 新配置不要求创建数字员工   |
| `workspaceId`       | 当前供应链工作区                                                                           | 运行时按工作区隔离         |
| `name`              | `Data Agent 默认分析运行时`                                                                | 显示名称                   |
| `provider`          | `codex` / `codebuddy`                                                                      | 使用的执行通道             |
| `model`             | 空表示工作区默认                                                                           | 可指定模型池中的模型       |
| `reasoningEffort`   | `medium`                                                                                   | 可对复杂诊断任务提高       |
| `allowedTools`      | `entity.read`、`metric.query`、`dataset.query.readonly`、`report.render`、`artifact.write` | 只读分析白名单             |
| `deniedTools`       | `database.write`、`task.assign`、`workflow.complete`、`permission.grant`                   | 明确拒绝                   |
| `resourceScopes`    | `workspace:<id>`、`project:<id>`、`dataset:authorized`                                     | 资源范围                   |
| `budget.maxTurns`   | `24`                                                                                       | 单次分析回合上限           |
| `budget.maxMinutes` | `15`                                                                                       | 单次 Run 时间上限          |
| `status`            | `active`                                                                                   | 停用后保留历史 Run         |

推荐配置样例：

```json
{
  "externalRuntime": {
    "id": "ext-data-agent-codex",
    "workspaceId": "ws-supply",
    "name": "Data Agent · Codex 本机",
    "provider": "codex",
    "protocol": "stream-json",
    "command": "codex",
    "cwd": "{workspaceRoot}",
    "supportedTools": [
      "entity.read",
      "metric.query",
      "dataset.query.readonly",
      "report.render",
      "artifact.write"
    ],
    "supportedModels": ["deepseek-chat", "deepseek-reasoner"],
    "defaultModel": "",
    "customArgs": [],
    "status": "active"
  },
  "runtimeProfile": {
    "id": "drp-data-agent-default",
    "principalId": "data-agent-principal",
    "workspaceId": "ws-supply",
    "name": "Data Agent 默认分析运行时",
    "provider": "codex",
    "model": "",
    "reasoningEffort": "medium",
    "allowedTools": [
      "entity.read",
      "metric.query",
      "dataset.query.readonly",
      "report.render",
      "artifact.write"
    ],
    "deniedTools": [
      "database.write",
      "task.assign",
      "workflow.complete",
      "permission.grant"
    ],
    "resourceScopes": [
      "workspace:ws-supply",
      "project:pluginmax-smoke",
      "dataset:authorized"
    ],
    "budget": {
      "maxTurns": 24,
      "maxMinutes": 15
    },
    "status": "active"
  }
}
```

Codebuddy 版本只替换：

```json
{
  "externalRuntime": {
    "provider": "codebuddy",
    "command": "codebuddy",
    "protocol": "stream-json"
  },
  "runtimeProfile": {
    "provider": "codebuddy"
  }
}
```

运行时设置不得包含：

- Data Agent 的人设与职责；
- 用户可见的 Agent 名称；
- 数据口径文本；
- 页面入口、是否可删除等产品属性；
- 明文数据库密码或外部 Token。

### 17.3 智能体定义

智能体定义回答“如何完成一次高质量分析”，核心字段如下：

| 字段              | Data Agent 默认值                                          |
| ----------------- | ---------------------------------------------------------- |
| `agentKey`        | `platform-data-agent`                                      |
| `name`            | `Data Agent`                                               |
| `role`            | `高级数据分析师`                                           |
| `version`         | `1.0.0`                                                    |
| `scenarios`       | 即时查数、异常诊断、定期报告、数据准备度治理               |
| `goals`           | 让业务问题获得可验证、可追溯、可行动的数据结论             |
| `defaultLanguage` | 中文                                                       |
| `contextPolicy`   | 当前选区 > 当前页面 / 项目 > 指标 Skill > 场景记忆         |
| `outputPolicy`    | 结论卡 + 指标 + 图表 + 证据链 + 建议                       |
| `toolPolicy`      | 只能调用 Runtime Profile 允许的只读分析工具                |
| `memoryPolicy`    | 保存会话摘要、用户补充指令和报告引用，不保存未脱敏原始结果 |

默认智能体定义：

```yaml
agentKey: platform-data-agent
name: Data Agent
role: 高级数据分析师
version: 1.0.0

goals:
  - 把业务问题转化为可验证的数据分析
  - 明确说明数据口径、时间范围和证据来源
  - 在数据不足时给出可执行的数据治理下一步

scenarios:
  - 即时查数
  - 异常诊断
  - 定期报告
  - 数据准备度治理

principles:
  - 先确认口径、时间范围和业务对象，再给结论
  - 明确区分事实、推断和建议
  - 不编造数据，不用示例值替代真实结果
  - 查询失败时说明具体数据源、失败步骤和重试条件
  - 默认只读，不直接修改业务数据
  - 跨项目、跨工作区数据必须重新校验权限

contextPriority:
  - explicit_selection
  - current_request
  - current_page_and_project
  - metric_skill
  - workspace_data_connections
  - recent_reports_and_tasks
  - scene_memory

outputContract:
  require:
    - conclusion
    - scope
    - metric_definition
    - evidence
    - uncertainty
    - next_action
  format:
    - report_card
    - markdown_report_with_images
    - html_report_on_demand
    - table
    - chart

safety:
  readOnlyByDefault: true
  requireConfirmationFor:
    - task_creation
    - external_publish
    - file_export
  forbidden:
    - unrestricted_sql
    - credential_access
    - cross_workspace_query
    - silent_metric_redefinition
```

平台管理员可以升级智能体定义版本。升级不得自动重写用户已生成报告；历史报告必须继续引用生成时的定义版本、Skill 版本和数据快照。

### 17.4 AI伙伴定义

AI伙伴定义回答“用户看到的这个 Data Agent 是谁、在哪出现、归谁管理”：

| 字段                            | 默认值                                              |
| ------------------------------- | --------------------------------------------------- |
| `teammateId`                    | `data-agent`                                        |
| `templateId`                    | `sys-data-agent`                                    |
| `source`                        | `platform`                                          |
| `owner`                         | `system`                                            |
| `displayName`                   | `Data Agent`                                        |
| `roleLabel`                     | `数据分析师 · 平台内置`                             |
| `agentDefinitionKey`            | `platform-data-agent`                               |
| `execution`                     | `external`                                          |
| `externalRuntimeId`             | `ext-data-agent-codex`                              |
| `runtimeProfileId`              | `drp-data-agent-default`                            |
| `state`                         | `active`                                            |
| `protected.deletable`           | `false`                                             |
| `protected.archivable`          | `false`                                             |
| `protected.templateSwitchable`  | `false`                                             |
| `visibility`                    | 所有一级页面、AI伙伴列表、业务对象选择动作          |
| `defaultConversationVisibility` | `private`                                           |
| `resettableScopes`              | `workspace-config`、`memory`、`platform-definition` |

AI伙伴配置样例：

```json
{
  "teammateId": "data-agent",
  "templateId": "sys-data-agent",
  "source": "platform",
  "owner": {
    "type": "system",
    "id": "platform"
  },
  "displayName": "Data Agent",
  "roleLabel": "数据分析师 · 平台内置",
  "agentDefinitionKey": "platform-data-agent",
  "execution": "external",
  "externalRuntimeId": "ext-data-agent-codex",
  "runtimeProfileId": "drp-data-agent-default",
  "state": "active",
  "protected": {
    "deletable": false,
    "archivable": false,
    "templateSwitchable": false
  },
  "surfaces": {
    "globalHeaderActions": [
      "workbench",
      "project",
      "task",
      "workflow",
      "communication",
      "meeting",
      "ai-partners",
      "resource-market"
    ],
    "selectionActions": true,
    "sidePanelTab": true
  },
  "defaultConversationVisibility": "private",
  "resettableScopes": ["workspace-config", "memory", "platform-definition"],
  "version": "1.0.0"
}
```

### 17.5 三层校验

发布或运行时至少检查：

1. AI伙伴引用存在的智能体定义和 Runtime Profile；
2. Runtime Profile 不包含超过平台数据权限的工具；
3. 智能体定义没有绕过只读约束；
4. 全局入口在允许的一级页面注册；
5. `data-agent` 固定身份仍存在且保护标记未被破坏；
6. 版本升级可回滚，历史报告引用保持不变。

---

## 18. 对话、报告与沟通记录的归档归属

本节只作为产品评审口径，不在 Demo 中实现。

### 18.1 统一采用“用户和 AI伙伴会话”模型

Data Agent 页签中的每次会话都必须形成可检索的 Conversation，不把输入输出只存在浏览器本地。

| 对象                  | 关键字段                                                                                                  | 归档要求                                          |
| --------------------- | --------------------------------------------------------------------------------------------------------- | ------------------------------------------------- |
| Conversation          | `conversationId`、`ownerUserId`、`workspaceId`、`projectId`、`agentId`、`title`、`visibility`             | 每次从全局入口或选区建立会话时创建                |
| Message               | `conversationId`、`senderType`、`senderId`、`content`、`createdAt`                                        | 用户消息、AI 消息、系统事件分别记录               |
| Context Attachment    | `messageId`、`entityType`、`entityId`、`snapshotRef`、`sourcePage`                                        | 只记录引用和必要快照，不复制无权限原始数据        |
| Agent Run             | `runId`、`conversationId`、`runtimeProfileId`、`agentDefinitionVersion`                                   | 与对应 AI 消息双向关联                            |
| Report Artifact       | `artifactId`、`conversationId`、`ownerType`、`ownerId`、`version`、`markdownRef`、`imageRefs`、`htmlRef?` | 默认生成 Markdown + 图片，HTML 按需派生并保留版本 |
| Communication Message | `channelId`、`messageId`、`senderId`、`artifactId?`                                                       | 沿用现有沟通归档，不复制成 Data Agent 私有副本    |

一个 Data Agent 会话可以产生多个 Report Artifact；一个 Report 也可以被引用到多个任务、会议或沟通消息中，但必须通过引用关系而不是复制权限。

### 18.2 数据归属判定

归属采用“申请人 + 使用场景”判定：

| 场景                        | Conversation 归属 | 默认可见性     | 报告归属                               |
| --------------------------- | ----------------- | -------------- | -------------------------------------- |
| 用户从全局图标发起          | 当前用户          | `private`      | 当前用户                               |
| 用户从工作台选区发起        | 当前用户          | `private`      | 当前用户                               |
| 用户从项目页面发起          | 当前用户          | `project` 可选 | 当前用户；保存到项目后项目拥有共享副本 |
| 用户在会议中发起            | 当前用户          | `meeting` 可选 | 当前用户；发布到会议后会议上下文可引用 |
| 用户在沟通中引用 Agent 报告 | 沟通消息作者      | 跟随沟通频道   | 不复制报告，引用原 Artifact            |
| 工作区定时报告              | 工作区            | `workspace`    | 工作区                                 |

判定规则：

1. 私聊会话的 `ownerUserId` 始终是发起会话的用户；
2. Data Agent 是 AI 消息的 `authorId`，但不是数据的唯一所有者；
3. 用户将报告保存到项目后，生成 `project` 归属的共享副本，私人草稿仍保留；
4. 用户将报告发布到工作区后，生成 `workspace` 归属的共享副本；
5. 未明确共享时，默认不向项目或工作区成员展示；
6. 引用的任务、会议、文件等原始对象仍由其原业务域拥有，Data Agent 不通过“分析过”获得额外权限；
7. 用户退出项目后，应按项目成员权限重新校验是否可读取共享报告，不能沿用其生成时权限。

推荐对象：

```ts
type ConversationArchive = {
  conversationId: string;
  ownerType: "user" | "workspace";
  ownerId: string;
  workspaceId: string;
  projectId?: string;
  agentId: "data-agent";
  title: string;
  visibility: "private" | "project" | "workspace";
  createdAt: string;
  updatedAt: string;
  archivedAt?: string;
};

type MessageArchive = {
  messageId: string;
  conversationId: string;
  senderType: "user" | "ai-partner" | "system";
  senderId: string;
  content: string;
  contextAttachmentIds: string[];
  runId?: string;
  createdAt: string;
};

type ArtifactOwnership = {
  artifactId: string;
  conversationId: string;
  ownerType: "user" | "project" | "workspace" | "meeting";
  ownerId: string;
  visibility: "private" | "project" | "workspace" | "meeting";
  sourceEntityRefs: string[];
  version: number;
};
```

### 18.3 归档展示与恢复

- Data Agent 会话进入 AI伙伴下的会话列表，按工作区、项目、最近使用和归属筛选；
- 会话详情可恢复上下文附件、报告、Agent Run 和用户补充问题；
- 沟通记录仍进入原沟通频道，不在 Data Agent 会话中重复铺设；
- 从沟通消息引用报告时，打开原 Artifact，不生成权限更高的新副本；
- 归档不等于删除，至少保留审计索引和对象引用；
- 用户删除私人会话时，已保存到项目的共享报告不受影响；
- 工作区数据保留策略可以清理过期快照，但不能破坏审计引用。

---

## 19. 跨页面实体选择与扩展

本节只作为产品评审口径，不在 Demo 中实现。

### 19.1 支持范围

Data Agent 的全局图标在所有一级页面可用；内容选择能力覆盖：

- 工作台；
- 项目列表、项目详情、项目文件；
- 任务列表、任务详情、任务评论；
- 工作流列表、工作流详情、节点详情；
- 沟通与会议；
- AI伙伴详情；
- 资源市场中的 Skill、MCP 和面板说明；
- 后续接入的一级页面。

页面之间切换时：

- 已打开的 Data Agent 和沟通页签保持存在；
- Data Agent 会话不因页面切换而清空；
- 新页面上下文写入下一个用户消息；
- 旧选区附件保留，直到用户主动移除或开始新会话。

### 19.2 平台已注册实体

卡片和结构化区域的选择只支持实体注册表中的类型。MVP 注册以下实体：

| 实体类型        | 示例               | 必须提供的引用                   |
| --------------- | ------------------ | -------------------------------- |
| `task`          | 任务卡、任务列表行 | `taskId`、项目、状态             |
| `workflow`      | 工作流卡片         | `workflowId`、版本、项目         |
| `workflow_node` | 节点详情、运行卡   | `workflowId`、`nodeId`、`runId?` |
| `meeting`       | 会议卡片、纪要     | `meetingId`、工作区、时间        |
| `metric_card`   | 指标卡、趋势图     | `metricId`、时间范围、口径版本   |

后续可扩展：

- `project`；
- `document`；
- `supplier_risk`；
- `customer`；
- `inventory_item`；
- 其他由业务插件注册的实体。

未注册的卡片、装饰模块、纯布局区域不能作为结构化实体进入 Data Agent；如果用户只需要提问，仍可拖选其中的文字或图片。

### 19.3 实体选择适配器

每个实体类型提供统一适配器：

```ts
type EntitySelectionAdapter = {
  entityType: string;
  schemaVersion: string;
  canSelect(element: HTMLElement): boolean;
  resolve(element: HTMLElement): {
    entityId: string;
    projectId?: string;
    displayTitle: string;
    snapshot: Record<string, unknown>;
    deepLink: string;
  };
  permissionScope(context: unknown): Promise<PermissionScope>;
};
```

注册要求：

1. 明确实体 id 和业务域引用；
2. 明确选择后的最小快照，不提交隐藏字段；
3. 提供服务端权限解析；
4. 提供实体深链；
5. 提供 schema 版本和迁移策略；
6. 页面组件升级不影响已归档附件；
7. 实体不可访问时返回明确错误，不静默降级为整页上下文。

### 19.4 跨页面场景验收

- 从任务页选中任务后进入工作流页，Data Agent 会话仍保留任务附件；
- 从工作流节点发起分析，再切换到沟通页签，两个页签互不覆盖；
- 从会议纪要选中文本，报告生成后可以引用回原会议任务；
- 选择未注册卡片时，不出现“实体分析”入口，但允许文本或图片选择；
- 页面刷新后会话引用可从归档恢复，选区 DOM 丢失不影响历史附件；
- 跨项目切换时不复用旧项目的数据权限或数据源连接。

---

## 20. 开发落地资料清单

### 20.1 建议阅读顺序

新 Session 应先读产品口径，再读工作台 / 外壳集成，再读 AI伙伴运行时，最后读具体业务实体与测试约定。

| 优先级 | 资料                                                                                                                        | 用途                                                       |
| ------ | --------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| P0     | [本 PRD](./data-agent-prd.md)                                                                                               | Data Agent 唯一产品口径；冲突时以本 PRD 为准               |
| P0     | [交互 Demo](./demos/data-agent-workbench-demo.html)                                                                         | 视觉、全局入口、双页签和选区交互参考                       |
| P0     | [选区 / 双页签预览](./demos/data-agent-workbench-preview.png)、[沟通页签预览](./demos/data-agent-communication-preview.png) | 页面形态快速确认                                           |
| P0     | [平台交互与视觉设计规范](./platform-interaction-design-guideline.md)                                                        | 字号、间距、颜色、状态、弹层和可访问性                     |
| P0     | [Agent 平台形态 PRD](./agent-platform-prd.md)                                                                               | Persona、Agent Profile、Agent Run 与持久成员边界           |
| P0     | [AI Teammate 技术设计](./ai-teammate-technical-design.md)                                                                   | 现有 AI伙伴身份、运行时和任务链路                          |
| P0     | [Teammate Template / Instance 拆分](./teammate-template-instance-split-design.md)                                           | 平台定义与实例 owner、保护字段、Reset 的落点               |
| P0     | [AI Teammate Runtime 交互 PRD](./ai-teammate-runtime-interaction-prd.md)                                                    | 现有运行时设置、模型、工具和会话交互                       |
| P1     | [工作台 2.0 PRD](./workbench-plugin-market-prd.md)                                                                          | 工作台实例、面板和插件槽位                                 |
| P1     | [工作台插件市场技术设计](./technical-design-workbench-plugin-market.md)                                                     | `pluginmax.global`、`workbench.canvas.panel` 与 keyed slot |
| P1     | [工作台 V2 README](../plugins/dsh-collab-workbench-v2/README.md)                                                            | 当前工作台宿主职责                                         |
| P1     | [工作台面板 README](../plugins/dsh-collab-workbench-panels/README.md)                                                       | 内置面板注入方式                                           |

### 20.2 代码与实现参考

| 模块         | 关键文件                                                                                                                                                                                | 重点                                             |
| ------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------ |
| 全局外壳     | [shell client](../plugins/dsh-collab-shell/client/index.js)                                                                                                                             | 一级页面、右上角全局动作、路由与右侧区域容器     |
| 工作台宿主   | [workbench-v2 client](../plugins/dsh-collab-workbench-v2/client/index.js)                                                                                                               | 工作台页、面板插槽、布局状态                     |
| 工作台面板   | [workbench-panels client](../plugins/dsh-collab-workbench-panels/client/index.js)                                                                                                       | 面板注册和实体卡片渲染                           |
| AI伙伴入口   | [teammate index](../plugins/dsh-collab-teammate/src/index.ts)                                                                                                                           | 平台内置 Facilitator 种子、固定身份、服务注入    |
| AI伙伴定义   | [teammate service](../plugins/dsh-collab-teammate/src/service.ts)                                                                                                                       | 模版、实例、保护状态、种子幂等                   |
| AI伙伴模型   | [teammate models](../plugins/dsh-collab-teammate/src/models.ts)                                                                                                                         | Teammate、Runtime、Execution 字段                |
| AI伙伴运行时 | [teammate runtime](../plugins/dsh-collab-teammate/src/runtime.ts)                                                                                                                       | 可执行身份、Runtime Profile、工具与预算          |
| AI伙伴客户端 | [teammate client](../plugins/dsh-collab-teammate/client/index.js)                                                                                                                       | 运行时设置、外部 Agent、会话和 AI伙伴详情交互    |
| Agent 执行   | [agent types](../plugins/dsh-collab-agent/src/types.ts)、[agent external](../plugins/dsh-collab-agent/src/external.ts)、[agent execution](../plugins/dsh-collab-agent/src/execution.ts) | Codex / Codebuddy 外部运行时、流式执行、工具门禁 |
| 运行时模型   | [employee models](../plugins/dsh-collab-employee/src/models.ts)、[employee service](../plugins/dsh-collab-employee/src/service.ts)                                                      | Runtime Profile 实际字段、权限和 Action Ticket   |
| 任务实体     | [task client](../plugins/dsh-collab-task/client/index.js)、[task source](../plugins/dsh-collab-task/src/index.ts)                                                                       | 任务卡选择适配和归档来源                         |
| 工作流实体   | [workflow client](../plugins/dsh-collab-workflow/client/index.js)、[workflow source](../plugins/dsh-collab-workflow/src/index.ts)                                                       | 工作流与节点选择适配                             |
| 会议与沟通   | [meeting client](../plugins/dsh-collab-meeting/client/index.js)、[meeting source](../plugins/dsh-collab-meeting/src/index.ts)                                                           | 会议实体、沟通记录和右侧面板状态                 |
| 项目与指标   | [project client](../plugins/dsh-collab-project/client/index.js)、[project source](../plugins/dsh-collab-project/src/index.ts)                                                           | 项目上下文、指标卡、归属判定                     |

### 20.3 数据和归档规则

| 资料                                                                      | 使用方式                                                         |
| ------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| 本 PRD 第 17 节                                                           | Runtime / 智能体 / AI伙伴三层配置                                |
| 本 PRD 第 18 节                                                           | Conversation、Message、Agent Run、Report Artifact 和沟通记录归属 |
| [任务 DE 会话设计](./agent-task-home-session-design.md)                   | 复用任务会话、上下文投递与 Session 命名规则                      |
| [任务评论共识与上下文](./task-comment-consensus-context-design.md)        | 评论引用、讨论与执行上下文区分                                   |
| [会议 Sidebar 设计](./meeting-sidebar-design.md)                          | 右侧面板宽度、状态和与主区的共存方式                             |
| [External Agent 技术设计](./external-agent-teammates-technical-design.md) | Codex / Codebuddy 外部运行时接入和失败处理                       |

### 20.4 测试与验收

- [平台账号、角色、项目 GUI 测试](./platform-account-role-project-gui-test-plan.md)；
- [External Agent GUI 测试计划](./gui-test-plan-external-agent-teammates.md)；
- [工作流 Agent GUI 测试计划](./workflow-agent-gui-test-plan.md)；
- [任务 E2E 测试设计](./gui-test-design-task-e2e.md)；
- 根目录 `scripts/check.sh`、`scripts/smoke.sh`；
- 新增 Data Agent 专项测试：系统种子幂等、保护删除、Reset、全局入口、双页签、跨页面选区、Markdown 默认报告、HTML 按需生成、归档归属、移动端布局。

### 20.5 Demo 使用边界

- Demo 用于确认页面形态与交互，不作为生产数据结构。
- Demo 目前仍以 HTML 报告交互为主；实际开发必须遵循本 PRD 7.6：默认 Markdown + 图片，HTML 仅在用户指定后生成。
- Demo 中的供应商、项目、指标和消息均为静态 Mock，不能直接当作业务接口契约。
- Demo 的右侧页签只是交互参考，实际实现必须接入现有会话、运行和审计链路。
