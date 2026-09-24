# 当前 GUI 测试设计：Global Shell / Task / Employee E2E

> 适用范围：`dsh-collab-shell`、`dsh-collab-task`、`dsh-collab-employee`、`dsh-collab-agent`、`dsh-collab-workflow`、`dsh-collab-meeting` 当前实现。
>
> 详细回归基线见 `docs/employee-platform-gui-test-plan.md`；本文用于当前版本的快速验收，不重复其全部 F1-F11。
>
> 环境说明（2026-09-24）：复用当前 `.tmp/dsh-home` 时，真实登录账号是 `admin / password-123`、`member / password-456`。当前没有 `workflow-owner / workflow-viewer`；截图里的登录失败就是切到了不存在的账号。

## 1. 目标

本轮测试回答三个问题：

1. 单点能力是否可用：全局导航、账号、员工目录、任务、工作流、会议、审批和治理入口。
2. 用户小闭环是否走通：任务派发与验收、角色认领、数字员工执行、数字员工入职后交付、会议分身报告、审批与治理追溯。
3. 失败是否可见且不越权：缺授权、缺 Runtime、员工暂停、非法审批、执行失败都不能被 UI 显示为成功。

当前边界：

1. `工作台 / 任务管理 / 工作流` 是全局页面；`会议` 是独立右侧栏。
2. 任务接收方 `DE / 分身` 当前只列 Digital Employee，不把 Human Avatar 当独立员工。
3. Digital Employee 无密码登录；任务派发依赖显式工作区授权、启用 Runtime Profile 和 Task Worker 映射。
4. Digital Employee 审批仍等待专用 runtime decision path，浏览器用户不能代签。
5. `by-role` 面板组合仍是预留，不计入失败。

## 2. 测试准备

### 2.1 资源与数据

| 资源 | 值 / 文件 | 用途 |
| --- | --- | --- |
| 仓库 | `/Users/oliviayang/Codex/一切皆插件/dsh-pluginmax` | 所有命令和相对路径的根目录 |
| 当前环境 | `.tmp/dsh-home`，通常运行在 `33124` | 已有账号和任务数据，不要直接删除 |
| 当前测试项目 | `.tmp/smoke-workspace` | 已注册；`<WS_ID>` 为 `00000000-0000-4000-8000-000000000001` |
| 全新环境 | `.tmp/dsh-home`，端口 `33118` | 仅在停止当前服务并重建时使用 |
| Profile A | `admin / password-123` | admin、创建员工、派发、验收 |
| Profile B | `member / password-456` | 工作区成员、执行人、审批人 |
| Profile C | `viewer / password-789` | guest、只读边界；当前环境需先在协作身份中创建 |
| 员工数据 | 通过 `AI Teammates` 动态创建 | 旧 `backend-01 / backend-runtime / backend-agent` 属于历史工作区，不能作为当前固定前置 |
| 工作流文件 | `docs/fixtures/workflow/employee-node.md` | 数字员工工作流闭环 |
| 工作流文件 | `docs/fixtures/workflow/employee-node-manual.md` | 手动派发与暂停边界 |
| 工作流文件 | `docs/fixtures/workflow/employee-approval.md` | 数字员工审批不可代签 |
| 工作流文件 | `docs/fixtures/workflow/agent-node-timeout.md` | 失败与人工兜底 |
| 交互参考 | `docs/demos/task-management-demo.html` | 看板、详情、会议侧栏的交互基准，不作为功能证据 |

执行前创建临时资料：

```sh
mkdir -p .tmp/gui-cases .tmp/gui-evidence
printf '%s\n' \
  '任务执行进展：已完成范围核对、接口联调和风险记录。' \
  > .tmp/gui-cases/task-progress.txt
printf '%s\n' \
  '评审目标：确认交付物门禁、审批边界和风险项。' \
  '禁止：代表主人审批或同意最终结论。' \
  > .tmp/gui-cases/avatar-brief.txt
```

### 2.2 Step by step 环境准备

| 步骤 | 操作 | 所需资料 / 文件 | 预期结果 |
| --- | --- | --- | --- |
| 0 | `cd /Users/oliviayang/Codex/一切皆插件/dsh-pluginmax` | 仓库路径 | `pwd` 与路径一致 |
| 1 | `corepack pnpm install --frozen-lockfile` | `pnpm-lock.yaml` | 依赖安装完成 |
| 2 | `corepack pnpm check` | 全部门禁 | typecheck、lint、test、build、contract、pack 全通过；当前实测基线为 12 个测试文件、144 个用例、11 个 plugin bundle，最终以命令实际输出为准 |
| 3 | 复用当前服务时跳过；全新环境才执行 `rm -rf .tmp/dsh-home && mkdir -p .tmp && ./scripts/install-profile.sh` | `scripts/install-profile.sh` | 安装 shell、identity、employee、space、roles、meeting、workflow、task、teammate、agent |
| 4 | 当前环境使用现有 `<ROOT_URL>`；全新环境启动 `vendor/deepseek-harness/apps/cli/lib/bin.js --profile pluginmax --no-open --port 33118`，`DSH_HOME="$PWD/.tmp/dsh-home"` | 上游已构建的 CLI | 终端输出带 token 的 `<ROOT_URL>` |
| 5 | 建立三个隔离 Chrome Profile，分别打开 `<ROOT_URL>` | Profile A/B/C | 三个账号的 token 不互相覆盖 |
| 6 | 当前环境直接用 `admin / password-123` 登录；全新环境在 Settings > 账号管理初始化 `admin` | 管理员账号数据 | 左下角账号显示 `Admin · 管理员` |
| 7 | 在 Settings > 协作身份创建或确认 `member / password-456`、`viewer / password-789` 并加入测试项目 | 基础数据表 | 工作区成员显示 admin / member / viewer |
| 8 | 当前环境复制 `00000000-0000-4000-8000-000000000001`；全新环境复制新项目 ID，并记录到 `.tmp/gui-evidence/ids.md` | 项目信息 icon | 后续所有 `<WS_ID>` 使用真实值，不手写 |

## 3. 单点功能测试

每个用例开始前清空 Console；结束后保存截图、Console 和对象 ID。

### F-01 全局 Shell

所需资料：一个项目、一个 Session。

1. 点击 `工作台`、`任务管理`、`工作流`、`AI Teammates`，确认四者互斥进入主内容区。
2. 点击 `会议`，确认右侧栏独立打开；再次点击关闭。
3. 点击项目树中的 Session，确认回到 Session 内容。
4. 刷新后重复切换。

预期：全局页不覆盖项目树和会议栏；刷新后路由和数据与当前账号一致；`管理` 模式未开放时 disabled；`AI Teammates` 是当前数字员工执行身份的 GUI 入口。

### F-02 账号管理

所需资料：Profile A/B/C。

1. 当前环境从左下角使用 `admin / password-123` 登录；不要尝试未创建的 `workflow-owner`。
2. 打开 Settings > 账号管理，检查当前账号、角色和登录表单。
3. 在 Settings > 协作身份创建 `member / password-456` 和 `viewer / password-789`，再加入测试项目。

预期：账号切换成功后，任务、员工和工作流重新加载；页面不残留上一账号数据；用户 ID 或密码错误时停留在切换弹窗并显示「用户 ID 或密码不正确」。

### F-03 员工目录与数字员工生命周期

所需资料：左侧 `AI Teammates`、当前测试项目。

1. Settings > 员工 > 目录确认 `Admin` 和 `Member` 为真人员工。
2. 打开 `AI Teammates` > `新建平台 Teammate`，名称填 `Backend Worker`，填写专业角色、基础说明和 SOUL，点击 `保存全局定义`。
3. 点击 `生效`，确认定义状态从 `草稿 / 已失效` 变为 `已生效`。
4. 在 `任务管理` 新建任务并指派给 `Backend Worker`；当前实现会自动开始执行，必要时再补发指令。
5. 回 `AI Teammates` > `定义态管理` > `执行身份`，确认自动生成 Agent Profile、Employee、Runtime Profile 和 Persona。
6. 记录生成的 Employee ID、Agent Profile ID 和 Runtime Profile；暂停、重启各一次；归档留到所有 E2E 完成后验证。

预期：`设置 > Agent` 已下线；执行身份在首次指派并触发任务时自动开通；暂停后新派发被拒绝；旧 `backend-01 / backend-runtime` 不再作为当前环境固定数据。

### F-04 任务看板

所需资料：至少一个项目；`.tmp/gui-cases/task-progress.txt`。

1. 打开 `任务管理`，检查四列：`待处理 / 进行中 / 待验收 / 已完成`。
2. 点击 `新建任务`，填写标题、类型、项目、P1-P3、初始状态、接收人、描述和验收标准。
3. 选择 `DE / 分身` 时检查 `完成后自动提交 Review`；默认勾选。
4. 使用项目、`全部派出方 / 我派出的 / 我接收的`、优先级、接收方和关键词过滤。
5. 打开任务详情，编辑内容、勾选验收项、添加评论、回复、上传附件和发送执行消息。

预期：看板、详情、进度和任务动态一致；无接收方时发送按钮 disabled；附件显示名称、大小和类型信息；自动提交 Review 开关影响 Agent 完成后的状态。

### F-05 真人任务执行与验收

所需资料：Profile A/B。

1. A 给 B 派发任务，验收标准写两条。
2. B 在 `我接收的` 打开任务，点击 `开始`。
3. B 发送执行消息并发起 `提交验收`。
4. A 先 `退回`，再填写评论；B 回复后重新提交，A 点击 `通过`。

预期：状态按 `待处理 → 进行中 → 待验收 → 进行中 → 待验收 → 已完成` 变化；只有通过后进度为 100%；事件保留操作人、时间和动作。

### F-06 角色任务认领

所需资料：一个配置了席位 / 角色的项目。

1. A 新建任务，接收人类型选择 `角色认领`，选择目标角色。
2. B 打开看板，确认卡片显示 `待认领（角色）`。
3. B 打开详情点击 `认领`。
4. A 刷新任务详情和任务动态。

预期：认领后接收方变为 B，状态进入 `进行中`；非角色任务不显示认领按钮；事件记录 `claimed`。

### F-07 数字员工任务执行

所需资料：F-03 已完成；`.tmp/gui-cases/task-progress.txt`。

1. A 新建任务，接收人类型选 `DE / 分身`，接收方选 F-03 创建的 `Backend Worker`。
2. 观察任务是否自动进入执行；如果没有，再在执行记录发送任务说明和附件内容。
3. 等待页面轮询刷新。
4. 检查执行消息、runId、运行状态、任务状态和左侧 Session 列表。
5. 若关闭了 `完成后自动提交 Review`，A 手动 `提交验收`；否则检查任务是否自动进入 `待验收`。最后执行 `通过`，或先 `退回`。

预期：AI 消息依次显示 `queued / running / succeeded` 或明确失败；任务由 `待处理` 进入 `进行中`；执行身份在首次指派并触发任务时自动生成；失败时显示可读原因；不创建左侧 Home Session。

### F-08 会议分身与报告

所需资料：`.tmp/gui-cases/avatar-brief.txt`。

1. 点击左侧 `会议`，创建 `GUI E2E 分身评审`。
2. 发送会议议程，点击 `+ 添加分身`，选择 Persona 并派遣。
3. 发送群发和 @分身消息。
4. Settings > 员工 > 分身委托执行暂停、恢复、延期、召回。
5. 关闭会议，展开分身报告。

预期：参与者区和消息区区分真人、数字员工、Human Avatar；暂停时不响应；关闭后生成独立报告；委托不进入员工目录。

### F-09 工作流员工执行与审批

所需资料：`employee-node.md`、`employee-node-manual.md`、`employee-approval.md`、`agent-node-timeout.md`。

1. 用 F-03 记录的 Employee ID 替换 `employee-node.md` 中的 `employee:backend-01`，导入并启动。
2. 检查执行者为 `Backend Worker · 数字员工`，等待派发和运行。
3. 检查必交交付物；为空时不能完成，满足后由 B 完成。
4. 用同一 Employee ID 替换 `employee-node-manual.md`，暂停 `Backend Worker` 后尝试派发。
5. 用同一 Employee ID 替换 `employee-approval.md`，分别用 A/B/C 检查审批入口。
6. 用 F-03 记录的 Agent Profile ID 替换 `agent-node-timeout.md` 中的 `agent:backend-agent`，等待超时后由 B 人工兜底。

预期：`设置 > Agent` 已下线，改用 `AI Teammates`；缺授权、缺 Runtime、员工暂停都被明确拒绝；数字员工审批无真人代签；Agent 超时不显示成功；人工兜底前必交交付物仍然生效。

### F-10 治理与响应式

所需资料：至少一次成功执行、一次拒绝、一份分身报告。

1. Settings > 员工 > 治理中心按 `<WS_ID>`、F-03 生成的 Employee ID、时间过滤。
2. 检查风险、活动时间线、权限矩阵、运行预算和报告中心。
3. Settings > 审计检查同一条拒绝记录。
4. 在 1280px、900px、390px 检查任务看板、员工表单、工作流实例和会议侧栏。

预期：能回答“谁、权限来源、做了什么、结果”；中文、employeeId、runId、ticketId 可搜索；无按钮遮挡、无双滚动条、Console 无未捕获异常。

## 4. E2E 用户小闭环

每个用例必须从正常入口开始，经由真实页面操作闭环，不直接用 API 造中间状态。只有“未来审批节点提前审批”回归使用 API 作为补充证据。

### E2E-01 真人任务派发、退回、补充和验收

闭环目标：A 派发任务，B 执行，A 退回，B 修订，A 验收通过。

| 角色 | 数据 / 文件 | 前置 |
| --- | --- | --- |
| A `admin` | 任务标题 `E2E-01 真人任务闭环` | B 已在项目成员中 |
| B `member` | 验收项：`完成范围核对`、`记录风险` | 附件 `task-progress.txt` |

| 步骤 | 操作 | 资料 / 文件 | 预期与证据 |
| --- | --- | --- | --- |
| 1 | A 打开任务管理 > 新建任务，选择人员 B，P1，两条验收标准 | 任务数据 | 卡片出现在 `待处理`，记录 TSK ID 和截图 |
| 2 | B 打开 `我接收的` > 任务 > 点击 `开始` | B 的 Profile | 状态进入 `进行中`；事件记录 B 开始处理 |
| 3 | B 上传 `task-progress.txt`，发送执行消息 | 本地附件 | 执行记录出现附件和消息 |
| 4 | B 勾选第一条验收项并点击 `提交验收` | 验收项 | 状态进入 `待验收`，进度不低于 86%，未到 100% |
| 5 | A 点击 `退回`，添加评论 `缺少风险项` | 评论文本 | 状态回 `进行中`；评论和任务动态保留 |
| 6 | B 回复评论，勾选第二条验收项，重新提交 | 回复文本 | 评论出现回复；状态回 `待验收` |
| 7 | A 点击 `通过` | 任务详情 | 状态为 `已完成`，进度 100%，所有验收项勾选 |
| 8 | A 刷新看板、详情和治理中心 | 对象 ID | 状态不丢失，事件可按 TSK ID 追溯 |

完成判定：整个流程不跳状态、不静默失败，刷新后结果一致。

### E2E-02 角色任务认领

闭环目标：任务先派给角色，由具备该角色的成员认领并开始执行。

| 步骤 | 操作 | 资料 / 文件 | 预期与证据 |
| --- | --- | --- | --- |
| 1 | A 新建任务，接收人类型选 `角色认领`，选择 B 所属角色 | 角色配置 | 卡片显示 `待认领（角色）` |
| 2 | C 打开同项目任务 | Profile C | C 不具备该角色时不能认领 |
| 3 | B 打开详情，点击 `认领` | B 的 Profile | 接收方变为 B，状态进入 `进行中` |
| 4 | B 刷新并打开任务动态 | 任务 ID | `claimed` 事件包含 B、角色和项目 |

完成判定：认领后角色接收方被具体成员替换，其他成员不能重复认领。

### E2E-03 数字员工任务执行闭环

闭环目标：A 派发数字员工任务，任务运行结果进入执行记录，再由 A 验收关闭。

| 角色 | 数据 / 文件 | 前置 |
| --- | --- | --- |
| A `admin` | AI Teammate `Backend Worker`、任务 `E2E-03 数字员工执行` | F-03 已完成，执行身份已自动开通 |

| 步骤 | 操作 | 资料 / 文件 | 预期与证据 |
| --- | --- | --- | --- |
| 1 | A 新建任务，接收人类型 `DE / 分身`，选择 `Backend Worker`，保留 `完成后自动提交 Review` | 任务数据 | 卡片成功创建，接收方显示数字员工，并自动开始执行 |
| 2 | 打开详情；若自动执行未发生，再发送 `请输出实现进展、风险和下一步` 和附件 | `task-progress.txt` | 消息进入执行记录，任务状态进入 `进行中` |
| 3 | 等待页面轮询 | 任务详情 | 消息状态出现 `queued / running`，最终 `succeeded` 或明确失败；成功且开关开启时自动进入 `待验收` |
| 4 | 展开执行消息并复制 runId | runId | runId 与执行消息、任务动态关联 |
| 5 | A 检查左侧 Session 列表 | 全局 Shell | 不新增数字员工 Home Session |
| 6 | A 点击 `提交验收`，再 `通过` | 验收标准 | 任务完成；执行结果、通过动作和员工身份均可追溯 |
| 7 | 暂停 `Backend Worker`，对另一任务再次发送指令 | AI Teammates | 执行记录显示明确失败原因，不显示成功 |

完成判定：任务状态和执行状态分离且都正确；失败可见；数字员工不伪装成真人会话。

### E2E-04 数字员工入职并完成工作流交付

闭环目标：管理员创建可执行数字员工，工作流自动派发，责任人确认交付物。

| 步骤 | 操作 | 资料 / 文件 | 预期与证据 |
| --- | --- | --- | --- |
| 1 | A 在 `AI Teammates` 新建平台 Teammate `Backend Worker`，填写定义并保存 | 定义数据 | Teammate 从草稿发布为 v1.0 |
| 2 | A 点击 `生效` | AI Teammates | 定义状态为 `已生效` |
| 3 | A 在任务管理指派任务；系统自动开始执行并开通身份，必要时补发指令 | 任务数据 | 自动生成 Employee、Agent Profile 和 Runtime Profile |
| 4 | A 用生成的 Employee ID 替换 `employee-node.md` 后导入并启动 `E2E-04 员工交付` | Fixture 副本 | 开发节点执行者为数字员工，自动派发 |
| 5 | 等待运行结束，检查运行记录和交付物 | runId、ticketId | 成功输出进入交付物；失败有原因 |
| 6 | B 打开实例，确认为责任人 | Profile B | 必交交付物满足前不能完成 |
| 7 | B 补充并提交 `实现说明`，点击完成 | 交付物文本 | 节点完成，流程推进 |
| 8 | A 检查治理中心和工作台节点面板 | 实例 ID | 能追溯员工、run、ticket、交付物和完成人 |

完成判定：创建、授权、运行时映射、工作流派发、交付物门禁和责任人确认形成闭环。

### E2E-05 会议分身产生报告

闭环目标：真人在会议中派分身，约束其行为，会后取得报告。

| 步骤 | 操作 | 资料 / 文件 | 预期与证据 |
| --- | --- | --- | --- |
| 1 | A 打开会议侧栏，创建 `E2E-05 分身评审` | 会议标题、`<WS_ID>` | 会议创建并保持选中 |
| 2 | A 发送议程 `确认交付物门禁和审批边界` | 会议消息 | 消息进入转录 |
| 3 | A 点击 `+ 添加分身`，选择 Persona | Persona | 参与者显示 `Workflow Owner 的分身` |
| 4 | A 粘贴 `avatar-brief.txt` 的内容到会议消息，@分身要求记录风险 | 本地文件内容 | 分身按委托范围响应，消息标识 Human Avatar |
| 5 | A 在员工 > 分身委托执行暂停、恢复、召回 | 委托 ID | 暂停时不响应，恢复后可用，召回后停止 |
| 6 | A 关闭会议 | 会议详情 | 生成独立报告 |
| 7 | A 在委托详情、治理报告中心和会议报告面板展开报告 | 报告关键词 | 三处为同一报告，包含结论、风险、待确认和信息缺口 |
| 8 | A 搜索员工目录 | 分身显示名 | 分身不进入员工目录 |

完成判定：分身委托、行为边界、状态变化、报告和目录隔离全部可追溯。

### E2E-06 审批失败可见且不越权

闭环目标：真人审批可完成，非审批人不能代签，未来节点不能提前审批，否决必须持久化，数字员工审批等待专用运行通道。

| 步骤 | 操作 | 资料 / 文件 | 预期与证据 |
| --- | --- | --- | --- |
| 1 | A 导入 `sub-process.md` 并启动 `E2E-06 审批闭环` | Fixture 文件 | 架构评审 ready，安全复核仍 waiting |
| 2 | 架构评审尚未通过时，通过 GUI 或 API 尝试审批安全复核 | 实例 ID、节点 ID | 请求被拒绝，不产生审批记录 |
| 3 | A 打开架构评审并通过 | Profile A | 节点通过并推进到安全复核 |
| 4 | B 打开安全复核，填写否决理由并点击 `否决` | `交付说明缺少风险项` | 状态、原因、操作人、时间持久化；刷新不丢 |
| 5 | A/C 打开同一安全复核 | 隔离 Profile | 非审批人只读，无可用操作按钮 |
| 6 | A 导入 `employee-approval.md` 并启动 | Fixture 文件 | 节点显示等待专用 runtime decision path |
| 7 | A/B/C 分别查找数字员工审批按钮 | 三个 Profile | 没有任何浏览器用户可代签 |
| 8 | A 打开治理中心和审计过滤实例 | 实例 ID | 能看到审批引用、当前等待原因、拒绝结果或审计事件 |

完成判定：审批失败有显性反馈；否决不静默；权限边界和数字员工等待态通过。

## 5. 证据与通过标准

每个用例保存：

```text
.tmp/gui-evidence/<CASE-ID>/summary.md
.tmp/gui-evidence/<CASE-ID>/console.txt
.tmp/gui-evidence/<CASE-ID>/ids.md
.tmp/gui-evidence/<CASE-ID>/*.png
```

`summary.md` 最少记录：

1. 用例、日期、执行人、`<ROOT_URL>`；
2. 账号和 `<WS_ID>`；
3. 测试数据、文件和对象 ID；
4. 每步实际结果；
5. 失败时的 Console、服务日志和截图。

通过条件：

1. F-01 到 F-10 全部通过，或失败已明确标记为阻塞 / 非阻塞；
2. E2E-01 到 E2E-06 全部闭环；
3. `corepack pnpm check` 通过；
4. 无隐式授权、无真人代签数字员工审批、无暂停员工继续派发；
5. 所有失败有可读提示，刷新后状态一致；
6. Console 无未捕获异常，关键页面无遮挡和双滚动条。

## 6. 清理

1. 当前环境不要停止共享的 33124 服务；仅停止本次自行启动的 33118 隔离服务。
2. 删除 `.tmp/gui-cases`、`.tmp/gui-evidence` 和临时测试项目。
3. 若需要复跑，删除 `.tmp/dsh-home` 后重新执行 `./scripts/install-profile.sh`。
4. 不修改 `docs/fixtures/workflow/` 原文件；变体只保存在临时目录。
