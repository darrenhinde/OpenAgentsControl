# Core Workflows Navigation

**Purpose**: Process workflows for common development tasks

---

## Files

| File | Topic | Priority | Load When |
|------|-------|----------|-----------|
| `code-review.md` | Code review process | ⭐⭐⭐⭐ | Reviewing code |
| `task-delegation.md` | Delegating to subagents | ⭐⭐⭐⭐ | Using task tool |
| `feature-breakdown.md` | Breaking down features | ⭐⭐⭐⭐ | 4+ files, complex tasks |
| `session-management.md` | Managing sessions | ⭐⭐⭐ | Session cleanup |
| `design-iteration.md` | Design iteration process | ⭐⭐⭐ | Design work |

---

## Loading Strategy

**For code review**:
1. Load `code-review.md` (high)
2. Depends on: `../standards/code-quality.md`, `../standards/security-patterns.md`

**For task delegation**:
1. Load `task-delegation.md` (high)

**For complex features**:
1. Load `feature-breakdown.md` (high)
2. Depends on: `task-delegation.md`

**For session management**:
1. Load `session-management.md` (medium)

---

## Related

- **Standards** → `../standards/navigation.md`
- **OpenAgents Control Delegation** → `../../openagents-repo/guides/subagent-invocation.md`
