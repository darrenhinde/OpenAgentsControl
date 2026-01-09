/**
 * Unit tests for BehaviorEvaluator
 * 
 * Tests the behavior validation logic to ensure it correctly:
 * - Detects required tools (mustUseTools)
 * - Detects forbidden tools (mustNotUseTools)
 * - Validates tool call counts (minToolCalls, maxToolCalls)
 * - Checks approval requests (requiresApproval)
 * - Checks context loading (requiresContext)
 * - Checks delegation (shouldDelegate)
 */

import { describe, it, expect } from 'vitest';
import { BehaviorEvaluator } from '../behavior-evaluator.js';
import type { TimelineEvent, SessionInfo } from '../../types/index.js';

// Helper to create mock timeline events
function createToolCallEvent(tool: string, input: any = {}, timestamp = Date.now()): TimelineEvent {
  return {
    timestamp,
    type: 'tool_call',
    messageId: 'msg-1',
    partId: 'part-1',
    data: {
      tool,
      input,
      type: 'tool',
    },
  };
}

function createTextEvent(text: string, timestamp = Date.now()): TimelineEvent {
  return {
    timestamp,
    type: 'text',
    messageId: 'msg-1',
    partId: 'part-1',
    data: {
      text,
      type: 'text',
    },
  };
}

function createAssistantMessageEvent(text: string, timestamp = Date.now()): TimelineEvent {
  return {
    timestamp,
    type: 'assistant_message',
    messageId: 'msg-1',
    data: {
      text,
    },
  };
}

const mockSessionInfo: SessionInfo = {
  id: 'test-session',
  version: '1.0',
  title: 'Test Session',
  time: {
    created: Date.now(),
    updated: Date.now(),
  },
};

describe('BehaviorEvaluator', () => {
  describe('mustUseTools', () => {
    it('should pass when all required tools are used', async () => {
      const evaluator = new BehaviorEvaluator({
        mustUseTools: ['read', 'write'],
      });

      const timeline: TimelineEvent[] = [
        createToolCallEvent('read', { filePath: '/test.ts' }),
        createToolCallEvent('write', { filePath: '/output.ts', content: 'test' }),
      ];

      const result = await evaluator.evaluate(timeline, mockSessionInfo);

      expect(result.passed).toBe(true);
      expect(result.violations).toHaveLength(0);
    });

    it('should fail when required tools are missing', async () => {
      const evaluator = new BehaviorEvaluator({
        mustUseTools: ['read', 'write'],
      });

      const timeline: TimelineEvent[] = [
        createToolCallEvent('read', { filePath: '/test.ts' }),
        // write is missing
      ];

      const result = await evaluator.evaluate(timeline, mockSessionInfo);

      expect(result.passed).toBe(false);
      expect(result.violations).toHaveLength(1);
      expect(result.violations[0].type).toBe('missing-required-tool');
      expect(result.violations[0].message).toContain('write');
    });

    it('should fail when no tools are used but tools are required', async () => {
      const evaluator = new BehaviorEvaluator({
        mustUseTools: ['bash'],
      });

      const timeline: TimelineEvent[] = [
        createTextEvent('I will help you with that'),
      ];

      const result = await evaluator.evaluate(timeline, mockSessionInfo);

      expect(result.passed).toBe(false);
      expect(result.violations).toHaveLength(1);
      expect(result.violations[0].type).toBe('missing-required-tool');
    });
  });

  describe('mustNotUseTools', () => {
    it('should pass when forbidden tools are not used', async () => {
      const evaluator = new BehaviorEvaluator({
        mustNotUseTools: ['bash'],
      });

      const timeline: TimelineEvent[] = [
        createToolCallEvent('read', { filePath: '/test.ts' }),
        createToolCallEvent('write', { filePath: '/output.ts' }),
      ];

      const result = await evaluator.evaluate(timeline, mockSessionInfo);

      expect(result.passed).toBe(true);
      expect(result.violations).toHaveLength(0);
    });

    it('should fail when forbidden tools are used', async () => {
      const evaluator = new BehaviorEvaluator({
        mustNotUseTools: ['bash'],
      });

      const timeline: TimelineEvent[] = [
        createToolCallEvent('read', { filePath: '/test.ts' }),
        createToolCallEvent('bash', { command: 'rm -rf /' }),
      ];

      const result = await evaluator.evaluate(timeline, mockSessionInfo);

      expect(result.passed).toBe(false);
      expect(result.violations).toHaveLength(1);
      expect(result.violations[0].type).toBe('forbidden-tool-used');
      expect(result.violations[0].message).toContain('bash');
    });
  });

  describe('minToolCalls', () => {
    it('should pass when tool calls meet minimum', async () => {
      const evaluator = new BehaviorEvaluator({
        minToolCalls: 2,
      });

      const timeline: TimelineEvent[] = [
        createToolCallEvent('read', { filePath: '/test.ts' }),
        createToolCallEvent('write', { filePath: '/output.ts' }),
      ];

      const result = await evaluator.evaluate(timeline, mockSessionInfo);

      expect(result.passed).toBe(true);
      expect(result.violations).toHaveLength(0);
    });

    it('should fail when tool calls are below minimum', async () => {
      const evaluator = new BehaviorEvaluator({
        minToolCalls: 3,
      });

      const timeline: TimelineEvent[] = [
        createToolCallEvent('read', { filePath: '/test.ts' }),
      ];

      const result = await evaluator.evaluate(timeline, mockSessionInfo);

      expect(result.passed).toBe(false);
      expect(result.violations).toHaveLength(1);
      expect(result.violations[0].type).toBe('insufficient-tool-calls');
    });
  });

  describe('maxToolCalls', () => {
    it('should pass when tool calls are within maximum', async () => {
      const evaluator = new BehaviorEvaluator({
        maxToolCalls: 5,
      });

      const timeline: TimelineEvent[] = [
        createToolCallEvent('read', { filePath: '/test.ts' }),
        createToolCallEvent('write', { filePath: '/output.ts' }),
      ];

      const result = await evaluator.evaluate(timeline, mockSessionInfo);

      expect(result.passed).toBe(true);
      expect(result.violations).toHaveLength(0);
    });

    it('should create warning violation when tool calls exceed maximum', async () => {
      const evaluator = new BehaviorEvaluator({
        maxToolCalls: 1,
      });

      const timeline: TimelineEvent[] = [
        createToolCallEvent('read', { filePath: '/test.ts' }),
        createToolCallEvent('write', { filePath: '/output.ts' }),
        createToolCallEvent('bash', { command: 'ls' }),
      ];

      const result = await evaluator.evaluate(timeline, mockSessionInfo);

      // maxToolCalls creates a WARNING, not an error, so the evaluator still passes
      // This is intentional - exceeding max tool calls is a soft limit
      expect(result.passed).toBe(true);
      expect(result.violations).toHaveLength(1);
      expect(result.violations[0].type).toBe('excessive-tool-calls');
      expect(result.violations[0].severity).toBe('warning');
    });
  });

  describe('requiresApproval', () => {
    it('should pass when approval language is present', async () => {
      const evaluator = new BehaviorEvaluator({
        requiresApproval: true,
      });

      const timeline: TimelineEvent[] = [
        createAssistantMessageEvent('May I proceed with creating the file?'),
        createToolCallEvent('write', { filePath: '/output.ts' }),
      ];

      const result = await evaluator.evaluate(timeline, mockSessionInfo);

      expect(result.passed).toBe(true);
      expect(result.violations).toHaveLength(0);
    });

    it('should fail when approval language is missing', async () => {
      const evaluator = new BehaviorEvaluator({
        requiresApproval: true,
      });

      const timeline: TimelineEvent[] = [
        createAssistantMessageEvent('I will create the file now.'),
        createToolCallEvent('write', { filePath: '/output.ts' }),
      ];

      const result = await evaluator.evaluate(timeline, mockSessionInfo);

      expect(result.passed).toBe(false);
      expect(result.violations).toHaveLength(1);
      expect(result.violations[0].type).toBe('missing-approval-request');
    });

    it('should detect various approval phrases', async () => {
      const approvalPhrases = [
        'Should I proceed?',
        'Would you like me to continue?',
        'Can I proceed with this?',
        'Shall I make these changes?',
        'Do you want me to execute this?',
        'Please confirm before I proceed',
      ];

      for (const phrase of approvalPhrases) {
        const evaluator = new BehaviorEvaluator({
          requiresApproval: true,
        });

        const timeline: TimelineEvent[] = [
          createAssistantMessageEvent(phrase),
        ];

        const result = await evaluator.evaluate(timeline, mockSessionInfo);
        expect(result.passed).toBe(true);
      }
    });
  });

  describe('requiresContext', () => {
    it('should pass when context files are loaded', async () => {
      const evaluator = new BehaviorEvaluator({
        requiresContext: true,
      });

      const timeline: TimelineEvent[] = [
        createToolCallEvent('read', { filePath: '/project/.opencode/context/standards.md' }),
        createToolCallEvent('write', { filePath: '/output.ts' }),
      ];

      const result = await evaluator.evaluate(timeline, mockSessionInfo);

      expect(result.passed).toBe(true);
      expect(result.violations).toHaveLength(0);
    });

    it('should fail when no context files are loaded', async () => {
      const evaluator = new BehaviorEvaluator({
        requiresContext: true,
      });

      const timeline: TimelineEvent[] = [
        createToolCallEvent('read', { filePath: '/src/utils.ts' }),
        createToolCallEvent('write', { filePath: '/output.ts' }),
      ];

      const result = await evaluator.evaluate(timeline, mockSessionInfo);

      expect(result.passed).toBe(false);
      expect(result.violations).toHaveLength(1);
      expect(result.violations[0].type).toBe('missing-context-loading');
    });

    it('should recognize various context file patterns', async () => {
      const contextFiles = [
        '/project/.opencode/agent/openagent.md',
        '/project/.opencode/context/core/standards.md',
        '/project/docs/api.md',
        '/project/CONTRIBUTING.md',
        '/project/README.md',
      ];

      for (const filePath of contextFiles) {
        const evaluator = new BehaviorEvaluator({
          requiresContext: true,
        });

        const timeline: TimelineEvent[] = [
          createToolCallEvent('read', { filePath }),
        ];

        const result = await evaluator.evaluate(timeline, mockSessionInfo);
        expect(result.passed).toBe(true);
      }
    });
  });

  describe('shouldDelegate', () => {
    it('should pass when delegation is used', async () => {
      const evaluator = new BehaviorEvaluator({
        shouldDelegate: true,
      });

      const timeline: TimelineEvent[] = [
        createToolCallEvent('task', { 
          subagent_type: 'CoderAgent',
          prompt: 'Implement the feature',
        }),
      ];

      const result = await evaluator.evaluate(timeline, mockSessionInfo);

      expect(result.passed).toBe(true);
      expect(result.violations).toHaveLength(0);
    });

    it('should create warning violation when delegation is not used but suggested', async () => {
      const evaluator = new BehaviorEvaluator({
        shouldDelegate: true,
      });

      const timeline: TimelineEvent[] = [
        createToolCallEvent('write', { filePath: '/output.ts' }),
      ];

      const result = await evaluator.evaluate(timeline, mockSessionInfo);

      // shouldDelegate creates a WARNING, not an error, so the evaluator still passes
      // This is intentional - delegation is a suggestion, not a hard requirement
      expect(result.passed).toBe(true);
      expect(result.violations).toHaveLength(1);
      expect(result.violations[0].type).toBe('missing-delegation');
      expect(result.violations[0].severity).toBe('warning');
    });
  });

  describe('combined expectations', () => {
    it('should validate multiple expectations together', async () => {
      const evaluator = new BehaviorEvaluator({
        mustUseTools: ['read', 'write'],
        mustNotUseTools: ['bash'],
        minToolCalls: 2,
        maxToolCalls: 5,
      });

      const timeline: TimelineEvent[] = [
        createToolCallEvent('read', { filePath: '/test.ts' }),
        createToolCallEvent('write', { filePath: '/output.ts' }),
      ];

      const result = await evaluator.evaluate(timeline, mockSessionInfo);

      expect(result.passed).toBe(true);
      expect(result.violations).toHaveLength(0);
    });

    it('should report all violations when multiple expectations fail', async () => {
      const evaluator = new BehaviorEvaluator({
        mustUseTools: ['read', 'write'],
        minToolCalls: 3,
      });

      const timeline: TimelineEvent[] = [
        createToolCallEvent('read', { filePath: '/test.ts' }),
        // write is missing, and only 1 tool call
      ];

      const result = await evaluator.evaluate(timeline, mockSessionInfo);

      expect(result.passed).toBe(false);
      expect(result.violations.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('tool data extraction', () => {
    it('should extract tool name from data.tool', async () => {
      const evaluator = new BehaviorEvaluator({
        mustUseTools: ['read'],
      });

      const timeline: TimelineEvent[] = [
        {
          timestamp: Date.now(),
          type: 'tool_call',
          messageId: 'msg-1',
          partId: 'part-1',
          data: {
            tool: 'read',
            input: { filePath: '/test.ts' },
          },
        },
      ];

      const result = await evaluator.evaluate(timeline, mockSessionInfo);
      expect(result.passed).toBe(true);
    });

    it('should extract tool name from data.state.tool', async () => {
      const evaluator = new BehaviorEvaluator({
        mustUseTools: ['read'],
      });

      const timeline: TimelineEvent[] = [
        {
          timestamp: Date.now(),
          type: 'tool_call',
          messageId: 'msg-1',
          partId: 'part-1',
          data: {
            state: {
              tool: 'read',
              input: { filePath: '/test.ts' },
            },
          },
        },
      ];

      const result = await evaluator.evaluate(timeline, mockSessionInfo);
      expect(result.passed).toBe(true);
    });
  });
});
