/**
 * OpenCodeV1Adapter — the OpenCode **v1** target, emitted to `v1-opencode/agent/**`.
 *
 * Everything OpenCode-v1-specific lives under `adapters/v1/`, so removing v1 support is
 * deleting this directory, the `opencode-v1` entry in `BUILD_TARGETS`, and `v1-opencode/`.
 */

import { OpenCodeBaseAdapter } from "../opencode/OpenCodeBaseAdapter.js";

/** Where the v1 build is written in this repository. Display only: installs write `.opencode/`. */
export const OPENCODE_V1_AGENT_ROOT = "v1-opencode/agent";

export class OpenCodeV1Adapter extends OpenCodeBaseAdapter {
  readonly name = "opencode-v1";
  readonly displayName = "OpenCode v1";
  readonly agentRoot = OPENCODE_V1_AGENT_ROOT;
  protected readonly idTarget = "opencode-v1" as const;
  /** v1 registers an agent under its `name:` (config.ts:337-343), so the line is load-bearing. */
  protected readonly dropsName = false;
  protected readonly layoutNote = "Agent files live at v1-opencode/agent/<category>/<name>.md (installed to .opencode/agent/).";
}
