# O:I package / extension envelope

This directory documents and fixtures the small suite-level package boundary from O:I #21.

The package descriptor owns only:

- package identity, version, source and revision;
- suite/native contract compatibility requirements;
- whole-package permission/effect disclosure;
- the list of independently identified native contributions;
- each contribution's target product/contract, artifact and native verification declaration.

It does **not** define the semantics of `SessionSpaceProvider`, ACP, model Contracts, Workcell providers, Surfaces, Agents, Actions, Projects or material resources. Those remain native-product contracts.

`schemas/oi.package-v1.schema.json` is the language-neutral descriptor schema. The Rust `oi_cli::package` module validates the same floor, checks minimum native contract versions against an explicit native contract catalog, and records lifecycle receipts only when the caller supplies one explicit native outcome per contribution.

The example manifests are conformance-shape fixtures, not claims that the named target contracts are already live:

- `examples/ide-environment.json` demonstrates an AIKit SessionSpaceProvider plus connection-adapter package shape. AIKit #61–#63 remain gated on AIKit #60, so O:I does not activate or emulate these contracts here.
- `examples/model-environment.json` demonstrates an AIKit model-contract contribution plus a Workcell provider-SDK contribution. Workcell #23 owns the provider SDK; AIKit #64 owns model resolution.

No marketplace, daemon, plugin VM, dynamic ABI or universal provider ontology is introduced.
