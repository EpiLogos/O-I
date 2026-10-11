import test from 'node:test';
import assert from 'node:assert/strict';
import {register} from 'node:module';

// Production TypeScript sources through the app's own transpiler (same setup as
// native-object-edits.test.mjs). These pin the exact request shapes that the
// scene-snapshot and chosen-control controls send.
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
const [{prepareNativeSceneSnapshot}, {applyNativeChosenControlChanges}, {entityTargets}, {blankJourney, entity, clone}, {initialiseShared}] = await Promise.all([
  import(new URL('../src/sceneEdits.ts', import.meta.url)),
  import(new URL('../src/chosenControls.ts', import.meta.url)),
  import(new URL('../src/parameters.ts', import.meta.url)),
  import(new URL('model.ts', author)),
  import(new URL('sharedSettings.ts', author)),
]);

const SCENE = 'scene:main', BASIS = {expression_ref: 'expression:snap', revision: 4, scene_ref: SCENE, authored_revision: 9};
function reading(overrides = {}) {
  const row = {scene_ref: SCENE, title: 'Main', material: {available: true}, membership: {complete: true}, snapshot: {availability: 'present'}};
  return {
    basis: clone(BASIS),
    playback: {intent_epoch: 7},
    scenes: {native_selected_scene_ref: SCENE, working_order: [SCENE], scenes: [row]},
    ...overrides,
  };
}

test('restore-snapshot sends exactly the scene operation the Restore control sends', () => {
  const request = prepareNativeSceneSnapshot(reading(), {operation: 'restore-snapshot', scene_ref: SCENE});
  assert.deepEqual(request, {operation: 'scene', basis: BASIS, intent_epoch: 7, action: 'restore-snapshot'});
});

test('restore-snapshot is refused without a present saved snapshot, native focus, complete membership or a current epoch', () => {
  const noSnapshot = reading({scenes: {native_selected_scene_ref: SCENE, working_order: [SCENE], scenes: [{scene_ref: SCENE, title: 'Main', material: {available: true}, membership: {complete: true}, snapshot: {availability: 'absent'}}]}});
  assert.throws(() => prepareNativeSceneSnapshot(noSnapshot, {operation: 'restore-snapshot', scene_ref: SCENE}), /no saved snapshot to restore/);
  const unfocused = reading({scenes: {native_selected_scene_ref: 'scene:other', working_order: [SCENE], scenes: []}});
  assert.throws(() => prepareNativeSceneSnapshot(unfocused, {operation: 'restore-snapshot', scene_ref: SCENE}), /not acknowledged this Scene focus|exact native Scene/);
  const partial = reading();
  partial.scenes.scenes[0].membership.complete = false;
  assert.throws(() => prepareNativeSceneSnapshot(partial, {operation: 'restore-snapshot', scene_ref: SCENE}), /complete authored/);
  const noEpoch = reading({playback: {}});
  assert.throws(() => prepareNativeSceneSnapshot(noEpoch, {operation: 'restore-snapshot', scene_ref: SCENE}), /intent epoch/);
});

test('save-snapshot carries the captured name and the explicit next flag', () => {
  const request = prepareNativeSceneSnapshot(reading(), {operation: 'save-snapshot', scene_ref: SCENE, title: 'Main', next: false});
  assert.deepEqual(request, {operation: 'scene', basis: BASIS, intent_epoch: 7, action: 'save-snapshot', name: 'Main', next: false});
});

function chosenJourney() {
  const doc = blankJourney(), scene = doc.scenes[0];
  const body = entity('Body', 'A');
  scene.entities = [body];
  initialiseShared(doc);
  return {doc, scene, body};
}

test('chosen-scope moves an admitted object control between Follow (selected) and Bind (named) with its exact owner fields', () => {
  const {doc, scene, body} = chosenJourney();
  const target = entityTargets(scene).find(t => t.entityId === body.id);
  assert.ok(target, 'the formation exposes an admitted property');
  const occurrences = {[body.id]: 'expression:snap:entity:body'};
  doc.shared.toolbelt = [{id: 'belt:chosen', key: target.key, scope: 'selected'}];
  const named = applyNativeChosenControlChanges(doc, scene.id, [{kind: 'chosen-scope', entry_id: 'belt:chosen', scope: 'named', entity_id: body.id}], [body.id], occurrences);
  const bound = named.shared.toolbelt[0];
  assert.equal(bound.scope, 'named');
  assert.equal(bound.entityId, body.id);
  assert.equal(bound.sceneId, scene.id);
  assert.equal(bound.journeyId, doc.id);
  const back = applyNativeChosenControlChanges(named, scene.id, [{kind: 'chosen-scope', entry_id: 'belt:chosen', scope: 'selected'}], [body.id], occurrences);
  assert.deepEqual(back.shared.toolbelt[0], {id: 'belt:chosen', key: target.key, scope: 'selected'});
});

test('chosen-scope refuses an unknown scope, a Field control, a foreign object and a duplicate scope', () => {
  const {doc, scene, body} = chosenJourney();
  const target = entityTargets(scene).find(t => t.entityId === body.id);
  const occurrences = {[body.id]: 'expression:snap:entity:body'};
  doc.shared.toolbelt = [{id: 'belt:chosen', key: target.key, scope: 'selected'}, {id: 'belt:field', key: 'field.params.count', scope: 'field'}];
  const apply = change => applyNativeChosenControlChanges(doc, scene.id, [change], [body.id], occurrences);
  assert.throws(() => apply({kind: 'chosen-scope', entry_id: 'belt:chosen', scope: 'global', entity_id: body.id}), /Follow or Bind scope/);
  assert.throws(() => apply({kind: 'chosen-scope', entry_id: 'belt:field', scope: 'named', entity_id: body.id}), /existing object control/);
  assert.throws(() => apply({kind: 'chosen-scope', entry_id: 'belt:chosen', scope: 'named', entity_id: 'entity:foreign'}), /admitted native object/);
  // A second entry already bound to this object and key cannot take the same scope.
  doc.shared.toolbelt.push({id: 'belt:twin', key: target.key, scope: 'named', entityId: body.id, sceneId: scene.id, journeyId: doc.id});
  assert.throws(() => apply({kind: 'chosen-scope', entry_id: 'belt:chosen', scope: 'named', entity_id: body.id}), /already chosen/);
});
