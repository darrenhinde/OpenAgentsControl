<!-- Context: workflows/delegation | Priority: high | Version: 3.0 | Updated: 2026-01-28 -->
# Delegation Context Template

## Quick Reference

**Process**: Discover → Propose → Approve → Init Session → Persist Context → Delegate → Cleanup

**Location**: `.tmp/sessions/{YYYY-MM-DD}-{task-slug}/context.md`

**Key Principle**: ContextScout discovers paths. The orchestrator persists them into context.md AFTER approval. Downstream agents read from context.md — no re-discovery.

---

## When to Create a Session

Only create a session when:
- User has **approved** the proposed approach (never before)
- Task requires delegation to TaskManager or working agents
- Task is complex enough to need shared context (4+ files, >60min)

For simple tasks (1-3 files, direct execution): skip session creation entirely.

---

## The Flow

```
Stage 1: DISCOVER   → ContextScout finds paths (read-only, nothing written)
Stage 2: PROPOSE    → Show user lightweight summary (nothing written)
Stage 3: APPROVE    → User says yes. NOW we can write.
Stage 4: INIT       → Create session dir + context.md (persist discovered paths here)
Stage 5: DELEGATE   → Pass session path to TaskManager / working agents
Stage 6: CLEANUP    → Ask user, then delete session dir
```

---

## Template Structure

**Location**: `.tmp/sessions/{YYYY-MM-DD}-{task-slug}/context.md`

```markdown
# Task Context: {Task Name}

Session ID: {YYYY-MM-DD}-{task-slug}
Created: {ISO timestamp}
Status: in_progress

## Current Request
{What user asked for — verbatim or close paraphrase}

## Context Files (Standards to Follow)
These are the paths ContextScout discovered. Downstream agents load these for coding standards, patterns, and conventions.
- .opencode/context/core/standards/code-quality.md
- .opencode/context/core/standards/test-coverage.md
- {other paths discovered by ContextScout}

## Reference Files (Source Material to Look At)
These are project files relevant to the task — NOT standards. Downstream agents reference these to understand existing code, config, or structure.
- {e.g. package.json}
- {e.g. src/existing-module.ts}

## External Context Fetched
These are live documentation files fetched from external libraries via ExternalScout. Subagents should reference these instead of re-fetching.
- `.tmp/external-context/{package-name}/{topic}.md` — {description}
- `.tmp/external-context/{package-name}/{topic}.md` — {description}

**Important**: These files are read-only and cached for reference. Do not modify them.

## Components
{The functional units identified during proposal}
- {Component 1} — {what it does}
- {Component 2} — {what it does}

## Constraints
{Technical constraints, preferences, compatibility notes, version requirements}

## Exit Criteria
- [ ] {specific, measurable completion condition}
- [ ] {specific, measurable completion condition}

## Progress
- [ ] Session initialized
- [ ] Tasks created (if using TaskManager)
- [ ] Implementation complete
- [ ] Tests passing
- [ ] Handoff complete
```

---

## Delegation Process

**Step 1: Discover** (before approval)
- Call ContextScout. Capture the returned file paths.
- Call ExternalScout if external libraries involved.
- Do NOT write anything to disk.

**Step 2: Propose** (before approval)
- Show user a lightweight summary of approach + discovered context.
- Do NOT create session or plan docs.

**Step 3: Approve** (gate)
- Wait for explicit user approval.
- If rejected or redirected → back to Step 1.

**Step 4: Init Session** (first writes, only after approval)
- Create `.tmp/sessions/{YYYY-MM-DD}-{task-slug}/`
- Write `context.md` using the template above.
- **CRITICAL**: Populate `## Context Files` with the paths ContextScout discovered in Step 1. This is the handoff point — if you skip this, downstream agents lose the context.
- Populate `## Reference Files` with any project source files relevant to the task.

**Step 5: Delegate with context path**
```
task(
  subagent_type="TaskManager",  // or CoderAgent, TestEngineer, etc.
  description="{brief description}",
  prompt="Load context from .tmp/sessions/{session-id}/context.md

          Read the context file for full requirements, standards, and constraints.
          {specific instructions for this subagent}"
)
```

**Step 6: Cleanup after completion**
- Ask user: "Task complete. Clean up session files at `.tmp/sessions/{session-id}/`?"
- If approved: Delete session directory.

---

## Semantic Rules for Task JSONs

When TaskManager creates subtask JSONs, it MUST follow these rules:

| Field | Contains | Example |
|-------|----------|---------|
| `context_files` | **Standards only** — paths to coding conventions, patterns, security rules | `.opencode/context/core/standards/code-quality.md` |
| `reference_files` | **Source material only** — project files to look at for existing patterns | `src/auth/existing-service.ts`, `package.json` |
| `external_context` | **External docs only** — cached documentation from external libraries (read-only) | `.tmp/external-context/drizzle-orm/modular-schemas.md` |

**Never mix them.** A downstream agent reading `context_files` expects "rules to follow." A downstream agent reading `reference_files` expects "files to understand." A downstream agent reading `external_context` expects "cached external docs to reference" (read-only). Mixing them causes confusion about what to follow vs. what to reference vs. what to read.

---

## What Downstream Agents Expect

| Agent | What it reads | What it does with it |
|-------|---------------|---------------------|
| **TaskManager** | `context.md` (full session) | Extracts context_files + reference_files + external_context, puts them into subtask JSONs |
| **CoderAgent** | subtask JSON (`context_files` + `reference_files` + `external_context`) | Loads standards, references source files, reads external docs, implements |
| **TestEngineer** | session `context.md` path (passed in prompt) | Knows what standards were applied, reads external context, writes tests accordingly |
| **CodeReviewer** | session `context.md` path (passed in prompt) | Knows what standards were applied, reviews against them, considers external context |

**Key**: 
- TestEngineer and CodeReviewer should ALWAYS receive the session context path when delegated. This way they review against the same standards that were used during implementation — not whatever they independently discover.
- All agents should read `external_context` files to understand external library patterns and requirements — this avoids re-fetching and ensures consistency.

---

## Context Caching for Repeated Patterns

For repeated task types (e.g., "write tests", "code review", "documentation"), cache discovered context to avoid re-discovery overhead.

### When to Cache

Cache context when:
- Same task type appears multiple times in a session
- Same context files are needed repeatedly
- Multiple subtasks use identical standards
- Parallel tasks need the same context

### Cache Structure

```
.tmp/sessions/{session-id}/
├── context.md (main session context)
├── .cache/
│   ├── test-coverage.md (cached from .opencode/context/core/standards/test-coverage.md)
│   ├── code-quality.md (cached from .opencode/context/core/standards/code-quality.md)
│   └── code-review.md (cached from .opencode/context/core/workflows/code-review.md)
└── .manifest.json (tracks cache status)
```

### Cache Manifest

```json
{
  "session_id": "2026-01-28-parallel-tests",
  "created_at": "2026-01-28T14:30:22Z",
  "cache": {
    "test-coverage.md": {
      "source": ".opencode/context/core/standards/test-coverage.md",
      "cached_at": "2026-01-28T14:30:25Z",
      "used_by": ["subtask_01", "subtask_02", "subtask_03"],
      "status": "valid"
    },
    "code-quality.md": {
      "source": ".opencode/context/core/standards/code-quality.md",
      "cached_at": "2026-01-28T14:30:26Z",
      "used_by": ["subtask_01", "subtask_02"],
      "status": "valid"
    }
  }
}
```

### Cache Invalidation Rules

Cache is INVALID when:
- Source file has been modified (check timestamp)
- Session is older than 24 hours
- Context file version has changed
- User explicitly requests cache refresh

Cache is VALID when:
- Source file timestamp matches cached timestamp
- Session is less than 24 hours old
- No version changes detected
- Multiple tasks in same session use same context

### Implementation Pattern

**Step 1: Check Cache**
```javascript
// Before delegating to subagent
IF cache exists AND cache is valid:
  USE cached context file
  SKIP re-reading from .opencode/context/
ELSE:
  READ from .opencode/context/
  CACHE the file
```

**Step 2: Cache Hit Example**
```
Session: 2026-01-28-parallel-tests

Task 1: Write component A
  → Load test-coverage.md (CACHE MISS)
  → Cache it at .tmp/sessions/.../cache/test-coverage.md
  
Task 2: Write component B
  → Load test-coverage.md (CACHE HIT)
  → Use cached version (faster)
  
Task 3: Write tests
  → Load test-coverage.md (CACHE HIT)
  → Use cached version (faster)
```

**Step 3: Cache Miss Example**
```
Session: 2026-01-28-parallel-tests

Task 1: Write code
  → Load code-quality.md (CACHE MISS)
  → Cache it
  
Task 2: Code review
  → Load code-review.md (CACHE MISS)
  → Cache it
  
Task 3: Write more code
  → Load code-quality.md (CACHE HIT)
  → Use cached version
```

### Benefits

- **Faster execution**: Avoid re-reading same files
- **Reduced I/O**: Fewer file system operations
- **Better performance**: Especially for parallel tasks
- **Consistent context**: All tasks use same version

### Example: Parallel Tasks with Caching

```javascript
// Session initialization
session_id = "2026-01-28-parallel-tests"
context_cache = {}

// Task 1: Write component A (parallel)
task(
  subagent_type="CoderAgent",
  description="Write component A",
  prompt="Load context from .tmp/sessions/{session_id}/context.md
          Use cached context if available at .tmp/sessions/{session_id}/.cache/"
)

// Task 2: Write component B (parallel)
task(
  subagent_type="CoderAgent",
  description="Write component B",
  prompt="Load context from .tmp/sessions/{session_id}/context.md
          Use cached context if available at .tmp/sessions/{session_id}/.cache/"
)

// Task 3: Write tests (depends on 1+2)
task(
  subagent_type="TestEngineer",
  description="Write tests",
  prompt="Load context from .tmp/sessions/{session_id}/context.md
          Use cached context if available at .tmp/sessions/{session_id}/.cache/"
)

// Result: Tasks 1 & 2 cache context, Task 3 uses cache (faster)
```

### Monitoring Cache

Track cache effectiveness:
```json
{
  "cache_stats": {
    "total_reads": 15,
    "cache_hits": 9,
    "cache_misses": 6,
    "hit_rate": "60%",
    "time_saved": "2.3 seconds"
  }
}
```

### Best Practices

✅ **Do**:
- Cache context for repeated task types
- Validate cache before using
- Invalidate cache when source changes
- Monitor cache hit rate
- Clean up cache with session

❌ **Don't**:
- Cache external context (always fetch fresh)
- Cache for single-task sessions (overhead not worth it)
- Ignore cache invalidation rules
- Mix cached and fresh context in same task
