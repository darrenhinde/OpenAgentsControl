import { cpSync } from "node:fs";
import { join } from "node:path";
import type { CheckDef, CheckOutcome, RunContext } from "../core/types.ts";
import { isoEnv, makeIsoDirs, runIsolated, safePath } from "../sandbox/env.ts";
import { cachedWhich, lastLine } from "./helpers.ts";

/**
 * `claude plugin validate --strict --json` on a COPY of the plugin (agents never see the repo),
 * through the sandbox wrapper with a throwaway HOME and a dummy key. No model call is made.
 */
function validate(id: string, what: "plugin" | "marketplace"): CheckDef {
  return {
    id,
    area: "cc-load",
    layer: "L0",
    tier: "quick",
    run: async (ctx: RunContext): Promise<CheckOutcome> => {
      const claude = await cachedWhich("claude");
      if (!claude) return { ok: false, skip: "claude not on PATH" };
      const d = makeIsoDirs(ctx.tmpRoot, id);
      const filter = (src: string): boolean => !src.includes("node_modules");
      cpSync(join(ctx.repo, "plugins", "claude-code"), join(d.work, "plugins", "claude-code"), { recursive: true, filter });
      if (what === "marketplace") cpSync(join(ctx.repo, ".claude-plugin"), join(d.work, ".claude-plugin"), { recursive: true });
      const target = what === "plugin" ? join(d.work, "plugins", "claude-code") : d.work;
      const r = await runIsolated({
        dirs: d,
        env: isoEnv(d, safePath([claude, await cachedWhich("node")]), {
          ANTHROPIC_API_KEY: `sk-ant-dummy-${ctx.runId}`,
          ANTHROPIC_BASE_URL: "http://127.0.0.1:9",
        }),
        argv: [claude, "plugin", "validate", "--strict", "--json", target],
        target: { repo: ctx.repo, repoDeny: ctx.repo },
        timeoutMs: 60_000,
        onData: (s) => ctx.log(s.replace(/\n$/, "")),
      });
      ctx.log(`# exit ${r.code} in ${r.ms} ms`);
      let summary = r.code === 0 ? undefined : lastLine(r.out);
      const m = /"message"\s*:\s*"([^"]+)"/.exec(r.out);
      if (r.code !== 0 && m?.[1]) summary = m[1].slice(0, 100);
      return { ok: r.code === 0, summary, sandbox: { mode: "seatbelt" } };
    },
  };
}

export const ccLoadChecks: CheckDef[] = [
  validate("cc/plugin-validate", "plugin"),
  validate("cc/marketplace-validate", "marketplace"),
];
