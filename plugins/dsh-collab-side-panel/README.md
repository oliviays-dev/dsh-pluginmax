# dsh-collab-side-panel

Platform-level client service for the shared right-side panel.

Business plugins register tab types through `window.__pluginmaxSidePanel.registerType()`.
The service owns tab lifecycle, ordering, active state, singleton rules, collapse,
and panel visibility. It does not own communication, Data Agent, or task draft data.
