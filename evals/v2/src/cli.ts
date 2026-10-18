// pnpm test:local [quick|hosts|live|all] [--only <id-prefix>] [--strict] [--keep] [--rerun-failed] [--ci]
//
// Runs every check for the tier, writes .tmp/test-runs/<UTC-timestamp>/ (results.jsonl,
// summary.md, junit.xml, env.json, logs/), points .tmp/test-runs/latest at it and prints the
// per-area table. Exit codes: 0 = no unexpected failures; 1 = unexpected failure or a stale
// known-red; 2 = usage / not implemented; 3 = SANDBOX BREACH (a safety check tripped).
import { appendFileSync, existsSync, mkdirSync, readFileSync, rmSync, symlinkSync, unlinkSync, writeFileSync } from "node:fs";
import { arch, platform } from "node:os";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { allChecks } from "./checks/index.ts";
import { exec } from "./core/exec.ts";
import { loadKnownRed } from "./core/known-red.ts";
import { TIER_ORDER, type CheckRow, type RunContext, type Tier } from "./core/types.ts";
import { renderJunit } from "./report/junit.ts";
import { renderSummary } from "./report/summary.ts";
import { sandboxMode, suiteTmpRoot } from "./sandbox/env.ts";
import { runSelfTests } from "./sandbox/selftest.ts";
import { diffSnapshots, takeSnapshot } from "./sandbox/snapshot.ts";
import { safetyLedger } from "./sandbox/ledger.ts";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, "..", "..", "..");

interface Args {
  tier: Tier;
  only?: string;
  strict: boolean;
  keep: boolean;
  rerunFailed: boolean;
  ci: boolean;
}

function usage(msg?: string): never {
  if (msg) console.error(msg);
  console.error("usage: pnpm test:local [quick|hosts|live|all] [--only <id-prefix>] [--strict] [--keep] [--rerun-failed] [--ci]");
  process.exit(2);
}

function parseArgs(argv: string[]): Args {
  const a: Args = { tier: "quick", strict: false, keep: false, rerunFailed: false, ci: false };
  for (let i = 0; i < argv.length; i++) {
    const v = argv[i] as string;
    if (v === "--") continue;
    if ((TIER_ORDER as string[]).includes(v)) a.tier = v as Tier;
    else if (v === "--only") a.only = argv[++i] ?? usage("--only needs a value");
    else if (v.startsWith("--only=")) a.only = v.slice(7);
    else if (v === "--strict") a.strict = true;
    else if (v === "--keep") a.keep = true;
    else if (v === "--rerun-failed") a.rerunFailed = true;
    else if (v === "--ci") a.ci = true;
    else if (v === "--strict-sandbox" || v.startsWith("--sandbox")) usage("container sandbox (--strict-sandbox) is not implemented yet (plan step 8)");
    else if (v === "--budget" || v.startsWith("--budget=")) usage("live tier / --budget is not implemented yet (plan step 9)");
    else if (v === "-h" || v === "--help") usage();
    else usage(`unknown argument: ${v}`);
  }
  return a;
}

async function gitLine(): Promise<{ text: string; sha: string; branch: string; dirty: number; untracked: number }> {
  const sha = (await exec("git", ["rev-parse", "--short", "HEAD"], { cwd: REPO, stdoutOnly: true })).out.trim();
  const branch = (await exec("git", ["rev-parse", "--abbrev-ref", "HEAD"], { cwd: REPO, stdoutOnly: true })).out.trim();
  const st = (await exec("git", ["status", "--porcelain=v1"], { cwd: REPO, stdoutOnly: true })).out.split("\n").filter(Boolean);
  const untracked = st.filter((l) => l.startsWith("??")).length;
  const dirty = st.length - untracked;
  const extra = [dirty ? `${dirty} modified` : "", untracked ? `+${untracked} untracked` : ""].filter(Boolean).join(", ");
  return { text: `${branch}@${sha}${extra ? ` (${extra})` : ""}`, sha, branch, dirty, untracked };
}

async function hostVersion(bin: string): Promise<string | undefined> {
  const r = await exec(bin, ["--version"], { timeoutMs: 15_000, stdoutOnly: true, env: { PATH: process.env.PATH ?? "", HOME: process.env.HOME ?? "", DISABLE_AUTOUPDATER: "1" } });
  if (r.code !== 0) return undefined;
  return /(\d+\.\d+\.\d+)/.exec(r.out)?.[1];
}

async function main(): Promise<number> {
  const args = parseArgs(process.argv.slice(2));
  if (args.tier === "live") usage("the live tier (real model, metering proxy, --budget) is not implemented yet (plan step 9)");

  const started = new Date();
  const stamp = started.toISOString().replace(/\.\d+Z$/, "Z").replace(/:/g, "-");
  const runsRoot = join(REPO, ".tmp", "test-runs");
  const runDir = join(runsRoot, stamp);
  mkdirSync(join(runDir, "logs"), { recursive: true });
  const runId = stamp.replace(/[^0-9]/g, "").slice(2, 14);
  const tmpRoot = suiteTmpRoot(REPO);
  process.on("exit", () => {
    if (args.keep) process.stdout.write(`temp dirs kept: ${tmpRoot}\n`);
    else rmSync(tmpRoot, { recursive: true, force: true });
  });

  const knownRed = loadKnownRed(join(HERE, "checks", "known-red.yaml"));
  const tierIdx = TIER_ORDER.indexOf(args.tier);
  let checks = allChecks.filter((c) => TIER_ORDER.indexOf(c.tier) <= tierIdx);
  if (args.only) checks = checks.filter((c) => c.id.startsWith(args.only as string));
  if (args.rerunFailed) {
    const latest = join(runsRoot, "latest", "results.jsonl");
    if (!existsSync(latest)) usage("--rerun-failed: no .tmp/test-runs/latest/results.jsonl");
    const failed = new Set(
      readFileSync(latest, "utf8").split("\n").filter(Boolean)
        .map((l) => JSON.parse(l) as CheckRow).filter((r) => r.status === "fail" || r.status === "fixed").map((r) => r.id),
    );
    checks = checks.filter((c) => failed.has(c.id));
  }
  for (const id of Object.keys(knownRed)) if (!allChecks.some((c) => c.id === id)) console.error(`warning: known-red.yaml names unknown check ${id}`);

  const git = await gitLine();
  const versions = JSON.parse(readFileSync(join(HERE, "..", "versions.json"), "utf8")) as Record<string, string>;
  const oc = await hostVersion("opencode");
  const cc = await hostVersion("claude");
  const pinTxt = (name: string, v: string | undefined): string => {
    const pin = versions[name];
    if (!v) return `${name} absent`;
    return `${name} ${v} (pin ${pin ?? "?"} ${pin === v ? "✓" : "⚠ drift"})`;
  };
  const hostsLine = `hosts  ${pinTxt("opencode", oc)}  ${pinTxt("claude", cc)}  node ${process.versions.node}  ${platform()}-${arch()}`;

  const isTTY = process.stdout.isTTY && !args.ci;
  const say = (s: string): void => {
    process.stdout.write(s + "\n");
  };
  say(`OAC local suite  tier=${args.tier}  ${git.text}  ${started.toISOString().replace(/\.\d+Z$/, "Z")}`);
  say(hostsLine);

  // Safety: snapshot outside files, then prove the sandbox holds before any host process runs.
  const before = await takeSnapshot(REPO);
  const self = await runSelfTests(REPO, tmpRoot, runId);
  const selfBad = self.filter((t) => !t.ok);
  writeFileSync(join(runDir, "logs", "sandbox-selftest.log"), self.map((t) => `${t.ok ? "ok  " : "FAIL"} ${t.name}: ${t.detail}`).join("\n") + "\n");
  if (selfBad.length) {
    say(`\n!!! SANDBOX SELF-TEST FAILED — refusing to run any check !!!`);
    for (const t of selfBad) say(`  ✗ ${t.name}: ${t.detail}`);
    return 3;
  }
  say(`sandbox self-test  ${sandboxMode()} ✓  ${self.map((t) => t.name).join(" ")} ✓`);
  say("");

  const rows: CheckRow[] = [];
  const shared = new Map<string, unknown>();
  const t0 = Date.now();
  for (const c of checks) {
    const [areaDir, ...rest] = c.id.split("/");
    const logRel = join("logs", areaDir ?? "misc", `${rest.join("_").replace(/[^A-Za-z0-9@._-]/g, "_")}.log`);
    const logPath = join(runDir, logRel);
    mkdirSync(dirname(logPath), { recursive: true });
    writeFileSync(logPath, "");
    const ctx: RunContext = {
      repo: REPO, runDir, tmpRoot, runId, tier: args.tier, shared, logPath,
      log: (line) => appendFileSync(logPath, line + "\n"),
      artifactDir: (host) => {
        const p = join(runDir, "artifacts", c.id, host ?? "");
        mkdirSync(p, { recursive: true });
        return p;
      },
    };
    const s = Date.now();
    if (isTTY) process.stdout.write(`  … ${c.id}\r`);
    let outcome;
    try {
      outcome = await c.run(ctx);
    } catch (e) {
      ctx.log(`# check threw: ${e instanceof Error ? e.stack ?? e.message : String(e)}`);
      outcome = { ok: false, summary: `check threw: ${e instanceof Error ? e.message : String(e)}`.slice(0, 120) };
    }
    const kr = knownRed[c.id];
    let status: CheckRow["status"];
    if (outcome.skip) status = "skip";
    else if (kr) status = outcome.ok ? "fixed" : args.strict ? "fail" : "known";
    else status = outcome.ok ? "pass" : "fail";
    const row: CheckRow = {
      id: c.id, area: c.area, layer: c.layer, host: c.host, status,
      known: kr ? { ref: kr.ref, note: kr.note, until: kr.until } : undefined,
      ms: Date.now() - s, log: logRel,
      artifacts: outcome.artifacts ? relative(runDir, outcome.artifacts) : undefined,
      metrics: outcome.metrics,
      sandbox: { mode: outcome.sandbox?.mode ?? "none", canaryLeaks: outcome.sandbox?.canaryLeaks ?? 0, outsideChanged: outcome.sandbox?.outsideChanged ?? [], egress: outcome.sandbox?.egress ?? [] },
      skipReason: outcome.skip, summary: outcome.summary,
    };
    rows.push(row);
    appendFileSync(join(runDir, "results.jsonl"), JSON.stringify(row) + "\n");
    const mark = { pass: "✓", fail: "✗", known: "✗ (known)", skip: "– skip", fixed: "! FIXED?" }[status];
    say(`  ${mark.padEnd(10)} ${c.id.padEnd(40)} ${(row.ms / 1000).toFixed(1)}s${status === "fail" && row.summary ? `  ${row.summary}` : ""}`);
  }
  const wall = Date.now() - t0;

  // Post-run safety checks: outside files, canary leaks, auth shape.
  const after = await takeSnapshot(REPO);
  const outsideChanged = diffSnapshots(before, after);
  const ledger = safetyLedger();
  const breaches = [
    ...outsideChanged.map((p) => `outside file changed: ${p}`),
    ...ledger.canaryLeaks.map((l) => `canary leak: ${l}`),
    ...ledger.authViolations.map((l) => `auth shape: ${l}`),
    ...ledger.egress.map((l) => `egress: ${l}`),
  ];
  const agentRuns = ledger.agentRuns;
  const sandboxLine =
    `sandbox  ${sandboxMode()} ✓  env-scrub ✓  canary ${ledger.canaryLeaks.length}/${ledger.canariesPlanted} leaks ${ledger.canaryLeaks.length ? "✗" : "✓"}  ` +
    `auth-shape ${ledger.authViolations.length ? "✗" : "✓"}  egress: loopback-only ${ledger.egress.length ? "✗" : "✓"}  ` +
    `outside-files ${outsideChanged.length ? "CHANGED ✗" : "unchanged ✓"}  (${agentRuns} sandboxed host runs)`;

  const unexpected = rows.filter((r) => r.status === "fail" || r.status === "fixed").length;
  const exitCode = breaches.length ? 3 : unexpected ? 1 : 0;
  const extra: string[] = [];
  if (breaches.length) {
    extra.push("", "!!! SANDBOX BREACH — the run FAILS regardless of check results !!!");
    for (const b of breaches) extra.push(`  ✗ ${b}`);
  }
  const summary = renderSummary(
    { tier: args.tier, git: git.text, started: started.toISOString().replace(/\.\d+Z$/, "Z"), hostsLine, sandboxLine },
    rows, wall, exitCode, relative(REPO, runDir), extra,
  );
  writeFileSync(join(runDir, "summary.md"), "```\n" + summary + "```\n");
  writeFileSync(join(runDir, "junit.xml"), renderJunit(rows));
  writeFileSync(
    join(runDir, "env.json"),
    JSON.stringify({
      git, tier: args.tier, flags: { only: args.only, strict: args.strict, rerunFailed: args.rerunFailed, ci: args.ci },
      hosts: { opencode: oc, claude: cc, pins: versions }, node: process.versions.node, os: `${platform()}-${arch()}`,
      sandbox: { mode: sandboxMode(), selfTest: self, outsideChanged, ...ledger }, wallMs: wall,
    }, null, 2) + "\n",
  );
  const latest = join(runsRoot, "latest");
  try {
    unlinkSync(latest);
  } catch {
    /* none yet */
  }
  symlinkSync(stamp, latest);
  say("");
  process.stdout.write(summary);
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, "```\n" + summary + "```\n");

  return exitCode;
}

main().then(
  (code) => process.exit(code),
  (e: unknown) => {
    console.error(e instanceof Error ? e.stack ?? e.message : e);
    process.exit(2);
  },
);
