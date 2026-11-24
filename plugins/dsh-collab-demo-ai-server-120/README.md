# dsh-collab-demo-ai-server-120

AI Server 120 台订单决策案例的可安装 Mock MCP 插件。

## 提供内容

插件通过 `McpCatalogProvider` 向资源市场注册六个标准 stdio MCP：

| 资产 ID | 系统 | Tool 数 |
|---|---|---:|
| `mcp-mock-oms-ai-server-120` | OMS | 4 |
| `mcp-mock-srm-ai-server-120` | SRM | 4 |
| `mcp-mock-aps-planning-ai-server-120` | APS-PLANNING | 3 |
| `mcp-mock-mes-ai-server-120` | MES | 4 |
| `mcp-mock-wms-ai-server-120` | WMS | 4 |
| `mcp-mock-qms-ai-server-120` | QMS | 3 |

每个资产都支持：

- `initialize`
- `tools/list`
- `tools/call`

## 数据源

`documents/` 下六份 Markdown 与案例导入包保持一致。每个 stdio server 启动时：

1. 读取 `--system`；
2. 从 `config/mock-mcp-assets.yaml` 找到资产；
3. 解析该资产唯一一个 `json mock-mcp-snapshot`；
4. 按 Tool 的 `fields` 返回选定数据。

## 安装

本插件默认随 `scripts/install-profile.sh` 安装。显式关闭：

```bash
PLUGINMAX_ENABLE_AI_SERVER_120_MOCK=0 ./scripts/install-profile.sh
```

只安装本插件：

```bash
DSH_HOME="${DSH_HOME:-$PWD/.tmp/dsh-home}" \
node vendor/deepseek-harness/apps/cli/lib/bin.js \
  plugin --profile pluginmax add "$PWD/plugins/dsh-collab-demo-ai-server-120"
```

安装后重启宿主。

## GUI 验证

1. 打开 `资源市场 → MCP`；
2. 应看到六个 `M-...` 资产；
3. 点击 Connect；
4. 状态应变为“已连接”；
5. AI 伙伴调用对应 Tool 时能收到带 `isMock=true` 和 `readOnly=true` 的 JSON。

没有 Provider 时资源市场不会伪造“已连接”；本插件通过真实 stdio 连接返回状态。

## 开发校验

```bash
corepack pnpm --filter dsh-collab-demo-ai-server-120 build
corepack pnpm exec vitest run \
  plugins/dsh-collab-demo-ai-server-120/src/provider.test.ts
```
