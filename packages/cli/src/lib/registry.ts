import { z } from "zod";
import { readFile, stat } from "node:fs/promises";
import { join } from "node:path";

// ── Constants ──────────────────────────────────────────────────────────────────

const REGISTRY_FILENAME = "registry.json";

/** The profile `oac init` installs when none is named. */
export const DEFAULT_PROFILE_ID = "essential";

/**
 * The one profile that is NOT resolved through the registry: it means "everything the
 * bundle ships", so `oac init --profile full` keeps copying the whole tree.
 */
export const FULL_PROFILE_ID = "full";

/**
 * Component paths must live under `.opencode/` to be installed. The only exception is the
 * environment template, which is harmless to drop next to the user's project. Anything else
 * at the project root (`README.md`, for example) would overwrite a file the user owns.
 */
const PROJECT_LEVEL_ALLOWLIST: ReadonlySet<string> = new Set(["env.example"]);
const INSTALL_PREFIX = ".opencode/";

// ── Schemas ────────────────────────────────────────────────────────────────────

/**
 * Every component kind the registry knows and the CLI can install.
 * Matches the user-facing ref prefix: `agent:X`, `context:X`, `skill:X`, `command:X`, ...
 */
export const ComponentTypeSchema = z.enum([
  "agent",
  "subagent",
  "context",
  "skill",
  "command",
  "tool",
  "plugin",
  "config",
]);

/** A single component entry from registry.json. */
export const RegistryComponentSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: ComponentTypeSchema,
  path: z.string(),
  description: z.string().default(""),
  tags: z.array(z.string()).default([]),
  dependencies: z.array(z.string()).default([]),
  category: z.string().default("standard"),
  /** Multi-file components (skills) list every file to install; `path` is the primary one. */
  files: z.array(z.string()).optional(),
  /** Alternative ids a ref may use (legacy names kept for old profiles). */
  aliases: z.array(z.string()).optional(),
});

/** An install tier: a name, a blurb, and the `type:id` refs it pulls in. */
export const RegistryProfileSchema = z.object({
  name: z.string(),
  description: z.string().default(""),
  components: z.array(z.string()).default([]),
});

const componentList = z.array(RegistryComponentSchema).default([]);

export const RegistrySchema = z.object({
  version: z.string(),
  schema_version: z.string().optional(),
  repository: z.string().optional(),
  categories: z.record(z.string(), z.string()).optional(),
  components: z.object({
    agents: componentList,
    subagents: componentList,
    contexts: componentList,
    skills: componentList,
    commands: componentList,
    tools: componentList,
    plugins: componentList,
    config: componentList,
  }),
  profiles: z.record(z.string(), RegistryProfileSchema).default({}),
});

// ── Types ──────────────────────────────────────────────────────────────────────

export type ComponentType = z.infer<typeof ComponentTypeSchema>;
export type RegistryComponent = z.infer<typeof RegistryComponentSchema>;
export type RegistryProfile = z.infer<typeof RegistryProfileSchema>;
export type Registry = z.infer<typeof RegistrySchema>;

/** A profile with its id, for listing. */
export type ProfileSummary = RegistryProfile & { id: string };

/** What a profile resolves to on disk. */
export type ProfileResolution = {
  /** Relative paths to install, deduplicated and sorted. */
  files: string[];
  /** The components those files came from. */
  components: RegistryComponent[];
  /** `type:id` refs the registry does not know. Reported, never fatal. */
  unresolved: string[];
  /** Refs skipped because their path would land outside `.opencode/`. */
  refused: string[];
};

// ── Path helpers ───────────────────────────────────────────────────────────────

/** Returns the absolute path to registry.json given the package root. */
export const getRegistryPath = (packageRoot: string): string =>
  join(packageRoot, REGISTRY_FILENAME);

/** True when a component path is somewhere `oac` is allowed to write. Pure. */
export const isInstallablePath = (relativePath: string): boolean =>
  relativePath.startsWith(INSTALL_PREFIX) || PROJECT_LEVEL_ALLOWLIST.has(relativePath);

/** Every file a component installs: its `files[]` when listed, else its `path`. Pure. */
export const filesForComponent = (component: RegistryComponent): string[] =>
  component.files !== undefined && component.files.length > 0
    ? component.files
    : [component.path];

// ── Pure query helpers ─────────────────────────────────────────────────────────

const SECTION_FOR_TYPE: Record<ComponentType, keyof Registry["components"]> = {
  agent: "agents",
  subagent: "subagents",
  context: "contexts",
  skill: "skills",
  command: "commands",
  tool: "tools",
  plugin: "plugins",
  config: "config",
};

/**
 * Returns every component in the registry, optionally filtered to one type.
 * Pure — no side effects.
 */
export const listComponents = (
  registry: Registry,
  type?: ComponentType,
): RegistryComponent[] => {
  if (type !== undefined) return registry.components[SECTION_FOR_TYPE[type]];
  return ComponentTypeSchema.options.flatMap((t) => registry.components[SECTION_FOR_TYPE[t]]);
};

/**
 * Filters components by a type string; unknown types yield an empty list.
 * Pure — no side effects.
 */
export const listComponentsByType = (
  registry: Registry,
  type: string,
): RegistryComponent[] => {
  const parsed = ComponentTypeSchema.safeParse(type);
  if (!parsed.success) return [];
  return listComponents(registry, parsed.data);
};

/** Splits `type:id` into its parts, or null when the shape is wrong. Pure. */
const parseRef = (ref: string): { type: ComponentType; id: string } | null => {
  const colonIndex = ref.indexOf(":");
  if (colonIndex === -1) return null;

  const rawType = ref.slice(0, colonIndex);
  const id = ref.slice(colonIndex + 1);
  if (!rawType || !id) return null;

  const typeResult = ComponentTypeSchema.safeParse(rawType);
  if (!typeResult.success) return null;

  return { type: typeResult.data, id };
};

/** Where each component kind's files live, for path-shaped and wildcard refs. */
const BASE_DIR: Record<ComponentType, string> = {
  agent: ".opencode/agent/",
  subagent: ".opencode/agent/",
  context: ".opencode/context/",
  skill: ".opencode/skills/",
  command: ".opencode/command/",
  tool: ".opencode/tool/",
  plugin: ".opencode/plugin/",
  config: "",
};

/** True when the component answers to `id`, by id or alias. Pure. */
const hasId = (component: RegistryComponent, id: string): boolean =>
  component.id === id || (component.aliases?.includes(id) ?? false);

/**
 * Resolves a `type:name` ref (e.g. `"context:react-patterns"`) to a component.
 *
 * A context ref may also be path-shaped (`context:core/standards/code-quality`), the form
 * older profiles and `install.sh` use: it matches the component whose path is that file
 * under `.opencode/context/`, with or without a `.md` extension.
 *
 * Returns `null` — never throws — when the component is not found or the ref
 * format is invalid.
 * Pure — no side effects.
 */
export const resolveComponent = (
  registry: Registry,
  ref: string,
): RegistryComponent | null => {
  const parsed = parseRef(ref);
  if (parsed === null) return null;

  const candidates = listComponents(registry, parsed.type);
  const byId = candidates.find((c) => hasId(c, parsed.id));
  if (byId !== undefined) return byId;

  if (!parsed.id.includes("/")) return null;
  const asPath = `${BASE_DIR[parsed.type]}${parsed.id}`;
  return candidates.find((c) => c.path === `${asPath}.md` || c.path === asPath) ?? null;
};

/**
 * Expands one profile ref to the components it names.
 *
 * `context:core/*` means every context whose path sits under `.opencode/context/core/`.
 * Only a trailing `*` is understood; that is the only shape the shipped profiles use.
 * A ref without a wildcard expands to at most one component.
 *
 * Pure — no side effects.
 */
export const expandRef = (registry: Registry, ref: string): RegistryComponent[] => {
  const parsed = parseRef(ref);
  if (parsed === null) return [];

  if (!parsed.id.endsWith("*")) {
    const one = resolveComponent(registry, ref);
    return one === null ? [] : [one];
  }

  const prefix = `${BASE_DIR[parsed.type]}${parsed.id.slice(0, -1)}`;
  return listComponents(registry, parsed.type).filter((c) => c.path.startsWith(prefix));
};

// ── Profiles ───────────────────────────────────────────────────────────────────

/** Every profile the registry declares, sorted by id. Pure. */
export const listProfiles = (registry: Registry): ProfileSummary[] =>
  Object.entries(registry.profiles)
    .map(([id, profile]) => ({ id, ...profile }))
    .sort((a, b) => a.id.localeCompare(b.id));

/** A profile by id, or null. Pure. */
export const getProfile = (registry: Registry, id: string): RegistryProfile | null =>
  registry.profiles[id] ?? null;

/**
 * Turns a profile into the list of files to install.
 *
 * Refs may be ids, path-shaped context refs, or trailing-wildcard globs (see {@link expandRef}).
 * Unknown refs are collected, not thrown: a stale profile entry should cost the user one
 * warning line, not the whole install. Refs whose path would land outside `.opencode/` are
 * refused for the same reason `oac` never writes a project's README.
 *
 * Pure — no side effects.
 */
export const resolveProfile = (
  registry: Registry,
  profile: RegistryProfile,
  options: { contextOnly?: boolean } = {},
): ProfileResolution => {
  const wanted = options.contextOnly
    ? profile.components.filter((ref) => ref.startsWith("context:"))
    : profile.components;

  const seen = new Set<string>();
  const resolution: ProfileResolution = { files: [], components: [], unresolved: [], refused: [] };

  for (const ref of wanted) {
    const components = expandRef(registry, ref);
    if (components.length === 0) {
      resolution.unresolved.push(ref);
      continue;
    }

    for (const component of components) {
      const files = filesForComponent(component);
      if (!files.every(isInstallablePath)) {
        resolution.refused.push(ref);
        continue;
      }

      resolution.components.push(component);
      for (const file of files) {
        if (!seen.has(file)) {
          seen.add(file);
          resolution.files.push(file);
        }
      }
    }
  }

  resolution.files.sort();
  return resolution;
};

// ── I/O ────────────────────────────────────────────────────────────────────────

/**
 * Reads and validates registry.json from `packageRoot`.
 * Throws with a clear, actionable message when:
 *   - the file does not exist
 *   - the JSON is malformed
 *   - the schema validation fails
 */
export const readRegistry = async (packageRoot: string): Promise<Registry> => {
  const registryPath = getRegistryPath(packageRoot);

  const exists = await stat(registryPath).then((s) => s.isFile()).catch(() => false);
  if (!exists) {
    throw new Error(
      `registry.json not found at "${registryPath}".\n` +
        `This file should be bundled with the @controlstack/oac package.\n` +
        `Try reinstalling: npm install -g @controlstack/oac`,
    );
  }

  const raw = await readFile(registryPath, "utf8")
    .then((text) => JSON.parse(text) as unknown)
    .catch((err: unknown) => {
      const msg = err instanceof Error ? err.message : String(err);
      throw new Error(
        `Failed to parse registry.json at "${registryPath}": ${msg}\n` +
          `The file may be corrupted. Try reinstalling: npm install -g @controlstack/oac`,
      );
    });

  const result = RegistrySchema.safeParse(raw);
  if (!result.success) {
    const issues = result.error.issues
      .map((i) => `  • ${i.path.join(".")}: ${i.message}`)
      .join("\n");
    throw new Error(
      `Invalid registry.json at "${registryPath}":\n${issues}\n` +
        `The registry schema may have changed. Try reinstalling: npm install -g @controlstack/oac`,
    );
  }

  return result.data;
};

/**
 * Convenience alias: reads registry.json from `packageRoot`.
 * Identical to `readRegistry` — provided for callers that prefer this name.
 */
export const loadRegistry = readRegistry;
