#!/usr/bin/env bash
# Project Orchestration Skill Router

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

show_help() {
  cat << 'HELP'
📋 Project Orchestration Skill
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Orchestrate multi-agent workflows for feature development

CONTEXT MANAGEMENT:
  create <feature>                  Create context index
  get-context <feature> <agent>     Get minimal context for agent
  add-output <feature> <agent> <path> Track agent output
  show <feature>                    Show full context index

SESSION MANAGEMENT:
  session-create <feature> <request>   Create session context
  session-load <sessionId>             Load session context
  session-summary <sessionId>          Get session summary

STAGE MANAGEMENT:
  stage-init <feature>              Initialize 8-stage workflow
  stage-status <feature>            Show stage progress
  stage-complete <feature> <stage>  Mark stage complete
  stage-rollback <feature> <stage>  Rollback stage
  stage-validate <feature> <stage>  Validate stage
  stage-abort <feature>             Abort workflow

EXAMPLES:
  ./router.sh create auth-system
  ./router.sh get-context auth-system StoryMapper
  ./router.sh stage-init auth-system
  ./router.sh stage-status auth-system

For detailed guides, see:
  workflows/context-handoff.md
  workflows/8-stage-delivery.md
  workflows/planning-agents.md
HELP
}

if [ "$1" = "help" ] || [ "$1" = "-h" ] || [ "$1" = "--help" ] || [ $# -eq 0 ]; then
    show_help
    exit 0
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
}

PROJECT_ROOT="$(find_project_root)"

# Route commands
case "$1" in
  create|get-context|add-output|show)
    cd "$PROJECT_ROOT" && npx ts-node "$SCRIPT_DIR/scripts/context-index.ts" "$@"
    ;;
  session-create|session-load|session-summary)
    cd "$PROJECT_ROOT" && npx ts-node "$SCRIPT_DIR/scripts/session-context-manager.ts" "$@"
    ;;
  stage-*)
    cd "$PROJECT_ROOT" && npx ts-node "$SCRIPT_DIR/scripts/stage-cli.ts" "$@"
    ;;
  *)
    echo "Unknown command: $1"
    show_help
    exit 1
    ;;
esac
