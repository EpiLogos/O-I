# Explore Discovery — Search reveals the living web

**Standing:** lane contract for O:I #18/#306 Search/discovery (SharedField state/discovery lock §3–§4, SF4).
**Companions:** `docs/SHARED-FIELD-STATE-DISCOVERY.md`, `WORLD-PRESENTATION.md`, `expression-presentation.mjs`, `../ai-kit` AIKit knowledge operations.
**Executable contract:** `explore-surface.mjs` (`createExploreSurfaceModel`, `discoverySeed()`); language-neutral twin: `explore-schema-v1.json` (`oi.subject-presentations/v1`, `oi.explore-discovery/v1`).

## The relation

```text
query + current project/root/world context
        ↓
AIKit Search / Resolve · Explore Surface search
        ↓
native ResourceRefs + routes + typed relations
        ↓ presentation resolution
eligible Being / Thing roles
Expression(s) / WorldPresentation(s)
        ↓
local reveal or bounded local whole
        ↓ if projected
the rebuildable Explore index (discovery seed)
        ↓
another World resolves the same semantic refs
```

## Law

- **One read model.** Site, desktop and structured agents consume the same
  surface-neutral application (`createExploreSurfaceModel` over
  `createExploreApplication`). No surface keeps a second scorer over the
  entries.
- **Categories stay distinct.** A subject's reading discloses `roles`
  (Being/Thing presentation roles), `expressions`, `world_presentations`,
  `projections` and `field_occurrences` (the live SharedField an entry is
  hosted in). No aggregate identity is minted; each category names its own
  kind of stable ref.
- **Roles come from structured bindings only.** `presentation_role` is read
  from the Expression composition/expression props inside an admitted
  `oi.presentation/expression/v1` binding; a binding without a role claims
  none. Labels, kinds and DOM are never evidence. There is no DOM scraping
  anywhere on this path.
- **Eligibility never gates addressability.** A withheld/unavailable subject
  claims no role; the Expression and entries stay searchable. Degraded
  presentation resolution degrades to plain entry search and the fault is
  disclosed (`searchModelFault()` on the desktop), never silently swallowed.
- **The index is derived and rebuildable.** Typed relation adjacency and the
  alias→ref map are derived at index build from the admitted entries and
  relations; the relations themselves remain the only relation state.
  `localWhole` stays bounded and shows only admitted edges.
- **Aliases resolve, they never duplicate.** `resolveRefOrAlias` maps an
  admitted alias to the canonical entry; a second ref is never minted.
- **History rides the same refs.** Selection is a ref; travel (desktop) and
  AIKit familiarity both record and return to the exact refs the search
  revealed.

## The discovery export

`discoverySeed()` emits `oi.explore-discovery/v1`: stable entry refs with
aliases, typed relations, the structured presentation join (presentation →
subjects with roles/availability, Projection ref/revision/state), the
entry/relation → SharedField membership maps, and the bounded field records.
Payloads are excluded. One World exports it; AIKit materialises the same refs
through its existing SemanticWiki knowledge operations
(`aikit-adapters::oi_explore`), so `aikit knowledge search / relations / open`
and `aikit search` resolve byte-identical semantic refs and record familiarity
on them — History returns through the same refs.

**Carrier placement.** The discovery export lives next to the public seed it
derives from: `site/public/data/explore-discovery.json` in the O-I checkout
(committed empty and regenerated whenever projections publish — see
`site/explore-discovery-carrier.test.mjs`, which proves the file is exactly
`discoverySeed()` of `explore-public.json` and round-trips into another
World's Explore application). AIKit's materialisation
(`aikit-adapters::oi_explore`, landed through ai-kit #321) reads that carrier
by default, or the file named by `OI_EXPLORE_DISCOVERY`; an absent seed is
ordinary — nothing is indexed until a World actually exported a projected
field — and never gates addressability. Compilation joins the existing
SemanticWiki rebuild: entries become nodes carrying kind, world context,
entry revision, aliases and the Projection ref in the namespaced
`oi.explore/v1` extension; exported relations stay edges with the relation
name verbatim (origin Compiled); presentations become addressable
presentation nodes with derived `presents` edges per presented subject;
SharedField membership compiles to `projected-in` edges. Refusals (invalid
refs, unknown endpoints, duplicate rows) are disclosed as absences and
skipped, never silently invented, and never become synthetic nodes.

## What this contract does not do

- It does not create a second search system, graph store or discovery
  ontology; AIKit Search/Resolve remains the discovery relation.
- It does not let a presentation, a Projection or a SharedField occurrence
  become canonical source, Wiki truth or native identity.
- Semantic/vector/graph enrichment may build on the discovery seed, but
  nothing here depends on it.
