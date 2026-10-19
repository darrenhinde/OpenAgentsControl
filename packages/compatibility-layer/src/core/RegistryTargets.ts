/**
 * RegistryTargets — what differs between `registry.json` (OpenCode v2, the default) and
 * `registry.v1.json` (OpenCode v1, opt-in). Pure data, so removing v1 is deleting one entry.
 *
 * Installers read a component's `path` from the registry. A path under `v1-opencode/` installs
 * to `.opencode/` in the user's project (the folder name is never used there); the registry
 * records where the file lives in THIS repository.
 */

import type { CanonicalAgentFile } from "./AgentLoader.js";
import type { EmitTarget } from "./TargetPolicy.js";

export type RegistryTarget = Extract<EmitTarget, "opencode" | "opencode-v1">;

export interface RegistryTargetSpec {
  /** The registry file this target reads as its carried base and writes. */
  file: string;
  /** Default root agents are installed from, repo-relative. */
  defaultAgentRoot: string;
  /** The path of one agent's shipped file under `root`. */
  agentPath(agent: CanonicalAgentFile, root: string): string;
  /** `components` categories this target cannot load; emitted empty. */
  unavailableCategories: readonly string[];
  /** Profile component kinds (ProfileLoader field names) this target cannot install. */
  unavailableProfileKinds: readonly ("tools" | "plugins")[];
}

export const REGISTRY_TARGETS: Readonly<Record<RegistryTarget, RegistryTargetSpec>> = {
  opencode: {
    file: "registry.json",
    defaultAgentRoot: ".opencode/agent",
    // Flat: v2 derives the agent id from the file name.
    agentPath: (agent, root) => `${root}/${agent.oac.id}.md`,
    // v2 never scans .opencode/tool/ and does not run v1 plugins (#367).
    unavailableCategories: ["tools", "plugins"],
    unavailableProfileKinds: ["tools", "plugins"],
  },
  "opencode-v1": {
    file: "registry.v1.json",
    defaultAgentRoot: "v1-opencode/agent",
    agentPath: (agent, root) => `${root}/${agent.relativePath}`,
    unavailableCategories: [],
    unavailableProfileKinds: [],
  },
};
