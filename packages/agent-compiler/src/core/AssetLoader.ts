/**
 * AssetLoader: canonical skills and commands (`agent-library/skills/**`, `agent-library/commands/**`).
 *
 * A skill is a folder `skills/<id>/` holding `SKILL.md` plus any supporting files; a command is one
 * file `commands/[<group>/]<id>.md`. Both carry an `oac:` block in their frontmatter (the same
 * mechanism agents use). Unlike an agent, the rest of the frontmatter is NOT parsed into a schema:
 * it is host-native (Claude's `context: fork`, OpenCode's `description`), so it is kept as authored
 * text and emitted byte-for-byte with the `oac:` block removed (see `AssetEmitter`).
 *
 * Identity is checked, not inferred: the id must equal the skill folder / command file name, and a
 * skill's frontmatter `name` (if present) must equal the id, because both hosts resolve a skill by
 * its folder name. Two assets of one kind may not share an id or an alias.
 */

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import * as yaml from "js-yaml";
import { ZodError } from "zod";
import { OacAssetBlockSchema, type OacAssetBlock } from "../types.js";

export type AssetKind = "skill" | "command";

/** Where the canonical sources live, relative to the repo root. */
export const SKILLS_ROOT = "agent-library/skills";
export const COMMANDS_ROOT = "agent-library/commands";

export const ASSET_ROOTS: Readonly<Record<AssetKind, string>> = {
  skill: SKILLS_ROOT,
  command: COMMANDS_ROOT,
};

/** The deepest group folder a command may sit in (`openagents/new-agents/x.md` is depth 2). */
export const MAX_COMMAND_DEPTH = 2;

export class AssetLoadError extends Error {
  constructor(message: string, readonly filePath: string, cause?: unknown) {
    super(message, cause === undefined ? undefined : { cause });
    this.name = "AssetLoadError";
  }
}

/** A file shipped next to a skill's `SKILL.md`. */
export interface SupportingFile {
  /** Path relative to the skill folder, POSIX-separated. */
  relativePath: string;
  /** Absolute path on disk. */
  filePath: string;
  executable: boolean;
}

export interface CanonicalAssetFile {
  kind: AssetKind;
  /** Absolute path of `SKILL.md` / the command file. */
  filePath: string;
  /**
   * Path relative to the kind's root, POSIX. Skill: `<id>/SKILL.md`. Command: `[<group>/]<id>.md`
   * (this is also the path the host sees, and so the name a user types after `/`).
   */
  relativePath: string;
  oac: OacAssetBlock;
  /** The frontmatter lines with the `oac:` block removed. Empty when nothing else was authored. */
  frontmatter: string[];
  /** Everything after the closing `---` line, byte-for-byte. */
  body: string;
  /** Number of source lines before `body` (for error line numbers). */
  bodyLineOffset: number;
  /** The frontmatter `description` as authored (undefined when absent). */
  description: string | undefined;
  /** The frontmatter `name` as authored (undefined when absent). */
  frontmatterName: string | undefined;
  /** The whole parsed frontmatter, `oac` excluded (read-only use: lints). */
  fields: Readonly<Record<string, unknown>>;
  /** Skills only: the other files in the folder, sorted by path. */
  supporting: SupportingFile[];
  executable: boolean;
  /** Group folder of a command (`openagents`, `openagents/new-agents`), or "" for none. */
  group: string;
}

function compare(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

const toPosix = (path: string): string => path.split(sep).join("/");

const FRONTMATTER = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/;

/** Split a source into frontmatter lines, body and the body's line offset. `null` when none. */
function split(content: string): { lines: string[]; body: string; offset: number } | null {
  const match = FRONTMATTER.exec(content);
  if (match === null) return null;
  const lines = match[1]!.split("\n");
  return { lines, body: match[2]!, offset: lines.length + 2 };
}

/**
 * Remove the top-level `oac:` block from frontmatter lines. The block is the `oac:` line and every
 * following line that is indented or blank; trailing blank lines stay with the next key.
 */
export function removeOacBlock(lines: readonly string[]): string[] | null {
  const start = lines.findIndex((line) => /^oac:\s*$/.test(line));
  if (start === -1) return null;
  let end = start + 1;
  while (end < lines.length && (/^[ \t]/.test(lines[end]!) || lines[end]!.trim() === "")) end += 1;
  while (end > start + 1 && lines[end - 1]!.trim() === "") end -= 1;
  return [...lines.slice(0, start), ...lines.slice(end)];
}

/** The `oac:` line and its indented body, as lines (so they can be parsed on their own). */
function extractOacBlock(lines: readonly string[]): string[] | null {
  const start = lines.findIndex((line) => /^oac:\s*$/.test(line));
  if (start === -1) return null;
  let end = start + 1;
  while (end < lines.length && (/^[ \t]/.test(lines[end]!) || lines[end]!.trim() === "")) end += 1;
  return lines.slice(start, end);
}

/** Top-level fields of the host's own frontmatter: YAML when valid, else `key: value` lines. */
function parseHostFields(lines: readonly string[]): Record<string, unknown> {
  try {
    const parsed = yaml.load(lines.join("\n"));
    if (parsed !== null && typeof parsed === "object" && !Array.isArray(parsed)) return parsed as Record<string, unknown>;
    return {};
  } catch {
    const out: Record<string, unknown> = {};
    for (const line of lines) {
      const match = /^([A-Za-z_][\w-]*):[ \t]*(.*)$/.exec(line);
      if (match === null) continue;
      out[match[1]!] = match[2]!.replace(/^(["'])(.*)\1$/, "$2");
    }
    return out;
  }
}

function isExecutable(path: string): boolean {
  return (statSync(path).mode & 0o111) !== 0;
}

/** Folders never shipped or scanned. */
const SKIPPED_DIRS: ReadonlySet<string> = new Set(["node_modules", ".git"]);
/** Files never shipped. Every other file, dotfiles included, is shipped. */
const SKIPPED_FILES: ReadonlySet<string> = new Set([".DS_Store"]);

/**
 * Every regular file under `dir`, sorted. Symlinks (to a file or a folder) are skipped, never
 * followed: a link inside a skill must not pull in content from outside `agent-library/`.
 * Skipped silently, by design; `.git` and `node_modules` folders and `.DS_Store` files likewise.
 */
function listFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true })
    .flatMap((entry) => {
      const full = join(dir, entry.name);
      if (entry.isSymbolicLink()) return [];
      if (entry.isDirectory()) return SKIPPED_DIRS.has(entry.name) ? [] : listFiles(full);
      return entry.isFile() && !SKIPPED_FILES.has(entry.name) ? [full] : [];
    })
    .sort(compare);
}

/** A command group folder is part of the command's name on the host, so it is a kebab-case slug. */
const GROUP_NAME = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** Parse one canonical file. `idFromPath` is the id the location demands. */
function loadFile(
  kind: AssetKind,
  filePath: string,
  relativePath: string,
  idFromPath: string,
  group: string,
): CanonicalAssetFile {
  const content = readFileSync(filePath, "utf-8");
  const parts = split(content);
  if (parts === null) {
    throw new AssetLoadError(`No frontmatter in ${filePath}. A canonical ${kind} needs frontmatter with an \`oac:\` block.`, filePath);
  }
  if (content.includes("\r")) {
    throw new AssetLoadError(`${filePath} has CRLF line endings; canonical sources use LF.`, filePath);
  }

  // Only the `oac:` block is held to YAML. The rest of the frontmatter belongs to the host, and
  // Claude Code reads it leniently (`argument-hint: [--force] [--dry-run]` is not valid YAML), so
  // it is parsed when it can be and scanned line by line when it cannot.
  const block = extractOacBlock(parts.lines);
  if (block === null) {
    throw new AssetLoadError(
      `No \`oac:\` block in ${filePath}. A canonical ${kind} must declare one carrying at least { id, name }.`,
      filePath,
    );
  }
  let rawOac: unknown;
  try {
    rawOac = (yaml.load(block.join("\n")) as { oac?: unknown } | null)?.oac;
  } catch (cause) {
    throw new AssetLoadError(`Failed to parse the oac block in ${filePath}`, filePath, cause);
  }
  const remaining = removeOacBlock(parts.lines) ?? parts.lines;
  const fields = parseHostFields(remaining);

  let oac: OacAssetBlock;
  try {
    oac = OacAssetBlockSchema.parse(rawOac ?? {});
  } catch (cause) {
    if (cause instanceof ZodError) {
      throw new AssetLoadError(
        `Validation failed for ${filePath}:\n${cause.errors.map((e) => `  - oac.${e.path.join(".")}: ${e.message}`).join("\n")}`,
        filePath,
        cause,
      );
    }
    throw cause;
  }

  if (oac.id !== idFromPath) {
    throw new AssetLoadError(
      `${filePath}: oac.id "${oac.id}" must equal the ${kind === "skill" ? "folder" : "file"} name "${idFromPath}".`,
      filePath,
    );
  }
  const name = typeof fields.name === "string" ? fields.name : undefined;
  if (kind === "skill" && name !== undefined && name !== oac.id) {
    throw new AssetLoadError(
      `${filePath}: frontmatter name "${name}" must equal the skill id "${oac.id}" (hosts resolve a skill by its folder name).`,
      filePath,
    );
  }
  const description = typeof fields.description === "string" ? fields.description : undefined;
  if (description === undefined && oac.description === undefined) {
    throw new AssetLoadError(
      `${filePath}: no description. Give the frontmatter a \`description:\` or set \`oac.description\` (the registry entry needs one).`,
      filePath,
    );
  }

  return {
    kind,
    filePath,
    relativePath,
    oac,
    frontmatter: remaining,
    body: parts.body,
    bodyLineOffset: parts.offset,
    description,
    frontmatterName: name,
    fields,
    supporting: [],
    executable: isExecutable(filePath),
    group,
  };
}

/** Load every canonical skill under `root`. Sorted by id. */
export function loadCanonicalSkills(root: string): CanonicalAssetFile[] {
  if (!existsSync(root)) return [];
  const skills: CanonicalAssetFile[] = [];
  for (const entry of readdirSync(root, { withFileTypes: true }).sort((a, b) => compare(a.name, b.name))) {
    const dir = join(root, entry.name);
    if (!entry.isDirectory()) {
      if (entry.name === ".DS_Store") continue;
      throw new AssetLoadError(`${dir}: skills are folders (skills/<id>/SKILL.md); a loose file is not a skill.`, dir);
    }
    const main = join(dir, "SKILL.md");
    if (!existsSync(main)) throw new AssetLoadError(`${dir} has no SKILL.md.`, dir);
    const skill = loadFile("skill", main, `${entry.name}/SKILL.md`, entry.name, "");
    skill.supporting = listFiles(dir)
      .filter((file) => file !== main)
      .map((file) => ({ relativePath: toPosix(relative(dir, file)), filePath: file, executable: isExecutable(file) }));
    skills.push(skill);
  }
  return finish(skills);
}

/** Load every canonical command under `root`. Sorted by id. */
export function loadCanonicalCommands(root: string): CanonicalAssetFile[] {
  if (!existsSync(root)) return [];
  const commands = listFiles(root).map((file) => {
    const relativePath = toPosix(relative(root, file));
    if (!relativePath.endsWith(".md")) {
      throw new AssetLoadError(`${file}: only .md files may live under commands/ (every one is a command).`, file);
    }
    const segments = relativePath.split("/");
    const group = segments.slice(0, -1);
    if (group.length > MAX_COMMAND_DEPTH) {
      throw new AssetLoadError(`${file}: commands nest at most ${MAX_COMMAND_DEPTH} folders deep.`, file);
    }
    const badGroup = group.find((name) => !GROUP_NAME.test(name));
    if (badGroup !== undefined) {
      throw new AssetLoadError(
        `${file}: command group folder "${badGroup}" must be kebab-case (lowercase letters, digits, single hyphens); it is part of the command's name.`,
        file,
      );
    }
    return loadFile("command", file, relativePath, segments[segments.length - 1]!.replace(/\.md$/, ""), group.join("/"));
  });
  return finish(commands);
}

/** Reject duplicate ids / aliases within one kind, then sort by id. */
function finish(assets: CanonicalAssetFile[]): CanonicalAssetFile[] {
  const seen = new Map<string, CanonicalAssetFile>();
  for (const asset of assets) {
    for (const key of [asset.oac.id, ...asset.oac.aliases]) {
      const clash = seen.get(key);
      if (clash !== undefined) {
        throw new AssetLoadError(
          `Duplicate ${asset.kind} id/alias "${key}": declared by both ${clash.relativePath} and ${asset.relativePath}.`,
          asset.filePath,
        );
      }
      seen.set(key, asset);
    }
  }
  return assets.sort((a, b) => compare(a.oac.id, b.oac.id));
}

export interface LoadedAssets {
  skills: CanonicalAssetFile[];
  commands: CanonicalAssetFile[];
}

/** Both kinds, from a repo root. */
export function loadCanonicalAssets(root: string): LoadedAssets {
  return {
    skills: loadCanonicalSkills(join(root, SKILLS_ROOT)),
    commands: loadCanonicalCommands(join(root, COMMANDS_ROOT)),
  };
}
