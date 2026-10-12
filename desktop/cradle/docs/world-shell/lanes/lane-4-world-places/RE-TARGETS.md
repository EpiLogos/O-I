# Lane 4 — RE target selection — M4′ World/Places

Campaign: 2026-10-07 technè instrument RE programme · lane 4 of 5.
Method: `reverse-engineering-playbook` — possession checked and recorded per
candidate; no possession, no RE (blocked-with-reason instead). Feature
families come from the owner's bar: "basically a Google Earth clone that we
want, plus the data viewing layers overtop" (PROGRAMME.md:5-6), mapped onto
the gaps in FINDINGS.md §5.

## Feature families to cover

| # | Family | Source gap (FINDINGS §5) |
|---|---|---|
| F1 | Globe navigation: fly-to, tilt/pitch, rotate/heading, inertia | G3 |
| F2 | Imagery/terrain layer stack (basemap truth, satellite, elevation) | G1, G2 |
| F3 | Data overlay layers bound to the real relation field (points / paths / regions with provenance) | G7, G8 |
| F4 | Time slider / time-dynamic animation over dated events | G5 |
| F5 | Placemark creation tied to wiki subjects; data-saving targets | G6, §2 |
| F6 | Precision/uncertainty rendering grammar on the globe | G11 |
| F7 | Search and fly-to-subject | G4 |
| F8 | Tour recording (camera path) | G9 |
| F9 | Navigation targets: place → subject → timeline identity | G10 |
| F10 | UX reference bar: navigation feel, search-and-fly, historical imagery, tours, layers panel | the bar itself |

## Candidates surveyed

### 1. MapLibre GL JS — POSSESSED (in-tree, installed)

- **Possession**: `maplibre-gl@6.11.1` installed at
  `desktop/cradle/expressions-app/node_modules/maplibre-gl/` (declared
  `expressions-app/package.json:24`); it is ALREADY the M4′ renderer — the
  vendored Research Canvas `PsychogeographicMap` mounts it
  (FINDINGS §3b), and the vendor declares `^6.2.0`
  (`vendor/research-canvas/packages/canvas/package.json:23`).
- **Verified capability surface** (from the installed typings
  `dist/maplibre-gl.d.ts`, checked this pass): globe projection —
  `setProjection(projection?: ProjectionSpecification)` (lines 10004,
  15548) with a `projectiontransition` event (9588) and a `GlobeControl`;
  terrain — `TerrainSpecification` + `RasterDEMSourceSpecification` in the
  type imports (line 4) and a raster-dem tile manager (7958-8111); sky —
  `setSky(SkySpecification)` (1956, 10006); camera — `flyTo` (11417),
  `easeTo` (11359), `jumpTo` (11352), `setPitch` (11323), `setBearing`
  (11315), `rotateTo` (11318); interaction toggles `dragRotate` (12208),
  `doubleClickZoom` (12456); picking — `queryRenderedFeatures` (14
  declaration sites). Public docs corroborate: globe examples including
  atmosphere and globe-with-terrain
  (https://maplibre.org/maplibre-gl-js/docs/ → examples/
  `display-a-globe-with-an-atmosphere/`,
  `create-a-heatmap-layer-on-a-globe-with-terrain-elevation/`; API
  `classes/GlobeControl/`).
- **Fit**: covers F1 (fly-to/pitch/bearing/inertia controls), F2 (raster
  tile imagery + raster-dem terrain), F3 (style layers + data-driven
  styling over GeoJSON sources), F6 (layer paint properties), F7/F8/F9
  (app-level code over these APIs). The offline-first law and the
  opt-in live-service policy are already the mount's own posture
  (FINDINGS §3b) — the honest-provider law carries over unchanged.

### 2. CesiumJS — POSSESSED (open-source clone, this pass)

- **Possession**: Apache-2.0 open source; shallow clone at
  `/tmp/re-lane4-cesium`, commit `a3aea90b28d913faa3dd41454c5ab40f7e912459`
  (main, 2026-10-06). Not a cradle dependency; scratch only, never under
  ~/Central.
- **Verified reference behavior** (file:line in the clone):
  - Camera choreography: `Camera.prototype.flyTo` (packages/engine/Source/
    Scene/Camera.js:3427), `flyToBoundingSphere` (3662), `lookAt` (2333),
    `lookAtWorldPosition` (2507), free rotation `rotate`/`rotateDown/Up/
    Left/Right` (2030-2160), `twistLeft` (1999), `lookLeft` (1895) — a full
    heading/pitch/twist vocabulary; inertial drag via
    `ScreenSpaceCameraController` `inertiaSpin = 0.9`
    (Scene/ScreenSpaceCameraController.js:98).
  - Time-dynamic: `Clock` with `currentTime`, `multiplier`, `clockRange`
    (packages/core/Source/Clock.js:106-138) and `tick()` raising `onTick`
    (258-313); `Timeline` widget bound to the clock with `zoomTo(startTime,
    stopTime)` (packages/widgets/Source/Timeline/Timeline.js:103, 163,
    273); an `Animation` widget (packages/widgets/Source/Animation/).
  - Entity model: `Entity` carries point / polyline / polygon / path /
    label graphics plus `availability` as a `TimeIntervalCollection`
    (packages/engine/Source/DataSources/Entity.js:91-96, 241, 622;
    packages/core/Source/TimeIntervalCollection.js:23) — objects that exist
    only inside time intervals, the exact law M4′ needs for
    validity-bounded places.
  - Data loading: `GeoJsonDataSource` (marker-color/marker-symbol/stroke
    property mapping, DataSources/GeoJsonDataSource.js:60-65);
    `CzmlDataSource.load` (DataSources/CzmlDataSource.js:4870) — CZML,
    time-dynamic documents.
  - Imagery/terrain stack: `ImageryLayerCollection.add` /
    `addImageryProvider` (Scene/ImageryLayerCollection.js:94, 143);
    `EllipsoidTerrainProvider`
    (Core/EllipsoidTerrainProvider.js); `sampleTerrain`
    (Core/sampleTerrain.js:17-34) — noting `createWorldTerrainAsync` is an
    ion-gated asset (sampleTerrain.js:29).
  - Picking: `Scene.prototype.pick` (Scene/Scene.js:4778), `pickAsync`
    (4841).
- **Fit vs cost**: Cesium is the strongest *reference* for F1 (fly-to
  curves, lookAt/tilt semantics), F4 (Clock/Timeline/availability model)
  and entity time-intervals. But adopting it as a second globe engine would
  (a) duplicate the renderer TD8 forbids ("no duplicate point-cloud, graph,
  globe or media loops", TECHNE-DUAL-READING.md §TD8), (b) discard the
  vendored surface's law-proven markers/lanes/offline posture, (c) gate the
  headline imagery/terrain assets (world terrain, Bing/satellite) behind
  Cesium ion accounts — exactly the fake-provider-availability trap TD5
  forbids. **Decision: reference target, not an engine swap.** Re-entry
  conditions recorded below.

### 3. Google Earth (web) — observable, not captured

- **Possession**: the web app is publicly observable at
  https://earth.google.com/ ; no account-gated material used. **Google
  Earth Pro desktop is NOT installed on this machine** — recorded as
  candidate-requiring-install if the later RE pass needs binary-level
  study (historical-imagery slider internals, tour file format KML/KMZ
  ground truth).
- **Use**: F10 UX reference bar only, from documented, well-known
  behaviors with official sources: navigation (drag to spin, pinch/scroll
  to zoom, ctrl-drag to tilt/rotate), search-and-fly, placemarks (saved to
  "My Places"), historical-imagery time slider where imagery exists,
  Voyager tours, layers panel (borders/roads/terrain/photos). Official
  help: https://support.google.com/earth/ (categories "Navigating",
  "Creating and collaborating on projects"). Confidence: high for behavior
  shape; the app itself was not driven by this lane (no `rea` captures —
  timebox left unused deliberately to conserve the rate-limited account;
  named in limitations).

### 4. deck.gl — NOT POSSESSED (docs-level only)

- Open-source (MIT), would need a new dependency. Not installed anywhere in
  the tree. Survey verdict: **not chosen** — deck.gl earns its cost at
  10k–100k+ layered data visualizations; the register field's place facet
  counts are orders of magnitude below that, and MapLibre's GeoJSON
  sources + DOM markers already carry points/lines/fill layers. Record as
  a future option if a register ever carries massive overlays.

### 5. NASA Worldview — OPEN (web), cited as precedent

- **Possession**: publicly observable at https://worldview.earthdata.nasa.gov/
  (verified reachable this pass); source open at
  https://github.com/nasa-gibs/worldview. Not cloned.
- **Use**: F4 precedent only — its animation of a date-driven layer
  sequence (an "animate" mode stepping a temporal window across dates) is
  the nearest open reference for a time slider over dated map content.
  Cited as UI precedent; no code recovered.

### 6. QGIS — NOT INSTALLED (docs precedent only)

- Open-source desktop GIS; not installed on this machine (recorded:
  candidate-requiring-install if layer-tree semantics need desktop-grade
  study). **Use**: F3/F10 precedent — layer tree with per-layer
  visibility/symbology/legend and the Temporal Controller (a docked
  time control that drives temporal layers) are the canonical
  open references for "data viewing layers overtop" semantics.
  Official docs: https://docs.qgis.org/latest/en/docs/user_manual/
  (layer tree; temporal controller). Cited as semantics precedent only.

## Chosen targets and reasoning per family

**Primary target: MapLibre GL JS 6.11.1 (already possessed and already the
M4′ surface) extended in place, inside the vendored Research Canvas mount.**
Every family lands either as a MapLibre capability (F1, F2, F3, F6) or as
app-level machinery over it (F4 slider, F5 placemark authoring, F7 search,
F8 tours, F9 navigation) — genuine functionality parity without a second
globe, honoring TD8 and the vendored surface's provenance law
(PROVENANCE.json records byte-exact vendor scope; new capability lands as
the host's own code, not vendor patches).

**Reference target: CesiumJS** (clone recorded above) for behavioral ground
truth on fly-to choreography, the Clock/Timeline/availability time model,
and entity-vs-interval semantics — consulted in phase 3 when writing the
implementable contracts, cited by file:line in the clone.

**UX bar: Google Earth (web, documented) + NASA Worldview (time animation)
+ QGIS (layer semantics).**

**Blocked / requiring install (recorded, not blocking):**
- Google Earth Pro desktop — not installed; only needed if binary-level
  study of tours/historical imagery is later commissioned.
- QGIS — not installed; docs-level precedent suffices for the target set.
- Cesium ion world terrain / satellite assets — account-gated; NOT usable
  as an M4′ dependency under the no-fake-provider law; irrelevant under
  the maplibre-primary decision.

**Limitations of this selection (named):** no dynamic captures of Google
Earth web or NASA Worldview were made (static/documented behaviors only);
MapLibre capability claims rest on the installed typings read this pass
plus official docs, not on a driven run; CesiumJS evidence is a
same-week main clone (a3aea90b…), not a release tag — behavior cited is
stable API surface (Camera/Clock/Entity/DataSource), low drift risk.
