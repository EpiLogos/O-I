# Installing {O:I}

{O:I} is composable. The `oi` binary installs the shared disclosure/composition layer; each product remains independently installable and continues to own its own configuration and runtime state.

## First encounter

From an O-I checkout:

```sh
bash cli/install.sh
```

Ensure the reported bin directory is on `PATH`, then establish the native personal ground:

```sh
oi install central
oi init --personal-ground "$HOME/Central"
oi status --json
oi ctrl doctor --json
oi ctrl action list --json
```

That is the base bootstrap. `oi install central` first looks for a compatible existing `ctrl`; if it finds one, it registers it. Otherwise it follows Central's own Cargo source-install contract at the pinned tested revision. O:I records only composition/handoff metadata.

`oi init --personal-ground` requires a real compatible Central surface and delegates initialization to native `ctrl`. It never synthesizes a partial imitation of Central. A fresh root is created by Central itself with:

```text
Control/user/
Control/agents/
Control/machines/
.central/
Work/
```

The Control roots start empty. O:I does not generate personal profiles, preferences, machine facts, or agent rules. An agent can later help author durable Control through Central's Control-maintenance or Machine-declaration Skills, with explicit human acceptance before durable mutation.

Because `oi ctrl ...` is a transparent alias, a non-default personal-ground path should be passed to native `ctrl` with `--root` (or configured through Central's own root mechanism). The simple sequence above uses the native default `$HOME/Central`.

## Install the `oi` command

The current CLI is a small Rust binary under `cli/`.

```sh
cargo install --path cli
```

or:

```sh
bash cli/install.sh
```

The helper installs the built binary under a user-owned prefix and links `oi` into `~/.local/bin` by default. `OI_BIN_DIR` and `OI_CARGO_ROOT` can override those locations.

## Add existing installations

Registration is first-class because a machine can already have one or more native products.

```text
oi register central --executable /path/to/ctrl
oi register ai-kit --executable /path/to/aikit
oi register workcell --root /path/to/Workcell
oi register quaternal-logic --root /path/to/QL-MEF
```

A registration stores only facts required to find and describe the native surface. It does not import or rewrite product configuration.

For Central specifically, `oi install central` is preferable when compatibility is not already known because it verifies `ctrl --version` and the required structured Actions before registering an existing executable.

## Install other surfaces through `oi`

`oi install <module>` only follows installation mechanisms verified in the corresponding live product descriptor. AIKit also has a verified Cargo source-install route. The Agent Runtime, Software Factory, Workcell, and Quaternal Logic remain development/library surfaces rather than released CLIs; O:I does not invent installers or aliases for them.

The wider system can therefore grow only as needed: use any agent runtime from the valid Central ground, then add AIKit or the other product surfaces when their capability is useful.

## Composition state

The local composition is a small JSON file, normally:

```text
~/.config/oi/composition.json
```

Use `OI_HOME` to place the state elsewhere or `XDG_CONFIG_HOME` for the standard XDG location. Managed command artifacts installed by O:I can live beside that state, but product configuration and runtime state remain in the native product.

Run `oi status --json` to inspect exactly what is registered and how each surface resolves.

## Failure behavior

Installation and initialization commit composition metadata only after the native operation succeeds. A failed Central source install leaves prior composition metadata unchanged. A failed Central initialization does not record a false personal ground.

The setup rule is conservative: discover before installing, register before duplicating, and never turn the composition layer into the product that owns the operation.
