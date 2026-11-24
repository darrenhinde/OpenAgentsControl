# Agent Validator Plugin - Management Guide

## Overview

The Agent Validator Plugin is a real-time monitoring and validation system for OpenCode agents. It tracks agent behavior, validates compliance with defined rules, and provides detailed reports on how agents execute tasks.

### What It Does

- **Tracks agent activity** - Monitors which agents are active and what tools they use
- **Validates approval gates** - Ensures agents request approval before executing operations
- **Analyzes context loading** - Checks if agents load required context files before tasks
- **Monitors delegation** - Validates delegation decisions follow the 4+ file rule
- **Detects violations** - Identifies critical rule violations (auto-fix attempts, missing approvals)
- **Generates reports** - Creates comprehensive validation reports with compliance scores

### Why Use It

- **Verify agent behavior** - Confirm agents follow their defined prompts
- **Debug issues** - Understand what agents are doing and why
- **Track compliance** - Ensure critical safety rules are enforced
- **Improve prompts** - Identify patterns that need refinement
- **Multi-agent tracking** - Monitor agent switches and delegation flows

---

## Quick Start

### Installation

The plugin auto-loads from `.opencode/plugin/` when OpenCode starts.

**Install dependencies:**
```bash
cd ~/.opencode/plugin
npm install
# or
bun install
```

**Verify installation:**
```bash
opencode --agent openagent
> "analyze_agent_usage"
```

If you see agent tracking data, the plugin is working! ✅

### Your First Validation

1. **Start a session and do some work:**
   ```bash
   opencode --agent openagent
   > "Run pwd command"
   Agent: [requests approval]
   > "proceed"
   ```

2. **Check what was tracked:**
   ```bash
   > "analyze_agent_usage"
   ```

3. **Validate compliance:**
   ```bash
   > "validate_session"
   ```

---

## Available Tools

The plugin provides 7 validation tools:

### 1. `analyze_agent_usage`

**Purpose:** Show which agents were active and what tools they used

**Usage:**
```bash
analyze_agent_usage
```

**Example Output:**
```
## Agent Usage Report

**Agents detected:** 2
**Total events:** 7

### openagent
**Active duration:** 133s
**Events:** 5
**Tools used:**
- bash: 2x
- read: 1x
- analyze_agent_usage: 2x

### build
**Active duration:** 0s
**Events:** 2
**Tools used:**
- bash: 2x
```

**When to use:**
- After agent switches to verify tracking
- To see tool usage patterns
- To debug which agent did what

---

### 2. `validate_session`

**Purpose:** Comprehensive validation of agent behavior against defined rules

**Usage:**
```bash
validate_session
# or with details
validate_session --include_details true
```

**Example Output:**
```
## Validation Report

**Score:** 95%
- ✅ Passed: 18
- ⚠️  Warnings: 1
- ❌ Failed: 0

### ⚠️  Warnings
- **delegation_appropriateness**: Delegated but only 2 files (< 4 threshold)
```

**What it checks:**
- Approval gate enforcement
- Tool usage patterns
- Context loading behavior
- Delegation appropriateness
- Critical rule compliance

**When to use:**
- After completing a complex task
- To verify agent followed its prompt
- Before finalizing work
- When debugging unexpected behavior

---

### 3. `check_approval_gates`

**Purpose:** Verify approval gates were enforced before execution operations

**Usage:**
```bash
check_approval_gates
```

**Example Output:**
```
✅ Approval gate compliance: PASSED

All 3 execution operation(s) were properly approved.
```

**Or if violations found:**
```
⚠️ Approval gate compliance: FAILED

Executed 2 operation(s) without approval:
  - bash
  - write

Critical rule violated: approval_gate
```

**When to use:**
- After bash/write/edit/task operations
- To verify safety compliance
- When auditing agent behavior

---

### 4. `analyze_context_reads`

**Purpose:** Show all context files that were read during the session

**Usage:**
```bash
analyze_context_reads
```

**Example Output:**
```
## Context Files Read

**Total reads:** 3

### Files Read:
- **code.md** (2 reads)
  `.opencode/context/core/standards/code-quality.md`
- **delegation.md** (1 read)
  `.opencode/context/core/workflows/task-delegation-basics.md`

### Timeline:
1. [10:23:45] code.md
2. [10:24:12] delegation.md
3. [10:25:01] code.md
```

**When to use:**
- To verify agent loaded required context
- To understand which standards were applied
- To debug context loading issues

---

### 5. `check_context_compliance`

**Purpose:** Verify required context files were read BEFORE executing tasks

**Usage:**
```bash
check_context_compliance
```

**Example Output:**
```
## Context Loading Compliance

**Score:** 100%
- ✅ Compliant: 2
- ⚠️  Non-compliant: 0

### ✅ Compliant Actions:
- ✅ Loaded standards/code-quality.md before code writing
- ✅ Loaded workflows/task-delegation-basics.md before delegation

### Context Loading Rules:
According to OpenAgent prompt, the agent should:
1. Detect task type from user request
2. Read required context file FIRST
3. Then execute task following those standards

**Pattern:** "Fetch context BEFORE starting work, not during or after"
```

**Context loading rules:**
- Writing code → should read `standards/code-quality.md`
- Writing docs → should read `standards/documentation.md`
- Writing tests → should read `standards/test-coverage.md`
- Code review → should read `workflows/code-review.md`
- Delegating → should read `workflows/task-delegation-basics.md`

**When to use:**
- To verify lazy loading is working
- To ensure standards are being followed
- To debug why agent isn't following patterns

---

### 6. `analyze_delegation`

**Purpose:** Analyze delegation decisions against the 4+ file rule

**Usage:**
```bash
analyze_delegation
```

**Example Output:**
```
## Delegation Analysis

**Total delegations:** 3
- ✅ Appropriate: 2
- ⚠️  Questionable: 1

**File count per delegation:**
- Average: 4.3 files
- Range: 2 - 6 files
- Threshold: 4+ files
```

**When to use:**
- After complex multi-file tasks
- To verify delegation logic
- To tune delegation thresholds

---

### 7. `debug_validator`

**Purpose:** Inspect what the validator is tracking (for debugging)

**Usage:**
```bash
debug_validator
```

**Example Output:**
```
## Debug Information

```json
{
  "sessionID": "abc123...",
  "behaviorLogEntries": 7,
  "behaviorLogSampleFirst": [
    {
      "timestamp": 1700000000000,
      "agent": "openagent",
      "event": "tool_executed",
      "data": { "tool": "bash" }
    }
  ],
  "behaviorLogSampleLast": [...],
  "messagesCount": 5,
  "toolTracker": {
    "approvalRequested": true,
    "toolsExecuted": ["bash", "read"]
  },
  "allBehaviorLogs": 7
}
```

**Analysis:**
- Behavior log entries for this session: 7
- Total behavior log entries: 7
- Messages in session: 5
- Tool execution tracker: Active
```

**When to use:**
- When validation tools aren't working as expected
- To see raw tracking data
- To debug plugin issues
- To understand internal state

---

### 8. `export_validation_report`

**Purpose:** Export comprehensive validation report to a markdown file

**Usage:**
```bash
export_validation_report
# or specify path
export_validation_report --output_path ./reports/validation.md
```

**Example Output:**
```
✅ Validation report exported to: .tmp/validation-abc12345.md

## Validation Report
[... summary ...]
```

**Generated report includes:**
- Full validation summary
- Detailed checks with evidence
- Tool usage timeline
- Context loading analysis
- Delegation decisions
- Compliance scores

**When to use:**
- To save validation results for review
- To share compliance reports
- To track agent behavior over time
- For auditing purposes

---

## Understanding Results

### Compliance Scores

- **100%** - Perfect compliance ✅
- **90-99%** - Excellent (minor warnings) 🟢
- **80-89%** - Good (some warnings) 🟡
- **70-79%** - Fair (multiple warnings) 🟠
- **<70%** - Needs improvement (errors) 🔴

### Severity Levels

- **✅ Info** - Informational, no issues
- **⚠️  Warning** - Non-critical issue, should review
- **❌ Error** - Critical rule violation, must fix

### Common Validation Checks

| Check | What It Validates | Pass Criteria |
|-------|------------------|---------------|
| `approval_gate_enforcement` | Approval requested before execution | Approval language found before bash/write/edit/task |
| `stop_on_failure` | No auto-fix after errors | Agent stops and reports errors instead of fixing |
| `lazy_context_loading` | Context loaded only when needed | Context files read match task requirements |
| `delegation_appropriateness` | Delegation follows 4+ file rule | Delegated when 4+ files, or didn't delegate when <4 |
| `context_loading_compliance` | Context loaded BEFORE execution | Required context file read before task execution |
| `tool_usage` | Tool calls tracked | All tool invocations logged |

---

## Common Workflows

### Workflow 1: Verify Agent Behavior After Task

**Scenario:** You asked the agent to implement a feature and want to verify it followed its rules.

```bash
# 1. Complete your task
> "Create a user authentication system"
[Agent works...]

# 2. Check what agents were involved
> "analyze_agent_usage"

# 3. Validate compliance
> "validate_session"

# 4. Check specific concerns
> "check_approval_gates"
> "check_context_compliance"

# 5. Export report if needed
> "export_validation_report"
```

---

### Workflow 2: Debug Agent Switching

**Scenario:** You want to verify the plugin tracks agent switches correctly.

```bash
# 1. Start with one agent
opencode --agent openagent
> "Run pwd"
> "proceed"

# 2. Switch to another agent (manually or via delegation)
# [Switch happens]

# 3. Check tracking
> "analyze_agent_usage"

# Expected: Shows both agents with their respective tools
```

---

### Workflow 3: Audit Context Loading

**Scenario:** You want to ensure the agent is loading the right context files.

```bash
# 1. Ask agent to do a task that requires context
> "Write a new API endpoint following our standards"
[Agent works...]

# 2. Check what context was loaded
> "analyze_context_reads"

# 3. Verify compliance
> "check_context_compliance"

# Expected: Should show standards/code-quality.md was read BEFORE writing
```

---

### Workflow 4: Test Approval Gates

**Scenario:** Verify the agent always requests approval before execution.

```bash
# 1. Ask for an execution operation
> "Delete all .log files"

# 2. Agent should request approval
# Agent: "Approval needed before proceeding."

# 3. Approve
> "proceed"

# 4. Verify compliance
> "check_approval_gates"

# Expected: ✅ Approval gate compliance: PASSED
```

---

### Workflow 5: Monitor Delegation Decisions

**Scenario:** Check if agent delegates appropriately for complex tasks.

```bash
# 1. Give a complex multi-file task
> "Refactor the authentication module across 5 files"
[Agent works...]

# 2. Check delegation
> "analyze_delegation"

# Expected: Should show delegation was appropriate (5 files >= 4 threshold)
```

---

## Troubleshooting

### Issue: "No agent activity tracked yet in this session"

**Cause:** Plugin just loaded, no tracking data yet

**Solution:**
1. Perform some actions (bash, read, write, etc.)
2. Then run validation tools
3. Plugin tracks from session start, so early checks may show no data

---

### Issue: "No execution operations tracked in this session"

**Cause:** No bash/write/edit/task operations performed yet

**Solution:**
1. Run a command that requires execution (e.g., "run pwd")
2. Then check approval gates
3. Read-only operations (read, list) don't trigger approval gates

---

### Issue: False positive on approval gate violations

**Cause:** Agent used different approval phrasing than expected

**Solution:**
1. Check the approval keywords in `agent-validator.ts` (lines 12-22)
2. Add custom patterns if your agent uses different phrasing
3. Current keywords: "approval", "approve", "proceed", "confirm", "permission", etc.

**Example customization:**
```typescript
const approvalKeywords = [
  "approval",
  "approve",
  "proceed",
  "confirm",
  "permission",
  "before proceeding",
  "should i",
  "may i",
  "can i proceed",
  // Add your custom patterns:
  "ready to execute",
  "waiting for go-ahead",
]
```

---

### Issue: Context compliance shows warnings but files were read

**Cause:** Timing issue - context read after task started

**Solution:**
1. Verify agent reads context BEFORE execution (not during/after)
2. Check timeline in `analyze_context_reads`
3. Agent should follow: Detect task → Read context → Execute

---

### Issue: Agent switches not tracked

**Cause:** Agent name not properly captured

**Solution:**
1. Run `debug_validator` to see raw tracking data
2. Check `sessionAgentTracker` in debug output
3. Verify agent name is being passed in `chat.message` hook

---

### Issue: Validation report shows 0% score

**Cause:** No validation checks were performed

**Solution:**
1. Ensure you've performed actions that trigger checks
2. Run `debug_validator` to see what's tracked
3. Try a simple task first (e.g., "run pwd")

---

## Advanced Usage

### Customizing Validation Rules

Edit `.opencode/plugin/agent-validator.ts` to customize:

**1. Add custom approval keywords:**
```typescript
// Line 12-22
const approvalKeywords = [
  "approval",
  "approve",
  // Add yours:
  "your custom phrase",
]
```

**2. Adjust delegation threshold:**
```typescript
// Line 768
const shouldDelegate = writeEditCount >= 4  // Change 4 to your threshold
```

**3. Add custom context loading rules:**
```typescript
// Line 824-851
const contextRules = [
  {
    taskKeywords: ["your task type"],
    requiredFile: "your/context/file.md",
    taskType: "your task name"
  },
  // ... existing rules
]
```

**4. Change severity levels:**
```typescript
// Line 719-726
checks.push({
  rule: "your_rule",
  passed: condition,
  severity: "error",  // Change to "warning" or "info"
  details: "Your message",
})
```

---

### Integration with CI/CD

Export validation reports in automated workflows:

```bash
#!/bin/bash
# validate-agent-session.sh

# Run OpenCode task
opencode --agent openagent --input "Build the feature"

# Export validation report
opencode --agent openagent --input "export_validation_report --output_path ./reports/validation.md"

# Check exit code (if validation fails)
if grep -q "❌ Failed: [1-9]" ./reports/validation.md; then
  echo "Validation failed!"
  exit 1
fi

echo "Validation passed!"
```

---

### Creating Custom Validation Tools

Add new tools to the plugin:

```typescript
// In agent-validator.ts, add to tool object:
your_custom_tool: tool({
  description: "Your tool description",
  args: {
    your_arg: tool.schema.string().optional(),
  },
  async execute(args, context) {
    const { sessionID } = context
    
    // Your validation logic here
    const result = analyzeYourMetric(sessionID)
    
    return formatYourReport(result)
  },
}),
```

---

### Tracking Custom Events

Add custom event tracking:

```typescript
// In the event() hook:
async event(input) {
  const { event } = input
  
  // Track your custom event
  if (event.type === "your.custom.event") {
    behaviorLog.push({
      timestamp: Date.now(),
      sessionID: event.properties.sessionID,
      agent: event.properties.agent || "unknown",
      event: "your_custom_event",
      data: {
        // Your custom data
      },
    })
  }
}
```

---

## Real-World Examples

### Example 1: Testing Agent Tracking

**Session:**
```bash
$ opencode --agent openagent

> "Help me test this plugin, I am trying to verify if an agent keeps to its promises"

Agent: Let me run some tests to generate tracking data.

> "proceed"

[Agent runs: pwd, reads README.md]

> "analyze_agent_usage"
```

**Result:**
```
## Agent Usage Report

**Agents detected:** 1
**Total events:** 4

### openagent
**Active duration:** 133s
**Events:** 4
**Tools used:**
- bash: 2x
- read: 1x
- analyze_agent_usage: 1x
```

**Verification:** ✅ Plugin successfully tracked agent name, tools, and events

---

### Example 2: Detecting Agent Switch

**Session:**
```bash
$ opencode --agent build
[Do some work with build agent]

$ opencode --agent openagent
[Switch to openagent]

> "analyze_agent_usage"
```

**Result:**
```
## Agent Usage Report

**Agents detected:** 2
**Total events:** 7

### build
**Active duration:** 0s
**Events:** 2
**Tools used:**
- bash: 2x

### openagent
**Active duration:** 133s
**Events:** 5
**Tools used:**
- bash: 2x
- read: 1x
- analyze_agent_usage: 2x
```

**Verification:** ✅ Plugin tracked both agents and their respective activities

---

### Example 3: Approval Gate Validation

**Session:**
```bash
> "Run npm install"

Agent: ## Proposed Plan
1. Run npm install

**Approval needed before proceeding.**

> "proceed"

[Agent executes]

> "check_approval_gates"
```

**Result:**
```
✅ Approval gate compliance: PASSED

All 1 execution operation(s) were properly approved.
```

**Verification:** ✅ Agent requested approval before bash execution

---

## Best Practices

### 1. Validate After Complex Tasks
Always run validation after multi-step or complex tasks to ensure compliance.

### 2. Export Reports for Auditing
Use `export_validation_report` to keep records of agent behavior over time.

### 3. Check Context Loading
Verify agents are loading the right context files with `check_context_compliance`.

### 4. Monitor Agent Switches
Use `analyze_agent_usage` to track delegation and agent switching patterns.

### 5. Debug Early
If something seems off, run `debug_validator` immediately to see raw data.

### 6. Customize for Your Needs
Adjust validation rules, thresholds, and keywords to match your workflow.

### 7. Integrate with Workflows
Add validation checks to your development workflow or CI/CD pipeline.

---

## FAQ

### Q: Does the plugin slow down OpenCode?
**A:** No, tracking is lightweight and runs asynchronously. Minimal performance impact.

### Q: Can I disable specific validation checks?
**A:** Yes, edit `agent-validator.ts` and comment out checks you don't need.

### Q: Does validation data persist across sessions?
**A:** No, tracking is per-session. Each new OpenCode session starts fresh.

### Q: Can I track custom metrics?
**A:** Yes, add custom event tracking and validation tools (see Advanced Usage).

### Q: What if I get false positives?
**A:** Customize approval keywords and validation patterns in `agent-validator.ts`.

### Q: Can I use this with other agents?
**A:** Yes, the plugin tracks any agent running in OpenCode.

### Q: How do I reset tracking data?
**A:** Restart OpenCode - tracking resets on each session start.

### Q: Can I export data in JSON format?
**A:** Currently exports as Markdown. You can modify `generateDetailedReport()` for JSON.

---

## Next Steps

1. **Test the plugin** - Run through the Quick Start workflow
2. **Validate a real task** - Use it on an actual project task
3. **Customize rules** - Adjust validation patterns for your needs
4. **Integrate into workflow** - Add validation checks to your process
5. **Share feedback** - Report issues or suggest improvements

---

## Support

- **Issues:** Report bugs or request features in the repository
- **Customization:** Edit `agent-validator.ts` for your needs
- **Documentation:** This guide + inline code comments

---

**Happy validating! 🎯**
