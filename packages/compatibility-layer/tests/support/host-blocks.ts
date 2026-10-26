/**
 * A canonical agent whose body carries one `oac:only` block per build target, shared by the
 * adapter tests that prove each target keeps its own section and drops the others'.
 *
 * The claude-code block also names an agent no resolver knows (`Ghost`): an OpenCode emitter
 * that rewrote delegation refs BEFORE filtering would fail on it, so a clean OpenCode emission
 * is also proof that host blocks are resolved first.
 */

export const HOST_BLOCK_SOURCE = [
  "---",
  "name: Probe",
  "description: A probe agent.",
  "mode: subagent",
  "oac:",
  "  id: probe",
  "  name: Probe",
  "  category: core",
  "  type: subagent",
  "  targets:",
  "    - opencode",
  "    - claude-code",
  "  overrides:",
  "    claude-code:",
  "      tools: [Read]",
  "---",
  "",
  "# Probe",
  "",
  "Shared intro.",
  "",
  "<!-- oac:only claude-code -->",
  "CLAUDE-ONLY text.",
  'task(subagent_type="Ghost", description="d")',
  "<!-- /oac:only -->",
  "",
  "<!-- oac:only opencode -->",
  "V2-ONLY text.",
  "<!-- /oac:only -->",
  "",
  "<!-- oac:only opencode-v1 -->",
  "V1-ONLY text.",
  "<!-- /oac:only -->",
  "",
  "<!-- oac:only opencode, opencode-v1 -->",
  "OPENCODE-ANY text.",
  "<!-- /oac:only -->",
  "",
  "Shared outro.",
  "",
].join("\n");

/** Line (1-based) of the first `<!-- oac:only` marker in {@link HOST_BLOCK_SOURCE}. */
export const FIRST_MARKER_LINE = HOST_BLOCK_SOURCE.split("\n").indexOf("<!-- oac:only claude-code -->") + 1;

/** {@link HOST_BLOCK_SOURCE} with its first marker naming a target that does not exist. */
export const UNKNOWN_TARGET_SOURCE = HOST_BLOCK_SOURCE.replace(
  "<!-- oac:only claude-code -->",
  "<!-- oac:only emacs -->",
);

/** {@link HOST_BLOCK_SOURCE} with its first marker malformed (trailing word). */
export const MALFORMED_SOURCE = HOST_BLOCK_SOURCE.replace(
  "<!-- oac:only claude-code -->",
  "<!-- oac:only claude-code please -->",
);
