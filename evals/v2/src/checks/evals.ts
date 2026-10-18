import type { CheckDef } from "../core/types.ts";
import { cmdCheck, countMatch, metric } from "./helpers.ts";

// scripts/validation/validate-test-suites.sh (baseline row 15) is deliberately NOT wrapped:
// without an argument it fails, and with --all it checks 0 suites (vacuous). See the plan §3.8.
export const evalsChecks: CheckDef[] = [
  cmdCheck({ id: "evals/build", area: "evals", cmd: ["pnpm", "--dir", "evals/framework", "run", "build"] }),
  cmdCheck({
    id: "evals/test-ci", area: "evals", cmd: ["pnpm", "--dir", "evals/framework", "run", "test:ci"],
    parse: (out) => ({ metrics: metric("passed", countMatch(out, /Tests\s+(\d+) passed/)) }),
  }),
  cmdCheck({ id: "evals/validate-suites", area: "evals", cmd: ["pnpm", "--dir", "evals/framework", "run", "validate:suites:all"] }),
  cmdCheck({
    id: "evals/v2-unit", area: "evals", cmd: ["pnpm", "--dir", "evals/v2", "exec", "vitest", "run"],
    parse: (out) => ({ metrics: metric("passed", countMatch(out, /Tests\s+(\d+) passed/)) }),
  }),
  cmdCheck({ id: "evals/v2-typecheck", area: "evals", cmd: ["pnpm", "--dir", "evals/v2", "exec", "tsc", "--noEmit", "-p", "tsconfig.json"] }),
];
