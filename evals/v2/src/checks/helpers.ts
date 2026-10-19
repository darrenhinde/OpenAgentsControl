import { exec, which } from "../core/exec.ts";
import { sandboxMode } from "../sandbox/env.ts";
import { assertLaunchAllowed } from "../sandbox/gate.ts";
import type { Area, CheckDef, CheckOutcome, Layer, RunContext, Tier, WorkloadDecl } from "../core/types.ts";

export interface CmdCheckSpec {
  id: string;
  area: Area;
  layer?: Layer;
  tier?: Tier;
  /** Declared trust class of the wrapped command's workload (P1.2 U1). */
  workload: WorkloadDecl;
  /** Program and args, run with cwd = repo root. */
  cmd: string[];
  timeoutMs?: number;
  /** Binaries that must be on PATH, else the check is skipped. */
  needs?: string[];
  /** Turn the log into metrics / a summary, and optionally override ok. */
  parse?: (out: string, code: number) => { ok?: boolean; summary?: string; metrics?: Record<string, number> };
}

const whichCache = new Map<string, Promise<string | undefined>>();
export function cachedWhich(bin: string): Promise<string | undefined> {
  let p = whichCache.get(bin);
  if (!p) {
    p = which(bin);
    whichCache.set(bin, p);
  }
  return p;
}

export async function missing(needs: string[] = []): Promise<string | undefined> {
  for (const n of needs) if (!(await cachedWhich(n))) return `${n} not on PATH`;
  return undefined;
}

/** A check that wraps an existing repo command (the §1 baseline rows). */
export function cmdCheck(spec: CmdCheckSpec): CheckDef {
  return {
    id: spec.id,
    area: spec.area,
    layer: spec.layer ?? "L0",
    tier: spec.tier ?? "quick",
    workload: spec.workload,
    run: async (ctx: RunContext): Promise<CheckOutcome> => {
      // Only trusted declarations reach exec; this spawn is unsandboxed.
      assertLaunchAllowed({ checkId: spec.id, workload: spec.workload }, sandboxMode());
      const absent = await missing(spec.needs);
      if (absent) return { ok: false, skip: absent };
      const [cmd, ...args] = spec.cmd;
      ctx.log(`$ ${spec.cmd.join(" ")}`);
      const r = await exec(cmd as string, args, {
        cwd: ctx.repo,
        timeoutMs: spec.timeoutMs ?? 300_000,
        onData: (s) => ctx.log(s.replace(/\n$/, "")),
        env: { ...process.env, FORCE_COLOR: "0", NO_COLOR: "1", CI: process.env.CI ?? "" },
      });
      ctx.log(`# exit ${r.code}${r.timedOut ? " (timed out)" : ""} in ${r.ms} ms`);
      const parsed = spec.parse?.(r.out, r.code) ?? {};
      const ok = parsed.ok ?? r.code === 0;
      return {
        ok,
        summary: parsed.summary ?? (ok ? undefined : `exit ${r.code}${r.timedOut ? " (timeout)" : ""}: ${lastLine(r.out)}`),
        metrics: parsed.metrics,
      };
    },
  };
}

export function lastLine(out: string): string {
  const lines = out.split("\n").map((l) => l.trim()).filter(Boolean);
  return (lines[lines.length - 1] ?? "").slice(0, 120);
}

export function countMatch(out: string, re: RegExp): number | undefined {
  const m = re.exec(out);
  return m?.[1] !== undefined ? Number(m[1]) : undefined;
}

/** A one-entry metrics record, or {} when the value is missing. */
export function metric(name: string, v: number | undefined): Record<string, number> {
  return v === undefined ? {} : { [name]: v };
}
