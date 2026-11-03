<!-- Context: workflows/lightweight-context-handoff | Priority: critical | Version: 1.0 | Updated: 2026-02-15 -->
# Lightweight Context Handoff Pattern

## Problem

**Context Fragmentation in Multi-Agent Orchestration**

- Orchestrator needs to track full context across all agents
- Subagents should only get what they need for their specific job
- Current `session-context-manager.ts` passes too much context (entire session state)
- Agents waste time reading irrelevant files
- Context bloat slows down execution

## Solution

**Lightweight Context Index**

- Orchestrator maintains a lightweight "context index" (just file paths and metadata)
- Each subagent gets ONLY the specific files they need
- Orchestrator reads agent outputs and updates the index
- Index is a pointer system, not a content dump

## Key Principle

✅ **DO THIS:**
```
Orchestrator → Agent: "Here's the ONE file you need: .tmp/architecture/auth-system/contexts.json"
```

❌ **NOT THIS:**
```
Orchestrator → Agent: "Here's the entire session context with everything from all previous agents (5000 lines)"
```

---

## Architecture

### Context Index Structure

```typescript
{
  feature: "auth-system",
  created: "2026-02-15T10:00:00Z",
  updated: "2026-02-15T10:30:00Z",
  agents: {
    "ArchitectureAnalyzer": {
      outputs: [".tmp/architecture/auth-system/contexts.json"],
      metadata: { 
        boundedContext: "authentication", 
        module: "auth-service" 
      },
      timestamp: "2026-02-15T10:05:00Z"
    },
    "StoryMapper": {
      outputs: [".tmp/story-maps/auth-system/map.json"],
      metadata: { 
        verticalSlice: "user-login" 
      },
      timestamp: "2026-02-15T10:15:00Z"
    }
  },
  contextFiles: [
    ".opencode/context/core/standards/code-quality.md",
    "(example: .opencode/context/security/auth-patterns.md)"
  ],
  referenceFiles: [
    "src/auth/old-auth.ts"
  ]
}
```

### What Gets Stored

**Lightweight (paths and metadata only):**
- ✅ File paths to agent outputs
- ✅ Small metadata objects (boundedContext, module, etc.)
- ✅ Timestamps
- ✅ Context file paths
- ✅ Reference file paths

**NOT stored (content stays in files):**
- ❌ Full file contents
- ❌ Large JSON blobs
- ❌ Entire session history
- ❌ Redundant context

---

## API Reference

### Core Functions

#### `createContextIndex(feature, options)`

Initialize a new context index for a feature.

```typescript
import { createContextIndex } from './context-index';

const result = createContextIndex('auth-system', {
  contextFiles: [
    '.opencode/context/core/standards/code-quality.md',
    '(example: .opencode/context/security/auth-patterns.md)'
  ],
  referenceFiles: [
    'src/auth/old-auth.ts'
  ]
});

// Result: { success: true }
// Creates: .tmp/context-index/auth-system.json
```

#### `addAgentOutput(feature, agent, outputPath, metadata)`

Track what each agent produced.

```typescript
import { addAgentOutput } from './context-index';

// After ArchitectureAnalyzer completes
addAgentOutput(
  'auth-system',
  'ArchitectureAnalyzer',
  '.tmp/architecture/auth-system/contexts.json',
  { 
    boundedContext: 'authentication',
    module: 'auth-service'
  }
);

// After StoryMapper completes
addAgentOutput(
  'auth-system',
  'StoryMapper',
  '.tmp/story-maps/auth-system/map.json',
  { 
    verticalSlice: 'user-login'
  }
);
```

#### `getContextForAgent(feature, agentType)`

Get ONLY the files needed for a specific agent type.

```typescript
import { getContextForAgent } from './context-index';

// StoryMapper needs: ArchitectureAnalyzer output + story context
const result = getContextForAgent('auth-system', 'StoryMapper');

// Returns:
{
  success: true,
  context: {
    feature: "auth-system",
    agentType: "StoryMapper",
    contextFiles: [
      "(example: .opencode/context/core/story-mapping/guide.md)"
    ],
    referenceFiles: [],
    agentOutputs: [
      ".tmp/architecture/auth-system/contexts.json"
    ],
    metadata: {
      boundedContext: "authentication",
      module: "auth-service"
    }
  }
}
```

#### `getFullContext(feature)`

Orchestrator can see everything (for coordination).

```typescript
import { getFullContext } from './context-index';

const result = getFullContext('auth-system');

// Returns complete index with all agent outputs
```

---

## Agent-Specific Context Rules

Each agent type gets a minimal, focused context:

### ArchitectureAnalyzer
**Needs:**
- Architecture patterns context files
- Reference files (existing code)

**Gets:**
```typescript
{
  contextFiles: [
    "(example: .opencode/context/architecture/patterns.md)"
  ],
  referenceFiles: [
    "src/auth/old-auth.ts"
  ],
  agentOutputs: [],
  metadata: {}
}
```

### StoryMapper
**Needs:**
- ArchitectureAnalyzer output
- Story mapping context files

**Gets:**
```typescript
{
  contextFiles: [
    "(example: .opencode/context/core/story-mapping/guide.md)"
  ],
  referenceFiles: [],
  agentOutputs: [
    ".tmp/architecture/auth-system/contexts.json"
  ],
  metadata: {
    boundedContext: "authentication",
    module: "auth-service"
  }
}
```

### PrioritizationEngine
**Needs:**
- StoryMapper output
- Prioritization context files

**Gets:**
```typescript
{
  contextFiles: [
    "(example: .opencode/context/core/prioritization/scoring.md)"
  ],
  referenceFiles: [],
  agentOutputs: [
    ".tmp/story-maps/auth-system/map.json"
  ],
  metadata: {
    verticalSlice: "user-login"
  }
}
```

### TaskManager
**Needs:**
- ALL previous agent outputs
- Task management context files

**Gets:**
```typescript
{
  contextFiles: [
    ".opencode/context/core/task-management/navigation.md",
    ".opencode/context/core/standards/code-quality.md"
  ],
  referenceFiles: [],
  agentOutputs: [
    ".tmp/architecture/auth-system/contexts.json",
    ".tmp/story-maps/auth-system/map.json",
    ".tmp/planning/prioritized.json"
  ],
  metadata: {
    ArchitectureAnalyzer: { boundedContext: "authentication" },
    StoryMapper: { verticalSlice: "user-login" }
  }
}
```

### CoderAgent
**Needs:**
- TaskManager output (subtask JSON)
- Coding standards

**Gets:**
```typescript
{
  contextFiles: [
    ".opencode/context/core/standards/code-quality.md",
    "(example: .opencode/context/security/auth-patterns.md)"
  ],
  referenceFiles: [],
  agentOutputs: [
    ".tmp/tasks/auth-system/subtask_01.json"
  ],
  metadata: {}
}
```

---

## Orchestrator Workflow Example

### Complete Feature Implementation Flow

```typescript
import { 
  createContextIndex, 
  addAgentOutput, 
  getContextForAgent 
} from './context-index';

// 1. Initialize context index
createContextIndex('auth-system', {
  contextFiles: [
    '.opencode/context/core/standards/code-quality.md',
    '(example: .opencode/context/security/auth-patterns.md)',
    '(example: .opencode/context/architecture/patterns.md)'
  ],
  referenceFiles: [
    'src/auth/old-auth.ts'
  ]
});

// 2. Delegate to ArchitectureAnalyzer
const archContext = getContextForAgent('auth-system', 'ArchitectureAnalyzer');
// Pass ONLY: archContext.contextFiles + archContext.referenceFiles

// 3. ArchitectureAnalyzer completes → Read output and update index
addAgentOutput(
  'auth-system',
  'ArchitectureAnalyzer',
  '.tmp/architecture/auth-system/contexts.json',
  { boundedContext: 'authentication', module: 'auth-service' }
);

// 4. Delegate to StoryMapper
const storyContext = getContextForAgent('auth-system', 'StoryMapper');
// Pass ONLY: 
//   - storyContext.contextFiles (story mapping guide)
//   - storyContext.agentOutputs (ArchitectureAnalyzer output path)

// 5. StoryMapper completes → Update index
addAgentOutput(
  'auth-system',
  'StoryMapper',
  '.tmp/story-maps/auth-system/map.json',
  { verticalSlice: 'user-login' }
);

// 6. Delegate to PrioritizationEngine
const prioContext = getContextForAgent('auth-system', 'PrioritizationEngine');
// Pass ONLY:
//   - prioContext.contextFiles (prioritization guide)
//   - prioContext.agentOutputs (StoryMapper output path)

// 7. Continue pattern through all agents...
```

### Key Pattern

```typescript
// For each agent:
const context = getContextForAgent(feature, agentType);

// Delegate with minimal context
task(
  subagent_type=agentType,
  description="...",
  prompt=`
    Context files to load:
    ${context.contextFiles.map(f => `- ${f}`).join('\n')}
    
    Previous agent outputs to read:
    ${context.agentOutputs.map(f => `- ${f}`).join('\n')}
    
    Metadata from previous agents:
    ${JSON.stringify(context.metadata, null, 2)}
    
    Your task: ...
  `
);

// After agent completes, update index
addAgentOutput(feature, agentType, outputPath, metadata);
```

---

## Comparison: Session Context vs Context Index

### When to Use Session Context Manager

**Use `session-context-manager.ts` when:**
- ✅ Single long-running session with one agent
- ✅ Need human-readable markdown summary
- ✅ Want to track decisions and progress narratively
- ✅ Session state needs to be reviewed by humans

**Example:** Interactive feature development with user feedback loops

### When to Use Context Index

**Use `context-index.ts` when:**
- ✅ Multi-agent orchestration with delegation
- ✅ Need minimal context handoff between agents
- ✅ Want to avoid context bloat
- ✅ Agents should only see what they need
- ✅ Performance matters (large features)

**Example:** Automated feature pipeline (Architecture → Stories → Tasks → Code)

### Comparison Table

| Feature | Session Context | Context Index |
|---------|----------------|---------------|
| **Format** | Markdown (human-readable) | JSON (machine-readable) |
| **Size** | Large (full content) | Small (paths only) |
| **Audience** | Humans + Agents | Agents only |
| **Context Passing** | Everything to everyone | Minimal per agent |
| **Use Case** | Interactive sessions | Automated pipelines |
| **Performance** | Slower (large files) | Faster (lightweight) |
| **Tracking** | Decisions, progress, narrative | Outputs, metadata, pointers |

### Can You Use Both?

**Yes!** They solve different problems:

```typescript
// Create session context for human tracking
createSession('auth-system', 'Implement JWT authentication', {
  contextFiles: [...],
  exitCriteria: [...]
});

// Create context index for agent coordination
createContextIndex('auth-system', {
  contextFiles: [...],
  referenceFiles: [...]
});

// Session context = human-readable audit trail
// Context index = efficient agent coordination
```

---

## Benefits

### For Orchestrator
- ✅ Lightweight tracking (just paths and metadata)
- ✅ Full visibility into all agent outputs
- ✅ Easy to coordinate dependencies
- ✅ Fast lookups

### For Subagents
- ✅ Minimal context (only what they need)
- ✅ Faster execution (less reading)
- ✅ Clear dependencies (explicit output paths)
- ✅ No context bloat

### For System
- ✅ Scalable (index stays small)
- ✅ Maintainable (clear separation of concerns)
- ✅ Debuggable (trace agent outputs)
- ✅ Composable (agents don't need to know about each other)

---

## Anti-Patterns

### ❌ Passing Entire Index to Agents

```typescript
// BAD: Agent gets everything
const index = getFullContext('auth-system');
task(subagent_type="StoryMapper", prompt=JSON.stringify(index));
```

**Why bad:** Agent wastes time parsing irrelevant data

### ❌ Embedding Content in Index

```typescript
// BAD: Storing full file contents
addAgentOutput('auth-system', 'ArchitectureAnalyzer', outputPath, {
  fullContent: fs.readFileSync(outputPath, 'utf-8') // DON'T DO THIS
});
```

**Why bad:** Index becomes bloated, defeats the purpose

### ❌ Skipping Index Updates

```typescript
// BAD: Agent completes but orchestrator doesn't update index
task(subagent_type="ArchitectureAnalyzer", ...);
// ... agent completes ...
// (orchestrator forgets to call addAgentOutput)
```

**Why bad:** Next agent won't know about previous outputs

### ❌ Using Index for Human Review

```typescript
// BAD: Expecting humans to read JSON index
const index = getFullContext('auth-system');
console.log("Review this:", JSON.stringify(index));
```

**Why bad:** Index is for machines, use session-context for humans

---

## Best Practices

### 1. Update Index Immediately After Agent Completes

```typescript
// Agent completes
const result = await task(subagent_type="ArchitectureAnalyzer", ...);

// Immediately update index
addAgentOutput(
  'auth-system',
  'ArchitectureAnalyzer',
  '.tmp/architecture/auth-system/contexts.json',
  { boundedContext: 'authentication' }
);
```

### 2. Use Metadata for Small, Useful Data

```typescript
// GOOD: Small metadata that helps next agent
addAgentOutput('auth-system', 'ArchitectureAnalyzer', outputPath, {
  boundedContext: 'authentication',
  module: 'auth-service',
  complexity: 'medium'
});

// BAD: Large data that should stay in files
addAgentOutput('auth-system', 'ArchitectureAnalyzer', outputPath, {
  fullAnalysis: { /* 1000 lines of JSON */ }
});
```

### 3. Let Agents Read Their Own Inputs

```typescript
// GOOD: Agent reads the file
const context = getContextForAgent('auth-system', 'StoryMapper');
task(
  subagent_type="StoryMapper",
  prompt=`Read architecture analysis: ${context.agentOutputs[0]}`
);

// BAD: Orchestrator reads and passes content
const archOutput = fs.readFileSync('.tmp/architecture/...', 'utf-8');
task(
  subagent_type="StoryMapper",
  prompt=`Here's the full architecture: ${archOutput}`
);
```

### 4. Keep Context Files Focused

```typescript
// GOOD: Only relevant context files
createContextIndex('auth-system', {
  contextFiles: [
    '(example: .opencode/context/security/auth-patterns.md)',
    '.opencode/context/core/standards/code-quality.md'
  ]
});

// BAD: Every context file in the project
createContextIndex('auth-system', {
  contextFiles: glob('.opencode/context/**/*.md') // Too much!
});
```

---

## CLI Usage

### Create Index

```bash
npx ts-node context-index.ts create auth-system
# ✅ Context index created for: auth-system
#    Location: .tmp/context-index/auth-system.json
```

### Add Agent Output

```bash
npx ts-node context-index.ts add-output \
  auth-system \
  ArchitectureAnalyzer \
  .tmp/architecture/auth-system/contexts.json \
  '{"boundedContext":"authentication","module":"auth-service"}'
# ✅ Added ArchitectureAnalyzer output: .tmp/architecture/auth-system/contexts.json
```

### Get Context for Agent

```bash
npx ts-node context-index.ts get-context auth-system StoryMapper
# {
#   "feature": "auth-system",
#   "agentType": "StoryMapper",
#   "contextFiles": ["(example: .opencode/context/core/story-mapping/guide.md)"],
#   "agentOutputs": [".tmp/architecture/auth-system/contexts.json"],
#   "metadata": {"boundedContext":"authentication"}
# }
```

### Show Full Index

```bash
npx ts-node context-index.ts show auth-system
# {
#   "feature": "auth-system",
#   "created": "2026-02-15T10:00:00Z",
#   "agents": { ... }
# }
```

---

## Summary

**Lightweight Context Handoff Pattern:**
- Orchestrator maintains lightweight index (paths + metadata)
- Each agent gets minimal, focused context
- Index stays small and fast
- Agents read only what they need
- Clear separation: index for coordination, files for content

**Use this pattern when:**
- Multi-agent orchestration
- Performance matters
- Context bloat is a problem
- Agents should be isolated

**Use session-context when:**
- Human-readable tracking needed
- Single-agent sessions
- Narrative progress tracking
