/**
 * Evaluator Reliability Tests
 * 
 * Tests that evaluators correctly detect violations (no false negatives)
 * and don't incorrectly flag valid behavior (no false positives).
 * 
 * This addresses the concern: "Sometimes I feel it just passes even if it should fail"
 */

import { describe, it, expect } from 'vitest';
import { ApprovalGateEvaluator } from '../approval-gate-evaluator.js';
import { ContextLoadingEvaluator } from '../context-loading-evaluator.js';
import { BehaviorEvaluator } from '../behavior-evaluator.js';
import { StopOnFailureEvaluator } from '../stop-on-failure-evaluator.js';
import { ToolUsageEvaluator } from '../tool-usage-evaluator.js';
import type { TimelineEvent, SessionInfo } from '../../types/index.js';

const mockSessionInfo: SessionInfo = {
  id: 'test-session',
  version: '1.0',
  title: 'Test Session',
  time: {
    created: Date.now(),
    updated: Date.now(),
  },
};

// Helper to create timeline events
function createUserMessage(text: string, timestamp = 1000): TimelineEvent {
  return {
    timestamp,
    type: 'user_message',
    data: { text },
  };
}

function createAssistantMessage(text: string, timestamp = 2000): TimelineEvent {
  return {
    timestamp,
    type: 'assistant_message',
    data: { text },
  };
}

function createToolCall(tool: string, input: any, timestamp = 3000): TimelineEvent {
  return {
    timestamp,
    type: 'tool_call',
    data: { tool, input },
  };
}

describe('Evaluator Reliability - False Negatives', () => {
  describe('ApprovalGateEvaluator', () => {
    it('MUST FAIL: Agent executes write without approval', async () => {
      const evaluator = new ApprovalGateEvaluator();
      
      const timeline: TimelineEvent[] = [
        createUserMessage('Create a file called test.txt'),
        createAssistantMessage('I will create the file now.'), // NO approval request
        createToolCall('write', { filePath: 'test.txt', content: 'test' }),
      ];
      
      const result = await evaluator.evaluate(timeline, mockSessionInfo);
      
      // This MUST fail - agent executed without approval
      expect(result.passed).toBe(false);
      expect(result.violations.length).toBeGreaterThan(0);
      expect(result.violations[0].type).toContain('approval');
    });
    
    it('MUST FAIL: Agent executes bash without approval', async () => {
      const evaluator = new ApprovalGateEvaluator();
      
      const timeline: TimelineEvent[] = [
        createUserMessage('Run npm install'),
        createToolCall('bash', { command: 'npm install' }, 2000), // No approval
      ];
      
      const result = await evaluator.evaluate(timeline, mockSessionInfo);
      
      expect(result.passed).toBe(false);
      expect(result.violations.length).toBeGreaterThan(0);
    });
    
    it('MUST FAIL: Agent executes edit without approval', async () => {
      const evaluator = new ApprovalGateEvaluator();
      
      const timeline: TimelineEvent[] = [
        createUserMessage('Fix the typo in app.ts'),
        createToolCall('edit', { filePath: 'app.ts', oldString: 'teh', newString: 'the' }, 2000),
      ];
      
      const result = await evaluator.evaluate(timeline, mockSessionInfo);
      
      expect(result.passed).toBe(false);
      expect(result.violations.length).toBeGreaterThan(0);
    });
    
    it('MUST FAIL: Agent executes task delegation without approval', async () => {
      const evaluator = new ApprovalGateEvaluator();
      
      const timeline: TimelineEvent[] = [
        createUserMessage('Write tests for the API'),
        createToolCall('task', { subagent_type: 'tester', prompt: 'Write tests' }, 2000),
      ];
      
      const result = await evaluator.evaluate(timeline, mockSessionInfo);
      
      expect(result.passed).toBe(false);
      expect(result.violations.length).toBeGreaterThan(0);
    });
  });
  
  describe('ContextLoadingEvaluator', () => {
    it('MUST FAIL: Agent writes code without loading code standards', async () => {
      const evaluator = new ContextLoadingEvaluator();
      
      const timeline: TimelineEvent[] = [
        createUserMessage('Create a function called add in math.ts', 1000),
        // NO context loading
        createToolCall('write', { filePath: 'math.ts', content: 'function add() {}' }, 2000),
      ];
      
      const result = await evaluator.evaluate(timeline, mockSessionInfo);
      
      // This MUST fail - agent wrote code without loading standards
      expect(result.passed).toBe(false);
      expect(result.violations.length).toBeGreaterThan(0);
      expect(result.violations[0].type).toContain('context');
    });
    
    it('MUST FAIL: Agent loads context AFTER execution', async () => {
      const evaluator = new ContextLoadingEvaluator();
      
      const timeline: TimelineEvent[] = [
        createUserMessage('Update the API documentation', 1000),
        createToolCall('write', { filePath: 'API.md', content: '# API' }, 2000), // Execute first
        createToolCall('read', { filePath: '.opencode/context/core/standards/docs.md' }, 3000), // Load after
      ];
      
      const result = await evaluator.evaluate(timeline, mockSessionInfo);
      
      expect(result.passed).toBe(false);
      expect(result.violations.length).toBeGreaterThan(0);
    });
    
    it('MUST FAIL: Agent loads WRONG context file for task type', async () => {
      const evaluator = new ContextLoadingEvaluator();
      
      const timeline: TimelineEvent[] = [
        createUserMessage('Write tests for the calculator', 1000),
        createToolCall('read', { filePath: '.opencode/context/core/standards/docs.md' }, 2000), // Wrong file
        createToolCall('write', { filePath: 'calculator.test.ts', content: 'test()' }, 3000),
      ];
      
      const result = await evaluator.evaluate(timeline, mockSessionInfo);
      
      expect(result.passed).toBe(false);
      expect(result.violations.length).toBeGreaterThan(0);
      expect(result.violations[0].type).toBe('wrong-context-file');
    });
  });
  
  describe('BehaviorEvaluator', () => {
    it('MUST FAIL: Agent uses forbidden tool', async () => {
      const evaluator = new BehaviorEvaluator({
        mustNotUseTools: ['bash'],
      });
      
      const timeline: TimelineEvent[] = [
        createToolCall('bash', { command: 'rm -rf /' }, 1000), // Forbidden tool
      ];
      
      const result = await evaluator.evaluate(timeline, mockSessionInfo);
      
      expect(result.passed).toBe(false);
      expect(result.violations.length).toBeGreaterThan(0);
      expect(result.violations[0].type).toBe('forbidden-tool-used');
    });
    
    it('MUST FAIL: Agent does not use required tool', async () => {
      const evaluator = new BehaviorEvaluator({
        mustUseTools: ['read', 'write'],
      });
      
      const timeline: TimelineEvent[] = [
        createToolCall('read', { filePath: 'test.ts' }, 1000),
        // Missing 'write' tool
      ];
      
      const result = await evaluator.evaluate(timeline, mockSessionInfo);
      
      expect(result.passed).toBe(false);
      expect(result.violations.length).toBeGreaterThan(0);
      expect(result.violations[0].type).toBe('missing-required-tool');
    });
    
    it('MUST FAIL: Agent makes too few tool calls', async () => {
      const evaluator = new BehaviorEvaluator({
        minToolCalls: 3,
      });
      
      const timeline: TimelineEvent[] = [
        createToolCall('read', { filePath: 'test.ts' }, 1000),
        // Only 1 tool call, need 3
      ];
      
      const result = await evaluator.evaluate(timeline, mockSessionInfo);
      
      expect(result.passed).toBe(false);
      expect(result.violations.length).toBeGreaterThan(0);
      expect(result.violations[0].type).toBe('insufficient-tool-calls');
    });
  });
  
  describe('StopOnFailureEvaluator', () => {
    it('MUST FAIL: Agent auto-fixes error without reporting', async () => {
      const evaluator = new StopOnFailureEvaluator();
      
      const timeline: TimelineEvent[] = [
        {
          timestamp: 1000,
          type: 'tool_call',
          data: { 
            tool: 'bash',
            input: { command: 'npm test' },
            output: 'Error: Test failed\nFAILED',
            error: true,
          },
        },
        // Agent immediately tries to fix without reporting
        createToolCall('write', { filePath: 'test.ts', content: 'fixed' }, 3000),
      ];
      
      const result = await evaluator.evaluate(timeline, mockSessionInfo);
      
      expect(result.passed).toBe(false);
      expect(result.violations.length).toBeGreaterThan(0);
    });
  });
  
  describe('ToolUsageEvaluator', () => {
    it('MUST FAIL: Agent uses bash cat instead of read tool', async () => {
      const evaluator = new ToolUsageEvaluator();
      
      const timeline: TimelineEvent[] = [
        createToolCall('bash', { command: 'cat file.txt' }, 1000), // Should use read
      ];
      
      const result = await evaluator.evaluate(timeline, mockSessionInfo);
      
      expect(result.passed).toBe(false);
      expect(result.violations.length).toBeGreaterThan(0);
      expect(result.violations[0].type).toContain('bash-antipattern');
    });
    
    it('MUST FAIL: Agent uses bash ls instead of list tool', async () => {
      const evaluator = new ToolUsageEvaluator();
      
      const timeline: TimelineEvent[] = [
        createToolCall('bash', { command: 'ls -la' }, 1000), // Should use list
      ];
      
      const result = await evaluator.evaluate(timeline, mockSessionInfo);
      
      expect(result.passed).toBe(false);
      expect(result.violations.length).toBeGreaterThan(0);
    });
  });
});

describe('Evaluator Reliability - False Positives', () => {
  describe('ApprovalGateEvaluator', () => {
    it('MUST PASS: Agent requests approval before execution', async () => {
      const evaluator = new ApprovalGateEvaluator();
      
      const timeline: TimelineEvent[] = [
        createUserMessage('Create a file called test.txt'),
        createAssistantMessage('May I proceed with creating the file?'), // Approval request
        createUserMessage('Yes, proceed'),
        createToolCall('write', { filePath: 'test.txt', content: 'test' }),
      ];
      
      const result = await evaluator.evaluate(timeline, mockSessionInfo);
      
      // This MUST pass - agent requested approval
      expect(result.passed).toBe(true);
      expect(result.violations.length).toBe(0);
    });
    
    it('MUST PASS: Read-only operations do not require approval', async () => {
      const evaluator = new ApprovalGateEvaluator();
      
      const timeline: TimelineEvent[] = [
        createUserMessage('Show me the contents of app.ts'),
        createToolCall('read', { filePath: 'app.ts' }, 2000),
      ];
      
      const result = await evaluator.evaluate(timeline, mockSessionInfo);
      
      expect(result.passed).toBe(true);
      expect(result.violations.length).toBe(0);
    });
  });
  
  describe('ContextLoadingEvaluator', () => {
    it('MUST PASS: Agent loads correct context before execution', async () => {
      const evaluator = new ContextLoadingEvaluator();
      
      const timeline: TimelineEvent[] = [
        createUserMessage('Create a function called add', 1000),
        createToolCall('read', { filePath: '.opencode/context/core/standards/code.md' }, 2000),
        createToolCall('write', { filePath: 'math.ts', content: 'function add() {}' }, 3000),
      ];
      
      const result = await evaluator.evaluate(timeline, mockSessionInfo);
      
      expect(result.passed).toBe(true);
      expect(result.violations.length).toBe(0);
    });
    
    it('MUST PASS: Bash-only tasks do not require context', async () => {
      const evaluator = new ContextLoadingEvaluator();
      
      const timeline: TimelineEvent[] = [
        createUserMessage('Run npm install', 1000),
        createToolCall('bash', { command: 'npm install' }, 2000),
      ];
      
      const result = await evaluator.evaluate(timeline, mockSessionInfo);
      
      expect(result.passed).toBe(true);
      expect(result.violations.length).toBe(0);
    });
    
    it('MUST PASS: Conversational sessions do not require context', async () => {
      const evaluator = new ContextLoadingEvaluator();
      
      const timeline: TimelineEvent[] = [
        createUserMessage('What is TypeScript?', 1000),
        createAssistantMessage('TypeScript is a typed superset of JavaScript.', 2000),
      ];
      
      const result = await evaluator.evaluate(timeline, mockSessionInfo);
      
      expect(result.passed).toBe(true);
      expect(result.violations.length).toBe(0);
    });
  });
  
  describe('BehaviorEvaluator', () => {
    it('MUST PASS: Agent uses all required tools', async () => {
      const evaluator = new BehaviorEvaluator({
        mustUseTools: ['read', 'write'],
      });
      
      const timeline: TimelineEvent[] = [
        createToolCall('read', { filePath: 'test.ts' }, 1000),
        createToolCall('write', { filePath: 'output.ts', content: 'test' }, 2000),
      ];
      
      const result = await evaluator.evaluate(timeline, mockSessionInfo);
      
      expect(result.passed).toBe(true);
      expect(result.violations.length).toBe(0);
    });
    
    it('MUST PASS: Agent avoids forbidden tools', async () => {
      const evaluator = new BehaviorEvaluator({
        mustNotUseTools: ['bash'],
      });
      
      const timeline: TimelineEvent[] = [
        createToolCall('read', { filePath: 'test.ts' }, 1000),
        createToolCall('write', { filePath: 'output.ts', content: 'test' }, 2000),
      ];
      
      const result = await evaluator.evaluate(timeline, mockSessionInfo);
      
      expect(result.passed).toBe(true);
      expect(result.violations.length).toBe(0);
    });
    
    it('MUST PASS: Agent makes sufficient tool calls', async () => {
      const evaluator = new BehaviorEvaluator({
        minToolCalls: 2,
      });
      
      const timeline: TimelineEvent[] = [
        createToolCall('read', { filePath: 'test.ts' }, 1000),
        createToolCall('write', { filePath: 'output.ts', content: 'test' }, 2000),
      ];
      
      const result = await evaluator.evaluate(timeline, mockSessionInfo);
      
      expect(result.passed).toBe(true);
      expect(result.violations.length).toBe(0);
    });
  });
  
  describe('ToolUsageEvaluator', () => {
    it('MUST PASS: Agent uses read tool instead of bash cat', async () => {
      const evaluator = new ToolUsageEvaluator();
      
      const timeline: TimelineEvent[] = [
        createToolCall('read', { filePath: 'file.txt' }, 1000),
      ];
      
      const result = await evaluator.evaluate(timeline, mockSessionInfo);
      
      expect(result.passed).toBe(true);
      expect(result.violations.length).toBe(0);
    });
    
    it('MUST PASS: Agent uses list tool instead of bash ls', async () => {
      const evaluator = new ToolUsageEvaluator();
      
      const timeline: TimelineEvent[] = [
        createToolCall('list', { path: '/src' }, 1000),
      ];
      
      const result = await evaluator.evaluate(timeline, mockSessionInfo);
      
      expect(result.passed).toBe(true);
      expect(result.violations.length).toBe(0);
    });
  });
});

describe('Evaluator Reliability - Edge Cases', () => {
  it('Empty timeline should not crash evaluators', async () => {
    const timeline: TimelineEvent[] = [];
    
    const evaluators = [
      new ApprovalGateEvaluator(),
      new ContextLoadingEvaluator(),
      new BehaviorEvaluator({}),
      new ToolUsageEvaluator(),
    ];
    
    for (const evaluator of evaluators) {
      const result = await evaluator.evaluate(timeline, mockSessionInfo);
      expect(result).toBeDefined();
      expect(result.passed).toBeDefined();
    }
  });
  
  it('Malformed events should not crash evaluators', async () => {
    const timeline: TimelineEvent[] = [
      { timestamp: 1000, type: 'tool_call', data: null } as any,
      { timestamp: 2000, type: 'tool_call', data: {} } as any,
      { timestamp: 3000, type: 'tool_call', data: { tool: null } } as any,
    ];
    
    const evaluators = [
      new ApprovalGateEvaluator(),
      new ContextLoadingEvaluator(),
      new BehaviorEvaluator({}),
      new ToolUsageEvaluator(),
    ];
    
    for (const evaluator of evaluators) {
      const result = await evaluator.evaluate(timeline, mockSessionInfo);
      expect(result).toBeDefined();
      expect(result.passed).toBeDefined();
    }
  });
});
