# 手机/平板成品供应链订单异常 Demo 录制脚本

> 文档版本：v3.0
> 日期：2026-11-03
> 业务场景：手机/平板成品仓订单异常与履约再平衡
> 目标时长：约 14 分钟
> 数据基础：`orders-facts` + 独立 Demo fixture + 标准 OMS / WMS MCP
> 通用准备流程：[Demo 场景准备 SOP](./demo-preparation-sop.md)

## 1. 录制状态

本脚本已经按当前工作区的任务详情、Data Agent、AI伙伴 1:1、Resource Market
和 MCP 链路更新。

正式录制前仍有三个阻塞项：

1. Demo 工作台配置仍选择四张指标卡，其中“采购价格达成”出现连接器和铜材，
   与手机/平板成品订单场景冲突。
2. “运行时设置”的 Provider 下拉没有独立 `CodeBuddy` 选项。服务端进程适配器已支持
   `provider=codebuddy`，但创建运行时接口和页面还没有放行。
3. AI伙伴 1:1 可以调用外部 Runtime，但当前运行结果只写回文本；
   外部进程生成的文件没有 artifact 协议，AI 回复也没有附件参数。

第 2、3 项未修复时，不进入正式录制；不能用“本地文件路径”或人工上传冒充
“AI 在对话里返回报告”。具体改造要求见
[developer-change-prompt.md](./phone-tablet-order-demo/developer-change-prompt.md)。

已核对完成、不要继续按旧文档重复开发：

- 任务详情业务扩展区已可见；
- Demo 工作区 owner / member 自动连接已按 `memberRole` 工作；
- 独立 Demo 插件、MCP provider、Action Ticket 和幂等已经落地。

## 2. 场景定位

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

Data Agent 只回答订单异常规模、构成、区域、品类、渠道、商家、支付方式和金额影响。
SKU、IMEI/SN、库存和仓配作业事实由李工的人工回执补充。

## 3. 一句话故事

林岚在工作台看到华东手机/平板订单准时履约率下降，创建父任务给订单履约计划员周宁。
周宁用 Data Agent 完成只读异常判断，创建一个给李工的人工任务，以及一个给履约 AI
伙伴的 AI 任务。李工提交成品仓约束，周宁人工确认后由平台通过标准 MCP 创建 Mock
WMS 工单。回执齐备后，周宁在与“周宁的AI小助理”的 1:1 沟通中，让 CodeBuddy
生成图文并茂的单文件 HTML 管理报告。报告作为 1:1 附件返回，周宁下载核对后手工上传
父任务并提交林岚 Review，最终由林岚通过。

业务结构严格保持：

- 人工三级任务：`[PT-ORD-001-A]`，责任人李工；
- AI 三级任务 B：`[PT-ORD-001-B]`，责任人履约 AI 伙伴；
- 第二个业务 AI 伙伴：`周宁的AI小助理`，通过 1:1 沟通完成管理报告，不承接三级任务；
- 不创建 `[PT-ORD-001-C]`；
- Data Agent 是平台内置只读身份，不占两个业务 AI 伙伴名额；
- AI伙伴“工作日报”只作为实例摘要，不冒充新的任务或任务验收。

## 4. 固定演示数据

fixture 共 8,358 行，查询范围：

```text
录制日 · 华东 · 数码
```

固定指标：

```text
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
前 7 天准时率：95.9%
```

订单异常口径：

```text
订单异常 v1 = 支付失败 + 取消 + 履约超时
按订单 ID 去重
退款和金额异常不进入默认异常口径
```

业务回执对账：

```text
126 = 83 恢复履约 + 43 退款/取消/改约
83 = 46 支付恢复 + 37 成品仓再平衡
37 单草稿金额 = ¥194,125
```

手机和平板由现有 `category=digital` 和“数码”显示别名承载。
Demo 不新增 SKU、IMEI/SN、库存或 WMS 数据字段。

`WO-RB-DEMO-1030-017` 是当前代码与 fixture 的固定 Demo 契约 ID；
其中 `1030` 不用于证明录制日期。录制日期以 QueryRun 的 `dataCutoffAt` 为准。

## 5. 权限口径

当前订单 Data Fabric 只注册了 Member 行级策略：

```text
policy: orders-member-region-scope
rowScope: region=华东、华南
coverage: 华北、西南未覆盖
```

Owner 使用默认工作区范围，不会自动继承 Member 的区域限制。

因此：

- Data Agent 权限镜头使用周宁；
- 林岚只负责管理视角和父任务验收；
- 不能把 Owner 的权限摘要说成“仅华东、华南”；
- 未覆盖区域不能按 0 异常处理。

## 6. 配套文件

| 文件                                                                                     | 用途                                       |
| ---------------------------------------------------------------------------------------- | ------------------------------------------ |
| [scenario.yaml](./phone-tablet-order-demo/scenario.yaml)                                 | 账号、任务、权限、业务结果和固定指标       |
| [orders-fixture.json](./phone-tablet-order-demo/orders-fixture.json)                     | 8,358 行确定性订单数据                     |
| [generate-orders-fixture.mjs](./phone-tablet-order-demo/generate-orders-fixture.mjs)     | 按录制时间生成 fixture                     |
| [data-agent-prompts.md](./phone-tablet-order-demo/data-agent-prompts.md)                 | Data Agent 两轮问询和证据交接               |
| [fulfillment-partner-prompt.md](./phone-tablet-order-demo/fulfillment-partner-prompt.md) | 履约 AI 伙伴 SOUL、B 任务和工作日报        |
| [ai-assistant-soul.md](./phone-tablet-order-demo/ai-assistant-soul.md)                   | 管理报告型 AI 小助理的可复用 SOUL          |
| [ai-assistant-prompt.md](./phone-tablet-order-demo/ai-assistant-prompt.md)               | CodeBuddy 运行时、1:1 提示词和附件验收      |
| [项目资料索引](./phone-tablet-order-demo/project-inputs/phone-tablet-order/00-手机平板订单异常-资料索引.md) | Agent 读取边界和三份资料的路由 |
| [B 履约证据包](./phone-tablet-order-demo/project-inputs/phone-tablet-order/PT-ORD-001-B-履约证据包.md) | B 任务的项目内只读证据 |
| [RPT 管理报告证据包](./phone-tablet-order-demo/project-inputs/phone-tablet-order/PT-ORD-001-RPT-管理报告证据包.md) | 小助理 1:1 报告的项目内证据 |
| [task-message-copy.md](./phone-tablet-order-demo/task-message-copy.md)                   | 任务字段、回执、动作卡、报告上传和 Review   |
| [rebalance-work-order.json](./phone-tablet-order-demo/rebalance-work-order.json)         | 37 单工单草稿与回执                        |
| [report-draft.md](./phone-tablet-order-demo/report-draft.md)                             | AI 小助理生成的 HTML 内容与视觉基准         |
| [workbench-profile.yaml](./phone-tablet-order-demo/workbench-profile.yaml)               | 目标工作台 Profile，只显示订单履约指标     |
| [mock-mcp-assets.yaml](./phone-tablet-order-demo/mock-mcp-assets.yaml)                   | OMS / WMS MCP 资产与验证声明               |
| [mock-oms-mcp-server.mjs](./phone-tablet-order-demo/mock-oms-mcp-server.mjs)             | 标准只读 OMS MCP                           |
| [mock-wms-mcp-server.mjs](./phone-tablet-order-demo/mock-wms-mcp-server.mjs)             | 标准 WMS MCP，校验票据与幂等               |
| [developer-change-prompt.md](./phone-tablet-order-demo/developer-change-prompt.md)       | 录制阻塞项和正式代码改造要求               |

运行资产位于独立插件：

```text
plugins/dsh-collab-demo-phone-tablet-order
```

## 7. 当前实现与旧版差异

| 项目            | 旧版           | 当前录制口径                                                     |
| --------------- | -------------- | ---------------------------------------------------------------- |
| 安装            | 待开发独立插件 | 独立插件已存在，通过 `PLUGINMAX_ENABLE_PHONE_TABLET_DEMO=1` 安装 |
| Data Agent      | 可生成正式报告 | 本场景只做两轮只读 brief；报告改由外部 AI 小助理生成             |
| 任务详情        | 旧消息区       | 双栏详情，统一输入区区分“讨论 / 指令”                            |
| 优先级          | 文档混用 P0/P1 | 画面显示 P0，存储和 API 写 P1                                    |
| Resource Market | 直接显示已连接 | provider 返回 connected 后立即更新，失败不得乐观显示成功          |
| 任务扩展区      | 被 hidden 隐藏 | 当前已可见；未安装 Demo 时为空态                                 |
| MCP 自动连接    | 成员字段不匹配 | 当前已按 `memberRole` 为 owner / member 连接 OMS 和 WMS          |
| AI伙伴          | 多个 AI 任务   | 1 个 AI 三级任务 B + 1 个 1:1 AI 小助理；不创建 C 任务           |
| 管理报告        | Data Agent HTML | CodeBuddy 生成单文件 HTML，作为 1:1 附件返回                    |
| 工作台          | 跨行业种子卡   | 当前配置仍为 4 张卡，录制前必须收敛为订单履约指标                |
| Mock WMS        | 内存假成功     | 签名 Action Ticket、consumer 校验、人工确认、持久化幂等          |

### 7.1 旧版到新版差异

1. 删除 `[PT-ORD-001-C]` 和“异常复盘 AI 伙伴”，改为“唯一 AI 三级任务 B +
   周宁的AI小助理 1:1 报告”。
2. 删除 Data Agent 第 3 轮正式报告提示词。Data Agent 只保留两轮只读 brief，
   不再生成本场景的 Markdown 正式报告或 HTML。
3. 管理报告从 Data Agent 模板改为 CodeBuddy 生成的自包含 HTML，报告结构以
   [report-draft.md](./phone-tablet-order-demo/report-draft.md) 为内容基准。
4. 报告交付从“任务里的 Markdown”改为“1:1 AI 消息中的真实 HTML 附件”，
   必须可下载、可离线打开。
5. 报告闭环改为周宁下载检查，手工把同一 HTML 上传林岚创建的父任务，
   再提交林岚 Review。
6. 新增 `周宁的AI小助理` 的可复用 SOUL；SOUL 不声明 owner、固定用户或固定验收人。
7. 仓配负责人账号统一为 `ligong`，不再使用旧版仓配账号 ID。
8. 任务详情扩展区 hidden 和 Demo 成员自动连接字段不匹配已修复，
   不再列为开发待办。
9. 当前新增阻塞是 CodeBuddy Provider 放行和 AI 1:1 文件 artifact 返回；
   在能力未完成前不得正式录制场景 10。

## 8. 独立环境准备

### 8.1 安装 Demo profile

```sh
cd /Users/oliviayang/Codex/一切皆插件/dsh-pluginmax

export DEMO_HOME="$PWD/.tmp/phone-tablet-demo-home-$(TZ=Asia/Shanghai date +%Y%m%d-%H%M)"
export PLUGINMAX_ENABLE_PHONE_TABLET_DEMO="1"
export PLUGINMAX_WORKBENCH_DEMO_PROFILE="phone-tablet-order-v1"
export DEMO_ORDERS_RUNTIME_DIR="$DEMO_HOME/runtime"
export DEMO_WMS_STATE_PATH="$DEMO_HOME/wms/wms-state.json"
export DEMO_ACTION_TICKET_SECRET="local-phone-tablet-demo-action-ticket-v1"

DSH_HOME="$DEMO_HOME" \
PLUGINMAX_ENABLE_PHONE_TABLET_DEMO="$PLUGINMAX_ENABLE_PHONE_TABLET_DEMO" \
./scripts/install-profile.sh
```

检查安装结果：

```sh
rg "dsh-collab-demo-phone-tablet-order" \
  "$DEMO_HOME/profiles/pluginmax/package.json"
```

应包含 `dsh-collab-demo-phone-tablet-order`。

### 8.2 启动独立实例

```sh
DSH_HOME="$DEMO_HOME" \
PLUGINMAX_ENABLE_PHONE_TABLET_DEMO="$PLUGINMAX_ENABLE_PHONE_TABLET_DEMO" \
PLUGINMAX_WORKBENCH_DEMO_PROFILE="$PLUGINMAX_WORKBENCH_DEMO_PROFILE" \
DEMO_ORDERS_RUNTIME_DIR="$DEMO_ORDERS_RUNTIME_DIR" \
DEMO_WMS_STATE_PATH="$DEMO_WMS_STATE_PATH" \
DEMO_ACTION_TICKET_SECRET="$DEMO_ACTION_TICKET_SECRET" \
node vendor/deepseek-harness/apps/cli/lib/bin.js \
  --profile pluginmax \
  --no-open \
  --port 33130
```

从日志取得带 token 的 `dsh web:` 地址。
若端口被占用，换一个未使用端口，不要结束其他人的进程。

### 8.3 生成并检查 fixture

插件启动时会生成独立运行时 fixture。也可以单独检查：

```sh
node plugins/dsh-collab-demo-phone-tablet-order/scripts/generate-orders-fixture.mjs \
  --out "$DEMO_HOME/runtime/fixture-check.json" \
  --now "$(TZ=Asia/Shanghai date +%Y-%m-%dT10:05:00+08:00)"
```

检查 `fixture-check.json` 顶层 `expected`：

```text
orderCount: 1658
exceptionCount: 126
exceptionRate: 7.6
paymentFailureCount: 52
cancelledCount: 31
fulfillmentTimeoutCount: 43
orderAmount: 8420218
exceptionAmount: 642748
currentOnTimeRate: 94.1
previousOnTimeRate: 95.9
deltaPt: -1.8
totalRows: 8358
```

数字不一致时停止录制。

### 8.4 放入项目内只读资料

把插件准备的项目资料复制到当前项目空间，保留以下文件名：

```text
00-手机平板订单异常-资料索引.md
PT-ORD-001-B-履约证据包.md
PT-ORD-001-RPT-管理报告证据包.md
```

资料包是项目工作区内的只读 Markdown，不连接外部网盘、邮件、IM、共享文档或生产系统。
B 任务和小助理必须按文件名直接读取，避免反复申请外部文档授权。
履约 AI 伙伴无需联网；小助理如确有必要，可搜索公开术语、法规或外部背景，
但不得用网页结果替代订单、库存、WMS、客户或仓配事实。

Data Agent 查询成功后，把真实 QueryRun、`dataCutoffAt`、权限摘要和指标版本
分别填入当前项目空间内的以下证据包：

```text
PT-ORD-001-B-履约证据包.md
PT-ORD-001-RPT-管理报告证据包.md
```

未填写时 Agent 只能标记“待补”，不能编造。

## 9. 账号与项目

### 9.1 创建账号

本方案保留 3 个账号。李工不是可选的讲解角色，而是成品仓 SKU、IMEI/SN、
库存归属和签收约束的人工事实来源；去掉他会让 Mock WMS 建单缺少业务控制。
如果现场只允许 2 个账号，可把李工回执改为周宁名下的人工回执，但仍需明确标注为人工提供。

| 账号       | 显示名 | 工作区身份 | 用途                                       |
| ---------- | ------ | ---------- | ------------------------------------------ |
| `linlan`   | 林岚   | Owner      | 管理视角、父任务创建与验收                 |
| `zhouning` | 周宁   | Member     | Data Agent、任务拆解、人工确认和父任务提交 |
| `ligong`   | 李工   | Member     | 仓配核实和人工回执                         |

操作：

1. 使用 `linlan` 完成首个账号初始化。
2. 创建 `zhouning` 和 `ligong`，演示密码统一为 `password-123`。
3. 不设置平台管理员身份。

### 9.2 创建项目

1. 使用 `linlan` 登录。
2. 在左侧“项目”区域创建 `手机平板订单履约演示`。
3. 将 `zhouning`、`ligong` 添加为 Member。
4. 确认任务创建弹窗的“项目（必填）”能选中该项目。

### 9.3 连接 MCP

连接状态按用户保存。至少完成：

- `linlan`：连接 OMS，用于工作台订单指标；
- `zhouning`：连接 OMS 和 WMS，用于 Data Agent 查询与业务动作；
- `ligong`：不要求连接 MCP。

操作：

1. 打开左侧“资源市场”。
2. 选择“MCP”页签。
3. 搜索“Mock 手机平板订单管理系统”。
4. Demo 工作区 owner / member 启动后会自动连接；若状态仍为“未连接”，
   打开详情点击“发起连接”。
5. provider 返回 `connected` 后卡片应立即显示“已连接”，不要求刷新。
6. 搜索“Mock 手机平板成品仓 WMS”，确认同样为“已连接”。

如果状态仍不是“已连接”，停止录制并检查：

- `PLUGINMAX_ENABLE_PHONE_TABLET_DEMO=1`；
- Demo 插件是否在 profile 中；
- provider 是否成功执行 `initialize` 与 `tools/list`；
- 当前登录用户是否独立连接过该资产。

连接成功不是静态 seed，也不是页面本地乐观状态。`pending` 必须保持“待验证”，
不能在此期间开始 Data Agent 查询或 WMS 动作。

## 10. 创建两个业务 AI 伙伴

### 10.1 履约 AI 伙伴

使用 `zhouning`：

1. 打开左侧“AI伙伴”。
2. 进入“AI伙伴管理”。
3. 基于流程跟进或通用执行型个人模版新建实例。
4. 名称填写 `履约 AI 伙伴`，关联项目 `手机平板订单履约演示`。
5. 将 [fulfillment-partner-prompt.md](./phone-tablet-order-demo/fulfillment-partner-prompt.md)
   的建议 SOUL 写入对应的智能体定义。
6. 确认实例为“生效”。

### 10.2 周宁的AI小助理

1. 打开“AI伙伴 → 运行时设置”。
2. 点击“注册运行时”。
3. 创建 `CodeBuddy · 订单管理报告`，Provider 选择 `CodeBuddy`，
   命令填写 `codebuddy`。
4. 工具选择“读取文件 / 写入文件”，文件修改权限选择“自动接受文件修改”。
5. 保存后点击“探测”，确认运行时“启用中”且探测通过。
6. 打开“AI伙伴 → 智能体定义”，创建管理报告型个人模版。
7. 将 [ai-assistant-soul.md](./phone-tablet-order-demo/ai-assistant-soul.md) 的 SOUL 原文写入定义。
8. 回到“AI伙伴管理”，基于该定义创建实例，名称填写 `周宁的AI小助理`。
9. 执行方式选择“外部 Agent”，绑定 `CodeBuddy · 订单管理报告`。
10. 确认实例为“生效”，owner 显示为实际创建人周宁。

业务 AI 伙伴固定为 2 个，但只有一个 AI 三级任务：

| 伙伴             | 载体          | 职责                                           |
| ---------------- | ------------- | ---------------------------------------------- |
| 履约 AI 伙伴     | 任务 B        | 生成再平衡工单草稿                             |
| 周宁的AI小助理 | AI伙伴 1:1    | 基于已确认证据生成并返回 HTML 管理报告         |

Data Agent 是平台内置只读分析身份，不计入这两个业务伙伴。
SOUL 只定义岗位能力，不定义实例 owner、固定服务对象或固定验收人。

## 11. 录制步骤

### 场景 1：老板发现异常

建议时长：35 秒
账号：林岚

**前置条件**

- 工作台 Demo Profile 已收敛为只显示 `otif`；
- OMS 已由林岚连接；
- 当前工作区为 `手机平板订单履约演示`。

**操作**

1. 打开“工作台”。
2. 鼠标停留在“核心指标”。
3. 指向“订单准时履约率 94.1%”。
4. 指向趋势 `-1.8pt`。
5. 停留 2 秒，让“演示数据 · 近 7 天 · 非生产”可见。

**预期效果**

```text
订单准时履约率 94.1%
-1.8pt
演示数据 · 近 7 天 · 非生产
```

画面上不得出现：

```text
连接器
铜材
高压阀体
伺服电机
冷链
生鲜
```

**说明文案**

> 管理视角先看到的是订单准时履约率跌破近期基线。这里不急着把它解释成缺货，而是把异常交给数据分析，再拆成可执行的人机任务。

### 场景 2：林岚创建父任务

建议时长：55 秒
账号：林岚

**操作**

1. 打开左侧“任务”。
2. 点击“新建任务”。
3. 在“派发任务 / Issue”中填写父任务：
   - 标题：`[PT-ORD-001] 华东手机/平板订单异常处置`
   - 类型：任务
   - 项目：手机平板订单履约演示
   - 优先级：画面选择 `P0`
   - 初始状态：待处理
   - 责任人：周宁
   - 到期时间：录制日
4. 粘贴 [task-message-copy.md](./phone-tablet-order-demo/task-message-copy.md) 的描述和验收标准。
5. 点击“派发”。

**预期效果**

- 任务进入“待处理”列；
- 标题以 `[PT-ORD-001]` 开头；
- 责任人显示周宁；
- 任务详情可见创建人、项目、状态和验收标准。

**说明文案**

> 老板把问题、目标和管理验收标准交给履约计划员。任务传递的是业务要求，不自动继承林岚后续查询时的数据授权。

### 场景 3：周宁用 Data Agent 完成只读判断

建议时长：75 秒
账号：周宁

**前置条件**

- 周宁已连接 Demo OMS；
- 当前工作区为“手机平板订单履约演示”；
- 使用新会话。

**操作**

1. 打开“任务”，进入 `[PT-ORD-001]`。
2. 打开 Data Agent。
3. 工作区选择“手机平板订单履约演示”。
4. 会话下拉选择“新会话”。
5. 粘贴 [data-agent-prompts.md](./phone-tablet-order-demo/data-agent-prompts.md) 的第 1 个提示词。
6. 点击“发送”。
7. 等待只读工具调用结束。
8. 滚动展示订单量、异常构成、口径、`dataCutoffAt`、权限和 QueryRun。

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

- Member 权限覆盖华东、华南；
- 华北、西南未覆盖；
- 演示数据、非生产；
- QueryRun ID；
- 指标版本和数据截止时间；
- 订单事实不等于具体 SKU 或缺货原因。

**录制时记录**

```text
QueryRun ID：
dataCutoffAt：
permissionSummary：
指标版本：
```

这些值必须从本次真实输出抄录，不能提前写死或伪造。

**说明文案**

> Data Agent 先发现授权数据，再调用只读查询工具。它给出的是带口径、截止时间、权限和 QueryRun 的订单事实，同时明确不会根据订单字段推断 SKU 或序列号问题。

### 场景 4：周宁深入评估并创建李工任务

建议时长：75 秒
账号：周宁

**操作**

1. 在同一个 Data Agent 会话粘贴第 2 个提示词。
2. 等待返回处置优先级和两路建议。
3. 关闭 Data Agent 侧栏。
4. 返回任务看板，点击“新建任务”。
5. 创建 `[PT-ORD-001-A]`：
   - 项目：手机平板订单履约演示
   - 优先级：画面 `P0`
   - 初始状态：待处理
   - 责任人：李工
   - 到期时间：录制日
6. 粘贴 [task-message-copy.md](./phone-tablet-order-demo/task-message-copy.md) 的李工任务描述与验收标准。
7. 点击“派发”。

**预期效果**

- 保留上一轮时间范围、口径、权限和 QueryRun；
- 区分订单事实和待人工核实原因；
- 任务列表出现且只出现一个人工三级任务 `[PT-ORD-001-A]`；
- 责任人显示李工。

**说明文案**

> 订单数据能告诉我们异常在哪里集中，但不能替仓配确认 SKU、序列号和实物库存。所以李工承担必须由人确认的仓配事实。

### 场景 5：李工提交人工回执

建议时长：65 秒
账号：李工

**操作**

1. 打开“工作台”，在“我的待办”进入 `[PT-ORD-001-A]`。
2. 点击“开始”。
3. 在统一输入区选择“指令”。
4. 粘贴 [task-message-copy.md](./phone-tablet-order-demo/task-message-copy.md) 的“李工任务回执”。
5. 点击“发送”。
6. 在验收标准中勾选三项。
7. 点击“提交验收”。
8. 切换到周宁，打开该任务并点击“通过”。

**预期效果**

```text
37 单可跨仓再平衡
原履约仓缺少完整序列号库存
出库前绑定 IMEI/SN
库存归属变更
保价运输与身份核验签收
当天 17:00 前完成交接
```

**说明文案**

> 这条回执把订单异常与真实仓配约束连接起来。手机和平板不只看有没有货，还要确认 SKU、IMEI/SN、库存归属和高货值交付条件。

### 场景 6：创建履约 AI 的 B 任务

建议时长：75 秒
账号：周宁

**操作**

1. 返回任务看板，点击“新建任务”。
2. 创建 `[PT-ORD-001-B]`：
   - 项目：手机平板订单履约演示
   - 优先级：画面 `P0`
   - 初始状态：待处理
   - 责任人：DE / 分身 → 履约 AI 伙伴
   - 到期时间：录制日
3. 勾选“完成后自动提交 Review”。
4. 勾选“写文件、执行命令和外部发布前需要人工确认”。
5. 粘贴 [task-message-copy.md](./phone-tablet-order-demo/task-message-copy.md)
   的业务任务描述。描述只说明业务背景、交付物、完成时点和参考资料，
   不写 Agent 约束清单。
6. 粘贴同一文件中的 AI 任务验收标准。
7. 点击“派发”。
8. 在 AI 执行记录中确认 Agent 读取了索引和 B 履约证据包，没有请求外部文档授权。

**预期效果**

- 任务列表出现履约 AI 任务 `[PT-ORD-001-B]`；
- 责任人显示履约 AI 伙伴；
- 任务开始执行；
- AI 先读取项目内 B 履约证据包，再输出工单草稿；
- AI 不声称自行查询了 Data Fabric 或 WMS。

**说明文案**

> 李工负责人工仓配事实，履约 AI 伙伴负责整理、模拟和工单草稿。周宁的AI小助理不在任务里做业务判断，等回执齐备后在一对一沟通中负责管理报告。

### 场景 7：履约 AI伙伴工作计划与带验收草稿

建议时长：60 秒
账号：周宁

**操作**

1. 打开左侧“AI伙伴”。
2. 进入“AI伙伴管理”。
3. 选择“履约 AI 伙伴”。
4. 打开“工作计划”。
5. 等待 `[PT-ORD-001-B]` 从“执行中”进入“待确认”。
6. 点击“查看详情”回到任务详情。
7. 打开“AI执行记录”，展示草稿回执。
8. 确认任务状态为“待验收”。

**预期效果**

```text
工作队列：待启动 0 · 执行中 0 · 待确认 1
[PT-ORD-001-B] 生成成品仓订单再平衡工单
订单范围：37 单
预计订单金额：¥194,125
当前状态：草稿，等待周宁确认
```

**说明文案**

> 工作计划页展示的是真实任务队列，不是另一个 Agent 运行时。AI 已经完成整理，但任务停在待验收，业务系统还没有被修改。

### 场景 8：人工确认并通过 MCP 创建工单

建议时长：55 秒
账号：周宁

**前置条件**

- 任务详情扩展 slot 已修复并可见；
- WMS 已由周宁连接；
- `DEMO_WMS_STATE_PATH` 是本次独立环境的新路径。

**操作**

1. 在 `[PT-ORD-001-B]` 任务详情找到“成品仓订单再平衡”业务动作卡。
2. 点击“查看工单草稿”。
3. 核对：

   ```text
   37 单
   华东备用成品仓 → 华东履约仓
   当日 17:00
   SKU / IMEI-SN / 库存归属
   Mock WMS · MCP · 演示动作 · 非生产
   ```

4. 点击“确认并创建”。
5. 等待真实 MCP `tools/call` 回执。

当前页面没有第二次确认弹窗。“确认并创建”本身就是人工确认动作，不要讲解成还会出现二次确认。

**预期效果**

```text
WO-RB-DEMO-1030-017 创建成功
确认人：周宁
操作者：履约 AI 伙伴
审计引用：AT-PT-ORD-001-B
Mock WMS · MCP · 演示动作 · 非生产
```

补充分镜叠字：

```text
Action Ticket：AT-PT-ORD-001-B
consumer：fulfillment-ai
类型：McpCatalogProvider
调用：MCP tools/call wms_rebalance_work_order_create
幂等键：PT-ORD-001-B
```

当前成功卡片显示 Action Ticket，但不展示幂等键。幂等键以 MCP 返回、运行日志或自动化测试为证据，
不要把叠字说成页面字段。

**说明文案**

> 这是关键闭环。AI 只准备草稿，周宁点击确认后，平台才签发 Action Ticket，并通过资源市场注册的 WMS MCP 执行工具调用。重复调用会返回同一张工单。

### 场景 9：通过 B 任务并更新履约工作日报

建议时长：55 秒
账号：周宁

**操作**

1. 打开 `[PT-ORD-001-B]`。
2. 核对 37 单、¥194,125、草稿约束、`WO-RB-DEMO-1030-017` 和
   Action Ticket `AT-PT-ORD-001-B`。
3. 确认 MCP 返回成功、确认人为周宁、操作者为履约 AI 伙伴。
4. 在“待验收”状态点击“通过”。
5. 打开“AI伙伴 → 履约 AI 伙伴 → 工作日报”。
6. 点击“更新日报”。
7. 展示日报至少引用 `[PT-ORD-001-B]` 及其运行摘要。

**预期效果**

```text
[PT-ORD-001-B] 已完成
工作日报引用：PT-ORD-001-B
运行摘要：37 单草稿、¥194,125、Action Ticket、WMS 回执
```

- 只存在一个人工三级任务 A 和一个 AI 三级任务 B；
- 没有 `[PT-ORD-001-C]`；
- 工作日报不改变任务状态，也不替代任务详情中的“通过”；
- 小助理不进入任务看板，不生成任务责任人字段。

**说明文案**

> 履约 AI 伙伴的任务在真实 MCP 回执后才通过。工作日报只是实例运行摘要，
> 不是任务验收，也不是管理报告。

### 场景 10：周宁的AI小助理在 1:1 生成 HTML 报告

建议时长：100 秒
账号：周宁

**前置条件**

- CodeBuddy Provider 已出现在“运行时设置”；
- `CodeBuddy · 订单管理报告` 运行时为“启用中”且探测通过；
- `周宁的AI小助理` 已绑定该运行时，状态为“生效”；
- 平台已支持把外部 Runtime 生成的项目内文件作为 AI 消息附件返回 1:1；
- Data Agent QueryRun、李工回执、Action Ticket 和 WMS 回执已核对。

以上任一条件不满足时，不录制本场景。

**操作**

1. 打开左侧“沟通”。
2. 点击“新建沟通”。
3. 选择“AI伙伴 1:1”。
4. 在“选择我的 AI 伙伴”中选择 `周宁的AI小助理`。
5. 点击“开始 1:1 沟通”。
6. 确认项目根目录存在索引和 `PT-ORD-001-RPT-管理报告证据包.md`。
7. 粘贴 [ai-assistant-prompt.md](./phone-tablet-order-demo/ai-assistant-prompt.md)
   的 1:1 实际输入。
8. 把 QueryRun、`dataCutoffAt`、权限摘要、李工回执、Action Ticket 和
   WMS 工单号替换为真实值。
9. 点击“发送”。
10. 等待 CodeBuddy 读取项目内资料并完成报告，不要在等待中切换会话。
11. 确认 AI 消息出现可下载附件，而不是只出现本地文件路径。
12. 展开核对报告首屏结论、KPI、构成图、证据链、时间线、结果对账和剩余风险。
13. 如果报告使用了公开联网资料，核对来源 URL 和访问时间；业务事实仍须来自项目资料。

**预期效果**

```text
消息发送人：周宁的AI小助理 · AI
附件：华东手机平板订单问题排查和处理报告.html
MIME：text/html
按钮：下载
```

报告至少展示：

- 1,658 单、126 单异常、7.6%；
- 支付失败 52、履约超时 43、取消 31；
- `83 + 43 = 126`、`83 = 46 + 37`；
- `WO-RB-DEMO-1030-017`、`AT-PT-ORD-001-B` 和标准 MCP `tools/call`；
- 真实 QueryRun、`dataCutoffAt`、指标版本和 Member 权限摘要；
- 订单事实、李工人工回执、业务动作和待核实原因的来源区分；
- “演示数据 · 非生产 · 待人工核验，未对外发送”。

报告应使用内联 CSS/SVG，无远程图片、字体或脚本。

**失败处理**

如果只返回文本路径、没有附件：

1. 停止录制；
2. 不把本地文件拖进对话冒充 AI 返回；
3. 记录 AI run ID、输出摘要和平台错误；
4. 按 [developer-change-prompt.md](./phone-tablet-order-demo/developer-change-prompt.md)
   的 artifact 契约补齐平台能力后重新预演。

**说明文案**

> 这里不是让 Data Agent 再写一份报告，也不是把 Task 产物自动注入另一个 Agent。
> 周宁把已经核对过的查询证据、人工回执和 MCP 回执带进一对一沟通，
> 小助理用 CodeBuddy 生成一个自包含 HTML，并由平台把真实文件返回当前对话。

### 场景 11：周宁下载检查并手工上传父任务

建议时长：75 秒
账号：周宁

**操作**

1. 在 1:1 消息中点击 HTML 附件下载。
2. 在浏览器打开，展示首屏和异常构成图。
3. 继续展示证据链、时间线、`83 = 46 + 37` 和剩余风险。
4. 回到 `[PT-ORD-001]` 父任务。
5. 在统一输入区选择“指令”。
6. 附加刚下载的 `华东手机平板订单问题排查和处理报告.html`。
7. 粘贴 [task-message-copy.md](./phone-tablet-order-demo/task-message-copy.md)
   的“周宁下载、上传父任务并提交老板 Review”说明。
8. 点击“发送”。
9. 确认任务消息中出现 HTML 附件。
10. 勾选父任务验收标准。
11. 点击“提交验收”。

**预期效果**

```text
父任务状态：待验收
最新消息：周宁上传了 HTML 报告
附件：华东手机平板订单问题排查和处理报告.html
```

- 上传动作由周宁真实完成；
- 附件内容与 1:1 下载文件一致；
- 报告仍标注“未对外发送”；
- 上传附件不改变 Data Agent 的只读边界，也不绕过 MCP 业务动作。

**说明文案**

> AI 把报告交回对话，周宁负责最后一层业务检查。确认内容后，她把 HTML 手工上传到
> 老板创建的父任务，再提交 Review。这里保留人类对报告内容和对外口径的责任。

### 场景 12：林岚在老板原生任务中 Review

建议时长：55 秒
账号：林岚

**操作**

1. 切换到林岚。
2. 打开林岚创建的 `[PT-ORD-001]`。
3. 确认父任务状态为“待验收”。
4. 查看 A、B 两个三级任务均已完成。
5. 在任务消息或文档区下载 `华东手机平板订单问题排查和处理报告.html`。
6. 打开报告，核对管理结论、异常构成、证据链、结果对账和剩余风险。
7. 返回父任务，点击“通过”。

**预期效果**

- 父任务由周宁提交，林岚 Review；
- 父任务状态为“已完成”；
- 附件保留在任务记录中；
- 任务动态保留人工回执、MCP 业务动作、HTML 上传和 Review 记录；
- 看板只保留一个人工三级任务 A 和一个 AI 三级任务 B。

**说明文案**

> 最后一层仍然是人类管理闭环。林岚在自己的任务里看到报告附件，核对后通过；
> 报告没有被 AI 自动外发，也没有用工作日报或聊天消息代替 Review。

### 场景 13：周宁下班前交班，第二天收 AI 作业

建议时长：110 秒
账号：周宁

**录制状态：阻塞**

当前任务系统在“责任人选择 AI 伙伴”后创建即派发，没有“计划开始时间”和
“次日交付时间”；原生 `schedule_create` 只提供会话内提醒，不能保证用户退出后
仍由任务系统继续执行。以下镜头必须在平台支持持久化定时派发后录制。

**前置条件**

- 周宁的AI小助理和履约 AI 伙伴都已生效；
- 任务创建支持 `已排期`、`计划开始`、`次日交付` 字段；
- 用户退出登录和平台重启后，定时任务仍会执行；
- 任务完成后自动进入“待验收”，不会自动通过；
- 不设置任何前置任务依赖。

**画面与操作**

1. 时间叠字：`17:45 · 周宁准备下班`。
2. 周宁打开任务看板，点击“新建任务”。
3. 依次创建三条独立的一级任务，不挂到 `[PT-ORD-001]` 下，也不设置依赖任务。
4. 三条任务都设置“无人值守执行”，计划开始 `20:30`，次日 `08:30` 前交付。
5. 市场调研和竞品分析使用已有的 `周宁的AI小助理`。
6. 库存计划使用已有的 `履约 AI 伙伴`。
7. 保存后，任务卡片显示“已排期”，当前不出现运行中状态。
8. 时间叠字：`次日 08:30 · 周宁收作业`。
9. 周宁打开“AI伙伴 → 工作计划”，查看三条任务的“待确认”结果。
10. 打开工作日报，展示“无人值守执行小结”。
11. 周宁逐条查看报告和来源，选择通过或退回补充；不自动通过。

**任务 1：市场调研**

```text
标题：[Q4-MKT-01] 手机/平板竞品新品与价格带调研
类型：任务
项目：手机平板订单履约演示
优先级：P1
初始状态：待处理
责任人：DE / 分身 → 周宁的AI小助理
计划开始：录制日 20:30
交付时间：次日 08:30
依赖任务：无
完成后自动提交 Review：勾选
执行方式：无人值守
```

描述：

```text
这两周我在看四季度手机和平板的竞品节奏。请整理苹果、华为、小米、荣耀、
OPPO、vivo 和三星近期新品、核心价格带、渠道动作和促销变化，
重点说明对华东成品仓备货和订单结构可能产生的影响。
公开事实、行业判断和待确认信息要分开，给出公开来源和访问时间。
明早 8:30 前给我一页式简报和后续跟踪清单。
```

**任务 2：渠道与需求分析**

```text
标题：[Q4-MKT-02] 华东渠道促销与换机需求变化分析
类型：任务
项目：手机平板订单履约演示
优先级：P1
初始状态：待处理
责任人：DE / 分身 → 周宁的AI小助理
计划开始：录制日 20:30
交付时间：次日 08:30
依赖任务：无
完成后自动提交 Review：勾选
执行方式：无人值守
```

描述：

```text
帮我看看四季度以来华东手机和平板线上、线下渠道的促销、换机需求和价格变化，
判断未来两周哪些价位段可能出现备货压力。只使用可追溯的公开来源，
全国趋势和华东证据要分开；找不到华东数据就明确标缺口，不要直接外推。
明早 8:30 前给我三条主要判断、证据、风险和三个可执行建议。
```

**任务 3：库存计划**

```text
标题：[Q4-INV-01] 基于本周订单异常的成品仓库存计划建议
类型：任务
项目：手机平板订单履约演示
优先级：P1
初始状态：待处理
责任人：DE / 分身 → 履约 AI 伙伴
计划开始：录制日 20:30
交付时间：次日 08:30
依赖任务：无
完成后自动提交 Review：勾选
执行方式：无人值守
```

描述：

```text
结合本周华东手机和平板订单异常、37 单仓间再平衡和当前项目资料，
给我一份未来 7 天成品仓库存计划建议。按产品线、仓库和履约风险，
说明需要优先关注的数量、容量和交接约束；不要虚构 SKU、IMEI/SN 明细，
不要修改库存。明早 8:30 前给出一页式建议、风险和数据缺口。
```

**预期效果**

```text
17:45  3 条任务状态：已排期 · 无前置依赖
20:30  AI伙伴按计划开始执行
次日 08:30  3 条任务进入待验收
工作日报：无人值守执行小结 · 3 项
```

- 市场调研和竞品分析允许联网，但只引用公开来源；
- 库存计划不联网，只使用当前项目空间中的订单与仓配资料；
- 三条任务均由周宁验收，AI 不自动通过；
- 不发送供应商邮件、不改变客户承诺、不修改库存或生产计划；
- 任务使用现有两个 AI 伙伴，不新增第三个业务伙伴；
- 三条任务是一级“夜间作业”，不改变 `[PT-ORD-001]` 仅一个 A、
  一个 B 的三级任务结构。

**说明文案**

> 下班前把可以异步做的调研和计划交给 AI，不需要人工盯着它跑。
> 夜里它按计划执行，第二天把作业统一放到工作计划和日报里。周宁早上一眼看到结果，
> 再决定通过还是退回补充，整个人工 Review 环节仍然保留。

**当前阻塞与开发要求**

- 不用剪辑把“立即执行”伪装成“夜间执行”；
- 不把会话内 `schedule_create` 说成可用于离线任务；
- 定时任务必须持久化，不依赖页面或 AI 会话一直打开；
- 不自动通过 Review，不在夜间执行外部发布或业务写操作。

## 12. 可剪辑与不可伪造

### 12.1 必须保留的真实证据

- Data Agent 的 QueryRun、dataCutoffAt、权限摘要和指标版本；
- 李工人工任务回执；
- 履约 AI 任务 B 的草稿状态；
- 人工点击“确认并创建”；
- Action Ticket、确认人、consumer 和幂等键；
- Mock WMS 返回的 `WO-RB-DEMO-1030-017`；
- 周宁的AI小助理 1:1 真实附件消息；
- HTML 文件下载、打开和内容核对；
- 周宁在父任务上传同一 HTML 的附件记录；
- B 任务“待验收 → 已完成”；
- 父任务由周宁提交、林岚通过。

### 12.2 可以剪辑的等待

- Data Agent 查询等待；
- AI Agent 执行等待；
- CodeBuddy 生成 HTML 等待；
- 页面刷新与账号切换；
- 工作日报生成等待。

可以剪辑时间，但不能用静态截图替代 QueryRun、MCP 回执、1:1 文件附件、
HTML 下载内容、任务状态变化或工作日报生成。

### 12.3 禁止话术

- “Data Agent 查到了具体 SKU 和 IMEI/SN。”
- “AI 自己调用了 WMS。”
- “页面弹出了第二次确认。”
- “工作日报通过代表任务验收。”
- “工单已写入真实生产 WMS。”
- “报告已经自动发给林岚。”
- “聊天里的本地文件路径就是 AI 附件。”
- “周宁手工上传的文件是 AI 自动写进父任务的。”

## 13. 录制前检查清单

### 平台与插件

- [ ] `PLUGINMAX_ENABLE_PHONE_TABLET_DEMO=1`。
- [ ] `PLUGINMAX_WORKBENCH_DEMO_PROFILE=phone-tablet-order-v1`。
- [ ] profile 中包含 `dsh-collab-demo-phone-tablet-order`。
- [ ] 正式插件没有 Demo import 或 Demo 文案。
- [ ] 不启用 Demo 时应用可正常启动。
- [ ] 独立插件通过 feature flag 安装，可从 profile 整体移除。

### 工作台

- [ ] 只显示“订单准时履约率”一张核心指标卡。
- [ ] 值 94.1%，趋势 -1.8pt。
- [ ] 显示“演示数据 · 非生产”。
- [ ] 没有连接器、铜材、阀体、伺服电机、冷链或生鲜。
- [ ] `config/workbench-profile.yaml` 与运行时实际展示一致。

### Data Agent

- [ ] 周宁已连接 Demo OMS。
- [ ] 第一轮实际生成 QueryRun。
- [ ] 126 / 7.6% / 52 / 31 / 43 一致。
- [ ] 异常构成按 52 / 43 / 31 的顺序表达，占比为 41.3% / 34.1% / 24.6%。
- [ ] Member 权限覆盖华东、华南。
- [ ] dataCutoffAt 等于 fixture `snapshotAt`。
- [ ] 查询入参晚于数据截止时，画面明确说明时间缺口。
- [ ] 本场景只执行两轮 Data Agent 对话，不再生成正式报告或 Data Agent HTML。
- [ ] 后续 1:1 使用同一 QueryRun，没有伪造自动上下文注入。

### 项目内资料

- [ ] 当前项目空间内可按文件名找到索引、B 履约证据包和 RPT 管理报告证据包。
- [ ] 三份文件来自独立 Demo 插件准备的项目资料，不来自外部文档平台。
- [ ] B 任务只读取索引和 B 证据包，不扫描其他目录。
- [ ] 小助理只读取索引和 RPT 证据包，不扫描其他目录。
- [ ] Agent 文件读取发生在项目工作区内，来源策略为 `workspace`。
- [ ] 没有为了找订单信息连接外部网盘、邮件、IM、共享文档或生产系统。
- [ ] 小助理仅在公开信息核实时联网，未用网页结果推断订单或仓配事实。
- [ ] 履约 AI 伙伴没有联网搜索。
- [ ] 占位符未填写时 Agent 明确标为待补，不编造。

### Resource Market 与 MCP

- [ ] 两个 Demo MCP 由 provider 返回，不来自静态 seed。
- [ ] OMS `tools/list` 包含 `orders_health`、`orders_query`。
- [ ] WMS `tools/list` 包含 health、get、create。
- [ ] 连接失败时不显示已连接。
- [ ] provider 返回 `connected` 后页面立即显示“已连接”，不要求刷新。
- [ ] Demo 工作区 owner / member 自动连接 OMS 和 WMS，guest 不自动连接。
- [ ] WMS create 缺少 Action Ticket 时失败。
- [ ] Data Agent consumer 调用 WMS create 时失败。
- [ ] 同一 `idempotencyKey` 重复调用返回同一工单。
- [ ] provider 重启后 `wms_rebalance_work_order_get` 能读回工单。

### 任务

- [ ] 父任务 `[PT-ORD-001]` 责任人周宁。
- [ ] 只存在一个人工三级任务 `[PT-ORD-001-A]`。
- [ ] 只存在一个 AI 三级任务 `[PT-ORD-001-B]`。
- [ ] B 指派给履约 AI 伙伴。
- [ ] 不存在 `[PT-ORD-001-C]`。
- [ ] 画面优先级 `P0` 对应接口/配置存储 `P1`。
- [ ] AI 任务勾选“完成后自动提交 Review”。
- [ ] 任务详情右侧业务扩展卡真实可见；未安装 Demo 时为空态且不报错。
- [ ] 李工任务能“开始 → 指令回执 → 提交验收 → 通过”。
- [ ] AI 任务能“待验收 → 通过”。
- [ ] 父任务统一输入区能以“指令”上传 HTML，发送后任务进入“待验收”。

### 下班前夜间作业

- [ ] 平台已提供持久化“计划开始 / 次日交付 / 无人值守”字段。
- [ ] 三条夜间任务均为一级任务，不挂到 `[PT-ORD-001]` 下。
- [ ] 三条任务都设置为 `20:30` 开始、次日 `08:30` 前交付。
- [ ] 依赖任务均为空，不设置任何前置任务。
- [ ] 市场调研和竞品分析复用周宁的AI小助理。
- [ ] 库存计划复用履约 AI 伙伴。
- [ ] 不新增第三个业务 AI 伙伴。
- [ ] 保存后显示“已排期”，没有立即进入运行中。
- [ ] 用户退出、页面关闭或平台重启后调度仍存在。
- [ ] 次日三条任务进入“待验收”，不自动通过。
- [ ] 工作日报出现“无人值守执行小结 · 3 项”。
- [ ] 市场调研仅使用公开来源并保留 URL 和访问时间。
- [ ] 库存计划只读当前项目资料，不修改库存。
- [ ] 夜间没有供应商邮件、客户承诺、Action Ticket 或 MCP 写调用。

### 业务动作

- [ ] 工单草稿显示 37 单和 ¥194,125。
- [ ] 源仓为华东备用成品仓，目标仓为华东履约仓。
- [ ] 截止为当天 17:00。
- [ ] 人工确认人只能为周宁。
- [ ] 确认后返回 `WO-RB-DEMO-1030-017`。
- [ ] 页面显示 Action Ticket `AT-PT-ORD-001-B`。
- [ ] 幂等键 `PT-ORD-001-B` 已由 MCP 回执或自动化测试验证，不要求当前页面展示。
- [ ] 独立 state 路径在录制前没有旧工单冲突。

### AI 伙伴、运行时与报告附件

- [ ] 两个业务 AI 伙伴实例状态都为“生效”。
- [ ] Data Agent 作为内置只读身份，不重复计入业务 AI 伙伴。
- [ ] 履约 AI 伙伴的工作计划“待确认”区出现 B。
- [ ] `周宁的AI小助理` 不进入任务看板，不承接三级任务。
- [ ] SOUL 不声明 owner、创建人、固定服务对象或固定验收人。
- [ ] 运行时 Provider 可选 `CodeBuddy`，命令为 `codebuddy`，状态“启用中”。
- [ ] 运行时探测通过，绑定给 `周宁的AI小助理`。
- [ ] “沟通 → 新建沟通 → AI伙伴 1:1”能选中该实例并开始对话。
- [ ] 外部 Runtime 写出的 HTML 位于当前项目工作区内。
- [ ] 1:1 返回真实 `text/html` 附件，不是文本路径、截图或手写下载链接。
- [ ] 附件下载后的文件可离线打开，CSS/SVG 图表正常，无远程资源。
- [ ] 附件只对会话用户、AI 伙伴 owner 和管理员可见。
- [ ] 小助理不声称重新查询 Data Fabric、直接调用 WMS 或修改业务单据。
- [ ] 周宁从 1:1 下载并打开报告，核对后才上传父任务。
- [ ] 履约 AI 伙伴的工作日报至少引用 B。
- [ ] 小助理不生成或冒充 AI 工作日报。
- [ ] 不把工作日报讲解成任务验收。

### HTML 报告内容

- [ ] 文件名是 `华东手机平板订单问题排查和处理报告.html`。
- [ ] 首屏先给管理结论。
- [ ] KPI 包含 1,658、126、7.6%、83 和 43。
- [ ] 异常构成图包含支付失败 52、履约超时 43、取消 31。
- [ ] 证据链包含真实 QueryRun、dataCutoffAt、指标版本和权限摘要。
- [ ] 写清 `83 + 43 = 126`、`83 = 46 + 37`。
- [ ] 业务动作包含 `AT-PT-ORD-001-B`、`tools/call` 和 `WO-RB-DEMO-1030-017`。
- [ ] 区分订单事实、人工仓配回执和待核实原因。
- [ ] 包含处置时间线、剩余风险和下一步。
- [ ] 页脚包含“演示数据 · 非生产 · 待人工核验，未对外发送”。
- [ ] 正文没有重复结论、空泛套话、远程图片或虚假系统截图。

### 老板 Review

- [ ] 周宁在父任务发送 HTML 附件后点击“提交验收”。
- [ ] 林岚打开林岚原生创建的 `[PT-ORD-001]`。
- [ ] 林岚能下载并打开同一 HTML。
- [ ] 林岚点击“通过”，父任务变为“已完成”。
- [ ] 报告没有自动外发、没有绕过 Review、没有通过工作日报替代验收。

### 画面

- [ ] 浏览器 1440 × 900，缩放 100%–110%。
- [ ] 三个账号已准备好独立窗口或用户目录。
- [ ] 页面无横向溢出、文字遮挡或异常长英文。
- [ ] 没有生产错误提示或调试工具。
- [ ] 不在画面上展示 secret、token 或环境变量值。

## 14. 录制后检查

- [ ] 视频保留真实 QueryRun 和同一 QueryRun 在报告中的证据。
- [ ] 视频保留真实 Action Ticket 和 MCP 回执；幂等键有独立验证证据。
- [ ] 视频中有一个 A、一个 B；没有 C。
- [ ] 视频保留 1:1 真实 HTML 附件、下载打开、父任务上传和 Review。
- [ ] HTML 内容与 1:1 下载文件、父任务附件一致。
- [ ] 视频保留三条夜间任务的已排期、次日出作业和人工验收，不用即时执行冒充夜间执行。
- [ ] 视频没有宣称真实生产写入或对外发送。
- [ ] 日报被说明为实例快照。
- [ ] 父任务由林岚验收完成。

## 15. 拆卸

先预览 Demo 自有数据：

```sh
DSH_HOME="$DEMO_HOME" \
PLUGINMAX_DEMO_RUNTIME_DIR="$DEMO_ORDERS_RUNTIME_DIR" \
node plugins/dsh-collab-demo-phone-tablet-order/scripts/remove-demo-state.mjs
```

确认清单只包含本 Demo workspace、任务、AI伙伴、MCP 安装、QueryRun、fixture 和 WMS 状态后执行：

```sh
DSH_HOME="$DEMO_HOME" \
PLUGINMAX_DEMO_RUNTIME_DIR="$DEMO_ORDERS_RUNTIME_DIR" \
node plugins/dsh-collab-demo-phone-tablet-order/scripts/remove-demo-state.mjs --apply
```

随后：

1. 删除 profile 中的 `dsh-collab-demo-phone-tablet-order`；
2. 清空 `PLUGINMAX_ENABLE_PHONE_TABLET_DEMO`；
3. 清空 `PLUGINMAX_WORKBENCH_DEMO_PROFILE`；
4. 重启宿主；
5. 确认资源市场不再出现两个 Demo MCP；
6. 确认正式工作台恢复默认指标；
7. 确认任务详情 extension 为空且不报错；
8. 跑一次未启用 Demo 的 smoke。

当前清理脚本未覆盖 AI伙伴的 `work_reports` 与 `audit_events` 明细。
如果录制中生成过工作日报，需要在独立 `DSH_HOME` 中额外核对并按团队数据策略清理。
