// CLI orchestration seam (P1.2 U2/U3, component-p1-2.md): pure planning (plan), pure
// known-red/safety classification (classify), pure exit-code decision (decideExit) and the
// dependency-injected run loop (orchestrate). Every effect — fs, host version probes, launch
// authorization, check execution, persistence and output — is injected, so the module stays
// unit-testable without I/O (tests/unit/orchestrate.test.ts). main.ts wires the real effects
// and keeps runDir/logs, gitLine, known-red loading, snapshot+diff and report writing.
//
// Tier discipline: quick performs ZERO host version probes and ZERO sandbox boundary probes;
// hosts and above probe each host once, then run the boundary probes once (P3-lite U3),
// before the first check. Every selected check passes authorizeLaunch — with that probe
// report as its evidence — before makeCtx/runCheck. A probe failure is not a breach: contained
// rows are refused naming the unverified capabilities and trusted rows run. Selection refusals
// and launch refusals (including a LaunchRefused thrown by an inner funnel guard) are
// non-waivable fail rows (never known-red, never skip) and a refused check is never run.
import { arch, platform } from "node:os";
import { join, relative } from "node:path";
import type { Authorization } from "../sandbox/contract.ts";
import { probeHeadline } from "../sandbox/evidence.ts";
import { LaunchRefused } from "../sandbox/gate.ts";
import type { ProbeOutcome, ProbeReport } from "../sandbox/probes.ts";
import { select, type CheckLike, type Selection } from "./selection.ts";
import {
  TIER_ORDER,
  type CheckDef,
  type CheckOutcome,
  type CheckRow,
  type RunContext,
  type SandboxInfo,
  type Status,
  type Tier,
} from "./types.ts";

/** A run row executes its check; a refused row records a selection refusal (never run). */
export type PlanRow =
  | { kind: "run"; check: CheckLike; logRel: string }
  | { kind: "refused"; checkId: string; reason: string };

/** Structural slice of a known-red.yaml entry (see core/known-red.ts). */
interface KnownEntry {
  ref: string;
  note: string;
  until?: string;
}

export interface OrchestratorDeps {
  argv: string[];
  checks: readonly CheckDef[];
  /** Previously failed ids, for --rerun-failed (read by cli.ts from the last run). */
  failedIds: readonly string[];
  knownRed: Readonly<Record<string, KnownEntry>>;
  pins: Readonly<Record<string, string>>;
  repo: string;
  tmpRoot: string;
  runId: string;
  hostVersion: (bin: string) => Promise<string | undefined>;
  /** Runs the fixed boundary probes once (hosts and above only). Rejecting is not a breach. */
  runProbes: () => Promise<ProbeReport>;
  /** Launch-funnel decision for one selected check, given the run's probe report (none on quick). */
  authorizeLaunch: (check: CheckDef, report: ProbeReport | undefined) => Authorization;
  runCheck: (check: CheckDef, ctx: RunContext) => Promise<CheckOutcome>;
  makeCtx: (check: CheckDef) => RunContext;
  /** Observed safety breaches (outside files, canary leaks, auth shape, egress); runs after the last check. */
  collectBreaches: () => string[] | Promise<string[]>;
  persist: (row: CheckRow) => void;
  say: (line: string) => void;
  usage: (msg?: string) => never;
  now: () => number;
}

/** Same rules as the pre-seam cli.ts parseArgs, now pure (usage injected). */
export function parseArgs(argv: readonly string[], usage: (msg?: string) => never): {
  tier: Tier;
  only?: string;
  strict: boolean;
  keep: boolean;
  rerunFailed: boolean;
  ci: boolean;
} {
  const a: { tier: Tier; only?: string; strict: boolean; keep: boolean; rerunFailed: boolean; ci: boolean } = {
    tier: "quick", strict: false, keep: false, rerunFailed: false, ci: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const v = argv[i] as string;
    if (v === "--") continue;
    if ((TIER_ORDER as string[]).includes(v)) a.tier = v as Tier;
    else if (v === "--only") a.only = argv[++i] ?? usage("--only needs a value");
    else if (v.startsWith("--only=")) a.only = v.slice(7);
    else if (v === "--strict") a.strict = true;
    else if (v === "--keep") a.keep = true;
    else if (v === "--rerun-failed") a.rerunFailed = true;
    else if (v === "--ci") a.ci = true;
    else if (v === "--strict-sandbox" || v.startsWith("--sandbox")) usage("container sandbox (--strict-sandbox) is not implemented yet (plan step 8)");
    else if (v === "--budget" || v.startsWith("--budget=")) usage("live tier / --budget is not implemented yet (plan step 9)");
    else if (v === "-h" || v === "--help") usage();
    else usage(`unknown argument: ${v}`);
  }
  return a;
}

/** Log path of a check, relative to the run dir. */
const logRelFor = (id: string): string => {
  const [areaDir, ...rest] = id.split("/");
  return join("logs", areaDir ?? "misc", `${rest.join("_").replace(/[^A-Za-z0-9@._-]/g, "_")}.log`);
};

/** Pure: the ordered per-check rows (runs, then refusals) orchestrate will process. */
export function plan(selection: Selection): readonly PlanRow[] {
  const runRows: PlanRow[] = selection.selected.map((check) => ({ kind: "run", check, logRel: logRelFor(check.id) }));
  const refusedRows: PlanRow[] = selection.refusals.map((r) => ({ kind: "refused", checkId: r.checkId, reason: r.reason }));
  return [...runRows, ...refusedRows];
}

/** Pure: outcome + known-red + strict + safety-refusal → row status (skip > known-red > pass/fail). */
export function classify(
  outcome: CheckOutcome,
  known: { ref: string; note: string; until?: string } | undefined,
  strict: boolean,
  safetyRefused: boolean,
): Status {
  // A safety refusal is non-waivable: never known, never skip, never pass.
  if (safetyRefused) return "fail";
  if (outcome.skip) return "skip";
  if (known) return outcome.ok ? "fixed" : strict ? "fail" : "known";
  return outcome.ok ? "pass" : "fail";
}

/** Pure: rows + observed breaches + selection refusals → exit code. Breaches always win (3). */
export function decideExit(
  rows: readonly Pick<CheckRow, "status">[],
  breaches: readonly string[],
  refusals: readonly unknown[],
): 0 | 1 | 3 {
  if (breaches.length) return 3;
  const unexpected = rows.some((r) => r.status === "fail" || r.status === "fixed");
  return unexpected || refusals.length ? 1 : 0;
}

/** Pure: the summary's env-scrub mark from env-scrub probe evidence. No probe is "not run", never ✓. */
export function envScrubLabel(probes: readonly ProbeOutcome[]): string {
  const scrub = probes.filter((p) => p.capability === "env-scrub");
  if (!scrub.length) return "not run";
  return scrub.every((p) => p.result === "pass") ? "✓" : "✗";
}

/** Runs the probes once; an error leaves no report (contained rows are then refused), never a breach. */
async function probeOnce(deps: OrchestratorDeps): Promise<ProbeReport | undefined> {
  try {
    const report = await deps.runProbes();
    deps.say(probeHeadline(report));
    return report;
  } catch (e) {
    deps.say(`sandbox probes  errored (${e instanceof Error ? e.message : String(e)}); contained checks are refused`);
    return undefined;
  }
}

const sandboxDefaults = (): SandboxInfo => ({ mode: "none", canaryLeaks: 0, outsideChanged: [], egress: [] });

/** The dependency-injected main flow: parse → select → header → [probes] → authorize → loop → breaches → exit. */
export async function orchestrate(deps: OrchestratorDeps): Promise<number> {
  const args = parseArgs(deps.argv, deps.usage);
  if (args.tier === "live") deps.usage("the live tier (real model, metering proxy, --budget) is not implemented yet (plan step 9)");

  const selection = select(
    deps.checks,
    { tier: args.tier, only: args.only, rerunFailed: args.rerunFailed, strict: args.strict, ci: args.ci },
    deps.failedIds,
  );

  deps.say(`OAC local suite  tier=${args.tier}`);
  const nodeArch = `node ${process.versions.node}  ${platform()}-${arch()}`;
  const pinTxt = (name: string, v: string | undefined): string => {
    const pin = deps.pins[name];
    if (!v) return `${name} absent`;
    return `${name} ${v} (pin ${pin ?? "?"} ${pin === v ? "✓" : "⚠ drift"})`;
  };

  // The quick tier runs no host binaries: no version probes and no boundary probes. hosts and
  // above probe each host once, then the sandbox boundaries once, before the first check.
  let report: ProbeReport | undefined;
  if (TIER_ORDER.indexOf(args.tier) >= TIER_ORDER.indexOf("hosts")) {
    const oc = await deps.hostVersion("opencode");
    const cc = await deps.hostVersion("claude");
    deps.say(`hosts  ${pinTxt("opencode", oc)}  ${pinTxt("claude", cc)}  ${nodeArch}`);
    report = await probeOnce(deps);
    deps.say("");
  } else {
    deps.say(`hosts  not probed (the quick tier runs no host binaries)  ${nodeArch}`);
  }

  const rows: CheckRow[] = [];
  // Non-waivable: the refusal reason stands even when known-red names the id, and the check
  // is never run (zero launch-funnel side effects).
  const refuse = (checkId: string, code: string, reason: string, summary: string, log = "", ms = 0): void => {
    const def = deps.checks.find((c) => c.id === checkId);
    const row: CheckRow = {
      id: checkId,
      area: def?.area ?? "build",
      layer: def?.layer ?? "L0",
      host: def?.host,
      status: "fail",
      ms,
      log,
      sandbox: { mode: "none", refused: { code, reason } },
      summary,
    };
    rows.push(row);
    deps.persist(row);
    deps.say(`  ${"REFUSED".padEnd(10)} ${checkId.padEnd(40)}  (${code}) ${reason}`);
  };
  for (const p of plan(selection)) {
    if (p.kind === "refused") {
      refuse(p.checkId, "selection", p.reason, p.reason);
      continue;
    }
    // select() passes the registered CheckDefs through untouched, so a run row's check is
    // the full def; CheckLike is only selection's data slice of it.
    const check = p.check as CheckDef;
    const auth = deps.authorizeLaunch(check, report);
    if (!auth.allowed) {
      refuse(check.id, auth.code, auth.reason, `launch refused (${auth.code}): ${auth.reason}`);
      continue;
    }
    const ctx = deps.makeCtx(check);
    const started = deps.now();
    let outcome: CheckOutcome;
    try {
      outcome = await deps.runCheck(check, ctx);
    } catch (e) {
      if (e instanceof LaunchRefused) {
        ctx.log(`# ${e.message}`);
        refuse(check.id, e.code, e.reason, e.message, p.logRel, deps.now() - started);
        continue;
      }
      ctx.log(`# check threw: ${e instanceof Error ? e.stack ?? e.message : String(e)}`);
      outcome = { ok: false, summary: `check threw: ${e instanceof Error ? e.message : String(e)}`.slice(0, 120) };
    }
    const kr = deps.knownRed[check.id];
    const row: CheckRow = {
      id: check.id, area: check.area, layer: check.layer, host: check.host,
      status: classify(outcome, kr, args.strict, false),
      known: kr ? { ref: kr.ref, note: kr.note, until: kr.until } : undefined,
      ms: deps.now() - started, log: p.logRel,
      // Artifacts are reported relative to the run dir the ctx was built with.
      artifacts: outcome.artifacts ? relative(ctx.runDir, outcome.artifacts) : undefined,
      metrics: outcome.metrics,
      sandbox: { ...sandboxDefaults(), ...outcome.sandbox },
      skipReason: outcome.skip, summary: outcome.summary,
    };
    rows.push(row);
    deps.persist(row);
    const mark = { pass: "✓", fail: "✗", known: "✗ (known)", skip: "– skip", fixed: "! FIXED?" }[row.status];
    deps.say(`  ${mark.padEnd(10)} ${check.id.padEnd(40)} ${(row.ms / 1000).toFixed(1)}s${row.status === "fail" && row.summary ? `  ${row.summary}` : ""}`);
  }

  // Breaches are evaluated after the checks ran and force exit 3 regardless of results;
  // rows are still persisted honestly.
  const breaches = await deps.collectBreaches();
  return decideExit(rows, breaches, selection.refusals);
}
