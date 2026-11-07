// O-I #747 round 888, XT08 ("I keep the best stretches of several takes": §20.1 Takes and Arrangement lanes; §16.6 Rules "Each comp is one
// labelled undo step"): a comp pressed on a take lane is one step in the undo list (frame/menu/undo.ts), labelled as the press said it;
// Undo takes it back through the Scene's performance (`uncomp-take`, the kernel's uncomp_torus_take) and Redo comps it again. A comp the
// owner refuses is no step.
// - SCRIPTED: the ruler called as a stateless view and pressed; the tracks built by the Expressions registration; the owners are recorders
//   (the take acts) or the Scene's performance channel faked (LivePresets.setLivePerformanceChannel), as r3-tracks-lanes.test.mjs does.
import test from 'node:test'
import assert from 'node:assert/strict'
import {register} from 'node:module'
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
  if(url.endsWith('.css'))return {format:'module',shortCircuit:true,source:'export default null'};
  if(url.endsWith('.ts')||url.endsWith('.tsx')){
    const source=await readFile(new URL(url).pathname,'utf8');
    const {outputText}=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.ReactJSX},fileName:url});
    return {format:'module',shortCircuit:true,source:outputText};
  }
  return next(url,context);
}`)}`, {parentURL: import.meta.url})

globalThis.document = {getElementById: () => null, createElement: () => ({}), head: {appendChild: () => {}}}
const {nativeTracks, expressionsControls} = await import('../src/frame/tracks/modeTracks.ts')
const {ArrangementRulerView} = await import('../src/frame/tracks/ArrangementRuler.tsx')
const {answerOf} = await import('../src/frame/tracks/SessionGrid.tsx')
const lanes = await import('../src/frame/tracks/trackLanes.ts')
const undo = await import('../src/frame/menu/undo.ts')
const presets = await import('../src/live/LivePresets.tsx')

const noop = () => {}
const SELECT = {select() {}}
const RULER_VIEW = {window: null, onWindow: noop, snap: 'free', onSnap: noop, marker: null, onMarker: noop, width: 0}
function find(tree, pred, out = []) {
  if (Array.isArray(tree)) { for (const child of tree) find(child, pred, out); return out }
  if (!tree || typeof tree !== 'object' || !tree.props) return out
  if (pred(tree)) out.push(tree)
  return find(tree.props.children, pred, out)
}
/** FIXTURE: the presented Scene s2 of Expression w, 12 s, its Torus take 3 lying 2–5 s into it on its take lane (as r3-tracks-lanes builds it). */
function scene() {
  const take = {lane_ref: 'take-lane:torus/3', title: 'Take 3', enabled: true, solo: false, take_ref: 'sha256:' + '3'.repeat(64),
    at_sample: '96000', frames: '144000', sample_rate: 48000, transport_rate: 48000, at_seconds: 2, seconds: 3}
  const row = (ref, title, duration, extra = {}) => ({scene_ref: ref, title, native_title: title, working: {duration, transition: 0}, snapshot: {duration: null},
    material: {available: true, reason: null}, ...extra})
  return {basis: {expression_ref: 'expression:w', scene_ref: 's2'}, playback: null, scenes: {scenes: [row('s1', 'Opening', 8), row('s2', 'Second', 12, {torus_takes: [take]})]}}
}
const id = 'scene:expression:w:s2#take-lane:torus/3', audio = 'expression:expression:w:audio'
const stretch = {lane_ref: 'take-lane:torus/3', start_sample: '120000', end_sample: '192000'}
/** The take lane's body pressed with Return, a stretch 10.5–12 s of the work chosen on it: the press, as the ruler hands it to its host. */
function pressComp(set) {
  const presses = []
  const tree = ArrangementRulerView({set, selection: SELECT, view: RULER_VIEW, receipt: null, onPress: (key, what, run) => presses.push({key, what, run}), onDismiss: noop,
    lanes: {shown: lanes.DEFAULT_LANES, onShown: noop, take: {trackId: audio, takeId: id, from: 12, to: 10.5}, onTake: noop, opened: null, onOpened: noop}})
  find(tree, node => node.props?.['aria-label'] === 'Take Take 3')[0].props.onKeyDown({key: 'Enter', preventDefault() {}})
  assert.equal(presses.length, 1)
  return presses[0]
}

test('XT08: a comp is one labelled step in the undo list; Undo takes it back through the Scene\'s performance, Redo comps it again', async () => {
  undo.clearUndo()
  const calls = [], answer = note => ({ok: true, note})
  const takes = {audition: {op: 'test:audition', scene: 's2', lane: null, run: () => answer('heard')},
    comp: {op: 'test:comp', run: (sceneId, s) => { calls.push(['comp', sceneId, s]); return answer('comped') },
      back: (sceneId, s) => { calls.push(['back', sceneId, s]); return answer('taken back') }},
    lane: {op: 'test:lane', run: () => answer('set')}}
  const set = nativeTracks(scene(), 'Work', {controls: {takes}})
  const press = pressComp(set)
  assert.match(press.what, /^Comp Take 3 /)
  assert.deepEqual(undo.undoState(), {undo: null, redo: null}, 'nothing is listed before the owner takes it')
  assert.deepEqual(await answerOf(press.run), {ok: true, text: 'comped'})
  assert.deepEqual(undo.undoState(), {undo: press.what, redo: null}, 'one step, labelled as the press said it')
  await undo.undoStep()
  assert.deepEqual(undo.undoState(), {undo: null, redo: press.what})
  await undo.redoStep()
  assert.deepEqual(calls, [['comp', 's2', stretch], ['back', 's2', stretch], ['comp', 's2', stretch]], 'the same stretch each way')
  undo.clearUndo()
})

test('XT08: a comp the owner refuses is no step, and a set whose owner gives no way back lists none', async () => {
  undo.clearUndo()
  const refusing = {audition: {op: 'a', scene: 's2', lane: null, run: noop}, lane: {op: 'l', run: noop},
    comp: {op: 'test:comp', run: () => ({ok: false, error: 'No take on take-lane:torus/3 lies under the whole stretch'}), back: noop}}
  await answerOf(pressComp(nativeTracks(scene(), 'Work', {controls: {takes: refusing}})).run)
  assert.deepEqual(undo.undoState(), {undo: null, redo: null}, 'refused: nothing to undo')
  const oneWay = {...refusing, comp: {op: 'test:comp', run: () => ({ok: true, note: 'comped'})}}
  await answerOf(pressComp(nativeTracks(scene(), 'Work', {controls: {takes: oneWay}})).run)
  assert.deepEqual(undo.undoState(), {undo: null, redo: null}, 'no way back: Undo never claims a reversal the owner cannot make')
  undo.clearUndo()
})

test('XT08: the presented Scene\'s comp is taken back by its performance\'s uncomp-take, and answered in words', async () => {
  const performed = []
  const link = {state: {nativeScene: {expression_ref: 'expression:w', scene_ref: 's2'}, instrument: {ok: true, parameters: {take: {sounding: null, audition: null, refusal: null}}}},
    run: async () => ({ok: true})}
  presets.setLivePerformanceChannel(async action => { performed.push(action)
    return {state: 'take-uncomped', lane_ref: action.lane_ref, start_sample: action.start_sample, end_sample: action.end_sample, unsaved: true} })
  try {
    const {takes} = expressionsControls(undefined, link)
    assert.deepEqual(await takes.comp.back('s2', stretch), {ok: true, note: 'The stretch is taken back from the main lane. The Scene keeps it until the Expression is saved, then the file does.'})
    assert.deepEqual(performed, [{action: 'uncomp-take', ...stretch}])
    assert.match((await takes.comp.back('s1', stretch)).error, /^That take lies under another Scene than the one presented/)
    assert.equal(performed.length, 1, 'another Scene\'s: refused before any owner is called')
    presets.setLivePerformanceChannel(async () => ({state: 'refused', reason: 'The Scene did not take back the stretch of take-lane:torus/3.', missing: []}))
    assert.deepEqual(await takes.comp.back('s2', stretch), {ok: false, error: 'The Scene did not take back the stretch of take-lane:torus/3.'})
  } finally { presets.setLivePerformanceChannel(null) }
})
