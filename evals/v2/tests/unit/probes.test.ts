import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { authorize, type Workload } from "../../src/sandbox/contract.ts";
import {
  CAPABILITIES,
  capabilitySummary,
  evidenceFrom,
  policyIdOf,
  probeHeadline,
} from "../../src/sandbox/evidence.ts";
import {
  PROBES,
  PROBE_ORDER,
  applyControls,
  hostConfigPaths,
  runProbes,
  type ProbeContext,
  type PortHoldState,
  type ProbeExec,
  type ProbeFacts,
  type ProbeId,
  type ProbeOutcome,
  type ProbeReport,
  type ProbeRunner,
} from "../../src/sandbox/probes.ts";
import { SCRUB_CANARY } from "../../src/sandbox/policy.ts";
import {
  holdPort,
  makeGitView,
  outsideAccess,
  portFree,
  probeSandbox,
  resolveMainCheckout,
  waitForPidGone,
  type BindPort,
} from "../../src/sandbox/probe-runner.ts";

// P3-lite U1, tests-first (component-p3-lite.md): the boundary-probe module. The fixed PROBES
// table is the single source of truth (id, capability, applicability, argv, interpretation);
// runProbes executes it through an injected runner and evidenceFrom maps the report onto the
// P1.1 contract. Everything here is data-in/data-out: the runner is a scripted mock, so no
// sandbox-exec, no host binary, no listener and no network is touched.

const RUN_ID = "261019000000";
const HOME = "/Users/maint";
const REPO = "/Users/maint/repo";
const MAIN = "/Users/maint/main-checkout";
const CONTROL = "/private/var/folders/x/oac-suite-1/sandbox-probes/work";

const CTX: ProbeContext = {
  runId: RUN_ID,
  realHome: HOME,
  repo: REPO,
  controlDir: CONTROL,
  loopbackPort: 40123,
  mainCheckout: MAIN,
  hostConfig: [
    { path: `${HOME}/.claude`, outside: "accessible" },
    { path: `${HOME}/.ssh`, outside: "accessible" },
    { path: `${HOME}/.aws`, outside: "absent" },
    { path: `${HOME}/.netrc`, outside: "inaccessible" },
  ],
};

const HOME_TARGET = `${HOME}/.oac-sandbox-probe-${RUN_ID}`;
const WRITE_CONTROL = `${CONTROL}/write-control-${RUN_ID}`;

const exit = (code: number, out = "", timedOut = false): ProbeExec => ({ code, out, timedOut });
/** One `rc<TAB>path<TAB>error` line, as the fixed read/write scripts print it (error flattened to one line). */
const pathLine = (rc: number, eperm: boolean, path: string, tool = "ls"): string => {
  const err = eperm ? `${tool}: ${path}: Operation not permitted` : rc ? `${tool}: ${path}: No such file or directory` : "";
  return `${rc}\t${path}\t${err}`;
};
const lines = (...l: string[]): string => l.join("\n") + "\n";

const ITEM_NOT_FOUND = "security: SecKeychainSearchCopyNext: The specified item could not be found in the keychain.";
const SECURITYD_UNAVAILABLE = "security: SecKeychainSearchCopyNext: No keychain is available. You may need to restart your computer.";
const NO_DEFAULT_KEYCHAIN = "security: SecKeychainSearchCopyNext: A default keychain could not be found. (-25307)";
const EPERM_CURL = "* connect to 93.184.215.14 port 443 failed: Operation not permitted\ncurl: (7) Failed to connect to example.com port 443: Couldn't connect to server";
const EPERM_NC = "nc: connectx to 127.0.0.1 port 49374 (tcp) failed: Operation not permitted";
/** Supervisor facts for the service-port probe: our listener held the port and it was released. */
const HELD_PORT: ProbeFacts = { serviceHold: "ours", serviceReleased: true };

/** Every probe observing its boundary held (and every positive control succeeding). */
const HELD: Readonly<Record<ProbeId, ProbeExec>> = {
  "env-names": exit(0, lines("PATH=/usr/bin:/bin", "HOME=/tmp/h", "USER=oac-test", "TMPDIR=/tmp/h/tmp")),
  "net-loopback": exit(0, `oac-loopback-${RUN_ID}`),
  "net-external": exit(7, EPERM_CURL),
  "net-service-port": exit(1, EPERM_NC),
  "fs-home-write": exit(0, lines(pathLine(0, false, WRITE_CONTROL, "touch"), pathLine(1, true, HOME_TARGET, "touch"))),
  "fs-host-config-read": exit(0, lines(pathLine(0, false, CONTROL), pathLine(1, true, `${HOME}/.claude`), pathLine(1, true, `${HOME}/.ssh`))),
  "fs-repo-read": exit(0, lines(pathLine(0, false, CONTROL), pathLine(1, true, REPO), pathLine(1, true, MAIN))),
  "ipc-keychain": exit(53, SECURITYD_UNAVAILABLE),
  "proc-tree": exit(124, "grandchild=4242\n", true),
};

interface ScriptedRunner {
  readonly runner: ProbeRunner;
  readonly launched: ProbeId[];
  readonly removed: string[];
  readonly pidChecks: number[];
  /** Ordered events across launches and service-port hold/release/re-bind. */
  readonly events: string[];
}

/** A mocked runner: per-id scripted results (default HELD), scripted supervisor facts. */
function scripted(
  overrides: Partial<Record<ProbeId, ProbeExec | Error>> = {},
  facts: { exists?: boolean; pidGone?: boolean; hold?: PortHoldState; free?: boolean } = {},
): ScriptedRunner {
  const events: string[] = [];
  const launched: ProbeId[] = [];
  const removed: string[] = [];
  const pidChecks: number[] = [];
  const runner: ProbeRunner = {
    launch: (id) => {
      launched.push(id);
      events.push(`launch:${id}`);
      const scriptedResult = overrides[id] ?? HELD[id];
      return scriptedResult instanceof Error ? Promise.reject(scriptedResult) : Promise.resolve(scriptedResult);
    },
    exists: () => facts.exists ?? false,
    remove: (p) => {
      removed.push(p);
    },
    pidGone: (pid) => {
      pidChecks.push(pid);
      return Promise.resolve(facts.pidGone ?? true);
    },
    holdServicePort: () => {
      events.push("hold");
      return Promise.resolve({
        state: facts.hold ?? "ours",
        release: () => {
          events.push("release");
          return Promise.resolve();
        },
      });
    },
    servicePortFree: () => {
      events.push("free-check");
      return Promise.resolve(facts.free ?? true);
    },
  };
  return { runner, launched, removed, pidChecks, events };
}

/** Interprets one probe against the scripted context (pure path through the table). */
function verdict(id: ProbeId, e: ProbeExec, facts: ProbeFacts = id === "net-service-port" ? HELD_PORT : {}): ProbeOutcome {
  return { id, capability: PROBES[id].capability, ...PROBES[id].interpret(e, facts, CTX) };
}

function outcome(id: ProbeId, result: ProbeOutcome["result"]): ProbeOutcome {
  return { id, capability: PROBES[id].capability, result, observations: [`${result} (synthetic)`] };
}

function report(results: Partial<Record<ProbeId, ProbeOutcome["result"]>> = {}, omit: readonly ProbeId[] = []): ProbeReport {
  return {
    mode: "seatbelt",
    policyId: "sha256:synthetic",
    probes: PROBE_ORDER.filter((id) => !omit.includes(id)).map((id) => outcome(id, results[id] ?? "pass")),
  };
}

// ---------------------------------------------------------------------------
// The PROBES table: the single source of truth
// ---------------------------------------------------------------------------

describe("PROBES: a fixed table covering every required capability", () => {
  it("lists every table id exactly once in run order, keyed by its own id", () => {
    // Arrange
    const keys = Object.keys(PROBES).sort();
    // Act
    const ordered = [...PROBE_ORDER].sort();
    // Assert
    expect(ordered).toEqual(keys);
    expect(new Set(PROBE_ORDER).size).toBe(PROBE_ORDER.length);
    for (const id of PROBE_ORDER) expect(PROBES[id].id).toBe(id);
  });

  it("covers each of the five contract capabilities with at least one probe", () => {
    // Arrange
    const covered = new Set(PROBE_ORDER.map((id) => PROBES[id].capability));
    // Act
    const missing = CAPABILITIES.filter((c) => !covered.has(c));
    // Assert
    expect([...CAPABILITIES].sort()).toEqual(["env-scrub", "filesystem", "ipc", "network", "process-tree"]);
    expect(missing).toEqual([]);
  });

  it("runs each positive control before the probes that depend on it", () => {
    // Arrange
    const dependents = PROBE_ORDER.filter((id) => PROBES[id].control !== undefined);
    // Act
    const misordered = dependents.filter((id) => {
      const control = PROBES[id].control as ProbeId;
      return PROBE_ORDER.indexOf(control) > PROBE_ORDER.indexOf(id);
    });
    // Assert
    expect(dependents.sort()).toEqual(["net-external", "net-service-port"]);
    expect(misordered).toEqual([]);
  });

  it("scopes repo-read to repo-denied workloads only; every other probe applies to all contained workloads", () => {
    // Arrange / Act
    const repoDenied = PROBE_ORDER.filter((id) => PROBES[id].appliesTo === "repo-denied");
    // Assert
    expect(repoDenied).toEqual(["fs-repo-read"]);
  });

  it("has no unsandboxed probe: the old ipc-keychain-control (security outside Seatbelt) is gone", () => {
    // Arrange / Act
    const ids: readonly string[] = PROBE_ORDER;
    // Assert
    expect(ids).not.toContain("ipc-keychain-control");
    expect(PROBE_ORDER.filter((id) => "sandboxed" in PROBES[id])).toEqual([]);
  });

  it("builds fixed argvs from absolute binaries and context data only", () => {
    // Arrange / Act
    const argvs = PROBE_ORDER.map((id) => PROBES[id].argv(CTX));
    // Assert
    for (const argv of argvs) expect(argv[0]?.startsWith("/")).toBe(true);
    expect(PROBES["fs-host-config-read"].argv(CTX).slice(4)).toEqual([CONTROL, `${HOME}/.claude`, `${HOME}/.ssh`]);
    expect(PROBES["fs-repo-read"].argv(CTX).slice(4)).toEqual([CONTROL, REPO, MAIN]);
    expect(PROBES["fs-repo-read"].argv({ ...CTX, mainCheckout: REPO }).slice(4)).toEqual([CONTROL, REPO]);
    expect(PROBES["net-external"].argv(CTX)).toContain("-v");
    expect(PROBES["fs-home-write"].argv(CTX).slice(4)).toEqual([WRITE_CONTROL, HOME_TARGET]);
    expect(PROBES["net-loopback"].argv(CTX)).toContain("http://127.0.0.1:40123/");
    expect(PROBES["net-service-port"].argv(CTX)).toEqual(["/usr/bin/nc", "-z", "-w", "1", "127.0.0.1", "49374"]);
  });

  it("names the full host-config population the profile denies under the real HOME", () => {
    // Arrange: every (param "REAL_HOME") "/x" entry in the checked-in Seatbelt profile.
    const profile = readFileSync(join(__dirname, "..", "..", "src", "sandbox", "profiles", "agent.sb"), "utf8");
    const denied = [...profile.matchAll(/\(param "REAL_HOME"\) "([^"]+)"/g)].map((m) => `${HOME}${m[1]}`);
    // Act
    const population = hostConfigPaths(HOME);
    // Assert
    expect(denied.length).toBeGreaterThan(5);
    expect([...population].sort()).toEqual([...denied].sort());
  });
});

// ---------------------------------------------------------------------------
// Pure interpretation: blocked, unexpectedly allowed, control failed, absent, timeout
// ---------------------------------------------------------------------------

describe("interpret env-scrub: only allowlisted names, with HOME/PATH as the positive control", () => {
  it("passes when every name is allowlisted and records the scrub canary as absent", () => {
    // Arrange / Act
    const v = verdict("env-names", HELD["env-names"]);
    // Assert
    expect(v.result).toBe("pass");
    expect(v.observations.join("\n")).toContain(`${SCRUB_CANARY} absent`);
  });

  it("fails when the scrub canary or a sensitive name leaks, naming only the names", () => {
    // Arrange
    const leaked = exit(0, lines("PATH=/usr/bin", "HOME=/h", `${SCRUB_CANARY}=1`, "GITHUB_TOKEN=ghp_secret"));
    // Act
    const v = verdict("env-names", leaked);
    // Assert
    expect(v.result).toBe("fail");
    expect(v.observations.join("\n")).toContain(SCRUB_CANARY);
    expect(v.observations.join("\n")).toContain("GITHUB_TOKEN");
    expect(v.observations.join("\n")).not.toContain("ghp_secret");
  });

  it("is inconclusive when the positive control (HOME and PATH visible) fails", () => {
    // Arrange / Act / Assert
    expect(verdict("env-names", exit(0, "")).result).toBe("inconclusive");
    expect(verdict("env-names", exit(127, "")).result).toBe("inconclusive");
  });
});

describe("interpret network: loopback control, external HTTPS and the service port", () => {
  it("passes loopback only when the supervisor listener's token comes back", () => {
    // Arrange / Act / Assert
    expect(verdict("net-loopback", HELD["net-loopback"]).result).toBe("pass");
    expect(verdict("net-loopback", exit(0, "something else")).result).toBe("inconclusive");
    expect(verdict("net-loopback", exit(7, "")).result).toBe("inconclusive");
  });

  it("passes external HTTPS on a connect failure, fails it when reachable", () => {
    // Arrange / Act / Assert
    expect(verdict("net-external", HELD["net-external"]).result).toBe("pass");
    expect(verdict("net-external", exit(0)).result).toBe("fail");
  });

  it("is inconclusive for a connect failure without the Seatbelt denial text (a firewall or proxy looks the same)", () => {
    // Arrange
    const firewalled = exit(7, "curl: (7) Failed to connect to example.com port 443 after 3 ms: Couldn't connect to server");
    // Act / Assert
    expect(verdict("net-external", firewalled).result).toBe("inconclusive");
    expect(verdict("net-service-port", exit(1, "nc: connectx to 127.0.0.1 port 49374 (tcp) failed: Connection refused")).result).toBe("inconclusive");
    expect(verdict("net-service-port", exit(1)).result).toBe("inconclusive");
  });

  it("is inconclusive for a missing binary, a DNS failure or a timeout (not attributable to the sandbox)", () => {
    // Arrange / Act / Assert
    expect(verdict("net-external", exit(127, "not found")).result).toBe("inconclusive");
    expect(verdict("net-external", exit(6, "Could not resolve host")).result).toBe("inconclusive");
    expect(verdict("net-external", exit(124, "", true)).result).toBe("inconclusive");
  });

  it("passes the service port only when a listener holds it and the connect is denied by Seatbelt", () => {
    // Arrange / Act / Assert
    expect(verdict("net-service-port", HELD["net-service-port"]).result).toBe("pass");
    expect(verdict("net-service-port", exit(0)).result).toBe("fail");
    expect(verdict("net-service-port", HELD["net-service-port"], { serviceHold: "failed" }).result).toBe("inconclusive");
    expect(verdict("net-service-port", HELD["net-service-port"], {}).result).toBe("inconclusive");
    expect(verdict("net-service-port", HELD["net-service-port"], { serviceHold: "occupied" }).result).toBe("pass");
  });

  it("records whether our hold on the service port was released, or that it could not be verified", () => {
    // Arrange / Act
    const released = verdict("net-service-port", HELD["net-service-port"], { serviceHold: "ours", serviceReleased: true });
    const unverified = verdict("net-service-port", HELD["net-service-port"], { serviceHold: "ours", serviceReleased: false });
    const occupied = verdict("net-service-port", HELD["net-service-port"], { serviceHold: "occupied" });
    // Assert
    expect(released.observations.join("\n")).toContain("released (re-bind succeeded)");
    expect(unverified.observations.join("\n")).toContain("release could not be verified");
    expect(occupied.observations.join("\n")).toContain("held by another listener");
  });
});

describe("interpret filesystem: positive controls and named populations", () => {
  it("passes host-config reads when every accessible path is denied with EPERM, naming each path", () => {
    // Arrange / Act
    const v = verdict("fs-host-config-read", HELD["fs-host-config-read"]);
    const text = v.observations.join("\n");
    // Assert
    expect(v.result).toBe("pass");
    expect(text).toContain(`blocked (EPERM): ${HOME}/.claude`);
    expect(text).toContain(`blocked (EPERM): ${HOME}/.ssh`);
  });

  it("records an absent path as not present and an outside-inaccessible path as not attributable, never silently", () => {
    // Arrange / Act
    const text = verdict("fs-host-config-read", HELD["fs-host-config-read"]).observations.join("\n");
    // Assert
    expect(text).toContain(`not present: ${HOME}/.aws`);
    expect(text).toContain(`${HOME}/.netrc`);
    expect(text).toMatch(/not attributable.*\.netrc/);
  });

  it("fails when any probed host-config path is readable", () => {
    // Arrange
    const e = exit(0, lines(pathLine(0, false, CONTROL), pathLine(0, false, `${HOME}/.claude`), pathLine(1, true, `${HOME}/.ssh`)));
    // Act
    const v = verdict("fs-host-config-read", e);
    // Assert
    expect(v.result).toBe("fail");
    expect(v.observations.join("\n")).toContain(`${HOME}/.claude`);
  });

  it("is inconclusive when the read control on the throwaway dir fails, even if every target was denied", () => {
    // Arrange
    const e = exit(0, lines(pathLine(1, true, CONTROL), pathLine(1, true, `${HOME}/.claude`), pathLine(1, true, `${HOME}/.ssh`)));
    // Act
    const v = verdict("fs-host-config-read", e);
    // Assert
    expect(v.result).toBe("inconclusive");
    expect(v.observations.join("\n")).toContain("positive control");
  });

  it("is inconclusive for a denial without EPERM or a missing result line", () => {
    // Arrange
    const noEperm = exit(0, lines(pathLine(0, false, CONTROL), pathLine(1, false, `${HOME}/.claude`), pathLine(1, true, `${HOME}/.ssh`)));
    const missing = exit(0, lines(pathLine(0, false, CONTROL), pathLine(1, true, `${HOME}/.claude`)));
    // Act / Assert
    expect(verdict("fs-host-config-read", noEperm).result).toBe("inconclusive");
    expect(verdict("fs-host-config-read", missing).result).toBe("inconclusive");
  });

  it("never takes the EPERM text from the path itself: only the exact `<tool>: <path>: Operation not permitted` error counts", () => {
    // Arrange: paths whose own text contains the phrase, failing for a different reason.
    const forged = [`${HOME}/Operation not permitted`, `${HOME}/x: Operation not permitted`];
    const ctx: ProbeContext = { ...CTX, hostConfig: forged.map((path) => ({ path, outside: "accessible" as const })) };
    const notFound = exit(0, lines(pathLine(0, false, CONTROL), ...forged.map((p) => pathLine(1, false, p))));
    // Act
    const v = PROBES["fs-host-config-read"].interpret(notFound, {}, ctx);
    // Assert
    expect(v.result).toBe("inconclusive");
    expect(v.observations.join("\n")).not.toContain("blocked (EPERM)");
  });

  it("rejects an EPERM error from the wrong tool, for another path, or with anything appended", () => {
    // Arrange
    const claude = `${HOME}/.claude`;
    const ssh = pathLine(1, true, `${HOME}/.ssh`);
    const variants = [
      `1\t${claude}\ttouch: ${claude}: Operation not permitted`,
      `1\t${claude}\tls: ${HOME}/.other: Operation not permitted`,
      `1\t${claude}\tls: ${claude}: Operation not permitted ls: ${claude}/x: No such file or directory`,
    ];
    // Act / Assert
    for (const line of variants) {
      expect(verdict("fs-host-config-read", exit(0, lines(pathLine(0, false, CONTROL), line, ssh))).result, line).toBe("inconclusive");
    }
  });

  it("leaves the errno classification to the pure parser, not to a shell pattern over the error text", () => {
    // Arrange / Act
    const script = PROBES["fs-repo-read"].argv(CTX)[2] ?? "";
    // Assert
    expect(script).not.toContain("Operation not permitted");
    expect(script).toContain("/usr/bin/tr");
  });

  it("is inconclusive when no host-config path is present to probe", () => {
    // Arrange
    const empty: ProbeContext = { ...CTX, hostConfig: [{ path: `${HOME}/.aws`, outside: "absent" }] };
    // Act
    const v = PROBES["fs-host-config-read"].interpret(exit(0, lines(pathLine(0, false, CONTROL))), {}, empty);
    // Assert
    expect(v.result).toBe("inconclusive");
  });

  it("passes the repo read only when the repo and the main checkout are denied after a successful control", () => {
    // Arrange / Act / Assert
    expect(verdict("fs-repo-read", HELD["fs-repo-read"]).result).toBe("pass");
    expect(verdict("fs-repo-read", exit(0, lines(pathLine(0, false, CONTROL), pathLine(0, false, REPO), pathLine(1, true, MAIN)))).result).toBe("fail");
    expect(verdict("fs-repo-read", exit(0, lines(pathLine(0, false, CONTROL), pathLine(1, true, REPO), pathLine(0, false, MAIN)))).result).toBe("fail");
  });

  it("probes the main checkout exactly as the checks deny it (MAIN_DENY), and fails closed when it is unresolved", () => {
    // Arrange
    const notWorktree: ProbeContext = { ...CTX, mainCheckout: REPO };
    const unresolved: ProbeContext = { ...CTX, mainCheckout: undefined };
    const repoOnly = exit(0, lines(pathLine(0, false, CONTROL), pathLine(1, true, REPO)));
    // Act
    const same = PROBES["fs-repo-read"].interpret(repoOnly, {}, notWorktree);
    const missing = PROBES["fs-repo-read"].interpret(repoOnly, {}, unresolved);
    // Assert
    expect(verdict("fs-repo-read", HELD["fs-repo-read"]).observations.join("\n")).toContain(`blocked (EPERM): ${MAIN}`);
    expect(same.result).toBe("pass");
    expect(same.observations.join("\n")).toContain("main checkout is the repo itself");
    expect(missing.result).toBe("inconclusive");
    expect(missing.observations.join("\n")).toContain("main-checkout deny not probed");
  });

  it("fails the $HOME write when the file appeared, even if touch reported an error", () => {
    // Arrange / Act
    const v = verdict("fs-home-write", HELD["fs-home-write"], { leaked: true });
    // Assert
    expect(v.result).toBe("fail");
    expect(verdict("fs-home-write", HELD["fs-home-write"], { leaked: false }).result).toBe("pass");
  });

  it("is inconclusive when the write control in the throwaway dir fails", () => {
    // Arrange
    const e = exit(0, lines(pathLine(1, false, WRITE_CONTROL, "touch"), pathLine(1, true, HOME_TARGET, "touch")));
    // Act / Assert
    expect(verdict("fs-home-write", e, { leaked: false }).result).toBe("inconclusive");
  });

  it("is inconclusive when the probe launch timed out", () => {
    // Arrange / Act / Assert
    expect(verdict("fs-repo-read", exit(124, HELD["fs-repo-read"].out, true)).result).toBe("inconclusive");
  });
});

describe("interpret ipc: Keychain mach-lookup denial vs item-not-found (signal UNCONFIRMED until U5)", () => {
  it("passes the sandboxed probe only on the securityd-unavailable signal, flagged UNCONFIRMED", () => {
    // Arrange / Act
    const v = verdict("ipc-keychain", HELD["ipc-keychain"]);
    // Assert
    expect(v.result).toBe("pass");
    expect(v.observations.join("\n")).toContain("UNCONFIRMED");
  });

  it("fails when securityd answered inside the sandbox (item-not-found or an item returned)", () => {
    // Arrange / Act / Assert
    expect(verdict("ipc-keychain", exit(44, ITEM_NOT_FOUND)).result).toBe("fail");
    expect(verdict("ipc-keychain", exit(0, "keychain: \"/Library/Keychains/System.keychain\"")).result).toBe("fail");
  });

  it("is inconclusive for any other nonzero exit, a crash or a timeout", () => {
    // Arrange / Act / Assert
    expect(verdict("ipc-keychain", exit(1, "security: SecKeychainSearchCopyNext: The specified keychain could not be found.")).result).toBe("inconclusive");
    expect(verdict("ipc-keychain", exit(134, "")).result).toBe("inconclusive");
    expect(verdict("ipc-keychain", exit(51, NO_DEFAULT_KEYCHAIN)).result).toBe("inconclusive");
    expect(verdict("ipc-keychain", exit(51, `${SECURITYD_UNAVAILABLE}\n${NO_DEFAULT_KEYCHAIN}`)).result).toBe("inconclusive");
  });

  it("verifies only when the denial is the sole security: error line", () => {
    // Arrange
    const extra = `security: SecKeychainCopyDefault: Some other failure.\n${SECURITYD_UNAVAILABLE}`;
    const unprefixedNoise = `${SECURITYD_UNAVAILABLE}\n(some diagnostic without the prefix)`;
    // Act / Assert
    expect(verdict("ipc-keychain", exit(53, extra)).result).toBe("inconclusive");
    expect(verdict("ipc-keychain", exit(53, `${SECURITYD_UNAVAILABLE}\n${SECURITYD_UNAVAILABLE}`)).result).toBe("pass");
    expect(verdict("ipc-keychain", exit(53, unprefixedNoise)).result).toBe("pass");
    expect(verdict("ipc-keychain", exit(53, "No keychain is available.")).result).toBe("inconclusive");
    expect(verdict("ipc-keychain", exit(127, "")).result).toBe("inconclusive");
    expect(verdict("ipc-keychain", exit(124, SECURITYD_UNAVAILABLE, true)).result).toBe("inconclusive");
  });
});

describe("interpret process-tree: the timeout's group kill removes the grandchild", () => {
  it("passes when the timeout fired and the grandchild PID is gone", () => {
    // Arrange / Act
    const v = verdict("proc-tree", HELD["proc-tree"], { grandchildGone: true });
    // Assert
    expect(v.result).toBe("pass");
    expect(v.observations.join("\n")).toContain("4242");
  });

  it("fails when the grandchild survived the group kill", () => {
    // Arrange / Act / Assert
    expect(verdict("proc-tree", HELD["proc-tree"], { grandchildGone: false }).result).toBe("fail");
  });

  it("is inconclusive when the timeout did not fire or no PID was reported", () => {
    // Arrange / Act / Assert
    expect(verdict("proc-tree", exit(0, "grandchild=4242\n"), { grandchildGone: true }).result).toBe("inconclusive");
    expect(verdict("proc-tree", exit(124, "", true), {}).result).toBe("inconclusive");
    expect(verdict("proc-tree", exit(124, "grandchild=1\n", true), { grandchildGone: true }).result).toBe("inconclusive");
  });
});

// ---------------------------------------------------------------------------
// applyControls / runProbes: the injected-runner loop
// ---------------------------------------------------------------------------

describe("applyControls: a dependent 'blocked' proves nothing without its positive control", () => {
  it("downgrades a passing dependent to inconclusive when its control did not pass, but keeps a fail a fail", () => {
    // Arrange
    const outcomes = [outcome("net-loopback", "inconclusive"), outcome("net-external", "pass"), outcome("net-service-port", "fail")];
    // Act
    const controlled = applyControls(outcomes);
    // Assert
    expect(controlled.map((o) => o.result)).toEqual(["inconclusive", "inconclusive", "fail"]);
    expect(controlled[1]?.observations.join("\n")).toContain("net-loopback");
  });

  it("leaves dependents untouched when their control passed, and does not mutate its input", () => {
    // Arrange
    const outcomes = [outcome("net-loopback", "pass"), outcome("net-service-port", "pass")];
    const before = JSON.stringify(outcomes);
    // Act
    const controlled = applyControls(outcomes);
    // Assert
    expect(controlled.map((o) => o.result)).toEqual(["pass", "pass"]);
    expect(JSON.stringify(outcomes)).toBe(before);
  });
});

describe("runProbes: executes the fixed table through the injected runner", () => {
  it("launches every table probe exactly once, in order, and reports the seatbelt mode and policy", async () => {
    // Arrange
    const s = scripted();
    // Act
    const r = await runProbes(s.runner, CTX, "sha256:abc");
    // Assert
    expect(s.launched).toEqual([...PROBE_ORDER]);
    expect(r.mode).toBe("seatbelt");
    expect(r.policyId).toBe("sha256:abc");
    expect(r.probes.map((p) => p.id)).toEqual([...PROBE_ORDER]);
    expect(r.probes.every((p) => p.result === "pass")).toBe(true);
  });

  it("checks the reported grandchild PID through the injected PID check", async () => {
    // Arrange
    const s = scripted({}, { pidGone: false });
    // Act
    const r = await runProbes(s.runner, CTX, "sha256:abc");
    // Assert
    expect(s.pidChecks).toEqual([4242]);
    expect(r.probes.find((p) => p.id === "proc-tree")?.result).toBe("fail");
  });

  it("removes a leaked $HOME write target and fails the write probe", async () => {
    // Arrange
    const s = scripted({}, { exists: true });
    // Act
    const r = await runProbes(s.runner, CTX, "sha256:abc");
    // Assert
    expect(s.removed).toEqual([HOME_TARGET]);
    expect(r.probes.find((p) => p.id === "fs-home-write")?.result).toBe("fail");
  });

  it("holds the service port only around the service-port launch, releases it, then verifies the release", async () => {
    // Arrange
    const s = scripted();
    // Act
    const r = await runProbes(s.runner, CTX, "sha256:abc");
    // Assert
    const at = s.events.indexOf("launch:net-service-port");
    expect(s.events.slice(at - 1, at + 3)).toEqual(["hold", "launch:net-service-port", "release", "free-check"]);
    expect(s.events.filter((e) => e === "hold")).toHaveLength(1);
    expect(r.probes.find((p) => p.id === "net-service-port")?.observations.join("\n")).toContain("released (re-bind succeeded)");
  });

  it("releases the service port even when the launch throws, and never re-binds a port another listener holds", async () => {
    // Arrange
    const thrown = scripted({ "net-service-port": new Error("spawn failed") });
    const occupied = scripted({}, { hold: "occupied" });
    // Act
    await runProbes(thrown.runner, CTX, "sha256:abc");
    await runProbes(occupied.runner, CTX, "sha256:abc");
    // Assert
    expect(thrown.events).toContain("release");
    expect(occupied.events).not.toContain("free-check");
  });

  it("turns a probe that throws into an inconclusive outcome and still runs the rest", async () => {
    // Arrange
    const s = scripted({ "net-loopback": new Error("listener vanished") });
    // Act
    const r = await runProbes(s.runner, CTX, "sha256:abc");
    // Assert
    expect(s.launched).toEqual([...PROBE_ORDER]);
    const loopback = r.probes.find((p) => p.id === "net-loopback");
    expect(loopback?.result).toBe("inconclusive");
    expect(loopback?.observations.join("\n")).toContain("listener vanished");
    expect(r.probes.find((p) => p.id === "net-external")?.result).toBe("inconclusive"); // control failed
  });
});

// ---------------------------------------------------------------------------
// evidenceFrom: report → P1.1 BackendEvidence, per workload scope
// ---------------------------------------------------------------------------

describe("evidenceFrom: maps a probe report onto the contract's backend evidence", () => {
  const scope = (workload: Workload) => ({ checkId: "cc/x", workload });

  it("verifies all five capabilities, scope-matched and policy-bound, when every probe passed", () => {
    // Arrange / Act
    const ev = evidenceFrom(report(), scope("host-check"));
    // Assert
    expect(ev.mode).toBe("seatbelt");
    expect(ev.available).toBe(true);
    expect(ev.policyId).toBe("sha256:synthetic");
    expect(ev.scope).toEqual({ checkId: "cc/x", workload: "host-check" });
    for (const c of CAPABILITIES) {
      expect(ev.capabilities[c]?.state, c).toBe("verified");
      expect(ev.capabilities[c]?.complete, c).toBe(true);
      expect(ev.capabilities[c]?.observations.length, c).toBeGreaterThan(0);
    }
    expect(authorize({ checkId: "cc/x", workload: "host-check", backend: ev })).toMatchObject({ allowed: true, containment: "required" });
  });

  it("fails filesystem for host-check and host-scenario when repo-read failed", () => {
    // Arrange
    const r = report({ "fs-repo-read": "fail" });
    // Act / Assert
    for (const w of ["host-check", "host-scenario"] as const) {
      expect(evidenceFrom(r, scope(w)).capabilities.filesystem?.state, w).toBe("failed");
    }
  });

  it("treats repo-read as not applicable for installers, saying why", () => {
    // Arrange
    const r = report({ "fs-repo-read": "fail" });
    // Act
    const fs = evidenceFrom(r, scope("installer")).capabilities.filesystem;
    // Assert
    expect(fs?.state).toBe("verified");
    expect(fs?.observations.join("\n")).toContain("fs-repo-read: not applicable (installer reads the repo by design)");
  });

  it("maps fail over inconclusive over not-measured, and marks a missing probe incomplete", () => {
    // Arrange
    const r = report({ "net-external": "fail", "net-service-port": "inconclusive", "ipc-keychain": "inconclusive" }, ["proc-tree"]);
    // Act
    const ev = evidenceFrom(r, scope("host-check"));
    // Assert
    expect(ev.capabilities.network?.state).toBe("failed");
    expect(ev.capabilities.ipc?.state).toBe("inconclusive");
    expect(ev.capabilities["process-tree"]).toMatchObject({ state: "not-measured", complete: false });
    expect(ev.capabilities["process-tree"]?.observations.join("\n")).toContain("proc-tree: not measured");
  });

  it("scopes the ipc evidence to the keychain: it never claims general IPC containment", () => {
    // Arrange / Act
    const ipc = evidenceFrom(report(), scope("host-check")).capabilities.ipc;
    // Assert
    expect(ipc?.state).toBe("verified");
    expect(ipc?.observations[0]).toMatch(/^ipc \(keychain\) only:/);
    expect(ipc?.observations.join("\n")).toContain("not contained");
  });

  it("lets the contract refuse naming exactly the unverified capabilities", () => {
    // Arrange
    const ev = evidenceFrom(report({ "ipc-keychain": "inconclusive", "proc-tree": "fail" }), scope("host-scenario"));
    // Act
    const auth = authorize({ checkId: "cc/x", workload: "host-scenario", backend: ev });
    // Assert
    expect(auth.allowed).toBe(false);
    if (auth.allowed) return;
    expect(auth.code).toBe("capability-unverified");
    expect([...auth.missing].sort()).toEqual(["ipc", "process-tree"]);
  });

  it("measures nothing for an empty (iso-mode) report, and the contract refuses the mode", () => {
    // Arrange
    const iso: ProbeReport = { mode: "iso", policyId: "sha256:synthetic", probes: [] };
    // Act
    const ev = evidenceFrom(iso, scope("host-check"));
    // Assert
    expect(ev.available).toBe(false);
    for (const c of CAPABILITIES) expect(ev.capabilities[c]?.state, c).toBe("not-measured");
    expect(authorize({ checkId: "cc/x", workload: "host-check", backend: ev })).toMatchObject({ allowed: false, code: "unsupported-mode" });
  });

  it("does not mutate the report", () => {
    // Arrange
    const r = report({ "fs-repo-read": "fail" });
    const before = JSON.stringify(r);
    // Act
    evidenceFrom(r, scope("installer"));
    // Assert
    expect(JSON.stringify(r)).toBe(before);
  });
});

describe("capabilitySummary / probeHeadline / policyIdOf", () => {
  it("summarizes at the strictest scope (every probe applies) in capability order", () => {
    // Arrange / Act
    const all = capabilitySummary(report());
    const some = capabilitySummary(report({ "fs-repo-read": "fail", "ipc-keychain": "inconclusive" }));
    // Assert
    expect(all).toEqual({ verified: ["env-scrub", "filesystem", "network", "ipc (keychain)", "process-tree"], failed: [] });
    expect(some.failed).toEqual(["filesystem", "ipc (keychain)"]);
    expect(some.verified).toHaveLength(3);
  });

  it("headlines verified counts and the failed capability names", () => {
    // Arrange / Act / Assert
    expect(probeHeadline(report())).toContain("5/5 capabilities verified");
    const partial = probeHeadline(report({ "net-external": "fail" }));
    expect(partial).toContain("4/5 capabilities verified");
    expect(partial).toContain("network");
    expect(probeHeadline(report({ "ipc-keychain": "fail" }))).toContain("not verified: ipc (keychain)");
    expect(probeHeadline({ mode: "iso", policyId: "sha256:x", probes: [] })).toContain("not run");
  });

  it("derives the policy id as the sha256 of the profile text", () => {
    // Arrange
    const text = "(version 1)\n(allow default)\n";
    // Act
    const id = policyIdOf(text);
    // Assert
    expect(id).toBe(`sha256:${createHash("sha256").update(text).digest("hex")}`);
    expect(policyIdOf(text + " ")).not.toBe(id);
  });
});


// ---------------------------------------------------------------------------
// probe-runner (P3-lite U3): the injected PID check and the iso short-circuit
// ---------------------------------------------------------------------------

describe("waitForPidGone: confirms the grandchild PID is gone via an injected signal-0 check", () => {
  const errno = (code: string): Error => Object.assign(new Error(code), { code });
  const noSleep = (): Promise<void> => Promise.resolve();

  it("is gone as soon as signal 0 reports ESRCH", async () => {
    // Arrange
    const kill0 = vi.fn(() => {
      throw errno("ESRCH");
    });
    // Act
    const gone = await waitForPidGone(4242, { kill0, sleep: noSleep });
    // Assert
    expect(gone).toBe(true);
    expect(kill0).toHaveBeenCalledWith(4242);
  });

  it("polls until the PID disappears (a dying process is not yet gone)", async () => {
    // Arrange
    let calls = 0;
    const kill0 = vi.fn(() => {
      calls += 1;
      if (calls >= 3) throw errno("ESRCH");
    });
    // Act
    const gone = await waitForPidGone(4242, { kill0, sleep: noSleep });
    // Assert
    expect(gone).toBe(true);
    expect(kill0).toHaveBeenCalledTimes(3);
  });

  it("is NOT gone when the PID stays alive (or exists but is not ours: EPERM) for every attempt", async () => {
    // Arrange
    const alive = vi.fn(() => undefined);
    const foreign = vi.fn(() => {
      throw errno("EPERM");
    });
    // Act
    const a = await waitForPidGone(4242, { kill0: alive, sleep: noSleep }, 5);
    const b = await waitForPidGone(4242, { kill0: foreign, sleep: noSleep }, 5);
    // Assert
    expect(a).toBe(false);
    expect(b).toBe(false);
    expect(alive).toHaveBeenCalledTimes(5);
  });
});

describe("probeSandbox: iso mode probes nothing", () => {
  it("returns an empty iso report (no launch, no listener) that the contract refuses as unsupported-mode", async () => {
    // Arrange / Act
    const r = await probeSandbox({ mode: "iso", repo: REPO, tmpRoot: "/nonexistent-tmp-root", runId: RUN_ID, policyId: "sha256:p" });
    // Assert
    expect(r).toEqual({ mode: "iso", policyId: "sha256:p", probes: [] });
    const ev = evidenceFrom(r, { checkId: "cc/x", workload: "host-check" });
    expect(authorize({ checkId: "cc/x", workload: "host-check", backend: ev })).toMatchObject({ allowed: false, code: "unsupported-mode" });
  });
});

/** fs members probe-runner.ts may import; readFileSync is further limited to READ_FILE_SCOPES. */
const FS_ALLOWED = new Set(["lstatSync", "accessSync", "realpathSync", "existsSync", "rmSync", "readFileSync", "constants"]);
/** The only declarations whose bodies may call readFileSync (the profile hash and the git view). */
const READ_FILE_SCOPES = [/export function currentPolicyId\(\)[^]*?\n\}\n/, /const REAL_GIT_VIEW[^]*?\n\}\);\n/];

function fsViolations(src: string): string[] {
  const violations: string[] = [];
  if (/\brequire\s*\(|\bimport\s*\(/.test(src)) violations.push("dynamic require/import");
  for (const m of src.matchAll(/import\s+([^;]*?)\s+from\s+["'](?:node:)?fs(\/promises)?["']/g)) {
    if (m[2]) violations.push("node:fs/promises import");
    const named = /^\{([^}]*)\}$/.exec((m[1] ?? "").trim());
    if (!named) {
      violations.push(`non-named fs import: ${m[1]}`);
      continue;
    }
    for (const name of (named[1] ?? "").split(",").map((n) => n.trim().split(/\s+as\s+/)[0] ?? "").filter(Boolean)) {
      if (!FS_ALLOWED.has(name)) violations.push(`fs member not allowlisted: ${name}`);
    }
  }
  const scoped = READ_FILE_SCOPES.reduce((text, scope) => text.replace(scope, ""), src).replace(/^import[^;]*;$/gm, "");
  if (/\breadFileSync\b/.test(scoped)) violations.push("readFileSync outside currentPolicyId / REAL_GIT_VIEW");
  return violations;
}

describe("outsideAccess: metadata only, never opens, reads or lists a credential path (L-011)", () => {
  const errno = (code: string): Error => Object.assign(new Error(code), { code });

  it("classifies presence with lstat and readability with access(R_OK)", () => {
    // Arrange
    const ok = { lstat: vi.fn(), access: vi.fn() };
    const absent = { lstat: vi.fn(() => { throw errno("ENOENT"); }), access: vi.fn() };
    const unreadable = { lstat: vi.fn(), access: vi.fn(() => { throw errno("EACCES"); }) };
    // Act / Assert
    expect(outsideAccess(`${HOME}/.netrc`, ok)).toBe("accessible");
    expect(ok.access).toHaveBeenCalledWith(`${HOME}/.netrc`, expect.any(Number));
    expect(outsideAccess(`${HOME}/.aws`, absent)).toBe("absent");
    expect(absent.access).not.toHaveBeenCalled();
    expect(outsideAccess(`${HOME}/.ssh`, unreadable)).toBe("inaccessible");
  });

  it("uses only allowlisted fs calls, and readFileSync only for the profile and the git view", () => {
    // Arrange
    const src = readFileSync(join(__dirname, "..", "..", "src", "sandbox", "probe-runner.ts"), "utf8");
    // Act
    const violations = fsViolations(src);
    // Assert
    expect(violations).toEqual([]);
    expect(src).toMatch(/from "node:fs"/); // the scan saw the real import
  });

  it("flags every other fs access pattern (the scan's own positive control)", () => {
    // Arrange
    const samples = [
      'import { readFileSync, openSync } from "node:fs";',
      'import { opendirSync } from "fs";',
      'import { open } from "node:fs/promises";',
      'import * as fs from "node:fs";',
      'import fs from "node:fs";',
      'const m = require("node:fs");',
      'const m = await import("node:fs");',
      'import { promises } from "node:fs";',
      'import { readFileSync } from "node:fs";\nfunction leak(p: string) { return readFileSync(p); }',
    ];
    // Act
    const flagged = samples.filter((sample) => fsViolations(sample).length > 0);
    // Assert
    expect(flagged).toEqual(samples);
  });
});

describe("holdPort / portFree: injected bind and release of the service port", () => {
  function bindScript(states: PortHoldState[]): { bind: BindPort; closed: number[] } {
    const closed: number[] = [];
    let i = 0;
    const bind: BindPort = (port) => {
      const state = states[i++] ?? "failed";
      return Promise.resolve({ state, close: () => { closed.push(port); return Promise.resolve(); } });
    };
    return { bind, closed };
  }

  it("holds via bind and releases via that bind's close", async () => {
    // Arrange
    const b = bindScript(["ours"]);
    // Act
    const hold = await holdPort(49374, b.bind);
    await hold.release();
    // Assert
    expect(hold.state).toBe("ours");
    expect(b.closed).toEqual([49374]);
  });

  it("verifies a release by re-binding (and closing) the same port", async () => {
    // Arrange
    const free = bindScript(["ours"]);
    const stillHeld = bindScript(["occupied"]);
    // Act / Assert
    expect(await portFree(49374, free.bind)).toBe(true);
    expect(free.closed).toEqual([49374]);
    expect(await portFree(49374, stillHeld.bind)).toBe(false);
  });
});

describe("makeGitView: lstat first, never follow a symlink, cap and refuse oversized or non-regular files (L-011)", () => {
  interface Entry {
    readonly kind: "file" | "dir" | "symlink";
    readonly size?: number;
    readonly text?: string;
  }
  function fsOps(entries: Record<string, Entry>) {
    const readFile = vi.fn((p: string) => entries[p]?.text ?? "");
    const lstat = vi.fn((p: string) => {
      const e = entries[p];
      if (!e) throw Object.assign(new Error("ENOENT"), { code: "ENOENT" });
      return { isSymbolicLink: () => e.kind === "symlink", isFile: () => e.kind === "file", isDirectory: () => e.kind === "dir", size: e.size ?? (e.text ?? "").length };
    });
    return { lstat, readFile };
  }
  const gitdir = `${MAIN}/.git/worktrees/repo`;

  it("resolves a regular worktree layout", () => {
    // Arrange
    const ops = fsOps({ [`${REPO}/.git`]: { kind: "file", text: `gitdir: ${gitdir}\n` }, [`${gitdir}/commondir`]: { kind: "file", text: "../..\n" } });
    // Act / Assert
    expect(resolveMainCheckout(REPO, makeGitView(ops))).toBe(MAIN);
  });

  it("refuses a symlinked .git or commondir without reading it", () => {
    // Arrange
    const dotGitLink = fsOps({ [`${REPO}/.git`]: { kind: "symlink", text: `gitdir: ${gitdir}` } });
    const commondirLink = fsOps({ [`${REPO}/.git`]: { kind: "file", text: `gitdir: ${gitdir}` }, [`${gitdir}/commondir`]: { kind: "symlink", text: "../.." } });
    // Act
    const a = resolveMainCheckout(REPO, makeGitView(dotGitLink));
    const b = resolveMainCheckout(REPO, makeGitView(commondirLink));
    // Assert
    expect(a).toBeUndefined();
    expect(b).toBeUndefined();
    expect(dotGitLink.readFile).not.toHaveBeenCalled();
    expect(commondirLink.readFile).not.toHaveBeenCalledWith(`${gitdir}/commondir`);
  });

  it("refuses an oversized file without reading it, and anything that is not a regular file", () => {
    // Arrange
    const big = fsOps({ [`${REPO}/.git`]: { kind: "file", size: 4097, text: `gitdir: ${gitdir}` } });
    const dirCommondir = fsOps({ [`${REPO}/.git`]: { kind: "file", text: `gitdir: ${gitdir}` }, [`${gitdir}/commondir`]: { kind: "dir" } });
    // Act / Assert
    expect(resolveMainCheckout(REPO, makeGitView(big))).toBeUndefined();
    expect(big.readFile).not.toHaveBeenCalled();
    expect(resolveMainCheckout(REPO, makeGitView(dirCommondir))).toBeUndefined();
  });

  it("accepts only a single gitdir line and a single path line; never returns raw file contents", () => {
    // Arrange
    const key = "-----BEGIN OPENSSH PRIVATE KEY-----\nb3BlbnNzaC1rZXktdjEAAAAA\n-----END OPENSSH PRIVATE KEY-----\n";
    const cases = [
      fsOps({ [`${REPO}/.git`]: { kind: "file", text: `gitdir: ${gitdir}\nextra line\n` } }),
      fsOps({ [`${REPO}/.git`]: { kind: "file", text: key } }),
      fsOps({ [`${REPO}/.git`]: { kind: "file", text: `gitdir: ${gitdir}` }, [`${gitdir}/commondir`]: { kind: "file", text: key } }),
      fsOps({ [`${REPO}/.git`]: { kind: "file", text: `gitdir: ${gitdir}` }, [`${gitdir}/commondir`]: { kind: "file", text: "../..\u0000x" } }),
    ];
    // Act
    const resolved = cases.map((ops) => resolveMainCheckout(REPO, makeGitView(ops)));
    // Assert
    expect(resolved).toEqual([undefined, undefined, undefined, undefined]);
  });

  it("reports a .git directory only via lstat (a symlink to a directory is not one)", () => {
    // Arrange
    const real = fsOps({ [`${REPO}/.git`]: { kind: "dir" } });
    const link = fsOps({ [`${REPO}/.git`]: { kind: "symlink" } });
    // Act / Assert
    expect(resolveMainCheckout(REPO, makeGitView(real))).toBe(REPO);
    expect(resolveMainCheckout(REPO, makeGitView(link))).toBeUndefined();
  });
});

describe("resolveMainCheckout: the main checkout behind a worktree, from the filesystem only", () => {
  const view = (files: Record<string, string>, dirs: readonly string[] = []) => ({
    isDirectory: (p: string) => dirs.includes(p),
    readText: (p: string) => files[p],
  });

  it("is the repo itself when .git is a directory", () => {
    // Arrange / Act / Assert
    expect(resolveMainCheckout(REPO, view({}, [`${REPO}/.git`]))).toBe(REPO);
  });

  it("follows .git → gitdir → commondir to the main checkout of a worktree", () => {
    // Arrange
    const gitdir = `${MAIN}/.git/worktrees/repo`;
    const fs = view({ [`${REPO}/.git`]: `gitdir: ${gitdir}\n`, [`${gitdir}/commondir`]: "../..\n" });
    // Act / Assert
    expect(resolveMainCheckout(REPO, fs)).toBe(MAIN);
  });

  it("resolves a relative gitdir against the repo", () => {
    // Arrange
    const fs = view({ [`${REPO}/.git`]: "gitdir: ../main-checkout/.git/worktrees/repo", [`${MAIN}/.git/worktrees/repo/commondir`]: "../.." });
    // Act / Assert
    expect(resolveMainCheckout(REPO, fs)).toBe(MAIN);
  });

  it("is undefined (fail closed) for anything it cannot resolve", () => {
    // Arrange / Act / Assert
    expect(resolveMainCheckout(REPO, view({}))).toBeUndefined();
    expect(resolveMainCheckout(REPO, view({ [`${REPO}/.git`]: "garbage" }))).toBeUndefined();
    expect(resolveMainCheckout(REPO, view({ [`${REPO}/.git`]: "gitdir: /x/wt" }))).toBeUndefined();
  });
});
