# 项目业务链路与项目概览技术设计

> 文档状态：技术设计评审稿  
> 适用模块：`dsh-collab-project`、`dsh-collab-workflow`、项目概览 MCP Adapter  
> 关联文档：
> [总体方案](README.md)
> [计划系统 Mock MCP](01-planning-system-mcp.md)
> [订单系统 Mock MCP](02-order-management-system-mcp.md)
> [库存系统 Mock MCP](03-inventory-system-mcp.md)
> [产能系统 Mock MCP](04-capacity-system-mcp.md)
> [业务链路与工作流绑定](05-trunk-workflow-binding.md)
> [Alert 投影](06-alert-projection-impact.md)
> [项目设置「业务链路」页签交互规格](08-project-settings-business-chain-tab.md)
> [项目类型、项目模版与业务链路模板模型](09-project-type-template-business-chain.md)

## 1. 设计结论

### 1.1 决策

采用 **项目类型 / 项目模版治理 + 业务链路定义 + 外部业务事实 + 项目域读模型** 的混合方案。

```text
项目类型 / 项目模版：负责可用业务链路范围、默认链路和版本策略
业务链路定义 / 实例：负责流程拓扑、执行状态、负责人、审批和任务
计划 / 订单 / 库存 / 产能 MCP：负责业务事实
项目插件：负责合并、冲突处理、Alert 投影和页面 Read Model
```

不是把供应链交付链路写死为全局唯一主干，也不是另建一套独立的流程图系统。

### 1.2 决策理由

| 方案 | 优点 | 主要问题 | 结论 |
| --- | --- | --- | --- |
| 完全复用任意工作流 | 实现最快，执行能力完整 | 无法确认哪条是业务链路；业务事实与执行定义混层；容易形成第二套数据真相 | 不采用 |
| 新建独立 ProjectTrunk 系统 | 领域拆分清晰 | 重复节点、状态、负责人、审批、任务、权限和事件模型 | 不采用 |
| 项目模版 + 业务链路 + 外部事实读模型 | 复用执行能力，保留场景差异和系统主数据权威性 | 需要新增模版策略、绑定契约、Adapter 和 Alert 投影 | **推荐** |

### 1.3 成本判断

该方案不是“零改造复用”，而是：

- 复用工作流的定义、实例、执行、任务和审批能力。
- 新增项目模版业务链路策略、业务链路语义、外部引用和项目域 Read Model。
- 浏览器不直接调用 MCP，也不直接读取工作流内部存储。

## 2. 范围

### 2.1 本期范围

- 一个项目模版配置一条默认业务链路和可选候选集合。
- 一个项目实例只选择一个模版允许的业务链路，并保存版本快照。
- 业务链路节点可按场景绑定计划、订单、库存、产能或其他来源。
- 项目概览读取并合并当前业务链路场景所需的业务事实。
- 节点展示原计划、变更后计划、实际完成和异常。
- 关键变更与外部影响按时间正序展示。
- Alert 使用稳定条件键投影。
- 来源过期、缺失、冲突时有明确状态。

### 2.2 非目标

- 不在项目内直接编辑计划系统数据。
- 不把 MCP 返回数据写回 OMS、WMS、MES 或 Planning。
- 不支持项目概览内任意新增流程节点。
- 不把工作流定义发布为跨企业的 BPMN 标准。
- 不在本期实现复杂流程仿真和流程挖掘。

## 3. 当前代码基线

### 3.1 项目域

| 当前能力 | 代码位置 | 说明 |
| --- | --- | --- |
| 项目 = 工作区 | [types.ts](../../plugins/dsh-collab-project/src/types.ts) | 项目主键为 `workspaceId` |
| 项目扩展记录 | `projectRecordSchema` | 已有状态、负责人、进度、日期、角色、日报设置 |
| 项目模版 | `projectTemplateRecordSchema` | 已按 `type` 分类，并引用项目角色和工作流模版 |
| 项目详情路由 | [index.ts](../../plugins/dsh-collab-project/src/index.ts) | 返回项目、成员、任务、工作流和 viewer |
| 项目概览客户端 | [client/index.js](../../plugins/dsh-collab-project/client/index.js) | 当前在浏览器侧合并工作流详情、任务和日报 |
| 项目日报 | `collab_project.reports` | 可作为“项目关键进展”的第一阶段来源 |

### 3.2 工作流域

| 当前能力 | 代码位置 | 可复用性 |
| --- | --- | --- |
| 版本化定义 | [types.ts](../../plugins/dsh-collab-workflow/src/types.ts) | 直接复用 |
| 节点、边、分支、审批 | `workflowGraphSchema` | 直接复用 |
| 实例与节点状态 | `workflowInstanceSchema` | 直接复用 |
| 角色快照与任务绑定 | `roleSnapshot`、`taskIds` | 直接复用 |
| 工作流详情 API | `/api/collab/workflow/instances/detail` | 作为控制面数据来源 |
| 工作流事件 | `workflowEventSchema` | 作为执行异常和变更候选来源 |

### 3.3 当前缺口

1. 项目模版只引用角色和工作流模版，没有业务链路策略。
2. 无法按项目类型约束可用业务链路。
3. 无法区分“业务链路工作流”和普通执行工作流。
4. 工作流节点没有稳定 `stageCode` 和 `externalRefs`。
5. 项目记录没有业务链路模版、定义和实例快照。
6. 项目概览在客户端临时派生 Alert，缺少稳定 ID 和生命周期。
7. 外部业务事实没有服务端适配器和来源健康状态。
8. 不同项目类型的业务事实没有按场景注册的 MCP 契约。

## 4. 总体架构

```text
┌──────────────────────────────────────────────────────────────┐
│                       Browser / Project UI                    │
│  项目概览页读取 ProjectProgressOverview Read Model            │
└──────────────────────────────┬───────────────────────────────┘
                               │ GET progress-overview
┌──────────────────────────────▼───────────────────────────────┐
│                    dsh-collab-project                        │
│                                                              │
│  ProjectProgressOverviewService                              │
│    ├─ TrunkResolver                                          │
│    ├─ WorkflowControlPlaneAdapter                            │
│    ├─ PlanningMcpAdapter                                     │
│    ├─ OrderMcpAdapter                                       │
│    ├─ InventoryMcpAdapter                                    │
│    ├─ CapacityMcpAdapter                                    │
│    ├─ FactMerger                                            │
│    └─ AlertProjectionService                                 │
│                                                              │
│  collab_project.source_snapshots                             │
│  collab_project.alerts                                      │
└───────────────┬───────────────────────────┬──────────────────┘
                │                           │
┌───────────────▼───────────────┐ ┌─────────▼──────────────────┐
│ dsh-collab-workflow           │ │ MCP Gateway / Mock Sources │
│ definitions / instances       │ │ Scenario MCPs / data sources │
│ events / tasks / approvals    │ │ read-only snapshots        │
└───────────────────────────────┘ └────────────────────────────┘
```

### 4.1 服务端职责

- 解析项目模版允许的业务链路、项目快照和当前实例。
- 校验工作流节点外部引用。
- 调用只读 MCP 适配器。
- 处理来源新鲜度、字段冲突和缺失。
- 生成节点 Read Model、变更事件和 Alert 投影。
- 按读取者权限裁剪项目数据。

### 4.2 客户端职责

- 渲染服务端 Read Model。
- 处理选中节点、Alert 高亮、缩放和全屏。
- 发起关注、确认和详情跳转。
- 不自行解释外部系统字段，不从标题猜测来源。

## 5. 领域模型

### 5.1 项目业务链路快照

在 `ProjectRecord` 上增加可选快照，保持向后兼容：

```ts
interface ProjectRecordExtension {
  businessChainBinding?: {
    projectTemplateId: string;
    businessChainTemplateId: string;
    workflowDefinitionId: string;
    workflowDefinitionVersion: number;
    workflowInstanceId?: string;
    bindingMode:
      | "template-default"
      | "template-allowed"
      | "project-custom"
      | "legacy";
    sourceTemplateRevision: number;
    boundAt: string;
    boundBy: string;
  };
}
```

约束：

- 业务链路必须来自项目来源模版允许范围。
- 一个项目最多一个当前业务链路定义和实例。
- 项目可保留历史实例，但只有一个 `current` 业务链路实例。
- `legacy` 仅用于迁移期，不允许用于新建项目。

### 5.2 项目模版业务链路策略

```ts
interface ProjectTemplateBusinessChainPolicy {
  businessChainMode: "required" | "optional" | "none";
  allowedBusinessChainTemplateIds: string[];
  defaultBusinessChainTemplateId?: string;
  versionPolicy: "pin-at-project-create" | "latest-active";
}
```

项目类型是策略的外部约束。第一阶段可先使用项目模版现有 `type` 字符串分类，后续再引入独立 `ProjectTypeProfile`。

### 5.3 工作流定义扩展

```ts
interface WorkflowDefinitionBusinessChainExtension {
  businessChain?: {
    enabled: boolean;
    chainKey: string;
    displayName: string;
    projectTypeCodes: string[];
    stageCodePolicy: "stable";
    snapshotPolicy: "pin-at-project-create" | "latest-active";
    allowUnboundExternalNodes: boolean;
  };
}
```

校验规则：

- `chainKey` 在同一工作区内唯一。
- 启用业务链路的定义至少有两个节点。
- 节点 `stageCode` 必须在定义内唯一。
- `businessChain.enabled=true` 时，节点必须声明或明确豁免 `externalRefs`。

### 5.4 工作流节点扩展

```ts
interface WorkflowNodeBusinessChainExtension {
  businessChain?: {
    sequence: number;
    stageCode: string;
    summaryMetric: string;
    externalRefs: Array<{
      system: string;
      objectType: string;
      objectId: string;
      required: boolean;
    }>;
  };
}
```

`externalRefs` 是业务绑定，不是展示文本。禁止使用节点名称作为外部引用。

### 5.5 来源快照

新增表或子域 `source_snapshots`，保留最近一次可验证快照：

```ts
interface SourceSnapshotRecord {
  workspaceId: string;
  scenarioId: string;
  sourceSystem: string;
  documentId: string;
  revision: string;
  observedAt: string;
  effectiveAt?: string;
  status: "fresh" | "stale" | "error";
  payloadHash: string;
  normalized: Record<string, unknown>;
}
```

不要求长期保存所有原始报文；但必须保留生成页面所需的最新规范化事实和审计摘要。

### 5.6 Alert 投影

新增 `alerts` 表，键为 `workspaceId::alertId`：

```ts
interface ProjectAlertRecord {
  alertId: string;
  workspaceId: string;
  conditionKey: string;
  sourceSystem: string;
  sourceObjectId: string;
  sourceRevision: string;
  nodeId?: string;
  alertType: string;
  severity: "P0" | "P1" | "P2";
  title: string;
  description: string;
  lifecycle:
    | "open"
    | "acknowledged"
    | "in_progress"
    | "resolved"
    | "suppressed"
    | "stale";
  assigneePrincipalId?: string;
  linkedTaskIds: string[];
  firstSeenAt: string;
  lastSeenAt: string;
  resolvedAt?: string;
  suppressedUntil?: string;
  followTargetId: string;
}
```

Alert 是项目域投影，不是外部系统的原始记录。

### 5.7 项目概览 Read Model

```ts
interface ProjectProgressOverview {
  schemaVersion: "project-progress-overview-v1";
  generatedAt: string;
  workspaceId: string;
  businessChain: {
    projectTemplateId: string;
    businessChainTemplateId: string;
    definitionId: string;
    definitionVersion: number;
    instanceId?: string;
    chainKey: string;
    bindingMode: "template-default" | "template-allowed" | "legacy";
  };
  coverage: {
    status: "complete" | "partial" | "stale" | "error";
    sources: Array<{
      system: string;
      status: "fresh" | "stale" | "error" | "missing";
      observedAt?: string;
      message?: string;
    }>;
  };
  keyProgress: {
    progress: string[];
    attention: string[];
    latestReportAt?: string;
  };
  nodes: ProgressNode[];
  changeEvents: ProgressChangeEvent[];
  alerts: ProjectAlertView[];
}
```

`ProgressNode` 的最小字段：

```ts
interface ProgressNode {
  nodeId: string;
  stageCode: string;
  name: string;
  sequence: number;
  workflowStatus: string;
  owner: { principalId?: string; name: string };
  /**
   * 平台只固定负责人和异常。其余业务字段由业务链路节点定义，
   * 不由项目概览按“计划 / 实际”等含义硬编码。
   */
  fields: Array<{
    key: string;
    label: string;
    value: string;
    sourceRefs: SourceRef[];
  }>;
  exceptionSummary: string[];
  alertIds: string[];
  taskIds: string[];
  sourceRefs: SourceRef[];
}
```

业务链路节点通过稳定外部对象 ID 和路径定义字段映射，例如供应链场景可以声明
「原计划」「变更后」「实际完成」三个字段；软件研发或其他场景可以声明
「目标版本」「测试覆盖率」「发布时间」等不同字段。页面不假设任何行业字段集合。

## 6. 数据来源与字段映射

下表以供应链交付场景为例；其他项目类型通过各自的场景 Adapter 注册业务来源。

| 页面字段 | 来源 | 读取方式 |
| --- | --- | --- |
| 业务链路节点和边 | 项目快照 + 工作流定义 | `businessChainBinding` + `businessChain` + graph |
| 当前节点状态 | 工作流实例 | `instance.nodes[nodeId].status` |
| 节点负责人 | 工作流 | responsible / assignment binding |
| 节点自定义业务字段 | 业务链路定义 + 对应场景 Adapter | 节点 `fields[].bindings` 指向稳定对象 ID 和来源路径 |
| 供应链场景的「原计划」 | Planning | 节点字段配置绑定 `baseline` |
| 供应链场景的「变更后」 | Planning | 节点字段配置绑定 `confirmed` |
| 供应链场景的「实际完成」 | MES / OMS / WMS | 节点字段配置绑定对应实绩字段 |
| 客户交期 | OMS | requestedDeliveryDate |
| 库存占用和在途 | WMS | project-kit snapshot |
| 实际总装/测试数量 | MES | actualCompletedQuantity |
| 发运数量 | OMS/WMS | shippedQuantity |
| 关键进展 | 项目日报，后续可迁移为 Read Model 摘要 | 现有 reports |
| 变更事件 | 当前场景来源 changes | 规范化事件 |
| Alert 生命周期 | 项目域 | Alert projection |

### 6.1 节点自定义字段绑定

系统只固定「负责人」和「异常」。以下三组字段是供应链场景在业务链路定义中的
示例配置，不是平台通用字段；其他场景按相同绑定契约声明自己的字段。

| 供应链字段 | 示例来源 |
| --- | --- |
| 原计划 | Planning 基线数量、日期 |
| 变更后 | Planning 最新已确认数量、日期 |
| 实际完成 | 按供应链节点配置到 MES、OMS 或 WMS 的实绩字段 |

## 7. 服务端聚合算法

```text
1. 读取项目记录、项目模版和 businessChainBinding 快照。
2. 校验业务链路属于项目模版允许范围，定义 kind=business-chain。
3. 读取当前业务链路实例和节点状态。
4. 收集所有节点 externalRefs，并按场景解析所需 Adapter。
5. 并行调用当前场景注册的 MCP Adapter。
6. 对每个来源执行 schema validation、freshness 和权限检查。
7. 按 externalRefs 合并节点事实。
8. 生成冲突项、缺失项和 stale 项。
9. 生成 Alert Candidate 并 upsert Alert Projection。
10. 解析最新项目日报，形成 keyProgress。
11. 生成 ProjectProgressOverview。
```

### 7.1 冲突优先级

| 类型 | 优先级 |
| --- | --- |
| 流程拓扑 | 项目实例快照 + 工作流定义 |
| 执行状态 | 工作流实例 |
| 业务数量/日期 | 对应领域来源最新 confirmed revision |
| 实际产出 | MES 实绩 |
| Alert 生命周期 | 项目域投影 |
| 关键进展文案 | 最新项目日报或 PM Agent 输出 |

### 7.2 冲突处理

- 订单数量与计划数量不同：分别展示，不自动覆盖，生成“计划未同步”候选 Alert。
- 工作流 completed，但 MES 实际产出不足：状态保留，生成“完成数量不一致”Alert。
- 同一来源多个 revision：使用最新 confirmed revision。
- 来源缺失权威字段：对应字段返回 `null`，页面显示“未记录”。
- 来源 stale：保留最后值并标记 stale；不能标记 resolved。

## 8. MCP Adapter 设计

MCP 由服务端调用，浏览器不持有外部系统凭据。

### 8.1 公共接口

```ts
interface ProgressSourceAdapter<T> {
  sourceSystem: string;
  read(input: {
    workspaceId: string;
    projectCode: string;
    refs: readonly ExternalRef[];
    signal?: AbortSignal;
  }): Promise<SourceResult<T>>;
}

interface SourceResult<T> {
  status: "fresh" | "stale" | "error";
  observedAt?: string;
  revision?: string;
  data?: T;
  error?: string;
}
```

### 8.2 Mock 环境

四个 Mock MCP 只读取对应 MD 文档中的 `json mock-mcp-snapshot`。

| Adapter | Mock 来源文档 |
| --- | --- |
| PlanningMcpAdapter | [01-planning-system-mcp.md](01-planning-system-mcp.md) |
| OrderMcpAdapter | [02-order-management-system-mcp.md](02-order-management-system-mcp.md) |
| InventoryMcpAdapter | [03-inventory-system-mcp.md](03-inventory-system-mcp.md) |
| CapacityMcpAdapter | [04-capacity-system-mcp.md](04-capacity-system-mcp.md) |

Mock 环境必须返回 `isMock=true`，生产 UI 应显示演示数据标识。

## 9. API 设计

### 9.1 读取项目概览

`GET /api/collab/projects/progress-overview?workspaceId=...`

权限：项目成员或平台管理员。

响应：

```json
{
  "ok": true,
  "overview": {
    "schemaVersion": "project-progress-overview-v1",
    "generatedAt": "2026-11-18T12:00:00+08:00",
    "businessChain": {
      "projectTemplateId": "tpl-ai-server-delivery",
      "businessChainTemplateId": "chain-ai-server-delivery",
      "definitionId": "wfdef-business-chain-ai-server-v3",
      "definitionVersion": 3,
      "instanceId": "wf-instance-so0101",
      "chainKey": "ai-server-delivery",
      "bindingMode": "template-default"
    },
    "coverage": {
      "status": "partial",
      "sources": [
        {
          "system": "WMS",
          "status": "stale",
          "observedAt": "2026-11-15T08:00:00+08:00"
        }
      ]
    },
    "nodes": [],
    "changeEvents": [],
    "alerts": [],
    "keyProgress": {
      "progress": [],
      "attention": []
    }
  }
}
```

### 9.2 读取项目设置中的业务链路配置

`GET /api/collab/projects/business-chain?workspaceId=...`

权限：项目负责人或平台管理员。

返回：

- 项目来源模版及其业务链路策略。
- 当前业务链路定义和版本。
- 当前业务链路实例及状态。
- 节点来源绑定。
- 当前业务链路需要的来源系统健康状态。
- 最近校验时间和 revision。

### 9.3 查询模版允许的业务链路候选

`GET /api/collab/projects/business-chain/candidates?workspaceId=...`

只返回当前项目来源模版允许、状态为 active 且 `kind=business-chain` 的工作流定义。普通执行工作流和其他模版未授权的业务链路不得进入候选列表。

### 9.4 校验节点绑定

`POST /api/collab/projects/business-chain/validate`

输入：

```json
{
  "workspaceId": "ws-so0101",
  "definitionId": "wfdef-business-chain-ai-server-v3",
  "nodeBindings": [
    {
      "nodeId": "supply-prep",
      "externalRefs": [
        {
          "system": "APS-PLANNING",
          "objectType": "plan-node",
          "objectId": "PLN-SO0101-M03",
          "required": true
        }
      ]
    }
  ]
}
```

输出：

- `blocking[]`：必须修复。
- `warnings[]`：可以应用但需确认。
- `passed[]`：通过项。
- `revision`：用于后续并发保护。

### 9.5 绑定项目业务链路

`POST /api/collab/projects/business-chain/bind`

权限：项目负责人或平台管理员。

```json
{
  "workspaceId": "ws-so0101",
  "definitionId": "wfdef-business-chain-ai-server-v3",
  "revision": 4,
  "validationDigest": "sha256:..."
}
```

服务端必须校验：

- 定义属于当前工作区或平台可见，且在项目模版允许范围内。
- 定义状态为 active。
- 定义 `kind=business-chain`。
- 不存在不兼容的节点绑定。
- 校验摘要与提交内容一致。
- 不会修改已有运行实例的定义快照。

### 9.6 启动或切换业务链路实例

复用工作流现有实例启动 API，不在项目模块另造流程启动逻辑。

项目侧只更新 `businessChainBinding.workflowInstanceId` 引用。

### 9.7 Alert 操作

```text
POST /api/collab/projects/alerts/acknowledge
POST /api/collab/projects/alerts/assign
POST /api/collab/projects/alerts/resolve
POST /api/collab/projects/alerts/suppress
```

关注继续复用 `/api/collab/workbench/follows/toggle`：

```json
{
  "type": "brief",
  "targetId": "project-alert:SO0101:gpu-inbound-delay"
}
```

## 10. Alert 投影规则

### 10.1 输入来源

| 输入 | 示例 |
| --- | --- |
| 工作流节点状态 | 阻塞、失败 |
| 工作流事件 | Agent 派发失败、审批否决、子流程阻塞 |
| Task 异常 | 执行失败、需改派、依赖阻塞 |
| Planning 冲突 | 计划未同步订单变化 |
| WMS 异常 | 库存回传超 SLA、齐套时间缺口 |
| MES 异常 | 测试台能力下降、物料等待 |

### 10.2 稳定条件键

```text
<sourceSystem>:<sourceObjectId>:<conditionType>
```

示例：

```text
APS-PLANNING:PLN-SO0101-M03:gpu-inbound-delay
WMS:WH-EAST-01:sync-sla
MES:BENCH-TEST-03:capacity-reduction
workflow:wf-instance-so0101:integration-test:blocked
```

### 10.3 状态转换

```text
条件命中 -> open
用户确认 -> acknowledged
用户指派 -> in_progress
条件解除 -> resolved
来源 stale -> stale
用户抑制 -> suppressed
条件重新命中 -> open，复用同一 alertId
```

禁止删除已解决 Alert 的审计记录。

## 11. 变更事件

外部变更统一规范化为：

```ts
interface ProjectChangeEvent {
  id: string;
  category: "order" | "supply" | "external" | "capacity" | "quality";
  at: string;
  description: string;
  sourceSystem: string;
  sourceRef: string;
  sourceRevision: string;
  linkedNodeIds: string[];
}
```

页面格式：

```text
yyyy-mm-dd hh:mm 【订单变更】事项描述（来自：来源）
```

分类规则：

- OMS 数量、客户取消、交期变化：订单变更。
- Planning 供应计划、WMS 供给异常：供给变更。
- 外部接口 SLA、同步失败：外部影响。
- MES 能力变化：可作为产能变更或外部影响，由规范化层决定，不在前端猜测。

事件按 `at` 正序展示。

## 12. 客户端设计

### 12.1 信息架构

业务链路配置和项目概览必须分离：

```text
项目管理
  └─ 项目详情
      ├─ 项目设置
      │   ├─ 基础信息
      │   ├─ 项目角色
      │   └─ 业务链路
      │       ├─ 当前业务链路
      │       ├─ 来源项目模版与允许范围
      │       ├─ 节点来源绑定
      │       ├─ 数据源健康
      │       └─ 业务链路实例
      └─ 项目概览
          ├─ 项目关键进展
          ├─ 业务链路节点图
          ├─ 关键变更与外部影响
          └─ Alert + 关联任务
```

业务链路页签放在「项目角色」之后，作为项目设置的第三个页签。可用业务链路由项目来源模版过滤，不是全平台工作流列表。

### 12.2 项目设置：业务链路

页签负责：

- 在项目模版允许范围内选择并绑定 `business-chain` 工作流定义。
- 绑定节点外部来源。
- 校验定义、来源、权限和新鲜度。
- 选择并启动业务链路工作流实例。
- 查看来源系统和实例状态。

页签不负责：

- 编辑工作流模版本体。
- 直接修改计划、订单、库存或产能数据。
- 在项目概览内直接新增节点。
- 自动把任意工作流变成业务链路。
- 展示项目模版未授权的业务链路。

关键交互：

1. 未绑定时显示空态；只有项目模版配置多个候选时才提供显式选择。
2. 选择后进入草稿预览，不立即覆盖当前绑定。
3. 节点外部引用支持校验和手工绑定。
4. 应用前展示影响预览。
5. 有未应用修改时，切页、关闭或切项目必须提示。
6. 更换定义不影响已有运行实例快照。

完整交互和状态定义见
[项目设置「业务链路」页签交互规格](08-project-settings-business-chain-tab.md)。

### 12.3 项目概览页面结构

```text
项目概览
  ├─ 项目关键进展
  ├─ 业务链路节点图
  ├─ 关键变更与外部影响
  └─ 选中节点的 Alert + 关联任务
```

项目概览页面只读消费服务端 Read Model，不出现“编辑业务链路”“绑定来源”“启动实例”等配置操作。

### 12.4 交互边界

- 默认选中：第一个异常节点；无异常时选第一个节点。
- 节点选中：请求或定位服务端返回的节点详情。
- Alert 点击：高亮关联任务，不重新计算业务关系。
- 缩放、复位、全屏：纯客户端状态。
- 切换项目：清除旧 Read Model 和 UI 临时状态。
- 来源 stale 或 missing：页面显示覆盖状态，不隐藏整个页面。

### 12.5 现有客户端迁移

当前 `client/index.js` 中的 `buildProgressOverview`、`buildProgressAlerts` 和 `projectReportProgress` 可保留为迁移期 fallback。

目标状态：

- 服务端返回完整 Read Model。
- 客户端删除业务字段推断。
- 客户端只保留渲染和纯交互状态。
- 项目设置新增「业务链路」页签，项目概览不再承担绑定和配置。

## 13. 权限与安全

| 操作 | 权限 |
| --- | --- |
| 查看项目概览 | 项目成员 / 平台管理员 |
| 查看项目设置中的业务链路 | 项目负责人 / 平台管理员 |
| 绑定项目业务链路 | 项目负责人 / 平台管理员，且必须在项目模版允许范围内 |
| 校验节点来源绑定 | 项目负责人 / 平台管理员 |
| 启动业务链路实例 | 复用工作流启动权限 |
| Alert 确认/指派/解决 | 项目成员或指定负责人，按产品规则 |
| 修改流程定义 | 工作流现有权限 |
| 读取外部 MCP | 仅服务端，按项目范围最小授权 |

MCP 安全要求：

- 只读凭据。
- 不向浏览器暴露 MCP Token。
- 每次查询必须带 `workspaceId` 和 `projectCode`。
- 禁止跨项目批量返回客户订单或库存。
- 日志只记录对象 ID、revision 和摘要，不记录完整敏感报文。

## 14. 兼容与迁移

### 14.1 数据迁移

第一阶段使用新增可选字段，不破坏现有项目记录：

1. 为现有项目模版增加可选业务链路策略。
2. 为工作流定义增加可选 `businessChain` 扩展。
3. 为项目记录增加可选 `businessChainBinding` 快照。
4. 找出每个项目模版的候选业务链路，由负责人确认。
5. 未确认项目使用 `legacy` 模式，不自动写入模版绑定。

### 14.2 客户端兼容

- 服务端 Read Model 可用时优先使用。
- 服务端未返回时继续使用现有客户端 Adapter。
- 旧版本工作流定义没有 `externalRefs` 时，节点正常显示，计划字段为空。

### 14.3 Alert 兼容

现有 Alert 关注目标必须逐步迁移到稳定 `conditionKey`：

1. 生成旧派生 Alert ID 到新 `conditionKey` 的映射。
2. 新 Alert 使用项目域稳定 ID。
3. 迁移关注关系时保留原更新时间。
4. 无法映射的旧关注进入只读历史，不伪造新关系。

## 15. 测试设计

### 15.1 单元测试

- 项目类型和项目模版的业务链路允许范围校验。
- 业务链路定义校验。
- 节点 `stageCode` 唯一性。
- `externalRefs` 解析。
- 四种来源字段映射。
- 节点基线、确认计划、实际值映射。
- 来源 stale、missing、error。
- 冲突优先级。
- Alert conditionKey 稳定性和幂等 upsert。
- 变更事件分类与正序排序。

### 15.2 路由测试

- 项目成员可读，非成员 403。
- 普通成员不能绑定业务链路。
- 项目负责人可绑定项目模版允许的合法业务链路。
- 非法定义、停用定义、非业务链路定义和模版未授权定义被拒绝。
- dead letter / MCP timeout 返回 partial，而不是 500。
- Alert 操作权限和生命周期转换。

### 15.3 契约测试

- 每个 Mock MCP 只读取自己的 MD 文档。
- 四个 `json mock-mcp-snapshot` 可解析。
- 返回字段符合 source schema。
- 不含 Demo 常量硬编码。

### 15.4 客户端测试

- 默认项目概览。
- 节点选中与 Alert/任务联动。
- 来源 stale 和缺失空态。
- 缩放、复位、全屏、Esc。
- 桌面/移动端无重叠和裁切。
- 控制台无错误。

### 15.5 GUI 验收

- 项目概览、项目日报、成员、任务、工作流、产出物和历史记录均正常。
- 默认进入项目概览。
- 折叠项目列表。
- 切换项目和带异常节点时数据正确。
- 点击 Alert 后关联任务高亮。
- stale 来源提示可见。
- 全屏模式节点和事件列表可查看。

## 16. 可观测性

建议指标：

| 指标 | 说明 |
| --- | --- |
| `progress_overview_build_ms` | Read Model 生成耗时 |
| `progress_source_latency_ms` | 各 MCP 调用耗时 |
| `progress_source_error_total` | 来源失败数 |
| `progress_source_stale_total` | 来源过期数 |
| `progress_alert_open_total` | 未关闭 Alert |
| `progress_alert_upsert_total` | Alert 新建/更新数 |
| `progress_conflict_total` | 来源冲突数 |

日志必须包含：

- `workspaceId`
- `projectCode`
- `definitionId`
- `instanceId`
- `sourceSystem`
- `sourceRevision`
- `durationMs`
- `resultStatus`

## 17. 风险与缓解

| 风险 | 影响 | 缓解 |
| --- | --- | --- |
| 工作流定义被错误地当成计划主数据 | 两套数字冲突 | 严格字段权威矩阵 |
| 项目自动选中错误工作流 | 页面展示错误业务链路 | 项目模版白名单 + `business-chain` 绑定 |
| MCP 数据过期 | 用户误判实时状态 | stale 标记和覆盖状态 |
| Alert 标题变化导致关注丢失 | 用户重复处理 | stable conditionKey |
| 外部系统字段缺失 | 页面出现虚假 0 | 空值显示“未记录” |
| 多来源 revision 不一致 | 图表和事件矛盾 | sourceRefs + revision + 冲突告警 |
| 工作流节点改名 | 外部绑定断裂 | stable stageCode + objectId |
| 生产 MCP 不可用 | 页面空白 | partial read model + 最后快照 |

## 18. 实施阶段

### Phase 1：契约和 Read Model

- 增加项目模版业务链路策略、`businessChain` 和 `externalRefs` 契约。
- 接入四个 Mock MCP。
- 服务端生成 ProjectProgressOverview。
- 保留当前客户端 fallback。

### Phase 2：项目绑定

- 增加项目业务链路绑定 API。
- 在「项目设置 → 业务链路」增加候选选择、节点来源绑定、校验和应用入口。
- 增加当前业务链路实例、来源健康和未保存守卫。
- 将现有项目业务链预案从 `legacy` 迁移到项目模版快照。

### Phase 3：Alert 投影

- 新增条件键和 Alert 表。
- 打通关注、确认、指派、解决和 stale。
- 统一项目概览与工作台口径。

### Phase 4：生产来源接入

- 替换 Mock MCP。
- 增加真实凭据、超时、重试、熔断和来源 SLA。
- 按项目范围做数据权限校验。

## 19. 验收标准

1. 项目类型和项目模版可以配置默认及候选业务链路。
2. 项目实例只能绑定项目模版允许的 `business-chain` 工作流定义。
3. 业务链路节点拓扑来自项目快照和工作流，业务数字来自对应场景 MCP。
4. 节点原计划、变更后计划、实际完成和异常均有来源引用。
5. 缺失字段显示空态，不伪造计划、数量、日期或异常。
6. 变更事件按时间正序，类型和来源匹配源系统。
7. Alert 有稳定 ID、生命周期和关联任务。
8. 项目概览默认 landing，原有页签和功能不回归。
9. Mock 环境只读取四份对应 MD 快照。
10. 来源 stale 或 partial 时页面明确提示。
11. 全量单测、路由测试、契约测试和 GUI 测试通过。
12. 项目设置存在第三个页签「业务链路」，且项目概览保持只读。
13. 未应用绑定草稿在切页、关闭和切项目时不会静默丢失。
14. 更换业务链路不会修改已有运行实例和任务。

