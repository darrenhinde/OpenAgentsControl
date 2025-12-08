#!/bin/bash
# Enhanced dashboard launcher with auto-open
# Usage: ./scripts/dashboard.sh [port] [auto-open]

set -e

PORT=${1:-8000}
AUTO_OPEN=${2:-true}

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${BLUE}🚀 Starting OpenCode Agents Dashboard...${NC}"
echo -e "${BLUE}📊 Results directory: evals/results${NC}"
echo -e "${BLUE}🌐 URL: http://localhost:$PORT${NC}"
echo ""

# Navigate to results directory
cd "$(dirname "$0")/../evals/results" || exit 1

# Check if results exist
if [ ! -f "latest.json" ]; then
  echo -e "${YELLOW}⚠️  No test results found yet.${NC}"
  echo -e "${YELLOW}   Run tests first: npm test${NC}"
  echo ""
fi

# Start server in background
./serve.sh "$PORT" &
SERVER_PID=$!

# Wait for server to start
sleep 2

# Auto-open browser
if [ "$AUTO_OPEN" = "true" ]; then
  echo -e "${GREEN}🌐 Opening browser...${NC}"
  if command -v open &> /dev/null; then
    open "http://localhost:$PORT"
  elif command -v xdg-open &> /dev/null; then
    xdg-open "http://localhost:$PORT"
  elif command -v start &> /dev/null; then
    start "http://localhost:$PORT"
  else
    echo -e "${YELLOW}⚠️  Could not auto-open browser. Please visit: http://localhost:$PORT${NC}"
  fi
fi

echo ""
echo -e "${GREEN}✅ Dashboard running (PID: $SERVER_PID)${NC}"
echo -e "${YELLOW}Press Ctrl+C to stop${NC}"
echo ""

# Wait for Ctrl+C
wait $SERVER_PID
