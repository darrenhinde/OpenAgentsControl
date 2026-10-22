/**
 * Info Command
 *
 * Displays tool capabilities and feature parity matrices for AI coding tools.
 * Helps users understand what features are supported by each platform.
 *
 * @module cli/commands/info
 */

import type { Command } from "commander";
import {
  type GlobalOptions,
  type Platform,
  successResult,
  errorResult,
  type CommandResult,
  PLATFORMS,
  PLATFORM_NAMES,
  isValidPlatform,
} from "../types.js";
import {
  createLoggerConfig,
  logInfo,
  logVerbose,
  printOutput,
  handleError,
  type LoggerConfig,
} from "../utils.js";
import chalk from "chalk";
import type { FeatureDefinition } from "../../core/CapabilityMatrix.js";

// Dynamic import for CapabilityMatrix
const loadCapabilityMatrixModule = async () => {
  const module = await import("../../core/CapabilityMatrix.js");
  return module;
};

// ============================================================================
// TYPES
// ============================================================================

/**
 * Options specific to the info command
 */
interface InfoCommandOptions {
  detailed?: boolean;
  compare?: Platform;
}

/**
 * Platform info data structure
 */
interface PlatformInfo {
  platform: Platform;
  displayName: string;
  capabilities: {
    supportsMultipleAgents: boolean;
    supportsSkills: boolean;
    supportsHooks: boolean;
    supportsGranularPermissions: boolean;
    supportsContexts: boolean;
    supportsCustomModels: boolean;
    supportsTemperature: boolean;
    supportsMaxSteps: boolean;
    configFormat: string;
    outputStructure: string;
  };
  features: FeatureInfo[];
}

/**
 * Feature info for a platform
 */
interface FeatureInfo {
  name: string;
  category: string;
  description: string;
  support: "full" | "partial" | "none";
  note?: string;
}

/**
 * Comparison result between two platforms
 */
interface PlatformComparison {
  platformA: Platform;
  platformB: Platform;
  identical: string[];
  betterInA: string[];
  betterInB: string[];
}

/**
 * Info result data
 */
interface InfoResultData {
  platforms?: PlatformInfo[];
  platform?: PlatformInfo;
  comparison?: PlatformComparison;
}

// ============================================================================
// DOCUMENTATION LINKS
// ============================================================================

const DOCUMENTATION_LINKS: Record<Platform, string> = {
  oac: "https://github.com/OpenAgentsInc/openagents/blob/main/COMPATIBILITY.md",
  cursor: "https://docs.cursor.com/context/rules-for-ai",
  claude: "https://docs.anthropic.com/en/docs/build-with-claude/computer-use",
  windsurf: "https://docs.codeium.com/windsurf/overview",
  openclaw: "https://docs.openclaw.ai/",
};

// ============================================================================
// INFO GENERATION
// ============================================================================

/**
 * Get info for a single platform
 */
const getPlatformInfo = async (platform: Platform): Promise<PlatformInfo> => {
  const capabilityModule = await loadCapabilityMatrixModule();
  const { getCapabilityMatrix, getToolCapabilities } = capabilityModule;

  const matrix = getCapabilityMatrix();

  // Get capabilities (only for non-oac platforms)
  let capabilities: PlatformInfo["capabilities"];
  if (platform === "oac") {
    capabilities = {
      supportsMultipleAgents: true,
      supportsSkills: true,
      supportsHooks: true,
      supportsGranularPermissions: true,
      supportsContexts: true,
      supportsCustomModels: true,
      supportsTemperature: true,
      supportsMaxSteps: true,
      configFormat: "markdown",
      outputStructure: "directory",
    };
  } else {
    const toolCaps = getToolCapabilities(platform);
    capabilities = {
      supportsMultipleAgents: toolCaps.supportsMultipleAgents,
      supportsSkills: toolCaps.supportsSkills,
      supportsHooks: toolCaps.supportsHooks,
      supportsGranularPermissions: toolCaps.supportsGranularPermissions,
      supportsContexts: toolCaps.supportsContexts,
      supportsCustomModels: toolCaps.supportsCustomModels,
      supportsTemperature: toolCaps.supportsTemperature,
      supportsMaxSteps: toolCaps.supportsMaxSteps,
      configFormat: toolCaps.configFormat,
      outputStructure: toolCaps.outputStructure,
    };
  }

  // Get feature details
  const features: FeatureInfo[] = matrix.map((feature: FeatureDefinition) => ({
    name: feature.name,
    category: feature.category,
    description: feature.description,
    support: feature.support[platform],
    note: feature.notes?.[platform],
  }));

  return {
    platform,
    displayName: PLATFORM_NAMES[platform],
    capabilities,
    features,
  };
};

/**
 * Compare two platforms
 */
const comparePlatformsInfo = async (
  platformA: Platform,
  platformB: Platform
): Promise<PlatformComparison> => {
  const capabilityModule = await loadCapabilityMatrixModule();
  const comparison = capabilityModule.comparePlatforms(platformA, platformB);

  return {
    platformA,
    platformB,
    identical: comparison.identical,
    betterInA: comparison.betterInA,
    betterInB: comparison.betterInB,
  };
};

// ============================================================================
// TEXT FORMATTING
// ============================================================================

/**
 * Format support level for display
 */
const formatSupport = (support: "full" | "partial" | "none"): string => {
  switch (support) {
    case "full":
      return chalk.green("✓ Full");
    case "partial":
      return chalk.yellow("◐ Partial");
    case "none":
      return chalk.red("✗ None");
  }
};

/**
 * Format capability value for display
 */
const formatCapability = (value: boolean): string => {
  return value ? chalk.green("✓") : chalk.red("✗");
};

/**
 * Print feature matrix for all platforms
 */
const printFeatureMatrix = async (config: LoggerConfig): Promise<void> => {
  const capabilityModule = await loadCapabilityMatrixModule();
  const matrix = capabilityModule.getCapabilityMatrix();

  logInfo(config, "");
  logInfo(config, chalk.bold.cyan("═══ Feature Compatibility Matrix ═══"));
  logInfo(config, "");

  // Header
  const platforms: Platform[] = ["oac", "cursor", "claude", "windsurf"];
  const header =
    chalk.bold("Feature".padEnd(25)) +
    platforms.map((p) => chalk.bold(p.padStart(10))).join("");
  logInfo(config, header);
  logInfo(config, "─".repeat(65));

  // Group by category
  const categories = ["agents", "permissions", "tools", "context", "model", "advanced"];

  for (const category of categories) {
    logInfo(config, chalk.dim.bold(`\n${category.toUpperCase()}`));

    const categoryFeatures = matrix.filter((f) => f.category === category);
    for (const feature of categoryFeatures) {
      const name = feature.name.padEnd(25);
      const supports = platforms
        .map((p) => {
          const level = feature.support[p];
          const icon =
            level === "full"
              ? chalk.green("✓")
              : level === "partial"
                ? chalk.yellow("◐")
                : chalk.red("✗");
          return icon.padStart(10);
        })
        .join("");
      logInfo(config, `${name}${supports}`);
    }
  }

  logInfo(config, "");
  logInfo(config, chalk.dim("Legend: ✓ Full support | ◐ Partial support | ✗ Not supported"));
  logInfo(config, "");

  // Documentation links
  logInfo(config, chalk.bold("Documentation:"));
  for (const platform of platforms) {
    logInfo(
      config,
      `  ${chalk.cyan(platform.padEnd(10))} ${DOCUMENTATION_LINKS[platform]}`
    );
  }
};

/**
 * Print detailed info for a single platform
 */
const printPlatformDetail = (
  config: LoggerConfig,
  info: PlatformInfo
): void => {
  logInfo(config, "");
  logInfo(config, chalk.bold.cyan(`═══ ${info.displayName} (${info.platform}) ═══`));
  logInfo(config, "");

  // Capabilities summary
  logInfo(config, chalk.bold("Capabilities:"));
  logInfo(
    config,
    `  Multiple Agents:      ${formatCapability(info.capabilities.supportsMultipleAgents)}`
  );
  logInfo(
    config,
    `  Skills System:        ${formatCapability(info.capabilities.supportsSkills)}`
  );
  logInfo(
    config,
    `  Event Hooks:          ${formatCapability(info.capabilities.supportsHooks)}`
  );
  logInfo(
    config,
    `  Granular Permissions: ${formatCapability(info.capabilities.supportsGranularPermissions)}`
  );
  logInfo(
    config,
    `  External Contexts:    ${formatCapability(info.capabilities.supportsContexts)}`
  );
  logInfo(
    config,
    `  Custom Models:        ${formatCapability(info.capabilities.supportsCustomModels)}`
  );
  logInfo(
    config,
    `  Temperature Control:  ${formatCapability(info.capabilities.supportsTemperature)}`
  );
  logInfo(
    config,
    `  Max Steps Limit:      ${formatCapability(info.capabilities.supportsMaxSteps)}`
  );
  logInfo(config, "");
  logInfo(config, `  Config Format:        ${chalk.cyan(info.capabilities.configFormat)}`);
  logInfo(config, `  Output Structure:     ${chalk.cyan(info.capabilities.outputStructure)}`);
  logInfo(config, "");

  // Feature details by category
  logInfo(config, chalk.bold("Feature Support:"));

  const categories = ["agents", "permissions", "tools", "context", "model", "advanced"];
  for (const category of categories) {
    const categoryFeatures = info.features.filter((f) => f.category === category);
    if (categoryFeatures.length === 0) continue;

    logInfo(config, chalk.dim.bold(`\n  ${category.toUpperCase()}`));
    for (const feature of categoryFeatures) {
      const support = formatSupport(feature.support);
      logInfo(config, `    ${feature.name.padEnd(22)} ${support}`);
      if (feature.note) {
        logInfo(config, chalk.dim(`      └─ ${feature.note}`));
      }
    }
  }

  logInfo(config, "");
  logInfo(config, chalk.bold("Documentation:"));
  logInfo(config, `  ${DOCUMENTATION_LINKS[info.platform]}`);
};

/**
 * Print platform comparison
 */
const printComparison = (
  config: LoggerConfig,
  comparison: PlatformComparison,
  infoA: PlatformInfo,
  infoB: PlatformInfo
): void => {
  logInfo(config, "");
  logInfo(
    config,
    chalk.bold.cyan(
      `═══ Comparison: ${infoA.displayName} vs ${infoB.displayName} ═══`
    )
  );
  logInfo(config, "");

  // Summary stats
  const total =
    comparison.identical.length +
    comparison.betterInA.length +
    comparison.betterInB.length;
  logInfo(
    config,
    `Features compared: ${chalk.bold(total.toString())}`
  );
  logInfo(
    config,
    `  Identical:     ${chalk.green(comparison.identical.length.toString())} features`
  );
  logInfo(
    config,
    `  Better in ${comparison.platformA}:  ${chalk.cyan(comparison.betterInA.length.toString())} features`
  );
  logInfo(
    config,
    `  Better in ${comparison.platformB}: ${chalk.cyan(comparison.betterInB.length.toString())} features`
  );
  logInfo(config, "");

  // Better in A
  if (comparison.betterInA.length > 0) {
    logInfo(
      config,
      chalk.bold(`Better in ${infoA.displayName}:`)
    );
    for (const feature of comparison.betterInA) {
      logInfo(config, `  ${chalk.cyan("→")} ${feature}`);
    }
    logInfo(config, "");
  }

  // Better in B
  if (comparison.betterInB.length > 0) {
    logInfo(
      config,
      chalk.bold(`Better in ${infoB.displayName}:`)
    );
    for (const feature of comparison.betterInB) {
      logInfo(config, `  ${chalk.cyan("→")} ${feature}`);
    }
    logInfo(config, "");
  }

  // Identical features
  if (comparison.identical.length > 0) {
    logInfo(config, chalk.bold("Identical support:"));
    logInfo(config, `  ${chalk.dim(comparison.identical.join(", "))}`);
  }
};

// ============================================================================
// COMMAND HANDLER
// ============================================================================

/**
 * Execute the info command
 */
export const executeInfo = async (
  platform: string | undefined,
  options: InfoCommandOptions,
  globalOptions: GlobalOptions
): Promise<CommandResult<InfoResultData>> => {
  const config = createLoggerConfig(globalOptions);

  try {
    // If no platform specified, show feature matrix
    if (!platform) {
      logVerbose(config, "Showing feature matrix for all platforms");

      // For text output, print the matrix
      if (globalOptions.outputFormat !== "json") {
        await printFeatureMatrix(config);
      }

      // For JSON, return all platform info
      const platforms: PlatformInfo[] = [];
      for (const p of PLATFORMS) {
        platforms.push(await getPlatformInfo(p));
      }

      return successResult({ platforms });
    }

    // Validate platform
    if (!isValidPlatform(platform)) {
      return errorResult(
        `Unknown platform: ${platform}. Valid platforms: ${PLATFORMS.join(", ")}`
      );
    }

    // Get platform info
    const info = await getPlatformInfo(platform);
    logVerbose(config, `Getting info for: ${info.displayName}`);

    // Handle comparison
    if (options.compare) {
      if (!isValidPlatform(options.compare)) {
        const comparePlatform = String(options.compare);
        return errorResult(
          `Unknown platform for comparison: ${comparePlatform}. Valid platforms: ${PLATFORMS.join(", ")}`
        );
      }

      const compareInfo = await getPlatformInfo(options.compare);
      const comparison = await comparePlatformsInfo(platform, options.compare);

      if (globalOptions.outputFormat !== "json") {
        printComparison(config, comparison, info, compareInfo);
      }

      return successResult({
        platform: info,
        comparison,
      });
    }

    // Print detailed platform info
    if (globalOptions.outputFormat !== "json") {
      printPlatformDetail(config, info);
    }

    return successResult({ platform: info });
  } catch (err) {
    return handleError(config, err);
  }
};

/**
 * Create the info command action handler
 */
export const createInfoAction = (): ((
  platform: string | undefined,
  options: InfoCommandOptions,
  command: Command
  ) => Promise<void>) => {
  return async (
    platform: string | undefined,
    options: InfoCommandOptions,
    command: Command
  ): Promise<void> => {
    const globalOptions = command.optsWithGlobals() as unknown as GlobalOptions;
    const result = await executeInfo(platform, options, globalOptions);

    // Print JSON output if requested
    if (globalOptions.outputFormat === "json") {
      printOutput(createLoggerConfig(globalOptions), result);
    }

    if (!result.success) {
      process.exit(1);
    }
  };
};
