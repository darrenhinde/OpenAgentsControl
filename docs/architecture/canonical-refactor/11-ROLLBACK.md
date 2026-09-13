# 11 — Release Pinning, Abort Criteria, and Rollback

> **Status:** Decided — Stage 1 gate artifact.
> **Date:** 2026-07-15 · Applies to Stages 0–6 of `07-EXECUTION-PLAN.md`.
> **Authority:** This document closes `06-REVIEW.md` U2. It must be exercised by the Stage 6
> release-candidate drill before any auto-updating canonical release is promoted.

---

## 1. Safety contract

The refactor may advance only while the previous known-good release remains installable. A failed
gate stops the current stage; it never becomes a reason to weaken, skip, or relabel the gate. Until
Stage 6 completes its rollback drill, the hand-maintained producers and their release artifacts are
retained.

Every release records one version across the npm package, marketplace entry, plugin manifest, and
generated manifest. Release tags are immutable. The rollback target is always an already-verified
version or immutable repository tag, never a moving branch.

## 2. Claude Code plugin pin and rollback

Claude Code's supported install form is:

```text
/plugin install oac@oac-marketplace
```

Here `@oac-marketplace` selects the marketplace; it is **not a version selector**. There is no
documented `/plugin install oac@1.1.0` downgrade command. OAC therefore pins the marketplace
repository itself to an immutable Git tag. A full SHA is valid only for an explicitly configured
plugin source; it is not claimed as marketplace URL syntax here.

### Pin a known-good release

1. In `/plugin` → **Marketplaces**, disable automatic updates for `oac-marketplace`.
2. Uninstall the currently loaded plugin:

   ```text
   /plugin uninstall oac@oac-marketplace
   ```

3. Remove the moving marketplace source in the `/plugin` marketplace UI, then add the known-good
   repository tag (replace `v1.1.0` with the required release):

   ```text
   /plugin marketplace add https://github.com/darrenhinde/OpenAgentsControl.git#v1.1.0
   ```

4. Reinstall and reload:

   ```text
   /plugin install oac@oac-marketplace
   /reload-plugins
   ```

5. Confirm `/plugin` reports the expected marketplace/plugin version before resuming work.

For a fleet-wide emergency freeze, set `DISABLE_AUTOUPDATER=1` in Claude Code's environment. That
disables global automatic updates and is broader than the per-marketplace control, so remove it
after the incident is resolved.

### Publisher rollback

The maintainer creates a new patch release from the last known-good full SHA; published tags are
never moved. The marketplace version and plugin manifest must match that patch version. Users on a
pinned old tag remain stable, while users following the marketplace receive the corrective patch.

## 3. npm CLI pin and rollback

The decided Stage 6 package is `@controlstack/oac`. The `controlstack` npm organization must be
claimed before release; failure to claim it aborts Stage 6 rather than silently changing package
identity.

Install or restore an exact known-good version:

```bash
npm install --global @controlstack/oac@1.1.0
oac --version
npm view @controlstack/oac@1.1.0 version dist.integrity
```

For a one-off invocation that does not replace a global install:

```bash
npx --yes @controlstack/oac@1.1.0 doctor --verify
```

The maintainer never overwrites or unpublishes a known-good version. A regression is corrected by
publishing a new patch from the last known-good SHA, verifying its provenance/integrity, and moving
the npm `latest` tag only after the verification matrix passes.

## 4. Abort and revert criteria by stage

| Stage | Abort criterion | Required action before retry |
|---|---|---|
| **0 — foundations** | Frozen workspace install, required deterministic package matrix, security hotfix, or one-version check fails. | Do not start new packages. Revert the failing foundation change or document pre-existing non-blocking debt explicitly; restore the prior lockfile/release state if installs are not reproducible. |
| **1 — specification** | Any `BLOCKING` question remains in `01`–`05`, any F/C/L/G finding lacks a disposition, merge rules are unsigned, or rollback is not executable. | Stop implementation. Reconcile the documents and evidence; no Stage 2 code is written against an ambiguous contract. |
| **2 — core IR** | The corpus test has any failure or skip, a real dependency ref is unrepresentable, or parse→serialize changes a protected fixture unexpectedly. | Stop downstream work. Fix or revise the IR with an explicit Stage 1 disposition; do not add per-file bypasses. |
| **3 — adapters/build** | Golden output is unstable, a first-class target loses required security/delegation semantics, warning counts drift unexplained, or unsafe degradation succeeds without explicit opt-in. | Stop and retain the current producers. If the IR cannot express the real agents, fall back to OpenCode-as-source plus documentation generation as defined in `07`. |
| **4 — content merge** | An unowned conflict appears, the two trees prove to be different products, generated output fails a real-tool load, or eval performance drops below the recorded baseline. | Stop the merge and keep both source trees. Apply `09-MERGE-RULES.md`; if the trees are different products, choose one first-class product instead of forcing a lossy union. |
| **5 — CLI/parity** | Any supported OS needs Bun/bash, packed install fails, dependency closure is incomplete, user-edited files are overwritten without consent, or `doctor --verify` cannot prove target loading. | Keep the legacy installer available. Revert to the last packed CLI that passes the 3-OS matrix and repair parity before deletion. |
| **6 — flip/release** | Build is not clean/idempotent, the npm scope is unavailable, canary verification regresses, or either Claude/npm rollback drill cannot restore the prior version. | Do not move `latest`, enable marketplace auto-update, delete legacy producers, or uncommit generated trees. Restore the previous npm dist-tag and pinned marketplace source, then repeat the full drill. |

## 5. Stage 6 release-candidate drill

For candidate `x.y.z-rc` with previous known-good `x.y.(z-1)`:

1. Build once from canonical `content/`; require a clean second build and clean Git diff.
2. Pack/install the candidate on Ubuntu, macOS, and Windows without Bun; run
   `oac init` and `oac doctor --verify` for every first-class target.
3. Publish the candidate under an npm prerelease tag, never `latest`.
4. Point a canary Claude marketplace source at the candidate tag and disable automatic
   promotion. Verify plugin discovery, agents, hooks, skills, and bundled context.
5. Roll the npm canary back with an exact `@controlstack/oac@x.y.(z-1)` install and rerun
   `doctor --verify`.
6. Roll the Claude canary back by uninstalling, adding the `vX.Y.(Z-1)` marketplace repository
   tag, reinstalling, and reloading plugins. Verify the displayed version and a real agent load.
7. Record commands, versions, SHAs, integrity values, and verification output in the release
   artifact. Any failed step triggers the Stage 6 abort criterion.

Only after both rollback paths pass may CI promote npm `latest`, update the moving marketplace,
and permit automatic updates.

## 6. Evidence and limitations

Official Claude Code documentation supports marketplace repository branch/tag `#ref` pinning,
plugin source `ref`/full SHA, exact npm source versions, and per-marketplace update control. It does not document
arbitrary user-side plugin version syntax or a direct downgrade command. This procedure therefore
uses only the supported repository pin and reinstall flow.

References:

- <https://code.claude.com/docs/en/discover-plugins>
- <https://code.claude.com/docs/en/plugin-marketplaces>
- <https://code.claude.com/docs/en/plugin-dependencies>
- <https://code.claude.com/docs/en/plugins-reference>
- <https://code.claude.com/docs/en/setup#disable-auto-updates>
- `07-EXECUTION-PLAN.md` Stage 6 and kill criteria
- `08-STRUCTURE-AND-PACKAGING.md` §§3–5
- `09-MERGE-RULES.md` (signed-off Stage 4 merge contract)
