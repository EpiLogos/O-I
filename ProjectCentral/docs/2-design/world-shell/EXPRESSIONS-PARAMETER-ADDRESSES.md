# Expressions parameter addresses (W2)

Lane W2 of `EXPRESSIONS-FAMILY-SESSION-BRIEF.md`, design `WORLD-SHELL-DESIGN.md` §14.

Code: `packages/expressions-boundary/src/parameterAddress.ts` (pure). Test: `packages/live-shell/ui/tests/parameter-address.test.mjs` (17 tests, one example per kind).

## Shape

`parameterAddresses(change)` returns `{addresses: ParameterAddress[], structural?: string}`.

`ParameterAddress = {family, deviceInstance, key, type, range?, unit?, writePath}`

- `family`: the Expressions device family the value belongs to (from the face that shows it, `nativeFieldFace.*`, the Colour, Ink and Arrange panels). `expressions` only when no device owns a native target.
- `deviceInstance`: the change's `entity_id` or `device_id`, or the entity id parsed from an `entity:<id>:<suffix>` target. Null for a Field value.
- `key`: the admitted name inside the change grammar (`field.<key>`, a setting key, `entity:<id>:<suffix>`).
- `range`: the admitted hard bound (`hardMin`..`hardMax`) for registry values, the panel table's min..max for number panel settings. Omitted when the source states none.
- `unit`: from the registry, omitted when none.
- `writePath`: the path the owner writes, under the writeShared law where the change is shared.

A kind is **addressed** when it writes one or more typed values. Otherwise it is **structural** and the result names the kind (`{addresses: [], structural: '<kind>'}`). Lists, whole blocks (sound, semantic binding), creations and removals, relations (body, trigger), page text, automation lanes, and macros that resolve through the rack reading are structural.

The classifier never throws and never validates values. An invalid change is classified by its kind; an unknown key falls to structural.

## Family rules

| Source | Family |
|---|---|
| Registry group `motion`, `physics` (fluid, physics+) | `physics` |
| `pointer` (interaction) | `pointer` |
| `relational` | `relational` |
| `medium` | `medium` |
| `collision`, `pairwise` | `contacts` |
| `morph` | `morph` |
| `color`, paper grain | `colour` |
| `material`, particles | `ink` |
| `resonance` (cymatics) | `resonance` |
| `composition` (focus orchestration, tint weights) | `focus` |
| `depth`, `volume` (glyph volume) | `depth` |
| Entity `forces.*` | `force` |
| Entity `sequence.*` | `glyph` |
| Entity `tintWeight` | `colour` |
| Entity position, scale, size, rotation, share | `formation` |

Field-setting keys: `mediumEnabled`, `mediumDimension`, `collisionMode`: medium or contacts as the face holds them; `mediumPlane` in `physics` (the face comment places it there).

## Table: every kind

Union: `E` = `NativeEditorChange` (the kind is `kind`), `M` = `NativeSceneMaterialChange` (the kind is `change`).

| kind | union | result | family | deviceInstance | key | type | writePath | range / unit |
|---|---|---|---|---|---|---|---|---|
| `colour-setting` | E | address | colour | null | `colorEnabled` / `colorMode` | boolean / enum | `engine.<key>` | none |
| `colour-palette` | E | address | colour | null | `palette` | colour-list | `field.palette` | none |
| `colour-background` | E | address | colour | null | `background` | colour | `field.background` | none |
| `colour-preset` | E | address | colour | null | `palette_id` | palette-preset | `engine.paletteId` (principal path) | none |
| `entity-sound` | E | structural | | | | | | |
| `entity-semantic` | E | structural | | | | | | |
| `semantic-field-setting` | E | address | meaning | null | `enabled` / `globalColorGain` | boolean / number | `semanticField.<key>` | none |
| `morph-setting` | E | address | morph | null | `morphEnabled`, `autoOscillate`, `trajectory`, `driveShape`, `law` | boolean / enum | `morph.law` for `law`, else `engine.<key>` | none |
| `panel-setting` | E | address | per key (see table in code) | null | the panel key | boolean / number / enum | `<target>.<key>` (`scene.pointerScope` for pointer scope) | `vortex3d`, `dispersion3d`: 0..1 |
| `entity-setting` | E | address | formation | entity_id | `name` / `locked` / `enabled` | text / boolean | `entity.<key>` | none |
| `route-order` | E | structural | | | | | | |
| `parameter` | E | address | per registry group (`field.`) or entity suffix (`entity:`) | null for a Field target; the entity id from `entity:<id>:<suffix>` | `field.<key>` or the entity suffix | number | the binding's bind path (`field.params.<key>` or `entity.<local>`) | hard range; unit when registry has one |
| `force-mode` | E | address | force | entity_id | `force.kind` | enum | `entity.force.kind` | none |
| `field-setting` | E | address | medium / physics / contacts / resonance | null | the setting key | boolean / enum | `engine.<key>` | none |
| `shared-setting` | E | address | per registry group of the target | null | `field.<key>` | shared-flag | the binding's bind path | none |
| `force-insert` | E | structural | | | | | | |
| `field-material` | E | address | ink | null | `material` | enum | `field.material` | none |
| `ink-mode` | E | address | ink | null | `inkMode` | enum | `engine.inkMode` | none |
| `field-font` | E | structural | | | | | | |
| `sequence-settings` | E | address (per value key) | glyph | entity_id | the sequence key | per key | `entity.sequence.<key>` (entity-level, even with a step id) | `hold` 0..3600 s; `transition` 0.02..3600 s; `rateMul`, `phaseOffset` from registry |
| `step-timing` | E | address (per present key) | glyph | entity_id | `hold` / `transition` | number | `entity.sequence.steps[<step_id>].<key>` | as `sequence-settings` |
| `step-source` | E | structural | | | | | | |
| `step-position` | E | structural | | | | | | |
| `step-overrides` | E | structural | | | | | | |
| `step-layers` | E | structural | | | | | | |
| `step-insert` | E | structural | | | | | | |
| `step-duplicate` | E | structural | | | | | | |
| `step-remove` | E | structural | | | | | | |
| `step-order` | E | structural | | | | | | |
| `formation-glyph` | E | structural | | | | | | |
| `rack-set` | E | address (per resolvable mapping) | per mapping target | null | `field.<key>` or `entity:<entity_ref>:<path>` | number | the binding's bind path | hard range; unit when registry has one |
| `rack-remove` | E | structural | | | | | | |
| `rack-macro-value` | E | structural | | | | | | |
| `rack-exclusions` | E | structural | | | | | | |
| `rack-variation-capture` | E | structural | | | | | | |
| `rack-variation-recall` | E | structural | | | | | | |
| `rack-variation-remove` | E | structural | | | | | | |
| `chosen-add` | E | structural | | | | | | |
| `chosen-remove` | E | structural | | | | | | |
| `chosen-order` | E | structural | | | | | | |
| `chosen-scope` | E | structural | | | | | | |
| `device-add` | E | structural | | | | | | |
| `device-remove` | E | structural | | | | | | |
| `device-order` | E | structural | | | | | | |
| `text-layer-add` | E | structural | | | | | | |
| `text-layer-remove` | E | structural | | | | | | |
| `text-layer-set` | E | structural | | | | | | |
| `automation-add` | E | structural | | | | | | |
| `automation-set` | E | structural | | | | | | |
| `automation-link` | E | structural | | | | | | |
| `automation-remove` | E | structural | | | | | | |
| `automation-order` | E | structural | | | | | | |
| `state-fold` | E | structural | | | | | | |
| `formation-add` | E | structural | | | | | | |
| `entity-duplicate` | E | structural | | | | | | |
| `entity-remove` | E | structural | | | | | | |
| `track-remove` | E | structural | | | | | | |
| `scene_body_set` | M | structural | | | | | | |
| `scene_body_clear` | M | structural | | | | | | |
| `scene_trigger_attach` | M | structural | | | | | | |
| `scene_trigger_detach` | M | structural | | | | | | |

Totals: 61 kinds. 17 addressed, 44 structural. Every kind is covered by the type-checked `CLASSIFIERS` table and by one example in the test.

## Notes and open points

1. **Entity targets name the instance inside `target`.** A `parameter` change has no `entity_id` field. The adapter reads `entity:<id>:<suffix>` and puts the id in `deviceInstance` and the suffix in `key`. A rack entity mapping does the same with `entity_ref`.
2. **Range is the admitted hard bound**, the one `applyNativeDeviceChanges` checks. The registry's soft slider range (`min`/`max`) is not used.
3. **Step transition bound differs from the apply validator.** The registry gives `sequence.transition` a hard minimum of 0.02. `hostEditor.ts` admits 0..3600 for `hold` and `transition`. The address reports the registry value. Reconcile one or the other.
4. **Entity position and scale are shared** by formations and force centres. They are filed under `formation`, and the write path is the same entity path for both.
5. **Palette writes are multi-path.** `colour-palette` writes `field.palette` and sets `engine.paletteSource` to custom. `colour-preset` (`applyPalette`) writes `engine.paletteId` and several recommended colour settings. The address names the principal path.
6. **Structural kinds write no registry value.** Field font, page text, and automation lanes are document values with no entry in the three allowed sources, so they are structural and not ranged. Whole blocks (sound, semantic binding) have their own validators.
7. **Unresolvable rack mappings produce no address.** `validateNativeRackState` refuses them, so they never reach an applied rack.
8. **`rack-macro-value` is structural.** Its macro writes through mappings held in the rack reading, which the change does not carry.
9. **Sources read:** `parameters.ts` (registry, `entityTargets`, `NATIVE_BINDINGS`), `nativeFieldPanelSettings.ts`, `nativeFieldStyle.ts`, and the face and apply modules named in the family table. The module imports no native owner, store, or UI.
10. The module does not edit `editor.ts`, `nativeDeviceWidgets.ts`, or any UI component. It does not add a grammar: the change kinds, their keys, and write paths are the existing ones.
