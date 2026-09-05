# agent/explore-projection-space

`origin/agent/explore-projection-space` @ d4334a2 (2026-08-18) · 47 commits ·
Class E SUPERSEDED-CANDIDATE (§3) — "SpaceTimeDB/Explore live-probe work,
quarry (Encounter security line) then owner rules".

## What it is

The Explore/Projection programme (#18) in one line: a portable
WorldPresentation representation carried by an explicit `oi.projection/v1`
envelope, a working-authoring/ratification algebra, a deterministic
bounded graph layout, and a **live SpaceTimeDB bridge** that feeds the
same Explore Surface model from a hosted SharedField endpoint — proven
round-trip in CI with pinned generated bindings. Half of it is the
public-site/desktop Explore surface; the other half is the only existing
live-probe of SpaceTimeDB as a shared-field transport.

## Feature/function inventory

- **WorldPresentation contract** — `shared-field/WORLD-PRESENTATION.md`:
  governing chain "native source world → explicit oi.projection/v1 →
  WorldPresentation representation → composition bindings → accepted
  local renderer (web Explore | O:I desktop | another Surface)";
  "The Projection remains the public/shared representation envelope. The
  native source retains canonical ownership." Explicitly does NOT create
  a new profile/site ontology or replace AIKit Component/Surface
  semantics.
- **Projection revision algebra** —
  `shared-field/presentation-projection.mjs` + tests:
  - "world presentation is a Projection representation, not source
    identity" (`value.source.revision === 'central@7'` while the
    representation carries its own revision).
  - "human edit creates a new attributable Projection revision without
    rewriting source": `projection_revision: 2`, `supersedes:
    {projection_revision: 1, source_revision: 'central@7'}`, provenance
    kind `human-refinement`.
  - "working representation ratifies from W1 to W2 when the draft
    intentionally retains the published revision".
  - Guards: `world_ref must match Projection subject.ref` (no silent
    world switch); `presentation_ref must remain stable`; revision
    cannot drift backwards during refinement.
- **Deterministic bounded graph layout** —
  `site/src/explore/relation-layout.mjs` + tests: "places the canonical
  focus at the centre without changing relation identity" (focus at
  (500,300), tier 0; edge `wiki.contains` with `origin: 'authored'`
  preserved; node/edge counts unchanged); "recentring is a new visual
  projection of the supplied relation state"; "layout is deterministic
  for the same bounded relation state" (`deepEqual` of two builds).
- **Live SpaceTimeDB bridge** —
  `shared-field/spacetimedb-explore-surface.mjs` + tests: "hosted
  SpaceTimeDB snapshot becomes the existing Explore Surface seed without
  implementation identity leakage" (`seed.schema
  'oi.explore-browser-seed/v1'`, `!('implementation' in seed)`);
  "subscribed WorldPresentation Projection renders through the same
  Explore Surface model"; `shared-field/spacetimedb/explore-surface-live-
  acceptance.ts` + CI ("Prove live SpaceTimeDB to Explore Surface
  round trip", pinned generated browser bindings, "Match generated
  SpaceTimeDB disconnect signature").
- **Honest emptiness** — "Keep public Explore empty until real
  projections arrive" / "Remove invented public Explore projection
  content": the public surface ships empty rather than fabricating
  content — law 10 before the law existed.
- **Desktop pane grammar** — "Make desktop Explore navigator flexible and
  collapsible", "Complete flexible desktop Explore pane layout": the
  Explore pane as a first-class collapsible surface.

## Map-unit mapping

- Projection revision algebra + supersedes/provenance chains → **U3.4
  Wiki graph surface** and the two-state-layer kernel law (§2.2 row 1:
  local buffer vs canonical revision — the same discipline at
  presentation level); also informs U1.2/U1.3 revision semantics.
- Deterministic focus-centred layout → **U3.4** walk metrics (render
  distance/transition discipline, D21 node/line idiom).
- Working-authoring + ratification → **U3.5** world crafting (amend →
  ratify through owner operations) and W-waypoint D19 workspace autosave
  shape (working vs published state).
- SpaceTimeDB live bridge → the **Encounter security line**
  (`docs/ENCOUNTER-SECURITY-SPACETIMEDB-CONFORMANCE.md` on main) and fog
  row **Gateway continuity / SharedField admission** (§2.4): this branch
  is the only live evidence that a hosted SharedField endpoint can feed
  an O:I surface without leaking implementation identity.

## Quarry verdict

**KEEP-FOR-UNIT (U3.4: layout + projection algebra) + FOG-NOTE
(Gateway/SpaceTimeDB live probe)** — the presentation-revision guards and
deterministic layout are directly consumable; the SpaceTimeDB findings go
to the Encounter security line. Owner rules the rest per §3 Class E.
