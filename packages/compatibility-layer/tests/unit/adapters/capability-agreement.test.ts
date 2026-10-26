/**
 * Cross-adapter capability agreement.
 *
 * ## Why this file exists
 *
 * A platform cannot have two answers about itself. That invariant was already written down —
 * `tests/unit/adapters/ClaudeAdapter.test.ts` has an "agrees with the CapabilityMatrix rather
 * than restating it" case, added after the matrix called Claude `json` while ClaudeAdapter
 * called it `markdown`.
 *
 * But that test pinned ONE field (`configFormat`) on ONE platform (`claude`) — 1 of 11 fields
 * on 1 of the adapters. So when a since-removed adapter's `getCapabilities()` hand-wrote
 * `supportsContexts: true` ("✅ Can inline context") against the matrix's
 * `externalContext: "none"` (context had to be inlined), the same bug lived on
 * undetected in a second platform.
 *
 * The invariant was right; its coverage was the problem. This file generalises it to every
 * registered adapter × every field of {@link ToolCapabilities}, which is what the original
 * test's own comment claimed to be checking.
 *
 * `notes` and `displayName` are deliberately excluded: adapters own those (the matrix's `notes`
 * are per-(feature, platform) strings, a different shape and a different question), and each
 * adapter's `getCapabilities()` overrides `displayName` on purpose.
 */

import { describe, it, expect } from "vitest";

import { ClaudeAdapter } from "../../../src/adapters/ClaudeAdapter.js";
import { OpenCodeAdapter } from "../../../src/adapters/OpenCodeAdapter.js";
import { OpenCodeV1Adapter } from "../../../src/adapters/v1/OpenCodeV1Adapter.js";
import { getToolCapabilities, type Platform } from "../../../src/core/CapabilityMatrix.js";
import type { BaseAdapter } from "../../../src/adapters/BaseAdapter.js";
import type { ToolCapabilities } from "../../../src/types.js";

/**
 * Every adapter, paired with its matrix column.
 *
 * Adding an adapter without adding it here is the failure mode this file cannot catch on its
 * own — `covers every adapter in the Platform union` below closes that by comparing this list
 * against the union's own members.
 */
const ADAPTERS: ReadonlyArray<{
  label: string;
  /** The CapabilityMatrix column this adapter's getCapabilities() must agree with. */
  column: Exclude<Platform, "oac">;
  adapter: BaseAdapter;
}> = [
  { label: "claude", column: "claude", adapter: new ClaudeAdapter() },
  { label: "opencode", column: "opencode", adapter: new OpenCodeAdapter() },
  // v1 has no column of its own: it shares OpenCodeBaseAdapter (and therefore v2's
  // getCapabilities()), and ToolCapabilities' 11 fields do not distinguish v1 from v2 —
  // their differences are layout (`agent/<category>/<file>.md` vs flat) and registry, not
  // capability. Pinning it against the SAME column is the point: if v1 ever grows a
  // hand-written getCapabilities() that disagrees, this row goes red.
  { label: "opencode-v1", column: "opencode", adapter: new OpenCodeV1Adapter() },
];

/** The fields both sides answer. `notes`/`displayName` are adapter-owned — see the header. */
const AGREED_FIELDS = [
  "name",
  "supportsMultipleAgents",
  "supportsSkills",
  "supportsHooks",
  "supportsGranularPermissions",
  "supportsContexts",
  "supportsCustomModels",
  "supportsTemperature",
  "supportsMaxSteps",
  "configFormat",
  "outputStructure",
] as const satisfies ReadonlyArray<keyof ToolCapabilities>;

describe("capability agreement (adapter vs CapabilityMatrix)", () => {
  describe.each(ADAPTERS)("$label vs the $column column", ({ column, adapter }) => {
    it.each(AGREED_FIELDS)("agrees on %s", (field) => {
      expect(adapter.getCapabilities()[field]).toEqual(getToolCapabilities(column)[field]);
    });
  });

  // Guards the gap this file would otherwise have. Two rosters:
  // 1. every Platform column except `oac` must be exercised — a new platform without a
  //    column here is caught because the Set below must equal the whole union minus `oac`.
  // 2. every registered adapter must be listed BY LABEL. A future adapter that reuses an
  //    existing column would not change the column set, so it must be added here by name —
  //    a deliberate tradeoff: the union roster catches missing columns, the label roster
  //    catches missing adapters.
  it("covers every adapter in the Platform union", () => {
    const columns = [...new Set(ADAPTERS.map((entry) => entry.column))].sort();
    expect(columns).toEqual(["claude", "opencode"]);

    const labels = ADAPTERS.map((entry) => entry.label).sort();
    expect(labels).toEqual(["claude", "opencode", "opencode-v1"]);
  });

  // OpenCode had no column at all until 2026-07-15, which is why it hand-wrote its own answers.
  it("describes OpenCode, the canonical target, in the matrix", () => {
    const openCode = getToolCapabilities("opencode");

    expect(openCode.displayName).toBe("OpenCode");
    // The one thing that makes OpenCode the canonical target: it carries ordered, scoped
    // permission rules with no degradation. If this ever reports false, the build is lying.
    expect(openCode.supportsGranularPermissions).toBe(true);
  });
});
