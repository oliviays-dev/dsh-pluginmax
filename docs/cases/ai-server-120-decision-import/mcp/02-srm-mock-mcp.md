# AI Server GPU 供应 Mock MCP

> 资源类型：MCP  
> 资源 ID：`mcp-mock-srm-ai-server-120`  
> 所属 Function：procurement  
> 当前版本：1.0.0  
> 更新时间：2026-11-19  
> Mock 身份：`mcp://mock-srm-ai-server-120`

## 1. 资源描述

| 项目 | 内容 |
|---|---|
| 主要目标业务对象与操作类型 | GPU 预留、降供、加价增供和跨客户调拨；只读查询 |
| 预期产出 | 返回有效 GPU 数量、加价采购条件和供应商关系影响 |
| 限制与不适用边界 | 不创建采购订单、不审批价格、不直接调拨其他客户资源 |

## 2. 适用与不适用

| 类别 | 说明 |
|---|---|
| 适用用户 | Procurement、Planning、Order Fulfillment |
| 适用场景 | GPU 降供、增量采购、供应风险和供应商关系评估 |
| 不适用场景 | 供应商准入、合同签署、付款和真实采购执行 |

## 3. 使用前准备

| 项目 | 要求 |
|---|---|
| 账号与角色 | 已获得供应商和采购只读权限 |
| 数据准备 | 项目号或物料号 |
| 依赖资源 | OMS、APS-PLANNING |
| 配置项 | 演示供应商 `SUP-GPU-A` |

## 4. 使用方式举例

```json
{
  "tool": "srm.getGpuSupplyCommitment",
  "arguments": {
    "projectCode": "SO-AIS-120",
    "materialCode": "GPU-MODULE-H"
  }
}
```

## 5. 输入与输出

主要输出：

- 预留 `130` 个 GPU；
- 预计降供 `30%`；
- 14 天有效可用 `91` 个；
- 加价增供 `10` 个，单价增加 `50 万元`；
- 跨客户调拨 `20` 个，受影响客户延期 `3-5` 天。

## 6. 权限与数据边界

| 项目 | 说明 |
|---|---|
| 读操作 | 供应承诺、报价和供应商风险 |
| 写操作 | 无 |
| 数据范围 | 当前演示项目和相关供应商 |
| 敏感数据 | 价格、供应商名称和跨客户资源 |
| 审计要求 | 记录物料、数量、价格和供应商承诺版本 |

## 7. 调用工具清单

| Tool | 读写属性 | 用途 |
|---|---|---|
| `srm.getGpuSupplyCommitment` | 只读 | 查询 130 个 GPU 预留和 ETA |
| `srm.getSupplyRisk` | 只读 | 查询 30% 降供和可用量 |
| `srm.getPremiumSupplyOption` | 只读 | 查询 10 个加价 GPU |
| `srm.getCrossCustomerSupplyOption` | 只读 | 查询 20 个跨客户可调拨 GPU |

## 8. 限制与错误处理

| 限制或错误 | 处理方式 |
|---|---|
| 加价 GPU 来源与 130 个预留重复 | 返回 `DUPLICATE_SUPPLY`，不得重复计数 |
| 供应商未书面确认 ETA | `commitmentStatus=conditional` |
| 跨客户资源未审批 | `transferEligible=false` |

## Mock Source Document

```json mock-mcp-snapshot
{
  "schemaVersion": "srm-ai-server-120-mock-v1",
  "documentId": "mock-srm-ai-server-120-r1",
  "sourceSystem": "SRM",
  "sourceRevision": "SRM-R1",
  "projectCode": "SO-AIS-120",
  "observedAt": "2026-11-19T09:00:00+08:00",
  "isMock": true,
  "readOnly": true,
  "tools": [
    "srm.getGpuSupplyCommitment",
    "srm.getSupplyRisk",
    "srm.getPremiumSupplyOption",
    "srm.getCrossCustomerSupplyOption"
  ],
  "data": {
    "supplierId": "SUP-GPU-A",
    "supplierName": "GPU 核心供应商 A",
    "materialCode": "GPU-MODULE-H",
    "gpuPerAiServer": 1,
    "supplyCommitment": {
      "commitmentId": "GPU-COMMIT-130",
      "committedQuantity": 130,
      "commitmentWindowDays": 14,
      "onTimeAvailableQuantity": 91,
      "receivedQuantity": 0,
      "supplyReductionRate": 0.3,
      "supplyReductionWindowDays": 28,
      "calculation": "130 × (1 - 30%) = 91",
      "batchEtaConfirmed": true,
      "firstBatchEtaAt": "2026-11-24T18:00:00+08:00",
      "lastBatchEtaAt": "2026-11-29T18:00:00+08:00"
    },
    "premiumSupply": {
      "gpuQuantity": 10,
      "premiumPerGpu": 0.5,
      "totalPremiumCost": 5,
      "currencyUnit": "CNY_million",
      "incremental": true,
      "latestArrivalAt": "2026-11-28T18:00:00+08:00",
      "commitmentStatus": "conditional",
      "allOrNothing": true,
      "relationshipImpact": "medium",
      "relationshipNote": "需通过书面增量订单、明确价格和交付责任管理，不得依赖口头压力"
    },
    "crossCustomerSupply": {
      "gpuQuantity": 20,
      "sourceCustomerId": "CUS-CONTROLLED-02",
      "delayDaysMin": 3,
      "delayDaysMax": 5,
      "transferEligible": false,
      "approvalRequired": true,
      "relationshipImpact": "high",
      "relationshipNote": "调拨会把延期转移给其他客户，需要 OMS 影响分析和供应链负责人审批"
    },
    "supplierRelationship": {
      "status": "strained_by_supply_reduction",
      "score": 72,
      "trend": "down",
      "qualitativeRisks": [
        "供应商正在降供，增量 10 个 GPU 的承诺可靠性需要书面确认",
        "连续追加可能导致后续批次议价能力下降",
        "对跨客户调拨不应形成对供应商的隐性履约承诺"
      ]
    }
  },
  "sourceHealth": {
    "status": "healthy",
    "lastSuccessfulSyncAt": "2026-11-19T08:55:00+08:00"
  }
}
```
