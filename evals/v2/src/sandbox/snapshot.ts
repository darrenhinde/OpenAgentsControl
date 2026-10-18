// Before/after snapshot of files OUTSIDE the temp dirs (plan §4.5).
//
// Deliberate deviation from the plan: real config files are recorded by lstat only
// (size, mtime, inode), never by content hash, so the suite never reads the maintainer's
// ~/.claude, ~/.config/opencode or credentials. Any change still shows up as mtime/size.
// $HOME itself is compared by top-level entry NAMES only. Files a live Claude/OpenCode
// session rewrites on its own (~/.claude.json, session DBs, logs) are excluded (R8).
import { lstatSync, readdirSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { exec } from "../core/exec.ts";

const HOME_SENTINELS = [
  ".claude/settings.json", ".claude/settings.local.json", ".claude/CLAUDE.md", ".claude/plugins/installed_plugins.json",
  ".config/opencode/opencode.json", ".config/opencode/opencode.jsonc", ".config/opencode/config.json", ".config/opencode/AGENTS.md",
  ".opencode/opencode.json", ".opencode/package.json",
  ".gitconfig", ".ssh/config", ".ssh/authorized_keys", ".aws/credentials", ".aws/config", ".npmrc", ".netrc",
];
const HOME_CHURN = /^\.claude\.json|^\.DS_Store$|^\.zsh_history|^\.bash_history|^\.lesshst$|^\.viminfo$|^\.node_repl_history$|^\.python_history$/;

export interface Snapshot {
  files: Record<string, string>;
  homeEntries: string[];
  repoHead: string;
  repoStatus: string;
}

function statKey(p: string): string {
  try {
    const s = lstatSync(p);
    return `${s.size}:${s.mtimeMs}:${s.ino}`;
  } catch {
    return "absent";
  }
}

export async function takeSnapshot(repo: string): Promise<Snapshot> {
  const home = homedir();
  const files: Record<string, string> = {};
  for (const rel of HOME_SENTINELS) files[`~/${rel}`] = statKey(join(home, rel));
  let homeEntries: string[] = [];
  try {
    homeEntries = readdirSync(home).filter((n) => !HOME_CHURN.test(n)).sort();
  } catch {
    /* unreadable home: nothing to compare */
  }
  const head = await exec("git", ["rev-parse", "HEAD"], { cwd: repo, stdoutOnly: true, timeoutMs: 10_000 });
  const status = await exec("git", ["status", "--porcelain=v1"], { cwd: repo, stdoutOnly: true, timeoutMs: 30_000 });
  return { files, homeEntries, repoHead: head.out.trim(), repoStatus: status.out };
}

/** Human-readable list of everything that changed. Empty = unchanged. */
export function diffSnapshots(a: Snapshot, b: Snapshot): string[] {
  const changed: string[] = [];
  for (const [k, v] of Object.entries(a.files)) if (b.files[k] !== v) changed.push(k);
  const before = new Set(a.homeEntries);
  for (const n of b.homeEntries) if (!before.has(n)) changed.push(`~/${n} (new in $HOME)`);
  if (a.repoHead !== b.repoHead) changed.push("repo HEAD moved");
  if (a.repoStatus !== b.repoStatus) changed.push("repo git status changed");
  return changed;
}
