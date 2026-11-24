# 2. Approach and niche: which void should OAC own?

Sources are `reports/Coding agent harness landscape.md` and the four notes in `research_notes/Coding agent harness landscape/`, plus one web check on 2026-10-16. Lines tagged **[F]** are facts from those sources. Lines tagged **[O]** are my opinion or inference.

## Bottom line

**[O]** OAC should position itself as **the enforced-guardrails layer for coding agents, written once and compiled to each host's native permissions and hooks, with published evidence that it works**. The pitch is control that survives the model forgetting, not another workflow. The secondary position is **the first v2-native OpenCode framework**, treated as a time-boxed wedge rather than as the destination.

## 1. Market voids

| Void | Who leaves it open | Evidence |
|---|---|---|
| **Mechanically enforced guardrails** (deny secrets/.git/out-of-scope writes, gate destructive bash, verifier before "done") | Hosts ship the *primitives* (33 CC hook events, OpenCode permissions, Codex Auto-review) but no opinionated policy. Frameworks enforce *method* (TDD, specs) through prompts. | **[F]** paddo.dev lists "per-action approval" and "compliance deliverables" among the niches still open. **[F]** Compliance decays about 5.6% per generated function, so restated rules fail (arXiv 2605.10039). **[F]** Web check: early single-purpose tools exist. handrail (Go, Claude Code + Codex, Aug 2026) and devleaps-agent-policies (Claude Code, Cursor beta) do this, and Endor Labs argues for "hook-based governance across agent platforms". None of them covers OpenCode. |
| **Portable permissions/subagent frontmatter** | Skills and AGENTS.md have converged. Subagent frontmatter and permissions have not. | **[F]** CC camelCase, OpenCode `permission`/`steps`, Codex TOML, Cursor `readonly`. wshobson covers 7 hosts but translates permissions by template, and only OAC has fail-closed degradation. |
| **Proof that a harness layer helps** | Nobody publishes ablations. Ruflo and others got called out for fabricated multipliers. | **[F]** Harness effects of 5–30 points exist (arXiv 2610.00917). **[F]** awesome-claude-code #1338 and Ruflo's own audit show the community now polices unbenchmarked claims. |
| **Team/regulated governance** (required installs, presets, provenance of installed context) | spec-kit presets and gstack team mode address method. Little addresses supply chain. | **[F]** ClawHavoc planted 1,184+ malicious skills. **[F]** Native-features note lists "governance of what gets installed" as gap (f). |
| **OpenCode v2 migrants** | oh-my-opencode left for pi. v2 breaks v1 plugins and permissions. | **[F]** The upgrade path opened 2026-10-12. OAC issues #349, #362 and #367 are open. |
| **Non-JS stacks** | Most packs are implicitly JS/TS. | **[F]** #283. **[O]** This is real but weak as a standalone position, because the model already knows Python and Go, and research says generic standards don't help. |
| **Provable token/cost savings** | Everyone claims it and no one proves it. | **[F]** Selective context cut cache-creation tokens on 11/11 tasks with no correctness change (arXiv 2607.27250). **[F]** #258 says OAC is currently *slower*. |

**[O]** Audiences ranked by fit: (1) small teams and tech leads who must let agents loose on real repos, (2) multi-host shops (CC + Codex/OpenCode), (3) OpenCode v2 migrants. True enterprises and regulated orgs need SSO, audit logs and support that a solo maintainer can't provide. Serve them later through exportable artifacts, not features. Solo devs are the most contested audience (Superpowers and gstack) and the most latency-averse.

## 2. Candidate positions

Each position is scored 1–5 on four criteria. Higher is better on every one, so a 5 under Feasibility means "easy for one person".

| Position | Audience | Defensibility | Asset fit | Solo feasibility | Total |
|---|---|---|---|---|---|
| **A. "Policy-as-code guardrails, every host"**: one policy file compiled to native permissions and hooks, plus verifier gates | 4 | 4 | 5 (canonical build, fail-closed caps, "Control" brand) | 4 | **17** |
| **B. OpenCode v2-native framework** | 2 | 2 (single host, every breaking change lands on OAC) | 5 | 5 | 14 |
| **C. Cross-host build/translator** (wshobson-style catalog compiler) | 3 | 2 (wshobson is ahead, and hosts keep reading each other's dirs) | 4 | 2 (breadth race) | 11 |
| **D. Team standards engine**: discover conventions → AGENTS.md → lessons write-back | 4 | 2 (Compound Eng., ECC, Agent OS, spec-kit presets) | 3 (the existing library is generic and must be rebuilt) | 3 | 12 |
| **E. "Proven harness": eval/benchmark-first** | 2 | 3 | 3 (the eval framework exists but is path-graded and stale) | 2 | 10 |

**[O]** A wins because it is the only void where all three of OAC's real assets reinforce each other. The build *is* the policy compiler, the brand *is* the promise, and the evals become the proof. It is also the void hosts are least likely to fill opinionatedly, since each host stays host-specific by design. C and E are capabilities *of* A, not positions in their own right. D becomes an add-on once A ships. B is the launch vehicle.

**[O]** Risk to A: handrail and devleaps show the idea is visible, and Anthropic or OpenAI could ship opinionated default policies. Mitigations are speed, OpenCode coverage (which nobody else has), fail-closed degradation with a published capability matrix, and evidence.

## 3. Recommendation

### Primary: Position A

**Tagline [O]:** *"Guardrails your agents can't forget. Write the policy once and enforce it on every host."*
(Alt: *"Control, compiled."*)

**Persona [O]:** "Priya", a tech lead or staff engineer on a 3–30 person team. Her team uses Claude Code with one or two others (OpenCode, Codex, Cursor), and she has to approve agents on a production repo. She has been burned by an agent editing `.env`, running `rm -rf` or a migration, or claiming "done" with failing tests. She doesn't want a methodology. She wants rules that hold and a way to show her manager they hold.

**Flagship capabilities (3–5):**
1. **`oac.policy` → native enforcement.** One declarative file (protected paths, write scope, destructive-command classes, network/MCP allowlist) compiled by the canonical build into CC hooks and permission rules, OpenCode v2 ordered permission arrays, and Codex rules/TOML. Anything that cannot be expressed fails closed and is listed.
2. **Risk-based gates, not ceremony.** Gates fire only on risk: writes outside scope, destructive bash, secrets, and "done" without a passing verifier (`agent` hook). Low-risk work never prompts. This answers the latency critique **[F]**.
3. **Published capability matrix + `oac doctor --policy`.** Per host, the matrix states what is enforced, what is degraded and why, and doctor verifies a repo's live enforcement. **[O]** Admitting the gaps openly is the trust signal.
4. **Evidence pack.** Run outcome-graded Harbor-compatible trials (20–50 real-failure tasks) for OAC off vs on, published as pass^k, violations blocked, tokens and time. Add a red-team suite of attempted secret reads and scope escapes.
5. **Team lock + provenance.** A committed `oac.lock` (pinned, checksummed policy and context) plus a CI check (`oac verify`) that fails PRs if a repo's agent config drifts from policy. **[O]** This is the hook for regulated teams: it gives them an artifact they can show an auditor.

### Secondary: the OpenCode v2 wedge (next 4–6 weeks)
Ship v1.2 as "v2-native", fixing #349, #362 and #367 and the ordered permissions. The policy compiler's first target should be v2's new permission model, so the wedge and the core reinforce each other. Announce it in OpenCode channels while oh-my-opencode's absence leaves the space open **[F]**.

### Explicitly NOT do [O]
- Don't compete on workflow methodology (TDD, SDD, brainstorming). Superpowers, spec-kit, OpenSpec and BMAD own it, so interoperate with them instead. "Use Superpowers *with* OAC guardrails" is a feature.
- Don't keep parallel-execution, worktree orchestration, generic explore/code-review agents or plan-mode clones (**[F]** these are native everywhere).
- Don't chase host count for its own sake. Cover CC, OpenCode and Codex well, and let Cursor come free via `.claude/agents`.
- Don't publish any % claim without the ablation, and drop "80% reduction" now.
- Don't ship the generic 297-file standards library by default, and don't use coercive "MUST invoke" prompts.
- Don't build enterprise SaaS features (dashboards, SSO) as a solo maintainer. Export artifacts instead.

### Metrics [O]

| | 3 months (mid-Jan 2027) | 6 months (mid-Apr 2027) |
|---|---|---|
| Trust | v1.1 + v1.2 tagged; ≥1 release/month; README claims 100% verified; first-response time on issues under 7 days | No release gap >5 weeks; 0 open install bugs >30 days old |
| Distribution | Working CC marketplace install with a CI smoke test; `npx skills` path; npm package resolves | Listed in Anthropic's official marketplace and Codex marketplace; ≥2 third-party write-ups or endorsements |
| Adoption | Star growth back to ≥400/mo; ≥500 weekly npm downloads; ≥25 repos committing `oac.policy` (GitHub code search) | ≥1,500/mo stars; ≥2,000 weekly downloads; ≥150 public repos with `oac.policy`; ≥3 teams as named case studies |
| Proof | Eval suite running on schedule (top-level workflow); first public off/on report on CC + OpenCode | Report covers 3 hosts, ≥100 tasks; red-team block rate ≥95% where enforced; median added latency <10% |
| Product | Policy compiler for OpenCode v2 + CC; capability matrix published | Codex target; `oac verify` CI action on Marketplace |

## 4. Go-to-market

- **OpenCode v2 window (now) [F/O].** Be first to say "v2-native" in OpenCode Discord, GitHub discussions and Kilo's community. Write a "migrating your agent permissions to v2" guide that uses OAC as the reference. It is useful content even to people who don't adopt OAC.
- **Marketplaces [F].** Every breakout used one-command host installs. Fix #281 first, then submit to the Anthropic and Codex official marketplaces, and package skills for `npx skills` / `gh skill install`.
- **Endorsement [F/O].** Superpowers' inflection came from Simon Willison's post. Take the eval and red-team report to security-minded voices (Simon Willison on prompt injection, the Endor Labs and CSA authors already writing about hook governance). A reproducible "here's an agent trying to read your .env, blocked on 3 hosts" demo is the shareable artifact.
- **Interop, not rivalry [O].** Publish "OAC guardrails for Superpowers/spec-kit users" recipes. Riding the 300k-star audience is cheaper than fighting it.
- **GitHub Action [O].** `oac verify` in CI puts OAC in front of every PR reviewer on adopting teams. That is distribution that compounds.

## Sources (web check)
- [handrail (pkg.go.dev)](https://pkg.go.dev/github.com/svyatov/handrail)
- [devleaps-agent-policies (PyPI)](https://pypi.org/project/devleaps-agent-policies/)
- [Endor Labs: the case for hook-based governance across agent platforms](https://endorlabs.com/learn/when-the-guardrails-slip-the-case-for-hook-based-governance-across-agent-platforms)
- [Rulebricks (feedbagel)](https://feedbagel.com/post/rulebricks-real-time-guardrails-for-claude-code-tool-calls)
