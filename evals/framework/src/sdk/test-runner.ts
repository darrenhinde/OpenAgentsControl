/**
 * TestRunner - Orchestrates test execution
 * 
 * This is a thin orchestrator that coordinates:
 * - Server lifecycle management
 * - Test execution via TestExecutor
 * - Result validation via ResultValidator
 * - Evaluator management
 * 
 * The actual execution and validation logic has been extracted to:
 * - test-executor.ts - Core test execution
 * - result-validator.ts - Result validation
 * - event-logger.ts - Event logging utilities
 */

import { ServerManager } from './server-manager.js';
import { ClientManager } from './client-manager.js';
import { EventStreamHandler } from './event-stream-handler.js';
import { AutoApproveStrategy } from './approval/auto-approve-strategy.js';
import { AutoDenyStrategy } from './approval/auto-deny-strategy.js';
import { SmartApprovalStrategy } from './approval/smart-approval-strategy.js';
import { SessionReader } from '../collector/session-reader.js';
import { TimelineBuilder } from '../collector/timeline-builder.js';
import { EvaluatorRunner } from '../evaluators/evaluator-runner.js';
import { ApprovalGateEvaluator } from '../evaluators/approval-gate-evaluator.js';
import { ContextLoadingEvaluator } from '../evaluators/context-loading-evaluator.js';
import { DelegationEvaluator } from '../evaluators/delegation-evaluator.js';
import { ToolUsageEvaluator } from '../evaluators/tool-usage-evaluator.js';
import { StopOnFailureEvaluator } from '../evaluators/stop-on-failure-evaluator.js';
import { ReportFirstEvaluator } from '../evaluators/report-first-evaluator.js';
import { CleanupConfirmationEvaluator } from '../evaluators/cleanup-confirmation-evaluator.js';
import { ExecutionBalanceEvaluator } from '../evaluators/execution-balance-evaluator.js';
import { BehaviorEvaluator } from '../evaluators/behavior-evaluator.js';
import { PerformanceMetricsEvaluator } from '../evaluators/performance-metrics-evaluator.js';
import { AgentModelEvaluator } from '../evaluators/agent-model-evaluator.js';
import { ErrorHandlingEvaluator } from '../evaluators/error-handling-evaluator.js';
import { TestExecutor } from './test-executor.js';
import { ResultValidator } from './result-validator.js';
import { createLogger } from './event-logger.js';
import { MultiAgentLogger } from '../logging/index.js';
import type { TestCase } from './test-case-schema.js';
import type { ApprovalStrategy } from './approval/approval-strategy.js';
import type { ServerEvent } from './event-stream-handler.js';
import type { AggregatedResult } from '../evaluators/evaluator-runner.js';
import { homedir } from 'os';
import { join } from 'path';
import { execSync } from 'child_process';
import { existsSync } from 'fs';
import { findGitRoot } from '../config.js';

export interface TestRunnerConfig {
  /**
   * Port for opencode server (0 = random)
   */
  port?: number;

  /**
   * Enable debug logging
   */
  debug?: boolean;

  /**
   * Default timeout for tests (ms)
   */
  defaultTimeout?: number;

  /**
   * Project path for evaluators
   * 
   * IMPORTANT: This should be the git root where the agent runs, not the test framework directory.
   * 
   * Default behavior:
   * - Automatically finds git root by walking up from process.cwd()
   * - This ensures sessions created by agents are found correctly
   * 
   * When to override:
   * - Testing agents in non-git directories
   * - Testing multiple agents with different project roots
   * - Custom session storage locations
   * 
   * Example:
   * - Git root: /Users/user/opencode-agents (sessions stored here)
   * - Test CWD: /Users/user/opencode-agents/evals/framework (tests run here)
   * - projectPath should be git root, not test CWD
   */
  projectPath?: string;

  /**
   * Run evaluators after test execution
   */
  runEvaluators?: boolean;

  /**
   * Default model to use for tests (format: provider/model)
   * Examples:
   * - "opencode/grok-code-fast" (free tier)
   * - "anthropic/claude-3-5-sonnet-20241022"
   * - "openai/gpt-4-turbo"
   */
  defaultModel?: string;
}

export interface TestResult {
  /**
   * Test case that was run
   */
  testCase: TestCase;

  /**
   * Session ID created for this test
   */
  sessionId: string;

  /**
   * Whether the test passed
   */
  passed: boolean;

  /**
   * Errors encountered during test execution
   */
  errors: string[];

  /**
   * Events captured during test
   */
  events: ServerEvent[];

  /**
   * Duration of test execution (ms)
   */
  duration: number;

  /**
   * Number of approvals given
   */
  approvalsGiven: number;

  /**
   * Path to recorded session data
   */
  sessionPath?: string;

  /**
   * Evaluation results from evaluators (if runEvaluators = true)
   */
  evaluation?: AggregatedResult;
}

/**
 * TestRunner orchestrates the test execution process
 */
export class TestRunner {
  private server: ServerManager;
  private client: ClientManager | null = null;
  private eventHandler: EventStreamHandler | null = null;
  private config: Required<TestRunnerConfig>;
  private evaluatorRunner: EvaluatorRunner | null = null;
  private executor: TestExecutor | null = null;
  private validator: ResultValidator;
  private logger: ReturnType<typeof createLogger>;
  private multiAgentLogger: MultiAgentLogger | null = null;

  constructor(config: TestRunnerConfig = {}) {
    // Find git root for agent detection
    const gitRoot = findGitRoot(process.cwd());
    
    this.config = {
      port: config.port || 0,
      debug: config.debug || false,
      defaultTimeout: config.defaultTimeout || 60000,
      projectPath: config.projectPath || gitRoot,
      runEvaluators: config.runEvaluators ?? true,
      defaultModel: config.defaultModel || 'opencode/grok-code',
    };

    // Set DEBUG_VERBOSE BEFORE creating logger so event handlers can check it
    if (this.config.debug) {
      process.env.DEBUG_VERBOSE = 'true';
      console.log('[TestRunner] DEBUG_VERBOSE enabled - full conversation logging active');
    }

    // Create logger
    this.logger = createLogger(this.config.debug);

    // Create validator
    this.validator = new ResultValidator(this.logger);

    // Start server from git root
    // Agent will be set dynamically via eval-runner.md
    this.server = new ServerManager({
      port: this.config.port,
      timeout: 10000,
      cwd: gitRoot,
      debug: this.config.debug,
    });

    if (this.config.debug) {
      console.log(`[TestRunner] Git root: ${gitRoot}`);
      console.log(`[TestRunner] Server will use eval-runner.md (dynamically configured)`);
    }
  }

  /**
   * Set the default agent by updating the AGENT.md symlink
   * This is a workaround because the OpenCode server doesn't properly handle
   * the agent parameter in prompt requests.
   */
  /**
   * Setup eval-runner.md with target agent's prompt
   * 
   * Simply copies the target agent's prompt to eval-runner.md.
   * After tests, we restore the simple template.
   * 
   * For subagent standalone testing, forces mode: primary
   */
  private setupEvalRunner(agentName: string, forceStandalone: boolean = false): void {
    const agentDir = join(this.config.projectPath, '.opencode', 'agent');
    const evalRunnerPath = join(agentDir, 'eval-runner.md');
    
    // Map agent names to their actual file paths in category subfolders
    const agentMap: Record<string, string> = {
      // Main agents
      'openagent': 'core/openagent.md',
      'OpenAgent': 'core/openagent.md',
      'opencoder': 'core/opencoder.md',
      'OpenCoder': 'core/opencoder.md',
      'core/openagent': 'core/openagent.md',
      'core/opencoder': 'core/opencoder.md',
      'system-builder': 'meta/system-builder.md',
      'OpenSystemBuilder': 'meta/system-builder.md',
      'meta/system-builder': 'meta/system-builder.md',
      'codebase-agent': 'development/codebase-agent.md',
      'OpenCodebaseAgent': 'development/codebase-agent.md',
      'devops-specialist': 'development/devops-specialist.md',
      'OpenDevopsSpecialist': 'development/devops-specialist.md',
      'frontend-specialist': 'development/frontend-specialist.md',
      'OpenFrontendSpecialist': 'development/frontend-specialist.md',
      'backend-specialist': 'development/backend-specialist.md',
      'OpenBackendSpecialist': 'development/backend-specialist.md',
      'technical-writer': 'content/technical-writer.md',
      'OpenTechnicalWriter': 'content/technical-writer.md',
      'copywriter': 'content/copywriter.md',
      'OpenCopywriter': 'content/copywriter.md',
      'data-analyst': 'data/data-analyst.md',
      'OpenDataAnalyst': 'data/data-analyst.md',
      'repo-manager': 'meta/repo-manager.md',
      'OpenRepoManager': 'meta/repo-manager.md',
      
      // Subagents - code
      'coder-agent': 'subagents/code/coder-agent.md',
      'CoderAgent': 'subagents/code/coder-agent.md',
      'tester': 'subagents/code/tester.md',
      'TestEngineer': 'subagents/code/tester.md',
      'reviewer': 'subagents/code/reviewer.md',
      'CodeReviewer': 'subagents/code/reviewer.md',
      'build-agent': 'subagents/code/build-agent.md',
      'BuildAgent': 'subagents/code/build-agent.md',
      'codebase-pattern-analyst': 'subagents/code/codebase-pattern-analyst.md',
      'PatternAnalyst': 'subagents/code/codebase-pattern-analyst.md',
      
      // Subagents - core
      'task-manager': 'subagents/core/task-manager.md',
      'TaskManager': 'subagents/core/task-manager.md',
      'documentation': 'subagents/core/documentation.md',
      'DocWriter': 'subagents/core/documentation.md',
      'contextscout': 'subagents/core/contextscout.md',
      'ContextScout': 'subagents/core/contextscout.md',
      
      // Subagents - system-builder
      'agent-generator': 'subagents/system-builder/agent-generator.md',
      'AgentGenerator': 'subagents/system-builder/agent-generator.md',
      'command-creator': 'subagents/system-builder/command-creator.md',
      'CommandCreator': 'subagents/system-builder/command-creator.md',
      'context-organizer': 'subagents/system-builder/context-organizer.md',
      'ContextOrganizer': 'subagents/system-builder/context-organizer.md',
      'domain-analyzer': 'subagents/system-builder/domain-analyzer.md',
      'DomainAnalyzer': 'subagents/system-builder/domain-analyzer.md',
      'workflow-designer': 'subagents/system-builder/workflow-designer.md',
      'WorkflowDesigner': 'subagents/system-builder/workflow-designer.md',
      
      // Subagents - utils
      'image-specialist': 'subagents/utils/image-specialist.md',
      'ImageSpecialist': 'subagents/utils/image-specialist.md',
    };
    
    // Support full paths (e.g., "subagents/code/coder-agent") or just names (e.g., "coder-agent")
    const targetAgentPath = agentMap[agentName] || `${agentName}.md`;
    const sourceAgentPath = join(agentDir, targetAgentPath);
    
    // Check if source agent exists
    if (!existsSync(sourceAgentPath)) {
      const availableAgents = Object.keys(agentMap).join(', ');
      throw new Error(
        `Agent file not found: ${sourceAgentPath}\n` +
        `Available agents: ${availableAgents}`
      );
    }
    
    try {
      // Copy target agent's prompt to eval-runner.md
      execSync(`cp "${sourceAgentPath}" "${evalRunnerPath}"`, { cwd: agentDir });
      
      // If testing subagent standalone, force mode: primary
      if (forceStandalone) {
        execSync(
          `sed -i '' 's/mode: subagent/mode: primary/' "${evalRunnerPath}"`,
          { cwd: agentDir }
        );
        
        if (this.config.debug) {
          this.logger.log(`[TestRunner] Forced mode: primary for standalone subagent testing`);
        }
      }
      
      if (this.config.debug) {
        this.logger.log(`[TestRunner] Configured eval-runner.md with ${targetAgentPath}`);
      }
    } catch (error) {
      throw new Error(`Failed to setup eval-runner: ${(error as Error).message}`);
    }
  }

  /**
   * Restore eval-runner.md to simple template
   * 
   * Creates a minimal template that clearly states it's a test harness
   */
  private restoreEvalRunner(): void {
    const agentDir = join(this.config.projectPath, '.opencode', 'agent');
    const evalRunnerPath = join(agentDir, 'eval-runner.md');
    
    const template = `---
# OpenCode Agent Configuration
id: eval-runner
name: Eval Runner
description: "Test harness for evaluation framework - DO NOT USE DIRECTLY"
category: testing
type: utility
version: 1.0.0
author: opencode
mode: subagent
temperature: 0.2
---

# Eval Runner - Test Harness

**⚠️ DO NOT USE THIS AGENT DIRECTLY ⚠️**

This agent is a test harness used by the OpenCode evaluation framework.

## Purpose

This file is **dynamically replaced** during test runs:
- Before tests: Replaced with target agent's prompt (e.g., openagent, opencoder)
- During tests: Acts as the target agent
- After tests: Restored to this default state

## Configuration

- **ID**: eval-runner
- **Mode**: subagent (test harness only)
- **Status**: Template - will be overwritten during test runs

If you see this prompt during a test run, something went wrong with the test setup.
`;
    
    try {
      // Write the simple template back
      execSync(`cat > "${evalRunnerPath}" << 'EVALRUNNER_EOF'\n${template}\nEVALRUNNER_EOF`, { 
        cwd: agentDir,
        shell: '/bin/bash'
      });
      
      if (this.config.debug) {
        this.logger.log(`[TestRunner] Restored eval-runner.md to template`);
      }
    } catch (error) {
      this.logger.log(`Warning: Could not restore eval-runner: ${(error as Error).message}`);
    }
  }

  /**
   * Start the test runner (starts opencode server)
   * 
   * @param agentName - Agent to test (e.g., 'openagent', 'opencoder', 'coder-agent')
   * @param forceStandalone - Force mode: primary for subagent testing
   */
  async start(agentName: string = 'openagent', forceStandalone: boolean = false): Promise<void> {
    // Setup eval-runner.md with target agent's prompt BEFORE starting server
    this.setupEvalRunner(agentName, forceStandalone);
    
    this.logger.log('Starting opencode server...');
    const { url } = await this.server.start();
    this.logger.log(`Server started at ${url}`);

    this.client = new ClientManager({ baseUrl: url });
    this.eventHandler = new EventStreamHandler(url, this.config.projectPath);

    // Initialize multi-agent logger (always enabled, verbose only in debug mode)
    this.multiAgentLogger = new MultiAgentLogger(true, this.config.debug);
    this.eventHandler.setMultiAgentLogger(this.multiAgentLogger);
    if (this.config.debug) {
      console.log('[TestRunner] Multi-agent logging enabled (verbose mode)');
    }

    // Create executor
    this.executor = new TestExecutor(
      this.client,
      this.eventHandler,
      {
        defaultTimeout: this.config.defaultTimeout,
        projectPath: this.config.projectPath,
        defaultModel: this.config.defaultModel,
        debug: this.config.debug,
      },
      this.logger
    );

    // Setup evaluators
    if (this.config.runEvaluators && this.client) {
      this.setupEvaluators();
    }
  }

  /**
   * Setup evaluators with SDK client
   */
  private setupEvaluators(): void {
    if (!this.client) return;

    const sessionStoragePath = join(homedir(), '.local', 'share', 'opencode');
    const sdkClient = this.client.getClient();
    const sessionReader = new SessionReader(sdkClient, sessionStoragePath);
    const timelineBuilder = new TimelineBuilder(sessionReader);

    this.evaluatorRunner = new EvaluatorRunner({
      sessionReader,
      timelineBuilder,
      sdkClient,
      evaluators: [
        new ApprovalGateEvaluator(),
        new ContextLoadingEvaluator(),
        new DelegationEvaluator(),
        new ToolUsageEvaluator(),
        new StopOnFailureEvaluator(),
        new ReportFirstEvaluator(),
        new CleanupConfirmationEvaluator(),
        new ExecutionBalanceEvaluator(),
        new PerformanceMetricsEvaluator(),
        new ErrorHandlingEvaluator(),
        new AgentModelEvaluator({ projectPath: this.config.projectPath }), // Logs agent/model info
      ],
    });

    if (this.config.debug) {
      this.logger.log('[TestRunner] Evaluators initialized with SDK client');
    }
  }

  /**
   * Stop the test runner (stops server)
   */
  async stop(): Promise<void> {
    this.logger.log('Stopping event handler...');
    if (this.eventHandler) {
      this.eventHandler.stopListening();
      this.eventHandler = null;
    }

    this.logger.log('Stopping server...');
    await this.server.stop();
    this.client = null;
    this.executor = null;
    
    // Restore eval-runner.md to original state
    this.restoreEvalRunner();
  }

  /**
   * Run a single test case
   */
  async runTest(testCase: TestCase): Promise<TestResult> {
    if (!this.client || !this.eventHandler || !this.executor) {
      throw new Error('Test runner not started. Call start() first.');
    }

    // Stop event handler if it's still listening from previous test
    if (this.eventHandler.listening()) {
      this.eventHandler.stopListening();
      // Wait a bit for cleanup
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    // Create approval strategy
    const approvalStrategy = this.createApprovalStrategy(testCase);

    // Execute test
    const executionResult = await this.executor.execute(testCase, approvalStrategy);

    // Run evaluators if enabled
    let evaluation: AggregatedResult | undefined;
    if (this.config.runEvaluators && this.evaluatorRunner && executionResult.sessionId) {
      evaluation = await this.runEvaluators(testCase, executionResult.sessionId);
    }

    // Validate result
    const passed = this.validator.validate(
      testCase,
      executionResult.events,
      executionResult.errors,
      evaluation
    );

    // Log summary
    this.logTestSummary(passed, executionResult, evaluation);

    return {
      testCase,
      sessionId: executionResult.sessionId,
      passed,
      errors: executionResult.errors,
      events: executionResult.events,
      duration: executionResult.duration,
      approvalsGiven: executionResult.approvalsGiven,
      evaluation,
    };
  }

  /**
   * Run evaluators for a test
   */
  private async runEvaluators(
    testCase: TestCase,
    sessionId: string
  ): Promise<AggregatedResult | undefined> {
    if (!this.evaluatorRunner) return undefined;

    this.logger.log('Running evaluators...');
    
    // Add behavior evaluator if test case has behavior expectations
    if (testCase.behavior) {
      this.logger.log('Adding behavior evaluator for test expectations...');
      const behaviorEvaluator = new BehaviorEvaluator(testCase.behavior);
      this.evaluatorRunner.register(behaviorEvaluator);
      
      // If behavior specifies expectedContextFiles, replace context-loading evaluator with configured one
      if (testCase.behavior.expectedContextFiles && testCase.behavior.expectedContextFiles.length > 0) {
        this.logger.log(`Using explicit context files from test: ${testCase.behavior.expectedContextFiles.join(', ')}`);
        this.evaluatorRunner.unregister('context-loading');
        const contextEvaluator = new ContextLoadingEvaluator(testCase.behavior);
        this.evaluatorRunner.register(contextEvaluator);
      }

      // If behavior specifies agent/model expectations, replace agent-model evaluator with configured one
      if (testCase.behavior.expectedAgent || testCase.behavior.expectedModel) {
        this.logger.log(`Logging agent/model info: ${testCase.behavior.expectedAgent || 'any'} / ${testCase.behavior.expectedModel || 'any'}`);
        this.evaluatorRunner.unregister('agent-model');
        const agentModelEvaluator = new AgentModelEvaluator({
          expectedAgent: testCase.behavior.expectedAgent,
          expectedModel: testCase.behavior.expectedModel,
          projectPath: this.config.projectPath,
        });
        this.evaluatorRunner.register(agentModelEvaluator);
      }
    }
    
    try {
      const evaluation = await this.evaluatorRunner.runAll(sessionId);
      this.logger.log(`Evaluators completed: ${evaluation.totalViolations} violations found`);
      
      // Log agent-model info if available
      const agentModelResult = evaluation.evaluatorResults.find((r: any) => r.evaluator === 'agent-model');
      if (agentModelResult && agentModelResult.metadata?.actualAgent) {
        const agent = agentModelResult.metadata.actualAgent;
        this.logger.log(`\n${'─'.repeat(60)}`);
        this.logger.log(`📋 Agent/Model Info:`);
        this.logger.log(`   Agent: ${agent.name || agent.id || 'unknown'} (${agent.id || 'no-id'})`);
        this.logger.log(`   Category: ${agent.category || 'unknown'} | Type: ${agent.type || 'unknown'}`);
        this.logger.log(`   Version: ${agent.version || 'unknown'} | Mode: ${agent.mode || 'unknown'}`);
        if (agent.description) {
          this.logger.log(`   Description: ${agent.description}`);
        }
        if (agent.promptSnippet) {
          this.logger.log(`   Prompt: "${agent.promptSnippet.substring(0, 100)}..."`);
        }
        if (agentModelResult.metadata.expectedAgent || agentModelResult.metadata.expectedModel) {
          this.logger.log(`   Expected: ${agentModelResult.metadata.expectedAgent || 'any'} / ${agentModelResult.metadata.expectedModel || 'any'}`);
        }
        this.logger.log(`${'─'.repeat(60)}\n`);
      }
      
      // Log delegation info if available
      const delegationResult = evaluation.evaluatorResults.find((r: any) => r.evaluator === 'delegation');
      
      // Check allEvidence for task tool calls
      const taskToolEvidence = evaluation.allEvidence.find((e: any) => 
        e.type === 'task-tool-call' || e.description?.includes('Task tool call')
      );
      
      if (taskToolEvidence) {
        this.logger.log(`\n${'─'.repeat(60)}`);
        this.logger.log(`🔄 Delegation Summary:`);
        this.logger.log(`   ${taskToolEvidence.description}`);
        if (taskToolEvidence.data) {
          if (taskToolEvidence.data.subagent_type) {
            this.logger.log(`   Subagent: ${taskToolEvidence.data.subagent_type}`);
          }
          if (taskToolEvidence.data.description) {
            this.logger.log(`   Description: ${taskToolEvidence.data.description}`);
          }
          if (taskToolEvidence.data.prompt) {
            const prompt = taskToolEvidence.data.prompt.substring(0, 150);
            this.logger.log(`   Prompt: "${prompt}${taskToolEvidence.data.prompt.length > 150 ? '...' : ''}"`);
          }
        }
        this.logger.log(`${'─'.repeat(60)}\n`);
      }
      
      if (evaluation && evaluation.totalViolations > 0) {
        this.logger.log(`  Errors: ${evaluation.violationsBySeverity.error}`);
        this.logger.log(`  Warnings: ${evaluation.violationsBySeverity.warning}`);
      }
      
      // Clean up behavior evaluator after use
      if (testCase.behavior) {
        this.evaluatorRunner.unregister('behavior');
        
        // Restore default context-loading evaluator if we replaced it
        if (testCase.behavior.expectedContextFiles && testCase.behavior.expectedContextFiles.length > 0) {
          this.evaluatorRunner.unregister('context-loading');
          this.evaluatorRunner.register(new ContextLoadingEvaluator());
        }

        // Restore default agent-model evaluator if we replaced it
        if (testCase.behavior.expectedAgent || testCase.behavior.expectedModel) {
          this.evaluatorRunner.unregister('agent-model');
          this.evaluatorRunner.register(new AgentModelEvaluator({ projectPath: this.config.projectPath }));
        }
      }

      return evaluation;
    } catch (error) {
      this.logger.log(`Warning: Evaluators failed: ${(error as Error).message}`);
      return undefined;
    }
  }

  /**
   * Log test summary
   */
  private logTestSummary(
    passed: boolean,
    executionResult: { duration: number; events: ServerEvent[]; approvalsGiven: number; errors: string[] },
    evaluation?: AggregatedResult
  ): void {
    this.logger.log(`\nTest ${passed ? 'PASSED' : 'FAILED'}`);
    this.logger.log(`Duration: ${executionResult.duration}ms`);
    this.logger.log(`Events captured: ${executionResult.events.length}`);
    this.logger.log(`Approvals given: ${executionResult.approvalsGiven}`);
    this.logger.log(`Errors: ${executionResult.errors.length}`);
    
    if (evaluation) {
      this.logger.log(`Evaluation Score: ${evaluation.overallScore}/100`);
      this.logger.log(`Violations: ${evaluation.totalViolations} (E:${evaluation.violationsBySeverity.error} W:${evaluation.violationsBySeverity.warning})`);
      
      // Log violation details if any
      if (evaluation.totalViolations > 0) {
        this.logger.log(`\n${'─'.repeat(60)}`);
        this.logger.log(`⚠️  Violation Details:`);
        evaluation.allViolations.forEach((v: any, i: number) => {
          const icon = v.severity === 'error' ? '❌' : v.severity === 'warning' ? '⚠️' : 'ℹ️';
          this.logger.log(`   ${i + 1}. ${icon} [${v.rule || v.type}] ${v.message}`);
          if (v.context) {
            this.logger.log(`      Context: ${JSON.stringify(v.context)}`);
          }
        });
        this.logger.log(`${'─'.repeat(60)}\n`);
      }
    }
  }

  /**
   * Run multiple test cases
   */
  async runTests(testCases: TestCase[]): Promise<TestResult[]> {
    const results: TestResult[] = [];

    for (let i = 0; i < testCases.length; i++) {
      const testCase = testCases[i];
      
      // Add delay between tests to avoid rate limiting (except for first test)
      if (i > 0) {
        const delayMs = 3000; // 3 second delay between tests
        this.logger.log(`⏳ Waiting ${delayMs}ms before next test to avoid rate limiting...\n`);
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
      
      const result = await this.runTest(testCase);
      results.push(result);

      // Clean up session after each test (skip in debug mode to allow inspection)
      if (this.client && result.sessionId && !this.config.debug) {
        try {
          await this.client.deleteSession(result.sessionId);
          this.logger.log(`Cleaned up session: ${result.sessionId}\n`);
        } catch (error) {
          this.logger.log(`Failed to clean up session: ${(error as Error).message}\n`);
        }
      } else if (this.config.debug) {
        this.logger.log(`Debug mode: Keeping session ${result.sessionId} for inspection\n`);
      }
    }

    return results;
  }

  /**
   * Create approval strategy from test case config
   */
  private createApprovalStrategy(testCase: TestCase): ApprovalStrategy {
    const strategy = testCase.approvalStrategy;

    switch (strategy.type) {
      case 'auto-approve':
        return new AutoApproveStrategy();

      case 'auto-deny':
        return new AutoDenyStrategy();

      case 'smart':
        return new SmartApprovalStrategy({
          allowedTools: strategy.config?.allowedTools,
          deniedTools: strategy.config?.deniedTools,
          approvePatterns: strategy.config?.approvePatterns?.map(p => new RegExp(p)),
          denyPatterns: strategy.config?.denyPatterns?.map(p => new RegExp(p)),
          maxApprovals: strategy.config?.maxApprovals,
          defaultDecision: strategy.config?.defaultDecision,
        });

      default:
        throw new Error(`Unknown approval strategy: ${(strategy as any).type}`);
    }
  }
}
