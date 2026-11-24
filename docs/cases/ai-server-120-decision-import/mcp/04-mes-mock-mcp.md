# AI Server 制造执行 Mock MCP

> 资源类型：MCP  
> 资源 ID：`mcp-mock-mes-ai-server-120`  
> 所属 Function：manufacturing  
> 当前版本：1.0.0  
> 更新时间：2026-11-19  
> Mock 身份：`mcp://mock-mes-ai-server-120`

## 1. 资源描述

| 项目 | 内容 |
|---|---|
| 主要目标业务对象与操作类型 | 工单、在制、产能追回和生产效率；只读模拟 |
| 预期产出 | 返回 5 台 WIP 追回、96/106 台产能可行性和 8% 效率损失 |
| 限制与不适用边界 | 不修改工单、不批准加班、不进行质量放行 |

## 2. 适用与不适用

| 类别 | 说明 |
|---|---|
| 适用用户 | Manufacturing、Planning、Order Fulfillment |
| 适用场景 | 生产追回、产能上限和效率损失评估 |
| 不适用场景 | 真实报工、设备控制、物料采购、质量判定 |

## 3. 使用前准备

| 项目 | 要求 |
|---|---|
| 账号与角色 | MES 只读权限 |
| 数据准备 | 项目号或产线号 |
| 依赖资源 | APS-PLANNING、QMS |
| 配置项 | 产线 `LINE-AI-02` |

## 4. 使用方式举例

```json
{
  "tool": "mes.simulateCapacityRecovery",
  "arguments": {
    "projectCode": "SO-AIS-120",
    "resourceId": "LINE-AI-02",
    "targetQuantity": 106
  }
}
```

## 5. 输入与输出

主要输出：

- WIP `5` 台，可追回 `5` 台；
- 调整计划可提前 `4` 天完成 WIP；
- 产线效率损失 `8%`；
- 加速产能基准成本 `2,000 万元`；
- 生产损失 `160 万元`；
- `106` 台为加班条件下可行；
- `116/120` 台仍需额外班次或其他订单让位。

## 6. 权限与数据边界

| 项目 | 说明 |
|---|---|
| 读操作 | 工单、在制、节拍、产能和模拟结果 |
| 写操作 | 无 |
| 数据范围 | 当前项目和产线 |
| 敏感数据 | 成本、产能和其他订单影响 |
| 审计要求 | 记录资源、目标数量、模拟版本和假设 |

## 7. 调用工具清单

| Tool | 读写属性 | 用途 |
|---|---|---|
| `mes.getWorkOrderSnapshot` | 只读 | 查询 WIP 和工单状态 |
| `mes.simulateCapacityRecovery` | 只读 | 模拟追回和产量 |
| `mes.getEfficiencyImpact` | 只读 | 查询生产损失 |
| `mes.getCapacityByScenario` | 只读 | 查询 96/106/116/120 台可行性 |

## 8. 限制与错误处理

| 限制或错误 | 处理方式 |
|---|---|
| 目标数量超过可行产能 | 返回 `CAPACITY_EXCEEDED` |
| WIP GPU 状态未确认 | 标记 `material_unconfirmed` |
| 加速影响其他订单 | 必须返回外部影响，不得只报本订单产出 |

## Mock Source Document

```json mock-mcp-snapshot
{
  "schemaVersion": "mes-ai-server-120-mock-v1",
  "documentId": "mock-mes-ai-server-120-r1",
  "sourceSystem": "MES",
  "sourceRevision": "MES-AIS120-R1",
  "projectCode": "SO-AIS-120",
  "observedAt": "2026-11-19T09:00:00+08:00",
  "isMock": true,
  "readOnly": true,
  "tools": [
    "mes.getWorkOrderSnapshot",
    "mes.simulateCapacityRecovery",
    "mes.getEfficiencyImpact",
    "mes.getCapacityByScenario"
  ],
  "data": {
    "plant": "苏州智能制造基地",
    "resourceId": "LINE-AI-02",
    "resourceName": "AI Server 总装线 2",
    "workOrderId": "WO-AIS-120-01",
    "kitReadyQuantity": 91,
    "completedQuantity": 0,
    "pendingInspectionQuantity": 5,
    "wipSnapshot": {
      "wipQuantity": 5,
      "gpuAllocated": true,
      "canMeet14DaysWithoutAction": false,
      "recoverableQuantity": 5,
      "accelerationDays": 4,
      "targetRecoveredFinishAt": "2026-11-29T18:00:00+08:00"
    },
    "efficiencyImpact": {
      "mode": "incremental_cost",
      "efficiencyLossRate": 0.08,
      "affectedProductionBaseCost": 20,
      "efficiencyLossAmount": 1.6,
      "currencyUnit": "CNY_million",
      "calculation": "20 × 8% = 1.6",
      "costOwner": "Manufacturing",
      "isAssumption": true
    },
    "capacityByScenario": {
      "96": {
        "feasible": true,
        "status": "confirmed",
        "basis": "追回 5 台 WIP"
      },
      "106": {
        "feasible": true,
        "status": "confirmed_with_overtime",
        "basis": "追回 5 台 WIP，并为本项目安排加班产能",
        "condition": "不突破安全、质量和设备维护红线"
      },
      "116": {
        "feasible": true,
        "status": "conditional",
        "basis": "需要额外班次，并可能影响其他订单",
        "condition": "需确认其他订单让位和新增产能成本"
      },
      "120": {
        "feasible": false,
        "status": "unconfirmed",
        "basis": "当前只证明追回 5 台，不足以证明 120 台",
        "condition": "需要新的产能方案和完整审批"
      }
    },
    "relationshipAndGovernance": {
      "otherOrderImpactFor106": "none_if_overtime_confirmed",
      "otherOrderImpactFor116": "possible",
      "otherOrderImpactFor120": "not_assessed",
      "approvalRequired": [
        "加班和产能调整",
        "影响其他订单的插单"
      ]
    },
    "manufacturingJudgment": "方案 A 和 B 的生产条件可实现，其中 B 依赖加班承诺。方案 C 需要影响其他订单，方案 D 在 120 台产能上不成立。"
  },
  "sourceHealth": {
    "status": "healthy",
    "lastSuccessfulSyncAt": "2026-11-19T08:50:00+08:00"
  }
}
```
