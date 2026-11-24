---
name: project-orchestration
description: Orchestrate multi-agent workflows for feature development using planning agents, context handoff, and stage management
---

# Project Orchestration Skill

> **Purpose**: Orchestrate multi-agent workflows for feature development

## What I Do

Coordinate multi-agent planning and execution workflows:
- Pass minimal context between planning agents
- Track planning agent outputs
- Manage 8-stage feature delivery workflow
- Maintain planning session state

## Three Workflows

### 1. Context Handoff (Lightweight)
Pass minimal context between agents (RECOMMENDED for automation)
- **Commands**: create, get-context, add-output, show
- **Use when**: Orchestrating planning agents
- **See**: workflows/context-handoff.md

### 2. Session Context (Interactive)
Human-readable planning narrative (for debugging/review)
- **Commands**: session-create, session-load, session-summary
- **Use when**: Debugging or reviewing planning sessions
- **See**: workflows/context-handoff.md

### 3. Multi-Stage Delivery (8 Stages)
Full feature delivery workflow
- **Commands**: stage-init, stage-status, stage-complete, stage-rollback
- **Use when**: Running complete 8-stage feature workflow
- **See**: workflows/8-stage-delivery.md

## Quick Start

### Context Handoff Workflow
```bash
# Create context index
bash .opencode/skills/project-orchestration/router.sh create auth-system

# Get minimal context for specific agent
bash .opencode/skills/project-orchestration/router.sh get-context auth-system StoryMapper

# Track agent output
bash .opencode/skills/project-orchestration/router.sh add-output auth-system ArchitectureAnalyzer .tmp/architecture/auth-system/contexts.json

# Show full index
bash .opencode/skills/project-orchestration/router.sh show auth-system
```

### 8-Stage Workflow
```bash
# Initialize workflow
bash .opencode/skills/project-orchestration/router.sh stage-init auth-system

# Check status
bash .opencode/skills/project-orchestration/router.sh stage-status auth-system

# Mark stage complete
bash .opencode/skills/project-orchestration/router.sh stage-complete auth-system 1

# Rollback if needed
bash .opencode/skills/project-orchestration/router.sh stage-rollback auth-system 1
```

## Command Reference

### Context Management
| Command | Description |
|---------|-------------|
| `create <feature>` | Create context index for feature |
| `get-context <feature> <agentType>` | Get minimal context for specific agent |
| `add-output <feature> <agent> <path>` | Track agent output |
| `show <feature>` | Show full context index |

### Session Management
| Command | Description |
|---------|-------------|
| `session-create <feature> <request>` | Create session context |
| `session-load <sessionId>` | Load session context |
| `session-summary <sessionId>` | Get session summary |

### Stage Management
| Command | Description |
|---------|-------------|
| `stage-init <feature>` | Initialize 8-stage workflow |
| `stage-status <feature>` | Show stage progress |
| `stage-complete <feature> <stage>` | Mark stage complete |
| `stage-rollback <feature> <stage>` | Rollback stage |
| `stage-validate <feature> <stage>` | Validate stage |
| `stage-abort <feature>` | Abort workflow |

## Architecture

```
.opencode/skills/project-orchestration/
├── SKILL.md                          # This file
├── router.sh                         # CLI router
├── scripts/
│   ├── context-index.ts              # Lightweight context handoff
│   ├── session-context-manager.ts    # Session context management
│   └── stage-cli.ts                  # 8-stage workflow management
└── workflows/
    ├── context-handoff.md            # Detailed context handoff guide
    ├── 8-stage-delivery.md           # Detailed 8-stage workflow guide
    └── planning-agents.md            # Planning agents integration guide
```

## File Locations

### Scripts
- **Context Index**: `.opencode/skills/project-orchestration/scripts/context-index.ts`
- **Session Context**: `.opencode/skills/project-orchestration/scripts/session-context-manager.ts`
- **Stage CLI**: `.opencode/skills/project-orchestration/scripts/stage-cli.ts`

### Runtime Files
- **Context Index**: `.tmp/context-index/{feature}.json`
- **Sessions**: `.tmp/sessions/{session-id}/context.md`
- **Stage Tracking**: `.tmp/sessions/{session-id}/stage-tracking.json`

### Workflow Guides
- **Context Handoff**: `.opencode/skills/project-orchestration/workflows/context-handoff.md`
- **8-Stage Delivery**: `.opencode/skills/project-orchestration/workflows/8-stage-delivery.md`
- **Planning Agents**: `.opencode/skills/project-orchestration/workflows/planning-agents.md`

## Context Handoff Pattern

### Lightweight Context Index (RECOMMENDED)

**Use when**: Multi-agent pipelines, performance-critical workflows, automated orchestration

**How it works**:
- Orchestrator maintains lightweight index (`.tmp/context-index/{feature}.json`)
- Each agent gets ONLY the files they need
- 83% reduction in context per agent

**Example**:
```typescript
import { createContextIndex, getContextForAgent, addAgentOutput } from './scripts/context-index';

// Create index
createContextIndex('auth-system', { request: 'Build JWT auth' });

// Get minimal context for StoryMapper
const context = getContextForAgent('auth-system', 'StoryMapper');
// Returns: { contextFiles: [...], agentOutputs: { ArchitectureAnalyzer: "..." } }

// After agent completes, update index
addAgentOutput('auth-system', 'StoryMapper', '.tmp/story-maps/auth-system/map.json', 
  { verticalSlice: 'user-login' });
```

**Benefits**:
- ✅ Minimal context per agent (only what they need)
- ✅ Fast (small JSON files)
- ✅ Scalable (index stays small)
- ✅ Clear dependencies (explicit file paths)

### Session Context (Interactive)

**Use when**: Interactive sessions, human review, debugging, narrative tracking

**How it works**:
- Creates markdown file (`.tmp/sessions/{session-id}/context.md`)
- Human-readable narrative of entire workflow
- All agents read/update same file

**Example**:
```typescript
import { createSession, updateSession, markStageComplete } from './scripts/session-context-manager';

// Create session
const sessionId = await createSession('auth-system', {
  request: 'Build JWT authentication',
  contextFiles: ['.opencode/context/core/standards/code-quality.md'],
  exitCriteria: ['All endpoints implemented']
});

// Update after agent completes
await updateSession(sessionId, {
  architectureContext: { boundedContext: 'authentication' }
});

await markStageComplete(sessionId, 'Stage 1: Architecture Decomposition', [
  '.tmp/architecture/auth-system/contexts.json'
]);
```

**Benefits**:
- ✅ Human-readable (markdown format)
- ✅ Complete narrative (see entire workflow)
- ✅ Good for debugging (trace decisions)
- ✅ Audit trail (who did what when)

### Comparison

| Feature | Context Index | Session Context |
|---------|---------------|-----------------|
| **Format** | JSON | Markdown |
| **Size** | Small (~200 lines) | Large (2000+ lines) |
| **Audience** | Agents only | Humans + Agents |
| **Context per agent** | Minimal (2-5 files) | Everything (all files) |
| **Performance** | Fast | Slower |
| **Use case** | Automated pipelines | Interactive sessions |
| **Human readable** | No | Yes |
| **Debugging** | Harder | Easier |

### Recommendation

**For most multi-agent workflows**: Use **Context Index** (lightweight, fast, minimal context per agent)

**For interactive development**: Use **Session Context** (human-readable, complete narrative)

**You can use both**: Context Index for automation, Session Context for human review

## 8-Stage Delivery Workflow

The Multi-Stage Orchestration Workflow provides a systematic approach to complex feature development:

### Stages

1. **Architecture Decomposition** - Define system boundaries and components
2. **Story Mapping** - Map user journeys and create stories
3. **Prioritization** - Sequence work by value and dependencies
4. **Enhanced Task Breakdown** - Create atomic, executable tasks
5. **Contract Definition** - Define interfaces before implementation
6. **Parallel Execution** - Execute independent work simultaneously
7. **Integration & Validation** - Integrate and validate components
8. **Release & Learning** - Deploy and capture insights

### Stage Management

```bash
# Initialize workflow
bash .opencode/skills/project-orchestration/router.sh stage-init auth-system

# Check status
bash .opencode/skills/project-orchestration/router.sh stage-status auth-system

# Validate stage readiness
bash .opencode/skills/project-orchestration/router.sh stage-validate auth-system 1

# Mark stage complete
bash .opencode/skills/project-orchestration/router.sh stage-complete auth-system 1

# Rollback if needed
bash .opencode/skills/project-orchestration/router.sh stage-rollback auth-system 1

# Abort workflow
bash .opencode/skills/project-orchestration/router.sh stage-abort auth-system
```

### Stage Tracking

Stage tracking files are stored in `.tmp/sessions/{timestamp}-{feature}/stage-tracking.json`

Each stage tracks:
- Status (pending, in_progress, completed, failed)
- Start and completion timestamps
- Outputs produced
- Validation results
- Error messages (if failed)

## Planning Agents Integration

The orchestration skill integrates with planning agents to enrich task metadata:

### ArchitectureAnalyzer
Provides `bounded_context` and `module` fields based on domain analysis.

### StoryMapper
Provides `vertical_slice` field for feature slice architecture.

### PrioritizationEngine
Provides `rice_score`, `wsjf_score`, and `release_slice` fields for prioritization.

### ContractManager
Provides `contracts` array for API/interface dependencies.

### ADRManager
Provides `related_adrs` array for architectural decision references.

See `workflows/planning-agents.md` for detailed integration guide.

## Best Practices

### Context Handoff
- Use Context Index for automated pipelines
- Use Session Context for human review
- Update index immediately after agent completes
- Keep metadata small and useful

### Stage Management
- Validate stage prerequisites before execution
- Mark stages complete only when all criteria met
- Document rollback reasons
- Track stage outputs for traceability

### Planning Integration
- Call ArchitectureAnalyzer for complex domain logic
- Use StoryMapper for user journey mapping
- Apply PrioritizationEngine for MVP identification
- Define contracts with ContractManager for parallel dev
- Document decisions with ADRManager

## See Also
- Task Management: `.opencode/skills/task-management/SKILL.md`
- Planning Agents Guide: `.opencode/docs/agents/planning-agents-guide.md`
- Multi-Stage Orchestration: `.opencode/context/core/workflows/multi-stage-orchestration.md`
