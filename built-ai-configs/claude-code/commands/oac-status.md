---
name: oac-status
description: Show OAC plugin status, installed context, and available skills
---

Show the current OAC plugin status.

Run:
```bash
echo "=== Context Installation ===" && \
  cat "${CLAUDE_PLUGIN_ROOT}/.context-manifest.json" 2>/dev/null | grep -E '"profile"|"downloaded_at"|"version"' || echo "Not installed — run /install-context" && \
  echo "" && \
  echo "=== Context Root ===" && \
  cat .oac.json 2>/dev/null || echo "No .oac.json — context root not pinned" && \
  echo "" && \
  echo "=== Context Files ===" && \
  ls "${CLAUDE_PLUGIN_ROOT}/context/" 2>/dev/null | wc -l | xargs -I{} echo "{} component directories installed"
```

Then report in plain language:
- **Plugin version:** 1.0.0
- **Context status:** installed profile + component count, or "not installed"
- **Context root:** path from `.oac.json`, or "not pinned (run /install-context)"
- **Available skills:** install-context, context-discovery, approach, debugger, verification-before-completion, task-breakdown, code-execution, test-generation, code-review, external-research, parallel-execution
- **Available subagents:** context-scout, task-manager, coder-agent, test-engineer, code-reviewer, external-scout
