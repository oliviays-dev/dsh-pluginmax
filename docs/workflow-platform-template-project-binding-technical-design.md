# 平台工作流模板与项目实例执行人映射技术设计

> 版本：v0.1  
> 日期：2026-11-07  
> 状态：方案讨论稿  
> 关联模块：Workflow、Project Roles、Task、Agent Runtime、Router / Worker  
> 关联文档：`workflow-technical-design.md`、`project-role-draft-confirm-design.md`

## 0. 结论

平台工作流模板与项目实例采用两层模型：

1. **模板层定义能力和责任槽位**，描述“需要什么角色、需要谁参与、是否需要审批”。
2. **实例层完成项目成员绑定**，在创建实例时把角色、固定人员或 AI 伙伴解析为本项目中的具体执行人。

平台模板以角色槽位为主。固定人员或 AI 伙伴只能作为建议执行人，不能假定来源项目人员一定属于目标项目。

实例创建支持两种任务承接模式：

- `assigned`：系统派单，节点直接派给确定的人或 AI。
- `claim`：候选池捞单/抢单，节点进入候选池，由第一个成功领取的候选人承接。

所有必填映射解析完成前，实例不能启动。第一版不引入实例草稿状态，未解析时直接阻止创建和启动。

## 1. 背景

当前 Workflow 模型已经支持：

- 节点执行人类型：`system`、`user`、`agent`、`employee`、`role`。
- 节点审批人类型：`user`、`agent`、`employee`、`role`。
- 项目角色执行和角色审批。
- 实例启动时保存角色成员快照 `roleSnapshot`。
- 角色任务由角色成员认领。

当前缺少：

- 平台模板与项目模板的正式作用域区分。
- 模板责任槽位到目标项目成员的可配置映射。
- 固定人员不属于目标项目时的重新绑定流程。
- `assigned` 和 `claim` 两种派发模式的显式模型。
- 实例级执行人绑定、审计和后续自动派发依据。

## 2. 当前实现评估

### 2.1 Definition 已有 workspaceId

`WorkflowDefinition` 保存 `workspaceId`，见 `plugins/dsh-collab-workflow/src/types.ts`。

这表示模板有一个来源项目，但目前没有：

```text
scope: project | platform
```

因此无法明确表达“项目私有模板”和“平台共享模板”。

### 2.2 当前列表实际是平台全量

服务层同时存在：

- `definitions(workspaceId)`：只返回指定项目模板。
- `sharedDefinitions()`：返回所有项目模板。

`/api/collab/workflow/definitions` 当前使用 `sharedDefinitions()`，因此所有项目可见全部模板。

结论：

> 当前是“带来源 workspaceId 的平台全局模板目录”，不是正式的平台级 / 项目级双作用域模型。

### 2.3 当前实例创建缺少映射层

当前实例启动直接校验模板中的固定人员和 AI 伙伴是否属于目标项目。

如果模板节点绑定 `demo-admin`，而目标项目没有该成员，实例直接失败。当前没有：

- 重新映射该节点的交互。
- 将固定人员降级为建议执行人的能力。
- 创建实例前的统一映射预检结果。
- 实例级执行人绑定记录。

### 2.4 当前角色能力可复用

当前角色节点具备：

- `executor.kind = "role"` 的项目角色执行能力。
- 角色成员任务和成员认领能力。
- 实例级 `roleSnapshot`。

这些能力可以作为 `claim` 候选池模式的基础，但仍需增加显式候选池、领取审计和原子抢单语义。

## 3. 目标与非目标

### 3.1 目标

- 正式支持平台级模板和项目级模板。
- 平台模板默认可跨项目复用。
- 平台模板优先绑定角色和能力要求。
- 实例创建时允许创建者映射角色到项目成员。
- 允许角色映射到人和 AI 伙伴。
- 固定人员缺失时可提示、重新映射或添加项目成员。
- 支持系统派单和候选池认领两种模式。
- 实例保存不可变的执行人绑定快照。
- 为未来系统自动派发提供确定的数据基础。

### 3.2 非目标

- 第一版不实现实例创建草稿。
- 第一版不实现 AI 自主抢单。
- 第一版不允许普通成员自行扩权添加项目成员。
- 第一版不修改任务、审批和工作流的核心权限语义。
- 第一版不实现 AI 自动选择执行人。

## 4. 术语

| 术语 | 定义 |
| --- | --- |
| 模板绑定 | 模板节点希望绑定角色、具体人、具体 AI 或系统 |
| 角色槽位 | 模板中只声明角色要求，不绑定具体项目成员的节点配置 |
| 实例绑定 | 创建实例时为每个节点解析出的具体人、AI 或候选池 |
| 主执行人 | `assigned` 模式下唯一确定的执行人 |
| 候选池 | `claim` 模式下允许领取任务的成员集合 |
| 未解析节点 | 必填执行人或候选池尚未确定的节点 |
| 项目级映射预设 | 可复用的“项目角色到项目成员”默认映射 |

## 5. 已确认产品规则

1. 角色支持两种派发模式：
   - `assigned`：系统派单给确定的人或 AI。
   - `claim`：候选池捞单/抢单。
2. 允许有权限的用户把缺失人员加入当前项目。
3. 平台模板默认角色化，固定人员仅作为建议绑定。
4. 项目级私有模板允许固定绑定到具体人或 AI。
5. 第一版未解析节点直接阻止启动，不保存执行草稿。
6. 项目级角色映射预设放入第二阶段。

## 6. 模板作用域

### 6.1 新增 scope

`WorkflowDefinition` 新增：

```ts
scope: "project" | "selected" | "platform"
workspaceIds: string[] // 仅 selected 使用
```

保留：

```ts
workspaceId
```

语义调整为：

- 项目模板：`workspaceId` 是可见范围，只有该项目可读取和启动。
- 指定项目模板：所属项目和 `workspaceIds` 中的项目可读取和启动；所属项目自动包含。
- 平台模板：`workspaceId` 仅表示发布来源，不限制使用项目。

建议新增：

```ts
ownerWorkspaceId?: string
publishedBy?: string
publishedAt?: string
```

`workspaceId` 与 `ownerWorkspaceId` 第一阶段可以保持一致，后续再拆分来源和所有权。

### 6.2 可见性

| 操作 | 项目模板 | 指定项目模板 | 平台模板 |
| --- | --- | --- | --- |
| 当前项目读取 | 是 | 是 | 是 |
| 指定项目读取 | 否 | 是 | 是 |
| 未指定项目读取 | 否 | 否 | 是 |
| 当前项目编辑 | 项目负责人/管理员 | 平台管理员 | 发布负责人/平台管理员 |
| 指定项目编辑 | 否 | 平台管理员 | 否 |
| 指定项目直接启动 | 否 | 是，但必须先完成实例映射 | 是，但必须先完成实例映射 |

### 6.3 模板版本

平台模板版本链按 `key + version` 管理，不按 workspaceId 分叉。

发布新 active 版本时：

- 同 key 的旧 active 版本归档。
- 已启动实例继续使用 `definitionVersion`，不受影响。
- 未启动映射不引用“最新模板”，必须引用固定 definitionId 和 version。

## 7. 模板节点绑定模型

### 7.1 绑定类型

模板节点支持：

```ts
type TemplateBinding =
  | {
      kind: "role";
      roleId: string;
      roleLabel?: string;
    }
  | {
      kind: "user" | "agent" | "employee";
      id: string;
      label?: string;
      portability: "required" | "suggested";
    }
  | {
      kind: "system";
    };
```

规则：

- 平台模板中 `role` 是推荐默认。
- `portability = "suggested"` 的固定人员或 AI 只做预填，不阻止重新映射。
- `portability = "required"` 只建议用于项目模板。
- `system` 不参与成员映射。

### 7.2 派发模式

节点增加：

```ts
dispatchMode: "assigned" | "claim";
```

默认值：

- 角色节点：由模板指定，未指定时 `claim`。
- 具体人节点：`assigned`。
- 具体 AI 节点：`assigned`。
- 审批节点：不参与普通派单；审批人单独映射。

### 7.3 执行人和审批人分离

执行人绑定与审批人绑定必须独立。

例如：

```text
执行：产品经理角色 -> 周宁
审批：产品负责人角色 -> 林岚
```

不能因为两者都来自“产品”相关角色而自动复用同一成员。

## 8. 实例绑定模型

### 8.1 assignmentBindings

`WorkflowInstance` 新增节点级绑定：

```ts
assignmentBindings: Record<string, AssignmentBinding>
```

示例：

```ts
interface AssignmentBinding {
  nodeId: string;
  source: {
    kind: "role" | "user" | "agent" | "employee" | "system";
    id?: string;
    label?: string;
  };
  dispatchMode: "assigned" | "claim";
  status: "resolved" | "unresolved" | "overridden";
  primaryAssignee?: {
    kind: "user" | "agent";
    id: string;
    name?: string;
  };
  candidatePool?: Array<{
    kind: "user" | "agent";
    id: string;
    name?: string;
  }>;
  resolvedBy: string;
  resolvedAt: string;
  sourceChanged?: {
    reason: string;
    originalId?: string;
    originalLabel?: string;
  };
}
```

### 8.2 约束

`assigned`：

- 必须有且仅有一个 `primaryAssignee`。
- `candidatePool` 可选，仅用于备用和通知，不参与抢单。

`claim`：

- 至少有一个 `candidatePool` 成员。
- `primaryAssignee` 可选，仅作为兜底联系人。
- 人工候选池可以用于捞单。
- AI 伙伴默认不进入抢单池，除非未来显式实现 Agent Claim Policy。

`system`：

- 不需要 assignment binding。

审批节点：

- 单独保存 `approvalBindings` 或复用 `assignmentBindings`，但审批人不能自动代签。

### 8.3 快照原则

实例启动后：

- 模板修改不影响实例。
- 项目角色成员后续变化不影响实例默认绑定。
- 候选人离职、AI 停用或权限失效时，节点暂停，不自动猜人。
- 需要改派时走显式 re-assign 或 receiver override。

## 9. 实例创建流程

### 9.1 总流程

```text
选择模板
  -> 服务端预检
  -> 创建者配置角色/人员/AI 映射
  -> 选择 assigned 或 claim
  -> 解析风险
  -> 全部必填项完成后启动实例
```

### 9.2 预检

新增预检接口：

```http
POST /api/collab/workflow/instances/preflight
```

输入：

```json
{
  "workspaceId": "project-id",
  "definitionId": "definition-id",
  "definitionVersion": 2
}
```

输出：

```json
{
  "nodes": [
    {
      "nodeId": "product-design",
      "nodeName": "产品方案设计",
      "source": {
        "kind": "role",
        "id": "product-manager",
        "label": "产品经理"
      },
      "dispatchMode": "claim",
      "status": "resolved",
      "candidatePool": [
        {
          "kind": "user",
          "id": "user-1",
          "name": "周宁"
        }
      ]
    }
  ],
  "risks": [],
  "canStart": true
}
```

风险示例：

```json
{
  "level": "blocking",
  "code": "assignee_not_project_member",
  "nodeId": "development",
  "message": "节点执行人 demo-admin 不是当前项目成员",
  "actions": ["remap", "add_project_member"]
}
```

### 9.3 映射界面

创建实例页面按节点展示：

| 节点 | 模板要求 | 映射 | 派发模式 | 状态 |
| --- | --- | --- | --- | --- |
| 产品方案设计 | 产品经理角色 | 周宁 | claim | 已解析 |
| 产品 PRD 评审 | 产品负责人审批 | 林岚 | assigned | 已解析 |
| 开发 | 研发负责人角色 | 李工 / AI 开发伙伴 | assigned | 已解析 |
| 发布确认 | demo-admin | 未解析 | assigned | 阻塞 |

固定人员缺失时提供：

- 改派到当前项目成员或 AI。
- 修改为角色槽位。
- 添加缺失人员到项目，仅项目负责人或管理员可执行。
- 取消创建。

### 9.4 未解析节点

以下情况视为未解析：

- `assigned` 没有主执行人。
- `claim` 没有候选池。
- 固定人员不属于当前项目，且未改派或添加。
- AI 伙伴不存在、停用或缺少 Runtime / Agent Profile / 项目授权。
- 模板角色在目标项目不存在。

未解析时：

- 服务端拒绝启动实例。
- 不创建任务或 Agent Run。
- 前端禁用“创建实例”或“启动”按钮。
- 第一版不保存实例草稿，用户需要当场完成映射。

## 10. 两种派发模式

### 10.1 assigned 系统派单

流程：

```text
节点 ready
  -> 读取 instance.assignmentBindings
  -> 主执行人是人：创建任务并指派
  -> 主执行人是 AI：创建任务，校验 Runtime/Profile/权限后启动 Run
```

特点：

- 执行人确定。
- 适合负责人制、审批制和高风险节点。
- AI 默认只能使用 assigned。
- 不需要候选人抢单。

### 10.2 claim 候选池捞单

流程：

```text
节点 ready
  -> 创建候选池任务
  -> 向候选成员展示
  -> 第一个原子领取成功的成员成为实际执行人
  -> 其他成员失去领取资格
```

原子领取要求：

- 服务端 compare-and-set。
- 领取成功后节点状态从 `ready` 变为 `running` 或 `claimed`。
- 失败者收到“任务已被领取”提示。
- 写入领取事件和审计。

候选池可见性：

- 人：候选成员可在本人任务看板看到。
- AI：第一阶段不参与 claim。
- 角色：可以继续作为候选来源，但实例启动时必须解析为具体候选池快照。

### 10.3 默认策略

- 模板固定人 / AI：`assigned`。
- 模板角色：默认 `claim`。
- 创建者可以把角色节点切换为 `assigned`。
- 风险较高或必须明确责任人的节点，建议强制 `assigned`。

## 11. 权限与风险

### 11.1 添加项目成员

- 仅项目负责人、Workspace owner 或平台管理员可添加。
- 普通成员可以查看阻塞原因并请求负责人处理。
- 添加后重新执行 preflight。

### 11.2 AI 伙伴

AI 伙伴绑定必须校验：

- AI 伙伴或 Teammate 状态。
- 项目可指派范围。
- Runtime Profile。
- Agent Profile。
- 项目授权和工具权限。
- 必要的 principal ticket / workspace grant。

缺项属于 blocking risk，不可通过“带风险继续”绕过。

### 11.3 固定人员风险

固定人员不在项目中属于 blocking risk。

不建议允许静默继续，因为：

- 后续无法合法创建任务。
- 无法正确计算项目权限交集。
- 看板归属不清晰。
- 审计无法确认责任人。

## 12. 项目级角色映射预设

### 12.1 定义

项目可保存常用映射：

```text
产品经理角色 -> 周宁
研发负责人角色 -> 李工
AI 研发伙伴角色 -> 代码助手 A
测试负责人角色 -> 王敏
```

创建任意模板实例时，如果角色 ID 匹配，自动预填映射，创建者仍需确认。

### 12.2 作用范围

建议按以下键保存：

```text
workspaceId + roleId
```

预设不作为实例启动依据。每次启动都必须把预设解析成实例绑定快照。

### 12.3 阶段

该能力放入第二阶段，第一版只做每次实例手动映射。

## 13. API 设计

### 13.1 模板列表

```http
GET /api/collab/workflow/definitions?workspaceId=...&scope=...
```

默认返回：

- 当前项目模板。
- 全平台模板。

可选：

```text
scope=project
scope=selected
scope=platform
```

### 13.2 实例预检

```http
POST /api/collab/workflow/instances/preflight
```

不产生实例，不创建任务。

### 13.3 创建实例

```http
POST /api/collab/workflow/instances
```

新增：

```json
{
  "assignmentBindings": {
    "product-design": {
      "dispatchMode": "claim",
      "candidatePool": [
        {
          "kind": "user",
          "id": "user-1"
        }
      ]
    }
  }
}
```

服务端必须重新执行 preflight，不能只信任前端。

### 13.4 原子领取

建议新增：

```http
POST /api/collab/workflow/instances/:instanceId/nodes/:nodeId/claim
```

请求需要：

- 当前用户身份。
- 候选池成员校验。
- 原子状态检查。

## 14. 审计事件

新增事件类型：

```text
assignment.resolved
assignment.unresolved
assignment.remapped
assignment.member_added
node.claimed
node.claim_rejected
node.auto_dispatched
```

事件必须包含：

- instanceId
- nodeId
- templateBinding
- resolvedBinding
- dispatchMode
- actorId
- actorName
- at

## 15. 数据迁移

### 15.1 现有 Definition

建议迁移步骤：

1. 先增加 `scope`，默认值为 `platform`，保持当前全局可见行为。
2. 增加 `portability`，现有固定人员默认 `suggested`。
3. 项目私有模板由管理员显式切换为 `project`。
4. 对历史平台模板逐项检查 executor 和 approver。

迁移不应直接删除 `workspaceId`，避免破坏现有记录和来源追踪。

### 15.2 现有 Instance

已启动实例：

- 保持原定义和执行状态。
- 新增 `assignmentBindings` 可为空。
- 缺失绑定时按旧 executor 和 roleSnapshot 解析。

未启动实例：

- 启动前补齐 assignmentBindings。

## 16. 分阶段实施

### 16.1 第一阶段

- Definition 增加 project / selected / platform scope。
- 平台模板角色槽位化。
- 实例 preflight 和映射页面。
- `assigned` / `claim` 两种模式。
- 固定人员缺失的 blocking risk。
- 人员添加动作和 AI 能力校验。
- 实例绑定快照和审计。

### 16.2 第二阶段

- 项目级角色映射预设。
- 批量复用映射。
- 更丰富的 AI 候选人策略。
- 自动负载均衡和轮询策略。

### 16.3 第三阶段

- AI 自主承接策略。
- 基于能力、负载、成本和风险的自动派发。
- 规则引擎或 Router 选择具体候选人。

## 17. 验收标准

### 17.1 模板作用域

- 项目模板只在所属项目可见。
- 指定项目模板只在所属项目和 `workspaceIds` 中的项目可见。
- 平台模板在所有项目可见。
- 平台管理员可以发布平台模板。
- 普通项目成员不能修改平台模板。

### 17.2 角色映射

- 创建实例时可以映射角色到项目成员或 AI。
- 同一角色被多个节点复用时默认复用映射，允许单节点覆盖。
- 角色不存在时阻止启动。
- 角色存在但候选池为空时阻止启动。

### 17.3 固定人员缺失

- 固定人员不在项目时返回 blocking risk。
- 用户可以改派当前项目成员。
- 有权限的用户可以添加成员后重新预检。
- 无权限用户不能自行添加成员。

### 17.4 两种派发模式

- `assigned` 人节点创建任务并正确指派。
- `assigned` AI 节点完成运行时和权限预检后自动启动 Run。
- `claim` 节点展示给候选池。
- 两名候选同时领取时只有一个成功。
- 领取成功后其他候选人不能再领取。

### 17.5 未解析节点

- 任一必填节点未解析时实例不能启动。
- 不创建任务。
- 不启动 Agent Run。
- 服务端和前端都阻止启动。

### 17.6 审计

- 映射、改派、添加成员、领取和拒绝领取均有事件记录。
- 审计能还原模板绑定和实例绑定。

## 18. 待后续确认

1. 平台模板发布是否必须经过平台管理员审批。
2. 项目角色映射预设是否只由项目负责人维护。
3. 是否允许 AI 进入 claim 候选池，还是仅允许 assigned。
4. 候选人领取后是否允许无条件转交，还是必须退回候选池。
5. 平台模板复制到项目后是否保留与原版本链的升级关系。
6. Root Task 触发的工作流实例是否默认继承 Router Plan 的派发模式。

