#!/usr/bin/env bash
# SessionStart hook for the OAC plugin.
#
# Injects at most 3 short lines (D-010): that OAC is active, and how to get help or load a
# skill on demand. The skill catalogue is NOT injected: Claude Code already lists plugin
# skills, and /oac:oac-help or the oac:using-oac skill load the full guide when asked.
# No context discovery is triggered here (the context scout is off by default).
#
# hooks.json limits this to startup|clear|compact, so resumed and forked sessions keep the
# context they already have. Sessions started as a named agent (`claude --agent ...`, which
# sets agent_type in the hook input) get nothing: that agent has its own instructions.

set -euo pipefail

input=""
if [ ! -t 0 ]; then
    input=$(cat || true)
fi
if printf '%s' "${input}" | grep -Eq '"agent_type"[[:space:]]*:[[:space:]]*"[^"]+"'; then
    exit 0
fi

line1="OAC (OpenAgents Control) is active: its skills and agents are named oac:*."
line2="Load a skill only when the task needs it, with the Skill tool; /oac:oac-help shows the workflow."

# Context can be installed project-local (.claude/.context-manifest.json) or globally.
if [[ -f "$(pwd)/.claude/.context-manifest.json" ]] || [[ -f "${HOME:-}/.claude/.context-manifest.json" ]]; then
    line3="Project context is installed; read it when a task needs project standards."
else
    line3="No OAC context is installed yet; if the user wants it, /oac:context-setup sets it up."
fi

# Plain ASCII text with no quotes or backslashes, so it embeds in JSON as-is.
printf '{"hookSpecificOutput":{"hookEventName":"SessionStart","additionalContext":"%s\\n%s\\n%s"}}\n' \
    "${line1}" "${line2}" "${line3}"
