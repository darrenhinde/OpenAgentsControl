/**
 * Superseded files: installed copies of components that a later release renamed or moved.
 *
 * The registry records, per component, the paths it used to ship at (`supersedes`; the compiler
 * derives them from `oac.aliases` and `oac.previousPaths`). When the file at the component's
 * current `path` is installed (or is being installed), a file still sitting at an old path is
 * stale: OpenCode loads both, so the agent would be defined twice. This module finds those files;
 * `installer.ts` removes them and `oac doctor` reports them. Nothing here is a list of agent
 * names, so a future rename needs no change in this file.
 *
 * Reads the disk, never writes.
 */
import { lstat, readFile, realpath, stat } from 'node:fs/promises';
import path from 'node:path';
import { toDestPath } from './flavor.js';
import { isInstallablePath, listComponents, type Registry, type RegistryComponent } from './registry.js';

export type SupersededFile = {
  /** Destination path (relative to the project root) of the stale installed file. */
  oldPath: string;
  /** Destination path of the file that replaces it. */
  newPath: string;
  component: RegistryComponent;
};

const isFile = (absolute: string): Promise<boolean> =>
  stat(absolute).then((s) => s.isFile()).catch(() => false);

/** Where a superseded (stale) file may sit: only inside the installed agent directory. */
export const AGENT_DIR = '.opencode/agent';

/**
 * True when `destPath` (relative to the project root, already mapped by `toDestPath`) is somewhere a
 * superseded file may be removed: a normalised `.md` path under `.opencode/agent/`. The registry is
 * data from the network, so this is enforced here whatever the compiler validated. Pure.
 */
export const isSupersededPath = (destPath: string): boolean =>
  destPath.startsWith(`${AGENT_DIR}/`) &&
  destPath.endsWith('.md') &&
  !destPath.includes('\\') &&
  path.posix.normalize(destPath) === destPath &&
  !destPath.split('/').includes('..');

/**
 * True when removing (or reading, to back it up) `destPath` cannot leave the install's agent
 * directory: the file itself is not a symlink and its parent directory, once symlinks are resolved,
 * lies inside the resolved agent directory. A missing file is "safe" (nothing to touch).
 */
export const isSafeToRemove = async (projectRoot: string, destPath: string, jail: string = AGENT_DIR): Promise<boolean> => {
  const absolute = path.join(projectRoot, destPath);
  const info = await lstat(absolute).catch(() => null);
  if (info === null) return true;
  if (info.isSymbolicLink() || !info.isFile()) return false;
  const [parent, root] = await Promise.all([
    realpath(path.dirname(absolute)).catch(() => null),
    realpath(path.join(projectRoot, jail)).catch(() => null),
  ]);
  if (parent === null || root === null) return false;
  return parent === root || parent.startsWith(root + path.sep);
};

/** Old destination path -> the component that replaced it. Only `.md` paths under `.opencode/agent/`. Pure. */
export const supersededIndex = (registry: Registry): Map<string, SupersededFile> => {
  const index = new Map<string, SupersededFile>();
  for (const component of listComponents(registry)) {
    if (!isInstallablePath(component.path)) continue;
    const newPath = toDestPath(component.path);
    for (const previous of component.supersedes ?? []) {
      if (!isInstallablePath(previous)) continue;
      const oldPath = toDestPath(previous);
      if (!isSupersededPath(oldPath)) continue;
      if (oldPath !== newPath) index.set(oldPath, { oldPath, newPath, component });
    }
  }
  return index;
};

/**
 * Installed files that a component in `registry` supersedes, whose replacement is already on disk
 * or listed in `planned` (destination paths a run in progress is installing). Sorted by old path.
 */
export const findSuperseded = async (
  projectRoot: string,
  registry: Registry,
  planned: ReadonlySet<string> = new Set(),
  only?: (component: RegistryComponent) => boolean,
): Promise<SupersededFile[]> => {
  const found: SupersededFile[] = [];
  for (const entry of supersededIndex(registry).values()) {
    if (only !== undefined && !only(entry.component)) continue;
    if (!(await isFile(path.join(projectRoot, entry.oldPath)))) continue;
    if (!planned.has(entry.newPath) && !(await isFile(path.join(projectRoot, entry.newPath)))) continue;
    found.push(entry);
  }
  return found.sort((a, b) => a.oldPath.localeCompare(b.oldPath));
};

const frontmatterDescription = (text: string): string | null => {
  const match = /^---\r?\n([\s\S]*?)\r?\n---/.exec(text);
  const line = match?.[1]?.split(/\r?\n/).find((l) => l.startsWith('description:'));
  if (line === undefined) return null;
  return line.slice('description:'.length).trim().replace(/^(["'])(.*)\1$/, '$2');
};

/**
 * True when a file we do not track as OAC's own still reads as the old bundled copy of `component`
 * (same frontmatter description). A user's own agent that happens to share an old id fails this
 * and is left alone.
 */
export const looksLikeBundledCopy = async (absolute: string, component: RegistryComponent): Promise<boolean> => {
  const text = await readFile(absolute, 'utf8').catch(() => null);
  if (text === null) return false;
  const description = frontmatterDescription(text);
  return description !== null && description === component.description.trim();
};

/**
 * Agent ids (and file stems) of installed agents that an installed canonical agent has replaced:
 * lets `oac apply claude` skip converting them. Pure over its inputs.
 */
export const supersededStems = (
  registry: Registry,
  installedStems: ReadonlySet<string>,
): Set<string> => {
  const stale = new Set<string>();
  for (const component of [...registry.components.agents, ...registry.components.subagents]) {
    const canonical = path.basename(component.path, '.md');
    if (!installedStems.has(canonical)) continue;
    for (const alias of component.aliases ?? []) {
      if (alias !== canonical) stale.add(alias);
    }
    for (const previous of component.supersedes ?? []) {
      const stem = path.basename(previous, '.md');
      if (stem !== canonical) stale.add(stem);
    }
  }
  return stale;
};
