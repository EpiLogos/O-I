# Installing {O:I}

{O:I} is composable. The `oi` binary installs the shared disclosure/composition layer; each product remains independently installable and continues to own its own configuration.

## Install the `oi` command

The current CLI is a small Rust binary under `cli/`.

From a checkout:

```sh
cargo install --path cli
```

or use the repository helper:

```sh
bash cli/install.sh
```

The helper installs the built binary under a user-owned prefix and links `oi` into `~/.local/bin` by default. `OI_BIN_DIR` and `OI_CARGO_ROOT` can override those locations.

Then begin with:

```text
oi init
oi status
```

## Minimal personal composition

The minimal conceptual pair remains:

```text
persistent personal ground
+
agent runtime
```

`oi init --personal-ground ~/Central` records the chosen personal ground. If a real Central `ctrl` command is already available, `oi` delegates the initialisation to it. Otherwise {O:I} creates only the minimal `Control/` + `Work/` seed; Central still owns the full semantics when it is added.

The Agent Runtime is currently a development workbench rather than a released CLI and can be registered by source checkout when useful.

## Add existing installations

Registration is first-class because many users will already have one or more native products.

```text
oi register central --executable /path/to/ctrl
oi register ai-kit --executable /path/to/aikit
oi register workcell --root /path/to/Workcell
oi register quaternal-logic --root /path/to/QL-MEF
```

A registration stores only the facts required to find and describe the native surface. It does not import or rewrite product configuration.

## Install through `oi`

`oi install <module>` checks for an existing native command first. If it finds one, it registers it instead of reinstalling it.

At the current live state, **AIKit is the only product with a verified generic install recipe** suitable for automation here. Its README documents a locked Cargo install from source, and `oi install ai-kit` follows that recipe.

Central's current Rust command is still carried by an integration branch rather than a generic published installer. The Agent Runtime, Software Factory, Workcell, and Quaternal Logic are development/library surfaces rather than released CLIs. For those surfaces, `oi install` explains the native-install/register path instead of inventing one.

As each product publishes a stable install contract, the corresponding descriptor can add it without changing product ownership.

## Composition state

`oi` keeps one small JSON file for local composition metadata. By default:

```text
~/.config/oi/composition.json
```

Use `OI_HOME` to place the state elsewhere or `XDG_CONFIG_HOME` for the standard XDG location.

Run `oi status --json` to inspect exactly what is registered and how each surface resolves.

## Agent-led setup

Agent-led setup remains a primary use case. An agent can read `skills/oi/SKILL.md`, run `oi status`, register or install only the requested surfaces, and report the native commands now available.

The setup rule is conservative: discover before installing, register before duplicating, and never turn the composition layer into the product that owns the operation.
