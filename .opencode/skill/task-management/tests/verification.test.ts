/**
 * Verification engine tests (evidence-based task completion, schema v2.1)
 *
 * Covers:
 * - validateVerificationBlock schema rules
 * - evaluateCheck for command / file_exists / file_contains (injectable runner)
 * - runVerification report shape
 * - CLI integration: verify command, complete gate, backward compatibility
 */

import { describe, it, expect, beforeAll, afterAll } from "bun:test";
import { spawnSync } from "node:child_process";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import {
  evaluateCheck,
  runVerification,
  validateVerificationBlock,
  VerificationCheck,
} from "../../../skills/task-management/scripts/verification.ts";

const CLI = path.resolve(import.meta.dir, "../../../skills/task-management/scripts/task-cli.ts");
const REPO_ROOT = path.resolve(import.meta.dir, "../../../..");

// --- validateVerificationBlock ---

describe("validateVerificationBlock", () => {
  const validBlock: VerificationCheck[] = [
    { type: "command", command: "npx tsc --noEmit" },
    { type: "command", command: "npm test", expect_exit: 0, expect_contains: "pass", timeout_ms: 5000 },
    { type: "file_exists", path: "src/auth.ts" },
    { type: "file_contains", path: "src/auth.ts", expect_contains: "export function login" },
  ];

  it("accepts a valid block", () => {
    expect(validateVerificationBlock(validBlock)).toEqual([]);
  });

  it("rejects non-array values", () => {
    expect(validateVerificationBlock("nope").length).toBe(1);
    expect(validateVerificationBlock(null).length).toBe(1);
  });

  it("rejects an empty block", () => {
    expect(validateVerificationBlock([]).length).toBe(1);
  });

  it("rejects unknown check types", () => {
    const errors = validateVerificationBlock([{ type: "rm_rf" }]);
    expect(errors[0]).toContain("unknown type");
  });

  it("rejects non-object items", () => {
    expect(validateVerificationBlock(["ls"])[0]).toContain("must be an object");
  });

  it("requires a non-empty command", () => {
    const errors = validateVerificationBlock([{ type: "command", command: "  " }]);
    expect(errors[0]).toContain("command must be a non-empty string");
  });

  it("validates expect_exit / timeout_ms types", () => {
    const errors = validateVerificationBlock([
      { type: "command", command: "ls", expect_exit: "zero", timeout_ms: -1 },
    ]);
    expect(errors.some(e => e.includes("expect_exit"))).toBe(true);
    expect(errors.some(e => e.includes("timeout_ms"))).toBe(true);
  });

  it("requires expect_contains on file_contains", () => {
    const errors = validateVerificationBlock([{ type: "file_contains", path: "a.ts" }]);
    expect(errors[0]).toContain("expect_contains");
  });

  it("rejects absolute and traversing paths", () => {
    const errors = validateVerificationBlock([
      { type: "file_exists", path: "/etc/passwd" },
      { type: "file_contains", path: "../secrets.txt", expect_contains: "x" },
    ]);
    expect(errors.filter(e => e.includes("relative to the project root")).length).toBe(2);
  });
});

// --- evaluateCheck (temp dir fixtures) ---

describe("evaluateCheck", () => {
  const fakeRunner = (exitCode: number, output: string) => () => ({
    status: exitCode,
    stdout: output,
    stderr: "",
  });

  it("file_exists passes for present files", () => {
    const result = evaluateCheck({ type: "file_exists", path: "package.json" }, REPO_ROOT, fakeRunner(0, ""));
    expect(result.passed).toBe(true);
  });

  it("file_exists fails for missing files", () => {
    const result = evaluateCheck({ type: "file_exists", path: "no/such/file.txt" }, REPO_ROOT, fakeRunner(0, ""));
    expect(result.passed).toBe(false);
    expect(result.detail).toContain("missing");
  });

  it("file_contains passes when substring is found", () => {
    const result = evaluateCheck(
      { type: "file_contains", path: "package.json", expect_contains: '"name"' },
      REPO_ROOT,
      fakeRunner(0, ""),
    );
    expect(result.passed).toBe(true);
  });

  it("file_contains fails when substring is absent or file is missing", () => {
    const miss = evaluateCheck(
      { type: "file_contains", path: "package.json", expect_contains: "definitely-not-there" },
      REPO_ROOT,
      fakeRunner(0, ""),
    );
    const noFile = evaluateCheck(
      { type: "file_contains", path: "no/such.txt", expect_contains: "x" },
      REPO_ROOT,
      fakeRunner(0, ""),
    );
    expect(miss.passed).toBe(false);
    expect(noFile.passed).toBe(false);
    expect(noFile.detail).toContain("missing file");
  });

  it("command passes on expected exit code", () => {
    const result = evaluateCheck({ type: "command", command: "echo ok" }, REPO_ROOT, fakeRunner(0, "ok"));
    expect(result.passed).toBe(true);
    expect(result.detail).toContain("exit=0");
  });

  it("command defaults to expecting exit 0", () => {
    const result = evaluateCheck({ type: "command", command: "anything" }, REPO_ROOT, fakeRunner(2, "boom"));
    expect(result.passed).toBe(false);
    expect(result.detail).toContain("exit=2");
    expect(result.detail).toContain("expected 0");
  });

  it("command honors custom expect_exit", () => {
    const result = evaluateCheck(
      { type: "command", command: "grep x", expect_exit: 1 },
      REPO_ROOT,
      fakeRunner(1, ""),
    );
    expect(result.passed).toBe(true);
  });

  it("command checks expect_contains against combined output", () => {
    const hit = evaluateCheck(
      { type: "command", command: "make", expect_contains: "PASS" },
      REPO_ROOT,
      fakeRunner(0, "1 test, PASS"),
    );
    const miss = evaluateCheck(
      { type: "command", command: "make", expect_contains: "PASS" },
      REPO_ROOT,
      fakeRunner(0, "0 tests"),
    );
    expect(hit.passed).toBe(true);
    expect(miss.passed).toBe(false);
    expect(miss.detail).toContain("does not contain");
  });
});

// --- runVerification ---

describe("runVerification", () => {
  it("aggregates results and stamps a report", () => {
    const report = runVerification(
      [
        { type: "command", command: "true" },
        { type: "file_exists", path: "package.json" },
        { type: "file_exists", path: "missing.txt" },
      ],
      "demo",
      "01",
      REPO_ROOT,
      (command, cwd, timeoutMs) => ({ status: 0, stdout: "", stderr: `ran:${command}:${cwd}:${timeoutMs}` }),
    );
    expect(report.feature).toBe("demo");
    expect(report.seq).toBe("01");
    expect(Number.isNaN(Date.parse(report.generated_at))).toBe(false);
    expect(report.results.length).toBe(3);
    expect(report.passed).toBe(false);
    expect(report.results.filter(r => r.passed).length).toBe(2);
  });

  it("passes when every check passes", () => {
    const report = runVerification(
      [{ type: "file_exists", path: "package.json" }],
      "demo",
      "02",
      REPO_ROOT,
      () => ({ status: 0, stdout: "", stderr: "" }),
    );
    expect(report.passed).toBe(true);
  });
});

// --- CLI integration (temp fixture project) ---

describe("task-cli verification integration", () => {
  let fixtureRoot: string;

  const writeSubtask = (seq: string, extra: Record<string, unknown>) => {
    const featureDir = path.join(fixtureRoot, ".tmp/tasks/demo");
    fs.mkdirSync(featureDir, { recursive: true });
    const subtask = {
      id: `demo-${seq}`,
      seq,
      title: `Task ${seq}`,
      status: "in_progress",
      depends_on: [],
      parallel: false,
      context_files: [],
      acceptance_criteria: ["done"],
      deliverables: ["out.txt"],
      agent_id: null,
      started_at: null,
      completed_at: null,
      completion_summary: null,
      ...extra,
    };
    fs.writeFileSync(path.join(featureDir, `subtask_${seq}.json`), JSON.stringify(subtask, null, 2));
  };

  const runCli = (args: string[]) =>
    spawnSync(process.execPath, ["run", CLI, ...args], { cwd: fixtureRoot, encoding: "utf-8" });

  const readSubtask = (seq: string) =>
    JSON.parse(fs.readFileSync(path.join(fixtureRoot, `.tmp/tasks/demo/subtask_${seq}.json`), "utf-8"));

  beforeAll(() => {
    fixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), "oac-verify-"));
    // Anchor project root detection (findProjectRoot stops at the first package.json).
    fs.writeFileSync(path.join(fixtureRoot, "package.json"), JSON.stringify({ name: "verify-fixture" }));
    fs.writeFileSync(path.join(fixtureRoot, "out.txt"), "hello evidence\n");

    writeSubtask("01", {
      verification: [
        { type: "file_exists", path: "out.txt" },
        { type: "file_contains", path: "out.txt", expect_contains: "evidence" },
        { type: "command", command: "echo cli-ok", expect_contains: "cli-ok" },
      ],
    });
    writeSubtask("02", {
      verification: [
        { type: "command", command: "echo failing-check", expect_contains: "EXPECTED-TOKEN" },
        { type: "file_exists", path: "missing-deliverable.txt" },
      ],
    });
    writeSubtask("03", {}); // no verification block — backward-compatible path
    writeSubtask("04", {
      verification: [{ type: "set_fire", command: "bad" }],
    });
  });

  afterAll(() => {
    fs.rmSync(fixtureRoot, { recursive: true, force: true });
  });

  it("verify runs checks, exits 0 and writes an evidence report", () => {
    const proc = runCli(["verify", "demo", "01"]);
    expect(proc.status).toBe(0);
    expect(proc.stdout).toContain("All 3 check(s) passed");

    const report = JSON.parse(
      fs.readFileSync(path.join(fixtureRoot, ".tmp/tasks/demo/verification_01.json"), "utf-8"),
    );
    expect(report.passed).toBe(true);
    expect(report.feature).toBe("demo");
    expect(report.seq).toBe("01");
    expect(report.results.length).toBe(3);
  });

  it("complete passes the gate and marks the task completed", () => {
    const proc = runCli(["complete", "demo", "01", "implemented with evidence"]);
    expect(proc.status).toBe(0);
    expect(proc.stdout).toContain("Verification passed (3 check(s))");
    expect(readSubtask("01").status).toBe("completed");
  });

  it("verify exits 1 on failing checks and writes a failing report", () => {
    const proc = runCli(["verify", "demo", "02"]);
    expect(proc.status).toBe(1);
    expect(proc.stdout).toContain("EXPECTED-TOKEN");
    expect(proc.stdout).toContain("missing-deliverable.txt");

    const report = JSON.parse(
      fs.readFileSync(path.join(fixtureRoot, ".tmp/tasks/demo/verification_02.json"), "utf-8"),
    );
    expect(report.passed).toBe(false);
  });

  it("complete refuses to mark a failing task completed", () => {
    const proc = runCli(["complete", "demo", "02", "cheating attempt"]);
    expect(proc.status).toBe(1);
    expect(proc.stdout).toContain("Verification failed");
    expect(readSubtask("02").status).toBe("in_progress");
    expect(readSubtask("02").completion_summary).toBeNull();
  });

  it("complete refuses unverified tasks without an explicit escape hatch", () => {
    const proc = runCli(["complete", "demo", "03", "legacy self-reported"]);
    expect(proc.status).toBe(1);
    expect(proc.stdout).toContain("--allow-unverified");
    expect(readSubtask("03").status).toBe("in_progress");
  });

  it("complete --allow-unverified is the explicit self-report escape hatch", () => {
    const proc = runCli(["complete", "demo", "03", "legacy self-reported", "--allow-unverified"]);
    expect(proc.status).toBe(0);
    expect(proc.stdout).toContain("SELF-REPORTED");
    expect(readSubtask("03").status).toBe("completed");
  });

  it("rejects invalid feature ids and seqs before touching the filesystem", () => {
    expect(runCli(["complete", "Bad_Feature", "01", "x"]).status).toBe(1);
    expect(runCli(["verify", "../escape", "01"]).status).toBe(1);
    expect(runCli(["complete", "demo", "1", "x"]).status).toBe(1);
  });

  it("complete rejects a malformed verification block", () => {
    const proc = runCli(["complete", "demo", "04", "bad schema"]);
    expect(proc.status).toBe(1);
    expect(proc.stdout).toContain("invalid verification block");
    expect(proc.stdout).toContain("unknown type");
    expect(readSubtask("04").status).toBe("in_progress");
  });

  it("verify reports tasks without a verification block", () => {
    writeSubtask("05", {});
    const proc = runCli(["verify", "demo", "05"]);
    expect(proc.status).toBe(1);
    expect(proc.stdout).toContain("no verification block");
  });

  it("validate flags malformed verification blocks", () => {
    const proc = runCli(["validate", "demo"]);
    expect(proc.status).toBe(1);
    expect(proc.stdout).toContain("04: verification[0]: unknown type");
  });
});
