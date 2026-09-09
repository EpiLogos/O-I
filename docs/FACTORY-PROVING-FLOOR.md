# Factory proving floor

`oi prove factory` consumes the accepted Factory Commission surface as an owner-native command. It does not reconstruct Project, Journey, Run, or workflow-unit relations inside O:I.

The command requires a clean Factory source checkout at `12a721dbbb51e3c70d52ef00220efa859ef930fd`, verifies the four accepted schema byte digests, invokes the supplied Factory executable, and records exact JSON outputs for admission, exact replay, workflow attachment, and public developmental reads. Both the Factory state and O:I snapshot use create-new semantics.

The evidence grades are deliberately separate:

- `D` — deterministic owner-command evidence from this run;
- `C` — conformance evidence against exact accepted contract bytes;
- `P` — provider evidence;
- `M` — material/process evidence;
- `H` — human Recognition.

The checked-in snapshot establishes only `D` and `C`. `P`, `M`, and `H` remain unavailable. A Commission and planned Guardian workflow are not execution, provider contact, material change, Return, or Recognition. Direct sessions and externally started Harness processes retain no Factory ancestry unless their native owners later establish a relation.

An optional `--workcell-baseline` may retain an exact `workcell.registry/v1` owner reading as `M: provisional-unaccepted`. The command rejects Factory-shaped refs in that input and labels it an uncorrelated external baseline. It therefore creates a truthful comparison point for a later owner-established correlation without claiming that any observed Harness belongs to this Factory Run or that its executable identity has passed the current Workcell acceptance floor.

After Workcell `fa47a29fa49a6636675d21309b00c269ac824abb`, `--workcell-source` plus `--workcell-usage` may retain a real `workcell.resource-usage/v1` receipt. The command verifies that exact clean owner revision and schema digest, requires the accepted Factory Run among Workcell's opaque external correlations, preserves unsupported metrics, and checks that argv/environment collection stayed false. This permits `M: observed`; it still does not turn correlation into Factory ancestry or provider authority.

After Actuation `5eec4639f1c8727865373b27fdcde09fdcca2d53`, `--actuation-source`, `--actuation-usage`, and `--actuation-usage-replay` may retain a real `actuation.model-usage/v1` observation through its Activity/ActuationStream envelope. The command pins the exact owner schema digest, requires the first observation and byte-equivalent event replay to disclose `deduplicated: false` then `true`, and requires the admitted Factory Run only as an opaque external correlation. Token/cache counts and outcome provenance remain exactly owner-supplied; absent provider identity, model identity, latency, and cost remain `not-reported`. Content-, prompt-, argv-, and environment-bearing fields are refused. This permits `P: observed` without claiming Factory execution ancestry, Actuation authority, or completion.

The snapshot is therefore the bounded start of O:I #202/#203, not their completion. Provider and material grades can move only when the corresponding exact owner receipt is supplied and validated; human Recognition remains unavailable here.

The checked-in deterministic/conformance reading is `suite/factory-proving-floor.json`. The two `suite/factory-proving-actuation-usage*.json` records are byte-exact owner CLI outputs from the bounded provider observation and replay (SHA-256 `04c94149fa5b9b666473e40bd312f50d10fd2d3fd6d10272bfc2503e51344551` and `0f968d47d8f49b2a3dd042c261c573f0d424c93673e8b3f0ac573d3e79ad6624`); they retain no prompt or response content. The raw JSONL stays outside the repository. A real owner-machine run that additionally retained the uncorrelated Workcell census is intentionally kept outside the fixture tree; its standing and digest belong to the run receipt, not to a timeless test input.
