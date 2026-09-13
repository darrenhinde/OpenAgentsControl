/**
 * Profile completeness — every profile's transitive closure must be installable.
 *
 * A profile is a promise: "install `developer` and you get a working set". That promise is
 * only kept if every component the profile names resolves, AND every dependency of those
 * components resolves, recursively. A profile that names a live component which depends on a
 * dead one is just as broken as a profile that names the dead one directly — the install
 * fails at the same point, one level deeper.
 *
 * `validate-registry.sh` checks NEITHER half of this: it never reads `.profiles.*` at all
 * (see reference-resolution.test.ts), which is how a dead `context:context-system/*` sat in
 * the `advanced` profile expanding to zero components — until repaired 2026-07-17 to
 * `context:core/context-system/*` — while the validator printed 244/244 green. These tests
 * are the only thing that would catch the next one.
 */

import { describe, it, expect } from "vitest";
import {
  format,
  loadRegistry,
  profileReferences,
  resolveAll,
  type Reference,
  type Registry,
} from "../../support/references.js";
import { importPendingSymbols, repoPath } from "../../support/pending.js";

const PROFILES = ["advanced", "business", "developer", "essential", "full"] as const;

function refsFor(profile: string, registry: Registry): Reference[] {
  return profileReferences(registry).filter((reference) =>
    reference.source.endsWith(`profiles.${profile}.components`)
  );
}

/**
 * Expand a profile to its transitive closure of registry ids, following each component's
 * declared `dependencies`. Cycles terminate on the `seen` set.
 */
function closure(profile: string, registry: Registry): { ids: Set<string>; refs: Reference[] } {
  const byRef = new Map<string, { dependencies?: string[] }>();
  for (const [category, components] of Object.entries(registry.components)) {
    // agents -> agent, contexts -> context, ... and `config` (already singular) stays put.
    const type = category.replace(/s$/, "");
    for (const component of components) byRef.set(`${type}:${component.id}`, component);
  }

  const ids = new Set<string>();
  const refs: Reference[] = [];
  const queue = refsFor(profile, registry);

  while (queue.length > 0) {
    const reference = queue.shift()!;
    if (ids.has(reference.ref)) continue;
    ids.add(reference.ref);
    refs.push(reference);

    for (const dependency of byRef.get(reference.ref)?.dependencies ?? []) {
      queue.push({
        ref: dependency,
        source: `${reference.source} -> ${reference.ref} depends on`,
      });
    }
  }

  return { ids, refs };
}

// ============================================================================
// Green today — the profile corpus, and the closure minus the one known hole
// ============================================================================

describe("profiles", () => {
  it("registry carries exactly the 5 profiles on disk", () => {
    expect(Object.keys(loadRegistry().profiles).sort()).toEqual([...PROFILES].sort());
  });

  it.each(PROFILES)("%s names at least one component", (profile) => {
    expect(refsFor(profile, loadRegistry()).length).toBeGreaterThan(0);
  });

  it.each(PROFILES)("%s resolves every component it names", (profile) => {
    const registry = loadRegistry();
    const dead = resolveAll(refsFor(profile, registry), registry).filter(
      (resolution) => resolution.status !== "ok"
    );

    expect(dead, `${profile} names components that do not exist:\n${format(dead)}`).toEqual([]);
  });

  it.each(PROFILES)("%s has an installable transitive closure", (profile) => {
    const registry = loadRegistry();
    const { refs } = closure(profile, registry);
    const dead = resolveAll(refs, registry).filter((resolution) => resolution.status !== "ok");

    expect(
      dead,
      `${profile}'s closure reaches components that do not exist — installing it would fail:\n${format(dead)}`
    ).toEqual([]);
  });

  it("the closure is strictly larger than the named set for at least one profile", () => {
    // Guards the test itself: if dependency-following silently did nothing, every closure
    // would equal its profile's own list and these tests would prove much less than they read.
    const registry = loadRegistry();
    const grew = PROFILES.some(
      (profile) => closure(profile, registry).ids.size > refsFor(profile, registry).length
    );

    expect(grew, "closure() followed no dependencies — it is not testing transitivity").toBe(true);
  });
});

// ============================================================================
// RED — the shipped profile loader (subtask 05)
// ============================================================================

const OWED_BY = "subtask 05 (src/core/ProfileLoader.ts)";

describe("ProfileLoader (shipped)", () => {
  it("loads all 5 profiles", async () => {
    const { ProfileLoader } = await importPendingSymbols<{
      ProfileLoader: new (root: string) => { list(): Promise<string[]> };
    }>(
      "src/core/ProfileLoader.ts",
      ["ProfileLoader"],
      OWED_BY,
      "the build can enumerate the 5 profiles rather than hard-coding them"
    );

    expect((await new ProfileLoader(repoPath()).list()).sort()).toEqual([...PROFILES].sort());
  });

  it.each(PROFILES)("reports %s's closure as installable", async (profile) => {
    const { ProfileLoader } = await importPendingSymbols<{
      ProfileLoader: new (root: string) => {
        resolveClosure(profile: string): Promise<{ missing: { ref: string }[] }>;
      };
    }>(
      "src/core/ProfileLoader.ts",
      ["ProfileLoader"],
      OWED_BY,
      `every component in ${profile}'s transitive closure resolves, so installing it works`
    );

    const { missing } = await new ProfileLoader(repoPath()).resolveClosure(profile);

    expect(missing).toEqual([]);
  });
});
