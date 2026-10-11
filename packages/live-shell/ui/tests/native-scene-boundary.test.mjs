import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {register} from 'node:module'

// Production boundary and desktop owner sources, transpiled in memory. The
// native document is a minimal fixture; no owner, store or server is simulated.
const root = new URL('../../../../', import.meta.url)
const compiler = new URL('../node_modules/typescript/lib/typescript.js', import.meta.url).href
register(`data:text/javascript,${encodeURIComponent(`import ts from ${JSON.stringify(compiler)};import {readFile} from 'node:fs/promises';
export async function resolve(specifier,context,next){try{return await next(specifier,context)}catch(error){
 if(specifier.startsWith('.')&&specifier.endsWith('.js'))return next(specifier.slice(0,-3)+'.ts',context);
 if(specifier.startsWith('.')&&!/\\.[cm]?[jt]s$/.test(specifier))return next(specifier+'.ts',context);throw error;}}
export async function load(url,context,next){if(url.endsWith('.css'))return {format:'module',shortCircuit:true,source:'export {}'};if(!url.endsWith('.ts')&&!url.endsWith('.tsx'))return next(url,context);
 return {format:'module',shortCircuit:true,source:ts.transpileModule(await readFile(new URL(url),'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.ReactJSX},fileName:new URL(url).pathname}).outputText};}`)}`, import.meta.url)

const author = new URL('desktop/cradle/expressions-app/field-studies-journeys/src/', root)
const [{prepareNativeSceneEdit, prepareNativeSceneSnapshot}, {blankJourney, clone}, {kernelDocumentToJourney}] = await Promise.all([
  import(new URL('packages/expressions-boundary/src/sceneEdits.ts', root)),
  import(new URL('model.ts', author)),
  import(new URL('kernelDocumentBridge.ts', author)),
])

const SCENE = 'expression:whole:scene:main'
function seed() {
  const journey = blankJourney()
  journey.name = 'A working inquiry'
  journey.scenes[0].name = 'First'
  const document = {schema: 'oi.expression/v1', expression_ref: 'expression:whole', revision: 1, title: journey.name,
    scenes: [{scene_ref: SCENE, revision: 1, title: 'Main', entity_refs: []}], entities: {}, relations: {},
    selection: {scene_ref: SCENE, entity_ref: null}, provenance: [], representations: [], refinements: []}
  return kernelDocumentToJourney(document, {identity: {expression: journey.id, scenes: {[SCENE]: journey.scenes[0].id}}})
}

test('add prepares one blank Scene after the presented Scene, focused as a single composition', () => {
  const view = seed()
  const working = clone(view.journey)
  const plan = prepareNativeSceneEdit(view, working, {operation: 'add'})
  assert.equal(plan.label, 'Add Scene')
  assert.equal(plan.snapshot.journey.scenes.length, 2)
  assert.equal(plan.snapshot.journey.scenes[0].id, view.journey.scenes[0].id, 'the presented Scene keeps its place')
  assert.equal(plan.snapshot.journey.scenes[1].name, 'Untitled scene')
  const create = plan.request.changes.find(change => change.change === 'scene_create')
  assert.ok(create, 'the new Scene is a native scene_create')
  assert.equal(create.title, 'Untitled scene')
  assert.equal(plan.created_scene_ref, create.scene_ref)
  assert.equal(plan.selected_scene_ref, create.scene_ref, 'the new draft becomes the presented Scene')
  assert.deepEqual(plan.affected_scene_refs, [create.scene_ref])
  const focus = plan.request.changes.find(change => change.change === 'focus')
  assert.equal(focus?.scene_ref, create.scene_ref)
  // The working copy is not mutated by preparation.
  assert.equal(working.scenes.length, 1)
})

test('add with a supplied title names the draft and rejects an empty name', () => {
  const view = seed()
  const plan = prepareNativeSceneEdit(view, clone(view.journey), {operation: 'add', title: '  Chorus '})
  assert.equal(plan.snapshot.journey.scenes[1].name, 'Chorus')
  assert.throws(() => prepareNativeSceneEdit(view, clone(view.journey), {operation: 'add', title: '   '}), /1–160 characters/)
})

test('loop prepares one composition_set carrying the flag and no focus or Scene change', () => {
  const view = seed()
  // The native converter defaults a document without presentation to loop on.
  assert.equal(view.journey.loop, true)
  const plan = prepareNativeSceneEdit(view, clone(view.journey), {operation: 'loop', loop: false})
  assert.equal(plan.label, 'Set saved sequence loop')
  assert.deepEqual(plan.request.changes.map(change => change.change), ['composition_set'])
  assert.equal(plan.request.changes[0].presentation.loop, false)
  assert.equal(plan.snapshot.journey.loop, false)
  assert.deepEqual(plan.affected_scene_refs, [])
  assert.equal(plan.selected_scene_ref, SCENE)
})

test('loop to the value already held is an unchanged plan with no native change', () => {
  const view = seed()
  const plan = prepareNativeSceneEdit(view, clone(view.journey), {operation: 'loop', loop: view.journey.loop})
  assert.equal(plan.request.changes.length, 0)
})

test('loop refuses a non-boolean flag', () => {
  const view = seed()
  assert.throws(() => prepareNativeSceneEdit(view, clone(view.journey), {operation: 'loop', loop: 'yes'}), /yes or no/)
})

// A reading fixture in the shape prepareNativeSceneSnapshot consumes.
function reading(overrides = {}) {
  const row = {scene_ref: SCENE, title: 'Main', material: {available: true, reason: null}, membership: {complete: true},
    snapshot: {availability: 'absent', standing: null}}
  return {basis: {expression_ref: 'expression:whole', revision: 1, scene_ref: SCENE, authored_revision: 1},
    playback: {intent_epoch: 4}, scenes: {native_selected_scene_ref: SCENE, working_order: [SCENE], scenes: [row]}, ...overrides}
}

test('save-snapshot is next:false unless the caller asks for Save & next', () => {
  assert.equal(prepareNativeSceneSnapshot(reading(), {operation: 'save-snapshot', scene_ref: SCENE}).next, false)
  const next = prepareNativeSceneSnapshot(reading(), {operation: 'save-snapshot', scene_ref: SCENE, next: true})
  assert.equal(next.next, true)
  assert.equal(next.name, 'Main')
  assert.equal(next.intent_epoch, 4)
})

test('save-snapshot with next refuses a non-boolean and the 64-Scene bound', () => {
  assert.throws(() => prepareNativeSceneSnapshot(reading(), {operation: 'save-snapshot', scene_ref: SCENE, next: 'yes'}), /yes or no/)
  const full = reading()
  full.scenes.working_order = Array.from({length: 64}, () => SCENE)
  assert.throws(() => prepareNativeSceneSnapshot(full, {operation: 'save-snapshot', scene_ref: SCENE, next: true}), /up to 64 scenes/)
  // Without next, the same full order still captures in place.
  assert.equal(prepareNativeSceneSnapshot(full, {operation: 'save-snapshot', scene_ref: SCENE}).next, false)
})
