/**
 * Unit tests for CapabilityMatrix
 *
 * Tests feature capability matrix and compatibility analysis.
 */

import { describe, it, expect } from "vitest";
import {
  getCapabilityMatrix,
  getFeaturesByCategory,
  getFeatureSupport,
  isFeatureSupported,
  analyzeCompatibility,
  getToolCapabilities,
  comparePlatforms,
  getConversionSummary,
  type Platform,
  type FeatureCategory,
  type SupportLevel,
} from "../../../src/core/CapabilityMatrix";
import type { OpenAgent } from "../../../src/types";

// =============================================================================
// Test Fixtures
// =============================================================================

const createMinimalAgent = (overrides: Partial<OpenAgent> = {}): OpenAgent => ({
  frontmatter: {
    name: "Test Agent",
    description: "A test agent",
    mode: "primary",
    ...overrides.frontmatter,
  },
  systemPrompt: "You are a test agent.",
  contexts: [],
  ...overrides,
});

describe("CapabilityMatrix", () => {
  // ==========================================================================
  // getCapabilityMatrix
  // ==========================================================================
  describe("getCapabilityMatrix()", () => {
    it("returns array of feature definitions", () => {
      const matrix = getCapabilityMatrix();
      expect(Array.isArray(matrix)).toBe(true);
      expect(matrix.length).toBeGreaterThan(0);
    });

    it("each feature has required properties", () => {
      const matrix = getCapabilityMatrix();
      for (const feature of matrix) {
        expect(feature).toHaveProperty("name");
        expect(feature).toHaveProperty("category");
        expect(feature).toHaveProperty("description");
        expect(feature).toHaveProperty("support");
        expect(typeof feature.name).toBe("string");
        expect(typeof feature.description).toBe("string");
      }
    });

    it("each feature has support for all platforms", () => {
      const matrix = getCapabilityMatrix();
      const platforms: Platform[] = ["oac", "claude", "opencode"];

      for (const feature of matrix) {
        for (const platform of platforms) {
          expect(feature.support).toHaveProperty(platform);
          expect(["full", "partial", "none"]).toContain(feature.support[platform]);
        }
      }
    });

    it("returns a copy (immutable)", () => {
      const matrix1 = getCapabilityMatrix();
      const matrix2 = getCapabilityMatrix();
      expect(matrix1).not.toBe(matrix2);
      expect(matrix1).toEqual(matrix2);
    });
  });

  // ==========================================================================
  // getFeaturesByCategory
  // ==========================================================================
  describe("getFeaturesByCategory()", () => {
    it("returns features for agents category", () => {
      const features = getFeaturesByCategory("agents");
      expect(features.length).toBeGreaterThan(0);
      for (const feature of features) {
        expect(feature.category).toBe("agents");
      }
    });

    it("returns features for permissions category", () => {
      const features = getFeaturesByCategory("permissions");
      expect(features.length).toBeGreaterThan(0);
      for (const feature of features) {
        expect(feature.category).toBe("permissions");
      }
    });

    it("returns features for tools category", () => {
      const features = getFeaturesByCategory("tools");
      expect(features.length).toBeGreaterThan(0);
      for (const feature of features) {
        expect(feature.category).toBe("tools");
      }
    });

    it("returns features for context category", () => {
      const features = getFeaturesByCategory("context");
      expect(features.length).toBeGreaterThan(0);
      for (const feature of features) {
        expect(feature.category).toBe("context");
      }
    });

    it("returns features for model category", () => {
      const features = getFeaturesByCategory("model");
      expect(features.length).toBeGreaterThan(0);
      for (const feature of features) {
        expect(feature.category).toBe("model");
      }
    });

    it("returns features for advanced category", () => {
      const features = getFeaturesByCategory("advanced");
      expect(features.length).toBeGreaterThan(0);
      for (const feature of features) {
        expect(feature.category).toBe("advanced");
      }
    });
  });

  // ==========================================================================
  // getFeatureSupport
  // ==========================================================================
  describe("getFeatureSupport()", () => {

    it("returns full for OAC on most features", () => {
      const support = getFeatureSupport("granularPermissions", "oac");
      expect(support).toBe("full");
    });

    it("returns undefined for unknown feature", () => {
      const support = getFeatureSupport("unknownFeature", "claude");
      expect(support).toBeUndefined();
    });

    it("returns correct support for bashExecution (universally supported)", () => {
      expect(getFeatureSupport("bashExecution", "oac")).toBe("full");
      expect(getFeatureSupport("bashExecution", "claude")).toBe("full");
    });
  });

  // ==========================================================================
  // isFeatureSupported
  // ==========================================================================
  describe("isFeatureSupported()", () => {
    it("returns true for fully supported features", () => {
      expect(isFeatureSupported("bashExecution", "claude")).toBe(true);
    });

    it("returns false for partially supported features", () => {
    });

    it("returns false for unsupported features", () => {
    });

    it("returns false for unknown features", () => {
      expect(isFeatureSupported("unknownFeature", "claude")).toBe(false);
    });
  });

  // ==========================================================================
  // analyzeCompatibility
  // ==========================================================================
  describe("analyzeCompatibility()", () => {
    describe("minimal agent analysis", () => {
      it("returns compatible result for minimal agent", () => {
        const agent = createMinimalAgent();
        const result = analyzeCompatibility(agent, "claude");
        expect(result.compatible).toBe(true);
        expect(result.blockers).toHaveLength(0);
      });

      it("calculates score between 0 and 100", () => {
        const agent = createMinimalAgent();
        const result = analyzeCompatibility(agent, "claude");
        expect(result.score).toBeGreaterThanOrEqual(0);
        expect(result.score).toBeLessThanOrEqual(100);
      });
    });

    describe("temperature analysis", () => {
      it("warns when temperature will be ignored", () => {
        const agent = createMinimalAgent({
          frontmatter: {
            name: "Agent",
            description: "Agent with temp",
            mode: "primary",
            temperature: 0.7,
          },
        });
        const result = analyzeCompatibility(agent, "claude");
        expect(result.warnings.some((w) => w.includes("Temperature"))).toBe(true);
        expect(result.lost).toContain("temperatureControl");
      });

    });

    describe("hooks analysis", () => {

      it("preserves hooks on supported platforms", () => {
        const agent = createMinimalAgent({
          frontmatter: {
            name: "Agent",
            description: "Agent with hooks",
            mode: "primary",
            hooks: [{ event: "PreToolUse", command: "echo hello" }],
          },
        });
        const result = analyzeCompatibility(agent, "claude");
        expect(result.preserved).toContain("hooks");
      });
    });

    describe("skills analysis", () => {

      it("preserves skills on supported platforms", () => {
        const agent = createMinimalAgent({
          frontmatter: {
            name: "Agent",
            description: "Agent with skills",
            mode: "primary",
            skills: ["coding"],
          },
        });
        const result = analyzeCompatibility(agent, "claude");
        expect(result.preserved).toContain("skillsSystem");
      });
    });

    describe("context analysis", () => {

      it("warns about context priority loss", () => {
        const agent = createMinimalAgent({
          contexts: [
            { path: ".opencode/context/core/standards.md", priority: "critical" },
          ],
        });
        const result = analyzeCompatibility(agent, "claude");
        expect(
          result.warnings.some((w) => w.includes("priority"))
        ).toBe(true);
        expect(result.lost).toContain("contextPriority");
      });
    });

    describe("maxSteps analysis", () => {
      it("warns when maxSteps will be ignored", () => {
        const agent = createMinimalAgent({
          frontmatter: {
            name: "Agent",
            description: "Agent with maxSteps",
            mode: "primary",
            maxSteps: 100,
          },
        });
        const result = analyzeCompatibility(agent, "claude");
        expect(result.warnings.some((w) => w.includes("maxSteps"))).toBe(true);
        expect(result.lost).toContain("maxSteps");
      });
    });
  });

  // ==========================================================================
  // getToolCapabilities
  // ==========================================================================
  describe("getToolCapabilities()", () => {
    describe("Claude capabilities", () => {
      it("returns correct capabilities for Claude", () => {
        const caps = getToolCapabilities("claude");
        expect(caps.name).toBe("claude");
        expect(caps.displayName).toBe("Claude Code");
        expect(caps.supportsMultipleAgents).toBe(true);
        expect(caps.supportsSkills).toBe(true);
        expect(caps.supportsHooks).toBe(true);
        expect(caps.supportsGranularPermissions).toBe(false);
        // Claude Code agents are markdown files with YAML frontmatter
        // (`plugins/claude-code/agents/<id>.md`). This asserted "json" on the reasoning that
        // settings.json is JSON — but settings.json is not what any adapter emits, and
        // ClaudeAdapter.getCapabilities() simultaneously reported "markdown". The emitted
        // artifact decides; the adapter now reads this row rather than restating it.
        expect(caps.configFormat).toBe("markdown");
        expect(caps.outputStructure).toBe("directory");
      });
    });

  });

  // ==========================================================================
  // comparePlatforms
  // ==========================================================================
  describe("comparePlatforms()", () => {
    it("compares OAC and Claude", () => {
      const comparison = comparePlatforms("oac", "claude");
      expect(comparison).toHaveProperty("identical");
      expect(comparison).toHaveProperty("betterInA");
      expect(comparison).toHaveProperty("betterInB");
      expect(comparison).toHaveProperty("different");
      expect(Array.isArray(comparison.identical)).toBe(true);
    });

    it("identical platforms have no differences", () => {
      const comparison = comparePlatforms("oac", "oac");
      expect(comparison.betterInA).toHaveLength(0);
      expect(comparison.betterInB).toHaveLength(0);
      expect(comparison.different).toHaveLength(0);
    });

  });

  // ==========================================================================
  // getConversionSummary
  // ==========================================================================
  describe("getConversionSummary()", () => {

    it("handles identical platforms", () => {
      const summary = getConversionSummary("oac", "oac");
      expect(summary.some((s) => s.includes("Full feature parity"))).toBe(true);
    });

  });
});
