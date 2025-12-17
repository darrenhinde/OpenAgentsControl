/**
 * Session Tracker Tests
 * 
 * Tests the SessionTracker class for tracking multi-agent delegation hierarchies.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { SessionTracker } from '../session-tracker.js';

describe('SessionTracker', () => {
  let tracker: SessionTracker;
  
  beforeEach(() => {
    tracker = new SessionTracker();
  });
  
  describe('registerSession', () => {
    it('registers a root session with depth 0', () => {
      tracker.registerSession('session-1', 'openagent');
      
      const session = tracker.getSession('session-1');
      
      expect(session).toBeDefined();
      expect(session?.sessionId).toBe('session-1');
      expect(session?.agent).toBe('openagent');
      expect(session?.depth).toBe(0);
      expect(session?.parentId).toBeUndefined();
      expect(session?.children).toEqual([]);
    });
    
    it('registers a child session with depth 1', () => {
      tracker.registerSession('parent-1', 'openagent');
      tracker.registerSession('child-1', 'simple-responder', 'parent-1');
      
      const child = tracker.getSession('child-1');
      
      expect(child).toBeDefined();
      expect(child?.sessionId).toBe('child-1');
      expect(child?.agent).toBe('simple-responder');
      expect(child?.depth).toBe(1);
      expect(child?.parentId).toBe('parent-1');
    });
    
    it('links child to parent in hierarchy', () => {
      tracker.registerSession('parent-1', 'openagent');
      tracker.registerSession('child-1', 'simple-responder', 'parent-1');
      
      const parent = tracker.getSession('parent-1');
      
      expect(parent?.children).toHaveLength(1);
      expect(parent?.children[0].sessionId).toBe('child-1');
    });
    
    it('handles nested delegation (3 levels)', () => {
      tracker.registerSession('root', 'openagent');
      tracker.registerSession('level-1', 'task-manager', 'root');
      tracker.registerSession('level-2', 'coder-agent', 'level-1');
      
      const root = tracker.getSession('root');
      const level1 = tracker.getSession('level-1');
      const level2 = tracker.getSession('level-2');
      
      expect(root?.depth).toBe(0);
      expect(level1?.depth).toBe(1);
      expect(level2?.depth).toBe(2);
      
      expect(root?.children).toHaveLength(1);
      expect(level1?.children).toHaveLength(1);
      expect(level2?.children).toHaveLength(0);
    });
  });
  
  describe('recordDelegation', () => {
    it('records a delegation event', () => {
      tracker.registerSession('parent-1', 'openagent');
      
      const delegationId = tracker.recordDelegation(
        'parent-1',
        'simple-responder',
        'Respond with AWESOME TESTING'
      );
      
      const delegation = tracker.getDelegation(delegationId);
      
      expect(delegation).toBeDefined();
      expect(delegation?.parentSessionId).toBe('parent-1');
      expect(delegation?.fromAgent).toBe('openagent');
      expect(delegation?.toAgent).toBe('simple-responder');
      expect(delegation?.prompt).toBe('Respond with AWESOME TESTING');
      expect(delegation?.childSessionId).toBeUndefined();
    });
    
    it('generates unique delegation IDs', () => {
      tracker.registerSession('parent-1', 'openagent');
      
      const id1 = tracker.recordDelegation('parent-1', 'agent-1', 'task 1');
      const id2 = tracker.recordDelegation('parent-1', 'agent-2', 'task 2');
      
      expect(id1).not.toBe(id2);
    });
  });
  
  describe('linkChildSession', () => {
    it('links child session to delegation', () => {
      tracker.registerSession('parent-1', 'openagent');
      
      const delegationId = tracker.recordDelegation(
        'parent-1',
        'simple-responder',
        'test prompt'
      );
      
      tracker.linkChildSession(delegationId, 'child-1');
      
      const delegation = tracker.getDelegation(delegationId);
      expect(delegation?.childSessionId).toBe('child-1');
    });
  });
  
  describe('completeSession', () => {
    it('marks session as complete with endTime', () => {
      tracker.registerSession('session-1', 'openagent');
      
      const session = tracker.getSession('session-1');
      expect(session?.endTime).toBeUndefined();
      
      tracker.completeSession('session-1');
      
      const completedSession = tracker.getSession('session-1');
      expect(completedSession?.endTime).toBeDefined();
      expect(completedSession?.endTime).toBeGreaterThanOrEqual(completedSession!.startTime);
    });
  });
  
  describe('getSessionsAtDepth', () => {
    it('returns all sessions at specified depth', () => {
      tracker.registerSession('root-1', 'openagent');
      tracker.registerSession('root-2', 'opencoder');
      tracker.registerSession('child-1', 'tester', 'root-1');
      tracker.registerSession('child-2', 'reviewer', 'root-1');
      
      const rootSessions = tracker.getSessionsAtDepth(0);
      const childSessions = tracker.getSessionsAtDepth(1);
      
      expect(rootSessions).toHaveLength(2);
      expect(childSessions).toHaveLength(2);
    });
  });
  
  describe('getRootSessions', () => {
    it('returns all root sessions', () => {
      tracker.registerSession('root-1', 'openagent');
      tracker.registerSession('root-2', 'opencoder');
      tracker.registerSession('child-1', 'tester', 'root-1');
      
      const roots = tracker.getRootSessions();
      
      expect(roots).toHaveLength(2);
      expect(roots.map(r => r.sessionId)).toContain('root-1');
      expect(roots.map(r => r.sessionId)).toContain('root-2');
    });
  });
  
  describe('getDelegationsFromSession', () => {
    it('returns all delegations from a session', () => {
      tracker.registerSession('parent-1', 'openagent');
      
      tracker.recordDelegation('parent-1', 'tester', 'write tests');
      tracker.recordDelegation('parent-1', 'reviewer', 'review code');
      
      const delegations = tracker.getDelegationsFromSession('parent-1');
      
      expect(delegations).toHaveLength(2);
      expect(delegations.map(d => d.toAgent)).toContain('tester');
      expect(delegations.map(d => d.toAgent)).toContain('reviewer');
    });
  });
  
  describe('buildTree', () => {
    it('builds complete session tree', () => {
      tracker.registerSession('root', 'openagent');
      tracker.registerSession('child-1', 'tester', 'root');
      tracker.registerSession('child-2', 'reviewer', 'root');
      tracker.registerSession('grandchild', 'coder-agent', 'child-1');
      
      tracker.recordDelegation('root', 'tester', 'test task');
      tracker.recordDelegation('root', 'reviewer', 'review task');
      tracker.recordDelegation('child-1', 'coder-agent', 'code task');
      
      const tree = tracker.buildTree('root');
      
      expect(tree).toBeDefined();
      expect(tree?.root.sessionId).toBe('root');
      expect(tree?.totalSessions).toBe(4);
      expect(tree?.maxDepth).toBe(2);
      expect(tree?.delegations).toHaveLength(3);
    });
    
    it('returns null for non-existent session', () => {
      const tree = tracker.buildTree('non-existent');
      expect(tree).toBeNull();
    });
  });
  
  describe('clear', () => {
    it('clears all tracked data', () => {
      tracker.registerSession('session-1', 'openagent');
      tracker.recordDelegation('session-1', 'tester', 'test');
      
      expect(tracker.getSessionCount()).toBe(1);
      expect(tracker.getDelegationCount()).toBe(1);
      
      tracker.clear();
      
      expect(tracker.getSessionCount()).toBe(0);
      expect(tracker.getDelegationCount()).toBe(0);
    });
  });
  
  describe('edge cases', () => {
    it('handles missing parent gracefully', () => {
      tracker.registerSession('child-1', 'tester', 'non-existent-parent');
      
      const child = tracker.getSession('child-1');
      
      // Should still create session (depth 1 since parentId provided but not found)
      expect(child).toBeDefined();
      expect(child?.depth).toBe(1);
      expect(child?.parentId).toBe('non-existent-parent');
    });
    
    it('handles delegation from unknown session', () => {
      const delegationId = tracker.recordDelegation(
        'unknown-session',
        'tester',
        'test'
      );
      
      const delegation = tracker.getDelegation(delegationId);
      
      expect(delegation).toBeDefined();
      expect(delegation?.fromAgent).toBe('unknown');
    });
  });
});
