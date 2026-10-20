# T-PROCEDURAL-BODY — worlds you build, at the Earth's standard (20 Oct 2026)

Reopens T-WORLDS §5 (W3). W3 built the plumbing of a world's body: a record, a generator, your system, landings. It checked the plumbing and
never the picture. The picture is far below the Earth's, the planet has little on it, and the system puts too much in orbit. This ticket
holds the planet to the Earth's own numbers, finishes what the manual (§17.2) says a planet is, and takes the orbit rule from the owner.

Owner, 20 Oct 2026: the procedural system "feels a little bit thin on the ground, unintegrated into the devices ontology cleanly", the
render against the Earth "is utterly dogshite in terms of quality and pixel quality", the generator "is barely generating the elements of
the planet". The spec is "a truly customisable procedural system for the planet creation logic, with actual places etc as visitable
locations, the temporality of the object baked into the overall experience, the locations actually in the original Archetypal Earth
style, and for now orbits to a minimum: orbits should be reserved for agentic works and recent artefacts therefrom."

## 1. What is wrong, measured

The finding is in `evidence/procedural-body-20261020/before/`. The Earth is NASA Blue Marble photography: 8192×4096 (4.9 km a texel),
with NASA GIBS tiles down to about 0.6 km a texel at close zoom. A generated body is one value-noise height function (3–5 octaves) turned
into five flat colours, drawn 1024 wide on a capable GPU and 512 on a weak one (`engine.ts:581`): 39 km a texel, 64 times fewer pixels,
and no close-zoom layer at all (`engine.ts:503`, `tiles.group.visible = on && !earth.generated`). The noise is the World design's gallery
preview (`atlas-earth__globe-engine.tsx:512-542`) promoted into the engine. MAP had recorded that the AE globe is the real body engine
and the mockup's CPU noise a stand-in; T-WORLDS §5 specified the stand-in as the generator.

What the body lacks, by the manual's own words (§17.2): continents that read as continents; relief that reads as mountains; a coast
that runs smooth, fjord or archipelago and shows it; warmth, moisture and ice caps that make deserts, forests, tundra and a snow line
and a ragged ice margin (today a latitude ruler: spread 0°, the Earth's is 5.1°); an atmosphere and clouds that are weather; "a book's
world a small grey moon you have barely shaped; a project you have lived in for a year a planet with weather" (nothing derives a body
from a world: every first body is the same dials with a different seed).

What the verification missed: PATH's "Seen" rows for W3 (r18–r22) confirm the record is read, the rows write and the landing lands. None
compares a pixel with the Earth's.

## 2. Rulings and limits (settled; not to be asked)

- **The record does not change.** `aikit.world-body/v1` keeps its fields. ai-kit's validator takes generator id `fbm-sphere` and any
  version from 1 (`knowledge_wiki_facts.rs:134-141`), so the new generator is `fbm-sphere` version 2 and no AIKit change is needed. A
  body built by version 1 keeps drawing as version 1, byte for byte; its next change (any dial, a reroll) rebuilds it as version 2. New
  dials, if the owner wants them, are a manual change first.
- **Earth stays given.** Its imagery, tiles and places are untouched. The Earth's pictures stay AE's bytes.
- **No ecology.** No bees, trees, rivers drawn as creatures, no agent faces. The creatures are the face-rig roster and the owner's to place
  (T-WORLDS §1). Hydrology here is terrain: a river is a line of water in a valley, a lake a basin.
- **Orbits are for agentic work.** What rides a body's rings: the agents at work (inner ring) and the recent artefacts they made (outer
  ring). Not pages, not the open file, not works to hand. Manual §17.2 says otherwise today and is changed in this ticket.
- **Nothing is random.** The same record, look and time give the same bytes, in a worker or on the main thread.
- **The shell holds no body.** The owner's record is the body. Maturity, look and weather are readings computed from owner readings, held
  nowhere, written nowhere.

## 3. The boundary: verification first

Tests are the quality boundary. They land red before any implementation, and they are not softened to pass.

**The lead's boundary** (lane builders do not edit these; a change is argued here):

| File | What it holds |
|---|---|
| `tests/lib/planetMetrics.mjs` | Pure measures of an equirect image: fine detail by scale, spectral tilt, coast per land pixel, separate lands, palette cells and entropy, ice-edge spread, seam ratio; and `assessPlanet`, the gate's clauses, each a fraction or multiple of the Earth's own number |
| `tests/fixtures/planet-reference.json` | The Earth's numbers (`earth-2k.jpg`, sha256 recorded), two calibration images (the Earth blurred; the Earth with ±5 noise), and v1's recorded numbers on four bodies |
| `scripts/measure-planet-reference.mjs` | Regenerates the fixture (macOS `sips` decodes the JPEG once; CI never decodes) |
| `tests/w3q-planet-gate.test.mjs` | A: the gate has teeth (the Earth passes; blurred and noisy Earth fail; v1 fails). B: four fixed bodies at 2048 wide stand at the Earth's standard. C: version 1 is byte-stable; the shell names version 2. D: the base widths, procedural tiles at close zoom, tile seams, a tile's agreement with its base, a deep tile's detail, tile time |

`W3Q_GATE=enforce node --experimental-strip-types --test tests/w3q-planet-gate.test.mjs` runs the red state. Before the ticket lands the
B, C2, C3 and D tests carry `todo` so the suite stays green; the lead removes `pending` from them when the lanes are done.

The gate's teeth were measured: the Earth passes itself; the Earth blurred by one pixel fails land and sea detail; the Earth with ±5 of
noise fails the sea tilt and the shoreline; v1 fails 4 to 9 clauses on each body (the fjord coast, the noisiest, the fewest). The tile tests were run against two fake generators (the
base enlarged; the base enlarged with noise) and told them apart: D3–D5 and D7 pass, D6 fails on detail, or on tilt with noise.

**The lanes' own tests** land first, red, in the files named in §5 and §6, and their red output is part of the lane's first return.
A test that passes before its work exists is a wrong test: fix the test. For each behaviour a lane lists, the test fails when the
behaviour is removed (the lane shows it, once, by reverting the line or breaking the value, in its return).

## 4. Contract between the lanes

Both lanes code to these names. A lane that needs a name to change tells the lead; it does not rename in place.

```ts
// globe/body.ts (Lane A)
export const WORLD_BODY_GENERATOR_VERSION = 2
export const BODY_WIDTHS = { first: 256, lo: 2048, hi: 4096 } as const        // first, small-GPU, capable-GPU base widths
export interface BodyLook { readonly barren?: number }                       // 0 lived-in … 1 a barely shaped moon; default 0
export function bodyImage(record, width, look?: BodyLook): BodyImage         // dispatches on record.generator.version (1: legacy, 2: this ticket)
export function cloudImage(record, width, look?: BodyLook): BodyImage
export function bodyDisc(record, size, look?: BodyLook, timeMs?: number): BodyImage   // timeMs: the occasion, so a disc carries its weather too
export function airOf(record, look?: BodyLook): number
export function weatherShift(record, latDeg, timeMs): number                // degrees of longitude the cloud mask is carried at that latitude at that time
// globe/bodyTiles.ts (Lane A)
export function bodyTile(record, z, x, y, look?: BodyLook): BodyImage        // 256×256 RGBA, web-mercator slippy (tilemath.ts), same field as bodyImage
export function tileLevelFor(baseWidth: number): number                      // log2(base/256)+1: 6 at 8192, 5 at 4096, 4 at 2048 (GIBS's own rule)
// globe/tiles.ts (Lane A): TileLayer.setSource(source: TileSource); TileSource = {load(z, x, y, signal): Promise<ImageBitmap | HTMLImageElement | BodyImage>}; GIBS stays the default
// globe/bodyRender.ts (Lane A): renderBody(record, width, cloudWidth, look?) and renderTile(record, z, x, y, look?) — in a worker where the page can start one, else on the main thread
// globe/engine.ts (Lane A)
setBody(record: WorldBodyRecord | null, look?: BodyLook): void
setBodyTime(ms: number | null): void                                          // the occasion; null is Now
// system/maturity.ts (Lane B)
export function maturityOf(facts: WorldFacts): number                         // 0 new … 1 lived in; pure
export function lookOf(maturity: number): BodyLook                            // barren = 1 − smoothstep(...)
// system/systemModel.ts (Lane B): SystemBody gains `look: BodyLook`; SystemSatellite.kind is 'session' | 'artifact'
```

## 5. Lane A — the generator and what it draws (`claude-code:procedural-body-generator`)

Zone: `projections/atlas/src/globe/**`, `projections/atlas/body/**`, `PORT-PIN.json` (records only), the World design's `BodyArt` preview
(`inhabitants/catalogue/panels/atlas-earth__globe-engine.tsx`, the preview's drawing only, so the Body page and the globe draw one
body), and its tests (`tests/w3q-gen-*.test.mjs`, `tests/golden/planet/`, `tests/w3-world-body-generator.test.mjs`).

**Generator version 2** is a new pure field `sampleBody(record, look, x, y, z, detail)` evaluated at any point of the unit sphere to any
level of detail, so the base image, a tile and the Place tool's land test are one function. It draws, from the existing dials and
seed alone:

| Dial | What it does in version 2 (each row a lane test) |
|---|---|
| Sea level | The share of the surface that is land falls steadily as the dial rises (more sea), with the default near the Earth's 30 % of land (`landShare` in .22–.40); 0 gives a world of land, 1 a world of sea |
| Continents | A large-scale plate-like mask places that many separate lands: one supercontinent near .6, six or more near 3.6 |
| Relief | Flat plains at 0; ranges of ridged mountains at 1, strongest in a continent's interior; rock and snow share rises with it |
| Coast | Smooth, fjord and archipelago differ in shoreline per land pixel and in separate lands (archipelago at least twice smooth's), each at every scale (fractal) |
| Warmth, moisture | Temperature from latitude, height and warmth; moisture from latitude bands (wet equator, dry subtropics, wet mid-latitudes), distance from the sea and moisture; a biome from the two (desert, savanna, forest, jungle, grass, tundra), snow above a snow line |
| Ice caps | A ragged margin (noise on the latitude), sea ice and land ice, in step with warmth; none at 0 |
| Atmosphere, clouds | Air at the limb, in step with `airOf`; a cloud mask whose cover rises with the dial and whose bands follow latitude |
| Axial tilt | Seasons from the Sun's declination (`bodySunDir` stays): the light and the day and night swing with the year. The ice and snow are the annual picture and do not lean with it: nothing carries a season into the image, and none is faked |

Also in version 2: bathymetry (shelf, slope, abyssal plain, ridges and trenches, lit as the shader's `waterOf` and shelf expect); lakes in
basins and rivers in valleys that reach the sea; relief shading from the height gradient; the colour cues `EARTH_FRAG` reads kept as the
current generator keeps them (`globe/shaders.ts` EARTH_COMMON).

**The pipeline.** Widths from `BODY_WIDTHS` (the engine's `1024 : 512` goes): the globe draws a `first` image at once, then the larger
ones as the worker finishes them, each swapped in as the Earth's 2k and 8k are. Aim at under 5 s for a 2048 image on a CPU thread (the gate
allows 20), by tables and typed arrays, not by lowering the standard. **Procedural tiles** take the Earth's GIBS tiles' place for a
generated body: `TileLayer` takes a tile source (the GIBS source stays the default and its tests stay green); a procedural source asks
the worker for `bodyTile`, never the network; tiles are requested only where denser than the base (level `log2(base/256)+1`, as GIBS's are);
no hole, no flash, an LRU bound on kept tiles; `earth.generated` no longer turns the layer off.

**Look and weather.** `look.barren` takes a body toward a grey, airless, dry moon: land loses its colour, the sea draws back to dust, the
cloud mask empties, `airOf` falls to 0; monotone in between. Weather is `weatherShift`: clouds are carried at a speed that differs by
latitude band, a pure function of the seed, the latitude and the time; the shader slides the mask by it through a uniform (`uWeatherT`),
so a past occasion shows the weather it had and Now moves slowly; reduced motion holds it still.

**Version policy.** `WORLD_BODY_GENERATOR_VERSION` is 2; `firstBody` and `changedBody` write version 2; `parseWorldBody` reads 1 and 2 and
refuses a newer version in words; `bodyImage` and the rest dispatch on the record's version. The legacy v1 code moves, byte-stable, into
its own module.

**Tests, first (red), in these files:**
`w3q-gen-determinism` (purity; worker equals main; no `Math.random`/`Date` in the generator; the version dispatch; v1 byte-stable),
`w3q-gen-dials` (every row of the table above: monotone or ordered across at least three seeds at 512 wide),
`w3q-gen-elements` (rivers and lakes in low ground and reaching the sea; bathymetry from the coast outward; biome order by latitude;
snow only above the snow line; ice margin ragged and absent at 0; relief shading follows the gradient),
`w3q-gen-look-weather` (barren monotone and grey; `weatherShift` pure, differential by latitude, continuous in time, bounded; the cloud
cover rises with the dial; the shader uses `uWeatherT`; reduced motion),
`w3q-gen-pipeline` (widths from `BODY_WIDTHS`; first image at once; tile source abstraction, GIBS default unchanged, a procedural source
makes no `fetch`; the LRU bound; the worker falls back to the main thread; tile level rule),
`w3q-gen-places-consistency` (`heightAt`/`isLand`/`shoreOf` agree with `bodyImage`'s water mask at sampled points, 97 % or better,
which keeps the Place tool honest).
Golden images: four 256-wide PNGs under `tests/golden/planet/` with a tolerance and an `UPDATE_GOLDEN=1` path, so a later change to a
body is seen and chosen, never silent.

## 6. Lane B — the system, orbits, maturity, places (`claude-code:procedural-body-system`)

Zone: `projections/atlas/system/**`, `projections/atlas/places/**`, `AtlasProjectionPanel.tsx`, `projections/atlas/src/app/controller.ts`
and `src/sky/orbits.ts` (the host's wiring only, recorded in `PORT-PIN.json`), `inhabitants/ql/devices/atlasDevices.ts`, and its tests
(`tests/w3q-sys-*.test.mjs`, `tests/w3b-your-system.test.mjs`, `tests/w3-world-body-device.test.mjs`).

1. **Orbits to the minimum.** `satellitesOf` (`system/systemModel.ts:121-148`) puts today every playing page and every session on the
   inner ring and the open file and every work to hand on the outer. It becomes: inner, the agents at work in that world; outer, the
   recent artefacts those agents made there, each keyed by its own ref so its place on the ring holds, drifting off as it ages (a window
   the lane names from the owner's source; the newest six per world at most). Kinds are `session` and `artifact`; `page`, `file` and
   `work` go. The lane finds the artefact source in the running system (the run model, Factory, the receipts and returns tied to a
   session); if the shell holds no such reading, it adds the narrowest read through an existing owner op, tested; if it can find none,
   it stops and tells the lead what it searched, and invents nothing. `w3b-your-system.test.mjs` asserts the old rules: its assertions are
   rewritten first and fail against the current code.
2. **Maturity.** `system/maturity.ts`: a world's maturity from owner readings (how long its register has existed, how many pages and
   flows it holds, how many times its body has been shaped), pure, monotone in each, bounded 0–1, the same twice. `lookOf` maps it to
   `barren`. A new empty world is a moon; a world lived in for a year is a planet with weather. The thresholds are named constants with the
   reasoning beside them, and tested at their edges. Your own world is not exempt.
3. **Wiring.** The system overlay's discs and the globe's body take the world's `look` (`bodyDisc(record, size, look)`,
   `engine.setBody(record, look)`); the shared occasion window drives `engine.setBodyTime` (Now is null), through the binding the atlas
   already has for the shared clock (`sharedClock.ts`). Choosing Earth gives `setBody(null)`.
4. **Places on a body, audited against §17.2 and finished.** For each sentence of the manual's "Build a planet", "Your system", scales,
   Rules and "To use the World" that concerns a location, the lane records in its return what the code does, with `file:line`, and a test
   that fails when it stops: placing a place, palace, portal or route by a click; the name suggested from the seed; a place keeping its
   name and position across a reroll and drawn on the nearest shore, said so; flying to a place and ending at a scale that fits its
   precision; selecting a location; entering a landed world; a mythic place looking mythic in every view; names standing at their locations
   at Body and Region scales; anchor lines from a location to its real place on Earth (the PATH row "Earth's places drawn over your body" is
   this). Every sentence the code does not meet, the lane implements within its zone, in the original Archetypal Earth presence style
   (the shared presence shader, `aLocus` for the mythic ring), or reports to the lead with its reason if it needs a name outside the zone.
5. **The device ontology.** The World's Whole already has Body, Landmass, Climate, Sky and Locations (`atlasDevices.ts`). The lane checks
   each row's write lands through the owner and reads back (not just compiles), that the rows say when a body is older than the current
   generator ("its next change rebuilds it"), and that the device's Compact and Widget pictures are the globe's own body (the same
   `bodyDisc`), not a second drawing.

**Tests, first (red):** `w3q-sys-orbits` (inputs → rings: sessions inner, artefacts outer, nothing else; recency and drift-off; the cap;
a stable phase under reorder; a world with no agents has empty rings), `w3q-sys-maturity` (monotone, bounded, deterministic, edges,
never writes), `w3q-sys-wiring` (a stub engine records `setBody(record, look)` and `setBodyTime`; Earth gives null; the overlay discs
carry the look), `w3q-sys-places` (one test per sentence audited in item 4).

## 7. The lead (docs, devices' words, the walk)

Manual §17.2 and every place it repeats the orbit rule or the body (`docs/dlw/DLW.md`, rendered to `DLW.html`); the World device's
words; this ticket; MAP's queued "Procedural Central" item; PATH's W3 rows, which now say what was seen and what not;
`tests/w3q-manual-17-2.test.mjs`, which holds the manual to the code (the rings, the kinds, the body's elements, the look, the weather).
The lead converges the lanes, runs the whole suite, removes `pending` from the gate, and does the screen pass.

## 8. Done when

1. `node scripts/test-all.mjs` is green, with the gate enforced (no `todo`), and `tsc --noEmit` shows nothing new in the atlas or the catalogue.
2. The four gate bodies stand at the Earth's standard; the Earth passes the gate; v1 bodies draw as before.
3. On a capable GPU the closest camera over a generated body shows continuing detail from procedural tiles, not a stretched base; side by
   side with the Earth at the same three camera distances (Earth, then body at a world view, a region and a place), the body does not look
   like the lesser object. Captured in `evidence/procedural-body-20261020/after/`.
4. A new empty world draws as a grey moon; a world with a year of pages draws as a planet with weather; weather moves with the occasion.
5. The System scale shows only agents at work and their recent artefacts on the rings.
6. Every location sentence of §17.2 has a test, and the manual says what the code does.

## 9. Rulings made during the run

- **Seasons narrowed (20 Oct).** The ice and snow are the annual picture; only the light swings with the tilt. The manual no longer says the snow
  line and the ice margin lean with the season (nothing carries a season into the image).
- **Lane B's calls (20 Oct).** Artefacts ride after their maker has finished, inside a 24 h rolling window, six at most per world.
  Maturity reads `ageMs` (now minus the earliest change in the register's horizon; it under-reads when the horizon began late), `held`
  (the page listing's length) and `shaped` (the register's revision, which counts body and place writes). An unlanded world is drawn at a
  spot derived from its ref and says so; nothing is written until the person lands it. **Carried, not in this ticket:** a *portal* (it needs
  the visiting owner: WORLD-INHABITATION-V1 is contracted, not built); a *route* only if the place facet can already express an ordered
  route (Lane B checks; no ai-kit change here).
- **Lanes may correct their own tests.** Where evidence shows a threshold does not discriminate (Lane A's mountain-elongation row), the lane
  corrects its own test in its own commit with the evidence in the message. The lead's boundary (§3) is not theirs to touch.
- **Route is not expressible; portal needs the visiting owner (Lane B's evidence, 20 Oct).** AIKit's `PlaceFacet`
  (`knowledge_facets.rs:214-243`) carries place_ref, identity, geometry, precision, hierarchy, valid_from, valid_to, observer_frame,
  uncertainty, source_ref and body_ref: no relation, no sequence. `TechnePlaceFacet.relation` (`techne/contract.ts:256`) reads a subject's
  TRAVELLED_TO; `routeModel` (`world.ts:106-150`) orders by validity dates; `MapPlaceDraft` (`WikiFactsEditor.tsx:21`) has no relation. Both
  clicks are refused in words that name the owner they wait for, and the refusals are tested. Carried in HANDOFF-BUILD item 8.
- **Sessions and artefacts.** A session's world comes from its space's `definition.projects` (kernel `agency.rs:759-762`); the provider
  reads only O-I's agency. Artefacts are Central change-horizon rows that name an agent. The 16 Oct reading found none attributed, so the
  outer ring is empty until agents write under their session.
