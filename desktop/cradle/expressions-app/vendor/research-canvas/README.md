# Research Canvas source intake

The implementations come from Research Canvas / Antichrist Project,
revision `7df35f822f9235331a69940cdaf484fe4a0b95c1`. `PROVENANCE.json` records every
upstream source SHA-256 and every explicit adaptation; the private collaborator
notice is retained as `LICENSE`.

This is the static dependency closure of the actual CanvasView, TimelineSurface,
PsychogeographicMap and StreetViewSurface components, their offline geography
pack, and their styles. It does not mount Research Canvas's separate application,
public viewer, SQLite store, backend or workspace provider. The O:I engine supplies
its own actual native construction, selection and repository operations.

`components.ts` is the O:I host export facade. `browserExporter.ts` exposes the
existing pure Markdown converters needed by the viewer, keeping the unrelated
native file-export runner out of browser module loading. These files and this
README are O:I overlays. The upstream `techneBundle` and `techneTransport`
adapters project native readings without a database, preserving native refs.
Semantic mutations refuse; accepted layout changes stay on that transport
instance only and are not durable. Hosts must not call the separate standalone
application transport factory.

`patches/read-only-capability.patch` is the explicit adaptation to CanvasView and
its node/edge renderers. Pass `readOnly` when the native owner supplies no writes.
Selection, opening content, zoom and scene playback remain available; dragging,
connections, resizing, caption/note/edge editing, drawing and mutation menus or
shortcuts are withheld. The manifest keeps both upstream and adapted hashes.

Resolve `@research-canvas/{schema,domain,desktop-api,geography,viewers,node-document}`
to the respective `packages/<name>/src/index.ts` here. Resolve
`@research-canvas/exporter` to `browserExporter.ts`. Import `components.ts` directly;
the whole upstream canvas barrel and unrelated instruments are intentionally not
copied. Use the engine's single React19 instance.

Runtime dependency requirements are recorded in the copied package manifests:
`@xyflow/react ^12.8.5`, `maplibre-gl ^6.2.0`, `perfect-freehand ^1.2.2`,
`zustand ^5.0.8`, `zod ^4.1.11`, and `@blocknote/{core,react,mantine} ^0.39.1`.
The selected components do not use the separate Palace renderer or react-three.

Upstream styles are retained byte-exact for host review. The engine owns how they
are scoped; do not blindly apply the upstream application's global shell styles.
MapLibre's worker URL and offline pack assets remain part of the real component.

Run `node vendor/research-canvas/verify-source.mjs` from expressions-app to verify
source integrity. This is provenance evidence; functional acceptance still needs
the engine host and its native owner adapter.

Run `node vendor/research-canvas/tests/run-read-only.mjs` for real-component server
render checks using the installed React/ReactFlow/viewer dependencies, without
substitutes. Native interactive acceptance belongs to the integrated engine.

The optional `CanvasView.toolbarContainer` adaptation portals the existing zoom/fit/play toolbar into the host HUD and suppresses the duplicate ReactFlow Controls there. Omitting the prop retains the original standalone placement and controls. The source diff and adapted hash are recorded with the other capability overlays.

`patches/native-host-capabilities.patch` retains native read refusals as visible
errors with explicit retry. Hosted map/image views pass `offlineOnly`: this
omits live network controls and refuses local-policy activation; the host need
not construct a Research Canvas policy. `imageTitle` carries a native readable
label. Missing image metadata is not rendered as an automatic footer. These
are UI capabilities, not a new egress authority or source store.

`patches/host-selection-viewport-gesture.patch` adds optional CanvasView
capabilities the host previously worked around: `selectedNodeIds` drives real
multi-node `selected` state alongside the existing single `selectedNodeId`;
`onSelectionChange` (xyflow's own selection reporting) and `selectionOnDrag`
enable native box selection while a plain drag still pans when
`selectionOnDrag` is unset; `onViewportChange` reports xyflow's `onMove`/
`onMoveEnd` directly, so a host no longer needs to poll `captureCanvas()` on
an interval; `onMoveNodePreview`/`onMoveNodeEnd` fire on `onNodeDrag`/
`onNodeDragStop` for every dragged node (including a multi-selection), and
when supplied `onMoveNode` is not also called for that gesture. Every one of
these is optional and additive: omitting all of them keeps the exact prior
single-select, poll-driven, per-callback `onMoveNode` behaviour.

`patches/parallel-edge-curvature.patch` gives distinct native relation
occurrences on the same unordered node pair (e.g. a constellation's own
source relation and an O:I presentation connection between the same two
occurrences) their own curvature so neither steals the other's click. The
offset is computed inside `AnnotatedEdge` itself from xyflow's live edge
list (`useEdges()`); a pair with exactly one edge keeps the prior single
`getBezierPath` call, path and label placement byte-for-byte. No host prop
is required; nothing outside this one edge renderer changed.
