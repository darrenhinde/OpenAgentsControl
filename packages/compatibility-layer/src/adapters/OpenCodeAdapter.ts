/**
 * OpenCodeAdapter — the OpenCode **v2** target: `.opencode/agent/**`.
 *
 * A thin composition over {@link OpenCodeBaseAdapter}. (Unit 1 keeps the pre-split behaviour;
 * the v2 id and delegation rewrites arrive in later units.)
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
  protected readonly layoutNote = "Agent files live at .opencode/agent/<category>/<name>.md, mirroring content/agents/.";
}
