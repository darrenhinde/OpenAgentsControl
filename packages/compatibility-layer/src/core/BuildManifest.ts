/**
 * The build's ledger: what `oac build` wrote, and where it was allowed to write it.
 *
 * ─── Why this is its own module ─────────────────────────────────────────────────────────
 *
 * The ledger answers one question — "did WE generate this path?" — and two callers need it:
 *
 *   - {@link BuildPipeline.write} prunes a generated FILE whose source is gone.
 *   - {@link RegistryEmitter.emit} drops a generated registry ENTRY whose source is gone.
 *
 * Those are the same rule applied to two artefacts, so they must consult the same ledger or
 * they will disagree — and a disagreement here means `.opencode/**` and `registry.json` drift
 * apart, which is the exact class of bug this refactor exists to end. `BuildPipeline` already
 * imports `RegistryEmitter` (it emits the registry as a build target), so the ledger cannot
 * live in `BuildPipeline` without `RegistryEmitter` importing back into a cycle. It lives here
 * instead, imported by both and owned by neither.
 *
 * ─── The ledger is what makes deletion safe ─────────────────────────────────────────────
 *
 * "Remove anything under `.opencode/agent/` without a `content/` source" would delete
 * `.opencode/agent/eval-runner.md` — a real, shipped, hand-authored agent that has
 * deliberately not been canonicalised. The rule is therefore inverted: the build removes only
 * what IT PREVIOUSLY WROTE. A file the build has never generated is not in the ledger, cannot
 * become a candidate, and is invisible to pruning no matter where it sits.
 *
 * That inversion is why an ABSENT or unreadable ledger prunes NOTHING rather than pruning
 * everything: no record of having written a file is not evidence that we wrote it. The first
 * build on a fresh clone therefore carries every pre-existing entry and deletes nothing.
 */

import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";

/** Where the ledger lives, relative to the repo root. */
export const MANIFEST_FILE = ".oac/build-manifest.json";

/** One line of the ledger: what the build wrote at a path, and where it was allowed to. */
export interface ManifestEntry {
  /** sha256 of the bytes the build wrote. */
  sha256: string;
  /** The target that produced it. */
  target: string;
  /**
   * The output root this file was written under — `TARGET_ROOTS[target]`, rebased if the
   * target was staged. Recorded rather than recomputed so pruning can bound itself without
   * having to be told which staging layout a PREVIOUS build happened to use.
   */
  root: string;
}

/** The build's ledger of what it wrote. Deterministic: sorted keys, no timestamps. */
export interface BuildManifest {
  /** Ledger format version, so a future shape change is detectable rather than silent. */
  version: 1;
  /** Repo-relative POSIX path -> what the build wrote there. */
  files: Record<string, ManifestEntry>;
}

/** Locale-independent ordering. `localeCompare` is locale-dependent — never use it here. */
function compare(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/** Read the previous manifest, or an empty one. An absent ledger prunes nothing — safe. */
export function readManifest(root: string): BuildManifest {
  const path = join(resolve(root), MANIFEST_FILE);
  if (!existsSync(path)) return { version: 1, files: {} };

  try {
    const parsed = JSON.parse(readFileSync(path, "utf-8")) as BuildManifest;
    // A ledger we cannot vouch for prunes nothing rather than pruning wrongly.
    if (parsed.version !== 1 || typeof parsed.files !== "object" || parsed.files === null) {
      return { version: 1, files: {} };
    }
    return parsed;
  } catch {
    return { version: 1, files: {} };
  }
}

/**
 * The set of repo-relative paths a previous build recorded generating.
 *
 * The discriminator both pruning rules turn on. A path in this set was emitted by us and may
 * therefore be withdrawn when its source disappears; a path outside it is somebody else's file
 * and is never ours to remove.
 */
export function generatedPaths(root: string): ReadonlySet<string> {
  return new Set(Object.keys(readManifest(root).files));
}

/** Serialise a manifest with sorted keys and a trailing newline. No clock, by construction. */
export function serializeManifest(manifest: BuildManifest): string {
  const files: BuildManifest["files"] = {};
  for (const path of Object.keys(manifest.files).sort(compare)) {
    files[path] = manifest.files[path]!;
  }
  return `${JSON.stringify({ version: manifest.version, files }, null, 2)}\n`;
}
