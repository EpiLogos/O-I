# World shell design — one World, four projections, real panes, one rack

Owner-commissioned design contemplation, 8 October 2026, in conversation.
Companion to `UI-UX-CONVERGENCE-STUDY.md` (the measured Live 12 basis) and
`FUNCTIONAL-CROSSWALK.md` (the 126-target accounting). This document is the
design intent the shell convergence builds towards; every claim below is
grounded in code that exists today, referenced by path and line where it
matters.

It supersedes the conversational planning transcript's hierarchy framing and
integrates the owner's corrections: projections are not a hierarchy; panes
are real panes; Central is resolved by the shell's own grammar, not a
separate mode; documents and curated features become inhabitants of the rack;
the Jung atlas (`Work/Archetypal-Earth`) is a found, owned implementation —
the Earth projection's seed, not a missing input.

**Visual mockup:** [world-shell-mockup.html](world-shell-mockup.html) —
revision 5, the final pass. Earlier rounds are kept as `world-shell-mockup-r4.html` …
`-r1.html`, with their renders.

---

## Revision 5 — one transport, five meanings (8 October 2026)

**The rack:** Session and Arrangement view icons, then the mode icons: Live
(music, the shell's base mode, restored), Central, Factory, Expressions
and Technē. *(12 Oct 2026: Rev 5 titled the Central icon "Base · Central";
under the owner's five-mode ruling, CONTEMPLATION-DLW-INSTRUMENT.md:232-252,
the title is "Central" — the code still carries the old title, ticket T-LABELS.)*

**Every mode keeps the same transport slots in the same places.** Only their
meaning changes:

| Slot (Live) | Central (Rev 5 title "Base · Central", T-LABELS) | Factory | Expressions | Technē |
|---|---|---|---|---|
| Link · Tap | ground sync · stamp Now into the document | peers · ping agents | field sync · tap tempo | field carrier · back to Now |
| tempo ‹ › · signature | die face (‹ › turns it) · 4+2 | effort · budget | field tempo · 5:3 ratio | walk pace · stop n/8 |
| metronome · quantize | autosave · save timing | heartbeat · interrupt timing | pulse · scene quantize | presence · arrival |
| key / scale | packet token count | tokens in · out | ☿ resonance key | aperture · view as |
| ▶ ■ ● + | **Answer** (send the packet) · stop · dictate · append/replace | run · stop all · voice · steer | play scenes · stop · capture take · layer | walk · stop · record walk · extend |
| arm · re-enable · capture | agent write-arm · hand back · selection → packet | write arm · hand back · capture | Studio arm · re-enable · gestures → scene | instrument writes · hand back · view → scene |
| punch · loop · punch | day opened 08:30 · close routine · 21:00 | write window · routine | scene loop | occasion window |
| draw · keys · MIDI · kHz · CPU | highlight pen · keys · map · carrier · save state | point · keys · map · t/s · context | draw form · keys · map · fps · GPU | place tool · keys · map · carrier · projected % |

**What the Session and Arrangement icons show in each mode:**

| Mode | Session | Arrangement |
|---|---|---|
| Live | clips and scenes | the song over time |
| Base | the day as clips: Day, Flows, Beings, Things and Goals as tracks | today on one ruler |
| Factory | sessions and tasks | the run viewer |
| Expressions | scene rows | the scenes over time |
| Technē | the Journey | the Relation Field |

**Expressions follows Technē's example.** The pane holds only the living field.
The tool rail, toolbelt and Library move into the Studio (Device), as Tools
and the selected object's actions. The scene strip moves into Clip, beside
the sequence and bindings.

Renders:
- `world-shell-mockup.png`
- `-base-session`
- `-live`
- `-factory`
- `-factory-arrangement`
- `-expressions`
- `-expressions-scene`
- `-techne`
- `-techne-clip`

---

## Revision 4 — agent-shell standards recovered (8 October 2026)

These corrections apply on top of Revision 3.

- **Mode selector and panes are icons.** The arrangement selector is icons
  only. Panes are controlled by one icon (⊞) with a small menu: split beside,
  split below, four-fold, close. Panes form a split tree with no fixed count.
  Drag a tab onto a pane's centre to move it there, or onto its edge to snap
  it into a new split.
- **Instruments are not inside panes.** The detail row is **Clip | Device**,
  toggled from the status bar as in the agent shell, and each arrangement
  gives the pair its own meaning:

| | Clip — what is in focus | Device — what works on it |
|---|---|---|
| Base | Document: form, file, revision, bindings; highlights; notes; packet | Devices: Text · Highlight · Notes · Packet · Answer · the form device |
| Factory | Task log: the selected task's tool-run log | Agent chain: gateway → agent → skills → world → git |
| Expressions | Scene: sequence, durations, bindings | Studio: the engine's own controls |
| Technē | Clip: identity, place and time, disclosure, typed relations, bounded constellation, source | Instruments: the six Technē instruments. The one open on the focused pane is expanded with its own controls; the others are folded, and clicking one opens it on the focused pane |

- **The right side is the agent-shell dock again.** Context tiles sit above:
  the agent (Fizz, Epii or Anima), Packet, Trail, Field, Agents, Terminal,
  Results, Sky, NOWs. The 2×2 launcher below opens tiles and never feeds the
  centre. Views come into panes from the browser's Views category.
- Renders: `world-shell-mockup.png` (Base · Devices), `-base-clip`,
  `-factory` (Task log), `-factory-device`, `-expressions`, `-techne`
  (Instruments), `-techne-clip`, `-techne-quad`.

---

## Revision 3 — four arrangements, real bodies, instruments that are instruments (8 October 2026)

The owner's corrections to revision 2, and what the mockup now does about each.
Where this conflicts with Revision 2 below, this revision stands.

**Arrangements are composed differently, not one shell with a rack in every
mode.** The O:I #375 table is now the mockup's spine. Base, Factory,
Expressions and Technē each give the left, centre, right and detail regions
their own defaults; the encounter carries across, and each arrangement keeps
its own panes.

| | Left (browser + aperture slot) | Centre | Right (companion) | Detail |
|---|---|---|---|---|
| **Base** | Central: Days, Flows, Beings, Things, Goals; Files, Wiki; New (exactly Day · Flow · Beings · Things) | the documents themselves, paper-toned | the situated agent: Conversation · Activity · Context · Inspect | document devices |
| **Factory** | Sessions, Agents, Runs, Chats, Files, Knowledge | session grid · thread | result desk: Activity · Context · Inspect · Results | the agent chain: gateway → agent → skills → world → git |
| **Expressions** | the compact bounded graph, Scenes, Library | the living field: tool rail, toolbelt, scene strip, Library | Anima (Nara/oracle) | the Studio: the engine's own controls |
| **Technē** | sources to hand (open in instrument / add reference), Bodies, Locations, Earth places, Palaces, Journeys | the current lens, the six on the lens bar | Epii: Epii · Source · Proposals · Field | the instrument's own controls |

**Base is Central's ground.** The four document forms
(`desktop/cradle/documents`: `ql-daily-die.html`, `ql-flow.html`,
`oi-beings.html`, `oi-things.html`) are drawn as they are: the Day die's six
positions (4+2) with the open face; Flow's Dialogue · Flow · Journal with
declared participants (a person drawn solid, an agent dissolving into points);
Things and Beings with their bindings (world, subject, C1–C4 office, sources).
The highlight-context system is the forms' own selection tool, *Highlight ·
Note · To packet · Answer this*. Text editing and highlight context then
appear as document devices in the detail row: Text · Highlight · Notes ·
Packet · Answer · and a form device (Die faces · Participants · Bindings).
The packet is shown as exactly what the agent receives, and the companion's
Context tab shows the same packet.

**Panes have no headers, and there is no bar above them.** A view is an
aperture you pull in from the launcher or the browser. It opens as a tab on
the pane's auto-hidden left rail, and ⇧ splits. Each pane keeps its own
context: following the encounter, or pinned. The focused pane's context and
view controls live in the aperture slot under the browser, where Live keeps
the groove pool: Field · World · Subject · Occasion, the view's own controls
(scale, lens, document view), and the pane layout. The four concepts #375
asks to keep apart are now apart: arrangement selector (transport), Surface
tabs (pane rail), lens navigation (the Technē lens bar), view controls
(slot).

**Technē: the instrument is the instrument.** No separate "Technè rack"
composes an instrument out of devices, and none appears in other modes. In
Technē the detail row is the focused lens's own native control set, drawn as
one instrument frame with sections; those controls are what modify its
fundamental form. Every pane instrument works in every mode at full
capability (owner ruling, 13 October 2026, retiring the earlier plain-aperture
rule): in any arrangement the detail row's Device side follows the focused
pane's instrument, so a Places, Graph, Timeline or Expression pane in Central
or Factory carries that instrument's full native controls through its
devices' exposed parameters. The controls stay out of the pane body. The mode
supplies the material; the instruments stay whole.

**World / Places renders real bodies in one space.** Planets are lit by the
field's star, so they show phases, and each is procedurally generated from its
World's own parameters. Earth is your local root anchor, the Mūlādhāra
relation: it carries real geography and is never the default body for anyone
in a shared field. Other Worlds show their own built bodies: an arid world, an
archipelago, a ringed ice world. Relations between bodies are the connective
layer:
- anchor
- participate
- contribution, with its flow
- watch
- projection
- federate
- A2A, while a contact is open

Scales are System · Body · Region · Palace. In the Body scale your located
artefacts draw anchor lines to their real places on Earth; Stone Bay, for
example, anchors to Bollingen.

**Planet building is a first-class part of the World instrument.** Its native controls:
- **Body:** your body, or Earth; name; seed and reroll.
- **Landmass:** sea level, continents, relief, coast (smooth · fjord ·
  archipelago).
- **Climate:** warmth, moisture, ice caps.
- **Sky:** atmosphere, clouds, axial tilt.
- **Locations:** place · palace · portal · route; click the body to place one,
  name it (names are suggested from the seed), and see its list with anchors
  and portals.
- **Relations:** which relations between bodies are shown.

Earth's landmass controls are disabled ("Earth is given"); another World's
body is read-only.

**Fewer titles.** The window title is the subject and the day. Only the
companion has a header line. The Mercurius walk now appears only where it
does work: the Journey lens, the Journeys list, the palace loggia.

**Renders:**
- `world-shell-mockup.png`: Base, Day and Flow
- `-things`
- `-factory`
- `-expressions`
- `-techne-system`
- `-techne-federated`
- `-techne-body`
- `-techne-region`
- `-techne-earth`
- `-techne-m0`: the Project graph as form
- `-techne-quad`

Linkable states: `?mode=techne&lens=M4&scale=body&body=earth&ap=3`,
`?mode=base&doc=thing&layout=solo`.

**Honesty notes.** Planet bodies are a CPU stand-in (seeded value-noise
fbm, bilinear sampling) for the GPU globe engine. Earth's land comes from
coarse coastlines. Document text and source passages are written for the
mockup, as paraphrases with locators. The data is a fixture shaped like the
native contracts.

---

## Revision 2 — the mockup rebuilt to the owner's intents (8 October 2026)

The owner asked for the world mockup to be brought to the agent-shell
standard and to the intents worked out in conversation: your World is a
planet in a solar-system-like shared field; local and shared are one UX at
different apertures; the graph is the encounter engine; and Technē is
accounted for at the UX level as its six instruments. The mockup is meant
to be lifted by development agents, so it is written as a component reference
(its header lists the functions to lift).

**What it settles, in the mockup itself:**

- **Three orthogonal axes.** *Arrangement* (Base · Factory · Expressions 3:3 ·
  Technē — the transport's surface buttons; each keeps its own panes) ×
  *projection* (Earth · Timeline · Constellation · Expression — per pane) ×
  *device* (the rack). Switching any one keeps the encounter.
- **The spine is a bar** above the panes: Field › World › Subject ›
  Occasion, plus the mediation of the current encounter (search · graph
  traversal · direct · journey · palace · contact · return · placed).
  `encounter()` is the only transition; the Trail tile keeps every encounter
  and returns to it.
- **Aperture** (transport): World · Local · Shared · Federated. Search,
  Earth, Constellation and Timeline all admit the same; results beyond the
  aperture are counted and offered ("＋ 2 more beyond the aperture — widen").
- **View as** (where Live has key/scale): me · field · public. Your planet
  fogs everything not projected; the rack's Projection device shows the
  disclosure ladder; raising an audience always asks first.
- **Earth / Solar system is the World's body at five scales**: *Field* (Worlds as
  planets around the SharedField hub; a nested field ringed; a federated field
  at one remove; contributions travel as particles), *Orbit* (the homepage —
  your planet with agents, NOWs, recent Expressions and encounters, watched
  relations and project-world moons in near orbit; the cosmos layers M1 torus ·
  M2 sky · M3 clock around it), *Surface* (artefacts placed round the globe,
  clustered; walks drawn as routes; the agent's reading lines), *Place*
  (precision ring, the relation type per artefact, reference frame, scale
  bar), and *Palace* — a special location you enter: rooms composing
  native refs, a guided path, portals out, a private room that fogs for every
  audience, Epii explaining why each room exists.
- **Visiting another World** lands on its *projection*: tinted, fogged, only
  what it projected, its agent reachable (A2A contact → returned difference →
  admit as a claim attributed to its source).
- **Timeline holds the Relation Field and the Journey.** The Arrangement presentation is the Relation
  Field: authored history beside development (runs, revisions, the Day,
  machine NOWs, FieldNow) on one non-linear ruler with a declared break into
  today; lenses chronology · causal · recurrence · concurrency; clips drawn in
  their epistemic standing (fact · claim · inferred · hypothesis · disputed ·
  ghost), never upgraded by placement. The Scenes presentation *is* the
  Journey: Live's scene rows as walk stops (place · occasion · artefact ·
  Expression · narration · transition). ▶ walks it; ● records a new walk from
  your encounters.
- **Constellation holds the Project graph and the Canvas.** *Field*: the bounded local whole
  (depth, budget, ＋ expand, ghosts for unresolved links) as list · tree ·
  graph · **form** — the graph-expression of your World. *Canvas*: the
  artefact suite — drag is presentation, frames are presentation, a drawn
  relation is a proposal until promoted through the relation owner's Action.
- **Expression is the 3:3 reading** with its M0–M5 layers; the rack's cut switch
  crosses between Technē and Expressions (the Journey's crossing into a scene and
  back).
- **The rack follows the focused pane's instrument** (chains per Technē
  instrument and for 3:3), with the six instruments as chips. Every device has one parameter model
  with three presentations: compact face, expanded pool (header click), full pane
  (⤢).

**Transport functions** (Live control → World function): Link → field
carrier · Tap → back to Now · tempo → walk pace · signature → walk stop ·
metronome → FieldNow presence pulse · key/scale → View as · Follow → panes
follow the encounter · Now/Occasion/Walk → which clock drives the panes ·
Play → walk the Journey · Record → record a walk · Overdub → extend the
walk · loop brace → occasion window · draw → Place tool (presentation
placement) · Earth button → Home (your planet at orbit) · sample rate →
carrier and round-trip · CPU → share of your World projected.

**Renders:** `world-shell-mockup.png` (home, orbit) · `-field` (aperture
federated) · `-surface` · `-place` · `-palace` · `-quad` (Technē, all four
projections of one encounter) · `-factory` (concurrency + the Project graph) ·
`-scenes` (a walk at stop 7) · `-canvas` · `-visit` (Ariadne's projection +
A2A contact) · `-expressions` · `-viewas` (your World as the field sees it).
Linkable states: `?arr=techne&scale=surface&subject=stone1950&ap=3&as=field&visit=ariadne&walk=6`.

**Honesty notes.** The data is a fixture shaped like the native contracts
(Explore entries, typed relations with standing, Participant/Projection/
Contribution, FieldNow). The globe is a canvas stand-in for the Archetypal-
Earth engine; the sky values are illustrative, not provider output; source
passages are paraphrases with locators. Nothing here claims an owner that
does not exist yet.

---

## 1. The design law

**One World, four projections, real panes, one rack.**

- The **World** is the shared semantic field owned by native owners (kernel
  expressions/scenes/acts, wiki, graph, Factory work, QL cosmic composition,
  civil time). It is never rendered directly; it is always encountered
  through a projection.
- **Four primary projections** render the same World material:
  Earth/Solar-System (space), Timeline (time), Canvas/Constellation
  (relation), Expressions (form). Graph and agent/filesystem are implicit
  inspectors callable from any projection — never competing top-level modes.
- **Panes are real panes.** The center of the shell is a composition of
  panes from the existing surface engine, each holding a projection instance
  or a surface, each carrying its own rack. No UI is crammed into footers
  and headers to compensate for missing pane space.
- **One rack.** Devices — native parameter editors, documents, conversations,
  curated apps, mode plugins — attach to the rack of the pane whose
  encounter they operate on. The rack is the plugin system of the whole
  environment, generalised from Ableton's device chain.

The rack is not a hierarchy layer under the projections; the projections are
not features of a monolith. One material, many projections; one encounter,
many devices; nothing is copied into view-specific domain models.

## 2. The spine: the encounter machine that already exists

No second selection or navigation model is introduced. The shell's de-facto
tripartite state machine is the spine, and the design names it:

1. **Mode** — `ShellMode` (`audio | expressions | techne | settings`,
   `continuity/workspace.tsx:8`) over the cradle's `WorkspaceMode`
   (`base | factory | expressions | techne | epi-logos | settings`,
   `cradle workspace/mode.ts:18-19`), each mode carrying its own layout tree
   (`modeLayouts`), with the standing rule that a mode never closes surfaces.
2. **World context** — the workspace book's `WorldContext`
   (`world: central | epi-logos`, subject, reading, trail;
   `cradle workspace/store.ts:15-73`) plus project navigation and recent
   places. This is the encounter: what is selected, of which world, with
   what reading, and where you have been.
3. **Kernel epoch** — transport status and `accessEpoch`/`accessReady`
   generation bumping (`shell/workspace.tsx:59-117`), which retires stale
   callbacks and gates every read on the current connection.

Every projection instance and every device reads the encounter from this
spine; selection changes propagate as encounter transitions, not as
per-view state. The Atlas independently converged on the same shape — its
five-state machine (World · Focus · Manifestation · Thread · Deep,
`Archetypal-Earth/src/state/store.ts`) maps directly: World = projection
overview, Focus = selection (encounter.subject), Manifestation = an
Expression opened, Thread = the trail, Deep = full device edit. Its hash
router (`src/state/router.ts` — "every state is linkable and Back works")
is the model for linkable encounters in the shell.

## 3. The four projections

### 3.1 Earth / Solar-System — space

The spatial projection, adopted from `Work/Archetypal-Earth` (found; owner's
own code, branch `main` @ `932b360`). What carries over as **projection
infrastructure**: the globe engine (`src/globe/` — three.js earth shader,
NASA Blue Marble + GIBS quadkey tile streaming, atmosphere, instanced
presence points with density texture), the camera rig (`src/globe/controls.ts`
— north-up inertial orbit, great-circle flights, anchor-zoom), the graph
engine (`src/graph/` — d3-force constellation, neighbourhood BFS with
liveness dimming, tie-basis edge styles, idle-when-clean rendering), the
non-linear time scale (`src/data/time.ts`, mirrored in GLSL), and the
image pipeline (`scripts/images.mjs`, `ImageRef` in `src/types/field.ts`).

What stays **corpus**: the Jung vault (`~/Documents/books/jung-archetypal-field`,
2,778 files, as-such → image → instance), the curation set (gazetteer,
archetypes, family-ties, Aion, Book of Symbols), and the ingest scripts.
`src/types/field.ts` is the single seam between the two — which is exactly
why adoption without the corpus is straightforward.

The World-projection contract generalises `Occurrence` (`field.ts:118-142`):
a projected occurrence carries `subject_ref` (the native identity), place
(lat/lon + precision), time (year/range + display), image ref, and basis.
Any World material that can answer those binds into Earth; material without
geography anchors to the declared world/home position and expands as a work
constellation (the transcript's recommendation, retained).

The solar system is the same projection's outward expansion: Earth's
engine already streams tiles and renders instanced bodies; the M2 planetary
field binds from the QL side (the dated-sky provider contract,
`providers/sky/kerykeion_snapshot.py` — ten bodies, nine voices, seven
centuries, Earth anchor — already carries the source-defined Sun→Sahasrāra
relation). The Atlas has no ephemeris code; none is invented here — the sky
arrives from its native owner.

### 3.2 Timeline — time

The temporal projection, in Ableton's own grammar and already substantially
in the shell: `SessionView` (track columns, clip slots, scenes, stop row,
mixer strip) and `ArrangementView` (integrated overview above the ruler —
the measured Live evidence — beat ruler, track lanes) with native variants
projecting the retained app (`NativeSessionContent`, `NativeSourceArrangement`).
Selection is `{track, scene, clip?}` (`SessionView.tsx:9`), and it is what
chooses clip-vs-device detail in the bottom area (`App.tsx:249`).

The design move: **Session and Arrangement are the two presentations of one
Timeline projection over any World material** — not audio-mode features.
This resolves the recorded fault of coupling them to audio mode
(`UI-UX-CONVERGENCE-STUDY.md` line 36). Tracks are lanes of World material:
Expressions scenes, historical events, Factory runs, agent activity,
conversations, civil days, celestial motion, M3 clock transformations.
Clips are the material in lanes; launching, recording, moving, trimming,
splitting are the crosswalk's session/arrangement family operating through
existing native owners. The integrated overview stays the single navigation
surface — no duplicate scrub bar (owner ruling, retained).

### 3.3 Canvas / Constellation — relation

The relational projection. Two engines serve it: the Atlas's d3-force
constellation (calm, liveness-aware, tie-basis styled) for corpus-shaped
constellations, and the knowledge Graph's existing canvas with its
`NavigationMinimap` (`navigationMinimapGeometry.ts` projects graph
world-points; `GraphCanvas.tsx` consumes it) for the wiki/subject graph.
Graph data remains owned by its native semantic system; the projection is a
surface over it. Unresolved links render as honest ghost nodes (crosswalk
lane-1:C1). The constellation is where Factory workflow, agent populations
and corpus relations are *seen*; the explicit graph inspector opens from any
projection on selection ("show this in the field's graph" — lane-1:C3).

### 3.4 Expressions — form

The expressive projection: the retained application mounted once, with the
deep cut changing disclosure (`panels/expressions.tsx:43-46`). Glyphs,
scenes, particles, cymatics, chakral structures, image transformations,
narrative sequences. An Expression is not a data category — any World
material may acquire an expressive projection (a Factory run's result, an
archetype's glyph, a corpus's composition). The Expressions projection is
where form is authored; the Timeline projection is where form is placed in
time; Earth is where it is situated.

### 3.5 Implicit projections

- **Graph** — the relation inspector, opened on selection from any
  projection. Already routed: the browser dispatches
  `oi:epi-open-knowledge` (`WorldBrowser.tsx:96-115`); knowledge bindings
  arrive through `surface_open` and the book.
- **Agent / filesystem** — operational inspection of Position, body,
  current work, project, messages, runs, files, returns. Surfaced as
  browser categories and contextual panels (the crosswalk's agency family),
  never as competing worlds.

## 4. Real panes

The pane engine already exists and is already hosted in the shell: the
cradle surface system — `TabGroupPane` / `SplitPane` / `LayoutState` with
`root`, `surfaces`, `closedStack`, `focusedGroupId`, `maximizedGroupId`,
`sidePane`, `detached`, `modeLayouts` (`surface/types.ts:86-172`); operations
open/close/split/tile/moveTab/cycleTab/togglePin/detach/redock
(`surface/engine.ts`); retained bodies kept mounted per pane
(`Workbench.tsx:460-463`); real second-window detach and redock
(`DetachedFrame.tsx` → `window_binding` / `window_redock`; admitted kinds
include `source, knowledge, file, encounter, browser, terminal, flow`).

The design promotes this engine from "one center panel among six" to **the
composer of the main area in every mode**:

- A **pane** = projection instance (or surface) + encounter slice + rack.
  The pane engine's body-kind system gains projection kinds
  (`projection.earth`, `projection.timeline`, `projection.constellation`,
  `projection.expressions`), so opening a projection is opening a pane, and
  two panes can hold two projections of the same subject side by side.
- **Hidden-inhabitant retention stays**: projections keep mounting while
  hidden (`App.tsx:124-134`), so returning to a pane restores its actual
  camera, selection and temporal state — the Atlas already proves this
  pattern (time-window snapshots across mode transitions,
  `controller.ts:418,845,882,959`).
- **Tabs are implicit in tracks and clips**, exactly as the owner said: in
  Ableton there is no tab strip over the main area — selecting a clip shows
  the Clip view, selecting a track shows the Device view, and the
  Clip|Device switch in the detail area is the only "tab". The shell already
  has this (`StatusBar.tsx:13` clip/device switch; `App.tsx:249`). The pane
  engine's tab groups remain for surface-bearing material (documents,
  terminals, sources) — not bolted onto projections.
- The five-region frame stays: TransportBar, left browser, main (panes),
  right dock, bottom detail, status. The bottom detail area is the
  **focused pane's rack view**; Deep edit expands it; pop-out moves a device
  to its own pane or window (the pane engine's detach, already real).

## 5. The rack and its inhabitants

The device aperture is proven and generalises as-is. A face receives
`{reading, disabled, apply, captureCurrent}` plus `renderControl` and
`createCustody` for gesture-bearing devices
(`NativeDeviceEditors.tsx:420-425`); writes are same-basis, single-flight,
with retained drafts and explicit Apply/Discard/Retry
(`NativeDeviceInputCustody`, 47-85). Presentation states exist: chain strip
(`NativeDeviceStrip`), compact vs configure (`NativeRackEditor`
`is-compact`/`is-configuring`), Configure families
(controls/device/rack/scene, `NativeWorldDetail.tsx:158-178`), Deep edit
expand/collapse, and device enable toggles. Pop-out is the one gated
gap — supplied by the pane engine's detach rather than a new mechanism.

Inhabitants — the rack's residents — are of these kinds:

1. **Parameter devices** (native owners, landed pattern): morph, colour,
   force, field faces; the coming sound/modulation/rack families. Each has
   an explicit target/encounter and no parallel store.
2. **Document devices**: hosted HTML pages — `ql-flow.html`, the 4+2
   `ql-daily-die.html`, curated returns and future pages. The hosting
   path exists (`document/frame.ts` sandboxed opaque-origin iframe,
   bounded postMessage `oi:document-host-request/response/changed`,
   payload island `#ql-doc`, save router with named outcomes
   `saved | unchanged | stale | conflict | refused`). The design promotes
   the binding to a device face: body = the page, rack strip = identity +
   basis + save state, aperture = the encounter. Documents become rack
   citizens with lifecycle (dock / expand / pop-out) instead of special
   cases.
3. **Conversation devices**: Nara/agency encounters — canonical CAS stays
   in AIKit; the shell binds via `oi.nara-dialogue-binding/v1` over kernelOp
   (`nara/nativeDialogue.ts`); the surface is an `encounter` binding already
   hosted in panes and detachable windows. A conversation is also a clip in
   the Timeline projection (its transcript is temporal material).
4. **Instrument devices**: the Techne instruments over the encounter —
   torus, sky, clock/inscription, piano, symbolic transformations, corpus
   analysis. Registered faces, not new applications.
5. **Mode plugins**: a declared bundle — `{browser category entries, device
   faces, projection bindings, document kinds, optional center panel}` —
   registered through the doors that already exist (`shell/panels.ts` slots,
   `FIELD_FAMILIES`, `NativeTechneBrowser` instrument list, detached kinds,
   browser categories). A curated feature integrates by declaring an
   inhabitant manifest; the shell needs no surgery for a new app. The
   Factory and Central entry points stay reserved for their native owners'
   work, admitted through this same door.

Naming: the host module is already called `inhabitants.rs`
(`packages/live-shell/src/inhabitants.rs`, `ConfiguredWork`) — the design
keeps the word. An inhabitant is admitted; its faces register; the rack
holds them.

## 6. Central mode, resolved

Central is not a fifth view and not a separate app; it is **one World
context** (`WorldContext.world: 'central'`) whose material projects through
the same four projections and inhabits the same rack:

- **Day / NOW history** → Timeline tracks (a day is a lane; returns,
  handoffs, clearings are clips on it). The day die and flow documents →
  document devices (`DayDieFace.tsx` already hosts `ql-daily-die.html` with
  `DayFormSession`; sandbox messages stage, never authorise). Day close /
  archive flows stay native owners, surfaced as browser entries.
- **Wiki / M0** → already a native Expression projection
  (`wikiNativeExpression.ts` — the wiki is an Expression/Scenes projection;
  registers read from the kernel navigator; no duplicate document store).
  Opens as Expressions material, Constellation for relations, document
  devices for pages.
- **Conversations** → encounter panes + Nara device + Timeline clips
  (§5.3).
- **Ground chooser / placement / receiving** → browser categories and dock
  cards over the native owners, not a parallel UI.

Nothing new is stored. Central mode is the shell with Central material
selected — the tripartite spine's world context, not a mode switch.

## 7. Factory

Factory supplies World phenomena — Positions, occupants, current work,
attempts, communiques, artifacts, returns — and those project through all
four views and inspect through the implicit agent/files surfaces. No
bespoke Factory application is built. The OpenRig-derived behavioural
semantics (inhabitation, custody, current-work derivation, handover,
refocus) are already implemented in `factory/src/current_work.rs` and
`inhabitation.rs`; the joins to build are encounter-side: selected subject →
prepared context → commission → attributable artifact → Return, with the
Run's Expression production moved out of view lifetime (the recorded
`FactoryLive.tsx` producer-consumer fault — rendering may sleep; work
stays recoverable). Factory work appears as Timeline tracks (runs,
stages, messages), Constellation nodes (agent → task → sources → files →
results), Earth placements where situated, and Expressions where a run
acquires form. Agency review is an instrument family (crosswalk: native
agency/team/Factory work review), with Buzz (`/Applications/Buzz.app`
v0.5.20) as the resolved reference for queue/steer/interrupt/review
behaviour.

## 8. Time

Two clocks, one typed bridge — the lane-6 two-clock doctrine stands. Civil
time (Day/NOW closure law) and work/performance time remain distinct
owners; the shell offers three deliberate temporal controls, linkable but
independent (the transcript's Now / Occasion / Instrument transport,
retained):

- **Now** — the situated civil field (the Atlas's shared bottom clock
  generalised; drives Earth and Timeline alike).
- **Occasion** — a selected or retained event's time (the K8 sky
  contract's retained-occasion behaviour: reopening an exact saved occasion
  keeps its snapshot and separately qualifies current admission).
- **Transport** — the Timeline projection's playhead over performable
  material (sequence clocks family; the M3 clock device exposes
  inscription/lens circles).

The Atlas's non-linear time scale (`src/data/time.ts`) is the Timeline
projection's deep-time answer — honest compression without fabricated
precision (crosswalk lane-2 T4/T5).

## 9. Mapping the existing actions

The 126 targets' eight operation families land as (projection, rack)
destinations rather than bespoke surfaces:

| Operation family | Lands as |
|---|---|
| Rich Glyph Sequence material | Expressions projection (clip/arrangement editing) + sequence devices |
| Sequence clocks and performance | Timeline transport + clock device; native evaluator observed separately from authored values |
| Independent force contributions | Field devices in the rack (force editor, morph, colour — landed pattern); shared Field edits stay shared |
| Device lifecycle and rack topology | The rack itself: insert/select/fold/move/duplicate/remove/activate, hot-swap, presets, macro mapping |
| Session launch and recorded Arrangement occurrences | Timeline projection over native Scene/Field membership; launch/record/move/trim/split |
| Source/Graph/constellation/editor Return | Implicit graph inspector + encounter return (subject_ref/anchor/revision retained; FieldEncounter/`selection_set`/`portal_open` already decided, O:I #592) |
| Native agency/team/Factory work review | Agency instrument devices + Timeline/Constellation/Earth projections of work; implicit agent/files inspection |
| Gesture state, async replies and lifecycle | The custody/apply aperture (landed): retained drafts, same-basis writes, Apply/Discard/Retry |

The retained app's full action inventory exists
(`expressions-ui-actions.json`, `router_actions` with
`external_migration: unaccepted`) — the mapping work is binding those
actions to the aperture and the Timeline grammar, not re-inventing them.
Destination counts from the crosswalk (Places 30, Expressions Clip/Arrangement
26, Timeline 25, Canvas 14, Journey 13, Palace 7, Graph 5, Journey/Palace 4)
distribute across these pairs; no target changes identity or acceptance.

## 10. Smallest seam set

The smallest set of architectural seams between today's code and this
design:

1. **Projection pane kinds** — extend the pane engine's body kinds with the
   four projections; promote the engine to compose the main area per mode
   (modeLayouts already exist). Hidden retention carries over.
2. **Projection module boundary** — each projection is a module with
   mount/unmount + encounter subscription (the Atlas's vanilla-TS
   controller mounts the way the retained app's controller does; no React
   rewrite of the Atlas).
3. **Encounter bridge** — encounter.subject/occasion/trail drive each
   projection's state machine; Atlas World·Focus·Manifestation·Thread·Deep
   ↔ spine mapping (§2). No second selection store.
4. **Inhabitant manifest** — generalise the registries (panels slots,
   FIELD_FAMILIES, browser categories, detached kinds) into one declared
   inhabitant manifest admitted through `inhabitants.rs`; document and
   conversation devices become face kinds with bodies.
5. **Timeline generalisation** — Session/Arrangement present any World
   track set; the set model (`useSet.ts`, `document.ts`) gains World
   track adapters (day tracks, run tracks, conversation clips).
6. **Occurrence binding contract** — the generalised `Occurrence`
   (subject_ref + place + time + image + basis) as the Earth projection's
   data seam; QL sky binds as the M2 layer; no separate map subsystem.
7. **Time spine** — Now/Occasion/Transport controls over the two-clock
   bridge; Atlas non-linear scale adopted for deep time.
8. **Pop-out** — device pop-out rides the pane engine's existing
   detach/redock; no new windowing mechanism.

## 11. Not-do laws

- No parallel World models, event stores, selection systems, graph stores,
  Factory/Expression state stores, agent registries, or filesystem models.
- No hierarchy implementation — projections are siblings; the World is not
  a node above them.
- No inspector, no false view tabs, no duplicate timeline scrub bar
  (measured-Live rulings stand).
- No cramming UI into footers and headers; missing surface is a pane, not
  a compression exercise.
- No claims beyond native owners: no audio playback or device editing
  before those owners land; Factory and Central entry points stay reserved
  for their native owners; the source-by-source licence gate governs all
  reference adoption (the Atlas is owned source — acquisition B; its NASA
  tiles and Wikimedia images are external *data* with their own terms,
  recorded, not code adoption).

## 12. Product families — the six carvings

Owner direction, 8 October 2026, extended in conversation from the
agent-shell mockup (`agent-shell-mockup.html`, tokens copied from the real
shell styles at `45e15ed8b`) and the port accounting
(`EXPRESSIONS-PORT-STATUS.json`): the six products — **central, actuation,
ai-kit, software-factory, workcell, quaternal-logic** (the full-suite
backing, `footprint.json`) — each contribute a **device family**, and that
is the cleanest way to expose their functionality across every view,
surface and lens.

A family is an inhabitant manifest (§5.5) with declared contents:

- `browser` — its left-browser categories and places;
- `faces` — its rack devices, each implementing the proven aperture;
- `params` — its typed parameter addresses (kind/key/value grammar, ranges,
  units, write path under the writeShared law);
- `projections` — optional adapters that project family material into the
  four views (Factory runs → Timeline tracks; QL sky → the Earth
  projection's outward expansion; Central ground material → Constellation
  overlays);
- `inspectors` — its implicit agent/file-grade contextual panels;
- `time` — which time strata it consumes and which temporal material it
  contributes (§14);
- `telemetry` — the observables it exposes as modulation sources.

The manifest is authored by the family's native owner — this is the
mechanism behind "Factory and Central entry points stay reserved for their
native owners": the shell's door is neutral, the keys are held by owners.
The seventh carving is already in flight: the Expressions family's port
ledger assigns each of 213 legacy actions an `outward_home` on neutral
surfaces and an exact `boundary_op` — the porting work is filling the
neutral frame with family material without changing the frame.

Family-by-family:

**Central — the clip-view craft of the ground itself.** In Live, clip view
holds the material craft (warp, gain, fades). Central's material is the
ground: files, folders, wiki, days, places, worktrees, branches. Its
devices: a ground/hygiene device (worktree census, branch audit, erroneous
worktree and stray-branch detection, seat occupancy — the field-health
behaviours as readings and tenders); an impact device (select a folder or
note → its Central-web neighbourhood, references, and the sessions touching
it); the document devices (§5.2); day/now operations (close, rollover,
archive recovery) as temporal controls bound to the civil-time stratum.
When the selected material is a Central subject, the detail area shows
Central's clip-view-grade editors — CAS identity, basis and the save
router's named outcomes (`saved | unchanged | stale | conflict | refused`)
are this world's warp markers: typed, honest, per-material.

**Actuation — tuning the engine that runs agents.** Harness/model device
(model, reasoning effort — the mockup's effort knob — custom agent loop);
the experiment device: a declarative run with telemetry capture
(`{subjects, loop, telemetry set, cadence, comparison basis}`), whose run
appears as a Timeline track, whose telemetry is observables (modulation
sources), whose results Return through Factory receiving. The clean seam:
Actuation tunes *how* agents run; AIKit supplies *what they can do*;
Factory organises *what work happens*. Three families, three aspects, kept
distinct where a monolithic "agent UI" would blur them.

**AIKit — skills as devices.** The mockup's proof: "Skills are this
session's plug-ins, held in a rack. Each chain is a skill; the light
admits or denies it. Macros drive several skills' settings at once."
Skill devices with admit/deny lights (the disclosure law made physical —
carried is not loaded, loaded is not used), skillset racks, macros
(Thoroughness, Test depth), knowledge-route devices, methodology loading
as enablement.

**Software Factory — work as World phenomena.** Run devices, attempt
review, artifact inspection, Return. Projection contributions put runs on
the Timeline, populations in the Constellation, situated work on Earth.
The mockup's hold/hand-back light ("you edited HeroShot physics while
Honey held it; Honey's hold is suspended") is custody made visible — a
device-level reading of the existing custody law.

**Workcell — where computation happens.** The seat device (claims,
occupancy, lanes, zones); the execution-target device (run in a VM or on a
remote machine) — "where does this run" as a parameter other families'
operations declare (a Factory run or an Actuation experiment names its
Workcell address); hygiene tenders (disk, build trees, orphaned processes)
as readings plus tending actions.

**Quaternal Logic — the cosmic.** Torus, sky/kerykeion, M3
clock/inscription/lens, deck work, chakra correspondences, the physical
music instrument matrices. Its projection contribution is the Earth
projection's outward expansion; the sky device is its compact face; and it
is the chronos provider (§14) — the clock and the sky are time *sources*,
not only devices.

## 13. The uncarved block — neutral core vs carved families

The shell core is the uncarved block: it knows only neutral, product-less
concepts — frame, projections, encounter spine, rack and aperture,
parameters, modulation routing, the time spine, and the admission door.
The core never says "Central" or "Factory"; products exist only as
admitted families. Carving = declaring a family = adding typed scope to a
neutral substrate.

Working test of neutrality: a seventh product should integrate with no
core change. If a core change is needed, either the family boundary or the
core concept is wrong — and the correction is proposed at the neutral
layer, never special-cased per product.

## 14. Modulation and specification

"Plugins/params introduce scope for modulation and specification" made
precise:

- **Parameter** = typed address with declared scope:
  `{family, device-instance, key, type, range/unit, write-path}`. The
  device change kinds are the seed grammar (`engine.{key}`, `morph.law`,
  `colour-setting{key:value}`); the family manifest generalises it.
- **Specification** = scope declaration — what an instance binds to:
  encounter, subject, pane, session. The aperture's target/basis is the
  existing mechanism. Tightening scope is specialisation.
- **Modulation** = a routing relation, source → target parameter, within
  declared scope, always through the custody/receipt law (modulation
  deepens writeShared, never bypasses it). Sources: time functions (§15),
  telemetry (Actuation), native engine observations (the crosswalk's
  "evaluator observed separately from authored values"), and other
  parameters via macros — the mockup's macros are the first modulators,
  and the rack-topology family's "macro range/curve/scope" is their
  contract.
- **Honesty law for modulation**: every modulated parameter shows its
  modulator (Live colours the modulated knob). Capability honesty applied
  to parameters — nothing moves without a visible cause.

The experiment case composes all of it: an Actuation experiment is
specification (scope: these agents, this loop) + telemetry (observables) +
modulation (cadence from cron, or M3 phase from chronos, addressing the
capture rate) + Factory receiving (results Return).

## 15. The time spine — locked at the top, bound from below

Time is locked at a higher level. Five strata, one spine; families bind
and may contribute material, never fork clocks:

1. **Chronos** — qualitative/cosmic time: kerykeion sky positions, the M3
   clock and inscription phases, Aion epochs, the planetary field.
   Provided by the QL family; exposed by the spine as read-only time
   functions any family may bind (an experiment cadenced by a transit; a
   day reading coloured by clock phase).
2. **Civil time** — the day/now closure law, owned by Central
   (`civil-time-policy.json`): days open and close, NOW clears, rollover.
   The spine exposes "the current day/NOW" as the default Now; day
   operations are Central-family devices.
3. **Cron** — scheduled/systematic time: automations, recurrences,
   telemetry cadences, sweep tenders. Families declare cadences as
   parameters; the spine (or a Workcell/Actuation executor) fires them;
   every firing lands as a Timeline clip — a cron run is temporal material
   like anything else. Cron is how "telemetry every N minutes" or "day
   close at 21:00" exist without any family building a scheduler.
4. **Transport** — performable time: the Timeline projection's playhead,
   sequence clocks, takes (record/replace/append — the port ledger is
   already full of take operations), loops and markers.
5. **Occasion** — retained time: a saved occasion keeps its snapshot and
   separately qualifies its current admission (the sky contract's
   behaviour). Standing in 1913's sky without lying about now is what
   makes historical exploration honest.

The §8 controls (Now / Occasion / Transport) are the user-facing face of
strata 2, 5 and 4; chronos and cron are the deeper platform strata. Time
as a modulation source closes the loop with §14: an LFO was always time —
this world's LFOs are transits, day phases, cron cadences and clock
phases, addressable from any family because the strata are locked at the
top.

## 16. Exposure — one family, four surfaces

Each family appears in exactly four places and nowhere else: the browser
(its categories), the rack (its devices on the selected material's chain),
the projections (its material via adapters), and the inspectors (its
implicit panels) — plus its time bindings and telemetry declarations. A
family needing a fifth place is a design smell: either the projection set
or the family boundary is wrong. This is the no-bespoke-UI law stated per
family, and it is how "QL-MEF and ta onta and all the rest become utterly
available" without any of them becoming an application.

## 17. The vertical proofs

1. **The Factory vertical** (retained from the transcript, still the right
   first proof): a real Factory agent performs a bounded piece of work on a
   real Jung/World object; the result is recovered through Earth, Timeline,
   Constellation, Expressions, the relevant devices, and agent/files
   inspection — identity, provenance, work and context continuous
   throughout; repeated with views closed, reopening, occupant change and a
   retained occasion.
2. **The Central vertical** (this design's addition): one real day is
   recovered through the Timeline (day track with return/handoff clips),
   the Day document device, a conversation clip + Nara device, and the
   wiki's Constellation — proving Central's resolution without a separate
   mode. Both verticals exercise the spine, the panes, the rack and the
   projections with nothing built twice.

## 18. The musical system — the layer beneath Revision 5's Live mode

**Owner ruling, 13 Oct 2026 (DEVICE-SEMANTICS-LOCK §0.2; QL-MEF Wayfinder
§0.4; DLW §9):** Live mode exposes one instrument — the M1 torus, the only
generator, shared with every Expression as one simulation — presented as a
rack widget, an expanded pool and the full torus in the centre; its keyboard
is the torus unwound (Jankó); scales follow Live's grammar; the Live corpus's
capacities are its chain devices, never a ported catalogue. Where this
section reads otherwise, the ruling stands.

Owner question, 8 October 2026: has the underlying musical system been
thought through — the instrument, the torus and clock projections onto the
Earth integration, and whether Expressions gains the full musical suite
integrated into its scenes and layers. Revisions 2 and 5 above already draw
the UX face (Live restored as the shell's base mode with one transport
wearing five meanings; the cosmos layers — M1 torus · M2 sky · M3 clock —
around your planet at orbit). This section records what stands beneath:
the owners, the law, the verified code, and the honest gap.

**The commissioned law** (QL-MEF #281 wayfinder; lane-6 SCOPE revision 2):
**M1 is the oscillator source** — owner D13; M2's pitch structures are
tuning/modulation over that source, never a second generator. Sound and
visible form are projections of one evolving state (the common-cause /
cymatics law) — never effects sharing a timestamp. Every physical or sonic
role is classified: a resonating body is not a moving emitter, a collision
trigger, an analyser, or a visual-only glyph (#281 §1.3).

**Verified foundations in the retained app (code, not plans):**

- **The C++ PCM and field owner** is real and disciplined: one managed
  native owner supplies PCM and identified field targets together over the
  host-authorised `ql-field-host` pipe adapter
  (`native-field/ql/instrument-session.mjs`; identity tuple
  event/subject/registry/geometry/material/model refs; exact cursors).
- **Playback honours the realtime boundary**: `native-audio.mjs` schedules
  bounded, ahead of the device clock, no graph queries in the callback;
  `controller.ts` carries `NativePlaybackPolicy` (block 8192, lead and
  lookahead 0.5 s) and `SCENE_SAMPLE_RATE=48000` taken from QL's
  `scene_field.rs` — the composed owner's device rate.
- **The M1 torus is on the stage** at QL's declared scale
  (`INSTRUMENT_PRESENTATION`: ±25/9 m → ±333 engine units, annotated as
  presentation, not source) with sky epochs (`NativeSky: 'none'|'now'||
  {epoch}`) and owner standing (manual/opening/following/held).
- **A real modal resonator exists**: `cymaticResonator.ts` — a
  continuously-driven damped resonator in the envelope domain, Chladni
  free plate (2D) and standing-wave cavity (3D); `entitySound.ts` gives
  per-entity voices with kernel-validated shapes (`expression_profile::sound`),
  `followCymatic` binding pitch to the cymatic/field frequency; scene
  causal trace and physical-form actuation are present.
- **The sky bus (M2's dated state) is landed QL-side** (the 29 September
  synth track's landed sky bus; still-open relations named there).

**The vendor references are defined, not executed.** The Sound Particles /
Shrapnel / Tetrad / Anukari recon (lane 6's converging input) exists as a
primary-reference catalogue and required research returns
(`M-PRIME-PHYSICAL-MUSIC-RESEARCH-ACCEPTANCE.md`: "It is not a report that
the vendor products … have been exercised"). What already sounds came from
the internal Chladni/material work and the QL owners. The references still
owe the performance and interaction vocabulary — emitters, collision
events, receivers, pickup placement — which is exactly the part that does
not exist yet anywhere.

**The realisation in this shell's grammar** — the DaVinci Resolve pattern
the owner names: an **integrated musical working mode, not another app**
(#281 §3.1), reusing the shell's own machinery. Revision 5's Live column
is that mode's transport face; beneath it:

- **M1** — the field/PCM owner docks as an **instrument device** in the
  rack (the played torus/field as a device face with the proven aperture);
  the stage stays the instrument's visible body. The old D-H hosting
  question (framed for a proprietary fork) is answered by this
  architecture: our own process, the pipe-transported owner — what remains
  is the realtime gate (measured latency, device recovery) in the Tauri
  shell.
- **M2** — the first **native modulation sources** of §14: the owner's
  audio/nodal readings (audio_octet, nodal_quartet) as observables
  addressing device parameters within declared scope; compiled relation
  plans before realtime execution; never a second oscillator (D13).
- **M3** — **score material in tracks and clips** (the Timeline
  projection's grammar): articulation and form sequences as clip material;
  body/form geometry stays the engine's visual body — one state through
  the shared owner. The port ledger's take machinery (record/replace/
  append) is the seed for performance recording. The form→body preparation
  pipeline (versioned prepared bodies, off-thread eigenstructure,
  crossfade/reinit policy) is #281's M3 packet — law today, not landed.
- **M4** — unchanged law: the Expressions application is the body; a
  declared world context, a personal Nara context and an explicitly shared
  context are distinct admissible occasions over the same source
  definitions (#281 §1.2) — in shell terms, per-context state over the
  encounter spine.
- **Track kinds** — audio and visual/physics tracks are track *adapters*
  on the Timeline projection (L4's World track adapters). The owner's
  framing is correct: with tracks and clips carrying expressions and
  scenes, audio and physics tracks are the simplest thing. The gate is not
  difficulty; it is the role-classification law and honesty: no sounding
  claim before the owner lands it in the shell.
- **Time** — the sample clock is the work-time stratum of the §15 spine:
  coherent sample-time for the active device, explicit mappings to
  transport, physical/control updates, M1 phase, M3 inscription, sky
  occurrence and civil Day/NOW (#281 §2.5 stands as law). Revision 2's
  transport mapping already carries the face of this: sample rate →
  carrier and round-trip.
- **What the shell does not do** — performance input (the six-row Jankó
  projection, polyphonic pointer/keyboard/MIDI through one operation
  path), the full realtime voice architecture, prepared-body versioning,
  composition/routing/export offices, and the vendor recon: these belong
  to #281's nine commissioned packets and their integrator. The shell
  prepares the host they dock into — admission as the QL family's
  instrument faces, track adapters, transport coupling, modulation
  routing, metering surfaces — and claims nothing sounding until the owner
  lands it.
