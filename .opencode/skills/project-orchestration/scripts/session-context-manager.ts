#!/usr/bin/env npx ts-node
/**
 * Session Context Manager
 *
 * Manages persistent session context files to solve context fragmentation
 * in multi-agent orchestration. All agents read/update a shared context.md
 * file to maintain state across delegations.
 *
 * Usage:
 *   import { createSession, loadSession, updateSession } from './session-context-manager';
 *
 * Location: .tmp/sessions/{session-id}/context.md
 */

const fs = require('fs');
const path = require('path');

// Find project root (look for .git or package.json)
function findProjectRoot(): string {
  let dir = process.cwd();
  while (dir !== path.dirname(dir)) {
    if (fs.existsSync(path.join(dir, '.git')) || fs.existsSync(path.join(dir, 'package.json'))) {
      return dir;
    }
    dir = path.dirname(dir);
  }
  return process.cwd();
}

const PROJECT_ROOT = findProjectRoot();
const SESSIONS_DIR = path.join(PROJECT_ROOT, '.tmp', 'sessions');

// Types
interface SessionContext {
  sessionId: string;
  feature: string;
  created: string;
  status: 'in_progress' | 'completed' | 'blocked';
  request: string;
  contextFiles: string[];
  referenceFiles: string[];
  architecture?: {
    boundedContext?: string;
    module?: string;
    verticalSlice?: string;
  };
  stories?: string[];
  priorities?: {
    riceScore?: number;
    wsjfScore?: number;
    releaseSlice?: string;
  };
  contracts?: Array<{
    type: string;
    name: string;
    path?: string;
    status: string;
  }>;
  adrs?: Array<{
    id: string;
    path?: string;
    title?: string;
  }>;
  progress: {
    currentStage: string;
    completedStages: string[];
    outputs: Record<string, string[]>;
  };
  decisions: Array<{
    timestamp: string;
    decision: string;
    rationale: string;
  }>;
  files: string[];
  exitCriteria: string[];
}

interface SessionUpdate {
  status?: 'in_progress' | 'completed' | 'blocked';
  contextFiles?: string[];
  referenceFiles?: string[];
  architecture?: {
    boundedContext?: string;
    module?: string;
    verticalSlice?: string;
  };
  stories?: string[];
  priorities?: {
    riceScore?: number;
    wsjfScore?: number;
    releaseSlice?: string;
  };
  contracts?: Array<{
    type: string;
    name: string;
    path?: string;
    status: string;
  }>;
  adrs?: Array<{
    id: string;
    path?: string;
    title?: string;
  }>;
}

interface StageOutput {
  stage: string;
  outputs: string[];
}

interface Decision {
  decision: string;
  rationale: string;
}

// Ensure sessions directory exists
function ensureSessionsDir(): void {
  if (!fs.existsSync(SESSIONS_DIR)) {
    fs.mkdirSync(SESSIONS_DIR, { recursive: true });
  }
}

// Get session directory path
function getSessionDir(sessionId: string): string {
  return path.join(SESSIONS_DIR, sessionId);
}

// Get context file path
function getContextPath(sessionId: string): string {
  return path.join(getSessionDir(sessionId), 'context.md');
}

// Generate context.md content from session data
function generateContextMarkdown(session: SessionContext): string {
  const lines: string[] = [];

  // Header
  lines.push(`# Task Context: ${session.feature}`);
  lines.push('');
  lines.push(`Session ID: ${session.sessionId}`);
  lines.push(`Created: ${session.created}`);
  lines.push(`Status: ${session.status}`);
  lines.push('');

  // Current Request
  lines.push('## Current Request');
  lines.push(session.request);
  lines.push('');

  // Context Files
  if (session.contextFiles.length > 0) {
    lines.push('## Context Files to Load');
    session.contextFiles.forEach(file => lines.push(`- ${file}`));
    lines.push('');
  }

  // Reference Files
  if (session.referenceFiles.length > 0) {
    lines.push('## Reference Files');
    session.referenceFiles.forEach(file => lines.push(`- ${file}`));
    lines.push('');
  }

  // Architecture
  if (session.architecture) {
    lines.push('## Architecture');
    if (session.architecture.boundedContext) {
      lines.push(`- Bounded Context: ${session.architecture.boundedContext}`);
    }
    if (session.architecture.module) {
      lines.push(`- Module: ${session.architecture.module}`);
    }
    if (session.architecture.verticalSlice) {
      lines.push(`- Vertical Slice: ${session.architecture.verticalSlice}`);
    }
    lines.push('');
  }

  // Stories
  if (session.stories && session.stories.length > 0) {
    lines.push('## User Stories');
    session.stories.forEach(story => lines.push(`- ${story}`));
    lines.push('');
  }

  // Priorities
  if (session.priorities) {
    lines.push('## Priorities');
    if (session.priorities.riceScore) {
      lines.push(`- RICE Score: ${session.priorities.riceScore}`);
    }
    if (session.priorities.wsjfScore) {
      lines.push(`- WSJF Score: ${session.priorities.wsjfScore}`);
    }
    if (session.priorities.releaseSlice) {
      lines.push(`- Release Slice: ${session.priorities.releaseSlice}`);
    }
    lines.push('');
  }

  // Contracts
  if (session.contracts && session.contracts.length > 0) {
    lines.push('## Contracts');
    session.contracts.forEach(contract => {
      lines.push(`- ${contract.type}: ${contract.name} (${contract.status})`);
      if (contract.path) {
        lines.push(`  Path: ${contract.path}`);
      }
    });
    lines.push('');
  }

  // ADRs
  if (session.adrs && session.adrs.length > 0) {
    lines.push('## Architectural Decision Records');
    session.adrs.forEach(adr => {
      lines.push(`- ${adr.id}: ${adr.title || 'N/A'}`);
      if (adr.path) {
        lines.push(`  Path: ${adr.path}`);
      }
    });
    lines.push('');
  }

  // Progress
  lines.push('## Progress');
  lines.push(`Current Stage: ${session.progress.currentStage}`);
  if (session.progress.completedStages.length > 0) {
    lines.push('');
    lines.push('Completed Stages:');
    session.progress.completedStages.forEach(stage => lines.push(`- ${stage}`));
  }
  if (Object.keys(session.progress.outputs).length > 0) {
    lines.push('');
    lines.push('Stage Outputs:');
    Object.entries(session.progress.outputs).forEach(([stage, outputs]) => {
      lines.push(`- ${stage}:`);
      outputs.forEach(output => lines.push(`  - ${output}`));
    });
  }
  lines.push('');

  // Decisions
  if (session.decisions.length > 0) {
    lines.push('## Key Decisions');
    session.decisions.forEach(decision => {
      lines.push(`- [${decision.timestamp}] ${decision.decision}`);
      lines.push(`  Rationale: ${decision.rationale}`);
    });
    lines.push('');
  }

  // Files Created
  if (session.files.length > 0) {
    lines.push('## Files Created');
    session.files.forEach(file => lines.push(`- ${file}`));
    lines.push('');
  }

  // Exit Criteria
  if (session.exitCriteria.length > 0) {
    lines.push('## Exit Criteria');
    session.exitCriteria.forEach(criterion => {
      const checked = session.status === 'completed' ? 'x' : ' ';
      lines.push(`- [${checked}] ${criterion}`);
    });
    lines.push('');
  }

  return lines.join('\n');
}

// Parse context.md back to session data
function parseContextMarkdown(content: string): SessionContext | null {
  const lines = content.split('\n');
  
  // Extract header info
  const sessionIdMatch = content.match(/Session ID: (.+)/);
  const createdMatch = content.match(/Created: (.+)/);
  const statusMatch = content.match(/Status: (in_progress|completed|blocked)/);
  const featureMatch = content.match(/# Task Context: (.+)/);

  if (!sessionIdMatch || !createdMatch || !statusMatch || !featureMatch) {
    return null;
  }

  const session: SessionContext = {
    sessionId: sessionIdMatch[1],
    feature: featureMatch[1],
    created: createdMatch[1],
    status: statusMatch[1] as 'in_progress' | 'completed' | 'blocked',
    request: '',
    contextFiles: [],
    referenceFiles: [],
    progress: {
      currentStage: '',
      completedStages: [],
      outputs: {}
    },
    decisions: [],
    files: [],
    exitCriteria: []
  };

  // Parse sections
  let currentSection = '';
  let requestLines: string[] = [];
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    if (line.startsWith('## ')) {
      currentSection = line.substring(3);
      continue;
    }

    switch (currentSection) {
      case 'Current Request':
        if (line.trim()) {
          requestLines.push(line);
        }
        break;
      case 'Context Files to Load':
        if (line.startsWith('- ')) {
          session.contextFiles.push(line.substring(2));
        }
        break;
      case 'Reference Files':
        if (line.startsWith('- ')) {
          session.referenceFiles.push(line.substring(2));
        }
        break;
      case 'Exit Criteria':
        if (line.startsWith('- [')) {
          const criterion = line.substring(6); // Remove "- [ ] " or "- [x] "
          session.exitCriteria.push(criterion);
        }
        break;
      case 'Files Created':
        if (line.startsWith('- ')) {
          session.files.push(line.substring(2));
        }
        break;
      case 'Progress':
        if (line.startsWith('Current Stage: ')) {
          session.progress.currentStage = line.substring(15);
        }
        break;
    }
  }

  session.request = requestLines.join('\n');
  return session;
}

/**
 * Create a new session with initial context
 */
export function createSession(
  feature: string,
  request: string,
  options: {
    contextFiles?: string[];
    referenceFiles?: string[];
    exitCriteria?: string[];
    architecture?: {
      boundedContext?: string;
      module?: string;
      verticalSlice?: string;
    };
    stories?: string[];
    priorities?: {
      riceScore?: number;
      wsjfScore?: number;
      releaseSlice?: string;
    };
    contracts?: Array<{
      type: string;
      name: string;
      path?: string;
      status: string;
    }>;
    adrs?: Array<{
      id: string;
      path?: string;
      title?: string;
    }>;
  } = {}
): { success: boolean; sessionId?: string; error?: string } {
  try {
    ensureSessionsDir();

    // Generate session ID from feature and timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const sessionId = `${feature}-${timestamp}`;
    const sessionDir = getSessionDir(sessionId);

    // Create session directory
    if (fs.existsSync(sessionDir)) {
      return { success: false, error: `Session ${sessionId} already exists` };
    }
    fs.mkdirSync(sessionDir, { recursive: true });

    // Create initial session context
    const session: SessionContext = {
      sessionId,
      feature,
      created: new Date().toISOString(),
      status: 'in_progress',
      request,
      contextFiles: options.contextFiles || [],
      referenceFiles: options.referenceFiles || [],
      architecture: options.architecture,
      stories: options.stories,
      priorities: options.priorities,
      contracts: options.contracts,
      adrs: options.adrs,
      progress: {
        currentStage: 'Stage 0: Context Loading',
        completedStages: [],
        outputs: {}
      },
      decisions: [],
      files: [],
      exitCriteria: options.exitCriteria || []
    };

    // Write context.md
    const contextPath = getContextPath(sessionId);
    const markdown = generateContextMarkdown(session);
    fs.writeFileSync(contextPath, markdown, 'utf-8');

    return { success: true, sessionId };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

/**
 * Load session context from context.md
 */
export function loadSession(sessionId: string): { success: boolean; session?: SessionContext; error?: string } {
  try {
    const contextPath = getContextPath(sessionId);
    
    if (!fs.existsSync(contextPath)) {
      return { success: false, error: `Session ${sessionId} not found` };
    }

    const content = fs.readFileSync(contextPath, 'utf-8');
    const session = parseContextMarkdown(content);

    if (!session) {
      return { success: false, error: `Failed to parse context.md for session ${sessionId}` };
    }

    return { success: true, session };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

/**
 * Update session context with new information
 */
export function updateSession(
  sessionId: string,
  updates: SessionUpdate
): { success: boolean; error?: string } {
  try {
    const loadResult = loadSession(sessionId);
    if (!loadResult.success || !loadResult.session) {
      return { success: false, error: loadResult.error };
    }

    const session = loadResult.session;

    // Apply updates
    if (updates.status) {
      session.status = updates.status;
    }
    if (updates.contextFiles) {
      session.contextFiles = [...new Set([...session.contextFiles, ...updates.contextFiles])];
    }
    if (updates.referenceFiles) {
      session.referenceFiles = [...new Set([...session.referenceFiles, ...updates.referenceFiles])];
    }
    if (updates.architecture) {
      session.architecture = { ...session.architecture, ...updates.architecture };
    }
    if (updates.stories) {
      session.stories = [...new Set([...(session.stories || []), ...updates.stories])];
    }
    if (updates.priorities) {
      session.priorities = { ...session.priorities, ...updates.priorities };
    }
    if (updates.contracts) {
      session.contracts = [...(session.contracts || []), ...updates.contracts];
    }
    if (updates.adrs) {
      session.adrs = [...(session.adrs || []), ...updates.adrs];
    }

    // Write updated context.md
    const contextPath = getContextPath(sessionId);
    const markdown = generateContextMarkdown(session);
    fs.writeFileSync(contextPath, markdown, 'utf-8');

    return { success: true };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

/**
 * Mark a stage as complete and record outputs
 */
export function markStageComplete(
  sessionId: string,
  stage: string,
  outputs: string[]
): { success: boolean; error?: string } {
  try {
    const loadResult = loadSession(sessionId);
    if (!loadResult.success || !loadResult.session) {
      return { success: false, error: loadResult.error };
    }

    const session = loadResult.session;

    // Add to completed stages if not already there
    if (!session.progress.completedStages.includes(stage)) {
      session.progress.completedStages.push(stage);
    }

    // Record outputs
    session.progress.outputs[stage] = outputs;

    // Write updated context.md
    const contextPath = getContextPath(sessionId);
    const markdown = generateContextMarkdown(session);
    fs.writeFileSync(contextPath, markdown, 'utf-8');

    return { success: true };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

/**
 * Add a decision to the session context
 */
export function addDecision(
  sessionId: string,
  decision: Decision
): { success: boolean; error?: string } {
  try {
    const loadResult = loadSession(sessionId);
    if (!loadResult.success || !loadResult.session) {
      return { success: false, error: loadResult.error };
    }

    const session = loadResult.session;

    // Add decision with timestamp
    session.decisions.push({
      timestamp: new Date().toISOString(),
      decision: decision.decision,
      rationale: decision.rationale
    });

    // Write updated context.md
    const contextPath = getContextPath(sessionId);
    const markdown = generateContextMarkdown(session);
    fs.writeFileSync(contextPath, markdown, 'utf-8');

    return { success: true };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

/**
 * Add a file to the session's created files list
 */
export function addFile(
  sessionId: string,
  filePath: string
): { success: boolean; error?: string } {
  try {
    const loadResult = loadSession(sessionId);
    if (!loadResult.success || !loadResult.session) {
      return { success: false, error: loadResult.error };
    }

    const session = loadResult.session;

    // Add file if not already tracked
    if (!session.files.includes(filePath)) {
      session.files.push(filePath);
    }

    // Write updated context.md
    const contextPath = getContextPath(sessionId);
    const markdown = generateContextMarkdown(session);
    fs.writeFileSync(contextPath, markdown, 'utf-8');

    return { success: true };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

/**
 * Get a summary of the current session state
 */
export function getSessionSummary(sessionId: string): { 
  success: boolean; 
  summary?: {
    sessionId: string;
    feature: string;
    status: string;
    currentStage: string;
    completedStages: number;
    totalDecisions: number;
    filesCreated: number;
    exitCriteriaMet: number;
    exitCriteriaTotal: number;
  }; 
  error?: string;
} {
  try {
    const loadResult = loadSession(sessionId);
    if (!loadResult.success || !loadResult.session) {
      return { success: false, error: loadResult.error };
    }

    const session = loadResult.session;

    return {
      success: true,
      summary: {
        sessionId: session.sessionId,
        feature: session.feature,
        status: session.status,
        currentStage: session.progress.currentStage,
        completedStages: session.progress.completedStages.length,
        totalDecisions: session.decisions.length,
        filesCreated: session.files.length,
        exitCriteriaMet: session.status === 'completed' ? session.exitCriteria.length : 0,
        exitCriteriaTotal: session.exitCriteria.length
      }
    };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

// CLI interface
if (require.main === module) {
  const args = process.argv.slice(2);
  const command = args[0];

  switch (command) {
    case 'create': {
      const feature = args[1];
      const request = args[2];
      if (!feature || !request) {
        console.error('Usage: session-context-manager.ts create <feature> <request>');
        process.exit(1);
      }
      const result = createSession(feature, request);
      if (result.success) {
        console.log(`✅ Session created: ${result.sessionId}`);
        console.log(`   Location: .tmp/sessions/${result.sessionId}/context.md`);
      } else {
        console.error(`❌ Error: ${result.error}`);
        process.exit(1);
      }
      break;
    }

    case 'load': {
      const sessionId = args[1];
      if (!sessionId) {
        console.error('Usage: session-context-manager.ts load <sessionId>');
        process.exit(1);
      }
      const result = loadSession(sessionId);
      if (result.success && result.session) {
        console.log(JSON.stringify(result.session, null, 2));
      } else {
        console.error(`❌ Error: ${result.error}`);
        process.exit(1);
      }
      break;
    }

    case 'summary': {
      const sessionId = args[1];
      if (!sessionId) {
        console.error('Usage: session-context-manager.ts summary <sessionId>');
        process.exit(1);
      }
      const result = getSessionSummary(sessionId);
      if (result.success && result.summary) {
        console.log('Session Summary:');
        console.log(`  Feature: ${result.summary.feature}`);
        console.log(`  Status: ${result.summary.status}`);
        console.log(`  Current Stage: ${result.summary.currentStage}`);
        console.log(`  Completed Stages: ${result.summary.completedStages}`);
        console.log(`  Decisions Made: ${result.summary.totalDecisions}`);
        console.log(`  Files Created: ${result.summary.filesCreated}`);
        console.log(`  Exit Criteria: ${result.summary.exitCriteriaMet}/${result.summary.exitCriteriaTotal}`);
      } else {
        console.error(`❌ Error: ${result.error}`);
        process.exit(1);
      }
      break;
    }

    default:
      console.log('Session Context Manager');
      console.log('');
      console.log('Commands:');
      console.log('  create <feature> <request>  - Create new session');
      console.log('  load <sessionId>            - Load session context');
      console.log('  summary <sessionId>         - Show session summary');
      console.log('');
      console.log('Programmatic usage:');
      console.log('  import { createSession, loadSession, updateSession } from "./session-context-manager"');
      break;
  }
}
