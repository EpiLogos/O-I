# A3 E2E transcript — skill discovery + enable/disable contract

Date: 2026-10-07. CLI: `node /Applications/ZCode.app/Contents/Resources/glm/zcode.cjs` (zcode 0.16.9).
All invocations local and non-model. The only mutation was one reversible edit to
`~/.zcode/cli/config.json` (backed up and restored byte-identically, below).

## 1. CLI existence

```
$ node .../glm/zcode.cjs --version
0.16.9
$ node .../glm/zcode.cjs --help      # shows: skills (list only), plugins (list|install|uninstall|enable|disable|update|validate|marketplace), commands list, doctor
$ node .../glm/zcode.cjs doctor --json
{"cli":{"name":"zcode","processName":"zcode-cli","version":"0.16.9"},
 "runtime":{"arch":"arm64","cwd":"/private/tmp/zcode-re","node":"v24.21.0","platform":"darwin","sea":false},
 "packaging":{"default":"node-bundle","sea":"optional"}}
```

Note: there is NO `skills enable/disable` subcommand — per-skill disable is a
config-file mechanism (see step 4). Plugin enable/disable exists as a CLI command
(`plugins enable|disable <id>`) but was NOT exercised: every installed plugin is
in-use; the study gate forbids disabling them.

## 2. Scratch workspace + probe skill

Created `/tmp/zcode-re/a3-ws/.agents/skills/scratch-re-probe/SKILL.md`:

```markdown
---
name: scratch-re-probe
description: A3 reverse-engineering probe skill used to verify local skill discovery in a scratch workspace.
---

# Scratch RE Probe

This skill exists only to verify ZCode skill discovery. It does nothing.
```

## 3. Discovery verification (before any mutation)

```
$ zcode --cwd /tmp/zcode-re/a3-ws skills list --json     # -> skills-list-probe.json
total: 102   diagnostics: []
probe: {"name":"scratch-re-probe",
        "path":"/tmp/zcode-re/a3-ws/.agents/skills/scratch-re-probe/SKILL.md",
        "directory":"/tmp/zcode-re/a3-ws/.agents/skills/scratch-re-probe",
        "rootPath":"/tmp/zcode-re/a3-ws/.agents/skills",
        "scope":"project","source":"agents"}
breakdown: user:agents=76  user:plugin=10  system:plugin=14  system:bundled=1  project:agents=1
```

Plugin-sourced skills carry qualified names: `github:pr`, `browser-use:control-browser`,
`zcode-guide:diagnosing-skills` (scope `user` for the installed github plugin,
`system` for default-enabled builtin plugins).

Custom command probe: created `/tmp/zcode-re/a3-ws/.agents/commands/a3-probe-cmd.md`
(frontmatter `description`, `argument-hint`) → `commands list --json` discovered it
as `{name:"a3-probe-cmd", scope:"project", source:"agents", frontmatterKeys:[description, argument-hint]}`.

Name-collision observation: run with `--cwd /Users/admin/Central` (read-only),
`central-session-strap` appears TWICE — once per root —
`/Users/admin/.agents/skills/central-session-strap/SKILL.md` (scope user) and
`/Users/admin/Central/.agents/skills/central-session-strap/SKILL.md` (scope project).
Listing does not dedupe by name; both are visible (matches the harness system-reminder
which also lists both, user copy first).

## 4. Per-skill disable toggle (the study-gate-authorized reversible change)

Mechanism under test: `~/.zcode/cli/config.json` → `skills` map keyed by skill
SKILL.md path, value `{"enable": false}` (decoded from `collectDisabledPaths` in
zcode.cjs and `readSkillEnabledMapFromConfig`/`writeSkillEnabledMap` in the host).

```
$ cp ~/.zcode/cli/config.json e2e/config.json.backup
$ shasum -a 256 ~/.zcode/cli/config.json e2e/config.json.backup
12b0994c4849ab31a56922da7c182d2a0835a6625be5de883e9ad45496f92015  .../config.json
12b0994c4849ab31a56922da7c182d2a0835a6625be5de883e9ad45496f92015  .../config.json.backup
   (recorded in config.shasum-before.txt)
```

Applied edit (only this entry added; full resulting file snapshotted in
`config.json.modified-state.txt`):

```json
"skills": {
  "/tmp/zcode-re/a3-ws/.agents/skills/scratch-re-probe/SKILL.md": { "enable": false }
}
```

Effect:

```
$ zcode --cwd /tmp/zcode-re/a3-ws skills list --json     # -> skills-list-disabled.json
total: 101 (was 102)
probe present after disable: NO (disabled as expected)
diagnostics: []
```

The disabled skill is excluded from listing/invocation entirely (the CLI filters it
in `discoverSkills` via `isDisabledSkillPath` before it reaches the list).

## 5. Restore + verification

```
$ cp e2e/config.json.backup ~/.zcode/cli/config.json
$ shasum -a 256 ~/.zcode/cli/config.json e2e/config.json.backup
12b0994c4849ab31a56922da7c182d2a0835a6625be5de883e9ad45496f92015  .../config.json
12b0994c4849ab31a56922da7c182d2a0835a6625be5de883e9ad45496f92015  .../config.json.backup
   (recorded in config.shasum-after.txt)
$ diff e2e/config.json.backup ~/.zcode/cli/config.json   -> RESTORE BYTE-IDENTICAL
$ zcode --cwd /tmp/zcode-re/a3-ws skills list --json
after restore — total: 102 | probe present: true
```

## 6. Read-only listing artifacts

- `skills-list-probe.json` — `skills list` in the scratch workspace (baseline)
- `skills-list-disabled.json` — same, while the probe was disabled
- `skills-list-central.json` — `skills list` under `/Users/admin/Central` (collision evidence)
- `plugins-list.json` — `plugins list --json` (15 plugins, enabled states)

## 7. Gates and limitations

- Desktop app was RUNNING during the toggle. The window between backup and restore
  was seconds; post-restore shasum proves restoration. Residual risk: if the owner's
  desktop app rewrites config.json later it writes its own current in-memory state,
  which predates and excludes this edit — no contamination path.
- No in-use plugin was disabled; the `plugins enable|disable` CLI path is documented
  from help text + code, not exercised end-to-end (blocked by the study gate).
- No model prompts were run.
