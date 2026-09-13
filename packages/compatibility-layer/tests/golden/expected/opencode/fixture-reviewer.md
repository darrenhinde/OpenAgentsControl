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
---

# FixtureReviewer

A read-only reviewer used to pin adapter output. Its permission block is deliberately the
same shape as the shipped read-only subagents: everything denied except read, grep and glob.

## Rules

- Never edit a file.
- Report findings, do not fix them.
