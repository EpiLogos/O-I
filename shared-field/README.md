# O:I shared-field implementation floor

This directory is the smallest executable form of the local-first seam specified in `docs/SHARED-FIELD.md`.

It deliberately has no framework, network client, database, or identity provider. Native products still own their canonical objects. O:I defines only the whole-level relation by which an explicitly selected representation can cross a product/world boundary.

## Contracts

- `oi.participant/v1` — a field-relative relation over an existing `Human` identity or `AgentRef`.
- `oi.projection/v1` — a versioned, transport-neutral envelope preserving native subject kind, source system/revision, publisher, audience, representation and provenance.
- `oi.projection-receipt/v1` — a receiver-side observation that preserves source authorship/provenance and explicitly grants no source mutation authority.
- `oi.sparse-representation/v1` — a deliberately small browser representation format. It is a representation of a typed Projection, not the Projection's semantic type.

`transport` is optional non-canonical metadata. `canonicalProjection()` and `projectionSemanticIdentity()` intentionally exclude it.

Projection revisions are distinct from source revisions. A revision exposes source drift through `source.revision`; withdrawal creates a new Projection revision without deleting source history.

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

## Fixtures

`fixtures/golden.json` contains named golden examples for:

- a Central-derived Human Participant Root;
- an Agent participant with Agent/Agency provenance;
- documentation;
- a Software Factory finding/artifact;
- source revision and withdrawal;
- receipt by another O:I instance without source-authorship drift.

Regenerate the derived goldens after intentionally changing the contract:

```bash
node shared-field/generate-fixtures.mjs
```

Run the contract tests from the repository root:

```bash
node --test shared-field/shared-field.test.mjs
```

The transport capability floor is `publish`, `resolve`, `fetch`, and `subscribe`. A carrier may expose only a subset; capability negotiation does not alter Projection identity. Presence and dialogue remain outside this implementation floor.
