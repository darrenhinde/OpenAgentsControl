# Community Sentiment and Adoption Dynamics: AI Coding Agent Frameworks and OpenAgentsControl (as of 2026-10-16)

Method note: GitHub metrics were pulled directly from the GitHub REST/GraphQL API on 2026-10-16 (primary data). Web sentiment came from WebSearch/HN Algolia. Reddit's JSON API was blocked, so I have no direct Reddit thread data. Search summaries from aggregator blogs are flagged as such.

## 1. OAC: GitHub metrics, open-issue themes, release cadence, mentions and reviews

### Takeaway
OAC has 4,910 stars and 406 forks as of 2026-10-16, about 1/60th of superpowers. Star growth has slowed sharply: about 1,000 stars a month in Jan-Feb 2026, about 100 in the last five weeks. There has been no GitHub release since v0.7.1 (2026-01-30). Open issues are dominated by install failures, the OpenCode v2 break, the Claude Code plugin not working, and context-discovery slowness. I found almost no independent coverage (Reddit, HN, YouTube). A community fork now calls upstream "unmaintained".

### Cited Findings
**Repo metrics (GitHub API, 2026-10-16)**
- darrenhinde/OpenAgentsControl: 4,910 stars, 406 forks, 38 watchers, 71 open issues+PRs (29 of them open PRs), 83 closed issues, 23 discussions. Created 2025-08-14, last push 2026-09-13 — [GitHub API](https://api.github.com/repos/darrenhinde/OpenAgentsControl)
- The description still says "built for OpenCode". It does not mention Claude Code — [GitHub repo](https://github.com/darrenhinde/OpenAgentsControl)
- A third-party blog cited 4,581 stars and 366 forks, "active development through July 2026" (Aug 1 2026 post), which is consistent with the API trend — [Bright Coding blog, 2026-08-01](https://www.blog.brightcoding.dev/2026/08/01/darrenhindeopenagents-ai-code-generation-that-learns-your-patterns)

**Star velocity**, sampled from stargazer timestamps (each page = 100 stars) — [GitHub stargazers API](https://api.github.com/repos/darrenhinde/OpenAgentsControl/stargazers)
- Stars 1-100: 2025-08-19 to 2025-10-31
- Star ~1,000: 2026-01-18
- Star ~2,000: about 2026-02-16, so about 1,000 in roughly 4 weeks (peak)
- Star ~3,000: 2026-03-28, about 1,000 in roughly 6 weeks
- Star ~4,000: about 2026-05-17, about 1,000 in roughly 7 weeks
- Star ~4,500: about 2026-07-10, about 500 in roughly 8 weeks
- Star ~4,900: 2026-09-08 to 2026-10-13, about 400 from July to Sept, then about 100 in the latest five weeks
- Most recent star: 2026-10-15

**Release and commit cadence**
- GitHub releases: v0.0.1 (2025-11-26), v0.3.1 (2025-12-09), v0.3.2/v0.3.3/v0.5.0 (2025-12-18), v0.5.2 (2026-01-17), v0.5.5 (2026-01-27), v0.7.0 (2026-01-29), v0.7.1 (2026-01-30). Nothing since — [Releases](https://github.com/darrenhinde/OpenAgentsControl/releases)
- The last 100 default-branch commits by month: Nov-25: 3, Dec-25: 19, Jan-26: 36, Feb-26: 24, Mar-26: 9, Apr-Jun: 0, Jul-26: 9, Aug-Oct: 0 — [GitHub commits API](https://api.github.com/repos/darrenhinde/OpenAgentsControl/commits)
  - Context: the local `refactor/canonical` branch has unreleased work (CLI tiered install, profile installs, doctor). It is not yet visible to users.
- Fork apilot/OpenAgentsControl (created 2026-10-01, 0 stars) says: "Community fork (active development). Upstream is unmaintained." It advertises OpenCode v2 plugin support, an `oac` CLI, machine-verified task completion and 345 tests — [apilot fork README](https://github.com/apilot/OpenAgentsControl)

**Open-issue themes** (titles and dates from `gh issue list`, 2026-10-16) — [Issues](https://github.com/darrenhinde/OpenAgentsControl/issues)
- **OpenCode v2 breakage:**
  - #367 (2026-10-14) port AbilitiesPlugin to the v2 plugin API
  - #362 (2026-09-19) v2 profile names are displayed wrong
  - #353 (2026-08-25) "opencode 2.0 codemode"
  - #349 (2026-08-13) `"*": "deny"` permission rules hide the tool entirely under current opencode
- **Install failures:**
  - #237 (2026-02-22): "Could not find path for context:core/config/paths.json". At least 5 users said "same problem" (CachyOS, WSL Ubuntu, fish), and a community member posted a workaround — [#237](https://github.com/darrenhinde/OpenAgentsControl/issues/237)
  - #304 Windows install failed; #277 missing agent-metadata.json; #266 asks for a clean uninstall guide
- **Claude Code plugin broken:** #281 (2026-03-21): after `/plugin install oac`, `/oac:context-setup` and `/oac:setup` are reported as "unknown skills". No replies — [#281](https://github.com/darrenhinde/OpenAgentsControl/issues/281)
- **Scope and positioning mismatch:** #283 (2026-03-22): "it's not disclosed that this framework is tied to JS frontend development". The README's "Any language*" was misleading, and UI workflows don't apply to native or mobile apps. A commenter replied: "Yes, that's disappointing. It still works though - but not for UI." — [#283](https://github.com/darrenhinde/OpenAgentsControl/issues/283)
- **Slowness and model sensitivity:**
  - #258 (2026-03-09): "It takes GPT (any GPT model) upwards of 10 minutes to find OpenAgentsControl context", while vanilla plan/build mode is fast. The maintainer attributed it to GPT's strict instruction-following. Another user asked why context is "repeatedly searched" and suggested Kilocode's approach — [#258](https://github.com/darrenhinde/OpenAgentsControl/issues/258)
  - #236 gate-skipping with Kimi K2.5; #317 Cerebras model errors
- **Context path confusion:** #321 `/add-context` writes to the global path by default; #310 "ContextScout No .opencode/context/ directory exists"
- **Feature requests:**
  - #361 Cursor adapter; #346 OpenClaw adapter (with PR #347); #36 general compatibility layer
  - #142 npm/marketplace distribution; #135 per-agent model selection (8 comments)
  - #33 Skills/Abilities system (20 comments, the most-discussed issue); #54 spec-kit integration docs; #165 ADR-style decisions
- **Spam and noise:** #278 and #282 are crypto/"MEEET" agent spam, and #289/#293 are unclosed bot "auto-sync" issues. These signal light triage.

**Mentions and reviews**
- HN Algolia: 0 hits for "OpenAgentsControl". The only relevant HN mention found is a 2026-03-31 comment on "An Opinionated Agentic Engineering Workflow" asking why the author built their own skills "instead of using an existing one like get-shit-done or OpenAgent Control?" — [HN item 47586562](https://news.ycombinator.com/item?id=47586562)
- Web search found no Reddit threads or YouTube reviews of OAC (searched 2026-10-16). The only third-party write-ups are promotional-style posts on Bright Coding — [Bright Coding, 2026-02-19](https://www.blog.brightcoding.dev/2026/02/19/openagentscontrol-the-revolutionary-ai-agent-framework); [Bright Coding, 2026-08-01](https://www.blog.brightcoding.dev/2026/08/01/darrenhindeopenagents-ai-code-generation-that-learns-your-patterns)
- Bright Coding notes that OAC "requires explicit approval at every execution step (Propose → Approve → Execute)", which it frames as added latency — [Bright Coding, 2026-08-01](https://www.blog.brightcoding.dev/2026/08/01/darrenhindeopenagents-ai-code-generation-that-learns-your-patterns)
- Only direct comparison found: Discussion #116 "Compare with Oh My OpenCode" (2026-01-23) — [Discussion #116](https://github.com/darrenhinde/OpenAgentsControl/discussions/116)
  - User ramonskie: "i just removed 'oh my opencode'. as with every release it seems to burn more and more tokens"
  - User ret1: after oh-my-opencode 3, "after just a few minutes i hit my 4 hour limit with Claude Pro"
  - The maintainer positioned OAC around "repeatable behaviour" and "made for teams"
- OAC skills are indexed on third-party skill directories, e.g. verified-skill.com — [verified-skill code-review](https://verified-skill.com/skills/darrenhinde/openagentscontrol/code-review)
- Positive maintainer-user interaction exists. In #121 the maintainer cautioned a user that they "might be over engineering" a plugin modpack — [#121](https://github.com/darrenhinde/OpenAgentsControl/issues/121)

### Inferences
- The star curve (peak Jan-Feb 2026, decaying since) lines up with the OpenCode surge after Anthropic's Jan 2026 OAuth block (section 3). OAC rode OpenCode's wave and has not had its own growth engine since. The lack of releases after January and the unanswered plugin bug (#281) probably reinforced the slowdown.
- OAC's main weak points line up with the category's top complaints:
  - fragile installs
  - breakage on host updates (OpenCode v2)
  - slowness from context discovery
  - unclear scope (JS bias)
- The "unmaintained" claim from a 0-star fork is a reputational risk if it spreads. Shipping the pending refactor/CLI and an OpenCode v2 port is the direct counter.
- OAC's differentiator (approval gates, repeatability, team patterns) does show up in user language: users chose it over oh-my-opencode because of token burn. Its pitch is "controlled and token-efficient", against "maximal autonomy" peers.

### Gaps
- No direct Reddit data (Reddit's API blocked the fetch, and search returned no threads). I could not verify whether OAC is discussed in r/opencode or r/ClaudeCode.
- No YouTube review data found. Mentions on X of @DarrenBuildsAI's own posts were not measured (no X API access).
- I don't know the Claude Code plugin install count for OAC, or npm download counts if any.
- Star velocity is sampled from 8 pages, not a full time series.

## 2. Common complaints about workflow frameworks (superpowers, BMAD, SuperClaude, oh-my-opencode, claude-flow/ruflo, spec-kit)

### Takeaway
The complaints repeat across the category:
- **Token and context bloat:** oh-my-opencode, SuperClaude, ruflo
- **Over-engineering and "waterfall in markdown":** spec-kit, BMAD
- **Slowness:** BMAD, spec-kit
- **Inflated or fabricated claims:** ruflo
- **Breakage on host or package changes:** OpenCode v2, the oh-my-opencode rename, Anthropic's OAuth block

Superpowers draws the fewest complaints. Its idle footprint is small because skills load on demand.

### Cited Findings
**Token bloat and limits**
- **oh-my-opencode:**
  - Users report a single query hitting the session limit on a Max 20x plan. Issue #115: "switching to API burns $15–20 in 30 minutes" — summarized via [jeongil.dev](https://jeongil.dev/en/blog/trends/claude-code-agent-teams/) and [OpenCode issue #6930](https://github.com/anomalyco/opencode/issues/6930)
  - OAC discussion users: "as with every release it seems to burn more and more tokens" — [OAC Discussion #116](https://github.com/darrenhinde/OpenAgentsControl/discussions/116)
- **SuperClaude:**
  - Issue #286 reports that memory files and agents take a large share of context, mostly SuperClaude prompts. One user's AI-assisted estimate is about 8K tokens, with roughly 60% trimmable — [SuperClaude #286](https://github.com/SuperClaude-Org/SuperClaude_Framework/issues/286)
  - The claimed 30-50% "token-efficiency" savings are unverified; one reviewer: "I'm not going to validate those numbers" — [vibecodinghub review](https://vibecodinghub.org/blog/superclaude-review)
- **ruflo (claude-flow):**
  - An audit request on awesome-claude-code says the "30-50% token reduction" claim is fabricated and that ruflo adds about 15,000-25,000 tokens per session — [awesome-claude-code #1338](https://github.com/hesreallyhim/awesome-claude-code/issues/1338)
  - A third-party gist claims about 10 of 300+ MCP tools are real and the rest are stubs, with "neural training" returning Math.random(). One author, unverified — [gist roman-rr](https://gist.github.com/roman-rr/ed603b676af019b8740423d2bb8e4bf6)
  - ruflo's own 2026-05-29 self-audit found headline performance multipliers were "hardcoded doc strings with no benchmark", one "fabricated at runtime". It also found the self-learning loop was real — [ruflo intelligence-system audit](https://github.com/ruvnet/ruflo/blob/main/docs/reviews/intelligence-system-audit-2026-05-29.md)
  - A deep-dive calls ruflo "the most serious open-source attempt I've used at making multi-agent coding actually coordinate", but says the 75% figure isn't publicly benchmarked — [sublimecoding](https://sublimecoding.com/blog/ruflo-claude-flow-multi-agent-deep-dive)
- **Spec-kit vs superpowers:** one blog estimates spec-kit at about 5-15K tokens of markdown per feature, re-sent as implementation grows, and superpowers' idle footprint at about 2KB (one line per skill). Superpowers' cost shows up in sub-agent context rebuilds — [martianlee, 2026-06-01](https://martianlee.github.io/posts/2026-06-01-spec-kit-vs-superpowers)

**Over-engineering, document sprawl, slowness**
- **Spec-kit:**
  - Birgitta Böckeler (martinfowler.com) found spec-kit created "a LOT of markdown files" that were repetitive and "overkill for the size of the problem". She compares SDD to model-driven development — [Martin Fowler: SDD tools](https://martinfowler.com/articles/exploring-gen-ai/sdd-3-tools.html) (seen via secondhand summaries)
  - Scott Logic: one Spec Kit feature produced 2,577 lines of markdown for 689 lines of code, and a bug shipped anyway — [Scott Logic, 2025-11-26](https://blog.scottlogic.com/2025/11/26/putting-spec-kit-through-its-paces-radical-idea-or-reinvented-waterfall.html)
  - "Waterfall strikes back" critique — [Marmelab, 2025-11-12](https://marmelab.com/blog/2025/11/12/spec-driven-development-waterfall-strikes-back.html)
- **BMAD:**
  - The analyst agent "created 500+ page brief from 440+ page summary", and templates force requirements into single massive documents — [BMAD #446](https://github.com/bmad-code-org/BMAD-METHOD/issues/446)
  - Structural contradictions in v6 — [BMAD #2003](https://github.com/bmad-code-org/BMAD-METHOD/issues/2003)
  - Even advocates skip BMAD for small changes ("overkill") — [dev.to bspann](https://dev.to/bspann/bmad-method-claude-code-how-i-actually-ship-projects-with-spec-driven-ai-development-1eei)
  - A reported benchmark of 5.5 h with BMAD vs 12 min with OpenSpec, via a search summary (secondary, unverified) — [codemyspec](https://codemyspec.com/blog/bmad-method-explained)

**Breakage on host or ecosystem changes**
- **OpenCode v2** (Sept 2026; sources disagree on 09-11 vs 09-24):
  - V1 plugins "do not run in V2" and must be ported; config keys renamed (`task` to `subagent`, `agent` to `agents`); permissions become an ordered array — [OpenCode v2 migration guide](https://opencode.ai/v2/docs/migrate-v1/)
  - Plugins report silent or startup-warning failures — [byteiota](https://byteiota.com/opencode-v2-your-plugins-are-broken-here-is-what-changed/); [dev.to fable7](https://dev.to/fable7/opencode-2-has-3-breaking-changes-1-broke-my-startup-538p)
  - OpenCode 1.19.0 (2026-10-12) opened the upgrade path — [AICoder](https://aicoder.com/news/news-20261012-opencode-2-upgrade-path-v1-19)
- **oh-my-opencode rename:** the rename to oh-my-openagent (v3.11.0, 2026-03-07) made the old package stop loading "without any error message or warning" — [oh-my-openagent #2823](https://github.com/code-yeongyu/oh-my-openagent/issues/2823)
- **Anthropic OAuth block:**
  - On 2026-01-09 Anthropic blocked Claude Pro/Max subscription OAuth in third-party harnesses, and made it explicit on 2026-02-19. In a ban report, one commenter suspected oh-my-opencode as "the common denominator", which another user disputed — [OpenCode #6930](https://github.com/anomalyco/opencode/issues/6930); [HN 46549823](https://news.ycombinator.com/item?id=46549823); [HN 46625918](https://news.ycombinator.com/item?id=46625918); [The New Stack](https://thenewstack.io/anthropic-claudecode-opencode-split/)

**Install and uninstall friction**
- SuperClaude's installer history (pip/pipx/npm/uv; "uninstall V3 first") led to a marker-based, dry-run uninstaller — [SuperClaude Plugin README](https://github.com/SuperClaude-Org/SuperClaude_Plugin/blob/main/README.md)
- OAC's #237 and #266 show the same pain — see section 1

### Inferences
- **Token cost** is the most emotionally charged complaint. Users on subscription plans feel it as hitting limits, and they drop frameworks over it (oh-my-opencode to OAC in #116).
- **"Overkill for small tasks"** is universal for process-heavy frameworks. Successful ones either scale down (superpowers' on-demand skills) or users bypass them for small work.
- **Credibility of claims** is now policed by the community (ruflo audits, awesome-list disclaimers). Unbenchmarked "X% savings" claims are a liability.
- **Host churn** is a structural risk for any add-on layer: OpenCode v2, Claude Code plugin format changes, Anthropic ToS. Multi-host frameworks pay this cost per host.

### Gaps
- No systematic or quantitative study of framework token overhead. All figures are single-author or self-reported.
- Little superpowers-specific criticism surfaced. A dedicated search, e.g. "Superpowers in 2026: still worth it after Fable 5?", exists but was not fetched — [mcp.directory](https://mcp.directory/blog/superpowers-skill-worth-it-2026)

## 3. Recurring feature requests and what made breakout projects succeed

### Takeaway
The breakouts share four traits:
- a credible founder or endorsement
- one-command distribution through the host's plugin system or marketplace
- a small idle footprint and a clear single idea
- riding a host-platform moment

Superpowers has 300K stars: a Simon Willison endorsement, Claude Code's plugin launch, and auto-triggering skills. Spec-kit has 141K stars: GitHub's brand and multi-agent support. oh-my-opencode has 70K stars: the OpenCode surge after Anthropic's January 2026 block, with a "batteries included" pitch.

### Cited Findings
**Peer GitHub stars, 2026-10-16 (GitHub API)**

| Project | Stars | Forks | Open issues | Notes |
|---|---|---|---|---|
| [obra/superpowers](https://github.com/obra/superpowers) | 300,412 | 26,820 | 368 | |
| [github/spec-kit](https://github.com/github/spec-kit) | 141,507 | 12,671 | 178 | |
| [ruvnet/ruflo](https://github.com/ruvnet/ruflo) | 75,446 | 8,951 | 1,058 | formerly claude-flow |
| [code-yeongyu/oh-my-openagent](https://github.com/code-yeongyu/oh-my-openagent) | 70,103 | 5,768 | 1,370 | formerly oh-my-opencode |
| [gsd-build/get-shit-done](https://github.com/gsd-build/get-shit-done) | 64,284 | | | last push 2026-05-31 |
| [bmad-code-org/BMAD-METHOD](https://github.com/bmad-code-org/BMAD-METHOD) | 54,220 | 6,094 | | |
| [SuperClaude-Org/SuperClaude_Framework](https://github.com/SuperClaude-Org/SuperClaude_Framework) | 23,910 | 1,993 | | |
| [anomalyco/opencode](https://github.com/anomalyco/opencode) (host) | 214,201 | | | |
| OAC | 4,910 | | | |

**Superpowers' growth path**
- Simon Willison's 2025-10-10 post "Superpowers: How I'm using coding agents in October 2025" calls Jesse Vincent "one of the most creative users of coding agents… that I know". It framed superpowers as a plugin, timed to Claude Code's plugin launch — [Simon Willison](https://simonwillison.net/2025/Oct/10/superpowers/)
- O'Reilly live event with Tim O'Reilly — [O'Reilly](https://www.oreilly.com/live-events/give-your-agents-superpowers-jesse-vincent-live-with-tim-oreilly/0642572444747/)
- Commercial backing via Prime Radiant — [Wikipedia: Jesse Vincent](https://en.wikipedia.org/wiki/Jesse_Vincent)
- Reported star trajectory: about 93K (Mar 2026) and about 225K (Jun 2026), from secondary sources; 300K per the API now — [rywalker](https://rywalker.com/research/superpowers-skills-framework)
- A community article reports 941K installs from the official Claude plugin marketplace (mid-July 2026). Unverified aggregator claim — [mdskills](https://www.mdskills.ai/plugins/superpowers)
- Users praise that skills "trigger automatically" and the startup script is "clear and compact" — [joanmedia](https://www.joanmedia.dev/ai-blog/superpowers-explained-the-plugin-that-turned-a-development-methodology-into-markdown)

**oh-my-opencode's growth path**
- In early Jan 2026 a tweet showed about 253 stars — [X @clxymox](https://x.com/clxymox/status/2012101518674280837)
- Its rise coincided with "157,000 developers hedging against Anthropic with OpenCode" after the January OAuth block — [The New Stack](https://thenewstack.io/anthropic-claudecode-opencode-split/)
- Pitch: "batteries-included", async subagents "like Claude Code", curated models, LSP/AST tools, a Claude Code compatibility layer — [opensoft mirror README](https://github.com/opensoft/oh-my-opencode)
- Positive HN user report (omo with Opus 4.6 and GPT-5.4) — [HN 47645188](https://news.ycombinator.com/item?id=47645188)

**Spec-kit:** GitHub-owned. The SDD wave got analyst coverage (martinfowler.com) even where critical — [Martin Fowler](https://martinfowler.com/articles/exploring-gen-ai/sdd-3-tools.html)

**Feature requests seen across OAC issues** — [OAC issues](https://github.com/darrenhinde/OpenAgentsControl/issues)
- multi-host adapters (Cursor, OpenClaw, a general compatibility layer)
- per-agent model selection
- skills/abilities
- npm and marketplace distribution
- clean uninstall
- faster context lookup
- spec-kit interop

**Feature requests seen across the category**
- token-efficiency modes (SuperClaude, ruflo marketing)
- feature-driven, brownfield-friendly flows (BMAD #446) — [BMAD #446](https://github.com/bmad-code-org/BMAD-METHOD/issues/446)
- enforced rather than conventional spec adherence — [Martin Fowler](https://martinfowler.com/articles/exploring-gen-ai/sdd-3-tools.html)

### Inferences
- **Distribution plus endorsement beats features.** Superpowers' inflection was a trusted voice and native plugin install on launch week. OAC has a Claude Code marketplace path, but #281 suggests it was broken for at least some users, which wastes the cheapest growth channel.
- **Host-platform moments** create land-grab windows. OAC was early on OpenCode (Aug 2025) but captured a small slice of the January 2026 surge compared with oh-my-opencode. OpenCode v2 (Sept-Oct 2026) is a new window: first frameworks to be v2-native will be picked up by migrating users.
- **Simplicity and small footprint** are rewarded; heavy doc-generating processes get "overkill/waterfall" backlash. OAC's approval gates are a double-edged pitch: they appeal to teams but read as latency to individuals.
- **Spam and abandoned bot issues** on a repo lower perceived maintenance quality. Peers with large teams triage aggressively.

### Gaps
- No authoritative account of superpowers' acceptance into Anthropic's official marketplace (date community-reported only).
- No install or download numbers for any framework other than unverified superpowers figures.
- No data on how oh-my-opencode reached 70K (no star history fetched).

## 4. How many developers use add-on frameworks vs. vanilla tools (surveys)

### Takeaway
No major survey measures add-on framework use directly. Surveys show Claude Code dominating agent use. Repo-mining studies show most projects stop at a CLAUDE.md file, with only about 5-28% using skills and about 5-25% custom subagents. Framework users are therefore a minority of agent users, even though stars suggest huge reach.

### Cited Findings
**Stack Overflow 2026 Developer Survey** (results published 2026-10-06)
- Among AI-agent users, 65.5% (8,030 of 12,255) use Claude Code, 58.7% GitHub Copilot and 29.5% OpenAI Codex — [SO 2026 AI agents data](https://survey.stackoverflow.co/2026/ai/data/ai-code-agent); [SO blog, 2026-10-06](https://stackoverflow.blog/2026/10/06/the-results-of-the-2026-developer-survey-are-here/)
- 26.2% of respondents use "AI agents or automated workflows"; 65.9% use coding assistants or agents; 73% of users use them daily — [SO 2026 AI](https://survey.stackoverflow.co/2026/ai)
- An April 2026 pulse put Claude Code at 55%, up from 41% in 2025 (via secondary summary) — [SO blog look-back, 2026-09-30](https://stackoverflow.blog/2026/09/30/getting-ready-for-2026-results-a-look-back-on-developer-survey-findings/)
- Byteiota's "65% use agents daily / 58% avoid them" conflicts with SO's official tables. Do not rely on it — [byteiota](https://byteiota.com/stack-overflow-2026-survey-developers-use-ai-agents-but-actively-avoid-them/)

**JetBrains Developer Ecosystem 2026:** 39% of professional developers use Claude Code at work, and 31% call it their main AI coding tool (via dev.to summary) — [dev.to jamilxt](https://dev.to/jamilxt/claude-code-overtakes-github-copilot-what-jetbrains-survey-of-15000-developers-says-about-ai-3nhc)

**Repo-mining studies** (proxies for customization depth)
- 2,500 public repos: 84.9% have CLAUDE.md, 62.1% a .claude/ directory, 28.1% skills, 24.6% custom subagents, 13.3% hooks — [buildthisnow](https://www.buildthisnow.com/blog/real-examples/state-of-claude-code-2026)
- arXiv (Feb 2026), 2,853 repos: 90.6% have a context file, 5.5% a skill, 4.6% a subagent (via search summary) — [buildthisnow / arXiv reference](https://www.buildthisnow.com/blog/real-examples/state-of-claude-code-2026)
- The two studies differ about 5x on skills and subagents (different sampling) — [search summary of both](https://www.buildthisnow.com/blog/real-examples/state-of-claude-code-2026)

### Inferences
- Most agent users run vanilla tools plus a context file. Frameworks are an enthusiast or power-user layer.
- Star counts (300K superpowers) far exceed likely active use. Stars measure attention, not adoption.
- Claude Code holds about 65% share among agent users vs OpenCode's smaller share. An OpenCode-first framework like OAC addresses a much smaller host base than Claude-Code-first peers, unless its Claude Code plugin works reliably.

### Gaps
- No survey asks about superpowers, BMAD, spec-kit, etc. by name.
- OpenCode's share in SO 2026 was not extracted (the full agent table was not fetched).
- No State of AI Coding / Pragmatic Engineer data was retrieved on framework use.
