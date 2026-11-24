# 产能与制造执行 Mock MCP

> MCP 身份：`mcp://mock-capacity-mes`  
> 系统类型：APS 产能 / MES 制造执行  
> 唯一数据源：[Mock Source Document](#mock-source-document)  
> 数据口径：产能、负荷、实际产出、WIP、设备异常、节点实绩。  
> 禁止读取：客户订单有效数量、计划基线、库存余额。

## 1. MCP 工具

| 工具 | 输入 | 输出 |
| --- | --- | --- |
| `capacity.getResourceSnapshot` | `resourceId` / `projectCode` | 产能、负荷、WIP、瓶颈 |
| `capacity.getActualOutput` | `projectCode`, `since` | 按节点和日期的实际完成数量 |
| `capacity.getNodeExecution` | `projectCode`, `stageCode` | 节点实际开始/完成、在制数量 |
| `capacity.getConstraints` | `resourceId` | 设备异常、停机、测试能力变化 |

## 2. 字段责任

| 字段 | 说明 |
| --- | --- |
| `dailyCapacity` | 资源每日可用产能 |
| `plannedLoad` | 当前排队和计划负荷 |
| `actualCompletedQuantity` | 实际完成数量 |
| `wipQuantity` | 在制数量 |
| `constraintEvents` | 设备故障、停机、能力下降 |
| `actualStartAt` / `actualCompletedAt` | MES 实绩时间 |

## 3. 实际完成字段口径

- 总装实际完成数量来自 `LINE-AI-02` 的 MES 报工。
- 联调实际完成数量来自 `BENCH-TEST-03` 的测试记录。
- 发运数量不由产能系统提供，应来自 OMS/WMS。
- 现场验收数量不由产能系统提供，应来自现场验收记录。

## Mock Source Document

> Mock MCP 只解析此代码块。产能系统只说明“实际做了多少”，不解释客户为什么改单。

```json mock-mcp-snapshot
{
  "schemaVersion": "capacity-snapshot-v1",
  "documentId": "mock-capacity-so0101-20261118-r5",
  "sourceSystem": "MES",
  "projectCode": "SO0101",
  "plant": "苏州智能制造基地",
  "observedAt": "2026-11-18T12:00:00+08:00",
  "capacityRevision": "CAP-R5",
  "resources": [
    {
      "resourceId": "LINE-AI-02",
      "resourceName": "AI Server 总装线 2",
      "resourceType": "assembly_line",
      "dailyCapacity": 18,
      "unit": "台/日",
      "plannedLoadQuantity": 186,
      "completedQuantity": 112,
      "wipQuantity": 40,
      "remainingQuantity": 34,
      "utilization": 0.94,
      "status": "running",
      "actualStartAt": "2026-11-16T08:00:00+08:00",
      "estimatedFinishAt": "2026-11-30T18:00:00+08:00"
    },
    {
      "resourceId": "BENCH-TEST-03",
      "resourceName": "液冷联调测试台 3",
      "resourceType": "test_bench",
      "dailyCapacity": 9,
      "unit": "台/日",
      "plannedLoadQuantity": 186,
      "completedQuantity": 76,
      "wipQuantity": 12,
      "queueQuantity": 64,
      "utilization": 1.08,
      "status": "bottleneck",
      "actualStartAt": "2026-11-17T09:00:00+08:00",
      "estimatedFinishAt": "2026-12-04T20:00:00+08:00"
    }
  ],
  "nodeExecution": [
    {
      "stageCode": "ASSEMBLY",
      "workflowNodeId": "assembly",
      "status": "running",
      "plannedQuantity": 186,
      "actualCompletedQuantity": 112,
      "actualStartAt": "2026-11-16T08:00:00+08:00",
      "actualCompletedAt": null,
      "unit": "台"
    },
    {
      "stageCode": "INTEGRATION_TEST",
      "workflowNodeId": "integration-test",
      "status": "running",
      "plannedQuantity": 186,
      "actualCompletedQuantity": 76,
      "actualStartAt": "2026-11-17T09:00:00+08:00",
      "actualCompletedAt": null,
      "unit": "台"
    }
  ],
  "constraintEvents": [
    {
      "constraintId": "CAP-EVT-20261116-01",
      "resourceId": "BENCH-TEST-03",
      "occurredAt": "2026-11-16T22:10:00+08:00",
      "kind": "capacity_reduction",
      "beforeCapacity": 12,
      "afterCapacity": 9,
      "reason": "一台液冷循环泵故障，测试台由 12 台/日降至 9 台/日",
      "expectedRecoveryAt": "2026-11-20T08:00:00+08:00",
      "status": "open"
    },
    {
      "constraintId": "CAP-EVT-20261118-02",
      "resourceId": "LINE-AI-02",
      "occurredAt": "2026-11-18T09:25:00+08:00",
      "kind": "material_wait",
      "reason": "GPU 模块待齐套，2 个装配工位等待物料",
      "expectedRecoveryAt": "2026-11-19T08:00:00+08:00",
      "status": "open"
    }
  ],
  "outputHistory": [
    {
      "date": "2026-11-16",
      "assemblyCompleted": 42,
      "integrationCompleted": 28
    },
    {
      "date": "2026-11-17",
      "assemblyCompleted": 40,
      "integrationCompleted": 26
    },
    {
      "date": "2026-11-18",
      "assemblyCompleted": 30,
      "integrationCompleted": 22,
      "partialDay": true
    }
  ],
  "sourceHealth": {
    "status": "healthy",
    "lastSuccessfulSyncAt": "2026-11-18T12:00:00+08:00",
    "slaMinutes": 15
  }
}
```

