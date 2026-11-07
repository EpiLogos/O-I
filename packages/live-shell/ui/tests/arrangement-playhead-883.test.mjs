// O-I #747 round 883 (DLW build ruling 2026-11-06, the playhead): the playing scene's position is the Arrangement's playhead for
// Expressions, from what the frame reports (the owner's scene_elapsed_seconds, read through modeTracks.ts statusOf as the scene's
// progress), never a shell clock. ⌘E splits at it, as §16.6 says ("Cuts the clip in two at the playhead"), and cut snapping uses it.
// Where nothing plays, the insert marker stands as before.
// - SCRIPTED: the adapter's projection with a scene's reported progress; the stateless ruler view called directly, its clip handlers run
//   with the geometry a press would read; the object menu's Split. No DOM and no clock: nothing here proves how the line looks on screen.
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

const React = await import('react')
const {renderToStaticMarkup} = await import('react-dom/server')
const {projectExpressionsWork} = await import('../src/timeline/expressionsTrackAdapter.ts')
const cuts = await import('../src/frame/tracks/clipCuts.ts')
const {ArrangementRulerView} = await import('../src/frame/tracks/ArrangementRuler.tsx')
const acts = await import('../src/frame/menu/objectActions.ts')

const E = 'expression:cuts'
const C = (n, side = 'visual') => `scene:${E}:s${n}:${side}`
/** One Expression of four scenes, 10, 8, 12 and 6 s: on the ruler S1 0–10, S2 10–18, S3 18–30, S4 30–36; `playing` names the scene the
 * owner reports running and its elapsed seconds. The owner's scene edit is recorded. */
const reading = (sent, playing = null) => ({
  expressions: [{id: E, name: 'Cuts', scenes: [10, 8, 12, 6].map((duration, i) => ({id: `s${i + 1}`, name: `Scene ${i + 1}`, duration,
    ...(playing?.scene === i + 1 ? {status: 'running', ...(playing.elapsed !== undefined ? {progress: {elapsed: playing.elapsed, expected: duration}} : {})} : {})}))}],
  controls: {sceneEdit: {op: 'scene-edit', run: intent => { sent.push(intent); return {ok: true} }}},
})
const work = playing => { const sent = []; return {sent, set: projectExpressionsWork(reading(sent, playing))} }

const noop = () => {}
function find(tree, pred, out = []) {
  if (Array.isArray(tree)) { for (const child of tree) find(child, pred, out); return out }
  if (!tree || typeof tree !== 'object' || !tree.props) return out
  if (pred(tree)) out.push(tree)
  return find(tree.props.children, pred, out)
}
/** The ruler fitted to 0–36 over a lane body 360 px wide: 10 px a second. A clip's button reads its own box and its lane body's. */
const geometry = (start, end) => ({getBoundingClientRect: () => ({left: start * 10, width: (end - start) * 10}), setPointerCapture: noop,
  parentElement: {getBoundingClientRect: () => ({left: 0, width: 360})}})
const viewOf = (set, over = {}) => {
  const pressed = [], selected = []
  const props = {set, selection: {select: s => selected.push(s)}, receipt: null, onDismiss: noop, onPress: (key, what, run) => pressed.push({key, what, run}),
    view: {window: null, onWindow: noop, snap: 'grid', onSnap: noop, marker: null, onMarker: noop, width: 360,
      cuts: {move: 'insert', onMove: noop, trim: 'trim', onTrim: noop, drag: {current: null}, onPreview: noop}, ...over}}
  const tree = ArrangementRulerView(props)
  const clip = id => find(tree, el => el.props?.['data-clip'] === id)[0]
  return {props, tree, clip, pressed, selected}
}
const drag = (button, box, from, to, extra = {}) => {
  const target = geometry(...box)
  button.props.onPointerDown({button: 0, pointerId: 1, clientX: from, currentTarget: target, ...extra})
  button.props.onPointerMove({pointerId: 1, clientX: to, buttons: 1, currentTarget: target, ...extra})
  button.props.onPointerUp({pointerId: 1, clientX: to, currentTarget: target, ...extra})
}

test('r883: the playing scene\'s position is the Arrangement\'s playhead: where it lies on the ruler and how far the owner says it has got', () => {
  assert.equal(work({scene: 2, elapsed: 3}).set.playhead, 13, 'Scene 2 lies from 10 and has played 3 s')
  assert.equal(work({scene: 2, elapsed: 9.5}).set.playhead, 18, 'past its length, it stands at the scene\'s end')
  assert.equal(work({scene: 4, elapsed: 0}).set.playhead, 30)
  assert.equal('playhead' in work(null).set, false, 'nothing plays: no playhead')
  assert.equal('playhead' in work({scene: 3}).set, false, 'a running scene with no reported progress: no playhead is guessed')
})

test('r883: the ruler draws the playhead in every lane, and a cut snaps to it', async () => {
  const {sent, set} = work({scene: 2, elapsed: 3})
  const markup = renderToStaticMarkup(viewOf(set).tree)
  assert.ok((markup.match(/class="tl-playhead"/g) ?? []).length >= 2, 'a line in each lane')
  assert.match(markup, /title="Playhead at [^"]*: where what plays stands, as its owner reports it"/)
  assert.doesNotMatch(renderToStaticMarkup(viewOf(work(null).set).tree), /tl-playhead/, 'nothing plays: no line')
  assert.ok(cuts.cutTargets(set, C(3), {marker: null, playhead: 13}).includes(13), 'the playhead is a snap point')
  const {clip, pressed} = viewOf(set)
  drag(clip(C(1)), [0, 10], 98, 125)
  await pressed[0].run()
  assert.deepEqual(sent.at(-1), {operation: 'trim', scene_ref: 's1', edge: 'end', seconds: 3}, 'the end edge pulled to the playhead at 13')
  const still = work(null), quiet = viewOf(still.set)
  drag(quiet.clip(C(1)), [0, 10], 98, 125)
  await quiet.pressed[0].run()
  assert.deepEqual(still.sent.at(-1), {operation: 'trim', scene_ref: 's1', edge: 'end', seconds: 2.7}, 'with nothing playing, nothing pulls it there')
})

test('r883: Split (⌘E) cuts at the playhead while a scene plays, refused in words when it is not inside; with nothing playing, at the marker', () => {
  const context = extra => ({view: 'arrangement', binding: null, press: (_key, _what, run) => run(), rename: () => {}, writeClip: async () => ({ok: true}), ...extra})
  const split = (set, n, extra) => acts.objectMenu({kind: 'clip', id: C(n), trackId: `expression:${E}:visual`, name: `Scene ${n}`}, set, context(extra)).find(item => item.id === 'split')
  const {sent, set} = work({scene: 2, elapsed: 3})
  const there = split(set, 2, {marker: null})
  assert.equal(there.disabled, undefined, there.why)
  there.onSelect('split')
  assert.deepEqual(sent, [{operation: 'split', scene_ref: 's2', at: 3}], 'cut 3 s into Scene 2, where the playhead stands')
  const elsewhere = split(set, 3, {marker: 23})
  assert.equal(elsewhere.disabled, true)
  assert.equal(elsewhere.why, 'Split cuts Scene 3 at the playhead while a scene plays, and the playhead is not inside it.')
  const still = work(null), marked = split(still.set, 3, {marker: 23})
  marked.onSelect('split')
  assert.deepEqual(still.sent, [{operation: 'split', scene_ref: 's3', at: 5}], 'nothing plays: the insert marker, as before')
})
