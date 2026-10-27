# T-PALACES-ONTO-ATLAS — a palace is a place on the world you can enter

Ticket U (PATH §7, 15 Oct 2026). FOUNDATION §3 N4: "Palaces live in the atlas. The palace model (src/techne/m0m5/palace, the
frame's palaceInstrument.tsx and palaceBoardView.tsx) moves onto the atlas: a palace is a place on the world you can enter (manual
§2, §8). There is no separate palace surface." The register's ranked ticket R2: lane-5 T14–T21 and T24, 9 targets.

Manual §8: "The palace gives a whole subject a building to live in: rooms that each hold a part of it, a path through them, a guide
who explains why each room is there, a private room that stays clouded, and doors out to other places and other people's worlds."
Lock §8.2: "A Palace (M5′) is a curated system over one corpus or project … its rooms are its curated sections; its path is its walks
(M3′); its objects open at their revision and are owned by the corpus, never by the room; its portals lead to other palaces and places
… its Return proposes to the owner." Owner, 14 Oct: controls live in device plates and the transport, never as chrome in a pane.

This file is the list the removal stands on. For each target: what the frame's palace did, what the atlas already had, the port, and
its home. Nothing was judged not worth keeping; two parts of the frame's drawing are replaced, each said where.

## What a palace is on the atlas (the decision, from the code)

The frame's palace was the native Expression the stage held open, read whole through the owner's Expression-wide Technē reading
(`wikiReadingProvider.ts` readWikiSceneTechne, scope "expression") — which answers only for an Expression bound to a Wiki register,
refusing any other by name. The suite already holds one such Expression per corpus or project: each Technē register (Central's root
and every project's wiki) is projected as one native Expression whose Scenes are its constellations and whose entities are its
subjects (`desktop/cradle/src/techne/wikiExpression.ts` WikiProjection, the store the subject door reads). That is lock §8.2's
"curated system over one corpus or project", so on the atlas:

- **a palace** is a register's Expression (`palaces/palacesModel.ts:125` palaceRows over the projection state);
- **its rooms** are its Scenes in the owner's order — the overview, each constellation, every hand-made region (a Scene minted by
  `composition.ts` regionSceneRef holding one contained Expression), any other Scene (`palacesModel.ts:72` roomsOf);
- **its path** is that Scene order (the frame's own law: "the guided path is the Palace's own scene order", `composition.ts`);
- **its objects** are the subjects each Scene's entities bind, verbatim, opened through their owners — never the room's;
- **its place**: a room stands on the Earth where the suite reads its subjects' places (`palacesModel.ts:143` roomPlaces, by
  `subject_ref`); the palace's door is the first room on its path that stands somewhere (`:149` palaceDoor). A palace none of whose
  rooms is placed is listed with that absence, never drawn at a made-up point;
- **entering**: from M4's Locations under the kind `palace` or the M5 plate's Palaces (a press turns the Earth to the door, a
  double-click enters), or from the globe — the Earth's selected subject names the rooms that hold it as doors on the M5 plate
  (`palacesModel.ts:158` palacesHolding); entering at such a door stands the walk in that room;
- **inside**: the atlas's palace scale (lock §2.5 "scales system · body · region · palace"; §7.1 "Sky = a scale of the globe"): the
  palace drawn in the Earth pane as its floor plan (`palaces/PalaceFloor.tsx`), the M5 plate standing open on the rack with its
  controls (`palaces/PalacePlate.tsx`), the transport walking it (`palaces/palaceTransport.ts`). Escape, or "↩ the Earth" among the
  plate's Portals, returns to the Earth.

Archetypal-Earth holds no palace code of its own (`Work/Archetypal-Earth` at 4faf013 names none): its modes are the worked foundation
the lock reads as palaces, and the frame's Palace lens was the palace's only face. So the port is the frame's palace onto the atlas's
seams; the drawing is the mockup's palace interior (`world-shell-mockup.html:1222-1249` palaceSVG), not AE's.

## How to read the citations

- **Frame** paths are the frame's palace as it stood before the removal, at `fdc302870`: read them with `git show fdc302870:<path>`.
  `fsj/` is `desktop/cradle/expressions-app/field-studies-journeys/`; `m0m5/` is `desktop/cradle/src/techne/m0m5/palace/`.
- **Atlas** paths are under `packages/live-shell/ui/src/projections/atlas/` unless named otherwise, at the working tree this ticket
  returns (the lead's commit of it).
- **Homes**: *plate* = the M5′ Palace / Integral Whole plate (`palaces/PalacePlate.tsx`, opened on the rack for `techne:m5`,
  `inhabitants/ql/devices/TechneDevices.tsx:270` OWN_PLATES; its sections Rooms, Path, Portals open as the mockup's, Integral whole,
  Compose and Return folded to their strips until pressed); *M4* = M4's Locations under the kind `palace`
  (`places/PlacesPlate.tsx:169` PalaceLocations); *pane* = the palace's floor plan in the Earth pane (`palaces/PalaceFloor.tsx`, bound
  by `palaces/palacesHost.ts:32`); *transport* = Technē's binding (`shell/modeTransports.tsx:101`, `palaces/palaceTransport.ts:16`).
- Every act goes through one store, `palaces/palaceSession.ts` (the frame's `PalacePanel` state and acts, moved out of one React panel
  so the plate and the pane read one palace), and every owner call through `palaces/palaceOwners.ts:59` livePalaceOwners.
- The pure palace logic the frame held moved to the owner seam the atlas reads: `m0m5/whole.ts` (from `fsj/src/palaceWhole.ts`),
  `m0m5/bookmarks.ts` (from `fsj/src/palaceBookmarks.ts`), `m0m5/board.ts` (the arrangement law of `fsj/src/palaceBoard.ts`), and
  `m0m5/basis.ts` (`fsj/src/palaceInstrumentBasis.ts`'s checks, the frame's document and edit replies from `fsj/src/app.ts:2730-2737`,
  and the trail step's law from `packages/expressions-boundary/src/timeWindow.ts:164`).

## The 9 targets

### lane-5 T14 — The integral whole composes the reading's real facets
- **Frame did**: read the Expression-wide reading at the stage's Scene (`fsj/src/palaceInstrument.tsx:627` readWhole, over
  `readTechneReading`), refused an invalid or foreign one by name, and drew `palaceWholeView(reading)` (`:191`; `fsj/src/palaceWhole.ts:101`
  over `m0m5/regions.ts:78` palaceRegions) — every disclosed facet family in M0′→M5′ order, each ref verbatim.
- **Atlas already**: nothing of a palace; the suite's places and subjects (`provider/suiteStanding.ts`).
- **Port**: entering reads the owner's document through the kernel's `expression` op and the whole through the same owner the frame
  reached — the boundary adapter's `techne-reading` channel, `readWikiSceneTechne` scope "expression" (`palaces/palaceOwners.ts:59`),
  at the register's overview Scene (`palaces/palaceSession.ts:202` wholeSceneOf); the reading is validated and refused unless it
  answers for this palace's own Expression at this revision (`palaceSession.ts:210` readWhole, the frame's scope check at this host's
  basis). `palaceWholeView` moved verbatim (`m0m5/whole.ts:106`).
- **Home**: plate, Integral whole (`PalacePlate.tsx:177` WholeSection: each region, its M′ office, its entries with Open); pane (the
  rooms are the whole's journey region — the palace's own Scenes).

### lane-5 T15 — Arrangement is free spatial composition, pure presentation
- **Frame did**: arranged its regions on the Research Canvas (`fsj/src/palaceBoardView.tsx:43`, xyflow drag, pan, zoom, marquee, Snap),
  held points by region name and saved them, and the viewport once settled, through the presence owner (`fsj/src/palaceInstrument.tsx:363`
  moveBoardPoints, `:372` viewportSettled); nothing reached the plan or the kernel.
- **Atlas already**: no palace; the globe's own drag is its orbit (`src/globe/controls.ts`).
- **Port**: the arrangement law moved to `m0m5/board.ts` (positions, defaults in walk order, move, forget, validate, the frame's own
  snap `canvasRepertoire.ts:115` copied unchanged — `board.ts:64`), keyed by the room's Scene ref. The floor plan is the board: drag a
  room (one gesture, one save — `palaceSession.ts:402` moveRooms), shift-drag a marquee (`:414` selectRooms, its rooms handed to the
  plate's room list), drag the floor to pan and wheel to zoom (`:441` setViewport, saved once settled). Replaced, not ported: the
  Research Canvas's card vocabulary (sticky size, palette tokens, xyflow nodes) — the floor draws the mockup's rooms instead.
- **Home**: pane (the gestures, `PalaceFloor.tsx:79`); plate, Rooms (the selection, and Snap off · grid).

### lane-5 T16 — Objects stay independently addressable: Open, with honest connections
- **Frame did**: opened an entry in its own instrument or refused it by name (`fsj/src/palaceWhole.ts:179` palaceOpenRoute; `fsj/src/
  palaceInstrument.tsx:214` openWhole, `:222` openBoardRegion, `:248` openPalaceObject: an Expression opened in the stage with its trail
  step, any other instrument through the frame's host-request summon); drew the guided path's own edges, naming gap, broken and self
  (`fsj/src/palaceWhole.ts:140` palaceGuidedEdges; `fsj/src/palaceBoard.ts:200` boardEdges).
- **Atlas already**: the shell's doors — the instrument door (`frame/instrumentDoor.ts:20` openInstrument), the subject door
  (`techne/subject/openSubject.ts` openWorldSubject), the App's Expression door published with the World's tracks
  (`projections/timelinePaneHost.ts` journey.openExpression).
- **Port**: the routes moved verbatim (`m0m5/whole.ts:184`, `:198`, `:145`). An object opens through its owner
  (`palaceSession.ts:633` openEntry, `:645` openObject, `:662` openRoom, `:679` openMember over `palaceOwners.ts` open): a region's one
  Expression in the stage, a room's own Scene through the owner's selection ask (`requestWikiSelection`, then the stage presented — the
  subject door's two acts), a subject through the subject door, an entry with the ref as its instrument pane's subject, a source on
  Graph and source. The trail step records on the shared session only while it stands on this palace's reading, else says why
  (`m0m5/basis.ts:85` palaceTrailStep, the law of `timeWindow.ts:164`). The floor draws the path's edges through `palacesModel.ts:209`
  floorEdges (a region's segment carries the guided path's honest kind).
- **Home**: pane (double-click a room; click an object); plate, Rooms (double-click), Integral whole (each entry), Portals.

### lane-5 T17 — The guided integral walk, method of loci over the whole
- **Frame did**: walked the whole's loci with wrap from the named start (`fsj/src/palaceWhole.ts:250` palaceWalkSteps, `:265` palaceWalkAt
  over `m0m5/recall.ts:35` recallOver), by its own buttons (`fsj/src/palaceInstrument.tsx:487-492`), the position saved
  (`:208` moveWalk), the board's focused card named.
- **Atlas already**: one time button the walk takes ("while a thread's walk stands, the one transport button serves it", AE
  `src/ui/time-control.ts:35`; `places/placesTransport.ts:55` atlasTimeBindings).
- **Port**: the walk is the transport's while a palace stands (`palaces/palaceTransport.ts:16` palaceWalkBindings): Play walks one
  locus per dwell and wraps, Stop holds it still (T17's craft bar), Walk pace reads the dwell, Stop n/8 reads the locus of how many;
  outside a palace these stand down and the atlas's time serves the button (`shell/modeTransports.tsx:101`). The position persists
  (`palaceSession.ts:313` moveWalk); Start, ← and → stand on the plate. The floor accents the room the walk stands in
  (`palacesModel.ts:228` roomOfStep). No owner sets a pace yet: the dwell is the walk's own (`palaceSession.ts:298`), and the
  transport's title says so.
- **Home**: transport (Walk, Stop, Walk pace, Stop n/8); plate, Path (Start ← →, the locus line, Path guided · free); pane (the focus).

### lane-5 T18 — Archaeology honesty on every region
- **Frame did**: said each region's standing — warranted QL structure with its warrant class and provenance, an Expression owner's
  composition, or free mnemonic composition — and every hand-made region as free (`fsj/src/palaceWhole.ts:63` palaceStanding, `:54`
  SCENE_REGION_STANDING, over `m0m5/regions.ts:281` regionArchaeology).
- **Atlas already**: nothing.
- **Port**: moved verbatim (`m0m5/whole.ts:68`, `:59`). The guide is these words: the plate's Guide says why the room the walk stands
  in stands where it does (`PalacePlate.tsx:133` PathSection, the mockup's `m5.guide`); every room on the floor says it in the Info
  view's hover (`PalaceFloor.tsx:33` roomWhy: its kind — overview, constellation, region, Scene — and the reading's standing).
- **Home**: plate, Integral whole (each region's standing tag and line) and Path (Guide on · off); pane (each room's hover).

### lane-5 T19 — Explicit Return: a recognised result as an attributable proposal
- **Frame did**: proposed the Return over a bound composition, writing nothing (`fsj/src/palaceInstrument.tsx:389`, `m0m5/return.ts:165`
  palaceReturnProposal); accepted it through the kernel-expression channel's invoke_action (`:399` acceptReturn, `m0m5/return.ts:192`
  palaceAcceptRequest), answered by the boundary's ke-invoke route (`packages/expressions-boundary/src/cradle.ts:89` frameAction,
  `:124`): the owner re-reads the reading the proposal came from and decides; only an invoked receipt crossed back to M0′.
- **Atlas already**: the same route, answering the frame.
- **Port**: the atlas calls that route itself — the boundary adapter the shell builds (`createCradleOwners`), its `kernel-expression`
  channel with `operation: invoke_action` (`palaceOwners.ts:59` invoke); `palaceSession.ts:567` proposeReturn, `:575` refuseReturn,
  `:582` acceptReturn port the frame's acts unchanged. The crossing to M0′ is the return to the Earth (lock §0.1.3: the 0 instrument is
  the Earth ⇄ Graph): an invoked Return leaves the palace (`:606` returnToGround).
- **Home**: plate, Return (Propose Return; the attributed proposal; Accept and return · Refuse; the owner's answer in one line).

### lane-5 T20 — Semantic saving: the kernel Expression stays the only store of record
- **Frame did**: planned the regions against the document the draft began at and sent one CAS-gated edit (`fsj/src/palaceInstrument.tsx:425`
  save over `m0m5/composition.ts` planRegions; the edit at `fsj/src/app.ts:2737`), refused a conflict loudly with the draft kept, sent
  nothing on a replay, checked the readback (`fsj/src/palaceInstrumentBasis.ts:17` samePalaceComposition); recorded an Expression Open's
  trail step through the owner's time-window route (`fsj/src/palaceHop.ts:18`).
- **Atlas already**: nothing.
- **Port**: the same plan, the same one edit through the kernel's `expression` op (`m0m5/basis.ts:79` palaceEditRequest, `:71`
  palaceComposeReply), the same readback (`basis.ts:40`), then the palace stands at the owner's new revision with its whole read again
  (`palaceSession.ts:520` save). The draft's acts moved unchanged (`:459` addTo, `:468` addAsNewRegion, `:478` addRegion, `:491`
  moveRegion, `:502` removeRegion — removal explicit — `:511` revert). The trail step: T16.
- **Home**: plate, Compose (new region; the kernel's Expressions, each "into <region>" or "as a region"; Save composition · Revert) and
  Rooms (↑ ↓ along the path, ○ empty, × remove); pane (an unsaved region's walls dashed).

### lane-5 T21 — Presentation saving: honest persistence
- **Frame did**: saved the arrangement, walk position, bookmarks and viewport on change and restored them on mount through the presence
  owner (`fsj/src/palaceInstrument.tsx:263` persist, `:654` restore; `m0m5/presence.ts:229` savePalaceComposition, `:291`
  restorePalaceComposition), told a refused store once.
- **Atlas already**: its memories bound to the workspace's storage namespace (`AtlasProjectionPanel.tsx:212` atlasMemoryStorage).
- **Port**: the same presence owner, unchanged (`presence.ts`, its keys and its state-registry entry as they were), over the atlas's
  workspace memory instead of the webview's raw storage — the host-seam adaptation the atlas's other memories have
  (`palacesHost.ts:32` bindPalaces, `AtlasProjectionPanel.tsx:448`). Entering restores before the palace is drawn and says a notice
  once (`palaceSession.ts:229` enterPalace); a refused store degrades to an unpersisted palace, told once (`:304` persist).
- **Home**: the plate's line (under its sections); every presentation act above.

### lane-5 T24 — Palace → objects navigation: bookmarks and the named start
- **Frame did**: bookmarked the focused position by name with its viewport, jumped in one hop, renamed, deleted
  (`fsj/src/palaceInstrument.tsx:274-305` over `fsj/src/palaceBookmarks.ts:54` palaceBookmarkAdd, `:85` palaceBookmarkJump); landed on the
  named start with no saved position (`:47` palaceLandingIndex); "Return to ground" re-opened M0′ (`fsj/src/palaceInstrument.tsx:238`).
- **Atlas already**: nothing.
- **Port**: moved verbatim (`m0m5/bookmarks.ts`); the acts `palaceSession.ts:358` bookmarkHere, `:370` jumpBookmark, `:381`
  renameBookmark, `:391` deleteBookmark, `:328` walkToStart; Return to ground is the return to the Earth (`:606`). Entering at a door
  stands the walk in that room, and names a room the walk does not hold (`:229`).
- **Home**: plate, Path (Start; the bookmark name and Bookmark; each bookmark — press to jump, ✎ rename, × delete) and Portals
  (↩ the Earth, first); M4 and the plate's Palaces (enter at a door).

## What the pane carries, and what it does not

The floor plan is the pane's picture, as the globe is: rooms, the path numbered through their doors, the objects they hold, the walk's
focus, an unsaved region dashed, the marquee while it is drawn. No button, field or setting stands in it (pinned:
`packages/live-shell/ui/tests/atlas-palaces-board.test.mjs`). The mockup's own interior differs in three ways, said here: its rooms
take shapes and sizes (a round tower) where the floor draws one size, since no owner discloses a room's shape; its water band
("Obersee") is the mockup's scenery of one place; its private room is clouded, and no owner discloses privacy for a Scene, so no room
is drawn clouded (the honest absence — OPEN in the return).

## What was removed, and what stays

Removed: the frame's Palace lens — `fsj/src/palaceInstrument.tsx`, `palaceInstrument.css`, `palaceBoardView.tsx`, `palaceBoard.ts`,
`palaceWhole.ts`, `palaceBookmarks.ts`, `palaceHop.ts`, `palaceInstrumentBasis.ts`; its wiring in `fsj/src/app.ts` (the install, its
Studio home, its open, refresh, close and destroy; asked for, the lens says where palaces went — `lensStudio.ts` PALACE_MOVED); its
chooser entry (`fsj/src/lensStudio.ts`); its Studio section (`fsj/src/studioSections.ts`, `fsj/src/shell.ts`); its `palace-active` rule
(`fsj/src/workspace.css`). Its pinning tests moved to `packages/live-shell/ui/tests/atlas-palaces-*.test.mjs` with their modules, each
retired assertion naming its replacement in the moved file's head.

Stays: `m0m5/composition.ts`, `palace-state.ts`, `presence.ts`, `recall.ts`, `regions.ts`, `return.ts` — the owner seam, now read by the
atlas; `m0m5/agent-state.ts` (unreached before and after; its deletion is proposed, not made). The hosted lens id `palace` stays in the
host protocol (`HostedTechneLens`, the shell's `HOSTED_INSTRUMENT`), as `place` did. The boundary's Palace trail route
(`packages/expressions-boundary/src/timeWindow.ts:164`) has no caller once the frame's lens is gone; it stays pinned beside the atlas's
port (`atlas-palaces-trail.test.mjs`) and its retirement is proposed.

## State of record (moved from PATH sec 7, 22 Oct 2026)

Moved verbatim from the retired `PATH.md` (history: PATH.md at `41557a9ed`). Hashes, run labels (r1, r23 ...) and cross-references inside are as PATH wrote them; "PATH sec N" and "FOUNDATION sec N" in this text name the retired files, whose content is now in `MAP.md` (State of the streams, The foundation's route), `EXECUTE.md` and the tickets.

### PATH sec 7: palaces live in the atlas (lane U, N4)

Then: palaces live in the atlas (`b5a935661`, lane U, N4): a palace is a register's native Expression standing on the world —
its rooms its Scenes in owner order (the path), a room's objects the subjects its Scenes bind, its door the first placed room;
entered from M4's Locations (kind palace), the M5 fold, or the browser's World › Palaces (`30ba8692f`: opens the Earth, waits for
its owners, enters — a wait that ends says so); the M5 Palace / Integral Whole plate carries Rooms, Path and Portals, the walk rides
the transport, the pane draws only the floor. The frame's Palace lens, board and hop are removed (−2.9k lines), with the
instrument-editors packet's Palace editor (`82eb45f4d`); the stage keeps three lenses. Lane 5's palace evidence went with the frame
(`c0fc49da7`: implemented 105 → 98); lane X re-homed the nine on the atlas's palaces and re-proved them there (`4d8de2be3`:
R2 closes, homes on a retiring home 0, implemented 105). Carried from lane U: no owner discloses a Scene's privacy
or shape (no clouded room, one room size); no owner sets a walk pace (a fixed 6 s, said); a live register's Return discloses
`oi.expression.edit`, not governed-write, so a Propose Return honestly comes back "not routed"; the boundary's `palaceHop` route
has no caller left but stays pinned as the trail step's reference law; `TechneLensBar` in ModeDetail.tsx is unrendered since F2
(only tests reach it) — remove with its tests. Screen legs UNVERIFIED.
