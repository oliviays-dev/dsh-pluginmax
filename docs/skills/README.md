# 手动安装 Skill

资源市场的 Skill 上传支持以下格式：

- `*.skill.zip`：推荐方式，直接上传完整包；
- `SKILL.md`：适合直接维护可读指令；
- `skill.json`：包含完整元数据，上传后会自动填充名称、说明、版本、权限和触发场景。

手动安装时可直接选择：

- `packages/work-report.skill.zip`
- `packages/competitive-analysis.skill.zip`
- `packages/project-reporting.skill.zip`

安装完成后，在目标 AI 伙伴实例的 `Skills` 页面中追加对应 Skill。

平台预置的项目经理模板默认绑定官方「项目汇报生成」Skill，源文件位于
`docs/skills/project-reporting/`。普通用户可在资源市场安装后追加到自己的 AI 伙伴；
平台管理员可在资源市场详情中编辑官方版本。
