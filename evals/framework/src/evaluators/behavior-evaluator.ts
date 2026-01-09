/**
 * BehaviorEvaluator - Validates expected agent behavior from test cases
 * 
 * This evaluator checks if the agent performed the expected actions:
 * - Used required tools (mustUseTools)
 * - Avoided forbidden tools (mustNotUseTools)
 * - Made minimum/maximum number of tool calls
 * - Requested approval when required
 * - Loaded context when required
 * - Delegated to subagents when required
 * 
 * This is different from rule-based evaluators which check for violations.
 * This evaluator checks if the agent completed the task as expected.
 */

import { BaseEvaluator } from './base-evaluator.js';
import {
  TimelineEvent,
  SessionInfo,
  EvaluationResult,
  Violation,
  Evidence,
  Check,
} from '../types/index.js';

// Re-export from test-case-schema for backwards compatibility
// The canonical definition is in test-case-schema.ts
import type { BehaviorExpectation } from '../sdk/test-case-schema.js';
export type { BehaviorExpectation };

export class BehaviorEvaluator extends BaseEvaluator {
  name = 'behavior';
  description = 'Validates agent behavior matches test expectations';

  private behavior: BehaviorExpectation;

  constructor(behavior: BehaviorExpectation) {
    super();
    this.behavior = behavior;
  }

  async evaluate(timeline: TimelineEvent[], sessionInfo: SessionInfo): Promise<EvaluationResult> {
    const checks: Check[] = [];
    const violations: Violation[] = [];
    const evidence: Evidence[] = [];

    // Get all tool calls
    const toolCalls = this.getToolCalls(timeline);
    
    // Extract tool names - handle both direct and nested data structures
    // Tool name can be in: data.tool, data.state.tool, or the part itself
    const toolsUsed = toolCalls.map(tc => {
      const data = tc.data;
      if (!data) return null;
      // Try multiple paths where tool name might be stored
      return data.tool || data.state?.tool || null;
    }).filter((t): t is string => t !== null);
    
    const uniqueTools = [...new Set(toolsUsed)];
    
    // Log tool usage summary
    console.log(`\n${'='.repeat(60)}`);
    console.log(`BEHAVIOR VALIDATION`);
    console.log(`${'='.repeat(60)}`);
    console.log(`Timeline Events: ${timeline.length}`);
    console.log(`Tool Calls: ${toolCalls.length}`);
    console.log(`Tools Used: ${uniqueTools.join(', ') || 'none'}`);
    
    // Log each tool call with details
    if (toolCalls.length > 0) {
      console.log(`\nTool Call Details:`);
      toolCalls.forEach((tc, i) => {
        const tool = tc.data?.tool || 'unknown';
        const input = tc.data?.state?.input || tc.data?.input || {};
        
        // Show more details for task tool (delegation)
        if (tool === 'task') {
          console.log(`  ${i + 1}. ${tool}:`);
          if (input.subagent_type) {
            console.log(`     → Subagent: ${input.subagent_type}`);
          }
          if (input.description) {
            console.log(`     → Description: ${input.description}`);
          }
          if (input.prompt) {
            const promptPreview = input.prompt.substring(0, 150);
            console.log(`     → Prompt: "${promptPreview}${input.prompt.length > 150 ? '...' : ''}"`);
          }
        } else {
          // Regular tool - show compact format
          const inputStr = JSON.stringify(input).substring(0, 100);
          console.log(`  ${i + 1}. ${tool}: ${inputStr}${inputStr.length >= 100 ? '...' : ''}`);
        }
      });
    }

    // Check 1: mustUseTools
    if (this.behavior.mustUseTools && this.behavior.mustUseTools.length > 0) {
      const missingTools: string[] = [];
      
      for (const requiredTool of this.behavior.mustUseTools) {
        const wasUsed = toolsUsed.includes(requiredTool);
        
        if (!wasUsed) {
          missingTools.push(requiredTool);
          
          violations.push(
            this.createViolation(
              'missing-required-tool',
              'error',
              `Required tool '${requiredTool}' was not used`,
              Date.now(),
              {
                requiredTool,
                toolsUsed: uniqueTools,
              }
            )
          );
        }
      }

      checks.push({
        name: 'must-use-tools',
        passed: missingTools.length === 0,
        weight: 100,
        evidence: [
          this.createEvidence(
            'required-tools',
            missingTools.length === 0 
              ? `All required tools used: ${this.behavior.mustUseTools.join(', ')}`
              : `Missing required tools: ${missingTools.join(', ')}`,
            {
              required: this.behavior.mustUseTools,
              used: uniqueTools,
              missing: missingTools,
            }
          )
        ]
      });
    }

    // Check 1b: mustUseAnyOf - at least one tool set must be fully used
    if (this.behavior.mustUseAnyOf && this.behavior.mustUseAnyOf.length > 0) {
      // Check if any of the tool sets is fully satisfied
      const satisfiedSets: string[][] = [];
      const unsatisfiedSets: { set: string[]; missing: string[] }[] = [];
      
      for (const toolSet of this.behavior.mustUseAnyOf) {
        const missingFromSet = toolSet.filter(tool => !toolsUsed.includes(tool));
        if (missingFromSet.length === 0) {
          satisfiedSets.push(toolSet);
        } else {
          unsatisfiedSets.push({ set: toolSet, missing: missingFromSet });
        }
      }
      
      const passed = satisfiedSets.length > 0;
      
      if (!passed) {
        violations.push(
          this.createViolation(
            'missing-required-tool-set',
            'error',
            `None of the required tool sets were fully used. Options: ${this.behavior.mustUseAnyOf.map(s => `[${s.join(', ')}]`).join(' OR ')}`,
            Date.now(),
            {
              requiredSets: this.behavior.mustUseAnyOf,
              toolsUsed: uniqueTools,
              unsatisfiedSets,
            }
          )
        );
      }

      checks.push({
        name: 'must-use-any-of',
        passed,
        weight: 100,
        evidence: [
          this.createEvidence(
            'alternative-tools',
            passed
              ? `Satisfied tool set: [${satisfiedSets[0].join(', ')}]`
              : `No tool set satisfied. Options: ${this.behavior.mustUseAnyOf.map(s => `[${s.join(', ')}]`).join(' OR ')}`,
            {
              requiredSets: this.behavior.mustUseAnyOf,
              used: uniqueTools,
              satisfiedSets,
              unsatisfiedSets,
            }
          )
        ]
      });
    }

    // Check 2: mustNotUseTools
    if (this.behavior.mustNotUseTools && this.behavior.mustNotUseTools.length > 0) {
      const forbiddenToolsUsed: string[] = [];
      
      for (const forbiddenTool of this.behavior.mustNotUseTools) {
        const wasUsed = toolsUsed.includes(forbiddenTool);
        
        if (wasUsed) {
          forbiddenToolsUsed.push(forbiddenTool);
          
          violations.push(
            this.createViolation(
              'forbidden-tool-used',
              'error',
              `Forbidden tool '${forbiddenTool}' was used`,
              Date.now(),
              {
                forbiddenTool,
                toolsUsed: uniqueTools,
              }
            )
          );
        }
      }

      checks.push({
        name: 'must-not-use-tools',
        passed: forbiddenToolsUsed.length === 0,
        weight: 100,
        evidence: [
          this.createEvidence(
            'forbidden-tools',
            forbiddenToolsUsed.length === 0
              ? `No forbidden tools used`
              : `Forbidden tools used: ${forbiddenToolsUsed.join(', ')}`,
            {
              forbidden: this.behavior.mustNotUseTools,
              used: uniqueTools,
              violations: forbiddenToolsUsed,
            }
          )
        ]
      });
    }

    // Check 3: minToolCalls
    if (this.behavior.minToolCalls !== undefined) {
      const passed = toolCalls.length >= this.behavior.minToolCalls;
      
      if (!passed) {
        violations.push(
          this.createViolation(
            'insufficient-tool-calls',
            'error',
            `Expected at least ${this.behavior.minToolCalls} tool calls, got ${toolCalls.length}`,
            Date.now(),
            {
              expected: this.behavior.minToolCalls,
              actual: toolCalls.length,
            }
          )
        );
      }

      checks.push({
        name: 'min-tool-calls',
        passed,
        weight: 50,
        evidence: [
          this.createEvidence(
            'tool-call-count',
            `Tool calls: ${toolCalls.length} (min: ${this.behavior.minToolCalls})`,
            {
              actual: toolCalls.length,
              minimum: this.behavior.minToolCalls,
            }
          )
        ]
      });
    }

    // Check 4: maxToolCalls
    if (this.behavior.maxToolCalls !== undefined) {
      const passed = toolCalls.length <= this.behavior.maxToolCalls;
      
      if (!passed) {
        violations.push(
          this.createViolation(
            'excessive-tool-calls',
            'warning',
            `Expected at most ${this.behavior.maxToolCalls} tool calls, got ${toolCalls.length}`,
            Date.now(),
            {
              expected: this.behavior.maxToolCalls,
              actual: toolCalls.length,
            }
          )
        );
      }

      checks.push({
        name: 'max-tool-calls',
        passed,
        weight: 50,
        evidence: [
          this.createEvidence(
            'tool-call-count',
            `Tool calls: ${toolCalls.length} (max: ${this.behavior.maxToolCalls})`,
            {
              actual: toolCalls.length,
              maximum: this.behavior.maxToolCalls,
            }
          )
        ]
      });
    }

    // Check 5: requiresApproval
    if (this.behavior.requiresApproval) {
      // Check if agent asked for approval (contains approval language in messages)
      const assistantMessages = this.getAssistantMessages(timeline);
      const hasApprovalRequest = assistantMessages.some(msg => {
        const text = msg.data?.text || '';
        return this.containsApprovalLanguage(text);
      });

      if (!hasApprovalRequest) {
        violations.push(
          this.createViolation(
            'missing-approval-request',
            'error',
            'Agent did not request approval before executing',
            Date.now(),
            {
              requiresApproval: true,
              approvalRequested: false,
            }
          )
        );
      }

      checks.push({
        name: 'requires-approval',
        passed: hasApprovalRequest,
        weight: 100,
        evidence: [
          this.createEvidence(
            'approval-request',
            hasApprovalRequest
              ? 'Agent requested approval before executing'
              : 'Agent did not request approval',
            {
              requiresApproval: true,
              approvalRequested: hasApprovalRequest,
            }
          )
        ]
      });
    }

    // Check 6: requiresContext
    if (this.behavior.requiresContext) {
      // Check if agent loaded context files
      const readTools = this.getReadTools(timeline);
      
      // Log all files read for analysis
      const filesRead = readTools.map(rt => 
        rt.data?.state?.input?.filePath || rt.data?.input?.filePath || rt.data?.input?.path || 'unknown'
      );
      
      console.log(`\n[behavior] Files Read (${filesRead.length}):`);
      filesRead.forEach((file, i) => {
        console.log(`  ${i + 1}. ${file}`);
      });
      
      // Context file patterns - files that count as "context loading"
      // Matches: .opencode/agent/*.md, .opencode/context/**/*.md, docs/**/*.md, README.md, CONTRIBUTING.md
      const contextPatterns = [
        /\.opencode\/agent\/.*\.md$/i,
        /\.opencode\/context\/.*\.md$/i,
        /docs\/.*\.md$/i,
        /\/CONTRIBUTING\.md$/i,
        /\/README\.md$/i,
      ];

      const contextReads = readTools.filter(rt => {
        const filePath = rt.data?.state?.input?.filePath || rt.data?.input?.filePath || rt.data?.input?.path || '';
        return contextPatterns.some(pattern => pattern.test(filePath));
      });
      
      console.log(`[behavior] Context Files Read: ${contextReads.length}/${filesRead.length}`);

      const hasContextLoading = contextReads.length > 0;

      if (!hasContextLoading) {
        violations.push(
          this.createViolation(
            'missing-context-loading',
            'error',
            'Agent did not load required context files',
            Date.now(),
            {
              requiresContext: true,
              contextLoaded: false,
            }
          )
        );
      }

      checks.push({
        name: 'requires-context',
        passed: hasContextLoading,
        weight: 100,
        evidence: [
          this.createEvidence(
            'context-loading',
            hasContextLoading
              ? `Agent loaded ${contextReads.length} context file(s)`
              : 'Agent did not load context files',
            {
              requiresContext: true,
              contextLoaded: hasContextLoading,
              contextFiles: contextReads.map(cr => cr.data?.input?.filePath || cr.data?.input?.path),
            }
          )
        ]
      });
    }

    // Check 7: shouldDelegate
    if (this.behavior.shouldDelegate) {
      const taskCalls = this.getToolCallsByName(timeline, 'task');
      const hasDelegation = taskCalls.length > 0;

      if (!hasDelegation) {
        violations.push(
          this.createViolation(
            'missing-delegation',
            'warning',
            'Agent should have delegated to a subagent',
            Date.now(),
            {
              shouldDelegate: true,
              delegated: false,
            }
          )
        );
      }

      checks.push({
        name: 'should-delegate',
        passed: hasDelegation,
        weight: 75,
        evidence: [
          this.createEvidence(
            'delegation',
            hasDelegation
              ? `Agent delegated to ${taskCalls.length} subagent(s)`
              : 'Agent did not delegate to subagents',
            {
              shouldDelegate: true,
              delegated: hasDelegation,
              delegationCount: taskCalls.length,
            }
          )
        ]
      });
    }

    // Check 8: expectedResponse (validate response content)
    if (this.behavior.expectedResponse) {
      const assistantMessages = timeline.filter(
        e => e.type === 'message' && e.data?.role === 'assistant' && e.data?.text
      );
      
      // Combine all assistant messages into one text for validation
      const fullResponse = assistantMessages
        .map(m => m.data?.text || '')
        .join('\n');
      
      // Check contains
      if (this.behavior.expectedResponse.contains && this.behavior.expectedResponse.contains.length > 0) {
        const missingStrings: string[] = [];
        
        for (const expectedString of this.behavior.expectedResponse.contains) {
          if (!fullResponse.includes(expectedString)) {
            missingStrings.push(expectedString);
          }
        }
        
        if (missingStrings.length > 0) {
          violations.push(
            this.createViolation(
              'missing-expected-content',
              'error',
              `Response missing expected content: ${missingStrings.join(', ')}`,
              Date.now(),
              {
                missingStrings,
                expectedStrings: this.behavior.expectedResponse.contains,
              }
            )
          );
        }
        
        checks.push({
          name: 'expected-response-contains',
          passed: missingStrings.length === 0,
          weight: 100,
          evidence: [
            this.createEvidence(
              'response-content',
              missingStrings.length === 0
                ? `Response contains all ${this.behavior.expectedResponse.contains.length} expected strings`
                : `Response missing ${missingStrings.length} expected strings`,
              {
                expectedCount: this.behavior.expectedResponse.contains.length,
                foundCount: this.behavior.expectedResponse.contains.length - missingStrings.length,
                missingStrings,
              }
            )
          ]
        });
      }
      
      // Check notContains
      if (this.behavior.expectedResponse.notContains && this.behavior.expectedResponse.notContains.length > 0) {
        const foundForbiddenStrings: string[] = [];
        
        for (const forbiddenString of this.behavior.expectedResponse.notContains) {
          if (fullResponse.includes(forbiddenString)) {
            foundForbiddenStrings.push(forbiddenString);
          }
        }
        
        if (foundForbiddenStrings.length > 0) {
          violations.push(
            this.createViolation(
              'forbidden-content-found',
              'error',
              `Response contains forbidden content: ${foundForbiddenStrings.join(', ')}`,
              Date.now(),
              {
                foundForbiddenStrings,
                forbiddenStrings: this.behavior.expectedResponse.notContains,
              }
            )
          );
        }
        
        checks.push({
          name: 'expected-response-not-contains',
          passed: foundForbiddenStrings.length === 0,
          weight: 100,
          evidence: [
            this.createEvidence(
              'response-content-forbidden',
              foundForbiddenStrings.length === 0
                ? `Response does not contain any of ${this.behavior.expectedResponse.notContains.length} forbidden strings`
                : `Response contains ${foundForbiddenStrings.length} forbidden strings`,
              {
                forbiddenCount: this.behavior.expectedResponse.notContains.length,
                foundCount: foundForbiddenStrings.length,
                foundForbiddenStrings,
              }
            )
          ]
        });
      }
    }

    // Add summary evidence
    evidence.push(
      this.createEvidence(
        'behavior-summary',
        `Behavior validation: ${checks.filter(c => c.passed).length}/${checks.length} checks passed`,
        {
          totalChecks: checks.length,
          passedChecks: checks.filter(c => c.passed).length,
          failedChecks: checks.filter(c => !c.passed).length,
          toolsUsed: uniqueTools,
          toolCallCount: toolCalls.length,
        }
      )
    );

    // Print summary
    console.log(`\nBehavior Validation Summary:`);
    console.log(`  Checks Passed: ${checks.filter(c => c.passed).length}/${checks.length}`);
    
    // Show which checks passed/failed with reasons
    if (checks.length > 0) {
      console.log(`\nCheck Details:`);
      checks.forEach((check, i) => {
        const icon = check.passed ? '✓' : '✗';
        const status = check.passed ? 'PASS' : 'FAIL';
        console.log(`  ${icon} ${check.name}: ${status}`);
        
        // Show reason/evidence
        if (check.evidence && check.evidence.length > 0) {
          check.evidence.forEach(ev => {
            if (ev.description) {
              console.log(`     → ${ev.description}`);
            }
            // Show key data points
            if (ev.data) {
              if (ev.data.expected !== undefined && ev.data.actual !== undefined) {
                console.log(`     → Expected: ${JSON.stringify(ev.data.expected)}, Got: ${JSON.stringify(ev.data.actual)}`);
              } else if (ev.data.toolsUsed !== undefined) {
                console.log(`     → Tools used: ${ev.data.toolsUsed.length > 0 ? ev.data.toolsUsed.join(', ') : 'none'}`);
              } else if (ev.data.count !== undefined) {
                console.log(`     → Count: ${ev.data.count}`);
              }
            }
          });
        }
      });
    }
    
    console.log(`\n  Violations: ${violations.length}`);
    if (violations.length > 0) {
      console.log(`\nViolations Detected:`);
      violations.forEach((v, i) => {
        console.log(`  ${i + 1}. [${v.severity}] ${v.type}: ${v.message}`);
      });
    }
    console.log(`${'='.repeat(60)}\n`);

    return this.buildResult(this.name, checks, violations, evidence, {
      behavior: this.behavior,
      toolsUsed: uniqueTools,
      toolCallCount: toolCalls.length,
    });
  }
}
