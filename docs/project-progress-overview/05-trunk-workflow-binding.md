# 项目业务链路与工作流绑定方案

> 页面交互入口：项目管理 → 项目设置 → 业务链路。  
> 详细交互见 [项目设置「业务链路」页签交互规格](08-project-settings-business-chain-tab.md)。
> 项目类型和项目模版治理见 [项目类型、项目模版与业务链路模板模型](09-project-type-template-business-chain.md)。

## 1. 结论

「项目业务链路」可以由工作流定义承载，但需要把“流程拓扑”和“业务事实”分开。
业务链路模板由项目类型约束、由项目模版引用，不在平台内维护唯一主干。

推荐结构：

```text
工作流定义：决定有哪些业务链路节点、顺序、依赖、审批和执行语义
业务链路实例：决定当前节点状态、负责人、任务和流程事件
四个 MCP：决定计划数量/日期、订单数量、库存、产能和实际产出
项目概览 Adapter：按外部引用合并数据并生成页面 Read Model
```

不建议只把所有数字直接写进工作流节点，因为：

- 工作流版本变化会制造业务事实副本。
- Plan、OMS、WMS、MES 各自有修订和新鲜度，无法由工作流统一定义。
- 数量、日期和库存会频繁变化，不应每次改动都发布新工作流版本。
- 审计时会无法区分“流程定义变更”和“业务计划变更”。

## 2. 工作流定义扩展

建议在工作流定义上增加 `businessChain` 语义。项目类型和项目模版决定可用业务链路；一个项目最多启用一个当前业务链路，可以存在多个历史版本。

```json
{
  "id": "wfdef-business-chain-ai-server-v3",
  "key": "business-chain-ai-server",
  "version": 3,
  "name": "AI Server 交付链路",
  "scope": "project",
  "businessChain": {
    "enabled": true,
    "chainKey": "ai-server-delivery",
    "displayName": "AI Server 交付链路",
    "stageCodePolicy": "stable",
    "planningSnapshotPolicy": "latest-confirmed",
    "allowUnboundExternalNodes": false
  },
  "graph": {
    "nodes": [
      {
        "id": "order-intake",
        "name": "订单接入",
        "type": "task",
        "businessChain": {
          "sequence": 1,
          "stageCode": "ORDER_INTAKE",
          "summaryMetric": "order-quantity",
          "externalRefs": [
            {
              "system": "OMS",
              "objectType": "sales-order-line",
              "objectId": "SO-2026-1018-01"
            },
            {
              "system": "APS-PLANNING",
              "objectType": "plan-node",
              "objectId": "PLN-SO0101-M01"
            }
          ]
        }
      },
      {
        "id": "supply-prep",
        "name": "供应备货",
        "type": "task",
        "businessChain": {
          "sequence": 3,
          "stageCode": "SUPPLY_PREP",
          "summaryMetric": "kit-readiness",
          "externalRefs": [
            {
              "system": "APS-PLANNING",
              "objectType": "plan-node",
              "objectId": "PLN-SO0101-M03"
            },
            {
              "system": "WMS",
              "objectType": "project-kit",
              "objectId": "INV-SO0101-KIT"
            }
          ]
        }
      },
      {
        "id": "assembly",
        "name": "生产总装",
        "type": "task",
        "businessChain": {
          "sequence": 4,
          "stageCode": "ASSEMBLY",
          "summaryMetric": "actual-output",
          "externalRefs": [
            {
              "system": "APS-PLANNING",
              "objectType": "plan-node",
              "objectId": "PLN-SO0101-M04"
            },
            {
              "system": "MES",
              "objectType": "resource",
              "objectId": "LINE-AI-02"
            }
          ]
        }
      }
    ],
    "edges": [
      {
        "id": "e-order-supply",
        "from": "order-intake",
        "to": "supply-prep"
      },
      {
        "id": "e-supply-assembly",
        "from": "supply-prep",
        "to": "assembly"
      }
    ]
  }
}
```

## 3. 节点事实绑定

每个节点的字段应通过显式绑定获得，不在前端猜测：

```json
{
  "nodeId": "supply-prep",
  "bindings": {
    "plannedOwner": {
      "source": "workflow",
      "path": "node.responsible"
    },
    "baselineQuantity": {
      "source": "APS-PLANNING",
      "objectId": "PLN-SO0101-M03",
      "path": "baseline.quantity"
    },
    "baselineFinishDate": {
      "source": "APS-PLANNING",
      "objectId": "PLN-SO0101-M03",
      "path": "baseline.finishDate"
    },
    "confirmedQuantity": {
      "source": "APS-PLANNING",
      "objectId": "PLN-SO0101-M03",
      "path": "confirmed.quantity"
    },
    "confirmedFinishDate": {
      "source": "APS-PLANNING",
      "objectId": "PLN-SO0101-M03",
      "path": "confirmed.finishDate"
    },
    "inventoryTimingGap": {
      "source": "WMS",
      "objectId": "GPU-MODULE-H",
      "path": "timingGap"
    },
    "actualCompletedQuantity": {
      "source": "MES",
      "objectId": "LINE-AI-02",
      "path": "completedQuantity"
    }
  }
}
```

## 4. Read Model 合并顺序

1. 读取项目快照中保存的 `business-chain` 工作流定义。
2. 读取该项目当前业务链路工作流实例。
3. 按 `businessChain.sequence` 排序节点；分支节点由工作流边决定。
4. 解析节点 `externalRefs`。
5. 从对应 MCP Snapshot 读取计划、订单、库存、产能事实。
6. 构建节点 View Model。
7. 根据事实异常生成 Alert 候选。
8. 将 Alert 候选 upsert 到项目 Alert 投影。
9. 渲染项目概览和“关键变更与外部影响”。

## 5. 冲突处理

| 场景 | 处理 |
| --- | --- |
| 工作流节点找不到计划节点 | 节点正常显示，计划字段显示“未绑定来源” |
| 计划节点找不到工作流节点 | 进入“未绑定计划项”证据区，不自动插入图 |
| 工作流节点名与计划节点名不同 | 工作流节点名用于页面；计划名进入来源详情 |
| 工作流状态 completed，但实际数量不足 | 状态保持工作流事实，同时生成“完成数量不一致”Alert |
| 订单数量 186，计划确认数量 200 | 分别展示订单事实和计划版本，并生成“计划未同步”Alert |
| 多个计划版本 | 只使用 `status=confirmed` 的最新 revision |
| 快照过期 | 显示最后值并标记 stale，Alert 严重度升级 |

## 6. 为什么不是“任意工作流都当业务链路”

一个项目可能有多个执行工作流，例如：

- 物料替代审批。
- 工程变更。
- 客诉处理。
- 现场验收。

如果页面自动取第一个工作流，用户会看到错误的业务链路。

因此需要：

- 显式 `kind=business-chain`。
- 业务链路必须属于项目模版允许范围。
- 每个项目最多一个当前业务链路。
- 有绑定关系 `project.businessChainBinding`。
- 页面和工作流模块共享同一个稳定 ID。

## 7. 最小迁移方案

如果不希望第一阶段改工作流存储，可以先做只读适配：

1. 在项目记录中增加 `businessChainBinding`，保存定义、版本和实例快照。
2. 在场景 MCP 返回 `workflowNodeId`，临时按节点 ID 连接。
3. 页面只展示 Planning 的计划字段，不写回工作流。
4. 后续再补工作流定义的 `businessChain` 和 `externalRefs`。

该过渡方案不伪造事实，但外部引用只能依赖节点 ID，抗改名能力较弱。

