# Data Agent 实现说明

> 产品口径：[data-agent-prd.md](./data-agent-prd.md) v1.3  
> 实现范围：`dsh-pluginmax` Data Agent MVP  
> 日期：2026-10-29

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
| 10.2、10.3 安全 | 默认只读；工具白名单固定为 `entity.read`、`metric.query`、`dataset.query.readonly`、`report.render`、`artifact.write`。MCP 仅作为连接协议，不作为泛化工具授权 |
| 11.2 接口 | 身份/配置/Reset、selection resolve、conversation、query、run、report、render-html、download、asset、share |
| 第 18 节归档 | Conversation / Message / Context Attachment / Agent Run 引用 / Report Artifact / Communication 原链路；默认私人归属，支持 project/workspace/meeting 共享副本 |
| 第 19 节实体扩展 | `window.__pluginmaxDataAgentEntityRegistry.register(adapter)` 提供稳定扩展点 |

## 3. 已验证

- `typecheck`、`lint`、全量 645+ 单元/契约测试、build、contract。
- 隔离 profile smoke：
  - Data Agent 引导信息返回保护标记；
  - 删除接口返回 `system_agent_protected`；
  - Reset 可重复执行且不产生重复对象；
  - MVP 指标选区 resolve 成功；
  - 工作台面板目录包含 `pluginmax.data-agent`。
- GUI：
  - 工作台右上角 Data Agent 图标位于沟通左侧；
  - 指标卡点击出现“让DataAgent分析”，选区快照进入附件区；
  - Data Agent 与沟通同时打开、页签切换、独立关闭；
  - 草稿在页签切换后保留；
  - 切换到项目页后全局入口、会话和草稿仍保留；
  - 展开状态与移动窄屏无横向溢出。

## 4. 未验证 / 剩余风险

- 未在真实生产数据仓库上验证 SQL / 指标 MCP 的字段级与行级脱敏；MVP 的权限边界已落在工作区成员校验和 Runtime Profile 工具白名单，但真实 Connector 仍需接入其服务端 ACL。
- HTML 下载已实现；ZIP 图片打包未接入打包器，接口会明确返回未配置错误，不伪造 ZIP。
- 定时报告订阅、主动洞察扫描和投递失败通知只持久化了配置结构，尚未挂接调度器与消息通道。
- Codex / Codebuddy 外部运行时的实际探测取决于宿主是否注册对应 Runtime 与命令是否可执行；无外部 Runtime 时回退平台内置运行时。
- GUI 自动化覆盖了核心交互，但未做完整跨浏览器矩阵。
