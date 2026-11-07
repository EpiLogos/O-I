// O-I #747 round 888, XS04 slice 1 ("I launch a scene, loop it and layer it over a scene of another Expression": §7, §20.1 Session view, a
// scene's ▶) and XS05 on screen ("I launch a moment across several Expressions at once": §20.1 The Main track, a row of the Main track).
// The shell's side of the field's layers (native/fieldLayers.ts; the frame's `layer` stage command, field-studies-journeys fieldLayers.ts):
//   - the browser's works rows hold an Expression over the field (Layer) or let it go (Let go); the presented one gives its reason;
//   - Session view draws each held Expression as a track of its own after the presented one, its playing scene running with its progress;
//   - a held Expression's scene ▶ is the frame's layer start, its track's Stop the layer stop; the presented one's stay its composition's;
//   - a row of the Main track launches its scene on every Expression in it, the held ones over the field (XS05);
//   - a held Expression whose Activator is off says so on its scenes; the presented one's Activator never refuses another's scene.
// SCRIPTED: the frame is a recorder of the stage commands it is sent and answers as the frame does; the presented composition answers its
// scene transport. Nothing plays.
import test from 'node:test'
import assert from 'node:assert/strict'
import {register} from 'node:module'
const compiler = new URL('../node_modules/typescript/lib/typescript.js', import.meta.url).href
register(`data:text/javascript,${encodeURIComponent(`
import ts from ${JSON.stringify(compiler)};
import {readFile} from 'node:fs/promises';
export async function resolve(s, c, n) {
  let r = null
  try { r = await n(s, c) } catch (e) { if (!s.startsWith('.')) throw e }
  if (r) {
    if (r.url.endsWith('.html') || r.url.endsWith('.css')) return {...r, format: 'module'}
    return r
  }
  if (s.endsWith('.js')) { try { return await n(s.slice(0, -3) + '.ts', c) } catch {} }
  for (const x of ['.ts', '.tsx']) { try { return await n(s + x, c) } catch {} }
  for (const x of ['/index.ts', '/index.tsx']) { try { return await n(s + x, c) } catch {} }
  throw new Error('cannot resolve ' + s)
}
export async function load(u, c, n) {
  if (u.endsWith('.css')) return {format: 'module', shortCircuit: true, source: 'export {}'};
  if (u.includes('?raw') || u.includes('.html')) return {format: 'module', shortCircuit: true, source: 'export default ""'};
  if (u.endsWith('.json')) return {format: 'module', shortCircuit: true, source: 'export default ' + await readFile(new URL(u), 'utf8')};
  if (!u.endsWith('.ts') && !u.endsWith('.tsx')) return n(u, c);
  return {format: 'module', shortCircuit: true, source: ts.transpileModule(await readFile(new URL(u), 'utf8'), {fileName: new URL(u).pathname,
    compilerOptions: {target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.ReactJSX}}).outputText};
}`)}`, import.meta.url)

const {layerRowAct} = await import('../src/native/fieldLayers.ts')
const {expressionsControls, nativeTracks} = await import('../src/frame/tracks/modeTracks.ts')
const {readHostedState} = await import('../../../expressions-boundary/src/protocol.ts')

const DAWN = 'expression:dawn', TIDE = 'expression:tide'
const tide = (extra = {}) => ({expression_ref: TIDE, title: 'Tide', revision: 4, active: true,
  scenes: [{scene_ref: `${TIDE}:s1`, title: 'Swell', duration: 6}, {scene_ref: `${TIDE}:s2`, title: 'Ebb', duration: 4}], playing: null, ...extra})
const frameState = (layers = [tide()]) => ({nativeScene: {expression_ref: DAWN, revision: 2, scene_ref: `${DAWN}:s1`}, ...(layers.length ? {layers} : {})})
/** The frame's link: a recorder of the stage commands sent, answering as the frame does (`refuse` names a refusal for an act). */
const linkOf = (state, sent, refuse = {}) => ({state, run: async command => { sent.push(command); return refuse[command.action] ? {ok: false, error: refuse[command.action]} : {ok: true} }})
/** The presented composition: two scenes, its scene transport recorded. */
function presented(scenes, {active = true} = {}) {
  return {isPresented: () => true, content: {basis: {expression_ref: DAWN}, playback: {saved_sequence_playing: false, scene_playing: false},
    scenes: {mix: {level: 1, main: 1, active, solo: false}, scenes: [{scene_ref: `${DAWN}:s1`, title: 'Dawn', native_title: 'n', working: {duration: 8, transition: 0}, snapshot: {duration: null}},
      {scene_ref: `${DAWN}:s2`, title: 'Noon', native_title: 'n', working: {duration: 8, transition: 0}, snapshot: {duration: null}}]}},
    actions: {scene: async intent => { scenes.push(intent); return {ok: true, reading: {playback: null}} }, sceneEdit: async () => ({ok: true})}}
}
function session({layers = [tide()], active = true, refuse = {}} = {}) {
  const sent = [], scenes = [], link = linkOf(frameState(layers), sent, refuse), source = presented(scenes, {active})
  const set = nativeTracks(source.content, 'Dawn', {controls: expressionsControls(source, link), layers})
  return {set, sent, scenes}
}

test('XS04: the browser\'s works row holds an Expression over the field and lets it go; the presented one, or no frame, gives its reason', async () => {
  const sent = [], link = linkOf(frameState([]), sent)
  const layer = layerRowAct(link, {expression_ref: TIDE, title: 'Tide'})
  assert.equal(layer.label, 'Layer')
  assert.equal(layer.disabled, undefined)
  assert.deepEqual(await layer.run(), {ok: true, note: 'Tide is held over the field: launch one of its scenes on its track.'})
  assert.deepEqual(sent, [{command: 'layer', action: 'hold', expression_ref: TIDE}])
  const letGo = layerRowAct(linkOf(frameState([tide()]), sent), {expression_ref: TIDE, title: 'Tide'})
  assert.equal(letGo.label, 'Let go', 'held, the row lets it go')
  assert.deepEqual(await letGo.run(), {ok: true, note: 'Tide is let go from the field.'})
  assert.deepEqual(sent.at(-1), {command: 'layer', action: 'release', expression_ref: TIDE})
  assert.equal(layerRowAct(link, {expression_ref: DAWN, title: 'Dawn'}).disabled, 'This Expression is the one presented: its scenes play on the field already.')
  assert.equal(layerRowAct({state: null, run: null}, {expression_ref: TIDE, title: 'Tide'}).disabled,
    'No Expressions application is mounted: open an Expression to layer another over its field.')
  const refused = layerRowAct(linkOf(frameState([]), [], {hold: 'The field holds 3 Expressions over the presented one: release one first.'}), {expression_ref: TIDE, title: 'Tide'})
  assert.deepEqual(await refused.run(), {ok: false, error: 'The field holds 3 Expressions over the presented one: release one first.'}, 'the frame\'s own words')
});

test('XS04: Session view draws a held Expression as its own track after the presented one; the scene it plays runs, with how far it has got', () => {
  const {set} = session({layers: [tide({playing: {scene_ref: `${TIDE}:s1`, elapsed: 1.5, loop: true}})]})
  assert.deepEqual(set.tracks.filter(track => track.id.startsWith('expression:')).map(track => track.id), [`expression:${DAWN}:visual`, `expression:${DAWN}:audio`, `expression:${TIDE}:visual`, `expression:${TIDE}:audio`])
  assert.deepEqual(set.tracks.slice(2, 4).map(track => track.name), ['Tide: visual', 'Tide: audio'])
  const clip = id => set.clips.find(row => row.id === `scene:${TIDE}:${id}:visual`)
  assert.equal(clip(`${TIDE}:s1`).status, 'running')
  assert.deepEqual(clip(`${TIDE}:s1`).progress, {elapsed: 1.5, expected: 6})
  assert.equal(clip(`${TIDE}:s2`).status, 'stopped', 'its other scene stands ready')
  assert.equal(clip(`${TIDE}:s1`).columnId, set.clips.find(row => row.id === `scene:${DAWN}:${DAWN}:s1:visual`).columnId, 'each in the row it stands in')
  const off = session({layers: [tide({active: false})]}).set
  assert.equal(off.clips.find(row => row.id === `scene:${TIDE}:${TIDE}:s1:visual`).note, 'This Expression\'s Activator is off: its scenes do not launch.')
});

test('XS04: a held Expression\'s scene ▶ launches it over the field; its track\'s Stop stops it; the presented one\'s stay its own transport', async () => {
  const {set, sent, scenes} = session()
  assert.deepEqual(await set.actions.launch.run(`scene:${TIDE}:${TIDE}:s2:visual`), {ok: true, note: 'Ebb plays over the field.'})
  assert.deepEqual(sent, [{command: 'layer', action: 'start', expression_ref: TIDE, scene_ref: `${TIDE}:s2`}])
  assert.deepEqual(scenes, [], 'the presented composition is not asked')
  await set.actions.launch.run(`scene:${DAWN}:${DAWN}:s1:visual`)
  assert.deepEqual(scenes, [{action: 'play-scene', scene_ref: `${DAWN}:s1`}], 'the presented scene through its own transport')
  assert.equal(sent.length, 1)
  assert.deepEqual(await set.actions.stopTrack.run(`expression:${TIDE}:audio`), {ok: true, note: 'Tide stops: the field plays the presented Expression alone.'})
  assert.deepEqual(sent.at(-1), {command: 'layer', action: 'stop', expression_ref: TIDE})
  await set.actions.stopTrack.run(`expression:${DAWN}:visual`)
  assert.deepEqual(scenes.at(-1), {action: 'pause'}, 'the presented track\'s Stop pauses its scene')
  const refused = session({refuse: {start: 'This Expression\'s Activator is off: its scenes do not launch.'}})
  assert.deepEqual(await refused.set.actions.launch.run(`scene:${TIDE}:${TIDE}:s1:visual`), {ok: false, error: 'This Expression\'s Activator is off: its scenes do not launch.'},
    'a held Expression whose Activator is off does not launch, in the frame\'s words')
  const presentedOff = session({active: false})
  assert.deepEqual(await presentedOff.set.actions.launch.run(`scene:${TIDE}:${TIDE}:s1:visual`), {ok: true, note: 'Swell plays over the field.'},
    'the presented Expression\'s Activator answers for its own scenes only')
  assert.equal((await presentedOff.set.actions.launch.run(`scene:${DAWN}:${DAWN}:s1:visual`)).ok, false)
});

test('XS05 on screen: a row of the Main track launches its scene on every Expression in it, a held one\'s over the field; Stop All stops every one', async () => {
  const {set, sent, scenes} = session({layers: [tide({playing: {scene_ref: `${TIDE}:s1`, elapsed: 0.5, loop: false}})]})
  const row = set.clips.find(clip => clip.id === `scene:${DAWN}:${DAWN}:s2:visual`).columnId
  assert.deepEqual(await set.actions.launchStop.run(row), {ok: true, note: 'The row plays: its scene on 2 Expressions.'})
  assert.deepEqual(scenes, [{action: 'play-scene', scene_ref: `${DAWN}:s2`}])
  assert.deepEqual(sent, [{command: 'layer', action: 'start', expression_ref: TIDE, scene_ref: `${TIDE}:s2`}])
  assert.deepEqual(await set.actions.stopAll.run(), {ok: true, note: 'Every scene stopped.'})
  assert.deepEqual(scenes.at(-1), {action: 'pause'})
  assert.deepEqual(sent.at(-1), {command: 'layer', action: 'stop', expression_ref: TIDE}, 'the held Expression that plays stops too')
});

test('XS04: the hosted reading carries what the frame holds over its field, exactly, or is refused', () => {
  const state = {hostMode: 'expressions', sceneCount: 2, ...frameState([tide({playing: {scene_ref: `${TIDE}:s1`, elapsed: 2, loop: true}})])}
  assert.deepEqual(readHostedState(state).layers, state.layers)
  assert.equal(readHostedState({...state, layers: [{...tide(), playing: {scene_ref: 'elsewhere', elapsed: 0, loop: false}}]}), null)
  assert.equal(readHostedState({...state, layers: 'tide'}), null)
  assert.equal(readHostedState({hostMode: 'expressions', sceneCount: 2, ...frameState([])}).layers, undefined, 'nothing held: no layers')
});
