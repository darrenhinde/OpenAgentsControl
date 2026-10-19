import { mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// U3, tests-first (component-p1-2.md): the launch funnel is gated by the accepted P1.1
// authorize() contract. In production the backend evidence is always unverified until P3/P4,
// so every contained workload (host-check, host-scenario, installer) is refused, and the
// refusal must come BEFORE any side effect: iso dirs, canaries, fake model, git, spawns.
//
// Every effect primitive below the guards is mocked so "zero calls" is directly assertable;
// nothing here spawns a process, binds a listener or touches the real repo.

const execMock = vi.hoisted(() => vi.fn());
const whichMock = vi.hoisted(() => vi.fn());
const startFakeModelMock = vi.hoisted(() => vi.fn());
const makeCanariesMock = vi.hoisted(() => vi.fn());
const plantDecoysMock = vi.hoisted(() => vi.fn());

vi.mock("../../src/core/exec.ts", () => ({ exec: execMock, which: whichMock }));
vi.mock("../../../../packages/compatibility-layer/src/verify/fake-model/server.ts", () => ({
  startFakeModel: startFakeModelMock,
}));
vi.mock("../../src/sandbox/canary.ts", () => ({
  makeCanaries: makeCanariesMock,
  plantDecoys: plantDecoysMock,
  allCanaries: vi.fn(),
  scanDir: vi.fn(() => []),
  sha: vi.fn(),
}));

import { cmdCheck } from "../../src/checks/helpers.ts";
import { runHost } from "../../src/checks/host-run.ts";
import type { RunContext, WorkloadDecl } from "../../src/core/types.ts";
import {
  PROFILE,
  WRAPPER,
  mainCheckoutOf,
  probeWrapperArgv,
  runIsolated,
  runProbeIsolated,
  sandboxMode,
  type IsoDirs,
} from "../../src/sandbox/env.ts";
import { SCRUB_CANARY } from "../../src/sandbox/policy.ts";
import { PROBES, PROBE_ORDER, type ProbeContext, type ProbeId, type ProbeOutcome, type ProbeReport } from "../../src/sandbox/probes.ts";
import {
  LaunchRefused,
  assertContainedLaunch,
  assertLaunchAllowed,
  decideLaunch,
  launchAuthorization,
  unverifiedBackend,
} from "../../src/sandbox/gate.ts";

const CONTAINED: readonly WorkloadDecl[] = ["host-check", "host-scenario", "installer"];
const TRUSTED: readonly WorkloadDecl[] = ["trusted-static", "trusted-command"];
const MODES = ["none", "iso", "seatbelt", "container"] as const;

let tmpRoot: string;

beforeEach(() => {
  vi.clearAllMocks();
  tmpRoot = mkdtempSync(join(tmpdir(), "oac-launch-gates-"));
});

afterEach(() => {
  rmSync(tmpRoot, { recursive: true, force: true });
});

function ctxFor(checkId: string, workload: WorkloadDecl): RunContext {
  return {
    checkId,
    workload,
    repo: "/repo-under-test",
    runDir: join(tmpRoot, "run"),
    tmpRoot,
    runId: "261019000000",
    tier: "hosts",
    log: () => {},
    logPath: join(tmpRoot, "run", "x.log"),
    artifactDir: () => join(tmpRoot, "run", "artifacts"),
    shared: new Map<string, unknown>(),
  };
}

const FAKE_DIRS: IsoDirs = { root: "/nope", work: "/nope/work", home: "/nope/home", cache: "/nope/cache" };

// ---------------------------------------------------------------------------
// unverifiedBackend: the only backend evidence production can mint before P3/P4
// ---------------------------------------------------------------------------

describe("unverifiedBackend: scope-matched evidence with no verified capability", () => {
  it("carries the requested scope, empty capabilities and availability only for containing modes", () => {
    // Arrange / Act
    const seatbelt = unverifiedBackend("cc/x", "host-check", "seatbelt");
    const iso = unverifiedBackend("cc/x", "host-check", "iso");
    // Assert
    expect(seatbelt.scope).toEqual({ checkId: "cc/x", workload: "host-check" });
    expect(seatbelt.capabilities).toEqual({});
    expect(seatbelt.available).toBe(true);
    expect(iso.available).toBe(false);
    expect(unverifiedBackend("cc/x", "host-check", "container").available).toBe(true);
    expect(unverifiedBackend("cc/x", "host-check", "none").available).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// launchAuthorization: WorkloadDecl × backend mode → P1.1 decision
// ---------------------------------------------------------------------------

describe("launchAuthorization: trusted declarations launch, contained ones are refused in production", () => {
  it.each(TRUSTED.flatMap((w) => MODES.map((m) => [w, m] as const)))(
    "allows %s under mode %s with containment not-applicable",
    (workload, mode) => {
      // Arrange / Act
      const auth = launchAuthorization({ checkId: "build/x", workload }, mode);
      // Assert
      expect(auth).toEqual({ allowed: true, checkId: "build/x", workload: "trusted-check", containment: "not-applicable" });
    },
  );

  it.each(CONTAINED.flatMap((w) => (["seatbelt", "container"] as const).map((m) => [w, m] as const)))(
    "refuses %s under containing mode %s as capability-unverified, naming all five capabilities",
    (workload, mode) => {
      // Arrange / Act
      const auth = launchAuthorization({ checkId: "cc/x", workload }, mode);
      // Assert
      expect(auth.allowed).toBe(false);
      if (auth.allowed) return;
      expect(auth.code).toBe("capability-unverified");
      expect([...auth.missing].sort()).toEqual(["env-scrub", "filesystem", "ipc", "network", "process-tree"]);
    },
  );

  it.each(CONTAINED.flatMap((w) => (["iso", "none"] as const).map((m) => [w, m] as const)))(
    "refuses %s under non-containing mode %s",
    (workload, mode) => {
      // Arrange / Act
      const auth = launchAuthorization({ checkId: "cc/x", workload }, mode);
      // Assert
      expect(auth.allowed).toBe(false);
    },
  );

  it("refuses a deferred declaration (deferred rows never launch)", () => {
    // Arrange / Act
    const auth = launchAuthorization({ checkId: "inst/net", workload: "deferred" }, "seatbelt");
    // Assert
    expect(auth.allowed).toBe(false);
    if (!auth.allowed) expect(auth.reason).toContain("deferred");
  });

  it("fails closed for a missing or unknown declaration", () => {
    // Arrange / Act / Assert
    expect(launchAuthorization(undefined, "seatbelt").allowed).toBe(false);
    expect(
      launchAuthorization({ checkId: "x/y", workload: "bogus" as unknown as WorkloadDecl }, "seatbelt").allowed,
    ).toBe(false);
    expect(launchAuthorization({ checkId: "  ", workload: "trusted-static" }, "seatbelt").allowed).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// assertLaunchAllowed: throws a structured LaunchRefused on refusal
// ---------------------------------------------------------------------------

describe("assertLaunchAllowed: throws LaunchRefused carrying the refusal", () => {
  it("returns silently for a trusted declaration", () => {
    // Arrange / Act / Assert
    expect(() => assertLaunchAllowed({ checkId: "build/x", workload: "trusted-command" }, "seatbelt")).not.toThrow();
  });

  it("throws LaunchRefused with checkId, code and reason for a contained declaration", () => {
    // Arrange
    let caught: unknown;
    // Act
    try {
      assertLaunchAllowed({ checkId: "cc/x", workload: "host-check" }, "seatbelt");
    } catch (e) {
      caught = e;
    }
    // Assert
    expect(caught).toBeInstanceOf(LaunchRefused);
    const refused = caught as LaunchRefused;
    expect(refused.checkId).toBe("cc/x");
    expect(refused.code).toBe("capability-unverified");
    expect(refused.message).toContain("capability-unverified");
  });
});

// ---------------------------------------------------------------------------
// assertContainedLaunch: the contained funnel admits only containment-required decisions
// ---------------------------------------------------------------------------

describe("assertContainedLaunch: trusted declarations may not use the contained funnel", () => {
  it.each(TRUSTED)("throws LaunchRefused for a %s declaration even though it is otherwise allowed", (workload) => {
    // Arrange / Act / Assert
    expect(() => assertContainedLaunch({ checkId: "build/x", workload }, "seatbelt")).toThrow(LaunchRefused);
  });

  it.each(CONTAINED)("still refuses %s while capabilities are unverified", (workload) => {
    // Arrange / Act / Assert
    expect(() => assertContainedLaunch({ checkId: "cc/x", workload }, "seatbelt")).toThrow(LaunchRefused);
  });
});

// ---------------------------------------------------------------------------
// runHost: refusal is the FIRST thing — no dirs, canaries, mock, git or spawn
// ---------------------------------------------------------------------------

describe("runHost: a refused declaration has zero launch-funnel side effects", () => {
  it.each([...CONTAINED, ...TRUSTED])("rejects %s with LaunchRefused before any effect", async (workload) => {
    // Arrange
    const ctx = ctxFor("scn/x@claude-code", workload);
    const prepare = vi.fn();
    const argv = vi.fn(() => ["claude"]);
    // Act
    const run = runHost(ctx, { name: "scn-x@claude-code", host: "claude-code", script: [], prepare, argv });
    // Assert
    await expect(run).rejects.toBeInstanceOf(LaunchRefused);
    expect(readdirSync(tmpRoot)).toEqual([]); // makeIsoDirs never ran
    expect(makeCanariesMock).not.toHaveBeenCalled();
    expect(plantDecoysMock).not.toHaveBeenCalled();
    expect(startFakeModelMock).not.toHaveBeenCalled();
    expect(prepare).not.toHaveBeenCalled();
    expect(argv).not.toHaveBeenCalled();
    expect(execMock).not.toHaveBeenCalled();
    expect(whichMock).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// runIsolated / mainCheckoutOf: guarded before git rev-parse and the wrapper spawn
// ---------------------------------------------------------------------------

describe("runIsolated and mainCheckoutOf: refused before any spawn", () => {
  it.each([...CONTAINED, ...TRUSTED])("runIsolated rejects %s without spawning git or the wrapper", async (workload) => {
    // Arrange
    const target = { repo: "/repo-under-test", repoDeny: "/repo-under-test", launch: { checkId: "oc/x", workload } };
    // Act
    const run = runIsolated({ dirs: FAKE_DIRS, env: {}, argv: ["/usr/bin/true"], target });
    // Assert
    await expect(run).rejects.toBeInstanceOf(LaunchRefused);
    expect(execMock).not.toHaveBeenCalled();
  });

  it.each([...CONTAINED, ...TRUSTED])("mainCheckoutOf rejects a %s declaration without spawning git", async (workload) => {
    // Arrange / Act
    const run = mainCheckoutOf("/repo-under-test", { checkId: "oc/x", workload });
    // Assert
    await expect(run).rejects.toBeInstanceOf(LaunchRefused);
    expect(execMock).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// cmdCheck: only trusted declarations reach exec
// ---------------------------------------------------------------------------

describe("cmdCheck: refuses non-trusted declarations before PATH lookup or exec", () => {
  it.each([...CONTAINED, "deferred" as const])("rejects a %s declaration with LaunchRefused", async (workload) => {
    // Arrange
    const check = cmdCheck({ id: "inst/x", area: "installer", workload, cmd: ["/bin/echo", "hi"], needs: ["echo"] });
    // Act
    const run = check.run(ctxFor("inst/x", workload));
    // Assert
    await expect(run).rejects.toBeInstanceOf(LaunchRefused);
    expect(whichMock).not.toHaveBeenCalled();
    expect(execMock).not.toHaveBeenCalled();
  });

  it("runs a trusted-command declaration through exec (contrast case)", async () => {
    // Arrange
    execMock.mockResolvedValue({ code: 0, out: "ok\n", ms: 1, timedOut: false });
    const check = cmdCheck({ id: "build/x", area: "build", workload: "trusted-command", cmd: ["/bin/echo", "hi"] });
    // Act
    const outcome = await check.run(ctxFor("build/x", "trusted-command"));
    // Assert
    expect(outcome.ok).toBe(true);
    expect(execMock).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// runProbeIsolated: the narrow probe launch path (P3-lite U2). Takes a PROBES id, never an
// argv, and builds the command from the fixed table through the same wrapper and profile.
// ---------------------------------------------------------------------------

const PROBE_CTX: ProbeContext = {
  runId: "261019000000",
  realHome: "/Users/maint",
  repo: "/repo-under-test",
  controlDir: "/nope/work",
  loopbackPort: 40123,
  mainCheckout: "/main-checkout",
  hostConfig: [{ path: "/Users/maint/.ssh", outside: "accessible" }],
};

describe("probeWrapperArgv: the wrapper command is derived from the PROBES table only", () => {
  it.each([...PROBE_ORDER])("builds %s as wrapper + profile + deny params + allowlisted env + the table argv", (id) => {
    // Arrange
    const sep = (argv: readonly string[]): number[] => argv.flatMap((a, i) => (a === "--" ? [i] : []));
    // Act
    const argv = probeWrapperArgv(id, PROBE_CTX, FAKE_DIRS);
    // Assert
    expect(argv.slice(0, 7)).toEqual([WRAPPER, PROFILE, FAKE_DIRS.work, "/Users/maint", "/repo-under-test", "/main-checkout", "49374"]);
    const [envStart, cmdStart] = sep(argv);
    expect(envStart).toBe(7);
    expect(argv.slice((cmdStart ?? 0) + 1)).toEqual([...PROBES[id].argv(PROBE_CTX)]);
    const names = argv.slice(8, cmdStart).map((a) => a.split("=")[0]);
    expect(names).toContain("HOME");
    expect(names).not.toContain(SCRUB_CANARY);
  });

  it("denies exactly what the checks deny: MAIN_DENY is the main checkout, or the repo when unresolved", () => {
    // Arrange / Act
    const unresolved = probeWrapperArgv("fs-repo-read", { ...PROBE_CTX, mainCheckout: undefined }, FAKE_DIRS);
    // Assert
    expect(unresolved.slice(4, 6)).toEqual(["/repo-under-test", "/repo-under-test"]);
  });

  it("refuses an id that is not in the PROBES table", () => {
    // Arrange / Act / Assert
    expect(() => probeWrapperArgv("curl-anything" as ProbeId, PROBE_CTX, FAKE_DIRS)).toThrow(/unknown probe/);
  });
});

describe("runProbeIsolated: refuses before any spawn unless it is a table probe in seatbelt mode", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("accepts exactly (id, ctx, dirs): there is no argv parameter", () => {
    // Arrange / Act / Assert
    expect(runProbeIsolated.length).toBe(3);
  });

  it("rejects an unknown id without spawning", async () => {
    // Arrange / Act
    const run = runProbeIsolated("/bin/sh" as ProbeId, PROBE_CTX, FAKE_DIRS);
    // Assert
    await expect(run).rejects.toThrow(/unknown probe/);
    expect(execMock).not.toHaveBeenCalled();
  });

  it("rejects in iso mode (no Seatbelt to probe) without spawning", async () => {
    // Arrange
    vi.stubEnv("OAC_SANDBOX", "iso");
    // Act
    const run = runProbeIsolated("env-names", PROBE_CTX, FAKE_DIRS);
    // Assert
    await expect(run).rejects.toThrow(/seatbelt/);
    expect(execMock).not.toHaveBeenCalled();
  });

  it.skipIf(sandboxMode() !== "seatbelt").each([...PROBE_ORDER])(
    "launches %s once through bash and the wrapper, with the table's timeout, sandbox flag and scrub canary",
    async (id) => {
      // Arrange
      execMock.mockResolvedValue({ code: 0, out: "", ms: 1, timedOut: false });
      // Act
      await runProbeIsolated(id, PROBE_CTX, FAKE_DIRS);
      // Assert
      expect(execMock).toHaveBeenCalledTimes(1);
      const [cmd, args, opts] = execMock.mock.calls[0] as [string, string[], { env: Record<string, string>; timeoutMs: number; stdoutOnly: boolean }];
      expect(cmd).toBe("/bin/bash");
      expect(args).toEqual(probeWrapperArgv(id, PROBE_CTX, FAKE_DIRS));
      expect(opts.timeoutMs).toBe(PROBES[id].timeoutMs);
      expect(opts.stdoutOnly).toBe(PROBES[id].stdoutOnly);
      expect(opts.env.OAC_SANDBOX).toBe("seatbelt");
      expect(opts.env[SCRUB_CANARY]).toBe("1");
    },
  );
});

// ---------------------------------------------------------------------------
// decideLaunch / installProbeReport (P3-lite U3): probe evidence reaches the gate
// ---------------------------------------------------------------------------

function probed(overrides: Partial<Record<ProbeId, ProbeOutcome["result"]>> = {}, mode: ProbeReport["mode"] = "seatbelt"): ProbeReport {
  return {
    mode,
    policyId: "sha256:test-profile",
    probes: PROBE_ORDER.map((id) => ({ id, capability: PROBES[id].capability, result: overrides[id] ?? "pass", observations: ["synthetic"] })),
  };
}

describe("decideLaunch: the pure gate decision over the supervisor's probe report", () => {
  it.each(CONTAINED)("allows %s with containment required when every capability is verified", (workload) => {
    // Arrange / Act
    const auth = decideLaunch({ checkId: "cc/x", workload }, "seatbelt", probed());
    // Assert
    expect(auth).toMatchObject({ allowed: true, checkId: "cc/x", containment: "required" });
  });

  it("refuses naming exactly the failed capability", () => {
    // Arrange / Act
    const auth = decideLaunch({ checkId: "cc/x", workload: "host-scenario" }, "seatbelt", probed({ "proc-tree": "inconclusive" }));
    // Assert
    expect(auth.allowed).toBe(false);
    if (auth.allowed) return;
    expect(auth.code).toBe("capability-unverified");
    expect(auth.missing).toEqual(["process-tree"]);
  });

  it("applies the per-workload filesystem scope: a failed repo read refuses host-check but not installer", () => {
    // Arrange
    const report = probed({ "fs-repo-read": "fail" });
    // Act
    const hostCheck = decideLaunch({ checkId: "cc/x", workload: "host-check" }, "seatbelt", report);
    const installer = decideLaunch({ checkId: "inst/x", workload: "installer" }, "seatbelt", report);
    // Assert
    expect(hostCheck.allowed).toBe(false);
    expect(installer.allowed).toBe(true);
  });

  it("falls back to unverified evidence without a report, or when the report's mode is not the launch mode", () => {
    // Arrange / Act
    const none = decideLaunch({ checkId: "cc/x", workload: "host-check" }, "seatbelt", undefined);
    const otherMode = decideLaunch({ checkId: "cc/x", workload: "host-check" }, "container", probed());
    // Assert
    expect(none).toMatchObject({ allowed: false, code: "capability-unverified" });
    expect(otherMode).toMatchObject({ allowed: false, code: "capability-unverified" });
  });

  it("still refuses an iso-mode report as unsupported-mode", () => {
    // Arrange / Act
    const auth = decideLaunch({ checkId: "cc/x", workload: "host-check" }, "iso", probed({}, "iso"));
    // Assert
    expect(auth).toMatchObject({ allowed: false, code: "unsupported-mode" });
  });

  it("never needs evidence for a trusted declaration, and still refuses deferred ones", () => {
    // Arrange / Act / Assert
    expect(decideLaunch({ checkId: "build/x", workload: "trusted-command" }, "seatbelt", undefined).allowed).toBe(true);
    expect(decideLaunch({ checkId: "inst/net", workload: "deferred" }, "seatbelt", probed()).allowed).toBe(false);
  });
});

describe("installProbeReport: the funnel guards consult the supervisor's report, installed once", () => {
  it("lets assertContainedLaunch admit a verified contained launch only after the report is installed", async () => {
    // Arrange: a fresh gate module, so this test's install cannot leak into the others.
    vi.resetModules();
    const gate = await import("../../src/sandbox/gate.ts");
    const decl = { checkId: "cc/x", workload: "host-check" as const };
    // Act
    const before = gate.launchAuthorization(decl, "seatbelt");
    gate.installProbeReport(probed());
    const after = gate.launchAuthorization(decl, "seatbelt");
    // Assert
    expect(before.allowed).toBe(false);
    expect(after).toMatchObject({ allowed: true, containment: "required" });
    expect(() => gate.assertContainedLaunch(decl, "seatbelt")).not.toThrow();
  });

  it("deep-freezes the installed report: mutating it throws, and mutating the caller's original has no effect", async () => {
    // Arrange
    vi.resetModules();
    const gate = await import("../../src/sandbox/gate.ts");
    const original = probed({ "ipc-keychain": "fail" });
    const decl = { checkId: "cc/x", workload: "host-check" as const };
    // Act
    const installed = gate.installProbeReport(original);
    (original.probes as ProbeOutcome[]).splice(0, original.probes.length, ...probed().probes);
    // Assert
    expect(Object.isFrozen(installed)).toBe(true);
    expect(Object.isFrozen(installed.probes)).toBe(true);
    expect(Object.isFrozen(installed.probes[0]?.observations)).toBe(true);
    expect(() => {
      (installed.probes as ProbeOutcome[]).push(probed().probes[0] as ProbeOutcome);
    }).toThrow(TypeError);
    expect(() => {
      (installed.probes[0] as { result: string }).result = "pass";
    }).toThrow(TypeError);
    expect(gate.launchAuthorization(decl, "seatbelt").allowed).toBe(false);
  });

  it("refuses a second install, so nothing can swap the evidence mid-run", async () => {
    // Arrange
    vi.resetModules();
    const gate = await import("../../src/sandbox/gate.ts");
    gate.installProbeReport(probed({ "ipc-keychain": "fail" }));
    // Act / Assert
    expect(() => gate.installProbeReport(probed())).toThrow(/already installed/);
    expect(gate.launchAuthorization({ checkId: "cc/x", workload: "host-check" }, "seatbelt").allowed).toBe(false);
  });
});
