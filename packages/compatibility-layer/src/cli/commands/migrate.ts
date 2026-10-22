/**
 * Migrate Command
 *
 * Migrates entire projects between different AI coding tool formats.
 * Discovers all agent files in a directory and converts them to the target format.
 *
 * @module cli/commands/migrate
 */

import { readFile, writeFile, mkdir, readdir, stat, access } from "fs/promises";
import { dirname, basename, extname, resolve, join, relative } from "path";
import type { Command } from "commander";
import type { OpenAgent, ConversionResult } from "../../types.js";
import {
  type GlobalOptions,
  type Platform,
  successResult,
  errorResult,
  type CommandResult,
} from "../types.js";
import {
  createLoggerConfig,
  logInfo,
  logSuccess,
  logWarning,
  logVerbose,
  logError,
  createSpinner,
  spinnerSuccess,
  spinnerFail,
  spinnerWarn,
  printOutput,
  handleError,
  type LoggerConfig,
} from "../utils.js";

// Dynamic imports to avoid ESM resolution issues at startup
const getAgentLoader = async () => {
  const module = await import("../../core/AgentLoader.js");
  return module;
};

const getAdapterRegistry = async () => {
  const module = await import("../../core/AdapterRegistry.js");
  // Ensure built-in adapters are registered
  await module.registry.registerBuiltInAdapters();
  return module;
};

// ============================================================================
// TYPES
// ============================================================================

/**
 * Options specific to the migrate command
 */
interface MigrateCommandOptions {
  format: Platform;
  outDir?: string;
  dryRun?: boolean;
  force?: boolean;
}

/**
 * Status of a single migrated file
 */
type MigratedFileStatus = "success" | "failed" | "skipped";

/**
 * Information about a single migrated file
 */
interface MigratedFile {
  source: string;
  destination: string;
  status: MigratedFileStatus;
  warnings?: string[];
  error?: string;
}

/**
 * Complete migration report
 */
interface MigrationReport {
  total: number;
  successful: number;
  failed: number;
  skipped: number;
  warnings: string[];
  files: MigratedFile[];
}

/**
 * Detected format information
 */
interface FormatDetection {
  format: Platform;
  confidence: "high" | "medium" | "low";
  reason: string;
}

/**
 * Discovered agent file with its detected format
 */
interface DiscoveredFile {
  path: string;
  relativePath: string;
  detectedFormat: FormatDetection;
}

// ============================================================================
// FORMAT DETECTION (reused from convert.ts pattern)
// ============================================================================

interface ParsedConfig {
  cascadeConfig?: unknown;
  creativity?: unknown;
  permissions?: unknown;
  skills?: unknown;
}

/**
 * Detect the format of an input file based on path and content
 */
const detectInputFormat = (
  filePath: string,
  content: string
): FormatDetection => {
  const fileName = basename(filePath).toLowerCase();
  const ext = extname(filePath).toLowerCase();

  // Check file name patterns
  if (fileName === ".cursorrules" || fileName === "cursorrules") {
    return { format: "cursor", confidence: "high", reason: "File name .cursorrules" };
  }

  if (fileName.includes("windsurf") || filePath.includes(".windsurf/")) {
    return { format: "windsurf", confidence: "high", reason: "Windsurf path pattern" };
  }

  if (filePath.includes(".claude/") || fileName.includes("claude")) {
    return { format: "claude", confidence: "high", reason: "Claude path pattern" };
  }

  if (filePath.includes(".opencode/") || filePath.includes("openagent")) {
    return { format: "oac", confidence: "high", reason: "OAC path pattern" };
  }

  // Check content patterns
  if (ext === ".md") {
    // Check for OAC frontmatter
    if (content.startsWith("---")) {
      const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
      if (frontmatterMatch?.[1]) {
        const frontmatter = frontmatterMatch[1];
        if (frontmatter.includes("mode:") || frontmatter.includes("tools:")) {
          return { format: "oac", confidence: "high", reason: "OAC frontmatter detected" };
        }
      }
    }
    // Default markdown to OAC
    return { format: "oac", confidence: "medium", reason: "Markdown file (assuming OAC)" };
  }

  if (ext === ".json") {
    try {
      const parsed = JSON.parse(content) as ParsedConfig;
      if (parsed.cascadeConfig || parsed.creativity !== undefined) {
        return { format: "windsurf", confidence: "high", reason: "Windsurf JSON structure" };
      }
      if (parsed.permissions || parsed.skills) {
        return { format: "claude", confidence: "high", reason: "Claude JSON structure" };
      }
    } catch {
      // Not valid JSON
    }
    return { format: "oac", confidence: "low", reason: "JSON file (format unclear)" };
  }

  // Plain text - likely cursor
  if (ext === ".txt" || ext === "") {
    return { format: "cursor", confidence: "medium", reason: "Plain text (assuming Cursor)" };
  }

  return { format: "oac", confidence: "low", reason: "Unknown format (defaulting to OAC)" };
};

// ============================================================================
// FILE DISCOVERY
// ============================================================================

/**
 * Supported file extensions for agent files
 */
const AGENT_FILE_EXTENSIONS = new Set([".md", ".json", ".txt", ""]);

/**
 * Check if a file might be an agent configuration file
 */
const isAgentFile = (fileName: string): boolean => {
  const ext = extname(fileName).toLowerCase();
  const baseName = basename(fileName).toLowerCase();

  // Always include specific agent file names
  if (baseName === ".cursorrules" || baseName === "cursorrules") {
    return true;
  }

  // Skip OAC category index metadata (0-category.json — directory listing, not an agent)
  if (baseName === "0-category.json") {
    return false;
  }

  return AGENT_FILE_EXTENSIONS.has(ext);
};

/**
 * Recursively discover all agent files in a directory
 */
const discoverAgentFiles = async (
  sourceDir: string,
  config: LoggerConfig
): Promise<DiscoveredFile[]> => {
  const discovered: DiscoveredFile[] = [];
  
  const scanDirectory = async (currentPath: string): Promise<void> => {
    const entries = await readdir(currentPath, { withFileTypes: true });
    
     for (const entry of entries) {
       const fullPath = join(currentPath, entry.name);
       
       // Skip hidden directories (except .opencode, .claude, .windsurf)
       if (entry.isDirectory()) {
         const dirName = entry.name.toLowerCase();
         if (dirName.startsWith(".") && 
             !["opencode", "claude", "windsurf"].some(d => dirName.includes(d))) {
           continue;
         }
         await scanDirectory(fullPath);
       } else if (entry.isFile() && isAgentFile(entry.name)) {
         try {
           const content = await readFile(fullPath, "utf-8");
           const detectedFormat = detectInputFormat(fullPath, content);
           
           discovered.push({
             path: fullPath,
            relativePath: relative(sourceDir, fullPath),
            detectedFormat,
          });
          
          logVerbose(config, `Found: ${relative(sourceDir, fullPath)} (${detectedFormat.format})`);
        } catch (err) {
          logVerbose(config, `Skipping unreadable file: ${fullPath}`);
        }
      }
    }
  };
  
  await scanDirectory(sourceDir);
  return discovered;
};

// ============================================================================
// CONVERSION LOGIC
// ============================================================================

/**
 * Load an agent from any supported format
 */
const loadAgentFromFormat = async (
  filePath: string,
  content: string,
  format: Platform,
  config: LoggerConfig
): Promise<OpenAgent> => {
  logVerbose(config, `Loading agent from ${format} format`);

  if (format === "oac") {
    // Use AgentLoader for OAC format
    const { loadAgent } = await getAgentLoader();
    return await loadAgent(filePath);
  }

  // Use appropriate adapter for other formats
  const { getAdapter } = await getAdapterRegistry();
  const adapter = getAdapter(format);
  if (!adapter) {
    throw new Error(`No adapter found for format: ${format}`);
  }
  return await adapter.toOAC(content);
};

/**
 * Convert an agent to the target format
 */
const convertToFormat = async (
  agent: OpenAgent,
  targetFormat: Platform,
  config: LoggerConfig
): Promise<ConversionResult> => {
  logVerbose(config, `Converting to ${targetFormat} format`);

  if (targetFormat === "oac") {
    // Converting TO OAC - just serialize the agent
    const content = serializeOACAgent(agent);
    return {
      success: true,
      configs: [
        {
          fileName: `${agent.frontmatter.name || "agent"}.md`,
          content,
          encoding: "utf-8",
        },
      ],
      warnings: [],
    };
  }

  // Use adapter for other formats
  const { getAdapter } = await getAdapterRegistry();
  const adapter = getAdapter(targetFormat);
  if (!adapter) {
    throw new Error(`No adapter found for format: ${targetFormat}`);
  }
  return await adapter.fromOAC(agent);
};

/**
 * Serialize an OpenAgent to OAC markdown format
 */
const serializeOACAgent = (agent: OpenAgent): string => {
  const lines: string[] = ["---"];

  // Serialize frontmatter
  const fm = agent.frontmatter;
  lines.push(`name: "${fm.name}"`);
  if (fm.description) lines.push(`description: "${fm.description}"`);
  lines.push(`mode: ${fm.mode}`);
  if (fm.model) lines.push(`model: ${fm.model}`);
  if (fm.temperature !== undefined) lines.push(`temperature: ${fm.temperature}`);

  // Tools
  if (fm.tools) {
    lines.push("tools:");
    for (const [tool, access] of Object.entries(fm.tools)) {
      const accessValue = access as boolean | string;
      if (typeof accessValue === "boolean") {
        lines.push(`  ${tool}: ${String(accessValue)}`);
      } else {
        lines.push(`  ${tool}: "${String(accessValue)}"`);
      }
    }
  }

  lines.push("---");
  lines.push("");
  lines.push(agent.systemPrompt);

  return lines.join("\n");
};

/**
 * Determine output path for a migrated file
 */
const getOutputPath = (
  relativePath: string,
  outputDir: string,
  result: ConversionResult
): string => {
  const baseName = basename(relativePath, extname(relativePath));
  const primaryConfig = result.configs[0];
  const outputFileName = primaryConfig?.fileName || `${baseName}.md`;
  
  // Preserve directory structure
  const relativeDir = dirname(relativePath);
  const targetDir = relativeDir === "." ? outputDir : join(outputDir, relativeDir);
  
  return join(targetDir, outputFileName);
};

/**
 * Check if file exists
 */
const fileExists = async (filePath: string): Promise<boolean> => {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
};

// ============================================================================
// SINGLE FILE MIGRATION
// ============================================================================

/**
 * Migrate a single file to the target format
 */
const migrateFile = async (
  file: DiscoveredFile,
  targetFormat: Platform,
  outputDir: string,
  options: { dryRun: boolean; force: boolean },
  config: LoggerConfig
): Promise<MigratedFile> => {
  const { path: sourcePath, relativePath, detectedFormat } = file;
  
  // Skip if source and target format are the same
  if (detectedFormat.format === targetFormat) {
    return {
      source: relativePath,
      destination: "",
      status: "skipped",
      warnings: [`Already in ${targetFormat} format`],
    };
  }
  
  try {
    // Read source file
    const content = await readFile(sourcePath, "utf-8");
    
    // Load agent from source format
    const agent = await loadAgentFromFormat(
      sourcePath,
      content,
      detectedFormat.format,
      config
    );
    
    // Convert to target format
    const result = await convertToFormat(agent, targetFormat, config);
    
    if (!result.success) {
      return {
        source: relativePath,
        destination: "",
        status: "failed",
        error: result.errors?.join(", ") || "Unknown conversion error",
        warnings: result.warnings,
      };
    }
    
    // Determine output path
    const outputPath = getOutputPath(relativePath, outputDir, result);
    const relativeOutputPath = relative(outputDir, outputPath);
    
    // Check if output file exists
    if (!options.force && await fileExists(outputPath)) {
      return {
        source: relativePath,
        destination: relativeOutputPath,
        status: "skipped",
        warnings: ["Output file already exists (use --force to overwrite)"],
      };
    }
    
    // Write output (unless dry run)
    if (!options.dryRun) {
      const dir = dirname(outputPath);
      await mkdir(dir, { recursive: true });
      
      const primaryConfig = result.configs[0];
      if (primaryConfig) {
        await writeFile(outputPath, primaryConfig.content, "utf-8");
      }
      
      // Write additional files if present.
      // Additional config paths are relative to the source file's directory
      // (targetDir), matching the primary config's output location. Joining
      // them to dirname(outputPath) would nest them inside the primary
      // config's own subdirectory (e.g. `.openclaw/agents/.openclaw/...`),
      // producing wrong paths like `.openclaw/agents/.openclaw/permission-index.json`.
      const relativeDir = dirname(relativePath);
      const targetDir = relativeDir === "." ? outputDir : join(outputDir, relativeDir);

      for (let i = 1; i < result.configs.length; i++) {
        const additionalConfig = result.configs[i];
        if (additionalConfig) {
          const additionalPath = join(targetDir, additionalConfig.fileName);
          await mkdir(dirname(additionalPath), { recursive: true });
          await writeFile(additionalPath, additionalConfig.content, "utf-8");
        }
      }
    }
    
    return {
      source: relativePath,
      destination: relativeOutputPath,
      status: "success",
      warnings: result.warnings.length > 0 ? result.warnings : undefined,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      source: relativePath,
      destination: "",
      status: "failed",
      error: message,
    };
  }
};

// ============================================================================
// REPORT GENERATION
// ============================================================================

/**
 * Create initial empty migration report
 */
const createEmptyReport = (): MigrationReport => ({
  total: 0,
  successful: 0,
  failed: 0,
  skipped: 0,
  warnings: [],
  files: [],
});

/**
 * Aggregate migration results into a report
 */
const aggregateResults = (files: MigratedFile[]): MigrationReport => {
  const report = createEmptyReport();
  report.total = files.length;
  report.files = files;
  
  for (const file of files) {
    switch (file.status) {
      case "success":
        report.successful++;
        break;
      case "failed":
        report.failed++;
        break;
      case "skipped":
        report.skipped++;
        break;
    }
    
    // Collect warnings
    if (file.warnings) {
      for (const warning of file.warnings) {
        report.warnings.push(`${file.source}: ${warning}`);
      }
    }
    
    // Collect errors as warnings too for summary
    if (file.error) {
      report.warnings.push(`${file.source}: ${file.error}`);
    }
  }
  
  return report;
};

/**
 * Print migration report to console
 */
const printReport = (
  report: MigrationReport,
  config: LoggerConfig,
  dryRun: boolean
): void => {
  const prefix = dryRun ? "[DRY RUN] " : "";
  
  logInfo(config, "");
  logInfo(config, `${prefix}Migration Summary:`);
  logInfo(config, `  Total files:  ${report.total}`);
  logSuccess(config, `Successful:   ${report.successful}`);
  
  if (report.skipped > 0) {
    logWarning(config, `Skipped:      ${report.skipped}`);
  }
  
  if (report.failed > 0) {
    logError(config, `Failed:       ${report.failed}`);
  }
  
  // Show file details
  if (config.verbose || report.failed > 0) {
    logInfo(config, "");
    logInfo(config, "File Details:");
    
    for (const file of report.files) {
      const statusIcon = getStatusIcon(file.status);
      const destination = file.destination ? ` -> ${file.destination}` : "";
      logInfo(config, `  ${statusIcon} ${file.source}${destination}`);
      
      if (file.error) {
        logError(config, `     Error: ${file.error}`);
      }
    }
  }
  
  // Show warnings summary
  if (report.warnings.length > 0 && config.verbose) {
    logInfo(config, "");
    logWarning(config, `${report.warnings.length} warning(s) occurred during migration`);
  }
};

/**
 * Get status icon for display
 */
const getStatusIcon = (status: MigratedFileStatus): string => {
  switch (status) {
    case "success":
      return "\u2713"; // checkmark
    case "failed":
      return "\u2717"; // X mark
    case "skipped":
      return "-";
  }
};

// ============================================================================
// COMMAND HANDLER
// ============================================================================

/**
 * Execute the migrate command
 */
export const executeMigrate = async (
  sourceDir: string,
  options: MigrateCommandOptions,
  globalOptions: GlobalOptions
): Promise<CommandResult<MigrationReport>> => {
  const config = createLoggerConfig(globalOptions);
  
  try {
    // Validate source directory exists
    try {
      const stats = await stat(sourceDir);
      if (!stats.isDirectory()) {
        return errorResult(`Source path is not a directory: ${sourceDir}`);
      }
    } catch {
      return errorResult(`Source directory not found: ${sourceDir}`);
    }
    
    // Determine output directory
    const outputDir = options.outDir 
      ? resolve(options.outDir) 
      : resolve(sourceDir, `migrated-${options.format}`);
    
    logVerbose(config, `Source directory: ${sourceDir}`);
    logVerbose(config, `Output directory: ${outputDir}`);
    logVerbose(config, `Target format: ${options.format}`);
    if (options.dryRun) {
      logInfo(config, "Dry run mode - no files will be written");
    }
    
    // Discover agent files
    const discoverySpinner = createSpinner(config, "Discovering agent files...");
    const discoveredFiles = await discoverAgentFiles(sourceDir, config);
    
    if (discoveredFiles.length === 0) {
      spinnerWarn(discoverySpinner, "No agent files found");
      const emptyReport = createEmptyReport();
      emptyReport.warnings = ["No agent files found in source directory"];
      return successResult(emptyReport, ["No agent files found in source directory"]);
    }
    
    spinnerSuccess(discoverySpinner, `Found ${discoveredFiles.length} agent file(s)`);
    
    // Create output directory (unless dry run)
    if (!options.dryRun) {
      await mkdir(outputDir, { recursive: true });
    }
    
    // Migrate files
    const migrationSpinner = createSpinner(
      config,
      `Migrating ${discoveredFiles.length} file(s) to ${options.format}...`
    );
    
    const migratedFiles: MigratedFile[] = [];
    
    for (const file of discoveredFiles) {
      const result = await migrateFile(
        file,
        options.format,
        outputDir,
        {
          dryRun: options.dryRun ?? false,
          force: options.force ?? false,
        },
        config
      );
      migratedFiles.push(result);
    }
    
    // Generate report
    const report = aggregateResults(migratedFiles);
    
    // Update spinner based on results
    if (report.failed > 0) {
      spinnerFail(migrationSpinner, `Migration completed with ${report.failed} error(s)`);
    } else if (report.skipped === report.total) {
      spinnerWarn(migrationSpinner, "All files skipped");
    } else {
      spinnerSuccess(
        migrationSpinner,
        options.dryRun
          ? `Would migrate ${report.successful} file(s)`
          : `Migrated ${report.successful} file(s)`
      );
    }
    
    // Print report
    printReport(report, config, options.dryRun ?? false);
    
    // Return result
    const hasErrors = report.failed > 0;
    return hasErrors
      ? errorResult(`Migration completed with ${report.failed} error(s)`, report.warnings)
      : successResult(report, report.warnings.length > 0 ? report.warnings : undefined);
  } catch (err) {
    return handleError(config, err);
  }
};

/**
 * Create the migrate command action handler
 */
export const createMigrateAction = (): ((
  source: string,
  options: MigrateCommandOptions,
  command: Command
) => Promise<void>) => {
  return async (
    source: string,
    options: MigrateCommandOptions,
    command: Command
  ): Promise<void> => {
    const globalOptions = command.optsWithGlobals() as unknown as GlobalOptions;
    const result = await executeMigrate(source, options, globalOptions);

    if (globalOptions.outputFormat === "json") {
      printOutput(createLoggerConfig(globalOptions), result);
    }

    if (!result.success) {
      process.exit(1);
    }
  };
};
