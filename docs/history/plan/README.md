# OAC plan

Everything about where OpenAgentsControl is going lives here or is linked from here.

## Where to look

| You want | Go to |
|---|---|
| What OAC is and the six promises | [../NORTH_STAR.md](../NORTH_STAR.md) |
| Where we are now and what's next | [ROADMAP.md](ROADMAP.md) (the living plan) |
| Why something was decided | [../lessons-learnt/decisions.md](../lessons-learnt/decisions.md) (D-001 onwards) |
| What went wrong and the rule we now follow | [../lessons-learnt/lessons.md](../lessons-learnt/lessons.md) (L-001 onwards) |
| The detailed research and first plans (frozen) | [initial-planning/](initial-planning/README.md) |
| The scenario catalogue the test suite builds from | [initial-planning/scenarios-catalog/](initial-planning/scenarios-catalog/CATALOG.md) |
| The test suite itself | `evals/v2/`, run with `pnpm test:local` (`quick`, `hosts`) |
| Checks that fail on purpose today | [`evals/v2/src/checks/known-red.yaml`](../../evals/v2/src/checks/known-red.yaml) |

## How the plan is organised

- **[ROADMAP.md](ROADMAP.md)** is the only file that tracks progress. It reflects the latest decisions and links to the detail.
- **[decisions.md](../lessons-learnt/decisions.md)** holds every product decision. The roadmap links to them and never restates them differently.
- **[initial-planning/](initial-planning/README.md)** is the phase-1 record (2026-10-16..18). It is frozen. Where it differs from the roadmap or the decisions, they win.

## How to update it

1. When a step merges, move its row in `ROADMAP.md` from Now/Next to the Done log with the commit sha.
2. When a known-red check turns green, remove it from `known-red.yaml` (the suite fails until you do) and from the roadmap's known-red table.
3. When a decision is made, add `D-NNN` to `decisions.md` first, then link it from the roadmap.
4. Change the "Last updated" line at the top of `ROADMAP.md`.
5. Don't edit `initial-planning/`. If a frozen doc turns out wrong, say so in the roadmap or a decision.
