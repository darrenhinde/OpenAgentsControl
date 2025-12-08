#!/usr/bin/env bash
# Quick script to check cache usage for a session

if [ -z "$1" ]; then
    echo "Usage: $0 <session-id>"
    echo "Example: $0 ses_507d7a4afffeTTBCw1ncvOy7IR"
    exit 1
fi

SESSION_ID="$1"
MSG_DIR="$HOME/.local/share/opencode/storage/message/$SESSION_ID"

if [ ! -d "$MSG_DIR" ]; then
    echo "Session not found: $SESSION_ID"
    exit 1
fi

echo "==================================="
echo "Cache Analysis for: $SESSION_ID"
echo "==================================="
echo ""

for msg_file in "$MSG_DIR"/*.json; do
    if [ ! -f "$msg_file" ]; then
        continue
    fi
    
    MSG_NAME=$(basename "$msg_file" .json)
    ROLE=$(jq -r '.role' "$msg_file")
    
    if [ "$ROLE" = "assistant" ]; then
        echo "Message: $MSG_NAME"
        echo "Role: $ROLE"
        echo "Tokens:"
        jq '.tokens' "$msg_file"
        
        INPUT=$(jq -r '.tokens.input' "$msg_file")
        OUTPUT=$(jq -r '.tokens.output' "$msg_file")
        CACHE_READ=$(jq -r '.tokens.cache.read' "$msg_file")
        CACHE_WRITE=$(jq -r '.tokens.cache.write' "$msg_file")
        
        TOTAL=$((INPUT + OUTPUT + CACHE_READ + CACHE_WRITE))
        
        echo ""
        echo "Total displayed: $TOTAL tokens"
        echo "Actual cost equiv: ~$((INPUT + OUTPUT + (CACHE_READ / 10) + (CACHE_WRITE * 125 / 100))) tokens"
        echo ""
        echo "-----------------------------------"
        echo ""
    fi
done
