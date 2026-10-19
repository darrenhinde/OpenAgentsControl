/**
 * Detecting the OpenCode on PATH. Pure parsing plus an injectable exec, so nothing here needs a
 * real binary under test.
 *
 * `OAC_OPENCODE_VERSION` overrides detection entirely (`none` means no host). It exists for CI
 * and tests, which must never run a real `opencode`.
 */
import { execFile } from 'node:child_process';

/** Major version in `1.19.3`, `v2.0.30`, `opencode version 2.0.31`; null if there is none. Pure. */
export const parseOpenCodeMajor = (output: string): number | null => {
  const match = /(?:^|[^\d.])v?(\d+)\.\d+\.\d+/.exec(output.trim());
  return match === null ? null : Number(match[1]);
};

export type Exec = (command: string, args: readonly string[]) => Promise<string>;

const defaultExec: Exec = (command, args) =>
  new Promise((resolve, reject) => {
    execFile(command, [...args], { timeout: 5000 }, (error, stdout) => {
      if (error !== null) reject(error);
      else resolve(stdout);
    });
  });

export const detectOpenCodeMajor = async (
  deps: { env?: NodeJS.ProcessEnv; exec?: Exec } = {},
): Promise<number | null> => {
  const env = deps.env ?? process.env;
  const override = env['OAC_OPENCODE_VERSION'];
  if (override !== undefined && override !== '') {
    return override === 'none' ? null : parseOpenCodeMajor(override);
  }
  try {
    return parseOpenCodeMajor(await (deps.exec ?? defaultExec)('opencode', ['--version']));
  } catch {
    return null;
  }
};
