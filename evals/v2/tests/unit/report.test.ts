import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { loadKnownRed } from "../../src/core/known-red.ts";
import type { CheckRow } from "../../src/core/types.ts";
import { renderSummary, totals } from "../../src/report/summary.ts";

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
