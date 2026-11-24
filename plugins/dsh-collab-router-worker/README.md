# dsh-collab-router-worker

Default-off Router / Worker task planning add-on for the existing task UI.

- Workspace-scoped settings are stored in `collab_router_worker`.
- The Workspace selects a default Router Agent. A plan pins the selected
  Router when it is created; changing the default never rewrites existing
  plans.
- Router is a plugin-owned Agent type, not a display name. A Router candidate
  must be an AI Teammate whose template exposes both Router submission tools.
  Data Agent, meeting Facilitator, and other ordinary Agents are never listed
  as Router candidates.
- The first enabled Workspace automatically provisions a workspace-owned
  `通用任务 Router` AI Teammate and resolves its Employee, Principal, Persona,
  and Agent Profile through the public Teammate runtime before dispatch.
- Multiple domain-specific Router instances can be registered, such as
  supply-chain, software-delivery, or research Routers, as long as their
  templates declare the Router tool contract.
- Router runs are independent Agent runs bound to a trusted `router_cycles`
  record. They do not replace or inherit the master task owner.
- Plans and immutable plan versions are plugin-owned.
- Confirmed plans materialize ordinary platform Tasks through the public task API.
- Agent nodes are dispatched through the existing Task dispatch chain.
- The Router tool can submit only a structured Plan Draft; it cannot approve or
  dispatch a plan.
- Once every required node is accepted, a Router finalization cycle creates a
  non-binding delivery draft. Human-owned master tasks stay in progress;
  agent-owned master tasks can be submitted to human Review, never approved
  automatically.
- Workflow templates can be started through the existing Workflow API and
  mirrored into a plugin-owned plan.
- The Reconciler starts only after plan materialization and stops on disable or
  when no active plans remain.
- Disabling changes active plans to `resume_required`; re-enabling never resumes
  execution automatically.

No fields are added to core Task, Workflow, Member, or Permission records.
