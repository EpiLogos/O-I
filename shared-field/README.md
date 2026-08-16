# O:I shared-field implementation floor

This directory is the smallest executable form of the local-first seam specified in `docs/SHARED-FIELD.md` and `docs/OBJECTIVE-CO-INTERNALITY.md`.

The **portable semantic core** deliberately has no framework, network client, database, or identity-provider dependency. Native products still own their canonical objects. O:I defines only the whole-level relations by which explicitly selected representations cross product/world boundaries and by which independently grounded Participants can become mutually available through a SharedField. The adjacent `spacetimedb/` module is a hosted materialisation of that contract, not a replacement identity/ontology layer.

## Public module entry

Consumers that need the complete portable floor can import from:

```js
import * as sharedField from './shared-field/api.mjs';
```

`api.mjs` is intentionally only an aggregate export over the implementation layers:

```text
index.mjs       Projection / Participant / receipt / Central public selection
social.mjs      SharedField / Contribution / Encounter / Self-Other read model
state.mjs       transport-free local membership / traversal / thread / history logic
explore.mjs     projected-object search / ref resolution / bounded relation read models
watch.mjs       explicit private-interest relation
contact.mjs     explicit Contact attempt / recipient-decision contract
spacetimedb*.mjs hosted adapter seams over the same semantic contracts
      ↓
api.mjs         one import surface, no second implementation
```

This keeps the completed Projection contract stable while letting the shared-agency, Explore and encounter-security grammar develop beside it. `api.test.mjs` guards that all layers remain reachable through the aggregate API.

## Projection contracts

- `oi.participant/v1` — a field-relative relation over an existing `Human` identity or `AgentRef`.
- `oi.projection/v1` — a versioned, transport-neutral envelope preserving native subject kind, source system/revision, publisher, audience, representation and provenance.
- `oi.projection-receipt/v1` — a receiver-side observation that preserves source authorship/provenance and explicitly grants no source mutation authority.
- `oi.sparse-representation/v1` — a deliberately small browser representation format. It is a representation of a typed Projection, not the Projection's semantic type.

`transport` is optional non-canonical metadata. `canonicalProjection()` and `projectionSemanticIdentity()` intentionally exclude it.

Projection revisions are distinct from source revisions. A revision exposes source drift through `source.revision`; withdrawal creates a new Projection revision without deleting source history.

## Shared-agency contracts

`social.mjs` adds the first executable Objective Co-Internality floor without altering the Projection identity contract:

- `oi.shared-field/v1` — an addressable relational environment. `parent_field_ref` expresses recursive containment only; federation remains a different relation.
- `oi.contribution/v1` — an attributable difference returned by a Participant to a SharedField. Its target is generic and may itself be another Contribution.
- `oi.encounter/v1` — an objective record of what a Participant was presented with through a mediation path. It does not assert belief, understanding, phenomenality, or subjective state.

`Contribution` deliberately subsumes platform-shaped notions such as comment, reply, opinion, rating, ranking, metric and moderation judgment. Those are modes/relations of Contribution rather than privileged metadata layers. A ranking or metric therefore retains attribution, target, representation and provenance and does not become truth merely because a UI computes with it.

SharedFields may nest recursively. Containment is checked for cycles and must not be used as a synonym for federation, anchoring, Projection, or participation. This mirrors the recursive whole/member structural law in the generic Glade wiki work while keeping `SharedField` distinct from `WikiSpace` and canonical `Context`.

`selfOtherReadModel()` supplies the smallest browser/agent projection of the shared relation: one field-relative Participant as `Self`, one or more field-relative Participants as `Other`, and the SharedField which relates them. Self/Other are situated positions, not new identity kinds.

The JSON compatibility surface for these relations is `social-schema-v1.json`.

## Contact and relationship privacy

Encounter security preserves the law:

```text
discoverable ≠ contactable ≠ contacted ≠ reciprocal ≠ trusted
```

`contact.mjs` and `contact-schema-v1.json` define `oi.contact/v1` as a transport-neutral communication attempt carrying an initiator, recipient, purpose, requested scope, expiry, provenance and explicit recipient state transition. A Contact does not itself create a Contribution, Projection, A2A session, capability grant, trust relation or executable authority.

`watch.mjs` remains a separate private-interest relation. In the hosted SpaceTimeDB module, Watch and Contact storage are private and clients consume only caller-filtered `my_watch` and `my_contact` Views. The portable adapters deliberately reject raw private-table handles.

## Hosted SpaceTimeDB authority floor

`spacetimedb/src/index.ts` materialises the public SharedField/Explore proof while enforcing server-side mutation authority independently of semantic identity.

The current hosted law is:

```text
SpaceTimeDB Identity
        ↓ explicit private binding
ParticipantRef + SharedField + role + expiry/revocation
        ↓ reducer check
bounded hosted mutation
```

A SpaceTimeDB runtime `Identity` is therefore **not** an O:I Participant, Human, Agent, Agency or canonical subject ref.

The first executable security floor provides:

- first-creator hosted ownership for each SharedField and owner-only Participant/index mutation;
- explicit private Participant authority grants with `observer`, `contact` or `contributor` role;
- server-time expiry and revocation checks on protected reducers;
- publisher-bound Projection mutation with immutable/sequential revisions;
- same-field checks for Explore relations and Watch targets;
- private Watch/Contact/authority tables with caller-filtered public Views;
- server-side Contact duplicate suppression, recipient mute/block, bounded payloads and a first anti-fanout rate window;
- stable O:I semantic refs retained independently of SpaceTimeDB row/module identifiers.

This remains deliberately narrower than a universal policy engine. Central remains the natural durable source of human-authored world-local policy; native product/host boundaries continue to own the authority they actually enforce.

The current PR #19 content surface is still a **public-field proof**. SharedField, Participant, Projection and Explore content are not yet presented as audience-filtered private-world Views, so this implementation must not be cited as proof of private hosted worlds. Relationship metadata is protected now; audience/private-content subscription policy is a later security slice.

See `docs/ENCOUNTER-SECURITY.md` for the six primitives and `docs/ENCOUNTER-SECURITY-IMPLEMENTATION.md` for the ES0 threat/responsibility matrix, primary-source lock and residual-risk ledger.

## Local SharedField state

`state.mjs` turns the contracts into a small transport-free business-logic layer. It is deliberately an index/state view rather than canonical persistence.

`createSharedFieldState()` supports:

- adding and looking up SharedFields, Participants, Contributions and Encounters;
- validating Participant membership against a field;
- traversing child/descendant fields and full parent paths;
- querying Participants and Contributions in one field or recursively through its nested fields;
- querying Contributions by arbitrary target;
- reconstructing recursive Contribution threads without a fixed reply depth;
- rejecting Contribution target cycles, including cycles completed after an earlier unresolved reference;
- retaining/querying Encounter history by Participant and optional field;
- producing a transport-neutral snapshot for an adapter or fixture.

The state layer allows unresolved/external Contribution targets so that a local field can still address a remote/federated object. It enforces local referential integrity where the corresponding Participant or field is owned by the local state.

This is the seam a browser adapter, static/file carrier, test harness, or hosted provider can consume without any of them becoming the semantic owner.

## Explore application/read-model seam

`explore.mjs` is the first application layer over explicitly projected public objects. It is a rebuildable read/index surface, not a new source ontology or canonical store.

`createExploreApplication()` provides:

- stable semantic-ref resolution independent of transport locator;
- low-latency exact, prefix, substring and deterministic fuzzy search over heterogeneous projected objects;
- world/kind filtering without invoking slow semantic providers;
- typed relation lookup with provenance/origin retained;
- explicit bounded `localWhole()` expansion using depth and node budget;
- `open()` as the search-leaf → local-whole application path;
- `surface()` as a thin browser/agent envelope over the same read model.

The Explore entry is deliberately an indexing/read-model envelope. It retains the native object `ref`, `kind`, containing `world_ref`, revision, provenance and optional transport locators without replacing the underlying Participant, Projection, WikiSpace, WikiNode, Project, SharedField or other source identity.

`fixtures/explore-world-v1.json` is a public-only representative world with one Human stewardship root, one independently addressable Agent, one Project, one projected WikiSpace, three WikiNodes, one Agent-authored Projection and one SharedField. It contains no private `Central/Control` material.

The relation view follows the AIKit/Glade law:

```text
SEARCH LEAF
    ↓ open / recenter
BOUNDED LOCAL WHOLE
```

Relations retain their provider/semantic origin. A `wiki.contains` edge remains a Wiki relation; an O:I projection relation remains an O:I projection relation. Rendering them together does not transfer relation ownership.

## Central public selection

`selectCentralParticipantRoot()` uses a closed public-selection shape:

```text
identity.display_name?
identity.description?
project_refs[]
interest_refs[]
output_refs[]
```

There is no selector for `Central/Control`. The fixture includes private sentinel material under `Control/` and the golden public root proves it never enters the Projection unless a future explicit contract adds a narrower source operation. This matches Central's own invariant that availability does not imply disclosure.

## Existing projection fixtures

`fixtures/golden.json` contains named golden examples for:

- a Central-derived Human Participant Root;
- an Agent participant with Agent/Agency provenance;
- documentation;
- a Software Factory finding/artifact;
- source revision and withdrawal;
- receipt by another O:I instance without source-authorship drift.

Regenerate the derived projection goldens after intentionally changing that contract:

```bash
node shared-field/generate-fixtures.mjs
```

## Verification

Run the complete portable contract, Explore and encounter-security suite from the repository root:

```bash
node --test shared-field/*.test.mjs
```

The shared-agency contract tests cover recursive/nested SharedFields, containment-cycle rejection, Contribution-on-Contribution recursion, ranking and metric Contributions, objective Encounter records, and the minimal Self/Other read model.

The state tests cover nested-field traversal, field-relative membership, arbitrary Contribution-thread depth, ranking/metric querying, deferred-reference cycle rejection, and Encounter history. The Explore tests prove stable refs, provenance/source-revision retention, absence of private Central material, exact/fuzzy search, search → open → bounded local whole, no implicit neighbour payload expansion, and browser/agent parity over the same application read model. Contact/adapter tests prove the portable schema boundary and caller-filtered relationship adapters.

`.github/workflows/shared-field.yml` also pins SpaceTimeDB 2.8.1, builds/publishes the live module, regenerates current TypeScript bindings and runs a multi-identity adversarial fixture covering cross-field mutation, Participant/publisher impersonation, index pollution, direct private-table reads, revocation/expiry and Contact abuse controls.

The transport capability floor remains `publish`, `resolve`, `fetch`, and `subscribe`. A carrier may expose only a subset; capability negotiation does not alter Projection identity.