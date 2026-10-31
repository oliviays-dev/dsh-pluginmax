# dsh-collab-resource-market

Platform-level resource market for the `resource-market` route. It serves the
Skill, MCP, workbench-template, and panel-plugin catalogs. User "install"
operations enable already-packaged DSH capabilities; they never download or
execute arbitrary client code.

Skill and MCP catalogs can be supplied by optional `collabSkillCatalog` and
`collabMcpCatalog` providers. Without a provider, the service uses immutable
seed metadata. Seed MCP entries may be `pending` or `off`, but never report
`connected`; `connected` is accepted only from a real MCP provider.

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

Template previews render current-account panel data in a read-only modal before
the user applies the template.
