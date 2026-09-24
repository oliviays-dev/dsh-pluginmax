# dsh-collab-roles

Out-of-tree DSH role services for personas, workspace type recipes, and workspace seat assignments.

The plugin owns `collabPersonas`, `collabWorkspaceType`, and `collabAssignment`. Persona and type assets are stored under `$DSH_HOME/pluginmax`; materialized workspace state uses the `collab_assignment` storage domain. Browser routes are available when identity provides `collabTeam`.
