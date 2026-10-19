/**
 * Generates `registry.json` from the canonical `content/agents/**` tree.
 *
 * ─── Why this exists ────────────────────────────────────────────────────────────────────
 *
 * Adding a component today means editing `registry.json` by hand, or running
 * `scripts/registry/auto-detect-components.sh --auto-add` — 895 lines of bash that does not
 * GENERATE the registry at all. It APPENDS: it diffs the `.opencode/**` tree against the
 * registry's existing `path` values, parses frontmatter with `sed`/`grep`, and `jq`-appends
 * whatever it did not recognise. Nothing ever re-derives an entry that already exists, so an
 * entry that drifts from its own file drifts forever. That is exactly what happened —
 * `registry.json` carries names, descriptions, tags and dependency lists that no file on disk
 * agrees with any more, and `subagent:batch-executor` is missing outright despite shipping in
 * `.opencode/agent/subagents/core/batch-executor.md` and being depended on by both
 * `openagent` and `opencoder`.
 *
 * This emitter inverts that: the canonical file is the input, the registry entry is OUTPUT.
 * Adding an agent becomes "add one file under `content/agents/`, run the build".
 *
 * ─── Phase 2 scope: agents and profiles ─────────────────────────────────────────────────
 *
 * `install.sh` reads `registry.json` and is the only shipping install path, so the blast
 * radius of a mistake here is "nobody can install". The emitter regenerates the
 * `components.agents` and `components.subagents` arrays and profile component lists from the
 * canonical trees that own them. It carries all other component categories, profile metadata,
 * categories, and document metadata through from the committed file. Later subtasks
 * canonicalise the rest.
 *
 * ─── Which profile list is authoritative ────────────────────────────────────────────────
 *
 * Canonical system profiles under `content/profiles/system/` now own install component lists.
 * Their resolution includes context-profile subscriptions and validates every ref against the
 * registry. The legacy registry profile retains ownership of presentation metadata such as
 * `name`, `description`, `badge`, and `additionalPaths`, which canonical profile schemas do
 * not model yet.
 *
 * ─── Dead refs are repaired in the SOURCE, never here ───────────────────────────────────
 *
 * Canonical profile resolution fails closed for dead refs before anything is emitted. Context
 * wildcards remain literal directory subscriptions (`context:core/*`), rather than expanding
 * to today's matching files, so profiles also subscribe to future files in that directory.
 *
 * ─── Withdrawing an entry, and why it is manifest-gated ─────────────────────────────────
 *
 * Deleting a canonical source must delete its registry entry, or this emitter reproduces the
 * exact defect it was built to cure: an entry nothing on disk agrees with, lingering forever.
 * But entries are also CARRIED — `agent:eval-runner` ships in `.opencode/agent/eval-runner.md`
 * and sits in the committed registry with no `content/` counterpart, and dropping it would
 * uninstall the eval harness for everyone.
 *
 * By id alone the two cases are indistinguishable: both are "in the base, absent from the
 * canonical tree". The discriminator is `.oac/build-manifest.json` — the same ledger
 * {@link BuildPipeline} prunes generated FILES with. An entry whose `path` the ledger claims
 * was written BY US, so its absence from the tree means its source was deleted and the entry is
 * withdrawn. An entry whose `path` the ledger does not claim was never ours, so it is carried.
 * `eval-runner.md` has never been in the ledger; every generated agent file always is.
 *
 * The ledger rather than `existsSync`, deliberately: at emit time the orphaned FILE has not
 * been pruned yet ({@link BuildPipeline.write} plans before it reconciles), so an existence
 * check would still see the file and carry the entry — the answer would depend on the order two
 * phases happen to run in. The ledger is ordering-independent, and using the same mechanism as
 * file pruning is what keeps `.opencode/**` and `registry.json` from drifting apart.
 *
 * No ledger prunes nothing, matching {@link BuildPipeline}'s rule: no record of having written
 * a file is not evidence that we wrote it, so a first build carries everything.
 *
 * ─── Determinism ────────────────────────────────────────────────────────────────────────
 *
 * The generated tree stays committed and CI gates drift with `oac build && git diff
 * --exit-code`, so any per-run variation turns that gate into a coin flip (07 Stage 3 /
 * 04 §2.1). Three things guarantee byte-stability here:
 *
 *   - Agent and profile order comes from canonical ids, not from `readdir`; component refs use
 *     the same ASCII ordering.
 *   - Key order is fixed: owned entries by literal declaration order, everything else by the
 *     base document's own order, which makes the emitter a fixed point over its own output.
 *   - `metadata.lastUpdated` is carried from the base, never stamped from the clock. The bash
 *     script did `now | strftime` (auto-detect-components.sh:872), which alone would have made
 *     every rebuild a diff.
 */

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { CanonicalAgentLoader, type CanonicalAgentFile } from "./AgentLoader.js";
import { generatedPaths } from "./BuildManifest.js";
import { ProfileLoader, type SystemProfileResolution } from "./ProfileLoader.js";
import { ReferenceResolver } from "./ReferenceResolver.js";
import { REGISTRY_TARGETS, type RegistryTarget, type RegistryTargetSpec } from "./RegistryTargets.js";
import { emitsTo } from "./TargetPolicy.js";

// ============================================================================
// TYPES
// ============================================================================

/**
 * One entry in a `registry.json` `components.<category>` array.
 *
 * Deliberately open: phase 1 carries non-agent entries through verbatim, and they legitimately
 * carry fields this emitter does not model (`aliases` on 3 contexts, `files` on skills).
 * Narrowing this type would silently drop them — and `install.sh` matches on `.aliases`
 * (install.sh:420), so dropping one uninstalls a component for anyone naming it by alias.
 */
export interface RegistryEntry {
  id: string;
  name?: string;
  type?: string;
  path?: string;
  version?: string;
  description?: string;
  tags?: string[];
  dependencies?: string[];
  category?: string;
  aliases?: string[];
  [key: string]: unknown;
}

/** A parsed `registry.json`. Open for the same reason as {@link RegistryEntry}. */
export interface RegistryDocument {
  components: Record<string, RegistryEntry[]>;
  [key: string]: unknown;
}

interface RegistryProfile {
  components?: string[];
  [key: string]: unknown;
}

export interface RegistryEmitterOptions {
  /**
   * Which registry to emit: `opencode` (v2, `registry.json`, the default) or `opencode-v1`
   * (`registry.v1.json`). Selects the defaults below; each can still be overridden.
   */
  target?: RegistryTarget;
  /** Root of the canonical agent tree, relative to the repo root. */
  contentRoot?: string;
  /**
   * Where an agent's `path` points once built, relative to the repo root. Registry paths name
   * the SHIPPED file under `.opencode/agent/`, not the canonical source — `install.sh` copies
   * `.path` verbatim, so this must stay the install tree.
   */
  agentInstallRoot?: string;
  /** The committed registry to carry non-agent data through from. */
  registryFile?: string;
  /**
   * Repo-relative paths a previous build recorded generating — the discriminator between "this
   * base entry was never ours, carry it" and "we wrote this and its source is gone, withdraw
   * it". See the module header.
   *
   * Defaults to the paths `.oac/build-manifest.json` claims. An empty set carries everything,
   * which is what a repo with no ledger yet gets.
   */
  generatedPaths?: ReadonlySet<string>;
}

const DEFAULTS = {
  contentRoot: "content/agents",
} as const;

const PROFILES_ROOT = "content/profiles";
const SYSTEM_PROFILES_ROOT = `${PROFILES_ROOT}/system`;

/** Retired config entries must not survive carry-through from the base registry. */
const RETIRED_CONFIG_IDS = new Set(["agent-metadata"]);

/** `oac.type` -> the `components` key its entries live under. */
const CATEGORY_FOR_TYPE: Readonly<Record<string, string>> = {
  agent: "agents",
  subagent: "subagents",
};

/** The `components` categories the emitter generates from canonical agents. */
const GENERATED_CATEGORIES: ReadonlySet<string> = new Set(Object.values(CATEGORY_FOR_TYPE));

/** Locale-independent ordering. `localeCompare` is locale-dependent — never use it here. */
function compare(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

// ============================================================================
// SERIALISATION
// ============================================================================

/** Every character outside printable ASCII. Written as escapes so the source stays ASCII. */
const NON_ASCII = /[\u0080-\uFFFF]/g;

/**
 * Escape every non-ASCII character as `\uXXXX`.
 *
 * `JSON.stringify` emits raw UTF-8; the committed `registry.json` escapes instead, in 3 places
 * (an em-dash and two emoji, in carried-through context descriptions). Without this the
 * generated file differs from the committed one on bytes nobody changed, and the subtask-11
 * diff gate reports noise. Safe to apply to the whole document: in valid JSON a non-ASCII
 * character can only occur inside a string literal. Lone surrogates escape to their own halves,
 * which is still valid JSON.
 */
function escapeNonAscii(json: string): string {
  return json.replace(NON_ASCII, (character) => {
    const code = character.charCodeAt(0).toString(16).padStart(4, "0");
    return `\\u${code}`;
  });
}

/**
 * Serialise a registry document the way the committed file is written: 2-space indent,
 * `\uXXXX`-escaped non-ASCII, trailing newline.
 *
 * Verified byte-exact against the committed `registry.json` — parsing it and re-serialising it
 * through this function reproduces it exactly, so every difference the diff gate reports is
 * semantic rather than a formatting artefact.
 */
export function serializeRegistry(document: RegistryDocument): string {
  return `${escapeNonAscii(JSON.stringify(document, null, 2))}\n`;
}

/**
 * Return duplicate component identities across every registry category.
 *
 * Registry lookups use the component's declared `type`, not its array name. Scanning every
 * category catches malformed carry-through data as well as duplicates inside a category.
 */
export function duplicateRegistryIdentities(document: RegistryDocument): string[] {
  const counts = new Map<string, number>();

  for (const entries of Object.values(document.components)) {
    for (const entry of entries) {
      if (typeof entry.type !== "string" || entry.type.length === 0) continue;
      const identity = `${entry.type}:${entry.id}`;
      counts.set(identity, (counts.get(identity) ?? 0) + 1);
    }
  }

  return [...counts]
    .filter(([, count]) => count > 1)
    .map(([identity]) => identity)
    .sort(compare);
}

/** Fail a build before it can publish an ambiguous `type:id` registry reference. */
export function assertUniqueRegistryIdentities(document: RegistryDocument): void {
  const duplicates = duplicateRegistryIdentities(document);
  if (duplicates.length > 0) {
    throw new Error(`Duplicate registry component identities: ${duplicates.join(", ")}`);
  }
}

// ============================================================================
// ENTRY CONSTRUCTION
// ============================================================================

/**
 * Build the registry entry for one canonical agent.
 *
 * Field order is the object literal's order, which is what `JSON.stringify` emits. It matches
 * the shape the two versioned subagents in the committed registry already use
 * (`id,name,type,path,version,description,tags,dependencies,category`).
 *
 * `description` comes from the OpenCode frontmatter rather than the `oac:` block: it is the
 * text the agent itself ships with and the one an installer shows. Everything else comes from
 * `oac:`, the canonical metadata authored alongside the agent.
 */
export function entryForAgent(agent: CanonicalAgentFile, agentInstallRoot: string): RegistryEntry {
  return entryForAgentAt(agent, REGISTRY_TARGETS.opencode.agentPath(agent, agentInstallRoot));
}

/** As {@link entryForAgent}, for an explicit shipped path (the v1 registry nests by category). */
export function entryForAgentAt(agent: CanonicalAgentFile, path: string): RegistryEntry {
  return {
    id: agent.oac.id,
    name: agent.oac.name,
    type: agent.oac.type,
    path,
    version: agent.oac.version,
    description: agent.frontmatter.description,
    tags: agent.oac.tags,
    dependencies: agent.oac.dependencies.map(({ type, id }) => `${type}:${id}`),
    category: agent.oac.category,
  };
}

// ============================================================================
// EMITTER
// ============================================================================

export class RegistryEmitter {
  private readonly root: string;
  private readonly contentRoot: string;
  private readonly agentInstallRoot: string;
  private readonly registryFile: string;
  private readonly target: RegistryTarget;
  private readonly spec: RegistryTargetSpec;
  private readonly injectedGeneratedPaths?: ReadonlySet<string>;

  /**
   * @param root    - Repository root. Everything resolves relative to this, so the emitter is
   *                  testable against a fixture tree rather than a hardcoded path.
   * @param options - Tree locations. Defaults, not hardcodes.
   */
  constructor(root: string, options: RegistryEmitterOptions = {}) {
    this.root = root;
    this.contentRoot = options.contentRoot ?? DEFAULTS.contentRoot;
    this.target = options.target ?? "opencode";
    this.spec = REGISTRY_TARGETS[this.target];
    this.agentInstallRoot = options.agentInstallRoot ?? this.spec.defaultAgentRoot;
    this.registryFile = options.registryFile ?? this.spec.file;
    this.injectedGeneratedPaths = options.generatedPaths;
  }

  /**
   * The paths a previous build claims to have written. Read lazily rather than in the
   * constructor so that constructing an emitter stays free of I/O, exactly like {@link base}.
   */
  private previouslyGenerated(): ReadonlySet<string> {
    return this.injectedGeneratedPaths ?? generatedPaths(this.root);
  }

  /**
   * The committed registry, the source of everything phase 1 does not generate.
   *
   * `resolve` rather than `join` throughout: it leaves an absolute override absolute, so a
   * caller can point `contentRoot` or `registryFile` at a tree outside `root` — which is how
   * the fixed-point test emits a scratch registry against the real content tree.
   */
  base(): RegistryDocument {
    return JSON.parse(
      readFileSync(resolve(this.root, this.registryFile), "utf-8")
    ) as RegistryDocument;
  }

  /**
   * Generate the registry document.
   *
   * Owned component arrays and profile component lists are rebuilt from their canonical trees.
   * Everything else — including the document's own key order — comes from the base, which is
   * what makes this a fixed point over its own output: emitting, writing, and emitting again
   * yields the same bytes.
   */
  async emit(): Promise<RegistryDocument> {
    const base = this.base();
    const agents = await new CanonicalAgentLoader(resolve(this.root, this.contentRoot))
      .loadFromDirectory();

    const generated = this.generatedByCategory(agents);
    const ours = this.previouslyGenerated();
    const components: Record<string, RegistryEntry[]> = {};
    // Canonical agents this target does not ship: never carried over from the base either.
    const notShipped = new Set(agents.filter((agent) => !emitsTo(agent, this.target)).map((agent) => agent.oac.id));

    // Iterate the BASE's keys, not the generated ones: an entry type the canonical tree does
    // not own yet must survive untouched, and its position must not move.
    for (const category of Object.keys(base.components)) {
      if (this.spec.unavailableCategories.includes(category)) {
        components[category] = [];
        continue;
      }
      const existing = (base.components[category] ?? []).filter(
        (entry) => !(GENERATED_CATEGORIES.has(category) && notShipped.has(entry.id)),
      );
      const owned = generated.get(category);
      components[category] = owned === undefined
        ? this.carried(category, existing)
        : merge(owned, existing, ours);
    }

    // A canonical `oac.type` whose category the base has never seen. Not reachable today
    // (`AgentTypeSchema` is `agent | subagent` and both exist), but appending rather than
    // dropping means a new type surfaces in the diff instead of vanishing.
    for (const [category, owned] of generated) {
      components[category] ??= merge(owned, [], ours);
    }

    const document: RegistryDocument = {} as RegistryDocument;
    for (const key of Object.keys(base)) {
      document[key] = key === "components"
        ? components
        : key === "profiles"
          ? await this.profiles(base, agents)
          : base[key];
    }

    return document;
  }

  /** Preserve non-owned entries except explicit retirement decisions. */
  private carried(category: string, entries: readonly RegistryEntry[]): RegistryEntry[] {
    if (category !== "config") return [...entries];
    return entries.filter((entry) => !RETIRED_CONFIG_IDS.has(entry.id));
  }

  /** The generated registry document, serialised exactly as the committed file is written. */
  async emitJson(): Promise<string> {
    return serializeRegistry(await this.emit());
  }

  /** Canonical agents grouped into the `components` arrays they belong in, sorted by id. */
  private generatedByCategory(agents: readonly CanonicalAgentFile[]): Map<string, RegistryEntry[]> {
    const byCategory = new Map<string, RegistryEntry[]>();

    for (const agent of agents) {
      if (!emitsTo(agent, this.target)) continue;
      const category = CATEGORY_FOR_TYPE[agent.oac.type];
      if (category === undefined) continue;

      const entries = byCategory.get(category) ?? [];
      entries.push(entryForAgentAt(agent, this.spec.agentPath(agent, this.agentInstallRoot)));
      byCategory.set(category, entries);
    }

    for (const entries of byCategory.values()) entries.sort((a, b) => compare(a.id, b.id));

    return byCategory;
  }

  /** Generate profile component lists when canonical profile content is available. */
  private async profiles(
    base: RegistryDocument,
    agents: readonly CanonicalAgentFile[]
  ): Promise<unknown> {
    if (!existsSync(resolve(this.root, PROFILES_ROOT))) return base.profiles;

    const baseProfiles = isRecord(base.profiles) ? base.profiles : {};
    const loader = new ProfileLoader(this.root, new ReferenceResolver(this.root, this.registryFile));
    const omit = {
      kinds: this.spec.unavailableProfileKinds,
      agents: new Set(agents.filter((agent) => !emitsTo(agent, this.target)).map((agent) => agent.oac.id)),
    };
    const agentTypes = new Map(agents.map((agent) => [agent.oac.id, agent.oac.type]));
    const ids = readdirSync(resolve(this.root, SYSTEM_PROFILES_ROOT), { withFileTypes: true })
      .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
      .map((entry) => entry.name.slice(0, -".json".length))
      .sort(compare);

    const profiles = await Promise.all(
      ids.map(async (id) => {
        const resolved = await loader.resolveSystemProfile(id, omit);
        const baseProfile = baseProfiles[id];
        return [id, this.profile(baseProfile, resolved, agentTypes, base)] as const;
      })
    );

    return Object.fromEntries(profiles);
  }

  /** Preserve registry-owned profile metadata while replacing the canonical component list. */
  private profile(
    base: unknown,
    resolved: SystemProfileResolution,
    agentTypes: ReadonlyMap<string, string>,
    registry: RegistryDocument
  ): RegistryProfile {
    const metadata = isRecord(base) ? base : {};
    return {
      ...metadata,
      components: this.references(resolved, agentTypes, registry),
    };
  }

  /** Convert a resolved canonical profile closure to install.sh-compatible typed refs. */
  private references(
    resolved: SystemProfileResolution,
    agentTypes: ReadonlyMap<string, string>,
    registry: RegistryDocument
  ): string[] {
    const agentRefs = resolved.agents.map((id) => this.agentReference(id, agentTypes, registry));
    const refs = [
      ...agentRefs,
      ...resolved.contexts.map((id) => `context:${id}`),
      ...resolved.commands.map((id) => `command:${id}`),
      ...resolved.tools.map((id) => `tool:${id}`),
      ...resolved.skills.map((id) => `skill:${id}`),
      ...resolved.plugins.map((id) => `plugin:${id}`),
      ...resolved.config.map((id) => `config:${id}`),
    ];

    return [...new Set(refs)].sort(compare);
  }

  /** Resolve collapsed canonical agents back to their install.sh registry category. */
  private agentReference(
    id: string,
    agentTypes: ReadonlyMap<string, string>,
    registry: RegistryDocument
  ): string {
    const canonicalType = agentTypes.get(id);
    if (canonicalType === "agent" || canonicalType === "subagent") return `${canonicalType}:${id}`;

    const category = ["agents", "subagents"].find((key) =>
      (registry.components[key] ?? []).some((entry) => entry.id === id)
    );
    if (category === "agents") return `agent:${id}`;
    if (category === "subagents") return `subagent:${id}`;

    throw new Error(`Cannot emit profile reference for unknown agent "${id}"`);
  }
}

/**
 * Combine generated entries with the base entries the canonical tree does not claim.
 *
 * The carry-through is not a convenience — it is load-bearing. `agent:eval-runner` ships in
 * `.opencode/agent/eval-runner.md` and sits in the committed registry, but has no
 * `content/agents/` counterpart yet. Generating agents purely from the canonical tree would
 * delete it from the registry and uninstall the eval harness for everyone. Anything not yet
 * canonicalised is preserved verbatim, keeping its own key order and any fields this emitter
 * does not model.
 *
 * An unclaimed entry we PREVIOUSLY GENERATED is the opposite case and must not be carried: its
 * canonical source has been deleted, and carrying it would strand it in the registry forever —
 * see {@link wasGeneratedByUs} and the module header.
 *
 * The result is sorted by id: array order must be a property of the CONTENT, not of the
 * insertion history of a hand-edited file, or the diff gate cannot tell a real change from a
 * reshuffle.
 */
function merge(
  generated: readonly RegistryEntry[],
  base: readonly RegistryEntry[],
  previouslyGenerated: ReadonlySet<string>
): RegistryEntry[] {
  const claimed = new Set(generated.map((entry) => entry.id));
  const carried = base.filter(
    (entry) => !claimed.has(entry.id) && !wasGeneratedByUs(entry, previouslyGenerated)
  );

  return [...generated, ...carried].sort((a, b) => compare(a.id, b.id));
}

/**
 * Whether a base entry names a file the build previously wrote.
 *
 * Matched on `path` because that is the only field tying an entry to a file on disk — and it is
 * the field `install.sh` copies verbatim, so an entry without one installs nothing and cannot
 * be something we emitted. A missing or non-string `path` therefore answers "not ours", which
 * carries the entry: every ambiguity here resolves toward keeping data.
 */
function wasGeneratedByUs(entry: RegistryEntry, previouslyGenerated: ReadonlySet<string>): boolean {
  return typeof entry.path === "string" && previouslyGenerated.has(entry.path);
}

/**
 * Generate `registry.json` for a repository, as the bytes to write.
 *
 * The build's entry point into this module — see `tests/unit/build/determinism.test.ts`.
 *
 * @param root - Repository root.
 */
export async function emitRegistry(root: string): Promise<string> {
  return new RegistryEmitter(root).emitJson();
}
