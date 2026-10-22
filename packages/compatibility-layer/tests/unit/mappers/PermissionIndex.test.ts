import { describe, it, expect } from "vitest";
import { createPermissionIndex } from "../../../src/mappers/PermissionMapper";

/**
 * Unit tests for createPermissionIndex (OpenClaw no-degradation index).
 *
 * The index must preserve:
 * 1. Full granular rules (no binary simplification)
 * 2. Declaration order (last-match-wins semantics for the hook consumer)
 * 3. Literal / boolean / record rule forms
 */

describe("createPermissionIndex", () => {
  it("handles literal rules", () => {
    const index = createPermissionIndex("test-agent", {
      question: "allow",
    });

    expect(index.agentId).toBe("test-agent");
    expect(index.tools.question).toEqual([{ pattern: "*", action: "allow" }]);
  });

  it("handles boolean rules", () => {
    const index = createPermissionIndex("test-agent", {
      read: true,
      write: false,
    });

    expect(index.tools.read).toEqual([{ pattern: "*", action: "allow" }]);
    expect(index.tools.write).toEqual([{ pattern: "*", action: "deny" }]);
  });

  it("preserves full granular records with order (last-match-wins)", () => {
    const index = createPermissionIndex("test-agent", {
      bash: {
        "*": "deny",
        "git status*": "allow",
        "sudo *": "ask",
      },
    });

    expect(index.tools.bash).toEqual([
      { pattern: "*", action: "deny" },
      { pattern: "git status*", action: "allow" },
      { pattern: "sudo *", action: "ask" },
    ]);
  });

  it("handles mixed rule forms across tools", () => {
    const index = createPermissionIndex("test-agent", {
      bash: { "*": "deny" },
      edit: { "**/*.env*": "deny", "node_modules/**": "deny" },
      task: { contextscout: "allow", "*": "deny" },
      question: "ask",
    });

    expect(index.tools.bash).toEqual([{ pattern: "*", action: "deny" }]);
    expect(index.tools.edit).toHaveLength(2);
    expect(index.tools.task).toEqual([
      { pattern: "contextscout", action: "allow" },
      { pattern: "*", action: "deny" },
    ]);
    expect(index.tools.question).toEqual([{ pattern: "*", action: "ask" }]);
  });

  it("returns empty tools for empty permissions", () => {
    const index = createPermissionIndex("test-agent", {});
    expect(index.tools).toEqual({});
  });

  it("does NOT degrade granular rules to binary (no simplification)", () => {
    const index = createPermissionIndex("test-agent", {
      bash: { "*": "deny", "ls *": "allow" },
    });

    // If degraded to binary this would be { bash: false } — instead full patterns survive
    expect(index.tools.bash).toHaveLength(2);
    expect(index.tools.bash?.[0]?.pattern).toBe("*");
    expect(index.tools.bash?.[0]?.action).toBe("deny");
    expect(index.tools.bash?.[1]?.action).toBe("allow");
  });
});
