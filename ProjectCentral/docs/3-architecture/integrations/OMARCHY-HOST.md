# Omarchy host integration contract

Status: deterministic pre-physical implementation for O:I #159 / #158 / #97.

## Source authority

The implementation was received from current upstream rather than remembered Omarchy behaviour.

- canonical repository: `https://github.com/omacom/omarchy`
- current stable release at implementation: `v4.0.3`
- inspected contract revision: `0534987009061cbe2dacdde4ad564092ab698d12` (the `v4.0.3` release commit itself; one commit now carries both the release and the shell/plugin/IPC contract)

The v4.0.2 → v4.0.3 re-base was performed against the upstream tags, not from memory. What changed on the surfaces this contract covers:

- Plugin host context became capability-scoped (upstream PR #9618): a plugin no longer receives the raw host shell or bar object. It receives a `PluginShellApi` scoped to its own id (`summon`/`hide`/`toggle`/`isPluginOpen`), a `PluginBarApi` whose `run(command)` still detaches the given command, a deep-copied public manifest (user fields such as `id` preserved), and scoped read-only registry views. The O:I payloads call exactly `shell.toggle(id, json)`, `shell.hide(id)` and `bar.run(command)`, so the payload bytes are unchanged by this re-base.
- `keepLoaded` services survive plugin hot reload (upstream #9485) — the behaviour the previous pin inspected on the `quattro` development line at `d3d23fdd` — is contained in v4.0.3 itself. The old pin mixed the `v4.0.2` release tag with a development-line contract revision; v4.0.3 removes that split.
- The plugin manifest schema is unchanged at v4.0.3 (`schemaVersion` 1; required `id`/`name`/`version`/`kinds`/`entryPoints`; relative entry points; `barWidget.defaultSection` in `left|center|right`). Both O:I manifests validate unchanged.
- `omarchy plugin enable` is `<id> [placement]` with `--section|--index|--before|--after`; it has no confirmation prompt and no `--yes` flag (that flag belongs to `omarchy plugin add`). The native activation commands below were corrected accordingly during this re-base.

At this revision Omarchy runs one long-lived Quickshell host. Third-party plugins are user-config checkouts/directories under `~/.config/omarchy/plugins/<id>/`; `~/.config/omarchy/shell.json` remains Omarchy-owned authoritative customization state. Plugin manifests can declare several kinds. The shell loads service kinds independently, registers bar widgets independently, and gives on-demand loader precedence `panel -> overlay -> menu` when one plugin id declares more than one presentation kind. `keepLoaded` services survive plugin hot reload and receive the refreshed manifest; their code itself changes only after a shell restart.

That loader relation determines the O:I contribution shape:

```text
org.epilogos.oi
  service + bar-widget + panel

org.epilogos.oi.switcher
  menu
```

The split is not an O:I renderer ontology. It exists because a single id carrying both panel and menu would be addressed by Omarchy as the panel entry point.

## Ownership

O:I owns only the plugin payloads it ships. Omarchy owns shell configuration, plugin enablement, plugin discovery, IPC, hot reload and graphical-session lifecycle. AIKit #139 owns Hyprland/SessionSpace provider interpretation and presentation-local ids. Canonical World / Project / Agent / AgentSession / Surface / Action / Activity / Attention state remains in the products that already own it.

Therefore:

```text
managed O:I plugin bytes
  != shell.json
  != canonical O:I state
  != Hyprland binding identity
  != SessionSpace identity
```

The Quickshell service is a read client over `oi current-world --json`; it is not a session, Activity, Attention or notification store.

## Bootstrap relation

The current deterministic CLI surface is:

```text
oi host omarchy plan [--home PATH] [--json]
oi host omarchy realise --home PATH [--accept-managed-update] [--json]
oi host omarchy verify [--home PATH] [--json]
```

`plan` performs DISCOVER + PLAN over native files without mutation. `realise` writes only the two O:I-managed plugin directories and requires an explicit `--home`; this prevents an authorised Agent from silently treating the ambient user home as its mutation target. It never edits `shell.json` and does not fabricate host uptake. If an O:I-managed file has local drift, replacement is refused unless the caller explicitly supplies `--accept-managed-update` after review.

Native activation remains an Omarchy operation and is returned as an explicit next relation:

```text
omarchy plugin enable org.epilogos.oi
omarchy plugin enable org.epilogos.oi.switcher
omarchy-shell shell rescanPlugins
omarchy-shell shell listPlugins
```

The later physical acceptance pass must observe the actual host response. File presence is not activation evidence.

## Current contribution

The main plugin currently provides:

- a `keepLoaded` service reading the canonical O:I current-world projection;
- a restrained bar widget whose primary action summons the focused O:I panel and whose secondary action summons the switcher;
- a focused panel projecting the current-world reading without acquiring mutation authority.

The switcher is a separately addressable Omarchy menu entry point and currently opens the canonical current-World host surface. It is deliberately small in this deterministic tranche; richer World/Project/Journey/Agent/Surface/instrument entries must consume canonical application/Surface descriptors rather than become QML-owned routing state.

## Deterministic proof

Cloud proof covers what can truthfully be established before the Omarchy machine exists:

- both manifests validate against Omarchy's own `omarchy-plugin-validate` at the pinned upstream revision;
- O:I CLI tests prove source/revision disclosure;
- fake-HOME tests prove `shell.json` remains untouched;
- realise is idempotent;
- local drift in O:I-managed payloads requires explicit reviewed replacement;
- verify checks exact managed payload bytes while explicitly withholding claims about native enablement or Hyprland/SessionSpace uptake.

The physical #158/#97 return must still prove real Quickshell load, Omarchy enable/reload, Hyprland placement/scratchpad behaviour, AIKit #139 co-reference, Attention deep links, host restart/relogin reconciliation, Gateway reachability and human interaction quality.
