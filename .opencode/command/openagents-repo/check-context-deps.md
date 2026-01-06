---
description: Analyze context file usage across agents and validate registry dependencies
tags:
  - registry
  - validation
  - context
  - dependencies
dependencies:
  - subagent:codebase-pattern-analyst
---

# Check Context Dependencies

Analyzes which agents reference context files and validates that those dependencies are properly declared in the registry.

**Arguments**: `$ARGUMENTS`

---

## Purpose

This command helps maintain consistency between:
1. **Actual context file usage** (what agents reference in their prompts)
2. **Declared dependencies** (what's in registry.json)

It identifies:
- ✅ Agents using context files but not declaring them as dependencies
- ✅ Context files that exist but aren't used by any agent
- ✅ Missing context files that agents reference
- ✅ Inconsistent dependency declarations

---

## Usage

```bash
# Analyze all agents and report findings
/check-context-deps

# Analyze specific agent
/check-context-deps opencoder

# Analyze and auto-fix (add missing dependencies to frontmatter)
/check-context-deps --fix

# Verbose output with all references found
/check-context-deps --verbose
```

---

## Workflow

<workflow id="analyze_context_dependencies">
  <stage id="1" name="ScanAgents" required="true">
    Use grep to find all context file references in agent files:
    
    **Search patterns**:
    - `.opencode/context/core/` (direct path references)
    - `@.opencode/context/` (@ symbol references for OpenRouter)
    - `context:` (dependency format in frontmatter)
    
    **Locations to scan**:
    - `.opencode/agent/**/*.md` (all agents and subagents)
    - `.opencode/prompts/**/*.md` (prompt templates)
    
    **Extract**:
    - Agent ID/name
    - Context file path referenced
    - Line number where referenced
    - Type of reference (direct path, @-reference, dependency declaration)
  </stage>
  
  <stage id="2" name="CheckRegistry" required="true">
    For each agent found, check registry.json:
    
    ```bash
    jq '.components.agents[] | select(.id == "AGENT_ID") | .dependencies' registry.json
    jq '.components.subagents[] | select(.id == "AGENT_ID") | .dependencies' registry.json
    ```
    
    **Verify**:
    - Does the agent have a dependencies array?
    - Are context file references declared as `context:core/standards/code`?
    - Are the dependency formats correct (`context:path/to/file`)?
  </stage>
  
  <stage id="3" name="ValidateContextFiles" required="true">
    For each context file referenced:
    
    **Check existence**:
    ```bash
    test -f .opencode/context/core/standards/code.md
    ```
    
    **Check registry**:
    ```bash
    jq '.components.contexts[] | select(.id == "core/standards/code")' registry.json
    ```
    
    **Identify issues**:
    - Context file referenced but doesn't exist
    - Context file exists but not in registry
    - Context file in registry but never used
  </stage>
  
  <stage id="4" name="Report" required="true">
    Generate comprehensive report:
    
    ```markdown
    # Context Dependency Analysis Report
    
    ## Summary
    - Agents scanned: 25
    - Context files referenced: 12
    - Missing dependencies: 8
    - Unused context files: 2
    - Missing context files: 0
    
    ## Missing Dependencies (agents using context but not declaring)
    
    ### opencoder
    **Uses but not declared**:
    - context:core/standards/code (referenced 3 times)
      - Line 64: "Code tasks → .opencode/context/core/standards/code.md (MANDATORY)"
      - Line 170: "Read .opencode/context/core/standards/code.md NOW"
      - Line 229: "NEVER execute write/edit without loading required context first"
    
    **Current dependencies**: subagent:task-manager, subagent:coder-agent
    **Recommended fix**: Add to frontmatter:
    ```yaml
    dependencies:
      - subagent:task-manager
      - subagent:coder-agent
      - context:core/standards/code  # ADD THIS
    ```
    
    ### openagent
    **Uses but not declared**:
    - context:core/standards/code (referenced 5 times)
    - context:core/standards/docs (referenced 3 times)
    - context:core/standards/tests (referenced 3 times)
    - context:core/workflows/review (referenced 2 times)
    - context:core/workflows/delegation (referenced 4 times)
    
    **Recommended fix**: Add to frontmatter:
    ```yaml
    dependencies:
      - subagent:task-manager
      - subagent:documentation
      - context:core/standards/code
      - context:core/standards/docs
      - context:core/standards/tests
      - context:core/workflows/review
      - context:core/workflows/delegation
    ```
    
    ## Unused Context Files (exist but no agent references them)
    
    - context:core/standards/analysis (0 references)
    - context:core/workflows/sessions (0 references)
    
    **Recommendation**: Consider removing or documenting intended use
    
    ## Missing Context Files (referenced but don't exist)
    
    None found ✅
    
    ## Context File Usage Map
    
    | Context File | Used By | Reference Count |
    |--------------|---------|-----------------|
    | core/standards/code | opencoder, openagent, frontend-specialist, reviewer | 15 |
    | core/standards/docs | openagent, documentation, technical-writer | 8 |
    | core/standards/tests | openagent, tester | 6 |
    | core/workflows/delegation | openagent, task-manager | 5 |
    | core/workflows/review | openagent, reviewer | 4 |
    
    ---
    
    ## Next Steps
    
    1. Review missing dependencies above
    2. Run `/check-context-deps --fix` to auto-update frontmatter
    3. Run `./scripts/registry/auto-detect-components.sh` to update registry
    4. Verify with `./scripts/registry/validate-registry.sh`
    ```
  </stage>
  
  <stage id="5" name="Fix" when="--fix flag provided">
    For each agent with missing context dependencies:
    
    1. Read the agent file
    2. Parse frontmatter YAML
    3. Add missing context dependencies to dependencies array
    4. Preserve existing dependencies
    5. Write updated file
    6. Report what was changed
    
    **Example**:
    ```diff
    ---
    id: opencoder
    dependencies:
      - subagent:task-manager
      - subagent:coder-agent
    + - context:core/standards/code
    ---
    ```
    
    **Safety**:
    - Only add dependencies that are actually referenced in the file
    - Don't remove existing dependencies
    - Preserve frontmatter formatting
    - Show diff before applying (if interactive)
  </stage>
</workflow>

---

## Implementation Details

### Grep Patterns

**Find direct path references**:
```bash
grep -r "\.opencode/context/core/" .opencode/agent/ .opencode/prompts/
```

**Find @ references (OpenRouter format)**:
```bash
grep -r "@\.opencode/context/" .opencode/agent/ .opencode/prompts/
```

**Find dependency declarations**:
```bash
grep -r "context:" .opencode/agent/ .opencode/prompts/
```

### Context File Path Normalization

**Convert various formats to dependency format**:
- `.opencode/context/core/standards/code.md` → `context:core/standards/code`
- `@.opencode/context/core/standards/code.md` → `context:core/standards/code`
- `context/core/standards/code` → `context:core/standards/code`

**Rules**:
1. Strip `.opencode/` prefix
2. Strip `.md` extension
3. Ensure `context:` prefix for dependency format

### Registry Lookup

**Check if context file is in registry**:
```bash
jq '.components.contexts[] | select(.id == "core/standards/code")' registry.json
```

**Get agent dependencies**:
```bash
jq '.components.agents[] | select(.id == "opencoder") | .dependencies[]?' registry.json
```

---

## Delegation

This command delegates to an analysis agent to perform the work:

```javascript
task(
  subagent_type="subagents/code/codebase-pattern-analyst",
  description="Analyze context dependencies",
  prompt=`
    Analyze context file usage across all agents in this repository.
    
    TASK:
    1. Use grep to find all references to context files in:
       - .opencode/agent/**/*.md
       - .opencode/prompts/**/*.md
    
    2. Search for these patterns:
       - ".opencode/context/core/" (direct paths)
       - "@.opencode/context/" (@ references)
       - "context:" in frontmatter (dependency declarations)
    
    3. For each agent file found:
       - Extract agent ID from frontmatter
       - List all context files it references
       - Check registry.json for declared dependencies
       - Identify missing dependency declarations
    
    4. For each context file in .opencode/context/core/:
       - Count how many agents reference it
       - Check if it exists in registry.json
       - Identify unused context files
    
    5. Generate a comprehensive report showing:
       - Agents with missing context dependencies
       - Unused context files
       - Missing context files (referenced but don't exist)
       - Context file usage map (which agents use which files)
    
    ${ARGUMENTS.includes('--fix') ? `
    6. AUTO-FIX MODE:
       - Update agent frontmatter to add missing context dependencies
       - Use format: context:core/standards/code
       - Preserve existing dependencies
       - Show what was changed
    ` : ''}
    
    ${ARGUMENTS.includes('--verbose') ? `
    VERBOSE MODE: Include all reference locations (file:line) in report
    ` : ''}
    
    ${ARGUMENTS.length > 0 && !ARGUMENTS.includes('--') ? `
    FILTER: Only analyze agent: ${ARGUMENTS[0]}
    ` : ''}
    
    REPORT FORMAT:
    - Summary statistics
    - Missing dependencies by agent (with recommended fixes)
    - Unused context files
    - Context file usage map
    - Next steps
    
    DO NOT make changes without --fix flag.
    ALWAYS show what would be changed before applying fixes.
  `
)
```

---

## Examples

### Example 1: Basic Analysis

```bash
/check-context-deps
```

**Output**:
```
Analyzing context file usage across 25 agents...

Found 8 agents with missing context dependencies:
- opencoder: missing context:core/standards/code
- openagent: missing 5 context dependencies
- frontend-specialist: missing context:core/standards/code
...

Run /check-context-deps --fix to auto-update frontmatter
```

### Example 2: Analyze Specific Agent

```bash
/check-context-deps opencoder
```

**Output**:
```
Analyzing agent: opencoder

Context files referenced:
✓ .opencode/context/core/standards/code.md (3 references)
  - Line 64: "Code tasks → .opencode/context/core/standards/code.md"
  - Line 170: "Read .opencode/context/core/standards/code.md NOW"
  - Line 229: "without loading required context first"

Registry dependencies:
✗ context:core/standards/code NOT DECLARED

Recommended fix:
Add to frontmatter: context:core/standards/code
```

### Example 3: Auto-Fix

```bash
/check-context-deps --fix
```

**Output**:
```
Analyzing and fixing context dependencies...

Updated opencoder:
+ Added: context:core/standards/code

Updated openagent:
+ Added: context:core/standards/code
+ Added: context:core/standards/docs
+ Added: context:core/standards/tests
+ Added: context:core/workflows/review
+ Added: context:core/workflows/delegation

Total: 2 agents updated, 6 dependencies added

Next: Run ./scripts/registry/auto-detect-components.sh to update registry
```

---

## Success Criteria

✅ All agents that reference context files have them declared in dependencies
✅ All context files in registry are actually used by at least one agent
✅ No broken references (context files referenced but don't exist)
✅ Dependency format is consistent (`context:path/to/file`)

---

## Notes

- This command is **read-only by default** (only reports findings)
- Use `--fix` flag to actually update agent frontmatter
- After fixing, run `./scripts/registry/auto-detect-components.sh` to update registry
- Context dependencies use format: `context:core/standards/code` (no `.opencode/` prefix, no `.md` extension)
- The analysis includes both direct path references and @ references (OpenRouter format)
