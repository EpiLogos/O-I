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
