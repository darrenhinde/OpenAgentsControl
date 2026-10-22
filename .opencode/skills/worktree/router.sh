#!/usr/bin/env bash
#############################################################################
# Worktree Skill Router
# Manages git worktrees as sibling directories with isolated ports and envs
#############################################################################

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

show_help() {
  cat << 'HELP'
Git Worktree Skill
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Usage: router.sh [COMMAND] [OPTIONS]

COMMANDS:
  create <branch> [name]     Create a new worktree as a sibling directory
  remove <name> [--keep-branch]   Remove a worktree and clean up
  list                       List all worktrees for this repo
  ports                      Show the port index table
  help                       Show this help message

EXAMPLES:
  bash .opencode/skills/worktree/router.sh create feature/auth
  bash .opencode/skills/worktree/router.sh create feature/auth feature-auth
  bash .opencode/skills/worktree/router.sh list
  bash .opencode/skills/worktree/router.sh remove feature-auth
  bash .opencode/skills/worktree/router.sh remove feature-auth --keep-branch
  bash .opencode/skills/worktree/router.sh ports

WORKTREE LOCATION:
  Worktrees are created as siblings to the main repo directory:
    ~/…/github/my-app/              ← main repo (you are here)
    ~/…/github/my-app-feature-auth/ ← created worktree

PORT SCHEME (BASE + INDEX * 10):
  Index 0 (main):  web=3000  admin=3001  api=3002  db=5432  redis=6379
  Index 1:         web=3010  admin=3011  api=3012  db=5442  redis=6389
  Index 2:         web=3020  admin=3021  api=3022  db=5452  redis=6399

For detailed documentation, see: .opencode/skills/worktree/SKILL.md
HELP
}

# Find project root
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
  echo "ERROR: Not inside a git repository" >&2
  return 1
}

cmd_list() {
  local main_repo
  main_repo="$(find_git_root)"
  echo "Worktrees for $(basename "$main_repo"):"
  echo ""
  git -C "$main_repo" worktree list
}

cmd_ports() {
  local main_repo
  main_repo="$(find_git_root)"
  local count
  count=$(git -C "$main_repo" worktree list | wc -l | xargs)

  echo "Port index table (BASE + INDEX * 10):"
  echo ""
  printf "%-6s %-10s %-6s %-7s %-5s %-6s %-7s\n" "Index" "Name" "Web" "Admin" "API" "DB" "Redis"
  echo "─────────────────────────────────────────────────────"

  local i=0
  while IFS= read -r line; do
    local path branch
    path="$(echo "$line" | awk '{print $1}')"
    branch="$(echo "$line" | awk '{print $NF}' | tr -d '[]')"
    local name
    name="$(basename "$path")"
    printf "%-6s %-10s %-6s %-7s %-5s %-6s %-7s\n" \
      "$i" "${name:0:10}" \
      "$((3000 + i * 10))" "$((3001 + i * 10))" "$((3002 + i * 10))" \
      "$((5432 + i * 10))" "$((6379 + i * 10))"
    i=$((i + 1))
  done < <(git -C "$main_repo" worktree list)

  local next_idx=$((count - 1))
  echo ""
  echo "Next worktree will use index $next_idx:"
  printf "  web=%-6s admin=%-6s api=%-6s db=%-6s redis=%s\n" \
    "$((3000 + next_idx * 10))" "$((3001 + next_idx * 10))" \
    "$((3002 + next_idx * 10))" "$((5432 + next_idx * 10))" \
    "$((6379 + next_idx * 10))"
}

# No arguments — show help
if [ $# -eq 0 ]; then
  show_help
  exit 0
fi

COMMAND="$1"
shift

case "$COMMAND" in
  create)
    bash "$SCRIPT_DIR/scripts/wt-new.sh" "$@"
    ;;
  remove)
    bash "$SCRIPT_DIR/scripts/wt-close.sh" "$@"
    ;;
  list)
    cmd_list
    ;;
  ports)
    cmd_ports
    ;;
  help|-h|--help)
    show_help
    ;;
  *)
    echo "ERROR: Unknown command: $COMMAND"
    echo ""
    show_help
    exit 1
    ;;
esac
