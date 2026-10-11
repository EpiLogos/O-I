# Canvas editor receiving packet

`CanvasEditor` is a named React export. Props: `depth: 'compact' | 'full'`, retained `ResearchInstrumentsHost`, optional `target: {mode:'follow'|'pin', sceneId?:string}`, `revision`, `visible`, `onInspectGraph(subjectRef)`, actual native `onCheckpoint()` callback, and `onDraftChange(pending)` for the common frame's target-transfer guard. Parent publishes `revision` after native owner updates. Pin requires the exact view Scene ID; it never resolves a name or list index. The receiving host must be the retained app's real `ResearchInstrumentsHost`, not a shell-created reduced model.

The compact face draws `nativeInstrumentCanvas` directly. Pointer gestures preview locally and dispatch once through `moveMany`; an owner without atomic group movement refuses a multi-selection move. Captured Expression/Scene/revision guards refuse a changed gesture basis and retain the intended positions. Cancel discards presentation draft. Coordinates convert through `CANVAS_UNITS` exactly as the retained Canvas. `pinEntity` takes the native entity ref; move/material/select take the retained view occurrence ID. Blueprint whole move/rotation/scale reuse the mature controls' exact translation step 20, rotation step π/12 and scale ratio 1.1. No unsupported schema fields or wire verbs are introduced.

The full face dynamically adopts `installResearchInstruments(host).open('m1')`. This keeps the native notes/images, rich notes, draw/erase, lasso/multi-select, move/resize, align/distribute, grid, frame membership/order, saved views, connection/reconnect/directionality, source inspection, native relation recording and blueprint controls. Renderer, tool, inspector and Canvas Studio slots are local DOM receiving destinations. After first expansion the actual full graphics remain mounted while hidden; changing depth does not recreate the model owner. CSS provides bounded full/700px layouts. Host replacement or actual target replacement disposes the local renderer.

Source adoption is Step B reuse of the already adopted Research Canvas/xyflow body, native model/material and native gesture repertoire in this tree. tldraw remains study-only; no code/assets from tldraw, Excalidraw, Miro, Obsidian or Ableton enter the module. The programme licence classifications still govern reference-source adoption. The actual Ableton original `docs/research/ableton-live-12.0.25/evidence/ui/live-wavetable-device-panel.png` was visually inspected: dense bottom operation graphics, small precise controls and selection accent inform the compact face. Obsidian captured original screenshot was not recovered from its campaign index; bundle contracts and target set were read, screenshot parity remains open.

## Integration requirements

Reuse installed `desktop/cradle/node_modules` React/React DOM and `desktop/cradle/expressions-app/node_modules` native renderer dependencies. The adopter's TS/Vite configuration needs the existing field-studies aliases, resolved at the repository root:

| Alias | Existing source |
| --- | --- |
| `@research-canvas/schema` | `desktop/cradle/expressions-app/vendor/research-canvas/packages/schema/src/index.ts` |
| `@research-canvas/domain` | `desktop/cradle/expressions-app/vendor/research-canvas/packages/domain/src/index.ts` |
| `@research-canvas/desktop-api` | `desktop/cradle/expressions-app/vendor/research-canvas/packages/desktop-api/src/index.ts` |
| `@research-canvas/geography` | `desktop/cradle/expressions-app/vendor/research-canvas/packages/geography/src/index.ts` |
| `@research-canvas/viewers` | `desktop/cradle/expressions-app/vendor/research-canvas/packages/viewers/src/index.ts` |
| `@research-canvas/node-document` | `desktop/cradle/expressions-app/vendor/research-canvas/packages/node-document/src/index.ts` |
| `@research-canvas/exporter` | `desktop/cradle/expressions-app/vendor/research-canvas/browserExporter.ts` |

No body/clock/document/frame ownership is transferred. Parent checkpoint callback must retain its native save/recovery distinction. `onInspectGraph` must route the exact subject to the parent's canonical graph and preserve the Canvas return view. Absent callbacks offer no corresponding success.

## Exact lane-1 target coverage

All are implementation coverage, not native acceptance passes. None of the 21 targets closes from unit/source adoption evidence alone.

| Qualified identity | Current implementation and remaining source-bound work |
| --- | --- |
| lane-1:A1 | Compact centre/edge snap with eight-screen-pixel threshold and transient guides; grid separate. Equal-gap rhythm and full renderer overlay hook remain. |
| lane-1:A2 | Native note/image repertoire retained. Sticky/basic shape/text schema vocabulary requires native ResearchCard union/validator/action changes. |
| lane-1:A3 | Native semantic connection kinds retained. Presentation curved/elbow/label overlay needs owner material grammar and renderer patch. |
| lane-1:A4 | Native connect/reconnect retained; explicit persisted side binding needs owner/renderer hook. |
| lane-1:A5 | Compact viewport rectangle minimap with pointer jump/drag. Full renderer camera hook and shared Graph feed remain. |
| lane-1:A6 | Compact fit-all/selection, ±/0 keys, pointer zoom and size-aware fit. Full renderer camera hook and transient percentage remain. |
| lane-1:A7 | Compact search text/native titles with Enter/next selection and fit. Frame-title search and previous/full overlay remain. |
| lane-1:A8 | Compact explicit fullscreen ordered frame walk, arrows and Escape with retained editor camera restoration. Full renderer camera hook and native rendered acceptance remain. |
| lane-1:A9 | Compact authored frame heading. Full renderer heading/in-place title edit remains. Existing native frame label already persists; no invented title field. |
| lane-1:A10 | Existing native image material retained. Embed/media card validation/creation needs native-owner extension. |
| lane-1:B1 | Existing ack-gated per-action owner callbacks retained. Autosave/quit/lens-switch schedule belongs to native workspace, remains open. |
| lane-1:B2 | `.canvas` import/export remains open; import needs native occurrence creation with complete side/label mapping. |
| lane-1:B3 | Frame PNG export remains open; exact native Canvas raster/export hook required. |
| lane-1:B4 | Existing saved native views retained. Tombstone/drift material grammar needs native owner. |
| lane-1:C1 | Canonical Graph owner's unresolved-node work, independently reviewed separately. |
| lane-1:C2 | Canonical Graph navigation/minimap owner; shared feed remains. |
| lane-1:C3 | Compact exact-subject Graph callback offered only when parent supplies canonical route; full context hook remains. |
| lane-1:C4 | Graph edge vocabulary on hover/emphasis belongs to the canonical Graph renderer; no Canvas wrapper closure claim. |
| lane-1:D1 | Six-instrument rail belongs to parent shell/mode boundary; same-subject Canvas→Timeline→Graph navigation remains native acceptance. |
| lane-1:D2 | Saved-view subject basis requires `ResearchNamedView` native owner/validator changes; retained current saved views are preserved, new basis fields remain open. |
| lane-1:D3 | Graph saved-camera views belong to native Graph saved-view model/validator and receiving apply path; independent Graph review checks this separately. |

## Native-owner patches needed to complete retained full target set

An additive public return API from `installResearchInstruments`: `getViewport(): ResearchViewport | null`, `setViewport(viewport): void`, `focusNode(nativeEntityRef): void`, `getCanvas(): InstrumentCanvas | null`, and a viewport-change subscription. These forward the existing captured `captureCanvas`/`flyToNode` callbacks and native canvas reading; they do not create an engine, a new camera model or wire operation. Parent owns native file changes. This hook permits the compact camera tools/minimap/presentation to act over the retained full Canvas.

ResearchCard/action schema extensions for A2/A3/A4/A10 and saved-view drift B4 belong to `researchMaterial.ts` plus kernel admission/persistence validation. B1 native scheduling belongs to `commitResearch`/NativeWorkspace. B2 needs native authoring operations that allocate real occurrence identities. B3 needs native Canvas exporter/raster access. These cannot be faithfully completed inside a receiving-only module by inventing local persistence.

Tests: `node --experimental-strip-types --import ./desktop/cradle/tests/ts-register.mjs packages/instrument-editors/tests/canvas-run.mjs` passed 8/8, zero failures/skips. Guard fixtures only test refused/wrong/stale addresses; no native acknowledgement is mocked. Geometry and adopted material tests import real implementation. Native kernel 4180 `/state` read succeeded with empty current focus; live Scene/save/reopen activity and full rendered native acceptance remain to execute through the parent's entrance.
