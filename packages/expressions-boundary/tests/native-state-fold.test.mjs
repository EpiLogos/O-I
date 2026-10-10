import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {register} from 'node:module';

// Production TypeScript sources through the app's own transpiler (same setup as native-glyph-insert.test.mjs).
// Covers the state-fold change: the reducer over the Journey, its validator, the destination projection and the
// drift of the app's own foldObjectState that the reducer reuses.
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
const [fold, {blankScene, blankJourney, entity, validateJourney, clone}] = await Promise.all([
  import(new URL('../src/nativeStateFold.ts', import.meta.url)),
  import(new URL('model.ts', author)),
]);
const {readNativeFoldTargets, applyNativeStateFoldChanges, validateNativeFoldChange, isNativeFoldTargets, FOLD_MODES, FORMATION_STATE_LIMIT} = fold;

const steps = (prefix, n) => Array.from({length: n}, (_, i) => ({id: `${prefix}-${i}`, text: `${prefix}${i}`, shape: 'text', hold: 3, transition: 1, position: null, layers: []}));
function formation(name, {x = 0, count = 1, prefix = name.toLowerCase(), locked = false} = {}) {
  const e = entity(name, 'O', {x, y: 0, z: 0});
  e.id = `${prefix}-entity`;
  e.sequence.steps = steps(prefix, count);
  e.locked = locked;
  return e;
}
/** Opening (earlier) and Closing (presented). The Source formation has two states; the Target one.
 * Journey shape is validated exactly as the app loads it. */
function fixture() {
  const opening = blankScene('Opening'), closing = blankScene('Closing');
  opening.id = 'scene-opening'; closing.id = 'scene-closing';
  opening.entities = [formation('Target', {prefix: 'target', count: 1})];
  closing.entities = [formation('Source', {x: 0.5, count: 2, prefix: 'source'}), formation('Later', {prefix: 'later'})];
  closing.entities[0].sequence.steps[1].layers = [{id: 'layer-b', text: 'B', z: 0}];
  return validateJourney({...blankJourney(), id: 'journey-fold', scenes: [opening, closing], savedScenes: {}});
}

test('destinations are formations of earlier Scenes that are unlocked, under budget and not blueprint members', () => {
  const journey = fixture();
  assert.deepEqual(readNativeFoldTargets(journey, 'scene-closing').map(t => t.entity_id), ['target-entity']);
  assert.equal(readNativeFoldTargets(journey, 'scene-opening').length, 0, 'the first Scene has no earlier destination');
  assert.equal(readNativeFoldTargets(journey, 'missing-scene').length, 0);
  const locked = clone(journey); locked.scenes[0].entities[0].locked = true;
  assert.equal(readNativeFoldTargets(locked, 'scene-closing').length, 0, 'a locked formation is not offered');
  const full = clone(journey); full.scenes[0].entities[0].sequence.steps = steps('full', FORMATION_STATE_LIMIT);
  assert.equal(readNativeFoldTargets(full, 'scene-closing').length, 0, 'a formation at 32 states is not offered');
  const row = readNativeFoldTargets(journey, 'scene-closing')[0];
  assert.deepEqual(row, {scene_id: 'scene-opening', scene_title: 'Opening', entity_id: 'target-entity', entity_name: 'Target', steps: 1});
  assert.equal(isNativeFoldTargets([row]), true);
  assert.equal(isNativeFoldTargets([{...row, steps: 0}]), false);
  assert.equal(isNativeFoldTargets([{...row, steps: FORMATION_STATE_LIMIT + 1}]), false);
  assert.equal(isNativeFoldTargets([{...row, entity_id: 3}]), false);
  assert.equal(isNativeFoldTargets('nope'), false);
});

test('the validator admits exactly one state fold and refuses foreign operands and unknown options', () => {
  const change = {kind: 'state-fold', entity_id: 'source-entity', step_id: 'source-0', target_entity_id: 'target-entity'};
  assert.deepEqual(validateNativeFoldChange(change), change);
  assert.deepEqual(validateNativeFoldChange({...change, remove_source: true, mode: 'manual'}), {...change, remove_source: true, mode: 'manual'});
  assert.deepEqual(FOLD_MODES, ['seconds', 'morph', 'manual']);
  assert.throws(() => validateNativeFoldChange({...change, scene_id: 'scene-opening'}), /only its state/);
  assert.throws(() => validateNativeFoldChange({...change, mode: 'pulse'}), /playback mode/);
  assert.throws(() => validateNativeFoldChange({...change, remove_source: 'yes'}), /yes or no/);
  assert.throws(() => validateNativeFoldChange({...change, kind: 'step-insert'}), /Choose a state/);
  assert.throws(() => validateNativeFoldChange({...change, target_entity_id: undefined}), /Choose a state/);
  assert.throws(() => validateNativeFoldChange(null), /Choose a state/);
});

test('a fold copies the state into the earlier formation as a fresh state, and leaves the source as it was', () => {
  const journey = fixture(), before = structuredClone(journey);
  const next = applyNativeStateFoldChanges(journey, 'scene-closing', [{kind: 'state-fold', entity_id: 'source-entity', step_id: 'source-1', target_entity_id: 'target-entity'}]);
  const target = next.scenes[0].entities[0], source = next.scenes[1].entities[0];
  assert.equal(target.sequence.steps.length, 2, 'one state is added to the destination');
  const added = target.sequence.steps[1];
  assert.notEqual(added.id, 'source-1', 'the state gets a fresh stable id');
  assert.equal(added.text, 'source1', 'the copied glyph is the chosen state');
  assert.equal(added.name, 'Source', 'the copied state takes the object name, as the app does');
  assert.equal(added.holdOverride, true);
  assert.equal(added.transitionOverride, true);
  assert.equal(added.position.x, 0.5, 'the offset is the source position relative to the destination');
  assert.equal(added.native, undefined, 'a copied native link identity is not kept');
  assert.equal(added.layers.length, 1);
  assert.notEqual(added.layers[0].id, 'layer-b', 'layers get fresh ids');
  assert.equal(target.sequence.enabled, true, 'seconds playback is the dialog default');
  assert.equal(target.sequence.clock, 'seconds');
  assert.equal(source.sequence.steps.length, 2, 'without remove_source the source keeps every state');
  assert.deepEqual(journey, before, 'the input journey is never mutated');
});

test('remove_source takes the state out of its own formation, and a last state is refused', () => {
  const journey = fixture();
  const next = applyNativeStateFoldChanges(journey, 'scene-closing', [{kind: 'state-fold', entity_id: 'source-entity', step_id: 'source-0', target_entity_id: 'target-entity', remove_source: true}]);
  assert.deepEqual(next.scenes[1].entities[0].sequence.steps.map(s => s.id), ['source-1']);
  assert.equal(next.scenes[0].entities[0].sequence.steps.length, 2);
  assert.equal(next.scenes.length, 2, 'the working Scene is not removed');
  assert.throws(() => applyNativeStateFoldChanges(next, 'scene-closing', [{kind: 'state-fold', entity_id: 'source-entity', step_id: 'source-1', target_entity_id: 'target-entity', remove_source: true}]), /Keep at least one state/);
});

test('playback modes set the destination as the app fold does, and manual also sets the destination scene field', () => {
  const journey = fixture();
  const morph = applyNativeStateFoldChanges(journey, 'scene-closing', [{kind: 'state-fold', entity_id: 'source-entity', step_id: 'source-0', target_entity_id: 'target-entity', mode: 'morph'}]);
  assert.equal(morph.scenes[0].entities[0].sequence.clock, 'morph');
  assert.equal(morph.scenes[0].entities[0].sequence.enabled, true);
  const manual = applyNativeStateFoldChanges(journey, 'scene-closing', [{kind: 'state-fold', entity_id: 'source-entity', step_id: 'source-0', target_entity_id: 'target-entity', mode: 'manual'}]);
  assert.equal(manual.scenes[0].entities[0].sequence.manual, true);
  assert.equal(manual.scenes[0].entities[0].sequence.enabled, false);
  assert.equal(manual.scenes[0].engine.autoOscillate, false, 'manual playback turns the destination Scene’s oscillation off, as foldObjectState does');
  assert.equal(manual.scenes[0].engine.morphEnabled, true);
});

test('each refusal names its reason, and a batch with one refused fold changes nothing', () => {
  const journey = fixture();
  const fold = (over) => ({kind: 'state-fold', entity_id: 'source-entity', step_id: 'source-0', target_entity_id: 'target-entity', ...over});
  const run = (over) => applyNativeStateFoldChanges(journey, 'scene-closing', [fold(over)]);
  assert.throws(() => run({step_id: 'gone'}), /no longer exists/);
  assert.throws(() => run({target_entity_id: 'later-entity'}), /Choose an earlier scene/);
  assert.throws(() => run({target_entity_id: 'nowhere'}), /no longer in this Expression/);
  assert.throws(() => applyNativeStateFoldChanges(journey, 'scene-closing', [fold({entity_id: 'later-entity', step_id: 'later-0', target_entity_id: 'later-entity'})]), /Choose an earlier scene/);
  const locked = clone(journey); locked.scenes[1].entities[0].locked = true;
  assert.throws(() => applyNativeStateFoldChanges(locked, 'scene-closing', [fold({})]), /Unlock this formation before folding/);
  const lockedTarget = clone(journey); lockedTarget.scenes[0].entities[0].locked = true;
  assert.throws(() => applyNativeStateFoldChanges(lockedTarget, 'scene-closing', [fold({})]), /Unlock the destination formation first/);
  const full = clone(journey); full.scenes[0].entities[0].sequence.steps = steps('full', FORMATION_STATE_LIMIT);
  assert.throws(() => applyNativeStateFoldChanges(full, 'scene-closing', [fold({})]), /up to 32 states/);
  const blueprint = clone(journey); blueprint.scenes[1].composition.blueprint = {members: [{entity_ref: 'source-entity'}]};
  assert.throws(() => applyNativeStateFoldChanges(blueprint, 'scene-closing', [fold({})]), /Blueprint/);
  assert.throws(() => applyNativeStateFoldChanges(journey, 'scene-missing', [fold({})]), /no longer in this Expression/);
  assert.throws(() => applyNativeStateFoldChanges(journey, 'scene-closing', []), /between 1 and 64/);
  // First fold is valid, second is refused: the whole batch is rejected and the input is untouched.
  const before = structuredClone(journey);
  assert.throws(() => applyNativeStateFoldChanges(journey, 'scene-closing', [fold({}), fold({step_id: 'gone'})]), /no longer exists/);
  assert.deepEqual(journey, before);
});

test('the reducer reuses the app fold: its source still carries the same dialog-driven call', async () => {
  const foldSource = await readFile(new URL('foldState.ts', author), 'utf8');
  assert.match(foldSource, /export function foldObjectState\(j:Journey,fromSceneId:string,objectId:string,stepIndex:number,toSceneId:string,targetId:string,mode:'seconds'\|'morph'\|'manual',removeSource=false\)\{/);
  const app = await readFile(new URL('app.ts', author), 'utf8');
  assert.match(app, /const result=foldObjectState\(store\.document,dialog\.dataset\.sourceScene!,dialog\.dataset\.sourceEntity!,Number\(dialog\.dataset\.sourceStep\),to,target,mode,\$<HTMLInputElement>\('fold-remove'\)\.checked\);/);
  const reducer = await readFile(new URL('../src/nativeStateFold.ts', import.meta.url), 'utf8');
  assert.match(reducer, /foldObjectState\(draft, scene\.id, source\.id, stepIndex, to\.id, target\.id, change\.mode \?\? 'seconds', false\);/);
});

test('routed through the retained editor, a fold into an earlier Scene reaches the native compile as that formation’s own state', async () => {
  const author = new URL('desktop/cradle/expressions-app/field-studies-journeys/src/', root);
  const [{kernelDocumentToJourney}, {DocumentStore}, {createRetainedNativeEditor}, {prepareCompositionEdit}] = await Promise.all([
    import(new URL('kernelDocumentBridge.ts', author)), import(new URL('store.ts', author)), import(new URL('hostEditor.ts', author)), import(new URL('kernelComposition.ts', author)),
  ]);
  const {readFileSync} = await import('node:fs');
  const receipt = '/Users/admin/Central/Work/reverse-engineering/2026-10-07-techne-instrument-re/new-shell/evidence/native/material-verification-c79dab7c-8de3-4b69-87cb-ee11cce28c9f/rich-artifact-inspection-3a33a7f6-94e9-445d-b2ec-7e7f25950935.json';
  const view = kernelDocumentToJourney(JSON.parse(readFileSync(receipt, 'utf8')).after.document);
  const store = new DocumentStore(view.journey);
  const presented = store.document.scenes.find(row => row.id === view.startSceneId);
  const earlier = blankScene('Opening');
  earlier.entities = [formation('Earlier', {prefix: 'earlier'})];
  store.document.scenes.unshift(earlier);
  const owner = createRetainedNativeEditor({
    store, sceneId: () => presented.id, selection: () => ({entity_ids: [presented.entities[0].id], step_id: presented.entities[0].sequence.steps[0].id}), nativeView: () => view,
    nativeSelect: async () => 'applied', commit: async () => true, change: mutate => mutate(), afterHistory: () => {}, selectLocal: () => {}, openEditor: () => {},
    standing: () => ({busy: false, notice: null}), telemetry: () => undefined, fieldPaused: () => false,
  });
  const reading = owner.read();
  assert.deepEqual(reading.foldTargets.map(row => [row.scene_title, row.entity_name]), [['Opening', 'Earlier']]);
  const source = presented.entities[0];
  await owner.apply({operation: 'apply', basis: reading.basis, changes: [{kind: 'state-fold', entity_id: source.id, step_id: source.sequence.steps[0].id, target_entity_id: 'earlier-entity'}]});
  assert.equal(store.document.scenes[0].entities[0].sequence.steps.length, 2);
  const compiled = prepareCompositionEdit(view, store.document).changes.filter(change => change.change === 'scene_material_set');
  const opening = compiled.find(change => change.presentation.scene.name === 'Opening');
  assert.ok(opening, 'the earlier Scene is compiled with the fold');
  assert.equal(opening.presentation.scene.entities.find(entity => entity.name === 'Earlier').sequence.steps.length, 2);
  assert.deepEqual(reading.foldTargets.length, 1, 'the read before the fold offered the earlier formation');
});

