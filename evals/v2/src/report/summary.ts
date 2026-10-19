// The per-area table (plan §2.3). The terminal output and summary.md are the same text.
import { AREAS, type CheckRow } from "../core/types.ts";
import { fmtMs, lpad, pad } from "./format.ts";

export interface SummaryHeader {
  tier: string;
  git: string;
  started: string;
  hostsLine: string;
  sandboxLine: string;
}

/** What the run's safety audits actually measured (P1.2 U4: no ✓ without evidence). */
export interface SandboxEvidence {
  mode: string;
  envScrub: string;
  agentRuns: number;
  canariesPlanted: number;
  canaryLeaks: number;
  authViolations: number;
  egress: number;
  outsideChanged: number;
}

/** The summary's sandbox line. The backend mode is never verified before P4; per-run audits only count when host runs happened. */
export function renderSandboxLine(e: SandboxEvidence): string {
  const outside = `outside-files ${e.outsideChanged ? "CHANGED ✗" : "unchanged ✓"}`;
  const head = `sandbox  ${e.mode} (unverified)  env-scrub ${e.envScrub}`;
  if (!e.agentRuns) return `${head}  not exercised (0 sandboxed host runs)  ${outside}`;
  return (
    `${head}  canary ${e.canaryLeaks}/${e.canariesPlanted} leaks ${e.canaryLeaks ? "✗" : "✓"}  ` +
    `auth-shape ${e.authViolations ? "✗" : "✓"}  egress: loopback-only ${e.egress ? "✗" : "✓"}  ` +
    `${outside}  (${e.agentRuns} sandboxed host runs)`
  );
}

export interface Totals {
  pass: number;
  fail: number;
  known: number;
  skip: number;
  fixed: number;
  ms: number;
}

export function totals(rows: CheckRow[]): Totals {
  const t: Totals = { pass: 0, fail: 0, known: 0, skip: 0, fixed: 0, ms: 0 };
  for (const r of rows) {
    t[r.status]++;
    t.ms += r.ms;
  }
  return t;
}

export function renderSummary(h: SummaryHeader, rows: CheckRow[], wallMs: number, exitCode: number, runDirRel: string, extra: string[] = []): string {
  const L: string[] = [];
  L.push(`OAC local suite  tier=${h.tier}  ${h.git}  ${h.started}`);
  L.push(h.hostsLine);
  L.push(h.sandboxLine);
  L.push("");
  L.push(`${pad("Area", 24)}${pad("Result", 7)}${lpad("Pass", 5)}${lpad("Fail", 5)}${lpad("Known", 6)}${lpad("Skip", 5)}${lpad("Time", 9)}`);
  for (const a of AREAS) {
    const rs = rows.filter((r) => r.area === a.id);
    if (!rs.length) continue;
    const t = totals(rs);
    const ran = rs.some((r) => r.status !== "skip");
    const res = !ran ? "–" : t.fail + t.known + t.fixed === 0 ? "✓" : "✗";
    L.push(`${pad(a.label, 24)}${pad(res, 7)}${lpad(String(t.pass), 5)}${lpad(String(t.fail + t.fixed), 5)}${lpad(String(t.known), 6)}${lpad(String(t.skip), 5)}${lpad(fmtMs(t.ms), 9)}`);
  }
  L.push("─".repeat(61));
  const T = totals(rows);
  const unexpected = T.fail + T.fixed;
  const res = unexpected + T.known === 0 ? "✓" : "✗";
  L.push(
    `${pad("Total", 24)}${pad(res, 7)}${lpad(String(T.pass), 5)}${lpad(String(unexpected), 5)}${lpad(String(T.known), 6)}${lpad(String(T.skip), 5)}${lpad(fmtMs(wallMs), 9)}   exit ${exitCode} (${T.known} known-red, ${unexpected} unexpected)`,
  );

  const line = (r: CheckRow, note: string, ref: string): string => {
    const target = r.artifacts ?? r.log;
    return `✗ ${pad(r.id, 30)} ${pad(note.slice(0, 70), 71)}${pad(ref, 6)}→ ${target}`;
  };
  const fails = rows.filter((r) => r.status === "fail" && !("refused" in r.sandbox));
  if (fails.length) {
    L.push("");
    L.push("UNEXPECTED FAILURES");
    for (const r of fails) L.push(line(r, r.summary ?? "failed", r.known?.ref ?? ""));
  }
  const refused = rows.filter((r) => "refused" in r.sandbox);
  if (refused.length) {
    L.push("");
    L.push("REFUSED (not run)");
    for (const r of refused) {
      if (!("refused" in r.sandbox)) continue;
      const { code, reason } = r.sandbox.refused;
      L.push(`${pad(`REFUSED (${code})`, 32)} ${pad(r.id, 30)} ${reason.slice(0, 90)}`);
    }
  }
  const fixed = rows.filter((r) => r.status === "fixed");
  if (fixed.length) {
    L.push("");
    L.push("Known-red now PASSING: fixed? remove it from evals/v2/src/checks/known-red.yaml");
    for (const r of fixed) L.push(`✓ ${pad(r.id, 30)} ${pad((r.summary ?? "passes").slice(0, 70), 71)}${pad(r.known?.ref ?? "", 6)}→ ${r.log}`);
  }
  const known = rows.filter((r) => r.status === "known");
  if (known.length) {
    L.push("");
    L.push("Not working yet (known-red, tracked)");
    for (const r of known) L.push(line(r, r.summary ?? r.known?.note ?? "", r.known?.ref ?? ""));
  }
  const skips = rows.filter((r) => r.status === "skip");
  if (skips.length) {
    L.push("");
    if (skips.length <= 5) L.push(`Skipped: ${skips.map((r) => `${r.id} (${r.skipReason ?? "skipped"})`).join(" · ")}`);
    else {
      L.push(`Skipped (${skips.length})`);
      for (const r of skips) L.push(`– ${pad(r.id, 40)} ${r.skipReason ?? "skipped"}`);
    }
  }
  for (const e of extra) L.push(e);
  L.push(`Results: ${runDirRel}/  (latest → symlink)`);
  return L.join("\n") + "\n";
}
