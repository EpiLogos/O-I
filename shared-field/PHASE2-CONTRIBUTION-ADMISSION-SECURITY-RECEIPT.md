# OI-017-C Phase 2 — Contribution Ingress / Quarantine / Admission / Index Security Receipt

Status: Phase 2 implementation receipt for #43. This document does **not** close #43 or #31 and does not begin Phase 3 exchange authority or Phase 4 containment.

## Canonical implementation line

- Branch: `agent/oi-017-contribution-admission`
- Base: exact Phase-1 privacy head `58e40b65e4e33bbca16f6321f3d7d871498291cc`
- Last implementation-code head before this receipt file: `42cfd326eef42f4578705a422458a21b0b7d9ee0`
- Canonical PR: #47 — `[OI-017-C/P2] Quarantine and admit inbound Contributions`
- SpaceTimeDB: `2.8.1`
- Provider CLI commit reported by acceptance: `4d9aa49594d59bf09f949b83c30413e43bf0805a`

The canonical Phase-2 line extends the existing `oi.contribution/v1` primitive. It does not create a second Contribution ontology.

## Enforced server shape

```text
external / remote / local supplied material
        ↓
SERVER RECEIVE
        ↓
PRIVATE Contribution ingress / quarantine backing state
        ↓
schema + bounds + target + provenance + replay checks
        ↓
pending quarantined Contribution candidate
        ↓
explicit receiving-side Admission decision
        ↓
admitted Contribution
        ↓
separate receiving-side index-eligibility decision
        ↓
Phase-1 caller visibility ∩ Contribution visibility/audience
        ↓
possible caller-filtered Explore representation
```

The server, not the sender, determines the authoritative ingress ref, runtime caller attribution, receive time, lifecycle state, server-observed provenance, Admission decision and index decision.

Transport/source identifiers, semantic refs, timestamps inside contributed payloads and sender provenance remain claims. They are not silently promoted to server authority.

## Private quarantine boundary

The hosted module keeps the following Phase-2 state private:

- `contribution_ingress_backing`;
- `contribution_receipt`;
- `admitted_contribution_backing`;
- `admission_decision`;
- `contribution_index_policy`;
- `contribution_index_decision`;
- `contribution_ingress_rate`.

Generated client bindings omit those raw backing tables. Direct subscription attempts are denied in the permanent live provider fixture.

The only sender-facing quarantine surface is the caller-scoped `my_contribution_receipt` View. It exposes the minimum receipt/status relation for submissions whose server-observed `submitterIdentity` is the current caller. It does not expose raw payload, private Admission evidence, private index evidence, or other callers' pending state.

Before Admission, received material does not appear through public SharedField/Participant/Projection/Contribution/Explore surfaces, relations, Watch, Contact, A2A publication or an execution surface.

## Ingress identity, replay and conflict law

The sender's `contribution_ref` is a claimed semantic ref, not the storage identity.

The hosted reducer derives:

- an ingress/replay key from receiving field + attributed Participant + source kind + transport provider + transport operation id;
- a deterministic payload fingerprint from the received contract;
- an independent server ingress ref from the ingress key + payload fingerprint.

The fingerprint is a bounded deterministic application identifier, not a cryptographic trust assertion.

The executable contract proves:

- exact retry of the same transport operation + exact payload is idempotent and produces one receipt/pending ingress;
- same transport operation id + different payload is rejected and cannot overwrite the first ingress;
- a genuinely new transport operation may quarantine material carrying the same claimed semantic ref, but cannot Admission-overwrite an already admitted Contribution under that semantic ref;
- a derived ingress-ref collision fails closed rather than overwriting an existing ingress.

Thus transport retry, payload identity, claimed semantic identity, ingress identity and admitted semantic identity remain distinct.

## Ingress bounds and abuse controls

Reducer-side validation enforces at least:

- maximum Contribution contract size: 32 KiB;
- maximum individual nested string: 8192 UTF-8 bytes;
- maximum provenance entries: 16;
- maximum object properties / array cardinality per level: 64;
- maximum nested depth: 8;
- bounded refs / field / transport ids;
- valid JSON object shape and supported `oi.contribution/v1` schema;
- target-field / same-field Participant checks for recognised target kinds;
- no sender-supplied Admission, state, visibility, audience or index-eligibility fields;
- per-field/per-origin rolling ingress limit: 8 accepted ingress operations / 60 seconds;
- per-field/per-origin rolling byte budget: 96 KiB / 60 seconds;
- maximum 8 outstanding quarantined Contributions per field/origin.

The live fixture proves malformed JSON, oversized payload, oversized nested string, high-rate/fan-out and aggregate byte-budget attacks fail server-side.

Network-level connection floods, distributed-origin volumetric denial of service, host storage ceilings and provider/process resource quotas remain deployment/Workcell responsibilities outside this application reducer boundary.

## Admission authority law

Admission uses the existing SharedField authority grammar. Phase 2 adds the minimal field-scoped role:

```text
admitter
```

Admission authority is not implied by:

- transport success;
- schema validity;
- contributor authority;
- ordinary field membership;
- Contact acceptance;
- A2A completion;
- caller-provided `admitted=true`;
- model confidence.

A hosted Admission/rejection/withdrawal reducer requires either:

- the actual SharedField owner runtime caller; or
- a runtime caller bound to the same-field Participant carrying a current `admitter` authority grant.

The authority remains actor-bound, field-scoped, revocable and auditable through private decision/provenance state. Finite `admitter` authority is checked against reducer server time and is proven to fail after expiry. This is distinct from Phase-1 protected-read Views, where finite grants remain deliberately excluded because continuously subscribed read-expiry semantics have not been provider-proven safely.

The sender cannot admit or reject its own material merely because it is a contributor.

## Admission output law

Successful Admission creates an admitted Contribution carrying the original ingress ancestry and the receiving-side visibility/audience decision.

Admission deliberately does **not** create:

- Project Canon;
- trust;
- executable code authority;
- package installation;
- active Capability;
- Projection;
- Explore entry;
- index eligibility;
- exchange authority;
- Action authority;
- Workcell allocation;
- Actuation Determination;
- Factory Run.

The received/admitted representation remains data.

Any later transformation into another canonical object must remain an explicit provenance-bearing operation. This phase does not implement that transformation.

## Visibility after Admission

Admission cannot widen the Phase-1 containing SharedField boundary.

The hosted reducer rejects:

- restricted-field → public Contribution widening;
- private-field → non-private Contribution widening;
- hosted `unlisted` Contribution visibility while direct-only resolution remains unproven;
- private Contributions without an explicit audience;
- cross-field Participant audience refs;
- target Participant refs from another field.

Effective caller visibility is the intersection of:

```text
Phase-1 SharedField visibility/audience
        ∩
receiving-side admitted Contribution visibility/audience
```

The sender does not supply the effective visibility or audience.

## Separate index-eligibility law

Index eligibility is a distinct private receiving-side decision. The schema and audit records preserve this distinction even though both decisions may be made by the same authorised receiving actor.

The hosted module enforces:

```text
received != indexed
quarantined != indexed
admitted != indexed automatically

admitted
+ explicit index eligible
+ visible to this caller
= possible Explore representation
```

`put_explore_entry` refuses a semantic ref claimed by a Contribution until the corresponding ingress is admitted and explicitly index-eligible.

The `explore_entry` View independently re-checks admitted/index policy/caller visibility, so stale raw index state cannot become caller-visible merely because a row exists internally.

Explore relations remain visible only when both caller-visible endpoint refs are visible. A hidden, quarantined, non-index-eligible or private Contribution therefore cannot leak through a visible relation endpoint.

De-indexing and withdrawal remove current Explore material and relations referring to the Contribution. Reconnect/rebuild is proven not to resurrect rejected, withdrawn, quarantined or caller-hidden material.

## A2A convergence

PR #37 already established the source-faithful distinctions:

```text
Agent Card / endpoint != Agent
endpoint != Participant
A2A Task != Factory Run
A2A Message != Contribution automatically
A2A Artifact != Projection automatically
transport result != admitted semantic object
```

Phase 2 preserves them.

A downstream adaptation was cut from exact #37 head `f1b2075618696fdaeba4da6111904205f295af76`:

- Branch: `agent/oi-017-p2-a2a-ingress-adapter`
- Head: `6d15d3914fc52e2c26c892daea1e7c1c346ef30a`
- PR: #51 — `[OI-017-C/P2 A2A] Route returned differences to generic Contribution ingress`

The prior #37 helper `admitA2aDifference()` is now a fail-closed compatibility tombstone. It can no longer mint a semantic Contribution or Projection through an A2A-specific Admission path.

`prepareA2aContributionIngress()` instead performs a pure source-faithful conversion:

```text
A2A returned Task / Message / Artifact payload
        ↓
untrusted oi.contribution/v1 description
        + A2A transport provenance
        ↓
generic hosted Contribution ingress
```

The adapter envelope carries no Admission, effective visibility, audience, index eligibility, Projection, execution, Actuation Determination or Factory Run authority.

On the full stacked provider conformance branch, the envelope is actually submitted to the Phase-2 hosted reducer, receives a private quarantine receipt, creates zero public Contribution/Explore/Projection state, then becomes an admitted Contribution only after an explicit hosted receiving-side Admission. It remains non-indexed afterward until a separate index decision.

This is A2A convergence, not an A2A rewrite. Phase 3 will separately address exchange authority.

## Non-execution law

The Phase-2 hosted reducers manipulate only SharedField semantic/security state. The permanent fixture records zero automatic Projection/Watch/Contact side effects from generic transported ingress and no semantic execution transition.

The stacked A2A proof additionally verifies that A2A transport and hosted Admission create no Actuation Determination or Factory Run and do not automatically Project or index the returned artifact.

Phase 4 remains responsible for deeper package/tool/rich-content/resource containment. Phase 2 establishes that received/admitted material is data by default.

## Permanent multi-identity adversarial fixture

`shared-field/spacetimedb/security-live-acceptance-v5.ts` extends the actual Phase-1 provider world and uses real SpaceTimeDB identities equivalent to:

- OWNER;
- MEMBER;
- EXPLICIT_PRIVATE_RECIPIENT;
- REVOKED_ACTOR;
- FINITE_ACTOR;
- STRANGER;
- REMOTE_AGENT.

The live fixture proves the requested Phase-2 attack corpus:

1. raw quarantine/admission/index/rate backing tables cannot be subscribed to;
2. unrelated callers receive zero pending/quarantined Contribution rows or receipts;
3. received Contribution creates zero Explore/index rows;
4. quarantine creates zero public relation/provenance/existence leak;
5. sender cannot mark/admit its own material;
6. sender cannot choose effective public visibility;
7. sender cannot choose index eligibility;
8. cross-field field/target/audience/Participant refs are rejected;
9. exact ingress retry is idempotent and does not multiply pending semantic state;
10. same transport id with conflicting payload and same claimed ref with a new conflicting ingress cannot silently overwrite existing state;
11. malformed/oversized/high-rate/high-fanout/high-byte material is rejected/bounded server-side;
12. ordinary members/contributors cannot admit/reject; only owner or current `admitter` may decide;
13. revoked Admission authority cannot admit;
14. finite Admission authority fails after reducer-time expiry;
15. Admission alone creates zero Explore representation;
16. admitted + explicitly index-ineligible remains absent from Explore;
17. admitted + index-eligible still obeys Phase-1 caller visibility;
18. relation with a hidden Contribution endpoint is absent;
19. A2A returned material enters generic quarantine and cannot jump directly to Contribution/Projection/canonical state;
20. ingress/Admission creates zero automatic Projection/Watch/Contact and stacked A2A conformance records zero Actuation/Factory Run transition;
21. rejection/withdrawal removes or suppresses stale current index material;
22. private admitted/index-eligible Contribution remains absent for ordinary members outside its explicit private audience;
23. saved-identity reconnect/rebuild does not resurrect withdrawn/rejected/quarantined/hidden material.

These attacks are permanent provider tests, not portable mocks.

## Canonical provider acceptance

Canonical implementation run **#127**, Actions run id `32015781710`, at exact implementation-code head `42cfd326eef42f4578705a422458a21b0b7d9ee0` completed successfully:

- `test` — success;
- `spacetimedb-live` — success.

The provider lane executed:

```text
npm install --prefix shared-field/spacetimedb
spacetime version install 2.8.1
spacetime version use 2.8.1
spacetime --version
spacetime build --module-path shared-field/spacetimedb
spacetime start --listen-addr 127.0.0.1:3000
spacetime publish oi-shared-field-ci --server local --module-path shared-field/spacetimedb --yes=all
spacetime generate --lang typescript --out-dir shared-field/spacetimedb/module_bindings --module-path shared-field/spacetimedb
npm --prefix shared-field/spacetimedb run acceptance
```

The acceptance bootstrap runs Phase-1 v4 first and Phase-2 v5 second against the same real multi-identity database. The generated 2.8.1 bindings skipped the private Phase-1 and Phase-2 backing/security tables while generating the legal caller-filtered public Views/reducers.

The Phase-2 proof reported all 23 security outcomes above as denied/zero/idempotent/bounded/required as appropriate.

## Downstream full-stack conformance

A **fresh** conformance branch was cut from exact PR #42 head `7d7f1362ee92cd1aa6073cfc39d218311e144a01`, which contains exact #37 head `f1b2075618696fdaeba4da6111904205f295af76`.

The canonical Phase-2 server module was stacked onto it, then only the A2A returned-difference semantic shortcut described above was adapted.

Evidence line:

- Branch: `agent/oi-017-contribution-admission-conformance`
- Evidence head: `69d3d8715730c051165da400f3ce678925743f0b`
- Temporary conformance PR: #50 — `[CONFORMANCE/P2] Prove Phase 2 over A2A and notification stack`
- Run **#128**, Actions run id `32016545227` — success in both `test` and `spacetimedb-live` jobs.

The live job published and exercised three isolated provider databases:

```text
oi-shared-field-ci
    Phase-1 privacy + Phase-2 Contribution security

oi-shared-field-a2a-ci
    #37 source-faithful A2A transport + generic hosted Contribution ingress/Admission

oi-shared-field-watch-notify-ci
    #42 Watch → availability → Encounter → Central notification
```

The A2A proof reached binding revision 3 in `withdrawn` state, used both initial and replacement endpoints before withdrawal, preserved semantic Agent/Participant/binding identity, routed the returned Task/Artifact through generic quarantine, explicitly admitted it, left it non-indexed, disabled the legacy A2A-specific Admission bridge, and created no automatic Projection/Actuation/Factory Run.

The #42 proof still produced two bounded availability changes / Encounters and two explicit Central notification decisions/deliveries, exposed zero Watch rows to the intruder, stopped delivery after authority revocation, deduplicated rebuild and recorded no human acknowledgement. Phase 2 did not redesign that subsystem.

The conformance PR is evidence-only and is to be closed without merge after this receipt is recorded.

## Standalone #37 adapter acceptance

PR #51 independently proves the production-ready #37 adaptation on top of the exact #37 head without importing the Phase-2 server implementation.

At adapter head `6d15d3914fc52e2c26c892daea1e7c1c346ef30a`:

- run **#129**, Actions run id `32016793372`;
- `test` — success;
- `spacetimedb-live` — success;
- SpaceTimeDB 2.8.1 / CLI commit `4d9aa49594d59bf09f949b83c30413e43bf0805a`;
- live proof `oi-a2a-phase2-ingress-adapter/v1`;
- legacy A2A Admission bridge: disabled;
- automatic Contribution: false;
- automatic Projection: false;
- automatic index: false.

This adapter PR is the normal sibling-integration seam for #37; it is not a replacement for the canonical Phase-2 server PR #47.

## Files changed on canonical Phase-2 branch

Implementation code/evidence before this receipt:

- `.github/workflows/shared-field.yml`
- `shared-field/admission-schema-v1.json`
- `shared-field/admission.mjs`
- `shared-field/admission.test.mjs`
- `shared-field/api.mjs`
- `shared-field/spacetimedb/security-live-acceptance-v4-bootstrap.ts`
- `shared-field/spacetimedb/security-live-acceptance-v5.ts`
- `shared-field/spacetimedb/src/index.ts`

Receipt/handoff artifacts:

- `shared-field/PHASE2-CONTRIBUTION-ADMISSION-SECURITY-RECEIPT.md`
- `shared-field/PHASE3-EXCHANGE-AUTHORITY-FRESH-SESSION-PROMPT.md`

Downstream #37 adapter PR #51 changes:

- `shared-field/a2a.mjs`
- `shared-field/a2a.test.mjs`
- `shared-field/spacetimedb/a2a-phase2-ingress-live-acceptance.ts`
- `shared-field/spacetimedb/package.json`

The full-stack conformance branch also modifies its A2A live acceptance so it can execute the generic hosted ingress/Admission seam. It is evidence-only, not a second Phase-2 implementation.

## Provider / design limitations carried forward

1. True hosted `unlisted` remains unsupported/rejected because direct-only resolution without broad enumeration is still not provider-proven.
2. Finite `admitter` authority is reducer-time safe and proven. Finite authority remains excluded from continuously subscribed protected private-read Views under the Phase-1 fail-closed rule.
3. The deterministic ingress/payload fingerprints are replay/addressing aids, not cryptographic provenance or trust proofs. Collision is fail-closed (rejection), not overwrite. A future need for cryptographic content addressing should use a reviewed provider/library primitive rather than treating this identifier as one.
4. Application-layer rate/byte/outstanding bounds do not solve distributed/network volumetric DoS, provider connection exhaustion, disk ceilings or host quotas. Those remain deployment/Workcell boundaries.
5. Mediated `a2a` / `mcp` / `http` / `local-import` ingress is owner-mediated quarantine-only in Phase 2. Generic exchange authority for another actor is deliberately **not** granted here; that is Phase 3.
6. Admission does not implement transformation into Project Canon, Projection, installed package, Capability, Action or executable state. Such transformations remain explicit later operations.
7. O:I cannot retract external copies legitimately received while material was visible.
8. PRs #47, #51, #37 and #42 remain sibling integration lines subject to normal merge/integration ordering; the conformance run proves their compatible production semantics without using the evidence branch as a merge shortcut.

## Phase boundary

Phase 2 is complete only as:

```text
Contribution ingress
    → private quarantine
    → explicit receiving-side Admission
    → separate receiving-side index eligibility
    → Phase-1 caller-filtered representation
```

Do **not** interpret this receipt as exchange authority or containment.

The next implementation session must be fresh and must consume `PHASE3-EXCHANGE-AUTHORITY-FRESH-SESSION-PROMPT.md`.

**STOP after this Phase-2 receipt/handoff.**
