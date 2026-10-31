# 给开发人员的 Demo 改造 Prompt

## 目标

实现 `<scenario-id>` Demo，复用现有正式能力，并保持 Demo 可拆卸。

## 硬约束

1. Demo 代码位于独立插件 `dsh-collab-demo-<scenario-id>`。
2. 通过 `PLUGINMAX_ENABLE_<SCENARIO>_DEMO` 可选安装。
3. 正式插件不得 import Demo 包或引用 Demo 常量、fixture、CSS、路由和 MCP 资产。
4. 外部系统使用标准 MCP Server。
5. 通过资源市场 `McpCatalogProvider` 注册。
6. 必须支持 `initialize`、`tools/list`、`tools/call`。
7. 不得增加 Demo 专用 REST 写接口。
8. `data-agent` 不得获得业务写工具。
9. 写操作必须有人类确认、Action Ticket 和幂等。
10. 卸载 Demo 后正式功能必须正常。

## 需要新增

- Demo fixture；
- Mock MCP Server；
- Demo MCP Provider；
- Demo Data Agent / AI 伙伴提示词；
- 可选工作台 display profile；
- 任务详情扩展卡；
- 业务动作 Mock MCP 工具；
- 录制和拆卸测试。

## 可修改的正式能力

只允许通用能力：

- 多 MCP provider 注册和按 asset ID 路由；
- 通用 UI extension slot；
- 通用 feature flag / optional profile；
- 通用 demo display extension。

这些通用代码中不得出现场景名称、固定业务文案、Demo 工单号或 fixture ID。

## 验收

- [ ] MCP 资产在资源市场可见。
- [ ] 连接状态来自 provider。
- [ ] Data Agent 预演通过。
- [ ] 写工具权限隔离正确。
- [ ] 人工确认后通过 MCP 创建业务单据。
- [ ] 重复调用幂等。
- [ ] Demo 插件卸载后正式应用正常。
- [ ] Demo 数据、任务、连接和工作台展示可清理。
