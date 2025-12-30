/**
 * Task Type Detector - Determines the type of task from user message and timeline
 * 
 * This helps evaluators determine if they should apply their rules.
 * For example, "create new file" tasks don't need read-before-write checks.
 */

import type { TimelineEvent, TaskType } from '../types/index.js';

/**
 * Detect task type from user message and timeline events
 */
export function detectTaskType(userMessage: string | any, timeline: TimelineEvent[]): TaskType {
  // Extract text from userMessage (could be string or object)
  const messageText = typeof userMessage === 'string' 
    ? userMessage 
    : (userMessage?.text || userMessage?.content || '');
  const msg = messageText.toLowerCase();
  const toolCalls = timeline.filter(e => e.type === 'tool_call');
  const tools = toolCalls.map(t => t.data?.tool).filter(Boolean);
  
  // Delegation - uses task tool
  if (tools.includes('task')) {
    return 'delegation';
  }
  
  // Read-only - only read tools, no execution
  const readTools = ['read', 'glob', 'grep', 'list'];
  const executionTools = ['write', 'edit', 'bash', 'task'];
  const hasOnlyReadTools = tools.length > 0 && 
                           tools.every(t => readTools.includes(t)) &&
                           !tools.some(t => executionTools.includes(t));
  if (hasOnlyReadTools) {
    return 'read-only';
  }
  
  // Bash-only - only bash, no file modifications
  const hasBashOnly = tools.includes('bash') && 
                      !tools.includes('write') && 
                      !tools.includes('edit');
  if (hasBashOnly && tools.length > 0) {
    return 'bash-only';
  }
  
  // Check for specific task types BEFORE generic create/modify patterns
  // This ensures "create a function" is classified as 'code', not 'create-new-file'
  
  // Tests - test/spec keywords (but not in file paths or content strings)
  // More specific patterns to avoid false positives from filenames like "test-file.txt"
  // Require test/spec to be close to the action verb (within ~20 chars)
  if (/\b(write|create|add|implement|generate)\s+(?:a\s+|an\s+|some\s+|new\s+)?(tests?|specs?|unit tests?|integration tests?)\b/i.test(msg) ||
      /\b(jest|vitest|mocha|pytest|unittest)\b/i.test(msg)) {
    return 'tests';
  }
  
  // Docs - documentation keywords (check for both noun and verb forms)
  if (/\b(document|documentation|readme|docs|jsdoc|tsdoc|docstring)\b/i.test(msg)) {
    return 'docs';
  }
  
  // Review - review/audit keywords
  if (/\b(review|audit|check|analyze|inspect)\b/i.test(msg)) {
    return 'review';
  }
  
  // Code - function/class/component keywords (more specific than "create")
  if (/\b(function|class|component|method|module|interface|type|enum)\b/i.test(msg)) {
    return 'code';
  }
  
  // Create new file - keywords indicate file creation (not code creation)
  const createKeywords = /\b(create|new|add|make|generate|write)\b/i;
  const modifyKeywords = /\b(modify|update|change|edit|fix|existing|current)\b/i;
  const fileKeywords = /\b(file|directory|folder)\b/i;
  
  if (process.env.DEBUG_TASK_TYPE) {
    console.log('[TaskTypeDetector] Checking create-new-file:');
    console.log('  createKeywords.test(msg):', createKeywords.test(msg));
    console.log('  !modifyKeywords.test(msg):', !modifyKeywords.test(msg));
    console.log('  fileKeywords.test(msg):', fileKeywords.test(msg));
    console.log('  tools.includes("write"):', tools.includes('write'));
  }
  
  if (createKeywords.test(msg) && !modifyKeywords.test(msg) && fileKeywords.test(msg)) {
    if (tools.includes('write')) {
      if (process.env.DEBUG_TASK_TYPE) {
        console.log('[TaskTypeDetector] Detected: create-new-file');
      }
      return 'create-new-file';
    }
  }
  
  // Code - generic code keywords (implement, build, develop, refactor, fix)
  if (/\b(implement|build|develop|code|refactor|fix)\b/i.test(msg)) {
    if (process.env.DEBUG_TASK_TYPE) {
      console.log('[TaskTypeDetector] Detected: code (generic keywords)');
    }
    return 'code';
  }
  
  // Modify existing file - keywords indicate modification
  if (modifyKeywords.test(msg)) {
    if (tools.includes('write') || tools.includes('edit')) {
      if (process.env.DEBUG_TASK_TYPE) {
        console.log('[TaskTypeDetector] Detected: modify-existing-file');
      }
      return 'modify-existing-file';
    }
  }
  
  // Delete - keywords indicate deletion
  if (/\b(delete|remove|rm)\b/i.test(msg)) {
    if (process.env.DEBUG_TASK_TYPE) {
      console.log('[TaskTypeDetector] Detected: delete-file');
    }
    return 'delete-file';
  }
  
  // Conversational - no tools used
  if (tools.length === 0) {
    if (process.env.DEBUG_TASK_TYPE) {
      console.log('[TaskTypeDetector] Detected: conversational');
    }
    return 'conversational';
  }
  
  if (process.env.DEBUG_TASK_TYPE) {
    console.log('[TaskTypeDetector] Result: unknown (fallthrough)');
    console.log('[TaskTypeDetector] ===== END =====\n');
  }
  return 'unknown';
}

/**
 * Get evaluator applicability for a task type
 * 
 * Returns whether an evaluator should run for a given task type.
 */
export function getEvaluatorApplicability(
  evaluatorName: string,
  taskType: TaskType
): { applicable: boolean; reason?: string } {
  const matrix: Record<string, Partial<Record<TaskType, { applicable: boolean; reason?: string }>>> = {
    'approval-gate': {
      'create-new-file': { applicable: true },
      'modify-existing-file': { applicable: true },
      'delete-file': { applicable: true },
      'read-only': { applicable: false, reason: 'Read-only operations do not require approval' },
      'bash-only': { applicable: true },
      'delegation': { applicable: true },
      'conversational': { applicable: false, reason: 'Conversational sessions do not require approval' },
      'code': { applicable: true },
      'docs': { applicable: true },
      'tests': { applicable: true },
      'review': { applicable: true },
      'unknown': { applicable: true },
    },
    'context-loading': {
      'create-new-file': { applicable: false, reason: 'Simple file creation does not require context' },
      'modify-existing-file': { applicable: true },
      'delete-file': { applicable: false, reason: 'File deletion does not require context' },
      'read-only': { applicable: false, reason: 'Read-only operations do not require context' },
      'bash-only': { applicable: false, reason: 'Bash-only operations do not require context' },
      'delegation': { applicable: true },
      'conversational': { applicable: false, reason: 'Conversational sessions do not require context' },
      'code': { applicable: true },
      'docs': { applicable: true },
      'tests': { applicable: true },
      'review': { applicable: true },
      'unknown': { applicable: true },
    },
    'execution-balance': {
      'create-new-file': { applicable: false, reason: 'Creating new file - nothing to read' },
      'modify-existing-file': { applicable: true },
      'delete-file': { applicable: false, reason: 'File deletion does not require prior read' },
      'read-only': { applicable: false, reason: 'No execution tools used' },
      'bash-only': { applicable: false, reason: 'Bash-only operations do not require read-before-execute' },
      'delegation': { applicable: false, reason: 'Delegation tasks have different execution patterns' },
      'conversational': { applicable: false, reason: 'No execution tools used' },
      'code': { applicable: true },
      'docs': { applicable: true },
      'tests': { applicable: true },
      'review': { applicable: true },
      'unknown': { applicable: true },
    },
    'tool-usage': {
      'create-new-file': { applicable: true },
      'modify-existing-file': { applicable: true },
      'delete-file': { applicable: true },
      'read-only': { applicable: true },
      'bash-only': { applicable: true },
      'delegation': { applicable: true },
      'conversational': { applicable: false, reason: 'No tools used' },
      'code': { applicable: true },
      'docs': { applicable: true },
      'tests': { applicable: true },
      'review': { applicable: true },
      'unknown': { applicable: true },
    },
    'delegation': {
      'create-new-file': { applicable: false, reason: 'Simple task - no delegation needed' },
      'modify-existing-file': { applicable: false, reason: 'Simple task - no delegation needed' },
      'delete-file': { applicable: false, reason: 'Simple task - no delegation needed' },
      'read-only': { applicable: false, reason: 'Simple task - no delegation needed' },
      'bash-only': { applicable: false, reason: 'Simple task - no delegation needed' },
      'delegation': { applicable: true },
      'conversational': { applicable: false, reason: 'No delegation in conversational sessions' },
      'code': { applicable: false, reason: 'Simple task - no delegation needed' },
      'docs': { applicable: false, reason: 'Simple task - no delegation needed' },
      'tests': { applicable: false, reason: 'Simple task - no delegation needed' },
      'review': { applicable: true },
      'unknown': { applicable: true },
    },
    'stop-on-failure': {
      'create-new-file': { applicable: true },
      'modify-existing-file': { applicable: true },
      'delete-file': { applicable: true },
      'read-only': { applicable: true },
      'bash-only': { applicable: true },
      'delegation': { applicable: true },
      'conversational': { applicable: false, reason: 'No execution in conversational sessions' },
      'code': { applicable: true },
      'docs': { applicable: true },
      'tests': { applicable: true },
      'review': { applicable: true },
      'unknown': { applicable: true },
    },
    'behavior': {
      'create-new-file': { applicable: true },
      'modify-existing-file': { applicable: true },
      'delete-file': { applicable: true },
      'read-only': { applicable: true },
      'bash-only': { applicable: true },
      'delegation': { applicable: true },
      'conversational': { applicable: true },
      'code': { applicable: true },
      'docs': { applicable: true },
      'tests': { applicable: true },
      'review': { applicable: true },
      'unknown': { applicable: true },
    },
  };
  
  const evaluatorMatrix = matrix[evaluatorName];
  if (!evaluatorMatrix) {
    // Unknown evaluator - assume applicable
    return { applicable: true };
  }
  
  return evaluatorMatrix[taskType] || { applicable: true };
}
