import { flavorOfConfig, type OpenCodeFlavor } from './flavor.js';
import { readConfig, type OacConfig } from './config.js';

/** The OpenCode flavor a project is installed for, read from `.oac/config.json`. */
export type ProjectFlavor = { config: OacConfig | null; flavor: OpenCodeFlavor; recorded: boolean };

/**
 * Reads the project's recorded flavor. A missing config, or one with no record, is v2 with
 * `recorded: false` — which is how callers recognise an install that predates the record.
 */
export const readProjectFlavor = async (projectRoot: string): Promise<ProjectFlavor> => {
  const config = await readConfig(projectRoot);
  return { config, ...flavorOfConfig(config) };
};
