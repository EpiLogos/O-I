# Installing {O:I}

{O:I} is composable. The `oi` binary installs the shared disclosure/composition layer; each product remains independently installable and continues to own its own configuration and runtime state.

## Install the `oi` command

### npm-formatted native distribution

The repository now defines `@epilogos/oi` as the public distribution package for the native Rust CLI. It is a thin installer/launcher over O:I's prebuilt release artifacts, not a JavaScript reimplementation of `oi` and not the `oi.package/v1` extension envelope.

The `oi-v0.1.0-prelocal.3` release line publishes the npm package tarball beside the native binary archives. Once that release exists, the package can be installed without a repository checkout or Rust toolchain:

```sh
npm install -g https://github.com/EpiLogos/O-I/releases/download/oi-v0.1.0-prelocal.3/epilogos-oi-0.1.0-prelocal.3.tgz
oi help
```

The short registry form is the intended public entry point:

```sh
npm install -g @epilogos/oi
```

The repository contains a manual trusted-publishing workflow for that package, but the short command should be advertised as live only after the `@epilogos/oi` npm registry entry has actually been published. Until then, the immutable GitHub release tarball above is the real npm install surface.

The pre-local package supports the native release targets that O:I actually builds today:

```text
Apple Silicon macOS    aarch64-apple-darwin
x64 Linux              x86_64-unknown-linux-gnu
```

Unsupported platforms fail explicitly instead of silently compiling or substituting another binary. The package verifies the native archive against its release SHA-256 sidecar; the native release workflow also emits GitHub artifact attestations.

### Developer/source install

From an O-I checkout, the Rust source path remains available:

```sh
cargo install --path cli
```

or:

```sh
bash cli/install.sh
```

The helper installs the built binary under a user-owned prefix and links `oi` into `~/.local/bin` by default. `OI_BIN_DIR` and `OI_CARGO_ROOT` can override those locations.

## First encounter

After `oi` itself is installed, establish or discover the native personal ground:

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
