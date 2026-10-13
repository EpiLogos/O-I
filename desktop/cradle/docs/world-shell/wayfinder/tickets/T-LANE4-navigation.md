# T-LANE4-NAV — Places: pitch/bearing, fly-to by precision, the precision marker grammar

Label: wayfinder:task (Phase 4 · lane 4)
Claimed-by: claude-code:dlw-lead (13 Oct 2026; builder haiku)
Source: `lanes/lane-4-world-places/TARGET-SET.md` T1, T2, T10 (register `lane-4:T1`, `T2`, `T10`).

## Resolution

**Landed (13 Oct 2026; builder haiku, converged by the lead).** The Places
map (research canvas `psychogeographic/`) carries pitch and bearing
(drag/touch rotate and touch pitch; flat mode holds top-down; a readout in
the map's own chrome); `flyToPlace` derives zoom from the facet's
`precisionMarker` kind (exact 16, approximate 11, region 4, unlocated: no
flight, named for the register) with the Canvas's cubic in-out easing and a
duration by angular distance; markers take four renderings from the
authority (solid, halo, dashed outline, register-only — never at 0,0) with
the uncertainty note beside them. `placeNavigation.ts` imports the cradle
authority (`project.ts`, `geometry.ts`, `mapStyle.ts`) — accepted. Lead
accepted the visible change: selecting a place flies to its precision zoom.
Scripted: places-navigation 20 + place-reading 8 (28/28); tsc 0; the
read-only render harness passes; PROVENANCE refreshed (lead).

**T-LANE4-NAV-b (lead, persistence):** the saved place viewport admits
optional `pitch` [0,85] and `bearing` [-180,180] — kernel validator
`desktop/cradle/kernel/src/expression_scene.rs:427-438`, app
`researchMaterial.ts:117` (`validateViewport`, `ResearchViewport`), then the
host (`researchInstruments.tsx:691,709`) switches to
`viewStateFromPlaceRecord` / `placeRecordFromViewState` (kernel first —
the helper only emits pitch/bearing for a tilted view).

## Resolution — T-LANE4-NAV-b (persistence, lead)

**Landed (13 Oct 2026).** The kernel's research viewport validator
(`expression_scene.rs` `validate_research` → `viewport`) admits optional
`pitch` [0,85] and `bearing` [-180,180] — earlier records unchanged, no
other unknown field admitted (unit test); the app's `validateViewport` and
`ResearchViewport` match; the Places host restores with
`viewStateFromPlaceRecord` and saves with `placeRecordFromViewState` (an
untilted view still writes the legacy `{x,y,zoom}`). Scripted: kernel
`expression_scene` 2/2; places 28/28; tsc 0; build clean. Unverified: a
tilted view saved and restored in the native app.

## Resolution — T3 + T6 + T7 + T29 (the map's chrome)

**Landed (13 Oct 2026; builder haiku + lead wiring).** "North" eases bearing
and pitch to 0; "Globe home" flies to `defaultPlaceView()` (exact state,
tested); the globe's limb atmosphere (`setSky` horizon colour from
`--oi-mark-blue`, parity-tested against tokens.css; flat unchanged); an
attribution line names every live source — tiles, live source, and (lead
wiring in `researchInstruments.tsx`) the geography pack's gazetteers
(Pleiades, Wikidata, GeoNames with licence) — with the imagery readout and
the owner's reason verbatim for any unavailable source (`disclosure.ts`);
stillness: no rAF/interval/CSS animation in the map, a marker pulses only
during its own flight (`isIdle`, `pulseTarget` pure + tested). Scripted:
47/47; verify-source green; tsc 0. Unverified: the look and a 60 s idle
watch (native pass). Text labels stand in for compass/home icons (the
icon set is the host's).

## Resolution — T8 + T9 (relation layers, regions as regions)

**Landed (13 Oct 2026; builder haiku + lead host wiring).** `placeLayers.ts`:
one map layer per `placeRelations` relation with the authority's standing
class (a layer reads "sourced" only when every facet has a source ref;
mythic reads mythic; else "standing unknown" — nothing upgraded); an
on-map layers panel + legend in the chronology's standing vocabulary
(`STANDING_DRAWING`); toggles narrow visibility only and drive the SAME
filter state as the side panel (lead wiring in `researchInstruments.tsx`:
full `nativeReading.spatial`, `layerFilter={filter}`, `onLayerFilterChange`
mirroring the side panel). Polygon facets draw as fill + constant 2 px
outline with the label at the authority centroid and never also as a point.
Scripted: places suites 63/63; verify-source green; tsc 0. Unverified: the
look, panel placement, region click (native pass); the bundled offline pack
is points only, so polygons appear only from readings with polygon geometry.
Debt noted: the vendor imports `placeReading.ts` helpers from the app and
inverts the cradle's private `polygonRings` through `projectPlaces` (round-trip
tested) — move the helpers to cradle src and export `polygonRings` in a tidy pass.

## Resolution — T11 + T12 + T13 (routes, hierarchy edges, provenance)

**Landed (13 Oct 2026; builder haiku + lead host wiring).** `placeRoutes.ts`:
TRAVELLED_TO movements draw as route lines with numbered clickable stops in
`routeModel`'s validity order (open-bound last; fewer than two drawable
stops draws nothing; unlocated never a stop; stop click = selectPlace);
LOCATED_IN hierarchy edges from the authority's `projectPlaces` edges
(region parents at their centroid; an endpoint without a position is
listed with its reason, never drawn; expired edges dropped by their own
validity). `placeProvenance.ts` + the facets panel: source ref, revision,
native owner and the producer's selector per facet ("no provenance
disclosed" / "revision not disclosed" — never invented), with "Open source"
routed through the host's `inspectSubject` (lead wiring). Scripted: places
suites 85/85; verify-source green; tsc 0. Unverified: the look and clicks
(native pass). Not done: provenance in the marker detail (LocationPanel
carries no provenance field).

**T4 + T5 — basemap stack and terrain (landed `98e66eb90`, `2b2de0cdb`;
13 Oct 2026).** The offline pack stays the default ground. OSM, Sentinel-2
cloudless (EOX), Esri imagery, Esri place names, and terrarium raster-dem
terrain are rows in a basemap stack (visibility, opacity, named source).
`basemapSources.ts` / `basemapLayers.ts` are the data and the plan;
`setBasemapPlan` diffs layers, so kept sources keep their tiles. Each source
draws only after the owner's "Allow live sources" switch, through the policy's
`tile_refresh` gate (session state `state.livePlaces`). Every drawn source is
credited with its licence, and refusals show verbatim on their row. Terrain
reads elevation at the selected place or says "No terrain source". Lead
(T4c): the native CSP (`src-tauri/tauri.conf.json` connect-src/img-src)
admits the four hosts. Each was verified live (HTTP 200 with an image type);
nothing is fetched before the owner allows. The hosted offline stance reads
"Live sources stay off until you allow them." The OSM-only toolbar opt-in is
subsumed by the stack row. Scripted: places-basemap 20/20; places/place/canvas
144/0; verify-source passes. Queued: per-Scene persistence of the stack (with
T21); layer reorder; dead opt-in selectors
(`researchInstrumentStyles.css` ~1704) to tidy. Unverified (native pass):
imagery and terrain rendering, OSM's User-Agent policy under WKWebView.

**T17–T19 — placemark authoring (landed `0dd1c6e50`, 13 Oct 2026; builder
haiku).** A right-click or long-press on the Places map offers "Add place
here" (and "Edit place…" on a marker). Both open the existing constellation
route; the map never writes. Approximate and region markers drag into a
pending-move chip that names the old → new coordinate and basis, with Apply /
Cancel. Precision never upgrades. Exact markers do not drag, and their title
says why. `placeAuthoring.ts` is the pure model; `PlaceAuthoringHost` is the
map's only outward port. Scripted: places 127/127; the native place-set case
is appended (gated). Lead accepted: the prefill rounds to 5 decimals, and
"Edit place…" opens the whole-subject constellation editor (the existing
route).
**T17b (landed `6176030c6`):** the draft (clicked coordinate or move proposal)
travels through `TechneConstellationRequest` → `PointCloudHost` →
`CradleFrame` → `WikiFactsEditor`. The source basis is still required. The
owner's save or refusal returns to the map: a refusal comes back verbatim
with the marker returned, and a save triggers a re-read.

T17b as landed: one validator (`validatePlaceDraft`, `placeAuthoring.ts`) is
imported by the host, the frame and the editor. `WikiFactsEditor` seeds a
visible "Draft from the map … Not saved", and `factsChanges` still refuses
without a chosen source. Every routed save emits `oi:constellation-result`;
the Places host shows a refusal in the owner's words and re-reads on save.
Scripted: constellation-place-draft 6/6; places 129/129; cradle build clean.
Open for T17c (cradle side): carry the draft on the construction frame
instead of a module map, and auto-open the place editor for a map route.

**T14–T16 + T17c-map (dispatched):** a time slider over dated events on the
shared session window, playback, the imagery note, and a refused move
returning its marker inside the map.

**T14–T16 + T17c (landed `bff6060df`, `758a73145`).**
- A docked time control over the reading's dated extent: play, step,
  ×1/×2/×4 and loop.
- It filters through `placesInWindow` / `nameInWindow` on every frame, and
  writes the shared window on pause, step and drag end.
- Reduced motion steps only.
- The imagery note reads "data window · imagery not time-aware".
- A refused move returns its marker.
- Lead ruling (T29): the stillness guard admits one frame clock, the
  reader-started playback.
- T17c cradle: the route is subject-keyed and expires after 10 minutes. It
  is consumed only after a successful read, and it auto-opens the place
  editor. Each save is answered exactly once.
