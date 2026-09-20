# `oi.package/v1` specimen

Test material for the proposal in `docs/PACKAGE-CONTRIBUTION-PROPOSAL.md`:
one package manifest composing one `oi.native-source-contribution/v1` and one
`oi.configuration-contribution/v1`, with whole-package SHA-256 over every
file (computed before the manifest was written, so the manifest itself is
never inside its own hash set). The source contribution's entry file is
declared and hashed but intentionally absent here — a loader must refuse a
package whose hash inventory and files disagree, and this specimen lets that
negative be exercised on purpose.
