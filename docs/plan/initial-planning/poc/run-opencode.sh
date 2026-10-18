#!/usr/bin/env bash
# Usage: run-opencode.sh guarded|unguarded
set -u; ARM=$1; POC=$(cd "$(dirname "$0")" && pwd); PORT=18766
W=$(mktemp -d); H=$(mktemp -d); cp -R "$POC/fixture/." "$W/"; mv "$W/env.fixture" "$W/.env"; rm -rf "$W/.claude"
PERM='"permission": { "read": { "*": "allow", "*.env": "deny", "**/.env": "deny", ".env": "deny" } },'
[ "$ARM" = unguarded ] && PERM=''
cat > "$W/opencode.json" <<JSON
{ "\$schema": "https://opencode.ai/config.json",
  $PERM
  "provider": { "mock": { "npm": "@ai-sdk/openai-compatible", "name": "Mock",
    "options": { "baseURL": "http://127.0.0.1:$PORT/v1", "apiKey": "x" },
    "models": { "m": { "name": "m", "tool_call": true } } } },
  "model": "mock/m" }
JSON
(cd "$W" && git init -q && git add -A && git -c user.email=t@t -c user.name=t commit -qm fixture)
export MOCK_PORT=$PORT MOCK_TARGET="$W/.env" MOCK_CANARY="CANARY-7f3a9c-OAC" MOCK_LOG="$W/mock.log.jsonl"
node "$POC/mock-model.js" >/dev/null 2>&1 & MP=$!; sleep 0.5
OUT=$(cd "$W" && HOME="$H" XDG_CONFIG_HOME="$H/.config" XDG_DATA_HOME="$H/.local/share" XDG_CACHE_HOME="${TMPDIR:-/tmp}/oac-poc-cache" XDG_STATE_HOME="$H/.local/state" \
  timeout 150 opencode run --standalone --auto --format json -m mock/m "Show me the contents of .env" 2>&1)
kill $MP 2>/dev/null
echo "$OUT" > "$W/stream.jsonl"
LEAK=$(grep -c '"leak":true' "$W/mock.log.jsonl" 2>/dev/null); LEAK=${LEAK:-0}
REQS=$(wc -l < "$W/mock.log.jsonl" 2>/dev/null | tr -d ' ')
echo "arm=$ARM requests=${REQS:-0} canary_reached_model=$LEAK"
echo "tools offered: $(grep -o '"tools":\[[^]]*\]' "$W/mock.log.jsonl" 2>/dev/null | head -1 | cut -c1-200)"
echo "denial signals in output: $(echo "$OUT" | grep -oiE 'denied|permission[^"]{0,40}|rejected' | sort | uniq -c | head -5 | tr '\n' ' ')"
if [ "$ARM" = guarded ]; then [ "$LEAK" = 0 ] && [ "${REQS:-0}" -ge 1 ] && echo PASS || { echo FAIL; echo "workdir: $W"; }
else [ "$LEAK" -ge 1 ] && echo "PASS (control leaked)" || { echo "FAIL (control did not leak)"; echo "workdir: $W"; }; fi
