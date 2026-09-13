/**
 * OpenCodeAdapter — emitting `.opencode/agent/**` from `content/agents/**`.
 *
 * The adapter's contract is narrow enough to state in one line: the emitted file is the
 * canonical file minus its `oac:` block. So the tests here are mostly about proving that
 * "minus its `oac:` block" is *all* that happens — that nothing else is quietly reformatted,
 * reordered or dropped along the way.
 *
 * The strongest gate in this file is `round-trip against the live corpus`: no expectation was
 * authored for it. It rebuilds the 33 agent files OpenCode is loading today and demands the
 * bytes already on disk. Nothing in it can be wrong-by-guess, and it is what makes subtask 09's
 * seeding reviewable as a no-op diff.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { relative, sep } from "node:path";
import * as yaml from "js-yaml";
import { OpenCodeAdapter, OpenCodeEmitError } from "../../../src/adapters/OpenCodeAdapter.js";
import { desugarPermission } from "../../../src/types.js";
import { listFiles, repoPath } from "../../support/pending.js";

const CONTENT_ROOT = repoPath("content/agents");
const OPENCODE_ROOT = repoPath(".opencode/agent");

/** POSIX path relative to the canonical content root. */
function contentRelative(absolute: string): string {
  return relative(CONTENT_ROOT, absolute).split(sep).join("/");
}

/** Parse a frontmatter block out of an emitted file. */
function frontmatterOf(content: string): Record<string, unknown> {
  const match = /^---\n([\s\S]*?)\n---\n/.exec(content);
  expect(match, "emitted file has no parseable frontmatter").not.toBeNull();
  return yaml.load(match![1]!) as Record<string, unknown>;
}

/** The top-level frontmatter keys, in emitted order. */
function keysOf(content: string): string[] {
  return Object.keys(frontmatterOf(content));
}

const adapter = (): OpenCodeAdapter => new OpenCodeAdapter();

const MINIMAL = [
  "---",
  "name: Probe",
  "description: A probe agent.",
  "mode: subagent",
  "oac:",
  "  id: probe",
  "  name: Probe",
  "  category: core",
  "  type: subagent",
  "---",
  "",
  "# Probe",
  "",
].join("\n");

// ============================================================================
// Identity
// ============================================================================

describe("OpenCodeAdapter identity", () => {
  it("reports its name and display name", () => {
    expect(adapter().name).toBe("opencode");
    expect(adapter().displayName).toBe("OpenCode");
  });

  it("declares granular permission support — OpenCode is the one target that loses nothing", () => {
    const capabilities = adapter().getCapabilities();

    expect(capabilities.supportsGranularPermissions).toBe(true);
    expect(capabilities.configFormat).toBe("markdown");
    expect(capabilities.outputStructure).toBe("directory");
  });

  it("writes agents under .opencode/agent/", () => {
    expect(adapter().getConfigPath()).toBe(".opencode/agent/");
  });
});

// ============================================================================
// Stripping the oac: block
// ============================================================================

describe("OpenCodeAdapter oac stripping", () => {
  it("emits no oac key — asserted by parsing the YAML, not by searching the text", async () => {
    const { content } = await adapter().fromCanonical(MINIMAL);

    // A string search for "oac:" would be satisfied by a body that merely mentions it, and
    // would false-positive on a prompt discussing the oac block. Parse instead.
    expect(frontmatterOf(content)).not.toHaveProperty("oac");
  });

  it("keeps every OpenCode-legal field, in authored order", async () => {
    const { content } = await adapter().fromCanonical(MINIMAL);

    expect(keysOf(content)).toEqual(["name", "description", "mode"]);
  });

  it("leaves the body untouched, including its --- horizontal rules", async () => {
    const source = [
      "---",
      "name: Probe",
      "description: A probe agent.",
      "mode: subagent",
      "oac:",
      "  id: probe",
      "  name: Probe",
      "  category: core",
      "  type: subagent",
      "---",
      "",
      "# Probe",
      "",
      "---",
      "",
      "A section after a horizontal rule.",
      "",
    ].join("\n");

    const { content } = await adapter().fromCanonical(source);

    // The body's own `---` must not be mistaken for the frontmatter terminator.
    expect(content).toContain("A section after a horizontal rule.");
    expect(content.endsWith("A section after a horizontal rule.\n")).toBe(true);
  });

  it("strips an oac: block that is not the last key, keeping the key after it", async () => {
    const source = [
      "---",
      "name: Probe",
      "oac:",
      "  id: probe",
      "  name: Probe",
      "  category: core",
      "  type: subagent",
      "description: A probe agent.",
      "mode: subagent",
      "---",
      "body",
      "",
    ].join("\n");

    const { content } = await adapter().fromCanonical(source);

    expect(keysOf(content)).toEqual(["name", "description", "mode"]);
  });

  it("preserves a blank separator line that follows the oac: block", async () => {
    const source = [
      "---",
      "name: Probe",
      "oac:",
      "  id: probe",
      "  name: Probe",
      "  category: core",
      "  type: subagent",
      "",
      "description: A probe agent.",
      "mode: subagent",
      "---",
      "body",
      "",
    ].join("\n");

    const { content } = await adapter().fromCanonical(source);

    // The blank line separates the next key; swallowing it would reformat the author's file.
    expect(content).toContain("name: Probe\n\ndescription: A probe agent.");
  });

  it("preserves YAML comments, which a dump-based emitter would silently discard", async () => {
    const source = [
      "---",
      "# A comment the author wrote.",
      "name: Probe",
      "description: A probe agent.",
      "mode: subagent",
      "oac:",
      "  id: probe",
      "  name: Probe",
      "  category: core",
      "  type: subagent",
      "---",
      "body",
      "",
    ].join("\n");

    const { content } = await adapter().fromCanonical(source);

    expect(content).toContain("# A comment the author wrote.");
  });
});

// ============================================================================
// Permissions
// ============================================================================

describe("OpenCodeAdapter permissions", () => {
  const planner = readFileSync(
    repoPath("packages/compatibility-layer/tests/golden/fixtures/fixture-planner.md"),
    "utf-8"
  );

  it("serializes ordered rules back to a YAML mapping in original author order", async () => {
    const { content } = await adapter().fromCanonical(planner);

    const permission = frontmatterOf(content)["permission"] as Record<
      string,
      Record<string, string>
    >;

    // Capability order, then rule order within `bash`. Both are semantic: OpenCode flattens
    // the map and resolves last-match-wins, so a reordering here silently changes what the
    // agent may run.
    expect(Object.keys(permission)).toEqual(["read", "bash", "edit", "write"]);
    expect(Object.keys(permission["bash"]!)).toEqual(["*", "git status", "git log*"]);
  });

  it("keeps a deny-all-then-allowlist resolving exactly as authored", async () => {
    const { content } = await adapter().fromCanonical(planner);

    const rules = desugarPermission(frontmatterOf(content)["permission"]);
    const bash = rules.find((entry) => entry.capability === "bash");

    // The catch-all deny comes FIRST and the allows come after it. Reverse them and
    // `git status` resolves to deny; drop the allows and the agent is bricked.
    expect(bash?.rules).toEqual([
      { pattern: "*", action: "deny" },
      { pattern: "git status", action: "allow" },
      { pattern: "git log*", action: "allow" },
    ]);
  });

  it("never widens a deny-all bash block to `bash: true`", async () => {
    // Guards the specific live hazard: `PermissionMapper.mapPermissionsFromOAC` defaults to a
    // "permissive" strategy whose record branch returns `hasAllow || !hasDeny`, which answers
    // `true` for CoderAgent's deny-all-then-allowlist. If that mapper ever reaches this build
    // path, this test is what catches it.
    const { content } = await adapter().fromCanonical(
      readFileSync(repoPath("content/agents/subagents/code/coder-agent.md"), "utf-8")
    );

    const permission = frontmatterOf(content)["permission"] as Record<string, unknown>;

    expect(permission["bash"]).not.toBe(true);
    expect((permission["bash"] as Record<string, string>)["*"]).toBe("deny");
  });

  it("preserves the `skill` capability, which a closed vocabulary would drop", async () => {
    // ExternalScout denies all skills then re-allows context7. `skill` is absent from doc 02
    // §1.2.7's closed vocabulary but IS a real OpenCode permission key (config.ts:575), so a
    // parser built to that enum would drop this block and silently grant every skill.
    const { content } = await adapter().fromCanonical(
      readFileSync(repoPath("content/agents/subagents/core/externalscout.md"), "utf-8")
    );

    const permission = frontmatterOf(content)["permission"] as Record<
      string,
      Record<string, string>
    >;

    expect(permission).toHaveProperty("skill");
    expect(Object.keys(permission["skill"]!)).toEqual(["*", "*context7*"]);
    expect(permission["skill"]!["*"]).toBe("deny");
  });
});

// ============================================================================
// Round-trip against the live corpus
// ============================================================================

/**
 * ─── The drifted 9, and why there is no longer an exception list here ────────────────────
 *
 * 23 committed `.opencode/agent` files used to carry an obsolete 4-line header pointing at the
 * `agent-metadata.json` sidecar this refactor dissolves. The seeding commit (`cf97d98`) dropped
 * it from 9 of the canonical sources and kept it in the other 14, so those 9 could not be
 * reproduced byte-for-byte: the comment simply was not in the source any more.
 *
 * That was pinned here as a named set rather than papered over — the adapter was never
 * special-cased to re-insert the comment, because emitting bytes the source does not contain is
 * forging. The note left two ways out: restore the comment in the 9 sources, or remove it from
 * the emitted files.
 *
 * Subtask 10 took the second by running `oac build`, which emits `.opencode/agent/**` in place.
 * Those 9 files no longer carry the comment, the other 24 were already byte-identical, and the
 * exception machinery is gone with the exception. The round-trip below now compares every
 * source against its committed output directly, with nothing carved out for anybody — which is
 * exactly the property the subtask-11 `oac build && git diff --exit-code` gate needs.
 */

describe("OpenCodeAdapter round-trip", () => {
  const sources = listFiles(CONTENT_ROOT);

  it("finds the canonical corpus", () => {
    expect(sources.length).toBeGreaterThan(0);
  });

  it.each(sources.map((file) => [contentRelative(file), file] as const))(
    "reproduces .opencode/agent/%s byte-for-byte",
    async (rel, file) => {
      const { content } = await adapter().fromCanonical(readFileSync(file, "utf-8"), {
        filePath: file,
      });

      expect(content).toBe(readFileSync(`${OPENCODE_ROOT}/${rel}`, "utf-8"));
    }
  );

  it("leaves no source drifting from its committed output", async () => {
    // The aggregate form of the per-file assertion above. It earns its place by naming every
    // drifted file in ONE failure: a rebuild that regresses 9 files should say so once, not
    // scroll 9 separate byte-diffs past whoever is reading CI.
    const drifted: string[] = [];

    for (const file of sources) {
      const rel = contentRelative(file);
      const { content } = await adapter().fromCanonical(readFileSync(file, "utf-8"));
      if (content !== readFileSync(`${OPENCODE_ROOT}/${rel}`, "utf-8")) drifted.push(rel);
    }

    expect(drifted.sort()).toEqual([]);
  });

  it("maps each source onto its committed output path", () => {
    for (const file of sources) {
      const rel = contentRelative(file);
      expect(adapter().outputPath(rel)).toBe(`.opencode/agent/${rel}`);
    }
  });

  it("derives the output path from the file, not from oac.category + oac.id", () => {
    // `content/agents/subagents/code/test-engineer.md` declares `id: tester`. Composing the
    // path from the id would emit `subagents/code/tester.md` and orphan the `test-engineer.md`
    // OpenCode actually loads.
    expect(adapter().outputPath("subagents/code/test-engineer.md")).toBe(
      ".opencode/agent/subagents/code/test-engineer.md"
    );
  });
});

// ============================================================================
// Determinism
// ============================================================================

describe("OpenCodeAdapter determinism", () => {
  it("emits byte-identical output across runs and instances", async () => {
    const source = readFileSync(repoPath("content/agents/core/openagent.md"), "utf-8");

    const first = await adapter().fromCanonical(source);
    const second = await adapter().fromCanonical(source);

    expect(second.content).toBe(first.content);
  });

  it("emits no timestamp or absolute host path", async () => {
    const { content } = await adapter().fromCanonical(
      readFileSync(repoPath("content/agents/core/openagent.md"), "utf-8"),
      { filePath: "/Users/someone/content/agents/core/openagent.md" }
    );

    // filePath is a diagnostic only — it must never leak into emitted bytes, or the output
    // would depend on where the repo is checked out.
    expect(content).not.toMatch(/\/Users\//);
    expect(content).not.toMatch(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
  });
});

// ============================================================================
// Rejection
// ============================================================================

describe("OpenCodeAdapter rejection", () => {
  it("rejects a file with no oac: block", async () => {
    const source = ["---", "name: Probe", "description: d", "mode: subagent", "---", "b", ""].join(
      "\n"
    );

    await expect(adapter().fromCanonical(source)).rejects.toThrow(OpenCodeEmitError);
    await expect(adapter().fromCanonical(source)).rejects.toThrow(/oac:/);
  });

  it("rejects a file with no frontmatter", async () => {
    await expect(adapter().fromCanonical("# Just a document\n")).rejects.toThrow(
      /frontmatter/
    );
  });

  it("rejects unterminated frontmatter", async () => {
    await expect(adapter().fromCanonical("---\nname: Probe\n")).rejects.toThrow(
      /unterminated/i
    );
  });

  it("rejects an integer-like permission scope that ECMAScript would reorder", async () => {
    const source = [
      "---",
      "name: Probe",
      "description: A probe agent.",
      "mode: subagent",
      "permission:",
      "  bash:",
      '    "*": "deny"',
      '    "8080": "allow"',
      "oac:",
      "  id: probe",
      "  name: Probe",
      "  category: core",
      "  type: subagent",
      "---",
      "body",
      "",
    ].join("\n");

    // An integer-like key is hoisted to the front of the object by ECMAScript, which would
    // silently invert last-match-wins precedence. Rejecting beats emitting a reordered file.
    await expect(adapter().fromCanonical(source)).rejects.toThrow(/integer-like/);
  });

  it("names the file it rejected", async () => {
    await expect(
      adapter().fromCanonical("# no frontmatter\n", { filePath: "content/agents/broken.md" })
    ).rejects.toThrow(/content\/agents\/broken\.md/);
  });

  it("refuses fromOAC() rather than reordering an unordered permission map", async () => {
    const result = await adapter().fromOAC({
      frontmatter: { name: "Probe", description: "d", mode: "subagent" },
      metadata: { tags: [], dependencies: [] },
      systemPrompt: "body",
      contexts: [],
    });

    expect(result.success).toBe(false);
    expect(result.errors?.[0]).toMatch(/fromCanonical/);
  });
});
