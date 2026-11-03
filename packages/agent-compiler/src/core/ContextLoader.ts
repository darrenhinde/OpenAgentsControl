/**
 * ContextLoader: the canonical context library (`agent-library/context/**`).
 *
 * Unlike agents, skills and commands, context documents are not compiled. They are knowledge files
 * with their own header (`<!-- Context: ... -->`), read by agents at runtime, and `install.sh`
 * rewrites the literal text `.opencode/context` inside them at install time. So the build COPIES
 * them, byte for byte, to `.opencode/context/**` (the path every installer, updater and hardcoded
 * reference already uses) and never rewrites a byte.
 *
 * Layout: every regular file under `agent-library/context/` is shipped at the same relative path,
 * except `components.json`, which is the library's registry metadata (see below) and is not
 * shipped. Symlinks are first-class: the three legacy aliases in `core/standards/` are relative
 * links to a sibling file and are emitted as links, not followed. `.git/`, `node_modules/` and
 * `.DS_Store` are skipped; every other file, dotfiles included, ships.
 *
 * `components.json` carries what the registry needs and a file cannot say about itself: id, name,
 * description, tags, dependencies, category and aliases, per registered file. The array order is
 * the registry order (it is curated, not sorted). A file may exist without being registered; it
 * then ships through `oac init --profile full`, the Claude install scripts and the repository
 * itself, but not through `install.sh` profiles (which install registry entries only).
 */

import { existsSync, lstatSync, readFileSync, readdirSync, readlinkSync } from "node:fs";
import { dirname, isAbsolute, join, normalize, relative, sep } from "node:path";
import { z } from "zod";

/** The canonical source, relative to the repo root. */
export const CONTEXT_SOURCE_ROOT = "agent-library/context";
/** The path the library ships at, on every host and in every install. */
export const CONTEXT_OUTPUT_ROOT = ".opencode/context";
/** The metadata file inside the library. Not shipped. */
export const CONTEXT_COMPONENTS_FILE = "components.json";

export class ContextLoadError extends Error {
  constructor(message: string, readonly filePath: string) {
    super(message);
    this.name = "ContextLoadError";
  }
}

/** One file of the library. */
export interface ContextFile {
  /** Path relative to the library root, POSIX. Also the path relative to `.opencode/context/`. */
  relativePath: string;
  /** Absolute path on disk. */
  filePath: string;
  /** Set when the file is a symlink: its (relative) target as written, e.g. `code-quality.md`. */
  linkTarget?: string;
}

/** One registry entry's worth of metadata, as authored in `components.json`. */
export const ContextComponentSchema = z
  .object({
    id: z.string().regex(/^[a-z0-9][a-z0-9_-]*$/, "id must be lowercase letters, digits, hyphens or underscores"),
    name: z.string().min(1),
    /** Path inside the library, e.g. `core/standards/code-quality.md`. */
    file: z.string().min(1),
    aliases: z.array(z.string().min(1)).optional(),
    description: z.string().min(1),
    tags: z.array(z.string()),
    dependencies: z.array(z.string()).optional(),
    category: z.string().min(1),
  })
  .strict();
export type ContextComponent = z.infer<typeof ContextComponentSchema>;

const ComponentsFileSchema = z.object({ version: z.literal(1), components: z.array(ContextComponentSchema) }).strict();

export interface ContextLibrary {
  /** Every shipped file, sorted by path. */
  files: ContextFile[];
  /** Registry metadata, in registry order. */
  components: ContextComponent[];
}

const SKIPPED_DIRS: ReadonlySet<string> = new Set(["node_modules", ".git"]);
const SKIPPED_FILES: ReadonlySet<string> = new Set([".DS_Store"]);

const compare = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);
const toPosix = (path: string): string => path.split(sep).join("/");

function walk(root: string, dir: string, out: ContextFile[]): void {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    const relativePath = toPosix(relative(root, full));
    if (entry.isSymbolicLink()) {
      out.push({ relativePath, filePath: full, linkTarget: readlinkSync(full) });
    } else if (entry.isDirectory()) {
      if (!SKIPPED_DIRS.has(entry.name)) walk(root, full, out);
    } else if (entry.isFile() && !SKIPPED_FILES.has(entry.name)) {
      if (relativePath !== CONTEXT_COMPONENTS_FILE) out.push({ relativePath, filePath: full });
    }
  }
}

/**
 * A library symlink must point at a regular file inside the library: one that leaves it would
 * ship a link to nowhere. The link is shipped RELATIVE, so it is right on every machine; an
 * absolute link that points inside the library (what `fs.cpSync` and some copy tools turn a
 * relative link into) is rewritten to the equivalent relative one rather than refused. Throws
 * otherwise. Returns the target to ship.
 */
function shippedLinkTarget(file: ContextFile, base: string, regular: ReadonlySet<string>): string {
  const target = file.linkTarget!;
  let shipped = target;
  if (isAbsolute(target) || /^[A-Za-z]:/.test(target)) {
    const inside = toPosix(relative(base, normalize(target)));
    shipped = inside.startsWith("..") ? target : toPosix(relative(dirname(file.filePath), normalize(target)));
  }
  const resolved = toPosix(normalize(join(dirname(file.relativePath), shipped)));
  if (isAbsolute(shipped) || resolved.startsWith("../") || resolved === ".." || !regular.has(resolved)) {
    throw new ContextLoadError(
      `${file.filePath}: symlink target "${target}" must be a regular file inside agent-library/context/ (resolved to "${resolved}").`,
      file.filePath,
    );
  }
  return shipped;
}

/** Load the library under `root` (a repo root). A missing library is an empty one. */
export function loadContextLibrary(root: string): ContextLibrary {
  const base = join(root, CONTEXT_SOURCE_ROOT);
  if (!existsSync(base) || !lstatSync(base).isDirectory()) return { files: [], components: [] };

  const files: ContextFile[] = [];
  walk(base, base, files);
  files.sort((a, b) => compare(a.relativePath, b.relativePath));

  const regular = new Set(files.filter((f) => f.linkTarget === undefined).map((f) => f.relativePath));
  for (const file of files) if (file.linkTarget !== undefined) file.linkTarget = shippedLinkTarget(file, base, regular);

  const componentsPath = join(base, CONTEXT_COMPONENTS_FILE);
  let components: ContextComponent[] = [];
  if (existsSync(componentsPath)) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(readFileSync(componentsPath, "utf-8"));
    } catch (cause) {
      throw new ContextLoadError(`${componentsPath} is not valid JSON: ${(cause as Error).message}`, componentsPath);
    }
    const result = ComponentsFileSchema.safeParse(parsed);
    if (!result.success) {
      throw new ContextLoadError(
        `Validation failed for ${componentsPath}:\n${result.error.errors.map((e) => `  - ${e.path.join(".")}: ${e.message}`).join("\n")}`,
        componentsPath,
      );
    }
    components = result.data.components;
  }
  validateComponents(components, new Map(files.map((f) => [f.relativePath, f])), componentsPath);
  return { files, components };
}

/** A registered file must exist, ids and aliases must be unique, and a path must be a plain relative one. */
function validateComponents(components: readonly ContextComponent[], files: ReadonlyMap<string, ContextFile>, source: string): void {
  const ids = new Map<string, string>();
  for (const component of components) {
    const where = `${source}: component "${component.id}"`;
    if (
      component.file.startsWith("/") ||
      component.file.includes("\\") ||
      component.file.split("/").some((part) => part === ".." || part === "." || part === "")
    ) {
      throw new ContextLoadError(`${where}: file "${component.file}" must be a normalised relative path.`, source);
    }
    const file = files.get(component.file);
    if (file === undefined) {
      throw new ContextLoadError(`${where}: file "${component.file}" does not exist in agent-library/context/.`, source);
    }
    for (const key of [component.id, ...(component.aliases ?? [])]) {
      const clash = ids.get(key);
      if (clash !== undefined) {
        throw new ContextLoadError(`${source}: id/alias "${key}" is declared by both "${clash}" and "${component.id}".`, source);
      }
      ids.set(key, component.id);
    }
  }
}
