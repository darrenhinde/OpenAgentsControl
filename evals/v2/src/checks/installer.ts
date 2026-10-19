import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import type { CheckDef, CheckOutcome, RunContext } from "../core/types.ts";
import { listFiles } from "../lints/files.ts";
import { lintNoHiddenTools } from "../lints/no-hidden-tools.ts";
import { lintNoV1Artifacts } from "../lints/no-v1-artifacts.ts";
import { isoEnv, makeIsoDirs, runIsolated, safePath, sandboxMode, type IsoDirs } from "../sandbox/env.ts";
import { cachedWhich, cmdCheck, lastLine, missing } from "./helpers.ts";
import { gitInit } from "./host-run.ts";
import { probeAgents, treeAt, type AgentProbe } from "./oc-agents.ts";

function walk(dir: string, out: string[] = []): string[] {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (e.isFile()) out.push(p);
  }
  return out;
}
const sha = (p: string): string => createHash("sha256").update(readFileSync(p)).digest("hex");

async function toolPath(): Promise<string> {
  return safePath([await cachedWhich("bash"), await cachedWhich("curl"), await cachedWhich("jq"), await cachedWhich("git")]);
}

/**
 * Baseline row 20. The script runs `install.sh help|list|<profile>` from the repo root and
 * probes GitHub (non-fatal). It runs inside the sandbox with the repo readable but nothing under
 * /Users writable and no network, so it can't touch the checkout or reach the internet.
 */
const compatibility: CheckDef = {
  id: "inst/compatibility",
  area: "installer",
  layer: "L0",
  tier: "all",
  workload: "installer",
  run: async (ctx: RunContext): Promise<CheckOutcome> => {
    const absent = await missing(["curl", "jq"]);
    if (absent) return { ok: false, skip: absent };
    const d = makeIsoDirs(ctx.tmpRoot, "inst-compatibility");
    const r = await runIsolated({
      dirs: { ...d, work: ctx.repo },
      env: isoEnv(d, await toolPath(), { CI: "1" }),
      argv: ["/bin/bash", "scripts/tests/test-compatibility.sh"],
      target: { repo: ctx.repo, repoDeny: "/nonexistent" },
      timeoutMs: 180_000,
      onData: (s) => ctx.log(s.replace(/\n$/, "")),
    });
    ctx.log(`# exit ${r.code} in ${r.ms} ms (sandbox=${sandboxMode()})`);
    return { ok: r.code === 0, summary: r.code === 0 ? undefined : `exit ${r.code}: ${lastLine(r.out)}`, sandbox: { mode: sandboxMode() } };
  },
};

/**
 * New (D-014): install.sh against the LOCAL tree via OAC_RAW_URL=file://<repo>, into a temp dir
 * outside $HOME and the repo, under the sandbox. Every installed file must be byte-identical to
 * the checkout, which proves the local tree (not the pushed branch) was installed.
 */
const installShLocal: CheckDef = {
  id: "inst/install-sh-local",
  area: "installer",
  layer: "L1",
  tier: "hosts",
  workload: "installer",
  run: async (ctx: RunContext): Promise<CheckOutcome> => {
    const absent = await missing(["curl", "jq"]);
    if (absent) return { ok: false, skip: absent };
    const d = makeIsoDirs(ctx.tmpRoot, "inst-install-sh-local");
    const target = join(d.work, ".opencode");
    const r = await runIsolated({
      dirs: d,
      env: isoEnv(d, await toolPath(), { OAC_RAW_URL: `file://${ctx.repo}`, REGISTRY_URL: `file://${ctx.repo}/registry.json` }),
      argv: ["/bin/bash", join(ctx.repo, "install.sh"), "essential", `--install-dir=${target}`],
      target: { repo: ctx.repo, repoDeny: "/nonexistent" },
      timeoutMs: 120_000,
      onData: (s) => ctx.log(s.replace(/\n$/, "")),
    });
    ctx.log(`# exit ${r.code} in ${r.ms} ms`);
    if (r.code !== 0) return { ok: false, summary: `install.sh exit ${r.code}: ${lastLine(r.out)}` };
    if (!existsSync(target)) return { ok: false, summary: "install.sh exited 0 but wrote no .opencode/" };
    const files = walk(target);
    const mismatched: string[] = [];
    for (const f of files) {
      const rel = relative(target, f);
      const src = join(ctx.repo, ".opencode", rel);
      if (!existsSync(src) || !statSync(src).isFile()) continue; // installer-generated (e.g. config), not a copy
      if (sha(src) !== sha(f)) mismatched.push(rel);
    }
    for (const m of mismatched) ctx.log(`MISMATCH ${m}`);
    ctx.log(`installed ${files.length} files, ${mismatched.length} differ from the local tree`);
    return {
      ok: files.length > 0 && mismatched.length === 0,
      summary: mismatched.length ? `${mismatched.length} installed files differ from the local tree` : `${files.length} files from the local tree`,
      metrics: { files: files.length, mismatched: mismatched.length },
    };
  },
};

// ── oac init / doctor (plan §3.7) ────────────────────────────────────────────────────────────
// The CLI (packages/cli/dist, built by build/cli-build) runs under the sandbox in a fresh git
// repo under $TMPDIR with a throwaway HOME. Like inst/compatibility it may READ the repo (its
// bundle is the repo's .opencode/); it can't write anywhere under /Users or reach the network.

interface CliRun {
  code: number;
  out: string;
}

async function oac(ctx: RunContext, d: IsoDirs, args: string[], extraBins: (string | undefined)[] = []): Promise<CliRun> {
  const node = await cachedWhich("node");
  const r = await runIsolated({
    dirs: d,
    env: isoEnv(d, safePath([node, await cachedWhich("git"), ...extraBins])),
    argv: [node ?? "node", join(ctx.repo, "packages", "cli", "dist", "index.js"), ...args],
    target: { repo: ctx.repo, repoDeny: "/nonexistent" },
    timeoutMs: 60_000,
    stdoutOnly: true,
  });
  ctx.log(`$ oac ${args.join(" ")}  → exit ${r.code}`);
  return { code: r.code, out: r.out };
}

/** Every file under `dir` (relative), skipping .git. */
function treeFiles(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return walk(dir).map((f) => relative(dir, f)).filter((f) => !f.startsWith(".git/")).sort();
}
const treeHash = (dir: string): string => createHash("sha256").update(treeFiles(dir).map((f) => `${f}:${sha(join(dir, f))}`).join("\n")).digest("hex");

interface DoctorReport {
  status?: string;
  checks?: { name?: string; status?: string; message?: string }[];
}
function parseDoctor(out: string): DoctorReport | undefined {
  try {
    return JSON.parse(out.slice(out.indexOf("{"))) as DoctorReport;
  } catch {
    return undefined;
  }
}

/** Paths the manifest says init installed (accepts an object keyed by path or an array of {path}). */
function manifestPaths(work: string): string[] | undefined {
  const p = join(work, ".oac", "manifest.json");
  if (!existsSync(p)) return undefined;
  const m = JSON.parse(readFileSync(p, "utf8")) as { files?: unknown };
  if (Array.isArray(m.files)) return m.files.map((f) => (typeof f === "string" ? f : String((f as { path?: unknown }).path ?? ""))).sort();
  if (m.files && typeof m.files === "object") return Object.keys(m.files).sort();
  return undefined;
}

const cliMissing = (ctx: RunContext): string | undefined =>
  existsSync(join(ctx.repo, "packages", "cli", "dist", "index.js")) ? undefined : "packages/cli/dist/index.js missing (build/cli-build failed?)";

const initDoctor: CheckDef = {
  id: "inst/oac-init-doctor",
  area: "installer",
  layer: "L1",
  tier: "hosts",
  workload: "installer",
  run: async (ctx) => {
    const absent = cliMissing(ctx) ?? (await missing(["node", "git"]));
    if (absent) return { ok: false, skip: absent };
    const d = makeIsoDirs(ctx.tmpRoot, "inst-oac-init-doctor");
    await gitInit(d.work);
    const homeBefore = treeHash(d.home);
    const problems: string[] = [];
    // --dry-run writes nothing
    const workBefore = treeHash(d.work);
    const dry = await oac(ctx, d, ["init", "--profile", "essential", "--dry-run"]);
    if (dry.code !== 0) problems.push(`init --dry-run exit ${dry.code}: ${lastLine(dry.out)}`);
    if (treeHash(d.work) !== workBefore) problems.push("init --dry-run wrote files");
    // init
    const init = await oac(ctx, d, ["init", "--profile", "essential"]);
    if (init.code !== 0) problems.push(`init exit ${init.code}: ${lastLine(init.out)}`);
    const written = treeFiles(d.work);
    const manifest = manifestPaths(d.work);
    // init's own files: manifest, scope config, and .oac.json (Claude context discovery, checked by doctor)
    const bookkeeping = new Set([".oac/manifest.json", ".oac/config.json", ".oac.json"]);
    if (!manifest) problems.push("no readable .oac/manifest.json");
    else {
      const extra = written.filter((f) => !bookkeeping.has(f) && !manifest.includes(f));
      const lost = manifest.filter((f) => !written.includes(f));
      for (const f of extra) ctx.log(`NOT IN MANIFEST ${f}`);
      for (const f of lost) ctx.log(`MISSING ${f}`);
      if (extra.length) problems.push(`${extra.length} written files not in the manifest`);
      if (lost.length) problems.push(`${lost.length} manifest files not written`);
    }
    // doctor
    const doc = await oac(ctx, d, ["doctor", "--json"]);
    const rep = parseDoctor(doc.out);
    for (const c of rep?.checks ?? []) ctx.log(`doctor ${String(c.status).padEnd(5)} ${c.name}: ${c.message}`);
    if (rep?.status !== "healthy") problems.push(`doctor status ${rep?.status ?? "unparseable"} (exit ${doc.code})`);
    if (treeHash(d.home) !== homeBefore) problems.push("the throwaway HOME changed (init/doctor wrote outside the repo)");
    for (const p of problems) ctx.log(`PROBLEM ${p}`);
    const n = written.filter((f) => !bookkeeping.has(f)).length;
    return {
      ok: problems.length === 0,
      summary: problems.length ? problems.join("; ").slice(0, 140) : `init essential: ${n} files = manifest; doctor ${rep?.status} (${rep?.checks?.length ?? 0} checks); dry-run wrote nothing`,
      metrics: { files: n, doctorChecks: rep?.checks?.length ?? 0 },
      sandbox: { mode: sandboxMode() },
    };
  },
};

export const INIT_PROFILES = ["essential", "developer"];

interface InitTree {
  profile: string;
  dirs: IsoDirs;
  code: number;
  agents?: AgentProbe[];
  doctor?: DoctorReport;
}

/** `oac init --profile <p>` for each profile, then T2 on what it wrote. Shared by the two hosts-tier rows. */
async function initTrees(ctx: RunContext): Promise<InitTree[] | undefined> {
  const cached = ctx.shared.get("init-trees") as InitTree[] | undefined;
  if (cached) return cached;
  const oc = await cachedWhich("opencode");
  if (!oc || cliMissing(ctx)) return undefined;
  const out: InitTree[] = [];
  for (const profile of INIT_PROFILES) {
    const d = makeIsoDirs(ctx.tmpRoot, `inst-init-${profile}`);
    await gitInit(d.work);
    const init = await oac(ctx, d, ["init", "--profile", profile]);
    const t: InitTree = { profile, dirs: d, code: init.code };
    // doctor sees the real host on PATH, as a user's would
    t.doctor = parseDoctor((await oac(ctx, d, ["doctor", "--json"], [oc])).out);
    if (init.code === 0 && existsSync(join(d.work, ".opencode", "agent"))) {
      const tree = await treeAt(ctx, d, `inst-init-${profile}`);
      if (tree) t.agents = await probeAgents(ctx, tree);
    }
    out.push(t);
  }
  ctx.shared.set("init-trees", out);
  return out;
}

const initBootsOnV2: CheckDef = {
  id: "inst/init-boots-on-v2",
  area: "installer",
  layer: "L1",
  host: "opencode-v2",
  tier: "hosts",
  workload: "installer",
  run: async (ctx) => {
    const trees = await initTrees(ctx);
    if (!trees) return { ok: false, skip: (await cachedWhich("opencode")) ? cliMissing(ctx) ?? "?" : "opencode not on PATH" };
    const parts: string[] = [];
    let bad = 0;
    let total = 0;
    let hidden = 0;
    for (const t of trees) {
      const agents = t.agents ?? [];
      const failed = agents.filter((a) => !a.booted);
      total += agents.length;
      bad += failed.length + (t.code !== 0 || !agents.length ? 1 : 0);
      hidden += agents.filter((a) => a.hidden.length).length;
      for (const a of agents) ctx.log(`[${t.profile}] ${a.booted ? "boot " : "FAIL "} ${a.id}${a.hidden.length ? `  hidden: ${a.hidden.join(",")}` : ""}${a.error ? `  (${a.error})` : ""}`);
      parts.push(`${t.profile}: ${agents.length - failed.length}/${agents.length} boot${t.code !== 0 ? ` (init exit ${t.code})` : ""}`);
    }
    return {
      ok: bad === 0,
      summary: `${parts.join("; ")}${hidden ? `; ${hidden} lose a tool (see oc/agents-tools-visible)` : ""}`,
      metrics: { agents: total, failed: bad, hiddenToolAgents: hidden },
    };
  },
};

/** What v2 can't load in an installed tree: hidden tools (#349), .opencode/tool/** and v1 plugins (#367). */
function v2Problems(work: string): string[] {
  const agents = listFiles(work, ".opencode/agent", (p) => p.endsWith(".md"));
  const hidden = lintNoHiddenTools(agents).map((h) => `${h.path}: ${h.key} hidden`);
  const v1 = lintNoV1Artifacts(listFiles(work, ".opencode/tool"), [...listFiles(work, ".opencode/plugin"), ...listFiles(work, ".opencode/plugins")]).map((a) => `${a.path}: ${a.reason}`);
  return [...hidden, ...v1];
}

const doctorFlagsV2: CheckDef = {
  id: "inst/doctor-flags-v2",
  area: "installer",
  layer: "L1",
  host: "opencode-v2",
  tier: "hosts",
  workload: "installer",
  run: async (ctx) => {
    const trees = await initTrees(ctx);
    if (!trees) return { ok: false, skip: (await cachedWhich("opencode")) ? cliMissing(ctx) ?? "?" : "opencode not on PATH" };
    const parts: string[] = [];
    let missed = 0;
    for (const t of trees) {
      const probs = v2Problems(t.dirs.work);
      const flags = (t.doctor?.checks ?? []).filter((c) => (c.status === "warn" || c.status === "error") && /v2|opencode 2|hidden|\.opencode\/tool|plugin/i.test(`${c.name ?? ""} ${c.message ?? ""}`));
      for (const p of probs) ctx.log(`[${t.profile}] v2 problem: ${p}`);
      for (const c of t.doctor?.checks ?? []) ctx.log(`[${t.profile}] doctor ${String(c.status).padEnd(5)} ${c.name}: ${c.message}`);
      if (probs.length && !flags.length) missed++;
      parts.push(`${t.profile}: ${probs.length} v2 problems, doctor "${t.doctor?.status ?? "?"}"${flags.length ? ` + ${flags.length} v2 warnings` : ""}`);
    }
    return { ok: missed === 0, summary: parts.join("; "), metrics: { profilesMissed: missed } };
  },
};

export const installerHostChecks: CheckDef[] = [initBootsOnV2, doctorFlagsV2];

export const installerChecks: CheckDef[] = [
  cmdCheck({
    id: "inst/shell-syntax", area: "installer", workload: "trusted-command",
    cmd: ["bash", "-c", 'bash -n install.sh && bash -n update.sh && for f in scripts/tests/*.sh; do bash -n "$f" || exit 1; done'],
  }),
  cmdCheck({ id: "inst/shellcheck", area: "installer", workload: "trusted-command", needs: ["shellcheck"], cmd: ["shellcheck", "-S", "error", "install.sh"] }),
  compatibility,
  installShLocal,
  initDoctor,
];

/** Network-only installer checks: listed so the table shows them as skipped (all tier). */
export const installerNetworkChecks: CheckDef[] = ["inst/install-sh-e2e", "inst/non-interactive", "inst/profile-smoke"].map((id) => ({
  id,
  area: "installer" as const,
  layer: "L1" as const,
  tier: "all" as const,
  workload: "deferred" as const,
  run: (): Promise<CheckOutcome> => Promise.resolve({ ok: false, skip: "network tier (all) not implemented in this suite yet" }),
}));
