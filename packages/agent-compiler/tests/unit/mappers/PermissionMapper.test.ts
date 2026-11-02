/**
 * Unit tests for PermissionMapper
 * 
 * Tests permission translation between OAC granular and binary formats.
 */

import { describe, it, expect } from "vitest";
import {
  resolvePermissionRule,
  isGranularRule,
  mapPermissionsFromOAC,
  mapPermissionsToOAC,
  createGranularRule,
  extractPatterns,
  mergePermissionRules,
  hasGranularPermissions,
  hasAskPermissions,
  analyzePermissionDegradation,
} from "../../../src/mappers/PermissionMapper";

describe("PermissionMapper", () => {
  // ==========================================================================
  // resolvePermissionRule
  // ==========================================================================
  describe("resolvePermissionRule()", () => {
    describe("boolean rules", () => {
      it("returns true for true", () => {
        expect(resolvePermissionRule(true)).toBe(true);
      });

      it("returns false for false", () => {
        expect(resolvePermissionRule(false)).toBe(false);
      });
    });

    describe("literal rules", () => {
      it("returns true for 'allow'", () => {
        expect(resolvePermissionRule("allow")).toBe(true);
      });

      it("returns false for 'deny'", () => {
        expect(resolvePermissionRule("deny")).toBe(false);
      });

      it("returns true for 'ask' with permissive strategy", () => {
        expect(resolvePermissionRule("ask", "permissive")).toBe(true);
      });

      it("returns false for 'ask' with restrictive strategy", () => {
        expect(resolvePermissionRule("ask", "restrictive")).toBe(false);
      });

      it("returns false for 'ask' with ask-as-deny strategy", () => {
        expect(resolvePermissionRule("ask", "ask-as-deny")).toBe(false);
      });
    });

    describe("granular rules (records)", () => {
      it("returns true if any allow exists with permissive strategy", () => {
        const rule = { "*.ts": "allow" as const, "*.js": "deny" as const };
        expect(resolvePermissionRule(rule, "permissive")).toBe(true);
      });

      it("returns false if no allow and has deny with restrictive strategy", () => {
        const rule = { "*.ts": "deny" as const };
        expect(resolvePermissionRule(rule, "restrictive")).toBe(false);
      });

      it("returns true if allow and no deny with restrictive strategy", () => {
        const rule = { "*.ts": "allow" as const };
        expect(resolvePermissionRule(rule, "restrictive")).toBe(true);
      });
    });
  });

  // ==========================================================================
  // isGranularRule
  // ==========================================================================
  describe("isGranularRule()", () => {
    it("returns false for boolean", () => {
      expect(isGranularRule(true)).toBe(false);
      expect(isGranularRule(false)).toBe(false);
    });

    it("returns false for literal strings", () => {
      expect(isGranularRule("allow")).toBe(false);
      expect(isGranularRule("deny")).toBe(false);
      expect(isGranularRule("ask")).toBe(false);
    });

    it("returns true for object rules", () => {
      expect(isGranularRule({ "*.ts": "allow" })).toBe(true);
      expect(isGranularRule({ "*": "deny" })).toBe(true);
    });
  });

  // ==========================================================================
  // mapPermissionsFromOAC
  // ==========================================================================
  describe("mapPermissionsFromOAC()", () => {
    it("converts simple allow/deny to binary", () => {
      const permissions = { bash: "allow" as const, write: "deny" as const };
      const result = mapPermissionsFromOAC(permissions, "claude");

      expect(result.permissions).toEqual({ bash: true, write: false });
      expect(result.warnings).toHaveLength(0);
    });

    it("generates warnings for granular permissions", () => {
      const permissions = {
        bash: { "rm *": "deny" as const, "*": "allow" as const },
      };
      const result = mapPermissionsFromOAC(permissions, "claude");

      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings[0]).toContain("Granular");
    });

    it("generates warnings for 'ask' permissions", () => {
      const permissions = { bash: "ask" as const };
      const result = mapPermissionsFromOAC(permissions, "claude");

      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings[0]).toContain("ask");
    });

    it("respects degradation strategy for 'ask'", () => {
      const permissions = { bash: "ask" as const };

      const permissive = mapPermissionsFromOAC(permissions, "claude", "permissive");
      expect(permissive.permissions).toEqual({ bash: true });

      const restrictive = mapPermissionsFromOAC(permissions, "claude", "restrictive");
      expect(restrictive.permissions).toEqual({ bash: false });
    });
  });

  // ==========================================================================
  // mapPermissionsToOAC
  // ==========================================================================
  describe("mapPermissionsToOAC()", () => {
    it("converts binary to allow/deny", () => {
      const permissions = { bash: true, write: false };
      const result = mapPermissionsToOAC(permissions, "claude");

      expect(result.permissions).toEqual({ bash: "allow", write: "deny" });
      expect(result.warnings).toHaveLength(0);
    });

    it("skips undefined permissions", () => {
      const permissions = { bash: true, write: undefined };
      const result = mapPermissionsToOAC(permissions, "claude");

      expect(result.permissions).toEqual({ bash: "allow" });
    });
  });

  // ==========================================================================
  // createGranularRule
  // ==========================================================================
  describe("createGranularRule()", () => {
    it("creates rule from allow patterns", () => {
      const rule = createGranularRule(["*.ts", "*.tsx"]);
      expect(rule).toEqual({ "*.ts": "allow", "*.tsx": "allow" });
    });

    it("creates rule from allow and deny patterns", () => {
      const rule = createGranularRule(["*"], ["node_modules/**"]);
      expect(rule).toEqual({ "*": "allow", "node_modules/**": "deny" });
    });

    it("creates rule with ask patterns", () => {
      const rule = createGranularRule([], [], ["package.json"]);
      expect(rule).toEqual({ "package.json": "ask" });
    });

    it("creates combined rule", () => {
      const rule = createGranularRule(["src/**"], ["dist/**"], ["*.config.js"]);
      expect(rule).toEqual({
        "src/**": "allow",
        "dist/**": "deny",
        "*.config.js": "ask",
      });
    });
  });

  // ==========================================================================
  // extractPatterns
  // ==========================================================================
  describe("extractPatterns()", () => {
    it("extracts patterns from boolean", () => {
      expect(extractPatterns(true)).toEqual({
        allow: ["*"],
        deny: [],
        ask: [],
      });

      expect(extractPatterns(false)).toEqual({
        allow: [],
        deny: ["*"],
        ask: [],
      });
    });

    it("extracts patterns from literals", () => {
      expect(extractPatterns("allow")).toEqual({
        allow: ["*"],
        deny: [],
        ask: [],
      });

      expect(extractPatterns("deny")).toEqual({
        allow: [],
        deny: ["*"],
        ask: [],
      });

      expect(extractPatterns("ask")).toEqual({
        allow: [],
        deny: [],
        ask: ["*"],
      });
    });

    it("extracts patterns from granular rule", () => {
      const rule = { "*.ts": "allow" as const, "*.js": "deny" as const, "*.config": "ask" as const };
      const result = extractPatterns(rule);

      expect(result.allow).toContain("*.ts");
      expect(result.deny).toContain("*.js");
      expect(result.ask).toContain("*.config");
    });
  });

  // ==========================================================================
  // mergePermissionRules
  // ==========================================================================
  describe("mergePermissionRules()", () => {
    it("merges multiple rules", () => {
      const rule1 = { "*.ts": "allow" as const };
      const rule2 = { "*.js": "deny" as const };
      const merged = mergePermissionRules(rule1, rule2);

      expect(merged).toEqual({ "*.ts": "allow", "*.js": "deny" });
    });

    it("later rules override earlier ones", () => {
      const rule1 = { "*": "allow" as const };
      const rule2 = { "*": "deny" as const };
      const merged = mergePermissionRules(rule1, rule2);

      expect(merged).toBe("deny"); // Simplified to single value
    });

    it("merges boolean and literal rules", () => {
      const merged = mergePermissionRules(true, "deny");
      expect(merged).toBe("deny");
    });
  });

  // ==========================================================================
  // hasGranularPermissions
  // ==========================================================================
  describe("hasGranularPermissions()", () => {
    it("returns false for simple permissions", () => {
      const permissions = { bash: "allow" as const, write: true };
      expect(hasGranularPermissions(permissions)).toBe(false);
    });

    it("returns true for granular permissions", () => {
      const permissions = { bash: { "*": "allow" as const } };
      expect(hasGranularPermissions(permissions)).toBe(true);
    });
  });

  // ==========================================================================
  // hasAskPermissions
  // ==========================================================================
  describe("hasAskPermissions()", () => {
    it("returns false when no ask permissions", () => {
      const permissions = { bash: "allow" as const, write: "deny" as const };
      expect(hasAskPermissions(permissions)).toBe(false);
    });

    it("returns true for top-level ask", () => {
      const permissions = { bash: "ask" as const };
      expect(hasAskPermissions(permissions)).toBe(true);
    });

    it("returns true for nested ask", () => {
      const permissions = { bash: { "rm *": "ask" as const } };
      expect(hasAskPermissions(permissions)).toBe(true);
    });
  });

  // ==========================================================================
  // analyzePermissionDegradation
  // ==========================================================================
  describe("analyzePermissionDegradation()", () => {
    it("returns empty warnings for simple permissions", () => {
      const permissions = { bash: "allow" as const };
      const warnings = analyzePermissionDegradation(permissions, "claude");
      expect(warnings).toHaveLength(0);
    });

    it("warns about granular permission degradation", () => {
      const permissions = { bash: { "*": "allow" as const } };
      const warnings = analyzePermissionDegradation(permissions, "claude");
      expect(warnings.length).toBeGreaterThan(0);
      expect(warnings[0]).toContain("granular");
    });

    it("warns about ask permission conversion", () => {
      const permissions = { bash: "ask" as const };
      const warnings = analyzePermissionDegradation(permissions, "claude");
      expect(warnings.length).toBeGreaterThan(0);
      expect(warnings[0]).toContain("ask");
    });
  });
});
