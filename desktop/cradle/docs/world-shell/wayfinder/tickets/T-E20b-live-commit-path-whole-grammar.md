# T-E20b — The live commit path expresses the whole Change grammar

Label: wayfinder:task (Phase 4 · lane 3; no UI leg)
Claimed-by: claude-code:dlw-lead (13 Oct 2026; builder haiku)
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

**Landed (13 Oct 2026; builder haiku, converged by the lead).**
`documentToChanges` now expresses relation bind/remove, entity pin, scene
body and performance, triggers (detach before a scene's removal, attach
after creation), representation bind, profile adopt/release, collections,
reuse and relation focus; the shared `UNEXPRESSIBLE` list names the 13
cases the grammar cannot carry (entity rename, representation removal,
owner metadata, source relation added). A field-family sweep (39 mutations)
asserts every difference yields a change or a named refusal; a parity table
shows the live path and `documentToChanges` agree on existing-ref edits.
Scripted: 105/105; tsc 0.

**Lead ruling on the premise:** the live editor's model carries no subject,
pin, relation, body, trigger, profile, collection, reuse or representation
fields (`model.ts`), and the app already writes those families through
explicit owner operations (`app.ts` pin and relation_bind,
`nativeOccurrence.ts`, `actPanel.ts`, `naraPersonalBody.ts`) — so they stay
owner-operation families on the live path; `kernelComposition.ts` is
unchanged. Unverified: the hosted save walk (native).
