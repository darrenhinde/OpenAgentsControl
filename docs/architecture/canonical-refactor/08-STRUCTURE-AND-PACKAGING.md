# 08 — Repo Structure, Build Flow & Packaging

> **Status:** Decided — closes `04`'s Open Questions 1, 2, 3, 4, 5, 6, 9.
> **Date:** 2026-07-15 · Companion to `07-EXECUTION-PLAN.md`.
> One picture of where everything lives, how a change flows from author to user,
> and exactly what npm ships.

---

## 1. Target repo layout (the monorepo)

```
OpenAgentsControl/
├── content/                        ← THE source of truth (tool-neutral, hand-authored)
│   ├── agents/                     #   merged agents (*.md, YAML frontmatter = IR fields)
│   ├── skills/                     #   union of all skills; `targets:[]` gates applicability
│   ├── commands/
│   ├── context/                    #   MVI HTML-comment metadata preserved on disk
│   ├── hooks/                      #   session-start etc. (harvested from CC plugin)
│   └── registry.json               #   component catalog + profiles + dependency graph
│
├── packages/                       ← pnpm workspace (all TypeScript, Node ≥ 20, zero Bun)
│   ├── core/                       #   @controlstack/core (PRIVATE): Zod IR, MVI parser, serializers,
│   │                               #   capability resolution, dependency/wildcard/alias graph
│   ├── adapters/                   #   @controlstack/adapters (PRIVATE): BaseAdapter + opencode |
│   │                               #   claude | agents-md (| cursor, experimental)
│   └── cli/                        #   @controlstack/oac (PUBLISHED): commands, installer
│       ├── src/commands/           #   init | add | remove | update | build | doctor | status | list
│       ├── src/lib/                #   installer, manifest, config, paths, registry, ide-detect
│       └── bin/oac.js              #   #!/usr/bin/env node (moves here from repo root /bin)
│
├── evals/                          ← behavioral test harness (unchanged; the end-to-end gate)
├── docs/                           ← user + architecture docs (planning archived)
├── scripts/                        ← repo tooling only (registry validation, release)
│
├── .opencode/                      ← GENERATED (oac build --target opencode) — dogfooding;
├── .claude-plugin/ + plugins/      ← GENERATED (oac build --target claude) — committed until
│                                   #   Stage 6, then built in CI for marketplace publishing
│
├── pnpm-workspace.yaml             #   packages/* + evals/framework
├── pnpm-lock.yaml                  #   the ONE lockfile (bun.lock + package-lock.json deleted)
└── package.json                    #   root = the published package (see §4)
```

Mapping from today: `packages/compatibility-layer/{types,core,mappers}` → `packages/core`;
`packages/compatibility-layer/adapters` → `packages/adapters`; `packages/cli` stays (de-Bunned);
`packages/plugin-abilities` deleted (commit `cce5255`) — dead code, no consumers, did not build;
`.opencode/` demoted from source to build output. The `skill`/`skills`, `plugin`/`plugins`
singular-plural schism dies with `.opencode/`-as-source.

**Dependency direction (enforced by lint):** `cli → adapters → core`. `core` has no I/O
beyond `node:fs`, no tool knowledge; `adapters` know tools but not installation; `cli` owns
files-on-disk, manifests, and UX. Nothing imports upward.

---

## 2. Build flow — one pipeline, two operators

The same pipeline runs in two places; only *who runs it* and *what's in `content/`* differ.

### 2.1 Maintainer flow (this repo)

```
content/**  ──parse──▶  IR (Zod)  ──resolve deps──▶  adapt per target  ──▶  write + manifest
   ▲                                                        │
   └────────── golden snapshots + corpus tests ◀── validate ┘
```

- `pnpm build` compiles packages; `oac build --all` regenerates `.opencode/`, the CC plugin
  tree, and `AGENTS.md` from `content/`.
- CI gate: `oac build --check` (build to temp, diff, fail on drift) — generated trees can
  never silently diverge from source again.
- Releases: CI builds targets fresh, packs the tarball, publishes to npm + regenerates the
  CC marketplace entry. Humans never hand-edit generated trees.

### 2.2 User flow (their project)

```
npx @controlstack/oac init --profile developer --target claude,opencode
        │
        ├─ 1. copy profile's component set (+ dependency closure) from the BUNDLED
        │     content/ into  <project>/content/          ← theirs to edit
        ├─ 2. oac build  → generates .opencode/, .claude/…, AGENTS.md from THEIR content/
        ├─ 3. write .oac/manifest.json (sha256 ledger) + .oac.json (discovery)
        └─ 4. oac doctor --verify → confirms each tool actually loads the output
```

User project after init:

```
myproject/
├── content/            ← their editable source (team standards live here, in git)
├── .oac/               ← manifest.json (sha256), config.json, backups/<ts>/
├── .oac.json           ← discovery: { "context": { "root": "content" } }
├── .opencode/          ← generated (never hand-edit; rebuilt by oac build)
├── .claude/ | plugin   ← generated
└── AGENTS.md           ← generated (agents-md target — works with any tool)
```

The loop that makes it sticky: **edit `content/` → `oac build` → every tool updates.**
`oac update` refreshes upstream content sha256-safely (user-edited files are never
clobbered without `--yolo`); `oac add context:security` pulls a component + its dependency
closure and rebuilds affected targets.

**Closes `04` Q9:** yes, users keep an editable `content/` in their project. Without it,
"author once, build many" dies at the user boundary — the CLI therefore ships the full
parser + adapters, not pre-built output.

---

## 3. Package topology — one published package

**Closes `04` Q2.** Publish **exactly one** package under a fresh scope:
**`@controlstack/oac`** (bin: `oac`). `@controlstack/core` and `@controlstack/adapters` are
`"private": true` workspace packages **bundled into the CLI's `dist/` at build time**
(tsup/esbuild, `noExternal` for workspace deps).

> ⚠️ **Action before Stage 6:** claim the `controlstack` org on npmjs.com (and ideally the
> GitHub org) — scope names are first-come. Until it's claimed, docs/code keep the name
> behind a single constant so a rename is one commit.

Why one package:
- **No version skew** — a manifest's `oacVersion` unambiguously identifies parser + adapters
  + content that produced any output (the current 5-versions-across-7-files drift is the
  counter-example).
- **One install, one tarball, offline-complete** — nothing to resolve at runtime.
- **Smaller supply-chain surface** — users audit one package, not three.
- Of the three legacy names, **only `@nextsystems/oac` was ever published** (verified against
  the registry 2026-07-15: it sits at **0.7.0**). `@nextsystems/oac-cli` and
  `@openagents-control/compatibility-layer` both 404 — they were never published, so they
  need no deprecation and can simply be abandoned. (An earlier revision of this doc listed
  them at 1.0.0 and 0.1.0 and `@nextsystems/oac` at 0.7.1; all three were wrong.)
  `npm deprecate @nextsystems/oac` with a pointer at `@controlstack/oac` is therefore the
  **only** deprecation required, and it runs at Stage 6 release — it keeps existing 0.7.0
  installs working while steering new ones. If programmatic consumers show up later,
  publishing `@controlstack/core` separately is an additive, non-breaking step.

---

## 4. What npm ships (the tarball)

```jsonc
// root package.json (the published one)
{
  "name": "@controlstack/oac",
  "version": "<one version, everywhere>",
  "bin": { "oac": "packages/cli/bin/oac.js" },   // plain #!/usr/bin/env node
  "engines": { "node": ">=20" },
  "files": [
    "packages/cli/bin/",
    "packages/cli/dist/",     // bundled CLI (core + adapters inlined)
    "content/",               // the neutral source, shipped whole
    "LICENSE", "README.md", "CHANGELOG.md"
  ]
}
```

- `registry.json` ships *inside* `content/` — one bundled root, one root-detection anchor.
- Package root found by an explicit check (`package.json` `name === "@controlstack/oac"`),
  with `OAC_PACKAGE_ROOT` env override for the monorepo/dev case. This replaces `bundled.ts`'s
  registry-absence heuristic, which breaks post-refactor on **two** anchors (`06` G4).
- Explicitly NOT shipped: `.opencode/` (generated), `install.sh`/`update.sh` (deleted),
  `evals/`, `docs/`, any `node_modules` (enforced in `files` globs *and* the runtime walker).
- **No `postinstall` script. No install-time network.** `npx @controlstack/oac init` works
  offline after download — the modern replacement for `curl | bash`.
- Symlinks: none in `content/` (converted to `aliases[]` at Stage 1) — so tarball behavior
  is identical on every platform.

**Closes `04` Q1:** Node-portable build (option A). Bun is gone even for dev (pnpm + vitest);
one runtime story.
**Closes `04` Q6:** registry fully bundled; no remote registry in v1 (a remote catalog
pointing at unbundled components is meaningless).

---

## 5. pnpm — workspace and security posture

```yaml
# pnpm-workspace.yaml
packages:
  - packages/*
  - evals/framework
```

- **One lockfile** (`pnpm-lock.yaml`); `bun.lock`, root `package-lock.json`, and
  `.opencode/package-lock.json` all deleted.
- **Strict by default:** pnpm's non-flat `node_modules` eliminates phantom dependencies —
  every import must be declared, which is exactly the discipline the IR packages need.
- **Scripts off:** `pnpm.onlyBuiltDependencies: []` in root `package.json` — dependency
  lifecycle scripts (the #1 npm supply-chain vector) are ignored unless explicitly
  allowlisted. CI runs `pnpm install --frozen-lockfile` always.
- **Cooldown:** `minimumReleaseAge: 4320` (3 days) in `.npmrc`/pnpm settings — newly
  published dependency versions are not picked up immediately, blunting
  compromised-release attacks.
- **Publish integrity:** `pnpm publish` from CI only, with **npm provenance**
  (`--provenance`) so users can verify the tarball was built from this repo by CI.
- Renovate/dependabot PRs run the full package test matrix (Stage 0 CI gate) before merge.

Dev loop: `pnpm install` → `pnpm -r build` → `pnpm -r test` → `pnpm pack` (tarball smoke
test: install the packed tarball into a temp dir on 3 OSes in CI and run
`oac init && oac doctor --verify` — this IS the Stage 5 e2e gate).

---

## 6. Remaining `04` question closures

| Q | Decision |
|---|---|
| Q3 interactivity | Flags-first, fully non-interactive under CI. When stdin is a TTY and required flags are absent, `oac init` asks profile/target via `@clack/prompts` (keeps `install.sh`'s guided feel without bash menus). Every prompt has a flag equivalent. |
| Q4 default target | No tool detected + no `--target` + no TTY → default `agents-md` (universal, harmless); with TTY → prompt. Never guess a heavyweight target. |
| Q5 Windows global path | `getGlobalDir()` = `%LOCALAPPDATA%\oac` on Windows, `$XDG_CONFIG_HOME/oac` else `~/.config/oac`. Existing `~/.config/opencode` installs detected and adopted by `oac migrate`. |
| Q7 `apply` alias | Kept one minor release after Stage 6, printing a deprecation pointer to `oac build`. |
| Q8 backup retention | `oac clean` prunes `.oac/backups/` older than 30 days; never auto-deletes on update. |

---

## 7. Stage hooks (where this lands in `07`)

- **Stage 0** creates `pnpm-workspace.yaml`, deletes the competing lockfiles, moves dev
  scripts to pnpm.
- **Stage 2** creates `packages/core` in this shape (the compatibility-layer split).
- **Stage 3** creates `packages/adapters` + the `agents-md` target.
- **Stage 5** re-shapes `packages/cli`, retargets `bundled.ts`, implements §4's tarball and
  the pack-and-verify e2e.
- **Stage 6** flips `files`, deprecates the two old npm packages, and turns on provenance
  publishing.
