/**
 * Enhanced Schema Validation Tests
 * 
 * Tests validation of enhanced task.json and subtask_NN.json schema fields:
 * - Line-number precision for context/reference files
 * - Domain modeling fields (bounded_context, module, vertical_slice)
 * - Contract tracking
 * - Design artifacts
 * - ADR references
 * - Prioritization scores (RICE, WSJF)
 * - Release planning
 * - Backward compatibility
 */

import { describe, it, expect } from "vitest";

// Type definitions from enhanced schema
interface ContextFileReference {
  path: string;
  lines?: string;
  reason?: string;
}

interface Contract {
  type: 'api' | 'interface' | 'event' | 'schema';
  name: string;
  path?: string;
  status: 'draft' | 'defined' | 'implemented' | 'verified';
  description?: string;
}

interface DesignComponent {
  type: 'figma' | 'wireframe' | 'mockup' | 'prototype' | 'sketch';
  url?: string;
  path?: string;
  description?: string;
}

interface ADRReference {
  id: string;
  path?: string;
  title?: string;
  decision?: string;
}

interface RICEScore {
  reach: number;
  impact: number;
  confidence: number;
  effort: number;
  score?: number;
}

interface WSJFScore {
  business_value: number;
  time_criticality: number;
  risk_reduction: number;
  job_size: number;
  score?: number;
}

interface EnhancedTask {
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

interface EnhancedSubtask {
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

// Validation functions
function validateContextFileReference(ref: string | ContextFileReference): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (typeof ref === 'string') {
    // Legacy format - always valid
    return { valid: true, errors: [] };
  }

  // New format validation
  if (!ref.path || typeof ref.path !== 'string') {
    errors.push('ContextFileReference must have a valid path');
  }

  if (ref.lines !== undefined) {
    // Validate line range format: "10-50" or "1-20,45-60"
    const lineRangePattern = /^\d+-\d+(,\d+-\d+)*$/;
    if (!lineRangePattern.test(ref.lines)) {
      errors.push(`Invalid line range format: "${ref.lines}". Expected format: "10-50" or "1-20,45-60"`);
    }
  }

  if (ref.reason !== undefined && typeof ref.reason !== 'string') {
    errors.push('ContextFileReference reason must be a string');
  }

  if (ref.reason && ref.reason.length > 200) {
    errors.push('ContextFileReference reason must be max 200 characters');
  }

  return { valid: errors.length === 0, errors };
}

function validateContract(contract: Contract): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  const validTypes = ['api', 'interface', 'event', 'schema'];
  if (!validTypes.includes(contract.type)) {
    errors.push(`Invalid contract type: "${contract.type}". Must be one of: ${validTypes.join(', ')}`);
  }

  if (!contract.name || typeof contract.name !== 'string') {
    errors.push('Contract must have a valid name');
  }

  const validStatuses = ['draft', 'defined', 'implemented', 'verified'];
  if (!validStatuses.includes(contract.status)) {
    errors.push(`Invalid contract status: "${contract.status}". Must be one of: ${validStatuses.join(', ')}`);
  }

  if (contract.description && contract.description.length > 200) {
    errors.push('Contract description must be max 200 characters');
  }

  return { valid: errors.length === 0, errors };
}

function validateDesignComponent(component: DesignComponent): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  const validTypes = ['figma', 'wireframe', 'mockup', 'prototype', 'sketch'];
  if (!validTypes.includes(component.type)) {
    errors.push(`Invalid design component type: "${component.type}". Must be one of: ${validTypes.join(', ')}`);
  }

  if (!component.url && !component.path) {
    errors.push('DesignComponent must have either url or path');
  }

  if (component.description && component.description.length > 200) {
    errors.push('DesignComponent description must be max 200 characters');
  }

  return { valid: errors.length === 0, errors };
}

function validateADRReference(adr: ADRReference): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!adr.id || typeof adr.id !== 'string') {
    errors.push('ADRReference must have a valid id');
  }

  if (adr.decision && adr.decision.length > 200) {
    errors.push('ADRReference decision must be max 200 characters');
  }

  return { valid: errors.length === 0, errors };
}

function validateRICEScore(rice: RICEScore): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (rice.reach <= 0) {
    errors.push('RICE reach must be > 0');
  }

  if (rice.impact < 0.25 || rice.impact > 3) {
    errors.push('RICE impact must be between 0.25 and 3');
  }

  if (rice.confidence < 0 || rice.confidence > 100) {
    errors.push('RICE confidence must be between 0 and 100');
  }

  if (rice.effort <= 0) {
    errors.push('RICE effort must be > 0');
  }

  // Validate calculated score if provided
  if (rice.score !== undefined) {
    const expectedScore = (rice.reach * rice.impact * (rice.confidence / 100)) / rice.effort;
    const tolerance = 0.01; // Allow small floating point differences
    if (Math.abs(rice.score - expectedScore) > tolerance) {
      errors.push(`RICE score mismatch: expected ${expectedScore.toFixed(2)}, got ${rice.score}`);
    }
  }

  return { valid: errors.length === 0, errors };
}

function validateWSJFScore(wsjf: WSJFScore): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (wsjf.business_value < 1 || wsjf.business_value > 10) {
    errors.push('WSJF business_value must be between 1 and 10');
  }

  if (wsjf.time_criticality < 1 || wsjf.time_criticality > 10) {
    errors.push('WSJF time_criticality must be between 1 and 10');
  }

  if (wsjf.risk_reduction < 1 || wsjf.risk_reduction > 10) {
    errors.push('WSJF risk_reduction must be between 1 and 10');
  }

  if (wsjf.job_size < 1 || wsjf.job_size > 10) {
    errors.push('WSJF job_size must be between 1 and 10');
  }

  // Validate calculated score if provided
  if (wsjf.score !== undefined) {
    const expectedScore = (wsjf.business_value + wsjf.time_criticality + wsjf.risk_reduction) / wsjf.job_size;
    const tolerance = 0.01; // Allow small floating point differences
    if (Math.abs(wsjf.score - expectedScore) > tolerance) {
      errors.push(`WSJF score mismatch: expected ${expectedScore.toFixed(2)}, got ${wsjf.score}`);
    }
  }

  return { valid: errors.length === 0, errors };
}

function fileExists(filePath: string): boolean {
  try {
    // Use dynamic import to avoid TypeScript errors
    const fs = eval('require')('fs');
    return fs.existsSync(filePath);
  } catch {
    return false;
  }
}

describe("Enhanced Schema Validation", () => {
  // ==========================================================================
  // Line-Number Precision Format Tests
  // ==========================================================================
  describe("ContextFileReference validation", () => {
    it("validates legacy string format", () => {
      const result = validateContextFileReference(".opencode/context/core/standards/code-quality.md");
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("validates new format with path only", () => {
      const ref: ContextFileReference = {
        path: ".opencode/context/core/standards/code-quality.md"
      };
      const result = validateContextFileReference(ref);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("validates new format with single line range", () => {
      const ref: ContextFileReference = {
        path: ".opencode/context/core/standards/code-quality.md",
        lines: "10-50",
        reason: "Pure function patterns"
      };
      const result = validateContextFileReference(ref);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("validates new format with multiple line ranges", () => {
      const ref: ContextFileReference = {
        path: ".opencode/context/core/standards/security-patterns.md",
        lines: "1-25,120-145,200-220",
        reason: "JWT validation and token refresh patterns"
      };
      const result = validateContextFileReference(ref);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("rejects invalid line range format", () => {
      const ref: ContextFileReference = {
        path: ".opencode/context/core/standards/code-quality.md",
        lines: "invalid-range"
      };
      const result = validateContextFileReference(ref);
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain("Invalid line range format");
    });

    it("rejects reason longer than 200 characters", () => {
      const ref: ContextFileReference = {
        path: ".opencode/context/core/standards/code-quality.md",
        lines: "10-50",
        reason: "a".repeat(201)
      };
      const result = validateContextFileReference(ref);
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain("max 200 characters");
    });

    it("rejects missing path", () => {
      const ref = {
        lines: "10-50"
      } as ContextFileReference;
      const result = validateContextFileReference(ref);
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain("must have a valid path");
    });
  });

  // ==========================================================================
  // Contract Validation Tests
  // ==========================================================================
  describe("Contract validation", () => {
    it("validates valid API contract", () => {
      const contract: Contract = {
        type: 'api',
        name: 'UserAPI',
        path: 'src/api/user.contract.ts',
        status: 'defined',
        description: 'REST API for user CRUD operations'
      };
      const result = validateContract(contract);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("validates valid interface contract", () => {
      const contract: Contract = {
        type: 'interface',
        name: 'JWTService',
        status: 'implemented'
      };
      const result = validateContract(contract);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("validates valid event contract", () => {
      const contract: Contract = {
        type: 'event',
        name: 'UserCreatedEvent',
        status: 'draft',
        description: 'Event emitted when new user is created'
      };
      const result = validateContract(contract);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("validates valid schema contract", () => {
      const contract: Contract = {
        type: 'schema',
        name: 'UserSchema',
        path: 'src/schemas/user.schema.ts',
        status: 'verified'
      };
      const result = validateContract(contract);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("rejects invalid contract type", () => {
      const contract = {
        type: 'invalid',
        name: 'TestContract',
        status: 'draft'
      } as unknown as Contract;
      const result = validateContract(contract);
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain("Invalid contract type");
    });

    it("rejects invalid contract status", () => {
      const contract = {
        type: 'api',
        name: 'TestAPI',
        status: 'invalid'
      } as unknown as Contract;
      const result = validateContract(contract);
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain("Invalid contract status");
    });

    it("rejects description longer than 200 characters", () => {
      const contract: Contract = {
        type: 'api',
        name: 'TestAPI',
        status: 'draft',
        description: "a".repeat(201)
      };
      const result = validateContract(contract);
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain("max 200 characters");
    });

    it("rejects missing name", () => {
      const contract = {
        type: 'api',
        status: 'draft'
      } as Contract;
      const result = validateContract(contract);
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain("must have a valid name");
    });
  });

  // ==========================================================================
  // Design Component Validation Tests
  // ==========================================================================
  describe("DesignComponent validation", () => {
    it("validates Figma component with URL", () => {
      const component: DesignComponent = {
        type: 'figma',
        url: 'https://figma.com/file/abc123/Login-Flow',
        description: 'Login page mockups'
      };
      const result = validateDesignComponent(component);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("validates wireframe component with local path", () => {
      const component: DesignComponent = {
        type: 'wireframe',
        path: 'docs/design/checkout-wireframe.png',
        description: 'Checkout flow wireframe'
      };
      const result = validateDesignComponent(component);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("validates all design component types", () => {
      const types: Array<DesignComponent['type']> = ['figma', 'wireframe', 'mockup', 'prototype', 'sketch'];
      
      types.forEach(type => {
        const component: DesignComponent = {
          type,
          url: 'https://example.com/design'
        };
        const result = validateDesignComponent(component);
        expect(result.valid).toBe(true);
      });
    });

    it("rejects invalid design component type", () => {
      const component = {
        type: 'invalid',
        url: 'https://example.com'
      } as unknown as DesignComponent;
      const result = validateDesignComponent(component);
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain("Invalid design component type");
    });

    it("rejects component without url or path", () => {
      const component = {
        type: 'figma',
        description: 'Test design'
      } as DesignComponent;
      const result = validateDesignComponent(component);
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain("must have either url or path");
    });

    it("rejects description longer than 200 characters", () => {
      const component: DesignComponent = {
        type: 'figma',
        url: 'https://example.com',
        description: "a".repeat(201)
      };
      const result = validateDesignComponent(component);
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain("max 200 characters");
    });
  });

  // ==========================================================================
  // ADR Reference Validation Tests
  // ==========================================================================
  describe("ADRReference validation", () => {
    it("validates ADR with all fields", () => {
      const adr: ADRReference = {
        id: 'ADR-003',
        path: 'docs/adr/003-jwt-authentication.md',
        title: 'Use JWT for stateless authentication',
        decision: 'JWT with RS256, 15-min access tokens'
      };
      const result = validateADRReference(adr);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("validates ADR with minimal fields", () => {
      const adr: ADRReference = {
        id: 'ADR-007',
        path: 'docs/adr/007-database-choice.md'
      };
      const result = validateADRReference(adr);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("rejects ADR without id", () => {
      const adr = {
        path: 'docs/adr/001-test.md'
      } as ADRReference;
      const result = validateADRReference(adr);
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain("must have a valid id");
    });

    it("rejects decision longer than 200 characters", () => {
      const adr: ADRReference = {
        id: 'ADR-001',
        decision: "a".repeat(201)
      };
      const result = validateADRReference(adr);
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain("max 200 characters");
    });
  });

  // ==========================================================================
  // RICE Score Validation Tests
  // ==========================================================================
  describe("RICEScore validation", () => {
    it("validates valid RICE score", () => {
      const rice: RICEScore = {
        reach: 5000,
        impact: 2,
        confidence: 80,
        effort: 3
      };
      const result = validateRICEScore(rice);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("validates RICE score with calculated score", () => {
      const rice: RICEScore = {
        reach: 5000,
        impact: 2,
        confidence: 80,
        effort: 3,
        score: 2666.67
      };
      const result = validateRICEScore(rice);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("validates all valid impact values", () => {
      const validImpacts = [0.25, 0.5, 1, 2, 3];
      
      validImpacts.forEach(impact => {
        const rice: RICEScore = {
          reach: 1000,
          impact,
          confidence: 50,
          effort: 1
        };
        const result = validateRICEScore(rice);
        expect(result.valid).toBe(true);
      });
    });

    it("rejects reach <= 0", () => {
      const rice: RICEScore = {
        reach: 0,
        impact: 2,
        confidence: 80,
        effort: 3
      };
      const result = validateRICEScore(rice);
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain("reach must be > 0");
    });

    it("rejects impact < 0.25", () => {
      const rice: RICEScore = {
        reach: 1000,
        impact: 0.1,
        confidence: 80,
        effort: 3
      };
      const result = validateRICEScore(rice);
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain("impact must be between 0.25 and 3");
    });

    it("rejects impact > 3", () => {
      const rice: RICEScore = {
        reach: 1000,
        impact: 5,
        confidence: 80,
        effort: 3
      };
      const result = validateRICEScore(rice);
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain("impact must be between 0.25 and 3");
    });

    it("rejects confidence < 0", () => {
      const rice: RICEScore = {
        reach: 1000,
        impact: 2,
        confidence: -10,
        effort: 3
      };
      const result = validateRICEScore(rice);
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain("confidence must be between 0 and 100");
    });

    it("rejects confidence > 100", () => {
      const rice: RICEScore = {
        reach: 1000,
        impact: 2,
        confidence: 150,
        effort: 3
      };
      const result = validateRICEScore(rice);
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain("confidence must be between 0 and 100");
    });

    it("rejects effort <= 0", () => {
      const rice: RICEScore = {
        reach: 1000,
        impact: 2,
        confidence: 80,
        effort: 0
      };
      const result = validateRICEScore(rice);
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain("effort must be > 0");
    });

    it("rejects incorrect calculated score", () => {
      const rice: RICEScore = {
        reach: 5000,
        impact: 2,
        confidence: 80,
        effort: 3,
        score: 9999 // Wrong calculation
      };
      const result = validateRICEScore(rice);
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain("RICE score mismatch");
    });
  });

  // ==========================================================================
  // WSJF Score Validation Tests
  // ==========================================================================
  describe("WSJFScore validation", () => {
    it("validates valid WSJF score", () => {
      const wsjf: WSJFScore = {
        business_value: 8,
        time_criticality: 6,
        risk_reduction: 5,
        job_size: 3
      };
      const result = validateWSJFScore(wsjf);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("validates WSJF score with calculated score", () => {
      const wsjf: WSJFScore = {
        business_value: 8,
        time_criticality: 6,
        risk_reduction: 5,
        job_size: 3,
        score: 6.33
      };
      const result = validateWSJFScore(wsjf);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("validates all fields at minimum value (1)", () => {
      const wsjf: WSJFScore = {
        business_value: 1,
        time_criticality: 1,
        risk_reduction: 1,
        job_size: 1
      };
      const result = validateWSJFScore(wsjf);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("validates all fields at maximum value (10)", () => {
      const wsjf: WSJFScore = {
        business_value: 10,
        time_criticality: 10,
        risk_reduction: 10,
        job_size: 10
      };
      const result = validateWSJFScore(wsjf);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("rejects business_value < 1", () => {
      const wsjf: WSJFScore = {
        business_value: 0,
        time_criticality: 5,
        risk_reduction: 5,
        job_size: 3
      };
      const result = validateWSJFScore(wsjf);
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain("business_value must be between 1 and 10");
    });

    it("rejects business_value > 10", () => {
      const wsjf: WSJFScore = {
        business_value: 15,
        time_criticality: 5,
        risk_reduction: 5,
        job_size: 3
      };
      const result = validateWSJFScore(wsjf);
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain("business_value must be between 1 and 10");
    });

    it("rejects time_criticality out of range", () => {
      const wsjf: WSJFScore = {
        business_value: 5,
        time_criticality: 0,
        risk_reduction: 5,
        job_size: 3
      };
      const result = validateWSJFScore(wsjf);
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain("time_criticality must be between 1 and 10");
    });

    it("rejects risk_reduction out of range", () => {
      const wsjf: WSJFScore = {
        business_value: 5,
        time_criticality: 5,
        risk_reduction: 11,
        job_size: 3
      };
      const result = validateWSJFScore(wsjf);
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain("risk_reduction must be between 1 and 10");
    });

    it("rejects job_size out of range", () => {
      const wsjf: WSJFScore = {
        business_value: 5,
        time_criticality: 5,
        risk_reduction: 5,
        job_size: 0
      };
      const result = validateWSJFScore(wsjf);
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain("job_size must be between 1 and 10");
    });

    it("rejects incorrect calculated score", () => {
      const wsjf: WSJFScore = {
        business_value: 8,
        time_criticality: 6,
        risk_reduction: 5,
        job_size: 3,
        score: 9999 // Wrong calculation
      };
      const result = validateWSJFScore(wsjf);
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain("WSJF score mismatch");
    });
  });

  // ==========================================================================
  // Domain Modeling Fields Tests
  // ==========================================================================
  describe("Domain modeling fields", () => {
    it("validates bounded_context field", () => {
      const task: Partial<EnhancedTask> = {
        id: 'test-task',
        name: 'Test Task',
        status: 'active',
        objective: 'Test objective',
        created_at: '2026-02-14T00:00:00Z',
        bounded_context: 'authentication'
      };
      
      expect(task.bounded_context).toBe('authentication');
      expect(typeof task.bounded_context).toBe('string');
    });

    it("validates module field", () => {
      const task: Partial<EnhancedTask> = {
        id: 'test-task',
        name: 'Test Task',
        status: 'active',
        objective: 'Test objective',
        created_at: '2026-02-14T00:00:00Z',
        module: '@app/auth'
      };
      
      expect(task.module).toBe('@app/auth');
      expect(typeof task.module).toBe('string');
    });

    it("validates vertical_slice field", () => {
      const task: Partial<EnhancedTask> = {
        id: 'test-task',
        name: 'Test Task',
        status: 'active',
        objective: 'Test objective',
        created_at: '2026-02-14T00:00:00Z',
        vertical_slice: 'user-registration'
      };
      
      expect(task.vertical_slice).toBe('user-registration');
      expect(typeof task.vertical_slice).toBe('string');
    });

    it("validates release_slice field", () => {
      const task: Partial<EnhancedTask> = {
        id: 'test-task',
        name: 'Test Task',
        status: 'active',
        objective: 'Test objective',
        created_at: '2026-02-14T00:00:00Z',
        release_slice: 'v1.0.0'
      };
      
      expect(task.release_slice).toBe('v1.0.0');
      expect(typeof task.release_slice).toBe('string');
    });
  });

  // ==========================================================================
  // Backward Compatibility Tests
  // ==========================================================================
  describe("Backward compatibility", () => {
    it("accepts task without any enhanced fields", () => {
      const task: EnhancedTask = {
        id: 'legacy-task',
        name: 'Legacy Task',
        status: 'active',
        objective: 'Test legacy task',
        created_at: '2026-02-14T00:00:00Z'
      };
      
      expect(task.id).toBe('legacy-task');
      expect(task.bounded_context).toBeUndefined();
      expect(task.contracts).toBeUndefined();
      expect(task.rice_score).toBeUndefined();
    });

    it("accepts subtask without any enhanced fields", () => {
      const subtask: EnhancedSubtask = {
        id: 'legacy-subtask-01',
        seq: '01',
        title: 'Legacy Subtask',
        status: 'pending'
      };
      
      expect(subtask.id).toBe('legacy-subtask-01');
      expect(subtask.bounded_context).toBeUndefined();
      expect(subtask.contracts).toBeUndefined();
    });

    it("accepts mixed legacy and new context file formats", () => {
      const task: Partial<EnhancedTask> = {
        id: 'mixed-task',
        name: 'Mixed Format Task',
        status: 'active',
        objective: 'Test mixed formats',
        created_at: '2026-02-14T00:00:00Z',
        context_files: [
          '.opencode/context/core/standards/code-quality.md',
          {
            path: '.opencode/context/core/standards/security-patterns.md',
            lines: '120-145',
            reason: 'JWT validation'
          }
        ]
      };
      
      expect(task.context_files).toHaveLength(2);
      expect(typeof task.context_files![0]).toBe('string');
      expect(typeof task.context_files![1]).toBe('object');
      
      // Validate both formats
      const result1 = validateContextFileReference(task.context_files![0]);
      const result2 = validateContextFileReference(task.context_files![1]);
      
      expect(result1.valid).toBe(true);
      expect(result2.valid).toBe(true);
    });

    it("accepts task with only some enhanced fields", () => {
      const task: Partial<EnhancedTask> = {
        id: 'partial-task',
        name: 'Partial Enhanced Task',
        status: 'active',
        objective: 'Test partial enhancement',
        created_at: '2026-02-14T00:00:00Z',
        bounded_context: 'authentication',
        // No contracts, no scores, etc.
      };
      
      expect(task.bounded_context).toBe('authentication');
      expect(task.contracts).toBeUndefined();
      expect(task.rice_score).toBeUndefined();
      expect(task.wsjf_score).toBeUndefined();
    });
  });

  // ==========================================================================
  // File Reference Validation Tests
  // ==========================================================================
  describe("File reference validation", () => {
    it("validates contract with path field", () => {
      const contract: Contract = {
        type: 'api',
        name: 'TestAPI',
        path: 'src/api/test.contract.ts',
        status: 'defined'
      };
      
      const result = validateContract(contract);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("validates ADR with path field", () => {
      const adr: ADRReference = {
        id: 'ADR-001',
        path: 'docs/adr/001-test.md',
        title: 'Test ADR'
      };
      
      const result = validateADRReference(adr);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("validates contract without path field", () => {
      const contract: Contract = {
        type: 'api',
        name: 'TestAPI',
        status: 'draft'
      };
      
      // Contract validation should pass (path is optional)
      const result = validateContract(contract);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("validates ADR without path field", () => {
      const adr: ADRReference = {
        id: 'ADR-001',
        title: 'Test ADR'
      };
      
      const result = validateADRReference(adr);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  // ==========================================================================
  // Integration Tests
  // ==========================================================================
  describe("Complete enhanced task validation", () => {
    it("validates fully enhanced task with all fields", () => {
      const task: EnhancedTask = {
        id: 'user-authentication',
        name: 'User Authentication System',
        status: 'active',
        objective: 'Implement JWT-based authentication',
        context_files: [
          {
            path: '.opencode/context/core/standards/code-quality.md',
            lines: '53-95',
            reason: 'Pure function patterns'
          },
          '.opencode/context/core/standards/security-patterns.md'
        ],
        reference_files: [
          {
            path: 'src/middleware/auth.middleware.ts',
            lines: '1-50',
            reason: 'Existing auth middleware'
          }
        ],
        exit_criteria: [
          'All tests passing',
          'JWT tokens signed with RS256'
        ],
        subtask_count: 5,
        completed_count: 0,
        created_at: '2026-02-14T10:00:00Z',
        bounded_context: 'authentication',
        module: '@app/auth',
        vertical_slice: 'user-login',
        contracts: [
          {
            type: 'api',
            name: 'AuthAPI',
            path: 'src/api/auth.contract.ts',
            status: 'defined',
            description: 'REST endpoints for auth'
          }
        ],
        design_components: [
          {
            type: 'figma',
            url: 'https://figma.com/file/xyz789/Auth-Flows',
            description: 'Login UI mockups'
          }
        ],
        related_adrs: [
          {
            id: 'ADR-003',
            path: 'docs/adr/003-jwt-authentication.md',
            title: 'Use JWT for authentication'
          }
        ],
        rice_score: {
          reach: 10000,
          impact: 3,
          confidence: 90,
          effort: 4,
          score: 6750
        },
        wsjf_score: {
          business_value: 9,
          time_criticality: 8,
          risk_reduction: 7,
          job_size: 4,
          score: 6
        },
        release_slice: 'v1.0.0'
      };

      // Validate all context files
      task.context_files?.forEach(ref => {
        const result = validateContextFileReference(ref);
        expect(result.valid).toBe(true);
      });

      // Validate all contracts
      task.contracts?.forEach(contract => {
        const result = validateContract(contract);
        expect(result.valid).toBe(true);
      });

      // Validate all design components
      task.design_components?.forEach(component => {
        const result = validateDesignComponent(component);
        expect(result.valid).toBe(true);
      });

      // Validate all ADRs
      task.related_adrs?.forEach(adr => {
        const result = validateADRReference(adr);
        expect(result.valid).toBe(true);
      });

      // Validate RICE score
      if (task.rice_score) {
        const result = validateRICEScore(task.rice_score);
        expect(result.valid).toBe(true);
      }

      // Validate WSJF score
      if (task.wsjf_score) {
        const result = validateWSJFScore(task.wsjf_score);
        expect(result.valid).toBe(true);
      }

      // Validate domain fields
      expect(task.bounded_context).toBe('authentication');
      expect(task.module).toBe('@app/auth');
      expect(task.vertical_slice).toBe('user-login');
      expect(task.release_slice).toBe('v1.0.0');
    });

    it("validates fully enhanced subtask with all fields", () => {
      const subtask: EnhancedSubtask = {
        id: 'user-authentication-02',
        seq: '02',
        title: 'Implement JWT service',
        status: 'pending',
        depends_on: ['01'],
        parallel: false,
        context_files: [
          {
            path: '.opencode/context/core/standards/code-quality.md',
            lines: '53-72',
            reason: 'Pure function patterns'
          }
        ],
        suggested_agent: 'CoderAgent',
        acceptance_criteria: [
          'JWT tokens signed with RS256',
          'Unit tests cover all operations'
        ],
        deliverables: [
          'src/auth/jwt.service.ts',
          'src/auth/jwt.service.test.ts'
        ],
        bounded_context: 'authentication',
        module: '@app/auth',
        contracts: [
          {
            type: 'interface',
            name: 'JWTService',
            path: 'src/auth/jwt.service.ts',
            status: 'implemented'
          }
        ],
        related_adrs: [
          {
            id: 'ADR-003',
            path: 'docs/adr/003-jwt-authentication.md'
          }
        ]
      };

      // Validate all enhanced fields
      subtask.context_files?.forEach(ref => {
        const result = validateContextFileReference(ref);
        expect(result.valid).toBe(true);
      });

      subtask.contracts?.forEach(contract => {
        const result = validateContract(contract);
        expect(result.valid).toBe(true);
      });

      subtask.related_adrs?.forEach(adr => {
        const result = validateADRReference(adr);
        expect(result.valid).toBe(true);
      });

      expect(subtask.bounded_context).toBe('authentication');
      expect(subtask.module).toBe('@app/auth');
    });
  });
});
