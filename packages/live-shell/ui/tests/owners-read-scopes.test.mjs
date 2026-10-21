import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {register} from 'node:module'

// A held answer keeps the `read_scopes` the kernel gave it, and a `readings_changed` notice asks again only the held answers its
// scopes touch: `all` on either side touches everything, an empty list is never touched, a missing list is unscoped and always
// asked. A write's own retire (no scopes) retires everything. Kernel outcomes are faked.
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

const {createOwnerReadings, scoped, unionScopes} = await import('../src/owners/ownerReading.ts')
const {createReadingsChangedDriver} = await import('../src/owners/readingsChanged.ts')
const {readOp} = await import('../src/owners/ownerCall.ts')
const {announceReadingsMoved, onReadingsMoved} = await import('../../../../desktop/cradle/src/kernel/bridge.ts')

const settle = async () => { for (let i = 0; i < 6; i++) await new Promise(resolve => setImmediate(resolve)) }
const notice = (seq, scopes) => ({seq, schema: 'oi.kernel-event/v1', version: 1, event: 'readings_changed', scopes, epoch: seq})
const manualTimers = () => {
  const queue = []
  return {set: run => { queue.push(run); return run }, clear: handle => { const i = queue.indexOf(handle); if (i >= 0) queue.splice(i, 1) }, fire: () => queue.splice(0).forEach(run => run())}
}

async function held(registry, key, scopes) {
  let reads = 0
  const entry = registry.entry(key, async () => ({value: ++reads, ...(scopes === undefined ? {} : {read_scopes: scopes})}))
  entry.subscribe(() => {})
  await entry.ensure('1|central')
  return {entry, reads: () => reads}
}

test('a notice re-asks only the held answers whose scopes it touches', async () => {
  const registry = createOwnerReadings(() => 1_000)
  const face = await held(registry, 'face', ['root', 'project:face-rig'])
  const oi = await held(registry, 'oi', ['root', 'project:O-I'])
  const seats = await held(registry, 'seats', ['seats'])
  const timers = manualTimers()
  const driver = createReadingsChangedDriver(registry, 250, timers)
  driver.receive([notice(1, ['project:face-rig'])]); timers.fire(); await settle()
  assert.equal(face.reads(), 2)
  assert.equal(oi.reads(), 1)
  assert.equal(seats.reads(), 1)
  driver.receive([notice(2, ['root'])]); timers.fire(); await settle()
  assert.equal(face.reads(), 3); assert.equal(oi.reads(), 2); assert.equal(seats.reads(), 1)
})

test('scopes of notices in one burst are joined', async () => {
  const registry = createOwnerReadings(() => 1_000)
  const face = await held(registry, 'face', ['project:face-rig'])
  const oi = await held(registry, 'oi', ['project:O-I'])
  const seats = await held(registry, 'seats', ['seats'])
  const timers = manualTimers()
  const driver = createReadingsChangedDriver(registry, 250, timers)
  driver.receive([notice(1, ['project:face-rig'])]); driver.receive([notice(2, ['project:O-I'])]); timers.fire(); await settle()
  assert.deepEqual([face.reads(), oi.reads(), seats.reads()], [2, 2, 1])
})

test('all, on either side, touches everything', async () => {
  const registry = createOwnerReadings(() => 1_000)
  const a = await held(registry, 'a', ['project:face-rig'])
  const b = await held(registry, 'b', ['all'])
  const c = await held(registry, 'c', [])
  const timers = manualTimers()
  const driver = createReadingsChangedDriver(registry, 250, timers)
  driver.receive([notice(1, ['all'])]); timers.fire(); await settle()
  assert.deepEqual([a.reads(), b.reads(), c.reads()], [2, 2, 1])
  driver.receive([notice(2, ['aikit'])]); timers.fire(); await settle()
  assert.deepEqual([a.reads(), b.reads(), c.reads()], [2, 3, 1])
})

test('an answer with no read_scopes is asked again on any notice; an empty list never is', async () => {
  const registry = createOwnerReadings(() => 1_000)
  const unscoped = await held(registry, 'unscoped', undefined)
  const memory = await held(registry, 'memory', [])
  const timers = manualTimers()
  const driver = createReadingsChangedDriver(registry, 250, timers)
  driver.receive([notice(1, ['clock'])]); timers.fire(); await settle()
  driver.receive([notice(2, ['project:O-I'])]); timers.fire(); await settle()
  assert.equal(unscoped.reads(), 3)
  assert.equal(memory.reads(), 1)
})

test('a write\'s own retire (now) is unscoped and asks every held answer', async () => {
  const registry = createOwnerReadings(() => 1_000)
  const memory = await held(registry, 'memory', [])
  const oi = await held(registry, 'oi', ['project:O-I'])
  const driver = createReadingsChangedDriver(registry, 250, manualTimers())
  driver.now(); await settle()
  assert.deepEqual([memory.reads(), oi.reads()], [2, 2])
})

test('an answer not touched stays unretired: a later reader draws it without a carry', async () => {
  const registry = createOwnerReadings(() => 1_000)
  const oi = await held(registry, 'oi', ['project:O-I'])
  await registry.moved(['project:face-rig'])
  await oi.entry.ensure('1|central')
  assert.equal(oi.reads(), 1)
  await registry.moved(['project:O-I']); await settle()
  assert.equal(oi.reads(), 2)
})

test('a read of one op carries the outcome\'s read_scopes; a composite carries the union, or none when any op had none', async () => {
  const fetched = globalThis.fetch
  const outcomes = {a: {result: 'x', read_scopes: ['root']}, b: {result: 'x', read_scopes: ['project:O-I', 'root']}, c: {result: 'x'}}
  globalThis.fetch = async (_url, init) => {
    const op = JSON.parse(init.body)
    return {json: async () => ({ok: true, outcome: outcomes[op.op]})}
  }
  try {
    const one = await readOp({kind: 'bridge', url: 'http://x'}, {op: 'a'}, 'x')()
    assert.deepEqual(one.read_scopes, ['root'])
  } finally { globalThis.fetch = fetched }
  assert.deepEqual([...unionScopes(['root'], ['project:O-I', 'root']).sort()], ['project:O-I', 'root'])
  assert.equal(unionScopes(['root'], undefined), undefined)
  assert.deepEqual(unionScopes([], []), [])
  assert.deepEqual(unionScopes(['root'], ['all']), ['all'])
  const composite = scoped('v', unionScopes(['root'], ['seats']))
  assert.deepEqual(composite.read_scopes.sort(), ['root', 'seats'])
})

test('engine listeners hear every notice, with the scopes for those that can use them', () => {
  const heard = []
  const off = onReadingsMoved(scopes => heard.push(scopes))
  announceReadingsMoved(['root']); announceReadingsMoved()
  off()
  assert.deepEqual(heard, [['root'], undefined])
})
