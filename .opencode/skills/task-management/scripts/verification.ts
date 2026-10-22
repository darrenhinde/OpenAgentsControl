/**
 * Verification engine for evidence-based task completion.
 *
 * A subtask may declare a `verification` array of machine-executable checks.
 * The CLI runs the checks and refuses to mark the task complete unless all
 * of them pass. IO is injectable so the logic stays testable.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { spawnSync } from "node:child_process";

// Types

export interface CommandCheck {
  type: 'command';
  command: string;
  /** Expected process exit code (default 0). */
  expect_exit?: number;
  /** Substring that must appear in stdout+stderr. */
  expect_contains?: string;
  /** Kill the command after this many ms (default 120000). */
  timeout_ms?: number;
}

export interface FileExistsCheck {
  type: 'file_exists';
  /** Path relative to the project root. */
  path: string;
}

export interface FileContainsCheck {
  type: 'file_contains';
  /** Path relative to the project root. */
  path: string;
  /** Substring that must appear in the file. */
  expect_contains: string;
}

export type VerificationCheck = CommandCheck | FileExistsCheck | FileContainsCheck;

export interface CheckResult {
  check: VerificationCheck;
  passed: boolean;
  detail: string;
}

export interface VerificationReport {
  feature: string;
  seq: string;
  generated_at: string;
  passed: boolean;
  results: CheckResult[];
}

export interface CommandOutcome {
  status: number | null;
  stdout: string;
  stderr: string;
}

export type CommandRunner = (command: string, cwd: string, timeoutMs: number) => CommandOutcome;

export const DEFAULT_COMMAND_TIMEOUT_MS = 120_000;

// Validation

const CHECK_TYPES = new Set(['command', 'file_exists', 'file_contains']);
const MAX_SNIPPET = 200;

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === 'string' && value.trim().length > 0;

const isRelativePath = (value: string): boolean =>
  !path.isAbsolute(value) && !value.includes('..');

/** Returns a list of schema violations; empty list means the block is valid. */
export function validateVerificationBlock(value: unknown): string[] {
  const errors: string[] = [];

  if (!Array.isArray(value)) {
    return ['verification must be an array of checks'];
  }
  if (value.length === 0) {
    return ['verification must contain at least one check'];
  }

  value.forEach((check, index) => {
    const label = `verification[${index}]`;

    if (typeof check !== 'object' || check === null || Array.isArray(check)) {
      errors.push(`${label}: must be an object`);
      return;
    }

    const record = check as Record<string, unknown>;
    if (!CHECK_TYPES.has(record.type as string)) {
      errors.push(`${label}: unknown type '${String(record.type)}' (expected command | file_exists | file_contains)`);
      return;
    }

    if (record.type === 'command') {
      if (!isNonEmptyString(record.command)) {
        errors.push(`${label}: command must be a non-empty string`);
      }
      if (record.expect_exit !== undefined && typeof record.expect_exit !== 'number') {
        errors.push(`${label}: expect_exit must be a number`);
      }
      if (record.expect_contains !== undefined && typeof record.expect_contains !== 'string') {
        errors.push(`${label}: expect_contains must be a string`);
      }
      if (record.timeout_ms !== undefined && (typeof record.timeout_ms !== 'number' || record.timeout_ms <= 0)) {
        errors.push(`${label}: timeout_ms must be a positive number`);
      }
    }

    if (record.type === 'file_exists' || record.type === 'file_contains') {
      if (!isNonEmptyString(record.path)) {
        errors.push(`${label}: path must be a non-empty string`);
      } else if (!isRelativePath(record.path)) {
        errors.push(`${label}: path must be relative to the project root ('${String(record.path)}')`);
      }
    }

    if (record.type === 'file_contains' && !isNonEmptyString(record.expect_contains)) {
      errors.push(`${label}: expect_contains must be a non-empty string`);
    }
  });

  return errors;
}

// Evaluation

function snippet(text: string): string {
  const flat = text.replace(/\s+/g, ' ').trim();
  return flat.length > MAX_SNIPPET ? `${flat.slice(0, MAX_SNIPPET)}…` : flat;
}

export function evaluateCheck(
  check: VerificationCheck,
  cwd: string,
  runCommand: CommandRunner,
): CheckResult {
  if (check.type === 'command') {
    const expectedExit = check.expect_exit ?? 0;
    const timeoutMs = check.timeout_ms ?? DEFAULT_COMMAND_TIMEOUT_MS;
    const outcome = runCommand(check.command, cwd, timeoutMs);
    const exit = outcome.status ?? -1;
    const output = `${outcome.stdout}\n${outcome.stderr}`;

    if (exit !== expectedExit) {
      return {
        check,
        passed: false,
        detail: `exit=${exit} (expected ${expectedExit}); output: ${snippet(output) || '(empty)'}`,
      };
    }
    if (check.expect_contains !== undefined && !output.includes(check.expect_contains)) {
      return {
        check,
        passed: false,
        detail: `exit=${exit} but output does not contain '${check.expect_contains}'; got: ${snippet(output) || '(empty)'}`,
      };
    }
    return { check, passed: true, detail: `exit=${exit}` };
  }

  const target = path.resolve(cwd, check.path);

  if (check.type === 'file_exists') {
    const exists = fs.existsSync(target);
    return { check, passed: exists, detail: exists ? 'exists' : `missing: ${check.path}` };
  }

  // file_contains
  if (!fs.existsSync(target)) {
    return { check, passed: false, detail: `missing file: ${check.path}` };
  }
  const content = fs.readFileSync(target, 'utf-8');
  const found = content.includes(check.expect_contains);
  return {
    check,
    passed: found,
    detail: found
      ? `contains '${check.expect_contains}'`
      : `does not contain '${check.expect_contains}'`,
  };
}

export function runVerification(
  checks: VerificationCheck[],
  feature: string,
  seq: string,
  cwd: string,
  runCommand: CommandRunner = defaultRunCommand,
): VerificationReport {
  const results = checks.map(check => evaluateCheck(check, cwd, runCommand));
  return {
    feature,
    seq,
    generated_at: new Date().toISOString(),
    passed: results.every(r => r.passed),
    results,
  };
}

export const defaultRunCommand: CommandRunner = (command, cwd, timeoutMs) => {
  const outcome = spawnSync(command, {
    cwd,
    encoding: 'utf-8',
    timeout: timeoutMs,
    shell: true,
  });
  return {
    status: outcome.status,
    stdout: outcome.stdout ?? '',
    stderr: outcome.stderr ?? '',
  };
};
