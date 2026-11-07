import test from 'node:test'
import assert from 'node:assert/strict'
import {register} from 'node:module'

// O-I #747 round 889, XT15 ("I loop the scenes while I watch the cut": §20.2 Transport, "Loop | Loops the scenes"; the rule, §16.6, "A loop
// region plays and repeats only between its in and out points"). The Expression keeps a loop region (Journey.loopRegion, on its working
// clock), and its frame repeats the scenes between its in and out points as the saved sequence plays (sceneTransport.ts, E13). Until this
// round only the frame's own ruler drew it: the shell's Arrangement drew the whole sequence's loop or none.
//   - the scenes reading discloses the region the Expression keeps, exactly, and a reading carrying a malformed one is refused;
//   - the Arrangement's loop brace stands between the region's in and out points; with no region it is the whole sequence's, as before;
//   - the transport's Loop says the scenes between those points repeat.
// FIXTURE: a kernel document of two scenes (10 s and 8 s) through the Expressions model's own bridge; SCRIPTED: static markup and functions.
const root = new URL('../../../../', import.meta.url)
const compiler = new URL('desktop/cradle/node_modules/typescript/lib/typescript.js', root).href
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
  if(url.endsWith('.css'))return {format:'module',shortCircuit:true,source:'export default null'};
  if(!url.endsWith('.ts')&&!url.endsWith('.tsx'))return next(url,context);
  return {format:'module',shortCircuit:true,source:ts.transpileModule(await readFile(new URL(url),'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.ReactJSX},fileName:new URL(url).pathname}).outputText};
}`)}`, import.meta.url)

globalThis.document = {getElementById: () => null, createElement: () => ({}), head: {appendChild: () => {}}}
const app = new URL('desktop/cradle/expressions-app/field-studies-journeys/src/', root)
const boundary = new URL('packages/expressions-boundary/src/', root)
const [model, {kernelDocumentToJourney}, {projectNativeScenes}, {isNativeScenesReading}, {nativeTracks}, {loopTitle}] = await Promise.all([
  import(new URL('model.ts', app)),
  import(new URL('kernelDocumentBridge.ts', app)),
  import(new URL('scenes.ts', boundary)),
  import(new URL('scenesValidation.ts', boundary)),
  import('../src/frame/tracks/modeTracks.ts'),
  import('../src/components/nativeScenePlayback.ts'),
])
const E = 'expression:loop'
const S = n => `${E}:scene:s${n}`
const basis = {expression_ref: E, revision: 4, scene_ref: S(1)}
function seed(properties = null) {
  const scenes = [10, 8].map((duration, i) => {
    const scene = model.blankScene(`Scene ${i + 1}`); scene.id = S(i + 1); scene.duration = duration; scene.transition = 1
    return {scene_ref: scene.id, revision: 1, title: scene.name, entity_refs: [], presentation: {schema: 'oi.journey-scene/v1', scene, saved: null}}
  })
  return kernelDocumentToJourney({schema: 'oi.expression/v1', expression_ref: E, revision: 4, title: 'Loop', scenes, entities: {}, relations: {},
    selection: {scene_ref: S(1), entity_ref: null}, provenance: [], representations: [], refinements: [],
    ...(properties ? {presentation: {schema: 'oi.journey-properties/v1', description: '', loop: false, ...properties}} : {})})
}
const contentOf = reading => ({basis, playback: {scene_ref: S(1), scene_playing: false, saved_sequence_playing: false}, scenes: reading})

test('XT15: the scenes reading discloses the loop region the Expression keeps, exactly; a malformed one is refused', () => {
  const plain = projectNativeScenes(seed().journey, seed())
  assert.equal('loop_region' in plain, false, 'none kept: none said')
  const kept = seed({loopRegion: {from: 4, to: 12}})
  const reading = projectNativeScenes(kept.journey, kept)
  assert.deepEqual(reading.loop_region, {from: 4, to: 12})
  assert.equal(isNativeScenesReading(reading, basis), true)
  for (const loop_region of [{from: 12, to: 4}, {from: 4}, {from: -1, to: 4}, {from: 4, to: 12, at: 1}, {from: 4, to: Infinity}, 'all', null])
    assert.equal(isNativeScenesReading({...reading, loop_region}, basis), false, JSON.stringify(loop_region))
})

test('XT15: the Arrangement\'s loop brace stands between the region\'s in and out; with no region, the whole sequence\'s loop stands', () => {
  const kept = seed({loopRegion: {from: 4, to: 12}})
  const set = nativeTracks(contentOf(projectNativeScenes(kept.journey, kept)), 'Loop')
  assert.deepEqual(set.loop, {start: 4, end: 12})
  const whole = seed({loop: true})
  const reading = projectNativeScenes(whole.journey, whole)
  const saved = {...reading, timing: {...reading.timing, saved: {available: true, total_seconds: 18, extents: []}}}
  assert.deepEqual(nativeTracks(contentOf(saved), 'Loop').loop, {start: 0}, 'the saved sequence loops whole, as before')
  const off = seed({loop: false})
  assert.equal(nativeTracks(contentOf(projectNativeScenes(off.journey, off)), 'Loop').loop, undefined, 'no loop: no brace')
})

test('XT15: the transport\'s Loop says the scenes between the loop\'s in and out repeat', () => {
  assert.equal(loopTitle(undefined), 'Loop the saved Scene sequence back to its first Scene at the end')
  assert.equal(loopTitle({from: 4, to: 12}),
    'Loop the saved Scene sequence back to its first Scene at the end. Its loop region repeats the scenes between its in and out points, 4.00 s to 12.00 s, as the saved sequence plays.')
})
