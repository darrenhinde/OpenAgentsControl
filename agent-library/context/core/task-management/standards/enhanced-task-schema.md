<!-- Context: core/enhanced-task-schema | Priority: critical | Version: 1.0 | Updated: 2026-02-15 -->

# Enhanced Task JSON Schema

**Purpose**: Extended JSON schema for multi-stage orchestration with line-number precision, domain modeling, and prioritization

**Version**: 2.0

**Last Updated**: 2026-02-14

**Backward Compatible**: Yes (all new fields are optional)

---

## Overview

This schema extends the base task.json and subtask_NN.json schemas with:
- **Line-number precision** for context and reference files
- **Domain modeling** fields (bounded_context, module, vertical_slice)
- **Contract tracking** for API/interface dependencies
- **Design artifacts** linking
- **ADR references** for architectural decisions
- **Prioritization scores** (RICE, WSJF)
- **Release planning** (release_slice)

All enhancements are **optional** and backward compatible with existing task files.

---

## Enhanced task.json Schema

### New Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `bounded_context` | string | No | DDD bounded context (e.g., "authentication", "billing") |
| `module` | string | No | Module/package name (e.g., "@app/auth", "payment-service") |
| `vertical_slice` | string | No | Feature slice identifier (e.g., "user-registration", "checkout-flow") |
| `contracts` | array | No | API/interface contracts this feature depends on or provides |
| `design_components` | array | No | Design artifacts (Figma URLs, wireframes, mockups) |
| `related_adrs` | array | No | Architecture Decision Records (ADR file paths or IDs) |
| `rice_score` | object | No | RICE prioritization (Reach, Impact, Confidence, Effort) |
| `wsjf_score` | object | No | WSJF prioritization (Business Value, Time Criticality, Risk Reduction, Job Size) |
| `release_slice` | string | No | Release identifier (e.g., "v1.2.0", "Q1-2026", "MVP") |

### Enhanced context_files and reference_files Format

**Old format** (still supported):
```json
"context_files": [
  ".opencode/context/core/standards/code-quality.md"
]
```

**New format** (line-number precision):
```json
"context_files": [
  {
    "path": ".opencode/context/core/standards/code-quality.md",
    "lines": "1-50",
    "reason": "Pure function patterns for service layer"
  },
  {
    "path": ".opencode/context/core/standards/security-patterns.md",
    "lines": "120-145",
    "reason": "JWT token validation rules"
  }
]
```

**Backward Compatibility**: Both formats are valid. Agents should handle both:
- String format → read entire file
- Object format → read specified lines only

---

## Enhanced subtask_NN.json Schema

### New Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `bounded_context` | string | No | Inherited from task.json or subtask-specific override |
| `module` | string | No | Module this subtask modifies |
| `vertical_slice` | string | No | Feature slice this subtask belongs to |
| `contracts` | array | No | Contracts this subtask implements or depends on |
| `design_components` | array | No | Design artifacts relevant to this subtask |
| `related_adrs` | array | No | ADRs relevant to this subtask |

---

## TypeScript Interfaces

```typescript
// Line-number precision for context files
interface ContextFileReference {
  path: string;           // File path (absolute or relative to project root)
  lines?: string;         // Line range: "10-50", "1-20,45-60", or omit for entire file
  reason?: string;        // Why this file/section is relevant (max 200 chars)
}

// Contract definition
interface Contract {
  type: 'api' | 'interface' | 'event' | 'schema';
  name: string;           // Contract identifier (e.g., "UserAPI", "AuthEvent")
  path?: string;          // File path where contract is defined
  status: 'draft' | 'defined' | 'implemented' | 'verified';
  description?: string;   // Brief description (max 200 chars)
}

// Design component reference
interface DesignComponent {
  type: 'figma' | 'wireframe' | 'mockup' | 'prototype' | 'sketch';
  url?: string;           // External URL (Figma, etc.)
  path?: string;          // Local file path
  description?: string;   // What this design covers (max 200 chars)
}

// ADR reference
interface ADRReference {
  id: string;             // ADR identifier (e.g., "ADR-001", "auth-strategy")
  path?: string;          // File path to ADR document
  title?: string;         // ADR title
  decision?: string;      // Brief summary of decision (max 200 chars)
}

// RICE prioritization
interface RICEScore {
  reach: number;          // How many users affected (per time period)
  impact: number;         // Impact score (0.25 = minimal, 0.5 = low, 1 = medium, 2 = high, 3 = massive)
  confidence: number;     // Confidence % (0-100)
  effort: number;         // Person-months of work
  score?: number;         // Calculated: (reach * impact * confidence) / effort
}

// WSJF prioritization
interface WSJFScore {
  business_value: number;     // 1-10 scale
  time_criticality: number;   // 1-10 scale
  risk_reduction: number;     // 1-10 scale
  job_size: number;           // 1-10 scale (effort estimate)
  score?: number;             // Calculated: (business_value + time_criticality + risk_reduction) / job_size
}

// Enhanced task.json
interface EnhancedTask {
  // Base fields (from task-schema.md)
  id: string;
  name: string;
  status: 'active' | 'completed' | 'blocked' | 'archived';
  objective: string;
  context_files?: (string | ContextFileReference)[];
  reference_files?: (string | ContextFileReference)[];
  exit_criteria?: string[];
  subtask_count?: number;
  completed_count?: number;
  created_at: string;
  completed_at?: string;

  // Enhanced fields
  bounded_context?: string;
  module?: string;
  vertical_slice?: string;
  contracts?: Contract[];
  design_components?: DesignComponent[];
  related_adrs?: ADRReference[];
  rice_score?: RICEScore;
  wsjf_score?: WSJFScore;
  release_slice?: string;
}

// Enhanced subtask_NN.json
interface EnhancedSubtask {
  // Base fields (from task-schema.md)
  id: string;
  seq: string;
  title: string;
  status: 'pending' | 'in_progress' | 'completed' | 'blocked';
  depends_on?: string[];
  parallel?: boolean;
  context_files?: (string | ContextFileReference)[];
  reference_files?: (string | ContextFileReference)[];
  suggested_agent?: string;
  acceptance_criteria?: string[];
  deliverables?: string[];
  agent_id?: string;
  started_at?: string;
  completed_at?: string;
  completion_summary?: string;

  // Enhanced fields
  bounded_context?: string;
  module?: string;
  vertical_slice?: string;
  contracts?: Contract[];
  design_components?: DesignComponent[];
  related_adrs?: ADRReference[];
}
```

---

## Field Examples

### bounded_context

**Purpose**: DDD bounded context for domain modeling

```json
{
  "bounded_context": "authentication"
}
```

Common values:
- `"authentication"` - User identity and access
- `"billing"` - Payment and invoicing
- `"inventory"` - Product and stock management
- `"notification"` - Messaging and alerts
- `"analytics"` - Reporting and insights

---

### module

**Purpose**: Module or package name for code organization

```json
{
  "module": "@app/auth"
}
```

Examples:
- `"@app/auth"` - Authentication module
- `"payment-service"` - Payment microservice
- `"ui-components"` - Shared UI library
- `"core/utils"` - Core utilities

---

### vertical_slice

**Purpose**: Feature slice identifier for vertical slice architecture

```json
{
  "vertical_slice": "user-registration"
}
```

Examples:
- `"user-registration"` - Complete user signup flow
- `"checkout-flow"` - End-to-end checkout
- `"dashboard-overview"` - Dashboard feature
- `"report-generation"` - Report creation flow

---

### contracts

**Purpose**: Track API/interface dependencies and implementations

```json
{
  "contracts": [
    {
      "type": "api",
      "name": "UserAPI",
      "path": "src/api/user.contract.ts",
      "status": "defined",
      "description": "REST API for user CRUD operations"
    },
    {
      "type": "event",
      "name": "UserCreatedEvent",
      "status": "draft",
      "description": "Event emitted when new user is created"
    }
  ]
}
```

Contract types:
- `"api"` - REST/GraphQL API endpoints
- `"interface"` - TypeScript/language interfaces
- `"event"` - Event bus messages
- `"schema"` - Database schemas, validation schemas

Contract statuses:
- `"draft"` - Being designed
- `"defined"` - Specification complete
- `"implemented"` - Code written
- `"verified"` - Tests passing

---

### design_components

**Purpose**: Link design artifacts to implementation tasks

```json
{
  "design_components": [
    {
      "type": "figma",
      "url": "https://figma.com/file/abc123/Login-Flow",
      "description": "Login page mockups with responsive breakpoints"
    },
    {
      "type": "wireframe",
      "path": "docs/design/checkout-wireframe.png",
      "description": "Checkout flow wireframe"
    }
  ]
}
```

Component types:
- `"figma"` - Figma designs
- `"wireframe"` - Low-fidelity wireframes
- `"mockup"` - High-fidelity mockups
- `"prototype"` - Interactive prototypes
- `"sketch"` - Sketch files

---

### related_adrs

**Purpose**: Reference architectural decisions that govern implementation

```json
{
  "related_adrs": [
    {
      "id": "ADR-003",
      "path": "docs/adr/003-jwt-authentication.md",
      "title": "Use JWT for stateless authentication",
      "decision": "Implement JWT with RS256 signing and 15-minute expiry"
    },
    {
      "id": "ADR-007",
      "path": "docs/adr/007-database-choice.md",
      "title": "PostgreSQL for primary database"
    }
  ]
}
```

---

### rice_score

**Purpose**: RICE prioritization framework (Reach × Impact × Confidence / Effort)

```json
{
  "rice_score": {
    "reach": 5000,
    "impact": 2,
    "confidence": 80,
    "effort": 3,
    "score": 2666.67
  }
}
```

**Calculation**: `(5000 × 2 × 0.80) / 3 = 2666.67`

Field definitions:
- `reach`: Number of users/customers affected per time period (e.g., per quarter)
- `impact`: 0.25 (minimal), 0.5 (low), 1 (medium), 2 (high), 3 (massive)
- `confidence`: Percentage (0-100) - how confident are you in reach/impact estimates?
- `effort`: Person-months of work
- `score`: Auto-calculated or manually entered

---

### wsjf_score

**Purpose**: WSJF prioritization (Weighted Shortest Job First) for SAFe/Agile

```json
{
  "wsjf_score": {
    "business_value": 8,
    "time_criticality": 6,
    "risk_reduction": 5,
    "job_size": 3,
    "score": 6.33
  }
}
```

**Calculation**: `(8 + 6 + 5) / 3 = 6.33`

Field definitions (all on 1-10 scale):
- `business_value`: Direct business impact
- `time_criticality`: How time-sensitive is this?
- `risk_reduction`: Does this reduce risk/enable other work?
- `job_size`: Effort estimate (1 = tiny, 10 = huge)
- `score`: Auto-calculated or manually entered

---

### release_slice

**Purpose**: Group tasks into releases for planning

```json
{
  "release_slice": "v1.2.0"
}
```

Examples:
- `"v1.2.0"` - Semantic version
- `"Q1-2026"` - Quarterly release
- `"MVP"` - Minimum viable product
- `"Phase-2"` - Project phase
- `"Sprint-15"` - Sprint identifier

---

## Line-Number Precision Format

### Purpose

Reduce cognitive load by pointing agents to **exact sections** of large files instead of forcing them to read entire documents.

### Format

```json
{
  "path": "path/to/file.md",
  "lines": "10-50",
  "reason": "Why these lines matter"
}
```

### Line Range Syntax

- `"10-50"` - Lines 10 through 50 (inclusive)
- `"1-20,45-60"` - Lines 1-20 AND 45-60 (multiple ranges)
- Omit `lines` field to read entire file

### Examples

**Single range**:
```json
{
  "path": ".opencode/context/core/standards/code-quality.md",
  "lines": "53-95",
  "reason": "Pure function and immutability patterns"
}
```

**Multiple ranges**:
```json
{
  "path": ".opencode/context/core/standards/security-patterns.md",
  "lines": "1-25,120-145,200-220",
  "reason": "JWT validation rules and token refresh patterns"
}
```

**Entire file** (backward compatible):
```json
{
  "path": ".opencode/context/core/standards/code-quality.md",
  "reason": "All coding standards"
}
```

**Legacy string format** (still supported):
```json
".opencode/context/core/standards/code-quality.md"
```

---

## Backward Compatibility Rules

### Rule 1: All new fields are optional

Existing task.json and subtask_NN.json files remain valid without any changes.

### Rule 2: Mixed formats allowed

You can mix old and new formats in the same file:

```json
{
  "context_files": [
    ".opencode/context/core/standards/code-quality.md",
    {
      "path": ".opencode/context/core/standards/security-patterns.md",
      "lines": "120-145",
      "reason": "JWT validation"
    }
  ]
}
```

### Rule 3: Agent handling

Agents MUST support both formats:

```typescript
function loadContextFile(ref: string | ContextFileReference): string {
  if (typeof ref === 'string') {
    // Legacy format: read entire file
    return readFile(ref);
  } else {
    // New format: read specified lines
    const content = readFile(ref.path);
    if (ref.lines) {
      return extractLines(content, ref.lines);
    }
    return content;
  }
}
```

### Rule 4: Gradual migration

Projects can adopt enhanced fields incrementally:
1. Start with line-number precision for large files
2. Add domain modeling fields (bounded_context, module) when needed
3. Add prioritization scores when planning releases
4. Add contracts/ADRs when formalizing architecture

---

## Complete Example

### Enhanced task.json

```json
{
  "id": "user-authentication",
  "name": "User Authentication System",
  "status": "active",
  "objective": "Implement JWT-based authentication with refresh tokens and role-based access control",
  "context_files": [
    {
      "path": ".opencode/context/core/standards/code-quality.md",
      "lines": "53-95",
      "reason": "Pure function patterns for auth service"
    },
    {
      "path": ".opencode/context/core/standards/security-patterns.md",
      "lines": "120-145,200-220",
      "reason": "JWT validation and token refresh patterns"
    }
  ],
  "reference_files": [
    {
      "path": "src/middleware/auth.middleware.ts",
      "lines": "1-50",
      "reason": "Existing auth middleware to extend"
    },
    "package.json"
  ],
  "exit_criteria": [
    "All tests passing with >90% coverage",
    "JWT tokens signed with RS256",
    "Refresh token rotation implemented",
    "Role-based access control working"
  ],
  "subtask_count": 5,
  "completed_count": 0,
  "created_at": "2026-02-14T10:00:00Z",
  "bounded_context": "authentication",
  "module": "@app/auth",
  "vertical_slice": "user-login",
  "contracts": [
    {
      "type": "api",
      "name": "AuthAPI",
      "path": "src/api/auth.contract.ts",
      "status": "defined",
      "description": "REST endpoints for login, logout, refresh, verify"
    },
    {
      "type": "event",
      "name": "UserAuthenticatedEvent",
      "status": "draft",
      "description": "Event emitted on successful authentication"
    }
  ],
  "design_components": [
    {
      "type": "figma",
      "url": "https://figma.com/file/xyz789/Auth-Flows",
      "description": "Login and registration UI mockups"
    }
  ],
  "related_adrs": [
    {
      "id": "ADR-003",
      "path": "docs/adr/003-jwt-authentication.md",
      "title": "Use JWT for stateless authentication",
      "decision": "JWT with RS256, 15-min access tokens, 7-day refresh tokens"
    }
  ],
  "rice_score": {
    "reach": 10000,
    "impact": 3,
    "confidence": 90,
    "effort": 4,
    "score": 6750
  },
  "wsjf_score": {
    "business_value": 9,
    "time_criticality": 8,
    "risk_reduction": 7,
    "job_size": 4,
    "score": 6
  },
  "release_slice": "v1.0.0"
}
```

### Enhanced subtask_NN.json

```json
{
  "id": "user-authentication-02",
  "seq": "02",
  "title": "Implement JWT service with token generation and validation",
  "status": "pending",
  "depends_on": ["01"],
  "parallel": false,
  "context_files": [
    {
      "path": ".opencode/context/core/standards/code-quality.md",
      "lines": "53-72",
      "reason": "Pure function patterns"
    },
    {
      "path": ".opencode/context/core/standards/security-patterns.md",
      "lines": "120-145",
      "reason": "JWT signing and validation rules"
    }
  ],
  "reference_files": [
    {
      "path": "src/config/jwt.config.ts",
      "reason": "JWT configuration constants"
    }
  ],
  "suggested_agent": "CoderAgent",
  "acceptance_criteria": [
    "JWT tokens signed with RS256 algorithm",
    "Access tokens expire in 15 minutes",
    "Refresh tokens expire in 7 days",
    "Token validation includes signature and expiry checks",
    "Unit tests cover all token operations",
    "No secrets hardcoded in code"
  ],
  "deliverables": [
    "src/auth/jwt.service.ts",
    "src/auth/jwt.service.test.ts"
  ],
  "bounded_context": "authentication",
  "module": "@app/auth",
  "contracts": [
    {
      "type": "interface",
      "name": "JWTService",
      "path": "src/auth/jwt.service.ts",
      "status": "implemented",
      "description": "Interface for JWT operations (sign, verify, refresh)"
    }
  ],
  "related_adrs": [
    {
      "id": "ADR-003",
      "path": "docs/adr/003-jwt-authentication.md"
    }
  ]
}
```

---

## Migration Guide

### For TaskManager Agents

When creating new tasks:

1. **Use line-number precision for large files** (>100 lines):
   ```json
   {
     "path": ".opencode/context/core/standards/code-quality.md",
     "lines": "53-95",
     "reason": "Pure function patterns"
   }
   ```

2. **Add domain modeling fields** when known:
   ```json
   {
     "bounded_context": "authentication",
     "module": "@app/auth",
     "vertical_slice": "user-login"
   }
   ```

3. **Link design artifacts** for UI tasks:
   ```json
   {
     "design_components": [
       {
         "type": "figma",
         "url": "https://figma.com/...",
         "description": "Login page mockups"
       }
     ]
   }
   ```

4. **Reference ADRs** for architectural decisions:
   ```json
   {
     "related_adrs": [
       {
         "id": "ADR-003",
         "path": "docs/adr/003-jwt-authentication.md"
       }
     ]
   }
   ```

### For Working Agents (CoderAgent, etc.)

When reading tasks:

1. **Handle both context file formats**:
   ```typescript
   const contextFiles = task.context_files || [];
   for (const ref of contextFiles) {
     if (typeof ref === 'string') {
       // Read entire file
       const content = await readFile(ref);
     } else {
       // Read specified lines
       const content = await readFileLines(ref.path, ref.lines);
       console.log(`Reading ${ref.path} (${ref.lines}): ${ref.reason}`);
     }
   }
   ```

2. **Use contract information** to understand dependencies:
   ```typescript
   const contracts = task.contracts || [];
   const apiContracts = contracts.filter(c => c.type === 'api');
   // Load API contract definitions before implementing
   ```

3. **Check ADRs** before making architectural decisions:
   ```typescript
   const adrs = task.related_adrs || [];
   for (const adr of adrs) {
     if (adr.path) {
       const decision = await readFile(adr.path);
       // Apply architectural constraints from ADR
     }
   }
   ```

---

## Related

- `task-schema.md` - Base schema (backward compatible foundation)
- `../guides/splitting-tasks.md` - How to decompose features
- `../guides/managing-tasks.md` - Lifecycle workflow
- `../lookup/task-commands.md` - CLI reference
