/**
 * BuildPipeline — the whole of `oac build`, as a pure function of the canonical tree.
 *
 * ─── What it does ───────────────────────────────────────────────────────────────────────
 *
 * Load `content/agents/**`, ask each agent which targets it declares, run the matching
 * adapter, and collect the result as an ordered set of (path, bytes) pairs. Emitting
 * `registry.json` is folded in as a target of its own, because it is generated from exactly
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
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  rmdirSync,
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
import { AgentIdResolver } from "./AgentIdResolver.js";
import { HostBlocksError } from "./HostBlocks.js";
import { OpenCodeAdapter } from "../adapters/OpenCodeAdapter.js";
import { OPENCODE_AGENT_ROOT } from "../adapters/opencode/surgery.js";
import { OpenCodeV1Adapter, OPENCODE_V1_AGENT_ROOT } from "../adapters/v1/OpenCodeV1Adapter.js";
import { HOSTS_README_PATH, HOSTS_README_TARGET, renderHostsReadme } from "./HostsReadme.js";

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
   * Set on a live-path MIRROR: the primary path (under `hosts/`) whose bytes this file copies.
   * A mirror is written, ledgered, pruned and drift-checked like any other file; it is skipped
   * only where a second copy would double-count, such as the lints.
   */
  mirrorOf?: string;
  /** The exact bytes to write. */
  content: string;
  /**
   * The target that produced it; `"registry"` / `"registry-v1"` for the two registry files and
   * `"hosts-readme"` for the generated `hosts/README.md` index.
   */
  target: BuildTarget | "registry" | "registry-v1" | typeof HOSTS_README_TARGET;
  /** `oac.id` of the source agent, or `undefined` for whole-tree artefacts. */
  agentId?: string;
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
  /**
   * The targets this plan is AUTHORITATIVE for: the selected build targets plus the registry
   * files built alongside them. {@link write} prunes, and {@link check} reports orphans, only
   * for ledger entries whose target is listed here; every other target's ledger entries are
   * carried forward verbatim. Without this, `--target claude-code` reads every `hosts/opencode/**`,
   * `.opencode/agent/**`, `hosts/opencode-v1/**` and `registry.v1.json` entry as an orphan and
   * deletes it. A target's mirrors are owned with it.
   */
  owns: ReadonlyArray<BuildFile["target"]>;
}

export interface BuildOptions {
  /** Repository root. Everything resolves against it — no hardcoded paths. */
  root: string;
  /** Restrict the build to these targets. Defaults to {@link BUILD_TARGETS} plus the registry. */
  targets?: readonly BuildTarget[];
  /** Skip `registry.json`. Defaults to false. */
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
  contentRoot: "content/agents",
} as const;

/**
 * The committed folder holding every host's built output side by side (`hosts/<host>/`).
 * Not to be confused with `src/hosts/`, the host drivers in this package.
 */
export const HOSTS_ROOT = "hosts";

/** Where one target's files go. */
export interface TargetLayout {
  /** The root the adapter's emitted paths are under (what `outputPath` / `emission.path` return). */
  emitted: string;
  /** The primary output root: the target's folder under {@link HOSTS_ROOT}. */
  root: string;
  /**
   * Live paths that receive byte-identical copies of everything under {@link root}: the
   * repo's own `.opencode/agent/` (dogfood, and the `registry.json` paths installers read) and
   * `plugins/claude-code/agents/` (the Claude marketplace source). Generated, never edited.
   */
  mirrors: readonly string[];
}

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
  },
  // The v1 build has no live mirror: it is display-only here, and installs read it from its
  // hosts/ folder (registry.v1.json).
  "opencode-v1": { emitted: OPENCODE_V1_AGENT_ROOT, root: OPENCODE_V1_AGENT_ROOT, mirrors: [] },
  "claude-code": {
    emitted: "plugins/claude-code/agents",
    root: `${HOSTS_ROOT}/claude-code/agents`,
    mirrors: ["plugins/claude-code/agents"],
  },
  registry: { emitted: "registry.json", root: "registry.json", mirrors: [] },
  "registry-v1": { emitted: "registry.v1.json", root: "registry.v1.json", mirrors: [] },
  // The generated index of hosts/ (core/HostsReadme.ts). Only a full build owns it.
  [HOSTS_README_TARGET]: { emitted: HOSTS_README_PATH, root: HOSTS_README_PATH, mirrors: [] },
};

/** Every root a target may write: its primary root, then its mirrors. */
function targetRoots(target: BuildFile["target"]): readonly string[] {
  const layout = TARGET_LAYOUT[target];
  return [layout.root, ...layout.mirrors];
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
  if (file.mirrorOf === undefined) return layout.root;
  return layout.mirrors.find((mirror) => isUnder(file.path, mirror)) ?? layout.root;
}

/**
 * Place a file the adapter emitted: relocate it under the target's primary root, and add one
 * byte-identical mirror per live root. Pure.
 */
function place(file: BuildFile): BuildFile[] {
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

function sha256(content: string): string {
  return createHash("sha256").update(content, "utf-8").digest("hex");
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

  return {
    path: emission.path,
    content: emission.content,
    target,
    agentId: agent.oac.id,
    warnings: emission.warnings.map((reason) => ({ source: sourcePath, reason })),
  };
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

  const resolver = AgentIdResolver.fromCanonical(agents);
  const files: BuildFile[] = [];

  // Agents outer, targets inner, both in a content-determined order. Iterating `oac.targets`
  // instead would make output order depend on the order an author happened to list them in.
  for (const agent of agents) {
    for (const target of targets) {
      const file = await emitAgent(agent, target, resolver);
      if (file !== null) files.push(...place(file));
    }
  }

  if (options.skipRegistry !== true) {
    // One registry per OpenCode major. The v1 registry is only built with the v1 target.
    const registries: Array<{ target: "registry" | "registry-v1"; registryTarget: RegistryTarget; path: string }> = [
      { target: "registry", registryTarget: "opencode", path: "registry.json" },
    ];
    if (targets.includes("opencode-v1")) {
      registries.push({ target: "registry-v1", registryTarget: "opencode-v1", path: "registry.v1.json" });
    }
    for (const { target, registryTarget, path } of registries) {
      const registry = await new RegistryEmitter(root, { target: registryTarget }).emit();
      // Validate the complete emitted document, not only canonical agent entries: contexts and
      // other non-owned categories are carried through and remain installable by `type:id`.
      assertUniqueRegistryIdentities(registry);
      files.push({ path, content: serializeRegistry(registry), target, warnings: [] });
    }
  }

  // hosts/README.md describes EVERY host, so only a build over every target may write it. A
  // targeted build leaves it alone and carries its ledger entry forward (see ownedTargets).
  if (coversAllHosts(targets)) {
    files.push({
      path: HOSTS_README_PATH,
      content: renderHostsReadme({ files, agents, hosts: BUILD_TARGETS, layout: TARGET_LAYOUT }),
      target: HOSTS_README_TARGET,
      warnings: [],
    });
  }

  files.sort((a, b) => compare(a.path, b.path));

  return {
    files,
    agents,
    warnings: files.flatMap((file) => file.warnings),
    owns: ownedTargets(targets, options.skipRegistry === true),
  };
}

/** True when `targets` selects every build target — the only build that owns hosts/README.md. */
function coversAllHosts(targets: readonly BuildTarget[]): boolean {
  return BUILD_TARGETS.every((target) => targets.includes(target));
}

/**
 * Which ledger targets a build over `targets` is authoritative for. Mirrors the registry rule
 * in {@link plan}: `registry.json` is built unless skipped, `registry.v1.json` only with v1,
 * and `hosts/README.md` only when every host is built (it is independent of the registries).
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
export async function build(options: BuildOptions): Promise<Map<string, string>> {
  const { files } = await plan(options);
  return new Map(files.map((file) => [file.path, file.content]));
}

/**
 * Emit one agent, named by `oac.id`, for one target.
 *
 * Identity is `oac.id` and never a filename: `content/agents/subagents/code/test-engineer.md`
 * declares `id: tester`, and `tester` is what `registry.json`, the profiles and the context
 * docs all reference. Resolving by path here would mint an id nothing refers to.
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

  const file = await emitAgent(agent, target, AgentIdResolver.fromCanonical(agents));
  if (file === null) {
    const excluded = (agent.oac.exclude ?? []).length > 0
      ? ` minus exclude [${agent.oac.exclude.join(", ")}]`
      : "";
    throw new Error(
      `Agent "${id}" does not ship to target "${target}" (effective targets: ` +
        `${agent.oac.targets.join(", ")}${excluded}), so it emits nothing there.`
    );
  }

  return file.content;
}

// ============================================================================
// MANIFEST
// ============================================================================

/** The manifest a plan implies, given where each target is actually written. */
function manifestFor(files: readonly BuildFile[], outputRoots: OutputRoots): BuildManifest {
  const entries: BuildManifest["files"] = {};
  for (const file of files) {
    entries[rebase(file.path, file.target, outputRoots)] = {
      sha256: sha256(file.content),
      target: file.target,
      root: rebase(rootOf(file), file.target, outputRoots),
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
  // first so a ledger written for an older layout (e.g. `v1-opencode/`, now `hosts/opencode-v1/`)
  // drops its vanished entries quietly instead of reporting each one as "kept".
  if (!existsSync(absolute)) {
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
  if (sha256(readFileSync(absolute, "utf-8")) !== entry.sha256) {
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
    const exists = existsSync(absolute);

    if (exists && readFileSync(absolute, "utf-8") === file.content) {
      result.unchanged.push(path);
      continue;
    }

    mkdirSync(dirname(absolute), { recursive: true });
    writeFileSync(absolute, file.content, "utf-8");
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
      }
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

    if (!existsSync(absolute)) drift.push({ path, status: "missing" });
    else if (readFileSync(absolute, "utf-8") !== file.content) {
      drift.push({ path, status: "modified" });
    }
  }

  for (const [path, entry] of Object.entries(readManifest(root).files)) {
    // Another target's output is not this plan's to call an orphan (see {@link foreign}).
    if (foreign(entry, plan)) continue;
    if (!(path in next.files) && existsSync(join(root, path))) {
      drift.push({ path, status: "orphan" });
    }
  }

  return drift.sort((a, b) => compare(a.path, b.path));
}

/** Repo-relative path of a file, POSIX-separated. Exported for the CLI's reporting. */
export function repoRelative(root: string, absolute: string): string {
  return toPosix(relative(resolve(root), absolute));
}
