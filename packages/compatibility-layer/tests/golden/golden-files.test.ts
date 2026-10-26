/**
 * Golden-file snapshots — per adapter, per agent.
 *
 * Two corpora, on purpose:
 *
 *   1. `fixtures/` + `expected/` — 2 agents x 2 targets, controlled input. These pin the
 *      details a live corpus does not happen to exercise (a deny-all-then-allowlist bash
 *      block that Claude Code cannot represent, and must therefore fail CLOSED).
 *
 *   2. `plugins/claude-code/agents/` — the 7 committed Claude Code agents. They are build
 *      output, emitted in place from `content/agents/**` via `oac.overrides.claude-code`
 *      (frontmatter) and `<!-- oac:only -->` host blocks (body) (D-017). The committed tree
 *      must equal a fresh build byte-for-byte, so a hand-edit or an un-rebuilt source change
 *      fails here as well as in the drift gate. L-001 (`104356a` overwriting the hand-adapted
 *      files with build output that had lost its dispatch examples) is why this is asserted
 *      on content and paired with the capability lint, not left to review.
 *
 * ─── On the expected/ files being a specification ───────────────────────────────────────
 *
 * The adapters do not exist yet, so `expected/` was authored from the live formats rather
 * than captured from a run: the OpenCode files mirror `.opencode/agent/**` frontmatter minus
 * the `oac:` block; the Claude Code files mirror `plugins/claude-code/agents/**`. They are a
 * SPEC, and they are red until subtasks 06/07 land. If an adapter emits different-but-better
 * bytes, update these files deliberately and say why in the commit — that is the gate
 * working, not the gate being wrong. What must NOT happen is an adapter being relaxed to
 * match a golden, or a golden being regenerated blindly from adapter output.
 *
 * ─── The tool ordering rule, recovered from the live corpus ─────────────────────────────
 *
 * Verified 2026-07-15 against all 7 live agents: `tools:` and `disallowedTools:` are both
 * ordered `Read, Write, Edit, Glob, Grep, Bash, WebFetch, Task`. Every one of the 10 lists
 * across those files is consistent with it, and it is the ONLY total order that is —
 * alphabetical is not (`context-manager.md` is `Read, Write, Glob, Grep, Bash`), and neither
 * is `ToolAccessSchema` field order (which would put Bash before Glob/Grep). Subtask 07 must
 * emit this order or the 7 will not reproduce.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { basename, join, relative, sep } from "node:path";
import {
  importPendingSymbols,
  listFiles,
  packagePath,
  repoPath,
  requireMethod,
} from "../support/pending.js";

const FIXTURES = packagePath("tests/golden/fixtures");
const EXPECTED = packagePath("tests/golden/expected");
const LIVE_CC_AGENTS = repoPath("plugins/claude-code/agents");

/** The canonical emit order for Claude Code tool lists, recovered from the live corpus. */
export const CLAUDE_TOOL_ORDER = [
  "Read",
  "Write",
  "Edit",
  "Glob",
  "Grep",
  "Bash",
  "WebFetch",
  "Task",
] as const;

const TARGETS = ["opencode", "opencode-v1", "claude-code"] as const;
const AGENTS = ["fixture-reviewer", "fixture-planner"] as const;

interface Adapter {
  fromCanonical(source: string): Promise<{ content: string; warnings?: string[] }>;
}

const ADAPTER_MODULE: Record<(typeof TARGETS)[number], { path: string; symbol: string; owedBy: string }> = {
  opencode: {
    path: "src/adapters/OpenCodeAdapter.ts",
    symbol: "OpenCodeAdapter",
    owedBy: "subtask 06 (src/adapters/OpenCodeAdapter.ts)",
  },
  "opencode-v1": {
    path: "src/adapters/v1/OpenCodeV1Adapter.ts",
    symbol: "OpenCodeV1Adapter",
    owedBy: "the opencode-v1 target (src/adapters/v1/OpenCodeV1Adapter.ts)",
  },
  "claude-code": {
    path: "src/adapters/ClaudeAdapter.ts",
    symbol: "ClaudeAdapter",
    owedBy: "subtask 07 (src/adapters/ClaudeAdapter.ts)",
  },
};

async function adapterFor(target: (typeof TARGETS)[number], why: string): Promise<Adapter> {
  const { path, symbol, owedBy } = ADAPTER_MODULE[target];
  const module = await importPendingSymbols<Record<string, new () => Adapter>>(
    path,
    [symbol],
    owedBy,
    why
  );
  // ClaudeAdapter already exists and speaks the old `fromOAC` interface, so the symbol probe
  // alone would let this through and fail as a bare TypeError. Name the gap instead.
  return requireMethod(new module[symbol]!(), "fromCanonical", owedBy, why);
}

function fixture(agent: string): string {
  return readFileSync(join(FIXTURES, `${agent}.md`), "utf-8");
}

function golden(target: string, agent: string): string {
  return readFileSync(join(EXPECTED, target, `${agent}.md`), "utf-8");
}

// ============================================================================
// Green today — the corpora themselves are well-formed
// ============================================================================

describe("golden corpus", () => {
  it("has a fixture and both goldens for each agent", () => {
    for (const agent of AGENTS) {
      expect(() => fixture(agent), `fixtures/${agent}.md`).not.toThrow();
      for (const target of TARGETS) {
        expect(() => golden(target, agent), `expected/${target}/${agent}.md`).not.toThrow();
      }
    }
  });

  it("keeps the oac: block out of every golden — it is authoring-only", () => {
    for (const target of TARGETS) {
      for (const agent of AGENTS) {
        expect(golden(target, agent), `expected/${target}/${agent}.md leaks the oac: block`).not.toContain(
          "oac:"
        );
      }
    }
  });

  it("fails closed in the claude-code golden: an unrepresentable bash allowlist becomes a deny", () => {
    // fixture-planner authorises `git status` / `git log*` AFTER a catch-all bash deny.
    // Claude Code has no ordered-glob equivalent, so the only safe degradation is to deny
    // Bash outright. A golden that listed Bash under `tools:` would be silently widening
    // access — the exact failure mode the permission work exists to prevent.
    const emitted = golden("claude-code", "fixture-planner");

    expect(emitted).toMatch(/^disallowedTools:.*\bBash\b/m);
    expect(emitted).not.toMatch(/^tools:.*\bBash\b/m);
  });

  it("orders every live tool list by the canonical order", () => {
    const rank = (tool: string): number => {
      const at = CLAUDE_TOOL_ORDER.indexOf(tool as (typeof CLAUDE_TOOL_ORDER)[number]);
      expect(at, `"${tool}" is not in CLAUDE_TOOL_ORDER`).toBeGreaterThanOrEqual(0);
      return at;
    };

    for (const file of listFiles(LIVE_CC_AGENTS)) {
      for (const key of ["tools", "disallowedTools"]) {
        const line = new RegExp(`^${key}: (.+)$`, "m").exec(readFileSync(file, "utf-8"));
        if (line === null) continue;

        const tools = line[1]!.split(",").map((tool) => tool.trim());
        expect(tools, `${basename(file)} ${key}:`).toEqual(
          [...tools].sort((a, b) => rank(a) - rank(b))
        );
      }
    }
  });
});

// ============================================================================
// RED — adapters must reproduce the goldens
// ============================================================================

describe.each(TARGETS)("%s adapter goldens", (target) => {
  it.each(AGENTS)(`reproduces expected/${target}/%s.md byte-for-byte`, async (agent) => {
    const adapter = await adapterFor(
      target,
      `emitting fixtures/${agent}.md for ${target} reproduces expected/${target}/${agent}.md exactly`
    );

    const { content } = await adapter.fromCanonical(fixture(agent));

    expect(content).toBe(golden(target, agent));
  });
});

describe("claude-code adapter against the live corpus", () => {
  const OWED_BY = "subtasks 07 + 09 (ClaudeAdapter + content/agents/)";

  it("refuses to emit an agent that never says what it may do on Claude Code", async () => {
    // This once asserted that an ordered rule list degraded fail-closed with a warning. It no
    // longer degrades, and the tool list is no longer derived from `permission:` at all.
    // Claude Code cannot enforce a per-agent scope by any route (flat frontmatter lists;
    // session-wide settings.json rules; plugins barred from shipping rules), so there is
    // nothing to compute: every automatic answer is either a crippled agent or a silent
    // widening. The tools are authored, and an agent that omits them is incomplete — which is
    // an error, not a cue to pick a default.
    const adapter = await adapterFor(
      "claude-code",
      "an agent targeting claude-code without an authored tools list is refused, not defaulted"
    );

    // fixture-planner carries an override, so build the un-authored case out of it.
    const unruled = fixture("fixture-planner").replace(
      /  overrides:\n    claude-code:\n(?:      .*\n)*/,
      ""
    );

    expect(unruled, "the override block must actually be gone").not.toContain("overrides:");

    await expect(adapter.fromCanonical(unruled)).rejects.toThrow(
      /declares no oac\.overrides\.claude-code\.tools/
    );
  });

  it("honours an authored override verbatim", async () => {
    const adapter = await adapterFor(
      "claude-code",
      "an authored override is honoured verbatim, with no projection involved"
    );

    const { content, warnings } = await adapter.fromCanonical(fixture("fixture-planner"));

    // fixture-planner's canonical bash block is deny-all-then-allowlist; its override grants
    // only Read, so Bash lands in disallowedTools because the AUTHOR said so — not because a
    // projection worked it out.
    expect(content).toMatch(/^tools: Read$/m);
    expect(content).toMatch(/^disallowedTools:.*\bBash\b/m);
    expect((warnings ?? []).filter((w) => /permission|enforce/i.test(w))).toEqual([]);
  });

  // The 7 committed Claude Code agents are build output (D-017). L-001 is why this asserts
  // bytes rather than shape: `104356a` shipped build output that had lost every `<example>`
  // dispatch block, and only a content comparison against a reviewed tree catches that.
  it("the committed plugins/claude-code/agents equal fresh build output byte-for-byte", async () => {
    const { plan } = await importPendingSymbols<{
      plan: (options: { root: string; targets: string[]; skipRegistry: boolean }) => Promise<{
        files: { path: string; target: string; content: string; mirrorOf?: string }[];
      }>;
    }>("src/core/BuildPipeline.ts", ["plan"], OWED_BY, "the claude-code target emits in place");

    const built = await plan({ root: repoPath(), targets: ["claude-code"], skipRegistry: true });
    const all = built.files.filter((file) => file.target === "claude-code");
    // The primary output is hosts/claude-code/agents; plugins/claude-code/agents is its mirror.
    const primary = all.filter((file) => file.mirrorOf === undefined);
    const emitted = all.filter((file) => file.mirrorOf !== undefined);
    const live = listFiles(LIVE_CC_AGENTS);

    expect(primary.length, "the claude-code target should emit 7 agents").toBe(7);
    expect(primary.every((file) => file.path.startsWith("hosts/claude-code/agents/"))).toBe(true);
    expect(emitted.map((file) => file.mirrorOf).sort()).toEqual(primary.map((file) => file.path).sort());
    for (const file of primary) {
      expect(readFileSync(repoPath(file.path), "utf-8"), `${file.path} differs from the build`).toBe(file.content);
    }
    // Same set of paths: nothing the build emits is missing, nothing committed is unclaimed.
    expect(live.map((file) => relative(repoPath(), file).split(sep).join("/")).sort()).toEqual(
      emitted.map((file) => file.path).sort()
    );

    for (const file of emitted) {
      const text = readFileSync(repoPath(file.path), "utf-8");
      expect(text, `${file.path} differs from the build — run \`oac build\``).toBe(file.content);
      expect(text, `${file.path}: lost its <example> dispatch blocks`).toContain("<example>");
    }
  });
});
