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
