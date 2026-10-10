import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {register} from 'node:module';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';

// Production modulation model and views in memory: the same TypeScript loader as native-device-widgets.test.mjs (.ts/.tsx transpiled,
// .css stubbed), plus the @epilogos parameters alias the rack model imports. Every reading is a minimal fixture built from the
// real sevenCentres journey; no saved receipt is read and no owner is called.
const root = new URL('../../../../', import.meta.url);
const compiler = new URL('desktop/cradle/node_modules/typescript/lib/typescript.js', root).href;
const parameters = new URL('packages/expressions-boundary/src/parameters.ts', root).href;
register(`data:text/javascript,${encodeURIComponent(`
import ts from ${JSON.stringify(compiler)};
import {readFile} from 'node:fs/promises';
export async function resolve(specifier,context,next){
  if(specifier==='@epilogos/expressions-boundary/parameters')return next(${JSON.stringify(parameters)},context);
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

const author = new URL('desktop/cradle/expressions-app/field-studies-journeys/src/', root);
const boundary = new URL('packages/expressions-boundary/src/', root);
const [model, native, rackSchema, modulation, rackModel, rackView, editors] = await Promise.all([
  import(new URL('model.ts', author)),
  import(parameters),
  import(new URL('nativeRackSchema.ts', boundary)),
  import('../src/components/nativeModulation.ts'),
  import('../src/components/nativeDeviceRackModel.ts'),
  import('../src/components/NativeDeviceRack.tsx'),
  import('../src/components/NativeDeviceEditors.tsx'),
]);
const {modulationOf, modulationView} = modulation;
const {NATIVE_BINDINGS, baseValue, entityTargets, entityParamDefs, getParamDef} = native;
const {validateNativeRackState} = rackSchema;

// Fixture parts. The plain binding is stored under field.params (a track and a macro can name it); the other is an alias on the morph device.
const discrete = path => ['medium.iterations', 'medium.gridRes', 'particleCount', 'cymatics.modeCount', 'relational.attractorCount',
  'toroidalMorph.toroidalWinding', 'toroidalMorph.poloidalWinding'].includes(path);
const plain = NATIVE_BINDINGS.find(row => row.bind === 'field.params.' + row.key && !discrete(row.path) && row.factor === 1);
const other = NATIVE_BINDINGS.find(row => row.bind === 'field.params.' + row.key && row.key !== plain.key && !discrete(row.path) && row.factor === 1);
const morphSpeed = NATIVE_BINDINGS.find(row => row.path === 'toroidalMorph.oscillationSpeed');
assert.ok(plain && other && morphSpeed, 'fixture bindings exist in the registry');

// One canonical journey: sevenCentres() mints fresh entity ids on each call, so every fixture scene is a clone of this one.
const canonical = model.sevenCentres().scenes[0];
const base = () => structuredClone(canonical);
const [entity0, entity1] = canonical.entities;
const field = key => 'field.' + key;
const objectRow = (scene, entityId, key) => entityTargets(scene).find(row => row.entityId === entityId && row.key === key);
const lane = (over = {}) => ({id: 'lane-1', target: field(plain.key), type: 'lfo', wave: 'sine', blend: 'replace', loop: 'loop', min: 0, max: 1,
  rate: 1, phase: 0, duration: 1, delay: 0, enabled: true, firedAt: null, easing: 'linear', ...over});
const reading = (scene, over = {}) => ({
  basis: {expression_ref: 'expr:w3-fixture', revision: 1, scene_ref: scene.id, authored_revision: 1},
  scene, entityOccurrences: {}, chosenControls: {available: true, entries: [], controls: []}, devices: [],
  selection: {entity_ids: [], step_id: null}, history: {canUndo: false, canRedo: false}, standing: {dirty: false, pending: false, notice: null},
  ...over,
});
// A field rack and an object rack, validated by the admitted boundary, so a macro match is never a hand-built shape.
function admittedRacks(scene, occurrences) {
  const fieldDef = getParamDef(plain.path), entityDef = entityParamDefs(0, {}).find(value => value.path === 'entities.0.x');
  const state = {schema: 'oi.parameter-racks/v1', racks: [
    {schema: 'oi.parameter-rack/v1', id: 'rack-field', title: 'Field rack', scope: {kind: 'field'}, excluded: [], variations: [],
      macros: [{id: 'macro-f', name: 'Intensity', value: 0.5, mappings: [{id: 'map-f', target: {kind: 'field', path: plain.path},
        min: fieldDef.min, max: fieldDef.max, unit: fieldDef.unit ?? 'scalar', law: 'linear'}]}]},
    {schema: 'oi.parameter-rack/v1', id: 'rack-entity', title: 'Object rack', scope: {kind: 'entity', entity_ref: 'ref:e0'}, excluded: [], variations: [],
      macros: [{id: 'macro-e', name: 'Spread', value: 0.25, mappings: [{id: 'map-e', target: {kind: 'entity', entity_ref: 'ref:e0', path: 'x'},
        min: entityDef.min, max: entityDef.max, unit: entityDef.unit ?? 'scalar', law: 'linear'}]}]},
  ]};
  return validateNativeRackState(state, scene, occurrences);
}
const occurrencesWithE0 = {[entity0.id]: 'ref:e0'};
const escape = text => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#x27;');
const names = m => m.sources.map(source => source.name);

test('with nothing moving a control, the base is the authored value and no disclosure is shown', () => {
  const scene = base(), r = reading(scene);
  const field0 = modulationOf(r, field(plain.key));
  assert.deepEqual(field0.sources, []);
  assert.equal(field0.base, baseValue(scene, plain.key));
  assert.equal(field0.effective, null);
  assert.equal(modulationView(field0), null);
  const row = objectRow(scene, entity0.id, 'x');
  const object0 = modulationOf(r, row.target);
  assert.deepEqual(object0.sources, []);
  assert.equal(object0.base, row.value, 'an object control reads its entity target value');
  assert.equal(modulationView(object0), null);
  assert.equal(modulationOf(r, 'field.noSuchParameter').base, null, 'an unknown target has no base and no sources');
});

test('an enabled automation lane names its binding label, type and wave; disabled, other-target and disabled-leader lanes name nothing', () => {
  const scene = base();
  scene.automation = [
    lane({id: 'on'}),
    lane({id: 'off', enabled: false}),
    lane({id: 'other', target: field(other.key)}),
  ];
  assert.deepEqual(modulationOf(reading(scene), field(plain.key)).sources, [{kind: 'automation', id: 'on', name: `${plain.label} · lfo sine`}]);

  // A follower lane drives only while its leader is enabled, as the engine resolves linked lanes.
  scene.automation = [lane({id: 'leader', target: field(other.key), enabled: false}), lane({id: 'follower', syncWith: 'leader'})];
  assert.deepEqual(modulationOf(reading(scene), field(plain.key)).sources, [], 'a follower with a disabled leader does not drive');
  scene.automation[0].enabled = true;
  assert.deepEqual(modulationOf(reading(scene), field(plain.key)).sources.map(source => source.id), ['follower'], 'a follower with an enabled leader drives');

  // An object lane is named by its entity row label.
  const row = objectRow(scene, entity0.id, 'x');
  scene.automation = [lane({id: 'object-lane', target: row.target, type: 'ramp', wave: 'smooth'})];
  assert.deepEqual(modulationOf(reading(scene), row.target).sources, [{kind: 'automation', id: 'object-lane', name: `${row.label} · ramp smooth`}]);
});

test('a Follow or Bind pin is a choice of object, not a value modulator: it adds no source beside an automation lane', () => {
  const scene = base();
  const row = objectRow(scene, entity0.id, 'x');
  const pins = [
    {id: 'pin-field', key: plain.key, scope: 'field'},
    {id: 'pin-follow', key: 'x', scope: 'selected', entityId: entity0.id},
    {id: 'pin-bind', key: 'x', scope: 'named', entityId: entity0.id},
  ];
  scene.automation = [];
  const pinned = reading(scene, {chosenControls: {available: true, entries: pins, controls: []}, selection: {entity_ids: [entity0.id], step_id: null}});
  assert.deepEqual(modulationOf(pinned, field(plain.key)).sources, [], 'a Field pin adds no source');
  assert.deepEqual(modulationOf(pinned, row.target).sources, [], 'a Follow pin and a Bind pin add no source');
  assert.equal(modulationView(modulationOf(pinned, row.target)), null, 'a pin alone shows no disclosure');

  scene.automation = [lane({id: 'real'})];
  assert.deepEqual(names(modulationOf(reading(scene, {chosenControls: pinned.chosenControls}), field(plain.key))), [`${plain.label} · lfo sine`],
    'beside a real lane, the pin contributes nothing and the lane is the only source');
});

test('a recorded property track names itself Take <id> only when its bind matches the target', () => {
  const scene = base();
  const row = objectRow(scene, entity0.id, 'x'), otherRow = objectRow(scene, entity1.id, 'x');
  scene.propertyTracks = [
    {id: 'take-field', bind: 'field.params.' + plain.key, points: [{time: 0, value: 0.2}, {time: 1, value: 0.8}]},
    {id: 'take-other', bind: 'field.params.' + other.key, points: [{time: 0, value: 0.1}]},
    {id: 'stray-object', bind: 'field.params.' + plain.key, entityId: entity0.id, points: [{time: 0, value: 0.3}]},
    {id: 'take-object', bind: row.bind, entityId: entity0.id, points: [{time: 0, value: 0.5}]},
    {id: 'take-other-object', bind: otherRow.bind, entityId: entity1.id, points: [{time: 0, value: 0.6}]},
  ];
  const r = reading(scene);
  assert.deepEqual(modulationOf(r, field(plain.key)).sources, [{kind: 'take', id: 'take-field', name: 'Take take-field'}],
    'a track carrying an entity is not a Field track');
  assert.deepEqual(modulationOf(r, row.target).sources, [{kind: 'take', id: 'take-object', name: 'Take take-object'}],
    'an object track matches its own entity and bind');
  assert.deepEqual(modulationOf(r, otherRow.target).sources, [{kind: 'take', id: 'take-other-object', name: 'Take take-other-object'}]);
});

test('a rack macro counts only when its mapping resolves to this target in this Scene', () => {
  const scene = base();
  scene.parameterRacks = admittedRacks(scene, occurrencesWithE0);
  const row = objectRow(scene, entity0.id, 'x');
  const r = reading(scene, {entityOccurrences: occurrencesWithE0});
  assert.deepEqual(modulationOf(r, field(plain.key)).sources, [{kind: 'macro', id: 'macro-f', name: 'Intensity'}]);
  assert.deepEqual(modulationOf(r, row.target).sources, [{kind: 'macro', id: 'macro-e', name: 'Spread'}]);

  // Gap: the object rack names an entity this Scene does not present. The boundary admits the rack (nothing to resolve), but no source is named.
  scene.parameterRacks = admittedRacks(scene, {});
  assert.deepEqual(modulationOf(reading(scene, {entityOccurrences: {}}), row.target).sources, [],
    'an entity absent from this Scene cannot be named as a macro source');

  // Gap: a field.<key> mapping path is not an admitted native mapping, so the boundary refuses it and nothing is inferred from it.
  const fieldDef = getParamDef(plain.path);
  const refused = {schema: 'oi.parameter-racks/v1', racks: [{schema: 'oi.parameter-rack/v1', id: 'rack-x', title: 'X', scope: {kind: 'field'}, excluded: [], variations: [],
    macros: [{id: 'macro-x', name: 'Form', value: 0.5, mappings: [{id: 'map-x', target: {kind: 'field', path: field(plain.key)}, min: fieldDef.min, max: fieldDef.max, unit: fieldDef.unit ?? 'scalar', law: 'linear'}]}]}]};
  assert.throws(() => validateNativeRackState(refused, scene, {}), /no admitted native mapping/);
  assert.deepEqual(modulationOf({...reading(scene), scene: {...scene, parameterRacks: refused}}, field(plain.key)).sources, [],
    'an unadmitted mapping path names no macro, even if one were injected unvalidated');
});

test('a shared Field value names itself Shared value, and only for its own target', () => {
  const scene = base();
  const row = objectRow(scene, entity0.id, 'x');
  const r = reading(scene, {sharedTargets: [field(plain.key)]});
  assert.deepEqual(modulationOf(r, field(plain.key)).sources, [{kind: 'shared', id: field(plain.key), name: 'Shared value'}]);
  assert.deepEqual(modulationOf(r, field(other.key)).sources, []);
  // Gap: the reading lists Field targets only (editor.ts sharedTargets). An object control has no shared source, and none is invented for it.
  assert.deepEqual(modulationOf(r, row.target).sources, [], 'an object target is never named Shared value');
});

test('every source kind is listed together in order, beside the base and the observed effective value', () => {
  const scene = base();
  const row = objectRow(scene, entity0.id, 'x');
  scene.automation = [lane({id: 'lane-a'})];
  scene.propertyTracks = [{id: 'take-a', bind: 'field.params.' + plain.key, points: [{time: 0, value: 0.4}]}];
  scene.parameterRacks = admittedRacks(scene, occurrencesWithE0);
  const r = reading(scene, {sharedTargets: [field(plain.key)], entityOccurrences: occurrencesWithE0,
    observation: {effectiveValues: {[field(plain.key)]: 0.9}}});
  const m = modulationOf(r, field(plain.key));
  assert.deepEqual(m.sources.map(source => source.kind), ['automation', 'take', 'macro', 'shared']);
  assert.equal(m.effective, 0.9);
  assert.equal(m.base, baseValue(scene, plain.key));
  const view = modulationView(m);
  assert.equal(view.named, true);
  for (const source of m.sources) assert.ok(view.driven.includes(source.name), `the visible text names ${source.name}`);
  assert.equal(view.effective, String(Number(0.9.toFixed(4))));
  assert.equal(view.base, String(Number(m.base.toFixed(4))));
  assert.ok(view.accessible.startsWith('Driven by'));
  // The object parameter is driven by its own object macro in this fixture, and by nothing Field-side: no Field lane, take or shared value leaks onto it.
  assert.deepEqual(names(modulationOf(r, row.target)), ['Spread'], 'an object target names only its own macro');
});

test('an effective value that differs from base with no named source is shown as unexplained, not hidden', () => {
  const scene = base();
  const m = modulationOf(reading(scene, {observation: {effectiveValues: {[field(plain.key)]: 123.456789}}}), field(plain.key));
  assert.deepEqual(m.sources, []);
  assert.equal(m.effective, 123.456789);
  const view = modulationView(m);
  assert.equal(view.named, false, 'no source is claimed');
  assert.equal(view.driven, 'no source named in this reading');
  assert.ok(view.accessible.startsWith('Unexplained'));
});

test('an observed value equal to base with no source shows no disclosure', () => {
  const scene = base();
  const m = modulationOf(reading(scene, {observation: {effectiveValues: {[field(plain.key)]: baseValue(scene, plain.key)}}}), field(plain.key));
  assert.equal(modulationView(m), null);
});

test('a source with no observed value yet shows the base and an effective dash, never a guessed value', () => {
  const scene = base();
  scene.automation = [lane()];
  const m = modulationOf(reading(scene), field(plain.key));
  assert.equal(m.effective, null);
  const view = modulationView(m);
  assert.equal(view.named, true);
  assert.equal(view.effective, '—');
});

test('the rack model attaches the same modulation to each compact control, and a control with no source has none', () => {
  const scene = base();
  scene.automation = [lane({id: 'speed', target: field(morphSpeed.key)})];
  const r = reading(scene, {devices: [{id: 'morph-1', family: 'morph'}]});
  const morph = rackModel.rackWidgets(r).find(widget => widget.family === 'morph');
  const speed = morph.compact.find(control => control.path === morphSpeed.path);
  assert.ok(speed, 'the morph device carries the oscillation speed control');
  assert.deepEqual(speed.modulation.sources, [{kind: 'automation', id: 'speed', name: `${morphSpeed.label} · lfo sine`}]);
  const unmodulated = morph.compact.filter(control => control.path !== morphSpeed.path);
  assert.ok(unmodulated.length > 0);
  for (const control of unmodulated) assert.deepEqual(control.modulation.sources, [], `${control.path} is not driven`);
});

test('an object device control on the rack carries its object modulation', () => {
  const scene = base();
  const r0 = reading(scene, {devices: [{id: 'force-1', family: 'force'}], selection: {entity_ids: [entity0.id], step_id: null}, entityOccurrences: occurrencesWithE0});
  const first = rackModel.rackWidgets(r0).find(widget => widget.family === 'force').compact[0];
  assert.ok(first && first.path.startsWith('entity:'), 'the force device names an object target');
  scene.automation = [lane({id: 'object-speed', target: first.path})];
  const r1 = reading(scene, {devices: r0.devices, selection: r0.selection, entityOccurrences: occurrencesWithE0});
  const control = rackModel.rackWidgets(r1).find(widget => widget.family === 'force').compact.find(row => row.path === first.path);
  assert.deepEqual(control.modulation.sources.map(source => source.id), ['object-speed']);
});

test('the rack renders the source names, base and effective; add, remove and reorder controls are still present', () => {
  const scene = base();
  scene.automation = [lane({id: 'speed', target: field(morphSpeed.key)})];
  const r = reading(scene, {devices: [{id: 'morph-1', family: 'morph'}, {id: 'glyph-1', family: 'glyph'}]});
  const html = renderToStaticMarkup(createElement(rackView.NativeDeviceRack, {reading: r, request: async () => ({ok: false, error: 'not in this test'}), onOpen: () => {}}));
  assert.ok(html.includes(escape(`Driven by ${morphSpeed.label} · lfo sine`)), 'the compact row names its automation source');
  assert.ok(html.includes('Base '), 'the compact row shows the base');
  assert.ok(html.includes('Effective '), 'the compact row shows the effective value');
  const morph = rackModel.rackWidgets(r).find(widget => widget.family === 'morph');
  assert.ok(html.includes(escape(`Remove ${morph.name} from the rack`)), 'remove is still on the widget');
  assert.ok(html.includes('+ Device'), 'add is still on the rack');
  assert.ok(html.includes(escape(`Reorder ${morph.name}: drag, or Alt+Left or Alt+Right`)), 'reorder is still on the widget');
});

test('an unmodulated rack control renders no disclosure line', () => {
  const r = reading(base(), {devices: [{id: 'morph-1', family: 'morph'}]});
  const html = renderToStaticMarkup(createElement(rackView.NativeDeviceRack, {reading: r, request: async () => ({ok: false, error: 'x'}), onOpen: () => {}}));
  assert.equal(html.includes('Driven by'), false);
  assert.equal(html.includes('Unexplained'), false);
});

test('the Field number control names every source, shows base and effective, and keeps the letter A as a mark', () => {
  // The editor opens on its default Field family (physics, no selection). SSR does not run effects, so the parameter is taken from that family.
  const physics = rackModel.deviceCatalogue().find(device => device.family === 'physics');
  const row = physics.paths.map(path => NATIVE_BINDINGS.find(binding => binding.path === path)).find(Boolean);
  assert.ok(row, 'the physics editor carries a registry parameter');
  const scene = base();
  scene.automation = [lane({id: 'speed', target: field(row.key)})];
  const r = reading(scene, {observation: {effectiveValues: {[field(row.key)]: 0.5}}});
  const html = renderToStaticMarkup(createElement(editors.NativeDeviceEditors, {reading: r, request: async () => ({ok: false, error: 'not in this test'})}));
  assert.ok(html.includes('native-modulation'), 'the number control renders its disclosure');
  assert.ok(html.includes(escape(`Driven by ${row.label} · lfo sine`)), 'the disclosure names the lane as visible text');
  assert.ok(html.includes('Base '), 'the disclosure shows the base');
  assert.ok(html.includes('Effective '), 'the disclosure shows the effective value');
  assert.ok(html.includes('native-number is-automated'), 'the control keeps its automated mark');
});
