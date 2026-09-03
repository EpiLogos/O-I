# `oi` CLI — Disclosure and Composition Surface

`oi` is the command-line front door for a composed {O:I} installation. It is deliberately smaller than the products behind it: O:I owns the whole-suite namespace and composition disclosure while each product retains its own command vocabulary, structured-output contracts, authority and application semantics.

Its current composition surface includes:

```text
oi help
oi status [--json]
oi current-world [--json]
oi init [--personal-ground PATH]
oi register <module> [--executable PATH] [--root PATH] [--version TEXT]
oi install <module>
oi docs [topic|module]
oi migrate <path>

oi central   [native Central arguments...]
oi actuation [native Actuation arguments...]
oi aikit     [native AIKit arguments...]
oi factory   [native Factory arguments...]
oi workcell  [native Workcell arguments...]
oi ql        [native QL arguments...]
```

## Six-product native command field

The canonical O:I namespace is a sixfold projection over the six native product CLIs:

```text
oi central   -> ctrl
oi actuation -> actuation
oi aikit     -> aikit
oi factory   -> factory
oi workcell  -> workcell
oi ql        -> ql
```

The two already-established short aliases remain compatibility routes:

```text
oi ctrl -> ctrl
oi kit  -> aikit
```

Canonical namespace and compatibility alias both enter the same native executable relation. They do not define a second product command grammar.

`surfaces.json` is the current suite command/disclosure descriptor. For each product it records the accepted owner revision, executable, canonical namespace, compatibility aliases where present, structured-output discoverability and the product-owned installed verification command. The descriptor does not transfer the meaning of those operations to O:I.

## Transparent dispatch

Product dispatch preserves the native command boundary. On Unix the implementation uses process replacement, so arguments, stdin/stdout/stderr, signals and exit status belong to the native command rather than a reimplementation in O:I.

This relation is intentionally distinct from canonical Actions. For example, `oi factory ...` makes the Factory CLI callable; a Factory `ActionRef` remains a Factory-owned Action with its own subject, capability and authority contract. The desktop Command palette preserves the same distinction by presenting product namespaces as command entrypoints rather than fabricating Actions from them.

## Current World and desktop disclosure

`oi current-world` reads the live composition disclosure and projects the stable six product positions together with each product's accepted owner revision, canonical command namespace, local reachability and current machine/Workcell relation. A maximal situated six-product composition is reported through the existing CF5 reading.

The desktop consumes that same disclosure through its native shell snapshot. System therefore sees the same six product application surfaces, and Command can discover the canonical product namespaces without creating a parallel desktop registry.

## `oi status`

`oi status` remains the immutable release-suite status surface. It compares the accepted release manifest with local installation state and distinguishes installed, registered, missing and broken release surfaces.

Current-main development composition is separately disclosed by `surfaces.json`, `suite/mainline.json`, `oi current-world`, the desktop shell/System surfaces and the pre-local/current-main verification commands. A later release cut can make an accepted current-main composition into a new immutable release snapshot without rewriting the meaning of an older release.

The composition file contains discovery and handoff metadata only. It is not a second configuration system for Central or any other product.

## `oi init`

`oi init --personal-ground PATH` requires a compatible real Central `ctrl`. It delegates initialization to native `ctrl`, verifies the result through the native Central contract, and records the personal ground only after those operations succeed.

It does not create fallback `Control` or `Work` directories itself and does not populate authored Control material. Repeating initialization is safe because native Central initialization is idempotent.

## `oi install central`

Central exposes a native Cargo source-install contract. O:I first checks for an existing `ctrl` and verifies compatibility through Central-owned commands.

If no compatible executable exists, O:I checks out the source ref declared by the current suite source contract, runs Central's native install path into O:I's managed command-artifact area, verifies the resulting command, and only then records the registration. It does not create Central configuration or runtime state during installation.

Whole-suite first installation and current-main development installation have their own guarded paths in the operative front door; product-native installation and verification remain owner contracts.

## `oi register`

Explicit registration remains available for existing installations. It stores module identity, executable/source location, version when discoverable, documentation and Skill location. It does not copy product configuration.

## Existing-world recognition and migration

Existing-world adoption/recognition inspects a heterogeneous World before mutation and returns owner-native handoffs. The recognition engine remains separate from the six-product composition registry: native technologies encountered in a person's World do not become extra O:I products merely because O:I can recognise them.

`oi migrate <path>` remains a narrow composition-level placement operation. Central defines `Work` as ordinary filesystem material, so O:I does not invent a second Project identity or hidden downstream mutation when placing existing work.

## Success criterion

A human or Agent can enter the suite through one stable `oi` namespace, discover the exact six product command relations and their accepted provenance, delegate product operations without semantic translation, inspect the current situated composition, and move between CLI and desktop surfaces without either O:I surface absorbing the native owners.
