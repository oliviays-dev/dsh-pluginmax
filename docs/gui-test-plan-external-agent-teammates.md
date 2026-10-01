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

| 用途                   | Command | Args                                                       |
| ---------------------- | ------- | ---------------------------------------------------------- |
| 通用 plain-text 假实现 | `node`  | `<REPO>/docs/fixtures/external-agent/plain-text-agent.mjs` |
| Codex JSONL 假实现     | `node`  | `<REPO>/docs/fixtures/external-agent/codex-fake.mjs`       |

已安装真实 Codex 时，可另行注册 `command=codex`、`protocol=codex-jsonl`。第一版不测试需要写仓库的真实任务。

### 1.4 真实 WorkBuddy 接入准备

本节只测真实 WorkBuddy，不使用 `docs/fixtures/external-agent/` 下的任何文件，也不使用 shell 脚本伪装 WorkBuddy。当前平台通过第一版 `plain-text` 外部运行时承接 WorkBuddy，契约如下：

```text
stdin:  UTF-8 平台 Prompt
stdout: UTF-8 最终结果
stderr: 登录、网络、权限、执行诊断
exit 0: 成功
非零:   失败
SIGTERM: 取消
```

在 macOS 安装包中，WorkBuddy 5.6.2 自带 CLI 2.147.0。本方案的 `<WORKBUDDY_CLI>` 统一表示以下真实可执行文件；不要复制到测试夹具目录，也不要通过包装脚本改名：

```bash
/Applications/WorkBuddy.app/Contents/Resources/app.asar.unpacked/cli/bin/codebuddy
```

本地非交互执行已确认使用 `--print`，CLI 会从 stdin 读取平台 Prompt，最终文本写入 stdout。本地运行时配置如下：

| 字段     | 值                                                                         |
| -------- | -------------------------------------------------------------------------- |
| Provider | `WorkBuddy`                                                                |
| Protocol | `通用 stdin/stdout`                                                        |
| Command  | `<WORKBUDDY_CLI>`                                                          |
| Args     | `--print --output-format text --max-turns 1 --permission-mode acceptEdits` |

Prompt-only 连通性检查不需要工具权限；文件写入用例使用独立测试目录，并保持 `acceptEdits` 权限范围。不要为了绕过权限提示注册 `--dangerously-skip-permissions`。

启动 DSH 前，先在运行 DSH 的同一台机器和同一用户会话完成 WorkBuddy 登录，再执行：

```bash
printf '请只返回：WORKBUDDY_CONNECTIVITY_OK' | <WORKBUDDY_CLI> --print --output-format text --max-turns 1
```

输出必须恰好包含 `WORKBUDDY_CONNECTIVITY_OK`。只看退出码不够：本机 CLI 2.147.0 在未登录时输出 `Authentication required...`，但退出码可能是 0。连通性门禁必须同时校验退出码和输出；未满足时不要继续 WB-02 之后的用例。

真实接入分两种模式：

| 模式             | 适用场景                                        | 运行时配置                                     |
| ---------------- | ----------------------------------------------- | ---------------------------------------------- |
| Local WorkBuddy  | CLI 和凭据在本机，可直接访问当前项目目录        | 上表的本地 CLI 参数                            |
| Remote WorkBuddy | 本机 CLI 连接官方远端 WorkBuddy，实际执行在远端 | WorkBuddy 官方远端 Profile/Endpoint 非交互参数 |

截至 WorkBuddy 5.6.2 / CLI 2.147.0，`--help` 没有暴露通用的远程 endpoint 参数。Remote WorkBuddy 必须使用官方产品提供的 Profile、Endpoint 或远程控制配置；不要把 HTTP URL 拼进 Prompt 当作远程执行，也不要自定义 HTTP 包装。若当前账号没有官方远程执行入口，WB-05 到 WB-08 标记为阻塞，不使用假实现代替。

Remote 模式必须先确认远端工作区策略。如果测试会读写仓库，远端 WorkBuddy 必须挂载同一项目目录、同步同一提交，或由官方远程执行协议自行传输工作区；否则只能先测不依赖仓库文件的 Prompt-only 任务。

凭据不得写进平台 Args。使用 WorkBuddy 官方 Profile、macOS Keychain、环境变量或远端服务自己的登录态。若必须使用环境变量，要先在启动 DSH 服务的终端里配置，让 WorkBuddy 子进程继承；不要把 token、API key 或密码填到可见参数里。

### 1.5 WorkBuddy 已知风险门禁

1. 未登录 CLI 的 stdout 是 `Authentication required...`，退出码可能是 0。执行前必须按 1.4 做输出断言；若平台把该输出记为成功结果，WB-08 判失败并记录缺陷。
2. WorkBuddy 的模型输出可能包含解释文字。测试 Prompt 必须要求稳定标记，验收以标记为准，不要求整段输出完全相等。
3. 高风险权限提示可能阻塞外部进程。工作流取消用例必须在派发前确认运行时参数不会触发交互提示。
4. 本机 GUI 登录态和终端登录态可能不同步。所有 WorkBuddy 用例必须从启动 DSH 的同一终端环境验证连通性。

## 2. 用例总览

### 外部 Agent 假实现回归

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

### 真实 WorkBuddy 回归

| 编号  | 模式   | 场景           | 关键验收                                     |
| ----- | ------ | -------------- | -------------------------------------------- |
| WB-01 | 本机   | 真实连通和登录 | 版本、stdin Prompt、结果标记全部来自真实 CLI |
| WB-02 | 本机   | 真实任务执行   | Task 状态、过程、stdout 结果和执行历史同步   |
| WB-03 | 本机   | 真实工作流节点 | Agent 成功后仍遵守交付物、Review、审批门禁   |
| WB-04 | 本机   | 真实取消       | 取消外部进程后不得出现假完成或继续流转       |
| WB-05 | 远端   | 真实远端连通   | 官方远端 Profile 可探测，Workspace 策略明确  |
| WB-06 | 远端   | 真实远端任务   | 远端执行过程、结果和任务状态同步             |
| WB-07 | 远端   | 真实远端工作流 | 远端 Agent 成功后仍遵守工作流门禁            |
| WB-08 | 远端   | 认证/网络失败  | 未登录、断网、Endpoint 不可用均有失败原因    |
| WB-09 | 双模式 | 权限与敏感信息 | 目录范围可控，凭据不进入 UI、日志或执行历史  |

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
   - Provider：`Command`
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

## 4. 真实 WorkBuddy 回归步骤

以下用例全部使用真实 WorkBuddy 登录态和官方 CLI。为了隔离真实写入，先准备空目录 `/tmp/workbuddy-gui-workspace`，并把 WorkBuddy 用例所属项目的 Workspace 配置为该目录。不要让 WB 用例读写用户业务仓库。

### WB-01 本机真实连通和登录

1. 在启动 DSH 的终端执行 `"<WORKBUDDY_CLI>" --version`，记录 WorkBuddy CLI 版本。
2. 执行 1.4 的 Prompt-only 连通性命令，输出必须包含 `WORKBUDDY_CONNECTIVITY_OK`。
3. Admin 或 Project Owner 在 **AI Teammates > 外部 Agent** 注册 1.4 的 Local WorkBuddy 运行时。
4. 点击 **探测**，应记录命令存在和版本；探测不要求发起模型请求。
5. 启用运行时后，再次查看 WorkBuddy 官方 CLI 版本，确认 GUI 使用的是同一本机安装。

### WB-02 本机真实任务执行

1. 新建 Teammate，执行方式选择 **外部 Agent**，绑定 WB-01 的 WorkBuddy 运行时。
2. 创建 Task，标题为“真实 WorkBuddy 连通验收”，描述要求：`只返回稳定标记 WORKBUDDY_TASK_OK，不要读取或修改文件`。
3. 派发给该 WorkBuddy Teammate。
4. 任务详情应先显示外部进程运行中；完成后，stdout 最终结果包含 `WORKBUDDY_TASK_OK`。
5. 执行历史应记录真实 WorkBuddy 命令、启动时间、结束时间、退出码和 stdout 结果；stderr 只记录诊断，不得记录凭据。
6. 若任务要求 Review，先进入待 Review；将任务配置为无需 Review 后重跑，应从运行中直接进入完成态。

### WB-03 本机真实工作流节点

1. 新建一个绑定 WorkBuddy 运行时的 Teammate，并启动独立工作流实例。
2. Agent 节点 Prompt 要求：`只返回 WORKBUDDY_WORKFLOW_OK；不要修改任何文件`。
3. 节点进入运行中时，工作流详情和对应 Task 投影都要显示 WorkBuddy 正在执行。
4. WorkBuddy 返回 `WORKBUDDY_WORKFLOW_OK` 后，节点不得因 Agent 成功而直接完成：
   - 必需交付物缺失时保持待补交付物；
   - `review-required: true` 时进入待 Review；
   - 后续存在审批节点时等待审批。
5. 补全交付物、通过 Review 和审批后，工作流才能进入下一节点或完成。
6. 把该节点改为无需 Review 且无必需交付物，再创建一个实例；WorkBuddy 成功后该节点应自动完成。

### WB-04 本机真实取消

1. 创建一个真实长任务，Prompt 要求：`持续思考 60 秒后返回 WORKBUDDY_CANCELLED_TEST_OK；不要读取或修改文件`。
2. 确认 Task 与工作流节点都进入运行中。
3. Project Owner 或 Admin 从工作流节点触发取消。
4. WorkBuddy 子进程应收到终止信号；Task 和节点状态变为已取消或阻止态，不得使用模型后续输出假成功。
5. 执行历史记录“用户取消”，后续工作流节点不启动。
6. 打开 WorkBuddy 官方 CLI 的 `ps` 视图或系统进程列表，确认没有残留执行进程。

### WB-05 远端真实连通

1. 在 WorkBuddy 官方产品中启用远端执行 Profile/Endpoint，并记录官方 Workspace 策略。
2. 在启动 DSH 的终端使用官方 CLI 非交互模式执行 Prompt-only 连通性请求，输出包含 `WORKBUDDY_REMOTE_CONNECTIVITY_OK`。
3. 注册第二个运行时，Provider 为 `WorkBuddy`，Protocol 仍为 `通用 stdin/stdout`；Command 与 Args 必须来自官方远端接入方式。
4. 平台探测应成功，并能把 Local 与 Remote 区分展示。
5. 若官方 CLI 5.6.2 / 2.147.0 没有当前账号可用的远端执行入口，本用例标记阻塞；不要改用本地进程或 mock 顶替。

### WB-06 远端真实任务

1. 创建 Teammate 绑定 WB-05 的 Remote WorkBuddy 运行时。
2. 派发 Prompt-only 任务，描述要求：`只返回 WORKBUDDY_REMOTE_TASK_OK；不要请求本机文件`。
3. Task 运行中，平台应显示远端执行来源；用户不应把远端执行误解为本机执行。
4. 完成后，stdout 包含 `WORKBUDDY_REMOTE_TASK_OK`，Task 状态、执行历史和外部运行记录一致。
5. Review 行为与 WB-02 第 6 步一致。

### WB-07 远端真实工作流

1. 创建一个 Agent 节点绑定 Remote WorkBuddy Teammate 的工作流实例。
2. 派发后，工作流节点、Task 投影和执行历史都标识 Remote WorkBuddy。
3. 远端成功返回稳定标记后，仍必须依次满足交付物、Review、审批门禁。
4. 拒绝 Review 后节点不得前进；补交并通过后才能前进。
5. 若远端 Workspace 会同步文件，只允许它访问 `/tmp/workbuddy-gui-workspace`；用例结束时确认业务仓库没有新增文件。

### WB-08 远端认证/网络失败

1. 退出 WorkBuddy 官方远端登录态后派发 Prompt-only Task。
2. 平台应把执行标记为失败或需要登录，不得把 `Authentication required...` 当作业务成功。
3. 重新登录后重试，同一 Task 或新建 Task 应能完成。
4. 断开网络或使用官方产品明确无效的 Endpoint/Profile 后派发，执行应在可等待时间内失败，stderr 包含认证、DNS、超时或连接失败类原因。
5. 工作流对应节点不得前进；用户能看到重试、修正配置或转人工处理入口。
6. 恢复登录和网络后，平台不需要重启服务即可继续执行新派发。

### WB-09 权限与敏感信息

1. 分别用 Admin、Project Owner、Member 打开 WorkBuddy 运行时管理；权限行为与 EXT-01 一致。
2. 检查 Local 和 Remote 运行时的 Command、Args、探测记录、Task 详情和工作流执行历史，不得出现 token、API key、Cookie 或密码。
3. Prompt-only 用例尝试要求 WorkBuddy 读取用户业务仓库外层目录；平台项目 Workspace 应限制可见范围，WorkBuddy 不应返回业务仓库内容。
4. 文件写入只允许发生在 `/tmp/workbuddy-gui-workspace`；用例前后对比业务仓库 `git status`，不得出现 WorkBuddy 造成的变更。
5. 取消和失败日志中的命令行可以被审计，但不能包含凭据值。

## 5. 通过标准

1. `pnpm check` 全量通过。
2. EXT-01 到 EXT-10 全部通过。
3. 升级前创建的 Teammate、任务、工作流实例无需数据迁移即可继续使用。
4. 外部 Agent 成功结果不能绕过工作流交付物、Review 或审批。
5. 每个失败路径都有用户可读原因和可执行下一步。
6. 服务重启后，排队任务可恢复；运行中外部进程中断时标记为中断，不会假成功。
7. WB-01 到 WB-04 必须全部通过；WB-05 到 WB-08 在账号具备官方远端执行能力时必须全部通过，否则必须明确记录阻塞原因。
8. WB-09 必须通过。任何 WorkBuddy 输出、日志或审计记录中不得泄漏凭据。
9. 未登录 WorkBuddy 的零退出码输出不得被平台解释为任务成功；若发现该缺陷，真实 WorkBuddy 套件整体判失败。
