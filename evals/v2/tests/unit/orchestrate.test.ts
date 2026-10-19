import { describe, expect, it } from "vitest";
import {
  classify,
  decideExit,
  envScrubLabel,
  orchestrate,
  plan,
  type OrchestratorDeps,
} from "../../src/core/orchestrate.ts";
import type { Selection } from "../../src/core/selection.ts";
import type {
  CheckDef,
  CheckOutcome,
  CheckRow,
  RunContext,
  Tier,
  WorkloadDecl,
} from "../../src/core/types.ts";

// U2, tests-first (component-p1-2.md): unit tests for the planned src/core/orchestrate.ts.
// The module does not exist yet, so this suite is red until the U2 implementation lands —
// the same tests-first pattern selection.test.ts used for U1.
//
// The implementation must export exactly:
//   plan(selection: Selection): readonly PlanRow[]
//     PlanRow = { kind: "run"; check: CheckLike; logRel: string }
//             | { kind: "refused"; checkId: string; reason: string }
//   classify(outcome: CheckOutcome, known: { ref: string; note: string; until?: string } | undefined,
//            strict: boolean, safetyRefused: boolean): Status
//   decideExit(rows: readonly Pick<CheckRow, "status">[], breaches: readonly string[],
//              refusals: readonly unknown[]): 0 | 1 | 3
//   orchestrate(deps: OrchestratorDeps): Promise<number>
//     OrchestratorDeps = { argv, checks, failedIds, knownRed, pins, repo, tmpRoot, runId,
//                          hostVersion, runSelfTests, runCheck, makeCtx, collectBreaches,
//                          persist, say, usage, now }
//
// Deliberately NOT covered here:
// - selection semantics (tier bound, --only, rerun, workload gates): covered in
//   selection.test.ts; these tests only pin that orchestrate CALLS select() correctly
//   with its inputs and honors its output.
// - authorize/dispatch launch-funnel gating (backendFactory/authorize wiring), the
//   CLI-import-side-effect-free test (cli.ts is not imported here — it stays the entry
//   and is not yet rewired), and the cmdCheck host-class gate: all belong to U3 tests
//   when the launch funnel is actually guarded.
//
// Everything is data-in/data-out with injected effect mocks: no fs, no network, no
// process.exit, no registry import, no clocks. AAA per test.

class UsageExit extends Error {
  readonly code: number;
  constructor(code: number, msg?: string) {
    super(msg ?? "usage");
    this.code = code;
  }
}

/** Minimal CheckDef fixture; `run` is a no-op because the loop calls the injected runCheck. */
function def(id: string, tier: Tier, workload: WorkloadDecl, overrides: Partial<CheckDef> = {}): CheckDef {
  return {
    id,
    area: "build",
    layer: "L0",
    tier,
    workload,
    run: async (): Promise<CheckOutcome> => ({ ok: true }),
    ...overrides,
  };
}

// Mirrors the post-P1.2 registry shape: quick rows are trusted; host/installer rows live at
// hosts; deferred rows never run at any tier.
const DEFAULT_CHECKS: readonly CheckDef[] = [
  def("build/one", "quick", "trusted-static"),
  def("build/two", "quick", "trusted-command"),
  def("cc/host-row", "hosts", "host-check", { area: "cc-load" }),
  def("inst/deferred", "all", "deferred", { area: "installer" }),
];

function makeCtx(check: CheckDef): RunContext {
  return {
    repo: "/repo",
    runDir: "/run/dir",
    tmpRoot: "/tmp/oac-throwaway",
    runId: "261019000000",
    tier: "quick",
    log: () => {},
    logPath: `/run/dir/logs/${check.id}.log`,
    artifactDir: () => "/run/dir/artifacts",
    shared: new Map<string, unknown>(),
  };
}

interface Harness {
  /** Ordered event log across every injected effect (e.g. "hostVersion:opencode", "check:build/one"). */
  readonly calls: string[];
  readonly said: readonly string[];
  readonly persisted: readonly CheckRow[];
  readonly runCheckCalls: readonly { check: CheckDef; ctx: RunContext }[];
  readonly ctxByCheck: ReadonlyMap<string, RunContext>;
  readonly deps: OrchestratorDeps;
}

/** Scripted shape of one injected selftest result (structurally the legacy SelfTest). */
interface SelfTestFixture {
  readonly name: string;
  readonly ok: boolean;
  readonly detail: string;
}

/**
 * Builds a full OrchestratorDeps mock. Every effect records an ordered event in `calls`,
 * so ordering (probes before checks, breaches after checks) is assertable. `outcomes`
 * (keyed by check id) scripts what runCheck returns or throws per check,
 * `selfTestResults` scripts the injected selftest results, and `breaches` scripts what
 * collectBreaches observes — all without replacing the recording behavior.
 */
function harness(
  overrides: Partial<OrchestratorDeps> = {},
  outcomes?: Readonly<Record<string, CheckOutcome | Error>>,
  selfTestResults?: readonly SelfTestFixture[],
  breaches?: readonly string[],
): Harness {
  const calls: string[] = [];
  const said: string[] = [];
  const persisted: CheckRow[] = [];
  const runCheckCalls: { check: CheckDef; ctx: RunContext }[] = [];
  const ctxByCheck = new Map<string, RunContext>();
  let tick = 1_000_000;

  const deps: OrchestratorDeps = {
    argv: ["quick"],
    checks: DEFAULT_CHECKS,
    failedIds: [],
    knownRed: {},
    pins: { opencode: "2.0.30", claude: "2.1.302" },
    repo: "/repo",
    tmpRoot: "/tmp/oac-throwaway",
    runId: "261019000000",
    hostVersion: (bin: string) => {
      calls.push(`hostVersion:${bin}`);
      return Promise.resolve("1.0.0");
    },
    runSelfTests: (repo: string, tmpRoot: string, runId: string) => {
      calls.push(`selftest:${repo}|${tmpRoot}|${runId}`);
      return Promise.resolve([...(selfTestResults ?? [{ name: "env-scrub", ok: true, detail: "all names allowlisted" }])]);
    },
    runCheck: (check: CheckDef, ctx: RunContext) => {
      calls.push(`check:${check.id}`);
      runCheckCalls.push({ check, ctx });
      const scripted = outcomes?.[check.id];
      if (scripted instanceof Error) return Promise.reject(scripted);
      return Promise.resolve(scripted ?? { ok: true });
    },
    makeCtx: (check: CheckDef) => {
      const ctx = makeCtx(check);
      ctxByCheck.set(check.id, ctx);
      return ctx;
    },
    collectBreaches: () => {
      calls.push("collectBreaches");
      return [...(breaches ?? [])];
    },
    persist: (row: CheckRow) => {
      calls.push(`persist:${row.id}`);
      persisted.push(row);
    },
    say: (line: string) => {
      said.push(line);
    },
    usage: (msg?: string): never => {
      throw new UsageExit(2, msg);
    },
    now: () => (tick += 7),
    ...overrides,
  };

  return { calls, said, persisted, runCheckCalls, ctxByCheck, deps };
}

/** Counts the launch-relevant effects so "zero calls" assertions read plainly. */
function effectCounts(h: Harness): { hostVersion: number; selfTests: number; checks: number } {
  return {
    hostVersion: h.calls.filter((c) => c.startsWith("hostVersion:")).length,
    selfTests: h.calls.filter((c) => c.startsWith("selftest:")).length,
    checks: h.calls.filter((c) => c.startsWith("check:")).length,
  };
}

function runCheckIds(h: Harness): string[] {
  return h.runCheckCalls.map((c) => c.check.id);
}

// ---------------------------------------------------------------------------
// orchestrate: usage guards (--strict-sandbox / --budget / live) exit 2 before any effect
// ---------------------------------------------------------------------------

describe("orchestrate: --strict-sandbox/--budget and the live tier exit 2 via usage before any effect", () => {
  it.each([
    ["--strict-sandbox"],
    ["--sandbox=container"],
    ["--budget"],
    ["--budget=100"],
  ])("rejects via usage for argv %s with zero host probes, zero selftests, zero checks", async (flag) => {
    // Arrange
    const h = harness({ argv: [flag] });
    let caught: unknown;
    // Act
    try {
      await orchestrate(h.deps);
    } catch (e) {
      caught = e;
    }
    // Assert: usage() is the exit-2 mechanism; it fired before any launch-relevant effect.
    expect(caught).toBeInstanceOf(UsageExit);
    expect((caught as UsageExit).code).toBe(2);
    expect(effectCounts(h)).toEqual({ hostVersion: 0, selfTests: 0, checks: 0 });
    expect(h.persisted).toEqual([]);
  });

  it("rejects via usage for the live tier with zero effects", async () => {
    // Arrange
    const h = harness({ argv: ["live"] });
    let caught: unknown;
    // Act
    try {
      await orchestrate(h.deps);
    } catch (e) {
      caught = e;
    }
    // Assert
    expect(caught).toBeInstanceOf(UsageExit);
    expect((caught as UsageExit).code).toBe(2);
    expect(effectCounts(h)).toEqual({ hostVersion: 0, selfTests: 0, checks: 0 });
  });
});

// ---------------------------------------------------------------------------
// orchestrate: selection honored (select() is called with the deps' data and its output drives the loop)
// ---------------------------------------------------------------------------

describe("orchestrate: selection drives the run loop", () => {
  it("quick performs ZERO host version probes and ZERO selftests while still running the quick checks", async () => {
    // Arrange
    const h = harness({ argv: ["quick"] });
    // Act
    const code = await orchestrate(h.deps);
    // Assert
    expect(effectCounts(h)).toEqual({ hostVersion: 0, selfTests: 0, checks: 2 });
    expect(runCheckIds(h)).toEqual(["build/one", "build/two"]);
    expect(code).toBe(0);
  });

  it("hosts tier probes each host version exactly once and runs the selftest exactly once, all before the first check", async () => {
    // Arrange
    const h = harness({ argv: ["hosts"] });
    // Act
    await orchestrate(h.deps);
    // Assert
    expect(effectCounts(h)).toEqual({ hostVersion: 2, selfTests: 1, checks: 3 });
    expect(h.calls.filter((c) => c === "hostVersion:opencode").length).toBe(1);
    expect(h.calls.filter((c) => c === "hostVersion:claude").length).toBe(1);
    const firstCheck = h.calls.findIndex((c) => c.startsWith("check:"));
    expect(firstCheck).toBeGreaterThan(-1);
    expect(h.calls.indexOf("hostVersion:opencode")).toBeLessThan(firstCheck);
    expect(h.calls.indexOf("hostVersion:claude")).toBeLessThan(firstCheck);
    expect(h.calls.findIndex((c) => c.startsWith("selftest:"))).toBeLessThan(firstCheck);
  });

  it("passes the injected repo/tmpRoot/runId through to runSelfTests", async () => {
    // Arrange
    const h = harness({ argv: ["hosts"] });
    // Act
    await orchestrate(h.deps);
    // Assert
    expect(h.calls).toContain("selftest:/repo|/tmp/oac-throwaway|261019000000");
  });

  it("honors --only narrowing produced by select (only the prefix-matching check runs)", async () => {
    // Arrange
    const h = harness({ argv: ["hosts", "--only", "cc/"] });
    // Act
    await orchestrate(h.deps);
    // Assert
    expect(runCheckIds(h)).toEqual(["cc/host-row"]);
  });

  it("honors --rerun-failed as data: only the failed ids run", async () => {
    // Arrange
    const h = harness({ argv: ["hosts", "--rerun-failed"], failedIds: ["build/two"] });
    // Act
    await orchestrate(h.deps);
    // Assert
    expect(runCheckIds(h)).toEqual(["build/two"]);
  });

  it("never runs a deferred row, even at the all tier", async () => {
    // Arrange
    const h = harness({ argv: ["all"] });
    // Act
    await orchestrate(h.deps);
    // Assert
    expect(runCheckIds(h)).not.toContain("inst/deferred");
    expect(runCheckIds(h)).toEqual(["build/one", "build/two", "cc/host-row"]);
  });
});

// ---------------------------------------------------------------------------
// orchestrate: probed versions feed the pins line
// ---------------------------------------------------------------------------

describe("orchestrate: version probe results feed the pins line via say", () => {
  const joined = (h: Harness): string => h.said.join("\n");

  it("marks a host whose probed version matches the pin as ✓", async () => {
    // Arrange: both probes return exactly the pinned versions.
    const h = harness({
      argv: ["hosts"],
      hostVersion: (bin: string) => Promise.resolve(bin === "opencode" ? "2.0.30" : "2.1.302"),
    });
    // Act
    await orchestrate(h.deps);
    // Assert
    expect(joined(h)).toContain("2.0.30 (pin 2.0.30 ✓");
    expect(joined(h)).not.toContain("drift");
  });

  it("marks a host whose probed version drifts from the pin with a drift marker", async () => {
    // Arrange
    const h = harness({ argv: ["hosts"] }); // mock probes return 1.0.0, pins expect 2.x
    // Act
    await orchestrate(h.deps);
    // Assert
    expect(joined(h)).toContain("drift");
    expect(joined(h)).toContain("claude 1.0.0 (pin 2.1.302");
  });

  it("reports an absent host (probe returned undefined) instead of fabricating a version", async () => {
    // Arrange
    const h = harness({ argv: ["hosts"], hostVersion: () => Promise.resolve(undefined) });
    // Act
    await orchestrate(h.deps);
    // Assert
    expect(joined(h)).toContain("opencode absent");
  });
});

// ---------------------------------------------------------------------------
// orchestrate: legacy selftest gates every tier that runs it
// ---------------------------------------------------------------------------

describe("orchestrate: a failed selftest refuses the whole run", () => {
  it("returns exit 3, runs no checks, persists no rows and reports the failing selftest", async () => {
    // Arrange
    const h = harness(
      { argv: ["hosts"] },
      undefined,
      [{ name: "egress", ok: false, detail: "EXTERNAL HTTPS REACHABLE" }],
    );
    // Act
    const code = await orchestrate(h.deps);
    // Assert
    expect(code).toBe(3);
    expect(effectCounts(h)).toEqual({ hostVersion: 2, selfTests: 1, checks: 0 });
    expect(h.persisted).toEqual([]);
    expect(h.said.join("\n")).toContain("egress");
  });

  it("runs the checks when every selftest passes (contrast case)", async () => {
    // Arrange
    const h = harness({ argv: ["hosts"] });
    // Act
    await orchestrate(h.deps);
    // Assert
    expect(effectCounts(h).checks).toBe(3);
  });
});

// ---------------------------------------------------------------------------
// orchestrate: check loop wiring (runCheck per selected check, rows persisted)
// ---------------------------------------------------------------------------

describe("orchestrate: check loop passes the injected RunContext and persists mapped rows", () => {
  it("calls runCheck once per selected check with exactly the RunContext makeCtx built for it", async () => {
    // Arrange
    const h = harness({ argv: ["quick"] });
    // Act
    await orchestrate(h.deps);
    // Assert
    expect(h.runCheckCalls.length).toBe(2);
    expect(h.runCheckCalls[0]?.ctx).toBe(h.ctxByCheck.get("build/one"));
    expect(h.runCheckCalls[1]?.ctx).toBe(h.ctxByCheck.get("build/two"));
    const ctx = h.runCheckCalls[0]?.ctx;
    expect(ctx).toBeDefined();
    expect(ctx?.repo).toBe("/repo");
    expect(ctx?.tier).toBe("quick");
    expect(typeof ctx?.log).toBe("function");
    expect(typeof ctx?.artifactDir).toBe("function");
    expect(ctx?.shared).toBeInstanceOf(Map);
  });

  it("persists one row per executed check with the def's identity fields and sandbox defaults", async () => {
    // Arrange
    const h = harness({ argv: ["quick"] });
    // Act
    await orchestrate(h.deps);
    // Assert
    expect(h.persisted.length).toBe(2);
    const row = h.persisted[0] as CheckRow;
    expect(row.id).toBe("build/one");
    expect(row.area).toBe("build");
    expect(row.layer).toBe("L0");
    expect(row.status).toBe("pass");
    expect(typeof row.ms).toBe("number");
    expect(row.ms).toBeGreaterThanOrEqual(0);
    expect(row.log).toBe("logs/build/one.log");
    expect(row.sandbox).toEqual({ mode: "none", canaryLeaks: 0, outsideChanged: [], egress: [] });
  });

  it("carries outcome summary, metrics and sandbox data onto the row", async () => {
    // Arrange
    const h = harness(
      { argv: ["hosts"] },
      {
        "cc/host-row": {
          ok: false,
          summary: "dispatch failed",
          metrics: { asks: 2 },
          sandbox: { mode: "iso" },
        },
      },
    );
    // Act
    const code = await orchestrate(h.deps);
    // Assert
    const row = h.persisted.find((r) => r.id === "cc/host-row");
    expect(row?.status).toBe("fail");
    expect(row?.summary).toBe("dispatch failed");
    expect(row?.metrics).toEqual({ asks: 2 });
    expect(row?.sandbox.mode).toBe("iso");
    expect(code).toBe(1);
  });

  it("relative-izes outcome artifacts against the run dir", async () => {
    // Arrange
    const h = harness(
      { argv: ["hosts"] },
      { "cc/host-row": { ok: true, artifacts: "/run/dir/artifacts/cc/host-row/x" } },
    );
    // Act
    await orchestrate(h.deps);
    // Assert
    const row = h.persisted.find((r) => r.id === "cc/host-row");
    expect(row?.artifacts).toBe("artifacts/cc/host-row/x");
  });

  it("turns a thrown runCheck into a fail row (summary notes the throw) instead of rejecting", async () => {
    // Arrange
    const h = harness({ argv: ["quick"] }, { "build/two": new Error("boom") });
    // Act
    const code = await orchestrate(h.deps);
    // Assert
    expect(code).toBe(1);
    const row = h.persisted.find((r) => r.id === "build/two");
    expect(row?.status).toBe("fail");
    expect(row?.summary).toContain("check threw");
    expect(row?.summary).toContain("boom");
  });
});

// ---------------------------------------------------------------------------
// orchestrate: selection refusals are non-waivable fail rows, and the check is never run
// ---------------------------------------------------------------------------

describe("orchestrate: selection refusals become non-waivable fail rows without running the check", () => {
  /** A registry-drift row (undeclared workload) that must never reach runCheck. */
  const driftRow = {
    id: "zz/drift",
    area: "build",
    layer: "L0",
    tier: "quick",
    workload: "totally-unknown-workload",
    run: async (): Promise<CheckOutcome> => ({ ok: true }),
  } as unknown as CheckDef;

  it("persists a fail row carrying the refusal reason, never calls runCheck for it, and exits 1", async () => {
    // Arrange
    const h = harness({ argv: ["quick"], checks: [driftRow] });
    // Act
    const code = await orchestrate(h.deps);
    // Assert
    expect(code).toBe(1);
    expect(effectCounts(h).checks).toBe(0);
    expect(h.persisted.length).toBe(1);
    const row = h.persisted[0] as CheckRow;
    expect(row.id).toBe("zz/drift");
    expect(row.status).toBe("fail");
    expect(row.summary).toContain("totally-unknown-workload");
  });

  it("does not let a known-red entry absorb a refusal row (non-waivable)", async () => {
    // Arrange
    const h = harness({
      argv: ["quick"], // non-strict on purpose
      checks: [driftRow],
      knownRed: { "zz/drift": { ref: "#349", note: "drift", until: "v1.1" } },
    });
    // Act
    const code = await orchestrate(h.deps);
    // Assert
    const row = h.persisted[0] as CheckRow;
    expect(row.status).toBe("fail");
    expect(row.known).toBeUndefined();
    expect(code).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// orchestrate: known-red mapping preserved through the wiring
// ---------------------------------------------------------------------------

describe("orchestrate: known-red mapping (strict flag and outcome flow through classify)", () => {
  const KNOWN = { ref: "#349", note: "known product failure", until: "v1.1" };

  it("maps a failing known check to fail under --strict (stale known-red) and exits 1", async () => {
    // Arrange
    const h = harness(
      { argv: ["quick", "--strict"], knownRed: { "build/one": KNOWN } },
      { "build/one": { ok: false, summary: "still broken" } },
    );
    // Act
    const code = await orchestrate(h.deps);
    // Assert
    expect(h.persisted[0]?.status).toBe("fail");
    expect(h.persisted[0]?.known).toEqual({ ref: "#349", note: "known product failure", until: "v1.1" });
    expect(code).toBe(1);
  });

  it("maps a failing known check to known without --strict and exits 0", async () => {
    // Arrange
    const h = harness(
      { argv: ["quick"], knownRed: { "build/one": KNOWN } },
      { "build/one": { ok: false, summary: "still broken" } },
    );
    // Act
    const code = await orchestrate(h.deps);
    // Assert
    expect(h.persisted[0]?.status).toBe("known");
    expect(code).toBe(0);
  });

  it("maps a passing known check to fixed and exits 1 (fixed is unexpected)", async () => {
    // Arrange
    const h = harness({ argv: ["quick"], knownRed: { "build/one": KNOWN } });
    // Act
    const code = await orchestrate(h.deps);
    // Assert
    expect(h.persisted[0]?.status).toBe("fixed");
    expect(code).toBe(1);
  });

  it("exits 0 when every selected check passes with no known-reds (usage never fires)", async () => {
    // Arrange
    const h = harness({ argv: ["quick"] });
    // Act
    const code = await orchestrate(h.deps);
    // Assert
    expect(code).toBe(0);
    expect(h.persisted.every((r) => r.status === "pass")).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// orchestrate: observed breaches override the exit code to 3
// ---------------------------------------------------------------------------

describe("orchestrate: observed breaches (safetyLedger-style input) force exit 3", () => {
  it("returns 3 even when all checks passed, and evaluates breaches after the checks ran", async () => {
    // Arrange
    const h = harness({ argv: ["quick"] }, undefined, undefined, ["canary leak: sk-ant-dummy"]);
    // Act
    const code = await orchestrate(h.deps);
    // Assert
    expect(code).toBe(3);
    expect(h.persisted.length).toBe(2); // rows still recorded honestly
    const lastCheck = h.calls.map((c, i) => (c.startsWith("check:") ? i : -1)).filter((i) => i >= 0).pop() ?? -1;
    expect(h.calls.indexOf("collectBreaches")).toBeGreaterThan(lastCheck);
  });
});

// ---------------------------------------------------------------------------
// plan: pure per-check plan rows from a selection
// ---------------------------------------------------------------------------

describe("plan: derives ordered per-check plan rows from a selection", () => {
  it("emits run rows for the selected checks in order with a purely derived logRel, and refused rows for refusals", () => {
    // Arrange
    const selection: Selection = {
      selected: [
        { id: "build/one", tier: "quick", workload: "trusted-static" },
        { id: "cc/od d@id", tier: "quick", workload: "trusted-command" },
      ],
      excluded: [],
      refusals: [{ checkId: "zz/drift", reason: "unknown or missing workload declaration" }],
    };
    // Act
    const rows = plan(selection);
    // Assert
    expect(rows).toHaveLength(3);
    expect(rows[0]).toEqual({
      kind: "run",
      check: selection.selected[0],
      logRel: "logs/build/one.log",
    });
    expect(rows[1]).toEqual({
      kind: "run",
      check: selection.selected[1],
      logRel: "logs/cc/od_d@id.log",
    });
    expect(rows[2]).toEqual({ kind: "refused", checkId: "zz/drift", reason: "unknown or missing workload declaration" });
  });

  it("does not mutate the selection input", () => {
    // Arrange
    const selection: Selection = {
      selected: [{ id: "build/one", tier: "quick", workload: "trusted-static" }],
      excluded: [{ id: "cc/host-row", reason: "tier bound" }],
      refusals: [],
    };
    const before = JSON.stringify(selection);
    // Act
    plan(selection);
    // Assert
    expect(JSON.stringify(selection)).toBe(before);
  });

  it("returns no rows for an empty selection", () => {
    // Arrange
    const selection: Selection = { selected: [], excluded: [], refusals: [] };
    // Act
    const rows = plan(selection);
    // Assert
    expect(rows).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// classify: outcome → status mapping (pure)
// ---------------------------------------------------------------------------

describe("classify: maps outcome, known-red, strict and safety-refusal to a status", () => {
  const KNOWN = { ref: "#349", note: "known product failure", until: "v1.1" };
  const pass: CheckOutcome = { ok: true };
  const fail: CheckOutcome = { ok: false, summary: "boom" };
  const skip: CheckOutcome = { ok: false, skip: "placeholder" };

  it("maps a plain pass to pass and a plain failure to fail", () => {
    // Arrange / Act / Assert
    expect(classify(pass, undefined, false, false)).toBe("pass");
    expect(classify(fail, undefined, false, false)).toBe("fail");
  });

  it("maps an outcome with a skip reason to skip", () => {
    // Arrange / Act / Assert
    expect(classify(skip, undefined, false, false)).toBe("skip");
  });

  it("maps a failing known check to known non-strict and to fail under --strict", () => {
    // Arrange / Act / Assert
    expect(classify(fail, KNOWN, false, false)).toBe("known");
    expect(classify(fail, KNOWN, true, false)).toBe("fail");
  });

  it("maps a passing known check to fixed regardless of --strict", () => {
    // Arrange / Act / Assert
    expect(classify(pass, KNOWN, false, false)).toBe("fixed");
    expect(classify(pass, KNOWN, true, false)).toBe("fixed");
  });

  it("lets skip win over a known-red entry", () => {
    // Arrange / Act / Assert
    expect(classify(skip, KNOWN, false, false)).toBe("skip");
  });

  it("treats a safety refusal as a non-waivable fail: never known, never skip, never pass", () => {
    // Arrange / Act / Assert
    expect(classify(fail, KNOWN, false, true)).toBe("fail");
    expect(classify(pass, undefined, false, true)).toBe("fail");
    expect(classify(skip, undefined, false, true)).toBe("fail");
    expect(classify(skip, KNOWN, true, true)).toBe("fail");
  });
});

// ---------------------------------------------------------------------------
// decideExit: rows + breaches + refusals → exit code (pure)
// ---------------------------------------------------------------------------

describe("decideExit: combines row statuses, breaches and refusals into an exit code", () => {
  it("returns 0 for no rows, no breaches and no refusals", () => {
    // Arrange / Act / Assert
    expect(decideExit([], [], [])).toBe(0);
    expect(decideExit([{ status: "pass" }, { status: "known" }, { status: "skip" }], [], [])).toBe(0);
  });

  it("returns 1 for any fail or fixed row (unexpected outcome)", () => {
    // Arrange / Act / Assert
    expect(decideExit([{ status: "pass" }, { status: "fail" }], [], [])).toBe(1);
    expect(decideExit([{ status: "fixed" }], [], [])).toBe(1);
  });

  it("returns 1 for refusals alone, even with only passing rows", () => {
    // Arrange / Act / Assert
    expect(decideExit([], [], [{ checkId: "zz/drift", reason: "drift" }])).toBe(1);
    expect(decideExit([{ status: "pass" }], [], [{ checkId: "zz/drift", reason: "drift" }])).toBe(1);
  });

  it("returns 3 when breaches are observed, overriding fails and refusals", () => {
    // Arrange / Act / Assert
    expect(decideExit([{ status: "pass" }], ["canary leak: x"], [])).toBe(3);
    expect(
      decideExit(
        [{ status: "fail" }, { status: "fixed" }],
        ["outside file changed: p"],
        [{ checkId: "zz/drift", reason: "drift" }],
      ),
    ).toBe(3);
  });
});

// ---------------------------------------------------------------------------
// envScrubLabel: the summary's env-scrub mark is derived from selftest evidence
// ---------------------------------------------------------------------------

describe("envScrubLabel: never shows ✓ without selftest evidence", () => {
  it("reports 'not run' when no selftest ran (the quick tier), never ✓", () => {
    // Arrange / Act
    const label = envScrubLabel([]);
    // Assert
    expect(label).toBe("not run (quick)");
    expect(label).not.toContain("✓");
  });

  it("reports ✓ only when selftests ran and all passed", () => {
    // Arrange / Act / Assert
    expect(envScrubLabel([{ name: "env-scrub", ok: true, detail: "all names allowlisted" }])).toBe("✓");
  });

  it("reports ✗ when any selftest failed", () => {
    // Arrange / Act / Assert
    expect(
      envScrubLabel([
        { name: "env-scrub", ok: true, detail: "ok" },
        { name: "canary", ok: false, detail: "leaked" },
      ]),
    ).toBe("✗");
  });
});
