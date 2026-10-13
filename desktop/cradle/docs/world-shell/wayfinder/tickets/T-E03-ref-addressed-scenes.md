# T-E03 — Scene operations address refs; the index is a derived view

Label: wayfinder:task (Phase 4 · lane 3; no UI leg)
Claimed-by: claude-code:dlw-lead (13 Oct 2026; builder haiku)
Source: `lanes/lane-3-expressions-editor/TARGET-SET.md:151` (register `lane-3:E03`).

## Lead's design

`desktop/cradle/expressions-app/field-studies-journeys/src/app.ts`: the
public disclosure already takes a ref (`__FIELD_STUDIES__.setScene`,
`:1111`, `focusNativeSceneRef`). Make the internal address a ref too:
`setScene(index)` (`:319`) becomes `setSceneRef(sceneId)` with the index
resolved inside (`store.document.scenes.findIndex(s => s.id === sceneId)`),
and every caller passes the scene's id: previous/next (`:612`) resolve the
neighbour's id, `choose-scene` (`:613`) reads `data-scene-id` (render it
beside `data-index` where the chooser is drawn), the playhead (`:749`), the
arrow keys (`:787`), `focus` (`:1260`), `installPhysis` (`:1483`,
`source.sceneId ?? the first scene's id`, index accepted for compatibility).
The index survives only as `sceneIndex`, derived after each change. Wrap
the index→ref compatibility in one helper and announce it (the existing
toast text) when an index arrives from outside.

Tests: a scripted case — reorder scenes in the document, then
`setScene(<ref of a scene now elsewhere>)` lands on that scene; `?scene=<ref>`
(E22) is out of scope here.

## Resolution

**Landed (13 Oct 2026; builder haiku, converged by the lead).** `setScene(index)`
is gone: `setSceneRef(sceneId)` resolves the index inside (`sceneIndexOf`)
before any intent-epoch bump; previous/next, arrows, playhead, the chooser
(`data-scene-id`), focus, installPhysis and saved-scene advance address by
id (neighbours through `sceneRefAt`); the public disclosure keeps its
compatibility toast. Scripted: scene-refs 12/12 (0/12 before); seven
scene suites 84/84 before and after; build clean. Carried into E04: the
move-left/right, delete, duplicate and drag-reorder controls still pass an
index; Physis's saved `sceneIndex` (wire format, `physis.ts`) is resolved at
the boundary. Unverified: the reorder-then-open case in a browser harness
and on screen (the lead's native pass).
