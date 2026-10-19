// Pure check selection (P1.2 U1): tier is an upper bound, --only narrows by id prefix and never
// widens, rerunFailed restricts to the previously failed ids, and workload declarations gate what
// may run at all — quick admits trusted rows only, deferred rows never run, and unknown/missing
// declarations are refusals (registry drift), not silent skips. No fs, no exec, no registry
// import: the caller passes checks as plain data, so this module is trivially testable.
import { TIER_ORDER, type Tier, type WorkloadDecl } from "./types.ts";

/** The data slice of CheckDef that selection needs; structural, so real defs flow in as-is. */
export interface CheckLike {
  id: string;
  tier: Tier;
  workload: WorkloadDecl;
}

export interface SelectionArgs {
  /** Requested tier: an upper bound. No filter can widen it. */
  tier: Tier;
  /** --only prefix: narrows the selection to ids starting with it (startsWith). */
  only?: string;
  /** Rerun mode: restrict the selection to the failed ids (third parameter). */
  rerunFailed?: boolean;
  /** Accepted and ignored: they affect known-red treatment and reporting, not selection. */
  strict?: boolean;
  ci?: boolean;
}

export interface Selection {
  /** Checks to run, in input order. */
  selected: CheckLike[];
  /** Rows not selected, each with a non-blank reason (tier bound, --only miss, rerun miss, deferred). */
  excluded: { id: string; reason: string }[];
  /** Declaration problems: unknown/missing workload, or a host-class row admissible into quick. */
  refusals: { checkId: string; reason: string }[];
}

const WORKLOAD_DECLS: readonly WorkloadDecl[] = [
  "trusted-static",
  "trusted-command",
  "host-check",
  "host-scenario",
  "installer",
  "deferred",
];
/** Classes that must never run in the quick tier (host-free quick, enforced permanently). */
const HOST_CLASSES: readonly WorkloadDecl[] = ["host-check", "host-scenario", "installer"];

const rank = (tier: Tier): number => TIER_ORDER.indexOf(tier);

export function select(checks: readonly CheckLike[], args: SelectionArgs, failedIds: readonly string[]): Selection {
  const selected: CheckLike[] = [];
  const excluded: Selection["excluded"] = [];
  const refusals: Selection["refusals"] = [];
  const bound = rank(args.tier);
  const failed = new Set(args.rerunFailed ? failedIds : []);
  // Every id a registered row carried, so failed ids naming no check stay visible as exclusions.
  const seen = new Set<string>();

  for (const check of checks) {
    seen.add(check.id);
    // A declaration that is not a known WorkloadDecl (including a missing one) is registry
    // drift: refuse the row outright rather than guess a trust class for it.
    if (!WORKLOAD_DECLS.includes(check.workload)) {
      refusals.push({ checkId: check.id, reason: `unknown or missing workload declaration: ${String(check.workload)}` });
      continue;
    }
    if (rank(check.tier) > bound) {
      excluded.push({ id: check.id, reason: `tier "${check.tier}" is above the requested "${args.tier}" bound` });
      continue;
    }
    if (check.workload === "deferred") {
      excluded.push({ id: check.id, reason: `workload "deferred" is never selected` });
      continue;
    }
    // Quick admits trusted-static/trusted-command only: a host-class row the tier bound would
    // admit is a registry-drift refusal (the real registry must never contain such a row).
    if (args.tier === "quick" && HOST_CLASSES.includes(check.workload)) {
      refusals.push({ checkId: check.id, reason: `workload "${check.workload}" is not admissible in the quick tier` });
      continue;
    }
    if (args.rerunFailed && !failed.has(check.id)) {
      excluded.push({ id: check.id, reason: `rerun: id is not among the failed ids` });
      continue;
    }
    if (args.only !== undefined && !check.id.startsWith(args.only)) {
      excluded.push({ id: check.id, reason: `--only "${args.only}": id does not start with the prefix` });
      continue;
    }
    selected.push(check);
  }

  if (args.rerunFailed) {
    for (const id of failedIds) {
      if (!seen.has(id)) excluded.push({ id, reason: `rerun: no registered check with id "${id}"` });
    }
  }

  return { selected, excluded, refusals };
}
