/**
 * Multi-Agent Logging System - Session Tracker
 * 
 * Tracks parent-child relationships in multi-agent delegation chains.
 * Maintains session hierarchy and delegation events.
 */

import { SessionNode, DelegationEvent, SessionTree } from './types.js';

/**
 * Tracks session hierarchy and delegation events
 */
export class SessionTracker {
  private sessions = new Map<string, SessionNode>();
  private delegations = new Map<string, DelegationEvent>();
  
  /**
   * Register a new session in the hierarchy
   */
  registerSession(sessionId: string, agent: string, parentId?: string): void {
    const depth = parentId ? this.getDepth(parentId) + 1 : 0;
    
    const node: SessionNode = {
      sessionId,
      parentId,
      agent,
      depth,
      startTime: Date.now(),
      children: [],
    };
    
    this.sessions.set(sessionId, node);
    
    // Link to parent
    if (parentId) {
      const parent = this.sessions.get(parentId);
      if (parent) {
        parent.children.push(node);
      }
    }
  }
  
  /**
   * Record a delegation event (parent delegating to child)
   */
  recordDelegation(
    parentSessionId: string,
    toAgent: string,
    prompt: string
  ): string {
    const delegationId = `del_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    
    const parent = this.sessions.get(parentSessionId);
    
    this.delegations.set(delegationId, {
      id: delegationId,
      timestamp: Date.now(),
      parentSessionId,
      fromAgent: parent?.agent || 'unknown',
      toAgent,
      prompt,
    });
    
    return delegationId;
  }
  
  /**
   * Link a child session to a delegation event
   */
  linkChildSession(delegationId: string, childSessionId: string): void {
    const delegation = this.delegations.get(delegationId);
    if (delegation) {
      delegation.childSessionId = childSessionId;
    }
  }
  
  /**
   * Mark a session as complete
   */
  completeSession(sessionId: string): void {
    const node = this.sessions.get(sessionId);
    if (node) {
      node.endTime = Date.now();
    }
  }
  
  /**
   * Get session depth in hierarchy
   */
  private getDepth(sessionId: string): number {
    const node = this.sessions.get(sessionId);
    return node?.depth ?? 0;
  }
  
  /**
   * Get session node by ID
   */
  getSession(sessionId: string): SessionNode | undefined {
    return this.sessions.get(sessionId);
  }
  
  /**
   * Get full hierarchy starting from a root session
   */
  getHierarchy(rootSessionId: string): SessionNode | null {
    return this.sessions.get(rootSessionId) || null;
  }
  
  /**
   * Get all sessions at a specific depth
   */
  getSessionsAtDepth(depth: number): SessionNode[] {
    return Array.from(this.sessions.values()).filter(s => s.depth === depth);
  }
  
  /**
   * Get all root sessions (depth 0)
   */
  getRootSessions(): SessionNode[] {
    return this.getSessionsAtDepth(0);
  }
  
  /**
   * Get delegation event by ID
   */
  getDelegation(delegationId: string): DelegationEvent | undefined {
    return this.delegations.get(delegationId);
  }
  
  /**
   * Get all delegations from a session
   */
  getDelegationsFromSession(sessionId: string): DelegationEvent[] {
    return Array.from(this.delegations.values())
      .filter(d => d.parentSessionId === sessionId);
  }
  
  /**
   * Build complete session tree
   */
  buildTree(rootSessionId: string): SessionTree | null {
    const root = this.getHierarchy(rootSessionId);
    if (!root) return null;
    
    const { totalSessions, maxDepth } = this.calculateTreeStats(root);
    const delegations = this.collectDelegations(root);
    
    return {
      root,
      totalSessions,
      maxDepth,
      delegations,
    };
  }
  
  /**
   * Calculate tree statistics
   */
  private calculateTreeStats(node: SessionNode): { totalSessions: number; maxDepth: number } {
    let totalSessions = 1;
    let maxDepth = node.depth;
    
    for (const child of node.children) {
      const childStats = this.calculateTreeStats(child);
      totalSessions += childStats.totalSessions;
      maxDepth = Math.max(maxDepth, childStats.maxDepth);
    }
    
    return { totalSessions, maxDepth };
  }
  
  /**
   * Collect all delegations in tree
   */
  private collectDelegations(node: SessionNode): DelegationEvent[] {
    const delegations = this.getDelegationsFromSession(node.sessionId);
    
    for (const child of node.children) {
      delegations.push(...this.collectDelegations(child));
    }
    
    return delegations;
  }
  
  /**
   * Clear all tracked data
   */
  clear(): void {
    this.sessions.clear();
    this.delegations.clear();
  }
  
  /**
   * Get total number of tracked sessions
   */
  getSessionCount(): number {
    return this.sessions.size;
  }
  
  /**
   * Get total number of tracked delegations
   */
  getDelegationCount(): number {
    return this.delegations.size;
  }
}
