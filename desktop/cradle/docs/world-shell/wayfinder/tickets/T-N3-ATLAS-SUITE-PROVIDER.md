# T-N3-ATLAS-SUITE-PROVIDER — the atlas reads the suite, never its old corpus

FOUNDATION §3 N3 (owner, 14 Oct: Archetypal-Earth is refit onto the suite's
data model; it replaces the frame's Places map and holds the palaces). The
lead's design, derived from the owner ops run on 14 Oct 2026 (below); a module
builder (Sonnet) builds it after T-ATLAS-ASSETS, whose zone it shares.

## Realises

- Manual `docs/dlw/DLW.md` §8: "Everything starts from the world … Turn the
  world to its graph side and the same material lays out by connection, each
  thing coloured by what it is, the ties between them showing what joins
  them." "Everything you place carries its source and its owner, so a reader
  can always go back and check." §5: "Turn to the world instrument and Central
  is your planet. Projects are places on its surface."
- Lock §0.1.2–3 (each mode's material reads through the planet grammar;
  Technē's 0 instrument is the Earth and solar system with its graph view),
  §7 (AE is the instrument pattern), §8.4 (port the code, not the shortcuts).
- Craft floor: the ported atlas itself (61 files verbatim) — the provider
  changes what it reads, never how it draws.

## What the owners return (run 14 Oct 2026, private walk-bridge, channel scripted)

`POST /op {"op":"graph","query":""}` (kernel `KernelOp::Graph`,
`desktop/cradle/kernel/src/lib.rs:459`, reading schema in `graph.rs:252`):

- 48 nodes, 94 edges. Inputs: `central_wiki` available (5 wiki nodes, 1
  space with 15 child project spaces), `shared_field` available (42 hosted
  rows: 18 `hosted-practice`, 7 `hosted-wiki-node`, 5 `hosted-wiki-space`, 4
  `hosted-curated-artifact`, 3 `hosted-world-position`, 2 `hosted-workcell`,
  2 `hosted-central-world`, 1 `hosted-activity`), `aikit_resolution`
  unavailable ("AIKit knowledge read did not return within 20 seconds"),
  `wiki_links` deferred.
- Relations: `space-child-space` 15, `node-source` 14, `oi.world/practises`
  18, `wiki.contains` 7, `wiki.edge/references` 6, `node-space` 5,
  `space-node` 5, `oi.world/wiki-space` 5, `oi.world/artifact` 4,
  `wiki.edge/explains` 4, `oi.world/position` 3, `oi.world/workcell` 2,
  `oi.world/carried-by` 2, `wiki.edge/re-sites` 2, `oi.world/activity` 1,
  `wiki.edge/follows-pattern-of` 1.
- Every node carries only `ref`, `kind`, `label`, `native_owner`,
  `provenance {source, detail, revision}`, `actions`. **No node carries a time
  or a place.**
- Timing: all inputs 88 s cold; `options.input` = `central_wiki` 10 s fresh
  (cached after), `shared_field` 2 s, `aikit_resolution` 20 s timeout.

Places: every owner wiki (`Control/agents/wiki/wiki.json` and the 16 project
wikis) holds 11 nodes in all, and **none declares a `place` facet**
(`WikiPlaceFacet`, `desktop/cradle/src/techne/wikiReading.ts`). The geography
the suite can carry comes from (a) a wiki node's own declared `place`
(read by `desktop/cradle/src/techne/placeFacets.ts`), and (b) a Technē
reading's place facets with the hard relations kept verbatim
(`desktop/cradle/src/techne/m0m5/place/world.ts`: OCCURRED_AT, LOCATED_IN,
OPERATED_IN, TRAVELLED_TO, MYTH_LOCATED_AT).

## The mapping (the atlas's `Field`, `packages/live-shell/ui/src/projections/atlas/src/types/field.ts`)

| Atlas | Suite source | Rule |
|---|---|---|
| Archetype (the top tier the field colours by) | a world register: your Central root (`central:wiki:root`), each project space (`central:wiki:project:<P>`), each hosted world (`hosted-central-world`) | label = the owner's title; palette derived from the ref, stable |
| Family (what a thing is) | the node `kind` within its owner (`wiki-node:<node_type>`, `hosted-practice`, `hosted-curated-artifact`, …) | tied to its register's archetype with basis `site` (owner-declared edge: `space-node`, `oi.world/*`) |
| Occurrence (a thing, placed) | each subject node: wiki nodes, hosted rows, and Technē place facets | `subject_ref` = the owner ref; `basis` = `{ref, revision}` from provenance (as `projections/occurrence.ts` already does); `place`/`lat`/`lon`/`geoPrecision` only from a declared place or a Technē place facet, otherwise `geoPrecision: 'none'` and unlocated (an honest state, never filled); time only from a declared `valid_from`/temporal facet, otherwise undated (record the atlas adaptation that lets an undated occurrence stand outside the time scale) |
| Occurrence parallels | `wiki.edge/*` relations between subjects | relation name kept on the join |
| Technē occurrence | a `ql.techne/v1` place facet | the relation verbatim on the occurrence; MYTH_LOCATED_AT never becomes a historical locus (locusType `myth-episode` vs `historical-event`) |
| Place (the atlas's place list) | each project space (your planet's places) and each declared place | unlocated on Earth until it declares a place |
| Sky | the QL sky producer (`DEVICE-SEMANTICS-LOCK.md` §7; `provider/skyProvider.ts`) | bind the producer the kernel already reads; unbound stays named, never faked |
| Cultures, theoretics | none from the suite yet | empty arrays, honest |

## Work

1. `projections/atlas/provider/suiteProvider.ts`: one provider, id `suite`,
   name "Your world", registered as the default. It reads the kernel `Graph`
   op through the transport the atlas host already holds, **per input**
   (`central_wiki`, then `shared_field`, then `aikit_resolution`) and
   composes the field as each arrives; an unavailable input is named in the
   atlas's absent state with the owner's own `detail`. Use the atlas's
   existing refresh seam (see `tests/atlas-occurrence-refresh.test.mjs`)
   rather than a new one.
2. Place facets: wiki `place` declarations through `techne/placeFacets.ts`
   (verbatim), and the open Technē reading's place facets when one is open.
3. Retire `archetypalEarthProvider.ts` as a source (AE's bundled corpus stops
   being read). Keep the fixture provider for the dev harness and tests.
4. Tests over a recorded Graph reading (save the real 14 Oct reading's shape
   as a committed fixture with the labels as recorded — it is owner data the
   owner already publishes to the shared field and the root wiki): every
   occurrence has an owner ref and basis; no occurrence is located without a
   declared place; the hard relations survive verbatim; an unavailable input
   is named.

## Zone

`packages/live-shell/ui/src/projections/atlas/provider/**`,
`packages/live-shell/ui/src/projections/atlas/AtlasProjectionPanel.tsx` (the
provider wiring and absent-state text only), the atlas PORT-PIN, new tests
`packages/live-shell/ui/tests/atlas-suite-provider*.test.mjs` and their fixture.

## Done when

- On screen (lead): Technē › Earth mounts; its Graph side shows the owner's
  subjects (Central's wiki nodes, the project places, the shared field's
  rows), each revealing its owner ref; the Earth side names how many are
  unlocated rather than drawing them anywhere.
- The Places browser category lists the project places (PORT-AUDIT M10).
