# 计划系统 Mock MCP

> MCP 身份：`mcp://mock-aps-planning`  
> 系统类型：APS / MRP 计划系统  
> 唯一数据源：[Mock Source Document](#mock-source-document)  
> 数据口径：供应链交付业务链路计划、基线、已确认变更、工作包和依赖。  
> 禁止读取：订单系统的客户取消、库存余额、产能实际产出。

## 1. MCP 工具

| 工具 | 输入 | 输出 |
| --- | --- | --- |
| `planning.getBusinessChainPlan` | `projectCode` | 业务链路计划节点、顺序、依赖、外部引用 |
| `planning.getPlanBaseline` | `projectCode`, `businessChainKey` | 原计划数量、原计划日期 |
| `planning.getPlanRevision` | `projectCode`, `businessChainKey` | 最新确认计划数量、日期、版本 |
| `planning.getPlanChanges` | `projectCode`, `since` | 已确认计划变更事件 |
| `planning.getWorkPackages` | `projectCode`, `planNodeId` | 工作包、交付批次、计划数量 |

## 2. 返回包络

```json
{
  "ok": true,
  "source": {
    "system": "APS-PLANNING",
    "document": "01-planning-system-mcp.md",
    "documentId": "mock-planning-so0101-20261118-r3",
    "revision": "PLAN-R3",
    "observedAt": "2026-11-18T12:00:00+08:00",
    "isMock": true
  },
  "data": {}
}
```

## 3. 字段责任

| 字段 | 说明 |
| --- | --- |
| `planNodeId` | 计划系统稳定节点 ID，供工作流节点绑定 |
| `sequence` | 计划建议顺序；最终拓扑以项目选定业务链路的工作流定义为准 |
| `baseline.quantity` | 原计划数量 |
| `baseline.finishDate` | 原计划完成日期 |
| `confirmed.quantity` | 最新已确认计划数量 |
| `confirmed.finishDate` | 最新已确认计划完成日期 |
| `dependencyIds` | 计划依赖，用于识别依赖阻塞 |
| `changeHistory` | 计划数量、日期变化和原因 |
| `workPackages` | 计划工作包和批次 |

## 4. 明确不提供的字段

- 不提供订单当前有效数量；该字段来自 OMS。
- 不提供实际完成数量；该字段来自 Capacity/MES。
- 不提供库存可用量；该字段来自 Inventory。
- 不提供 Alert 关注和指派状态。

## Mock Source Document

> Mock MCP 只解析此代码块。`confirmed` 表示已确认计划，不是订单事实，也不是生产实绩。

```json mock-mcp-snapshot
{
  "schemaVersion": "planning-snapshot-v1",
  "documentId": "mock-planning-so0101-20261118-r3",
  "sourceSystem": "APS-PLANNING",
  "projectCode": "SO0101",
  "projectName": "战略客户 X 的 AI Server 交付",
  "customerName": "华东智算中心",
  "productModel": "X-800 8U AI Server",
  "plant": "苏州智能制造基地",
  "timezone": "Asia/Shanghai",
  "observedAt": "2026-11-18T12:00:00+08:00",
  "effectiveAt": "2026-11-17T18:00:00+08:00",
  "planRevision": "PLAN-R3",
  "businessChainKey": "so0101-supply-delivery",
  "businessChainPlan": [
    {
      "planNodeId": "PLN-SO0101-M01",
      "sequence": 1,
      "stageCode": "ORDER_INTAKE",
      "name": "订单接入",
      "baseline": {
        "quantity": 180,
        "unit": "台",
        "finishDate": "2026-10-31"
      },
      "confirmed": {
        "quantity": 186,
        "unit": "台",
        "finishDate": "2026-11-12"
      },
      "status": "closed",
      "dependencyIds": [],
      "externalRefs": {
        "workflowNodeId": "order-intake",
        "omsSalesOrderId": "SO-2026-1018"
      }
    },
    {
      "planNodeId": "PLN-SO0101-M02",
      "sequence": 2,
      "stageCode": "SUPPLY_REVIEW",
      "name": "供需评审",
      "baseline": {
        "quantity": 180,
        "unit": "台",
        "finishDate": "2026-11-03"
      },
      "confirmed": {
        "quantity": 186,
        "unit": "台",
        "finishDate": "2026-11-15"
      },
      "status": "closed",
      "dependencyIds": ["PLN-SO0101-M01"],
      "externalRefs": {
        "workflowNodeId": "supply-review"
      }
    },
    {
      "planNodeId": "PLN-SO0101-M03",
      "sequence": 3,
      "stageCode": "SUPPLY_PREP",
      "name": "供应备货",
      "baseline": {
        "quantity": 200,
        "unit": "台",
        "finishDate": "2026-11-25"
      },
      "confirmed": {
        "quantity": 186,
        "unit": "台",
        "finishDate": "2026-11-30"
      },
      "status": "in_progress",
      "dependencyIds": ["PLN-SO0101-M02"],
      "externalRefs": {
        "workflowNodeId": "supply-prep",
        "inventoryObjectId": "INV-SO0101-KIT"
      }
    },
    {
      "planNodeId": "PLN-SO0101-M04",
      "sequence": 4,
      "stageCode": "ASSEMBLY",
      "name": "生产总装",
      "baseline": {
        "quantity": 200,
        "unit": "台",
        "finishDate": "2026-11-28"
      },
      "confirmed": {
        "quantity": 186,
        "unit": "台",
        "finishDate": "2026-12-02"
      },
      "status": "ready",
      "dependencyIds": ["PLN-SO0101-M03"],
      "externalRefs": {
        "workflowNodeId": "assembly",
        "capacityResourceId": "LINE-AI-02"
      }
    },
    {
      "planNodeId": "PLN-SO0101-M05",
      "sequence": 5,
      "stageCode": "INTEGRATION_TEST",
      "name": "联调验证",
      "baseline": {
        "quantity": 200,
        "unit": "台",
        "finishDate": "2026-11-30"
      },
      "confirmed": {
        "quantity": 186,
        "unit": "台",
        "finishDate": "2026-12-04"
      },
      "status": "waiting",
      "dependencyIds": ["PLN-SO0101-M04"],
      "externalRefs": {
        "workflowNodeId": "integration-test",
        "capacityResourceId": "BENCH-TEST-03"
      }
    },
    {
      "planNodeId": "PLN-SO0101-M06",
      "sequence": 6,
      "stageCode": "PACK_AND_SHIP",
      "name": "包装发运",
      "baseline": {
        "quantity": 180,
        "unit": "台",
        "finishDate": "2026-12-02"
      },
      "confirmed": {
        "quantity": 186,
        "unit": "台",
        "finishDate": "2026-12-06"
      },
      "status": "waiting",
      "dependencyIds": ["PLN-SO0101-M05"],
      "externalRefs": {
        "workflowNodeId": "pack-ship",
        "warehouseId": "WH-EAST-01"
      }
    },
    {
      "planNodeId": "PLN-SO0101-M07",
      "sequence": 7,
      "stageCode": "SITE_ACCEPTANCE",
      "name": "现场验收",
      "baseline": {
        "quantity": 180,
        "unit": "台",
        "finishDate": "2026-12-08"
      },
      "confirmed": {
        "quantity": 186,
        "unit": "台",
        "finishDate": "2026-12-11"
      },
      "status": "waiting",
      "dependencyIds": ["PLN-SO0101-M06"],
      "externalRefs": {
        "workflowNodeId": "site-acceptance"
      }
    }
  ],
  "planChanges": [
    {
      "changeId": "PLC-20261028-01",
      "planNodeId": "PLN-SO0101-M01",
      "changedAt": "2026-10-28T09:00:00+08:00",
      "changeType": "order-quantity",
      "reason": "客户追加 20 台 AI Server",
      "before": {
        "quantity": 180,
        "unit": "台",
        "finishDate": "2026-10-31"
      },
      "after": {
        "quantity": 200,
        "unit": "台",
        "finishDate": "2026-11-05"
      },
      "changedBy": "订单履约·张三",
      "status": "confirmed"
    },
    {
      "changeId": "PLC-20261103-02",
      "planNodeId": "PLN-SO0101-M03",
      "changedAt": "2026-11-03T14:30:00+08:00",
      "changeType": "supply-delay",
      "reason": "GPU 到货批次延后，供应备货计划顺延",
      "before": {
        "quantity": 200,
        "unit": "台",
        "finishDate": "2026-11-25"
      },
      "after": {
        "quantity": 200,
        "unit": "台",
        "finishDate": "2026-11-30"
      },
      "changedBy": "供应链计划·许澄",
      "status": "confirmed"
    },
    {
      "changeId": "PLC-20261112-03",
      "planNodeId": "PLN-SO0101-M03",
      "changedAt": "2026-11-12T16:40:00+08:00",
      "changeType": "order-reduction",
      "reason": "客户取消 14 台，计划数量由 200 台调整为 186 台",
      "before": {
        "quantity": 200,
        "unit": "台",
        "finishDate": "2026-11-30"
      },
      "after": {
        "quantity": 186,
        "unit": "台",
        "finishDate": "2026-11-30"
      },
      "changedBy": "供应链计划·许澄",
      "status": "confirmed"
    },
    {
      "changeId": "PLC-20261112-04",
      "planNodeId": "PLN-SO0101-M01",
      "changedAt": "2026-11-12T16:40:00+08:00",
      "changeType": "order-reduction",
      "reason": "客户取消 14 台，订单接入计划同步为 186 台",
      "before": {
        "quantity": 200,
        "unit": "台",
        "finishDate": "2026-11-12"
      },
      "after": {
        "quantity": 186,
        "unit": "台",
        "finishDate": "2026-11-12"
      },
      "changedBy": "供应链计划·许澄",
      "status": "confirmed"
    }
  ],
  "workPackages": [
    {
      "workPackageId": "WP-SO0101-ASSY-01",
      "planNodeId": "PLN-SO0101-M04",
      "name": "首批总装",
      "plannedQuantity": 96,
      "unit": "台",
      "plannedStart": "2026-11-16",
      "plannedFinish": "2026-11-22",
      "workCenter": "LINE-AI-02"
    },
    {
      "workPackageId": "WP-SO0101-ASSY-02",
      "planNodeId": "PLN-SO0101-M04",
      "name": "尾批总装",
      "plannedQuantity": 90,
      "unit": "台",
      "plannedStart": "2026-11-23",
      "plannedFinish": "2026-12-02",
      "workCenter": "LINE-AI-02"
    }
  ],
  "sourceHealth": {
    "status": "healthy",
    "lastSuccessfulSyncAt": "2026-11-18T12:00:00+08:00",
    "slaMinutes": 60
  }
}
```

