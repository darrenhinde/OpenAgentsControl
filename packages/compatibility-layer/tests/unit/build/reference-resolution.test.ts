/**
 * Reference resolution — every `context:` / `subagent:` dep must resolve to a real component.
 *
 * ─── Why this suite is the important one ────────────────────────────────────────────────
 *
 * `scripts/registry/validate-registry.sh` prints "All component dependencies are valid!" and
 * exits 0 — and did so for months while four references were broken. That was a FALSE GREEN,
 * reproduced on disk 2026-07-15, because the validator is blind in two ways the tests below
 * pin down structurally:
 *
 *   1. It reads `registry.json` and nothing else. It never parses the `dependencies:`
 *      frontmatter that actually ships in the component files, so drift between a registry
 *      entry and its own file is undetectable. `.opencode/command/add-context.md` was exactly
 *      that: its registry entry listed the four correct bare ids while its frontmatter listed
 *      three path-style ids that resolved to nothing.
 *   2. It iterates `.components.*[].dependencies` only. `.profiles.*.components` — 209 refs
 *      across 5 profiles — is never validated, which is how a wildcard expanding to zero
 *      matches sat in the `advanced` profile unnoticed.
 *
 * ─── The four dead refs, and their repair ───────────────────────────────────────────────
 *
 * Four dead references were verified on disk 2026-07-15 and repaired 2026-07-17: the three
 * path-style frontmatter refs in `add-context.md` became the bare slugs its registry entry
 * always carried, and the `advanced` profile's `context:context-system/*` gained its missing
 * `core/` prefix. {@link REPAIRED} records them; the tree now carries ZERO dead references
 * and this suite fails on the first new one.
 *
 * ─── The dead-ref count was 4, not 9 ────────────────────────────────────────────────────
 *
 * A "9 known dead context import paths" figure circulated in earlier planning notes. It was
 * never substantiated: no doc, commit or script produces it, and no scan of this tree ever
 * reproduced it. The repo's own docs said three (`01-feature-inventory.md:955`,
 * `06-REVIEW.md:309`); the fourth — the profile wildcard — was found while writing this
 * suite. `9` is folklore.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import {
  allReferences,
  deadReferences,
  format,
  frontmatterReferences,
  loadRegistry,
  profileReferences,
  registryComponentReferences,
  resolveAll,
  type Resolution,
} from "../../support/references.js";
import { importPendingSymbols, repoPath } from "../../support/pending.js";

/**
 * The four references that were dead from 2026-07-15 to 2026-07-17, in their repaired form.
 *
 * Each must now resolve. If one of these goes red, the repair has been reverted or the
 * component it points at has been removed — either way that is a deliberate content decision
 * and this list must be edited with it, never weakened around.
 */
const REPAIRED: readonly { ref: string; source: string; was: string }[] = [
  {
    ref: "context:mvi",
    source: ".opencode/command/add-context.md",
    was: "context:core/context-system/standards/mvi.md (path-style, a dead id)",
  },
  {
    ref: "context:frontmatter",
    source: ".opencode/command/add-context.md",
    was: "context:core/context-system/standards/frontmatter.md (path-style, a dead id)",
  },
  {
    ref: "context:project-intelligence",
    source: ".opencode/command/add-context.md",
    was: "context:core/standards/project-intelligence.md (path-style, a dead id)",
  },
  {
    ref: "context:core/context-system/*",
    source: "registry.json profiles.advanced.components",
    was: "context:context-system/* (missing the core/ prefix, a dead wildcard)",
  },
];

function describeAll(resolutions: readonly Resolution[]): string {
  return `\n${format(resolutions)}\n`;
}

// ============================================================================
// The facts — the tree is clean, and stays clean
// ============================================================================

describe("dead references in this tree", () => {
  it("finds none — the four known dead refs were repaired 2026-07-17", () => {
    const dead = deadReferences();

    expect(dead, `reference rot has appeared:${describeAll(dead)}`).toEqual([]);
  });

  it.each(REPAIRED)("still resolves $ref (was $was)", ({ ref, source }) => {
    const [resolution] = resolveAll([{ ref, source }]);

    expect(
      resolution?.status,
      `${ref} (authored in ${source}) no longer resolves. If that is deliberate, ` +
        `update REPAIRED in this file alongside the content change.`
    ).toBe("ok");
  });
});

// ============================================================================
// Why the shell validator could not see them — the mechanism, asserted structurally
// ============================================================================

describe("validate-registry.sh blind spots", () => {
  it("cannot see frontmatter drift: add-context.md's file and registry entry must agree by hand", () => {
    const registry = loadRegistry();
    const entry = registry.components.commands?.find((c) => c.id === "add-context");
    const onDisk = frontmatterReferences().filter((r) =>
      r.source.endsWith("command/add-context.md")
    );

    // Nothing enforces this agreement but this test: the validator reads only the registry
    // side, so if the shipped frontmatter drifts again it is the ONLY thing that goes red.
    expect(entry?.dependencies).toEqual([
      "subagent:context-organizer",
      "context:mvi",
      "context:frontmatter",
      "context:project-intelligence",
    ]);
    expect(onDisk.map((r) => r.ref)).toEqual([...(entry?.dependencies ?? [])]);
  });

  it("never validates profile component lists, where the repaired wildcard lives", () => {
    const registry = loadRegistry();
    const profileRefs = profileReferences(registry);
    const componentRefs = registryComponentReferences(registry);

    expect(Object.keys(registry.profiles).sort()).toEqual([
      "advanced",
      "business",
      "developer",
      "essential",
      "full",
    ]);
    expect(profileRefs.length).toBeGreaterThan(200);

    // The dead spelling was authored ONLY in a profile — no component depended on it — so a
    // validator that walks components alone could not reach it by any path. That is how it
    // survived unnoticed, and why this suite must keep watching profiles. (The repaired
    // spelling also appears as a component dependency — context-organizer's — which is
    // precisely why only the profile copy could rot invisibly.)
    expect(profileRefs.map((r) => r.ref)).toContain("context:core/context-system/*");
    expect(profileRefs.map((r) => r.ref)).not.toContain("context:context-system/*");
    expect(componentRefs.map((r) => r.ref)).not.toContain("context:context-system/*");
  });

  it("wildcard misses are silent: a wrong prefix reports dead-wildcard, not an error", () => {
    const registry = loadRegistry();
    const [repaired] = resolveAll(
      [{ ref: "context:core/context-system/*", source: "control" }],
      registry
    );
    const [misspelt] = resolveAll(
      [{ ref: "context:context-system/*", source: "control" }],
      registry
    );

    // The two spellings differ by one path segment. One expands, one silently matches
    // nothing — which is what made the miss invisible to eyeballing as well as to the
    // validator, and why the resolver must classify it rather than ignore it.
    expect(repaired?.status).toBe("ok");
    expect(misspelt?.status).toBe("dead-wildcard");
  });

  it("registry context ids are bare slugs, so a path-style ref is genuinely a different namespace", () => {
    const registry = loadRegistry();
    const pathish = (registry.components.contexts ?? []).filter(
      (c) => c.id.includes("/") || c.id.endsWith(".md")
    );

    // If this ever becomes non-empty, path-style refs stop being a namespace error and this
    // whole diagnosis needs revisiting.
    expect(
      pathish.map((c) => c.id),
      "no registry context id may contain '/' or end in '.md'"
    ).toEqual([]);

    // The three former add-context targets exist on disk under their bare ids — the files
    // were always fine; only the refs were wrong.
    for (const id of ["mvi", "frontmatter", "project-intelligence"]) {
      const component = (registry.components.contexts ?? []).find((c) => c.id === id);
      expect(component, `registry should carry the bare context id "${id}"`).toBeDefined();
      expect(() => readFileSync(repoPath(component!.path), "utf-8")).not.toThrow();
    }
  });
});

// ============================================================================
// Coverage of the reference corpus
// ============================================================================

describe("reference corpus", () => {
  it("collects references from all three sources the repo authors", () => {
    const registry = loadRegistry();

    expect(registryComponentReferences(registry).length).toBeGreaterThan(0);
    expect(profileReferences(registry).length).toBeGreaterThan(0);
    expect(frontmatterReferences().length).toBeGreaterThan(0);
  });

  it("resolves every reference in the corpus", () => {
    const resolutions = resolveAll(allReferences());
    const notOk = resolutions.filter((r) => r.status !== "ok");

    expect(resolutions.length).toBeGreaterThan(200);
    expect(notOk, `unresolved references:${describeAll(notOk)}`).toEqual([]);
  });
});

// ============================================================================
// The shipped resolver (subtask 05) must agree with the oracle
// ============================================================================

const OWED_BY = "subtask 05 (src/core/ReferenceResolver.ts)";

describe("ReferenceResolver (shipped)", () => {
  it("exports a resolver", async () => {
    await importPendingSymbols(
      "src/core/ReferenceResolver.ts",
      ["ReferenceResolver"],
      OWED_BY,
      "the build has a real resolver rather than a test-local oracle"
    );
  });

  it("finds the same zero dead references the oracle finds", async () => {
    const { ReferenceResolver } = await importPendingSymbols<{
      ReferenceResolver: new (root: string) => {
        findDeadReferences(): Promise<{ ref: string; source: string }[]>;
      };
    }>(
      "src/core/ReferenceResolver.ts",
      ["ReferenceResolver"],
      OWED_BY,
      "the shipped resolver agrees with the oracle that the tree is clean — and therefore " +
        "catches what validate-registry.sh cannot"
    );

    const found = await new ReferenceResolver(repoPath()).findDeadReferences();

    expect(found).toEqual([]);
  });

  it("resolves a live reference to the component's real path on disk", async () => {
    const { ReferenceResolver } = await importPendingSymbols<{
      ReferenceResolver: new (root: string) => {
        resolve(ref: string): { ok: boolean; path?: string };
      };
    }>(
      "src/core/ReferenceResolver.ts",
      ["ReferenceResolver"],
      OWED_BY,
      "a good reference resolves to the file that backs it"
    );

    const result = new ReferenceResolver(repoPath()).resolve("context:mvi");

    expect(result.ok).toBe(true);
    expect(result.path).toBe(".opencode/context/core/context-system/standards/mvi.md");
  });

  it("reports a dead reference with its source and a reason, not just a boolean", async () => {
    const { ReferenceResolver } = await importPendingSymbols<{
      ReferenceResolver: new (root: string) => {
        resolve(ref: string): { ok: boolean; reason?: string };
      };
    }>(
      "src/core/ReferenceResolver.ts",
      ["ReferenceResolver"],
      OWED_BY,
      "a dead reference is reported with a diagnostic reason a human can act on"
    );

    const result = new ReferenceResolver(repoPath()).resolve("context:context-system/*");

    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/0 matches|expands to nothing|no .* match/i);
  });
});
