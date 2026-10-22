#!/usr/bin/env bash
#############################################################################
# Model Router Skill Router
# Routes to model-router.js with proper path resolution and command handling
#############################################################################

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CLI_SCRIPT="$SCRIPT_DIR/scripts/model-router.js"

# Show help
show_help() {
  cat << 'HELP'
🎯 Model Router Skill
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Usage: router.sh [COMMAND] [OPTIONS]

COMMANDS:
  status                       Show current agent→model assignments and drift
  apply [--dry-run]            Sync model-tiers.json → agent frontmatter
  tier <name> <model-id>       Change a tier's model
  assign <agent-id> <tier>     Move an agent to a different tier
  tiers                        List all tier definitions
  unassigned                   Show agents not in assignments
  help                         Show this help message

EXAMPLES:
  ./router.sh status
  ./router.sh apply
  ./router.sh apply --dry-run
  ./router.sh tier fast lmstudio/phi-4-mini
  ./router.sh assign contextscout medium
  ./router.sh tiers
  ./router.sh unassigned

FEATURES:
  ✓ Tier-based model routing (fast/medium/powerful)
  ✓ Centralized config in model-tiers.json
  ✓ Apply model settings to agent frontmatter
  ✓ Drift detection between config and actual files
  ✓ One-command reconfiguration

CONFIG FILE:
  .opencode/skills/model-router/config/model-tiers.json

For more info, see: .opencode/skills/model-router/SKILL.md
HELP
}

# Check if CLI script exists
if [ ! -f "$CLI_SCRIPT" ]; then
    echo "❌ Error: model-router.js not found at $CLI_SCRIPT"
    exit 1
fi

# Find project root
find_project_root() {
    local dir
    dir="$(pwd)"
    while [ "$dir" != "/" ]; do
        if [ -d "$dir/.git" ] || [ -f "$dir/package.json" ]; then
            echo "$dir"
            return 0
        fi
        dir="$(dirname "$dir")"
    done
    pwd
    return 1
}

# Handle help
if [ "$1" = "help" ] || [ "$1" = "-h" ] || [ "$1" = "--help" ]; then
    show_help
    exit 0
fi

# If no arguments, show help
if [ $# -eq 0 ]; then
    show_help
    exit 0
fi

PROJECT_ROOT="$(find_project_root)"

# Run the model router CLI with all arguments
cd "$PROJECT_ROOT" && node "$CLI_SCRIPT" "$@"
