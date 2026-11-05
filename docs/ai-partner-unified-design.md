# AI 伙伴平台统一设计

> 版本：v1.1  
> 状态：核心链路已实现，治理增强项按阶段继续  
> 整理日期：2026-11-04  
> 整理范围：用户指定 19:33 之后关于 AI 伙伴、项目权限、任务执行、角色权限与 Skill 的全部讨论  
> 适用模块：`dsh-collab-teammate`、`dsh-collab-meeting`、`dsh-collab-task`、`dsh-collab-agent`、`dsh-collab-project`、`dsh-collab-roles`、`dsh-collab-resource-market`

---

## 1. 文档目的

本文统一描述 AI 伙伴从“平台定义”到“用户实例”再到“运行与交付”的完整模型，重点解决以下问题：

1. AI 伙伴 1:1 会话不应与项目绑定，也不能按项目拆成多个会话。
2. AI 伙伴应在用户发起请求时，根据自己已经参与的项目获取授权数据和执行能力。
3. 平台内置 Agent 的定义共享，但每个用户必须拥有独立的实例、会话、运行记录和记忆边界。
4. 项目角色与权限必须覆盖没有员工档案的 AI 项目成员。
5. 任务运行状态、最终结果回写和超长输出必须有明确边界。
6. Skill 应成为独立、可版本化、可安装和可组合的能力资产。
7. 平台智能体模版提供企业级刚性岗位职责和 SOP；用户可以在自己的 AI 伙伴实例上做受控扩展，但不能修改平台基线。

本文是统一产品与技术设计，不等同于当前代码完成度。文中部分能力已经落地，部分能力属于后续实施范围。

---

## 2. 核心结论

### 2.1 总体分层

```text
平台 Skill 资源市场
    │ 上传 / 审核 / 安装 / 版本
    ▼
平台智能体模版（不可变基线）
    ├─ 岗位职责、企业 SOP、安全策略
    ├─ 平台强制 Skill
    ├─ 平台默认 Skill
    ├─ 平台可选 Skill
    └─ 用户扩展策略
            │ 用户继承
            ▼
AI 伙伴实例（用户归属）
    ├─ 实例资料与执行绑定
    ├─ 用户扩展 Skill
    ├─ 局部场景覆盖
    └─ 独立 Principal / Runtime / 会话 / 记忆
            │ 运行时合并
            ▼
有效配置（Effective Configuration）
    ├─ 最终 Skill 集合
    ├─ 最终行为与场景路由
    ├─ 最终权限交集
    └─ 版本与来源快照
```

### 2.2 四个必须分开的概念

| 概念 | 含义 | 归属层 |
| --- | --- | --- |
| Skill 定义 | 指令、输出契约、触发场景、资源引用 | 平台 Skill 资源池 |
| Skill 安装 | 某个范围是否有权发现和启用该 Skill | 平台模版 / 工作区 / 用户 |
| Skill 绑定 | 哪个智能体模版或实例使用该 Skill | 平台模版 / AI 伙伴实例 |
| Skill 生效 | 当前请求实际加载了哪个版本 | 运行时解析结果 |

“安装”与“绑定”不能混为同一个动作：

- 资源市场安装表示资产可用；
- 平台模版预装表示企业基线，平台可通过模版授权直接提供给继承实例，不要求每个用户重复安装；
- 用户实例扩展表示个性化；
- 运行时加载表示本次请求实际使用。

### 2.3 配置优先级

```text
平台安全、数据边界、审计要求
  > 平台强制 Skill
  > 平台保护场景
  > 模版明确允许的用户场景覆盖
  > 平台默认 Skill
  > 用户增量扩展 Skill
  > 当前会话显式要求
```

用户扩展不得：

- 修改平台智能体模版原文；
- 停用平台强制 Skill；
- 绕过项目成员、项目角色、数据授权或 Runtime 能力上限；
- 使用同名 Skill 影子替换企业基线；
- 覆盖平台标记为不可覆盖的安全与权限规则。

“用户场景覆盖”不是任意 Prompt 覆写。用户需要改变局部行为时，应创建或安装一个受版本管理的扩展 Skill，并只在平台允许的场景中绑定它。这样可以审计“用了什么能力改变行为”，而不是把不可追踪的自由文本塞进实例配置。

---

## 3. AI 伙伴模版与实例

### 3.1 平台智能体模版

平台智能体模版定义企业视角下的稳定能力：

- 岗位职责；
- 工作目标和边界；
- 企业 SOP；
- 安全、权限和审计要求；
- 强制、默认和可选 Skill；
- 允许用户扩展的场景与范围；
- 版本与发布状态。

平台模版是共享定义，不直接变成一个跨用户共享的实例。

### 3.2 AI 伙伴实例

每个用户使用平台智能体模版时，创建自己的 AI 伙伴实例。实例拥有：

- `ownerUserId`；
- `templateId`；
- 独立 `principalId`；
- 独立 `personaId`；
- 独立 Runtime Profile；
- 独立 Agent Session；
- 独立任务、运行记录、日报和记忆；
- 用户扩展 Skill 与允许的局部配置。

下列数据不得跨用户共享：

- 1:1 会话；
- 运行记录；
- Agent Session；
- 私有记忆；
- 日报；
- 用户扩展 Skill；
- 实例级局部行为配置。

### 3.3 实例级覆盖边界

允许实例覆盖：

- 名称、描述、头像；
- 执行方式和 Runtime 绑定；
- 平台允许的场景行为；
- 用户扩展 Skill；
- 工作区偏好、默认数据范围和订阅设置。

不允许实例覆盖：

- 平台模版原文；
- 企业岗位职责；
- 强制 Skill；
- 安全与数据边界；
- 平台强制审计规则。

---

## 4. AI 伙伴 1:1 会话

### 4.1 会话身份

AI 伙伴 1:1 会话的身份是：

```text
ownerUserId + teammateInstanceId
```

会话不按项目拆分。

同一个用户与同一个 AI 伙伴实例只有一个可见的规范 1:1 会话。项目只用于运行时的数据发现、权限校验和任务执行，不参与会话身份。

### 4.2 会话关联项目

新建 1:1 会话时不需要选择项目。

用户向 AI 伙伴发起请求后，平台按以下依据识别伙伴已经参与的项目：

1. 任务 `receiverPrincipalId` 与 AI 实例 Principal 一致；
2. 任务是该 AI 伙伴实例创建或执行过的任务；
3. Agent Run 的 `taskReceiverId` 与实例一致；
4. Agent Run 的 `principalId` 与实例 Principal 一致；
5. 历史任务消息的 `authorId` 或 `authorPrincipalId` 与实例一致。

识别到参与项目后：

- 根据用户问题和任务内容选择最相关项目；
- 将项目任务、验收标准、执行产出和可授权资料装配到上下文；
- Agent Run 使用对应项目的工作区和路径；
- 会话本身仍保持在平台 1:1 会话空间，不转成项目会话。

### 4.3 旧会话处理

新协议会话标记：

```text
aiContextMode = participant-projects-v1
```

旧 `system.default` AI 会话：

- 自动隐藏；
- 不删除数据；
- 不再作为默认会话复用；
- 归档区也不再显示重复的 AI 1:1 副本。

同一 AI 伙伴存在多个历史实现造成的重复会话时：

- 列表只展示一个规范会话；
- 优先使用平台会话；
- 其次使用最近且有历史消息的会话；
- 空会话只有在没有其他历史时才展示；
- 主沟通页与全局侧栏使用同一去重口径。

### 4.4 点击与数据一致性

列表每一行必须绑定该行对应的真实 `conversation.id`。

禁止：

- 点击某个项目会话却打开该伙伴在默认项目中的另一个会话；
- 点击某行却临时新建空会话；
- 右侧详情与左侧 preview 来自不同会话。

列表 preview、右侧标题、时间和 transcript 必须指向同一个会话对象。

### 4.5 最终答复输出

内置 Agent 只向用户展示最终答复：

- 不展示 reasoning block；
- 不展示工具排查过程；
- 不展示内心权衡；
- 不展示英文自述或临时判断。

运行时应只读取 `type=text` 的最终输出块。若模型或运行时把思考混入正文，应在服务端输出边界处理，不依赖前端隐藏。

---

## 5. 项目权限与角色

### 5.1 项目角色数据源

AI 伙伴作为项目成员时，角色来自项目角色席位分配与 AI Principal 授权，不依赖员工档案。

角色页读取：

- 当前实例 ID；
- 当前实例 `principalId`；
- 项目角色席位 `assigneeKind=agent`；
- 有效状态的角色分配。

即使 `employeeId` 为空，只要 AI 伙伴已加入项目并被分配角色，就必须正常展示：

- 项目名称；
- 角色名称；
- 角色权限；
- 生效状态；
- 来源和更新时间。

### 5.2 权限范围

AI 伙伴可以在项目中执行任务，不代表它可以读取所有项目数据。

有效权限为：

```text
项目成员身份
  ∩ 项目角色权限
  ∩ Runtime 能力上限
  ∩ 数据源授权
  ∩ 实例执行范围
```

用户看不到未覆盖区域时，系统必须明确说明“未覆盖”或“无授权”，不得把缺失数据解释为零。

### 5.3 退出角色与项目

AI 角色退出应：

- 释放对应项目角色席位；
- 同步撤销 AI Principal 的项目角色授权；
- 记录审计；
- 平台允许时进行未完成任务改派；
- 不直接删除历史任务和运行记录。

---

## 6. 任务执行与结果回写

### 6.1 状态口径

Agent Run 与任务状态是两个对象：

- Run 表示一次执行；
- 任务表示业务事项的生命周期。

用户询问“任务是否还在执行”时，以 Run 状态为准：

- `queued`：已入队；
- `running`：真正执行中；
- `waiting_input`：等待人工补充；
- `succeeded` / `failed` / `timeout` / `cancelled` / `interrupted`：已结束。

若 Run 已结束而任务仍停留在“进行中”，应检查结果回写是否失败。

### 6.2 结果回写

Run 结束后必须幂等回写任务：

- 更新最后一条 Agent 消息；
- 更新消息状态；
- 推进任务状态；
- 标记 `settleDelivered=true`；
- 失败时保留待重放标记。

服务启动时可扫描终态但没有成功投递的 Run，并自动重放，不应要求用户重新执行 Agent。

### 6.3 长输出与文档

任务消息正文上限为 20,000 字符。

当 Agent 输出完整 HTML、Markdown 或其他文件正文时：

1. 先按 `pluginmax-document` 协议提取产出文档；
2. 将完整文件写入任务工作区；
3. 任务消息只保留简要结论和文档名称；
4. 不把完整 HTML 正文写进任务消息；
5. 消息长度仍超限时截断并提示完整内容见运行记录或产出文档。

### 6.4 失败处理

任何结果回写异常都必须可诊断：

- 不得静默吞掉关键错误；
- 任务保持未投递状态供重放；
- 记录失败原因；
- 成功后清除待重放状态。

---

## 7. AI 伙伴工作负荷展示

AI 伙伴详情与列表中的工作负荷只展示：

- 运行时长；
- 输出 Token。

不再展示：

- 沟通次数；
- 参会次数；
- 24 小时会议数。

工作负荷不得改变 AI 伙伴权限、项目角色或日报内容。

---

## 8. Skill 平台模型

### 8.1 Skill 定义

Skill 是可版本化的能力包，默认由以下内容组成：

```yaml
id: skill.work-report
name: 工作日报
version: 1.0.0
description: 用管理层视角输出结论、阶段性结果、风险和需协同事项
scenes:
  - work-report
permissions:
  - task:read
  - run:read
instructions: |
  ...
```

Skill：

- 只包含方法、判断标准、输出约定和可选资源引用；
- 不包含密钥；
- 不直接执行权限校验；
- 不能扩大数据权限；
- 不携带用户私有数据；
- 不应把完整业务 SOP 中适合稳定的部分散落到 SOUL。

### 8.2 Skill 生命周期

```text
draft
  → published
  → installed
  → bound
  → effective
  → deprecated / archived
```

每个阶段有独立语义：

- `published`：资源市场可见；
- `installed`：当前用户或工作区可用；
- `bound`：被平台模版或实例引用；
- `effective`：当前请求实际加载；
- `deprecated`：不推荐新绑定；
- `archived`：不可新增绑定，历史快照保留。

### 8.3 平台模版基线

平台管理员可以在平台智能体模版中配置：

| 模式 | 用户是否可停用 | 是否可覆盖 | 说明 |
| --- | --- | --- | --- |
| `required` | 否 | 否 | 企业安全、合规、岗位刚性 SOP |
| `default` | 可视策略而定 | 通常否 | 开箱即用能力 |
| `optional` | 是 | 场景级 | 平台提供、用户按需启用 |

平台强制和默认 Skill 由平台模版授权，运行时可以直接提供给继承该模版的用户实例。它们不需要复制成每个用户的个人安装记录；但每次运行仍要校验平台授权和 Skill 版本是否有效。

平台模版还应配置 `extensionPolicy`：

```text
allowAdditionalSkills
allowDisableDefaultSkills
allowSceneOverrides
protectedScenes
protectedSkillIds
```

### 8.4 用户实例扩展

用户可以在自己的 AI 伙伴实例上：

- 添加已安装且有权使用的 Skill；
- 启用平台允许的可选 Skill；
- 在允许范围内选择不同场景处理器；
- 针对日报、分析等场景调整局部行为；
- 暂停自己的扩展 Skill。

局部行为调整应落为扩展 Skill 绑定，不新增不可审计的实例自由 Prompt。实例最多保存 Skill 选择、场景和启停策略。

用户不能：

- 编辑平台 Skill 正文；
- 删除平台基线；
- 停用平台强制 Skill；
- 覆盖平台保护场景；
- 将自己的扩展共享到其他用户。

### 8.5 有效 Skill 解析

运行时有效 Skill 集合：

```text
effectiveSkills =
  requiredTemplateSkills
  ∪ enabledDefaultTemplateSkills
  ∪ allowedUserExtensionSkills
  - disabledByPolicy
  - unavailableOrUnauthorized
```

解析时按 Skill ID 去重，并保留：

- Skill ID；
- Skill 版本；
- 来源层；
- 绑定来源；
- 场景；
- 作用模式：`additive` 或 `primary`；
- 是否被用户覆盖；
- 是否实际加载。

### 8.6 冲突处理

如果用户扩展与平台基线同时声明同一个场景：

1. 平台保护场景拒绝用户扩展生效；
2. `required` Skill 不允许被用户扩展停用或替换；
3. `default` Skill 只有在模版明确允许的场景中，才可由用户扩展设为 `primary`；
4. 只允许一个主处理器时，用户选择不能同时激活两个；
5. 用户 `additive` Skill 只能补充，不得替换强制规则；
6. 发生版本不兼容时 fail closed，并显示可修复原因；
7. 所有冲突记录到运行证据。

### 8.7 版本策略

- 平台强制 Skill 使用明确版本或受控小版本范围；
- 用户扩展 Skill 必须锁定版本或允许的版本区间；
- 新版本发布不自动改写历史日报；
- 运行时快照记录实际生效版本；
- 历史任务、日报和审计可追溯 Skill 来源与版本。

---

## 9. Skill 的页面归属

### 9.1 页面分层

| 页面 | 责任 |
| --- | --- |
| 资源市场 | 上传、注册、审核、安装、版本和权限 |
| 智能体定义 | 平台或个人的基线 Skill、场景、扩展策略 |
| AI 伙伴实例 | 用户扩展 Skill、允许的局部行为覆盖、启停 |
| 运行详情 | 显示本次实际加载的 Skill 和版本 |

### 9.2 平台智能体模版

平台管理员在“智能体定义”中配置：

- 强制 Skill；
- 默认 Skill；
- 可选 Skill；
- 保护场景；
- 允许的扩展范围。

平台模版保存后影响后续运行，但不得覆盖用户已有的合法扩展配置；不兼容扩展需要显式提示并停用。

### 9.3 用户 AI 伙伴实例

用户在 AI 伙伴详情中看到：

```text
Skill
├─ 平台基线（只读）
│  ├─ 强制：劳动安全与审计规则
│  └─ 可选：行业分析模板
└─ 我的扩展
   ├─ 工作日报
   └─ 周报复盘
```

用户扩展属于当前实例，不写回平台模版。

### 9.4 行业对标结论

| 平台 | 实践 | 结论 |
| --- | --- | --- |
| Microsoft Copilot Studio Skills | Skill 是可移植能力包，用于扩展 Agent 能力而不修改核心 instructions | 支持“核心定义 + 可组合 Skill” |
| Anthropic Agent Skills | `SKILL.md` 组织指令、脚本和资源，按需渐进加载 | Skill 应可版本化、可复用，不应复制进每个会话 |
| OpenAI Agents SDK | Agent 定义承载 instructions、tools、MCP、guardrails；Runner 负责运行 | 定义与运行分离 |
| Dify Plugin | 市场或工作区安装插件，应用再选择使用能力 | 安装与绑定分离 |

参考：

- <https://learn.microsoft.com/en-us/microsoft-copilot-studio/agents-experience/skills-overview>
- <https://www.anthropic.com/research/equipping-agents-for-the-real-world-with-agent-skills>
- <https://openai.github.io/openai-agents-python/agents/>
- <https://docs.dify.ai/en/develop-plugin/getting-started/getting-started-dify-plugin>

### 9.5 Skill 清单展示规范

智能体定义与 AI 伙伴实例使用同一套 Skill 卡片语言，避免同一份能力在不同页面出现不同表达。

智能体定义页：

- 标题、目录行和详情页都显示 `Skills N`；
- 详情页提供只读的“企业预装清单”；
- 编辑页顶部显示已加载 Skill 摘要，详细配置保留在下方；
- 编辑页主区域只展示已加入当前定义的 Skill，通过右上角“从资源库添加”打开右侧抽屉多选；
- 个人模版不展示启用方式和内部场景标识；平台模版仅平台管理员可配置企业启用方式；
- 场景键由 Skill 包提供并在界面中展示为只读能力标签，不要求业务用户手填；
- 每个 Skill 显示版本、发布者、绑定模式、场景和说明。

AI 伙伴实例页：

- 顶部显示当前实例实际生效的 Skill 数量；
- 蓝色分组表示“平台预装”，只读且由智能体定义继承；
- 绿色分组表示“自定义扩展”，仅作用于当前实例，可独立移除；
- 每行最多展示 3 个 Skill 卡片；不展示卡片图片，标题与描述在左侧，业务操作固定在右上；
- 底部展示版本、分类、使用量、开发者等业务标签，只显示标签内容，不显示字段标题；
- 不在卡内重复来源、模式和场景；
- 点击整张卡片打开 Skill 详情弹窗，补充绑定模式、场景、状态和权限边界；
- 平台集成卡片没有业务操作；自定义扩展只提供“移除”；
- AI 伙伴实例页不再提供二次“可添加的 Skills”区；后续为实例添加 Skill 统一回到资源市场安装窗口完成。

资源市场 Skill 页复用同一卡片骨架、四类标签和三列布局；点击卡片查看详情，操作位只保留“安装”，已安装时显示为不可用的“已安装”。

安装交互采用“资源库安装 + 可选批量分配”：

- 点击“安装”先打开安装窗口；
- 默认仅安装到当前账号的 Skill 资源库；
- 可多选当前用户能够管理的 AI 伙伴，并在确认时批量添加为实例扩展；
- 不选择 AI 伙伴时，用户之后仍可从对应 AI 伙伴的 Skills 页面添加；
- 账号安装成功后，单个实例添加失败不回滚资源库安装，并分别返回成功和失败数量。

“安装到账号”和“添加到 AI 伙伴”仍是两个独立语义：前者决定 Skill 是否可用，后者决定某个实例是否启用。

卸载同样区分两层：AI 伙伴实例页的“移除”只解除当前实例绑定；资源市场的“卸载”会先检查并列出正在使用该 Skill 的 AI 伙伴，确认后清理实例绑定，再删除账号安装记录。

这种表达对应“一份定义清单、一份实例清单、运行时合并结果”，既不让用户误以为平台基线保存在实例中，也能直观看出当前实例为什么拥有某项能力。

### 9.6 最终归属决定

- 平台基线 Skill：放“智能体定义”；
- 用户扩展 Skill：放“AI 伙伴实例”；
- Skill 安装与版本：放“资源市场”；
- 运行时解析与快照：由服务端统一完成。

不把平台基线和用户扩展都塞进实例，也不允许用户直接编辑共享平台定义。

个人自建智能体模版由用户自己拥有，可直接在“智能体定义”配置 Skill。平台智能体模版由平台管理员维护，普通用户不复制、不分叉、不覆盖平台定义，只在自己的 AI 伙伴实例上增加受控扩展。这样同一平台模版可以持续升级，同时保留每个用户的局部业务能力。

---

## 10. 工作日报 Skill

### 10.1 场景标识

```text
scene = work-report
```

日报生成时由平台显式解析 `work-report` 场景，不依赖模型猜测是否调用。

同一场景只允许一个主日报格式 Skill 生效。

### 10.2 目标

日报用于让主管快速判断：

- 今天真正推进了什么；
- 产生了什么阶段性结果；
- 哪些风险需要升级；
- 哪些事项需要人类或主管协同；
- 下一步做什么。

日报不是任务流水、工具日志或模型思考记录。

### 10.3 输出结构

```markdown
## 一句话结论

## 关键进展
- 结果 + 证据，最多 4 条

## 阶段性结果
- 只保留完成、待验收、关键数字和里程碑

## 风险与需协同
- 风险、影响、需要谁介入、何时介入

## 下一步
- 最多 3 条
```

### 10.4 写作约束

- 默认目标长度 300–500 个中文字符，硬上限 800；
- 先结论后证据；
- 同类事项合并，不按任务逐条抄写；
- 已取消且没有管理风险的任务不展开；
- 不重复任务描述；
- 不展示思考过程、工具调用和内部排查；
- 公开事实、内部事实、分析判断、待确认事项分开；
- 没有证据的原因标为待核实；
- 不编造订单、库存、WMS、客户或财务数据；
- 不把“未覆盖区域”写成零；
- 需要人介入时必须写清对象和动作。

### 10.5 运行时加载

```text
生成日报
  → 获取实例引用模版
  → 解析平台基线 Skill
  → 合并实例用户扩展 Skill
  → 过滤无权或冲突 Skill
  → 选择 work-report 主处理器
  → 注入日报生成 Prompt
  → 生成精简 Markdown
  → 保存日报快照与 Skill 版本
```

日报快照至少记录：

- `templateId`；
- `templateVersion`；
- `skillId`；
- `skillVersion`；
- Skill 来源层；
- 任务和 Run 引用；
- 生成时间。

### 10.6 失败与降级

- Skill 加载失败时，不应静默使用错误版本；
- 主日报 Skill 不可用时，可按平台策略回退到内置日报模板；
- 回退必须记录原因；
- 历史日报不因 Skill 升级被重写。

---

## 11. 建议数据模型

以下为逻辑模型，具体表名在实施时按现有存储域约束确定。

### 11.1 Skill 定义

```text
SkillDefinition
  id
  name
  version
  description
  instructions
  scenes[]
  permissions[]
  resources[]
  publisher
  status
  createdAt
  updatedAt
```

### 11.2 Skill 安装

```text
SkillInstallation
  scopeType: platform-template | workspace | user
  scopeId
  skillId
  version
  status
  installedAt
```

### 11.3 平台模版 Skill 绑定

```text
TemplateSkillBinding
  templateId
  skillId
  versionConstraint
  mode: required | default | optional
  scenes[]
  enabled
```

### 11.4 实例扩展

```text
InstanceSkillExtension
  teammateId
  userId
  skillId
  versionConstraint
  scenes[]
  mode: additive | primary
  status
  createdBy
  updatedAt
```

### 11.5 运行快照

```text
EffectiveSkillSnapshot
  runId / reportId
  templateId
  templateVersion
  skillId
  skillVersion
  source: platform | user
  scene
  activated
```

---

## 12. API 设计原则

建议使用“发现、安装、绑定、解析”四类接口，不将动作混在一起。

### 12.1 资源市场

```text
GET  /api/collab/resources/skills
GET  /api/collab/resources/skills/installed
POST /api/collab/resources/custom
POST /api/collab/resources/skills/install
POST /api/collab/resources/skills/disable
```

### 12.2 平台智能体定义

```text
GET  /api/collab/teammate-templates/skills
POST /api/collab/teammate-templates/skills/bind
POST /api/collab/teammate-templates/skills/unbind
```

### 12.3 实例扩展

```text
GET  /api/collab/teammates/skills
POST /api/collab/teammates/skills/extend
POST /api/collab/teammates/skills/disable-extension
GET  /api/collab/teammates/skills/effective
```

### 12.4 公共约束

- 所有写接口要求同源和 Bearer Token；
- 资源市场安装校验用户权限；
- 平台模版绑定仅平台管理员或模版 owner；
- 实例扩展仅实例 owner 或管理员；
- 所有写操作记录审计；
- 绑定和扩展均幂等；
- 版本冲突返回明确错误，不静默降级。

---

## 13. 安全与治理

### 13.1 Skill 信任

- 只安装可信来源；
- 第三方 Skill 需要审核;
- 上传内容不允许执行任意 JavaScript；
- Skill 不得携带密钥；
- Skill 的资源引用遵守权限和来源策略；
- Skill 不得指示 Agent 上传项目数据到未授权外部地址。

### 13.2 权限边界

Skill 只能使用调用方已有的权限：

```text
Skill 请求的能力
  ∩ 用户权限
  ∩ 项目角色权限
  ∩ Runtime 能力
```

Skill 不能成为提权通道。

### 13.3 审计

必须记录：

- 谁上传；
- 谁安装；
- 谁绑定到哪个模版；
- 谁扩展了哪个实例；
- 哪个版本在哪个 Run / 日报中生效；
- 平台基线更新是否影响扩展；
- 用户何时停用扩展。

---

## 14. 迁移与兼容

1. 现有 AI 伙伴实例继续通过 `templateId` 引用定义。
2. 现有项目角色继续沿用项目角色服务，不回写员工角色表。
3. 现有旧 AI 1:1 会话只隐藏，不删除。
4. 现有日报继续保留历史快照。
5. 新增 Skill 字段必须向后兼容，旧模版无 Skill 时按空集合处理。
6. 平台模版新增 Skill 绑定不得自动覆盖用户已有扩展。
7. 旧任务消息中的超大正文不重新改写；新规则只作用于后续运行。

---

## 15. 验收标准

### 15.1 AI 伙伴会话

- 新建 1:1 不需要项目；
- 同一用户与同一实例只有一个可见规范会话；
- 点击列表项后右侧标题、时间和内容一致；
- 旧 `system.default` 会话不显示；
- 主页面和侧栏去重一致。

### 15.2 项目与权限

- 伙伴参与项目能被自动识别；
- 无员工档案但有项目角色的 AI 伙伴能显示角色；
- 项目角色权限与 Principal Grant 一致；
- 未授权区域不被写成零。

### 15.3 任务执行

- 终态 Run 能回写任务；
- 回写失败可重放；
- 完整文档写文件，消息只保留摘要；
- 消息不超过 20,000 字符；
- 用户最终只看到最终回复，不看到思考过程。

### 15.4 Skill

- 可从页面上传 Skill；
- 上传后可安装；
- 平台模版可绑定强制、默认和可选 Skill；
- 平台基线 Skill 不要求每个用户重复安装；
- 用户实例可追加扩展 Skill；
- 用户扩展 Skill 必须基于有效安装或工作区授权；
- 用户不能修改平台 Skill 原文；
- 运行时只加载有效且有权使用的版本；
- 日报生成明确加载 `work-report` Skill；
- 日报符合精简输出契约；
- 日报保存实际使用的 Skill 版本；
- 历史日报不受后续 Skill 升级影响。

### 15.5 工作负荷

- 详情和列表不显示沟通次数；
- 只展示运行时长和输出 Token。

---

## 16. 分阶段实施建议

### P0：统一 AI 伙伴运行边界

- 会话与项目解耦；
- 一个实例一个规范会话；
- 项目数据自动解析；
- 旧会话隐藏；
- 最终答复输出清洗；
- 项目角色读取支持 AI Principal；
- 长任务结果回写与重放。

### P1：Skill 基础治理

- Skill 上传和版本；
- 资源市场安装；
- Skill 定义、安装、绑定、运行快照分离；
- 平台智能体定义配置基线 Skill；
- 用户实例配置扩展 Skill。

### P2：工作日报 Skill

- 发布“工作日报”Skill；
- 增加 `work-report` 场景路由；
- 日报生成显式加载有效 Skill；
- 记录 Skill 版本；
- 完成资源市场 → 安装 → 平台定义 / 用户扩展 → 日报生成端到端测试。

### P3：治理增强

- Skill 审核；
- 版本兼容检查；
- 冲突可视化；
- 平台基线升级影响提示；
- Skill 使用分析；
- 扩展配置导出和恢复。

---

## 17. 非目标

本文不包含：

- 任意第三方 Skill 即时执行任意代码；
- 用户直接编辑平台智能体原始 SOUL；
- 用实例配置替代平台版本治理；
- 让 Skill 绕过项目和数据权限；
- 强制所有日报使用同一种模板；
- 将历史日报按最新 Skill 重新生成。

---

## 18. 相关现有设计

- [AI Teammate 模版 / 实例模型拆分设计](./teammate-template-instance-split-design.md)
- [Data Agent AI 伙伴实例配置](./data-agent-ai-partner-configuration.md)
- [工作台 2.0 与资源市场技术设计](./technical-design-workbench-plugin-market.md)
- [AI Teammate 运行态交互 PRD](./ai-teammate-runtime-interaction-prd.md)

