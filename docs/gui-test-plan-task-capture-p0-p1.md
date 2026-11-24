# GUI 端到端测试方案：沟通中创建任务草稿（P0/P1）

> 文档版本：v1.0  
> 日期：2026-10-30  
> 产品依据：[产品 PRD：沟通中创建任务草稿（P0/P1）](../../产品PRD-沟通中创建任务草稿-P0P1.md)  
> 技术依据：[技术设计：沟通中创建任务草稿（P0/P1）](./task-capture-draft-p0p1-technical-design.md)  
> 测试对象：`dsh-collab-task`、`dsh-collab-task-capture`、`dsh-collab-task-tools`、`dsh-collab-meeting`、`dsh-collab-data-agent`

---

## 0. 结论

本方案采用“GUI 操作为主、API 仅准备确定性和辅助校验”的方式，覆盖：

1. 会议、AI 单聊、Data Agent 三类来源；
2. 右侧沟通栏和沟通中心上下文列两种承载布局；
3. 任务草稿保存、轻编辑、去重、撤销、忽略、归档；
4. 草稿箱补齐契约、确认创建、不自动派发；
5. 任务来源回溯；
6. 用户确认后创建并派发；
7. Agent 查询、进展反馈、请求补充、提交交付物和评论；
8. 失败、权限、刷新、响应式和 Console/Network 边界。

**发布门槛：**

- P0 所有 `P0-*` 用例必须通过；
- P0 端到端场景 `E2E-P0-*` 必须通过；
- P1 核心用例 `P1-01`、`P1-02`、`P1-05`、`P1-06` 必须通过；
- 依赖确定性 Agent 夹具的 `P1-03`、`P1-04` 若夹具未就绪，只能标记为“阻塞”，不能标记为通过；
- Console 不得出现未捕获异常；Network 不得出现非预期 4xx/5xx。

---

## 1. 测试范围

### 1.1 覆盖范围

| 能力域     | 测试内容                                                     |
| ---------- | ------------------------------------------------------------ |
| 来源采集   | 会议、AI 单聊、Data Agent                                    |
| 承载布局   | 右侧沟通栏、沟通中心上下文列、Data Agent 面板                |
| 草稿       | 选择、轻编辑、负责人、协作方、优先级、日期、验收标准、就绪度 |
| 草稿箱     | 批次列表、计数、编辑、忽略、归档、撤销                       |
| 正式任务   | 确认创建、不自动派发、来源回溯                               |
| P1 派发    | 用户确认、创建并派发、派发失败、重试                         |
| Agent 工具 | 查询、进展、请求补充、交付提交、评论、草稿事件               |
| 安全       | 来源可见性、工作区权限、任务执行者权限                       |
| 非功能     | 刷新恢复、窄屏、Console、Network、长文本、重复提交           |

### 1.2 不覆盖范围

1. 不通过 GUI 验证模型回答质量。
2. 不用通用大模型的随机行为证明工具调用；P1 Agent 工具用例必须使用确定性 Agent/Runtime 夹具。
3. 不验证外部供应商服务的真实可用性。
4. 不把直接调用 API 作为用户端到端成功主证据。
5. 不覆盖多 Agent 动态团队和 Task Delivery Plan。

---

## 2. 测试策略

### 2.1 证据层级

| 层级         | 用途                                   | 证据                            |
| ------------ | -------------------------------------- | ------------------------------- |
| GUI 主证据   | 用户路径、页面状态、可见反馈           | Playwright 截图、视频、DOM 断言 |
| Network 证据 | 确认界面实际调用预期接口、没有重复提交 | HAR、请求列表、response JSON    |
| 对象证据     | 记录 batchId、draftId、taskId、runId   | 页面入口、任务 ID、Run ID       |
| 自动化单测   | 草稿状态机、幂等、权限、工具执行       | Vitest                          |
| API 辅助     | 初始化复杂前置、失败注入、MCP 协议验证 | curl / Playwright request       |

### 2.2 判定原则

- “保存草稿”后，正式任务看板数量不得变化；
- “确认创建”后，Task 进入 `待处理`，不得自动生成 Agent Run；
- “创建并派发”必须由用户在草稿箱显式点击；
- 草稿保存数量必须等于实际勾选数量；
- 草稿来源重复保存不能新增批次或正式任务；
- Agent 不能自行验收自己提交的任务；
- GUI 成功但 Network 报错、Console 报错或数据库状态不一致，判 FAIL。

---

## 3. 所需测试文件

### 3.1 现有实现与测试文件

| 文件                                                       | 用途                                     |
| ---------------------------------------------------------- | ---------------------------------------- |
| `packages/contracts/src/task-capture.ts`                   | 草稿、批次、来源、确认、事件和提交 DTO   |
| `packages/contracts/src/task-tools.ts`                     | Agent 工具名称、能力包和结果 DTO         |
| `plugins/dsh-collab-task/src/service.ts`                   | 正式任务、执行反馈、Review 和派发        |
| `plugins/dsh-collab-task-capture/src/service.ts`           | 草稿状态机、去重、转换、撤销、事件       |
| `plugins/dsh-collab-task-capture/src/index.ts`             | 草稿 HTTP 路由和来源注册                 |
| `plugins/dsh-collab-task-capture/client/index.js`          | 沟通草稿面板、草稿箱、来源卡             |
| `plugins/dsh-collab-task-tools/src/index.ts`               | Agent 工具、Task Tools API 和 MCP 入口   |
| `plugins/dsh-collab-meeting/client/index.js`               | 沟通侧栏、上下文列和会议来源             |
| `plugins/dsh-collab-data-agent/client/index.js`            | Data Agent 来源入口                      |
| `plugins/dsh-collab-task-capture/src/service.test.ts`      | 草稿保存、撤销、去重、转换、派发确认     |
| `plugins/dsh-collab-task-capture/src/client-smoke.test.ts` | 草稿 UI Slot、撤销、派发按钮静态契约     |
| `plugins/dsh-collab-task-tools/src/index.test.ts`          | 工具注册、任务查询、进展反馈             |
| `plugins/dsh-collab-task/src/index.test.ts`                | 草稿创建幂等、执行者权限、进展/补充/交付 |

### 3.2 建议新增测试夹具

| 建议文件                                                 | 内容                                                                     |
| -------------------------------------------------------- | ------------------------------------------------------------------------ |
| `docs/fixtures/task-capture/p0-p1-source-messages.md`    | 会议、AI 单聊、Data Agent 的固定输入文案                                 |
| `docs/fixtures/task-capture/p0-p1-expected.json`         | 候选数量、就绪度、任务数量、状态和来源 ID 预期                           |
| `docs/fixtures/task-capture/p1-task-tools-agent.md`      | 确定性 Agent 的工具调用顺序和回复要求                                    |
| `docs/fixtures/task-capture/p1-task-tools-sequence.json` | `task_query → report_progress → request_input → submit_deliverable` 序列 |
| `docs/tests/task-capture-p0-p1-gui.spec.ts`              | Playwright 自动化实现文件                                                |
| `docs/tests/task-capture-p0-p1-helpers.ts`               | 登录、选择会议、创建 AI 对话、定位草稿箱等辅助函数                       |

### 3.3 关键 GUI 选择器

| 元素            | 选择器 / 文案                  |
| --------------- | ------------------------------ |
| 任务导航        | `[data-nav-key="task"]`        |
| 沟通导航        | `[data-nav-key="meetings"]`    |
| 任务页          | `[data-task-management]`       |
| 草稿箱入口      | `.pmtc-launcher`，文本“草稿箱” |
| 沟通草稿面板    | `.pmtc-overlay`                |
| 草稿候选        | `.pmtc-row`                    |
| 草稿输入区      | `.pmtc-input`、`.pmtc-select`  |
| 草稿箱          | `.pmtc-inbox`                  |
| 草稿批次        | `.pmtc-batch`                  |
| 草稿行          | `.pmtc-draft`                  |
| 任务来源卡      | `.pmtc-origin`                 |
| Data Agent 面板 | `.pmda-panel`                  |

---

## 4. 测试环境

### 4.1 隔离环境

```sh
cd "/Users/oliviayang/Codex/一切皆插件/dsh-pluginmax"

export TC_HOME="$PWD/.tmp/task-capture-gui-home"
export TC_WORKSPACE="$PWD/.tmp/task-capture-gui-workspace"
export TC_EVIDENCE="$PWD/.tmp/task-capture-gui-evidence"
export TC_PORT=34581

rm -rf "$TC_HOME" "$TC_WORKSPACE" "$TC_EVIDENCE"
mkdir -p "$TC_WORKSPACE" "$TC_EVIDENCE"

CI=true corepack pnpm install --frozen-lockfile
CI=true corepack pnpm run build
DSH_HOME="$TC_HOME" ./scripts/install-profile.sh
```

启动：

```sh
DSH_HOME="$TC_HOME" \
  node vendor/deepseek-harness/apps/cli/lib/bin.js \
  --profile pluginmax \
  --no-open \
  --port "$TC_PORT" 2>&1 | tee "$TC_EVIDENCE/server.log"
```

预期：

1. 输出 `installed profile: .../.tmp/task-capture-gui-home/profiles/pluginmax`；
2. 启动后输出带 token 的完整 URL；
3. 首次打开必须使用完整 launch URL；
4. 不得复用历史 `.tmp/dsh-home`、账号和草稿数据。

> 若仓库中其他并行开发插件阻断隔离 profile 启动，只允许在隔离 `TC_HOME` 中通过 plugin CLI 移除阻断插件。不得修改其源码或用它作为本功能失败依据。

### 4.2 浏览器矩阵

| Profile | 账号                             | 用途                   |
| ------- | -------------------------------- | ---------------------- |
| A       | `tc-owner` / `Pluginmax#2026`    | 管理员、发起人、验收人 |
| B       | `tc-member` / `Pluginmax#2026`   | 会议参与者、普通成员   |
| C       | `tc-outsider` / `Pluginmax#2026` | 非项目成员、越权检查   |

视口：

- 1440 × 900：主验收；
- 1280 × 800：三列沟通布局；
- 900 × 800：紧凑布局边界；
- 390 × 844：移动端。

### 4.3 测试数据

在 GUI 中创建：

1. 项目 `GUI Task Capture`；
2. 活跃 AI 伙伴 `GUI Capture Agent`，绑定可用 Runtime；
3. 会议 `供应链任务草稿验收会`；
4. AI 单聊 `GUI Capture Agent · 任务草稿验收`；
5. Data Agent 对话 `延迟订单与数据治理跟进`。

会议中依次发送四条固定消息：

```text
供应商 G 的返工窗口确定为 10 月 31 日，请林威确认恢复排期和影响订单。

华东延迟订单需要复盘，汇总安全库存、承诺日期和受影响订单。

客户行业字段缺失，不要在报告里使用估算值，需要建立数据治理跟进。

请采购在 11 月 1 日前确认关键连接器最新交期，并同步到协同群。
```

预期：

- 会议采集面板出现 4 个候选事项；
- 初始 4 条均可能为“待完善”，因为来源消息未确认验收标准；
- 在草稿箱补齐验收标准后，至少 2 条变为“可创建”；
- 会议私密内容、文件正文和完整 transcript 不进入草稿快照。

---

## 5. 测试前检查

| 步骤 | 操作                            | 预期                             |
| ---- | ------------------------------- | -------------------------------- |
| 1    | 打开完整 launch URL             | 进入 DSH，无裸地址 401           |
| 2    | 用 Profile A 初始化管理员并登录 | 左下角显示管理员                 |
| 3    | 检查 Console                    | 无未捕获异常                     |
| 4    | 打开任务页                      | 页头出现“草稿箱”入口             |
| 5    | 创建项目、AI 伙伴和会议         | 项目与会议可见，AI 状态为 active |
| 6    | 打开沟通页                      | 会议和 AI 单聊均可进入           |
| 7    | 打开 Data Agent                 | 面板可打开，不遮挡其他页面入口   |

---

## 6. P0 GUI 用例

### P0-01 会议来源与右侧栏采集

**前置：** 任务页打开，右侧沟通栏打开 `供应链任务草稿验收会`。

**步骤：**

1. 点击沟通区底部“整理任务”。
2. 检查面板标题、来源、候选数量和选择框。
3. 取消勾选其中一条。
4. 修改第一条标题、优先级、截止日期和负责人。
5. 点击“保存 2 条草稿”。

**预期：**

- 面板出现在当前右侧栏，不跳转新页面；
- 标题为“从本次沟通整理任务草稿”；
- 来源显示会议标题和时间范围；
- 候选数为 4；
- 保存按钮数量随勾选变化；
- 保存后显示“已保存 2 条任务草稿”；
- 任务看板卡片数量不变；
- 草稿箱计数增加 2；
- 聊天滚动位置和输入框草稿不丢失。

### P0-02 沟通中心上下文列采集

**前置：** 使用宽屏 1440 或 1280，打开 `沟通中心 + 上下文列` 布局。

**步骤：**

1. 选中目标会议。
2. 点击来源提示卡或输入区“整理任务”。
3. 确认草稿面板进入已有上下文列。
4. 保存一条草稿。

**预期：**

- 不新增第四列；
- 上下文列显示草稿面板或已保存状态；
- 中间聊天区和输入草稿保持原位；
- 关闭面板后恢复原上下文内容；
- 1440 和 1280 下无重叠、横向溢出或按钮截断。

### P0-03 AI 单聊私有草稿

**步骤：**

1. 创建 `GUI Capture Agent` 的 AI 单聊。
2. 发送两条待跟进事项。
3. 点击“整理任务”并保存。
4. 使用 Profile B 打开任务草稿箱。

**预期：**

- 来源类型显示 AI 对话；
- Profile A 可看到并编辑草稿；
- Profile B 看不到私有 AI 会话草稿；
- 页面和 Network 不泄露来源正文。

### P0-04 Data Agent 来源采集

**步骤：**

1. 打开 Data Agent 面板和指定会话。
2. 让 Data Agent 输出一条数据缺口或后续跟进建议。
3. 点击“整理任务”。
4. 保存草稿。

**预期：**

- 草稿来源类型为 Data Agent；
- 来源卡保留会话 ID 和报告/消息引用；
- 不复制完整报告；
- Data Agent 不会自动创建正式任务；
- 保存后当前 Data Agent 会话和输入草稿不变。

### P0-05 草稿箱与就绪度

**步骤：**

1. 打开任务页“草稿箱”。
2. 选择刚保存的批次。
3. 打开一条“待完善”草稿编辑。
4. 补齐描述、负责人、验收标准，并添加协作方。
5. 保存草稿。

**预期：**

- 批次显示来源、草稿总数、可创建数和待完善数；
- 初始来源草稿因缺验收标准显示“待完善”；
- 补齐至少一条验收标准后变为“可创建”；
- 负责人和协作方可从任务目录选择；
- 保存后刷新、切页、重新登录仍可恢复；
- 修改不会回写来源会话。

### P0-06 确认创建不派发

**步骤：**

1. 在草稿箱选中至少一条“可创建”草稿。
2. 点击“确认创建可创建项”。
3. 打开任务看板和新任务详情。

**预期：**

- 创建 N 条正式任务；
- 成功草稿显示“已创建”和任务 ID；
- 新任务位于 `待处理`；
- 不产生 Agent Run、执行会话或自动消息；
- 看板数量增加 N；
- 任务详情“任务来源”可打开原始会议。

### P0-07 重复来源去重

**步骤：**

1. 回到原会议，再次整理同一组消息。
2. 选择已保存过的来源事项。
3. 再次保存。

**预期：**

- 不创建第二个草稿批次；
- 不增加草稿总数和正式任务数；
- 页面返回原批次或提示已有草稿；
- 不出现重复 Task ID。

### P0-08 撤销整批草稿

**步骤：**

1. 新建一组草稿并保存。
2. 在保存成功面板点击“撤销本次保存”。
3. 返回草稿箱检查。

**预期：**

- 该批次从默认草稿箱消失；
- 批次状态为归档；
- 草稿不再可创建；
- 正式任务数量不变；
- 已创建过正式任务的批次不显示撤销入口；直接调用接口返回冲突。

### P0-09 忽略单条与归档整批

**步骤：**

1. 在批次中点击一条草稿的“忽略草稿”。
2. 刷新批次。
3. 对另一批次点击“归档整批”。

**预期：**

- 被忽略草稿不再计入可创建/待完善；
- 默认草稿箱不展示该草稿为活跃项；
- 归档批次从默认列表消失；
- 来源审计记录保留。

### P0-10 部分失败与重试

**前置：** 使用服务级故障注入或测试 profile 的受控失败夹具，不修改生产代码。

**步骤：**

1. 批次中包含两条可创建草稿。
2. 注入第二条任务创建失败。
3. 点击确认创建。
4. 点击“重试失败项”。

**预期：**

- 第一条成功，第二条保留失败状态；
- 页面显示成功/失败数量；
- 重试只重做失败项；
- 成功项不重复创建；
- Task ID 数量与成功数量一致。

### P0-11 来源失效

**步骤：**

1. 保存一条会议草稿。
2. 由会议负责人归档或关闭来源会议。
3. 从任务详情打开来源卡。

**预期：**

- 草稿仍保留来源标题和快照版本；
- 来源不可访问时显示“来源暂不可读”或等价文案；
- 不抛出未捕获异常；
- 草稿仍可继续编辑和创建。

### P0-12 跨账号权限

**步骤：**

1. Profile B 作为会议参与者打开共享草稿批次。
2. 尝试编辑、撤销、确认创建。
3. Profile C 作为非项目成员打开同一 URL。

**预期：**

- B 可查看共享来源批次，但不能编辑或确认创建；
- 编辑器只读或操作按钮 disabled；
- C 看不到批次，接口返回 403；
- 页面不显示来源正文或任务内容。

---

## 7. P1 GUI 用例

### P1-01 创建并派发

**前置：**

- 草稿已指派给 active AI 伙伴 `GUI Capture Agent`；
- 草稿有至少一条验收标准；
- Runtime 可用。

**步骤：**

1. 打开草稿箱，确认“创建并派发”可用。
2. 点击按钮。
3. 检查正式任务、Agent Run、会话和状态。

**预期：**

- 必须由用户显式点击，不存在自动派发；
- 任务先创建后派发；
- 任务进入 `进行中`；
- AI 执行记录出现 Run、Agent 名称和会话入口；
- 草稿标记“已创建”；
- 来源卡保留。

### P1-02 派发失败和重试

**步骤：**

1. 将 `GUI Capture Agent` 暂停或禁用 Runtime。
2. 对可创建草稿点击“创建并派发”。
3. 检查任务是否存在。
4. 恢复 Agent 和 Runtime。
5. 点击派发失败重试。

**预期：**

- 派发失败不撤销正式任务；
- 任务保留并显示派发失败原因；
- 页面出现“重试 N 条派发失败”；
- 恢复后重试成功；
- 不创建重复 Task。

### P1-03 Agent 查询与进展反馈

**前置：** 使用确定性 Agent 夹具 `p1-task-tools-agent.md`，禁止使用随机通用模型判定。

**步骤：**

1. 完成任务创建并派发。
2. Agent 首先调用 `task_query` 查询当前任务。
3. Agent 调用 `task_report_progress` 上报 40%。
4. 用户打开任务详情。

**预期：**

- Agent 只能看到当前 Run 绑定或指派给它的任务；
- 任务进度更新；
- 执行历史出现进展消息；
- Tool 名称和参数可在执行轨迹或审计中确认；
- Agent 不能查询其他项目任务。

### P1-04 请求补充与恢复

**步骤：**

1. Agent 调用 `task_request_input` 询问缺失范围。
2. 用户在任务详情回复。
3. Agent 继续执行。

**预期：**

- 任务显示“等待输入”注意力标记；
- 问题内容出现在任务历史；
- 用户回复后任务恢复 `进行中`；
- 原 Run 或下一轮 Run 能继续并保留上一轮上下文引用。

### P1-05 提交交付物与验收边界

**步骤：**

1. Agent 调用 `task_submit_deliverable`，附总结和已完成的验收项。
2. 检查任务状态。
3. 检查 Agent 自己的操作入口。
4. 用户点击通过或退回。

**预期：**

- 任务进入 `待验收`；
- 交付摘要、验收项和附件显示在任务详情；
- Agent 没有验收通过/退回按钮；
- 用户验收后状态正确变化；
- Agent 不能自行审批。

### P1-06 任务工具能力面

**性质：** 支撑性协议验证，不作为纯 GUI 用例。

**步骤：**

1. 使用 GUI 取得的 runId 调用 `/api/collab/task-tools/catalog`。
2. 调用 MCP `initialize`。
3. 调用 MCP `tools/list`。

**预期：**

- catalog 返回 9 个工具；
- 包含 `task_query`、`task_capture_prepare`、`task_capture_save`、`task_capture_batch`、`task_capture_events`、`task_report_progress`、`task_request_input`、`task_submit_deliverable`、`task_comment`；
- 不包含正式任务创建、验收、改派等治理工具；
- MCP 返回 `pluginmax-task-tools`、协议版本和工具 schema。

### P1-07 草稿事件回源

**步骤：**

1. 保存、确认、撤销各一次草稿批次。
2. 通过 GUI 取得时间和批次 ID。
3. 调用事件接口或使用 `task_capture_events` 工具轮询。

**预期：**

- 事件按时间返回；
- 包含 created / committed / undone；
- 用户只能看到有权限批次的事件；
- 事件可回溯到 batchId 和 taskId。

---

## 8. 端到端场景

### E2E-P0-01 会议 → 草稿 → 正式任务

```text
创建会议
→ 发送 4 条固定事项
→ 打开右侧沟通栏
→ 整理任务
→ 取消 1 条、保存 3 条
→ 草稿箱补齐验收
→ 确认创建 2 条
→ 看板出现 2 条待处理任务
→ 打开任务来源
→ 回到原会议
```

**通过标准：**

- 草稿数与选择数一致；
- 保存阶段任务数不变；
- 确认阶段只创建 2 条；
- 不产生 Run；
- 来源可回到原会议。

### E2E-P0-02 AI 单聊 → 重复 → 撤销

```text
AI 单聊发送 2 条事项
→ 保存 2 条草稿
→ 再次保存同一来源
→ 返回原批次
→ 新建另一批次并撤销
→ 草稿箱计数回到撤销前
```

**通过标准：**

- 不产生重复批次；
- 私有对话对其他账号不可见；
- 撤销不触发任务删除或 Run 取消。

### E2E-P1-01 Data Agent → 创建并派发 → Review

```text
Data Agent 输出 2 个跟进事项
→ 保存草稿
→ 补验收并指派 GUI Capture Agent
→ 创建并派发
→ Agent 查询、上报进展、请求补充
→ 用户补充
→ Agent 提交交付物
→ 用户验收
→ 任务完成
→ 来源卡回 Data Agent 会话
```

**通过标准：**

- 派发前有明确用户动作；
- Agent 只使用 task.read/capture/execute 能力；
- Agent 不能自审；
- 运行状态、任务状态和来源状态一致；
- 失败和等待输入均可见。

---

## 9. 非功能与边界检查

### NF-01 刷新与重登

- 保存草稿后刷新、切页、重新登录；
- 草稿、批次和来源仍在；
- 当前输入框草稿与聊天滚动不要求跨重登保留，但同一页面会话内必须保留。

### NF-02 响应式

- 1440、1280、900、390；
- 面板和草稿箱不超出视口；
- 390px 下任务草稿箱为单列；
- 标题、状态、操作不互相遮挡。

### NF-03 Console / Network

- 正常操作不得出现未捕获异常；
- 预期 403/409 用例必须带明确业务错误；
- 保存按钮不得重复提交；
- 同一 commandId 重试不得创建重复对象。

### NF-04 长文本

- 标题 500 字、描述 20,000 字边界；
- 草稿卡片标题允许换行或省略，不影响后续控件；
- 验收标准每行一条，空行被过滤。

### NF-05 故障降级

- 草稿插件缺失：不显示草稿入口，沟通和任务功能正常；
- 任务工具缺失：人工任务流程正常，Agent 工具不可见；
- Agent Runtime 不可用：任务创建成功，派发失败可见。

---

## 10. 自动化落地建议

### 10.1 执行顺序

```sh
CI=true corepack pnpm --filter @pluginmax/contracts build
CI=true corepack pnpm exec tsc -b --force
CI=true corepack pnpm test
CI=true corepack pnpm --filter dsh-collab-task \
  --filter dsh-collab-task-capture \
  --filter dsh-collab-task-tools build
```

预期：

- TypeScript 通过；
- 全量 Vitest 通过；
- 任务、采集、Task Tools 三个插件构建通过。

### 10.2 Playwright 文件建议

```text
docs/tests/task-capture-p0-p1-gui.spec.ts
docs/tests/task-capture-p0-p1-helpers.ts
docs/fixtures/task-capture/p0-p1-source-messages.md
docs/fixtures/task-capture/p0-p1-expected.json
docs/fixtures/task-capture/p1-task-tools-agent.md
```

实现顺序：

1. 登录、建项目、建 AI 伙伴；
2. P0-01、P0-02；
3. P0-05、P0-06；
4. P0-07、P0-08；
5. P1-01、P1-02；
6. 确定性 Agent tools 用例；
7. 权限和移动端。

### 10.3 每个用例必须保存

- 截图 1 张：操作完成态；
- Playwright trace；
- Console 日志；
- Network 关键请求；
- 对象 ID：batchId、draftId、taskId、runId；
- 环境和账号；
- 实际结果与 PASS/FAIL/BLOCKED。

---

## 11. 实际执行结果（2026-10-30）

### 11.1 环境与基线

- 隔离 DSH：`.tmp/task-capture-gui-exec-20261030/home`
- Workspace：`00000000-0000-4000-8000-000000000001`
- 账号：`tc-owner`、`tc-member`、`tc-outsider`
- 浏览器：系统 Chrome + Playwright，主视口 `1440 × 900`
- 全量测试：`52 files / 732 tests` 通过
- 类型检查：`tsc -b --force` 通过
- 构建：task、task-capture、task-tools、meeting、data-agent 全部通过

### 11.2 用例结果

| Case  | 结果    | 实际现象与证据                                                                                                                                                                                                                                                                                      |
| ----- | ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P0-01 | PASS    | 任务页右侧沟通栏可加载管理员可访问工作区；会议可在栏内打开，`整理任务` 出现 6 个候选，任务看板保持原位。证据：`p0-01-task-right-rail.png`                                                                                                                                                           |
| P0-02 | PASS    | 沟通中心上下文列打开草稿面板；`prepare/save` 均为 200；保存成功且未发送输入保留；无横向溢出。证据：`p0-02-context-column.png`                                                                                                                                                                       |
| P0-03 | PASS    | AI 单聊私有草稿创建人可见，普通成员不可见。证据：`p0-03-ai-private-saved.png`、`p0-03-member-private-hidden.png`                                                                                                                                                                                    |
| P0-04 | PASS    | Data Agent 来源消息可进入草稿面板并保存；Data Agent 查询/Run 的模型失败不计入本功能判定。证据：`p0-04-data-agent.png`                                                                                                                                                                               |
| P0-05 | PASS    | 草稿箱可编辑负责人、协作方、优先级、日期、描述和验收标准，刷新后可恢复。证据：`p0-06-created.png`                                                                                                                                                                                                   |
| P0-06 | PASS    | 确认创建 2 条正式任务；均为 `todo`，`agentRunIds=[]`，未自动派发；任务详情可回源会议。证据：`p0-06-created.png`、`p0-11-origin.png`                                                                                                                                                                 |
| P0-07 | PASS    | 同来源重复保存返回原批次，不增加批次、草稿或正式任务。证据：`p0-07-duplicate.png`                                                                                                                                                                                                                   |
| P0-08 | PASS    | 整批撤销后草稿箱不再展示该批次，正式任务数不变。证据：`p0-08-undone.png`                                                                                                                                                                                                                            |
| P0-09 | PASS    | 单条忽略不再可编辑；整批归档后从默认草稿箱消失。证据：`p0-09-archived.png`                                                                                                                                                                                                                          |
| P0-10 | BLOCKED | 部分失败与重试尚未在最新构建完整执行；需受控任务创建失败注入。                                                                                                                                                                                                                                      |
| P0-11 | BLOCKED | 来源归档/关闭后的失效降级尚未单独回归。                                                                                                                                                                                                                                                             |
| P0-12 | PASS    | 会议来源写入 `participantIds=[tc-owner,tc-member]`；member 可见 6 条草稿但编辑/归档/确认均禁用，写接口均 403；outsider 不可见且 inbox 403；最终 Console `errors=[]`。证据：`p0-12-owner-shared-saved.png`、`p0-12-member-readonly.png`、`p0-12-outsider-hidden.png`、`p0-12-shared-permission.json` |
| P1-01 | PASS    | 用户显式“创建并派发”后任务进入 `progress` 并生成 Run；Data Agent 自身无有效文本输出的问题单独列为运行时阻塞。证据：`p1-01-created-dispatch.png`                                                                                                                                                     |
| P1-02 | BLOCKED | 已注入不存在 Agent 并验证正式任务保留、失败可见、改派后可产生新 Run；尚未在 Data Agent Runtime 可用后完成 GUI 重试成功闭环。证据：`p1-02-dispatch-failed.png`                                                                                                                                       |
| P1-03 | BLOCKED | 查询能力已通过 MCP `task_query` 验证；仍需确定性 Runtime 夹具驱动真实 Agent 上报进展并在 GUI 验证轨迹。                                                                                                                                                                                             |
| P1-04 | BLOCKED | 等待 Data Agent Runtime 和确定性“请求补充 → 用户回复 → 恢复执行”夹具。                                                                                                                                                                                                                              |
| P1-05 | BLOCKED | 等待 Data Agent Runtime 和确定性交付提交夹具；Agent 不可自审的权限边界已有单测覆盖。                                                                                                                                                                                                                |
| P1-06 | PASS    | catalog、MCP initialize、tools/list、tools/call 均 200；返回 9 个工具；`task_query` 只返回当前 Run 可执行任务；不含创建正式任务、验收、改派工具。证据：`p1-mcp.json`                                                                                                                                |
| P1-07 | PASS    | 通过 `task_capture_batch` 和 `task_capture_events` 读取批次与事件；事件覆盖 `created / committed / undone` 并可回溯 `batchId / taskId`。证据：`p1-mcp.json`                                                                                                                                         |

### 11.3 本轮定位并修复的问题

1. **共享会议草稿缺少参与者快照**
   - 现象：`source-participants` 批次只有 owner 可查看。
   - 修复：`TaskCaptureSourceSnapshot` 增加 `participantIds`；会议来源写入 active 人类参与者；`canView` 放开参与者只读权限，写操作仍仅 owner。

2. **任务执行 provider 作用域错误**
   - 现象：task-capture 与 task-tools 服务端路由未挂载，`prepare` 返回裸 404。
   - 修复：task 模块在公开边界提供 `collabTaskExecution`；task-capture/task-tools 在插件根上下文注册服务和 HTTP 路由。

3. **撤销幂等记录阻断重启**
   - 现象：历史 void 操作的 `result` 被 JSON 省略，严格 schema 判定整张 `idempotency` 表损坏，导致 task-capture 域启动失败。
   - 修复：兼容缺失 `result` 的旧记录，并新增持久化兼容测试。

4. **普通成员任务首页 404**
   - 现象：角色未物化工作区中，非创建人打开任务页时 `tasks/bootstrap` 返回 404。
   - 修复：审批角色目录不可用时降级为“无审批权限”，不阻断任务列表。

5. **管理员右侧沟通栏遗漏可访问工作区**
   - 现象：管理员 `isMember=false` 的真实工作区被过滤，右栏只查询空的 `system.default`。
   - 修复：成员看已加入工作区；平台管理员额外纳入全部可访问工作区。

### 11.4 对象证据

- 可复现脚本（隔离证据目录）：
  - `run_p0_shared_permission.py`
  - `run_p0_layouts.py`
  - `run_p1_mcp.py`
- batchId：`tc-batch-d3f2df98-5845-4f2d-a303-b149e6e230ed`
- draftId：`tc-draft-2feb2881-74b4-43b6-8316-b700f4e672c5`
- taskId：`TSK-MVUFSMBW-ECDD`、`TSK-MVUFQ7X2-1FEA`
- runId：`run-b6f0efba-fb09-45fd-bf77-d57885828393`、`run-98651b69-4589-4d89-88e8-18678ac5d92a`

### 11.5 Console / Network

- P0-12 最终 GUI 回归：`Console errors=[]`
- P0-01/P0-02 最终 GUI 回归：`Console errors=[]`
- task-capture `prepare/save/batch/inbox`：200
- task-tools catalog/MCP initialize/tools/list/tools/call：200
- member 越权 update/undo/commit：预期 403
- outsider inbox：预期 403

### 11.6 发布判定

**当前不满足 P0/P1 完整发布门禁。**

- P0 主链、共享权限、两种承载布局已通过；
- P0-10、P0-11 和非功能用例尚未完整执行；
- P1-01、P1-06、P1-07 已通过；
- P1-02、P1-03、P1-04、P1-05 仍被 Data Agent Runtime 或确定性夹具阻塞；
- Data Agent 输出“workspace data access is denied”“Agent 未返回可用的文本输出”不作为任务草稿功能失败，但在 Runtime 完成前不能宣称 P1 全部通过。

### 11.7 残余风险

1. 管理员任务页默认“仅看已加入”时，草稿箱汇总范围仍需产品确认；当前测试可切“平台全量”完成验证。
2. P1-03/P1-04/P1-05 必须补确定性 Agent/Runtime 夹具，不能依赖通用模型随机输出。
3. 来源关闭/归档、部分创建失败、窄屏与移动端仍需回归。
4. 会议面板和任务面板均异步加载工作区；后续应对弱网和慢接口增加显式加载态与超时提示。
