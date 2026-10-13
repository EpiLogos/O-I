# DLW panes per mode — the pane-instrument picture, mode by mode

Lane `zcode:panes-permode-o2` (DESIGN, DLW development track), dispatched by
orchestrator `zcode:world-shell-orchestrator`, 2026-10-11. Companion to
`DLW-PANES-ONTOLOGY.md` (lane O1 — not yet landed when this was written; the
ontology terms used here are the commission's working definitions, and §11
names the points O1's document should bind to). This document refines
`DLW-PLAN.md` §4 (the mode chapters) into the **per-mode pane-instrument
mapping**: for each mode — Live, Base · Central, Factory, Expressions,
Technē, plus the Epi-Logos lens — its base instrument, its browser catalogue
resolved, its default set, what the mockups draw (coverage), and what needs
specifying beyond the mockups (SPEC-NEEDED).

## 0. The ontology this mapping uses (working definitions)

- **pane-instrument** — the generating body a pane hosts. Every pane's
  content is an instrument *instance* of a *type*; types have multiple
  implementations. The atlas graph surface and the Obsidian-RE knowledge
  graph are two implementations of one Graph instrument type, as two reverbs
  are two implementations of Live's Reverb.
- **device** — an SDK-declared parameter component that docks **on racks
  (chains)**. Devices ride the selected material's chain; they are not pane
  bodies. Face aperture: `{reading, disabled, apply, captureCurrent}`
  (`DEVICE-PANEL-BRIEF.md`; `DLW-PLAN.md` §3.3).
- **plugin** — a family's admitted manifest package; the unit admitted at
  the neutral door (`worldShellFamilies.ts`; `DLW-PLAN.md` §3.3 writers law).
- **base instrument** — the mode's default: what a new pane opens with.
- **set** — a named arrangement of panes × instruments; default (per mode)
  + user-saved. §9 states the grammar.

The resolution the owner asked for, stated once and applied per mode below:
**the left sidebar is the browser, and the browser is the mode's catalogue of
available instruments/devices/content — exactly as Ableton's browser lists
devices by category.** Its folders are of four kinds, and every folder in
every mode is one of these:

| Folder kind | What its rows are | Selecting/clicking a row does |
|---|---|---|
| **content** | material instances (documents, sources, days, scenes, sessions, places…) | binds the mode's (or another mode's) pane-instrument to that material — opens/encounters it |
| **instrument-types** | the pane-instrument types available in this mode ("Views") | instantiates the instrument into the focused pane (⇧ splits first) |
| **devices** | device and rack plugins to insert (audio effects, skillsets, git…) | inserts onto the selected material's chain |
| **live-faces** | a running instance shown in place (compact face, not a list) | interacts with / recenters that instance |

Evidence keys used throughout: `WSD` = `new-shell/WORLD-SHELL-DESIGN.md`;
mockup citations name file + the drawn element (all in `new-shell/`);
code citations are `file:line` under
`Work/O-I/packages/live-shell/ui/src/` (shell) or `Work/O-I/desktop/cradle/src/`
(cradle) unless prefixed otherwise. Audit captures read live:
`/tmp/mode-audit3/{live,base,factory,expressions,techne}-1920.png` and
`/tmp/mode-audit5/base-sweep.png`.

The five-region frame is constant (WIDGET-GUIDE §2): Transport 64 px ·
Browser 400 px · Centre (panes) · dock/companion ≈300 px · Detail 300 px ·
Status 28 px. Panes carry no headers; views arrive as apertures from the
launcher or the browser; one ⊞ control splits (beside / below / four-fold /
close); tabs drag centre-to-move, edge-to-split (WSD Rev 4;
world-shell-mockup.html:443, 1619–1687). The landed pane engine is the
cradle surface system — `TabGroupPane` / `SplitPane` / `LayoutState`
(cradle `surface/types.ts:86–208`), operations in `surface/engine.ts`,
projection kinds `projection.earth|timeline|constellation|expressions`
(`surface/types.ts:34–38`), binding
`{kind, subject_ref?}` (types.ts:118 — absent `subject_ref` = the pane
follows the encounter; present = pinned).

---

## 1. LIVE — the music mode

### 1.1 Focus
Live is the music working mode: the shell's base mode, restored (WSD Rev 5,
:23–27). It is the Ableton-grammar surface where the M′ physical music
instrument works as "an integrated musical working mode, not another app"
(`M-PRIME-PHYSICAL-MUSIC-WAYFINDER.md` §3.1; WSD §18). Session shows clips
and scenes; Arrangement the song over time (WSD :43–48). The landed grammar
maps it to the shell's audio cut (`shell/modeGrammar.ts:23–24, 166–217`);
honesty law: read-only until the audio owners land
(`shell/modeGrammar.ts:216`; `DEVELOPMENT-TRACK-2026-10-09.md:100`).

> **Re-pinned 12 Oct 2026 (P0-V2 item 23).** The `:23–24` cite now lands on the file's header comment. The Live mapping is the header line at `shell/modeGrammar.ts:19`, and the Live grammar is `const live` at `:173`, so `166–217` still spans it. `:216` now holds a transport-slot row (the 'draw' slot), and the read-only wording has moved to `shell/modeGrammar.ts:223` (the Live grammar's `waitingNote`: "The audio engine's transport is read-only until its owner lands; the field holds its place."). The read-only note is also at `DEVELOPMENT-TRACK-2026-10-09.md:97` ("Live unchanged (read-only honesty)"). Read-only status was not re-tested here (channel: code-reading).

### 1.2 Base instrument
The **Set document** — the audio set as a readable, playable whole. A pane in
Live opens with the audio cut's composition: the Session grid or the
Arrangement. Mockup default: a single pane holding the Session view
(world-shell-mockup.html:1699 — `S.modes.live={tree:0,focus:0,panes:[paneOf(tab('musicsess'))]}`).
The landed body is `SessionView`/`ArrangementView` with the read-only set
mirror (`shell/useSet.ts` — `SetSummary` with per-track `devices: string[]`;
`shell/document.ts` — `SetDocument` with `SetDevice{params}` readings). Why:
Live is the reference mode the other four re-mean; its base instrument is the
one body whose craft (clips, devices, transport) the whole ontology is
transposed from (DLW-PLAN §2 table).

### 1.3 The browser catalogue, resolved
Live keeps **its own browser** — the grammar declares none
(`modeGrammar.ts:180` `browser: []`); the landed render
(/tmp/mode-audit3/live-1920.png) shows it. Folder by folder:

- Collections › **Favorites** — content (user-pinned rows from any category).
- Library › **All, Sounds, Drums** — content/presets: Sounds and Drums are
  *presets* (chain+device+clip bundles that lift in whole); "All" the union.
- Library › **Instruments · Audio Effects · MIDI Effects · Modulators** —
  **devices**: the only folders in any mode whose rows are device/plugin
  types to insert on a track's chain. This is Ableton's own catalogue
  grammar, and the model for every other mode's device folders.
- Library › **Clips · Samples · Grooves · Tunings** — content: clip material,
  audio content, time-shaping content, note content.
- Library › **Max for Live · Plug-ins** — third-party **plugins** (the
  manifest-admitted package notion in its native form).
- Places › **Sets · Open set** — content: set documents; opening one binds
  the Set instrument to it.
- **Groove Pool** (below the browser) — a *live-face*: the working groove
  instances ("No grooves in this reading" when the reading carries none —
  audit live-1920).
- The mockup adds a **Views** folder (world-shell-mockup.html:1701 —
  `['',[['views','Views','▦']]]`): instrument-types — the apertures a pane
  can pull (session, arrangement). The landed audio browser does not carry a
  Views folder; the Session/Arrangement transport icons hold that role.

### 1.4 The default set
Mockup: one pane (Session); detail `device` (the live chain: Drum Rack 16
pads → Glue Compressor → Reverb → drop zone — world-shell-mockup.html detail
render and DLW-PLAN §3.5 bullet); dock tiles `['agents','trail']`
(world-shell-mockup.html:1699); browser category `sounds`. Landed: the audio
cut's own browser + Groove Pool + empty set state ("Open a Live set from the
browser." — audit live-1920); status bar Clip | Device pair
(`modeGrammar.ts:173–176`). What the user saves over: the pane tree, the
detail presentation, the dock tiles, the open category.

### 1.5 Mockup coverage and SPEC-NEEDED
The mockups draw Live lightly (the transport is the reference reading; the
centre is a standard Session/Arrangement; the detail shows a live device
chain with 16-pad Drum Rack). **SPEC-NEEDED (6):**
1. Which family declares the audio browser's device folders' rows (the
   audio family admission is open — DLW-PLAN ledger §10 item 25).
2. The audio device faces' write contract — readable names/params today,
   "no proven stable write identity/revision… read-only until the device
   lane's actual editing/metadata contract lands"
   (`NATIVE-EDITOR-STANDARD.md:82`).
3. Groove-pool *content*: no source assigns a DLW meaning beyond reusing the
   geometry (DLW-PLAN §2 row; ledger item 16).
4. The set model's World-track adapter binding for audio/physics tracks —
   adapters landed (`qlAudioTrackAdapter.ts`, `qlPhysicsTrackAdapter.ts`,
   `qlTrackRoles.ts`) but the Set↔Timeline-Projection joins need the L4
   adapter set spelled per track kind.
5. The M′ instrument faces' parameter addresses (QL family faces declared
   waiting — `quaternalLogicFamilyManifest.ts:45–74`; #281's nine packets).
6. Clip-view craft scope in the shell (warp/fades/launch craft — the world
   mockup's live clip view) vs the audio owner's.

### 1.6 Exists vs to-build
- **Exists:** the audio cut with its own browser and Groove Pool
  (audit live-1920); `SessionView`/`ArrangementView` + native variants
  (`shell/compositionViews.ts`, `shell/nativeContent.ts`); read-only set +
  document mirrors (`useSet.ts`, `document.ts`); the Live grammar record
  (`modeGrammar.ts:166–217`); panel registry slots (`shell/panels.ts:13–20`);
  the device-chain strip pattern (`NativeDeviceStrip`, landed per
  INSTRUMENTATION-CONTRACT.md:446–452).
- **Mockup-only:** the Views folder in the audio browser; the drawn live
  device chain faces (Drum Rack pads, Glue, Reverb).
- **Open:** device editing (read-only law); the M′ instrument faces; the
  audio family's admission; sounding claims ("claims nothing sounding until
  the owner lands it", WSD §18).

### 1.7 Instruments/devices available in this mode
Instrument types: Set document (Session/Arrangement presentations); Timeline
projection over audio tracks. Device catalogue: Live's own 70 devices (13
instruments, 46 audio effects, 11 MIDI effects — the RE corpus scope,
DLW-PLAN §4.1.a) plus plug-ins/M4L as plugins; QL family faces (torus,
m3-clock, m-prime-matrices — declared waiting); the QL field/PCM owner docks
as an instrument device (WSD §18; `qlMusicalExtension.ts`).

---

## 2. BASE · CENTRAL — the ground's craft

### 2.1 Focus
Central's ground: the day and its documents. "Base is Central's ground"
(WSD :119); Central itself is **not a mode** but one World context whose
material projects through the same four projections and inhabits the same
rack (WSD §6, :533–556; `modeGrammar.ts:19–21`). The owner's mapping: Central
is Live's **clip view** — "the nitty gritty functionalities of warping etc"
(DLW-PLAN §4.2, verbatim [session]) — so the mode's craft is per-material
editorial: CAS identity, basis, and the save router's five named outcomes are
"this world's warp markers" (WSD :706–717).

### 2.2 Base instrument
The **Document** — one of the four forms (Day · Flow · Beings · Things,
`desktop/cradle/documents/{ql-daily-die,ql-flow,oi-beings,oi-things}.html`).
A new pane opens with a document: the mockup's `newPaneTab()` returns
`tab('doc',{doc:'thing'})` for base (world-shell-mockup.html:1602). Why: the
mode's material *is* documents; everything else in the mode (the day grid,
the devices, the packet) operates on the focused document. Landed: the
Document detail is the mode's clip side — `BaseDocumentDetail` →
`CentralSubjectDetail` (CAS identity, basis, save-router standing;
`shell/ModeDetail.tsx:65–95`), with the designed empty state naming the six
document devices when nothing is selected.

### 2.3 The browser catalogue, resolved
Mockup (Rev 3 table, WSD :114; drawn at world-shell-mockup.html:1470):
`Central [Days ⚀, Flows ¶, Beings ☺, Things ▤, Goals ◇] · Project [Files ▢,
Wiki ▭] · [New… ＋, Views ▦]`. Landed grammar (`modeGrammar.ts:234–250`) with
`cut`/`waiting` states; landed row sources in `shell/ModeBrowser.tsx` and
`inhabitants/centralBrowserCategories.ts`. Folder by folder, under the
ontology:

- **Days** — *content*: day records (civil-time documents). Rows read from
  the root register's day surface via `listFiles` →
  `central.directory-reading/v1` at `Control/agents/now/day`
  (`ModeBrowser.tsx:44, 124–170`; state `cut`). Selecting a day selects the
  Document detail's subject — it instantiates the base instrument bound to
  that day. A `waiting` sibling in the L7 data (`central-now` NOW field,
  `central-ground` hygiene rows) shows the same folder-kind extended.
- **Flows · Beings · Things · Goals** — *content*: the flow/being/thing/goal
  documents (instances of the other three forms + the goals lane). All four
  are declared `waiting` (`modeGrammar.ts:237–244`): the forms' owners have
  not landed their listing reads — drawn as designed empty categories naming
  their owners (`DesignedEmptyCategory`, `ModeBrowser.tsx:280–290`).
- **Files** — *content*: the ground's listing (folders + notes) through the
  workspace's directory resource (`GroundRows`, `ModeBrowser.tsx:172–251`);
  folders walk, notes instantiate the Document instrument.
- **Wiki** — *content projected through an instrument*: the wiki is a native
  Expression projection (`wikiNativeExpression.ts`; WSD §6), so this folder's
  rows would be wiki registers/pages opening as Expression material or
  document devices. Declared `waiting` ("the projection read does not answer
  in every boot", `modeGrammar.ts:248–249`).
- **New…** (mockup) — an *instrument instantiation* folder of exactly four
  buttons: creates a new document of each form (world-shell-mockup.html:1490
  — "the four forms"; creation ops are owner-op-required, port ledger wave 3).
- **Views** (mockup) — *instrument-types*: the apertures a Base pane can pull
  (day, flow, thing, being, world, timeline, field/graph, terminal,
  expression, canvas, scenes, palace, sessions, thread — `LORDER.base`,
  world-shell-mockup.html:1569). Click opens in the focused pane; ⇧ splits
  (:1505).
- **Device rows are not here**: Base's devices (Text · Highlight · Notes ·
  Packet · Answer · the form device; the central family's hygiene/impact/
  document devices) dock from the family manifest onto the focused
  document's chain — the browser lists content and instruments, the chain
  holds devices. That split is the resolution in its purest form.

### 2.4 The default set
Mockup: two panes side by side — Day | Flow (with a Things tab)
(world-shell-mockup.html:747: `tree:{d:'row',c:[0,1]},
panes:[doc day, doc flow + doc thing]`); detail `device` (the document
device chain); dock tiles `['convo','packet','trail']` (:752); browser
category `days`; companion tabs Conversation · Activity · Context · Inspect
(:1534); aperture slot showing the encounter (Field · World · Subject ·
Occasion) with the document's form/file/revision rows (:1509–1531).
Landed tonight (/tmp/mode-audit5/base-sweep.png): the day-as-clips session
grid (five coloured tracks Day/Flows/Beings/Things/Goals with clip slots,
soft-stop squares, stop/retry rows), the Document device chain rendered as
six device cards + "Drop the document's devices here", the Fizz companion
tile + Packet/Trail/Field launcher, the aperture-slot encounter readout
(Field central · World bridge · Subject not selected · Occasion the day's
Now), and the honest civil-field disclosure. What the user saves over: all of
the above except the grammar (labels/functions are data, not preferences).

### 2.5 Mockup coverage and SPEC-NEEDED
Covered: the four document forms drawn fully (die faces 4+2 with the open
face; Flow's participants — person solid, agent dissolving to points;
Things/Beings bindings world/subject/C1–C4 office/sources — WSD :119–131);
the highlight-context selection tool (*Highlight · Note · To packet · Answer
this*, :722); the packet as exactly what the agent receives with the
companion's Context tab showing the same packet (:128–131).
**SPEC-NEEDED (7):**
1. Flows/Beings/Things/Goals listing owner reads — which op lists each
   form's documents (the forms exist; their catalogue reads do not).
2. The Wiki projection read (register/page listing through the Expression
   owner) and its browser row contract.
3. The form devices' parameter addresses (Die faces · Participants ·
   Bindings) — what each control writes and through which owner op.
4. Packet scope/size controls' owner ops (`pk.scope`, `pk.size` in the
   mockup's Packet device) — the packet is a disclosure, its edits need
   owners.
5. New-document creation ops (owner-op-required per the port ledger wave 3
   evidence).
6. The Session presentation's clip semantics: what one "clip" on each track
   is (a return? an entry? a handoff?) — the day track adapter exists (L4,
   18 clips live-verified) but the Beings/Things/Goals adapters are not
   spelled.
7. The Answer device's binding: which conversation surface receives, and how
   the answer returns as a document entry.

### 2.6 Exists vs to-build
- **Exists:** the Base grammar record; `ModeBrowser` (Days/Files rows live,
  designed-empty waiting categories); `ModeCentre` day-as-clips + today-ruler
  frames (`ModeCentre.tsx:108–134`); `BaseDevicesDetail` (the central family
  rack — `ModeDetail.tsx:52–58`) and `BaseDocumentDetail`; the L2 central
  extension faces ground-hygiene, impact, day-die, flow-document,
  nara-conversation (`worldShellFamilies.ts:40–95`); L7
  `centralBrowserCategories.ts` (Days / NOW field / Ground / Impact
  admitted); the L7 day recovery walked end-to-end read-only (DLW-PLAN
  §4.2); audit renders mode-audit3/base-1920 and mode-audit5/base-sweep.
- **Mockup-only:** the four forms' full paper rendering in panes (the
  document devices host them via the iframe path — faces landed, pane-body
  wiring is the App.tsx join); New… instantiation; the aperture slot's view
  controls per view.
- **Open:** the App.tsx body wiring ("the shell integrator's join", DLW-PLAN
  §4.2); the Central vertical (L8); computer-use acceptance; items 1–7 above.

### 2.7 Instruments/devices available
Instrument types: Document (4 forms), Day-as-clips session, Today ruler,
World/Timeline/Graph/Canvas/Scenes/Palace apertures (from Views), Terminal,
Sessions/Thread. Device catalogue (central family + document chain):
ground-hygiene (readings; tenders wait), impact, day-die, flow-document,
nara-conversation, plus the six document devices Text · Highlight · Notes ·
Packet · Answer · Form device (mockup + `ModeDetail.tsx:73` chips).

---

## 3. FACTORY — the work programme

### 3.1 Focus
Sessions, tasks, runs — the agency desk. "Factory supplies World phenomena —
Positions, occupants, current work, attempts, communiques, artifacts,
returns… No bespoke Factory application is built" (WSD §7). Session = "the
day as clips" analog: sessions and tasks; Arrangement = the run viewer (Rev 5
table; `modeGrammar.ts:294–295`). The three-family division stands: Actuation
tunes *how* agents run, AIKit supplies *what they can do*, Factory organises
*what work happens* (DLW-PLAN §4.3).

### 3.2 Base instrument
The **Session** — tracks are sessions, clips are tasks. A new pane opens with
the session grid; the thread is the second pane of the default set (mockup
default tree `[sessions, thread]`, world-shell-mockup.html:748; a lone new
pane opens a terminal, :1602 — the terminal is a device-quality aperture, not
the base instrument). Why: the session grid is the mode's launching surface
(rows fire batches), the thread is its reading surface — the grid+thread pair
is to Factory what Session+clip-view is to Live.

### 3.3 The browser catalogue, resolved
Mockup (world-shell-mockup.html:1471): `Work [Sessions ⫴, Agents ◉, Runs ⬡,
Chats ☰] · Ground [Files ▢, Knowledge ▭, Views ▦]`. Landed grammar
(`modeGrammar.ts:303–312`): Sessions, Agents, Runs, Knowledge — all `cut`,
family `software-factory`; the agent shell's own browser carries the
fuller set (agent-shell-mockup.html:547: Collections/Favorites; Library/All,
Agents, Agentsets, Skillsets, Worlds, Context, Git, Models;
Places/Central, Work, Sessions — audit factory-1920 shows Sessions, Context,
Agents, Skillsets, Git live). Folder by folder:

- **Sessions** — *content*: live sessions; a row opens its thread / selects
  the track (`bcat==='sess'` rows, agent-shell-mockup.html:556 — "Open its
  thread in the main space"). Landed: the agency surface's own listing.
- **Agents** — *plugins* (roster): the agent population; **drag onto a track
  seats it as that session's agent** (mockup data-i: "Drag onto a track to
  seat it as that session's agent", :553). Under the ontology an Agent is an
  admissible package (central roster identity — never a hardcoded crowd,
  DLW-PLAN §4.3) that a chain instantiates; "+ Mint agent…" creates one.
- **Agentsets** — *plugins* (group rack): "Port crew" style member racks,
  nested as spawned, with max-parallel/depth (mockup `agentset` expanded
  pool, :603–605). The Drum-Rack analogue.
- **Skillsets** — *rack plugins*: chain rows with admit lights; "drop it on
  a session's chain" (:554). AIKit family.
- **Worlds** — *device plugins*: scope devices (reach ring, writes toggle).
- **Git** — *device plugins*: "Drop on a chain: the session commits through
  it" (:555) — Git · seat / read-only / PR lane.
- **Models** — *device parameter source*: the agent device's model plugin
  catalogue (Actuation family).
- **Context** — *dock tiles* (not devices, not panes): the dock's tile
  catalogue; "Click to open it as a tile in the dock" (:552); "Save current
  tiles as preset…" is the tile-set save.
- **Runs** — *content*: attempts and their task trees as temporal material
  (the run viewer's rows).
- **Chats** — *content*: conversation transcripts (the Buzz member timeline's
  material).
- **Knowledge** — *content*: the knowledge route — skills and sources the
  sessions can admit (landed, `modeGrammar.ts:310–311`).
- **Files** (mockup's Ground group) — *content*: the ground listing.
- **Views** — *instrument-types*: sessions grid, thread, terminal, timeline
  (run viewer), graph, canvas… (`LORDER.factory`, world-shell-mockup.html:1569).

### 3.4 The default set
Mockup: two panes — sessions grid | thread; detail `clip` (Task log);
dock tiles `['results','agents','terminal']`; browser category `sessions`
(world-shell-mockup.html:748, 752, 745); companion = result desk (Activity ·
Context · Inspect · Results, :1534). Landed tonight (audit factory-1920): the
agent shell live — real sessions as tracks (Commission-scene, Joined improv,
verify-probe…), the **Roster refused** disclosure (agent roster read failed,
honest), the **Gateway · hermes** device expanded in the browser pool
(Transport stdio·ws·remote; Approvals ask·session·always; Stall-after;
Frames "flow from the temporal adapter"; Spend "spend_ledger has no writer
in O-I — the meter discloses absence"), the **Task log** detail
(session/agent/status/attempt/workcell/budget — declared, waiting rows; the
note "the agent chain (the detail's other side) is live now"), the Context
dock with the Sessions tile + Terminal/Files/Web launcher. Status bar pair:
Task log | Agent chain (`modeGrammar.ts:296–299`).

### 3.5 Mockup coverage and SPEC-NEEDED
Covered: the whole agent chain gateway → agent → skills → world → git as
device faces with expanded pools; track strips (Watch In/Auto/Off, telemetry
activator, Solo, Arm, budget fader); needles with no drawn ends; stall
grammar; thread view with indented tool calls; clip view's Then (hand-off)
and Output style; the act-as-unit (ActSpec) and agency's five forms at five
places (DLW-PLAN §4.3). **SPEC-NEEDED (7):**
1. **Chats** folder owner — which read lists thread transcripts for the
   browser (the thread surface exists; the catalogue read does not).
2. **Files** folder placement: the mockup puts Files in the Factory browser;
   the landed grammar omits it — resolve (Ground group family owner).
3. The task-log read leg (`factory_attempt_read` family reads exist;
   `FactoryTaskLogDetail.tsx:126` declares attempt/workcell rows "declared,
   waiting here") — the log column's owner op.
4. The transport's writers: steer, voice, capture — "the transport's writers
   (steer, voice, capture) wait for their harness owners"
   (`modeGrammar.ts:348`).
5. The run viewer's lane model — what one lane persists as (thread? session?
   group?) and its temporal binding.
6. Chain-selector semantics for non-audio racks (do skillsets/gateways expose
   a selector? — DLW-PLAN ledger item 19).
7. **Models** folder source of truth — the Actuation family manifest's model
   catalogue (the mockup lists models in the agent device, not the browser;
   the agent-shell browser has a Models category whose rows are undrawn).

### 3.6 Exists vs to-build
- **Exists:** the entire agent shell (28 files, live-verified 18 observations
  / 0 faults — DLW-PLAN §4.3); `AgentContextDock` (tiles + launcher,
  `agent/AgentContextDock.tsx:9–20, 46–100`); `FactoryTaskLogDetail`;
  the factory grammar record; five families at the neutral door + L2
  software-factory attempt-review + workcell seat device
  (`worldShellFamilies.ts:105–118`); §14 parameter addresses (28 rows);
  audit factory-1920.
- **Mockup-only:** Agentsets/Models browser categories (rows undrawn);
  the Chats/Files categories; the run viewer over real needles (arrangement
  view is mockup-complete, landed as temporal adapter material).
- **Open:** the Factory receiving/advancement join (the queued-after-return
  gap, MAP.md:139); the Run's Expression production moved out of view
  lifetime (the FactoryLive.tsx fault); the Factory vertical (L8a); the
  Actuation experiment device; items 1–7 above.

### 3.7 Instruments/devices available
Instrument types: Session grid, Thread, Run viewer (Arrangement), Terminal,
Graph, Canvas, Timeline apertures. Device catalogue (chain order gateway →
agent → skills → world → git; ownership per `AGENT-DEVICE-OWNERSHIP.md`):
Gateway (actuation; agency gateway ai-kit; remote carrier workcell —
refused/composed, never live), Agent (model/effort/budget actuation;
autonomy/review-gate/custody software-factory; identity central roster),
Skillset racks (ai-kit, macros Thoroughness/Test depth/Reach/Risk), Agentset
rack, World device (scope), Git device (workcell), Ledger + Approvals
(software-factory), Attempt-review (software-factory L2), Seat (workcell).

---

## 4. EXPRESSIONS — the living field

### 4.1 Focus
The expressive projection and the retained M4 body: "the retained application
mounted once, with the deep cut changing disclosure" (`panels/expressions.tsx:43-46`
via DLW-PLAN §4.4). Glyphs, scenes, particles, cymatics, chakral structures,
image transformations, narrative sequences; any World material may acquire an
expressive projection (WSD §3.4). Rev 5's recomposition: "The pane holds only
the living field. The tool rail, toolbelt and Library move into the Studio
(Device)… The scene strip moves into Clip, beside the sequence and bindings"
(WSD :52–56).

### 4.2 Base instrument
The **Expression stage** — the retained application mounted once. A new pane
opens with the living field: the mockup's default set is a single pane
holding `tab('expression')` (world-shell-mockup.html:749); a lone new pane
opens the graph aperture `tab('field',{cnv:'form'})` (:1602) — the bounded
whole is the mode's *neutral* aperture, the stage is its *working* one. Why:
the engine is the mode's body (M4); every device edits its parameters; the
field is what all Expressions modes' instruments conjugate (the 3:3 reading).

### 4.3 The browser catalogue, resolved
Mockup (world-shell-mockup.html:1472): `Field [Graph ✳, Scenes ▦, Library ▤,
Views ▦]`. Landed: the grammar declares none (`modeGrammar.ts:362–364` —
"Expressions keeps the retained app's browser… the audit holds it correct");
the landed render (audit expressions-1920) shows `Library [Expressions,
Material, Objects, Parameters, Devices, Files, Knowledge] + Context`.
Folder by folder:

- **Graph** — a *live-face*: the compact bounded graph drawn in place
  ("bounded local whole · recenter by click", world-shell-mockup.html:1494–
  1497) — one Graph-instrument instance centred on the encounter, shown in
  the browser. Pulling it into a pane is the Views folder's `field` aperture.
- **Scenes** — *content*: the working set's scene rows (mockup rows
  "1 · the stone … current", :1498). Select/launch; whole-Scene launch stays
  atomic (`UI-UX-CONVERGENCE-STUDY.md:51`).
- **Library** — *content* (reusable material): glyphs, cymatics, particles,
  images, formations (:1499) — insertion material, preview separate from
  insert.
- **Expressions** (landed Library) — *content*: saved works (the port
  ledger's "Browser Expressions category (saved works)"; opening creates a
  fork needing the native save_as owner op — audit expressions-1920 shows the
  fork disclosure).
- **Material** (landed) — *content*: performance material (`material_list`
  through the qualified epoch; INSTRUMENTATION-CONTRACT.md:100–112).
- **Objects** (landed) — *content*: native subjects (entities).
- **Parameters** (landed) — *device parameters*: the property catalogue —
  registry groups, labels, units, source-defined behaviour; step 2 of the
  parameter workflow (browse → preview → Follow/Bind/Field → pin;
  `UI-UX-CONVERGENCE-STUDY.md:79–88`). This is the mode's device-parameter
  folder.
- **Devices** (landed) — *devices*: the device-family catalogue; "A device
  category is useful only when its insertion/capability is real"
  (`UI-UX-CONVERGENCE-STUDY.md:61`).
- **Files · Knowledge** (landed) — *content*: ground files; the knowledge
  route.
- **Context** (landed) — dock tiles.
- **Views** (mockup) — *instrument-types*: expression stage, field (graph),
  scenes, world, timeline, canvas, palace… (`LORDER.expressions`,
  world-shell-mockup.html:1570).

### 4.4 The default set
Mockup: one pane (the stage); detail `device` — the **Studio** instrument
frame (Tools · Selected actions · Formation · Material · Motion · Body 3:3
M1+M2+M3 toggles · Nara M4 · Capture; world-shell-mockup.html:1431–1440);
dock tiles `['anima','sky','trail']`; browser category `graph`; companion
Anima (Anima · Subject · Ta-Onta · Context, :1534). Rev 5 moves the tool
rail/toolbelt/Library into that Studio frame and the scene strip into Clip.
Landed tonight (audit expressions-1920): Library browser + Context, the
retained stage mounted with its own tool rail and Formation sequence panel,
scene transport (Day · Saved · Acts · Save scene · 0.0/32.0 s), detail tabs
Scene | States | Takes | Deep edit, status pair **Scene | Studio**.

### 4.5 Mockup coverage and SPEC-NEEDED
Covered: the Studio's section list; the graph live-face; scene rows; library
categories; the conjugate-body toggles (M1/M2/M3/M0/M5 on one frame);
Nara M4 privacy ("Personal M4 state does not become portable by being drawn",
:1382). **SPEC-NEEDED (6):**
1. When the browser's compact Graph face becomes the `projection.constellation`
   pane — the full-pane instrument threshold (pull out vs preview).
2. Library insertion ops — drag-to-scene per material kind (which owner op
   each of glyphs/cymatics/particles/images/formations dispatches).
3. Devices-folder insertion contract — which devices insert on which scope
   (field/entity/scene), and the compatible hot-swap domain for them.
4. The Studio frame's full parameter-address set — chosen controls are
   landed (toolbelt); the fixed sections' addresses (Formation/Material/
   Motion/Capture) need their §14 rows.
5. The Rev-5 recomposition's surface moves — scene strip into Clip beside
   sequence/bindings: the Clip tab's section list as data.
6. The browser-below pool's role selector grammar (property definition /
   macro mapping / modulation monitor — `UI-UX-CONVERGENCE-STUDY.md:63–64`).

### 4.6 Exists vs to-build
- **Exists:** the retained app hosting law; `oi.native-editor/v1` carrying
  the authoritative toolbelt chosen-control list (`NATIVE-EDITOR-STANDARD.md:149`);
  the compact chosen rack + categories/results browser + pool (owner-accepted
  13/13 with real Save/reopen); ref-based scene editing, Session lanes,
  Arrangement overview; the wave-2 device table — eleven field devices,
  entity devices (force, formation, sound, meaning), scene devices (scene,
  text, automation, blueprint, body, arrange) (INSTRUMENTATION-CONTRACT.md:454–485);
  the port ledger (213 rows: 136 ported / 24 partial / 20 owner-op-required /
  11 studio-only / 12 internal / 6 other-track / 4 not-ported);
  `packages/instrument-editors` (seven compact/full pairs); audit
  expressions-1920.
- **Mockup-only:** the Studio instrument frame (Rev 5's target composition);
  the graph live-face in the browser; the conjugate 3:3 body toggles as one
  device section.
- **Open:** every ledger row's live replay (all `pending-native-stack`);
  the fifth-places remedies (Takes tab → Timeline lanes; one Scene-editor
  host); S1 second-selection fix + R1/R2 multi-select ruling; items 1–6
  above.

### 4.7 Instruments/devices available
Instrument types: Expression stage (the engine), Field/Graph (bounded whole:
list · tree · graph · form), Scenes rows, Canvas, Timeline, World, Palace
apertures (as plain views here — in Technē the same views arrive as
instruments, WSD :800–802). Device catalogue: the eleven fixed field keys
(physics, pointer, relational, medium, contacts, morph, focus, colour, ink,
depth, resonance — `DEVICE-PANEL-BRIEF.md:17`), entity devices (force,
formation, sound, meaning), scene devices (scene, text, automation,
blueprint, body & triggers, arrange), the chosen-controls rack, the Studio.

---

## 5. TECHNĒ — the six instruments

### 5.1 Focus
The deep mode: six professional instruments — **project/graph, canvas,
timeline, journey, places, palace** (owner ruling D-F's plain names; DLW-PLAN
§4.5) — over one encounter. The deep cut "changes disclosure and available
operation; subject identity and native Action ownership are preserved"
(`lane-7-app-structure/STRUCTURE.md:15–19`). "The instrument is the
instrument": no separate Technē rack; the detail row is the focused lens's
own native control set (WSD :143–149). Session = M3′ Journey; Arrangement =
M2′ Relation Field (Rev 5). The World views ARE instruments in every mode:
the owner's 13 October 2026 ruling retires the earlier "plain apertures,
without instrument controls" rule — the Device side follows the focused
pane's instrument in Central, Factory, Expressions and Live at full
capability (WSD Technē section; DEVICE-SEMANTICS-LOCK §0.1).

### 5.2 Base instrument
The **lens instrument** — the focused lens's body. The six types
(`INST`, world-shell-mockup.html:803–809; landed as the lens bar,
`ModeDetail.tsx:234–241`): project/graph (view `field`), canvas (`canvas`),
timeline (`timeline`), journey (`scenes`), places (`world`), palace
(`palace`). A new pane opens with the default lens M0′/project-graph
(`newPaneTab()` → `tab('lens',{lens:'M0',cnv:'form',scale:'system',body:'central'})`,
:1602); the mode's default set opens **places at system scale** (M4′,
:750). Why: the mode is its instruments; a pane without a lens "is not an
instrument" and the detail row says so (:1443).

### 5.3 The browser catalogue, resolved
Mockup (world-shell-mockup.html:1473): `To hand [Sources ▤, Files ▢] ·
World [Bodies ◯, Locations ◎, Earth places ▲, Palaces ⌂, Journeys ⤳, Views
▦]`. Landed grammar (`modeGrammar.ts:419–436`): Sources and Files `cut`;
Bodies, Locations, Places, Palaces, Journeys `waiting`, family
`quaternal-logic` — "designed empty categories that name their owners, never
another mode's content". Folder by folder:

- **Sources** — *content*: the retained app's own work list (`nativeWorks`);
  a row opens the work in its instrument (`workspace.requestExpression`,
  `ModeBrowser.tsx:255–275`; "the source ref, revision and span travel; the
  file is never moved", world-shell-mockup.html:1488). Landed and live
  tonight: audit techne-1920 shows "audit-l6 replay scratch (native-actions
  audit lane…)" r1.
- **Files** — *content*: the ground listing; "add a reference to the lens
  from here" (`modeGrammar.ts:423–425`; landed, same GroundRows component).
- **Bodies** — *content of the places instrument*: the field's bodies (your
  planet, Earth the root anchor, other Worlds — the mockup lists
  `PLANETS` filtered by aperture, :1500). A row aims the places instrument
  at that body. Waiting on the Earth projection adapter (the atlas port
  refused the merge; `modeGrammar.ts:426–427`).
- **Locations** — *content*: placed artefacts and their anchors (LOCS;
  :1501). Waiting.
- **Earth places** — *content*: gazetteer places with precision (PLACES;
  :1502). Waiting on the Places owner.
- **Palaces** — *content that instantiates the palace instrument*: M5′
  compositions you enter (:1503). Waiting on the Palace owner.
- **Journeys** — *content that instantiates the journey instrument*: walk
  compositions, "8 stops" (:1504). Waiting on the journey owner.
- **Views** — *instrument-types*: **this folder lists the six instruments
  themselves** — clicking opens the instrument on the focused pane (the
  launcher note: "In Technē it opens as an instrument", :1584); the same
  list rides the detail row as folded instrument chips (Rev 4: "the one open
  on the focused pane is expanded with its own controls; the others are
  folded, and clicking one opens it on the focused pane" — mockup
  `renderDetail` techne branch, :1646–1649).
- The World group is thus the *content catalogues of the places/palace/
  journey instruments*; the instruments' own controls never live in the
  browser — they ride the detail row.

### 5.4 The default set
Mockup: one pane holding the places instrument at system scale
(`panes:[paneOf(tab('lens',{lens:'M4',scale:'system',body:'central'}))]`,
:750); detail `device` (Instruments: the focused lens expanded, others
folded); dock tiles `['epii','field','trail']`; browser category `sources`;
companion Epii (Epii · Source · Proposals · Field, :1534). Landed tonight
(audit techne-1920): the **lens bar** above the centre (Project / graph ·
Canvas · Timeline · Journey (on) · Places · Palace — the two `cut` lenses
drive the landed World cut, four hold places disabled); the M3′ Journey
centre frame (stop 1/8 · 2/8 · 3/8 rows, five columns, "The walk's writers
wait for the journey owner; the stops hold their places"); the **Clip**
detail with six honest rows (identity — no occasion retained; place · time;
disclosure; typed relations — declared, waiting; constellation; source);
Sources live; status pair **Clip | instruments**.

### 5.5 Mockup coverage and SPEC-NEEDED
Covered: the planet builder as the places instrument's own controls (Body /
Landmass / Climate / Sky / Locations / Relations sections —
world-shell-mockup.html:1446–1454, with Earth's landmass disabled: "Earth is
given"); each other lens's sections (M0′ Whole/View/Source; M1′ Tools/
Relation/View with "Promote… (native Action)"; M2′ Projection/Standing/
Window; M3′ Stops/Pacing/Take; M5′ Rooms/Path/Portals); the folded/expanded
instrument strip; the aperture · view-as transport cluster. **SPEC-NEEDED
(7):**
1. The World group's listing reads — the Earth adapter's catalogue ops
   (bodies/locations/places) and their admission shape (QL family declared,
   `quaternalLogicFamilyManifest.ts:77–82`).
2. Palace and journey composition owners (which family declares them; the
   mockup's ROOMS/WALK fixtures shape the contracts, :602–619).
3. The five non-places lenses' own controls as declared data — the mockup
   draws M0′/M1′/M2′/M3′/M5′ sections; their parameter addresses and owner
   ops are unlisted (M4′'s planet-builder controls are the drawn exemplar).
4. View → scene capture (`capture` slot, `modeGrammar.ts:460`) — the owner
   op that turns the current view into a scene.
5. The occasion window's owner (punch/loop slots as the retained-occasion
   window — :461–464; the sky contract's behaviour is law, the writer is
   not).
6. The lens→pane-kind mapping: which lenses instantiate which of
   `projection.earth|timeline|constellation|expressions` (timeline →
   projection.timeline; journey → projection.timeline's session presentation
   or its own kind?; places → projection.earth; project/graph and canvas →
   projection.constellation; palace → ?). The pane engine has four kinds;
   the six lenses need their kinds named.
7. The Source→instrument open preserving the encounter (ref + revision +
   span travel; the return leg's explicit door).

### 5.6 Exists vs to-build
- **Exists:** the Technē grammar record; `ModeBrowser` SourceRows (live);
  `TechneLensBar` (six plain names, two driving the World cut);
  `TechneClipDetail` (six honest rows over the temporal reading's retained
  occasion); `TechneInstrumentsDetail` (the QL family rack — the field/PCM
  face reading its owner, waiting faces named); `ModeCentre` Journey +
  RelationField frames; the atlas port (Earth/Graph/Aion bodies); the
  orphaned pure models (`m0m5/`, 37 files — the designated landing ground);
  the six target sets' definitions (126 targets). Audit techne-1920.
- **Mockup-only:** the planet builder's full section set; the
  folded-instrument strip; every lens's drawn sections beyond the two cut
  ones; the World browser groups' rows.
- **Open:** all 126 target landings (0 passed); the Earth projection
  adapter; journey/palace owners; the lane-7 structural moves (P1–P7);
  items 1–7 above.

### 5.7 Instruments/devices available
Instrument types (the six lenses) — each with its view body and its own
controls in the detail row. Device catalogue (QL family, all declared
waiting): sky (compact face over the landed `ql.sky-request/v1` contract),
torus (the M1 field as instrument device), m3-clock, deck, chakra,
m-prime-matrices (`quaternalLogicFamilyManifest.ts:38–76`). The chronos
contribution is the family's time binding (:84–90).

---

## 6. THE EPI-LOGOS LENS — not a mode

### 6.1 The pane-instrument picture
Epi-Logos is a **lens / world context, not a mode** (owner ruling D2 +
amendment A5; DLW-PLAN §7). Its pane-instrument picture: the lens **re-
catalogues** — while on, the file trees show the corpus (`EPI_CORPUS_PROJECT =
"epi"`), context sources narrow to the corpus, and Nara joins the agent
menu (`cradle/src/workspace/lens.ts` header, DLW-PLAN §7.1 Register 3) — it
opens no surface and never changes the mode. In Expressions and Technē the
mode's agent button selects the Prime–QL composition as the default option
(S4′ Anima, S5′ Aletheia; `EPI-LOGOS-AGENT-MODE.md`; `agentBody.ts` — the
world keeps its constituted agent while `world === 'epi-logos'`). Under this
mapping: the lens switches which *content* the browser catalogues and which
*agent* the conversation device binds — the instrument set, the pane tree
and the device grammar are untouched. The WorldRef is
`"central" | "epi-logos"` (`cradle/src/workspace/store.ts`); entering is one
write (`enterEpiWorld`, `CradleFrame.tsx:1902`); the context outlives
arrangement switches.

### 6.2 Exists vs to-build / SPEC-NEEDED
Exists: the footer toggle (`DesktopShell.tsx:409` aria-label "Epi-Logos
lens"), the head chip (`LeftFrame.tsx:130–132`), the E2 entrance binding the
world with explicit Leave, retention through the portal park. **SPEC-NEEDED
(3):** (1) lens × mode-browser: do the mode grammar's browser categories
re-root on the lens (a corpus category? narrowed Sources?) — the landed
ModeBrowser has no lens reading; (2) lens × set grammar: does a saved set
record lens-on/off (it should — it is world-context, which LayoutState.mode
neighbours but does not cover); (3) the corpus browser category's owner
declaration.

---

## 7. THE GRAPH CASE STUDY — two graphs, two instruments

**Owner correction, 13 Oct 2026 (DEVICE-SEMANTICS-LOCK §8.1):** the two
graphs below are no longer one type with two implementations. The atlas
coloured graph is the second view of the **0 instrument** (Earth and solar
system ⇄ Graph); the planned separate Graph instrument is folded into it.
The Obsidian-RE knowledge graph is its **own standalone instrument** under
its existing spec (`docs/cradle/WIKI-CONSTELLATION-SPEC.md`). The code
readings in §7.1–7.3 stand as descriptions of the two surfaces; §7.4's
shared type contract still describes how a type with several
implementations works, but these two graphs no longer share one.

### 7.1 The two implementations
**Implementation 1 — the atlas coloured graph surface.**
`packages/live-shell/ui/src/projections/atlas/src/graph/`:
- `build.ts` — the graph as pure data derived from the Model: "the graph is
  a second view of exactly the field the globe shows" (:2). Node kinds
  archetype/family/occurrence/body; edge kinds instance/co/tie/parallel/sky;
  ties carry their basis (`TieBasis`); time-liveness and neighbourhoods are
  computed here, DOM-free.
- `view.ts` — Canvas 2D, HiDPI, d3-force layout, d3-zoom, d3-quadtree hit
  testing; renders only on change, "goes fully idle otherwise" (:5–7);
  ghost visibility `GHOST_VIS = 0.05` for outside-lens nodes (:17).
- `switch.ts` — the Earth ⇄ Graph mode control (one pill, key G).
- `tools.ts` — the tool state (select/margin tools).

**Implementation 2 — the Obsidian-RE knowledge graph.**
`desktop/cradle/src/knowledge/GraphCanvas.tsx` + `shared/NavigationMinimap.tsx`
(+ `graphNavigation`, `graphRelationPresentation`, `camera`, `layout`):
- One demand-driven drawing loop (:11–16); pointer/wheel never render React
  per frame; drag-a-subject asks the live layout world; camera travel with
  easing that composes on `travel.to`, never an abandoned frame (:49–52).
- Unresolved links are drawn as **dashed hollow ghosts, separately from
  native assertions** (:67–70; `isUnresolvedGraphNode`), with an
  accessibility label that discloses "N disclosed sources; no resolved
  source to open" (:155).
- Context menu per subject: Select / Open source / Centre in graph / Open in
  Technè (native_owner-gated, :149–154).
- `NavigationMinimap` projects world-points (`navigationMinimapGeometry.ts`;
  the minimap controller draws the camera rect, :93).

### 7.2 How both appear in the browser
- Implementation 2 is the shell's **graph surfaces today**: the knowledge
  plane (`SurfaceBinding.view.knowledgePlane: "graph"|"page"`,
  `surface/types.ts:94`), opened through the `oi:epi-open-knowledge`
  dispatch (`WorldBrowser.tsx:96–115`, cited WSD §3.5), the Factory dock's
  **Graph** tile ("The knowledge-graph neighbourhood in play",
  AgentContextDock LAUNCHER; agent-shell-mockup.html CTX `graph`), and the
  M0′/project-graph lens's content.
- Implementation 1 is the atlas port's body: the **Constellation**
  projection (`projection.constellation` pane kind, `surface/types.ts:34`)
  hosting the atlas graph view; the world mockup offers it as the Expressions
  browser's **Graph** live-face, Base's **field** aperture ("The bounded
  local whole of the encounter", APS), and Technē's **project/graph** lens.
- The mockup's rule for which mode offers which: the *bounded local whole*
  rendering (impl-1-shaped, encounter-centred, list·tree·graph·form) is what
  Base/Expressions/Technē pull; the *knowledge graph* (impl-2, wiki/subject
  graph with ghosts and owner actions) is the inspector opened on selection
  from any projection (WSD §3.3/§3.5).

### 7.3 How a pane instantiates either
A pane holds a Graph when its binding says so: a projection binding
`{kind: 'projection.constellation', subject_ref?}` (types.ts:118 — the
optional subject pins or follows the encounter), or a surface binding with
`view.knowledgePlane: 'graph'` (the knowledge graph over its owner's
reading). The mockup's tab is `tab('field',{cnv:'form'})`. Two panes can
hold two Graphs of the same subject side by side — "the instance identity is
kind + subject, never the pane" (`surface/types.ts:31–33`).

### 7.4 The shared type contract (the sketch every multi-implementation type follows)
1. **Identity by ref** — nodes carry exact refs (`GraphNode{ref,label,kind}`;
   atlas `GNode{key,ref}`); selection is a ref, never an index (lane-3 E22
   law).
2. **A second view, never a store** — the graph derives from its owner's
   reading (`build.ts:2`; the knowledge graph reads its `GraphReading`
   model); no graph-owned node store.
3. **Honest ghosts** — unresolved links render distinctly and disclose their
   absence (mockup `GHOSTS`; `isUnresolvedGraphNode`; lane-1:C1).
4. **Encounter in, encounter out** — reads the spine's subject; reports
   select/open as encounter transitions (`GraphCanvas` props
   `onSelect/onOpen/onTechne/onClear`; the C3 canvas→graph hop carries exact
   `subject_ref, native_owner, origin, source_basis, returnTo` —
   INSTRUMENTATION-CONTRACT.md:114–122).
5. **Saved views carry subject basis and restore the camera** (lane-1:D3;
   `engine.target(camera)` travel API).
6. **Presentation axes declared per instance** — the bounded whole's
   list·tree·graph·form switch (`m0.view`) and the knowledge graph's
   labels automatic/all/focus, arrows, emphasis maps are instance settings,
   not type variants.
7. **Bodies may differ freely** — force-directed idle rendering vs
   demand-driven canvas; minimap in both (`NavigationMinimap`; atlas view's
   own); the TYPE is the contract, not the look.

**Other multi-implementation types found** (same template applies):
- **Timeline** — the audio Session/Arrangement pair (`SessionView`/
  `ArrangementView`), the native variants (`NativeSessionContent`/
  `NativeSourceArrangement`, `shell/nativeContent.ts`), the atlas non-linear
  scale (`atlas/src/data/time.ts`), the Timeline projection pane, the M2′
  Relation Field frame. One type, many bodies; the time model is the
  contract (lane-2 T1).
- **Document** — the four QL forms (hosted HTML devices), the files craft
  (`CentralSubjectDetail`), wiki pages (Expression-projected). Contract:
  CAS identity + basis + the save router's five outcomes.
- **Terminal** — the pane surface kind `terminal` (with cwd/command,
  types.ts:92), the Factory dock tile, the mockup's run-following terminal.
- **Conversation** — the Nara conversation device (`ConversationNaraFace`,
  binding `oi.nara-dialogue-binding/v1`), the encounter surface, the
  Timeline clip (transcript as temporal material), the companion
  Conversation tab.
- **Places/Earth** — the atlas globe engine (three.js, NASA tiles) and the
  MapLibre body ("MapLibre is the renderer — extend in place, no second
  globe", lane-4). Two body engines, one instrument type; the Occurrence
  binding contract (subject_ref + place + time + image + basis) is the
  seam.
- **Companion/agent conversation device** — the dock tile, the right-dock
  panel, the centre Conversations presentation (agency's five forms).

---

## 8. (reserved — numbering kept for stability)

## 9. THE SET GRAMMAR

### 9.1 What a saved set contains
A set = **panes × instruments × devices × contexts**, concretely:
- the pane tree (`LayoutState.root: Pane | null` — TabGroupPane/SplitPane
  with tabs, pins, presentation, `surface/types.ts:162–176`),
- every surface binding the tree names (`surfaces: Record<SurfaceId,
  SurfaceBinding>` — each binding carries its kind and its instance data:
  doc path, projection `{kind, subject_ref?}`, engine `{expressionRef,
  revision}`, terminal cwd, presentation refs; types.ts:60–118),
- the focus/maximize/side/detached state, window bounds,
- the detail presentation per mode (the mockup's `S.dv` — clip|device),
- the dock tiles open (the agent shell's `openTiles`; the mockup's `S.tiles`
  per mode) and the dock width,
- the browser's open category (mockup `S.cats` per mode) and the companion
  tab (`S.ctab`),
- the encounter spine reference (field · world · subject · occasion — the
  workspace context, not copied into the set),
- the mode it belongs to, and (open question, §6) the Epi-Logos lens state.

### 9.2 How defaults are defined per mode
The workspace **already keeps one layout per mode**:
`modeLayouts?: Partial<Record<WorkspaceMode, LayoutState>>`
(cradle `workspace/store.ts:42`) — "layout is the active mode's tree,
modeLayouts holds the others" (:179); `switchWorkspaceMode` saves the
from-mode's tree and restores the next's (:131–138). So the *default set*
per mode is: the mode's last-left layout, seeded the first time from the
mode's default. The mockup defines those seeds as plain data
(`S.modes` per mode: tree + panes; plus `S.dv`, `S.tiles`, `S.cats`,
`S.ctab` — world-shell-mockup.html:745–753, 1699). What the landed grammar
holds as data today: the browser categories, the detail pair, the centre
frames, the transport meanings (`modeGrammar.ts`); what is **not** yet
grammar data: the seed pane tree, the seed dock tiles, the seed detail
presentation, the seed browser category per mode.

### 9.3 How saved sets relate to the existing layout persistence
The existing persistence IS a set store for one unnamed set per mode:
`saveWorkspace`/`DocumentStore` and the mode-book (`store.ts`) already
persist and restore trees, bindings (with hidden-retention), detach/redock
and per-mode regions. A **named user set** is therefore not a new engine:
it is a named, immutable copy of a `LayoutState` + the dock/detail/browser
scatter, recalled by writing it back through the engine. Constraints the
grammar must keep:
- recall re-reads owners — a restored binding re-subscribes; nothing renders
  from the set file (the honesty law: state is not law);
- recall restores instrument *instances* (kind + subject + presentation),
  never raw pixels — the binding grammar already carries what's needed
  (`projection {kind, subject_ref}`, `engine {expressionRef, revision}`);
- mode switching keeps working across recall (the mode-book writes the
  active mode's tree on leave; a recalled set becomes that mode's current
  tree);
- the closedStack and hidden retention survive a save/restore cycle or are
  honestly dropped (named, not silently).

### 9.4 What needs building
1. **Seed defaults as grammar data** — per mode: seed tree, seed detail
   presentation, seed dock tiles, seed browser category (the mockup's
   `S.modes/dv/tiles/cats/ctab` promoted to `modeGrammar.ts`-style records,
   consumed by the frame).
2. **Set save/recall ops** — name, store, list (the browser's user-set
   place is open: a Sets-like category or the launcher's preset row — the
   agent-shell mockup already draws "Save current tiles as preset…" for
   tiles alone), recall through the engine.
3. **The dock/detail/browser scatter** join — today `openTiles` lives in
   AgentShellContext and the browser category in component state; a set must
   gather them (the mockup's per-mode `S.tiles/S.cats/S.dv` is the shape).
4. **Set-scope policy** — what a set deliberately excludes (encounter spine
   values, ephemeral readings, unrecovered drafts) and where that is
   disclosed on recall.

---

## 10. THE CONSISTENCY TABLE — cross-mode requirements

| Requirement | The law | Where it binds |
|---|---|---|
| Same chrome | Five regions, same toggles; panes headerless; one ⊞ pane control; drag centre/edge; ⇧ splits | WIDGET-GUIDE §2; WSD Rev 4; world-shell-mockup.html:443, 1619–1687 |
| Same transport | Every mode keeps the same slots in the same places; only meaning changes; a disabled control names what is planned (`waitingNote`) | Rev 5 table; `modeGrammar.ts:136–158, 476–478` |
| Same browser grammar | Category column + results + context pool; entries composed from family-declared surfaces; `cut`/`waiting` states; designed empty categories name their owner; preview ≠ open ≠ add | `modeGrammar.ts:64–95`; `ModeBrowser.tsx:280–303`; UI-UX study :61 |
| Same browser folder semantics | Folders are content / instrument-types / devices / live-faces (§0 table) — the same four kinds in every mode's catalogue | this document §0, applied §§1–5 |
| Same detail discipline | Clip \| Device pair toggled from the status bar; per-arrangement meanings are data; three disclosure levels (compact → configure → deep); deep edit returns to the same selection; fold/compact/configure states | Rev 4 table; `modeGrammar.ts:496–503`; NATIVE-EDITOR-STANDARD :33–39; WIDGET-GUIDE §1 states |
| Same lights law | A light is a reading; unknown state has no lamp; activator only where a real owner enable exists | WIDGET-GUIDE §1; DEVICE-PANEL-BRIEF rule 6 |
| Same empty/refusing law | Empty slot names its affordance; absence is disclosed, never faked; `waiting` names its owner | WIDGET-GUIDE §1; `ModeCentre.tsx` header law |
| Same tooltip law | `data-i="Name|Function text"` on every control; the status bar is the single explanation surface | WIDGET-GUIDE §1 (F2); `slotDataI` |
| Same pane grammar across modes | Pane kinds + bindings are mode-neutral (`projection.*`, subject pin); per-mode defaults are seeds, not different engines | `surface/types.ts:31–38, 118`; §9 |
| Same encounter spine | Mode switch = encounter transition over mode × WorldContext × epoch; the encounter carries across modes; pinned panes keep their subject | `modeGrammar.ts:16–24`; mockup follow/pin; types.ts:111–118 |
| Same family exposure | Each family: browser categories, rack devices, projection adapters, inspectors — four places, nowhere else | WSD §16; `worldShellFamilies.ts` |
| Quality identical, content per mode | The audit bars travel whole (stillness lawful, focus/fullscreen, colour journeys with meaning, metadata banned from stages); only the mode's nouns differ | DLW-PLAN §4.5 acceptance shape; CONVERGENCE craft bars |

---

## 11. What O1's ontology document should bind to from this mapping

1. **The four folder kinds** (§0) as the browser's ontology — every mode's
   sidebar resolves into content / instrument-types / devices / live-faces;
   O1's `plugin` and `device` terms should cite this table for where each
   appears in the catalogue.
2. **The instrument-type registry** — the "Views" folder of each mode
   (§§1.3–5.3) is the mode's list of instantiable pane-instrument types;
   the landed seeds are `APS`/`INST` (world-shell-mockup.html:803–830) and
   the pane-kind list `PROJECTION_PANE_KINDS` (types.ts:34). The type ↔
   pane-kind mapping for Technē's six lenses is SPEC-NEEDED item 5.6.6.
3. **The device boundary** — devices ride chains, never pane bodies; the
   browser's device folders list insertable plugins (§0 row 3); Base and
   Technē draw the boundary sharpest (§2.3 last bullet, §5.3 last bullet).
4. **The base-instrument table** — Set document / Document / Session /
   Expression stage / lens instrument (§§1.2–5.2), with the mockup seed
   citations.
5. **The Graph contract** (§7.4) as the required shape of every
   multi-implementation type's shared contract, and the named sibling types
   (§7 closing list).
6. **The set grammar** (§9) — a set's contents, the per-mode defaults as
   grammar data, and the recall constraints; O1's `set` term should bind to
   `LayoutState` + `modeLayouts` + the scatter, not to a new store.
7. **The consistency rows** (§10) as the invariants the ontology must not
   break when modes diverge in content.

## 12. SPEC-NEEDED counts (the owner's expected list, per mode)

| Mode | Count | Items |
|---|---|---|
| Live | 6 | §1.5 |
| Base · Central | 7 | §2.5 |
| Factory | 7 | §3.5 |
| Expressions | 6 | §4.5 |
| Technē | 7 | §5.5 |
| Epi-Logos lens | 3 | §6.2 |
| Cross-mode | 4 set-grammar builds + 2 open browser items (Factory Chats/Files placement inside §3.5; audio family admission inside §1.5) | §9.4 |

Total: **36 named specification gaps**, each citing the mockup element that
implies it and the owner read that must answer it.

## 13. Source register (read in full for this mapping)

Protocol pack: `WORLD-SHELL-DESIGN.md` (Revisions 2–5, §§1–18);
`UI-UX-CONVERGENCE-STUDY.md`; `FUNCTIONAL-CROSSWALK.md`;
`INSTRUMENTATION-CONTRACT.md` (incl. wave-2 device table and chain strip);
`NATIVE-EDITOR-STANDARD.md`; `agent-shell-mockup.html`;
`world-shell-mockup.html` (Rev 5 state incl. Rev-4 pane tree, dock, Clip|
Device, BCATS, INST/APS, LORDER, CTABS, DVN); `icon-cut.html` (the icon
language `inhabitants/sdk/icons.ts` is generated from);
`EXPRESSIONS-PORT-STATUS.json` (213 rows; counts as of 9 Oct audit);
`/Users/admin/Central/Work/Quaternal-Logic/docs/M-PRIME-PHYSICAL-MUSIC-WAYFINDER.md`.
Lane sources: `shell/modeGrammar.ts`; `shell/ModeBrowser.tsx`;
`shell/ModeCentre.tsx`; `shell/ModeDetail.tsx`;
`agent/AgentContextDock.tsx`; `inhabitants/worldShellFamilies.ts`;
`inhabitants/quaternalLogicFamilyManifest.ts`;
`inhabitants/centralBrowserCategories.ts`; `shell/panels.ts`;
`shell/useSet.ts`; `shell/document.ts`; atlas `src/graph/{build,view,switch}.ts`;
cradle `knowledge/GraphCanvas.tsx`; cradle `shared/NavigationMinimap.tsx`;
cradle `surface/types.ts`; cradle `workspace/store.ts`;
`wayfinder/WIDGET-GUIDE.md`; `wayfinder/DLW-PLAN.md` (§2, §3, §4.1–4.5, §7);
audit captures `/tmp/mode-audit3/*.png` (all five modes at 1920) and
`/tmp/mode-audit5/base-sweep.png`. `DLW-PANES-ONTOLOGY.md` (O1) had not
landed at write time; §11 states the binding points for it.
