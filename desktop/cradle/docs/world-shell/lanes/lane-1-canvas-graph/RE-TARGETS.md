# Lane 1 RE targets — canvas + graph instruments

Lane: "miro/obsidian" (instrument 1): M0′ Project/Wiki/Graph + M1′
Canvas/Constellation as coded in `src/techne` (owner is relabelling the set
M5-0′…M5-5′; these are the `project` and `canvas` instruments of
`src/techne/instruments.ts:29-36`). Written 2026-10-07 (third run of this
lane; first-run FINDINGS.md verified complete and kept).

Method: `reverse-engineering-playbook`. Possession verified and recorded
per candidate; study/document only; target code stays in scratch clones
outside product trees; claims carry evidence (file:line or byte offset),
confidence, limitations.

## §1 Candidates surveyed — possession status

| # | Candidate | Possession | Status | License posture |
|---|---|---|---|---|
| 1 | **tldraw** (tldraw.com editor) | **Possessed, source**: shallow clone `/tmp/lane1-tldraw` @ `035b741dc331bf76a4cb9af27c346be10bba2a88` (monorepo v5.5.2, HEAD dated 2026-10-06). Read-only study this session. | **CHOSEN — primary** | tldraw License (source-available; watermark terms for production embedding). **Study-only**: behavior + contracts recovered, no code vendored into any product tree. |
| 2 | **Excalidraw** | **Possessed, source**: shallow clone `/tmp/lane1-excalidraw` @ `53973c3a423fbd75a4ce68107786b4fcb90e4968` (HEAD dated 2026-10-06). Read-only study this session. | **CHOSEN — co-target** | MIT. Study-only by the same guardrail (recreate in the cradle's own idiom; never copy code in). |
| 3 | **Obsidian Canvas** (`.canvas` document format + canvas behaviors) | **Possessed, app**: pinned Obsidian 1.7.7 at `/Applications/Obsidian.app` (CFBundleVersion 0.14.8), studied under the 2026-10-07 obsidian-re campaign; renderer bundle evidence re-read this session from that campaign's extracted asar (`ProjectCentral/now/tmp/obsidian-re-20261007/shared/obsidian-asar-extracted/app.js`). Format additionally corroborated by published docs. | **CHOSEN — interchange + behavior reference** | Proprietary app, openly documented format. Format facts quoted as short snippets with offsets. |
| 4 | **Miro** (web whiteboard) | **Not captured.** Web-only, auth-gated; this run's budget spent on source possession of 1–3. Public documentation cited instead. | **Aspiration bar only** — its behaviors name the reference class ("what a Miro-class surface owes"), never the clone target | n/a (no capture; no possession claim) |
| 5 | **xyflow / React Flow 12** | **Already in-tree**: the live Canvas is built on `@xyflow/react ^12.8.5` (vendored Research Canvas dependency, `expressions-app/vendor/research-canvas/README.md`). | Substrate, not an RE target — we RE *tldraw/Excalidraw behavior*, then recreate it *onto* this substrate | MIT (already a dependency) |
| 6 | Figma/FigJam, Mural, Lucidspark, MS Whiteboard | **Blocked-with-reason**: web/auth-gated, no legitimate offline possession for behavioral capture; live capture declined this run (rate limits + timebox). | Rejected | n/a |
| 7 | Obsidian canvas *community plugins* (e.g. canvas-extensions) | Out of scope: the lane references core Obsidian behavior only (obsidian-re campaign law). | Rejected | n/a |

## §2 Chosen targets, per feature family

**Primary pairing: tldraw + Excalidraw as the behavior sources, Obsidian
`.canvas` as the document interchange format, Miro (doc-cited) as the
aspiration bar — recreated onto the existing xyflow substrate inside the
hosted app, and onto `src/knowledge/` for the graph.**

Reasoning per family (each names the evidence that pins the behavior):

1. **Snapping & alignment guides** → **tldraw**. Its SnapManager
   (`packages/editor/src/lib/editor/managers/SnapManager/SnapManager.ts:35`,
   with `BoundsSnaps`/`HandleSnaps`) computes centre/edge snaps and
   equal-gap distribution guides, rendered via
   `SnapIndicatorOverlayUtil.ts:22`. Excalidraw corroborates the threshold
   model: `SNAP_DISTANCE = 8` screen px, `getSnapDistance = 8/zoom`
   (`packages/excalidraw/snapping.ts:41-50`), gap snapping
   (`getVisibleGaps`, same file `:328`). The cradle's dead model already
   has the thin version (`snapPosition` returning guide lines,
   `src/techne/m0m5/canvas/interactions.ts:207-239`) — tldraw/Excalidraw
   give the reference behavior to recreate around it.
2. **Connector kinds & routing** → **tldraw + Excalidraw**. tldraw arrow
   shape has `kind: 'arc' | 'elbow'`
   (`packages/tlschema/src/shapes/TLArrowShape.ts:21` — "Arrows can be
   drawn as arcs (curved) or elbows (angled with straight segments)") with
   a dedicated elbow router
   (`packages/tldraw/src/lib/shapes/arrow/elbow/getElbowArrowInfo.tsx` +
   `routes/`); labels are arrow props (examples
   `apps/examples/src/examples/editor-api/arrow-labels`). Excalidraw has
   elbow arrows (`packages/element/src/elbowArrow.ts`) bound to elements
   with a binding gap (`BASE_BINDING_GAP = 5`,
   `packages/element/src/binding.ts:117`) and re-anchoring
   (`reanchorBindingsToOutline`, `binding.ts:1219`). Obsidian's edges
   carry explicit sides (`fromSide`/`toSide`) — recovered from the
   possessed 1.7.7 bundle (§3, offset 2431562). The live canvas has
   straight edges with one directionality only (FINDINGS §7.2).
3. **Shape / sticky / text vocabulary** → **tldraw** for the shape enum
   (`GeoShapeGeoStyle`: rectangle/ellipse/triangle/diamond/… 18 values,
   `packages/tlschema/src/shapes/TLGeoShape.ts:40-62`) and sticky-note
   shape (color/size/font/align/labelColor,
   `packages/tlschema/src/shapes/TLNoteShape.ts:30-35`); **Excalidraw**
   for the minimal-element discipline (rect/diamond/ellipse/text/image/
   frame/embeddable, `packages/element/src/types.ts:115-231`). Miro's
   sticky palette and shape library (public docs; §4) set the craft bar.
4. **Minimap & zoom navigation** → **tldraw**: a shipped UI minimap
   (`packages/tldraw/src/lib/ui/components/Minimap/DefaultMinimap.tsx:23`,
   viewport-rect + click-to-jump via `MinimapManager`). The cradle canvas
   and graph both lack one (FINDINGS §7.5/§7.10).
5. **Frames & presentation** → **tldraw** frame shape with on-stage
   heading (`FrameShapeUtil.tsx:305` renders the frame name) + **Miro**
   frame-to-frame Present (public docs; §4). The cradle has saved frames
   (`saveFrame`, `researchInstruments.tsx:383`) but no present act.
6. **Embeds** → **Excalidraw**: first-class `embeddable`/`iframe` element
   types (`packages/element/src/types.ts:115-140`). Cradle has image cards
   only (FINDINGS §7.7).
7. **Document save & interchange** → **Obsidian `.canvas`** as the open
   interchange target (format in §3), **Excalidraw** for the document
   shape (`serializeAsJSON`: `{type:"excalidraw", version, source,
   elements, appState, files}`,
   `packages/excalidraw/data/json.ts:52-61`) and its local-first
   save discipline, **tldraw** for snapshot discipline
   (`getSnapshot`/`loadSnapshot`,
   `packages/editor/src/lib/config/TLEditorSnapshot.ts:33,96`). All of it
   maps onto the one durable cradle document (`oi.research-scene/v1`,
   `researchMaterial.ts:26-29`) — never a second semantic store.
8. **Shortcuts/tool grammar** → **tldraw** ships a keyboard-shortcuts
   surface (`packages/tldraw/src/lib/ui/hooks/useKeyboardShortcuts.ts`,
   dialog `DefaultKeyboardShortcutsDialogContent.tsx:30-178`); Excalidraw
   ships single-key tool activation (published shortcut list; keyTest
   pattern). Reference behavior for one-key tool switching on the canvas.
9. **Graph navigation** → **Obsidian graph** behaviors are already the
   researched bar (obsidian-re A3, backlog T5 realized); the remaining
   graph-side gaps (ghost unresolved nodes rendered, local-neighbourhood
   hop from canvas) land at the single seam `KernelOp::Graph` +
   `src/knowledge/graph.ts:15` (`unresolved_links` already typed).

## §3 Obsidian `.canvas` format — direct evidence from the possessed app

From pinned Obsidian 1.7.7 renderer bundle `app.js` (2,989,294 bytes;
byte offsets from `grep -bo` this session, scratch path above):

- **Edge fields** — the canvas edge loader reads `g.id, g.fromNode,
  g.fromSide, g.fromEnd, g.toNode, g.toSide, g.toEnd`, defaulting absent
  sides/endings from the node geometry (offset **2431562**):
  `var y=(h=g.id,g.fromNode),b=g.fromSide,w=g.fromEnd,k=g.toNode,C=g.toSide,M=g.toEnd;… b||(g.fromSide=b=dZ(S,x)),C||(g.toSide=C=dZ(x,S))`
  (snippet mid-statement, minified). So: edges are
  `{id, fromNode, toNode, fromSide, toSide, fromEnd?, toEnd?, color?,
  label?}` with side values over the four card sides.
- **Node types `file` / `link`** — canvas drag-out serialises by node
  type: `"file"===t.type` → `generateMarkdownLink(t.file, n)`;
  `"link"===t.type` → linktext with `YE(t.linktext).subpath`
  (offset **1171612** cluster). Corroborates nodes as
  `{id, type:"text"|"file"|"link"|"group", x, y, width, height, …,
  subpath?}` per the published format docs.

Confidence: high for edge fields (direct bundle read), high for the node
geometry/type set (bundle + published docs agree). Limitation: the
node-side JSON keys (`text`, `file`, `url`, `color`, group `label`) were
not isolated at byte level this session (minified bundle, timebox);
they follow the documented format and a `/tmp` vault experiment is the
named follow-up if a gate ever needs byte parity.

## §4 Miro — cited public documentation (not captured)

Miro's role here is the aspiration bar for three behaviors, cited from its
public help/developer documentation without live capture: sticky-note
palette with colour set; connectors of straight/elbow/curved shapes with
labels and captions; frames as presentable sequences (Present mode walks
frame to frame). Confidence: medium-high (stable, widely documented
behaviors). Unverified-live: all of it — no capture was performed this
session (rate limits + timebox); named, not hidden. Nothing in the target
set depends on a Miro-only mechanism; every entry has a possessed
source-behavior behind it.

## §5 Evidence index (this session)

- `/tmp/lane1-tldraw` @ `035b741dc331bf76a4cb9af27c346be10bba2a88` —
  SnapManager.ts:35; BoundsSnaps.ts; SnapIndicatorOverlayUtil.ts:22;
  TLArrowShape.ts:21 (kind 'arc'|'elbow'); arrow/elbow/
  getElbowArrowInfo.tsx; TLGeoShape.ts:40-62 (geo enum);
  TLNoteShape.ts:30-35; TLFrameShape.ts; DefaultMinimap.tsx:23;
  FrameShapeUtil.tsx:305; TLEditorSnapshot.ts:33,96;
  useKeyboardShortcuts.ts; DefaultKeyboardShortcutsDialogContent.tsx.
- `/tmp/lane1-excalidraw` @ `53973c3a423fbd75a4ce68107786b4fcb90e4968` —
  snapping.ts:41-50 (SNAP_DISTANCE=8, getSnapDistance), :328, :616, :692;
  element/src/types.ts:115-140 (embeddable/iframe), :178-189 (frame);
  element/src/binding.ts:117-1219; element/src/elbowArrow.ts;
  data/json.ts:52-61 (serializeAsJSON).
- Obsidian 1.7.7 `app.js` (extracted asar, prior campaign scratch,
  read-only) — offsets 2431562 (edge fields), 1171612 (file/link node
  types), 745008 (`.canvas` as a core file extension).
- Cradle seams re-verified this session (line numbers as read today):
  `researchInstruments.tsx:383,385-386,417,435,527,530`;
  `researchMaterial.ts:26-29,68,76-78,81`;
  `src/techne/m0m5/canvas/interactions.ts:207-239`;
  `src/knowledge/graph.ts:15`; `app.ts:1014` (canvas lens → `m1`);
  `GraphCanvas.tsx` (grep: no minimap/search — gap confirmed).

## §6 Unverifieds and limitations (named)

- No Miro live capture (§4). No Obsidian `.canvas` write-experiment in a
  `/tmp` vault this session (format follows docs + bundle evidence).
- tldraw/Excalidraw studied at one HEAD each (2026-10-06); version drift
  upstream is possible but both behaviors used here (snap model, arrow
  kinds, binding gap) are long-stable.
- The vendored Research Canvas internals (`vendor/research-canvas/
  packages/*`) remain cited via its README + facade only (as in
  FINDINGS §8) — the RE here targets behavior to recreate, not the
  vendored code to modify beyond its documented capability patch seam.
- Keyboard-shortcut key maps were confirmed structurally (dialog +
  published lists), not exhaustively transcribed; the target set pins the
  grammar, not each binding.
