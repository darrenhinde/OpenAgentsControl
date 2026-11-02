/**
 * The static-lint runner: every lint that applies to a host, over one build's emitted files.
 * Pure: the caller hands in the plan's in-memory files, so a lint sees exactly what a build would
 * write, staged targets included. `oac build` reports these and fails on them under `--strict`.
 */

import { lintClaudeAgents, lintOpenCodeDelegations } from "./capability.js";
import { lintV1Agents, lintV1Artifacts, lintV2Agents, type LintFile, type LintFinding } from "./opencode.js";

/** The slice of a build file a lint needs (structurally a `BuildFile`). */
export interface LintableFile {
  path: string;
  content: string;
  target: string;
  /** Set on a live-path mirror of another file; mirrors are not linted twice. */
  mirrorOf?: string;
}

export interface TargetLintResult {
  target: string;
  findings: LintFinding[];
}

const isAgent = (path: string): boolean => path.endsWith(".md");
const isModule = (path: string): boolean => /\.(ts|js|mjs)$/.test(path);

/** The lints for one host, keyed by build target. A target with none (the registries) is skipped. */
const LINTS: Readonly<Record<string, (files: LintFile[]) => LintFinding[]>> = {
  opencode: (files) => {
    const agents = files.filter((f) => isAgent(f.path));
    return [...lintV2Agents(agents), ...lintOpenCodeDelegations(agents, "v2")];
  },
  "opencode-v1": (files) => {
    const agents = files.filter((f) => isAgent(f.path));
    return [
      ...lintV1Agents(agents),
      ...lintOpenCodeDelegations(agents, "v1"),
      ...lintV1Artifacts(files.filter((f) => isModule(f.path))),
    ];
  },
  "claude-code": (files) => lintClaudeAgents(files.filter((f) => isAgent(f.path))),
};

/** Run every applicable lint over a build's files, one result per linted target, in target order. */
export function lintBuild(files: readonly LintableFile[]): TargetLintResult[] {
  const byTarget = new Map<string, LintFile[]>();
  for (const file of files) {
    if (LINTS[file.target] === undefined || file.mirrorOf !== undefined) continue;
    byTarget.set(file.target, [...(byTarget.get(file.target) ?? []), { path: file.path, text: file.content }]);
  }
  return [...byTarget].map(([target, group]) => ({ target, findings: LINTS[target]!(group) }));
}
