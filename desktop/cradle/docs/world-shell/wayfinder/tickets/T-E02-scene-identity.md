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

## Resolution — E02b (with E15d), app wiring

**Landed (13 Oct 2026; builder haiku + lead test correction).** Every scene
timeline op in `app.ts` runs the guarded model op inside its labelled change
(trim/hold/transition → `retimeScene`, reorder → `moveScene`, duplicate →
`nextSceneFrom` (64-scene cap named), delete → `removeScene`, add →
`applyTimelineMove`); scene controls address refs (`data-scene-id`;
`data-scene-index` gone); `sceneSaveState` excludes timeline facts (a moved
or retimed clip keeps its save dot); the duration bounds come from
`model.ts`. E15d: host commit, flush and research commit record kernel
checkpoints (`commitNativeRecorded`); `hostEditor` passes labels ("Apply
native edit", "Select link"). Lead rulings: live pointer drags stay
begin/finish (live preview + the open-gesture flag that gates autosave) —
E16's one-edit law covers computed composites; `native-composition` test 73
now proves the material-binding negative with a content edit (duration is
no longer content); the Python harness addresses duplicate by scene id.
Scripted: field-studies 440 pass / 0 fail; build clean. Unverified: the
gestures and toasts in the native app.
