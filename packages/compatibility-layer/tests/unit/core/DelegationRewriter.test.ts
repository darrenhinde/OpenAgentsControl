/**
 * DelegationRewriter — the structured-reference rewrites, and ONLY those.
 *
 * It rewrites `permission.task` keys, `subagent_type` values and `task(` calls. Prose that
 * merely mentions an agent by name is deliberately out of scope (decision 4): a name in a
 * sentence still reads correctly and rewriting it would degrade the prompt.
 */
import { describe, it, expect } from "vitest";
import { AgentIdResolver } from "../../../src/core/AgentIdResolver.js";
import { rewriteBodyRefs, rewriteTaskKeys } from "../../../src/core/DelegationRewriter.js";

const R = AgentIdResolver.from([
  { id: "contextscout", oacName: "ContextScout", name: "ContextScout" },
  { id: "tester", oacName: "TestEngineer", name: "TestEngineer" },
  { id: "batch-executor", oacName: "BatchExecutor", name: "BatchExecutor" },
]);

const lines = (s: string): string[] => s.split("\n");
const v2 = (k: string): string => R.idFor("opencode", k);
const v1 = (k: string): string => R.idFor("opencode-v1", k);

describe("rewriteTaskKeys", () => {
  const fm = lines(
    [
      "name: X",
      "permission:",
      "  bash:",
      '    "*": "deny"',
      "  task:",
      '    "*": "deny"',
      "    contextscout: \"allow\"   # scouts",
      "    TestEngineer: allow",
      "  edit:",
      '    "**/*.env*": "deny"',
      "mode: subagent",
    ].join("\n"),
  );

  it("maps keys to v2 ids, leaving values, comments, globs and every other line byte-identical", () => {
    const out = rewriteTaskKeys(fm, v2);
    expect(out).toEqual(lines(fm.join("\n").replace("TestEngineer: allow", "tester: allow")));
  });

  it("maps keys to v1 names, fixing the case a lowercase key would never match", () => {
    const out = rewriteTaskKeys(fm, v1);
    expect(out).toContain('    ContextScout: "allow"   # scouts');
    expect(out).toContain("    TestEngineer: allow");
  });

  it("quotes a rewritten key only when it needs it, and keeps an authored quote", () => {
    const spaced = lines(["permission:", "  task:", '    "tester": allow', "    batch-executor: allow"].join("\n"));
    const out = rewriteTaskKeys(spaced, (k) => (k === "tester" ? "Test Engineer" : k));
    expect(out).toContain('    "Test Engineer": allow');
    expect(out).toContain("    batch-executor: allow");
  });

  it("does not touch a task: key that lives outside permission:", () => {
    const other = lines(["name: X", "task:", "  contextscout: allow"].join("\n"));
    expect(rewriteTaskKeys(other, v2)).toEqual(other);
  });

  it("leaves a scalar task rule alone", () => {
    const scalar = lines(["permission:", "  task: deny", "  edit: allow"].join("\n"));
    expect(rewriteTaskKeys(scalar, v2)).toEqual(scalar);
  });

  it("refuses a flow-style task map it cannot rewrite faithfully", () => {
    const flow = lines(["permission:", "  task: {contextscout: allow}"].join("\n"));
    expect(() => rewriteTaskKeys(flow, v2)).toThrow(/flow/i);
  });

  it("rejects two keys that collapse onto the same id", () => {
    const dup = lines(["permission:", "  task:", "    contextscout: allow", "    ContextScout: deny"].join("\n"));
    expect(() => rewriteTaskKeys(dup, v2)).toThrow(/same|duplicate/i);
  });

  it("propagates an unresolvable key", () => {
    const bad = lines(["permission:", "  task:", "    ghost: allow"].join("\n"));
    expect(() => rewriteTaskKeys(bad, v2)).toThrow(/ghost/);
  });

  it("is idempotent", () => {
    const once = rewriteTaskKeys(fm, v2);
    expect(rewriteTaskKeys(once, v2)).toEqual(once);
  });
});

describe("rewriteBodyRefs, v2", () => {
  const body = [
    "Call ContextScout first.",
    'task(subagent_type="ContextScout", description="d", prompt="p")',
    "task(",
    '  subagent_type="TestEngineer",',
    '  description="x"',
    ")",
    "task(BatchExecutor, {feature: 1})",
    "Pass the subagent_type parameter.",
    "A `task()` call and a subtask() helper.",
  ].join("\n");

  const out = rewriteBodyRefs(body, "opencode", R);

  it("rewrites the call, the parameter name and the value", () => {
    expect(out).toContain('subagent(agent="contextscout", description="d", prompt="p")');
    expect(out).toContain('subagent(\n  agent="tester",');
  });

  it("resolves a positional agent argument", () => {
    expect(out).toContain("subagent(batch-executor, {feature: 1})");
  });

  it("renames the bare parameter and the call in prose", () => {
    expect(out).toContain("Pass the agent parameter.");
    expect(out).toContain("A `subagent()` call");
  });

  it("does not rewrite a longer identifier that merely ends in task(", () => {
    expect(out).toContain("subtask() helper");
  });

  it("leaves plain prose mentions of a display name alone", () => {
    expect(out).toContain("Call ContextScout first.");
  });

  it("preserves the quote character", () => {
    expect(rewriteBodyRefs("task(subagent_type='ContextScout')", "opencode", R)).toBe("subagent(agent='contextscout')");
  });

  it("leaves a templated placeholder value alone but fails on a real unknown name", () => {
    expect(rewriteBodyRefs('task(subagent_type="[agent-name]")', "opencode", R)).toBe('subagent(agent="[agent-name]")');
    expect(() => rewriteBodyRefs('task(subagent_type="Ghost")', "opencode", R)).toThrow(/Ghost/);
  });

  it("is idempotent", () => {
    expect(rewriteBodyRefs(out, "opencode", R)).toBe(out);
  });
});

describe("rewriteBodyRefs, v1", () => {
  it("keeps the v1 vocabulary and only normalises the value to the registered name", () => {
    const body = 'task(subagent_type="contextscout", description="d")\ntask(BatchExecutor, {})';
    expect(rewriteBodyRefs(body, "opencode-v1", R)).toBe('task(subagent_type="ContextScout", description="d")\ntask(BatchExecutor, {})');
  });

  it("is the identity on already-correct v1 text", () => {
    const body = 'Use task(subagent_type="TestEngineer") here.';
    expect(rewriteBodyRefs(body, "opencode-v1", R)).toBe(body);
  });
});
