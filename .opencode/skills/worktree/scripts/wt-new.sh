#!/usr/bin/env bash
#############################################################################
# wt-new.sh — Create a new git worktree as a sibling directory
#
# Usage: wt-new.sh <branch> [name]
#   branch  Git branch name, e.g. feature/auth or bugfix/payments
#   name    Short directory suffix, defaults to branch with / replaced by -
#           e.g. feature/auth → feature-auth
#
# Output structure (siblings to the main repo):
#   ~/…/github/
#     my-app/                   ← main worktree (this repo)
#     my-app-feature-auth/      ← new worktree
#
# Port scheme: BASE + (INDEX * STEP) where INDEX = number of existing worktrees
#   Index 0 (main):  web=3000  admin=3001  api=3002  db=5432  redis=6379
#   Index 1:         web=3010  admin=3011  api=3012  db=5442  redis=6389
#   Index 2:         web=3020  admin=3021  api=3022  db=5452  redis=6399
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
BRANCH="${1:-}"
NAME="${2:-}"

if [[ -z "$BRANCH" ]]; then
  echo "Usage: wt-new.sh <branch> [name]"
  echo "  e.g. wt-new.sh feature/auth feature-auth"
  exit 1
fi

# Default name: replace / with -
if [[ -z "$NAME" ]]; then
  NAME="${BRANCH//\//-}"
fi

WORKTREE_DIR="$GITHUB_ROOT/${REPO_NAME}-${NAME}"

# ── Compute index ─────────────────────────────────────────────────────────
# Count existing worktrees (main counts as index 0, so subtract 1)
INDEX=$(git -C "$MAIN_REPO" worktree list | wc -l | tr -d ' ')
INDEX=$((INDEX - 1))

BASE_WEB=3000
BASE_ADMIN=3001
BASE_API=3002
BASE_DB=5432
BASE_REDIS=6379
STEP=10

WEB_PORT=$((BASE_WEB   + INDEX * STEP))
ADMIN_PORT=$((BASE_ADMIN + INDEX * STEP))
API_PORT=$((BASE_API   + INDEX * STEP))
DB_PORT=$((BASE_DB     + INDEX * STEP))
REDIS_PORT=$((BASE_REDIS + INDEX * STEP))

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo " Creating worktree: ${REPO_NAME}-${NAME}"
echo " Branch:  $BRANCH"
echo " Path:    $WORKTREE_DIR"
echo " Index:   $INDEX"
echo " Ports:   web=$WEB_PORT  admin=$ADMIN_PORT  api=$API_PORT  db=$DB_PORT  redis=$REDIS_PORT"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

if [[ -d "$WORKTREE_DIR" ]]; then
  echo "ERROR: directory already exists: $WORKTREE_DIR" >&2
  exit 1
fi

# ── Create worktree ───────────────────────────────────────────────────────
cd "$MAIN_REPO"

if git show-ref --verify --quiet "refs/heads/$BRANCH"; then
  echo "→ Branch exists locally — adding worktree"
  git worktree add "$WORKTREE_DIR" "$BRANCH"
elif git show-ref --verify --quiet "refs/remotes/origin/$BRANCH"; then
  echo "→ Branch exists on remote — checking out"
  git worktree add -b "$BRANCH" "$WORKTREE_DIR" "origin/$BRANCH"
else
  echo "→ New branch — creating from origin/main"
  git worktree add -b "$BRANCH" "$WORKTREE_DIR" origin/main
fi

cd "$WORKTREE_DIR"

# ── Install dependencies ──────────────────────────────────────────────────
if [[ -f "pnpm-lock.yaml" ]]; then
  echo "→ Installing dependencies (pnpm)..."
  pnpm install
elif [[ -f "yarn.lock" ]]; then
  echo "→ Installing dependencies (yarn)..."
  yarn install
elif [[ -f "package-lock.json" ]]; then
  echo "→ Installing dependencies (npm)..."
  npm install
else
  echo "  (no lock file found — skipping install)"
fi

# ── Generate .env files ───────────────────────────────────────────────────
TEMPLATE="$MAIN_REPO/.env.template"

if [[ -f "$TEMPLATE" ]]; then
  echo "→ Generating .env files from .env.template..."

  generate_env() {
    local dest="$1"
    local dir
    dir="$(dirname "$dest")"
    mkdir -p "$dir"
    sed \
      -e "s/__INDEX__/$INDEX/g" \
      -e "s/__NAME__/$NAME/g" \
      -e "s/__WEB_PORT__/$WEB_PORT/g" \
      -e "s/__ADMIN_PORT__/$ADMIN_PORT/g" \
      -e "s/__API_PORT__/$API_PORT/g" \
      -e "s/__DB_PORT__/$DB_PORT/g" \
      -e "s/__REDIS_PORT__/$REDIS_PORT/g" \
      "$TEMPLATE" > "$dest"
    echo "  ✓ $dest"
  }

  # Root .env
  generate_env "$WORKTREE_DIR/.env"

  # Per-app .env files (only if the app directories exist)
  for app_dir in apps/web apps/admin apps/api; do
    if [[ -d "$WORKTREE_DIR/$app_dir" ]]; then
      generate_env "$WORKTREE_DIR/$app_dir/.env"
    fi
  done
else
  echo "  (no .env.template found — skipping .env generation)"
  echo "  Tip: add a .env.template to your repo root for automatic port-isolated .env files"
fi

# ── Copy .env.local secrets from main worktree ───────────────────────────
for extra in ".env.local" "apps/web/.env.local" "apps/admin/.env.local" "apps/api/.env.local"; do
  if [[ -f "$MAIN_REPO/$extra" ]]; then
    dest_dir="$(dirname "$WORKTREE_DIR/$extra")"
    mkdir -p "$dest_dir"
    cp "$MAIN_REPO/$extra" "$WORKTREE_DIR/$extra"
    echo "  ✓ copied $extra"
  fi
done

# ── Launch in Zellij (optional) ───────────────────────────────────────────
if command -v zellij &>/dev/null; then
  echo "→ Launching Zellij session: $NAME"
  zellij attach -c "$NAME" --layout worktree 2>/dev/null || zellij attach -c "$NAME"
else
  echo ""
  echo "✓ Worktree ready!"
  echo "  cd $WORKTREE_DIR"
fi
