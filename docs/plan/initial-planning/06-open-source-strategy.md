> Initial planning record (2026-10-18). Current plan: [../ROADMAP.md](../ROADMAP.md) · decisions: [../../lessons-learnt/decisions.md](../../lessons-learnt/decisions.md)

# 06. Open-source strategy: keep OAC open, and how

Date: 2026-10-18. Read-only research: nothing was changed on GitHub or in the repo. **[F]** marks a fact, with its source. **[O]** marks opinion or inference. Data comes from `gh` on 2026-10-18 unless noted otherwise.

## Bottom line

**[O]** Keep OAC **fully open under MIT**. Don't relicense it, don't open-core it now, and don't build a paid tier for at least 6–12 months. Both of your goals depend on trust, not on owning the code. At 4.9k stars, with star growth down about 90% and a fork calling you "unmaintained", the scarce thing is credibility, not IP. Any licence change now would read as a cash grab from a stalled project and would hand the fork a story. Protect the **name**, not the code: fix the brand risk below this month. Spend the next 90 days on visible reliability: releases, triage and the `.env` demo. If a paid product ever comes, make it a hosted **aggregation** service (team `oac report` and policy drift across repos), never a gate or a compiler feature. That keeps promise 5 ("Provable") and promise 6 ("yours") intact.

Two urgent findings come first:

1. **Security issue #327 has had no reply since 2026-06-27.** **[F]** (`gh issue view 327`): a researcher asked for a private channel to report "a potential CI/CD security issue". For a guardrails product this is the most damaging unanswered thread in the repo. Reply today and point them at private vulnerability reporting, which is enabled **[F]** (`gh api …/private-vulnerability-reporting` → `{"enabled":true}`).
2. **The ControlStack name looks taken.** **[F]** The GitHub org `controlstack` belongs to "Control Stack Ltd." (blog controlstack.co.uk), was created in 2016 and holds one repo, `jenkins-aptly-publisher` (`gh api orgs/controlstack`). **[F]** The npm org `@controlstack` exists: the registry returns 200 for it and 404 for a made-up org. Your own guide still lists "Claim the `@controlstack` scope" as not done (`.opencode/context/openagents-repo/guides/npm-publishing.md:148`). **[O]** If you don't own that npm org, `@controlstack/oac` can't ship, and the brand conflicts with an existing UK company. Check this before v1.1.

## 0. Current state (the facts that drive the advice)

| Item | Value | Source |
|---|---|---|
| Licence | MIT, "Copyright (c) 2025 Darren Hinde" | [F] `LICENSE` |
| Inbound terms | "By contributing, you agree that your contributions will be licensed under the MIT License." No CLA, no DCO. | [F] `docs/contributing/CONTRIBUTING.md:473`; grep for CLA/DCO/Signed-off found nothing |
| Stars / forks / watchers | 4,916 / 417 / 38 | [F] `gh repo view` |
| Stars per month | Jan-26 1,024 → Mar 814 → May 409 → Jul 213 → Sep 99 → Oct (to the 18th) 49 | [F] stargazers API with timestamps |
| Contributors | 19 entries: you (189 commits), github-actions (15), and 17 outside humans with 1–2 commits each | [F] `gh api …/contributors?anon=1` |
| Open PRs | 29: **20 from 13 outside contributors**, 5 yours, 4 bots (3 of them stale "bump to v0.7.2" PRs). The oldest outside PR is #195, from Feb 2026. | [F] `gh pr list` |
| Open issues | 42. **About 21 outside issues have no maintainer comment**, including #327 (security), #281 (CC plugin broken), #349 and #362 (OpenCode v2) and #367. Two are crypto spam (#278, #282). | [F] `gh issue list --json comments` |
| Releases | Latest v0.7.1 (2026-01-30). None since. | [F] `gh release list` |
| Discussions | Enabled, 24 threads, most with 0 replies | [F] GraphQL |
| Community profile | 71%. GitHub reports **no CONTRIBUTING and no CODE_OF_CONDUCT**, because they live in `docs/contributing/`, which GitHub doesn't scan (it checks the root, `docs/` and `.github/`). | [F] `gh api …/community/profile`; files exist at `docs/contributing/*.md` |
| Labels | `good first issue`, `help wanted`, priority-*, size-*, status-* exist. There are no per-module labels. | [F] `gh api …/labels` |
| npm | `@nextsystems/oac@0.7.0` **is published** by you (2026-01-29). `@controlstack/oac` returns 404. | [F] `npm view` |
| Release supply chain | No `--provenance`, `id-token` or attestation in the release workflows. (`opencode.yml` has `id-token: write`, but that is the comment-bot, gated to OWNER and MEMBER.) | [F] grep `.github/workflows` |
| apilot fork | 0 stars. **51 commits ahead, 0 behind** upstream. Its README says "Upstream is unmaintained". **It has already opened 3 PRs upstream** (#363–365, 2026-10-02). | [F] `gh api compare`, README, `gh pr list` |
| Dependency licences | 282 installed packages scanned: MIT 222, ISC 30, Apache-2.0 10, BSD 17, Python-2.0 1, plus dual-licensed permissive. No GPL, AGPL, SSPL or BUSL found. | [F] node_modules scan. Partial: the pnpm store may hide some, so confirm with `pnpm licenses list`. |

## 1. Should it stay open source?

### 1.1 What peers did (stars and licence as of 2026-10-18 [F] via `gh api repos/…`)

| Project | Licence | Stars | Money model | Lesson for OAC |
|---|---|---|---|---|
| Superpowers (obra) | MIT | 301k | None visible; author reputation | **[O]** Pure MIT plus a strong author voice gave the biggest community. Endorsement (Simon Willison) drove it [F, `reports/Coding agent harness landscape.md`]. |
| spec-kit (GitHub) | MIT | 142k | Corporate-backed | **[O]** Release cadence (40 releases in 90 days [F, landscape report]) is the trust signal. |
| gstack (Garry Tan) | MIT | 137k | Reputation | **[O]** A portfolio piece *is* the business model. |
| ruflo | MIT | 76k | Consulting / reputation | **[F]** Called out for unbenchmarked multipliers (landscape report). **[O]** Hype without proof costs credibility. |
| BMAD-METHOD | MIT + **trademark notice** ("BMad™ … covering all casings") | 54k | Brand, courses | **[F]** `LICENSE` text. **[O]** The model to copy: MIT code, protected name. |
| OpenCode (anomalyco) | MIT | 216k | Paid hosted models and services around a free tool | **[O]** Monetise the service, not the code. |
| Cline | Apache-2.0 | 70k | Open core: Teams (org management, central billing, usage). $32M seed + Series A. | [F] [Cline blog](https://cline.bot/blog/cline-raises-32m-series-a-and-seed-funding-building-the-open-source-ai-coding-agent-that-enterprises-trust). **[O]** Team admin features are what companies pay for. That needs funding, not a solo maintainer. |
| Continue | Apache-2.0 | 36k | Hosted hub and team features | **[O]** Same pattern: open client, paid control plane. |
| Aider | Apache-2.0 | 50k | None; solo-led | **[O]** Proof that one maintainer can sustain a respected OSS tool through steady releases and honest benchmarks (its public leaderboard). The closest model for you. |
| PostHog | MIT outside `ee/`, proprietary `ee/` | 40k | Open core + cloud | [F] `LICENSE` text. **[O]** Open core only works with a product team behind it. |
| Sentry | FSL-1.1 (to Apache or MIT after 2 years); other components Apache or MIT | 46k | SaaS | [F] [Sentry FSL post](https://blog.sentry.io/introducing-the-functional-source-license-freedom-without-free-riding), [open.sentry.io/licensing](https://open.sentry.io/licensing). Not OSI-approved. |
| Supabase | Apache-2.0 | 112k | Hosted platform | **[O]** Fully open code, with the money in hosting. |
| HashiCorp / Elastic / Redis | MPL → BSL (2023); Apache → SSPL/ELv2 (2021), AGPL added 2024; BSD → RSAL/SSPL (2024), AGPL added 2025 | n/a | | **[O, widely reported]** Each relicence triggered a fork (OpenTofu, OpenSearch, Valkey) and lasting reputation damage. Elastic and Redis later added AGPL back. |

### 1.2 The four models against your two goals

| Model | Community | Portfolio | Solo cost | Revenue | Competitive risk | Verdict |
|---|---|---|---|---|---|---|
| **Fully open (MIT)** | Best. Matches every peer in your category; the top four are all MIT. | Best. Anyone can read, run and judge the code. | Lowest. No licence keys, no entitlement code. | Indirect: consulting, talks, jobs, sponsors | Copycats can fork, but your fork already exists and is 0 stars. The moat is cadence, the eval data and the name. | **Choose this** [O] |
| **Open core** (paid hosted reports, policy management, SSO, audit export) | Good if the line is clear and stable | Good. A SaaS adds "can ship a product" | High. Auth, billing, uptime, support and SOC2 questions. Your own strategy note says not to build "enterprise SaaS features (dashboards, SSO) as a solo maintainer" [F, `2_approach_and_niche.md`]. | Real but slow; needs teams first | Vendors (Anthropic, OpenAI, sst) ship native policy and admin consoles, and you'd compete with them on their turf | **Later, maybe**, and only as hosted aggregation [O] |
| **Source-available** (FSL/BSL/ELv2) | Poor for a 4.9k-star tool. Contributors and distros avoid non-OSI licences. | Neutral to negative ("defensive") | Medium (licence questions) | Protects a SaaS you don't have | Invites exactly the fork narrative apilot is already pushing | **No** [O] |
| **Closed** | Ends it | Code can't be judged; only demos remain | Low | Must sell from zero | Existing MIT code stays forkable forever | **No** [O] |

### 1.3 Relicensing constraints

- **[F]** The code is MIT. Every copy already distributed (417 forks, `@nextsystems/oac@0.7.0`) stays MIT forever. A relicence only affects *future* versions.
- **[F]** There is no CLA. Contributions came in under MIT (inbound = outbound, `CONTRIBUTING.md:473`).
- **[O, not legal advice]** MIT is permissive, so you *could* ship future versions under another licence that includes MIT-licensed contributions, as long as you keep the original notices. But 17 outside contributors and 20 open outside PRs mean a relicence would need either their consent or a rewrite of their parts to be clean and goodwill-preserving. Their contributions are small (1–2 commits each), so that is feasible, but it isn't worth it.
- **[O]** Don't add a CLA now. It raises the barrier exactly when you need contributors back. If you ever want optionality, add a **DCO** (`Signed-off-by`), which is lightweight and gives provenance. Keep any future paid code in a **separate repo**, so the OSS repo never needs relicensing.

### 1.4 Competitive risk, honestly

- **Forks [O]:** The apilot fork is the symptom, not the threat. A fork wins only if upstream stays silent. Ship v1.1 and merge its good PRs, and the "unmaintained" line becomes false.
- **Copycats [O]:** A policy compiler is copyable in weeks. What isn't copyable is a public conformance suite plus a published off/on report plus a release history. Those are also exactly your portfolio assets.
- **Large vendors [O]:** Hosts will keep adding native permissions (that is the premise of the north star). Cross-host "one policy, every tool, with proof" is the one thing a single vendor won't build. MIT doesn't weaken that position, and a restrictive licence doesn't strengthen it.

## 2. Recommendation for your two goals

**[O]** Stay MIT. Draw this line now and publish it in `GOVERNANCE.md`, so contributors know it won't move:

| Always open (MIT, this repo) | Could ever be paid (separate repo or service, opt-in) |
|---|---|
| `oac.policy` schema and the **policy compiler** for every host | **Hosted team dashboard**: aggregates `oac report` JSON across repos and developers, with trends |
| All **gates** (secrets, destructive commands, scope, intent, verify `on_fail`) | Org-wide **policy distribution** and drift alerts across many repos (`oac verify` results rolled up) |
| `oac init`, `oac doctor`, `oac test`, `oac report` (local), `oac verify` GitHub Action | Long-term retention of decision logs and **audit export** formats for compliance teams |
| Conformance suite, red-team scenarios, eval harness, capability matrix | SSO/SAML for the dashboard |
| Every host adapter (OpenCode, Claude Code, Codex, and community ones) | Paid support, onboarding and policy-review consulting (available now, no code needed) |

The rule is: **anything that enforces or proves on a developer's machine or in their CI is free forever. Only multi-repo aggregation and hosting can cost money.** **[O]** That matches promise 5 (every gate has a test users can run themselves) and promise 6 (quiet and yours). Your example (open compiler, gates and `oac test`, with a possible later paid team dashboard for `oac report` aggregation) is right. Two refinements:

1. Make `oac report --json` a **stable, documented schema** in v1.x, so a dashboard (yours or anyone's) can consume it. Openness of the format is what makes the paid layer trustworthy.
2. Don't start the dashboard until there are **≥150 public repos with `oac.policy`** and inbound "can we see this across the team?" requests (the 6-month target in `2_approach_and_niche.md`). Before that, monetise through consulting and sponsorship.

**[O]** For the portfolio goal, "I designed and run an MIT policy compiler for three agent hosts, with a public conformance suite" is a stronger signal than any licence choice. For the community goal, MIT is table stakes in this category.

## 3. Building a community, concretely

### 3.1 Trust recovery in the first 14 days (the 29 PRs and the "unmaintained" fork)

1. **Post a pinned Discussion and README banner: "OAC is maintained. Here's the plan."** Link the north star, the v1.1/v1.2 dates and the triage SLA below. Be honest: "I went quiet from Feb to Sep while rebuilding the core (`refactor/canonical`, PR #342). That was a mistake in communication."
2. **Clear the PR queue in one sweep.** For each of the 20 outside PRs, choose one of:
   - *merge* (small fixes that still apply);
   - *superseded by canonical build, thank you, here's where it lands* (close with credit and a link);
   - *needs rebase onto the new layout* (label `status-needs-rebase`, offer help);
   - *out of scope under the north star* (close kindly, and point to the optional extras pack in §10.6).
   Close the 3 stale bot "bump v0.7.2" PRs. **[O]** Closing with a clear reason and credit restores more trust than leaving things open.
3. **Reply to every unanswered issue**, even if only "confirmed, tracked for v1.2". Close the spam (#278, #282).
4. **Ship v1.1 within 2–3 weeks**, even if small. One release is worth more than ten promises.
5. **Name the outside contributors in the v1.1 release notes.**

### 3.2 Triage cadence

| Target | Value [O] |
|---|---|
| First response on new issues and PRs | ≤ 72 h on weekdays (public commitment ≤ 7 days, to underpromise) |
| Security reports | Acknowledge ≤ 72 h, triage ≤ 7 days |
| PR review decision | ≤ 14 days |
| Stale policy | Bot-label `stale` after 60 days of no activity on *awaiting-author* items only. Never auto-close maintainer-awaiting items. |
| Triage slots | Twice a week, 30 min (for example Tue and Fri) |

Add **module labels** that map to the new architecture: `area:compiler`, `area:host-opencode`, `area:host-claude`, `area:host-codex`, `area:gates`, `area:init`, `area:evals`, `area:docs`, `area:installer`. Add `status-needs-rebase` and `status-needs-repro`. Keep **3–5 open `good first issue` items per area** at all times, each with the file to touch, a test to add and an acceptance check. Good seeds include: a red-team scenario for `oac test`, a capability-matrix row, a host fixture, an installer platform fix (#304 Windows, #237 fish), and docs for #266 (uninstall).

### 3.3 Contributor docs

- **Move or copy `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md` and `SECURITY.md` to the repo root or `.github/`**, so GitHub detects them and community health rises from 71%. **[F]** The current location isn't detected (community profile API).
- Rewrite `CONTRIBUTING.md` for the canonical build: a 10-minute setup, "edit the canonical source, run the build, the drift gate fails if outputs differ", and how to run L0 and L1 tests.
- **`docs/contributing/ADDING_A_HOST.md`:** the host adapter interface, the capability-matrix entry, the required conformance tests (T1–T4 style), and "what must fail closed". This is the doc that turns wzkagms's OpenClaw (#347) and siverson101's Cursor (#361) requests into contributions instead of requests.
- **`ADDING_A_GATE.md`:** gate spec, L0 fixture, L2 scripted scenario, the matrix row, and the four "before building anything" questions from the north star as a PR checklist.
- **`GOVERNANCE.md`:** BDFL with a path to maintainer (for example after 5 merged PRs plus 3 months active you get triage rights; after that, area-maintainer `CODEOWNERS`). Include the open-versus-paid line from §2.
- **`RELEASING.md`:** the cadence below, plus provenance.

### 3.4 Release rhythm

**[O]** Release a **minor every 4–5 weeks** and patches as needed. Never let a gap exceed 5 weeks (the trust metric in `2_approach_and_niche.md`). Put a public milestone per release on GitHub. The changelog comes from conventional commits. Include an "Upgrading" section in each release.

### 3.5 Discussions and Discord

- **GitHub Discussions as the primary forum [O].** It is searchable and close to the code, and costs you nothing to moderate. Use these categories: Announcements (maintainer-only), Q&A (answer-marking on), Ideas, Show & Tell (policies people wrote), Host adapters.
- **Discord: not yet [O].** A dead Discord signals abandonment faster than a quiet Discussions tab, and real-time chat is a burnout vector. Instead, be present in the **OpenCode Discord** and the Claude Code communities, where your users already are. Revisit at about 50 weekly active Discussion participants.
- Hold a monthly 30-minute "office hours" call or a recorded changelog video. It doubles as portfolio content.

### 3.6 Recognition

- Add the **all-contributors** bot and a contributors section to the README, crediting non-code work too (bug reports, docs, red-team scenarios).
- **Changelog credits:** "Thanks @handle (#123)" on every line.
- **Hall of fame for red-team scenarios:** a scenario that finds a bypass earns a named credit in the capability matrix. **[O]** This is unusual and on-brand for a guardrails tool.

### 3.7 Turning the apilot fork into a contributor

**[F]** The fork is 51 commits ahead, 0 behind, and has already opened #363 (installer hardening), #364 (machine-verified completion gate) and #365 (repo-map). **[O]** That is a contributor knocking, not a competitor.
1. Review #363–365 within a week. Merge #363 if it applies. #364 maps directly onto the north star's "verify before done" gate, so ask them to port it into the gate framework, and co-design if needed.
2. Comment or email privately: "Thank you for keeping things moving. I'd like to bring your work upstream. Would you take `area:gates` or `area:installer` triage rights?"
3. Once merged, ask them (politely, never as a condition) to update the "unmaintained" line. Offer co-credit in the release notes.
4. Skip repo-map (#365) if it fails the "not an agent catalog" test. Offer it a home in the optional extras pack.

### 3.8 Sustainability

- **GitHub Sponsors** now: tiers at $5 (thanks), $25 (name in README), $250/month (logo plus a monthly 30-minute policy review for a team). Add `.github/FUNDING.yml`; none exists **[F]** (no FUNDING file in `.github/`). **[O]** Expect very little money at this size; the real value is the signal.
- **Open Collective:** only once there are other maintainers and shared costs (CI minutes, model API costs for evals). **[O]** Not needed solo.
- **Grants [F]:** Cline announced a $1M grant programme for dev tools and agent infrastructure ($1k–10k grants) ([source](https://cline.bot/blog/cline-raises-32m-series-a-and-seed-funding-building-the-open-source-ai-coding-agent-that-enterprises-trust) and secondary coverage; check that it is still open). Eval-API credit programmes from model vendors are also worth applying for to fund `oac test` L3 runs.
- **Consulting [O]:** "OAC policy setup for your team" is sellable today, uses no paywall, and builds the case studies the 6-month metrics need.

### 3.9 Avoiding burnout

- **[O]** Timebox: a fixed weekly budget (§6) with triage slots, not notifications. Turn off email for issue comments and batch them.
- Say no with templates: saved replies for out-of-scope, needs-repro and superseded.
- Scope by the north star: "Does it pass the four questions?" is a kind, impersonal no.
- Delegate early: one area maintainer in 90 days (apilot or a repeat contributor) is the single biggest burnout reducer.
- Announce breaks ("Back on the 12th") rather than going dark. The silence, not the absence, created the "unmaintained" narrative.

## 4. Using it to show your skills

### 4.1 What reads as strong engineering to hiring managers, clients and investors [O]

1. **A visible release history**: tags, changelogs and upgrade notes on a steady cadence. A reviewer opens the Releases tab first.
2. **Green CI with meaningful tests**: the L0/L1/L2 harness, and the **cross-host conformance suite** as a badge-backed matrix ("this gate is enforced on OC v2 ✅, CC ✅, Codex ⚠️ degraded, reason X"). Few agent frameworks publish one.
3. **Honest benchmarks**: the off/on ablation with the method, the raw data and the failures. Your landscape report shows the community now punishes made-up numbers (ruflo, awesome-claude-code #1338 [F]). Publishing a result that *isn't* flattering earns trust.
4. **Architecture and design docs**: `docs/architecture/` exists. Add 3–4 short ADRs (fail-closed degradation; why the policy compiles to native controls instead of prompts; the intent-gate design; report schema).
5. **Supply-chain hygiene**: npm provenance, an OpenSSF Scorecard badge, pinned actions (already done in `opencode.yml` [F]) and a real SECURITY.md process.
6. **Responsiveness**: median time to first response on issues. People check.

### 4.2 What to write and talk about

| Piece | When | Why |
|---|---|---|
| "I let three coding agents try to read my `.env`. Here's what stopped them." A 90-second video and post, with the scenario reproducible via `oac test` | With v1.2 | The shareable artifact in your GTM notes; security-minded readers will share it |
| "Why prompt-based guardrails fail" (compliance decay, with your own measurements) | v1.2–v1.3 | Thought leadership with data |
| "Migrating agent permissions to OpenCode v2" | Now, for the v2 window | Useful even to non-users; distribution |
| "One policy, three hosts: building a fail-closed compiler" (deep technical write-up) | v1.4 | The portfolio centrepiece for engineering audiences |
| "I let my OSS project stall at 5k stars. Here's how I recovered it." | About 90 days in | Candour builds an audience; maintainers love these posts |
| Talks: local meetups → AI Engineer World's Fair / FOSDEM / OWASP chapters (agent security) | CFPs during months 2–3 | Security conferences are less crowded with agent talks than AI ones [O] |

Send the red-team report to people who write about agent security (Simon Willison, the Endor Labs and CSA authors already cited in `2_approach_and_niche.md`).

### 4.3 How to present it on a profile or site

- **Pin the repo** on GitHub with a one-line description that matches the north star. **[F]** The current description still says "built for OpenCode" and lists language support (`gh repo view`). Change it at v1.1.
- Make a **project page on your site**: the problem, a 60-second demo GIF, the capability matrix, the "what I built" list (compiler, conformance suite, eval harness), and links to releases and posts. State your role: "Creator and maintainer, 189 of ~210 human commits."
- **Present outcomes, not stars:** "≥25 public repos commit `oac.policy`", "red-team block rate X% on 3 hosts", "release every 4 weeks since Nov 2026".
- On LinkedIn and X (`@DarrenBuildsAI`), post a short "what shipped" thread per release.

### 4.4 Risks to the portfolio

- **[O]** A visibly stalled repo hurts more than no repo. Right now the public signals are: last release Jan 2026, 21 unanswered issues, an unanswered security request, and a fork saying you left. Fix those *before* doing any promotion. Don't link the repo from a CV until v1.1 ships and the queue is cleared.
- **[O]** Don't make claims you can't back up. The "80% reduction" and "<200 lines" claims were already flagged as false [F, landscape report]. One debunked claim outlives ten good releases.
- **[O]** If you do pause, archive or clearly mark "maintenance mode" with a date. Ambiguity is what harms a reputation.

## 5. Risks and mitigations

| Risk | Status | Mitigation [O unless noted] |
|---|---|---|
| **Security disclosure** | SECURITY.md is decent: private vulnerability reporting, a no-secrets rule, coordinated disclosure, and scope. **[F]** But it promises "no guaranteed response time", supports only 0.7.x, isn't in a detected location, and #327 shows the process failed in practice. | Commit to acknowledgement ≤ 72 h and a fix target ≤ 30 days for high severity. Add a backup contact email. Update supported versions to 1.x at v1.1. Add a **"guardrail bypass" category**: a policy bypass is a vulnerability for this product, so state severity guidance and credit reporters in advisories. Publish GHSA advisories with CVEs. Answer #327 today. |
| **Name: "ControlStack"** | **[F]** GitHub org held by Control Stack Ltd since 2016; npm `@controlstack` org exists and ownership is unverified. | Check `npm org ls controlstack` while logged in. If it isn't yours, pick another scope before v1.1. You already own `@nextsystems/oac` [F], so consider staying there or using a scope you can register now. Search UK IPO / EUIPO / USPTO for "ControlStack" in classes 9 and 42 before investing in the brand. |
| **Name: "OpenAgentsControl"** | **[F]** "OpenAgents" is crowded: xlang-ai/OpenAgents (4.9k stars, Apache) and openagents-org/openagents (4.2k). | **[O]** "OpenAgents Control" is distinctive as a whole, but "OAC" is the safer short brand. Consider a UK trademark filing for "OpenAgentsControl" or "OAC" if a company forms (about £170–£220 for one class, online, [O]; check current IPO fees). Add a BMAD-style trademark notice and a `TRADEMARK.md` ("forks are welcome; don't call your fork OAC or OpenAgentsControl"). **[F]** BMAD does exactly this in its MIT `LICENSE`. |
| **Dependency licences** | **[F]** The scan found only permissive licences. | Add `pnpm licenses list` or a license-checker step to CI that fails on GPL, AGPL or SSPL. Note that `dependency-review.yml` exists [F] and can enforce `deny-licenses`. |
| **Supply chain** | **[F]** No npm provenance. A published package already exists under `@nextsystems`. | Publish from GitHub Actions with `npm publish --provenance` (OIDC `id-token: write`), using **trusted publishing** rather than a long-lived `NPM_TOKEN`. Use GitHub artifact attestations for release tarballs. Require 2FA on the npm account. Add the OpenSSF Scorecard action. Protect `main` with required reviews for anyone other than you. Deprecate `@nextsystems/oac` with a pointer once the new package ships. |
| **A guardrails product with a bypass** | Inherent | The capability matrix must say "degraded" honestly. Add a red-team regression test for every fixed bypass. Disclaimer: OAC reduces risk; it is not a sandbox. |
| **Spam and AI-generated PRs** | **[F]** Crypto spam issues (#278, #282) and some low-effort PRs | Issue forms with required fields, a `needs-repro` gate, and blocking repeat spammers. |

## 6. A 90-day plan (2026-10-20 → 2027-01-17)

**Time budget assumption [O]:** 10 h/week solo (about 2 h triage and community, 6 h build, 2 h writing). If you only have 6 h, drop the talk CFP and the Codex work and keep the release cadence. The cadence is non-negotiable.

| Week | Build (v1.1 → v1.2, per `02-product-plan.md`) | Community | Portfolio |
|---|---|---|---|
| **1** | Merge #342 (canonical build) | Reply to #327 (security). Pinned "OAC is maintained" Discussion. Close spam and bot PRs. Answer all 21 silent issues. | Update the repo description and topics |
| **2** | v1.1 hardening: #281 CC plugin, #349 lint fix, `MIGRATING.md`, `oac-classic` tag | Sweep the 20 outside PRs (merge, supersede, rebase or close). Review apilot #363–365 and reach out. | |
| **3** | **Ship v1.1**: resolve the npm scope, publish with provenance, CI smoke test of a fresh install | Release notes crediting contributors. Move CONTRIBUTING, CoC and SECURITY to the root. Add area labels and 10+ good first issues. | Short "v1.1: we're back" post |
| **4** | Start v1.2: build the `evals/v2` harness (T1–T4 failing first) | `GOVERNANCE.md` (with the open-versus-paid line), `TRADEMARK.md`, FUNDING.yml, all-contributors bot | "Migrating agent permissions to OpenCode v2" guide |
| **5–6** | v1.2: OC v2 port (#362, #367), flat IDs, L1 host-load in CI | `ADDING_A_HOST.md` and `ADDING_A_GATE.md`. Invite #347 and #361 authors to port their adapters with them. | |
| **7** | v1.2: PreToolUse secrets hook and the `.env` demo (T3, T4) on OC v2 + CC | First monthly office hours / changelog video | Record the `.env` demo |
| **8** | **Ship v1.2** ("v2-native") | Announce in OpenCode Discord and Discussions | Publish the `.env` post and video. Send it to security writers. |
| **9–10** | v1.3 start: `oac init` pattern capture. Scheduled eval workflow. | Offer the first area maintainer role (apilot or a repeat contributor) | Write 2 ADRs. Submit 1–2 talk CFPs. |
| **11–12** | v1.3 RC. First public off/on report (CC + OC), with method and raw data. | Show & Tell: first community policies. Review metrics publicly. | Project page on your site. "Recovering a stalled OSS project" post. |
| **13** | Ship v1.3 (or v1.2.x if it slips; never a 5-week gap) | Retro Discussion: what worked, the next 90 days | Update the profile with outcomes |

**Targets at day 90 [O], aligned with the 3-month metrics in `2_approach_and_niche.md`:**
- 3 releases (v1.1, v1.2, v1.3 or a patch)
- 0 issues without a first response older than 7 days
- Outside-PR backlog ≤ 5, none older than 30 days
- ≥ 5 new outside contributors merged
- 1 area maintainer
- Star growth ≥ 400/month
- `@…/oac` resolves, with provenance
- `.env` demo published, with at least one third-party share
- The apilot README no longer says "unmaintained", or the fork is dormant because its work is upstream

**What not to do in these 90 days [O]:** relicence, start a dashboard, open a Discord, or add hosts beyond OpenCode, Claude Code and Codex.
