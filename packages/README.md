# O:I packages

This directory now contains **two deliberately different package relations**. They should not be conflated.

## 1. `@epi-logos/oi` — distribution package for the `oi` command

`packages/oi-cli/` is an ordinary npm distribution surface for the native Rust `oi` executable. It exists so installing the O:I front door does not require cloning the repository or compiling Rust on the user's machine.

It does not define any O:I extension semantics. Its install script selects a supported native release artifact, verifies the published SHA-256, installs the binary inside the npm package, and exposes it through npm's `bin` mechanism.

## 2. `oi.package/v1` — suite extension / contribution envelope

The rest of this directory documents and fixtures the small suite-level package boundary from O:I #21.

The package descriptor owns only:

- package identity, version, source and revision;
- suite/native contract compatibility requirements;
- whole-package permission/effect disclosure;
- the list of independently identified native contributions;
- each contribution's target product/contract, artifact and native verification declaration.

It does **not** define the semantics of `SessionSpaceProvider`, ACP, model Contracts, Workcell providers, Surfaces, Agents, Actions, Projects or material resources. Those remain native-product contracts.

`schemas/oi.package-v1.schema.json` is the language-neutral descriptor schema. The Rust `oi_cli::package` module validates the same floor, checks minimum native contract versions against an explicit native contract catalog, and records lifecycle receipts only when the caller supplies one explicit native outcome per contribution.

The example manifests are conformance-shape fixtures, not claims that the named target contracts are already live:

- `examples/ide-environment.json` demonstrates an AIKit SessionSpaceProvider plus connection-adapter package shape. AIKit #61–#63 remain gated on their native implementation line, so O:I does not activate or emulate these contracts here.
- `examples/model-environment.json` demonstrates an AIKit model-contract contribution plus a Workcell provider-SDK contribution. Workcell owns the provider SDK; AIKit owns model resolution.

The envelope is therefore **real validation/composition code with fixture examples**, but its full install/register/remove path becomes a live extension system only when the target products expose and exercise the corresponding native lifecycle contracts.

No marketplace, daemon, plugin VM, dynamic ABI or universal provider ontology is introduced.
