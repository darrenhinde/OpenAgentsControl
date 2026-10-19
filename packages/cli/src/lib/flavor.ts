/**
 * OpenCode flavor — which OpenCode major an installation targets.
 *
 * v2 is the default everywhere and is never inferred away from. v1 is an explicit opt-in
 * (`oac init --opencode v1`), recorded in `.oac/config.json` so `add` and `update` keep honouring
 * it. Everything v1-specific on the install side lives in this module plus the `v1-opencode/`
 * source prefix, so dropping v1 later is deleting this file's v1 branches.
 *
 * Pure: no I/O. The host's installed version is an INPUT here, detected elsewhere.
 */

export type OpenCodeFlavor = 'v1' | 'v2';

export const DEFAULT_FLAVOR: OpenCodeFlavor = 'v2';

/**
 * Where the v1 build lives in the OAC package. It is a SOURCE location only: an install writes
 * its contents to `.opencode/` and the name never appears in a user's project.
 */
export const V1_SOURCE_ROOT = 'v1-opencode';
const V1_PREFIX = `${V1_SOURCE_ROOT}/`;
const DEST_PREFIX = '.opencode/';

/** `v1`, `v2`, `1`, `2` (any case), else null. Pure. */
export const parseFlavor = (value: string): OpenCodeFlavor | null => {
  const v = value.trim().toLowerCase();
  if (v === 'v1' || v === '1') return 'v1';
  if (v === 'v2' || v === '2') return 'v2';
  return null;
};

/** The registry file a flavor installs from, relative to the package root. Pure. */
export const registryFileFor = (flavor: OpenCodeFlavor): string =>
  flavor === 'v1' ? 'registry.v1.json' : 'registry.json';

/** True for a bundle path that sits under the v1 source folder. Pure. */
export const isV1Source = (relativePath: string): boolean => relativePath.startsWith(V1_PREFIX);

/** Where a bundled source path lands in the user's project. Pure. */
export const toDestPath = (sourcePath: string): string =>
  isV1Source(sourcePath) ? `${DEST_PREFIX}${sourcePath.slice(V1_PREFIX.length)}` : sourcePath;

/** The flavor recorded in a config, and whether it was recorded at all. Pure. */
export const flavorOfConfig = (
  config: { opencode?: { target: OpenCodeFlavor } | undefined } | null,
): { flavor: OpenCodeFlavor; recorded: boolean } =>
  config?.opencode === undefined
    ? { flavor: DEFAULT_FLAVOR, recorded: false }
    : { flavor: config.opencode.target, recorded: true };

// ── Transitions ───────────────────────────────────────────────────────────────

export type FlavorTransition =
  | { action: 'keep'; flavor: OpenCodeFlavor }
  /** First time a flavor is written for an install that predates the record: no files move. */
  | { action: 'record'; flavor: OpenCodeFlavor }
  /** Move a v1-layout install onto v2 (removes OAC-owned v1 files). */
  | { action: 'migrate'; flavor: 'v2' }
  /** The user asked to change a recorded flavor. */
  | { action: 'switch'; flavor: OpenCodeFlavor }
  /** Ambiguous and risky: do nothing and tell the user how to proceed. */
  | { action: 'refuse'; message: string };

export type TransitionInput = {
  /** Whether `.oac/config.json` records a flavor. */
  recorded: boolean;
  /** The flavor in force (v2 when nothing is recorded). */
  current: OpenCodeFlavor;
  /** An explicit `--opencode` choice. */
  requested: OpenCodeFlavor | undefined;
  /** Major version of the OpenCode on PATH, or null when absent or unreadable. */
  hostMajor: number | null;
};

/**
 * Decides what `oac update` does about the flavor. Pure.
 *
 * The one rule that matters: an install is never silently moved to or from v1. A recorded choice
 * is kept; an explicit flag is obeyed; and an install that predates the record — which is a v1
 * layout — is migrated to v2 only when the host is not v1.
 */
export const transitionFlavor = (input: TransitionInput): FlavorTransition => {
  const { recorded, current, requested, hostMajor } = input;

  if (recorded) {
    if (requested === undefined || requested === current) return { action: 'keep', flavor: current };
    return { action: 'switch', flavor: requested };
  }

  // Legacy: installed before OAC supported two OpenCode majors, so the files are the v1 layout.
  if (requested === 'v1') return { action: 'record', flavor: 'v1' };
  if (requested === 'v2') return { action: 'migrate', flavor: 'v2' };
  if (hostMajor === 1) {
    return {
      action: 'refuse',
      message:
        'This install predates OpenCode v2 support and your OpenCode is v1, so OAC will not move it on its own.\n' +
        '  Stay on v1:   oac update --opencode v1   (records the choice; nothing else changes)\n' +
        '  Move to v2:   upgrade OpenCode, then oac update --opencode v2',
    };
  }
  return { action: 'migrate', flavor: 'v2' };
};

// ── Init ──────────────────────────────────────────────────────────────────────

export type InitFlavorDecision = { ok: true; flavor: OpenCodeFlavor } | { ok: false; message: string };

/**
 * Which flavor `oac init` installs. Pure.
 *
 * A fresh project is v2 unless v1 is requested. Re-running init never changes a recorded flavor
 * and never guesses one for an install that predates the record: switching is `oac update`'s job,
 * because it is the command that knows how to move files safely.
 */
export const resolveInitFlavor = (input: {
  requested: OpenCodeFlavor | undefined;
  recorded: boolean;
  current: OpenCodeFlavor;
  hasInstall: boolean;
}): InitFlavorDecision => {
  const { requested, recorded, current, hasInstall } = input;

  if (!hasInstall) return { ok: true, flavor: requested ?? DEFAULT_FLAVOR };

  if (recorded) {
    if (requested === undefined || requested === current) return { ok: true, flavor: current };
    return {
      ok: false,
      message: `This project is already installed for OpenCode ${current}. To switch it, run: oac update --opencode ${requested}`,
    };
  }

  if (requested === 'v1') return { ok: true, flavor: 'v1' };
  return {
    ok: false,
    message:
      'This project has an OAC install that predates OpenCode v2 support (v1 layout). ' +
      'Run `oac update` to move it to v2, or `oac init --opencode v1` to keep it on v1.',
  };
};
