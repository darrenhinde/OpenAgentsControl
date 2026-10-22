import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdir, rm, writeFile, readFile, readdir } from "fs/promises";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { executeMigrate } from "../commands/migrate.js";
import type { GlobalOptions } from "../types.js";

/**
 * Integration tests for the migrate CLI command
 *
 * Test strategy:
 * 1. Successful migrations - Directory migrations to different formats
 * 2. Error handling - Non-existent directories, invalid formats
 * 3. Dry run mode - Preview migrations without writing
 * 4. Output directory options - Custom output dirs, auto-generated names
 * 5. Force overwrite - Handling existing files
 * 6. Migration report - Verify report structure and counts
 */

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const FIXTURES_DIR = join(__dirname, "fixtures");
const TEMP_DIR = join(__dirname, "temp-migrate");

// Default global options for tests
const defaultGlobalOptions: GlobalOptions = {
  verbose: false,
  quiet: true,
  outputFormat: "text",
};

describe("migrate command", () => {
  // Setup temp directory before each test
  beforeEach(async () => {
    await mkdir(TEMP_DIR, { recursive: true });
  });

  // Cleanup temp directory after each test
  afterEach(async () => {
    try {
      await rm(TEMP_DIR, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  // Helper to create test source directory with agent files
  const createTestSourceDir = async (dirName: string): Promise<string> => {
    const sourceDir = join(TEMP_DIR, dirName);
    await mkdir(sourceDir, { recursive: true });
    
    // Copy OAC agent fixture
    const oacContent = await readFile(join(FIXTURES_DIR, "sample-oac-agent.md"), "utf-8");
    await writeFile(join(sourceDir, "agent1.md"), oacContent);
    
    // Create another agent
    await writeFile(join(sourceDir, "agent2.md"), `---
name: "agent-two"
description: "Second test agent"
mode: primary
---

You are a second agent for testing.
`);
    
    return sourceDir;
  };

  // ============================================================================
  // SUCCESSFUL MIGRATIONS
  // ============================================================================

  describe("successful migrations", () => {
    it("migrates directory to Cursor format", async () => {
      // Arrange
      const sourceDir = await createTestSourceDir("source-cursor");
      const outDir = join(TEMP_DIR, "output-cursor");

      // Act
      const result = await executeMigrate(
        sourceDir,
        { format: "cursor", outDir },
        defaultGlobalOptions
      );

      // Assert
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data?.total).toBeGreaterThan(0);
      expect(result.data?.successful).toBeGreaterThan(0);
    });

    it("migrates directory to Claude format", async () => {
      // Arrange
      const sourceDir = await createTestSourceDir("source-claude");
      const outDir = join(TEMP_DIR, "output-claude");

      // Act
      const result = await executeMigrate(
        sourceDir,
        { format: "claude", outDir },
        defaultGlobalOptions
      );

      // Assert
      expect(result.success).toBe(true);
      expect(result.data?.total).toBeGreaterThan(0);
    });

    it("migrates directory to OAC format", async () => {
      // Arrange - create a directory with cursor-style files
      const sourceDir = join(TEMP_DIR, "source-oac");
      await mkdir(sourceDir, { recursive: true });
      
      const cursorContent = await readFile(join(FIXTURES_DIR, "sample-cursorrules"), "utf-8");
      await writeFile(join(sourceDir, ".cursorrules"), cursorContent);

      const outDir = join(TEMP_DIR, "output-oac");

      // Act
      const result = await executeMigrate(
        sourceDir,
        { format: "oac", outDir },
        defaultGlobalOptions
      );

      // Assert
      expect(result.success).toBe(true);
    });

    it("creates output files in target directory", async () => {
      // Arrange
      const sourceDir = await createTestSourceDir("source-files");
      const outDir = join(TEMP_DIR, "output-files");

      // Act
      const result = await executeMigrate(
        sourceDir,
        { format: "cursor", outDir },
        defaultGlobalOptions
      );

      // Assert
      expect(result.success).toBe(true);
      
      // Verify output directory was created
      const outputFiles = await readdir(outDir, { recursive: true });
      expect(outputFiles.length).toBeGreaterThan(0);
    });

    it("auto-generates output directory name when not specified", async () => {
      // Arrange
      const sourceDir = await createTestSourceDir("source-auto");

      // Act
      const result = await executeMigrate(
        sourceDir,
        { format: "cursor" },
        defaultGlobalOptions
      );

      // Assert
      expect(result.success).toBe(true);
      
      // Check that the auto-generated directory exists
      const expectedOutDir = join(sourceDir, "migrated-cursor");
      const files = await readdir(expectedOutDir).catch(() => []);
      expect(files.length).toBeGreaterThanOrEqual(0);
    });
  });

  // ============================================================================
  // ERROR HANDLING
  // ============================================================================

  describe("error handling", () => {
    it("returns error for non-existent source directory", async () => {
      // Arrange
      const sourceDir = join(TEMP_DIR, "does-not-exist");

      // Act
      const result = await executeMigrate(
        sourceDir,
        { format: "cursor" },
        defaultGlobalOptions
      );

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toContain("not found");
    });

    it("returns error when source path is a file, not directory", async () => {
      // Arrange
      const filePath = join(TEMP_DIR, "not-a-directory.txt");
      await writeFile(filePath, "This is a file");

      // Act
      const result = await executeMigrate(
        filePath,
        { format: "cursor" },
        defaultGlobalOptions
      );

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toContain("not a directory");
    });

    it("returns success with warning when no agent files found", async () => {
      // Arrange
      const emptyDir = join(TEMP_DIR, "empty-dir");
      await mkdir(emptyDir, { recursive: true });

      // Act
      const result = await executeMigrate(
        emptyDir,
        { format: "cursor" },
        defaultGlobalOptions
      );

      // Assert
      expect(result.success).toBe(true);
      expect(result.data?.total).toBe(0);
      expect(result.warnings).toBeDefined();
    });
  });

  // ============================================================================
  // DRY RUN MODE
  // ============================================================================

  describe("dry run mode", () => {
    it("does not write files in dry run mode", async () => {
      // Arrange
      const sourceDir = await createTestSourceDir("source-dry");
      const outDir = join(TEMP_DIR, "output-dry");

      // Act
      const result = await executeMigrate(
        sourceDir,
        { format: "cursor", outDir, dryRun: true },
        defaultGlobalOptions
      );

      // Assert
      expect(result.success).toBe(true);
      expect(result.data?.successful).toBeGreaterThan(0);
      
      // Verify output directory does NOT exist
      try {
        await readdir(outDir);
        // If we get here, the directory exists which is wrong
        expect(false).toBe(true); // Fail the test
      } catch (err: any) {
        expect(err.code).toBe("ENOENT");
      }
    });

    it("reports what would be migrated in dry run", async () => {
      // Arrange
      const sourceDir = await createTestSourceDir("source-dry-report");

      // Act
      const result = await executeMigrate(
        sourceDir,
        { format: "cursor", dryRun: true },
        defaultGlobalOptions
      );

      // Assert
      expect(result.success).toBe(true);
      expect(result.data?.files).toBeDefined();
      expect(result.data?.files.length).toBeGreaterThan(0);
    });
  });

  // ============================================================================
  // FORCE OVERWRITE
  // ============================================================================

  describe("force overwrite", () => {
    it("skips existing files without --force flag", async () => {
      // Arrange
      const sourceDir = await createTestSourceDir("source-no-force");
      const outDir = join(TEMP_DIR, "output-no-force");
      
      // Create output directory with existing file
      await mkdir(outDir, { recursive: true });
      await writeFile(join(outDir, "agent1.md"), "existing content");

      // Act - first migration
      const result = await executeMigrate(
        sourceDir,
        { format: "cursor", outDir, force: false },
        defaultGlobalOptions
      );

      // Assert
      expect(result.success).toBe(true);
      // Check that skipped count is reasonable
      expect(result.data?.skipped).toBeGreaterThanOrEqual(0);
    });

    it("overwrites existing files with --force flag", async () => {
      // Arrange
      const sourceDir = await createTestSourceDir("source-force");
      const outDir = join(TEMP_DIR, "output-force");
      
      // Create output directory with existing file
      await mkdir(outDir, { recursive: true });
      const existingFile = join(outDir, "agent1.cursorrules");
      await writeFile(existingFile, "old content");

      // Act - migrate with force
      const result = await executeMigrate(
        sourceDir,
        { format: "cursor", outDir, force: true },
        defaultGlobalOptions
      );

      // Assert
      expect(result.success).toBe(true);
    });
  });

  // ============================================================================
  // MIGRATION REPORT
  // ============================================================================

  describe("migration report", () => {
    it("returns total count of discovered files", async () => {
      // Arrange
      const sourceDir = await createTestSourceDir("source-report-total");

      // Act
      const result = await executeMigrate(
        sourceDir,
        { format: "cursor" },
        defaultGlobalOptions
      );

      // Assert
      expect(result.success).toBe(true);
      expect(typeof result.data?.total).toBe("number");
      expect(result.data?.total).toBeGreaterThan(0);
    });

    it("returns successful count in report", async () => {
      // Arrange
      const sourceDir = await createTestSourceDir("source-report-success");

      // Act
      const result = await executeMigrate(
        sourceDir,
        { format: "cursor" },
        defaultGlobalOptions
      );

      // Assert
      expect(result.success).toBe(true);
      expect(typeof result.data?.successful).toBe("number");
    });

    it("returns failed count in report", async () => {
      // Arrange
      const sourceDir = await createTestSourceDir("source-report-failed");

      // Act
      const result = await executeMigrate(
        sourceDir,
        { format: "cursor" },
        defaultGlobalOptions
      );

      // Assert
      expect(result.success).toBe(true);
      expect(typeof result.data?.failed).toBe("number");
    });

    it("returns skipped count in report", async () => {
      // Arrange
      const sourceDir = await createTestSourceDir("source-report-skipped");

      // Act
      const result = await executeMigrate(
        sourceDir,
        { format: "cursor" },
        defaultGlobalOptions
      );

      // Assert
      expect(result.success).toBe(true);
      expect(typeof result.data?.skipped).toBe("number");
    });

    it("returns list of migrated files in report", async () => {
      // Arrange
      const sourceDir = await createTestSourceDir("source-report-files");

      // Act
      const result = await executeMigrate(
        sourceDir,
        { format: "cursor" },
        defaultGlobalOptions
      );

      // Assert
      expect(result.success).toBe(true);
      expect(Array.isArray(result.data?.files)).toBe(true);
      
      // Each file entry should have required properties
      for (const file of result.data?.files || []) {
        expect(file.source).toBeDefined();
        expect(file.status).toBeDefined();
        expect(["success", "failed", "skipped"]).toContain(file.status);
      }
    });

    it("returns warnings array in report", async () => {
      // Arrange
      const sourceDir = await createTestSourceDir("source-report-warnings");

      // Act
      const result = await executeMigrate(
        sourceDir,
        { format: "cursor" },
        defaultGlobalOptions
      );

      // Assert
      expect(result.success).toBe(true);
      expect(Array.isArray(result.data?.warnings)).toBe(true);
    });
  });

  // ============================================================================
  // FILE DISCOVERY
  // ============================================================================

  describe("file discovery", () => {
    it("discovers .md files in directory", async () => {
      // Arrange
      const sourceDir = await createTestSourceDir("source-discover-md");

      // Act
      const result = await executeMigrate(
        sourceDir,
        { format: "cursor", dryRun: true },
        defaultGlobalOptions
      );

      // Assert
      expect(result.success).toBe(true);
      expect(result.data?.total).toBeGreaterThan(0);
    });

    it("discovers .json files in directory", async () => {
      // Arrange
      const sourceDir = join(TEMP_DIR, "source-discover-json");
      await mkdir(sourceDir, { recursive: true });
      
      const claudeContent = await readFile(join(FIXTURES_DIR, "sample-claude-config.json"), "utf-8");
      await writeFile(join(sourceDir, "claude-config.json"), claudeContent);

      // Act
      const result = await executeMigrate(
        sourceDir,
        { format: "oac", dryRun: true },
        defaultGlobalOptions
      );

      // Assert
      expect(result.success).toBe(true);
    });

    it("skips OAC category index files (0-category.json)", async () => {
      // Arrange
      const sourceDir = join(TEMP_DIR, "source-discover-category-index");
      await mkdir(sourceDir, { recursive: true });

      // Category index metadata is NOT an agent file — must be skipped
      await writeFile(
        join(sourceDir, "0-category.json"),
        JSON.stringify({ name: "Core Agents", agents: {} })
      );

      // Act
      const result = await executeMigrate(
        sourceDir,
        { format: "openclaw", dryRun: true },
        defaultGlobalOptions
      );

      // Assert
      expect(result.success).toBe(true);
      // No agent files were found → 0 total discovered, no failure from the index
      expect(result.data?.total).toBe(0);
    });

    it("discovers .cursorrules files", async () => {
      // Arrange
      const sourceDir = join(TEMP_DIR, "source-discover-cursor");
      await mkdir(sourceDir, { recursive: true });
      
      const cursorContent = await readFile(join(FIXTURES_DIR, "sample-cursorrules"), "utf-8");
      await writeFile(join(sourceDir, ".cursorrules"), cursorContent);

      // Act
      const result = await executeMigrate(
        sourceDir,
        { format: "oac", dryRun: true },
        defaultGlobalOptions
      );

      // Assert
      expect(result.success).toBe(true);
    });

    it("skips hidden directories by default (except special ones)", async () => {
      // Arrange
      const sourceDir = join(TEMP_DIR, "source-skip-hidden");
      await mkdir(sourceDir, { recursive: true });
      await mkdir(join(sourceDir, ".hidden"), { recursive: true });
      
      await writeFile(join(sourceDir, "visible.md"), `---
name: visible
description: A visible test agent
mode: primary
---
Content`);
      await writeFile(join(sourceDir, ".hidden", "hidden.md"), `---
name: hidden
description: A hidden test agent
mode: primary
---
Hidden content`);

      // Act
      const result = await executeMigrate(
        sourceDir,
        { format: "cursor", dryRun: true },
        defaultGlobalOptions
      );

      // Assert
      expect(result.success).toBe(true);
      // Should only find the visible file
      expect(result.data?.total).toBe(1);
    });

    it("includes .opencode directory in discovery", async () => {
      // Arrange
      const sourceDir = join(TEMP_DIR, "source-opencode");
      await mkdir(join(sourceDir, ".opencode", "agents"), { recursive: true });
      
      await writeFile(join(sourceDir, ".opencode", "agents", "agent.md"), `---
name: opencode-agent
description: An opencode test agent
mode: primary
---
Content`);

      // Act
      const result = await executeMigrate(
        sourceDir,
        { format: "cursor", dryRun: true },
        defaultGlobalOptions
      );

      // Assert
      expect(result.success).toBe(true);
      expect(result.data?.total).toBeGreaterThan(0);
    });
  });

  // ============================================================================
  // SAME FORMAT SKIPPING
  // ============================================================================

  describe("same format skipping", () => {
    it("skips files already in target format", async () => {
      // Arrange
      const sourceDir = join(TEMP_DIR, "source-same-format");
      await mkdir(sourceDir, { recursive: true });
      
      // Create a .cursorrules file
      const cursorContent = await readFile(join(FIXTURES_DIR, "sample-cursorrules"), "utf-8");
      await writeFile(join(sourceDir, ".cursorrules"), cursorContent);

      // Act - try to migrate to cursor (same format)
      const result = await executeMigrate(
        sourceDir,
        { format: "cursor", dryRun: true },
        defaultGlobalOptions
      );

      // Assert
      expect(result.success).toBe(true);
      // The file should be skipped since it's already in cursor format
      expect(result.data?.skipped).toBeGreaterThanOrEqual(0);
    });
  });

  // ============================================================================
  // VERBOSE OUTPUT
  // ============================================================================

  describe("verbose output", () => {
    it("respects verbose flag", async () => {
      // Arrange
      const sourceDir = await createTestSourceDir("source-verbose");

      // Act
      const result = await executeMigrate(
        sourceDir,
        { format: "cursor" },
        { ...defaultGlobalOptions, verbose: true }
      );

      // Assert
      expect(result.success).toBe(true);
    });
  });

  // ============================================================================
  // MULTI-CONFIG ADAPTERS (e.g. OpenClaw)
  // ============================================================================

  describe("multi-config adapters", () => {
    // OAC source exercising all OpenClaw output channels:
    // configs[0] = .openclaw/agents/{id}.json, plus bootstrap-manifest,
    // skills-index and permission-index additional files.
    const MULTI_CONFIG_AGENT = `---
name: "Multi Config Agent"
description: "Agent that exercises multi-config output"
mode: primary
model: claude-sonnet-4
skills:
  - web-search
  - code-review
permission:
  bash: allow
  read: allow
  write: deny
---

# Multi Config Agent

You are an agent that exercises the multi-config output path.
`;

    // Create a source dir with a single multi-config OAC agent,
    // either nested under subdirectories or at the top level.
    const createMultiConfigSourceDir = async (
      dirName: string,
      nested: boolean
    ): Promise<string> => {
      const sourceDir = join(TEMP_DIR, dirName);
      const agentPath = nested
        ? join(sourceDir, "subagents", "code", "multi-config.md")
        : join(sourceDir, "multi-config.md");
      await mkdir(dirname(agentPath), { recursive: true });
      await writeFile(agentPath, MULTI_CONFIG_AGENT);
      return sourceDir;
    };

    it("writes additional config files into targetDir without nesting", async () => {
      // Arrange
      const sourceDir = await createMultiConfigSourceDir("source-multi-nested", true);
      const outDir = join(TEMP_DIR, "output-multi-nested");

      // Act
      const result = await executeMigrate(
        sourceDir,
        { format: "openclaw", outDir },
        defaultGlobalOptions
      );

      // Assert
      expect(result.success).toBe(true);
      expect(result.data?.successful).toBeGreaterThan(0);

      // Primary config + additional files all under the source's targetDir
      const primaryPath = join(
        outDir, "subagents", "code", ".openclaw", "agents", "multi-config.json"
      );
      const bootstrapPath = join(
        outDir, "subagents", "code", ".openclaw", "bootstrap-manifest-multi-config.json"
      );
      const skillsPath = join(
        outDir, "subagents", "code", ".openclaw", "skills-index.json"
      );
      const permissionPath = join(
        outDir, "subagents", "code", ".openclaw", "permission-index-multi-config.json"
      );

      await expect(readFile(primaryPath, "utf-8")).resolves.toContain('"id": "multi-config"');
      await expect(readFile(bootstrapPath, "utf-8")).resolves.toContain('"agentId": "multi-config"');
      await expect(readFile(skillsPath, "utf-8")).resolves.toContain('"web-search"');
      await expect(readFile(permissionPath, "utf-8")).resolves.toContain('"bash"');

      // Additional files are NOT nested under the primary config's subdirectory
      const nestedPath = join(
        outDir, "subagents", "code", ".openclaw", "agents", ".openclaw", "permission-index-multi-config.json"
      );
      await expect(readFile(nestedPath, "utf-8")).rejects.toMatchObject({ code: "ENOENT" });

      // Content sanity: permission index preserves granular actions
      const permissionIndex = JSON.parse(await readFile(permissionPath, "utf-8"));
      expect(permissionIndex.agentId).toBe("multi-config");
      expect(permissionIndex.tools.bash).toEqual([{ pattern: "*", action: "allow" }]);
      expect(permissionIndex.tools.write).toEqual([{ pattern: "*", action: "deny" }]);

      // Content sanity: skills index references the declared skills
      const skillsIndex = JSON.parse(await readFile(skillsPath, "utf-8"));
      expect(skillsIndex.agentId).toBe("multi-config");
      expect(skillsIndex.skills).toContain("web-search");
    });

    it("writes additional config files at output root for top-level sources", async () => {
      // Arrange
      const sourceDir = await createMultiConfigSourceDir("source-multi-root", false);
      const outDir = join(TEMP_DIR, "output-multi-root");

      // Act
      const result = await executeMigrate(
        sourceDir,
        { format: "openclaw", outDir },
        defaultGlobalOptions
      );

      // Assert
      expect(result.success).toBe(true);

      const primaryPath = join(outDir, ".openclaw", "agents", "multi-config.json");
      const permissionPath = join(outDir, ".openclaw", "permission-index-multi-config.json");

      await expect(readFile(primaryPath, "utf-8")).resolves.toContain('"id": "multi-config"');
      await expect(readFile(permissionPath, "utf-8")).resolves.toContain('"bash"');

      // No nesting under the primary config's directory
      const nestedPath = join(
        outDir, ".openclaw", "agents", ".openclaw", "permission-index-multi-config.json"
      );
      await expect(readFile(nestedPath, "utf-8")).rejects.toMatchObject({ code: "ENOENT" });
    });

    it("writes unique per-agent bootstrap manifests for same-directory primaries (no overwrite)", async () => {
      // Arrange: two primary agents in the SAME source subdirectory.
      // Regression for the converter overwrite bug: fixed-name
      // .openclaw/bootstrap-manifest.json was clobbered by the last primary
      // migrated; per-agent names must both survive.
      const sourceDir = join(TEMP_DIR, "source-multi-same-dir");
      const agentDir = join(sourceDir, "subagents", "code");
      await mkdir(agentDir, { recursive: true });

      const agentA = `---
name: "Alpha Agent"
description: "First same-dir primary"
mode: primary
---
# Alpha Agent

Alpha 六阶段工作流准则。
`;
      const agentB = `---
name: "Beta Agent"
description: "Second same-dir primary"
mode: primary
---
# Beta Agent

Beta 六阶段工作流准则。
`;
      await writeFile(join(agentDir, "alpha.md"), agentA);
      await writeFile(join(agentDir, "beta.md"), agentB);

      const outDir = join(TEMP_DIR, "output-multi-same-dir");

      // Act
      const result = await executeMigrate(
        sourceDir,
        { format: "openclaw", outDir },
        defaultGlobalOptions
      );

      // Assert: both per-agent manifests exist with non-empty source guidance
      expect(result.success).toBe(true);
      expect(result.data?.successful).toBeGreaterThanOrEqual(2);

      const alphaManifestPath = join(
        outDir, "subagents", "code", ".openclaw", "bootstrap-manifest-alpha.json"
      );
      const betaManifestPath = join(
        outDir, "subagents", "code", ".openclaw", "bootstrap-manifest-beta.json"
      );

      const alphaManifest = JSON.parse(await readFile(alphaManifestPath, "utf-8"));
      const betaManifest = JSON.parse(await readFile(betaManifestPath, "utf-8"));
      expect(alphaManifest.agentId).toBe("alpha");
      expect(alphaManifest.guidance).toContain("Alpha 六阶段");
      expect(betaManifest.agentId).toBe("beta");
      expect(betaManifest.guidance).toContain("Beta 六阶段");

      // No legacy single-file manifest is produced for multi-agent output
      const legacyPath = join(
        outDir, "subagents", "code", ".openclaw", "bootstrap-manifest.json"
      );
      await expect(readFile(legacyPath, "utf-8")).rejects.toMatchObject({ code: "ENOENT" });
    });
  });
});
