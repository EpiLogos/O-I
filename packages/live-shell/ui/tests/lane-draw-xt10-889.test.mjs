import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {register} from 'node:module'

// O-I #747 round 889, XT10 ("I read and draw a Studio macro's moves over the course of a scene": §20.1 Takes and Arrangement lanes, "Under
// a track, an automation lane shows the recorded moves of one of the Studio's macros, such as Turbulence over the course of a scene";
// §16.6 automation lanes; §20.3 Rules, "A macro set to All scenes is not recorded. Turn All scenes off to record its moves").
//   - the scene's recorded lane is drawn in the Arrangement: a drag across it is one edit of the scene's recorded track (`track-draw`),
//     which lays the drawn moves over the stretch drawn and keeps the moves outside it;
//   - a drawn value stays inside its parameter's own range, a lane is drawn within its scene, and a macro on All scenes is neither recorded
//     nor drawn: each is refused in words and the scene is unchanged;
//   - the lane is shown on its parameter's own range, so what is drawn at the top of the lane is the parameter's top.
// FIXTURE: a blank Expression of the Expressions model (model.ts blankJourney) with a recorded track; SCRIPTED: the owner is the real
// retained native editor over a document store, the views are rendered to static markup or called as functions. No browser.
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
const [trackEdits, model, parameters, {DocumentStore}, {createRetainedNativeEditor}, {kernelDocumentToJourney}, {nativeTracks, sceneAutomationOf, expressionsControls}, lanes, {ArrangementRuler}] = await Promise.all([
  import(new URL('nativeTrackEdits.ts', boundary)),
  import(new URL('model.ts', app)),
  import(new URL('parameters.ts', boundary)),
  import(new URL('store.ts', app)),
  import(new URL('hostEditor.ts', app)),
  import(new URL('kernelDocumentBridge.ts', app)),
  import('../src/frame/tracks/modeTracks.ts'),
  import('../src/frame/tracks/trackLanes.ts'),
  import('../src/frame/tracks/ArrangementRuler.tsx'),
])
const appSource = await readFile(new URL('app.ts', app), 'utf8')
const {applyNativeTrackChanges, readNativeTakeTracks, validateNativeTrackChange} = trackEdits
const RECOVERY = parameters.NATIVE_BINDINGS.find(binding => binding.key === 'recovery')
const BIND = 'field.params.recovery'
const recorded = () => ({id: 'take-a', bind: BIND, points: [{time: 0, value: RECOVERY.hardMin}, {time: 2, value: RECOVERY.hardMax}, {time: 4, value: RECOVERY.hardMin}]})
const sceneWith = journey => { journey.scenes[0].duration = 8; journey.scenes[0].propertyTracks = [recorded()]; return journey }
const draw = points => ({kind: 'track-draw', track_id: 'take-a', points})
const mid = (RECOVERY.hardMin + RECOVERY.hardMax) / 2

test('XT10: track-draw is one closed shape: two or more points, in time order, within the hour', () => {
  const change = draw([{time: 1, value: 1}, {time: 3, value: 2}])
  assert.deepEqual(validateNativeTrackChange(change), change)
  for (const bad of [draw([{time: 1, value: 1}]), draw([{time: 3, value: 1}, {time: 1, value: 2}]), draw([{time: 1, value: 1}, {time: 1, value: 2}]),
    draw([{time: 1, value: NaN}, {time: 2, value: 1}]), draw([{time: -1, value: 1}, {time: 2, value: 1}]), draw([{time: 1, value: 1}, {time: 3601, value: 1}]),
    draw([{time: 1, value: 1, in: {dt: 0, dv: 0}}, {time: 2, value: 1}]), {...draw([{time: 1, value: 1}, {time: 2, value: 1}]), extra: 1},
    draw(Array.from({length: 513}, (_, i) => ({time: i, value: 1}))), draw('points')])
    assert.throws(() => validateNativeTrackChange(bad), /Draw a lane with 2 to 512 points, in time order, from 0 to 3600 s\.|admitted property track edit/, JSON.stringify(bad).slice(0, 80))
})

test('XT10: a drawn stretch lies over the recorded moves it covers and keeps the moves outside it; the scene read is untouched', () => {
  const journey = sceneWith(model.blankJourney()), before = structuredClone(journey)
  const after = applyNativeTrackChanges(journey, journey.scenes[0].id, [draw([{time: 1, value: mid}, {time: 3, value: mid}])])
  assert.deepEqual(after.scenes[0].propertyTracks[0].points, [{time: 0, value: RECOVERY.hardMin}, {time: 1, value: mid}, {time: 3, value: mid}, {time: 4, value: RECOVERY.hardMin}])
  assert.deepEqual(journey, before)
})

test('XT10: a value outside the parameter\'s range, a lane past its scene and a macro on All scenes are refused in words', () => {
  const journey = sceneWith(model.blankJourney()), before = structuredClone(journey), scene = journey.scenes[0].id
  assert.throws(() => applyNativeTrackChanges(journey, scene, [draw([{time: 1, value: RECOVERY.hardMax + 1}, {time: 2, value: mid}])]), /outside the channel range/)
  assert.throws(() => applyNativeTrackChanges(journey, scene, [draw([{time: 7, value: mid}, {time: 9, value: mid}])]), /A lane is drawn within its scene: 0 to 8 s\./)
  journey.shared = {toolbelt: [], values: {[BIND]: mid}, pointer: {}}
  assert.throws(() => applyNativeTrackChanges(journey, scene, [draw([{time: 1, value: mid}, {time: 2, value: mid}])]),
    /A macro set to All scenes is not recorded\. Turn All scenes off to draw its moves\./)
  delete journey.shared
  assert.deepEqual(journey, before)
})

test('XT10: the frame records no macro set to All scenes (§20.3 Rules)', () => {
  // recordableTracks: a binding shared across the Expression's scenes (sharedSettings.ts isShared) is never a take's track
  assert.match(appSource, /function recordableTracks\(\)\{[^\n]*return isShared\(store\.document,scene\(\),bind\)\|\|readTrackValue\(scene\(\),track\)===undefined\?\[\]:\[track\];\}\);\}/)
})

test('XT10: the reading gives each recorded lane its parameter\'s own range, and the lane is drawable on it', () => {
  const journey = sceneWith(model.blankJourney())
  const [row] = readNativeTakeTracks(journey.scenes[0])
  assert.deepEqual(row.range, {min: RECOVERY.hardMin, max: RECOVERY.hardMax})
  const presented = {basis: {expression_ref: 'expression:w', scene_ref: 's1'}, scene: {...journey.scenes[0], automation: [
    {id: 'lfo1', enabled: true, target: 'field.params.swirl', type: 'lfo', wave: 'sine', rate: .5, min: 0, max: 1, blend: 'add'}]}}
  const [lane, generated] = sceneAutomationOf(presented)
  assert.deepEqual([lane.range, lane.drawable, lane.points.map(point => point.value)], [{min: RECOVERY.hardMin, max: RECOVERY.hardMax}, true, [0, 1, 0]])
  assert.equal(generated.drawable, undefined, 'a generator\'s lane moves by itself: it is not drawn')
})

test('XT10: the Arrangement draws on a drawable lane through the owner, in the parameter\'s range and the scene\'s own seconds', async () => {
  const journey = sceneWith(model.blankJourney())
  const presented = {basis: {expression_ref: 'expression:w', scene_ref: 's1'}, scene: {...journey.scenes[0], automation: []}}
  const content = {basis: {expression_ref: 'expression:w', scene_ref: 's1'}, playback: {scene_ref: 's1', scene_playing: false, saved_sequence_playing: false},
    scenes: {scenes: [{scene_ref: 's1', title: 'Opening', native_title: 'n', working: {duration: 8, transition: 0}, snapshot: {duration: null}, material: {available: true, reason: null}}]}}
  const sent = []
  const set = nativeTracks(content, 'Work', {reading: presented, controls: {drawLane: {op: 'expressions editor · apply track-draw', run: (scene, track, points) => { sent.push({scene, track, points}); return {ok: true, note: 'drawn'} }}}})
  const [lane] = set.lanes.automation
  assert.equal(lane.drawable, true)
  assert.ok(set.actions.drawLane, 'the set draws lanes')
  assert.deepEqual(await set.actions.drawLane.run(lane.id, [{at: 1, value: .5}, {at: 3, value: 1}]), {ok: true, note: 'drawn'})
  assert.deepEqual(sent, [{scene: 's1', track: 'take-a', points: [{time: 1, value: mid}, {time: 3, value: RECOVERY.hardMax}]}])
  assert.deepEqual(await set.actions.drawLane.run('scene:expression:w:s9#lane/x', [{at: 1, value: .5}, {at: 3, value: 1}]),
    {ok: false, error: 'That lane is not the presented scene\'s: open its scene to draw it.'})
  const markup = renderToStaticMarkup(React.createElement(ArrangementRuler, {set, selection: {select() {}}}))
  assert.match(markup, /data-automation="scene:expression:w:s1#lane\/take-a"[^>]*>(?:(?!data-automation).)*?<div class="tl-body" data-draw="on" title="Drag across the lane to draw Field \/ recovery\b/s)
})

test('XT10: a drag across the lane is its moves in the lane\'s own time, one value for each moment, in order', () => {
  assert.equal(typeof lanes.drawnLane, 'function')
  // the samples as the pointer gave them (ruler seconds, the lane's 0–1 height), the clip lying from 10 s on the ruler
  assert.deepEqual(lanes.drawnLane([{at: 11, value: .2}, {at: 12.5, value: 1.4}, {at: 12, value: .6}, {at: 12.5, value: .8}, {at: 9, value: -.1}], 10),
    [{at: 0, value: 0}, {at: 1, value: .2}, {at: 2, value: .6}, {at: 2.5, value: .8}])
  assert.equal(lanes.drawnLane([{at: 11, value: .2}, {at: 11, value: .4}], 10), null, 'a press without a drag draws nothing')
  assert.equal(lanes.drawnLane([{at: 11, value: .2}, {at: 12, value: .4}], undefined), null, 'a lane whose clip is not on the ruler is not drawn')
})

test('XT10: the presented composition writes the drawn lane as one track-draw edit; another scene is refused in words', async () => {
  const applied = []
  const source = {isPresented: () => true, content: {basis: {expression_ref: 'expression:w', scene_ref: 's1'}},
    actions: {applyChanges: async changes => { applied.push(changes); return {ok: true, reading: {}} }, scene: async () => ({ok: true}), sceneEdit: async () => ({ok: true})}}
  const controls = expressionsControls(source, {run: null, state: null})
  assert.deepEqual(await controls.drawLane.run('s1', 'take-a', [{time: 1, value: 2}, {time: 2, value: 3}]), {ok: true, note: 'The lane is drawn.'})
  assert.deepEqual(applied, [[{kind: 'track-draw', track_id: 'take-a', points: [{time: 1, value: 2}, {time: 2, value: 3}]}]])
  assert.deepEqual(await controls.drawLane.run('s2', 'take-a', [{time: 1, value: 2}, {time: 2, value: 3}]), {ok: false, error: 'That lane is not the presented scene\'s: open its scene to draw it.'})
})

test('XT10: one drawn lane through the real owner is one committed gesture', async () => {
  // FIXTURE: the kernel document of a native composition receipt (as tests/native-property-takes.test.mjs reads it), with a recorded track.
  const nativeDocument = JSON.parse(await readFile(new URL('./fixtures/native-rich-glyph-rack-r8.receipt.json', import.meta.url), 'utf8')).after.document
  const view = kernelDocumentToJourney(nativeDocument)
  const store = new DocumentStore(view.journey)
  const scene = store.document.scenes.find(item => item.id === view.startSceneId) ?? store.document.scenes[0]
  store.change(() => { const own = store.document.scenes.find(item => item.id === scene.id); own.duration = Math.max(own.duration, 8); own.propertyTracks = [recorded()] })
  let committed = 0
  const owner = createRetainedNativeEditor({store, sceneId: () => scene.id, selection: () => ({entity_ids: [], step_id: null}), nativeView: () => view,
    nativeSelect: () => {throw Error('closed')}, commit: async () => {committed++; return true}, change: (label, mutate) => store.change(label, mutate), afterHistory: () => {throw Error('closed')},
    selectLocal: () => {throw Error('closed')}, openEditor: () => {throw Error('closed')}, standing: () => ({busy: false, notice: null}), telemetry: () => undefined, fieldPaused: () => false})
  await owner.apply({operation: 'apply', basis: owner.read().basis, changes: [draw([{time: 1, value: mid}, {time: 3, value: mid}])]})
  assert.equal(committed, 1, 'one gesture, one commit')
  assert.deepEqual(owner.read().scene.propertyTracks[0].points.map(point => point.time), [0, 1, 3, 4])
})
