// O-I #747 round 893 (the OPEN list): a rename in Clip view was not on the shell's undo list (manual §10.9 Undo and Redo: "every change
// an owner takes through an object act, with the change that takes it back"; §16.6 "Every edit is one labelled step in the undo list").
// Now the Clip panel's rename is listed as the grid's Rename is ("Rename First"), and its way back is the frame's own labelled step, as a
// cut's is (round 893): Undo runs only while the rename's step is on top of the frame's history, asked of the composition presented now.
// Channels: SCRIPTED — the Clip panel's wiring over a fake reading and editor door, and a fake presented composition whose reading names
// the frame's history tops (each owner call recorded).
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
const noop = () => {}
globalThis.document ??= {getElementById: () => null, createElement: () => ({style: {}, setAttribute: noop, appendChild: noop}), head: {appendChild: noop},
  addEventListener: noop, removeEventListener: noop, querySelector: () => null, documentElement: {style: {}}}
globalThis.window ??= globalThis
globalThis.addEventListener ??= noop; globalThis.removeEventListener ??= noop
const src = path => new URL(`../src/${path}`, import.meta.url).href
const [SC, TRACKS, UNDO] = await Promise.all([
  import(src('components/expressions/clip/clipBinding.ts')),
  import(src('frame/tracks/modeTracks.ts')),
  import(src('frame/menu/undo.ts')),
])

const E = 'expression:dawn', SCENE = `${E}:scene:1`
/** The frame: its own history (each step with its id), the revision its owner's reading stands at, and the scene's title. */
function frame() {
  const f = {calls: [], revision: 5, done: [], undone: [], next: 1, title: 'First'}
  f.read = () => ({basis: {expression_ref: E, revision: f.revision, scene_ref: SCENE}, scene: {id: 's1', name: f.title, entities: []},
    scenes: {scenes: [{scene_ref: SCENE, title: f.title}]}, playback: {intent_epoch: 1}, nativeSelection: {scene_ref: SCENE, entity_ref: null},
    selection: {entity_ids: [], step_id: null},
    history: {canUndo: f.done.length > 0, canRedo: f.undone.length > 0, ...(f.done.length ? {undo: f.done.at(-1)} : {}), ...(f.undone.length ? {redo: f.undone.at(-1)} : {})}})
  f.reading = f.read()
  f.local = label => { f.done.push({label, step: `h.${f.next++}`}); f.undone = []; f.reading = f.read() }
  /** The retained editor's door, as the Clip panel writes through it: a rename is one labelled step of the frame's, committed. */
  f.request = async sent => {
    f.calls.push([sent.operation, sent.intent?.operation])
    if (sent.operation !== 'scene-edit' || sent.intent.operation !== 'rename') return {ok: false, error: 'not this test\'s'}
    const was = f.title
    f.title = sent.intent.title; f.done.push({label: `Rename ${was}`, step: `h.${f.next++}`, was, now: f.title}); f.undone = []; f.revision++; f.reading = f.read()
    return {ok: true, reading: f.reading}
  }
  return f
}
/** The presented composition the shell's undo asks: the frame's own Undo and Redo, each on the basis it stands at. */
function composition(f) {
  const move = (from, to, title) => { const step = from.pop(); to.push(step); f.title = step[title]; f.revision++; f.reading = f.read(); return {ok: true, reading: f.reading} }
  const actions = {
    history: async (operation, at) => { f.calls.push([operation, at?.revision ?? 'no basis']); return operation === 'undo' ? move(f.done, f.undone, 'was') : move(f.undone, f.done, 'now') },
    scene: async () => ({ok: true, reading: f.reading}),
  }
  return {owner: 'expressions', content: {}, actions, isPresented: () => true, currentReading: () => f.reading}
}

test('a rename in Clip view is one labelled step on the shell\'s undo list, and Undo and Redo take it back and make it again', async () => {
  UNDO.clearUndo()
  const f = frame()
  TRACKS.expressionsControls(composition(f), {})
  const wiring = SC.expressionsWiring(f.reading, f.request)
  await wiring.acts.name('Dusk')
  assert.equal(f.title, 'Dusk')
  assert.deepEqual(UNDO.undoState(), {undo: 'Rename First', redo: null}, 'listed as the grid\'s Rename is')
  const said = []
  await UNDO.undoStep((label, words) => said.push([label, words]))
  assert.deepEqual(said, [])
  assert.equal(f.title, 'First', 'taken back by the frame\'s own step')
  assert.deepEqual(f.calls.at(-1), ['undo', 6], 'on the basis the rename left')
  await UNDO.redoStep((label, words) => said.push([label, words]))
  assert.deepEqual([said, f.title], [[], 'Dusk'], 'made again')
  UNDO.clearUndo()
})

test('a frame-local edit after the rename is never taken back in its name: Undo refuses in words and leaves both', async () => {
  UNDO.clearUndo()
  const f = frame()
  TRACKS.expressionsControls(composition(f), {})
  await SC.expressionsWiring(f.reading, f.request).acts.name('Dusk')
  f.local('Move Wave')
  const said = [], calls = f.calls.length
  await UNDO.undoStep((label, words) => said.push([label, words]))
  assert.equal(said.length, 1)
  assert.equal(said[0][0], 'Rename First')
  assert.match(said[0][1], /the last change in this Expression is "Move Wave"\. Nothing was changed\./)
  assert.equal(f.calls.length, calls, 'no owner was asked')
  assert.deepEqual([f.title, f.done.map(step => step.label)], ['Dusk', ['Rename First', 'Move Wave']], 'the edit and the rename both stand')
  UNDO.clearUndo()
})
