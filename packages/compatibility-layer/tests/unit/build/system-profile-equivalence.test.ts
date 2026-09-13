/**
 * Equivalence gate: the canonical profiles in `content/profiles/**` must reconstruct the
 * legacy `registry.json` `.profiles.*.components` lists EXACTLY.
 *
 * ─── Why this test exists ───────────────────────────────────────────────────────────────
 *
 * Seeding `content/profiles/**` was a translation of the legacy hand-maintained lists, and
 * any translation can silently drop or invent a component. The registry emitter generates
 * `.profiles` from canonical content, while `install.sh` reads the generated registry. If they
 * ever disagree, the build would ship two different products.
 *
 * This test is the drift alarm for that window. It fails the moment someone edits one side
 * without the other — which is precisely the failure mode that put 51-vs-68-component drift
 * into every legacy profile.
 *
 * ─── The two sanctioned translations ────────────────────────────────────────────────────
 *
 * 1. `subagent:` refs are authored under `agents` (the canonical tree collapses them), and
 *    are mapped back to their registry category here.
 *
 * Context wildcards (`context:core/*` and friends) are NOT a translation: they are
 * load-bearing legacy semantics — a directory subscription that also installs future
 * files — so they are authored verbatim in the canonical bundles and compared literally
 * here. Expansion happens at emission/install time, never in the authored source.
 */

import { describe, expect, it } from "vitest";
import { ProfileLoader } from "../../../src/core/ProfileLoader.js";
import { ReferenceResolver } from "../../../src/core/ReferenceResolver.js";
import { repoPath } from "../../support/pending.js";

const PROFILES = ["advanced", "business", "developer", "essential", "full"] as const;

/** Registry category for an id under the collapsed `agents` field, or null. */
function agentCategory(id: string, registry: ReturnType<ReferenceResolver["registry"]>): string | null {
  if (registry.components.agents.some((a) => a.id === id)) return "agent";
  if (registry.components.subagents.some((s) => s.id === id)) return "subagent";
  return null;
}

describe("canonical profile equivalence", () => {
  const root = repoPath();
  const loader = new ProfileLoader(root);
  const resolver = new ReferenceResolver(root);
  const registry = resolver.registry();

  it.each(PROFILES)(
    "content/profiles/system/%s.json reconstructs registry.profiles.%s.components exactly",
    async (name) => {
      // Arrange
      const resolved = await loader.resolveSystemProfile(name);
      const legacy = registry.profiles[name]?.components ?? [];

      // Act — map the canonical resolution back to typed refs
      const canonical: string[] = [];
      for (const id of resolved.agents) {
        const category = agentCategory(id, registry);
        expect(category, `agent id "${id}" exists in neither registry category`).not.toBeNull();
        canonical.push(`${category}:${id}`);
      }
      for (const id of resolved.contexts) canonical.push(`context:${id}`);
      for (const id of resolved.commands) canonical.push(`command:${id}`);
      for (const id of resolved.tools) canonical.push(`tool:${id}`);
      for (const id of resolved.skills) canonical.push(`skill:${id}`);
      for (const id of resolved.plugins) canonical.push(`plugin:${id}`);
      for (const id of resolved.config) canonical.push(`config:${id}`);

      // Assert — set equality, order-insensitive on both sides
      expect([...new Set(canonical)].sort()).toEqual([...new Set(legacy)].sort());
    }
  );

  it("covers every legacy profile — no profile exists only on one side", () => {
    // Arrange
    const canonical = ["advanced", "business", "developer", "essential", "full"];

    // Act
    const legacy = Object.keys(registry.profiles).sort();

    // Assert
    expect(legacy).toEqual(canonical);
  });
});
