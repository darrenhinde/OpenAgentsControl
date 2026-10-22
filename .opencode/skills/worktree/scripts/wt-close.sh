#!/usr/bin/env bash
#############################################################################
# wt-close.sh — Remove a git worktree and optionally clean up its branch
#
# Usage: wt-close.sh <name> [--keep-branch]
#   name           Short name used when creating (e.g. feature-auth)
#   --keep-branch  Skip branch deletion (useful if branch is unmerged)
#############################################################################

set -euo pipefail

# ── Locate main repo root ─────────────────────────────────────────────────
find_git_root() {
  local dir
  dir="$(pwd)"
  while [ "$dir" != "/" ]; do
    if [ -d "$dir/.git" ]; then
      echo "$dir"
      return 0
    fi
    dir="$(dirname "$dir")"
  done
  echo "ERROR: not inside a git repository" >&2
  return 1
}

MAIN_REPO="$(find_git_root)"
GITHUB_ROOT="$(dirname "$MAIN_REPO")"
REPO_NAME="$(basename "$MAIN_REPO")"

# ── Args ──────────────────────────────────────────────────────────────────
NAME="${1:-}"
KEEP_BRANCH=false

if [[ -z "$NAME" ]]; then
  echo "Usage: wt-close.sh <name> [--keep-branch]"
  echo "  e.g. wt-close.sh feature-auth"
  exit 1
fi

shift
for arg in "$@"; do
  if [[ "$arg" == "--keep-branch" ]]; then
    KEEP_BRANCH=true
  fi
done

WORKTREE_DIR="$GITHUB_ROOT/${REPO_NAME}-${NAME}"

if [[ ! -d "$WORKTREE_DIR" ]]; then
  echo "ERROR: worktree directory not found: $WORKTREE_DIR" >&2
  exit 1
fi

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo " Removing worktree: ${REPO_NAME}-${NAME}"
echo " Path: $WORKTREE_DIR"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# ── Stop Docker Compose if running ───────────────────────────────────────
if [[ -f "$WORKTREE_DIR/docker-compose.yml" ]]; then
  echo "→ Stopping Docker Compose..."
  if [[ -f "$WORKTREE_DIR/.env" ]]; then
    docker compose --env-file "$WORKTREE_DIR/.env" -f "$WORKTREE_DIR/docker-compose.yml" down -v 2>/dev/null || true
  else
    docker compose -f "$WORKTREE_DIR/docker-compose.yml" down -v 2>/dev/null || true
  fi
fi

# ── Kill Zellij session if running ───────────────────────────────────────
if command -v zellij &>/dev/null; then
  if zellij list-sessions 2>/dev/null | grep -q "^$NAME"; then
    echo "→ Deleting Zellij session: $NAME"
    zellij delete-session "$NAME" 2>/dev/null || true
  fi
fi

# ── Find the branch name for this worktree ───────────────────────────────
BRANCH="$(git -C "$WORKTREE_DIR" rev-parse --abbrev-ref HEAD 2>/dev/null || echo "")"

# ── Remove the worktree ───────────────────────────────────────────────────
echo "→ Removing worktree..."
git -C "$MAIN_REPO" worktree remove "$WORKTREE_DIR" --force
git -C "$MAIN_REPO" worktree prune

# ── Optionally delete the branch ─────────────────────────────────────────
if [[ "$KEEP_BRANCH" == false ]] && [[ -n "$BRANCH" ]] && [[ "$BRANCH" != "main" ]] && [[ "$BRANCH" != "master" ]]; then
  echo "→ Deleting branch: $BRANCH"
  git -C "$MAIN_REPO" branch -d "$BRANCH" 2>/dev/null \
    || echo "  (branch not deleted — has unmerged commits. Use --keep-branch or delete manually)"
fi

echo ""
echo "✓ Worktree '${REPO_NAME}-${NAME}' removed"
