#!/usr/bin/env bash
#
# The drift gate: regenerate the committed trees from agent-library/** (agents, skills, commands), then fail if the
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

# `oac build` resolves agent-library/ against the CWD — from anywhere else it exits 1 with ENOENT.
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"

# The trees `oac build` emits IN PLACE, and therefore everything this gate watches.
# built-ai-configs/ holds every target's primary output side by side (built-ai-configs/opencode, built-ai-configs/opencode-v1,
# built-ai-configs/claude-code); .opencode/agent and plugins/claude-code/agents are byte-identical
# generated mirrors of built-ai-configs/opencode/agent and built-ai-configs/claude-code/agents, so a hand-edited
# mirror is drift too. The Claude agents are build output like the rest (D-017): their
# frontmatter comes from oac.overrides.claude-code and their body from <!-- oac:only --> host
# blocks in agent-library/agents/**. See the docblock in packages/cli/src/commands/build.ts.
# Skills and commands are mirrored the same way: .opencode/skills and .opencode/command copy the
# OpenCode v2 build, plugins/claude-code/skills and plugins/claude-code/commands copy the Claude one.
GENERATED=(built-ai-configs .opencode/agent .opencode/skills .opencode/command plugins/claude-code/agents plugins/claude-code/skills plugins/claude-code/commands built-ai-configs/registry/registry.json built-ai-configs/registry/registry.v1.json .oac/build-manifest.json)

if [ ! -f packages/cli/dist/index.js ]; then
  echo "error: packages/cli/dist/index.js is missing — build the CLI first:" >&2
  echo "  pnpm --dir packages/agent-compiler run build" >&2
  echo "  pnpm --dir packages/cli run build" >&2
  exit 1
fi

snapshot() { git status --porcelain -- "${GENERATED[@]}"; }

before="$(snapshot)"
bun packages/cli/dist/index.js build
after="$(snapshot)"

if [ "$before" = "$after" ]; then
  echo ""
  echo "✅ No drift — the generated trees match agent-library/**."
  exit 0
fi

cat >&2 <<'EOF'

❌ The generated trees drift from the canonical source.

Files under built-ai-configs/, .opencode/{agent,skills,command}/, plugins/claude-code/{agents,skills,commands}/,
built-ai-configs/registry/registry.json, built-ai-configs/registry/registry.v1.json and .oac/build-manifest.json are
BUILD OUTPUT (the .opencode/ and plugins/claude-code/ folders are byte-identical mirrors of
built-ai-configs/opencode/ and built-ai-configs/claude-code/). They are committed, but they are not hand-edited:
`oac build` regenerates them from agent-library/{agents,skills,commands}/**, and this gate fails when the
committed bytes disagree with what the build produces.

To fix:
  1. Make your change in agent-library/ (the canonical source), not in the output.
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
