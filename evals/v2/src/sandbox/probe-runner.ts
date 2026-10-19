// The supervisor side of the boundary probes (P3-lite U3, component-p3-lite.md): the real
// effects behind probes.ts's injected ProbeRunner — the narrow launch path (env.ts
// runProbeIsolated), the 127.0.0.1 loopback listener, holding the service port around its one
// probe, the outside-the-sandbox metadata check of each named path, resolving the main
// checkout and the PID check. Every decision stays pure in probes.ts / probe-interpret.ts /
// evidence.ts. Only main.ts imports this module; no file under src/checks may (pinned in
// tests/unit/registry.test.ts).
//
// L-011: real credential paths are never opened, read or listed here — presence and
// readability come from lstat/access metadata only.
import { accessSync, constants, existsSync, lstatSync, readFileSync, realpathSync, rmSync } from "node:fs";
import { createServer as createHttpServer } from "node:http";
import { createServer as createTcpServer, type AddressInfo, type Server } from "node:net";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { PROFILE, makeIsoDirs, runProbeIsolated } from "./env.ts";
import { policyIdOf } from "./evidence.ts";
import { loopbackToken } from "./probe-interpret.ts";
import { OPENCODE_SERVICE_PORT } from "./policy.ts";
import {
  hostConfigPaths,
  runProbes,
  type HostPath,
  type PortHold,
  type PortHoldState,
  type ProbeContext,
  type ProbeReport,
  type ProbeRunner,
} from "./probes.ts";

/** sha256 of the Seatbelt profile every probe and contained check runs under. */
export function currentPolicyId(): string {
  return policyIdOf(readFileSync(PROFILE, "utf8"));
}

/** Metadata-only fs primitives: no open, read or list exists in this interface. */
export interface PathMeta {
  readonly lstat: (path: string) => unknown;
  readonly access: (path: string, mode: number) => void;
}

const REAL_META: PathMeta = { lstat: lstatSync, access: accessSync };

/** Presence via lstat, readability via access(R_OK). Never opens, reads or lists the path. */
export function outsideAccess(path: string, meta: PathMeta = REAL_META): HostPath["outside"] {
  try {
    meta.lstat(path);
  } catch (e) {
    return (e as NodeJS.ErrnoException).code === "ENOENT" ? "absent" : "inaccessible";
  }
  try {
    meta.access(path, constants.R_OK);
    return "accessible";
  } catch {
    return "inaccessible";
  }
}

/** The bits of the filesystem resolveMainCheckout reads: only `.git` and `commondir`. */
export interface GitView {
  readonly isDirectory: (path: string) => boolean;
  readonly readText: (path: string) => string | undefined;
}

/** Largest `.git` / `commondir` file read; real ones are one short line. */
const MAX_GIT_FILE_BYTES = 4096;

export interface GitFsOps {
  readonly lstat: (path: string) => { isSymbolicLink(): boolean; isFile(): boolean; isDirectory(): boolean; readonly size: number };
  readonly readFile: (path: string) => string;
}

/**
 * L-011: lstat first and never follow a symlink, so a planted `commondir → ~/.ssh/id_rsa`
 * is refused unread; only small regular files are read at all.
 */
export function makeGitView(fs: GitFsOps): GitView {
  const meta = (p: string): ReturnType<GitFsOps["lstat"]> | undefined => {
    try {
      return fs.lstat(p);
    } catch {
      return undefined;
    }
  };
  return {
    isDirectory: (p) => {
      const m = meta(p);
      return !!m && !m.isSymbolicLink() && m.isDirectory();
    },
    readText: (p) => {
      const m = meta(p);
      if (!m || m.isSymbolicLink() || !m.isFile() || m.size > MAX_GIT_FILE_BYTES) return undefined;
      try {
        const text = fs.readFile(p);
        return text.length > MAX_GIT_FILE_BYTES ? undefined : text;
      } catch {
        return undefined;
      }
    },
  };
}

const GITDIR_LINE = /^gitdir: ([^\n\r\0]+)\r?\n?$/;
const PATH_LINE = /^([^\n\r\0]+)\r?\n?$/;

/**
 * The main checkout behind a worktree, without spawning git: `.git` is a directory → the repo
 * itself; a `gitdir: <path>` file → that gitdir's `commondir` → its parent. Mirrors
 * env.ts mainCheckoutOf (dirname of --git-common-dir). Only a single `gitdir:` line and a single
 * path line are accepted, and only the resolved path is ever returned (never file contents);
 * anything else → undefined (MAIN_DENY falls back to the repo, reported as not probed).
 */
export function resolveMainCheckout(repo: string, view: GitView): string | undefined {
  const dotGit = join(repo, ".git");
  if (view.isDirectory(dotGit)) return repo;
  const gitdir = GITDIR_LINE.exec(view.readText(dotGit) ?? "")?.[1];
  if (!gitdir) return undefined;
  const absGitdir = resolve(repo, gitdir);
  const common = PATH_LINE.exec(view.readText(join(absGitdir, "commondir")) ?? "")?.[1];
  return common ? dirname(resolve(absGitdir, common)) : undefined;
}

const REAL_GIT_VIEW = makeGitView({
  lstat: (p) => lstatSync(p),
  readFile: (p) => readFileSync(p, "utf8"),
});

/** The repo when the main checkout is the same directory, so the probe does not list it twice. */
function mainCheckoutFor(repo: string): string | undefined {
  const main = resolveMainCheckout(repo, REAL_GIT_VIEW);
  if (!main) return undefined;
  try {
    return realpathSync(main) === realpathSync(repo) ? repo : main;
  } catch {
    return main;
  }
}

export interface PidCheck {
  /** process.kill(pid, 0): throws ESRCH once the PID no longer exists. */
  readonly kill0: (pid: number) => void;
  readonly sleep: (ms: number) => Promise<void>;
}

/** Polls signal 0 until ESRCH. Any other outcome (alive, EPERM) counts as still present. */
export async function waitForPidGone(pid: number, check: PidCheck, attempts = 40): Promise<boolean> {
  for (let i = 0; i < attempts; i++) {
    try {
      check.kill0(pid);
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code === "ESRCH") return true;
    }
    if (i < attempts - 1) await check.sleep(50);
  }
  return false;
}

const REAL_PID_CHECK: PidCheck = {
  kill0: (pid) => {
    process.kill(pid, 0);
  },
  sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
};

function listen(server: Server, port: number): Promise<"listening" | "in-use" | "failed"> {
  return new Promise((resolve) => {
    server.once("error", (e: NodeJS.ErrnoException) => resolve(e.code === "EADDRINUSE" ? "in-use" : "failed"));
    server.listen(port, "127.0.0.1", () => resolve("listening"));
  });
}

const close = (server: Server): Promise<void> => new Promise((resolve) => server.close(() => resolve()));

/** Binds 127.0.0.1:port; `close` is a no-op unless we hold it. */
export type BindPort = (port: number) => Promise<{ readonly state: PortHoldState; readonly close: () => Promise<void> }>;

const realBind: BindPort = async (port) => {
  const server = createTcpServer((socket) => socket.destroy()); // drops every connection unanswered
  const result = await listen(server, port);
  const state: PortHoldState = result === "listening" ? "ours" : result === "in-use" ? "occupied" : "failed";
  return { state, close: () => (server.listening ? close(server) : Promise.resolve()) };
};

/** Holds the port (if free) for one probe; release closes only our own listener. */
export async function holdPort(port: number, bind: BindPort): Promise<PortHold> {
  const bound = await bind(port);
  return { state: bound.state, release: bound.close };
}

/** Release check: a fresh bind of the same port succeeds (and is closed again). */
export async function portFree(port: number, bind: BindPort): Promise<boolean> {
  const bound = await bind(port);
  await bound.close();
  return bound.state === "ours";
}

export interface ProbeSandboxOptions {
  readonly mode: "seatbelt" | "iso";
  readonly repo: string;
  readonly tmpRoot: string;
  readonly runId: string;
  readonly policyId: string;
}

/**
 * Runs the fixed probe table once. iso mode has no Seatbelt to probe: it returns an empty
 * report (the contract then refuses contained workloads as unsupported-mode) without
 * launching anything or opening a listener.
 */
export async function probeSandbox(o: ProbeSandboxOptions): Promise<ProbeReport> {
  if (o.mode !== "seatbelt") return { mode: o.mode, policyId: o.policyId, probes: [] };
  const dirs = makeIsoDirs(o.tmpRoot, "sandbox-probes");
  const realHome = realpathSync(homedir());
  const servicePort = Number(OPENCODE_SERVICE_PORT);
  const loopback = createHttpServer((_req, res) => res.end(loopbackToken(o.runId)));
  try {
    if ((await listen(loopback, 0)) !== "listening") throw new Error("sandbox probes: cannot bind the loopback listener");
    const ctx: ProbeContext = {
      runId: o.runId,
      realHome,
      repo: o.repo,
      controlDir: dirs.work,
      loopbackPort: (loopback.address() as AddressInfo).port,
      mainCheckout: mainCheckoutFor(o.repo),
      hostConfig: hostConfigPaths(realHome).map((path) => ({ path, outside: outsideAccess(path) })),
    };
    const runner: ProbeRunner = {
      launch: (id, c) => runProbeIsolated(id, c, dirs),
      exists: existsSync,
      remove: (p) => rmSync(p, { force: true }),
      pidGone: (pid) => waitForPidGone(pid, REAL_PID_CHECK),
      holdServicePort: () => holdPort(servicePort, realBind),
      servicePortFree: () => portFree(servicePort, realBind),
    };
    return await runProbes(runner, ctx, o.policyId);
  } finally {
    if (loopback.listening) await close(loopback);
  }
}
