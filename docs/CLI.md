# `oi` CLI — Disclosure and Composition Surface

`oi` is the command-line front door for a composed {O:I} installation. It is deliberately smaller than the products behind it. **S** is this CLI (S0–S5); **M′** is the desktop. The S↔M′ relation is already stated in [`CANONICAL-PRODUCT-FIELD.md`](CANONICAL-PRODUCT-FIELD.md) and is not restated here.

Live disclosure is `oi help` (`cli/src/frontdoor.rs`: suite-v2 help, then the six-product field, then the families printed after it). The listing below is that printed surface. It does not invent commands the front door does not print.

```text
oi help
oi install [--personal-ground PATH] [PRODUCT ...]
oi update
oi status [--json]
oi doctor [--json]
oi verify [--json]
oi manifest [--json]
oi cleanup --managed

oi capabilities [--json]
oi products [--json]
oi central ...          -> ctrl ... (alias: oi ctrl)
oi actuation ...        -> actuation ...
oi aikit ...            -> aikit ... (alias: oi kit)
oi factory ...          -> factory ...
oi workcell ...         -> workcell ...
oi ql ...               -> ql ...

oi desktop --help
oi aikit-session-space ...
oi ground status|bind
oi current-world [--json]

oi install central [--source existing|pinned]
oi dev status [--json]
oi dev sync [PRODUCT]
oi dev adopt PRODUCT PATH
oi dev build [PRODUCT]
oi dev test [PRODUCT]
oi dev install [PRODUCT]
oi dev acceptance [--json]
oi dev gate PRODUCT [--candidate SHA]
oi prove factory --factory PATH --factory-source PATH --request PATH \
  --workflow-mutation PATH --state PATH --output PATH [--workcell-baseline PATH] \
  [--workcell-source PATH --workcell-usage PATH] \
  [--actuation-source PATH --actuation-usage PATH --actuation-usage-replay PATH]

oi adopt PATH [--json]
oi recognition inspect PATH [--json]
oi recognition list [--json]
oi recognition register PACKAGE.json
oi recognition unregister CONTRIBUTION_REF

oi host omarchy plan [--home PATH] [--json]
oi host omarchy realise --home PATH [--accept-managed-update] [--json]
oi host omarchy verify [--home PATH] [--json]
```

`oi capabilities --json` is the compiled child-capability snapshot with source hashes; it is not a claim of installed availability. `oi desktop --help` is M′ application operations over the S command whole. `oi aikit-session-space` is AIKit's companion protocol with native arguments preserved. `oi ground status|bind` inspects or explicitly changes the default ground binding. `oi current-world [--json]` discloses the situated six-product composition and current machine/Workcell relation.

The same front door still routes composition-era commands that current `oi help` does not print (`oi init`, `oi register`, `oi docs`, `oi migrate`, `oi catalogue`). They remain documented below because they are implemented, not because they appear in the printed help.

## Ordinary suite operation

`oi install [--personal-ground PATH] [PRODUCT ...]` is the printed ordinary-install form. `oi update`, `oi doctor [--json]`, `oi verify [--json]`, `oi manifest [--json]` and `oi cleanup --managed` are the rest of that family. Help states that managed artifacts live in the platform O:I application-data root, never in Central `Control/` or `Work/`; developer source checkouts live under the personal ground's `Work/`; and this pre-local suite does not claim physical workstation/provider acceptance. See [`INSTALL.md`](INSTALL.md).

## `oi products`

`oi products` discloses the six-product command field: executable, namespace, probe commands, revision and standing for every product. `oi products --json` emits the same facts as structured JSON.

## `oi capabilities`

`oi capabilities` and `oi capabilities --json` print the source-receipted product capability catalogue compiled into the suite executable. The printed help says this is derived child capability records with source hashes, not installed availability.

## `oi desktop`

`oi desktop --help` prints the M′ operations:

```text
oi desktop capabilities [--json]
oi desktop files list ROOT_RELATIVE_PATH
oi desktop files read LOCATION_JSON
oi desktop knowledge CWD REQUEST_JSON
oi desktop session-spaces CWD PROJECT_REF
```

All of those results are JSON. Knowledge accepts the kernel Request contract. Window, tab and workspace arrangement remain in the running app's native menu. `oi desktop capabilities --json` discloses the bounded application bindings; it does not assert that the full desktop programme is accepted.

## `oi aikit-session-space`

`oi aikit-session-space ...` dispatches AIKit's SessionSpace companion and preserves native arguments. It is not a seventh product namespace.

## `oi ground`

Printed help: `oi ground status|bind`. `oi ground --help` prints the exact bind/status forms:

```text
oi ground status --json
oi ground bind --request-json JSON|@FILE [--json]
```

These inspect or explicitly change the default ground binding. They do not initialize a ground.

## `oi current-world`

`oi current-world [--json]` discloses the situated six-product composition and current machine/Workcell relation. See [`CURRENT-WORLD-CONTEXT-FRAME.md`](CURRENT-WORLD-CONTEXT-FRAME.md).

## Current-main development

Printed `#97` acceptance family:

```text
oi install central [--source existing|pinned]
oi dev status [--json]
oi dev sync [PRODUCT]
oi dev adopt PRODUCT PATH
oi dev build [PRODUCT]
oi dev test [PRODUCT]
oi dev install [PRODUCT]
oi dev acceptance [--json]
oi dev gate PRODUCT [--candidate SHA]
```

`oi install central` installs or registers current ProjectCentral-capable Central source; the source is exclusive-and-declared when both a compatible `ctrl` and the pinned install apply. The `oi dev *` lines compare, fetch/prune, build, test, install/register, and prove the local source world against current accepted native mains; `oi dev gate` builds an isolated current-main/candidate artifact, tests owner plus Cradle consumer, and records exact evidence. Developer federation help also prints `oi dev adopt PRODUCT PATH`. See [`INSTALL.md`](INSTALL.md).

## `oi prove factory`

This bounded proving command drives the exact accepted Factory Commission CLI and retains Factory's own developmental readings. It verifies the accepted Factory revision and schema bytes before mutation, refuses existing state/output paths, proves exact replay, and rolls back its newly created state if a later proving step fails. Optional exact-main Workcell resource usage and Actuation model usage may be retained with opaque Run correlations that grant no Factory ancestry. The Actuation lane requires the original observation and its exact deduplicated replay; it rejects content-bearing fields. See [`FACTORY-PROVING-FLOOR.md`](FACTORY-PROVING-FLOOR.md).

## Existing-world recognition / adoption

```text
oi adopt PATH [--json]
oi recognition inspect PATH [--json]
oi recognition list [--json]
oi recognition register PACKAGE.json
oi recognition unregister CONTRIBUTION_REF
```

`oi adopt` inspects an existing World through the shared recognition engine and returns owner handoffs without mutation. `oi recognition *` runs, lists, registers, or unregisters World recognition contributions. See [`EXISTING-WORLD-ADOPTION.md`](EXISTING-WORLD-ADOPTION.md).

## Omarchy Reference World host

```text
oi host omarchy plan [--home PATH] [--json]
oi host omarchy realise --home PATH [--accept-managed-update] [--json]
oi host omarchy verify [--home PATH] [--json]
```

`plan` inspects the source-pinned native host relation without mutation. `realise` materialises only O:I-owned plugin payloads; native enable/reload remains explicit. `verify` checks managed payload bytes without fabricating Omarchy/Hyprland uptake. See [`integrations/OMARCHY-HOST.md`](integrations/OMARCHY-HOST.md).

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
