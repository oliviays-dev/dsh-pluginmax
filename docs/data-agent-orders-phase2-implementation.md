# Data Agent 订单 MVP（第二阶段）实现说明

> 日期：2026-10-30  
> 阶段：第二步：订单 MVP  
> 上游：[通用数据问询 PRD](./data-agent-general-query-prd.md)、[技术设计](./data-agent-general-query-technical-design.md) 15.2  
> 前置：[Data Fabric 第一阶段实现](./data-agent-data-fabric-phase1-implementation.md)  
> 插件：`plugins/dsh-collab-data-orders`

## 1. 结论

订单领域 MVP 已通过独立领域插件接入现有 Data Fabric，没有新增聊天、Runtime、QueryRun、工具或权限系统。

本轮落地：

- 订单只读 Connector manifest、字段映射、迁移和连接配置；
- 通过现有资源市场 MCP provider 注册的第三方 Mock 订单管理系统；
- 认证订单 Dataset、Metric、Policy 和版本化 Skill；
- 默认“订单异常”固定口径；
- 部分区域权限与服务端过滤；
- 工作台订单履约指标迁移；
- Data Agent 通用 QueryRun 证据回写、正式报告复用和 HTML 快照派生；
- 无选区订单 brief、下钻、报告、HTML、部分权限与移动端 GUI 回归。

真实生产订单系统尚未接入。本轮使用独立 Mock OMS MCP server，通过平台现有资源市场 MCP 资产/provider 注册和连接；生产 MCP endpoint 与凭据缺失时 fail closed。当前所有可执行订单结果均显式标记为 `demo` / 非生产。

## 2. 数据入口盘点

盘点范围包括：

- 仓库配置、环境配置、manifest、SQL 和 Connector 声明；
- `plugins`、`packages`、`scripts`；
- 工作台订单/经营指标实现；
- 已有未提交修改。

未发现可用的生产订单 API、数据库只读副本、数仓 endpoint 或凭据引用。工作台原有 `OTIF` 是静态演示种子，不能作为生产结果。

因此本轮交付：

1. 独立 Mock OMS MCP server，仅暴露只读 `orders_health` / `orders_query`；
2. 使用现有 `collabMcpCatalog` provider 和资源市场 MCP 页面注册、连接；
3. 订单 Connector 的 `mcp` transport 通过资源市场 provider 调用 MCP 工具；
4. 保留 `http-json` 作为不使用 MCP 时的受控回退；
5. 连接、工具、凭据、响应不合约或超时时 fail closed；
6. 不把 Mock MCP 值伪装成生产结果。

配置文件：

- [Connector manifest](../plugins/dsh-collab-data-orders/config/order-connector.manifest.json)
- [Runtime / 模版 / AI伙伴 / 生产阻塞配置](../plugins/dsh-collab-data-orders/config/order-domain.yaml)

## 3. Connector 与迁移

### 3.1 资源市场 MCP 边界

Mock OMS 不是新的 MCP 注册中心，而是现有资源市场 MCP 体系的外部资源：

- asset ID：`mcp-orders-mock`；
- provider：`collabMcpCatalog`；
- resource market 页面：Skill / MCP / 工作台市场中的 MCP；
- 连接 API：`POST /api/collab/resources/mcps/connect`；
- 连接状态由资源市场存储，provider 只在 MCP 连接与工具发现成功后返回 `connected`；
- 数据查询必须由已连接用户调用，未连接时 Data Fabric fail closed。

边界职责：

| 层 | 负责 | 不负责 |
| --- | --- | --- |
| Mock OMS MCP server | 三方订单事实、工具协议、分页/超时和来源时间戳 | 平台成员权限、指标口径、报告 |
| 资源市场 MCP provider | 资产发现、连接健康、MCP client、工具调用 | Dataset/Metric/Policy |
| 订单 Connector | MCP 结果与字段映射、值规范化、只读约束 | Agent Prompt、报告、聊天 |
| Data Fabric | Dataset/Metric/Policy、指标聚合、QueryRun | MCP 连接治理 |
| Data Agent | 发现、查询编排、brief/报告 | 直连 MCP 或数据库 |

未来接入真实三方订单系统时，只替换 MCP URL/command、认证 header 或 stdio command，并验证工具契约与字段映射。

### 3.2 Connector

Connector type：`orders-readonly`

能力：

- 只读；
- 参数化时间、维度和认证指标；
- 无自由 SQL；
- 无写入；
- 无跨数据集 join；
- 结构化字段映射和值映射；
- `fixture`、`mcp`、`http-json` 三种 transport；
- 演示与生产模式互斥。

MCP 工具 `orders_query` 的结果契约：

```json
{
  "orders": [
    {
      "order_id": "external-id",
      "ordered_at": "2026-10-30T02:00:00.000Z",
      "paid_at": "2026-10-30T02:03:00.000Z",
      "order_status": "paid",
      "payment_status": "succeeded",
      "region": "east",
      "category": "fresh",
      "payment_method": "wallet",
      "channel": "app",
      "merchant": "flagship",
      "promised_fulfillment_at": "2026-10-30T05:00:00.000Z",
      "actual_fulfillment_at": null,
      "refund_status": "none",
      "amount": 128.5
    }
  ],
  "dataCutoffAt": "2026-10-30T03:00:00.000Z",
  "freshness": "10 分钟",
  "scannedRows": 1200
}
```

MCP 默认指向资源市场资产 `mcp-orders-mock` / `orders_query`。

HTTP 回退只允许环境引用：

- `endpointRef`：`env:ORDERS_READONLY_ENDPOINT`
- `credentialRef`：`env:ORDERS_READONLY_TOKEN`

服务端只解析环境变量，不向前端、QueryRun、日志或 ContextPack 返回密钥。禁止 endpoint 内嵌账号密码，也拒绝 localhost、本机 loopback 和 `.local` 目标。

### 3.3 字段映射

Dataset 字段 ID 与 Connector 规范字段保持稳定，物理字段通过 `fieldMapping` 配置：

- `orderId`
- `orderedAt`
- `paidAt`
- `orderStatus`
- `paymentStatus`
- `region`
- `category`
- `paymentMethod`
- `channel`
- `merchant`
- `promisedFulfillmentAt`
- `actualFulfillmentAt`
- `refundStatus`
- `amount`

状态、区域、品类、支付方式、渠道等支持 `valueMappings`，用于将来源系统编码规范化为 Data Fabric 语义值。

### 3.4 迁移

订单插件使用独立域 `collab_data_orders` 保存：

- `source_configs`
- `migrations`

迁移规则：

- 首次访问写入显式 demo 配置；
- Connector manifest 或语义版本变化时合并字段映射/值映射并增加 revision；
- 记录 `fromVersion -> toVersion`；
- 迁移不删除 QueryRun、报告或历史结果；
- 旧 `orders-manifest-v1` Fixture demo 自动迁移到资源市场 MCP 资产；
- 当前 manifest 为 `orders-manifest-v2`，语义模型为 `orders-semantic-v1`。

Data Fabric 主域升级为 v2，并声明兼容 v1；新增通用 `DataSkill` 表，不改已有 Dataset、Metric、Policy、QueryRun、QueryResult 的存储契约。

## 4. 订单 Dataset

Dataset ID：`orders-facts`

覆盖字段：

| 字段 | 用途 |
| --- | --- |
| `order_id` | 订单 ID、异常去重 |
| `ordered_at` | 下单时间、订单量类默认时间 |
| `paid_at` | 支付时间 |
| `order_status` | 订单状态 |
| `payment_status` | 支付状态 |
| `region` | 区域与 RLS |
| `category` | 品类 |
| `payment_method` | 支付方式 |
| `channel` | 渠道 |
| `merchant` | 商家 |
| `promised_fulfillment_at` | 承诺履约时间 |
| `actual_fulfillment_at` | 实际履约时间 |
| `refund_status` | 退款状态，不进入默认异常 |
| `amount` | 订单金额 |

演示模式：

- Dataset `isFixture=true`；
- 名称明确包含“订单 Mock MCP 数据集（非生产）”；
- 数据经 `mcp-orders-mock` 资源市场 MCP 获取；
- 结果 evidence 必带 `demo:orders-demo-v1`；
- 工作台卡显示“演示数据 · 近 7 天 · 非生产”。

生产模式：

- 仅在生产 MCP asset/URL/凭据或受控 HTTP endpoint 可用时查询；
- Dataset `isFixture=false`；
- 生产查询不会回退到 demo。

## 5. 认证指标

| 指标 | Data Fabric 公式 |
| --- | --- |
| `order_count` | 时间范围内、权限过滤后的订单行数 |
| `paid_order_count` | 支付成功或已履约且支付时间存在的订单数 |
| `payment_failure_rate` | 支付失败 / 已结束支付尝试（成功 + 失败） |
| `cancel_rate` | 取消订单 / 订单量 |
| `fulfillment_timeout_rate` | 履约超时 / 截至截止时间已应履约订单 |
| `order_exception_count` | 支付失败、取消、履约超时按订单 ID 去重 |
| `order_exception_rate` | 异常量 / 订单量 |

辅助认证指标：

- `fulfillment_on_time_rate`：工作台“订单准时履约率”；
- `order_amount_sum`：授权订单金额合计。

固定 MVP 口径：

```text
订单异常 v1 = 支付失败 + 取消 + 履约超时
```

- 退款不进入默认异常；
- 金额异常不进入默认异常；
- 同一订单命中多个条件只计一次；
- `order_exception_rate` 的分子和分母使用同一批下单时间范围内订单。

时间语义：

- 订单量、支付失败、取消按 `ordered_at`；
- 履约超时比较 `promised_fulfillment_at` 与 `actual_fulfillment_at`；
- 尚未到承诺时间的订单不计入履约超时分母；
- 取消和支付失败订单不计入应履约分母；
- “今天”按工作区时区 00:00 到查询时刻。

维度：

- 区域；
- 品类；
- 订单状态；
- 支付方式；
- 渠道；
- 商家。

中文问询值支持规范化，例如：

- `华东` / `east`
- `生鲜` / `fresh`

## 6. 权限与部分覆盖

Policy：

- `orders-policy-v1`；
- 工作区 member 默认覆盖 `east`、`south`；
- owner 不额外收窄；
- guest fail closed。

行级策略在 Data Fabric 服务端与请求过滤求交，任一交集为空即不返回行，不能因再次合并策略而扩大范围。

权限摘要示例：

```text
workspaceRole:member
rowScope:region=east|south
policy:orders-policy-v1
coverage:当前授权：华东、华南；未覆盖：华北、西南
```

部分权限问询会把未覆盖区域表达为“未知”，不会当作 0。

## 7. 订单 Skill

Skill ID：`skill.order-exception-analysis`  
版本：`v1.0`

Skill 只保存领域知识：

- 默认异常口径；
- 时间与履约判定；
- 下钻顺序；
- 部分权限文案；
- brief 字段；
- 正式报告复用规则。

Skill 不执行权限、SQL、连接或审计逻辑。Data Agent 通用代码只负责按权限读取匹配 Skill 并注入 ContextPack。

## 8. Data Agent 通用证据链路

本轮只增加通用数据行为，不写订单专用 Prompt：

1. 无选区时从 Data Fabric 读取匹配的版本化 Skill；
2. QueryRun 关联 Agent Run、Conversation、请求人和项目；
3. 普通 brief 自动附加 QueryRun、Dataset、Metric 版本、截止时间和权限摘要；
4. 正式报告记录同一批 QueryRun evidence；
5. 会话已有成功 QueryRun 时，报告模式拒绝再次执行 `metric_query` / `dataset_query_readonly`；
6. 正式 Markdown 和 HTML 使用同一报告快照；
7. HTML 生成不调用查询工具、不创建 QueryRun。

报告模式检测也修复了“不要重新查询；报告要包含…”被误判为“不要报告”的否定匹配缺陷。

## 9. 工作台迁移

工作台 `OTIF` 卡已改为 Data Fabric 认证指标：

- 显示名：订单准时履约率；
- metric：`fulfillment_on_time_rate`；
- 时间：近 7 天，与前一 7 天对比；
- 证据：QueryRun ID、metric version、data cutoff；
- 数据模式：demo / production / unavailable。

未迁移的经营指标继续是演示种子，并在指标区顶部统一标注“其余经营卡为演示种子”。

查询失败时显示不可用，不用 demo 或静态值替代生产结果。

## 10. PRD 对应关系

| PRD | 实现 |
| --- | --- |
| 第 9 节：订单语义范围 | `orders-facts` Dataset、14 个字段、6 个维度、7 个认证 MVP 指标 |
| 第 10 节：来源与可信度 | demo/production 隔离、dataCutoffAt、freshness、evidence、截断和不可用状态 |
| 第 11 节：安全、审计与动作边界 | Connector 只读、RLS、env 凭据引用、QueryRun、无自由 SQL、无写工具 |
| 第 14 节：验收 | 无选区问询、部分权限、下钻、报告、HTML、移动端、失败与无数据测试 |
| 15.2 订单 MVP | 订单 Connector/语义/Policy/Skill、工作台迁移、正式报告、GUI E2E |

三层配置对应：

- Runtime：复用通用 Data Agent 工具白名单和预算；
- 模版：通过 Data Fabric Skill ref 提供订单知识，不修改系统 SOUL；
- AI伙伴：建议默认 `today`、`Asia/Shanghai`、订单指标优先，配置样例见 `config/order-domain.yaml`。

## 11. 已验证

完整门禁（2026-10-30）：

- typecheck：通过；
- lint：通过（仅保留既有 warning）；
- unit/contract：52 个测试文件、729 个测试通过；
- build：25 个 workspace package 全部通过；
- contract：23 个插件 bundle 通过；
- pack:check：全部 dry-run 通过。

单元/契约覆盖：

- manifest 与 TypeScript Connector 契约同步；
- 所有订单字段和认证指标；
- 异常口径去重、退款排除；
- 支付失败分母；
- 履约超时与应履约分母；
- 部分区域权限；
- 中文区域/品类过滤；
- 无数据；
- 结果截断；
- 连接失败；
- 未在资源市场连接 MCP 时拒绝查询；
- 资源市场 provider 连接、工具发现与 `tools/call`；
- 旧 Fixture 配置迁移到 MCP asset；
- 查询超时；
- guest 拒绝；
- 生产模式缺引用拒绝；
- Skill 授权读取；
- QueryRun evidence 写入 brief/报告/HTML；
- 工作台指标替换与 demo 标识；
- 报告意图否定匹配。

GUI：

- 资源市场 MCP 页显示 Mock OMS 且状态为“已连接”；
- 无选区“今天有没有订单异常”；
- 华东生鲜下钻；
- 部分区域权限提示；
- 正式报告；
- 显式 HTML 派生且不新增 QueryRun；
- 桌面 1440x960；
- 移动 390x844 无横向溢出；
- Console 和失败网络请求为空。

证据：

- `.tmp/order-workbench-metric.png`
- `.tmp/order-resource-market-mcp.png`
- `.tmp/order-brief-desktop.png`
- `.tmp/order-brief-drilldown.png`
- `.tmp/order-formal-report.png`
- `.tmp/order-html-derivative.png`
- `.tmp/order-mobile.png`
- `.tmp/order-partial-permission.png`

## 12. 真实接入阻塞

生产接入仍阻塞于：

1. 真实订单只读 endpoint；
2. 真实 MCP URL/command 与宿主节点凭据引用；
3. 来源系统 ACL 与工作区成员映射；
4. 真实物理字段映射和状态字典；
5. 数据新鲜度、最大扫描量、速率限制和熔断；
6. 生产数据源的列级脱敏与 SQL/API 层 RLS；
7. 真实账号、真实权限范围和 GUI E2E。

在以上条件满足前，生产模式必须保持不可用，不得用 demo 结果替代。

## 13. 剩余风险

- 当前 Mock OMS 以 `orders[]` MCP 工具结果和 stdio 为主；真实 OMS 可能使用 Streamable HTTP、分页游标和不同的鉴权 header。
- 演示数据生成的分布只用于口径验证，不代表真实业务比例。
- member 部分权限策略是 MVP 示例，真实组织需要由数据管理员按组织/区域配置。
- 工作台只迁移了订单履约卡；其他经营指标仍是演示种子。
- HTML 仍复用现有报告渲染器，未新增 ZIP 资产打包。
- 未做完整跨浏览器矩阵。
