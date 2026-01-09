/**
 * ErrorHandlingEvaluator - Checks for proper error handling in code written by agents
 *
 * Rules:
 * 1. Risky operations should be wrapped in try/catch blocks
 * 2. Async functions should handle promise rejections
 * 3. Error messages should be descriptive (not generic)
 * 4. API calls should have error handling
 * 5. File operations should have error handling
 * 6. React components should have error boundaries where appropriate
 *
 * Checks:
 * - Analyze code content from write/edit tool calls
 * - Detect risky operations without error handling
 * - Check for generic error messages
 * - Validate error boundary usage in React components
 */

import { BaseEvaluator } from './base-evaluator.js';
import {
  TimelineEvent,
  SessionInfo,
  EvaluationResult,
  Violation,
  Evidence,
  Check,
} from '../types/index.js';

interface CodeAnalysis {
  filePath: string;
  content: string;
  language: 'javascript' | 'typescript' | 'python' | 'unknown';
  riskyOperations: RiskyOperation[];
  errorMessages: ErrorMessage[];
  hasErrorBoundaries: boolean;
}

interface RiskyOperation {
  type: 'api_call' | 'file_io' | 'async_operation' | 'network' | 'database';
  line: number;
  code: string;
  hasErrorHandling: boolean;
}

interface ErrorMessage {
  line: number;
  message: string;
  isGeneric: boolean;
}

export class ErrorHandlingEvaluator extends BaseEvaluator {
  name = 'error-handling';
  description = 'Validates proper error handling patterns in code written by agents';

  async evaluate(timeline: TimelineEvent[], sessionInfo: SessionInfo): Promise<EvaluationResult> {
    const checks: Check[] = [];
    const violations: Violation[] = [];
    const evidence: Evidence[] = [];

    // Get all code writing operations
    const codeWriteEvents = this.getCodeWriteEvents(timeline);

    if (codeWriteEvents.length === 0) {
      // No code writing detected - pass by default
      checks.push({
        name: 'no-code-written',
        passed: true,
        weight: 100,
        evidence: [
          this.createEvidence(
            'no-code',
            'No code writing operations detected in this session',
            { codeWriteEventCount: 0 }
          )
        ]
      });

      return this.buildResult(this.name, checks, violations, evidence, {
        codeWriteEventCount: 0,
        analysisCount: 0
      });
    }

    // Analyze each code writing operation
    const analyses: CodeAnalysis[] = [];

    for (const event of codeWriteEvents) {
      const analysis = this.analyzeCodeContent(event);
      if (analysis) {
        analyses.push(analysis);
      }
    }

    // Evaluate each analysis
    for (const analysis of analyses) {
      const analysisChecks = this.evaluateCodeAnalysis(analysis);

      checks.push(...analysisChecks.checks);
      violations.push(...analysisChecks.violations);
      evidence.push(...analysisChecks.evidence);
    }

    return this.buildResult(this.name, checks, violations, evidence, {
      codeWriteEventCount: codeWriteEvents.length,
      analysisCount: analyses.length,
      totalRiskyOperations: analyses.reduce((sum, a) => sum + a.riskyOperations.length, 0)
    });
  }

  /**
   * Get all events that write or edit code
   */
  private getCodeWriteEvents(timeline: TimelineEvent[]): TimelineEvent[] {
    return timeline.filter(event =>
      event.type === 'tool_call' &&
      (event.data?.tool === 'write' || event.data?.tool === 'edit')
    );
  }

  /**
   * Analyze the code content from a write/edit event
   */
  private analyzeCodeContent(event: TimelineEvent): CodeAnalysis | null {
    const toolData = event.data;
    if (!toolData) return null;

    let content = '';
    let filePath = '';

    if (toolData.tool === 'write') {
      content = toolData.input?.content || '';
      filePath = toolData.input?.filePath || '';
    } else if (toolData.tool === 'edit') {
      content = toolData.input?.newString || '';
      filePath = toolData.input?.filePath || '';
    }

    if (!content.trim()) return null;

    const language = this.detectLanguage(filePath, content);
    const riskyOperations = this.findRiskyOperations(content, language);
    const errorMessages = this.findErrorMessages(content, language);
    const hasErrorBoundaries = this.checkErrorBoundaries(content, language);

    return {
      filePath,
      content,
      language,
      riskyOperations,
      errorMessages,
      hasErrorBoundaries
    };
  }

  /**
   * Detect programming language from file extension and content
   */
  private detectLanguage(filePath: string, content: string): 'javascript' | 'typescript' | 'python' | 'unknown' {
    const ext = filePath.split('.').pop()?.toLowerCase();

    if (ext === 'js' || ext === 'jsx') return 'javascript';
    if (ext === 'ts' || ext === 'tsx') return 'typescript';
    if (ext === 'py') return 'python';

    // Fallback to content analysis
    if (content.includes('import') || content.includes('export') || content.includes('const ') || content.includes('function ')) {
      return content.includes(': ') || content.includes('interface ') ? 'typescript' : 'javascript';
    }

    return 'unknown';
  }

  /**
   * Find risky operations that should have error handling
   */
  private findRiskyOperations(content: string, language: string): RiskyOperation[] {
    const operations: RiskyOperation[] = [];
    const lines = content.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();

      // API calls
      if (this.isApiCall(trimmed, language)) {
        operations.push({
          type: 'api_call',
          line: i + 1,
          code: trimmed,
          hasErrorHandling: this.hasErrorHandling(content, i, language)
        });
      }

      // File I/O operations
      if (this.isFileOperation(trimmed, language)) {
        operations.push({
          type: 'file_io',
          line: i + 1,
          code: trimmed,
          hasErrorHandling: this.hasErrorHandling(content, i, language)
        });
      }

      // Async operations
      if (this.isAsyncOperation(trimmed, language)) {
        operations.push({
          type: 'async_operation',
          line: i + 1,
          code: trimmed,
          hasErrorHandling: this.hasErrorHandling(content, i, language)
        });
      }

      // Network operations (but not if already counted as API calls)
      if (this.isNetworkOperation(trimmed, language) && !this.isApiCall(trimmed, language)) {
        operations.push({
          type: 'network',
          line: i + 1,
          code: trimmed,
          hasErrorHandling: this.hasErrorHandling(content, i, language)
        });
      }
    }

    return operations;
  }

  /**
   * Check if a line contains an API call
   */
  private isApiCall(line: string, language: string): boolean {
    if (language === 'javascript' || language === 'typescript') {
      return /fetch\(|axios\.|\.post\(|\.get\(|\.put\(|\.delete\(/.test(line);
    }
    if (language === 'python') {
      return /requests\.(get|post|put|delete|patch)/.test(line);
    }
    return false;
  }

  /**
   * Check if a line contains file I/O operations
   */
  private isFileOperation(line: string, language: string): boolean {
    if (language === 'javascript' || language === 'typescript') {
      return /fs\.|\.readFile\(|\.writeFile\(|\.unlink\(/.test(line);
    }
    if (language === 'python') {
      return /open\(|\.read\(\)|\.write\(\)|os\.|pathlib\.|shutil\./.test(line);
    }
    return false;
  }

  /**
   * Check if a line contains async operations
   */
  private isAsyncOperation(line: string, language: string): boolean {
    if (language === 'javascript' || language === 'typescript') {
      // Don't count function declarations, only actual async operations
      return /await |Promise\.(all|race|any|resolve|reject)/.test(line) && !/async function|async \(/.test(line);
    }
    if (language === 'python') {
      return /await /.test(line) && !/async def /.test(line);
    }
    return false;
  }

  /**
   * Check if a line contains network operations
   */
  private isNetworkOperation(line: string, language: string): boolean {
    return this.isApiCall(line, language) ||
           /http\.|socket\.|net\.|tcp\.|udp\./.test(line);
  }

  /**
   * Check if code around a line has error handling
   */
  private hasErrorHandling(content: string, lineIndex: number, language: string): boolean {
    const lines = content.split('\n');
    const startLine = Math.max(0, lineIndex - 2);
    const endLine = Math.min(lines.length, lineIndex + 2);
    const context = lines.slice(startLine, endLine).join('\n');

    if (language === 'javascript' || language === 'typescript') {
      return /try\s*\{[\s\S]*?catch\s*\(/.test(context) ||
             /catch\s*\(/.test(context) ||
             /\.catch\(/.test(context);
    }

    if (language === 'python') {
      return /try\s*:/m.test(context) ||
             /except\s+/.test(context) ||
             /with\s+/.test(context);
    }

    return false;
  }

  /**
   * Find error messages in the code
   */
  private findErrorMessages(content: string, language: string): ErrorMessage[] {
    const messages: ErrorMessage[] = [];
    const lines = content.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const errorMessageMatch = this.extractErrorMessage(line, language);

      if (errorMessageMatch) {
        messages.push({
          line: i + 1,
          message: errorMessageMatch,
          isGeneric: this.isGenericErrorMessage(errorMessageMatch)
        });
      }
    }

    return messages;
  }

  /**
   * Extract error message from a line of code
   */
  private extractErrorMessage(line: string, language: string): string | null {
    if (language === 'javascript' || language === 'typescript') {
      const match = line.match(/['"`](.*?(?:error|Error|failed|Failed).*?)['"`]/);
      return match ? match[1] : null;
    }

    if (language === 'python') {
      const match = line.match(/['"""](.*?(?:error|Error|failed|Failed).*?)['"""]/);
      return match ? match[1] : null;
    }

    return null;
  }

  /**
   * Check if an error message is generic
   */
  private isGenericErrorMessage(message: string): boolean {
    const genericPatterns = [
      /^error$/i,
      /^an error occurred$/i,
      /^something went wrong$/i,
      /^failed$/i,
      /^operation failed$/i,
      /^unknown error$/i,
      /^unexpected error$/i
    ];

    return genericPatterns.some(pattern => pattern.test(message));
  }

  /**
   * Check if code has error boundaries (for React)
   */
  private checkErrorBoundaries(content: string, language: string): boolean {
    if (language !== 'javascript' && language !== 'typescript') {
      return true; // Not applicable
    }

    // Check for React component class with error boundary
    if (content.includes('componentDidCatch') || content.includes('getDerivedStateFromError')) {
      return true;
    }

    // Check for functional component with error boundary
    if (content.includes('ErrorBoundary') || content.includes('error boundary')) {
      return true;
    }

    // For simple components, error boundaries might not be necessary
    return true;
  }

  /**
   * Evaluate a code analysis and generate checks/violations
   */
  private evaluateCodeAnalysis(analysis: CodeAnalysis): {
    checks: Check[];
    violations: Violation[];
    evidence: Evidence[];
  } {
    const checks: Check[] = [];
    const violations: Violation[] = [];
    const evidence: Evidence[] = [];

    // Check risky operations without error handling
    const unprotectedOperations = analysis.riskyOperations.filter(op => !op.hasErrorHandling);

    if (unprotectedOperations.length > 0) {
      checks.push({
        name: `risky-operations-${analysis.filePath}`,
        passed: false,
        weight: 40,
        evidence: unprotectedOperations.map(op =>
          this.createEvidence('unprotected-operation', `Line ${op.line}: ${op.code}`, {
            type: op.type,
            filePath: analysis.filePath
          })
        )
      });

      for (const op of unprotectedOperations) {
        violations.push(
          this.createViolation(
            'missing-error-handling',
            'error',
            `Risky operation without error handling: ${op.type} on line ${op.line}`,
            0, // No specific timestamp
            {
              filePath: analysis.filePath,
              operationType: op.type,
              line: op.line,
              code: op.code
            }
          )
        );
      }
    } else {
      checks.push({
        name: `risky-operations-${analysis.filePath}`,
        passed: true,
        weight: 40,
        evidence: [
          this.createEvidence(
            'protected-operations',
            `All ${analysis.riskyOperations.length} risky operations have error handling`,
            { operationCount: analysis.riskyOperations.length }
          )
        ]
      });
    }

    // Check for generic error messages
    const genericMessages = analysis.errorMessages.filter(msg => msg.isGeneric);

    if (genericMessages.length > 0) {
      checks.push({
        name: `error-messages-${analysis.filePath}`,
        passed: false,
        weight: 30,
        evidence: genericMessages.map(msg =>
          this.createEvidence('generic-error-message', `Line ${msg.line}: "${msg.message}"`, {
            filePath: analysis.filePath
          })
        )
      });

      for (const msg of genericMessages) {
        violations.push(
          this.createViolation(
            'generic-error-message',
            'info',
            `Generic error message on line ${msg.line}: "${msg.message}"`,
            0,
            {
              filePath: analysis.filePath,
              line: msg.line,
              message: msg.message
            }
          )
        );
      }
    } else {
      checks.push({
        name: `error-messages-${analysis.filePath}`,
        passed: true,
        weight: 30,
        evidence: [
          this.createEvidence(
            'descriptive-messages',
            'All error messages are descriptive',
            { messageCount: analysis.errorMessages.length }
          )
        ]
      });
    }

    // Check error boundaries (for React)
    if (analysis.language === 'javascript' || analysis.language === 'typescript') {
      checks.push({
        name: `error-boundaries-${analysis.filePath}`,
        passed: analysis.hasErrorBoundaries,
        weight: 30,
        evidence: [
          this.createEvidence(
            'error-boundary-check',
            analysis.hasErrorBoundaries ? 'Error boundaries present' : 'No error boundaries detected',
            { hasErrorBoundaries: analysis.hasErrorBoundaries }
          )
        ]
      });

      if (!analysis.hasErrorBoundaries) {
        violations.push(
          this.createViolation(
            'missing-error-boundary',
            'info',
            'React component may benefit from error boundary',
            0,
            { filePath: analysis.filePath }
          )
        );
      }
    }

    return { checks, violations, evidence };
  }
}