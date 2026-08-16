# `oi` CLI — Disclosure, Composition, and Pre-Local Verification

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

oi snapshot [--output PATH] [--json] [--require-full]
            [--select SURFACE=REVISION]
            [--accepted-mainline SURFACE=REVISION]
            [--accept-compatibility SURFACE=FACT]

oi verify [--snapshot PATH] [--receipt PATH] [--json] [--require-full]

oi <module-alias> [native arguments...]
```

## Native aliases

Only aliases backed by real native CLIs are assigned:

```text
ctrl  -> ctrl   # Central
kit   -> aikit  # AIKit
```

Actuation, Software Factory, Workcell, and Quaternal Logic have no invented aliases.

## `oi status`

Status compares the surface descriptors with local composition and executable discovery. It distinguishes installed, registered, missing, and broken surfaces and reports the configured personal ground. `oi status --json` exposes the same composition facts for agents and scripts.

The composition file contains discovery and handoff metadata only. It is not a second configuration system for Central or any other product.

## `oi snapshot`

A Suite Snapshot is an exact composition-level candidate description. It records the selected product surface, owning repository, exact selected version/commit/revision, install/registration form, native entry point, O:I alias where one exists, docs, Skill, native verification declaration, accepted compatibility facts, and explicit physical/provider requirements.

The command may infer an exact selected revision from a registered Git checkout or registered native version. `--select SURFACE=REVISION` records an externally verified exact selection when the surface is not yet installed or when the local registration cannot expose the intended accepted revision.

O:I never silently claims that a selected revision is accepted native `main`. `--accepted-mainline SURFACE=REVISION` is an explicit acceptance assertion and must equal the selected revision. A snapshot is `full-mainline` only when all six intended surfaces are selected and each has that explicit accepted-mainline assertion. Otherwise the snapshot remains truthfully `partial-or-unaccepted`.

`--accept-compatibility SURFACE=FACT` records a compatibility fact that was actually accepted during harmonisation. The descriptor's compatibility prose is retained separately as declared context and is not promoted to accepted evidence automatically.

`--require-full` refuses to emit anything except a complete six-surface accepted-mainline snapshot. This is intended for the later deliberate harmonisation/freeze step, not for ordinary partial compositions.

## `oi verify`

`oi verify` is a thin whole-level aggregator over O:I composition and product-native verification declarations.

For each selected surface it can:

- check that the registered native executable or source root is reachable;
- validate the registered O:I alias against the descriptor;
- observe the exact installed version or Git commit;
- compare that observation with a supplied Suite Snapshot;
- invoke the product's declared native self-check operation;
- preserve the native exit status, stdout, stderr, command and evidence format;
- retain accepted cross-product compatibility facts from the snapshot;
- report outstanding physical/provider requirements without pretending they ran.

The status field is deliberately not Boolean. Current values include:

```text
not_selected
unavailable
unsupported
skipped_physical_gated
failed
incompatible
passed
```

`failed` means the native operation ran and returned failure. `incompatible` means O:I composition facts or the selected revision do not match. `unavailable` means the declared check could not be run in the present environment. `unsupported` means the native product has not yet published an O:I-invokable self-check declaration. `skipped_physical_gated` is reserved for checks whose own execution requires a physical/provider environment.

When `--snapshot PATH` is supplied, O:I verifies the current installation against that exact frozen candidate. Without a snapshot, it builds a truthful partial snapshot from the current composition and does not invent mainline acceptance.

`--receipt PATH` emits an `oi.composition-receipt/v1` JSON object containing the exact snapshot, observed revisions, metadata checks, native verification evidence, compatibility facts, and outstanding physical/provider requirements. The current receipt environment is explicitly `pre-local`; this command does not claim physical workstation acceptance.

Exit codes are composition-level only:

```text
0  complete pre-local candidate passed
1  failed or incompatible
2  invalid invocation / invalid metadata
3  incomplete, unavailable, unsupported, or physical-gated
```

O:I does not reinterpret native product health, silently repair product state, choose material/network/model providers, or execute verification commands supplied by a snapshot. Executable verification operations come from the trusted O:I surface descriptors; the snapshot supplies selection and acceptance facts only.

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

For repository/workbench surfaces, `--root PATH` allows Suite Snapshot generation and verification to observe the exact Git commit from the native checkout without importing native product configuration.

## Transparent dispatch

`oi ctrl ...` and `oi kit ...` preserve the native command boundary. On Unix the implementation uses process replacement, so arguments, stdin/stdout/stderr, signals, and exit status belong to the native command rather than a reimplementation in O:I.

## `oi migrate`

Migration is a narrow composition-level placement operation. Central defines `Work` as ordinary filesystem material, so O:I does not wait for or invent a project-adoption Action.

`oi migrate <path>` verifies the configured Central ground, previews source and target, refuses target collisions and cross-filesystem copy/delete behavior, and uses a same-filesystem directory rename. It preserves the existing repository and creates no product-specific Project identity or hidden downstream mutation.

## Success criterion

O:I can represent an exact six-surface candidate without becoming a package manager, compare an installation with that candidate, invoke only declared native verification operations, preserve native evidence/provenance, report partial suites and physical/provider gates truthfully, and emit a Composition Receipt suitable for later clean-environment and physical-acceptance work.
