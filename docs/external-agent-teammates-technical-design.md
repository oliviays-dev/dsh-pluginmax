# AI Teammates 外部 Agent 集成设计

## 1. 目标

把 AI Teammates 从“内置 Task Worker 的管理面”升级为可接入外部 Agent 的统一身份层。Codex、WorkBuddy、Claude Code 或团队自研 Agent CLI 可以作为某一名 AI Teammate 的执行通道，但任务、工作流、审批、交付物和审计仍然留在平台内。

本设计遵循三个边界：

1. **身份归 AI Teammates**：一名 Teammate 是稳定的协作者身份，可以绑定内置执行或外部运行时。
2. **执行归 Provider Adapter**：不同 CLI 的启动参数、流式协议、会话恢复能力不同，平台只做归一化，不假设所有工具能力相同。
3. **业务门禁不变**：外部 Agent 的运行完成不等于业务任务完成；工作流仍按交付物、Review 和审批规则推进。

## 2. 用户视角

### 配置阶段

平台管理员或项目 Owner 在 AI Teammates 中维护“外部 Agent 运行时”：

| 概念                     | 用户可见说明                             |
| ------------------------ | ---------------------------------------- |
| Provider                 | Codex、WorkBuddy 或通用命令行 Agent      |
| Command                  | 本机可执行文件或已验证的绝对路径         |
| Protocol                 | `codex-jsonl` 或 `plain-text`            |
| Working directory policy | 默认复用项目工作区；未绑定项目时拒绝执行 |
| Status                   | 启用、停用、已归档                       |

创建或编辑 AI Teammate 时选择：

```text
执行方式：内置执行 / 外部 Agent
外部 Agent：Codex 本机 / WorkBuddy CLI / 其他已注册运行时
```

### 运行阶段

用户仍然创建任务或推进工作流节点。指派给 AI Teammate 后：

1. 平台解析 Teammate 的执行身份。
2. 内置 Teammate 继续走现有 Task Worker。
3. 外部 Teammate 调用其绑定的外部 CLI。
4. 平台把过程输出、结束结果和失败原因同步到任务执行历史。
5. 工作流交付物仍必须满足要求，后续节点不会因为 CLI 退出而自动跳过门禁。

## 3. 数据模型

### 3.1 外部运行时

新增到 `collab_agent` 存储域：

```ts
interface ExternalAgentRuntime {
  id: string;
  workspaceId?: string;
  name: string;
  provider: "codex" | "workbuddy" | "command";
  protocol: "codex-jsonl" | "plain-text";
  command: string;
  args: string[];
  status: "active" | "disabled" | "archived";
  visibility: "workspace" | "platform";
  ownerUserId: string;
  createdAt: string;
  updatedAt: string;
  lastProbeAt?: string;
  lastProbeOk?: boolean;
  lastProbeMessage?: string;
}
```

约束：

1. `command` 不支持 shell 字符串拼接；执行时必须使用参数数组。
2. `codex-jsonl` 的平台协议参数由适配器固定，注册数据不能覆盖交互、输出和取消关键参数。
3. `plain-text` 是最小接入协议：stdin 接收完整任务提示，stdout 返回最终文本，stderr 作为诊断日志。
4. 项目运行时由 Workspace Owner/Admin 维护；平台管理员可跨项目维护。
5. 敏感凭据不落在本表；第一版依赖执行机器上的 CLI 登录态。

### 3.2 Teammate 执行偏好

`Teammate` 增加两个可选字段：

```ts
execution?: "builtin" | "external";
externalRuntimeId?: string;
```

老数据没有字段时等价于 `builtin`。首次派发时仍会创建数字员工与 Agent Profile，保证任务接收方、工作区和现有列表不变；只是 Agent Profile 会被标记为外部执行。

### 3.3 Agent Profile

`AgentProfile` 增加可选字段：

```ts
execution?: "builtin" | "external";
externalRuntimeId?: string;
```

`execution` 缺省为 `builtin`。这样可以继续读取历史 Profile，不需要一次性迁移。

## 4. 执行链路

```text
任务 / 工作流节点
  -> AI Teammate 身份解析
  -> Agent Profile + externalRuntimeId
  -> AgentTaskRuntime 选择 Runner
       |-- builtin：现有 Home Session / Subagent 通道
       +-- external：ExternalAgentRunner
              |-- codex-jsonl：codex exec --json
              +-- plain-text：通用 stdin/stdout CLI
  -> 归一化输出
  -> AgentRun
  -> 任务执行历史 / 工作流交付物
```

`ExternalAgentRunner` 的输入是已组装好的平台 Prompt、AbortSignal、工作区和运行时配置；输出是：

```ts
{
  output: [{ type: "text", text }];
  stopReason: "completed" | "failed" | "cancelled";
  sessionId?: string;
  diagnostic?: string;
}
```

### 4.1 Codex Adapter

第一版使用非交互命令：

```bash
codex exec --json --cd <workspacePath> --sandbox read-only - \
  --output-last-message <temporary-file>
```

平台控制非交互输入、JSONL 过程输出、工作目录、只读沙箱和最终消息文件。

平台解析：

1. JSONL 中的文本增量用于实时进展；
2. `--output-last-message` 的文件内容作为最终结果；
3. 进程错误和 stderr 作为失败诊断；
4. CLI 返回的 session id 写入 AgentRun。

第一版不开放 `danger-full-access`。需要写仓库的场景必须在后续版本引入显式工作区写授权和审计。

### 4.2 WorkBuddy / Generic Adapter

WorkBuddy 如果提供符合以下契约的 CLI，可直接用 `plain-text` 接入：

```text
<command> <registered args>
stdin: UTF-8 平台 Prompt
stdout: UTF-8 最终结果
stderr: 诊断日志
exit 0: completed
exit non-zero: failed
SIGTERM: cancelled
```

如果 WorkBuddy 后续提供 JSONL、会话恢复或工具事件，只需新增专用 protocol parser，不需要改动任务和工作流层。

## 5. 状态与错误

外部 Agent 复用现有 AgentRun 状态：

| 状态        | 含义                                 |
| ----------- | ------------------------------------ |
| queued      | 已创建，等待进程池                   |
| running     | 外部 CLI 已启动                      |
| succeeded   | CLI 正常结束且有最终文本             |
| failed      | 启动失败、非零退出、空输出或解析失败 |
| timeout     | 平台看门狗中止                       |
| cancelled   | 用户或系统取消                       |
| interrupted | 服务重启后无法恢复进程               |

服务重启时，正在运行的外部子进程无法复活，运行记录标记为 `interrupted`；用户可以重新派发。排队中的外部 Run 重启后继续派发。

## 6. 权限与安全

1. 平台不承诺外部 CLI 天然沙箱；真实边界是运行服务进程的操作系统用户。
2. Codex 第一版固定 read-only 沙箱；`plain-text` CLI 的能力由 Runtime Owner 和部署者负责。
3. Runtime 命令仅 Admin/Owner 可配置，且不提供任意 shell 执行入口。
4. Agent Run 继续保存 Prompt 快照、输出、错误和触发者。
5. 外部 Provider Session ID 只作为诊断和后续恢复依据，不能替代平台任务权限。
6. 后续若支持写操作，必须引入显式“运行时能力等级 + 项目写授权 + Run Token”三层校验。

## 7. 回滚策略

实现分四层隔离：

1. **独立功能分支**：所有改动在 `feat/external-agent-teammates`，不直接污染 `main`。
2. **新增表**：外部运行时使用独立 `external_runtimes` 表，回滚时不破坏 profiles/runs。
3. **可选字段**：Teammate 和 Agent Profile 只新增 optional 字段；老数据无字段即可继续工作。
4. **Runner 分叉点唯一**：`AgentTaskRuntime` 只在执行入口选择内置或外部；删除外部分支后立刻恢复旧行为。

应急回滚顺序：

1. 在 UI 把相关 Teammate 切回“内置执行”；
2. 停用或归档外部运行时；
3. 如需代码回滚，直接 revert 功能分支提交；
4. 历史任务仍能看到外部运行留下的执行历史和结果。

## 8. 实施范围

第一阶段实现：

1. 外部运行时注册、启停、探测；
2. Codex JSONL 与通用 plain-text adapter；
3. AI Teammate 执行方式选择；
4. AgentRun 与任务执行历史同步；
5. 基础 API 和自动化测试；
6. 独立 GUI 测试方案。

暂不实现：

1. 远程 Daemon 和跨机器领取；
2. 外部 CLI 写仓库；
3. Skill 注入和 MCP 配置；
4. Token 成本统计；
5. 多机并发调度；
6. 自动重试鉴权或额度类失败。

## 9. 验收标准

1. 一个 AI Teammate 可以绑定本机 Codex 并被任务指派。
2. 任务详情能看到外部 Agent 的过程和最终输出。
3. 外部 Agent 失败、超时或取消时任务执行历史有明确原因。
4. 工作流节点不会因外部 Agent 输出而绕过交付物门禁。
5. 未配置外部运行时或 CLI 不存在时，错误能指导用户转内置执行、修复运行时或转人工。
6. 所有存量 Teammate 在升级后行为保持不变。
