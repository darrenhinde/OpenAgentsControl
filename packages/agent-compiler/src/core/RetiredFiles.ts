/**
 * Retired shipped files: paths an earlier release installed into projects that no release ships
 * any more, and that are not a rename of a live component (those are `supersedes`).
 *
 * The list is hand-maintained in `agent-library/retired.json` and copied, validated, into the
 * additive top-level `retired` array of both registries. Installers (`oac update|init`, `install.sh`,
 * `update.sh`) read it and remove a leftover copy of a retired file, under the same containment
 * rules as superseded agent files, and only when its bytes still hash to a recorded `sha256`
 * (i.e. it is still OAC's own file). `oac doctor` warns while one is present.
 *
 * Why a hash and not a description: retired files are often not agents or commands (a README, YAML
 * templates) and have no frontmatter to compare. Every distinct version OAC ever shipped at the
 * path is recorded, so a file the user never touched always matches.
 */

import { existsSync, readFileSync } from "node:fs";
import { posix, resolve } from "node:path";
import { z } from "zod";

export const RETIRED_FILE = "agent-library/retired.json";

/** The only folders a retired file may sit in (project-relative). Mirrors the installers' check. */
export const RETIRABLE_ROOTS: readonly string[] = [".opencode/agent/", ".opencode/command/", ".opencode/skills/"];

export const RetiredEntrySchema = z
  .object({
    /** Where the file was installed, project-relative, in the registry's `.opencode/...` form. */
    path: z.string(),
    /** SHA-256 (hex) of every version of the file a release shipped at `path`. */
    sha256: z.array(z.string().regex(/^[0-9a-f]{64}$/, "sha256 must be 64 lowercase hex characters")).min(1),
    /** Where the content went, for the message shown to the user (informational). */
    replacedBy: z.string().optional(),
  })
  .strict();

export const RetiredFileSchema = z.object({ retired: z.array(RetiredEntrySchema) }).strict();

export type RetiredEntry = z.infer<typeof RetiredEntrySchema>;

/** Normalised, no `..`, no backslash, under one of {@link RETIRABLE_ROOTS}. */
export function isRetirablePath(path: string): boolean {
  return (
    !path.includes("\\") &&
    posix.normalize(path) === path &&
    !path.split("/").includes("..") &&
    RETIRABLE_ROOTS.some((root) => path.startsWith(root) && path.length > root.length)
  );
}

/** The install destination a registry path maps to (`built-ai-configs/opencode-v1/x` installs as `.opencode/x`). */
const destinationOf = (path: string): string =>
  path.startsWith("built-ai-configs/opencode-v1/") ? `.opencode/${path.slice("built-ai-configs/opencode-v1/".length)}` : path;

/**
 * Load and validate `agent-library/retired.json`. `shipped` is every path the registry being
 * emitted installs; retiring one of those would make the installers delete a live file, so it
 * throws. A missing file is an empty list.
 */
export function loadRetired(root: string, shipped: Iterable<string>): RetiredEntry[] {
  const file = resolve(root, RETIRED_FILE);
  if (!existsSync(file)) return [];
  let parsed: z.infer<typeof RetiredFileSchema>;
  try {
    parsed = RetiredFileSchema.parse(JSON.parse(readFileSync(file, "utf-8")));
  } catch (cause) {
    throw new Error(`${RETIRED_FILE} is invalid: ${cause instanceof Error ? cause.message : String(cause)}`, { cause });
  }
  const live = new Set([...shipped].map(destinationOf));
  const seen = new Set<string>();
  for (const entry of parsed.retired) {
    if (!isRetirablePath(entry.path)) {
      throw new Error(
        `${RETIRED_FILE}: "${entry.path}" must be a normalised path under ${RETIRABLE_ROOTS.join(", ")} (no "..", no backslash).`,
      );
    }
    if (seen.has(entry.path)) throw new Error(`${RETIRED_FILE}: duplicate path "${entry.path}".`);
    seen.add(entry.path);
    if (live.has(entry.path)) {
      throw new Error(`${RETIRED_FILE}: "${entry.path}" is still shipped by a registry component; retiring it would delete a live file.`);
    }
  }
  return [...parsed.retired].sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
}
