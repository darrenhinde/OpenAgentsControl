<!-- Context: openagents-repo/standards/permission-patterns | Priority: critical | Version: 1.0 | Updated: 2026-02-01 -->
# Standard: Permission Patterns for OpenCode v1.1.1+

**Purpose**: Comprehensive permission configuration patterns for different agent types  
**Priority**: CRITICAL - Load this before configuring agent permissions

---

## Core Principle

OpenCode v1.1.1+ uses `permission:` (singular) with granular control over tool access. Rules follow **last-matching-wins** evaluation order.

**Why**: Granular permissions prevent unintended actions while allowing necessary operations.

---

## Permission Evaluation Order

**Last matching rule wins** - Common pattern:
1. Catch-all `"*"` first (default behavior)
2. Specific overrides after (take precedence)

Example:
```yaml
permission:
  bash:
    "*": "deny"              # Catch-all: deny all bash
    "git status*": "allow"   # Override: allow git status
    "git diff*": "allow"     # Override: allow git diff
```

---

## Valid Permission Keys

| Key | Description | Granular? | Default |
|-----|-------------|-----------|---------|
| `read` | File reading | Yes (path globs) | `"allow"` |
| `edit` | File modifications | Yes (path globs) | `"allow"` |
| `glob` | File globbing/searches | Yes | `"allow"` |
| `grep` | Content/regex search | Yes | `"allow"` |
| `list` | Directory listing | Yes | `"allow"` |
| `bash` | Shell commands | Yes (command globs) | `"allow"` |
| `task` | Subagent launches | Yes (subagent type) | `"allow"` |
| `skill` | Skill loading | Yes | `"allow"` |
| `lsp` | LSP queries | No | `"allow"` |
| `todoread` | Todo list read | No | `"allow"` |
| `todowrite` | Todo list update | No | `"allow"` |
| `webfetch` | URL fetching | Yes | `"allow"` |
| `websearch` | Web search | Yes | `"allow"` |
| `codesearch` | Code search | Yes | `"allow"` |
| `external_directory` | Out-of-project paths | Yes | `"ask"` |
| `doom_loop` | Repeated identical calls | Yes | `"ask"` |

---

## Valid Actions

- `"allow"` - Executes without approval
- `"ask"` - Prompts user (options: once, always, reject)
- `"deny"` - Blocks immediately

---

## Agent Type Patterns

### Read-Only Agents (Reviewers, Analyzers)

**Use case**: Code review, analysis, security audits

```yaml
permission:
  bash:
    "*": "deny"
  edit:
    "**/*": "deny"
  write:
    "**/*": "deny"
  task:
    context-scout: "allow"
    "*": "deny"
```

**Examples**: CodeReviewer, SecurityAuditor

---

### Write-Enabled Agents (Coders, Testers)

**Use case**: Code implementation, test authoring

```yaml
permission:
  bash:
    "rm -rf *": "ask"
    "sudo *": "deny"
    "chmod *": "ask"
    "curl *": "ask"
    "wget *": "ask"
    "docker *": "ask"
    "kubectl *": "ask"
    # Test-specific commands (for testers)
    "npx vitest *": "allow"
    "npx jest *": "allow"
    "pytest *": "allow"
    "npm test *": "allow"
    "go test *": "allow"
    "cargo test *": "allow"
    "*": "deny"
  edit:
    "**/*.env*": "deny"
    "**/*.key": "deny"
    "**/*.secret": "deny"
    "node_modules/**": "deny"
    "**/__pycache__/**": "deny"
    "**/*.pyc": "deny"
    ".git/**": "deny"
  task:
    context-scout: "allow"
    "*": "deny"
```

**Examples**: CoderAgent, TestEngineer, BuildAgent

---

### Orchestrators (Task Managers, Primary Agents)

**Use case**: Workflow orchestration, task delegation

```yaml
permission:
  bash:
    "rm -rf *": "ask"
    "sudo *": "deny"
    "chmod *": "ask"
    "*": "ask"  # More permissive for orchestration
  edit:
    "**/*.env*": "deny"
    "**/*.key": "deny"
    "**/*.secret": "deny"
    "node_modules/**": "deny"
    ".git/**": "deny"
  task:
    "*": "allow"  # Can delegate to any subagent
```

**Examples**: OpenCoder, OpenAgent, TaskManager

---

### Restricted Bash Agents (Specific Commands Only)

**Use case**: Agents that need only specific bash commands

```yaml
permission:
  bash:
    "git status*": "allow"
    "git diff*": "allow"
    "git log*": "allow"
    "ls *": "allow"
    "cat *": "allow"
    "*": "deny"
  edit:
    "**/*.env*": "deny"
  task:
    context-scout: "allow"
    "*": "deny"
```

**Examples**: ExternalScout, ContextScout

---

## Security Patterns

### Always Deny Sensitive Files

```yaml
permission:
  edit:
    "**/*.env*": "deny"
    "**/*.key": "deny"
    "**/*.secret": "deny"
    "**/*.pem": "deny"
    "**/*.crt": "deny"
    "**/credentials*": "deny"
```

### Always Deny Dangerous Commands

```yaml
permission:
  bash:
    "sudo *": "deny"
    "rm -rf /*": "deny"
    "chmod 777 *": "deny"
    "curl * | bash": "deny"
    "wget * | sh": "deny"
```

### Always Ask for Destructive Operations

```yaml
permission:
  bash:
    "rm -rf *": "ask"
    "git push --force*": "ask"
    "docker system prune*": "ask"
    "npm publish*": "ask"
```

---

## Task Permission Patterns

### Allow Specific Subagents Only

```yaml
permission:
  task:
    context-scout: "allow"
    external-scout: "allow"
    "*": "deny"
```

### Allow All Except Specific

```yaml
permission:
  task:
    "*": "allow"
    "dangerous-agent": "deny"
```

### Ask for Orchestration Agents

```yaml
permission:
  task:
    context-scout: "allow"      # Always allow context discovery
    "coder-agent": "ask"        # Ask before code generation
    "build-agent": "ask"        # Ask before builds
    "*": "deny"
```

---

## Complete Examples

### Example 1: Code Reviewer (Read-Only)

```yaml
---
name: CodeReviewer
description: Code review, security, and quality assurance agent
mode: subagent
temperature: 0.1
tools:
  read: true
  grep: true
  glob: true
  bash: false
  edit: false
  write: false
  task: true
permission:
  bash:
    "*": "deny"
  edit:
    "**/*": "deny"
  write:
    "**/*": "deny"
  task:
    context-scout: "allow"
    "*": "deny"
---
```

### Example 2: Test Engineer (Write-Enabled)

```yaml
---
name: TestEngineer
description: Test authoring and TDD agent
mode: subagent
temperature: 0.1
tools:
  read: true
  grep: true
  glob: true
  edit: true
  write: true
  bash: true
  task: true
permission:
  bash:
    "npx vitest *": "allow"
    "npx jest *": "allow"
    "pytest *": "allow"
    "npm test *": "allow"
    "go test *": "allow"
    "cargo test *": "allow"
    "rm -rf *": "ask"
    "sudo *": "deny"
    "*": "deny"
  edit:
    "**/*.env*": "deny"
    "**/*.key": "deny"
    "**/*.secret": "deny"
  task:
    context-scout: "allow"
    "*": "deny"
---
```

### Example 3: Primary Orchestrator

```yaml
---
name: OpenCoder
description: Orchestration agent for complex coding
mode: primary
temperature: 0.1
tools:
  task: true
  read: true
  edit: true
  write: true
  grep: true
  glob: true
  bash: true
permission:
  bash:
    "rm -rf *": "ask"
    "sudo *": "deny"
    "chmod *": "ask"
    "curl *": "ask"
    "wget *": "ask"
    "docker *": "ask"
    "kubectl *": "ask"
  edit:
    "**/*.env*": "deny"
    "**/*.key": "deny"
    "**/*.secret": "deny"
    "node_modules/**": "deny"
    ".git/**": "deny"
  task:
    "*": "allow"
---
```

---

## Validation Checklist

- [ ] Using `permission:` (singular, not `permissions:`)
- [ ] Catch-all rules (`"*"`) come FIRST
- [ ] Specific overrides come AFTER catch-all
- [ ] Sensitive files denied (`**/*.env*`, `**/*.key`, `**/*.secret`)
- [ ] Dangerous commands denied (`sudo *`, `rm -rf /*`)
- [ ] Destructive operations ask (`rm -rf *`, `git push --force*`)
- [ ] Task permissions appropriate for agent type
- [ ] Valid actions only (`"allow"`, `"ask"`, `"deny"`)

---

## Related

- **Agent Frontmatter**: `standards/agent-frontmatter.md`
- **Subagent Structure**: `standards/subagent-structure.md`
- **Security Patterns**: `../../core/standards/security-patterns.md`
- **OpenCode Docs**: https://opencode.ai/docs/permissions/

---

**Last Updated**: 2026-02-01 | **Version**: 1.0.0
