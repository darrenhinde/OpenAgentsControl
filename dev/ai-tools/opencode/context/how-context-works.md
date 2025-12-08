# OpenCode File Structure & Reference Guide

## Directory Structure

### Global Config (`~/.config/opencode/`)

```
~/.config/opencode/
├── opencode.json          # Global config
├── AGENTS.md              # Auto-loaded instructions
├── CLAUDE.md              # Auto-loaded instructions
├── agent/                 # Custom agents
│   ├── my-agent.md
│   └── category/
│       └── nested-agent.md
├── command/               # Custom commands
│   └── my-command.md
└── plugin/                # Custom plugins
    └── my-plugin.ts
```

### Local Repo (`.opencode/`)

```
your-repo/
├── opencode.json          # Repo config
├── .opencode/
│   ├── AGENTS.md          # Auto-loaded instructions
│   ├── agent/             # Project-specific agents
│   │   └── my-agent.md
│   ├── command/           # Project-specific commands
│   │   └── my-command.md
│   └── plugin/            # Project-specific plugins
│       └── my-plugin.ts
└── src/
```

## Auto-Loaded Files

**Instruction files** (loaded automatically as system prompts):
- `AGENTS.md` - Custom instructions (global or local)
- `CLAUDE.md` - Legacy Claude instructions
- `CONTEXT.md` - Deprecated, but still works

**Config files** (merged in order):
1. `~/.config/opencode/opencode.json` (global)
2. `opencode.json` files from repo root up to current directory
3. Files from `.opencode/` folders in hierarchy

## Supported Subfolders

| Folder | Files | Purpose |
|--------|-------|---------|
| `agent/` | `*.md` | Custom agents with system prompts |
| `command/` | `*.md` | Custom slash commands |
| `plugin/` | `*.ts`, `*.js` | Custom tools and extensions |

**⚠️ Use singular names only:** `agent/`, NOT `agents/`

## File References with `@` Symbol

### Immediate vs. Lazy Loading

**With `@` symbol** - **Immediate Loading**:
- File is fetched and loaded right away
- Content is immediately available to the agent
- Use when context is always needed

**Without `@` symbol** - **Lazy Loading**:
- File is only fetched when the agent determines it's needed
- Saves tokens if the agent can complete the task without it
- Agent discovers and loads the file on-demand

### Using the `@` Symbol

**In commands and templates:**

```bash
# Relative to repo root
@README.md
@src/main.ts

# Home directory
@~/my-file.txt

# Absolute path
@/absolute/path/file.txt

# If file doesn't exist, looks for agent
@my-agent
```

**Resolution order:**
1. Check if starts with `~/` → resolve to home directory
2. Check if absolute path → use as-is
3. Otherwise → resolve relative to repo root (`Instance.worktree`)
4. If not found → look for agent with that name

### Best Practices for Lazy Loading (Without `@`)

When referencing files without the `@` symbol, help the agent discover them by:

**1. Provide clear file paths**
```
"Use the context from .opencode/command/commit.md if needed"
```

**2. Describe what's there** (so agent knows when to fetch)
```
"Check the commit command guidelines in .opencode/command/commit.md 
when you need to understand our commit message format"
```

**3. Mention directory conventions**
```
"Command templates are in .opencode/command/ - reference them as needed"
```

**4. Reference by purpose, not just path**
```
"Follow our commit guidelines (available in the command directory) 
when making commits"
```

### Example: Lazy Loading in Practice

**Without `@` symbol (lazy loading):**
```
"Create a git commit. Our commit guidelines are in .opencode/command/commit.md - 
check them if you need to understand our prefix conventions and message format."
```

This approach:
- ✅ Agent knows the file exists and where it is
- ✅ Agent knows WHEN it would be useful (for commit conventions)
- ✅ Agent only reads it IF it needs that information
- ✅ Saves tokens if the agent can complete the task without it

**With `@` symbol (immediate loading):**
```
"Create a git commit following these guidelines: @.opencode/command/commit.md"
```

This approach:
- ✅ File content is immediately available
- ✅ Guaranteed the agent has the context
- ⚠️ Uses tokens even if agent doesn't need it

### When to Use Each Approach

| Use `@` (Immediate) | Omit `@` (Lazy) |
|---------------------|-----------------|
| Context always required | Context might be needed |
| Short, critical files | Large reference files |
| Agent must follow exact format | Agent can infer or discover |
| Templates and schemas | Documentation and guides |

**Pro tip:** Modern agents are good at discovering needed files through `codebase_search` or exploring directories, but being explicit about important files helps ensure consistency.

---

## Research-Backed Context Architecture

### Three-Layer Progressive Architecture

Based on validated research from Stanford, Anthropic (2025), and recent AI agent engineering studies, effective context loading follows a three-layer progressive architecture:

#### Layer 1: Static Base Context (First 15% of Prompt)

This is your foundational layer, grounded in Stanford's position sensitivity research. **Critical instructions positioned early dramatically improve adherence.**

**What goes here:**
- Role definition (5-10%)
- Critical rules (defined once, early positioning)
- Task definition (clear objective)
- Constraint summary (high-level "must/must-not")

**Example:**
```xml
<role>Expert Prompt Architect</role>
<critical_rules priority="absolute" enforcement="strict">
  <rule id="position_sensitivity">Critical rules MUST be in first 15%</rule>
  <rule id="nesting_limit">Max nesting: 4 levels</rule>
</critical_rules>
<execution_priority>
  <tier level="1">Research patterns (non-negotiable)</tier>
</execution_priority>
```

**Why this matters:** Research shows position sensitivity improves adherence across model sizes. Critical rules at the start are more reliably followed than rules buried later in the prompt.

#### Layer 2: Lazy-Loaded Context (Just-in-Time Retrieval)

This layer uses the "just-in-time" approach validated by Anthropic's 2025 research on effective context engineering for AI agents.

> Rather than pre-processing all relevant data up front, agents built with the "just-in-time" approach maintain lightweight identifiers (file paths, stored queries, web links, etc.) and use these references to dynamically load data into context at runtime using tools.

**Implementation:**
```xml
<context_sources>
  <!-- Agent fetches these as needed, not embedded upfront -->
  <standards>.opencode/context/core/standards/code.md</standards>
  <practices>.opencode/context/core/practices/review.md</practices>
  <workflows>.opencode/context/core/workflows/delegation.md</workflows>
</context_sources>
```

**Key insight:** This enables **progressive disclosure**. Agents incrementally discover context through exploration:
- File naming hints at purpose (`.../standards/code.md` vs `.../practices/review.md`)
- File size signals complexity
- Timestamps indicate recency
- Folder structure provides hierarchical context

**Token efficiency gain:**
- Pre-loading all context: **2,000-5,000+ tokens**
- Just-in-time loading: **300-1,000 tokens per file** (agents typically need 2-3 files, not 10)
- **Net savings: 60-80% reduction in token usage**

#### Layer 3: Dynamic Runtime Context (Execution-Time Loading)

This layer handles long-horizon tasks and evolving context through compaction and memory strategies.

**Implementation:**
```xml
<session_memory>
  <!-- Agents write notes persisted outside context window -->
  <!-- Read back in at later times for coherence -->
  .opencode/sessions/[task-id].md
</session_memory>

<dynamic_context>
  <!-- RAG retrieval results filtered for relevance -->
  <!-- Tool execution outputs -->
  <!-- Delegation context from prior agents -->
</dynamic_context>
```

**Research backing:** For tasks spanning multiple turns:
- **Compaction**: Summarize context nearing window limit, reinitiate with summary + critical details
- **Structured note-taking**: Agent maintains notes in persistent memory (like session files), pulled back in later
- **Progressive context assembly**: Each interaction yields context informing the next decision

### Progressive Disclosure by Design

Structure your context hierarchy so agents discover relevance layer-by-layer:

```
.opencode/context/core/
├── standards/              ← Broad guidelines (agent starts here)
│   ├── code.md            ← File naming hints: "code" standards
│   ├── tests.md           ← "tests" = test-specific rules
│   └── patterns.md        ← "patterns" = architectural patterns
├── practices/              ← Execution-level practices
│   ├── analysis.md        ← "analysis" = how to analyze
│   └── review.md          ← "review" = code review criteria
├── workflows/              ← Process templates
│   ├── delegation.md      ← Delegation patterns
│   ├── task-breakdown.md  ← Task analysis workflows
│   └── sessions.md        ← Session management
└── system/
    └── context-guide.md   ← System internals
```

Each folder name signals purpose. Each file name within folders signals specific application. This is **progressive disclosure by design** - agents can navigate the hierarchy based on their current needs.

### Long-Horizon Task Strategies

For multi-hour tasks spanning context resets:

**Compaction Strategy:**
```xml
<memory_strategy>
  <!-- Before context reset: Agent summarizes work -->
  <compaction>
    Preserve: Architectural decisions, unresolved bugs, key insights
    Discard: Redundant tool outputs, repeated attempts
  </compaction>
  
  <!-- After reset: Agent reads notes and continues -->
  <structured_notes path=".opencode/sessions/[id].md">
    • Decisions made
    • Current phase
    • Next steps
    • Unresolved issues
  </structured_notes>
</memory_strategy>
```

**Example:** Anthropic's Claude Code maintains precise tallies across thousands of steps using persistent notes - the same pattern your session files implement.

### Anti-Patterns to Avoid

Research identifies these common mistakes that reduce effectiveness:

#### ❌ Anti-Pattern 1: Overload Static Context

```xml
<!-- DON'T DO THIS -->
<prompt>
  <all_standards><!-- 5000+ tokens of standards upfront --></all_standards>
  <task>Fix typo in button</task>
</prompt>
```

**Problems:**
- Attention budget exhaustion (n² transformer relationships)
- Reduced position sensitivity effectiveness (critical rules get buried)
- Worse adherence to specific instructions

**Solution:** Use lazy loading for large reference materials.

#### ❌ Anti-Pattern 2: Deep Nesting

```xml
<!-- DON'T DO THIS -->
<instructions>
  <workflow>
    <delegation>
      <criteria>
        <when>
          <condition>
            <!-- 6+ levels: breaks clarity -->
```

**Problem:** Nesting depth >4 levels reduces clarity significantly.

**Solution:** Use attributes and flatter structures with max 4 levels.

#### ❌ Anti-Pattern 3: Repeating Critical Rules

```xml
<!-- DON'T DO THIS -->
<rule_1>Always request approval</rule_1>
... 2000 tokens later ...
<rule_2>Always get approval before execution</rule_2>
... 3000 tokens later ...
<rule_3>Approval must be obtained</rule_3>
```

**Problem:** Repetition causes ambiguity and wastes tokens.

**Solution:** Define rules once in the first 15%, reference them with `@rule_id` elsewhere.

### Token Efficiency Metrics

Real-world measurements from production agent systems:

| Approach | Token Cost | Files Loaded | Efficiency |
|----------|-----------|--------------|------------|
| Pre-load all context | 2,000-5,000+ | 10-15 files | Baseline |
| Just-in-time loading | 300-1,000 | 2-3 files | **60-80% savings** |
| With compaction | 500-1,500 | 3-5 files | **50-70% savings** |

**Key insight:** Agents typically need only 2-3 context files per task, not the entire knowledge base.

### Research Validation Summary

| Pattern | Research Basis | Effect |
|---------|----------------|--------|
| **Position Sensitivity** | Stanford multi-instruction study | Improves adherence (varies by task/model) |
| **Just-in-Time Loading** | Anthropic context engineering (2025) | 60-80% token reduction |
| **Progressive Disclosure** | Anthropic agent research | Agents discover context incrementally |
| **Nesting Depth ≤4** | Anthropic XML research | Reduces complexity, improves clarity |
| **Compaction + Memory** | Anthropic long-horizon tasks | Maintains coherence across resets |

### Research Sources

- **Anthropic (2025)**: "Effective Context Engineering for AI Agents"
- **Stanford**: Multi-instruction position sensitivity study
- **Anthropic**: "XML Prompting as Grammar-Constrained Interaction" (ArXiv 2509.08182)
- **ODSC (2025)**: "Building Dynamic In-Context Learning for Self-Optimizing Agents"
- **ArXiv**: "Optimization of Retrieval-Augmented Generation Context with Outlier Detection" (2407.01403)

---

## Custom Instruction Files

**For arbitrary paths, use `instructions` field:**

```json
{
  "instructions": [
    "~/opencode/context/my-context.md",
    "docs/**/*.md",
    ".opencode/context/**/*.md"
  ]
}
```

**Paths can be:**
- Absolute: `/path/to/file.md`
- Home relative: `~/path/to/file.md`
- Repo relative: `docs/instructions.md`
- Glob patterns: `**/*.md`

## Config Merging

**Configs merge with priority** (later overrides earlier):
1. Global config (`~/.config/opencode/`)
2. Repo root configs (from root up)
3. Custom config directories (`.opencode/` folders)
4. Environment variables (`OPENCODE_CONFIG`)

**Agents, commands, and plugins** from all locations are merged together.

## Quick Reference

| What | Where | How |
|------|-------|-----|
| Global agent | `~/.config/opencode/agent/name.md` | Auto-loaded |
| Local agent | `.opencode/agent/name.md` | Auto-loaded |
| Global command | `~/.config/opencode/command/name.md` | Auto-loaded |
| Local command | `.opencode/command/name.md` | Auto-loaded |
| Global instructions | `~/.config/opencode/AGENTS.md` | Auto-loaded |
| Local instructions | `.opencode/AGENTS.md` or `AGENTS.md` | Auto-loaded |
| Custom files | Anywhere | Use `instructions` config or `@` symbol |
