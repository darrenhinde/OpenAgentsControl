import { readFileSync, readdirSync } from "fs";
import { join, extname, basename, relative, sep } from "path";
import * as yaml from "js-yaml";
import { ZodError } from "zod";
import {
  OpenAgentSchema,
  AgentFrontmatterSchema,
  CanonicalAgentSchema,
  OpenAgent,
  AgentFrontmatter,
  CanonicalAgent,
  OacBlock,
} from "../types.js";

// ============================================================================
// ERROR TYPES
// ============================================================================

/**
 * Base error for agent loading operations
 */
export class AgentLoadError extends Error {
  public readonly filePath: string;
  public override readonly cause?: unknown;

  constructor(
    message: string,
    filePath: string,
    cause?: unknown
  ) {
    super(message);
    this.filePath = filePath;
    this.cause = cause;
    this.name = "AgentLoadError";
  }
}

/**
 * Error when frontmatter parsing fails
 */
export class FrontmatterParseError extends AgentLoadError {
  constructor(filePath: string, cause: unknown) {
    super(`Failed to parse frontmatter in ${filePath}`, filePath, cause);
    this.name = "FrontmatterParseError";
  }
}

/**
 * Error when a canonical agent file carries no `oac:` block.
 *
 * Its own type because it is the single most likely authoring mistake in the canonical tree,
 * and "oac is required" buried in a Zod path list does not tell an author what to do.
 */
export class MissingOacBlockError extends AgentLoadError {
  constructor(filePath: string) {
    super(
      `No \`oac:\` block in ${filePath}. A canonical agent file must declare an \`oac:\` ` +
        `block in its frontmatter carrying at least { id, name, category, type }.`,
      filePath
    );
    this.name = "MissingOacBlockError";
  }
}

/**
 * Error when Zod validation fails
 */
export class ValidationError extends AgentLoadError {
  constructor(
    filePath: string,
    public readonly validationErrors: ZodError
  ) {
    super(
      `Validation failed for ${filePath}:\n${validationErrors.errors
        .map((e) => `  - ${e.path.join(".")}: ${e.message}`)
        .join("\n")}`,
      filePath,
      validationErrors
    );
    this.name = "ValidationError";
  }
}

// ============================================================================
// FRONTMATTER PARSING
// ============================================================================

interface ParsedContent {
  frontmatter: unknown;
  body: string;
}

/**
 * Parse YAML frontmatter from markdown content
 * @param content - Full markdown file content
 * @param filePath - Path to file (for error reporting)
 * @returns Parsed frontmatter and body content
 */
function parseFrontmatter(content: string, filePath: string): ParsedContent {
  // Match YAML frontmatter between --- delimiters
  const frontmatterRegex = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/;
  const match = content.match(frontmatterRegex);

  if (!match) {
    return { frontmatter: null, body: content };
  }

  const [, yamlContent = "", body = ""] = match;

  try {
    const frontmatter = yaml.load(yamlContent);
    return { frontmatter, body: body.trim() };
  } catch (error) {
    throw new FrontmatterParseError(filePath, error);
  }
}

// ============================================================================
// MARKDOWN SECTION EXTRACTION
// ============================================================================

interface AgentSections {
  skills: string[];
  examples: string[];
  commands: string[];
  workflow?: string;
}

/**
 * Extract structured sections from markdown body
 * @param markdown - Agent markdown content (after frontmatter)
 * @returns Extracted sections
 */
function extractSections(markdown: string): AgentSections {
  const sections: AgentSections = {
    skills: [],
    examples: [],
    commands: [],
  };

  // Extract ## Skills or ## Available Skills section
  const skillsMatch = markdown.match(/##\s+(?:Available\s+)?Skills\s*\n([\s\S]*?)(?=\n##|\n---|$)/i);
  if (skillsMatch && skillsMatch[1]) {
    const skillsText = skillsMatch[1];
    // Extract list items or quoted names
    const skillItems = skillsText.match(/[-*]\s+`?([^`\n]+)`?/g);
    if (skillItems) {
      sections.skills = skillItems.map((item) =>
        item.replace(/[-*]\s+`?([^`\n]+)`?/, "$1").trim()
      );
    }
  }

  // Extract ## Examples section
  const examplesMatch = markdown.match(/##\s+Examples?\s*\n([\s\S]*?)(?=\n##|\n---|$)/i);
  if (examplesMatch && examplesMatch[1]) {
    const examplesText = examplesMatch[1];
    // Extract code blocks
    const codeBlocks = examplesText.match(/```[\s\S]*?```/g);
    if (codeBlocks) {
      sections.examples = codeBlocks;
    }
  }

  // Extract ## Commands or ## Available Commands section
  const commandsMatch = markdown.match(/##\s+(?:Available\s+)?Commands?\s*\n([\s\S]*?)(?=\n##|\n---|$)/i);
  if (commandsMatch && commandsMatch[1]) {
    const commandsText = commandsMatch[1];
    const commandItems = commandsText.match(/[-*]\s+`?([^`\n]+)`?/g);
    if (commandItems) {
      sections.commands = commandItems.map((item) =>
        item.replace(/[-*]\s+`?([^`\n]+)`?/, "$1").trim()
      );
    }
  }

  // Extract ## Workflow section
  const workflowMatch = markdown.match(/##\s+Workflow\s*\n([\s\S]*?)(?=\n##|\n---|$)/i);
  if (workflowMatch && workflowMatch[1]) {
    sections.workflow = workflowMatch[1].trim();
  }

  return sections;
}

/**
 * Infer agent ID from file path
 * @param filePath - Path to agent file
 * @returns Agent ID (lowercase, kebab-case)
 */
function inferAgentId(filePath: string): string {
  // Extract agent ID from filename (e.g., "opencoder.md" -> "opencoder")
  const filename = basename(filePath, extname(filePath));
  return filename.toLowerCase().replace(/[^a-z0-9-]/g, "-");
}

// ============================================================================
// AGENT LOADER CLASS
// ============================================================================

/**
 * Loads and parses OpenAgent files from the filesystem
 */
export class AgentLoader {
  /**
   * @deprecated The project-root option was used only for retired sidecar enrichment and now
   * has no effect. Omit it; the constructor remains temporarily compatible with callers.
   */
  constructor(_projectRoot?: string) {}

  /**
   * Load and parse a single agent file
   * @param filePath - Path to agent markdown file
   * @returns Parsed and validated OpenAgent
   */
  loadFromFile(filePath: string): Promise<OpenAgent> {
    let content: string;

    try {
      content = readFileSync(filePath, "utf-8");
    } catch (error) {
      throw new AgentLoadError(`Failed to read file: ${filePath}`, filePath, error);
    }

    // Parse frontmatter
    const { frontmatter, body } = parseFrontmatter(content, filePath);

    if (!frontmatter) {
      throw new AgentLoadError(
        `No frontmatter found in ${filePath}. Agent files must have YAML frontmatter.`,
        filePath
      );
    }

    // Validate frontmatter against schema
    let validatedFrontmatter: AgentFrontmatter;
    try {
      validatedFrontmatter = AgentFrontmatterSchema.parse(frontmatter);
    } catch (error) {
      if (error instanceof ZodError) {
        throw new ValidationError(filePath, error);
      }
      throw error;
    }

    const agentId = inferAgentId(filePath);

    // Legacy metadata is derived only from the loaded file and stable defaults.
    const metadata: OpenAgent["metadata"] = {
      id: agentId,
      name: validatedFrontmatter.name,
      version: "1.0.0",
      author: "opencode",
      tags: [],
      dependencies: [],
    };

    // Extract sections from markdown body
    const sections = extractSections(body);

    // Construct OpenAgent object
    const agent: OpenAgent = {
      frontmatter: validatedFrontmatter,
      metadata,
      systemPrompt: body,
      contexts: [], // Can be populated by context discovery later
      sections,
    };

    // Final validation
    try {
      return Promise.resolve(OpenAgentSchema.parse(agent));
    } catch (error) {
      if (error instanceof ZodError) {
        return Promise.reject(new ValidationError(filePath, error));
      }
      return Promise.reject(error);
    }
  }

  /**
   * Load multiple agents from a directory (recursive)
   * @param dirPath - Path to directory containing agent files
   * @returns Array of parsed OpenAgents
   */
  async loadFromDirectory(dirPath: string): Promise<OpenAgent[]> {
    const agents: OpenAgent[] = [];
    const errors: AgentLoadError[] = [];

    const scanDirectory = async (currentPath: string): Promise<void> => {
      const entries = readdirSync(currentPath, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = join(currentPath, entry.name);

        if (entry.isDirectory()) {
          await scanDirectory(fullPath);
        } else if (entry.isFile() && entry.name.endsWith(".md")) {
          try {
            const agent = await new AgentLoader().loadFromFile(fullPath);
            agents.push(agent);
          } catch (error) {
            if (error instanceof AgentLoadError) {
              errors.push(error);
            } else {
              errors.push(
                new AgentLoadError(`Unexpected error loading ${fullPath}`, fullPath, error)
              );
            }
          }
        }
      }
    };

    await scanDirectory(dirPath);

    if (errors.length > 0 && agents.length === 0) {
      throw new AgentLoadError(
        `Failed to load any agents from ${dirPath}. Errors:\n${errors
          .map((e) => e.message)
          .join("\n")}`,
        dirPath
      );
    }

    return agents;
  }

  /**
   * Validate an agent file without fully loading it
   * @param filePath - Path to agent file
   * @returns Validation result
   */
  async validate(filePath: string): Promise<{ valid: true } | { valid: false; errors: ZodError }> {
    try {
      await this.loadFromFile(filePath);
      return { valid: true };
    } catch (error) {
      if (error instanceof ValidationError) {
        return { valid: false, errors: error.validationErrors };
      }
      throw error;
    }
  }
}

// ============================================================================
// CANONICAL AGENT LOADING (`oac:` block)
// ============================================================================

/**
 * The default content root. A default, not a hardcode: every canonical API takes an explicit
 * root so the loader is testable against a fixture tree.
 */
export const DEFAULT_CONTENT_ROOT = "content/agents";

/**
 * A canonical agent file, decomposed into the three things a build needs.
 *
 * The split is deliberate: `oac` is OAC-only metadata that `oac build` STRIPS when emitting an
 * OpenCode agent file, while `frontmatter` is the OpenCode-legal remainder that survives. Any
 * consumer that had to re-derive that split would eventually get it wrong.
 */
export interface CanonicalAgentFile {
  /** Absolute path on disk. */
  filePath: string;
  /** Path relative to the content root, POSIX-separated. Stable across platforms. */
  relativePath: string;
  /** The OpenCode-legal frontmatter — the canonical block minus `oac`. */
  frontmatter: Omit<CanonicalAgent, "oac">;
  /** The canonical `oac:` block, with defaults applied. */
  oac: OacBlock;
  /** The markdown body after the frontmatter. */
  body: string;
}

/** Locale-independent ordering. `localeCompare` is locale-dependent — never use it here. */
function compareStrings(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/** Repo-relative, POSIX-separated path — stable across platforms. */
function toPosixRelative(root: string, absolute: string): string {
  return relative(root, absolute).split(sep).join("/");
}

/**
 * Recursively list `.md` files under `dir`.
 *
 * Sorted at the end over full paths: `readdirSync` order is filesystem-dependent, and the
 * determinism gate (subtask 11, `git diff --exit-code`) fails on any enumeration
 * nondeterminism.
 */
function listMarkdownFiles(dir: string): string[] {
  const walk = (current: string): string[] =>
    readdirSync(current, { withFileTypes: true }).flatMap((entry) => {
      const full = join(current, entry.name);
      if (entry.isDirectory()) return walk(full);
      return entry.isFile() && entry.name.endsWith(".md") ? [full] : [];
    });

  return walk(dir).sort(compareStrings);
}

/**
 * Loads canonical agent files (OpenCode frontmatter + the `oac:` block) from a content tree.
 *
 * Separate from {@link AgentLoader} on purpose: `AgentLoader` preserves the legacy shape and
 * derives its identity from the filename. Canonical files carry their own identity in `oac.id`,
 * and the two do not always agree — `content/agents/subagents/code/test-engineer.md` declares
 * `id: tester`, which is what `registry.json`, the profiles and the context docs all reference.
 * Resolving by filename here would silently mint a `test-engineer` that nothing refers to, so
 * this class never infers identity from a path.
 */
export class CanonicalAgentLoader {
  private readonly contentRoot: string;

  /**
   * @param contentRoot - Root of the canonical agent tree. Configurable, not hardcoded.
   */
  constructor(contentRoot: string = DEFAULT_CONTENT_ROOT) {
    this.contentRoot = contentRoot;
  }

  /**
   * Load and validate one canonical agent file.
   *
   * @param filePath - Path to the agent markdown file.
   * @throws {MissingOacBlockError} when the file has no `oac:` block.
   * @throws {ValidationError}      when the frontmatter fails {@link CanonicalAgentSchema}.
   */
  loadFromFile(filePath: string): CanonicalAgentFile {
    let content: string;

    try {
      content = readFileSync(filePath, "utf-8");
    } catch (error) {
      throw new AgentLoadError(`Failed to read file: ${filePath}`, filePath, error);
    }

    const { frontmatter, body } = parseFrontmatter(content, filePath);

    if (frontmatter === null || typeof frontmatter !== "object") {
      throw new AgentLoadError(
        `No frontmatter found in ${filePath}. Canonical agent files must have YAML frontmatter.`,
        filePath
      );
    }

    // Checked before Zod so the most common authoring mistake gets a sentence naming the file
    // and the fix, rather than an `oac: Required` entry in a path list.
    if (!("oac" in frontmatter)) {
      throw new MissingOacBlockError(filePath);
    }

    const parsed = CanonicalAgentSchema.safeParse(frontmatter);
    if (!parsed.success) {
      throw new ValidationError(filePath, parsed.error);
    }

    const { oac, ...rest } = parsed.data;

    return {
      filePath,
      relativePath: toPosixRelative(this.contentRoot, filePath),
      frontmatter: rest,
      oac,
      body,
    };
  }

  /**
   * Load every canonical agent under the content root, recursively.
   *
   * Results are sorted by `oac.id`, so the order is a property of the CONTENT rather than of
   * the filesystem — the same reason `listMarkdownFiles` sorts. Duplicate ids are an error:
   * two agents claiming one id makes "install `subagent:tester`" ambiguous, and last-write-wins
   * would resolve it silently and differently depending on enumeration order.
   *
   * @param root - Content root override. Defaults to the constructor's.
   */
  loadFromDirectory(root: string = this.contentRoot): Promise<CanonicalAgentFile[]> {
    const loader = root === this.contentRoot ? this : new CanonicalAgentLoader(root);
    const agents = listMarkdownFiles(root).map((file) => loader.loadFromFile(file));

    const byId = new Map<string, CanonicalAgentFile>();
    for (const agent of agents) {
      const clash = byId.get(agent.oac.id);
      if (clash !== undefined) {
        throw new AgentLoadError(
          `Duplicate oac.id "${agent.oac.id}": declared by both ${clash.relativePath} and ` +
            `${agent.relativePath}. An id must name exactly one agent.`,
          agent.filePath
        );
      }
      byId.set(agent.oac.id, agent);
    }

    return Promise.resolve(agents.sort((a, b) => compareStrings(a.oac.id, b.oac.id)));
  }
}

// ============================================================================
// CONVENIENCE FUNCTIONS
// ============================================================================

/**
 * Load a single agent file (convenience function)
 * @param filePath - Path to agent markdown file
 * @returns Parsed OpenAgent
 */
export async function loadAgent(filePath: string): Promise<OpenAgent> {
  const loader = new AgentLoader();
  return loader.loadFromFile(filePath);
}

/**
 * Load every canonical agent from a content root (convenience function)
 * @param root - Content root, defaults to {@link DEFAULT_CONTENT_ROOT}
 * @returns Canonical agent files, sorted by `oac.id`
 */
export async function loadCanonicalAgents(
  root: string = DEFAULT_CONTENT_ROOT
): Promise<CanonicalAgentFile[]> {
  return new CanonicalAgentLoader(root).loadFromDirectory();
}

/**
 * Load all agents from a directory (convenience function)
 * @param dirPath - Path to directory containing agents
 * @returns Array of parsed OpenAgents
 */
export async function loadAgents(dirPath: string): Promise<OpenAgent[]> {
  const loader = new AgentLoader();
  return loader.loadFromDirectory(dirPath);
}
