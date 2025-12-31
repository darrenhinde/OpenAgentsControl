/**
 * ContextLoadingEvaluator - Verifies context files are loaded before execution
 * 
 * Rules:
 * 1. Before executing tasks, agents should load relevant context files
 * 2. Context files include:
 *    - .opencode/agent/*.md (agent definitions)
 *    - .opencode/context/*.md (domain knowledge, standards, processes)
 *    - docs/*.md (project documentation)
 * 3. Context should be loaded BEFORE execution tools are called
 * 4. Exception: Read-only conversational sessions don't require context loading
 * 
 * Checks:
 * - Detect if session involves execution (bash/write/edit/task)
 * - Check if context files were read before execution
 * - Track which context files were loaded
 * - Report violations where execution happens without context
 */

import { BaseEvaluator } from './base-evaluator.js';
import {
  TimelineEvent,
  SessionInfo,
  EvaluationResult,
  Violation,
  Evidence,
  Check,
  ContextLoadingCheck,
  TaskType
} from '../types/index.js';
import type { BehaviorExpectation } from '../sdk/test-case-schema.js';

export class ContextLoadingEvaluator extends BaseEvaluator {
  name = 'context-loading';
  description = 'Verifies context files are loaded before task execution';

  private behaviorConfig?: BehaviorExpectation;

  constructor(behaviorConfig?: BehaviorExpectation) {
    super();
    this.behaviorConfig = behaviorConfig;
  }

  // Context file patterns
  private contextPatterns = [
    /\.opencode\/agent\/.*\.md$/,
    /\.opencode\/context\/.*\.md$/,
    /docs\/.*\.md$/,
    /standards\/.*\.md$/,  // Allow standards/ paths
    /workflows\/.*\.md$/,  // Allow workflows/ paths
    /CONTRIBUTING\.md$/,
    /README\.md$/
  ];

  /**
   * Context file mapping per task type
   * Maps task types to their required context files (with flexible matching)
   */
  private readonly CONTEXT_FILE_MAP: Record<TaskType, string[]> = {
    'code': [
      '.opencode/context/core/standards/code.md',
      'standards/code.md',
      'code.md'
    ],
    'docs': [
      '.opencode/context/core/standards/docs.md',
      'standards/docs.md',
      'docs.md'
    ],
    'tests': [
      '.opencode/context/core/standards/tests.md',
      'standards/tests.md',
      'tests.md'
    ],
    'review': [
      '.opencode/context/core/workflows/review.md',
      'workflows/review.md',
      'review.md'
    ],
    'delegation': [
      '.opencode/context/core/workflows/delegation.md',
      'workflows/delegation.md',
      'delegation.md'
    ],
    'bash-only': [], // No context required
    'unknown': []    // Any context file acceptable
  };

  /**
   * Classify task type from user message and tool calls
   */
  private classifyTaskType(userMessage: string, executionTools: TimelineEvent[]): TaskType {
    const message = userMessage.toLowerCase();
    
    // Check for bash-only (no write/edit/task tools)
    const hasFileModification = executionTools.some(tool => 
      tool.data?.tool === 'write' || 
      tool.data?.tool === 'edit' ||
      tool.data?.tool === 'task'
    );
    
    if (!hasFileModification) {
      const allBash = executionTools.every(tool => tool.data?.tool === 'bash');
      if (allBash && executionTools.length > 0) {
        return 'bash-only';
      }
    }
    
    // Check for delegation
    const hasTaskTool = executionTools.some(tool => tool.data?.tool === 'task');
    if (hasTaskTool) {
      return 'delegation';
    }
    
    // Classify by message content (order matters - most specific first)
    const patterns: [RegExp, TaskType][] = [
      [/test|spec|jest|vitest|mocha|pytest|unittest/i, 'tests'],
      [/document|readme|docs|jsdoc|tsdoc|docstring/i, 'docs'],
      [/review|audit|check|analyze|inspect/i, 'review'],
      [/create|implement|write|add|build|develop|code|function|class|component/i, 'code'],
      [/refactor|fix|update|modify|change|edit/i, 'code'],
    ];
    
    for (const [pattern, taskType] of patterns) {
      if (pattern.test(message)) {
        return taskType;
      }
    }
    
    return 'unknown';
  }

  /**
   * Validate that the correct context file was loaded for the task type
   */
  private validateContextFileForTask(
    contextReads: Array<{ filePath: string; timestamp: number }>,
    taskType: TaskType
  ): {
    passed: boolean;
    expected: string[];
    actual: string[];
    matchedFile?: string;
  } {
    const expectedFiles = this.CONTEXT_FILE_MAP[taskType];
    const actualFiles = contextReads.map(r => r.filePath);
    
    // Bash-only doesn't require specific context
    if (taskType === 'bash-only') {
      return {
        passed: true,
        expected: [],
        actual: actualFiles,
        matchedFile: undefined
      };
    }
    
    // Unknown tasks - any context file is acceptable
    if (taskType === 'unknown' || expectedFiles.length === 0) {
      return {
        passed: actualFiles.length > 0,
        expected: ['any context file'],
        actual: actualFiles,
        matchedFile: actualFiles[0]
      };
    }
    
    // Check if any loaded file matches expected patterns
    for (const actualFile of actualFiles) {
      for (const expectedPattern of expectedFiles) {
        if (actualFile.includes(expectedPattern) || actualFile.endsWith(expectedPattern)) {
          return {
            passed: true,
            expected: expectedFiles,
            actual: actualFiles,
            matchedFile: actualFile
          };
        }
      }
    }
    
    // No match found - wrong context file loaded
    return {
      passed: false,
      expected: expectedFiles,
      actual: actualFiles,
      matchedFile: undefined
    };
  }

  async evaluate(timeline: TimelineEvent[], sessionInfo: SessionInfo): Promise<EvaluationResult> {
    const checks: Check[] = [];
    const violations: Violation[] = [];
    const evidence: Evidence[] = [];

    // Check if this is a task session (has execution tools)
    const executionTools = this.getExecutionTools(timeline);
    const isTaskSession = executionTools.length > 0;

    if (!isTaskSession) {
      // Conversational session - context loading not required
      checks.push({
        name: 'conversational-session',
        passed: true,
        weight: 100,
        evidence: [
          this.createEvidence(
            'session-type',
            'Conversational session - context loading not required',
            { executionToolCount: 0 }
          )
        ]
      });

      return this.buildResult(this.name, checks, violations, evidence, {
        isTaskSession: false,
        executionToolCount: 0
      });
    }

    // Check if this is a bash-only task (openagent.md line 172, 184)
    // Bash-only tasks don't require context files
    const isBashOnly = this.isBashOnlyTask(executionTools);
    
    if (isBashOnly) {
      checks.push({
        name: 'bash-only-task',
        passed: true,
        weight: 100,
        evidence: [
          this.createEvidence(
            'task-type',
            'Bash-only task - context loading not required (openagent.md line 172, 184)',
            { executionToolCount: executionTools.length, onlyBash: true }
          )
        ]
      });

      return this.buildResult(this.name, checks, violations, evidence, {
        isTaskSession: true,
        isBashOnly: true,
        executionToolCount: executionTools.length
      });
    }

    // Get user message for task classification
    const userMessages = this.getUserMessages(timeline);
    const firstUserMessage = userMessages[0]?.data?.text || userMessages[0]?.data?.content || '';
    
    // Classify task type
    const taskType = this.classifyTaskType(firstUserMessage, executionTools);
    
    // Get all read tool calls
    const readTools = this.getReadTools(timeline);
    
    // Find context file reads
    const contextReads = this.findContextReads(readTools);

    // Validate correct context file for task type
    const contextValidation = this.validateContextFileForTask(contextReads, taskType);

    // For multi-turn sessions, check if ANY context was loaded at ANY point
    // This is more lenient for complex conversations where context might be loaded
    // in response to different prompts
    const hasAnyContextLoaded = contextReads.length > 0;
    
    // Check if context was loaded before first execution
    const firstExecution = executionTools[0];
    const contextLoadedBeforeFirstExecution = this.wasContextLoadedBefore(
      contextReads,
      firstExecution.timestamp
    );

    // For multi-turn: Check each execution that requires context
    const executionsRequiringContext = executionTools.filter(tool => 
      tool.data?.tool === 'write' || 
      tool.data?.tool === 'edit' ||
      tool.data?.tool === 'task'
    );

    let allExecutionsHaveContext = true;
    const executionChecks: string[] = [];

    for (const execution of executionsRequiringContext) {
      const hasContextBefore = this.wasContextLoadedBefore(contextReads, execution.timestamp);
      executionChecks.push(
        `${execution.data?.tool} at ${new Date(execution.timestamp).toISOString()}: ${hasContextBefore ? '✓' : '✗'}`
      );
      if (!hasContextBefore) {
        allExecutionsHaveContext = false;
      }
    }

    // Build check with task type validation
    const check: ContextLoadingCheck = {
      contextFileLoaded: hasAnyContextLoaded && allExecutionsHaveContext && contextValidation.passed,
      contextFilePath: contextValidation.matchedFile || (contextReads.length > 0 ? contextReads[0].filePath : undefined),
      loadTimestamp: contextReads.length > 0 ? contextReads[0].timestamp : undefined,
      executionTimestamp: firstExecution.timestamp,
      taskType,
      expectedContextFiles: contextValidation.expected,
      actualContextFiles: contextValidation.actual,
      evidence: []
    };

    if (hasAnyContextLoaded) {
      // Show detection mode
      const detectionMode = this.behaviorConfig?.expectedContextFiles && this.behaviorConfig.expectedContextFiles.length > 0
        ? 'Explicit (from YAML test)'
        : 'Auto-detect (from user message)';
      
      check.evidence.push(
        `Task type: ${taskType}`,
        `Expected context: ${contextValidation.expected.length > 0 ? contextValidation.expected.join(' or ') : 'none'}`,
        ``,
        `Context files loaded: ${contextReads.length}`,
        ...contextReads.map(r => `  - ${r.filePath} at ${new Date(r.timestamp).toISOString()}`),
        ``
      );
      
      if (contextValidation.passed) {
        check.evidence.push(`✓ Correct context file loaded for task type '${taskType}'`);
      } else if (taskType !== 'bash-only' && contextValidation.expected.length > 0) {
        check.evidence.push(`✗ Wrong context file - expected: ${contextValidation.expected.join(' or ')}`);
      }
      
      check.evidence.push(
        ``,
        `Execution checks (${executionsRequiringContext.length} total):`,
        ...executionChecks
      );
      
      if (allExecutionsHaveContext) {
        check.evidence.push(``, `✓ All executions have context loaded before them`);
      } else {
        check.evidence.push(``, `✗ Some executions missing context`);
      }
    } else {
      check.evidence.push(
        `Task type: ${taskType}`,
        `Expected context: ${contextValidation.expected.length > 0 ? contextValidation.expected.join(' or ') : 'none'}`,
        ``,
        `No context files loaded in session`,
        `First execution: ${new Date(firstExecution.timestamp).toISOString()}`,
        `Execution tool: ${firstExecution.data?.tool}`
      );
    }

    // Add check result
    checks.push({
      name: 'context-loaded-before-execution',
      passed: hasAnyContextLoaded && allExecutionsHaveContext && contextValidation.passed,
      weight: 100,
      evidence: check.evidence.map(e =>
        this.createEvidence('context-check', e, {
          contextFiles: contextReads.map(r => r.filePath),
          executionTool: firstExecution.data?.tool,
          totalExecutions: executionsRequiringContext.length,
          executionsWithContext: executionChecks.filter(c => c.includes('✓')).length,
          taskType,
          expectedContext: contextValidation.expected,
          actualContext: contextValidation.actual
        })
      )
    });

    // Add violation if context not loaded properly
    if (!hasAnyContextLoaded) {
      violations.push(
        this.createViolation(
          'no-context-loaded',
          'warning',
          'Task execution started without loading any context files',
          firstExecution.timestamp,
          {
            executionTool: firstExecution.data?.tool,
            timestamp: firstExecution.timestamp,
            contextFilesRead: 0,
            taskType,
            expectedContext: contextValidation.expected
          }
        )
      );
    } else if (!contextValidation.passed && taskType !== 'bash-only' && taskType !== 'unknown') {
      // Wrong context file loaded
      violations.push(
        this.createViolation(
          'wrong-context-file',
          'error',
          `Task type '${taskType}' requires context file(s): ${contextValidation.expected.join(' or ')}. ` +
          `Loaded: ${contextValidation.actual.length > 0 ? contextValidation.actual.join(', ') : 'none'}`,
          firstExecution.timestamp,
          {
            taskType,
            expected: contextValidation.expected,
            actual: contextValidation.actual,
            executionTool: firstExecution.data?.tool
          }
        )
      );
    } else if (!allExecutionsHaveContext) {
      violations.push(
        this.createViolation(
          'context-loaded-after-execution',
          'warning',
          'Some executions happened before context was loaded',
          firstExecution.timestamp,
          {
            totalExecutions: executionsRequiringContext.length,
            executionsWithContext: executionChecks.filter(c => c.includes('✓')).length,
            contextFilesRead: contextReads.length
          }
        )
      );
    }

    // Add evidence
    evidence.push(
      this.createEvidence(
        'context-files',
        `Found ${contextReads.length} context file reads`,
        {
          contextFiles: contextReads.map(r => ({
            path: r.filePath,
            timestamp: r.timestamp
          }))
        }
      )
    );

    evidence.push(
      this.createEvidence(
        'execution-tools',
        `Found ${executionTools.length} execution tool calls`,
        {
          tools: executionTools.map(t => ({
            tool: t.data?.tool,
            timestamp: t.timestamp
          }))
        }
      )
    );

    return this.buildResult(this.name, checks, violations, evidence, {
      isTaskSession: true,
      executionToolCount: executionTools.length,
      contextFileCount: contextReads.length,
      contextLoadedBeforeExecution: hasAnyContextLoaded && allExecutionsHaveContext && contextValidation.passed,
      contextCheck: check,
      multiTurn: executionsRequiringContext.length > 1,
      executionsRequiringContext: executionsRequiringContext.length,
      executionsWithContext: executionChecks.filter(c => c.includes('✓')).length,
      taskType,
      expectedContextFiles: contextValidation.expected,
      actualContextFiles: contextValidation.actual,
      correctContextLoaded: contextValidation.passed
    });
  }

  /**
   * Find all context file reads in timeline
   */
  private findContextReads(readTools: TimelineEvent[]): Array<{
    filePath: string;
    timestamp: number;
  }> {
    const contextReads: Array<{ filePath: string; timestamp: number }> = [];

    for (const tool of readTools) {
      // Try multiple possible locations for file path
      const filePath = tool.data?.state?.input?.filePath || 
                      tool.data?.state?.input?.path ||
                      tool.data?.input?.filePath || 
                      tool.data?.input?.path ||
                      tool.data?.filePath ||
                      tool.data?.path;
      
      if (filePath && this.isContextFile(filePath)) {
        contextReads.push({
          filePath,
          timestamp: tool.timestamp
        });
      }
    }

    // Sort by timestamp (earliest first)
    return contextReads.sort((a, b) => a.timestamp - b.timestamp);
  }

  /**
   * Check if file path is a context file
   */
  private isContextFile(filePath: string): boolean {
    return this.contextPatterns.some(pattern => pattern.test(filePath));
  }

  /**
   * Check if context was loaded before a timestamp
   */
  private wasContextLoadedBefore(
    contextReads: Array<{ filePath: string; timestamp: number }>,
    timestamp: number
  ): boolean {
    return contextReads.some(read => read.timestamp < timestamp);
  }

  /**
   * Get required context file for a task type
   */
  private getRequiredContext(userMessage: string): string | undefined {
    // Simple heuristic - could be enhanced
    if (/test|spec|jest|vitest/i.test(userMessage)) {
      return '.opencode/context/testing.md';
    }
    if (/document|readme|docs/i.test(userMessage)) {
      return '.opencode/context/documentation.md';
    }
    if (/code|implement|feature|refactor/i.test(userMessage)) {
      return '.opencode/context/standards.md';
    }
    return undefined;
  }

  /**
   * Check if task is bash-only (no write/edit/task tools)
   * Per openagent.md line 172, 184: "bash-only → No context needed"
   */
  private isBashOnlyTask(executionTools: TimelineEvent[]): boolean {
    // Check if ALL execution tools are bash
    const allBash = executionTools.every(tool => tool.data?.tool === 'bash');
    
    // Check if there are NO write/edit/task tools
    const hasFileModification = executionTools.some(tool => 
      tool.data?.tool === 'write' || 
      tool.data?.tool === 'edit' ||
      tool.data?.tool === 'task'
    );
    
    return allBash && !hasFileModification;
  }
}
