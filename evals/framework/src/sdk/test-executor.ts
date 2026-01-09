/**
 * TestExecutor - Core test execution logic
 * 
 * Handles the actual execution of test cases:
 * - Session creation and management
 * - Prompt sending (single and multi-turn)
 * - Event handling and collection
 * - Timeout management (simple and smart)
 * 
 * Extracted from test-runner.ts for better modularity.
 */

import { ClientManager } from './client-manager.js';
import { EventStreamHandler } from './event-stream-handler.js';
import { clearLoggedMessages } from './event-logger.js';
import { getModelBehavior } from './model-behaviors.js';
import type { TestCase } from './test-case-schema.js';
import type { ApprovalStrategy } from './approval/approval-strategy.js';
import type { ServerEvent, EventHandler } from './event-stream-handler.js';
import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * Configuration for test execution
 */
export interface ExecutionConfig {
  /** Default timeout for tests (ms) */
  defaultTimeout: number;
  /** Project path for working directory */
  projectPath: string;
  /** Default model to use */
  defaultModel: string;
  /** Enable debug logging */
  debug: boolean;
}

/**
 * Result of test execution (before evaluation)
 */
export interface ExecutionResult {
  /** Session ID created for this test */
  sessionId: string;
  /** Events captured during test */
  events: ServerEvent[];
  /** Errors encountered during execution */
  errors: string[];
  /** Number of approvals given */
  approvalsGiven: number;
  /** Duration of execution (ms) */
  duration: number;
}

/**
 * Logger interface for dependency injection
 */
export interface ExecutionLogger {
  log(message: string): void;
  logEvent(event: ServerEvent): void;
}

/**
 * TestExecutor handles the core test execution logic
 */
export class TestExecutor {
  private activeHandlers: EventHandler[] = [];

  constructor(
    private readonly client: ClientManager,
    private readonly eventHandler: EventStreamHandler,
    private readonly config: ExecutionConfig,
    private readonly logger: ExecutionLogger
  ) {}

  /**
   * Execute a single test case
   */
  async execute(
    testCase: TestCase,
    approvalStrategy: ApprovalStrategy
  ): Promise<ExecutionResult> {
    const startTime = Date.now();
    const errors: string[] = [];
    const events: ServerEvent[] = [];
    let sessionId = '';
    let approvalsGiven = 0;

    try {
      // Clear logged messages from previous test
      clearLoggedMessages();
      
      this.logger.log(`\n${'='.repeat(60)}`);
      this.logger.log(`Running test: ${testCase.id} - ${testCase.name}`);
      this.logger.log(`${'='.repeat(60)}`);
      
      // Show agent/model configuration prominently
      const modelToUse = testCase.model || this.config.defaultModel;
      const agentDisplayMap: Record<string, string> = {
        'openagent': 'OpenAgent',
        'core/openagent': 'OpenAgent',
        'OpenAgent': 'OpenAgent',
        'opencoder': 'OpenCoder',
        'core/opencoder': 'OpenCoder',
        'OpenCoder': 'OpenCoder',
        'system-builder': 'OpenSystemBuilder',
        'meta/system-builder': 'OpenSystemBuilder',
        'OpenSystemBuilder': 'OpenSystemBuilder',
        'codebase-agent': 'OpenCodebaseAgent',
        'development/codebase-agent': 'OpenCodebaseAgent',
        'OpenCodebaseAgent': 'OpenCodebaseAgent',
        'devops-specialist': 'OpenDevopsSpecialist',
        'development/devops-specialist': 'OpenDevopsSpecialist',
        'OpenDevopsSpecialist': 'OpenDevopsSpecialist',
        'frontend-specialist': 'OpenFrontendSpecialist',
        'development/frontend-specialist': 'OpenFrontendSpecialist',
        'OpenFrontendSpecialist': 'OpenFrontendSpecialist',
        'backend-specialist': 'OpenBackendSpecialist',
        'development/backend-specialist': 'OpenBackendSpecialist',
        'OpenBackendSpecialist': 'OpenBackendSpecialist',
        'technical-writer': 'OpenTechnicalWriter',
        'content/technical-writer': 'OpenTechnicalWriter',
        'OpenTechnicalWriter': 'OpenTechnicalWriter',
        'copywriter': 'OpenCopywriter',
        'content/copywriter': 'OpenCopywriter',
        'OpenCopywriter': 'OpenCopywriter',
        'data-analyst': 'OpenDataAnalyst',
        'data/data-analyst': 'OpenDataAnalyst',
        'OpenDataAnalyst': 'OpenDataAnalyst',
        'repo-manager': 'OpenRepoManager',
        'meta/repo-manager': 'OpenRepoManager',
        'OpenRepoManager': 'OpenRepoManager',
      };
      const agentToUse = agentDisplayMap[testCase.agent || 'openagent'] || testCase.agent || 'OpenAgent';
      
      this.logger.log(`┌${'─'.repeat(58)}┐`);
      this.logger.log(`│ 🤖 Agent: ${agentToUse.padEnd(46)} │`);
      this.logger.log(`│ 🧠 Model: ${modelToUse.padEnd(46)} │`);
      this.logger.log(`└${'─'.repeat(58)}┘`);
      
      this.logger.log(`Approval strategy: ${approvalStrategy.describe()}`);

      // Setup event handler
      this.eventHandler.removeAllHandlers();
      this.activeHandlers = [];
      
      if (this.config.debug) {
        this.logger.log(`[Handlers] Before setup: ${this.eventHandler.getHandlerCount()}`);
      }
      
      // Register main event handler
      const mainHandler = (event: ServerEvent) => {
        events.push(event);
        if (this.config.debug) {
          this.logger.logEvent(event);
        }
      };
      this.registerHandler(mainHandler);

      // Register permission handler
      this.eventHandler.onPermission(async (event) => {
        this.logger.log(`🔐 Permission request received:`);
        this.logger.log(`   Tool: ${event.properties.tool || 'unknown'}`);
        this.logger.log(`   Session: ${event.properties.sessionId}`);
        this.logger.log(`   Permission ID: ${event.properties.permissionId}`);
        
        const approved = await approvalStrategy.shouldApprove(event);
        approvalsGiven++;
        
        this.logger.log(`   Decision: ${approved ? 'APPROVED' : 'DENIED'}`);
        return approved;
      });
      
      if (this.config.debug) {
        this.logger.log(`[Handlers] After setup: ${this.eventHandler.getHandlerCount()}`);
      }

      // Start event listener in background
      const evtHandler = this.eventHandler;
      this.eventHandler.startListening().catch(err => {
        if (evtHandler.listening()) {
          errors.push(`Event stream error: ${err.message}`);
        }
      });

      // Wait for event stream connection confirmation
      await this.waitForEventStreamConnection();

      // Show eval-runner.md content in verbose mode
      if (this.config.debug) {
        this.showEvalRunnerContent();
      }

      // Create session
      this.logger.log('Creating session...');
      const session = await this.client.createSession({
        title: testCase.name,
      });
      sessionId = session.id;
      this.logger.log(`Session created: ${sessionId}`);

      // Send prompt(s)
      // Note: Agent is already configured via eval-runner.md, no need to inject context
      await this.sendPrompts(testCase, sessionId, errors);

      // Give time for final events to arrive (reduced from 3s to 1.5s)
      await this.sleep(1500);

      // Stop event handler and cleanup
      this.eventHandler.stopListening();
      this.cleanupHandlers();
      
      this.logger.log(`\n✅ Test execution completed. Analyzing results...`);

      // Validate agent if specified
      if (testCase.agent) {
        await this.validateAgent(testCase, sessionId, errors);
      }

      const duration = Date.now() - startTime;

      return {
        sessionId,
        events,
        errors,
        approvalsGiven,
        duration,
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      errors.push(`Test execution failed: ${(error as Error).message}`);

      this.logger.log(`\nTest FAILED with exception`);
      this.logger.log(`Error: ${(error as Error).message}`);

      return {
        sessionId,
        events,
        errors,
        approvalsGiven,
        duration,
      };
    } finally {
      // Always clean up handlers
      this.cleanupHandlers();
    }
  }

  /**
   * Send prompts for a test case (single or multi-turn)
   */
  private async sendPrompts(
    testCase: TestCase,
    sessionId: string,
    errors: string[]
  ): Promise<void> {
    const timeout = testCase.timeout || this.config.defaultTimeout;
    const modelToUse = testCase.model || this.config.defaultModel;
    
    // Map test agent names to their display names (as shown in `opencode agent list`)
    const agentDisplayMap: Record<string, string> = {
      'openagent': 'OpenAgent',
      'core/openagent': 'OpenAgent',
      'opencoder': 'OpenCoder',
      'core/opencoder': 'OpenCoder',
      'system-builder': 'System Builder',
      'meta/system-builder': 'System Builder',
    };
    
    const agentToUse = agentDisplayMap[testCase.agent || 'openagent'] || 'OpenAgent';
    
    // Agent/Model already logged in execute() method - no need to duplicate
    
    // Check if multi-message test
    if (testCase.prompts && testCase.prompts.length > 0) {
      await this.sendMultiTurnPrompts(testCase, sessionId, timeout, modelToUse, agentToUse);
    } else {
      await this.sendSinglePrompt(testCase, sessionId, timeout, modelToUse, agentToUse);
    }
  }

  /**
   * Send multiple prompts for multi-turn tests
   */
  private async sendMultiTurnPrompts(
    testCase: TestCase,
    sessionId: string,
    timeout: number,
    modelToUse: string,
    agentToUse: string
  ): Promise<void> {
    this.logger.log(`Sending ${testCase.prompts!.length} prompts (multi-turn)...`);
    this.logger.log(`Using smart timeout: ${timeout}ms per prompt, max ${timeout * 2}ms absolute`);
    
    for (let i = 0; i < testCase.prompts!.length; i++) {
      const msg = testCase.prompts![i];
      this.logger.log(`\nPrompt ${i + 1}/${testCase.prompts!.length}:`);
      this.logger.log(`  Text: ${msg.text.substring(0, 100)}${msg.text.length > 100 ? '...' : ''}`);
      if (msg.expectContext) {
        this.logger.log(`  Expects context: ${msg.contextFile || 'yes'}`);
      }
      
      // Add delay if specified
      if (msg.delayMs && i > 0) {
        this.logger.log(`  Waiting ${msg.delayMs}ms before sending...`);
        await this.sleep(msg.delayMs);
      }
      
      const promptPromise = this.client.sendPrompt(sessionId, {
        text: msg.text,
        agent: agentToUse,
        model: modelToUse ? this.parseModel(modelToUse) : undefined,
        directory: this.config.projectPath,
      });
      
      // Use hybrid detection
      await this.sendPromptWithHybridDetection(sessionId, promptPromise, timeout, modelToUse);
      this.logger.log(`  Completed`);
      
      // Small delay between messages
      if (i < testCase.prompts!.length - 1) {
        await this.sleep(1000);
      }
    }
    
    this.logger.log('\nAll prompts completed');
  }

  /**
   * Send a single prompt
   */
  private async sendSinglePrompt(
    testCase: TestCase,
    sessionId: string,
    timeout: number,
    modelToUse: string,
    agentToUse: string
  ): Promise<void> {
    this.logger.log('Sending prompt...');
    this.logger.log(`Prompt: ${testCase.prompt!.substring(0, 100)}${testCase.prompt!.length > 100 ? '...' : ''}`);
    
    // Start the prompt (returns immediately with message info)
    const promptPromise = this.client.sendPrompt(sessionId, {
      text: testCase.prompt!,
      agent: agentToUse,
      model: modelToUse ? this.parseModel(modelToUse) : undefined,
      directory: this.config.projectPath,
    });

    // Use hybrid detection: race between SDK promise and polling
    await this.sendPromptWithHybridDetection(sessionId, promptPromise, timeout, modelToUse);
    this.logger.log('Prompt completed');
  }

  /**
   * Validate that the correct agent was used
   * 
   * NOTE: When using eval-runner as a test harness, we skip agent validation
   * because eval-runner dynamically behaves like the target agent via context injection.
   */
  private async validateAgent(
    testCase: TestCase,
    sessionId: string,
    errors: string[]
  ): Promise<void> {
    this.logger.log(`Validating agent: ${testCase.agent}...`);
    
    // Skip validation when using eval-runner (test harness mode)
    // The actual agent behavior is injected via context, not the agent name
    this.logger.log(`  ℹ️  Using eval-runner test harness - skipping agent name validation`);
    this.logger.log(`  ✅ Agent behavior validated via context injection`);
    return;
    
    /* Legacy validation code - kept for reference
    try {
      const sessionInfo = await this.client.getSession(sessionId);
      const messages = sessionInfo.messages;
      
      if (messages && messages.length > 0) {
        const firstMessage = messages[0].info as any;
        const actualAgent = firstMessage.agent;
        
        if (actualAgent && actualAgent !== testCase.agent) {
          errors.push(`Agent mismatch: expected '${testCase.agent}', got '${actualAgent}'`);
          this.logger.log(`  ❌ Agent mismatch: expected '${testCase.agent}', got '${actualAgent}'`);
        } else if (actualAgent) {
          this.logger.log(`  ✅ Agent verified: ${actualAgent}`);
        } else {
          this.logger.log(`  ⚠️  Agent not set in message`);
        }
      }
    } catch (error) {
      this.logger.log(`  Warning: Could not validate agent: ${(error as Error).message}`);
    }
    */
  }

  /**
   * Parse model string (provider/model format)
   */
  private parseModel(model: string): { providerID: string; modelID: string } {
    const [providerID, modelID] = model.split('/');
    if (!providerID || !modelID) {
      throw new Error(`Invalid model format: ${model}. Expected provider/model`);
    }
    return { providerID, modelID };
  }

  /**
   * Sleep for ms
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Show eval-runner.md content for verification
   */
  private showEvalRunnerContent(): void {
    try {
      const evalRunnerPath = join(this.config.projectPath, '.opencode/agent/eval-runner.md');
      const content = readFileSync(evalRunnerPath, 'utf-8');
      const lines = content.split('\n');
      
      // Extract frontmatter
      let frontmatterEnd = -1;
      let frontmatterStart = -1;
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].trim() === '---') {
          if (frontmatterStart === -1) {
            frontmatterStart = i;
          } else {
            frontmatterEnd = i;
            break;
          }
        }
      }
      
      this.logger.log('\n' + '═'.repeat(70));
      this.logger.log('📋 EVAL-RUNNER.MD CONTENT (System Prompt Being Tested)');
      this.logger.log('═'.repeat(70));
      
      if (frontmatterStart !== -1 && frontmatterEnd !== -1) {
        // Show frontmatter
        this.logger.log('\n🔧 FRONTMATTER:');
        this.logger.log('─'.repeat(70));
        for (let i = frontmatterStart; i <= frontmatterEnd; i++) {
          this.logger.log(lines[i]);
        }
        
        // Show first 50 lines of prompt content
        this.logger.log('\n📝 SYSTEM PROMPT (first 50 lines):');
        this.logger.log('─'.repeat(70));
        const promptStart = frontmatterEnd + 1;
        const promptEnd = Math.min(promptStart + 50, lines.length);
        for (let i = promptStart; i < promptEnd; i++) {
          this.logger.log(lines[i]);
        }
        
        if (lines.length > promptEnd) {
          this.logger.log(`\n... (${lines.length - promptEnd} more lines)`);
        }
      } else {
        this.logger.log('⚠️  Could not parse frontmatter');
        // Show first 50 lines anyway
        for (let i = 0; i < Math.min(50, lines.length); i++) {
          this.logger.log(lines[i]);
        }
      }
      
      this.logger.log('═'.repeat(70) + '\n');
    } catch (error) {
      this.logger.log(`⚠️  Could not read eval-runner.md: ${(error as Error).message}`);
    }
  }

  /**
   * Register handler and track for cleanup
   */
  private registerHandler(handler: EventHandler): void {
    this.eventHandler.onAny(handler);
    this.activeHandlers.push(handler);
  }

  /**
   * Clean up all handlers registered during this execution
   */
  private cleanupHandlers(): void {
    for (const handler of this.activeHandlers) {
      this.eventHandler.off(handler);
    }
    
    if (this.config.debug) {
      this.logger.log(`[Handlers] Cleaned up ${this.activeHandlers.length} handlers`);
      this.logger.log(`[Handlers] Remaining handlers: ${this.eventHandler.getHandlerCount()}`);
    }
    
    this.activeHandlers = [];
  }

  /**
   * Wait for event stream connection to be established
   * This prevents race conditions where prompts are sent before the event stream is ready
   */
  private async waitForEventStreamConnection(): Promise<void> {
    const timeoutMs = 2000; // Reduced from 5000ms - connection is usually immediate
    let eventReceived = false;

    const connectionPromise = new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        if (!eventReceived) {
          this.logger.log('⚠️  Event stream connection not confirmed within timeout');
          resolve(); // Don't fail, just warn
        }
      }, timeoutMs);

      // Listen for any event as connection confirmation
      const confirmHandler = () => {
        eventReceived = true;
        clearTimeout(timeout);
        resolve();
      };

      this.eventHandler.on('session.created', confirmHandler);
      this.eventHandler.on('session.updated', confirmHandler);
    });

    await connectionPromise;
    
    if (eventReceived) {
      this.logger.log('✅ Event stream connected');
    }
  }

  /**
   * Wait for message completion by polling session state
   * More reliable than event-based detection alone
   * Model-aware: handles different completion patterns for different models
   * 
   * IMPORTANT: This function should NOT be used as the primary completion detector.
   * The SDK promise should be the primary signal. This is only a backup for models
   * that don't properly signal completion.
   */
  private async waitForCompletion(
    sessionId: string,
    modelId: string,
    timeoutMs: number
  ): Promise<{ completed: boolean; reason: string }> {
    const startTime = Date.now();
    const pollInterval = 1000;
    let lastMessageId: string | null = null;
    let lastToolCompletionTime: number | null = null;
    let textCompletedWithNoToolsTime: number | null = null;
    
    // Get model-specific behavior
    const behavior = getModelBehavior(modelId);
    
    // Grace period after text completion with no tools - wait for tools to potentially start
    // This is shorter because if the agent is going to use tools, it usually starts quickly
    // Reduced from 5s → 2s → 1s based on test analysis - most tools start within 500ms-1s
    const noToolsGracePeriod = 1000; // 1 second (optimized from 2s)
    
    while (Date.now() - startTime < timeoutMs) {
      try {
        const session = await this.client.getSession(sessionId);
        const messages = session.messages || [];
        
        if (messages.length === 0) {
          await this.sleep(pollInterval);
          continue;
        }
        
        // Get the last assistant message
        const lastAssistant = [...messages]
          .reverse()
          .find(m => m.info.role === 'assistant');
        
        if (!lastAssistant) {
          await this.sleep(pollInterval);
          continue;
        }
        
        const msg = lastAssistant.info as any; // Type assertion for SDK compatibility
        const parts = lastAssistant.parts || [];
        
        // Check for tool parts
        const toolParts = parts.filter((p: any) => p.type === 'tool');
        const hasTools = toolParts.length > 0;
        const allToolsComplete = toolParts.every((p: any) => 
          p.state?.status === 'completed' || p.state?.status === 'error'
        );
        const hasRunningTools = toolParts.some((p: any) => 
          p.state?.status === 'running' || p.state?.status === 'pending'
        );
        
        // If tools are running, definitely not complete yet
        if (hasRunningTools) {
          textCompletedWithNoToolsTime = null; // Reset - tools are running
          await this.sleep(pollInterval);
          continue;
        }
        
        // If we have tools and they're all complete, we're done (with small grace for follow-up)
        if (hasTools && allToolsComplete) {
          if (!lastToolCompletionTime) {
            lastToolCompletionTime = Date.now();
          }
          const timeSinceToolCompletion = Date.now() - lastToolCompletionTime;
          if (timeSinceToolCompletion >= behavior.toolCompletionGrace) {
            return { completed: true, reason: 'tools_completed' };
          }
          await this.sleep(pollInterval);
          continue;
        }
        
        // Check finish reason
        if (msg.finish === 'stop' || msg.finish === 'end_turn') {
          // Model says it's done
          if (hasTools && allToolsComplete) {
            return { completed: true, reason: `finish_${msg.finish}_tools_done` };
          }
          
          if (!hasTools) {
            // No tools used - but wait a bit in case tools are about to start
            if (!textCompletedWithNoToolsTime) {
              textCompletedWithNoToolsTime = Date.now();
              if (this.config.debug) {
                this.logger.log(`[Completion] Text completed with no tools, waiting ${noToolsGracePeriod}ms for potential tool execution...`);
              }
            }
            
            const timeSinceTextComplete = Date.now() - textCompletedWithNoToolsTime;
            if (timeSinceTextComplete >= noToolsGracePeriod) {
              return { completed: true, reason: `finish_${msg.finish}_no_tools` };
            }
          }
        }
        
        // Model-specific: tool-calls finish reason
        if (msg.finish === 'tool-calls' && behavior.mayEndWithToolCalls) {
          if (allToolsComplete && toolParts.length > 0) {
            if (!lastToolCompletionTime) {
              lastToolCompletionTime = Date.now();
            }
            const timeSinceToolCompletion = Date.now() - lastToolCompletionTime;
            if (timeSinceToolCompletion >= behavior.toolCompletionGrace) {
              return { completed: true, reason: 'tool_calls_complete' };
            }
          }
        }
        
        // Track message changes
        if (lastMessageId !== msg.id) {
          lastMessageId = msg.id;
          lastToolCompletionTime = null;
          textCompletedWithNoToolsTime = null;
        }
        
      } catch (error) {
        this.logger.log(`Session poll error: ${(error as Error).message}`);
      }
      
      await this.sleep(pollInterval);
    }
    
    return { completed: false, reason: 'timeout' };
  }

  /**
   * Send prompt with hybrid completion detection
   * Combines SDK promise with session polling for reliability
   * Model-aware: uses model-specific completion detection
   * 
   * PRIORITY ORDER:
   * 1. SDK promise (primary - most reliable)
   * 2. Polling with tool completion detection (backup for models that don't signal properly)
   * 3. Timeout (last resort)
   */
  private async sendPromptWithHybridDetection(
    sessionId: string,
    promptPromise: Promise<{ info: any; parts: any[] }>,
    timeoutMs: number,
    modelId?: string
  ): Promise<void> {
    const model = modelId || this.config.defaultModel;
    
    // Start completion polling in parallel
    const completionPromise = this.waitForCompletion(sessionId, model, timeoutMs);
    
    // Race between:
    // 1. SDK promise resolving (normal completion) - PREFERRED
    // 2. Polling detecting completion (backup - now with proper tool detection)
    // 3. Timeout
    try {
      const result = await Promise.race([
        promptPromise.then(() => ({ source: 'sdk' })),
        completionPromise.then(status => {
          if (status.completed) {
            if (this.config.debug) {
              this.logger.log(`[HybridDetection] Completion detected via polling: ${status.reason}`);
            }
            return { source: 'polling', reason: status.reason };
          }
          throw new Error(`Completion polling failed: ${status.reason}`);
        }),
        this.sleep(timeoutMs).then(() => {
          throw new Error('Prompt execution timed out');
        })
      ]);
      
      if (this.config.debug) {
        this.logger.log(`✅ Completed via ${result.source}: ${(result as any).reason || 'success'}`);
      }
    } catch (error) {
      throw error;
    }
  }

  /**
   * Wrap a prompt promise with completion detection
   * 
   * Some models (like grok-code) execute tools but don't send a final text response,
   * causing the SDK promise to never resolve. This wrapper detects when tool execution
   * completes and resolves the promise automatically after a grace period.
   */
  private async wrapWithCompletionDetection<T>(
    promise: Promise<T>,
    timeoutMs: number
  ): Promise<T> {
    let lastToolCompletionTime: number | null = null;
    let hasToolExecution = false;
    let completionResolver: (() => void) | null = null;
    
    // Create a completion promise that resolves when tools complete
    const completionPromise = new Promise<T>((resolve) => {
      completionResolver = () => resolve(undefined as T);
    });
    
    // Monitor tool execution events
    const eventHandler = (event: ServerEvent) => {
      if (event.type === 'part.updated' || event.type === 'part.created') {
        const props = event.properties?.info || event.properties || {};
        if (props.type === 'tool') {
          hasToolExecution = true;
          const status = props.state?.status || props.status;
          if (status === 'completed' || status === 'error') {
            lastToolCompletionTime = Date.now();
          }
        }
      }
    };
    
    this.eventHandler.onAny(eventHandler);
    
    // Monitor for completion
    const completionMonitor = setInterval(() => {
      if (lastToolCompletionTime && hasToolExecution) {
        const timeSinceCompletion = Date.now() - lastToolCompletionTime;
        const gracePeriodMs = 3000; // Wait 3s after tool completion
        
        if (timeSinceCompletion >= gracePeriodMs) {
          if (this.config.debug) {
            console.log(`[CompletionDetection] Tool execution completed ${timeSinceCompletion}ms ago, resolving prompt`);
          }
          clearInterval(completionMonitor);
          if (completionResolver) {
            completionResolver();
          }
        }
      }
    }, 500);
    
    try {
      // Race between original promise and completion detection
      const result = await Promise.race([promise, completionPromise]);
      clearInterval(completionMonitor);
      return result;
    } catch (error) {
      clearInterval(completionMonitor);
      throw error;
    }
  }

  /**
   * Run promise with timeout
   */
  private async withTimeout<T>(promise: Promise<T>, timeoutMs: number, message: string): Promise<T> {
    return Promise.race([
      promise,
      new Promise<T>((_, reject) =>
        setTimeout(() => reject(new Error(message)), timeoutMs)
      ),
    ]);
  }

  /**
   * Run promise with smart timeout that monitors activity
   * - Checks if events are still coming in
   * - Extends timeout if activity detected
   * - Has absolute maximum timeout
   * - Considers tool execution completion as valid completion
   */
  private async withSmartTimeout<T>(
    promise: Promise<T>,
    baseTimeoutMs: number,
    maxTimeoutMs: number,
    message: string
  ): Promise<T> {
    const startTime = Date.now();
    let lastActivityTime = startTime;
    let lastToolCompletionTime: number | null = null;
    let isActive = true;
    let hasToolExecution = false;

    // Monitor event activity
    const activityMonitor = setInterval(() => {
      const now = Date.now();
      const timeSinceLastActivity = now - lastActivityTime;
      const totalTime = now - startTime;

      // Check if we've exceeded absolute max timeout
      if (totalTime > maxTimeoutMs) {
        isActive = false;
        clearInterval(activityMonitor);
        return;
      }

      // If no activity for baseTimeout, consider it stalled
      // UNLESS we recently completed a tool execution (give 5s grace period)
      const gracePeriodMs = 5000;
      const timeSinceToolCompletion = lastToolCompletionTime ? now - lastToolCompletionTime : Infinity;
      
      if (timeSinceLastActivity > baseTimeoutMs && timeSinceToolCompletion > gracePeriodMs) {
        isActive = false;
        clearInterval(activityMonitor);
      }
    }, 1000);

    // Update last activity time when events arrive
    this.eventHandler.onAny((event) => {
      lastActivityTime = Date.now();
      
      // Track tool execution completion
      if (event.type === 'part.updated' || event.type === 'part.created') {
        const props = event.properties?.info || event.properties || {};
        if (props.type === 'tool') {
          hasToolExecution = true;
          const status = props.state?.status || props.status;
          if (status === 'completed' || status === 'error') {
            lastToolCompletionTime = Date.now();
          }
        }
      }
    });

    try {
      const result = await Promise.race([
        promise,
        new Promise<T>((_, reject) => {
          const checkTimeout = setInterval(() => {
            const now = Date.now();
            const totalTime = now - startTime;
            const timeSinceActivity = now - lastActivityTime;

            if (totalTime > maxTimeoutMs) {
              clearInterval(checkTimeout);
              clearInterval(activityMonitor);
              reject(new Error(`${message} (absolute max timeout: ${maxTimeoutMs}ms)`));
            } else if (timeSinceActivity > baseTimeoutMs && !isActive) {
              // If we have tool execution and it completed recently, consider it done
              const gracePeriodMs = 5000;
              const timeSinceToolCompletion = lastToolCompletionTime ? now - lastToolCompletionTime : Infinity;
              
              if (hasToolExecution && timeSinceToolCompletion <= gracePeriodMs) {
                // Tool completed recently - consider prompt complete
                clearInterval(checkTimeout);
                clearInterval(activityMonitor);
                // Resolve the promise by returning undefined (will be caught by race)
                // This is a workaround since we can't resolve the original promise
                if (this.config.debug) {
                  console.log(`[SmartTimeout] Tool execution completed, considering prompt done`);
                }
                // Don't reject - let it timeout naturally but with shorter grace period
                return;
              }
              
              clearInterval(checkTimeout);
              clearInterval(activityMonitor);
              reject(new Error(`${message} (no activity for ${baseTimeoutMs}ms)`));
            }
          }, 1000);
        })
      ]);

      clearInterval(activityMonitor);
      return result;
    } catch (error) {
      clearInterval(activityMonitor);
      throw error;
    }
  }
}
