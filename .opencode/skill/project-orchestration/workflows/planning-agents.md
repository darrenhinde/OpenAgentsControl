# Planning Agents Guide

> **Purpose**: Comprehensive guide to the planning agent ecosystem — when to use each agent, how they integrate, and best practices for DDD, story mapping, prioritization, contract testing, and ADRs.

---

## Overview

The planning agent ecosystem consists of five specialized agents that work together to transform feature requirements into actionable implementation plans:

1. **ArchitectureAnalyzer** — DDD-driven architecture analysis
2. **StoryMapper** — User journey mapping and story decomposition
3. **PrioritizationEngine** — RICE/WSJF scoring and MVP identification
4. **ContractManager** — API contract definition for parallel development
5. **ADRManager** — Architecture decision record management

**Key Principle**: Each agent is context-aware and ALWAYS calls ContextScout before executing to ensure alignment with project standards.

---

## Quick Decision Tree

```
Feature Request
    │
    ├─ Complex domain logic? ──YES──> ArchitectureAnalyzer
    │                          NO
    │                          ↓
    ├─ User journey unclear? ──YES──> StoryMapper
    │                          NO
    │                          ↓
    ├─ Need prioritization? ──YES──> PrioritizationEngine
    │                          NO
    │                          ↓
    ├─ Parallel dev needed? ──YES──> ContractManager
    │                          NO
    │                          ↓
    └─ Architectural decision? ─YES──> ADRManager
```

---

## 1. ArchitectureAnalyzer

### When to Use

**Use ArchitectureAnalyzer when:**
- Feature spans multiple domains or business capabilities
- Need to identify bounded contexts before task breakdown
- Complex domain logic requires aggregate/entity modeling
- Module boundaries are unclear or need formalization
- Feature involves cross-context integration
- Need to establish architectural constraints before implementation

**Do NOT use when:**
- Feature is purely technical (no domain logic)
- Single, well-defined module with clear boundaries
- Simple CRUD operations with no complex domain rules
- Architecture is already well-defined and documented

### Input Format

```javascript
subagent(
  agent="architecture-analyzer",
  description="Analyze architecture for {feature}",
  prompt="Analyze domain structure for {feature}.
         Requirements: {requirements}
         Identify bounded contexts, aggregates, and relationships."
)
```

**Required Context**:
- Feature description and objectives
- Business requirements and use cases
- Existing codebase context (if available)

### Output Format

**Primary Output**: `.tmp/tasks/{feature}/contexts.json`

```json
{
  "feature": "order-management",
  "analyzed_at": "2026-02-14T00:00:00Z",
  "bounded_contexts": [
    {
      "name": "order-management",
      "type": "core",
      "description": "Manages order lifecycle",
      "module": "src/order",
      "aggregates": [
        {
          "name": "Order",
          "root": "Order",
          "entities": ["Order", "LineItem"],
          "value_objects": ["OrderStatus", "Money"],
          "invariants": ["Order must have at least one line item"]
        }
      ],
      "domain_events": [
        {
          "name": "OrderPlaced",
          "description": "Order was successfully placed",
          "payload": ["orderId", "customerId", "total"]
        }
      ],
      "capabilities": ["Create order", "Modify order", "Cancel order"]
    }
  ],
  "context_relationships": [
    {
      "upstream": "inventory",
      "downstream": "order-management",
      "relationship_type": "customer-supplier",
      "integration_pattern": "events",
      "description": "Order reserves inventory via StockReserved event"
    }
  ],
  "ubiquitous_language": {
    "Order": "Customer purchase request with line items",
    "LineItem": "Product and quantity within an order"
  }
}
```

**Secondary Output**: `.tmp/tasks/{feature}/module-briefs/{context-name}.md`

Module briefs provide implementation guidance for each bounded context.

### Integration Patterns

**With TaskManager**:
```
ArchitectureAnalyzer → contexts.json → TaskManager
```
TaskManager uses bounded contexts to create subtasks aligned with domain boundaries.

**With StoryMapper**:
```
ArchitectureAnalyzer → bounded contexts → StoryMapper
```
StoryMapper maps user stories to bounded contexts for service boundary alignment.

### Best Practices

✅ **DDD Tactical Patterns**:
- **Aggregates**: Cluster entities with transactional boundaries
- **Entities**: Objects with unique identity
- **Value Objects**: Immutable objects without identity
- **Domain Events**: Past-tense signals of state changes
- **Domain Services**: Stateless operations coordinating aggregates

✅ **DDD Strategic Patterns**:
- **Bounded Contexts**: Explicit boundaries for domain models
- **Context Mapping**: Visual representation of relationships
- **Anti-Corruption Layer**: Translate between different models
- **Published Language**: Well-defined integration contracts

✅ **Quality Checks**:
- Each bounded context has clear ownership and boundaries
- Aggregates enforce business invariants
- Domain events are past-tense and self-contained
- Context relationships are well-defined
- No circular dependencies between contexts

### Troubleshooting

**Problem**: Too many bounded contexts identified
- **Solution**: Look for cohesive business capabilities, merge related contexts

**Problem**: Unclear context boundaries
- **Solution**: Focus on data ownership and transactional boundaries

**Problem**: Circular dependencies between contexts
- **Solution**: Introduce events or anti-corruption layers to break cycles

### Related Files

- Agent definition: `.opencode/agent/subagents/planning/architecture-analyzer.md`
- DDD patterns: Discovered via ContextScout
- Task schema: `.opencode/context/core/task-management/standards/enhanced-task-schema.md`

---

## 2. StoryMapper

### When to Use

**Use StoryMapper when:**
- Need to transform user requirements into actionable stories
- User journeys are unclear or need formalization
- Need to identify vertical slices for implementation
- Breaking down epics into user stories
- Mapping stories to bounded contexts
- Identifying parallel vs. sequential story dependencies

**Do NOT use when:**
- Requirements are already broken into well-defined stories
- No user-facing features (pure infrastructure work)
- Stories are already mapped to bounded contexts

### Input Format

```javascript
subagent(
  agent="story-mapper",
  description="Map user journeys for {feature}",
  prompt="Transform user requirements into user journeys, epics, and stories for {feature}.
         Requirements: {requirements}
         Map stories to bounded contexts from ArchitectureAnalyzer."
)
```

**Required Context**:
- User requirements and personas
- Bounded context definitions (from ArchitectureAnalyzer, if available)
- Existing user journey maps (if available)

### Output Format

**Primary Output**: `.tmp/planning/{feature}/map.json`

```json
{
  "feature": "user-authentication",
  "created_at": "2026-02-14T00:00:00Z",
  "personas": [
    {
      "id": "end-customer",
      "name": "End Customer",
      "role": "Regular user",
      "goals": ["Access account", "Secure data"],
      "pain_points": ["Forgotten passwords", "Complex login"],
      "technical_level": "low",
      "primary_use_cases": ["login", "registration"]
    }
  ],
  "journeys": [
    {
      "id": "user-login",
      "name": "User Login Flow",
      "persona": "end-customer",
      "steps": [
        {
          "id": "step-1",
          "action": "Enter email and password",
          "touchpoint": "Login form",
          "validation": ["Email format", "Password presence"]
        }
      ],
      "success_criteria": ["User authenticated", "Session created"],
      "edge_cases": ["Invalid credentials", "Account locked"]
    }
  ],
  "vertical_slices": [
    {
      "id": "user-login-slice",
      "name": "User Login Slice",
      "journeys": ["user-login"],
      "bounded_contexts": ["authentication"],
      "layers": {
        "frontend": ["Login form", "Session management"],
        "backend": ["Auth API", "JWT service"],
        "database": ["User table", "Session table"],
        "external": []
      },
      "dependencies": ["user-registration-slice"],
      "estimated_effort": "1 week"
    }
  ],
  "epics": [
    {
      "id": "epic-user-auth",
      "name": "User Authentication",
      "description": "Enable secure user registration and login",
      "journeys": ["user-registration", "user-login"],
      "vertical_slices": ["user-registration-slice", "user-login-slice"],
      "bounded_contexts": ["authentication"],
      "acceptance_criteria": [
        "Users can register with email/password",
        "Users can login with credentials",
        "JWT tokens used for session management"
      ],
      "priority": "high",
      "estimated_effort": "2 weeks"
    }
  ],
  "stories": [
    {
      "id": "story-auth-001",
      "title": "User can login with email and password",
      "story": "As an end customer, I want to login with my email and password so that I can access my account",
      "epic": "epic-user-auth",
      "bounded_context": "authentication",
      "acceptance_criteria": [
        "Login form accepts email and password",
        "Email format is validated",
        "Invalid credentials show clear error",
        "Successful login creates JWT token",
        "User is redirected to dashboard"
      ],
      "dependencies": [],
      "parallel": true,
      "estimated_effort": "2 days",
      "technical_notes": "Use bcrypt for password hashing, JWT for tokens"
    }
  ],
  "bounded_context_mapping": {
    "authentication": {
      "stories": ["story-auth-001", "story-auth-002"],
      "epics": ["epic-user-auth"],
      "vertical_slices": ["user-login-slice"]
    }
  }
}
```

### Integration Patterns

**With ArchitectureAnalyzer**:
```
ArchitectureAnalyzer → bounded contexts → StoryMapper
```
StoryMapper uses bounded context definitions to map stories to service boundaries.

**With PrioritizationEngine**:
```
StoryMapper → map.json → PrioritizationEngine
```
PrioritizationEngine scores stories and identifies MVP features.

**With TaskManager**:
```
StoryMapper → map.json → TaskManager
```
TaskManager converts stories into implementation subtasks.

### Best Practices

✅ **Persona Identification**:
- Each persona has distinct goals and use cases
- All user types in requirements are represented
- No redundant or overlapping personas

✅ **Journey Mapping**:
- Each journey covers complete user flow from start to finish
- Steps are specific and actionable
- Common error scenarios are identified

✅ **Vertical Slices**:
- Each slice delivers user value independently
- Slices are small enough to implement in 1-2 weeks
- Slices respect bounded context boundaries

✅ **Story Decomposition**:
- Stories follow "As a [persona], I want [goal] so that [benefit]" format
- Stories are completable in 1-3 days
- Each story maps to exactly one bounded context
- Dependencies are explicit and non-circular

### Troubleshooting

**Problem**: Stories are too large
- **Solution**: Break into smaller stories using vertical slicing

**Problem**: Unclear bounded context mapping
- **Solution**: Call ArchitectureAnalyzer first to define contexts

**Problem**: Circular story dependencies
- **Solution**: Identify shared dependencies and extract them as separate stories

**Problem**: Stories don't deliver user value
- **Solution**: Focus on end-to-end user flows, not technical layers

### Related Files

- Agent definition: `.opencode/agent/subagents/planning/story-mapper.md`
- User journey patterns: Discovered via ContextScout
- Story format standards: Discovered via ContextScout

---

## 3. PrioritizationEngine

### When to Use

**Use PrioritizationEngine when:**
- Need to score and rank backlog items
- Identifying MVP vs. post-MVP features
- Multiple stakeholders with different priorities
- Need data-driven prioritization (not gut feel)
- Planning release roadmap
- Balancing business value vs. effort

**Do NOT use when:**
- Priorities are already clear and agreed upon
- Single feature with no alternatives
- No need for formal scoring (small backlog)

### Input Format

```javascript
subagent(
  agent="prioritization-engine",
  description="Prioritize backlog for {feature}",
  prompt="Score and prioritize backlog items for {feature} using RICE and WSJF.
         Input: {path-to-story-mapper-output}
         Identify MVP vs. post-MVP features."
)
```

**Required Context**:
- StoryMapper output (user stories with effort estimates)
- Business goals and success metrics (via ContextScout)
- User reach data and impact criteria

### Output Format

**Primary Output**: `.tmp/planning/prioritized.json`

```json
{
  "metadata": {
    "generated_at": "2026-02-14T00:00:00Z",
    "source": "StoryMapper output",
    "frameworks": ["RICE", "WSJF"],
    "total_items": 15,
    "mvp_count": 5,
    "post_mvp_count": 10
  },
  "scoring_criteria": {
    "rice": {
      "reach_period": "per quarter",
      "impact_scale": "0.25 (minimal) to 3.0 (massive)",
      "confidence_scale": "0-100%",
      "effort_unit": "person-months"
    },
    "wsjf": {
      "business_value_scale": "1-10",
      "time_criticality_scale": "1-10",
      "risk_reduction_scale": "1-10",
      "job_size_scale": "1-10 (inverse effort)"
    }
  },
  "mvp_features": [
    {
      "id": "story-auth-001",
      "title": "User can login with email and password",
      "epic": "User Authentication",
      "rice_score": {
        "reach": 50000,
        "impact": 3.0,
        "confidence": 90,
        "effort": 0.1,
        "score": 1350000,
        "justification": {
          "reach": "All users need login capability",
          "impact": "Core value proposition, critical feature",
          "confidence": "Industry standard, well-understood",
          "effort": "2 days = 0.1 person-months"
        }
      },
      "wsjf_score": {
        "business_value": 10,
        "time_criticality": 10,
        "risk_reduction": 8,
        "job_size": 9,
        "score": 3.1,
        "justification": {
          "business_value": "Critical for product launch",
          "time_criticality": "Blocker for all other features",
          "risk_reduction": "Enables secure access",
          "job_size": "2 days = tiny effort"
        }
      },
      "combined_rank": 1,
      "mvp_reason": "Core value proposition, dependency blocker",
      "estimated_effort": "2 days",
      "dependencies": []
    }
  ],
  "post_mvp_features": [...],
  "release_recommendations": {
    "mvp_timeline": "3 weeks",
    "mvp_scope": "Core authentication and user management",
    "post_mvp_phases": [
      {
        "phase": "Phase 2",
        "timeline": "2 weeks",
        "features": ["story-auth-010", "story-auth-011"],
        "theme": "Advanced authentication (OAuth, 2FA)"
      }
    ]
  }
}
```

### Integration Patterns

**With StoryMapper**:
```
StoryMapper → map.json → PrioritizationEngine
```
PrioritizationEngine scores stories from StoryMapper output.

**With TaskManager**:
```
PrioritizationEngine → prioritized.json → TaskManager
```
TaskManager creates subtasks for MVP features first.

### Best Practices

✅ **RICE Scoring**:
- **Reach**: Number of users affected per quarter
- **Impact**: 0.25 (minimal) to 3.0 (massive) scale
- **Confidence**: 0-100% based on data quality
- **Effort**: Person-months (convert story points/days)
- **Formula**: (Reach × Impact × Confidence%) / Effort

✅ **WSJF Scoring**:
- **Business Value**: 1-10 scale (revenue, retention, acquisition)
- **Time Criticality**: 1-10 scale (deadlines, competitive pressure)
- **Risk Reduction**: 1-10 scale (security, tech debt, enablement)
- **Job Size**: 1-10 scale (inverse effort — smaller is higher)
- **Formula**: (Business Value + Time Criticality + Risk Reduction) / Job Size

✅ **MVP Identification**:
- Core value proposition features
- Dependency blockers
- Compliance requirements
- Top 20% in both RICE and WSJF

✅ **Score Justification**:
- Every score includes reasoning
- Data sources cited where available
- Assumptions documented

### Troubleshooting

**Problem**: Missing effort estimates
- **Solution**: Flag stories for engineering review, don't guess

**Problem**: Unclear business goals
- **Solution**: Call ContextScout for business context

**Problem**: Conflicting RICE vs. WSJF priorities
- **Solution**: Document both perspectives, recommend stakeholder review

**Problem**: MVP set too large
- **Solution**: Apply stricter criteria, focus on core value proposition

### Related Files

- Agent definition: `.opencode/agent/subagents/planning/prioritization-engine.md`
- Business goals: Discovered via ContextScout
- Prioritization frameworks: RICE (Intercom), WSJF (SAFe)

---

## 4. ContractManager

### When to Use

**Use ContractManager when:**
- Need to enable parallel frontend/backend development
- Defining API contracts before implementation
- Multiple teams consuming the same API
- Need contract testing to prevent integration failures
- Establishing service boundaries
- Versioning and evolving APIs

**Do NOT use when:**
- No API integration (pure frontend or backend work)
- Single developer working on full stack
- Prototype/throwaway code
- APIs are already well-defined and documented

### Input Format

```javascript
subagent(
  agent="contract-manager",
  description="Define API contracts for {service}",
  prompt="Create API contracts for {service} to enable parallel development.
         Bounded contexts: {contexts-from-architecture-analyzer}
         Define OpenAPI specs, consumer/provider relationships, and testing strategy."
)
```

**Required Context**:
- Bounded context definitions (from ArchitectureAnalyzer)
- API design patterns and standards (via ContextScout)
- Security requirements (authentication, authorization)
- Existing API contracts (if available)

### Output Format

**Primary Output**: `.tmp/contracts/{bounded-context}/{service-name}/contract.json`

```json
{
  "contract_id": "auth-api",
  "version": "1.0.0",
  "bounded_context": "authentication",
  "service_name": "auth-service",
  "description": "Authentication API for user login and registration",
  "openapi_spec_path": "contract.openapi.yaml",
  "consumers": [
    {
      "name": "web-frontend",
      "type": "spa",
      "endpoints_used": ["/auth/login", "/auth/register"],
      "authentication": "JWT"
    }
  ],
  "providers": [
    {
      "name": "auth-backend",
      "type": "rest-api",
      "implementation_path": "src/api/auth",
      "technology": "Node.js/Express"
    }
  ],
  "testing_strategy": {
    "approach": "consumer-driven",
    "framework": "pact",
    "consumer_tests": [
      {
        "consumer": "web-frontend",
        "test_path": "tests/contracts/auth-api.pact.spec.ts",
        "scenarios": ["Login success", "Login failure", "Register success"]
      }
    ],
    "provider_verification": {
      "provider": "auth-backend",
      "verification_path": "tests/contracts/verify-pacts.spec.ts",
      "run_on": "pre-commit, CI/CD"
    }
  },
  "mock_server": {
    "enabled": true,
    "tool": "prism",
    "command": "prism mock contract.openapi.yaml",
    "port": 4010,
    "purpose": "Enable frontend development before backend implementation"
  },
  "versioning": {
    "scheme": "semantic",
    "current_version": "1.0.0",
    "breaking_change_policy": "new major version required",
    "deprecation_policy": "6 months notice, support N-1 versions",
    "version_in_url": true
  },
  "created_at": "2026-02-14T00:00:00Z"
}
```

**Secondary Output**: `.tmp/contracts/{bounded-context}/{service-name}/contract.openapi.yaml`

Full OpenAPI 3.0+ specification with endpoints, schemas, security definitions.

### Integration Patterns

**With ArchitectureAnalyzer**:
```
ArchitectureAnalyzer → bounded contexts → ContractManager
```
ContractManager aligns API contracts with domain boundaries.

**With TaskManager**:
```
ContractManager → contracts → TaskManager
```
TaskManager creates parallel frontend/backend subtasks using contracts.

### Best Practices

✅ **OpenAPI 3.0+ Compliance**:
- All endpoints documented with request/response schemas
- Security schemes defined (JWT, OAuth, API keys)
- Error responses standardized (400, 401, 403, 404, 500)
- Example requests/responses provided

✅ **Consumer-Driven Contracts**:
- Let consumer needs drive API design
- Consumer tests define expectations
- Provider verification ensures compliance

✅ **Parallel Development Enablement**:
- Mock servers for frontend development
- Contract tests for backend verification
- Clear consumer/provider responsibilities

✅ **Versioning Strategy**:
- Semantic versioning (major.minor.patch)
- Breaking changes require new major version
- Deprecation policy with migration guides

### Troubleshooting

**Problem**: Unclear service boundaries
- **Solution**: Call ArchitectureAnalyzer to define bounded contexts first

**Problem**: Contract tests failing
- **Solution**: Verify OpenAPI spec matches implementation, check consumer expectations

**Problem**: Breaking changes needed
- **Solution**: Create new major version, provide migration guide, support N-1 versions

**Problem**: Mock server not matching real API
- **Solution**: Ensure OpenAPI spec is source of truth, update spec when API changes

### Related Files

- Agent definition: `.opencode/agent/subagents/planning/contract-manager.md`
- API design patterns: Discovered via ContextScout
- OpenAPI specification: https://spec.openapis.org/oas/v3.0.3
- Contract testing: Pact (https://docs.pact.io/)

---

## 5. ADRManager

### When to Use

**Use ADRManager when:**
- Making significant architectural decisions
- Choosing between technology alternatives
- Establishing design patterns or conventions
- Need to document decision rationale for future reference
- Decision affects multiple teams or modules
- Need to track decision evolution over time

**Do NOT use when:**
- Trivial implementation details
- Decisions already documented
- No alternatives considered (obvious choice)
- Temporary/experimental code

### Input Format

```javascript
subagent(
  agent="adr-manager",
  description="Document decision for {topic}",
  prompt="Create ADR for {decision topic}.
         Context: {problem statement}
         Alternatives: {options considered}
         Decision: {chosen approach}
         Document rationale and consequences."
)
```

**Required Context**:
- ADR formatting standards (via ContextScout)
- Architectural patterns and conventions
- Related decisions (existing ADRs)
- Bounded contexts affected

### Output Format

**Primary Output**: `docs/adr/{seq}-{kebab-case-title}.md`

```markdown
# 003. Use JWT for Stateless Authentication

**Status**: accepted

**Date**: 2026-02-14

**Context**: authentication | **Module**: @app/auth

**Related Tasks**: multi-stage-orchestration-workflow-05

**Related ADRs**: None

---

## Context

We need a stateless authentication mechanism that:
- Scales horizontally without session storage
- Works across multiple services (microservices architecture)
- Supports mobile and web clients
- Provides secure token-based authentication

## Decision

We will use JWT (JSON Web Tokens) with RS256 signing for stateless authentication:
- Access tokens: 15-minute expiry
- Refresh tokens: 7-day expiry
- RS256 algorithm (asymmetric signing)
- Token payload includes: userId, roles, permissions

## Alternatives Considered

### Option 1: Session-based authentication
- **Pros**: Simple, well-understood, easy to revoke
- **Cons**: Requires session storage (Redis), doesn't scale horizontally, not suitable for microservices
- **Why rejected**: Doesn't meet scalability requirements for microservices architecture

### Option 2: OAuth 2.0 with external provider
- **Pros**: Industry standard, offloads auth complexity, supports SSO
- **Cons**: Vendor lock-in, requires internet connectivity, adds latency
- **Why rejected**: Adds unnecessary complexity for internal authentication, vendor dependency

### Option 3: JWT with HS256 (symmetric signing)
- **Pros**: Simpler than RS256, faster signing/verification
- **Cons**: Shared secret across services, harder to rotate keys, less secure
- **Why rejected**: Security concerns with shared secrets in microservices

## Consequences

### Positive
- Stateless authentication enables horizontal scaling
- No session storage required (reduces infrastructure complexity)
- Works seamlessly across microservices
- Mobile and web clients use same authentication mechanism
- Token payload reduces database lookups for user info

### Negative
- Cannot revoke tokens before expiry (mitigated by short access token lifetime)
- Token size larger than session IDs (network overhead)
- Requires key management for RS256 (public/private key pairs)
- Clock synchronization required across services for expiry validation

## Implementation Notes

- Use `jsonwebtoken` library for Node.js
- Store private key in secure vault (not in code)
- Implement token refresh endpoint
- Add token blacklist for logout (Redis with TTL)
- Monitor token expiry and refresh patterns
```

### Integration Patterns

**With ArchitectureAnalyzer**:
```
ArchitectureAnalyzer → bounded contexts → ADRManager
```
ADRs specify which bounded contexts are affected by decisions.

**With TaskManager**:
```
ADRManager → ADRs → TaskManager
```
Tasks reference ADRs for implementation constraints.

### Best Practices

✅ **Lightweight Format**:
- 5 sections: Title, Status, Context, Decision, Consequences
- Scannable in <2 minutes
- Bullet points over paragraphs

✅ **Alternatives Required**:
- Document at least 2 alternatives
- Explain pros/cons of each
- Justify why rejected

✅ **Status Lifecycle**:
- **proposed**: Under consideration
- **accepted**: Approved and active
- **deprecated**: No longer recommended
- **superseded**: Replaced by newer ADR

✅ **Linking**:
- Link to related tasks
- Reference bounded contexts
- Cross-reference related ADRs

### Troubleshooting

**Problem**: ADR too verbose
- **Solution**: Use lightweight format, bullet points only, <2 minute read

**Problem**: No alternatives documented
- **Solution**: Document why other options weren't viable, even if obvious

**Problem**: Unclear which bounded contexts affected
- **Solution**: Reference ArchitectureAnalyzer output for context boundaries

**Problem**: ADR status unclear
- **Solution**: Use explicit status (proposed/accepted/deprecated/superseded)

### Related Files

- Agent definition: `.opencode/agent/subagents/planning/adr-manager.md`
- ADR format standards: Discovered via ContextScout
- ADR examples: `docs/adr/` directory
- Lightweight ADR format: https://adr.github.io/

---

## Integration Workflows

### Workflow 1: Complex Feature with DDD

```
1. ArchitectureAnalyzer
   ↓ contexts.json
2. StoryMapper (uses bounded contexts)
   ↓ map.json
3. PrioritizationEngine (scores stories)
   ↓ prioritized.json
4. ContractManager (defines API contracts per context)
   ↓ contracts/
5. ADRManager (documents key decisions)
   ↓ docs/adr/
6. TaskManager (creates subtasks using all outputs)
```

### Workflow 2: Simple Feature (No DDD)

```
1. StoryMapper (user journeys and stories)
   ↓ map.json
2. PrioritizationEngine (MVP identification)
   ↓ prioritized.json
3. TaskManager (creates subtasks)
```

### Workflow 3: API-First Development

```
1. ArchitectureAnalyzer (bounded contexts)
   ↓ contexts.json
2. ContractManager (API contracts)
   ↓ contracts/
3. TaskManager (parallel frontend/backend tasks)
```

### Workflow 4: Architecture Decision

```
1. ADRManager (document decision)
   ↓ docs/adr/
2. TaskManager (implementation tasks referencing ADR)
```

---

## Common Patterns

### Pattern 1: Context-First Planning

**All agents ALWAYS call ContextScout first**:

```javascript
// Before any planning work
subagent(
  agent="contextscout",
  description="Find context for {agent-task}",
  prompt="Find {standards/patterns/conventions} for {agent-task}.
         I need to understand {specific-requirements}."
)
```

**Why**: Ensures consistency with project standards, avoids reinventing patterns.

### Pattern 2: Bounded Context Alignment

**ArchitectureAnalyzer → StoryMapper → ContractManager**:

1. ArchitectureAnalyzer defines bounded contexts
2. StoryMapper maps stories to contexts
3. ContractManager creates contracts per context
4. TaskManager creates subtasks aligned with contexts

**Why**: Service boundaries match domain boundaries, reduces coupling.

### Pattern 3: Parallel Development Enablement

**ContractManager enables frontend/backend parallelization**:

1. Define API contract (OpenAPI spec)
2. Start mock server for frontend
3. Frontend develops against mock
4. Backend implements contract
5. Contract tests verify compliance

**Why**: Teams work independently, integration verified by tests.

### Pattern 4: Decision Documentation

**ADRManager captures architectural decisions**:

1. Identify decision point
2. Document context and alternatives
3. Record decision and rationale
4. Analyze consequences
5. Link to tasks and contexts

**Why**: Future developers understand why decisions were made.

---

## Troubleshooting Guide

### Issue: Planning agents producing inconsistent outputs

**Symptoms**:
- Different naming conventions
- Conflicting architectural patterns
- Misaligned bounded contexts

**Root Cause**: Agents not calling ContextScout

**Solution**:
1. Verify each agent calls ContextScout before execution
2. Load project standards and conventions
3. Apply standards consistently across all outputs

### Issue: Stories don't align with bounded contexts

**Symptoms**:
- Stories span multiple contexts
- Unclear service boundaries
- Cross-context dependencies everywhere

**Root Cause**: StoryMapper executed before ArchitectureAnalyzer

**Solution**:
1. Run ArchitectureAnalyzer first to define contexts
2. Pass contexts.json to StoryMapper
3. Map each story to exactly one bounded context

### Issue: Contract tests failing after implementation

**Symptoms**:
- Provider verification fails
- Mock server doesn't match real API
- Consumer expectations not met

**Root Cause**: OpenAPI spec not kept in sync with implementation

**Solution**:
1. Make OpenAPI spec the source of truth
2. Update spec when API changes
3. Run contract tests in CI/CD
4. Use spec to generate mock server

### Issue: ADRs not being referenced in tasks

**Symptoms**:
- Implementation doesn't follow ADR decisions
- Decisions being re-litigated
- Inconsistent patterns across codebase

**Root Cause**: Tasks not linking to ADRs

**Solution**:
1. ADRManager outputs ADR paths
2. TaskManager includes ADR references in subtasks
3. CoderAgent reads ADRs before implementation

### Issue: MVP scope too large

**Symptoms**:
- MVP timeline exceeds target
- Too many features marked as MVP
- Unclear what's truly minimum

**Root Cause**: PrioritizationEngine not applying strict MVP criteria

**Solution**:
1. Focus on core value proposition only
2. Apply stricter scoring thresholds
3. Identify dependency blockers explicitly
4. Validate MVP delivers coherent user experience

---

## Best Practices Summary

### ✅ Always Do

1. **Call ContextScout first** — every agent, every time
2. **Document alternatives** — decisions without options lack justification
3. **Align with bounded contexts** — service boundaries match domain boundaries
4. **Use OpenAPI 3.0+** — industry standard for API contracts
5. **Score with both RICE and WSJF** — different stakeholder perspectives
6. **Link outputs** — ADRs to tasks, stories to contexts, contracts to contexts
7. **Validate outputs** — check for consistency, completeness, correctness

### ❌ Never Do

1. **Skip ContextScout** — leads to inconsistent outputs
2. **Ignore bounded contexts** — creates coupling and unclear boundaries
3. **Omit alternatives in ADRs** — decisions lack justification
4. **Skip contract testing** — integration failures at deployment
5. **Guess effort estimates** — flag for engineering review instead
6. **Create orphan outputs** — always link to tasks and contexts
7. **Use custom formats** — stick to OpenAPI, lightweight ADR, standard schemas

---

## Quick Reference

| Agent | Input | Output | When to Use |
|-------|-------|--------|-------------|
| **ArchitectureAnalyzer** | Feature requirements | contexts.json, module-briefs/ | Complex domain logic, unclear boundaries |
| **StoryMapper** | User requirements, contexts | map.json | User journeys unclear, need story breakdown |
| **PrioritizationEngine** | Stories, business goals | prioritized.json | Need MVP identification, backlog scoring |
| **ContractManager** | Bounded contexts, API needs | contracts/, OpenAPI specs | Parallel dev, API-first design |
| **ADRManager** | Decision context, alternatives | docs/adr/*.md | Architectural decisions, pattern choices |

---

## Related Documentation

- **ArchitectureAnalyzer**: `.opencode/agent/subagents/planning/architecture-analyzer.md`
- **StoryMapper**: `.opencode/agent/subagents/planning/story-mapper.md`
- **PrioritizationEngine**: `.opencode/agent/subagents/planning/prioritization-engine.md`
- **ContractManager**: `.opencode/agent/subagents/planning/contract-manager.md`
- **ADRManager**: `.opencode/agent/subagents/planning/adr-manager.md`
- **ContextScout**: `.opencode/agent/subagents/core/context-scout.md`
- **TaskManager**: `.opencode/agent/subagents/core/task-manager.md`

---

## Conclusion

The planning agent ecosystem provides a comprehensive, context-aware approach to transforming feature requirements into actionable implementation plans. By following the patterns and best practices in this guide, you can:

- **Align architecture with domain boundaries** (DDD via ArchitectureAnalyzer)
- **Map user needs to implementation** (Story mapping via StoryMapper)
- **Prioritize based on data** (RICE/WSJF via PrioritizationEngine)
- **Enable parallel development** (Contract-first via ContractManager)
- **Document decisions** (Lightweight ADRs via ADRManager)

**Key Principle**: Context first, execution second. Every agent calls ContextScout to ensure alignment with project standards.
