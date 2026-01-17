# Abilities System - Implementation Plan

> **Status:** Planning Complete - Ready for Implementation  
> **Issue:** [#33](https://github.com/darrenhinde/OpenAgentsControl/issues/33)  
> **Date:** December 31, 2025

---

## Vision

**Enforced, validated workflows that work with any agent and guarantee execution.**

Abilities solve the fundamental problem with Skills: **LLMs ignore them**. With Abilities:
- Steps **must** run (enforced via hooks)
- Scripts run **deterministically** (no AI variance)
- Validation **guarantees** each step completed
- Multi-agent coordination **just works**

---

## Problem Statement

### Current State (Skills)

| Issue | Impact |
|-------|--------|
| LLM ignores skill instructions | Critical steps skipped |
| No enforcement mechanism | Can't guarantee execution |
| No validation | Don't know if steps completed |
| Pure AI (unpredictable) | Results vary each run |
| Single agent only | No coordination |

### Desired State (Abilities)

| Feature | Benefit |
|---------|---------|
| Hook enforcement | AI **cannot** skip steps |
| Script steps | Deterministic execution |
| Validation rules | Guaranteed completion |
| Multi-agent support | Coordinate any OpenAgents Control agent |
| Approval gates | Human-in-the-loop where needed |

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                     USER / AGENT                            │
│           "Deploy v1.2.3 to production"                     │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                  TRIGGER DETECTION                          │
│         Keywords / Patterns / Explicit Command              │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                  INPUT VALIDATION                           │
│              Zod Schema / Type Checking                     │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                   PLAN APPROVAL                             │
│            Show Steps → Get User Approval                   │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                 ENFORCED EXECUTION                          │
│                                                             │
│   ┌─────────┐   ┌─────────┐   ┌─────────┐   ┌─────────┐   │
│   │ Script  │ → │  Agent  │ → │Approval │ → │ Script  │   │
│   │  Step   │   │  Step   │   │  Step   │   │  Step   │   │
│   └─────────┘   └─────────┘   └─────────┘   └─────────┘   │
│                                                             │
│   Hooks block tools outside current step                    │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    COMPLETION                               │
│           Report Results / Run After Hooks                  │
└─────────────────────────────────────────────────────────────┘
```

---

## File Structure

### Directory Layout

```
.opencode/
├── abilities/                    # Root abilities folder
│   ├── deploy/                   # Grouped by domain
│   │   ├── ability.yaml          # Main ability definition
│   │   ├── scripts/              # Associated scripts
│   │   │   ├── test.sh
│   │   │   ├── build.sh
│   │   │   └── deploy.sh
│   │   └── hooks/                # Optional hooks
│   │       ├── before/
│   │       │   └── validate.md
│   │       └── after/
│   │           └── notify.sh
│   │
│   ├── development/              # Another domain
│   │   ├── build-feature/
│   │   │   └── ability.yaml
│   │   ├── refactor/
│   │   │   └── ability.yaml
│   │   └── test-suite/
│   │       └── ability.yaml
│   │
│   └── simple-ability.yaml       # Can also be flat files
│
└── agents/
    └── my-agent.md               # Agent with abilities attached
```

### Discovery Rules

```
Priority order:
1. .opencode/abilities/**/*.yaml     (project - nested)
2. .opencode/abilities/*.yaml        (project - flat)
3. ~/.config/opencode/abilities/     (global)
```

### Naming Convention

```yaml
# File: .opencode/abilities/deploy/production/ability.yaml
# Auto-generated name: deploy/production

# Or explicit override:
name: deploy-to-prod  # Custom name
```

---

## YAML Format Specification

### Complete Example

```yaml
# ability.yaml
name: safe-deploy                    # Unique identifier
description: Deploy with safety checks
version: 1.0.0                       # Optional versioning

# ─────────────────────────────────────────────
# TRIGGERS - When this ability activates
# ─────────────────────────────────────────────
triggers:
  keywords:                          # Keyword matching
    - "deploy"
    - "ship it"
    - "release to production"
  patterns:                          # Regex patterns (optional)
    - "deploy.*to.*prod"

# ─────────────────────────────────────────────
# INPUTS - Validated before execution
# ─────────────────────────────────────────────
inputs:
  version:
    type: string
    required: true
    pattern: '^v\d+\.\d+\.\d+$'      # Semver validation
    description: "Version to deploy (e.g., v1.2.3)"
  
  environment:
    type: string
    required: true
    enum: [staging, production]
    default: staging

# ─────────────────────────────────────────────
# STEPS - Executed in order (enforced)
# ─────────────────────────────────────────────
steps:
  - id: test
    type: script
    description: Run test suite
    run: npm test
    validation:
      exit_code: 0
    on_failure: stop
    
  - id: build
    type: script
    description: Build for target environment
    run: npm run build -- --env={{inputs.environment}}
    needs: [test]
    timeout: 5m
    
  - id: review
    type: agent
    description: Security review
    agent: reviewer
    prompt: |
      Review the build output for security issues.
      Environment: {{inputs.environment}}
    needs: [build]
    
  - id: approve
    type: approval
    description: Production approval
    when: inputs.environment == "production"
    prompt: |
      Ready to deploy {{inputs.version}} to {{inputs.environment}}.
      Proceed?
    needs: [review]
    
  - id: deploy
    type: script
    description: Deploy to environment
    run: ./scripts/deploy.sh {{inputs.environment}} {{inputs.version}}
    needs: [approve]
    validation:
      exit_code: 0

# ─────────────────────────────────────────────
# SETTINGS - Ability-level configuration
# ─────────────────────────────────────────────
settings:
  timeout: 30m                       # Total timeout
  parallel: false                    # Sequential by default
  enforcement: strict                # strict | normal | loose
  on_failure: stop                   # Default failure behavior
```

### Step Types

#### Script Step
```yaml
- id: test
  type: script
  run: npm test                      # Command to run
  cwd: ./packages/api                # Working directory (optional)
  env:                               # Environment variables
    NODE_ENV: test
  validation:
    exit_code: 0                     # Required exit code
    stdout_contains: "passed"        # Optional
    file_exists: ./coverage/         # Optional
  timeout: 10m
  on_failure: stop | continue | retry
  max_retries: 2
```

#### Agent Step
```yaml
- id: review
  type: agent
  agent: reviewer                    # Agent name (from OpenAgents Control)
  prompt: "Review this code..."      # Task for agent
  context:                           # Additional context (optional)
    - ./src/
    - {{steps.build.output}}
  timeout: 5m
  on_failure: stop
```

#### Skill Step
```yaml
- id: docs
  type: skill
  skill: generate-docs               # Skill name
  inputs:                            # Skill inputs (optional)
    format: markdown
```

#### Approval Step
```yaml
- id: approve
  type: approval
  prompt: "Deploy to production?"
  options:                           # Custom options (optional)
    - label: Approve
      value: approved
    - label: Reject
      value: rejected
  timeout: 1h                        # Auto-reject after timeout
  when: inputs.environment == "production"
```

#### Workflow Step (Nested)
```yaml
- id: setup
  type: workflow
  workflow: setup-environment        # Call another ability
  inputs:
    env: {{inputs.environment}}
```

### Step Properties Reference

| Property | Required | Default | Description |
|----------|----------|---------|-------------|
| `id` | Yes | - | Unique step identifier |
| `type` | Yes | - | script, agent, skill, approval, workflow |
| `description` | No | - | Human-readable description |
| `needs` | No | `[]` | Dependencies (steps that must complete first) |
| `when` | No | `true` | Conditional execution |
| `timeout` | No | `5m` | Max duration |
| `on_failure` | No | `stop` | stop, continue, retry, ask |
| `max_retries` | No | `1` | Retry attempts (if retry) |

---

## Attaching Abilities to Agents

### Option A: Agent Frontmatter

```markdown
---
name: deploy-agent
description: Handles deployments
model: anthropic/claude-sonnet-4

abilities:
  - deploy/production
  - deploy/staging
  - rollback
---

You are a deployment specialist...
```

### Option B: Global Config

```json
{
  "agents": {
    "deploy-agent": {
      "abilities": ["deploy/production", "deploy/staging"]
    }
  }
}
```

### Option C: Ability Specifies Agents

```yaml
# In ability.yaml
compatible_agents:
  - deploy-agent
  - default
```

---

## Enforcement Mechanism

### Hook-Based Enforcement

```typescript
// tool.execute.before - Block tools outside current step
async "tool.execute.before"(ctx, tool) {
  const ability = ctx.state.activeAbility
  if (!ability) return
  
  const currentStep = ability.currentStep
  
  // Script steps block ALL tools
  if (currentStep.type === 'script') {
    throw new Error(`Step '${currentStep.id}' is running. Wait for completion.`)
  }
  
  // Agent steps allow only that agent's tools
  if (currentStep.type === 'agent') {
    const allowed = getAgentTools(currentStep.agent)
    if (!allowed.includes(tool.name)) {
      throw new Error(`Tool '${tool.name}' not allowed in step '${currentStep.id}'`)
    }
  }
}

// chat.message - Inject ability context
async "chat.message"(ctx, message) {
  const ability = ctx.state.activeAbility
  if (!ability) return
  
  message.parts.unshift({
    type: "text",
    synthetic: true,
    text: `## Active Ability: ${ability.name}
Current Step: ${ability.currentStep.id}
Progress: ${ability.completedSteps.length}/${ability.steps.length}

You MUST complete this step before proceeding.`
  })
}

// session.idle - Prevent exit without completion
async "session.idle"(ctx) {
  const ability = ctx.state.activeAbility
  if (ability?.status === 'running') {
    return {
      inject: `Ability '${ability.name}' is still running. Complete it first.`
    }
  }
}
```

### Enforcement Levels

| Level | Behavior |
|-------|----------|
| `strict` | Block ALL tools outside current step, cannot exit |
| `normal` | Block destructive tools, can exit with warning |
| `loose` | Advisory only, can skip with confirmation |

---

## Context Passing

### Automatic (Default)

Steps with `needs` automatically receive prior step outputs:

```yaml
steps:
  - id: research
    agent: librarian
    prompt: "Research: {{input}}"

  - id: plan
    agent: oracle
    needs: [research]  # Gets research output automatically
    prompt: "Create plan based on the research"
```

When `plan` runs, executor injects:

```markdown
## Context from prior steps

### Step: research (librarian)
[Full output from research step]

---

## Your task
Create plan based on the research
```

### Auto-Truncation

Large outputs (>10k tokens) are automatically summarized before passing.

### Manual Summary

```yaml
- id: research
  agent: librarian
  prompt: "Research: {{input}}"
  summarize: true  # Condense output
  # OR
  summarize: "Extract only the key patterns"  # Custom prompt
```

---

## Validation System

### Schema Validation (Zod)

```typescript
const AbilitySchema = z.object({
  name: z.string().regex(/^[a-z0-9-/]+$/),
  description: z.string(),
  version: z.string().optional(),
  triggers: TriggersSchema.optional(),
  inputs: z.record(InputSchema).optional(),
  steps: z.array(StepSchema).min(1),
  settings: SettingsSchema.optional(),
})
```

### Dependency Validation

- Check all `needs` references exist
- Detect circular dependencies
- Verify agents exist

### CLI Commands

```bash
/ability validate deploy/production    # Validate single
/ability validate --all                # Validate all
```

---

## SDK Integration

### Using from Subagents

```typescript
import { OpenCodeSDK } from '@opencode/sdk'

const sdk = new OpenCodeSDK()

// List abilities
const abilities = await sdk.abilities.list()

// Execute
const result = await sdk.abilities.execute({
  name: 'deploy/production',
  inputs: { version: 'v1.2.3', environment: 'staging' }
})

// Check status
const status = await sdk.abilities.status(result.executionId)

// Wait for completion
const final = await sdk.abilities.waitFor(result.executionId)
```

---

## Implementation Phases

### Phase 1: Foundation (Week 1) ✅ COMPLETED

- [x] File structure & discovery
  - [x] Load from .opencode/abilities/ (nested + flat)
  - [x] Load from global config
  - [x] Name resolution from path

- [x] YAML parser & validator
  - [x] Zod schema for ability format
  - [x] Dependency validation
  - [x] Agent existence check

- [x] Basic executor
  - [x] Script step execution
  - [x] Sequential execution only
  - [x] Basic error handling

- [x] CLI commands (as plugin tools)
  - [x] ability.list
  - [x] ability.validate
  - [x] ability.run

**Deliverable:** Load, validate, and run script-only abilities. ✅

### Phase 2: Agent Integration (Week 2) ✅ COMPLETED

- [x] Agent steps
  - [x] Execute agent with prompt
  - [x] Pass context from prior steps
  - [x] Handle agent responses

- [x] Skill steps
  - [x] Load and execute skills
  - [x] Pass skill inputs

- [x] Approval steps
  - [x] Display approval prompt
  - [x] Handle approve/reject
  - [x] Conditional approvals (when:)

- [x] Trigger detection
  - [x] Keyword matching in messages
  - [x] Pattern matching
  - [x] Auto-activation via chat.message hook

**Deliverable:** Run mixed script/agent/skill abilities with approvals. ✅

**Test Results:** 52 tests passing across 4 test files

### Phase 3: Enforcement (Week 3) ✅ COMPLETED

- [x] Hook enforcement
  - [x] tool.execute.before blocking (with ALLOWED_TOOLS_BY_STEP_TYPE)
  - [x] chat.message injection (buildAbilityContextInjection)
  - [x] session.idle continuation (handleSessionIdle)

- [x] Agent attachment
  - [x] Agent-ability bindings (registerAgentAbilities)
  - [x] agent.changed event handling
  - [x] Per-ability agent restrictions (compatible_agents, exclusive_agent)
  - [x] ability.agent tool to list agent's abilities

- [x] Execution state
  - [x] Track active ability (ExecutionManager.getActive())
  - [x] Track current step (execution.currentStep)
  - [x] Track completed steps (execution.completedSteps)

**Test Results:** 66 tests passing across 5 test files

**Deliverable:** Full enforcement - agents can't skip steps. ✅

### Phase 4: Polish (Week 4) ✅ COMPLETED

- [x] Context passing
  - [x] Auto-pass prior step outputs (buildPriorContext)
  - [x] Auto-truncate large outputs (MAX_OUTPUT_CHARS = 40k, MAX_CONTEXT_CHARS = 80k)
  - [x] Variable interpolation ({{inputs.X}}, {{steps.Y.output}})
  - [x] Summarization support (summarize: true flag on steps)

- [x] Nested workflows
  - [x] Workflow step type implementation
  - [x] Input passing to child (interpolated from parent inputs)
  - [x] Abilities context in executor

- [x] SDK integration
  - [x] AbilitiesSDK class with clean API
  - [x] abilities.list() with full metadata
  - [x] abilities.execute() with context support
  - [x] abilities.status() and abilities.cancel()
  - [x] abilities.waitFor() for async execution
  - [x] createAbilitiesSDK() factory function

- [x] Documentation
  - [x] Updated README with OpenCode integration
  - [x] SDK usage examples
  - [x] Package exports for plugin, opencode, and sdk

**Test Results:** 87 tests passing across 7 test files

**Deliverable:** Production-ready abilities system. ✅

---

## Example Abilities

### Simple: Run Tests

```yaml
name: test
description: Run test suite with coverage

steps:
  - id: test
    type: script
    run: npm test -- --coverage
    validation:
      exit_code: 0
```

### Medium: Code Review

```yaml
name: review
description: AI-powered code review

triggers:
  keywords: ["review", "check my code"]

steps:
  - id: get-diff
    type: script
    run: git diff --staged > /tmp/diff.txt
    
  - id: review
    type: agent
    agent: reviewer
    prompt: |
      Review this code diff for issues.
      {{steps.get-diff.output}}
```

### Complex: Full Deploy

```yaml
name: deploy/production
description: Full production deployment pipeline

triggers:
  keywords: ["deploy to prod", "release", "ship it"]

inputs:
  version:
    type: string
    required: true
    pattern: '^v\d+\.\d+\.\d+$'

steps:
  - id: test
    type: script
    run: npm test
    validation:
      exit_code: 0
      
  - id: build
    type: script
    run: npm run build
    needs: [test]
    
  - id: security-scan
    type: agent
    agent: reviewer
    prompt: "Scan for security vulnerabilities"
    needs: [build]
    
  - id: deploy-staging
    type: script
    run: ./deploy.sh staging {{inputs.version}}
    needs: [build, security-scan]
    
  - id: smoke-test
    type: agent
    agent: tester
    prompt: "Run smoke tests on staging"
    needs: [deploy-staging]
    
  - id: approve
    type: approval
    prompt: "Deploy {{inputs.version}} to production?"
    needs: [smoke-test]
    
  - id: deploy-prod
    type: script
    run: ./deploy.sh production {{inputs.version}}
    needs: [approve]
```

---

## Success Criteria

| Criteria | Measurement |
|----------|-------------|
| Abilities load correctly | All YAML files parse without error |
| Validation catches errors | Invalid YAMLs rejected with clear messages |
| Scripts execute | Exit codes captured, validation works |
| Agents integrate | Can call any OpenAgents Control agent |
| Enforcement works | Cannot skip steps when strict |
| Approvals work | Human gate blocks until approved |
| Context passes | Prior step outputs available to next |

---

## References

- [Issue #33](https://github.com/darrenhinde/OpenAgentsControl/issues/33) - Original proposal
- [oh-my-opencode](https://github.com/code-yeongyu/oh-my-opencode) - Plugin patterns
- [OpenCode Skills](https://opencode.ai/docs/skills/) - Current skill system
- [Scott Spence - Making Skills Reliable](https://scottspence.com/posts/how-to-make-claude-code-skills-activate-reliably)

---

## Next Steps

1. **Create plugin scaffold** - packages/plugin-abilities/
2. **Implement Phase 1** - Loader, parser, validator, script executor
3. **Test with simple ability** - Validate the foundation works
4. **Iterate** - Add agent steps, enforcement, etc.
