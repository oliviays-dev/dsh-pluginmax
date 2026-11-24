# AI Server 质量放行 Mock MCP

> 资源类型：MCP  
> 资源 ID：`mcp-mock-qms-ai-server-120`  
> 所属 Function：quality  
> 当前版本：1.0.0  
> 更新时间：2026-11-19  
> Mock 身份：`mcp://mock-qms-ai-server-120`

## 1. 资源描述

| 项目 | 内容 |
|---|---|
| 主要目标业务对象与操作类型 | 成品检验、质量 Hold 和放行能力；只读评估 |
| 预期产出 | 判断 96/106/116/120 台是否存在质量放行瓶颈 |
| 限制与不适用边界 | 不放行不合格品、不批准让步接收、不修改检验记录 |

## 2. 适用与不适用

| 类别 | 说明 |
|---|---|
| 适用用户 | Quality、Manufacturing、Logistics、Order Fulfillment |
| 适用场景 | 14 天交付情景中的成品检验与放行门禁 |
| 不适用场景 | 供应商来料检验、质量事故处理和让步审批 |

## 3. 使用前准备

| 项目 | 要求 |
|---|---|
| 账号与角色 | QMS 只读权限 |
| 数据准备 | 项目号、产线和目标发运批次 |
| 依赖资源 | MES、WMS |
| 配置项 | 检验资源 `BENCH-TEST-03` |

## 4. 使用方式举例

```json
{
  "tool": "qms.getInspectionCapacity",
  "arguments": {
    "projectCode": "SO-AIS-120",
    "scenarioQuantity": 106
  }
}
```

## 5. 输入与输出

主要输出：

- WIP 5 台当前无质量 Hold；
- 日检验能力 `14` 台；
- 96/106 台可在截止日前完成放行；
- 116/120 台需要额外班次和质量资源协调；
- 质量工具不批准任何不合格品放行。

## 6. 权限与数据边界

| 项目 | 说明 |
|---|---|
| 读操作 | 检验队列、检验能力、Hold 和放行状态 |
| 写操作 | 无 |
| 数据范围 | 当前项目和测试资源 |
| 敏感数据 | 不合格记录和返工信息 |
| 审计要求 | 记录检验计划、数量、资源版本和质量结论 |

## 7. 调用工具清单

| Tool | 读写属性 | 用途 |
|---|---|---|
| `qms.getInspectionCapacity` | 只读 | 查询检验资源和每日能力 |
| `qms.getWipQualityStatus` | 只读 | 查询 5 台 WIP 质量状态 |
| `qms.getScenarioReleasePlan` | 只读 | 返回各数量情景的放行计划 |

## 8. 限制与错误处理

| 限制或错误 | 处理方式 |
|---|---|
| 检验能力不足 | 返回 `CAPACITY_SHORTAGE`，不得绕过检验 |
| 发现质量 Hold | 返回 `QUALITY_HOLD`，停止发运承诺 |
| 要求质量让步 | 必须升级人工质量审批 |

## Mock Source Document

```json mock-mcp-snapshot
{
  "schemaVersion": "qms-ai-server-120-mock-v1",
  "documentId": "mock-qms-ai-server-120-r1",
  "sourceSystem": "QMS",
  "sourceRevision": "QMS-AIS120-R1",
  "projectCode": "SO-AIS-120",
  "observedAt": "2026-11-19T09:00:00+08:00",
  "isMock": true,
  "readOnly": true,
  "tools": [
    "qms.getInspectionCapacity",
    "qms.getWipQualityStatus",
    "qms.getScenarioReleasePlan"
  ],
  "data": {
    "qualityResourceId": "BENCH-TEST-03",
    "qualityStatus": "pending_release",
    "qualifiedQuantity": 0,
    "unqualifiedQuantity": 0,
    "inspectionCapacityPerDay": 14,
    "inspectionStartAt": "2026-11-22T08:00:00+08:00",
    "lastInspectionAt": "2026-12-02T18:00:00+08:00",
    "wipQualityStatus": {
      "wipQuantity": 5,
      "qualityHold": false,
      "reworkRequired": false,
      "priorityInspectionRequired": true
    },
    "scenarioReleasePlan": {
      "96": {
        "releaseFeasible": true,
        "status": "confirmed",
        "requiredInspectionDays": 7,
        "condition": "按计划优先放行"
      },
      "106": {
        "releaseFeasible": true,
        "status": "confirmed_with_priority",
        "requiredInspectionDays": 8,
        "condition": "质量资源优先本订单"
      },
      "116": {
        "releaseFeasible": true,
        "status": "conditional",
        "requiredInspectionDays": 9,
        "condition": "增加质量班次并压缩非关键检测排队"
      },
      "120": {
        "releaseFeasible": true,
        "status": "conditional",
        "requiredInspectionDays": 9,
        "condition": "需要 MES 产出和额外质量班次同时成立"
      }
    },
    "costBoundary": {
      "separateQualityExpediteCost": 0,
      "assumption": "质量加班已包含在制造加班方案中，未单独计费",
      "humanApprovalRequiredForConcession": true
    },
    "qualityJudgment": "96 和 106 台不影响最低交付决策。116 和 120 台需要额外质量资源，当前不作为默认承诺。"
  },
  "sourceHealth": {
    "status": "healthy",
    "lastSuccessfulSyncAt": "2026-11-19T08:40:00+08:00"
  }
}
```
