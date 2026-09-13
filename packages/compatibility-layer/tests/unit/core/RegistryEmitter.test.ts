/**
 * Registry emission — `registry.json` is GENERATED from `content/agents/**`, not hand-edited.
 *
 * ─── What is actually at stake ──────────────────────────────────────────────────────────
 *
 * `install.sh` reads `registry.json` and is the only shipping install path. Every assertion
 * here is really a statement about whether a real user can install this repo, which is why
 * this suite leans on the LIVE corpus rather than fixtures alone: a fixture tree cannot tell
 * us that the thing we ship is intact.
 *
 * Three properties matter, in this order:
 *
 *   1. Nothing that install.sh reads is lost (carry-through, aliases, eval-runner).
 *   2. The output is byte-stable and a fixed point over itself, or the subtask-11
 *      `oac build && git diff --exit-code` gate is a coin flip.
 *   3. The generated entries actually come from the canonical files.
 *
 * ─── Two snapshots of known defects live here ───────────────────────────────────────────
 *
 * {@link MISSING_FROM_REGISTRY} and {@link REGISTRY_ONLY_DEPENDENCIES} pin bugs, not
 * invariants — same pattern as `KNOWN_DEAD` in `reference-resolution.test.ts`. When a subtask
 * repairs one, the test turns red and forces a deliberate edit here. That is the point: the
 * drift these record is exactly the kind that accumulated silently for months because the only
 * validator in the repo could not see it.
 */

import { describe, it, expect } from "vitest";
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  RegistryEmitter,
  duplicateRegistryIdentities,
  emitRegistry,
  serializeRegistry,
  entryForAgent,
  type RegistryDocument,
  type RegistryEntry,
} from "../../../src/core/RegistryEmitter.js";
import { generatedPaths } from "../../../src/core/BuildManifest.js";
import { CanonicalAgentLoader } from "../../../src/core/AgentLoader.js";
import { repoPath } from "../../support/pending.js";

const COMMITTED_JSON = readFileSync(repoPath("registry.json"), "utf-8");
const COMMITTED = JSON.parse(COMMITTED_JSON) as RegistryDocument;

/** Categories phase 1 generates. Everything else is carried through verbatim. */
const GENERATED_CATEGORIES = ["agents", "subagents"] as const;

/** Anything that would make two runs differ. */
const NONDETERMINISM = [
  { name: "an ISO timestamp", pattern: /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/ },
  { name: "a 'generated at' stamp", pattern: /generated (at|on)[:\s]/i },
  { name: "an absolute home path", pattern: /\/(Users|home)\/[^/\s"]+/ },
];

/**
 * Agents that ship on disk, are referenced, and were ABSENT from the registry until subtask 10
 * generated it.
 *
 * Verified on disk 2026-07-15. `batch-executor` is the load-bearing one: both `openagent` and
 * `opencoder` declare `subagent:batch-executor`, so the registry advertised a dependency on a
 * component it did not contain. The other six were in neither the registry nor
  * the canonical corpus — they were added to `.opencode/agent/` and nothing ever noticed.
  * `auto-detect-components.sh --dry-run` reported all 7 as "New Components".
 *
 * ─── Updated by subtask 10, deliberately ────────────────────────────────────────────────
 *
 * This list used to assert the committed registry OMITS these 7 — it pinned the bug. Subtask
 * 10 ran `oac build`, which emits `registry.json` in place, so all 7 are now registered and
 * that assertion inverted. Per this file's own contract ("when a subtask repairs one, the test
 * turns red and forces a deliberate edit here"), the edit is made rather than the test
 * relaxed: the list now guards that generation KEEPS registering them. It stops being a
 * snapshot of a loss and becomes a regression guard, exactly as
 * {@link REGISTRY_ONLY_DEPENDENCIES} did when subtask 09b backfilled the 13 edges.
 */
const RECOVERED_BY_GENERATION = [
  "adr-manager",
  "architecture-analyzer",
  "batch-executor",
  "contract-manager",
  "prioritization-engine",
  "stage-orchestrator",
  "story-mapper",
] as const;

/**
 * Dependency edges that were once authored ONLY in `registry.json` — no agent file and no
 * sidecar entry declared them, so generating from the canonical tree used to DROP them.
 *
 * That was a real regression, not a cleanup: `install.sh` resolves these transitively
 * (`resolve_dependencies`, install.sh:420), so installing `subagent:externalscout` pulls in
 * `skill:context7` and would have stopped doing so. They were hand-authored straight into
 * `registry.json` and never made it into any file, which is precisely the drift this refactor
 * exists to end.
 *
 * Subtask 09b backfilled all 13 into `oac.dependencies` in `content/agents/**`, in the exact
 * order `registry.json` declares them, so the emitter now reproduces every one. This list is
 * therefore no longer a snapshot of a loss — it is the guard that the backfill stays put. Each
 * edge was verified to resolve against the registry before being carried over; the sibling dead
 * ref `context:context-system/*` (profiles-only, expands to 0) was deliberately NOT introduced
 * here — see `tests/unit/build/reference-resolution.test.ts`.
 */
const REGISTRY_ONLY_DEPENDENCIES: Readonly<Record<string, readonly string[]>> = {
  contextscout: [
    "command:check-context-deps",
    "context:registry-dependencies",
    "context:context-system",
    "context:mvi",
    "context:structure",
    "context:workflows",
    "subagent:externalscout",
    "context:root-navigation",
    "context:context-paths-config",
  ],
  externalscout: ["skill:context7", "context:context-system"],
  "image-specialist": ["tool:gemini"],
  "context-organizer": ["context:core/context-system/*"],
};

function entries(document: RegistryDocument, category: string): RegistryEntry[] {
  return document.components[category] ?? [];
}

function byId(document: RegistryDocument, category: string): Map<string, RegistryEntry> {
  return new Map(entries(document, category).map((entry) => [entry.id, entry]));
}

/** A throwaway repo root containing only a `registry.json`, for fixed-point testing. */
function scratchRoot(registryJson: string): string {
  const root = mkdtempSync(join(tmpdir(), "oac-registry-"));
  writeFileSync(join(root, "registry.json"), registryJson);
  return root;
}

// ============================================================================
// SERIALISATION — the diff must be semantic, never formatting
// ============================================================================

describe("serializeRegistry", () => {
  it("reproduces the committed registry.json byte-for-byte from its own parse", () => {
    // If this drifts, every generated-vs-committed diff drowns in whitespace and escaping
    // noise and the subtask-11 gate stops meaning anything. It also pins the non-ASCII
    // escaping: the committed file writes `—` and two emoji as escapes, which bare
    // `JSON.stringify` would emit as raw UTF-8.
    expect(serializeRegistry(COMMITTED)).toBe(COMMITTED_JSON);
  });

  it("escapes non-ASCII rather than emitting raw UTF-8", () => {
    const json = serializeRegistry({ components: {}, note: "em—dash ⛔" } as RegistryDocument);

    expect(json).toContain("em\\u2014dash \\u26d4");
    expect(json).not.toContain("—");
  });

  it("ends with exactly one trailing newline", () => {
    expect(serializeRegistry(COMMITTED).endsWith("}\n")).toBe(true);
    expect(serializeRegistry(COMMITTED).endsWith("}\n\n")).toBe(false);
  });
});

// ============================================================================
// DETERMINISM
// ============================================================================

describe("determinism", () => {
  it("emits canonical agent entries without an agent-metadata sidecar", async () => {
    // The scratch root has only registry.json: canonical agent metadata is loaded from content.
    const root = scratchRoot(COMMITTED_JSON);

    try {
      const document = await new RegistryEmitter(root, {
        contentRoot: repoPath("content/agents"),
      }).emit();

      expect(byId(document, "agents").get("openagent")).toMatchObject({
        id: "openagent",
        name: "OpenAgent",
        type: "agent",
      });
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("emits byte-identical output across two runs", async () => {
    expect(await emitRegistry(repoPath())).toBe(await emitRegistry(repoPath()));
  });

  it("emits nothing that varies between runs", async () => {
    const json = await emitRegistry(repoPath());

    for (const { name, pattern } of NONDETERMINISM) {
      expect(json, `generated registry.json contains ${name}`).not.toMatch(pattern);
    }
  });

  it("carries metadata.lastUpdated from the base instead of stamping the clock", async () => {
    // auto-detect-components.sh:872 did `now | strftime("%Y-%m-%d")`, which alone would make
    // every rebuild a diff and every `git diff --exit-code` gate fail on an unchanged tree.
    const document = await new RegistryEmitter(repoPath()).emit();

    expect(document.metadata).toEqual(COMMITTED.metadata);
  });

  it("sorts generated entries by id, not by filesystem or insertion order", async () => {
    const document = await new RegistryEmitter(repoPath()).emit();

    for (const category of GENERATED_CATEGORIES) {
      const ids = entries(document, category).map((entry) => entry.id);
      expect(ids, `${category} is not id-sorted`).toEqual([...ids].sort());
    }
  });

  it("is a fixed point over its own output", async () => {
    // Subtask 10 writes this output back to registry.json, and the emitter then reads that as
    // its own base. If emitting were not idempotent the tree would oscillate and the diff gate
    // would fail forever on a tree nobody touched.
    const first = await emitRegistry(repoPath());
    const root = scratchRoot(first);

    try {
      const second = await new RegistryEmitter(root, {
        contentRoot: repoPath("content/agents"),
      }).emitJson();

      expect(second).toBe(first);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

// ============================================================================
// CARRY-THROUGH — canonical trees own agents and profile components
// ============================================================================

describe("carry-through of everything the canonical tree does not own", () => {
  it("leaves non-agent component categories byte-identical except retired config", async () => {
    const document = await new RegistryEmitter(repoPath()).emit();
    const carried = Object.keys(COMMITTED.components).filter(
      (category) =>
        category !== "config" &&
        !GENERATED_CATEGORIES.includes(category as (typeof GENERATED_CATEGORIES)[number])
    );

    expect(carried).toContain("contexts");
    for (const category of carried) {
      expect(entries(document, category), `${category} was modified`).toEqual(
        entries(COMMITTED, category)
      );
    }
  });

  it("does not carry the retired agent-metadata config entry", async () => {
    const document = await new RegistryEmitter(repoPath()).emit();

    expect(byId(document, "config").has("agent-metadata")).toBe(false);
    expect(entries(document, "config")).toEqual(
      entries(COMMITTED, "config").filter((entry) => entry.id !== "agent-metadata")
    );
  });

  it("leaves every non-components, non-profiles top-level key untouched, in order", async () => {
    const document = await new RegistryEmitter(repoPath()).emit();

    expect(Object.keys(document)).toEqual(Object.keys(COMMITTED));
    for (const key of Object.keys(COMMITTED).filter((k) => k !== "components" && k !== "profiles")) {
      expect(document[key], `top-level "${key}" was modified`).toEqual(COMMITTED[key]);
    }
  });

  it("preserves the component category order", async () => {
    const document = await new RegistryEmitter(repoPath()).emit();

    expect(Object.keys(document.components)).toEqual(Object.keys(COMMITTED.components));
  });

  it("preserves context aliases", async () => {
    // install.sh resolve_dependencies matches `.id == $id or (.aliases | index($id))`
    // (install.sh:420). Dropping an alias silently uninstalls a component for anyone naming
    // it the aliased way.
    const document = await new RegistryEmitter(repoPath()).emit();
    const aliased = entries(document, "contexts").filter((entry) => entry.aliases !== undefined);

    expect(aliased.map((entry) => entry.id).sort()).toEqual([
      "component-planning",
      "feature-breakdown",
      "session-management",
    ]);
  });

  it("preserves registry-owned profile metadata while regenerating components", async () => {
    const document = await new RegistryEmitter(repoPath()).emit();
    const profiles = document.profiles as Record<string, RegistryEntry>;
    const committedProfiles = COMMITTED.profiles as Record<string, RegistryEntry>;

    for (const id of Object.keys(committedProfiles)) {
      const { components: expectedComponents, ...expectedMetadata } = committedProfiles[id];
      const { components: actualComponents, ...actualMetadata } = profiles[id];
      expect(actualMetadata, `${id} metadata changed`).toEqual(expectedMetadata);
      expect(actualComponents).toBeDefined();
    }
  });

  it("does not emit retired config references for canonical profiles", async () => {
    const document = await new RegistryEmitter(repoPath()).emit();
    const profiles = document.profiles as Record<string, { components: string[] }>;

    for (const id of ["essential", "developer", "business", "advanced", "full"]) {
      expect(profiles[id]?.components).not.toContain("config:agent-metadata");
    }
  });

  it("leaves the advanced-profile wildcard exactly as authored", async () => {
    // Wildcards are directory subscriptions, so canonical profile emission preserves them
    // literally rather than expanding today's matching contexts.
    const document = await new RegistryEmitter(repoPath()).emit();
    const advanced = document.profiles as Record<string, { components: string[] }>;

    expect(advanced.advanced?.components).toContain("context:core/context-system/*");
    expect(advanced.advanced?.components).not.toContain("context:context-system/*");
  });

  it("carries eval-runner even though it is deliberately absent from canonical content", async () => {
    // `agent:eval-runner` ships in `.opencode/agent/eval-runner.md` and is in the committed
    // registry, but retirement deliberately keeps it out of `content/agents/`. Generating
    // agents purely from the canonical tree would delete it and uninstall the eval harness.

    // Arrange
    const document = await new RegistryEmitter(repoPath()).emit();
    const canonical = await new CanonicalAgentLoader(repoPath("content/agents")).loadFromDirectory();

    // Act
    const canonicalIds = new Set(canonical.map((agent) => agent.oac.id));
    const emitted = byId(document, "agents").get("eval-runner");

    // Assert
    expect(canonicalIds.has("eval-runner")).toBe(false);

    expect(emitted).toEqual(byId(COMMITTED, "agents").get("eval-runner"));
  });

  it("never drops a non-retired id the committed registry publishes", async () => {
    const document = await new RegistryEmitter(repoPath()).emit();

    for (const category of Object.keys(COMMITTED.components)) {
      const generated = byId(document, category);
      const dropped = entries(COMMITTED, category)
        .filter((entry) => category !== "config" || entry.id !== "agent-metadata")
        .map((entry) => entry.id)
        .filter((id) => !generated.has(id));

      expect(dropped, `${category} ids dropped by the emitter`).toEqual([]);
    }
  });
});

// ============================================================================
// WITHDRAWAL — an entry we generated must not outlive its canonical source
// ============================================================================

/**
 * The other half of carry-through, and the harder half.
 *
 * Carrying every unclaimed base entry is what keeps `eval-runner` alive, but applied blindly it
 * recreates the defect this emitter exists to cure: delete `content/agents/x.md` and the build
 * removes `.opencode/agent/x.md` while leaving `x` in the registry forever. The output is a
 * stable fixed point, so `oac build && git diff --exit-code` stays green while being wrong —
 * the drift gate cannot see it.
 *
 * By id alone "never had a source" and "source was deleted" are identical. The discriminator is
 * `.oac/build-manifest.json`: an entry whose `path` the ledger claims was written by us.
 */
describe("withdrawal of entries the build itself generated", () => {
  /** A path the ledger claims — i.e. one the build wrote on a previous run. */
  const GENERATED_PATH = ".opencode/agent/subagents/utils/demo-agent.md";

  /** `eval-runner`'s file: shipped, hand-authored, and never generated by us. */
  const EVAL_RUNNER_PATH = ".opencode/agent/eval-runner.md";

  /**
   * The committed registry plus an entry for an agent the build generated and whose canonical
   * source has since been deleted — the exact state a deletion build reads as its base.
   */
  function baseWithDeletedSource(): RegistryDocument {
    const document = JSON.parse(COMMITTED_JSON) as RegistryDocument;
    document.components.subagents = [
      ...entries(document, "subagents"),
      {
        id: "demo-agent",
        name: "Demo Agent",
        type: "subagent",
        path: GENERATED_PATH,
        version: "1.0.0",
        description: "Generated by a previous build; its canonical source is now gone.",
        tags: ["demo"],
        dependencies: [],
        category: "subagents/utils",
      },
    ];
    return document;
  }

  /** Emit against a scratch base and an explicit ledger, over the live canonical tree. */
  async function emitWith(
    base: RegistryDocument,
    ledger: ReadonlySet<string>
  ): Promise<RegistryDocument> {
    const root = scratchRoot(serializeRegistry(base));

    try {
      return await new RegistryEmitter(root, {
        contentRoot: repoPath("content/agents"),
        generatedPaths: ledger,
      }).emit();
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  }

  it("drops an entry whose path the ledger claims once its canonical source is gone", async () => {
    // The bug: `merge` carried this forever because `demo-agent` is simply "not in generated",
    // which is also true of eval-runner. The ledger is what tells them apart.
    const document = await emitWith(baseWithDeletedSource(), new Set([GENERATED_PATH]));

    expect(byId(document, "subagents").has("demo-agent")).toBe(false);
  });

  it("keeps eval-runner while withdrawing a generated entry in the same merge", async () => {
    // The regression that matters most: a fix that drops the deleted agent by also dropping
    // every sourceless entry uninstalls the eval harness. Both must hold at once.
    const document = await emitWith(baseWithDeletedSource(), new Set([GENERATED_PATH]));

    expect(byId(document, "subagents").has("demo-agent")).toBe(false);
    expect(byId(document, "agents").get("eval-runner")).toEqual(
      byId(COMMITTED, "agents").get("eval-runner")
    );
  });

  it("carries every entry when there is no ledger, so a first build deletes nothing", async () => {
    // Matches BuildPipeline's rule: no record of having written a file is not evidence that we
    // wrote it. A fresh clone has no manifest and must not withdraw anything.
    const document = await emitWith(baseWithDeletedSource(), new Set());

    expect(byId(document, "subagents").get("demo-agent")?.path).toBe(GENERATED_PATH);
    expect(byId(document, "agents").has("eval-runner")).toBe(true);
  });

  it("carries an entry the ledger does not claim, however the ledger is populated", async () => {
    // eval-runner survives against the REAL ledger, not just a hand-made one.
    const document = await emitWith(baseWithDeletedSource(), generatedPaths(repoPath()));

    expect(byId(document, "agents").get("eval-runner")).toEqual(
      byId(COMMITTED, "agents").get("eval-runner")
    );
  });

  it("has a ledger that claims every generated agent file and not eval-runner", async () => {
    // The discriminator is only real if the live ledger actually separates the two populations.
    // If a later subtask canonicalises eval-runner this turns red and forces a deliberate edit:
    // the entry would then be generated by id and no longer need carrying at all.
    const ledger = generatedPaths(repoPath());
    const claimed = (id: string): boolean =>
      ledger.has(byId(COMMITTED, "agents").get(id)?.path ?? "");

    expect(ledger.has(EVAL_RUNNER_PATH), "eval-runner is in the ledger").toBe(false);
    expect(claimed("openagent"), "a generated agent is missing from the ledger").toBe(true);

    for (const category of GENERATED_CATEGORIES) {
      const unclaimed = entries(COMMITTED, category)
        .filter((entry) => !ledger.has(entry.path ?? ""))
        .map((entry) => entry.id);

      expect(unclaimed, `${category} entries the ledger does not claim`).toEqual(
        category === "agents" ? ["eval-runner"] : []
      );
    }
  });
});

// ============================================================================
// GENERATION — entries come from the canonical files
// ============================================================================

describe("generation from the canonical tree", () => {
  it("derives each canonical entry's identity, tags, category, version, and dependencies from content", async () => {
    // Arrange
    const document = await new RegistryEmitter(repoPath()).emit();
    const agents = await new CanonicalAgentLoader(repoPath("content/agents")).loadFromDirectory();
    const emitted = new Map(
      [...entries(document, "agents"), ...entries(document, "subagents")].map((entry) => [
        entry.id,
        entry,
      ])
    );

    // Act
    const mismatches = agents
      .map((agent) => ({ id: agent.oac.id, expected: entryForAgent(agent, ".opencode/agent") }))
      .filter(({ id, expected }) => JSON.stringify(emitted.get(id)) !== JSON.stringify(expected));

    // Assert
    expect(mismatches, "canonical registry entries must be wholly derived from their content file").toEqual(
      []
    );
  });

  it("emits entry keys in the committed field order", async () => {
    const document = await new RegistryEmitter(repoPath()).emit();

    for (const category of GENERATED_CATEGORIES) {
      for (const entry of entries(document, category)) {
        if (entry.id === "eval-runner") continue; // carried through, keeps its own shape

        expect(Object.keys(entry), `${entry.id} field order`).toEqual([
          "id",
          "name",
          "type",
          "path",
          "version",
          "description",
          "tags",
          "dependencies",
          "category",
        ]);
      }
    }
  });

  it("points path at the built install tree, not the canonical source", async () => {
    // install.sh copies `.path` verbatim. If it named `content/agents/**` the installer would
    // fetch files that do not exist in the published layout.
    const document = await new RegistryEmitter(repoPath()).emit();

    for (const category of GENERATED_CATEGORIES) {
      for (const entry of entries(document, category)) {
        expect(entry.path, `${entry.id} path`).toMatch(/^\.opencode\/agent\//);
      }
    }
  });

  it("registers every canonical agent", async () => {
    const document = await new RegistryEmitter(repoPath()).emit();
    const agents = await new CanonicalAgentLoader(repoPath("content/agents")).loadFromDirectory();
    const registered = new Set([
      ...byId(document, "agents").keys(),
      ...byId(document, "subagents").keys(),
    ]);

    const unregistered = agents.map((a) => a.oac.id).filter((id) => !registered.has(id));
    expect(unregistered, "canonical agents the emitter failed to register").toEqual([]);
  });

  it("files an agent under the components key its oac.type names", async () => {
    const document = await new RegistryEmitter(repoPath()).emit();

    for (const entry of entries(document, "agents")) expect(entry.type).toBe("agent");
    for (const entry of entries(document, "subagents")) expect(entry.type).toBe("subagent");
  });

  it("resolves a fixture tree independently of the live corpus", async () => {
    const agents = await new CanonicalAgentLoader(repoPath("content/agents")).loadFromDirectory();
    const openagent = agents.find((agent) => agent.oac.id === "openagent");

    expect(entryForAgent(openagent!, ".opencode/agent")).toMatchObject({
      id: "openagent",
      type: "agent",
      path: ".opencode/agent/core/openagent.md",
      category: "core",
    });
    expect(entryForAgent(openagent!, "custom/root").path).toBe("custom/root/core/openagent.md");
  });
});

// ============================================================================
// DEFECTS THE EMITTER FIXES, AND ONE IT WOULD CAUSE
// ============================================================================

describe("registry defects", () => {
  it("finds duplicate typed identities across carried-through categories", () => {
    const document: RegistryDocument = {
      components: {
        agents: [{ id: "shared", type: "agent" }],
        contexts: [{ id: "shared", type: "context" }],
        carriedContexts: [{ id: "shared", type: "context" }],
      },
    };

    expect(duplicateRegistryIdentities(document)).toEqual(["context:shared"]);
  });

  it("emits no duplicate typed identities across any component category", async () => {
    expect(duplicateRegistryIdentities(await new RegistryEmitter(repoPath()).emit())).toEqual([]);
  });

  it.each(RECOVERED_BY_GENERATION)("keeps %s registered, which only generation ever added", async (id) => {
    // Both sides are asserted on purpose. The generated document proves the emitter still
    // derives the entry from the canonical file; the committed one proves the emit actually
    // reached disk. Checking only the emitter would let `registry.json` silently regress to a
    // hand-edited copy that drops these 7 again — the exact failure this refactor ends.
    const document = await new RegistryEmitter(repoPath()).emit();

    expect(byId(document, "subagents").get(id)?.path).toContain(id);
    expect(byId(COMMITTED, "subagents").has(id), `${id} is missing from the committed registry`).toBe(
      true
    );
  });

  it("makes subagent:batch-executor resolvable for openagent and opencoder", async () => {
    // Both declare `subagent:batch-executor`. The hand-maintained registry contained no such
    // component, so install.sh resolved the dependency to nothing and silently installed an
    // orchestrator whose parallel executor was missing. Generation is what closed that.
    const document = await new RegistryEmitter(repoPath()).emit();
    const agents = byId(document, "agents");

    expect(agents.get("openagent")?.dependencies).toContain("subagent:batch-executor");
    expect(agents.get("opencoder")?.dependencies).toContain("subagent:batch-executor");
    expect(byId(document, "subagents").has("batch-executor")).toBe(true);
  });

  it("preserves the dependency edges that only registry.json used to declare", async () => {
    // These edges were hand-authored in registry.json and absent from both the agent files and
    // agent-metadata.json, so generating from the canonical tree used to lose them. Subtask 09b
    // backfilled them into `oac.dependencies`. This asserts the round trip: every edge the
    // committed registry declares is still declared by the generated one, so `install.sh`
    // resolves exactly what it resolves today.
    const document = await new RegistryEmitter(repoPath()).emit();
    const subagents = byId(document, "subagents");

    for (const [id, backfilled] of Object.entries(REGISTRY_ONLY_DEPENDENCIES)) {
      const before = new Set(byId(COMMITTED, "subagents").get(id)?.dependencies ?? []);
      const after = new Set(subagents.get(id)?.dependencies ?? []);

      for (const dependency of backfilled) {
        expect(before.has(dependency), `${id} -> ${dependency} vanished from registry.json`).toBe(
          true
        );
        expect(
          after.has(dependency),
          `${id} -> ${dependency} was dropped — backfill it into content/agents/, do not weaken this test`
        ).toBe(true);
      }
    }
  });

  it("emits the backfilled edges in the order registry.json declares them", async () => {
    // Order is not cosmetic: the emitter maps `oac.dependencies` positionally, and the
    // subtask-11 `oac build && git diff --exit-code` gate compares bytes. A reordered list is a
    // spurious diff, so the canonical files must carry registry.json's own order.
    const subagents = byId(await new RegistryEmitter(repoPath()).emit(), "subagents");

    for (const id of Object.keys(REGISTRY_ONLY_DEPENDENCIES)) {
      expect(subagents.get(id)?.dependencies, `${id} dependency order drifted`).toEqual(
        byId(COMMITTED, "subagents").get(id)?.dependencies
      );
    }
  });
});
