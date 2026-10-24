# dsh-collab-context

The platform context assembly center.

- Registers scene adapters for tasks, meetings, workflow nodes and chat.
- Creates one isolated session per scene object and AI companion.
- Produces immutable `ContextPack` snapshots and `ContextReceipt` records.
- Delivers versioned scene contributions incrementally across reruns.
- Enforces workspace/project boundaries and deterministic prompt rendering.
- Supports native chat sessions and meeting-module AI conversations.

The plugin owns the `collab_context` storage domain and exposes
`ctx.collabContext`.
