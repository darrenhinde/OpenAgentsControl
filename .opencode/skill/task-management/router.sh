#!/usr/bin/env bash
#############################################################################
# Task Management Skill Router
# Routes to task-cli.ts with proper path resolution
#############################################################################

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CLI_SCRIPT="$SCRIPT_DIR/scripts/task-cli.ts"

# Check if CLI script exists
if [ ! -f "$CLI_SCRIPT" ]; then
    echo "Error: task-cli.ts not found at $CLI_SCRIPT"
    exit 1
fi

# Find project root
find_project_root() {
    local dir
    dir="$(pwd)"
    while [ "$dir" != "/" ]; do
        if [ -f "$dir/.git" ] || [ -f "$dir/package.json" ]; then
            echo "$dir"
            return 0
        fi
        dir="$(dirname "$dir")"
    done
    pwd
    return 1
}

PROJECT_ROOT="$(find_project_root)"

# Run the task CLI
cd "$PROJECT_ROOT" && npx ts-node "$CLI_SCRIPT" "$@"
