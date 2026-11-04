# 给开发人员的增量改造 Prompt

> 基线日期：2026-11-03
> 场景：手机/平板成品供应链订单异常
> 结论：独立 Demo 插件、OMS/WMS MCP、Action Ticket、幂等、任务详情扩展区和
> Demo 成员自动连接已经实现。当前正式录制被两个通用平台缺口阻塞：
> 1. AI伙伴页面不能直接选择 CodeBuddy；
> 2. 外部 Runtime 生成的文件不能作为 AI 消息附件返回到 1:1 沟通。
> 下班前的“夜间作业、次日收报告”镜头还缺少持久化定时派发能力。

> 实现状态以当前工作区实际文件为准，不以旧文档或 HEAD 为准。
> 不要回滚本任务无关的未提交修改。

## 1. 目标链路

```text
林岚在工作台看到华东订单履约异常
  → 创建父任务 [PT-ORD-001] 给周宁
  → 周宁用 Data Agent 做两轮只读查询并保留同一个 QueryRun
  → 创建人工三级任务 [PT-ORD-001-A] 给李工
  → 创建唯一 AI 三级任务 [PT-ORD-001-B] 给履约 AI 伙伴
  → 李工提交人工仓配回执
  → 周宁在任务详情人工确认
  → 平台签发 Action Ticket
  → 标准 MCP tools/call 创建 Mock WMS 工单
  → 周宁通过 AI伙伴 1:1 沟通把已确认证据交给“周宁的AI小助理”
  → CodeBuddy 在当前项目工作区生成单文件 HTML
  → 平台把 HTML 作为当前 1:1 AI 消息附件返回
  → 周宁下载、打开、核对 HTML
  → 周宁把同一 HTML 手工上传到父任务 [PT-ORD-001] 并提交 Review
  → 林岚打开父任务附件，核对后通过
```

业务结构固定：

- 一个人工三级任务：李工；
- 一个 AI 三级任务：履约 AI 伙伴；
- 两个业务 AI 伙伴：履约 AI 伙伴、周宁的AI小助理；
- Data Agent 是平台内置只读分析身份，不占业务 AI 伙伴名额；
- 不创建 `[PT-ORD-001-C]`；
- 小助理通过 1:1 完成报告，不承接三级任务；
- 保留一个父任务 `[PT-ORD-001]`，由林岚创建、周宁提交、林岚 Review。

不新增冷链、温控、生鲜、采购到料或生产齐套故事。

## 2. 不可妥协的边界

1. Demo 代码只能位于 `plugins/dsh-collab-demo-phone-tablet-order`。
2. 只通过 `PLUGINMAX_ENABLE_PHONE_TABLET_DEMO=1` 安装独立插件。
3. 正式插件不得 import Demo 包，不得出现 Demo fixture、固定工单号或业务文案。
4. 外部系统必须通过 `McpCatalogProvider × McpProviderRegistry` 注册、连接和调用。
5. 不得新增 Demo 专用 REST 写接口绕过 MCP。
6. Data Agent 只读，不持有 WMS 写工具。
7. WMS 写操作必须有人类确认、Action Ticket、consumer 限制和幂等。
8. 小助理不重新查询 Data Fabric，不调用业务 MCP，不修改订单、库存、任务或单据。
9. AI 1:1 没有真实附件时必须 fail closed，不得用文本路径、本机拖拽、静态截图或
   手写下载链接冒充文件返回。
10. 周宁上传父任务附件是明确的人工动作，不能描述成 AI 自动写入任务。

## 3. 已完成，不要重复开发

### 3.1 独立 Demo 插件与安装

已存在：

```text
plugins/dsh-collab-demo-phone-tablet-order/
├── mock/
├── data/
├── config/
├── prompts/
├── scripts/
└── src/
```

`scripts/install-profile.sh` 只在 feature flag 开启时安装该插件。
卸载 profile 后正式应用可正常启动。

### 3.2 OMS / WMS MCP

已实现：

- `mcp-orders-phone-tablet-demo`：
  - `orders_health`
  - `orders_query`
  - 只读
- `mcp-wms-phone-tablet-demo`：
  - `wms_health`
  - `wms_rebalance_work_order_get`
  - `wms_rebalance_work_order_create`
  - 写工具要求人工确认和 Action Ticket
- provider 连接执行 `initialize` 和 `tools/list`
- 业务调用执行标准 MCP `tools/call`
- 连接状态按用户保存
- provider 卸载清理连接
- 未知资产 fail closed

不要改成静态 seed 或 Demo REST 假成功。

### 3.3 Action Ticket 与幂等

已实现：

- 只有周宁可执行 Demo 人工确认；
- 服务端生成 5 分钟有效 HMAC Action Ticket；
- consumer 固定为 `fulfillment-ai`；
- Data Agent consumer 被拒绝；
- `humanConfirmed=true` 校验；
- 幂等键固定为 `PT-ORD-001-B`；
- 同一幂等键返回同一工单；
- WMS 状态持久化；
- provider 重启后可通过 `wms_rebalance_work_order_get` 读回。

### 3.4 任务详情扩展区

`pluginmax.task.detail.extension` 已在任务详情右侧作为可见 slot 渲染。
未安装 Demo 插件时为空态，不应补 Demo 专用占位。

不要再把“扩展区被 hidden”写成当前问题。

### 3.5 Demo 工作区自动连接

当前已按 `PublicMember.memberRole` 过滤：

- owner / member：自动连接 OMS 和 WMS；
- guest：不自动连接；
- 无关工作区：不执行 Demo 连接；
- 工作区标题支持精确后缀和编号前缀。

不要再读取不存在的 `member.role` 字段。

### 3.6 Data Agent 与订单数据

已实现：

- 订单异常 brief；
- 正式报告复用同一会话成功 QueryRun；
- HTML 从同一报告快照派生；
- 报告模式未重新调用 `metric_query` 或 `dataset_query_readonly`；
- `dataCutoffAt` 取 fixture `snapshotAt`；
- 权限和指标版本由统一证据区补齐；
- 否定报告意图已有回归覆盖。

本次 Demo 不再使用 Data Agent 的正式报告或 HTML。只使用两轮 chat brief：

1. 异常规模与构成；
2. 渠道、金额影响、处置方向和任务分工。

### 3.7 Resource Market 连接状态

客户端已经使用 `/api/collab/resources/mcps/connect` 返回的 `install.status`：

- `connected` 立即显示已连接；
- `pending` 显示待验证；
- 失败不乐观显示成功；
- 支持断开后重新连接。

不要再按“固定 pending、必须刷新”的旧描述实现。

## 4. P0：AI伙伴页面增加 CodeBuddy Provider

### 当前事实

- 服务端 `EXTERNAL_AGENT_PROVIDERS` 已包含 `codebuddy`；
- `ExternalAgentProcessRunner` 已对 `workbuddy / codebuddy` 使用
  `--print --output-format stream-json` 适配；
- `external-runtimes/update` 已使用完整 provider 枚举，但
  `external-runtimes/create` 的请求 schema 仍只允许
  `codex / workbuddy / command`，会拒绝 `codebuddy`；
- 当前页面 Provider 下拉只有：
  - `Codex`
  - `WorkBuddy`
  - `通用命令`
- 页面没有独立 `CodeBuddy` 选项，且 `WorkBuddy` 默认命令是 `workbuddy`。

相关位置：

- `plugins/dsh-collab-agent/src/types.ts`
- `plugins/dsh-collab-agent/src/external.ts`
- `plugins/dsh-collab-teammate/client/index.js`

### 要求

1. Provider 下拉增加 `CodeBuddy`，值为 `codebuddy`。
2. 显示映射增加 `codebuddy: "CodeBuddy"`。
3. 选择后默认命令为 `codebuddy`。
4. `external-runtimes/create` 改为使用 `EXTERNAL_AGENT_PROVIDERS`，与 update 和持久化类型一致。
5. 协议仍使用外部 Runner 托管的 stream-json，不在页面暴露两组互相冲突的协议字段。
6. 支持文件修改权限：
   - 默认权限；
   - 计划模式；
   - 自动接受文件修改。
7. 支持读取文件、写入文件能力选择。
8. 模型池、探测、启停、归档与现有 WorkBuddy 行为一致。
9. 不把 `WorkBuddy` 标签继续当作 CodeBuddy 的别名，避免录屏误导。

### 验收

- 注册运行时选择 CodeBuddy，页面显示 `CodeBuddy`；
- 命令默认 `codebuddy`；
- 探测成功；
- 绑定到 `周宁的AI小助理`；
- 1:1 对话能真实启动 CodeBuddy；
- trace 记录 provider=`codebuddy`、runtime、model、cwd、tool call 和结果。

## 5. P0：外部 Runtime 文件 artifact 通用契约

### 当前事实

- 外部进程能在项目工作区读取和写入文件；
- Runner 最终只返回：

```ts
output: [{ type: "text", text: finalText }]
```

- 没有文件 artifact 返回结构；
- 1:1 完成时只使用 `run.output.summary`：

```ts
const reply = run.output?.summary?.trim() ?? "";
await meetings.postWorkerReply(participantId, reply);
```

- `postWorkerReply(participantId, content)` 只接收文本；
- `MeetingMessage.attachments` 已存在，人工上传和前端下载已经支持。

相关位置：

- `plugins/dsh-collab-agent/src/external.ts`
- `plugins/dsh-collab-agent/src/types.ts`
- `plugins/dsh-collab-meeting/src/index.ts`
- `plugins/dsh-collab-meeting/client/index.js`

### 通用输出契约

为外部 Runtime 和 AgentRun 增加通用 artifact 结构，例如：

```ts
type AgentArtifact = {
  name: string;
  mime: string;
  size: number;
  relativePath: string;
  sourceRunId: string;
};
```

字段命名可按现有模型调整，但必须满足：

1. 只登记本次 run 实际创建或修改的文件；
2. `relativePath` 必须位于当前项目工作区；
3. 解析后的真实路径仍在工作区内；
4. 拒绝绝对路径、`..` 越界和 symlink 指向工作区外；
5. 只接受普通文件；
6. 1:1 附件的实际上限必须与现有 `MAX_MEETING_FILE_BYTES=512 KiB` 保持一致；
   如需放大，必须同时调整会议文件服务、上传路由和测试，不能只在新 artifact 路径放宽；
7. MIME/扩展名使用 allowlist；
8. 本 Demo 必须允许 `text/html`；
9. 拒绝可执行文件、脚本、宏文档和未知二进制；
10. 文件名必须安全、稳定、可展示，不允许控制字符；
11. HTML 必须额外校验：
    - 不含 `<script>`；
    - 不含 `javascript:` URL；
    - 不引用远程脚本、样式、图片或字体；
    - 只允许内联 CSS/SVG 或 `data:` 资源；
12. artifact 内容哈希与文件大小以读取时复核值为准。

不能用“扫描整个工作区并把所有文件都返回”的方式实现。这样会把用户已有文件
误当成本次 AI 产物。

### Runtime 结果

外部 Runtime 在 run 结束时返回：

```text
文本摘要 + artifacts[]
```

若 CodeBuddy 声称已生成文件，但 artifact 列表为空或文件不存在：

- run 结果为失败或部分失败；
- 1:1 明确提示没有文件返回；
- 不生成虚假附件；
- 不把本地路径翻译成下载链接。

### 1:1 回复附件

扩展会议服务：

```ts
postWorkerReply(
  participantId,
  content,
  { attachments }
)
```

要求：

1. `mirrorChatRunToMeeting` 在 succeeded 分支同时读取 `run.output.summary` 和 artifacts；
2. 当前已有 `MeetingFileService.put()` 用于持久化文件；
3. 使用 artifact 内容创建消息附件；
4. 只有文件成功落库后才把 delivery 标为 delivered；
5. 文件落库失败时 delivery=failed，并显示明确系统消息；
6. AI 附件消息必须保留 `provenance.runId` 和 `teammateInstanceId`；
7. 前端沿用现有附件下载控件，不新增 Demo 专用按钮；
8. 文件名、MIME、大小、下载内容均来自服务端记录，不信任 prompt 文本。

### 权限

1:1 附件必须与当前 AI 对话同权限：

- 当前会话用户；
- AI 伙伴实例 owner；
- 管理员。

其他用户即使知道 fileId 也不能下载。

### 验收

- CodeBuddy 在项目工作区生成 `华东手机平板订单问题排查和处理报告.html`；
- run 输出有且只有该 artifact；
- 1:1 消息同时显示文本和下载按钮；
- 下载文件能离线打开，内容含内联 CSS/SVG；
- 文件不含远程资源或脚本；
- 会话用户、owner、管理员可下载；
- 其他用户返回 403；
- 越界路径、symlink、超限、MIME 不允许、空文件全部 fail closed；
- 附件落库失败时不出现“已返回文件”的假成功；
- 平台重启后附件仍可下载。

## 6. P0：1:1 对话超时可配置

当前 `dispatchAiChat` 固定：

```ts
timeoutMs: 120_000
```

生成图文 HTML 可能超过 2 分钟。

要求：

1. 1:1 AI chat 超时可配置；
2. Demo 建议值 300 秒，平台默认值不由本 Demo 改写；
3. 超时后明确显示错误；
4. 不把半成品文件当作成功 artifact；
5. 取消 run 时终止外部进程组；
6. 增加 120 秒与超时分支测试。

## 6.1 P0：持久化定时任务与次日交付

### 当前事实

- 任务创建后如果责任人是 AI 伙伴，`POST /api/collab/tasks/create` 会立即派发；
- Task 只有“到期时间”，没有“计划开始时间”；
- 原生 `schedule_create` 是 Session-local reminder，依赖会话保持存活，
  不能保证用户退出后由任务系统继续执行；
- 工作日报可以展示执行摘要，但不能触发任务或代替 Review。

因此不能用剪辑把“立即执行”伪装成“夜里执行”，也不能把会话提醒写成任务调度。

### 任务字段

为通用 Task 增加可选字段：

```ts
type ScheduledExecution = {
  mode: "unattended";
  startAt: string;
  deliverBy: string;
};
```

要求：

1. 责任人为 AI 且存在 `scheduledExecution` 时，创建任务不立即 dispatch；
2. 任务保持 `todo`，UI 显示“已排期”，并展示计划开始和交付时间；
3. 到 `startAt` 后调度器再执行正常 Task Dispatch；
4. 调度记录持久化，用户退出和平台重启后仍有效；
5. 不能依赖浏览器、会议或 AI 会话保持打开；
6. 同一 AI 伙伴的夜间任务按队列执行，避免并发冲突；
7. 没有 DAG 依赖时所有任务可独立排队；
8. 执行完成且 `autoSubmitReview=true` 时进入“待验收”；
9. 不自动通过 Review；
10. 次日工作日报出现“无人值守执行小结”，包含任务 ID、结果、风险和待确认项。

### UI

任务创建弹窗增加：

```text
执行时间：立即执行 / 定时执行
计划开始：日期时间
交付时间：日期时间
```

任务卡和详情显示：

```text
已排期 · 20:30 开始 · 次日 08:30 交付
```

不新增“已排期”状态值，避免改 Task 状态机；用调度字段控制何时 dispatch。

### 安全边界

- 夜间任务只允许读操作，不允许供应商邮件、客户承诺、库存修改或生产计划发布；
- 市场调研可以使用公开 web search；
- 库存计划只读取当前项目空间资料；
- 公开来源必须记录 URL 和访问时间；
- 不允许无人值守执行 Action Ticket 或 MCP 写调用。

### 验收

- 17:45 创建三个无依赖 AI 任务，均显示“已排期”，不立即运行；
- 20:30 调度器自动执行；
- 平台重启或用户退出后仍执行；
- 次日 08:30 前完成并进入“待验收”；
- 周宁可逐条通过或退回补充；
- 工作日报有“无人值守执行小结 · 3 项”；
- 不新增 AI 伙伴即可完成市场调研、竞品分析和库存计划；
- 夜间没有外部发布、库存修改或 MCP 写调用。

## 7. P1：Demo 工作台 Profile

Demo 插件已从 `config/workbench-profile.yaml` 读取 `metrics.selected`。
当前配置仍选择四张卡，其中 `price-achievement` 有连接器、铜材等跨行业文案。

要求：

1. Demo Profile 只选择 `otif`；
2. 只显示“订单准时履约率 94.1% / -1.8pt / 演示数据 · 非生产”；
3. 不修改正式工作台默认指标；
4. 不修改用户自己的非空布局；
5. 同步更新 Demo Profile 配置测试期望。

这是 Demo config 收敛，不新增正式业务逻辑。

## 7.1 项目内证据包，不新增正式代码

Demo 插件新增：

```text
project-inputs/phone-tablet-order/
├── 00-手机平板订单异常-资料索引.md
├── PT-ORD-001-B-履约证据包.md
└── PT-ORD-001-RPT-管理报告证据包.md
```

录制前由人工把整个 `project-inputs/` 复制到项目根目录。任务 B 和小助理只读取
与自身匹配的固定文件，不扫描其他目录，也不连接外部文档源。

验收：

- 插件构建产物包含 `project-inputs/**/*`；
- Agent 的任务/1:1 运行 `cwd` 是项目工作区；
- `sourcePolicy.allow` 包含 `workspace`；
- 读取上述 Markdown 只使用项目内文件读取，不升级为外部文档连接器；
- 履约 AI 伙伴不需要网页搜索；周宁的AI小助理可配置 `web_search`，
  但只允许核实公开术语、法规或外部背景，不得用网页结果推断内部订单、库存、
  WMS、客户或仓配事实，也不得上传项目资料；
- 文件缺失时输出明确缺失信息，不循环申请授权；
- 文件中的运行时占位符不得被编造。

这不需要新增 Demo REST 接口或正式插件业务分支。

## 8. 不需要新增的能力

- 不把 Data Agent 会话自动注入 1:1；
- 不把 QueryRun 自动注入 AI 任务；
- 不把 B 任务自动注入小助理；
- 不新增任务状态；
- 不新增 Demo REST 写接口；
- 不让 AI 直接调用 WMS create；
- 不让小助理修改父任务；
- 不让 AI 自动外发报告；
- 不把工作日报当 Review。

本 Demo 由周宁手工复制已核对证据到 1:1，再由周宁手工上传 HTML 到父任务。

## 9. Mock MCP 契约保持

### OMS

- 资产：`mcp-orders-phone-tablet-demo`
- 工具：`orders_health`、`orders_query`
- 只读
- fixture 最大 10,000 行
- `scannedRows=8358`
- `dataCutoffAt` 取 `fixture.snapshotAt`
- 响应包含 `demo=true`、`fixtureId`
- 失败 fail closed，不回退正式 OMS

### WMS

- 资产：`mcp-wms-phone-tablet-demo`
- 工具：`wms_health`、`wms_rebalance_work_order_get`、
  `wms_rebalance_work_order_create`
- create 校验：
  - HMAC Action Ticket；
  - actionTicketId、taskId、workspaceId；
  - consumer=`fulfillment-ai`；
  - `humanConfirmed=true`；
  - 确认人与签名声明一致；
  - 票据未过期；
  - idempotencyKey。
- Data Agent 调用必须报错；
- 无票、错票、重复订单 ID 必须失败；
- 同一幂等键返回同一工单；
- 重启后 `get` 可恢复工单。

本次报告改造不新增任何 MCP 写工具。

## 10. 数据对账

```text
totalFixtureRows = 8358
orderCount = 1658
exceptionCount = 126
exceptionRate = 7.6
paymentFailureCount = 52
cancelledCount = 31
fulfillmentTimeoutCount = 43
orderAmount = 8420218
exceptionAmount = 642748
currentSevenDayOnTimeRate = 94.1
previousSevenDayOnTimeRate = 95.9
onTimeDeltaPt = -1.8
```

业务回执：

```text
126 = 83 恢复履约 + 43 退款/取消/改约
83 = 46 支付恢复 + 37 成品仓再平衡
37 单金额 = 194125
WO = WO-RB-DEMO-1030-017
Action Ticket = AT-PT-ORD-001-B
idempotencyKey = PT-ORD-001-B
```

权限：

- Member：`orders-member-region-scope`，华东、华南，未覆盖华北、西南；
- Owner：默认工作区范围，不自动继承 Member 区域限制；
- 权限镜头必须使用周宁。

## 11. 测试与验收

至少运行：

```sh
./node_modules/.bin/vitest run \
  plugins/dsh-collab-agent/src \
  plugins/dsh-collab-meeting/src \
  plugins/dsh-collab-teammate/src \
  plugins/dsh-collab-task/src \
  plugins/dsh-collab-resource-market/src \
  plugins/dsh-collab-data-orders/src \
  plugins/dsh-collab-data-fabric/src \
  plugins/dsh-collab-data-agent/src \
  plugins/dsh-collab-workbench/src \
  plugins/dsh-collab-demo-phone-tablet-order/src
```

新增测试至少覆盖：

1. CodeBuddy Provider 注册、显示、探测和调用；
2. Runtime 解析本次 run 创建的文件 artifact；
3. 工作区越界、symlink、绝对路径、超限、错 MIME、脚本 HTML 被拒绝；
4. `postWorkerReply` 带附件；
5. 1:1 run succeeded 后消息含附件；
6. 附件权限和重启持久化；
7. 1:1 超时可配置与超时 fail closed；
8. 无 artifact 时不生成假下载；
9. 定时任务创建后不立即 dispatch，到点后 dispatch；
10. 调度持久化、重启恢复和用户离线执行；
11. 夜间任务完成后进入待验收，不自动通过；
12. Demo Profile 只选择 otif；
13. 任务详情扩展区可见且空态不报错；
14. Demo 工作区 owner/member 自动连接；
15. OMS/WMS `tools/list`、`tools/call`；
16. WMS 无票、错票、错误 consumer、Data Agent consumer、重复幂等；
17. 父任务上传 HTML、提交验收、林岚通过。

## 12. 完成定义

- 页面可直接注册 CodeBuddy Runtime；
- 小助理在 1:1 中真实启动 CodeBuddy；
- 生成的自包含 HTML 以真实附件返回 1:1；
- 附件可下载、可离线打开、权限正确、无脚本和远程资源；
- 无 artifact 时明确失败，不出现假成功；
- 周宁能下载检查并手工上传同一 HTML 到父任务；
- 林岚能打开父任务附件并通过；
- 下班前三条 AI 任务可持久化排期并在次日进入待验收；
- 只有一个 A、一个 B，没有 C；
- Data Agent 只读 brief，不生成本场景正式报告；
- 两个业务 AI 伙伴职责清楚；
- 不新增 Demo REST 写接口或正式插件 Demo 依赖；
- 不启用 Demo 时正式应用正常启动。
