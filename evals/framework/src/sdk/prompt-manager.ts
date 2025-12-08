/**
 * PromptManager - Handles prompt variant switching for tests
 * 
 * Responsibilities:
 * - Read prompt metadata (YAML frontmatter)
 * - Switch prompts (copy variant → agent location)
 * - Restore default after tests
 * - Extract recommended models from metadata
 */

import { readFileSync, writeFileSync, copyFileSync, existsSync, readdirSync, unlinkSync } from 'fs';
import { join } from 'path';

/**
 * Prompt metadata from YAML frontmatter
 */
export interface PromptMetadata {
  /** Model family (e.g., 'claude', 'gpt', 'gemini', 'grok', 'llama') */
  model_family?: string;
  /** Recommended models for this prompt */
  recommended_models?: string[];
  /** Model this prompt was tested with */
  tested_with?: string;
  /** Last test date */
  last_tested?: string;
  /** Prompt maintainer */
  maintainer?: string;
  /** Status: 'stable', 'experimental', 'needs-testing' */
  status?: string;
}

/**
 * Result of switching prompts
 */
export interface SwitchResult {
  /** Whether the switch was successful */
  success: boolean;
  /** Path to the variant prompt file */
  variantPath: string;
  /** Path to the agent prompt file */
  agentPath: string;
  /** Extracted metadata */
  metadata: PromptMetadata;
  /** Primary recommended model (first in list) */
  recommendedModel?: string;
  /** Error message if failed */
  error?: string;
}

/**
 * PromptManager handles prompt variant switching
 */
export class PromptManager {
  private readonly promptsDir: string;
  private readonly agentDir: string;
  private backupPath: string | null = null;
  private currentAgent: string | null = null;
  
  /**
   * Create a PromptManager
   * @param projectRoot Root directory of the project (contains .opencode/)
   */
  constructor(projectRoot: string) {
    this.promptsDir = join(projectRoot, '.opencode', 'prompts');
    this.agentDir = join(projectRoot, '.opencode', 'agent');
  }
  
  /**
   * Get the prompts directory path
   */
  getPromptsDir(): string {
    return this.promptsDir;
  }
  
  /**
   * Check if a prompt variant exists
   */
  variantExists(agent: string, variant: string): boolean {
    const variantPath = join(this.promptsDir, agent, `${variant}.md`);
    return existsSync(variantPath);
  }
  
  /**
   * List available variants for an agent
   */
  listVariants(agent: string): string[] {
    const agentPromptsDir = join(this.promptsDir, agent);
    if (!existsSync(agentPromptsDir)) {
      return [];
    }
    
    const files = readdirSync(agentPromptsDir) as string[];
    
    return files
      .filter((f: string) => f.endsWith('.md') && !['TEMPLATE.md', 'README.md'].includes(f))
      .map((f: string) => f.replace('.md', ''));
  }
  
  /**
   * Read metadata from a prompt file
   */
  readMetadata(agent: string, variant: string): PromptMetadata {
    const variantPath = join(this.promptsDir, agent, `${variant}.md`);
    
    if (!existsSync(variantPath)) {
      return {};
    }
    
    const content = readFileSync(variantPath, 'utf8');
    return this.parseYamlFrontmatter(content);
  }
  
  /**
   * Get the recommended model for a variant
   * Returns the first model in recommended_models array
   */
  getRecommendedModel(agent: string, variant: string): string | undefined {
    const metadata = this.readMetadata(agent, variant);
    
    if (metadata.recommended_models && metadata.recommended_models.length > 0) {
      return metadata.recommended_models[0];
    }
    
    return undefined;
  }
  
  /**
   * Switch to a prompt variant
   * 
   * 1. Backs up current agent prompt
   * 2. Copies variant to agent location
   * 3. Returns metadata for the variant
   */
  switchToVariant(agent: string, variant: string): SwitchResult {
    const variantPath = join(this.promptsDir, agent, `${variant}.md`);
    const agentPath = join(this.agentDir, `${agent}.md`);
    
    // Check variant exists
    if (!existsSync(variantPath)) {
      return {
        success: false,
        variantPath,
        agentPath,
        metadata: {},
        error: `Variant not found: ${variantPath}`,
      };
    }
    
    try {
      // Backup current agent prompt
      if (existsSync(agentPath)) {
        this.backupPath = join(this.agentDir, `.${agent}.md.backup`);
        copyFileSync(agentPath, this.backupPath);
        this.currentAgent = agent;
      }
      
      // Copy variant to agent location
      copyFileSync(variantPath, agentPath);
      
      // Read metadata
      const metadata = this.readMetadata(agent, variant);
      const recommendedModel = metadata.recommended_models?.[0];
      
      return {
        success: true,
        variantPath,
        agentPath,
        metadata,
        recommendedModel,
      };
    } catch (error) {
      return {
        success: false,
        variantPath,
        agentPath,
        metadata: {},
        error: `Failed to switch: ${(error as Error).message}`,
      };
    }
  }
  
  /**
   * Restore the default prompt for an agent
   * 
   * Copies default.md to agent location (or restores backup if no default)
   */
  restoreDefault(agent: string): boolean {
    const defaultPath = join(this.promptsDir, agent, 'default.md');
    const agentPath = join(this.agentDir, `${agent}.md`);
    
    try {
      if (existsSync(defaultPath)) {
        // Restore from default.md
        copyFileSync(defaultPath, agentPath);
      } else if (this.backupPath && existsSync(this.backupPath) && this.currentAgent === agent) {
        // Restore from backup
        copyFileSync(this.backupPath, agentPath);
      }
      
      // Clean up backup
      if (this.backupPath && existsSync(this.backupPath)) {
        unlinkSync(this.backupPath);
        this.backupPath = null;
        this.currentAgent = null;
      }
      
      return true;
    } catch (error) {
      console.error(`Failed to restore default: ${(error as Error).message}`);
      return false;
    }
  }
  
  /**
   * Parse YAML frontmatter from markdown content
   */
  private parseYamlFrontmatter(content: string): PromptMetadata {
    const metadata: PromptMetadata = {};
    
    // Check for YAML frontmatter (between --- markers)
    const match = content.match(/^---\n([\s\S]*?)\n---/);
    if (!match) {
      return metadata;
    }
    
    const yaml = match[1];
    const lines = yaml.split('\n');
    
    let inRecommendedModels = false;
    const recommendedModels: string[] = [];
    
    for (const line of lines) {
      // Check for recommended_models array
      if (line.startsWith('recommended_models:')) {
        inRecommendedModels = true;
        continue;
      }
      
      // Parse array items
      if (inRecommendedModels && line.match(/^\s+-\s+/)) {
        const model = line
          .replace(/^\s+-\s+/, '')
          .replace(/["']/g, '')
          .replace(/#.*$/, '')
          .trim();
        if (model) {
          recommendedModels.push(model);
        }
        continue;
      }
      
      // End of array
      if (inRecommendedModels && !line.match(/^\s+-/) && line.trim()) {
        inRecommendedModels = false;
      }
      
      // Parse simple key-value pairs
      const kvMatch = line.match(/^(\w+):\s*(.*)$/);
      if (kvMatch) {
        const [, key, value] = kvMatch;
        const cleanValue = value.replace(/["']/g, '').trim();
        
        switch (key) {
          case 'model_family':
            metadata.model_family = cleanValue;
            break;
          case 'tested_with':
            metadata.tested_with = cleanValue === 'null' ? undefined : cleanValue;
            break;
          case 'last_tested':
            metadata.last_tested = cleanValue === 'null' ? undefined : cleanValue;
            break;
          case 'maintainer':
            metadata.maintainer = cleanValue;
            break;
          case 'status':
            metadata.status = cleanValue;
            break;
        }
      }
    }
    
    if (recommendedModels.length > 0) {
      metadata.recommended_models = recommendedModels;
    }
    
    return metadata;
  }
}
