---
name: oac-approach
description: "Use before any implementation — understands the request, discovers project context, and proposes a concise plan for user approval before writing any code."
oac:
  id: oac-approach
  name: Oac Approach
  targets: [claude-code]
---

# Plan Before You Code

## Overview

Understand the request, discover relevant context, propose a concise plan, get approval. Keep it fast — the goal is alignment, not a design workshop.

<HARD-GATE>
Do NOT write any code or make any file changes until the user has approved your proposed approach.
</HARD-GATE>

## The Process

### Step 1: Understand the Request

Read the user's message. You already have the "what" — don't ask a series of questions up front. Only ask clarifying questions if:
- The request is genuinely ambiguous (two different valid interpretations)
- You discover during context check that key details are missing (e.g. which framework, which database)

In those cases, ask the specific questions you need — not a blanket "tell me more". Be explicit about what you need and why.

### Step 2: Discover Context

Invoke `oac:context-discovery` with the task topic to find relevant project standards and patterns.

**If context-discovery reports no context installed:** proceed anyway — note it as "none" in the proposal and include the context hint (see Step 4). Do not pause or ask the user before proposing.

**If context found:** note the key files returned — reference them in your proposal.

### Step 3: Ask Clarifying Questions (if needed)

After reviewing the context and the request, if there are still gaps that would significantly change the approach, ask them now — explicitly and concisely:

```
Before I propose an approach, I need a couple of details:

1. {specific question} — because {why it matters to the approach}
2. {specific question} — because {why it matters to the approach}
```

Keep it to the minimum needed. If you can make a reasonable assumption, state it in the proposal instead of asking.

### Step 4: Propose

Present a lightweight plan. Short — not a full spec:

```
## Proposed Approach

**What**: {1-2 sentence description of what we're building/changing}
**How**: {brief description of approach — key decisions only}
**Assumptions**: {any assumptions made where questions weren't asked}
**Files**: {list of files to create or modify}
**Context loaded**: {key standards files found, or "none — using general best practices"}
**External docs needed**: {any library docs to fetch first, or "none"}

Approve or let me know what to adjust.
```

**If context was missing or minimal**, append this hint at the end of the proposal — do not replace or interrupt the proposal, just add it after:

```
💡 Tip: For better results tailored to your project's standards, run /install-context
   to set up context files. This helps me follow your coding conventions automatically.
```

### Step 5: Get Approval

Wait for the user to approve or adjust. If they adjust, update the proposal and ask again. Do not start implementation until explicitly approved.

### Step 6: Hand Off to Implementation

Once approved:
- **Simple** (1–3 files, straightforward): implement directly
- **Complex** (4+ files, multiple components): invoke `oac:task-breakdown` to create subtasks first

## Key Principles

- **Fast** — Understand from the message, don't interrogate the user up front
- **Context first** — Always attempt discovery before proposing
- **No context = hint, not block** — Show the install tip at the bottom of the proposal, never before it
- **Explicit questions** — If you must ask, say what you need and why — not "tell me more"
- **Assumptions over questions** — State assumptions in proposal rather than asking for every detail
- **Concise proposal** — A paragraph, not a doc; enough for yes/no/adjust
- **YAGNI** — Propose the minimum that satisfies the requirement

## Related

- `oac:context-discovery` — invoked in Step 2
- `oac:context-setup` — when no context found
- `oac:task-breakdown` — for complex features after approval
