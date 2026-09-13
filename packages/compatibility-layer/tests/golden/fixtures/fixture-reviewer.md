---
name: FixtureReviewer
description: Reviews code for correctness. A golden-file fixture, not a shipped agent.
mode: subagent
temperature: 0.1
model: haiku
permission:
  read:
    "*": "allow"
  grep:
    "*": "allow"
  glob:
    "*": "allow"
  bash:
    "*": "deny"
  edit:
    "*": "deny"
  write:
    "*": "deny"
  task:
    "*": "deny"
oac:
  id: fixture-reviewer
  name: FixtureReviewer
  category: subagents/test
  type: subagent
  version: 1.0.0
  author: opencode
  tags:
    - fixture
    - review
  dependencies:
    - context:standards-code
  targets:
    - opencode
    - claude-code
  overrides:
    claude-code:
      # Read-only. Matches this fixture's canonical permission block exactly — it scopes
      # nothing, so there is no trade-off to record here.
      tools: [Read, Glob, Grep]
---

# FixtureReviewer

A read-only reviewer used to pin adapter output. Its permission block is deliberately the
same shape as the shipped read-only subagents: everything denied except read, grep and glob.

## Rules

- Never edit a file.
- Report findings, do not fix them.
