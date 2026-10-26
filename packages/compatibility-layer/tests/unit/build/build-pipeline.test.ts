/**
 * BuildPipeline — targets, determinism, and the orphan-removal safety envelope.
 *
 * ─── Why the pruning tests are the important half of this file ───────────────────────────
 *
 * Orphan removal is the one part of `oac build` that DELETES. Everything else, if wrong,
 * produces a bad file someone notices in review; this, if wrong, destroys work that was never
 * committed and is not recoverable.
 *
 * The live case is not hypothetical. `.opencode/agent/eval-runner.md` is a real, shipped,
 * hand-authored agent with no `content/agents/` counterpart — deliberately, until it is
 * canonicalised. The obvious pruning rule ("delete anything under `.opencode/agent/` with no
 * canonical source") deletes it. So the rule is inverted: the build removes only what a
 * PREVIOUS build recorded writing. These tests pin that inversion from both sides — that a
 * genuine orphan does go, and that an unclaimed file does not — because a pruner that only
 * ever gets tested on the happy path is a pruner that eats someone's afternoon exactly once.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";
import {
  build,
  buildAgentIn,
  check,
  plan,
  readManifest,
  serializeManifest,
  write,
} from "../../../src/core/BuildPipeline.js";
import { repoPath } from "../../support/pending.js";

const REPO = repoPath();

// ============================================================================
// A throwaway tree, so nothing here can touch the real repo
// ============================================================================

let root: string;

/** A minimal canonical agent. `targets` is the knob most of these tests turn. */
/**
 * A canonical fixture agent.
 *
 * A claude-code target automatically gets an authored `tools` override, because every agent
 * targeting Claude Code must have one — the adapter refuses to derive it (Claude Code cannot
 * enforce a per-agent scope, so there is no honest derivation). An agent without one is
 * incomplete, so it cannot be this helper's default shape; tests that want that case strip it.
 */
function canonicalAgent(id: string, targets: readonly string[]): string {
  const overrides = targets.includes("claude-code")
    ? ["  overrides:", "    claude-code:", "      tools: [Read]"]
    : [];

  return [
    "---",
    `name: ${id}`,
    `description: Fixture agent ${id}.`,
    "mode: subagent",
    "permission:",
    "  read:",
    '    "*": "allow"',
    "oac:",
    `  id: ${id}`,
    `  name: ${id}`,
    "  category: subagents/test",
    "  type: subagent",
    '  version: "1.0.0"',
    "  author: opencode",
    "  targets:",
    ...targets.map((target) => `    - ${target}`),
    ...overrides,
    "---",
    "",
    `# ${id}`,
    "",
    "Body.",
    "",
  ].join("\n");
}

function put(relativePath: string, content: string): void {
  const absolute = join(root, relativePath);
  mkdirSync(dirname(absolute), { recursive: true });
  writeFileSync(absolute, content, "utf-8");
}

/** A registry the emitter can carry non-agent data through from. */
const BASE_REGISTRY = {
  version: "1.0.0",
  metadata: { lastUpdated: "2026-01-01" },
  components: { agents: [], subagents: [], contexts: [] },
  profiles: {},
};

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "oac-build-"));
  put("registry.json", `${JSON.stringify(BASE_REGISTRY, null, 2)}\n`);
  put("registry.v1.json", `${JSON.stringify(BASE_REGISTRY, null, 2)}\n`);
  put("content/agents/subagents/test/alpha.md", canonicalAgent("alpha", ["opencode"]));
  put("content/agents/subagents/test/beta.md", canonicalAgent("beta", ["opencode", "claude-code"]));
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

// ============================================================================
// targets:
// ============================================================================

describe("oac.targets", () => {
  it("emits an agent only to the targets it declares", async () => {
    const files = await build({ root });

    expect(files.has(".opencode/agent/alpha.md")).toBe(true);
    expect(files.has(".opencode/agent/beta.md")).toBe(true);
    expect(files.has("plugins/claude-code/agents/beta.md")).toBe(true);
    // alpha declares targets: [opencode] only — it must produce NO claude-code output.
    expect(files.has("plugins/claude-code/agents/alpha.md")).toBe(false);
  });

  it("restricting --target narrows the build without changing the bytes", async () => {
    const all = await build({ root });
    const only = await build({ root, targets: ["opencode"], skipRegistry: true });

    expect([...only.keys()]).toEqual(
      [...all.keys()].filter((path) => path.startsWith(".opencode/") || path.startsWith("hosts/opencode/")),
    );
    for (const [path, content] of only) expect(content).toBe(all.get(path));
  });

  it("emits an opencode-v1 sibling for every agent that declares opencode", async () => {
    const { files } = await plan({ root });
    const v1 = files.filter((f) => f.target === "opencode-v1").map((f) => f.path);

    expect(v1).toEqual([
      "hosts/opencode-v1/agent/subagents/test/alpha.md",
      "hosts/opencode-v1/agent/subagents/test/beta.md",
    ]);
  });

  it("does not emit opencode-v1 when the build is narrowed to other targets", async () => {
    const { files } = await plan({ root, targets: ["opencode"], skipRegistry: true });

    expect(files.some((f) => f.target === "opencode-v1")).toBe(false);
  });

  it("emits registry.v1.json only when the v1 target is built", async () => {
    const both = await build({ root });
    const v2Only = await build({ root, targets: ["opencode"] });

    expect(both.has("registry.json")).toBe(true);
    expect(both.has("registry.v1.json")).toBe(true);
    expect(v2Only.has("registry.json")).toBe(true);
    expect(v2Only.has("registry.v1.json")).toBe(false);
  });

  it("keeps name: in the v1 sibling", async () => {
    const files = await build({ root, targets: ["opencode-v1"], skipRegistry: true });

    expect(files.get("hosts/opencode-v1/agent/subagents/test/alpha.md")).toContain("name: alpha");
  });

  it("prunes v1 output when its source is deleted, within the v1 root only", async () => {
    write(await plan({ root }), { root });
    expect(existsSync(join(root, "hosts/opencode-v1/agent/subagents/test/alpha.md"))).toBe(true);

    rmSync(join(root, "content/agents/subagents/test/alpha.md"));
    const result = write(await plan({ root }), { root });

    expect(result.removed).toContain("hosts/opencode-v1/agent/subagents/test/alpha.md");
    expect(existsSync(join(root, "hosts/opencode-v1/agent/subagents/test/alpha.md"))).toBe(false);
  });

  it("strips the oac: block from OpenCode output but keeps the body", async () => {
    const files = await build({ root, targets: ["opencode"], skipRegistry: true });
    const emitted = files.get(".opencode/agent/alpha.md") ?? "";

    expect(emitted).not.toContain("oac:");
    // v2 ignores `name:` (the file name is the id), so the line is dropped; v1 keeps it.
    expect(emitted).not.toContain("name: alpha");
    expect(files.get(".opencode/agent/alpha.md")).toBe(emitted);
    expect(emitted).toContain("Body.");
  });
});

// ============================================================================
// buildAgent
// ============================================================================

describe("buildAgent", () => {
  it("emits one agent by its oac.id", async () => {
    expect(await buildAgentIn(root, "beta", "claude-code")).toContain("name: beta");
  });

  it("names the known ids when asked for one that does not exist", async () => {
    await expect(buildAgentIn(root, "nope", "opencode")).rejects.toThrow(/alpha, beta/);
  });

  it("refuses a target the agent does not ship to, rather than inventing output", async () => {
    await expect(buildAgentIn(root, "alpha", "claude-code")).rejects.toThrow(
      /does not ship to target "claude-code"/,
    );
  });
});

// ============================================================================
// Determinism
// ============================================================================

describe("determinism", () => {
  it("is a fixed point: building over its own output changes nothing", async () => {
    const first = write(await plan({ root }), { root });
    expect(first.changed.length).toBeGreaterThan(0);

    const second = write(await plan({ root }), { root });
    expect(second.changed, "a second build rewrote files").toEqual([]);
    expect(check(await plan({ root }), { root })).toEqual([]);
  });

  it("writes a manifest with sorted keys and no timestamp", async () => {
    write(await plan({ root }), { root });
    const manifest = readFileSync(join(root, ".oac/build-manifest.json"), "utf-8");

    expect(manifest).not.toMatch(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    expect(Object.keys(readManifest(root).files)).toEqual(
      [...Object.keys(readManifest(root).files)].sort(),
    );
    expect(serializeManifest(readManifest(root))).toBe(manifest);
  });
});

// ============================================================================
// Staging
// ============================================================================

describe("staged targets", () => {
  it("rebases a staged target and leaves the in-place tree alone", async () => {
    write(await plan({ root }), { root, outputRoots: { "claude-code": ".tmp/stage" } });

    expect(existsSync(join(root, ".tmp/stage/plugins/claude-code/agents/beta.md"))).toBe(true);
    expect(existsSync(join(root, "plugins/claude-code/agents/beta.md"))).toBe(false);
  });
});

// ============================================================================
// Orphan removal — the part that deletes
// ============================================================================

describe("orphan removal", () => {
  const ALPHA_OUT = ".opencode/agent/alpha.md";
  // v2 is flat; v1 keeps the category directories, which is where empty-directory tidying matters.
  const V1_ALPHA = "hosts/opencode-v1/agent/subagents/test/alpha.md";

  it("removes generated output when its canonical source is deleted", async () => {
    write(await plan({ root }), { root });
    expect(existsSync(join(root, ALPHA_OUT))).toBe(true);

    rmSync(join(root, "content/agents/subagents/test/alpha.md"));
    const result = write(await plan({ root }), { root });

    expect(result.removed).toContain(ALPHA_OUT);
    expect(existsSync(join(root, ALPHA_OUT))).toBe(false);
  });

  it("NEVER removes a file it did not generate, however orphan-shaped it looks", async () => {
    // This is `.opencode/agent/eval-runner.md`: a real agent, in the output tree, with no
    // canonical source, deliberately not canonicalised yet. It is not in the ledger, so it is
    // not enumerable as a candidate — no rule, guard or heuristic ever gets a vote.
    put(".opencode/agent/eval-runner.md", "---\nname: eval-runner\n---\n\nUncommitted work.\n");

    write(await plan({ root }), { root });
    write(await plan({ root }), { root });

    expect(existsSync(join(root, ".opencode/agent/eval-runner.md"))).toBe(true);
    expect(readFileSync(join(root, ".opencode/agent/eval-runner.md"), "utf-8")).toContain(
      "Uncommitted work.",
    );
  });

  it("removes the directory an orphan leaves empty, but never the target's own root", async () => {
    // Regression: this used to throw EFAULT — `rmSync` without `recursive` refuses to remove a
    // directory at all, so the tidy-up aborted the whole build AFTER it had already deleted
    // the file. Caught by running the real command, not by any test that existed at the time.
    write(await plan({ root }), { root });
    rmSync(join(root, "content/agents/subagents/test/alpha.md"));
    rmSync(join(root, "content/agents/subagents/test/beta.md"));

    const result = write(await plan({ root }), { root });

    expect(result.removed).toContain(ALPHA_OUT);
    expect(result.removed).toContain(V1_ALPHA);
    expect(existsSync(join(root, "hosts/opencode-v1/agent/subagents/test"))).toBe(false);
    expect(existsSync(join(root, ".opencode/agent")), "the output root itself").toBe(true);
    expect(existsSync(join(root, "hosts/opencode-v1/agent")), "the v1 output root itself").toBe(true);
  });

  it("leaves a directory alone while it still holds a file the build does not own", async () => {
    put("hosts/opencode-v1/agent/subagents/test/notes.md", "hand-written, not generated\n");
    write(await plan({ root }), { root });
    rmSync(join(root, "content/agents/subagents/test/alpha.md"));
    rmSync(join(root, "content/agents/subagents/test/beta.md"));

    write(await plan({ root }), { root });

    expect(existsSync(join(root, "hosts/opencode-v1/agent/subagents/test/notes.md"))).toBe(true);
  });

  it("prunes nothing on a first build, when there is no ledger to prune from", async () => {
    put(".opencode/agent/stranger.md", "not ours\n");

    const result = write(await plan({ root }), { root });

    expect(result.removed).toEqual([]);
    expect(existsSync(join(root, ".opencode/agent/stranger.md"))).toBe(true);
  });

  it("keeps — and reports — an orphan a human has edited since it was generated", async () => {
    write(await plan({ root }), { root });
    rmSync(join(root, "content/agents/subagents/test/alpha.md"));
    writeFileSync(join(root, ALPHA_OUT), "hand-edited, and not by the build\n", "utf-8");

    const result = write(await plan({ root }), { root });

    expect(result.removed).not.toContain(ALPHA_OUT);
    expect(result.kept.map((entry) => entry.path)).toContain(ALPHA_OUT);
    expect(result.kept[0]?.reason).toMatch(/modified since it was generated/);
    expect(existsSync(join(root, ALPHA_OUT))).toBe(true);
  });

  it("refuses a manifest that points a delete outside its target's output root", async () => {
    write(await plan({ root }), { root });
    put("src/precious.ts", "export const x = 1;\n");

    // A corrupted / hand-edited ledger claiming the build wrote into src/.
    const manifest = readManifest(root);
    manifest.files["src/precious.ts"] = {
      sha256: "0".repeat(64),
      target: "opencode",
      root: "src",
    };
    put(".oac/build-manifest.json", serializeManifest(manifest));

    const result = write(await plan({ root }), { root });

    expect(result.removed).not.toContain("src/precious.ts");
    expect(existsSync(join(root, "src/precious.ts"))).toBe(true);
  });

  it("--no-prune leaves orphans in place", async () => {
    write(await plan({ root }), { root });
    rmSync(join(root, "content/agents/subagents/test/alpha.md"));

    const result = write(await plan({ root }), { root, prune: false });

    expect(result.removed).toEqual([]);
    expect(existsSync(join(root, ALPHA_OUT))).toBe(true);
  });

  it("reports an orphan as drift under check() without removing it", async () => {
    write(await plan({ root }), { root });
    rmSync(join(root, "content/agents/subagents/test/alpha.md"));

    const drift = check(await plan({ root }), { root });

    expect(drift).toContainEqual({ path: ALPHA_OUT, status: "orphan" });
    expect(existsSync(join(root, ALPHA_OUT))).toBe(true);
  });
});

// ============================================================================
// Targeted builds — `--target X` owns X's output and nothing else
// ============================================================================

describe("targeted builds", () => {
  // Regression (2026-10-20): `oac build --target claude-code` deleted every `.opencode/agent/*`,
  // `hosts/opencode-v1/agent/**` and `registry.v1.json`, and dropped their ledger entries. The plan
  // only held claude-code (+ registry.json) files, so every OTHER target's ledger entry looked
  // like an orphan whose source was gone.
  const STAGE = { "claude-code": ".tmp/stage" } as const;
  const UNSELECTED = [
    ".opencode/agent/alpha.md",
    ".opencode/agent/beta.md",
    "hosts/opencode/agent/alpha.md",
    "hosts/opencode/agent/beta.md",
    "hosts/opencode-v1/agent/subagents/test/alpha.md",
    "hosts/opencode-v1/agent/subagents/test/beta.md",
    "registry.v1.json",
  ];

  it("never prunes, and keeps verbatim the ledger entries of, targets it did not build", async () => {
    write(await plan({ root }), { root, outputRoots: STAGE });
    const before = readManifest(root);

    const result = write(await plan({ root, targets: ["claude-code"] }), {
      root,
      outputRoots: STAGE,
    });

    expect(result.removed).toEqual([]);
    expect(result.kept).toEqual([]);
    for (const path of UNSELECTED) {
      expect(existsSync(join(root, path)), path).toBe(true);
      expect(readManifest(root).files[path], path).toEqual(before.files[path]);
    }
    expect(readManifest(root)).toEqual(before);
  });

  it("does not report unselected targets' output as orphan drift under check()", async () => {
    write(await plan({ root }), { root, outputRoots: STAGE });

    const drift = check(await plan({ root, targets: ["claude-code"] }), {
      root,
      outputRoots: STAGE,
    });

    expect(drift).toEqual([]);
  });

  it("still prunes orphans of the targets it DID build", async () => {
    write(await plan({ root }), { root, outputRoots: STAGE });
    // beta stops targeting claude-code: its staged claude output is now an orphan.
    put("content/agents/subagents/test/beta.md", canonicalAgent("beta", ["opencode"]));

    const result = write(await plan({ root, targets: ["claude-code"] }), {
      root,
      outputRoots: STAGE,
    });

    // The primary (hosts/) and its live mirror go together.
    expect(result.removed).toEqual([
      ".tmp/stage/hosts/claude-code/agents/beta.md",
      ".tmp/stage/plugins/claude-code/agents/beta.md",
    ]);
    for (const path of UNSELECTED) expect(existsSync(join(root, path)), path).toBe(true);
    expect(readManifest(root).files[".tmp/stage/plugins/claude-code/agents/beta.md"]).toBeUndefined();
    expect(readManifest(root).files[".tmp/stage/hosts/claude-code/agents/beta.md"]).toBeUndefined();
  });
});

// ============================================================================
// hosts/ primaries and their live mirrors
// ============================================================================

describe("hosts/ layout and live mirrors", () => {
  const PAIRS = [
    ["hosts/opencode/agent/beta.md", ".opencode/agent/beta.md"],
    ["hosts/claude-code/agents/beta.md", "plugins/claude-code/agents/beta.md"],
  ] as const;

  it("emits every target under hosts/ and mirrors the live paths byte-for-byte", async () => {
    const { files } = await plan({ root });
    const byPath = new Map(files.map((f) => [f.path, f]));

    for (const [primary, mirror] of PAIRS) {
      expect(byPath.get(primary)?.mirrorOf, primary).toBeUndefined();
      expect(byPath.get(mirror)?.mirrorOf, mirror).toBe(primary);
      expect(byPath.get(mirror)?.content).toBe(byPath.get(primary)?.content);
    }
    // v1 is display-only: hosts/opencode-v1 and no live mirror.
    expect(files.filter((f) => f.target === "opencode-v1").every((f) => f.mirrorOf === undefined)).toBe(true);
    expect(files.some((f) => f.path.startsWith("v1-opencode/"))).toBe(false);
  });

  it("records each mirror in the manifest under its own root", async () => {
    write(await plan({ root }), { root });
    const ledger = readManifest(root).files;

    expect(ledger["hosts/opencode/agent/beta.md"]?.root).toBe("hosts/opencode/agent");
    expect(ledger[".opencode/agent/beta.md"]?.root).toBe(".opencode/agent");
    expect(ledger["hosts/claude-code/agents/beta.md"]?.root).toBe("hosts/claude-code/agents");
    expect(ledger["plugins/claude-code/agents/beta.md"]?.root).toBe("plugins/claude-code/agents");
  });

  it("reports a hand-edited mirror as drift", async () => {
    const built = await plan({ root });
    write(built, { root });
    put(".opencode/agent/beta.md", "hand edit\n");

    expect(check(built, { root })).toEqual([{ path: ".opencode/agent/beta.md", status: "modified" }]);
  });

  it("prunes a mirror together with its primary when the source goes", async () => {
    write(await plan({ root }), { root });
    rmSync(join(root, "content/agents/subagents/test/beta.md"));

    const result = write(await plan({ root }), { root });

    for (const [primary, mirror] of PAIRS) {
      expect(result.removed).toContain(primary);
      expect(result.removed).toContain(mirror);
      expect(existsSync(join(root, mirror))).toBe(false);
    }
  });
});

// ============================================================================
// Fail-closed
// ============================================================================

describe("failure handling", () => {
  it("rejects duplicate typed identities in carried-through component categories", async () => {
    put(
      "registry.json",
      `${JSON.stringify({
        ...BASE_REGISTRY,
        components: {
          ...BASE_REGISTRY.components,
          contexts: [
            { id: "duplicate", type: "context", path: ".opencode/context/one.md" },
            { id: "duplicate", type: "context", path: ".opencode/context/two.md" },
          ],
        },
      }, null, 2)}\n`,
    );

    await expect(plan({ root })).rejects.toThrow(
      "Duplicate registry component identities: context:duplicate",
    );
  });

  it("rejects the whole build on a schema violation rather than emitting a partial tree", async () => {
    put("content/agents/subagents/test/broken.md", "---\nname: broken\n---\n\nNo oac block.\n");

    await expect(plan({ root })).rejects.toThrow();
  });

  it("fails the build when an agent targets claude-code without authoring its tools", async () => {
    // Previously this asserted a warning, then a refusal-on-scoped-rules. Both were downstream
    // of deriving the tool list from `permission:`, which is not possible — Claude Code cannot
    // enforce a per-agent scope, so every derived answer is either a crippled agent or a silent
    // widening. The list is authored; an agent that omits it is incomplete, and the build says
    // so rather than picking a default.
    put(
      "content/agents/subagents/test/gamma.md",
      canonicalAgent("gamma", ["claude-code"]).replace(
        "  overrides:\n    claude-code:\n      tools: [Read]\n",
        "",
      ),
    );

    await expect(plan({ root, targets: ["claude-code"], skipRegistry: true })).rejects.toThrow(
      /declares no oac\.overrides\.claude-code\.tools/,
    );
  });

  it("names the source file in a refusal, not just the agent id", async () => {
    // The adapter only knows `gamma`. Whoever has to make the decision needs the path.
    put(
      "content/agents/subagents/test/gamma.md",
      canonicalAgent("gamma", ["claude-code"]).replace(
        "  overrides:\n    claude-code:\n      tools: [Read]\n",
        "",
      ),
    );

    await expect(plan({ root, targets: ["claude-code"], skipRegistry: true })).rejects.toThrow(
      /content\/agents\/subagents\/test\/gamma\.md:/,
    );
  });

  it("attaches the source path to every warning, so a warning is actionable", async () => {
    const built = await plan({ root: REPO });

    for (const warning of built.warnings) {
      expect(warning.source, warning.reason).toMatch(/^content\/agents\/.+\.md$/);
    }
  });
});

// ============================================================================
// root containment
// ============================================================================

describe("root containment", () => {
  it("refuses a staging override that escapes the build root and writes nothing", async () => {
    const outside = join(root, "..", `oac-escape-${Date.now()}`);
    const built = await plan({ root });

    expect(() => write(built, { root, outputRoots: { "claude-code": "../../escape" } })).toThrow(
      /outside the build root/,
    );

    // Nothing in place was written either: validation runs before the first write.
    expect(existsSync(join(root, ".opencode/agent/alpha.md"))).toBe(false);
    expect(existsSync(join(root, ".oac/build-manifest.json"))).toBe(false);
    expect(existsSync(outside)).toBe(false);
  });

  it("never deletes a ledger entry whose path resolves outside the build root", async () => {
    const victimDir = mkdtempSync(join(tmpdir(), "oac-victim-"));
    const victim = join(victimDir, "precious.md");
    writeFileSync(victim, "keep me", "utf-8");

    const escaped = `../${victimDir.split("/").pop()}/precious.md`;
    put(
      ".oac/build-manifest.json",
      serializeManifest({
        version: 1,
        files: {
          [escaped]: {
            sha256: "0000000000000000000000000000000000000000000000000000000000000000",
            target: "opencode",
            root: ".opencode/agent",
          },
        },
      }),
    );

    // Point the tmp root's parent at the victim's parent so `../<dir>` really resolves to it.
    // Both mkdtemp dirs live directly under tmpdir(), so this holds by construction.
    const result = write(await plan({ root }), { root });

    expect(existsSync(victim)).toBe(true);
    expect(readFileSync(victim, "utf-8")).toBe("keep me");
    expect(result.removed).not.toContain(escaped);
    expect(result.kept.map((k) => k.path)).toContain(escaped);
    expect(result.kept.find((k) => k.path === escaped)?.reason).toMatch(/outside the build root/);

    rmSync(victimDir, { recursive: true, force: true });
  });
});
