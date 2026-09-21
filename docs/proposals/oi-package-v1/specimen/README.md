# `oi.package/v1` specimen

Test material for the proposal in `docs/PACKAGE-CONTRIBUTION-PROPOSAL.md`:
one package manifest composing one `oi.native-source-contribution/v1` and one
`oi.configuration-contribution/v1`, with whole-package SHA-256 over every
file except the manifest itself. This package is complete and valid:
`oi package validate <this directory>` accepts it and discloses its trust
state.

The negatives live with the loader's tests (`cli/tests/package.rs`): a
missing hashed file, a drifting byte, and a declared entry absent from disk
each refuse with the file named — the refusal fixtures were part of this
specimen's design before the validator existed.
