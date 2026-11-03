---
name: using-oac
description: "Use when starting any conversation — establishes how to find and use OAC skills, requiring Skill tool invocation BEFORE ANY response including clarifying questions, this is your secret weapon to best perform your tasks"
---

<EXTREMELY-IMPORTANT>
If you think there is even a 1% chance an OAC skill might apply to what you are doing, you ABSOLUTELY MUST invoke the skill.

IF A SKILL APPLIES TO YOUR TASK, YOU DO NOT HAVE A CHOICE. YOU MUST USE IT.

This is not negotiable. This is not optional. You cannot rationalize your way out of this.
</EXTREMELY-IMPORTANT>

## How to Access Skills

**In Claude Code:** Use the `Skill` tool. When you invoke a skill, its content is loaded and presented to you—follow it directly. Never use the Read tool on skill files.

# Using OAC Skills

## The Rule

**Invoke relevant or requested skills BEFORE any response or action.** Even a 1% chance a skill might apply means that you should invoke the skill to check. If an invoked skill turns out to be wrong for the situation, you don't need to use it.

```dot
digraph skill_flow {
    "User message received" [shape=doublecircle];
    "About to build/create something?" [shape=doublecircle];
    "Already brainstormed?" [shape=diamond];
    "Invoke oac:approach skill" [shape=box];
    "Might any OAC skill apply?" [shape=diamond];
    "Invoke Skill tool" [shape=box];
    "Announce: 'OAC skill loaded: [friendly-skill-name] — [purpose]'" [shape=box];
    "Has checklist?" [shape=diamond];
    "Create TodoWrite todo per item" [shape=box];
    "Follow skill exactly" [shape=box];
    "Respond (including clarifications)" [shape=doublecircle];

    "About to build/create something?" -> "Already brainstormed?";
    "Already brainstormed?" -> "Invoke oac:approach skill" [label="no"];
    "Already brainstormed?" -> "Might any OAC skill apply?" [label="yes"];
    "Invoke oac:approach skill" -> "Might any OAC skill apply?";

    "User message received" -> "Might any OAC skill apply?";
    "Might any OAC skill apply?" -> "Invoke Skill tool" [label="yes, even 1%"];
    "Might any OAC skill apply?" -> "Respond (including clarifications)" [label="definitely not"];
    "Invoke Skill tool" -> "Announce: 'OAC skill loaded: [friendly-skill-name] — [purpose]'";
    "Announce: 'OAC skill loaded: [friendly-skill-name] — [purpose]'" -> "Has checklist?";
    "Has checklist?" -> "Create TodoWrite todo per item" [label="yes"];
    "Has checklist?" -> "Follow skill exactly" [label="no"];
    "Create TodoWrite todo per item" -> "Follow skill exactly";
}
```

## Available OAC Skills

| Skill | When to invoke |
|-------|---------------|
| `oac:using-oac` | This skill — loaded at session start |
| `oac:approach` | BEFORE any creative work, building features, adding functionality |
| `oac:context-discovery` | BEFORE implementing anything — find standards and patterns |
| `oac:task-breakdown` | When breaking complex features into subtasks |
| `oac:code-execution` | When implementing code subtasks |
| `oac:test-generation` | When creating tests |
| `oac:code-review` | When reviewing code changes |
| `oac:external-research` | When working with external libraries/packages |
| `oac:parallel-execution` | When running multiple agents in parallel |
| `oac:debugger` | BEFORE proposing any fix for a bug or test failure |
| `oac:verification-before-completion` | BEFORE claiming any work is complete or tests pass |

## Skill Priority

When multiple skills could apply, use this order:

1. **Process skills first** (approach, debugger) — these determine HOW to approach the task
2. **Implementation skills second** (context-discovery, task-breakdown, code-execution) — these guide execution

"Let's build X" → approach first, then context-discovery, then implementation skills.
"Fix this bug" → debugger first, then verification-before-completion.

## Red Flags

These thoughts mean STOP — you're rationalizing:

| Thought | Reality |
|---------|---------|
| "This is just a simple question" | Questions are tasks. Check for skills. |
| "I need more context first" | Skill check comes BEFORE clarifying questions. |
| "Let me explore the codebase first" | Skills tell you HOW to explore. Check first. |
| "I can check git/files quickly" | Files lack conversation context. Check for skills. |
| "Let me gather information first" | Skills tell you HOW to gather information. |
| "This doesn't need a formal skill" | If a skill exists, use it. |
| "I remember this skill" | Skills evolve. Read current version. |
| "This doesn't count as a task" | Action = task. Check for skills. |
| "The skill is overkill" | Simple things become complex. Use it. |
| "I'll just do this one thing first" | Check BEFORE doing anything. |
| "This feels productive" | Undisciplined action wastes time. Skills prevent this. |
| "I know what that means" | Knowing the concept ≠ using the skill. Invoke it. |

## Skill Types

**Rigid** (debugger, verification-before-completion): Follow exactly. Don't adapt away discipline.

**Flexible** (approach, context-discovery): Adapt principles to context.

The skill itself tells you which.

## Skill Friendly Names

When announcing a skill, use the friendly name below (not the internal skill ID):

| Skill ID | Friendly Name |
|----------|--------------|
| `oac-approach` | OAC Approach |
| `context-discovery` | OAC Context Discovery |
| `task-breakdown` | OAC Task Breakdown |
| `code-execution` | OAC Code Execution |
| `test-generation` | OAC Test Generation |
| `code-review` | OAC Code Review |
| `external-research` | OAC External Research |
| `parallel-execution` | OAC Parallel Execution |
| `debugger` | OAC Debugger |
| `verification-before-completion` | OAC Verification |
| `context-setup` | OAC Context Setup |

Example announcement: `OAC skill loaded: OAC Approach — planning before implementation`

## User Instructions

Instructions say WHAT, not HOW. "Add X" or "Fix Y" doesn't mean skip workflows.
