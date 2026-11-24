# AI Server 计划 Mock MCP

> 资源类型：MCP  
> 资源 ID：`mcp-mock-aps-planning-ai-server-120`  
> 所属 Function：planning  
> 当前版本：1.0.0  
> 更新时间：2026-11-19  
> Mock 身份：`mcp://mock-aps-planning-ai-server-120`

## 1. 资源描述

| 项目 | 内容 |
|---|---|
| 主要目标业务对象与操作类型 | 供需平衡、交付情景和承诺方案；只读模拟 |
| 预期产出 | 形成 A/B/C/D 四个方案的按时数量、总成本和风险边界 |
| 限制与不适用边界 | 不修改订单、采购、生产或运输；不替代供应链负责人决策 |

## 2. 适用与不适用

| 类别 | 说明 |
|---|---|
| 适用用户 | Planning、Order Fulfillment、供应链负责人 |
| 适用场景 | 多方案供需平衡和会议决策材料准备 |
| 不适用场景 | 采购执行、生产报工、质量放行、订舱 |

## 3. 使用前准备

| 项目 | 要求 |
|---|---|
| 账号与角色 | 计划和项目只读权限 |
| 数据准备 | 订单号、项目号 |
| 依赖资源 | OMS、SRM、MES、WMS、QMS Mock MCP |
| 配置项 | 业务链路 `ai-server-delivery` |

## 4. 使用方式举例

```json
{
  "tool": "planning.simulateFulfillmentOptions",
  "arguments": {
    "projectCode": "SO-AIS-120",
    "requiredOnTimeQuantity": 96
  }
}
```

## 5. 输入与输出

输出包括：

- 需求、可用供应、在制和 E2E 约束；
- 方案 A/B/C/D 的按时数量与综合成本；
- 风险概率阈值；
- 关系影响提醒；
- 有条件承诺，不作为最终审批。

## 6. 权限与数据边界

| 项目 | 说明 |
|---|---|
| 读操作 | 计划、供需和方案模拟 |
| 写操作 | 无 |
| 数据范围 | 当前演示项目 |
| 敏感数据 | 成本、风险和客户影响 |
| 审计要求 | 记录方案版本、输入快照和计算口径 |

## 7. 调用工具清单

| Tool | 读写属性 | 用途 |
|---|---|---|
| `planning.getDemandSupplySnapshot` | 只读 | 查询需求、供应和在制约束 |
| `planning.simulateFulfillmentOptions` | 只读 | 生成四个组合方案 |
| `planning.getCommitmentPlan` | 只读 | 返回有条件交付承诺 |

## 8. 限制与错误处理

| 限制或错误 | 处理方式 |
|---|---|
| 来源系统版本不一致 | 返回 `SOURCE_REVISION_MISMATCH` |
| 方案依赖未确认产能 | 标记 `conditional` |
| 客户关系影响未量化 | 保留定性说明，不折算为零 |

## Mock Source Document

```json mock-mcp-snapshot
{
  "schemaVersion": "aps-planning-ai-server-120-mock-v1",
  "documentId": "mock-aps-planning-ai-server-120-r1",
  "sourceSystem": "APS-PLANNING",
  "sourceRevision": "PLAN-AIS120-R1",
  "projectCode": "SO-AIS-120",
  "observedAt": "2026-11-19T09:00:00+08:00",
  "isMock": true,
  "readOnly": true,
  "tools": [
    "planning.getDemandSupplySnapshot",
    "planning.simulateFulfillmentOptions",
    "planning.getCommitmentPlan"
  ],
  "data": {
    "businessChainKey": "ai-server-delivery",
    "demand": {
      "originalQuantity": 100,
      "currentQuantity": 120,
      "minimumOnTimeQuantity": 96,
      "deadlineAt": "2026-12-03T23:59:59+08:00",
      "remainingQuantity": 24
    },
    "quantityBridge": {
      "effectiveGpuQuantity": 91,
      "recoverableWipQuantity": 5,
      "baseOnTimeQuantity": 96,
      "premiumSupplyQuantity": 10,
      "premiumOnTimeQuantity": 106,
      "crossCustomerTransferQuantity": 20,
      "transferOnTimeQuantity": 116,
      "allLeversTheoreticalQuantity": 120
    },
    "timeConstraints": {
      "normalE2eDays": 21,
      "airE2eDays": 14,
      "airNominalBufferDays": 0,
      "wipAccelerationDays": 4,
      "airFreightRequiredFor14Days": true
    },
    "costAssumptions": {
      "airFreightCost": 2,
      "productionBaseCost": 20,
      "productionEfficiencyLossRate": 0.08,
      "productionEfficiencyLossAmount": 1.6,
      "externalCustomerDelayCost": 4,
      "currencyUnit": "CNY_million"
    },
    "options": [
      {
        "optionId": "A",
        "name": "空运 + 生产追回",
        "onTimeQuantity": 96,
        "remainingDelayedQuantity": 24,
        "estimatedTotalCost": 3.6,
        "meetsMinimum": true,
        "relationshipRisk": "low",
        "feasibility": "conditional"
      },
      {
        "optionId": "B",
        "name": "空运 + 生产追回 + 加价采购 10 个 GPU",
        "onTimeQuantity": 106,
        "remainingDelayedQuantity": 14,
        "estimatedTotalCost": 8.6,
        "meetsMinimum": true,
        "relationshipRisk": "medium_low",
        "feasibility": "conditional"
      },
      {
        "optionId": "C",
        "name": "空运 + 生产追回 + 跨客户调拨 20 个 GPU",
        "onTimeQuantity": 116,
        "remainingDelayedQuantity": 4,
        "estimatedTotalCost": 7.6,
        "meetsMinimum": true,
        "relationshipRisk": "high",
        "feasibility": "conditional"
      },
      {
        "optionId": "D",
        "name": "空运 + 生产追回 + 加价采购 + 跨客户调拨",
        "onTimeQuantity": 120,
        "remainingDelayedQuantity": 0,
        "estimatedTotalCost": 12.6,
        "meetsMinimum": true,
        "relationshipRisk": "high",
        "feasibility": "unconfirmed"
      }
    ],
    "riskThresholds": {
      "A": 0.24,
      "B": 0.5733,
      "C": 0.5067,
      "D": 0.84
    },
    "planningJudgment": "账面成本最低且满足 96 台的方案是 A；账面综合成本优于 B 的是 C。最终建议必须同时评估供应商增供可靠性和受影响客户关系。",
    "commitment": {
      "recommendedDefaultOptionId": "B",
      "fallbackOptionId": "A",
      "conditionalExternalOptionId": "C",
      "commitQuantity": 96,
      "commitDeadlineAt": "2026-12-03T23:59:59+08:00",
      "status": "pending_human_approval"
    }
  },
  "sourceHealth": {
    "status": "healthy",
    "lastSuccessfulSyncAt": "2026-11-19T09:00:00+08:00"
  }
}
```
