import { readManifest, type ManifestFile } from './manifest.js';
import { getIdeDisplayName, type DetectedIde } from './ide-detect.js';

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

// ── IDE lines ─────────────────────────────────────────────────────────────────

/**
 * Maps one detected tool to its doctor line. Pure.
 *
 * OpenCode reads `.opencode/` directly, so its presence is the healthy state and there is
 * nothing to apply — a correct fresh install must not produce a warning here. Claude Code
 * files are reported as information: `oac apply claude` writes CLAUDE.md, but nothing marks
 * a hand-written one, so the tool cannot honestly say whether it is stale.
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
    message: `${label} detected (${ide.indicator}) — run 'oac apply claude' to regenerate CLAUDE.md from your agents`,
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
