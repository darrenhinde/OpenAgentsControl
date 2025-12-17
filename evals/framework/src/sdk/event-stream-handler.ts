import { createOpencodeClient } from '@opencode-ai/sdk';
import { MultiAgentLogger } from '../logging/index.js';

export type EventType = 
  | 'session.created'
  | 'session.updated'
  | 'session.deleted'
  | 'session.status'
  | 'session.diff'
  | 'message.created'
  | 'message.updated'
  | 'message.deleted'
  | 'message.part.updated'
  | 'part.created'
  | 'part.updated'
  | 'part.deleted'
  | 'permission.request'
  | 'permission.response'
  | 'tool.call'
  | 'tool.result'
  | 'file.edited'
  | 'command.executed'
  | 'server.connected';

export interface ServerEvent {
  type: EventType;
  properties: any;
  timestamp?: number;
}

export interface PermissionRequestEvent {
  type: 'permission.request';
  properties: {
    sessionId: string;
    permissionId: string;
    message?: string;
    tool?: string;
    args?: any;
  };
}

export type EventHandler = (event: ServerEvent) => void | Promise<void>;
export type PermissionHandler = (event: PermissionRequestEvent) => Promise<boolean>;

export class EventStreamHandler {
  private client: ReturnType<typeof createOpencodeClient>;
  private eventHandlers: Map<EventType, EventHandler[]> = new Map();
  private permissionHandler: PermissionHandler | null = null;
  private isListening: boolean = false;
  private abortController: AbortController | null = null;
  private handlerIds: Map<EventHandler, string> = new Map();
  private nextHandlerId = 0;
  private multiAgentLogger: MultiAgentLogger | null = null;
  private currentSessionId: string | null = null;
  private pendingDelegations: Map<string, string> = new Map(); // sessionId -> delegationId
  private activeSessions: Set<string> = new Set(); // Track all active session IDs
  private sessionCreationTimes: Map<string, number> = new Map(); // sessionId -> timestamp
  private lastLoggedText: Map<string, string> = new Map(); // sessionId -> last logged text (to avoid duplicates)

  constructor(baseUrl: string) {
    this.client = createOpencodeClient({ baseUrl });
  }

  /**
   * Set the multi-agent logger for hierarchy tracking
   */
  setMultiAgentLogger(logger: MultiAgentLogger): void {
    this.multiAgentLogger = logger;
  }

  /**
   * Register an event handler for a specific event type
   * Returns handler ID for removal
   */
  on(eventType: EventType, handler: EventHandler): string {
    const id = `handler_${this.nextHandlerId++}`;
    this.handlerIds.set(handler, id);
    
    if (!this.eventHandlers.has(eventType)) {
      this.eventHandlers.set(eventType, []);
    }
    this.eventHandlers.get(eventType)!.push(handler);
    
    return id;
  }

  /**
   * Register a handler for all events
   * Returns handler ID for removal
   */
  onAny(handler: EventHandler): string {
    const id = `handler_${this.nextHandlerId++}`;
    this.handlerIds.set(handler, id);
    
    const eventTypes: EventType[] = [
      'session.created', 'session.updated',
      'message.created', 'message.updated',
      'part.created', 'part.updated',
      'permission.request', 'tool.call', 'tool.result'
    ];
    
    for (const type of eventTypes) {
      if (!this.eventHandlers.has(type)) {
        this.eventHandlers.set(type, []);
      }
      this.eventHandlers.get(type)!.push(handler);
    }
    
    return id;
  }

  /**
   * Register a permission handler
   * The handler should return true to approve, false to deny
   */
  onPermission(handler: PermissionHandler): void {
    this.permissionHandler = handler;
  }

  /**
   * Start listening to the event stream
   */
  async startListening(): Promise<void> {
    if (this.isListening) {
      throw new Error('Already listening to event stream');
    }

    this.abortController = new AbortController();
    this.isListening = true;

    try {
      const response = await this.client.event.subscribe();

      // Process events from the stream
      for await (const event of response.stream) {
        if (!this.isListening) {
          break;
        }

        const serverEvent: ServerEvent = {
          type: event.type as EventType,
          properties: event.properties,
          timestamp: Date.now(),
        };

        // Multi-agent logging hooks
        if (this.multiAgentLogger) {
          this.handleMultiAgentLogging(serverEvent);
        }

        // Handle permission requests automatically if handler is registered
        if ((event.type as string) === 'permission.request' && this.permissionHandler) {
          try {
            const approved = await this.permissionHandler(serverEvent as PermissionRequestEvent);
            
            // Respond to the permission request with retry logic
            const { sessionId, permissionId } = event.properties as any;
            await this.respondToPermissionWithRetry(sessionId, permissionId, approved);
          } catch (error) {
            console.error('Error handling permission request:', error);
          }
        }

        // Trigger registered event handlers
        const handlers = this.eventHandlers.get(serverEvent.type) || [];
        for (const handler of handlers) {
          try {
            await handler(serverEvent);
          } catch (error) {
            console.error(`Error in event handler for ${serverEvent.type}:`, error);
          }
        }
      }
    } catch (error) {
      if (this.isListening) {
        console.error('Event stream error:', error);
        throw error;
      }
    } finally {
      this.isListening = false;
    }
  }

  /**
   * Stop listening to the event stream
   */
  stopListening(): void {
    this.isListening = false;
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
  }

  /**
   * Check if currently listening
   */
  listening(): boolean {
    return this.isListening;
  }

  /**
   * Remove all event handlers
   */
  removeAllHandlers(): void {
    this.eventHandlers.clear();
    this.permissionHandler = null;
  }

  /**
   * Remove handlers for a specific event type
   */
  removeHandlers(eventType: EventType): void {
    this.eventHandlers.delete(eventType);
  }

  /**
   * Remove specific handler by reference
   */
  off(handler: EventHandler): void {
    for (const [type, handlers] of this.eventHandlers) {
      const index = handlers.indexOf(handler);
      if (index !== -1) {
        handlers.splice(index, 1);
      }
    }
    this.handlerIds.delete(handler);
  }

  /**
   * Remove handler from specific event type
   */
  offType(eventType: EventType, handler: EventHandler): void {
    const handlers = this.eventHandlers.get(eventType);
    if (handlers) {
      const index = handlers.indexOf(handler);
      if (index !== -1) {
        handlers.splice(index, 1);
      }
    }
  }

  /**
   * Get count of registered handlers (for debugging)
   */
  getHandlerCount(): number {
    let count = 0;
    for (const handlers of this.eventHandlers.values()) {
      count += handlers.length;
    }
    return count;
  }

  /**
   * Respond to permission request with retry logic
   * Handles transient failures when responding to permissions
   */
  private async respondToPermissionWithRetry(
    sessionId: string,
    permissionId: string,
    approved: boolean,
    maxRetries: number = 3,
    retryDelay: number = 500
  ): Promise<void> {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        await this.client.postSessionIdPermissionsPermissionId({
          path: { id: sessionId, permissionID: permissionId },
          body: { response: approved ? 'once' : 'reject' },
        });
        return; // Success
      } catch (error) {
        if (attempt < maxRetries) {
          console.log(`Permission response failed, retrying (${attempt}/${maxRetries})...`);
          await new Promise(r => setTimeout(r, retryDelay));
        } else {
          console.error('Permission response failed after retries:', error);
          throw error;
        }
      }
    }
  }

  /**
   * Handle multi-agent logging for session hierarchy tracking
   */
  private handleMultiAgentLogging(event: ServerEvent): void {
    if (!this.multiAgentLogger) return;

    // Debug: Log event types and properties (disabled - too noisy, use formatted output instead)
    // if (process.env.DEBUG_VERBOSE === 'true') {
    //   console.log(`[MultiAgentLogger] Event: ${event.type}`, JSON.stringify(event.properties).substring(0, 100));
    // }

    try {
      switch (event.type) {
        case 'session.created':
          // Track session creation (properties are in 'info')
          const info = event.properties?.info || event.properties;
          const sessionId = info?.id || info?.sessionID;
          const agent = info?.agent || 'OpenAgent'; // Default to OpenAgent for now
          const parentId = info?.parentID || info?.parentId;
          
          if (sessionId) {
            this.activeSessions.add(sessionId);
            this.sessionCreationTimes.set(sessionId, Date.now());
            this.currentSessionId = sessionId;
            
            // Check if this is a child session (created shortly after a delegation)
            let detectedParentId = parentId;
            if (!detectedParentId && this.pendingDelegations.size > 0) {
              // Look for recent delegations (within last 10 seconds)
              const now = Date.now();
              for (const [parentSessId, delegationId] of this.pendingDelegations.entries()) {
                const parentCreationTime = this.sessionCreationTimes.get(parentSessId);
                if (parentCreationTime && (now - parentCreationTime) < 10000) {
                  // This might be the child of this delegation
                  detectedParentId = parentSessId;
                  this.multiAgentLogger.logChildLinked(delegationId, sessionId);
                  this.pendingDelegations.delete(parentSessId);
                  break;
                }
              }
            }
            
            this.multiAgentLogger.logSessionStart(sessionId, agent, detectedParentId);
          }
          break;

        case 'message.updated':
          // Log user and assistant messages (properties are in 'info')
          const msgInfo = event.properties?.info || event.properties;
          const msgSessionId = msgInfo?.sessionID || msgInfo?.sessionId;
          const role = msgInfo?.role;
          const text = msgInfo?.text;
          
          // Debug: Log what we're seeing (disabled - too noisy)
          // if (process.env.DEBUG_VERBOSE === 'true' && msgSessionId && this.activeSessions.has(msgSessionId)) {
          //   console.log(`[MultiAgentLogger] Message for ${msgSessionId.substring(0, 12)}: role=${role}, hasText=${!!text}, textLen=${text?.length || 0}`);
          // }
          
          // Only log if we have session ID, role, and text
          // AND the session is one we're tracking
          if (msgSessionId && this.activeSessions.has(msgSessionId) && role && text && text.trim().length > 0) {
            if (role === 'user' || role === 'assistant') {
              this.multiAgentLogger.logMessage(msgSessionId, role, text);
            }
          }
          break;

        case 'message.part.updated':
          // Handle message parts (text and tool calls)
          const part = event.properties?.part;
          const partSessionId = part?.sessionID;
          
          if (partSessionId && this.activeSessions.has(partSessionId)) {
            if (part?.type === 'tool_use') {
              // Handle tool calls
              const tool = part?.name;
              const input = part?.input;
              
              if (tool) {
                // Detect task tool (delegation)
                if (tool === 'task' && input?.subagent_type) {
                  const delegationId = this.multiAgentLogger.logDelegation(
                    partSessionId,
                    input.subagent_type,
                    input.prompt || ''
                  );
                  // Store delegation ID to link child session later
                  this.pendingDelegations.set(partSessionId, delegationId);
                } else {
                  // Log other tool calls
                  this.multiAgentLogger.logToolCall(partSessionId, tool, input);
                }
              }
            } else if (part?.type === 'text' && part?.text) {
              // Handle text parts - these contain the actual message content
              const text = part.text;
              const lastText = this.lastLoggedText.get(partSessionId) || '';
              
              // Only log if text is significantly different (not just incremental updates)
              // Log if: text is much longer, or text is complete (ends with punctuation/newline)
              if (text && text.trim().length > 0) {
                const isComplete = /[.!?\n]$/.test(text.trim());
                const isSignificantlyLonger = text.length > lastText.length + 20;
                
                if (isComplete || isSignificantlyLonger) {
                  this.multiAgentLogger.logMessage(partSessionId, 'assistant', text);
                  this.lastLoggedText.set(partSessionId, text);
                }
              }
            }
          }
          break;

        case 'session.status':
          // Check if session completed
          const statusSessionId = event.properties?.sessionID;
          const status = event.properties?.status;
          
          if (statusSessionId && this.activeSessions.has(statusSessionId)) {
            if (status?.type === 'idle') {
              // Session went idle - mark as complete
              this.multiAgentLogger.logSessionComplete(statusSessionId);
              // Keep in activeSessions in case it becomes active again
            }
          }
          break;
        
        case 'session.deleted':
          // Session was deleted - definitely complete
          const deletedSessionId = event.properties?.id || event.properties?.sessionID;
          if (deletedSessionId && this.activeSessions.has(deletedSessionId)) {
            this.multiAgentLogger.logSessionComplete(deletedSessionId);
            this.activeSessions.delete(deletedSessionId);
            this.sessionCreationTimes.delete(deletedSessionId);
          }
          break;
      }
    } catch (error) {
      // Don't let logging errors break the test
      console.error('[MultiAgentLogger] Error handling event:', error);
    }
  }
}
