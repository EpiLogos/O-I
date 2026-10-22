# T-WORLDS — the run from here to the owner's UX testing (18 Oct 2026)

From the documentation lane, for the lead. The owner (18 Oct, afternoon) set four lanes before the build runs on the realigned UI any
further, and asked that the manual, the device and instrument spec and the shell's UX be complete enough that the build runs on its own
until the owner's own UX testing. This ticket draws that boundary: what the run builds from here, in order, what each piece is checked
by, and the walk that says the shell is ready for the owner to test. PATH stays the lead's; this is the input to its §5 and §7.

## 1. The boundary

**Inside the run, in order, with no owner gate until U0:**

0. What is still owed from T-REALIGN and the owner-op round (PATH §7): the screen checks of R1–R5 not yet seen (the Day, Physics,
   the Skillset rack and Scope in six views; Clip view in Factory, Expressions, Technē and Live; Scale mapping), and the OO row's open
   ops. These finish first; nothing below reopens them.
1. **W1 — the pool** (§3). It goes first: the owner's condition for running further builds on the realigned UI.
2. **W2 — Central: the Day as the set, worlds as tracks, pages as clips** (§4), with the page templates redone.
3. **W3 — worlds you build: procedural bodies and your system** (§5).
4. **W4 — Nara: personal practice in the shell** (§6).
5. **U0 — the readiness walk** (§7). When it passes on the native candidate, the run stops and the owner tests.

W3 and W4 touch no file W2 touches (zones below) and may run beside it, at most two Opus builders at once (PATH §7).

**Outside the run:** the AE re-port at a new pin (T-AE-REPORT: when the owner says AE is ready; AE HEAD `36ac83f` is 15 commits past
the seat's pin `5fe5117`, with `SkyLocus` and ringed bodies); the theme lane (T1); philosophy (worldhood, co-internality); QL-MEF's own
instrument packets (#281).

**Settled, not to be asked** (derived from code and law, 18 Oct):
- A reroll never rewrites a location's coordinate: the atlas never writes a coordinate (`projections/atlas/places/placeTool.ts:1-20`),
  so "settling on the new land" is drawing only (manual §17.2 rules).
- **Withdrawn (owner, 18 Oct evening):** the ecology — animals and environs — is not a World feature, and agency is not "the bee".
  The animals are the owner's rigged creature roster (`Work/face-rig`, `creatures-roster.js`, `creature-kit.js`), to be mapped to
  agent types by their real behaviour (a pattern contract: Start, Stay, Count, Reach, Link, Join, Change, Failure) and carried as
  the faces of agent devices and instruments; the environs (plants, water, landforms) are of the same nature, the faces of process
  types. The Earth, its places and its weather are the World's and a separate feature. Nothing of the ecology is built in this run
  until the owner places it.

## 2. The source

The manual, O-I main (`614b86de5` or later; `docs/dlw/DLW.html`):
- §5 Central (the Day as the set, worlds as tracks, the pool holding workspaces);
- §10.2 panes and layouts (a pane arrangement is a **layout**; "set" now means Live's set, which in Central is the Day);
- §10.3 and §16.7 the browser and the pool; §16.3, §16.4, §16.9, §16.14 (Whole stands only as the band above the chain);
- §17.2 World (your system; the reroll rule);
- §18.1 Central: the Day, its worlds and their pages (the set table, the world track, the Launch panel, what carries to tomorrow);
- §13 and §24 Nara: practice (W4), with §24.9 placing each practice in M4.

The four lane readings behind this ticket (read-only, code-cited) are summarised in each section below.

## 3. W1 — the pool

**What it is now.** The pool under the browser stacks three things in every mode (`frame/browser/Browser.tsx:83-87`): the aperture
slot (the focused pane's context, `frame/browser/apertureViews.tsx`), whatever a browser body portals into it (Expressions' material
and property detail and native device pool, `components/WorldBrowser.tsx:215-230`; Factory's `agent/AgentDevicePool.tsx`), and the
selected device's Whole (`frame/devices/DevicePool.tsx`), which also opens the browser when a device is chosen (`App.tsx:253-254`).
Live's Groove Pool table (Groove Name | Base | Quantize | Timing | Random | Velocity, Global Amount) was replaced by the device pool on
14 Oct (`929f2a58a`, `components/BrowserPane.tsx:46` before it). The manual placed Whole "in the pool" and the M′ matrices "in the pool";
both are gone from it now.

**What it becomes** (manual §10.3, §16.7):
- In every mode: the **workspace pool**. Columns Workspace (name on colour; the one you are in is lit), Panes, Instruments, Widgets,
  Layouts (each On/Off), Opens in. Row acts ▶ Launch and Keep. Footer: On launch (Restore all modes · open mode · nothing), Keep context
  (On change · On leave · Manual). Drop a pane's tab on it to make a workspace. Drag a workspace onto a Central world's track to make it
  that world's way of working.
- In Live, a switch at the pool's head shows the set's **grooves**: Groove, Base, Quantize, Timing, Random, Velocity, Global Amount, and
  "Drop clips or grooves here". The set owner reads groove names today only (`packages/live-set/src/edit.rs:375-391`); read the whole
  `GroovePool` and write it through the set's edit path (the `436958ee8` pattern, on the set's revision).
- ⌥⌘6 shows or hides the pool (Live's key), ⌘⌥B the browser.
- Nothing else is drawn in the pool.

**Moves.**
- Retire `frame/devices/DevicePool.tsx`, `agent/AgentDevicePool.tsx` (the Git seat's addresses go to the Git / landing device's band),
  `WorldBrowser.tsx`'s pool portal (`NativeDevicePool` → the band; material and property detail → a preview at the foot of the browser's
  list), `BrowserPane.tsx:108`'s standalone pool, `App.tsx:253-254`.
- `DeviceView.tsx:284` `FRAME_OF_VIEW.whole` is the band (`'flip'`); the catalogue's `Frame` `'pool'` leaves `design.ts:59` in the same
  change (W1 may edit that one line of the catalogue; its only consumer is `DeviceView.tsx`).
- The aperture slot's parts go home: the pin to the pane's head, the context (field, world, subject, occasion) to the encounter bar, a
  pane's own view rows to its instrument's device.
- The workspace book persists to browser storage today (`desktop/cradle/src/workspace/store.ts:240,353`). Give it a native owner with
  revisions; place it by `central-placement` (it is per-person UI context, not authored ground).
- "Sets" (named pane arrangements: `shell/SetsSection.tsx`, the shared `sets` browser source in `shell/modeBrowsers.tsx`) become a
  workspace's layouts, kept by the pool.

**Zone:** `frame/browser/**`, `frame/devices/DevicePool.tsx`, `agent/AgentDevicePool.tsx`, `components/WorldBrowser.tsx` (pool only),
`components/BrowserPane.tsx` (pool only), `continuity/workspace.tsx`, `shell/SetsSection.tsx`, `packages/live-set/src/edit.rs` (grooves).

**Done when:** on the native candidate, in each of the five modes, the pool shows the workspaces and nothing else (Live: its grooves
behind the switch); choosing a device on a chain or in the browser never fills the pool; Whole stands only as the band; a workspace kept
in Central and launched from Factory brings back Central's layout.

## 4. W2 — Central: the Day as the set, worlds as tracks, pages as clips

**What it is now** (lane reading, code-cited): Central's tracks are the workspace book's workspaces (`timeline/centralTrackAdapter.ts:1-12`,
`:294`; `frame/tracks/useCentralTracks.ts:70-94`), their clips the places the book recorded (`:300`), the Day always the Main track. Every
new page — Flow, Day copy, Beings, Things — lands in `Control/user/flows/` (`flow/createInPlace.ts:60-61`), and the Flows listing admits
every `.html` there (`shell/ModeBrowser.tsx:399`; `centralDocuments.ts:46-51`), so a Beings page lists as a Flow. Flows append through
desktop code with a whole-file CAS write (`flow/instance.ts:171-199`, `flow/instances.ts:46-48`); Beings and Things have no owner op but
the generic file save (`document/hostSave.ts:59-127`); the shell never calls `central initialise-day` (only the constant,
`central/centralVertical.ts:108`) and its New Day writes a copy into the flows folder (`native/Workbench.tsx:537-550`). Beings and Things
open as file tabs, not panes (`useOpenCentralDocument.ts:22-39`), so their Save state never publishes; their Full views and the Day's
iframe the blank template, not the page (`central__beings.tsx:313-340`, `central__things.tsx:321`, `catalogue/panels/day.tsx:154-163`).
The device sheets carry literal paper palettes (`central__beings.tsx:41-44`, `central__things.tsx:42`, `central__document.tsx:44`,
`centralDocuments.css:12`, `central__text.css:5`, `central__notes.css:21`).

**What it becomes** (manual §5, §18.1):
- **The set is the Day.** The transport shows its date; earlier Days open from the browser read-only; after rollover tomorrow's set
  opens in a second tab. Selecting the Main track puts the Day's open face in Clip view (the Day's clip binding,
  `central/clipBinding.ts:334-371`, stays, as the Main track's).
- **A track is a world** — your own, Earth, a project's or a book's (a register: one wiki per register), a visited one. Head: Name,
  World, Kind (Project · Book · Practice · Other), Folder, Place, Workspace. Mixer row: Output the Day; Activator Send to Day; Arm the
  world's agent writes directly; Solo narrows the Day's faces and the World to it; Monitor for a visited world. Chain: Packet, the
  world's Agent, Scope (and Ground hygiene, Impact on a code folder).
- **Clips are pages**: Beings, Things, Flows, kinds you make — in the world's folder, not `Control/user/flows/`. A page **plays** when
  launched (Launch panel: Opens as — Dialogue · Flow · Journal for a flow; Page · Reading · Walk · Sky for a being or thing; Opens in;
  Seats). A playing page is an open moment: launching allocates (or rejoins) a NOW clearing tied to the page ref; Stop resolves it
  (`central.now.allocate` / `central.now.lifecycle`, which has no shell path today — PATH §7's R5 rail row). The NOWs widget lists them.
- **Rows** are pages you open together, named; a row launcher opens its pages. They are kept with the Day.
- **Arrangement view lays itself down**: each page along its world's track for as long as it played, read from the day's event
  stream (`kernel/src/temporal_events.rs`, the `Now` kind) — no hand recording. Take lanes are page revisions (as now).
- **The close carries** what still plays into tomorrow's set, playing, with today in its lineage, each with its live reason and next
  review (day-close law, `Control/agents/governance/field-and-now/day-close.md`); stopped pages stay in the closed Day's arrangement.

**The templates, redone and open.**
- A `page` owner op (new `desktop/cradle/kernel/src/page.rs`, shaped on `being.rs` and `central.rs`): read; list by world folder;
  `mutate-field` with CAS and a receipt (the `receiving mutate-field` shape, `receiving/client.ts:57-71`); create in the world's folder
  (`projectcentral.source.create` for a project's world). Title, Colour, ties (World, Subject, Kind of being, Office, Sources, Place,
  Anchor, Expression, Layout, Tone), notes and highlights write through it — today all refused (`central/clipBinding.ts:188-199`,
  `central/devices/pageBindings.ts:209-232`).
- The page island gains `kind` (Person · Agent for a Being) and a Flow gains `meta.world`.
- `New Day` calls `central initialise-day`; the Day device gets its Open today control (`dayBinding.ts` has the binding, `day.tsx` none).
- Beings and Things open as panes with a hosted face like `DocumentFlowFace`, publishing Save state to `documentDoor`; every Full view
  hosts the bound page, never the blank carrier.
- Templates (`desktop/cradle/documents/oi-beings.html`, `oi-things.html`, `ql-flow.html`, `ql-daily-die.html`, `forms.json`): tokens only
  (the paper family as tokens in `styles.css`, not per-sheet hex); the four highlight colours; notes rendered beside the page; "In
  relation" links open in the shell (a page ref opens its page; an `http(s)` link opens the Web widget) — the frame is sandboxed without
  popups today (`material/MaterialSurface.tsx:415`), so links do nothing.
- Journal dates come from the page, not literals (`catalogue/clips/central.tsx:211-212`).
- **Beings and Things in reading, walks and sky** (manual §18.1 Launch panel): each page projects one `Occurrence`
  (`projections/atlas/src/types/field.ts:198-238`) through `checkOccurrence` → `admitOccurrences` (`projections/occurrence.ts:53,96`), as
  the QL sky adapter does (`inhabitants/qlSkyEarthAdapter.ts:29-39, 81-121`): a family per page kind (subtype `figure` for a Being,
  `object` for a Thing; untied to archetypes so it admits after mount), `locusType` `artifact`, `subject_ref` the page ref, `basis` its
  revision, `body` its introduction and sections, `cites` its sources. Reading draws `body` and `cites` (`ui/deep.ts:440-441`); a walk
  stop is `WorldWalkStop` (`timeline/worldTrackAdapter.ts:283-296`) via `projectFieldThread` (`walkTimeline.ts:42-58`). Sky stays closed
  for a page with no body tie (a person's natal sky is Nara's, W4, and never enters atlas state).
- Name the homonym: "Being" also names a SharedField participant encounter (`desktop/cradle/src/explore/being.mjs`, kernel
  `being_encounter`). The Being page is not that; keep the encounter's name its own.

**Zone:** `timeline/centralTrackAdapter.ts`, `frame/tracks/useCentralTracks.ts` and Central's parts of `modeTracks.ts`/`trackLanes.ts`,
`central/**`, `shell/ModeBrowser.tsx` (Central rows), `shell/modeGrammar.ts` (Central), `desktop/cradle/src/flow/**`,
`desktop/cradle/src/personal/page.mjs`, `desktop/cradle/documents/**`, `desktop/cradle/kernel/src/page.rs` (new) and its dispatch.

**Done when:** on the native candidate, with the owner's real ground: Central opens on today's set; your world and one project's world
stand as tracks; a Being and a Flow made from the browser land in that world's folder and show as its clips; the Being launched as
Reading opens in the World's reading view and as Walk at its stop; the Flow launched resumes with its agent seated and shows in NOWs;
its Stop closes the moment; the Arrangement shows both where they played; a title, a tie and a highlight written in Clip view land in
the page file with a receipt.

## 5. W3 — worlds you build

> **Reopened 20 Oct 2026 by T-PROCEDURAL-BODY.** The body record, the worker and the System scale below were built; the generator's
> picture is far below the Earth's and is rebuilt as `fbm-sphere` version 2 under a gate measured on the Earth. The outer ring below
> ("files and context") is withdrawn: the rings carry agents at work (inner) and the recent artefacts they made (outer), nothing
> else. The record stays as specified here.

**What it is now** (lane reading): nothing generates a body, in the seat or in AE (the only generator is the mockup's CPU fbm,
`world-shell-mockup.html:858-916`, rerolled with `Math.random`). The planet builder's controls wait in `projections/atlas/places/PlacesPlate.tsx:174-200`
("Your own body has no builder in this suite yet", `:177`); the World design's Whole lacks Body, Landmass, Climate, Sky and Locations
(`catalogue/panels/atlas-earth__globe-engine.tsx` ~630-665); no owner stores a body. Places write through AIKit's wiki facts
(`PlaceSet`, `ai-kit/crates/aikit-core/src/knowledge_wiki_facts.rs:33-36`, CAS at `:154`) and every place is on Earth (the facet has no
body field, `desktop/cradle/src/techne/contract.ts:254-266`). Projects are unlocated registers (`provider/suiteReading.ts:590`).
Presence jitter is keyed by slot index (`globe/presences.ts:136,316`), so identity does not survive a reorder. `BodyKey` is a closed
union of ten bodies plus `terra` (`src/types/sky.ts:7-11`). Scales differ: code `system | body | region | palace | graph`
(`places/placesModel.ts:172`), manual Field · System · Body · Region · Place.

**What it becomes** (manual §2, §17.2):
- **A body record per world**: `aikit.world-body/v1` on a register's root space row (`knowledge_wiki.rs:189-210`; `WikiSpace.extensions`):
  `body_ref`, `seed` (u32), `generator {id: "fbm-sphere", version}`, `landmass {sea_level, continents 0.6–3.6, relief, coast}`,
  `climate {warmth, moisture, ice_caps}`, `sky {atmosphere, clouds, axial_tilt_deg}`, `landing` (its place on your planet). Colour from
  `paletteOfRef(body_ref)` (`suiteReading.ts:240`). Writes: `Change::BodySet` beside TemporalSet and PlaceSet, a `Target::Space` arm in
  `extensions()` (`:82-96`), `apply()` with its CAS and receipt, a dispatch branch in `desktop/cradle/kernel/src/construction.rs:54`. A
  reroll is a BodySet with a new seed; nothing uses `Math.random`.
- **The generator**: a pure function in a new `projections/atlas/src/globe/body.ts` (worker-capable) making the equirect texture the
  Earth's seam takes (`globe/earth.ts:98-104`, replacing `loadBaseLo/Hi` `:67-82` for a generated body), carrying the relief and
  bathymetry cues `EARTH_FRAG` reads (`globe/shaders.ts:259-261,299-310`) — check on screen before committing to it. No close-zoom
  tiles for a generated body in this run (tiles are GIBS, `tilemath.ts:23-24`). Earth stays given.
- **Identity**: `hash01(i)` → `fnv1a(subject_ref)` (`presences.ts:136`, `suiteReading.ts:213`); a new per-presence `aLocus` attribute
  for the mythic look (`aMeta` is full); a location's coordinate is never rewritten.
- **Your system**: each Central world track's register is a body in the System scale, built from its own record, landing at its place
  on your planet; satellites keyed by `subject_ref` on `PlanetOrbits` (`sky/orbits.ts:72`) — inner ring agents at work and open moments,
  outer ring files and context — with a separate orbit-body key space, not a widened `BodyKey`. Scales follow the manual.
- **The World device**: the Whole gains Body, Landmass, Climate, Sky and Locations (the documentation lane updates the design; the
  binding rows follow `inhabitants/ql/devices/atlasDevices.ts:32-50` with `writeThroughOwner`); the Bodies row of Technē's World group
  flips to cut when the record reads (`shell/modeGrammar.ts:454-462`).

**Zone:** `projections/atlas/**` (except the practice binding in `AtlasProjectionPanel.tsx` and `src/practice/**`, which are W4's), `inhabitants/ql/devices/atlasDevices.ts`, `agent/shellSetterBridge.ts` (the setter), ai-kit
`knowledge_wiki_facts.rs` and `knowledge_wiki.rs`, `desktop/cradle/kernel/src/construction.rs` (the branch).

**Done when:** on the native candidate: your world builds from its sliders and rerolls, every location keeping its name and position;
one project's world shows as a second body landing at its place; the agents at work and the open moments ride your world's inner
ring.

## 6. W4 — Nara: personal practice

**The owner's ground** (QL `AGENTS.md` "Epi domain-agent and Nara journey programme"; `docs/integrations/epi-logos/EPI-LOGOS-AGENT-DEVELOPMENT-PROGRAMME.md:110`):
"Day/Flow is how Nara comes to know the person over time." A continuing concern is a journey; one Tarot deck is its vocabulary, the
I Ching its change reading; Nara presents the reading as a native Expression; Day/Flow stays the writing surface. The relation law
(QL `docs/kernel-rebuild/K10-NARA-M4-CONTRACT.md` §1; `EPI-WORLD-M4-EXPERIENCE-RECONCILIATION-2026-10-01.md` §2, §5): Central owns NOW,
DAY and Flow sources and Nara "never creates a second journal"; the person is the hub (M4.4.4.4 Personal Pratibimba,
`dcb274c1-fbbc-5914-b27d-dea979c78558`); casting, symbolic assignment, interpretation and an M3 act are distinct; corrections supersede
without erasing; practice never writes M4.0 or the shared map.

**What it is now** (lane reading; the M4 tree and its serving code are Appendix A): live paths reach the M4 root (the Expressions Nara
instrument, `expressions-app/field-studies-journeys/src/naraInstrument.tsx:278-299`), M4.0 identity (`kernel/src/nara_identity.rs`) and
M4.4.4.4 through the M3 clock (`inhabitants/ql/devices/qlM3Clock.ts`). QL's oracle journey (`ql-mef/src/epi_agent.rs:1315-1344`,
`nara/domain/oracle_journey.rs`), lived-context composer (`:1352`) and elemental map (`:693`) have no O-I caller. Dreams, natal charts
and coincidences sit in the atlas's browser storage (`projections/atlas/src/practice/store.ts:25` `aae.practice.v1.`;
`lenses/astrology.ts:5-6`; bound by `AtlasProjectionPanel.tsx:147-170,360`), with a second natal engine (`astro/natal.ts`). Meditation
has no code anywhere. Every turn is tagged M4.1 embodied (`desktop/cradle/src/nara/nativeDialogue.ts:98`) while `nara_dialogue.rs:270,273`
writes no branch and `dialogueContext.ts:262` defaults to m4; voice is admitted only in M4.1 (`nara_voice.rs:274-278`). The Sky device has
no natal source (`inhabitants/ql/devices/qlSky.ts:223`). Deck and Chakra are `waiting` (`inhabitants/quaternalLogicFamilyManifest.ts:68-79`).

**What it becomes** (manual §24):
- **The practice world**: a Central world of Kind Practice, fogged; its chain Packet → Nara → Scope; Activator off by default; its clips
  a journal, a dream journal, sittings and journeys (W2's page op makes them).
- **Nara answers from your pages**: `nara_lived_context` (new kernel op) wraps `nara.lived-context.compose`, fed with Central's full
  `central.document-reading/v1` readings of the selected Day and Flow passages; the answer returns through `nativeReturn.ts:179-208`
  (Flow, with CAS) naming each passage.
- **The branch per turn** follows the practice it comes from: journal and dreams M4.4.4.2/M4.4.4.3, a journey M4.2, a sitting or the
  centres M4.1, identity M4.0, a container M4.3-2.x, a return M4.5, an open conversation M4.4.4.4. Replace the constant at
  `nativeDialogue.ts:98`, reconcile `nara_dialogue.rs:270,273` and `dialogueContext.ts:262`; a spoken turn stays M4.1 (the voice gate is
  kept: speech is the body's).
- **Journeys**: `nara_journey` (new kernel op, allowlisted in `inhabitants/sdk/kernelOps.ts`) wraps `nara.journey.open|apply|read`
  (`epi_agent_command.rs:140-152`). A journey is a Flow page on the practice world; its returned state is saved into that page through
  W2's `page` op with revision CAS (QL: "Central must persist the returned state with a revision check"). The six acts (Draw with consent
  to chance, Assign, Move, Link, Turn, Comment) are the Deck's (§22.4) writes; Draw uses genuine admitted entropy. Launch as Reading opens
  the journey as an Expression scene. Deck flips to `cut` when it reads.
- **Dreams**: the dream journal's entries are Flow entries (`MaterialKind::Dream` for lived-context). The atlas's practice store is
  re-bound at the host seam (`AtlasProjectionPanel.tsx`), not in AE's ported code: its dreams read and write the dream journal; Amplify
  runs the ported pure `practice/amplify.ts` and lands Source entries.
- **Sitting** (manual §24.3): a new device (the documentation lane draws `quaternal-logic__sitting.tsx`); Play rings the bell through the
  field's own sound (the physics sim sounds), the transport times it, Stop keeps the actual length; the record is a page on the practice
  world through W2's op. No score, no derived state.
- **Containers** (manual §24.5): a Flow's `meta.container` (Dialogue · Circle · Inquiry) and an entry's kind (Observe · Interpret · Choose)
  in the flow form (`flow/plural.ts`); Circle passes Speak as in order.
- **Identity and your sky** (manual §24.6): your Being page's Subject is your `person_ref`; its identity layers read through
  `nara_identity` (`open`/`select`), each present with its source or absent with its reason; Launch as Sky gives the Sky device the page's
  identity as its natal source (closing `qlSky.ts:223`); the atlas's own natal engine is not used for a person.
- **Centres**: `nara_elemental` (new kernel op) wraps `nara.elemental-map`; Chakra flips to `cut` when it reads.
- **Lenses** (manual §24.8): a QL context reading over `ContextField` (`ql-mef/src/nara/domain/context.rs:104`), added in QL (one
  development across repos); each lens leaves a Source entry; Trika is offered, never a verdict.
- **Returns**: `nara_epii` (in use) and QL `logos.return` (no O-I caller yet) return to the Day's face 5; a reviewed pattern reaches the
  wiki only by return.

**Zone:** `desktop/cradle/kernel/src/nara_*.rs` (and new `nara_journey.rs`, `nara_lived_context.rs`, `nara_elemental.rs`) with their
dispatch, `inhabitants/sdk/kernelOps.ts` (allowlist lines only), `desktop/cradle/src/nara/**`, `inhabitants/ql/devices/**`,
`inhabitants/quaternalLogicFamilyManifest.ts`, `projections/atlas/AtlasProjectionPanel.tsx` (the practice binding only — carved out of
W3's zone) and `projections/atlas/src/practice/**` host use; QL `ql-mef/src/nara/domain/context.rs` (the reading op).

**Done when:** on the native candidate, with a practice world on a track: a journal entry asked with Answer this gets Nara's answer
naming its passages; a dream entry amplified lays Source entries with their sources; a one-minute sitting rings the torus bell, ends,
and keeps its length as a page; a journey opened with a Tarot deck draws with consent, carries into tomorrow's set at the close and does
not deal again on reopening; your Being page opens your natal sky from your saved identity.

**Carried to QL, not this run:** the coordinate checker does not enforce the converse rule, so nine refs with a dot after a non-4 pass
(M4.3-2.0–2.2, already in QL's defect record `ProjectCentral/now/agents/bimba-map-defect-m4320-m4321-m4322-2026-10-12.json`, and
M4.5.0–5.5, which QL's disposition treats as office addresses, `integration.rs:19-27`); the registry's `#4` names both Nara and the
map's "Context" node. The map is the authority; the run does not adjudicate it.

## 7. The designs this run hosts

The documentation lane adds to the catalogue on `dlw/build` (read-only for builders): `clips/central.tsx` gains the Launch panel
(Opens as, Opens in, Seats), a Flow's World tie and Container, and drops Day from the page kinds; `panels/atlas-earth__globe-engine.tsx`
gains the Body, Landmass, Climate, Sky and Locations groups of manual §17.2; `panels/quaternal-logic__sitting.tsx` is new (§24.3). Each
lands before the lane that binds it opens, and each header names its owner paths as the existing designs do.

## 8. U0 — the readiness walk (the owner's testing starts after it)

On the native candidate built at HEAD, the owner's real ground, computer-use, one pass in this order (each step names its section):

1. Open the DLW: Central opens on today's set (§18.1); the pool shows workspaces only (§16.7).
2. Bring a project's world onto a track; launch its workspace from the pool and see its layout come back.
3. Open the World: your planet and the project's body in your system; reroll your planet; the locations stay (§17.2).
4. Make a Being in the project's world; launch it as Reading, then as Walk (§18.1).
5. Open a Flow with an agent; it plays and shows in NOWs; write a reply; the Flow's world is the project's.
6. Practise: in the practice world, write a journal entry and ask Nara; open a journey and draw; sit for one minute (§24).
7. Turn the Day to face 5 and run the close: what still plays carries to tomorrow's set; the Arrangement keeps today (§18.2).
8. In Live, the pool's switch shows the set's grooves.

Every step that fails is fixed in the run, not listed. When all eight pass, the run stops and the owner tests.


## Appendix A — the M4 tree and what serves it (18 Oct)

From QL's map-derived registry `c/registry/m-tree-source-v1.json` (lines 14533–14638; the registry spells `M` as `#`) and the content
fixture `fixtures/kernel/bimba-content-v1.json`; the Bimba map host was unreachable. 106 rows. The legacy thin records M4-0…M4-5
(14534–14539) are provenance only: after a 4 the separator is `.` (QL `AGENTS.md`). "—" means no running code serves the node
(searched in `desktop/cradle/src`, `desktop/cradle/kernel/src`, the Expressions frame and the shell).

| Coordinate | Name | Served by today |
|---|---|---|
| M4 | Nara: oracle interface between personal and universal | Expressions Nara instrument (`naraInstrument.tsx:278-299`); kernel Nara ops (`kernel/src/lib.rs:360-424`); `PersonalSurface` (`contributions/core/descriptor.tsx:9,20`); `NaraSurface` mounted only by fixtures |
| M4.0 | Mahamaya identity matrix | `nara_identity` (open, list, select, calculate; `central.self.source.create` at `nara_identity.rs:479`); `IdentityMatrix.tsx`, `IdentityComposition.tsx`; QL `nara/domain/identity.rs:48,90` |
| M4.0-0…-5 | Birthdate encoding · Astrological chart · Jungian assessment · Gene Keys · Human Design · Archetypal quintessence | the identity's six slots; QL `identity_encoding.rs` (-0), `identity_composition.rs` (-5, a suggested draft); shell: none (`qlSky.ts:223`) |
| M4.1 | Sympathetic medicine (the embodied field) | QL `domain/embodied.rs:158,181,210`; `nara.elemental-map` (`epi_agent.rs:693`, no O-I caller); voice gate (`nara_voice.rs:274-278`); Expressions `naraPersonalBody.ts`, `centreStanding.ts`, `naraEvidenceField.ts`; shell Chakra `waiting` |
| M4.1-0…-5 | Elemental ground · Energy-body architecture · Materia & reagents · Operations & technē · Temporal astrological intelligence · Integration, safety & feedback | -0 identity evidence only; -1 the centres field; -2, -3 —; -4 `nativeCurrent.ts:5-7`, `NaraCurrentSky.tsx` (the shell's Sky is impersonal transit); -5 QL `EmbodiedSafetyState` only |
| M4.2 | Divinatory frameworks | QL `nara/domain/oracle.rs`, `oracle_journey.rs` (`OpenJourney::open` `:924`), `epi_agent.rs:1315-1344`; no O-I caller; shell Deck design `waiting` |
| M4.2-0…-5 | Common substrate · Tarot engines · I-Ching integration · Casting & randomness · Interpretation · Divinatory hygiene & pedagogy | -1, -2 standalone sibling pages only (`Work/Quaternal-Tarot`, `Work/Quaternal-I-Ching`); -3 `OracleEntropyReceipt` in QL; -0, -4, -5 — |
| M4.3 | Mediating transformation | QL `domain/transformation.rs` (`TransformationPhase:21`, `TransformationHistory:71`); no epi-agent op |
| M4.3-0…-5 | Cycle engine · Operational grammar (alchemy) · Dialogical & inquiry containers · Control/chaos & safety · Protocol library · Telemetry & phase history | — (the M3 clock's advance is not M4.3-0) |
| M4.3-2.0, .1, .2 | Bohmian dialogue · Native talking circle · Diamond Approach inquiry | — (QL defect record: dot after a non-4) |
| M4.4 | Context & lenses | QL `domain/context.rs:13,37,104`, no op; `CoordinateAtlas.tsx` via `nara_coordinate` is source disclosure, not a reading; atlas lenses quote corpus, unbound to M4.4 |
| M4.4.0, .1, .2 | Gebser · Ontological · Epistemological lenses | — |
| M4.4.3 | Jungian depth psychology lens, with -0 Archetypal foundation (Jung–Freud, collective unconscious, psychoid numbers, archetypes-as-such, instincts, personal synthesis), -1 Typology (introversion, the four functions, extraversion), -2 Psychodynamics & synchronicity (libido, opposites, compensation, shadow, complexes, synchronicity), -3 Alchemical transformation (prima materia, nigredo, albedo, citrinitas, rubedo, transcendent function), -4 Self-expression (-4.0…-4.5: self as context, centre, totality; mandala; circumambulation; self as actual unity), -5 Transcendent integration (unus mundus, gnostic theology, Answer to Job, mysterium coniunctionis, Eastern convergence, gnosis) | corpus quotes only in atlas lenses; no binding |
| M4.4.4 | Phenomenological lens | — |
| M4.4.4.0, .1 | Pre-categorical · Primordial differentiation | — |
| M4.4.4.2 | Temporal sedimentation | QL `lived_context.rs:32-40`, `epi_agent.rs:1352`; no O-I caller |
| M4.4.4.3 | Symbolic body | `MaterialKind::Dream` only |
| M4.4.4.4 | Personal Pratibimba — the personal locus | QL `nara/current.rs`, `multi.rs`, `agent_world.rs`; kernel `nara_current.rs`, `nara_current_store.rs:237-250`, `m3_reception.rs:339`; shell M3 clock (`qlM3Clock.ts:43-47,69`), `ConversationNaraFace.tsx:81` |
| M4.4.4.5 | Pratyabhijñā | — |
| M4.4.5 | Trika / Kashmir Śaivism lens | — (Bimba collection data only) |
| M4.5 | Epii integration | QL `domain/integration.rs:9,33,102`, `logos_return` (`epi_agent.rs:899`, no O-I caller); kernel `nara_epii.rs`; `EpiiReview.tsx`; returns to Flow or Day `nativeReturn.ts:179-269` |
| M4.5-0…-5 | Curriculum map · Core Epi-Logos voice · Method transparency lab · Integration lab · Pedagogy lab · Logos cycle engine | — (-5 only through QL `logos_return`) |
| M4.5.0…M4.5.5 | the six offices' functional addresses (`integration.rs:19-27`) | QL types only |

Outside the 106: M4′ (Nara prime, owned by M5-3) and the map's `#4` "Context" node.

## State of record (moved from PATH sec 7, 22 Oct 2026)

Moved verbatim from the retired `PATH.md` (history: PATH.md at `41557a9ed`). Hashes, run labels (r1, r23 ...) and cross-references inside are as PATH wrote them; "PATH sec N" and "FOUNDATION sec N" in this text name the retired files, whose content is now in `MAP.md` (State of the streams, The foundation's route), `EXECUTE.md` and the tickets.

### Rows (PATH sec 7 table): W1, W2, W3a, W3b, W3, W4a, W4b

| Ticket | Who | Zone | Since |
|---|---|---|---|
| W1 — the pool (T-WORLDS §3) | **code landed** `12be22596` (the pool holds your workspaces only: Launch, Keep, the columns, Opens in, the footer, a dropped tab makes one, the named sets became workspaces; the device pools and the aperture slot are gone; Whole stands only as the band; the encounter bar above the panes; ⌥⌘6 the pool), `7545677a3` (the book's native owner: one file in the candidate's data home, a revision per write, 32 copies kept), and Live's Grooves face behind the pool's switch on the set's own Groove Pool (in the W2 batch). Owes: its screen pass (r11) | lead | 18 Oct |
| W2 — Central: the Day as the set, worlds as tracks, pages as clips (T-WORLDS §4) | **code landed** `9ac21bd68` (the kernel's `page` op), `6dc2f43a4` (worlds as tracks, pages as clips, the set kept in the Day's `meta.set`, Launch and Stop in the page's NOW clearing, Open today making today's Day), `08b8cd988` (Beings and Things in panes of their own, drawn from their island, their links opening in the shell; the four highlight colours as the page's tokens; the person's own presses carrying their authority), `5b2844248` (Close now through Central; what still plays carries into tomorrow's set, a carried page saying since when and when to look again), `023a99756` (drops reach the page in the native candidate; New… makes the page and opens its pane, New Day is Open today; the worlds wait for Central's first browse). `f81c921da` (a page's pane draws it by the current template from its island), `648fb34d1` (a launched page opens where its Launch panel says), `0ca6f5890`/`f98c5681c` (your Beings and Things join the Earth once it stands, behind the Sun), `809816197` (worlds wear their bodies' colours). **Seen** (r13, r14): Open today ensuring 19 Oct and making its Day under the person's authority; the grid's first column clear of the pane's edge band; O-I dropped onto today's set and kept in the Day; New… making a Being and opening it in its pane; a title written from Clip view reaching the page owner. `7457334b3`, `c06c2c245`, `f7079bad9` (a launched page opens from the grid; a Flow in a world's own ground opens as its Flow; Launch as Reading; the grid's stable snapshot). **Seen** (r15–r17): the page drawn from its island after a title write; a practice Journal opening as its Flow; a page launched from the grid playing in Central's NOW and opening in the focused pane, stopped by its world; the grid in its worlds' colours. `46b2ef84f` (a page's pane begins after the pane's edge band), `e26c2d445` (a world leaves today's set: select its track, Delete or ×), `f865ff483` (a selected head takes its own Delete; Backspace is never Back), `c8af7bbd2` (a world comes into today by double-click or Enter on its row), and r22's fix (a refresh reads after the read in flight, so the grid takes a Day written while it was being read). **Seen** (r18, r21, r22): the tab rail opening over a document page; O-I taken out of today's set by × and by Delete, the shell staying in Central; O-I brought back by double-click and by Enter. Open: Launch as Reading on screen; Walk and Sky from the Launch panel; Close now on screen; the routine around the close (summary, knowledge, face 5 to face 0); ql-flow.html's four colours; the grid redrawn at once after a removal (r23) | lead | 19 Oct |
| W3a — your world's body (T-WORLDS §5) | **code landed** `9ac21bd68` (world_body_read; the generator from the World design's own noise; a location at sea drawn on the shore; a presence's look keyed by its subject; the Body rows writing one BodySet per gesture) and AIKit EpiLogos/ai-kit#522 (`aikit.world-body/v1` on the root space through BodySet). #522 landed as `b79822cd9` and installed (AIKit 2d93f171, 19 Oct). **Seen** (r18): your planet's body read from its owner (none yet, on the root space) and drawn seeded from its ref; the World device's Body rows. Open: a Body row's write (Reroll, a slider) seen landing on the root space. The world ecology ("what grows") is withdrawn by the owner, 18 Oct. **Reading of 20 Oct:** "seen" here is the plumbing (the record read, the rows written); the picture was never compared with the Earth's, and it falls far short of it: reopened as T-PROCEDURAL-BODY | lead, Opus builder | 19 Oct |
| W3b — your system; landings (T-WORLDS §5) | **code landed** `6e2727431` (today's worlds as bodies in the System scale, each built from its register's record or seeded and saying so, coloured by its body; the pages that play and the agent sessions on the inner ring, the file open and the works to hand on the outer, each keyed to its subject; the five scales Field · System · Body · Region · Place; a world lands on your planet as one BodySet; places stand on your own body through PlaceSet; phase A's open ends: the Bodies rows, the declared rows, clouds as their own layer, the plate reading the body store, the generator in a worker) and AIKit EpiLogos/ai-kit#527 (a place names the body it stands on; stacked on #522). #522 landed as `b79822cd9` and #527 as `2d93f1715` (19 Oct). `a70894862`, `8a8dbb4bd`, `f865ff483`, `c8af7bbd2` (your system read wherever the Earth stands and drawn on the globe's own disc while no sky layer stands; the plate's Worlds section; a landing clicked in the sky lens, said where it was pressed, read back by value; a landing taken off as it went on). **Seen** (r19 to r22): Bodies listing your planet and O-I, O-I from its own record; your system drawn in the sky lens, what you hold on its rings and O-I as a body of its own; O-I landed on your planet, moved and taken off through its own register (revisions 4, 5, 6). Open: Earth's places drawn over your body; the Body scale north-up; the System scale's recent scenes; the Field scale (no owner opens a shared field). **Reading of 20 Oct:** the rings carried pages, the open file and works to hand; the owner's rule is agents at work and the recent artefacts they made, nothing else: reopened as T-PROCEDURAL-BODY | lead, Opus builder | 19 Oct |
| W3 — the Earth where you look (r23's note: Technē's centre pane said the atlas was open elsewhere, and its holder was a concealed pane of another mode) | **code landed** `7d16a539e` (the atlas claim follows the panes' concealment notices: a held pane shown while the holder is concealed takes the Earth — the holder tears its atlas down through its own teardown, handing the claim to the pane on screen, and waits as a held pane; a holder on screen keeps it; of two on screen, the one that opened it first; when the claim frees, a held pane on screen before a concealed one. The Earth pane kind now adopts a handover, which it never did: a handed atlas there could not be shown, paused or closed with its pane). Red first on `tests/atlas-handover.test.mjs`; test-all and tsc green. **Seen** (r27): the Earth opened in Technē, then in Central's pane while Technē's was hidden — Central's drew it — and Technē's again on return | lead, Opus builder | 19 Oct |
| W4a — Nara's practice, the owner side (T-WORLDS §6) | **code landed** `fb32cce04` (nara_journey, nara_lived_context, nara_elemental; the branch per turn; containers and entry kinds; journeys saved through the page op; the Deck and the Chakra reading). W4b landed (row below) | Opus builder | 19 Oct |
| W4b — Nara's practice, the face side (T-WORLDS §6) | **code landed** `e766c6baf` (the practice world is the personal register; dreams are your dream journal's entries, Amplify laying Source entries; the Sitting rung through the torus's own strike, timed by the transport, kept as a page; a Being's identity read through nara_identity and Launch as Sky giving the Sky its natal ring; Answer this from Clip view; the composer's entry kinds and the Circle's holder; a journey's Launch opening its Deck once), `9d3cd9051` (Your practice under New…), `809816197` (the practice track: Practice, fogged, Activator off). Open: Answer this keeps the answer on the person's press (Arm's proposals not modelled); Amplify from your pages and knowledge; Launch as Reading for a journey; today's centres for the Sitting; the Astrology lens still on AE's natal engine | lead, Opus builder | 19 Oct |
