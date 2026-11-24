# SO0101 任务树创建清单

> 不自动创建任务。以下字段用于在 GUI 中按现有 AI 伙伴和真人席位创建父子任务。

## 根任务

| 字段 | 值 |
|---|---|
| 标题 | `[AI-SERVER-120] 14 天交付 96 台与 120 台订单决策` |
| 项目 | SO0101-战略客户X的AI Server交付 |
| 优先级 | P0 |
| 责任人类型 | 人类用户 |
| 责任人 | 林岚（Order Fulfillment 真人席位） |
| 责任人 ID | `linlan` |
| AI 助手 | 订单履行专员 AI 伙伴 `tm-1079749e-fc3a-40d9-a9d3-32c378b9ffd2` |
| 状态 | 进行中 |
| 完成方式 | 收集子任务后生成报告，再提交人工验收 |

任务描述与验收使用：

`prompts/00-root-task.md`

## 子任务

所有子任务均直接挂在根任务下，设置 `parentTaskId = 根任务 ID`。
根任务和所有对外沟通由人类负责；AI 只有在被 @ 或收到内部子任务时提供分析。

### 1. Planning

| 字段 | 值 |
|---|---|
| 标题 | `[AI-SERVER-120-PLAN] 计算供需、数量桥与四方案成本` |
| 责任人类型 | AI 伙伴 |
| 责任人 | 计划专员 AI 伙伴 |
| 责任人 ID | `tm-1fa7d001-bc75-448f-b43b-7add8e2b2a08` |
| 优先级 | P0 |
| 建议开始顺序 | 1 |
| Prompt | `prompts/01-planning-subtask.md` |

验收必须包含：

- 有效 GPU 91 个；
- 96/106/116/120 数量桥；
- A/B/C/D 成本 360/860/760/1,260 万元；
- 空运 14 天且零自然缓冲；
- 120 台 MES 未确认。

### 2. Procurement

| 字段 | 值 |
|---|---|
| 标题 | `[AI-SERVER-120-SUP] 确认 GPU 供应与供应商关系` |
| 责任人类型 | 人类用户 |
| 责任人 | 平台Admin（Procurement 人工执行） |
| 责任人 ID | `admin` |
| AI 助手 | 采购专员 AI 伙伴 `tm-9857be82-3f8d-419e-a32e-f7aa30ebe355`，通过任务沟通 @ 唤起 |
| 优先级 | P0 |
| 建议开始顺序 | 1，与 Planning 并行 |
| Prompt | `prompts/02-procurement-subtask.md` |

验收必须包含：

- 130 降供 30% 后 91 个；
- 10 个为增量 GPU，成本 500 万元；
- 20 个跨客户调拨和 3-5 天延期；
- 供应商关系不能只用金额表达；
- 对外供应商沟通由人类执行，AI 回执只能作为内部建议。

### 3. Manufacturing

| 字段 | 值 |
|---|---|
| 标题 | `[AI-SERVER-120-MFG] 确认 WIP、产能与生产效率损失` |
| 责任人类型 | AI 伙伴 |
| 责任人 | 制造专员 AI 伙伴 |
| 责任人 ID | `tm-b3993e32-8a70-4c6c-8468-ba407c6e1363` |
| 优先级 | P0 |
| 建议开始顺序 | 1，与 Planning 并行 |
| Prompt | `prompts/03-manufacturing-subtask.md` |

验收必须包含：

- 5 台 WIP 已分配 GPU；
- 96 台可行、106 台加班可行；
- 160 万元生产损失；
- 116 台可能影响其他订单；
- 120 台未确认。

### 4. Logistics

| 字段 | 值 |
|---|---|
| 标题 | `[AI-SERVER-120-LOG] 确认空运时效、费用与舱位` |
| 责任人类型 | AI 伙伴 |
| 责任人 | 物流专员 AI 伙伴 |
| 责任人 ID | `tm-c7da14ad-a2cd-4795-b564-70c430866845` |
| 优先级 | P0 |
| 建议开始顺序 | 1，与 Planning 并行 |
| Prompt | `prompts/05-logistics-subtask.md` |

验收必须包含：

- 普通 E2E 21 天不可行；
- 空运 E2E 14 天；
- 96/106 台单一批次可行；
- 空运成本 200 万元；
- 无自然安全缓冲；
- AI 只输出内部运输方案，订舱和承运商沟通由人类执行。

### 5. 人工决策

| 字段 | 值 |
|---|---|
| 标题 | `[AI-SERVER-120-DEC] 供应链负责人审批交付方案` |
| 责任人类型 | 人类用户 |
| 责任人 | 供应链负责人（项目 `admin`） |
| 优先级 | P0 |
| 建议开始顺序 | 最后 |
| Prompt | `prompts/06-human-decision-subtask.md` |

该任务必须在以下条件满足后创建或进入处理中：

- 四个执行子任务回执齐全；
- Manufacturing 已取得 Quality 节点内放行；
- Order Fulfillment 已生成最终报告；
- 决策会议已结束或已形成会议结论。

## 执行顺序

```text
Planning ─┐
Procurement ├─> Order Fulfillment 汇总报告
Manufacturing + Quality Gate ┘
Logistics ────────────────────┘
                         ↓
                  发起决策会议
                         ↓
               供应链负责人人工决策
                         ↓
                  根任务回写并验收
```

Planning、Manufacturing、Logistics 可通过 MCP 直接由 AI 执行；Procurement 由人类
承接，并可 @ 采购 AI 伙伴辅助。Manufacturing 完成后必须由现有 Quality 真人角色
做节点内放行审批；人工决策不得早于人类订单履约负责人审核后的报告和会议。

## 运行前检查

```text
[x] 六个 Mock MCP 已由 admin 连接
[x] 五个 AI 岗位实例 active 且有实例 SOUL
[x] Quality 已合并为 Manufacturing 节点内人工放行 Gate
[x] Order Fulfillment 根任务改为真人林岚
[x] Procurement 子任务改为真人 Admin，采购 AI 作为沟通助手
[ ] 创建根任务
[ ] 创建四个执行子任务和一个人工决策子任务，并设置 parentTaskId
[ ] 执行四个岗位任务并完成 Manufacturing 内 Quality 放行
[ ] 生成最终决策报告
[ ] 发起会议
[ ] 创建并完成人工决策子任务
[ ] 根任务验收和结案
```
