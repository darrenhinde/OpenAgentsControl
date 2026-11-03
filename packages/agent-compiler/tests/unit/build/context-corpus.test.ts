/**
 * The real context library: counts pinned, `.opencode/context` is exactly its copy, the registry
 * is exactly its metadata, and every context path an agent, skill or command names resolves.
 * A deliberate add or removal updates the numbers here.
 */

import { describe, expect, it } from "vitest";
import { existsSync, lstatSync, readFileSync, readdirSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { check, plan, readManifest } from "../../../src/core/BuildPipeline.js";
import { loadContextLibrary } from "../../../src/core/ContextLoader.js";
import { lintContext } from "../../../src/verify/lint/context.js";
import { repoPath } from "../../support/pending.js";

const REPO = repoPath();
const library = loadContextLibrary(REPO);
const posix = (p: string): string => relative(REPO, p).split(sep).join("/");

const walk = (dir: string): string[] =>
  !existsSync(dir)
    ? []
    : readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
        e.name === "node_modules" ? [] : e.isDirectory() ? walk(join(dir, e.name)) : [join(dir, e.name)],
      );

describe("the library (pinned counts)", () => {
  it("has 275 regular files and 3 legacy symlinks; 192 registry entries over 189 files", () => {
    const links = library.files.filter((f) => f.linkTarget !== undefined);
    expect(library.files.length - links.length).toBe(275);
    expect(links.map((f) => `${f.relativePath} -> ${f.linkTarget}`)).toEqual([
      "core/standards/code.md -> code-quality.md",
      "core/standards/docs.md -> documentation.md",
      "core/standards/tests.md -> test-coverage.md",
    ]);
    expect(library.components).toHaveLength(192);
    expect(new Set(library.components.map((c) => c.file)).size).toBe(189);
  });

  it("has no dead links and no navigation entry to a missing file beyond the known baseline", () => {
    const dead = lintContext(library).filter((f) => f.rule === "dead-link" || f.rule === "navigation-dead-entry");
    // Pre-existing dead entries (planned documents never written, template placeholders). Lower
    // this number when one is fixed; a new dead link must not raise it.
    expect(dead.length).toBeLessThanOrEqual(30);
  });
});

describe("the copy", () => {
  it("every library file is built to .opencode/context and passes the drift check", async () => {
    const built = await plan({ root: REPO, targets: ["opencode"], skipRegistry: true });
    const context = built.files.filter((f) => f.contextId !== undefined);
    expect(context).toHaveLength(library.files.length);
    expect(check(built, { root: REPO }).filter((d) => d.path.startsWith(".opencode/context/"))).toEqual([]);
  });

  it("every file under .opencode/context is in the ledger", () => {
    const ledger = new Set(Object.keys(readManifest(REPO).files));
    const strays = walk(repoPath(".opencode/context")).map(posix).filter((p) => !ledger.has(p));
    expect(strays).toEqual([]);
  });

  it("the Claude plugin still links to the same tree", () => {
    const link = repoPath("plugins/claude-code/context");
    expect(lstatSync(link).isSymbolicLink()).toBe(true);
  });
});

describe("registries list exactly components.json", () => {
  for (const file of ["built-ai-configs/registry/registry.json", "built-ai-configs/registry/registry.v1.json"]) {
    it(`${file}: 192 contexts, in order, every file on disk`, () => {
      const registry = JSON.parse(readFileSync(repoPath(file), "utf-8")) as { components: { contexts: Array<{ id: string; path: string }> } };
      expect(registry.components.contexts.map((e) => e.id)).toEqual(library.components.map((c) => c.id));
      for (const entry of registry.components.contexts) expect(existsSync(repoPath(entry.path)), entry.path).toBe(true);
    });
  }
});

describe("runtime references resolve", () => {
  // `.opencode/context/<path>` and `.claude/context/<path>` named by an agent, skill or command are
  // read at runtime from an installed tree, which has the library's layout. Every one must exist in
  // the library as an INSTALL has it (regular files only: neither `oac init` nor `install.sh` installs
  // the three legacy symlinks), except these, which were already dangling before the library moved:
  // documentation examples, stale names, and `core/standards/{code,tests}.md`, which the
  // `context-retriever` agent and the `test-generation` skill name but only a repository checkout has
  // (they should say `code-quality.md` and `test-coverage.md`). Remove an entry when it is fixed;
  // never add one.
  const KNOWN_DANGLING = new Set([
    "architecture/patterns.md",
    "core/advanced-patterns.md",
    "core/context-discovery.md",
    "core/examples.md",
    "core/prioritization/scoring.md",
    "core/prompt-optimization-report.md",
    "core/session-management.md",
    "core/specifications.md",
    "core/standards/code.md",
    "core/standards/tests.md",
    "core/story-mapping/guide.md",
    "legacy/old-patterns.md",
    "security/auth-patterns.md",
  ]);
  const REFERENCE = /(?:\.opencode|\.claude)\/context\/([A-Za-z0-9_./-]+)/g;

  const referenced = (): Map<string, string[]> => {
    const out = new Map<string, string[]>();
    for (const dir of ["agent-library/agents", "agent-library/skills", "agent-library/commands"]) {
      for (const file of walk(repoPath(dir))) {
        let text: string;
        try {
          text = readFileSync(file, "utf-8");
        } catch {
          continue;
        }
        for (const match of text.matchAll(REFERENCE)) {
          const path = match[1]!.replace(/[.,]+$/, "");
          if (path === "" || path.endsWith("/")) continue;
          out.set(path, [...(out.get(path) ?? []), posix(file)]);
        }
      }
    }
    return out;
  };

  const installable = (): Set<string> => new Set(library.files.filter((f) => f.linkTarget === undefined).map((f) => f.relativePath));

  it("every named file exists in the library (a full install), apart from the known baseline", () => {
    const known = installable();
    const isDir = (path: string): boolean => [...known].some((f) => f.startsWith(`${path}/`));
    const missing = [...referenced()]
      .filter(([path]) => !known.has(path) && !known.has(`${path}.md`) && !isDir(path))
      .map(([path, sources]) => ({ path, source: sources[0] }))
      .filter(({ path }) => !KNOWN_DANGLING.has(path));
    expect(missing).toEqual([]);
  });

  it("the baseline lists only paths that are still dangling", () => {
    const known = installable();
    const refs = referenced();
    const stale = [...KNOWN_DANGLING].filter((path) => known.has(path) || !refs.has(path));
    expect(stale).toEqual([]);
  });
});
