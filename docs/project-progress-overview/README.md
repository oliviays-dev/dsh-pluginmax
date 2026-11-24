# 项目概览：业务链路、MCP 数据源与 Alert 投影方案

> 状态：方案设计稿  
> 范围：项目详情「项目概览」页签  
> 约束：本文只定义数据契约和落地方案，不修改现有代码。  
> Mock 原则：四个 MCP 分别只读取各自目录中的 MD 快照，不从其他系统或页面补字段。

正式技术设计见：[项目业务链路与项目概览技术设计](07-project-trunk-technical-design.md)。

页面交互设计见：
[项目设置「业务链路」页签交互规格](08-project-settings-business-chain-tab.md)。

项目类型、项目模版与业务链路模板模型见：
[项目类型、项目模版与业务链路模板模型](09-project-type-template-business-chain.md)。

## 1. 先回答问题：业务链路能否由「工作流」定义承载

可以承载**流程拓扑和执行控制语义**，但业务链路由项目类型和项目模版治理，不采用全平台唯一主干。

供应链交付只是平台需要承载的场景之一。软件研发、客户实施、市场营销、采购寻源和研发项目都可以有各自的业务链路。

推荐采用“项目类型/模版治理 + 业务链路工作流 + 外部业务事实”的分层模型：

| 层 | 权威来源 | 负责内容 |
| --- | --- | --- |
| 业务链路控制图 | 工作流定义 / 业务链路实例 | 节点身份、顺序、分支、审批、执行状态、负责人、任务关联 |
| 业务事实 | 计划、订单、库存、产能 MCP | 计划数量、变更后数量、计划日期、订单变更、库存可用量、实际产出、产能瓶颈 |
| 汇总读模型 | 项目插件 | 将拓扑与事实按稳定外部引用合并，生成项目概览节点、Alert 和变更事件 |

关键结论：

1. 项目类型定义可用业务链路范围，项目模版选择默认或候选业务链路，项目实例保存创建时快照。
2. 业务链路由一个明确标记为 `business-chain` 的工作流定义承载，而不是任意一个执行工作流实例。
3. 工作流节点通过 `externalRefs` 关联当前业务链路需要的业务对象。
4. 工作流负责“流程走到哪里”，对应场景的 MCP 负责“业务数字是多少、何时变化、为什么变化”。
5. 项目概览图的数据来源应是“业务链路定义 + 当前实例 + 当前场景所需 MCP 快照”的合并结果。
6. Alert 应从事实和状态变化投影生成；如果产品要求关注、指派、处理状态和审计，则需要稳定的 Alert 投影实体。
7. 项目负责人可以通过上传项目级配置文件创建 `project-custom` 业务链路快照，并在
   项目设置中按项目概览相同的交互预览节点图。

## 2. 方案总体结构

```text
项目类型 ─> 项目模版 ─> 业务链路模板引用
                              │
                              ├─> 工作流定义 + 业务链路实例
                              │      └─> 流程拓扑 / 状态 / 任务
                              │
                              └─> 当前场景 MCP Adapter
                                     ├─> 标准化 SourceSnapshot
                                     ├─> 节点计划 / 变更 / 实际事实
                                     ├─> 关键变更与外部影响
                                     └─> Alert 投影
```

所有外部事实必须保留以下溯源字段：

```json
{
  "sourceSystem": "APS-PLANNING",
  "sourceDocument": "01-planning-system-mcp.md",
  "sourceObjectId": "PLN-SO0101-M03",
  "sourceRevision": "PLAN-R3",
  "observedAt": "2026-11-18T12:00:00+08:00",
  "effectiveAt": "2026-11-03T14:30:00+08:00",
  "isMock": true
}
```

## 3. 字段权威边界

下表以供应链交付场景为例；其他项目类型只能复用“字段必须有权威来源”的原则，不能复用具体字段。

| 页面字段 | 权威来源 | 禁止推断 |
| --- | --- | --- |
| 项目编号 / 项目名称 | 项目主数据；临时可与订单项目号映射 | 不从订单号截取项目编号 |
| 订单原始数量 | OMS | 不从计划数量反推订单数量 |
| 订单变更后数量 | OMS 订单行 | 不从当前节点计划覆盖 |
| 交期要求 | OMS | 不用计划完成日期替代客户要求 |
| 原计划数量 / 原计划完成日期 | Planning 基线版本 | 不从当前任务截止日期推断 |
| 变更后计划数量 / 日期 | Planning 最新已确认计划版本 | 不使用非确认草稿 |
| 节点负责人 | 工作流 `responsible` / `assignee` | 不从项目负责人继承 |
| 节点执行状态 | 工作流实例 | 不从数量进度猜测流程状态 |
| 库存可用量 / 占用量 / 在途量 | Inventory | 不从计划数量计算 |
| 生产实际完成数量 | Capacity / MES | 不从计划数量或订单数量推断 |
| 实际完成日期 | 对应事实源时间戳 | 不用页面刷新时间替代 |
| 工作流状态 | 工作流实例 | 不从订单状态映射 |
| 外部影响 | 对应源系统的变更或同步健康事件 | 不从普通任务备注推断 |
| Alert 关注 / 指派 / 处理状态 | Alert 投影 | 不从节点状态或任务状态猜测 |

## 4. 供应链交付示例场景包

以下四组 Mock MCP 只用于演示“供应链交付”场景，不代表平台的通用数据模型。

| MCP | 对应文档 | 只读数据范围 |
| --- | --- | --- |
| 计划系统 MCP | [01-planning-system-mcp.md](01-planning-system-mcp.md) | 供应链交付计划、基线、计划变更、工作包、依赖 |
| 订单系统 MCP | [02-order-management-system-mcp.md](02-order-management-system-mcp.md) | 销售订单、订单行、订单变更、发货和同步健康 |
| 库存系统 MCP | [03-inventory-system-mcp.md](03-inventory-system-mcp.md) | 库存余额、项目占用、在途、批次、仓库异常 |
| 产能系统 MCP | [04-capacity-system-mcp.md](04-capacity-system-mcp.md) | 产线能力、负荷、实际产出、测试瓶颈、设备异常 |

每个 MCP 文件同时包含：

1. MCP 服务身份。
2. 可调用工具和查询参数。
3. 返回字段说明。
4. 该服务唯一允许读取的 `Mock Source Document`。
5. 真实制造企业供应链场景下的结构化 JSON 快照。

MCP 实现时应只解析对应文件中的 `json mock-mcp-snapshot` 代码块。说明文字仅用于维护，不参与业务计算。

## 5. 业务链路承载方案

详细设计见 [05-trunk-workflow-binding.md](05-trunk-workflow-binding.md)。

建议在现有工作流定义上增加一层 `businessChain` 语义，而不是新建完全平行的一套流程系统：

```json
{
  "workflowKey": "business-chain-software-release",
  "kind": "business-chain",
  "businessChain": {
    "key": "software-release-v1",
    "displayName": "企业应用版本发布",
    "projectTypeCodes": ["software-delivery"],
    "snapshotPolicy": "pin-at-project-create"
  },
  "nodes": [
    {
      "id": "release",
      "name": "发布",
      "businessChain": {
        "sequence": 5,
        "stageCode": "RELEASE",
        "externalRefs": [
          {
            "system": "CI-CD",
            "objectType": "release-pipeline",
            "objectId": "release-pipeline-01"
          }
        ]
      }
    }
  ]
}
```

业务链路工作流负责：

- 节点显示顺序和分组。
- 节点自定义业务字段（平台默认只固定负责人和异常）。
- 节点是否可跳过、是否审批、依赖关系。
- 当前状态、执行人、任务 ID。
- 启动、完成、阻塞等控制事件。

场景 MCP 负责：

- 当前场景的业务事实。
- 来源修订和新鲜度。
- 业务变更和外部影响。
- 项目概览需要的计划、实际和异常字段。

## 6. 冲突与新鲜度规则

1. 拓扑冲突：以工作流定义版本为准；无法匹配的外部计划节点作为“未绑定计划事实”显示，不临时插入流程。
2. 日期/数量冲突：以对应领域系统最新已确认版本为准，禁止项目页手工覆盖。
3. 状态冲突：工作流实例决定执行状态；业务系统决定业务状态，两者分区展示。
4. 过期数据：超过 SLA 未刷新时，保留最后快照并标记 `stale=true`，不能把旧值伪装成实时值。
5. 多来源冲突：同一字段只能有一个权威源；辅助源只进入证据区，不参与主值计算。

## 7. Alert 投影

推荐把 Alert 定义为“从外部事实和工作流异常投影出的稳定对象”，而不是每次渲染临时拼接。

详细方案见 [06-alert-projection-impact.md](06-alert-projection-impact.md)。

最小必备字段：

```json
{
  "alertId": "project-alert:SO0101:gpu-inbound-delay",
  "conditionKey": "APS-PLANNING:PLN-SO0101-M03:gpu-inbound-delay",
  "severity": "P1",
  "lifecycle": "open",
  "firstSeenAt": "2026-11-03T14:30:00+08:00",
  "lastSeenAt": "2026-11-18T12:00:00+08:00",
  "sourceRevision": "PLAN-R3",
  "linkedTaskIds": ["TSK-1042", "TSK-1051"],
  "followTargetId": "project-alert:SO0101:gpu-inbound-delay"
}
```

## 8. 推荐的落地顺序

1. 先确认项目类型、项目模版、`business-chain` 和节点 `externalRefs` 契约。
2. 在供应链交付项目模版中配置对应的业务链路模板。
3. 以供应链交付场景包完成 Mock MCP 和 Read Model 验证。
4. 将业务链路模板能力扩展到软件研发、客户实施等其他项目类型。
5. 将 Alert 从临时推导升级为可关注、可指派、可关闭的稳定投影。
6. 最后替换项目概览中的派生 Alert ID，避免关注关系和历史记录丢失。

## 9. 订单决策案例

[AI Server 120 台订单决策场景](10-ai-server-order-decision-case.md) 复用现有五个业务
链路节点和 OMS、SRM、APS-PLANNING、MES、WMS、QMS 系统。成品检验与质量放行
合并到 Manufacturing 节点，模拟订单追加、GPU 降供、跨客户调拨、加价采购、
生产追回和空运之间的组合决策。

可直接按 GUI 上传的案例包见：
[AI Server 120 台订单决策导入包](../cases/ai-server-120-decision-import/README.md)。

