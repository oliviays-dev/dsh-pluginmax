# GUI 纯演示模式

## 适用条件

当前系统没有安装能够注册六个 Mock MCP 的 `McpCatalogProvider`。

资源市场的 `MCP → 自定义` 只能登记 JSON 清单，不能执行 Markdown 快照，
所以本模式不使用资源市场 MCP 连接。

## 上传位置

将以下文件上传到当前项目空间或根任务资料区：

```text
01-oms-mock-mcp.md
02-srm-mock-mcp.md
03-aps-planning-mock-mcp.md
04-mes-mock-mcp.md
05-wms-logistics-mock-mcp.md
06-qms-mock-mcp.md
```

建议保留文件名前缀，避免 AI 伙伴按名称读取时混淆。

## AI 伙伴读取规则

Order Fulfillment 根任务开场说明：

```text
当前项目空间包含六份 Mock Source Document：
- 01-oms-mock-mcp.md
- 02-srm-mock-mcp.md
- 03-aps-planning-mock-mcp.md
- 04-mes-mock-mcp.md
- 05-wms-logistics-mock-mcp.md
- 06-qms-mock-mcp.md

当前运行在项目文件模式，不是 MCP 连接模式。
请按文件名读取 Markdown 中的 `json mock-mcp-snapshot`，并在报告中注明：
“数据来源：项目内 Mock Source Document，非生产数据”。

不得声称已连接 OMS、SRM、APS、MES、WMS 或 QMS MCP。
```

## 子任务派发

各子任务在描述末尾追加对应文件：

| 子任务 | 必读文件 |
|---|---|
| Planning | 六份全部 |
| Procurement | OMS、SRM |
| Manufacturing | MES、QMS |
| Quality | QMS、MES |
| Logistics | WMS、MES、QMS |

## 输出标记

每份交付物都保留以下来源标记：

```text
dataMode: project-file-mock
productionData: false
mcpConnection: not-used
```

## 通过标准

```text
六份 Markdown 均可在项目空间按文件名读取
每份文件只解析一个 json mock-mcp-snapshot
AI 伙伴不声称连接了真实 MCP
根任务和报告明确标注非生产 Mock 数据
子任务、报告、会议和人工决策流程正常运行
```

## 何时切换真实 MCP

只有平台安装并启用对应 `McpCatalogProvider`，且完成以下验证后，才切换为 MCP 模式：

```text
initialize
tools/list
tools/call
connected
```

切换后移除任务中的项目文件读取说明，避免同时保留两套数据口径。
