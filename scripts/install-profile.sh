#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DSH_HOME="$ROOT/.tmp/dsh-home"
DSH_BIN="$ROOT/vendor/deepseek-harness/apps/cli/lib/bin.js"
PROFILE_DIR="$DSH_HOME/profiles/pluginmax"

if [[ ! -f "$DSH_BIN" ]]; then
  echo "upstream DSH CLI is not built: $DSH_BIN" >&2
  echo "run ./scripts/bootstrap.sh first" >&2
  exit 1
fi

mkdir -p "$DSH_HOME"
rm -rf "$PROFILE_DIR"

DSH_HOME="$DSH_HOME" node "$DSH_BIN" plugin --profile pluginmax add "$ROOT/plugins/dsh-pluginmax-canary"
DSH_HOME="$DSH_HOME" node "$DSH_BIN" plugin --profile pluginmax add "$ROOT/plugins/dsh-collab-identity"
DSH_HOME="$DSH_HOME" node "$DSH_BIN" plugin --profile pluginmax add "$ROOT/plugins/dsh-collab-space"
DSH_HOME="$DSH_HOME" node "$DSH_BIN" plugin --profile pluginmax add "$ROOT/plugins/dsh-collab-roles"
DSH_HOME="$DSH_HOME" node "$DSH_BIN" plugin --profile pluginmax add "$ROOT/plugins/dsh-collab-meeting"
node "$ROOT/scripts/add-web-bundle.mjs" "$PROFILE_DIR/package.json"

echo "installed profile: $PROFILE_DIR"
