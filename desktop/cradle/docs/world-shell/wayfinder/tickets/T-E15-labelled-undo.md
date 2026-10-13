# T-E15 — Labelled undo/redo converging with kernel act history

Label: wayfinder:task (Phase 4 · lane 3)
Claimed-by: claude-code:dlw-lead (13 Oct 2026; builder haiku)
Source: `lanes/lane-3-expressions-editor/TARGET-SET.md:421` (register `lane-3:E15`).

## Resolution

**Store + inverse landed (13 Oct 2026; builder haiku, converged by the lead).**
`store.ts` entries are `{label, snapshot, changes?, inverse?}`;
`change(label, fn)` (unlabelled = "Edit"), `begin(label)` gestures,
`undoLabel()` / `redoLabel()`; the E16 transaction idiom (baseline restore
on throw) kept. `kernelExpressions.ts` `invertEdit(before, after)` derives
the compensation as `documentToChanges(after, before)` — the forward
ordering laws and refusals apply in reverse, no second apply engine (lead
accepted over the design's `invertChanges(before, changes)`);
`undoPlan()` + `saveKernelExpression(doc, {changes, expectedRevision})`
submit one compensating edit. Scripted: labelled-undo 14 new, 148/148 across
the save/parity/model/bridge suites; tsc 0. Unverified: against the real
kernel (test applier mirrors its rules); the act record by ref.

**T-E15b (claimable, app.ts):** record each edit's kernel changes on its
entry (`attachKernelEdit`) and `markKernelSaved` on save; show undo/redo
labels in the existing affordance and toast ("Trim scene 3", "Reorder
scenes"); label every `store.change` caller; undo across the kernel head
submits `undoPlan()` through the save path. Pre-existing gap noted:
`entity_add` seeds glyph "O" for an entity whose document has none.

## Resolution — E15b (app wiring)

**Landed (13 Oct 2026; builder haiku).** Every edit in `app.ts` is labelled
in the app's voice (93 `changed()` sites; `store.change` always labelled;
`store.replace` gone — "Open expression", "Adopt native expression");
`undoLabels.ts` holds the pure label helpers; Undo/Redo controls carry the
label as title + aria and toast "Undone: <label>." / "Redone: <label>.";
a source gate test refuses an unlabelled edit. Scripted: undo-wiring 10,
labelled-undo 14, scene suites unchanged. Unverified: labels in the live
frame (native pass).

## E15c — the kernel half (claimable)

Lead ruling (the builder's design question): **undo across the kernel head
is per save** — each Save is a kernel checkpoint; the store attaches that
save's `{changes, before, after}` to the save's last entry; undoing past a
checkpoint submits the whole save's inverse (`invertEdit(before, after)`)
as one edit at the expected revision, then local undo continues. Needs:
`nativeWorking.commit` / `nativeWorkspace.commit` return the submitted
changes and the kernel document before/after (`nativeWorking.ts:348-376`,
`nativeWorkspace.ts:432-456`); an explicit-change save on NativeWorking
(same pending/persist/acknowledgement checks, never forced) for the
compensation (today `connectionEdit` admits only bind/remove/body/trigger/
reuse kinds, `nativeWorking.ts:51,94`); `markKernelSaved` after each save.
Also: `hostEditor.ts:387,413` pass their own labels (selection sync is
mislabelled "Apply native edit").
