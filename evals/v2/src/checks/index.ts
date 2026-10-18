import type { CheckDef } from "../core/types.ts";
import { buildChecks } from "./build.ts";
import { ccLoadChecks } from "./cc-load.ts";
import { contextChecks } from "./context.ts";
import { evalsChecks } from "./evals.ts";
import { gatesChecks } from "./gates.ts";
import { installerChecks, installerNetworkChecks } from "./installer.ts";
import { ocLoadHostChecks, ocLoadStaticChecks } from "./oc-load.ts";
import { scenarioChecks } from "./scenarios.ts";

// Table order is fixed by AREAS; run order is this list (builds first: later rows reuse them).
export const allChecks: CheckDef[] = [
  ...buildChecks,
  ...gatesChecks,
  ...ocLoadStaticChecks,
  ...ccLoadChecks,
  ...contextChecks,
  ...installerChecks,
  ...installerNetworkChecks,
  ...evalsChecks,
  // hosts tier: the OpenCode config-sources self-test runs before any scenario
  ...ocLoadHostChecks,
  ...scenarioChecks,
];
