import { z } from "zod";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import type { OpenCodeFlavor } from "./flavor.js";
import { join, dirname } from "node:path";

export const OacPreferencesSchema = z.object({
  yoloMode: z.boolean(),
  autoBackup: z.boolean(),
});

const DEFAULT_INSTALLATION_SCOPE = {
  profile: "essential",
  contextOnly: false,
  profiles: ["essential"],
};

/** The profiles whose files OAC is allowed to reconcile on later updates. */
export const OacInstallationScopeSchema = z.object({
  /** The most recently selected profile, used as the default for subsequent commands. */
  profile: z.string(),
  /** Whether the current profile selection was limited to context files. */
  contextOnly: z.boolean(),
  /** Every profile selected over the lifetime of this installation. */
  profiles: z.array(z.string()),
});

/**
 * Which OpenCode major this installation targets. ABSENT on installs that predate OpenCode v2
 * support, which is how `oac update` recognises them; read it through `flavorOfConfig`, which
 * defaults to v2. Never inferred from the host: v1 is only ever an explicit choice.
 */
export const OacOpenCodeSchema = z.object({
  target: z.enum(["v1", "v2"]),
});

export const OacConfigSchema = z.object({
  version: z.literal("1"),
  preferences: OacPreferencesSchema,
  // Version-1 configs predate installation scope. Defaulting keeps them readable.
  installationScope: OacInstallationScopeSchema.default(DEFAULT_INSTALLATION_SCOPE),
  opencode: OacOpenCodeSchema.optional(),
});

export type OacPreferences = z.infer<typeof OacPreferencesSchema>;
export type OacInstallationScope = z.infer<typeof OacInstallationScopeSchema>;
export type OacConfig = z.infer<typeof OacConfigSchema>;

export const getConfigPath = (projectRoot: string): string =>
  join(projectRoot, ".oac", "config.json");

export const createDefaultConfig = (): OacConfig => ({
  version: "1",
  preferences: { yoloMode: false, autoBackup: true },
  installationScope: {
    ...DEFAULT_INSTALLATION_SCOPE,
    profiles: [...DEFAULT_INSTALLATION_SCOPE.profiles],
  },
});

/** Records the OpenCode flavor. Pure — returns a new object. */
export const withOpenCodeFlavor = (config: OacConfig, target: OpenCodeFlavor): OacConfig => ({
  ...config,
  opencode: { target },
});

// Pure — returns new object, no mutation
export const mergeConfig = (base: OacConfig, overrides: Partial<OacPreferences>): OacConfig =>
  ({ ...base, preferences: { ...base.preferences, ...overrides } });

export const isYoloMode = (config: OacConfig): boolean =>
  config.preferences.yoloMode || process.env["CI"] === "true";

export const isAutoBackup = (config: OacConfig): boolean =>
  config.preferences.autoBackup;

export async function readConfig(projectRoot: string): Promise<OacConfig | null> {
  const configPath = getConfigPath(projectRoot);
  const exists = await stat(configPath).then((s) => s.isFile()).catch(() => false);
  if (!exists) return null;
  const raw = JSON.parse(await readFile(configPath, "utf8")) as unknown;
  const result = OacConfigSchema.safeParse(raw);
  if (!result.success) {
    throw new Error(`Invalid config at "${configPath}": ${result.error.message}`);
  }
  return result.data;
}

export async function writeConfig(projectRoot: string, config: OacConfig): Promise<void> {
  const configPath = getConfigPath(projectRoot);
  await mkdir(dirname(configPath), { recursive: true });
  await writeFile(configPath, JSON.stringify(config, null, 2));
}
