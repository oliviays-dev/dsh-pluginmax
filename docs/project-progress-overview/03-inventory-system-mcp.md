# 库存系统 Mock MCP

> MCP 身份：`mcp://mock-inventory`  
> 系统类型：WMS / 库存与仓储管理系统  
> 唯一数据源：[Mock Source Document](#mock-source-document)  
> 数据口径：库存余额、项目占用、在途、批次、仓库异常。  
> 禁止读取：客户订单变更、生产实际产量、计划完成日期。

## 1. MCP 工具

| 工具 | 输入 | 输出 |
| --- | --- | --- |
| `inventory.getProjectKitSnapshot` | `projectCode` | 项目套件齐套和组件库存 |
| `inventory.getReservations` | `projectCode` | 项目占用量、批次和仓库 |
| `inventory.getInboundPlan` | `projectCode` | 在途数量、ETA、供应商和异常 |
| `inventory.getWarehouseHealth` | `warehouseId` | 同步、盘点和接口健康 |

## 2. 字段责任

| 字段 | 说明 |
| --- | --- |
| `onHandQuantity` | 仓库账面数量 |
| `allocatedQuantity` | 已被项目占用数量 |
| `availableQuantity` | 未被占用的可分配数量 |
| `inboundQuantity` | 已确认在途数量 |
| `eta` | 预计到货日期 |
| `shortageQuantity` | 明确缺口，不由项目数减法生成 |
| `warehouseHealth` | 仓储接口同步状态 |

## 3. 齐套口径

以 `X-800 8U AI Server` 为例：

- 每台需要 GPU 模块 8 个。
- 每台需要 CPU 2 个。
- 每台需要 1 个液冷歧管套件。
- 每台需要 2 个冗余电源。

库存系统返回的是组件层事实。项目概览将其聚合为“可支撑多少台整机”，但页面必须同时保留组件级证据。

## Mock Source Document

> Mock MCP 只解析此代码块。`timingGap` 表示数量最终可补齐但到货时间晚于装配需求，不能误写成永久缺料。

```json mock-mcp-snapshot
{
  "schemaVersion": "inventory-snapshot-v1",
  "documentId": "mock-inventory-so0101-20261118-r4",
  "sourceSystem": "WMS",
  "projectCode": "SO0101",
  "productCode": "X800-8U",
  "observedAt": "2026-11-18T12:00:00+08:00",
  "inventoryRevision": "INV-R4",
  "kitDemand": {
    "servers": 186,
    "unit": "台"
  },
  "components": [
    {
      "componentCode": "GPU-MODULE-H",
      "componentName": "高性能 GPU 模块",
      "requiredPerServer": 8,
      "demandQuantity": 1488,
      "onHandQuantity": 1216,
      "allocatedQuantity": 1216,
      "availableQuantity": 96,
      "inboundQuantity": 176,
      "eta": "2026-11-25",
      "unit": "个",
      "shortageQuantity": 0,
      "timingGap": {
        "exists": true,
        "requiredBefore": "2026-11-20",
        "availableFrom": "2026-11-25",
        "affectedServers": 14,
        "message": "总量可补齐，但在首批总装前仍缺 112 个 GPU 模块"
      },
      "warehouseBreakdown": [
        {
          "warehouseId": "WH-EAST-01",
          "onHandQuantity": 832,
          "allocatedQuantity": 832,
          "availableQuantity": 0
        },
        {
          "warehouseId": "WH-SH-02",
          "onHandQuantity": 384,
          "allocatedQuantity": 384,
          "availableQuantity": 0
        }
      ]
    },
    {
      "componentCode": "CPU-SERVER-2S",
      "componentName": "双路服务器 CPU",
      "requiredPerServer": 2,
      "demandQuantity": 372,
      "onHandQuantity": 420,
      "allocatedQuantity": 372,
      "availableQuantity": 48,
      "inboundQuantity": 0,
      "unit": "个",
      "shortageQuantity": 0,
      "timingGap": {
        "exists": false
      }
    },
    {
      "componentCode": "COOL-MANIFOLD-8U",
      "componentName": "8U 液冷歧管套件",
      "requiredPerServer": 1,
      "demandQuantity": 186,
      "onHandQuantity": 158,
      "allocatedQuantity": 158,
      "availableQuantity": 18,
      "inboundQuantity": 28,
      "eta": "2026-11-21",
      "unit": "套",
      "shortageQuantity": 0,
      "timingGap": {
        "exists": false
      }
    },
    {
      "componentCode": "PSU-3000W",
      "componentName": "3000W 冗余电源",
      "requiredPerServer": 2,
      "demandQuantity": 372,
      "onHandQuantity": 380,
      "allocatedQuantity": 372,
      "availableQuantity": 8,
      "inboundQuantity": 0,
      "unit": "个",
      "shortageQuantity": 0,
      "timingGap": {
        "exists": false
      }
    }
  ],
  "warehouseHealth": [
    {
      "warehouseId": "WH-EAST-01",
      "status": "degraded",
      "lastSuccessfulSyncAt": "2026-11-15T08:00:00+08:00",
      "slaMinutes": 60,
      "message": "华东仓库存回传延迟 2 天"
    },
    {
      "warehouseId": "WH-SH-02",
      "status": "healthy",
      "lastSuccessfulSyncAt": "2026-11-18T11:55:00+08:00",
      "slaMinutes": 60
    }
  ],
  "sourceHealth": {
    "status": "degraded",
    "lastSuccessfulSyncAt": "2026-11-18T11:55:00+08:00"
  }
}
```

