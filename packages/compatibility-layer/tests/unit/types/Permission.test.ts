/**
 * Unit tests for the ORDERED permission representation and its desugaring.
 *
 * Why this matters: `GranularPermissionSchema` used to be `z.record(...)`, an unordered
 * map. OpenCode resolves permissions LAST-MATCH-WINS — verified live against OpenCode
 * 1.17.20 in docs/architecture/canonical-refactor/10-PRECEDENCE-EXPERIMENT.md, whose
 * resolver is literally `.findLast()` over a flattened, ordered rule list. Order is
 * therefore semantic, and a map only preserved it by accident of ECMAScript string-key
 * insertion ordering — an accident that provably fails for integer-like keys (probe 3).
 *
 * The full resolver lives in Capabilities.ts (subtask 04). What is asserted here is the
 * property that resolver depends on: desugaring is total and order-preserving, and the
 * resulting order yields the outcomes the live experiment observed.
 */

import { describe, it, expect } from "vitest";
import {
  desugarPermission,
  PermissionInputSchema,
  GranularPermissionSchema,
  PermissionMapSchema,
  type GranularPermission,
  type PermissionAction,
} from "../../../src/types.js";

/**
 * Minimal last-match-wins resolver mirroring OpenCode's `evaluate()` (findLast over the
 * flattened rules). Test-local on purpose: subtask 04 owns the shipped resolver; this only
 * demonstrates that the schema's ORDER carries the semantics.
 */
function resolve(
  permissions: GranularPermission,
  capability: string,
  candidate: string
): PermissionAction | undefined {
  const glob = (pattern: string, value: string): boolean =>
    new RegExp(`^${pattern.split("*").map(escape).join(".*")}$`).test(value);

  return permissions
    .flatMap((entry) => entry.rules.map((rule) => ({ capability: entry.capability, ...rule })))
    .findLast((rule) => glob(rule.capability, capability) && glob(rule.pattern, candidate))
    ?.action;
}

function escape(literal: string): string {
  return literal.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

describe("GranularPermissionSchema", () => {
  it("is an ordered array, not a record", () => {
    const ordered = [
      { capability: "bash", rules: [{ pattern: "*", action: "deny" as const }] },
    ];

    expect(GranularPermissionSchema.safeParse(ordered).success).toBe(true);
    expect(GranularPermissionSchema.safeParse({ bash: "deny" }).success).toBe(false);
  });

  it("rejects an unknown key in a rule or entry (strict)", () => {
    expect(
      GranularPermissionSchema.safeParse([
        { capability: "bash", rules: [{ pattern: "*", action: "deny", note: "x" }] },
      ]).success
    ).toBe(false);

    expect(
      GranularPermissionSchema.safeParse([{ capability: "bash", rules: [], extra: 1 }]).success
    ).toBe(false);
  });

  it("rejects an unknown action and an empty pattern", () => {
    expect(
      GranularPermissionSchema.safeParse([
        { capability: "bash", rules: [{ pattern: "*", action: "maybe" }] },
      ]).success
    ).toBe(false);

    expect(
      GranularPermissionSchema.safeParse([
        { capability: "bash", rules: [{ pattern: "", action: "deny" }] },
      ]).success
    ).toBe(false);
  });

  it("represents duplicate patterns, which the map form cannot", () => {
    const ordered = [
      {
        capability: "bash",
        rules: [
          { pattern: "echo dup*", action: "deny" as const },
          { pattern: "echo dup*", action: "allow" as const },
        ],
      },
    ];

    // The experiment (probe 4) showed YAML silently collapses these to the last one.
    // The ordered form keeps both; refusing to EMIT them is the serializer's job.
    expect(GranularPermissionSchema.parse(ordered)[0]?.rules).toHaveLength(2);
  });
});

describe("desugarPermission", () => {
  it("desugars scalar sugar to a single catch-all rule", () => {
    expect(desugarPermission({ edit: "deny" })).toEqual([
      { capability: "edit", rules: [{ pattern: "*", action: "deny" }] },
    ]);
  });

  it("desugars boolean sugar (true = allow, false = deny)", () => {
    expect(desugarPermission({ read: true, write: false })).toEqual([
      { capability: "read", rules: [{ pattern: "*", action: "allow" }] },
      { capability: "write", rules: [{ pattern: "*", action: "deny" }] },
    ]);
  });

  it("desugars map sugar preserving authored key order", () => {
    expect(
      desugarPermission({ bash: { "*": "deny", "git status*": "allow", "rm *": "deny" } })
    ).toEqual([
      {
        capability: "bash",
        rules: [
          { pattern: "*", action: "deny" },
          { pattern: "git status*", action: "allow" },
          { pattern: "rm *", action: "deny" },
        ],
      },
    ]);
  });

  it("mixes scalar and map sugar without reordering", () => {
    const result = desugarPermission({
      read: "allow",
      bash: { "*": "deny", "ls*": "allow" },
      edit: "ask",
    });

    expect(result.map((entry) => entry.capability)).toEqual(["read", "bash", "edit"]);
  });

  it("is the identity on already-ordered input", () => {
    const ordered = [
      {
        capability: "bash",
        rules: [
          { pattern: "*", action: "deny" as const },
          { pattern: "ls*", action: "allow" as const },
        ],
      },
    ];

    expect(desugarPermission(ordered)).toEqual(ordered);
  });

  it("accepts a wildcard capability, which OpenCode flattens alongside specific ones", () => {
    expect(desugarPermission({ "*": "ask" })).toEqual([
      { capability: "*", rules: [{ pattern: "*", action: "ask" }] },
    ]);
  });

  it("rejects an integer-like scope, which ECMAScript would silently reorder", () => {
    // Probe 3: `{"*": "deny", "8080": "allow"}` reorders to `[["8080","allow"],["*","deny"]]`,
    // making the allow unreachable — and OpenCode then dropped the bash tool entirely.
    expect(() => desugarPermission({ bash: { "*": "deny", "8080": "allow" } })).toThrow();
    expect(PermissionInputSchema.safeParse({ "8080": "allow" }).success).toBe(false);
  });

  it("allows an integer-like scope in the ordered form, where order is explicit", () => {
    const ordered = [
      { capability: "bash", rules: [{ pattern: "8080", action: "allow" as const }] },
    ];

    expect(desugarPermission(ordered)).toEqual(ordered);
  });

  it("keeps the legacy map form parseable, so existing frontmatter still loads", () => {
    const authored = { bash: { "*": "deny", "ls*": "allow" }, edit: "deny" };

    expect(PermissionMapSchema.safeParse(authored).success).toBe(true);
    expect(desugarPermission(authored)).toHaveLength(2);
  });
});

describe("last-match-wins resolution order", () => {
  it("lets a later specific rule override an earlier broad one (probe 1)", () => {
    const permissions = desugarPermission({ bash: { "*": "deny", "echo ok*": "allow" } });

    expect(resolve(permissions, "bash", "echo ok probe1")).toBe("allow");
    expect(resolve(permissions, "bash", "ls")).toBe("deny");
  });

  it("lets a later broad rule override an earlier specific one (probe 2)", () => {
    // The distinguishing case: most-specific-wins predicts deny; the live install allowed.
    const permissions = desugarPermission({ bash: { "echo ok*": "deny", "*": "allow" } });

    expect(resolve(permissions, "bash", "echo ok probe2")).toBe("allow");
  });

  it("resolves the real openagent.md bash block", () => {
    const permissions = desugarPermission({
      bash: {
        "*": "ask",
        "rm -rf *": "ask",
        "rm -rf /*": "deny",
        "sudo *": "deny",
        "> /dev/*": "deny",
      },
    });

    expect(resolve(permissions, "bash", "sudo apt install")).toBe("deny");
    expect(resolve(permissions, "bash", "ls")).toBe("ask");
    expect(resolve(permissions, "bash", "rm -rf build")).toBe("ask");
    // Matches both "rm -rf *" (ask) and the later "rm -rf /*" (deny) — the later rule wins.
    expect(resolve(permissions, "bash", "rm -rf /tmp")).toBe("deny");
  });

  it("resolves the real coder-agent.md deny-all-then-allowlist bash block", () => {
    const permissions = desugarPermission({
      bash: {
        "*": "deny",
        "bash .opencode/skills/task-management/router.sh complete*": "allow",
        "bash .opencode/skills/task-management/router.sh status*": "allow",
      },
    });

    expect(
      resolve(permissions, "bash", "bash .opencode/skills/task-management/router.sh status x")
    ).toBe("allow");
    expect(resolve(permissions, "bash", "curl evil.sh")).toBe("deny");
  });

  it("returns undefined when no rule matches, so the caller applies a default", () => {
    // The IR must NOT hardcode allow here: OpenCode's own fallback is `ask`, with `allow`
    // supplied by a preceding global baseline rule. Ownership of the default is the
    // resolver's (subtask 04), not the schema's.
    const permissions = desugarPermission({ bash: { "ls*": "allow" } });

    expect(resolve(permissions, "bash", "rm -rf /")).toBeUndefined();
    expect(resolve(permissions, "edit", "src/a.ts")).toBeUndefined();
  });

  it("reordering the authored rules changes the outcome — order is semantic", () => {
    const denyFirst = desugarPermission({ bash: { "*": "deny", "ls*": "allow" } });
    const allowFirst = desugarPermission({ bash: { "ls*": "allow", "*": "deny" } });

    expect(resolve(denyFirst, "bash", "ls -la")).toBe("allow");
    expect(resolve(allowFirst, "bash", "ls -la")).toBe("deny");
  });
});
