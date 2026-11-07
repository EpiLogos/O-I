// O-I #747 round 889, XS04 slice 2 and the walk of slice 1 (DLW.md §20.1 The mixer row; Session view's Clip Stop buttons):
//   - a held Expression's track carries its own mixer row (Activator, Solo, Volume), as the field reports it, and dims when it is off;
//   - its mixer presses write its own mixer through the field's `layer` act `mix`; the presented one's, and Main, stay its document's;
//   - found walking slice 1: a held Expression's track took the presented one's mixer and edits (its Rename renamed the presented one);
//     now each edit is refused in words on it;
//   - found walking slice 1: a track whose every slot holds a clip had no Stop; every track now has its Clip Stop under its slots.
// SCRIPTED: the frame is a recorder of the stage commands sent; the presented composition records its scene edits. Nothing plays.
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


globalThis.document = {getElementById: () => null, createElement: () => ({}), head: {appendChild: () => {}}}
const React = await import('react')
const {renderToStaticMarkup} = await import('react-dom/server')
const {expressionsControls, nativeTracks} = await import('../src/frame/tracks/modeTracks.ts')
const {SessionGridView} = await import('../src/frame/tracks/SessionGrid.tsx')
const {mixerCells} = await import('../src/frame/tracks/trackLanes.ts')

const DAWN = 'expression:dawn', TIDE = 'expression:tide'
const tide = (extra = {}) => ({expression_ref: TIDE, title: 'Tide', revision: 4, active: true, mix: {active: true, solo: false, level: 1},
  scenes: [{scene_ref: `${TIDE}:s1`, title: 'Swell', duration: 6}, {scene_ref: `${TIDE}:s2`, title: 'Ebb', duration: 4}], playing: null, ...extra})
const frameState = layers => ({nativeScene: {expression_ref: DAWN, revision: 2, scene_ref: `${DAWN}:s1`}, ...(layers.length ? {layers} : {})})
/** The frame's link: a recorder of the stage commands sent, answering as the frame does. */
const linkOf = (state, sent) => ({state, run: async command => { sent.push(command); return {ok: true} }})
/** The presented composition: two scenes; its scene edits recorded (its own mixer is written through them). */
function presented(edits) {
  return {isPresented: () => true, content: {basis: {expression_ref: DAWN}, playback: {saved_sequence_playing: false, scene_playing: false},
    scenes: {mix: {level: 1, main: 0.5, active: true, solo: false}, description: 'The dawn.', scenes: [{scene_ref: `${DAWN}:s1`, title: 'Dawn', native_title: 'n', working: {duration: 8, transition: 0}, snapshot: {duration: null}},
      {scene_ref: `${DAWN}:s2`, title: 'Noon', native_title: 'n', working: {duration: 8, transition: 0}, snapshot: {duration: null}}]}},
    actions: {scene: async () => ({ok: true, reading: {playback: null}}), sceneEdit: async intent => { edits.push(intent); return {ok: true} }}}
}
function session(layers = [tide()]) {
  const sent = [], edits = [], link = linkOf(frameState(layers), sent), source = presented(edits)
  const set = nativeTracks(source.content, 'Dawn', {controls: expressionsControls(source, link), layers})
  return {set, sent, edits}
}
const track = (set, id) => set.tracks.find(row => row.id === id)
const noop = () => {}
const html = set => renderToStaticMarkup(React.createElement(SessionGridView, {set, selection: {select() {}}, folded: {}, onFold: noop, receipt: null, onPress: noop, onDismiss: noop}))

test('slice 2: a held Expression\'s track carries its own mixer row — its Activator, Solo and Volume — never the presented one\'s', () => {
  const {set} = session([tide({active: false, mix: {active: false, solo: true, level: 0.5}})])
  for (const lane of ['visual', 'audio']) {
    assert.deepEqual(track(set, `expression:${TIDE}:${lane}`).mix, {activator: false, solo: true, volume: -6}, `Tide: ${lane}`)
    assert.deepEqual(track(set, `expression:${DAWN}:${lane}`).mix, {activator: true, solo: false, volume: 0}, `Dawn: ${lane}`)
  }
  assert.match(html(set), new RegExp(`data-track="expression:${TIDE}:visual" data-off="true"`), 'switched off, its track is dimmed')
  assert.doesNotMatch(html(set), new RegExp(`data-track="expression:${DAWN}:visual" data-off`))
})

test('slice 2: a held Expression\'s Activator, Solo and Volume write its own mixer through the field; the presented one\'s and Main stay its document\'s', async () => {
  const {set, sent, edits} = session()
  const mixer = set.actions.mixer
  assert.deepEqual(await mixer.activator.run(`expression:${TIDE}:visual`, false), {ok: true, note: 'Tide is off: its scenes do not launch.'})
  assert.deepEqual(sent, [{command: 'layer', action: 'mix', expression_ref: TIDE, set: {active: false}}])
  assert.deepEqual(await mixer.activator.run(`expression:${TIDE}:audio`, true), {ok: true, note: 'Tide plays again.'})
  assert.deepEqual(sent.at(-1), {command: 'layer', action: 'mix', expression_ref: TIDE, set: {active: true}})
  assert.deepEqual(await mixer.solo.run(`expression:${TIDE}:visual`, true), {ok: true, note: 'Only Tide sounds.'})
  assert.deepEqual(sent.at(-1).set, {solo: true})
  await mixer.solo.run(`expression:${TIDE}:visual`, false)
  assert.deepEqual(sent.at(-1).set, {solo: null}, 'Solo off returns it to its default')
  assert.deepEqual(await mixer.volume.run(`expression:${TIDE}:visual`, -70), {ok: true, note: 'Tide\'s level is set.'})
  assert.deepEqual(sent.at(-1).set, {level: 0})
  assert.deepEqual(edits, [], 'the presented composition is not written for a held Expression')
  await mixer.activator.run(`expression:${DAWN}:visual`, false)
  await mixer.volume.run('expressions:main', 0)
  assert.deepEqual(edits, [{operation: 'mix', set: {active: false}}, {operation: 'mix', set: {main: 1}}], 'the presented one\'s, and the Main level for every Expression')
  assert.equal(sent.length, 5, 'and the field is not asked')
})

test('the walk (round 889): a held Expression\'s track takes none of the presented one\'s edits: each is refused in words, nothing written', async () => {
  const {set, edits} = session()
  const refusal = {ok: false, error: 'Tide is held over the field: open it to change it.'}
  const tideTrack = `expression:${TIDE}:visual`, tideClip = `scene:${TIDE}:${TIDE}:s1:visual`
  assert.deepEqual(await set.actions.renameTrack.run(tideTrack, 'Other'), refusal)
  assert.deepEqual(await set.actions.colourTrack.run(tideTrack, '#5480E4'), refusal)
  assert.deepEqual(await set.actions.duplicateClip.run(tideClip), refusal)
  assert.deepEqual(await set.actions.deleteClip.run(tideClip), refusal)
  assert.deepEqual(edits, [])
  await set.actions.renameTrack.run(`expression:${DAWN}:visual`, 'Morning')
  assert.deepEqual(edits, [{operation: 'expression-title', title: 'Morning'}], 'the presented one\'s track still renames it')
})

test('the walk (round 889): every track has its Clip Stop under its slots, as Live\'s, so a track whose every slot holds a clip can be stopped', () => {
  const {set} = session()
  const markup = html(set)
  assert.doesNotMatch(markup, /aria-label="Stop Tide: visual"/, 'Tide has no empty slot: no stop square')
  assert.match(markup, /class="trk-foot"><button type="button" class="cs-stop" aria-label="Stop the clip on Tide: visual"/, 'its track\'s own Stop')
  const presses = []
  const tree = SessionGridView({set, selection: {select() {}}, folded: {}, onFold: noop, receipt: null, onPress: (key, what, run) => presses.push({key, what, run}), onDismiss: noop})
  const find = (node, pred, out = []) => { if (Array.isArray(node)) { for (const child of node) find(child, pred, out); return out }
    if (!node || typeof node !== 'object' || !node.props) return out; if (pred(node)) out.push(node); return find(node.props.children, pred, out) }
  find(tree, n => n.props['aria-label'] === 'Stop the clip on Tide: visual')[0].props.onClick()
  assert.deepEqual(presses.map(p => [p.key, p.what]), [[`stop:expression:${TIDE}:visual`, 'Stop Tide: visual']])
})

test('the walk (round 889): a mixer switch\'s press says what it set and where, in plain words ("Solo on for Tide", never "Solo on on Tide")', () => {
  const {set} = session()
  const tideTrack = track(set, `expression:${TIDE}:visual`)
  const cells = mixerCells(set, tideTrack, 1)
  assert.equal(cells.find(cell => cell.id === 'solo').press.what, 'Solo on for Tide: visual')
  assert.equal(cells.find(cell => cell.id === 'activator').press.what, 'Activator off for Tide: visual')
})
