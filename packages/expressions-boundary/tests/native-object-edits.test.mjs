import test from 'node:test';
import assert from 'node:assert/strict';
import {register} from 'node:module';

// Evaluate the production authoring sources without emitting a build (same
// transpiler setup as native-glyph-editor.test.mjs).
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
const [{applyNativeObjectChanges, duplicateSceneEntity, FORMATION_SCENE_LIMIT}, {blankJourney, entity, clone, validateJourney}] = await Promise.all([
  import(new URL('../src/nativeFormations.ts', import.meta.url)),
  import(new URL('model.ts', author)),
]);

function fixture() {
  const doc = blankJourney(), scene = doc.scenes[0];
  const body = entity('Body', 'A'), other = entity('Other', 'B');
  body.locked = true;
  other.locked = false;
  body.native = {id: body.id, kind: 'formation', futureOwnerProperty: {source: 'retain'}};
  body.layers = [{id: 'layer:a', text: 'inner', z: 0.2, scale: 0.75}];
  scene.entities = [body, other];
  validateJourney(doc);
  return {doc, scene, body, other};
}

test('duplicate copies the app entity: name suffix, offset, fresh identities, unlocked, native link not copied', () => {
  const {doc, scene, body} = fixture();
  body.locked = false;
  const before = clone(doc);
  const next = applyNativeObjectChanges(doc, scene.id, [{kind: 'entity-duplicate', entity_id: body.id}]);
  assert.deepEqual(doc, before, 'the captured journey is not mutated');
  const original = next.scenes[0].entities[0], copy = next.scenes[0].entities[2];
  assert.equal(next.scenes[0].entities.length, 3);
  assert.equal(original.id, body.id);
  assert.notEqual(copy.id, body.id);
  assert.equal(copy.name, 'Body copy');
  assert.equal(copy.position.x, body.position.x + 0.12);
  assert.equal(copy.position.y, body.position.y - 0.12);
  assert.equal(copy.locked, false);
  assert.equal(copy.native, undefined);
  assert.equal(copy.text, body.text);
  assert.deepEqual(copy.layers, body.layers, 'the copy keeps its authored layers');
  assert.ok(copy.sequence.steps.every((step, index) => step.id !== body.sequence.steps[index].id), 'every state gets a fresh identity');
});

test('duplicate of a locked entity is allowed, as the app allows it, and yields an unlocked copy', () => {
  const {doc, scene, body} = fixture();
  assert.equal(body.locked, true);
  const next = applyNativeObjectChanges(doc, scene.id, [{kind: 'entity-duplicate', entity_id: body.id}]);
  assert.equal(next.scenes[0].entities[2].locked, false);
});

test('duplicateSceneEntity refuses nothing itself and returns a new object each call', () => {
  const {body} = fixture();
  const a = duplicateSceneEntity(body), b = duplicateSceneEntity(body);
  assert.notEqual(a.id, b.id);
  assert.notEqual(a.sequence.steps[0].id, b.sequence.steps[0].id);
});

test('remove deletes one unlocked entity from the Scene and leaves its siblings unchanged', () => {
  const {doc, scene, other} = fixture();
  const next = applyNativeObjectChanges(doc, scene.id, [{kind: 'entity-remove', entity_id: other.id}]);
  assert.deepEqual(next.scenes[0].entities.map(value => value.id), [scene.entities[0].id]);
  assert.equal(doc.scenes[0].entities.length, 2, 'the input is not mutated');
});

test('remove refuses a locked entity and a blueprint member with the app wording', () => {
  const {doc, scene, body} = fixture();
  assert.throws(() => applyNativeObjectChanges(doc, scene.id, [{kind: 'entity-remove', entity_id: body.id}]), /Unlock this entity before removing it/);
  const blueprint = clone(doc);
  blueprint.scenes[0].entities[1].locked = false;
  blueprint.scenes[0].composition.blueprint = {members: [{entity_ref: blueprint.scenes[0].entities[1].id}]};
  assert.throws(() => applyNativeObjectChanges(blueprint, scene.id, [{kind: 'entity-remove', entity_id: blueprint.scenes[0].entities[1].id}]), /Release the blueprint/);
});

test('object changes refuse unknown kinds, extra keys, absent entities and an empty or oversized batch', () => {
  const {doc, scene, other} = fixture();
  assert.throws(() => applyNativeObjectChanges(doc, scene.id, []), /between 1 and 32/);
  assert.throws(() => applyNativeObjectChanges(doc, scene.id, Array(FORMATION_SCENE_LIMIT + 1).fill({kind: 'entity-remove', entity_id: other.id})), /between 1 and 32/);
  assert.throws(() => applyNativeObjectChanges(doc, scene.id, [{kind: 'entity-delete', entity_id: other.id}]), /only its kind and entity/);
  assert.throws(() => applyNativeObjectChanges(doc, scene.id, [{kind: 'entity-remove', entity_id: other.id, scope: 'all'}]), /only its kind and entity/);
  assert.throws(() => applyNativeObjectChanges(doc, scene.id, [{kind: 'entity-remove', entity_id: 'entity:missing'}]), /no longer belongs/);
  assert.throws(() => applyNativeObjectChanges(doc, 'scene:gone', [{kind: 'entity-remove', entity_id: other.id}]), /no longer in this Expression/);
});

test('duplicate is bounded by the 32-entity Scene budget', () => {
  const {doc, scene, other} = fixture();
  while (scene.entities.length < FORMATION_SCENE_LIMIT) scene.entities.push(entity('Filler', 'O'));
  assert.throws(() => applyNativeObjectChanges(doc, scene.id, [{kind: 'entity-duplicate', entity_id: other.id}]), /up to 32 formations and pins/);
});
