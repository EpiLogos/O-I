import test from 'node:test'
import assert from 'node:assert/strict'
import {register} from 'node:module'

// O-I #747 round 890, XT15 ("I loop the scenes while I watch the cut"; DLW.md §16.6, "A loop region has an in point and an out point: the
// transport plays, and repeats, only between them"; §10.5 Loop and punch, "Loop the scenes"): the in and out points are set from the
// shell as Live's loop brace is set — drag its ends — and Loop turns it on or off. Round 889 drew the brace and set it nowhere.
//   - each end of the brace on the Arrangement's ruler is a handle (a slider, Loop in and Loop out): dragged and let go, or moved with the
//     arrow keys, it is one owner act through the presented composition (scene-edit `loop-edge`), in the ruler's seconds;
//   - while it is dragged the brace follows the hand, inside the ruler and never past its other end;
//   - with Loop off the brace the Expression keeps stands where it is, drawn and said as off (the frame does not repeat it).
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
const React = await import('react')
const {renderToStaticMarkup} = await import('react-dom/server')
const [model, {kernelDocumentToJourney}, {projectNativeScenes}, {nativeTracks}, ruler] = await Promise.all([
  import(new URL('model.ts', app)),
  import(new URL('kernelDocumentBridge.ts', app)),
  import(new URL('scenes.ts', boundary)),
  import('../src/frame/tracks/modeTracks.ts'),
  import('../src/frame/tracks/ArrangementRuler.tsx').then(async own => ({...own, ...await import('../src/inhabitants/catalogue/panels/dlw__arrangement-ruler.tsx')})),
])
// The brace's ends load when such a brace first draws (frame/tracks/loopBraceEnds.tsx); a server render draws only what has arrived.
const [{braceEdgeAt}, {braceEdgeKey}, {loadEveryPart}] = await Promise.all([import('../src/frame/tracks/rulerWindow.ts'),
  import('../src/frame/tracks/loopBraceEnds.tsx'), import('../src/shell/loadWhenDrawn.ts')])
await loadEveryPart()
const E = 'expression:brace'
const S = n => `${E}:scene:s${n}`
const basis = {expression_ref: E, revision: 4, scene_ref: S(1)}
function seed(properties) {
  const scenes = [10, 8].map((duration, i) => {
    const scene = model.blankScene(`Scene ${i + 1}`); scene.id = S(i + 1); scene.duration = duration; scene.transition = 1
    return {scene_ref: scene.id, revision: 1, title: scene.name, entity_refs: [], presentation: {schema: 'oi.journey-scene/v1', scene, saved: null}}
  })
  return kernelDocumentToJourney({schema: 'oi.expression/v1', expression_ref: E, revision: 4, title: 'Brace', scenes, entities: {}, relations: {},
    selection: {scene_ref: S(1), entity_ref: null}, provenance: [], representations: [], refinements: [],
    presentation: {schema: 'oi.journey-properties/v1', description: '', loop: true, ...properties}})
}
const contentOf = view => {
  const reading = projectNativeScenes(view.journey, view)
  return {basis, playback: {scene_ref: S(1), scene_playing: false, saved_sequence_playing: false},
    scenes: {...reading, timing: {...reading.timing, saved: {available: true, total_seconds: 18, extents: []}}}}
}
const editing = () => {
  const sent = []
  return {sent, controls: {sceneEdit: {op: 'expressions scene-edit (the presented composition)', run: async intent => { sent.push(intent); return {ok: true, note: 'The Expression changed.'} }}}}
}

test('XT15 (round 890): with Loop off the brace the Expression keeps stands where it is, said and drawn as off', () => {
  const off = nativeTracks(contentOf(seed({loop: false, loopRegion: {from: 4, to: 12}})), 'Brace')
  assert.deepEqual(off.loop, {start: 4, end: 12, off: true})
  assert.deepEqual(nativeTracks(contentOf(seed({loopRegion: {from: 4, to: 12}})), 'Brace').loop, {start: 4, end: 12}, 'Loop on: it repeats')
  const markup = renderToStaticMarkup(React.createElement(ruler.ArrangementRuler, {set: off, selection: {select() {}}}))
  assert.match(markup, /<i class="tl-brace" data-loop="ruler" data-off="true"[^>]*aria-label="Loop off · 4 – 12 · kept where it stands; Loop on repeats it"/)
})

test('XT15 (round 890): each end of the brace is a handle, Loop in and Loop out; a set the owner does not let set it keeps a read brace', () => {
  const {controls} = editing()
  const set = nativeTracks(contentOf(seed({loopRegion: {from: 4, to: 12}})), 'Brace', {controls})
  assert.ok(set.actions.setLoop, 'the set sets its loop')
  const markup = renderToStaticMarkup(React.createElement(ruler.ArrangementRuler, {set, selection: {select() {}}}))
  assert.match(markup, /<span class="tl-brace-end" data-edge="start" role="slider" tabindex="0" aria-label="Loop in" aria-valuemin="0" aria-valuemax="12" aria-valuenow="4" aria-valuetext="4"/)
  assert.match(markup, /<span class="tl-brace-end" data-edge="end" role="slider" tabindex="0" aria-label="Loop out" aria-valuemin="4" aria-valuemax="18" aria-valuenow="12" aria-valuetext="12"/)
  const read = nativeTracks(contentOf(seed({loopRegion: {from: 4, to: 12}})), 'Brace')
  assert.equal(read.actions?.setLoop, undefined)
  assert.doesNotMatch(renderToStaticMarkup(React.createElement(ruler.ArrangementRuler, {set: read, selection: {select() {}}})), /tl-brace-end/)
})

test('XT15 (round 890): an end let go is one owner act in the ruler\'s seconds, answered in words', async () => {
  const {sent, controls} = editing()
  const set = nativeTracks(contentOf(seed({loopRegion: {from: 4, to: 12}})), 'Brace', {controls})
  assert.deepEqual(await set.actions.setLoop.run('start', 2.5), {ok: true, note: 'The loop starts at 2.5 s.'})
  assert.deepEqual(await set.actions.setLoop.run('end', 16), {ok: true, note: 'The loop ends at 16 s.'})
  assert.deepEqual(sent, [{operation: 'loop-edge', edge: 'from', at: 2.5}, {operation: 'loop-edge', edge: 'to', at: 16}])
  // The whole sequence's brace (Loop on, no region kept) is set the same way: moving one end makes a region.
  const whole = nativeTracks(contentOf(seed({})), 'Brace', {controls})
  assert.deepEqual(whole.loop, {start: 0})
  assert.ok(whole.actions.setLoop)
})

test('XT15 (round 890): the brace follows the hand inside the ruler and never past its other end; an arrow key moves an end a mark', () => {
  const bounds = {start: 0, end: 18}
  assert.deepEqual(braceEdgeAt({start: 4, end: 12}, 'end', 40, bounds), {start: 4, end: 18})
  assert.deepEqual(braceEdgeAt({start: 4, end: 12}, 'start', -2, bounds), {start: 0, end: 12})
  const held = braceEdgeAt({start: 4, end: 12}, 'start', 15, bounds)
  assert.ok(held.start < 12 && held.start > 11.9 && held.end === 12, `held before the out point: ${JSON.stringify(held)}`)
  assert.deepEqual(braceEdgeKey({start: 4, end: 12}, 'end', 'ArrowRight', 1, bounds), {start: 4, end: 13})
  assert.deepEqual(braceEdgeKey({start: 4, end: 12}, 'start', 'ArrowLeft', 1, bounds), {start: 3, end: 12})
  assert.equal(braceEdgeKey({start: 4, end: 12}, 'start', 'Enter', 1, bounds), null)
})

test('XT15 (round 890): the transport\'s Loop says, when off, that the scenes play through the brace it keeps', async () => {
  const {loopTitle} = await import('../src/components/nativeScenePlayback.ts')
  assert.equal(loopTitle({from: 4, to: 12}, false),
    'Loop is off: the scenes play through the loop region, 4.00 s to 12.00 s, which is kept where it stands. Press to repeat it as the saved sequence plays.')
  assert.equal(loopTitle(undefined, false), 'Loop the saved Scene sequence back to its first Scene at the end', 'no region: as before')
  assert.match(loopTitle({from: 4, to: 12}, true), /^Loop the saved Scene sequence back to its first Scene at the end\. Its loop region repeats/)
  const {readFile} = await import('node:fs/promises')
  const transport = await readFile(new URL('../src/shell/transports/useExpressionsTransport.tsx', import.meta.url), 'utf8')
  assert.match(transport, /title: noted\(loopTitle\(content\.scenes\?\.loop_region, model\.loop\.on\), \.\.\.said\('loop'\)\)/)
})
