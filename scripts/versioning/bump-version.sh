#!/bin/bash
# Version bump script
# Usage: ./scripts/bump-version.sh [alpha|beta|rc|patch|minor|major]

set -e

STAGE=${1:-alpha}

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# Get current version
CURRENT_VERSION=$(cat VERSION 2>/dev/null || echo "0.1.0-alpha.1")

echo -e "${BLUE}📦 Version Bump Tool${NC}"
echo -e "${BLUE}====================${NC}"
echo ""
echo -e "Current version: ${YELLOW}${CURRENT_VERSION}${NC}"
echo -e "Bump type:       ${YELLOW}${STAGE}${NC}"
echo ""

# Navigate to root
cd "$(dirname "$0")/.." || exit 1

# Bump version in package.json
case "$STAGE" in
  alpha)
    npm run version:bump:alpha
    ;;
  beta)
    npm run version:bump:beta
    ;;
  rc)
    npm run version:bump:rc
    ;;
  patch)
    npm run version:bump:patch
    ;;
  minor)
    npm run version:bump:minor
    ;;
  major)
    npm run version:bump:major
    ;;
  *)
    echo -e "${RED}❌ Invalid stage: $STAGE${NC}"
    echo -e "${YELLOW}Valid options: alpha, beta, rc, patch, minor, major${NC}"
    exit 1
    ;;
esac

# Get new version
NEW_VERSION=$(cat VERSION)

echo ""
echo -e "${GREEN}✅ Version bumped!${NC}"
echo -e "New version: ${GREEN}${NEW_VERSION}${NC}"
echo ""

# Prompt for changelog update
echo -e "${YELLOW}📝 Don't forget to update CHANGELOG.md!${NC}"
echo ""
echo -e "Next steps:"
echo -e "  1. Update CHANGELOG.md with changes"
echo -e "  2. Commit: ${BLUE}git add VERSION package.json CHANGELOG.md${NC}"
echo -e "  3. Commit: ${BLUE}git commit -m \"chore: bump version to v${NEW_VERSION}\"${NC}"
echo -e "  4. Tag:    ${BLUE}git tag v${NEW_VERSION}${NC}"
echo -e "  5. Push:   ${BLUE}git push origin main --tags${NC}"
echo ""
