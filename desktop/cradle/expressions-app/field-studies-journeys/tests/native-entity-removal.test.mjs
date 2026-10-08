// Removing an object from a Scene reaches the native Expression as an exact
// membership change, and as entity_remove only when no Scene still carries it.
// Imports the production sources directly (ts-register), not the stale build/.
import test from 'node:test';
import assert from 'node:assert/strict';
import {register} from 'node:module';

// Transpile the production TypeScript sources with the app's own compiler
// (type-only syntax such as parameter properties needs it, not strip mode).
const root = new URL('../../../', import.meta.url);
const typescript = new URL('node_modules/typescript/lib/typescript.js', root).href;
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
  return {format:'module',shortCircuit:true,source:ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext},fileName:new URL(url).pathname}).outputText};
}
`)}`, import.meta.url);
const {blankJourney, entity, clone} = await import('../src/model.ts');
const {kernelDocumentToJourney} = await import('../src/kernelDocumentBridge.ts');
const {prepareCompositionEdit} = await import('../src/kernelComposition.ts');

const EXPR = 'expression:rm';
const SCENE = EXPR + ':scene:main', SECOND = EXPR + ':scene:second';
const KEEP = EXPR + ':entity:keep', DROP = EXPR + ':entity:drop';

// A kernel-shaped document: Main carries Keep and Drop, Second carries Drop.
function document({second = true, relations = {}} = {}) {
  const row = (ref, title) => ({entity_ref: ref, title, revision: 1, subject: null, parameters: {glyph: {value: title[0]}}});
  return {
    schema: 'oi.expression/v1', expression_ref: EXPR, revision: 2, title: 'Removal',
    scenes: [
      {scene_ref: SCENE, revision: 1, title: 'Main', entity_refs: [KEEP, DROP]},
      ...(second ? [{scene_ref: SECOND, revision: 1, title: 'Second', entity_refs: [DROP]}] : []),
    ],
    entities: {[KEEP]: row(KEEP, 'Keep'), [DROP]: row(DROP, 'Drop')},
    relations, selection: {scene_ref: SCENE, entity_ref: null}, provenance: [], representations: [], refinements: [],
  };
}

// Owner-side reducer for the changes this test emits. It mirrors the kernel's
// removal semantics: EntityRemove drops the entity from every Scene and its relations.
function ownerEdit(doc, request) {
  const d = clone(doc), scene = ref => d.scenes.find(s => s.scene_ref === ref);
  for (const c of request.changes) switch (c.change) {
    case 'entity_add':
      d.entities[c.entity_ref] = {entity_ref: c.entity_ref, title: c.title, revision: 1, subject: null, parameters: {glyph: {value: 'O'}}};
      scene(c.scene_ref).entity_refs.push(c.entity_ref);
      break;
    case 'scene_compose': scene(c.scene_ref).entity_refs = [...c.entity_refs]; break;
    case 'scene_material_set': scene(c.scene_ref).presentation = clone(c.presentation); break;
    case 'entity_remove':
      if (!d.entities[c.entity_ref]) throw new Error('Entity is absent');
      delete d.entities[c.entity_ref];
      for (const s of d.scenes) {
        s.entity_refs = s.entity_refs.filter(r => r !== c.entity_ref);
        if (s.presentation) s.presentation.scene.entities = s.presentation.scene.entities.filter(e => e.id !== c.entity_ref);
      }
      for (const [key, r] of Object.entries(d.relations)) if (r.from_entity_ref === c.entity_ref || r.to_entity_ref === c.entity_ref) delete d.relations[key];
      break;
    default: throw new Error('Unexpected native operation ' + c.change);
  }
  d.revision++;
  return d;
}

// A native Expression after the app's first material write: each Scene's saved
// version is null, so no named snapshot holds an object the working Scene drops.
function viewOf(doc) {
  const view = kernelDocumentToJourney(doc);
  view.journey.savedScenes = {};
  return view;
}
const names = view => view.journey.scenes.map(s => s.entities.map(e => e.name));

test('removing a loaded object from its only Scene emits the membership change and then entity_remove', () => {
  const view = viewOf(document({second: false}));
  const journey = clone(view.journey);
  journey.scenes[0].entities = journey.scenes[0].entities.filter(e => e.name !== 'Drop');
  const request = prepareCompositionEdit(view, journey, {sceneId: journey.scenes[0].id});
  const compose = request.changes.filter(c => c.change === 'scene_compose');
  assert.equal(compose.length, 1);
  assert.deepEqual(compose[0].entity_refs, [KEEP]);
  const remove = request.changes.filter(c => c.change === 'entity_remove');
  assert.deepEqual(remove, [{change: 'entity_remove', entity_ref: DROP}]);
  assert.ok(request.changes.indexOf(compose[0]) < request.changes.indexOf(remove[0]), 'membership is cut before the entity is deleted');
  const next = ownerEdit(view.document, request);
  assert.equal(next.entities[DROP], undefined, 'the native document no longer holds the entity');
  assert.deepEqual(next.scenes[0].entity_refs, [KEEP]);
  assert.deepEqual(names(kernelDocumentToJourney(next)), [['Keep']]);
});

test('an object still carried by another Scene is removed from this Scene only, never deleted', () => {
  const view = viewOf(document());
  const journey = clone(view.journey);
  journey.scenes[0].entities = journey.scenes[0].entities.filter(e => e.name !== 'Drop');
  const request = prepareCompositionEdit(view, journey, {sceneId: journey.scenes[0].id});
  assert.equal(request.changes.some(c => c.change === 'entity_remove'), false);
  assert.deepEqual(request.changes.find(c => c.change === 'scene_compose' && c.scene_ref === SCENE).entity_refs, [KEEP]);
  const next = ownerEdit(view.document, request);
  assert.ok(next.entities[DROP], 'the entity survives for the other Scene');
  assert.deepEqual(next.scenes[1].entity_refs, [DROP]);
});

test('removing it from every Scene that loads it deletes it natively', () => {
  const view = viewOf(document());
  const journey = clone(view.journey);
  for (const scene of journey.scenes) scene.entities = scene.entities.filter(e => e.name !== 'Drop');
  const request = prepareCompositionEdit(view, journey, {sceneId: journey.scenes[0].id});
  assert.deepEqual(request.changes.filter(c => c.change === 'entity_remove'), [{change: 'entity_remove', entity_ref: DROP}]);
  const next = ownerEdit(view.document, request);
  assert.equal(next.entities[DROP], undefined);
  assert.deepEqual(next.scenes.map(s => s.entity_refs), [[KEEP], []]);
});

test('an object outside the loaded page is hidden, not removed: no membership cut and no deletion', () => {
  const view = viewOf(document({second: false}));
  // Only Keep is loaded on this page; Drop is a hidden member of the same Scene.
  const paged = clone(view);
  paged.bindings[view.journey.scenes[0].id].loaded_refs = [KEEP];
  const journey = clone(view.journey);
  journey.scenes[0].entities = journey.scenes[0].entities.filter(e => e.name !== 'Drop');
  const request = prepareCompositionEdit(paged, journey, {sceneId: journey.scenes[0].id});
  assert.equal(request.changes.some(c => c.change === 'entity_remove'), false);
  assert.equal(request.changes.some(c => c.change === 'scene_compose' && c.entity_refs.length < 2), false);
});

test('an object with native relations is refused before any edit is submitted', () => {
  const relation = {binding_ref: EXPR + ':relation:kd', from_entity_ref: KEEP, to_entity_ref: DROP, relation: {ref: 'rel:kd', revision: '1'}};
  const view = viewOf(document({second: false, relations: {[relation.binding_ref]: relation}}));
  const journey = clone(view.journey);
  journey.scenes[0].entities = journey.scenes[0].entities.filter(e => e.name !== 'Drop');
  assert.throws(() => prepareCompositionEdit(view, journey, {sceneId: journey.scenes[0].id}), /native relations/);
});

test('a saved snapshot that still carries the object keeps it as a saved-only member, not a deletion', () => {
  // Without the cleared snapshot, the bridge's fallback keeps Drop in Main's saved version.
  const view = kernelDocumentToJourney(document({second: false}));
  assert.ok(view.journey.savedScenes[SCENE].entities.some(e => e.name === 'Drop'));
  const journey = clone(view.journey);
  journey.scenes[0].entities = journey.scenes[0].entities.filter(e => e.name !== 'Drop');
  const request = prepareCompositionEdit(view, journey, {sceneId: journey.scenes[0].id});
  assert.equal(request.changes.some(c => c.change === 'entity_remove'), false);
  assert.equal(request.changes.some(c => c.change === 'scene_compose'), false);
});

test('a duplicated object reaches native as one new entity in its Scene (entity_add and membership)', () => {
  const view = viewOf(document({second: false}));
  const journey = clone(view.journey);
  const keep = journey.scenes[0].entities.find(e => e.name === 'Keep');
  const copy = clone(keep);
  copy.id = 'entity-copy-test';
  copy.name = 'Keep copy';
  copy.position = {x: keep.position.x + 0.12, y: keep.position.y - 0.12, z: keep.position.z};
  copy.locked = false;
  copy.sequence.steps.forEach((step, index) => { step.id = 'state-copy-' + index; });
  delete copy.native;
  journey.scenes[0].entities.push(copy);
  const request = prepareCompositionEdit(view, journey, {sceneId: journey.scenes[0].id});
  const added = request.changes.filter(c => c.change === 'entity_add');
  assert.equal(added.length, 1);
  assert.equal(added[0].scene_ref, SCENE);
  assert.equal(added[0].title, 'Keep copy');
  assert.equal(request.changes.some(c => c.change === 'entity_remove'), false);
  const compose = request.changes.find(c => c.change === 'scene_compose' && c.scene_ref === SCENE);
  assert.deepEqual(compose.entity_refs, [KEEP, DROP, added[0].entity_ref]);
  const next = ownerEdit(view.document, request);
  assert.equal(Object.keys(next.entities).length, 3);
  assert.deepEqual(next.scenes[0].entity_refs, [KEEP, DROP, added[0].entity_ref]);
});

test('an unchanged journey emits no membership cut and no entity removal', () => {
  const view = viewOf(document({second: false}));
  const request = prepareCompositionEdit(view, clone(view.journey), {sceneId: view.journey.scenes[0].id});
  assert.equal(request.changes.filter(c => c.change === 'entity_remove' || c.change === 'scene_compose').length, 0);
});
