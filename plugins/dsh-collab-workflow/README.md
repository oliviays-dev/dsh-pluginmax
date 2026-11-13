# dsh-collab-workflow

Workspace-scoped workflow definitions and instances for DSH Pluginmax. The
plugin provides Markdown import, deterministic validation, approvals, decision
routing, controlled loops, sub-workflows, a native conversation tab, and a
settings management surface.

Definitions have an explicit `project` or `platform` scope. Project templates
are visible only inside their owning workspace; platform templates are visible
to every workspace and can only be published or managed by platform admins.
Legacy definitions migrate to `platform` to preserve their previous global
visibility.

Template nodes distinguish `assigned` and `claim` dispatch. Role actors default
to `claim`; fixed people and AI partners default to `assigned`. Fixed bindings
carry `required` or `suggested` portability, and platform templates can use
`role-code:<CODE>` for stable cross-project role slots.

Instance creation uses a read-only preflight endpoint to resolve every executor
and approver against the target project before any instance, task, or Agent run
is created. Resolved `assignmentBindings` and `approvalBindings` are stored on
the instance. Candidate-pool task claims are serialized and invoke a workflow
callback so only the first successful claimant owns the node.

Project role-mapping presets are loaded during preflight as suggested values.
The creator can reuse the same role mapping across multiple nodes, override one
node, or save the current role mapping back to the project.

Executors and approvers accept `principal:<id>` references. They are resolved
to the existing user/employee actor model during parsing, while runs and
workflow events record the canonical `principalId` for new execution.
Teammate executors with a Principal Runtime Profile are dispatched as
`principal-runtime` runs with a context-bound Action Ticket.
