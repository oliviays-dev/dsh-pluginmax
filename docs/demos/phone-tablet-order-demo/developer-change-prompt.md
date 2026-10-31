# 给开发人员的改造 Prompt

## 目标

为“手机/平板成品供应链”录制一个端到端 Demo，覆盖：

```text
老板发现异常
  → Data Agent 只读评估
  → 创建父任务
  → 员工工作台接单
  → 一个人工三级任务
  → 一个 AI 三级任务
  → AI 通过 MCP 调用 Mock WMS
  → 人类确认后创建再平衡工单
  → 夜间 AI 完成报告初稿
  → 次日员工验收
```

必须复用现有 `orders-facts`、Data Agent、任务、工作台、AI 伙伴、Action Ticket 和资源市场 MCP 体系。

## 硬约束

1. **Demo 代码必须与正式功能隔离并可整体拆卸。**
2. **外部系统的实现可以是 Mock，但注册和调用必须是正常 MCP。**
3. **不得为 Demo 在正式领域插件中写手机/平板专用逻辑。**
4. **不得增加 Demo 专用 REST 业务接口冒充 MCP。**
5. **不得让 Data Agent 获得写工具。**
6. **不得在未实现真实 MCP 写调用时宣称“已创建到业务系统”。**

## 推荐架构

新增一个可选的独立插件：

```text
plugins/dsh-collab-demo-phone-tablet-order/
├── package.json
├── tsdown.config.ts
├── tsconfig.json
├── cordis.patch.yml
├── src/
│   ├── index.ts
│   ├── demo-mcp-provider.ts
│   ├── demo-task-action.ts
│   └── models.ts
├── mock/
│   ├── mock-oms-mcp-server.mjs
│   └── mock-wms-mcp-server.mjs
├── config/
│   ├── mock-mcp-assets.yaml
│   └── workbench-profile.yaml
├── data/
│   └── orders-fixture.json
└── prompts/
    ├── data-agent-prompts.md
    ├── fulfillment-partner-prompt.md
    ├── report-draft.md
    └── task-message-copy.md
```

当前材料已按此边界放在：

```text
docs/demos/phone-tablet-order-demo/
```

开发时可以把运行所需文件移入独立插件包；录制文档继续保留在 `docs/demos/`。

## 1. 通用 MCP Provider 注册能力

当前资源市场通过 `collabMcpCatalog` 注入单一 `McpCatalogProvider`。一个 provider 可以列出多个 MCP 资产，但多个插件不能可靠地各自覆盖同一个单例 key。

请增加一个**与 Demo 无关的通用能力**：

- 多个 MCP provider 可以注册；
- 资源市场按资产 `mcpId` 路由 `list`、`connect`、`tool call`；
- 未注册 provider 或未知资产一律 fail closed；
- provider 卸载时清理该 provider 下的客户端连接和 catalog 条目；
- 原有 `dsh-collab-data-orders` 的默认 OMS provider 行为不变。

不要把手机/平板、WMS、fixture 或 Demo 文案硬编码到资源市场。

建议把现有 `OrderMcpProvider` 已有的调用方式提升为通用接口：

```ts
interface McpToolProvider extends McpCatalogProvider {
  callTool(input: {
    userId: string;
    mcpId: string;
    toolName: string;
    arguments: Record<string, unknown>;
  }): Promise<Record<string, unknown>>;
}
```

注册表只负责：

- provider 生命周期；
- asset 到 provider 的路由；
- 用户连接状态；
- 调用审计和 fail-closed；
- 卸载清理。

具体业务语义仍由 MCP server 和调用方负责。

`dsh-collab-data-orders` 只做通用调整：

- 按 config 中的 `mcpAssetId` 从 provider registry 解析对应 provider；
- 找不到时 fail closed；
- 未配置 Demo provider 时继续使用现有默认 Mock OMS；
- 不把 Demo provider 作为包内静态依赖。

## 2. 独立 Demo MCP Provider

在 `dsh-collab-demo-phone-tablet-order` 中实现 `McpCatalogProvider`，只注册两个资产：

### 2.1 Mock OMS

- 资产 ID：`mcp-orders-phone-tablet-demo`
- 协议：MCP stdio
- 工具：
  - `orders_health`
  - `orders_query`
- 权限：
  - `orders.read`
  - `payments.read`
  - `fulfillment.read`
- 数据来源：`orders-fixture.json`
- 系统只读。

### 2.2 Mock WMS

- 资产 ID：`mcp-wms-phone-tablet-demo`
- 协议：MCP stdio
- 工具：
  - `wms_health`
  - `wms_rebalance_work_order_get`
  - `wms_rebalance_work_order_create`
- 权限：
  - `inventory.read`
  - `fulfillment.read`
  - `business_document.write`
- `wms_rebalance_work_order_create`：
  - 必须要求 Action Ticket；
  - 必须要求人类确认；
  - 必须幂等；
  - 只允许履约 AI 伙伴调用；
  - Data Agent 必须 denied。

具体资产声明见：

```text
mock-mcp-assets.yaml
```

标准 MCP server 实现见：

```text
mock-oms-mcp-server.mjs
mock-wms-mcp-server.mjs
```

两个 server 都必须遵守标准 MCP：

- `initialize`
- `tools/list`
- `tools/call`
- structuredContent 或 JSON text content
- 错误使用 MCP error result

不得新增 `/api/collab/data-orders/demo/...` 一类绕过 MCP 的业务接口。

Demo 插件启用后，只对 `手机平板订单履约演示` workspace 调用现有
`collabDataOrders.configure`：

```json
{
  "mode": "demo",
  "transport": "mcp",
  "mcpAssetId": "mcp-orders-phone-tablet-demo",
  "mcpToolName": "orders_query"
}
```

其他 workspace 继续使用正式默认配置 `mcp-orders-mock`。不要把 Demo asset ID
写成 `dsh-collab-data-orders` 的默认值。

## 3. 资源市场注册与连接

Demo 插件启用后，资源市场应正常出现：

```text
Mock 手机平板订单管理系统
Mock 手机平板成品仓 WMS
```

用户仍按现有流程操作：

1. 资源市场；
2. MCP 页签；
3. 搜索资产；
4. 查看详情；
5. 连接；
6. provider 执行 `initialize` 和 `tools/list`；
7. 连接状态写入现有 `collab_resource_market` installs。

禁止使用静态 seed 假装连接。

连接失败、MCP 不可用、工具列表为空或响应契约不合法时必须显示未连接或错误，不得伪造成功。

## 4. 任务详情业务动作

新增一个**通用**任务详情扩展 slot，例如：

```text
pluginmax.task.detail.extension
```

正式任务插件只负责渲染 slot；没有 Demo 插件时 slot 为空。

Demo 插件在 slot 中渲染业务动作卡：

```text
成品仓订单再平衡工单
状态：草稿
订单范围：37 单
预计影响金额：¥194,125

[查看工单草稿] [确认并创建]
```

点击“确认并创建”后的调用链必须是：

```text
人类确认
  → 签发 / 校验 Action Ticket
  → 通过资源市场解析 mcp-wms-phone-tablet-demo
  → 标准 MCP tools/call
  → wms_rebalance_work_order_create
  → 返回 WO-RB-DEMO-1030-017
```

禁止由任务前端直接调用 Demo REST API。

成功后显示：

```text
WO-RB-DEMO-1030-017 创建成功
Mock WMS · MCP · 演示动作 · 非生产
确认人：周宁
操作者：履约 AI 伙伴
审计引用：AT-PT-ORD-001-B
```

刷新后应能从任务回执和 Mock WMS 的 `get` 工具恢复相同工单号。

## 5. Mock OMS 数据

不要修改正式 `plugins/dsh-collab-data-orders/mock/order-mcp-server.mjs` 来读取 Demo fixture。

使用 Demo 插件自己的 `mock-oms-mcp-server.mjs`：

1. 从 `ORDERS_DEMO_FIXTURE_PATH` 读取 fixture；
2. fixture 顶层包含 `orders`；
3. 最大 10,000 行；
4. 校验必需字段和日期；
5. 支持 `from`、`to`、`filters`、`limit`；
6. `dataCutoffAt` 使用服务当前时间；
7. `scannedRows` 返回 fixture 总行数；
8. 响应包含 `demo=true` 和 `fixtureId`；
9. 失败时 fail closed，不回退到正式数据。

现有生产订单 MCP 和内置 567 行 Demo 必须完全不受影响。

录制数据：

```text
today · east · digital
orderCount = 1658
exceptionCount = 126
exceptionRate = 7.6
paymentFailureCount = 52
cancelledCount = 31
fulfillmentTimeoutCount = 43
exceptionAmount = 642748
currentSevenDayOnTimeRate = 94.1
previousSevenDayOnTimeRate = 95.9
deltaPt = -1.8
```

## 6. Data Agent 与订单 Skill

优先不改正式订单 Skill 的手机/平板专用别名。

录制提示词使用现有“数码”别名：

```text
今天华东数码（手机/平板）订单有什么异常？
```

Data Agent 继续使用 `orders-facts`、`order_exception_*`、`payment_failure_rate`、`cancel_rate` 和 `fulfillment_timeout_rate`。

Demo 插件可以携带 Demo 专用 Data Skill 展示文案，但：

- 不得复制核心 QueryRun；
- 不得复制权限系统；
- 不得改写正式 `skill.order-exception-analysis`；
- 不得让 Data Agent 获得 WMS 写工具；
- 不得改变“正式报告复用同一 QueryRun”的规则。

如果为了让“手机/平板”自然语言稳定映射到 `digital` 必须扩展别名，应将别名放在可配置 Skill / domain display config 中；若只能改正式 connector，则改动必须是通用同义词配置，不得出现 Demo ID、fixture 名或业务故事。

## 7. 工作台显示 Profile

将 `workbench-profile.yaml` 放在 Demo 插件中，由 Demo 插件通过通用显示扩展点启用。

环境变量：

```sh
PLUGINMAX_ENABLE_PHONE_TABLET_DEMO=1
PLUGINMAX_WORKBENCH_DEMO_PROFILE=phone-tablet-order-v1
```

Profile 要求：

1. 隐藏“供给例外”和“供应商风险”；
2. 保留“核心指标”“每日简报”“我的待办”“重点关注”；
3. 订单准时履约率仍来自 Data Fabric live metric；
4. 手机/平板异常 brief 来自 Demo profile；
5. 没有 Demo 插件时工作台恢复正式默认内容；
6. 正式工作台代码不得 import Demo 插件或读取 Demo YAML 路径。

## 8. 安装与拆卸

### 启用

只在 Demo profile 安装独立插件：

```sh
PLUGINMAX_ENABLE_PHONE_TABLET_DEMO=1 ./scripts/install-profile.sh
```

建议 `install-profile.sh` 仅在环境变量为 `1` 时安装：

```text
dsh-collab-demo-phone-tablet-order
```

### 拆卸

必须能通过以下步骤完全移除：

1. 从 profile 删除 `dsh-collab-demo-phone-tablet-order`；
2. 清空 `PLUGINMAX_ENABLE_PHONE_TABLET_DEMO`；
3. 删除 demo fixture、MCP servers、prompts 和 workbench profile；
4. 清理资源市场中的两个 Demo MCP 连接记录；
5. 清理 Demo workspace 的任务、AI 伙伴和业务回执。

正式功能不得依赖 Demo 包导出的任何类型、常量、路由、CSS、MCP 资产或 fixture。

允许保留的共享代码只有通用能力：

- 多 MCP provider 注册与按 asset ID 路由；
- 通用任务详情 extension slot；
- 通用 feature flag / optional profile 安装能力。

这些通用能力不得出现 `phone-tablet`、`fulfillment-ai`、`WO-RB-DEMO-1030-017` 等 Demo 标识。

## 9. 验收

### MCP

- 资源市场显示两个 Demo MCP；
- 连接状态来自 provider，不是 seed；
- `tools/list` 返回约定工具；
- `wms_rebalance_work_order_create` 缺少 Action Ticket 时失败；
- Data Agent 工具列表中没有 WMS 写工具；
- 人类确认后通过 MCP 返回 `WO-RB-DEMO-1030-017`；
- 重复 `idempotencyKey=PT-ORD-001-B` 返回同一工单；
- MCP server 重启后未持久化的 Demo 工单可被明确标记为不可恢复，或按 Demo 要求持久化到独立状态文件。

### 数据

- Data Agent 返回 126 / 7.6% / 52 / 31 / 43；
- 工作台订单准时履约率为 94.1%，趋势 -1.8pt；
- 华北、西南未覆盖，不按 0 处理；
- 正式订单数据和内置 mock 回归不受影响。

### 可拆卸

- 不安装 Demo 插件时，应用可正常启动；
- 卸载 Demo 插件后，资源市场不再出现两个 Demo MCP；
- 正式任务详情 slot 为空但不报错；
- 工作台恢复默认模块；
- Demo fixture 和业务文案不再被引用；
- 正式功能测试不依赖 Demo fixture。

### 回归

至少运行：

```sh
corepack pnpm --filter dsh-collab-resource-market test
corepack pnpm --filter dsh-collab-data-orders test
corepack pnpm --filter dsh-collab-task test
corepack pnpm --filter dsh-collab-workbench test
corepack pnpm --filter dsh-collab-demo-phone-tablet-order test
```

再执行一次不启用 Demo profile 的 smoke，确认正式安装链路没有 Demo 依赖。
