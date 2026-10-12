# Lane 4 — M4′ World/Places — current-state findings

Campaign: 2026-10-07 technè instrument RE programme · lane 4 of 5.
Owner's bar: "basically a Google Earth clone that we want, plus the data
viewing layers overtop."
Status: **Phase 1 complete** (static read, 2026-10-07). Evidence is
`file:line` as read on this pass; confidence and limitations named inline
and in §6.

## Method

Read-only survey of `Work/O-I/desktop/cradle/`: `src/techne/m0m5/place/` in
full (world, modes, project, filter, register), the facet producers
(`placeFacets.ts`, `spatialFacets.ts`, `wikiReadingProvider.ts`), the hosted
mount (`expressions-app/field-studies-journeys/src/researchInstruments.tsx`,
`placeFacetsPanel.tsx`, `placeReading.ts`), the vendored Research Canvas map
surface (`expressions-app/vendor/research-canvas/`, PROVENANCE +
PsychogeographicMap + renderer + mapStyle + geography pack), the save paths
(`kernel/src/construction.rs`, `src/knowledge/wikiFacts.ts`,
`researchMaterial.ts`, `tests/place-set-action-native.test.mjs`) and the
kernel provider legs (`kernel/src/m3_reception.rs`, `nara_presence.rs`,
`NaraCurrentSky.tsx`). package.json + repo-wide grep for cesium / mapbox /
maplibre / leaflet / globe / terrain / satellite / three. Every claim carries
file:line evidence + confidence. Unverified items named in §6.

## 0. Where M4′ actually lives (the survey's headline)

The place instrument has **three bodies**, mirroring lane 2's finding for M2′
(../lane-2-timeline/FINDINGS.md §0):

1. **The cradle's pure models** — `desktop/cradle/src/techne/m0m5/place/`
   (world.ts 471 l, modes.ts 354 l, project.ts 262 l, filter.ts 156 l,
   register.ts 59 l). Epistemically honest: the hard geography relations,
   precision-as-data, validity filtering that never re-mints identity,
   provider-bound depth chain. Confidence: high (all five files read in
   full).
2. **The vendored Research Canvas map surface** —
   `desktop/cradle/expressions-app/vendor/research-canvas/` (PROVENANCE.json
   records source "Research Canvas / Antichrist Project", revision
   `7df35f822f9235331a69940cdaf484fe4a0b95c1`, byte-exact except recorded
   capability/offline patches). This holds the **interaction-rich globe**:
   `PsychogeographicMap.tsx` (567 l) on **maplibre-gl** with a
   globe/mercator projection toggle, place markers, movement lanes,
   archetype-expression markers, an offline GeoJSON basemap and an explicit
   live-tile opt-in policy. Exported for the host at
   `vendor/research-canvas/components.ts` (PsychogeographicMap,
   StreetViewSurface, loadBundledGeographyPack). Confidence: high.
3. **The mount** — `desktop/cradle/expressions-app/field-studies-journeys/
   src/researchInstruments.tsx` (697 l), instrument id `'m4'`
   (`ResearchInstrument='m1'|'m2'|'m4'`, line 101), which reads one native
   ql.techne/v1 reading, bridges spatial facets to Place nodes through
   `vendor/research-canvas/packages/desktop-api/src/techneBundle.ts`
   (`spatial[i] → Place GraphNode`, line 532-538), and mounts
   PsychogeographicMap + PlaceFacetsPanel + ImageryPanel
   (lines 664-676). Plus the facet panel itself
   (`field-studies-journeys/src/placeFacetsPanel.tsx` 170 l +
   `placeReading.ts` 112 l), which renders over the cradle's pure models
   directly (`../../../src/techne/m0m5/place/*`, placeFacetsPanel.tsx:16-18).
   Confidence: high.

The cradle's placement law stands at `src/techne/TechneCentre.tsx:1-2`:
"Technè operates inside the hosted Expressions application. The cradle
supplies owner readings; it never replaces the field with another lens UI."

## 1. What exists in the place instrument today

**Contract and instrument registration.** Place is M4′ of the constellation:
`src/techne/instruments.ts:34` — `{instrument: "place", mPrime: 4, label:
"World · Places", office: "the world's places", glyph: "home"}`. The
ql.techne/v1 reading carries `spatial?: TechnePlaceFacet[]`
(`src/techne/contract.ts:374`), validated by `validatePlaceFacet`
(contract.ts:827). The DisclosureSession carries `time_window` and
`spatial_focus_ref` (contract.ts:859, 869) — the shared spatial focus is
already a session-level concept.

**The hard geography law.** `src/techne/m0m5/place/world.ts:46-52` pins
`GEOGRAPHY_RELATIONS` = OCCURRED_AT, LOCATED_IN, OPERATED_IN, TRAVELLED_TO,
MYTH_LOCATED_AT, "preserved verbatim … never interchangeable"
(world.ts:8-13). `relationStandingClass` (world.ts:68-72) classifies for
visual distinction only: factual / mythic / owner-vocabulary — it "never
rewrites the relation itself and never upgrades standing" (world.ts:60-66).
Confidence: high.

**Place identity independent of coordinates.** An unlocated place is an
honest state, not a defect (world.ts:16-18; project.ts renders it in an
explicit "no coordinate" register slot, project.ts:186-194). Precision is
data with four renderings — exact→solid, approximate→halo, region→outline,
unlocated→no-coordinate — and "the marker kind is derived from the facet's
own precision and never upgraded to look nicer" (project.ts:8-10, 75-86).
Confidence: high.

**Three presentation modes over one facet list.** `modes.ts:30-32` —
`map | globe | street`, "pure view transforms over the SAME facet list"
(modes.ts:2-7). `renderGlobeModel` is a pure orthographic front-hemisphere
projection, "simple orthographic disc projection … pure math, no basemap"
(modes.ts:8-9, 146-164); it draws points, polygon rings clipped at the limb,
and hierarchy edges (modes.ts:166-238). `renderStreetModel` is the
single-place detail (identity, precision note, hierarchy rows, source,
observer frame, validity; modes.ts:276-332). `renderForMode` dispatches
(modes.ts:341-348). Confidence: high. Limitation: these models are consumed
today by the hosted panel (street + equirect helpers) and by
`tests/techne-place-facets.test.mjs`; the cradle shell has no direct React
consumer of `renderGlobeModel` (grep for importers: only the test).

**Time validity filter.** `filter.ts:22-28` defines `TimeWindow {from,to}`
with ISO-8601 bounds; `expandTimestamp` (filter.ts:47-64) widens partial
timestamps ("1675" → the full year span) per interval edge;
`coversEdge`/`validInWindow` (filter.ts:90-118) test interval-meets-window;
`placesInWindow` returns "the SAME objects, in the SAME order" — "filtering
NEVER changes identity" (filter.ts:9-14, 129-131). `nameInWindow`
(filter.ts:138-144) resolves the standing identity name per its own
validity. Confidence: high.

**Movement (route) ordering.** `routeModel` (world.ts:132-162) orders
georeferenced TRAVELLED_TO facets by their own valid_from bounds — "a
PRESENTATION ordering of the reading's own facets … no route identity is
minted here" (world.ts:128-131); fewer than two stops is null, "never a
forced path". Confidence: high.

**The reference-frame depth chain.** `depthChain` (world.ts:257-300) renders
M1 harmonic (disclosed only when the warranted QL facet carries it) and
M2 planetary / M3 world-clock / M4 EarthBody-Nara as `producer-unavailable`
with exact structural reasons: the producers "are landed as Rust libraries
in this repo (`crates/ql-mef/src/m2.rs`, `m2_condition.rs`, `m3_state.rs`,
`nara.rs`) but expose no service, CLI or transport leg a renderer surface
could call" (world.ts:225-245) — **note**: that scouting note (2026-09-16)
refers to the QL-MEF repo, which is not in the O-I tree; from the cradle the
kernel legs that DO exist are named in §4. `referenceFrameLadder`
(world.ts:321-370) gives the five-rung scale ladder: solar/planetary →
Earth/shared occasion → geography → region/place/route → Nara/situated —
"Nothing is fabricated to complete the ladder" (world.ts:315-319).
`carriedOccasion` (world.ts:182-198) reads the DAY/NOW/session/run refs the
reading already bears, computing nothing about time. Confidence: high.

**The producer path (where spatial facets come from).** Two derivations, no
invented coordinates:

- Register-wide: `placeFacetsFromReading`
  (`src/techne/placeFacets.ts`) derives facets from (1) wiki relations of
  the hard geography set (relation preserved VERBATIM, enriched by the
  target node's own declaration) and (2) wiki nodes that DECLARE a place
  (`node.place` or `type:"place"`); "a declaration with no geometry stays
  precision 'unlocated'"; a declared geometry without a declared precision
  stays "approximate", "never silently upgraded to 'exact'"
  (placeFacets.ts header + `declaredFacet`).
- Canonical declared PlaceSets: `readWikiSpatial`
  (`src/techne/spatialFacets.ts:11-39`) parses `aikit.techne-facet/v1`
  spatial declarations from the register's wiki source, validating each
  facet through `validatePlaceFacet`;
  `sceneSpatialFacets` (spatialFacets.ts:40-72) resolves the scene-scoped
  canonical facets against the live document with provenance
  (`native_owner:'wiki'`, selector `techne-spatial-facet`), refusing
  conflicting native readings of one place (spatialFacets.ts:66).

**The reading provider.** `wikiReadingPayload`
(`src/techne/wikiReadingProvider.ts:141-204`) builds the ql.techne/v1 wire
payload with `spatial` (line 162, 201) and the disclosure: "place available
exactly when the reading discloses a real spatial facet … a truly absent
spatial facet stays absent, with the real reason" (lines 113-135,
disclosure entry at 128-129). `readWikiSceneTechne` (lines 300-352) reads
the exact native Scene, merges canonical `declaredSpatial` with
register-derived facets (wikiSceneReadingPayload line 389), and refuses on
any source-revision drift ("This Scene's source revision changed …",
line 333) rather than drifting identity. Confidence: high.

**Capability honesty at the aperture.** `placeState` (modes.ts:61-72) derives
no-reading / unavailable (with the reading's own reason) / empty / present —
"an absent facet field is data — an empty honest state, not an error"
(modes.ts:13-15). Confidence: high.

## 2. How place state saves today

**Canonical place facts save through the Wiki owner via `place_set`.** Two
native actions accept it:

- `aikit.constellation-action/v1` — a `place_set` change on a participation
  writes canonical `TechnePlaceFacet` lists under the member's
  `aikit.techne-facet/v1` key. Evidence: the native regression
  `tests/place-set-action-native.test.mjs` (gated on OI_NATIVE_PLACE_SET_ACTION)
  creates a constellation through `aikit.constellation.apply` with
  `changes:[{change:'place_set', participation_ref, places:[{place_ref,
  geometry:{type:'point',coordinates:[-0.09,51.51]}, precision:'exact',
  source_ref}]}]` (line 26-27) and asserts the persisted shape
  `frame.constellations[0].members[0]['aikit.techne-facet/v1'].spatial`
  (line 60-62). The kernel maps the change: `kernel/src/construction.rs:146`
  — `Some("place_set") => "places"`.
- `aikit.wiki-facts-action/v1` — the register-level facts writer pairs
  `temporal_set`/`place_set` with validators
  (`src/knowledge/wikiFacts.ts:36`), with a retained pending-operation
  checkpoint law (wikiFacts.ts:95: a retained operation must re-validate
  against the captured draft and expected revision).

**Source-basis law on every place write.** The action admits "one current
source basis and refuses missing, ambiguous or stale evidence"
(test title, place-set-action-native.test.mjs:1-8): zero, duplicate or
conflicting-revision source bases → `owner_refused` "unique disclosed source
basis"; a stale observed revision → `owner_refused`
`source_revision_conflict`; nested provenance is NOT exempt ("the
PlaceFacet exception does not exempt nested evidence", test lines 33-40);
refusals do not write the Wiki (byte-compare, test lines 36-40). Confidence:
high (executable test in the repo; not run in this pass — named in §6).

**Renderer-side editing UI.** The constellation/source-editor forms edit
place facts: `src/knowledge/ParticipationFacts.tsx:33-36` (per-fact name,
precision enum exact/approximate/region/unlocated, add-place button, each
fact carrying a `source_ref` from the disclosed sources);
`src/knowledge/constructionDraft.ts:87` maps held spatial facets to
`place_set` changes in drafts. **The map surface itself has no
create/edit-placemark UI** — the hosted panel explicitly "never writes a
coordinate itself" and "Edit place/time" opens the SAME native
constellation-authoring route "Edit constellation" uses
(placeFacetsPanel.tsx:6-10, 25-41; researchInstruments.tsx:648-653).
Confidence: high.

**Presentation state saves per Scene as `oi.research-scene/v1` research
material.** `researchMaterial.ts:24-31` defines `ResearchMaterial` — cards,
strokes, `views:Record<string,ResearchViewport>` (viewport = {x,y,zoom}),
timeline layouts, frames, namedViews — validated strictly (256 KiB bound,
record-count bounds, ref-membership checks; researchMaterial.ts:94-127) and
persisted "through the existing composition CAS" (researchMaterial.ts:129).
The place surface saves exactly one record: "Save map view" writes
`host.material(sceneId,{type:'viewport',key:'place',value:{x:longitude,
y:latitude,zoom}})` (researchInstruments.tsx:665-666), restored on next open
as the map camera (line 647: `state.place??=savedPlace?{latitude:savedPlace.y,
longitude:savedPlace.x,zoom:savedPlace.zoom}`). **Filters, standing, selected
place and lane-year are session state only — not saved** (state.placeFilter
initialises to OPEN_PLACE_FILTER each load, researchInstruments.tsx:654).
Confidence: high.

**What does not save today:** no placemarks created from the map; no saved
layer stack or layer visibility; no tours; no map annotations bound to
geography (strokes exist on the Canvas, not the globe); no named map views
(the Canvas has namedViews; the place surface has the single `place`
viewport). Confidence: high (absence across the mount and material schema).

## 3. Navigation identity (place → subject → timeline)

**Selection law.** Clicking a place sets the DisclosureSession selection
with `focus_refs=[place_ref]`, subject/reading basis "carried verbatim,
never minted or rewritten" (`src/techne/m0m5/place/register.ts:4-8, 19-26`).
`placeFocusFromSession` (register.ts:37-48) is the named reopen seam:
another instrument sets the shared selection (`focus_refs` or
`session.spatial_focus_ref`) and this aperture honours it — the doc cites
the M3′↔M4′ case ("a Journey Scene frame binding a real Place ref", 
register.ts:29-36). Cross-open affordances come "strictly from the
reading's own disclosure" (`crossOpenTargets`, register.ts:55-58). The
session contract fields for this are `time_window`, `spatial_focus_ref`,
`scene_focus_ref`, `reference_frame_ref`, `expression_focus_ref`
(contract.ts:859, 869). Confidence: high.

**Hosted cross-open.** In the m4 mount: place marker double-click/open →
`onOpenCanvasNode` → `host.inspectSubject(ref,{node})` (researchInstruments.tsx:672-674)
— a place opens its subject in the Canvas lens of the same instrument
workspace; the timeline lens does the same with `relationField` context
(line 634). The hosted readings pin identity by expression_ref +
scene_ref + revision and REFUSE on drift (wikiReadingProvider.ts:248-352),
so "change reading without silently changing what you are working on"
(dual-reading §3) holds on the read path. `worldState` (world.ts:439-470)
exposes `{subject_ref, reading_ref, view, selected, relations, route,
occasion, depths, ladder, cross_open, actions}` so an Agency co-refers
"without scraping the DOM" (world.ts:431-438). Confidence: high.

**What is NOT wired:** no place→timeline jump (nothing sets the session
`time_window` from the map — the map has no time control to set it with);
no place→wiki-source open (the panel shows source_ref as text,
placeFacetsPanel.tsx:143); the m0m5 `renderGlobeModel`/`renderMapModel`
cradle models are not mounted in any shell surface (importers: the hosted
panel and tests only) — the live globe is the vendored Research Canvas
surface. Confidence: high.

## 3b. The live map surface (vendored Research Canvas) — what it can do today

`PsychogeographicMap.tsx` on **maplibre-gl ^6.11.1**
(`expressions-app/package.json:24`; vendor wants ^6.2.0,
`vendor/research-canvas/packages/canvas/package.json:23`):

- **Globe-first**: view toggle `globe | flat` (PsychogeographicMap.tsx:74);
  renderer sets `map.setProjection({type:"globe"|"mercator"})` and
  `map.setSky({"sky-color":…, "sky-horizon-blend":0.4})`
  (`renderer.ts:108-133, 293-304`); a graticule layer shows on globe only.
- **Offline-first posture**: `offlineOnly` is hard-set at the hosted mount
  (researchInstruments.tsx:667); live tiles are an explicit opt-in through
  `LiveServicePolicy` ("tile_refresh", PsychogeographicMap.tsx:111) and the
  map style supports geojson/raster/vector/pmtiles tile sources
  (`mapStyle.ts:20-24`, `geography/src/pack.ts:17-21`) — "live tiles remain
  an explicit opt-in enhancement over the bundled/offline base"
  (PsychogeographicMap.tsx:39-44).
- **The shipped basemap is 16 gazetteer points** — `pack.json`:
  name "research-canvas-offline", recordCount 16, tileSource geojson
  basemap.geojson, attribution "Pleiades CC BY 4.0 · Wikidata CC0 · GeoNames
  CC BY 4.0" (packages/geography/data/pack/pack.json). I.e. no coastlines,
  no imagery, no tiles — the globe draws ocean background + graticule +
  points (mapStyle.ts:107-118 `offline-base` circle layer).
- **Markers**: per-place DOM markers carrying precision
  (PsychogeographicMap.tsx:145-156; renderer.ts:172-173), plus
  archetype-expression markers per place (158-176).
- **Movement lanes**: `repository.getGeographyEdges` drawn as great-circle
  walk lines, per-mode colours, an `activeLaneYear` year control for lanes
  (PsychogeographicMap.tsx:79, 108-109; mapStyle.ts:66-72). Confidence:
  high on existence; the year control's exact UX read partially (lane-year
  state named; the slider UI sits in the map component body not fully read —
  see §6).
- **Selection and details**: click → selected node → LocationPanel details
  (inspector portal), Escape/keyboard handling (PsychogeographicMap.tsx:83-99).
- **Own-imagery street view**: `StreetViewSurface` (229 l) is mounted via
  `ImageryPanel` inside the m4 lens (researchInstruments.tsx:102-109):
  own captured fieldwork imagery with redaction regions (face/plate/manual)
  and local redacted-copy pipeline; "Mapillary browsing is an explicit
  per-action live opt-in" (StreetViewSurface.tsx:9-13). Scene images bind
  as cards with a 192 KiB import bound (researchInstruments.tsx:645-646).

**Kernel-side dependency note:** `three` 0.186.0 is a cradle dependency
(package.json) but belongs to the Expressions point-cloud engine, not the
place surface; no cesium / mapbox / leaflet / terrain / satellite code
exists anywhere in the cradle (grep, this pass). Confidence: high.

## 4. Kernel provider law as it touches M4′

**Disclosure, never faked.** Provider availability is always disclosed with
the reason: the instrument disclosure names place unavailable with "the
register's wiki reading carries no spatial facets" (wikiReadingProvider.ts:128-129);
`placeState` shows the refusal verbatim (modes.ts:61-72); the depth chain
names each uncallable producer with its structural reason (world.ts:233-245);
"no fake provider availability" is the dual-reading TD5 law
(TECHNE-DUAL-READING.md:260). Confidence: high.

**Native producer legs that DO exist in the kernel tree:**

- `kernel/src/m3_reception.rs` — "Subject-bound reception of QL's existing
  transactional M3 producer" (line 1); issues `ql.m3-state-request/v1` and
  validates `ql.m3-state/v1` readings (lines 242, 307). This is a kernel
  transport leg for the M3 world-clock depth that world.ts's 2026-09-16
  scouting note predates; the cradle model still reports M3 as
  producer-unavailable because no renderer surface calls this leg for M4′
  yet (no calls into m3_reception from the place surface — grep this pass).
- The **dated sky producer**: `NaraCurrentSky.tsx`
  (field-studies-journeys/src) issues `ql.sky-request/v1` through
  `naraInstrumentRequest` (lines 37-38) with Swiss-ephemeris/Moshier
  backend policy, "All quaternion arithmetic stays in QL" (line 8) and the
  returned reading carries its `provider` and `snapshot_ref` (line 55) —
  the solar/planetary rung's native producer, with provenance, no
  renderer-local astronomy. It is mounted in the Nara identity
  instrument, not in M4′.
- `kernel/src/nara_presence.rs` — "Private native Nara/Expression basis ->
  consented, coordinate-only presence" (line 1); publication/consent owned
  by SharedField. The Nara/situated rung's consent law.

**Law held:** no renderer-local astronomical recomputation anywhere in the
place tree (the globe computes only projections; world.ts:20-23). The
target-set consequence: new depth (imagery, terrain, solar position) must
arrive as disclosed providers or explicitly opted-in live services, never
as silent fetches or renderer-side ephemerides. Confidence: high.

## 5. Named gaps against a Google-Earth-class globe with data layers

1. **No real basemap.** The shipped globe has 16 offline points, an ocean
   fill and a graticule (§3b). No coastlines, no raster/vector tiles, no
   satellite imagery. The style/policy plumbing for live tiles exists but
   is force-disabled at the mount (`offlineOnly`, researchInstruments.tsx:667).
2. **No terrain or elevation.** No terrain source, no 3D terrain toggle, no
   elevation sampling anywhere in the tree (grep: zero terrain references).
3. **Camera model is viewport-only.** `MapViewState {latitude,longitude,zoom}`
   (PsychogeographicMap.tsx:75-77) — no heading/tilt/pitch, no fly-to
   animation, no inertial tour, no "search and fly". The cradle's own
   camera (`CameraState {lon,lat,zoom}`, project.ts:22-28) matches. Google
   Earth's core feel — tilt to the horizon, spin with inertia, fly-to — is
   absent.
4. **No search on the map.** The gazetteer index ships in the pack
   (geography/src/gazetteer.ts) but no search/fly-to UI consumes it on the
   map surface (grep: no consumer in psychogeographic/). Subject search
   exists only in the shell's SearchOverlay, unlinked to the map.
5. **No time slider over dated events.** The only temporal control is the
   movement-lane year (`activeLaneYear`, PsychogeographicMap.tsx:108). No
   general time slider binds the reading's temporal facets (lane 2's model)
   to map markers; no historical-imagery slider (no imagery to be
   historical). The session `time_window` is never set from the map.
6. **No placemark creation or editing from the map.** Creation/editing runs
   through wiki source-editor forms only (§2); the map is read-only over
   the reading. No click-to-add, no drag-to-refine, no geocode-by-click.
7. **Regions are not drawn as regions on the live globe.** Facet polygons
   render only in the cradle's pure globe model (modes.ts:188-204); the
   maplibre surface renders place markers as points (pointForPlace,
   PsychogeographicMap.tsx:145-156) — a `region`-precision facet appears as
   a point marker, not an outline, on the live surface.
8. **No layer semantics.** No layer panel, no per-relation-type or
   per-standing visibility toggles on the map (filters exist in the side
   panel only, placeReading.ts:22-28), no imagery/terrain/data layer stack,
   no legend. The "data viewing layers overtop" half of the owner's bar is
   the largest structural gap.
9. **No tours.** Nothing records or plays a camera path; the Canvas has
   named views, the globe has one saved viewport record.
10. **Navigation identity stops at the Canvas.** No place→timeline jump, no
    place→wiki-source open, no search-result→place fly-to; cross-open is
    disclosure-driven but one-directional (place→canvas, §3).
11. **Precision grammar not carried onto the live map.** `precisionMarker`'s
    solid/halo/outline/no-coordinate vocabulary (project.ts:75-86) is used
    by the cradle models; the maplibre markers carry precision data but the
    visual distinction on the globe is a single marker class
    (renderer.ts:172). Uncertainty never reads as exactness — but the
    halo/outline grammar is not rendered there.
12. **Street view is own-imagery only.** Mapillary is an opt-in affordance
    in the vendored surface; no place selection → street-view linkage is
    mounted in the m4 lens (ImageryPanel lists scene images, not the
    selected place's imagery).

## 6. What stayed unverified

- No live run: nothing was exercised against a booted desktop or the hosted
  app; all evidence is static reading. The `place_set` save law is read
  from its executable native regression test (gated on
  `OI_NATIVE_PLACE_SET_ACTION`), not run in this pass.
- The lane-year control's exact UX in PsychogeographicMap (slider bounds,
  behaviour at lane gaps) — state and lane rendering read, the control body
  only partially (PsychogeographicMap.tsx beyond line 180 not read
  line-by-line).
- Whether live tiles / Mapillary actually render when `LiveServicePolicy`
  is opted in (the hosted mount hard-sets `offlineOnly`; the opt-in path is
  vendored code read only at its interface).
- The vendor patch surface: PROVENANCE.json records "explicitly recorded
  capability, native error disclosure and hosted offline-network patches";
  the patches directory was not diffed in this pass.
- Whether `kernel/src/m3_reception.rs` is invoked by any surface today
  (grep found no caller from the place tree; absence of a caller in this
  tree is as far as static reading goes).
- The Google Earth Pro desktop application is not installed on this machine;
  its UX is used as the reference bar from public documentation in
  RE-TARGETS.md, not from local capture (see RE-TARGETS.md for what was
  and was not captured).
