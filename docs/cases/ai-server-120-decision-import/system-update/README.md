# SO0101 系统配置更新说明

## 分层原则

### 智能体定义

保存岗位通用内容：

- 角色身份与使命；
- 责任和权限边界；
- 通用工作原则；
- 输入校验、门禁、升级和交付格式；
- 不包含 SO0101、AI Server 订单数量、项目 MCP 或会议偏好。

### AI 伙伴实例 SOUL

只保存当前实例的项目补充：

- SO0101 / AI Server 产品线上下文；
- 本项目 MCP 资产；
- 当前案例固定事实；
- 与其他岗位的协同顺序；
- 项目输出偏好和默认判断；
- 会议职责和人工审批边界。

运行时生效顺序：

```text
智能体定义 SOUL
→ 追加实例 instanceSoul
→ 追加工作场景/工作目标
→ 注入 Agent Prompt
```

## 本次更新

只更新以下现有实例：

- `tm-1079749e-fc3a-40d9-a9d3-32c378b9ffd2`：Order Fulfillment
- `tm-1fa7d001-bc75-448f-b43b-7add8e2b2a08`：Planning
- `tm-9857be82-3f8d-419e-a32e-f7aa30ebe355`：Procurement
- `tm-b3993e32-8a70-4c6c-8468-ba407c6e1363`：Manufacturing
- `tm-c7da14ad-a2cd-4795-b564-70c430866845`：Logistics

Quality 不创建 AI 伙伴，也不再作为独立业务链路节点；Quality 由项目现有真人
Admin 在 Manufacturing 节点内完成放行审批。

五个岗位的智能体定义不写入项目事实，因此其他项目复用相同模版时不会看到 SO0101 内容。
五个通用模版统一增加“人机协作与外部沟通”章节：AI 可以查询、模拟和起草，
但对外沟通、正式报价、交期、合同、赔偿和承诺必须由人类确认。

项目角色执行主体：

- Order Fulfillment：真人林岚；订单履行 AI 作为任务沟通助手。
- Procurement：真人 Admin；采购 AI 通过任务评论按需辅助。
- Quality：作为 Manufacturing 节点内人工放行 Gate。
- Planning、Manufacturing、Logistics：可由 AI 直接执行 MCP 查询和模拟。
- Logistics 的订舱和承运商沟通仍保留人工 Gate。
- 最终决策：供应链负责人 Admin。

## 业务链路字段边界

业务链路只保留节点常驻事实：

- 订单日期、订单数量、客户要求交期；
- 计划承诺日期和承诺状态；
- GPU 预留量与供应覆盖量；
- 投产数量、在制品和产出；
- 发运状态和计划发运日期。

生产损失、产能可行性、合格/不合格/待检验、质量放行情景、加价采购、跨客户调拨、空运费用和方案推荐，
统一作为 AI 任务回执，不写入业务链路节点字段。

## 幂等执行

```bash
node update-existing-instance-souls.mjs            # dry-run
node update-existing-instance-souls.mjs --apply    # 写入
node update-template-human-ai-boundary.mjs         # 模版 dry-run
node update-template-human-ai-boundary.mjs --apply # 模版写入
node update-quality-merge-business-chain.mjs         # 链路 dry-run
node update-quality-merge-business-chain.mjs --apply # 6 节点合并为 5 节点
```

写入前自动备份 `collab_teammate.json`。重复执行且内容未变化时，不会新增事件或增加版本。

业务链路更新会备份 `collab_workflow.json`、`collab_project.json` 和
`collab_assignment.json`。当前已从 6 节点更新为 5 节点，并同步 workflow instance、
项目节点绑定和演示数据。

## 任务树

[task-tree-ready.md](task-tree-ready.md) 列出了根任务、三个 AI 子任务、一个
Procurement 人工子任务和一个人工决策
子任务的现有实例 ID、执行顺序、Prompt 与验收要求。
