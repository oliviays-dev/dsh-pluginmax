# Demo 场景模板

复制本目录到新的场景目录：

```sh
cp -R docs/demos/_scenario-template docs/demos/<scenario-id>-demo
```

建议同时在 `docs/demos/` 下创建：

```text
<scenario-id>-demo-script.md
```

至少替换：

- `scenario.yaml` 中的业务、账号、数据和任务；
- `mcp-assets.yaml` 中的外部系统和工具；
- `demo-script.md` 中的录制步骤和讲解；
- `developer-change-prompt.md` 中的隔离、MCP 和验收要求。

补齐：

- `data/`：fixture 和生成脚本；
- `mock/`：标准 MCP Server；
- `prompts/`：Data Agent、AI 伙伴和报告提示词；
- `config/`：工作台 profile 和业务动作配置。

通用规则见 [Demo 准备 SOP](../demo-preparation-sop.md)。
