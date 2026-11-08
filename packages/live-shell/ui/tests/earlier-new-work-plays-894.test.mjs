import test from 'node:test'
import assert from 'node:assert/strict'
import {register} from 'node:module'

// O-I #747 round 894: works New made before round 893 are the owner's bare create (kernel expression.rs Request::Create): one Scene
// "Main", no Scene material, nothing placed. They read "No authored native Scene material is disclosed" and stayed unplayable until
// their first edit. An empty scene is still a scene (manual §20.14), and its material is the frame's blank scene, which New writes now:
// such a work plays on open, and nothing is written to make it so. A scene that holds objects and no material is not empty, and stays
// refused with its reason. What is real: the frame's conversion, the boundary's projection, the frame's transport and the shell's.
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
const IDLE = {scene_playing: false, saved_sequence_playing: false, elapsed_seconds: 0, field_paused: false}

// The owner's bare create, as an earlier New left it saved (expression.rs Request::Create).
function bareCreate(ref, title) {
  return {schema: 'oi.expression/v1', expression_ref: ref, revision: 1, title, scenes: [{scene_ref: ref + ':scene:main', revision: 1, title: 'Main', entity_refs: []}],
    entities: {}, relations: {}, selection: {scene_ref: ref + ':scene:main', entity_ref: null}, provenance: [], representations: [], refinements: []}
}
function opened(document) {
  const view = Bridge.kernelDocumentToJourney(clone(document))
  return {view, reading: Scenes.projectNativeScenes(view.journey, view)}
}
const transportOn = (reading, row) => Playback.sceneTransportModel({ready: true, focused: true, rows: reading.scenes.map(scene => ({scene_ref: scene.scene_ref, available: scene.material.available})),
  scene: {scene_ref: row.scene_ref, available: row.material.available, reason: row.material.reason, duration: row.working?.duration ?? null},
  playback: IDLE, savedAvailable: false, loop: false})

test('an earlier New work (the bare create, no Scene material) plays on open: its one empty Scene is the blank scene', () => {
  const document = bareCreate('expression:earlier', 'Untitled expression')
  const before = JSON.stringify(document)
  const {view, reading} = opened(document)
  const [row] = reading.scenes
  assert.deepEqual(row.material, {available: true, reason: null}, 'the empty Scene is the frame\'s to play')
  assert.ok(row.working && row.working.duration >= 1, 'it keeps the blank scene\'s working duration')
  assert.deepEqual(Transport.nativeSceneTransportMaterial(view), [view.journey.scenes[0].id], 'the frame\'s own transport plays it')
  const model = transportOn(reading, row)
  assert.equal(model.play.disabled, false, model.play.reason)
  assert.notEqual(model.stop.reason, 'This Scene has no authored working duration to stop.')
  assert.equal(JSON.stringify(document), before, 'nothing was written to make it playable: no edit was asked')
})

test('a Scene that holds objects and no authored material is not empty: it stays refused with its reason', () => {
  const document = bareCreate('expression:held', 'Held')
  document.entities['expression:held:entity:a'] = {entity_ref: 'expression:held:entity:a', title: 'A', kind: 'formation', parameters: {}, subject: null}
  document.scenes[0].entity_refs = ['expression:held:entity:a']
  let reading, view
  ({view, reading} = opened(document))
  const [row] = reading.scenes
  assert.equal(row.material.available, false)
  assert.equal(row.material.reason, 'No authored native Scene material is disclosed')
  assert.deepEqual(Transport.nativeSceneTransportMaterial(view), [])
})
