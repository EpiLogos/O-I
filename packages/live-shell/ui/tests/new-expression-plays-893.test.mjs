import test from 'node:test'
import assert from 'node:assert/strict'
import {register} from 'node:module'

// XF01 (walk #857, O-I #747 round 893): a New Expression ("An empty work: one Scene, nothing placed") could not be played. Its one Scene
// was the owner's bare create, with no authored Scene material, so the transport read "No authored native Scene material is disclosed"
// and Stop "This Scene has no authored working duration to stop." An empty scene is still a scene (manual §20.14: Live plays an empty
// clip slot's scene). New now makes its work by the frame's blank Journey, as a scene added in the Clip panel is the frame's blank scene
// (expressions-boundary sceneEdits.ts `add`), so its one Scene keeps the blank scene's authored pacing and nothing placed.
//
// The owner is a SCRIPTED STUB (as native-expression-open.test.mjs): what is real is the New route (nativeExpressionCommands.ts and the
// frame's makeWork), the frame's conversion of the document it made, the boundary's projection of it and the transport model on it.
const compiler = new URL('../node_modules/typescript/lib/typescript.js', import.meta.url).href
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
}`)}`, import.meta.url)

const root = new URL('../../../../', import.meta.url)
const frame = new URL('desktop/cradle/expressions-app/field-studies-journeys/src/', root)
const [CMD, Bridge, Transport, Scenes, Playback] = await Promise.all([
  import(new URL('packages/live-shell/ui/src/components/nativeExpressionCommands.ts', root)),
  import(new URL('kernelDocumentBridge.ts', frame)),
  import(new URL('sceneTransport.ts', frame)),
  import(new URL('packages/expressions-boundary/src/scenes.ts', root)),
  import(new URL('packages/live-shell/ui/src/components/nativeScenePlayback.ts', root)),
])
const clone = value => structuredClone(value)

// The owner's bare create (kernel expression.rs Request::Create): one Scene "Main", no Scene material, nothing placed.
function emptyDocument(ref, title) {
  return {schema: 'oi.expression/v1', expression_ref: ref, revision: 1, title, scenes: [{scene_ref: ref + ':scene:main', revision: 1, title: 'Main', entity_refs: []}],
    entities: {}, relations: {}, selection: {scene_ref: ref + ':scene:main', entity_ref: null}, provenance: [], representations: [], refinements: []}
}
function applyEdit(document, request) {
  if (request.expected_revision !== document.revision) return {state: 'revision_conflict', current_revision: document.revision}
  const d = clone(document), scene = ref => d.scenes.find(row => row.scene_ref === ref)
  for (const c of request.changes) {
    switch (c.change) {
      case 'rename': d.title = c.title; break
      case 'composition_set': d.presentation = clone(c.presentation); break
      case 'scene_rename': scene(c.scene_ref).title = c.title; if (scene(c.scene_ref).presentation) scene(c.scene_ref).presentation.scene.name = c.title; break
      case 'scene_compose': scene(c.scene_ref).entity_refs = [...c.entity_refs]; break
      case 'scene_material_set': scene(c.scene_ref).presentation = clone(c.presentation); if (!c.presentation.saved) delete scene(c.scene_ref).presentation.saved; break
      case 'focus': d.selection = {scene_ref: c.scene_ref, entity_ref: c.entity_ref}; break
      default: assert.fail('Unexpected native change ' + c.change)
    }
  }
  if (request.changes.length) d.revision++
  return {state: 'ready', document: d}
}
function stubOwner() {
  const documents = new Map(), calls = []
  const channel = async request => {
    calls.push(clone(request))
    switch (request.operation) {
      case 'create': { const d = emptyDocument(request.expression_ref, request.title); documents.set(d.expression_ref, d); return {state: 'ready', document: clone(d)} }
      case 'edit': { const result = applyEdit(documents.get(request.expression_ref), request); if (result.document) documents.set(request.expression_ref, result.document); return clone(result) }
      default: assert.fail('unexpected owner operation ' + request.operation)
    }
  }
  return {channel, calls, documents}
}
const ports = owner => ({expression: owner.channel, parent: null, uuid: () => '00000001-0000-4000-8000-000000000000', current: () => true, refresh: async () => {}, open: () => {}})
const IDLE = {scene_playing: false, saved_sequence_playing: false, elapsed_seconds: 0, field_paused: false}

/** The New work as the shell reads it once open: the frame's conversion, the boundary's projection, and the transport on its one Scene. */
async function newWork() {
  const owner = stubOwner()
  const outcome = await CMD.newExpression(ports(owner), 'Untitled expression')
  assert.equal(outcome.ok, true, outcome.error)
  const document = owner.documents.get(outcome.expression_ref)
  const view = Bridge.kernelDocumentToJourney(clone(document))
  const reading = Scenes.projectNativeScenes(view.journey, view)
  return {owner, outcome, document, view, reading}
}

test('XF01: a New Expression\'s one Scene has authored material, so Play and Stop are the transport\'s to press', async () => {
  const {document, view, reading} = await newWork()
  assert.deepEqual([document.title, document.scenes.length, Object.keys(document.entities).length], ['Untitled expression', 1, 0], 'an empty work: one Scene, nothing placed')
  const [row] = reading.scenes
  assert.deepEqual(row.material, {available: true, reason: null}, 'the one Scene is the frame\'s to play')
  assert.ok(row.working && row.working.duration >= 1, 'it keeps a working duration')
  assert.deepEqual(Transport.nativeSceneTransportMaterial(view), [view.journey.scenes[0].id], 'the frame\'s own transport plays it')
  const model = Playback.sceneTransportModel({ready: true, focused: true, rows: reading.scenes.map(scene => ({scene_ref: scene.scene_ref, available: scene.material.available})),
    scene: {scene_ref: row.scene_ref, available: row.material.available, reason: row.material.reason, duration: row.working?.duration ?? null},
    playback: IDLE, savedAvailable: false, loop: false})
  assert.equal(model.play.disabled, false, model.play.reason)
  assert.notEqual(model.stop.reason, 'This Scene has no authored working duration to stop.')
})

test('XF01: the New work\'s one Scene is the frame\'s blank scene, as a scene added in the Clip panel is: its pacing, no objects', async () => {
  const {document} = await newWork()
  const [scene] = document.scenes
  assert.equal(scene.presentation?.schema, 'oi.journey-scene/v1')
  assert.deepEqual(scene.entity_refs, [])
  assert.deepEqual(scene.presentation.scene.entities, [])
  assert.equal(scene.presentation.scene.name, scene.title, 'the material names the Scene the owner holds')
})
