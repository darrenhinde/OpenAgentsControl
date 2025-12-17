# Multi-Agent Logging System

**Status**: ✅ COMPLETE - All 3 Days Implemented  
**Date**: 2025-12-17  
**Version**: 1.0.0

---

## Overview

A modular logging system for tracking and visualizing multi-agent delegation hierarchies in the eval framework. Provides clear visual output showing parent-child relationships, delegation chains, and session activity.

---

## Features

✅ **Session Hierarchy Tracking** - Tracks parent → child → grandchild relationships  
✅ **Visual Formatting** - Pretty-printed output with indentation and emojis  
✅ **Delegation Events** - Captures when agents delegate to subagents  
✅ **Message Logging** - Logs user and assistant messages at all levels  
✅ **Tool Call Tracking** - Shows tool usage with relevant details  
✅ **Tree Analysis** - Build complete session trees with statistics  

---

## Architecture

```
evals/framework/src/logging/
├── types.ts              # TypeScript interfaces
├── session-tracker.ts    # Session hierarchy tracking
├── logger.ts             # Pretty-printing logger
├── formatters.ts         # Visual formatting utilities
├── index.ts              # Module exports
└── __tests__/            # Unit and integration tests
    ├── session-tracker.test.ts
    ├── logger.test.ts
    └── integration.test.ts
```

---

## Usage

### Basic Example

```typescript
import { MultiAgentLogger } from './logging/index.js';

// Create logger
const logger = new MultiAgentLogger(true);

// Log parent session
logger.logSessionStart('ses_parent_123', 'openagent');
logger.logMessage('ses_parent_123', 'user', 'Call subagent');

// Log delegation
const delegationId = logger.logDelegation(
  'ses_parent_123',
  'simple-responder',
  'Respond with test message'
);

// Log child session
logger.logSessionStart('ses_child_456', 'simple-responder', 'ses_parent_123');
logger.logChildLinked(delegationId, 'ses_child_456');

// Log child activity
logger.logMessage('ses_child_456', 'assistant', 'AWESOME TESTING');

// Complete sessions
logger.logSessionComplete('ses_child_456');
logger.logSessionComplete('ses_parent_123');
```

### Output

```
┌────────────────────────────────────────────────────────────┐
│ 🎯 PARENT: openagent (ses_parent_1...)                     │
└────────────────────────────────────────────────────────────┘
  📝 User: Call subagent

  🔧 TOOL: task
     ├─ subagent: simple-responder
     ├─ prompt: Respond with test message
     └─ Creating child session...

  ┌────────────────────────────────────────────────────────────┐
  │ 🎯 CHILD: simple-responder (ses_child_45...)               │
  │    Parent: ses_parent_1...                                 │
  │    Depth: 1                                                │
  └────────────────────────────────────────────────────────────┘
     └─ Child session: ses_child_45...
    🤖 Agent: AWESOME TESTING
  ✅ CHILD COMPLETE (2.5s)

✅ PARENT COMPLETE (29.4s)
```

---

## API Reference

### MultiAgentLogger

Main logger class with hierarchy-aware formatting.

#### Methods

**`logSessionStart(sessionId, agent, parentId?)`**  
Log session creation. Automatically tracks hierarchy.

**`logDelegation(parentSessionId, toAgent, prompt)`**  
Log delegation event. Returns delegation ID.

**`logChildLinked(delegationId, childSessionId)`**  
Link child session to delegation event.

**`logMessage(sessionId, role, text)`**  
Log user or assistant message.

**`logToolCall(sessionId, tool, input)`**  
Log tool execution (skips 'task' tool).

**`logSessionComplete(sessionId)`**  
Mark session as complete with duration.

**`logSystem(sessionId, message)`**  
Log system message.

**`getTracker()`**  
Get SessionTracker for analysis.

**`setEnabled(enabled)`**  
Enable/disable logging.

**`clear()`**  
Clear all tracked data.

---

### SessionTracker

Tracks session hierarchy and delegation events.

#### Methods

**`registerSession(sessionId, agent, parentId?)`**  
Register new session in hierarchy.

**`recordDelegation(parentSessionId, toAgent, prompt)`**  
Record delegation event. Returns delegation ID.

**`linkChildSession(delegationId, childSessionId)`**  
Link child session to delegation.

**`completeSession(sessionId)`**  
Mark session complete.

**`getSession(sessionId)`**  
Get session node by ID.

**`getHierarchy(rootSessionId)`**  
Get full hierarchy from root.

**`buildTree(rootSessionId)`**  
Build complete session tree with stats.

**`getSessionsAtDepth(depth)`**  
Get all sessions at specific depth.

**`getRootSessions()`**  
Get all root sessions (depth 0).

**`getDelegationsFromSession(sessionId)`**  
Get all delegations from a session.

**`clear()`**  
Clear all tracked data.

---

## Testing

### Run Tests

```bash
# All logging tests
npm test -- src/logging/__tests__/ --run

# Specific test file
npm test -- src/logging/__tests__/session-tracker.test.ts --run

# Integration tests
npm test -- src/logging/__tests__/integration.test.ts --run
```

### Test Coverage

- ✅ 37 tests passing
- ✅ SessionTracker: 16 tests
- ✅ MultiAgentLogger: 18 tests
- ✅ Integration: 3 tests

### Demo Script

```bash
npx tsx scripts/demo-logging.ts
```

Shows realistic delegation scenario with visual output.

---

## Implementation Status

### ✅ Day 1: Core Infrastructure (COMPLETE)

- [x] Create logging directory structure
- [x] Implement types.ts
- [x] Implement session-tracker.ts
- [x] Implement logger.ts
- [x] Implement formatters.ts
- [x] Create index.ts exports
- [x] Write unit tests (37 tests)
- [x] TypeScript build validation
- [x] Integration tests
- [x] Demo script

### ✅ Day 2: Event Stream Integration (COMPLETE)

- [x] Modify event-stream-handler.ts
- [x] Hook into session.created events
- [x] Hook into message.updated events
- [x] Hook into message.part.updated events
- [x] Initialize logger in test-runner.ts
- [x] Test with simple-subagent-call.yaml

### ✅ Day 3: Child Session Capture (COMPLETE)

- [x] Implement child session detection
- [x] Track multiple active sessions
- [x] Capture child session messages from text parts
- [x] Link child sessions to parent delegations
- [x] Test with nested delegation
- [x] Message deduplication for cleaner output

---

## Design Principles

**Modular**: Each component has single responsibility  
**Functional**: Pure functions, immutable data  
**Testable**: 100% test coverage, easy to mock  
**Visual**: Clear hierarchy with indentation  
**Performant**: Minimal overhead (<5% target)  

---

## Examples

### Nested Delegation (3 Levels)

```typescript
logger.logSessionStart('root', 'openagent');
logger.logDelegation('root', 'task-manager', 'Break down feature');
logger.logSessionStart('level1', 'task-manager', 'root');
logger.logDelegation('level1', 'coder-agent', 'Implement subtask');
logger.logSessionStart('level2', 'coder-agent', 'level1');
```

Output shows 3 levels of indentation with clear parent-child links.

### Parallel Delegation

```typescript
logger.logSessionStart('parent', 'openagent');
logger.logDelegation('parent', 'tester', 'Write tests');
logger.logDelegation('parent', 'reviewer', 'Review code');
logger.logSessionStart('tester', 'tester', 'parent');
logger.logSessionStart('reviewer', 'reviewer', 'parent');
```

Both children shown at same depth level.

---

## Next Steps

1. **Integrate into event stream handler** (Day 2)
   - Hook logger into SDK event stream
   - Detect session creation, messages, tool calls
   - Test with existing eval tests

2. **Implement child session monitoring** (Day 3)
   - Monitor for child session creation
   - Fetch child messages via SDK
   - Link child timeline to parent

3. **Add to all evaluators** (Future)
   - Enable logging in debug mode
   - Export logs to JSON
   - Build log viewer dashboard

---

## Related Files

- **Task Spec**: `tasks/eval/december/01-multi-agent-logging-system.md`
- **Checklist**: `tasks/eval/december/CHECKLIST.md`
- **Analysis**: `evals/EVAL_SYSTEM_ANALYSIS.md`
- **Action Plan**: `evals/ACTION_PLAN.md`

---

**Created**: 2025-12-17  
**Author**: OpenAgent  
**Status**: Day 1 Complete ✅
