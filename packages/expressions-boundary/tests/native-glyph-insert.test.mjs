import test from 'node:test';
import assert from 'node:assert/strict';
import {register} from 'node:module';

// Production TypeScript sources through the app's own transpiler (same setup as
// native-object-edits.test.mjs). Covers the state-insert and clear/reorder
// glyph changes that the Glyph Sequence editor sends.
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
const author = new URL('desktop/cradle/expressions-app/field-studies-journeys/src/', root);
const [{applyNativeGlyphChanges}, {blankJourney, entity, clone, validateJourney}] = await Promise.all([
  import(new URL('hostEditor.ts', author)),
  import(new URL('model.ts', author)),
]);

function fixture() {
  const doc = blankJourney(), scene = doc.scenes[0], body = entity('Body', 'A');
  scene.engine.autoFitSizes = false;
  body.sequence.steps = [
    {id: 'step:a', text: 'A', shape: 'text', hold: 1, transition: 1, holdOverride: true, transitionOverride: true, position: null},
    {id: 'step:b', text: 'B', shape: 'text', hold: 2, transition: 1, holdOverride: true, transitionOverride: true, position: {x: 1, y: 2, z: 0}},
  ];
  body.sequence.enabled = true;
  body.layers = undefined;
  scene.entities = [body];
  validateJourney(doc);
  return {doc, scene, body};
}
const apply = (doc, changes) => applyNativeGlyphChanges(doc, doc.scenes[0].id, changes);
const sourceOf = kind => kind === 'ascii' ? {kind: 'ascii', ascii: {text: 'O  :  I', fontFamily: 'monospace', fontSize: 32}} : {kind: 'image', image: {mode: 'luminance', threshold: 0.24, invert: false, scale: 1}};

test('step-insert after a middle state places the new state there and keeps every other state identical', () => {
  const {doc, body} = fixture();
  const before = clone(body.sequence.steps);
  const next = apply(doc, [{kind: 'step-insert', entity_id: body.id, after_step_id: 'step:a', text: 'X'}]);
  const steps = next.scenes[0].entities[0].sequence.steps;
  assert.equal(steps.length, 3);
  assert.equal(steps[1].text, 'X');
  assert.equal(steps[1].shape, 'text');
  assert.equal(steps[0].id, 'step:a');
  assert.equal(steps[2].id, 'step:b');
  // Existing states keep their identity, text, timing and offset; the insert also captures each
  // one's base appearance (appendFormationState) so that the edit leaves what they look like unchanged.
  const withoutAppearance = ({objectState, ...rest}) => rest;
  assert.deepEqual(withoutAppearance(steps[0]), withoutAppearance(before[0]));
  assert.deepEqual(withoutAppearance(steps[2]), withoutAppearance(before[1]));
  assert.ok(steps[0].objectState && steps[2].objectState, 'the base appearance is captured on the existing states');
  assert.notEqual(steps[1].id, 'step:a');
  assert.equal(doc.scenes[0].entities[0].sequence.steps.length, 2, 'the captured journey is not mutated');
});

test('step-insert with a null destination inserts at the head of the sequence', () => {
  const {doc, body} = fixture();
  const next = apply(doc, [{kind: 'step-insert', entity_id: body.id, after_step_id: null, text: 'H'}]);
  const steps = next.scenes[0].entities[0].sequence.steps;
  assert.equal(steps[0].text, 'H');
  assert.equal(steps[1].id, 'step:a');
});

test('step-insert with an ASCII source carries that source on the new state and no other', () => {
  const {doc, body} = fixture();
  const source = {kind: 'ascii', ascii: {text: 'O  :  I', fontFamily: 'monospace', fontSize: 32}};
  const next = apply(doc, [{kind: 'step-insert', entity_id: body.id, after_step_id: 'step:b', text: 'A', source}]);
  const steps = next.scenes[0].entities[0].sequence.steps;
  assert.deepEqual(steps[2].source, source);
  assert.equal(steps[1].source, undefined);
  assert.equal(steps[0].source, undefined);
});

test('step-insert with auto-fit on (the app default) admits ASCII and image states with their sources', () => {
  const {doc, body, scene} = fixture();
  scene.engine.autoFitSizes = true;
  const ascii = sourceOf('ascii'), image = sourceOf('image');
  const next = apply(doc, [
    {kind: 'step-insert', entity_id: body.id, after_step_id: 'step:a', text: 'O', source: ascii},
    {kind: 'step-insert', entity_id: body.id, after_step_id: 'step:a', text: 'O', source: image},
  ]);
  const steps = next.scenes[0].entities[0].sequence.steps;
  assert.equal(steps.length, 4);
  assert.deepEqual(steps[1].source, image, 'the later insert lands directly after the anchor');
  assert.deepEqual(steps[2].source, ascii);
  assert.equal(steps[1].source.image.dataUrl, undefined, 'an image state waits for its file in the Studio');
  assert.ok(Number.isFinite(steps[2].size?.x ?? steps[2].objectState?.size?.x ?? 0));
});

test('step-insert refuses a vanished destination, a locked formation and a full sequence', () => {
  const {doc, body} = fixture();
  assert.throws(() => apply(doc, [{kind: 'step-insert', entity_id: body.id, after_step_id: 'step:gone', text: 'X'}]), /insertion destination/);
  const locked = clone(doc);
  locked.scenes[0].entities[0].locked = true;
  assert.throws(() => apply(locked, [{kind: 'step-insert', entity_id: body.id, after_step_id: 'step:a', text: 'X'}]), /Unlock this formation/);
  const full = clone(doc);
  const steps = full.scenes[0].entities[0].sequence.steps;
  while (steps.length < 32) steps.push({...clone(steps[0]), id: 'step:' + steps.length});
  assert.throws(() => apply(full, [{kind: 'step-insert', entity_id: body.id, after_step_id: 'step:a', text: 'X'}]), /32 states/);
});

test('step-position null clears a state offset and keeps the state itself', () => {
  const {doc, body} = fixture();
  const next = apply(doc, [{kind: 'step-position', entity_id: body.id, step_id: 'step:b', position: null}]);
  const state = next.scenes[0].entities[0].sequence.steps[1];
  assert.equal(state.position, null);
  assert.equal(state.text, 'B');
  assert.equal(state.hold, 2);
  assert.deepEqual(doc.scenes[0].entities[0].sequence.steps[1].position, {x: 1, y: 2, z: 0});
});

test('step-layers replaces the list with the full new order and refuses a duplicate identity or more than six layers', () => {
  const {doc, body} = fixture();
  const layers = [{id: 'layer:1', text: 'one', z: 0, scale: 1}, {id: 'layer:2', text: 'two', z: 0.5, scale: 1}, {id: 'layer:3', text: 'three', z: 1, scale: 1}];
  const withLayers = apply(doc, [{kind: 'step-layers', entity_id: body.id, step_id: 'step:a', layers}]);
  const reordered = [layers[1], layers[0], layers[2]];
  const next = apply(withLayers, [{kind: 'step-layers', entity_id: body.id, step_id: 'step:a', layers: reordered}]);
  assert.deepEqual(next.scenes[0].entities[0].sequence.steps[0].layers.map(layer => layer.id), ['layer:2', 'layer:1', 'layer:3']);
  assert.throws(() => apply(doc, [{kind: 'step-layers', entity_id: body.id, step_id: 'step:a', layers: [layers[0], layers[0]]}]), /uniquely identified/);
  const seven = Array.from({length: 7}, (_, index) => ({id: 'layer:' + index, text: 'x', z: 0, scale: 1}));
  assert.throws(() => apply(doc, [{kind: 'step-layers', entity_id: body.id, step_id: 'step:a', layers: seven}]), /six uniquely identified layers/);
});
