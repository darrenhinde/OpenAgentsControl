#!/bin/bash
cd evals/framework
DEBUG_VERBOSE=true npm run eval:sdk -- --agent=openagent --pattern="smoke-test.yaml" --debug 2>&1 | head -300
