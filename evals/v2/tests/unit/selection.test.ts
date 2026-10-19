import { describe, expect, it } from "vitest";
import { select, type CheckLike, type Selection, type SelectionArgs } from "../../src/core/selection.ts";
import { TIER_ORDER, type Tier } from "../../src/core/types.ts";

// U1, tests-first (component-p1-2.md): pure unit tests for the planned src/core/selection.ts.
// No registry import, no fs, no CLI, no mocks of effects — selection is a pure function over
// data, so these tests exercise it directly (AAA per test).
//
// WorkloadDecl is declared here as the planned narrow union; after U1 the same union lives in
// core/types.ts and the implementation's CheckLike must accept exactly these values. Only
// `Tier` (type) and `TIER_ORDER` (value) are imported from core/types.ts. The implementation
// must export: select, CheckLike, Selection, SelectionArgs.
type WorkloadDecl =
  | "trusted-static"
  | "trusted-command"
  | "host-check"
  | "host-scenario"
  | "installer"
  | "deferred";

const HOST_CLASSES: readonly WorkloadDecl[] = ["host-check", "host-scenario", "installer"];

function check(id: string, tier: Tier, workload: WorkloadDecl): CheckLike {
  return { id, tier, workload };
}

function args(overrides: Partial<SelectionArgs> = {}): SelectionArgs {
  return { tier: "quick", ...overrides };
}

const ids = (selected: readonly CheckLike[]): string[] => selected.map((c) => c.id);

function exclusionReason(rows: Selection["excluded"], id: string): string {
  const row = rows.find((r) => r.id === id);
  if (!row) throw new Error(`expected an exclusion row for ${id}`);
  return row.reason;
}

function refusalReason(rows: Selection["refusals"], checkId: string): string {
  const row = rows.find((r) => r.checkId === checkId);
  if (!row) throw new Error(`expected a refusal for ${checkId}`);
  return row.reason;
}

// Mirrors the post-P1.2 registry shape: quick rows are trusted; the retiered rows
// (cc/plugin-validate, inst/install-sh-local) moved to hosts; network placeholders are deferred.
const REGISTRY_FIXTURE: readonly CheckLike[] = [
  check("build/compat-build", "quick", "trusted-command"),
  check("cc/agent-dispatch-examples", "quick", "trusted-static"),
  check("cc/plugin-validate", "hosts", "host-check"),
  check("inst/install-sh-local", "hosts", "installer"),
  check("oc/config-sources", "hosts", "host-check"),
  check("inst/install-sh-e2e", "all", "deferred"),
];

// One synthetic row per tier so the upper-bound rule can be pinned against TIER_ORDER itself.
const PER_TIER_FIXTURE: readonly CheckLike[] = [
  check("synthetic/quick-row", "quick", "trusted-static"),
  check("synthetic/hosts-row", "hosts", "host-check"),
  check("synthetic/live-row", "live", "trusted-command"),
  check("synthetic/all-row", "all", "installer"),
];

describe("select: tier is an upper bound", () => {
  it("selects every check whose tier is at or below the requested tier, in input order", () => {
    // Arrange
    const requested = args({ tier: "hosts" });
    // Act
    const result = select(REGISTRY_FIXTURE, requested, []);
    // Assert
    expect(ids(result.selected)).toEqual([
      "build/compat-build",
      "cc/agent-dispatch-examples",
      "cc/plugin-validate",
      "inst/install-sh-local",
      "oc/config-sources",
    ]);
    expect(result.selected.every((c) => c.tier !== "all")).toBe(true);
  });

  it("excludes checks above the requested tier with a non-blank reason", () => {
    // Arrange
    const requested = args({ tier: "quick" });
    // Act
    const result = select(REGISTRY_FIXTURE, requested, []);
    // Assert
    expect(ids(result.selected)).toEqual(["build/compat-build", "cc/agent-dispatch-examples"]);
    expect(exclusionReason(result.excluded, "cc/plugin-validate").trim().length).toBeGreaterThan(0);
    expect(exclusionReason(result.excluded, "inst/install-sh-e2e").trim().length).toBeGreaterThan(0);
  });

  it.each(
    TIER_ORDER.map((tier, index) => ({
      tier,
      expected: TIER_ORDER.slice(0, index + 1).map((t) => `synthetic/${t}-row`),
    })),
  )("admits exactly the tiers up to and including $tier", ({ tier, expected }) => {
    // Arrange
    const requested = args({ tier });
    // Act
    const result = select(PER_TIER_FIXTURE, requested, []);
    // Assert
    expect(ids(result.selected)).toEqual(expected);
  });
});

describe("select: --only narrows by id prefix and never widens the tier bound", () => {
  it("narrows selection to checks whose id starts with the --only prefix", () => {
    // Arrange
    const requested = args({ tier: "all", only: "cc/" });
    // Act
    const result = select(REGISTRY_FIXTURE, requested, []);
    // Assert
    expect(ids(result.selected)).toEqual(["cc/agent-dispatch-examples", "cc/plugin-validate"]);
    expect(exclusionReason(result.excluded, "build/compat-build").trim().length).toBeGreaterThan(0);
    expect(exclusionReason(result.excluded, "oc/config-sources").trim().length).toBeGreaterThan(0);
  });

  it("cannot widen the tier bound when --only matches a higher-tier id", () => {
    // Arrange
    const requested = args({ tier: "quick", only: "cc/" });
    // Act
    const result = select(REGISTRY_FIXTURE, requested, []);
    // Assert
    expect(ids(result.selected)).toEqual(["cc/agent-dispatch-examples"]);
    expect(result.selected.some((c) => c.id === "cc/plugin-validate")).toBe(false);
    expect(exclusionReason(result.excluded, "cc/plugin-validate").trim().length).toBeGreaterThan(0);
  });

  it("reports --only misses as exclusions so an empty selection stays visible", () => {
    // Arrange
    const requested = args({ tier: "all", only: "zzz/no-such-prefix/" });
    // Act
    const result = select(REGISTRY_FIXTURE, requested, []);
    // Assert
    expect(result.selected).toEqual([]);
    expect(result.excluded).toHaveLength(REGISTRY_FIXTURE.length);
    expect(result.excluded.every((row) => row.reason.trim().length > 0)).toBe(true);
  });
});

describe("select: rerunFailed restricts selection to the failed ids (data param)", () => {
  it("selects exactly the failed checks that also pass the tier bound", () => {
    // Arrange
    const requested = args({ tier: "all", rerunFailed: true });
    const failedIds = ["cc/agent-dispatch-examples", "oc/config-sources"] as const;
    // Act
    const result = select(REGISTRY_FIXTURE, requested, failedIds);
    // Assert
    expect(ids(result.selected)).toEqual(["cc/agent-dispatch-examples", "oc/config-sources"]);
  });

  it("keeps the tier bound and --only narrowing applied on top of the failed ids", () => {
    // Arrange
    const requested = args({ tier: "quick", only: "cc/", rerunFailed: true });
    const failedIds = ["cc/agent-dispatch-examples", "cc/plugin-validate"] as const;
    // Act
    const result = select(REGISTRY_FIXTURE, requested, failedIds);
    // Assert
    expect(ids(result.selected)).toEqual(["cc/agent-dispatch-examples"]);
    expect(exclusionReason(result.excluded, "cc/plugin-validate").trim().length).toBeGreaterThan(0);
  });

  it("reports failed ids that match no registered check as exclusions with a reason", () => {
    // Arrange
    const requested = args({ tier: "all", rerunFailed: true });
    const failedIds = ["ghost/never-registered"] as const;
    // Act
    const result = select(REGISTRY_FIXTURE, requested, failedIds);
    // Assert
    expect(result.selected).toEqual([]);
    expect(exclusionReason(result.excluded, "ghost/never-registered").trim().length).toBeGreaterThan(0);
  });
});

describe("select: quick admits only trusted declarations — host classes are refused, never silently skipped", () => {
  it("selects trusted-static and trusted-command rows in a quick selection", () => {
    // Arrange
    const checks = [
      check("gates/no-hidden-tools", "quick", "trusted-static"),
      check("build/compat-build", "quick", "trusted-command"),
    ];
    // Act
    const result = select(checks, args({ tier: "quick" }), []);
    // Assert
    expect(ids(result.selected)).toEqual(["gates/no-hidden-tools", "build/compat-build"]);
    expect(result.refusals).toEqual([]);
  });

  it.each(HOST_CLASSES)(
    "refuses a %s row presented in a quick selection and never selects or excludes it",
    (workload) => {
      // Arrange: tier "quick" means the row would pass the tier bound; only the workload
      // gate stops it. (The real registry must never contain such a row — registry.test.ts
      // enforces that; this pins the gate itself.)
      const checks = [check("synthetic/quick-host-row", "quick", workload)];
      // Act
      const result = select(checks, args({ tier: "quick" }), []);
      // Assert
      expect(result.selected).toEqual([]);
      expect(refusalReason(result.refusals, "synthetic/quick-host-row").trim().length).toBeGreaterThan(0);
      expect(result.excluded).toEqual([]);
    },
  );

  it("excludes host-class rows above the quick tier bound with a visible reason (moved ids: zero launch)", () => {
    // Arrange: the real registry shape — the retiered rows are hosts-tier, so in quick they
    // are ordinary tier-bound exclusions with a reason, and nothing is launched.
    const requested = args({ tier: "quick" });
    // Act
    const result = select(REGISTRY_FIXTURE, requested, []);
    // Assert
    expect(result.selected.every((c) => !HOST_CLASSES.includes(c.workload))).toBe(true);
    expect(exclusionReason(result.excluded, "cc/plugin-validate").trim().length).toBeGreaterThan(0);
    expect(exclusionReason(result.excluded, "inst/install-sh-local").trim().length).toBeGreaterThan(0);
    expect(result.refusals).toEqual([]);
  });

  it("selects host-class rows at higher tiers — the workload gate is quick-only", () => {
    // Arrange
    const requested = args({ tier: "hosts" });
    // Act
    const result = select(REGISTRY_FIXTURE, requested, []);
    // Assert
    expect(ids(result.selected)).toContain("cc/plugin-validate");
    expect(ids(result.selected)).toContain("inst/install-sh-local");
    expect(result.refusals).toEqual([]);
  });
});

describe("select: deferred rows never run", () => {
  it("never selects deferred rows and reports them as excluded with a reason", () => {
    // Arrange
    const requested = args({ tier: "all" });
    // Act
    const result = select(REGISTRY_FIXTURE, requested, []);
    // Assert
    expect(ids(result.selected)).not.toContain("inst/install-sh-e2e");
    expect(exclusionReason(result.excluded, "inst/install-sh-e2e").trim().length).toBeGreaterThan(0);
    expect(result.refusals).toEqual([]);
  });
});

describe("select: unknown or missing workload declarations are refused per row", () => {
  it("refuses a check whose workload declaration is not a known WorkloadDecl", () => {
    // Arrange: simulate registry drift (an undeclared workload string) without weakening the
    // declared CheckLike type everywhere else.
    const undeclared = { id: "synthetic/undeclared", tier: "quick", workload: "repo-wide-mutation" } as unknown as CheckLike;
    // Act
    const result = select([undeclared], args({ tier: "quick" }), []);
    // Assert
    expect(result.selected).toEqual([]);
    expect(refusalReason(result.refusals, "synthetic/undeclared").trim().length).toBeGreaterThan(0);
    expect(result.excluded).toEqual([]);
  });

  it("refuses a check with a missing workload declaration", () => {
    // Arrange
    const undecorated = { id: "synthetic/undecorated", tier: "quick" } as unknown as CheckLike;
    // Act
    const result = select([undecorated], args({ tier: "quick" }), []);
    // Assert
    expect(result.selected).toEqual([]);
    expect(refusalReason(result.refusals, "synthetic/undecorated").trim().length).toBeGreaterThan(0);
    expect(result.excluded).toEqual([]);
  });
});

describe("select: result shape and purity", () => {
  it("allows an empty selection for an empty check list", () => {
    // Arrange
    const requested = args({ tier: "quick" });
    // Act
    const result = select([], requested, []);
    // Assert
    expect(result).toEqual({ selected: [], excluded: [], refusals: [] });
  });

  it("does not change selection when --strict or --ci are set", () => {
    // Arrange
    const plain = args({ tier: "all" });
    const flagged = args({ tier: "all", strict: true, ci: true });
    // Act
    const unflagged = select(REGISTRY_FIXTURE, plain, []);
    const strictCi = select(REGISTRY_FIXTURE, flagged, []);
    // Assert
    expect(strictCi).toEqual(unflagged);
  });

  it("gives every exclusion and refusal a non-blank reason across a mixed run", () => {
    // Arrange: undeclared drift row guarantees the run also produces refusals, so the
    // reason-blankness invariant is exercised on both arrays (not vacuously).
    const undeclared = { id: "synthetic/undeclared", tier: "quick", workload: "repo-wide-mutation" } as unknown as CheckLike;
    const requested = args({ tier: "quick", only: "cc/", rerunFailed: true });
    const failedIds = ["cc/plugin-validate", "ghost/missing"] as const;
    // Act
    const result = select([...REGISTRY_FIXTURE, undeclared], requested, failedIds);
    // Assert
    expect(result.excluded.length).toBeGreaterThan(0);
    expect(result.refusals.length).toBeGreaterThan(0);
    expect(result.excluded.every((row) => row.reason.trim().length > 0)).toBe(true);
    expect(result.refusals.every((row) => row.reason.trim().length > 0)).toBe(true);
  });

  it("does not mutate the checks, args or failedIds inputs", () => {
    // Arrange
    const checks = REGISTRY_FIXTURE.map((c) => ({ ...c }));
    const requested = args({ tier: "quick", only: "cc/", rerunFailed: true, strict: true, ci: true });
    const failedIds = ["cc/agent-dispatch-examples", "ghost/missing"];
    const before = JSON.stringify({ checks, requested, failedIds });
    // Act
    select(checks, requested, failedIds);
    // Assert
    expect(JSON.stringify({ checks, requested, failedIds })).toBe(before);
  });
});
