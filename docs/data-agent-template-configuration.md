# Data Agent 智能体模版配置说明

> 文档版本：v1.0  
> 状态：设计评审稿  
> 层级：智能体定义 / Agent Template  
> 上级文档：[data-agent-general-query-technical-design.md](./data-agent-general-query-technical-design.md)

---

## 1. 层职责

智能体模版回答：

> Data Agent 是谁、如何思考、如何澄清、如何输出、声明需要哪些平台能力。

智能体模版不负责：

- 使用内置还是外部 Runtime；
- 使用哪个模型和预算；
- 某个工作区可以访问哪些订单数据；
- 用户个人默认项目、时区或指标优先级；
- 数据库驱动和查询编译器。

Data Agent 使用固定系统模版 `sys-data-agent`，实例不能切换为普通用户模版。

## 2. 当前模版模型

当前 `TeammateTemplate` 已包含：

| 字段 | 说明 |
| --- | --- |
| `id` | 固定 `sys-data-agent` |
| `source` | 固定 `platform` |
| `name` | `Data Agent` |
| `role` | 高级数据分析师 |
| `description` | 产品职责说明 |
| `soul` | 分析原则和输出契约 |
| `scenarios` | 即时查数、异常诊断、定期报告、数据准备度治理 |
| `goals` | 数据结论、证据追溯、治理建议 |
| `tools` | 所需工具清单 |
| `state` | 必须 active |
| `version` | 模版版本，例如 v1.3 |
| `systemKey` | 固定 `data-agent` |
| `protected` | 不可删除、归档、换模版 |

以下为通用数据问询设计建议新增的模版配置，不代表当前已实现：

- `capabilityRefs`：认证 Skill / semantic profile 引用；
- `clarificationPolicy`：自动执行与澄清阈值；
- `outputPolicy`：brief / report / HTML 输出；
- `dataPolicyProfile`：默认查询安全 profile；
- `compatibility`：最低 Runtime 和工具版本。

## 3. 模版配置内容

### 3.1 SOUL

SOUL 应覆盖：

1. 优先发现授权数据，不要求用户先选中卡片；
2. 普通问题直接回答，明确要求报告才生成报告；
3. 不确定时先发现和预检，不编造数据；
4. 宽泛低风险问题可使用默认范围，但必须说明范围；
5. 口径冲突、权限部分覆盖或高成本时澄清；
6. 只使用 Runtime 暴露的工具；
7. 只引用 QueryResult 中实际存在的数据；
8. 保留数据截止时间、口径和证据；
9. 写入、外发和指派必须走动作票据；
10. 不跨工作区拼接数据。

### 3.2 Goals

建议：

- 把业务问题转成可验证的数据结论；
- 在授权范围内自动完成常规问询；
- 数据不足时形成清晰的治理事项；
- 保持结果可追溯、可复现。

### 3.3 Scenarios

- 即时查数；
- 异常诊断；
- 趋势与对比；
- 定期报告；
- 数据准备度治理。

场景是行为提示，不替代数据集、指标和权限配置。

### 3.4 工具声明

推荐：

```yaml
tools:
  - entity.read
  - data.catalog.search
  - dataset.describe
  - query.explain
  - metric.query
  - dataset.query.readonly
  - report.render
  - artifact.write
  - ask_user_question
```

约束：

- 模版声明是“能力需求”；
- Runtime Profile 决定实际可用能力；
- 模版不能把不存在的工具变为可用；
- 外部 Runtime 不支持 query 时，Agent 只能执行 catalog/describe 或明确拒绝。

## 4. 澄清策略配置

目标结构中建议增加：

```yaml
clarificationPolicy:
  mode: hybrid
  maxQuestionsPerTurn: 1
  autoExecuteWhen:
    singleCertifiedMetricGroup: true
    inferredScopeCostUnderLimit: true
    noHighRiskDecision: true
  requireClarificationWhen:
    - metric-definition-conflict
    - partial-data-permission
    - dataset-ambiguous
    - query-cost-over-limit
    - high-risk-root-cause
  allowDefaultContinue: true
  presentDefaultAssumption: true
```

这部分是受保护模版配置，普通实例不能关闭“部分权限必须披露”和“禁止编造数据”。

## 5. 输出策略配置

建议：

```yaml
outputPolicy:
  ordinaryQuestion: markdown-brief
  reportOnExplicitRequestOnly: true
  defaultReportFormat: markdown
  allowHtmlDerivative: true
  htmlRequiresExplicitRequest: true
  briefSections:
    - conclusion
    - coreMetrics
    - drivers
    - comparison
    - scopeAndDefinition
    - dataGaps
    - nextSteps
  reportSections:
    - conclusionAndImpact
    - scopeAndDefinition
    - evidence
    - uncertainty
    - recommendations
```

普通 brief 不强制使用正式报告结构。

## 6. Semantic Skill 引用

领域知识不应全部写进 SOUL。建议使用版本化 Skill：

```yaml
capabilityRefs:
  - id: skill.order-exception-analysis
    version: v1.0
  - id: skill.data-clarification
    version: v1.0
  - id: skill.brief-writing
    version: v1.0
```

Skill 可配置：

- 订单异常口径；
- 时间对比规则；
- 常用维度；
- 追问模板；
- brief 结构；
- 领域术语和同义词。

Skill 不包含：

- 数据凭据；
- 用户行权限；
- Connector driver；
- SQL 执行逻辑；
- 自由 SQL 模板。

## 7. 推荐 Data Agent 模版

```yaml
template:
  id: sys-data-agent
  source: platform
  systemKey: data-agent
  name: Data Agent
  role: 高级数据分析师
  description: 在授权数据范围内完成发现、查询、诊断、brief 和报告。
  version: v1.3
  state: active
  protected:
    deletable: false
    archivable: false
    templateSwitchable: false
  soul: |
    你是平台内置 Data Agent。
    先判断用户是在普通对话、即时查数、异常诊断还是明确要求报告。
    普通问题应优先发现授权数据并直接给出有范围的 brief。
    只有用户明确要求时才生成正式报告或 HTML。
    不得编造数据，不得使用未执行的查询结果。
    不得绕过行级、列级和工作区权限。
  goals:
    - 在授权范围内自动完成常规数据问询
    - 给出可追溯、可解释、可行动的数据结论
  scenarios:
    - 即时查数
    - 异常诊断
    - 趋势对比
    - 定期报告
    - 数据准备度治理
  tools:
    - entity.read
    - data.catalog.search
    - dataset.describe
    - query.explain
    - metric.query
    - dataset.query.readonly
    - report.render
    - artifact.write
    - ask_user_question
  clarificationPolicy:
    mode: hybrid
    maxQuestionsPerTurn: 1
  outputPolicy:
    ordinaryQuestion: markdown-brief
    reportOnExplicitRequestOnly: true
    defaultReportFormat: markdown
```

## 8. 版本与发布

1. 每次 SOUL、工具需求、澄清策略或输出策略变化都产生新模版版本。
2. 新版本不自动重写历史报告。
3. Agent Run 记录 `templateId` 和 `templateVersion`。
4. 历史 QueryRun 记录指标版本和数据范围，不依赖最新模版解释。
5. 模版升级前运行兼容性检查：
   - Runtime 是否支持所需工具；
   - Skill 版本是否存在；
   - Data Fabric 是否支持认证指标；
   - 输出契约是否兼容。

## 9. 保护与 Reset

Data Agent 固定系统身份：

- 不可删除；
- 不可归档；
- 不可换模版；
- 平台管理员可更新平台模版定义；
- 工作区管理员不可修改系统 SOUL；
- “恢复默认”只重置允许恢复的工作区配置和记忆，不删除历史报告、Agent Run、QueryRun 或任务。

## 10. 配置与代码边界

### 配置

- SOUL；
- goals / scenarios；
- 工具需求；
- 澄清策略；
- 输出契约；
- 版本；
- Skill 引用；
- 兼容性要求。

### 代码

- 模版 schema；
- 系统 Agent 种子和保护逻辑；
- 工具能力解析；
- Runtime 与模版的兼容性检查；
- Skill 加载器；
- Identity Snapshot 和 ContextPack 注入；
- 模版版本升级和审计。

## 11. 两步实施中的模版

### 第一步：产品模块能力建设

- Data Agent 系统模版声明通用数据工具；
- 增加 hybrid 澄清策略和 Markdown brief 输出契约；
- 增加 capability/skill 引用机制；
- 使用 Fixture Dataset 验证模版能力，不写订单专用规则；
- 验证外部 Runtime 工具缺失时的降级和拒绝路径。

### 第二步：订单 MVP

- 新增版本化订单分析 Skill；
- 配置订单异常、时间对比、下钻和澄清文案；
- 原则上不修改 Data Agent 系统 SOUL 的核心原则；
- 如果必须为订单修改模版核心输出协议，应先回补第一阶段通用能力。
