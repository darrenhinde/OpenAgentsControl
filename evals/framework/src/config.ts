/**
 * Framework configuration
 * 
 * Default configuration for the evaluation framework.
 * Can be overridden by passing custom config to components.
 */

import { FrameworkConfig } from './types';
import * as path from 'path';
import * as os from 'os';
import * as crypto from 'crypto';
import * as fs from 'fs';

/**
 * Find the git root directory by walking up from a given path
 * 
 * OpenCode agents typically run from the git root directory.
 * Sessions are stored based on the git root, not subdirectories.
 * 
 * @param startPath - Path to start searching from (defaults to cwd)
 * @returns Git root path or the start path if no git root found
 */
export const findGitRoot = (startPath: string = process.cwd()): string => {
  let currentPath = path.resolve(startPath);
  
  // Walk up the directory tree looking for .git
  while (currentPath !== path.dirname(currentPath)) {
    const gitPath = path.join(currentPath, '.git');
    
    if (fs.existsSync(gitPath)) {
      return currentPath;
    }
    
    currentPath = path.dirname(currentPath);
  }
  
  // No git root found, return the start path
  return startPath;
};

/**
 * Get default session storage path
 * OpenCode stores sessions in ~/.local/share/opencode/
 */
const getDefaultSessionStoragePath = (): string => {
  const homeDir = os.homedir();
  return path.join(homeDir, '.local', 'share', 'opencode');
};

/**
 * Default framework configuration
 * 
 * IMPORTANT: Uses git root as projectPath, not process.cwd()
 * 
 * Why? When testing agents like OpenAgent, the agent runs from the git root,
 * but tests run from /evals/framework. Sessions are created in the git root's
 * context, so we need to look there for session storage.
 * 
 * Example:
 * - Git root: /Users/user/opencode-agents
 * - Test CWD: /Users/user/opencode-agents/evals/framework
 * - Sessions stored under git root hash, not test framework hash
 */
export const defaultConfig: FrameworkConfig = {
  projectPath: findGitRoot(process.cwd()), // Use git root, not cwd
  sessionStoragePath: getDefaultSessionStoragePath(),
  resultsPath: path.join(process.cwd(), 'evals', 'results'),
  passThreshold: 75,
};

/**
 * Create custom configuration by merging with defaults
 */
export const createConfig = (overrides: Partial<FrameworkConfig> = {}): FrameworkConfig => {
  return {
    ...defaultConfig,
    ...overrides,
  };
};

/**
 * Encode project path for OpenCode storage (legacy format)
 * OpenCode replaces slashes with dashes in project paths
 * Example: /Users/user/project -> Users-user-project
 * 
 * NOTE: This is the LEGACY format used by older OpenCode versions.
 * The SDK now uses a hash-based format instead.
 */
export const encodeProjectPath = (projectPath: string): string => {
  // Remove leading slash and replace remaining slashes with dashes
  return projectPath.replace(/^\//, '').replace(/\//g, '-');
};

/**
 * Calculate project hash (SHA-1) used by OpenCode SDK
 * The SDK stores sessions using a hash of the project path instead of the encoded path.
 * This matches the projectID field in session JSON files.
 * 
 * NOTE: The exact hashing algorithm used by OpenCode is not documented.
 * This function attempts to calculate it, but may not match in all cases.
 * The SessionReader falls back to scanning all session directories if needed.
 * 
 * Example: /Users/user/project -> 9b95828208165943d702402641ce831a3cda362e
 */
export const getProjectHash = (projectPath: string): string => {
  // OpenCode uses SHA-1 hash of the absolute project path
  // However, the exact implementation may vary (e.g., trailing slashes, normalization)
  return crypto.createHash('sha1').update(projectPath).digest('hex');
};

/**
 * Get session storage path for a specific project (SDK format)
 * 
 * The OpenCode SDK uses a FLAT structure with project hash:
 * ~/.local/share/opencode/storage/session/{projectHash}/
 * 
 * This is different from the legacy nested structure:
 * ~/.local/share/opencode/project/{encoded-path}/storage/session/
 * 
 * @param projectPath - Absolute path to the project
 * @param sessionStoragePath - Base storage path (defaults to ~/.local/share/opencode)
 * @returns Path to session storage directory
 */
export const getProjectSessionPath = (
  projectPath: string,
  sessionStoragePath: string = getDefaultSessionStoragePath()
): string => {
  // Use SDK's hash-based flat structure
  const projectHash = getProjectHash(projectPath);
  return path.join(sessionStoragePath, 'storage', 'session', projectHash);
};

/**
 * Get legacy session storage path for a specific project
 * 
 * This is the OLD format used before the SDK migration.
 * We keep this for backward compatibility when reading old sessions.
 * 
 * @param projectPath - Absolute path to the project
 * @param sessionStoragePath - Base storage path
 * @returns Path to legacy session storage directory
 */
export const getLegacyProjectSessionPath = (
  projectPath: string,
  sessionStoragePath: string = getDefaultSessionStoragePath()
): string => {
  const encodedPath = encodeProjectPath(projectPath);
  return path.join(sessionStoragePath, 'project', encodedPath, 'storage', 'session');
};

/**
 * Get session info path (SDK format)
 * 
 * SDK stores session info files directly in the project hash directory:
 * ~/.local/share/opencode/storage/session/{projectHash}/{sessionId}.json
 * 
 * NOT in a nested info/ subdirectory like the legacy format.
 */
export const getSessionInfoPath = (
  projectPath: string,
  sessionStoragePath?: string
): string => {
  // SDK uses flat structure - session files are directly in the project hash directory
  return getProjectSessionPath(projectPath, sessionStoragePath);
};

/**
 * Get legacy session info path (for backward compatibility)
 * 
 * Legacy format uses nested structure:
 * ~/.local/share/opencode/project/{encoded-path}/storage/session/info/
 */
export const getLegacySessionInfoPath = (
  projectPath: string,
  sessionStoragePath?: string
): string => {
  return path.join(getLegacyProjectSessionPath(projectPath, sessionStoragePath), 'info');
};

/**
 * Get session message path (SDK format)
 * 
 * NOTE: The SDK currently stores sessions as single JSON files.
 * Message/part subdirectories may not exist for SDK-created sessions.
 * This path is kept for compatibility with legacy sessions.
 */
export const getSessionMessagePath = (
  projectPath: string,
  sessionStoragePath?: string
): string => {
  return path.join(getProjectSessionPath(projectPath, sessionStoragePath), 'message');
};

/**
 * Get legacy session message path
 */
export const getLegacySessionMessagePath = (
  projectPath: string,
  sessionStoragePath?: string
): string => {
  return path.join(getLegacyProjectSessionPath(projectPath, sessionStoragePath), 'message');
};

/**
 * Get session part path (SDK format)
 * 
 * NOTE: The SDK currently stores sessions as single JSON files.
 * Message/part subdirectories may not exist for SDK-created sessions.
 * This path is kept for compatibility with legacy sessions.
 */
export const getSessionPartPath = (
  projectPath: string,
  sessionStoragePath?: string
): string => {
  return path.join(getProjectSessionPath(projectPath, sessionStoragePath), 'part');
};

/**
 * Get legacy session part path
 */
export const getLegacySessionPartPath = (
  projectPath: string,
  sessionStoragePath?: string
): string => {
  return path.join(getLegacyProjectSessionPath(projectPath, sessionStoragePath), 'part');
};

/**
 * Resolve agent path to support both old and new formats
 * 
 * Supports:
 * - Old format: "openagent" → ".opencode/agent/openagent.md"
 * - New format: "core/openagent" → ".opencode/agent/core/openagent.md"
 * - Subagents: "subagents/code/tester" → ".opencode/agent/subagents/code/tester.md"
 * 
 * @param agent - Agent identifier (e.g., "openagent" or "core/openagent")
 * @param projectPath - Project root path (defaults to git root)
 * @returns Absolute path to agent file
 */
export const resolveAgentPath = (agent: string, projectPath?: string): string => {
  const root = projectPath || findGitRoot(process.cwd());
  const agentDir = path.join(root, '.opencode', 'agent');
  
  // If agent contains a slash, it's a category-based path
  if (agent.includes('/')) {
    return path.join(agentDir, `${agent}.md`);
  }
  
  // Old format - flat structure
  return path.join(agentDir, `${agent}.md`);
};

/**
 * Normalize agent identifier to category-based format
 * 
 * Maps old agent names to new category-based paths:
 * - "openagent" → "core/openagent"
 * - "opencoder" → "core/opencoder"
 * - "system-builder" → "meta/system-builder"
 * 
 * Already category-based paths are returned as-is:
 * - "core/openagent" → "core/openagent"
 * - "development/frontend-specialist" → "development/frontend-specialist"
 * 
 * @param agent - Agent identifier
 * @returns Normalized agent identifier
 */
export const normalizeAgentId = (agent: string): string => {
  // Already category-based
  if (agent.includes('/')) {
    return agent;
  }
  
  // Map old core agents to new paths
  const coreAgents: Record<string, string> = {
    'openagent': 'core/openagent',
    'OpenAgent': 'core/openagent',
    'opencoder': 'core/opencoder',
    'OpenCoder': 'core/opencoder',
    'system-builder': 'meta/system-builder',
    'OpenSystemBuilder': 'meta/system-builder',
    'codebase-agent': 'development/codebase-agent',
    'OpenCodebaseAgent': 'development/codebase-agent',
    'devops-specialist': 'development/devops-specialist',
    'OpenDevopsSpecialist': 'development/devops-specialist',
    'frontend-specialist': 'development/frontend-specialist',
    'OpenFrontendSpecialist': 'development/frontend-specialist',
    'backend-specialist': 'development/backend-specialist',
    'OpenBackendSpecialist': 'development/backend-specialist',
    'technical-writer': 'content/technical-writer',
    'OpenTechnicalWriter': 'content/technical-writer',
    'copywriter': 'content/copywriter',
    'OpenCopywriter': 'content/copywriter',
    'data-analyst': 'data/data-analyst',
    'OpenDataAnalyst': 'data/data-analyst',
    'repo-manager': 'meta/repo-manager',
    'OpenRepoManager': 'meta/repo-manager',
  };
  
  return coreAgents[agent] || agent;
};

/**
 * Extract category from agent identifier
 * 
 * Examples:
 * - "core/openagent" → "core"
 * - "development/frontend-specialist" → "development"
 * - "subagents/code/tester" → "subagents/code"
 * - "openagent" → undefined (flat structure)
 * 
 * @param agent - Agent identifier
 * @returns Category path or undefined
 */
export const extractAgentCategory = (agent: string): string | undefined => {
  if (!agent.includes('/')) {
    return undefined;
  }
  
  const parts = agent.split('/');
  
  // For subagents, include both levels (e.g., "subagents/code")
  if (parts[0] === 'subagents' && parts.length >= 2) {
    return `${parts[0]}/${parts[1]}`;
  }
  
  // For regular categories, just the first part
  return parts[0];
};
