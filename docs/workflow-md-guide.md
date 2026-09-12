# 工作流 Markdown 定义语法

工作流模板使用行导向 Markdown。目标是让管理员直接阅读和版本管理，不需要先学画布。

## 1. 最小示例

```md
# 工作流：产品交付

## 元信息

- key: product-delivery
- version: 1
- description: 从需求评审到发布的轻量流程
- variable: complexity = 5
- variable: security_reviewed = false

## 节点

### 需求评审

- id: requirement-review
- type: approval
- executor: user:workflow-member
- approver: 用户:workflow-owner
- policy: all

### 开发

- id: development
- type: task
- executor: agent:backend-agent
- responsible: user:Alice
- deliverable: implementation-report
  title: 开发交付说明
  type: text
  required: true
  min-text-length: 30
  description: 说明接口、测试范围和已知风险

### 发布

- id: release
- type: service
- executor: system:deployment

## 连接

- requirement-review -> development
- development -> release
```

## 2. 文档结构

```text
# 工作流：<显示名>
## 元信息
## 节点
### <节点显示名>
## 连接
```

三个二级标题必须存在且只出现一次。`###` 是节点显示名，可中文；`id` 是英文标识。

## 3. 元信息字段

| 字段          | 必填 | 说明                                                 |
| ------------- | ---- | ---------------------------------------------------- |
| `key`         | 是   | 工作区内唯一，格式 `kebab-case`。                    |
| `version`     | 是   | 正整数；保存时同 key 下不能重复。                    |
| `description` | 否   | 一句话说明。                                         |
| `variable`    | 否   | `name = default`；默认支持数字、布尔、带引号字符串。 |

示例：

```md
- key: incident-handling
- version: 2
- description: 高风险事件的处置流程
- variable: severity = 3
- variable: customer_impact = true
```

## 4. 节点类型

### 任务 task

由用户、Agent 或人设完成。

```md
### 开发

- id: development
- type: task
- executor: user:Alice
- description: 完成后端接口和测试
```

### 服务 service

代表系统/服务动作的就绪点。首版不自动执行命令，必须通过授权 API/工具确认完成。

```md
### 部署

- id: deploy
- type: service
- executor: system:deployment
```

### 审批 approval

审批是控制门，支持多人审批。

```md
### 技术评审

- id: tech-review
- type: approval
- executor: user:tech-lead
- approver: 用户:Alice
- approver: agent:architect
- policy: all
```

- `policy: all`：所有必签人通过才通过。
- `policy: any`：任一必签人通过即通过。
- 否决会优先走 `rejected` 出边；没有 rejected 边则阻塞。

### 判断 decision

用于规则分支或 AI 决策。

```md
### 复杂度判断

- id: complexity
- type: decision
- executor: system:rules
```

连接上写条件；未命中时走 `default`。AI 决策把 executor 写成 `agent:architect`，由 Agent 通过工具写入判断结果。

### 子流程 subworkflow

```md
### 复杂方案评审

- id: complex-review
- type: subworkflow
- executor: system:workflow
- subworkflow: complex-review
- subworkflow-version: 1
```

`subworkflow` 必须是同一工作区已启用的模板 key。省略版本时使用当前 active 版本。

## 5. 执行者写法

```text
executor: system:<服务标识>
executor: user:<用户标识>
executor: agent:<Agent/人设标识>
```

审批人可多行：

```text
- approver: 用户:Alice
- approver: agent:architect
```

`用户:` / `agent:` 前缀用于 UI；冒号后的标识应使用系统用户标识或人设 ID。

导入和启动时都会校验 `user:<用户标识>`。这个用户必须是当前工作区的真实成员；不存在、已移出或只是“名字像角色”的标识都会被拒绝。`system:<服务标识>` 表示系统能力；`agent:<Agent/人设标识>` 当前仍是声明式占位，由人类责任人代交交付物。

### 责任人

可选字段：

```md
- responsible: user:Alice
```

用户任务可以用它把实际操作人和 `executor` 分开。Agent 节点建议始终声明人类责任人；未声明时保存会产生 warning，运行期由工作区负责人或管理员处理。

`responsible` 里的用户也必须是当前工作区成员。

### 交付物

节点可以声明一个或多个交付物，用于完成门禁：

```md
- deliverable: api-design
  title: API 设计文档
  type: file
  required: true
  accept: .md,.pdf
  max-files: 2
  description: 包含接口契约、错误码和数据结构
- deliverable: regression-report
  title: 回归说明
  type: text
  required: true
  min-text-length: 30
- deliverable: implementation-branch
  title: 实现分支
  type: link
  required: false
```

规则：

- `deliverable` 后是节点内唯一的英文 key；
- 子属性使用两空格缩进；
- `type` 支持 `file`、`text`、`link`；
- `required: true` 的交付物未提交时不能完成节点；
- 文件单次最多 `max-files` 个，单个文件上限 20MB；
- 同一交付物可以重复提交，新的提交会成为当前版本，旧版本保留在提交历史里。

## 6. 连接语法

基础：

```md
- development -> testing
```

并行：从一个节点写多条边。

```md
- approved -> backend
- approved -> frontend
- approved -> qa-plan
- backend + frontend + qa-plan -> release
```

汇合节点 `release` 有三条入边，三条来源完成后才就绪。普通线性边不需要显式 `+`；写 `a + b -> c` 时解析器只把 `a`、`b` 记录为入边，额外 token `c` 会报错。建议直接写三条 `->`。

条件：

```md
- complexity -> complex [condition: complexity >= 8]
- complexity -> standard [default]
```

审批结果：

```md
- tech-review -> development [result: approved]
- tech-review -> security-fix [result: rejected]
```

受控循环：

```md
- test-failed -> development [break: attempts >= 3]
```

一条边可组合：

```md
- review -> rework [result: rejected, break: attempts >= 3]
```

## 7. 循环规则

所有循环必须在至少一条回边上声明 `break`。

运行时上下文：

- `visits.<nodeId>`：节点累计进入次数；
- `<nodeId>.attempts`：同一节点的重试次数，首次进入为 1。

示例：

```md
- testing -> development [break: attempts >= 3]
- testing -> release [result: approved]
```

break 为真时目标节点进入阻塞；用户需要修改上下文、跳过、取消或让管理员调整模板。

## 8. 表达式

支持：

- 数字：`80`、`1.5`
- 布尔：`true`、`false`
- 字符串：`"high"`
- 标识符：`complexity`、`security_reviewed`
- 比较：`>= <= > < == !=`
- 逻辑：`&& || !`
- 括号

合法示例：

```text
severity >= 1 && customer_impact == true
quality >= 80 || (architect_approved == true && risk == "low")
```

不支持函数调用、属性访问、赋值和任意代码。

## 9. 保存前检查

导入页会显示：

| 级别    | 示例                                | 是否可保存 |
| ------- | ----------------------------------- | ---------- |
| error   | 重复节点 ID、未知引用、循环无 break | 否         |
| warning | Agent 节点缺少 responsible          | 是         |
| summary | 节点数、边数、并行分支数            | 是         |

建议流程：

1. 粘贴或选择 `.md`；
2. 点击“校验”；
3. 阅读 errors/warnings；
4. 查看图形检查；
5. 确认后点击“保存新版本”。

## 10. 常见错误

| 错误                                    | 处理                                 |
| --------------------------------------- | ------------------------------------ |
| `workflow key is required`              | 补 `- key: ...`。                    |
| `duplicate node id: development`        | 保证 ID 唯一。                       |
| `edge references unknown node: testng`  | 修正拼写。                           |
| `approval node requires approver`       | 至少写一行 `- approver`。            |
| `cycle requires a break condition`      | 给回边加 `[break: ...]`。            |
| `decision node requires a default edge` | 给判断节点补 `[default]`。           |
| `unknown subworkflow: foo`              | 先导入并启用该子流程模板。           |
| `deliverable ... requires a title`      | 检查交付物子属性是否保留两空格缩进。 |
