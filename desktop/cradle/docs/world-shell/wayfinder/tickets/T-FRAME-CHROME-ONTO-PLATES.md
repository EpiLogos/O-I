# T-FRAME-CHROME-ONTO-PLATES — the hosted frame draws only its field in a pane

Ticket Y (PATH §7, 15 Oct 2026). Seen by the lead, native at `e37198c2d` and headless: once a work opened in a pane drew at all
(`2e37defb4`), the frame drew its own chrome over it — the masthead and tool rail, the research canvas's tool palette, its zoom and fit
keys, its minimap, the scene bar, the "⋮" handle and the "React Flow" attribution. Owner, 14 Oct: "immediately seeing the violations of
having options inside the pane". Law (PATH §1, 14 Oct): controls live in device UI, never as chrome inside a pane. Manual §16.1: "A pane
is a device at full size. Its controls stay out of the pane and appear in Device view below it." §20.1 Field, Full: "There are no
controls in the pane." §20.2 Studio, Rules: "The Studio controls stay out of the field pane."

This file is the list the stand-down stands on: every control the frame draws in a pane — in Expressions mode and in each Technē lens it
presents — what it does, whether a device already carries it, and its home. Nothing the person could do is lost; where a control is
judged not worth carrying, it says why.

## The move (decisions, from the code)

1. **The frame learns its presentation from the host, over the one channel.** Two closed stage commands join the frame's vocabulary
   (`fsj/src/stageCommands.ts` STAGE_COMMANDS): `presentation` (`'devices'` | `'frame'`) and `chrome` (press one control by the id the
   frame's reading gives it, with a value for a choice or a field). The frame publishes the presentation it stands in and its chrome as
   data with its state (`fsj/src/app.ts` announceHostState `...chromeState()`; boundary `protocol.ts` readHostedState `presentation`,
   `chrome`, validated closed by `readFrameChrome`). No second channel: commands go through the frame's one runner
   (`host.stageCommand`), the reading rides `oi-app-state`.
2. **The stand-down is the frame's own.** `fsj/src/presentedChrome.ts` sets `body.oi-chrome-devices` only on the shell's declaration;
   `fsj/src/workspace.css` conceals each chrome region under it by visibility (never `display:none`, never removed). Standalone
   (`field-studies.html`), in the legacy cradle (which declares nothing: `desktop/cradle/src/expressions/hostedApp.ts` postHostMode), and
   at full size, the frame stays `'frame'` and its chrome stands as it always has. No shell CSS reaches into the iframe.
3. **Every control keeps its own handler.** The chrome door reads each region's controls in the frame's own words and states — a
   toggle's pressed state is the frame's own `aria-pressed`/`aria-selected`/`aria-expanded`, a choice's options are its own `<option>`s —
   and a press from a device is the frame's own control pressed: `click()`, a choice set as typing sets it (`input` + `change`), a value
   committed as leaving the field commits it (`focusout`). This is the atlas header door's move (`6f8c25dc5`,
   `projections/atlas/src/shell/shell.ts` headerReading: "each press is the header's own button pressed … the plate keeps no copy")
   made for the frame's whole chrome. Keyboard shortcuts stay the frame's: none is touched.
4. **Homes.** Each control carries a home from one closed list (`FRAME_CHROME_HOMES`): the manual's groups for the research instruments
   (§17.3 Canvas "Tools, Lines, Relation, Look, Views"; §17.4 Timeline "Lens, Readings, Standing, Window"; §17.5 Journey "Stops, Pace,
   Transitions, Takes") and, for the stage-wide chrome, the masthead's and scene bar's own clusters (`work`, `tools`, `capture`, `nara`,
   `scene`, `side`, `lens`). The shell draws them:
   - **Studio** (Expressions): `components/expressions/studio/ExpressionsStudio.tsx` — Tools gets Work (Save, Undo, Redo) and the frame's
     tools not carried elsewhere; Nara · M4 gets the frame's Nara; every carried one is named with its carrier in `studioModel.ts`
     STUDIO_CARRIED.
   - **M1′ Canvas, M2′ Timeline, M3′ Journey** (Technē): `projections/stageInstruments/StageInstrumentPlate.tsx`, registered in
     `inhabitants/ql/devices/TechneDevices.tsx` OWN_PLATES beside M4′/M5′, sections from `stageInstrumentModel.ts` STAGE_PLATES, then
     **Expression** (the stage-wide chrome every lens drew). A manual parameter no owner carries stands dim with why (WaitingRow).
   - Drawn by `components/expressions/studio/frameChrome.tsx` (keys, lit toggles, the frame's own menus, value fields that commit on
     Enter or leaving them, mono readings) — the device row's density, no inner scroller, no box of its own.
5. **Transport.** Play and scene stepping stay where the transport already carries them: Expressions' Play/Stop are the native scene
   transport (`shell/transports/useExpressionsTransport.tsx` `play`, `stop`), its Draw slot the stage tools; Technē's Play is the atlas's
   walk or the palace walk (`shell/modeTransports.tsx` useTechneTransport). The frame's scene bar is not a second transport: in
   Expressions its stepping, Saved scenes, Save and time stand on the Clip side (`components/expressions/clip/SceneControls.tsx`); in
   Technē it stands in each stage plate's Expression section.

## (b) The pane at full size — owner, 15 Oct

> "UI inside in fullscreen, UI outside in devices/instruments panel when normal pane view"

**Decision.** The shell already holds the pane grammar's own full size — the group maximise (`desktop/cradle/src/surface/registry.ts:200`
`surface.maximize`, the group's `data-maximized` drawn by `Workbench.tsx` GroupPane, `packages/live-shell/ui/src/native/workbench.css:285`
"A maximised group" at the shell's gutter) — but the candidate's panes offered no gesture for it: the legacy toolbar's "Maximize / restore
(⌘⌥Enter)" is not drawn there ("the panes carry no toolbar of their own", `native/Workbench.tsx:803`), and no key reaches it. So the
gesture joins the pane grammar's own ⊞ menu, beside Beside, Below and Four ways: **Full size**, which reads **Restore panes** while the pane
stands at full size (`desktop/cradle/src/surface/Workbench.tsx` GroupPane, the split menu; one gesture, every mode, no mode branch, no
App.tsx change). The presentation follows it: the frame's pane at full size → `'frame'` (its own UI inside, as the standalone app has it);
any other placement → `'devices'`. `components/expressions/studio/framePresentation.ts` useFramePresentation reads the placement the pane
host publishes (`projections/expressionsPaneHost.ts` useFramePlacement), the group's own `data-maximized` in the shell's document, and the
frame's reported `presentation`; it sends `presentation` only when the reading differs — no copy kept — and asks again a moment later
when the host or the frame refuses (a frame concealed or not yet answering). It is mounted once with the transport
(`shell/modeTransports.tsx` ModeTransport), which stands in every mode as the frame can stand in a pane of any mode. At full size the
device plates keep drawing the same controls (the frame keeps publishing them): both reach the same handlers.

## (c) The Studio is the toolbar, curated — owner, 15 Oct

> "the rack device view wass meant to be the toolbar, which lshould be letting you curate the settings and macros which you are adding to
> the toolbar, just like it works in the current expressions app"

**Decision.** The current Expressions app's curation is its toolbelt: `Journey.shared.toolbelt`, opened by the "⋮" handle
(`fsj/src/shell.ts:14` `#toolbelt-button`, `#toolbelt-panel` "Add properties"). It is already ported to the shell, not recreated: the
boundary reads the same toolbelt as the chosen controls (`packages/expressions-boundary/src/chosenControls.ts:1` "Chosen controls
belong to Journey.shared.toolbelt") and `components/NativeChosenControls.tsx:225` draws them with "+ Parameter" (the browser's
parameter list) and their reorder, scope and remove in Configure; the macros are the racks' (`NativeRackEditor`). Until now they stood
on the Studio only while the person held any. Now **Your controls always stand on the Studio** (`ExpressionsStudio.tsx` `yours`): with
none chosen it says so and offers the browse, as the toolbelt's empty panel offered "Add properties". The "⋮" handle stands down and is
carried by it. The toolbelt's other header controls are carried too: Record property keyframes and the take mode by the transport's
Arm, Record and Overdub (`useExpressionsTransport.tsx` take start/stop, `overdub`), Pointer effects by the Draw slot's pointer group.

**Compact.** The Studio's Compact presentation takes its four macros from that curation: the first four of Your controls, in the
person's order (manual §20.2 names Density, Glow, Speed, Turbulence; those are what a person's curation starts from, never imposed over
it). No Compact Studio is drawn in the shell yet — OPEN below: where it stands (a chain in another mode's Device view, or the widget
rail) is a placement the lock does not yet give.

## Device craft — owner, 15 Oct

> "techne instruments arent propelry taking the ableton UI approahc, rich modal layouts, visually driven etc, no scrollers, no overuse
> of intenral boxes etc"

The stage plates stand their sections side by side at fixed widths (`stageInstrumentModel.ts` widths), controls as keys that flow in
rows, lit when the frame reads them on, each by the frame's own short word (`presentedChrome.ts` SHORT: "Fit all", "Minimap", "‹ Scene")
with its full name and shortcut in its hover words; choices and values on one line after a small name; no box around a group. A column
that cannot fit is a fold, not a scroller: the plates fit the device row by the plate's own fold, the Studio's fit moved whole into one
hook both use (`components/expressions/studio/plateFit.ts` usePlateFit over `studioFit.ts` foldsToFit, now with a fold order per plate):
the Expression and a group the frame places nothing in stand folded until pressed; when the row is still too narrow the held families
fold from the end, then the lens's later groups; the families' held devices otherwise stay open as they stood (`TechneDevices.tsx`
OpenInstrument hands its family columns to the own plate). Clipping a control would lose it, so a section that is still taller than the
row keeps the plate's own section scroll (`frame/devices/instrumentPlate.css`) — the one place a scroller remains (PROPOSE). The InstrumentPlate's own section body still
scrolls for every other plate (`frame/devices/instrumentPlate.css` `.inst-section-body { overflow: hidden auto }`) — PROPOSE, not this
zone. Pictures: the frame publishes no picture of a lens yet; the plate's Compact picture is OPEN with the Compact presentation.

## The list

Paths: `fsj/` is `desktop/cradle/expressions-app/field-studies-journeys/`. Ids are the chrome door's (`region/key`), as the plates
key them (`data-chrome`). **Carried** names the device that already carried the behaviour before this ticket.

### The masthead (every cut but Live; `fsj/src/shell.ts:11-13`, `fsj/src/app.ts:2478`, `:2811`, `:2814`, `fsj/src/naraInstrument.tsx:307`)

| Control (frame's words) | Does | Carried already | Home now |
|---|---|---|---|
| Interact, Select, Pin, Formation sequence, Edit page text (T) — `rail/a:tool-*` | the rail's tools (`app.ts` activateRail) | transport Draw slot, `BarTools` (`useExpressionsTransport.tsx` `draw`) | also Studio › Tools (manual §20.2 "Tools") — the frame's own keys, lit by its own reading |
| Pointer effects — `rail/a:pointer-options` | the pointer's context panel | transport Draw slot pointer group (`BarPointerGroup`) | carried |
| Objects in this scene — `rail/a:objects` | the objects panel | Studio › Selected, the Object chooser (`ExpressionsStudio.tsx` SelectedGlyph) | carried |
| Preview the live field — `rail/a:research-preview` (Technē) | shows the field under a research instrument (`app.ts:1728`) | — | stage plate › Expression |
| Expression library — `workspace/a:library` | the frame's library page | — | Studio › Tools; stage plate › Expression |
| Studio — `workspace/a:studio` | the frame's own Studio panel | the Studio (this device) in Expressions | Expressions: carried; Technē: stage plate › Expression (its Canvas section is mirrored on M1′ › Views) |
| Scene blueprint — `workspace/a:blueprint` | the Studio's blueprint section | Studio Scene device Blueprint | Expressions: carried; Technē: Expression |
| Recent and starting compositions — `workspace/a:modes` | the compositions panel | — | Studio › Tools; Expression |
| How to use the instrument — `workspace/a:quick-guide` | the guide dialog | Clip side Guide (`SceneControls.tsx:87`) | Expressions: carried; Technē: Expression |
| Epii home, Verso — `workspace/a:deep-home`, `a:deep-verso` (Technē) | the deep lenses' starters (`app.ts:1731`) | — | stage plate › Expression |
| M0′–M3′ chooser — `lens/a:lens:*` (Technē) | the frame's lens | the rack's instrument folds (`TechneDevices.tsx` InstrumentFold → `frame/instrumentDoor.ts` driveStageLens) | carried — never drawn twice |
| Nara — `save/l:Nara` | the frame's Nara instrument (personal Expression) | — | Studio › Nara · M4; stage plate › Expression |
| Save (⌘S) — `save/a:native-save` | `app.ts:2844` saveNative: commits the working composition to its native Expression | Clip side Save Expression (`SceneControls.tsx:76`) | Studio › Tools (Work); stage plate › Expression. Mockup: "Save in the Studio's head" — PROPOSE a head slot |
| Undo edit, Redo edit — `save/a:undo`, `a:redo` | `app.ts:1845` stepHistory | — | Studio › Tools (Work); stage plate › Expression |
| Capture image, Record video, Image suite — `save/a:capture-*`, `a:record-video` | still, video, the capture options | Studio › Capture (`StudioStage.tsx` StageCaptureTools: ◉ Capture still \| video, Edition…) | Expressions: carried; Technē: Expression |
| ••• overflow toggles | the masthead's narrow-width menus | — | not a control of the work: a layout of the chrome; with the chrome stood down the menus stand laid out and their items are read directly |

### The scene bar (`fsj/src/shell.ts:24`; Acts `fsj/src/actPanel.ts:59`)

| Control | Does | Carried already | Home now |
|---|---|---|---|
| Previous scene (←), Next scene (→) — `scene/a:previous`, `a:next` | step the Scene | Clip side Scene ‹ › (`SceneControls.tsx:63-66`) | Expressions: carried; Technē: stage plate › Expression |
| Scene picker (number, name, standing) — `scene/a:timeline` | opens the scenes timeline | Clip side Scene strip | Expressions: carried; Technē: Expression |
| Pause motion (Space) — `scene/a:toggle-play` | plays or pauses the Scene | transport Play/Stop (native scene transport) | Expressions: carried; Technē: Expression (Technē's Play walks) |
| Play saved scenes — `scene/a:play-journey` | plays the saved sequence | Clip side Saved scenes (`SceneControls.tsx:82`) | Expressions: carried; Technē: Expression |
| Acts — `scene/l:Acts` | the Acts panel: roles, reusable material, act playback | — | Studio › Tools; stage plate › Expression |
| Save scene — `scene/a:open-timeline` | the scenes panel with its save row | — (the Clip side's Save is the Expression's) | Studio › Tools; Expression |
| Present the artwork (F) — `scene/a:present` | presentation | Studio › Capture Present | Expressions: carried; Technē: Expression |
| Expression time `0:00 / 0:00`, its progress | a reading that ticks with the field | Clip side Expression time; transport Position | not read over the channel: a 30 Hz reading on the state channel is refused by design (`stageCommands.ts` live set: "must not trigger a shell read at 20 Hz") |

### The handle, the placement bar, the readouts (`fsj/src/shell.ts:14-15`, `:25-26`; `fsj/src/app.ts:2154`)

| Control | Does | Carried already | Home now |
|---|---|---|---|
| ⋮ Toolbelt — `side/a:toolbelt` | the toolbelt (chosen controls) | Your controls (`NativeChosenControls.tsx`) | carried — Your controls now always stand (decision c) |
| Placement bar: Show working grid (G), Snap, Face, Hide / show guides — `view/a:*` | the stage's guides while placing | Studio › Tools Guides and snap, Camera (StageViewTools) | carried |
| Placement bar: Working plane (XY · XZ · YZ), Working-plane depth — `view/#working-plane`, `view/#working-depth` | the plane a pin is placed on | — | Studio › Tools |
| The rail's hint — `hint/#tool-hint` | what the chosen tool does | — | Studio › Tools, a reading |
| Coordinate readout `X · Y · Z` | the pointer's place on the stage | — | not carried: a pointer reading at pointer rate; it stands at full size |
| Return to the instrument (Esc) — `present/a:exit-present` | leaves Present | Studio › Capture Present (pressed) | carried |
| Recording badge, Stop recording — `recording/a:stop-record` | the take's time and its stop | Studio › Capture Stop | carried |
| Return to journey — `crossing/…` | leaves a journey crossing (T11) | — | Studio › Tools (Expressions, where the crossing stands) |

### M1′ Canvas (`fsj/src/researchInstruments.tsx`; manual §17.3, Whole "Tools, Lines, Relation, Look, Views")

| Control (frame's words) | Does | Home |
|---|---|---|
| Note, Image, Link card, Add sticky, shape or text (and its menu: sticky, rectangle, ellipse, diamond, text) `:880-881` | makes a card | M1′ › Tools |
| Draw, Erase `:882-883` | strokes on the canvas | Tools |
| Align selection, Distribute ↔ ↕ `:885-887` (with a selection) | arranges the selection | Tools |
| Snap, Lasso `:888-889` | grid snap; box select | Tools (lit by the frame's reading) |
| Frame selection `:890` | a frame around the selection | Tools |
| Find on Canvas (`fsj/src/canvasFindOverlay.tsx`, `:1036`) | the find dialog | Tools — the dialog itself opens over the canvas when summoned |
| The status line, the save glyph `:419`, `:426` | the instrument's standing; saved · saving · held | Tools, readings |
| Stroke colour `:884` | the stroke's colour | Look |
| Zoom out, Zoom in, Fit all, Fit selection `:1041-1046` | the camera | Look |
| Hide / show overview (`fsj/src/canvasNavigationOverview.tsx:21`) | the minimap | Look — **the minimap itself stays in the pane**: manual §17.3 Full "The Canvas in the pane, with the minimap"; Parameters "Minimap On · Off" |
| Zoom readout (`:485`) | the zoom percentage | Look, a reading |
| Export selection as PNG, Present frames, Previous / Next members `:891-897` | a frame as an image; present the frames; page the loaded members | Views |
| Focus a source, Save view, Save view as…, Saved views, Export / Import Obsidian canvas, Frames (Canvas section, `:901-928`) | the canvas's views, exchange and frames | Views — read from the Canvas section even while the frame's Studio is closed |
| Selected card: its title, Open source, Show in graph, Edit object, the constellation act, Duplicate, Remove annotation n, blueprint whole `:930-950` | acts on the selection | Tools |
| Selected card: Width, Height, colours, the object's palette and fill | the card's look | Look |
| Selected line: kind, label, sides (`ConnectorControls`) | the line's presentation | Lines |
| Selected line: Record as constellation relationship (`RelateKnowledgeAction`) | promotes the drawn line to its owner | Relation — the mockup's "Promote… (native Action)" |
| The panel's own close | dismisses the panel | not carried: the panel is not drawn in a pane; selection is the canvas's |
| React Flow attribution | the library's credit | stands down; its licence travels in the bundle's notices (`scripts/build.mjs` `legalComments: 'inline'`) |
| *Waiting* — Tool (Select · Frame · Relate · Note · Shape · Text), Layout (Free · Radial · Form), Line kind for the next line, Relation type for the next line, Standing | manual §17.3 Parameters | dim with why (`stageInstrumentModel.ts`): no owner carries them |

### M2′ Timeline (`fsj/src/researchInstruments.tsx:1354-1367`, the vendored `TimelineLens.tsx:831` toolbar, `fsj/src/sharedTimeWindow.tsx`)

| Control | Home |
|---|---|
| Chronology · Relations · Relative, Refresh timeline, Save timeline view, Save view…, Saved timeline views, Reading incomplete, the selected event's and trail's controls, Focus | M2′ › Lens |
| The vendored lens's filters: card, context, tag and relation-type filters | Readings |
| The shared time window's controls | Window |
| The lens's other toolbar keys (walk, working set, frame, relations, archetypal context) | Lens |
| The Relations projection's own keys over its arcs (`fsj/src/relationFieldView.tsx:200-216`): Cause · Recurrence · Concurrency | Lens |
| The Relations projection's standing filter (each standing, Clear) | Standing — the manual's Standing floor, while that projection is shown |
| The relation field's arcs and its cause chains | the material: they stay in the pane |
| *Waiting* — Standing floor, while the chronology is shown | dim with why: the chronology filters no event by standing |

### M3′ Journey (`fsj/src/journeyInstrument.tsx:147-200`, the journey's reading panel `app.ts` journeyHome)

| Control | Home |
|---|---|
| Refresh reading, each stop (focus its Scene), Enter, its source portals, Play from (each step of the path) | M3′ › Stops |
| Each stop's hold, Re-apply draft, Discard, Save pace, the path's stop and loop keys; the scenes panel's frame steps, J K L shuttle and Snap to points; the selected stop's Hold · seconds | Pace |
| Each transition's Switch and Curve (`journey-path-edge`); the selected stop's Transition seconds; the curve and seam choosers | Transitions |
| The selected stop's Scene name, Save scene, Save & next, Restore, Split, Still scene, Move earlier / later, Delete scene, Collapse scenes (the scenes panel's save row) | Stops |
| *Waiting* — Take | dim with why: recording a walk keeps no takes yet |

The reading panel is a floating list of controls over the field (`journeyInstrument.css` `.journey-reading-home`), so it stands down
whole. The walk's rows stay: in the journey lens the frame opens its scenes panel inside the scene bar (`app.ts` activateInstrument
`timelineOpen=true`), the scenes as clips the person reorders and trims — manual §17.5 Full, "The walk as rows of stops … In a pane, you
reorder stops, trim them and play the walk" — so it stands in the pane while the bar around it stands down; its toolbar (frame steps,
shuttle, Snap to points: `app.ts` transportBarHTML), its save row (Scene name, Hold, Transition, Save scene, Save & next, Restore,
Split, Still scene, Move, Delete, Collapse) and its curve and seam choosers fold out of the way and stand on M3′ › Pace, Stops and
Transitions. Opened in any other cut (Save scene…), the same controls are the scene bar's.

### M0′ — the stage's project lens

The frame's project lens is the plain field in Technē (`app.ts` activateInstrument: research closed). Its masthead and scene bar stand
down like every lens's, but the rack opens M0′ as the atlas's instrument (`TechneDevices.tsx` ATLAS_INSTRUMENTS), so no stage plate
draws them while the stage stands in it — OPEN below.

## Not lost, and what the person still meets in the pane

- Summoned editors open over the field when the person summons them from a device: the find dialog, the Acts panel, the Nara
  instrument, the compositions panel, the library page, the frame's own Studio, the scenes timeline. Each closes with its own ×. Each is
  a whole editor, not a strip of chrome; porting each onto the Device side is its own work (OPEN).
- Dialogs and toasts are the frame's messages, not its controls.

## Headless proof (lane Y, 15 Oct — headless; the native screen leg is the lead's)

Lane Y's own stack, copied from the lead's recipe with every port changed (bridge :4361, live-shell :9041, front :9042 serving the frame
built from this tree, Vite :5341; OI_HOME under lane Y's scratch). Technē › browser › Locations › O-I (double-click; the second ask once
the 17 registers projected), the frame on Central's register Expression, Scene "O I". Per state: every control visible in the frame
(`getClientRects` and computed visibility), the frame's published state, and the rack's open plate.

| State | Visible controls in the pane | Presentation | Plate |
|---|---|---|---|
| Technē, M1′ canvas | 0 (before: 40 — masthead, palette, zoom keys, scene bar, ⋮, attribution) | devices | M1′: Tools 11 keys (Note, Image, Link…, Object…, Draw, Erase, Snap, Lasso, Find…, readings), Lines, Relation (waiting rows), Look 6 (−, +, Fit all, Fit selection, Minimap, 200 %), Views 5; Expression and the Earth atlas folded to fit |
| Technē, M2′ timeline | 0 | devices | M2′: Lens 9, Readings folded (empty), Standing (waiting), Window 1; the held families folded to fit |
| Technē, M3′ journey | the walk's rows only: the scenes as clips and their seams (the manual's Full Journey) | devices | M3′: Stops 16, Pace 6, Transitions (empty, folded), Takes (waiting) |
| Snap pressed on the M1′ plate | — | devices | the frame's own Snap button reads `aria-pressed="true"` and the published reading turns `pressed: true` |
| ⊞ › Full size | 40: the frame's own chrome inside, as standalone | frame | the plate keeps the same controls; its head says "its controls in the pane at full size" |
| ⊞ › Restore panes | 0 | devices | — |
| Expressions mode, the same work | 0 | devices | the Studio: Tools (Save, Undo, Redo, Interact, Select, Pin, Formation, Text, Library…, Compositions…, Acts, Save scene…, the view), Capture, Your controls (+ Parameter) |

Pictures (headless, 1440×900): `scratchpad/lane-y/after5/techne-canvas.png` (a), `after5/expressions.png` (b),
`after5/techne-canvas-fullsize.png`, `after4/techne-timeline.png`, `after4/techne-journey.png`. The legs read the frame and shell at this
tree; the frame's journey hold/transition split and the plate fit landed after `after4`'s journey leg (re-read by code and the suites,
not re-shot).

## Open

- **M0′ — the stage's project lens.** The frame's project lens is the plain field in Technē; its chrome stands down like every lens's,
  but the rack opens M0′ as the atlas's instrument (`shell/paneInstrument.ts` :118 and :121 map the stage's `project` to `techne:m0`), so
  no plate draws the stage-wide controls while the stage stands in it. Its Save, Undo and scene bar stand on the Studio in Expressions
  mode and at full size; the lens is reached only from a fold that opens a stage lens. Proposed: the stage's `project` lens maps to the
  Expressions Studio (the plain field is the Studio's material), not this zone.
- **The Studio's Compact presentation** is not drawn in the shell; its four macros are the first four of Your controls (decision c).
- **Summoned editors** (Acts, Nara, the compositions panel, the library page, the frame's own Studio, the scenes panel opened by Save
  scene… outside the journey lens, the find dialog) still open over the field when summoned from a device; each is a whole editor whose
  port onto the Device side is its own work.
- **The relation field's keys** (Cause · Recurrence · Concurrency; the standing filter) are read and stood down by code; the headless
  work's reading discloses no typed relations, so they were not seen.
