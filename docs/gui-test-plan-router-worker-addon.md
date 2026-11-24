# Router / Worker 任务规划 Add-on GUI 测试方案

> 版本：v0.3  
> 日期：2026-11-08  
> 对应实现：`dsh-collab-router-worker`  
> 对应设计：`../设计文档-RouterWorker任务规划扩展插件.md`  
> 对应技术设计：`../技术设计-统一工作流实例承载Router-TaskDAG编排.md`

> v0.2 更新：Router 改为可指定、计划创建时固化的独立 Agent；人类负责人
> 完成后生成交付草稿且保持 progress，Agent 负责人才自动提交 Review；
> 补充真实 Router Cycle、受信 Session 绑定和 GUI 端到端证据要求。
>
> v0.3 更新：新增计划确认人快照；Router 子任务的 `createdBy/createdByName`
> 与 Run 归属统一继承计划确认人，不再随物化操作人变化；补充异常状态与
> 自动 Review 证据门槛联调用例。

## 0. 结论先行

当前实现尚未完整覆盖产品设计文档和交互 Demo。本文不是“已全部完成”的
验收报告，而是一份可直接执行的 GUI 测试方案，并把现状标记为：

- `IMPLEMENTED`：已有可运行实现，关键链路已完成实测。
- `PARTIAL`：已有基础实现，但产品范围不完整或只覆盖部分路径。
- `NOT IMPLEMENTED`：当前无完整 GUI/产品行为。
- `KNOWN GAP`：已确认的平台级或产品级缺口。

当前判断：

| 产品域 | 状态 | 说明 |
| --- | --- | --- |
| 默认关闭与设置入口 | IMPLEMENTED | Settings icon、Workspace gate、启停即时应用已有实现 |
| 关闭态惰性 | PARTIAL | 不渲染计划、不请求计划 API、不启动后台任务；bundle 仍由宿主加载 |
| 人工任务路线图 | PARTIAL | 可创建基础计划、增减节点、编辑负责人和依赖；完整产品交互仍需验收 |
| 图 / 列表 View | IMPLEMENTED | 两种 View 使用同一 Graph Snapshot |
| 子任务右侧详情 | PARTIAL | 页签壳已替换，AI 执行记录/产出文档/任务动态仍以占位或基础数据为主 |
| 计划设置 | PARTIAL | 推进、并发、失败策略、汇总者等基础设置存在；完整 Demo 字段未全部覆盖 |
| 人类 Task 物化 | IMPLEMENTED | 通过公开 Task API 创建普通任务 |
| AI Worker 派发 | PARTIAL | 复用现有 Task Dispatcher；GUI 端到端仍需验证 |
| 计划确认人继承 | IMPLEMENTED | 子任务创建人和 Run 归属固定为计划确认人；物化操作人、任务创建人、Router 均不能覆盖 |
| Router Plan Draft | IMPLEMENTED | 已通过真实 Router Agent 会话生成并提交结构化 Plan Draft |
| 模板 WorkflowInstance 桥接 | PARTIAL | 有服务端桥接 API；GUI 模板实例流程未完整验收 |
| Reconciler 推进与汇总 | PARTIAL | 有定时对账、依赖推进和最终 Router Cycle；按人类/AI 负责人走草稿或 Review 收口，故障恢复需实测 |
| 权限交集 | IMPLEMENTED | 共享权限解析接入 Task/Workflow；GUI 权限矩阵待实测 |
| 关闭时不加载前端 bundle | KNOWN GAP | 需要宿主 Workspace-scoped Client Module activation |

## 1. 测试目标

1. 证明插件关闭时，除设置图标外现有任务管理和工作流行为保持不变。
2. 证明设置开关在当前 Workspace 内即时生效，不要求页面刷新。
3. 验证人工计划、Router 计划和模板实例三种入口最终进入同一执行计划 UI。
4. 验证图/列表为同一份计划数据，节点选择同步右侧页签。
5. 验证节点编辑、负责人变更、依赖搜索和循环依赖阻断。
6. 验证计划确认后通过现有 Task API 幂等创建 Task，不绕过任务状态机。
7. 验证人类和 AI Worker 都能使用现有任务执行、评论、附件、产出和 Review 能力。
8. 验证 Reconciler 推进依赖、恢复漏事件，并按负责人类型生成草稿或提交人工 Review。
9. 验证节点有效权限始终为“项目权限范围 ∩ 任务负责人权限范围”。
10. 验证关闭、重开、服务重启和运行中计划的安全停点。

## 2. 非目标

- 不修改或重写现有任务看板、任务详情、工作流模板执行和权限模型。
- 不用 GUI 伪造 Router 的结构化 Plan Draft。
- 不允许 Router 或 Worker 代签人工审批和不可逆 Gate。
- 不把“bundle 已加载但完全惰性”误判为“bundle 未加载”。
- 不把响应式冒烟替代桌面端完整功能验收。

## 3. 测试环境

### 3.1 隔离环境

不要复用用户正在使用的 DSH 数据。建议：

```sh
cd /Users/oliviayang/Codex/一切皆插件/dsh-pluginmax
export PLUGINMAX_SMOKE_HOME="$PWD/.tmp/router-worker-gui-home"
export PLUGINMAX_SMOKE_PORT=33126
./scripts/install-profile.sh
```

启动：

```sh
DSH_HOME="$PWD/.tmp/router-worker-gui-home" \
  node vendor/deepseek-harness/apps/cli/lib/bin.js \
  --profile pluginmax --no-open --port 33126
```

浏览器使用启动输出中的完整 `?token=` URL。若页面已经存在账号，不要重复
bootstrap；先通过现有账号登录。

### 3.2 前置数据

| Fixture | 要求 |
| --- | --- |
| Workspace A | 当前功能测试项目，至少 3 名成员 |
| Workspace B | 用于验证 Workspace gate 隔离 |
| 人类负责人 Alice | 同时在人类执行和 Review 场景使用 |
| AI Principal Worker | 有 active Principal Runtime Profile |
| 数字员工 Worker | 有 active Role Assignment 和 Runtime Profile |
| Router Agent | 有 active Principal Runtime Profile 和 Router 权限 |
| 项目角色 Reviewer | 具备 `approve` 权限 |
| 普通主任务 | 人工创建、无既有计划 |
| Router 主任务 | 普通人类或 Agent 负责人均可；Workspace 已配置默认 Router Agent |
| 模板 | 至少一个 active Workflow Definition 和一个 role executor |
| 权限缺口 Agent | Runtime Profile 存在但资源/工具授权不完整 |

### 3.3 构建门禁

GUI 使用 `lib/` 构建产物，执行 GUI 前至少运行：

```sh
./node_modules/.bin/tsc -p tsconfig.test.json --noEmit
./node_modules/.bin/vitest run
node scripts/contract.mjs
PLUGINMAX_SMOKE_PORT=33126 ./scripts/smoke.sh
```

## 4. 基线采集

关闭态测试前先采集基线：

1. 在启用插件前记录任务看板截图。
2. 记录任务详情四个现有页签截图。
3. 录制 HAR：任务列表、详情、创建任务、改派、状态、评论、附件、Review。
4. 保存规范化 DOM：
   - 删除允许新增的设置图标节点。
   - 保留 class、id、aria、data 属性。
   - 比较前后 DOM 差异。
5. 记录页面加载资源列表：
   - 标记 Router Worker bundle 是否被请求。
   - 当前预期会看到 bundle 请求，因此 bundle 级关闭用例应记为 `KNOWN GAP`。
6. 记录 Console 和 Network 错误。

视口至少覆盖：

- `1440 × 900`
- `1280 × 800`
- `1024 × 768`
- `390 × 844`

## 5. GUI 用例

### A. 关闭态基线

| ID | 状态 | 操作 | 预期 |
| --- | --- | --- | --- |
| RW-GUI-001 | IMPLEMENTED | 打开 Workspace A 任务管理页 | 除右上角设置图标外，布局、筛选、列、文案与基线一致 |
| RW-GUI-002 | IMPLEMENTED | 观察任务卡和任务详情 | 无主任务标签、无任务规划、无 DAG、无子任务入口 |
| RW-GUI-003 | IMPLEMENTED | 等待 30 秒，不点击设置 | 无 `/api/collab/router-worker/*` 请求、无轮询 |
| RW-GUI-004 | IMPLEMENTED | 检查 Console / Performance | 无 Router/Worker Dispatcher、Reconciler、Router 定时器 |
| RW-GUI-005 | PARTIAL | 创建任务、改派、改状态、评论、附件、验收 | 全部沿用原 Task 行为 |
| RW-GUI-006 | PARTIAL | 打开现有 Workflow 模板和实例 | 全部沿用原 Workflow 行为 |
| RW-GUI-007 | IMPLEMENTED | 点击设置图标 | 只打开扩展设置，不出现计划入口 |
| RW-GUI-008 | KNOWN GAP | 检查启动资源 | 当前 bundle 仍由 DSH 宿主加载；本用例预期失败并记录为平台缺口 |

### B. 扩展设置与 Workspace Gate

| ID | 状态 | 操作 | 预期 |
| --- | --- | --- | --- |
| RW-GUI-101 | IMPLEMENTED | 打开 Workspace A 设置 | 默认显示“未启用” |
| RW-GUI-102 | IMPLEMENTED | 从任务看板右上角启用扩展 | 不刷新即出现“任务规划”入口；设置图标仍只在看板页 |
| RW-GUI-103 | IMPLEMENTED | 关闭扩展 | 计划 UI 立即卸载，恢复原任务详情布局 |
| RW-GUI-104 | IMPLEMENTED | 关闭后检查 Network | 无计划列表、详情、轮询请求 |
| RW-GUI-105 | IMPLEMENTED | 切到 Workspace B | Workspace B 仍默认关闭 |
| RW-GUI-106 | IMPLEMENTED | Workspace A 启用、Workspace B 关闭，来回切换 | gate 状态不串台 |
| RW-GUI-107 | PARTIAL | 两个浏览器登录同一账号并切换 | 服务端状态一致；第二个浏览器 UI 是否能无刷新同步需补测 |
| RW-GUI-108 | PARTIAL | 非成员直接调用设置/计划 API | 服务端拒绝；GUI 不应暴露成功状态 |
| RW-GUI-109 | IMPLEMENTED | 打开任务详情顶栏 | 不显示扩展设置图标 |
| RW-GUI-110 | IMPLEMENTED | 查看右侧任务操作区 | “任务规划”与催办、取消等操作位于同一区域 |

### C. 人工任务路线图

| ID | 状态 | 操作 | 预期 |
| --- | --- | --- | --- |
| RW-GUI-201 | IMPLEMENTED | 普通主任务右侧操作区点击“任务规划” | 只替换中栏，右侧保留任务详情页签壳 |
| RW-GUI-202 | IMPLEMENTED | 创建默认路线图 | 生成 v1 draft，展示一个可编辑节点 |
| RW-GUI-203 | IMPLEMENTED | 点击“添加任务” | 可新增节点并保存新 Plan Version |
| RW-GUI-204 | IMPLEMENTED | 编辑节点标题、描述、负责人、验收 | 保存后图/列表和右侧详情同步 |
| RW-GUI-205 | IMPLEMENTED | 删除无下游依赖节点 | 节点移除；有下游依赖时阻止删除 |
| RW-GUI-206 | IMPLEMENTED | 查看计划抬头 | 展示主任务 ID、名称、任务规划标签、责任人、验收人、优先级、DDL、完成数和进度 |
| RW-GUI-207 | PARTIAL | 图 / 列表切换 | 两者节点、顺序和依赖数据一致；图布局和连线仍需视觉验收 |
| RW-GUI-208 | IMPLEMENTED | 点击图节点或列表行 | 中间选中态与右侧子任务详情同步 |
| RW-GUI-209 | PARTIAL | 检查右侧四页签 | 基础信息可用；AI 执行记录、产出文档、任务动态待补实际内容 |

### D. 依赖与循环校验

| ID | 状态 | 操作 | 预期 |
| --- | --- | --- | --- |
| RW-GUI-301 | IMPLEMENTED | 打开节点前置任务编辑器 | 已选项显示为 chip，不止有复选框矩阵 |
| RW-GUI-302 | IMPLEMENTED | 搜索标题、负责人或状态 | 候选即时过滤 |
| RW-GUI-303 | IMPLEMENTED | 选择会形成循环的节点 | 候选禁用并提示“会形成循环”，不能添加 |
| RW-GUI-304 | IMPLEMENTED | 添加合法依赖并保存 | 新版本保存，列表/图/右侧同步 |
| RW-GUI-305 | IMPLEMENTED | 移除依赖 | 保存后后续节点 readiness 正确重算 |
| RW-GUI-306 | IMPLEMENTED | 服务端直接提交循环 DAG | API 拒绝，GUI 显示可理解错误 |

### E. 计划设置

| ID | 状态 | 操作 | 预期 |
| --- | --- | --- | --- |
| RW-GUI-401 | PARTIAL | 打开计划设置 | 展示推进方式、并发、超时、失败策略、最终验收、澄清暂停、Router 汇总者、Worker 类型 |
| RW-GUI-402 | IMPLEMENTED | 保存推荐设置 | 新 Plan Version 保存，重新打开可回显 |
| RW-GUI-403 | IMPLEMENTED | 尝试不选任何 Worker 类型 | 阻止保存 |
| RW-GUI-404 | IMPLEMENTED | 查找通知配置 | 计划设置中不得出现通知配置 |
| RW-GUI-405 | IMPLEMENTED | 检查顶部摘要 | 不得重复显示任务摘要卡 |
| RW-GUI-406 | IMPLEMENTED | 检查权限说明 | 明确显示“项目权限范围 ∩ 任务负责人权限范围” |

### F. 计划确认、物化与人类执行

| ID | 状态 | 操作 | 预期 |
| --- | --- | --- | --- |
| RW-GUI-501 | IMPLEMENTED | 确认合法计划 | 计划进入 approved |
| RW-GUI-502 | IMPLEMENTED | 点击“创建并派发” | 通过 Task API 创建普通 Task；重复点击不重复创建 |
| RW-GUI-503 | IMPLEMENTED | 打开已物化 Task | 任务详情与现有 Task 页面一致 |
| RW-GUI-504 | PARTIAL | 人类 Worker 开始、评论、上传附件、提交结果 | 沿用原任务流；需完整 GUI 回归 |
| RW-GUI-505 | PARTIAL | 人类 Worker 请求澄清 | 节点进入 needs_input，下游暂停 |
| RW-GUI-506 | IMPLEMENTED | 点击确认计划前存在非法 DAG | 禁止确认和派发 |
| RW-GUI-507 | IMPLEMENTED | 已存在同一主任务计划时再次创建 | 返回已有计划，不重复建计划 |

### G. AI Worker 执行

| ID | 状态 | 操作 | 预期 |
| --- | --- | --- | --- |
| RW-GUI-601 | PARTIAL | 将节点指派给 AI Principal | Validator 计算项目 ∩ Principal 权限 |
| RW-GUI-602 | PARTIAL | 确认计划并派发 Agent 节点 | 复用现有 Task Dispatcher 和 Run/Job |
| RW-GUI-603 | PARTIAL | 查看 AI 执行记录 | Run、阶段、工具、输出可见或明确标注不可见 |
| RW-GUI-604 | PARTIAL | 将节点改派给另一个 AI Worker | 不继承原负责人权限，派发前重新校验 |
| RW-GUI-605 | PARTIAL | 使用权限不足的 AI Worker | Dispatcher 阻止派发并展示缺口 |
| RW-GUI-606 | PARTIAL | Agent 输出提交到 Review | 不会自动通过人工 Review |

### H. Router 规划

| ID | 状态 | 操作 | 预期 |
| --- | --- | --- | --- |
| RW-GUI-701 | IMPLEMENTED | 人类或 Agent 负责人打开任务规划，先选择“自动解析执行计划”，再选择 Router Agent 并开始解析 | 创建独立 Router Cycle，不依赖 Master Task 负责人，不直接派发节点 |
| RW-GUI-702 | IMPLEMENTED | Router 调用 `router_worker_submit_plan` | 保存结构化 Plan Draft，并固化 `routerAgentId` |
| RW-GUI-703 | IMPLEMENTED | 非登记 Agent 或错误 Session 调用 Router 工具 | 工具拒绝，必须匹配受信 `router_cycles` 绑定 |
| RW-GUI-704 | IMPLEMENTED | Router 提交非法或循环 DAG | Validator 拒绝并保留可修复错误 |
| RW-GUI-705 | IMPLEMENTED | 人工编辑 Router 计划 | 保存新 Plan Version，旧版本只读 |
| RW-GUI-706 | IMPLEMENTED | 修改 Workspace 默认 Router | 仅影响新计划，已有计划仍绑定原 Router |
| RW-GUI-707 | IMPLEMENTED | 打开扩展设置的 Router 选择器 | 只列出 `agentType=router` 的 AI伙伴；Data Agent、会议 Facilitator 等普通 Agent 不出现 |
| RW-GUI-708 | IMPLEMENTED | 首次启用且 Workspace 没有 Router | 自动创建“通用任务 Router”AI伙伴，并完成 Employee / Principal / Persona / Agent Profile 绑定 |
| RW-GUI-709 | IMPLEMENTED | Router 身份缺少 Principal 或试图用普通 Agent 启动 | 启动前阻断，不创建 Run，不把空 `principalId` 交给 Dispatcher |
| RW-GUI-710 | IMPLEMENTED | B 确认计划，A/C 随后触发确认并派发/物化 | Plan 固化 `confirmedBy`、确认角色和时间；子任务 `createdBy/createdByName` 与 Run 归属均为 B，不随物化操作人漂移 |
| RW-GUI-711 | IMPLEMENTED | 检查计划详情与子任务详情 | 能看到计划确认活动记录和子任务创建人；Router Agent 不成为子任务创建人 |
| RW-GUI-712 | IMPLEMENTED | Router 子任务只回复文本但不确认验收项，或执行中出现工具失败 | 子任务进入 `异常`，不自动进入 `待验收`；负责人人工介入并通过任务工具确认后才能 Review |
| RW-GUI-713 | IMPLEMENTED | 服务重启后再次点击“自动解析执行计划”，旧 Cycle 的 Run 已 interrupted | 旧 Cycle 标记 failed，不返回陈旧 queued；新 Cycle 使用带 `retry` 后缀的独立 Session，服务不因写锁冲突退出，页面不整页刷新 |
| RW-GUI-714 | IMPLEMENTED | 主任务负责人不是创建人，由负责人点击自动解析 | Router 可以保存 Plan Draft；创建和管理计划权限为计划创建人、主任务负责人、项目 owner/admin，普通主任务创建人无权管理 |
| RW-GUI-715 | IMPLEMENTED | 生成含并行起点、独立能力门或尾巴节点的计划 | 并行起点必须在后续汇合；存在多个弱连通分量时 Validator 返回 `disconnected-graph`，不能确认或派发 |

### I. 模板实例

| ID | 状态 | 操作 | 预期 |
| --- | --- | --- | --- |
| RW-GUI-801 | PARTIAL | 从 active Workflow Template 创建实例 | 通过现有 Workflow API 创建真实实例 |
| RW-GUI-802 | PARTIAL | 打开模板实例计划 | 展示模板来源和节点 |
| RW-GUI-803 | PARTIAL | 模板含 role executor | 启动时校验项目角色，领取和派发时再次校验 |
| RW-GUI-804 | PARTIAL | 模板含人工审批和不可逆 Gate | Router/Worker 无法代签 |
| RW-GUI-805 | PARTIAL | 模板实例与 Router/manual plan 共存 | 共享同一计划 UI，但保留来源语义 |

### J. Reconciler 与最终 Review

| ID | 状态 | 操作 | 预期 |
| --- | --- | --- | --- |
| RW-GUI-901 | PARTIAL | 上游节点完成 | 下游 waiting → ready |
| RW-GUI-902 | PARTIAL | 下游是 AI 节点 | Dispatcher 自动派发；派发前重新校验权限 |
| RW-GUI-903 | PARTIAL | 事件丢失后等待 Reconciler | 以数据库权威状态恢复推进，不重复 Run |
| RW-GUI-904 | IMPLEMENTED | 人类负责人的 required 节点全部 accepted | Router 生成交付草稿，Plan completed，Master Task 保持 progress |
| RW-GUI-905 | IMPLEMENTED | Agent 负责人的 required 节点全部 accepted | Router 汇总并提交 Root Task Review，不自动 done |
| RW-GUI-906 | PARTIAL | Review 退回 | 计划可重新打开或生成新版本，不覆盖历史 |

### K. 权限

| ID | 状态 | 操作 | 预期 |
| --- | --- | --- | --- |
| RW-GUI-1001 | PARTIAL | 项目有 read/write，负责人只有 read | 节点 write 被阻断 |
| RW-GUI-1002 | PARTIAL | 负责人有 write，项目只有 read | 节点 write 被阻断 |
| RW-GUI-1003 | PARTIAL | 改派负责人 | 立即按新负责人重算，不继承旧快照 |
| RW-GUI-1004 | PARTIAL | 修改项目角色或授权 | 未完成节点在派发前重新校验 |
| RW-GUI-1005 | PARTIAL | 权限交集为空 | 计划确认或派发被阻断并展示原因 |
| RW-GUI-1006 | PARTIAL | Router 尝试提交资源范围或权限 | Plan Draft 不接受、不缓存、不扩大 |
| RW-GUI-1007 | PARTIAL | Agent 尝试代签人工审批 | 拒绝并审计 |
| RW-GUI-1008 | PARTIAL | Root Task 负责人有权限、节点负责人无权限 | 不继承 Root Task 权限 |

### L. 关闭、重开与恢复

| ID | 状态 | 操作 | 预期 |
| --- | --- | --- | --- |
| RW-GUI-1101 | IMPLEMENTED | 活动计划运行时关闭扩展 | 立即停止新派发和 Router 唤醒 |
| RW-GUI-1102 | IMPLEMENTED | 关闭后检查计划状态 | 变为 `resume_required` 或安全暂停点 |
| RW-GUI-1103 | IMPLEMENTED | 关闭后检查数据 | 计划、节点、Run、Task 和审计保留 |
| RW-GUI-1104 | IMPLEMENTED | 重新开启扩展 | 不自动恢复执行 |
| RW-GUI-1105 | IMPLEMENTED | 点击“显式恢复” | 计划重新 active，Reconciler 启动 |
| RW-GUI-1106 | PARTIAL | 关闭时存在运行中 Agent Run | Run 按安全停点暂停，不做破坏性终止 |
| RW-GUI-1107 | PARTIAL | 服务重启 | 不重复创建 Task/Run，活动计划可恢复 |

### M. 响应式与可访问性

| ID | 状态 | 操作 | 预期 |
| --- | --- | --- | --- |
| RW-GUI-1201 | IMPLEMENTED | 1440 / 1280 / 1024 桌面尺寸 | 中栏与右栏不重叠，按钮文案不溢出 |
| RW-GUI-1202 | PARTIAL | 390 移动尺寸 | 计划头、工具栏、节点和右侧详情基本可用 |
| RW-GUI-1203 | IMPLEMENTED | 键盘 Tab / Enter / Escape | 设置弹窗、节点选择、依赖选择器可操作 |
| RW-GUI-1204 | IMPLEMENTED | 检查 aria-label / role | 设置、关闭、页签、依赖选择器具备可读标签 |
| RW-GUI-1205 | IMPLEMENTED | 浅色/深色主题 | 全部计划 UI 使用设计 token，可读性正常 |

## 6. 用户视角端到端测试场景

本节用例从业务用户操作出发，不以单个按钮或 API 为中心。每个案例都必须保留
截图、HAR、任务/计划/节点/Run ID、服务端日志和最终数据快照。

### 6.0 角色与测试数据

| 角色 | 用途 |
| --- | --- |
| 林然，业务发起人 | 创建主任务、确认计划、最终验收 |
| 陈默，人类 Worker | 处理访谈、资料补充、人工 Review |
| 周岚，验收人/审批人 | 执行最终 Review 和不可逆审批 |
| Atlas Router | 生成 Plan Draft、失败重排和最终汇总 |
| 数据侦探，AI Worker | 数据查询和证据提取 |
| 法务助手，AI Worker | 合同条款分析 |
| 权限受限 AI Worker | 验证交集不足和派发阻断 |

建议测试主任务：

```text
完成 Q4 关键物料供应风险评审，输出风险等级、处置建议和证据清单，
并由业务负责人完成最终验收。
```

附件：

- `关键物料交付异常明细.xlsx`
- `供应商访谈提纲.md`
- `合同风险条款摘录.pdf`

预期 Plan Draft 至少包含：

- 2 个可并行节点；
- 1 个汇合节点；
- 人机混合负责人；
- 1 个需求澄清节点；
- 1 个节点级 Review；
- 1 个 Router 汇总节点；
- Root Task 最终 Review。

### 6.1 E2E-01：复杂 Router 计划全生命周期正向案例

**类型**：正向，P0  
**覆盖**：Router、串并联、依赖、人工编辑、人机混合、澄清、文档补充、退回、汇总和最终 Review。

前置条件：

- Workspace A 已启用扩展。
- Workspace 已配置 Atlas Router；主任务负责人可以是人类或另一个 Agent。
- 陈默、数据侦探、法务助手均在当前项目可用。
- 项目权限与各负责人权限均满足基础执行。

用户操作与预期：

1. 林然创建主任务，上传 `关键物料交付异常明细.xlsx`，点击“任务规划”。
   - 计划区域打开；主任务状态未改变；Root Task 没有自动创建 Run。
2. 先选择“自动解析执行计划”，再选择 Atlas Router 并开始自动解析。
   - Router 进入 planning 回合。
   - 只生成结构化 Plan Draft，不直接创建 Task 或 Run。
3. 查看 Plan Draft：
   - 数据侦探负责异常数据提取；
   - 陈默负责供应商访谈；
   - 法务助手负责合同条款分析；
   - 前三个节点可并行；
   - 供应链分析师节点依赖上述三个节点；
   - Router 汇总节点依赖分析节点。
4. 在图视图中检查布局：
   - 中栏仅替换为执行计划工作区；
   - 右侧仍是任务详情页签壳；
   - 串行关系、并行分叉和汇合关系清晰，不与节点文案重叠。
5. 说明链：陈默访谈需要合同条款分析结果。
   - 系统拒绝依赖变更并提示会形成循环，不落库；
   - 原图不变，保存按钮不显示成功。
6. 用户删除“可选行业新闻补充”节点，新增“供应商恢复方案复核”节点，并将其负责人改为 AI Worker。
   - 保存为 Plan Version 2；
   - 已完成信息不丢失；
   - 节点 ID、依赖和右侧详情同步更新。
7. 用户将“供应商访谈”依赖改为“异常数据提取”和“合同条款分析”。
   - 依赖 chip 更新；
   - 循环校验通过；
   - 保存后图/列表一致。
8. 林然点击陈默访谈节点，补充 `供应商访谈提纲.md`，并提交一条人工指令。
   - 文件出现在节点产出/附件区；
   - 指令进入节点上下文和任务动态；
   - 不修改 Root Task 验收标准。
9. 用户确认计划并点击“创建并派发”。
    - 只创建一个版本绑定；
    - 每个节点最多创建一个 Task；
    - Agent 节点通过现有 Dispatcher 创建 Run；
    - 人工节点进入普通 Task 待办；
    - Root Task 仍处于执行中，不提前完成。
10. 数据侦探执行过程中发起需求澄清：
    - 节点进入 `needs_input`；
    - 后续依赖节点等待；
    - 林然补充“时间范围改为近 90 天”；
    - 数据侦探以补充后的上下文恢复执行；
    - Plan Version 和事件历史保留。
11. 法务助手提交合同条款分析，进入 Agent 自检/人工 Review。
    - Agent 不能代签人类 Review；
    - 林然或指定验收人可执行“通过/退回”。
12. 林然退回“供应商访谈”节点，理由为缺少未来 8 周产能承诺。
    - 节点进入退回状态；
    - 下游节点保持等待；
    - 旧一轮结果保留；
    - 生成新一轮 Task/Run 或新的退回轮次，不覆盖历史。
13. 陈默补充产能承诺并重新提交。
    - 新结果与旧结果同时可追溯；
    - 依赖节点重新 readiness 判断；
    - 没有被影响的其他节点不重跑。
14. 所有 required 节点 accepted。
    - Router 生成交付草稿；
    - 草稿包含每个节点、结果、证据引用、风险和待确认事项；
    - Plan 变为 completed；
    - 由于 Master Task 负责人是人类，Root Task 保持 progress，不自动提交 Review。
15. 林然逐项验收：
    - 验收标准对应节点证据；
    - 林然通过现有任务流程手动提交 Review；
    - 人工点击通过后 Root Task 才进入 done；
    - 普通子 Task 继续作为独立任务保留。

必须失败的断言：

- Router 直接创建 Run。
- Router 自动通过 Root Task。
- 循环依赖被保存。
- 同一节点出现两条 active Run。
- 退回覆盖旧交付物或旧 Run。
- 最终 Review 被 Agent 代签。

### 6.2 E2E-02：人工多任务依赖与人工/AI 指派正向案例

**类型**：正向，P0  
**覆盖**：人工创建多个 Task、依赖关系、人工/AI 指派和逐步完成。

前置条件：

- 项目中同时存在人类成员和 AI Worker。
- 用户拥有创建任务和确认计划权限。

操作与预期：

1. 林然创建主 Task：
   “整理 Q4 供应风险简报”。
2. 在同一计划中人工新增：
   - Task A：提取近 90 天异常数据，指派数据侦探；
   - Task B：访谈核心供应商，指派陈默；
   - Task C：汇总风险简报，指派供应链分析师；
   - Task D：业务验收，指派周岚。
3. 设置 A、B 并行，C 依赖 A 和 B，D 依赖 C。
   - 依赖 chip 与图连线正确；
   - A/B 初始 ready；C/D waiting。
4. 确认计划并派发。
   - A 创建 AI Run；
   - B 创建普通人类 Task；
   - C 暂不创建 active Run，等待 A/B accepted。
5. 陈默在 B 中上传访谈附件并提交。
   - B 进入 Review；
   - C 未 ready，因为 A 尚未完成。
6. 数据侦探完成 A 并提交结果。
   - A、B 均 accepted 后 C 自动 ready；
   - Dispatcher 只派发 C 一次。
7. C 完成后 D ready。
   - 周岚收到待验收事项；
   - Root Task 不自动完成。
8. 人工负责人查看交付草稿，通过现有任务流程提交并完成 Root Task Review。
   - Root Task done；
   - 现有任务看板、详情、评论、附件和状态正常。

逆向注入：

- A 未完成时将 C 拖到完成：必须拒绝。
- A/B 未 accepted 时手工派发 C：页面提示等待前置任务。
- 重复点击“创建并派发”：不得重复创建 A/B/C/D Task。

### 6.3 E2E-03：Agent 执行受阻后由人工触发规划

**类型**：正向 + 恢复，P0  
**覆盖**：先直派 Agent，失败后转计划拆解。

操作与预期：

1. 林然创建主 Task 并直接指派 AI Worker，保持该 AI Worker 为 Master Task 负责人，不上来就打开任务规划。
2. Agent 执行一部分后返回 `waiting_input` 或 `failed`：
   - 任务详情展示已运行轮次、已有输出和阻塞原因；
   - Root Task 不丢失原 Run 历史。
3. 林然点击“任务规划”，触发人工规划：
   - 系统把主 Task 作为 Root Task；
   - 已执行输出作为上下文引用；
   - 不重新创建 Root Task。
4. 用户或 Router 创建新计划：
   - 原 Agent 已完成的部分标记为已完成节点或人工确认复用；
   - 未完成范围拆为新的子节点；
   - 需要补充的材料挂到对应节点。
5. 用户确认计划并派发：
   - 只创建尚未完成的新任务；
   - 已存在 Task 通过幂等键复用；
   - 不重复派发已完成工作。
6. 子节点完成后 Router 汇总：
   - 原 Root Task 的旧 Run 和新节点结果都可见；
   - 该任务收口模式为 `router_managed`；
   - 最终进入 Review，不自动 done。

必须验证：

- 原 Run 不被覆盖。
- 原任务状态不被新计划非法重置。
- 旧负责人无权继续执行新节点。
- Root Task 权限不作为新节点权限来源。

### 6.4 E2E-04：复杂计划中失败、取消和人工接管

**类型**：逆向恢复，P0  
**覆盖**：部分节点失败、取消、阻塞、重试、改派和人工接管。

操作与预期：

1. 启动包含 5 个节点的复杂计划。
   节点 A 已完成；B、C 并行；D 汇合；E 人工审批。
2. B 的 Agent Run 超时。
   - B 标记 failed/timeout；
   - D 不 ready；
   - Root Task 不进入 Review。
3. 用户选择“重试 B”。
   - 创建新 attempt/run；
   - 不覆盖旧失败 Run；
   - 重试次数耗完后停止自动重试。
4. 用户取消 C。
   - C 标记 cancelled；
   - 只有明确允许跳过 C 的路径才能继续；
   - 否则 D 保持 blocked。
5. 用户将 B 改派给人类陈默。
   - 按陈默重新计算项目 ∩ 负责人权限；
   - 原 B 输出和失败原因作为交接；
   - 不继承旧 AI Worker 权限。
6. 陈默补充资料并提交。
7. D 完成，E 进入人工审批。
   - Router 或 Worker 不能代签；
   - 用户可退回 D 或取消计划。
8. 林然取消整个计划：
   - 停止新派发和 Router 唤醒；
   - 不再创建新 Run；
   - 已创建 Task 保留普通任务状态；
   - 取消事件进入审计。

### 6.5 E2E-05：非法 Router 计划与越权提议被阻断

**类型**：逆向，P0  
**前置**：Router 可用，存在权限不足 Agent。

步骤：

1. Router 提交循环 DAG。
   - Validator 拒绝；
   - 不生成 approved version；
   - 不创建 Task/Run。
2. Router 提交不存在的 Worker。
   - 拒绝并指出节点和缺失 Worker。
3. Router 指定超出项目权限范围的 AI Worker。
   - 拒绝，不签发扩大权限的 Ticket。
4. Router 尝试写入权限快照、resource scope 或 runtime 提升。
   - 结构化 Schema 拒绝；
   - audit 记录拒绝原因；
   - 原 Plan Draft 不包含权限快照。
5. Router 计划合法后用户手工确认。
   - 只有用户确认后进入 approved；
   - Router 原 Draft 保持不可变历史。

### 6.6 E2E-06：改派后权限重算与派发拦截

**类型**：逆向，P0

步骤：

1. 节点 A 原负责人 Alice，项目权限和 Alice 权限均允许 `read/write`。
2. 计划确认前，用户把 A 改派给 AI Worker X。
3. Worker X 只有 `read`，缺少 `write`。
4. 保存节点成功，但确认计划或派发失败：
   - 错误明确指出 `write` 权限缺口；
   - 不创建 Agent Run；
   - 不签发 Ticket。
5. 用户补充 Worker X 权限或改派合法负责人。
6. 再次派发成功。
7. 检查旧负责人权限没有被沿用。

### 6.7 E2E-07：重复点击、并发确认与幂等

**类型**：逆向，P0

步骤：

1. 两个浏览器同时打开同一个 Plan Draft。
2. 两边同时保存不同节点内容。
   - 只有一个基于当前 revision 成功；
   - 另一个得到冲突提示；
   - 页面刷新后可看到成功版本。
3. 两边同时点击“确认计划”。
   - 只能产生一个 approved version；
   - 重复请求返回同一状态或冲突，不创建重复版本。
4. 连续点击“创建并派发” 5 次。
   - 每个节点只绑定一个 Task；
   - Agent 节点只有一个 active Run；
   - 审计中记录幂等重放。

### 6.8 E2E-08：Review 退回、精准返工与历史保留

**类型**：正向 + 逆向，P0

步骤：

1. 使用 AI Agent 负责人的主任务，Router 汇总完成并提交 Root Task Review。
2. 周岚退回，理由为“合同风险缺少引用来源”，并选择对应验收项。
3. 系统只重新打开受影响节点：
   - 已完成且不受影响的节点保持不变；
   - 下游重新 waiting；
   - 旧汇总和旧交付物保留。
4. 法务助手重新执行并提交引用。
5. 新汇总和旧汇总可对比。
6. 周岚再次通过。
7. 全程不得覆盖旧 Review 和旧 Run。

### 6.9 E2E-09：关闭、重开与不自动恢复

**类型**：生命周期逆向，P0

步骤：

1. 启动包含 Agent 节点的计划。
2. Agent 进入 running，另一节点仍 waiting。
3. 林然关闭扩展：
   - 计划 UI 立即卸载；
   - 无新派发、无 Router 唤醒；
   - 活动计划进入 `resume_required`；
   - 已创建 Task、Run 和附件保留；
   - 不删除 Plan Version。
4. 重新启用扩展：
   - 计划数据仍存在；
   - 不自动恢复；
   - 必须显示“显式恢复”。
5. 用户点击“显式恢复”：
   - Reconciler 恢复；
   - 不重复派发已有 active Run；
   - 后续依赖按权威状态推进。

### 6.10 E2E-10：服务重启与漏事件恢复

**类型**：故障恢复，P1

步骤：

1. 计划执行中，节点 A 完成但停止通知链路。
2. 重启 DSH 服务。
3. 重新打开任务和计划：
   - Reconciler 从 Task/Plan 权威状态补推进；
   - A 不重复创建 Task；
   - 下游 ready 后只派发一次。
4. 运行中 Run 中断：
   - Run 标记 interrupted；
   - 计划 blocked 或 resume_required；
   - 不伪造成功。
5. 用户决定重试或改派。

### 6.11 E2E-11：人工审批和不可逆 Gate 不可代签

**类型**：权限逆向，P0

步骤：

1. 计划中包含采购负责人审批和外部 ERP 写入。
2. Router 尝试把审批节点标记完成。
   - 拒绝。
3. Agent Worker 尝试提交审批通过或外部发送授权。
   - 拒绝。
4. 人类审批人完成审批。
5. 不可逆动作要求再次人工确认。
6. 授权、拒签、执行和结果均进入审计。

### 6.12 E2E-12：计划确认人继承与异常门禁

**类型**：正向 + 权限边界，P0

前置：A 为主任务创建人，B 为计划确认人，C 为后续触发物化的另一管理员。

步骤：

1. A 创建主任务并让 Router 生成可执行计划。
2. B 检查节点后确认计划。
   - Plan 记录 `confirmedBy=B`、确认角色和时间；
   - 计划活动记录出现确认人。
3. C 稍后点击确认并派发/物化。
   - 子任务只创建一次；
   - 子任务 `createdBy/createdByName` 仍为 B；
   - Run 的 `createdBy/responsibleId` 仍为 B；
   - C、A 和 Router Agent 都不能覆盖创建人。
4. 打开子任务详情：
   - GUI 展示 B 为创建人；
   - 计划详情能看到确认记录。
5. 让 Agent 子任务只回复文本但不确认验收项，或制造工具失败。
   - 子任务进入 `异常`；
   - 不自动提交 Review；
   - 负责人重新执行并显式确认验收项后才能进入 `待验收`。

### 6.13 E2E 正逆向总表

| ID | 类型 | 主场景 | 核心成功标准 | 优先级 |
| --- | --- | --- | --- | --- |
| E2E-01 | 正向 | Router 复杂计划，人机混合、澄清、退回、汇总 | Root Task 最终人工通过，完整历史保留 | P0 |
| E2E-02 | 正向 | 人工多 Task 依赖与指派 | 依赖解锁、Task 正常执行和验收 | P0 |
| E2E-03 | 恢复 | Agent 执行受阻后转人工规划 | 原 Run 保留，新拆解只补未完成部分 | P0 |
| E2E-04 | 逆向恢复 | 失败、取消、改派、人工接管 | 可恢复、不伪造完成、不越权 | P0 |
| E2E-05 | 逆向 | 非法 DAG 和 Router 越权 | 不落 approved、不建 Task/Run | P0 |
| E2E-06 | 逆向 | 改派后权限重算 | 派发前阻断权限缺口 | P0 |
| E2E-07 | 逆向 | 并发和重复点击 | 版本、Task、Run 均幂等 | P0 |
| E2E-08 | 正向+逆向 | Review 退回与精准返工 | 只重跑受影响分支 | P0 |
| E2E-09 | 逆向 | 关闭、重开、显式恢复 | 不自动恢复、不遗留副作用 | P0 |
| E2E-10 | 故障恢复 | 服务重启和事件丢失 | Reconciler 对账，不重复派发 | P1 |
| E2E-11 | 逆向 | 人工审批和不可逆 Gate | 任何 Agent 不能代签 | P0 |
| E2E-12 | 正向+逆向 | 计划确认人继承与异常门禁 | 子任务创建人固定为确认人；无证据/工具失败不自动 Review | P0 |

### 6.14 E2E 执行顺序

建议按以下顺序执行，避免数据互相污染：

1. 关闭态基线。
2. E2E-02 人工多 Task 依赖。
3. E2E-01 Router 复杂正向。
4. E2E-08 Review 退回。
5. E2E-03 Agent 受阻后规划。
6. E2E-04 失败和取消恢复。
7. E2E-06、E2E-05 权限逆向。
8. E2E-07 并发和幂等。
9. E2E-09 关闭恢复。
10. E2E-10 服务重启。
11. E2E-11 审批和不可逆 Gate。
12. E2E-12 计划确认人继承与异常门禁。

### 6.15 E2E 通过证据

每个 E2E 必须保存：

- Plan ID、Version、Node ID、Task ID、Run ID。
- 每个状态迁移的服务端事件。
- Router Draft 原文与 approved Graph Diff。
- 人工编辑前后截图。
- 依赖变更截图和循环阻断截图。
- 澄清问题、回答、附件和上下文快照。
- Review 退回理由、旧产出、新产出。
- 人类负责人：交付草稿、Plan completed、Root Task progress 和后续手工处理记录。
- Agent 负责人：Router 汇总、Root Task Review 和人工验收后的 done 状态。
- Network HAR 与 Console。
- 关闭/重开/恢复前后数据和 timer 证据。

## 7. 自动化实现建议

### 7.1 Playwright 分片

建议拆成：

1. `closed-state.spec.ts`
2. `settings-gate.spec.ts`
3. `manual-plan.spec.ts`
4. `dependency-editor.spec.ts`
5. `plan-dispatch.spec.ts`
6. `router-plan.spec.ts`
7. `template-plan.spec.ts`
8. `permission.spec.ts`
9. `lifecycle.spec.ts`
10. `regression-task-workflow.spec.ts`

### 7.2 稳定 selector

优先要求实现补齐以下 `data-testid`：

- `router-worker-settings-trigger`
- `router-worker-settings-modal`
- `router-worker-gate-toggle`
- `router-worker-plan-entry`
- `router-worker-plan-center`
- `router-worker-plan-side`
- `router-worker-plan-node`
- `router-worker-plan-view-toggle`
- `router-worker-dependency-picker`
- `router-worker-dependency-option`
- `router-worker-plan-settings`
- `router-worker-confirm-plan`
- `router-worker-materialize-plan`
- `router-worker-resume-plan`

如果暂时没有 `data-testid`，允许按语义 role + accessible name 选择，不得依赖
页面 CSS 层级或文本模糊匹配。

### 7.3 Network 断言

关闭态：

```text
request.url startsWith /api/collab/router-worker/  => 0
```

设置弹窗打开后：

```text
GET /api/collab/router-worker/settings => 1
```

启用后：

```text
GET/POST /api/collab/router-worker/plans/* 不允许在无用户操作时轮询
```

### 7.4 DOM 基线

- 克隆关闭态 DOM。
- 删除唯一允许的设置图标节点。
- 归一化 React 动态 key、时间和随机 ID。
- 与启用前基线做 diff。
- 任何额外节点、class、布局容器都判失败。

### 7.5 生命周期检查

通过 CDP/Performance 检查：

- 无活动计划时不存在 Reconciler timer。
- 启用后但尚未物化计划时不存在 Reconciler timer。
- 物化后存在且仅存在一个 Reconciler timer。
- 关闭后 timer 被清理。
- 重开但不显式恢复时 timer 不启动。

## 8. 手工 GUI 主路径

### 8.1 人工计划闭环

1. 使用普通主任务打开任务详情。
2. 点击“任务规划”。
3. 创建路线图，新增 3 个节点。
4. 设置 A → C、B → C 的依赖。
5. 尝试 C → A，确认被循环校验阻断。
6. 切换图/列表，确认数据和选中态同步。
7. 打开计划设置，修改并发与失败策略并保存。
8. 确认计划并派发。
9. 完成 A、B，确认 C 自动 ready。
10. 完成 C，确认人工路线图 Plan completed，Root Task 状态不由插件自动推进。
11. 人工使用现有任务流程提交验收。

### 8.2 Router 闭环

1. 在扩展设置中指定默认 Router Agent，创建人类负责人的主任务。
2. 打开计划区域，选择“自动解析执行计划”，确认 Router 选择项后开始解析。
3. 确认 Router 只提交 Draft。
4. 人工调整负责人和依赖。
5. 确认并派发。
6. 完成一个节点，确认 Reconciler 推进下游。
7. 全部完成后检查交付草稿，确认 Master Task 保持 progress。
8. 将主任务负责人改为 Agent 后重复另一任务，确认全部节点完成后提交 Review。
9. 确认 Router 没有直接确认计划、验收或通过 Review。

### 8.3 关闭与恢复

1. 启动一个包含 AI Worker 的活动计划。
2. Worker 运行中关闭扩展。
3. 检查 UI 立即卸载、无新派发、计划变为 `resume_required`。
4. 检查数据库和 Task 数据保留。
5. 重新启用扩展。
6. 确认计划没有自动恢复。
7. 点击“显式恢复”，确认 Reconciler 恢复。

## 9. 回归矩阵

每轮 GUI 测试必须同时跑：

- 任务看板拖动与筛选
- 创建任务、附件上传
- 负责人改派
- 状态流转
- 评论、关键共识、@ Agent
- AI 执行记录
- 产出文档下载
- Review 通过、退回、催办
- 工作流模板列表、导入、启动、节点完成、审批、取消
- 现有 Workspace 配置和成员权限
- 插件关闭后无 Router Worker API 请求

## 10. 证据与缺陷模板

每个用例输出：

```text
Case:
Status: PASS / FAIL / BLOCKED
Environment:
Workspace:
Task/Run/Plan ID:
Steps:
Expected:
Actual:
Screenshot:
HAR/Network:
Console:
Server log:
Data snapshot:
Known gap:
```

任何截图差异、额外 DOM、额外 API、重复 Task/Run、权限放宽都至少记为 P1。
Router 代签人工审批、关闭后仍派发、跨 Workspace 数据泄漏记为 P0。

## 11. 退出标准

当前版本达到“功能闭环”的最低退出标准：

1. A、B、C、D、F、K、L 组核心用例全部 PASS。
2. E、G、H、I、J 组中标记 `PARTIAL` 的用例完成补测并 PASS。
3. 全量自动化和 smoke 通过。
4. 关闭态 DOM 除设置图标外无差异。
5. 无 Router Worker 后台任务在关闭态启动。
6. 无插件计划 API 在关闭态被动请求。
7. 所有 Task/Run 创建均可幂等重放。
8. 权限交集为空时不能派发，Router 无法扩权。

要达到产品设计和 Demo 的“完整完成”，还必须消除：

- 前端 bundle 加载缺口；
- 模板实例 GUI 缺口；
- 子任务三页签实际内容缺口；
- 完整计划设置字段缺口；
- 关闭时运行中 Run 的安全停点实测缺口。

## 12. 基线 GUI 执行记录（2026-11-06）

### 12.1 执行环境

| 项 | 值 |
| --- | --- |
| 隔离数据 | `.tmp/smoke-dsh-home` |
| 本机地址 | `127.0.0.1:33119` |
| 浏览器 | Headless Chrome + CDP |
| 桌面截图 | `.tmp/router-worker-ui.png` |
| Demo 对比截图 | `.tmp/router-worker-demo-plan.png` |

### 12.2 已执行用例

| 用例 | 结果 | 说明 |
| --- | --- | --- |
| 关闭态仅显示设置图标 | PASS | 无任务规划入口 |
| 设置弹窗默认未启用 | PASS | 打开弹窗后才请求设置 |
| 无刷新启用扩展 | PASS | 出现“任务规划”入口 |
| 任务详情不显示设置图标 | PASS | 设置仅保留在任务看板页 |
| 任务规划位于右栏操作区 | PASS | 与催办、取消任务等操作同区 |
| 任务详情中栏切换计划 | PASS | 中栏替换，右栏保留详情壳 |
| 创建基础路线图 | PASS | 生成 v1 draft |
| 确认计划 | PASS | 进入 approved |
| 创建并派发 | PASS | 进入 active 并创建 Task |
| 计划完成数/进度抬头 | PASS | 已按 Demo 增加完成数和进度 |
| 图视图画布 | PASS | 增加点阵画布、节点连线和节点 hover/selected 样式 |
| 右栏节点选择 | PASS | 节点选中态和右侧详情同步 |
| 关闭扩展 | PASS | 计划 UI 卸载，服务端 gate 关闭 |

### 12.3 本次发现并修复的问题

| 问题 | 根因 | 修复 |
| --- | --- | --- |
| 启用后中栏空白 | chain slot wrapper 被父级 visibility 规则一并隐藏 | 对 `pluginmax.task.detail.main` slot wrapper 恢复可见 |
| `renderSlotChain` 在任务详情中为空 | TaskGlobalPage 未把 `renderSlotChain` 传给 TaskDetail | 补齐 slot kit 透传 |
| 单节点计划落入不可见区域 | graph stage 固定最小高度过大 | 收紧画布最小高度并按依赖层级计算位置 |
| 图视图缺少依赖感 | 只有卡片网格，没有节点连线 | 增加 SVG 曲线边、点阵画布和节点层级布局 |
| 计划抬头信息密度不足 | 只有标题和状态 | 新增计划 ID、责任人、验收人、优先级、DDL、完成数和进度 |

### 12.4 与 Demo 的对齐结果

已对齐：

- 中栏计划工作区 + 右侧任务详情页签壳。
- 深/浅色主题下使用现有设计 token。
- 计划标签、主任务身份和进度摘要。
- 图/列表 View 切换。
- 图节点、依赖连线、点阵画布、选中态。
- 节点编辑、依赖 chip、搜索和循环阻断。
- AI/人类节点类型与状态表达。

仍存在的视觉差异：

- Demo 使用更完整的节点活动、Run 和交付物示例数据；当前实现展示真实数据，空数据时更简洁。
- Demo 的节点卡片和画布比例更宽松；当前实现为适配真实任务详情尺寸使用更紧凑布局。
- Demo 的深色视觉为演示默认主题；产品跟随 DSH 当前主题。
- 移动端仍以可用性为主，不复制 Demo 的桌面画布比例。

### 12.5 范围外阻塞

全量 smoke 当前在 Resource Market 自定义 Skill 夹具处期望 `201`，但服务端要求
`manifest.instructions`，返回 `400`。该问题属于既有 Resource Market 测试夹具，
不在本次 Router / Worker 范围内，未修改。

## 13. Router 独立 Agent 回归记录（2026-11-07）

### 13.1 环境

| 项 | 值 |
| --- | --- |
| 隔离数据 | `.tmp/router-worker-gui-home-20261106c` |
| 本机地址 | `127.0.0.1:33127` |
| 浏览器 | Headless Chrome + CDP |
| 默认 Router | `Demo 李白产品` |
| 自动化门禁 | `67` 个测试文件、`920` 个测试通过 |

### 13.2 已执行用例

| 用例 | 结果 | 说明 |
| --- | --- | --- |
| Workspace 默认 Router 配置 | PASS | 扩展设置可加载并保存默认 Router Agent |
| Router 候选可指定 | PASS | 计划空态加载候选列表，多候选时可选择 |
| 人类负责人使用 Router | PASS | Master Task 负责人为平台 Admin，不要求负责人是 Agent |
| 独立 Router Session | PASS | 使用 `de-router-*` Session，不占用任务负责人 Session |
| 受信 Cycle 绑定 | PASS | Router 工具只接受当前活动 Cycle Session |
| 真实 Plan Draft | PASS | Router 生成并保存 6 节点 DAG，包含串行、并行和人工确认节点 |
| 计划级 Router 固化 | PASS | 保存 `routerAgentId`；编辑计划不能更换 Router |
| 人类负责人最终草稿 | PASS | 所有节点 accepted 后 Plan completed，生成交付草稿，Master Task 保持 progress |
| 不自动提交 Review | PASS | 人类负责人场景未调用 Root Task Review 状态变更 |
| Agent 负责人提交 Review | PASS | 服务层自动化验证：`router_managed` 生成汇总后提交 Review，不自动 done |
| 内部 ID 隐藏 | PASS | 计划抬头不展示 `rw-plan-*`；草稿中的内部 ID 会被替换 |
| Router 类型登记 | PASS | 候选接口只返回 `agentType=router`；普通 Data Agent 被 403 拒绝 |
| Router 真实执行身份 | PASS | 默认 Router 具备 Employee、Principal、Persona 与 Agent Profile，真实 Cycle 正常提交 |

### 13.3 证据

- Router 真实拆解截图：
  [`.tmp/router-agent-e2e.png`](../.tmp/router-agent-e2e.png)
- 人类负责人交付草稿截图：
  [`.tmp/router-final-draft-ui.png`](../.tmp/router-final-draft-ui.png)
- 规划任务：`TSK-MW4OEC5M-5B0A`
- 最终草稿任务：`TSK-MW4OV2U5-73DC`
- 固化 Router：`tm-d5f13b55-2897-49fd-906e-4a28c0cc171d`

### 13.4 本次发现并修复

| 问题 | 根因 | 修复 |
| --- | --- | --- |
| 人类负责人没有 Router 入口 | Router 启动接口错误要求负责人必须是 Agent | 改为 Workspace/Cycle 独立 Router 调用 |
| Router 提交时找不到任务上下文 | 工具依赖任务负责人 Run 反查根任务 | 使用受信 `router_cycles.rootTaskId/workspaceId` |
| 同一 Router Session 可能绑定旧 Cycle | 仅按 Session 查找第一条记录 | 只解析 queued/running 的最新 Cycle |
| 人类负责人完成后自动进入 Review | 旧 Reconciler 无条件提交 Root Review | 新增 `owner_handoff` 与 `router_managed` 收口模式 |
| Router Draft 引用内部 Plan UUID | Prompt 暴露内部计划 ID | Prompt 和最终草稿统一清理内部 ID |

## 14. 完整 GUI 回归复测（2026-11-07）

### 14.1 执行结果

| 用例组 | 结果 | 证据 |
| --- | --- | --- |
| 关闭态 | PASS | 仅看板设置图标；任务详情无设置图标和规划入口；关闭态插件 API 请求为 0 |
| 开关即时生效 | PASS | 启用后无需刷新出现规划入口 |
| 执行计划三入口 | PASS | 初始仅显示自动解析、人工创建、预置工作流三个入口；选择后才显示对应配置 |
| 人工计划创建 | PASS | 创建 v1 draft，新增 2 个节点，共 3 节点 |
| 节点依赖 | PASS | 节点 B 依赖节点 A 保存成功 |
| 循环依赖阻断 | PASS | 节点 A 选择节点 B 时禁用并提示“会形成循环” |
| 依赖删除保护 | PASS | 节点 A 有下游时删除被拒绝 |
| 图 / 列表一致 | PASS | 两种 View 均为 3 节点 |
| 计划设置保存 | PASS | 最大并发保存为 4，重新读取一致 |
| 执行后设置只读 | PASS | approved 后设置输入禁用，保存按钮移除 |
| 人工计划派发 | PASS | Plan active，Master Task progress，共创建 3 个普通 Task |
| AI Worker 实际执行 | PASS | Agent 节点创建真实 Run，结果回写任务，节点 accepted |
| 关闭与恢复 | PASS | 关闭后 `resume_required`；重开仍不自动恢复；显式恢复后 active |
| Router 独立拆解 | PASS | 人类负责人任务生成 8 节点可编辑 DAG |
| Router 固定绑定 | PASS | 修改 Workspace 默认 Router 后，已有 Plan 的 `routerAgentId` 不变 |
| 人类负责人交付草稿 | PASS | Plan completed，生成非约束性 Draft，Master Task 保持 progress |
| Agent 负责人 Review | PASS | 服务层自动化验证 Review 提交，不自动 done |
| 非法 DAG | PASS | 服务端返回 400，循环 Plan 未落库 |
| Console | PASS | 完整 GUI 流程无 Console error |

### 14.2 本轮发现并修复

| 问题 | 根因 | 修复 |
| --- | --- | --- |
| 保存节点后计划中栏消失 | `/plans/save` 的局部响应 `{plan, version}` 被发布到计划缓存；中间渲染缺少 `nodeStates`，触发 slot error boundary | 保存后不再发布局部响应，只在完整 `fetchPlan` 后更新缓存；状态统计增加空值防护 |
| 执行中的计划仍可编辑设置 | 计划设置面板未判断 Plan 是否仍为 draft/proposed | approved/active 后仅展示只读设置，隐藏保存按钮并禁用输入 |

### 14.3 复测门禁

- `67` 个测试文件通过。
- `925` 个测试通过（本轮 Router 类型修复后）。
- TypeScript 项目检查与测试类型检查通过。
- Router 插件 oxlint 通过。
- contract 通过：`26 plugin bundle(s)`。

### 14.4 补充证据

- 完整 GUI Router Draft 截图：
  [`.tmp/router-gui-suite-20261107.png`](../.tmp/router-gui-suite-20261107.png)
- 执行计划三入口初始态：
  [`.tmp/plan-start-modes-initial.png`](../.tmp/plan-start-modes-initial.png)
- 自动解析模式的 Router Agent 配置：
  [`.tmp/plan-start-modes-auto.png`](../.tmp/plan-start-modes-auto.png)
- Router Draft 任务：`TSK-MW5PGX0R-EAC2`
- 人类负责人 Draft 任务：`TSK-MW5PHTFV-3C47`
- AI Worker 根任务：`TSK-MW5PNZIO-AA12`
- AI Worker 子任务 / Run：`TSK-MW5PNZLI-9040` / `run-8465e8e1-7a4b-43e3-9e02-98e29d6b1947`

### 14.5 Router 类型与 Principal 修复复测

| 项 | 结果 | 证据 |
| --- | --- | --- |
| 设置页 Router 候选 | PASS | 仅显示“通用任务 Router · Router 类型 · 当前默认” |
| 自动解析入口 | PASS | 显示“使用 Router Agent：通用任务 Router”，不再展示普通 Agent |
| 普通 Agent 启动 Router | PASS | `data-agent` 返回 403：“指定 Agent 不是已登记的 Router 类型” |
| 默认 Router 身份 | PASS | `principal-ai-tm-da7123fb-ce0e-4a4d-8d84-1a06c0c4524a`，Profile、Persona、Runtime 均为 active |
| 真实 Router Cycle | PASS | Cycle `rw-cycle-2833b7e1-2d49-4c15-b7df-e7f5d21aa3f6` 提交 5 节点计划 |
| Plan Router 固化 | PASS | Plan 固化 `tm-da7123fb-ce0e-4a4d-8d84-1a06c0c4524a` |
| Router 插件目标测试 | PASS | 6 个测试文件、34 个测试通过 |
| TypeScript / oxlint | PASS | Router 插件类型检查与 lint 通过 |

证据：

- 设置页 Router 类型：
  [`.tmp/router-agent-type-gui-settings.png`](../.tmp/router-agent-type-gui-settings.png)
- 自动解析入口：
  [`.tmp/router-agent-type-gui-start.png`](../.tmp/router-agent-type-gui-start.png)
- 端到端结果：
  [`.tmp/router-agent-type-principal-e2e.json`](../.tmp/router-agent-type-principal-e2e.json)
- 测试任务 / Run：`TSK-MW5RWNUM-950A` / `run-b29cc906-8d64-4d42-9f48-7c76d0835a6c`

本次修复根因：

- 旧实现把普通 Agent Profile 强行命名为 Router，没有 AI伙伴实例，也没有 Principal。
- 启动时把空 `principalId` 传入 Dispatcher，导致 Run 立即失败。
- 类型登记与执行身份未绑定，普通 Agent 只要被写进 `router_agents` 就可能出现在候选列表。

修复方式：

- 使用插件自有 `router_agents` 承载 Router 类型登记，不改核心 Agent 模型。
- Router 模板必须声明 `router_worker_submit_plan` 与 `router_worker_submit_final_draft` 工具契约，作为类型判定的一部分。
- 默认 Router 通过公开 AI Teammate 创建链路完成真实运行身份开通。
- 启动 Cycle 前重新解析 Router 登记与 Principal；缺少 Principal、模板类型不符或使用普通 Agent 时直接阻断。

