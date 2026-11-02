/**
 * Build determinism — building twice over the same input yields byte-identical output.
 *
 * This is not a nicety. The whole refactor rests on `oac build && git diff --exit-code`
 * returning 0 (task.json exit criteria): generated trees stay COMMITTED, and CI gates drift
 * by rebuilding and diffing. A build with any nondeterminism — a timestamp, an unsorted
 * directory read, a `JSON.stringify` over an object whose key order depends on insertion —
 * turns that gate into a coin flip and it gets disabled within a week.
 *
 * The failure mode is specifically NOT caught by "does the output look right" tests: a build
 * that emits a timestamp is perfectly correct on every single run and still fails the gate.
 *
 * Determinism rules being asserted here (07 Stage 3 / 04 §2.1): stable input sort, no
 * timestamps in content, fixed key order.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import {
  importPendingSymbols,
  packagePath,
  repoPath,
  requireMethod,
} from "../../support/pending.js";

const FIXTURE = packagePath("tests/golden/fixtures/fixture-reviewer.md");

/** Anything that would make two runs differ. Matched against emitted content, not source. */
const NONDETERMINISM = [
  { name: "an ISO timestamp", pattern: /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/ },
  { name: "a 'generated at' stamp", pattern: /generated (at|on)[:\s]/i },
  { name: "an absolute home path", pattern: /\/(Users|home)\/[^/\s"]+/ },
];

const ADAPTERS = [
  { target: "opencode", path: "src/adapters/OpenCodeAdapter.ts", symbol: "OpenCodeAdapter", owedBy: "subtask 06" },
  { target: "claude-code", path: "src/adapters/ClaudeAdapter.ts", symbol: "ClaudeAdapter", owedBy: "subtask 07" },
] as const;

interface Adapter {
  fromCanonical(source: string): Promise<{ content: string }>;
}

async function adapterFor(entry: (typeof ADAPTERS)[number], why: string): Promise<Adapter> {
  const owedBy = `${entry.owedBy} (${entry.path})`;
  const module = await importPendingSymbols<Record<string, new () => Adapter>>(
    entry.path,
    [entry.symbol],
    owedBy,
    why
  );
  // ClaudeAdapter exists already but speaks `fromOAC`; without this the test dies as a bare
  // TypeError rather than naming the interface it is waiting on.
  return requireMethod(new module[entry.symbol]!(), "fromCanonical", owedBy, why);
}

// ============================================================================
// RED — adapter-level determinism (subtasks 06/07)
// ============================================================================

describe.each(ADAPTERS)("$target adapter determinism", (entry) => {
  it("emits byte-identical output when invoked twice on the same input", async () => {
    const adapter = await adapterFor(
      entry,
      "two runs over identical input produce identical bytes, so `oac build && git diff " +
        "--exit-code` is a real gate rather than a coin flip"
    );
    const source = readFileSync(FIXTURE, "utf-8");

    const first = await adapter.fromCanonical(source);
    const second = await adapter.fromCanonical(source);

    expect(second.content).toBe(first.content);
  });

  it("emits nothing that varies between runs", async () => {
    const adapter = await adapterFor(
      entry,
      "emitted content carries no timestamp, absolute path or other per-run value"
    );

    const { content } = await adapter.fromCanonical(readFileSync(FIXTURE, "utf-8"));

    for (const { name, pattern } of NONDETERMINISM) {
      expect(content, `emitted content contains ${name}`).not.toMatch(pattern);
    }
  });

  it("is insensitive to the order the same input is presented in", async () => {
    // Two separately-constructed adapters over the same source must agree. If any per-
    // instance state (a cache, a counter, a Set iteration) leaks into output, this catches
    // it where a single instance called twice would not.
    const source = readFileSync(FIXTURE, "utf-8");

    const a = await adapterFor(entry, "adapter output depends only on its input");
    const b = await adapterFor(entry, "adapter output depends only on its input");

    expect((await b.fromCanonical(source)).content).toBe((await a.fromCanonical(source)).content);
  });
});

// ============================================================================
// RED — whole-build determinism (subtask 10) and the registry emitter (subtask 08)
// ============================================================================

describe("full build determinism", () => {
  it("produces byte-identical trees across two runs", async () => {
    const { build } = await importPendingSymbols<{
      build: (options: { root: string; dryRun: true }) => Promise<Map<string, string>>;
    }>(
      "src/core/BuildPipeline.ts",
      ["build"],
      "subtask 10 (oac build) via src/core/BuildPipeline.ts",
      "a whole build run twice yields byte-identical output for every emitted file — the " +
        "property `oac build && git diff --exit-code` depends on"
    );

    const first = await build({ root: repoPath(), dryRun: true });
    const second = await build({ root: repoPath(), dryRun: true });

    expect([...second.keys()].sort()).toEqual([...first.keys()].sort());
    for (const [path, content] of first) {
      expect(second.get(path), `${path} differs between two builds of the same tree`).toBe(content);
    }
  });

  it("emits registry.json with stable ordering", async () => {
    const { emitRegistry } = await importPendingSymbols<{
      emitRegistry: (root: string) => Promise<string>;
    }>(
      "src/core/RegistryEmitter.ts",
      ["emitRegistry"],
      "subtask 08 (src/core/RegistryEmitter.ts)",
      "registry.json is emitted with stable key and array ordering, so a rebuild that " +
        "changes nothing produces no diff"
    );

    const first = await emitRegistry(repoPath());
    const second = await emitRegistry(repoPath());

    expect(second).toBe(first);
    for (const { name, pattern } of NONDETERMINISM) {
      expect(first, `registry.json contains ${name}`).not.toMatch(pattern);
    }
  });

  it("reproduces the committed registry.json exactly", async () => {
    // The generated tree is committed, so a rebuild on a clean checkout must be a no-op.
    const { emitRegistry } = await importPendingSymbols<{
      emitRegistry: (root: string) => Promise<string>;
    }>(
      "src/core/RegistryEmitter.ts",
      ["emitRegistry"],
      "subtask 08 (src/core/RegistryEmitter.ts)",
      "rebuilding registry.json reproduces the committed file byte-for-byte"
    );

    expect(await emitRegistry(repoPath())).toBe(readFileSync(repoPath("registry.json"), "utf-8"));
  });
});
