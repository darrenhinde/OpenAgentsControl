/**
 * Multi-Agent Logger Tests
 * 
 * Tests the MultiAgentLogger class for pretty-printing delegation hierarchies.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { MultiAgentLogger } from '../logger.js';

describe('MultiAgentLogger', () => {
  let logger: MultiAgentLogger;
  let consoleLogSpy: any;
  
  beforeEach(() => {
    logger = new MultiAgentLogger(true);
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  });
  
  afterEach(() => {
    consoleLogSpy.mockRestore();
  });
  
  describe('logSessionStart', () => {
    it('logs root session with PARENT label', () => {
      logger.logSessionStart('session-1', 'openagent');
      
      expect(consoleLogSpy).toHaveBeenCalled();
      const output = consoleLogSpy.mock.calls[0][0];
      expect(output).toContain('PARENT');
      expect(output).toContain('openagent');
      expect(output).toContain('session-1');
    });
    
    it('logs child session with CHILD label', () => {
      logger.logSessionStart('parent-1', 'openagent');
      consoleLogSpy.mockClear();
      
      logger.logSessionStart('child-1', 'simple-responder', 'parent-1');
      
      expect(consoleLogSpy).toHaveBeenCalled();
      const output = consoleLogSpy.mock.calls[0][0];
      expect(output).toContain('CHILD');
      expect(output).toContain('simple-responder');
      expect(output).toContain('Parent:');
    });
    
    it('does not log when disabled', () => {
      logger.setEnabled(false);
      logger.logSessionStart('session-1', 'openagent');
      
      expect(consoleLogSpy).not.toHaveBeenCalled();
    });
  });
  
  describe('logDelegation', () => {
    it('logs delegation event and returns delegation ID', () => {
      logger.logSessionStart('parent-1', 'openagent');
      consoleLogSpy.mockClear();
      
      const delegationId = logger.logDelegation(
        'parent-1',
        'simple-responder',
        'Respond with AWESOME TESTING'
      );
      
      expect(delegationId).toBeDefined();
      expect(delegationId).toMatch(/^del_/);
      expect(consoleLogSpy).toHaveBeenCalled();
      
      const output = consoleLogSpy.mock.calls[0][0];
      expect(output).toContain('TOOL: task');
      expect(output).toContain('simple-responder');
      expect(output).toContain('Creating child session');
    });
    
    it('tracks delegation in session tracker', () => {
      logger.logSessionStart('parent-1', 'openagent');
      
      const delegationId = logger.logDelegation(
        'parent-1',
        'tester',
        'write tests'
      );
      
      const tracker = logger.getTracker();
      const delegation = tracker.getDelegation(delegationId);
      
      expect(delegation).toBeDefined();
      expect(delegation?.toAgent).toBe('tester');
    });
  });
  
  describe('logChildLinked', () => {
    it('logs child session link', () => {
      logger.logSessionStart('parent-1', 'openagent');
      const delegationId = logger.logDelegation('parent-1', 'tester', 'test');
      consoleLogSpy.mockClear();
      
      logger.logChildLinked(delegationId, 'child-1');
      
      expect(consoleLogSpy).toHaveBeenCalled();
      const output = consoleLogSpy.mock.calls[0][0];
      expect(output).toContain('Child session:');
      expect(output).toContain('child-1');
    });
  });
  
  describe('logMessage', () => {
    it('logs user message with emoji', () => {
      logger.logSessionStart('session-1', 'openagent');
      consoleLogSpy.mockClear();
      
      logger.logMessage('session-1', 'user', 'Hello, can you help me?');
      
      expect(consoleLogSpy).toHaveBeenCalled();
      const output = consoleLogSpy.mock.calls[0][0];
      expect(output).toContain('📝');
      expect(output).toContain('User:');
      expect(output).toContain('Hello, can you help me?');
    });
    
    it('logs assistant message with emoji', () => {
      logger.logSessionStart('session-1', 'openagent');
      consoleLogSpy.mockClear();
      
      logger.logMessage('session-1', 'assistant', 'Yes, I can help!');
      
      expect(consoleLogSpy).toHaveBeenCalled();
      const output = consoleLogSpy.mock.calls[0][0];
      expect(output).toContain('🤖');
      expect(output).toContain('Agent:');
      expect(output).toContain('Yes, I can help!');
    });
    
    it('truncates long messages', () => {
      logger.logSessionStart('session-1', 'openagent');
      consoleLogSpy.mockClear();
      
      const longMessage = 'a'.repeat(100);
      logger.logMessage('session-1', 'user', longMessage);
      
      const output = consoleLogSpy.mock.calls[0][0];
      expect(output).toContain('...');
      expect(output.length).toBeLessThan(longMessage.length + 50);
    });
  });
  
  describe('logToolCall', () => {
    it('logs tool call with file path', () => {
      logger.logSessionStart('session-1', 'openagent');
      consoleLogSpy.mockClear();
      
      logger.logToolCall('session-1', 'read', { filePath: '/path/to/file.ts' });
      
      expect(consoleLogSpy).toHaveBeenCalled();
      const output = consoleLogSpy.mock.calls[0][0];
      expect(output).toContain('🔧');
      expect(output).toContain('TOOL: read');
      expect(output).toContain('/path/to/file.ts');
    });
    
    it('skips task tool (handled by logDelegation)', () => {
      logger.logSessionStart('session-1', 'openagent');
      consoleLogSpy.mockClear();
      
      logger.logToolCall('session-1', 'task', { subagent_type: 'tester' });
      
      expect(consoleLogSpy).not.toHaveBeenCalled();
    });
  });
  
  describe('logSessionComplete', () => {
    it('logs PARENT completion for root session', () => {
      logger.logSessionStart('session-1', 'openagent');
      consoleLogSpy.mockClear();
      
      // Wait a bit to have measurable duration
      setTimeout(() => {
        logger.logSessionComplete('session-1');
        
        expect(consoleLogSpy).toHaveBeenCalled();
        const output = consoleLogSpy.mock.calls[0][0];
        expect(output).toContain('✅');
        expect(output).toContain('PARENT COMPLETE');
        expect(output).toMatch(/\d+\.\d+s/); // Duration in seconds
      }, 10);
    });
    
    it('logs CHILD completion for child session', () => {
      logger.logSessionStart('parent-1', 'openagent');
      logger.logSessionStart('child-1', 'tester', 'parent-1');
      consoleLogSpy.mockClear();
      
      logger.logSessionComplete('child-1');
      
      expect(consoleLogSpy).toHaveBeenCalled();
      const output = consoleLogSpy.mock.calls[0][0];
      expect(output).toContain('CHILD COMPLETE');
    });
  });
  
  describe('logSystem', () => {
    it('logs system message', () => {
      logger.logSessionStart('session-1', 'openagent');
      consoleLogSpy.mockClear();
      
      logger.logSystem('session-1', 'Test system message');
      
      expect(consoleLogSpy).toHaveBeenCalled();
      const output = consoleLogSpy.mock.calls[0][0];
      expect(output).toContain('ℹ️');
      expect(output).toContain('Test system message');
    });
  });
  
  describe('enable/disable', () => {
    it('can be disabled and re-enabled', () => {
      expect(logger.isEnabled()).toBe(true);
      
      logger.setEnabled(false);
      expect(logger.isEnabled()).toBe(false);
      
      logger.setEnabled(true);
      expect(logger.isEnabled()).toBe(true);
    });
  });
  
  describe('clear', () => {
    it('clears all tracked data', () => {
      logger.logSessionStart('session-1', 'openagent');
      logger.logDelegation('session-1', 'tester', 'test');
      
      const tracker = logger.getTracker();
      expect(tracker.getSessionCount()).toBe(1);
      expect(tracker.getDelegationCount()).toBe(1);
      
      logger.clear();
      
      expect(tracker.getSessionCount()).toBe(0);
      expect(tracker.getDelegationCount()).toBe(0);
    });
  });
  
  describe('hierarchy visualization', () => {
    it('indents child sessions correctly', () => {
      logger.logSessionStart('root', 'openagent');
      consoleLogSpy.mockClear();
      
      logger.logSessionStart('child', 'tester', 'root');
      
      const output = consoleLogSpy.mock.calls[0][0];
      // Child should have indentation (starts with spaces)
      expect(output).toMatch(/^\n {2}/);
    });
    
    it('handles 3-level hierarchy', () => {
      logger.logSessionStart('root', 'openagent');
      logger.logSessionStart('level-1', 'task-manager', 'root');
      consoleLogSpy.mockClear();
      
      logger.logSessionStart('level-2', 'coder-agent', 'level-1');
      
      const output = consoleLogSpy.mock.calls[0][0];
      // Level 2 should have more indentation
      expect(output).toMatch(/^\n {4}/);
    });
  });
});
