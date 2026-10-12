# Lane 4 — TARGET SET — M4′ World/Places, genuine functionality parity

Campaign: 2026-10-07 technè instrument RE programme · lane 4 of 5.
The owner's bar: "basically a Google Earth clone that we want, plus the
data viewing layers overtop." Reference targets per RE-TARGETS.md:
MapLibre GL 6.11.1 (primary, possessed in-tree), CesiumJS (behavioral
reference, clone `a3aea90b…` in /tmp), Google Earth web (UX bar,
documented), NASA Worldview (time-animation precedent), QGIS (layer
semantics precedent).

**Law for every target:** craft-quality bars, never compliance checklists
(expression-audit law, PROGRAMME.md:19-25). No second semantic store, no
second globe, no renderer-local astronomy, no fake provider availability
(TECHNE-DUAL-READING.md TD5, TD8; world.ts's own header law). Target sets
name the reference behavior attained and the evidence that shows parity.

**Interface points consumed, not redefined:**
- **Lane 2 time model**: M4′ consumes `TechneTemporalFacet`
  (`src/techne/contract.ts:205-222`) and the presentation
  `TimeWindow {from,to}` (`src/techne/m0m5/place/filter.ts:22-28`) — the
  same seam lane 2's FINDINGS §6 records. Lane 2 owns the temporal
  precision ladder and the walk model (its TARGET-SET T-series); lane 4
  binds its validity filter (`coversWindow`, filter.ts:121-123) to that
  window and adds nothing temporal of its own.
- **Lane 5 journey**: tour stops are refs on presentation material; a
  journey may bind them as Scene entities through lane 3's editing core.
  No journey store is created here.

**Landing seams (used below):**
- SURFACE — `desktop/cradle/expressions-app/field-studies-journeys/src/researchInstruments.tsx` (the `'m4'` lens, `renderPlaces()` lines 638-676) and the vendored map components it mounts (`expressions-app/vendor/research-canvas/packages/canvas/src/psychogeographic/`); new capability lands as host code; vendor changes only through PROVENANCE-recorded patches.
- MODELS — `desktop/cradle/src/techne/m0m5/place/` (filter.ts, world.ts, project.ts, modes.ts, register.ts) — the pure law, reused not forked.
- SAVE — `place_set` via `aikit.wiki-facts-action/v1` / constellation apply (kernel/src/construction.rs:146; src/knowledge/wikiFacts.ts:36,95; src/knowledge/ParticipationFacts.tsx:33-36; the source-basis law of tests/place-set-action-native.test.mjs).
- MATERIAL — `oi.research-scene/v1` per-Scene presentation records (researchMaterial.ts:24-31, validated, composition-CAS persisted).
- SESSION — DisclosureSession `selection.focus_refs`, `time_window`, `spatial_focus_ref` (src/techne/contract.ts:859-869; m0m5/place/register.ts:19-48).

---

## A. The globe and its camera (Earth feel)

**T1 — Full navigation viewport: pitch, bearing, and globe spin.**
What: extend the map view state beyond `{latitude,longitude,zoom}`
(PsychogeographicMap.tsx:75-77) to carry `pitch` and `bearing`; enable the
maplibre equivalents (`setPitch` d.ts:11323, `setBearing` d.ts:11315,
`dragRotate` d.ts:12208). Reference: Google Earth's ctrl-drag tilt/rotate
feel; MapLibre camera API (possessed). Seam: SURFACE (renderer view state)
+ MATERIAL (the saved `place` viewport record gains pitch/bearing with
backward-compatible defaults 0). Harmonisation: the instrument keeps its
native camera controls; pitch/bearing indicators join the map's own chrome,
not the shell's. Acceptance: a driven run shows a tilted, rotated globe;
reload restores the saved viewport including pitch/bearing; flat mode
ignores pitch without error. Evidence: maplibre state + saved material
round-trip.

**T2 — Fly-to choreography (`flyToPlace`).**
What: `flyToPlace(place_ref | subject_ref)` — an animated camera flight to
a facet, with zoom chosen by the facet's own precision (exact → street
scale, approximate → city, region → continent-scale frame, unlocated → no
flight, the register slot is named instead). Reference: Cesium
`Camera.prototype.flyTo` / `flyToBoundingSphere` (Camera.js:3427, 3662)
for the eased arc and duration-by-distance shape; Google Earth
search-and-fly. Seam: SURFACE (host helper over maplibre `flyTo`,
d.ts:11417); MODELS: zoom-from-precision is derived by
`precisionMarker`'s vocabulary (project.ts:75-86), never re-hard-coded.
Harmonisation: one flight feel shared with the Canvas's `flyToNode`
(researchInstruments.tsx:386) — same easing family. Acceptance: calling
fly-to on each precision class lands at the documented zoom band; an
unlocated place never flies. Evidence: driven run screenshots/state dumps
per class.

**T3 — Return-to-north and tilt-reset affordances.**
What: one-click compass reset (bearing→0, pitch→0) and a "globe home"
reset, Earth-standard. Reference: Google Earth's compass/reset controls;
MapLibre `GlobeControl` (docs API classes/GlobeControl). Seam: SURFACE map
chrome. Harmonisation: joins the instrument's existing tool portal
(`host.tools`, researchInstruments.tsx:664). Acceptance: reset returns the
exact default view state (compare state objects).

## B. Basemap truth — imagery, terrain, sky (all provider-honest)

**T4 — Layered basemap with an honest offline core.**
What: a layer STACK, not a single source: the bundled offline pack remains
the default ground; explicit opt-in live raster tile sources (satellite /
street / hybrid families) stack above it via the existing
`LiveServicePolicy` "tile_refresh" gate (PsychogeographicMap.tsx:111;
geography/src/policy.ts), with a per-source attribution line rendered on
the map. Reference: Google Earth's imagery + QGIS layer tree semantics;
MapLibre raster sources (`RasterSourceSpecification`, d.ts:4) and the
style's existing raster branch (mapStyle.ts:87-91). Seam: SURFACE
(mapStyle + policy UI); the mount keeps passing `offlineOnly` until the
owner opts in — opt-in is a native control of the instrument, never a
silent fetch. Acceptance: offline default identical to today; opting in
shows imagery AND the attribution; opting out returns to the offline
ground; refusal/reasons surface verbatim when a provider is absent.

**T5 — Terrain elevation as an opt-in layer.**
What: raster-dem terrain (`TerrainSpecification`, d.ts:4; tile manager
7958-8111) enabled per opt-in source, interacting with T1's pitch;
elevation queried for a selected place via the dem sampling path where
available. Reference: Google Earth 3D terrain feel; MapLibre
globe-with-terrain example (docs). Acceptance: with terrain on, the
horizon reads as terrain at pitch; with terrain off/unavailable, the
surface says "no terrain source disclosed" — never a fake horizon.

**T6 — Atmosphere and the Earth limb.**
What: complete the globe's look — atmosphere/sky on the limb via
`setSky` (d.ts:1956) beyond the current single sky colour
(renderer.ts:133), tuned once for the Expressions-family palette.
Reference: Cesium's globe limb; MapLibre atmosphere example (docs).
Acceptance: globe mode shows limb atmosphere; flat mode unchanged.
Harmonisation: colors derived from `@epilogos/oi-design-system` tokens.

**T7 — Provider disclosure on the surface.**
What: every live source names its provider and attribution on the map
(persistent attribution line + an "imagery/terrain: <source>" readout);
absence states say why. Reference: the no-fake-provider law (TD5) and the
disclosure grammar of `placeState`/`depthChain` (FINDINGS §4). Seam:
SURFACE chrome; MODELS: the reasons reuse the depth-chain reason strings'
shape (world.ts:233-245). Acceptance: any network-loaded pixel is
attributed on-screen; any unavailable source shows its reason, verbatim
from the owner.

## C. Data viewing layers overtop — bound to the real relation field

**T8 — Relation-typed overlay layers with an on-map legend.**
What: the reading's spatial facets grouped by their relation
(`placeRelations`, world.ts:88-102) and standing class
(`relationStandingClass`, world.ts:68-72) render as distinct map layers,
each toggleable from an on-map layers panel with a legend; toggles are
presentation-only and drive the SAME filter state as the side panel
(`placeFilterOptions`, placeReading.ts:35-42). Reference: QGIS layer tree
+ legend semantics. Seam: SURFACE (maplibre style layers + panel);
MODELS: filter law already guarantees identity-safe narrowing
(filter.ts:9-14). Acceptance: toggling a layer changes only visibility,
never the reading; the panel and map always agree (both read one filter
state — the mount's existing dual-drive pattern, researchInstruments.tsx:655-660).

**T9 — Regions drawn as regions.**
What: `region`-precision and polygon-geometry facets draw as fill/outline
polygons (with label at centroid), not point markers — the live globe
currently renders them as points (FINDINGS §5 G7); the cradle's pure
models already read rings (modes.ts:188-204, project.ts:161-173).
Reference: Google Earth polygons; maplibre fill layers. Seam: SURFACE
(GeoJSON source built from facet geometry). Acceptance: a declared region
facet renders as an outline at every zoom; halo/outline markers (T10)
never double-draw regions as points.

**T10 — The precision/uncertainty grammar on the live globe.**
What: carry `precisionMarker`'s four renderings — solid (exact), halo
(approximate), outline (region), the honest no-coordinate register — into
the maplibre marker/layer styling (currently one marker class,
renderer.ts:172); uncertainty text from the facet renders beside the
marker. Reference: the cradle's own law, project.ts:63-86 — "the marker
kind is derived from the facet's own precision and never upgraded to look
nicer". Seam: SURFACE styling over MODELS vocabulary. Acceptance: a
driven run over a fixture with all four precisions shows four visibly
distinct renderings; approximate never reads as a solid fix; unlocated
places stand in the register, not at (0,0).

**T11 — Movement lanes become routes with stops.**
What: TRAVELLED_TO facets render as route lines with numbered, clickable
stops in `routeModel`'s validity order (world.ts:132-162), the
presentation-only note carried verbatim beneath the drawing
(placeFacetsPanel.tsx:68-79 already renders it); stop click = select +
detail. Reference: Google Earth path placemarks; the existing lane
rendering (mapStyle.ts:66-72). Seam: SURFACE; MODELS: routeModel reused
as-is. Acceptance: a two-plus-stop movement draws in validity order with
open-bound stops last; fewer than two stops draws nothing ("never a forced
path"); clicking a stop selects the place.

**T12 — Hierarchy edges on the globe.**
What: parent→child LOCATED_IN hierarchy edges (facet.hierarchy) draw on
the live globe — they exist today only in the cradle's pure globe model
(modes.ts:221-235, project.ts:244-258); endpoints without positions are
listed but not drawn ("the edge is then listed honestly but not drawn",
project.ts:115-117). Acceptance: a child placed in its parent renders one
edge; validity-window filtering drops expired edges without touching
identity.

**T13 — Provenance on every pinned thing.**
What: the place detail (PlaceFacetsPanel) gains a provenance block —
source_ref, revision, native owner, the selector the producer recorded
(spatialFacets.ts:68) — with an "open source" affordance; markers expose
provenance in their detail. Reference: TD5's provenance requirement;
the one-field law's "source + revision basis". Seam: SURFACE panel;
provenance already arrives on the reading (`provenance` array,
wikiReadingProvider.ts:403). Acceptance: every rendered facet shows where
it came from; a facet without provenance says so rather than inventing a
source.

## D. Time on the globe (consumes lane 2's model)

**T14 — The time slider over dated events.**
What: a docked, visible time control bound to the presentation
`TimeWindow` — dragging it re-evaluates `coversWindow` for markers, lanes
and hierarchy edges (filter.ts:121-131), so validity-bounded places
appear and disappear by their own validity; the standing window is shared
with the panel's validity fields. The slider's bounds and labels derive
from the reading's own temporal facets (`TechneTemporalFacet`,
contract.ts:205-222) and facet validity strings — nothing temporal is
redefined here (lane 2 owns the model; its precision ladder governs
labeling). Reference: NASA Worldview's date animation;
Google Earth's historical-imagery slider (see T16's honesty clause).
Seam: SURFACE; MODELS: `placesInWindow`/`nameInWindow` reused as-is.
Acceptance: sliding across a fixture with validity-bounded facets
admits/withdraws exactly the facets whose validity meets the window;
identity names swap at their own boundaries (`nameInWindow`,
filter.ts:138-144); a place filtered out returns intact when the window
returns to it.

**T15 — Playback: animate the window.**
What: play/pause/step animates the window across its extent (Worldview's
animate mode as precedent); speed is a native control. Acceptance: during
playback the same law as T14 holds at every frame; pause leaves a
inspectable window; no animation without dated material (the control
stays disabled with the honest reason).

**T16 — Historical-imagery honesty.**
What: if an opted-in imagery source exposes no time dimension, the time
slider's imagery note says so — the slider filters DATA, and never
pretends to turn back imagery. Reference: Google Earth's historical
imagery exists only where its provider carries it; our law forbids faking
availability (TD5). Acceptance: with the offline pack, the slider reads
"data window (no time-dimension imagery source disclosed)"; no
imagery-era claim is ever rendered.

## E. Placemark authoring and data-saving targets

**T17 — Click-to-create a placemark bound to a wiki subject.**
What: right-click (or long-press) on the globe offers "Add place here" —
it opens the SAME native authoring route the instrument already uses for
"Edit place/time" (the constellation route, researchInstruments.tsx:648-653;
placeFacetsPanel.tsx:25-41) with the clicked coordinate and precision
"approximate" prefilled (a click never claims exactness — the
declaredFacet law, placeFacets.ts). The route ends in a canonical
`place_set` write. Reference: Google Earth placemark creation; our own
save law. Seam: SURFACE gesture → SAVE route (place_set via
`aikit.wiki-facts-action/v1` / constellation apply; kernel/src/construction.rs:146). Acceptance: a created placemark persists in the register wiki under
`aikit.techne-facet/v1` (the persisted shape of
place-set-action-native.test.mjs:60-62) and re-renders on the globe after
a fresh reading — the full round trip.

**T18 — Placemarks are first-class saved objects (source-basis law
intact).**
What: every authored place carries its source basis; the write refuses
missing/ambiguous/stale bases exactly as the native regression asserts
(test lines 28-40) — refusals surface verbatim on the instrument. What is
saved is the facet (identity names, geometry, precision, validity,
uncertainty, hierarchy, observer_frame, source_ref), never a
renderer-local copy. Acceptance: a refusal attempt (no source basis) writes
no bytes to the wiki (byte-compare, as the test does) and shows the
owner's refusal message; a successful save round-trips.

**T19 — Drag-to-refine with honest precision.**
What: dragging an approximate marker proposes a coordinate update through
the same `place_set` route (edit always through the owner; the panel's
"never edits locally" law, placeFacetsPanel.tsx:6-10, preserved);
precision never auto-upgrades to exact by the act of dragging. Acceptance:
a drag produces a pending proposal naming the old and new basis; refusal
(stale source) leaves the marker where the reading says it is.

**T20 — Named map views (camera + filters + time window) as saved
presentation.**
What: "Save view…" stores a named view — viewport incl. pitch/bearing
(T1), layer toggles (T8), and the time window (T14) — into the Scene's
`oi.research-scene/v1` material alongside the Canvas's existing
`namedViews` (researchMaterial.ts:24-31, schema extended bounded;
viewport-only `place` record remains for backward compatibility). Views
hold refs and presentation only, never content copies (the material's own
law). Acceptance: save → leave → return restores camera, layers and
window exactly; the material still passes `validateResearchMaterial`'s
bounds; deleting the view leaves the Scene intact.

**T21 — Layer visibility persists per Scene.**
What: the layers panel's toggle state saves with the Scene material
(bounded record like `timeline` layouts), so a person's reading of the
world survives the session without touching the reading itself.
Acceptance: toggles persist across reopen; a material from before the
field existed loads as "all disclosed layers on" (the backward-compatible
absence rule, researchMaterial.ts:88-90).

## F. Search and navigation identity (place → subject → timeline)

**T22 — Search-and-fly-to-subject.**
What: subjects whose readings disclose place facets appear in the shell's
search with a "fly here" affordance: selecting one opens the m4 lens
through the existing field-open path and flies to the place (T2) — one
selection, carried by refs. Offline geographic search over the shipped
gazetteer (geography/src/gazetteer.ts, currently unused for search —
FINDINGS §5 G4) offers basemap context hits, clearly separated from
subject hits. Reference: Google Earth search-and-fly. Seam: SURFACE +
the shell SearchOverlay actions row (CradleFrame.tsx:2102 pattern).
Acceptance: a subject with two disclosed places offers both; choosing one
sets `focus_refs=[place_ref]` (selectionForPlace law, register.ts:19-26)
and the camera lands by precision; a subject without places has no
affordance (honest absence).

**T23 — Place → subject → timeline, one identity.**
What: from a selected place, cross-open affordances (already
disclosure-driven, crossOpenTargets register.ts:55-58) gain: "open in
Timeline" — sets the session `time_window` from the facet's own validity
and opens the m2 lens on the SAME subject; "open source" — opens
`source_ref` in the source editor. Both move refs through the
DisclosureSession (contract.ts:859-869), never a shadow route. Reference:
TD8's exact selection/ref continuity. Acceptance: place → timeline shows
the same subject_ref and a window equal to the facet validity; timeline →
place (via spatial_focus_ref) lands selected on the same facet — the
round trip preserves subject, reading basis and selection.

**T24 — Cross-instrument focus reopen on the globe.**
What: opening the m4 lens honours a pre-set `session.spatial_focus_ref`
— the seam `placeFocusFromSession` already implements
(register.ts:37-48) — selecting the named facet on open instead of
substituting the first. Currently the hosted mount passes only the saved
viewport (researchInstruments.tsx:665). Acceptance: a Journey Scene or
Canvas selection naming a place ref opens the globe with that place
selected and framed; a stale ref (facet absent from the current reading)
opens unselected with no error — "the ref must match a disclosed facet,
else null" (register.ts:31-36).

## G. Tours (interface point to lane 5)

**T25 — Tour recording on the globe.**
What: a record mode captures camera waypoints (viewport+pitch+bearing +
hold duration + optional caption) as presentation material; playback
drives the camera through them (maplibre flight between waypoints);
tours save per Scene like named views (T20's schema family). Reference:
Google Earth tours (documented behavior shape); Cesium camera
choreography (Camera.js flyTo family) for the flight feel. Acceptance: a
recorded 3-stop tour replays with the same waypoints, holds and captions;
recording without any dated-place claims — a tour is presentation, never
a minted route identity (routeModel's law respected).

**T26 — Journey binding (interface point, not a store).**
What: a tour stop MAY be bound to a Journey beat by the Journey instrument
(lane 5) — the stop carries `{place_ref, viewport, caption}` refs; the
journey composes them as Scene entities through lane 3's editing core.
M4′ records the interface and renders nothing journey-owned.
Acceptance: a bound stop shows its journey binding in the tour list with
the ref; deleting the journey beat leaves the tour stop intact and
unbound (no orphaned shadow records).

## H. Depth and instrument honesty on the globe

**T27 — The day/night terminator as a disclosed provider reading.**
What: the solar/planetary rung of the reference-frame ladder
(world.ts:321-370) renders as an optional day/night shading on the globe
— computed by NOBODY in the renderer: consumed from the native
`ql.sky-request/v1` producer (the dated-sky path already proven end to end
in NaraCurrentSky.tsx:29-44, provider + snapshot_ref carried in the
reading). When the producer is unavailable, the rung names the reason, as
the depth chain does today (world.ts:233-245). Reference: Google Earth's
sunlight feature; TD5's "no renderer-local astronomical recomputation".
Seam: SURFACE overlay + the existing native instrument request route.
Acceptance: with the producer reachable, the terminator matches the
producer's stated subsolar point for the stated epoch (compare values in
the reading); without it, the toggle shows the exact reason; the reading's
provider/snapshot provenance is visible in the detail.

**T28 — The ladder, visible where you stand.**
What: the reference-frame ladder (solar → Earth occasion → geography →
places/routes → Nara) keeps its panel home (PlaceFacetsPanel depths,
placeFacetsPanel.tsx:163-168) and gains one-line rung summaries in the
layers panel — availability and reasons verbatim, nothing fabricated to
complete the ladder (world.ts:315-319). Acceptance: every rung shows its
true availability; clicking an unavailable rung shows its reason; no rung
is ever greyed-in as present.

## I. Craft bars (the audit's law — these are qualities, not checkboxes)

**T29 — Stillness.** The idle globe is still: no auto-spin, no idle
animations, marker pulses only while a related action is in flight;
transitions are eased and finish. Evidence: a driven run observed for 60s
idle shows no unplanned motion.

**T30 — One grammar, the mythic visibly distinct.** Standing classes read
identically across markers, routes, legend, and panel (one colour/shape
vocabulary from the design system); a mythic location is styled and
labelled mythic everywhere it appears and never inherits factual styling —
the hard geography law made visible (world.ts:8-13; the panel's standing
tag, placeFacetsPanel.tsx:139). Evidence: a fixture with
factual+mythic+owner-vocabulary facets renders the three classes
distinguishably in every surface that names them.

---

## Priority shape for the implementation campaign

Phase-3 contracts should take T4+T7 (honest layer stack) and T8+T10
(relation layers + precision grammar) first — they are the owner's
"Earth + data layers" core — with T14 (time slider) following as the
shared-semantics proof with lane 2, and T17+T18 (placemark authoring
through the native save law) as the data-saving spine. T2/T3/T25 give the
Earth feel; T22-T24 complete navigation identity; T27/T28 keep the depth
honest.
