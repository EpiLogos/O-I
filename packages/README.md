# O:I packages

This directory contains **two deliberately different package relations**. They should not be conflated.

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

## World-recognition contributions

O:I #173 now makes one O:I-owned contribution contract operational through this existing envelope:

```text
target_product  = oi
target_contract = oi.world-recognition/v1
```

A recognition contribution describes how setup can inspect a real external technology/system and return a source/provenance-bearing `oi.world-recognition-result/v1` observation. Its language-neutral result schema is:

```text
schemas/oi.world-recognition-v1.schema.json
```

External recogniser artifacts are verified before registration and are then called through the stable process protocol:

```text
recogniser verify --json
recogniser discover --target PATH --json
```

The local recognition registry is separate from six-product `composition.json`. Registering a new recognition package changes what the next World scan can understand; it does not add another O:I product or transfer the encountered technology's semantics into O:I.

This is the package-level mechanism used by the #93/#158 setup loop:

```text
recognise native technology
    ↓
attach already-supported owner adapters/providers/connectors
    ↓
missing support → owner SDK + authoring Skill + conformance
    ↓
package/register
    ↓
rediscover the same World
```

The accumulated reusable package/adapter corpus is therefore ordinary O:I extension material and can later be projected through the SharedField/Explore contribution system.

## Current example manifests

The examples are conformance-shape fixtures unless explicitly described as an implemented first-party contribution:

- `examples/ide-environment.json` demonstrates an AIKit SessionSpaceProvider plus connection-adapter package shape.
- `examples/model-environment.json` demonstrates an AIKit model-contract contribution plus a Workcell provider-SDK contribution. Workcell owns the provider SDK; AIKit owns model resolution.
- `examples/herdr-recognition.json` is the first implemented whole-technology recognition package. It is source-locked to `herdrdev/herdr@facf0aafca011d147e798ad37e83799bdd29b75e`, contributes `contribution:herdr/world-recognition` to O:I, inspects the public HerdR API, and attaches the accepted AIKit `aikit.herdr-working-environment/v1` participation without collapsing HerdR-native IDs into O:I/AIKit semantic refs.

The package envelope is therefore **real validation/composition code**, and `oi.world-recognition/v1` now supplies one real install/register/discover lifecycle through it. Other contribution kinds remain live according to the target product's own public lifecycle contracts.

No universal provider ABI or package-owned semantic runtime is introduced. Each target product remains the owner of the native contribution it accepts.