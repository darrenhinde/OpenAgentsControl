import { readManifest, type ManifestFile } from './manifest.js';
import { getIdeDisplayName, type DetectedIde } from './ide-detect.js';
import { readFile, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { z } from 'zod';

// ── Types ─────────────────────────────────────────────────────────────────────

export type CheckStatus = 'ok' | 'warn' | 'error' | 'info';

export type CheckResult = {
  name: string;
  status: CheckStatus;
  message: string;
  detail?: string[];
};

export type DoctorSummary = {
  ok: number;
  warnings: number;
  errors: number;
};

export type OverallStatus = 'healthy' | 'warning' | 'error';

/** Outcome of reading the manifest without letting a corrupt file escape as an exception. */
export type SafeManifest =
  | { ok: true; manifest: ManifestFile | null }
  | { ok: false; error: string };

export const CLAUDE_CONTEXT_ROOT = '.opencode/context';
export const ClaudeDiscoveryConfigSchema = z.object({
  version: z.literal('1'),
  context: z.object({
    root: z.literal(CLAUDE_CONTEXT_ROOT),
  }),
});

export const getClaudeDiscoveryConfigPath = (projectRoot: string): string =>
  join(projectRoot, '.oac.json');

// ── Manifest ──────────────────────────────────────────────────────────────────

/**
 * Reads the manifest and turns every failure into a value.
 *
 * `readManifest` throws on a corrupt file, which is the one condition `oac doctor` exists to
 * report — so the diagnostic must never die on it. `manifest: null` means the file is absent.
 */
export const safeReadManifest = async (projectRoot: string): Promise<SafeManifest> => {
  try {
    return { ok: true, manifest: await readManifest(projectRoot) };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
};

/**
 * The check result for a manifest-dependent check when the manifest could not be used.
 * Returns null when the manifest is present and valid, i.e. the check should proceed.
 */
export const manifestUnavailable = (name: string, read: SafeManifest): CheckResult | null => {
  if (!read.ok) {
    return { name, status: 'error', message: `Cannot check — manifest is invalid` };
  }
  if (read.manifest === null) {
    return { name, status: 'error', message: `Cannot check — manifest is missing` };
  }
  return null;
};

/** Reports whether ContextScout's required root navigation file is present. */
export const checkContextRootNavigation = async (projectRoot: string): Promise<CheckResult> => {
  const navigationPath = join(projectRoot, '.opencode', 'context', 'navigation.md');
  const exists = await stat(navigationPath).then((entry) => entry.isFile()).catch(() => false);
  return exists
    ? {
        name: 'Context root navigation',
        status: 'ok',
        message: '.opencode/context/navigation.md present',
      }
    : {
        name: 'Context root navigation',
        status: 'error',
        message: '.opencode/context/navigation.md missing — run \'oac init\' to restore context discovery',
      };
};

/** Validates Claude Code's externally verified project-local context discovery configuration. */
export const checkClaudeDiscoveryConfig = async (projectRoot: string): Promise<CheckResult> => {
  const configPath = getClaudeDiscoveryConfigPath(projectRoot);
  const raw = await readFile(configPath, 'utf8').catch(() => null);
  if (raw === null) {
    return {
      name: 'Claude context discovery',
      status: 'error',
      message: '.oac.json missing — run \'oac init\' to configure Claude context discovery',
    };
  }

  try {
    const parsed: unknown = JSON.parse(raw);
    const result = ClaudeDiscoveryConfigSchema.safeParse(parsed);
    if (!result.success) {
      return {
        name: 'Claude context discovery',
        status: 'error',
        message: `.oac.json invalid — expected version "1" and context.root "${CLAUDE_CONTEXT_ROOT}"`,
      };
    }
  } catch {
    return {
      name: 'Claude context discovery',
      status: 'error',
      message: '.oac.json invalid JSON',
    };
  }

  const navigationPath = join(projectRoot, CLAUDE_CONTEXT_ROOT, 'navigation.md');
  const hasTarget = await stat(navigationPath).then((entry) => entry.isFile()).catch(() => false);
  return hasTarget
    ? {
        name: 'Claude context discovery',
        status: 'ok',
        message: `.oac.json points to ${CLAUDE_CONTEXT_ROOT}`,
      }
    : {
        name: 'Claude context discovery',
        status: 'error',
        message: `.oac.json target missing ${CLAUDE_CONTEXT_ROOT}/navigation.md`,
      };
};

// ── IDE lines ─────────────────────────────────────────────────────────────────

/**
 * Maps one detected tool to its doctor line. Pure.
 *
 * OpenCode reads `.opencode/` directly, so its presence is the healthy state and there is
 * nothing to apply — a correct fresh install must not produce a warning here. Claude Code
 * files are reported as information: `oac apply claude` writes `.claude/agents/*.md`, but
 * nothing marks a hand-written one, so the tool cannot honestly say whether it is stale.
 */
export const ideCheckResult = (ide: DetectedIde): CheckResult => {
  const label = getIdeDisplayName(ide.type);
  if (ide.type === 'opencode') {
    return {
      name: `IDE: ${label}`,
      status: 'ok',
      message: `.opencode/ present — nothing to apply`,
    };
  }
  return {
    name: `IDE: ${label}`,
    status: 'info',
    message: `${label} detected (${ide.indicator}) — run 'oac apply claude' to write .claude/agents/ from your agents`,
  };
};

/** Doctor lines for every detected tool, or a single hint when none is present. Pure. */
export const ideCheckResults = (ides: DetectedIde[]): CheckResult[] => {
  const detected = ides.filter((ide) => ide.detected);
  if (detected.length === 0) {
    return [
      {
        name: 'IDE detection',
        status: 'info',
        message: "No tools detected — run 'oac init' to install, then 'oac apply claude' for Claude Code",
      },
    ];
  }
  return detected.map(ideCheckResult);
};

// ── OpenCode flavor ───────────────────────────────────────────────────────────

/**
 * Compares the OpenCode flavor an install is built for with the OpenCode actually on PATH. Pure.
 *
 * A mismatch is an ERROR, not a warning: a v2 install on a v1 host resolves delegation by a
 * different id space, and a v1 install on a v2 host ships tools and plugins v2 never loads
 * (#362, #367). Either way the install looks healthy and misbehaves.
 */
export const openCodeFlavorCheck = (input: {
  flavor: 'v1' | 'v2';
  recorded: boolean;
  hostMajor: number | null;
}): CheckResult => {
  const { flavor, recorded, hostMajor } = input;
  const name = 'OpenCode version';

  if (hostMajor === null) {
    return {
      name,
      status: 'info',
      message: `OpenCode not found on PATH (installed for OpenCode ${flavor}) — could not compare`,
    };
  }

  if (!recorded) {
    return hostMajor === 1
      ? {
          name,
          status: 'warn',
          message: 'install predates OpenCode v2 support and OpenCode v1 is installed — run \'oac update --opencode v1\' to record that choice',
        }
      : {
          name,
          status: 'warn',
          message: `install uses the v1 layout but OpenCode ${hostMajor} is installed — run 'oac update' to move it to v2`,
        };
  }

  if (flavor === 'v2' && hostMajor === 1) {
    return {
      name,
      status: 'error',
      message: "installed for OpenCode v2 but OpenCode v1 is on PATH — run 'oac update --opencode v1', or upgrade OpenCode",
    };
  }
  if (flavor === 'v1' && hostMajor >= 2) {
    return {
      name,
      status: 'error',
      message: `installed for OpenCode v1 but OpenCode ${hostMajor} is on PATH; v1 agents, tools and plugins do not load there — run 'oac update --opencode v2'`,
    };
  }
  return { name, status: 'ok', message: `OpenCode ${hostMajor} matches the ${flavor} install` };
};

// ── Summary ───────────────────────────────────────────────────────────────────

/** Computes summary counts from check results. Pure. */
export const summariseResults = (results: CheckResult[]): DoctorSummary => ({
  ok: results.filter((r) => r.status === 'ok' || r.status === 'info').length,
  warnings: results.filter((r) => r.status === 'warn').length,
  errors: results.filter((r) => r.status === 'error').length,
});

/** Returns the overall status from a summary. Pure. */
export const overallStatus = (summary: DoctorSummary): OverallStatus => {
  if (summary.errors > 0) return 'error';
  if (summary.warnings > 0) return 'warning';
  return 'healthy';
};
