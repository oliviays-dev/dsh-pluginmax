# 手机/平板成品供应链订单异常 Demo 录制脚本

> 文档版本：v1.0  
> 日期：2026-10-30  
> 业务场景：手机/平板成品仓订单异常与履约再平衡  
> 目标时长：约 9–12 分钟  
> 数据基础：现有 `orders-facts` 订单数据集与订单异常 MVP  
> 上游需求：[Data Agent 通用数据问询 PRD · 15.2 订单 MVP](../data-agent-general-query-prd.md)
> 通用准备流程：[Demo 场景准备 SOP](./demo-preparation-sop.md)

## 1. 场景定位

这是一个消费电子成品供应链案例，不涉及生鲜、冷链或温控。

产品为智能手机和平板电脑，履约链路为：

```text
华东成品仓 / 备用成品仓
        ↓
SKU 分配与库存归属
        ↓
IMEI / SN 绑定
        ↓
订单改派与仓间调拨
        ↓
保价运输与身份核验签收
        ↓
发票、售后与订单闭环
```

本案例只回答三类订单异常：

- 支付失败；
- 取消；
- 履约超时。

Data Agent 可以判断订单异常的规模、构成、区域、品类、渠道、商家、支付方式和金额影响。它不能仅凭现有订单数据判断具体 SKU 缺货、IMEI/SN 未绑定或某成品仓作业异常，这些事实由人工仓配回执补充。

## 2. 一句话故事

供应链运营总监林岚在驾驶舱发现华东手机/平板订单异常，使用 Data Agent 完成初步判断并创建任务指派给订单履约计划员周宁；周宁在工作台接单后，进一步拆解异常，一个三级任务派给华东成品仓配负责人王工，另一个三级任务派给履约 AI 伙伴；王工确认 SKU、IMEI/SN 和跨仓履约条件，AI 伙伴生成成品仓订单再平衡工单草稿，周宁确认后创建工单；下班前周宁把复盘报告留给 AI 伙伴，第二天早上验收作业并完成闭环。

## 3. 固定演示数据

本场景使用一份确定性订单 fixture：

```text
今天 · 华东 · 数码
订单量：1,658 单
异常量：126 单
异常率：7.6%
支付失败：52 单
取消：31 单
履约超时：43 单
订单金额：¥8,420,218
异常订单金额：¥642,748
近 7 天订单准时履约率：94.1%
较前 7 天：-1.8pt
```

订单异常口径：

```text
订单异常 v1 = 支付失败 + 取消 + 履约超时
按订单 ID 去重
退款和金额异常不进入默认异常口径
```

手机和平板在现有数据模型中由 `category=digital` 承载。演示不增加 SKU、IMEI/SN、库存或 WMS 数据字段。

## 4. 配套文件

| 文件 | 用途 |
| --- | --- |
| [scenario.yaml](./phone-tablet-order-demo/scenario.yaml) | 账号、任务、业务结果、固定指标 |
| [orders-fixture.json](./phone-tablet-order-demo/orders-fixture.json) | 8,358 行确定性订单数据 |
| [generate-orders-fixture.mjs](./phone-tablet-order-demo/generate-orders-fixture.mjs) | 按录制日期重新生成 fixture |
| [data-agent-prompts.md](./phone-tablet-order-demo/data-agent-prompts.md) | Data Agent 三轮提示词和预期输出 |
| [fulfillment-partner-prompt.md](./phone-tablet-order-demo/fulfillment-partner-prompt.md) | 履约 AI 伙伴 SOUL、任务和夜间计划 |
| [task-message-copy.md](./phone-tablet-order-demo/task-message-copy.md) | 任务描述、验收、回执和最终结论 |
| [rebalance-work-order.json](./phone-tablet-order-demo/rebalance-work-order.json) | 37 单成品仓再平衡工单草稿与回执 |
| [report-draft.md](./phone-tablet-order-demo/report-draft.md) | 正式复盘报告基准文案 |
| [workbench-profile.yaml](./phone-tablet-order-demo/workbench-profile.yaml) | 工作台可见模块和手机/平板业务文案 |
| [mock-mcp-assets.yaml](./phone-tablet-order-demo/mock-mcp-assets.yaml) | OMS / WMS Mock MCP 资产注册声明 |
| [mock-oms-mcp-server.mjs](./phone-tablet-order-demo/mock-oms-mcp-server.mjs) | 标准 MCP 只读 OMS mock |
| [mock-wms-mcp-server.mjs](./phone-tablet-order-demo/mock-wms-mcp-server.mjs) | 标准 MCP Mock WMS 与建单工具 |
| [developer-change-prompt.md](./phone-tablet-order-demo/developer-change-prompt.md) | 录制前需完成的系统改造 Prompt |

## 5. 已完成的系统改造

以下能力已落在独立 Demo 插件中，正式插件不依赖 Demo fixture、MCP 资产或业务文案。

- 插件：`plugins/dsh-collab-demo-phone-tablet-order`
- 通用多 MCP Provider 注册表：`plugins/dsh-collab-resource-market/src/mcp-registry.ts`
- 通用任务详情 slot：`pluginmax.task.detail.extension`
- 通用工作台显示 Profile：`dsh-collab-workbench.registerDisplayProfile`

### 5.1 必须调整

1. **安装独立 Demo 插件**  
   Demo 数据、Mock MCP、任务动作和工作台 Profile 位于独立插件 `dsh-collab-demo-phone-tablet-order`，仅通过 `PLUGINMAX_ENABLE_PHONE_TABLET_DEMO=1` 安装，不写入正式订单插件。

2. **按正常 MCP 注册两个外部系统**  
   新增独立 `McpCatalogProvider`，在资源市场注册：

   - `mcp-orders-phone-tablet-demo`：标准只读 OMS MCP；
   - `mcp-wms-phone-tablet-demo`：标准 Mock WMS MCP。

   两个系统都必须走 `initialize / tools/list / tools/call`，连接状态由 provider 返回，不能用静态 seed 冒充连接。

3. **通过 MCP 工具完成人工确认后的建单**  
   AI 伙伴只允许调用 `wms_rebalance_work_order_create`；WMS server 校验签名 Action Ticket、人工确认、调用方和幂等键。Demo HTTP 路由只负责人工确认与回执展示，不直接写业务数据。

4. **隔离工作台显示 Profile**  
   通过独立 Demo 插件隐藏“供给例外”和“供应商风险”，不能修改正式工作台默认内容，也不能把阀体、伺服电机、连接器、铜材写入手机/平板 `record`。

完整开发要求、接口、验收标准和测试命令见：

[developer-change-prompt.md](./phone-tablet-order-demo/developer-change-prompt.md)

### 5.2 不需要调整

- 不需要新增订单异常指标；
- 不需要新增 QueryRun 或 Data Agent 工具；
- 不需要把 Data Agent 改成写系统；
- 不需要新增 SKU、库存或采购数据域；
- 不需要新增父任务/子任务数据库关系，使用 `PT-ORD-001` 前缀和任务描述关联即可。
- 不需要修改正式 Mock OMS 来读取 Demo fixture。
- 不需要为 Data Agent 增加 WMS 写工具。

拆卸要求：

- 移除 Demo 插件后，正式应用可正常启动；
- 资源市场不再出现两个 Demo MCP；
- 任务详情 extension slot 为空但不报错；
- 工作台恢复正式默认模块；
- 正式代码不 import Demo 包，不读取 Demo fixture 或 Demo YAML。

两个 Mock MCP Server 已用标准 MCP Client 验证：

- OMS `tools/list` 返回 `orders_health`、`orders_query`；
- OMS 查询华东数码当天返回 1,658 行，`scannedRows=8358`，`demo=true`；
- WMS `tools/list` 返回 health、get 和 create 三个工具；
- WMS 建单返回 `WO-RB-DEMO-1030-017`、37 单、`mock=true`；
- 同一 `idempotencyKey` 重复调用返回同一工单；
- WMS `get` 可以读回已创建工单。

## 6. 系统数据准备

### 6.1 当期 fixture

Demo 插件启动时会按当天 10:05（Asia/Shanghai）生成独立运行时快照，并只写入 `.tmp/dsh-phone-tablet-demo/orders-fixture-runtime.json`。如需单独检查生成器：

```sh
cd /Users/oliviayang/Codex/一切皆插件/dsh-pluginmax

node plugins/dsh-collab-demo-phone-tablet-order/scripts/generate-orders-fixture.mjs \
  --out .tmp/phone-tablet-fixture-check.json \
  --now "$(TZ=Asia/Shanghai date +%Y-%m-%dT02:05:00.000Z)"
```

终端应输出：

```text
orderCount: 1658
exceptionCount: 126
exceptionRate: 7.6
paymentFailureCount: 52
cancelledCount: 31
fulfillmentTimeoutCount: 43
currentOnTimeRate: 94.1
previousOnTimeRate: 95.9
deltaPt: -1.8
```

如果数字不一致，停止录制并检查 fixture 或查询时区。

### 6.2 准备独立演示环境

建议使用独立 `DSH_HOME`，不要复用日常开发数据：

```sh
cd /Users/oliviayang/Codex/一切皆插件/dsh-pluginmax

export DEMO_HOME="$PWD/.tmp/phone-tablet-demo-home"
export DEMO_PORT="33130"
export PLUGINMAX_ENABLE_PHONE_TABLET_DEMO="1"

DSH_HOME="$DEMO_HOME" \
PLUGINMAX_ENABLE_PHONE_TABLET_DEMO="$PLUGINMAX_ENABLE_PHONE_TABLET_DEMO" \
./scripts/install-profile.sh

DSH_HOME="$DEMO_HOME" \
PLUGINMAX_ENABLE_PHONE_TABLET_DEMO="$PLUGINMAX_ENABLE_PHONE_TABLET_DEMO" \
PLUGINMAX_WORKBENCH_DEMO_PROFILE="phone-tablet-order-v1" \
node vendor/deepseek-harness/apps/cli/lib/bin.js \
  --profile pluginmax \
  --no-open \
  --port "$DEMO_PORT"
```

从启动日志中取得带 token 的 `dsh web:` 地址并在浏览器打开。

### 6.3 创建账号

首次启动后完成初始化，再准备三个账号：

| 账号 | 显示名 | 平台身份 | 工作区身份 | 用途 |
| --- | --- | --- | --- | --- |
| `linlan` | 林岚 | 供应链运营总监 | Owner | 老板视角、创建父任务 |
| `zhouning` | 周宁 | 订单履约计划员 | Member | 执行层主视角 |
| `wangong` | 王工 | 华东成品仓配负责人 | Member | 人工仓配核实 |

操作：

1. 使用 `linlan` 完成首个账号初始化。
2. 进入设置中的账号管理，创建 `zhouning` 和 `wangong`，演示密码统一使用 `password-123`。
3. 不要给三个账号设置平台管理员身份；只通过工作区 Owner/Member 区分权限。
4. 准备两个独立浏览器用户目录或至少两个浏览器窗口，减少录制时反复退出登录。

### 6.4 创建项目并添加成员

1. 使用 `linlan` 登录。
2. 在左侧“项目 / Workspaces”区域点击 `+`，创建项目：

   ```text
   手机平板订单履约演示
   ```

3. 将 `zhouning`、`wangong` 添加为 Member。
4. 确认 `linlan` 为 Owner。
5. 确认任务页“项目（必填）”下拉中可以选中该项目。

### 6.5 连接两个 Mock MCP

1. 点击左侧“资源市场”。
2. 选择顶部 `MCP` 页签。
3. 搜索“手机平板订单”，找到“Mock 手机平板订单管理系统”，查看详情并连接。
4. 搜索“手机平板成品仓”，找到“Mock 手机平板成品仓 WMS”，查看详情并连接。
5. 两个连接都应显示 provider 返回的“已连接”状态，而不是静态 seed 状态。
6. 返回工作台，点击核心指标刷新。
7. 确认“订单准时履约率”显示 `94.1%`，趋势为 `-1.8pt`，数据来源标志包含“演示数据 · 非生产”。

如果仍显示 `0.0%`，检查：

- Demo MCP Provider 是否启用；
- `ORDERS_DEMO_FIXTURE_PATH` 是否传入 Demo OMS MCP server；
- fixture 中是否包含过去 7 天的数据；
- 两个 Demo MCP 是否在当前用户下已连接；
- 工作区数据权限是否正确。

### 6.6 验证 Data Agent

1. 点击页面右上角 Data Agent 按钮。
2. 选择工作区“手机平板订单履约演示”。
3. 点击“新会话”。
4. 使用 [data-agent-prompts.md](./phone-tablet-order-demo/data-agent-prompts.md) 的第 1 个提示词做一次预演。
5. 确认返回 126 / 7.6% / 52 / 31 / 43。
6. 确认 brief 中包含 QueryRun、数据截止时间、权限覆盖和“演示、非生产”。
7. 预演结束后新建会话，正式录制不要复用预演对话。

### 6.7 创建履约 AI 伙伴

使用 `zhouning` 登录：

1. 点击左侧“AI伙伴”。
2. 点击“新建 AI伙伴”。
3. 名称填写：

   ```text
   履约 AI 伙伴
   ```

4. 选择现有流程跟进或通用执行型模版；不要新建一套 Agent Runtime。
5. 将 [fulfillment-partner-prompt.md](./phone-tablet-order-demo/fulfillment-partner-prompt.md) 中的 SOUL 写入定义。
6. 确保实例状态为“生效”。
7. 在任务指派下拉的“DE / 分身”分组中确认可以选择“履约 AI 伙伴”。

### 6.8 准备次日录制材料

夜间报告不要在录制当天从零等待生成。建议分两段录制：

1. 第一段录制当天管理发现、问询、父任务、两个三级任务、人工回执和业务工单。
2. 预演一次夜间工作计划，确保 AI 伙伴能生成报告并进入“待确认”。
3. 第二段在第二天或隔一个录制时段展示“待确认”报告、周宁验收和老板驾驶舱最终结论。

如果 Agent 实际输出波动，以 [report-draft.md](./phone-tablet-order-demo/report-draft.md) 作为验收基准，不要把未生成的内容说成已经生成。

## 7. 录制步骤

### 场景 1：老板发现异常

建议时长：40 秒

**画面**

- 使用 `linlan` 登录。
- 打开“工作台”。
- 将浏览器窗口控制在 1440 × 900，页面缩放 100%–110%，确保核心指标在首屏。

**操作**

1. 鼠标停留在“核心指标”。
2. 指向“订单准时履约率 94.1%”。
3. 指向趋势 `-1.8pt`。
4. 停留 2 秒，让观众看清数据来源“演示数据 · 非生产”。

**预期效果**

- 核心指标显示 94.1%；
- 趋势显示 -1.8pt；
- 不出现 0.0%；
- 画面中不出现高压阀体、伺服电机、冷链等无关内容。

**说明文案**

> 对供应链负责人来说，最先看到的不是一条孤立数字，而是订单准时履约率跌破近期基线。这个异常需要继续拆到区域、品类和异常类型，所以林岚直接从工作台发起 Data Agent 问询。

### 场景 2：Data Agent 初步判断

建议时长：75 秒

**操作**

1. 点击右上角 Data Agent。
2. 确认工作区为“手机平板订单履约演示”。
3. 点击“新会话”。
4. 粘贴 [data-agent-prompts.md](./phone-tablet-order-demo/data-agent-prompts.md) 第 1 个提示词。
5. 点击发送。
6. 等待查询完成，不要连续追问。
7. 滚动 brief，依次露出异常构成、口径、数据截止时间和 QueryRun。

**预期效果**

```text
1,658 单
126 单异常
7.6%
支付失败 52
取消 31
履约超时 43
```

同时显示：

- 华东、华南有权限；
- 华北、西南未覆盖；
- 演示数据、非生产；
- QueryRun 和指标版本；
- 订单事实不等于具体 SKU 或缺货原因。

**说明文案**

> Data Agent 先识别授权数据范围，再调用订单异常指标。它告诉我们这是支付失败、取消和履约超时叠加的混合异常，而不是单一原因。更重要的是，结论带着口径、截止时间和 QueryRun 证据，并且明确不会根据订单字段猜测具体 SKU 或序列号问题。

### 场景 3：老板创建父任务

建议时长：60 秒

**操作**

1. 关闭 Data Agent 侧栏。
2. 点击左侧“任务”。
3. 点击“新建任务”。
4. 在“派发任务 / Issue”中按 [task-message-copy.md](./phone-tablet-order-demo/task-message-copy.md) 填写父任务。
5. 项目选择“手机平板订单履约演示”。
6. 优先级选择 `P0`。
7. 责任人选择“周宁”。
8. 到期时间选择当天。
9. 描述和验收标准使用固定文案。
10. 点击“派发”。

**预期效果**

- 任务卡出现在“待处理”列；
- 标题前缀为 `[PT-ORD-001]`；
- 责任人显示周宁；
- 任务描述出现 Data Agent brief 摘要或引用。

**说明文案**

> 老板不需要自己处理到订单级。她把问题、证据上下文和验收标准交给履约计划员。注意，任务传递的是问题与证据引用，不是林岚的数据权限；周宁后续查询时仍按自己的权限范围取数。

### 场景 4：员工在工作台接单

建议时长：45 秒

**操作**

1. 切换到 `zhouning` 浏览器窗口。
2. 打开“工作台”。
3. 找到“我的待办”中的 `[PT-ORD-001]`。
4. 点击任务标题进入任务详情。

**预期效果**

- “我的待办”出现该任务；
- 任务来源和责任人清晰；
- 点击后进入任务详情，而不是丢失工作台位置。

**说明文案**

> 异常在这里从老板的关注变成了员工的待办。周宁看到的是同一异常编号和同一验收标准，不需要重新问老板发生了什么。

### 场景 5：执行层深入评估

建议时长：60 秒

**操作**

1. 在任务详情中打开 Data Agent。
2. 使用 [data-agent-prompts.md](./phone-tablet-order-demo/data-agent-prompts.md) 第 2 个提示词。
3. 等待返回。
4. 鼠标依次指向“支付失败”“履约超时”“需人工核实原因”和“两路执行建议”。

**预期效果**

- 保留上一轮时间范围和异常口径；
- 仍为 126 单、7.6%；
- 按支付方式、渠道、商家、状态拆分；
- 区分订单事实和待人工核实原因；
- 建议王工核实仓配，履约 AI 伙伴整理和模拟。

**说明文案**

> 这一步把分析结果变成可执行分工。订单数据可以告诉我们异常在哪里集中，但不能替仓配确认 SKU、序列号和实物库存。因此一个是人工核实任务，一个是 AI 整理和方案模拟任务。

### 场景 6：创建一个人工任务和一个 AI 任务

建议时长：90 秒

#### 人工三级任务

1. 点击“新建任务”。
2. 按 [task-message-copy.md](./phone-tablet-order-demo/task-message-copy.md) 创建 `[PT-ORD-001-A]`。
3. 责任人选择“王工”。
4. 优先级 `P0`，初始状态“待处理”。
5. 点击“派发”。

#### AI 三级任务

1. 再次点击“新建任务”。
2. 按 [task-message-copy.md](./phone-tablet-order-demo/task-message-copy.md) 创建 `[PT-ORD-001-B]`。
3. 责任人选择“DE / 分身”中的“履约 AI 伙伴”。
4. 勾选“自动提交 review”。
5. 勾选“写文件、执行命令和外部发布前需要人工确认”。
6. 优先级 `P0`。
7. 点击“派发”。

**预期效果**

- 任务列表同时出现 `[PT-ORD-001-A]` 和 `[PT-ORD-001-B]`；
- 王工任务显示责任人王工；
- AI 任务显示履约 AI 伙伴；
- AI 任务的业务动作在人工确认前只能是草稿。

**说明文案**

> 这里的核心不是把任务越拆越多，而是把人工必须负责的判断和 AI 可以承接的工作分开。王工负责实物、序列号和仓配约束；AI 伙伴负责整理 126 单、模拟再平衡、生成工单草稿。

### 场景 7：王工提交仓配回执

建议时长：55 秒

**操作**

1. 切换到 `wangong` 浏览器窗口。
2. 打开“工作台”，进入 `[PT-ORD-001-A]`。
3. 点击“开始”。
4. 在任务消息区粘贴 [task-message-copy.md](./phone-tablet-order-demo/task-message-copy.md) 的“任务消息回执”。
5. 点击“提交验收”。
6. 切换回 `zhouning`，打开该任务并点击“通过”。

**预期效果**

```text
37 单可跨仓再平衡
原履约仓缺少完整序列号库存
出库前绑定 IMEI/SN
库存归属变更
保价运输与本人签收
17:00 前完成交接
```

**说明文案**

> 这条回执把订单异常和真实仓配约束连接起来。手机和平板不是只看有没有货，还要确认 SKU、IMEI/SN、库存归属和高货值交付条件。AI 后续生成的工单必须受这些人工事实约束。

### 场景 8：AI 伙伴生成工单草稿

建议时长：60 秒

**操作**

1. 以 `zhouning` 打开 `[PT-ORD-001-B]`。
2. 等待 AI 伙伴完成，任务进入“待验收 / 待Review”。
3. 打开任务产出或业务动作卡。
4. 滚动查看订单范围、SKU/序列号约束、库存归属、源仓/目标仓、17:00 截止和“草稿”状态。

**预期效果**

```text
成品仓订单再平衡工单
订单范围：37 单
预计影响金额：¥194,125
状态：草稿，等待周宁确认
```

**说明文案**

> AI 已经把 126 单里的 37 单整理成可执行的再平衡方案，但它停在草稿。因为创建业务单据会改变库存和订单履约状态，必须由人类确认。

### 场景 9：人工确认并创建业务工单

建议时长：50 秒

**操作**

1. 点击“确认并创建”。
2. 在二次确认弹窗中核对：

   ```text
   37 单
   华东备用成品仓 → 华东履约仓
   当日 17:00 截止
   Mock WMS · MCP · 演示动作 · 非生产
   ```

3. 点击确认。

**预期效果**

```text
WO-RB-DEMO-1030-017 创建成功
确认人：周宁
操作者：履约 AI 伙伴
审计引用：AT-PT-ORD-001-B
```

**说明文案**

> 这是本 Demo 的关键闭环：Data Agent 负责只读判断，履约 AI 伙伴负责整理和生成草稿，人类确认后，AI 才在授权范围内创建业务单据。整个过程保留确认人和审计引用。

补充分镜叠字：

```text
标准 MCP：tools/call → wms_rebalance_work_order_create
Action Ticket：AT-PT-ORD-001-B
幂等键：PT-ORD-001-B
```

### 场景 10：人工收尾，给 AI 留下夜间计划

建议时长：70 秒

**操作**

1. 以 `zhouning` 打开“AI伙伴”。
2. 选择“履约 AI 伙伴”。
3. 打开“工作计划”。
4. 粘贴 [fulfillment-partner-prompt.md](./phone-tablet-order-demo/fulfillment-partner-prompt.md) 的夜间工作计划提示词。
5. 项目选择“手机平板订单履约演示”。
6. 优先级 `P1`。
7. 截止日期设置为次日。
8. 勾选“自动提交 review”。
9. 点击“创建计划项”。

**预期效果**

- 计划项创建成功；
- AI 伙伴开始或排队执行；
- 夜间任务只允许读取回执、整理报告和提交待确认；
- 不允许修改业务单据或对外发送。

**说明文案**

> 人类下班前并没有从零写报告，她把“基于同一证据完成复盘”变成了 AI 伙伴的工作计划。这不是让 AI 替人做决定，而是把可自动化的整理工作留到非工作时段。

### 场景 11：第二天早上验收 AI 作业

建议时长：75 秒

**操作**

1. 打开 AI伙伴，“履约 AI 伙伴”。
2. 进入“工作计划”或“当前工作”，找到 `[PT-ORD-001-C]` 的“待确认”。
3. 打开报告，按 [report-draft.md](./phone-tablet-order-demo/report-draft.md) 核对：

   ```text
   126 单异常
   83 单恢复履约
   43 单退款、取消或改约
   37 单通过 WO-RB-DEMO-1030-017 再平衡
   ```

4. 在验收说明中写入 [task-message-copy.md](./phone-tablet-order-demo/task-message-copy.md) 的“报告验收说明”。
5. 点击“通过”。
6. 回到父任务 `[PT-ORD-001]`，写入父任务结论，点击“提交验收”。
7. 切换到 `linlan`，打开父任务，点击“通过”。
8. 回到工作台，展示最终状态。

**预期效果**

- AI 任务从“待确认”转为“已完成”；
- 父任务由周宁提交、林岚验收后转为“已完成”；
- 报告保留同一 QueryRun 和业务工单证据；
- 老板驾驶舱或每日简报展示最终结论。

**说明文案**

> 第二天早上，周宁不是重新查一遍数据，而是验收 AI 基于同一批证据生成的报告。她确认数字、补充客户沟通说明，再把父任务交给林岚验收。这样，管理发现、数据分析、人机执行、业务写单和报告归档形成了完整闭环。

## 8. 录制剪辑建议

### 8.1 必须保留的真实证据

- Data Agent 返回异常数字；
- QueryRun、数据截止时间、口径和权限摘要；
- 任务责任人；
- AI 任务“草稿”状态；
- 人工确认人和业务工单号；
- AI 报告“待确认”状态；
- 周宁通过报告；
- 父任务完成。

### 8.2 可以剪辑等待

- Data Agent 查询等待；
- Agent 执行等待；
- 账号切换；
- 表单重复填写。

剪辑时使用真实状态变化，不要用一个静态截图冒充动态执行。若 Agent 输出内容有差异，保留真实输出并在剪辑中叠字说明“输出以现场运行结果为准”，不要伪造审计字段。

### 8.3 推荐镜头节奏

| 场景 | 时长 | 镜头重点 |
| --- | ---: | --- |
| 老板发现异常 | 15–25 秒 | 94.1%、-1.8pt、Data Agent 入口 |
| 初步 brief | 30–45 秒 | 126 / 52 / 31 / 43、QueryRun |
| 创建父任务 | 30 秒 | 责任人、验收标准 |
| 员工接单 | 20–30 秒 | 我的待办、同一任务编号 |
| 深入评估 | 30–45 秒 | 人机分工、限制说明 |
| 人工回执 | 30–40 秒 | SKU、IMEI/SN、库存归属 |
| AI 工单草稿 | 30–40 秒 | 37 单、草稿、待确认 |
| 人工确认建单 | 20–30 秒 | 工单号、审计引用 |
| 夜间计划 | 30–40 秒 | 截止日期、自动提交 review |
| 次日验收 | 30–45 秒 | 待确认、报告、通过 |
| 最终结论 | 15–20 秒 | 126 单闭环 |

## 9. 录制前检查清单

- [ ] 订单 fixture 已按录制当天时间重新生成。
- [ ] 工作台订单准时履约率显示 94.1%，不是 0.0%。
- [ ] 趋势显示 -1.8pt。
- [ ] Data Agent 返回 126 / 7.6% / 52 / 31 / 43。
- [ ] Data Agent 标记演示、非生产。
- [ ] 权限覆盖显示华东、华南，未覆盖华北、西南。
- [ ] 工作台不出现高压阀体、伺服电机、冷链等冲突内容。
- [ ] 三个账号均可用，项目和成员关系正确。
- [ ] 履约 AI 伙伴状态为生效。
- [ ] 人工三级任务只有一个，AI 三级任务只有一个。
- [ ] AI 建单前状态为草稿。
- [ ] 人工确认后返回 `WO-RB-DEMO-1030-017`。
- [ ] 夜间计划自动提交 review。
- [ ] 次日报告处于待确认，而不是直接完成。
- [ ] 父任务最终由林岚验收完成。

## 10. 当前系统限制与录制口径

在开发改造完成前，必须按以下方式表述：

| 当前能力 | 可录制内容 | 不可使用的话术 |
| --- | --- | --- |
| 内置订单 mock 只有 567 行 | 可演示查询流程，但无法得到脚本固定数字 | 不能说“126 单”“OTIF 94.1%” |
| 无 Demo WMS MCP | 只能展示工单草稿 | 不能说“已通过 MCP 创建到 Mock WMS” |
| 工作台仍有制造业 seed | 只能裁切画面或避免展示下方模块 | 不能把阀体、冷链说成手机/平板业务 |
| Agent 输出可能波动 | 保留真实输出，验收固定事实 | 不能伪造 QueryRun 或审计号 |

因此，正式录制前必须完成 [developer-change-prompt.md](./phone-tablet-order-demo/developer-change-prompt.md) 中的独立插件、MCP 注册、MCP 建单和显示 Profile 四项改造。
