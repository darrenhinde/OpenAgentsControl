#!/usr/bin/env bash
#
# The drift gate: regenerate the committed trees from content/agents/**, then fail if the
# build changed anything. This is the structural guarantee the canonical refactor rests on —
# generated trees stay COMMITTED, so a hand-edit to one must turn CI red rather than merely
# being discouraged.
#
# ── Why a write build and not `oac build --check` ────────────────────────────────────────
#
# `check()` (BuildPipeline.ts) compares the PLANNED files against disk and reports orphans
# from the manifest. It never compares `.oac/build-manifest.json` itself — the manifest is
# only ever written by `write()`. Since the manifest is committed (it is the ledger orphan
# pruning reasons from), a `--check` gate would let the manifest drift silently, and a fresh
# clone with a stale ledger prunes the wrong set. So: real build, then ask git.
#
# ── Why before/after and not a bare `git status` ─────────────────────────────────────────
#
# In CI the checkout is clean, so "clean after the build" and "unchanged by the build" are
# the same statement. Locally they are not: `.opencode/agent/eval-runner.md` is a real,
# shipped, hand-authored agent with no canonical source, and any contributor may have
# unrelated work in progress under these roots. Comparing the status BEFORE the build to the
# status AFTER attributes drift to the build rather than to the worktree — pre-existing dirt
# appears in both snapshots and cancels. The gate stays honest and stays runnable locally,
# which is the only way contributors ever see it fail before CI does.
#
set -euo pipefail

# `oac build` resolves content/ against the CWD — from anywhere else it exits 1 with ENOENT.
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"

# The trees `oac build` emits IN PLACE, and therefore everything this gate watches.
# plugins/claude-code/** is deliberately absent: it stages to .tmp/oac-build/ (gitignored)
# and is compared only, never emitted. Permissions no longer block emitting it in place --
# oac.overrides.claude-code settled those -- but prompt content does: the shipped files carry
# dispatch <example> blocks and capability-adapted bodies that canonical has no field for.
# See the docblock in packages/cli/src/commands/build.ts.
GENERATED=(.opencode/agent registry.json .oac/build-manifest.json)

if [ ! -f packages/cli/dist/index.js ]; then
  echo "error: packages/cli/dist/index.js is missing — build the CLI first:" >&2
  echo "  pnpm --dir packages/compatibility-layer run build" >&2
  echo "  pnpm --dir packages/cli run build" >&2
  exit 1
fi

snapshot() { git status --porcelain -- "${GENERATED[@]}"; }

before="$(snapshot)"
bun packages/cli/dist/index.js build
after="$(snapshot)"

if [ "$before" = "$after" ]; then
  echo ""
  echo "✅ No drift — the generated trees match content/agents/**."
  exit 0
fi

cat >&2 <<'EOF'

❌ The generated trees drift from the canonical source.

Files under .opencode/agent/, registry.json and .oac/build-manifest.json are BUILD OUTPUT.
They are committed, but they are not hand-edited: `oac build` regenerates them from
content/agents/**, and this gate fails when the committed bytes disagree with what the
build produces.

To fix:
  1. Make your change in content/agents/** (the canonical source), not in the output.
  2. Run:  make build-canonical
  3. Commit the regenerated files along with your source change.

Paths the build changed:
EOF

# Only the paths whose status the BUILD moved. Diffing the whole roots instead would dump
# every unrelated dirty file in the worktree — including `.opencode/agent/eval-runner.md`,
# which is hand-authored, has no canonical source, and is none of this gate's business.
#
# BOTH sides of the delta matter, and the `<` side is the one that is easy to get wrong.
# When a contributor hand-edits a generated file, the build REWRITES it back to canonical, so
# the path is dirty BEFORE and clean AFTER — it leaves the status as a `<` line, never a `>`.
# Matching only `>` would make the single most likely drift print an empty list.
# `sed 's/^[<>] ...//'` drops diff's marker, then git's two-char status field and its space.
drifted=()
while IFS= read -r line; do
  [ -n "$line" ] && drifted+=("$line")
done < <(diff <(printf '%s\n' "$before") <(printf '%s\n' "$after") |
  sed -n 's/^[<>] ...//p' | sort -u)

if [ ${#drifted[@]} -eq 0 ]; then
  # Unreachable: the snapshots differ, so some path moved. Fail loudly rather than pretend.
  echo "  (could not attribute the drift to a path — snapshots differ but no path parsed)" >&2
  exit 1
fi

printf '  %s\n' "${drifted[@]}" >&2

echo "" >&2
echo "Diff:" >&2
git --no-pager diff -- "${drifted[@]}" >&2

exit 1
