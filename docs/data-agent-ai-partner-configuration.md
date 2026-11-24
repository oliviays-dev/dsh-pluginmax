# Data Agent AI伙伴实例配置说明

> 文档版本：v1.0  
> 状态：设计评审稿  
> 层级：AI伙伴实例 / Teammate Instance + 工作区配置  
> 上级文档：[data-agent-general-query-technical-design.md](./data-agent-general-query-technical-design.md)

---

## 1. 层职责

AI伙伴层回答：

> 这个工作区中的 Data Agent 使用哪些数据连接、默认项目、时区、时间范围、指标优先级和运行偏好。

该层不是另一份 Agent 定义，也不是权限系统副本。

AI伙伴实例层不负责：

- 修改 Data Agent SOUL；
- 更换系统模版；
- 扩大 Runtime 工具范围；
- 关闭 RLS 或列脱敏；
- 改写认证指标公式；
- 删除系统 Agent 或历史 QueryRun。

## 2. 当前实例与配置模型

### 2.1 Teammate Instance

系统实例固定：

```yaml
id: data-agent
templateId: sys-data-agent
systemKey: data-agent
ownerUserId: platform
state: active
protected:
  deletable: false
  archivable: false
  templateSwitchable: false
```

当前实例可保留：

- `principalId`
- `execution`
- `externalRuntimeId`
- 显示名称/描述等非系统身份覆盖

Data Agent 的系统身份、SOUL 和模版不可通过实例覆盖。

### 2.2 DataAgentWorkspaceConfig

当前已实现字段：

| 字段 | 说明 |
| --- | --- |
| `workspaceId` | 配置所属工作区 |
| `teammateId` | 固定 `data-agent` |
| `dataConnectionIds` | 工作区允许的只读连接 |
| `defaultProjectId` | 默认项目 |
| `defaultTimeRange` | `today` / `7d` / `30d` / `month` |
| `timezone` | 默认 `Asia/Shanghai` |
| `preferredMetricIds` | 工作区指标优先级 |
| `insightSubscriptions` | 洞察订阅 |
| `reportSubscriptions` | 报告订阅 |
| `externalRuntimeId` | 工作区 Runtime 覆盖 |
| `revision` | 配置版本 |
| `updatedAt / updatedBy` | 审计 |

目标结构建议新增：

| 字段 | 说明 |
| --- | --- |
| `dataProfileId` | 工作区默认数据查询策略 |
| `clarificationMode` | `hybrid` / `always-ask` / `default-first` |
| `maxRowsPerQuery` | 工作区查询上限，不得超过平台上限 |
| `maxReportRows` | 报告中允许引用的结果行数 |
| `allowCrossProjectAnalysis` | MVP 固定 false |
| `defaultDimensionOrder` | 默认下钻顺序 |
| `queryTimeoutMs` | 工作区默认查询超时 |

以上目标字段需要 Data Fabric 和 Data Agent 代码支持，当前尚未实现。

## 3. 工作区配置

### 3.1 数据连接

工作区管理员只能选择已经存在的授权连接，不能直接填写数据库密码。

约束：

- 连接必须 `readOnly=true`；
- 连接状态必须 active；
- 连接必须允许当前工作区；
- 连接配置不扩大用户行权限；
- 连接被删除或停用后，历史 QueryRun 保留但新查询拒绝。

### 3.2 默认项目

默认项目用于：

- 选择默认数据集授权范围；
- 选择默认指标偏好；
- 让无项目问题的 brief 有合理范围。

不得：

- 用默认项目绕过用户项目成员校验；
- 在用户无权访问默认项目时自动切换到其他项目。

### 3.3 时区与时间范围

- 时区影响“今天”“昨天”“本周”的解释；
- 默认时间范围用于未明确指定范围的问询；
- `today` 的实际结束时间是查询时刻，不是次日零点；
- 用户显式时间优先于工作区默认。

### 3.4 指标优先级

`preferredMetricIds` 用于：

- 同义词命中多个指标时排序；
- 默认 brief 选择；
- 工作台卡片和 Data Agent 结果保持一致。

不能用于：

- 将非认证指标伪装为认证指标；
- 覆盖用户显式选择；
- 改变指标公式。

### 3.5 澄清模式

推荐默认：

```yaml
clarificationMode: hybrid
```

语义：

- 高置信低风险问题直接执行；
- 口径冲突或部分权限时澄清；
- 用户可选择“按默认范围继续”。

`always-ask` 适合高审计要求工作区；`default-first` 适合内部探索工作区。无论何种模式，部分权限和高风险口径都必须披露。

## 4. 用户级偏好

用户级偏好可作为后续扩展，不与工作区治理配置混为一层。

建议目标对象：

```ts
type DataAgentUserPreference = {
  workspaceId: string;
  userId: string;
  preferredProjectId?: string;
  preferredTimezone?: string;
  preferredTimeRange?: "today" | "7d" | "30d" | "month";
  preferredMetricIds?: string[];
  resultVerbosity: "brief" | "standard" | "detailed";
  updatedAt: string;
};
```

优先级：

```text
本轮用户显式指令
  > 用户偏好
  > 工作区默认
  > 平台默认
```

用户偏好不能扩大权限，也不能改变认证指标公式。

## 5. 推荐工作区配置

```yaml
dataAgentWorkspaceConfig:
  workspaceId: ws-supply
  teammateId: data-agent
  dataConnectionIds:
    - conn-orders-readonly
  defaultProjectId: project-supply
  defaultTimeRange: today
  timezone: Asia/Shanghai
  preferredMetricIds:
    - order_exception_rate
    - fulfillment_timeout_rate
    - cancel_rate
  clarificationMode: hybrid
  maxRowsPerQuery: 500
  maxReportRows: 2000
  queryTimeoutMs: 15000
  externalRuntimeId: ext-data-agent-codex
  revision: 4
```

## 6. 实例显示覆盖

允许的实例覆盖：

- 显示名称；
- 简短描述；
- 头像；
- 工作区 Runtime 绑定；
- 非系统状态偏好。

不允许：

- 修改 `systemKey`；
- 修改 `templateId`；
- 删除或归档；
- 修改保护标记；
- 修改 SOUL / goals / scenarios；
- 关闭安全工具限制。

## 7. 权限

| 操作 | 权限 |
| --- | --- |
| 查看工作区 Data Agent | 工作区成员 |
| 使用 Data Agent 查询 | 有 Data Agent 可见性且对具体数据集有权 |
| 修改默认数据连接 | 工作区管理员 / 数据管理员 |
| 修改默认项目、时区、时间范围 | 工作区管理员 |
| 修改个人偏好 | 用户本人 |
| 修改系统模版 | 平台管理员 |
| 修改 Runtime Profile | 工作区管理员，不能超过平台上限 |
| Reset 工作区配置 | 工作区管理员 |

## 8. Reset 语义

Reset 会：

- 恢复工作区默认时间范围；
- 恢复默认项目；
- 恢复默认澄清模式；
- 清理可恢复的分析记忆；
- 恢复工作区 Runtime 选择；
- 保留数据连接与授权；
- 保留历史报告、Agent Run、QueryRun、任务和审计。

Reset 不会：

- 删除 Data Agent；
- 修改平台模版；
- 删除用户会话；
- 扩大或缩小真实数据授权；
- 重写历史报告。

## 9. 配置与代码边界

### 配置

- 连接选择；
- 默认项目；
- 时区；
- 默认时间范围；
- 指标优先级；
- 澄清模式；
- 行数、报告和超时上限；
- Runtime 绑定；
- 用户显示偏好和订阅。

### 代码

- 工作区成员和项目授权校验；
- DataAgentWorkspaceConfig 持久化；
- Runtime 覆盖解析；
- 数据连接解析；
- 默认范围应用；
- 用户级偏好存储；
- Reset 白名单；
- 配置 revision 和审计；
- 前端管理员配置和预览。

## 10. 三层优先级

```text
平台安全策略
  > Data Agent 系统模版
  > Runtime Profile 能力上限
  > 工作区 Data Agent 配置
  > 用户偏好
  > 当前会话显式指令
```

右侧是使用偏好，不能覆盖左侧的安全、身份、工具和数据权限。

任一层发生冲突时：

1. 安全限制优先；
2. 系统身份和保护优先；
3. Runtime 不支持时 fail closed；
4. 显示可执行的修复建议。

## 11. 两步实施中的 AI伙伴配置

### 第一步：产品模块能力建设

- 工作区配置接入真实数据连接清单；
- 默认项目、时区、时间范围、澄清模式和查询上限开始生效；
- 用户偏好与工作区 config 分离；
- 数据连接、数据集和指标通过通用管理入口配置；
- Fixture 环境验证配置优先级、Reset 和权限。

### 第二步：订单 MVP

- 为订单工作区配置订单连接、默认项目、时区和指标优先级；
- 配置订单查询上限和默认维度；
- 增加订单订阅和报告偏好；
- 订单域不新增第二套工作区配置模型；
- 如果订单需要模板级特例，应放入版本化 Skill，而不是实例配置。
