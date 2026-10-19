// Boundary probes (P3-lite U1, component-p3-lite.md). The fixed PROBES table is the single
// source of truth for what is probed: id, capability, workload applicability, positive
// control, argv builder, supervisor-side observation and pure interpretation
// (probe-interpret.ts). runProbes executes the table once per hosts run through an injected
// runner; in production that runner is env.ts runProbeIsolated (an id, never an argv) wired
// by probe-runner.ts. evidence.ts maps the resulting report onto the P1.1 contract.
//
// A probe proves only that one boundary held on this machine for this profile. It does not
// audit the profile (P4).
import type { BackendMode, Capability } from "./contract.ts";
import {
  EXTERNAL_URL,
  grandchildPid,
  interpretEnvNames,
  interpretExternal,
  interpretHomeWrite,
  interpretKeychain,
  interpretLoopback,
  interpretPathProbe,
  interpretProcessTree,
  interpretRepoRead,
  interpretServicePort,
  keychainService,
} from "./probe-interpret.ts";
import { OPENCODE_SERVICE_PORT } from "./policy.ts";

export type ProbeId =
  | "env-names"
  | "net-loopback"
  | "net-external"
  | "net-service-port"
  | "fs-home-write"
  | "fs-host-config-read"
  | "fs-repo-read"
  | "ipc-keychain"
  | "proc-tree";

export type ProbeResult = "pass" | "fail" | "inconclusive";

/** The slice of an exec result a probe interpretation reads. */
export interface ProbeExec {
  readonly code: number;
  readonly out: string;
  readonly timedOut: boolean;
}

/** What the supervisor observed itself, outside the sandbox, after a launch. */
export interface ProbeFacts {
  readonly leaked?: boolean;
  readonly grandchildGone?: boolean;
  /** Who held the service port during the service-port probe. */
  readonly serviceHold?: PortHoldState;
  /** After our hold was released, a re-bind of the port succeeded. */
  readonly serviceReleased?: boolean;
}

/** "ours": the supervisor bound it; "occupied": another listener (the user's service) holds it. */
export type PortHoldState = "ours" | "occupied" | "failed";

export interface PortHold {
  readonly state: PortHoldState;
  /** Releases our listener; a no-op unless state is "ours". */
  readonly release: () => Promise<void>;
}

export interface Verdict {
  readonly result: ProbeResult;
  readonly observations: readonly string[];
}

export interface ProbeOutcome extends Verdict {
  readonly id: ProbeId;
  readonly capability: Capability;
}

export interface ProbeReport {
  readonly mode: BackendMode;
  /** sha256 of the Seatbelt profile the probes ran under (evidence.ts policyIdOf). */
  readonly policyId: string;
  readonly probes: readonly ProbeOutcome[];
}

/** One named path and what the supervisor could do with it outside the sandbox. */
export interface HostPath {
  readonly path: string;
  readonly outside: "absent" | "accessible" | "inaccessible";
}

/** Supervisor-built data the argv builders and interpretations read. */
export interface ProbeContext {
  readonly runId: string;
  readonly realHome: string;
  readonly repo: string;
  /** Throwaway dir (the probe workdir): read and write here must succeed (positive control). */
  readonly controlDir: string;
  /** Port of the supervisor's 127.0.0.1 listener (loopback positive control). */
  readonly loopbackPort: number;
  /**
   * The main checkout behind a worktree (the checks' MAIN_DENY), the repo itself when not a
   * worktree, or undefined when unresolved (then MAIN_DENY falls back to the repo, unprobed).
   */
  readonly mainCheckout: string | undefined;
  /** The named host-config population (hostConfigPaths), with outside-the-sandbox access. */
  readonly hostConfig: readonly HostPath[];
}

/** Injected effects. Production: probe-runner.ts; tests: a scripted mock. */
export interface ProbeRunner {
  readonly launch: (id: ProbeId, ctx: ProbeContext) => Promise<ProbeExec>;
  readonly exists: (path: string) => boolean;
  readonly remove: (path: string) => void;
  readonly pidGone: (pid: number) => Promise<boolean>;
  /** Binds the service port only around the service-port probe. */
  readonly holdServicePort: () => Promise<PortHold>;
  /** Re-binds (and closes) the service port: true once our hold is really gone. */
  readonly servicePortFree: () => Promise<boolean>;
}

/** "repo-denied" probes apply only to workloads that run with the repo denied (not installers). */
export type Applicability = "contained" | "repo-denied";

export interface ProbeSpec {
  readonly id: ProbeId;
  readonly capability: Capability;
  readonly appliesTo: Applicability;
  /** Positive-control probe that must pass before this probe's "blocked" counts. */
  readonly control?: ProbeId;
  /** The supervisor holds the service port only around this probe's launch. */
  readonly holdsServicePort?: true;
  readonly stdoutOnly: boolean;
  readonly timeoutMs: number;
  readonly argv: (ctx: ProbeContext) => readonly string[];
  readonly observe?: (e: ProbeExec, ctx: ProbeContext, runner: ProbeRunner) => Promise<ProbeFacts>;
  readonly interpret: (e: ProbeExec, facts: ProbeFacts, ctx: ProbeContext) => Verdict;
}

/** Paths under the real HOME that agent.sb denies reading (pinned against the profile in tests). */
const HOST_CONFIG = [
  ".claude", ".claude.json", ".config/opencode", ".local/share/opencode", ".local/state/opencode", ".opencode",
  ".ssh", ".aws", ".gnupg", ".config/gh", ".npmrc", ".netrc", ".gitconfig", "Library/Keychains",
] as const;

export const hostConfigPaths = (realHome: string): readonly string[] => HOST_CONFIG.map((p) => `${realHome}/${p}`);
export const homeWriteTarget = (ctx: ProbeContext): string => `${ctx.realHome}/.oac-sandbox-probe-${ctx.runId}`;
export const writeControl = (ctx: ProbeContext): string => `${ctx.controlDir}/write-control-${ctx.runId}`;

/**
 * Prints `rc<TAB>path<TAB>error` per argument, the error flattened to one line; listings are
 * never echoed. The errno classification is the pure parser's (probe-interpret.ts pathResult),
 * never a shell pattern, so a path whose text contains the errno phrase cannot forge it.
 */
const pathScript = (op: string): string =>
  String.raw`for p in "$@"; do err=$(${op} -- "$p" 2>&1 >/dev/null); rc=$?; err=$(printf '%s' "$err" | /usr/bin/tr '\n\t' '  '); printf '%s\t%s\t%s\n' "$rc" "$p" "$err"; done`;
const READ_SCRIPT = pathScript("/bin/ls");
const WRITE_SCRIPT = pathScript("/usr/bin/touch");
/** The grandchild drops the output pipe so only the group kill (not EOF) can end the probe. */
const PROC_TREE_SCRIPT = `/bin/sleep 30 </dev/null >/dev/null 2>&1 & echo "grandchild=$!"; wait`;

const accessible = (ctx: ProbeContext): string[] => ctx.hostConfig.filter((p) => p.outside === "accessible").map((p) => p.path);
/** The repo, plus the main checkout when it is a different directory (both are denied to checks). */
const repoDenied = (ctx: ProbeContext): string[] =>
  ctx.mainCheckout && ctx.mainCheckout !== ctx.repo ? [ctx.repo, ctx.mainCheckout] : [ctx.repo];

const DEFAULTS = { appliesTo: "contained", stdoutOnly: false, timeoutMs: 15_000 } as const;

export const PROBES: Readonly<Record<ProbeId, ProbeSpec>> = {
  "env-names": {
    ...DEFAULTS, id: "env-names", capability: "env-scrub", stdoutOnly: true,
    argv: () => ["/usr/bin/env"],
    interpret: (e) => interpretEnvNames(e),
  },
  "net-loopback": {
    ...DEFAULTS, id: "net-loopback", capability: "network",
    argv: (ctx) => ["/usr/bin/curl", "-sS", "-m", "3", `http://127.0.0.1:${ctx.loopbackPort}/`],
    interpret: (e, _f, ctx) => interpretLoopback(e, ctx),
  },
  "net-external": {
    ...DEFAULTS, id: "net-external", capability: "network", control: "net-loopback",
    // -v so a denied connect prints its errno text ("Operation not permitted") to stderr.
    argv: () => ["/usr/bin/curl", "-sS", "-v", "-m", "3", "-o", "/dev/null", EXTERNAL_URL],
    interpret: (e) => interpretExternal(e),
  },
  "net-service-port": {
    ...DEFAULTS, id: "net-service-port", capability: "network", control: "net-loopback", holdsServicePort: true,
    argv: () => ["/usr/bin/nc", "-z", "-w", "1", "127.0.0.1", OPENCODE_SERVICE_PORT],
    interpret: (e, facts) => interpretServicePort(e, facts),
  },
  "fs-home-write": {
    ...DEFAULTS, id: "fs-home-write", capability: "filesystem",
    argv: (ctx) => ["/bin/sh", "-c", WRITE_SCRIPT, "sh", writeControl(ctx), homeWriteTarget(ctx)],
    observe: (_e, ctx, runner) => {
      const leaked = runner.exists(homeWriteTarget(ctx));
      if (leaked) runner.remove(homeWriteTarget(ctx));
      return Promise.resolve({ leaked });
    },
    interpret: (e, facts, ctx) => interpretHomeWrite(e, facts, writeControl(ctx), homeWriteTarget(ctx)),
  },
  "fs-host-config-read": {
    ...DEFAULTS, id: "fs-host-config-read", capability: "filesystem",
    argv: (ctx) => ["/bin/sh", "-c", READ_SCRIPT, "sh", ctx.controlDir, ...accessible(ctx)],
    interpret: (e, _f, ctx) => interpretPathProbe(e, "read", ctx.controlDir, ctx.hostConfig),
  },
  "fs-repo-read": {
    ...DEFAULTS, id: "fs-repo-read", capability: "filesystem", appliesTo: "repo-denied",
    argv: (ctx) => ["/bin/sh", "-c", READ_SCRIPT, "sh", ctx.controlDir, ...repoDenied(ctx)],
    interpret: (e, _f, ctx) => interpretRepoRead(e, ctx),
  },
  "ipc-keychain": {
    ...DEFAULTS, id: "ipc-keychain", capability: "ipc",
    argv: (ctx) => ["/usr/bin/security", "find-generic-password", "-s", keychainService(ctx)],
    interpret: (e) => interpretKeychain(e),
  },
  "proc-tree": {
    ...DEFAULTS, id: "proc-tree", capability: "process-tree", stdoutOnly: true, timeoutMs: 2_000,
    argv: () => ["/bin/sh", "-c", PROC_TREE_SCRIPT],
    observe: async (e, _ctx, runner) => {
      const pid = grandchildPid(e.out);
      return pid === undefined ? {} : { grandchildGone: await runner.pidGone(pid) };
    },
    interpret: (e, facts) => interpretProcessTree(e, facts),
  },
};

/** Run order: each positive control precedes the probes that depend on it. */
export const PROBE_ORDER: readonly ProbeId[] = [
  "env-names",
  "net-loopback", "net-external", "net-service-port",
  "fs-home-write", "fs-host-config-read", "fs-repo-read",
  "ipc-keychain",
  "proc-tree",
];

export const isProbeId = (value: unknown): value is ProbeId => typeof value === "string" && Object.hasOwn(PROBES, value);

/** Pure: a dependent's "pass" counts only when its positive control passed; a "fail" stays a fail. */
export function applyControls(outcomes: readonly ProbeOutcome[]): readonly ProbeOutcome[] {
  return outcomes.map((o) => {
    const control = PROBES[o.id].control;
    if (!control || o.result !== "pass") return o;
    if (outcomes.find((c) => c.id === control)?.result === "pass") return o;
    return { ...o, result: "inconclusive", observations: [...o.observations, `control ${control} did not pass, so this proves nothing`] };
  });
}

/** Holds the service port only around this launch, always releases it, then verifies the release. */
async function launchHoldingPort(spec: ProbeSpec, runner: ProbeRunner, ctx: ProbeContext): Promise<{ e: ProbeExec; facts: ProbeFacts }> {
  const hold = await runner.holdServicePort();
  let e: ProbeExec;
  try {
    e = await runner.launch(spec.id, ctx);
  } finally {
    await hold.release();
  }
  const serviceReleased = hold.state === "ours" ? await runner.servicePortFree() : undefined;
  return { e, facts: { serviceHold: hold.state, serviceReleased } };
}

async function launch(spec: ProbeSpec, runner: ProbeRunner, ctx: ProbeContext): Promise<{ e: ProbeExec; facts: ProbeFacts }> {
  return spec.holdsServicePort ? launchHoldingPort(spec, runner, ctx) : { e: await runner.launch(spec.id, ctx), facts: {} };
}

async function runOne(spec: ProbeSpec, runner: ProbeRunner, ctx: ProbeContext): Promise<ProbeOutcome> {
  try {
    const { e, facts } = await launch(spec, runner, ctx);
    const observed = spec.observe ? await spec.observe(e, ctx, runner) : {};
    return { id: spec.id, capability: spec.capability, ...spec.interpret(e, { ...facts, ...observed }, ctx) };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { id: spec.id, capability: spec.capability, result: "inconclusive", observations: [`probe errored: ${msg}`] };
  }
}

/** Runs every table probe once, in order. A probe error is inconclusive evidence, never a breach. */
export async function runProbes(runner: ProbeRunner, ctx: ProbeContext, policyId: string): Promise<ProbeReport> {
  const outcomes: ProbeOutcome[] = [];
  for (const id of PROBE_ORDER) outcomes.push(await runOne(PROBES[id], runner, ctx));
  return { mode: "seatbelt", policyId, probes: applyControls(outcomes) };
}
