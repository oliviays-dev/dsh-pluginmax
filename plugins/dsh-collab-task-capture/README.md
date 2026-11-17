# dsh-collab-task-capture

Owns task capture sessions, task draft batches, drafts, conversion records and
task origins for DSH Pluginmax.

The plugin depends on the public `collabTaskCreation` capability exposed by
`dsh-collab-task`. It never writes the task storage domain directly.

AI private chats use the virtual `system.default` project. Authenticated users
may capture drafts from that default project without a real workspace
membership, and drafts remain owner-scoped. Real workspaces still require
membership; platform admins retain their existing override.
