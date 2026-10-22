import { describe, it, expect, beforeEach } from "vitest";
import { OpenClawAdapter } from "../../../src/adapters/OpenClawAdapter";
import type { OpenAgent } from "../../../src/types";

/**
 * Unit tests for OpenClawAdapter with 80%+ coverage
 *
 * Test strategy:
 * 1. Adapter identity (name/displayName/configPath)
 * 2. getCapabilities() — granular permissions is the key differentiator
 * 3. validateConversion() — no granular degradation warnings
 * 4. fromOAC() — three-channel output + permission index
 * 5. toOAC() — phase 1 not implemented
 * 6. Edge cases — missing fields, primary vs subagent, skill/skills variants
 */

function makeAgent(overrides: Partial<OpenAgent> = {}): OpenAgent {
  return {
    frontmatter: {
      name: "TestAgent",
      description: "Test agent for OpenClaw conversion",
      mode: "primary",
    },
    metadata: {
      id: "test-agent",
      name: "TestAgent",
      category: "core",
      type: "agent",
      version: "1.0.0",
      author: "opencode",
      tags: [],
      dependencies: [],
    },
    systemPrompt: "## Workflow\nFollow the 6-stage process.",
    contexts: [],
    ...overrides,
    frontmatter: {
      name: "TestAgent",
      description: "Test agent for OpenClaw conversion",
      mode: "primary",
      ...(overrides.frontmatter || {}),
    },
  } as OpenAgent;
}

describe("OpenClawAdapter", () => {
  let adapter: OpenClawAdapter;

  beforeEach(() => {
    adapter = new OpenClawAdapter();
  });

  // ============================================================================
  // ADAPTER IDENTITY
  // ============================================================================

  describe("adapter identity", () => {
    it("has correct name", () => {
      expect(adapter.name).toBe("openclaw");
    });

    it("has correct displayName", () => {
      expect(adapter.displayName).toBe("OpenClaw");
    });

    it("returns correct config path", () => {
      expect(adapter.getConfigPath()).toBe(".openclaw/");
    });
  });

  // ============================================================================
  // CAPABILITIES
  // ============================================================================

  describe("getCapabilities()", () => {
    it("reports granular permission support (no degradation)", () => {
      const capabilities = adapter.getCapabilities();

      expect(capabilities.name).toBe("openclaw");
      expect(capabilities.supportsGranularPermissions).toBe(true);
      expect(capabilities.supportsAsk).toBeUndefined(); // not a ToolCapabilities field
      expect(capabilities.supportsMultipleAgents).toBe(true);
      expect(capabilities.supportsSkills).toBe(true);
      expect(capabilities.supportsHooks).toBe(true);
      expect(capabilities.supportsTemperature).toBe(true);
      expect(capabilities.configFormat).toBe("json");
      expect(capabilities.outputStructure).toBe("directory");
    });
  });

  // ============================================================================
  // VALIDATION
  // ============================================================================

  describe("validateConversion()", () => {
    it("warns when name is missing", () => {
      const agent = makeAgent({ frontmatter: { name: "" } });
      const warnings = adapter.validateConversion(agent);
      expect(warnings.some((w) => w.includes("name is required"))).toBe(true);
    });

    it("warns when description is missing", () => {
      const agent = makeAgent({ frontmatter: { description: "" } });
      const warnings = adapter.validateConversion(agent);
      expect(warnings.some((w) => w.includes("description is required"))).toBe(true);
    });

    it("does NOT warn about granular permissions (OpenClaw supports them)", () => {
      const agent = makeAgent({
        frontmatter: {
          permission: {
            bash: { "*": "deny", "git status*": "allow" },
            edit: { "**/*.env*": "deny" },
          },
        },
      });
      const warnings = adapter.validateConversion(agent);
      expect(warnings.some((w) => w.includes("degrad"))).toBe(false);
    });

    it("warns about maxSteps (not supported in phase 1)", () => {
      const agent = makeAgent({ frontmatter: { maxSteps: 50 } });
      const warnings = adapter.validateConversion(agent);
      expect(warnings.some((w) => w.includes("maxSteps"))).toBe(true);
    });
  });

  // ============================================================================
  // fromOAC()
  // ============================================================================

  describe("fromOAC()", () => {
    it("generates per-agent config fragment", async () => {
      const result = await adapter.fromOAC(makeAgent());

      expect(result.success).toBe(true);
      expect(result.configs.some((c) => c.fileName.includes("agents/"))).toBe(true);

      const agentConfig = result.configs.find((c) =>
        c.fileName.includes("agents/")
      );
      expect(agentConfig).toBeDefined();
      const parsed = JSON.parse(agentConfig!.content) as Record<string, unknown>;
      expect(parsed.id).toBe("test-agent");
      expect(parsed.name).toBe("TestAgent");
      // entryType removed — OpenClaw schema rejects unknown fields
      expect(parsed.entryType).toBeUndefined();
    });

    it("generates bootstrap manifest for primary agents", async () => {
      const result = await adapter.fromOAC(makeAgent());

      const manifest = result.configs.find((c) =>
        c.fileName.includes("bootstrap-manifest")
      );
      expect(manifest).toBeDefined();
      // Per-agent file name (same pattern as permission-index-{agentId}.json)
      // so same-directory primaries never overwrite each other.
      expect(manifest!.fileName).toBe(".openclaw/bootstrap-manifest-test-agent.json");
      const parsed = JSON.parse(manifest!.content) as {
        agentId: string;
        guidance: string;
      };
      expect(parsed.agentId).toBe("test-agent");
      expect(parsed.guidance).toContain("6-stage");
    });

    it("emits a unique bootstrap manifest per primary agent (no cross-agent overwrite)", async () => {
      const agentA = makeAgent();
      const agentB = makeAgent({
        metadata: { ...agentA.metadata, id: "agent-b" },
      });

      const [resultA, resultB] = await Promise.all([
        adapter.fromOAC(agentA),
        adapter.fromOAC(agentB),
      ]);

      const fileNameA = resultA.configs.find((c) =>
        c.fileName.includes("bootstrap-manifest")
      )!.fileName;
      const fileNameB = resultB.configs.find((c) =>
        c.fileName.includes("bootstrap-manifest")
      )!.fileName;
      expect(fileNameA).toBe(".openclaw/bootstrap-manifest-test-agent.json");
      expect(fileNameB).toBe(".openclaw/bootstrap-manifest-agent-b.json");
      expect(fileNameA).not.toBe(fileNameB);
    });

    it("does NOT generate bootstrap manifest for subagents", async () => {
      const agent = makeAgent({
        frontmatter: { mode: "subagent" },
        metadata: { id: "test-subagent", type: "subagent" },
      });
      const result = await adapter.fromOAC(agent);

      expect(result.configs.some((c) => c.fileName.includes("bootstrap"))).toBe(
        false
      );
      const subagentConfig = result.configs.find((c) =>
        c.fileName.includes("agents/")
      );
      expect(subagentConfig).toBeDefined();
      const parsed = JSON.parse(subagentConfig!.content) as Record<string, unknown>;
      // No entryType field — mode routing is expressed by fileName/OpenClaw
      // structure, and OpenClaw schema rejects unknown fields.
      expect(parsed.entryType).toBeUndefined();
    });

    it("generates skills index when skills present (array form)", async () => {
      const agent = makeAgent({ frontmatter: { skills: ["task-management"] } });
      const result = await adapter.fromOAC(agent);

      const index = result.configs.find((c) =>
        c.fileName.includes("skills-index")
      );
      expect(index).toBeDefined();
      const parsed = JSON.parse(index!.content) as { skills: string[] };
      expect(parsed.skills).toContain("task-management");
    });

    it("generates skills index when skills present (object form)", async () => {
      const agent = makeAgent({
        frontmatter: { skills: [{ name: "context-manager" }] },
      });
      const result = await adapter.fromOAC(agent);

      const index = result.configs.find((c) =>
        c.fileName.includes("skills-index")
      );
      expect(index).toBeDefined();
      const parsed = JSON.parse(index!.content) as { skills: string[] };
      expect(parsed.skills).toContain("context-manager");
    });

    it("preserves full permission table in per-agent permission fragment (no degradation)", async () => {
      const agent = makeAgent({
        frontmatter: {
          permission: {
            bash: { "*": "deny", "git status*": "allow" },
            edit: { "**/*.env*": "deny" },
            question: "allow",
          },
        },
      });
      const result = await adapter.fromOAC(agent);

      // Per-agent fragment: fileName carries the agentId so multiple agents
      // with permission tables never overwrite each other.
      const index = result.configs.find((c) =>
        c.fileName.includes("permission-index")
      );
      expect(index).toBeDefined();
      expect(index!.fileName).toBe(".openclaw/permission-index-test-agent.json");
      const parsed = JSON.parse(index!.content) as {
        agentId: string;
        tools: Record<string, Array<{ pattern: string; action: string }>>;
      };
      expect(parsed.agentId).toBe("test-agent");
      expect(parsed.tools.bash).toHaveLength(2); // patterns preserved
      expect(parsed.tools.bash).toEqual([
        { pattern: "*", action: "deny" },
        { pattern: "git status*", action: "allow" },
      ]);
      expect(parsed.tools.question).toEqual([
        { pattern: "*", action: "allow" },
      ]);
    });

    it("emits a unique permission fragment per agent (no cross-agent overwrite)", async () => {
      const agentA = makeAgent({
        frontmatter: { permission: { bash: { "*": "allow" } } },
      });
      const agentB = makeAgent({
        metadata: { ...agentA.metadata, id: "agent-b" },
        frontmatter: { permission: { read: { "*": "deny" } } },
      });

      const [resultA, resultB] = await Promise.all([
        adapter.fromOAC(agentA),
        adapter.fromOAC(agentB),
      ]);

      const fileNameA = resultA.configs.find((c) =>
        c.fileName.includes("permission-index")
      )!.fileName;
      const fileNameB = resultB.configs.find((c) =>
        c.fileName.includes("permission-index")
      )!.fileName;
      expect(fileNameA).toBe(".openclaw/permission-index-test-agent.json");
      expect(fileNameB).toBe(".openclaw/permission-index-agent-b.json");
      expect(fileNameA).not.toBe(fileNameB);
    });

    it("maps temperature to params", async () => {
      const agent = makeAgent({ frontmatter: { temperature: 0.1 } });
      const result = await adapter.fromOAC(agent);

      const agentConfig = result.configs.find((c) =>
        c.fileName.includes("agents/")
      );
      const parsed = JSON.parse(agentConfig!.content) as {
        params?: { temperature: number };
      };
      expect(parsed.params?.temperature).toBe(0.1);
    });

    it("maps model reference", async () => {
      const agent = makeAgent({ frontmatter: { model: "opencode-go/deepseek-v4-flash" } });
      const result = await adapter.fromOAC(agent);

      const agentConfig = result.configs.find((c) =>
        c.fileName.includes("agents/")
      );
      const parsed = JSON.parse(agentConfig!.content) as { model?: string };
      expect(parsed.model).toBe("opencode-go/deepseek-v4-flash");
    });
  });

  // ============================================================================
  // toOAC()
  // ============================================================================

  describe("toOAC()", () => {
    it("rejects with phase-1 not-implemented error", async () => {
      await expect(adapter.toOAC("{}")).rejects.toThrow(
        "not implemented in phase 1"
      );
    });
  });
});
