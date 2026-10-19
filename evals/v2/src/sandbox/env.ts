// Env allowlist, throwaway HOME/XDG builder and the TS side of run-isolated.sh (plan §4.2).
import { existsSync, mkdirSync, mkdtempSync, realpathSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { dirname, join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { exec, type ExecResult } from "../core/exec.ts";
import { assertContainedLaunch, type LaunchDecl } from "./gate.ts";

const HERE = dirname(fileURLToPath(import.meta.url));
export const WRAPPER = join(HERE, "run-isolated.sh");
export const PROFILE = join(HERE, "profiles", "agent.sb");
/** The user's OpenCode managed-service port (L-006); always denied inside the sandbox. */
export const OPENCODE_SERVICE_PORT = "49374";

/** Every env name a sandboxed process may see. Anything else is a scrub failure. */
export const ENV_ALLOWLIST = new Set([
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

export interface IsoDirs {
  root: string;
  work: string;
  home: string;
  cache: string;
}

let suiteTmp: string | undefined;

/** One run-wide throwaway root under $TMPDIR. Refuses anything under $HOME or the repo. */
export function suiteTmpRoot(repo: string): string {
  if (suiteTmp) return suiteTmp;
  const base = realpathSync(tmpdir());
  const root = realpathSync(mkdtempSync(join(base, "oac-suite-")));
  assertOutside(root, repo);
  suiteTmp = root;
  return root;
}

export function assertOutside(p: string, repo: string): void {
  const real = realpathSync(p) + sep;
  for (const forbidden of [realpathSync(homedir()), realpathSync(repo)]) {
    if (real.startsWith(forbidden + sep)) throw new Error(`sandbox: refusing temp dir ${p}: it is inside ${forbidden}`);
  }
}

export function makeIsoDirs(tmpRoot: string, name: string): IsoDirs {
  const root = join(tmpRoot, name.replace(/[^A-Za-z0-9._-]+/g, "_"));
  const d: IsoDirs = { root, work: join(root, "work"), home: join(root, "home"), cache: join(root, "cache") };
  for (const p of [d.work, d.home, d.cache, join(d.home, "tmp"), join(d.home, ".config"), join(d.home, ".local", "share"), join(d.home, ".local", "state")]) {
    mkdirSync(p, { recursive: true });
  }
  return { root: realpathSync(root), work: realpathSync(d.work), home: realpathSync(d.home), cache: realpathSync(d.cache) };
}

/** Directories holding the host binaries we need, plus the system basics. Never ~/.local/bin wholesale. */
export function safePath(binaries: (string | undefined)[]): string {
  const dirs = new Set<string>();
  for (const b of binaries) if (b) dirs.add(dirname(b));
  for (const d of ["/usr/bin", "/bin", "/usr/sbin", "/sbin"]) dirs.add(d);
  return [...dirs].join(":");
}

export function isoEnv(d: IsoDirs, path: string, extra: Record<string, string> = {}): Record<string, string> {
  const env: Record<string, string> = {
    PATH: path,
    HOME: d.home,
    USER: "oac-test",
    LOGNAME: "oac-test",
    SHELL: "/bin/bash",
    TMPDIR: join(d.home, "tmp"),
    LANG: "en_US.UTF-8",
    TERM: "dumb",
    NO_COLOR: "1",
    XDG_CONFIG_HOME: join(d.home, ".config"),
    XDG_DATA_HOME: join(d.home, ".local", "share"),
    XDG_STATE_HOME: join(d.home, ".local", "state"),
    XDG_CACHE_HOME: d.cache,
    GIT_CONFIG_GLOBAL: "/dev/null",
    GIT_CONFIG_NOSYSTEM: "1",
    GIT_TERMINAL_PROMPT: "0",
    CLAUDE_CONFIG_DIR: join(d.home, ".claude"),
    DISABLE_AUTOUPDATER: "1",
    CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC: "1",
    DISABLE_TELEMETRY: "1",
    DISABLE_ERROR_REPORTING: "1",
    OPENCODE_DISABLE_AUTOUPDATE: "1",
    OPENCODE_DISABLE_SHARE: "1",
    ...extra,
  };
  for (const k of Object.keys(env)) if (!ENV_ALLOWLIST.has(k)) throw new Error(`sandbox: env name ${k} is not on the allowlist`);
  return env;
}

export interface SandboxTarget {
  repo: string;
  /** Directory the sandboxed process must never read (the repo under test, or "/nonexistent"). */
  repoDeny: string;
  /** The launching check's declaration; runIsolated refuses before any spawn unless authorized. */
  launch: LaunchDecl;
}

let mainCheckout: string | undefined;
/** The main checkout behind a git worktree (also denied), or the repo itself. */
export async function mainCheckoutOf(repo: string, launch: LaunchDecl): Promise<string> {
  assertContainedLaunch(launch, sandboxMode());
  if (mainCheckout) return mainCheckout;
  const r = await exec("git", ["rev-parse", "--path-format=absolute", "--git-common-dir"], { cwd: repo, stdoutOnly: true, timeoutMs: 10_000 });
  const common = r.out.trim();
  mainCheckout = r.code === 0 && common ? dirname(resolve(common)) : repo;
  return mainCheckout;
}

export function sandboxMode(): "seatbelt" | "iso" {
  if (process.env.OAC_SANDBOX === "iso") return "iso";
  return process.platform === "darwin" && existsSync("/usr/bin/sandbox-exec") ? "seatbelt" : "iso";
}

export interface IsolatedRun {
  dirs: IsoDirs;
  env: Record<string, string>;
  argv: string[];
  target: SandboxTarget;
  timeoutMs?: number;
  onData?: (s: string) => void;
  /** Return only stdout in `out`. */
  stdoutOnly?: boolean;
}

export async function runIsolated(r: IsolatedRun): Promise<ExecResult> {
  assertContainedLaunch(r.target.launch, sandboxMode());
  const m = await mainCheckoutOf(r.target.repo, r.target.launch);
  // When the suite runs in the main checkout itself, an installer run that may read the repo
  // must not have it denied through the MAIN_DENY slot either.
  const main = realpathSync(m) === realpathSync(r.target.repo) ? r.target.repoDeny : m;
  const mode = sandboxMode();
  const assignments = Object.entries(r.env).map(([k, v]) => `${k}=${v}`);
  return exec(
    "/bin/bash",
    [WRAPPER, PROFILE, r.dirs.work, realpathSync(homedir()), r.target.repoDeny, main, OPENCODE_SERVICE_PORT, "--", ...assignments, "--", ...r.argv],
    { env: { PATH: "/usr/bin:/bin", OAC_SANDBOX: mode }, timeoutMs: r.timeoutMs ?? 120_000, onData: r.onData, stdoutOnly: r.stdoutOnly },
  );
}
