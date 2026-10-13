# T-E02 — Scene-as-clip: content vs timeline coordinates · E02b (app wiring)

Label: wayfinder:task (Phase 4 · lane 3)
Claimed-by: claude-code:dlw-lead (13 Oct 2026; builder haiku)
Source: `lanes/lane-3-expressions-editor/TARGET-SET.md:126` (register `lane-3:E02`).

## Resolution — model leg

**Landed (13 Oct 2026).** `model.ts` exports `SCENE_DURATION_MIN/MAX`,
`SCENE_TRANSITION_MIN/MAX` (validateJourney reads them — same values) and
`sceneContentDigest` (content only: excludes duration and transition, keeps
the id); `sceneWorkflow.ts` gains guarded timeline ops `moveScene`,
`retimeScene`, `removeScene` (+ the existing duplicate) through
`applyTimelineMove`, which dry-runs and throws `SceneContentMutationError`
before touching the document if any surviving scene's content would change.
Scripted: 71/71; property test 200 seeds × 40 moves; bounds equal
validateJourney's at every edge.

## E02b — the app delegates (claimable, app.ts + sceneWorkflow.ts)

`app.ts` reorder (~:584), trim commit (~:306), duplicate (~:732) and delete
(~:733) delegate to `moveScene` / `retimeScene` / `nextSceneFrom` /
`removeScene` inside their labelled `store.change`; the index-addressed
move/delete/duplicate/drag controls (E03's carry) pass Scene refs;
`journeyTimelineLayout.ts` imports the duration constants; lead ruling:
`sceneSaveState` excludes timeline facts (duration, transition) — a moved or
retimed clip keeps its save dot (identity, E02's UI note).
