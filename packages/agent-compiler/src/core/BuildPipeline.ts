/**
 * BuildPipeline — the whole of `oac build`, as a pure function of the canonical tree.
 *
 * ─── What it does ───────────────────────────────────────────────────────────────────────
 *
 * Load `agent-library/agents/**`, ask each agent which targets it declares, run the matching
 * adapter, and collect the result as an ordered set of (path, bytes) pairs. Emitting
 * `built-ai-configs/registry/registry.json` is folded in as a target of its own, because it is generated from exactly
 * the same input and must be gated by exactly the same determinism rules.
 *
 * ─── Why planning and writing are separate ──────────────────────────────────────────────
 *
 * {@link plan} computes what the tree SHOULD contain and touches nothing. {@link write} takes
 * a plan and reconciles the disk to it. Splitting them is what makes `--check` and `--dry-run`
 * honest rather than best-effort: they run the identical code path and simply stop before the
 * write. A `--check` that re-implements the build is a `--check` that eventually disagrees
 * with it, and CI trusts the wrong one.
 *
 * ─── Determinism ────────────────────────────────────────────────────────────────────────
 *
 * `oac build && git diff --exit-code` is the gate the refactor rests on (07 Stage 3), so any
 * per-run variation turns it into a coin flip. Everything ordered here is ordered by CONTENT:
 * agents arrive from {@link CanonicalAgentLoader} sorted by `oac.id`, targets are iterated in
 * a declared literal order rather than the authored `targets:` order, and the plan is sorted
 * by path before it is returned. No clock, no host path, no `readdir` order, no map-insertion
 * order reaches the output.
 *
 * ─── Orphan removal, and why it is manifest-gated ───────────────────────────────────────
 *
 * Deleting a source file must delete its generated output, or the subtask-11 CI gate is
 * defeated silently: the stale file just sits there and `git diff` stays clean. So the build
 * prunes. But "prune anything under `.opencode/agent/` without a `content/` source" would
 * delete `.opencode/agent/eval-runner.md`, a real, shipped, hand-authored agent that has
 * deliberately not been canonicalised yet. A build that eats files it did not write is worse
 * than no pruning at all.
 *
 * The rule is therefore inverted: the build removes a file only if IT PREVIOUSLY WROTE THAT
 * FILE. {@link BuildManifest} is the ledger — every write records its path and the sha256 of
 * the bytes written. Pruning considers only paths the previous manifest claims, and never the
 * filesystem. A file the build has never generated is not in the ledger, cannot become a
 * candidate, and is invisible to pruning no matter where it sits. See {@link prunable} for
 * the four conditions, each of which must hold.
 */

import { createHash } from "node:crypto";
import {
  chmodSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  readlinkSync,
  rmSync,
  rmdirSync,
  statSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { CanonicalAgentLoader, type CanonicalAgentFile } from "./AgentLoader.js";
import {
  MANIFEST_FILE,
  readManifest,
  serializeManifest,
  type BuildManifest,
  type ManifestEntry,
} from "./BuildManifest.js";
import {
  assertUniqueRegistryIdentities,
  RegistryEmitter,
  serializeRegistry,
} from "./RegistryEmitter.js";
import { ClaudeAdapter } from "../adapters/ClaudeAdapter.js";
import type { RegistryTarget } from "./RegistryTargets.js";
import { BUILD_TARGETS, emitsTo, type BuildTarget } from "./TargetPolicy.js";
import { AgentIdResolutionError, AgentIdResolver, isGlob } from "./AgentIdResolver.js";
import { rewriteBodyRefs } from "./DelegationRewriter.js";
import { HostBlocksError } from "./HostBlocks.js";
import { OpenCodeAdapter } from "../adapters/OpenCodeAdapter.js";
import { OPENCODE_AGENT_ROOT } from "../adapters/opencode/surgery.js";
import { OpenCodeV1Adapter, OPENCODE_V1_AGENT_ROOT } from "../adapters/v1/OpenCodeV1Adapter.js";
import { HOSTS_README_PATH, HOSTS_README_TARGET, renderHostsReadme } from "./HostsReadme.js";
import { emitAsset } from "./AssetEmitter.js";
import { loadCanonicalAssets, type AssetKind, type CanonicalAssetFile } from "./AssetLoader.js";
import { CONTEXT_OUTPUT_ROOT, loadContextLibrary, type ContextLibrary } from "./ContextLoader.js";

// ============================================================================
// TYPES
// ============================================================================

/**
 * The targets `oac build` wires up today.
 *
 * `opencode` is OpenCode v2 (the default), `opencode-v1` its v1 sibling. `opencode-v1` is a
 * BUILD-level target, not an `oac.targets` value: it is emitted for every agent that declares
 * `opencode` — and, since the 2026-10-23 targets-flip, for every agent that OMITS `targets:`
 * (the opt-out default ships to every target). Removing v1 support means dropping it here
 * (see `adapters/v1/`).
 *
 * Re-exported from {@link TargetPolicy}, which owns the shipping rule; the roster is derived
 * from `BuildTargetSchema`'s enum in `types.ts`, so schema, policy and build share one source.
 */
export { BUILD_TARGETS, type BuildTarget } from "./TargetPolicy.js";

/** One file the build produces. */
export interface BuildFile {
  /** Repo-relative POSIX path the file lands at when emitted in place. */
  path: string;
  /**
   * Set on a live-path MIRROR: the primary path (under `built-ai-configs/`) whose bytes this file copies.
   * A mirror is written, ledgered, pruned and drift-checked like any other file; it is skipped
   * only where a second copy would double-count, such as the lints.
   */
  mirrorOf?: string;
  /** The exact bytes to write: a string (UTF-8) or, for a binary skill file, a Buffer. */
  content: string | Buffer;
  /**
   * The target that produced it; `"registry"` / `"registry-v1"` for the two registry files and
   * `"hosts-readme"` for the generated `built-ai-configs/README.md` index.
   */
  target: BuildTarget | "registry" | "registry-v1" | typeof HOSTS_README_TARGET;
  /** `oac.id` of the source agent, or `undefined` for whole-tree artefacts and for skills/commands. */
  agentId?: string;
  /** Set on a file built from a canonical skill or command: which kind, and its `oac.id`. */
  assetKind?: AssetKind;
  assetId?: string;
  /**
   * Set on a file copied from the context library (`agent-library/context/**`): its path inside
   * the library. Such a file is copied verbatim to `.opencode/context/<contextId>`; it has no mirror.
   */
  contextId?: string;
  /**
   * Set when the file is a symlink, to its target as written (relative). The build creates the
   * link and never writes through it; the ledger and the drift check compare the link target.
   * `content` then holds the same text, for consumers that only look at it.
   */
  symlinkTo?: string;
  /** The file is executable (a skill's `router.sh`); the build sets the mode bit and the drift check compares it. */
  executable?: boolean;
  /** The source agent's `oac.aliases`, when it has any. Recorded in the ledger. */
  agentAliases?: readonly string[];
  /** Semantics the target could not carry. Never fatal on their own. */
  warnings: BuildWarning[];
}

/** A warning, always carrying the file it came from so it is actionable. */
export interface BuildWarning {
  /** Repo-relative path of the SOURCE that caused it, not the emitted file. */
  source: string;
  reason: string;
}

/** Everything a build produced, before anything is written. */
export interface BuildPlan {
  /** Emitted files, sorted by path. */
  files: BuildFile[];
  /** Every warning across every file, in file order. */
  warnings: BuildWarning[];
  /** Canonical agents loaded, sorted by `oac.id`. */
  agents: CanonicalAgentFile[];
  /** Canonical skills and commands loaded, each sorted by `oac.id`. */
  skills: CanonicalAssetFile[];
  commands: CanonicalAssetFile[];
  /** The context library (`agent-library/context/**`): shipped files and registry metadata. */
  context: ContextLibrary;
  /**
   * References that name an agent by a deprecated `oac.aliases` entry (permission.task keys,
   * structured body calls, dependencies, profiles). Each still resolves; the author should switch
   * to the current id. Deduplicated across targets; not part of {@link warnings}.
   */
  deprecations: BuildWarning[];
  /**
   * The targets this plan is AUTHORITATIVE for: the selected build targets plus the registry
   * files built alongside them. {@link write} prunes, and {@link check} reports orphans, only
   * for ledger entries whose target is listed here; every other target's ledger entries are
   * carried forward verbatim. Without this, `--target claude-code` reads every `built-ai-configs/opencode/**`,
   * `.opencode/agent/**`, `built-ai-configs/opencode-v1/**` and `built-ai-configs/registry/registry.v1.json` entry as an orphan and
   * deletes it. A target's mirrors are owned with it.
   */
  owns: ReadonlyArray<BuildFile["target"]>;
}

export interface BuildOptions {
  /** Repository root. Everything resolves against it — no hardcoded paths. */
  root: string;
  /** Restrict the build to these targets. Defaults to {@link BUILD_TARGETS} plus the registry. */
  targets?: readonly BuildTarget[];
  /** Skip `built-ai-configs/registry/registry.json`. Defaults to false. */
  skipRegistry?: boolean;
  /**
   * Accepted and ignored: {@link plan} never writes, so a dry run IS a plan. Present because
   * `dryRun: true` is how callers say what they mean, and because a flag that silently means
   * nothing is safer than one that silently means something else.
   */
  dryRun?: boolean;
}

/** Where a target's files are written, when not in place. */
export type OutputRoots = Partial<Record<BuildFile["target"], string>>;

export interface WriteOptions {
  root: string;
  /**
   * Per-target root override, repo-relative. A target listed here is REBASED under the given
   * directory instead of being written in place, so a build can be compared against the
   * committed tree without touching it. `oac build` itself emits every target in place.
   */
  outputRoots?: OutputRoots;
  /**
   * Remove generated files whose source is gone. Only ever considers paths the previous
   * manifest claims — see {@link prunable}. Defaults to true.
   */
  prune?: boolean;
}

export interface WriteResult {
  /** Paths written whose bytes changed (or that did not exist). */
  changed: string[];
  /** Paths written whose bytes already matched. */
  unchanged: string[];
  /** Paths removed as orphans. */
  removed: string[];
  /** Orphan candidates left alone, with the reason. */
  kept: Array<{ path: string; reason: string }>;
}

// The ledger lives in `./BuildManifest.js` because `RegistryEmitter` needs it too and this
// module already imports `RegistryEmitter`. Re-exported here so it stays part of the build
// pipeline's public surface — `readManifest`/`serializeManifest`/`BuildManifest` have always
// been importable from this module and callers should not have to care that it moved.
export { readManifest, serializeManifest } from "./BuildManifest.js";
export type { BuildManifest, ManifestEntry } from "./BuildManifest.js";

// ============================================================================
// PATHS AND CONSTANTS
// ============================================================================

const DEFAULTS = {
  contentRoot: "agent-library/agents",
} as const;

/**
 * The committed folder holding every host's built output side by side (`built-ai-configs/<host>/`).
 * Not to be confused with `src/hosts/`, the host drivers in this package.
 */
export const HOSTS_ROOT = "built-ai-configs";

/** Where one target's files go. */
export interface AssetLayout {
  /** The primary output root for this kind (the target's folder under {@link HOSTS_ROOT}). */
  root: string;
  /** Live paths that receive byte-identical copies of everything under {@link root}. */
  mirrors: readonly string[];
}

export interface TargetLayout {
  /** The root the adapter's emitted paths are under (what `outputPath` / `emission.path` return). */
  emitted: string;
  /** Where this target's skills and commands go (generated from `agent-library/skills|commands`). */
  assets: Readonly<Record<AssetKind, AssetLayout>>;
  /** The primary output root: the target's folder under {@link HOSTS_ROOT}. */
  root: string;
  /**
   * Live paths that receive byte-identical copies of everything under {@link root}: the
   * repo's own `.opencode/agent/` (dogfood, and the `built-ai-configs/registry/registry.json` paths installers read) and
   * `plugins/claude-code/agents/` (the Claude marketplace source). Generated, never edited.
   */
  mirrors: readonly string[];
  /**
   * Where the context library is copied (verbatim, from `agent-library/context/`). Only the
   * `opencode` target carries it: `.opencode/context/` is the one installed location on every host
   * (OpenCode v1 and v2 share it, the Claude plugin links to it), so there is no per-host copy.
   */
  context: AssetLayout;
}

const NO_ASSETS: TargetLayout["assets"] = { skill: { root: "", mirrors: [] }, command: { root: "", mirrors: [] } };
const NO_CONTEXT: AssetLayout = { root: "", mirrors: [] };

/**
 * The roots each target is permitted to write, and therefore the only roots pruning may ever
 * touch. Defence in depth: the manifest is the gate, but a manifest that has been corrupted,
 * hand-edited or carried over from a different layout must not be able to talk the build into
 * deleting `src/`. A prune candidate outside its target's roots is refused and reported.
 */
export const TARGET_LAYOUT: Readonly<Record<BuildFile["target"], TargetLayout>> = {
  opencode: {
    emitted: OPENCODE_AGENT_ROOT,
    root: `${HOSTS_ROOT}/opencode/agent`,
    mirrors: [OPENCODE_AGENT_ROOT],
    assets: {
      skill: { root: `${HOSTS_ROOT}/opencode/skills`, mirrors: [".opencode/skills"] },
      command: { root: `${HOSTS_ROOT}/opencode/command`, mirrors: [".opencode/command"] },
    },
    context: { root: CONTEXT_OUTPUT_ROOT, mirrors: [] },
  },
  // The v1 build has no live mirror: it is display-only here, and installs read it from its
  // built-ai-configs/ folder (built-ai-configs/registry/registry.v1.json).
  "opencode-v1": {
    emitted: OPENCODE_V1_AGENT_ROOT,
    root: OPENCODE_V1_AGENT_ROOT,
    mirrors: [],
    assets: {
      skill: { root: `${HOSTS_ROOT}/opencode-v1/skills`, mirrors: [] },
      command: { root: `${HOSTS_ROOT}/opencode-v1/command`, mirrors: [] },
    },
    context: NO_CONTEXT,
  },
  "claude-code": {
    emitted: "plugins/claude-code/agents",
    root: `${HOSTS_ROOT}/claude-code/agents`,
    mirrors: ["plugins/claude-code/agents"],
    assets: {
      skill: { root: `${HOSTS_ROOT}/claude-code/skills`, mirrors: ["plugins/claude-code/skills"] },
      command: { root: `${HOSTS_ROOT}/claude-code/commands`, mirrors: ["plugins/claude-code/commands"] },
    },
    context: NO_CONTEXT,
  },
  registry: { emitted: "built-ai-configs/registry/registry.json", root: "built-ai-configs/registry/registry.json", mirrors: [], assets: NO_ASSETS, context: NO_CONTEXT },
  "registry-v1": { emitted: "built-ai-configs/registry/registry.v1.json", root: "built-ai-configs/registry/registry.v1.json", mirrors: [], assets: NO_ASSETS, context: NO_CONTEXT },
  // The generated index of built-ai-configs/ (core/HostsReadme.ts). Only a full build owns it.
  [HOSTS_README_TARGET]: { emitted: HOSTS_README_PATH, root: HOSTS_README_PATH, mirrors: [], assets: NO_ASSETS, context: NO_CONTEXT },
};

/** Every root a target may write: its primary root, then its mirrors. */
function targetRoots(target: BuildFile["target"]): readonly string[] {
  const layout = TARGET_LAYOUT[target];
  const assets = [...Object.values(layout.assets), layout.context].filter((asset) => asset.root !== "");
  return [layout.root, ...layout.mirrors, ...assets.flatMap((asset) => [asset.root, ...asset.mirrors])];
}

/** Re-root `path` from `from` to `to`. `path` must sit under `from`. */
function reroot(path: string, from: string, to: string): string {
  if (from === to) return path;
  if (path === from) return to;
  if (!path.startsWith(`${from}/`)) {
    throw new Error(`emitted path "${path}" is not under its target's emitted root "${from}"`);
  }
  return `${to}${path.slice(from.length)}`;
}

/** The root a file was written under: the mirror root it copies into, or its target's primary root. */
function rootOf(file: BuildFile): string {
  const layout = TARGET_LAYOUT[file.target];
  if (file.contextId !== undefined) return layout.context.root;
  const own = file.assetKind === undefined
    ? { root: layout.root, mirrors: layout.mirrors }
    : layout.assets[file.assetKind];
  if (file.mirrorOf === undefined) return own.root;
  return own.mirrors.find((mirror) => isUnder(file.path, mirror)) ?? own.root;
}

/**
 * Place a file the adapter emitted: relocate it under the target's primary root, and add one
 * byte-identical mirror per live root. Pure.
 */
function place(file: BuildFile): BuildFile[] {
  if (file.assetKind !== undefined) return placeAsset(file);
  const layout = TARGET_LAYOUT[file.target];
  const primary = { ...file, path: reroot(file.path, layout.emitted, layout.root) };
  const mirrors = layout.mirrors.map((mirror) => ({
    ...primary,
    path: reroot(primary.path, layout.root, mirror),
    mirrorOf: primary.path,
    // The primary carries the warnings; a mirror repeating them would double-count.
    warnings: [],
  }));
  return [primary, ...mirrors];
}

/** As {@link place}, for a skill or command file: `path` is already under the kind's primary root. */
function placeAsset(file: BuildFile): BuildFile[] {
  const { root, mirrors } = TARGET_LAYOUT[file.target].assets[file.assetKind!];
  const mirrored = mirrors.map((mirror) => ({
    ...file,
    path: reroot(file.path, root, mirror),
    mirrorOf: file.path,
    warnings: [],
  }));
  return [file, ...mirrored];
}

/** Locale-independent ordering. `localeCompare` is locale-dependent — never use it here. */
function compare(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/** POSIX-separated, so a plan built on Windows and one built on macOS agree. */
function toPosix(path: string): string {
  return path.split(sep).join("/");
}

/** True when `path` is `root` itself or sits underneath it. Segment-aware, not `startsWith`. */
function isUnder(path: string, root: string): boolean {
  return path === root || path.startsWith(`${root}/`);
}

function sha256(content: string | Buffer): string {
  return typeof content === "string"
    ? createHash("sha256").update(content, "utf-8").digest("hex")
    : createHash("sha256").update(content).digest("hex");
}

/** What the ledger records for a file: the hash of its bytes, or of `symlink:<target>` for a link. */
function digestOf(file: BuildFile): string {
  return file.symlinkTo === undefined ? sha256(file.content) : sha256(`symlink:${file.symlinkTo}`);
}

/** The ledger hash of whatever is on disk at `absolute`, symlinks hashed by their target, never followed. */
function diskDigest(absolute: string): string {
  return lstatSync(absolute).isSymbolicLink()
    ? sha256(`symlink:${readlinkSync(absolute)}`)
    : sha256(readFileSync(absolute));
}

/** True when something (a file, a link, even a broken link) is at `absolute`. */
function lexists(absolute: string): boolean {
  try {
    lstatSync(absolute);
    return true;
  } catch {
    return false;
  }
}

/** True when `absolute` is a symlink, whatever it points at. */
function isSymlink(absolute: string): boolean {
  try {
    return lstatSync(absolute).isSymbolicLink();
  } catch {
    return false;
  }
}

/** True when the disk already holds exactly what `file` plans (a link with the same target, or the same bytes). */
function onDiskMatches(absolute: string, file: BuildFile): boolean {
  if (file.symlinkTo !== undefined) return isSymlink(absolute) && readlinkSync(absolute) === file.symlinkTo;
  return !isSymlink(absolute) && existsSync(absolute) && sameBytes(absolute, file.content);
}

/** True when the file on disk holds exactly the planned bytes (no decoding, so binaries compare true). */
function sameBytes(absolute: string, content: string | Buffer): boolean {
  const disk = readFileSync(absolute);
  return disk.equals(typeof content === "string" ? Buffer.from(content, "utf-8") : content);
}

/**
 * True when `absolute` is `root` itself or sits underneath it, after both are resolved.
 *
 * Every path the build writes or deletes is derived from a `--stage` override or a committed
 * ledger, neither of which is trusted to stay inside the repository on its own. `relative()`
 * is the honest test: a result that starts with `..` (or is absolute, on Windows) has escaped.
 */
function contained(root: string, absolute: string): boolean {
  const rel = relative(resolve(root), resolve(absolute));
  return rel === "" || (!rel.startsWith("..") && !isAbsolute(rel));
}

/** Refuse to touch a path outside the build root. Thrown before any write happens. */
function assertContained(root: string, absolute: string, what: string): void {
  if (!contained(root, absolute)) {
    throw new Error(
      `refusing to ${what} "${absolute}": it resolves outside the build root "${resolve(root)}". ` +
        "Check the --stage override and the output roots.",
    );
  }
}

// ============================================================================
// PLANNING
// ============================================================================

/**
 * Emit one agent for one target, or `null` when the agent does not ship there.
 *
 * The shipping rule lives in {@link TargetPolicy.emitsTo} and nowhere else — it answers
 * `targets minus exclude`, plus the `opencode-v1`-follows-`opencode` relation. An agent that
 * does not ship to a target produces no output for it because this function returns `null`,
 * not because some later filter drops it.
 */
async function emitAgent(
  agent: CanonicalAgentFile,
  target: BuildTarget,
  resolver: AgentIdResolver
): Promise<BuildFile | null> {
  if (!emitsTo(agent, target)) return null;

  const source = readFileSync(agent.filePath, "utf-8");
  const sourcePath = `${DEFAULTS.contentRoot}/${agent.relativePath}`;

  if (target === "opencode" || target === "opencode-v1") {
    const adapter = target === "opencode" ? new OpenCodeAdapter() : new OpenCodeV1Adapter();
    const { content, warnings } = await adapter.fromCanonical(source, { filePath: sourcePath, resolver });
    return {
      path: adapter.outputPath(agent.relativePath, agent.oac.id),
      content,
      target,
      agentId: agent.oac.id,
      ...aliasesOf(agent),
      warnings: warnings.map((reason) => ({ source: sourcePath, reason })),
    };
  }

  const adapter = new ClaudeAdapter();

  // The Claude Code adapter refuses (rather than guesses) when an agent's scoped rules have no
  // honest flat equivalent. That error is how a security decision reaches a human, so it must
  // name the file they have to open — the adapter only knows the agent id.
  // A HostBlocksError already reads `path:line: reason` because it is given the file path.
  const emission = await adapter.fromCanonical(source, { filePath: sourcePath }).catch((cause: unknown) => {
    if (cause instanceof HostBlocksError) throw cause;
    throw new Error(`${sourcePath}: ${cause instanceof Error ? cause.message : String(cause)}`, {
      cause,
    });
  });

  assertClaudeDelegatesResolve(agent, emission.content, resolver, sourcePath);

  return {
    path: emission.path,
    content: emission.content,
    target,
    agentId: agent.oac.id,
    ...aliasesOf(agent),
    warnings: emission.warnings.map((reason) => ({ source: sourcePath, reason })),
  };
}

/** `{ agentAliases }` for an agent that declares `oac.aliases`, else nothing (keeps ledgers unchanged). */
function aliasesOf(agent: CanonicalAgentFile): { agentAliases?: readonly string[] } {
  return agent.oac.aliases.length > 0 ? { agentAliases: agent.oac.aliases } : {};
}

/**
 * A Claude Code agent that delegates must delegate to agents that ship to Claude Code. The
 * OpenCode adapters get this for free (their `permission.task` keys and body calls go through
 * the target resolver); Claude's adapter takes no resolver, so the same three delegation
 * signals are checked here against the claude-code roster: `subagent:<id>` dependencies,
 * `permission.task` keys, and structured calls in the emitted body.
 */
function assertClaudeDelegatesResolve(
  agent: CanonicalAgentFile,
  emitted: string,
  resolver: AgentIdResolver,
  sourcePath: string,
): void {
  const refs = [
    ...agent.oac.dependencies.filter((dep) => dep.type === "subagent").map((dep) => dep.id),
    ...taskKeys(agent.frontmatter.permission),
  ].filter((ref) => !isGlob(ref));

  try {
    for (const ref of refs) resolver.idFor("opencode", ref);
    rewriteBodyRefs(emitted, "opencode", resolver);
  } catch (cause) {
    if (!(cause instanceof AgentIdResolutionError)) throw cause;
    throw new Error(
      `${sourcePath}: agent "${agent.oac.id}" on target "claude-code": ${cause.message}`,
      { cause },
    );
  }
}

/**
 * The `permission.task` keys of a canonical permission block, if it has any. By the time an agent
 * is loaded, `permission` is the ORDERED form (`[{ capability, rules: [{ pattern, action }] }]`),
 * so a task key is a rule `pattern` under the `task` capability, not an object key.
 */
function taskKeys(permission: unknown): string[] {
  if (!Array.isArray(permission)) return [];
  const keys: string[] = [];
  for (const entry of permission as unknown[]) {
    if (typeof entry !== "object" || entry === null) continue;
    const { capability, rules } = entry as { capability?: unknown; rules?: unknown };
    if (capability !== "task" || !Array.isArray(rules)) continue;
    for (const rule of rules as unknown[]) {
      const pattern = (rule as { pattern?: unknown } | null)?.pattern;
      if (typeof pattern === "string") keys.push(pattern);
    }
  }
  return keys;
}

/**
 * The resolver for one target: its roster is only the agents that emit there, so a delegation
 * to an agent that does not ship to `target` cannot resolve and fails the build.
 */
function resolverFor(agents: readonly CanonicalAgentFile[], target: BuildTarget): AgentIdResolver {
  return AgentIdResolver.fromCanonical(agents.filter((candidate) => emitsTo(candidate, target)))
    .withNotShipped(AgentIdResolver.fromCanonical(agents), target);
}

/**
 * Two agents landing on one output path would silently overwrite each other. Keyed on the
 * lower-cased path: `Helper.md` and `helper.md` are one file on a case-insensitive filesystem.
 */
function assertUniqueOutputPaths(files: readonly BuildFile[], agents: readonly CanonicalAgentFile[]): void {
  const sourceOf = new Map(agents.map((agent) => [agent.oac.id, `${DEFAULTS.contentRoot}/${agent.relativePath}`]));
  const owners = new Map<string, BuildFile>();
  const label = (file: BuildFile): string =>
    file.assetKind === undefined
      ? `${sourceOf.get(file.agentId!)} (agent "${file.agentId}", target ${file.target})`
      : `${file.assetKind} "${file.assetId}" (target ${file.target})`;
  for (const file of files) {
    if (file.agentId === undefined && file.assetKind === undefined) continue;
    const other = owners.get(file.path.toLowerCase());
    if (other !== undefined) {
      throw new Error(
        `output path collision: "${file.path}" is produced by both ${label(other)} and ${label(file)}. ` +
          "Give one a distinct name.",
      );
    }
    owners.set(file.path.toLowerCase(), file);
  }
}

/**
 * Emit one skill or command for one host: every file it ships there, each placed with its mirrors.
 * An asset that does not ship to `target` (same rule as agents) produces nothing.
 */
function emitAssetFiles(asset: CanonicalAssetFile, target: BuildTarget, resolver: AgentIdResolver): BuildFile[] {
  if (!emitsTo(asset, target)) return [];
  const { root } = TARGET_LAYOUT[target].assets[asset.kind];
  return emitAsset(asset, target, resolver).flatMap((output) =>
    place({
      path: `${root}/${output.relativePath}`,
      content: output.content,
      target,
      assetKind: asset.kind,
      assetId: asset.oac.id,
      ...(output.executable ? { executable: true } : {}),
      warnings: [],
    }),
  );
}

/**
 * The context library as build files: each shipped file copied verbatim to `.opencode/context/`,
 * symlinks as links. Only the `opencode` target carries it (see {@link TargetLayout.context}).
 */
function contextFiles(library: ContextLibrary): BuildFile[] {
  const { root } = TARGET_LAYOUT.opencode.context;
  return library.files.map((file): BuildFile => {
    const path = `${root}/${file.relativePath}`;
    if (file.linkTarget !== undefined) {
      return { path, content: file.linkTarget, symlinkTo: file.linkTarget, target: "opencode", contextId: file.relativePath, warnings: [] };
    }
    const bytes = readFileSync(file.filePath);
    const text = bytes.toString("utf-8");
    return {
      path,
      content: Buffer.from(text, "utf-8").equals(bytes) ? text : bytes,
      target: "opencode",
      contextId: file.relativePath,
      warnings: [],
    };
  });
}

/**
 * Compute the full build. Reads the canonical tree; writes nothing, ever.
 *
 * A failure anywhere — a schema violation, an unrepresentable permission block an adapter
 * refuses to widen — rejects. Fail-closed is the whole point: a capability that cannot be
 * expressed on a target is an error, never a silent grant.
 */
export async function plan(options: BuildOptions): Promise<BuildPlan> {
  const root = resolve(options.root);
  const targets = options.targets ?? BUILD_TARGETS;
  const agents = await new CanonicalAgentLoader(join(root, DEFAULTS.contentRoot))
    .loadFromDirectory();

  const { skills, commands } = loadCanonicalAssets(root);
  const context = loadContextLibrary(root);
  const resolvers = new Map<BuildTarget, AgentIdResolver>();
  const files: BuildFile[] = [];
  const deprecations = new Map<string, BuildWarning>();
  const deprecate = (source: string, reason: string): void => {
    deprecations.set(`${source}\u0000${reason}`, { source, reason });
  };

  // Agents outer, targets inner, both in a content-determined order. Iterating `oac.targets`
  // instead would make output order depend on the order an author happened to list them in.
  for (const agent of agents) {
    for (const target of targets) {
      if (!resolvers.has(target)) resolvers.set(target, resolverFor(agents, target));
      const resolver = resolvers.get(target)!;
      const usedBefore = resolver.aliasUses.length;
      const file = await emitAgent(agent, target, resolver);
      for (const use of resolver.aliasUses.slice(usedBefore)) {
        deprecate(`${DEFAULTS.contentRoot}/${agent.relativePath}`, `deprecated alias "${use.alias}" -> use "${use.id}"`);
      }
      if (file !== null) files.push(...place(file));
    }
  }

  for (const asset of [...skills, ...commands]) {
    for (const target of targets) {
      if (!resolvers.has(target)) resolvers.set(target, resolverFor(agents, target));
      files.push(...emitAssetFiles(asset, target, resolvers.get(target)!));
    }
  }

  assertUniqueOutputPaths(files, agents);
  if (targets.includes("opencode")) files.push(...contextFiles(context));

  if (options.skipRegistry !== true) {
    // One registry per OpenCode major. The v1 registry is only built with the v1 target.
    const registries: Array<{ target: "registry" | "registry-v1"; registryTarget: RegistryTarget; path: string }> = [
      { target: "registry", registryTarget: "opencode", path: "built-ai-configs/registry/registry.json" },
    ];
    if (targets.includes("opencode-v1")) {
      registries.push({ target: "registry-v1", registryTarget: "opencode-v1", path: "built-ai-configs/registry/registry.v1.json" });
    }
    for (const { target, registryTarget, path } of registries) {
      const emitter = new RegistryEmitter(root, { target: registryTarget });
      const registry = await emitter.emit();
      for (const { source, reason } of emitter.deprecations) deprecate(source, reason);
      // Validate the complete emitted document, not only canonical agent entries: contexts and
      // other non-owned categories are carried through and remain installable by `type:id`.
      assertUniqueRegistryIdentities(registry);
      files.push({ path, content: serializeRegistry(registry), target, warnings: [] });
    }
  }

  // built-ai-configs/README.md describes EVERY host, so only a build over every target may write it. A
  // targeted build leaves it alone and carries its ledger entry forward (see ownedTargets).
  if (coversAllHosts(targets)) {
    files.push({
      path: HOSTS_README_PATH,
      content: renderHostsReadme({ files, agents, skills, commands, hosts: BUILD_TARGETS, layout: TARGET_LAYOUT }),
      target: HOSTS_README_TARGET,
      warnings: [],
    });
  }

  files.sort((a, b) => compare(a.path, b.path));

  return {
    files,
    agents,
    skills,
    commands,
    context,
    deprecations: [...deprecations.values()],
    warnings: files.flatMap((file) => file.warnings),
    owns: ownedTargets(targets, options.skipRegistry === true),
  };
}

/** True when `targets` selects every build target — the only build that owns built-ai-configs/README.md. */
function coversAllHosts(targets: readonly BuildTarget[]): boolean {
  return BUILD_TARGETS.every((target) => targets.includes(target));
}

/**
 * Which ledger targets a build over `targets` is authoritative for. Mirrors the registry rule
 * in {@link plan}: `built-ai-configs/registry/registry.json` is built unless skipped, `built-ai-configs/registry/registry.v1.json` only with v1,
 * and `built-ai-configs/README.md` only when every host is built (it is independent of the registries).
 */
function ownedTargets(
  targets: readonly BuildTarget[],
  skipRegistry: boolean
): Array<BuildFile["target"]> {
  const owned: Array<BuildFile["target"]> = [...targets];
  if (!skipRegistry) {
    owned.push("registry");
    if (targets.includes("opencode-v1")) owned.push("registry-v1");
  }
  if (coversAllHosts(targets)) owned.push(HOSTS_README_TARGET);
  return owned;
}

/**
 * True when a ledger entry belongs to a KNOWN target this plan did not build. Such an entry is
 * outside the plan's authority: it is neither pruned nor reported, and is carried forward
 * verbatim. An entry naming an UNKNOWN target is not foreign — it falls through to
 * {@link prunable}, which refuses and reports it.
 */
function foreign(entry: ManifestEntry, plan: BuildPlan): boolean {
  const target = entry.target as BuildFile["target"];
  return target in TARGET_LAYOUT && !plan.owns.includes(target);
}

/**
 * The build as a plain path -> bytes map.
 *
 * The entry point `tests/unit/build/determinism.test.ts` drives: two calls over one tree must
 * produce identical maps.
 */
export async function build(options: BuildOptions): Promise<Map<string, string | Buffer>> {
  const { files } = await plan(options);
  return new Map(files.map((file) => [file.path, file.content]));
}

/**
 * Emit one agent, named by `oac.id`, for one target.
 *
 * Identity is `oac.id` and never a filename: the registry, the profiles and the context docs all
 * reference the id. Resolving by path here would mint an id nothing refers to.
 *
 * @throws when no agent declares `id`, or when that agent does not declare `target`.
 */
export async function buildAgent(id: string, target: BuildTarget): Promise<string> {
  return buildAgentIn(process.cwd(), id, target);
}

/** {@link buildAgent} against an explicit root — the testable form. */
export async function buildAgentIn(
  root: string,
  id: string,
  target: BuildTarget
): Promise<string> {
  const agents = await new CanonicalAgentLoader(join(resolve(root), DEFAULTS.contentRoot))
    .loadFromDirectory();
  const agent = agents.find((candidate) => candidate.oac.id === id);

  if (agent === undefined) {
    throw new Error(
      `No canonical agent declares oac.id "${id}". Known ids: ` +
        `${agents.map((candidate) => candidate.oac.id).join(", ")}`
    );
  }

  const file = await emitAgent(agent, target, resolverFor(agents, target));
  if (file === null) {
    const excluded = (agent.oac.exclude ?? []).length > 0
      ? ` minus exclude [${agent.oac.exclude.join(", ")}]`
      : "";
    throw new Error(
      `Agent "${id}" does not ship to target "${target}" (effective targets: ` +
        `${agent.oac.targets.join(", ")}${excluded}), so it emits nothing there.`
    );
  }

  return file.content.toString("utf-8");
}

// ============================================================================
// MANIFEST
// ============================================================================

/** The manifest a plan implies, given where each target is actually written. */
function manifestFor(files: readonly BuildFile[], outputRoots: OutputRoots): BuildManifest {
  const entries: BuildManifest["files"] = {};
  for (const file of files) {
    entries[rebase(file.path, file.target, outputRoots)] = {
      sha256: digestOf(file),
      target: file.target,
      root: rebase(rootOf(file), file.target, outputRoots),
      ...(file.agentId === undefined ? {} : { agentId: file.agentId }),
      ...(file.agentAliases === undefined ? {} : { aliases: [...file.agentAliases] }),
      ...(file.assetKind === undefined ? {} : { assetKind: file.assetKind, assetId: file.assetId }),
      ...(file.contextId === undefined ? {} : { assetKind: "context" as const, assetId: file.contextId }),
    };
  }
  return { version: 1, files: entries };
}

/** Where a file actually lands, honouring a staging override for its target. */
function rebase(path: string, target: BuildFile["target"], outputRoots: OutputRoots): string {
  const override = outputRoots[target];
  return override === undefined ? path : toPosix(join(override, path));
}

// ============================================================================
// PRUNING
// ============================================================================

/**
 * Decide whether an orphan candidate may be deleted.
 *
 * Called only for paths the PREVIOUS manifest claims — that gate happens in {@link write} and
 * is the load-bearing one. Everything here is a second line of defence, because the cost of a
 * wrong answer is an unrecoverable deletion of someone's work:
 *
 *   1. **The manifest claims it.** (Enforced by the caller.) The build wrote this exact path
 *      on a previous run. `.opencode/agent/eval-runner.md` has no `content/` source, was never
 *      emitted, is not in the ledger, and therefore never reaches this function at all.
 *   2. **The current build does not produce it.** Otherwise it is not an orphan, it is output.
 *   3. **It sits under an output root its own target could legitimately have written.** The
 *      manifest records that root, but the record is VERIFIED rather than trusted: it must be
 *      the target's canonical root, or that root rebased under a staging directory. A ledger
 *      that has been corrupted, hand-edited, or carried over from another layout therefore
 *      cannot talk the build into deleting `src/`.
 *   4. **Its bytes still match what the build wrote.** If a human edited a generated file, the
 *      hash diverges and we refuse: their edit is misplaced, but it is theirs, and reporting it
 *      is strictly better than destroying it.
 *
 * @returns `null` when the file may be removed, or the reason it is being kept.
 */
function prunable(absolute: string, path: string, entry: ManifestEntry): string | null {
  // Nothing on disk means nothing to delete, so there is nothing to refuse either. Checked
  // first so a ledger written for an older layout (e.g. `v1-opencode/`, now `built-ai-configs/opencode-v1/`)
  // drops its vanished entries quietly instead of reporting each one as "kept".
  if (!lexists(absolute)) {
    return "already gone";
  }
  if (!(entry.target in TARGET_LAYOUT)) {
    return `manifest names an unknown target "${entry.target}"`;
  }
  // The recorded root is one of the target's roots (primary or mirror), either in place or
  // under a staging dir. Anything else means the ledger is not describing a tree this build owns.
  const roots = targetRoots(entry.target as BuildFile["target"]);
  if (!roots.some((canonical) => entry.root === canonical || entry.root.endsWith(`/${canonical}`))) {
    return `manifest records root "${entry.root}", which is not a ${entry.target} output root`;
  }
  if (!isUnder(path, entry.root)) {
    return `manifest entry sits outside its recorded output root (${entry.root})`;
  }
  if (diskDigest(absolute) !== entry.sha256) {
    return "modified since it was generated — refusing to delete a file someone has edited";
  }

  return null;
}

/**
 * Remove a file and every directory it leaves empty, stopping at its own output root.
 *
 * The root itself is never removed: an empty `.opencode/agent/` is a legitimate state, and
 * deleting the directory a target is defined by would be a surprise well beyond "prune".
 *
 * `rmdirSync`, never `rmSync`: `rmSync` without `recursive` refuses a directory outright, and
 * WITH `recursive` it would delete a non-empty tree — the emptiness check above it is the only
 * thing standing between "tidy up" and "remove the subtree". `rmdirSync` fails closed on a
 * non-empty directory, so the guard is enforced by the syscall rather than only by us.
 *
 * Directory tidying is best-effort: the file removal has already succeeded, which is the part
 * that matters. A concurrent write that refills the directory must not turn a correct build
 * into a failed one.
 */
function removeAndPruneDirs(root: string, path: string, outputRoot: string): void {
  rmSync(join(root, path));

  const stopAt = join(root, outputRoot);
  let dir = dirname(join(root, path));

  while (dir !== stopAt && isUnder(toPosix(dir), toPosix(stopAt))) {
    try {
      if (readdirSync(dir).length > 0) return;
      rmdirSync(dir);
    } catch {
      return;
    }
    dir = dirname(dir);
  }
}

// ============================================================================
// WRITING
// ============================================================================

/**
 * Reconcile the disk to a plan: write every file, prune the orphans, record the ledger.
 *
 * Writes are content-conditional — a file whose bytes already match is not rewritten, so a
 * no-op build does not churn mtimes and `--check` has something meaningful to report.
 */
export function write(plan: BuildPlan, options: WriteOptions): WriteResult {
  const root = resolve(options.root);
  const outputRoots = options.outputRoots ?? {};
  const result: WriteResult = { changed: [], unchanged: [], removed: [], kept: [] };

  // Validate every destination BEFORE the first write, so a bad staging override fails the
  // build outright instead of leaving a half-written tree behind.
  for (const file of plan.files) {
    assertContained(root, join(root, rebase(file.path, file.target, outputRoots)), "write");
  }
  assertContained(root, join(root, MANIFEST_FILE), "write");

  for (const file of plan.files) {
    const path = rebase(file.path, file.target, outputRoots);
    const absolute = join(root, path);

    if (onDiskMatches(absolute, file)) {
      if (file.symlinkTo === undefined && file.executable === true && !isExecutableOnDisk(absolute)) {
        chmodSync(absolute, 0o755);
        result.changed.push(path);
      } else {
        result.unchanged.push(path);
      }
      continue;
    }

    mkdirSync(dirname(absolute), { recursive: true });
    // Never write through a symlink (it would overwrite its target), and never leave a file
    // where a link is planned: whatever is there is replaced.
    if (lexists(absolute) && (file.symlinkTo !== undefined || isSymlink(absolute))) rmSync(absolute);
    if (file.symlinkTo !== undefined) {
      symlinkSync(file.symlinkTo, absolute);
    } else {
      writeFileSync(absolute, file.content);
      if (file.executable === true) chmodSync(absolute, 0o755);
    }
    result.changed.push(path);
  }

  const next = manifestFor(plan.files, outputRoots);
  const previous = readManifest(root);

  // A targeted build only rewrites its own targets' ledger lines. Everything else the previous
  // build recorded is carried forward untouched, so it stays prunable by a later build that
  // DOES select that target.
  for (const [path, entry] of Object.entries(previous.files)) {
    if (!(path in next.files) && foreign(entry, plan)) next.files[path] = entry;
  }

  if (options.prune !== false) {
    // THE gate: candidates come from the ledger, never from a directory scan. A file this
    // build has not written and no previous build wrote is not enumerable here.
    for (const path of Object.keys(previous.files).sort(compare)) {
      if (path in next.files) continue;

      const entry = previous.files[path]!;
      // A ledger entry that escapes the root is never deleted, whatever else it claims.
      const reason = contained(root, join(root, path))
        ? prunable(join(root, path), path, entry)
        : "manifest entry resolves outside the build root — refusing to delete it";

      if (reason === null) {
        removeAndPruneDirs(root, path, entry.root);
        result.removed.push(path);
      } else if (reason !== "already gone") {
        result.kept.push({ path, reason });
        // Still on disk and still ours: keep the ledger line so check() and the next build see it.
        next.files[path] = entry;
      }
    }
  } else {
    // --no-prune leaves orphans in place; dropping their ledger line would hide them forever.
    for (const [path, entry] of Object.entries(previous.files)) {
      if (!(path in next.files) && lexists(join(root, path))) next.files[path] = entry;
    }
  }

  const manifestPath = join(root, MANIFEST_FILE);
  mkdirSync(dirname(manifestPath), { recursive: true });
  writeFileSync(manifestPath, serializeManifest(next), "utf-8");

  result.changed.sort(compare);
  result.unchanged.sort(compare);

  return result;
}

// ============================================================================
// CHECKING
// ============================================================================

/** One file whose on-disk bytes disagree with the plan. */
export interface Drift {
  path: string;
  status: "missing" | "modified" | "orphan";
}

/**
 * Compare a plan against the disk without touching it — the engine behind `--check`.
 *
 * Orphans are reported from the manifest for the same reason pruning takes them from there:
 * a directory scan would report `eval-runner.md` as drift on every run.
 */
export function check(plan: BuildPlan, options: WriteOptions): Drift[] {
  const root = resolve(options.root);
  const outputRoots = options.outputRoots ?? {};
  const drift: Drift[] = [];
  const next = manifestFor(plan.files, outputRoots);

  for (const file of plan.files) {
    const path = rebase(file.path, file.target, outputRoots);
    const absolute = join(root, path);

    if (!lexists(absolute)) drift.push({ path, status: "missing" });
    else if (!onDiskMatches(absolute, file)) {
      drift.push({ path, status: "modified" });
    } else if (file.symlinkTo === undefined && file.executable === true && !isExecutableOnDisk(absolute)) {
      drift.push({ path, status: "modified" });
    }
  }

  for (const [path, entry] of Object.entries(readManifest(root).files)) {
    // Another target's output is not this plan's to call an orphan (see {@link foreign}).
    if (foreign(entry, plan)) continue;
    if (!(path in next.files) && lexists(join(root, path))) {
      drift.push({ path, status: "orphan" });
    }
  }

  return drift.sort((a, b) => compare(a.path, b.path));
}

function isExecutableOnDisk(absolute: string): boolean {
  return (statSync(absolute).mode & 0o111) !== 0;
}

/** Repo-relative path of a file, POSIX-separated. Exported for the CLI's reporting. */
export function repoRelative(root: string, absolute: string): string {
  return toPosix(relative(resolve(root), absolute));
}
