import { describe, expect, it } from "vitest";
import { authorize } from "../../src/sandbox/contract.ts";
import type {
  Authorization, AuthorizationInput, BackendEvidence, BackendMode,
  Capability, CapabilityEvidence, RefusalCode, Workload,
} from "../../src/sandbox/contract.ts";

// P1.1: synthetic supervisor evidence only; these references prove no real containment.
const CAPABILITIES = ["env-scrub", "filesystem", "network", "ipc", "process-tree"] as const satisfies readonly Capability[];
const CONTAINED = ["host-check", "host-scenario", "installer"] as const satisfies readonly Workload[];
const MODES = ["seatbelt", "container"] as const satisfies readonly BackendMode[];

function evidence(): CapabilityEvidence {
  return { state: "verified", complete: true, observations: ["synthetic:boundary-observation"] };
}

function backend(workload: Workload = "host-check", mode: BackendMode = "seatbelt"): BackendEvidence {
  return {
    mode, available: true, policyId: "synthetic-policy-v1",
    scope: { checkId: "synthetic/check", workload },
    capabilities: {
      "env-scrub": evidence(), filesystem: evidence(), network: evidence(),
      ipc: evidence(), "process-tree": evidence(),
    },
  };
}

function input(workload: Workload = "host-check", mode: BackendMode = "seatbelt"):
AuthorizationInput & { readonly backend: BackendEvidence } {
  return { checkId: "synthetic/check", workload, backend: backend(workload, mode) };
}

function refusal(result: Authorization, code?: RefusalCode): void {
  expect(result.allowed).toBe(false);
  if (result.allowed) throw new Error("Expected a structured refusal");
  if (code !== undefined) expect(result.code).toBe(code);
  expect(result.reason.trim().length).toBeGreaterThan(0);
  expect(Array.isArray(result.missing)).toBe(true);
}

function freeze(value: unknown): void {
  if (typeof value !== "object" || value === null) return;
  Object.values(value).forEach(freeze);
  Object.freeze(value);
}

describe("authorize: explicit trusted declaration (P1.1 groups 1–2)", () => {
  it("allows a trusted check without containment evidence", () => {
    // Arrange
    const request: AuthorizationInput = { checkId: "trusted/unit", workload: "trusted-check" };
    // Act
    const result = authorize(request);
    // Assert
    expect(result).toEqual({ allowed: true, checkId: request.checkId, workload: "trusted-check", containment: "not-applicable" });
  });

  it("does not require verified containment for a well-shaped trusted backend", () => {
    // Arrange
    const request = input("trusted-check", "iso");
    const supplied = { ...request, backend: { ...request.backend, available: false, capabilities: {} } };
    // Act
    const result = authorize(supplied);
    // Assert
    expect(result).toEqual({ allowed: true, checkId: request.checkId, workload: "trusted-check", containment: "not-applicable" });
  });

  it.each([null, [], "seatbelt", { ...backend("trusted-check"), available: "yes" }].map((value) => ({ value })))(
    "rejects malformed provided backend on a trusted check: $value", ({ value }) => {
      // Arrange
      const request = { checkId: "synthetic/check", workload: "trusted-check", backend: value };
      // Act
      const result = authorize(request);
      // Assert
      refusal(result, "invalid-input");
    },
  );
});

describe.each(CONTAINED)("authorize: %s containment (P1.1 groups 3, 7–8)", (workload) => {
  it.each(MODES)("allows complete matching synthetic %s evidence", (mode) => {
    // Arrange
    const request = input(workload, mode);
    // Act
    const result = authorize(request);
    // Assert
    expect(result).toEqual({ allowed: true, checkId: request.checkId, workload, containment: "required" });
  });

  it("refuses a missing backend without an implicit iso fallback", () => {
    // Arrange
    const request = { checkId: "synthetic/check", workload };
    // Act
    const result = authorize(request);
    // Assert - the plan deliberately does not fix this refusal code.
    refusal(result);
  });

  it.each(["none", "iso"] as const)("refuses %s even with complete evidence", (mode) => {
    // Arrange
    const request = input(workload, mode);
    // Act
    const result = authorize(request);
    // Assert
    refusal(result, "unsupported-mode");
  });

  it.each([
    { required: [] },
    { sourceRead: true },
    { required: [], sourceRead: { allowed: true, path: "synthetic/source" } },
  ])("does not let caller overrides weaken missing capabilities: %j", (override) => {
    // Arrange
    const request = input(workload);
    const supplied = { ...request, ...override, backend: { ...request.backend, capabilities: {} } };
    // Act
    const result = authorize(supplied);
    // Assert - unsupported fields may be rejected or ignored, never grant access.
    refusal(result);
  });
});

describe("authorize: scoped backend evidence (P1.1 groups 4, 6)", () => {
  it("refuses a well-shaped unavailable backend", () => {
    // Arrange
    const request = input();
    const supplied = { ...request, backend: { ...request.backend, available: false } };
    // Act
    const result = authorize(supplied);
    // Assert
    refusal(result, "backend-unavailable");
  });

  it.each([
    { checkId: "other/check", workload: "host-check" },
    { checkId: "synthetic/check", workload: "host-scenario" },
  ] as const)("refuses mismatched scope: %j", (scope) => {
    // Arrange
    const request = input();
    const supplied = { ...request, backend: { ...request.backend, scope } };
    // Act
    const result = authorize(supplied);
    // Assert
    refusal(result, "scope-mismatch");
  });

  it.each(MODES)("does not accept a %s label and legacy ok as proof", (mode) => {
    // Arrange
    const request = input("host-check", mode);
    const supplied = { ...request, backend: { ...request.backend, capabilities: {}, ok: true } };
    // Act
    const result = authorize(supplied);
    // Assert
    refusal(result);
  });

  it.each(MODES)("refuses a %s label alone", (mode) => {
    // Arrange
    const request = { checkId: "synthetic/check", workload: "host-check", backend: { mode } };
    // Act
    const result = authorize(request);
    // Assert - several fields are absent, so no precedence is asserted.
    refusal(result);
  });
});

describe.each(CAPABILITIES)("authorize: mandatory %s evidence (P1.1 groups 5–6)", (capability) => {
  it("refuses when this capability alone is missing", () => {
    // Arrange
    const request = input();
    const capabilities = { ...request.backend.capabilities };
    delete capabilities[capability];
    const supplied = { ...request, backend: { ...request.backend, capabilities } };
    // Act
    const result = authorize(supplied);
    // Assert
    refusal(result, "capability-unverified");
    if (!result.allowed) expect(result.missing).toContain(capability);
  });

  it.each(["failed", "inconclusive", "not-measured"] as const)("refuses state %s", (state) => {
    // Arrange
    const request = input();
    const capabilities = { ...request.backend.capabilities, [capability]: { ...evidence(), state } };
    // Act
    const result = authorize({ ...request, backend: { ...request.backend, capabilities } });
    // Assert
    refusal(result, "capability-unverified");
  });

  it.each([
    { label: "incomplete", replacement: { ...evidence(), complete: false } },
    { label: "empty observations", replacement: { ...evidence(), observations: [] } },
    { label: "blank observation", replacement: { ...evidence(), observations: [" \t\n"] } },
    { label: "mixed valid and blank observations", replacement: { ...evidence(), observations: ["synthetic:ok", ""] } },
  ])("refuses $label", ({ replacement }) => {
    // Arrange
    const request = input();
    const capabilities = { ...request.backend.capabilities, [capability]: replacement };
    // Act
    const result = authorize({ ...request, backend: { ...request.backend, capabilities } });
    // Assert - blank references cannot count as proof, irrespective of refusal classification.
    refusal(result);
  });

  it.each([
    null, [], "verified", {},
    { ...evidence(), state: "unknown" },
    { ...evidence(), state: null },
    { ...evidence(), state: true },
    { ...evidence(), complete: "true" },
    { state: "verified", observations: ["synthetic:ok"] },
    { state: "verified", complete: true },
    { ...evidence(), observations: "synthetic:ok" },
    { ...evidence(), observations: [null] },
    { ...evidence(), observations: [1] },
    { ...evidence(), observations: {} },
  ].map((value) => ({ value })))("refuses malformed capability evidence without throwing: $value", ({ value }) => {
    // Arrange
    const request = input();
    const capabilities = { ...request.backend.capabilities, [capability]: value };
    // Act - any exception fails the test; authorize must return a refusal.
    const result = authorize({ ...request, backend: { ...request.backend, capabilities } });
    // Assert
    refusal(result, "invalid-input");
  });
});

describe("authorize: non-vacuous capability map (P1.1 group 5)", () => {
  it("refuses an empty capability map with all five mandatory capabilities missing", () => {
    // Arrange
    const request = input();
    const supplied = { ...request, backend: { ...request.backend, capabilities: {} } };
    // Act
    const result = authorize(supplied);
    // Assert
    refusal(result, "capability-unverified");
    if (!result.allowed) {
      expect(result.missing).toHaveLength(CAPABILITIES.length);
      expect(result.missing).toEqual(expect.arrayContaining([...CAPABILITIES]));
    }
  });

  it("refuses an absent capability map", () => {
    // Arrange
    const request = input();
    const { capabilities: _omitted, ...withoutCapabilities } = request.backend;
    const supplied = { ...request, backend: withoutCapabilities };
    // Act
    const result = authorize(supplied);
    // Assert - missing evidence cannot authorize, with no unspecified code requirement.
    refusal(result);
  });
});

describe("authorize: malformed ordinary JSON-shaped inputs (P1.1 groups 2, 4–5, 9)", () => {
  it.each([
    null, [], ["trusted-check"], true, false, 0, "trusted-check", {},
    { checkId: "synthetic/check" },
    { checkId: "synthetic/check", workload: "unknown" },
    { checkId: "synthetic/check", workload: null },
    { checkId: "synthetic/check", workload: [] },
    { checkId: "synthetic/check", workload: { trusted: true } },
    { workload: "trusted-check" },
    { checkId: "", workload: "trusted-check" },
    { checkId: " \t\n", workload: "trusted-check" },
    { checkId: 1, workload: "trusted-check" },
    { checkId: null, workload: "trusted-check" },
    { checkId: [], workload: "trusted-check" },
    { checkId: {}, workload: "trusted-check" },
  ].map((value) => ({ value })))("returns invalid-input, never an implicit trusted default: $value", ({ value }) => {
    // Arrange - the table contains only inert JSON-shaped values.
    const supplied: unknown = value;
    // Act - a throw is a failure, not an acceptable refusal.
    const result = authorize(supplied);
    // Assert
    refusal(result, "invalid-input");
  });

  it.each([
    { field: "mode", value: "unknown" },
    { field: "mode", value: null },
    { field: "available", value: "true" },
    { field: "available", value: null },
    { field: "policyId", value: "" },
    { field: "policyId", value: " \t\n" },
    { field: "policyId", value: 1 },
    { field: "scope", value: null },
    { field: "scope", value: [] },
    { field: "scope", value: {} },
    { field: "scope", value: { checkId: "", workload: "host-check" } },
    { field: "scope", value: { checkId: "synthetic/check", workload: "unknown" } },
    { field: "capabilities", value: null },
    { field: "capabilities", value: [] },
    { field: "capabilities", value: "verified" },
  ])("rejects malformed backend $field = $value", ({ field, value }) => {
    // Arrange
    const request = input();
    const supplied = { ...request, backend: { ...request.backend, [field]: value } };
    // Act
    const result = authorize(supplied);
    // Assert
    refusal(result, "invalid-input");
  });

  it("rejects a missing policy identity", () => {
    // Arrange
    const request = input();
    const { policyId: _omitted, ...withoutPolicy } = request.backend;
    // Act
    const result = authorize({ ...request, backend: withoutPolicy });
    // Assert
    refusal(result, "invalid-input");
  });
});

describe("authorize: purity (P1.1 group 9)", () => {
  it.each([true, false])("is deterministic and preserves deep-frozen input; complete = %s", (complete) => {
    // Arrange - independently constructed expected data avoids shared-reference comparisons.
    const fixture = () => {
      const request = input();
      return {
        ...request,
        backend: {
          ...request.backend,
          capabilities: { ...request.backend.capabilities, filesystem: { ...evidence(), complete } },
        },
      };
    };
    const request = fixture();
    const original = fixture();
    freeze(request);
    // Act
    const first = authorize(request);
    const second = authorize(request);
    // Assert
    expect(first).toEqual(second);
    expect(request).toEqual(original);
    if (complete) expect(first.allowed).toBe(true);
    if (!complete) refusal(first, "capability-unverified");
  });
});
