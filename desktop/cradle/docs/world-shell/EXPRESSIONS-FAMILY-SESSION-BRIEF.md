# Expressions family session brief

Shared contract for the Expressions-only port into the live shell. Design source: `WORLD-SHELL-DESIGN.md` sections 1, 2, 12, 13, 14, 15, 16. Seat: `/Users/admin/Central/worktrees/env-1/o-i` on `agent/o-i-20261007-1639`. Everything is uncommitted. Do not commit. Do not create a worktree. Do not edit `EXPRESSIONS-PORT-STATUS.json` (the integrator merges the ledger).

## Out of bounds for every lane

Do not edit, reformat, or import-change:

- `packages/live-shell/ui/src/components/NativeTransportBar.tsx`
- `packages/live-shell/ui/src/components/NativeStageTools.tsx`
- `packages/live-shell/ui/src/components/TransportBar.tsx`
- `packages/live-shell/ui/src/components/NativeBarControls.tsx`
- `packages/live-shell/ui/src/components/NativeBarStrip.tsx`
- `packages/live-shell/ui/src/native/stageCommands.ts`
- `packages/live-shell/ui/src/components/nativeBarModel.ts`
- continuity, recovery, or saved-work admission code
- `BROWSER-TAXONOMY-DIFFERENTIAL.md`

Technè, Factory, Agency, and Central are other families. Do not build them.

Write evidence only under `new-shell/evidence/`. Re-read a file immediately before editing it.

## W1 — Expressions family manifest

A family is one inhabitant manifest: `{browser, faces, params, projections, inspectors, time, telemetry}`.

Today `DEVICE_FAMILIES` in `packages/expressions-boundary/src/nativeDeviceWidgets.ts` is a closed list. The kernel (`expression_scene.rs` `device_widgets`) and `validateDeviceWidgets` already admit any `/^[a-z0-9-]{1,64}$/` token. Repeatable instances today are only `force` and `formation` (`REPEATABLE` in that same file).

Neutral correction, not a special case:

1. New `packages/expressions-boundary/src/familyAdmission.ts`. It knows no product name. API:
   - `isFamilyToken(id)` — the kernel regex
   - `admitFamily({id, repeatable})` — refuses a bad token; refuses a second admission of the same id with a different `repeatable`
   - `admittedFamily(id)`
   - no `DEVICE_FAMILIES`, no `physics`, no `force`
2. `nativeDeviceWidgets.ts` drops `DEVICE_FAMILIES` and `REPEATABLE`. `device-add` admits only a token that has been `admitFamily`'d. A non-repeatable family still throws `This device is already placed in the Scene`. A bad token or an unadmitted id throws `Choose a defined device family`. Do not import the Expressions list from this file.
3. New `packages/expressions-boundary/src/expressionsFamilies.ts` holds the one Expressions declaration (the 22 ids moved off the validator) and `loadExpressionsFamilies()` which admits each once. `repeatable: true` only for `force` and `formation`. `glyph` is `faced: false`. Scopes: field `physics pointer relational medium contacts morph focus colour ink depth resonance`; entity `formation force sound meaning`; scene `automation scene text body blueprint arrange`; glyph unfaced field. `desktop/cradle/expressions-app/field-studies-journeys/src/hostEditor.ts` calls `loadExpressionsFamilies()` at module load so production apply still works.
4. New `packages/live-shell/ui/src/expressions/expressionsFamilyManifest.ts` builds the manifest object from that declaration plus the existing registries (`FIELD_FACE_MODELS`, `ENTITY_FACE_MODELS`, `SCENE_FACE_MODELS`, `deviceCatalogue`). Do not import React views. Browser entries are the Expressions categories already in `WorldBrowser.tsx`: works, material, objects, properties, devices. `params` names the existing change grammar (`parameterAddress.ts` path as a string, no import — W2 owns that file). `projections` names `expressions-track-adapter` as a string. `time` consumes Transport and contributes scenes, automation, and takes as transport material. `telemetry` is `observation.effectiveValues`. Do not change catalogue behaviour.
5. Tests:
   - Update `native-device-widgets.test.mjs`, `native-device-rack.test.mjs`, `native-scene-faces.test.mjs` to read the declaration instead of `DEVICE_FAMILIES`. Existing add/reject behaviour stays.
   - New test: call `admitFamily({id:'seventh', repeatable:false})` and add that family with no edit to `familyAdmission.ts` or `nativeDeviceWidgets.ts`. Assert those two files contain neither `seventh` nor `physics`. A second `seventh` is refused as already placed. This is the section 13 neutrality test.

## W2 — Parameter address

New pure module `packages/expressions-boundary/src/parameterAddress.ts` plus a test and `new-shell/EXPRESSIONS-PARAMETER-ADDRESSES.md`.

One address: `{family, deviceInstance, key, type, range, unit, writePath}`. `family` here is the Expressions device family (or `expressions` when the change is not a device parameter). `deviceInstance` is null unless the change carries `device_id` or `entity_id`. Do not invent a store or a second grammar. Read type, range, and unit from `parameters.ts`, `nativeFieldPanelSettings.ts`, and `nativeFieldStyle.ts`. Omit a range you cannot read.

Cover every kind on `NativeEditorChange` and the rack, scene-text, and scene-material kinds. A kind that does not write a parameter is classified `{addresses: [], structural: '<kind>'}` so the table has a row either way. Kinds include: `parameter` (`field.` and `entity:` targets), `panel-setting`, `field-setting`, `morph-setting`, `colour-setting`, `colour-palette`, `colour-background`, `colour-preset`, `entity-setting`, `entity-sound`, `entity-semantic`, `semantic-field-setting`, scene text/material, `automation-*`, `device-*`, `shared-setting`, `state-fold`, `field-material`, `ink-mode`, plus glyph, rack, chosen, fold, formation, object, and track kinds.

## W3 — Modulation honesty

New pure `packages/live-shell/ui/src/components/nativeModulation.ts`:

`modulationOf(reading, target) -> {target, base, effective, sources: {kind, id, name}[]}`.

Sources, from the reading only:

- enabled automation lane whose `target` matches — name the lane (`type` and `wave`, plus the binding label when one exists)
- a property track (`scene.propertyTracks`) whose bind matches — name `Take <id>`
- a rack macro mapping that resolves to the target — name the macro
- `sharedTargets` containing the target — name `Shared value`

Follow and Bind choose which object a pin shows. They are not value modulators. Do not badge them. Say that in the test.

Show the source names and base versus effective on:

- `NumberControl` in `NativeDeviceEditors.tsx` (the `A` badge must name the source, and base versus effective both show)
- compact rack controls in `NativeDeviceRack.tsx`, fed from `nativeDeviceRackModel.ts`

Do not edit the top bar. Handles keep working; the compact row is where the rack discloses the source. Tests in `packages/live-shell/ui/tests/native-modulation.test.mjs` using the existing node test loader pattern.

## W5 — Timeline adapter

New pure files, no React, no edits to `SessionView.tsx` or `ArrangementView.tsx`:

- `packages/live-shell/ui/src/timeline/worldTrackAdapter.ts` — `WorldTrackAdapter` projecting any reading to columns, tracks, and clips
- `packages/live-shell/ui/src/timeline/expressionsTrackAdapter.ts` — scenes as columns, objects as rows, glyph-state spans, automation as lanes. Takes are exposed as transport material, not a second clock
- a node test with a fixture reading

Build no other family's adapter.

## W4, W6, W8, W7 — documents only

Write, do not edit product code:

- `new-shell/EXPRESSIONS-FOUR-SURFACES.md` — fifth places: stage toolbar row, guide popover, transport Save, Takes tab, Scene panel in the Clip view. Each is legitimate or a smell, with a proposed home. Do not move another lane.
- `new-shell/EXPRESSIONS-ENCOUNTER-SPINE.md` — rack entity widgets, the pool, open-device and open-studio events, the Arrange local checklist. Map each to an encounter transition. Name any second selection store with file and line.
- `new-shell/EXPRESSIONS-LIVE-REPLAY.md` — one-pass checklist: rack add/remove/reorder, pool panels for every device at ~700px and 1920px, Devices category, Session, Arrangement, transport, takes, fold, starters, Save.
- `new-shell/evidence/expressions-ledger-notes.json` — for the partial, not-ported, and owner-op-required rows, a honest note: missing test, stage-gesture-only, telemetry the reading lacks, or exact owner-op shape. Do not change row status.

## Evidence

Each lane writes `new-shell/evidence/expressions-family-<lane>.json` with files changed, commands run, and pass/fail.
