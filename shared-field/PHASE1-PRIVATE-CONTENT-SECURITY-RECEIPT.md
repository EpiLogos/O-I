# OI-017-C Phase 1 — Private / Audience-Scoped Hosted Content Security Receipt

Status: Phase 1 implementation receipt for #43. This document does **not** close #43 or #31 and does not begin Phase 2.

## Canonical implementation line

- Branch: `agent/oi-017-private-content`
- Base: PR #32 head `08b39ec90bb1162de45858eac1851da88c4a7093`
- Last implementation-code head before this receipt file: `24d31e730949488c91b0bc35e8ac3230e64e44f0`
- Canonical PR: #44 — `[OI-017-C/P1] Enforce private hosted content at the server boundary`
- SpaceTimeDB: `2.8.1`
- Provider CLI commit reported by acceptance: `4d9aa49594d59bf09f949b83c30413e43bf0805a`

## Enforced server shape

```text
PRIVATE canonical backing state
        ↓
server-side field / participant / projection / index audience resolution
        ↓
caller-filtered public Views
```

Canonical SharedField, Participant, Projection, Explore entry and Explore relation rows are private backing tables. The existing public read-model names remain public caller-filtered Views so legal downstream readers retain their semantic surface without receiving raw canonical state.

The generated 2.8.1 client bindings omit the private backing tables. Direct subscriptions to the raw backing/authority/Watch/Contact tables are denied in the permanent multi-identity provider fixture.

## Visibility law implemented

### Public

A public SharedField is visible under the containing field relation. Projection and Explore/index eligibility may still narrow what the caller receives.

### Restricted

A restricted SharedField is visible to its owner and to callers bound to a current, persistent, non-revoked Participant authority in that field.

### Private

A private SharedField is visible to its owner and to explicitly named/read-admitted Participants only. Ordinary field membership is insufficient. Explicit read admission is held in private `field_read_grant` state and requires a matching persistent Participant authority bound to the runtime caller.

### Unlisted

Hosted `unlisted` remains rejected. With the currently proven broad subscription/View mechanics, direct-only resolvability while remaining absent from broad enumeration/search has not been demonstrated safely. The implementation fails closed rather than representing `unlisted` as ordinary hidden/public state.

## Projection audience law

Effective Projection visibility is the intersection of containing SharedField visibility and Projection audience.

- A Projection cannot widen a restricted/private containing field.
- Explicit `audience.refs` must resolve to Participants in the same SharedField.
- Cross-field or forged audience refs are rejected.
- `public`, `restricted`, and `private` Projection audiences are accepted; hosted `unlisted` remains rejected.
- Private Projection audience refs narrow public-field visibility to the named persistent Participants.

## Current-revision privacy

Projection history remains protected in private backing state, but the public `projection` View exposes only the latest effective revision for each Projection lineage.

Explore eligibility is also tied to the current revision of the Projection lineage which ever referenced the Explore representation. This prevents a later private/withdrawn revision from leaving an older representation or A2A locator publicly visible merely because the historical Projection row remains preserved internally.

The implementation explicitly does not claim to retract copies retained externally while material was legitimately public.

## Explore / index law

Explore entries are emitted only when the containing field and, where applicable, the current Projection lineage are visible to the caller. Explore relations are emitted only when both endpoints are currently visible.

This closes the tested existence-leak paths through:

- hidden Projection representations;
- public relations pointing to hidden endpoints;
- stale historical Projection representations;
- withdrawn A2A locators;
- raw backing tables.

Phase 2 will generalise Contribution quarantine/admission/index eligibility. Phase 1 does not implement that later ingress ontology.

## Timed-grant provider caveat

Persistent grants may participate in protected caller-filtered Views and revocation removes the subscribed rows.

Finite grants remain reducer-authority-only for protected content. The provider fixture proves that a finite actor receives zero protected private-field content and cannot be promoted to `field_read_grant`. No stronger time-based private-read contract is claimed until executable provider evidence proves that expiry can be enforced safely for continuously subscribed protected Views.

## Permanent adversarial fixture

`shared-field/spacetimedb/security-live-acceptance-v4.ts` reuses/extends the security world with real SpaceTimeDB identities equivalent to:

- OWNER
- MEMBER
- EXPLICIT_PRIVATE_RECIPIENT
- REVOKED_ACTOR
- FINITE_ACTOR
- STRANGER
- REMOTE_AGENT

The fixture proves at least:

1. unrelated callers receive zero restricted/private SharedFields;
2. unrelated callers receive zero protected private Participant/Projection content;
3. unrelated callers receive zero private Explore rows;
4. relations with a hidden endpoint are absent;
5. a persistent eligible Participant receives restricted material;
6. ordinary membership does not defeat explicit-private audience restriction;
7. an explicit private recipient receives only authorised content;
8. revocation removes subscribed private rows and saved-token reconnect remains empty;
9. finite grants receive zero protected private content and cannot become protected-read grants;
10. cross-field field-read and Projection-audience refs are rejected;
11. public → private/narrowed current revision removes the prior public Projection and representation;
12. withdrawn A2A binding removes the old public locator from current Views;
13. hidden objects do not leak through Explore relations/current-revision confusion;
14. raw backing tables cannot be subscribed to as a bypass;
15. non-owner Participant creation and cross-field SharedField overwrite are rejected;
16. Explore index pollution by an unrelated caller is rejected;
17. Watch remains caller-private;
18. Contact recipient impersonation, blocked Contact, oversized Contact and high-rate Contact remain rejected.

## Provider acceptance

Canonical run #115, head `24d31e730949488c91b0bc35e8ac3230e64e44f0`, completed successfully in both jobs:

- `test` — success
- `spacetimedb-live` — success

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

The generated bindings explicitly skipped private tables including `shared_field_backing`, `participant_backing`, `projection_backing`, `explore_entry_backing`, `explore_relation_backing`, `field_authority`, `field_owner`, `field_read_grant`, `watch`, `contact`, `contact_policy`, and `contact_rate`.

## Downstream conformance

A conformance-only branch was cut from exact PR #42 head `7d7f1362ee92cd1aa6073cfc39d218311e144a01`, which contains the exact PR #37 A2A line, and the final Phase-1 server module was applied without redesigning downstream production code.

Run #119 at conformance head `5f07ad14a424a61475aaf76be222da89370643e0` completed successfully:

- shared-field / Explore / A2A / security unit tests — success;
- SpaceTimeDB build / publish / current binding generation — success;
- #37 A2A live acceptance — success;
- #42 Watch → availability → Encounter → explicit `personal.notify` decision/delivery acceptance — success.

The only invalidated downstream assumption was in #37's live acceptance fixture: it used the old raw-table generated `projection.projectionKey.find` secondary-index helper. Production A2A already consumed the Projection read model by iteration. The conformance fixture was therefore adapted test-only to resolve that assertion through caller-visible Projection View rows; no raw backing access was restored.

The A2A proof reached binding revision 3 in `withdrawn` state, preserved semantic Agent/Participant identity, used both initial and replacement endpoints before withdrawal, admitted returned difference only through explicit Admission, and retained Watch as an independent relation.

The Watch-notification proof produced two bounded availability events/Encounters and two explicit Central notification decisions/deliveries, recorded no human acknowledgement, exposed zero Watch rows to the intruder, stopped delivery after authority revocation, deduplicated rebuild, and preserved semantic identity across endpoint churn.

## Files changed on canonical Phase-1 branch

- `shared-field/spacetimedb/src/index.ts`
- `shared-field/spacetimedb/security-live-acceptance-v4.ts`
- `shared-field/spacetimedb/security-live-acceptance-v4-bootstrap.ts`
- `shared-field/spacetimedb/package.json`
- `shared-field/PHASE1-PRIVATE-CONTENT-SECURITY-RECEIPT.md`

Conformance-only downstream evidence additionally uses `shared-field/spacetimedb/a2a-live-acceptance-view-bootstrap.ts` on the temporary #42-stack conformance branch. It is not a second Phase-1 implementation.

## Open provider/design limitations carried forward

1. True hosted `unlisted` is still unsupported and rejected because direct-only resolution without broad enumeration has not been provider-proven.
2. Finite/timed authority remains excluded from protected private-read Views; it is reducer-only until provider-time expiry semantics are proven executable and safe for live subscriptions.
3. O:I cannot retract external copies which were legitimately received while content was public.
4. Sibling implementation branches #37/#42 still require normal integration ordering with the stronger #44 server contract; the conformance run proves their production logic against it but does not merge those sibling branches into #44.

## Phase boundary

Phase 1 is complete only as the private/audience-scoped hosted-content boundary described above. Do not interpret this receipt as implementing Contribution quarantine/Admission, exchange authority, or containment. Those are fresh-session phases of #43.
