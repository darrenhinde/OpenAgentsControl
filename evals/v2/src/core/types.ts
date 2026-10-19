// Shared types for the local suite. The row shape follows 07-test-suite-plan.md §2.4.

export type Tier = "quick" | "hosts" | "live" | "all";
export const TIER_ORDER: Tier[] = ["quick", "hosts", "live", "all"];

export type Area = "build" | "gates" | "oc-load" | "cc-load" | "scenarios" | "context" | "installer" | "evals";
export const AREAS: { id: Area; label: string }[] = [
  { id: "build", label: "Build" },
  { id: "gates", label: "Policy/gates" },
  { id: "oc-load", label: "OpenCode v2 load" },
  { id: "cc-load", label: "Claude Code load" },
  { id: "scenarios", label: "Cross-host scenarios" },
  { id: "context", label: "Context" },
  { id: "installer", label: "Installer" },
  { id: "evals", label: "Evals" },
];

/**
 * Declared trust class of a check's workload (P1.2 U1): what running the check may touch.
 * `trusted-static`/`trusted-command` map to the sandbox contract's "trusted-check" workload;
 * host classes (`host-check`/`host-scenario`/`installer`) require the launch-funnel gate and
 * must never be admissible in the quick tier; `deferred` rows are never selected at all.
 */
export type WorkloadDecl =
  | "trusted-static"
  | "trusted-command"
  | "host-check"
  | "host-scenario"
  | "installer"
  | "deferred";

export type Layer = "L0" | "L1" | "L2" | "L3";
export type HostId = "opencode-v2" | "claude-code" | "codex";
export type Status = "pass" | "fail" | "known" | "skip" | "fixed";

export interface SandboxInfo {
  mode: "none" | "iso" | "seatbelt" | "container";
  canaryLeaks: number;
  outsideChanged: string[];
  egress: string[];
}

export interface CheckRow {
  id: string;
  area: Area;
  layer: Layer;
  host?: HostId;
  status: Status;
  known?: { ref: string; note: string; until?: string };
  ms: number;
  log: string;
  artifacts?: string;
  metrics?: Record<string, number>;
  sandbox: SandboxInfo;
  skipReason?: string;
  /** One-line human summary of what the check saw (shown next to failures). */
  summary?: string;
}

/** What a check's run() returns before known-red mapping. */
export interface CheckOutcome {
  ok: boolean;
  skip?: string;
  summary?: string;
  metrics?: Record<string, number>;
  artifacts?: string;
  sandbox?: Partial<SandboxInfo>;
}

export interface RunContext {
  /** The check this context belongs to and its declared workload (P1.2 U3 launch funnel). */
  checkId: string;
  workload: WorkloadDecl;
  repo: string;
  runDir: string;
  /** Root for throwaway dirs, under $TMPDIR (outside $HOME and the repo). */
  tmpRoot: string;
  runId: string;
  tier: Tier;
  /** Append a line to this check's log file. */
  log: (line: string) => void;
  logPath: string;
  /** Absolute dir for this check's artifacts (created on demand). */
  artifactDir: (host?: string) => string;
  shared: Map<string, unknown>;
}

export interface CheckDef {
  id: string;
  area: Area;
  layer: Layer;
  host?: HostId;
  /** Lowest tier that runs this check. */
  tier: Tier;
  /** Declared trust class of this check's workload (see WorkloadDecl); required for every row. */
  workload: WorkloadDecl;
  run: (ctx: RunContext) => Promise<CheckOutcome>;
}
