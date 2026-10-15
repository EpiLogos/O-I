# T-PLACES-ONTO-ATLAS — Places is the atlas, alone

Ticket O (PATH §7, 15 Oct 2026). The register's ranked ticket R1: lane-4 T1–T30 and lane-2 T21, 31 targets.

Owner, 14 Oct (FOUNDATION §4): "Places is the Archetypal-Earth atlas, alone. It replaces the frame's map. The frame's
Places map retires along with its overlays … Any lane-4 behaviour worth keeping (search, facets, tours, standing marks,
navigation identity) is re-homed onto the atlas as a device or a pane control, and is listed before the frame map is
removed." Since then (14 Oct): controls live in device UI, never as chrome inside a pane — "a pane control" here means a
section of the M4′ World / Places plate or a slot of the one transport.

This file is the list the removal stands on. For each target: what the atlas already does, what the frame's map did, the
port, and its home on the atlas. A behaviour judged not worth keeping says why, against its own definition.

## How to read the citations

- **Atlas** paths are under `packages/live-shell/ui/src/projections/atlas/` unless named otherwise, at the working tree
  this ticket returns (the lead's commit of it).
- **Frame** paths are the frame's map as it stood before the removal, at `11475cc3d` (unchanged there since `3b66dcc3e`,
  where lane M re-homed the register): read them with `git show 11475cc3d:<path>`. `vendor/…/psychogeographic/` is
  `desktop/cradle/expressions-app/vendor/research-canvas/packages/canvas/src/psychogeographic/`; `fsj/` is
  `desktop/cradle/expressions-app/field-studies-journeys/`.
- **Homes**: *plate* = the M4′ World / Places plate (`places/PlacesPlate.tsx`, opened on the rack for `techne:m4`,
  `inhabitants/ql/devices/TechneDevices.tsx:247` OWN_PLATES); *transport* = Technē's binding
  (`shell/modeTransports.tsx:97`, `places/placesTransport.ts`); *stage* = a gesture of the globe itself, its words in the
  Info view's hover (the globe's `data-i`, `AtlasProjectionPanel.tsx:40` GLOBE_GESTURES); *M0* = the 0 instrument's
  devices (the atlas faces).
- M4′ opens the Earth pane, never the frame's retired lens (`TechneDevices.tsx:186` ATLAS_INSTRUMENTS).

## The 31 targets

### lane-2 T21 — Cross-instrument carry to the globe
- **Atlas already**: its clock is a face of the shared window (`sharedClock.ts:102` bindSharedTimeClock): a window set by
  the Timeline moves the Earth's cursor. A pane follows the shell's selection (`registerAtlasHost.ts:79` turnWithSubject).
- **Frame did**: "Show on the globe" wrote the event's place as the shared spatial focus and its validity as the window,
  then opened the frame's own Places map (`fsj/src/researchInstruments.tsx:1278`).
- **Port**: the atlas follows the session's `spatial_focus_ref` (`places/placesHost.ts:85` followSpatialFocus →
  `:70` turnAtlasTo): the subject drawn at that point is selected, else the Earth flies there at its own framing distance.
  "Show on the globe" keeps its two owner writes and now ends there, saying the Earth atlas turns to it
  (`fsj/src/researchInstruments.tsx:1229`). Place → timeline is T23's.
- **Home**: the stage (the Earth turns); the window rides the one shared clock.

### lane-4 T1 — Pitch, bearing and spin
- **Atlas already**: drag turns the globe, wheel or pinch comes in, double-click dives (`src/globe/controls.ts:1` "A
  north-up, inertial orbit rig … there is no roll and the pole is clamped, so orientation is never lost").
- **Frame did**: MapLibre pitch/bearing on a viewport record (`vendor/…/psychogeographic/placeNavigation.ts:3`).
- **Port**: spin is the atlas's own drag. Pitch and bearing are **not kept**: the atlas's rig is north-up by its own law
  (controls.ts:1-5), and MapLibre's camera does not port onto the three.js rig; adding a roll would be new code, not a
  port. Its words stand in the Info view's hover ("Drag to turn it (north stays up) …").
- **Home**: stage.

### lane-4 T2 — Fly-to by precision
- **Atlas already**: flights frame an occurrence by its precision (`src/app/controller.ts:2426`: place 2.25, region 2.6,
  culture 3.0 globe radii; `src/globe/controls.ts:305` flyTo, eased great-circle).
- **Frame did**: `flyToPlace` by facet precision (`vendor/…/psychogeographic/PsychogeographicMap.tsx:186`).
- **Port**: a place chosen on the plate's Locations, or named by the session's spatial focus, turns the Earth through
  `places/placesHost.ts:70` turnAtlasTo at the atlas's own framing (`:53` framingDistance); an unlocated place turns
  nothing.
- **Home**: plate (Locations rows) → stage.

### lane-4 T3 — Return to north, globe home
- **Atlas already**: the rig never leaves north (controls.ts:1); the world view is its home (Escape steps back to it).
- **Frame did**: north and home resets (`vendor/…/psychogeographic/placeNavigation.ts:325`).
- **Port**: **not kept** as a control: there is no bearing to reset; "home" is the atlas's own world view.
- **Home**: stage (Escape).

### lane-4 T4 — Layered basemap with an offline core
- **Atlas already**: its own imagery — NASA Blue Marble base textures and NASA GIBS tiles close in
  (`src/globe/earth.ts:63`, `src/globe/tiles.ts:1`).
- **Frame did**: an opt-in stack of live raster providers over an offline pack (`vendor/…/psychogeographic/basemapLayers.ts:2`).
- **Port**: **not kept**: the providers (OSM, Esri, Sentinel-2) are not suite owners and the MapLibre stack does not port to
  the atlas's globe. The imagery the atlas does draw is named on the plate (T7).
- **Home**: plate, Landmass ("Imagery", `places/PlacesPlate.tsx:289`).

### lane-4 T5 — Terrain as an opt-in layer
- **Atlas already**: no terrain.
- **Frame did**: raster-DEM terrain (`vendor/…/psychogeographic/PsychogeographicMap.tsx:194`).
- **Port**: the layer is **not kept** (no terrain source in the suite); its honesty clause is: "no terrain source is
  disclosed", never a fake horizon.
- **Home**: plate, Landmass ("Terrain", `places/PlacesPlate.tsx:290`).

### lane-4 T6 — Atmosphere and the limb
- **Atlas already**: the globe's atmosphere shell and aura (`src/globe/engine.ts:78-79`), tinted by the field's palette.
- **Frame did**: MapLibre `setSky` (`vendor/…/psychogeographic/mapStyle.ts:84`).
- **Port**: none needed — the atlas's own.
- **Home**: stage.

### lane-4 T7 — Provider disclosure
- **Atlas already**: credits its imagery in its own search box (`src/ui/search.ts:28`).
- **Frame did**: an attribution line and readout on the map (`vendor/…/psychogeographic/disclosure.ts:2`).
- **Port**: the imagery the atlas draws is named on the plate, never over the globe.
- **Home**: plate, Landmass ("Imagery").

### lane-4 T8 — Relation-typed layers and a legend
- **Atlas already**: one filter, a mask of kinds and more (`src/shell/filter.ts:32` passes, `:46` maskOf); the suite
  provider reads each place's relation into the occurrence's locus (`provider/suiteReading.ts` locusOfRelation:
  MYTH_LOCATED_AT is never a historical event).
- **Frame did**: relation layers grouped and toggled from an on-map panel (`vendor/…/psychogeographic/placeLayers.ts:2`).
- **Port**: the legend is the plate's Relations rows, in the hard geography order then the owner's own vocabulary
  (`places/placesModel.ts:113` relationRows over world.ts GEOGRAPHY_RELATIONS); a press narrows the globe to that
  relation's locus through the atlas's one filter (`places/PlacesPlate.tsx:246` → controller `setFilter`, a seam
  adaptation recorded on PORT-PIN). Presentation only: the reading is never rewritten. A relation shares its locus with
  others of its kind (the row says which), since the atlas filters by locus.
- **Home**: plate, Relations.

### lane-4 T9 — Regions drawn as regions
- **Atlas already**: draws points; a polygon facet is held with the owner's reason ("the owner declares a polygon; the
  Earth draws points", `provider/suiteReading.ts` locateFacet).
- **Frame did**: polygons as fill and outline (`vendor/…/psychogeographic/PsychogeographicMap.tsx:188`).
- **Port**: the drawing is **not kept** — a polygon layer on the globe would be new geometry, not a port; the place is
  listed with its reason, never drawn as a point.
- **Home**: plate, Locations (the row's reason; "not on the Earth").

### lane-4 T10 — The precision grammar
- **Atlas already**: draws each occurrence by its precision (`src/globe/presences.ts:135`).
- **Frame did**: `markerKindFor` over the cradle's precisionMarker (`vendor/…/psychogeographic/placeNavigation.ts:113`).
- **Port**: every Locations row wears the cradle authority's marker (solid · halo · outline · no-coordinate,
  `places/placesModel.ts:77` placeRows over project.ts precisionMarker), with the precision chips; never upgraded.
- **Home**: plate, Locations (`places/PlacesPlate.tsx:217`); stage.

### lane-4 T11 — Routes with stops
- **Atlas already**: a subject's thread is walked in date order with arcs between its places (`src/state/store.ts:134`
  startThread, `src/globe/arcs.ts:49`); a walk of fewer than two stops is not walked (`src/app/controller.ts:540`).
- **Frame did**: TRAVELLED_TO as a numbered route (`vendor/…/psychogeographic/renderer.ts:122`).
- **Port**: each subject's TRAVELLED_TO places are listed as its walk, walkable at two stops
  (`places/placesModel.ts:159` routeRows); the Earth draws it as its own walk.
- **Home**: plate, Relations (`places/PlacesPlate.tsx:264`); stage.

### lane-4 T12 — Hierarchy edges
- **Atlas already**: none drawn.
- **Frame did**: dashed LOCATED_IN edges (`vendor/…/psychogeographic/renderer.ts:124`).
- **Port**: the hierarchy the owner declares is carried verbatim (`provider/suiteReading.ts` facetFieldsOf → SuitePlace
  `within`) and listed, "listed honestly but not drawn" (the target's own clause). Drawing the edges is **not kept**: the
  atlas's arcs are walk arcs.
- **Home**: plate, Relations (`places/PlacesPlate.tsx:261`, `places/placesModel.ts:144` withinRows).

### lane-4 T13 — Provenance on every place
- **Atlas already**: each occurrence cites its owner and revision (`provider/suiteReading.ts` cites and body lines).
- **Frame did**: a provenance block (`vendor/…/psychogeographic/placeProvenance.ts:2`).
- **Port**: each Locations row says owner · reading · revision · evidence, naming an absence rather than inventing a source
  (`places/placesModel.ts:60` provenanceLine); the chosen row shows it in full.
- **Home**: plate, Locations (row title; the chosen row's line).

### lane-4 T14 — The time slider over dated events
- **Atlas already**: one deep-time clock bound to the shared window (`sharedClock.ts:102`); its scrubber is the Deep time
  device (`inhabitants/atlasFaceBodies.tsx:178`).
- **Frame did**: a docked time control (`vendor/…/psychogeographic/placeTimeControl.ts:2`).
- **Port**: the atlas's own time strip stands down in the pane (`atlasHost.css:57`); the window's two edges are read on the
  transport's punch-in and punch-out (`places/placesTransport.ts:55` atlasTimeBindings, `sharedClock.ts:61`
  windowEdgeYear); the scrubber is M0's Deep time.
- **Home**: transport (punch-in, punch-out); M0 (Deep time).

### lane-4 T15 — Playback
- **Atlas already**: Play advances the clock and commits the window as it goes (`src/state/timeModel.ts:179`); while a
  thread's walk stands the one button serves it (`src/ui/time-control.ts:35`).
- **Frame did**: animate the window (`fsj/src/researchInstruments.tsx:1662`).
- **Port**: Technē's Play presses the atlas's one time button and Stop pauses what plays (`places/placesTransport.ts`;
  `src/ui/time-control.ts:88` togglePlay, `:83` walk, recorded on PORT-PIN). Refused, by name, while the Earth is not open.
- **Home**: transport (Play, Stop).

### lane-4 T16 — Historical-imagery honesty
- **Atlas already**: one season of imagery.
- **Frame did**: the imagery readout (`vendor/…/psychogeographic/disclosure.ts:82`).
- **Port**: "One season: the time window narrows what is placed, never the imagery (no time-dimension imagery source is
  disclosed)".
- **Home**: plate, Landmass (`places/PlacesPlate.tsx:291`).

### lane-4 T17 — Click to create a placemark
- **Atlas already**: none.
- **Frame did**: "Add place here" → the constellation route with an approximate draft
  (`vendor/…/psychogeographic/placeAuthoring.ts:2`, `fsj/src/researchInstruments.tsx:1496`).
- **Port**: the plate's ✎ Place arms the tool for the subject the Earth has selected; the next click on the globe is read
  through the atlas's own surface maths (`places/placesHost.ts:108` pointUnder) and becomes the frame's own draft
  (`places/placeTool.ts:96` draftAt over placeAuthoring.ts prefillFromClick / placeDraftForAdd / validatePlaceDraft), offered
  to the owner the frame's route reached — the Wiki's time-and-place editor (`desktop/cradle/src/knowledge/WikiFactsEditor.tsx:24`
  offerConstellationRoute, as `desktop/cradle/src/CradleFrame.tsx:1134` offered it). "Open the editor" opens the subject in
  Graph and source (`oi:epi-open-knowledge`), where "Edit time and place" applies the draft; the person chooses a source and
  saves. No Scene is needed: the subject's own node is the facts' owner. The owner's answer returns on
  `oi:constellation-result` (WikiFactsEditor.tsx:65); a save reads the world again and redraws the subject in place
  (`places/placesHost.ts:148`).
- **Home**: plate, Locations (✎ Place, `places/PlacesPlate.tsx:203`); stage (the click).

### lane-4 T18 — Placemarks carry their source basis
- **Atlas already**: none.
- **Frame did**: refusals verbatim (`fsj/src/researchInstruments.tsx:1496`).
- **Port**: the editor's save refuses a missing or stale basis; the plate shows the owner's words unchanged
  (`places/placeTool.ts:141` placeAnswered over placeAuthoring.ts constellationResultNotice).
- **Home**: plate, Locations (the tool's line).

### lane-4 T19 — Refine with honest precision
- **Atlas already**: a drag turns the globe.
- **Frame did**: a draggable marker proposed a move (`vendor/…/psychogeographic/renderer.ts:149`).
- **Port**: choose one of the subject's located places in Locations, then Place: the click is a move proposal at the
  place's own precision, citing its evidence, refused by name without one and never for an exact fix
  (`places/placeTool.ts:96` over placeAuthoring.ts moveProposal / placeDraftForMove). The gesture is a click, not a drag,
  because the atlas's drag is its own orbit.
- **Home**: plate, Locations; stage (the click).

### lane-4 T20 — Named map views
- **Atlas already**: its state and filter are its linkable address (`src/app/controller.ts:453` syncHash).
- **Frame did**: "Save view…" into the Scene's research material (`fsj/src/researchInstruments.tsx:1532`).
- **Port**: **not ported here**. Its DLW home is the transport's Capture ("View → scene"), which has no binding or owner
  write from the shell yet; the frame's writer needed an open Scene. Scenes saved before keep their place views: the
  material still admits them (`fsj/tests/places-views.test.mjs`). OPEN in the return.
- **Home**: transport (Capture), waiting.

### lane-4 T21 — Layer visibility per Scene
- **Atlas already**: the filter in force rides the atlas's linkable address (`src/app/controller.ts:453`).
- **Frame did**: the layers record in the Scene's material (`fsj/src/placeViews.ts:79`).
- **Port**: per-Scene persistence is **not ported** (no Scene stands under the atlas); the Relations rows narrow the one
  filter, which the atlas keeps as its own state.
- **Home**: plate, Relations.

### lane-4 T22 — Search and fly
- **Atlas already**: one search over the field (`src/data/search.ts:262`), chosen through the controller
  (`src/app/controller.ts:641` chooseResult).
- **Frame did**: the Places lens's search (`fsj/src/placeSearchPanel.tsx:1`).
- **Port**: the plate's Find narrows the world's own places (`places/placesModel.ts:182` findPlaceRows) and lists the field's
  own search results beneath, each chosen through `chooseResult` (made public, PORT-PIN). ⌘K still opens the atlas's own.
- **Home**: plate, Locations ("Find a place…", `places/PlacesPlate.tsx:223`).

### lane-4 T23 — Place → subject → timeline
- **Atlas already**: focusing a subject rescopes the clock to its span, and a moved cursor is committed to the shared window
  (`src/app/controller.ts:792` rescope; timeModel's commit), which the Timeline reads.
- **Frame did**: "Open in Timeline" (`vendor/…/psychogeographic/PsychogeographicMap.tsx:210`).
- **Port**: the chosen place's "Window to its validity" writes the place's own validity to the shared window through the
  session's compare-and-set writer (`sharedClock.ts:83` writeSharedWindow; `places/PlacesPlate.tsx:231`); the Timeline and
  the Earth stand in it. "Open source" is the subject's own page in Graph and source.
- **Home**: plate, Locations (the chosen place's line).

### lane-4 T24 — Focus reopen on the globe
- **Atlas already**: none for places.
- **Frame did**: honoured the session's spatial focus once (`vendor/…/psychogeographic/PsychogeographicMap.tsx:584`).
- **Port**: the Earth honours the spatial focus standing when it mounts, and every change after
  (`places/placesHost.ts:85`); a ref the world does not hold turns nothing, with no error.
- **Home**: stage.

### lane-4 T25 — Tour recording
- **Atlas already**: walks of a thread, played on the one time button (`src/state/store.ts:134`; time-control.ts:35).
- **Frame did**: recorded camera waypoints (`fsj/src/placeTourPanel.tsx:1`).
- **Port**: playback is the atlas's walk on Technē's Play. Recording is **not ported**: its home is the transport's Record
  ("Record a walk"), whose writer waits for the journey owner (modeGrammar's Technē waiting note). OPEN in the return.
- **Home**: transport (Play; Record waiting).

### lane-4 T26 — Journey binding
- **Atlas already**: the thread walk is the journey's material.
- **Frame did**: a tour stop bound to a journey beat by ref (`fsj/src/placeTours.ts:1`).
- **Port**: **not kept on M4**: binding a stop to a beat is M3′ Journey's, and its own target says M4′ "renders nothing
  journey-owned".
- **Home**: M3′ (not this ticket).

### lane-4 T27 — Day and night
- **Atlas already**: the Earth is lit by the sky layer's Sun — day and night, and a hairline of twilight on the terminator
  (`src/globe/engine.ts:352`, `src/globe/shaders.ts:293-318`); the QL owner's stated subsolar point is the Sun the Earth
  draws for the instant it shows (`inhabitants/qlSkyEarthAdapter.ts`, the attach's Sun follower).
- **Frame did**: shading from the Nara transit's subsolar point (`fsj/src/researchInstruments.tsx:290`).
- **Port**: the Sun's words — placed, or the owner's reason — and whether the Earth is lit, on the plate; the same words in
  the Info view's hover, never over the globe (`AtlasProjectionPanel.tsx:53` earthWords).
- **Home**: plate, Sky (`places/PlacesPlate.tsx:153`); stage.

### lane-4 T28 — The ladder where you stand
- **Atlas already**: its scales (system in the sky, body, region).
- **Frame did**: rung summaries in the layers panel (`vendor/…/psychogeographic/PsychogeographicMap.tsx:216`).
- **Port**: the five rungs by world.ts's labels, each read from what the Earth holds (the QL Sun, the window, the places
  declared, those drawn and their walks; Nara, which no owner discloses here); none is shown present that is not.
- **Home**: plate, Sky ("Frames", `places/PlacesPlate.tsx:155`); the plate's head names the scale.

### lane-4 T29 — Stillness
- **Atlas already**: the globe turns slowly only until it is first touched, and never under reduced motion
  (`src/globe/controls.ts:643`); flights ease and finish.
- **Frame did**: no idle motion at all (`vendor/…/psychogeographic/placeNavigation.ts:346`).
- **Port**: the atlas's own is kept. Judged against the manual: "a planet turning slowly under its star" (DLW.md §2) is
  the body's first presentation; after a touch it is still.
- **Home**: stage.

### lane-4 T30 — The mythic visibly distinct
- **Atlas already**: MYTH_LOCATED_AT is a myth episode, never a historical event (`provider/suiteReading.ts`
  locusOfRelation over world.ts relationStandingClass).
- **Frame did**: a mythic marker and inspector tag (`vendor/…/psychogeographic/LocationPanel.tsx:13`).
- **Port**: one grammar on the plate — a dashed swatch and a "mythic" tag wherever a mythic place or relation is named
  (`places/PlacesPlate.tsx:218, :258`; `placesPlate.css` the standing rules).
- **Home**: plate, Locations and Relations.

## What else moved off the pane

The lead's native pass at `11475cc3d` saw, inside the Earth pane, the atlas's own chrome and onboarding. Each now has its
home off the pane (`atlasHost.css:57`; `AtlasProjectionPanel.tsx`):

- the lens chooser ("Field ▾") → the plate's Body section, "Lens" (`places/PlacesPlate.tsx:110` LensRow, the controller's own
  `openLens`); its menu and filter chips stand down with it;
- the Earth ⇄ Graph pill → M0's Earth ⇄ Graph device (and the G key);
- the corner (search, GitHub) → the plate's Find (⌘K still opens the atlas's own search); the GitHub link is the standalone
  site's;
- the time strip → the transport and M0's Deep time;
- the onboarding paragraph and "Start at the Self" → not shown: the landing is left unbound, which counts as seen — the
  port's own adaptation note says "the O:I shell is its own front door" (`src/shell/landing.ts`);
- the world's standing and the Sun's line → the Info view's hover (the globe's `data-i`) and the plate (Locations, Sky).

Still in the pane, named in the return: the subject's focus label (its title, line and two acts, the atlas's encounter),
the image plates on the bodies, and a lens's own title and controls while a lens other than Field stands.

## What was removed, and what stays

Removed: the frame's Places map and its overlays (`vendor/…/psychogeographic/` PsychogeographicMap, LocationPanel,
basemapLayers, disclosure, geometry, mapStyle, placeLayers, placeNavigation, placeProvenance, placeRoutes, placeStanding,
placeTimeControl, renderer, terminator); the Places lens's panels (`fsj/src/` placeFacetsPanel, placeReading, placeSearch,
placeSearchPanel, placeStanding, placeTourPanel, placeTourPlayback, placeTourSession, placeTours, placeViews); the lens's
render path in `fsj/src/researchInstruments.tsx` (asked for, it says where Places went); its chooser entry
(`fsj/src/lensStudio.ts`); the barrel export (`vendor/research-canvas/components.ts`); the Expressions › Knowledge ›
Places row (`packages/live-shell/ui/src/components/NativeTechneBrowser.tsx`).

Stays, because product outside this ticket reads it: `psychogeographic/placeAuthoring.ts` (the draft contract the owner's
editor validates — `desktop/cradle/src/knowledge/WikiFactsEditor.tsx`, `desktop/cradle/src/expressions/PointCloudHost.tsx`,
`fsj/src/kernelExpressions.ts`, and now the atlas's Place tool); `psychogeographic/basemapSources.ts` (the closed ids the
Scene material validates, `fsj/src/researchMaterial.ts`); `fsj/src/placeTourRecord.ts` (the same material's tour law).
Scenes saved before keep their place views, layers and tours as inert, validated data.
