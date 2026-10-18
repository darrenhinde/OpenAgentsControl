import type { CheckDef, CheckOutcome, RunContext } from "../core/types.ts";
import { listFiles } from "../lints/files.ts";
import { lintNoV1Artifacts } from "../lints/no-v1-artifacts.ts";

const noV1Artifacts: CheckDef = {
  id: "oc/no-v1-artifacts",
  area: "oc-load",
  layer: "L0",
  tier: "quick",
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

export const ocLoadStaticChecks: CheckDef[] = [noV1Artifacts];
