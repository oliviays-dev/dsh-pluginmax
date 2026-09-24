# 工作流 GUI 测试方案（从零执行）

> 目标：从空环境开始，验证当前全局 Shell 下的工作流导入、启动、审批、交付物、Agent / Digital Employee 派发、分支、子流程、权限和治理闭环。
>
> 参考：`docs/workflow-md-guide.md`、`docs/workflow-gui-test-plan.md`、`docs/workflow-agent-gui-test-plan.md`、`docs/gui-test-design-task-e2e.md`。
>
> 环境说明（2026-09-24）：复用当前 `.tmp/dsh-home` 时，真实登录账号是 `admin / password-123`、`member / password-456`，当前没有 `workflow-owner` 或 `workflow-viewer`。不要直接切到不存在的账号；先按 1.3 创建账号，或按 1.2 走全新隔离环境。

## 0. 本轮先跑什么

如果只做一轮高性价比回归，执行以下集合：

1. 自动门禁：`corepack pnpm check`。
2. 自动专项：工作流、Agent、Employee 三个测试文件，共覆盖解析、审批、派发、票据和生命周期。
3. GUI 最小集：`WF-01`、`WF-02`、`WF-04`、`WF-06`、`WF-09`、`WF-11`。
4. E2E 最小集：`E2E-WF-01`、`E2E-WF-02`、`E2E-WF-04`。
5. 基于上一版 `gui-test-design-task-e2e.md` 的必跑映射：`F-09`、`E2E-04`、`E2E-06`；建议加跑 `F-01`、`F-03`、`F-10`。

任务管理中的 `F-04` 至 `F-07`、`E2E-01` 至 `E2E-03` 和会议 `F-08` / `E2E-05` 本轮可不跑，除非要额外检查任务、会议与工作流的跨模块入口。

## 1. 从零准备

### 1.1 账号与测试资源

| 项目 | 值 / 文件 | 说明 |
| --- | --- | --- |
| 仓库根目录 | `/Users/oliviayang/Codex/一切皆插件/dsh-pluginmax` | 所有命令在这里执行 |
| 当前环境 | `.tmp/dsh-home`，服务端口通常为 `33124` | 已有数据；不要直接删除 |
| 当前测试项目 | `.tmp/smoke-workspace` | 已在当前环境中注册，`<WS_ID>` 为 `00000000-0000-4000-8000-000000000001` |
| 全新隔离环境 | `.tmp/dsh-home`，端口 `33118` | 仅在没有其他服务使用时重建 |
| 全新测试项目 | `.tmp/gui-workflow-workspace` | 先用 `mkdir -p` 创建，再在 UI 添加 |
| Profile A | `admin / password-123` | 全局 admin；当前环境中已存在 |
| Profile B | `member / password-456` | 工作区执行人；当前环境中已存在 |
| Profile C | `viewer / password-789` | guest；当前环境中需按 1.3 创建 |
| 基础工作流 | `docs/fixtures/workflow/gui-from-zero.md` | 人工审批、交付物、二次审批、服务节点 |
| 并行工作流 | `docs/fixtures/workflow/product-delivery-v2.md` | 当前文件内版本为 `v6`，并行与汇合 |
| Agent 工作流 | `docs/fixtures/workflow/agent-node.md`、`agent-manual.md` | 自动 / 手动派发、取消和重试 |
| 失败兜底 | `docs/fixtures/workflow/agent-node-timeout.md` | 1 秒超时转人工 |
| Digital Employee | `docs/fixtures/workflow/employee-node.md`、`employee-approval.md` | 员工执行与审批边界 |
| 循环 / 子流程 | `docs/fixtures/workflow/controlled-loop.md`、`sub-process.md`、`parent-child.md` | 否决回边、break、判断和子流程 |
| 非法模板 | `docs/fixtures/workflow/invalid-cycle.md` | 死循环必须拒绝 |
| 交互参考 | `docs/demos/task-management-demo.html` | 只参考布局和交互，不作为通过证据 |

### 1.2 环境启动

| 步骤 | 操作 | 所需资料 | 预期 |
| --- | --- | --- | --- |
| 1 | 复用当前 `33124` 服务时，跳到 1.3；需要全新环境时继续 | 当前 `<ROOT_URL>` | 不删除正在使用的 `.tmp/dsh-home` |
| 2 | `cd /Users/oliviayang/Codex/一切皆插件/dsh-pluginmax` | 仓库路径 | `pwd` 正确 |
| 3 | 全新环境先停止占用 `33124` 的服务，再执行 `./scripts/bootstrap.sh` | Git submodule、`pnpm-lock.yaml` | 插件和锁定版 DSH 安装、构建完成 |
| 4 | `./node_modules/.bin/vitest run` 或 `corepack pnpm check` | 已安装依赖 | 全量测试通过；当前实测为 12 个测试文件、144 个用例 |
| 5 | `rm -rf .tmp/dsh-home .tmp/gui-workflow-workspace && mkdir -p .tmp/gui-workflow-workspace` | 本地临时目录 | 仅全新环境执行，清理旧数据 |
| 6 | `./scripts/install-profile.sh` | `scripts/install-profile.sh` | 安装 shell、identity、employee、roles、meeting、workflow、task、teammate、agent |
| 7 | `DSH_HOME="$PWD/.tmp/dsh-home" node vendor/deepseek-harness/apps/cli/lib/bin.js --profile pluginmax --no-open --port 33118` | 已构建的 DSH CLI | 输出带 token 的 `<ROOT_URL>` |

服务重启后必须重新复制最新 `<ROOT_URL>`，旧 token 不能继续使用。

### 1.3 账号和工作区初始化

1. 建立三个独立 Chrome Profile：`Workflow A/B/C`，分别打开最新 `<ROOT_URL>`。
2. 复用当前环境时，Profile A 使用 `admin / password-123` 登录。全新环境时，在 Settings > `账号管理` 初始化同一账号。
3. 当前环境使用已注册的 `.tmp/smoke-workspace`。全新环境创建 `.tmp/gui-workflow-workspace`，在左侧项目区添加并记录真实 `<WS_ID>`。
4. Settings > `协作身份` > `用户管理` 确认或创建：
   - `member / Member / password-456 / member`
   - `viewer / Viewer / password-789 / guest`
5. Settings > `协作身份` > `工作区成员` 设置：
   - `admin`：`owner`
   - `member`：`member`
   - `viewer`：`guest`
6. Profile B 使用 `member / password-456` 登录；Profile C 使用 `viewer / password-789` 登录。
7. Settings > `员工` > `目录` 确认三个真人员工自动映射，类型为「真人员工」。

如果左下角已经显示 `Admin`，说明当前环境已经初始化。不要再初始化或尝试切换到一个不存在的账号；先在 `协作身份 > 用户管理` 创建所需账号，再通过左下角 `切换账号` 登录。

预计结果：左下角显示当前账号；切换账号后任务、工作流和员工数据同步刷新；guest 不获得管理入口。

### 1.4 工作流文档

本轮的基本测试文档是 `docs/fixtures/workflow/gui-from-zero.md`，内容如下：

```md
# 工作流：GUI 从零验收

## 元信息

- key: gui-from-zero
- version: 1
- description: 从零验证审批、人工交付物门禁、二次审批和服务节点

## 节点

### 需求确认

- id: requirement-confirmation
- type: approval
- executor: user:admin
- approver: 用户:admin
- policy: any

### 开发与交付

- id: development
- type: task
- executor: user:member
- responsible: user:member
- description: 提交满足字数要求的实现说明
- deliverable: implementation-report
  title: 实现说明
  type: text
  required: true
  min-text-length: 20
  description: 说明实现范围、验证结果和已知风险

### 发布审批

- id: release-approval
- type: approval
- executor: user:admin
- approver: 用户:admin
- policy: any

### 发布

- id: release
- type: service
- executor: system:deployment

## 连接

- requirement-confirmation -> development
- development -> release-approval
- release-approval -> release
```

完整语法以 `docs/workflow-md-guide.md` 为准。重点检查：

1. `## 元信息`、`## 节点`、`## 连接` 各出现一次。
2. `key + version` 决定模板版本，同版本不可重复导入。
3. `user:` 后的 ID 必须是当前工作区成员。
4. `deliverable` 的子属性保留两空格缩进。
5. `required: true` 的交付物未提交时不能完成节点。
6. `execution: task-worker` 与 `trigger: auto-on-ready` 同时存在才会自动派发。
7. Digital Employee 必须先启用、授权并映射 Runtime Profile。
8. 所有循环必须包含 `break`。

现有 fixtures 中的 `workflow-owner / workflow-member` 是旧示例身份，和当前 `.tmp/dsh-home` 不一致。复用当前环境时，先复制到 `.tmp/gui-cases/`，再把 `workflow-owner` 替换为 `admin`、`workflow-member` 替换为 `member`，然后导入副本。`gui-from-zero.md` 已经改为可直接导入的 `admin / member`。

## 2. 自动化测试运行清单

### 2.1 全量门禁

```sh
corepack pnpm check
```

当前实测基线：`12` 个测试文件、`144` 个用例、`11` 个 plugin bundle；以本次命令实际输出为准。

### 2.2 工作流专项

```sh
corepack pnpm test -- \
  plugins/dsh-collab-workflow/src/index.test.ts \
  plugins/dsh-collab-agent/src/index.test.ts \
  plugins/dsh-collab-employee/src/index.test.ts \
  plugins/dsh-collab-teammate/src/index.test.ts \
  plugins/dsh-collab-teammate/src/runtime.test.ts
```

本次直接执行 Vitest 的结果为 `5 passed` 个测试文件、`77 passed` 个用例。

如果 `corepack pnpm` 因网络或依赖状态检查阻塞，而 `node_modules/.bin/vitest` 已存在，可直接执行：

```sh
./node_modules/.bin/vitest run \
  plugins/dsh-collab-workflow/src/index.test.ts \
  plugins/dsh-collab-agent/src/index.test.ts \
  plugins/dsh-collab-employee/src/index.test.ts \
  plugins/dsh-collab-teammate/src/index.test.ts \
  plugins/dsh-collab-teammate/src/runtime.test.ts
```

必须确认以下测试通过：

| 范围 | 测试用例 |
| --- | --- |
| Workflow 解析 | `parses parallel branches, approvals, and controlled cycles`、`rejects an uncontrolled cycle`、`parses Agent execution and runtime limits` |
| Workflow 实例 | `imports, archives previous versions, and starts an instance`、`runs parallel nodes through a join and approval` |
| 审批门禁 | `rejects decisions on a future approval node that is still waiting`、`supports delegation and countersign` |
| 交付物 | `rejects a deliverable and requires a new submission`、`does not accept an agent reply without the required delivery section` |
| 分支和循环 | `blocks a controlled loop when break becomes true`、`reactivates a completed node after a controlled rejection`、`starts and completes a sub-workflow` |
| Agent 派发 | `auto-dispatches a ready Agent node and maps output to the delivery gate`、`allows the responsible user to recover a timed-out agent node manually`、`supports manual dispatch, cancellation, retry, permissions, and attempt cap` |
| Employee 派发 | `dispatches employee nodes through mapped runtime and preserves the principal`、`recovers an employee node after an automatic ticket failure`、`reports a suspended employee as the manual dispatch blocker` |
| AI Teammates | `creates a personal draft and promotes it on first save`、`restricts platform definitions to administrators`、`provisions one runtime identity and reuses it for later tasks`、`refuses to dispatch a teammate that is not active` |
| 接口边界 | `requires same origin and a valid bearer token`、`blocks non-manager import`、`rejects a member of another workspace` |

### 2.3 只跑关键用例

时间不足时使用：

```sh
corepack pnpm test -- plugins/dsh-collab-workflow/src/index.test.ts \
  -t "parses parallel branches|rejects an uncontrolled cycle|imports, archives|runs parallel nodes|rejects decisions on a future approval|rejects a deliverable|supports delegation|blocks a controlled loop|starts and completes a sub-workflow|auto-dispatches|dispatches employee|reports a suspended employee"
```

## 3. 单点 GUI 用例

### WF-01 入口、权限和登录

所需资料：Profile A/B/C。

1. A/B/C 分别打开左侧 `工作流`。
2. A 点击 `模板管理`。
3. B 点击 `模板管理`，C 尝试打开工作流页。

预期：A（owner/admin）可导入和启停模板；B 可查看但导入按钮不可用；C 不能发起流程。未登录时提示先在账号管理登录。

### WF-02 导入、校验和图形检查

所需资料：`gui-from-zero.md`、`product-delivery-v2.md`、`invalid-cycle.md`。

1. A 打开 Settings > `工作流`，选择 `<WS_ID>`。
2. 导入 `gui-from-zero.md`，勾选 `保存后启用`，先 `校验` 再 `保存新版本`。
3. 导入 `product-delivery-v2.md`，确认模板显示为 `产品交付 v6`。
4. 导入 `invalid-cycle.md`，尝试保存。

预期：基础模板无 error，图形显示四个节点；并行模板显示需求评审、开发、测试准备、发布审批、发布；非法死循环出现 `cycle requires a break condition` 且不落库。

### WF-03 启动和工作区 / 会话范围

所需资料：已启用的 `GUI 从零验收 v1`。

1. B 打开一个会话，进入全局 `工作流`。
2. 选择 `GUI 从零验收 v1`，标题填 `WF-03 基础交付`，点击 `启动`。
3. 切换 `只看当前会话 / 查看工作区全部`。

预期：实例创建成功；当前会话过滤和全部工作区过滤数量正确；切换账号不会显示其他工作区实例。

### WF-04 人工交付物门禁

所需资料：`WF-03 基础交付`。

1. A 展开 `需求确认`，点击 `通过`。
2. B 展开 `开发与交付`，不填交付物直接点击 `完成`。
3. 输入少于 20 字的文本，尝试提交。
4. 输入至少 20 字的实现说明，点击 `提交交付物`，再点击 `完成`。

预期：没有交付物时按钮显示 `缺少 1 项交付物`；字数不足不能提交；提交后状态为 `已提交`，节点可完成并进入发布审批。

### WF-05 否决、返工和受控循环

所需资料：`controlled-loop.md`。

1. A 导入并启动 `受控返工流程`。
2. A 完成 `需求确认`。
3. B 进入 `测试` 节点，连续执行否决，观察回边次数。
4. 达到 `attempts >= 3` 后再次否决。

预期：前两次否决回到 `开发`；达到 break 后目标节点阻塞，后续 `发布就绪` 不 ready；节点显示尝试上限和触发条件。

### WF-06 并行、汇合与多人审批

所需资料：`product-delivery-v2.md`。

1. B 启动 `WF-06 并行交付`。
2. B 通过 `需求评审`，确认 `开发` 和 `测试准备` 同时 ready。
3. B 完成 `开发` 的人工交付物并完成节点，再完成 `测试准备`。
4. A 和 B 分别对 `发布审批` 点击 `通过`。
5. A 完成 `发布` 服务节点。

预期：开发或测试任一支路未完成时发布审批不 ready；`policy: all` 下第一位通过后仍等待；两人通过后发布 ready；发布完成后实例完成。

### WF-07 审批转交、加签、未来节点

所需资料：`sub-process.md`、`product-delivery-v2.md`。

1. 启动 `complex-review`，确认第一阶段只有 `架构评审` ready。
2. 在 `安全复核` 仍 waiting 时尝试审批。
3. A 通过 `架构评审`。
4. 对 `安全复核` 执行转交或加签，再完成审批。

预期：未来审批节点拒绝操作且不产生记录；转交后原审批人不能继续操作；加签后必须新增审批人完成；事件保留转交 / 加签来源。

### WF-08 判断、子流程和服务节点

所需资料：`sub-process.md`、`parent-child.md`。

1. 先完成 WF-09 第 1-3 步，记录动态 Agent Profile ID。
2. 把两个 fixture 复制到 `.tmp/gui-cases/`；把 `workflow-owner` 替换为 `admin`、`workflow-member` 替换为 `member`，并把 `agent:backend-agent` 替换为记录到的 Profile ID。
3. A 先导入并启用子流程副本，再导入父流程副本。
4. 启动父流程 `WF-08 复杂方案`，录入 `{"complexity": 8}`。
5. 完成子流程两个审批。
6. 再启动 `WF-08 标准方案`，录入 `{"complexity": 3}`。
7. 完成标准开发和服务节点。

预期：高分实例创建并回写子流程；低分实例跳过子流程；父流程在子流程完成后继续；两个实例都最终完成。

### WF-09 Agent 自动 / 手动派发和失败兜底

所需资料：`agent-node.md`、`agent-manual.md`、`agent-node-timeout.md`。

1. A 打开左侧 `AI Teammates` > `新建平台 Teammate`，创建 `Backend Worker`，填写专业角色、基础说明和 SOUL，点击 `保存全局定义`，再点击 `生效`。
2. 在 `任务管理` 新建一个测试任务并指派给 `Backend Worker`。当前实现会自动开始执行，并在首次指派 / 触发时自动开通 Agent Profile、Employee、Runtime Profile；仅在未自动启动时才补发指令。
3. 回到 `AI Teammates` 的 `定义态管理` > `执行身份`，记录生成的 `Agent Profile ID`。
4. 把 `agent-node.md` 复制到 `.tmp/gui-cases/`，将 `executor: agent:backend-agent` 替换为记录到的 Profile ID，导入并启动，确认自动派发。
5. 检查 Agent 运行区域、trigger、runSeq、prompt 摘要、运行状态和交付物。
6. 用同样方式修改 `agent-manual.md`，启动后手动点击 `派发 Agent`；在运行中点击 `取消运行`，随后重试。
7. 用同样方式修改 `agent-node-timeout.md`，等待超时，由 B 人工代交。
8. 另启动一次任务，在运行中重启 `33125` 服务，使用新 token 打开页面并展开实例。

预期：`设置 > Agent` 已下线，不再作为入口；AI Teammates 在首次指派并触发任务时会开通执行身份；自动派发不需要点击；取消、失败、超时都不显示成功；输出未满足交付要求时节点 blocked；责任人可人工代交，owner/admin 可越过重试上限；服务重启后被中断的运行显示可读原因，节点进入阻塞并同时提供 `重新派发` 与人工交付入口，点击重新派发后创建 `runSeq + 1` 的新运行。

### WF-10 Digital Employee 派发、票据和暂停

所需资料：`employee-node.md`、`employee-node-manual.md`、`employee-approval.md`；WF-09 已生成的执行身份。

1. 在 WF-09 的 `执行身份` 区域记录生成的 `Employee ID`；不要固定使用旧数据中的 `backend-01`。
2. 把 `employee-node.md` 复制到 `.tmp/gui-cases/`，将 `employee:backend-01` 替换成实际 Employee ID，导入并启动，确认执行者显示 AI Teammate 名称和数字员工身份。
3. 检查 run 的 employeeId、principalType、ticketId 和输出是否进入交付物。
4. 在 `AI Teammates` 暂停该 Teammate，或停用它的执行身份，再用替换后的 `employee-node-manual.md` 尝试派发。
5. 用相同替换方式处理 `employee-approval.md`，用 A/B/C 检查审批。

预期：旧 `backend-01 / backend-runtime` 属于历史工作区，不能再作为当前环境的固定前置；满足授权、Runtime 和映射后才派发；暂停员工派发失败；输出被 deny 时节点 blocked 而不是成功；数字员工审批只能等待 runtime decision path，浏览器用户不能代签。

### WF-11 权限、刷新和 Console

所需资料：Profile A/B/C，以及一个已完成、一个阻塞实例。

1. B 打开 Settings > 工作流，确认只能查看模板。
2. C 尝试直接打开其他工作区实例。
3. A 刷新工作流列表、节点详情和治理中心。
4. 每个 Profile 检查 Console。

预期：非 owner/admin 不能导入、启停模板；跨工作区不可读；刷新后 run、交付物、审批和节点状态不丢失；Console 无未捕获异常。

## 4. E2E 工作流闭环

### E2E-WF-01 人工审批与交付闭环

使用 `gui-from-zero.md`，由 A 启动和终审，B 执行交付。

| 步骤 | 操作 | 资料 / 文件 | 预期 |
| --- | --- | --- | --- |
| 1 | A 导入并启用模板 | `gui-from-zero.md` | 四节点图形和版本正确 |
| 2 | A 启动 `E2E-WF-01` | `<WS_ID>` | 需求确认 ready |
| 3 | A 通过需求确认 | 审批意见可选 | 开发与交付 ready |
| 4 | B 提交有效实现说明并完成 | 不少于 20 字 | 发布审批 ready |
| 5 | A 通过发布审批并完成发布 | 实例 ID | 实例 completed |
| 6 | A/B 刷新治理和审计 | 实例 ID | 节点、交付物、审批、完成人一致 |

通过标准：交付物门禁不可绕过；每一步都有事件；刷新后状态一致。

### E2E-WF-02 Agent 交付闭环

使用 `agent-node.md` 和 AI Teammates 自动生成的 Agent Profile。

| 步骤 | 操作 | 资料 / 文件 | 预期 |
| --- | --- | --- | --- |
| 1 | A 先创建并生效 AI Teammate，记录 Profile ID，再替换并导入 Agent 流程 | `agent-node.md` 副本 | 节点 ready 后自动派发 |
| 2 | 检查 Agent 运行 | run 详情 | trigger 为自动，状态最终 succeeded / failed / timeout |
| 3 | 检查交付物 | 运行输出 | 满足门禁后进入待确认，不能自动借运行成功跳过 gate |
| 4 | B 作为责任人确认完成 | 交付物 | 节点完成并推进 |
| 5 | A 查看治理中心 | instanceId、runId | 能追溯 Agent、ticket、输出和确认人 |

通过标准：运行状态、交付物状态和节点状态三者可区分且一致。

### E2E-WF-03 受控返工闭环

使用 `controlled-loop.md`。

| 步骤 | 操作 | 资料 / 文件 | 预期 |
| --- | --- | --- | --- |
| 1 | A 启动受控返工流程 | `controlled-loop.md` | 确认节点 ready |
| 2 | A 完成需求确认，B 否决测试 | 审批意见 | 开发重新 ready，attempts 增加 |
| 3 | 重复否决直到第三轮 | 运行记录 | 每轮回边有事件 |
| 4 | 第三次否决 | break 条件 | 目标节点 blocked，发布就绪不 ready |
| 5 | A 查看治理和事件 | 实例 ID | 能看出触发条件和阻断原因 |

通过标准：只允许已声明 break 的回边；阻断后没有静默完成或继续推进。

### E2E-WF-04 Digital Employee 工作流闭环

使用 `employee-node.md` 和 AI Teammates 自动生成的 Digital Employee。

| 步骤 | 操作 | 资料 / 文件 | 预期 |
| --- | --- | --- | --- |
| 1 | A 创建平台 AI Teammate，保存定义并生效 | AI Teammates 页面 | 定义状态为 `已生效` |
| 2 | A 先通过测试任务指派 Teammate，确认执行身份开通，记录 Employee ID，并替换 `employee:backend-01` 后导入 | `employee-node.md` 副本 | 执行者显示数字员工，节点派发 |
| 3 | 检查 agent run | employeeId、ticketId | 运行身份为 Digital Employee |
| 4 | 暂停员工后重试派发 | Settings > 员工 | 派发被拒绝并显示暂停原因 |
| 5 | 恢复员工并重试 | Runtime | 新 run 签发，成功输出进入交付物 |
| 6 | B 确认交付物并完成节点 | 实现说明 | 流程推进，审计可追溯 |

通过标准：暂停 / 恢复、Action Ticket、deny-wins、交付物门禁和责任人确认全部生效。

## 5. 与上一版方案的执行映射

基于 `docs/gui-test-design-task-e2e.md`，本轮选择如下：

| 上一版用例 | 本轮是否运行 | 原因 |
| --- | --- | --- |
| `F-01` 全局 Shell | 建议运行 | 确认工作流位于全局导航且不破坏 Session |
| `F-03` 员工生命周期 | 必跑 | `WF-10`、`E2E-WF-04` 的前置 |
| `F-09` 工作流员工执行与审批 | 必跑 | 本轮核心 |
| `F-10` 治理与响应式 | 建议运行 | 检查 run、ticket、拒绝和报告追溯 |
| `E2E-04` 员工入职并完成工作流交付 | 必跑 | 与 `E2E-WF-04` 对应 |
| `E2E-06` 审批失败可见且不越权 | 必跑 | 覆盖未来节点、否决和数字员工审批 |
| `F-02`、`F-04` 至 `F-08`、`F-11` | 可选 | 主要覆盖账号、任务、会议、响应式，不属于工作流主链路 |
| `E2E-01` 至 `E2E-03`、`E2E-05` | 本轮不跑 | 任务 / 会议专项；需要跨模块回归时再执行 |

## 6. 证据和通过标准

保存：

```text
.tmp/gui-evidence/workflow/<CASE-ID>/summary.md
.tmp/gui-evidence/workflow/<CASE-ID>/console.txt
.tmp/gui-evidence/workflow/<CASE-ID>/ids.md
.tmp/gui-evidence/workflow/<CASE-ID>/*.png
```

`ids.md` 至少记录：

1. `<WS_ID>`、definitionId、instanceId、nodeId、runId、ticketId；
2. 每个测试账号和 Profile；
3. 导入文件的路径和版本；
4. 审批、否决、派发、取消、重试、完成的实际时间。

通过标准：

1. `corepack pnpm check` 通过；
2. 工作流、Agent、Employee 自动专项通过；
3. `WF-01`、`WF-02`、`WF-04`、`WF-06`、`WF-09`、`WF-11` 通过；
4. `E2E-WF-01`、`E2E-WF-02`、`E2E-WF-04` 完成闭环；
5. 未来审批不可提前、必交交付物不可绕过、暂停员工不可派发、Agent 失败不可显示成功；
6. 刷新后 run、ticket、交付物、审批和节点状态一致；
7. Console 无未捕获异常。
