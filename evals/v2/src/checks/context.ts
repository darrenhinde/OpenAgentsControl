import type { CheckDef } from "../core/types.ts";
import { cmdCheck, countMatch } from "./helpers.ts";

export const contextChecks: CheckDef[] = [
  cmdCheck({ id: "ctx/markdown-links", area: "context", needs: ["bun"], cmd: ["pnpm", "run", "validate:context-links"] }),
  cmdCheck({ id: "ctx/registry", area: "context", needs: ["bun"], cmd: ["pnpm", "run", "validate:registry"] }),
  cmdCheck({
    id: "ctx/context-refs", area: "context", cmd: ["bash", "scripts/validation/validate-context-refs.sh"],
    parse: (out) => {
      const w = countMatch(out, /with (\d+) warning/) ?? 0;
      return { metrics: { warnings: w } };
    },
  }),
];
