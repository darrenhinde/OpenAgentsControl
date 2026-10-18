import type { CheckDef } from "../core/types.ts";
import { buildChecks } from "./build.ts";
import { ccLoadChecks } from "./cc-load.ts";
import { contextChecks } from "./context.ts";
import { evalsChecks } from "./evals.ts";
import { installerChecks, installerNetworkChecks } from "./installer.ts";

// Table order is fixed by AREAS; run order is this list (builds first: later rows reuse them).
export const allChecks: CheckDef[] = [
  ...buildChecks,
  ...ccLoadChecks,
  ...contextChecks,
  ...installerChecks,
  ...installerNetworkChecks,
  ...evalsChecks,
];
