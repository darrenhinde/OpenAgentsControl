/**
 * Multi-Agent Logging System - Type Definitions
 * 
 * Defines types for tracking session hierarchy and delegation chains
 * in multi-agent evaluation scenarios.
 */

/**
 * Represents a session node in the delegation hierarchy
 */
export interface SessionNode {
  /** Unique session identifier */
  sessionId: string;
  
  /** Parent session ID (undefined for root sessions) */
  parentId?: string;
  
  /** Agent name/type */
  agent: string;
  
  /** Depth in delegation hierarchy (0 for root) */
  depth: number;
  
  /** Session start timestamp */
  startTime: number;
  
  /** Session end timestamp (undefined if still running) */
  endTime?: number;
  
  /** Child sessions spawned from this session */
  children: SessionNode[];
}

/**
 * Represents a delegation event (parent → child)
 */
export interface DelegationEvent {
  /** Unique delegation identifier */
  id: string;
  
  /** When delegation occurred */
  timestamp: number;
  
  /** Parent session ID */
  parentSessionId: string;
  
  /** Child session ID (may not be known immediately) */
  childSessionId?: string;
  
  /** Agent delegating from */
  fromAgent: string;
  
  /** Agent delegating to */
  toAgent: string;
  
  /** Delegation prompt/task */
  prompt: string;
}

/**
 * Represents a log entry in the timeline
 */
export interface LogEntry {
  /** When this entry was logged */
  timestamp: number;
  
  /** Session this entry belongs to */
  sessionId: string;
  
  /** Depth in hierarchy */
  depth: number;
  
  /** Type of log entry */
  type: 'user' | 'assistant' | 'tool' | 'delegation' | 'system';
  
  /** Log content */
  content: string;
  
  /** Additional metadata */
  metadata?: Record<string, any>;
}

/**
 * Session tree structure for hierarchy visualization
 */
export interface SessionTree {
  /** Root session */
  root: SessionNode;
  
  /** Total number of sessions in tree */
  totalSessions: number;
  
  /** Maximum depth in tree */
  maxDepth: number;
  
  /** All delegations in tree */
  delegations: DelegationEvent[];
}
