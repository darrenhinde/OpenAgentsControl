---
name: code-review
description: Use when code has been written and needs validation before committing, or when the user asks for a code review or security check.
context: fork
agent: code-reviewer
---

# Code Review

## Overview
Review code for security, correctness, and quality. Runs in isolated code-reviewer context with pre-loaded standards.

**Announce at start:** "I'm using the code-review skill to validate [files/feature]."

## The Process

### Step 1: Pre-Load Context (Main Agent)

Load standards BEFORE invoking review:

```bash
Read: .opencode/context/core/standards/code-quality.md
Read: .opencode/context/core/standards/security-patterns.md
```

### Step 2: Invoke Review

```bash
/code-review path/to/file.ts
/code-review src/auth/*.ts
/code-review $(git diff --name-only HEAD~1)
```

### Step 3: Analyze Report

Code-reviewer returns structured findings:

```markdown
## Code Review: Auth Service

### 🔴 CRITICAL (Must Fix)
1. **SQL Injection Risk** — src/db/query.ts:42
   - Problem: Unparameterized query with user input
   - Risk: Database compromise
   - Fix:
     ```diff
     - db.query(`SELECT * FROM users WHERE id = ${userId}`)
     + db.query('SELECT * FROM users WHERE id = ?', [userId])
     ```

### 🟠 HIGH (Correctness)
2. **Missing Error Handling** — src/auth/service.ts:28
   - Problem: Async function without try/catch
   - Risk: Unhandled promise rejection
   - Fix: Wrap in try/catch with proper logging

### 🟡 MEDIUM (Style)
3. **Naming Convention** — src/auth/middleware.ts:15
   - Problem: snake_case instead of camelCase
   - Fix: Rename verify_token → verifyToken

### Summary
Total Issues: 3 (1 Critical, 1 High, 1 Medium)
Recommendation: REQUEST CHANGES
```

### Step 4: Take Action

**If CRITICAL or HIGH issues:**
1. STOP—do not commit
2. Fix issues using suggested diffs
3. Re-run `/code-review` to verify
4. Proceed only when clean

**If only MEDIUM or LOW issues:**
1. Evaluate whether to fix now or later
2. Apply quality improvements
3. Safe to commit

**If no issues:**
1. Commit with confidence
2. Note positive patterns

## Review Checks

**🔴 CRITICAL (Security):**
- SQL injection, XSS, command injection
- Hardcoded credentials or secrets
- Path traversal, auth bypass

**🟠 HIGH (Correctness):**
- Missing error handling
- Type mismatches
- Null/undefined gaps
- Logic errors, race conditions

**🟡 MEDIUM (Maintainability):**
- Naming violations
- Code duplication
- Poor organization

**🟢 LOW (Suggestions):**
- Performance optimizations
- Documentation improvements

## Error Handling

**Review fails:**
- Ensure context files pre-loaded

**Too many findings:**
- Fix CRITICAL first, then re-review

**Unclear findings:**
- Request clarification in report

## Red Flags

If you think any of these, STOP and re-read this skill:

- "The code looks fine, a review is overkill"
- "I wrote it, I know it's correct"
- "We're in a hurry, we can review later"
- "It's a small change, no security risk"

## Common Rationalizations

| Excuse | Reality |
|--------|---------|
| "I just wrote it so I know it's right" | The author is the worst reviewer. Fresh eyes catch what familiarity hides. |
| "It's a small change" | Security vulnerabilities are almost always in small, "obvious" changes. |
| "We can review after merging" | Post-merge review finds bugs in production. Pre-merge review finds them for free. |
| "There's no user input so no injection risk" | Internal data becomes user input when requirements change. Review now. |

## Remember

- Pre-load standards BEFORE invoking review
- CRITICAL and HIGH issues BLOCK commits
- Apply suggested fixes with code diffs
- Re-review after fixing blocking issues
- Review does NOT modify code—only suggests changes
- Review does NOT run tests—use test-generation for that

## Related

- context-discovery
- code-execution
- test-generation

---

**Task**: Review the following files: **$ARGUMENTS**

**Instructions for code-reviewer subagent:**

1. Read all files in $ARGUMENTS
2. Apply pre-loaded standards (code quality, security, conventions)
3. Scan for: Security (HIGHEST PRIORITY) → Correctness → Style → Performance
4. Structure findings by severity: CRITICAL → HIGH → MEDIUM → LOW
5. For each finding: Problem + Risk + Suggested fix with diff
6. Include positive observations
7. Return recommendation: APPROVE | REQUEST CHANGES | COMMENT
