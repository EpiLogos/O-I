import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {register} from 'node:module';

// Evaluate the actual production authoring sources without emitting a build.
// Their legacy .js specifiers and implicit type imports require TypeScript's
// existing transpiler rather than Node's syntax-only type stripping.
const root = new URL('../../../', import.meta.url);
const typescript = new URL('desktop/cradle/node_modules/typescript/lib/typescript.js', root).href;
register(`data:text/javascript,${encodeURIComponent(`
import ts from ${JSON.stringify(typescript)};
import {readFile} from 'node:fs/promises';
export async function resolve(specifier, context, next) {
  try {return await next(specifier, context)} catch (error) {
    if (specifier.startsWith('.') && specifier.endsWith('.js')) return next(specifier.slice(0,-3)+'.ts',context);
    if (specifier.startsWith('.') && !/\\.[cm]?[jt]s$/.test(specifier)) return next(specifier+'.ts',context);
    throw error;
  }
}
export async function load(url,context,next) {
  if (!url.endsWith('.ts') && !url.endsWith('.tsx')) return next(url,context);
  const source=await readFile(new URL(url),'utf8');
  return {format:'module',shortCircuit:true,source:ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.ReactJSX},fileName:new URL(url).pathname}).outputText};
}
`)}`, import.meta.url);
const [{blankJourney, entity, clone, validateJourney}, {DocumentStore}, {toNativeConfig}, {applyAutomations, createAutomationRuntime}, {compileEntityForceEmitters}, {PARAM_REGISTRY, entityParamDefs, NATIVE_BINDINGS}, {nativeRackMappingValue, validateNativeRackState}, {applyNativeRackChanges, readNativeRacks}, {readNativeDeviceEffectiveValues}] = await Promise.all([
  import('../../../desktop/cradle/expressions-app/field-studies-journeys/src/model.ts'),
  import('../../../desktop/cradle/expressions-app/field-studies-journeys/src/store.ts'),
  import('../../../desktop/cradle/expressions-app/field-studies-journeys/src/nativeBridge.ts'),
  import('../../../desktop/cradle/expressions-app/src/engine/automation.ts'),
  import('../../../desktop/cradle/expressions-app/src/engine/forceRuntime.ts'),
  import('../src/parameters.ts'), import('../src/nativeRackSchema.ts'), import('../src/nativeRacks.ts'), import('../src/nativeDeviceEdits.ts'),
]);

function basis() {
  const journey = blankJourney(), scene = journey.scenes[0], body = entity('Native body', 'R');
  scene.entities = [body]; body.force.kind = 'vortex';
  const ref = 'expression:actual:entity:' + body.id, occurrences = {[body.id]: ref};
  const rack = {schema: 'oi.parameter-rack/v1', id: 'rack:actual', title: 'Influence', scope: {kind: 'entity', entity_ref: ref}, macros: [
    {id: 'macro:strength', name: 'Strength and radius', value: .5, mappings: [
      {id: 'map:strength', target: {kind: 'entity', entity_ref: ref, path: 'forces.strength'}, min: -4, max: 8, unit: 'scalar', law: 'linear'},
      {id: 'map:radius', target: {kind: 'entity', entity_ref: ref, path: 'forces.radius'}, min: 20, max: 2000, unit: 'px', law: 'log'},
    ]},
    {id: 'macro:spin', name: 'Spin', value: .5, mappings: [{id: 'map:spin', target: {kind: 'entity', entity_ref: ref, path: 'forces.spin'}, min: 4, max: -4, unit: 'scalar', law: 'linear'}]},
  ], excluded: [], variations: []};
  return {journey, scene, body, ref, occurrences, rack};
}
const install = ({journey, scene, rack, occurrences}) => applyNativeRackChanges(journey, scene.id, [{kind: 'rack-set', rack}], occurrences);
const macro = (id, value) => ({kind: 'rack-macro-value', rack_id: 'rack:actual', macro_id: id, value});

test('one macro compiles native force strength and logarithmic radius with exact native units', () => {
  const input = basis(), inserted = install(input), before = clone(inserted);
  const next = applyNativeRackChanges(inserted, input.scene.id, [macro('macro:strength', .5)], input.occurrences);
  const native = toNativeConfig(next.scenes[0]), emitter = compileEntityForceEmitters(native.entities, []).find(value => value.sourceEntityId === input.body.id);
  assert.ok(emitter); assert.equal(emitter.strength, 2); assert.ok(Math.abs(emitter.radius - 200) < 1e-10);
  assert.equal(next.scenes[0].entities[0].force.radius, emitter.radius / 400);
  assert.deepEqual(inserted, before, 'no edits leak into caller');
  const reversed = applyNativeRackChanges(next, input.scene.id, [macro('macro:spin', .25)], input.occurrences);
  assert.equal(toNativeConfig(reversed.scenes[0]).entities[0].forces.spin, 2);
  assert.equal(readNativeRacks(reversed.scenes[0], input.occurrences).racks[0].macros[1].value, .25);
});

test('rack macro and all device parameters remain a single real DocumentStore undo operation', () => {
  const input = basis(), store = new DocumentStore(install(input));
  const initial = clone(store.document);
  store.change(draft => Object.assign(draft, applyNativeRackChanges(draft, input.scene.id, [macro('macro:strength', .75)], input.occurrences)));
  const written = clone(store.document);
  assert.equal(written.scenes[0].entities[0].force.strength, 5);
  assert.equal(written.scenes[0].parameterRacks.racks[0].macros[0].value, .75);
  store.undo(); assert.deepEqual(store.document, initial); assert.equal(store.undoStack.length, 0);
  store.redo(); assert.deepEqual(store.document, written);
  const reopened = validateJourney(JSON.parse(JSON.stringify(written)));
  assert.deepEqual(readNativeRacks(reopened.scenes[0], input.occurrences), readNativeRacks(written.scenes[0], input.occurrences));
});

test('captured variation recall respects current and captured exclusions through the native reducer', () => {
  const input = basis(); let doc = install(input);
  doc = applyNativeRackChanges(doc, input.scene.id, [macro('macro:strength', .25), macro('macro:spin', .25), {kind: 'rack-variation-capture', rack_id: input.rack.id, variation_id: 'variation:soft', name: 'Soft'}], input.occurrences);
  doc = applyNativeRackChanges(doc, input.scene.id, [macro('macro:strength', .9), macro('macro:spin', .9), {kind: 'rack-exclusions', rack_id: input.rack.id, macro_ids: ['macro:spin']}], input.occurrences);
  const next = applyNativeRackChanges(doc, input.scene.id, [{kind: 'rack-variation-recall', rack_id: input.rack.id, variation_id: 'variation:soft'}], input.occurrences);
  assert.equal(toNativeConfig(next.scenes[0]).entities[0].forces.strength, -1);
  assert.equal(toNativeConfig(next.scenes[0]).entities[0].forces.spin, -3.2);
  assert.equal(next.scenes[0].parameterRacks.racks[0].macros[1].value, .9);
  const captured = clone(input.rack); captured.excluded = ['macro:strength'];
  doc = applyNativeRackChanges(install({...input, rack: captured}), input.scene.id, [{kind: 'rack-variation-capture', rack_id: captured.id, variation_id: 'variation:excluded', name: 'Exclude strength'}, macro('macro:strength', .8), {kind: 'rack-exclusions', rack_id: captured.id, macro_ids: []}], input.occurrences);
  const recall = applyNativeRackChanges(doc, input.scene.id, [{kind: 'rack-variation-recall', rack_id: captured.id, variation_id: 'variation:excluded'}], input.occurrences);
  assert.equal(recall.scenes[0].parameterRacks.racks[0].macros[0].value, .8);
});

test('automation remains on its actual clock and rack adjustment offsets the production evaluated output', () => {
  const input = basis(), target = 'entity:' + encodeURIComponent(input.body.id) + ':forces.strength';
  input.scene.automation = [{id: 'clock:actual', enabled: true, target, type: 'lfo', wave: 'sine', min: 0, max: 4, rate: .5, phase: 0, blend: 'replace', duration: 4, delay: 0, loop: 'loop', firedAt: null}];
  const doc = install(input), native = toNativeConfig(doc.scenes[0]);
  const evaluated = applyAutomations(native, native.automations, 0, createAutomationRuntime()).config;
  const observed = readNativeDeviceEffectiveValues(doc.scenes[0], {config: evaluated});
  assert.equal(observed[target], 2);
  assert.throws(() => applyNativeRackChanges(doc, input.scene.id, [macro('macro:strength', .75)], input.occurrences), /effective automated/);
  const next = applyNativeRackChanges(doc, input.scene.id, [macro('macro:strength', .75)], input.occurrences, observed);
  assert.equal(next.scenes[0].automation[0].min, 3); assert.equal(next.scenes[0].automation[0].max, 7);
  assert.equal(next.scenes[0].automation[0].rate, .5); assert.equal(next.scenes[0].automation[0].id, 'clock:actual');
  const actual = toNativeConfig(next.scenes[0]);
  assert.equal(applyAutomations(actual, actual.automations, 0, createAutomationRuntime()).config.entities[0].forces.strength, 5);
});

test('off-page scope remains readable, refuses edits and never rebinds to another entity', () => {
  const input = basis(), doc = install(input), scene = doc.scenes[0];
  const reordered = clone(input.rack); reordered.scope = {entity_ref: input.ref, kind: 'entity'};
  assert.equal(applyNativeRackChanges(doc, scene.id, [{kind: 'rack-set', rack: reordered}], input.occurrences).scenes[0].parameterRacks.racks[0].scope.entity_ref, input.ref, 'native JSON object ordering cannot become a false rebind');
  scene.entities = [entity('Another native body', 'S')];
  const occurrences = {[scene.entities[0].id]: 'expression:actual:entity:other'}, previous = clone(scene.entities[0].force);
  assert.equal(readNativeRacks(scene, occurrences).racks[0].scope.entity_ref, input.ref);
  assert.throws(() => applyNativeRackChanges(doc, scene.id, [macro('macro:strength', .25)], occurrences), /off-page/);
  const rebound = clone(input.rack); rebound.scope.entity_ref = occurrences[scene.entities[0].id];
  rebound.macros.forEach(macro => macro.mappings.forEach(mapping => {mapping.target.entity_ref = rebound.scope.entity_ref}));
  assert.throws(() => applyNativeRackChanges(doc, scene.id, [{kind: 'rack-set', rack: rebound}], occurrences), /rebound/);
  assert.deepEqual(scene.entities[0].force, previous);
});

test('registry admission rejects invented paths, wrong units, bounds, invalid laws and duplicate native targets', () => {
  const input = basis();
  for (const mutation of ['path', 'unit', 'range', 'log', 'scope', 'duplicate', 'variation', 'macro-value']) {
    const rack = clone(input.rack), mapping = rack.macros[0].mappings[0];
    if (mutation === 'path') mapping.target.path = 'native.fakeParameter';
    if (mutation === 'unit') mapping.unit = 'px';
    if (mutation === 'range') mapping.max = 1001;
    if (mutation === 'log') mapping.law = 'log';
    if (mutation === 'scope') mapping.target.entity_ref = 'expression:foreign:entity:other';
    if (mutation === 'duplicate') rack.macros[1].mappings.push({...mapping, id: 'map:duplicate', target: {path: mapping.target.path, entity_ref: mapping.target.entity_ref, kind: 'entity'}});
    if (mutation === 'variation') rack.variations.push({id: 'variation:bad', name: 'Bad', values: {}, excluded: []});
    if (mutation === 'macro-value') rack.macros[0].value = NaN;
    assert.throws(() => validateNativeRackState({schema: 'oi.parameter-racks/v1', racks: [rack]}, input.scene, input.occurrences), undefined, mutation);
  }
  const doc = install(input), before = clone(doc);
  assert.throws(() => applyNativeRackChanges(doc, input.scene.id, [macro('macro:strength', .25), macro('macro:strength', .75)], input.occurrences), /same native target twice/);
  assert.deepEqual(doc, before);
  doc.scenes[0].entities[0].locked = true;
  assert.throws(() => applyNativeRackChanges(doc, input.scene.id, [macro('macro:strength', .25)], input.occurrences), /Unlock/);
});

test('Field rack addresses the shared solver directly and rounds native discrete cardinality', () => {
  const input = basis(), rack = {schema: 'oi.parameter-rack/v1', id: 'rack:field', title: 'Solver', scope: {kind: 'field'}, macros: [{id: 'macro:grid', name: 'Grid', value: .5, mappings: [{id: 'map:grid', target: {kind: 'field', path: 'medium.gridRes'}, min: 16, max: 1024, unit: 'scalar', law: 'linear'}]}], excluded: [], variations: []};
  const doc = install({...input, rack});
  const next = applyNativeRackChanges(doc, input.scene.id, [{kind: 'rack-macro-value', rack_id: rack.id, macro_id: 'macro:grid', value: .123}], input.occurrences);
  assert.equal(toNativeConfig(next.scenes[0]).medium.gridRes, Math.round(16 + .123 * 1008));
  assert.ok(Math.abs(nativeRackMappingValue({...rack.macros[0].mappings[0], min: 2, max: 8, law: 'log'}, .5) - 4) < 1e-10);
});

test('Rust admission registry is an exact projection of the source registry, including native units and bounds', async () => {
  const rust = await readFile(new URL('../../../desktop/cradle/kernel/src/expression_parameter_rack.rs', import.meta.url), 'utf8');
  const actual = [...rust.matchAll(/\("(field|entity)", "([^"]+)", ([-\deE.]+), ([-\deE.]+), "([^"]+)"\),/g)].map(match => ({kind: match[1], path: match[2], min: Number(match[3]), max: Number(match[4]), unit: match[5]}));
  const expected = [...PARAM_REGISTRY.map(def => ({kind: 'field', path: def.path, min: def.hardMin, max: def.hardMax, unit: def.unit ?? 'scalar'})), ...entityParamDefs(0, {}).map(def => ({kind: 'entity', path: def.path.replace('entities.0.', ''), min: def.hardMin, max: def.hardMax, unit: def.unit ?? 'scalar'}))];
  assert.deepEqual(actual, expected);
  assert.equal(NATIVE_BINDINGS.length, PARAM_REGISTRY.length);
});


test('receiving authorization checks each actual native mapping and refuses the entire clone', () => {
  const input = basis(), doc = install(input), before = clone(doc), checked = [];
  assert.throws(() => applyNativeRackChanges(doc, input.scene.id, [macro('macro:strength', .75)], input.occurrences, {}, (target, mapping, nativeValue) => {
    checked.push({target, unit: mapping.unit, min: mapping.min, max: mapping.max, nativeValue});
    if (target.path === 'forces.radius') throw Error('Native occurrence authority refused this target');
  }), /authority refused/);
  assert.deepEqual(doc, before);
  assert.equal(checked.length, 2);
  assert.deepEqual(checked[0], {target: {kind: 'entity', entity_ref: input.ref, path: 'forces.strength'}, unit: 'scalar', min: -4, max: 8, nativeValue: 5});
  assert.equal(checked[1].unit, 'px'); assert.equal(checked[1].min, 20); assert.equal(checked[1].max, 2000);
  assert.ok(Math.abs(checked[1].nativeValue - Math.sqrt(400000)) < 1e-10);
});


test('logarithmic legal hard endpoints remain exact through native Field projection', () => {
  const input = basis(), definition = PARAM_REGISTRY.find(value => value.path === 'cymatics.dampingQFactor');
  const rack = {schema: 'oi.parameter-rack/v1', id: 'rack:limits', title: 'Q limits', scope: {kind: 'field'}, macros: [{id: 'macro:limits', name: 'Q', value: .5, mappings: [{id: 'map:limits', target: {kind: 'field', path: definition.path}, min: definition.hardMin, max: definition.hardMax, unit: definition.unit ?? 'scalar', law: 'log'}]}], excluded: [], variations: []};
  const doc = install({...input, rack});
  for (const [value, expected] of [[0, definition.hardMin], [1, definition.hardMax]]) {
    const actual = applyNativeRackChanges(doc, input.scene.id, [{kind: 'rack-macro-value', rack_id: rack.id, macro_id: 'macro:limits', value}], input.occurrences);
    assert.equal(toNativeConfig(actual.scenes[0]).cymatics.dampingQFactor, expected);
  }
});
