# 工作流模板与实例执行人映射 GUI 端到端测试方案

> 版本：v1.0  
> 日期：2026-11-07  
> 状态：可执行  
> 覆盖范围：Workflow Definition、Project Roles、Instance Preflight、Assignment Binding、Task Claim、Agent Runtime、Audit  
> 关联设计：`workflow-platform-template-project-binding-technical-design.md`、`project-role-draft-confirm-design.md`、`workflow-technical-design.md`

## 1. 测试目标

从用户视角验证以下核心链路：

1. 项目模板只在所属项目可见，平台模板跨项目可见。
2. 平台管理员可以切换模板作用域。
3. 创建实例时完成角色槽位到项目成员或 AI 伙伴的映射。
4. 同一角色跨多个节点默认复用映射，并允许单节点覆盖。
5. 项目可以保存并复用角色映射预设。
6. `assigned` 节点可以正确派单给唯一执行人。
7. `claim` 节点进入明确候选池，只有一个候选人能领取成功。
8. 固定人员缺失、角色缺失、候选池为空、AI Runtime 不完整时阻止启动。
9. 有权限用户可以添加缺失成员或重新映射。
10. AI 只能进入 assigned，不能进入 claim 候选池。
11. 未解析节点不会产生实例、Task 或 Agent Run。
12. 映射、预设、改派、领取、拒绝领取和自动派发均可审计。
13. 已启动实例使用 binding snapshot，不受后续角色成员或模板版本变化影响。

## 2. 不在本方案范围

- AI 自主抢单。
- AI 进入 claim 候选池。
- 自动负载均衡、能力排序、成本路由。
- 实例创建草稿。
- AI 审批专用 runtime decision path。
- 多写入进程下的存储层 claim CAS。当前自动化只验证单宿主进程原子领取。
- 工作台、Resource Market、Demo 订单等无关业务。

## 3. 测试环境

### 3.1 隔离环境要求

必须使用隔离 `DSH_HOME`，不得直接修改共享演示环境。

建议：

```sh
cd /Users/oliviayang/Codex/一切皆插件/dsh-pluginmax

# 不复用正在使用的共享目录。
cp -R .tmp/dsh-home .tmp/workflow-e2e-home

DSH_HOME="$PWD/.tmp/workflow-e2e-home" \
  node vendor/deepseek-harness/apps/cli/lib/bin.js \
  --profile pluginmax \
  --no-open \
  --port 33141
```

约束：

- 不重装 Profile。
- 不删除共享 `.tmp/dsh-home`。
- 端口被占用时使用新端口。
- 每轮测试重新读取带 token 的服务 URL。
- 可选 Demo 订单插件未启用时产生的无关 404 不计入本方案失败。

### 3.2 建议浏览器

至少三个隔离浏览器上下文：

| 上下文 | 账号 | 用途 |
| --- | --- | --- |
| Browser A | `admin` | 平台管理员、平台模板发布、scope 切换 |
| Browser B | `flow-owner` | 项目负责人、预设维护、添加成员 |
| Browser C | `flow-member-a` | 候选池成员、Task 领取 |
| Browser D | `flow-member-b` | 第二候选人、并发领取失败 |
| Browser E | `flow-outsider` | 非项目成员、负向权限验证 |

如果现有账号密码未知，创建新的本轮专用账号，不要猜旧密码。

### 3.3 测试项目

| 项目 | 用途 |
| --- | --- |
| `Project-A` | 主项目，包含角色、成员、AI 伙伴和映射预设 |
| `Project-B` | 跨项目可见性验证 |

项目成员：

- `flow-owner`：owner。
- `flow-member-a`：member。
- `flow-member-b`：member。
- `flow-outsider`：不加入任何项目。

项目角色：

- `E2E_REVIEWER`：评审角色，成员至少包含 `flow-member-a`、`flow-member-b`。
- `E2E_EXECUTOR`：执行角色，用于 assigned/claim 对比。

## 4. 测试数据

### 4.1 主映射模板

先完成项目角色初始化，再把 `<E2E_REVIEWER_CODE>` 替换为实际 code。

```md
# 工作流：映射 E2E 主流程

## 元信息

- key: e2e-assignment-main
- version: 1
- description: 验证 assigned、角色复用、claim 和映射预设

## 节点

### 系统派单

- id: assigned
- type: task
- executor: user:flow-owner
- portability: suggested
- dispatch-mode: assigned

### 候选池领取 A

- id: claimed-a
- type: task
- executor: role-code:<E2E_REVIEWER_CODE>
- dispatch-mode: claim

### 候选池领取 B

- id: claimed-b
- type: task
- executor: role-code:<E2E_REVIEWER_CODE>
- dispatch-mode: claim

## 连接

- assigned -> claimed-a
- assigned -> claimed-b
```

用途：

- `assigned` 验证唯一主执行人。
- `claimed-a`、`claimed-b` 验证同角色映射复用和单节点覆盖。
- 完成 assigned 后，两个 claim 节点同时进入 ready。

### 4.2 固定人员缺失模板

```md
# 工作流：固定人员缺失

## 元信息

- key: e2e-fixed-missing
- version: 1
- description: 验证固定人员不在项目时的阻断和添加成员

## 节点

### 固定执行

- id: fixed
- type: task
- executor: user:flow-outsider
- portability: suggested
- dispatch-mode: assigned

## 连接
```

### 4.3 强绑定模板

与 4.2 相同，但设置：

```md
- portability: required
```

预期：即使有项目负责人权限，也不能把该节点改派给其他人。

### 4.4 AI assigned 模板

建议使用项目角色槽位，然后在实例映射页把角色映射给 AI 伙伴：

```md
# 工作流：AI 映射

## 元信息

- key: e2e-ai-assignment
- version: 1
- description: 验证 AI assigned 预检和运行

## 节点

### AI 执行

- id: ai-work
- type: task
- executor: role-code:<E2E_EXECUTOR_CODE>
- dispatch-mode: assigned
- execution: task-worker
- trigger: auto-on-ready

## 连接
```

AI 伙伴前置条件：

- AI 伙伴实例状态为 active。
- 已加入 `Project-A`。
- 有项目授权。
- Runtime Profile 启用。
- Agent Profile 为 active 且为 `task-worker`。
- PermissionScope 对 `read/write` 的预检通过。
- Agent 工具权限没有显式拒绝。

## 5. 核心端到端用例

### E2E-WF-ASG-01 项目模板与平台模板可见性

优先级：P0

步骤：

1. Browser A 进入工作流模版管理。
2. 在 `Project-A` 创建项目模板 `E2E 项目私有模板`。
3. 在平台作用域创建平台模板 `E2E 平台模板`。
4. Browser B 进入 `Project-A` 的工作流页面，打开“新建工作流”。
5. 确认模板下拉同时出现项目模板和平台模板。
6. 切换目标项目为 `Project-B`。
7. 确认只出现平台模板，不出现 `Project-A` 的私有模板。
8. 直接尝试在 `Project-B` 启动项目私有模板。

预期：

- 项目模板只对所属项目可见、可启动。
- 平台模板跨项目可见。
- 跨项目直接启动项目模板返回“模板不存在”。
- 非平台管理员不能发布或修改平台模板。

### E2E-WF-ASG-02 模板作用域显式切换

优先级：P1

步骤：

1. Browser A 选择 `Project-A` 的项目模板。
2. 点击“设为平台模板”。
3. 切到 `Project-B`，刷新工作流页面。
4. 确认该模板可见。
5. 回到模版管理，点击“转为项目模板”。
6. 再切到 `Project-B` 刷新。

预期：

- 只有平台管理员看到作用域切换操作。
- 切为 platform 后所有项目可见。
- 切回 project 后只对来源项目可见。
- 项目审计中有 scope 切换记录。

### E2E-WF-ASG-03 同角色映射复用与单节点覆盖

优先级：P0

步骤：

1. Browser B 导入 4.1 主映射模板。
2. 打开“新建工作流”，选择 `Project-A` 和该模板。
3. 等待 preflight 显示“执行人映射已解析”。
4. 在“候选池领取 A”中取消一个候选成员。
5. 检查“候选池领取 B”中同名候选人状态。
6. 在“候选池领取 B”勾选“单节点覆盖”。
7. 再次修改“候选池领取 A”。
8. 检查“候选池领取 B”是否保持不变。
9. 取消 B 的单节点覆盖，再修改 A。

预期：

- 未启用单节点覆盖时，同角色节点自动同步映射。
- 启用单节点覆盖后，B 不受 A 修改影响。
- 取消覆盖后重新恢复同步。
- 页面无控制台错误、无接口 4xx/5xx。

建议自动化选择器：

```text
.pmwf-start-mapping
.pmwf-start-mapping-node
.pmwf-start-mapping-override
.pmwf-start-submit
```

### E2E-WF-ASG-04 项目级映射预设保存和复用

优先级：P0

步骤：

1. Browser B 在映射页选择项目成员/AI 候选。
2. 点击“保存为项目预设”。
3. 关闭“新建工作流”弹窗。
4. 重新打开同一模板的创建弹窗。
5. 等待 preflight 完成。
6. 检查角色节点是否自动预填刚才保存的成员或候选池。
7. 手动修改一个节点。
8. 再次保存预设。
9. 进入项目历史。

预期：

- 预设自动预填，但创建者仍能修改。
- claim 可以保存多个候选人。
- 预设只影响该项目的角色。
- 项目审计出现 `role.mapping.save`。
- 普通成员不能保存项目预设。

### E2E-WF-ASG-05 assigned 人和 claim 候选池主链路

优先级：P0

步骤：

1. Browser B 使用主映射模板创建实例，标题为 `映射 E2E <唯一编号>`。
2. 在映射页确认 assigned 主执行人为 `flow-owner`。
3. 确认 claim A/B 的候选池至少包含 `flow-member-a`。
4. 点击启动。
5. 进入“任务”页面。
6. 找到 `<实例标题> · 系统派单`。
7. 确认该 Task 已直接分配给 `flow-owner`。
8. 完成 assigned Task。
9. 刷新任务页面。
10. 查找 `<实例标题> · 候选池领取 A/B`。

预期：

- assigned Task 只有 `flow-owner` 是主执行人。
- assigned 完成后，A/B 节点同时进入 ready。
- A/B 各自创建候选池 Task，初始状态为 todo。
- 候选 Task 的 receiverType 为 role，但 workflow ref 中有 `dispatchMode=claim` 和候选池快照。
- 非候选人看不到 A/B Task。

### E2E-WF-ASG-06 双候选人并发领取，仅一人成功

优先级：P0

前置条件：

- Browser C 登录 `flow-member-a`。
- Browser D 登录 `flow-member-b`。
- 两人都在候选池中。

步骤：

1. 两个浏览器同时打开同一个 claim Task。
2. 刷新任务列表，确认两人都能看到该 Task。
3. 两人在 1 秒内同时点击“认领”。
4. 等待两个请求完成。
5. 刷新两个浏览器。
6. 打开工作流实例详情。
7. 打开项目或工作流审计时间线。

预期：

- 恰好一个浏览器领取成功。
- 成功者 Task：
  - status = `progress`
  - receiverType = `human`
  - receiverId = 实际领取人
- 工作流节点：
  - status = `running`
  - receiverOverride 指向实际领取人
- 失败者收到“任务已被其他候选人领取”或刷新后任务消失。
- 只产生一条成功领取事件。
- 产生 `node.claimed` 审计。
- 失败领取有 `node.claim_rejected` 审计。

### E2E-WF-ASG-07 固定人员缺失、改派和添加成员

优先级：P0

步骤：

1. Browser A 在平台作用域导入 4.2 固定人员缺失模板。
2. Browser B 在 `Project-A` 打开新建实例。
3. 选择该平台模板。
4. 观察映射页风险。
5. 确认“启动”按钮禁用。
6. 将固定执行人重新映射到 `flow-member-a`。
7. 重新等待 preflight。
8. 另建一次实例映射，不改派，点击“添加为项目成员”。
9. 等待 preflight 重新执行。
10. Browser E 重复打开该模板。

预期：

- `flow-outsider` 不在项目时返回 blocking risk。
- 重新映射后可以启动。
- 项目负责人可以添加缺失成员；添加成功后 preflight 自动解除阻断。
- 普通成员看不到或不能执行“添加为项目成员”。
- 添加成员写项目审计。

### E2E-WF-ASG-08 required 强绑定不可重映射

优先级：P1

步骤：

1. 导入并发布 4.3 强绑定模板。
2. 打开实例映射。
3. 尝试把固定执行人改为其他项目成员。

预期：

- 显示“要求固定绑定，不能重新映射”。
- 启动保持禁用。
- 管理员也不能绕过启动。

### E2E-WF-ASG-09 未解析节点不产生副作用

优先级：P0

覆盖场景：

- `assigned` 没有主执行人。
- `claim` 候选池为空。
- 项目角色不存在。
- 角色存在但没有成员。
- 固定人员不在项目。
- AI 伙伴未启用。
- AI 缺少 Runtime Profile。
- AI 缺少 Agent Profile。

步骤：

1. 逐一构造上述场景。
2. 打开映射页。
3. 确认风险文案和“未解析”状态。
4. 确认启动按钮禁用。
5. 通过开发工具或自动化直接调用启动接口。

预期：

- 前端和后端都阻止启动。
- 不创建 Workflow Instance。
- 不创建 Task。
- 不启动 Agent Run。
- 项目审计出现 `workflow.assignment.unresolved`。

### E2E-WF-ASG-10 AI assigned 预检和 Run

优先级：P0

步骤：

1. 在 `Project-A` 准备一个满足全部前置条件的 AI 伙伴。
2. 打开 4.4 AI assigned 模板的映射页。
3. 把执行角色映射到该 AI 伙伴。
4. 等待 preflight。
5. 确认无 blocking risk。
6. 启动实例。
7. 打开任务详情。
8. 打开 Agent 执行记录。
9. 打开工作流实例详情。

预期：

- AI 作为 assigned 主执行人。
- Task 自动分配给 AI。
- Runtime/Ticket 预检通过后产生 Agent Run。
- 节点进入 running。
- `node.auto_dispatched` 和现有 `agent.dispatched` 事件存在。
- 任务、节点和 Run 的项目归属一致。

### E2E-WF-ASG-11 AI 权限或 Runtime 不完整时阻断

优先级：P0

参数化场景：

1. AI 伙伴暂停。
2. AI 未加入项目。
3. Runtime Profile 停用。
4. Agent Profile 停用。
5. Agent Profile 不是 task-worker。
6. PermissionScope 缺少 read/write。
7. Agent 工具权限显式拒绝。

预期：

- 对应 blocking risk 出现。
- 启动按钮禁用。
- 不创建实例、Task 或 Run。
- 修复 Runtime/授权后重新 preflight 可启动。

### E2E-WF-ASG-12 AI 不能进入 claim 候选池

优先级：P0

步骤：

1. 打开 claim 节点映射。
2. 检查候选池可选项。
3. 尝试通过接口把 AI ID 放入 candidatePool。

预期：

- GUI 候选池只展示真人。
- 后端返回 `candidate_ai_not_supported` 或等价错误。
- 实例不能启动。

### E2E-WF-ASG-13 已启动实例 binding snapshot 隔离

优先级：P0

步骤：

1. 使用主映射模板启动实例 `Snapshot-A`。
2. 记录每个节点的 primaryAssignee、candidatePool 和 roleSnapshot。
3. 修改项目角色成员。
4. 修改项目映射预设。
5. 导入同模板的新版本，修改节点执行人。
6. 刷新 `Snapshot-A` 详情。
7. 新建 `Snapshot-B`。

预期：

- `Snapshot-A` 的 assignmentBindings、approvalBindings 和 roleSnapshot 不变。
- 模板版本修改不影响旧实例。
- 新实例读取新模板和新映射预设。

### E2E-WF-ASG-14 审计完整性

优先级：P1

步骤：

1. 完成一次映射并启动实例。
2. 完成一次改派。
3. 保存一次项目映射预设。
4. 添加一次缺失项目成员。
5. 完成一次 claim。
6. 用非候选人尝试 claim。
7. 触发一次 assigned AI 自动派发。
8. 触发一次未解析启动失败。

预期审计：

- `assignment.resolved`
- `assignment.remapped`
- `role.mapping.save`
- `member.add`（项目成员添加）
- `node.claimed`
- `node.claim_rejected`
- `node.auto_dispatched`
- `workflow.assignment.unresolved`

审计必须能关联：

- instanceId
- nodeId
- taskId
- 模板 binding
- 实例 binding
- dispatchMode
- actor
- 时间

### E2E-WF-ASG-15 子流程未解析阻断

优先级：P1

步骤：

1. 创建父流程，引用一个含缺失执行人的子流程。
2. 启动父流程并推进到子流程节点。
3. 打开父流程详情。
4. 检查子流程实例列表。

预期：

- 子流程 preflight 失败时，父节点 blocked。
- 不创建子实例。
- 不创建子流程 Task/Run。
- 父实例时间线出现 `subworkflow.unresolved`。

## 6. 用户视角回归矩阵

| 用户动作 | 必须验证 |
| --- | --- |
| 查看模板 | 项目私有模板不跨项目，平台模板跨项目 |
| 新建实例 | 先 preflight，映射完成后才能启动 |
| 选择项目成员 | 只允许当前项目成员 |
| 选择 AI | 只允许当前项目可用 AI，且必须通过 Runtime/Profile/权限预检 |
| 保存映射预设 | 项目负责人可保存，普通成员不可 |
| 重新打开映射 | 自动预填预设，仍可修改 |
| 同角色多节点 | 默认复用，可单节点覆盖 |
| 完成 assigned Task | 产生确定责任人，不进入候选池 |
| 查看 claim Task | 只有候选人可见 |
| 点击认领 | 第一位成功，后续失败 |
| 修改模板 | 不影响已启动实例 |
| 查看审计 | 映射、预设、成员、领取、拒绝、自动派发均可追溯 |

## 7. 自动化断言建议

### 7.1 UI 断言

```text
.pmwf-start-mapping
.pmwf-start-mapping-node
.pmwf-start-mapping-override
.pmwf-start-mapping-risks
.pmwf-start-submit
[data-task-id]
```

### 7.2 API 辅助断言

以下 API 只用于确认 UI 操作后的最终状态，不替代用户操作：

```text
POST /api/collab/workflow/instances/preflight
POST /api/collab/workflow/instances/start
GET  /api/collab/workflow/instances/detail
GET  /api/collab/tasks
GET  /api/collab/tasks/detail
POST /api/collab/tasks/claim
GET  /api/collab/projects/detail
POST /api/collab/projects/role-mappings/save
```

重点断言：

- Instance.assignmentBindings
- Instance.approvalBindings
- Instance.roleSnapshot
- Task.workflow.dispatchMode
- Task.workflow.candidatePool
- Task.receiverType / receiverId / status
- WorkflowNodeState.status / receiverOverride
- 事件流中的审计 kind

## 8. 证据要求

每个 P0 用例至少保留：

1. 操作前截图。
2. 关键映射或风险截图。
3. 操作后任务/节点/审计截图。
4. 浏览器控制台错误清单。
5. 失败响应清单。
6. 实例 ID、Task ID、Run ID。

建议截图：

```text
.tmp/wf-e2e-01-template-scope.png
.tmp/wf-e2e-02-mapping-preset.png
.tmp/wf-e2e-03-assigned-task.png
.tmp/wf-e2e-04-claim-candidates.png
.tmp/wf-e2e-05-claim-success.png
.tmp/wf-e2e-06-claim-conflict.png
.tmp/wf-e2e-07-missing-member.png
.tmp/wf-e2e-08-ai-preflight.png
.tmp/wf-e2e-09-audit.png
.tmp/wf-e2e-10-snapshot.png
```

## 9. 自动门禁

GUI 前先执行：

```sh
./node_modules/.bin/vitest run
./node_modules/.bin/tsc -b tsconfig.json
./node_modules/.bin/tsc -p tsconfig.test.json --noEmit
./node_modules/.bin/oxlint plugins/dsh-collab-workflow plugins/dsh-collab-task plugins/dsh-collab-project
node scripts/contract.mjs
```

针对性测试至少包含：

```sh
./node_modules/.bin/vitest run \
  plugins/dsh-collab-workflow/src/index.test.ts \
  plugins/dsh-collab-workflow/src/client-state-guard.test.ts \
  plugins/dsh-collab-task/src/service.test.ts \
  plugins/dsh-collab-task/src/index.test.ts \
  plugins/dsh-collab-task/src/client-smoke.test.ts \
  plugins/dsh-collab-project/src/index.test.ts
```

## 10. 退出标准

本轮 GUI E2E 通过必须同时满足：

- 所有 P0 用例通过。
- 没有 blocking 产品缺陷。
- 未解析场景无实例、Task、Run 副作用。
- 双候选人并发领取只有一个成功。
- 平台/项目模板可见性符合预期。
- 同角色映射复用和单节点覆盖符合预期。
- 项目映射预设可保存并自动预填。
- 已启动实例不受模板和角色后续变更影响。
- 审计可还原实际操作。
- 全量自动测试、类型检查、lint 和 contract 通过。

## 11. 建议执行顺序

1. 自动门禁。
2. `E2E-WF-ASG-01`、`02`：scope。
3. `E2E-WF-ASG-03`、`04`：映射和预设。
4. `E2E-WF-ASG-05`、`06`：assigned / claim 主链路。
5. `E2E-WF-ASG-07`、`08`、`09`：缺失成员、强绑定、未解析。
6. `E2E-WF-ASG-10`、`11`、`12`：AI assigned 和 AI claim 负向。
7. `E2E-WF-ASG-13`、`14`、`15`：快照、审计、子流程。
