// P1.1 pure capability/refusal contract (component-p1.md).
//
// Deterministic decision over trusted-supervisor input data only: no imports, no I/O,
// no environment/process/clock access, no global mutable state, no callbacks. A declared
// trusted-check is supplied by the trusted harness and needs no containment; every hostile
// workload (host-check, host-scenario, installer) requires complete, scope-matched, verified
// evidence for the fixed minimum capability set below, which caller input can never reduce.
// Unknown or malformed input fails closed with a structured refusal, never an exception
// for ordinary JSON-shaped data. Hostile proxies/getters and a compromised supervisor are
// outside this contract's threat model; this is a decision, not an unforgeable launch token.

export type Workload = "trusted-check" | "host-check" | "host-scenario" | "installer";
export type Capability = "env-scrub" | "filesystem" | "network" | "ipc" | "process-tree";
export type BackendMode = "none" | "iso" | "seatbelt" | "container";
export type EvidenceState = "verified" | "failed" | "inconclusive" | "not-measured";

export interface CapabilityEvidence {
  readonly state: EvidenceState;
  readonly complete: boolean;
  readonly observations: readonly string[];
}

export interface BackendEvidence {
  readonly mode: BackendMode;
  readonly available: boolean;
  readonly policyId: string;
  readonly scope: { readonly checkId: string; readonly workload: Workload };
  readonly capabilities: Readonly<Partial<Record<Capability, CapabilityEvidence>>>;
}

export interface AuthorizationInput {
  readonly checkId: string;
  readonly workload: Workload;
  readonly backend?: BackendEvidence;
}

export type RefusalCode =
  | "invalid-input"
  | "unsupported-mode"
  | "backend-unavailable"
  | "scope-mismatch"
  | "capability-unverified";

export type Authorization =
  | {
      readonly allowed: true;
      readonly checkId: string;
      readonly workload: Workload;
      readonly containment: "required" | "not-applicable";
    }
  | {
      readonly allowed: false;
      readonly code: RefusalCode;
      readonly reason: string;
      readonly missing: readonly Capability[];
    };

/** Fixed minimum for contained workloads; no caller-supplied override exists. */
const REQUIRED_CAPABILITIES: readonly Capability[] = [
  "env-scrub", "filesystem", "network", "ipc", "process-tree",
];

const WORKLOADS: readonly Workload[] = ["trusted-check", "host-check", "host-scenario", "installer"];
const BACKEND_MODES: readonly BackendMode[] = ["none", "iso", "seatbelt", "container"];
const CONTAINING_MODES: readonly BackendMode[] = ["seatbelt", "container"];
const EVIDENCE_STATES: readonly EvidenceState[] = ["verified", "failed", "inconclusive", "not-measured"];

interface AuthRequest {
  readonly checkId: string;
  readonly workload: Workload;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonblank(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

/** Narrows `candidate` to one of the given string literals without any cast. */
function oneOf<T extends string>(values: readonly T[], candidate: unknown): candidate is T {
  return values.some((value) => value === candidate);
}

function refuse(code: RefusalCode, reason: string, missing: readonly Capability[] = []): Authorization {
  return { allowed: false, code, reason, missing };
}

function invalid(reason: string): Authorization {
  return refuse("invalid-input", reason);
}

function allow(request: AuthRequest, containment: "required" | "not-applicable"): Authorization {
  return { allowed: true, checkId: request.checkId, workload: request.workload, containment };
}

/** Shape only: blank observation strings are shape-valid but fail the content check later. */
function isEvidenceShape(value: unknown): value is CapabilityEvidence {
  if (!isRecord(value)) return false;
  if (!oneOf(EVIDENCE_STATES, value["state"])) return false;
  if (typeof value["complete"] !== "boolean") return false;
  const observations = value["observations"];
  if (!Array.isArray(observations)) return false;
  return observations.every((observation): observation is string => typeof observation === "string");
}

type BackendValidation =
  | { readonly ok: true; readonly backend: BackendEvidence }
  | { readonly ok: false; readonly refusal: Authorization };

/** Validates the full declared shape of supplied backend data, even for trusted checks. */
function validateBackend(value: unknown): BackendValidation {
  if (!isRecord(value)) {
    return { ok: false, refusal: invalid("backend evidence must be a JSON object when supplied") };
  }
  const mode = value["mode"];
  if (!oneOf(BACKEND_MODES, mode)) {
    return { ok: false, refusal: invalid(`backend mode must be one of: ${BACKEND_MODES.join(", ")}`) };
  }
  const available = value["available"];
  if (typeof available !== "boolean") {
    return { ok: false, refusal: invalid("backend availability must be a boolean") };
  }
  const policyId = value["policyId"];
  if (!isNonblank(policyId)) {
    return { ok: false, refusal: invalid("backend policyId must be a nonempty, non-blank string") };
  }
  const scope = value["scope"];
  if (!isRecord(scope)) {
    return { ok: false, refusal: invalid("backend scope must be an object") };
  }
  const scopeCheckId = scope["checkId"];
  if (!isNonblank(scopeCheckId)) {
    return { ok: false, refusal: invalid("backend scope checkId must be a nonempty, non-blank string") };
  }
  const scopeWorkload = scope["workload"];
  if (!oneOf(WORKLOADS, scopeWorkload)) {
    return { ok: false, refusal: invalid("backend scope workload must be a known workload") };
  }
  const supplied = value["capabilities"];
  if (!isRecord(supplied)) {
    return { ok: false, refusal: invalid("backend capabilities must be an object keyed by capability") };
  }
  const capabilities: Partial<Record<Capability, CapabilityEvidence>> = {};
  for (const [name, entry] of Object.entries(supplied)) {
    if (!isEvidenceShape(entry)) {
      return { ok: false, refusal: invalid(`backend evidence for capability "${name}" is malformed`) };
    }
    // Unknown capability names carry no weight: the required set is fixed in this module.
    if (oneOf(REQUIRED_CAPABILITIES, name)) capabilities[name] = entry;
  }
  return {
    ok: true,
    backend: {
      mode,
      available,
      policyId,
      scope: { checkId: scopeCheckId, workload: scopeWorkload },
      capabilities,
    },
  };
}

/** Required capabilities lacking verified, complete, nonblank-observation evidence. */
function unverifiedCapabilities(backend: BackendEvidence): readonly Capability[] {
  return REQUIRED_CAPABILITIES.filter((capability) => {
    const evidence = backend.capabilities[capability];
    if (!evidence) return true;
    if (evidence.state !== "verified" || !evidence.complete) return true;
    return evidence.observations.length === 0
      || evidence.observations.some((observation) => observation.trim().length === 0);
  });
}

// A trusted-check declaration comes only from the trusted harness; it denotes trusted
// repository code, not safety for untrusted PR code. Containment is not required, but any
// supplied backend data is still shape-checked so malformed data cannot masquerade as proof.
function authorizeTrusted(request: AuthRequest, data: Record<string, unknown>): Authorization {
  if (data["backend"] === undefined) return allow(request, "not-applicable");
  const validation = validateBackend(data["backend"]);
  if (!validation.ok) return validation.refusal;
  return allow(request, "not-applicable");
}

function authorizeContained(request: AuthRequest, data: Record<string, unknown>): Authorization {
  const supplied = data["backend"];
  if (supplied === undefined) {
    return refuse(
      "backend-unavailable",
      `workload "${request.workload}" requires containment backend evidence, but none was supplied`,
      REQUIRED_CAPABILITIES,
    );
  }
  const validation = validateBackend(supplied);
  if (!validation.ok) return validation.refusal;
  const backend = validation.backend;
  if (!oneOf(CONTAINING_MODES, backend.mode)) {
    return refuse("unsupported-mode", `backend mode "${backend.mode}" cannot contain hostile workloads`);
  }
  if (!backend.available) {
    return refuse("backend-unavailable", `backend mode "${backend.mode}" is recorded as unavailable`);
  }
  if (backend.scope.checkId !== request.checkId || backend.scope.workload !== request.workload) {
    return refuse("scope-mismatch", "backend evidence scope does not match the requested check and workload");
  }
  const missing = unverifiedCapabilities(backend);
  if (missing.length > 0) {
    return refuse(
      "capability-unverified",
      `required capabilities lack verified, complete, nonblank evidence: ${missing.join(", ")}`,
      missing,
    );
  }
  return allow(request, "required");
}

/**
 * Pure, deterministic capability decision for one check/workload request.
 * Returns a structured refusal (never throws) for unknown or malformed JSON-shaped input,
 * and never lets caller input shrink the fixed required capability set. Evidence references
 * are not verified here; the trusted supervisor owns their truthfulness.
 */
export function authorize(input: unknown): Authorization {
  if (!isRecord(input)) return invalid("authorization input must be a JSON object");
  const checkId = input["checkId"];
  if (!isNonblank(checkId)) return invalid("checkId must be a nonempty, non-blank string");
  const workload = input["workload"];
  if (!oneOf(WORKLOADS, workload)) {
    return invalid(`workload must be one of: ${WORKLOADS.join(", ")}`);
  }
  const request: AuthRequest = { checkId, workload };
  if (workload === "trusted-check") return authorizeTrusted(request, input);
  return authorizeContained(request, input);
}
