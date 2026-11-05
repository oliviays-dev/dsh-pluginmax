# Data Agent 实现说明

> 产品口径：[data-agent-prd.md](./data-agent-prd.md) v1.3  
> 实现范围：`dsh-pluginmax` Data Agent MVP  
> 日期：2026-10-30

> 通用数据问询第一阶段实现：[data-agent-data-fabric-phase1-implementation.md](./data-agent-data-fabric-phase1-implementation.md)
> 订单 MVP 第二阶段实现：[data-agent-orders-phase2-implementation.md](./data-agent-orders-phase2-implementation.md)

## 1. 架构落点

| 能力 | 实现位置 |
| --- | --- |
| 系统身份与保护 | `dsh-collab-teammate`：固定种子 `data-agent`、模版 `sys-data-agent`、受保护字段与拒绝逻辑 |
| Data Agent 域 | `dsh-collab-data-agent`：`collab_data_agent` 会话、消息、附件、Run、报告、HTML 与审计 |
| 运行时 | 复用 `collabTeammateRuntime.ensureRuntime()`、Principal Runtime、Agent Profile 与 Agent Run |
| 外部运行时 | 复用 `/api/collab/agent/external-runtimes`；支持 Codex 与新增的 Codebuddy provider，工具策略仍受 Runtime Profile 约束 |
| 共享侧栏 | shell 持有单一 `window.__pluginmaxSidePanel` store；沟通优先创建时 shell 复用该 store |
| 全局入口 | shell 将 `renderActions` 注入所有一级页面；唯一 Data Agent action 注册在 `pluginmax.global.actions` |
| 内容选择 | Data Agent client 实体注册表 + 页面实体标记；支持自定义 adapter 扩展 |
| 可选面板 | `pluginmax.data-agent` 注册到 `workbench.canvas.panel` |
| 订单领域 | `dsh-collab-data-orders` 提供 Connector、Dataset、Metric、Policy、Skill 与工作台显示配置；不修改聊天、Runtime、QueryRun 或权限协议 |

## 2. PRD 对应关系

| PRD | 实现 |
| --- | --- |
| 第 5、6 节：系统身份 | `data-agent` 幂等种子；固定系统 key；不可删除、归档、改名、换模版；API 返回 `system_agent_protected` |
| 6.3 恢复默认 | `POST /api/collab/data-agent/reset`；保留连接、报告、Run、任务与文件，重置工作区偏好并写审计 |
| 7.2 全局入口 | 所有一级页面的 `renderActions` 位置消费同一个 `pluginmax.global.actions`，位于沟通入口左侧 |
| 7.3 内容选择 | 文本拖选与 `task` / `workflow` / `workflow_node` / `meeting` / `metric_card` 适配器；支持运行时注册 adapter |
| 7.4 共享页签 | Data Agent / 沟通双页签、独立关闭、自动激活相邻页签、全部关闭后收起 |
| 7.4、8.5 状态保持 | 两个页签面板保持挂载；草稿、报告阅读位置、沟通滚动位置和输入状态不清空 |
| 7.5 Data Agent 页签 | 会话切换、上下文附件移除、建议问法、流式 Run 轮询、权限说明 |
| 7.6 报告 | 默认 `report.md` + 2 个 SVG 图表资产；HTML 仅通过按钮或明确“生成 HTML 版”指令派生；版本不一致时拒绝生成 |
| 7.7 展开模式 | shell 共享展开状态；桌面保留左侧导航，移动端占满视口 |
| 7.9 上下文契约 | 服务端 Zod 校验 `DataAgentSelectionContext`，并重新校验工作区、任务、工作流与会议引用 |
| 10.2、10.3 安全 | 默认只读；工具白名单固定为 `entity.read`、`metric.query`、`dataset.query.readonly`、`report.render`、`artifact.write`。Runtime 下发时将产品级点号名称映射为 Provider 合法名称（如 `entity_read`）。MCP 仅作为连接协议，不作为泛化工具授权 |
| 11.2 接口 | 身份/配置/Reset、selection resolve、conversation、query、run、report、render-html、download、asset、share |
| 第 18 节归档 | Conversation / Message / Context Attachment / Agent Run 引用 / Report Artifact / Communication 原链路；默认私人归属，支持 project/workspace/meeting 共享副本 |
| 第 19 节实体扩展 | `window.__pluginmaxDataAgentEntityRegistry.register(adapter)` 提供稳定扩展点 |

### 2.1 上下文组装补充

- `dsh-collab-context` 新增 `scene=chat / chatCarrier=data-agent`：
  - `systemText` 包含平台策略、Data Agent SOUL、模板版本、场景策略；
  - `userText` 包含历史、模式策略、共享对象上下文、引用和当前输入；
  - object ID 写入 mandatory references，预算裁剪不得丢失。
- 共享对象首轮提供摘要、对象 ID、历史索引和最近证据；完整历史通过 `entity_read` 渐进读取。
- 每日简报等聚合卡片优先从 `deepLink` / `sourceDomain` / `condition.refId` 还原 task、workflow、meeting 的标准实体 ID；无标准引用才降级为页面片段。
- Agent Runtime 将 `ContextPack.rendered.systemText` 作为系统段注入，不再只传 user 内容。
- `entity.read` 保留为 PRD/Runtime Profile 产品级名称；Provider 实际注册为 `entity_read`，Runtime 统一把点号映射为下划线。
- `usedTools` 从 Agent Execution 的 `tool.call` 事件回填，审计不再固定为空。

### 2.2 选区与详情交互补充

- task、workflow、meeting 的整卡/整行点击只触发 Data Agent 选区。
- 详情跳转收敛到明确的“详情 / 查看详情 / 查看任务 xx 详情 / 查看会议 xx 详情”按钮。
- workflow_node 的 `data-workflow-id` 使用实例 ID，而不是模板定义 ID，确保服务端可校验并读取所属实例。
- 资源市场页头部消费共享 `pluginmax.global.actions`，全局入口不再缺失。
- “新会话”使用显式 new-conversation 标记，工作区加载不会自动恢复旧会话。
- 普通对话气泡使用 Markdown 渲染，支持标题、粗体、列表、表格、代码块、图片和安全 HTTP(S) 链接；不会把 `**`、Markdown 表格分隔符原样展示。

### 2.3 订单 MVP 补充

- 无选区订单问询通过现有 `data_catalog_search`、`dataset_describe`、`metric_query` 完成；
- Mock OMS 通过现有资源市场 MCP provider 注册和连接，订单 Connector 只调用 MCP 只读工具；
- 订单 Skill 由 Data Fabric 配置注入，订单口径不进入通用 SOUL；
- brief 和报告自动写入 QueryRun、metric version、data cutoff 与 permission summary；
- 会话已有成功 QueryRun 时，报告模式禁止再次查询；
- 工作台订单准时履约率读取 Data Fabric，演示与生产模式显式隔离。
- Data Agent 侧栏不再提供独立设置入口；默认时间范围、澄清策略和查询上限迁入 AI伙伴“智能体定义”的 Data Agent 配置，执行方式与外部运行时复用 AI伙伴资料编辑和“运行时设置”页。

## 3. 已验证

- 完整门禁：typecheck、lint、52 个测试文件/729 个测试、build、contract、pack check 全部通过（2026-10-30）。
- 隔离 profile smoke：
  - Data Agent 引导信息返回保护标记；
  - 删除接口返回 `system_agent_protected`；
  - Reset 可重复执行且不产生重复对象；
  - MVP 指标选区 resolve 成功；
  - 工作台面板目录包含 `pluginmax.data-agent`。
- GUI：
  - 7 个一级页面右上角均有恒驻 Data Agent 入口；
  - task、workflow、workflow_node、meeting、metric_card、通用卡片和用户文本选择均通过；
  - task / workflow / meeting 整卡点击只唤起选区，显式详情按钮才跳转；
  - Data Agent 与沟通同时打开、页签切换、独立关闭；
  - 草稿在页签切换后保留；
  - 切换到项目页后全局入口、会话和草稿仍保留；
  - 新会话保持空白，不加载旧历史；
  - 普通对话、报告、显式 HTML 派生和原生澄清通过；
  - 普通对话气泡中的粗体、表格和列表按 Markdown 渲染；
  - `entity_read` 真实读取任务 history，并返回 Run 元数据；
  - 每日简报中的“切西瓜-产品PRD设计 · Agent Run 被中断”还原为 task `TSK-MV91RFMO-0492`，上下文包含 interrupted/succeeded 两个 Run ID、错误与恢复记录；
  - 展开状态与 390px 移动端无横向溢出；
  - 浏览器 Console 与失败响应为空。
- 订单 GUI：
  - 无选区“今天有没有订单异常”返回范围、指标版本、截止时间、权限覆盖、QueryRun 证据和不确定性；
  - “查看华东生鲜”完成下钻；
  - member 仅覆盖华东/华南时明确提示华北/西南未覆盖；
  - 正式报告复用会话 QueryRun；
  - HTML 从同一报告快照派生且不新增 QueryRun；
  - 390px 移动端无横向溢出；
  - Console 与失败网络请求为空。

完整用例、步骤和结果见 [data-agent-gui-test-plan.md](./data-agent-gui-test-plan.md)。

## 4. 未验证 / 剩余风险

- 未在真实生产数据仓库上验证 SQL / 指标 MCP 的字段级与行级脱敏；MVP 的权限边界已落在工作区成员校验和 Runtime Profile 工具白名单，但真实 Connector 仍需接入其服务端 ACL。
- HTML 下载已实现；ZIP 图片打包未接入打包器，接口会明确返回未配置错误，不伪造 ZIP。
- 定时报告订阅、主动洞察扫描和投递失败通知只持久化了配置结构，尚未挂接调度器与消息通道。
- Codex / Codebuddy 外部运行时的实际探测取决于宿主是否注册对应 Runtime 与命令是否可执行；无外部 Runtime 时回退平台内置运行时。
- GUI 自动化覆盖了核心交互，但未做完整跨浏览器矩阵。
- 工作台处于“平台全量”时可能同时展示来自不同工作区的对象。选区切换到另一工作区会清空前一工作区附件，避免跨工作区拼接；跨工作区联合分析不在 MVP 范围。
