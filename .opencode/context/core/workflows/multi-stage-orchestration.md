<!-- Context: workflows/orchestration | Priority: critical | Version: 1.0 | Updated: 2026-02-14 -->

# Multi-Stage Orchestration Workflow

## Quick Reference

**Purpose**: End-to-end workflow for complex feature development from concept to release

**8 Stages**: Architecture Decomposition → Story Mapping → Prioritization → Enhanced Task Breakdown → Contract Definition → Parallel Execution → Integration & Validation → Release & Learning

**Key Agents**: OpenCoder (orchestrator), TaskManager, BatchExecutor, CoderAgent, ContextScout, ExternalScout

**When to Use**: Complex features requiring multi-agent coordination, parallel execution, and systematic integration

---

## Overview

The Multi-Stage Orchestration Workflow is a comprehensive framework for managing complex software development from initial requirements through to release. It coordinates multiple specialized agents, enables parallel execution, and ensures systematic integration and validation.

### Core Philosophy

- **Decompose before building**: Break down complexity systematically
- **Plan before executing**: Define contracts and dependencies upfront
- **Parallelize when possible**: Execute independent work simultaneously
- **Validate continuously**: Integrate and test throughout the process
- **Learn and improve**: Capture insights for future iterations

### Workflow Stages

```
┌─────────────────────────────────────────────────────────────────┐
│                    MULTI-STAGE ORCHESTRATION                     │
└─────────────────────────────────────────────────────────────────┘

Stage 1: Architecture Decomposition
         ↓ (System boundaries defined)
         
Stage 2: Story Mapping
         ↓ (User journeys mapped)
         
Stage 3: Prioritization
         ↓ (Work sequenced)
         
Stage 4: Enhanced Task Breakdown
         ↓ (Atomic tasks with dependencies)
         
Stage 5: Contract Definition
         ↓ (Interfaces and integration points)
         
Stage 6: Parallel Execution
         ↓ (Simultaneous implementation)
         
Stage 7: Integration & Validation
         ↓ (Components verified together)
         
Stage 8: Release & Learning
         ↓ (Deployed and insights captured)
```

---

## Stage 1: Architecture Decomposition

**Goal**: Break down the system into logical components and define boundaries

**Primary Agent**: OpenCoder (orchestrator)

**Supporting Agents**: ContextScout (for architectural patterns)

### Process

1. **Analyze Requirements**
   - Understand feature scope and objectives
   - Identify technical constraints
   - Review existing system architecture

2. **Identify Components**
   - Break system into logical modules
   - Define component responsibilities
   - Identify shared dependencies

3. **Define Boundaries**
   - Establish clear interfaces between components
   - Identify integration points
   - Map data flow between components

4. **Document Architecture**
   - Create architecture overview
   - Document component relationships
   - Define technical decisions

### Outputs

- Architecture overview document
- Component list with responsibilities
- System boundary definitions
- Integration point map

### Transition Criteria

- All major components identified
- Component boundaries clearly defined
- Integration points documented
- Technical approach validated

---

## Stage 2: Story Mapping

**Goal**: Map user journeys and translate into user stories

**Primary Agent**: OpenCoder (orchestrator)

**Supporting Agents**: ContextScout (for user journey patterns)

### Process

1. **Identify User Personas**
   - Define who will use the system
   - Understand user goals and needs
   - Map user contexts

2. **Map User Journeys**
   - Document end-to-end user flows
   - Identify key user actions
   - Map touchpoints with system

3. **Create User Stories**
   - Write stories from user perspective
   - Define acceptance criteria
   - Prioritize by user value

4. **Organize Story Map**
   - Group stories by journey
   - Sequence by user flow
   - Identify story dependencies

### Outputs

- User persona definitions
- User journey maps
- User story backlog
- Story map visualization

### Transition Criteria

- All user journeys documented
- Stories written with acceptance criteria
- Stories organized by priority
- Dependencies identified

---

## Stage 3: Prioritization

**Goal**: Sequence work based on value, risk, and dependencies

**Primary Agent**: OpenCoder (orchestrator)

### Process

1. **Assess Value**
   - Rank stories by user value
   - Identify must-have vs. nice-to-have
   - Consider business priorities

2. **Evaluate Risk**
   - Identify technical risks
   - Assess complexity
   - Flag unknowns and uncertainties

3. **Map Dependencies**
   - Identify blocking dependencies
   - Find parallel work opportunities
   - Define critical path

4. **Create Execution Plan**
   - Sequence work into phases
   - Group parallel work into batches
   - Define milestones

### Outputs

- Prioritized story backlog
- Risk assessment matrix
- Dependency graph
- Phased execution plan

### Transition Criteria

- All stories prioritized
- Dependencies mapped
- Execution phases defined
- Critical path identified

---

## Stage 4: Enhanced Task Breakdown

**Goal**: Transform stories into atomic, executable tasks with clear dependencies

**Primary Agent**: TaskManager

**Supporting Agents**: ContextScout (for standards), ExternalScout (for library docs)

### Process

1. **Load Context**
   - Read task management standards
   - Check current task state
   - Load project coding standards

2. **Analyze Feature**
   - Understand scope and objectives
   - Identify technical risks
   - Determine natural task boundaries

3. **Create Task Plan**
   - Break into atomic subtasks (1-2 hours each)
   - Define acceptance criteria
   - Specify deliverables
   - Map dependencies

4. **Generate Task JSON**
   - Create `task.json` with feature metadata
   - Create `subtask_NN.json` for each task
   - Include context_files and reference_files
   - Validate with task-cli.ts

### Outputs

- `.tmp/tasks/{feature}/task.json`
- `.tmp/tasks/{feature}/subtask_01.json` through `subtask_NN.json`
- Task dependency graph
- Parallel execution batches identified

### Task JSON Structure

```json
{
  "id": "feature-slug",
  "name": "Feature Name",
  "status": "active",
  "objective": "Clear objective (max 200 chars)",
  "context_files": ["standards paths"],
  "reference_files": ["source file paths"],
  "exit_criteria": ["completion criteria"],
  "subtask_count": 10,
  "completed_count": 0,
  "created_at": "2026-02-14T00:00:00Z"
}
```

### Subtask JSON Structure

```json
{
  "id": "feature-slug-01",
  "seq": "01",
  "title": "Task description",
  "status": "pending",
  "depends_on": [],
  "parallel": true,
  "suggested_agent": "CoderAgent",
  "context_files": ["standards for this task"],
  "reference_files": ["source files for this task"],
  "acceptance_criteria": ["criterion 1", "criterion 2"],
  "deliverables": ["file paths"],
  "agent_id": null,
  "started_at": null,
  "completed_at": null,
  "completion_summary": null
}
```

### Transition Criteria

- All tasks defined with clear objectives
- Dependencies mapped
- Parallel batches identified
- Task JSON validated

---

## Stage 5: Contract Definition

**Goal**: Define interfaces and integration contracts before implementation

**Primary Agent**: OpenCoder (orchestrator)

**Supporting Agents**: CoderAgent (for contract implementation)

### Process

1. **Identify Integration Points**
   - Map component interfaces
   - Define API contracts
   - Specify data structures

2. **Define Contracts**
   - Write TypeScript interfaces
   - Document API endpoints
   - Define data schemas

3. **Create Contract Files**
   - Generate type definitions
   - Create interface specifications
   - Document integration patterns

4. **Validate Contracts**
   - Review for completeness
   - Check for conflicts
   - Verify against architecture

### Outputs

- TypeScript interface files
- API contract specifications
- Data schema definitions
- Integration documentation

### Contract Example

```typescript
// contracts/user-service.ts
export interface UserService {
  createUser(data: CreateUserData): Promise<User>;
  getUser(id: string): Promise<User | null>;
  updateUser(id: string, data: UpdateUserData): Promise<User>;
  deleteUser(id: string): Promise<void>;
}

export interface CreateUserData {
  email: string;
  name: string;
  role: UserRole;
}

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  createdAt: Date;
  updatedAt: Date;
}

export type UserRole = 'admin' | 'user' | 'guest';
```

### Transition Criteria

- All integration points have contracts
- Contracts validated against architecture
- Type definitions complete
- Documentation written

---

## Stage 6: Parallel Execution

**Goal**: Execute independent tasks simultaneously to maximize throughput

**Primary Agent**: BatchExecutor

**Supporting Agents**: CoderAgent (for implementation), ContextScout, ExternalScout

### Process

1. **Identify Parallel Batches**
   - Group tasks with `parallel: true`
   - Verify no inter-dependencies
   - Check for deliverable conflicts

2. **Execute Batch**
   - Delegate all tasks simultaneously to CoderAgent
   - Each CoderAgent:
     - Loads context
     - Implements deliverables
     - Runs self-review
     - Marks task complete

3. **Monitor Completion**
   - Wait for all tasks in batch to complete
   - Track individual task status
   - Detect failures early

4. **Verify Batch Completion**
   - Check all tasks marked complete
   - Validate deliverables exist
   - Confirm acceptance criteria met

### Batch Execution Flow

```
BatchExecutor receives: Batch 1 [tasks 01, 02, 03]
         ↓
    Validates parallel safety
         ↓
    ┌────────────┬────────────┬────────────┐
    │            │            │            │
    ▼            ▼            ▼            ▼
CoderAgent   CoderAgent   CoderAgent
(Task 01)    (Task 02)    (Task 03)
    │            │            │
    │ Implement  │ Implement  │ Implement
    │ Self-review│ Self-review│ Self-review
    │ Mark done  │ Mark done  │ Mark done
    │            │            │
    └────────────┴────────────┴────────────┘
                 ↓
         All tasks complete
                 ↓
    BatchExecutor verifies and reports
```

### CoderAgent Workflow (per task)

1. **Load Context** (ContextScout if needed)
2. **Load Reference Files** (study existing patterns)
3. **Check External Packages** (ExternalScout if needed)
4. **Update Status** to `in_progress`
5. **Implement Deliverables** (following standards)
6. **Self-Review Loop**:
   - Type & import validation
   - Anti-pattern scan
   - Acceptance criteria check
   - External library verification
7. **Mark Complete** via task-cli.ts
8. **Report Completion** to BatchExecutor

### Outputs

- Implemented deliverables for all tasks in batch
- Updated task status (all marked complete)
- Self-review reports
- Batch completion summary

### Transition Criteria

- All tasks in batch completed
- Deliverables verified
- No failures or blocking issues
- Ready for next batch or integration

---

## Stage 7: Integration & Validation

**Goal**: Integrate components and validate system works as a whole

**Primary Agent**: OpenCoder (orchestrator)

**Supporting Agents**: CoderAgent (for integration code), TestEngineer (for validation)

### Process

1. **Integrate Components**
   - Wire components together
   - Implement integration points
   - Connect to contracts

2. **Run Integration Tests**
   - Test component interactions
   - Validate data flow
   - Check error handling

3. **Validate Against Requirements**
   - Verify acceptance criteria
   - Test user journeys
   - Confirm feature completeness

4. **Fix Integration Issues**
   - Debug failures
   - Resolve conflicts
   - Refine interfaces if needed

### Outputs

- Integrated system
- Integration test results
- Validation report
- Issue resolution log

### Transition Criteria

- All components integrated
- Integration tests passing
- Acceptance criteria met
- System validated end-to-end

---

## Stage 8: Release & Learning

**Goal**: Deploy to production and capture insights for future iterations

**Primary Agent**: OpenCoder (orchestrator)

### Process

1. **Prepare Release**
   - Final validation
   - Documentation review
   - Deployment checklist

2. **Deploy**
   - Execute deployment
   - Monitor for issues
   - Verify production health

3. **Capture Insights**
   - Document what worked well
   - Identify improvement areas
   - Record technical decisions
   - Update patterns and standards

4. **Plan Next Iteration**
   - Review backlog
   - Prioritize next features
   - Apply learnings

### Outputs

- Deployed feature
- Release notes
- Lessons learned document
- Updated standards/patterns

### Transition Criteria

- Feature deployed successfully
- Production validated
- Insights documented
- Team aligned on learnings

---

## Agent Responsibilities

### OpenCoder (Orchestrator)

**Stages**: All (primary orchestrator)

**Responsibilities**:
- Overall workflow coordination
- Stage transitions
- Decision making
- Progress tracking
- Issue resolution

### TaskManager

**Stages**: Stage 4 (Enhanced Task Breakdown)

**Responsibilities**:
- Feature decomposition
- Task JSON generation
- Dependency mapping
- Parallel batch identification
- Task validation

### BatchExecutor

**Stages**: Stage 6 (Parallel Execution)

**Responsibilities**:
- Parallel batch coordination
- Simultaneous task delegation
- Completion monitoring
- Batch status reporting

### CoderAgent

**Stages**: Stage 5 (Contract Definition), Stage 6 (Parallel Execution), Stage 7 (Integration)

**Responsibilities**:
- Code implementation
- Self-review execution
- Deliverable creation
- Task completion marking

### ContextScout

**Stages**: All (supporting)

**Responsibilities**:
- Context discovery
- Standards retrieval
- Pattern identification
- Documentation finding

### ExternalScout

**Stages**: Stage 4, Stage 6 (supporting)

**Responsibilities**:
- External library documentation
- API reference retrieval
- Integration pattern discovery

---

## Integration with Existing System

### Task Management Integration

**Location**: `.tmp/tasks/{feature}/`

**Files**:
- `task.json` — Feature metadata
- `subtask_NN.json` — Individual task definitions

**CLI**: `.opencode/skill/task-management/scripts/task-cli.ts`

**Commands**:
- `status [feature]` — Check task status
- `next [feature]` — Get next eligible task
- `parallel [feature]` — Show parallel-ready tasks
- `complete {feature} {seq} "summary"` — Mark task complete
- `validate [feature]` — Validate task JSON

### Session Management Integration

**Location**: `.tmp/sessions/{timestamp}-{feature}/`

**Files**:
- `context.md` — Session context bundle
- `progress.md` — Progress tracking

**Usage**: Context bundles passed to delegated agents

### Context System Integration

**Standards Location**: `.opencode/context/core/standards/`

**Workflows Location**: `.opencode/context/core/workflows/`

**Usage**: Referenced in task `context_files` arrays

### Agent Configuration Integration

**Location**: the `task-manager` and `batch-executor` agents (OpenCode v2: `.opencode/agent/<id>.md`; v1: `.opencode/agent/core/`)

**Files**:
- `task-manager.md` — TaskManager configuration
- `batch-executor.md` — BatchExecutor configuration
- `coder-agent.md` — CoderAgent configuration

---

## Workflow Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                         ORCHESTRATION FLOW                           │
└─────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────┐
│ Stage 1: Architecture Decomposition                                  │
│ Agent: OpenCoder + ContextScout                                      │
│ Output: Component boundaries, integration points                     │
└──────────────────────────────────────────────────────────────────────┘
                              ↓
┌──────────────────────────────────────────────────────────────────────┐
│ Stage 2: Story Mapping                                               │
│ Agent: OpenCoder                                                     │
│ Output: User journeys, story backlog                                 │
└──────────────────────────────────────────────────────────────────────┘
                              ↓
┌──────────────────────────────────────────────────────────────────────┐
│ Stage 3: Prioritization                                              │
│ Agent: OpenCoder                                                     │
│ Output: Sequenced work, dependency graph, execution plan             │
└──────────────────────────────────────────────────────────────────────┘
                              ↓
┌──────────────────────────────────────────────────────────────────────┐
│ Stage 4: Enhanced Task Breakdown                                     │
│ Agent: TaskManager + ContextScout + ExternalScout                   │
│ Output: task.json, subtask_NN.json files, parallel batches          │
└──────────────────────────────────────────────────────────────────────┘
                              ↓
┌──────────────────────────────────────────────────────────────────────┐
│ Stage 5: Contract Definition                                         │
│ Agent: OpenCoder + CoderAgent                                        │
│ Output: TypeScript interfaces, API contracts, schemas                │
└──────────────────────────────────────────────────────────────────────┘
                              ↓
┌──────────────────────────────────────────────────────────────────────┐
│ Stage 6: Parallel Execution                                          │
│ Agent: BatchExecutor → CoderAgent (multiple simultaneous)            │
│                                                                       │
│  Batch 1: [Task 01, 02, 03] ──→ Execute in parallel                 │
│           ↓                                                           │
│  Batch 2: [Task 04, 05] ──→ Execute in parallel                     │
│           ↓                                                           │
│  Batch 3: [Task 06] ──→ Execute sequentially                        │
│                                                                       │
│ Output: Implemented deliverables, completed tasks                    │
└──────────────────────────────────────────────────────────────────────┘
                              ↓
┌──────────────────────────────────────────────────────────────────────┐
│ Stage 7: Integration & Validation                                    │
│ Agent: OpenCoder + CoderAgent + TestEngineer                        │
│ Output: Integrated system, test results, validation report           │
└──────────────────────────────────────────────────────────────────────┘
                              ↓
┌──────────────────────────────────────────────────────────────────────┐
│ Stage 8: Release & Learning                                          │
│ Agent: OpenCoder                                                     │
│ Output: Deployed feature, insights, updated standards                │
└──────────────────────────────────────────────────────────────────────┘
```

---

## Example: Authentication System

### Stage 1: Architecture Decomposition

**Components Identified**:
- User Service (user management)
- Auth Service (authentication logic)
- Token Service (JWT handling)
- Middleware (request validation)
- Database Layer (user storage)

**Integration Points**:
- Auth Service ↔ User Service (user lookup)
- Auth Service ↔ Token Service (token generation)
- Middleware ↔ Token Service (token validation)

### Stage 2: Story Mapping

**User Stories**:
1. As a user, I want to register an account
2. As a user, I want to log in with email/password
3. As a user, I want to reset my password
4. As a user, I want to stay logged in (refresh tokens)
5. As an admin, I want to manage user roles

### Stage 3: Prioritization

**Phase 1** (Must-have):
- Story 1: Registration
- Story 2: Login

**Phase 2** (Should-have):
- Story 4: Refresh tokens
- Story 3: Password reset

**Phase 3** (Nice-to-have):
- Story 5: Role management

### Stage 4: Enhanced Task Breakdown

**Batch 1** (Parallel):
- Task 01: Setup project structure
- Task 02: Configure database schema
- Task 03: Install dependencies

**Batch 2** (Parallel):
- Task 04: Implement User Service
- Task 05: Implement Token Service

**Batch 3** (Sequential):
- Task 06: Implement Auth Service (depends on 04, 05)

**Batch 4** (Parallel):
- Task 07: Create registration endpoint
- Task 08: Create login endpoint

**Batch 5** (Sequential):
- Task 09: Integration tests (depends on all)

### Stage 5: Contract Definition

```typescript
// contracts/auth-service.ts
export interface AuthService {
  register(data: RegisterData): Promise<AuthResult>;
  login(credentials: LoginCredentials): Promise<AuthResult>;
  refreshToken(token: string): Promise<AuthResult>;
}

export interface AuthResult {
  success: boolean;
  user?: User;
  accessToken?: string;
  refreshToken?: string;
  error?: string;
}
```

### Stage 6: Parallel Execution

**Batch 1 Execution**:
- BatchExecutor delegates tasks 01, 02, 03 to three CoderAgents
- All execute simultaneously
- All complete and mark status
- BatchExecutor verifies and reports

**Batch 2 Execution**:
- BatchExecutor delegates tasks 04, 05 to two CoderAgents
- Both execute simultaneously
- Both complete and mark status
- BatchExecutor verifies and reports

### Stage 7: Integration & Validation

- Wire Auth Service to User Service and Token Service
- Test registration flow end-to-end
- Test login flow end-to-end
- Validate error handling
- Confirm all acceptance criteria met

### Stage 8: Release & Learning

- Deploy to production
- Monitor authentication metrics
- Document JWT implementation decisions
- Update security patterns based on learnings

---

## Best Practices

### Planning Phase (Stages 1-4)

- **Invest time upfront**: Thorough planning prevents rework
- **Involve stakeholders**: Validate assumptions early
- **Document decisions**: Capture rationale for future reference
- **Identify risks early**: Address unknowns before implementation

### Execution Phase (Stages 5-6)

- **Define contracts first**: Prevents integration issues
- **Maximize parallelization**: Execute independent work simultaneously
- **Monitor progress**: Track batch completion actively
- **Fail fast**: Detect and address issues immediately

### Validation Phase (Stage 7)

- **Test continuously**: Don't wait until the end
- **Validate against requirements**: Ensure acceptance criteria met
- **Test integration points**: Focus on component interactions
- **Document issues**: Track and resolve systematically

### Learning Phase (Stage 8)

- **Capture insights immediately**: Don't wait for retrospectives
- **Update standards**: Apply learnings to improve future work
- **Share knowledge**: Document for team benefit
- **Iterate**: Use insights to improve next iteration

---

## Common Patterns

### Pattern 1: Foundation → Features → Integration

1. Setup infrastructure (database, auth, logging)
2. Build core features in parallel
3. Integrate and validate

### Pattern 2: Vertical Slices

1. Implement one complete user journey
2. Validate end-to-end
3. Repeat for next journey

### Pattern 3: Contract-First Development

1. Define all interfaces upfront
2. Implement components independently
3. Integration is straightforward

---

## Troubleshooting

### Issue: Tasks blocked by dependencies

**Solution**: Review dependency graph, identify if dependencies can be removed or if contracts can enable parallel work

### Issue: Integration failures

**Solution**: Verify contracts were followed, check for interface mismatches, validate data flow

### Issue: Batch execution delays

**Solution**: Check for hidden dependencies, verify tasks are truly independent, consider splitting into smaller batches

### Issue: Acceptance criteria unclear

**Solution**: Refine criteria in planning stage, involve stakeholders, make criteria binary (pass/fail)

---

## Summary

The Multi-Stage Orchestration Workflow provides a systematic approach to complex feature development:

1. **Decompose** the system into manageable components
2. **Map** user journeys and create stories
3. **Prioritize** work based on value and risk
4. **Break down** into atomic, executable tasks
5. **Define** integration contracts upfront
6. **Execute** independent work in parallel
7. **Integrate** and validate continuously
8. **Release** and capture learnings

By following this workflow, teams can:
- Reduce complexity through systematic decomposition
- Maximize throughput via parallel execution
- Minimize integration issues through contract-first development
- Improve continuously through structured learning

**Key Success Factors**:
- Thorough planning before execution
- Clear contracts and interfaces
- Effective parallel coordination
- Continuous validation
- Systematic learning capture
