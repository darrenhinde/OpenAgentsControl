# Guide: Subagent Invocation

**Purpose**: How to correctly invoke subagents using the task tool  
**Priority**: HIGH - Critical for agent delegation

---

## The Problem

**Issue**: Agents trying to invoke subagents with incorrect `subagent_type` format

**Error**:
```
Unknown agent type: subagents/core/context-retriever is not a valid agent type
```

**Root Cause**: The `subagent_type` parameter in the task tool must match the registered agent type in the OpenCode CLI, not the file path.

---

## Correct Subagent Invocation

### Available Subagent Types

Based on the OpenCode CLI registration, use these exact strings for `subagent_type`:

**Core Subagents**:
- `"Task Manager"` - Task breakdown and planning
- `"Documentation"` - Documentation generation
- `"Context Retriever"` - Context file discovery

**Code Subagents**:
- `"Coder Agent"` - Code implementation
- `"Tester"` - Test authoring
- `"Reviewer"` - Code review
- `"Build Agent"` - Build validation
- `"Codebase Pattern Analyst"` - Pattern analysis

**System Builder Subagents**:
- `"Domain Analyzer"` - Domain analysis
- `"Agent Generator"` - Agent generation
- `"Context Organizer"` - Context organization
- `"Workflow Designer"` - Workflow design
- `"Command Creator"` - Command creation

**Utility Subagents**:
- `"Image Specialist"` - Image generation/editing

---

## Invocation Syntax

### ✅ Correct Format

```javascript
task(
  subagent_type="Task Manager",
  description="Break down feature into subtasks",
  prompt="Detailed instructions..."
)
```

### ❌ Incorrect Formats

```javascript
// ❌ Using file path
task(
  subagent_type="subagents/core/task-manager",
  ...
)

// ❌ Using kebab-case ID
task(
  subagent_type="task-manager",
  ...
)
```

---

## How to Find the Correct Type

### Check Registry

```bash
# List all subagent names
cat registry.json | jq -r '.components.subagents[] | "\(.name)"'
```

---

**Last Updated**: 2025-12-29  
**Version**: 0.5.1
