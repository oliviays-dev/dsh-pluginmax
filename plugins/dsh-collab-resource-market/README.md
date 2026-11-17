# dsh-collab-resource-market

Platform-level resource market for the `resource-market` route. It serves the
Skill, MCP, workbench-template, and panel-plugin catalogs. User "install"
operations enable already-packaged DSH capabilities; they never download or
execute arbitrary client code.

Skill and MCP catalogs can be supplied by optional `collabSkillCatalog` and
`collabMcpCatalog` providers. Without a provider, the service uses immutable
seed metadata. Seed MCP entries may be `pending` or `off`, but never report
`connected`; `connected` is accepted only from a real MCP provider.

The official `项目汇报生成` skill is published with the platform catalog. Normal
users may install it and attach it to their own AI partners; only platform
administrators can update the official instructions through
`POST /api/collab/resources/skills/official/save`.

Skills that customize a specific component declare `mountTargets` with
`type: "component-slot"`. A target ID combines the host panel and slot, for
example `workbench.panel.pluginmax.daily-brief#project-summary`. Installation
records keep these relationships in `bindings`; each target has at most one
active skill. Users can select targets during installation and switch between
installed compatible skills through
`POST /api/collab/resources/skills/binding`. A consuming component resolves its
current skill with
`GET /api/collab/resources/skills/binding?targetId=<component-slot-id>`.

Workbench market responses include publisher/compatibility filters, pagination,
real panel titles, dependency status, and compatibility information. Template
copy and panel-add calls are idempotent when the client supplies an
`Idempotency-Key`.

All market tabs use the same category taxonomy: `全部`, `AI办公`, `计划`, `采购`,
`生产`, `质量`, `仓配`, `供应商`, `履约`, and `自定义`.

The `自定义` category accepts private user metadata registrations and an optional
JSON manifest. Registrations are persisted in `custom_assets`; uploaded content is
never executed and does not modify the DSH Client Modules graph. Users can remove
their own registrations, and platform administrators can remove test or invalid
entries.

Custom resources can be edited in place through
`PATCH /api/collab/resources/custom`. Owners can update their own metadata,
manifest, and sharing scope; platform administrators can also edit resources
that have already been shared to the market. Private resources remain visible
to their owner only.

Template previews render current-account panel data in a read-only modal before
the user applies the template.
