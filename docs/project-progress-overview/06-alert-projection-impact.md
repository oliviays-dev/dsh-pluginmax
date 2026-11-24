# Alert 投影模型与用户感知影响

## 1. 没有一等公民 Alert 会有什么问题

“没有一等公民 Alert”本身不是数据丢失，因为异常仍可从节点、任务和工作流事件推导。问题出在**稳定身份、处理状态和用户操作**。

临时派生 Alert 通常缺少：

- 稳定 `alertId`。
- `firstSeenAt` / `lastSeenAt`。
- 已确认、处理中、已解决、已抑制等生命周期。
- 关注、指派、备注、关联任务。
- 来源 revision 和条件清理规则。
- 去重、合并、重新打开和历史审计。

### 示例 1：关注状态丢失

用户关注“GPU 在途延迟”Alert。下一次 MCP 同步时：

- 事件 ID 变化。
- Alert 标题从“GPU 到货延迟”变成“GPU 模块预计 11-25 到货”。
- 临时派生的 ID 随标题变化。

用户感知：

- 星标自动变回未关注。
- 重点关注列表里消失，又出现一条“新异常”。
- 同一个问题被重复计数。

### 示例 2：处理状态不是用户真实状态

用户已经在群里确认“供应商已协调，预计 11-25 到货，保持跟进”。但如果 Alert 没有处理状态：

- 页面只能显示节点 `blocked` 或任务 `进行中`。
- 用户无法把 Alert 标记为“已确认，等待到货”。
- 系统继续把同一 Alert 当作未处理。
- 其他成员无法看出已有人接手。

### 示例 3：详情入口不稳定

点击 Alert 时，如果系统只能跳到第一个关联任务：

- 关联任务变化后，详情按钮跳到另一条任务。
- 用户看不到 Alert 的来源 revision、关联证据和状态历史。
- 同一个 Alert 可能跳到工作流，也可能跳到任务，行为不可预测。

### 示例 4：无法区分“事实消失”和“已经解决”

库存同步接口恢复后，GPU 在途字段暂时没返回：

- 临时派生逻辑会把 Alert 直接删除。
- 用户无法判断是“问题解决”还是“数据源断流”。
- 历史记录里没有“已解决”时间。

### 示例 5：多个模块显示不同异常数

项目概览按工作流事件计数，工作台按 Alert 计数，任务页按异常任务计数：

- 项目概览显示 3 个异常。
- 工作台显示 2 条风险。
- 任务页显示 4 个异常任务。
- 用户无法知道哪个是权威口径。

## 2. 推荐模型

Alert 不需要成为外部业务系统的主数据，但应成为项目域的**稳定投影实体**。

```text
外部事实 / 工作流事件
        ↓
Alert Candidate（规则生成）
        ↓
Alert Projection（稳定 ID + 生命周期 + 用户操作）
        ↓
项目概览 / 工作台 / 重点关注
```

### 最小字段

```json
{
  "alertId": "project-alert:SO0101:gpu-inbound-delay",
  "workspaceId": "ws-so0101",
  "conditionKey": "APS-PLANNING:PLN-SO0101-M03:gpu-inbound-delay",
  "sourceSystem": "APS-PLANNING",
  "sourceObjectId": "PLN-SO0101-M03",
  "sourceDocumentId": "mock-planning-so0101-20261118-r3",
  "sourceRevision": "PLAN-R3",
  "nodeId": "supply-prep",
  "alertType": "supply_delay",
  "severity": "P1",
  "title": "GPU 在途到货晚于首批总装需求",
  "description": "预计 11-25 到货，首批总装需求日期为 11-20，影响 14 台。",
  "lifecycle": "open",
  "assigneePrincipalId": null,
  "linkedTaskIds": ["TSK-1042", "TSK-1051"],
  "firstSeenAt": "2026-11-03T14:30:00+08:00",
  "lastSeenAt": "2026-11-18T12:00:00+08:00",
  "resolvedAt": null,
  "suppressedUntil": null,
  "followTargetId": "project-alert:SO0101:gpu-inbound-delay"
}
```

## 3. 生命周期

| 状态 | 触发 |
| --- | --- |
| `open` | 新异常候选进入或已解决条件再次命中 |
| `acknowledged` | 用户确认已知晓 |
| `in_progress` | 用户指派或标记处理中 |
| `resolved` | 来源条件解除或人工确认解决 |
| `suppressed` | 在指定时间前抑制重复提醒，但保留记录 |
| `stale` | 来源快照超过 SLA，无法确认当前状态 |

关键规则：

- 来源条件消失时置 `resolved`，不物理删除。
- 来源快照 stale 时置 `stale`，不自动 resolved。
- 同一 `conditionKey` 只允许一个活动 Alert。
- 重新命中时恢复原 `alertId`，不生成新关注对象。
- 标题、描述可更新，`alertId` 不随文案变化。

## 4. 页面影响

有稳定 Alert 投影后：

- 关注按钮可以稳定持久化。
- Alert 计数在项目概览、工作台和重点关注中一致。
- Alert 详情可以展示来源、修订、处理历史、关联任务。
- 用户可以把 Alert 指派给负责人。
- 同一 GPU 问题不会被重复创建。
- 数据源断流会显示 stale，不会伪装成已解决。

## 5. 规则示例

### GPU 到货延迟

```text
条件：
GPU-MODULE-H.timingGap.exists = true

conditionKey：
APS-PLANNING:PLN-SO0101-M03:gpu-inbound-delay

关联：
workflowNodeIds = [supply-prep]
taskIds = 来自工作流节点 taskIds + 任务模块 nodeRef

严重度：
P1；若影响客户交期则升级 P0
```

### 库存回传超 SLA

```text
条件：
WH-EAST-01.lastSuccessfulSyncAt 超过 slaMinutes

conditionKey：
WMS:WH-EAST-01:sync-sla

用户展示：
来源 WMS · 华东仓库存回传延迟 2 天
```

### 测试台能力下降

```text
条件：
BENCH-TEST-03.status = bottleneck
且 constraintEvent.status = open

conditionKey：
MES:BENCH-TEST-03:capacity-reduction

影响：
联调验证预计完成日期顺延
```

## 6. 对现有方案的平滑演进

第一阶段可以继续从工作流事件派生 Alert，但必须补稳定 `conditionKey`：

1. 页面显示的 Alert ID 改为条件哈希，不使用事件 ID。
2. 关注目标使用 `project-alert:<workspace>:<conditionKey hash>`。
3. 关系任务根据节点和来源稳定关联。
4. 后续增加 Alert 表时，用同一 `conditionKey` 回填。

这样可以避免用户关注关系在升级时全部丢失。

