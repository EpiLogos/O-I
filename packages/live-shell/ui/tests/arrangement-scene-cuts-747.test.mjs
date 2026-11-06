// O-I #747 (manual §20.1 "Takes and Arrangement lanes": "Arrangement view is Expressions' timeline, and you cut on it as a video editor
// does: move, trim, roll, slip, slide and split scenes (§16.6)"). Each cut is a drag (or ⌘E) on a scene's clip in the shared Arrangement,
// handed to the Expression's owner through the track adapter's acts, one set across modes beside the Live set's splitClip:
// - SCRIPTED: the adapter's acts with the owner's scene edit recorded; the ruler's pure drag rules (frame/tracks/clipCuts.ts); the stateless
//   ruler view called directly, its clip handlers run with the geometry a press would read; the object menu's Split. There is no DOM, so
//   nothing here proves how a drag looks: that is for the screen pass. The owner's side is packages/expressions-boundary/tests/scene-cuts-747.
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

const sound = await import('../src/native/frameSound.ts')

const React = await import('react')
const {renderToStaticMarkup} = await import('react-dom/server')
const {projectExpressionsWork} = await import('../src/timeline/expressionsTrackAdapter.ts')
const cuts = await import('../src/frame/tracks/clipCuts.ts')
const {ArrangementRulerView} = await import('../src/frame/tracks/ArrangementRuler.tsx')
const acts = await import('../src/frame/menu/objectActions.ts')

const E = 'expression:cuts'
const C = (n, side = 'visual') => `scene:${E}:s${n}:${side}`
/** One Expression of four scenes, 10, 8, 12 and 6 s: on the ruler S1 0–10, S2 10–18, S3 18–30, S4 30–36. The owner's scene edit is recorded. */
const reading = (sent, answer = {ok: true}) => ({
  expressions: [{id: E, name: 'Cuts', scenes: [10, 8, 12, 6].map((duration, i) => ({id: `s${i + 1}`, name: `Scene ${i + 1}`, duration}))}],
  controls: {sceneEdit: {op: 'scene-edit', run: intent => { sent.push(intent); return answer }}},
})
const work = () => { const sent = []; return {sent, set: projectExpressionsWork(reading(sent))} }

test('#747 Move: a scene dropped with Insert goes before the scene that begins nearest its new start; Overwrite replaces the scene it lands on', () => {
  const {sent, set} = work(), move = set.actions.moveClip
  assert.match(move.op, /scene-edit · move/)
  move.run(C(4), 10, 'insert')
  move.run(C(1, 'audio'), 35, 'insert')
  assert.deepEqual(sent, [{operation: 'move', scene_ref: 's4', mode: 'insert', to_ref: 's2'}, {operation: 'move', scene_ref: 's1', mode: 'insert', to_ref: null}],
    'either side of a scene is the scene; nearest the end, it goes last')
  sent.length = 0
  assert.match(move.run(C(2), 11, 'insert').note, /Scene 2 stands where it was dropped/)
  assert.match(move.run(C(2), 17, 'insert').note, /stands where it was dropped/, 'before the scene after it is where it stands')
  assert.deepEqual(sent, [], 'a move to where it stands asks nothing of the owner')
  move.run(C(4), 12, 'overwrite')
  assert.deepEqual(sent, [{operation: 'move', scene_ref: 's4', mode: 'overwrite', to_ref: 's2'}])
  assert.match(move.run(C(4), 31, 'overwrite').error, /Drop the scene on the scene it replaces/)
  assert.match(move.run('scene:elsewhere', 3, 'insert').error, /no scene of this Expression/)
  assert.equal(sent.length, 1)
})

test('#747 Trim moves an edge to where it is dragged; Roll moves the seam on that edge, the seam before a scene being its neighbour\'s', () => {
  const {sent, set} = work()
  set.actions.trimClip.run(C(2), 'end', 21)
  set.actions.trimClip.run(C(3, 'audio'), 'start', 20)
  set.actions.rollClip.run(C(1), 'end', 12)
  set.actions.rollClip.run(C(2), 'start', 12)
  assert.deepEqual(sent, [
    {operation: 'trim', scene_ref: 's2', edge: 'end', seconds: 3}, {operation: 'trim', scene_ref: 's3', edge: 'start', seconds: 2},
    {operation: 'roll', scene_ref: 's1', seconds: 2}, {operation: 'roll', scene_ref: 's1', seconds: 2}])
  assert.match(set.actions.rollClip.run(C(1), 'start', 2).error, /no scene before this one/)
  assert.match(set.actions.trimClip.op, /scene-edit · trim/); assert.match(set.actions.rollClip.op, /scene-edit · roll/)
})

test('#747 Slip and Slide take the drag itself; Split cuts at a second of the scene where the insert marker stands inside it', () => {
  const {sent, set} = work()
  set.actions.slipClip.run(C(3), -3)
  set.actions.slideClip.run(C(2), 2.0000000001)
  set.actions.splitClip.run(C(3), 23)
  assert.deepEqual(sent, [{operation: 'slip', scene_ref: 's3', seconds: -3}, {operation: 'slide', scene_ref: 's2', seconds: 2},
    {operation: 'split', scene_ref: 's3', at: 5}], 'in the owner\'s seconds, to the millisecond')
  assert.match(set.actions.splitClip.run(C(3), 31).error, /Set the insert marker inside Scene 3/)
  assert.match(set.actions.splitClip.op, /scene-edit · split/)
})

test('#747 the ruler\'s drag rules: a body drag moves by the Move mode, an edge drag does what the Trim mode says; snap pulls to edges unless off', () => {
  assert.equal(cuts.partOf(2, 100), 'start'); assert.equal(cuts.partOf(97, 100), 'end'); assert.equal(cuts.partOf(50, 100), 'body')
  assert.equal(cuts.partOf(2, 14), 'body', 'a clip too narrow for two edges and a body is moved whole')
  assert.deepEqual(cuts.cutOf('body', 'overwrite', 'roll'), {act: 'move', mode: 'overwrite'})
  assert.deepEqual(cuts.cutOf('end', 'insert', 'trim'), {act: 'trim', edge: 'end'})
  assert.deepEqual(cuts.cutOf('start', 'insert', 'roll'), {act: 'roll', edge: 'start'})
  assert.deepEqual(cuts.cutOf('end', 'insert', 'slip'), {act: 'slip'})
  assert.deepEqual(cuts.cutOf('start', 'insert', 'slide'), {act: 'slide'})
  assert.equal(cuts.snapCut(10.3, [10, 18], 0.5, false), 10)
  assert.equal(cuts.snapCut(10.3, [10, 18], 0.5, true), 10.3, 'Alt held, or the snap Free: no pull')
  assert.equal(cuts.snapCut(11, [10], 0.5, false), 11, 'too far to pull')
  const {set} = work()
  assert.deepEqual(cuts.cutTargets(set, C(2), {marker: 23, loop: {start: 0, end: 36}, now: 4}).sort((a, b) => a - b), [0, 4, 10, 18, 23, 30, 36],
    'clip edges (the dragged clip\'s own left out), the insert marker, the loop\'s edges and the playhead')
  assert.deepEqual(cuts.MOVE_MODES.map(m => m.value), ['insert', 'overwrite'])
  assert.deepEqual(cuts.TRIM_MODES.map(m => m.value), ['trim', 'roll', 'slip', 'slide'])
})

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

test('#747 on the ruler a drag on a scene is the cut its modes say, one press through the owner; a press that does not move still selects', async () => {
  const {sent, set} = work()
  const {clip, pressed, selected} = viewOf(set)
  drag(clip(C(2)), [10, 18], 178, 208)
  assert.equal(pressed.length, 1, 'one press: one step')
  assert.match(pressed[0].what, /Trim Scene 2/)
  await pressed[0].run()
  assert.deepEqual(sent.at(-1), {operation: 'trim', scene_ref: 's2', edge: 'end', seconds: 3})
  clip(C(2)).props.onClick()
  assert.deepEqual(selected, [], 'the click a drag ends in selects nothing')
  drag(clip(C(4)), [30, 36], 330, 33)
  await pressed[1].run()
  assert.deepEqual(sent.at(-1), {operation: 'move', scene_ref: 's4', mode: 'insert', to_ref: 's1'}, 'its start snapped to the ruler\'s start')
  drag(clip(C(3)), [18, 30], 300, 300)
  assert.equal(pressed.length, 2, 'a press that does not move is no cut')
  clip(C(3)).props.onClick()
  assert.equal(selected.length, 1, 'and the click selects')
  const edge = viewOf(set, {cuts: {move: 'insert', onMove: noop, trim: 'roll', onTrim: noop, drag: {current: null}, onPreview: noop}})
  drag(edge.clip(C(1)), [0, 10], 98, 104.6, {altKey: true})
  await edge.pressed[0].run()
  assert.deepEqual(sent.at(-1), {operation: 'roll', scene_ref: 's1', seconds: 0.66}, 'Alt held: the seam is not pulled to the marker or an edge')
})

test('#747 Move mode and Trim mode stand on the ruler where the set carries its cuts, each the next on a press; a set with none shows neither', () => {
  const {set} = work()
  const moves = [], trims = []
  const {tree} = viewOf(set, {cuts: {move: 'insert', onMove: m => moves.push(m), trim: 'trim', onTrim: t => trims.push(t), drag: {current: null}, onPreview: noop}})
  const markup = renderToStaticMarkup(tree)
  assert.match(markup, /aria-label="Move mode: Insert"/); assert.match(markup, /aria-label="Trim mode: Trim"/)
  find(tree, el => el.props?.['aria-label'] === 'Move mode: Insert')[0].props.onClick()
  find(tree, el => el.props?.['aria-label'] === 'Trim mode: Trim')[0].props.onClick()
  assert.deepEqual([moves, trims], [['overwrite'], ['roll']])
  const bare = {...set, actions: undefined}
  assert.doesNotMatch(renderToStaticMarkup(viewOf(bare).tree), /Move mode|Trim mode/)
})

test('#747 Split (⌘E) stands on an Expressions scene where the insert marker is inside it, though the scene lies on the ruler by its row', () => {
  const {sent, set} = work()
  const target = {kind: 'clip', id: C(3), trackId: `expression:${E}:visual`, name: 'Scene 3'}
  const context = extra => ({view: 'arrangement', binding: null, press: (_key, _what, run) => run(), rename: noop, writeClip: async () => ({ok: true}), ...extra})
  const split = acts.objectMenu(target, set, context({marker: 23})).find(item => item.id === 'split')
  assert.equal(split.disabled, undefined, split.why)
  split.onSelect('split')
  assert.deepEqual(sent, [{operation: 'split', scene_ref: 's3', at: 5}])
  assert.match(acts.objectMenu(target, set, context({marker: 31})).find(item => item.id === 'split').why, /Set the insert marker inside Scene 3/)
})
