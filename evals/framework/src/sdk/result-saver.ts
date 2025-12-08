/**
 * Result Saver - Generates and saves compact JSON results
 * 
 * Type-safe implementation to catch errors at build time.
 * 
 * Responsibilities:
 * - Convert TestResult[] to compact JSON format
 * - Save to history/YYYY-MM/DD-HHMMSS-{agent}.json
 * - Update latest.json
 * - Include git commit hash for versioning
 */

import { writeFileSync, mkdirSync, existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { execSync } from 'child_process';
import type { TestResult } from './test-runner.js';

/**
 * Valid test categories (from test-case-schema.ts)
 */
export type TestCategory = 'developer' | 'business' | 'creative' | 'edge-case' | 'other';

/**
 * Violation severity levels
 */
export type ViolationSeverity = 'error' | 'warning';

/**
 * Compact violation details
 */
export interface ViolationDetail {
  readonly type: string;
  readonly severity: ViolationSeverity;
  readonly message: string;
}

/**
 * Compact test result
 */
export interface CompactTestResult {
  readonly id: string;
  readonly category: TestCategory;
  readonly passed: boolean;
  readonly duration_ms: number;
  readonly events: number;
  readonly approvals: number;
  readonly violations: {
    readonly total: number;
    readonly errors: number;
    readonly warnings: number;
    readonly details?: ReadonlyArray<ViolationDetail>;
  };
}

/**
 * Category summary
 */
export interface CategorySummary {
  readonly passed: number;
  readonly total: number;
}

/**
 * Test run metadata
 */
export interface ResultMetadata {
  readonly timestamp: string;
  readonly agent: string;
  readonly model: string;
  readonly framework_version: string;
  readonly git_commit?: string;
  /** Prompt variant used (e.g., 'default', 'gpt', 'gemini') */
  readonly prompt_variant?: string;
  /** Model family from prompt metadata (e.g., 'claude', 'gpt', 'gemini') */
  readonly model_family?: string;
}

/**
 * Overall test summary
 */
export interface TestSummary {
  readonly total: number;
  readonly passed: number;
  readonly failed: number;
  readonly duration_ms: number;
  readonly pass_rate: number;
}

/**
 * Complete result summary
 */
export interface ResultSummary {
  readonly meta: ResultMetadata;
  readonly summary: TestSummary;
  readonly by_category: Readonly<Record<string, CategorySummary>>;
  readonly tests: ReadonlyArray<CompactTestResult>;
}

/**
 * Package.json structure (type-safe)
 */
interface PackageJson {
  readonly name?: string;
  readonly version?: string;
  readonly description?: string;
  [key: string]: unknown;
}

/**
 * Options for saving results
 */
export interface SaveOptions {
  /** Prompt variant used (e.g., 'default', 'gpt', 'gemini') */
  promptVariant?: string;
  /** Model family from prompt metadata */
  modelFamily?: string;
  /** Path to prompts directory for per-variant results */
  promptsDir?: string;
}

/**
 * Result saver with type-safe operations
 */
export class ResultSaver {
  private readonly resultsDir: string;
  
  constructor(resultsDir: string) {
    this.resultsDir = resultsDir;
  }
  
  /**
   * Save test results to JSON files
   * 
   * @throws {Error} If directory creation or file writing fails
   */
  async save(
    results: TestResult[], 
    agent: string, 
    model: string,
    options: SaveOptions = {}
  ): Promise<string> {
    // Generate compact result with optional variant info
    const summary = this.generateSummary(results, agent, model, options);
    
    // Create history directory for current month
    const now = new Date();
    const yearMonth = this.formatYearMonth(now);
    const historyDir = join(this.resultsDir, 'history', yearMonth);
    
    this.ensureDirectoryExists(historyDir);
    
    // Generate filename: DD-HHMMSS-{agent}[-{variant}].json
    const filename = this.generateFilename(now, agent, options.promptVariant);
    const historyPath = join(historyDir, filename);
    
    // Save to history
    this.writeJsonFile(historyPath, summary);
    
    // Update latest.json
    const latestPath = join(this.resultsDir, 'latest.json');
    this.writeJsonFile(latestPath, summary);
    
    // Also save to prompts results directory if variant specified
    if (options.promptVariant && options.promptsDir) {
      await this.saveVariantResults(summary, agent, options.promptVariant, options.promptsDir);
    }
    
    return historyPath;
  }
  
  /**
   * Save results to the prompts variant results directory
   */
  private async saveVariantResults(
    summary: ResultSummary,
    agent: string,
    variant: string,
    promptsDir: string
  ): Promise<void> {
    const variantResultsDir = join(promptsDir, agent, 'results');
    this.ensureDirectoryExists(variantResultsDir);
    
    // Save detailed results
    const detailedPath = join(variantResultsDir, `${variant}-results.json`);
    
    // Create variant-specific summary with additional fields
    const variantSummary = {
      variant,
      agent,
      model: summary.meta.model,
      model_family: summary.meta.model_family,
      timestamp: summary.meta.timestamp,
      passed: summary.summary.passed,
      failed: summary.summary.failed,
      total: summary.summary.total,
      passRate: `${(summary.summary.pass_rate * 100).toFixed(1)}%`,
      duration_ms: summary.summary.duration_ms,
      by_category: summary.by_category,
      // Include test details for debugging
      tests: summary.tests.map(t => ({
        id: t.id,
        passed: t.passed,
        violations: t.violations.total,
      })),
    };
    
    writeFileSync(detailedPath, JSON.stringify(variantSummary, null, 2), 'utf8');
  }
  
  /**
   * Generate compact summary from test results (type-safe)
   */
  private generateSummary(
    results: TestResult[], 
    agent: string, 
    model: string,
    options: SaveOptions = {}
  ): ResultSummary {
    const passed = results.filter(r => r.passed).length;
    const failed = results.length - passed;
    const totalDuration = results.reduce((sum, r) => sum + r.duration, 0);
    
    // Group by category (type-safe)
    const byCategory = this.groupByCategory(results);
    
    // Convert to compact format (type-safe)
    const tests = results.map(r => this.toCompactResult(r));
    
    return {
      meta: {
        timestamp: new Date().toISOString(),
        agent,
        model,
        framework_version: this.getFrameworkVersion(),
        git_commit: this.getGitCommit(),
        prompt_variant: options.promptVariant,
        model_family: options.modelFamily,
      },
      summary: {
        total: results.length,
        passed,
        failed,
        duration_ms: totalDuration,
        pass_rate: results.length > 0 ? passed / results.length : 0,
      },
      by_category: byCategory,
      tests,
    };
  }
  
  /**
   * Group results by category (type-safe)
   */
  private groupByCategory(results: TestResult[]): Record<string, CategorySummary> {
    const categories: Record<string, CategorySummary> = {};
    
    for (const result of results) {
      const category = this.getCategory(result);
      
      if (!categories[category]) {
        categories[category] = { passed: 0, total: 0 };
      }
      
      categories[category] = {
        passed: categories[category].passed + (result.passed ? 1 : 0),
        total: categories[category].total + 1,
      };
    }
    
    return categories;
  }
  
  /**
   * Convert TestResult to CompactTestResult (type-safe)
   */
  private toCompactResult(result: TestResult): CompactTestResult {
    const violations = result.evaluation?.allViolations || [];
    
    return {
      id: result.testCase.id,
      category: this.getCategory(result),
      passed: result.passed,
      duration_ms: result.duration,
      events: result.events.length,
      approvals: result.approvalsGiven,
      violations: {
        total: result.evaluation?.totalViolations || 0,
        errors: result.evaluation?.violationsBySeverity.error || 0,
        warnings: result.evaluation?.violationsBySeverity.warning || 0,
        details: violations.length > 0 
          ? violations.map(v => ({
              type: v.type,
              severity: v.severity as ViolationSeverity,
              message: v.message,
            }))
          : undefined,
      },
    };
  }
  
  /**
   * Get category from test result (type-safe)
   * Uses the category field from test case schema
   */
  private getCategory(result: TestResult): TestCategory {
    const category = result.testCase.category;
    
    // Type guard to ensure valid category
    const validCategories: TestCategory[] = ['developer', 'business', 'creative', 'edge-case'];
    
    if (validCategories.includes(category as TestCategory)) {
      return category as TestCategory;
    }
    
    return 'other';
  }
  
  /**
   * Format year-month string (YYYY-MM)
   */
  private formatYearMonth(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    return `${year}-${month}`;
  }
  
  /**
   * Generate filename for result file
   * Format: DD-HHMMSS-{agent}[-{variant}].json
   */
  private generateFilename(date: Date, agent: string, variant?: string): string {
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');
    const time = `${hours}${minutes}${seconds}`;
    
    const variantSuffix = variant ? `-${variant}` : '';
    return `${day}-${time}-${agent}${variantSuffix}.json`;
  }
  
  /**
   * Ensure directory exists (create if needed)
   */
  private ensureDirectoryExists(dir: string): void {
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
  }
  
  /**
   * Write JSON to file (type-safe)
   */
  private writeJsonFile(path: string, data: ResultSummary): void {
    const json = JSON.stringify(data, null, 2);
    writeFileSync(path, json, 'utf8');
  }
  
  /**
   * Get framework version from package.json (type-safe)
   */
  private getFrameworkVersion(): string {
    try {
      // Use readFileSync instead of require for type safety
      const packageJsonPath = join(__dirname, '../../package.json');
      const packageJsonContent = readFileSync(packageJsonPath, 'utf8');
      const packageJson = JSON.parse(packageJsonContent) as PackageJson;
      
      return packageJson.version || '0.1.0';
    } catch (error) {
      // Fallback to default version if package.json can't be read
      return '0.1.0';
    }
  }
  
  /**
   * Get current git commit hash (type-safe)
   */
  private getGitCommit(): string | undefined {
    try {
      const commit = execSync('git rev-parse --short HEAD', { 
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'ignore'],
      }).trim();
      
      // Validate commit hash format (7 hex characters)
      if (/^[0-9a-f]{7}$/.test(commit)) {
        return commit;
      }
      
      return undefined;
    } catch {
      return undefined;
    }
  }
}
