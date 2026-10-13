# 外部 Agent 模块 GUI 端到端测试方案

> 目标：从真实页面入口出发，验证外部 Agent 运行时的注册、探测、启停、Teammate 绑定、任务派发、工作流交付物门禁、失败恢复和权限边界。
>
> 适用范围：`AI Teammates > 外部 Agent 管理`、`AI Teammate 管理`、任务管理，以及外部 Agent 参与的工作流实例。
>
> 参考设计：`docs/external-agent-teammates-technical-design.md`。

## 1. 测试范围

### 1.1 覆盖范围

1. 外部 Agent 运行时入口、空状态和项目范围。
2. Admin、项目 Owner、普通 Member 的管理、查看和操作权限。
3. Codex JSONL 与通用 stdin/stdout 两种运行时的注册。
4. 运行时探测、启用、停用和探测结果持久化。
5. AI Teammate 实例绑定外部运行时的 GUI 入口和权限。
6. 任务派发给外部 Teammate 后的过程、结果、状态和执行记录。
7. 外部 Agent 进入工作流节点后的交付物、Review 和审批门禁。
8. 命令不存在、空输出、运行时停用等失败路径。
9. 浏览器 Console、布局、刷新后数据一致性和最小回滚。

### 1.2 不覆盖范围

1. 不测试外部 CLI 自身的登录、额度和远端服务可用性，除非该轮明确启用真实 WorkBuddy。
2. 不把 API 直接造数作为 GUI 通过证据；API 只能用于排障或准备非验收前置。
3. 不测试当前尚未实现的能力：远端 Daemon、跨机器领取、外部 CLI 写仓库、Skill 注入、MCP 注入、Token 成本统计。
4. 不把“探测通过”视为“外部任务执行通过”。探测只验证命令可启动并以 0 退出。

## 2. 当前实现边界

执行测试前必须先确认以下边界，否则会产生错误结论：

1. 外部运行时管理页按项目加载；页面没有显式“项目选择器”。它通常跟随当前 Teammate 的 Agent Profile 工作区，或选择账户加入的第一个项目。多项目测试必须使用独立浏览器 Profile 或独立账号，避免把项目 A 的运行时与项目 B 的实例混在一起。
2. GUI 只提供运行时的新建、探测、启用和停用；没有运行时编辑、归档、跨项目复制或平台级运行时维护入口。
3. `探测` 只执行 `<command> --version`，不会发送任务 Prompt，也不会验证 protocol、最终输出或模型调用。
4. `codex-jsonl` 协议由适配器自动追加 `exec --json --cd <workspace> --sandbox read-only --output-last-message ... -`。GUI 的固定参数只填写 CLI 自身需要的参数，不要重复填写平台固定参数。
5. `plain-text` 协议约定：stdout 为最终结果，stderr 为诊断，退出码 0 为成功，非 0 为失败，SIGTERM 表示取消。
6. 当前版本存在一个必须单独确认的绑定入口风险：单一模版收敛后，运行态的“人设定义”和“编辑模版”只编辑模板；页面当前没有可达的实例级“执行方式 = 外部 Agent / 外部运行时选择”编辑器。`EXT-BIND-01` 必须作为阻塞项记录，不能把编辑模板当成实例绑定成功。

## 3. 测试环境

### 3.1 仓库与隔离目录

所有命令在仓库根目录执行：

```sh
cd /Users/oliviayang/Codex/一切皆插件/dsh-pluginmax
pwd
```

预期输出结尾为：

```text
/Users/oliviayang/Codex/一切皆插件/dsh-pluginmax
```

本轮使用独立端口和独立 DSH_HOME。下面命令中的 `.tmp/external-agent-gui-home` 只允许用于本测试轮，不要删除或覆盖用户正在使用的 `.tmp/dsh-home`：

```sh
lsof -ti tcp:33119 -sTCP:LISTEN
```

如果输出 PID，先确认它是本轮旧测试进程后再停止；否则把后续端口统一改为 `33120` 或其它未占用端口。

如果 `.tmp/dsh-home` 不存在，先执行：

```sh
./scripts/install-profile.sh
```

准备隔离环境：

```sh
rm -rf .tmp/external-agent-gui-home
cp -R .tmp/dsh-home .tmp/external-agent-gui-home
mkdir -p .tmp/external-agent-gui-workspace
```

### 3.2 构建和启动

GUI 使用插件的 `lib/` 构建产物，改动后只跑源码测试不够：

```sh
corepack pnpm install --frozen-lockfile
corepack pnpm --filter dsh-collab-agent --filter dsh-collab-teammate --filter dsh-collab-task --filter dsh-collab-workflow build
DSH_HOME="$PWD/.tmp/external-agent-gui-home" \
  node vendor/deepseek-harness/apps/cli/lib/bin.js \
  --profile pluginmax \
  --no-open \
  --port 33119
```

启动后复制终端输出的完整 `<ROOT_URL>`。首次进入必须保留 `?token=`，否则 API 请求会失败。

### 3.3 账号和项目

建议使用三个隔离浏览器 Profile，避免 token 和当前登录用户相互覆盖：

| Profile | 账号 | 全局角色 | 项目角色 | 用途 |
| --- | --- | --- | --- | --- |
| A | `ext-admin` | admin | 项目 Owner | 管理平台用户、项目和外部运行时 |
| B | `ext-owner` | member | owner | 项目 Owner 权限和外部运行时管理 |
| C | `ext-member` | member | member | 只读查看，验证不能注册、探测或启停 |

初始化步骤：

1. Profile A 使用 `<ROOT_URL>` 打开页面。
2. 打开 `Settings > 协作身份`，按首次初始化流程创建 `ext-admin`。
3. 在用户管理中创建 `ext-owner` 和 `ext-member`，密码只使用本轮测试密码。
4. 在左侧项目区域添加项目路径：

```text
/Users/oliviayang/Codex/一切皆插件/dsh-pluginmax/.tmp/external-agent-gui-workspace
```

5. 将 `ext-owner` 加入项目并设为 `owner`，将 `ext-member` 加入项目并设为 `member`。
6. 记录真实项目 ID，记为 `<WS_ID>`。不要手写或猜测项目 ID。

## 4. 固定测试数据

将 `<REPO>` 替换为仓库绝对路径。GUI 中的固定参数必须每行一个 token，不要输入引号包裹的整段命令。

| 数据项 | 值 | 用途 |
| --- | --- | --- |
| 通用假 Agent | `node` + `<REPO>/docs/fixtures/external-agent/plain-text-agent.mjs` | 验证 stdin/stdout |
| Codex JSONL 假 Agent | `node` + `<REPO>/docs/fixtures/external-agent/codex-fake.mjs` | 验证 JSONL 进度和最终消息 |
| 不存在的命令 | `/definitely-not-installed-agent` | 验证启动失败 |
| 空输出命令 | `true` | 验证空输出失败 |
| 运行时名称 | `GUI-Codex-Fake`、`GUI-Plain-Text`、`GUI-Bad-Command`、`GUI-Empty-Output` | 页面识别和证据记录 |
| Teammate 名称 | `GUI-外部-Codex`、`GUI-外部-Plain`、`GUI-内置对照` | 执行方式对照 |
| 任务标题 | `GUI-EXT-任务-Codex`、`GUI-EXT-任务-Plain` | 任务闭环 |
| 工作流文件 | `docs/fixtures/workflow/external-agent-gate.md` | 交付物和 Review 门禁 |

通用假 Agent 的预期输出特征：

```text
收到任务：<平台生成的 Prompt>

外部 Agent 已完成本地验证。
```

Codex JSONL 假 Agent 的预期特征：

```text
进度：外部 Agent 正在执行
外部 Session ID：gui-fake-thread-1
最终输出：Codex 假实现已完成 GUI 验收任务，且满足最少字数要求。
```

## 5. 终端预检

### 5.1 通用 stdin/stdout 预检

在仓库根目录执行：

```sh
printf 'GUI_PREFLIGHT' | node docs/fixtures/external-agent/plain-text-agent.mjs
```

预期输出包含：

```text
收到任务：GUI_PREFLIGHT
外部 Agent 已完成本地验证。
```

### 5.2 Codex JSONL 预检

```sh
printf 'GUI_PREFLIGHT' | node docs/fixtures/external-agent/codex-fake.mjs \
  exec --json --cd "$PWD/.tmp/external-agent-gui-workspace" \
  --sandbox read-only \
  --output-last-message /tmp/gui-ext-last-message.md -
cat /tmp/gui-ext-last-message.md
```

预期 stdout 包含 `外部 Agent 正在执行`，且 `/tmp/gui-ext-last-message.md` 包含：

```text
Codex 假实现已完成 GUI 验收任务
```

任一预检失败时，先修复夹具或本机 Node 环境，不要继续 GUI 执行用例。

## 6. GUI 用例

### EXT-GUI-01 入口、空状态和权限

前置：Profile A 已登录，项目 A 存在，且外部运行时列表为空。

| 步骤 | 操作 | 数据 | 预期结果 |
| --- | --- | --- | --- |
| 1 | 点击左侧 `AI Teammates` | 无 | 进入 AI Teammates 页面 |
| 2 | 点击 `外部 Agent 管理` | 无 | 主区标题为 `外部 Agent 运行时`，可见 `注册运行时`，初始显示 `还没有外部 Agent 运行时。` |
| 3 | 使用 Profile C 登录并重复步骤 1-2 | `ext-member` | 可以查看列表，但不能看到 `注册运行时`，也不能看到运行时行的 `探测`、`停用` 或 `启用` |
| 4 | 使用 Profile B 登录并重复步骤 1-2 | `ext-owner` | 可见 `注册运行时`，可管理当前项目运行时 |
| 5 | 在未加入任何项目的账号打开该页面 | 无项目账号 | 显示 `请先加入一个项目，再注册本机外部 Agent。`，没有可提交表单 |

通过条件：权限只由页面和服务端共同判定；刷新后权限状态不反转。

### EXT-GUI-02 注册 Codex JSONL 假运行时

前置：Profile A 或项目 Owner B 已登录，当前项目为测试项目。

| 步骤 | 操作 | 数据 | 预期结果 |
| --- | --- | --- | --- |
| 1 | 点击 `注册运行时` | 无 | 展开表单，字段为 `显示名称`、`Provider`、`协议`、`命令`、`固定参数（每行一个）`、`状态` |
| 2 | 填写显示名称 | `GUI-Codex-Fake` | 名称可输入，未触发保存 |
| 3 | 选择 Provider | `Codex` | 协议默认切为 `Codex JSONL`，命令默认建议 `codex`；按本轮数据改为 `node` |
| 4 | 填写协议 | `Codex JSONL` | 协议显示为 Codex JSONL |
| 5 | 填写命令 | `node` | 命令可输入 |
| 6 | 填写固定参数 | `<REPO>/docs/fixtures/external-agent/codex-fake.mjs` | 文本区保留一行完整绝对路径 |
| 7 | 选择状态 | `启用` | 状态为启用 |
| 8 | 点击 `保存运行时` | 无 | 成功提示 `已注册外部 Agent：GUI-Codex-Fake`，表单关闭，列表出现该运行时 |
| 9 | 检查列表行 | 无 | 至少显示 `GUI-Codex-Fake`、`codex · codex-jsonl · 启用`、完整 command 和 args |
| 10 | 刷新页面并重新进入 | 无 | 运行时仍在列表中，字段没有丢失 |

### EXT-GUI-03 注册通用 stdin/stdout 假运行时

| 步骤 | 操作 | 数据 | 预期结果 |
| --- | --- | --- | --- |
| 1 | 点击 `注册运行时` | 无 | 继续使用新建表单 |
| 2 | 填写显示名称 | `GUI-Plain-Text` | 名称可输入 |
| 3 | 选择 Provider | `通用命令` | 协议默认切为 `通用 stdin/stdout` |
| 4 | 填写协议 | `通用 stdin/stdout` | 协议正确显示 |
| 5 | 填写命令 | `node` | 命令可输入 |
| 6 | 填写固定参数 | `<REPO>/docs/fixtures/external-agent/plain-text-agent.mjs` | 固定参数保留一行 |
| 7 | 点击保存 | 无 | 提示 `已注册外部 Agent：GUI-Plain-Text` |
| 8 | 检查列表 | 无 | 显示 `command · plain-text · 启用`，并显示固定参数 |

### EXT-GUI-04 探测成功、探测失败和状态切换

| 步骤 | 操作 | 数据 | 预期结果 |
| --- | --- | --- | --- |
| 1 | 在 `GUI-Plain-Text` 行点击 `探测` | 无 | 提示 `命令探测通过。` |
| 2 | 检查该行 | 无 | 出现 `探测通过：命令可用` |
| 3 | 刷新页面 | 无 | 探测结果仍保留 |
| 4 | 注册 `GUI-Bad-Command` | Provider=`通用命令`，协议=`通用 stdin/stdout`，命令=`/definitely-not-installed-agent`，固定参数为空 | 保存成功，列表出现该运行时 |
| 5 | 点击 `GUI-Bad-Command` 的 `探测` | 无 | 明确显示探测失败；列表出现 `探测失败：...ENOENT...` 或等价命令不存在诊断 |
| 6 | 点击 `GUI-Plain-Text` 的 `停用` | 无 | 提示 `外部 Agent 已停用。`，行状态变为 `停用`，按钮变为 `启用` |
| 7 | 点击 `启用` | 无 | 提示 `外部 Agent 已启用。`，行状态恢复 `启用` |

通过条件：探测失败不能把运行时状态改成启用；页面不能出现未处理的异常或静默失败。

### EXT-GUI-05 项目隔离和 Member 边界

前置：准备两个项目 A、B。Profile A 与 Profile B 分别只加入其中一个项目，避免当前页面缺少显式项目选择器造成误判。

| 步骤 | 操作 | 数据 | 预期结果 |
| --- | --- | --- | --- |
| 1 | Profile A 在项目 A 注册 `GUI-Plain-Text` | 项目 A，`<WS_ID_A>` | 项目 A 列表可见该运行时 |
| 2 | Profile B 只加入项目 B，打开外部 Agent 管理 | 项目 B，`<WS_ID_B>` | 不显示项目 A 的运行时 |
| 3 | Profile C 加入项目 A，打开外部 Agent 管理 | `ext-member` | 可以查看项目 A 的运行时，但不能注册、探测、停用或启用 |
| 4 | 在浏览器开发者工具检查失败请求响应 | 可选 | 未授权操作返回权限错误；页面不得把本地乐观状态显示成服务端成功 |

### EXT-BIND-01 Teammate 绑定外部运行时（当前阻塞检查）

目的：确认实例级执行绑定是可从页面到达的真实操作，而不是编辑模板的副作用。

| 步骤 | 操作 | 数据 | 预期结果 |
| --- | --- | --- | --- |
| 1 | 在外部 Agent 管理确认 `GUI-Codex-Fake` 或 `GUI-Plain-Text` 为 `启用` | 任选一个 | 运行时可用 |
| 2 | 切到 `AI Teammate 管理 > 运行态管理`，选择一个实例 | 现有实例 | 打开实例详情 |
| 3 | 查找实例级 `执行方式`、`外部 Agent`、`切换运行时` 或等价入口 | 无 | 应能选择 `外部 Agent` 并选择一个启用运行时，保存后刷新仍保持绑定 |
| 4 | 不选择运行时直接保存 | 空运行时 | 保存按钮应为禁用，或服务端明确拒绝 |
| 5 | 在实例详情重新打开该实例 | 绑定后的实例 | 详情或运行态应显示执行方式为 `外部 Agent` 及运行时名称 |

当前代码事实：步骤 3 在单一模版收敛后的 GUI 中不可达；`人设定义` 打开的是模板定义，`编辑模版` 只编辑 AI Teammate 模版，没有实例级执行方式表单。服务端的 `CreateTeammateInput` 和 `UpdateTeammateInput` 仍保留 `execution` 与 `externalRuntimeId`，缺口在 GUI 入口。因此本用例当前应记录为 `BLOCKED`，并作为完整外部 Agent GUI E2E 的前置缺陷。未解决前，只能使用测试轮已有的、已绑定外部运行时的实例继续执行链路用例，不能把模板编辑计为绑定通过。

### EXT-GUI-06 通用外部 Agent 任务端到端

前置：存在一个已绑定 `GUI-Plain-Text` 且状态可执行的外部 Teammate。若无法由 GUI 创建该前置，先记录 `EXT-BIND-01` 阻塞。

| 步骤 | 操作 | 数据 | 预期结果 |
| --- | --- | --- | --- |
| 1 | 打开任务管理并点击 `新建任务` | 无 | 打开 `派发任务 / Issue` |
| 2 | 填写标题 | `GUI-EXT-任务-Plain` | 标题可输入 |
| 3 | 选择项目 | 测试项目 | 项目已选中 |
| 4 | 选择责任人 | DE / 分身后的 `GUI-外部-Plain` | 接收方为外部 Teammate |
| 5 | 填写描述 | `请返回本轮外部 Agent 联调结论。` | 描述必填通过 |
| 6 | 填写验收标准 | `返回包含“外部 Agent 已完成本地验证”的结果` | 一条验收标准 |
| 7 | 保持或取消 `自动将任务状态调整为待Review` | 建议先保留默认勾选 | 任务创建事件使用该配置 |
| 8 | 点击 `派发` | 无 | 提示 `任务已派发`，任务卡片进入进行中或按配置进入待 Review |
| 9 | 打开任务详情，展开最新进展和运行明细 | 任务 ID | 可见 `收到任务：` 和 `外部 Agent 已完成本地验证。` |
| 10 | 检查状态和时间 | 任务 ID | 开始时任务为进行中；成功后，勾选自动 Review 时进入待验收/待 Review，未勾选时保留在进行中等待人工提交 |
| 11 | 刷新任务管理和任务详情 | 任务 ID | 结果、状态和运行明细保持一致 |

通过条件：外部进程结果进入任务执行记录，任务不会因为 stdout 文本存在就静默跳过 Review 配置。

### EXT-GUI-07 Codex JSONL 流式任务端到端

前置：存在一个已绑定 `GUI-Codex-Fake` 的外部 Teammate。

| 步骤 | 操作 | 数据 | 预期结果 |
| --- | --- | --- | --- |
| 1 | 创建任务 | 标题 `GUI-EXT-任务-Codex`，接收方 `GUI-外部-Codex` | 任务可派发 |
| 2 | 填写描述 | `请输出 Codex 外部 Agent 的 GUI 验收结果。` | 描述非空 |
| 3 | 派发并立即打开执行明细 | 任务 ID | 运行中可看到 `外部 Agent 正在执行` |
| 4 | 等待结束 | 无 | 最终输出包含 `Codex 假实现已完成 GUI 验收任务，且满足最少字数要求。` |
| 5 | 检查外部 Session 诊断 | 无 | 若页面或审计详情展示 session ID，应看到 `gui-fake-thread-1`；若页面未展示，记录 `UI 不可直接查看`，不能伪造通过结论 |
| 6 | 刷新任务和工作流相关视图 | 任务 ID | 最终输出和状态一致，无重复运行 |

### EXT-GUI-08 工作流交付物与 Review 门禁

前置：存在外部 Teammate；已从其运行态详情记录 Agent Profile ID。若 `EXT-BIND-01` 未解决，只能使用已有绑定实例。

| 步骤 | 操作 | 数据 | 预期结果 |
| --- | --- | --- | --- |
| 1 | 打开 `工作流 > 模板管理 > 新建模版` | 无 | 进入模板导入 |
| 2 | 导入模板 | `docs/fixtures/workflow/external-agent-gate.md` | 模板解析成功 |
| 3 | 替换模板中的占位 ID | `agent:external-agent-profile-id` -> 实际 Agent Profile ID；`user:project-owner-id` -> 项目 Owner ID | 执行者和责任人指向真实对象 |
| 4 | 确认节点门禁 | `deliverable: report`、`required: true`、`min-text-length: 20`、`review-required: true` | 节点至少要求一份 20 字以上报告并需要人工 Review |
| 5 | 启动工作流实例 | 测试项目 | 节点进入待执行或运行中 |
| 6 | 等待外部 Agent 运行 | 无 | 过程和最终输出进入工作流节点与任务投影 |
| 7 | 检查节点状态 | 无 | Agent 成功不等于节点完成；必须先满足交付物并进入待 Review |
| 8 | 点击 `退回` 并填写原因 | `交付说明缺少风险或覆盖范围` | 节点回到待补交付物/可重提状态，不进入下一节点 |
| 9 | 补交并重新提交 | 包含必要说明 | 再次进入待 Review |
| 10 | 点击 `通过` | 无 | 节点进入后续审批或完成，任务投影同步 |
| 11 | 将 `review-required` 改为 `false` 后重跑 | 最小测试模板 | 交付物满足时节点可自动完成；没有交付物时仍不得跳过门禁 |

### EXT-GUI-09 失败路径

以下用例均要求先准备一个已绑定目标运行时的外部 Teammate。当前绑定入口若阻塞，复用已有绑定实例并记录前置方式。

#### F-01 命令不存在

| 步骤 | 操作 | 数据 | 预期结果 |
| --- | --- | --- | --- |
| 1 | 创建 `GUI-Bad-Command` | 命令 `/definitely-not-installed-agent` | 保存成功 |
| 2 | 让测试 Teammate 临时绑定该运行时，或复用已有绑定 | 运行时 ID 不可伪造 | 绑定关系明确 |
| 3 | 派发任务 | `GUI-EXT-失败-ENOENT` | 运行失败，不得显示成功 |
| 4 | 查看执行明细 | 无 | 包含 `ENOENT`、`命令不存在` 或等价诊断 |
| 5 | 若来自工作流，检查节点 | 无 | 节点阻塞或失败，不进入 Review/下一节点 |

#### F-02 空输出

| 步骤 | 操作 | 数据 | 预期结果 |
| --- | --- | --- | --- |
| 1 | 创建 `GUI-Empty-Output` | Provider=`通用命令`，协议=`通用 stdin/stdout`，命令=`true` | 保存和探测可成立 |
| 2 | 绑定并派发任务 | `GUI-EXT-失败-空输出` | 运行失败 |
| 3 | 查看执行明细 | 无 | 明确提示 `外部 Agent 未返回可用的文本输出` |

#### F-03 运行时停用

| 步骤 | 操作 | 数据 | 预期结果 |
| --- | --- | --- | --- |
| 1 | 在外部 Agent 管理停用已绑定的运行时 | `GUI-Plain-Text` | 行状态变为 `停用` |
| 2 | 派发新任务给该 Teammate | 无 | 新运行失败，提示 `外部 Agent 运行时不存在或已停用` |
| 3 | 重新启用运行时 | `GUI-Plain-Text` | 后续新任务可再次执行 |
| 4 | 检查停用期间已结束的历史运行 | 无 | 历史记录保留，不被改写为成功 |

### EXT-GUI-10 页面质量、刷新和回滚

| 步骤 | 操作 | 数据 | 预期结果 |
| --- | --- | --- | --- |
| 1 | 在 1280px、900px、390px 宽度打开外部 Agent 管理 | 三个视口 | 表单、列表、按钮不重叠，不出现嵌套双滚动条 |
| 2 | 连续执行注册、探测、启停 | 无 | 每个操作结束后按钮恢复可用，`保存中` 不残留 |
| 3 | 刷新页面并重新打开 AI Teammates | 无 | 运行时、探测结果、状态和执行记录保持一致 |
| 4 | 将有绑定实例切回内置执行（绑定入口修复后执行） | 无 | 新任务使用内置执行；历史外部运行记录仍可查看 |
| 5 | 停用并归档测试运行时（若未来提供归档入口） | 无 | 新派发被阻止，历史数据不丢失 |
| 6 | 结束测试 | 无 | 停止 33119 服务后，才允许删除 `.tmp/external-agent-gui-home` |

## 7. 证据要求

每个用例至少保留：

1. 项目名称和 `<WS_ID>`。
2. 运行时名称、完整 command、args、状态和探测消息。
3. 任务 ID、工作流实例 ID、Agent Profile ID。
4. 操作前、运行中、结束后的截图或录屏。
5. 失败用例的原始诊断文本，不截断关键错误码。
6. 浏览器 Console 截图；出现未捕获异常时记录为复核项。

建议截图命名：

```text
EXT-GUI-02_runtime-created.png
EXT-GUI-04_probe-success.png
EXT-GUI-06_task-running.png
EXT-GUI-06_task-succeeded.png
EXT-GUI-08_workflow-review.png
EXT-GUI-09_enoent.png
```

## 8. 通过标准

1. `EXT-GUI-01` 至 `EXT-GUI-05` 全部通过。
2. `EXT-BIND-01` 不能以“编辑模板成功”代替；如果页面没有实例级绑定入口，本模块判定为 `BLOCKED`，不是通过。
3. `EXT-GUI-06`、`EXT-GUI-07` 至少各有一条完整闭环，过程、最终输出、状态和刷新一致性均可验证。
4. `EXT-GUI-08` 必须证明外部 Agent 成功不能绕过交付物、Review 和审批。
5. `EXT-GUI-09` 每个失败路径都可见、可追溯，不能静默成功。
6. 权限边界中对 Member 的管理操作必须在 UI 和服务端同时被拒绝。
7. 浏览器 Console 没有未捕获异常；若存在，必须记录是否影响当前用例。

## 9. 结果记录模板

| 用例 | 结果 | 证据 | 实际结果 | 缺陷编号 |
| --- | --- | --- | --- | --- |
| EXT-GUI-01 |  |  |  |  |
| EXT-GUI-02 |  |  |  |  |
| EXT-GUI-03 |  |  |  |  |
| EXT-GUI-04 |  |  |  |  |
| EXT-GUI-05 |  |  |  |  |
| EXT-BIND-01 | BLOCKED / PASS / FAIL |  |  |  |
| EXT-GUI-06 |  |  |  |  |
| EXT-GUI-07 |  |  |  |  |
| EXT-GUI-08 |  |  |  |  |
| EXT-GUI-09 |  |  |  |  |
| EXT-GUI-10 |  |  |  |  |

## 10. 缺陷记录格式

发现失败时，至少记录以下信息：

```markdown
### BUG-EXT-GUI-YYYYMMDD-NN

- 标题：
- 前置用例：
- 账号 / 项目 / `<WS_ID>`：
- 运行时名称 / ID：
- Teammate 名称 / ID：
- 任务或工作流实例：
- 操作步骤：
- 实际结果：
- 预期结果：
- 原始诊断：
- Console / 请求响应：
- 证据：
```
