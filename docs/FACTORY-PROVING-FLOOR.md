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

The snapshot is therefore the bounded start of O:I #202/#203, not their completion. Later runs may add provider/material/human evidence only through a versioned contract that validates the owning product's receipts; this v1 command cannot upgrade those grades.

The checked-in deterministic/conformance reading is `suite/factory-proving-floor.json`. A real owner-machine run that additionally retained the uncorrelated Workcell census is intentionally kept outside the fixture tree; its standing and digest belong to the run receipt, not to a timeless test input.
