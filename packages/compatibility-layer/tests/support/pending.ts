/**
 * Helpers for RED-FIRST tests.
 *
 * Subtask 03 writes the tests that define "done" for subtasks 04-11. Those subtasks have
 * not landed, so the modules and the `content/` tree under test do not exist yet. A bare
 * top-level `import` of a missing module aborts collection for the WHOLE file, which turns
 * one honest red test into a wall of unrelated errors that say nothing about what is
 * missing.
 *
 * So: probe the filesystem first, import dynamically only when the target is really there,
 * and otherwise fail with a sentence naming the subtask that owes the artifact. A red test
 * here is a specification, not a crash.
 */

import { existsSync, readdirSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { expect } from "vitest";

const HERE = dirname(fileURLToPath(import.meta.url));

/** `packages/compatibility-layer` */
export const PACKAGE_ROOT = resolve(HERE, "../..");

/** The repository root — four levels up from `tests/support/`. */
export const REPO_ROOT = resolve(HERE, "../../../..");

/** Absolute path to a repo-relative path. */
export function repoPath(...segments: string[]): string {
  return join(REPO_ROOT, ...segments);
}

/** Absolute path to a package-relative path. */
export function packagePath(...segments: string[]): string {
  return join(PACKAGE_ROOT, ...segments);
}

/** The marker every RED-by-design failure carries, so they are greppable in CI output. */
const MARKER = "RED-BY-DESIGN";

/**
 * Fail with a message that states precisely what is missing and who owes it.
 *
 * @param what    the artifact that does not exist yet
 * @param owedBy  the subtask expected to deliver it (e.g. "subtask 05")
 * @param why     what this test would assert once it exists
 */
export function pending(what: string, owedBy: string, why: string): never {
  expect.fail(
    `${MARKER} — ${what} does not exist yet.\n` +
      `  Owed by: ${owedBy}\n` +
      `  Once it lands, this test asserts: ${why}\n` +
      `  This failure is the specification, not a bug in the test.`
  );
}

/**
 * Dynamically import a package-relative module, failing cleanly when it is not on disk.
 *
 * The existence probe comes first on purpose: it means we never hand a missing specifier to
 * the loader, so the failure is our sentence rather than a resolver stack trace.
 *
 * @param relativePath  package-relative module path, e.g. `"src/core/ReferenceResolver.ts"`
 * @param owedBy        the subtask expected to deliver it
 * @param why           what this test would assert once it exists
 */
export async function importPending<T = Record<string, unknown>>(
  relativePath: string,
  owedBy: string,
  why: string
): Promise<T> {
  const absolute = packagePath(relativePath);

  if (!existsSync(absolute)) {
    pending(`module ${relativePath}`, owedBy, why);
  }

  try {
    return (await import(/* @vite-ignore */ pathToFileURL(absolute).href)) as T;
  } catch (cause) {
    expect.fail(
      `${MARKER} — module ${relativePath} exists but failed to import.\n` +
        `  Owed by: ${owedBy}\n` +
        `  Once it imports, this test asserts: ${why}\n` +
        `  Import error: ${cause instanceof Error ? cause.message : String(cause)}`
    );
  }
}

/**
 * Pull named exports out of a pending module, failing cleanly on a missing symbol.
 *
 * A module can land before its full surface does; `undefined is not a constructor` is not a
 * diagnostic, so name the symbol and the subtask instead.
 */
export async function importPendingSymbols<T extends Record<string, unknown>>(
  relativePath: string,
  symbols: readonly string[],
  owedBy: string,
  why: string
): Promise<T> {
  const module = await importPending<Record<string, unknown>>(relativePath, owedBy, why);
  const missing = symbols.filter((symbol) => module[symbol] === undefined);

  if (missing.length > 0) {
    expect.fail(
      `${MARKER} — module ${relativePath} does not export: ${missing.join(", ")}.\n` +
        `  Owed by: ${owedBy}\n` +
        `  Exports found: ${Object.keys(module).join(", ") || "(none)"}\n` +
        `  Once exported, this test asserts: ${why}`
    );
  }

  return module as T;
}

/**
 * Require a method on an already-constructed instance, failing cleanly when it is absent.
 *
 * The module-and-symbol probes above are not enough on their own: `ClaudeAdapter.ts` already
 * exists and exports `ClaudeAdapter`, so both probes pass — and then the test dies on
 * `adapter.fromCanonical is not a function`, a TypeError that names neither the missing
 * capability nor the subtask that owes it. The old class speaks `fromOAC`; the canonical
 * build needs `fromCanonical`. That gap is a specification, so it gets a sentence.
 */
export function requireMethod<T extends object>(
  instance: T,
  method: string,
  owedBy: string,
  why: string
): T {
  if (typeof (instance as Record<string, unknown>)[method] !== "function") {
    const surface = [
      ...Object.getOwnPropertyNames(Object.getPrototypeOf(instance) as object),
      ...Object.keys(instance),
    ]
      .filter((name) => name !== "constructor")
      .sort();

    expect.fail(
      `${MARKER} — ${instance.constructor.name} has no ${method}() method.\n` +
        `  Owed by: ${owedBy}\n` +
        `  Methods found: ${surface.join(", ") || "(none)"}\n` +
        `  Once it exists, this test asserts: ${why}`
    );
  }

  return instance;
}

/**
 * Require a repo-relative directory, failing cleanly when absent.
 *
 * `content/` is built by subtask 09 in parallel with this one; an ENOENT stack trace from
 * `readdirSync` would say nothing useful about that.
 */
export function requireDir(relativePath: string, owedBy: string, why: string): string {
  const absolute = repoPath(relativePath);

  if (!existsSync(absolute) || !statSync(absolute).isDirectory()) {
    pending(`directory ${relativePath}/`, owedBy, why);
  }

  return absolute;
}

/** Recursively list files under `absoluteDir` matching `extension`, sorted for determinism. */
export function listFiles(absoluteDir: string, extension = ".md"): string[] {
  const walk = (dir: string): string[] =>
    readdirSync(dir, { withFileTypes: true })
      .flatMap((entry) => {
        const full = join(dir, entry.name);
        if (entry.isDirectory()) return walk(full);
        return entry.isFile() && entry.name.endsWith(extension) ? [full] : [];
      })
      .sort();

  return walk(absoluteDir).sort();
}
