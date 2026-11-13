# 工作流模板与实例执行人映射 GUI E2E 执行报告

> 日期：2026-11-07  
> 环境：隔离 `DSH_HOME=.tmp/workflow-gui-e2e-home-20261107`  
> 服务：`127.0.0.1:33142`  
> 方案：`gui-e2e-test-plan-workflow-template-assignment.md`

## 1. 执行结论

本轮通过浏览器自动化实际执行了 scope、映射预设、assigned、AI assigned 正向 Run、双人 claim、缺失成员、未解析启动、审计、binding snapshot、scope 切换和 AI claim 负向等核心链路。

结果：

- 已执行的 P0 用例全部通过。
- 浏览器发现 3 个用户可见缺陷。
- 三个缺陷均已修复，并补充自动化测试。
- 全量 Vitest、TypeScript、lint 和 contract 检查通过。

## 2. 测试数据

- 项目 A：`1102-手机平板订单履约演示`
- 项目 B：`1001-外接agent测试`
- 项目角色：`计划员 / ROLE_MVZ04KOS`
- 专用账号：
  - `wf-e2e-owner-*`
  - `wf-e2e-a-*`
  - `wf-e2e-b-*`
  - `wf-e2e-out-*`
- 临时模板：
  - 完整 GUI E2E
  - 固定人员缺失
  - required 强绑定
  - 平台可见性

所有账号、项目角色和模板均写入隔离环境副本，没有修改共享 `DSH_HOME`。

## 3. 浏览器执行结果

| 用例 | 结果 | 用户视角验证 |
| --- | --- | --- |
| E2E-WF-ASG-01 | 通过 | 项目模板只在所属项目出现，平台模板在两个项目出现 |
| E2E-WF-ASG-03 | 通过 | 同角色节点映射自动传播，单节点覆盖后停止传播 |
| E2E-WF-ASG-04 | 通过 | 映射保存为项目预设，关闭重开后自动预填 |
| E2E-WF-ASG-05 | 通过 | assigned Task 创建并分配给固定执行人 |
| E2E-WF-ASG-06 | 通过 | 两个浏览器同时点击领取，仅一人成功 |
| E2E-WF-ASG-07 | 通过 | 缺失固定人员阻断启动，添加成员后风险解除 |
| E2E-WF-ASG-08 | 通过 | required 固定绑定不可重新映射 |
| E2E-WF-ASG-09 | 通过 | 未解析启动被前后端阻止，未创建实例 |
| E2E-WF-ASG-12 | 通过 | AI 候选无法进入 claim 候选池 |
| E2E-WF-ASG-13 | 通过 | 修改项目预设后，已启动实例 binding 保持不变 |
| E2E-WF-ASG-14 | 通过 | 映射预设、成员添加、未解析启动可审计 |
| 额外 scope 切换 | 通过 | 模板切为 platform 后项目 B 可见，切回 project 后隐藏 |
| AI assigned 负向 | 通过 | Runtime 未就绪时 preflight 阻断，不静默启动 |
| AI assigned 正向 | 通过 | 项目成员 AI 通过预检后派单，Run 成功并完成节点与 Task |

## 4. 发现并修复的问题

### BUG-01 claim Task 初始状态错误

现象：

- claim 节点 WorkflowNodeState 已经是 ready。
- Task 以 `progress` 创建。
- 客户端认领按钮仅在 `todo` 状态展示，用户看不到“认领”。

根因：

- 创建 Task 时沿用了普通工作流任务的 `progress` 初始状态。
- Task reconcile 的 `projectedTaskStatus` 也未识别 claim 候选池。

修复：

- claim 候选任务以 `todo` 创建。
- `projectedTaskStatus` 对 claim 且节点 ready 的 Task 保持 `todo`。
- 领取后 Task 进入 `progress`，节点进入 `running`。

验证：

- GUI 可看到认领按钮。
- 领取成功后 Task status=`progress`、node status=`running`。
- 只产生一条成功领取，失败者收到“任务已被其他候选人领取”。

### BUG-02 AI Runtime 缺失时风险动作误导

现象：

- AI 伙伴已经是项目成员。
- 缺少 Runtime Profile 时，风险提示仍建议“添加项目成员”。

根因：

- `employeeTarget` 缺失时统一返回 `add_project_member + enable_ai_runtime`。
- 没有区分“不是项目成员”和“已是成员但运行身份未就绪”。

修复：

- preflight 计算 AI 项目成员状态。
- 已是成员时只返回 `enable_ai_runtime`。
- 文案改为“缺少启用的 Runtime Profile 或可派发员工映射”。

验证：

- AI assigned 负向 preflight 返回 blocking risk。
- 不再提示添加项目成员。
- 不创建实例或 Run。

### BUG-03 Runtime-only AI 被 preflight 错误阻断

现象：

- 外部 AI Teammate 已注册 Runtime、加入项目并绑定项目角色。
- Runtime 可正常执行，但 preflight 仍将节点判定为不可派发。

根因：

- preflight 强制要求 AI 必须存在 Digital Employee 的 `workflowTarget`。
- 外部 Teammate 的派发身份由 Principal Runtime Profile 提供，不保证存在对应的 Digital Employee 记录。

修复：

- AI 派发资格改为接受以下任一有效身份：
  - active Teammate。
  - 项目成员。
  - active Principal Runtime Profile。
  - active task-worker Agent Profile。
  - 通过 PermissionScope。
- 不再强制要求 Digital Employee 记录。

验证：

- 使用隔离环境中的确定性 external command fixture 完成真实派发。
- Runtime `ext-77484e2b`、Teammate `tm-8bc6568e-420a-4f8d-b6de-91ebe8b9a430` 通过 preflight。
- Instance `50ef1574-14ab-4cb7-800b-627110514f51` 启动成功。
- Run `run-9bdfbabc-db4a-406f-87dd-0e3d0734b148` 状态为 `succeeded`。
- Node 状态为 `completed`，Task 状态为 `done`。
- `node.auto_dispatched`、`agent.dispatched`、`node.completed`、`agent.succeeded` 审计事件均存在。
- 浏览器 console error 为 0。

## 5. 证据

- 执行结果：
  - `.tmp/workflow-e2e-results.json`
- claim 成功：
  - `.tmp/workflow-claim-e2e.png`
- scope 切换：
  - `.tmp/workflow-e2e-scope-conversion.png`
- AI 负向预检：
  - 终端输出：`ai_runtime_not_ready`
- AI assigned 正向 Run：
  - 脚本：`.tmp/workflow-ai-positive-e2e.mjs`
  - Runtime fixture：`.tmp/ai-assigned-fixture.mjs`
  - Instance：`50ef1574-14ab-4cb7-800b-627110514f51`
  - Run：`run-9bdfbabc-db4a-406f-87dd-0e3d0734b148`

控制台中观察到的非业务错误：

- 登录前预期 401。
- 未启用可选 Demo 订单插件的 404。
- 并发领取预期的 409。
- 未解析启动预期的 400。

未发现新的工作流或任务业务错误。

## 6. 自动化门禁

- 针对性 Vitest：`217/217` 通过。
- 全量 Vitest：`973/973` 通过。
- `tsc -b tsconfig.json`：通过。
- `tsc -p tsconfig.test.json --noEmit`：通过。
- `oxlint plugins/dsh-collab-workflow plugins/dsh-collab-task plugins/dsh-collab-project`：无 error，仅既有 warning。
- `tsdown` 构建 `dsh-collab-workflow`：通过。
- `node scripts/contract.mjs`：26 个 plugin bundle 通过。
- `git diff --check`：通过。

## 7. 未完成或未在本轮执行的场景

- AI 自主抢单：产品规则尚未确认，当前仍保持 AI 只 assigned。
- 子流程未解析 GUI：已有服务级逻辑，但本轮浏览器套件未单独执行。
- 多写入进程 claim CAS：当前仍是单宿主进程串行队列；存储层尚未提供跨进程 compare-and-set。

## 8. 结论

第一阶段和第二阶段的用户主链路已经通过隔离环境浏览器验证，包括 AI assigned 从 preflight、派单、Runtime 执行到节点和 Task 完成的真实正向 Run。本轮发现的缺陷均属于实际交互路径问题，已经修复并回归。当前不建议在未确认 AI claim 策略前开放 AI 自主抢单。
