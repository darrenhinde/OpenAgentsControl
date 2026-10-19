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
import { mainCheckoutOf, runIsolated, type IsoDirs } from "../../src/sandbox/env.ts";
import {
  LaunchRefused,
  assertContainedLaunch,
  assertLaunchAllowed,
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
