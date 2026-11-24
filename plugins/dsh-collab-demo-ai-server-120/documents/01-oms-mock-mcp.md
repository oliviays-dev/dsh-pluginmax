# AI Server 订单 Mock MCP

> 资源类型：MCP  
> 资源 ID：`mcp-mock-oms-ai-server-120`  
> 所属 Function：order-fulfillment  
> 当前版本：1.0.0  
> 更新时间：2026-11-19  
> 数据口径：AI Server 120 台订单、14 天最低交付线、商业风险和跨客户调拨影响  
> Mock 身份：`mcp://mock-oms-ai-server-120`

## 1. 资源描述

| 项目 | 内容 |
|---|---|
| 主要目标业务对象与操作类型 | 销售订单、订单行、交付要求、商业风险；只读查询 |
| 预期产出 | 返回 120 台订单事实、96 台最低交付线、1,500 万风险、800 万基准利润和跨客户延期影响 |
| 限制与不适用边界 | 不提供 GPU 库存、生产产能、检验能力和运输执行结果；不修改订单、客户或合同 |

该 Mock 只用于供应链负责人订单决策演练，所有数据均为演示数据。

## 2. 适用与不适用

| 类别 | 说明 |
|---|---|
| 适用用户 | Order Fulfillment、Planning、供应链负责人 |
| 适用场景 | 订单变更、最低交付线判断、商业风险和跨客户优先级审批 |
| 不适用场景 | 生产排程、库存扣减、质量放行、运输订舱或真实客户承诺 |

## 3. 使用前准备

| 项目 | 要求 |
|---|---|
| 账号与角色 | 已获得订单和商业风险只读权限 |
| 数据准备 | 销售订单号或项目号 |
| 依赖资源 | SRM、APS-PLANNING、MES、WMS、QMS Mock MCP |
| 配置项 | 工作区绑定 `SO-AIS-120` 演示项目 |

## 4. 使用方式举例

| 项目 | 示例 |
|---|---|
| Server 名称 | `mock-oms-ai-server-120` |
| 传输方式 | stdio / Mock 资源文档 |
| 鉴权方式 | 平台托管 |
| 推荐 Tool | `oms.getOrderSnapshot` |

```json
{
  "tool": "oms.getOrderSnapshot",
  "arguments": {
    "salesOrderId": "SO-AIS-120-20261119"
  }
}
```

## 5. 输入与输出

| 字段 | 必填 | 说明 |
|---|---:|---|
| `salesOrderId` | 否 | 销售订单号 |
| `projectCode` | 否 | 项目号，默认 `SO-AIS-120` |
| `delayDays` | 否 | 跨客户调拨影响天数，支持 3、4、5 |

主要输出：

- `originalQuantity=100`
- `currentQuantity=120`
- `minimumOnTimeQuantity=96`
- `deliveryWindowDays=14`
- `commercialRiskIfBelowMinimum=15`
- `baselineProfitAt100=8`
- `crossCustomerTransfer.estimatedExternalCost=4`

## 6. 权限与数据边界

| 项目 | 说明 |
|---|---|
| 读操作 | 订单、订单行、商业风险、跨客户影响 |
| 写操作 | 无 |
| 数据范围 | 仅当前演示项目 |
| 敏感数据 | 商业风险和客户影响属于决策敏感信息 |
| 审计要求 | 每次工具调用记录订单号、调用者和数据版本 |

## 7. 调用工具清单

| Tool | 读写属性 | 用途 |
|---|---|---|
| `oms.getOrderSnapshot` | 只读 | 查询订单和订单行 |
| `oms.getOrderRevisions` | 只读 | 查询订单数量变更 |
| `oms.getCommercialRisk` | 只读 | 查询最低交付线和商业风险 |
| `oms.getCrossCustomerImpact` | 只读 | 查询跨客户调拨延期和综合成本假设 |

## 8. 限制与错误处理

| 限制或错误 | 处理方式 |
|---|---|
| 订单号不存在 | 返回 `NOT_FOUND`，不得改用其他订单 |
| 项目号与订单不匹配 | 返回 `INVALID_ARGUMENT` |
| 风险金额缺失 | 标记待确认，不得假设为零 |
| 跨客户影响未包含 4 天或 5 天 | 使用统一 400 万元假设并明确标注 |

## Mock Source Document

```json mock-mcp-snapshot
{
  "schemaVersion": "oms-ai-server-120-mock-v1",
  "documentId": "mock-oms-ai-server-120-r1",
  "sourceSystem": "OMS",
  "sourceRevision": "OMS-R1",
  "projectCode": "SO-AIS-120",
  "observedAt": "2026-11-19T09:00:00+08:00",
  "isMock": true,
  "readOnly": true,
  "tools": [
    "oms.getOrderSnapshot",
    "oms.getOrderRevisions",
    "oms.getCommercialRisk",
    "oms.getCrossCustomerImpact"
  ],
  "data": {
    "salesOrderId": "SO-AIS-120-20261119",
    "lineId": "SO-AIS-120-20261119-01",
    "customerId": "CUS-AI-STRATEGIC-01",
    "customerName": "战略客户 AI 算力中心",
    "productCode": "AI-SERVER-X800",
    "productName": "X-800 8U AI Server",
    "originalQuantity": 100,
    "currentQuantity": 120,
    "orderDate": "2026-11-19T09:00:00+08:00",
    "minimumOnTimeQuantity": 96,
    "deliveryWindowDays": 14,
    "deadlineAt": "2026-12-03T23:59:59+08:00",
    "commercialRiskIfBelowMinimum": 15,
    "riskCurrencyUnit": "CNY_million",
    "riskNature": "potential_commercial_risk",
    "riskProbability": null,
    "baselineProfitAt100": 8,
    "profitAt120": null,
    "remainingQuantityAfterMinimum": 24,
    "remainingQuantityLatestDeliveryAt": null,
    "orderStatus": "in_fulfillment",
    "revisions": [
      {
        "revisionId": "ORV-AIS-120-01",
        "changedAt": "2026-11-19T08:30:00+08:00",
        "changeType": "quantity_increase",
        "beforeQuantity": 100,
        "afterQuantity": 120,
        "reason": "客户追加 20 台"
      }
    ],
    "crossCustomerTransfer": {
      "targetQuantity": 20,
      "affectedCustomerId": "CUS-CONTROLLED-02",
      "affectedCustomerName": "受保护客户订单 B",
      "delayDaysMin": 3,
      "delayDaysMax": 5,
      "delayCostIndependentOfDays": true,
      "estimatedExternalCost": 4,
      "estimatedExternalCostMin": 4,
      "estimatedExternalCostMax": 4,
      "costAssumption": "延期 3-5 天均按 400 万元综合违约/逾期成本计算",
      "contractPenaltyPerDay": null,
      "contractPenaltyCap": null,
      "expeditingOrCompensationCost": null,
      "customerTier": null,
      "renewalRisk": "high",
      "relationshipImpactNote": "400 万元是账面假设，不覆盖客户信任、续约和内部跨项目协作损失",
      "approved": false
    }
  },
  "sourceHealth": {
    "status": "healthy",
    "lastSuccessfulSyncAt": "2026-11-19T09:00:00+08:00"
  }
}
```
