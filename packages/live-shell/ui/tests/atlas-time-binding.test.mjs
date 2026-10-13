import test from 'node:test'
import assert from 'node:assert/strict'
import {register} from 'node:module'
import {readFile} from 'node:fs/promises'

// The Earth's deep-time clock bound to the shell's shared time window (T-ATLAS-TIME; DEVICE-SEMANTICS-LOCK §0.1.3, §7).
// Production modules in memory (the atlas-face-bodies.test.mjs loader). The session is the cradle's own DisclosureSession
// store, the one the native owner writes; the window is read and written through it, exactly as in the app.
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

const {createDisclosureSessionStore} = await import('../../../../desktop/cradle/src/techne/session.ts')
const {groundSelection} = await import('../../../../desktop/cradle/src/techne/m0m5/reading.ts')
const {provingReading} = await import('../../../../desktop/cradle/src/techne/m0m5/journey/proving-reading.ts')
const {parseTimestamp, yearStartMs} = await import('../../../../desktop/cradle/src/techne/m0m5/timeline/scale.ts')
const {windowInstant} = await import('../../../../desktop/cradle/expressions-app/vendor/research-canvas/packages/canvas/src/psychogeographic/terminator.ts')
const {writeSharedWindowCompareAndSet} = await import('@epilogos/expressions-boundary/time-window')
const {TimeModel} = await import('../src/projections/atlas/src/state/timeModel.ts')
const {createTimeScale} = await import('../src/projections/atlas/src/data/time.ts')
const {bindSharedTimeClock, instantOfYear, windowYear} = await import('../src/projections/atlas/sharedClock.ts')
const actions = await import('../src/inhabitants/atlasFaceActions.ts')
const {publishAtlasHandle} = await import('../src/projections/atlas/AtlasProjectionPanel.tsx')
const bridge = await import('../src/agent/shellSetterBridge.ts')
const {shellSetter} = await import('../src/inhabitants/sdk/shellSetters.ts')
const {atlasFamilyManifest} = await import('../src/projections/atlas/atlasFamilyManifest.ts')

const SCALE = createTimeScale(-1000, 1960)
const ctl = {onUserTime() { ctl.userTimes += 1 }, userTimes: 0, globeScope: {scope: null}}

/** A standing shared session on the proving reading, with the given window (or none). */
function sharedSession(window) {
  const store = createDisclosureSessionStore()
  store.setSelection(groundSelection(provingReading(), 'timeline'))
  if (window !== undefined) store.setTimeWindow(window)
  return store
}

/** The Earth's clock bound to a store, with a count of every write the store announces after the bind. */
function bound(store = sharedSession()) {
  const time = new TimeModel()
  const binding = bindSharedTimeClock({store, time, scale: SCALE})
  const writes = {count: 0}
  store.subscribe(() => { writes.count += 1 })
  return {store, time, binding, writes}
}

const yearU = year => SCALE.toU(year)
const windowOf = store => store.get().time_window ?? null

test('an instant is read only through the time authority, deep years included', async () => {
  for (const year of [-780000, -10000, -9999, -1000, -500, 0, 1, 1620, 1931, 1960, 9999, 10000, 4500000000]) {
    assert.equal(windowYear({from: null, to: instantOfYear(year)}), year, `year ${year} round-trips through the window`)
    assert.equal(parseTimestamp(instantOfYear(year)), yearStartMs(year), `year ${year} is the authority's year start`)
  }
  assert.equal(instantOfYear(-500), '-000500-01-01T00:00:00Z')
  assert.equal(instantOfYear(1931), '1931-01-01T00:00:00Z')
  assert.equal(instantOfYear(-780000), '-780000')
  const source = await readFile(new URL('../src/projections/atlas/sharedClock.ts', import.meta.url), 'utf8')
  assert.equal(/Date\.parse/.test(source), false, 'the binding never calls Date.parse')
})

test('the window the Earth writes stands at the same instant the day/night layer reads for it', () => {
  const window = {from: null, to: instantOfYear(1800)}
  assert.equal(windowInstant(window), instantOfYear(1800).replace('-01-01T00:00:00Z', '-01-01T00:00:00.000Z'))
  assert.equal(windowYear(window), 1800)
  // A bounded window: the day/night layer's midpoint and the Earth's cursor are the same year.
  const span = {from: instantOfYear(1700), to: instantOfYear(1900)}
  assert.equal(windowYear(span), 1800)
  assert.equal(windowYear(null), null, 'no window in force is all time')
})

test('a window set elsewhere moves the Earth cursor, and the clock never writes it back', () => {
  const {store, time, writes} = bound()
  store.setTimeWindow({from: null, to: instantOfYear(1700)})
  assert.equal(writes.count, 1, 'the one write is the outside set itself')
  assert.equal(time.mode, 'cursor')
  assert.equal(time.cursorU, yearU(1700), 'the cursor stands at the window’s year, exactly')
  assert.deepEqual(windowOf(store), {from: null, to: instantOfYear(1700)})
  store.setTimeWindow(null)
  assert.equal(time.mode, 'all', 'an outside window in force of none is all time')
})

test('a window already standing at bind takes the clock’s place, and the bind itself writes nothing', () => {
  const store = sharedSession({from: '1500-01-01T00:00:00Z', to: null})
  const writes = {count: 0}
  store.subscribe(() => { writes.count += 1 })
  const time = new TimeModel()
  bindSharedTimeClock({store, time, scale: SCALE})
  assert.equal(writes.count, 0)
  assert.equal(time.mode, 'cursor')
  assert.equal(time.cursorU, yearU(1500))
})

test('a scrub on the Earth writes the window once, and the window’s echo never re-scrubs the clock', () => {
  const {store, time, writes} = bound()
  // The window's echo of the clock's own write must never reach the clock as an outside move.
  const followed = {count: 0}
  const follow = time.follow.bind(time)
  time.follow = u => { followed.count += 1; follow(u) }
  // 0.00005 of the scale is about a tenth of a year here, so the scrub stands in the year 1800 it rounds to.
  const u = yearU(1800) + 0.00005
  assert.equal(time.scrub(u), null)
  assert.equal(followed.count, 0, 'the echo of the clock’s own write is not an outside move')
  assert.equal(writes.count, 1, 'one scrub, one write')
  assert.deepEqual(windowOf(store), {from: null, to: instantOfYear(1800)})
  assert.equal(time.cursorU, u, 'the echo does not snap the continuous cursor to the written year')
  assert.equal(time.scrub(yearU(1800) + 0.0001), null, 'a scrub inside the same whole year')
  assert.equal(writes.count, 1, 'a scrub that keeps the year writes nothing')
  time.scrub(yearU(1801))
  assert.equal(writes.count, 2)
  assert.equal(windowYear(windowOf(store)), 1801)
})

test('the pane route, the face body and shell.setAtlasCursor each write the window once', async () => {
  const {store, time, writes} = bound()
  actions.scrubClock(ctl, time, yearU(1500))
  assert.equal(writes.count, 1, 'the face body’s scrub writes once')
  assert.equal(windowYear(windowOf(store)), 1500)
  assert.equal(ctl.userTimes > 0, true, 'the controller is told of the user’s time move')

  publishAtlasHandle({ctl, engine: {}, time, model: {scale: SCALE}})
  bridge.registerAtlasShellSetters()
  const receipt = await shellSetter('shell.setAtlasCursor')(yearU(1600))
  assert.equal(receipt.kind, 'fired')
  assert.equal(writes.count, 2, 'shell.setAtlasCursor writes the window once')
  assert.equal(windowYear(windowOf(store)), 1600)
  publishAtlasHandle(null)
})

test('a refusal by the window is named and the cursor stands where the window stands', () => {
  const store = sharedSession({from: null, to: instantOfYear(1500)})
  // The store is read through a seam so the test can change what it holds without an announcement, the drift a
  // refusal guards against: the Earth was shown 1500, the store now holds 1550.
  let drift = null
  const seam = {get: () => drift ?? store.get(), subscribe: listener => store.subscribe(listener),
    setTimeWindow: window => store.setTimeWindow(window)}
  const time = new TimeModel()
  const binding = bindSharedTimeClock({store: seam, time, scale: SCALE})
  assert.equal(time.cursorU, yearU(1500))
  drift = {...store.get(), time_window: {from: null, to: instantOfYear(1550)}}
  const refusal = binding.commit(yearU(1800))
  assert.match(refusal, /refused the move .*changed; read it before setting time/)
  assert.equal(windowYear(windowOf(store)), 1500, 'the write was refused, so the store’s window is not written')
  assert.equal(time.cursorU, yearU(1550), 'the clock now stands where the window stands')
  binding.dispose()
})

test('the compare-and-set writer refuses a stale capture by name and writes nothing', () => {
  const store = sharedSession({from: null, to: instantOfYear(1500)})
  const session = store.get()
  const current = {session_ref: session.session_ref, selection: session.selection, window: {from: null, to: instantOfYear(1500)}}
  assert.throws(() => writeSharedWindowCompareAndSet(store, {...current, window: {from: null, to: instantOfYear(1400)}}, null),
    /changed; read it before setting time/)
  assert.deepEqual(windowOf(store), {from: null, to: instantOfYear(1500)})
  assert.throws(() => writeSharedWindowCompareAndSet(store, {...current, session_ref: 'techne:disclosure-session:other'}, null),
    /changed; read it before setting time/)
  writeSharedWindowCompareAndSet(store, current, {from: null, to: instantOfYear(1600)})
  assert.equal(windowYear(windowOf(store)), 1600)
  assert.throws(() => writeSharedWindowCompareAndSet(createDisclosureSessionStore(), current, null), /nowhere to be written/)
})

test('all time is the resting state, written as no window, and it is written once', () => {
  const {store, time, writes} = bound()
  time.scrub(yearU(1700))
  assert.equal(writes.count, 1)
  assert.equal(time.setAll(), null)
  assert.equal(time.mode, 'all')
  assert.equal(windowOf(store), null)
  assert.equal(writes.count, 2)
  assert.equal(time.setAll(), null)
  assert.equal(writes.count, 2, 'all time already standing writes nothing')
  assert.equal(actions.allTime(ctl, time), null)
  assert.equal(time.mode, 'all')
})

test('play advances the window through the clock, at most one write per frame, and an outside move stops it', () => {
  const {store, time, writes} = bound()
  assert.equal(time.play(), null)
  assert.equal(time.playing, true)
  const startWrites = writes.count
  let frames = 0
  let before = writes.count
  for (let i = 0; i < 180; i += 1) {
    time.update(1 / 60)
    frames += 1
    assert.ok(writes.count - before <= 1, 'at most one window write per frame')
    before = writes.count
  }
  assert.ok(writes.count > startWrites, 'play moves the shared window')
  assert.ok(writes.count - startWrites <= frames, 'play never writes more than once per frame')
  assert.equal(time.playing, true)
  store.setTimeWindow({from: null, to: instantOfYear(1200)})
  assert.equal(time.playing, false, 'an outside move takes the cursor, so play stops')
  assert.equal(time.cursorU, yearU(1200))
})

test('play and pause through the face action keep working', () => {
  const {time} = bound()
  assert.equal(actions.playOrPause(ctl, time), null)
  assert.equal(time.playing, true)
  assert.equal(actions.playOrPause(ctl, time), null)
  assert.equal(time.playing, false)
})

test('with no shared session standing the clock keeps its own presentation, and binds once one stands', () => {
  const store = createDisclosureSessionStore()
  const time = new TimeModel()
  const binding = bindSharedTimeClock({store, time, scale: SCALE})
  assert.equal(time.scrub(0.5), null, 'an unbound scrub moves the clock as before')
  assert.equal(time.cursorU, 0.5)
  store.setSelection(groundSelection(provingReading(), 'timeline'), {})
  store.setTimeWindow({from: null, to: instantOfYear(1400)})
  assert.equal(time.cursorU, yearU(1400), 'a session that stands with a window binds the clock to it')
  binding.dispose()
  assert.equal(time.link, null, 'a disposed binding releases the clock')
})

test('the Places day/night layer and the Earth read the window through one authority', () => {
  const window = {from: instantOfYear(1700), to: instantOfYear(1900)}
  const dayNight = windowInstant(window)
  assert.equal(parseTimestamp(dayNight) >= parseTimestamp(window.from) && parseTimestamp(dayNight) <= parseTimestamp(window.to), true)
  assert.equal(windowYear(window), 1800)
})

test('the atlas family declares its occasion consumption, restored with the binding', () => {
  assert.deepEqual(atlasFamilyManifest.time.consumes, ['occasion'])
})
