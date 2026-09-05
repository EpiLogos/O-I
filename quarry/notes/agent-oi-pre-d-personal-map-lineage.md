# agent/oi-pre-d-personal-map-lineage

`origin/agent/oi-pre-d-personal-map-lineage` @ 7bd18d1 (2026-08-19) · 46
commits · Class A QUARRY-DESKTOP (§3) · contains
`agent/oi-epi-personal-return` (= `agent/oi-epi-nara-lived-vertical`).

## What it is

The "pre-D" Personal line: proving that hosted Personal 4/5/0 packets (the
difference-into-ground triad tail: 4→5→0, Workcell→QL→Central in
product-scale notation) retain **one Map lineage** through the whole host
round-trip — from Epi selection packet, through the O:I host, into Central
NOW, and back — with the Nara coordinate binding preserved exactly at every
hop. Read-only NOW history summon ("without leaving the Nara object") plus
the real-Central-owner exercise in Prompt C.

## Feature/function inventory

- **Lineage preservation tests** —
  `desktop/core/tests/personal_return.rs`:
  - `sandboxed_contributions_cannot_enter_personal_dispatch` — sandboxed
    contributions are structurally denied.
  - `personal_action_catalog_remains_epi_owned_and_is_not_a_generic_runtime`:
    the adapter must contain the Epi action refs and must NOT contain
    `struct MCoordinate` / `struct MRelation` — no second Epi ontology.
  - `central_now_receives_only_proposal_refs_and_can_reject_or_promote_only_
    explicit_human_source`: `args.contains("epi:personal:proposal:...")`
    but `!args.contains("PRIVATE PROPOSAL BODY")`; handoff lifecycle
    `waiting → resolved` via reject; promote carries `human-accepted` into
    `ProjectCentral/now/user/accepted.md` with
    `sourceMutationPerformed: false` until the human accepts.
  - `real_epi_personal_provider_round_trip_when_cross_repo_fixture_is_
    supplied`: selection `coordinateBinding` (bimbaSourceRef `#4.4`,
    pratibimba `epi:m-coordinate:M4-4'`, carrier `#4.4.4.4`, review
    `#4.5`) is **identical** across selection → review → ground →
    proposal (`assert_eq!(review["subject"]["coordinateBinding"],
    selection["coordinateBinding"])`); map-ground sourceRefs (`#5`, `#0`)
    carry `sourceRelationAsserted: false` until asserted; relation class
    `implementation-flow` appears only at ground with
    `bimbaSourceRelationAsserted: false`.
- **Joined lineage acceptance** — tip commits: "Validate joined Personal
  packets against source-conformant Map lineage", "Preserve exact Nara
  coordinate binding through host round-trip", "Prove hosted Personal
  4/5/0 packets retain one Map lineage".
- **NOW summon dispatch** — "fix(oi): return directly from Personal summon
  dispatch" + "test(oi): cover read-only NOW history summon": summoning
  Central NOW history is read-only and returns to the Nara object.

## Map-unit mapping

- Proposal-until-recognised lifecycle (`waiting → resolved`;
  `human-accepted`; proposal refs not bodies) → **U3.3 Remember-this**
  (§5 P3: "a remembered note carries generated-provenance until the person
  recognises it — difference returning into ground") — the branch is the
  most complete executable statement of that unit's semantics.
- Personal 4/5/0 triad tail → §2 organising ontology (4→5→0
  difference-into-ground triad) and fog row **Nara/Epi** (§2.4).
- Read-only NOW summon → U3.2 aperture discipline (viewing never mutates).

## Quarry verdict

**KEEP-FOR-UNIT (U3.3) + FOG-NOTE (Nara/Epi)** — the proposal/recognise
state machine and the "refs not bodies cross the seam" law are directly
consumable by U3.3; the coordinate-lineage material feeds the fog row.
