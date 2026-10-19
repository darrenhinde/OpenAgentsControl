/**
 * Static lints over emitted OpenCode trees.
 *
 * `lintV1Agents` is the inverse of evals/v2's `no-v1-artifacts`: instead of "nothing here that v2
 * cannot load" it asks "everything here is what v1 loads". It is the only automated check that
 * the v1 tree is valid, because the v2-pinned host harness cannot run it.
 */
import { describe, it, expect } from "vitest";
import { plan } from "../../../src/core/BuildPipeline.js";
import {
  lintV1Agents,
  lintV1Artifacts,
  lintV2Agents,
  type LintFile,
} from "../../../src/verify/lint/opencode.js";
import { repoPath } from "../../support/pending.js";

const agent = (name: string, extra = "", body = "body"): string =>
  `---\nname: ${name}\ndescription: d\nmode: subagent\n${extra}---\n\n${body}\n`;
const f = (path: string, text: string): LintFile => ({ path, text });
const rules = (r: { rule: string }[]): string[] => r.map((x) => x.rule).sort();

describe("lintV1Agents", () => {
  const ok = [
    f("v1-opencode/agent/a.md", agent("Alpha", "permission:\n  task:\n    \"*\": deny\n    Beta: allow\n", 'task(subagent_type="Beta")')),
    f("v1-opencode/agent/b.md", agent("Beta")),
  ];

  it("accepts a consistent tree", () => {
    expect(lintV1Agents(ok)).toEqual([]);
  });

  it("flags a task key that differs from every name only by case (the bug v1 matching makes fatal)", () => {
    const bad = [f("a.md", agent("Alpha", "permission:\n  task:\n    beta: allow\n")), ...ok.slice(1)];
    expect(rules(lintV1Agents(bad))).toEqual(["task-key-unknown"]);
  });

  it("flags a subagent_type value that names no agent", () => {
    const bad = [f("a.md", agent("Alpha", "", 'task(subagent_type="Nobody")')), ...ok.slice(1)];
    expect(rules(lintV1Agents(bad))).toEqual(["subagent-type-unknown"]);
  });

  it("flags a missing name, a missing mode and a duplicate name", () => {
    const noName = f("n.md", "---\ndescription: d\nmode: subagent\n---\nb\n");
    const noMode = f("m.md", "---\nname: M\ndescription: d\n---\nb\n");
    const dupe = [f("x.md", agent("Dup")), f("y.md", agent("Dup"))];
    expect(rules(lintV1Agents([noName]))).toEqual(["name-missing"]);
    expect(rules(lintV1Agents([noMode]))).toEqual(["mode-missing"]);
    expect(rules(lintV1Agents(dupe))).toEqual(["name-duplicate", "name-duplicate"]);
  });

  it("flags a key outside the v1 Agent schema", () => {
    expect(rules(lintV1Agents([f("k.md", agent("K", "oac:\n  id: k\n"))]))).toEqual(["unknown-key"]);
  });

  it("flags v2 vocabulary leaking into the v1 tree", () => {
    expect(rules(lintV1Agents([f("v.md", agent("V", "", "subagent(agent=\"v\")"))]))).toEqual(["v2-vocabulary"]);
  });

  it("flags a trailing catch-all deny after allows, which hides the tool (#349)", () => {
    const hidden = f("h.md", agent("H", "permission:\n  bash:\n    \"git *\": allow\n    \"*\": deny\n"));
    expect(rules(lintV1Agents([hidden]))).toEqual(["trailing-deny-hides-tool"]);
  });
});

describe("lintV1Artifacts", () => {
  it("accepts tool modules and plugins written against the v1 plugin API", () => {
    expect(
      lintV1Artifacts([
        f("tool/env/index.ts", 'import { tool } from "@opencode-ai/plugin"\nexport default tool({})'),
        f("plugin/notify.ts", 'import type { Plugin } from "@opencode-ai/plugin"\nexport const N: Plugin = async () => ({})'),
      ]),
    ).toEqual([]);
  });

  it("flags a v2-API plugin placed in a v1 tree", () => {
    const r = lintV1Artifacts([f("plugin/x.ts", 'import { Plugin } from "@opencode/plugin"\nexport default Plugin.define({ id: "x" })')]);
    expect(rules(r)).toEqual(["v2-plugin-api"]);
  });

  it("flags a tool or plugin that imports no plugin package at all", () => {
    expect(rules(lintV1Artifacts([f("tool/y/index.ts", "export const x = 1")]))).toEqual(["no-plugin-import"]);
  });
});

describe("lintV2Agents", () => {
  const ok = [
    f(".opencode/agent/alpha.md", `---\ndescription: d\nmode: subagent\npermission:\n  task:\n    "*": deny\n    beta: allow\n---\n\nagent="beta"\n`),
    f(".opencode/agent/beta.md", "---\ndescription: d\nmode: subagent\n---\nb\n"),
  ];

  it("accepts a flat tree whose references are ids", () => {
    expect(lintV2Agents(ok)).toEqual([]);
  });

  it("flags a name: key, which v2 ignores and which would mislead", () => {
    expect(rules(lintV2Agents([f(".opencode/agent/c.md", agent("C"))]))).toEqual(["name-key"]);
  });

  it("flags a task key and an agent= value that are not ids", () => {
    const bad = [f(".opencode/agent/a.md", `---\ndescription: d\nmode: subagent\npermission:\n  task:\n    Beta: allow\n---\nagent="Beta"\n`), ok[1]!];
    expect(rules(lintV2Agents(bad))).toEqual(["agent-value-unknown", "task-key-unknown"]);
  });

  it("flags v1 vocabulary and a nested path", () => {
    expect(rules(lintV2Agents([f(".opencode/agent/sub/d.md", "---\ndescription: d\nmode: subagent\n---\ntask(subagent_type=\"d\")\n")]))).toEqual(["nested-path", "v1-vocabulary", "v1-vocabulary"]);
  });
});

describe("the planned trees", () => {
  it("v1 and v2 output of the real corpus pass their lints", async () => {
    const { files } = await plan({ root: repoPath(), skipRegistry: true });
    const text = (target: string): LintFile[] => files.filter((x) => x.target === target).map((x) => ({ path: x.path, text: x.content }));
    expect(lintV1Agents(text("opencode-v1"))).toEqual([]);
    expect(lintV2Agents(text("opencode"))).toEqual([]);
    expect(text("opencode").length).toBe(32); // image-specialist is v1-only
    expect(text("opencode-v1").length).toBe(33);
  });
});
