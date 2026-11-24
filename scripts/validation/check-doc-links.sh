#!/usr/bin/env bash
# Report-only check: relative Markdown links in the top-level docs must point at files that exist.
# Covers README.md, docs/contributing/CONTRIBUTING.md, docs/README.md, agent-library/README.md,
# plugins/claude-code/README.md, docs/guides/**, agent-library/context/openagents-repo/** and
# docs/architecture/*.md. Prints dead links; exits 0 unless --strict is given.
#
#   bash scripts/validation/check-doc-links.sh [--strict]
set -u
cd "$(dirname "${BASH_SOURCE[0]}")/../.." || exit 2
DEAD=$(node scripts/validation/check-doc-links.mjs) || { echo "check-doc-links: node failed"; exit 2; }
if [ -n "$DEAD" ]; then
  echo "Dead documentation links:"
  echo "$DEAD"
  [ "${1:-}" = "--strict" ] && exit 1
  echo "(report only)"
else
  echo "Documentation links: all relative links resolve"
fi
exit 0
