# T-E03 — Scene operations address refs; the index is a derived view

Label: wayfinder:task (Phase 4 · lane 3; no UI leg)
Claimed-by: —
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

—
