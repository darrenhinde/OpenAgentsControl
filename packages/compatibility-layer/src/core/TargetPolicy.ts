/**
 * TargetPolicy — which build targets an agent is emitted to. Pure.
 *
 * `opencode` means OpenCode v2 (the default host). `opencode-v1` FOLLOWS it: an agent opts into
 * OpenCode once and is built for both majors, so the 33 agent files carry no v1 boilerplate and
 * dropping v1 support later is a build-level change. Declaring `opencode-v1` alone makes an
 * agent v1-only, which is how an agent that depends on a v1-only tool stays off the v2 install.
 */

export type EmitTarget = "opencode" | "opencode-v1" | "claude-code";

/** The slice of a canonical agent this policy reads. */
export interface DeclaresTargets {
  oac: { targets: readonly string[] };
}

export function emitsTo(agent: DeclaresTargets, target: EmitTarget): boolean {
  const declared = agent.oac.targets;
  if (target === "opencode-v1") return declared.includes("opencode") || declared.includes("opencode-v1");
  return declared.includes(target);
}
