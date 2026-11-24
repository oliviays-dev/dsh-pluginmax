# AI Server 120 台订单决策导入包

本目录是一套可直接按系统 GUI 手动上传的案例资源，用于驱动：

```text
Order Fulfillment 根任务
  → Planning / Procurement / Manufacturing / Logistics 四个执行子任务
  → Quality 在 Manufacturing 节点内人工放行
  → 汇总决策报告
  → 发起供应链决策会议
  → 供应链负责人人工批准
  → 回写最终方案和行动项
```

## 核心业务结论

- 130 个 GPU 降供 30% 后，14 天有效量为 91 个；
- 追回 5 台 WIP 后达到 96 台最低交付线；
- 加价采购 10 个 GPU 后达到 106 台；
- 跨客户调拨 20 个 GPU 后达到 116 台，但其他客户延期 3-5 天；
- 普通 E2E 21 天，空运 14 天，空运是必要条件且没有自然安全缓冲；
- 方案 A/B/C/D 综合成本分别为 360、860、760、1,260 万元；
- 默认建议方案 B，方案 A 为降级。

方案 C 的账面成本比 B 少 100 万元并多交付 10 台，但会损害其他客户关系。
400 万元是延期成本的统一数字假设，不是客户关系损失的完整估值。

## 目录

```text
ai-server-120-decision-import/
├── README.md
├── manifest.json
├── case/
│   └── ai-server-order-decision-case.json
├── mcp/
│   ├── 01-oms-mock-mcp.md
│   ├── 02-srm-mock-mcp.md
│   ├── 03-aps-planning-mock-mcp.md
│   ├── 04-mes-mock-mcp.md
│   ├── 05-wms-logistics-mock-mcp.md
│   └── 06-qms-mock-mcp.md
├── ai-teammates/
│   ├── templates.json
│   ├── payloads.json
│   ├── build-payloads.mjs
│   └── souls/
│       ├── 01-order-fulfillment-SOUL.md
│       ├── 02-planning-SOUL.md
│       ├── 03-procurement-SOUL.md
│       ├── 04-manufacturing-SOUL.md
│       └── 06-logistics-SOUL.md
├── prompts/
│   ├── 00-root-task.md
│   ├── 01-planning-subtask.md
│   ├── 02-procurement-subtask.md
│   ├── 03-manufacturing-subtask.md
│   ├── 05-logistics-subtask.md
│   ├── 06-human-decision-subtask.md
│   ├── 10-meeting-agenda.md
│   ├── 11-meeting-opening-message.md
│   ├── 20-final-decision-report-template.md
│   ├── 30-gui-upload-and-run-checklist.md
│   └── 31-gui-only-project-file-mode.md
└── system-update/
    ├── update-existing-instance-souls.mjs
    └── instance-souls/
        ├── 01-order-fulfillment-instance-SOUL.md
        ├── 02-planning-instance-SOUL.md
        ├── 03-procurement-instance-SOUL.md
        ├── 04-manufacturing-instance-SOUL.md
        └── 05-logistics-instance-SOUL.md
```

`system-update/instance-souls/` 是本次写入现有五个 SO0101 AI 伙伴实例的项目级
SOUL；`update-existing-instance-souls.mjs --apply` 可幂等重放，不会创建实例。

## 重要：MCP 文件不能直接当 MCP 服务上传

当前系统的 `资源市场 → MCP → 自定义 → 注册自定义资源`：

- 文件输入只接受 `.json`，不接受 `.md`；
- JSON 清单只登记名称、说明、权限等元数据；
- 平台不会执行 Markdown 快照，也不会自动生成 `tools/list` 或 `tools/call`；
- 只有在 `McpCatalogProvider` 提供真实连接后，MCP 状态才可能变成“已连接”。

因此本包提供两种运行模式。

### 模式一：GUI 纯演示模式

适用于当前没有 Mock MCP provider 的环境：

1. 把 `mcp/` 下六份 Markdown 作为项目资料或任务附件上传；
2. AI 伙伴通过 `read_file` 按文件名读取 Mock Source Document；
3. 不声称“MCP 已连接”，只说明数据来自“项目内 Mock Source Document”；
4. 其他 AI 模板、子任务、报告和会议流程保持不变。

具体操作见：
[GUI 纯演示模式](prompts/31-gui-only-project-file-mode.md)。

### 模式二：真实 MCP 模式

本仓库已提供并默认安装真实 Mock Provider：
[dsh-collab-demo-ai-server-120](../../../plugins/dsh-collab-demo-ai-server-120/README.md)。

1. 由 provider 注册六个 MCP asset ID；
2. `initialize` 和 `tools/list` 成功后，资源市场才显示可连接；
3. `tools/call` 返回对应 `json mock-mcp-snapshot` 内容；
4. 没有 provider 时，不得手工把种子 MCP 标成已连接。

推荐使用真实 MCP 模式。重启宿主后，在 `资源市场 → MCP` 中直接 Connect
六个 `M-...` 资产即可，不需要上传 `.md` 或 JSON 清单。

## 业务链路字段原则

业务链路节点只保存常驻业务事实，例如订单日期、订单数量、要求交期、计划承诺日期、
投产、在制品、产出和批次发运。

以下内容属于 AI 伙伴在任务交互中的模拟结果或建议，不写入业务链路字段：

- 96/106/116/120 台生产可行性；
- 8% 效率损失和 160 万元生产损失估算；
- 加价采购与跨客户调拨的数量建议；
- 空运费用、空运可行性和时间缓冲测算；
- A/B/C/D 方案比较和推荐意见。
- 合格、不合格、待检验等过程质量反馈。

## 资源准备顺序

### 第一步：确定 Mock 数据运行模式

选择以下一种：

- GUI 纯演示：上传六份 Markdown 到项目资料；
- 真实 MCP：安装 `dsh-collab-demo-ai-server-120` 并重启宿主。

每份 Markdown 都包含系统身份、Tool 契约、权限边界和一个
`json mock-mcp-snapshot` 快照，但它们本身不是可启动的 MCP Server。

### 第二步：AI 伙伴模版

优先使用 `ai-teammates/payloads.json` 中的完整 `body` 创建五个 AI 岗位模版。
Quality 使用现有真人席位，不创建质量 AI。

如果当前 GUI 只支持页面填写，则：

1. 从 `ai-teammates/templates.json` 复制名称、角色、描述、场景、目标和工具；
2. 上传对应 `ai-teammates/souls/*.md` 作为 SOUL；
3. Skills 初始留空；
4. 允许实例追加 Skill，但禁止覆盖受保护场景。

### 第三步：创建实例并绑定角色

| AI 伙伴 | 业务链路角色 |
|---|---|
| 订单履行 AI 助手 | Order Fulfillment |
| AI Server 计划专员 | Planning |
| AI Server 采购专员 | Procurement |
| AI Server 制造专员 | Manufacturing |
| AI Server 物流专员 | Logistics |

### 第四步：创建根任务

使用 `prompts/00-root-task.md`。根任务责任人是人类订单履约负责人，AI 仅作为
任务沟通助手。

### 第五步：创建子任务

人类订单履约负责人创建三个 AI 子任务、一个 Procurement 人工任务和一个人工决策
子任务：

- Planning；
- Procurement（真人，可 @ AI）；
- Manufacturing（包含 MES/QMS 与 Quality 人工放行）；
- Logistics；
- 供应链负责人。

所有子任务均直接挂在根任务下，不创建三级任务。

### 第六步：生成报告和会议

使用：

- `prompts/20-final-decision-report-template.md`
- `prompts/10-meeting-agenda.md`
- `prompts/11-meeting-opening-message.md`

会议必须由 Order Fulfillment 发起和汇报，最终由供应链负责人批准。

## 预期最终结果

默认建议：

```text
采用方案 B。
14 天交付 106 台。
保留 96 台作为对外保底承诺，106 台在采购、制造、质量、物流条件全部关闭后升级承诺。
剩余 14 台延期交付，具体日期由会议确认。
```

必须保留的人工审批：

- 加价采购 500 万元；
- 空运 200 万元；
- 加班和 160 万元生产损失；
- 是否启用跨客户调拨；
- 对外承诺数量与日期；
- 其他客户关系影响。

## 质量检查

运行：

```bash
node ai-teammates/build-payloads.mjs
```

再检查：

- 六个 Mock 文档各有一个 `json mock-mcp-snapshot`；
- 五个 AI 模板的 `soulFile` 全部存在；
- `payloads.json` 包含五个完整 `body`，不包含 Quality AI；
- 所有成本和数量与 `case/ai-server-order-decision-case.json` 一致；
- 没有将 120 台标成已确认产能；
- 没有将 400 万元外部成本等同于全部客户关系损失。
