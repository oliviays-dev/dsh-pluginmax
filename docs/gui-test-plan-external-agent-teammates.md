# 外部 Agent Teammates GUI 测试方案

> 独立测试方案，覆盖外部 Agent 运行时、Teammate 绑定、任务/工作流联动、失败路径和回滚。不要复用用户正在使用的 `33124` 数据目录。

## 1. 环境准备

### 1.1 启动隔离服务

在仓库根目录执行：

```bash
lsof -ti tcp:33117 -sTCP:LISTEN
DSH_HOME="$PWD/.tmp/external-agent-home" node vendor/deepseek-harness/apps/cli/lib/bin.js --profile pluginmax --no-open --port 33117
```

如果第一条命令有 PID，先停止该测试进程；如果没有 PID，直接启动第二条。启动后从终端复制带 `?token=` 的完整 URL 打开。

### 1.2 账号与项目

| 角色          | 要求                                       |
| ------------- | ------------------------------------------ |
| Admin         | 平台管理员，用于平台级配置和跨权限检查     |
| Project Owner | 至少一个项目的 Owner，用于项目级外部运行时 |
| Member        | 普通成员，用于验证不能注册外部运行时       |

准备一个项目，并记录项目 ID。给项目创建一个最小代码目录或空目录，确保任务/工作流可解析到 `workspacePath`。

### 1.3 假外部 Agent 路径

把以下路径中的 `<REPO>` 替换为本仓库绝对路径：

| 用途                  | Command | Args                                                       |
| --------------------- | ------- | ---------------------------------------------------------- |
| 通用 plain-text Agent | `node`  | `<REPO>/docs/fixtures/external-agent/plain-text-agent.mjs` |
| Codex JSONL 假实现    | `node`  | `<REPO>/docs/fixtures/external-agent/codex-fake.mjs`       |

已安装真实 Codex 时，可另行注册 `command=codex`、`protocol=codex-jsonl`。第一版不测试需要写仓库的真实任务。

## 2. 用例总览

| 编号   | 场景             | 关键验收                                     |
| ------ | ---------------- | -------------------------------------------- |
| EXT-01 | 权限             | Admin/Owner 可管理，Member 不可              |
| EXT-02 | 注册与探测       | 运行时可保存、启停、探测                     |
| EXT-03 | Teammate 绑定    | 旧 Teammate 默认内置，新 Teammate 可绑定外部 |
| EXT-04 | 通用外部任务     | stdin/stdout 全链路可见                      |
| EXT-05 | Codex JSONL 任务 | 进度、结果、外部 Session ID 可见             |
| EXT-06 | 工作流门禁       | 外部成功仍需交付物/Review/审批               |
| EXT-07 | 失败路径         | 启动失败、空输出、停用运行时有明确原因       |
| EXT-08 | 人工介入         | Owner/Admin 可完成/取消，成员不可            |
| EXT-09 | 独立闭环         | 无任务模块时工作流仍可完成                   |
| EXT-10 | 回滚             | 切回内置/停用运行时/revert 分支均安全        |

## 3. 回归步骤

### EXT-01 权限

1. Admin 打开 **AI Teammates > 外部 Agent**，应看到 **注册运行时**。
2. Project Owner 打开同一页面，也应看到 **注册运行时**。
3. Member 打开同一页面，不显示 **注册运行时**；直接调用创建接口应返回“平台或项目 Owner/Admin 才能管理外部 Agent 运行时”。
4. Member 仍可查看运行时列表，因为后续需要理解 Teammate 绑定。

### EXT-02 注册与探测

1. Admin/Owner 注册 Codex 假实现：
   - Provider：`Codex`
   - Protocol：`Codex JSONL`
   - Command：`node`
   - Args：`<REPO>/docs/fixtures/external-agent/codex-fake.mjs`
   - 状态：启用
2. 保存后列表应显示命令、启用状态、Provider 和协议。
3. 点击 **探测**，应提示命令探测通过，并记录探测结果。
4. 注册通用 Agent：
   - Provider：`WorkBuddy`
   - Protocol：`通用 stdin/stdout`
   - Command：`node`
   - Args：`<REPO>/docs/fixtures/external-agent/plain-text-agent.mjs`
5. 停用通用 Agent，状态应变为停用；重新启用应恢复。

### EXT-03 Teammate 绑定

1. 打开一个升级前创建的 Teammate，执行方式应默认显示 **内置执行**，且任务行为不变。
2. 新建或编辑 Teammate：
   - 执行方式：`外部 Agent`
   - 外部 Agent：EXT-02 的 Codex 假实现
3. 不选择运行时直接保存，保存按钮应不可用。
4. 保存后重新打开定义，执行方式仍为外部 Agent。
5. 再创建一个内置执行 Teammate，供后续对比。

### EXT-04 通用外部任务

1. 在任务管理创建任务，标题为“外部通用 Agent 验收”。
2. 接收方选择 EXT-03 的通用外部 Teammate。
3. 派发后任务应进入 **进行中**，详情出现外部 Agent 执行记录。
4. 进度应包含“收到任务”，结果应包含“外部 Agent 已完成本地验证”。
5. 任务完成后，若任务要求 Review 则进入 **待 Review**；若不需要 Review 则自动进入完成态。

### EXT-05 Codex JSONL 任务

1. 创建并派发第二个任务给 Codex 外部 Teammate。
2. 任务详情应显示实时过程“外部 Agent 正在执行”。
3. 运行完成后，最终输出应包含“Codex 假实现已完成 GUI 验收任务”。
4. 详情或执行历史中的 Agent Run 应记录 `externalSessionId=gui-fake-thread-1`。
5. 若 UI 没有直接展示 session ID，可通过任务详情引用的 Agent Run 审计数据确认。

### EXT-06 工作流门禁

1. 先给外部 Teammate 派发一个最小任务，确保运行态已生成；在 Teammate 运行态详情复制 Agent Profile ID。
2. 上传或创建一个包含 Agent 节点的工作流模板，节点配置：

```markdown
# 工作流：外部 Agent 门禁

## 元信息

- key: external-agent-gate
- version: 1
- description: 验证外部 Agent 不能绕过交付物和 Review

## 节点

### 开发

- id: development
- type: task
- executor: agent:<Agent Profile ID>
- responsible: user:<Project Owner>
- execution: task-worker
- trigger: auto-on-ready
- review-required: true
- deliverable: report
  title: 实现说明
  type: text
  required: true
  min-text-length: 20
```

3. 启动工作流实例并让节点派发给外部 Teammate。
4. 外部 Agent 成功后，工作流节点不得直接跳到后续审批；应先写入“实现说明”交付物并进入等待人工 Review。
5. 拒绝交付物后重新提交，节点应保持待 Review。
6. 通过 Review 后，若模板有审批节点，仍必须由审批人完成审批。
7. 将该 Agent 节点改为 `review-required: false` 后再测试一次；交付物完整时应自动完成并进入下一节点。

### EXT-07 失败路径

1. 注册 Command 为 `definitely-not-installed-agent` 的运行时并绑定 Teammate。
2. 派发任务，任务应失败，执行历史应包含 `ENOENT` 或“命令不存在”类诊断，不得进入待 Review。
3. 注册一个输出为空的 `plain-text` 运行时（可用系统命令 `true` 临时验证）。
4. 派发任务，应提示外部 Agent 未返回可用文本输出。
5. 在任务运行中停用其绑定的运行时，已在运行的执行允许完成或失败；下一次派发应立即失败并提示运行时已停用。
6. 取消一个运行中的外部任务，状态应变为已取消，后续工作流节点不得继续。

### EXT-08 人工介入

1. 让 Owner/Admin 打开一个进行中的 Agent 工作流节点任务。
2. 使用人工介入完成，必须补全节点必需交付物；备注可为空。
3. 提交后工作流按 Review/审批配置继续，任务历史应记录人工介入。
4. 普通成员尝试人工介入该节点，应被拒绝。
5. Owner/Admin 取消一个 Agent 节点，工作流节点应进入取消/阻止态，任务状态同步，不能继续误流转。

### EXT-09 工作流独立闭环

1. 在没有任务管理处理人的新项目里导入 EXT-06 模板。
2. 启动、派发、提交交付物、Review、审批并完成实例。
3. 工作流不应因任务模块不可用而阻塞。
4. 若任务模块存在，再把同一实例的节点状态与任务投影核对一致。

### EXT-10 回滚验证

按影响从小到大验证：

1. 把 Teammate 从外部执行改回内置执行；新任务应使用内置 Worker。
2. 停用外部运行时；已绑定 Teammate 的新任务应失败且提示可修复或转人工。
3. 使用测试数据目录时可直接停止服务并删除 `.tmp/external-agent-home`。
4. 代码回滚时，切回 `main` 或 revert 功能分支提交；老数据缺少外部字段仍应等价于内置执行。

## 4. 通过标准

1. `pnpm check` 全量通过。
2. EXT-01 到 EXT-10 全部通过。
3. 升级前创建的 Teammate、任务、工作流实例无需数据迁移即可继续使用。
4. 外部 Agent 成功结果不能绕过工作流交付物、Review 或审批。
5. 每个失败路径都有用户可读原因和可执行下一步。
6. 服务重启后，排队任务可恢复；运行中外部进程中断时标记为中断，不会假成功。
