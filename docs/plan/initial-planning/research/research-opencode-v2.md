# OpenCode v1 → v2: what changed and how it affects OpenAgentsControl (OAC)

Research date: 2026-10-16. Everything below comes from primary sources: the anomalyco/opencode source at tags `v2.0.31` and `v1.19.3` (downloaded with `gh api repos/anomalyco/opencode/tarball/<tag>`), the v2 docs inside that repo, opencode.ai, the npm registry and the OAC GitHub issues. Each claim cites a file or URL. Anything not verified is marked **UNVERIFIED**.

Abbreviations:
- `V2SRC` = anomalyco/opencode @ `v2.0.31`.
- `V1SRC` = anomalyco/opencode @ `v1.19.3`.
- `DOCS` = `V2SRC/services/www/src/docs/content/`. These are the files served at https://opencode.ai/v2/docs/...
- `OAC` = `/Users/darrenhinde/Documents/GitHub/MYBUSINESS/worktrees/OpenAgentsControl/refactor-canonical` (branch `refactor/canonical`, HEAD `d7924e4`).

---

## 0. Versions, dates, where v2 lives

| Fact | Value | Source |
|---|---|---|
| Repo | `sst/opencode` now redirects to **`anomalyco/opencode`** | `gh repo view sst/opencode` returns `anomalyco/opencode` |
| **v2.0.0** | npm `@opencode/cli@2.0.0` published **2026-09-11T23:44:52Z**; tag commit `63f7ceec` at 2026-09-11T23:46:37Z | `npm view @opencode/cli time`; `gh api repos/anomalyco/opencode/commits/v2.0.0` |
| Latest v2 | **v2.0.31**, npm 2026-10-16T12:36:44Z (tag `22728d67`). The newest entry in CHANGELOG.md is v2.0.30, dated 2026-10-15 | npm; `V2SRC/CHANGELOG.md` |
| v2 issue reporter's version (#362) | v2.0.9, published 2026-09-19 | npm; OAC #362 |
| Latest v1 | **v1.19.3**, 2026-10-16. v1 is still being released in parallel | `gh release list -R anomalyco/opencode` |
| GitHub Releases | v2 has **no** GitHub Release objects (0 `v2*` releases). v2 ships only as git tags, CHANGELOG.md and npm | `gh api repos/anomalyco/opencode/releases --paginate` |
| Package renames | v1 `opencode-ai`, `@opencode-ai/sdk`, `@opencode-ai/plugin` (all at 1.19.3). v2 `@opencode/cli` (bins `opencode`, `opencode2`), `@opencode/client`, `@opencode/sdk`, `@opencode/plugin`, `@opencode/core` (all at 2.0.31) | `V2SRC/packages/*/package.json`; `npm view` |
| Side by side | "OpenCode 1 and OpenCode 2 both use the `opencode` command and are no longer installed side by side by default… the V2 curl installer replaces the V1 binary." | `DOCS/migrate-v1.mdx` L5-6 (live: https://opencode.ai/v2/docs/migrate-v1) |
| Docs URLs | https://opencode.ai/docs/* still carries the v1 docs with a "New OpenCode v2 is now available" banner. The v2 docs are at https://opencode.ai/v2/docs/*, and https://opencode.ai/docs/migrate-v1 returns 404 | WebFetch, 2026-10-16 |

### Official statement of what breaks

From `DOCS/migrate-v1.mdx` L10-23: "V2 has three intentional breaking changes: Plugins use a new plugin API. The server API and clients have new contracts. Terminal client configuration moves from layered `tui.json(c)` files to one global `cli.json` file (auto migrated)." The same file also says: "Existing supported server config fields, agent definitions, command definitions, skills, and other files in `.opencode/` should continue to work without changes."

The guide does not count the following as breaking, but they matter for OAC (sections below):
- Agent IDs and display names are now path-derived, and frontmatter `name:` is ignored.
- Agent `temperature` is preserved but not sent.
- `.opencode/tool/` custom tools are no longer discovered.
- `external_directory` is allowed by default.
- The CLAUDE.md fallback is gone.
- LSP no longer runs.

---

## Part 1. Changes from v1.x to v2

### 1.1 Config file (`opencode.json` / `opencode.jsonc`)

- **Same locations; V1 shape still accepted.** V2 reads the same system, global and project paths. It normalizes V1 fields in memory without rewriting the file, and V1 and V2 keys may be mixed at the top level. Inside an individual agent, provider, command or model entry the two formats must not be mixed. (`DOCS/migrate-v1.mdx` L49-93)
- **`$schema` stays `https://opencode.ai/config.json`.** 68 v2 doc examples use it. v2.0.30 changed it to "a configuration schema that accepts both V1 and V2 configuration shapes during migration" (`V2SRC/CHANGELOG.md`, #55524). The TUI client file has its own schema, `https://opencode.ai/v2/cli.json`.
- **Renamed keys** (V1 → V2 native; all from `DOCS/migrate-v1.mdx`):
  - `permission`{tool→rule} → `permissions`: an ordered array of `{action, resource, effect}`. The top-level `tools: {x:false}` toggle becomes a deny rule.
  - `agent` and `mode` maps → `agents`.
  - `command` → `commands`, and `subtask` → `subagent`.
  - `plugin` → `plugins`. The `[pkg, opts]` tuple becomes `{package, options}`.
  - `provider` → `providers`. `npm` → `package` with an `aisdk:` prefix, `api` → `settings.baseURL`, and `options` are split into `settings`, `headers` and `body`.
  - `snapshot` → `snapshots`, `attachment` → `media`, `reference` → `references`.
  - MCP servers move under `mcp.servers`, `enabled` → `disabled`, and `timeout` → `{catalog, execution}`. OAuth fields become snake_case.
  - `compaction.preserve_recent_tokens` → `compaction.keep.tokens`, and `reserved` → `buffer`.
  - `skills.{paths,urls}` → one `skills` array.
  - `autoupdate` → `update`.
  - `small_model` → `agents.title.model`.
  - `enabled_providers` and `disabled_providers` → `policies`.
  - Model fields: `id` → `modelID`, the `variants` object → an array, and `variant` is folded into `provider/model#variant`.
- **Accepted, but ignored with a warning** (L432-449):
  - `logLevel`
  - `server`
  - top-level `subagent_depth` (use `experimental.subagent_depth`)
  - `compaction.tail_turns` and `compaction.prune`
  - agent `name` inside JSON config
  - experimental fields `batch_tool`, `openTelemetry`, `primary_tools`, `continue_loop_on_deny`
  - provider fields `id`, `whitelist`, `blacklist`
  - several provider-model fields
- **LSP:** "V2 accepts and preserves `lsp` configuration, but it does not run language servers, expose LSP tools, or produce LSP diagnostics." (L418-419)
- **Provider IDs renamed:** `azure-cognitive-services` → `azure`, and `google-vertex-anthropic` → `google-vertex`. The top-level `model` keeps its literal ID, so you have to change it by hand. (L366-375)
- The v1 → v2 conversion code is `V2SRC/packages/core/src/v1/config/{migrate,agent,permission,command,mcp,provider}.ts`.

### 1.2 Agent definitions

- **Locations.** V2 still discovers `agent/`, `agents/`, `mode/` and `modes/`. The preferred location is `.opencode/agents/<name>.md`. (`DOCS/migrate-v1.mdx` L451-471; the discovery globs `{agent,agents}/**/*.md` and `{mode,modes}/*.md` are in `V2SRC/packages/core/src/config/plugin/agent.ts` L21-24)
- **Agent ID = relative path, and frontmatter `name:` is no longer honoured (major).**
  - V2 `decode()` computes `name = relative(path).replace(/^(agent|agents|mode|modes)\//,"").replace(/\.md$/,"")` and registers `agents: { [name]: … }` (`V2SRC/.../config/plugin/agent.ts` L180-211). Frontmatter `name` is accepted by the legacy schema but never used as the key.
  - The display name defaults to the ID: `Agent.Info.default` sets `name: Name.make(id)` (`V2SRC/packages/schema/src/agent.ts` L39-42).
  - The docs say so directly: "A nested path becomes part of the agent ID: `.opencode/agents/team/reviewer.md → team/reviewer`" (`DOCS/agents.mdx`, Locations).
  - In V1, by contrast, the loader built `{ name: <path-derived>, ...md.data }`, so frontmatter `name:` overrode the key (`V1SRC/packages/opencode/src/config/agent.ts` L22-28).
- **Ordering.**
  - V1 `Agent.list()` sorted the default agent first, then by `name` ascending (`V1SRC/packages/opencode/src/agent/agent.ts` L316-325).
  - V2 `Agent.list()` puts the selected default first and leaves the rest in insertion order: built-ins first, then files in `toSorted()` full-path order (`V2SRC/packages/core/src/agent.ts` L106-111; `config/plugin/agent.ts` L169-178).
  - The TUI Tab/Shift+Tab cycle uses that list filtered to `mode !== "subagent" && !hidden` (`V2SRC/packages/tui/src/context/local.tsx` L59-61, L121-123).
- **Native V2 frontmatter fields:** `model` (`provider/model#variant`), `request{headers,body}`, `system`, `description`, `mode` (`primary|subagent|all`), `hidden`, `color` (hex only), `steps`, `disabled`, `permissions` (array). (`V2SRC/packages/schema/src/config/agent.ts`)
- **Legacy frontmatter is auto-translated.** If any key is not a V2 key, the file is decoded with the V1 schema and migrated (`config/plugin/agent.ts` L187-200; `v1/config/migrate.ts` `migrateAgent`). The mapping:
  - `prompt` → `system`
  - `disable` → `disabled`
  - `maxSteps` → `steps`
  - `temperature`, `top_p` and **every unknown key** → `request.body`. Unknown keys first go into `options` in `v1/config/agent.ts` `normalize`.
  - V1 `tools:{x:bool}` → permission allow/deny with resource `*`, and `write`/`patch` → `edit` (`v1/config/agent.ts` L52-56)
  - Theme-name colours such as `primary` → `#aaaaaa` (`migrate.ts` L49)
  - If decoding fails, the agent is **silently dropped**: `decode` returns `undefined` (`config/plugin/agent.ts` L196-205).
- **`temperature` and other `request.body` values do nothing in V2 today.** The docs warn: "The V2 session runner preserves these values but does not yet send them with model requests. Configure active request settings on the provider, model, or model variant instead." (`DOCS/agents.mdx`, Request callout)
- **Default `mode`.** For a new custom agent with no `mode`, it now defaults to `primary` (`DOCS/agents.mdx`, Modes; `Agent.Info.default` mode `"primary"`). **UNVERIFIED:** the docs reviewed do not state the V1 default, which I believe was `all`.
- **`hidden`** now removes the agent from listings **and from the subagent catalog** (`DOCS/agents.mdx`, Hidden).
- **Built-ins:** `build`, `plan`, `general` and `explore` are visible. `compaction`, `title` and `summary` are hidden. "V2 has no built-in `scout` agent." (`DOCS/agents.mdx`, Builtins)

### 1.3 Permission model

- **Syntax.** One ordered array of `{action, resource, effect}`, with `effect` ∈ `allow|deny|ask`. "If no rule matches, OpenCode uses `ask`." (`DOCS/permissions.mdx`)
- **Action renames.** `bash` → `shell`, `task` → `subagent`, `write`/`patch` → `edit` (`DOCS/migrate-v1.mdx` L123; code `normalizeAction` in `v1/config/migrate.ts` L28-33).
- **Wildcards.** `*` matches any characters including `/`, and `?` matches exactly one. The pattern must match the whole value. Matching is case-insensitive only on Windows. A shell pattern ending in ` *` also matches the bare command. (`DOCS/permissions.mdx`, Matching) This is the same algorithm as V1 `Wildcard.match` (`V1SRC/packages/opencode/src/util/wildcard.ts`).
- **Last match wins.** Evaluation is `rulesets.flat().findLast(...)` (`V2SRC/packages/core/src/permission.ts` L87-97). Rules are layered in this order: lower-priority config, then global, then agent rules appended last. "Agent rules are appended after global rules; they do not replace the global array." (`DOCS/permissions.mdx`)
- **V1 object order is preserved.** The comment in `v1/config/permission.ts` reads: "Permission rules are last-match-wins, so the order an author writes keys in is policy… these objects decode to entries read directly from the input."
- **Multi-resource operations.** "Any `deny` denies the operation; otherwise any `ask` asks." (`DOCS/permissions.mdx`)
- **A deny can hide the tool (#349).** `whollyDisabled(action, rules)` takes the last rule whose *action* matches, ignoring the resource. If that rule is `resource:"*"` with `effect:"deny"`, the tool is not registered for the request at all (`V2SRC/packages/core/src/tool.ts` L231, L292-295). **This is unchanged from V1:** `Permission.disabled()` in `V1SRC/packages/opencode/src/permission/index.ts` L204-214 has identical logic. #349 is therefore a latent OAC bug in both V1 and V2, not a V2 regression. A block like `bash: { "tsc": allow, …, "*": deny }` hides `shell` completely.
- **New defaults.**
  - Every agent starts with `[* * allow, read *.env ask, read *.env.* ask, read *.env.example allow]`.
  - `general` denies `question` and `subagent`. `explore` is read-only.
  - **`external_directory` is now allowed by default.** V1 asked. Restore the old behaviour with `{action:"external_directory",resource:"*",effect:"ask"}`. (`DOCS/permissions.mdx`, Defaults; `DOCS/migrate-v1.mdx` L126-129)
- **Removed actions.** `doom_loop` and `lsp` are no longer V2 actions (`DOCS/permissions.mdx`).
- **New action.** `execute` (Code Mode). Denying it with `*` removes Code Mode and the tools reachable only through it.
- **New `policies` layer.** Policies hard-deny after rules and saved approvals (`DOCS/permissions.mdx`, Policies). They became a top-level key in v2.0.29 (`CHANGELOG.md`).
- **Approval replies** are `once`, `always` and `reject`. **HTTP API change:** the reply field was renamed from `reply` to `decision` (`V2SRC/V2_HTTP_API_AUDIT.md` #100).

### 1.4 Tools

- **V2 built-in tools** (`V2SRC/packages/core/src/tool/plugin/`): `read`, `glob`, `grep`, `edit`, `write`, `patch`, `shell`, `webfetch`, `websearch`, `question`, `skill`, `subagent`, MCP resource tools, and `execute` (Code Mode) with the `opencode.*` namespace (`session_rename`, `session_move`, `worktree_create`, `worktree_list`, `worktree_remove`). Source: `DOCS/tools.mdx`; `CHANGELOG.md` v2.0.27.
- **Gone compared with V1** (`V1SRC/packages/opencode/src/tool/`): `bash` → `shell`, `task` → `subagent`, `apply_patch` → `patch`, plus `todowrite`/`todo`, `lsp`, `plan` enter/exit and `list`. v2.0.28 "Removed the stale `todowrite` label from tool output" (`CHANGELOG.md`).
- **`patch` exposure.** It is offered only for supported GPT models; other models get `edit` and `write` (`DOCS/tools.mdx`).
- **Subagent tool.**
  - The parameter is now `agent`; V1 used `subagent_type`.
  - Resolution is an **exact ID match**: `agents.resolve(input.agent)` → `state.agents.get(ID.make(id))`. Anything else fails with `Unknown agent: <x>`, and a primary-mode agent fails with "cannot run as a subagent".
  - Sources: `V2SRC/packages/core/src/tool/plugin/subagent.ts` L29-49, L134-141; `core/src/agent.ts` L94-97.
  - The permission check for a subagent call uses the resource `agent.id`.
- **Custom tools in `.opencode/tool(s)/*.ts` are no longer discovered.**
  - V1 scanned `{tool,tools}/*.{js,ts}` (`V1SRC/packages/opencode/src/tool/registry.ts` L185).
  - V2 has no such scan: the only config-dir scans are agents, commands, skills and plugins (`V2SRC/packages/core/src/config/plugin/*.ts`; grep found no `tool,tools` glob).
  - The v2 path is a plugin calling `ctx.tool.transform(editor => editor.add({name, description, input: <JSON Schema>, execute}))`, which returns `{content}` (`DOCS/build/plugins/migrate-v1.mdx` "Migrate custom tools").
  - The v1 docs page https://opencode.ai/docs/custom-tools/ still documents `.opencode/tools/`.
  - Absence is verified by source search; there is no explicit removal note.
- **`tools:` toggle vs permissions.** In V2 there is no `tools` key in native agent config; "Do not use legacy top-level fields such as … `tools` …" (`DOCS/agents.mdx`). The legacy `tools:{x:false}` becomes `{action:x, resource:"*", effect:"deny"}`, which is wholly disabled and so hidden (`v1/config/agent.ts` L52-56).

### 1.5 Plugin API (hard break)

- "V1 plugin implementations do not run in V2. Moving a file or renaming its config entry is not enough." (`DOCS/migrate-v1.mdx` L557-559; `DOCS/build/plugins/migrate-v1.mdx` L9-11)
- **Package and entrypoint.** `@opencode-ai/plugin` becomes `@opencode/plugin`. The plugin is `export default Plugin.define({ id, async setup(ctx) { … } })`, and the `id` is mandatory. `setup` returns a cleanup function in place of `dispose`. (`DOCS/build/plugins/migrate-v1.mdx` L42-75)
- **Context mapping:**

| V1 | V2 |
|---|---|
| `directory` | `ctx.location.directory` |
| `project` | `ctx.location.project` |
| `client` | domain methods (`ctx.session`, `ctx.permission`, `ctx.agent`, …) |
| options argument | `ctx.options` |
| `$` (Bun shell) | removed |
| global files | `ctx.storage` (new) |

- **Hook mapping** (L142-175). Hook callbacks now receive one mutable `event` in place of `(input, output)`.

| V1 hook | V2 equivalent |
|---|---|
| `event` | `ctx.event.subscribe()` (async iterable) |
| `tool` map | `ctx.tool.transform` |
| `config` | domain transforms |
| `auth` | `ctx.integration.transform` |
| `provider` | `ctx.provider.transform` / `ctx.model.transform` |
| `chat.message` | `ctx.session.hook("prompt")` |
| `chat.params` | `ctx.session.hook("context")` |
| `chat.headers` | `ctx.session.hook("model.request" \| "http.request")` |
| `permission.ask` | `ctx.permission.hook("evaluate")` |
| `tool.execute.before/after` | `ctx.tool.hook("execute.before"/"execute.after")` |
| `shell.env` | `ctx.shell.hook("create.before")` |
| `tool.definition` | `ctx.tool.transform` |
| `experimental.chat.system.transform`, `experimental.chat.messages.transform` | `ctx.session.hook("context")` |
| `experimental.session.compacting` | `ctx.session.hook("compaction")` |
| `command.execute.before` | no 1:1 hook |
| `experimental.compaction.autocontinue`, `experimental.provider.small_model`, `experimental.text.complete` | no direct hook |

- **Local plugin directories.** Both `.opencode/plugin/` and `.opencode/plugins/` are scanned, and `plugins/` is preferred (L38).
- **Dual V1+V2 package.** Spread `Plugin.define(...)` and add a `server()` V1 entrypoint. This works on OpenCode ≥ 1.18.29. (L328-357)
- **Newer plugin APIs:** `ctx.permission.assert` (v2.0.29); `credential.activate` (v2.0.28); MCP tool input in permission requests as `metadata.input` (v2.0.30). Source: `CHANGELOG.md`.
- **UNVERIFIED:** whether a V1-shaped module in `.opencode/plugin/` logs an error or is skipped silently. The docs say only that it does not run.

### 1.6 Commands, skills, the `question` tool, instructions

- **Commands.**
  - `command/` and `commands/` are both scanned; `commands/` is preferred (`config/plugin/command.ts` L159; `DOCS/migrate-v1.mdx` L473-497).
  - Frontmatter `description`, `agent` and `template` (the body) keep their names. `subtask` → `subagent`, and the legacy name is still accepted. Delegated commands "now run automatically in the background". `variant` is folded into `model#variant`.
  - HTTP change: `session.command`'s request field went from `command` to `name` (`V2_HTTP_API_AUDIT.md` #060).
- **Skills.**
  - `SKILL.md` is fully supported. Project sources are `.opencode/skill/` and `.opencode/skills/` (preferred), plus the compatibility paths `.claude/skills` and `.agents/skills`, and globally `~/.claude/skills` (`DOCS/skills.mdx`, Discovery; `DOCS/migrate-v1.mdx` L499-509).
  - Root-level `*.md` and `**/SKILL.md` are both scanned (`config/plugin/skill.ts` L121).
  - The permission action is `skill` with the skill ID as resource. `metadata.opencode/autoinvoke: false` hides a skill.
  - v2.0.30 honours `OPENCODE_DISABLE_CLAUDE_CODE_SKILLS`.
- **`question` tool.**
  - Still present, with permission `question` and resource `*`. The client must support the form (`DOCS/tools.mdx`).
  - Allowed for custom agents via the base `* allow`. The built-in `general` agent denies it.
  - V1 required `question`, `websearch` and `doom_loop` permission values to be scalar; this check is kept for legacy input (`v1/config/permission.ts` L33-44).
- **Instructions.**
  - Only `AGENTS.md` is discovered: global `~/.config/opencode/AGENTS.md`, then ambient files from cwd up to home. **The CLAUDE.md fallback is gone** (`DOCS/migrate-v1.mdx` L511-518).
  - `instructions` config is unchanged. Globs and URLs were fixed in v2.0.30.

### 1.7 SDK / server API (hard break; affects the eval harness)

- "Integrations that call the V1 server API must migrate to the V2 API. Use the `@opencode/client` package…" (`DOCS/migrate-v1.mdx` L564-570)
- **Client packages.**
  - `@opencode/client` is the network client: `OpenCode.make({ baseUrl, headers, fetch })`, with methods grouped by resource, and `client.event.subscribe()` returns an async iterable (`DOCS/build/client/index.mdx`).
  - `@opencode/sdk` is an **in-process** host: `await using oc = await OpenCode.create({ plugins })`. It opens no HTTP listener (`DOCS/build/sdk/index.mdx`; `V2SRC/packages/sdk/README.md`).
  - Neither is `@opencode-ai/sdk`. V1 `createOpencode()` / `createOpencodeClient()` do not exist in V2.
- **Routes.** Every route is now under `/api/...`. There are 118 paths in `V2SRC/packages/protocol/openapi.json`, and the only non-`/api` route is `/auth/connect/{code}`. No V1 routes remain: the V1 `/session/:id/message` and `/session/:id/permissions/:permissionID` paths are gone.
- **Changes by endpoint** (from `V2_HTTP_API_AUDIT.md` and `openapi.json`):
  - `POST /api/session` takes `{id,parentID,title,agent,model,location,metadata,permissions}`, so **the agent is chosen at session create** (or later with `POST /api/session/{id}/agent`, `session.switchAgent`).
  - `POST /api/session/{id}/prompt` takes `{text (required), files, agents, skills, metadata, delivery, resume}`. It has **no `parts`, `agent`, `model` or `noReply`**. It returns `{data: Session.Inbox.User}`: an **admission receipt, not the assistant reply**. Completion has to be observed through events (`session.idle`, `session.execution.succeeded`), or through `POST /api/experimental/session/{id}/wait`, which is experimental.
  - Messages: `GET /api/session/{id}/message` (`session.message.list`).
  - Abort is now `POST /api/session/{id}/interrupt`.
  - Delete is now `DELETE /api/session/{id}` (`session.remove`).
  - Permission reply: `POST /api/session/{id}/permission/{requestID}/reply` with body `{decision: once|always|reject, message?}`.
  - Health: `GET /api/info` replaces health/server.
- **Event names** (`V2SRC/packages/schema/src`): `permission.asked`, `permission.replied`, `session.idle`, `session.status`, `message.updated`, `message.part.updated`, `message.part.delta`, `session.created`, `session.tool.called`, `session.tool.success`, `session.tool.failed`, `session.execution.*`, `server.connected`, and others. There is **no `permission.request`** event. **UNVERIFIED:** which of these are V1-compat (`schema/src/v1/*`) and which are native V2 envelopes. Event payloads are `{type, data}` in the TUI (`evt.data.sessionID`, `tui/src/context/local.tsx` L69) where V1 used `{type, properties}`.
- **`opencode serve`.**
  - It still exists with `--hostname`, `--port`, `--cors`, `--service` and `--stdio` (`V2SRC/packages/cli/src/commands/commands.ts` L550-563).
  - The startup line changed to `server listening on <url>` (V1: `opencode server listening on http://…`). Sources: `V2SRC/packages/cli/src/server-process.ts` L202; `V1SRC/packages/opencode/src/cli/cmd/serve.ts` L20.
  - **It is password-protected by default.** It generates a random password and prints `server password <pw>` unless `OPENCODE_PASSWORD` or `OPENCODE_SERVER_PASSWORD` is set (server-process.ts L80-92, L203; `cli/env.ts` L10-11). The server enforces HTTP Basic auth (`packages/server/src/fetch.ts` L32; `middleware/authorization.ts`).
  - The VS Code extension broke on the "removed `--port` argument" of a different launch path (v2.0.28, #49084). **UNVERIFIED:** which command lost `--port`.
- **Shared background service.** There is a new `opencode service start|stop|status|set` (`DOCS/cli/commands.mdx`).

### 1.8 Code Mode (OAC #353)

- `execute` runs JavaScript in a sandbox that can call and combine catalog tools. It has no filesystem, imports or timers, and `fetch` cannot use `file://` since v2.0.27. Source: `DOCS/tools.mdx`, Execute.
- **MCP tools default to Code Mode.** The MCP option `codemode` defaults to `true`, and `codemode:false` exposes a server's tools directly (`DOCS/mcp-servers.mdx` L119, L174, L374).
- **Permissions.** Nested tools still enforce their own rules. Denying `execute *` removes Code Mode altogether.
- **Built-in namespaces** are `opencode.*` (session and worktree utilities) and `browser.*` (desktop browser).
- Effect on OAC: nothing breaks. #353 is a feature request; an option is to describe Code Mode in agent prompts or deny `execute` for tightly scoped subagents.

### 1.9 Other

- **TUI config.** It moved to a global `~/.config/opencode/cli.json`, migrated automatically from global `tui.json`. Project-local TUI config is **not** migrated. (`DOCS/migrate-v1.mdx` L520-531)
- **LSP is gone.** Config is preserved but not run (L418).
- **MCP.** The shape is `mcp.servers`, the V1 shape is still accepted, and tools go through Code Mode by default.
- **Plan agent writes** go to `~/.opencode/plan` (`DOCS/permissions.mdx`).

---

## OAC user-reported symptoms (GitHub issues)

| Issue | Reporter / date | Symptom | Root cause (verified in source) |
|---|---|---|---|
| **#349** "permission rules ending in `"*": "deny"` hide the tool entirely" | wzkagms, 2026-08-13, open; PR #354 reorders 7 files | BuildAgent, TestEngineer, TaskManager and others silently lose `bash`/`task` | `whollyDisabled` / `Permission.disabled` uses `findLast` on action; a last `* deny` hides the tool. **Same in V1.19.3 and V2.0.31**, so this is not a v2 regression. |
| **#353** "opencode 2.0 codemode" | ramonskie, 2026-08-25, open, no comments | Asks whether OAC will adopt Code Mode | Feature request; see 1.8 |
| **#362** "v2 profile names are displayed in the wrong order and include directory names" | itzzjustmateo, 2026-09-19, open; OpenCode v2.0.9, `advanced` profile | Shift+Tab shows `core/openagent`-style names in unexpected order | V2 IDs and display names are path-derived; frontmatter `name:` is ignored; the list is unsorted (built-ins, then sorted file paths). See 1.2. |
| **#367** "port AbilitiesPlugin to the v2 plugin API" | canomogollon, 2026-10-14, open | V1 plugins do not load; OAC pins `@opencode-ai/plugin ^1.0.162` | Plugin API break (1.5). **Note:** on `refactor/canonical`, `packages/plugin-abilities` was deleted in `cce5255` ("delete dead packages/plugin-abilities"), but it still exists on `main`. The `.opencode/plugin*` files below are still affected. |

Searches for "v2", "2.0", "opencode upgrade", "breaking", "opencode 2" and "plugin load" (`gh issue list -R darrenhinde/OpenAgentsControl --state all --search …`) found no other v2-specific reports. #268 (closed, "question not working") predates v2.

---

## Part 2. Impact on OAC (refactor-canonical worktree, read-only)

Inventory:
- **Agents:** 34 files under `.opencode/agent/**`, all in category subdirectories except `eval-runner.md`. All 34 carry `name:`, 33 `temperature:` and 24 `permission:`. `eval-runner.md` also has `id`, `category`, `type`, `version` and `author`.
- **Plugins:** `.opencode/plugin/agent-validator.ts` and `notify.ts`, and `.opencode/plugins/coder-verification/index.ts`. All use the V1 `Plugin` type from `@opencode-ai/plugin`.
- **Tools:** `.opencode/tool/{index.ts, env/, gemini/, template/}`, which use V1 `tool()`.
- **Package pins:** `.opencode/package.json` pins `@opencode-ai/plugin 1.18.25`; `.opencode/plugin/package.json` uses `latest`; `evals/framework/package.json` pins `@opencode-ai/sdk 1.0.90`.
- **Config:** `.opencode/opencode.json` contains only `$schema`.
- **Delegation strings:** 74 `subagent_type="PascalName"` references across agents, commands and skills (e.g. 26× `ContextScout`).

| # | OpenCode v2 change | OAC files affected | Symptom under v2 | Suggested fix | Effort |
|---|---|---|---|---|---|
| 1 | **Agent ID/name = path; frontmatter `name:` ignored** (1.2) | All 34 `.opencode/agent/**/*.md`; `packages/compatibility-layer/src/adapters/OpenCodeAdapter.ts` L38-43 (its header says emitting `name:` is "REQUIRED to preserve identity", which is true only for V1); `CapabilityMatrix.ts` L130-137 (category as directory) | Tab cycle shows `content/copywriter`, `core/openagent`, `meta/system-builder`, `data/data-analyst`… (= #362) | Pick IDs deliberately. Emit a **flat** `.opencode/agents/<id>.md`, where the filename is the identity. Keep category in `oac:` metadata. In the adapter, either treat `name:` as V1-only or derive the filename from it. | M |
| 2 | **Agent list order = insertion/path order, not name-sorted** (1.2) | Profile installer output layout (`.opencode/profiles/*/profile.json`; `packages/cli/src/commands/{apply,add}.ts`) | Wrong Shift+Tab order (= #362) | Set `default_agent`. Use filenames whose sorted order is the order you want, or mark helper primaries `hidden: true` / `mode: subagent`. **UNVERIFIED:** no V2 ordering config key was found. | S |
| 3 | **Subagent resolution = exact path ID; param `agent`, not `subagent_type`** (1.4) | 74 `subagent_type="ContextScout"` etc. in `.opencode/agent/**`, `.opencode/command/**`, `.opencode/skill(s)/**`; also refs to `DocWriter`, `CodeReviewer`, `PatternAnalyst` | Delegation fails with `Unknown agent: ContextScout`. The real ID is `subagents/core/contextscout`. Models may recover from the catalog, but prompts point them at the wrong value. | Fix together with #1: once IDs are flat (`contextscout`), regenerate the prompt references from the canonical ID, not the display name. Run a lint check that every reference resolves. | M |
| 4 | **`subagent` (ex-`task`) permission resource = agent ID** (1.3) | `permission.task` blocks, e.g. `build-agent.md` (`contextscout: allow, "*": deny`), `coder-agent.md` (`contextscout`, `externalscout`, `TestEngineer`) | The allow never matches `subagents/core/contextscout`; with a trailing `"*": deny` the whole `subagent` tool is **hidden**. Note: `TestEngineer` vs `contextscout` casing was already inconsistent under V1 (case-sensitive match), which is a pre-existing bug. | Use the final IDs from #1. Put the catch-all first. Add a build-time check that each `task:`/`subagent` key names an emitted agent ID. | S |
| 5 | **Trailing `"*": "deny"` hides the tool** (#349; same in V1 and V2) | `subagents/code/build-agent.md` (bash, task), `test-engineer.md`, `core/task-manager.md`, `core/context-manager.md`, `core/documentation.md`, `system-builder/context-organizer.md`, `system-builder/workflow-designer.md` (per #349 / PR #354) | Agents silently cannot run shell or subagents | Merge or recreate PR #354 (catch-all first). Make `OpenCodeAdapter` or a lint step **fail** when the last rule for an action is `* deny` while earlier allows exist. | S |
| 6 | **V1 plugin API does not run** (1.5) | `.opencode/plugin/agent-validator.ts` (hooks `event`, `chat.message`, `tool.execute.before/after`, a `tool` map with 8 tools, `client.session.messages`); `.opencode/plugin/notify.ts` (`event`, `$`); `.opencode/plugins/coder-verification/index.ts` (`tool.execute.*`, plus a bogus `"session.idle"` hook key that is not a V1 hook either); `.opencode/package.json` and `.opencode/plugin/package.json` pins; `packages/plugin-abilities` on `main` (#367) | Validator, notify and coder-verification do nothing; their custom tools disappear | Port each to `Plugin.define({id, setup(ctx)})` with `ctx.tool.hook("execute.before"/"execute.after")`, `ctx.event.subscribe()`, `ctx.tool.transform(editor.add(...))` and `ctx.session` calls. Or ship the dual `{...Plugin.define(), server()}` export for a transition (V1 ≥ 1.18.29). Depend on `@opencode/plugin@^2`. | L (agent-validator ~1000 LOC); S each for the other two |
| 7 | **`.opencode/tool/*.ts` custom tools not discovered** (1.4) | `.opencode/tool/index.ts`, `env/`, `gemini/` (uses `tool()` and `@opencode-ai/plugin ^0.10.0`), `template/` | Gemini and env tools vanish under v2 | Re-register them through a v2 plugin's `ctx.tool.transform` (JSON-Schema `input`, return `{content}`). | M |
| 8 | **Agent `temperature` (→ `request.body`) is not sent** (1.2) | 33 agents with `temperature:`; `OpenCodeAdapter.ts` L464-466; `CapabilityMatrix.ts` L266-278 (marks `temperatureControl` "full" for opencode) | Agents run at the provider default temperature; no error | Mark temperature "degraded" for OpenCode v2 in `CapabilityMatrix`. If it matters, set it on provider, model or variant config (the docs' recommendation), or wait for upstream. | S |
| 9 | **Unknown frontmatter keys → `request.body`** (1.2) | `agent/eval-runner.md` (`id`, `category`, `type`, `version`, `author`) | Harmless today because `request.body` is not sent, but these keys would become raw HTTP body fields when upstream starts sending it | Strip non-OpenCode keys in the adapter (it already strips `oac:`). | S |
| 10 | **Eval harness: V1 SDK and server API removed** (1.7) | `evals/framework/package.json` (`@opencode-ai/sdk 1.0.90`); `src/sdk/server-manager.ts` (`createOpencode`; regex `/opencode server listening on (http:\/\/[^\s]+)/` at L164/L187); `src/sdk/client-manager.ts` (`session.create({body:{title}})`, `session.prompt({path,body:{parts,agent,model,noReply},query:{directory}})` expecting `{info,parts}`, `session.messages`, `session.abort`, `session.command({body:{command}})`, `postSessionIdPermissionsPermissionId({body:{response}})`); `src/sdk/event-stream-handler.ts` (`event.subscribe()` with `.properties`, `'permission.request'`, `'tool_use'` parts); `scripts/test/*.ts`, `scripts/debug/debug-session.ts` | Server start times out (regex no longer matches). Then every call fails: 401 (password), 404 (no `/session` routes), or schema mismatch. Prompt returns an inbox receipt, not the reply. Permission auto-approve never fires (`permission.asked` replaces `permission.request`). | Write an adapter layer: (a) spawn `opencode serve --port N` with `OPENCODE_SERVER_PASSWORD` set and match `server listening on`; or better, use in-process `@opencode/sdk` `OpenCode.create()` (no port, no password); (b) move the agent to `session.create({agent, location:{directory}})`; (c) `session.prompt({sessionID, text})` and then await `session.idle` / `session.execution.succeeded` or `experimental.session.wait`; (d) list messages via `session.message.list`; (e) reply with `session.permission.reply({decision})`; (f) remap event names and payloads. Keep the V1 path behind a flag while v1.19 is still supported. | L |
| 11 | **Eval agent IDs** (1.2/1.4) | `evals/agents/**` YAML uses `agent: openagent` (135×), `core/openagent`, `subagents/core/contextscout`… | `openagent` will not resolve in V2 (the ID is `core/openagent`) unless #1 flattens IDs. **UNVERIFIED:** how `test-executor.ts` maps these strings today. | Normalize after #1; assert IDs against `GET /api/agent` (`agent.list`) at suite start. | S |
| 12 | **Permission action renames** (`bash`→`shell`, `task`→`subagent`, `write`/`patch`→`edit`) (1.3) | All `permission:` blocks; `packages/compatibility-layer/src/mappers/ToolMapper.ts` L69-78, L224 (`validTools` = `bash`, `task`, `patch`…); `PermissionMapper.ts` | Legacy keys are auto-normalized (`normalizeAction`), so **no break** while files stay in V1 shape. A native V2 emitter would need the new names. | Keep the V1 shape for now. If you add a "native v2" emission mode, map names and emit `permissions:` arrays. | S (keep) / M (native) |
| 13 | **`external_directory` now allow-by-default** (1.3) | All agents; OAC's safety posture (`openagent.md` relies on ask/deny lists) | Agents can read and edit outside the project without prompting | Add `external_directory: "ask"` (V1 shape; it migrates) to agents where it matters, or ship it in the profile `opencode.json`. | S |
| 14 | **No CLAUDE.md fallback; AGENTS.md only** (1.6) | Install docs and any OAC setup that relied on CLAUDE.md for OpenCode | Instructions are not loaded | Ensure the installer writes or links `AGENTS.md`. | S |
| 15 | **Built-in tools removed** (`todowrite`, `lsp`, `list`) (1.4) | Grep agent prompts for `todowrite`, `lsp` or `list` instructions. **UNVERIFIED:** OAC prompt usage not fully audited. | Models told to use those tools get "No tool named…" | Remove the references, or gate them per target version. | S |
| 16 | **Duplicate skill dirs** (`.opencode/skill/task-management` and `.opencode/skills/task-management`) (1.6) | `.opencode/skill/`, `.opencode/skills/` | Possible ID collision; v2 scans both. **UNVERIFIED:** which copy wins. | Consolidate into `.opencode/skills/`. | S |
| 17 | **Code Mode / `execute`** (#353) (1.8) | None required | MCP tools are reached through `execute` by default; restricted subagents still get `execute` via the base allow | Optional: deny `execute` for tightly scoped subagents; document Code Mode. | S |
| 18 | **No declared OpenCode version support** | `COMPATIBILITY.md` (no OpenCode rows); the plugin and SDK package pins | Users discover breakage at runtime (#367) | Add an OAC ↔ OpenCode matrix (v1.18.29+ / v2.0.x). Have `oac doctor` (`packages/cli/src/lib/doctor-checks.ts`) detect `opencode --version` and warn. | S |

### Not affected (verified)

- **Agent markdown is still loaded.** The legacy frontmatter keys `mode`, `description`, `permission` (object form, order preserved) and `temperature` all decode, so no file is rejected for its keys (`v1/config/agent.ts`; `config/plugin/agent.ts` L187-200). Caveat: a decode failure drops the agent silently.
- **`.opencode/opencode.json`** contains only `$schema: https://opencode.ai/config.json`, which is still valid.
- **Commands** in `.opencode/command/**` are still discovered.
- **Skills** (`SKILL.md`) are still discovered.
- **The `question` permission** still works.

### Suggested order of work

1. **Quick wins:** #5 (merge PR #354), #4, #13, #18.
2. **Agent identity** (#1, #2, #3, #11). One change fixes #362 and the delegation breakage: decide flat IDs, then update `OpenCodeAdapter` and regenerate.
3. **Eval harness on the v2 client or SDK** (#10), behind a version switch.
4. **Plugins and tools ported to `@opencode/plugin`** (#6, #7; #367).
5. **Capability matrix corrections** (#8, #9, #12 native mode).
