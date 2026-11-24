# AI Server 发运 Mock MCP

> 资源类型：MCP  
> 资源 ID：`mcp-mock-wms-ai-server-120`  
> 所属 Function：logistics  
> 当前版本：1.0.0  
> 更新时间：2026-11-19  
> Mock 身份：`mcp://mock-wms-ai-server-120`

## 1. 资源描述

| 项目 | 内容 |
|---|---|
| 主要目标业务对象与操作类型 | 发运计划、E2E 和空运方案；只读测算 |
| 预期产出 | 返回普通运输和空运的时效、成本、能力与缓冲 |
| 限制与不适用边界 | 不订舱、不签发运单、不承诺承运商舱位 |

## 2. 适用与不适用

| 类别 | 说明 |
|---|---|
| 适用用户 | Logistics、Planning、Order Fulfillment |
| 适用场景 | 14 天交付窗口下的运输方式比较 |
| 不适用场景 | 承运商准入、合同签署、真实发货和签收 |

## 3. 使用前准备

| 项目 | 要求 |
|---|---|
| 账号与角色 | WMS 发运只读权限 |
| 数据准备 | 项目号、订单号和目标交付日 |
| 依赖资源 | OMS、MES、QMS |
| 配置项 | 发运计划 `OUT-AIS120-01` |

## 4. 使用方式举例

```json
{
  "tool": "wms.getAirFreightQuote",
  "arguments": {
    "projectCode": "SO-AIS-120",
    "quantity": 106
  }
}
```

## 5. 输入与输出

主要输出：

- 普通运输 E2E `21` 天；
- 空运 E2E `14` 天；
- 空运额外费用 `200 万元`；
- 空运名义时间缓冲 `0` 天；
- 96/106 台空运能力可行；
- 116/120 台需要分批或额外舱位。

## 6. 权限与数据边界

| 项目 | 说明 |
|---|---|
| 读操作 | 出库、运输方案、时效和成本 |
| 写操作 | 无 |
| 数据范围 | 当前项目发运计划 |
| 敏感数据 | 运费、客户地址和舱位 |
| 审计要求 | 记录发运计划、数量、报价版本和测算时间 |

## 7. 调用工具清单

| Tool | 读写属性 | 用途 |
|---|---|---|
| `wms.getOutboundReadiness` | 只读 | 查询出库准备 |
| `wms.getTransportOptions` | 只读 | 比较普通运输和空运 |
| `wms.getAirFreightQuote` | 只读 | 查询空运时效和费用 |
| `wms.getShipmentCapacity` | 只读 | 查询各数量方案舱位 |

## 8. 限制与错误处理

| 限制或错误 | 处理方式 |
|---|---|
| 空运无 1 天安全缓冲 | 标记 `schedule_risk=P1` |
| 200 万元只覆盖单一批次 | 分批时必须重新报价 |
| 舱位未确认 | 返回 `UNCONFIRMED_CAPACITY` |

## Mock Source Document

```json mock-mcp-snapshot
{
  "schemaVersion": "wms-ai-server-120-mock-v1",
  "documentId": "mock-wms-ai-server-120-r1",
  "sourceSystem": "WMS",
  "sourceRevision": "WMS-AIS120-R1",
  "projectCode": "SO-AIS-120",
  "observedAt": "2026-11-19T09:00:00+08:00",
  "isMock": true,
  "readOnly": true,
  "tools": [
    "wms.getOutboundReadiness",
    "wms.getTransportOptions",
    "wms.getAirFreightQuote",
    "wms.getShipmentCapacity"
  ],
  "data": {
    "outboundPlanId": "OUT-AIS120-01",
    "deadlineAt": "2026-12-03T23:59:59+08:00",
    "shipmentStatus": "waiting_decision",
    "plannedShipDate": null,
    "batches": {
      "batch1": {
        "planned": "2026-11-27 空运 · 96/106 台待决策",
        "actual": "未发运"
      },
      "batch2": {
        "planned": "2026-12-03 后 · 14/24 台待决策",
        "actual": "未发运"
      }
    },
    "transportOptions": [
      {
        "mode": "standard",
        "e2eDays": 21,
        "additionalCost": 0,
        "meets14DayWindow": false
      },
      {
        "mode": "air",
        "e2eDays": 14,
        "additionalCost": 2,
        "currencyUnit": "CNY_million",
        "meets14DayWindow": true,
        "nominalScheduleBufferDays": 0,
        "costScope": "one_consolidated_shipment"
      }
    ],
    "airFreight": {
      "latestBookingAt": "2026-11-25T18:00:00+08:00",
      "plannedDepartureAt": "2026-11-27T10:00:00+08:00",
      "plannedArrivalAt": "2026-12-03T18:00:00+08:00",
      "oneDayBufferAvailable": false,
      "bufferMitigation": "尝试提前一天起飞；未取得书面舱位前不得承诺安全缓冲"
    },
    "shipmentCapacityByScenario": {
      "96": {
        "feasible": true,
        "status": "confirmed",
        "cost": 2,
        "basis": "单一批次空运"
      },
      "106": {
        "feasible": true,
        "status": "confirmed",
        "cost": 2,
        "basis": "单一批次空运，需供应商和制造在 11-27 前完成"
      },
      "116": {
        "feasible": true,
        "status": "conditional",
        "cost": 2,
        "basis": "需要额外舱位或拆批，费用需复核"
      },
      "120": {
        "feasible": true,
        "status": "conditional",
        "cost": 2,
        "basis": "理论舱位可行，但依赖 MES 产出和 QMS 放行"
      }
    },
    "qualityAndDocumentGate": {
      "requiresQmsRelease": true,
      "requiresCommercialInvoice": true,
      "requiresPackingList": true
    },
    "logisticsJudgment": "14 天交付必须使用空运。96 和 106 台可按单一批次确认，但没有自然安全缓冲。"
  },
  "sourceHealth": {
    "status": "healthy",
    "lastSuccessfulSyncAt": "2026-11-19T08:45:00+08:00"
  }
}
```
