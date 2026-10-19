// pnpm test:local [quick|hosts|live|all] [--only <id-prefix>] [--strict] [--keep] [--rerun-failed] [--ci]
//
// Runs every check for the tier, writes .tmp/test-runs/<UTC-timestamp>/ (results.jsonl,
// summary.md, junit.xml, env.json, logs/), points .tmp/test-runs/latest at it and prints the
// per-area table. Exit codes: 0 = no unexpected failures; 1 = unexpected failure, a stale
// known-red or a refused launch; 2 = usage / not implemented; 3 = SANDBOX BREACH (a safety check tripped).
import { main } from "./main.ts";

main().then(
  (code) => process.exit(code),
  (e: unknown) => {
    console.error(e instanceof Error ? e.stack ?? e.message : e);
    process.exit(2);
  },
);
