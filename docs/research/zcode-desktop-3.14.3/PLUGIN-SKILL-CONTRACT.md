# ZCode v3.14.3 — Plugin & Skill System: Visible Contract

> Study deliverable of the ZCode desktop RE study (October 2026). Generated
> output of an agent study — reference until adopted by the owner. Document-only;
> code excerpts quoted as evidence with locations. Per-claim evidence:
> `evidence/A3-EVIDENCE.md`; live enable/disable test: `evidence/e2e/`.

# ZCode v3.14.3 — Plugin & Skill System: Visible Contract (draft, lane A3)

Clean-room documentation of the VISIBLE CONTRACT of ZCode's plugin/skill system,
written from local evidence: shipped config files, the plugin store's on-disk
records, the installed `github` plugin's layout, the desktop host bundle
(`/tmp/zcode-re/asar/out/host/`), and the agent CLI
(`/Applications/ZCode.app/Contents/Resources/glm/zcode.cjs`, zcode CLI 0.16.9).
Code excerpts are quoted only as evidence (a few lines each, with locations).
Everything else is original description. Document-only deliverable.

Companion: `EVIDENCE.md` (per-claim confidence), `e2e/TRANSCRIPT.md` (live test).

---

## 1. The two loaders

ZCode ships TWO skill/plugin loaders that read overlapping ground:

| | Desktop host loader | Agent CLI loader |
|---|---|---|
| Code | `app.asar` → `out/host/index.js` (+ `host/chunk-B7L5SK4K.js` schema chunk) | `Resources/glm/zcode.cjs` (single 14 MB bundle, SEA-optional) |
| Serves | the desktop UI: skill store listing, enable/disable writes, prompt-context skill activation | the agent runtime: discovery, the Skill tool, slash commands, permissioning |
| Skill id | `glm:<scope>:<name>:<12-hex sha256 of path>` | filesystem path (canonical); plugin skills add `qualifiedName` = `"<plugin>:<name>"` |

The config file both converge on is `~/.zcode/cli/config.json` (host constant
`zK=join(homedir, ".zcode","cli")`, `WK=join(zK,"config.json")`; CLI default config
shows the same keys). This is the file that holds `hooks`, `mcp.servers`,
`plugins.enabledPlugins`, and the per-skill `skills` disable map.

---

## 2. Skill discovery

### 2.1 Roots

All roots follow the same shape: `<base>/{.zcode|.agents}/skills`, recursively
scanned for `SKILL.md` (a skill is a directory containing `SKILL.md`; one level
of `<root>/<name>/SKILL.md` plus a direct `<root>/SKILL.md` are collected).

- **Workspace (project) roots**: starting at the workspace directory, the loader
  walks UP to the enclosing git worktree root (first ancestor containing `.git`)
  or filesystem root. EVERY directory on that chain contributes two roots:
  `<dir>/.zcode/skills` then `<dir>/.agents/skills` (deepest dir first).
  Function `resolveAncestorWorkspaceRoots` (host) / `resolveProjectSkillDirectories` (CLI).
- **User roots**: `~/.zcode/skills` and `~/.agents/skills`. Host-side these are
  gated by a runtime capability: `resolveCapabilities` returns
  `{userScopeAvailable:false, userScopeReason:"desktop_only"}` outside the
  desktop runtime (checked via `ZCODE_PROCESS_LABEL` env / `isDesktopRuntime`).
- **Plugin roots**: each enabled plugin contributes its declared skill
  directories (see section 3.3).
- **Bundled skills**: `Resources/glm/packages/bundled-skills/skills/` is resolved
  by the CLI (`resolveBundledSkillRoots`, marker `.zcode-bundled-skills-seed.json`,
  internal id prefix `zcode-bundled-skills/`) and injected as extra resolved roots.
  On this install it carries exactly one skill: `dynamic-workflows`.
- **Extra configured roots**: CLI config `skills.roots` (paths; `~/` allowed),
  passed as `extraRoots` with the highest precedence (lowest priority number).

### 2.2 Discovery order (precedence)

The CLI assigns each root an integer priority from a counter that starts at 10
and increases by 10 (`resolveDefaultSkillRoots`); discovery sorts by priority
ascending and dedupes by canonical skill-file path, first root wins:

| Priority | Root | Scope tag |
|---|---|---|
| 10 | `config.skills.roots` entries (extra roots, `~/`-expanded, workspace-relative resolved) | project |
| 20 | `~/.zcode/skills` | user, source `zcode` |
| 30 | `~/.agents/skills` | user, source `agents` |
| 40… | workspace chain, deepest directory first; per directory `.zcode/skills` before `.agents/skills` | project |

Plugin roots and bundled roots are appended as extra resolved roots after these.

The desktop host orders roots slightly differently: workspace chain first
(deepest-first, `.zcode` before `.agents` per level), then user roots
(`~/.zcode/skills`, `~/.agents/skills`), then plugin roots — then dedupes by
realpath, first wins. Both loaders therefore agree that, at the SAME directory,
`.zcode/skills` outranks `.agents/skills`, and the desktop host additionally
hard-shadows `~/.agents/skills` by `~/.zcode/skills` (a user-agents skill is
skipped when `~/.zcode/skills/<same-dirname>/SKILL.md` exists OR its name key —
lowercased frontmatter name or dirname — is already taken by a `~/.zcode/skills`
skill; `isUserAgentsSkillCoveredByZcode`).

### 2.3 Name collisions (user vs workspace vs bundled vs plugin)

Empirically verified (e2e): `central-session-strap` exists in both
`~/.agents/skills/` and `/Users/admin/Central/.agents/skills/`; `skills list`
shows BOTH entries, distinguished by `scope: "user"` vs `scope: "project"`.
Listing does not dedupe by name. Invocation by bare name (`Skill` tool /
`loadSkill`) takes the first match in the name-sorted list, which preserves
priority order — the user copy wins the bare name; the project copy remains
addressable by its qualified/directory identity. Plugin skills are namespaced:
`qualifiedName = "<pluginName>:<skillName>"` while also loadable by bare name
(harness reminder renders `github:pr (also loadable as pr)`). Bundle skills
carry source `bundled`, scope `system`.

Observed CLI listing tags: `scope` ∈ `user | project | system`,
`source` ∈ `zcode | agents | plugin | bundled`.

### 2.4 What makes a skill discoverable — SKILL.md contract

Frontmatter (YAML between `---` fences) fields:

| Field | Required | Contract |
|---|---|---|
| `name` | yes when frontmatter present | string; falls back to skill directory name only when there is NO frontmatter block at all |
| `description` | yes when frontmatter present | ≤ 1024 chars (`p3s=1024` / host `TK=1024`); over-limit is a `skill_description_too_long` error diagnostic |
| `when_to_use` | no | appended to description in the model-facing listing ("description - whenToUse") |
| `license`, `metadata` | no | count toward `safeToAutoLoad` (below) |

Diagnostics emitted by discovery: `skill_scan_failed` (warning),
`skill_read_failed` (warning), `skill_missing_name` (error),
`skill_missing_description` (error), `skill_description_too_long` (error).

A skill whose frontmatter uses ONLY the keys
`{name, description, when_to_use, license, metadata}` is `safeToAutoLoad: true`
(i.e. may be activated implicitly by prompt mention). Unknown extra keys make it
explicit-invocation-only. Policy flag on every skill:
`policy.allowImplicitInvocation: true`.

Prompt-based activation (host): `$skill-name` tokens in the user prompt select
enabled skills by name; their bodies are injected wrapped as
`<available_skills><activated_skill name="…" path="…">…</activated_skill>…`
and an audit line `{createdAt, workspacePath, workspaceIdentity, activatedSkillNames}`
is appended to `~/.zcode/v2/skills-audit.log`.

Model-facing listing (CLI): a context block named "Skills", header
"The following skills are available for use with the Skill tool:", one line per
skill `- <qualifiedName>: <description-truncated-to-250> (file: <path>)` plus
`(also loadable as <name>)` when qualified; full form includes frontmatter-derived
text; total budget 20000 chars (`skills.metadataBudget`), overflowing falls back
to a compact `- name (file: path)` list.

Skill body read cap: 100000 bytes (`m3s=1e5`), truncated above that.

---

## 3. Plugin system

### 3.1 Manifest

Manifest search order inside a plugin root (first hit wins):

1. `.zcode-plugin/plugin.json`
2. `.claude-plugin/plugin.json`
3. `.codex-plugin/plugin.json`
4. `.cursor-plugin/plugin.json` (CLI only)

Observed manifest (github 0.1.2, `.zcode-plugin/plugin.json`, byte-identical
copy under `.claude-plugin/`): fields `name`, `version`, `description`,
`description_i18n {en, zh-CN}`, `author {name, url}`, `keywords[]`.
Grammar: `name` must match `^[a-z0-9][a-z0-9._-]{0,127}$`.
Optional `skills` field: string or string[] of paths (relative, traversal-guarded,
must stay inside the plugin root); when absent and a `skills/` directory exists,
it is used by default. Reserved/recognized-but-unsupported keys
(`channels`, `lspServers`, `outputStyles`, `settings`) produce a warning diagnostic.

### 3.2 Plugin layout

Canonical directory members (from the shipped plugin packages and the remote
deploy manifest): `.mcp.json`, `.zcode-plugin/`, `README.md`, `agents/`,
`commands/`, `dist/`, `docs/`, `hooks/`, `output-styles/`, `package.json`,
`scripts/`, `skills/`, `templates/`.

- `skills/<name>/SKILL.md` — plugin skills (see section 2).
- `commands/*.md` — slash commands. Frontmatter keys observed in code:
  `allowed-tools`, `argument-hint`, `description`, `disable-noninteractive`,
  `model`, `skills`; name from filename, regex
  `^[a-z0-9][a-z0-9_:-]{0,63}$`; body may use `$ARGUMENTS`.
  Verified live: a probe `.agents/commands/a3-probe-cmd.md` was discovered by
  `commands list` with `frontmatterKeys: [description, argument-hint]`.
  Custom command roots mirror skill roots: `.agents/commands` (and `.zcode/commands`).
- `agents/*.md` — subagent definitions. Frontmatter observed in shipped plugins:
  `name`, `description`, `color`, `model`, `thoughtLevel`, `tools` (array), and
  in code also `permissionMode`, `maxTurns`, `memory`, `disallowedTools`.
  `permissionMode` from a PROJECT-scope agent is deliberately dropped
  (`e.source==="project" ? void 0 : f`) — only user-scope agents may set it.
- `hooks/hooks.json` — plugin-declared hooks, same event grammar as user hooks
  (section 5.4); merged with a plugin context (`sourceKind: "plugin"`).
- `.mcp.json` — plugin MCP servers: `{"mcpServers": {"<name>": {type, url|command…,
  auth, timeoutMs}}}`; supports `${ZCODE_BASE_URL}` interpolation and
  `auth: {type: "zcode_official", provider: "jwt_token"}` for official hosted
  servers (observed in `image-search/0.1.1/.mcp.json`).

### 3.3 Plugin candidate sources and enable resolution

`NodePluginAdapter.discoverPluginsSync` assembles candidates in this order
(duplicate id `name@marketplace` → first wins, later ones get a
`plugin_duplicate_id` warning):

| Order | Source | Marketplace tag | Default enabled |
|---|---|---|---|
| 1 | `config.plugins.dirs[]` (dev dirs, `~/`-expanded) | `inline` | **true** |
| 2 | Bundled app packages (`Resources/glm/packages/*-plugin`) | `zcode-plugins-official` | false |
| 3 | Official cache scan `~/.zcode/cli/plugins/cache/zcode-plugins-official/<name>/<version>/` | `zcode-plugins-official` | false |
| 4 | `installed_plugins.json` records (installPath) | record's `marketplace` | false |

Per plugin: `enabled = config.plugins.enabledPlugins["<name>@<marketplace>"] ?? (defaultEnabled || builtinDefault.has(id))`
where `builtinDefault` is a hardcoded set of ten official plugin ids:
browser-use, image-search, documents, pdf, presentations, spreadsheets,
node-repl-host, skill-creator, plugin-creator, zcode-guide (all
`@zcode-plugins-official`). `config.plugins.suppressedBuiltins[]` removes
official-marketplace candidates entirely. `config.plugins.enabled: false`
disables the whole plugin subsystem. A disabled plugin contributes NOTHING
(no skills, commands, agents, hooks, MCP). `config.plugins.options[id]` carries
per-plugin option objects passed to enabled components.

Observed state on this machine (`plugins list --json`, 15 plugins): the ten
builtins enabled; `github@zcode-plugins-official` enabled via the explicit
`enabledPlugins` entry in config.json; `computer-use`, `android-emulator`,
`ios-simulator`, `restore-legacy-sessions` disabled (not in the default set,
not in `enabledPlugins`).

---

## 4. Enable / disable

### 4.1 Plugins — `plugins.enabledPlugins`

- Location: `~/.zcode/cli/config.json` → `plugins.enabledPlugins`, a map of
  **`"<name>@<marketplace>"` → boolean** (observed:
  `"github@zcode-plugins-official": true`).
- Scope: user config. The key grammar is `name@marketplace`; ids without a
  well-formed `@` are reported as `source: "missing"` rows by the plugin lister.
- Effect: `true` forces enable; `false` forces disable; absent = default rule
  (section 3.3). Takes precedence over every default.
- Writers: the desktop plugin UI, the TUI `/plugins enable|disable <id>` command
  ("persist the switch in user config"), and the CLI `zcode plugins enable|disable <id>`.
  Plugin capability changes apply to NEW sessions.

### 4.2 Skills — `skills` map (verified live, e2e)

- Location: `~/.zcode/cli/config.json` → top-level `skills` object:
  `{"<path/to/SKILL.md>": {"enable": false}}`.
- The key is the skill's SKILL.md PATH (normalized to forward slashes; the CLI
  also matches realpath), not the skill name.
- Convention: disabled skills are recorded with `enable: false`; enabling deletes
  the entry (host `writeSkillEnabledMap` deletes on `true`). Absent = enabled.
- Effect: the skill is filtered out BEFORE listing and invocation
  (CLI `discoverSkills` checks `isDisabledSkillPath`; host `attachEnabledState`
  computes `enabled: map[path] ?? true`, and activation filters on `enabled`).
- Related switches in the same config surface: CLI default config has
  `skills: {enabled: true, includeInstructions: true, metadataBudget: 20000, roots: []}`
  (global kill-switch + budget) and `features.skill` (feature flag);
  `commandOverrides` is the analogous per-command map.
- Writers: desktop skill store UI (host `setEnabled`); NO CLI subcommand exists
  (`zcode skills` only lists).

E2E verdict: disabling the scratch probe via this map removed it from
`skills list` (102 → 101); restoring the backup byte-identically (sha256 match)
brought it back. Full transcript in `e2e/TRANSCRIPT.md`.

---

## 5. Permissioning

### 5.1 Permission modes

Canonical session modes (Zod enum in both host and CLI): **`plan`, `build`,
`edit`, `yolo`, `auto`**. `auto` is reserved and currently DENIES side-effectful
tools ("Auto mode is reserved but not implemented yet"). Accepted persisted mode
strings and aliases (normalized by `toZCodeMode`):

| Raw ids | Canonical |
|---|---|
| `plan`, `read-only`, `read_only` | plan |
| `build`, `default`, `acceptEdits`, `autoEdit`, `accept-edits`, `accept_edits` | build |
| `edit` | edit |
| `yolo`, `bypassPermissions`, `dontAsk`, `full-auto`, `full_auto` | yolo |
| `auto` | auto |
| `agent` | `default` (codex provider only) |
| `agent-full-access`, `full-access` | `bypassPermissions` |

Surface: `/mode [plan|build|edit|yolo]` slash command; `--mode <mode>` CLI flag
(headless prompt default: yolo); automation/off-peak tasks accept
`permissionMode: build|edit|plan|yolo`. Headless default for `--prompt` is yolo.

### 5.2 The decision ladder (CLI `PermissionService.checkPermission`)

Every tool call resolves a capability from the tool's static contract
(`permission: {permission, reason, riskLevel, sideEffectScope, needsApproval,
patternSources, alwaysAllowPatternSources, denyPriority}`), then the ladder:

1. session-granted allow/deny ("always allow" from an earlier approval) →
   `rule.session.allow`;
2. tool requires user interaction → deny if in `disallowedTools`, else ask
   (`tool.userInteraction`);
3. tool `alwaysAsk` → deny(auto)/disallowed→deny/project-deny→deny, session-allow
   → allow, else ask (`tool.alwaysAsk`);
4. `yolo` (and not plan) → **allow** (`mode.yolo` — "bypasses permission prompts");
5. `auto` → deny (`mode.auto.unimplemented`);
6. `disallowedTools` → deny (`rule.disallowedTools`);
7. project rules `deny` → deny; rules `ask` → ask (`rule.project.*`);
8. **plan** mode: read-only non-destructive → allow (`mode.plan.readOnly`);
   non-destructive MCP tools → allow (`mode.plan.mcp`); explicit session-scope
   capabilities → allow; everything else → deny (`mode.plan.nonReadOnly`);
9. project rules `allow` → allow;
10. WebFetch to a preapproved documentation domain → allow;
11. config `allowedTools` → allow (`rule.allowedTools`);
12. **edit** mode: file-edit tools (`permission: "edit"`, scope `workspace`) →
    allow (`mode.edit.fileEdit`), else fall through;
13. **build** mode: read-only → allow; risk `critical` → ask; risk `high` → ask
    unless `autoApproveHighRisk`; low-risk session-scope → allow; anything with
    side effects → ask (`mode.build.sideEffect`); else allow.

Default config: `allowedTools: ∅, disallowedTools: ∅, autoApproveHighRisk: false`.
Per-run override: `--disallowed-tools "Bash Edit"` / `"Bash(git *)"` (whole-tool
removal; command patterns not matched), session-only.

Risk levels: `low | medium | high | critical`. Side-effect scopes observed:
`none, network, workspace, git, system, session, userInteraction`
(workspace-mutating = `{workspace, git, system}`).

### 5.3 Tool allow/deny rules

Rule shape: `{toolName, ruleContent?}`; grouped as `allow[] / deny[] / ask[]`.
Matching: `toolName` equality (a `Write` rule also matches `Edit`); special
toolName `zcode:permission-capability:official_cua` targets the official
Computer-Use capability group. `ruleContent` matches the call's "subject" —
string input, or first string among `command | url | file_path | path | pattern |
patch_text` (WebFetch uses `url`): `prefix:*` = prefix match, `*` = glob, else
exact. Rules can arrive at runtime from hook decisions:
`permissionUpdates: [{type: "addRules", behavior: "allow"|"deny"|"ask", rules: [...]}]`.

Where rules persist: the desktop host defines agent-config roots
`~/.agents/` and `~/.claude/` reading `settings.json`, and the zcode agent
reading `config.json` (project scope `<project>/.zcode/config.json`); no
allow/deny rule file was present on this machine to observe, so the on-disk rule
file grammar is documented here only from code shapes (open item).

### 5.4 Hooks as policy surface

Events: `SessionStart, UserPromptSubmit, PreToolUse, PermissionRequest,
PostToolUse, PostToolUseFailure, Stop`. Declaration (observed live in
`~/.zcode/cli/config.json`):

```json
"hooks": {"enabled": true, "events": {"PreToolUse": [
  {"matcher": "...optional...", "hooks": [{"type": "command", "command": "aikit hook dispatch zcode PreToolUse"}]}]}}
```

Hook entry types: `command` (shell command; `async`, `shell`, `timeout`/
`timeoutMs`, `enabled`, `statusMessage`) and `process` (argv form: `command`,
`args`, `timeoutMs`). Runtime caps: `hooks.timeoutMs` default 60000,
`hooks.maxOutputBytes` default 32768, `hooks.enabled` default **false** in the
CLI default config (this machine's config sets it true). Sources merge from user
config, project config (`<dir>/zcode.json` or `<dir>/.zcode/config.json`), and
enabled plugins (`sourceKind: user | project | plugin`).

A PreToolUse/PermissionRequest hook returns a decision envelope:
`{decision: "allow"|"deny"|"escalate"|"modify", reason?, modifiedInput?,
permissionUpdates?}` — `modify` rewrites tool input before execution;
`escalate` maps to a user prompt. This makes hooks a full policy surface.

### 5.5 MCP permission surface

- User MCP servers: `~/.zcode/cli/config.json` → `mcp.servers` (stdio: `command`,
  `args`, `env`; plus `type`, `protocolVersion`, `timeoutMs`). Observed env-based
  permission pattern: the `bimba` server receives
  `BIMBA_MCP_PERMISSIONS: "bimba:read,bimba:write,bimba:admin"` and
  `BIMBA_MCP_PRINCIPAL` — capability strings owned by that server, not enforced
  by ZCode.
- Plugin MCP: `.mcp.json` (section 3.2); official hosted servers authenticate via
  `auth: {type: "zcode_official", provider: "jwt_token"}`.
- Plan-mode carve-out: non-destructive MCP tools run in plan mode
  (`mode.plan.mcp`) — "MCP tool" is recognized by the tool contract's
  `permissionName === "mcp"`.
- MCP session commands: `/mcp [list|status|connect <server>|disconnect <server>]`.

---

## 6. Marketplace & install pipeline

### 6.1 Known marketplaces — `known_marketplaces.json`

```json
{"version": 1, "marketplaces": [{"id", "name", "description",
  "source": {"source": "url", "url"} | {"source": "github", "repo": "owner/repo"},
  "addedAt", "pluginCount", "lastUpdated", "cacheTransactionId"?}]}
```

Observed: `zcode-plugins-official` (url:
`https://cdn-zcode.z.ai/zcode/official-plugin/marketplace.json`, 24 plugins) and
`claude-plugins-official` (github: `anthropics/claude-plugins-official`, 291
plugins). Marketplace payloads are cached under
`~/.zcode/cli/plugins/marketplaces/<id>/marketplace.json` (the claude one is a
full clone incl. `.claude-plugin/marketplace.json` layout). Marketplace manifest
schema (official): `{name, version, description, description_i18n, owner,
plugins: [{name, version, description, description_i18n, author, icon, category,
keywords, source: {source:"url", type:"zip", url, sha256, path},
_artifact: {path, sha256, size}}]}`. Extra marketplaces can also be declared in
config (`plugins.extraKnownMarketplaces`).

### 6.2 Install record — `installed_plugins.json`

```json
{"version": 1, "plugins": [{"id": "github@zcode-plugins-official",
  "name", "marketplace", "version",
  "installPath": "~/.zcode/cli/plugins/cache/zcode-plugins-official/github/0.1.2",
  "installedAt", "updatedAt", "scope": "user",
  "source": {"source": "url", "type": "zip", "url": ".../plugin.zip",
             "sha256": "7320f1...", "path": "github"},
  "cacheTransactionId": "ebea1145-..."}]}
```

Contract: the zip is fetched, its sha256 verified against the marketplace
manifest's pinned digest, unpacked into the versioned cache path, and the record
pins provenance (url + sha256) and a `cacheTransactionId` (uuid) linking the
cache write. Plugin payload caches live under `plugins/cache/<marketplace>/<name>/<version>/`,
per-plugin mutable data under `plugins/data/<id>/`. Update checks compare
installed version/sha against the marketplace (`updateStatus`).
`icon-sources.json` maps plugin names to icon assets for the store UI.

### 6.3 CLI management surface

`zcode plugins list|install|uninstall|enable|disable|update|validate|marketplace`
(alias `plugin`), plus TUI `/plugins` panel (enabled = ✓, disabled = ○).
`plugins list --json` rows: `{id, name, marketplace, version, enabled, source:
official|cache|inline|missing, manifestPath, rootPath, dataPath, skillCount,
skillRootCount, commandRootCount, declaredMcpServerNames, mcpServerNames,
hookDetails, diagnostics, description}`.

---

## 7. Listing surfaces (how users/agents see skills & plugins)

- CLI: `zcode skills list [--json]` (read-only discovery), `zcode commands list`,
  `zcode plugins list`.
- TUI slash commands: `/skill [name] [task]` ("List skills, or force the next
  prompt to load one"), `/plugins` panel, `/commands`-equivalents, plus
  plugin-provided commands namespaced `/<plugin>:<command>` (e.g. `/github:pr`).
- Model: the "Skills" context block (section 2.4) + `Skill` tool whose schema
  reads `skill: "The name of a skill from the available-skills list. Do not guess
  names.", args?: string`; invocation loads the SKILL.md body into a
  `<skill_content name="…">` block with `baseDirectory` for relative reads.
- Desktop: skill store UI (renderer chunk `skillStore-*.js`) over the host
  discovery service; enable/disable writes the config.json maps of section 4.

## 8. Config file map

| File | Holds |
|---|---|
| `~/.zcode/cli/config.json` | `hooks`, `mcp.servers`, `plugins.{enabled, dirs, enabledPlugins, options, suppressedBuiltins, extraKnownMarketplaces, storage}`, `skills.<path>.enable` disable map, (CLI-side also `skillOverrides`, `commandOverrides`, `features`, `ui`, `logging`) |
| `~/.zcode/v2/setting.json` | desktop app preferences (window, locale, providers UI state) — NOT the skill/plugin surface |
| `~/.zcode/v2/provider_config.json`, `~/.zcode/v2/config.json` | model providers/models (out of A3 scope) |
| `~/.zcode/cli/plugins/installed_plugins.json` | install records (section 6.2) |
| `~/.zcode/cli/plugins/known_marketplaces.json` | marketplace registry (section 6.1) |
| `~/.zcode/cli/plugins/{cache,data,marketplaces,icon-sources.json}` | payloads, per-plugin data, marketplace clones, store icons |
| `~/.zcode/v2/skills-audit.log` | JSONL of prompt-activated skill names |

## 9. Open items

1. On-disk grammar of persisted allow/deny RULE files (`settings.json` under
   `~/.agents`/`~/.claude`, project `.zcode/config.json`): shapes decoded from
   code, no live file present to confirm.
2. `plugins enable|disable` CLI not exercised end-to-end (every installed plugin
   is in-use; gate forbids disabling them). Config-map mechanism proven instead
   for skills; the plugin path writes the same file.
3. Host-vs-CLI precedence differs in one respect (host: workspace before user;
   CLI priority counter: user before project). Bare-name invocation resolution
   observed once (user first); a deliberate cross-scope invocation test through a
   model session was out of scope (no model prompts).
4. `.cursor-plugin/plugin.json` appears only in the CLI's manifest-candidate list;
   not observed on disk anywhere on this machine.
