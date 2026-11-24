# dsh-collab-task-dispatch

Task queue planning and AI teammate recommendation view.

- Reads tasks, AI teammate definitions, project availability, skills, and queue depth.
- Builds an in-memory dispatch plan; no task is mutated during drafting or validation.
- Commits only through the existing task service `assign` method, without changing the
  default dispatch behavior of the task module.
- Registers `pluginmax.task.dispatch-view`; the task page shows it only when the plugin is
  loaded and the current user is a platform administrator.
