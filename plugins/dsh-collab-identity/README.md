# dsh-collab-identity

R1 identity plugin for DSH Pluginmax. It owns the `collab.team` storage domain and provides `ctx.collabTeam` with password login, bearer sessions, workspace membership, and an append-only audit trail.

The browser surface is limited to same-origin `/api/collab/*` requests carrying the plugin-owned bearer token. The Agent command and tool surfaces expose only sanitized identity status and account data, and safely degrade to anonymous status when no identity is bound.
