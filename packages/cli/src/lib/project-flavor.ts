import { join } from 'node:path';
import { readFile } from 'node:fs/promises';
import { flavorOfConfig, parseFlavor, type OpenCodeFlavor } from './flavor.js';
import { readConfig, type OacConfig } from './config.js';

/** Where `install.sh` records the flavor it installed: `.opencode/.oac-opencode`. */
export const flavorMarkerPath = (projectRoot: string): string => join(projectRoot, '.opencode', '.oac-opencode');

/** The flavor `install.sh` recorded in the marker file, or null when absent or unreadable. */
export const readFlavorMarker = async (projectRoot: string): Promise<OpenCodeFlavor | null> => {
  try {
    return parseFlavor(await readFile(flavorMarkerPath(projectRoot), 'utf8'));
  } catch {
    return null;
  }
};

/** The OpenCode flavor a project is installed for, and where that was recorded. */
export type ProjectFlavor = {
  config: OacConfig | null;
  flavor: OpenCodeFlavor;
  recorded: boolean;
  source: 'config' | 'marker' | 'none';
};

/**
 * Reads the project's recorded flavor: `.oac/config.json` first, then the `.opencode/.oac-opencode`
 * marker that `install.sh` writes, so the two installers can share a project. Neither is v2 with
 * `recorded: false` — which is how callers recognise an install that predates the record.
 */
export const readProjectFlavor = async (projectRoot: string): Promise<ProjectFlavor> => {
  const config = await readConfig(projectRoot);
  const fromConfig = flavorOfConfig(config);
  if (fromConfig.recorded) return { config, ...fromConfig, source: 'config' };
  const marker = await readFlavorMarker(projectRoot);
  if (marker !== null) return { config, flavor: marker, recorded: true, source: 'marker' };
  return { config, ...fromConfig, source: 'none' };
};
