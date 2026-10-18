# Lessons learnt

This folder records the product decisions behind OpenAgentsControl and the lessons that led to them. Read it before proposing a change of direction. Add to it when a decision is made or a mistake teaches something.

| File | What it holds |
|---|---|
| [decisions.md](decisions.md) | Product decisions: what was decided, when, why, and what it rules out. Newest last. |
| [lessons.md](lessons.md) | Engineering and process lessons: what went wrong or surprised us, and the rule we now follow. |
| [../NORTH_STAR.md](../NORTH_STAR.md) | What OAC is, why it matters and how it works. Every decision here should serve it. |
| [../plan/ROADMAP.md](../plan/ROADMAP.md) | The living plan: status, next steps and releases. Map of all planning docs: [../plan/README.md](../plan/README.md). |

## Adding an entry

- **Decision:** add `D-NNN` to `decisions.md` with *Decision*, *Why*, *Rules out* and *Revisit when*. Never edit an old decision's meaning. Supersede it with a new entry and mark the old one `Superseded by D-NNN`.
- **Lesson:** add `L-NNN` to `lessons.md` with *What happened*, *Lesson* and *Rule now*. Link the commit, issue or PR.
- Keep entries short. If an entry needs more than about 15 lines, it belongs in a design doc linked from here.
