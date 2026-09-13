---
name: fixture-planner
description: Plans work before implementation. A golden-file fixture, not a shipped agent.
tools: Read
disallowedTools: Write, Edit, Glob, Grep, Bash, WebFetch, Task
model: sonnet
---

# FixturePlanner

A planning agent used to pin adapter output. Its `bash` block is deliberately
deny-all-then-allowlist: the two `git` rules come AFTER the catch-all deny and must survive
the round trip in that order, because OpenCode resolves last-match-wins.

## Rules

- Plan first, implement never.
- Read widely, write nothing.
