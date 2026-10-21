import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {register} from 'node:module'

// Lane W3: the kernel tells the shell when an owner write it carried moved the owner's state. A NOW write, a Day write, a
// receiving act or a Factory Run act that finished records a receipt (kernel/src/owner_write.rs; events.rs `NowChanged`,
// `DayChanged`, `ReceivingChanged`, `FactoryRunChanged`), and the shell's readers of those owners read again on it — with no
// floor involved. The NOW receipt here is the kernel's own serialisation: the kernel test
// owner_write::tests::a_now_write_records_its_receipt_and_retires_the_temporal_answer asserts it equals this fixture.
// Channel: scripted (the poll and the Day observer driven over stubbed reads); the hooks' wiring in the live window is
// UNVERIFIED on screen.
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

const {createOwnerReadings} = await import('../src/owners/ownerReading.ts')
const {readingsChangedOf, createReadingsChangedDriver} = await import('../src/owners/readingsChanged.ts')

// The kernel's `readings_changed` receipt (wire shape fixed with the kernel lane) marks every held owner answer unread and asks
// again those with live readers: one ask per key however many notices arrive, none for answers nobody reads.
const receipt = (seq, extra = {}) => ({seq, schema: 'oi.kernel-event/v1', version: 1, event: 'readings_changed', scopes: ['root', 'project:O-I'], epoch: seq, ...extra})
const settle = async () => { for (let i = 0; i < 6; i++) await new Promise(resolve => setImmediate(resolve)) }
const manualTimers = () => {
  const queue = []
  return {set: run => { queue.push(run); return run }, clear: handle => { const i = queue.indexOf(handle); if (i >= 0) queue.splice(i, 1) }, fire: () => queue.splice(0).forEach(run => run()), size: () => queue.length}
}

test('the receipt is read by its contract: non-empty known scopes and an integer epoch', () => {
  assert.deepEqual(readingsChangedOf(receipt(3)), {scopes: ['root', 'project:O-I'], epoch: 3})
  assert.equal(readingsChangedOf(receipt(3, {scopes: []})), null)
  assert.equal(readingsChangedOf(receipt(3, {scopes: ['elsewhere']})), null)
  assert.equal(readingsChangedOf(receipt(3, {epoch: 'x'})), null)
  assert.equal(readingsChangedOf({...receipt(3), event: 'file_changed'}), null)
})

test('a notice asks the owner again once for a key with readers, and not at all for a key nobody reads', async () => {
  const registry = createOwnerReadings(() => 1_000)
  let reads = 0, other = 0
  const watched = registry.entry('watched', async () => ({value: ++reads}))
  const left = registry.entry('left', async () => ({value: ++other}))
  const off = watched.subscribe(() => {})
  const offLeft = left.subscribe(() => {})
  await watched.ensure('1|central'); await left.ensure('1|central')
  offLeft(); await settle()
  assert.equal(watched.asks, 1); assert.equal(left.asks, 1)

  const timers = manualTimers()
  const driver = createReadingsChangedDriver(registry, 250, timers)
  driver.receive([receipt(1)]); driver.receive([receipt(2)]); driver.receive([receipt(3)])
  assert.equal(timers.size(), 1, 'a burst is one scheduled re-read')
  assert.equal(watched.asks, 1, 'nothing is asked before the debounce ends')
  timers.fire(); await settle()
  assert.equal(watched.asks, 2, 'the key with a reader is asked once')
  assert.equal(watched.snapshot().value, 2)
  assert.equal(left.asks, 1, 'the key nobody reads is not asked')

  // The unread answer is drawn carried by its next reader, and the owner is asked then.
  const back = left.subscribe(() => {})
  await left.ensure('1|central')
  assert.equal(left.asks, 2)
  back(); off()
})

test('a notice that arrives while a read runs is followed by exactly one more read, not one per notice', async () => {
  const registry = createOwnerReadings(() => 1_000)
  let release, reads = 0
  const entry = registry.entry('slow', () => new Promise(resolve => { const n = ++reads; release = () => resolve({value: n}) }))
  const off = entry.subscribe(() => {})
  const first = entry.ensure('1|central'); await settle(); release(); await first
  void registry.moved(); void registry.moved(); void registry.moved(); await settle()
  assert.equal(reads, 2, 'the first moved() reads; the others wait behind it')
  release(); await settle()
  assert.equal(reads, 3, 'one read follows the running one, however many notices arrived')
  release(); await settle(); await settle()
  assert.equal(entry.asks, 3)
  off()
})

test('receipts that are not the notice schedule nothing', () => {
  const timers = manualTimers()
  const driver = createReadingsChangedDriver(createOwnerReadings(), 250, timers)
  driver.receive([{seq: 1, schema: 's', version: 1, event: 'file_changed', path: 'x'}, receipt(2, {scopes: []})])
  assert.equal(timers.size(), 0)
})
