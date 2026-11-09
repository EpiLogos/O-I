// O-I #747 round 896, 0R-surface.5 (DLW build ruling 2026-11-09, on review 5): "Replace the regex pins with behavioural tests:
// trigger-offer-895:272-281, the panel's wiring … A text pin may stay beside a behavioural test, never in place of one." Those pins read
// panels/expressions.tsx as text: the offers built over the Info line and the two channels, the press channel set from the transport, the
// deleted work's close, the Delete's ask of the frame, the frame's words, and the follow of each reading. That wiring is one function now
// (components/nativeExpressionCommands.ts frameActs), the panel calls it, and it runs here, through every link the panel gives it.
// REAL: frameActs, the trigger offers over the Info line's own door (frame/devices/deviceHost.tsx), the press channel over the kernel bridge,
// the works door and its Delete as a track presses it (frame/tracks/modeTracks.ts expressionsControls, deleteWork), closeDeletedWork,
// frameDeleteHold. SCRIPTED: the frame the panel mounts (its reading, closeDeleted, holdForDelete, releaseDelete), the owner channel, and the
// Tauri core's invoke (the host). The panel's own call of frameActs stays pinned beside this in trigger-offer-895.test.mjs.
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
const [CMD, Door, Tracks, Bridge] = await Promise.all([
  import(src('components/nativeExpressionCommands.ts')),
  import(src('frame/devices/deviceHost.tsx')),
  import(src('frame/tracks/modeTracks.ts')),
  import('../../../../desktop/cradle/src/kernel/bridge.ts'),
])

const E = 'expression:dawn', SCENE = `${E}:scene:main`, TRIGGER = `${E}:trigger:stamp`
const RECORD = {expression_ref: E, offer_ref: 'offer:1', scene_ref: SCENE, trigger_ref: TRIGGER, action_ref: 'central.pages.stamp', target_ref: 'central:file:p.md',
  action_title: 'Stamp a page', target_name: 'p.md', reads_only: false, authority_requirement: []}
/** What the frame says with its offer: only the id is read. */
const FRAME_OFFER = {expression_ref: E, offer_ref: 'offer:1', words: 'Press Run: this only reads', action_ref: 'central.pages.erase'}
const SAID = 'Stamp a page on “\u2068p.md\u2069” (“\u2068central:file:p.md\u2069”) was not run: it may write, and a trigger runs only a reading. Run runs it once, as your own press.'
const DAWN = [{expression_ref: E, title: 'Dawn', revision: 3, open: true}]
const GONE = '“\u2068Dawn\u2069” left the works home for Central\'s trash: Central\'s file history brings it back.'

/** The panel's ports over a scripted frame, owner and host, wired as panels/expressions.tsx wires them; `end` is the panel's teardown. */
function wired({transport = {kind: 'tauri'}, unsaved = false} = {}) {
  const w = {said: [], owner: [], frame: [], invoked: [], engine: [], opened: [], fault: null, live: true, presented: {expression_ref: E, revision: 4},
    pendingOpen: {current: null}, selection: {current: {workspaceId: 'workspace:1', expected: undefined}}}
  globalThis.__TAURI_INTERNALS__ = {invoke: async (command, args) => {
    w.invoked.push([command, args.op.op, args.op.request?.operation])
    if (args.op.request?.operation === 'delete') return {result: 'expression', data: {state: 'deleted', expression_ref: E, title: 'Dawn'}}
    return {result: 'expression', data: {state: 'action_result', as_person: true, dispatch: {state: 'invoked'}}}
  }}
  const frame = {getState: () => ({nativeScene: w.presented}), closeDeleted: (ref, words) => w.frame.push(['closeDeleted', ref, words]),
    holdForDelete: async ref => {w.frame.push(['hold', ref]); return {ok: true, unsaved}}, releaseDelete: ref => w.frame.push(['release', ref])}
  w.acts = CMD.frameActs({live: () => w.live, frame: () => frame, say: words => w.said.push(words), show: Door.offerOnInfoLine, shown: Door.readInfoOffer,
    openFault: fault => {w.fault = typeof fault === 'function' ? fault(w.fault) : fault}, pendingOpen: w.pendingOpen, selection: w.selection,
    binding: () => ({workspaceId: 'workspace:1', id: 'binding:expressions', expressionRef: E}), surfaceEngine: (...call) => w.engine.push(call)})
  const owner = async request => {
    w.owner.push(request.operation)
    if (request.operation === 'trigger_offer') return {state: 'offer', offer: {...RECORD, trigger_revision: 'sha256:7f'}}
    if (request.operation === 'press' || request.press) throw Error('the owner channel carries no press')
    return {state: 'listed', works: DAWN}
  }
  w.acts.attach(owner, transport, {works: () => DAWN, publish: noop, open: ref => w.opened.push(ref), current: () => w.live})
  w.end = () => {w.acts.dispose(); delete globalThis.__TAURI_INTERNALS__}
  return w
}

test('the panel\'s wiring, run: the presented work\'s offer stands on the Info line in the shell\'s words, its Run goes by the press channel over the transport, and another work presented takes it away', async () => {
  const w = wired()
  try {
    await w.acts.say({request: 'say', text: 'Press Run: this only reads', offer: FRAME_OFFER})
    assert.deepEqual(w.said, [SAID], 'the shell\'s words on the line, never the frame\'s')
    assert.deepEqual(w.owner, ['trigger_offer'], 'the owner\'s record is read by the owner channel the panel attached')
    const info = Door.readInfoOffer()
    assert.equal(info?.words, SAID, 'the offer stands on the Info line\'s own door')
    assert.equal(await info.run(), 'Stamp a page ran, as your own press.')
    assert.deepEqual(w.invoked, [['kernel_press', 'expression', 'trigger']], 'Run goes by the host\'s press command, over the transport the panel attached')
    assert.deepEqual(w.owner, ['trigger_offer'], 'and never by the owner channel')
    // A plain word never replaces the shell's words beside a standing Run (1R-surface.3): it waits until the offer goes, and the newest
    // waits alone; another work presented takes the offer away, and the word is said then.
    await w.acts.say({request: 'say', text: 'Dawn enters', offer: FRAME_OFFER})
    const standing = w.said.length
    await w.acts.say({request: 'say', text: 'Scene 1 of 3'})
    await w.acts.say({request: 'say', text: 'Scene 2 of 3'})
    assert.equal(w.said.length, standing, 'nothing replaces the line while Run stands beside it')
    assert.equal(w.said.at(-1), SAID)
    assert.equal(Door.readInfoOffer()?.words, SAID)
    w.acts.follow({nativeScene: {expression_ref: 'expression:dusk', revision: 1}})
    assert.equal(Door.readInfoOffer(), null, 'the reading the frame announced presents another work: its offer goes')
    assert.deepEqual(w.said.slice(standing), ['Scene 2 of 3'], 'and the word waiting is said then, the newest alone')
    // An offer from a work the frame does not present is not said.
    w.presented = {expression_ref: 'expression:dusk', revision: 1}
    const before = w.said.length
    await w.acts.say({request: 'say', text: 'Dawn enters', offer: FRAME_OFFER})
    assert.equal(w.said.length, before)
    assert.equal(Door.readInfoOffer(), null)
  } finally { w.end() }
})

test('the press channel is the one the panel attached over its transport: a window with no press path refuses the Run in words, and asks no other channel', async () => {
  const w = wired({transport: {kind: 'bridge', url: 'http://127.0.0.1:9'}})
  try {
    await w.acts.say({request: 'say', text: 'Dawn enters', offer: FRAME_OFFER})
    assert.equal(await Door.readInfoOffer().run(), `Stamp a page did not run: ${Bridge.NO_PRESS_PATH}`)
    assert.deepEqual(w.invoked, [])
    assert.deepEqual(w.owner, ['trigger_offer'])
  } finally { w.end() }
})

test('the panel\'s works door, run from a track\'s Delete: the frame is asked afresh, the Delete goes by the press channel, and the deleted work is closed in the panel and in the frame', async () => {
  const w = wired()
  try {
    // An open of the work waits, its refusal stands with Retry, the selection expects it, and its offer stands.
    w.pendingOpen.current = E
    w.selection.current = {workspaceId: 'workspace:1', expected: E}
    w.acts.heard(E)({ok: false, error: 'The native owner did not answer.'})
    assert.equal(w.fault?.ref, E)
    await w.acts.say({request: 'say', text: 'Dawn enters', offer: FRAME_OFFER})
    assert.ok(Door.readInfoOffer())
    const works = Tracks.expressionsControls(undefined, {state: null, run: null}).works
    assert.ok(works, 'the track\'s acts stand on the door the panel attached')
    assert.deepEqual(await works.remove(E), {ok: true, note: GONE})
    assert.deepEqual(w.frame, [['hold', E], ['closeDeleted', E, GONE], ['release', E]], 'asked afresh at the press; let go of before its hold')
    assert.deepEqual(w.invoked, [['kernel_press', 'expression', 'delete']], 'the Delete goes by the press channel')
    assert.ok(!w.owner.includes('delete'), 'never by the owner channel')
    assert.equal(w.pendingOpen.current, null, 'the open waiting for it is dropped')
    assert.equal(w.fault, null, 'its Retry goes')
    assert.deepEqual(w.engine, [['workspace:1', 'binding:expressions', undefined]], 'the binding names it no more')
    assert.deepEqual(w.selection.current, {workspaceId: 'workspace:1', expected: undefined})
    assert.equal(Door.readInfoOffer(), null, 'its offer goes')
    // The frame's late answer to that open offers no Retry; an open asked again is heard.
    w.acts.heard(E)({ok: false, error: 'Expression not found'})
    assert.equal(w.fault, null)
    w.acts.opening(E)
    w.acts.heard(E)({ok: false, error: 'Expression not found'})
    assert.equal(w.fault?.ref, E)
  } finally { w.end() }
})

test('a Delete of a work the frame holds unsaved edits of is refused in words and asks the owner nothing; the panel gone, its door, channels and offer go', async () => {
  const w = wired({unsaved: true})
  try {
    const works = Tracks.expressionsControls(undefined, {state: null, run: null}).works
    assert.deepEqual(await works.remove(E), {ok: false, error: `“\u2068Dawn\u2069” holds changes in the field that are not saved. ${CMD.UNSAVED_DELETE}`})
    assert.deepEqual(w.frame, [['hold', E], ['release', E]])
    assert.deepEqual(w.invoked, [])
    await w.acts.say({request: 'say', text: 'Dawn enters', offer: FRAME_OFFER})
    assert.ok(Door.readInfoOffer())
    // The mount no longer stands: a deletion reaches nothing and an answer sets nothing.
    w.live = false
    CMD.worksPorts().ports.deleted(E, GONE)
    w.acts.heard(E)({ok: false, error: 'late'})
    assert.deepEqual(w.frame, [['hold', E], ['release', E]])
    assert.equal(w.fault, null)
  } finally { w.end() }
  assert.equal(CMD.expressionOwner(), null)
  assert.equal(CMD.expressionPress(), null)
  assert.equal(CMD.worksPorts(), null)
  assert.equal(Door.readInfoOffer(), null)
})
