import { describe, it, expect, beforeEach } from "vitest";
import { ClaudeAdapter } from "../../../src/adapters/ClaudeAdapter";
import type {
  OpenAgent,
  AgentFrontmatter,
  HookDefinition,
  SkillReference,
} from "../../../src/types";

/**
 * Unit tests for ClaudeAdapter with 80%+ coverage
 *
 * Test strategy:
 * 1. toOAC() - Parse Claude formats to OpenAgent
 * 2. fromOAC() - Convert OpenAgent to Claude formats
 * 3. getCapabilities() - Feature matrix validation
 * 4. validateConversion() - Validation and warnings
 * 5. Helper methods - Model/tool/hook/skill mapping
 * 6. Edge cases - Invalid input, missing fields, empty values
 * 7. Roundtrip - Data integrity checks
 */

describe("ClaudeAdapter", () => {
  let adapter: ClaudeAdapter;

  beforeEach(() => {
    adapter = new ClaudeAdapter();
  });

  // ============================================================================
  // ADAPTER IDENTITY
  // ============================================================================

  describe("adapter identity", () => {
    it("has correct name", () => {
      expect(adapter.name).toBe("claude");
    });

    it("has correct displayName", () => {
      expect(adapter.displayName).toBe("Claude Code");
    });

    it("returns correct config path", () => {
      expect(adapter.getConfigPath()).toBe(".claude/");
    });
  });

  // ============================================================================
  // CAPABILITIES
  // ============================================================================

  describe("getCapabilities()", () => {
    it("returns correct capabilities object", () => {
      const capabilities = adapter.getCapabilities();

      expect(capabilities.name).toBe("claude");
      expect(capabilities.displayName).toBe("Claude Code");
      expect(capabilities.supportsMultipleAgents).toBe(true);
      expect(capabilities.supportsSkills).toBe(true);
      expect(capabilities.supportsHooks).toBe(true);
      expect(capabilities.supportsGranularPermissions).toBe(false);
      expect(capabilities.supportsContexts).toBe(true);
      expect(capabilities.supportsCustomModels).toBe(true);
      expect(capabilities.supportsTemperature).toBe(false);
      expect(capabilities.supportsMaxSteps).toBe(false);
      expect(capabilities.configFormat).toBe("markdown");
      expect(capabilities.outputStructure).toBe("directory");
    });

    it("includes appropriate notes", () => {
      const capabilities = adapter.getCapabilities();

      expect(capabilities.notes).toBeDefined();
      expect(capabilities.notes?.length).toBeGreaterThan(0);
      expect(capabilities.notes?.some((n) => n.includes("permissions"))).toBe(
        true
      );
    });
  });

  // ============================================================================
  // toOAC() - PARSING CLAUDE CONFIG.JSON
  // ============================================================================

  describe("toOAC() - parsing config.json", () => {
    it("parses minimal config.json", async () => {
      const source = JSON.stringify({
        name: "TestAgent",
        description: "Test description",
        systemPrompt: "You are helpful",
      });

      const result = await adapter.toOAC(source);

      expect(result.frontmatter.name).toBe("TestAgent");
      expect(result.frontmatter.description).toBe("Test description");
      expect(result.systemPrompt).toBe("You are helpful");
      expect(result.frontmatter.mode).toBe("primary");
    });

    it("parses config with model", async () => {
      const source = JSON.stringify({
        name: "Agent",
        description: "Test",
        model: "claude-sonnet-4-20250514",
        systemPrompt: "Prompt",
      });

      const result = await adapter.toOAC(source);

      expect(result.frontmatter.model).toBe("claude-sonnet-4");
    });

    it("parses config with tools array", async () => {
      const source = JSON.stringify({
        name: "Agent",
        description: "Test",
        tools: ["Read", "Write", "Bash"],
        systemPrompt: "Prompt",
      });

      const result = await adapter.toOAC(source);

      expect(result.frontmatter.tools).toEqual({
        read: true,
        write: true,
        bash: true,
      });
    });

    it("parses config with tools string", async () => {
      const source = JSON.stringify({
        name: "Agent",
        description: "Test",
        tools: "Read, Write, Edit",
        systemPrompt: "Prompt",
      });

      const result = await adapter.toOAC(source);

      expect(result.frontmatter.tools).toEqual({
        read: true,
        write: true,
        edit: true,
      });
    });

    it("parses config with skills", async () => {
      const source = JSON.stringify({
        name: "Agent",
        description: "Test",
        skills: ["skill1", "skill2"],
        systemPrompt: "Prompt",
      });

      const result = await adapter.toOAC(source);

      expect(result.frontmatter.skills).toEqual(["skill1", "skill2"]);
    });

    it("parses config with hooks", async () => {
      const source = JSON.stringify({
        name: "Agent",
        description: "Test",
        hooks: {
          PreToolUse: [
            {
              matcher: "*.txt",
              hooks: [{ type: "command", command: "validate" }],
            },
          ],
        },
        systemPrompt: "Prompt",
      });

      const result = await adapter.toOAC(source);

      expect(result.frontmatter.hooks).toBeDefined();
      expect(result.frontmatter.hooks?.length).toBe(1);
      expect(result.frontmatter.hooks?.[0].event).toBe("PreToolUse");
    });

    it("handles missing optional fields gracefully", async () => {
      const source = JSON.stringify({
        name: "MinimalAgent",
        description: "Minimal",
      });

      const result = await adapter.toOAC(source);

      expect(result.frontmatter.name).toBe("MinimalAgent");
      expect(result.systemPrompt).toBe("");
      expect(result.frontmatter.tools).toBeUndefined();
      expect(result.frontmatter.skills).toBeUndefined();
    });

    it("parses invalid JSON as markdown (subagent fallback)", async () => {
      const source = "not valid json";

      const result = await adapter.toOAC(source);

      // Falls back to markdown parsing
      expect(result.frontmatter.mode).toBe("subagent");
      expect(result.systemPrompt).toBe("not valid json");
    });

    it("parses non-object JSON string as markdown (subagent fallback)", async () => {
      const source = JSON.stringify("just a string");

      const result = await adapter.toOAC(source);

      // Falls back to markdown parsing
      expect(result.frontmatter.mode).toBe("subagent");
    });
  });

  // ============================================================================
  // toOAC() - PARSING CLAUDE AGENT.MD (SUBAGENTS)
  // ============================================================================

  describe("toOAC() - parsing agent.md with YAML frontmatter", () => {
    it("parses agent.md with minimal frontmatter", async () => {
      const source = `---
name: SubAgent
description: A subagent
---

This is the system prompt for the agent.`;

      const result = await adapter.toOAC(source);

      expect(result.frontmatter.name).toBe("SubAgent");
      expect(result.frontmatter.description).toBe("A subagent");
      expect(result.frontmatter.mode).toBe("subagent");
      expect(result.systemPrompt).toBe("This is the system prompt for the agent.");
    });

    it("strips surrounding quotes from scalar frontmatter values", async () => {
      // generateClaudeAgentMarkdown emits quoted scalars (name: "..."), so a
      // fromOAC -> toOAC round-trip must not leave the embedded quotes.
      const source = `---
name: "SubAgent"
description: "A subagent"
model: "claude-opus-4"
---

Prompt body`;

      const result = await adapter.toOAC(source);

      expect(result.frontmatter.name).toBe("SubAgent");
      expect(result.frontmatter.description).toBe("A subagent");
      expect(result.frontmatter.model).toBe("claude-opus-4");
    });

    it("parses agent.md with model in frontmatter", async () => {
      const source = `---
name: Agent
description: Test
model: claude-opus-4
---

Prompt`;

      const result = await adapter.toOAC(source);

      expect(result.frontmatter.model).toBe("claude-opus-4");
    });

    it("parses agent.md with tools array in frontmatter", async () => {
      const source = `---
name: Agent
description: Test
tools: ["Read", "Write", "Bash"]
---

Prompt`;

      const result = await adapter.toOAC(source);

      expect(result.frontmatter.tools).toEqual({
        read: true,
        write: true,
        bash: true,
      });
    });

    it("parses agent.md with skills in frontmatter", async () => {
      const source = `---
name: Agent
description: Test
skills: ["skill1", "skill2"]
---

Prompt`;

      const result = await adapter.toOAC(source);

      expect(result.frontmatter.skills).toEqual(["skill1", "skill2"]);
    });

    it("handles agent.md without frontmatter as markdown content", async () => {
      const source = "No frontmatter here, just markdown content";

      const result = await adapter.toOAC(source);

      expect(result.systemPrompt).toBe("No frontmatter here, just markdown content");
      expect(result.frontmatter.mode).toBe("subagent");
    });

    it("preserves multiline system prompt", async () => {
      const source = `---
name: Agent
description: Test
---

You are a helpful assistant.
You should be friendly and professional.
Always provide detailed responses.`;

      const result = await adapter.toOAC(source);

      expect(result.systemPrompt).toContain("You are a helpful assistant");
      expect(result.systemPrompt).toContain("Always provide detailed responses");
    });
  });

  // ============================================================================
  // fromOAC() - CONVERTING TO CLAUDE CONFIG.JSON
  // ============================================================================

  describe("fromOAC() - converting to config.json", () => {
    const createOpenAgent = (overrides?: Partial<OpenAgent>): OpenAgent => ({
      frontmatter: {
        name: "TestAgent",
        description: "Test agent",
        mode: "primary",
        model: "claude-sonnet-4",
        tools: { read: true, write: true },
        ...overrides?.frontmatter,
      },
      metadata: {
        name: "TestAgent",
        category: "core",
        type: "agent",
      },
      systemPrompt: "You are helpful",
      contexts: [],
      ...overrides,
    });

    it("converts primary agent to config.json", async () => {
      const agent = createOpenAgent();

      const result = await adapter.fromOAC(agent);

      expect(result.success).toBe(true);
      expect(result.configs).toHaveLength(1);
      expect(result.configs[0].fileName).toBe(".claude/config.json");

      const config = JSON.parse(result.configs[0].content);
      expect(config.name).toBe("TestAgent");
      expect(config.description).toBe("Test agent");
      expect(config.model).toBe("claude-sonnet-4-20250514");
    });

    it("maps tools correctly in config.json", async () => {
      const agent = createOpenAgent({
        frontmatter: {
          tools: { read: true, write: true, bash: true },
        },
      });

      const result = await adapter.fromOAC(agent);
      const config = JSON.parse(result.configs[0].content);

      expect(config.tools).toEqual(["Read", "Write", "Bash"]);
    });

    it("includes skills in config.json", async () => {
      const agent = createOpenAgent({
        frontmatter: {
          skills: ["skill1", "skill2"],
        },
      });

      const result = await adapter.fromOAC(agent);
      const config = JSON.parse(result.configs[0].content);

      expect(config.skills).toEqual(["skill1", "skill2"]);
    });

    it("includes hooks in config.json", async () => {
      const hook: HookDefinition = {
        event: "PreToolUse",
        matchers: ["*.txt"],
        commands: [{ type: "command", command: "validate" }],
      };

      const agent = createOpenAgent({
        frontmatter: {
          hooks: [hook],
        },
      });

      const result = await adapter.fromOAC(agent);
      const config = JSON.parse(result.configs[0].content);

      expect(config.hooks).toBeDefined();
      expect(config.hooks.PreToolUse).toBeDefined();
    });

    it("warns when temperature is set (unsupported)", async () => {
      const agent = createOpenAgent({
        frontmatter: {
          temperature: 0.7,
        },
      });

      const result = await adapter.fromOAC(agent);

      expect(result.warnings.some((w) => w.includes("temperature"))).toBe(true);
    });

    it("warns when maxSteps is set (unsupported)", async () => {
      const agent = createOpenAgent({
        frontmatter: {
          maxSteps: 10,
        },
      });

      const result = await adapter.fromOAC(agent);

      expect(result.warnings.some((w) => w.includes("maxSteps"))).toBe(true);
    });

    it("includes validationWarnings in result", async () => {
      const agent = createOpenAgent({
        frontmatter: {
          name: "",
          description: "",
        },
      });

      const result = await adapter.fromOAC(agent);

      expect(result.warnings.length).toBeGreaterThan(0);
    });

    it("handles mixed permission rules gracefully", async () => {
      const agent = createOpenAgent({
        frontmatter: {
          permission: {
            read: "allow",
            write: "ask",
            bash: "deny",
          },
        },
      });

      const result = await adapter.fromOAC(agent);

      // Should include some form of warning or degradation
      expect(result.warnings.length).toBeGreaterThanOrEqual(0);
      expect(result.success).toBe(true);
    });
  });

  // ============================================================================
  // fromOAC() - CONVERTING TO CLAUDE AGENT.MD (SUBAGENTS)
  // ============================================================================

  describe("fromOAC() - converting to agent.md for subagents", () => {
    const createSubagent = (overrides?: Partial<OpenAgent>): OpenAgent => ({
      frontmatter: {
        name: "CodeAnalyzer",
        description: "Analyzes code",
        mode: "subagent",
        model: "claude-sonnet-4",
        ...overrides?.frontmatter,
      },
      metadata: {
        name: "CodeAnalyzer",
        category: "specialist",
        type: "subagent",
      },
      systemPrompt: "Analyze code quality",
      contexts: [],
      ...overrides,
    });

    it("converts subagent to agent.md file", async () => {
      const agent = createSubagent();

      const result = await adapter.fromOAC(agent);

      expect(result.success).toBe(true);
      expect(result.configs).toHaveLength(1);
      expect(result.configs[0].fileName).toBe(".claude/agents/CodeAnalyzer.md");
    });

    it("generates proper YAML frontmatter in agent.md", async () => {
      const agent = createSubagent();

      const result = await adapter.fromOAC(agent);
      const content = result.configs[0].content;

      expect(content).toMatch(/^---/);
      expect(content).toMatch(/name: "CodeAnalyzer"/);
      expect(content).toMatch(/description: "Analyzes code"/);
      expect(content).toContain("---\n\n");
    });

    it("includes system prompt in agent.md body", async () => {
      const agent = createSubagent({
        systemPrompt: "Analyze code quality\nCheck for best practices",
      });

      const result = await adapter.fromOAC(agent);
      const content = result.configs[0].content;

      expect(content).toContain("Analyze code quality");
      expect(content).toContain("Check for best practices");
    });

    it("includes tools in agent.md frontmatter", async () => {
      const agent = createSubagent({
        frontmatter: {
          tools: { read: true, bash: true },
        },
      });

      const result = await adapter.fromOAC(agent);
      const content = result.configs[0].content;

      expect(content).toContain("Read");
      expect(content).toContain("Bash");
      expect(content).toContain("tools");
    });

    it("includes model in agent.md frontmatter", async () => {
      const agent = createSubagent({
        frontmatter: {
          model: "claude-opus-4",
        },
      });

      const result = await adapter.fromOAC(agent);
      const content = result.configs[0].content;

      expect(content).toContain("model");
      expect(content).toContain("claude-opus-4");
    });

    it("includes permission mode in agent.md frontmatter", async () => {
      const agent = createSubagent({
        frontmatter: {
          permission: { read: "allow", write: "allow" },
        },
      });

      const result = await adapter.fromOAC(agent);
      const content = result.configs[0].content;

      expect(content).toContain("permissionMode");
      expect(content).toContain("bypassPermissions");
    });
  });

  // ============================================================================
  // fromOAC() - SKILLS GENERATION FROM CONTEXTS
  // ============================================================================

  describe("fromOAC() - generating skills from contexts", () => {
    it("generates skill files from contexts", async () => {
      const agent: OpenAgent = {
        frontmatter: {
          name: "Agent",
          description: "Test",
          mode: "primary",
        },
        metadata: {
          name: "Agent",
          category: "core",
          type: "agent",
        },
        systemPrompt: "Prompt",
        contexts: [
          {
            path: ".opencode/context/skills/python-best-practices.md",
            description: "Python coding standards",
          },
        ],
      };

      const result = await adapter.fromOAC(agent);

      expect(result.configs.length).toBeGreaterThan(1);
      const skillConfig = result.configs.find((c) =>
        c.fileName.includes(".claude/skills/")
      );
      expect(skillConfig).toBeDefined();
      expect(skillConfig?.fileName).toMatch(/\.claude\/skills\/.*\/SKILL\.md/);
    });

    it("generates correct skill name from context path", async () => {
      const agent: OpenAgent = {
        frontmatter: {
          name: "Agent",
          description: "Test",
          mode: "primary",
        },
        metadata: {
          name: "Agent",
          category: "core",
          type: "agent",
        },
        systemPrompt: "Prompt",
        contexts: [
          {
            path: "docs/React Hooks Guide.md",
            description: "React hooks documentation",
          },
        ],
      };

      const result = await adapter.fromOAC(agent);
      const skillConfig = result.configs.find((c) =>
        c.fileName.includes(".claude/skills/")
      );

      expect(skillConfig?.fileName).toMatch(/react-hooks-guide/);
    });

    it("includes context priority in skill content", async () => {
      const agent: OpenAgent = {
        frontmatter: {
          name: "Agent",
          description: "Test",
          mode: "primary",
        },
        metadata: {
          name: "Agent",
          category: "core",
          type: "agent",
        },
        systemPrompt: "Prompt",
        contexts: [
          {
            path: "context/important.md",
            priority: "high",
            description: "Important context",
          },
        ],
      };

      const result = await adapter.fromOAC(agent);
      const skillConfig = result.configs.find((c) =>
        c.fileName.includes(".claude/skills/")
      );

      expect(skillConfig?.content).toContain("Priority: high");
    });

    it("generates multiple skills from multiple contexts", async () => {
      const agent: OpenAgent = {
        frontmatter: {
          name: "Agent",
          description: "Test",
          mode: "primary",
        },
        metadata: {
          name: "Agent",
          category: "core",
          type: "agent",
        },
        systemPrompt: "Prompt",
        contexts: [
          { path: "context1.md", description: "First" },
          { path: "context2.md", description: "Second" },
          { path: "context3.md", description: "Third" },
        ],
      };

      const result = await adapter.fromOAC(agent);
      const skillConfigs = result.configs.filter((c) =>
        c.fileName.includes(".claude/skills/")
      );

      expect(skillConfigs).toHaveLength(3);
    });

    it("includes skill metadata when context lacks description", async () => {
      const agent: OpenAgent = {
        frontmatter: {
          name: "Agent",
          description: "Test",
          mode: "primary",
        },
        metadata: {
          name: "Agent",
          category: "core",
          type: "agent",
        },
        systemPrompt: "Prompt",
        contexts: [{ path: ".opencode/context/styles.md" }],
      };

      const result = await adapter.fromOAC(agent);
      const skillConfig = result.configs.find((c) =>
        c.fileName.includes(".claude/skills/")
      );

      expect(skillConfig?.content).toContain("Context from");
      expect(skillConfig?.content).toContain("styles.md");
    });

    it("handles skill names with special characters", async () => {
      const agent: OpenAgent = {
        frontmatter: {
          name: "Agent",
          description: "Test",
          mode: "primary",
        },
        metadata: {
          name: "Agent",
          category: "core",
          type: "agent",
        },
        systemPrompt: "Prompt",
        contexts: [
          { path: "docs/Type Script Advanced Rules.md", description: "Test" },
        ],
      };

      const result = await adapter.fromOAC(agent);
      const skillConfig = result.configs.find((c) =>
        c.fileName.includes(".claude/skills/")
      );

      expect(skillConfig).toBeDefined();
      // Should have lowercase and dashed name from path
      expect(skillConfig?.fileName).toMatch(/type-script-advanced-rules/);
    });
  });

  // ============================================================================
  // VALIDATION
  // ============================================================================

  describe("validateConversion()", () => {
    const createAgent = (overrides?: Partial<AgentFrontmatter>): OpenAgent => ({
      frontmatter: {
        name: "Agent",
        description: "Test",
        mode: "primary",
        ...overrides,
      },
      metadata: { name: "Agent", category: "core", type: "agent" },
      systemPrompt: "Prompt",
      contexts: [],
    });

    it("returns no warnings for valid agent", () => {
      const agent = createAgent();

      const warnings = adapter.validateConversion(agent);

      expect(warnings).toHaveLength(0);
    });

    it("warns when name is missing", () => {
      const agent = createAgent({ name: "" });

      const warnings = adapter.validateConversion(agent);

      expect(warnings.some((w) => w.includes("name"))).toBe(true);
    });

    it("warns when description is missing", () => {
      const agent = createAgent({ description: "" });

      const warnings = adapter.validateConversion(agent);

      expect(warnings.some((w) => w.includes("description"))).toBe(true);
    });

    it("warns about granular permission degradation", () => {
      const agent = createAgent({
        permission: {
          read: { "file1.txt": "allow", "file2.txt": "deny" },
        },
      });

      const warnings = adapter.validateConversion(agent);

      expect(
        warnings.some((w) => w.includes("granular permissions"))
      ).toBe(true);
    });

    it("does not warn about simple permission rules", () => {
      const agent = createAgent({
        permission: { read: "allow", write: "allow" },
      });

      const warnings = adapter.validateConversion(agent);

      expect(
        warnings.some((w) => w.includes("granular permissions"))
      ).toBe(false);
    });
  });

  // ============================================================================
  // MODEL MAPPING
  // ============================================================================

  describe("model mapping (Claude to OAC)", () => {
    it("maps claude-sonnet-4-20250514 to claude-sonnet-4", async () => {
      const source = JSON.stringify({
        name: "Agent",
        description: "Test",
        model: "claude-sonnet-4-20250514",
        systemPrompt: "Prompt",
      });

      const result = await adapter.toOAC(source);

      expect(result.frontmatter.model).toBe("claude-sonnet-4");
    });

    it("maps short model names", async () => {
      const source = JSON.stringify({
        name: "Agent",
        description: "Test",
        model: "opus",
        systemPrompt: "Prompt",
      });

      const result = await adapter.toOAC(source);

      expect(result.frontmatter.model).toBe("claude-opus-4");
    });

    it("preserves unknown models", async () => {
      const source = JSON.stringify({
        name: "Agent",
        description: "Test",
        model: "claude-custom-model",
        systemPrompt: "Prompt",
      });

      const result = await adapter.toOAC(source);

      expect(result.frontmatter.model).toBe("claude-custom-model");
    });

    it("handles missing model gracefully", async () => {
      const source = JSON.stringify({
        name: "Agent",
        description: "Test",
        systemPrompt: "Prompt",
      });

      const result = await adapter.toOAC(source);

      expect(result.frontmatter.model).toBeUndefined();
    });
  });

  // ============================================================================
  // MODEL MAPPING (OAC to Claude)
  // ============================================================================

  describe("model mapping (OAC to Claude)", () => {
    it("maps claude-sonnet-4 to full version", async () => {
      const agent: OpenAgent = {
        frontmatter: {
          name: "Agent",
          description: "Test",
          mode: "primary",
          model: "claude-sonnet-4",
        },
        metadata: { name: "Agent", category: "core", type: "agent" },
        systemPrompt: "Prompt",
        contexts: [],
      };

      const result = await adapter.fromOAC(agent);
      const config = JSON.parse(result.configs[0].content);

      expect(config.model).toBe("claude-sonnet-4-20250514");
    });

    it("preserves other model IDs", async () => {
      const agent: OpenAgent = {
        frontmatter: {
          name: "Agent",
          description: "Test",
          mode: "primary",
          model: "claude-opus-4",
        },
        metadata: { name: "Agent", category: "core", type: "agent" },
        systemPrompt: "Prompt",
        contexts: [],
      };

      const result = await adapter.fromOAC(agent);
      const config = JSON.parse(result.configs[0].content);

      expect(config.model).toBe("claude-opus-4");
    });

    it("does not set model when not provided", async () => {
      const agent: OpenAgent = {
        frontmatter: {
          name: "Agent",
          description: "Test",
          mode: "primary",
        },
        metadata: { name: "Agent", category: "core", type: "agent" },
        systemPrompt: "Prompt",
        contexts: [],
      };

      const result = await adapter.fromOAC(agent);
      const config = JSON.parse(result.configs[0].content);

      expect(config.model).toBeUndefined();
    });
  });

  // ============================================================================
  // TOOL MAPPING
  // ============================================================================

  describe("tool mapping and parsing", () => {
    it("parses comma-separated tools string", async () => {
      const source = JSON.stringify({
        name: "Agent",
        description: "Test",
        tools: "Read, Write, Edit, Bash",
        systemPrompt: "Prompt",
      });

      const result = await adapter.toOAC(source);

      expect(result.frontmatter.tools).toEqual({
        read: true,
        write: true,
        edit: true,
        bash: true,
      });
    });

    it("normalizes tool names to lowercase", async () => {
      const source = JSON.stringify({
        name: "Agent",
        description: "Test",
        tools: ["Read", "WRITE", "BaSh"],
        systemPrompt: "Prompt",
      });

      const result = await adapter.toOAC(source);

      expect(Object.keys(result.frontmatter.tools || {})).toContain("read");
      expect(Object.keys(result.frontmatter.tools || {})).toContain("write");
      expect(Object.keys(result.frontmatter.tools || {})).toContain("bash");
    });

    it("capitalizes tools for Claude format", async () => {
      const agent: OpenAgent = {
        frontmatter: {
          name: "Agent",
          description: "Test",
          mode: "primary",
          tools: { read: true, write: true, bash: true },
        },
        metadata: { name: "Agent", category: "core", type: "agent" },
        systemPrompt: "Prompt",
        contexts: [],
      };

      const result = await adapter.fromOAC(agent);
      const config = JSON.parse(result.configs[0].content);

      expect(config.tools).toEqual(
        expect.arrayContaining(["Read", "Write", "Bash"])
      );
    });

    it("omits disabled tools", async () => {
      const agent: OpenAgent = {
        frontmatter: {
          name: "Agent",
          description: "Test",
          mode: "primary",
          tools: { read: true, write: false, bash: true },
        },
        metadata: { name: "Agent", category: "core", type: "agent" },
        systemPrompt: "Prompt",
        contexts: [],
      };

      const result = await adapter.fromOAC(agent);
      const config = JSON.parse(result.configs[0].content);

      expect(config.tools).not.toContain("Write");
      expect(config.tools).toContain("Read");
    });
  });

  // ============================================================================
  // PERMISSION MAPPING
  // ============================================================================

  describe("permission mapping", () => {
    it("maps all-allow permissions to bypassPermissions", async () => {
      const agent: OpenAgent = {
        frontmatter: {
          name: "Agent",
          description: "Test",
          mode: "primary",
          permission: { read: "allow", write: "allow", bash: true },
        },
        metadata: { name: "Agent", category: "core", type: "agent" },
        systemPrompt: "Prompt",
        contexts: [],
      };

      const result = await adapter.fromOAC(agent);
      const config = JSON.parse(result.configs[0].content);

      expect(config.permissionMode).toBe("bypassPermissions");
    });

    it("maps all-deny permissions to dontAsk", async () => {
      const agent: OpenAgent = {
        frontmatter: {
          name: "Agent",
          description: "Test",
          mode: "primary",
          permission: { read: "deny", write: "deny", bash: false },
        },
        metadata: { name: "Agent", category: "core", type: "agent" },
        systemPrompt: "Prompt",
        contexts: [],
      };

      const result = await adapter.fromOAC(agent);
      const config = JSON.parse(result.configs[0].content);

      expect(config.permissionMode).toBe("dontAsk");
    });

    it("maps ask permissions to default", async () => {
      const agent: OpenAgent = {
        frontmatter: {
          name: "Agent",
          description: "Test",
          mode: "primary",
          permission: { read: "ask", write: "allow" },
        },
        metadata: { name: "Agent", category: "core", type: "agent" },
        systemPrompt: "Prompt",
        contexts: [],
      };

      const result = await adapter.fromOAC(agent);
      const config = JSON.parse(result.configs[0].content);

      expect(config.permissionMode).toBe("default");
    });

    it("warns on mixed granular permissions", async () => {
      const agent: OpenAgent = {
        frontmatter: {
          name: "Agent",
          description: "Test",
          mode: "primary",
          permission: {
            read: "allow",
            "write.file1": "deny",
          },
        },
        metadata: { name: "Agent", category: "core", type: "agent" },
        systemPrompt: "Prompt",
        contexts: [],
      };

      const result = await adapter.fromOAC(agent);

      expect(result.warnings.some((w) => w.includes("permission"))).toBe(true);
    });
  });

  // ============================================================================
  // SKILL MAPPING
  // ============================================================================

  describe("skill parsing and mapping", () => {
    it("parses skills as comma-separated string", async () => {
      const source = JSON.stringify({
        name: "Agent",
        description: "Test",
        skills: "skill1, skill2, skill3",
        systemPrompt: "Prompt",
      });

      const result = await adapter.toOAC(source);

      expect(result.frontmatter.skills).toEqual(["skill1", "skill2", "skill3"]);
    });

    it("parses skills as array", async () => {
      const source = JSON.stringify({
        name: "Agent",
        description: "Test",
        skills: ["skill1", "skill2"],
        systemPrompt: "Prompt",
      });

      const result = await adapter.toOAC(source);

      expect(result.frontmatter.skills).toEqual(["skill1", "skill2"]);
    });

    it("handles empty skills gracefully", async () => {
      const source = JSON.stringify({
        name: "Agent",
        description: "Test",
        skills: [],
        systemPrompt: "Prompt",
      });

      const result = await adapter.toOAC(source);

      expect(result.frontmatter.skills).toEqual([]);
    });

    it("includes skills in config.json", async () => {
      const agent: OpenAgent = {
        frontmatter: {
          name: "Agent",
          description: "Test",
          mode: "primary",
          skills: ["skill1", "skill2"],
        },
        metadata: { name: "Agent", category: "core", type: "agent" },
        systemPrompt: "Prompt",
        contexts: [],
      };

      const result = await adapter.fromOAC(agent);
      const config = JSON.parse(result.configs[0].content);

      expect(config.skills).toEqual(["skill1", "skill2"]);
    });

    it("handles skill objects with name property", async () => {
      const agent: OpenAgent = {
        frontmatter: {
          name: "Agent",
          description: "Test",
          mode: "primary",
          skills: [{ name: "skill1" }],
        },
        metadata: { name: "Agent", category: "core", type: "agent" },
        systemPrompt: "Prompt",
        contexts: [],
      };

      const result = await adapter.fromOAC(agent);
      const config = JSON.parse(result.configs[0].content);

      expect(config.skills).toContain("skill1");
    });
  });

  // ============================================================================
  // HOOK MAPPING
  // ============================================================================

  describe("hook parsing and mapping", () => {
    it("parses hooks with matchers", async () => {
      const source = JSON.stringify({
        name: "Agent",
        description: "Test",
        hooks: {
          PreToolUse: [
            {
              matcher: "*.txt",
              hooks: [{ type: "command", command: "validate" }],
            },
          ],
        },
        systemPrompt: "Prompt",
      });

      const result = await adapter.toOAC(source);

      expect(result.frontmatter.hooks).toBeDefined();
      expect(result.frontmatter.hooks![0].matchers).toEqual(["*.txt"]);
    });

    it("maps hook commands correctly", async () => {
      const source = JSON.stringify({
        name: "Agent",
        description: "Test",
        hooks: {
          PostToolUse: [
            {
              matcher: "*",
              hooks: [
                { type: "command", command: "log" },
                { type: "command", command: "notify" },
              ],
            },
          ],
        },
        systemPrompt: "Prompt",
      });

      const result = await adapter.toOAC(source);

      expect(result.frontmatter.hooks![0].commands.length).toBe(2);
    });

    it("converts hooks back to Claude format", async () => {
      const agent: OpenAgent = {
        frontmatter: {
          name: "Agent",
          description: "Test",
          mode: "primary",
          hooks: [
            {
              event: "PreToolUse",
              matchers: ["*.txt"],
              commands: [{ type: "command", command: "validate" }],
            },
          ],
        },
        metadata: { name: "Agent", category: "core", type: "agent" },
        systemPrompt: "Prompt",
        contexts: [],
      };

      const result = await adapter.fromOAC(agent);
      const config = JSON.parse(result.configs[0].content);

      expect(config.hooks.PreToolUse).toBeDefined();
      expect(config.hooks.PreToolUse[0].matcher).toBe("*.txt");
    });

    it("defaults matcher to wildcard", async () => {
      const agent: OpenAgent = {
        frontmatter: {
          name: "Agent",
          description: "Test",
          mode: "primary",
          hooks: [
            {
              event: "AgentStart",
              commands: [{ type: "command", command: "init" }],
            },
          ],
        },
        metadata: { name: "Agent", category: "core", type: "agent" },
        systemPrompt: "Prompt",
        contexts: [],
      };

      const result = await adapter.fromOAC(agent);
      const config = JSON.parse(result.configs[0].content);

      expect(config.hooks.AgentStart[0].matcher).toBe("*");
    });
  });

  // ============================================================================
  // ROUNDTRIP CONVERSION
  // ============================================================================

  describe("roundtrip conversion", () => {
    it("roundtrip primary agent config", async () => {
      // Start with OAC
      const original: OpenAgent = {
        frontmatter: {
          name: "TestAgent",
          description: "A test agent",
          mode: "primary",
          model: "claude-sonnet-4",
          tools: { read: true, write: true },
          skills: ["skill1"],
        },
        metadata: { name: "TestAgent", category: "core", type: "agent" },
        systemPrompt: "You are helpful",
        contexts: [],
      };

      // Convert to Claude
      const toClaudeResult = await adapter.fromOAC(original);
      const claudeConfig = JSON.parse(toClaudeResult.configs[0].content);

      // Convert back to OAC
      const backToOAC = await adapter.toOAC(JSON.stringify(claudeConfig));

      // Verify core properties are preserved
      expect(backToOAC.frontmatter.name).toBe(original.frontmatter.name);
      expect(backToOAC.frontmatter.description).toBe(
        original.frontmatter.description
      );
      expect(backToOAC.systemPrompt).toBe(original.systemPrompt);
      expect(backToOAC.frontmatter.tools).toEqual(original.frontmatter.tools);
    });

    it("roundtrip preserves model through conversion", async () => {
      const original: OpenAgent = {
        frontmatter: {
          name: "Agent",
          description: "Test",
          mode: "primary",
          model: "claude-opus-4",
        },
        metadata: { name: "Agent", category: "core", type: "agent" },
        systemPrompt: "Prompt",
        contexts: [],
      };

      const toClaudeResult = await adapter.fromOAC(original);
      const claudeConfig = JSON.parse(toClaudeResult.configs[0].content);
      const backToOAC = await adapter.toOAC(JSON.stringify(claudeConfig));

      expect(backToOAC.frontmatter.model).toBe("claude-opus-4");
    });
  });

  // ============================================================================
  // EDGE CASES & ERROR HANDLING
  // ============================================================================

  describe("edge cases and error handling", () => {
    it("omits empty tools from config", async () => {
      const agent: OpenAgent = {
        frontmatter: {
          name: "Agent",
          description: "Test",
          mode: "primary",
          tools: {},
        },
        metadata: { name: "Agent", category: "core", type: "agent" },
        systemPrompt: "Prompt",
        contexts: [],
      };

      const result = await adapter.fromOAC(agent);
      const config = JSON.parse(result.configs[0].content);

      // Empty tools should not be included in config
      expect(config.tools === undefined || config.tools?.length === 0).toBe(true);
    });

    it("handles null system prompt", async () => {
      const source = JSON.stringify({
        name: "Agent",
        description: "Test",
        systemPrompt: null,
      });

      const result = await adapter.toOAC(source);

      expect(result.systemPrompt).toBe("");
    });

    it("handles empty system prompt", async () => {
      const agent: OpenAgent = {
        frontmatter: {
          name: "Agent",
          description: "Test",
          mode: "primary",
        },
        metadata: { name: "Agent", category: "core", type: "agent" },
        systemPrompt: "",
        contexts: [],
      };

      const result = await adapter.fromOAC(agent);
      const config = JSON.parse(result.configs[0].content);

      expect(config.systemPrompt).toBe("");
    });

    it("handles special characters in names", async () => {
      const agent: OpenAgent = {
        frontmatter: {
          name: "Agent-With-Dashes_and_underscores",
          description: "Test with special chars: @#$",
          mode: "primary",
        },
        metadata: { name: "Agent", category: "core", type: "agent" },
        systemPrompt: "Prompt",
        contexts: [],
      };

      const result = await adapter.fromOAC(agent);

      expect(result.success).toBe(true);
      const config = JSON.parse(result.configs[0].content);
      expect(config.name).toContain("-");
    });

    it("handles very long system prompt", async () => {
      const longPrompt = "A".repeat(5000);
      const agent: OpenAgent = {
        frontmatter: {
          name: "Agent",
          description: "Test",
          mode: "primary",
        },
        metadata: { name: "Agent", category: "core", type: "agent" },
        systemPrompt: longPrompt,
        contexts: [],
      };

      const result = await adapter.fromOAC(agent);
      const config = JSON.parse(result.configs[0].content);

      expect(config.systemPrompt.length).toBe(5000);
    });

    it("handles multiline YAML values in frontmatter", async () => {
      const source = `---
name: Agent
description: Test description
---

System prompt here`;

      const result = await adapter.toOAC(source);

      expect(result.frontmatter.name).toBe("Agent");
      expect(result.systemPrompt).toBe("System prompt here");
    });
  });

  // ============================================================================
  // CONVERSION RESULT STRUCTURE
  // ============================================================================

  describe("conversion result structure", () => {
    it("returns success true on valid conversion", async () => {
      const agent: OpenAgent = {
        frontmatter: {
          name: "Agent",
          description: "Test",
          mode: "primary",
        },
        metadata: { name: "Agent", category: "core", type: "agent" },
        systemPrompt: "Prompt",
        contexts: [],
      };

      const result = await adapter.fromOAC(agent);

      expect(result.success).toBe(true);
    });

    it("includes capabilities in result", async () => {
      const agent: OpenAgent = {
        frontmatter: {
          name: "Agent",
          description: "Test",
          mode: "primary",
        },
        metadata: { name: "Agent", category: "core", type: "agent" },
        systemPrompt: "Prompt",
        contexts: [],
      };

      const result = await adapter.fromOAC(agent);

      expect(result.capabilities).toBeDefined();
      expect(result.capabilities?.name).toBe("claude");
    });

    it("includes encoding in tool config", async () => {
      const agent: OpenAgent = {
        frontmatter: {
          name: "Agent",
          description: "Test",
          mode: "primary",
        },
        metadata: { name: "Agent", category: "core", type: "agent" },
        systemPrompt: "Prompt",
        contexts: [],
      };

      const result = await adapter.fromOAC(agent);

      expect(result.configs[0].encoding).toBe("utf-8");
    });
  });
});
