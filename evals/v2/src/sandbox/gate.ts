// Launch-funnel gate (P1.2 U3, component-p1-2.md): maps a check's WorkloadDecl onto the
// accepted P1.1 authorize() contract with the only backend evidence the harness can mint
// today — scope-matched but with NO verified capability. Until P3/P4 verify capabilities,
// every contained workload (host-check, host-scenario, installer) is therefore refused, and
// only trusted-static/trusted-command checks launch. contract.ts is unchanged.
//
// No imports of env.ts (it calls into this module); callers pass the backend mode in.
import type { WorkloadDecl } from "../core/types.ts";
import { authorize, type Authorization, type BackendEvidence, type BackendMode, type RefusalCode, type Workload } from "./contract.ts";

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
 * Scope-matched backend evidence with no verified capabilities (production until P3/P4).
 * policyId "unverified" is a placeholder: no real backend policy is identified until P4.
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

/** Pure: one declaration under one backend mode → the P1.1 decision. Missing/unknown fails closed. */
export function launchAuthorization(decl: LaunchDecl | undefined, mode: BackendMode): Authorization {
  if (!decl) return { allowed: false, code: "invalid-input", reason: "no workload declaration reached the launch funnel", missing: [] };
  const workload = Object.hasOwn(CONTRACT_WORKLOAD, decl.workload) ? CONTRACT_WORKLOAD[decl.workload] : undefined;
  if (decl.workload === "deferred") {
    return { allowed: false, code: "invalid-input", reason: "deferred workloads never launch", missing: [] };
  }
  if (!workload) {
    return { allowed: false, code: "invalid-input", reason: `unknown workload declaration "${String(decl.workload)}"`, missing: [] };
  }
  if (workload === "trusted-check") return authorize({ checkId: decl.checkId, workload });
  return authorize({ checkId: decl.checkId, workload, backend: unverifiedBackend(decl.checkId, workload, mode) });
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
