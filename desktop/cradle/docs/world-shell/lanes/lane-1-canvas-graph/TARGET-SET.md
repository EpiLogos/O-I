# Lane 1 target set — the composed canvas + graph instruments

The owner deliverable. Lane "miro/obsidian" (instrument 1): the `project`
and `canvas` instruments of `src/techne/instruments.ts:29-36` — M0′
Project/Wiki/Graph + M1′ Canvas/Constellation (owner relabelling direction:
M5-0′/M5-1′ in the new numbering). Written 2026-10-07.

**Sources of reference behavior:** tldraw `035b741…` and Excalidraw
`53973c3…` (possessed source, `/tmp` clones — see RE-TARGETS.md), Obsidian
1.7.7 (possessed app; `.canvas` format), Miro as doc-cited aspiration bar.
**Landing ground:** the hosted Expressions app's research Canvas
(`expressions-app/field-studies-journeys/src/researchInstruments.tsx`,
vendored xyflow-based Research Canvas) and the cradle's graph
(`src/knowledge/`), through the env seats — never a parallel surface.

## §0 The craft bar this set is judged by

Per the expression-audit law (`campaign-evidence/2026-10-07-expression-audit/
FINDINGS.md`): targets here are craft bars, never compliance ticks. Binding
constraints for every entry below:

- **Text by exception.** Nothing new on the stage carries default metadata;
  labels exist when the composer names a thing (frame titles, connector
  labels the owner writes). Citations, refs and routing stay in the
  binding record and panels.
- **Stillness lawful.** No entry introduces ambient animation; motion
  belongs to camera travel and pointer feedback, easing off under
  reduced-motion (the renderer's existing law, `GraphCanvas.tsx:20-70`).
- **One icon grammar.** The canvas tool row's 24×24 stroke language
  (`researchInstruments.tsx:25-30`) absorbs every new control; new glyphs
  are drawn in it, not pasted from a kit.
- **Presentation vs semantics.** Every canvas-side addition lands in
  `oi.research-scene/v1` presentation material (`researchMaterial.ts:26-29`)
  or stays session-local — never a second semantic store, never a second
  write path. Typed relations still go through native Actions with receipts.
- **Native-owner law.** Commit stays acknowledgement-gated
  (`app.ts:1070`); read-through viewings still refuse to commit
  (`nativeWorkspace.ts:255`).

**Carried, not re-targeted:** the Obsidian recreation backlog T1–T7
(`campaign-evidence/2026-10-07-obsidian-re/recreation-backlog.md` — T1 IPC
seam and T4 resolver already realized; T2/T3 save core + watcher; T5 graph
construction; T6 contributions; T7 parity gate realized as
`kernel/tests/links_parity.rs`). These land at the same graph/save seams
and are prerequisites of entries C1–C4 below.

---

## A. The composed canvas (M1′ Canvas · Constellation)

### A1 — Alignment snap guides

- **What it does:** while dragging, candidate alignments to other cards'
  centres/edges (and equal-gap rhythms) render as temporary guide lines and
  the drag settles onto them inside a threshold. Grid snap remains a
  separate toggle.
- **Reference behavior:** tldraw SnapManager (`SnapManager.ts:35`,
  BoundsSnaps/HandleSnaps, `SnapIndicatorOverlayUtil.ts:22`); Excalidraw
  threshold model `SNAP_DISTANCE = 8` screen px scaled `8/zoom`
  (`packages/excalidraw/snapping.ts:41-50`). The thin geometry already
  exists unused in the cradle (`interactions.ts:207-239` returns
  `{position, guides}`).
- **Landing seam:** wire `snapPosition` (m0m5/canvas) into the live drag
  path (`researchInstruments.tsx:527,530` groupMove calls) and the vendored
  canvas's overlay; guides drawn viewport-side, never persisted.
- **UI harmonisation:** guide lines in the canvas's existing hairline
  colour pair; no text, no badge.
- **Acceptance:** fixture canvas with 3 cards; drag a 4th — a guide renders
  while within threshold, position settles, no guide remains after release;
  screenshot pair (mid-drag / released) as evidence; grid toggle unaffected.

### A2 — Shape, sticky and text vocabulary

- **What it does:** the canvas holds more than note/image cards: sticky
  notes (colour set, editable label), basic shapes (rectangle, ellipse,
  diamond, at minimum) and standalone text objects — all presentation
  material on the same occurrence grid, movable, alignable, frameable.
- **Reference behavior:** tldraw geo enum
  (`TLGeoShape.ts:40-62`) and sticky (`TLNoteShape.ts:30-35`); Excalidraw's
  element set (`types.ts:215-231`); Miro's sticky palette (doc-cited).
- **Landing seam:** extend the `ResearchCard` union inside
  `oi.research-scene/v1` (`researchMaterial.ts:26-29`; closed-key
  validation at `:81` gains the new card kinds); tool row gains a compact
  shape/sticky picker in the existing icon grammar.
- **UI harmonisation:** shapes default to the quietest style (no fill or
  one fill); sticky colours come from the app's token palette, not
  web-whiteboard primaries. No new chrome beyond one picker.
- **Acceptance:** create one of each kind, move/align/frame them, commit;
  reload — kinds and styles survive the material round-trip; validation
  rejects unknown kinds with the existing closed-key error.

### A3 — Connector kinds, routing and labels

- **What it does:** connections between cards can be straight, curved or
  elbow (orthogonal, rerouting around moved endpoints) and can carry an
  owner-written label at the midpoint.
- **Reference behavior:** tldraw arrow `kind: 'arc' | 'elbow'`
  (`TLArrowShape.ts:21`, elbow router `arrow/elbow/getElbowArrowInfo.tsx`)
  and arrow labels; Excalidraw elbow arrows (`elbowArrow.ts`); Miro
  connector shapes/labels (doc-cited).
- **Landing seam:** the connection create menu (`researchInstruments.tsx:499-507`)
  gains kind + label acts; kind/label/waypoints persist as
  presentation material keyed by the existing edge ids; semantic relation
  kind and directionality keep flowing through the native ops unchanged.
- **UI harmonisation:** kind shown as three small line glyphs; label styled
  like card caption text (small, quiet); no permanent label chrome.
- **Acceptance:** draw one connector of each kind between two cards; drag
  an endpoint card — elbow reroutes with no manual waypoints; label renders
  at midpoint and clears when emptied; the native relation receipt for the
  same edge is byte-identical before/after (presentation overlay only).

### A4 — Connector side-binding and reconnect integrity

- **What it does:** connector endpoints bind to a card side (top/right/
  bottom/left) and follow the card; reconnect and cycle-directionality keep
  working over side-bound edges.
- **Reference behavior:** Obsidian edge sides `fromSide`/`toSide` with
  geometry-defaulted absence (1.7.7 bundle offset 2431562); Excalidraw
  binding gap + re-anchoring (`binding.ts:117-1219`).
- **Landing seam:** the vendored xyflow edge layer already knows handles;
  side choice becomes an explicit hover-zone pick on connect, stored
  presentation-side, defaulting to auto as Obsidian does.
- **UI harmonisation:** side pick appears only during connect/reconnect
  (pointer-zone highlight), never as standing UI.
- **Acceptance:** connect card A bottom → card B top; move B — the
  connector stays bound to the named side; reconnect to a different side
  and repeat; with no side chosen, behavior matches today's auto routing.

### A5 — Minimap on the canvas

- **What it does:** a corner minimap shows all content plus the live
  viewport rectangle; click/drag on it jumps the camera.
- **Reference behavior:** tldraw shipped minimap
  (`DefaultMinimap.tsx:23`, `MinimapManager`, click-to-jump at `:164`).
- **Landing seam:** a corner panel beside the existing viewport reporting
  (`researchInstruments.tsx:477-483` semantic zoom source); shared
  implementation with C2 (graph minimap).
- **UI harmonisation:** hairline border, quiet dot for cards, viewport rect
  in the focus colour; collapses to the icon grammar's smallest footprint;
  honours reduced-motion.
- **Acceptance:** with 30+ cards and 3 frames, the minimap shows all
  content; clicking jumps the camera to the point; viewport rect tracks
  camera travel; no layout shift of the tool row.

### A6 — Zoom-to-fit, zoom controls, zoom grammar

- **What it does:** one act fits all content (or the selection) with
  margin; persistent ± controls and keyboard zoom/reset; zoom percentage
  readable on demand.
- **Reference behavior:** tldraw zoom controls and quick-zoom keys
  (`DefaultKeyboardShortcutsDialogContent.tsx:57` "zoom-quick" shift+z and
  kin); Miro zoom-to-fit (doc-cited).
- **Landing seam:** camera helpers already exist (`flyToNode`,
  `researchInstruments.tsx:386`; graph camera `src/knowledge/camera.ts` —
  ceiling 4× to be revisited); add fit-selection/fit-all acts + controls.
- **UI harmonisation:** controls join the minimap corner as icon buttons;
  percentage appears transiently on zoom, then fades (no standing text).
- **Acceptance:** fit-all with 50 scattered cards leaves every card fully
  visible with margin at any window size; keys +/−/0 work; percentage
  flashes and fades; canvas camera easing preserved.

### A7 — Find and jump on the canvas

- **What it does:** a search act over card text, frame titles and shapes;
  jumping selects and centres the match; next/previous cycles matches.
- **Reference behavior:** Miro Find (doc-cited); the cradle's own graph
  SearchOverlay pattern (`src/knowledge/SearchOverlay.tsx`) as the
  in-house interaction precedent.
- **Landing seam:** overlay keyed off `researchMaterial.ts` cards/frames +
  native occurrence titles; results carry occurrence refs (identity kept);
  invoked from the icon grammar (magnifier) and keyboard.
- **UI harmonisation:** same overlay language as the graph's search; no
  permanent result list.
- **Acceptance:** search for a word present in one card — canvas centres
  and selects it; a second match cycles with Enter; no match leaves a
  quiet empty state; selection written through the existing host.select
  seam so identity holds.

### A8 — Presentation over frames

- **What it does:** saved frames become an ordered, presentable sequence:
  present from a frame, arrow advances the camera to the next frame's
  bounds (fullscreen), Esc exits; order is the saved frame order.
- **Reference behavior:** Miro Present frame-to-frame (doc-cited); tldraw
  frame camera + frame headings (`FrameShapeUtil.tsx:305`); the audit's
  reader law (real fullscreen via `requestFullscreen`, focus over chrome).
- **Landing seam:** frames already save ordered (`saveFrame`,
  `researchInstruments.tsx:383`; `frameOrder` in named views `:385-386`);
  add a present act + fullscreen host frame; sequencing stays
  session-local (as the existing walk already does, `:508-520`) unless the
  owner promotes it into the material record.
- **UI harmonisation:** presenting hides every panel (the audit's focus
  law); frame transition is a camera ease, never a cut effect; no
  auto-advance, no timer.
- **Acceptance:** three frames → present starts fullscreen at frame 1;
  arrow travels to frame 2's bounds; Esc restores the editor exactly;
  reduced-motion shortens the ease.

### A9 — Frame headings on stage

- **What it does:** a frame may carry a written title rendered quietly at
  its top edge, editable in place — the only default text this programme
  adds to the stage, and only when the composer names the frame.
- **Reference behavior:** tldraw frame name rendering
  (`FrameShapeUtil.tsx:305`); Obsidian group label (`label` field).
- **Landing seam:** `ResearchFrame` gains an optional title (material
  record, closed-key validation extended); rendered by the vendored frame
  layer.
- **UI harmonisation:** small caption style; empty title renders nothing
  (no placeholder on stage).
- **Acceptance:** title a frame — it renders at the frame edge, survives
  commit/reload; clearing it removes all trace; frames with no title look
  exactly as today.

### A10 — Embed and media cards

- **What it does:** cards can hold a bounded web embed (URL-ref, sandboxed
  iframe) or a media reference — the canvas becomes a place where sources
  can be seen, not only cited.
- **Reference behavior:** Excalidraw `embeddable`/`iframe` element types
  (`types.ts:115-140`); Miro embeds (doc-cited).
- **Landing seam:** new `ResearchCard` kinds in the material record; embeds
  store the URL (never a fetched copy — the kernel's material protocol
  serves bytes only for possessed files); strict sandbox attributes;
  pruning law applies unchanged (`researchMaterial.ts:76-78`).
- **UI harmonisation:** embed chrome is a hairline frame + the existing
  card colour system; no vendor badges.
- **Acceptance:** paste a URL → embed card renders interactively; removing
  the source occurrence prunes the card from every frame and saved view
  (existing law); a disallowed scheme is refused at validation with the
  existing error style.

## B. Data saving (explicit entries)

### B1 — Save schedule for the research scene

- **What it does:** commits happen on a schedule, not only per-action: a
  short trailing autosave after a gesture settles, immediate on a
  destructive act or lens switch, flush on quit. The acknowledgement gate
  and queued-edit guard are unchanged.
- **Reference behavior:** Excalidraw's local-first debounced saves; the
  decided Obsidian T2 posture (2 s trailing autosave, immediate on
  command/leaf-switch, flush-on-quit — recreation-backlog D-1/T2), tuned to
  the cradle's native-owner commit.
- **Landing seam:** around `commitResearch()` (`app.ts:1070`) and the
  gesture batching (`researchInstruments.tsx:269-285`); the queued-edit
  guard (`:299`) and read-through refusal (`nativeWorkspace.ts:255`)
  govern every scheduled commit identically.
- **UI harmonisation:** a single quiet save-state glyph (saved / saving /
  held) in the existing status line; no modal, no toast on routine saves.
- **Acceptance:** script ten quick gestures — one commit lands after the
  settle window (receipt count as evidence); quit mid-burst flushes or
  honestly reports the held state; a changed-native-composition refusal
  surfaces once, draft retained (existing message, `app.ts:1070`).

### B2 — Canvas document interchange: Obsidian `.canvas`

- **What it does:** export the composed scene to a `.canvas` file and
  import an Obsidian-authored `.canvas` into the canvas lens — the
  constellation travels to the tool the owner already uses, by reference
  never by lock-in.
- **Reference behavior:** the documented Obsidian format, pinned from the
  possessed app: nodes `{id, type: "text"|"file"|"link"|"group", x, y,
  width, height, …}`; edges `{id, fromNode, toNode, fromSide, toSide, …}`
  (bundle offsets 2431562, 1171612; RE-TARGETS §3).
- **Landing seam:** an export/import act beside save view (`:433-437`),
  mapping cards→text nodes, images→file/text nodes, frames→group nodes,
  connections→edges with sides; A2/A3 presentation kinds degrade honestly
  (dropped fields documented in the export header), semantic relations
  never export as plain edges without their native identity note.
- **UI harmonisation:** two icon-grammar acts; no format settings panel.
- **Acceptance:** export a fixture scene → open the file in possessed
  Obsidian 1.7.7: every card/frame/connection appears with position and
  grouping; round-trip a small hand-authored `.canvas` into the lens:
  nodes/edges/positions preserved; invalid JSON refused at validation with
  a named error.

### B3 — Frame export as image

- **What it does:** one act renders a frame (or the selection) to a PNG at
  device resolution — a view of the work, exportable.
- **Reference behavior:** Excalidraw's export pipeline
  (`data/json.ts:52-61` document shape; image export behaviors); Miro
  frame export (doc-cited).
- **Landing seam:** client-side raster of the frame bounds from the
  vendored canvas layers; offered in the frame context row (`:439-440`).
- **UI harmonisation:** one act, no export dialog unless size must be
  chosen; default is frame bounds + 2× DPR.
- **Acceptance:** exported PNG of a 3-card frame shows exactly the frame
  content (box-math against the render, per the audit's render-verified
  law); no stage metadata, no tool row, no minimap in the image.

### B4 — Honest drift on saved views

- **What it does:** applying a named view whose members have changed
  reports the drift quietly (which members left since saving) instead of
  silently dropping them; the view keeps its identity basis.
- **Reference behavior:** the dead model's `viewDrift` (`view.ts:142-149`)
  — the designed behavior the live canvas replaced with silent pruning
  (`researchMaterial.ts:76-78`); Obsidian's occurrence-count honesty in
  the link cache (A3).
- **Landing seam:** `applyView` (`researchInstruments.tsx:386`) gains a
  post-prune notice; named views keep the refs that pruned (tombstones)
  in the material record.
- **UI harmonisation:** one status-line sentence, never a modal; the view
  still applies.
- **Acceptance:** save a view over 3 members; delete one; re-apply —
  camera and remaining selection restore, status names the departed
  member; the notice is dismissible and repeats no other time.

## C. The graph (M0′ Project · Wiki · Graph)

### C1 — Unresolved-link ghost nodes, rendered

- **What it does:** unresolved link keys arrive from the reading already
  (`graph.ts:15` `unresolved_links`) — the renderer draws them as
  distinct quiet nodes (dashed/hollow), toggleable, the way Obsidian
  shows phantom nodes.
- **Reference behavior:** Obsidian graph semantics (obsidian-re A3 F5,
  gate-proven; backlog T5 realized in the kernel); carried T1–T7.
- **Landing seam:** `src/knowledge/graph.ts` + `GraphCanvas.tsx` — no
  parallel graph beside it (integration-map hazard #3).
- **UI harmonisation:** ghosts use the quietest node treatment; the filter
  row gains one toggle in the existing `GraphFilters` language
  (`filters.ts`).
- **Acceptance:** fixture with 2 unresolved keys renders 2 hollow nodes
  with the documented collapse rule; the toggle hides them; filter state
  persists with the saved-view travel record.

### C2 — Minimap + navigation headroom on the graph

- **What it does:** the same minimap component as A5 over the graph; the
  camera ceiling re-examined so budget-scale readings (4096 nodes) remain
  navigable.
- **Reference behavior:** tldraw minimap (`DefaultMinimap.tsx:23`);
  current graph ceiling 0.15–4× (`src/knowledge/camera.ts:2`).
- **Landing seam:** `GraphCanvas.tsx` corner panel sharing A5's
  implementation; camera options in `camera.ts`.
- **UI harmonisation:** identical minimap language across both
  instruments (one component, two feeds).
- **Acceptance:** at a 1,000-node fixture the minimap stays responsive
  (rAF budget unchanged, `GraphCanvas.tsx:20-70`); click-to-jump works at
  far zoom; no regression in hover emphasis.

### C3 — Canvas → graph hop ("show this in the field's graph")

- **What it does:** from a card or selection bound to a native subject,
  one act opens the M0′ graph centred on that subject with its
  neighbourhood emphasised — completing the one-field round trip that
  today only runs graph→canvas (`techneHandoff.ts:15-56`).
- **Reference behavior:** Obsidian's local graph around a note (A3 F6);
  the lane's own law: "No export, no second canvas … returns by
  reference" (`techneHandoff.ts:1-6`).
- **Landing seam:** the inverse ask through the one wiki projection
  selection ask; KnowledgeSurface opens with `techneHandoff`-style basis
  (subject_ref + origin "canvas").
- **UI harmonisation:** an icon-grammar context act; no dialog.
- **Acceptance:** from a constellation card, the act opens the graph
  centred on the same subject_ref (evidence: the reading's node id equals
  the card's subject basis); back-navigation returns to the canvas with
  camera and selection intact; no re-import, no duplicate node.

### C4 — Relation vocabulary made visible on emphasis

- **What it does:** edges carry their relation kind as a quiet label shown
  on hover/emphasis (and in C3's neighbourhood view) — the typed
  vocabulary finally has a visual carrier without permanent stage text.
- **Reference behavior:** tldraw arrow labels; Obsidian's edge-less graph
  is the contrast (the cradle is richer and should show it on demand).
- **Landing seam:** `GraphCanvas.tsx` label pass next to the existing
  label collision boxes.
- **UI harmonisation:** label style identical to node captions; default
  view unchanged (labels appear on emphasis only — the stillness law).
- **Acceptance:** hover a typed edge → its kind renders and fades; label
  boxes participate in the existing collision avoidance; no label in
  exports/screenshots unless emphasis was active.

## D. Navigation identity (explicit entries)

### D1 — The instrument rail, rendered

- **What it does:** the six-tab rail becomes real UI in the cradle —
  switch instrument (lens or cradle surface) from one place, with the
  active tab and geometry already modelled (`instrumentRail.ts:27-60`,
  localStorage key in place, zero consumers today — FINDINGS §1).
- **Reference behavior:** Obsidian's leaf/tab navigation (obsidian-re A1
  workspace lifecycle); Miro's board-switcher quietness (doc-cited).
- **Landing seam:** consumers in `TechneCentre.tsx:87-93` + the cradle
  shell; rail state and hosted-lens state sync both ways (`app.ts:1014`
  lens switch writes the rail).
- **UI harmonisation:** six small tabs in the cradle's own navigation
  grammar; instrument names as written in `instruments.ts:29-36`.
- **Acceptance:** switching Canvas→Timeline→Graph from the rail preserves
  the opened subject's binding (same subject_ref reachable after each
  hop); the localStorage key updates; no second navigation state — the
  hosted lens and the rail never disagree.

### D2 — Saved views carry their subject basis

- **What it does:** a named view records the subject/binding basis it was
  composed against, so applying it from another binding knows what it is
  looking at — the one-field identity law (TECHNE-DUAL-READING §3) at the
  view level.
- **Reference behavior:** the dead model's CanvasView artifact carried
  subject/reading/snapshot basis (`view.ts:69-72`) — the designed spec.
- **Landing seam:** `ResearchNamedView` gains optional basis fields
  (material record, closed-key validation extended; B4's drift notice
  reads them).
- **UI harmonisation:** invisible until a mismatch: the B4 status
  sentence is the only surface.
- **Acceptance:** save a view under binding X; apply from binding Y with
  the same subject — applies cleanly; apply against a different subject —
  the notice names the basis difference; absent basis (legacy views)
  behaves exactly as today.

### D3 — Graph saved views restore the camera

- **What it does:** saved graph views currently restore filters only —
  they gain the camera, so a named view is a place, not just a filter set.
- **Reference behavior:** Obsidian graph filter/groups persistence (A3);
  the cradle's own travel history already persists camera
  (`oi-cradle.knowledge-travel.v1:<binding>`, KnowledgeSurface `:53-66`).
- **Landing seam:** `SavedGraphView {name, filters}` (`filters.ts:136-141`)
  gains camera; restore path in `KnowledgeSurface`.
- **UI harmonisation:** none (existing menu rows).
- **Acceptance:** save a view after travelling; reload; apply — filters
  and camera both restore; old views without camera restore filters only
  (backward-compatible decode).

---

## Count and coverage

21 numbered targets: A1–A10 (composed surface), B1–B4 (data saving —
explicit), C1–C4 (graph), D1–D3 (navigation identity — explicit). Every
entry names possessed reference behavior; Miro appears only as the
doc-cited aspiration bar (RE-TARGETS §4). Every landing seam is in the
existing instrument or the single graph seam — no parallel surface, no
second semantic store, no per-lane worktree.

## Verification posture for the RE passes that follow

Each entry's acceptance shape becomes a named gate in phase 3 (the
obsidian-re pattern: fixture + captured oracle + round-trip). Shared
fixtures: the B2 `.canvas` round-trip file (opened in possessed Obsidian
1.7.7), the A1 4-card drag fixture, the C1 unresolved-key fixture. Render
claims are screenshot-verified (audit law), save claims receipt-verified
(kernel event log), identity claims verified by ref equality across hops.
