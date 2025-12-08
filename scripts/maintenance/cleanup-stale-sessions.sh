#!/bin/bash
# Cleanup stale agent sessions older than 24 hours

set -e

SESSIONS_DIR=".tmp/sessions"
STALE_HOURS=24

# Check if sessions directory exists
if [ ! -d "$SESSIONS_DIR" ]; then
    echo "No sessions directory found at $SESSIONS_DIR"
    exit 0
fi

echo "Checking for stale sessions (older than ${STALE_HOURS} hours)..."

# Find all session directories
session_count=0
stale_count=0

for session_dir in "$SESSIONS_DIR"/*; do
    if [ ! -d "$session_dir" ]; then
        continue
    fi
    
    session_count=$((session_count + 1))
    session_id=$(basename "$session_dir")
    manifest="$session_dir/.manifest.json"
    
    # Check if manifest exists
    if [ ! -f "$manifest" ]; then
        echo "⚠️  Session $session_id has no manifest - removing"
        rm -rf "$session_dir"
        stale_count=$((stale_count + 1))
        continue
    fi
    
    # Get last activity timestamp
    last_activity=$(jq -r '.last_activity // .created_at' "$manifest" 2>/dev/null || echo "")
    
    if [ -z "$last_activity" ]; then
        echo "⚠️  Session $session_id has invalid manifest - removing"
        rm -rf "$session_dir"
        stale_count=$((stale_count + 1))
        continue
    fi
    
    # Calculate age in hours
    last_activity_epoch=$(date -j -f "%Y-%m-%dT%H:%M:%SZ" "$last_activity" "+%s" 2>/dev/null || echo "0")
    current_epoch=$(date "+%s")
    age_hours=$(( (current_epoch - last_activity_epoch) / 3600 ))
    
    if [ "$age_hours" -gt "$STALE_HOURS" ]; then
        echo "🗑️  Removing stale session $session_id (${age_hours}h old)"
        rm -rf "$session_dir"
        stale_count=$((stale_count + 1))
    else
        echo "✅ Session $session_id is active (${age_hours}h old)"
    fi
done

echo ""
echo "Summary:"
echo "  Total sessions: $session_count"
echo "  Stale sessions removed: $stale_count"
echo "  Active sessions: $((session_count - stale_count))"

# Remove sessions directory if empty
if [ -d "$SESSIONS_DIR" ] && [ -z "$(ls -A "$SESSIONS_DIR")" ]; then
    echo ""
    echo "Sessions directory is empty - removing"
    rmdir "$SESSIONS_DIR"
fi

echo ""
echo "✨ Cleanup complete!"
