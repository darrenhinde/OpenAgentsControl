#!/bin/bash

# Movie Personality Router Script
# Routes to the appropriate character workflow based on config and arguments

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONFIG_FILE="$SCRIPT_DIR/config/personality-config.json"

# Show help
show_help() {
  cat << 'EOF'
🎬 Movie Personality Router
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Usage: router.sh [OPTIONS]

OPTIONS:
  -c, --character <name>    Character to embody (yoda, stark, sherlock)
  -m, --mission <number>    Mission number (1 or 2) - overrides config
  -h, --help               Show this help message

EXAMPLES:
  ./router.sh --character yoda
  ./router.sh --character stark --mission 2
  ./router.sh -c sherlock -m 1

CHARACTERS:
  yoda      - Wise Jedi Master from Star Wars
  stark     - Genius billionaire Tony Stark from Iron Man
  sherlock  - Master detective Sherlock Holmes

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
EOF
}

# Validate character
validate_character() {
  local char="$1"
  case "$char" in
    yoda|stark|sherlock)
      return 0
      ;;
    *)
      echo "❌ Error: Unknown character '$char'"
      echo "Available characters: yoda, stark, sherlock"
      exit 1
      ;;
  esac
}

# Get mission from config
get_mission_from_config() {
  local char="$1"
  # Simple JSON parsing - extract mission value for character
  grep -A 2 "\"$char\"" "$CONFIG_FILE" | grep "\"mission\"" | grep -o '[0-9]' | head -1
}

# Validate mission
validate_mission() {
  local mission="$1"
  if ! echo "$mission" | grep -qE '^[1-2]$'; then
    echo "❌ Error: Invalid mission '$mission'. Must be 1 or 2."
    exit 1
  fi
}

# Parse arguments
CHARACTER=""
MISSION=""

while [[ $# -gt 0 ]]; do
  case $1 in
    -c|--character)
      CHARACTER="$2"
      shift 2
      ;;
    -m|--mission)
      MISSION="$2"
      shift 2
      ;;
    -h|--help)
      show_help
      exit 0
      ;;
    *)
      echo "❌ Unknown option: $1"
      exit 1
      ;;
  esac
done

# Main logic
if [[ -z "$CHARACTER" ]]; then
  echo "❌ Error: Character is required"
  echo "Use --help for usage information"
  exit 1
fi

validate_character "$CHARACTER"

# Determine mission
if [[ -z "$MISSION" ]]; then
  MISSION=$(get_mission_from_config "$CHARACTER")
  if [[ -z "$MISSION" ]]; then
    echo "❌ Error: Could not determine mission from config"
    exit 1
  fi
fi

validate_mission "$MISSION"

# Execute the workflow script
SCRIPT_NAME="${CHARACTER}-workflow.sh"
SCRIPT_PATH="$SCRIPT_DIR/scripts/$SCRIPT_NAME"

if [[ ! -f "$SCRIPT_PATH" ]]; then
  echo "❌ Error: Script not found: $SCRIPT_PATH"
  exit 1
fi

# Convert character to uppercase for display
CHAR_UPPER=$(echo "$CHARACTER" | tr '[:lower:]' '[:upper:]')
echo "🎬 Loading $CHAR_UPPER personality..."
echo ""

# Execute the workflow
bash "$SCRIPT_PATH" "$MISSION"
