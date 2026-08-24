# Installing {O:I}

{O:I} is composable. The `oi` binary installs the shared disclosure/composition layer; each product remains independently installable and continues to own its own configuration and runtime state.

Two installation truths are deliberately kept separate:

```text
immutable released-artifact suite
    a reproducible historical release, with fixed artifacts/digests

current native-main source suite
    the accepted source world used for development and the #97 physical handoff
```

A release remains useful after development advances. It must not be presented as the current development world merely because its artifacts still verify.

## Install the `oi` command

### npm-formatted native distribution

The repository defines `@epi-logos/oi` as the public distribution package for the native Rust CLI. It is a thin installer/launcher over O:I's prebuilt release artifacts, not a JavaScript reimplementation of `oi` and not the `oi.package/v1` extension envelope.

The `oi-v0.1.0-prelocal.4` release line publishes the npm package tarball beside the native binary archives. Once that release exists, the package can be installed without a repository checkout or Rust toolchain:

```sh
npm install -g https://github.com/EpiLogos/O-I/releases/download/oi-v0.1.0-prelocal.4/epi-logos-oi-0.1.0-prelocal.4.tgz
oi help
```

The short registry form is the intended public entry point:

```sh
npm install -g @epi-logos/oi
```

That short command becomes real only after the package has actually been published to npm. npm trusted publishing cannot create a package's first registry entry: an authenticated npm account that owns the `@epi-logos` scope must perform the one-time bootstrap publish first. After that, configure the package's GitHub Actions trusted publisher for:

```text
organization/user   EpiLogos
repository          O-I
workflow filename   npm-publish.yml
allowed action      npm publish
```

The repository's manual `npm-publish.yml` workflow is then the tokenless publication path for later versions. Until the first registry publication has happened, the immutable GitHub release tarball above is the real npm install surface.

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

For the current development world, use the checked-in `suite/mainline.json` / `surfaces.json` source pins and the `oi dev` flow below. `suite/manifest.json` remains the immutable historical release manifest and is not the authority for current source HEADs.

## First encounter

After `oi` itself is installed, establish or discover the native personal ground:

```sh
oi install central
oi init --personal-ground "$HOME/Central"
oi status --json
oi ctrl doctor --json
oi ctrl action list --json
```

`oi install central` now treats the current ProjectCentral contract as the compatibility floor for the current-main path. An older `ctrl` exposing only the historical bootstrap trio is not accepted as the #97 current Central. If a current compatible executable is not present, O:I installs the exact Central source revision recorded by the current surface descriptor and verifies the resulting executable before registering it.

`oi init --personal-ground` delegates initialization to that native Central and verifies the current root/Wiki relation. A current fresh root contains:

```text
Control/
├── user/
├── agents/
│   ├── governance/
│   └── wiki/
│       └── wiki.json
└── machines/
.central/
Work/
```

`Control/agents/wiki/wiki.json` is the Central root Agent-Wiki federation source. O:I does not synthesize this structure itself and does not fabricate ProjectCentral identity, authored source, machine facts, or Agent governance.

Because `oi ctrl ...` is a transparent alias, a non-default personal-ground path should be passed to native `ctrl` with `--root` (or configured through Central's own root mechanism). The simple sequence above uses the native default `$HOME/Central`.

## #97 current-main workstation handoff

The physical acceptance is useful only after the software world being tested is known to be the intended current world. The handoff therefore begins with source truth, not provider/hardware tests.

Preserve any local work first. Do not reset, clean, overwrite, or move a dirty/diverged checkout merely to make this sequence pass. Reconcile unique local work explicitly, then establish the intended source world under Central `Work/`.

The expected developer source locations are:

```text
$HOME/Central/Work/O-I
$HOME/Central/Work/Central
$HOME/Central/Work/Actuation
$HOME/Central/Work/ai-kit
$HOME/Central/Work/Software-Factory   # historical agent-system-design remote remains accepted
$HOME/Central/Work/Workcell
$HOME/Central/Work/Quaternal-Logic   # historical QL-MEF path is also recognised
```

Once the local repositories have been reconciled safely:

```sh
oi dev status --json
```

This reports each checkout against the **current native-main source pin**, not the immutable release SHA. Then:

```sh
oi dev sync
```

fetches/prunes every source and only fast-forwards a clean, non-diverged checkout. Dirty or locally-ahead work is preserved; diverged history is refused rather than rewritten.

Exercise the current source itself:

```sh
oi dev test central
oi dev test actuation
oi dev test ai-kit
oi dev test software-factory
oi dev test workcell
oi dev test quaternal-logic
```

Build/register the current native source world where appropriate:

```sh
oi dev install central
oi dev install ai-kit
oi dev install workcell
```

or use `oi dev install <product>` for the current-source registration supported by that product contract.

The software-world gate immediately before physical/provider acceptance is:

```sh
oi dev acceptance --json
```

It requires the local O:I + six-product source world to be present, on `main`, clean, non-diverged and at the accepted current-main revisions; it also requires a ProjectCentral-capable Central and the current personal-root/Wiki shape. A failure here means the physical test is pointed at the wrong software world and should not be reinterpreted as a hardware/provider result.

After that software-world gate, Central owns the recursive Project binding. For each existing Work project, including O:I, use Central's native ProjectCentral inspection/plan/apply/doctor path rather than shell-created metadata. O:I already carries its human-requested learning aperture at:

```text
Work/O-I/ProjectCentral/user/learnings/
```

Central may create/bind the surrounding `ProjectCentral/project.json`, canonical Agent Wiki and root federation without replacing that source material.

Only then do the genuinely physical gates become meaningful: macOS-native/Raycast/Shortcuts/provider behavior on the reference workstation, Workcell materialisation on the Ubuntu reference machine, and private credential/network/GPU/model-provider relations. Those observations are returned evidence about the current software world, not substitutes for establishing it.

## Add existing installations

Registration is first-class because a machine can already have one or more native products.

```text
oi register central --executable /path/to/ctrl
oi register ai-kit --executable /path/to/aikit
oi register workcell --root /path/to/Workcell
oi register quaternal-logic --root /path/to/QL-MEF
```

A registration stores only facts required to find and describe the native surface. It does not import or rewrite product configuration.

For Central specifically, `oi install central` is preferable when compatibility is not already known because the current-main route verifies the ProjectCentral-capable Action surface before accepting an existing executable.

## Install other surfaces through `oi`

Released-artifact installation and current-source development remain distinct. `oi install [PRODUCT ...]` on the released-suite path installs immutable accepted artifacts described by `suite/manifest.json`. `oi dev ...` operates over the current native source world and uses the current mainline source pins.

Do not infer from a green released-artifact doctor that a developer checkout is current, and do not rewrite historical release metadata to make it appear current.

## Composition state

The local composition is a small JSON file, normally:

```text
~/.config/oi/composition.json
```

Use `OI_HOME` to place the state elsewhere or `XDG_CONFIG_HOME` for the standard XDG location. Managed command artifacts installed by O:I can live beside that state, but product configuration and runtime state remain in the native product.

Run `oi status --json` to inspect registered/runtime composition. Run `oi dev status --json` when the question is whether the developer source world matches the current accepted mains.

## Failure behavior

Installation and initialization commit composition metadata only after the native operation succeeds. A failed current Central source install leaves prior composition metadata unchanged. A failed Central initialization does not record a false personal ground. An old Central executable is not accepted merely because it can perform the historical bootstrap trio.

The setup rule is conservative: discover before installing, preserve before moving, make source/release standing explicit, delegate native ownership, and require the software-world gate before interpreting physical results.
