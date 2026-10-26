/**
 * HostsReadme — render `hosts/README.md`, the generated index of the committed per-host output.
 *
 * `hosts/` holds every host's built output side by side. Someone opening that folder should be
 * able to learn, from one page, how each AI tool's format works, where its files are mirrored
 * and who reads them, which agents ship to which host, and what each host could not express.
 * The page is generated from the same {@link BuildPlan} the build writes, so it cannot drift
 * from the tree it describes without the drift gate noticing.
 *
 * ─── Determinism ────────────────────────────────────────────────────────────────────────
 *
 * Pure function of its input. Hosts are iterated in `BUILD_TARGETS` order, agents by `oac.id`,
 * warnings in the order the adapter reported them (itself deterministic). No clock, no
 * absolute path, no locale-dependent comparison reaches the output.
 *
 * ─── When it is written ─────────────────────────────────────────────────────────────────
 *
 * Only a FULL build (every build target selected) is authoritative for this file, because it
 * describes every host. A targeted build (`--target claude-code`) neither emits, rewrites,
 * prunes nor reports it as an orphan: its ledger entry is carried forward like any other
 * unselected target's (see `owns` in `BuildPipeline.ts`). The next full build refreshes it.
 */

import type { CanonicalAgentFile } from "./AgentLoader.js";
import type { BuildFile, BuildTarget, TargetLayout } from "./BuildPipeline.js";

/** Repo-relative path of the generated index. */
export const HOSTS_README_PATH = "hosts/README.md";

/** The ledger target id that owns {@link HOSTS_README_PATH}. */
export const HOSTS_README_TARGET = "hosts-readme";

/** Human-facing facts about a host that the plan cannot know. */
interface HostInfo {
  title: string;
  /** What the folder contains and how the format works. One bullet per entry. */
  format: readonly string[];
  /** Who reads the live mirror (or the primary, when there is no mirror). */
  readBy: string;
}

const HOST_INFO: Readonly<Record<BuildTarget, HostInfo>> = {
  opencode: {
    title: "OpenCode v2 (the default)",
    format: [
      "Flat: one `<id>.md` per agent directly under `agent/`; the file name is the agent name OpenCode uses.",
      "Frontmatter: `description`, `mode` (`primary` / `subagent`), optional `temperature`, and `permission:` rules per capability (`bash`, `edit`, `task`, …) that OpenCode enforces glob by glob.",
      "No `oac:` block and no `name:` field: v2 names an agent by its file.",
    ],
    readBy:
      "this repo's own OpenCode, and installers (`oac install` / `install.sh`), which copy the paths `registry.json` lists",
  },
  "opencode-v1": {
    title: "OpenCode v1 (legacy, on request)",
    format: [
      "Nested by category: `agent/<category>/<id>.md` (e.g. `agent/subagents/code/coder-agent.md`).",
      "Frontmatter keeps a display `name:` alongside `description`, `mode`, `temperature` and `permission:`.",
      "Generated from the same canonical source as v2: every agent that ships to `opencode` (declared, or the omitted-`targets:` default) is also built here, plus agents that declare only `opencode-v1` (v1-only, e.g. one that depends on a v1-only tool).",
      "Only the agent files listed in the matrix below are build output. The other folders (`command/`, `plugin/`, `plugins/`, `skills/`, `tool/`) and the other files under `agent/` (such as `0-category.json`) are hand-maintained v1-only assets; `oac build` never writes or prunes them.",
    ],
    readBy: "installers asked for OpenCode v1, which copy the paths `registry.v1.json` lists (no live mirror)",
  },
  "claude-code": {
    title: "Claude Code",
    format: [
      "Flat: one `<name>.md` subagent per agent under `agents/`.",
      "Frontmatter is Claude's: `name`, a `description` with `<example>` blocks (how Claude Code picks an agent), and an authored `tools` / `disallowedTools` list from `oac.overrides.claude-code`. Claude Code has no per-glob permission rules, so OpenCode's `permission:` globs do not carry over (see warnings).",
      "Agents ship here by default: an `oac:` block that omits `targets:` covers every host minus `exclude` — so an agent is built here unless it declares `exclude: [claude-code]` or an explicit `targets:` list without it.",
    ],
    readBy: "the Claude Code marketplace: `.claude-plugin/marketplace.json` publishes `./plugins/claude-code`",
  },
};

/** The slice of a build plan the README needs. */
export interface HostsReadmeInput {
  /** Every planned file (primaries and mirrors), in plan order. */
  files: readonly BuildFile[];
  /** Canonical agents, sorted by `oac.id`. */
  agents: readonly CanonicalAgentFile[];
  /** The hosts to describe, in display order. */
  hosts: readonly BuildTarget[];
  /** Where each host's output goes. */
  layout: Readonly<Record<BuildTarget, TargetLayout>>;
}

function compare(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/** The folder a host owns under `hosts/` — its primary root, minus the agent subfolder. */
function hostFolder(root: string): string {
  return root.split("/").slice(0, 2).join("/");
}

/** Make a string safe inside a Markdown table cell. */
function cell(text: string): string {
  return text.replace(/\|/g, "\\|").replace(/\r?\n/g, " ");
}

/** Strip the decorative warning glyph adapters prefix their messages with. */
function plainReason(reason: string): string {
  return reason.replace(/^\s*⚠️?\s*/u, "").trim();
}

/** Path of `path` relative to `root`, which it sits under. */
function within(path: string, root: string): string {
  return path.startsWith(`${root}/`) ? path.slice(root.length + 1) : path;
}

/** Render `hosts/README.md`. Pure and deterministic. */
export function renderHostsReadme(input: HostsReadmeInput): string {
  const { agents, hosts, layout } = input;

  // Primary agent files only: mirrors repeat a primary byte-for-byte and carry no warnings.
  const primaries = input.files.filter(
    (file) => file.mirrorOf === undefined && file.agentId !== undefined && hosts.includes(file.target as BuildTarget),
  );
  const byHostAgent = new Map<string, BuildFile>();
  for (const file of primaries) byHostAgent.set(`${file.target}\u0000${file.agentId}`, file);

  const filesFor = (host: BuildTarget): BuildFile[] =>
    primaries.filter((file) => file.target === host).sort((a, b) => compare(a.agentId!, b.agentId!));

  const lines: string[] = [];
  const push = (...more: string[]): void => {
    lines.push(...more);
  };

  push(
    "<!-- GENERATED by `oac build` from content/agents/** — do not edit. -->",
    "",
    "# hosts/ — what each AI tool gets",
    "",
    "> **Generated — do not edit.** This file and every agent file under `hosts/` are build output.",
    "> Edit the canonical source in `content/agents/**` and run `oac build` (or `make build-canonical`).",
    "> A hand edit here fails the drift gate (`scripts/validation/check-build-drift.sh`).",
    "",
    "Each folder below holds one AI tool's copy of the same agents, in that tool's own format.",
    "Open a host's folder next to its canonical source to see how the format differs.",
    "",
    "## How it works",
    "",
    "1. **One canonical source.** Every agent is one file in `content/agents/**`: OpenCode-shaped",
    "   frontmatter plus an `oac:` block (`id`, `category`, and where it ships: omit `targets:`",
    "   to ship to every host minus `exclude`, or list `targets:` explicitly).",
    "2. **Per-host adjustments live in that same file.**",
    "   - `oac.overrides.<host>` replaces frontmatter fields for one host (for Claude Code: the",
    "     authored `tools` list and a `description` with `<example>` blocks).",
    "   - `<!-- oac:only <host> -->` … `<!-- /oac:only -->` blocks keep body text for the named",
    "     host(s) only, e.g. \"context is pre-loaded\" for Claude agents in place of OpenCode's",
    "     \"call ContextScout\".",
    "3. **One adapter per host** turns canonical into that host's format. Anything the host cannot",
    "   express is dropped and reported as a degradation warning, listed per agent below.",
    "4. **Output lands in `hosts/<host>/`.** Live paths are byte-identical mirrors of it. Every",
    "   written file is recorded in `.oac/build-manifest.json`, the ledger that orphan pruning and",
    "   `oac build --check` read.",
    "",
    "Why it is built this way: D-017 in [docs/lessons-learnt/decisions.md](../docs/lessons-learnt/decisions.md).",
    "OpenCode v1 vs v2: [docs/features/opencode-v1-and-v2.md](../docs/features/opencode-v1-and-v2.md).",
    "",
    "## Hosts",
    "",
    "| Host | Folder | Agents | Warnings | Live mirror | Read by |",
    "| --- | --- | ---: | ---: | --- | --- |",
  );

  for (const host of hosts) {
    const files = filesFor(host);
    const warnings = files.reduce((sum, file) => sum + file.warnings.length, 0);
    const mirrors = layout[host].mirrors;
    const mirror = mirrors.length === 0 ? "—" : mirrors.map((m) => `\`${m}/\``).join(", ");
    push(
      `| \`${host}\` | \`${hostFolder(layout[host].root)}/\` | ${files.length} | ${warnings} | ${mirror} | ${cell(HOST_INFO[host].readBy)} |`,
    );
  }

  for (const host of hosts) {
    const info = HOST_INFO[host];
    const { root, mirrors } = layout[host];
    push("", `### \`${host}\` — ${info.title}`, "", `Built agents: \`${root}/\`.`, "");
    for (const bullet of info.format) push(`- ${bullet}`);
    if (mirrors.length > 0) {
      push(
        `- Mirrored byte-for-byte to ${mirrors.map((m) => `\`${m}/\``).join(", ")}, read by ${info.readBy}.`,
        "  The mirror is generated too: edit neither copy.",
      );
    } else {
      push(`- Read by ${info.readBy}.`);
    }
  }

  push(
    "",
    "## Agents by host",
    "",
    "Each cell is the agent's file under that host's agent folder; `—` means the agent does not",
    "target that host. Warnings counts the degradation warnings across all hosts.",
    "",
    `| Agent (\`oac.id\`) | Source (under \`content/agents/\`) | ${hosts.map((host) => `\`${host}\``).join(" | ")} | Warnings |`,
    `| --- | --- | ${hosts.map(() => "---").join(" | ")} | ---: |`,
  );

  for (const agent of agents) {
    const id = agent.oac.id;
    let warnings = 0;
    const cells = hosts.map((host) => {
      const file = byHostAgent.get(`${host}\u0000${id}`);
      if (file === undefined) return "—";
      warnings += file.warnings.length;
      return `\`${within(file.path, layout[host].root)}\``;
    });
    push(`| \`${id}\` | \`${agent.relativePath}\` | ${cells.join(" | ")} | ${warnings} |`);
  }

  push(
    "",
    "## Degradation warnings",
    "",
    "What each host could not express for each agent, and why. A warning is never fatal on its",
    "own (`oac build --strict` makes it so); it records a capability or setting the host",
    "drops, so you know the built agent is less constrained or less tuned than its source.",
  );

  for (const host of hosts) {
    const withWarnings = filesFor(host).filter((file) => file.warnings.length > 0);
    push("", `### \`${host}\``, "");
    if (withWarnings.length === 0) {
      push("None: every agent carries over completely.");
      continue;
    }
    for (const file of withWarnings) {
      push(`- **\`${file.agentId}\`** → \`${file.path}\``);
      for (const warning of file.warnings) push(`  - ${plainReason(warning.reason)}`);
    }
  }

  return `${lines.join("\n")}\n`;
}
