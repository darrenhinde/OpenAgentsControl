import type { CheckRow } from "../core/types.ts";

const esc = (s: string): string => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export function renderJunit(rows: CheckRow[]): string {
  const byArea = new Map<string, CheckRow[]>();
  for (const r of rows) byArea.set(r.area, [...(byArea.get(r.area) ?? []), r]);
  const suites = [...byArea.entries()].map(([area, rs]) => {
    const failures = rs.filter((r) => r.status === "fail" || r.status === "fixed").length;
    const skipped = rs.filter((r) => r.status === "skip" || r.status === "known").length;
    const cases = rs.map((r) => {
      const inner =
        "refused" in r.sandbox ? `<failure type="refused" message="REFUSED (${esc(r.sandbox.refused.code)}): ${esc(r.sandbox.refused.reason)}"/>`
        : r.status === "fail" ? `<failure message="${esc(r.summary ?? "failed")}"/>`
        : r.status === "fixed" ? `<failure message="known-red now passes; remove it from known-red.yaml"/>`
        : r.status === "known" ? `<skipped message="known-red ${esc(r.known?.ref ?? "")}: ${esc(r.summary ?? r.known?.note ?? "")}"/>`
        : r.status === "skip" ? `<skipped message="${esc(r.skipReason ?? "")}"/>`
        : "";
      return `    <testcase classname="${esc(area)}" name="${esc(r.id)}" time="${(r.ms / 1000).toFixed(3)}">${inner}</testcase>`;
    });
    return `  <testsuite name="${esc(area)}" tests="${rs.length}" failures="${failures}" skipped="${skipped}">\n${cases.join("\n")}\n  </testsuite>`;
  });
  return `<?xml version="1.0" encoding="UTF-8"?>\n<testsuites>\n${suites.join("\n")}\n</testsuites>\n`;
}
