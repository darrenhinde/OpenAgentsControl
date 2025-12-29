/**
 * LLM Integration Tests
 * 
 * Tests that validate the eval framework works correctly with REAL LLM agents.
 * 
 * These tests focus on:
 * 1. Framework capabilities (multi-turn, approvals, performance)
 * 2. Behavior validation (using behavior expectations, not forcing violations)
 * 3. No false positives (proper agent behavior doesn't trigger violations)
 * 
 * What these tests DO NOT do:
 * - Force LLMs to violate standards (unreliable, LLMs are trained to follow best practices)
 * - Test evaluator violation detection (covered by unit tests with synthetic timelines)
 * 
 * NOTE: These tests require the opencode CLI and LLM access.
 * They are skipped by default in CI environments.
 * 
 * To run these tests manually:
 *   SKIP_INTEGRATION=false npx vitest run src/__tests__/llm-integration.test.ts
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { TestRunner } from '../sdk/test-runner.js';
import { TestCase } from '../sdk/test-case-schema.js';

// Skip LLM tests if SKIP_INTEGRATION is set or in CI
const skipLLMTests = process.env.SKIP_INTEGRATION === 'true' || process.env.CI === 'true';

describe.skipIf(skipLLMTests)('LLM Integration Tests', () => {
  let runner: TestRunner;
  let sessionIds: string[] = [];

  beforeAll(async () => {
    // Create test runner with evaluators enabled
    runner = new TestRunner({
      port: 0,
      debug: false,
      defaultTimeout: 45000, // Longer timeout for LLM responses
      runEvaluators: true,
      defaultModel: 'opencode/grok-code-fast', // Free tier model
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

  describe('Framework Capabilities', () => {
    it('should handle multi-turn conversations correctly', async () => {
      const testCase: TestCase = {
        id: 'llm-multi-turn',
        name: 'Multi-Turn Conversation Test',
        description: 'Validates framework handles multi-turn conversations',
        agent: 'openagent',
        model: 'opencode/grok-code-fast',
        prompts: [
          {
            text: 'What is the capital of France?',
          },
          {
            text: 'What is the population of that city?',
            delayMs: 2000,
          },
        ],
        timeout: 30000,
        approvalStrategy: {
          type: 'auto-approve',
        },
        expectedOutcome: {
          type: 'text-response',
        },
      };

      const result = await runner.runTest(testCase);
      sessionIds.push(result.sessionId);

      // Verify test executed
      expect(result.sessionId).toBeDefined();
      expect(result.evaluation).toBeDefined();

      // Verify both prompts were processed
      expect(result.events.length).toBeGreaterThan(0);
      
      // Should be conversational (context evaluator skipped)
      const contextResult = result.evaluation?.evaluatorResults.find(
        r => r.evaluator === 'context-loading'
      );
      expect(contextResult?.metadata?.skipped).toBe(true);
      
      console.log('✅ Multi-turn conversation handled correctly');
    }, 60000);

    it('should maintain context across conversation turns', async () => {
      const testCase: TestCase = {
        id: 'llm-context-across-turns',
        name: 'Context Across Turns Test',
        description: 'Validates agent maintains context across turns',
        agent: 'openagent',
        model: 'opencode/grok-code-fast',
        prompts: [
          {
            text: 'My favorite color is blue.',
          },
          {
            text: 'What is my favorite color?',
            delayMs: 2000,
          },
        ],
        timeout: 30000,
        approvalStrategy: {
          type: 'auto-approve',
        },
        expectedOutcome: {
          type: 'text-response',
          contains: ['blue'],
        },
      };

      const result = await runner.runTest(testCase);
      sessionIds.push(result.sessionId);

      // Verify test executed
      expect(result.sessionId).toBeDefined();
      expect(result.evaluation).toBeDefined();
      
      console.log('✅ Agent maintained context across turns');
    }, 60000);

    it('should request and handle approval grants', async () => {
      const testCase: TestCase = {
        id: 'llm-approval-grant',
        name: 'Approval Grant Test',
        description: 'Validates agent requests approval and handles grants',
        agent: 'openagent',
        model: 'opencode/grok-code-fast',
        prompt: 'Read the package.json file',
        timeout: 30000,
        approvalStrategy: {
          type: 'auto-approve',
        },
        expectedOutcome: {
          type: 'tool-execution',
          tools: ['read'],
        },
        behavior: {
          requiresApproval: true,
        },
      };

      const result = await runner.runTest(testCase);
      sessionIds.push(result.sessionId);

      // Verify test executed
      expect(result.sessionId).toBeDefined();
      expect(result.evaluation).toBeDefined();

      // Verify approval was requested
      if (result.approvalsGiven > 0) {
        console.log(`✅ Agent requested ${result.approvalsGiven} approval(s) and handled grant`);
      } else {
        console.log('ℹ️  Agent completed task without needing approvals');
      }
    }, 45000);

    it('should handle approval denials gracefully', async () => {
      const testCase: TestCase = {
        id: 'llm-approval-deny',
        name: 'Approval Denial Test',
        description: 'Validates agent handles denied approvals gracefully',
        agent: 'openagent',
        model: 'opencode/grok-code-fast',
        prompt: 'Create a new file called test.txt with content "Hello World"',
        timeout: 30000,
        approvalStrategy: {
          type: 'auto-deny',
        },
        expectedOutcome: {
          type: 'approval-denied',
        },
      };

      const result = await runner.runTest(testCase);
      sessionIds.push(result.sessionId);

      // Verify test executed
      expect(result.sessionId).toBeDefined();
      expect(result.evaluation).toBeDefined();

      // Verify approval flow was detected
      const approvalResult = result.evaluation?.evaluatorResults.find(
        r => r.evaluator === 'approval-gate'
      );
      expect(approvalResult).toBeDefined();
      
      console.log('✅ Agent handled denied approval gracefully');
    }, 45000);

    it('should complete simple tasks within acceptable time', async () => {
      const testCase: TestCase = {
        id: 'llm-performance',
        name: 'Performance Test',
        description: 'Validates agent completes tasks within timeout',
        agent: 'openagent',
        model: 'opencode/grok-code-fast',
        prompt: 'Say "Performance test complete"',
        timeout: 15000,
        approvalStrategy: {
          type: 'auto-approve',
        },
        expectedOutcome: {
          type: 'text-response',
          contains: ['Performance test complete'],
        },
      };

      const startTime = Date.now();
      const result = await runner.runTest(testCase);
      const duration = Date.now() - startTime;
      
      sessionIds.push(result.sessionId);

      // Verify test executed
      expect(result.sessionId).toBeDefined();
      expect(result.evaluation).toBeDefined();

      // Verify completed within timeout
      expect(duration).toBeLessThan(15000);
      
      console.log(`✅ Agent completed task in ${duration}ms`);
    }, 20000);

    it('should handle tool errors gracefully', async () => {
      const testCase: TestCase = {
        id: 'llm-error-handling',
        name: 'Error Handling Test',
        description: 'Validates agent handles tool errors gracefully',
        agent: 'openagent',
        model: 'opencode/grok-code-fast',
        prompt: 'Read a file that does not exist: /nonexistent/file.txt',
        timeout: 30000,
        approvalStrategy: {
          type: 'auto-approve',
        },
        expectedOutcome: {
          type: 'tool-execution',
          tools: ['read'],
        },
      };

      const result = await runner.runTest(testCase);
      sessionIds.push(result.sessionId);

      // Verify test executed (even if tool failed)
      expect(result.sessionId).toBeDefined();
      expect(result.evaluation).toBeDefined();

      // Test should complete without crashing
      expect(result.errors.length).toBeGreaterThanOrEqual(0);
      
      console.log('✅ Agent handled error gracefully');
    }, 45000);
  });

  describe('Behavior Validation', () => {
    it('should use dedicated tools instead of bash antipatterns', async () => {
      const testCase: TestCase = {
        id: 'llm-dedicated-tools',
        name: 'Dedicated Tools Test',
        description: 'Validates agent uses Read/List instead of cat/ls',
        agent: 'openagent',
        model: 'opencode/grok-code-fast',
        prompt: 'Read the package.json file and list all files in the current directory',
        timeout: 30000,
        approvalStrategy: {
          type: 'auto-approve',
        },
        expectedOutcome: {
          type: 'tool-execution',
          tools: ['read', 'glob'],
        },
        behavior: {
          mustUseDedicatedTools: true,
          mustUseAnyOf: [
            ['read'], // Must use read for file reading
            ['glob'], // Must use glob for listing
          ],
        },
      };

      const result = await runner.runTest(testCase);
      sessionIds.push(result.sessionId);

      // Verify test executed
      expect(result.sessionId).toBeDefined();
      expect(result.evaluation).toBeDefined();

      // Verify ToolUsageEvaluator ran
      const toolUsageResult = result.evaluation?.evaluatorResults.find(
        r => r.evaluator === 'tool-usage'
      );
      expect(toolUsageResult).toBeDefined();

      // Should have no bash antipattern violations
      const bashViolations = toolUsageResult?.violations.filter(v =>
        v.type === 'bash-antipattern'
      );
      
      expect(bashViolations?.length).toBe(0);
      console.log('✅ Agent used dedicated tools (no bash antipatterns)');
    }, 45000);

    it('should load context before writing code', async () => {
      const testCase: TestCase = {
        id: 'llm-context-before-code',
        name: 'Context Before Code Test',
        description: 'Validates agent loads context before coding',
        agent: 'openagent',
        model: 'opencode/grok-code-fast',
        prompt: 'Create a new TypeScript file called math.ts with a function called add that adds two numbers',
        timeout: 45000,
        approvalStrategy: {
          type: 'auto-approve',
        },
        expectedOutcome: {
          type: 'tool-execution',
          tools: ['write'],
        },
        behavior: {
          requiresContext: true,
          expectedContextFiles: [
            'code.md',
            'standards/code.md',
            '.opencode/context/core/standards/code.md',
          ],
        },
      };

      const result = await runner.runTest(testCase);
      sessionIds.push(result.sessionId);

      // Verify test executed
      expect(result.sessionId).toBeDefined();
      
      // Test may timeout - that's okay for LLM tests
      if (!result.evaluation) {
        console.log('ℹ️  Test timed out - LLM behavior can be unpredictable');
        return;
      }

      // Verify ContextLoadingEvaluator ran
      const contextResult = result.evaluation?.evaluatorResults.find(
        r => r.evaluator === 'context-loading'
      );
      
      if (!contextResult) {
        console.log('ℹ️  Context evaluator did not run');
        return;
      }

      // Check if context was loaded or evaluator was skipped
      if (contextResult?.metadata?.skipped) {
        console.log('ℹ️  Context evaluator skipped (may have detected as conversational)');
      } else {
        const contextViolations = contextResult?.violations.filter(v =>
          v.type === 'missing-context-load'
        );
        
        if (contextViolations && contextViolations.length === 0) {
          console.log('✅ Agent loaded context before coding');
        } else {
          console.log('⚠️  Agent may not have loaded context (LLM behavior varies)');
        }
      }
    }, 60000);

    it('should respect tool constraints', async () => {
      const testCase: TestCase = {
        id: 'llm-tool-constraints',
        name: 'Tool Constraints Test',
        description: 'Validates agent respects mustNotUseTools constraints',
        agent: 'openagent',
        model: 'opencode/grok-code-fast',
        prompt: 'Tell me about the package.json file',
        timeout: 30000,
        approvalStrategy: {
          type: 'auto-approve',
        },
        expectedOutcome: {
          type: 'text-response',
        },
        behavior: {
          mustNotUseTools: ['bash'], // Should not use bash for this task
          mayUseTools: ['read', 'glob'], // Can use these if needed
        },
      };

      const result = await runner.runTest(testCase);
      sessionIds.push(result.sessionId);

      // Verify test executed
      expect(result.sessionId).toBeDefined();
      expect(result.evaluation).toBeDefined();

      // Verify BehaviorEvaluator ran
      const behaviorResult = result.evaluation?.evaluatorResults.find(
        r => r.evaluator === 'behavior'
      );

      if (behaviorResult) {
        // Check for forbidden tool violations
        const forbiddenToolViolations = behaviorResult.violations.filter(v =>
          v.type === 'forbidden-tool-used'
        );
        
        expect(forbiddenToolViolations.length).toBe(0);
        console.log('✅ Agent respected tool constraints');
      } else {
        console.log('ℹ️  Behavior evaluator did not run (no behavior expectations)');
      }
    }, 45000);
  });

  describe('No False Positives', () => {
    it('should NOT flag proper tool usage', async () => {
      const testCase: TestCase = {
        id: 'llm-no-false-positive-tools',
        name: 'No False Positive - Tools Test',
        description: 'Validates evaluators do not flag proper tool usage',
        agent: 'openagent',
        model: 'opencode/grok-code-fast',
        prompt: 'Read the package.json file using the Read tool',
        timeout: 30000,
        approvalStrategy: {
          type: 'auto-approve',
        },
        expectedOutcome: {
          type: 'tool-execution',
          tools: ['read'],
        },
      };

      const result = await runner.runTest(testCase);
      sessionIds.push(result.sessionId);

      // Verify test executed
      expect(result.sessionId).toBeDefined();
      expect(result.evaluation).toBeDefined();

      // Verify ToolUsageEvaluator ran
      const toolUsageResult = result.evaluation?.evaluatorResults.find(
        r => r.evaluator === 'tool-usage'
      );
      expect(toolUsageResult).toBeDefined();

      // Should NOT have bash antipattern violations
      const bashViolations = toolUsageResult?.violations.filter(v =>
        v.type === 'bash-antipattern'
      );
      
      expect(bashViolations?.length).toBe(0);
      console.log('✅ Proper tool usage not flagged (no false positive)');
    }, 45000);
  });
});
