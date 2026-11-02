/**
 * Unit tests for ContextMapper
 *
 * Tests context file path mapping between OAC and other platforms.
 */

import { describe, it, expect } from "vitest";
import {
  mapContextPathFromOAC,
  mapContextPathToOAC,
  mapContextReferenceFromOAC,
  mapContextReferencesFromOAC,
  mapSkillsToClaudeFormat,
  mapSkillsFromClaudeFormat,
  getContextBaseDir,
  supportsExternalContext,
  supportsContextSubdirs,
  supportsContextPriority,
  createContextReference,
  normalizeContextPath,
  getRelativeContextPath,
  type ContextPlatform,
} from "../../../src/mappers/ContextMapper";
import type { ContextReference, SkillReference } from "../../../src/types";

describe("ContextMapper", () => {
  // ==========================================================================
  // mapContextPathFromOAC - OAC to Platform Path Mapping
  // ==========================================================================
  describe("mapContextPathFromOAC()", () => {
    describe("Claude platform", () => {
      it("maps OAC context path to Claude skills path", () => {
        const result = mapContextPathFromOAC(
          ".opencode/context/core/standards.md",
          "claude"
        );
        expect(result.path).toBe(".claude/skills/core/standards.md");
        expect(result.exact).toBe(true);
        expect(result.warning).toBeUndefined();
      });

      it("preserves subdirectory structure for Claude", () => {
        const result = mapContextPathFromOAC(
          ".opencode/context/domain/auth/models.md",
          "claude"
        );
        expect(result.path).toBe(".claude/skills/domain/auth/models.md");
        expect(result.exact).toBe(true);
      });

      it("handles paths without base dir prefix", () => {
        const result = mapContextPathFromOAC("core/standards.md", "claude");
        expect(result.path).toBe(".claude/skills/core/standards.md");
        expect(result.exact).toBe(true);
      });
    });

  });

  // ==========================================================================
  // mapContextPathToOAC - Platform to OAC Path Mapping
  // ==========================================================================
  describe("mapContextPathToOAC()", () => {
    describe("from Claude", () => {
      it("maps Claude skills path to OAC context path", () => {
        const result = mapContextPathToOAC(
          ".claude/skills/core/standards.md",
          "claude"
        );
        expect(result.path).toBe(".opencode/context/core/standards.md");
        expect(result.exact).toBe(true);
      });

      it("handles paths without base dir prefix", () => {
        const result = mapContextPathToOAC("core/standards.md", "claude");
        expect(result.path).toBe(".opencode/context/core/standards.md");
        expect(result.exact).toBe(true);
      });
    });

  });

  // ==========================================================================
  // mapContextReferenceFromOAC - Context Reference Mapping
  // ==========================================================================
  describe("mapContextReferenceFromOAC()", () => {
    it("maps context reference without priority", () => {
      const context: ContextReference = {
        path: ".opencode/context/core/standards.md",
      };
      const result = mapContextReferenceFromOAC(context, "claude");
      expect(result.path).toBe(".claude/skills/core/standards.md");
      expect(result.exact).toBe(true);
      expect(result.priority).toBeUndefined();
    });

    it("includes priority in result but warns if unsupported", () => {
      const context: ContextReference = {
        path: ".opencode/context/core/standards.md",
        priority: "critical",
      };
      const result = mapContextReferenceFromOAC(context, "claude");
      expect(result.path).toBe(".claude/skills/core/standards.md");
      expect(result.priority).toBe("critical");
      expect(result.exact).toBe(false);
      expect(result.warning).toContain("does not support priority metadata");
    });

  });

  // ==========================================================================
  // mapContextReferencesFromOAC - Batch Context Reference Mapping
  // ==========================================================================
  describe("mapContextReferencesFromOAC()", () => {
    it("maps multiple context references", () => {
      const contexts: ContextReference[] = [
        { path: ".opencode/context/core/standards.md" },
        { path: ".opencode/context/guides/workflow.md" },
      ];
      const result = mapContextReferencesFromOAC(contexts, "claude");
      expect(result.paths).toHaveLength(2);
      expect(result.paths[0]).toBe(".claude/skills/core/standards.md");
      expect(result.paths[1]).toBe(".claude/skills/guides/workflow.md");
      expect(result.warnings).toHaveLength(0);
    });

    it("collects warnings from all references", () => {
      const contexts: ContextReference[] = [
        { path: ".opencode/context/core/standards.md", priority: "critical" },
        { path: ".opencode/context/guides/workflow.md", priority: "high" },
      ];
      const result = mapContextReferencesFromOAC(contexts, "claude");
      expect(result.paths).toHaveLength(2);
      expect(result.warnings.length).toBeGreaterThan(0);
    });

    it("handles empty array", () => {
      const result = mapContextReferencesFromOAC([], "claude");
      expect(result.paths).toHaveLength(0);
      expect(result.warnings).toHaveLength(0);
    });
  });

  // ==========================================================================
  // mapSkillsToClaudeFormat - OAC Skills to Claude Format
  // ==========================================================================
  describe("mapSkillsToClaudeFormat()", () => {
    it("maps string skill references", () => {
      const skills: SkillReference[] = ["coding", "testing"];
      const result = mapSkillsToClaudeFormat(skills);
      expect(result.skills).toHaveLength(2);
      expect(result.skills[0]).toBe(".claude/skills/coding.md");
      expect(result.skills[1]).toBe(".claude/skills/testing.md");
      expect(result.warnings).toHaveLength(0);
    });

    it("maps object skill references", () => {
      const skills: SkillReference[] = [
        { name: "coding" },
        { name: "testing" },
      ];
      const result = mapSkillsToClaudeFormat(skills);
      expect(result.skills).toHaveLength(2);
      expect(result.skills[0]).toBe(".claude/skills/coding.md");
      expect(result.skills[1]).toBe(".claude/skills/testing.md");
    });

    it("warns when skill config will be ignored", () => {
      const skills: SkillReference[] = [
        { name: "coding", config: { theme: "dark" } },
      ];
      const result = mapSkillsToClaudeFormat(skills);
      expect(result.skills).toHaveLength(1);
      expect(result.warnings).toHaveLength(1);
      expect(result.warnings[0]).toContain("config for 'coding' will be ignored");
    });

    it("handles mixed string and object skills", () => {
      const skills: SkillReference[] = [
        "simple-skill",
        { name: "configured-skill", config: { option: true } },
      ];
      const result = mapSkillsToClaudeFormat(skills);
      expect(result.skills).toHaveLength(2);
      expect(result.skills[0]).toBe(".claude/skills/simple-skill.md");
      expect(result.skills[1]).toBe(".claude/skills/configured-skill.md");
      expect(result.warnings).toHaveLength(1);
    });

    it("handles empty skill config without warning", () => {
      const skills: SkillReference[] = [{ name: "coding", config: {} }];
      const result = mapSkillsToClaudeFormat(skills);
      expect(result.warnings).toHaveLength(0);
    });
  });

  // ==========================================================================
  // mapSkillsFromClaudeFormat - Claude Skills to OAC Format
  // ==========================================================================
  describe("mapSkillsFromClaudeFormat()", () => {
    it("extracts skill names from Claude paths", () => {
      const skillPaths = [".claude/skills/coding.md", ".claude/skills/testing.md"];
      const result = mapSkillsFromClaudeFormat(skillPaths);
      expect(result).toHaveLength(2);
      expect(result[0]).toBe("coding");
      expect(result[1]).toBe("testing");
    });

    it("handles nested skill paths", () => {
      const skillPaths = [".claude/skills/advanced/coding.md"];
      const result = mapSkillsFromClaudeFormat(skillPaths);
      expect(result).toHaveLength(1);
      expect(result[0]).toBe("coding");
    });

    it("handles paths without expected format", () => {
      const skillPaths = ["some/weird/path"];
      const result = mapSkillsFromClaudeFormat(skillPaths);
      expect(result).toHaveLength(1);
      // Falls back to full path when no match
      expect(result[0]).toBe("some/weird/path");
    });

    it("handles empty array", () => {
      const result = mapSkillsFromClaudeFormat([]);
      expect(result).toHaveLength(0);
    });
  });

  // ==========================================================================
  // Utility Functions
  // ==========================================================================
  describe("getContextBaseDir()", () => {
    it("returns correct base dir for OAC", () => {
      expect(getContextBaseDir("oac")).toBe(".opencode/context");
    });

    it("returns correct base dir for Claude", () => {
      expect(getContextBaseDir("claude")).toBe(".claude/skills");
    });

  });

  describe("supportsExternalContext()", () => {
    it("returns true for OAC", () => {
      expect(supportsExternalContext("oac")).toBe(true);
    });

    it("returns true for Claude", () => {
      expect(supportsExternalContext("claude")).toBe(true);
    });

  });

  describe("supportsContextSubdirs()", () => {
    it("returns true for OAC", () => {
      expect(supportsContextSubdirs("oac")).toBe(true);
    });

    it("returns true for Claude", () => {
      expect(supportsContextSubdirs("claude")).toBe(true);
    });

  });

  describe("supportsContextPriority()", () => {
    it("returns true only for OAC", () => {
      expect(supportsContextPriority("oac")).toBe(true);
      expect(supportsContextPriority("claude")).toBe(false);
    });
  });

  describe("createContextReference()", () => {
    it("creates reference with path only", () => {
      const ref = createContextReference(".opencode/context/core/standards.md");
      expect(ref.path).toBe(".opencode/context/core/standards.md");
      expect(ref.priority).toBeUndefined();
      expect(ref.description).toBeUndefined();
    });

    it("creates reference with priority", () => {
      const ref = createContextReference(
        ".opencode/context/core/standards.md",
        "critical"
      );
      expect(ref.path).toBe(".opencode/context/core/standards.md");
      expect(ref.priority).toBe("critical");
    });

    it("creates reference with all fields", () => {
      const ref = createContextReference(
        ".opencode/context/core/standards.md",
        "high",
        "Code quality standards"
      );
      expect(ref.path).toBe(".opencode/context/core/standards.md");
      expect(ref.priority).toBe("high");
      expect(ref.description).toBe("Code quality standards");
    });
  });

  describe("normalizeContextPath()", () => {
    it("removes duplicate slashes", () => {
      expect(normalizeContextPath("path//to///file.md")).toBe("path/to/file.md");
    });

    it("removes leading slash", () => {
      expect(normalizeContextPath("/path/to/file.md")).toBe("path/to/file.md");
    });

    it("removes trailing slash", () => {
      expect(normalizeContextPath("path/to/directory/")).toBe("path/to/directory");
    });

    it("handles combined issues", () => {
      expect(normalizeContextPath("//path//to///file/")).toBe("path/to/file");
    });

    it("returns unchanged normal path", () => {
      expect(normalizeContextPath("path/to/file.md")).toBe("path/to/file.md");
    });
  });

  describe("getRelativeContextPath()", () => {
    it("extracts relative path for OAC", () => {
      const result = getRelativeContextPath(
        ".opencode/context/core/standards.md",
        "oac"
      );
      expect(result).toBe("core/standards.md");
    });

    it("extracts relative path for Claude", () => {
      const result = getRelativeContextPath(
        ".claude/skills/coding/standards.md",
        "claude"
      );
      expect(result).toBe("coding/standards.md");
    });

    it("returns full path if base dir not found", () => {
      const result = getRelativeContextPath("some/other/path.md", "oac");
      expect(result).toBe("some/other/path.md");
    });

  });
});
