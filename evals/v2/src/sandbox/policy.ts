// Sandbox policy constants shared by the launch path (env.ts) and the boundary probes
// (probes.ts). Data only: no imports, no I/O, so the pure probe modules can use them
// without importing env.ts (which imports exec.ts and gate.ts).

/** The user's OpenCode managed-service port (L-006); always denied inside the sandbox. */
export const OPENCODE_SERVICE_PORT = "49374";

/** Every env name a sandboxed process may see. Anything else is a scrub failure. */
export const ENV_ALLOWLIST: ReadonlySet<string> = new Set([
  "PATH", "HOME", "USER", "LOGNAME", "SHELL", "TMPDIR", "LANG", "LC_ALL", "TERM", "NO_COLOR", "FORCE_COLOR", "CI",
  "XDG_CONFIG_HOME", "XDG_DATA_HOME", "XDG_STATE_HOME", "XDG_CACHE_HOME",
  "GIT_CONFIG_GLOBAL", "GIT_CONFIG_NOSYSTEM", "GIT_TERMINAL_PROMPT",
  "CLAUDE_CONFIG_DIR", "DISABLE_AUTOUPDATER", "CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC", "DISABLE_TELEMETRY", "DISABLE_ERROR_REPORTING",
  "ANTHROPIC_API_KEY", "ANTHROPIC_BASE_URL",
  "OPENCODE_DISABLE_AUTOUPDATE", "OPENCODE_DISABLE_SHARE",
  "OAC_FAKE_TOKEN",
  // installer tests only
  "OAC_RAW_URL", "REGISTRY_URL", "OPENCODE_BRANCH",
  // set by macOS itself inside sandbox-exec / env
  "__CF_USER_TEXT_ENCODING", "PWD", "SHLVL", "_", "OLDPWD",
]);

/**
 * A non-allowlisted name the probe launch path sets in the wrapper's OWN environment; the
 * wrapper's `env -i` must scrub it, so seeing it inside the sandbox is an env-scrub failure.
 */
export const SCRUB_CANARY = "OAC_PROBE_SCRUB_CANARY";
