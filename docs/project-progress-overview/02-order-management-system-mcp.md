# 订单系统 Mock MCP

> MCP 身份：`mcp://mock-oms`  
> 系统类型：订单管理与履约系统  
> 唯一数据源：[Mock Source Document](#mock-source-document)  
> 数据口径：客户订单、订单行、数量变更、交期要求、发货和同步健康。  
> 禁止读取：生产实际完成、库存可用量、计划工作包。

## 1. MCP 工具

| 工具 | 输入 | 输出 |
| --- | --- | --- |
| `oms.getOrderSnapshot` | `projectCode` 或 `salesOrderId` | 当前有效订单行和交期要求 |
| `oms.getOrderRevisions` | `salesOrderId`, `since` | 订单数量/日期变更历史 |
| `oms.getDeliveryStatus` | `salesOrderId` | 已发货数量、签收数量、发货计划 |
| `oms.getSyncHealth` | `salesOrderId` | OMS 与外部仓配/库存接口同步状态 |

## 2. 字段责任

| 字段 | 说明 |
| --- | --- |
| `salesOrderId` / `lineId` | 订单与订单行稳定 ID |
| `currentQuantity` | 客户当前有效订单数量 |
| `requestedDeliveryDate` | 客户要求交期 |
| `confirmedDeliveryDate` | 销售已确认交期 |
| `revisionHistory` | 增单、减单、取消、交期变更 |
| `shippedQuantity` / `deliveredQuantity` | 发货与签收实绩 |
| `syncHealth` | 订单系统外部接口健康度 |

## 3. 明确不提供的字段

- 不提供原计划完工日期；该字段来自 Planning。
- 不提供车间实际产量；该字段来自 Capacity/MES。
- 不提供 GPU、CPU、内存库存；该字段来自 Inventory。

## Mock Source Document

> Mock MCP 只解析此代码块。`currentQuantity=186` 是客户有效订单事实，不应由计划系统的 186 台反向覆盖。

```json mock-mcp-snapshot
{
  "schemaVersion": "oms-snapshot-v1",
  "documentId": "mock-oms-so20261018-20261118-r2",
  "sourceSystem": "OMS",
  "projectCode": "SO0101",
  "salesOrderId": "SO-2026-1018",
  "customer": {
    "customerId": "CUS-EAST-001",
    "name": "华东智算中心",
    "accountOwner": "订单履约·张三"
  },
  "observedAt": "2026-11-18T12:00:00+08:00",
  "effectiveAt": "2026-11-15T10:20:00+08:00",
  "orderRevision": "ORD-R2",
  "orderStatus": "in_fulfillment",
  "lines": [
    {
      "lineId": "SO-2026-1018-01",
      "productCode": "X800-8U",
      "productName": "X-800 8U AI Server",
      "initialQuantity": 180,
      "currentQuantity": 186,
      "unit": "台",
      "requestedDeliveryDate": "2026-11-30",
      "confirmedDeliveryDate": "2026-12-06",
      "lineStatus": "in_production",
      "deliveryPriority": "P0",
      "deliveryAddress": "上海市闵行区客户 A 级机房"
    }
  ],
  "revisionHistory": [
    {
      "revisionId": "ORV-20261028-01",
      "changedAt": "2026-10-28T09:00:00+08:00",
      "changeType": "quantity_increase",
      "beforeQuantity": 180,
      "afterQuantity": 200,
      "requestedDeliveryDateBefore": "2026-11-30",
      "requestedDeliveryDateAfter": "2026-11-30",
      "reason": "客户追加 20 台 AI Server",
      "source": "订单履约·张三",
      "status": "confirmed"
    },
    {
      "revisionId": "ORV-20261112-02",
      "changedAt": "2026-11-12T16:40:00+08:00",
      "changeType": "quantity_cancel",
      "beforeQuantity": 200,
      "afterQuantity": 186,
      "requestedDeliveryDateBefore": "2026-11-30",
      "requestedDeliveryDateAfter": "2026-11-30",
      "reason": "客户临时取消 14 台 AI Server",
      "source": "订单履约·张三",
      "status": "confirmed"
    }
  ],
  "delivery": {
    "plannedShipQuantity": 186,
    "shippedQuantity": 36,
    "deliveredQuantity": 0,
    "lastShipmentAt": "2026-11-17T18:20:00+08:00",
    "nextShipmentPlan": [
      {
        "shipPlanId": "SHP-SO0101-02",
        "plannedQuantity": 50,
        "plannedShipDate": "2026-11-24"
      },
      {
        "shipPlanId": "SHP-SO0101-03",
        "plannedQuantity": 100,
        "plannedShipDate": "2026-12-05"
      }
    ]
  },
  "syncHealth": {
    "status": "delayed",
    "affectedInterface": "WMS inventory callback",
    "delayDays": 2,
    "lastSuccessfulCallbackAt": "2026-11-15T08:00:00+08:00",
    "message": "华东仓库存回传延迟 2 天，订单接入与可承诺量判断受影响",
    "externalImpact": true
  }
}
```

