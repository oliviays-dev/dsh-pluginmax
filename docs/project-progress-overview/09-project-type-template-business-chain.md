# 项目类型、项目模版与业务链路模板模型

> 文档状态：领域与交互设计稿  
> 目标：让平台承载多类项目场景，而不是把供应链交付链路写死为全局主干。  
> 核心原则：项目类型约束场景，项目模版提供业务链路，项目实例继承并快照。

## 1. 领域模型

业务链路是平台级可复用资产，不是某个项目的私有流程图，也不是全局唯一主干。

```text
项目类型
  └─ 项目模版
      └─ 业务链路模板引用
          └─ 工作流定义 / 业务链路定义
              └─ 项目实例快照与运行实例
```

| 层 | 职责 |
| --- | --- |
| 项目类型 | 定义项目场景、可用业务链路范围、治理规则 |
| 项目模版 | 选择默认业务链路、候选业务链路、项目角色和工作流模版 |
| 业务链路模板 | 可复用的节点拓扑、阶段编码、外部来源绑定规则 |
| 工作流定义 | 业务链路的执行定义和版本载体 |
| 项目实例 | 继承模版，选择允许的链路，并保存创建时快照 |

## 2. 多场景示例

| 项目类型 | 项目模版 | 业务链路示例 | 业务事实来源示例 |
| --- | --- | --- | --- |
| 供应链交付 | AI Server 交付 | 订单接入 → 供需评审 → 供应备货 → 生产总装 → 联调 → 发运 → 验收 | 计划、OMS、WMS、MES |
| 软件研发 | 企业应用版本发布 | 需求 → 方案 → 开发 → 测试 → 发布 → 观察 → 复盘 | Jira、Git、CI/CD、发布平台 |
| 客户实施 | 重点客户上线 | 合同 → Kickoff → 配置 → 数据迁移 → UAT → 切流 → 稳定观察 | CRM、工单、实施平台、监控 |
| 市场营销 | 新品发布战役 | 策略 → 创意 → 内容生产 → 渠道投放 → 监测 → 复盘 | CRM、内容平台、广告平台、分析平台 |
| 采购寻源 | 关键物料降本 | 需求澄清 → 供应商筛选 → RFQ → 比价 → 商务谈判 → 定标 → 合同 | SRM、合同、供应商风险、价格库 |
| 研发项目 | 新品 NPI | 立项 → 设计 → 样机 → 验证 → 小批试产 → 量产导入 | PLM、项目管理、MES、质量系统 |

页面和领域模型不能假设每个项目都有订单、GPU、库存、生产线、测试台或发货节点。这些字段只属于供应链交付场景的 MCP 数据包。

## 3. 领域对象

### 3.1 ProjectTypeProfile

```ts
interface ProjectTypeProfile {
  id: string;
  name: string;
  code: string;
  description: string;
  allowedBusinessChainTemplateIds: string[];
  defaultBusinessChainTemplateId?: string;
  status: "active" | "disabled";
}
```

约束：

- 一个项目类型可以允许多个业务链路模板。
- 项目类型只定义范围，不直接绑定到项目实例。
- 新增业务链路模板时，不影响已经创建的项目。

### 3.2 ProjectTemplate

在现有项目模版上增加业务链路策略：

```ts
interface ProjectTemplateBusinessChainPolicy {
  businessChainMode: "required" | "optional" | "none";
  allowedBusinessChainTemplateIds: string[];
  defaultBusinessChainTemplateId?: string;
  versionPolicy: "pin-at-project-create" | "latest-active";
}
```

- `required`：项目创建时必须绑定业务链路。
- `optional`：项目可以不绑定，后续在项目设置中补充。
- `none`：该模版项目不使用业务链路。
- 默认使用 `pin-at-project-create`，避免模版修改后静默改变现有项目。

### 3.3 业务链路模板

业务链路模板可以先由工作流定义承载，但必须有稳定业务标识：

```ts
interface BusinessChainTemplate {
  id: string;
  key: string;
  name: string;
  projectTypeIds: string[];
  workflowDefinitionRef: {
    definitionId: string;
    definitionKey: string;
    versionPolicy: "pinned" | "latest-active";
  };
  status: "draft" | "active" | "disabled";
  stageCatalog: Array<{
    stageCode: string;
    name: string;
    requiredSourceTypes: string[];
  }>;
  /** 节点业务字段目录；平台不内置计划、订单、库存等行业字段。 */
  nodeFieldCatalog: Array<{
    nodeId: string;
    key: string;
    label: string;
    bindings: Array<{
      system: string;
      objectId: string;
      path: string;
    }>;
  }>;
}
```

业务链路模板负责场景语义、阶段目录、默认节点顺序和外部来源类型要求；执行拓扑仍由工作流 graph 提供。
项目概览固定展示负责人和异常，其他字段只能来自上述节点字段目录。

### 3.4 项目实例快照

项目创建时保存快照，不只保存“实时查询模板”的引用：

```ts
interface ProjectBusinessChainBinding {
  projectTemplateId: string;
  businessChainTemplateId: string;
  workflowDefinitionId: string;
  workflowDefinitionVersion: number;
  bindingMode: "template-default" | "template-allowed";
  boundAt: string;
  boundBy: string;
  sourceTemplateRevision: number;
}
```

## 4. 项目模版维护交互

在现有「项目模版维护」中增加业务链路配置。

模版编辑页签建议：

```text
基本信息 / 预定义项目角色 / 预定义工作流模版 / 业务链路
```

业务链路页签字段：

| 字段 | 说明 |
| --- | --- |
| 链路模式 | 必须绑定 / 可选 / 不使用 |
| 默认业务链路 | 项目创建时默认使用 |
| 可选业务链路 | 允许项目实例选择的链路 |
| 版本策略 | 创建时固定 / 始终最新启用 |
| 链路预览 | 节点和阶段预览 |
| 上传配置 | 支持上传 `.md` 工作流定义或 `.json` 业务链路配置；成功后导入定义并加入当前模版候选 |

交互规则：

- 从“业务链路模板库”中引用，不在项目模版里复制流程图本体。
- 上传配置文件与手工选择使用同一校验；导入成功后仍只保存模板引用和模版策略。
- 已停用模板不能新增引用。
- 移除被项目使用的默认链路时，必须提示影响范围。
- 修改模版不自动覆盖已创建项目。

## 5. 项目创建交互

选择项目模版后，按模版策略展示：

### 单一默认链路

```text
业务链路：AI Server 交付链路
来源：项目模版「AI Server 交付模版」
```

用户无需选择，创建时自动快照。

### 多候选链路

```text
业务链路：[标准交付链路 ▼]
```

下拉只显示模版允许的候选。

### 可选或不使用

```text
业务链路：[暂不绑定 ▼]
```

`none` 模式下不展示业务链路选择。

## 6. 项目设置中的业务链路页签

项目设置页签不从“全部工作流”中任意选择，而是：

1. 读取项目来源模版的 `businessChainPolicy`。
2. 只显示该模版允许的业务链路。
3. 如果模版只允许一个，显示继承状态，不提供任意更换。
4. 超出允许范围必须回到项目模版配置。

状态文案：

```text
由项目模版提供
```

```text
项目模版允许 2 条业务链路，当前使用「标准交付链路」。
```

```text
当前项目模版未配置默认业务链路。请先在「项目模版 → 业务链路」中完成配置。
```

## 7. 模版更新与项目隔离

默认策略：项目创建时固定业务链路定义版本。

后续项目模版更新时：

- 不自动修改现有项目。
- 项目设置显示“模版有可用更新”。
- 用户显式应用后写入新快照。
- 运行中的工作流实例继续使用启动时定义快照。
- 审计记录区分“模版更新”和“项目应用更新”。

## 8. 与工作流模块的边界

| 能力 | 归属 |
| --- | --- |
| 业务链路 graph 本体 | 工作流定义 |
| 业务链路模板目录 | 工作流 / 业务链路模板库 |
| 项目类型允许范围 | 项目类型配置 |
| 项目模版默认/候选 | 项目模版 |
| 项目实例快照 | 项目记录 |
| 业务链路实例执行 | 工作流实例 |
| 外部事实合并 | 项目概览 Read Model |

项目模版只保存引用，不复制工作流 graph 和外部事实。

## 9. API 建议

```text
GET  /api/collab/project-types
POST /api/collab/project-types/save

GET  /api/collab/business-chains?projectTypeId=...
GET  /api/collab/business-chains/detail?id=...

GET  /api/collab/projects/templates/business-chain-policy?templateId=...
POST /api/collab/projects/templates/business-chain-policy

GET  /api/collab/projects/business-chain/candidates?workspaceId=...
```

项目实例候选必须由项目来源模版过滤，不能返回全平台全部业务链路。

## 10. 兼容迁移

第一阶段如果项目类型还不是一等公民：

1. 继续使用项目模版现有 `type` 字段进行分类。
2. 在项目模版上增加可选业务链路策略。
3. 没有策略的模版按 `none` 处理，不自动绑定。
4. 供应链交付模版显式配置对应业务链路。
5. 后续再将 `type` 字符串收敛为项目类型实体。

## 11. 验收标准

1. 平台不再存在全局唯一“项目主干”。
2. 业务链路模板可按项目类型归档和检索。
3. 项目模版可以配置默认业务链路和允许候选。
4. 项目创建时按模版策略生成实例快照。
5. 项目设置只显示模版允许的业务链路。
6. 模版更新不会静默改变现有项目。
7. 供应链、软件研发、客户实施等场景可共用同一套模型。
8. 项目概览只依赖项目快照和业务事实，不依赖模版实时状态。

