---
# OpenCode Agent Configuration
id: eval-runner
name: Eval Runner
description: "Test harness for evaluation framework - DO NOT USE DIRECTLY"
category: testing
type: utility
version: 1.0.0
author: opencode
mode: subagent
temperature: 0.2
---

# Eval Runner - Test Harness

**⚠️ DO NOT USE THIS AGENT DIRECTLY ⚠️**

This agent is a test harness used by the OpenCode evaluation framework.

## Purpose

This file is **dynamically replaced** during test runs:
- Before tests: Replaced with target agent's prompt (e.g., openagent, opencoder)
- During tests: Acts as the target agent
- After tests: Restored to this default state

## Configuration

- **ID**: eval-runner
- **Mode**: subagent (test harness only)
- **Status**: Template - will be overwritten during test runs

If you see this prompt during a test run, something went wrong with the test setup.

