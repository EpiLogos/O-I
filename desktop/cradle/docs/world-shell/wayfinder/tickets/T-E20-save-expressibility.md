# T-E20 — Save emits the kernel's whole standing Change grammar

Label: wayfinder:task (Phase 4 · lane 3, kernel-first order: E20 first; no UI leg)
Claimed-by: claude-code:dlw-lead (13 Oct 2026; builder haiku ×1)
Source: `lanes/lane-3-expressions-editor/TARGET-SET.md:549` (register id `lane-3:E20`).

## Lead's design

Landing seam only: `desktop/cradle/expressions-app/field-studies-journeys/src/kernelExpressions.ts`
`documentToChanges` (`:152-232`). The kernel grammar is `desktop/cradle/src/expression/types.ts:39-72`.
Emit, in this order (one `edit`, revision + 1):

1. `rename` when the expression title changed (was a refusal).
2. `scene_remove` for each current scene_ref absent from the edited document (was a refusal).
3. `scene_create` for new refs (as today), then `scene_rename` for a surviving scene whose title changed (was a refusal).
4. `scene_reorder` with the edited order of refs when the order of the surviving + created refs differs from the current order.
5. Entities as today; parameters as today, plus automation: edited `automation` non-null and different from before → `parameter_automate` (after any `parameter_set` of the value); before automated and edited `automation` null → `parameter_manual` (was a refusal); an automated parameter whose value alone changed → `parameter_set` (allowed: the value is the manual basis).
6. Subject: edited subject null, before non-null → `subject_unbind`; edited non-null and different → `subject_bind` with the edited binding (was a refusal).
7. Scene material removal → `scene_material_clear` (was a refusal).
8. Membership, material, composition, focus as today.

Refusals that remain (genuinely unrepresentable — name them in one exported
constant `UNEXPRESSIBLE` with the reason each): parameter removal (no kernel
change removes a parameter), a parameter outside EDITABLE, a non-finite
numeric value, unsupported Scene material schema, a new entity no scene
carries, a scene carrying an undefined entity.

Tests: extend `expressions-app/field-studies-journeys/tests/kernel-document-bridge.test.mjs`
(or a new `save-expressibility.test.mjs` beside it using the same loader):
the target's acceptance — one session doing rename + scene remove + scene
reorder + parameter edit yields exactly those four change kinds in order;
each newly emitted kind has its own case; each remaining refusal is named.

## Acceptance

- Scripted: the tests above; the existing field-studies-journeys tests that
  touch kernelExpressions stay green; `node --test` run from
  `desktop/cradle/expressions-app` as its CI does (`.github/workflows/techne-constructive-field.yml:61`).

## Resolution

—
