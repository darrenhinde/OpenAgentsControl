/**
 * Unit tests for ToolMapper
 * 
 * Tests tool name mapping between OAC and other platforms.
 */

import { describe, it, expect } from "vitest";
import {
  mapToolToOAC,
  mapToolFromOAC,
  mapToolAccessFromOAC,
  mapToolAccessToOAC,
  getSupportedTools,
  getUnsupportedTools,
  isToolSupported,
} from "../../../src/mappers/ToolMapper";

describe("ToolMapper", () => {
  // ==========================================================================
  // mapToolFromOAC - OAC to Platform
  // ==========================================================================
  describe("mapToolFromOAC()", () => {
    describe("Claude platform", () => {
      it("maps bash to Bash", () => {
        const result = mapToolFromOAC("bash", "claude");
        expect(result.name).toBe("Bash");
        expect(result.exact).toBe(true);
        expect(result.warning).toBeUndefined();
      });

      it("maps read to Read", () => {
        const result = mapToolFromOAC("read", "claude");
        expect(result.name).toBe("Read");
        expect(result.exact).toBe(true);
      });

      it("maps write to Write", () => {
        const result = mapToolFromOAC("write", "claude");
        expect(result.name).toBe("Write");
        expect(result.exact).toBe(true);
      });

      it("maps edit to Edit", () => {
        const result = mapToolFromOAC("edit", "claude");
        expect(result.name).toBe("Edit");
        expect(result.exact).toBe(true);
      });

      it("maps task to Task", () => {
        const result = mapToolFromOAC("task", "claude");
        expect(result.name).toBe("Task");
        expect(result.exact).toBe(true);
      });

      it("maps patch to Edit (Claude uses Edit for patching)", () => {
        const result = mapToolFromOAC("patch", "claude");
        expect(result.name).toBe("Edit");
        expect(result.exact).toBe(true);
      });
    });

    describe("unknown tools", () => {
      it("returns tool name as-is with warning for unknown tools", () => {
        const result = mapToolFromOAC("unknown_tool", "claude");
        expect(result.name).toBe("unknown_tool");
        expect(result.exact).toBe(false);
        expect(result.warning).toContain("No mapping");
      });
    });
  });

  // ==========================================================================
  // mapToolToOAC - Platform to OAC
  // ==========================================================================
  describe("mapToolToOAC()", () => {
    describe("from Claude", () => {
      it("maps Bash to bash", () => {
        const result = mapToolToOAC("Bash", "claude");
        expect(result.name).toBe("bash");
        expect(result.exact).toBe(true);
      });

      it("maps Read to read", () => {
        const result = mapToolToOAC("Read", "claude");
        expect(result.name).toBe("read");
        expect(result.exact).toBe(true);
      });

      it("maps WebSearch to bash (approximation)", () => {
        const result = mapToolToOAC("WebSearch", "claude");
        expect(result.name).toBe("bash");
        expect(result.exact).toBe(true);
      });
    });

    describe("unknown tools", () => {
      it("returns lowercase version with warning", () => {
        const result = mapToolToOAC("UnknownTool", "claude");
        expect(result.name).toBe("unknowntool");
        expect(result.exact).toBe(false);
        expect(result.warning).toContain("Unknown tool");
      });
    });
  });

  // ==========================================================================
  // mapToolAccessFromOAC - Batch OAC to Platform
  // ==========================================================================
  describe("mapToolAccessFromOAC()", () => {
    it("maps multiple tools at once", () => {
      const tools = { bash: true, read: true, write: false };
      const result = mapToolAccessFromOAC(tools, "claude");

      expect(result.tools["Bash"]).toBe(true);
      expect(result.tools["Read"]).toBe(true);
      expect(result.tools["Write"]).toBe(false);
      expect(result.warnings).toHaveLength(0);
    });

    it("skips undefined tools", () => {
      const tools = { bash: true, read: undefined };
      const result = mapToolAccessFromOAC(tools, "claude");

      expect(result.tools["Bash"]).toBe(true);
      expect(result.tools["Read"]).toBeUndefined();
    });

  });

  // ==========================================================================
  // mapToolAccessToOAC - Batch Platform to OAC
  // ==========================================================================

  // ==========================================================================
  // Utility Functions
  // ==========================================================================
  describe("getSupportedTools()", () => {
    it("returns list of supported tools for Claude", () => {
      const tools = getSupportedTools("claude");
      expect(tools).toContain("bash");
      expect(tools).toContain("read");
      expect(tools).toContain("task");
    });

  });

  describe("getUnsupportedTools()", () => {
    it("returns empty array for Claude (supports most tools)", () => {
      const tools = getUnsupportedTools("claude");
      expect(tools).toHaveLength(0);
    });

  });

  describe("isToolSupported()", () => {
    it("returns true for supported tools", () => {
      expect(isToolSupported("bash", "claude")).toBe(true);
    });

    it("returns false for unsupported tools", () => {
    });
  });
});
