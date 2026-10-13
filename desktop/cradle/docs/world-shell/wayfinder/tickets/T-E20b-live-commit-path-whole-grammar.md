# T-E20b — The live commit path expresses the whole Change grammar

Label: wayfinder:task (Phase 4 · lane 3; no UI leg)
Claimed-by: —
Found by: T-E20 (13 Oct 2026).

## Finding

The editor's live save is `app.ts:1423` → `nativeWorkspace.commit`
(`nativeWorkspace.ts:432-452`) → `kernelComposition.prepareCompositionEdit`.
It already emits rename, scene_remove, scene_reorder
(`kernelComposition.ts:75,135,149`) but not parameter_automate /
parameter_manual, subject_bind/unbind, relation_bind/remove, entity pin,
scene body/trigger, profile, collections or reuse changes; and both it and
`documentToChanges` ignore those differences silently.

## Lead's design

Make `kernelComposition.prepareCompositionEdit` express every difference
the kernel grammar can carry (`desktop/cradle/src/expression/types.ts:39-72`
+ the kernel's `EntityPin`), using the same rules `documentToChanges` now
follows (T-E20: create before remove; automated value = manual → set →
automate), and refuse by name anything left (share `UNEXPRESSIBLE` — one
list, imported, not copied). Extend `documentToChanges` with the same
newly-covered kinds so the two paths agree; a test asserts both paths
produce the same change list for the same document pair (a parity table).

## Acceptance

Scripted: the parity test; each new kind round-trips through the native
composition test harness (`tests/native-composition.test.mjs`); no silent
drop remains (a test mutates every field family and asserts each yields a
change or a named refusal).

## Resolution

—
