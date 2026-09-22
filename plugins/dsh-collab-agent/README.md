# dsh-collab-agent

Agent Profile 注册表与 Task Worker 运行时。Phase X 中工作流 Agent 节点通过
`collabAgent` 服务派发一次性运行；运行过程与结果记录在 `collab_agent` 存储，
不会创建左侧会话，也不进入会议。

当前能力是 **transitional Task Worker**，只用于工作流节点的受控一次性执行。
它不是员工模型里的 Digital Employee，也不是真人派出的 Human Avatar；
后续以 `collabEmployee` 和统一授权模型为准，本插件只保留为执行适配层。

详见 `docs/agent-workflow-execution-phase-x.md`。
