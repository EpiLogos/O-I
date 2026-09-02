# Omarchy host integration contract

Status: deterministic pre-physical implementation for O:I #159 / #158 / #97.

## Source authority

The implementation was received from current upstream rather than remembered Omarchy behaviour.

- canonical repository: `https://github.com/omacom/omarchy`
- current stable release at implementation: `v4.0.2`
- inspected `quattro` contract revision: `d3d23fdddef846ebb98b52122a6ece66211c0daf`

At that revision Omarchy runs one long-lived Quickshell host. Third-party plugins are user-config checkouts/directories under `~/.config/omarchy/plugins/<id>/`; `~/.config/omarchy/shell.json` remains Omarchy-owned authoritative customization state. Plugin manifests can declare several kinds. The shell loads service kinds independently, registers bar widgets independently, and gives on-demand loader precedence `panel -> overlay -> menu` when one plugin id declares more than one presentation kind. `keepLoaded` services survive plugin hot reload and receive the refreshed manifest; their code itself changes only after a shell restart.

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
omarchy plugin enable org.epilogos.oi --yes
omarchy plugin enable org.epilogos.oi.switcher --yes
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
