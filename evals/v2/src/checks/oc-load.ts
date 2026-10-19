import { mkdirSync, realpathSync, writeFileSync } from "node:fs";
import { createServer, type AddressInfo } from "node:net";
import { dirname, join, sep } from "node:path";
import { writeOpenCodeConfig } from "../../../../packages/compatibility-layer/src/hosts/opencode/driver.ts";
import type { CheckDef, CheckOutcome, RunContext } from "../core/types.ts";
import { listFiles } from "../lints/files.ts";
import { lintNoV1Artifacts } from "../lints/no-v1-artifacts.ts";
import { isoEnv, makeIsoDirs, runIsolated, safePath } from "../sandbox/env.ts";
import { safetyLedger } from "../sandbox/ledger.ts";
import { cachedWhich } from "./helpers.ts";

const noV1Artifacts: CheckDef = {
  id: "oc/no-v1-artifacts",
  area: "oc-load",
  layer: "L0",
  tier: "quick",
  workload: "trusted-static",
  run: (ctx: RunContext): Promise<CheckOutcome> => {
    const found = lintNoV1Artifacts(
      listFiles(ctx.repo, ".opencode/tool"),
      [...listFiles(ctx.repo, ".opencode/plugin"), ...listFiles(ctx.repo, ".opencode/plugins")],
    );
    for (const f of found) ctx.log(`V1 ${f.path}  (${f.reason})`);
    const tools = found.filter((f) => f.path.startsWith(".opencode/tool/")).length;
    const plugins = found.length - tools;
    return Promise.resolve({
      ok: found.length === 0,
      summary: `.opencode/tool/** (${tools} modules) and ${plugins} v1 plugins never load on v2`,
      metrics: { toolModules: tools, v1Plugins: plugins },
    });
  },
};

async function freePort(): Promise<number> {
  const srv = createServer();
  await new Promise<void>((res) => srv.listen(0, "127.0.0.1", res));
  const port = (srv.address() as AddressInfo).port;
  await new Promise<void>((res) => srv.close(() => res()));
  return port;
}

/**
 * Sandbox self-test for OpenCode (plan §4.4, L-006): `opencode debug config` must list ONLY
 * config sources inside the throwaway HOME and workdir. This is the check that caught the
 * ancestor-directory walk picking up the repo's .opencode/ and the real ~/.opencode.
 * `debug` has no --standalone, so it gets a private service on a free port in the iso HOME,
 * which is always stopped afterwards. A failure is recorded as a sandbox breach.
 */
type Source = { type?: string; path?: string };

/** `opencode debug config` in a fresh iso dir; `ancestor` plants a parent .opencode/ (control). */
async function listSources(ctx: RunContext, bin: string, name: string, ancestor: boolean): Promise<{ sources: Source[] | undefined; roots: string[]; planted?: string }> {
  const d = makeIsoDirs(ctx.tmpRoot, name);
  writeOpenCodeConfig(d.work, { mockUrl: "http://127.0.0.1:9", apiKey: `oc-dummy-${ctx.runId}` });
  let planted: string | undefined;
  if (ancestor) {
    // d.root is the parent of the workdir: exactly the walk-up that leaked the repo's config.
    mkdirSync(join(d.root, ".opencode"), { recursive: true });
    planted = join(d.root, ".opencode", "opencode.json");
    writeFileSync(planted, JSON.stringify({ $schema: "https://opencode.ai/config.json" }) + "\n");
  }
  const env = isoEnv(d, safePath([bin]));
  const target = { repo: ctx.repo, repoDeny: ctx.repo, launch: { checkId: ctx.checkId, workload: ctx.workload } };
  const port = await freePort();
  const oc = (args: string[], timeoutMs = 20_000): ReturnType<typeof runIsolated> =>
    runIsolated({ dirs: d, env, argv: [bin, ...args], target, timeoutMs, stdoutOnly: true });
  safetyLedger().agentRuns++;
  let out = "";
  try {
    ctx.log(`[${name}] service set port ${port}: exit ${(await oc(["service", "set", "port", String(port)])).code}`);
    const r = await oc(["debug", "config"], 60_000);
    out = r.out;
    ctx.log(`[${name}] debug config: exit ${r.code}`);
  } finally {
    ctx.log(`[${name}] service stop: exit ${(await oc(["service", "stop"])).code}`);
  }
  try {
    return { sources: JSON.parse(out.slice(out.indexOf("["))) as Source[], roots: [d.home, d.work, d.cache], planted };
  } catch {
    return { sources: undefined, roots: [], planted };
  }
}

const isInside = (p: string, roots: string[]): boolean => {
  let real = p;
  try {
    real = realpathSync(p);
  } catch {
    /* missing paths are compared as given */
  }
  return roots.some((root) => real === root || real.startsWith(root + sep));
};

const configSources: CheckDef = {
  id: "oc/config-sources",
  area: "oc-load",
  layer: "L1",
  host: "opencode-v2",
  tier: "hosts",
  workload: "host-check",
  run: async (ctx: RunContext): Promise<CheckOutcome> => {
    const bin = await cachedWhich("opencode");
    if (!bin) return { ok: false, skip: "opencode not on PATH" };
    const g = await listSources(ctx, bin, "oc-config-sources", false);
    const c = await listSources(ctx, bin, "oc-config-sources-control", true);
    if (!g.sources || !c.sources) return { ok: false, summary: "driver contract broken: `opencode debug config` did not print a JSON array" };
    const outside = g.sources.map((s) => s.path ?? "").filter((p) => p && !isInside(p, g.roots));
    for (const s of g.sources) ctx.log(`${isInside(s.path ?? "", g.roots) ? "ok     " : "OUTSIDE"} ${s.type ?? "?"} ${s.path ?? ""}`);
    for (const p of outside) safetyLedger().egress.push(`opencode loaded config from outside the sandbox: ${p}`);
    // Control: the planted ancestor config must be listed, or this check could not see a leak.
    const seen = c.sources.some((s) => s.path !== undefined && c.planted !== undefined && (s.path === c.planted || s.path === dirname(c.planted) || isInside(s.path, [dirname(c.planted)])));
    ctx.log(`control: planted ancestor ${c.planted ?? "?"} ${seen ? "was listed (check is sensitive)" : "was NOT listed"}`);
    return {
      ok: g.sources.length > 0 && outside.length === 0 && seen,
      summary: outside.length ? `${outside.length} config sources outside the sandbox`
        : !seen ? "control: a planted ancestor .opencode/ was not detected; check not sensitive"
        : `${g.sources.length} sources, all inside the iso HOME/workdir; control caught the ancestor walk`,
      metrics: { sources: g.sources.length, outside: outside.length, controlDetected: seen ? 1 : 0 },
    };
  },
};

export const ocLoadStaticChecks: CheckDef[] = [noV1Artifacts];
export const ocLoadHostChecks: CheckDef[] = [configSources];
