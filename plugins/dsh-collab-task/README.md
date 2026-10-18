# dsh-collab-task

Task and Issue management for DSH Pluginmax. The plugin owns the
`collab_task` storage domain and exposes authenticated workspace-scoped task
routes under `/api/collab/tasks/*`.

It provides task records, assignment to people, digital employees, or role
seats, status transitions, acceptance steps, executor messages, comments,
replies, activity events, and external links to meetings/workflows.

Task receivers accept canonical `principal:<id>` references plus `employee:<id>`
and account/teammate aliases. The compatibility receiver ID remains on the
record, with `receiverPrincipalId` and Principal-aware task events alongside it.
Principal Runtime dispatch issues a context-bound Action Ticket and records the
ticket plus `principalType: principal-runtime` on the Agent Run.
