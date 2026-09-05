#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DSH_HOME="$ROOT/.tmp/dsh-home"
DSH_BIN="$ROOT/vendor/deepseek-harness/apps/cli/lib/bin.js"
LOG="$ROOT/.tmp/pluginmax-web.log"
COOKIE="$ROOT/.tmp/pluginmax-smoke.cookies"
BODY="$ROOT/.tmp/pluginmax-smoke.body.json"
PORT="${PLUGINMAX_SMOKE_PORT:-33117}"
HEALTH_URL="http://127.0.0.1:$PORT/api/collab/canary/health"
IDENTITY_BASE="http://127.0.0.1:$PORT/api/collab"

if [[ ! -f "$DSH_BIN" ]]; then
  echo "upstream DSH CLI is not built; run ./scripts/bootstrap.sh" >&2
  exit 1
fi

mkdir -p "$ROOT/.tmp"
: > "$LOG"
rm -f "$COOKIE"
rm -f "$DSH_HOME/storages/collab_team.json"

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

canary_ready=false
for _ in {1..20}; do
  if body="$(curl -fsS -b "$COOKIE" "$HEALTH_URL" 2>/dev/null)"; then
    echo "$body"
    if [[ "$body" == *'"ok":true'* && "$body" == *'"domain":"pluginmax_canary"'* ]]; then
      canary_ready=true
      break
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

if [[ "$canary_ready" != true ]]; then
  echo "timed out waiting for $HEALTH_URL" >&2
  cat "$LOG" >&2
  exit 1
fi

expect_code() {
  local expected="$1"
  local actual="$2"
  local label="$3"
  if [[ "$actual" != "$expected" ]]; then
    echo "$label expected HTTP $expected, got $actual" >&2
    cat "$BODY" >&2
    exit 1
  fi
}

api() {
  local method="$1"
  local path="$2"
  local token="${3:-}"
  local data="${4:-}"
  local origin="${5:-}"
  local args=(
    -sS
    -o "$BODY"
    -w '%{http_code}'
    -X "$method"
    -b "$COOKIE"
  )
  if [[ -n "$origin" ]]; then args+=(-H "Origin: $origin"); fi
  if [[ -n "$token" ]]; then args+=(-H "Authorization: Bearer $token"); fi
  if [[ -n "$data" ]]; then
    args+=(-H "Content-Type: application/json" -d "$data")
  fi
  curl "${args[@]}" "$IDENTITY_BASE$path"
}

code="$(curl -sS -o "$BODY" -w '%{http_code}' -b "$COOKIE" "$IDENTITY_BASE/auth/status")"
expect_code 200 "$code" "identity status"
grep -q '"initialized":false' "$BODY" || {
  echo "identity should start uninitialized" >&2
  cat "$BODY" >&2
  exit 1
}

code="$(api POST /auth/bootstrap "" '{"userId":"admin","name":"Admin","password":"password-123"}' "https://evil.example")"
expect_code 403 "$code" "cross-origin bootstrap"

code="$(api GET /auth/me "wrong-token")"
expect_code 401 "$code" "invalid bearer token"

code="$(api POST /auth/bootstrap "" '{"userId":"admin","name":"Admin","password":"password-123"}')"
expect_code 201 "$code" "identity bootstrap"
TOKEN="$(node -e 'const body=require(process.argv[1]);process.stdout.write(body.token)' "$BODY")"

code="$(api GET /auth/me "$TOKEN")"
expect_code 200 "$code" "current identity"
grep -q '"role":"admin"' "$BODY" || {
  echo "bootstrap account should be admin" >&2
  cat "$BODY" >&2
  exit 1
}

code="$(api POST /team/users/create "$TOKEN" '{"userId":"member","name":"Member","password":"password-456","role":"member"}')"
expect_code 201 "$code" "member creation"

code="$(api PUT /team/members/set "$TOKEN" '{"workspaceId":"main","userId":"member","role":"owner"}')"
expect_code 200 "$code" "workspace member add"

code="$(api GET "/team/members?workspaceId=main" "$TOKEN")"
expect_code 200 "$code" "workspace member list"
grep -q '"userId":"member"' "$BODY" || {
  echo "workspace member list is missing member" >&2
  cat "$BODY" >&2
  exit 1
}

code="$(api GET /team/audit "$TOKEN")"
expect_code 200 "$code" "identity audit"
grep -q '"action":"member_add"' "$BODY" || {
  echo "audit timeline is missing member_add" >&2
  cat "$BODY" >&2
  exit 1
}

code="$(api POST /auth/bootstrap "" '{"userId":"other","name":"Other","password":"password-789"}')"
expect_code 409 "$code" "duplicate bootstrap"

code="$(api POST /auth/logout "$TOKEN")"
expect_code 200 "$code" "identity logout"

echo "Pluginmax canary and identity smoke passed on port $PORT"
exit 0
