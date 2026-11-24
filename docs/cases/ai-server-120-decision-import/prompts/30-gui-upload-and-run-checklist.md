# GUI 上传与运行清单

## 1. 先判断 Mock MCP 运行模式

### 当前 GUI 没有 Mock MCP provider

不要把 `.md` 上传到 `资源市场 → MCP → 自定义`。该入口只接受 JSON 清单，
而且仅登记元数据，不会执行快照或提供 Tool 调用。

此时把以下六个文件作为项目资料上传：

1. `mcp/01-oms-mock-mcp.md`
2. `mcp/02-srm-mock-mcp.md`
3. `mcp/03-aps-planning-mock-mcp.md`
4. `mcp/04-mes-mock-mcp.md`
5. `mcp/05-wms-logistics-mock-mcp.md`
6. `mcp/06-qms-mock-mcp.md`

详细步骤见 `prompts/31-gui-only-project-file-mode.md`。

### 平台已有 Mock MCP provider

本仓库已提供 `dsh-collab-demo-ai-server-120` Provider，并由
`scripts/install-profile.sh` 默认加入 `pluginmax` profile。

重启宿主后，在 `资源市场 → MCP` 直接 Connect 六个
`M-...` 资产，不需要上传 Markdown 或 JSON。

Provider 启动时会验证：

- `initialize` 成功；
- `tools/list` 返回对应工具；
- `tools/call` 能返回 `json mock-mcp-snapshot`。

没有 provider 时，不手工修改连接状态。

## 2. 创建 AI 伙伴模版

使用 `ai-teammates/templates.json` 或 `payloads.json` 创建以下模版：

1. 订单履行 AI 助手；
2. AI Server 计划专员；
3. AI Server 采购专员；
4. AI Server 制造专员；
5. AI Server 质量专员；
6. AI Server 物流专员。

如果通过页面手工创建，SOUL 分别使用 `ai-teammates/souls/` 下对应文件。

## 3. 创建实例并绑定项目

为本案例分别创建 AI 伙伴实例，并绑定项目角色：

| 实例 | 项目角色 |
|---|---|
| 订单履行 AI 助手 | Order Fulfillment |
| AI Server 计划专员 | Planning |
| AI Server 采购专员 | Procurement |
| AI Server 制造专员 | Manufacturing |
| AI Server 质量专员 | Quality |
| AI Server 物流专员 | Logistics |

按最小权限提供数据：

```text
真实 MCP 模式：在资源市场连接对应 Mock MCP asset。
GUI 纯演示模式：仅在 Provider 不可用时，把对应 Markdown 放入项目空间。
```

- Order Fulfillment：OMS、APS-PLANNING；
- Planning：OMS、SRM、APS-PLANNING、MES、WMS、QMS；
- Procurement：SRM、OMS；
- Manufacturing：MES、QMS；
- Quality：QMS、MES；
- Logistics：WMS、MES、QMS。

## 4. 创建根任务

按 `prompts/00-root-task.md` 创建根任务，责任人为人类订单履约负责人林岚；
订单履行 AI 助手通过任务评论配合。

## 5. 创建 AI 子任务

按以下文件创建四个执行子任务，全部关联同一个 `parentTaskId`：

1. `prompts/01-planning-subtask.md`
2. `prompts/02-procurement-subtask.md`
3. `prompts/03-manufacturing-subtask.md`
4. `prompts/05-logistics-subtask.md`

子任务不能继续创建三级任务。

## 6. 收齐结果

逐项检查：

- 91 个有效 GPU；
- 5 台 WIP 已分配 GPU；
- 106 台制造和质量可行；
- 10 个加价 GPU 为增量供给；
- 空运 14 天且无自然缓冲；
- 116/120 台没有无条件可行结论。

## 7. 创建人工决策子任务

四个执行子任务和 Manufacturing 节点内 Quality 放行完成后，按
`prompts/06-human-decision-subtask.md`
创建人工子任务，责任人选择供应链负责人。

## 8. 生成报告并发起会议

1. 用 `prompts/20-final-decision-report-template.md` 生成报告；
2. 把报告提交到根任务；
3. 用 `prompts/10-meeting-agenda.md` 发起会议；
4. 用 `prompts/11-meeting-opening-message.md` 发送开场消息；
5. 会后把决定写回根任务和人工决策子任务。

## 9. 通过标准

```text
六个 Mock Source Document 可读取，或六个真实 Mock MCP 可连接
五个 AI 伙伴模板与 SOUL 正确；Quality 使用 Manufacturing 节点内真人放行
根任务成功协调三个 AI 子任务、一个 Procurement 人工子任务和一个最终人工决策子任务
每个人工审批项有清楚责任人
最终报告包含 A/B/C/D 四方案
会议实际发生并记录最终方案
根任务回写承诺数量、日期、成本和风险
```
