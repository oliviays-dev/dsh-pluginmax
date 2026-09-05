#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DSH_HOME="$ROOT/.tmp/dsh-home"
DSH_BIN="$ROOT/vendor/deepseek-harness/apps/cli/lib/bin.js"
LOG="$ROOT/.tmp/pluginmax-web.log"
COOKIE="$ROOT/.tmp/pluginmax-smoke.cookies"
PORT="${PLUGINMAX_SMOKE_PORT:-33117}"
HEALTH_URL="http://127.0.0.1:$PORT/api/collab/canary/health"

if [[ ! -f "$DSH_BIN" ]]; then
  echo "upstream DSH CLI is not built; run ./scripts/bootstrap.sh" >&2
  exit 1
fi

mkdir -p "$ROOT/.tmp"
: > "$LOG"
rm -f "$COOKIE"

DSH_HOME="$DSH_HOME" node "$DSH_BIN" --profile pluginmax --no-open --port "$PORT" >"$LOG" 2>&1 &
pid=$!
cleanup() {
  kill "$pid" >/dev/null 2>&1 || true
  wait "$pid" >/dev/null 2>&1 || true
}
trap cleanup EXIT

launch_url=""
for _ in {1..120}; do
  launch_url="$(sed -nE 's/^.*dsh web: (http:\/\/[^[:space:]]+).*$/\1/p' "$LOG" | tail -n 1)"
  if [[ -n "$launch_url" ]]; then
    break
  fi
  if ! kill -0 "$pid" >/dev/null 2>&1; then
    echo "DSH exited before smoke completed" >&2
    cat "$LOG" >&2
    exit 1
  fi
  sleep 1
done

if [[ -z "$launch_url" ]]; then
  echo "timed out waiting for DSH web launch URL" >&2
  cat "$LOG" >&2
  exit 1
fi

# DSH protects /api with an authority-bound HttpOnly browser cookie.
# Exchange the process launch URL for that cookie before probing the plugin.
if ! curl -fsS -c "$COOKIE" -o /dev/null "$launch_url"; then
  echo "could not exchange the DSH launch URL for a browser cookie" >&2
  cat "$LOG" >&2
  exit 1
fi

for _ in {1..20}; do
  if body="$(curl -fsS -b "$COOKIE" "$HEALTH_URL" 2>/dev/null)"; then
    echo "$body"
    if [[ "$body" == *'"ok":true'* && "$body" == *'"domain":"pluginmax_canary"'* ]]; then
      echo "Pluginmax canary smoke passed on port $PORT"
      exit 0
    fi
    echo "unexpected canary response: $body" >&2
    exit 1
  fi
  if ! kill -0 "$pid" >/dev/null 2>&1; then
    echo "DSH exited while probing canary health" >&2
    cat "$LOG" >&2
    exit 1
  fi
  sleep 1
done

echo "timed out waiting for $HEALTH_URL" >&2
cat "$LOG" >&2
exit 1
