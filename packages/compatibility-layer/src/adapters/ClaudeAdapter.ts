import { BaseAdapter } from "./BaseAdapter.js";
import type {
  OpenAgent,
  ConversionResult,
  ToolCapabilities,
  ToolConfig,
  AgentFrontmatter,
  SkillReference,
  HookDefinition,
  HookEvent,
} from "../types.js";

/**
 * Claude Code adapter for converting between OpenAgents Control and Claude Code formats.
 * 
 * Claude Code uses:
 * - `.claude/config.json` for main agent configuration
 * - `.claude/agents/*.md` for subagents (YAML frontmatter + markdown)
 * - `.claude/skills/` for Skills (context/knowledge injection)
 * 
 * @see https://code.claude.com/docs/en/sub-agents
 * @see https://code.claude.com/docs/en/skills
 */
export class ClaudeAdapter extends BaseAdapter {
  readonly name = "claude";
  readonly displayName = "Claude Code";

  constructor() {
    super();
  }

  // ============================================================================
  // CONVERSION METHODS
  // ============================================================================

  /**
   * Convert Claude Code format TO OpenAgents Control format.
   * 
   * Expects either:
   * - A JSON string (config.json content)
   * - A markdown string with YAML frontmatter (agent.md content)
   * 
   * @param source - Claude config.json or agent.md content
   * @returns OpenAgent object
   */
  toOAC(source: string): Promise<OpenAgent> {
    // Try parsing as JSON first (config.json)
    if (source.trim().startsWith("{")) {
      return Promise.resolve(this.parseClaudeConfig(source));
    }

    // Otherwise, parse as markdown with frontmatter (agent.md)
    return Promise.resolve(this.parseClaudeAgent(source));
  }

  /**
   * Convert FROM OpenAgents Control format to Claude Code format.
   * 
   * Generates:
   * - `.claude/config.json` for primary agents
   * - `.claude/agents/{name}.md` for subagents
   * - Skills conversion (contexts → skills)
   * 
   * @param agent - OpenAgent to convert
   * @returns ConversionResult with generated files and warnings
   */
  fromOAC(agent: OpenAgent): Promise<ConversionResult> {
    const warnings: string[] = [];
    const configs: ToolConfig[] = [];

    // Validate conversion
    const validationWarnings = this.validateConversion(agent);
    warnings.push(...validationWarnings);

    // Check for unsupported features
    if (agent.frontmatter.temperature !== undefined) {
      warnings.push(
        this.unsupportedFeatureWarning("temperature", agent.frontmatter.temperature)
      );
    }

    if (agent.frontmatter.maxSteps !== undefined) {
      warnings.push(
        this.unsupportedFeatureWarning("maxSteps", agent.frontmatter.maxSteps)
      );
    }

    // Determine if this is a subagent or primary agent
    const isSubagent = agent.frontmatter.mode === "subagent";

    if (isSubagent) {
      // Generate subagent markdown file
      const agentMd = this.generateClaudeAgentMarkdown(agent, warnings);
      configs.push({
        fileName: `.claude/agents/${agent.frontmatter.name}.md`,
        content: agentMd,
        encoding: "utf-8",
      });
    } else {
      // Generate primary agent config.json
      const configJson = this.generateClaudeConfig(agent, warnings);
      configs.push({
        fileName: ".claude/config.json",
        content: JSON.stringify(configJson, null, 2),
        encoding: "utf-8",
      });
    }

    // Generate skills from contexts if present
    if (agent.contexts && agent.contexts.length > 0) {
      const skillConfigs = this.generateSkillsFromContexts(agent.contexts);
      configs.push(...skillConfigs);
    }

    return Promise.resolve(this.createSuccessResult(configs, warnings));
  }

  /**
   * Get the configuration path for Claude Code.
   */
  getConfigPath(): string {
    return ".claude/";
  }

  /**
   * Get Claude Code capabilities.
   */
  getCapabilities(): ToolCapabilities {
    return {
      name: this.name,
      displayName: this.displayName,
      supportsMultipleAgents: true,
      supportsSkills: true,
      supportsHooks: true,
      supportsGranularPermissions: false, // Only binary/simplified permissions
      supportsContexts: true,
      supportsCustomModels: true,
      supportsTemperature: false, // ⚠️ Not supported
      supportsMaxSteps: false,
      configFormat: "markdown",
      outputStructure: "directory",
      notes: [
        "Permissions are binary (on/off) - granular OAC permissions degrade to permissionMode",
        "Temperature control not supported - use creativity settings instead",
        "Hooks support: PreToolUse, PostToolUse, PermissionRequest, AgentStart, AgentEnd",
        "Skills system provides context injection similar to OAC contexts",
      ],
    };
  }

  /**
   * Validate if an agent can be converted with full fidelity.
   */
  validateConversion(agent: OpenAgent): string[] {
    const warnings: string[] = [];

    if (!agent.frontmatter.name) {
      warnings.push("⚠️  Agent name is required for Claude Code");
    }

    if (!agent.frontmatter.description) {
      warnings.push("⚠️  Agent description is required for Claude Code");
    }

    // Check for granular permissions that will be degraded
    if (agent.frontmatter.permission) {
      const hasGranularPerms = Object.values(agent.frontmatter.permission).some(
        (perm) => typeof perm === "object" && !Array.isArray(perm)
      );

      if (hasGranularPerms) {
        warnings.push(
          this.degradedFeatureWarning(
            "granular permissions",
            "allow/deny/ask per operation",
            "binary permissionMode (default/acceptEdits/dontAsk/bypassPermissions)"
          )
        );
      }
    }

    return warnings;
  }

  // ============================================================================
  // PARSING HELPERS (toOAC)
  // ============================================================================

  /**
   * Parse Claude config.json to OpenAgent.
   */
  private parseClaudeConfig(source: string): OpenAgent {
    const config = this.safeParseJSON(source, "config.json");
    if (!config || typeof config !== "object") {
      throw new Error("Invalid Claude config.json format");
    }

    const claudeConfig = config as Record<string, unknown>;

    const frontmatter: AgentFrontmatter = {
      name: String(claudeConfig.name || "unnamed"),
      description: String(claudeConfig.description || ""),
      mode: "primary",
      model: this.mapClaudeModelToOAC(claudeConfig.model as string),
      tools: this.parseClaudeTools(claudeConfig.tools),
      skills: this.parseClaudeSkills(claudeConfig.skills),
      hooks: this.parseClaudeHooks(claudeConfig.hooks),
    };

    return {
      frontmatter,
      metadata: {
        name: frontmatter.name,
        category: "core",
        type: "agent",
      },
      systemPrompt: String(claudeConfig.systemPrompt || ""),
      contexts: [],
    };
  }

  /**
   * Parse Claude agent.md (subagent) to OpenAgent.
   */
  private parseClaudeAgent(source: string): OpenAgent {
    const { frontmatter, body } = this.parseFrontmatter(source);

    const agentFrontmatter: AgentFrontmatter = {
      name: String(frontmatter.name || "unnamed"),
      description: String(frontmatter.description || ""),
      mode: "subagent",
      model: this.mapClaudeModelToOAC(frontmatter.model as string | undefined),
      tools: this.parseClaudeTools(frontmatter.tools),
      skills: this.parseClaudeSkills(frontmatter.skills),
      hooks: this.parseClaudeHooks(frontmatter.hooks),
    };

    return {
      frontmatter: agentFrontmatter,
      metadata: {
        name: agentFrontmatter.name,
        category: "specialist",
        type: "subagent",
      },
      systemPrompt: body.trim(),
      contexts: [],
    };
  }

  /**
   * Parse YAML frontmatter from markdown.
   */
  private parseFrontmatter(content: string): {
    frontmatter: Record<string, unknown>;
    body: string;
  } {
    const match = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
    if (!match) {
      return { frontmatter: {}, body: content };
    }

    const yamlContent = match[1] || "";
    const body = match[2] || "";

    // Simple YAML parser (supports basic key: value format)
    const frontmatter: Record<string, unknown> = {};
    yamlContent.split("\n").forEach((line) => {
      const colonIndex = line.indexOf(":");
      if (colonIndex > -1) {
        const key = line.slice(0, colonIndex).trim();
        let value: unknown = line.slice(colonIndex + 1).trim();

        // Parse arrays: [item1, item2]
        if (typeof value === "string" && value.startsWith("[") && value.endsWith("]")) {
          value = value
            .slice(1, -1)
            .split(",")
            .map((v) => v.trim().replace(/"/g, ""));
        } else if (typeof value === "string") {
          // Strip surrounding quotes from scalar values (matches
          // CursorAdapter.parseFrontmatter, and undoes the quoting that
          // generateClaudeAgentMarkdown adds, e.g. name: "...").
          value = value.replace(/^["']|["']$/g, "");
        }

        frontmatter[key] = value;
      }
    });

    return { frontmatter, body };
  }

  // ============================================================================
  // GENERATION HELPERS (fromOAC)
  // ============================================================================

  /**
   * Generate Claude config.json from OpenAgent.
   */
  private generateClaudeConfig(
    agent: OpenAgent,
    warnings: string[]
  ): Record<string, unknown> {
    const config: Record<string, unknown> = {
      name: agent.frontmatter.name,
      description: agent.frontmatter.description,
      systemPrompt: agent.systemPrompt,
    };

    // Model mapping
    if (agent.frontmatter.model) {
      config.model = this.mapOACModelToClaude(agent.frontmatter.model);
    }

    // Tools mapping
    if (agent.frontmatter.tools) {
      config.tools = this.mapOACToolsToClaude(agent.frontmatter.tools);
    }

    // Skills mapping
    if (agent.frontmatter.skills && agent.frontmatter.skills.length > 0) {
      config.skills = agent.frontmatter.skills.map((skill) =>
        typeof skill === "string" ? skill : skill.name
      );
    }

    // Hooks mapping
    if (agent.frontmatter.hooks && agent.frontmatter.hooks.length > 0) {
      config.hooks = this.mapOACHooksToClaude(agent.frontmatter.hooks);
    }

    // Permission mode mapping
    if (agent.frontmatter.permission) {
      config.permissionMode = this.mapOACPermissionsToClaude(
        agent.frontmatter.permission,
        warnings
      );
    }

    return config;
  }

  /**
   * Generate Claude agent.md (subagent) from OpenAgent.
   */
  private generateClaudeAgentMarkdown(
    agent: OpenAgent,
    warnings: string[]
  ): string {
    const frontmatter: Record<string, unknown> = {
      name: agent.frontmatter.name,
      description: agent.frontmatter.description,
    };

    // Tools
    if (agent.frontmatter.tools) {
      const tools = this.mapOACToolsToClaude(agent.frontmatter.tools);
      frontmatter.tools = tools.join(", ");
    }

    // Model
    if (agent.frontmatter.model) {
      frontmatter.model = this.mapOACModelToClaude(agent.frontmatter.model);
    }

    // Permission mode
    if (agent.frontmatter.permission) {
      frontmatter.permissionMode = this.mapOACPermissionsToClaude(
        agent.frontmatter.permission,
        warnings
      );
    }

    // Skills
    if (agent.frontmatter.skills && agent.frontmatter.skills.length > 0) {
      frontmatter.skills = agent.frontmatter.skills.map((skill) =>
        typeof skill === "string" ? skill : skill.name
      );
    }

    // Hooks
    if (agent.frontmatter.hooks && agent.frontmatter.hooks.length > 0) {
      frontmatter.hooks = this.mapOACHooksToClaude(agent.frontmatter.hooks);
    }

    // Generate YAML frontmatter
    const yamlLines = Object.entries(frontmatter).map(([key, value]) => {
      if (Array.isArray(value)) {
        return `${key}: [${value.map((v) => `"${v}"`).join(", ")}]`;
      }
      return `${key}: "${String(value)}"`;
    });

    return `---\n${yamlLines.join("\n")}\n---\n\n${agent.systemPrompt}`;
  }

  /**
   * Generate Skills from OAC contexts.
   */
  private generateSkillsFromContexts(
    contexts: Array<{ path: string; priority?: string; description?: string }>
  ): ToolConfig[] {
    return contexts.map((ctx) => {
      const skillName = ctx.path
        .split("/")
        .pop()
        ?.replace(/\.md$/, "")
        .toLowerCase()
        .replace(/\s+/g, "-") || "context-skill";

      const skillContent = `---
name: ${skillName}
description: ${ctx.description || `Context from ${ctx.path}`}
---

# ${skillName}

This skill provides context from: \`${ctx.path}\`

Priority: ${ctx.priority || "medium"}

Load the full context file for detailed information:
\`\`\`bash
cat ${ctx.path}
\`\`\`
`;

      return {
        fileName: `.claude/skills/${skillName}/SKILL.md`,
        content: skillContent,
        encoding: "utf-8" as const,
      };
    });
  }

  // ============================================================================
  // MAPPING HELPERS
  // ============================================================================

  /**
   * Map Claude model ID to OAC model ID.
   */
  private mapClaudeModelToOAC(model?: string): string | undefined {
    if (!model) return undefined;

    const modelMap: Record<string, string> = {
      "claude-sonnet-4-20250514": "claude-sonnet-4",
      "claude-opus-4": "claude-opus-4",
      "claude-haiku-4": "claude-haiku-4",
      sonnet: "claude-sonnet-4",
      opus: "claude-opus-4",
      haiku: "claude-haiku-4",
    };

    return modelMap[model] || model;
  }

  /**
   * Map OAC model ID to Claude model ID.
   */
  private mapOACModelToClaude(model: string): string {
    const modelMap: Record<string, string> = {
      "claude-sonnet-4": "claude-sonnet-4-20250514",
      "claude-opus-4": "claude-opus-4",
      "claude-haiku-4": "claude-haiku-4",
    };

    return modelMap[model] || "sonnet"; // Default to sonnet alias
  }

  /**
   * Parse Claude tools to OAC ToolAccess.
   */
  private parseClaudeTools(tools: unknown): Record<string, boolean> | undefined {
    if (!tools) return undefined;

    const toolAccess: Record<string, boolean> = {};

    if (typeof tools === "string") {
      // Parse comma-separated string: "Read, Write, Bash"
      tools.split(",").forEach((tool) => {
        const toolName = tool.trim().toLowerCase();
        toolAccess[toolName] = true;
      });
    } else if (Array.isArray(tools)) {
      // Parse array: ["Read", "Write", "Bash"]
      tools.forEach((tool) => {
        const toolName = String(tool).toLowerCase();
        toolAccess[toolName] = true;
      });
    }

    return Object.keys(toolAccess).length > 0 ? toolAccess : undefined;
  }

  /**
   * Map OAC ToolAccess to Claude tools array.
   */
  private mapOACToolsToClaude(tools: Record<string, boolean>): string[] {
    return Object.entries(tools)
      .filter(([, enabled]) => enabled)
      .map(([tool]) => {
        // Capitalize first letter for Claude format
        return tool.charAt(0).toUpperCase() + tool.slice(1);
      });
  }

  /**
   * Parse Claude skills to OAC SkillReference array.
   */
  private parseClaudeSkills(skills: unknown): SkillReference[] | undefined {
    if (!skills) return undefined;

    if (typeof skills === "string") {
      return skills.split(",").map((s) => s.trim());
    }

    if (Array.isArray(skills)) {
      return skills.map((s) => String(s));
    }

    return undefined;
  }

  /**
   * Parse Claude hooks to OAC HookDefinition array.
   */
  private parseClaudeHooks(hooks: unknown): HookDefinition[] | undefined {
    if (!hooks || typeof hooks !== "object") return undefined;

    const hookDefinitions: HookDefinition[] = [];
    const hooksObj = hooks as Record<string, unknown>;

    // Claude hooks format: { PreToolUse: [...], PostToolUse: [...] }
    for (const [event, hookList] of Object.entries(hooksObj)) {
      if (!Array.isArray(hookList)) continue;

      hookList.forEach((hook) => {
        if (typeof hook === "object" && hook !== null) {
          const hookObj = hook as Record<string, unknown>;
          hookDefinitions.push({
            event: event as HookEvent,
            matchers: hookObj.matcher
              ? [String(hookObj.matcher)]
              : undefined,
            commands: hookObj.hooks
              ? (hookObj.hooks as Array<{ type: "command"; command: string }>)
              : [],
          });
        }
      });
    }

    return hookDefinitions.length > 0 ? hookDefinitions : undefined;
  }

  /**
   * Map OAC hooks to Claude hooks format.
   */
  private mapOACHooksToClaude(
    hooks: HookDefinition[]
  ): Record<string, unknown[]> {
    const claudeHooks: Record<string, unknown[]> = {};

    hooks.forEach((hook) => {
      const event = hook.event;
      if (!claudeHooks[event]) {
        claudeHooks[event] = [];
      }

      claudeHooks[event].push({
        matcher: hook.matchers?.[0] || "*",
        hooks: hook.commands,
      });
    });

    return claudeHooks;
  }

  /**
   * Map OAC granular permissions to Claude permissionMode.
   */
  private mapOACPermissionsToClaude(
    permissions: Record<string, unknown>,
    warnings: string[]
  ): string {
    // Analyze permission patterns to determine best permissionMode
    const values = Object.values(permissions);
    const hasAllAllow = values.every((v) => v === "allow" || v === true);
    const hasAllDeny = values.every((v) => v === "deny" || v === false);
    const hasAsk = values.some((v) => v === "ask");

    if (hasAllAllow) {
      return "bypassPermissions"; // Full access
    } else if (hasAllDeny) {
      return "dontAsk"; // Auto-deny
    } else if (hasAsk) {
      return "default"; // Prompt for permission
    } else {
      // Mixed or granular permissions - default to standard mode
      warnings.push(
        "⚠️  Complex permission rules degraded to 'default' permissionMode. " +
          "Claude Code does not support granular allow/deny/ask per operation."
      );
      return "default";
    }
  }
}
