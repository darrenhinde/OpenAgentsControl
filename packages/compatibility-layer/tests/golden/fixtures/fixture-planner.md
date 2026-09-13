---
name: FixturePlanner
description: Plans work before implementation. A golden-file fixture, not a shipped agent.
mode: primary
temperature: 0.3
model: sonnet
permission:
  read:
    "*": "allow"
  bash:
    "*": "deny"
    "git status": "allow"
    "git log*": "allow"
  edit:
    "*": "deny"
  write:
    "*": "deny"
oac:
  id: fixture-planner
  name: FixturePlanner
  category: core
  type: agent
  version: 2.0.0
  author: opencode
  tags:
    - fixture
    - planning
  dependencies:
    - subagent:contextscout
    - context:standards-code
  targets:
    - opencode
    - claude-code
  overrides:
    claude-code:
      # Bash is deliberately NOT granted. Its canonical block is deny-all-then-allowlist, and
      # Claude Code cannot express that, so the choice is made here, not derived. Denying is
      # a tightening: the `git status` / `git log*` allowances are simply unavailable on this
      # target.
      tools: [Read]
---

# FixturePlanner

A planning agent used to pin adapter output. Its `bash` block is deliberately
deny-all-then-allowlist: the two `git` rules come AFTER the catch-all deny and must survive
the round trip in that order, because OpenCode resolves last-match-wins.

## Rules

- Plan first, implement never.
- Read widely, write nothing.
