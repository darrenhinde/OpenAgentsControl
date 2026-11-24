# OAC Context Discovery Protocol

> Single source of truth for all context root discovery.
> Referenced by: context-scout agent, context-discovery skill, any agent needing project context.

---

## Summary

```
.oac.json exists?  YES → read context.root → done (fast path)
                   NO  → run discovery chain
                          Found?  YES → signal main agent to write .oac.json (if project-local)
                                   NO  → return setup tips
```

---

## Step 1: Check .oac.json (Fast Path)

```
Glob: .oac.json
```

If the file exists, read it and extract `context.root`:

```json
{
  "version": "1",
  "context": {
    "root": ".claude/context"
  }
}
```

- Use `context.root` as the resolved context root. **Stop here.**
- If `context.root` is set but that directory has no `navigation.md`: fall through to Step 2 and warn the caller.

---

## Step 2: Discovery Chain

Only runs if Step 1 found no `.oac.json` (or the path in it was invalid).

Check each path **in order**. Stop at the first that has a `navigation.md` file:

```
1. Glob: .claude/context/navigation.md          → root = .claude/context           (project-local)
2. Glob: context/navigation.md                  → root = context                   (project-local)
3. Glob: .opencode/context/navigation.md        → root = .opencode/context         (project-local)
4. Check: ~/.claude/context/navigation.md       → root = ~/.claude/context         (global install)
5. Glob: {PLUGIN_ROOT}/context/navigation.md    → root = {PLUGIN_ROOT}/context     (plugin fallback)
```

`{PLUGIN_ROOT}` is provided in your session context under **OAC System Paths**.
`~` expands to the user's home directory (`$HOME` on Mac/Linux, `%USERPROFILE%` on Windows).

**First match wins.**

---

## Step 3: Signal .oac.json Creation

After a successful discovery chain match, signal the **main agent** (not context-scout — it is read-only) to write `.oac.json` at the project root **only if** the resolved root is project-local:

| Resolved root           | Write .oac.json? |
|-------------------------|------------------|
| `.claude/context`       | ✅ yes           |
| `context`               | ✅ yes           |
| `.opencode/context`     | ✅ yes           |
| `~/.claude/context`     | ❌ no (global install — applies to all projects, no per-project pointer needed) |
| `{PLUGIN_ROOT}/context` | ❌ no (machine-specific path — don't commit this) |

Content to write at project root `.oac.json`:

```json
{
  "version": "1",
  "context": {
    "root": "{resolved_root}"
  }
}
```

---

## Step 4: No Context Found

If all steps fail, **do not error**. Return this message to the user:

```
No context found for this project.

  Option 1 — Download standard context bundles (recommended):
    Run: /install-context
    Downloads coding standards, security patterns, workflows, and more.

  Option 2 — Point to docs you already have:
    Create .oac.json at your project root:
    {
      "version": "1",
      "context": { "root": "path/to/your/docs" }
    }

  Option 3 — Proceed without context:
    Standards won't be applied — code quality may be inconsistent.
```

---

## Return Format

Always return these three values:

| Field            | Value                                                                                                              |
|------------------|--------------------------------------------------------------------------------------------------------------------|
| `context_root`   | Resolved path (e.g. `.claude/context`)                                                                            |
| `source`         | `oac.json` \| `discovery:claude` \| `discovery:context` \| `discovery:opencode` \| `discovery:plugin` \| `none`  |
| `write_oac_json` | `true` if main agent should create `.oac.json` with this root, else `false`                                       |

---

## Notes for Callers

- **context-scout** is read-only — it signals `write_oac_json: true` but cannot write the file itself.
- **Main agent** (or install-context) is responsible for writing `.oac.json`.
- **install-context** always writes `.oac.json` after a successful install — no discovery needed.
- Once `.oac.json` exists, discovery chain never runs again (fast path always wins).
