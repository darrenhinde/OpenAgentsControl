// Launch-funnel gate (P1.2 U3, component-p1-2.md): maps a check's WorkloadDecl onto the
// accepted P1.1 authorize() contract. contract.ts is unchanged.
//
// P3-lite U3: the backend evidence comes from the boundary-probe report the supervisor
// installs once per hosts run (installProbeReport, called only by main.ts), mapped per check
// by evidence.ts evidenceFrom. Without a report — quick, iso mode, a probe-run error — the
// evidence is scope-matched but unverified, so every contained workload (host-check,
// host-scenario, installer) is refused and only trusted-static/trusted-command checks launch.
//
// No imports of env.ts (it calls into this module); callers pass the backend mode in.
import type { WorkloadDecl } from "../core/types.ts";
import { authorize, type Authorization, type BackendEvidence, type BackendMode, type RefusalCode, type Workload } from "./contract.ts";
import { evidenceFrom } from "./evidence.ts";
import type { ProbeReport } from "./probes.ts";

/** The per-check declaration that reaches the funnel (threaded via RunContext/SandboxTarget). */
export interface LaunchDecl {
  readonly checkId: string;
  readonly workload: WorkloadDecl;
}

const CONTRACT_WORKLOAD: Readonly<Record<WorkloadDecl, Workload | undefined>> = {
  "trusted-static": "trusted-check",
  "trusted-command": "trusted-check",
  "host-check": "host-check",
  "host-scenario": "host-scenario",
  installer: "installer",
  deferred: undefined,
};

/**
 * Scope-matched backend evidence with no verified capabilities (no probe report for this mode).
 * policyId "unverified" is a placeholder: no probed profile backs it.
 */
export function unverifiedBackend(checkId: string, workload: Workload, mode: BackendMode): BackendEvidence {
  return {
    mode,
    available: mode === "seatbelt" || mode === "container",
    policyId: "unverified",
    scope: { checkId, workload },
    capabilities: {},
  };
}

/** Pure: probe evidence applies only to the mode it was measured in; otherwise it is unverified. */
export function backendEvidence(checkId: string, workload: Workload, mode: BackendMode, report: ProbeReport | undefined): BackendEvidence {
  return report && report.mode === mode ? evidenceFrom(report, { checkId, workload }) : unverifiedBackend(checkId, workload, mode);
}

/** Pure: one declaration under one backend mode and probe report → the P1.1 decision. Missing/unknown fails closed. */
export function decideLaunch(decl: LaunchDecl | undefined, mode: BackendMode, report: ProbeReport | undefined): Authorization {
  if (!decl) return { allowed: false, code: "invalid-input", reason: "no workload declaration reached the launch funnel", missing: [] };
  const workload = Object.hasOwn(CONTRACT_WORKLOAD, decl.workload) ? CONTRACT_WORKLOAD[decl.workload] : undefined;
  if (decl.workload === "deferred") {
    return { allowed: false, code: "invalid-input", reason: "deferred workloads never launch", missing: [] };
  }
  if (!workload) {
    return { allowed: false, code: "invalid-input", reason: `unknown workload declaration "${String(decl.workload)}"`, missing: [] };
  }
  if (workload === "trusted-check") return authorize({ checkId: decl.checkId, workload });
  return authorize({ checkId: decl.checkId, workload, backend: backendEvidence(decl.checkId, workload, mode, report) });
}

let installed: ProbeReport | undefined;

function deepFreeze<T>(value: T): T {
  if (typeof value === "object" && value !== null) {
    Object.values(value).forEach(deepFreeze);
    Object.freeze(value);
  }
  return value;
}

/**
 * Set once by the supervisor (main.ts) after the probes ran, so the inner funnel guards
 * (runHost/runIsolated/mainCheckoutOf/cmdCheck) see the same evidence orchestrate authorized
 * with. A second install throws: the evidence cannot be swapped mid-run. A deep-frozen copy is
 * installed and returned, so neither the caller's original nor the returned copy can change it.
 */
export function installProbeReport(report: ProbeReport): ProbeReport {
  if (installed) throw new Error("sandbox: a probe report is already installed for this run");
  installed = deepFreeze(structuredClone(report));
  return installed;
}

/** The funnel decision: decideLaunch over the installed probe report (none → unverified). */
export function launchAuthorization(decl: LaunchDecl | undefined, mode: BackendMode): Authorization {
  return decideLaunch(decl, mode, installed);
}

/** A refused launch; orchestrate maps it to a non-waivable fail row. */
export class LaunchRefused extends Error {
  readonly checkId: string;
  readonly code: RefusalCode;
  readonly reason: string;
  constructor(checkId: string, code: RefusalCode, reason: string) {
    super(`launch refused (${code}): ${reason}`);
    this.name = "LaunchRefused";
    this.checkId = checkId;
    this.code = code;
    this.reason = reason;
  }
}

/** Funnel guard: call as the FIRST statement, before any dir, canary, mock, git or spawn. */
export function assertLaunchAllowed(decl: LaunchDecl | undefined, mode: BackendMode): void {
  const auth = launchAuthorization(decl, mode);
  if (!auth.allowed) throw new LaunchRefused(decl?.checkId ?? "?", auth.code, auth.reason);
}

/**
 * Guard for the contained funnel (runHost/runIsolated/mainCheckoutOf): like assertLaunchAllowed,
 * but a trusted declaration is refused too, so a check mis-declared as trusted can never reach
 * a sandboxed host launch without verified containment.
 */
export function assertContainedLaunch(decl: LaunchDecl | undefined, mode: BackendMode): void {
  const auth = launchAuthorization(decl, mode);
  if (!auth.allowed) throw new LaunchRefused(decl?.checkId ?? "?", auth.code, auth.reason);
  if (auth.containment !== "required") {
    throw new LaunchRefused(auth.checkId, "invalid-input", `trusted declaration "${decl?.workload ?? "?"}" may not use the contained launch funnel`);
  }
}
