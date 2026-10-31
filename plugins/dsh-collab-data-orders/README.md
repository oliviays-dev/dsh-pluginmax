# dsh-collab-data-orders

订单领域的只读 Data Fabric 适配插件。

- 订单 Connector manifest、字段映射与迁移；
- 订单 Dataset / Metric / Policy / Skill；
- 显式 `demo` 数据源与生产连接隔离；
- 现有资源市场 MCP provider 注册、连接与工具调用；
- 独立 Mock OMS MCP server，仅暴露只读 `orders_health` / `orders_query`；
- 生产 HTTP JSON 回退，端点和凭据只允许通过环境引用解析；
- 工作台订单履约指标显示配置。

没有配置 `env:ORDERS_READONLY_ENDPOINT` 和
`env:ORDERS_READONLY_TOKEN` 时，生产查询 fail closed。演示数据只在
`mode=demo` 且 Dataset `isFixture=true` 时启用，不得作为生产结果。
