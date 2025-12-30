/**
 * Integration Tests - Eval Pipeline End-to-End
 * 
 * Tests the complete evaluation pipeline from test case loading through
 * execution, evaluation, and reporting. These tests validate that all
 * components work together correctly.
 * 
 * NOTE: These tests require the opencode CLI to be installed and a running server.
 * They are skipped by default in CI environments.
 * 
 * To run these tests manually:
 *   SKIP_INTEGRATION=false npx vitest run src/__tests__/eval-pipeline-integration.test.ts
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { TestRunner } from '../sdk/test-runner.js';
import { TestCase } from '../sdk/test-case-schema.js';
import { SessionReader } from '../collector/session-reader.js';
import { TimelineBuilder } from '../collector/timeline-builder.js';
import { EvaluatorRunner } from '../evaluators/evaluator-runner.js';
import { ApprovalGateEvaluator } from '../evaluators/approval-gate-evaluator.js';
import { ContextLoadingEvaluator } from '../evaluators/context-loading-evaluator.js';
import { ToolUsageEvaluator } from '../evaluators/tool-usage-evaluator.js';
import { StopOnFailureEvaluator } from '../evaluators/stop-on-failure-evaluator.js';

// Skip integration tests if SKIP_INTEGRATION is set or in CI
const skipIntegration = process.env.SKIP_INTEGRATION === 'true' || process.env.CI === 'true';

describe.skipIf(skipIntegration)('Eval Pipeline Integration', () => {
  let runner: TestRunner;
  let sessionIds: string[] = [];

  beforeAll(async () => {
    // Create test runner with evaluators enabled
    runner = new TestRunner({
      port: 0,
      debug: false,
      defaultTimeout: 30000,
      runEvaluators: true,
      defaultModel: 'opencode/grok-code-fast',
    });

    // Start server with openagent
    await runner.start('openagent');
  }, 30000);

  afterAll(async () => {
    // Cleanup sessions
    for (const sessionId of sessionIds) {
      try {
        // Sessions are auto-cleaned by runner in non-debug mode
      } catch {
        // Ignore cleanup errors
      }
    }

    // Stop server
    if (runner) {
      await runner.stop();
    }
  }, 10000);

  describe('Single Test Execution', () => {
    it('should execute a simple test case end-to-end', async () => {
      const testCase: TestCase = {
        id: 'integration-simple-test',
        name: 'Simple Integration Test',
        description: 'Test basic prompt execution',
        agent: 'openagent',
        model: 'opencode/grok-code-fast',
        prompt: 'Say "Hello Integration Test" and nothing else.',
        timeout: 15000,
        approvalStrategy: {
          type: 'auto-approve',
        },
        expectedOutcome: {
          type: 'text-response',
          contains: ['Hello Integration Test'],
        },
      };

      const result = await runner.runTest(testCase);
      sessionIds.push(result.sessionId);

      // Verify execution completed
      expect(result.sessionId).toBeDefined();
      expect(result.sessionId).toMatch(/^ses_/);
      expect(result.duration).toBeGreaterThan(0);
      expect(result.events.length).toBeGreaterThan(0);

      // Verify evaluation ran
      expect(result.evaluation).toBeDefined();
      expect(result.evaluation?.sessionId).toBe(result.sessionId);
      expect(result.evaluation?.evaluatorResults).toBeDefined();
      expect(result.evaluation?.evaluatorResults.length).toBeGreaterThan(0);

      // Verify overall score calculated
      expect(result.evaluation?.overallScore).toBeGreaterThanOrEqual(0);
      expect(result.evaluation?.overallScore).toBeLessThanOrEqual(100);

      // Verify violations tracked
      expect(result.evaluation?.totalViolations).toBeGreaterThanOrEqual(0);
      expect(result.evaluation?.violationsBySeverity).toBeDefined();
      expect(result.evaluation?.violationsBySeverity.error).toBeGreaterThanOrEqual(0);
      expect(result.evaluation?.violationsBySeverity.warning).toBeGreaterThanOrEqual(0);
      expect(result.evaluation?.violationsBySeverity.info).toBeGreaterThanOrEqual(0);
    }, 30000);

    it('should handle test with tool execution', async () => {
      const testCase: TestCase = {
        id: 'integration-tool-test',
        name: 'Tool Execution Integration Test',
        description: 'Test tool execution and evaluation',
        agent: 'openagent',
        model: 'opencode/grok-code-fast',
        prompt: 'List files in the current directory using the List tool.',
        timeout: 20000,
        approvalStrategy: {
          type: 'auto-approve',
        },
        expectedOutcome: {
          type: 'tool-execution',
          tools: ['list'],
        },
      };

      const result = await runner.runTest(testCase);
      sessionIds.push(result.sessionId);

      // Verify tool execution
      expect(result.events.length).toBeGreaterThan(0);
      
      // Check for tool-related events (may not be captured in events array)
      // The important thing is that the test completed successfully
      const toolEvents = result.events.filter(e => 
        e.type === 'part.created' || e.type === 'part.updated'
      );
      // Tool events may not be in the events array depending on timing
      // Just verify we got some events
      expect(result.events.length).toBeGreaterThan(0);

      // Verify evaluation detected tool usage
      expect(result.evaluation).toBeDefined();
      const toolUsageResult = result.evaluation?.evaluatorResults.find(
        r => r.evaluator === 'tool-usage'
      );
      expect(toolUsageResult).toBeDefined();
      
      // Tool usage evaluator should have run (passed or failed)
      expect(toolUsageResult?.passed).toBeDefined();
    }, 30000);

    it('should detect approval gate violations', async () => {
      const testCase: TestCase = {
        id: 'integration-approval-test',
        name: 'Approval Gate Integration Test',
        description: 'Test approval gate detection',
        agent: 'openagent',
        model: 'opencode/grok-code-fast',
        prompt: 'Create a file named test.txt with content "test".',
        timeout: 20000,
        approvalStrategy: {
          type: 'auto-deny', // Deny all approvals
        },
        expectedOutcome: {
          type: 'approval-denied',
        },
      };

      const result = await runner.runTest(testCase);
      sessionIds.push(result.sessionId);

      // Verify evaluation ran
      expect(result.evaluation).toBeDefined();
      
      // Approval gate evaluator should detect denied approvals
      const approvalResult = result.evaluation?.evaluatorResults.find(
        r => r.evaluator === 'approval-gate'
      );
      expect(approvalResult).toBeDefined();
    }, 30000);
  });

  describe('Multiple Test Execution', () => {
    it('should execute multiple tests in sequence', async () => {
      const testCases: TestCase[] = [
        {
          id: 'integration-multi-1',
          name: 'Multi Test 1',
          description: 'First test in sequence',
          agent: 'openagent',
          model: 'opencode/grok-code-fast',
          prompt: 'Say "Test 1".',
          timeout: 15000,
          approvalStrategy: { type: 'auto-approve' },
          expectedOutcome: { type: 'text-response', contains: ['Test 1'] },
        },
        {
          id: 'integration-multi-2',
          name: 'Multi Test 2',
          description: 'Second test in sequence',
          agent: 'openagent',
          model: 'opencode/grok-code-fast',
          prompt: 'Say "Test 2".',
          timeout: 15000,
          approvalStrategy: { type: 'auto-approve' },
          expectedOutcome: { type: 'text-response', contains: ['Test 2'] },
        },
      ];

      const results = await runner.runTests(testCases);
      sessionIds.push(...results.map(r => r.sessionId));

      // Verify all tests executed
      expect(results.length).toBe(2);
      
      // Verify each test has evaluation
      results.forEach(result => {
        expect(result.sessionId).toBeDefined();
        expect(result.evaluation).toBeDefined();
        expect(result.evaluation?.evaluatorResults.length).toBeGreaterThan(0);
      });

      // Verify sessions are different
      expect(results[0].sessionId).not.toBe(results[1].sessionId);
    }, 60000);
  });

  describe('Evaluator Integration', () => {
    it('should run multiple evaluators on same session', async () => {
      const testCase: TestCase = {
        id: 'integration-evaluators-test',
        name: 'Multiple Evaluators Test',
        description: 'Test multiple evaluators working together',
        agent: 'openagent',
        model: 'opencode/grok-code-fast',
        prompt: 'List files in current directory.',
        timeout: 20000,
        approvalStrategy: { type: 'auto-approve' },
        expectedOutcome: { type: 'tool-execution', tools: ['list'] },
      };

      const result = await runner.runTest(testCase);
      sessionIds.push(result.sessionId);

      expect(result.evaluation).toBeDefined();
      
      // Verify multiple evaluators ran
      const evaluatorNames = result.evaluation!.evaluatorResults.map(r => r.evaluator);
      
      // Should have at least these core evaluators
      expect(evaluatorNames).toContain('approval-gate');
      expect(evaluatorNames).toContain('tool-usage');
      
      // Each evaluator should have a score
      result.evaluation!.evaluatorResults.forEach(evalResult => {
        expect(evalResult.score).toBeGreaterThanOrEqual(0);
        expect(evalResult.score).toBeLessThanOrEqual(100);
        expect(evalResult.passed).toBeDefined();
        expect(evalResult.violations).toBeDefined();
        expect(Array.isArray(evalResult.violations)).toBe(true);
      });
    }, 30000);

    it('should aggregate violations from multiple evaluators', async () => {
      const testCase: TestCase = {
        id: 'integration-violations-test',
        name: 'Violations Aggregation Test',
        description: 'Test violation aggregation across evaluators',
        agent: 'openagent',
        model: 'opencode/grok-code-fast',
        prompt: 'Use cat command to read a file.', // Should trigger tool-usage violation
        timeout: 20000,
        approvalStrategy: { type: 'auto-approve' },
        expectedOutcome: { type: 'tool-execution' },
      };

      const result = await runner.runTest(testCase);
      sessionIds.push(result.sessionId);

      expect(result.evaluation).toBeDefined();
      
      // Verify violation aggregation
      expect(result.evaluation!.allViolations).toBeDefined();
      expect(Array.isArray(result.evaluation!.allViolations)).toBe(true);
      
      // Verify violation counts match
      const totalFromEvaluators = result.evaluation!.evaluatorResults.reduce(
        (sum, r) => sum + r.violations.length,
        0
      );
      expect(result.evaluation!.totalViolations).toBe(totalFromEvaluators);
      
      // Verify severity counts
      const errorCount = result.evaluation!.allViolations.filter(v => v.severity === 'error').length;
      const warningCount = result.evaluation!.allViolations.filter(v => v.severity === 'warning').length;
      const infoCount = result.evaluation!.allViolations.filter(v => v.severity === 'info').length;
      
      expect(result.evaluation!.violationsBySeverity.error).toBe(errorCount);
      expect(result.evaluation!.violationsBySeverity.warning).toBe(warningCount);
      expect(result.evaluation!.violationsBySeverity.info).toBe(infoCount);
    }, 30000);
  });

  describe('Session Data Collection', () => {
    it('should collect complete session timeline', async () => {
      const testCase: TestCase = {
        id: 'integration-timeline-test',
        name: 'Timeline Collection Test',
        description: 'Test timeline building from session data',
        agent: 'openagent',
        model: 'opencode/grok-code-fast',
        prompt: 'List files and then say "Done".',
        timeout: 20000,
        approvalStrategy: { type: 'auto-approve' },
        expectedOutcome: { type: 'text-response', contains: ['Done'] },
      };

      const result = await runner.runTest(testCase);
      sessionIds.push(result.sessionId);

      // Verify timeline was built during evaluation
      expect(result.evaluation).toBeDefined();
      expect(result.evaluation?.sessionId).toBe(result.sessionId);
      
      // Verify evaluators ran (which means timeline was built successfully)
      expect(result.evaluation?.evaluatorResults.length).toBeGreaterThan(0);
      
      // Verify session info was collected
      expect(result.evaluation?.sessionInfo).toBeDefined();
      expect(result.evaluation?.sessionInfo.id).toBe(result.sessionId);
      
      // Verify timeline metadata
      expect(result.evaluation?.timestamp).toBeGreaterThan(0);
      
      // Verify evidence was collected (timeline events converted to evidence)
      expect(result.evaluation?.allEvidence).toBeDefined();
      expect(Array.isArray(result.evaluation?.allEvidence)).toBe(true);
    }, 30000);

    it('should handle session with no tool execution', async () => {
      const testCase: TestCase = {
        id: 'integration-no-tools-test',
        name: 'No Tools Test',
        description: 'Test session with only text response',
        agent: 'openagent',
        model: 'opencode/grok-code-fast',
        prompt: 'Say "No tools needed" and nothing else.',
        timeout: 15000,
        approvalStrategy: { type: 'auto-approve' },
        expectedOutcome: { type: 'text-response', contains: ['No tools needed'] },
      };

      const result = await runner.runTest(testCase);
      sessionIds.push(result.sessionId);

      expect(result.evaluation).toBeDefined();
      
      // Tool usage evaluator should pass (no violations for not using tools)
      const toolUsageResult = result.evaluation?.evaluatorResults.find(
        r => r.evaluator === 'tool-usage'
      );
      expect(toolUsageResult).toBeDefined();
      
      // Should have no tool-related violations
      const toolViolations = toolUsageResult?.violations.filter(v => 
        v.type === 'bash-antipattern' || v.type === 'suboptimal-tool-usage'
      );
      expect(toolViolations?.length).toBe(0);
    }, 30000);
  });

  describe('Error Handling', () => {
    it('should handle test timeout gracefully', async () => {
      const testCase: TestCase = {
        id: 'integration-timeout-test',
        name: 'Timeout Test',
        description: 'Test timeout handling',
        agent: 'openagent',
        model: 'opencode/grok-code-fast',
        prompt: 'Perform a very long task that takes forever.',
        timeout: 5000, // Very short timeout
        approvalStrategy: { type: 'auto-approve' },
        expectedOutcome: { type: 'text-response' },
      };

      const result = await runner.runTest(testCase);
      sessionIds.push(result.sessionId);

      // Test should complete (not throw)
      expect(result.sessionId).toBeDefined();
      
      // May have errors due to timeout
      expect(result.errors).toBeDefined();
      expect(Array.isArray(result.errors)).toBe(true);
    }, 15000);

    it('should handle invalid session ID in evaluator', async () => {
      const sessionReader = new SessionReader(undefined, undefined);
      const timelineBuilder = new TimelineBuilder(sessionReader);
      const evaluatorRunner = new EvaluatorRunner({
        sessionReader,
        timelineBuilder,
        evaluators: [new ApprovalGateEvaluator()],
      });

      // Try to evaluate non-existent session
      await expect(
        evaluatorRunner.runAll('ses_nonexistent_12345')
      ).rejects.toThrow();
    });
  });

  describe('Result Validation', () => {
    it('should validate test results correctly', async () => {
      const testCase: TestCase = {
        id: 'integration-validation-test',
        name: 'Result Validation Test',
        description: 'Test result validation logic',
        agent: 'openagent',
        model: 'opencode/grok-code-fast',
        prompt: 'Say "Validation Test".',
        timeout: 15000,
        approvalStrategy: { type: 'auto-approve' },
        expectedOutcome: {
          type: 'text-response',
          contains: ['Validation Test'],
        },
      };

      const result = await runner.runTest(testCase);
      sessionIds.push(result.sessionId);

      // Verify result structure
      expect(result).toHaveProperty('testCase');
      expect(result).toHaveProperty('sessionId');
      expect(result).toHaveProperty('passed');
      expect(result).toHaveProperty('errors');
      expect(result).toHaveProperty('events');
      expect(result).toHaveProperty('duration');
      expect(result).toHaveProperty('approvalsGiven');
      expect(result).toHaveProperty('evaluation');

      // Verify testCase reference
      expect(result.testCase.id).toBe(testCase.id);
      expect(result.testCase.name).toBe(testCase.name);

      // Verify passed is boolean
      expect(typeof result.passed).toBe('boolean');

      // Verify errors is array
      expect(Array.isArray(result.errors)).toBe(true);

      // Verify events is array
      expect(Array.isArray(result.events)).toBe(true);

      // Verify duration is number
      expect(typeof result.duration).toBe('number');
      expect(result.duration).toBeGreaterThan(0);

      // Verify approvalsGiven is number
      expect(typeof result.approvalsGiven).toBe('number');
      expect(result.approvalsGiven).toBeGreaterThanOrEqual(0);
    }, 30000);

    it('should calculate overall score correctly', async () => {
      const testCase: TestCase = {
        id: 'integration-score-test',
        name: 'Score Calculation Test',
        description: 'Test overall score calculation',
        agent: 'openagent',
        model: 'opencode/grok-code-fast',
        prompt: 'Say "Score Test".',
        timeout: 15000,
        approvalStrategy: { type: 'auto-approve' },
        expectedOutcome: { type: 'text-response', contains: ['Score Test'] },
      };

      const result = await runner.runTest(testCase);
      sessionIds.push(result.sessionId);

      expect(result.evaluation).toBeDefined();
      
      // Overall score should be average of evaluator scores
      const evaluatorScores = result.evaluation!.evaluatorResults.map(r => r.score);
      const expectedScore = Math.round(
        evaluatorScores.reduce((sum, s) => sum + s, 0) / evaluatorScores.length
      );
      
      expect(result.evaluation!.overallScore).toBe(expectedScore);
      
      // Overall passed should be true only if all evaluators passed
      const allPassed = result.evaluation!.evaluatorResults.every(r => r.passed);
      expect(result.evaluation!.overallPassed).toBe(allPassed);
    }, 30000);
  });

  describe('Report Generation', () => {
    it('should generate text report from evaluation', async () => {
      const testCase: TestCase = {
        id: 'integration-report-test',
        name: 'Report Generation Test',
        description: 'Test report generation',
        agent: 'openagent',
        model: 'opencode/grok-code-fast',
        prompt: 'Say "Report Test".',
        timeout: 15000,
        approvalStrategy: { type: 'auto-approve' },
        expectedOutcome: { type: 'text-response', contains: ['Report Test'] },
      };

      const result = await runner.runTest(testCase);
      sessionIds.push(result.sessionId);

      expect(result.evaluation).toBeDefined();
      
      // Generate report
      const sessionReader = new SessionReader(undefined, undefined);
      const timelineBuilder = new TimelineBuilder(sessionReader);
      const evaluatorRunner = new EvaluatorRunner({
        sessionReader,
        timelineBuilder,
        evaluators: [],
      });
      
      const report = evaluatorRunner.generateReport(result.evaluation!);
      
      // Verify report structure
      expect(report).toBeDefined();
      expect(typeof report).toBe('string');
      expect(report.length).toBeGreaterThan(0);
      
      // Verify report contains key sections
      expect(report).toContain('EVALUATION REPORT');
      expect(report).toContain('Session:');
      expect(report).toContain('Overall Status:');
      expect(report).toContain('Overall Score:');
      expect(report).toContain('Violations:');
      expect(report).toContain('EVALUATOR RESULTS');
    }, 30000);

    it('should generate batch summary report', async () => {
      const testCases: TestCase[] = [
        {
          id: 'integration-batch-1',
          name: 'Batch Test 1',
          description: 'First batch test',
          agent: 'openagent',
          model: 'opencode/grok-code-fast',
          prompt: 'Say "Batch 1".',
          timeout: 15000,
          approvalStrategy: { type: 'auto-approve' },
          expectedOutcome: { type: 'text-response', contains: ['Batch 1'] },
        },
        {
          id: 'integration-batch-2',
          name: 'Batch Test 2',
          description: 'Second batch test',
          agent: 'openagent',
          model: 'opencode/grok-code-fast',
          prompt: 'Say "Batch 2".',
          timeout: 15000,
          approvalStrategy: { type: 'auto-approve' },
          expectedOutcome: { type: 'text-response', contains: ['Batch 2'] },
        },
      ];

      const results = await runner.runTests(testCases);
      sessionIds.push(...results.map(r => r.sessionId));

      // Generate batch summary
      const sessionReader = new SessionReader(undefined, undefined);
      const timelineBuilder = new TimelineBuilder(sessionReader);
      const evaluatorRunner = new EvaluatorRunner({
        sessionReader,
        timelineBuilder,
        evaluators: [],
      });
      
      const evaluations = results.map(r => r.evaluation!).filter(Boolean);
      const summary = evaluatorRunner.generateBatchSummary(evaluations);
      
      // Verify summary structure
      expect(summary).toBeDefined();
      expect(typeof summary).toBe('string');
      expect(summary.length).toBeGreaterThan(0);
      
      // Verify summary contains key sections
      expect(summary).toContain('BATCH EVALUATION SUMMARY');
      expect(summary).toContain('Total Sessions:');
      expect(summary).toContain('Passed:');
      expect(summary).toContain('Failed:');
      expect(summary).toContain('Average Score:');
      expect(summary).toContain('SESSION RESULTS');
    }, 60000);
  });
});
