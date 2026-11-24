/**
 * RegistryTargets — what differs between `built-ai-configs/registry/registry.json` (OpenCode v2, the default) and
 * `built-ai-configs/registry/registry.v1.json` (OpenCode v1, opt-in). Pure data, so removing v1 is deleting one entry.
 *
 * Installers read a component's `path` from the registry. A path under `built-ai-configs/opencode-v1/` installs
 * to `.opencode/` in the user's project (the folder name is never used there); the registry
 * records where the file lives in THIS repository.
 */

import type { CanonicalAgentFile } from "./AgentLoader.js";
import type { BuildTarget } from "./TargetPolicy.js";

export type RegistryTarget = Extract<BuildTarget, "opencode" | "opencode-v1">;

export interface RegistryTargetSpec {
  /** The registry file this target reads as its carried base and writes. */
  file: string;
  /** Default root agents are installed from, repo-relative. */
  defaultAgentRoot: string;
  /** Where skills / commands are installed from, repo-relative (their registry `path` and `files` are rooted here). */
  skillRoot: string;
  commandRoot: string;
  /** The path of one agent's shipped file under `root`. */
  agentPath(agent: CanonicalAgentFile, root: string): string;
  /**
   * Shipped paths (same form as {@link agentPath}) that an earlier OAC release used for this agent
   * and that this one no longer ships: one per `oac.aliases` entry (the old file name, in the
   * agent's current folder) plus each `oac.previousPaths` entry for layouts that nest by folder.
   * Never includes the agent's current path.
   */
  supersededPaths(agent: CanonicalAgentFile, root: string): string[];
  /** `components` categories this target cannot load; emitted empty. */
  unavailableCategories: readonly string[];
  /** Profile component kinds (ProfileLoader field names) this target cannot install. */
  unavailableProfileKinds: readonly ("tools" | "plugins")[];
}

export const REGISTRY_TARGETS: Readonly<Record<RegistryTarget, RegistryTargetSpec>> = {
  opencode: {
    file: "built-ai-configs/registry/registry.json",
    defaultAgentRoot: ".opencode/agent",
    skillRoot: ".opencode/skills",
    commandRoot: ".opencode/command",
    // Flat: v2 derives the agent id from the file name.
    agentPath: (agent, root) => `${root}/${agent.oac.id}.md`,
    // Flat: an old file name is the only way a v2 agent ever moved.
    supersededPaths: (agent, root) => agent.oac.aliases.map((alias) => `${root}/${alias}.md`),
    // v2 never scans .opencode/tool/ and does not run v1 plugins (#367).
    unavailableCategories: ["tools", "plugins"],
    unavailableProfileKinds: ["tools", "plugins"],
  },
  "opencode-v1": {
    file: "built-ai-configs/registry/registry.v1.json",
    defaultAgentRoot: "built-ai-configs/opencode-v1/agent",
    skillRoot: "built-ai-configs/opencode-v1/skills",
    commandRoot: "built-ai-configs/opencode-v1/command",
    agentPath: (agent, root) => `${root}/${agent.relativePath}`,
    supersededPaths: (agent, root) => {
      const folder = agent.relativePath.includes("/") ? agent.relativePath.slice(0, agent.relativePath.lastIndexOf("/") + 1) : "";
      return [
        ...agent.oac.aliases.map((alias) => `${root}/${folder}${alias}.md`),
        ...agent.oac.previousPaths.map((previous) => `${root}/${previous}`),
      ];
    },
    unavailableCategories: [],
    unavailableProfileKinds: [],
  },
};
