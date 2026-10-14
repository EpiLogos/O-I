# Port audit — instruments of the DLW candidate (14 Oct 2026)

Repo: `worktrees/env-1/o-i` @ `dd7352390` (dlw/build). Screens: `01-live.jpg` … `06-techne-places.jpg` (candidate ce3ff15f1).
Sources: Archetypal-Earth `Work/Archetypal-Earth` @ `5fe5117` (the PORT-PIN commit, no commits since); Research Canvas
`Work/projects/Antichrist Project` @ `7df35f8`. Every claim below was read from code or reproduced by command; the
commands are given where the result is a measurement.

---

## A. Verdict

**Was it ported or recreated?** Both, in different places, and the split is clean:

- **The Archetypal-Earth code was ported, not reinterpreted.** Diffing the 131 files of AE `src/` at the pinned commit
  against `packages/live-shell/ui/src/projections/atlas/src/`: 61 files are byte-identical, 65 are adapted and every one of
  the 65 has a PORT-PIN `adapted` record, 0 are adapted without a record, 2 are absent by declaration (`main.ts` → the
  host's `mount.ts`, which follows it step for step; `dev/fixture.ts` → `provider/fixtureCorpus.ts`), and 4 are
  declared port-new host modules (`data/occurrenceSeam.ts`, `data/published.ts`, `ui/hostSize.ts`, `ui/lifetime.ts`).
  The adaptations are small (largest: `app/controller.ts` +141/−37 of 2,532 lines; `graph/view.ts` +95/−33 of 1,579).
  Lenses, time control, walk strip, deep, symbols, dreams, Red Book, Aion, dynamics, practice, both atlas views, sky
  code — all present and essentially verbatim.
- **What was not ported is everything AE's code reads.** AE fetches `public/data/*.json`, `public/textures/*.jpg` and
  `public/img/**` from its own origin. The port replaced those fetches with a door through Central's file owner that
  cannot carry the field, declared textures "not shipped with this port", left the sky grid unbound and put images out
  of scope. The faithful code has nothing to draw.
- **The Research Canvas instruments in the hosted frame were vendored faithfully** (130 files verified byte-exact
  against upstream `7df35f8`, 40 recorded patches), **but lanes 1–5 then wrote ~30 new modules into the vendor tree**
  (`PROVENANCE.json` `overlays`: none of the 30 `packages/canvas/src/**` overlay files exists upstream at any revision).
  These are inventions placed under `vendor/`, not ports.
- **The candidate shell recreated, in its own React, the surfaces the frame and the legacy app already had**: a
  Technē timeline/journey presentation, a library/browser, a top bar, device racks, a device chain. Those recreations
  are what the candidate shows; the ported instruments sit behind them, unreached.

**Is functionality intact?** No. On the native candidate no Technē instrument and no native-Expression behaviour is
reachable, and the Earth atlas cannot mount.

**The three biggest breaks**

1. **The Earth atlas can never mount natively.** `field.json` is 5,420,070 B (working tree) / 6,250,112 B (pinned
   commit); Central's text read refuses anything above `MAX_TEXT_BYTES = 4 * 1024 * 1024`
   (`Work/Central/ctrl/src/files.rs:21`, refusal at `:340–352`). Reproduced:
   `ctrl --json action run central.files.read '{"location":{… field.json …}}'` →
   `"File exceeds the bounded text read size"`; the same call on `symbols.json` succeeds. The provider swallows the
   reason (`provider/archetypalEarthProvider.ts:137–142`) and the pane prints only "The atlas data is unavailable"
   (`AtlasProjectionPanel.tsx:585`). Behind that wall stand three more: no globe texture in the payload
   (`src/globe/earth.ts:68` loads `/app/textures/earth-2k.jpg`; `ui/ui-dist/` holds only `assets/` and `index.html`;
   `engine.ts:140` awaits it, so a 404 fails the mount), no sky grid (no host passes `sky` to `mountAtlas`,
   `AtlasProjectionPanel.tsx:363`; `controller.ts:1346` then fetches `/app/data/sky.json`), and no image plates
   (`img/occurrences/*.jpg` relative refs resolve to `/app/img/...`). The atlas was only ever shown over the fixture
   provider in a dev harness with harness-local textures (`atlas/dev/main.ts:8`, `atlas/dev/public/textures/`).
   This breaks Places, Project/graph, Factory's Earth pane, and the Journey lens's walks (which "join when the Earth pane
   has loaded its reading", screenshot 02).
2. **The candidate cannot hold a single native Expression, and every instrument is gated on one.** The kernel's
   expression owner is in memory (`desktop/cradle/kernel/src/expression.rs:1874–1882`, `self.documents`); the installed
   app has no saved-work config (`packages/live-shell/src/inhabitants.rs:35–40`: absent env var → empty list); the
   everyday data migration was never run (LEGACY-CRADLE-RETIREMENT gate 3). So `list` answers empty → "No native works
   disclosed". The shell then refuses to make one: every Featured/Starter/Preset row is hard-disabled with
   `FORK_REASON` (`components/nativeExpressionCommands.ts:39,48`), which is false — the kernel serves `fork`, `save_as`
   and `create` (`expression.rs:726,766,907`), the boundary relays them (`expressions-boundary/src/protocol.ts:18`,
   `host.ts:248`), the shell itself already calls `save_as` (`expressions-boundary/src/nativeMaterials.ts:271`), and the
   frame's own Library opens a featured work by forking it locally (`field-studies-journeys/src/app.ts:1747`) and
   commits forks natively (`actPanel.ts:132–136`). With no native Expression: the hosted Technē lens refuses
   ("Open an available native Expression before choosing its instrument", `native/techneInstrumentOpen.ts:23`), the
   frame's research instruments refuse their dates/places/sources (`researchInstruments.tsx:1153,1162`), the device
   rack and stage stay empty (screenshot 04), and the Technē browser's Sources is empty (`shell/ModeBrowser.tsx:311`).
3. **Technē mode routes its lenses to shell-made parallel presentations, not to the ported instruments.** In Technē the
   Timeline and Journey lenses open the shell's World cut (`App.tsx:528`: `setCenterPanel('world.ground')`) rendered by
   `projections/worldTimelinePresentation.tsx` + `timeline/JourneyRows.tsx` — new code (≈3,200 lines with
   `timeline/*`) that imports only the frame's `standingStyle.ts` and AE's time scale. Canvas and Palace are disabled
   "waiting" buttons (`shell/ModeDetail.tsx:419,423`) although the frame implements both. The frame's TimelineSurface,
   PsychogeographicMap, journeyInstrument, palaceInstrument and CanvasView — where lanes 1–5 built all 126 crosswalk
   targets — are reachable only through the hosted Expressions pane, which break 2 closes. The Journey screen
   (05) is the shell's own grid of raw `SessionSpace …` ids from the Central day reading.

Live has a fourth, contained break: the device chain renders all 31 registered effect faces whether or not a set or
track exists (`components/DeviceChainPanel.tsx:66`, `live/liveChain.ts:20–22`), crushing the torus and Jankó into
the same row (screenshot 01).

---

## B. Feature tables

Columns: source → port status → reachable in the candidate (a user path exists) → works natively (screens/code) → what
makes it real.

### B1. Archetypal-Earth (atlas)

| Feature | AE source | Port status | Reachable | Works natively | What makes it real |
|---|---|---|---|---|---|
| Boot / mount | `src/main.ts` | Replaced by `atlas/mount.ts`, faithful step-for-step (`mount.ts:93–160` vs main.ts boot) | Technē Places, Project/graph, Factory Earth tab | **No** — fails at `provider.load()` (06, 03) | Field read through `file_bytes` (32 MiB ceiling, `desktop/cradle/src/files/client.ts:18`) or a raised Central bound; textures served |
| Field / model | `data/load.ts`, `data/model.ts` | Adapted, recorded (C2 seam) | as above | **No** — `field.json` > 4 MiB text bound | as above |
| Globe engine, tiles | `globe/*` | 6 verbatim, 4 adapted recorded | as above | **No** — `earth-2k.jpg` not in payload (`earth.ts:68`, `engine.ts:140`); GIBS tiles are remote and would load after the base | AE `public/textures/earth-{2k,4k,8k}.jpg` (6.2 MB) delivered through the provider (blob/`oi-material:`) |
| Time control | `ui/time-control.ts` | Adapted, recorded (3/2 lines) | inside the atlas | No (atlas down) | Atlas mount; bound to the shared window by `sharedClock.ts` |
| Walks / walk strip | `aion/walk.ts`, `ui/walk-strip.ts` | verbatim / adapted recorded | inside the atlas; Journey lens reads them via `walkTimeline.ts` | No — Journey says "No walks are carried" (05, 02) | Atlas mount |
| Lenses: field, theory, alchemy, depth, deep-fields, tree, card-reading | `lenses/*` | verbatim except `depth.ts`, `ui.ts` (recorded) | inside the atlas | No | Atlas mount; lens data (`theory.json`, `alchemy.json`, `depth.json` 325 KB …) passes the published door (< 4 MiB) |
| Symbols | `lenses/symbols.ts`, `data/symbols.ts` | adapted recorded | inside the atlas | No | Atlas mount (symbols.json reads fine through Central — verified) |
| Dreams, coincidences (practice) | `lenses/dreams.ts`, `lenses/coincidences.ts`, `practice/*` | adapted recorded; practice storage bound to the workspace (`AtlasProjectionPanel.tsx:333–336`), rebinding seam open | inside the atlas | No | Atlas mount |
| Deep reading | `ui/deep.ts` | adapted recorded | inside the atlas | No | Atlas mount; `field-pages.json` (630 KB) via the door |
| Red Book | `redbook/*` | adapted recorded | inside the atlas | No | Atlas mount |
| Aion (history, sky clock, precession) | `aion/*` | adapted recorded | inside the atlas; Aion reading published to the shell (`AtlasProjectionPanel.tsx:442`) | No | Atlas mount |
| Dynamics (strip, figures) | `dynamics/*` | adapted recorded | inside the atlas | No | Atlas mount |
| Graph view (Earth ⇄ Graph) | `graph/*`, `graph/switch.ts` | adapted recorded | Project/graph lens; Factory "Graph" kind (`registerAtlasHost.ts:27–28`) | No | Atlas mount |
| Second graph (knowledge constellation) | not AE (shell `world.knowledge`) | — | separate pane | not audited here | — |
| Sky mode, orbits, wheel, chart | `sky/*` | 18 verbatim / 4 adapted recorded | inside the atlas | **No even after mount** — skyUrl never supplied (`provider/skyProvider.ts:121–127`, `controller.ts:1346`) | Host passes `sky: {skyUrl, tiesUrl}` blob URLs from `published('sky')`, `published('sky.ties')` |
| Astrology birth sky | `lenses/astrology.ts`, `sky/sidecar.ts` | verbatim | inside the atlas | **No** — needs the Kerykeion sidecar at `127.0.0.1:5187` (`skyProvider.ts:116–120`), not packaged | Payload the AE `ephemeris/` sidecar, or bind the QL kerykeion owner |
| Image plates (reveal, deep) | `ui/reveal.ts`, field `ImageRef.src = "img/…"` | passed through unresolved by decision (T-ATLAS-IMAGES) | inside the atlas | **No** — `/app/img/...` 404 | Resolve `img/…` through `oi-material://` (`src-tauri/src/material_protocol.rs`) over `Work/Archetypal-Earth/public/` (189 MB) |
| Corpus citations | `data/corpus.ts` | adapted recorded (published door) | inside the atlas | No (atlas down); `corpus/` is listable through Central | Atlas mount |
| QL Sun on Earth | — | host-new (`inhabitants/qlSkyEarthAdapter.ts`) | inside the atlas | No (atlas down) | Atlas mount |
| Palaces | AE has none (no file mentions a palace) | — | — | — | The palace is the frame's (`palaceInstrument.tsx`) |

### B2. Technē instruments of the hosted frame (lanes 1–5)

| Instrument | Source | Port status | Reachable in candidate Technē | Works natively | What makes it real |
|---|---|---|---|---|---|
| Canvas | `vendor/research-canvas/packages/canvas/src/CanvasView.tsx` + lane-1 overlays | upstream byte-exact + recorded patches; lane-1 overlays (`CanvasGuides.tsx`, `CanvasObjectNodes.tsx`, `navigationGeometry.ts`, `ZoomReadout.tsx`) are new | **No** — Technē bar Canvas is `state: 'waiting'`, disabled (`ModeDetail.tsx:419`); hosted lens only from the Expressions pane | No | Native Expression (break 2) + Technē lens bar drives the hosted `canvas` lens |
| Timeline | `TimelineSurface.tsx` + lane-2 overlays (bands, clusters, minimap, nesting, participants, cause chain, palette, labels) | upstream + ~14 invented overlay modules | **No** — Technē Timeline opens the shell's `worldTimelinePresentation.tsx` | Shell presentation renders the Central day reading (05) | Route Technē Timeline to the frame's timeline lens |
| Places map | `PsychogeographicMap.tsx` + lane-4 overlays (placeTimeControl, terminator, basemap*, place*) | upstream + ~13 invented overlay modules | **No** — Technē Places opens the AE atlas | No | Owner choice of one Places instrument (AE is the declared pattern); the lane-4 time control and terminator duplicate AE's `ui/time-control.ts` and the QL Sun |
| Journey | `field-studies-journeys/src/journeyInstrument.tsx` (lane 5) | frame-native | **No** — Technē Journey opens `JourneyRows` in the shell | Shell grid of raw ids (05) | Route Technē Journey to the frame's journey lens |
| Palace | `palaceInstrument.tsx`, `palaceBoardView.tsx` (lane 5) | frame-native | **No** — Technē Palace disabled (`ModeDetail.tsx:423`) | No | Native Expression + lens routing |
| Shared time window | `sharedTimeWindow.tsx` | frame-native | in frame only | No (frame lenses unreached) | — |
| Places search / facets / tours | `placeSearchPanel.tsx`, `placeFacetsPanel.tsx`, `placeTour*` | frame-native | in frame only | No | — |
| Research instruments host | `researchInstruments.tsx` (1,757 lines) | frame-native | frame bundle only (`candidate-reachable.mjs` reports it as payload, which is bundle membership, not a user path) | refuses without a native Scene (`:1153,1162`) | Break 2 |

### B3. Expressions

| Behaviour (legacy app) | Legacy source | Candidate | Reachable | Works natively | What makes it real |
|---|---|---|---|---|---|
| Library: saved works | frame Library (`field-studies-journeys/src/library.ts`, browser store) | shell `WorldBrowser.tsx` lists native `list` only | yes | **No** — empty (04): in-memory owner, no saved-work config, migration not run | Persistent native expression home enumerated at boot; run gate-3 migration |
| Open Featured / Starters / Presets | `app.ts:1746–1747` (`forkExpression` → `loadJourney`) | `NativeExpressionCollections.tsx` rows hard-disabled with `FORK_REASON` | rows visible | **No** (04) | Wire Open to kernel `fork`/`create` + `save_as` (the frame's `actPanel.ts:132–136` sequence) |
| New expression | `app.ts` `new-journey`, `entry-new` | none (ledger: "kernel create op EXISTS") | no | No | Kernel `create` through the existing channel |
| Fork as variation, Keep, Remove saved copy, Import legacy | `app.ts:1748` etc. | ledger `owner-op-required` | no | No | Same ops; browser-store import needs the migration |
| Open, edit, save | `nativeWorkspace.ts`, `hostEditor.ts` | shell top bar + editor reading | needs an open native Expression | No — nothing to open | Break 2 |
| Scenes (launch, save scene, acts) | frame scene bar | frame bar visible (04: "Day · Acts · Save scene") on the browser-local default document | partly (frame-local draft) | Frame-local only; the shell's stage reads "Open a native Expression to use its stage" | Break 2 |
| Studio devices (physics, pointer, relation, medium, … resonance) | frame inspector/studio | shell device rack (`panels/*`, NativeWorldDetail) | needs native | No — "Open a native Expression to see its devices" (04) | Break 2 |
| Sequence editor | frame sequence lanes | `timeline/expressionsSequenceEditor.ts` | needs native | No | Break 2 |
| Recording (takes) | `app.ts:476` record-properties | `NativeTransportBar.tsx` + `frameTakes.ts` (ledger: partial, START never replayed) | needs native | No | Break 2 + native replay |
| Capture PNG / video, Present | frame capture | shell capture row (04) | yes (enabled state not verified) | not verified | — |

### B4. Live

| Feature | Source | Port status | Reachable | Works natively | What makes it real |
|---|---|---|---|---|---|
| Set reading, session/arrangement | `packages/live-set` (Rust), kernel `LiveSetRead` | real owner | yes, with a set | needs a set; empty frame without one (01) | — |
| Device parameter faces (generic) | `panels/devices/*` over `live-dynamics` tables, kernel `LiveDeviceParams{Read,Write}` | real, writes the `.als` | chain | yes with a set | — |
| devices-pro (Glue, Echo, Reverb, Wavetable, Operator; rack + full) | own React over the same tables | recreation (no Ableton source exists), writes via `postDeviceParam` (`devices-pro/kit.tsx:122,164`) | chain | with a set | Deduplicate |
| devices-b2 (12 faces) | own React from screenshots (`devices-b2/README.md`) | recreation, **local state only, no write** (`devices-b2/kit.tsx:34–46`) | chain | **No** (edits go nowhere) | Wire `postDeviceParam` or remove from the chain |
| Chain composition | `components/DeviceChainPanel.tsx`, `live/liveChain.ts` | renders every registered effect face (37 bottom registrations − 6 generators = 31) regardless of set/track | always | **Broken** — 31 columns of "no set open" (01) | Render a face per device on the selected track only |
| M1 torus | frame native field (`nativeField.ts`), shell reader `live/torusInstrument.ts` | one reading, shell draws a widget | only after the frame announces an instrument | widget renders, squeezed into the chain row (01) | Torus in Live's centre (DLW §9) |
| Jankó keyboard | layout from `ql music janko window` via kernel `janko_window_read` (`native/liveJankoWindow.ts:22`) | real owner | chain row | renders squeezed (01) | Give it its own section width |
| Mode catalogue | kernel `music_modes_read` → installed quaternal-logic (`native/liveModeCatalogue.ts:28`) | real owner, no shell table | transport | present when the kernel answers | — |
| Note devices, MIDI map | `live/noteDevices`, `live/midiMap` | shell-new | chain head (when torus) | not verified | — |

---

## C. Parallel recreations to replace

| Recreation (candidate) | What it duplicates | Replace with |
|---|---|---|
| `projections/worldTimelinePresentation.tsx` (Technē Timeline) + `ModeCentre.tsx:238–245` lens row | the frame's timeline lens (`TimelineSurface.tsx` + lane-2 work) | the hosted frame's `timeline` lens in Technē's centre; the shell keeps the Central day reading as one track source |
| `timeline/JourneyRows.tsx`, `timeline/journeyWalks.ts` (Technē Journey) | `journeyInstrument.tsx` (lane 5) and AE's `aion/walk.ts` / `ui/walk-strip.ts` | the frame's `journey` lens; AE walks through the mounted atlas |
| Technē Canvas / Palace "waiting" buttons | `CanvasView.tsx`, `palaceInstrument.tsx` | enable them on the hosted lenses |
| `NativeExpressionCollections.tsx` + `collectionSections` (disabled Featured/Starters/Presets) | the frame Library's open/fork (`app.ts:1746–1748`) | an Open that forks through kernel `fork`/`create` + `save_as` and opens the result |
| `WorldBrowser.tsx` works list (native `list` only) | the frame Library's saved works + browser drafts | the native expression home enumerated persistently, plus migrated drafts |
| `components/DeviceChainPanel.tsx` `effects.map(renderEffect)` | a device chain | per-track device tiles keyed by element name, faces looked up in the registry |
| devices-b2 local-state faces | the generic `DevicePanel` that already writes the same parameters | either wire `postDeviceParam` or keep only the writing faces |
| lane-4 `placeTimeControl.ts`, `terminator.ts` in `vendor/` | AE `ui/time-control.ts` and the QL Sun on the atlas | one Places instrument (AE atlas) with its own time control |

---

## D. Ordered repair list

### Foundation (native owner op, kernel, payload)

1. **Native Expressions that survive a restart.** The kernel expression owner is per-process memory
   (`expression.rs:1874–1882`); the installed candidate reads saved works only from `LIVE_SHELL_SAVED_WORK_CONFIG`
   (`inhabitants.rs:35–40`). Give the owner a persistent home it enumerates on `list`, and run the gate-3 migration
   (everyday `org.epilogos.oi.cradle` workspace book, recovery records, drafts → candidate namespace).
   *Done when:* cold-starting the candidate, Expressions › Library lists the owner's works; the Technē browser
   Sources lists them.
2. **Atlas corpus bound.** Either raise Central's `MAX_TEXT_BYTES` (`Work/Central/ctrl/src/files.rs:21`) above the
   corpus size, or adopt the bytes path in the provider (item M1 below, no foundation change). Owner decision; M1
   avoids the change. *Done when:* `central.files.read` or `file_bytes` returns `field.json`.
3. **Ephemeris for the birth sky.** Package AE's `ephemeris/` sidecar in the payload or bind the QL kerykeion owner to
   the astrology lens. *Done when:* Astrology lens draws a birth chart for an entered date/place.
4. **Technē reading without an Expression (if wanted).** The frame's research instruments read dates and places from
   a native Scene (`researchInstruments.tsx:1162`). If Technē must open on a World subject before any Expression
   exists, a native Technē reading op is needed. Otherwise item 1 + M6 suffice.

### Module work (a targeted subagent can do each)

M1. **Atlas field through bytes** — `provider/archetypalEarthProvider.ts`: read `field` (and any file over 4 MiB)
    with `readFileBytes` (`files/client.ts:18`, 32 MiB ceiling), decode UTF-8, hand to `loadField` as today; surface
    the cause in the pane (`AtlasProjectionPanel.tsx:585` prints `error.cause.message`). *Done when:* Technē › Places
    shows the globe with the field's presences, not "could not mount".
M2. **Globe textures** — resolve `earth-2k/4k/8k.jpg` from `Work/Archetypal-Earth/public/textures` through the
    provider (bytes → blob URL, or `oi-material://`); make the three paths in `globe/earth.ts:68,82` provider-supplied
    and record the adaptation in PORT-PIN. *Done when:* the globe paints its base before tiles.
M3. **Sky grid** — pass `sky: {id, skyUrl, tiesUrl}` built from `published('sky')` / `published('sky.ties')` in
    `attachClaimed` (`AtlasProjectionPanel.tsx:363`). *Done when:* the atlas Sky mode shows planets and orbits.
M4. **Image plates (T-ATLAS-IMAGES)** — rewrite `ImageRef.src/thumb` (`img/…`) to `oi-material://` URLs over the AE
    public folder in `adaptFoundingField`. *Done when:* a reveal card shows its plate and credit.
M5. **Live chain** — `DeviceChainPanel.tsx:66`: drop `effects.map(renderEffect)`; render one face per
    `track.devices[i]` by element name (`DevicePanel elementName`), falling back to the read-only tile; dedupe Glue ×3,
    Echo ×2, Reverb ×2; remove or wire the 12 devices-b2 faces. *Done when:* with no set, the chain shows the torus,
    Jankó and one framed empty; with a set, one tile per device on the selected track.
M6. **Featured / Starters / New** — replace `FORK_REASON` rows with Open = kernel `fork` (or `create` from the
    starter's document) + `save_as` into the owner's folder, then `host.openExpression(ref)`; add New = `create`.
    Remove `FORK_REASON`. *Done when:* Open on "O:I — the mark" opens a native Expression and the device rack fills.
M7. **Always enumerate** — `panels/expressions.tsx:198` skips `enumerate()` when a known ref boots, so
    `nativeWorks` stays empty; enumerate after boot in every case. *Done when:* the Sources list is populated while a
    work is open.
M8. **Technē lens routing** — in `App.tsx:511–528` route Timeline, Journey, Canvas, Palace (and Places if the owner
    rules for the research map) to the hosted frame's lenses (`driveHostedLens`), presenting `world.expressions` in
    Technē's centre; set Canvas/Palace `state: 'cut'`. Depends on foundation 1 + M6. *Done when:* Technē › Timeline
    shows the frame's timeline (bands, minimap) over a native Scene; Palace shows the palace board.
M9. **Live centre** — present the torus in Live's centre (DLW §9) and give Jankó its own detail section.
    *Done when:* screenshot 01's chain row holds no torus/keyboard squeeze.
M10. **Places grammar** — `modeGrammar.ts:442–450` marks Bodies/Locations/Places/Palaces/Journeys "waiting" while the
    atlas family is registered; bind them once M1–M2 land. *Done when:* Technē browser › Places lists AE places.

---

## E. Record corrections (claims to retract or restate)

1. **T-ATLAS-PROVIDER ticket** (`desktop/cradle/docs/world-shell/wayfinder/tickets/T-ATLAS-PROVIDER-…md:71–82`):
   "reads AE's published bundle through Central's files client … a scratch run over the real AE data loaded 2,854
   occurrences". The scratch run did not go through Central; Central refuses `field.json` (4 MiB bound). Restate:
   the provider has never loaded the real field through its declared path.
2. **T-ATLAS-HOST** "Code landed": restate that the Earth has never been seen natively; the only rendering is the
   fixture harness (`atlas/dev/main.ts:8`).
3. **`provider/skyProvider.ts` header** ("the atlas's own generated sky stays corpus-side with its provider"): no
   provider supplies it; Sky mode is unbound.
4. **`globe/earth.ts:61–66`** "No texture bytes ship with this port; the paths stay constants, resolved against the
   host's asset base": the host's asset base has no textures; record this as a missing delivery, not a design.
5. **Research Canvas `PROVENANCE.json` `scope`** ("Upstream files byte-exact except explicitly recorded … patches"):
   true for the 130 `files`, but the 30 `packages/canvas/src/**` `overlays` are new authored modules from lanes 1–5
   with no upstream. Label them port-new inventions (or move them out of `vendor/`).
6. **`EXPRESSIONS-PORT-STATUS.json`**: `ported: 136` means "a shell React home plus a boundary op, read statically";
   all 213 rows are `live_replay: pending-native-stack`, and every native-editing row is gated on an open native
   Expression the candidate cannot produce. The 20 `owner-op-required` rows that cite "save_as, which the shell
   cannot call" are wrong: `save_as`, `fork`, `create` exist (`expression.rs:726,766,907`) and are relayed
   (`protocol.ts:18`, `host.ts:248`, `nativeMaterials.ts:271`). Reclassify them as shell wiring gaps.
7. **`FUNCTIONAL-CROSSWALK.json`** shell destinations "Timeline" (25), "Places" (30), "Journey"/"Palace" (24),
   "Canvas"/"Graph" (20) name lens-bar entries that, in Technē mode, open different components (the shell World cut,
   the AE atlas, disabled buttons) than the frame instruments the targets were built in. The "126 of 126 destinations
   named" in LEGACY-CRADLE-RETIREMENT gate 1 overstates: the destinations do not lead to the built targets.
8. **LEGACY-CRADLE-RETIREMENT gate 3** "Built, scripted-verified" vs its own §4 table "migration command (to build)":
   one of the two is wrong; either way the migration has never run, and its absence is why the candidate has no
   works.
9. **`tests/conformance/port-ledger.test.mjs`** "3 of 3 pass" is cited as gate evidence; it checks the ledger's shape
   (fields present, counts consistent), not any behaviour.
10. **`live/liveChain.ts:7–8`** "each remains reachable and working" and the devices-b2 README title "faithful
    device-panel ports": the b2 faces are visual recreations from screenshots that keep local state and write nothing.
11. **`components/nativeExpressionCommands.ts:37–39` `FORK_REASON`** — a user-facing false statement; retract with M6.
12. **`shell/modeGrammar.ts:446–447`** "Earth places — the Atlas port's surface. Waits for the Places owner": the
    atlas is registered; what waits is its data delivery (M1–M4).
