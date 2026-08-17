# O:I Common Referent / Reconciliation v1

Status: first implementation contract for #57. This layer is deliberately downstream of the Phase-2 caller-visible Explore boundary and is independent of #43 Phase 3 / Phase 4.

## Identity law

```text
CommonReferent
    != source object
    != file/blob
    != representation
    != source revision
    != Projection
    != Participant/publisher
    != ownership/licence/authority
    != AIKit WikiNode / Source / KnowledgeRoute
```

`CommonReferent` is a stable referential pole over attributable `ReferentBinding`s. The bindings preserve the concrete members. The aggregate is a rebuildable mediation/read model; it is not a destructive deduplication store.

## Hosted boundary

The first hosted implementation intentionally adds no second database and no globally queryable digest index.

SpaceTimeDB remains authoritative for SharedField, Participant, Projection, Contribution, Admission/index policy and caller visibility. The reconciler consumes only the rows the existing caller-filtered `projection`, `contribution`, `explore_entry` and `explore_relation` Views disclose to the current runtime caller.

Therefore ordinary reconciliation has this gate:

```text
hosted authoritative state
        ↓
current caller/audience visibility
        +
Explore/index eligibility
        ↓
caller-bounded reconciliation horizon
        ↓
CommonReferent read model
```

For Contributions, presence as an Explore entry proves the Phase-2 sequence `admitted + index eligible`; a visible admitted Contribution without an Explore entry is ignored by reconciliation. For Projections, the reconciler likewise requires both a current visible published Projection row and a corresponding visible Explore entry.

This structure makes the privacy boundary compositional: the reconciliation layer never receives hidden rows from which to compute hidden digest collisions, hidden member counts, hidden provenance or hidden candidate suggestions.

## Exact representation rule

The only automatic v1 binding is exact representation equality when the representation carries inspectable exact bytes.

Supported exact byte carriers are:

- a direct string payload, hashed as exact UTF-8 bytes;
- `{ "bytes_base64": "..." }`, decoded strictly and hashed as bytes;
- `{ "text": "...", "encoding": "utf-8" }`;
- a JSON byte array whose members are integers `0..255`.

The digest method is SHA-256 over those exact bytes.

A caller-supplied `digest` field is never trusted. Arbitrary structured JSON is not canonicalised into a byte identity. Ref-only representations are not automatically digested by this layer.

An exact digest creates an automatic `same-representation` binding only. It does **not** assert universal semantic identity, authorship, authority, truth or licence. The opaque O:I `ReferentRef` is service-derived from the exact-equality evidence namespace rather than treating a digest field as the source object's semantic identifier.

## Attributable semantic reconciliation

Cross-format or semantic reconciliation reuses `oi.contribution/v1`; it does not create a second social/claim ontology.

A proposed claim is an indexed visible Contribution shaped as:

```json
{
  "target": { "ref": "projection:A", "kind": "projection" },
  "relation": {
    "kind": "claims-same-referent",
    "with": { "ref": "projection:B", "kind": "projection" },
    "relation_kind": "same-resource"
  }
}
```

Supported attributable relation kinds are:

- `same-resource` / `same-referent`;
- `version-of`;
- `variant-form-of`;
- `translation-of`;
- `derived-from`.

A claim alone remains proposed. Even an attacker-authored `accepts-same-referent` Contribution is not reconciliation authority. The application is given the current receiving-side mediation Participant set; only an indexed visible decision authored by one of those configured mediation Participants may accept the claim. A visible indexed `disputes-same-referent` Contribution keeps the candidate disputed and prevents the accepted binding from taking effect in v1.

This is deliberately stricter than Admission: `admitted != semantically reconciled` and `index eligible != semantically reconciled`.

## Evidence ladder

Evidence remains inspectable and typed. It is not collapsed into a hidden universal confidence score.

Strong evidence categories represented by the v1 contract include:

- exact cryptographic representation digest;
- durable domain identifier;
- source-native identity/version lineage;
- attributable source/publisher assertion;
- structured provenance/metadata agreement;
- receiving-side attributable reconciliation decision.

Weak evidence categories are:

- fuzzy metadata/title similarity;
- semantic/embedding similarity.

`createSimilarityCandidate()` accepts weak evidence only and always returns a proposed candidate with `automatic_binding_eligible=false`. Search/fuzzy/embedding similarity never creates an accepted binding.

## Explore/search read model

`createReferentExploreApplication()` wraps the current Explore application and adds common-referent search/open/explain semantics without replacing the underlying objects.

A referent reading exposes:

```text
COMMON
FORMS
VERSIONS
PROJECTIONS
PROVENANCE
RELATIONS
CONTRIBUTIONS
```

The display heading and representative are deterministic caller-visible presentation choices, explicitly marked as mediation rather than canonical truth.

Search groups visible member results by `ReferentRef` and uses the best visible member's text score. The number of copies or holders never boosts ranking. Ten identical public holdings therefore produce one common result while the aggregate still reports ten visible projected holdings.

Counts are named `visible_*` and are calculated only from the caller horizon. No hidden-member count is computed.

## Privacy-oracle law

There is no digest lookup operation in the public API.

For `PUBLIC A + PRIVATE B` with exact bytes, a caller who can see only A receives the same common pole derivable from A but sees exactly one visible holding and no B ref, provenance, count, candidate or ranking signal.

For disjoint `PRIVATE B + PRIVATE C`, each authorised caller can independently derive the same pole from bytes they are already entitled to see, but each receives one visible holding. A stranger with no visible member cannot resolve that pole at all.

The permanent provider fixture proves this over real SpaceTimeDB caller-filtered Views, not over a simulated ACL layer.

## Withdrawal and rebuild

Only current published visible Projection rows participate. Withdrawal therefore removes the form from the caller aggregate without erasing another independent holding.

Automatic exact `ReferentRef` and `binding_ref` values are deterministic functions of versioned reconciliation rules and visible evidence. Reconstructing the derived layer from the same authoritative hosted rows reproduces them exactly. No client-only dedupe database is required to survive an index rebuild.

Explicit cross-form reconciliation remains grounded in admitted/indexed Contribution claims and receiving-side mediation decisions, so its stable state is likewise in authoritative shared-field history rather than an embedding/search index.

## Personal curation

The aggregate supports caller-local read ordering by publisher/source, revision, exact representation digest, local holding, language/form and explicit Projection ref. Preference changes only which eligible concrete form is presented/selected first. It does not change CommonReferent identity, trust, authority, ownership or semantic truth.

The read model exposes both a Referent Watch intent and concrete Projection Watch intents while retaining the existing law `Watch != trust`. Current hosted `put_watch` validates targets against stored Explore entries, so persistent hosted Referent Watch needs a later mediation adapter rather than weakening that target-existence/security check in #57.

## AIKit boundary

This implementation consumes the current AIKit V2 Knowledge Navigation law without editing the active AIKit line:

- SemanticWiki identity remains Wiki-owned and provider/index independent;
- Knowledge Navigation remains federation rather than a universal graph;
- provider relation meanings remain provider-owned;
- `KnowledgeRoute` records actual traversal and does not manufacture source/Wiki truth.

The O:I `oi.referent-resolution/v1` request takes one `referent_ref` plus concrete-form constraints and returns one selected eligible form plus metadata-only alternatives. `load=true` means `selected-only`: one Context request for a referent does not load every duplicate representation.

No AIKit Wiki ontology or second SourcePool/ProjectMap identity layer is introduced by #57.

## Browser topology

The current live React front door is on the independent `site/public-front-door` line. It presently describes Explore as an active parallel programme and renders the Self/Other proof; it does not yet contain a canonical Explore result/object page on the Phase-2 security ancestry.

`site/referent-read-model.mjs` therefore provides a tested browser-neutral projection of the common-referent aggregate. It can be consumed when the front-door and Explore presentation lines converge, without merging that active parallel branch into this security-sensitive implementation PR.
