import { describe, expect, it } from "vitest";
import { allChecks } from "../../src/checks/index.ts";
import type { CheckDef } from "../../src/core/types.ts";

// U1, tests-first (component-p1-2.md): pins the real registry against the workload-declaration
// extension and the quick-tier retiering. The import of src/checks/index.ts is fs-read only —
// module evaluation builds the check table without probing hosts, spawning, or listening (the
// scenario table is derived from YAML under packages/compatibility-layer/src/verify/scenarios).
//
// Deliberately NOT asserted here: known-red.yaml content (this slice must not touch it, so no
// file-content pin exists to accidentally enforce or normalize it) and the dynamically generated
// scenario row ids beyond the code-level `scn/*@codex` sentinel.
//
// Red-green sequencing is owned by the orchestrator: the workload assertions below are expected
// to fail (and `check.workload` to be a typecheck error) until the U1 implementation adds the
// `workload: WorkloadDecl` field to CheckDef.
type WorkloadDecl =
  | "trusted-static"
  | "trusted-command"
  | "host-check"
  | "host-scenario"
  | "installer"
  | "deferred";

const QUICK_ADMITTED: readonly WorkloadDecl[] = ["trusted-static", "trusted-command"];
// Classes that must never run in the quick tier (host-free quick, enforced permanently).
const NOT_QUICK_ADMITTED: readonly WorkloadDecl[] = [
  "host-check",
  "host-scenario",
  "installer",
  "deferred",
];

// Every statically declared check id across the exported arrays of src/checks/*, read literally
// from each file's exported arrays at the time this slice was authored (39 ids):
// build.ts (8), gates.ts (2), oc-load.ts (2), cc-load.ts (5), scenarios.ts (1 static quick row),
// context.ts (3), evals.ts (5), installer.ts (10 across installerChecks/installerHostChecks/
// installerNetworkChecks), oc-agents.ts (3).
const PRESERVED_IDS: readonly string[] = [
  // buildChecks (build.ts)
  "build/compat-build",
  "build/compat-lint",
  "build/compat-test",
  "build/cli-typecheck",
  "build/cli-build",
  "build/cli-test",
  "build/canonical-drift",
  "build/detect-pr-changes",
  // gatesChecks (gates.ts)
  "gates/no-hidden-tools",
  "gates/subagent-keys-exist",
  // ocLoadStaticChecks + ocLoadHostChecks (oc-load.ts)
  "oc/no-v1-artifacts",
  "oc/config-sources",
  // ccLoadChecks + ccLoadHostChecks (cc-load.ts)
  "cc/plugin-validate",
  "cc/marketplace-validate",
  "cc/agent-dispatch-examples",
  "cc/plugin-load",
  "cc/sessionstart-payload",
  // scenarioQuickChecks (scenarios.ts static quick row)
  "scn/catalog-valid",
  // contextChecks (context.ts)
  "ctx/markdown-links",
  "ctx/registry",
  "ctx/context-refs",
  // installerChecks + installerHostChecks + installerNetworkChecks (installer.ts)
  "inst/shell-syntax",
  "inst/shellcheck",
  "inst/compatibility",
  "inst/install-sh-local",
  "inst/oac-init-doctor",
  "inst/init-boots-on-v2",
  "inst/doctor-flags-v2",
  "inst/install-sh-e2e",
  "inst/non-interactive",
  "inst/profile-smoke",
  // evalsChecks (evals.ts)
  "evals/build",
  "evals/test-ci",
  "evals/validate-suites",
  "evals/v2-unit",
  "evals/v2-typecheck",
  // ocAgentsChecks (oc-agents.ts)
  "oc/agents-boot",
  "oc/agents-tools-visible",
  "oc/flat-ids",
];

function registered(id: string): CheckDef {
  const found = allChecks.find((c) => c.id === id);
  if (!found) throw new Error(`check ${id} is no longer registered`);
  return found;
}

describe("registry: workload declarations (U1 CheckDef extension)", () => {
  it("gives every registered check a valid workload declaration", () => {
    // Arrange
    const offenders = allChecks
      .filter((c) => !QUICK_ADMITTED.includes(c.workload) && !NOT_QUICK_ADMITTED.includes(c.workload))
      .map((c) => `${c.id}: ${String(c.workload)}`);
    // Act
    const declared = offenders.length === 0;
    // Assert
    expect(declared, `checks without a valid workload declaration:\n${offenders.join("\n")}`).toBe(true);
  });

  it("registers no check with a host-check, host-scenario, installer or deferred class in the quick tier", () => {
    // Arrange
    const offenders = allChecks
      .filter((c) => c.tier === "quick" && NOT_QUICK_ADMITTED.includes(c.workload))
      .map((c) => `${c.id}: ${String(c.workload)} @ quick`);
    // Act
    const quickIsHostFree = offenders.length === 0;
    // Assert
    expect(quickIsHostFree, `host-class rows in quick:\n${offenders.join("\n")}`).toBe(true);
  });

  it("selects zero host-check, host-scenario or installer rows from the real registry at the quick tier", () => {
    // Arrange: the exact post-P1.2 invariant — quick admits trusted-static/trusted-command only.
    const quickRows = allChecks.filter((c) => c.tier === "quick");
    // Act
    const hostRows = quickRows.filter((c) => !QUICK_ADMITTED.includes(c.workload));
    // Assert
    expect(hostRows.map((c) => `${c.id}:${String(c.workload)}`)).toEqual([]);
  });
});

describe("registry: retiered ids pinned by the approved disposition table", () => {
  it("moves cc/plugin-validate and cc/marketplace-validate to hosts with the host-check class", () => {
    // Arrange
    const ids = ["cc/plugin-validate", "cc/marketplace-validate"];
    // Act + Assert
    for (const id of ids) {
      const check = registered(id);
      expect(check.workload, id).toBe("host-check");
      expect(check.tier, id).toBe("hosts");
    }
  });

  it("moves inst/install-sh-local and inst/oac-init-doctor to hosts with the installer class", () => {
    // Arrange
    const ids = ["inst/install-sh-local", "inst/oac-init-doctor"];
    // Act + Assert
    for (const id of ids) {
      const check = registered(id);
      expect(check.workload, id).toBe("installer");
      expect(check.tier, id).toBe("hosts");
    }
  });

  it("moves inst/compatibility to the all tier (all-only coverage) with the installer class", () => {
    // Arrange
    const check = registered("inst/compatibility");
    // Act + Assert
    expect(check.workload).toBe("installer");
    expect(check.tier).toBe("all");
  });

  it("keeps the deferred network placeholders out of quick and out of selection forever", () => {
    // Arrange
    const ids = ["inst/install-sh-e2e", "inst/non-interactive", "inst/profile-smoke"];
    // Act + Assert
    for (const id of ids) {
      const check = registered(id);
      expect(check.workload, id).toBe("deferred");
      expect(check.tier, id).not.toBe("quick");
    }
  });
});

describe("registry: preserved identities", () => {
  it("still registers every check id that existed before this slice", () => {
    // Arrange
    const registeredIds = new Set(allChecks.map((c) => c.id));
    // Act
    const missing = PRESERVED_IDS.filter((id) => !registeredIds.has(id));
    // Assert
    expect(missing).toEqual([]);
  });

  it("still registers the code-level scn/*@codex sentinel row for codex-listing scenarios", () => {
    // Arrange: scenarios.ts pushes the `scn/*@codex` skip row whenever any scenario YAML lists
    // the codex host; scenario YAML is frozen in this slice, so the sentinel must survive.
    const sentinel = allChecks.find((c) => c.id === "scn/*@codex");
    // Act
    const present = sentinel !== undefined;
    // Assert
    expect(present, "scn/*@codex sentinel row disappeared from the registry").toBe(true);
  });

  it("keeps every dynamically generated scenario row in the hosts tier", () => {
    // Arrange: scenario rows (area scenarios, ids derived from YAML) are host-scenario or
    // deferred class at hosts tier; the static quick row scn/catalog-valid is the only exception.
    const scenarioRows = allChecks.filter((c) => c.area === "scenarios" && c.id !== "scn/catalog-valid");
    // Act
    const nonHosts = scenarioRows.filter((c) => c.tier !== "hosts");
    // Assert
    expect(nonHosts.map((c) => `${c.id}:${c.tier}`)).toEqual([]);
  });
});
