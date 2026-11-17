# dsh-collab-project

Out-of-tree DSH project management over DSH workspaces.

一个「项目」就是一条 DSH 工作区记录：项目清单、任务、工作流、会议与 Teammate
都按 `workspaceId` 归属。本插件在这一既有归属之上补齐项目管理域：

- 项目扩展信息（编码、负责人、状态、健康度、进度、起止日期、说明）以 `workspaceId`
  为键存入 `collab_project` 存储域；工作区标题与目录仍由 DSH 工作区注册表拥有。
- 项目编号在项目创建时生效：`PRJ` + 6 位数字（`PRJ000001` 起递增），
  订阅 `workspaceController.follow()`，已有的工作区在启动时补齐。
- 角色库是模版素材；项目模版按类型预置角色清单与工作流模版引用。项目创建 / 应用模版时
  把角色定义复制进项目，之后每个项目独立增删改自己的角色副本，互不影响。
- 项目角色采用「草稿 → 确认生效」：从模版加载 / 复用其他项目都只写入草稿，确认时整组覆盖；
  删除角色会提示受影响成员，并将引用该角色的进行中任务标记为「需改派」。
- 编辑已有角色时可选择「调整原有角色」或「创建新角色」；新角色自动生成新的 code，
  不会覆盖原角色。
- 已启动的工作流实例在启动时保存角色快照，后续项目角色编辑/删除不影响旧实例；新实例使用新角色集。
- 项目可保存常用「项目角色 → 成员 / AI伙伴」实例映射预设；创建工作流实例时默认预填，
  创建者仍可逐节点覆盖或重新选择。
- 成员的项目角色写入 `dsh-collab-roles` 的席位指派（`ctx.collabAssignment`），
  与任务派发、工作流 `role:` 执行人共用同一份真相。
- 项目成员目录同时返回 Human / AI Principal；前端以 `principal:<id>` 提交成员，
  后端归一化为账号或 Teammate 兼容 ID。工作区成员角色与项目角色同步写入 Principal Grant。
- 项目日报按 `senior-pm` 的项目健康度思路确定性生成：综合 RAG、计划进度偏差、
  已确认结果、风险登记、待确认事项与下一步；按日期和日报 / 周报 / 进度汇报类型保留历史快照。
- 项目日报默认在 `Asia/Shanghai` 每天 `08:00` 自动生成；项目负责人或平台管理员可调整启停、
  每天 / 工作日 / 每周 / 每月频次与时间。调度检查在服务启动后按分钟运行，同日已有日报时跳过覆盖。
- 项目创建时自动初始化平台预置「项目经理」AI伙伴，命名为 `PM_<项目名>`，
  自动加入项目成员并占用内置 `role-pm` 项目经理角色；启动时补齐存量项目。
  该实例属于项目托管实例，会出现在 AI伙伴运行列表中，并计入项目 AI伙伴统计。
- 项目经理 Agent 默认绑定官方「项目汇报生成」Skill。日报生成采用“确定性事实包 +
  PM Agent 撰写 + 服务端校验”，通过后再保存；Agent 不可用、运行失败或新增未支持数字时
  回退确定性模板，并在报告中标记“模板回退”和具体原因。
- 项目历史记录独立存放在 `collab_project.audit`，只追加不覆盖；覆盖项目设置、成员项目角色、
  项目角色、模版应用、日报生成，并合并协作身份服务中与该项目相关的历史成员操作。
  新事件同时记录 `actorPrincipalId`，兼容保留 `actorId`。
  当前审计访问沿用平台管理员 / 工作区负责人口径，不接项目自定义角色权限，后续由平台统一权限体系接管。
- 平台级账号与角色权限不在本模块内编辑：接口只读展示平台角色，成员变更只涉及项目
  （工作区）成员资格与项目角色席位。
- 工作区成员角色 `owner/member/guest` 属于项目成员关系，可由平台管理员或工作区负责人维护；
  这不是平台账号的全局角色，不会修改账号状态、密码或平台角色。
- 项目详情展示工作区 ID / 路径并支持复制；成员信息包含工作区角色和加入时间，普通成员可主动退出项目。

## 浏览器接口

同源 + Bearer 保护，位于 `/api/collab/projects/*`：

`GET /api/collab/projects`（项目清单与统计）、`GET /api/collab/projects/detail`、
`POST /api/collab/projects/create`（注册目录为项目）、
`POST /api/collab/projects/update`、`GET /api/collab/projects/templates`、
`POST /api/collab/projects/templates/save|remove|apply`、
`POST /api/collab/projects/roles/save|remove`、
`POST /api/collab/projects/role-mappings/save|remove`、
`POST /api/collab/projects/members/save|remove`、
`POST /api/collab/projects/leave`、
`GET /api/collab/projects/reports`、`POST /api/collab/projects/reports/schedule`、
`POST /api/collab/projects/reports/generate`、
`GET /api/collab/projects/history`。

写操作要求平台管理员或项目（工作区）负责人；项目模版与项目角色库属于平台字典，
仅平台管理员可维护。
