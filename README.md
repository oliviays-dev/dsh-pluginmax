# dsh-pluginmax

DSH Pluginmax is an out-of-tree collaboration plugin suite for DeepSeek Harness. This repository intentionally contains no fork of DSH and no patches to upstream source files. The compatibility baseline is the `vendor/deepseek-harness` submodule at `d347e703908d0406b7a7ef80e3a0e594d86b2215` (`@deepseek-ai/dsh@0.1.3-alpha.1`).

## Current milestone

The current milestone is R2. It adds `dsh-collab-space`, which provides:

- `ctx.collabSharing`: policy-gated workspace/session sharing, global approval requests, path-safe atomic writes, and secret scanning
- `ctx.collabLock` and `ctx.collabDigest`: advisory locks and redacted session summaries
- same-origin Bearer-protected `/api/collab/space/*` routes
- `/share`, `collab_share`, `collab_global_read`, and approval-gated `collab_global_write`
- a Chinese Settings section for uploads, policies, locks, global approvals, digests, and audit records

Global shares stay outside sandbox writable roots. Agents access them only through the plugin tool gateway, and agent global writes require an approval decision.

R1 adds `dsh-collab-identity`, which provides:

- `ctx.collabTeam`: users, scrypt passwords, bearer sessions, workspace members, and audit records
- same-origin `/api/collab/auth/*` and `/api/collab/team/*` routes
- an anonymous-safe `/identity` command and `collab_identity` tool
- a Chinese Settings section for bootstrap/login, password changes, member management, and the audit timeline

The durable domains use snake-case names (`collab_team`, `collab_sharing`, `collab_config`, and `collab_locks`) because the locked DSH storage API only accepts snake-case unit names; they own the product domains otherwise described as `collab.team`, `collab.sharing`, `collab.config`, and `collab.locks`.

R0 provides the repository foundation and `dsh-pluginmax-canary`, which validates:

- local `link:` bundle installation
- `ctx.storageDomain`
- `ctx.commands`
- `ctx.tools`
- `ctx.webServer`
- `settings.section` through `dsh.client`
- clean submodule ownership and disposable `DSH_HOME`

The seven product plugins will be added milestone by milestone under `plugins/`.

## Setup

```sh
./scripts/bootstrap.sh
./scripts/install-profile.sh
./scripts/smoke.sh
```

Bootstrap builds both this workspace and the locked upstream DSH checkout. Installation and smoke testing always use `.tmp/dsh-home`; they do not touch `~/.dsh`.

## Development

```sh
pnpm check
```

This runs typecheck, lint, unit tests, package builds, bundle contracts, and dry-run pack validation.

Run only the web smoke server:

```sh
PLUGINMAX_SMOKE_PORT=33117 ./scripts/smoke.sh
```

## Upstream policy

The upstream submodule is read-only. To evaluate a new master ref, create a branch and run:

```sh
./scripts/upgrade-upstream.sh <commit>
./scripts/bootstrap.sh
pnpm check
```

Do not edit files under `vendor/deepseek-harness`. A CI check fails if the submodule is dirty or its checked-out commit drifts from the reviewed gitlink.
