import type { CheckDef } from "../core/types.ts";
import { cmdCheck, countMatch, metric } from "./helpers.ts";

const vitestCounts = (out: string): Record<string, number> => {
  const m: Record<string, number> = {};
  const p = countMatch(out, /Tests\s+(\d+) passed/);
  if (p !== undefined) m.passed = p;
  const s = countMatch(out, /(\d+) skipped/);
  if (s !== undefined) m.skipped = s;
  return m;
};
const bunCounts = (out: string): Record<string, number> => {
  const p = countMatch(out, /^\s*(\d+) pass\b/m);
  return p !== undefined ? { passed: p } : {};
};

// Order matters: compat dist feeds cli typecheck, and the drift script needs both builds.
// Running the drift script directly (not `make check-canonical-drift`) shares those builds.
export const buildChecks: CheckDef[] = [
  cmdCheck({ id: "build/compat-build", area: "build", cmd: ["pnpm", "--dir", "packages/compatibility-layer", "run", "build"] }),
  cmdCheck({ id: "build/compat-lint", area: "build", cmd: ["pnpm", "--dir", "packages/compatibility-layer", "run", "lint"] }),
  cmdCheck({
    id: "build/compat-test", area: "build", cmd: ["pnpm", "--dir", "packages/compatibility-layer", "test"],
    parse: (out) => ({ metrics: vitestCounts(out) }),
  }),
  cmdCheck({ id: "build/cli-typecheck", area: "build", cmd: ["pnpm", "--dir", "packages/cli", "run", "typecheck"] }),
  cmdCheck({ id: "build/cli-build", area: "build", needs: ["bun"], cmd: ["pnpm", "--dir", "packages/cli", "run", "build"] }),
  cmdCheck({
    id: "build/cli-test", area: "build", needs: ["bun"], cmd: ["pnpm", "--dir", "packages/cli", "run", "test"],
    parse: (out) => ({ metrics: bunCounts(out) }),
  }),
  cmdCheck({
    id: "build/canonical-drift", area: "build", needs: ["bun"], cmd: ["bash", "scripts/validation/check-build-drift.sh"],
    parse: (out) => {
      const d = countMatch(out, /(\d+) degradation warning/);
      return { metrics: metric("degradations", d), summary: d !== undefined ? `no drift, ${d} degradation warnings` : undefined };
    },
  }),
  cmdCheck({
    id: "build/detect-pr-changes", area: "build", needs: ["bun"], cmd: ["bun", "test", "scripts/validation/detect-pr-changes.test.ts"],
    parse: (out) => ({ metrics: bunCounts(out) }),
  }),
];
