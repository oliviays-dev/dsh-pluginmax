# dsh-collab-workbench-v2

Multi-workbench host for the "工作台（New）" route. It owns workbench instances,
layouts, revisions, preferences, entitlements, and the typed
`workbench.canvas.panel` slot. Figure panels are provided by DSH client plugins.

The legacy `dsh-collab-workbench` route and storage domain are intentionally not
modified.

Market-driven panel additions re-check ownership and revision before writing an
entitlement. Template copies validate packaged, disabled, and compatible
dependencies, enable available required panels, and support `Idempotency-Key`
for safe retries.
