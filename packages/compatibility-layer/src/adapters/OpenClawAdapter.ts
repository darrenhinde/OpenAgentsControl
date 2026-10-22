import { BaseAdapter } from "./BaseAdapter.js";
import type {
  OpenAgent,
  ConversionResult,
  ToolCapabilities,
  ToolConfig,
} from "../types.js";
import { createPermissionIndex } from "../mappers/PermissionMapper.js";

/**
 * OpenClaw adapter for converting between OpenAgents Control and OpenClaw formats.
 *
 * OpenClaw is the Gateway agent platform. Unlike Claude/Cursor/Windsurf,
 * OpenClaw supports FULL granular permissions via the before_tool_call hook,
 * so this adapter performs NO permission degradation.
 *
 * Conversion outputs (fromOAC, one config fragment per agent):
 * - `.openclaw/agents/{agentId}.json`        — agents.list entry (primary) or subagent config (subagent)
 * - `.openclaw/bootstrap-manifest-{agentId}.json` — primary agent body (6-stage workflow guidance) for agent:bootstrap injection.
 *     Per-agent file names prevent same-directory primaries from overwriting
 *     each other (the plugin routes by agentId and falls back to the legacy
 *     single `.openclaw/bootstrap-manifest.json`).
 * - `.openclaw/skills-index.json`            — skills reference list (SKILL.md compatible)
 * - `.openclaw/permission-index-{agentId}.json` — per-agent granular permission fragment (no degradation).
 *     The install pipeline aggregates these fragments into the single merged
 *     `.openclaw/permission-index.json` consumed by the plugin loader.
 *
 * @see https://github.com/darrenhinde/OpenAgentsControl
 */
export class OpenClawAdapter extends BaseAdapter {
  readonly name = "openclaw";
  readonly displayName = "OpenClaw";

  constructor() {
    super();
  }

  // ============================================================================
  // CONVERSION METHODS
  // ============================================================================

  /**
   * Convert OpenClaw format TO OpenAgents Control format.
   *
   * Phase 1 is fromOAC only (OAC → OpenClaw). Reverse conversion is planned
   * for Phase 2.
   *
   * @throws {Error} Always — not implemented in phase 1
   */
  toOAC(_source: string): Promise<OpenAgent> {
    return Promise.reject(
      new Error("toOAC not implemented in phase 1 (fromOAC only)")
    );
  }

  /**
   * Convert FROM OpenAgents Control format to OpenClaw format.
   *
   * Generates per-agent config fragments (see class docs). No permission
   * degradation — the full granular table is preserved for hook enforcement.
   *
   * @param agent - OpenAgent to convert
   * @returns ConversionResult with generated files and warnings
   */
  fromOAC(agent: OpenAgent): Promise<ConversionResult> {
    const warnings: string[] = [];
    const configs: ToolConfig[] = [];

    // Validate conversion
    warnings.push(...this.validateConversion(agent));

    // Build the OpenClaw agent config object
    const agentConfig = this.buildOpenClawAgentConfig(agent);

    // Output per-agent config fragment (agents.list entry / subagent config)
    const agentId = agent.metadata.id || this.slugify(agent.frontmatter.name);
    configs.push({
      fileName: `.openclaw/agents/${agentId}.json`,
      content: JSON.stringify(agentConfig, null, 2),
      encoding: "utf-8",
    });

    // Channel 2: bootstrap manifest (primary agent body → agent:bootstrap injection)
    // Per-agent file name (same pattern as permission-index-{agentId}.json) so
    // multiple primaries under the same directory never overwrite each other.
    const isPrimary = agent.frontmatter.mode !== "subagent";
    if (isPrimary && agent.systemPrompt && agent.systemPrompt.trim().length > 0) {
      configs.push({
        fileName: `.openclaw/bootstrap-manifest-${agentId}.json`,
        content: JSON.stringify(
          {
            agentId,
            source: agent.frontmatter.name,
            guidance: agent.systemPrompt,
            note: "Injected via agent:bootstrap hook (OAC 6-stage workflow guidance)",
          },
          null,
          2
        ),
        encoding: "utf-8",
      });
    }

    // Channel 3: skills index (SKILL.md compatible — direct reference, no copy)
    if (agent.frontmatter.skills && agent.frontmatter.skills.length > 0) {
      configs.push({
        fileName: ".openclaw/skills-index.json",
        content: JSON.stringify(
          {
            agentId,
            skills: agent.frontmatter.skills.map((skill) =>
              typeof skill === "string" ? skill : skill.name
            ),
          },
          null,
          2
        ),
        encoding: "utf-8",
      });
    }

    // Permission fragment — one file per agent so multiple agents with
    // permission tables never overwrite each other. This is a per-agent
    // fragment (v1 PermissionIndex shape); the install pipeline merges all
    // fragments into the single `.openclaw/permission-index.json` that the
    // plugin's permission-loader consumes.
    if (agent.frontmatter.permission) {
      const index = createPermissionIndex(agentId, agent.frontmatter.permission);
      configs.push({
        fileName: `.openclaw/permission-index-${agentId}.json`,
        content: JSON.stringify(index, null, 2),
        encoding: "utf-8",
      });
    }

    return Promise.resolve(this.createSuccessResult(configs, warnings));
  }

  /**
   * Get the configuration path for OpenClaw artifacts.
   */
  getConfigPath(): string {
    return ".openclaw/";
  }

  /**
   * Get OpenClaw capabilities.
   */
  getCapabilities(): ToolCapabilities {
    return {
      name: this.name,
      displayName: this.displayName,
      supportsMultipleAgents: true,
      supportsSkills: true,
      supportsHooks: true,
      supportsGranularPermissions: true, // ★ Only adapter with full granular support
      supportsContexts: true,
      supportsCustomModels: true,
      supportsTemperature: true,
      supportsMaxSteps: false, // Not mapped in phase 1
      configFormat: "json",
      outputStructure: "directory",
      notes: [
        "Granular permissions fully supported via before_tool_call hook (no degradation)",
        "temperature maps to agents.list[].params.temperature",
        "Contexts injected via agent:bootstrap hook",
        "Skills are SKILL.md compatible (AgentSkills spec)",
        "toOAC (reverse) deferred to phase 2",
      ],
    };
  }

  /**
   * Validate if an agent can be converted with full fidelity.
   */
  validateConversion(agent: OpenAgent): string[] {
    const warnings: string[] = [];

    if (!agent.frontmatter.name) {
      warnings.push("⚠️  Agent name is required for OpenClaw");
    }

    if (!agent.frontmatter.description) {
      warnings.push("⚠️  Agent description is required for OpenClaw");
    }

    if (agent.frontmatter.maxSteps !== undefined) {
      warnings.push(
        this.unsupportedFeatureWarning("maxSteps", agent.frontmatter.maxSteps)
      );
    }

    // No granular permission warnings — OpenClaw supports full granular permissions.
    return warnings;
  }

  // ============================================================================
  // GENERATION HELPERS (fromOAC)
  // ============================================================================

  /**
   * Build the OpenClaw agent config object.
   */
  private buildOpenClawAgentConfig(
    agent: OpenAgent
  ): Record<string, unknown> {
    // NOTE: mode routing (agents.list vs subagents) is NOT expressed via an
    // `entryType` field — OpenClaw's config schema rejects unknown fields
    // (additionalProperties: false). Routing is expressed by fileName in
    // fromOAC() (`frontmatter.mode !== "subagent"` decides whether the
    // bootstrap-manifest channel is emitted) plus the OpenClaw-side
    // agents.list/subagents structure.

    const config: Record<string, unknown> = {
      id: agent.metadata.id || this.slugify(agent.frontmatter.name),
      name: agent.frontmatter.name,
    };

    // Model mapping (provider/model reference — preserved as-is by default)
    if (agent.frontmatter.model) {
      config.model = agent.frontmatter.model;
    }

    // Temperature → params.temperature
    if (agent.frontmatter.temperature !== undefined) {
      config.params = { temperature: agent.frontmatter.temperature };
    }

    // Skills → agents.list[].skills
    if (agent.frontmatter.skills && agent.frontmatter.skills.length > 0) {
      config.skills = agent.frontmatter.skills.map((skill) =>
        typeof skill === "string" ? skill : skill.name
      );
    }

    // description → bootstrap note (OpenClaw has no agents.list[].description)
    if (agent.frontmatter.description) {
      config.description = agent.frontmatter.description;
    }

    return config;
  }

  /**
   * Slugify a name into a kebab-case identifier.
   */
  private slugify(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  }
}
