# Lane 1 findings — M0′ Project/Wiki/Graph + M1′ Canvas/Constellation current state

Lane: "miro/obsidian" (instrument 1). Survey of the cradle
(`Work/O-I/desktop/cradle/`), read-only, 2026-10-07. Every claim carries
file:line evidence from this session's reads; line numbers are as on disk
today. The Obsidian half of this lane is DONE elsewhere
(`campaign-evidence/2026-10-07-obsidian-re/`): its recreation backlog T1–T7
is folded into this lane's target set as known/landed work, not re-researched.

Naming: the instruments studied here are the ones coded `project` and
`canvas` in `src/techne/instruments.ts` (M0′/M1′ in the constellation table);
the owner is relabelling the set M5-0′…M5-5′ — the same two instruments under
the new numbering. Companions to this document, written in the lane's third
run: `RE-TARGETS.md` (candidates, possession, chosen RE targets) and
`TARGET-SET.md` (the owner deliverable, 21 numbered features).

## Headline

The cradle has **two M1′ Canvas bodies and one is dead code**:

1. **The live Canvas** — a vendored third-party canvas ("Research Canvas",
   Antichrist Project rev `7df35f822f92…`, xyflow/react 12.8 based) mounted
   inside the hosted Expressions app as the `canvas` lens, with a genuinely
   mature native-backed feature set (frames, named views, notes/images,
   strokes, align/distribute, group move as one native write, semantic zoom,
   blueprints). It saves through `oi.research-scene/v1` presentation material
   inside the kernel-held native Expression document.
2. **The dead model** — `src/techne/m0m5/canvas/` (store/view/interactions/
   layout/selection/proposal/agency): pure, well-lawed, **referenced by no
   component anywhere in the tree** (grep evidence below). Its view store is
   explicitly in-memory with persistence deferred to "the Cradle's seam, not
   this module's" (`view.ts:343-346`) — and no seam was ever built. The
   instrument rail it would serve (`src/techne/instrumentRail.ts`,
   `src/techne/instruments.ts`) is likewise consumed by nothing.

M0′ Graph is one honest pipeline (kernel `graph-reading` → KnowledgeSurface,
canvas-2d renderer, worker force layout) with saved views, travel history and
a real graph→Technè identity handoff — but its renderer is home-grown 2D with
no minimap, no search-in-canvas UI, no grouping/frames, and its identity hop
into the hosted field is one-way in places.

---

## §1 The instrument constellation as coded

- Six deep instruments M0′–M5′ are declared vocabulary:
  `src/techne/instruments.ts:29-36` (`project`, `canvas`, `timeline`,
  `journey`, `place`, `palace`; M0′ = "Project · Wiki · Graph", M1′ =
  "Canvas · Constellation").
- A rail state module exists — `src/techne/instrumentRail.ts` (active tab in
  localStorage `oi-cradle.techne.instrument-rail.v1`, pin/orientation
  geometry, lines 27–60) — but **`DEEP_INSTRUMENTS` /
  `subscribeInstrumentRail` / `getInstrumentRail` have no consumer anywhere
  outside `instruments.ts`/`instrumentRail.ts` themselves** (grep over
  `src/**/*.{ts,tsx}`, this session). The six-tab rail is not rendered.
- What actually mounts as "Technè" is `TechneCentre`
  (`src/techne/TechneCentre.tsx:87-93`, wired via
  `src/contributions/core/descriptor.tsx:5,14-15`), which hosts the
  **Expressions application** in an iframe
  (`PointCloudHost`, `src/expressions/PointCloudHost.tsx:54-90`) in
  `mode="techne"`.
- Inside that hosted app, the six instruments exist as **lenses**
  (`field-studies-journeys/src/app.ts:940` — the host-command lens set is
  exactly `['project','canvas','timeline','journey','place','palace']`;
  `app.ts:986-1018` maps each lens to its instrument surface; the Canvas lens
  opens research instrument `m1` at `app.ts:1013`).

Confidence: high (direct reads). Limitation: the hosted app is large
(`app.ts` >1,100 lines); lens plumbing was traced, not exhaustively read.

## §2 M1′ Canvas today

### 2a. The live Canvas — vendored Research Canvas in the hosted app

Provenance (vendored tree `expressions-app/vendor/research-canvas/`):
- `README.md` (vendored copy, read this session): source intake from
  "Research Canvas / Antichrist Project", revision
  `7df35f822f9235331a69940cdaf484fe4a0b95c1`; `PROVENANCE.json` records
  upstream SHA-256s and the one explicit adaptation
  (`patches/read-only-capability.patch`). Static dependency closure of
  `CanvasView`, `TimelineSurface`, `PsychogeographicMap`,
  `StreetViewSurface` only. Runtime deps: `@xyflow/react ^12.8.5`,
  `maplibre-gl ^6.2.0`, `perfect-freehand ^1.2.2`, `zustand ^5.0.8`,
  `zod ^4.1.11`, `@blocknote/* ^0.39.1`. The O:I engine supplies native
  construction/selection/repository ops; **semantic mutations refuse;
  layout changes stay on the transport instance**.
- Mount: `field-studies-journeys/src/researchInstruments.tsx:7` imports
  `CanvasView, TimelineSurface, PsychogeographicMap, StreetViewSurface`
  from `../../vendor/research-canvas/components`.

What the live Canvas can do today (all in `researchInstruments.tsx` unless
noted; line numbers from this session's read):
- **Cards and notes**: note cards, image cards (≤192 KiB, data-URL), image
  captions (`:401`, `:486-489`); card width/height resize (`:456`); card
  colours (dot/bg/text, `:458`); duplicate (`:457`); delete (`:497`).
- **Connections**: create with relation kind + directionality (`:499`),
  reconnect (`:500`), delete (`:501`), change kind (`:502`), cycle
  directionality (`:503-507`); source-owned relations are read-only
  (`ownConnection`, `:308`; `isEdgeReadOnly` `:485`).
- **Frames** (presentation groups over occurrence refs): save from
  selection (`saveFrame`, `:383`), select members / bring to front / send to
  back / remove via Studio select (`:439-440`); z-ordered (`:375-376`).
  Documented law: "presentation-only visual grouping … never a
  membership/semantic record" (`researchMaterial.ts` header of
  `ResearchFrame`).
- **Named views**: save camera + selection + frame order (`saveView`,
  `:385`), apply (`applyView`, `:386`, restores camera and selection),
  remove (`:435-436`); plus a single anonymous "current view" slot (`:432`).
- **Freehand strokes**: draw/erase with colour (`:411-413`, `:490-494`).
- **Multi-select and group ops**: shift/ctrl extend (`selectMulti`,
  `:343-352`), xyflow box selection (`boxSelectionComplete`, `:391-395`),
  group drag reported per-member by the patched canvas and batched into
  **one native write per gesture** (`applyGroupOverrides`, `:269-285`;
  `host.moveMany` `:135`), align (6 modes, `:414-415`), distribute h/v
  (`:416`), nudge with shift step (`:251-264`).
- **Snap**: grid snap only (`snapToGrid` toggle `:417`, applied at
  `:527`, `:530`, quarter-unit grid).
- **Semantic zoom**: `semanticZoomLevel(viewport.zoom)` from the vendored
  canvas's own viewport reporting — `constellation|named|detailed`
  (`:477-483`; model at cradle `src/techne/m0m5/canvas/interactions.ts:271-287`).
- **Blueprints** (QL sixfold whole): one transform act for move/rotate/scale
  (`BlueprintWholeControls`, `:70-99`; `transformBlueprint` `:170`),
  release (`:173`), per-entity world pin (`:178`, enforced in `moveMany`
  app.ts `:1090`).
- **Member paging**: large constellations page their members through the
  native working document (`:421-424`, `host.pageMembers` `:121`).
- **Knowledge relation authoring**: an explicit "Record as constellation
  relationship" act through the native constellation op — never automatic
  (`RelateKnowledgeAction`, `:44-62`).
- **Sequencing walk**: session-local edge flags + a fly-through "play"
  (`:508-520`), explicitly not native.
- **Undo/redo**: host-level (`app.ts:693-694`) via the working-document
  store.

### 2b. The dead model — `src/techne/m0m5/canvas/`

Well-documented, tested modules with a strict presentation/semantic law —
and no UI consumer (grep for `computeLayout|semanticZoomLevel|lassoSelect|
canvasAgencyState|memberSelection` outside the canvas dir: zero hits):

- `view.ts` — `CanvasView` artifact: view_ref in
  `ql.techne:view:canvas:` namespace (`:82-88`), subject/reading/snapshot
  basis carried (`:69-72`), placements ref-keyed unit-space (`:35-39`),
  frames with z (`:43-49`), layout basis with QL warrant refs (`:54-61`),
  strict closed-key validation (`:247-315`), drift reporting
  (`viewDrift`, `:142-149`), **in-memory store with persistence explicitly
  deferred** ("Durable persistence … is the Cradle's seam, not this
  module's", `:343-346`).
- `layout.ts` — deterministic ql-constellation/radial schemes from declared
  sixfold positions, never index-guessed (`:119-177`); manual overrides
  presentation-only (`:182-190`).
- `interactions.ts` — lasso (centre-in-polygon), group moves, align/
  distribute, **snap-with-guides** (`snapPosition` returns guide lines,
  `:207-240`), bounds, semantic zoom thresholds (`:271-287`).
- `selection.ts` — the one-field identity model for canvas clicks:
  derived selection refs (`member|whole|relation` forms, `:37-47`), source
  basis carried verbatim on every hop (`:61-81`).
- `proposal.ts` — typed relation proposals with minted
  `ql.techne:canvas-proposal:` refs, disclosed-vocabulary flagging,
  commit routed through the reading's own native Actions with receipts
  (`:191-223`); reject touches nothing (`:168-176`).
- `agency.ts` — structured Canvas state for situated Agencies (`:103-189`).

**Relationship between the two bodies**: none at runtime. The live canvas
satisfies the same law (presentation material distinct from semantic
relations, native-owner commit) through `oi.research-scene/v1` + host
actions; the dead model encodes the same law purely, one layer further from
the UI. The dead model's unique unused assets: snap-with-guides geometry,
QL-warrant layout basis, proposal receipts, agency disclosure, view
artifact validation.

## §3 M0′ Graph today

- **Reading** (Rust): `KernelOp::Graph` → `oi.cradle.graph-reading/v1`
  assembling three owner inputs (central wiki, AIKit resolution/native,
  Shared Field) with honest `available|unavailable|deferred` states and
  budgets (4096 nodes / 16384 edges default) — `kernel/src/graph.rs`
  (`assemble_selected` line 285; per integration-map, verified this session
  via the front-end mirror `src/knowledge/graph.ts:15` which types
  `inputs` and `unresolved_links`). The front-end mirror
  (`src/knowledge/graph.ts:21-26`) already carries `unresolved_links` and a
  `wiki_links` input name — landing ground for the Obsidian T1–T7 graph
  backlog.
- **View**: `KnowledgeSurface.tsx` — travel history (visits with camera,
  filters, page state; localStorage
  `oi-cradle.knowledge-travel.v1:<binding>`, `:53-66`), **saved graph
  views** (`SavedGraphView {name, filters}`, `filters.ts:136-141`),
  filters with depth/direction/kinds/relations/isolated, emphasis groups.
- **Renderer**: `GraphCanvas.tsx` — hand-rolled canvas-2d, one rAF loop,
  hover-neighbour emphasis, animated flow dots on hover, label collision
  avoidance (`labelBoxes`), camera travel with easing, reduced-motion
  respected (`GraphCanvas.tsx:20-70`). Camera bounds zoom 0.15–4
  (`camera.ts:2`).
- **Layout**: d3-force in a web worker (`layout.worker.ts`, `useLayout.ts`).
- **Construction**: `WikiConstructionPanel` + passages
  (`src/knowledge/selection.ts` — `oi.wiki-passage/v1`, byte-selector
  provenance, revalidation against source revision) — the owner-side route
  from graph/source text to a new constellation.
- **Identity handoff graph→Technè**: `techneHandoff.ts:15-56` — the SAME
  native subject opens through the one Wiki projection state's selection ask
  (origin "external"); a constellation opens whole on the Canvas lens; a
  member opens inside its carrying Scene. "No export, no second canvas."
- A second, separate graph-shaped view exists:
  `src/explore/EncounterGraph.tsx` (the integration-map's hazard #3: the
  single graph seam must not fork).

## §4 Navigators

- `WikiMapNavigator.tsx` — the Central-rooted wiki tree (registers →
  constellations → members, paged 24 at a time `:354`), one projection
  state, creation row for new constellations through
  `aikit.constellation.apply` (`:277-346`), relation-recovery preview/apply
  (`:176-196`), "Project in Instrument 0" act (`:229-232`), elsewhere-rows
  for unplaced nodes (`:419-429`).
- `MaterialNavigator.tsx` — 173 lines; material item list feeding the lens
  host (`src/techne/lens.ts` registers lenses; `lenses.tsx` holds the real
  ones).
- `TechneCentre.tsx` — hosts the field; publishes wiki registers; opens the
  default wiki; answers `techneWorld` list/open and `readTechne`
  (`:76-86`).

## §5 How canvas documents save today

The canvas has **one durable document**: the native Expression (kernel-held,
`oi-material://`-served, committed through `nativeWorkspace.commit()`).
Inside it, presentation material is the `oi.research-scene/v1` record
(`researchMaterial.ts:27-33`):

```text
ResearchMaterial {
  schema:'oi.research-scene/v1';
  cards: {id → note|image card: content ≤64KiB BlockNote blocks, caption,
          colours, display size};      // validated, bounded
  strokes: freehand strokes;            // perfect-freehand points
  views: {key → viewport};              // anonymous camera slots (canvas/timeline/place)
  timeline: {id → lane/offset/size/layoutRevision};
  frames: {id → label, memberRefs, z};  // presentation grouping, never semantics
  namedViews: {name → viewport, selectedRefs, frameOrder};
}
```

Properties of the save path (evidence):
- **Occurrence-ref law**: frames and named views store **native occurrence
  refs**, not copies; a removed occurrence is pruned from every frame and
  saved-view selection (`pruneResearchOccurrence`,
  `researchMaterial.ts:59-70`) — the drift-reporting idea of the dead
  model, implemented as silent pruning instead.
- **One gesture = one native write**: group drags/nudges/aligns batch
  through `GestureTransaction` (`canvasGesture.ts`) + `host.moveMany`
  (`researchInstruments.tsx:269-285`, `app.ts:1090`); the queued-edit guard
  refuses a save when the native composition changed under it
  (`researchInstruments.tsx:299`).
- **Commit is acknowledgement-gated**: `commitResearch()` throws if "The
  native owner did not acknowledge this edit. Your working draft is
  retained." (`app.ts:1070`); undo/redo re-commit (`app.ts:693-694`).
- **Read-through protection**: a view reading through an acting Agent
  refuses to commit into it (`nativeWorkspace.ts:255`).
- **What never saves there**: semantic relations (typed relation writes go
  through `host.connect`/`relateKnowledge` → native constellation op, with
  receipts), positions of source-bound occurrences go through
  `host.move` (native entity positions, clamped ±50, `app.ts:1087`).

**Gaps in saving**: no autosave/heartbeat (commit is per-action), no
canvas-document export/import (nothing reads or writes Obsidian `.canvas`
or any interchange format), no per-view persistence of stroke/zoom
disclosure state beyond the material record, and the dead model's
`CanvasView` artifact (validation, drift report, QL layout basis) never
reached a durable seam.

## §6 How navigation preserves subject identity today

Working today (evidence):
- **Graph → Technè field**: `techneHandoff.ts` — same subject_ref, exact
  scene/entity refs, lens chosen by role (whole → Canvas lens), via the ONE
  wiki projection selection ask. Comment law: "No export, no second canvas
  … returns to the graph by reference, never by re-import" (`:1-6`).
- **Wiki map → field**: `requestWikiSelection` with scene/entity/subject
  refs and origin (`WikiMapNavigator.tsx:160-161`); created constellations
  open on the Canvas lens (`:320`).
- **Canvas → source**: card "Open source" opens the occurrence's
  `subject.subject_ref` (`researchInstruments.tsx:453`); double-click
  opens the subject (`:525`).
- **Hosted field → cradle selection**: `host.select(sceneId, entityId)`
  writes the native document selection (`:309`, `:524`); focus seeds the
  canvas selection on load (`:543-548`).
- **Within one reading** (dead model): `selection.ts` derives stable
  selection refs and carries the source basis verbatim — the spec the live
  paths approximate.

Fails / one-way today:
- The cradle-side instrument rail (six tabs) does not exist as UI, so
  "switch instrument" is a lens switch inside the hosted app only; the
  cradle's own M0′ surfaces (KnowledgeSurface, FileSurface) are separate
  bindings, reachable but not co-referenced through any rail state.
- Canvas → graph has no hop: from a constellation on the Canvas lens there
  is no "show this subject in the M0′ graph" act (the reverse direction
  exists via techneHandoff).
- Saved-view application restores camera + selection but does not carry a
  subject_ref basis (no drift report when the scene's members changed —
  pruning silently drops, §5).

## §7 Named gaps (vs a Miro-class composed surface and the lane law)

Craft bars, not compliance ticks (per the expression-audit law):

1. **Snap-with-alignment-guides is absent from the live canvas** — grid
   snap only. The pure geometry exists (`interactions.ts snapPosition`
   with guides) but was never wired. Miro/tldraw's centre/edge alignment
   guides are the reference behavior.
2. **Connector routing is primitive** — straight xyflow edges with one
   directionality; no orthogonal/elbow routing, no per-connector style
   (curved/stepped), no edge labels, no connector midpoints/waypoints.
3. **No shape vocabulary** — cards (note/image) only; no sticky-note
   palette, no basic shapes (rect/ellipse/diamond), no standalone text
   objects, no emoji/tag chips on cards.
4. **No presentation mode** — frames order drawing, not narrative; no
   frame-by-frame present/slideshow over saved frames (Miro Present /
   tldraw sequence).
5. **No minimap / zoom-to-fit UI / zoom controls** on the canvas (the
   graph has camera travel but no minimap either).
6. **No canvas document interchange** — nothing imports/exports `.canvas`
   (Obsidian) or any open whiteboard format; no image/PDF export of a
   frame or view.
7. **No embeds** — image cards only; no web/iframe embed cards, no
   media (audio/video) cards.
8. **Two canvas bodies, one dead** — the `m0m5/canvas` model (snap guides,
   QL layout basis, proposals, agency state, view validation/drift) is
   stranded; the live canvas lacks exactly what the dead model has.
9. **Canvas → M0′ graph hop missing** (§6).
10. **Graph gaps**: no minimap, no in-canvas search jump UI, no
    grouping/regions, no edge labels on canvas (relation vocabulary is
    verbatim data with no visual carrier), zoom ceiling 4× for large
    fields, `unresolved_links` present in the reading type with no
    renderer usage yet.
11. **Obsidian backlog T1–T7** (unresolved-link nodes, embed resolution,
    heading/block subpaths, alias resolution, etc.) lands at this same
    graph seam — carried, not re-researched here.
12. **Stillness/craft**: the canvas tool row is icon-led with an existing
    24×24 stroke language (`researchInstruments.tsx:25-30`) — enrichment
    must keep that grammar and the audit's restraint law (text by
    exception, no metadata on the stage).

## §8 Method + verification record

- Read this session (all read-only): the files cited above under
  `desktop/cradle/src/techne/` (instruments, instrumentRail, TechneCentre,
  WikiMapNavigator, lens, m0m5/canvas/*), `src/knowledge/` (graph,
  GraphCanvas, KnowledgeSurface, camera, selection, filters, techneHandoff),
  `src/expressions/PointCloudHost.tsx`,
  `expressions-app/field-studies-journeys/src/` (app.ts excerpts,
  researchInstruments.tsx full, researchMaterial.ts head, nativeWorkspace.ts
  excerpts), `expressions-app/vendor/research-canvas/` (README, tsconfig
  path mapping), `docs/experience/TECHNE-DUAL-READING.md` (§2 table, §3
  identity law, TD2, §7).
- Greps: canvas-model consumers (zero outside module), `DEEP_INSTRUMENTS`/
  rail consumers (zero outside module), lens set in `app.ts`,
  `commitResearch`/`moveMany`/`material(` in `app.ts`.
- Not read exhaustively: the vendored canvas packages' internals
  (`vendor/research-canvas/packages/*`, cited via its README + facade);
  `EncounterGraph.tsx` beyond its existence; hosted-app CSS.
- No product tree was modified. Scratch and captures for the RE half of
  this lane live outside product trees and are cited in RE-TARGETS.md.
- Third run (same day, RE phase): all §2–§6 anchors re-verified against
  disk with fresh greps and found accurate; additional confirmed anchors
  used by TARGET-SET.md — `saveFrame` `researchInstruments.tsx:383`,
  `saveView`/`applyView` `:385-386`, snap toggle `:417`, snap application
  `:527/:530`, `researchMaterial.ts:26-29,68,76-78,81`,
  `interactions.ts:207-239` (guides), `graph.ts:15` (`unresolved_links`),
  `app.ts:1014` (canvas lens → `m1`); grep confirms `GraphCanvas.tsx`
  carries no minimap or search (§7.5/§7.10 gaps stand). RE evidence and
  possession: RE-TARGETS.md §§1,3,5.
