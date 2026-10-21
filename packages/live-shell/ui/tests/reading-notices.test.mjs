
import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {register} from 'node:module'

// Reads that remember, second pass: engine views that polled an owner on a period re-read on the kernel's notice where the window
// carries one, and keep the period where it does not (the legacy frame installs no notice source). The read-before-write sites of
// the Central device writes ask the kernel afresh, because a write's basis is the owner's present revision.
// Channel: scripted (stubbed timers and a stubbed read holder); the engine views' wiring is pinned on source (they need a DOM).
const compiler = new URL('../node_modules/typescript/lib/typescript.js', import.meta.url).href
register(`data:text/javascript,${encodeURIComponent(`
import ts from ${JSON.stringify(compiler)};
import {readFile} from 'node:fs/promises';
export async function resolve(s, c, n) {
  try { return await n(s, c) } catch (e) {
    if (!s.startsWith('.')) throw e;
    if (s.endsWith('.js')) { try { return await n(s.slice(0, -3) + '.ts', c) } catch {} }
    for (const x of ['.ts', '.tsx']) { try { return await n(s + x, c) } catch {} }
    throw e;
  }
}
export async function load(u, c, n) {
  if (u.endsWith('.css')) return {format: 'module', shortCircuit: true, source: 'export {}'};
  if (/[.]html([?].*)?$/.test(u)) return {format: 'module', shortCircuit: true, source: 'export default ""'};
  if (!u.endsWith('.ts') && !u.endsWith('.tsx')) return n(u, c);
  return {format: 'module', shortCircuit: true, source: ts.transpileModule(await readFile(new URL(u), 'utf8'), {fileName: new URL(u).pathname,
    compilerOptions: {target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.ReactJSX}}).outputText};
}`)}`, import.meta.url)

const bridge = await import('../../../../desktop/cradle/src/kernel/bridge.ts')
const {createReadingsChangedDriver} = await import('../src/owners/readingsChanged.ts')
const writes = await import('../src/central/devices/centralDeviceWrites.ts')
const {readWorlds} = await import('../src/central/centralWorlds.ts')
const src = path => readFile(new URL(path, import.meta.url), 'utf8')

const stubInterval = () => {
  const real = {set: globalThis.setInterval, clear: globalThis.clearInterval}
  const made = []
  globalThis.setInterval = (run, ms) => { made.push({run, ms, cleared: false}); return made.length - 1 }
  globalThis.clearInterval = handle => { if (made[handle]) made[handle].cleared = true }
  return {made, restore() { globalThis.setInterval = real.set; globalThis.clearInterval = real.clear }}
}
const manualTimers = () => {
  const pending = []
  return {pending, set: run => { pending.push(run); return pending.length - 1 }, clear: handle => { pending[handle] = null }}
}

test('with a notice source installed, one notice is one re-read and no timer is made', () => {
  const timers = stubInterval()
  const withdraw = bridge.installReadingsNoticeSource()
  try {
    let reads = 0
    const stop = bridge.refreshOnReadingsMoved(() => { reads++ }, 90_000)
    assert.equal(timers.made.length, 0, 'no period is set where the notice arrives')
    bridge.announceReadingsMoved()
    assert.equal(reads, 1, 'one notice, one re-read')
    stop()
    bridge.announceReadingsMoved()
    assert.equal(reads, 1, 'a stopped view hears nothing')
  } finally { withdraw(); timers.restore() }
})

test('the windows driver announces once per debounced notice and once per completed write', () => {
  const withdraw = bridge.installReadingsNoticeSource()
  const timers = manualTimers()
  const registry = {moved: async () => {}}
  const driver = createReadingsChangedDriver(registry, 250, timers)
  let reads = 0
  const off = bridge.onReadingsMoved(() => { reads++ })
  try {
    const receipt = seq => ({seq, schema: 'oi.kernel-event/v1', version: 1, event: 'readings_changed', scopes: ['root'], epoch: seq})
    driver.receive([receipt(1)]); driver.receive([receipt(2)]); driver.receive([{seq: 3, schema: 'oi.kernel-event/v1', version: 1, event: 'focus_changed'}])
    assert.equal(reads, 0, 'announced after the debounce, not on arrival')
    for (const run of timers.pending) run?.()
    assert.equal(reads, 1, 'a burst of notices is one announcement')
    driver.now()
    assert.equal(reads, 2, 'a completed write announces at once')
  } finally { off(); withdraw() }
})

test('without a notice source the old period stands, and is cleared on stop', () => {
  const timers = stubInterval()
  try {
    assert.equal(bridge.hasReadingsNoticeSource(), false)
    let reads = 0
    const stop = bridge.refreshOnReadingsMoved(() => { reads++ }, 90_000)
    assert.deepEqual(timers.made.map(timer => timer.ms), [90_000])
    bridge.announceReadingsMoved()
    assert.equal(reads, 0, 'a notice nobody promised does not stand in for the period')
    timers.made[0].run()
    assert.equal(reads, 1)
    stop()
    assert.equal(timers.made[0].cleared, true)
  } finally { timers.restore() }
})

test('a withdrawn source returns views to their period', () => {
  const timers = stubInterval()
  try {
    const withdraw = bridge.installReadingsNoticeSource()
    withdraw(); withdraw()
    assert.equal(bridge.hasReadingsNoticeSource(), false, 'withdrawing twice withdraws once')
    bridge.refreshOnReadingsMoved(() => {}, 60_000)
    assert.equal(timers.made.length, 1)
  } finally { timers.restore() }
})

test('the owner-polling timers of the engine views go through the seam; the kept ones poll the view, not an owner', async () => {
  const session = await src('../../../../desktop/cradle/src/encounter/session.ts')
  assert.match(session, /hasReadingsNoticeSource\(\)/, 'the encounter at rest consults the notice source')
  assert.match(session, /const resting=!inFlight&&this\.quietReads>=2&&hasReadingsNoticeSource\(\);/)
  assert.match(session, /if\(chain===this\.chain&&!resting\)this\.timer=setTimeout\(/, 'no rest timer where a notice arrives')
  assert.match(session, /onReadingsMoved\(\(\)=>\{if\(this\.observing&&this\.restingOnNotice&&!hidden\(\)\)this\.restartChain\(\);\}\)/, 'a notice wakes a resting session once')
  const chat = await src('../../../../desktop/cradle/src/workspace/left/ChatRows.tsx')
  assert.match(chat, /refreshOnReadingsMoved\(again, 90_000\)/)
  assert.doesNotMatch(chat, /setInterval/)
  const material = await src('../../../../desktop/cradle/src/material/MaterialSurface.tsx')
  assert.match(material, /refreshOnReadingsMoved\(focus, 60_000\)/, 'the waiting-returns count is an owner read')
  // The 2.5 s observers read the document frame's own island (a local draft checkpoint); Expression's 10 s refresh places a DOM
  // anchor; the field's 1.5 s pull reads the kernel's in-memory selection and portals, which the file watch does not announce.
  for (const [path, period] of [['material/MaterialSurface.tsx', 'setInterval(observe,2500)'], ['document/SourceDocumentHost.tsx', 'setInterval(poll, 2000)'],
    ['receiving/DayDieFace.tsx', 'setInterval(()=>localObserver.current(),2500)'], ['shared/Expression.tsx', 'window.setInterval(refresh,10000)'], ['field/FieldSurface.tsx', 'window.setInterval(pull, 1500)']]) {
    assert.ok((await src(`../../../../desktop/cradle/src/${path}`)).includes(period), `${path} keeps ${period}`)
  }
})

// ---- the read-before-write sites ask afresh ----------------------------------------------------------------------------------

const withHolder = async run => {
  const asked = []
  bridge.installKernelReadHolder(async (transport, op, fresh) => { asked.push({op: op.op, kind: op.request?.kind, fresh}); return {outcome: null, error: 'stubbed'} })
  try { await run(asked) } finally { bridge.installKernelReadHolder(null) }
  return asked
}
const transport = {kind: 'bridge', url: 'http://127.0.0.1:1'}

test('openToday and closeDay read Central\'s ground afresh before they decide', async () => {
  for (const act of [writes.openToday, writes.closeDay]) {
    const asked = await withHolder(() => act(transport).then(() => assert.fail('the stubbed kernel refused'), () => {}))
    assert.ok(asked.length >= 1)
    assert.equal(asked[0].op, 'central')
    assert.equal(asked[0].fresh, true, 'the basis of a write is the owner\'s present revision')
  }
})

test('readWorlds asks afresh on the first browse when told to, and not otherwise', async () => {
  const plain = await withHolder(() => readWorlds(transport, {tries: 1, apartMs: 0}))
  assert.deepEqual(plain.map(row => row.fresh), [false])
  const fresh = await withHolder(() => readWorlds(transport, {tries: 1, apartMs: 0}, true))
  assert.deepEqual(fresh.map(row => row.fresh), [true])
})

test('every read in the Central device writes that precedes a write is fresh', async () => {
  const text = await src('../src/central/devices/centralDeviceWrites.ts')
  assert.doesNotMatch(text, /readGround\(transport, null\)/, 'no ground read there is held')
  // W2: Open tomorrow (central.day.rollover) and Close now's carry (central.day.close-carry) read the ground fresh before they write, too.
  assert.equal((text.match(/readGround\(transport, null, true\)/g) ?? []).length, 6)
  assert.match(text, /readFile\(transport, formLocation, true\)/)
  assert.match(text, /readWorlds\(transport, undefined, true\)/)
})
