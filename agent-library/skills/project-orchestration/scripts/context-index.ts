#!/usr/bin/env npx ts-node
/**
 * Lightweight Context Index
 *
 * Solves context fragmentation WITHOUT passing massive context to subagents.
 * Orchestrator maintains a lightweight index (just paths and metadata).
 * Each subagent gets ONLY the specific files they need for their job.
 *
 * Key Principle:
 * - Orchestrator: "Here's the ONE file you need: .tmp/architecture/auth-system/contexts.json"
 * - NOT: "Here's the entire session context with everything from all previous agents"
 *
 * Usage:
 *   import { createContextIndex, addAgentOutput, getContextForAgent, getFullContext } from './context-index';
 *
 * Location: .tmp/context-index/{feature}.json
 */

import * as fs from 'fs';
import * as path from 'path';

// Find project root
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
const INDEX_DIR = path.join(PROJECT_ROOT, '.tmp', 'context-index');

// Types
interface AgentMetadata {
  [key: string]: any;
}

interface AgentOutput {
  outputs: string[];
  metadata: AgentMetadata;
  timestamp: string;
}

interface ContextIndex {
  feature: string;
  created: string;
  updated: string;
  agents: Record<string, AgentOutput>;
  contextFiles: string[];
  referenceFiles: string[];
}

interface AgentContext {
  feature: string;
  agentType: string;
  contextFiles: string[];
  referenceFiles: string[];
  agentOutputs: string[];
  metadata: AgentMetadata;
}

// Ensure index directory exists
function ensureIndexDir(): void {
  if (!fs.existsSync(INDEX_DIR)) {
    fs.mkdirSync(INDEX_DIR, { recursive: true });
  }
}

// Get index file path
function getIndexPath(feature: string): string {
  return path.join(INDEX_DIR, `${feature}.json`);
}

/**
 * Create a new context index for a feature
 * 
 * @param feature - Feature identifier (kebab-case)
 * @param options - Initial context files and reference files
 * @returns Success status and error if any
 */
export function createContextIndex(
  feature: string,
  options: {
    contextFiles?: string[];
    referenceFiles?: string[];
  } = {}
): { success: boolean; error?: string } {
  try {
    ensureIndexDir();

    const indexPath = getIndexPath(feature);
    
    // Don't overwrite existing index
    if (fs.existsSync(indexPath)) {
      return { success: false, error: `Context index for ${feature} already exists` };
    }

    const index: ContextIndex = {
      feature,
      created: new Date().toISOString(),
      updated: new Date().toISOString(),
      agents: {},
      contextFiles: options.contextFiles || [],
      referenceFiles: options.referenceFiles || []
    };

    fs.writeFileSync(indexPath, JSON.stringify(index, null, 2), 'utf-8');

    return { success: true };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

/**
 * Load context index for a feature
 * 
 * @param feature - Feature identifier
 * @returns Success status with index data or error
 */
export function loadContextIndex(feature: string): { 
  success: boolean; 
  index?: ContextIndex; 
  error?: string;
} {
  try {
    const indexPath = getIndexPath(feature);
    
    if (!fs.existsSync(indexPath)) {
      return { success: false, error: `Context index for ${feature} not found` };
    }

    const content = fs.readFileSync(indexPath, 'utf-8');
    const index: ContextIndex = JSON.parse(content);

    return { success: true, index };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

/**
 * Add agent output to the context index
 * 
 * @param feature - Feature identifier
 * @param agent - Agent type (e.g., "ArchitectureAnalyzer", "StoryMapper")
 * @param outputPath - Path to agent's output file
 * @param metadata - Agent-specific metadata (e.g., boundedContext, verticalSlice)
 * @returns Success status and error if any
 */
export function addAgentOutput(
  feature: string,
  agent: string,
  outputPath: string,
  metadata: AgentMetadata = {}
): { success: boolean; error?: string } {
  try {
    const loadResult = loadContextIndex(feature);
    if (!loadResult.success || !loadResult.index) {
      return { success: false, error: loadResult.error };
    }

    const index = loadResult.index;

    // Initialize agent entry if doesn't exist
    if (!index.agents[agent]) {
      index.agents[agent] = {
        outputs: [],
        metadata: {},
        timestamp: new Date().toISOString()
      };
    }

    // Add output path if not already tracked
    if (!index.agents[agent].outputs.includes(outputPath)) {
      index.agents[agent].outputs.push(outputPath);
    }

    // Merge metadata
    index.agents[agent].metadata = {
      ...index.agents[agent].metadata,
      ...metadata
    };

    // Update timestamp
    index.agents[agent].timestamp = new Date().toISOString();
    index.updated = new Date().toISOString();

    // Save updated index
    const indexPath = getIndexPath(feature);
    fs.writeFileSync(indexPath, JSON.stringify(index, null, 2), 'utf-8');

    return { success: true };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

/**
 * Get minimal context for a specific agent type
 * Returns ONLY the files needed for that agent's job
 * 
 * @param feature - Feature identifier
 * @param agentType - Agent type requesting context
 * @returns Agent-specific context with minimal file list
 */
export function getContextForAgent(
  feature: string,
  agentType: string
): {
  success: boolean;
  context?: AgentContext;
  error?: string;
} {
  try {
    const loadResult = loadContextIndex(feature);
    if (!loadResult.success || !loadResult.index) {
      return { success: false, error: loadResult.error };
    }

    const index = loadResult.index;

    // Agent-specific context rules
    const agentContext: AgentContext = {
      feature,
      agentType,
      contextFiles: [],
      referenceFiles: [],
      agentOutputs: [],
      metadata: {}
    };

    switch (agentType) {
      case 'ArchitectureAnalyzer':
        // Needs: architecture patterns, reference files
        agentContext.contextFiles = index.contextFiles.filter(f => 
          f.includes('architecture') || f.includes('patterns')
        );
        agentContext.referenceFiles = index.referenceFiles;
        break;

      case 'StoryMapper':
        // Needs: ArchitectureAnalyzer output + story mapping context
        agentContext.contextFiles = index.contextFiles.filter(f =>
          f.includes('story') || f.includes('user')
        );
        if (index.agents['ArchitectureAnalyzer']) {
          agentContext.agentOutputs = index.agents['ArchitectureAnalyzer'].outputs;
          agentContext.metadata = index.agents['ArchitectureAnalyzer'].metadata;
        }
        break;

      case 'PrioritizationEngine':
        // Needs: StoryMapper output + prioritization context
        agentContext.contextFiles = index.contextFiles.filter(f =>
          f.includes('prioritization') || f.includes('scoring')
        );
        if (index.agents['StoryMapper']) {
          agentContext.agentOutputs = index.agents['StoryMapper'].outputs;
          agentContext.metadata = index.agents['StoryMapper'].metadata;
        }
        break;

      case 'ContractManager':
        // Needs: ArchitectureAnalyzer output + contract patterns
        agentContext.contextFiles = index.contextFiles.filter(f =>
          f.includes('contract') || f.includes('api')
        );
        if (index.agents['ArchitectureAnalyzer']) {
          agentContext.agentOutputs = index.agents['ArchitectureAnalyzer'].outputs;
          agentContext.metadata = index.agents['ArchitectureAnalyzer'].metadata;
        }
        break;

      case 'ADRManager':
        // Needs: ArchitectureAnalyzer output + ADR templates
        agentContext.contextFiles = index.contextFiles.filter(f =>
          f.includes('adr') || f.includes('decision')
        );
        if (index.agents['ArchitectureAnalyzer']) {
          agentContext.agentOutputs = index.agents['ArchitectureAnalyzer'].outputs;
          agentContext.metadata = index.agents['ArchitectureAnalyzer'].metadata;
        }
        break;

      case 'TaskManager':
        // Needs: ALL previous agent outputs + task management context
        agentContext.contextFiles = index.contextFiles.filter(f =>
          f.includes('task') || f.includes('standards')
        );
        // Collect outputs from all agents
        Object.keys(index.agents).forEach(agent => {
          agentContext.agentOutputs.push(...index.agents[agent].outputs);
          agentContext.metadata[agent] = index.agents[agent].metadata;
        });
        break;

      case 'CoderAgent':
        // Needs: TaskManager output (subtask JSON) + coding standards
        agentContext.contextFiles = index.contextFiles.filter(f =>
          f.includes('standards') || f.includes('code-quality') || f.includes('security')
        );
        if (index.agents['TaskManager']) {
          agentContext.agentOutputs = index.agents['TaskManager'].outputs;
        }
        break;

      default:
        // Unknown agent: give minimal context
        agentContext.contextFiles = index.contextFiles;
        break;
    }

    return { success: true, context: agentContext };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

/**
 * Get full context index (for orchestrator only)
 * 
 * @param feature - Feature identifier
 * @returns Complete context index with all agent outputs
 */
export function getFullContext(feature: string): {
  success: boolean;
  index?: ContextIndex;
  error?: string;
} {
  return loadContextIndex(feature);
}

/**
 * Add context files to the index
 * 
 * @param feature - Feature identifier
 * @param contextFiles - Array of context file paths to add
 * @returns Success status and error if any
 */
export function addContextFiles(
  feature: string,
  contextFiles: string[]
): { success: boolean; error?: string } {
  try {
    const loadResult = loadContextIndex(feature);
    if (!loadResult.success || !loadResult.index) {
      return { success: false, error: loadResult.error };
    }

    const index = loadResult.index;

    // Add new context files (deduplicate)
    index.contextFiles = [...new Set([...index.contextFiles, ...contextFiles])];
    index.updated = new Date().toISOString();

    // Save updated index
    const indexPath = getIndexPath(feature);
    fs.writeFileSync(indexPath, JSON.stringify(index, null, 2), 'utf-8');

    return { success: true };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

/**
 * Add reference files to the index
 * 
 * @param feature - Feature identifier
 * @param referenceFiles - Array of reference file paths to add
 * @returns Success status and error if any
 */
export function addReferenceFiles(
  feature: string,
  referenceFiles: string[]
): { success: boolean; error?: string } {
  try {
    const loadResult = loadContextIndex(feature);
    if (!loadResult.success || !loadResult.index) {
      return { success: false, error: loadResult.error };
    }

    const index = loadResult.index;

    // Add new reference files (deduplicate)
    index.referenceFiles = [...new Set([...index.referenceFiles, ...referenceFiles])];
    index.updated = new Date().toISOString();

    // Save updated index
    const indexPath = getIndexPath(feature);
    fs.writeFileSync(indexPath, JSON.stringify(index, null, 2), 'utf-8');

    return { success: true };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

// CLI interface
if (require.main === module) {
  const args: string[] = process.argv.slice(2);
  const command: string = args[0];

  switch (command) {
    case 'create': {
      const feature = args[1];
      if (!feature) {
        console.error('Usage: context-index.ts create <feature>');
        process.exit(1);
      }
      const result = createContextIndex(feature);
      if (result.success) {
        console.log(`✅ Context index created for: ${feature}`);
        console.log(`   Location: .tmp/context-index/${feature}.json`);
      } else {
        console.error(`❌ Error: ${result.error}`);
        process.exit(1);
      }
      break;
    }

    case 'add-output': {
      const feature = args[1];
      const agent = args[2];
      const outputPath = args[3];
      const metadataJson = args[4];
      
      if (!feature || !agent || !outputPath) {
        console.error('Usage: context-index.ts add-output <feature> <agent> <outputPath> [metadata-json]');
        process.exit(1);
      }

      const metadata = metadataJson ? JSON.parse(metadataJson) : {};
      const result = addAgentOutput(feature, agent, outputPath, metadata);
      
      if (result.success) {
        console.log(`✅ Added ${agent} output: ${outputPath}`);
      } else {
        console.error(`❌ Error: ${result.error}`);
        process.exit(1);
      }
      break;
    }

    case 'get-context': {
      const feature = args[1];
      const agentType = args[2];
      
      if (!feature || !agentType) {
        console.error('Usage: context-index.ts get-context <feature> <agentType>');
        process.exit(1);
      }

      const result = getContextForAgent(feature, agentType);
      
      if (result.success && result.context) {
        console.log(JSON.stringify(result.context, null, 2));
      } else {
        console.error(`❌ Error: ${result.error}`);
        process.exit(1);
      }
      break;
    }

    case 'show': {
      const feature = args[1];
      
      if (!feature) {
        console.error('Usage: context-index.ts show <feature>');
        process.exit(1);
      }

      const result = getFullContext(feature);
      
      if (result.success && result.index) {
        console.log(JSON.stringify(result.index, null, 2));
      } else {
        console.error(`❌ Error: ${result.error}`);
        process.exit(1);
      }
      break;
    }

    default:
      console.log('Lightweight Context Index');
      console.log('');
      console.log('Commands:');
      console.log('  create <feature>                              - Create new context index');
      console.log('  add-output <feature> <agent> <path> [meta]    - Add agent output');
      console.log('  get-context <feature> <agentType>             - Get minimal context for agent');
      console.log('  show <feature>                                - Show full context index');
      console.log('');
      console.log('Programmatic usage:');
      console.log('  import { createContextIndex, addAgentOutput, getContextForAgent } from "./context-index"');
      break;
  }
}
