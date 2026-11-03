---
name: context-discovery
description: Use when coding standards, security patterns, or project conventions need to be discovered before implementation begins.
context: fork
agent: context-scout
---

# Context Discovery

## Overview
Discover project standards and patterns before implementing features. Context-scout resolves the context root using the [OAC Context Discovery Protocol](./context-discovery-protocol.md), then finds and ranks relevant files based on your request.

**Announce at start:** "I'm using the context-discovery skill to find relevant standards for [feature/task]."

## The Process

### Step 1: Invoke Context-Scout

Run the skill with your implementation topic:

```bash
/context-discovery [what you're implementing]
```

**Examples:**
- `/context-discovery JWT authentication`
- `/context-discovery React form validation`
- `/context-discovery database migration workflow`

### Step 2: Load Critical Priority Files

Read EVERY file marked **Critical Priority** (paths returned by context-scout, relative to the resolved context root):

```bash
Read: {context_root}/core/standards/code-quality.md
Read: {context_root}/core/standards/security-patterns.md
```

These are **mandatory**—proceed only after loading.

### Step 3: Load High Priority Files

Read files marked **High Priority**:

```bash
Read: {context_root}/core/workflows/approval-gates.md
```

These are **strongly recommended** for your implementation.

### Step 4: Load Medium Priority (If Needed)

Read **Medium Priority** files for additional context:

```bash
Read: {context_root}/project-intelligence/architecture.md
```

These are **optional but helpful**.

### Step 5: Apply to Implementation

- Follow standards from loaded files
- Apply patterns to your code
- Use naming conventions discovered
- Check workflows before executing

## Delegation Pattern

When invoking subagents, pass discovered context files:

```markdown
Invoke coder-agent:

Task: Implement JWT service

Context to load:
- .opencode/context/core/standards/code-quality.md
- .opencode/context/core/standards/security-patterns.md

Instructions: Follow functional patterns and security best practices.
```

## Error Handling

**"No context files found"**
- Run `/install-context` to download context first

**"Too many files returned"**
- Be more specific (e.g., "TypeScript coding standards" not "coding")

**"Which files do I load?"**
- Always: Critical → High → Medium (if needed)

## Remember

- Context FIRST, code SECOND—never skip discovery
- Critical priority files are MANDATORY, not optional
- Training data is outdated—context is current
- Pass context forward when delegating to subagents
- Only use file paths returned by context-scout

## Related

- task-breakdown
- code-execution
- external-research

---

**Task**: Discover context files for **$ARGUMENTS**

Follow navigation-driven discovery and return ranked recommendations.
