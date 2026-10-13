# T-E16 — Atomic composite edits

Label: wayfinder:task (Phase 4 · lane 3)
Claimed-by: claude-code:dlw-lead (13 Oct 2026; builder haiku)
Source: `lanes/lane-3-expressions-editor/TARGET-SET.md:452` (register `lane-3:E16`).

## Resolution

**Landed (13 Oct 2026).** `store.composite(label, fn)` / `withComposite`:
one entry on success; any throw restores byte-equal, records nothing,
rethrows; nesting, async edits and finish-mid-edit refused by name; a
gesture id rides the kernel submission. `saveKernelExpression` refuses a
gesture split across two edits and any edit over the owner's 256-change
budget (`kernelComposition.ts:166`), named, before submission. Scripted:
composite-edits 11/11 (injected failure at each split position: byte-equal,
zero entries, zero edits; happy path: one entry, one edit, revision + 1);
neighbours green. Unverified: against the real kernel apply. Carried into
E02b: plain `begin()/finish()` callers in app.ts have no throw-restore and
a plain `change()` closes an open pointer gesture — route gestures through
`composite`.
