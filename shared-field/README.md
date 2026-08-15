# O:I shared-field implementation floor

This directory is the smallest executable form of the local-first seam specified in `docs/SHARED-FIELD.md` and `docs/OBJECTIVE-CO-INTERNALITY.md`.

It deliberately has no framework, network client, database, or identity provider. Native products still own their canonical objects. O:I defines only the whole-level relations by which explicitly selected representations cross product/world boundaries and by which independently grounded Participants can become mutually available through a SharedField.

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

Run the projection and shared-agency contract tests from the repository root:

```bash
node --test shared-field/shared-field.test.mjs shared-field/social.test.mjs
```

The shared-agency tests cover recursive/nested SharedFields, cycle rejection, Contribution-on-Contribution recursion, ranking and metric Contributions, objective Encounter records, and the minimal Self/Other read model.

The transport capability floor remains `publish`, `resolve`, `fetch`, and `subscribe`. A carrier may expose only a subset; capability negotiation does not alter Projection identity. Live Presence/Activity and hosted delivery remain downstream service concerns.
