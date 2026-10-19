import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { loadKnownRed } from "../../src/core/known-red.ts";
import type { CheckRow } from "../../src/core/types.ts";
import { renderJunit } from "../../src/report/junit.ts";
import { renderSandboxLine, renderSummary, totals } from "../../src/report/summary.ts";

const row = (id: string, area: CheckRow["area"], status: CheckRow["status"], extra: Partial<CheckRow> = {}): CheckRow => ({
  id, area, layer: "L0", status, ms: 1000, log: `logs/${id}.log`,
  sandbox: { mode: "none", canaryLeaks: 0, outsideChanged: [], egress: [] }, ...extra,
});

describe("summary table", () => {
  const rows = [
    row("build/a", "build", "pass"),
    row("gates/x", "gates", "known", { known: { ref: "#349", note: "hidden tools" }, summary: "12 agents" }),
    row("ctx/y", "context", "skip", { skipReason: "no bun" }),
  ];
  const text = renderSummary({ tier: "quick", git: "b@abc", started: "t", hostsLine: "hosts", sandboxLine: "sandbox" }, rows, 3000, 0, ".tmp/test-runs/x");

  it("has one line per area with rows, and a total", () => {
    expect(text).toMatch(/^Build\s+✓\s+1\s+0\s+0\s+0/m);
    expect(text).toMatch(/^Policy\/gates\s+✗\s+0\s+0\s+1\s+0/m);
    expect(text).toMatch(/^Context\s+–\s+0\s+0\s+0\s+1/m);
    expect(text).toMatch(/^Total\s+✗\s+1\s+0\s+1\s+1\s+3\.0s\s+exit 0 \(1 known-red, 0 unexpected\)/m);
    expect(text).not.toMatch(/^OpenCode v2 load/m);
  });
  it("lists known-reds with their ref and log", () => {
    expect(text).toContain("Not working yet (known-red, tracked)");
    expect(text).toMatch(/✗ gates\/x\s+12 agents\s+#349\s+→ logs\/gates\/x\.log/);
  });
  it("counts a fixed known-red as a failure", () => {
    const t = totals([row("a/b", "build", "fixed")]);
    expect(t.fixed).toBe(1);
    const s = renderSummary({ tier: "quick", git: "", started: "", hostsLine: "", sandboxLine: "" }, [row("a/b", "build", "fixed", { known: { ref: "#1", note: "n" } })], 1, 1, "r");
    expect(s).toContain("remove it from");
    expect(s).toMatch(/exit 1 \(0 known-red, 1 unexpected\)/);
  });
});

describe("known-red.yaml", () => {
  it("loads the checked-in file", () => {
    const kr = loadKnownRed(join(__dirname, "..", "..", "src", "checks", "known-red.yaml"));
    for (const v of Object.values(kr)) expect(v.ref).toBeTruthy();
  });
  it("rejects entries without a ref", () => {
    const d = mkdtempSync(join(tmpdir(), "kr-"));
    writeFileSync(join(d, "k.yaml"), "gates/x:\n  until: v1\n  note: n\n");
    expect(() => loadKnownRed(join(d, "k.yaml"))).toThrow(/ref/);
  });
});

// U4 (component-p1-2.md): refusals are visible, honest and never read as skipped or green.
const refusedRow = (id: string, code: string, reason: string): CheckRow => ({
  id, area: "cc-load", layer: "L0", status: "fail", ms: 0, log: "",
  sandbox: { mode: "none", refused: { code, reason } },
  summary: `launch refused (${code}): ${reason}`,
});

describe("summary: refused rows", () => {
  const rows = [
    row("build/a", "build", "pass"),
    row("build/b", "build", "fail", { summary: "exit 1: boom" }),
    refusedRow("cc/x", "capability-unverified", "required capabilities lack verified evidence"),
  ];
  const text = renderSummary({ tier: "hosts", git: "", started: "", hostsLine: "", sandboxLine: "" }, rows, 1, 1, "r");

  it("lists refused rows in their own section as REFUSED (code), not as a bare ✗ failure", () => {
    expect(text).toContain("REFUSED (not run)");
    expect(text).not.toContain("launch not authorized");
    expect(text).toMatch(/REFUSED \(capability-unverified\)\s+cc\/x\s+required capabilities lack verified evidence/);
    const failures = text.slice(text.indexOf("UNEXPECTED FAILURES"), text.indexOf("REFUSED (not run)"));
    expect(failures).toContain("build/b");
    expect(failures).not.toContain("cc/x");
  });

  it("still counts a refusal as an unexpected failure in the totals", () => {
    expect(text).toMatch(/exit 1 \(0 known-red, 2 unexpected\)/);
    expect(text).toMatch(/^Claude Code load\s+✗\s+0\s+1/m);
  });
});

describe("junit: refused rows", () => {
  it("maps a refusal to a failure with type=refused, never skipped", () => {
    const xml = renderJunit([refusedRow("cc/x", "capability-unverified", "no evidence")]);
    expect(xml).toContain('failures="1" skipped="0"');
    expect(xml).toContain('<failure type="refused" message="REFUSED (capability-unverified): no evidence"/>');
    expect(xml).not.toContain("<skipped");
  });

  it("keeps a refusal a failure even when the row also names a known-red entry", () => {
    const xml = renderJunit([{ ...refusedRow("cc/x", "capability-unverified", "no evidence"), known: { ref: "#349", note: "red" } }]);
    expect(xml).toContain('failures="1" skipped="0"');
    expect(xml).toContain('type="refused"');
    expect(xml).not.toContain("known-red");
  });
});

describe("renderSandboxLine: no ✓ without evidence", () => {
  const base = {
    mode: "seatbelt", envScrub: "not run", agentRuns: 0, canariesPlanted: 0,
    canaryLeaks: 0, authViolations: 0, egress: 0, outsideChanged: 0,
  };

  it("with zero sandboxed host runs, says the sandbox was not exercised and claims no canary/auth/egress ✓", () => {
    const line = renderSandboxLine(base);
    expect(line).toContain("seatbelt (unverified)");
    expect(line).not.toContain("seatbelt ✓");
    expect(line).toContain("not exercised (0 sandboxed host runs)");
    expect(line).not.toMatch(/canary|auth-shape|egress/);
    expect(line).toContain("env-scrub not run");
    expect(line).toContain("outside-files unchanged ✓");
  });

  it("with host runs, reports each measured audit and marks failures ✗", () => {
    const clean = renderSandboxLine({ ...base, agentRuns: 2, canariesPlanted: 6 });
    expect(clean).toContain("canary 0/6 leaks ✓");
    expect(clean).toContain("auth-shape ✓");
    expect(clean).toContain("egress: loopback-only ✓");
    expect(clean).toContain("(2 sandboxed host runs)");
    const dirty = renderSandboxLine({ ...base, agentRuns: 1, canariesPlanted: 3, canaryLeaks: 1, authViolations: 1, egress: 1, outsideChanged: 2 });
    expect(dirty).toContain("canary 1/3 leaks ✗");
    expect(dirty).toContain("auth-shape ✗");
    expect(dirty).toContain("egress: loopback-only ✗");
    expect(dirty).toContain("outside-files CHANGED ✗");
  });
});
