#!/bin/bash
SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
FRAMEWORK_ROOT=$(cd "$SCRIPT_DIR/../.." && pwd)
DEBUG_VERBOSE=true pnpm --dir "$FRAMEWORK_ROOT" run eval:sdk -- --agent=openagent --pattern="smoke-test.yaml" --debug 2>&1 | head -300
