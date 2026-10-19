/**
 * OpenCodeAdapter — the OpenCode **v2** target: `.opencode/agent/**`.
 *
 * A thin composition over {@link OpenCodeBaseAdapter}. v2 derives an agent's id from its FILE
 * NAME and ignores `name:`, so this target writes `<oac.id>.md` flat, drops `name:`, and
 * resolves delegation references to `oac.id`s (decisions 1 and 3).
 */

import { OpenCodeBaseAdapter } from "./opencode/OpenCodeBaseAdapter.js";
import { OPENCODE_AGENT_ROOT } from "./opencode/surgery.js";

export {
  OPENCODE_AGENT_ROOT,
  OpenCodeEmitError,
  type CanonicalEmitResult,
  type FromCanonicalOptions,
} from "./opencode/surgery.js";

export class OpenCodeAdapter extends OpenCodeBaseAdapter {
  readonly name = "opencode";
  readonly displayName = "OpenCode";
  readonly agentRoot = OPENCODE_AGENT_ROOT;
  protected readonly idTarget = "opencode" as const;
  protected readonly dropsName = true;
  protected readonly layoutNote = "Agent files live at .opencode/agent/<oac.id>.md (flat): OpenCode v2 derives the agent id from the file name.";

  /** Flat: the file name IS the v2 agent id, so it comes from `oac.id`, not the category directory. */
  override outputPath(_relativePath: string, id: string): string {
    return `${this.agentRoot}/${id}.md`;
  }
}
