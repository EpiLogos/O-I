# Record-bound recovery routing

The old application captured scope once from `?mode=` in
`nativeWorkspace.ts`, while the portable host rewrote each recovery request
to its current presentation mode. `nativeRecovery.ts` cached revisions under
the requested scope, so a successful reply could acknowledge another store
while poisoning the first store's cached CAS basis. Both rules are replaced
by an explicit host-selected recovery address. Mode remains presentation.

The authoritative recovery address is `(scope, kind, id)` in
`desktop/cradle/src/expressions/recoveryTypes.ts` and the native
`expression_recovery::Store`. The stored `oi.native-working/v1` value admits
only `schema,draft_id,view,file,pending`; adding scope to that value would
change the owner schema. This package carries refs-only routing metadata and
never changes journal bodies or schema.

The host treats selected `checkpoint_id` and returned `draft_id` as separate
identities. Only a qualified selected checkpoint owner read grants that
draft id to the same scope/checkpoint/Expression address; a checkpoint write
must name that proved draft. The current Rust owner separately requires
checkpoint value `draft_id` and `view.journey.id` to equal its record id
(`expression_recovery.rs`, `validate`). Thus the genuine native evidence
below covers equal ids; distinct-id owner support is unavailable today and
has not been claimed or simulated as a native success.

## Package contract

```ts
type RecoveryBinding = {
  scope: 'expressions' | 'techne'
  checkpoint_id: string
  expression_ref: string
}
```

Pass successful `reopenConfiguredWorks(...).works` as host
`recoveryBindings`, and the explicitly selected member as
`initialRecoveryBinding`. Mount writes `recovery-scope` and
`recovery-checkpoint` query parameters for that same boot Expression.
`host.openExpression` resolves by exact ref and posts `recovery` on the
existing `open-expression` or `refresh-expression` command. Configured hosts
refuse an unselected ref before a command can replace work.

Recovery requests name their exact scope and id. The host forwards them
unchanged after admission, verifies owner acknowledgements, then grants the
checkpoint's exact native `draft_id` for draft reads/writes/removes. Grants
are identity metadata, not document or revision stores. A late result from a
replaced frame cannot grant an address. List results include only selected
addresses; generic `find_checkpoint` refuses because historical duplicates
require a concrete selection. Omission of `recoveryBindings` preserves
legacy non-recovery hosting; it grants no recovery access.

The parent owns matching application changes in `nativeRecovery.ts`,
`recovery.ts`, `nativeWorkspace.ts` and `app.ts`: capture each draft's chosen
address, read the exact checkpoint before first autosave, pass explicit scope
to every draft helper, retain old work through its old binding, and never
change a work's address when changing modes. A new/unconfigured work needs an
explicit creation/selection route before hosted recovery can operate.

## Native evidence

Read-only native `4180` owner calls found both works in both scopes. The
candidate startup configuration explicitly selects these addresses:

| Work | Selected scope | Storage revision | Document revision | Retained pending |
|---|---|---:|---:|---|
| Central `expression:techne-m0.central.dd19f55a16862f362d32617854728b2a` | techne | 797 | 173 | selection |
| Authored `expression:authored-acb9d00d-e7e4-4f2f-948f-395914da17b1` | expressions | 2142 | 4 | none |

Central's other Expressions-scope copy is storage2092/document1; its
Document hash differs from the chosen revision173. The authored work also
exists in Technē scope at storage2131/document4 with the same Document hash.
No copy was moved, deleted, rebased or selected by recency. Pending selection
remains recovery data and was not replayed.

Selected Central Document SHA-256:
`36e6d44d201ad4da69d0bbb3e21a4260813801c2c5cccd4c62a977ec4bd0c76b`.
Selected authored Document SHA-256:
`e5a10a6cddb1f888f25a4eedf89130d3fe960e18f9897d0afd6206a30566c9b9`.

Executed: package typecheck passed; protocol suite11/11; real native
read-only MessageChannel acceptance13/13, zero mutations dispatched. It
exercises both opposite mode/scope pairs, pre-proof draft refusal,
unselected-scope/ref refusal, exact owner data, selected inventory, open and
refresh carriers, extended continuation metadata stripped to refs only,
pre-proof checkpoint-write refusal, proved write admission without execution,
and acknowledgement scope qualification. A deliberately
corrupted envelope over a genuine owner reading is a boundary refusal check,
not a claim that the native owner produced that fault. This is gradeB
transport evidence; app/CUA save and continuation replay belongs to the
parent after its app integration.

```sh
node --experimental-strip-types --import ../../desktop/cradle/tests/ts-register.mjs \
  tests/recovery-native-acceptance.mjs --kernel-url http://127.0.0.1:4180 \
  --config-url http://127.0.0.1:8788/api/config
```

AcquisitionB: canonical O:I recovery scope/type/owner retained unchanged.
IntegrationD: record-address admission and refs-only carrier. No StepC code.
Pre-edit GitNexus `ExpressionsHost` is UNKNOWN/unindexed; primary index is
seven commits behind the shared seat. No commit or index rebuild performed.
