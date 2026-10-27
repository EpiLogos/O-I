# DLW foundation audit: shell, state and grammar

Audited 14 Oct 2026 in `worktrees/env-1/o-i`, branch `dlw/build` at `dd7352390`. The running candidate in the screenshots is `ce3ff15f1`. The audit was read-only.

The standard it measures against is the owner's manual (`DLW.md` §3, §4, §5–9 and §10), then the mockups and the lock.

Path prefixes used throughout:
- `ui/` = `packages/live-shell/ui/src/`
- `cradle/` = `desktop/cradle/src/`
- `docs/` = `desktop/cradle/docs/world-shell/`

"Reached" means imported from `ui/main.tsx`, checked with `scripts/candidate-reachable.mjs`. It does not mean the thing is drawn on screen.

---

## A. Verdict

### The foundation is a mode switch, not a grammar

`ui/App.tsx` is a 650-line switchboard. It picks one of several parallel implementations per mode for each of the five parts of the window:

| Part | Implementations | Evidence |
|---|---|---|
| Transport | 2 bars, holding 4 bodies | `App.tsx:481-490` |
| Browser | 4 | `App.tsx:491-501` |
| Centre | 1 residence that swaps panels | `App.tsx:539-551` |
| Widget rail (dock) | 2 | `App.tsx:556-557` |
| Detail | 6 residences | `App.tsx:569-578` |
| Status bar | 2 | `App.tsx:579` |

Session view has four bodies:
1. the Live `.als` grid;
2. the native Expressions objects × scenes grid;
3. the World cut (`worldTimelinePresentation.tsx`), shared by Central and Technē;
4. Factory's `AgentSessionGrid`.

Arrangement has four as well. The device side has five rendering systems, and the widget rail has two. None of the shared structures the manual names exists once and is used by all five modes:
- one track/clip/stop material model;
- one Session grid and one Arrangement ruler;
- one Clip|Device detail;
- one device in three sizes;
- one transport;
- one rail.

### What is sound, and should be kept as the base

**The cradle pane engine.**
- Files: `cradle/surface/engine.ts`, `Workbench.tsx`, `types.ts`.
- It supports tab groups, splits, pin, closed stack, detach and redock, and projection pane kinds.
- It has a mount/unmount module contract (`cradle/surface/projectionModules.ts:117-170`).
- Pane follow/pin is modelled (`types.ts:121`, `projection.subject_ref`).
- It dates from Sept 2026 and the DLW run barely touched it.

**The workspace book.**
- File: `cradle/workspace/store.ts`.
- It keeps one pane tree per mode (`modeLayouts`, `store.ts:42`; `switchWorkspaceMode` at `:128`).
- `WorldContext` holds world, subject, reading and trail (`:62-68`).
- The encounter link (`ui/projections/encounterLink.ts`) makes the URL a projection of the book.

**The neutral material contract.**
- File: `ui/timeline/worldTrackAdapter.ts:119-132`.
- It carries columns, tracks, clips, takes, layers, sections and walks.
- `ui/timeline/expressionsTrackAdapter.ts` already projects Expressions as tracks with scenes as clips, which is lock §9 done right.

**The device declaration layer.**
- Files: `ui/inhabitants/sdk/define.ts` (`DeviceDeclaration` at `:138`, `SdkParamRow`, `TransportBinding` at `:188`), `semantics.ts` (rack, macro, invariants) and `familyManifest.ts:10` (`DevicePresentation = compact | expanded | full`).
- It also has validation gates.

**The mode grammar.**
- File: `ui/shell/modeGrammar.ts`.
- It holds the 28 transport slots with per-mode meanings, and they agree with the manual's §10.5 table.
- All 50 marks from the icon specimen are generated into `ui/inhabitants/sdk/icons.ts`.

**Two pieces that already work the way the manual wants:**
- The Expressions device trio: `NativeDeviceRack` (compact widgets the person adds, parameters live off-rack) plus `WorldBrowser`'s device pool (`is-device`, `WorldBrowser.tsx:206`).
- `LiveTorusWidget`: a mini torus with 4 macros (`ui/panels/devices/LiveTorusWidget.tsx:46-61`).

### What is parallel or degraded

**The pane engine is not the centre.**
- `docs/WORLD-SHELL-DESIGN.md:464-466` commits to promoting it "from 'one center panel among six' to the composer of the main area in every mode".
- It is the centre only in Factory (`App.tsx:125`, `323`).
- Everywhere else the centre is a `centerPanel` string choosing one hidden-retained resident (`App.tsx:551`). Nothing sits side by side, and there is no ⊞.

**Session and Arrangement are bound to Technē lenses, not to material.**
- Session = Journey (m3) and Arrangement = Timeline (m2) (`ui/shell/paneInstrument.ts:119-126`; `modeGrammar.ts:424-425`, `454-455`; commit `88a6f36c4`, "Technē's Session is the Journey").
- Central and Technē therefore show the same kernel-event grid with raw ids, under a Technē lens bar (screenshots 02 and 05).

**The device SDK has no renderer.**
- `ui/inhabitants/sdk/controls.tsx`, the kit's plate and controls, is **not reachable from the candidate**. Only `scaffold.ts` imports it.
- `InhabitantRack` draws every face of every admitted family as a text card with a note (`ui/inhabitants/inhabitantRack.tsx:209-264`). Its light reads "admitted … its registry owns the controls, this strip holds no live reading" (`:182`). It says so itself: "This rack does not replace NativeDeviceRack or the agent chain" (`:22`).
- That is why Central, Technē and Factory's instrument side show "CENTRAL 7 / QUATERNAL-LOGIC 7 / ATLAS-EARTH 4" catalogues instead of a chain.

**The Live chain is a registry dump.**
- `DeviceChainPanel` renders every `bottom`-slot panel, whatever the track (`ui/components/DeviceChainPanel.tsx:56,66`), and appends them again under the Clip view (`:67`).
- That is 37 registrations (15 in `panels/devices`, 12 in `devices-b2`, 10 in `devices-pro`), less 6 legacy generators (`ui/live/liveChain.ts:20`): 31 columns.
- With no set open, each column prints "no set open — open one from the browser". That is the crushed detail in screenshot 01.

**The transport is four bars that look alike.**
- `TransportBar` (Live), `ModeTransportBar` (Central, Technē, and Expressions without a native work), `NativeTransportBar` (Expressions with one) and `AgentShellTransport` (Factory, with its own copy of the icon set in `ui/agent/agentIcons.tsx:11-62`).
- Except in Factory, almost every slot is a disabled waiting state.
- Slots are rendered as text where the specimen draws an icon. The labels have different widths in each mode, so controls move.

**State is split across parallel stores.**
- `App.tsx` React state: centre, tab, selection, `centralSubject` (`:223`, `:344`).
- `AgentShellContext` (`ui/agent/AgentShellContext.tsx:84-101`, 18 useStates including transport toggles).
- The native editor's reading.
- The time spine.
- Live and Central share one book mode (`ui/continuity/workspace.tsx:31`), so they share one pane tree. Named sets do not exist.

### Is the foundation there?

The owner asked: "Did we sort out the proper pane system first, ensure the ports existed, properly build the state machine layers in?"

No. The pane engine and the state book exist, ported intact from the September cradle, but the candidate frame was built beside them as a per-mode switchboard. The ports (the docking contracts) exist as declarations: track adapters, the device SDK, projection modules and transport bindings. They have no single host that renders them.

---

## B. Per structure

| Structure | Exists | Reached | Modes using it | Main deviation |
|---|---|---|---|---|
| **Panes** (`cradle/surface/*`, `ui/native/Workbench.tsx`) | yes | yes | Factory only, as the centre. Elsewhere only when "Workbench" is chosen as the centre panel | Not the composer of the centre. No ⊞ menu: split right/down/tile exist (`Workbench.tsx:726-728`), but there is no Four ways, no drop on a pane edge to split (drop moves only into a group, `:436-443`), no drop from the browser into a pane, and no follow/pin control. The pin is `subject_ref` on the binding with no UI; tab "pinned" means "refuses close" (`types.ts`) |
| **Sets** (§10.2) | partly: per-mode trees in `modeLayouts` | yes | all modes, but Live and Central share `base` (`continuity/workspace.tsx:31`) | No named sets, no save or select from the browser. Frame state (`centerPanel`, tab, browser, detail, dock, `detailMode`) is restored per workspace, not per mode (`App.tsx:359-369`) |
| **Session view** | 4 bodies (`components/SessionView.tsx:31-33` + `agent/AgentSessionGrid.tsx`) | yes | each mode its own | No shared grid. Live clip and stop launch are disabled (`SessionView.tsx:43,56`). Expressions' grid is at the wrong level, objects × scenes (lock §9.5). Central and Technē get kernel event lanes (`timeline/dayTrackAdapter.ts:35-39`), not Day/Flows/Beings/Things/Goals. No clip state (waiting, running, stalled) outside Factory |
| **Arrangement view** | 4 bodies (`components/ArrangementView.tsx`, `nativeArrangementTimeline.tsx`, World cut, `agent/AgentArrangementView.tsx`) | yes | each mode its own | `ArrangementView` (Live) unchanged since 10-10. Technē's Arrangement is the "Timeline lens" |
| **Clip view** | 5 bodies (`DeviceChainPanel` clip mode, `NativeWorldDetail` clip, `central/CentralClipChooser`, `ModeDetail.TechneClipDetail`, `ModeDetail.FactoryTaskLogDetail`) | yes | each mode its own | No shared clip box, launch box or follow action anywhere. Live's clip editor is read-only and has the 31 effect panels appended (`DeviceChainPanel.tsx:67`). Status bar labels differ per mode (Document / Task log / Scene / Clip) instead of Clip\|Device |
| **Device view / chain** | 5 systems: (1) `panels/*` registry in `DeviceChainPanel`; (2) `NativeDeviceRack` + `NativeDeviceEditors` + `NativeField/EntityFace.*`; (3) `InhabitantRack`; (4) `NativeAgentDeviceRack` / `AgentDeviceChain`; (5) Live's `LiveTorusWidget`, `JankoDevice`, `NoteDeviceChain` | yes, except `sdk/controls.tsx` | each mode its own | Only (2) separates rack (compact) from pool (whole). (3) shows a family catalogue, not the selected material's chain. (1) is a catalogue. No macros render except the torus's 4. Racks with chain selectors render only in Factory's skillset. `DEVICE_FORMATS` gives per-mode device shapes (`sdk/modes.ts:307-320`: chain-plate, die, scene-strip, run-viewer, instrument-face, tool-tile), which contradicts "every device comes in three sizes" |
| **Pool** (§10.3) | 4 | yes | Expressions (device whole, correct), Factory (`AgentDevicePool`), Live (Ableton Groove Pool), Central and Technē (`world-context-pool` "reads" text, `ModeBrowser.tsx:116`) | Not "the selected device in full" outside Expressions and Factory |
| **Browser** | 4 (`components/BrowserPane.tsx`, `WorldBrowser.tsx`, `shell/ModeBrowser.tsx`, `agent/AgentShellBrowser.tsx`) | yes | one per mode family | The four kinds (material, instruments, devices, running) are absent: Central and Technē list material only. Central's Flows, Beings, Things, Goals and Wiki are `waiting` (`modeGrammar.ts:253-264`). Preview, open and add are not separated, and drag to a pane does not exist (only `NativePropertyBrowser` and `AgentShellBrowser` drag). "⌘F" is a placeholder label with no handler |
| **Transport + icons** | 4 bars | yes | Live: `TransportBar`. Central, Technē, Expressions without a work: `ModeTransportBar`. Expressions with a work: `NativeTransportBar`. Factory: `AgentShellTransport` | See below |
| **Widget rail** | 2 (`shell/ModeContextDock.tsx`, `agent/AgentContextDock.tsx`); registry host `components/RightDock.tsx` **not reachable** | partly | each mode its own tile set (`ModeContextDock.tsx:54-60`) | Manual §10.6 says a widget belongs to the whole world and stays across modes; here tiles are per mode, and Factory's terminal and files tiles do not exist in Central. Presets: "not wired here yet" (`ModeContextDock.tsx:159`). `right-dock` panel registrations (`panels/context.tsx`, `inspector.tsx`, `clock.tsx`) are never drawn |
| **Trail** (§10.7) | model yes (`cradle/workspace/store.ts:62-68`, `cradle/workspace/encounter.ts:58-88` with `returnTo`) | yes | URL/back only, through `encounterLink` | The Trail tile shows only the current Central browser subject (`ModeContextDock.tsx:200-205`). `WorldContext.trail` is never listed or returned to from the rail |
| **Keys** (§10.8) | Tab, ⌘⌥B, ⌘⌥L, ⌘, (`App.tsx:375-394`) | yes | Tab only in some centres (`:385-386`) | No Space, Esc, ⌘F, row number keys, macro letter keys or ⌥Enter at frame level |
| **State layers** | book (mode × `WorldContext` × epoch); time spine (`timeline/timeSpine.ts:95-172`, which has its own `TransportState`) | yes | see §C | Five selection stores (App `selection`, App `centralSubject`, `AgentShellContext.selectedTrackId`, the native editor selection, the spine occasion). Three transport states (spine `TransportState`, `AgentShellContext` toggles, native playback). Three meaning tables (`modeGrammar.ts`, `sdk/modes.ts` rows, `agent/agentFidelity.ts`) |

### Transport and icons in detail

The specimen (`docs/icon-cut-refined.html:219`, `362-404`) says: "Same slots, same drawings. The readout is what changes." It defines one mark per slot for every mode, plus a per-mode readout. The grammar's meanings match §10.5. The violations are in presentation and wiring.

**Text where the specimen draws a mark:**
- Link and Tap are text in `TransportBar.tsx:91` and `ModeTransportBar.tsx:162-163`, so you see "Ground sync", "Stamp Now", "Field sync", "Field carrier", "Back to Now".
- Quantize is text ("Save timing", "Scene quantize", "Arrival").
- Key-map and MIDI-map are text ("Map", "Map"); the specimen uses the `earth` and `map` marks.
- Key is "♯".
- Because label widths differ per mode, controls shift between modes.

**Moved controls:**
- `AgentShellTransport` puts loop inside the playback group and has no punch slots.
- It places detail and dock before the view and mode rail.
- `NativeTransportBar` has a different layout altogether: play, stop, "A", "↩", take, tools, overflow (`NativeTransportBar.tsx:166-226`).
- The `pane` chrome toggle from the specimen is not drawn anywhere.

**Wiring:**
- Live: every slot is disabled except root, scale and MIDI map (`TransportBar.tsx:50`).
- Central: every slot is disabled.
- Technē: only tap and the occasion stepper work.
- Factory: all slots are enabled, but follow and loop are local toggles with no effect, and `handBackLit` is never set true anywhere (`AgentShellContext.tsx:95`). These are lights that are not readings, which the manual forbids in §10.4.
- Duplicate icon source: `agent/agentIcons.tsx` holds its own copy of the 50 marks; `NativeTransportBar` uses the older `components/Icon.tsx`.

---

## C. Per mode: manual vs candidate

### Live (§9)

**Manual.** One instrument, the torus.
- Tracks are lanes of a set; clips carry notes and may carry their own mode; stops are rows.
- The chain runs: note devices (scale, tuning, sky) → torus → effects.
- Clip view is a piano roll that folds to the mode.
- The transport sets key, root and scale.

**Candidate.**
- **Centre:** an Ableton `.als` reader with read-only launch (`shell/useSet.ts`, `SessionView.tsx:33-58`). With no set open, `LiveSessionEmpty` shows five "Track n" columns. The torus is not on a track; it lives in the hosted frame and at the head of the chain, and only when the owner has published a reading (`DeviceChainPanel.tsx:66`).
- **Device side:** the torus chain (NoteDeviceChain, LiveTorusWidget, JankoDevice), then the 31 registry panels, then the selected track's `.als` device tiles.
- **Browser and pool:** `BrowserPane` has Presets, Instruments, Chain devices, Samples and Views. The pool is Ableton's Groove Pool, and a legacy generator (Wavetable port) sits in the browser.

**Parallel UI to remove or re-home:**
- Take the registry dump out of the chain.
- Move the three generations of Ableton device ports (`panels/devices`, `devices-pro`, `devices-b2`) out of the chain. Lock §0.2.1 says Live never exposes Ableton's catalogue.
- Lay the set and the torus's takes on tracks through a track adapter.

### Central (§5)

**Manual.**
- A code-editor centre: files on the left, documents side by side.
- Tracks are Day, Flows, Beings, Things and Goals. Clips are entries and documents. The stop is the die's face.
- The chain is the tools on the open document: Text, Highlight, Notes, Packet, Answer, plus the form device.

**Candidate.**
- **Centre:** `world.ground`, the World cut timeline, under the Technē lens bar (`App.tsx:322`, `paneInstrument.ts:151-161`). The lanes are "Central · day", "Machines · NOW", "Kernel · event log", runs and conversations from the kernel temporal read (`dayTrackAdapter.ts:35-39`; `projections/useWorldTemporalReading.ts:218`). Clips carry raw subject ids.
- **Browser:** only Days and Files are live.
- **Clip side:** `CentralClipChooser` (the document detail).
- **Device side:** `InhabitantRack` with all 7 Central family faces as text cards, plus the QL and atlas catalogues whenever a lens is focused (`ModeDetail.tsx:97`, `385`, `393`).
- **Transport:** fully disabled.
- **Documents:** they open in the detail area, or in the Workbench only through a source summons (`App.tsx:170-184`). They never sit side by side as the default.

**Parallel UI to remove or re-home:**
- The Technē lens bar and World cut as Central's centre.
- The family catalogue as the chain.
- Central needs its own track adapter for the five streams, and documents as panes.

### Factory (§6)

**Manual.**
- Tracks are agent sessions; clips are tasks; stops are batches.
- Arrangement shows threads with needles.
- The Clip view is the task log with tools along the task's time.
- The chain runs gateway → agent → skills → world → landing.
- The transport is the foreman's desk.

**Candidate.** Its content is closest to the spec: `AgentSessionGrid` with stop rows, `AgentArrangementView`, `AgentDeviceChain` and `NativeAgentDeviceRack` (skillset rack with macros), `AgentDevicePool`, and enabled transport controls. It is built as a whole second shell:
- its own transport and icon copy;
- its own browser and dock;
- its own state (`AgentShellContext`);
- its own Session and Arrangement, which never touch the shared views.

The `agent/` views have not changed since 10-10; the run added `factoryCentre.ts` and `factoryQueueAdvance.ts` beside them.

The centre is the Workbench tree, the only mode on the pane engine. The lens bar always stands over it (`paneInstrument.ts:154`). Focusing the Earth tab swaps the Device side to the QL and atlas catalogue (screenshot 03), and that tab reads "Earth could not mount".

**Re-home:**
- `agent/agentRunModel.ts` becomes the Factory track adapter for the shared views.
- The agent chain devices move to the SDK.
- The transport behaviours become bindings: harness resume/stop, voice, steer, write arm.
- The dock tiles become widgets.

### Expressions (§7)

**Manual.**
- Each Expression is a track and its scenes are clips; stops are moments across Expressions; every track and clip has a visual and an audio side.
- The Clip view is the sequence roll with its sound beneath.
- The Device side is the studio, with field devices at three sizes.

**Candidate.**
- **Centre:** the hosted frame (`world.expressions`). The shell draws a 16-control text toolbar inside the pane (`components/NativeStageTools.tsx:37-82`): 2D/3D, Grid/Snap/Guides, Capture PNG, Record video, Present, Capture options, Export, Import. The frame draws its own scene bar under it. Both clutter the pane and duplicate the transport's Capture and Record slots. The Capture-options popover is the `<details>` at `:59`.
- **Session (`native.session`):** objects × scenes (`SessionView.tsx:62-120`, object columns at `:106`), the level lock §9.5 rules wrong. The correct adapter, `expressionsTrackAdapter` (commit `3a30f7135`), is registered (`registerWorldTrackAdapters.ts:45`) but never projected; only day, run and conversation lanes are read (`useWorldTemporalReading.ts:218`).
- **Detail:** `NativeWorldDetail`, with the Object selector, Chosen controls and `NativeDeviceRack`. This is the one real three-tier device model.
- **Transport:** `NativeTransportBar` when a work is open (a different layout); otherwise the disabled `ModeTransportBar`.
- **Opening works:** featured works cannot open, because the native `save_as` owner op is missing (screenshot 04).

**Re-home:**
- Feed the shared Session from `expressionsTrackAdapter`.
- Move `NativeStageTools` into the stage device (pool or full) and the transport slots.
- Fold `NativeTransportBar` into bindings.
- Generalise the `NativeDeviceRack` pattern as the SDK chain.

### Technē (§8)

**Manual.**
- Tracks are readings, threads and occurrences; clips are events; stops are walk stops.
- Session and Arrangement are views.
- World/graph, canvas, timeline, journey and palace are instruments opened in panes.
- The transport walks.

**Candidate.**
- **Centre:** the same World cut as Central. Session is "Journey" rows over the event grid; Arrangement is "Timeline".
- **Lens bar:** it mixes the two views with the instruments. The Timeline and Journey lenses press the same switch as the Session and Arrangement buttons (`ModeDetail.tsx:417-424`).
- **Places:** the atlas fails to mount (screenshot 06).
- **Device side:** QL (7) and atlas (4) family cards.
- **Clip side:** `TechneClipDetail`.
- **Browser:** Sources is empty ("No works disclosed").
- **Transport:** only tap ("Back to Now") and the occasion stepper work.

**Re-home:**
- Turn the lenses into instrument pane kinds opened from the browser.
- Give Session and Arrangement Technē's own material through its adapter.

---

## D. The bounded foundation: what the orchestrator should build first

The work below is in dependency order. Each item names what to change, where, and what will show on screen when it is done.

### D1. One state model, with sets and selection

**Work.**
- Give Live its own book mode (`cradle/workspace/mode.ts:23-24`, `ui/continuity/workspace.tsx:31`).
- Move `App.tsx` frame state into the active mode's layout. That state is `centerPanel`, `tab`, `selection`, browser, detail, dock, `detailMode` and the browser category. `layout.applicationView` already lives per layout, so restore it on mode switch, not only on workspace switch.
- Make the selection one value in `WorldContext` (subject + reading + clip) and retire the parallel stores: App `centralSubject` and `selection`, and `AgentShellContext.selectedTrackId` and its transport toggles.
- Add named sets: snapshot or restore the mode's `LayoutState` plus the frame fields into the book, listed in the browser under "Sets".
- Done when:
  - Live → Central → Live restores each mode's own panes, detail side and browser category.
  - "Save set" adds a browser row that restores the arrangement.
  - Selecting a Day, a Session clip or a Factory task moves the same selection, and the Trail widget lists it.

### D2. The pane engine as the centre in every mode

**Work.**
- Replace the `centerPanel` residence switch (`App.tsx:539-551`) with `NativeWorkbench` in all five modes.
- Register the instruments as pane kinds through `ProjectionModuleRegistration` (`cradle/surface/projectionModules.ts:150-170`): Session, Arrangement, hosted Expressions stage, Graph (knowledge), Earth, Timeline, Journey, Canvas, Palace.
- Turn `PROJECTION_PANE_KINDS` (`cradle/surface/types.ts:36`) into an open registry of instrument *types*. Allow several builds per type that answer to one control set (§10.2), which replaces "one module per kind" (`projectionModules.ts:157`).
- Add the ⊞ menu (Beside, Below, Four ways), drop on a pane edge to split, drop from the browser into a pane, and a follow/pin toggle per pane that writes `projection.subject_ref`.
- Done when, in every mode:
  - ⊞ splits the pane.
  - Dragging Graph from the browser beside the Session opens it there.
  - A pinned pane keeps its subject while the selection moves.
  - The Technē lens bar is gone, and its instruments sit in the browser's Instruments group.

### D3. One Session and one Arrangement over one material contract

**Work.** Extend `WorldTrackSet` (`ui/timeline/worldTrackAdapter.ts:119`):
- clip `state` (waiting, running, stopped, recording, stalled);
- `launch` (quantize, follow action);
- stop rows (rename columns to stops where they are rows);
- takes per clip;
- per-track lanes (visual and audio);
- an `actions` port (launch, stop, select, record) that names owner ops.

Then:
- Build one `SessionGrid` (tracks across, stops down, a clip state on every cell, stop launchers) and one `ArrangementRuler` (the same set on one ruler, with needles), both as pane kinds.
- Write one adapter per mode:
  - Live: the `.als` summary plus torus takes;
  - Central: Day, Flows, Beings, Things, Goals;
  - Factory: from `agent/agentRunModel.ts`;
  - Expressions: `expressionsTrackAdapter`, which already exists;
  - Technē: readings, occurrences and walks.
- Remove the Session=Journey and Arrangement=Timeline coupling (`paneInstrument.ts:119-126`, `modeGrammar.ts:424-425`, `454-455`).
- Done when:
  - Tab toggles between grid and ruler over the same tracks in all five modes.
  - Central shows its five named tracks.
  - Factory's grid is the same component as Live's, and a stalled task is striped.

### D4. One detail host

**Work.**
- Replace the six detail residences (`App.tsx:569-578`) with one host keyed by the selected clip or track.
- **Clip side:** a clip-editor registration per clip kind, extending `PanelRegistration` (`ui/shell/panels.ts:36`) with a clip kind it accepts. Mount the existing editors:
  - Live note editor;
  - `SceneSequenceEditor` and `GlyphSequenceEditor`;
  - `FactoryTaskLogDetail`;
  - `TechneClipDetail`;
  - the Central document.
- Every clip side shares one clip box and one launch box (name, colour, launch quantize, follow action, in/out/loop, takes).
- **Device side:** one chain that renders the selected track's device instances from a chain model, not from a registry.
- Status bar labels become Clip | Device in every mode, with the per-mode meaning in the tooltip.
- Done when:
  - Selecting a clip shows its editor in every mode.
  - Device shows only what is on that track's chain.
  - Live's 31-column dump is gone.

### D5. The device runtime: three sizes from one declaration

**Work.**
- Make `sdk/controls.tsx` the renderer and make it reachable.
- From `DeviceDeclaration` + `SdkParamRow`, render three sizes:
  - **compact:** title, light, a picture slot and at most 4 rows. The 4 are the declared macros, or the first 4 marked `compact`.
  - **whole:** every row, grouped, in the browser pool.
  - **full:** a pane, by detaching to the Workbench.
- Rename `DevicePresentation` `expanded` to `whole` (`familyManifest.ts:10`).
- Collapse `DEVICE_FORMATS` (`sdk/modes.ts:307`) into these three.
- Light = a reading of an `enabled` row, dark when unknown.
- Hand-back = a `heldBy` field on each row's reading (agent, sky or instrument). It feeds the Re-enable slot.
- Rack = chains plus a selector, as `semantics.ts` already declares.
- Port the Expressions `NativeDeviceRack` behaviour (added-to-rack vs live-in-pool) into the generic rack.
- Done when the Central day die, a QL instrument face, a Factory skillset rack, an Expressions field device and the Live torus all render through the same three components, with no text-only cards.

### D6. One browser

**Work.**
- One component. Categories come from `ModeBrowserCategory` (`modeGrammar.ts:85`) plus manifest entries, extended with `kind: material | instrument | device | running`.
- The pool underneath shows the selected device whole (D5).
- Select = preview. Double-click or drag to a pane = open. Drag to a chain = add. Drag an agent to an empty track = seat.
- It replaces `BrowserPane`, `WorldBrowser`, `ModeBrowser` and `AgentShellBrowser`, re-homing their row sources.
- Done when every mode shows four kind groups, the pool shows the selected device whole, and drag-to-chain adds it.

### D7. One transport

**Work.**
- One bar renders the 28 slots in fixed order, each with the mark from `sdk/modes.ts:275` (`TRANSPORT_SLOTS`).
- Per-mode text appears only in readouts, as the specimen draws them.
- A slot is enabled only when a `TransportBinding` (`define.ts:188`) with a write path exists.
- Its state is one per-mode transport store, extended from `TimeSpine.TransportState` (`timeline/timeSpine.ts:95`).
- Fold `AgentShellTransport`'s working controls in as Factory bindings: harness resume/stop (`agent/harnessAgentControl.ts`), voice, steer, write arm (`shell.setWriteArm`).
- Fold `NativeTransportBar`'s in as Expressions bindings: scene play/stop, studio arm, takes.
- Delete `agent/agentIcons.tsx`.
- Done when:
  - Switching modes moves no control.
  - The marks are identical in every mode.
  - Factory Run/Stop and Expressions play/stop/arm still work.
  - No light is lit without a reading.

### D8. One widget rail

**Work.**
- Revive `components/RightDock.tsx` over `getPanels('right-dock')` as the rail, with one global open set (not per mode), pin/follow per widget, and presets saved in the book.
- Register the existing tiles as widgets:
  - from `AgentContextDock`: Sessions, Terminal, Files, Web, Graph, Diff, Frames, Ledger, Approvals, Agents;
  - from `ModeContextDock`: Agent, Packet, Trail, Field, NOWs, Sky.
- Done when a terminal opened in Factory is still open in Central, and the Trail lists and returns to `WorldContext.trail` (`cradle/workspace/encounter.ts:85`).

### D9. Keys

**Work.** One key map over the transport slots and the `SessionGrid`: Space, Esc, ⌘F, the row number keys, the macro letter keys, Enter and ⌥Enter, all suppressed while typing.

Done when §10.8 works in every mode.

### Docking contracts for subagent-built modules

These extend existing types. Each module ships one registration and touches no shell file.

| Module kind | Contract to extend | It must supply |
|---|---|---|
| **Material (tracks, clips, stops)** | `WorldTrackAdapter<T>` and `WorldTrackSet` (`ui/timeline/worldTrackAdapter.ts:119-132`), registered in `registerWorldTrackAdapters.ts` and declared in the family manifest's `projections` | `project(reading)`, giving tracks (with lanes), stops, clips (with state, span, standing, takes), plus `actions` naming the owner ops for launch, stop, select and record |
| **Instrument (pane)** | `ProjectionModuleRegistration` (`cradle/surface/projectionModules.ts:150`), with an open instrument-type id and a build id | `create({element, encounter, binding})` returning `unmount` and `setVisible`. It reads selection only through `EncounterBridge` and writes only via `transition`. Its controls are declared as a `DeviceDeclaration` (`heldBy` = the instrument), so they appear in the chain, never as chrome inside the pane |
| **Device** | `DeviceDeclaration` + `SdkParamRow` (`ui/inhabitants/sdk/define.ts:138`, `:61`), admitted via `admitFamily` / `declareDeviceExtension`; aperture `DeviceFaceAperture` (`sdk/controls.tsx`) | rows (with a write path or as a reading), up to 4 compact or macro rows, an optional picture component, an enable reading, `liveSemantic` and invariant (`semantics.ts`). No custom layout for the whole size: the runtime groups the rows |
| **Clip editor** | `PanelRegistration` (`ui/shell/panels.ts:36`), with a new slot `clip` plus the clip kinds it accepts | an editor body over the selected clip's reading. Clip box and launch box are shell-owned |
| **Transport binding** | `TransportBinding` (`define.ts:188`) + `modeGrammar.ts` `SlotMeaning` | slot id, mode, the face/key it drives, and a readout. The shell draws the control |
| **Browser entry** | manifest browser entries (`allInhabitantBrowserEntries`, `ui/inhabitants/manifest.ts`) + `ModeBrowserCategory` with the new `kind` | rows: material, instrument types, device declarations, or running things |
| **Widget** | `PanelRegistration` with slot `right-dock` | a body. Pin/follow and presets are shell-owned |

---

## E. What to delete or freeze

Each item keeps the working behaviour and names its replacement.

1. **The registry dump in the Live chain** (`DeviceChainPanel.tsx:66-67`, `live/liveChain.ts:20`).
   - Remove it now. The chain becomes the torus chain plus the track's own devices.
   - Freeze `panels/devices-pro` and `panels/devices-b2` as the corpus reference; they are unchanged since 10-11.
   - Keep `panels/devices/DevicePanel`'s stored-parameter editing of `.als` devices (M3). It becomes the *whole* view of a selected set device in the pool (D5/D6).
2. **The Technē lens bar** (`ModeDetail.tsx:406-498`, `App.tsx:511-529`).
   - Replace it with D2 instrument panes plus the browser's Instruments group.
   - Keep `driveHostedLens` as the hosted stage's lens binding.
3. **Session=Journey / Arrangement=Timeline** (`paneInstrument.ts:119-126`, `modeGrammar.ts` Technē rows, `88a6f36c4`).
   - Replace with D3.
   - `JourneyRows` and `WorldTimelinePresentation` become the bodies of the Journey and Timeline instrument panes, not of the views.
4. **`InhabitantRack` as the chain** (`ModeDetail.tsx` `BaseDevicesDetail`, `TechneInstrumentsDetail`, `InstrumentDeviceDetail`).
   - Its family listing moves to the browser's Devices group.
   - Its face bodies (Day die, Flow, Nara, QL instrument, atlas and knowledge faces, pop-out) become device bodies rendered by D5. Keep them all.
5. **The four transports** become D7.
   - Do not remove `AgentShellTransport` or `NativeTransportBar` until their bindings land, because they are the only working transport controls.
   - Delete `agent/agentIcons.tsx` once they are folded.
6. **The two docks** (`ModeContextDock`, `AgentContextDock`) become D8. Every tile body is kept as a widget.
7. **The four browsers** become D6. Their row sources are kept: day records and files listing; the native works list; agency rows; the Expressions material, property and device browsers.
8. **The Factory second shell** (`AgentShellContext` transport toggles, `AgentSessionGrid`, `AgentArrangementView`).
   - Freeze them as the reference for D3/D7, since they are the most complete Session and Arrangement semantics.
   - Retire them only when the shared grid and ruler show Factory's adapter with stall striping and needles.
9. **`NativeStageTools` inside the Expressions pane.**
   - Move its view controls (2D/3D, grid, snap, guides, fit) into the stage device (whole/full).
   - Capture and Record go to the transport slots; Export and Import go to the Expressions browser and context menu.
   - Keep every command (`stageCommands.ts`).
10. **The triple meaning tables.**
    - Keep `modeGrammar.ts` for meanings and `sdk/icons.ts` / `sdk/modes.ts` `TRANSPORT_SLOTS` for marks.
    - Derive `agentFidelity.ts` transport tips from `modeGrammar`.
11. **Do not delete** `desktop/cradle/src/CradleFrame.tsx` or the legacy cradle. The candidate cannot reach them, but the installed desktop app still runs the legacy cradle.

---

## History: how the run built

From `git log`:
- The `live-shell/ui` frame was born in the Ableton RE lane on 7–8 Oct (`126343f91`, `afdf68d28`). That lane produced the `.als` Session, Arrangement, `BrowserPane`, `DeviceChainPanel` and `TransportBar`.
- The agent shell (`596829598`), the inhabitants and SDK (`5bd6ff239`) and the mode system (`20da871dc`) were added beside it.
- All of this was squashed into `169f55c6f` (#635, 10 Oct).
- The cradle pane engine (`070579901`, 5 Sept) and the store (`ffe87c8f7`, 9 Sept) are imported, not copied. The run touched them 3 and 2 times, only for pop-out and small hooks.

The DLW run (about 103 commits since 11 Oct) grew `App.tsx` by 19 commits, each wiring a new mode residence or instrument conditional into the switchboard. It added new folders beside the frame: `live/`, `central/`, `factory/`, `paneInstrument.ts`, `timelinePane.tsx`, `expressionsPane.tsx`.

It left untouched the structures the manual depends on:
- `ArrangementView`;
- `NativeDeviceRack` and `NativeRackEditor`;
- `AgentSessionGrid` and `AgentArrangementView`;
- `sdk/controls.tsx` (never wired).

It built `expressionsTrackAdapter` (`3a30f7135`) and never projected it.

In short, the run built on the frame's switchboard rather than on the pane engine and the contracts. Every new capability arrived as another per-mode branch, and nothing was ever checked on screen (`docs/wayfinder/HANDOFF-2026-10-14.md:26-40`).
