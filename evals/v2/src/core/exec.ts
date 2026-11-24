import { spawn } from "node:child_process";

export interface ExecResult {
  code: number;
  out: string;
  timedOut: boolean;
  ms: number;
}

export interface ExecOptions {
  cwd?: string;
  env?: NodeJS.ProcessEnv;
  timeoutMs?: number;
  /** Called with every chunk of combined stdout+stderr. */
  onData?: (chunk: string) => void;
  /** Return only stdout in `out` (stderr still goes to onData). */
  stdoutOnly?: boolean;
}

/**
 * Run a command with stdin closed (`</dev/null`: OpenCode otherwise eats the caller's stdin)
 * in its own process group, so a timeout kills the whole tree.
 */
export function exec(cmd: string, args: string[], opts: ExecOptions = {}): Promise<ExecResult> {
  const start = Date.now();
  return new Promise((resolve) => {
    const child = spawn(cmd, args, {
      cwd: opts.cwd,
      env: opts.env ?? process.env,
      stdio: ["ignore", "pipe", "pipe"],
      detached: true,
    });
    let out = "";
    let timedOut = false;
    const onOut = (b: Buffer): void => {
      const s = b.toString();
      out += s;
      opts.onData?.(s);
    };
    const onErr = (b: Buffer): void => {
      const s = b.toString();
      if (!opts.stdoutOnly) out += s;
      opts.onData?.(s);
    };
    child.stdout.on("data", onOut);
    child.stderr.on("data", onErr);
    const timer = setTimeout(() => {
      timedOut = true;
      try {
        if (child.pid) process.kill(-child.pid, "SIGKILL");
      } catch {
        /* already gone */
      }
    }, opts.timeoutMs ?? 300_000);
    child.on("error", (e) => {
      clearTimeout(timer);
      resolve({ code: 127, out: out + String(e), timedOut, ms: Date.now() - start });
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      resolve({ code: timedOut ? 124 : code ?? 1, out, timedOut, ms: Date.now() - start });
    });
  });
}

/** Resolve a binary on the caller's PATH to an absolute path, or undefined. */
export async function which(bin: string): Promise<string | undefined> {
  const r = await exec("/bin/sh", ["-c", `command -v ${bin}`], { timeoutMs: 5000, stdoutOnly: true });
  const p = r.out.trim();
  return r.code === 0 && p.startsWith("/") ? p : undefined;
}
