// The local suite's main(): wires the real effects (runDir/logs, gitLine, known-red, version
// probes, launch authorization, snapshots, reports) into core/orchestrate.ts. Importing this
// module has no side effects (tests/unit/cli-import.test.ts); src/cli.ts is the executable
// entry that calls main(). See cli.ts for usage and exit codes.
import { appendFileSync, existsSync, mkdirSync, readFileSync, rmSync, symlinkSync, unlinkSync, writeFileSync } from "node:fs";
import { arch, platform } from "node:os";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { allChecks } from "./checks/index.ts";
import { exec } from "./core/exec.ts";
import { loadKnownRed } from "./core/known-red.ts";
import { envScrubLabel, orchestrate, parseArgs } from "./core/orchestrate.ts";
import type { CheckDef, CheckRow, RunContext } from "./core/types.ts";
import { renderJunit } from "./report/junit.ts";
import { renderSandboxLine, renderSummary } from "./report/summary.ts";
import { sandboxMode, suiteTmpRoot } from "./sandbox/env.ts";
import { capabilitySummary, policyRecord, probeRecords } from "./sandbox/evidence.ts";
import { decideLaunch, installProbeReport } from "./sandbox/gate.ts";
import { currentPolicyId, probeSandbox } from "./sandbox/probe-runner.ts";
import type { ProbeReport } from "./sandbox/probes.ts";
import { diffSnapshots, takeSnapshot } from "./sandbox/snapshot.ts";
import { safetyLedger } from "./sandbox/ledger.ts";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, "..", "..", "..");

function usage(msg?: string): never {
  if (msg) console.error(msg);
  console.error("usage: pnpm test:local [quick|hosts|live|all] [--only <id-prefix>] [--strict] [--keep] [--rerun-failed] [--ci]");
  process.exit(2);
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

export async function main(): Promise<number> {
  const args = parseArgs(process.argv.slice(2), usage);
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
  // --rerun-failed reads the previous run's failed ids as data; selection restricts to them.
  let failedIds: string[] = [];
  if (args.rerunFailed) {
    const latest = join(runsRoot, "latest", "results.jsonl");
    if (!existsSync(latest)) usage("--rerun-failed: no .tmp/test-runs/latest/results.jsonl");
    failedIds = readFileSync(latest, "utf8").split("\n").filter(Boolean)
      .map((l) => JSON.parse(l) as CheckRow).filter((r) => r.status === "fail" || r.status === "fixed").map((r) => r.id);
  }
  for (const id of Object.keys(knownRed)) if (!allChecks.some((c) => c.id === id)) console.error(`warning: known-red.yaml names unknown check ${id}`);

  const git = await gitLine();
  const versions = JSON.parse(readFileSync(join(HERE, "..", "versions.json"), "utf8")) as Record<string, string>;

  // Report inputs captured from the orchestration effects: version and boundary probes run
  // inside orchestrate (behind selection — quick performs none), so their results reach
  // env.json/summary through these wrappers.
  const policyId = currentPolicyId();
  let probeReport: ProbeReport | undefined;
  let oc: string | undefined;
  let cc: string | undefined;
  let outsideChanged: string[] = [];
  let ledger = safetyLedger();
  let breaches: string[] = [];
  let hostsLine = "";
  const rows: CheckRow[] = [];
  const shared = new Map<string, unknown>();
  const say = (s: string): void => {
    if (s.startsWith("hosts ")) hostsLine = s;
    process.stdout.write(s + "\n");
  };

  // Safety: snapshot outside files before the run; the after-snapshot and breach
  // computation happen in collectBreaches, after the last check.
  const before = await takeSnapshot(REPO);

  const t0 = Date.now();
  const exitCode = await orchestrate({
    argv: process.argv.slice(2),
    checks: allChecks,
    failedIds,
    knownRed,
    pins: versions,
    repo: REPO,
    tmpRoot,
    runId,
    hostVersion: async (bin) => {
      const v = await hostVersion(bin);
      if (bin === "opencode") oc = v;
      if (bin === "claude") cc = v;
      return v;
    },
    // Boundary probes (P3-lite): the report is installed once so the inner funnel guards see
    // the same evidence orchestrate authorizes with. No report → unverified → contained refused.
    runProbes: async () => {
      const report = await probeSandbox({ mode: sandboxMode(), repo: REPO, tmpRoot, runId, policyId });
      // The frozen installed copy is what every later decision and report reads.
      probeReport = installProbeReport(report);
      return probeReport;
    },
    authorizeLaunch: (c, report) => decideLaunch({ checkId: c.id, workload: c.workload }, sandboxMode(), report),
    runCheck: (check, ctx) => check.run(ctx),
    makeCtx: (c: CheckDef): RunContext => {
      const [areaDir, ...rest] = c.id.split("/");
      const logRel = join("logs", areaDir ?? "misc", `${rest.join("_").replace(/[^A-Za-z0-9@._-]/g, "_")}.log`);
      const logPath = join(runDir, logRel);
      mkdirSync(dirname(logPath), { recursive: true });
      writeFileSync(logPath, "");
      return {
        checkId: c.id, workload: c.workload,
        repo: REPO, runDir, tmpRoot, runId, tier: args.tier, shared, logPath,
        log: (line) => appendFileSync(logPath, line + "\n"),
        artifactDir: (host) => {
          const p = join(runDir, "artifacts", c.id, host ?? "");
          mkdirSync(p, { recursive: true });
          return p;
        },
      };
    },
    collectBreaches: async () => {
      // Post-run safety checks: outside files, canary leaks, auth shape.
      const after = await takeSnapshot(REPO);
      outsideChanged = diffSnapshots(before, after);
      ledger = safetyLedger();
      breaches = [
        ...outsideChanged.map((p) => `outside file changed: ${p}`),
        ...ledger.canaryLeaks.map((l) => `canary leak: ${l}`),
        ...ledger.authViolations.map((l) => `auth shape: ${l}`),
        ...ledger.egress.map((l) => `egress: ${l}`),
      ];
      return breaches;
    },
    persist: (row) => {
      rows.push(row);
      appendFileSync(join(runDir, "results.jsonl"), JSON.stringify(row) + "\n");
    },
    say,
    usage,
    now: () => Date.now(),
  });
  const wall = Date.now() - t0;

  const agentRuns = ledger.agentRuns;
  const sandboxLine = renderSandboxLine({
    mode: sandboxMode(), envScrub: envScrubLabel(probeReport?.probes ?? []), agentRuns, canariesPlanted: ledger.canariesPlanted,
    canaryLeaks: ledger.canaryLeaks.length, authViolations: ledger.authViolations.length,
    egress: ledger.egress.length, outsideChanged: outsideChanged.length,
    capabilities: probeReport?.probes.length ? capabilitySummary(probeReport) : undefined,
  });

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
      sandbox: { mode: sandboxMode(), ...policyRecord(probeReport), probes: probeRecords(probeReport), outsideChanged, ...ledger }, wallMs: wall,
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
