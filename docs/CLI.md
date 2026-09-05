# `oi` CLI — Disclosure and Composition Surface

`oi` is the command-line front door for a composed {O:I} installation. It is deliberately smaller than the products behind it.

Its current surface is:

```text
oi help
oi status [--json]
oi init [--personal-ground PATH]
oi register <module> [--executable PATH] [--root PATH] [--version TEXT]
oi install <module>
oi docs [topic|module]
oi migrate <path>

oi products [--json]

oi central ...          -> ctrl ...
oi actuation ...        -> actuation ...
oi aikit ...            -> aikit ...
oi factory ...          -> factory ...
oi workcell ...         -> workcell ...
oi ql ...               -> ql ...
```

## `oi products`

`oi products` discloses the six-product command field: executable, namespace, probe commands, revision and standing for every product. `oi products --json` emits the same facts as structured JSON.

## Product commands

All six native product centres now have accepted native commands composed into the `oi` namespace. Each is declared `"command_standing": "accepted-main"` in `surfaces.json` and validated at compile time.

| `oi` command | Native executable | Owner repository |
|---|---|---|
| `oi central` | `ctrl` | `EpiLogos/Central` |
| `oi actuation` | `actuation` | `EpiLogos/Actuation` |
| `oi aikit` | `aikit` | `EpiLogos/ai-kit` |
| `oi factory` | `factory` | `EpiLogos/agent-system-design` |
| `oi workcell` | `workcell` | `EpiLogos/Workcell` |
| `oi ql` | `ql` | `EpiLogos/QL-MEF` |

## Aliases

Three compatibility aliases are assigned, each backed by a verified native CLI:

```text
ctrl      -> ctrl       # Central
kit       -> aikit      # AIKit
workcell  -> workcell   # Workcell
```

These are the only aliases. `oi ctrl ...` and `oi central ...` both resolve to the same Central product command. Actuation, Software Factory and Quaternal Logic have no separate aliases.

## `oi status`

Status compares the surface descriptors with local composition and executable discovery. It distinguishes installed, registered, missing, and broken surfaces and reports the configured personal ground. `oi status --json` exposes the same composition facts for agents and scripts.

The composition file contains discovery and handoff metadata only. It is not a second configuration system for Central or any other product.

## `oi init`

`oi init --personal-ground PATH` requires a compatible real Central `ctrl`. It delegates initialization to native `ctrl`, verifies the result with native doctor, and records the personal ground only after those operations succeed.

It does not create fallback `Control` or `Work` directories itself and does not populate authored Control material. Repeating initialization is safe because native Central initialization is idempotent.

## `oi install central`

Central exposes a native Cargo source-install contract. O:I first checks for an existing `ctrl` and verifies compatibility through:

```text
ctrl --version
ctrl --json action.list
```

The required Action field contains `central.init`, `central.doctor`, and `action.list`. A compatible existing executable is registered without reinstalling.

If no compatible executable exists, O:I checks out the source ref declared in `surfaces.json`, verifies that it resolves to the pinned revision, runs Central's native `cargo install --path ctrl` contract into O:I's managed command-artifact area, verifies the resulting command, and then records the registration. It does not create Central configuration or runtime state during installation.

## `oi register`

Explicit registration remains available for existing installations. It stores module identity, executable/source location, version when discoverable, alias, documentation, and Skill location. It does not copy product configuration.

## Transparent dispatch

Every product command preserves the native command boundary. On Unix the implementation uses process replacement (`exec`), so arguments, stdin/stdout/stderr, signals and exit status belong to the native command rather than a reimplementation in O:I. `oi central ...`, `oi ctrl ...`, `oi actuation ...`, `oi aikit ...`, `oi kit ...`, `oi factory ...`, `oi workcell ...` and `oi ql ...` all dispatch transparently through this mechanism.

## `oi migrate`

Migration is a narrow composition-level placement operation. Central defines `Work` as ordinary filesystem material, so O:I does not wait for or invent a project-adoption Action.

`oi migrate <path>` verifies the configured Central ground, previews source and target, refuses target collisions and cross-filesystem copy/delete behavior, and uses a same-filesystem directory rename. It preserves the existing repository and creates no product-specific Project identity or hidden downstream mutation.

## Success criterion

A new human or agent can install `oi`, install or register Central through the native contract, initialize a valid personal ground, inspect status/doctor/Actions, use any of the six product commands transparently, and place existing ordinary work under Central without O:I absorbing Central, Actuation, AIKit, Factory, Workcell or Quaternal Logic behavior.
