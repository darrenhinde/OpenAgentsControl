/**
 * ModelMapper - Maps AI model identifiers between OAC and other platforms
 *
 * Different tools use different model ID formats. This mapper handles
 * bidirectional translation with fallbacks for unknown models.
 *
 * @example
 * ```ts
 * mapModelFromOAC('claude-sonnet-4', 'claude')
 * // => { id: 'claude-sonnet-4-20250514', exact: true }
 *
 * mapModelToOAC('gpt-4-turbo', 'cursor')
 * // => { id: 'gpt-4-turbo', exact: true }
 * ```
 */

// ============================================================================
// Types
// ============================================================================

export type ModelPlatform = "oac" | "claude" | "cursor" | "windsurf" | "openclaw";

/**
 * Result of a model mapping operation
 */
export interface ModelMappingResult {
  /** The mapped model ID */
  id: string;
  /** Whether the mapping was exact or a fallback */
  exact: boolean;
  /** Warning message if mapping was approximated */
  warning?: string;
}

/**
 * Model family for grouping related models
 */
export type ModelFamily = "claude" | "gpt" | "gemini" | "llama" | "mistral" | "other";

/**
 * Model information with metadata
 */
export interface ModelInfo {
  /** Canonical OAC model ID */
  oacId: string;
  /** Model family */
  family: ModelFamily;
  /** Platform-specific IDs */
  platformIds: Partial<Record<Exclude<ModelPlatform, "oac">, string>>;
  /** Human-readable display name */
  displayName: string;
}

// ============================================================================
// Model Registry
// ============================================================================

/**
 * Registry of known models with their platform-specific IDs
 */
const MODEL_REGISTRY: ModelInfo[] = [
  // Claude Models
  {
    oacId: "claude-sonnet-4",
    family: "claude",
    displayName: "Claude Sonnet 4",
    platformIds: {
      claude: "claude-sonnet-4-20250514",
      cursor: "claude-sonnet-4",
      windsurf: "claude-4-sonnet",
    },
  },
  {
    oacId: "claude-opus-4",
    family: "claude",
    displayName: "Claude Opus 4",
    platformIds: {
      claude: "claude-opus-4-20250514",
      cursor: "claude-opus-4",
      windsurf: "claude-4-opus",
    },
  },
  {
    oacId: "claude-3.5-sonnet",
    family: "claude",
    displayName: "Claude 3.5 Sonnet",
    platformIds: {
      claude: "claude-3-5-sonnet-20241022",
      cursor: "claude-3.5-sonnet",
      windsurf: "claude-3-5-sonnet",
    },
  },
  {
    oacId: "claude-3-opus",
    family: "claude",
    displayName: "Claude 3 Opus",
    platformIds: {
      claude: "claude-3-opus-20240229",
      cursor: "claude-3-opus",
      windsurf: "claude-3-opus",
    },
  },
  {
    oacId: "claude-3-haiku",
    family: "claude",
    displayName: "Claude 3 Haiku",
    platformIds: {
      claude: "claude-3-haiku-20240307",
      cursor: "claude-3-haiku",
      windsurf: "claude-3-haiku",
    },
  },

  // GPT Models
  {
    oacId: "gpt-4",
    family: "gpt",
    displayName: "GPT-4",
    platformIds: {
      cursor: "gpt-4",
      windsurf: "gpt-4",
    },
  },
  {
    oacId: "gpt-4-turbo",
    family: "gpt",
    displayName: "GPT-4 Turbo",
    platformIds: {
      cursor: "gpt-4-turbo",
      windsurf: "gpt-4-turbo",
    },
  },
  {
    oacId: "gpt-4o",
    family: "gpt",
    displayName: "GPT-4o",
    platformIds: {
      cursor: "gpt-4o",
      windsurf: "gpt-4o",
    },
  },
  {
    oacId: "gpt-4o-mini",
    family: "gpt",
    displayName: "GPT-4o Mini",
    platformIds: {
      cursor: "gpt-4o-mini",
      windsurf: "gpt-4o-mini",
    },
  },

  // Gemini Models
  {
    oacId: "gemini-pro",
    family: "gemini",
    displayName: "Gemini Pro",
    platformIds: {
      cursor: "gemini-pro",
      windsurf: "gemini-pro",
    },
  },
  {
    oacId: "gemini-2.0-flash",
    family: "gemini",
    displayName: "Gemini 2.0 Flash",
    platformIds: {
      cursor: "gemini-2.0-flash",
      windsurf: "gemini-2-flash",
    },
  },
];

// ============================================================================
// Lookup Maps (Built from Registry)
// ============================================================================

/**
 * Build lookup maps for fast bidirectional mapping
 */
function buildLookupMaps(): {
  oacToplatform: Map<string, Map<Exclude<ModelPlatform, "oac">, string>>;
  platformToOac: Map<Exclude<ModelPlatform, "oac">, Map<string, string>>;
} {
  const oacToplatform = new Map<string, Map<Exclude<ModelPlatform, "oac">, string>>();
  const platformToOac = new Map<Exclude<ModelPlatform, "oac">, Map<string, string>>();

  // Initialize platform maps
  const platforms: Exclude<ModelPlatform, "oac">[] = ["claude", "cursor", "windsurf"];
  for (const platform of platforms) {
    platformToOac.set(platform, new Map());
  }

  // Populate maps from registry
  for (const model of MODEL_REGISTRY) {
    const platformMap = new Map<Exclude<ModelPlatform, "oac">, string>();

    for (const [platform, id] of Object.entries(model.platformIds)) {
      const p = platform as Exclude<ModelPlatform, "oac">;
      if (id) {
        platformMap.set(p, id);
        platformToOac.get(p)!.set(id, model.oacId);
      }
    }

    oacToplatform.set(model.oacId, platformMap);
  }

  return { oacToplatform, platformToOac };
}

const { oacToplatform, platformToOac } = buildLookupMaps();

// ============================================================================
// Core Mapping Functions (Pure)
// ============================================================================

/**
 * Map a model ID from OAC format to a target platform format.
 *
 * @param modelId - OAC model ID
 * @param platform - Target platform
 * @returns Mapping result with platform model ID
 */
export function mapModelFromOAC(
  modelId: string,
  platform: Exclude<ModelPlatform, "oac">
): ModelMappingResult {
  const platformMap = oacToplatform.get(modelId);

  if (platformMap) {
    const platformId = platformMap.get(platform);
    if (platformId) {
      return { id: platformId, exact: true };
    }
  }

  // Check if the model ID looks like it's already in platform format
  if (isLikelyPlatformFormat(modelId, platform)) {
    return { id: modelId, exact: true };
  }

  // Fallback: use OAC ID as-is with warning
  return {
    id: modelId,
    exact: false,
    warning: `Unknown model '${modelId}' for ${platform}, using as-is`,
  };
}

/**
 * Map a model ID from a platform format to OAC format.
 *
 * @param modelId - Platform model ID
 * @param platform - Source platform
 * @returns Mapping result with OAC model ID
 */
export function mapModelToOAC(
  modelId: string,
  platform: Exclude<ModelPlatform, "oac">
): ModelMappingResult {
  const oacMap = platformToOac.get(platform);

  if (oacMap) {
    const oacId = oacMap.get(modelId);
    if (oacId) {
      return { id: oacId, exact: true };
    }
  }

  // Try to find by pattern matching
  const guessedId = guessOACModelId(modelId);
  if (guessedId !== modelId) {
    return {
      id: guessedId,
      exact: false,
      warning: `Model '${modelId}' from ${platform} mapped to '${guessedId}' by pattern`,
    };
  }

  // Fallback: use platform ID as-is
  return {
    id: modelId,
    exact: false,
    warning: `Unknown model '${modelId}' from ${platform}, using as-is`,
  };
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Check if a model ID looks like it's in a specific platform's format.
 */
function isLikelyPlatformFormat(
  modelId: string,
  platform: Exclude<ModelPlatform, "oac">
): boolean {
  switch (platform) {
    case "claude":
      // Claude uses date suffixes like "20250514"
      return /claude-.*-\d{8}$/.test(modelId);
    case "cursor":
    case "windsurf":
      // These typically use simpler IDs
      return !/-\d{8}$/.test(modelId);
    default:
      return false;
  }
}

/**
 * Attempt to guess the OAC model ID from a platform-specific ID.
 */
function guessOACModelId(platformId: string): string {
  // Remove date suffixes (Claude format)
  let guessed = platformId.replace(/-\d{8}$/, "");

  // Normalize common variations
  guessed = guessed
    .replace(/^claude-(\d+)-(\d+)-/, "claude-$1.$2-") // claude-3-5 → claude-3.5
    .replace(/^claude-(\d+)-/, "claude-$1-") // keep claude-3- as is
    .replace(/-sonnet$/, "-sonnet") // ensure sonnet suffix
    .replace(/-opus$/, "-opus") // ensure opus suffix
    .replace(/-haiku$/, "-haiku"); // ensure haiku suffix

  return guessed;
}

/**
 * Get the model family for a given model ID.
 *
 * @param modelId - Model ID (OAC or platform format)
 * @returns Model family or 'other' if unknown
 */
export function getModelFamily(modelId: string): ModelFamily {
  const lowerModelId = modelId.toLowerCase();

  if (lowerModelId.includes("claude")) return "claude";
  if (lowerModelId.includes("gpt")) return "gpt";
  if (lowerModelId.includes("gemini")) return "gemini";
  if (lowerModelId.includes("llama")) return "llama";
  if (lowerModelId.includes("mistral")) return "mistral";

  return "other";
}

/**
 * Get model info from the registry by OAC ID.
 *
 * @param oacId - OAC model ID
 * @returns Model info or undefined if not found
 */
export function getModelInfo(oacId: string): ModelInfo | undefined {
  return MODEL_REGISTRY.find((m) => m.oacId === oacId);
}

/**
 * Get all registered models.
 *
 * @returns Array of all model info objects
 */
export function getAllModels(): ModelInfo[] {
  return [...MODEL_REGISTRY];
}

/**
 * Get models available on a specific platform.
 *
 * @param platform - Target platform
 * @returns Array of model info objects available on the platform
 */
export function getModelsForPlatform(
  platform: Exclude<ModelPlatform, "oac">
): ModelInfo[] {
  return MODEL_REGISTRY.filter(
    (m) => m.platformIds[platform] !== undefined
  );
}

/**
 * Check if a model is available on a specific platform.
 *
 * @param modelId - OAC model ID
 * @param platform - Target platform
 * @returns True if the model is available
 */
export function isModelAvailable(
  modelId: string,
  platform: Exclude<ModelPlatform, "oac">
): boolean {
  const platformMap = oacToplatform.get(modelId);
  return platformMap?.has(platform) ?? false;
}

/**
 * Get a default/fallback model for a platform.
 *
 * @param platform - Target platform
 * @returns Default model ID for the platform
 */
export function getDefaultModel(platform: Exclude<ModelPlatform, "oac">): string {
  switch (platform) {
    case "claude":
      return "claude-sonnet-4-20250514";
    case "cursor":
      return "claude-sonnet-4";
    case "windsurf":
      return "claude-4-sonnet";
    default:
      return "claude-sonnet-4";
  }
}
