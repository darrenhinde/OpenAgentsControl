<!-- Context: workflows/lightweight-context-handoff-example | Priority: reference | Version: 1.0 | Updated: 2026-02-15 -->
# Lightweight Context Handoff - Orchestrator Example

## Complete Feature Implementation Using Context Index

This document shows a complete orchestrator workflow using the lightweight context handoff pattern for implementing a JWT authentication system.

---

## Setup Phase

### Step 1: Initialize Context Index

```typescript
import { createContextIndex } from './.opencode/skills/project-orchestration/scripts/context-index';

// Create lightweight index with initial context
const result = createContextIndex('auth-system', {
  contextFiles: [
    '.opencode/context/core/standards/code-quality.md',
    '(example: (example: .opencode/context/security/auth-patterns.md))',
    '(example: (example: .opencode/context/architecture/ddd-patterns.md))',
    '(example: (example: .opencode/context/core/story-mapping/guide.md))'
  ],
  referenceFiles: [
    'src/auth/old-auth.ts',
    'src/middleware/auth.middleware.ts'
  ]
});

// Result: .tmp/context-index/auth-system.json created
```

**What's in the index:**
```json
{
  "feature": "auth-system",
  "created": "2026-02-15T10:00:00Z",
  "updated": "2026-02-15T10:00:00Z",
  "agents": {},
  "contextFiles": [
    ".opencode/context/core/standards/code-quality.md",
    "(example: (example: .opencode/context/security/auth-patterns.md))",
    "(example: (example: .opencode/context/architecture/ddd-patterns.md))",
    "(example: (example: .opencode/context/core/story-mapping/guide.md))"
  ],
  "referenceFiles": [
    "src/auth/old-auth.ts",
    "src/middleware/auth.middleware.ts"
  ]
}
```

---

## Stage 1: Architecture Analysis

### Step 2: Get Context for ArchitectureAnalyzer

```typescript
import { getContextForAgent } from './.opencode/skills/project-orchestration/scripts/context-index';

const archContext = getContextForAgent('auth-system', 'ArchitectureAnalyzer');

// Returns:
{
  feature: "auth-system",
  agentType: "ArchitectureAnalyzer",
  contextFiles: [
    "(example: .opencode/context/architecture/ddd-patterns.md)"
  ],
  referenceFiles: [
    "src/auth/old-auth.ts",
    "src/middleware/auth.middleware.ts"
  ],
  agentOutputs: [],
  metadata: {}
}
```

**Key Point:** ArchitectureAnalyzer gets ONLY:
- Architecture patterns context
- Reference files to analyze
- NO story mapping guide (not needed yet)
- NO previous agent outputs (it's first)

### Step 3: Delegate to ArchitectureAnalyzer

```typescript
task(
  subagent_type="ArchitectureAnalyzer",
  description="Analyze authentication system architecture",
  prompt=`
    Analyze the architecture for implementing JWT authentication.
    
    Context files to load:
    - ${archContext.contextFiles[0]}
    
    Reference files to analyze:
    - ${archContext.referenceFiles[0]}
    - ${archContext.referenceFiles[1]}
    
    Identify:
    - Bounded contexts
    - Module boundaries
    - Integration points
    
    Output: .tmp/architecture/auth-system/contexts.json
  `
);
```

### Step 4: ArchitectureAnalyzer Completes → Update Index

```typescript
import { addAgentOutput } from './.opencode/skills/project-orchestration/scripts/context-index';

// Read ArchitectureAnalyzer output
const archOutput = JSON.parse(
  fs.readFileSync('.tmp/architecture/auth-system/contexts.json', 'utf-8')
);

// Update index with output path and metadata
addAgentOutput(
  'auth-system',
  'ArchitectureAnalyzer',
  '.tmp/architecture/auth-system/contexts.json',
  {
    boundedContext: archOutput.primary_context,  // "authentication"
    module: archOutput.module_name,              // "auth-service"
    complexity: archOutput.complexity            // "medium"
  }
);
```

**Index now contains:**
```json
{
  "feature": "auth-system",
  "agents": {
    "ArchitectureAnalyzer": {
      "outputs": [".tmp/architecture/auth-system/contexts.json"],
      "metadata": {
        "boundedContext": "authentication",
        "module": "auth-service",
        "complexity": "medium"
      },
      "timestamp": "2026-02-15T10:05:00Z"
    }
  },
  ...
}
```

---

## Stage 2: Story Mapping

### Step 5: Get Context for StoryMapper

```typescript
const storyContext = getContextForAgent('auth-system', 'StoryMapper');

// Returns:
{
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
    module: "auth-service",
    complexity: "medium"
  }
}
```

**Key Point:** StoryMapper gets:
- Story mapping guide (filtered from contextFiles)
- ArchitectureAnalyzer output path (NOT full content)
- Metadata from ArchitectureAnalyzer (small, useful data)
- NO reference files (doesn't need source code)

### Step 6: Delegate to StoryMapper

```typescript
task(
  subagent_type="StoryMapper",
  description="Create user story map for authentication",
  prompt=`
    Create a user story map for JWT authentication system.
    
    Context files to load:
    - ${storyContext.contextFiles[0]}
    
    Previous agent outputs to read:
    - ${storyContext.agentOutputs[0]}
    
    Metadata from ArchitectureAnalyzer:
    - Bounded Context: ${storyContext.metadata.boundedContext}
    - Module: ${storyContext.metadata.module}
    
    Create vertical slices for:
    - User login
    - Token refresh
    - Logout
    
    Output: .tmp/story-maps/auth-system/map.json
  `
);
```

### Step 7: StoryMapper Completes → Update Index

```typescript
const storyOutput = JSON.parse(
  fs.readFileSync('.tmp/story-maps/auth-system/map.json', 'utf-8')
);

addAgentOutput(
  'auth-system',
  'StoryMapper',
  '.tmp/story-maps/auth-system/map.json',
  {
    verticalSlice: storyOutput.primary_slice,  // "user-login"
    storyCount: storyOutput.stories.length     // 8
  }
);
```

---

## Stage 3: Prioritization

### Step 8: Get Context for PrioritizationEngine

```typescript
const prioContext = getContextForAgent('auth-system', 'PrioritizationEngine');

// Returns:
{
  feature: "auth-system",
  agentType: "PrioritizationEngine",
  contextFiles: [],  // No prioritization context file in index
  referenceFiles: [],
  agentOutputs: [
    ".tmp/story-maps/auth-system/map.json"
  ],
  metadata: {
    verticalSlice: "user-login",
    storyCount: 8
  }
}
```

**Key Point:** PrioritizationEngine gets:
- StoryMapper output path (to read stories)
- Metadata from StoryMapper
- NO ArchitectureAnalyzer output (not needed)

### Step 9: Delegate to PrioritizationEngine

```typescript
task(
  subagent_type="PrioritizationEngine",
  description="Prioritize authentication stories",
  prompt=`
    Prioritize user stories for authentication system.
    
    Story map to read:
    - ${prioContext.agentOutputs[0]}
    
    Metadata:
    - Vertical Slice: ${prioContext.metadata.verticalSlice}
    - Story Count: ${prioContext.metadata.storyCount}
    
    Calculate RICE and WSJF scores.
    Assign to release slices.
    
    Output: .tmp/planning/auth-system/prioritized.json
  `
);
```

### Step 10: PrioritizationEngine Completes → Update Index

```typescript
const prioOutput = JSON.parse(
  fs.readFileSync('.tmp/planning/auth-system/prioritized.json', 'utf-8')
);

addAgentOutput(
  'auth-system',
  'PrioritizationEngine',
  '.tmp/planning/auth-system/prioritized.json',
  {
    releaseSlice: prioOutput.release_slice,  // "v1.0.0"
    avgRiceScore: prioOutput.avg_rice_score  // 6750
  }
);
```

---

## Stage 4: Task Breakdown

### Step 11: Get Context for TaskManager

```typescript
const taskContext = getContextForAgent('auth-system', 'TaskManager');

// Returns:
{
  feature: "auth-system",
  agentType: "TaskManager",
  contextFiles: [
    ".opencode/context/core/standards/code-quality.md"
  ],
  referenceFiles: [],
  agentOutputs: [
    ".tmp/architecture/auth-system/contexts.json",
    ".tmp/story-maps/auth-system/map.json",
    ".tmp/planning/auth-system/prioritized.json"
  ],
  metadata: {
    ArchitectureAnalyzer: {
      boundedContext: "authentication",
      module: "auth-service"
    },
    StoryMapper: {
      verticalSlice: "user-login",
      storyCount: 8
    },
    PrioritizationEngine: {
      releaseSlice: "v1.0.0",
      avgRiceScore: 6750
    }
  }
}
```

**Key Point:** TaskManager gets:
- ALL previous agent outputs (needs full picture)
- Metadata from ALL agents (for task.json population)
- Coding standards (for subtask context_files)

### Step 12: Delegate to TaskManager

```typescript
task(
  subagent_type="TaskManager",
  description="Break down authentication into subtasks",
  prompt=`
    Create task breakdown for JWT authentication system.
    
    Context files to load:
    - ${taskContext.contextFiles[0]}
    
    Previous agent outputs to read:
    - ${taskContext.agentOutputs[0]} (Architecture)
    - ${taskContext.agentOutputs[1]} (Stories)
    - ${taskContext.agentOutputs[2]} (Priorities)
    
    Metadata from previous agents:
    ${JSON.stringify(taskContext.metadata, null, 2)}
    
    Create task.json and subtask_NN.json files.
    Use metadata to populate enhanced fields.
    
    Output: .tmp/tasks/auth-system/
  `
);
```

### Step 13: TaskManager Completes → Update Index

```typescript
addAgentOutput(
  'auth-system',
  'TaskManager',
  '.tmp/tasks/auth-system/task.json',
  {
    subtaskCount: 5,
    parallelTasks: 2
  }
);
```

---

## Stage 5: Implementation

### Step 14: Get Context for CoderAgent

```typescript
const coderContext = getContextForAgent('auth-system', 'CoderAgent');

// Returns:
{
  feature: "auth-system",
  agentType: "CoderAgent",
  contextFiles: [
    ".opencode/context/core/standards/code-quality.md",
    "(example: .opencode/context/security/auth-patterns.md)"
  ],
  referenceFiles: [],
  agentOutputs: [
    ".tmp/tasks/auth-system/task.json"
  ],
  metadata: {}
}
```

**Key Point:** CoderAgent gets:
- Coding standards and security patterns
- TaskManager output (task.json)
- NO architecture/story/priority outputs (not needed for coding)

### Step 15: Delegate to CoderAgent (for each subtask)

```typescript
// Read task.json to get subtask list
const taskJson = JSON.parse(
  fs.readFileSync('.tmp/tasks/auth-system/task.json', 'utf-8')
);

// For each subtask
for (let seq = 1; seq <= taskJson.subtask_count; seq++) {
  const subtaskPath = `.tmp/tasks/auth-system/subtask_${seq.toString().padStart(2, '0')}.json`;
  
  task(
    subagent_type="CoderAgent",
    description=`Implement subtask ${seq}`,
    prompt=`
      Implement the subtask defined in: ${subtaskPath}
      
      Context files to load:
      ${coderContext.contextFiles.map(f => `- ${f}`).join('\n')}
      
      Follow acceptance criteria exactly.
      Run self-review before completion.
    `
  );
}
```

---

## Summary: What Each Agent Received

### ArchitectureAnalyzer
```
Context Files: 1 (architecture patterns)
Reference Files: 2 (existing code)
Agent Outputs: 0
Total Files to Read: 3
```

### StoryMapper
```
Context Files: 1 (story mapping guide)
Reference Files: 0
Agent Outputs: 1 (ArchitectureAnalyzer)
Total Files to Read: 2
```

### PrioritizationEngine
```
Context Files: 0
Reference Files: 0
Agent Outputs: 1 (StoryMapper)
Total Files to Read: 1
```

### TaskManager
```
Context Files: 1 (code quality standards)
Reference Files: 0
Agent Outputs: 3 (all previous agents)
Total Files to Read: 4
```

### CoderAgent
```
Context Files: 2 (code quality + security)
Reference Files: 0
Agent Outputs: 1 (TaskManager - subtask JSON)
Total Files to Read: 3
```

---

## Comparison: With vs Without Context Index

### WITHOUT Context Index (Session Context Pattern)

**Every agent receives:**
```
- Full session context.md (500+ lines)
- All context files (10+ files)
- All reference files
- All previous agent outputs
- Full decision history
- Full progress tracking

Total: 15+ files, 5000+ lines per agent
```

### WITH Context Index (Lightweight Pattern)

**Each agent receives:**
```
ArchitectureAnalyzer: 3 files
StoryMapper: 2 files
PrioritizationEngine: 1 file
TaskManager: 4 files
CoderAgent: 3 files

Average: 2.6 files per agent
```

**Reduction:** ~83% fewer files per agent

---

## Benefits Demonstrated

### 1. Minimal Context Per Agent
Each agent reads only what it needs, nothing more.

### 2. Fast Handoffs
Orchestrator just passes file paths, not content.

### 3. Clear Dependencies
Agent outputs are explicitly tracked and passed.

### 4. Lightweight Index
Index stays small (~200 lines JSON) even with 5 agents.

### 5. Scalable
Adding more agents doesn't bloat the index.

### 6. Debuggable
Easy to trace: "Which agent produced this file?"

---

## Code Template for Orchestrators

```typescript
import { 
  createContextIndex, 
  addAgentOutput, 
  getContextForAgent 
} from './.opencode/skills/project-orchestration/scripts/context-index';

// 1. Initialize
createContextIndex(feature, { contextFiles, referenceFiles });

// 2. For each agent in pipeline
const agentTypes = [
  'ArchitectureAnalyzer',
  'StoryMapper',
  'PrioritizationEngine',
  'TaskManager',
  'CoderAgent'
];

for (const agentType of agentTypes) {
  // Get minimal context
  const context = getContextForAgent(feature, agentType);
  
  // Delegate with minimal context
  const result = task(
    subagent_type=agentType,
    description=`Execute ${agentType} for ${feature}`,
    prompt=`
      Context files: ${context.contextFiles.join(', ')}
      Previous outputs: ${context.agentOutputs.join(', ')}
      Metadata: ${JSON.stringify(context.metadata)}
      
      Your task: ...
    `
  );
  
  // Update index with output
  addAgentOutput(feature, agentType, outputPath, metadata);
}
```

---

## When to Use This Pattern

✅ **Use Lightweight Context Index when:**
- Multi-agent orchestration (3+ agents)
- Each agent has a specific role
- Performance matters
- Context bloat is a problem
- Agents should be isolated

❌ **Don't use when:**
- Single agent session
- Human needs to review context
- Agents need full narrative history
- Interactive feedback loops

**Alternative:** Use `session-context-manager.ts` for human-readable tracking alongside context-index for agent coordination.
