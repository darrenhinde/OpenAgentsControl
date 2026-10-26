/**
 * Capability lint: an emitted agent must not be told to do what its host will not let it do.
 *
 * `tests/fixtures/l001-104356a/` holds four of the seven Claude plugin agents exactly as commit
 * `104356a` wrote them (`git show 104356a:plugins/claude-code/agents/<file>`): the L-001
 * regression this lint exists to catch. The prose cases below pin the precision side: bare
 * mentions, negations, other actors' flows and output templates are not delegations.
 */
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join, relative, sep } from "node:path";
import {
  lintClaudeAgents,
  lintOpenCodeDelegations,
  taskAction,
} from "../../../src/verify/lint/capability.js";
import { lintBuild } from "../../../src/verify/lint/run.js";
import type { LintFile } from "../../../src/verify/lint/opencode.js";
import { PACKAGE_ROOT, repoPath } from "../../support/pending.js";

const f = (path: string, text: string): LintFile => ({ path, text });
const rules = (r: { rule: string }[]): string[] => r.map((x) => x.rule).sort();

const EXAMPLE = "Does a thing.\n  <example>\n  user: \"x\"\n  assistant: \"y\"\n  </example>";
const claude = (tools: string | undefined, body: string, extra = ""): string =>
  `---\nname: probe\ndescription: |\n  ${EXAMPLE}\n${tools === undefined ? "" : `tools: ${tools}\n`}${extra}---\n\n${body}\n`;
const lintOne = (tools: string | undefined, body: string, extra = ""): string[] =>
  rules(lintClaudeAgents([f("agents/probe.md", claude(tools, body, extra))]));

const walk = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? walk(join(dir, e.name)) : e.name.endsWith(".md") ? [join(dir, e.name)] : [],
  );
const tree = (dir: string): LintFile[] =>
  walk(dir).map((p) => f(relative(repoPath(), p).split(sep).join("/"), readFileSync(p, "utf-8")));

// ============================================================================
// Claude Code: delegation without Task
// ============================================================================

describe("lintClaudeAgents: delegation-without-task", () => {
  const delegations = [
    "ALWAYS call ContextScout BEFORE reviewing any code.",
    "If ContextScout flags a library → call **ExternalScout** for live docs",
    'task(subagent_type="ContextScout", description="d", prompt="p")',
    "If context is missing, delegate discovery to ContextScout and capture paths",
    "Use ContextScout to fill gaps before planning.",
    "Invoke context-scout before writing tests.",
    "subagent(agent=\"contextscout\", prompt=\"p\")",
  ];

  it.each(delegations)("flags %j for an agent with no Task tool", (body) => {
    expect(lintOne("Read, Glob, Grep", body)).toEqual(["delegation-without-task"]);
  });

  it.each(delegations)("accepts %j when Task is granted", (body) => {
    expect(lintOne("Read, Task", body)).toEqual([]);
  });

  it("treats a missing tools: as inheriting Task, and disallowedTools as removing it", () => {
    expect(lintOne(undefined, delegations[0]!)).toEqual([]);
    expect(lintOne(undefined, delegations[0]!, "disallowedTools: Task\n")).toEqual(["delegation-without-task"]);
  });

  const prose = [
    "Context is pre-loaded: the main agent pre-loads ContextScout results before you start.",
    "Ensure added context is discoverable via ContextScout.",
    "ContextScout uses the discovered root for navigation-driven discovery.",
    "- ❌ Don't call ContextScout — you work independently",
    "Never delegate this to ContextScout.",
    "If you need more context, ask the main agent to call ContextScout.",
    "Call other subagents only through the orchestrator.",
    "Use mcp_skill to invoke context7 skill",
    "You are the documentation agent; use documentation for reference.",
  ];

  it.each(prose)("does not flag prose %j", (body) => {
    expect(lintOne("Read", body)).toEqual([]);
  });

  it("ignores imperatives inside fenced templates but not structured calls there", () => {
    const template = "```markdown\n## ExternalScout Recommendation\n→ Invoke ExternalScout to fetch live docs\n```";
    expect(lintOne("Read", template)).toEqual([]);
    expect(lintOne("Read", "```\ntask(subagent_type=\"ContextScout\")\n```")).toEqual(["delegation-without-task"]);
  });

  it("skips sections describing another agent's flow", () => {
    const integration = "## Integration with Main Agent\n\n1. Main agent calls ContextScout\n2. Call ExternalScout for docs\n\n## Your Job\n\nRead files.";
    expect(lintOne("Read", integration)).toEqual([]);
    const lead = "**Orchestrator Response**:\n- Skip it\n- Delegate directly to TaskManager\n\nNow call ContextScout.";
    expect(lintOne("Read", lead)).toEqual(["delegation-without-task"]);
  });

  it("names agents from the linted set and from options", () => {
    const body = "Dispatch coder-agent for the subtask.";
    expect(lintOne("Read", body)).toEqual([]);
    expect(rules(lintClaudeAgents([f("a.md", claude("Read", body))], { agentNames: ["coder-agent"] }))).toEqual(["delegation-without-task"]);
  });
});

// ============================================================================
// Claude Code: bash without Bash, examples, .opencode paths
// ============================================================================

describe("lintClaudeAgents: bash-without-bash", () => {
  it("flags a shell fence and an inline run instruction for an agent without Bash", () => {
    expect(lintOne("Read, Write", "```bash\nnpm test\n```")).toEqual(["bash-without-bash"]);
    expect(lintOne("Read, Write", "```sh\nls\n```")).toEqual(["bash-without-bash"]);
    expect(lintOne("Read, Write", "Then run `pnpm test` and report.")).toEqual(["bash-without-bash"]);
    expect(lintOne("Read", "Run `git status` first.", "disallowedTools: Bash\n")).toEqual(["bash-without-bash"]);
  });

  it("accepts the same body when Bash is granted, including a scoped Bash(...) grant", () => {
    expect(lintOne("Read, Bash", "```bash\nnpm test\n```\nrun `npm test`")).toEqual([]);
    expect(lintOne("Read, Bash(git:*)", "Run `git status` first.")).toEqual([]);
  });

  it("does not flag non-shell fences, non-command backticks or negated runs", () => {
    expect(lintOne("Read", "```json\n{}\n```\n```typescript\nconst x = 1\n```")).toEqual([]);
    expect(lintOne("Read", "Run `type-check` mentally: does it compile?")).toEqual([]);
    expect(lintOne("Read", "Do not run `npm install` — you have no shell.")).toEqual([]);
    expect(lintOne("Read", "- Execute any bash commands (read-only)")).toEqual([]);
  });
});

describe("lintClaudeAgents: description-no-example", () => {
  it("flags a single-line OpenCode-style description", () => {
    const text = "---\nname: probe\ndescription: Code review agent\ntools: Read\n---\nbody\n";
    expect(rules(lintClaudeAgents([f("p.md", text)]))).toEqual(["description-no-example"]);
  });

  it("does not count an <example> that lives only in the body", () => {
    const text = "---\nname: probe\ndescription: d\ntools: Read\n---\n<example>x</example>\n";
    expect(rules(lintClaudeAgents([f("p.md", text)]))).toEqual(["description-no-example"]);
  });
});

describe("lintClaudeAgents: opencode-path", () => {
  it("allows the .opencode/context root fallback and files under it", () => {
    expect(lintOne("Read", "Check .claude/context → context → .opencode/context. See `.opencode/context/core/navigation.md`.")).toEqual([]);
  });

  it("warns once per leaked path, with a count", () => {
    const findings = lintClaudeAgents([f("p.md", claude("Read", "See .opencode/skills/x/router.sh and .opencode/skills/x/router.sh.\nAlso .opencode/config/agent-metadata.json"))]);
    expect(findings.map((x) => [x.rule, x.severity])).toEqual([["opencode-path", "warning"], ["opencode-path", "warning"]]);
    expect(findings[0]!.message).toContain(".opencode/skills/x/router.sh (2x)");
  });

  it("does not match v1-opencode/ or ~/.config/opencode", () => {
    expect(lintOne("Read", "Built into v1-opencode/agent and ~/.config/opencode/opencode.json")).toEqual([]);
  });
});

// ============================================================================
// Real trees
// ============================================================================

describe("lintClaudeAgents on real trees", () => {
  it("catches L-001: the 104356a output fails on every rule", () => {
    const findings = lintClaudeAgents(tree(join(PACKAGE_ROOT, "tests/fixtures/l001-104356a")));
    const by = (file: string): string[] => [...new Set(findings.filter((x) => x.path.endsWith(`/${file}`)).map((x) => x.rule))].sort();
    expect(by("code-reviewer.md")).toEqual(["delegation-without-task", "description-no-example", "opencode-path"]);
    expect(by("coder-agent.md")).toEqual(["bash-without-bash", "delegation-without-task", "description-no-example", "opencode-path"]);
    expect(by("task-manager.md")).toEqual(["bash-without-bash", "delegation-without-task", "description-no-example", "opencode-path"]);
    expect(by("test-engineer.md")).toEqual(["delegation-without-task", "description-no-example", "opencode-path"]);
    const reviewer = findings.find((x) => x.path.endsWith("/code-reviewer.md") && x.rule === "delegation-without-task");
    expect(reviewer?.message).toBe("line 14: told to delegate to ContextScout, but the agent has no Task tool");
  });

  it("the shipped plugin agents, emitted from canonical, carry no findings", () => {
    // These are build output (D-017). The pre-flip hand-written coder-agent was told to run
    // `bash .opencode/skills/task-management/router.sh` with `disallowedTools: Bash`; the
    // emitted one routes that through oac:only host blocks, so the shipped tree is clean.
    expect(lintClaudeAgents(tree(repoPath("plugins/claude-code/agents")))).toEqual([]);
  });
});

// ============================================================================
// OpenCode
// ============================================================================

const oc = (name: string, permission: string, body: string): string =>
  `---\nname: ${name}\ndescription: d\nmode: subagent\n${permission}---\n\n${body}\n`;

describe("taskAction", () => {
  const data = (task: unknown, tools?: unknown): Record<string, unknown> => ({ permission: { task }, ...(tools ? { tools } : {}) });

  it("lets the last matching rule win, with globs", () => {
    expect(taskAction(data({ "*": "deny", contextscout: "allow" }), "contextscout")).toBe("allow");
    expect(taskAction(data({ contextscout: "allow", "*": "deny" }), "contextscout")).toBe("deny");
    expect(taskAction(data({ "*": "deny", "context*": "allow" }), "contextscout")).toBe("allow");
  });

  it("treats no rule, no task block and no permission as not denied", () => {
    expect(taskAction(data({ coder: "allow" }), "contextscout")).toBe("ask");
    expect(taskAction({}, "x")).toBe("allow");
    expect(taskAction(data("deny"), "x")).toBe("deny");
    expect(taskAction({ tools: { task: false } }, "x")).toBe("deny");
  });
});

describe("lintOpenCodeDelegations", () => {
  const deny = 'permission:\n  task:\n    "*": "deny"\n    Scout: "allow"\n';

  it("v1: flags a subagent_type the agent's permission.task denies, accepts an allowed one", () => {
    const files = [
      f("v1/agent/a.md", oc("Alpha", deny, 'task(subagent_type="Scout")\ntask(subagent_type="Beta")')),
      f("v1/agent/s.md", oc("Scout", "", "s")),
      f("v1/agent/b.md", oc("Beta", "", "b")),
    ];
    const findings = lintOpenCodeDelegations(files, "v1");
    expect(findings.map((x) => [x.path, x.rule])).toEqual([["v1/agent/a.md", "delegation-not-permitted"]]);
    expect(findings[0]!.message).toContain('"Beta"');
  });

  it("v2: reads agent= values and prose imperatives against file-name ids", () => {
    const v2 = (body: string): LintFile[] => [
      f(".opencode/agent/alpha.md", `---\ndescription: d\nmode: subagent\npermission:\n  task:\n    "*": "deny"\n    contextscout: "allow"\n---\n${body}\n`),
      f(".opencode/agent/contextscout.md", "---\ndescription: d\nmode: subagent\n---\nx\n"),
      f(".opencode/agent/task-manager.md", "---\ndescription: d\nmode: subagent\n---\nx\n"),
    ];
    expect(lintOpenCodeDelegations(v2('subagent(agent="contextscout")\nALWAYS call ContextScout first.'), "v2")).toEqual([]);
    expect(rules(lintOpenCodeDelegations(v2('subagent(agent="task-manager")'), "v2"))).toEqual(["delegation-not-permitted"]);
    expect(rules(lintOpenCodeDelegations(v2("Then delegate to TaskManager."), "v2"))).toEqual(["delegation-not-permitted"]);
    expect(lintOpenCodeDelegations(v2("## Integration with TaskManager\n\n1. Orchestrator delegates to TaskManager"), "v2")).toEqual([]);
  });

  it("the committed v1 and v2 trees delegate only where permitted", () => {
    expect(lintOpenCodeDelegations(tree(repoPath(".opencode/agent")), "v2")).toEqual([]);
    expect(lintOpenCodeDelegations(tree(repoPath("hosts/opencode-v1/agent")), "v1")).toEqual([]);
  });
});

// ============================================================================
// Runner
// ============================================================================

describe("lintBuild", () => {
  it("runs each host's lints over its own files and skips targets with none", () => {
    const results = lintBuild([
      { target: "claude-code", path: "plugins/claude-code/agents/x.md", content: "---\nname: x\ndescription: d\ntools: Read\n---\ncall ContextScout now\n" },
      { target: "opencode", path: ".opencode/agent/y.md", content: "---\ndescription: d\nmode: subagent\n---\nbody\n" },
      { target: "registry", path: "registry.json", content: "{}" },
    ]);
    expect(results.map((r) => [r.target, rules(r.findings)])).toEqual([
      ["claude-code", ["delegation-without-task", "description-no-example"]],
      ["opencode", []],
    ]);
  });
});
