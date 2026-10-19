// Probe report → P1.1 contract evidence (P3-lite U1, component-p3-lite.md). Pure mapping
// and rendering only: evidenceFrom builds the scope-matched BackendEvidence authorize()
// consumes; the summary helpers render what was (and was not) verified. contract.ts is
// unchanged: this module only decides what evidence reaches it.
import { createHash } from "node:crypto";
import type { BackendEvidence, Capability, CapabilityEvidence, EvidenceState, Workload } from "./contract.ts";
import { PROBES, PROBE_ORDER, type Applicability, type ProbeReport, type ProbeResult, type ProbeSpec } from "./probes.ts";

/** The contract's fixed required set, in report order. */
export const CAPABILITIES: readonly Capability[] = ["env-scrub", "filesystem", "network", "ipc", "process-tree"];

/**
 * Display names. The contract key stays "ipc", but the profile is (allow default) and only
 * denies the securityd mach-lookup and the Keychains files, so nothing may claim general IPC.
 */
export const capabilityLabel = (c: Capability): string => (c === "ipc" ? "ipc (keychain)" : c);

/** Leading observations that state a capability's real scope. */
const SCOPE_NOTE: Readonly<Partial<Record<Capability, string>>> = {
  ipc: "ipc (keychain) only: Seatbelt denies the securityd mach-lookup and the Keychains files; other IPC (unix sockets, other mach services) is not contained under (allow default)",
};

const NOT_APPLICABLE: Readonly<Record<Applicability, string>> = {
  contained: "trusted workloads are not contained",
  "repo-denied": "installer reads the repo by design",
};

const appliesTo = (spec: ProbeSpec, workload: Workload): boolean =>
  spec.appliesTo === "repo-denied" ? workload === "host-check" || workload === "host-scenario" : workload !== "trusted-check";

/** fail > inconclusive > not measured > verified. */
function stateOf(results: readonly (ProbeResult | undefined)[]): EvidenceState {
  if (results.includes("fail")) return "failed";
  if (results.includes("inconclusive")) return "inconclusive";
  return results.length === 0 || results.includes(undefined) ? "not-measured" : "verified";
}

/** One capability's evidence for one workload: applicable probes measured, the rest say why not. */
export function capabilityEvidence(report: ProbeReport, capability: Capability, workload: Workload): CapabilityEvidence {
  const specs = PROBE_ORDER.map((id) => PROBES[id]).filter((s) => s.capability === capability);
  const applicable = specs.filter((s) => appliesTo(s, workload));
  const outcomes = applicable.map((s) => report.probes.find((p) => p.id === s.id));
  const measured = applicable.flatMap((s, i) => {
    const o = outcomes[i];
    return o ? o.observations.map((line) => `${s.id}: ${line}`) : [`${s.id}: not measured`];
  });
  const skipped = specs.filter((s) => !appliesTo(s, workload)).map((s) => `${s.id}: not applicable (${NOT_APPLICABLE[s.appliesTo]})`);
  const scope = SCOPE_NOTE[capability];
  return {
    state: stateOf(outcomes.map((o) => o?.result)),
    complete: applicable.length > 0 && outcomes.every((o) => o !== undefined),
    observations: [...(scope ? [scope] : []), ...measured, ...skipped],
  };
}

/** Pure: report + the requesting check's scope → the contract's backend evidence. */
export function evidenceFrom(report: ProbeReport, scope: { readonly checkId: string; readonly workload: Workload }): BackendEvidence {
  const capabilities = Object.fromEntries(CAPABILITIES.map((c) => [c, capabilityEvidence(report, c, scope.workload)]));
  return {
    mode: report.mode,
    available: report.mode === "seatbelt" || report.mode === "container",
    policyId: report.policyId,
    scope: { checkId: scope.checkId, workload: scope.workload },
    capabilities,
  };
}

/** Verified vs not-verified capability labels at the strictest scope (host-check: every probe applies). */
export function capabilitySummary(report: ProbeReport): { verified: string[]; failed: string[] } {
  const states = CAPABILITIES.map((c) => [capabilityLabel(c), capabilityEvidence(report, c, "host-check").state] as const);
  return {
    verified: states.filter(([, s]) => s === "verified").map(([c]) => c),
    failed: states.filter(([, s]) => s !== "verified").map(([c]) => c),
  };
}

/** The run-header line printed once the probes ran. */
export function probeHeadline(report: ProbeReport): string {
  if (!report.probes.length) return `sandbox probes  not run (${report.mode} mode: nothing to probe; contained checks are refused)`;
  const { verified, failed } = capabilitySummary(report);
  const head = `sandbox probes  ${report.mode} ${verified.length}/${CAPABILITIES.length} capabilities verified`;
  const tail = failed.length ? `not verified: ${failed.join(", ")}; contained checks are refused` : "profile not audited";
  return `${head} (${tail})  policy ${report.policyId.slice(0, 19)}`;
}

/** One env.json `sandbox.probes` entry. */
export interface ProbeRecord {
  readonly id: string;
  /** Display label (capabilityLabel), e.g. "ipc (keychain)". */
  readonly capability: string;
  readonly observation: string;
  readonly result: ProbeResult;
}

/** Pure: the report as env.json records, in run order; no report (quick, iso, error) → none. */
export function probeRecords(report: ProbeReport | undefined): readonly ProbeRecord[] {
  return (report?.probes ?? []).map((p) => ({ id: p.id, capability: capabilityLabel(p.capability), observation: p.observations.join("; "), result: p.result }));
}

/** Pure: env.json `sandbox.policyId` names a profile only when probes actually ran under it. */
export function policyRecord(report: ProbeReport | undefined): { policyId: string } | { policyId: null; policyIdReason: string } {
  if (!report) return { policyId: null, policyIdReason: "no probe ran (quick tier, or the probe run errored)" };
  if (!report.probes.length) return { policyId: null, policyIdReason: `no probe ran (${report.mode} mode)` };
  return { policyId: report.policyId };
}

/** Ties evidence to the exact profile that was probed. */
export function policyIdOf(profileText: string): string {
  return `sha256:${createHash("sha256").update(profileText).digest("hex")}`;
}
