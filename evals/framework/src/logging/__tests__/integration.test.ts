/**
 * Integration Test - Multi-Agent Logging System
 * 
 * Demonstrates the complete logging system with a realistic delegation scenario.
 */

import { describe, it, expect } from 'vitest';
import { MultiAgentLogger } from '../logger.js';

describe('Multi-Agent Logging Integration', () => {
  it('logs complete delegation hierarchy', () => {
    const logger = new MultiAgentLogger(true);
    
    // Simulate parent session (openagent)
    logger.logSessionStart('ses_parent_123', 'openagent');
    logger.logMessage('ses_parent_123', 'user', 'Call simple-responder subagent');
    logger.logMessage('ses_parent_123', 'assistant', 'I will delegate to simple-responder...');
    
    // Simulate delegation
    const delegationId = logger.logDelegation(
      'ses_parent_123',
      'simple-responder',
      'Respond with AWESOME TESTING'
    );
    
    // Simulate child session creation
    logger.logSessionStart('ses_child_456', 'simple-responder', 'ses_parent_123');
    logger.logChildLinked(delegationId, 'ses_child_456');
    
    // Simulate child session activity
    logger.logMessage('ses_child_456', 'user', 'Respond with AWESOME TESTING');
    logger.logMessage('ses_child_456', 'assistant', 'AWESOME TESTING');
    
    // Complete child session
    logger.logSessionComplete('ses_child_456');
    
    // Parent continues
    logger.logMessage('ses_parent_123', 'assistant', 'Subagent responded with "AWESOME TESTING"');
    
    // Complete parent session
    logger.logSessionComplete('ses_parent_123');
    
    // Verify hierarchy was tracked correctly
    const tracker = logger.getTracker();
    
    const parent = tracker.getSession('ses_parent_123');
    const child = tracker.getSession('ses_child_456');
    
    expect(parent).toBeDefined();
    expect(child).toBeDefined();
    
    expect(parent?.depth).toBe(0);
    expect(child?.depth).toBe(1);
    
    expect(parent?.children).toHaveLength(1);
    expect(parent?.children[0].sessionId).toBe('ses_child_456');
    
    expect(child?.parentId).toBe('ses_parent_123');
    
    // Verify delegation was tracked
    const delegation = tracker.getDelegation(delegationId);
    expect(delegation).toBeDefined();
    expect(delegation?.parentSessionId).toBe('ses_parent_123');
    expect(delegation?.childSessionId).toBe('ses_child_456');
    expect(delegation?.toAgent).toBe('simple-responder');
    
    // Verify tree structure
    const tree = tracker.buildTree('ses_parent_123');
    expect(tree).toBeDefined();
    expect(tree?.totalSessions).toBe(2);
    expect(tree?.maxDepth).toBe(1);
    expect(tree?.delegations).toHaveLength(1);
  });
  
  it('handles nested delegation (3 levels)', () => {
    const logger = new MultiAgentLogger(true);
    
    // Level 0: openagent
    logger.logSessionStart('ses_root', 'openagent');
    logger.logMessage('ses_root', 'user', 'Build a feature');
    
    // Delegate to task-manager
    const del1 = logger.logDelegation('ses_root', 'task-manager', 'Break down feature');
    logger.logSessionStart('ses_level1', 'task-manager', 'ses_root');
    logger.logChildLinked(del1, 'ses_level1');
    
    // Level 1: task-manager delegates to coder-agent
    const del2 = logger.logDelegation('ses_level1', 'coder-agent', 'Implement subtask');
    logger.logSessionStart('ses_level2', 'coder-agent', 'ses_level1');
    logger.logChildLinked(del2, 'ses_level2');
    
    // Level 2: coder-agent works
    logger.logMessage('ses_level2', 'assistant', 'Implementing...');
    logger.logToolCall('ses_level2', 'write', { filePath: '/path/to/file.ts' });
    logger.logSessionComplete('ses_level2');
    
    // Complete level 1
    logger.logSessionComplete('ses_level1');
    
    // Complete root
    logger.logSessionComplete('ses_root');
    
    // Verify 3-level hierarchy
    const tracker = logger.getTracker();
    const tree = tracker.buildTree('ses_root');
    
    expect(tree?.totalSessions).toBe(3);
    expect(tree?.maxDepth).toBe(2);
    expect(tree?.delegations).toHaveLength(2);
    
    const root = tracker.getSession('ses_root');
    const level1 = tracker.getSession('ses_level1');
    const level2 = tracker.getSession('ses_level2');
    
    expect(root?.depth).toBe(0);
    expect(level1?.depth).toBe(1);
    expect(level2?.depth).toBe(2);
  });
  
  it('handles parallel delegation (2 children)', () => {
    const logger = new MultiAgentLogger(true);
    
    // Parent session
    logger.logSessionStart('ses_parent', 'openagent');
    
    // Delegate to tester
    const del1 = logger.logDelegation('ses_parent', 'tester', 'Write tests');
    logger.logSessionStart('ses_tester', 'tester', 'ses_parent');
    logger.logChildLinked(del1, 'ses_tester');
    
    // Delegate to reviewer (parallel)
    const del2 = logger.logDelegation('ses_parent', 'reviewer', 'Review code');
    logger.logSessionStart('ses_reviewer', 'reviewer', 'ses_parent');
    logger.logChildLinked(del2, 'ses_reviewer');
    
    // Both children work
    logger.logMessage('ses_tester', 'assistant', 'Writing tests...');
    logger.logMessage('ses_reviewer', 'assistant', 'Reviewing code...');
    
    // Complete both
    logger.logSessionComplete('ses_tester');
    logger.logSessionComplete('ses_reviewer');
    logger.logSessionComplete('ses_parent');
    
    // Verify parallel structure
    const tracker = logger.getTracker();
    const parent = tracker.getSession('ses_parent');
    
    expect(parent?.children).toHaveLength(2);
    expect(parent?.children.map(c => c.agent)).toContain('tester');
    expect(parent?.children.map(c => c.agent)).toContain('reviewer');
    
    const tree = tracker.buildTree('ses_parent');
    expect(tree?.totalSessions).toBe(3);
    expect(tree?.maxDepth).toBe(1);
    expect(tree?.delegations).toHaveLength(2);
  });
});
