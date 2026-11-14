// The kernel's Studio table (desktop/cradle/kernel/src/expression_studio.json; O-I ticket 1008) is generated from the TypeScript that
// owns each part of it, and held equal to it here: the Field's bindings (nativeParameters.ts NATIVE_BINDINGS), the side rule of a value
// (CARRY_TINT_BIND), the pointer paths that follow the shared pointer (sharedSettings.ts POINTER_PATHS), the settings each device writes
// (nativeDeviceEdits.ts, nativeFieldPanelSettings.ts) and New's blank scene (model.ts blankScene). The kernel writes a Studio value with
// the same law the frame's editor applies; a change on either side without the other fails here.
//
// Regenerate after changing one of those owners:
//   OI_WRITE_STUDIO_TABLE=1 node --import ./tests/register-production-sources.mjs --test tests/studio-table.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile, writeFile} from 'node:fs/promises';

const [{NATIVE_BINDINGS, CARRY_TINT_BIND}, {POINTER_PATHS}, {blankScene}, {FIELD_PANEL_SETTINGS},
  {NATIVE_FIELD_SETTINGS, NATIVE_MORPH_SETTINGS, NATIVE_COLOUR_SETTINGS, NATIVE_WHOLE_PARAMETERS, applyNativeDeviceChanges}] = await Promise.all([
  import('../src/parameters.ts'),
  import('../../../desktop/cradle/expressions-app/field-studies-journeys/src/sharedSettings.ts'),
  import('../../../desktop/cradle/expressions-app/field-studies-journeys/src/model.ts'),
  import('../src/nativeFieldPanelSettings.ts'),
  import('../src/nativeDeviceEdits.ts'),
]);

const TABLE = new URL('../../../desktop/cradle/kernel/src/expression_studio.json', import.meta.url);

function settingsOf(table, path) {
  return Object.fromEntries(Object.entries(table).map(([key, values]) => [key, {path: path(key), values: [...values]}]));
}

/** The table, as the kernel reads it. */
export function studioTable() {
  const scene = blankScene();
  scene.id = '';
  return {
    schema: 'oi.expression-studio-table/v1',
    source: 'Generated from the TypeScript owners named in packages/expressions-boundary/tests/studio-table.test.mjs, which holds it equal to them. Do not edit.',
    binds: NATIVE_BINDINGS.map(b => ({key: b.key, bind: b.bind, path: b.path, label: b.label, group: b.group, hardMin: b.hardMin, hardMax: b.hardMax,
      defaultValue: b.defaultValue, factor: b.factor, whole: NATIVE_WHOLE_PARAMETERS.includes(b.path)})),
    pointer_paths: [...POINTER_PATHS],
    settings: {
      'field-setting': settingsOf(NATIVE_FIELD_SETTINGS, key => 'engine.' + key),
      'morph-setting': settingsOf(NATIVE_MORPH_SETTINGS, key => key === 'law' ? 'morph.law' : 'engine.' + key),
      'colour-setting': settingsOf(NATIVE_COLOUR_SETTINGS, key => 'engine.' + key),
      'panel-setting': Object.fromEntries(Object.entries(FIELD_PANEL_SETTINGS).map(([key, spec]) => [key, {
        path: spec.target === 'scene' ? key : spec.target + '.' + key,
        ...(spec.type === 'boolean' ? {values: [false, true]} : spec.type === 'enum' ? {values: [...spec.options]} : {min: spec.min, max: spec.max}),
      }])),
    },
    carry_tint_bind: CARRY_TINT_BIND,
    blank_scene: scene,
  };
}

test('the kernel Studio table is the one its TypeScript owners generate', async () => {
  const want = studioTable();
  if (process.env.OI_WRITE_STUDIO_TABLE === '1') await writeFile(TABLE, JSON.stringify(want, null, 1) + '\n');
  const held = JSON.parse(await readFile(TABLE, 'utf8'));
  assert.deepEqual(held, want, 'regenerate expression_studio.json from its owners (see the head of this test)');
});

test('the table admits exactly what the device reducer admits', () => {
  const journey = {schema: 'oi.journey', version: 1, id: 'studio-table', name: 'Studio table', description: '', loop: true, savedScenes: {}, scenes: [blankScene('One')],
    updatedAt: new Date(0).toISOString()};
  const id = journey.scenes[0].id, table = studioTable();
  for (const [kind, settings] of Object.entries(table.settings)) {
    for (const [key, spec] of Object.entries(settings)) {
      if (!spec.values) continue;
      for (const value of spec.values) applyNativeDeviceChanges(journey, id, [{kind, key, value}]);
      assert.throws(() => applyNativeDeviceChanges(journey, id, [{kind, key, value: 'not-a-listed-value'}]), undefined, `${kind}:${key} refuses an unlisted value`);
    }
  }
  const whole = table.binds.find(bind => bind.whole);
  assert.ok(whole, 'a whole-number parameter is listed');
  assert.throws(() => applyNativeDeviceChanges(journey, id, [{kind: 'parameter', target: 'field.' + whole.key, value: (whole.hardMin + 1.5) / whole.factor + 0.25 / whole.factor}]), /whole number/);
  const tint = table.binds.find(bind => bind.bind === table.carry_tint_bind);
  journey.scenes[0].composition.carryTint = false;
  const tinted = applyNativeDeviceChanges(journey, id, [{kind: 'parameter', target: 'field.' + tint.key, value: tint.hardMax}]);
  assert.equal(tinted.scenes[0].composition.carryTint, true, 'a focus tint above 0 carries the tint');
});
