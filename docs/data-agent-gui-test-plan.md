# Data Agent GUI 测试方案与结果

> 适用版本：Data Agent PRD v1.3  
> 测试日期：2026-10-30  
> 测试实例：`http://127.0.0.1:33124`  
> 测试账号：`admin`  
> 自动化：Playwright（Chromium，桌面 1440x960 / 移动 390x844）

## 1. 目标

用真实浏览器操作覆盖 Data Agent 的核心用户旅程，而不是只验证 DOM 或 API：

1. 所有一级页面都有恒驻 Data Agent 入口，且可打开、关闭。
2. 页面卡片选中表现为“让DataAgent分析”，不会误跳详情页。
3. 只有明确的“详情/查看详情/查看xx”操作才进入详情。
4. task、workflow、workflow_node、meeting、metric_card、通用卡片和用户文本都能形成附件。
5. Data Agent / 沟通双页签同时开启、切换、独立关闭，草稿和阅读状态不丢失。
6. 普通问题走常规对话，明确要求报告才进入 Markdown 报告链路。
7. HTML 不是固定操作位，只有明确输入“生成 HTML 版”才派生。
8. `ask_user_question` 能显示原生澄清 UI；`entity_read` 能按需读取共享对象历史。
9. 新会话必须是空白会话，不自动恢复旧历史。
10. 桌面与移动端无横向溢出，Console 与网络请求无未处理错误。

## 2. 前置

1. 使用隔离 `DSH_HOME=.tmp/dsh-home` 启动已构建实例。
2. 使用带 launch token 的完整 URL，不直接打开裸地址。
3. 工作区中至少有真实 task、workflow、workflow_node、meeting、metric_card 数据。
4. 使用当前管理员账号登录，避免 401 噪声影响结果。

## 3. 用例

### GUI-DA-01 全局恒驻入口

依次进入工作台、项目、任务、工作流、沟通、AI伙伴、资源市场。

期望：每个页面右上角恰有 1 个可见 Data Agent 图标，位于页面动作区。

### GUI-DA-02 打开与关闭

在工作台点击 Data Agent 图标，再点击同一按钮。

期望：第一次打开右侧 Data Agent 页，第二次关闭；不出现空白或重复面板。

### GUI-DA-03 新会话

点击“新会话”，关闭并重新打开侧栏，再读取消息列表。

期望：消息数保持 0，不会因工作区加载 effect 自动载回最近会话。

### GUI-DA-04 五类标准实体

分别从工作台、任务页、工作流详情页和沟通页选择：

| 实体 | 操作 | 断言 |
| --- | --- | --- |
| task | 点击任务卡片正文 | 出现“让DataAgent分析”，附件显示 `TSK-*` |
| workflow | 点击工作流卡片正文 | 出现选区动作，附件显示工作流 UUID |
| workflow_node | 进入显式“查看详情”后点击节点卡片空白区 | 附件显示节点 ID，例如 `product-design` |
| meeting | 点击沟通列表会议行正文 | 附件显示 meeting UUID |
| metric_card | 点击 OTIF 指标卡 | 附件显示 `otif` |

### GUI-DA-05 文本与外层卡片

1. 在工作流详情文字上建立 Range 选区并触发 pointer-up。
2. 点击没有标准实体 ID 的工作台简报卡。

期望：都出现 Data Agent 动作；附件显示“页面片段”，不伪造实体 ID。

### GUI-DA-06 选区与详情冲突

1. 点击 task 卡片：只出现 Data Agent 选区动作。
2. 按 Escape，点击“查看任务详情”：进入详情。
3. 对 workflow 和 meeting 重复。

期望：整行/整卡不再自动跳转；详情入口必须是明确按钮。

### GUI-DA-07 双页签与状态保持

同时打开 Data Agent 与沟通：

1. 在 Data Agent 输入草稿。
2. 切到沟通再切回。
3. 单独关闭 Data Agent，保留沟通。
4. 再打开 Data Agent。
5. 展开并还原侧栏。

期望：两个页签可独立关闭；草稿在切换、独立关闭和重新打开后保留；展开无内容宽度塌缩。

### GUI-DA-08 ContextPack

分享 workflow_node 与用户文本后提问。

期望服务端 `collab_context.json` 中最新的 pack：

- `chatCarrier=data-agent`；
- system 段包含 `Data Agent SOUL`；
- 包含 `workflow_node` 详情和 text 页面片段；
- references 保留标准实体 ID；
- 不把页面片段伪装成标准实体。

实际回归中，Data Agent 正确识别 workflow、node、任务索引、文本片段和会议摘要。

### GUI-DA-09 常规对话 / 报告分流

1. 问“介绍你自己”或普通上下文问题。
2. 明确要求“生成一份 Markdown 分析报告”。

期望：普通问题不套报告章节；报告请求返回报告卡，包含 Markdown 和图片数量、数据截止时间，不出现固定“生成 HTML 版”按钮。

### GUI-DA-10 HTML 派生

报告完成后输入“生成 HTML 版”。

期望：基于同一报告版本生成 HTML，随后出现“下载 HTML”；不从空白上下文重新生成报告。

### GUI-DA-11 原生澄清

要求 Data Agent 调用 `ask_user_question` 询问分析范围。

期望：显示原生澄清卡和“本周/本月”选项；模型不是仅用普通文本提问。

### GUI-DA-12 渐进式对象读取

分享 task 后要求调用 `entity_read` 读取 history。

期望：

- Provider 请求中的工具名为合法的 `entity_read`；
- 会话事件记录 `tool/call` 与 `tool/result`；
- 输出能引用任务历史、Run ID 与缺失字段；
- Data Agent Run 的 `usedTools` 包含 `entity_read`。

### GUI-DA-13 移动端

切换到 390x844。

期望：面板宽度不超出视口，`documentElement.scrollWidth <= innerWidth`，无重叠或横向滚动。

## 4. 本轮执行结果

| 用例 | 结果 | 说明 |
| --- | --- | --- |
| GUI-DA-01 | PASS | 7 个一级页面均恰有 1 个可见入口 |
| GUI-DA-02 | PASS | 图标可打开和关闭 |
| GUI-DA-03 | PASS | 新会话保持空白 |
| GUI-DA-04 | PASS | task / workflow / workflow_node / meeting / metric_card 均有正确 ID |
| GUI-DA-05 | PASS | 文本与通用卡片均显示“页面片段” |
| GUI-DA-06 | PASS | 卡片点击只唤起选区，显式详情按钮才跳转 |
| GUI-DA-07 | PASS | 双页签、独立关闭、草稿保持、展开还原通过 |
| GUI-DA-08 | PASS | ContextPack 包含 SOUL、对象上下文和 mandatory references |
| GUI-DA-09 | PASS | 常规对话与报告链路分流正确 |
| GUI-DA-10 | PASS | HTML 仅由明确输入派生 |
| GUI-DA-11 | PASS | 原生澄清卡正常显示 |
| GUI-DA-12 | PASS | `entity_read` 工具调用与历史返回成功 |
| GUI-DA-13 | PASS | 390px 下无横向溢出 |

浏览器 Console 与失败响应记录均为空。2026-10-30 在最新构建与 Data Fabric 接入后完成复跑，13 个用例继续全部通过；完整门禁为 49 个测试文件、703 个测试通过。

证据截图：

- `.tmp/data-agent-all-entities.png`
- `.tmp/data-agent-report.png`
- `.tmp/data-agent-mobile.png`
- `.tmp/data-agent-entity-read.png`

## 5. 未覆盖

- Safari、Firefox、Windows Chromium 的跨浏览器矩阵。
- 真实生产数据仓库 Connector、字段级脱敏、行级 ACL 的端到端验证。
- 定时报告调度器、通知通道与失败重投。
- Codex / Codebuddy 外部 Runtime 的每一种真实 CLI 组合；本轮验证平台内置 Runtime。

## 6. 订单 MVP（第二阶段）回归

测试日期：2026-10-30  
测试实例：`http://127.0.0.1:33125`  
自动化：[order-mvp-gui.mjs](../scripts/order-mvp-gui.mjs)  
桌面：1440x960  
移动：390x844

### GUI-ORDER-01 工作台订单指标

- 先通过现有资源市场 MCP 页连接 `mcp-orders-mock`；
- MCP 页显示第三方 Mock OMS、治理服务来源、只读权限和“已连接”；
- 工作台显示“订单准时履约率”；
- 显示 Data Fabric metric version、近 7 天范围和非生产演示标识；
- 其他经营卡继续标注为演示种子。

### GUI-ORDER-02 无选区订单异常 brief

问题：“今天有没有订单异常？”  
期望且实际通过：

- Agent 自行发现 `orders-facts`；
- brief 包含范围、订单异常 v1 口径、`orders-metric-v1`、截止时间、权限覆盖、QueryRun 和不确定性；
- 明确标记演示数据、非生产；
- 不要求用户先选择卡片。

### GUI-ORDER-03 下钻

追问：“查看华东生鲜。”  
期望且实际通过：

- 复用上一轮时间和异常口径；
- 增加 `region=华东`、`category=生鲜`；
- 返回更小范围 brief 与新的 QueryRun 证据。

### GUI-ORDER-04 部分权限

使用 workspace member，Policy 仅覆盖华东/华南：

- 问询“全国有没有订单异常”；
- 返回结果只包含华东、华南；
- 明确“未覆盖：华北、西南”；
- QueryRun permission summary 同时保留 RLS 与 coverage note；
- 未覆盖区域没有被当作 0。

### GUI-ORDER-05 正式报告复用

- 在已有 brief/下钻后显式请求正式报告；
- 报告卡生成 Markdown + 2 张 SVG；
- 报告引用会话已有 QueryRun；
- 报告请求前后订单 QueryRun 数不变；
- Agent 被禁止在已有成功 QueryRun 时重新查询。

### GUI-ORDER-06 HTML 派生

- 正式报告完成后输入“生成 HTML 版”；
- 出现“下载 HTML”；
- HTML 只使用同一报告快照；
- 前后 QueryRun 数不变。

### GUI-ORDER-07 移动端

- 390x844 下 Data Agent 面板占满视口；
- `documentElement.scrollWidth <= innerWidth`；
- 报告/HTML/权限提示无横向滚动。

### 结果与证据

| 用例 | 结果 |
| --- | --- |
| GUI-ORDER-01 | PASS |
| GUI-ORDER-02 | PASS |
| GUI-ORDER-03 | PASS |
| GUI-ORDER-04 | PASS |
| GUI-ORDER-05 | PASS |
| GUI-ORDER-06 | PASS |
| GUI-ORDER-07 | PASS |

浏览器 Console 与失败响应均为空。

订单 MVP 与既有 Data Agent 用例合计后，完整门禁为 52 个测试文件、729 个测试通过。

证据：

- `.tmp/order-workbench-metric.png`
- `.tmp/order-resource-market-mcp.png`
- `.tmp/order-brief-desktop.png`
- `.tmp/order-brief-drilldown.png`
- `.tmp/order-formal-report.png`
- `.tmp/order-html-derivative.png`
- `.tmp/order-mobile.png`
- `.tmp/order-partial-permission.png`
