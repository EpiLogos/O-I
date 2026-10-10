import test from 'node:test';
import assert from 'node:assert/strict';
import {register} from 'node:module';

// Production classifier in memory: the same loader as the sibling native composition suites.
const root = new URL('../../../../', import.meta.url);
const compiler = new URL('desktop/cradle/node_modules/typescript/lib/typescript.js', root).href;
register(`data:text/javascript,${encodeURIComponent(`
import ts from ${JSON.stringify(compiler)};
import {readFile} from 'node:fs/promises';
export async function resolve(specifier,context,next){
  try{return await next(specifier,context)}catch(error){
    if(!specifier.startsWith('.'))throw error;
    if(specifier.endsWith('.js')){try{return await next(specifier.slice(0,-3)+'.ts',context)}catch{}}
    for(const suffix of ['.ts','.tsx']){try{return await next(specifier+suffix,context)}catch{}}
    throw error;
  }
}
export async function load(url,context,next){
  if(url.endsWith('.css'))return {format:'module',shortCircuit:true,source:'export {}'};
  if(!url.endsWith('.ts')&&!url.endsWith('.tsx'))return next(url,context);
  return {format:'module',shortCircuit:true,source:ts.transpileModule(await readFile(new URL(url),'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.ReactJSX},fileName:new URL(url).pathname}).outputText};
}`)}`, import.meta.url);

const boundary = new URL('packages/expressions-boundary/src/', root);
const {parameterAddresses, PARAMETER_ADDRESS_KINDS} = await import(new URL('parameterAddress.ts', boundary));

// One example per kind of NativeEditorChange, NativeSceneTextChange, NativeRackChange and NativeSceneMaterialChange.
// Some examples are deliberately invalid (wrong value, unknown key): the adapter classifies them and must not throw.
const rack = {
  schema: 'oi.parameter-rack/v1', id: 'rack-1', title: 'Rack', scope: {kind: 'field'}, excluded: [], variations: [],
  macros: [{id: 'macro-1', name: 'Macro', value: 0.5, mappings: [
    {id: 'map-1', target: {kind: 'field', path: 'fluid.returnSpeed'}, min: -5, max: 5, unit: 'scalar', law: 'linear'},
    {id: 'map-2', target: {kind: 'entity', entity_ref: 'occurrence-1', path: 'x'}, min: -1, max: 1, unit: 'stage units', law: 'linear'},
  ]}],
};
const EXAMPLES = {
  // NativeDeviceChange
  'colour-setting': {kind: 'colour-setting', key: 'colorMode', value: 'linearGradient'},
  'colour-palette': {kind: 'colour-palette', colors: ['#112233', '#445566']},
  'colour-background': {kind: 'colour-background', value: '#ffffff'},
  'colour-preset': {kind: 'colour-preset', palette_id: 'sunset'},
  'entity-sound': {kind: 'entity-sound', entity_id: 'entity-1', sound: null},
  'entity-semantic': {kind: 'entity-semantic', entity_id: 'entity-1', semantic: null},
  'semantic-field-setting': {kind: 'semantic-field-setting', key: 'globalColorGain', value: 2},
  'morph-setting': {kind: 'morph-setting', key: 'law', value: 'beat'},
  'panel-setting': {kind: 'panel-setting', key: 'vortex3d', value: 0.25},
  'entity-setting': {kind: 'entity-setting', entity_id: 'entity-1', key: 'name', value: 'Pin A'},
  'route-order': {kind: 'route-order', entity_ids: ['formation-1', 'formation-2']},
  parameter: {kind: 'parameter', target: 'field.recovery', value: 1},
  'force-mode': {kind: 'force-mode', entity_id: 'entity-1', value: 'attract'},
  'field-setting': {kind: 'field-setting', key: 'mediumPlane', value: 'vertical'},
  'shared-setting': {kind: 'shared-setting', target: 'field.recovery', shared: true},
  'force-insert': {kind: 'force-insert', position: {x: 0, y: 0, z: 0}, name: 'Centre'},
  'field-material': {kind: 'field-material', value: 'print'},
  'ink-mode': {kind: 'ink-mode', value: 'whiteOnBlack'},
  // NativeGlyphChange
  'field-font': {kind: 'field-font', values: {fontWeight: 700}},
  'sequence-settings': {kind: 'sequence-settings', entity_id: 'entity-1', values: {hold: 2, clock: 'morph'}},
  'step-timing': {kind: 'step-timing', entity_id: 'entity-1', step_id: 'step-1', hold: 1.5, transition: 0.5},
  'step-source': {kind: 'step-source', entity_id: 'entity-1', step_id: 'step-1', shape: 'text', text: 'Word'},
  'step-position': {kind: 'step-position', entity_id: 'entity-1', step_id: 'step-1', position: {x: 0.1, y: 0.2, z: 0}},
  'step-overrides': {kind: 'step-overrides', entity_id: 'entity-1', step_id: 'step-1', operation: 'capture'},
  'step-layers': {kind: 'step-layers', entity_id: 'entity-1', step_id: 'step-1', layers: []},
  'step-insert': {kind: 'step-insert', entity_id: 'entity-1', after_step_id: null, text: 'Next'},
  'step-duplicate': {kind: 'step-duplicate', entity_id: 'entity-1', step_id: 'step-1'},
  'step-remove': {kind: 'step-remove', entity_id: 'entity-1', step_ids: ['step-2']},
  'step-order': {kind: 'step-order', entity_id: 'entity-1', step_ids: ['step-2', 'step-1']},
  'formation-glyph': {kind: 'formation-glyph', entity_id: 'entity-1', text: 'Glyph'},
  // NativeRackChange
  'rack-set': {kind: 'rack-set', rack},
  'rack-remove': {kind: 'rack-remove', rack_id: 'rack-1'},
  'rack-macro-value': {kind: 'rack-macro-value', rack_id: 'rack-1', macro_id: 'macro-1', value: 0.75},
  'rack-exclusions': {kind: 'rack-exclusions', rack_id: 'rack-1', macro_ids: ['macro-1']},
  'rack-variation-capture': {kind: 'rack-variation-capture', rack_id: 'rack-1', variation_id: 'var-1', name: 'Dusk'},
  'rack-variation-recall': {kind: 'rack-variation-recall', rack_id: 'rack-1', variation_id: 'var-1'},
  'rack-variation-remove': {kind: 'rack-variation-remove', rack_id: 'rack-1', variation_id: 'var-1'},
  // Chosen controls
  'chosen-add': {kind: 'chosen-add', key: 'field.recovery', scope: 'selected'},
  'chosen-remove': {kind: 'chosen-remove', entry_id: 'entry-1'},
  'chosen-order': {kind: 'chosen-order', entry_ids: ['entry-1', 'entry-2']},
  'chosen-scope': {kind: 'chosen-scope', entry_id: 'entry-1', scope: 'named', entity_id: 'entity-1'},
  // Device widgets
  'device-add': {kind: 'device-add', family: 'physics', after_id: null},
  'device-remove': {kind: 'device-remove', device_id: 'physics-1'},
  'device-order': {kind: 'device-order', device_ids: ['physics-1', 'force-1']},
  // NativeSceneTextChange
  'text-layer-add': {kind: 'text-layer-add'},
  'text-layer-remove': {kind: 'text-layer-remove', layer_id: 'text-1'},
  'text-layer-set': {kind: 'text-layer-set', layer_id: 'text-1', values: {size: 40, title: 'Title'}},
  // Automation
  'automation-add': {kind: 'automation-add', target: 'field.recovery', group_id: 'group-1'},
  'automation-set': {kind: 'automation-set', lane_id: 'lane-1', values: {rate: 2, wave: 'sine'}},
  'automation-link': {kind: 'automation-link', lane_id: 'lane-2', leader_id: 'lane-1'},
  'automation-remove': {kind: 'automation-remove', lane_id: 'lane-1', scope: 'lane'},
  'automation-order': {kind: 'automation-order', lane_ids: ['lane-2', 'lane-1']},
  // Fold, formation, object, track
  'state-fold': {kind: 'state-fold', entity_id: 'entity-1', step_id: 'step-1', target_entity_id: 'entity-2'},
  'formation-add': {kind: 'formation-add', title: 'Word', shape: 'text', text: 'Word'},
  'entity-duplicate': {kind: 'entity-duplicate', entity_id: 'entity-1'},
  'entity-remove': {kind: 'entity-remove', entity_id: 'entity-1'},
  'track-remove': {kind: 'track-remove', track_id: 'track-1'},
  // NativeSceneMaterialChange (discriminant `change`)
  'scene_body_set': {change: 'scene_body_set', scene_ref: 'scene-1', body: {carrier: 'engine_composition'}},
  'scene_body_clear': {change: 'scene_body_clear', scene_ref: 'scene-1'},
  'scene_trigger_attach': {change: 'scene_trigger_attach', scene_ref: 'scene-1', trigger: {trigger_ref: 'trigger-1'}},
  'scene_trigger_detach': {change: 'scene_trigger_detach', trigger_ref: 'trigger-1'},
};

const EXPECTED_KIND_COUNT = 61;
const kindOf = change => change.kind ?? change.change;

test('one example per kind, and the table covers every kind of the change unions', () => {
  assert.equal(PARAMETER_ADDRESS_KINDS.length, EXPECTED_KIND_COUNT);
  assert.deepEqual(Object.keys(EXAMPLES).sort(), [...PARAMETER_ADDRESS_KINDS].sort());
  for (const [kind, change] of Object.entries(EXAMPLES)) assert.equal(kindOf(change), kind, `example for ${kind} carries its own kind`);
});

test('every kind is either addressed or structural, and the structural name is the kind', () => {
  for (const kind of PARAMETER_ADDRESS_KINDS) {
    const result = parameterAddresses(EXAMPLES[kind]);
    if (result.addresses.length) assert.equal(result.structural, undefined, `${kind} is addressed, not structural`);
    else assert.equal(result.structural, kind, `${kind} writes no addressable value and says so`);
  }
});

test('every address carries the full shape and only numeric range bounds', () => {
  for (const kind of PARAMETER_ADDRESS_KINDS) {
    for (const address of parameterAddresses(EXAMPLES[kind]).addresses) {
      assert.equal(typeof address.family, 'string', kind);
      assert.ok(address.deviceInstance === null || typeof address.deviceInstance === 'string', kind);
      assert.equal(typeof address.key, 'string', kind);
      assert.equal(typeof address.type, 'string', kind);
      assert.equal(typeof address.writePath, 'string', kind);
      if (address.range) for (const bound of Object.values(address.range)) assert.ok(bound === undefined || Number.isFinite(bound), kind);
      if (address.unit !== undefined) assert.equal(typeof address.unit, 'string', kind);
    }
  }
});

test('field parameters take their admitted hard range, unit and bind path from the registry', () => {
  // fluid.returnSpeed: registry hard bounds -100..500, scale 1, no unit (paramRegistry.ts, nativeParameters.ts).
  assert.deepEqual(parameterAddresses(EXAMPLES.parameter).addresses, [{
    family: 'physics', deviceInstance: null, key: 'field.recovery', type: 'number',
    range: {min: -100, max: 500}, writePath: 'field.params.recovery',
  }]);
});

test('entity parameters carry the world-scaled registry range and the entity write path', () => {
  const [address] = parameterAddresses({kind: 'parameter', target: 'entity:entity-1:x', value: 3}).addresses;
  // x: registry hard bounds ±20000 px, divided by WORLD_SCALE 400 to stage units.
  assert.deepEqual(address, {family: 'formation', deviceInstance: 'entity-1', key: 'x', type: 'number',
    range: {min: -50, max: 50}, unit: 'stage units', writePath: 'entity.position.x'});
  const [force] = parameterAddresses({kind: 'parameter', target: 'entity:entity-1:forces.strength', value: 1}).addresses;
  assert.equal(force.family, 'force');
  assert.deepEqual(force.range, {min: -1000, max: 1000});
});

test('panel settings take their number range from the panel table and their write path from the target', () => {
  assert.deepEqual(parameterAddresses(EXAMPLES['panel-setting']).addresses, [{
    family: 'depth', deviceInstance: null, key: 'vortex3d', type: 'number', range: {min: 0, max: 1}, writePath: 'engine.vortex3d',
  }]);
  assert.deepEqual(parameterAddresses({kind: 'panel-setting', key: 'pointerScope', value: 'local'}).addresses, [{
    family: 'pointer', deviceInstance: null, key: 'pointerScope', type: 'enum', writePath: 'scene.pointerScope',
  }]);
  assert.equal(parameterAddresses({kind: 'panel-setting', key: 'layout', value: 'grid'}).addresses[0].writePath, 'composition.layout');
  assert.equal(parameterAddresses({kind: 'panel-setting', key: 'backgroundMode', value: 'solid'}).addresses[0].range, undefined, 'enum panel settings have no range');
});

test('morph law writes morph.law, the other morph settings write the engine', () => {
  assert.equal(parameterAddresses({kind: 'morph-setting', key: 'law', value: 'sum'}).addresses[0].writePath, 'morph.law');
  assert.deepEqual(parameterAddresses({kind: 'morph-setting', key: 'autoOscillate', value: true}).addresses, [{
    family: 'morph', deviceInstance: null, key: 'autoOscillate', type: 'boolean', writePath: 'engine.autoOscillate',
  }]);
});

test('field settings are filed under the device whose face holds them', () => {
  assert.equal(parameterAddresses(EXAMPLES['field-setting']).addresses[0].family, 'physics', 'the medium plane lives in Physics');
  assert.equal(parameterAddresses({kind: 'field-setting', key: 'collisionEnabled', value: true}).addresses[0].family, 'contacts');
  assert.equal(parameterAddresses({kind: 'field-setting', key: 'resonanceEnabled', value: true}).addresses[0].writePath, 'engine.resonanceEnabled');
});

test('entity-scoped changes carry their entity as deviceInstance, field-scoped changes carry null', () => {
  assert.equal(parameterAddresses(EXAMPLES['force-mode']).addresses[0].deviceInstance, 'entity-1');
  assert.equal(parameterAddresses(EXAMPLES['force-mode']).addresses[0].writePath, 'entity.force.kind');
  assert.equal(parameterAddresses(EXAMPLES['entity-setting']).addresses[0].deviceInstance, 'entity-1');
  assert.equal(parameterAddresses(EXAMPLES.parameter).addresses[0].deviceInstance, null);
});

test('sequence timing takes its range from the entity sequence registry and writes the step or the entity sequence', () => {
  assert.deepEqual(parameterAddresses(EXAMPLES['sequence-settings']).addresses.map(a => [a.key, a.writePath]), [
    ['hold', 'entity.sequence.hold'], ['clock', 'entity.sequence.clock'],
  ]);
  assert.deepEqual(parameterAddresses(EXAMPLES['sequence-settings']).addresses[0].range, {min: 0, max: 3600});
  assert.equal(parameterAddresses(EXAMPLES['sequence-settings']).addresses[0].unit, 's');
  assert.deepEqual(parameterAddresses(EXAMPLES['step-timing']).addresses.map(a => [a.key, a.writePath, a.deviceInstance]), [
    ['hold', 'entity.sequence.steps[step-1].hold', 'entity-1'], ['transition', 'entity.sequence.steps[step-1].transition', 'entity-1'],
  ]);
});

test('rack-set addresses each mapping target; macro values stay structural because they resolve through the reading', () => {
  assert.deepEqual(parameterAddresses(EXAMPLES['rack-set']).addresses, [
    {family: 'physics', deviceInstance: null, key: 'field.recovery', type: 'number', range: {min: -100, max: 500}, writePath: 'field.params.recovery'},
    {family: 'formation', deviceInstance: 'occurrence-1', key: 'x', type: 'number', range: {min: -50, max: 50}, unit: 'stage units', writePath: 'entity.position.x'},
  ]);
  assert.deepEqual(parameterAddresses(EXAMPLES['rack-macro-value']), {addresses: [], structural: 'rack-macro-value'});
});

test('colour, background and palette writes address the Field; a preset names its palette path', () => {
  assert.equal(parameterAddresses(EXAMPLES['colour-background']).addresses[0].writePath, 'field.background');
  assert.equal(parameterAddresses(EXAMPLES['colour-background']).addresses[0].range, undefined, 'colours carry no numeric range');
  assert.equal(parameterAddresses(EXAMPLES['colour-palette']).addresses[0].writePath, 'field.palette');
  assert.equal(parameterAddresses(EXAMPLES['colour-preset']).addresses[0].writePath, 'engine.paletteId');
});

test('shared-setting addresses the target parameter with its shared flag, not a value', () => {
  assert.deepEqual(parameterAddresses(EXAMPLES['shared-setting']).addresses, [{
    family: 'physics', deviceInstance: null, key: 'field.recovery', type: 'shared-flag', writePath: 'field.params.recovery',
  }]);
});

test('field material and ink mode address the ink device', () => {
  assert.deepEqual(parameterAddresses(EXAMPLES['field-material']).addresses, [{family: 'ink', deviceInstance: null, key: 'material', type: 'enum', writePath: 'field.material'}]);
  assert.equal(parameterAddresses(EXAMPLES['ink-mode']).addresses[0].writePath, 'engine.inkMode');
});

test('whole blocks, lists, creations, removals and relations are structural', () => {
  for (const kind of ['entity-sound', 'entity-semantic', 'route-order', 'force-insert', 'field-font', 'text-layer-set', 'device-add',
    'chosen-add', 'automation-set', 'state-fold', 'track-remove', 'scene_body_set', 'scene_trigger_attach', 'rack-remove']) {
    assert.deepEqual(parameterAddresses(EXAMPLES[kind]), {addresses: [], structural: kind}, kind);
  }
});

test('invalid changes are classified, never thrown; unknown keys fall to structural or the expressions family', () => {
  const invalid = [
    {kind: 'colour-setting', key: 'colorMode', value: 99},
    {kind: 'colour-setting', key: 'constructor', value: 1},
    {kind: 'panel-setting', key: 'nope', value: 1},
    {kind: 'panel-setting', key: 'toString', value: 1},
    {kind: 'parameter', target: 'field.nonexistent', value: Number.NaN},
    {kind: 'parameter', target: 'native:entities.0.x', value: 1},
    {kind: 'sequence-settings', entity_id: 'entity-1', values: {constructor: 1}},
    {kind: 'rack-set', rack: {macros: [{mappings: [{target: {kind: 'field', path: 'not.a.path'}}]}]}},
    {kind: 'device-add'},
    {kind: 'unknown-kind'},
    {change: 'unknown-scene-change'},
    null,
    'a string',
  ];
  for (const change of invalid) assert.doesNotThrow(() => parameterAddresses(change), JSON.stringify(change));
  assert.deepEqual(parameterAddresses({kind: 'colour-setting', key: 'constructor', value: 1}), {addresses: [], structural: 'colour-setting'});
  assert.deepEqual(parameterAddresses({kind: 'panel-setting', key: 'toString', value: 1}), {addresses: [], structural: 'panel-setting'});
  assert.equal(parameterAddresses({kind: 'parameter', target: 'native:entities.0.x', value: 1}).addresses[0].family, 'expressions');
  assert.deepEqual(parameterAddresses({kind: 'sequence-settings', entity_id: 'entity-1', values: {constructor: 1}}), {addresses: [], structural: 'sequence-settings'});
  assert.deepEqual(parameterAddresses({kind: 'unknown-kind'}), {addresses: [], structural: 'unknown-kind'});
  assert.deepEqual(parameterAddresses(null), {addresses: [], structural: 'unclassified'});
});

test('classification is pure: the change is not mutated and the result is repeatable', () => {
  for (const kind of PARAMETER_ADDRESS_KINDS) {
    const before = structuredClone(EXAMPLES[kind]);
    const first = parameterAddresses(EXAMPLES[kind]);
    assert.deepEqual(EXAMPLES[kind], before, `${kind} is not mutated`);
    assert.deepEqual(parameterAddresses(EXAMPLES[kind]), first, `${kind} is repeatable`);
  }
});
